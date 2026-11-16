import { expect, test } from "bun:test"
import { Option, Schema } from "effect"
import { SfIntelligenceMemoryOutcome, SfIntelligenceMemoryOutcomeSelection } from "@orchestra/schema/sucafina/memory"
import { createSfMemoryClient } from "@orchestra/client/sucafina/memory"
import type { SfTransport } from "@orchestra/client/sucafina/transport"

test("outcome selectors remain closed and exclusive, with optional source-issued reference", async () => {
  const ref = "a".repeat(64)
  const legacy = { caseId: "case", incarnation: "inc", version: 1, choiceId: "choice" }
  const decode = Schema.decodeUnknownOption(Schema.toType(SfIntelligenceMemoryOutcome.input), { onExcessProperty: "error" })
  expect(Option.isSome(decode(legacy))).toBe(true)
  expect(Option.isSome(decode({ selectionRef: ref }))).toBe(true)
  expect(Option.isNone(decode({ ...legacy, selectionRef: ref }))).toBe(true)
  expect(Option.isNone(decode({ selectionRef: ref, url: "https://evil.invalid" }))).toBe(true)
  expect(Option.isNone(decode({ selectionRef: ref.toUpperCase() }))).toBe(true)
  expect(Option.isNone(decode({ selectionRef: "a".repeat(63) }))).toBe(true)
  const output = Schema.decodeUnknownOption(Schema.toType(SfIntelligenceMemoryOutcomeSelection.output), { onExcessProperty: "error" })
  expect(Option.isSome(output({ status: "ok" }))).toBe(true)
  expect(Option.isSome(output({ status: "ok", selectionRef: ref }))).toBe(true)
  expect(Option.isNone(output({ status: "ok", selectionRef: "bad" }))).toBe(true)
  const operations: string[] = []
  const transport: SfTransport = { async execute(operation) {
    operations.push(operation.operationId)
    return { kind: "transport-error", reason: "contract-unavailable" }
  } }
  const client = createSfMemoryClient(transport)
  const options = { signal: new AbortController().signal }
  await client["intelligence.memory-outcome"]({ selectionRef: ref }, options)
  await client["intelligence.memory-outcome"](legacy, options)
  expect(await client["intelligence.memory-outcome"]({ ...legacy, selectionRef: ref } as never, options))
    .toEqual({ kind: "transport-error", reason: "contract-mismatch" })
  expect(operations).toEqual(["intelligence.memory-outcome", "intelligence.memory-outcome"])
})
