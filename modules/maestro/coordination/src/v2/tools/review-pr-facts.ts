export * as ReviewPRFactsV2 from "./review-pr-facts"

import { randomUUID } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { ReviewRouting } from "@orchestra/core/review/routing"
import { Tool } from "@orchestra/core/tool/tool"
import { MaestroEvent } from "@orchestra/schema/maestro-event"
import { NonNegativeInt, PositiveInt } from "@orchestra/schema/schema"
import { Effect, Option, Schema } from "effect"

const LIMIT = 4 * 1024 * 1024
const Digest = Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/))
const Confirmed = Schema.Struct({
  id: Schema.NonEmptyString, path: Schema.NonEmptyString, line: PositiveInt, endLine: Schema.optional(PositiveInt),
  severity: Schema.NonEmptyString, class: Schema.NonEmptyString, node: Schema.NonEmptyString,
  lens: Schema.NonEmptyString, rule: Schema.NonEmptyString, trigger: Schema.NonEmptyString,
  rungs: Schema.Array(Schema.NonEmptyString), evidence: MaestroEvent.Review.Evidence,
})
export const Facts = Schema.Struct({
  candidate: Digest,
  method: Schema.NonEmptyString,
  routing: ReviewRouting.Record,
  scope: Schema.Struct({ base: Schema.NonEmptyString, head: Schema.NonEmptyString, files: NonNegativeInt, changedLines: NonNegativeInt }),
  confirmed: Schema.Array(Confirmed),
})
export type Facts = typeof Facts.Type

const decodeJson = Schema.decodeUnknownOption(Schema.UnknownFromJsonString)
const decode = Schema.decodeUnknownOption(Facts)
const reason = (code: string, detail: string) => new Tool.Failure({ message: `${code}: ${detail}`, metadata: { reason: code } })

/** `store` is the host's analysisStore(`pr_${candidate}`), never model-selected. */
export function file(store: string, candidate: string) {
  if (!/^[0-9a-f]{64}$/.test(candidate) || path.basename(store) !== `pr_${candidate}`)
    throw reason("pr-facts-identity", "invalid candidate or analysis store")
  return path.join(store, "host-facts.json")
}

/** Undefined means absent; invalid, oversized, unreadable and mismatched files fail closed. */
export const read = Effect.fn("ReviewPRFactsV2.read")(function* (store: string, candidate: string) {
  const target = yield* Effect.try({ try: () => file(store, candidate), catch: (error) => error instanceof Tool.Failure ? error : reason("pr-facts-identity", String(error)) })
  const bytes = yield* Effect.tryPromise({
    try: async () => {
      const handle = await fs.open(target, "r").catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return undefined
        throw error
      })
      if (!handle) return undefined
      try {
        const buffer = Buffer.alloc(LIMIT + 1)
        let offset = 0
        while (offset < buffer.length) {
          const chunk = await handle.read(buffer, offset, buffer.length - offset, null)
          if (chunk.bytesRead === 0) break
          offset += chunk.bytesRead
        }
        return buffer.subarray(0, offset)
      } finally {
        await handle.close()
      }
    },
    catch: (error) => reason("pr-facts-unavailable", String(error)),
  })
  if (bytes === undefined) return undefined
  if (bytes.length > LIMIT) return yield* reason("pr-facts-oversized", "host facts exceed 4 MiB")
  const text = yield* Effect.try({ try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes), catch: () => reason("pr-facts-corrupt", "invalid UTF-8") })
  const parsed = Option.flatMap(decodeJson(text), (value) => decode(value, { onExcessProperty: "error" }))
  if (Option.isNone(parsed)) return yield* reason("pr-facts-corrupt", "invalid host facts")
  if (parsed.value.candidate !== candidate) return yield* reason("pr-facts-identity", "candidate mismatch")
  return parsed.value
})

/** Call only after completed fanout; no card, verdict, approval or review receipt belongs here. */
export const write = Effect.fn("ReviewPRFactsV2.write")(function* (store: string, facts: Facts) {
  const target = yield* Effect.try({ try: () => file(store, facts.candidate), catch: (error) => error instanceof Tool.Failure ? error : reason("pr-facts-identity", String(error)) })
  if (Option.isNone(decode(facts, { onExcessProperty: "error" }))) return yield* reason("pr-facts-corrupt", "invalid host facts")
  const text = JSON.stringify(facts)
  if (Buffer.byteLength(text, "utf8") > LIMIT) return yield* reason("pr-facts-oversized", "host facts exceed 4 MiB")
  yield* Effect.tryPromise({
    try: async () => {
      await fs.mkdir(store, { recursive: true })
      const temporary = `${target}.${randomUUID()}.tmp`
      try {
        await Bun.write(temporary, text)
        await fs.rename(temporary, target)
      } finally {
        await fs.rm(temporary, { force: true })
      }
    },
    catch: (error) => reason("pr-facts-unavailable", String(error)),
  })
})
