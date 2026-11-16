import { expect, test } from "bun:test"
import { Option, Schema } from "effect"
import { SfCollaboration } from "@orchestra/schema/sucafina/collaboration"
import { createSfCollaborationClient } from "@orchestra/client/sucafina/collaboration"
import type { SfTransport } from "@orchestra/client/sucafina/transport"

test("detail reads accept only their exact exclusive selectors", async () => {
  const relation = SfCollaboration.operations["collaboration.relation-read"]
  const confirmation = SfCollaboration.operations["collaboration.confirmation-project"]
  const relationDecode = Schema.decodeUnknownOption(Schema.toType(relation.input), { onExcessProperty: "error" })
  const confirmationDecode = Schema.decodeUnknownOption(Schema.toType(confirmation.input), { onExcessProperty: "error" })
  const selectionRef = "confirmation-selection:" + "a".repeat(64)
  expect(Option.isSome(relationDecode({ recordRefs: ["a"] }))).toBe(true)
  expect(Option.isSome(relationDecode({ relationRef: "relation" }))).toBe(true)
  expect(Option.isNone(relationDecode({ relationRef: "relation", recordRefs: ["a"] }))).toBe(true)
  expect(Option.isNone(relationDecode({ relationRef: "relation", extra: true }))).toBe(true)
  expect(Option.isSome(confirmationDecode({ id: "confirmation" }))).toBe(true)
  expect(Option.isSome(confirmationDecode({ selectionRef }))).toBe(true)
  expect(Option.isNone(confirmationDecode({ id: "confirmation", selectionRef }))).toBe(true)
  expect(Option.isNone(confirmationDecode({ selectionRef: selectionRef.toUpperCase() }))).toBe(true)
  const calls: string[] = []
  const transport: SfTransport = { async execute(operation) {
    calls.push(operation.operationId)
    return { kind: "transport-error", reason: "contract-unavailable" }
  } }
  const client = createSfCollaborationClient(transport)
  const options = { signal: new AbortController().signal }
  await client["collaboration.relation-read"]({ relationRef: "relation" }, options)
  await client["collaboration.confirmation-project"]({ selectionRef }, options)
  expect(await client["collaboration.relation-read"]({ recordRefs: ["a", "a"] }, options)).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
  expect(await client["collaboration.confirmation-project"]({ id: "x", selectionRef } as never, options)).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
  expect(calls).toEqual(["collaboration.relation-read", "collaboration.confirmation-project"])
})
