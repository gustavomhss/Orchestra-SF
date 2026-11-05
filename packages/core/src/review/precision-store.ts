export * as ReviewPrecisionStore from "./precision-store"

import { createHash } from "node:crypto"
import { isDeepStrictEqual } from "node:util"
import { eq } from "drizzle-orm"
import { Effect, Exit, Schema } from "effect"
import { Event } from "@orchestra/schema/event"
import { ReviewPrecisionEvent } from "@orchestra/schema/review-precision-event"
import { Database } from "../database/database"
import { EventV2 } from "../event"
import type { ReviewLedger } from "./ledger"

const manifest = { definitions: Event.durable(ReviewPrecisionEvent.Definitions), schema: ReviewPrecisionEvent.Observed }
const decode = Schema.decodeUnknownSync(ReviewPrecisionEvent.Observed.data)

/** Host-only. Call after source-bound outcomes settle, never with model receipt items. */
export const append = Effect.fn("ReviewPrecisionStore.append")(function* (input: {
  readonly review: string
  readonly project: string
  readonly reads: ReadonlyArray<ReviewLedger.Read>
}) {
  const data = decode({ ledgerID: ReviewPrecisionEvent.AGGREGATE, ...input }, { onExcessProperty: "error" })
  const reads = new Map<string, typeof data.reads[number]>()
  for (const read of data.reads) {
    const identity = JSON.stringify([read.pack, read.rule, read.generation, read.fingerprint])
    const existing = reads.get(identity)
    if (existing && existing.outcome !== read.outcome) throw new Error("precision-conflict")
    reads.set(identity, read)
  }
  const wanted = {
    ...data,
    reads: [...reads.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map((entry) => entry[1]),
  }
  const database = yield* Database.Service
  const events = yield* EventV2.Service
  const id = EventV2.ID.make(`evt_review_precision_${createHash("sha256").update(data.review).digest("hex")}`)
  const retained = yield* existing(database.db, id)
  if (retained) return requireEquivalent(retained, wanted)
  const published = yield* Effect.exit(events.publish(ReviewPrecisionEvent.Observed, wanted, { id }))
  if (Exit.isSuccess(published)) {
    if (!published.value.durable) throw new Error("precision-invalid")
    return batch(id, published.value.durable.seq, wanted)
  }
  // Another caller may have committed this exact review while publish waited on
  // the database. Recover only the immutable equivalent winner, never overwrite.
  const winner = yield* existing(database.db, id)
  if (winner) return requireEquivalent(winner, wanted)
  return yield* Effect.failCause(published.cause)
})

/** Read the private global aggregate in pages; no legacy receipt is reinterpreted. */
export const history = Effect.fn("ReviewPrecisionStore.history")(function* () {
  const database = yield* Database.Service
  const batches: ReviewLedger.Batch[] = []
  let after = -1
  while (true) {
    const page = yield* EventV2.readAggregate(database.db, {
      aggregateID: ReviewPrecisionEvent.AGGREGATE, after, limit: 1000, manifest,
    })
    for (const event of page.events) {
      if (!event.durable || event.durable.aggregateID !== ReviewPrecisionEvent.AGGREGATE)
        throw new Error("precision-invalid")
      batches.push(batch(event.id, event.durable.seq, event.data))
    }
    if (!page.hasMore) return batches
    const next = page.events.at(-1)?.durable?.seq
    if (next === undefined || next <= after) throw new Error("precision-invalid")
    after = next
  }
})

const existing = Effect.fn("ReviewPrecisionStore.existing")(function* (db: Database.Interface["db"], id: EventV2.ID) {
  const row = yield* db.select().from(EventV2.EventTable).where(eq(EventV2.EventTable.id, id)).get().pipe(Effect.orDie)
  if (!row) return undefined
  if (row.aggregate_id !== ReviewPrecisionEvent.AGGREGATE ||
      row.type !== EventV2.versionedType(ReviewPrecisionEvent.Observed.type, 1)) throw new Error("precision-conflict")
  return { id: row.id, seq: row.seq, data: decode(row.data, { onExcessProperty: "error" }) }
})

function requireEquivalent(retained: { id: EventV2.ID; seq: number; data: typeof ReviewPrecisionEvent.Observed.data.Type },
  wanted: typeof ReviewPrecisionEvent.Observed.data.Type) {
  if (!isDeepStrictEqual(retained.data, wanted)) throw new Error("precision-conflict")
  return batch(retained.id, retained.seq, retained.data)
}

function batch(id: string, seq: number, data: typeof ReviewPrecisionEvent.Observed.data.Type): ReviewLedger.Batch {
  if (!Number.isSafeInteger(seq) || seq < 0 || !Number.isSafeInteger(seq + 1)) throw new Error("precision-invalid")
  return { id, project: data.project, order: seq + 1, reads: data.reads }
}
