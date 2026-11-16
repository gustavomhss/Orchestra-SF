import { randomUUID } from "node:crypto"
import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import type { MemoryRecord } from "@orchestra/atlas-boundary/business-memory-ports"
import { withAtlasConsumer, atlasValue } from "../../wp02/atlas-consumer-fixture.ts"
import { object } from "../../../../runtime/contract.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { CaseLedgerEvent } from "../../../../product/contracts/decisions.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { enqueueSfLedgerEvent } from "../../../../product/integration/ledger-outbox.ts"
import { createSfAtlasDurableMemory } from "../../../../product/host-binding/atlas-store.ts"

type Journal = Parameters<typeof createSfAtlasDurableMemory>[0]["events"]

/**
 * REV208-NEW-002: real SQLite/C08, actual case-ledger/outbox/C09 producer,
 * actual Atlas kernel and scanner, and a disposed/reopened installation. Faults
 * are injected into separate disposable owner partitions through real SQLite
 * transactions; no fake journal, scanner, or production migration is used.
 */
test("AM05 Atlas physical ordinals survive reopens and reject duplicate, reordered and tampered journals", async () => {
  expectSpawn(import.meta.path)
  await withAtlasConsumer(async (f) => {
    const sources = await f.sources()
    const emit = (item: { caseRef: { id: string; incarnation: string; version: number }; eventRef: Parameters<typeof f.runtime.current.business.context.emitFromLedger>[0] }) =>
      f.call("sf_case_read", { caseRef: encodeCaseRef(item.caseRef) },
        (context) => f.runtime.current.business.context.emitFromLedger(item.eventRef, context))

    // Author an additional authentic C09 source event for the SAME existing case,
    // including its versioned decision ledger and outbox within one C08 commit.
    const addLedger = (previous: { caseRef: { id: string; incarnation: string; version: number }; event: CaseLedgerEvent }, rationale: string) =>
      f.call("sf_case_draft", { caseRef: encodeCaseRef(previous.caseRef), rationale }, async (context) => {
        const request = f.runtime.current.authority.host.requestFor(context)
        if (!request) throw new Error("Current admitted C08 request missing")
        const state = f.runtime.current.authority.state
        const prior = atlasValue(await state.read(request, "cases", (snapshot) => ({
          case: snapshot.cases[previous.caseRef.id], version: snapshot.versions.cases,
        })))
        const outboxVersion = atlasValue(await state.read(request, "outbox", (snapshot) => snapshot.versions.outbox))
        if (!prior.case || prior.case.incarnation !== previous.caseRef.incarnation || prior.case.version !== previous.caseRef.version)
          throw new Error("Case authority/version changed before journal append")
        const id = randomUUID()
        const event: CaseLedgerEvent = {
          ...previous.event,
          id,
          caseRef: { ...previous.caseRef, version: prior.case.version + 1 },
          kind: "reconsideration-accepted",
          principalRef: context.binding.principalRef,
          at: f.clock.at,
          consideredActions: ["Review the same bounded source with a new committed event"],
          factualGaps: ["Only a documented observation is retained"],
          lifecycleState: "investigating",
          rationale,
          outputDigest: digestSfValue({ id, rationale, previous: previous.event.outputDigest }),
        }
        const committed = atlasValue(await state.transaction(request, {
          namespace: "cases", expectedStorageVersion: prior.version,
          additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: outboxVersion }],
          targetRef: previous.caseRef.id, targetIncarnation: previous.caseRef.incarnation,
          idempotencyKey: `atlas-sequence216:${event.id}`, commandDigest: digestSfValue(event),
        }, async (snapshot, authority) => {
          const current = snapshot.cases[previous.caseRef.id]
          if (!current || current.version !== prior.case!.version || current.incarnation !== previous.caseRef.incarnation)
            throw new Error("C08 changed case before authorized event append")
          snapshot.cases[previous.caseRef.id] = { ...current, version: event.caseRef.version, ledger: [...current.ledger, event] }
          const queued = enqueueSfLedgerEvent(snapshot, event, {
            installationId: context.binding.installationId,
            projectId: context.binding.projectId,
            authority,
          })
          if (queued.status !== "ok") throw new Error(`Original outbox producer rejected the event: ${queued.reason}`)
          return { commit: true, value: queued.value }
        }))
        return { caseRef: event.caseRef, event, eventRef: committed.eventRef, key: committed.key }
      })

    const getOwner = (eventId: string) => f.runtime.current.persistence.transaction("dashboard", async (snapshot) => {
      const atlas = object(object(snapshot.data.__sfProductV1).atlas)
      const owner = Object.entries(atlas).find(([, partition]) => eventId in object(object(partition).envelopes))?.[0]
      if (!owner) throw new Error("Authentic committed Atlas owner not found")
      return { commit: false, value: owner }
    })
    const readJournal = (owner: string) => f.runtime.current.persistence.transaction("dashboard", async (snapshot) => {
      const events = object(object(object(snapshot.data.__sfProductV1).atlas)[owner]).events
      if (!Array.isArray(events)) throw new Error("Authentic SQLite Atlas events missing")
      return { commit: false, value: structuredClone(events) as Journal }
    })
    const seedTwo = async (tag: string) => {
      const first = await f.ledger([sources.budget], `Recorded initial observation for ${tag}.`)
      const firstReceipt = await emit(first)
      if (firstReceipt.status !== "committed" || !firstReceipt.eventId) throw new Error("First C09 record not committed")
      const second = await addLedger(first, `Recorded second observation for ${tag}.`)
      const secondReceipt = await emit(second)
      if (secondReceipt.status !== "committed" || !secondReceipt.eventId) throw new Error("Second C09 record not committed")
      const owner = await getOwner(firstReceipt.eventId)
      const original = await readJournal(owner)
      expect(original).toHaveLength(2)
      expect(original.map(([, event]) => event.seq)).toEqual([1, 2])
      expect<readonly string[]>(original.map(([id]) => id)).toEqual([firstReceipt.eventId, secondReceipt.eventId])
      expect(createSfAtlasDurableMemory({ events: original }).read()).toMatchObject({ rejected: 0 })
      return { first, firstReceipt, second, secondReceipt, owner }
    }

    const clean = await seedTwo("durable-reopen")
    const original = await readJournal(clean.owner)
    await f.reopen()
    expect(await readJournal(clean.owner)).toEqual(original)
    const recovered = createSfAtlasDurableMemory({ events: await readJournal(clean.owner) }).read()
    expect(recovered.rejected).toBe(0)
    expect(recovered.store).toHaveLength(2)
    expect([...recovered.log.values()].map((event) => event.seq)).toEqual([1, 2])
    const authorized = await f.call("sf_case_read", { caseRef: encodeCaseRef(clean.second.caseRef) }, (context) =>
      f.runtime.current.business.context.recall({ caseRefs: [clean.second.caseRef], query: "recorded" }, context))
    const firstEventId = clean.firstReceipt.eventId
    const secondEventId = clean.secondReceipt.eventId
    if (!firstEventId || !secondEventId) throw new Error("AM05_COMMITTED_EVENT_IDS_MISSING_AFTER_REOPEN")
    expect<readonly string[]>(authorized.map((record) => record.envelope.eventId)).toEqual([firstEventId, secondEventId])

    // The protected single-event retry is a sparse *projection* of a valid
    // two-event journal. Its necessary consumer projection change is supplied
    // as a complete inert out-of-lease patch for integrator 211.
    const retry = await emit(clean.second)
    expect(retry).toEqual({ ...clean.secondReceipt, status: "already-committed" })
    const third = await addLedger(clean.second, "Recorded third observation after physical SQLite reopen.")
    const thirdReceipt = await emit(third)
    expect(thirdReceipt.status).toBe("committed")
    if (!thirdReceipt.eventId) throw new Error("Post-reopen C09 append failed")
    expect((await readJournal(clean.owner)).map(([, event]) => event.seq)).toEqual([1, 2, 3])
    expect((await f.inspect()).outbox[third.key]?.receipt).toEqual(thirdReceipt)

    const attacks = ["duplicate", "out-of-order", "tampered-ordinal"] as const
    for (const attack of attacks) {
      const target = await seedTwo(attack)
      await f.runtime.current.persistence.transaction("dashboard", async (snapshot) => {
        const events = object(object(object(snapshot.data.__sfProductV1).atlas)[target.owner]).events
        if (!Array.isArray(events) || events.length !== 2 || !events.every((item) =>
          Array.isArray(item) && item.length === 2 && item[1] && typeof item[1] === "object"))
          throw new Error("Corruption injection requires two authentic C09 events")
        const first = events[0] as [string, { seq: number }]
        const second = events[1] as [string, { seq: number }]
        if (attack === "duplicate") second[1].seq = first[1].seq
        if (attack === "out-of-order") [events[0], events[1]] = [events[1], events[0]]
        if (attack === "tampered-ordinal") second[1].seq = 9
        return { commit: true, value: undefined }
      })
      await f.reopen()
      const corrupted = await readJournal(target.owner)
      const visible = createSfAtlasDurableMemory({ events: corrupted }).read()
      expect(visible.rejected).toBeGreaterThan(0)
      expect(visible.store).toEqual([])
      expect([...visible.log]).toEqual([])
      const nextRecord: MemoryRecord = {
        owner: target.owner,
        kind: "task",
        entry: { taskId: `sf-work:am05:sequence216:${attack}`, attempted: ["Inspect durable sequence"], failedWith: [],
          stoppedAt: "blocked", lesson: "Corrupt journal bytes must not admit an append." },
      }
      const reopenedStore = createSfAtlasDurableMemory({ events: structuredClone(corrupted) })
      expect(() => reopenedStore.append(nextRecord)).toThrow("Atlas snapshot is invalid")
      await expect(f.call("sf_case_read", { caseRef: encodeCaseRef(target.second.caseRef) }, (context) =>
        f.runtime.current.business.context.recall({ caseRefs: [target.second.caseRef], query: "recorded" }, context)))
        .rejects.toThrow("SF_MEMORY_READ_UNAVAILABLE")
      const pending = await addLedger(target.second, `This real outbox append must be blocked by ${attack}.`)
      const before = await readJournal(target.owner)
      const stateBefore = await f.inspect()
      expect(stateBefore.outbox[pending.key]?.state).toBe("pending")
      const failed = await emit(pending)
      expect(failed.status).toBe("unavailable")
      expect(await readJournal(target.owner)).toEqual(before)
      const stateAfter = await f.inspect()
      expect(stateAfter.entries).toBe(stateBefore.entries)
      expect(stateAfter.atlasDigest).toBe(stateBefore.atlasDigest)
      expect(stateAfter.outbox[pending.key]).toEqual(stateBefore.outbox[pending.key])
      console.info("SF_ATLAS_SEQUENCE216", JSON.stringify({ attack, rejected: visible.rejected,
        physicalOrdinals: corrupted.map(([, event]) => event.seq), read: "unavailable",
        append: failed.status, outbox: "pending", sqliteReopen: true }))
    }
  }, "sequence-integrity216")
}, 360_000)
