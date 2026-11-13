import { expect, test } from "bun:test"
import { createFollowupHandoff } from "../../../product/routines/handoff.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const evidence = { refId: "review", refDigest: "digest" } as BusinessEvidenceRef
const ui = { kind: "ui" } as TrustedDomainContext

test("preparation retains one correlation and confirmation stays human-gated", async () => {
  const calls: unknown[] = []
  let currentEvidence = evidence
  const handoff = createFollowupHandoff({
    resolveNote: async (sourceRef) => ({ status: "ok", value: { sourceRef, stableSourceKey: "review:incarnation", evidence: currentEvidence } }),
    handoff: { create: async (request) => { calls.push(request); return { status: "ok", value: "receipt" } } },
  })
  const selection = { noteId: "n1", sourceRef: "review", action: "Review", owner: "person", due: "2027-01-31", priority: "normal" as const, notes: "" }
  const first = await handoff.prepare(selection, ui)
  const retry = await handoff.prepare(selection, ui)
  expect(first).toEqual(retry)
  if (first.status !== "ok") throw new Error(first.reason)
  expect(first.value.recipientRef).toBeUndefined()
  currentEvidence = { ...evidence, refDigest: "new-version" }
  const changed = await handoff.prepare(selection, ui)
  if (changed.status !== "ok") throw new Error(changed.reason)
  expect(changed.value.relationKey).toBe(first.value.relationKey)
  expect(changed.value.intent.correlationKey).toBe(first.value.intent.correlationKey)
  expect((await handoff.confirm(first.value, { kind: "native" } as TrustedDomainContext)).status).toBe("denied")
  expect(calls).toHaveLength(0)
  expect(await handoff.confirm(first.value, ui)).toEqual({ status: "ok", value: "receipt" })
  expect(calls).toEqual([first.value])
  expect((await handoff.prepare({ ...selection, owner: "" }, ui)).status).toBe("needs-input")
})

test("update previews the authorized version and forwards the same payload for human confirmation", async () => {
  const calls: unknown[] = []
  const topic = { id: "action", version: 3, action: "Before", owner: "person", due: "2027-01-31", status: "open", priority: "normal", notes: "" }
  const handoff = createFollowupHandoff({
    resolveNote: async (sourceRef) => ({ status: "ok", value: { sourceRef, stableSourceKey: "review:incarnation", evidence } }),
    readTopic: async () => ({ status: "ok", value: topic }),
    revalidateUpdate: async () => true,
    handoff: {
      create: async () => ({ status: "unavailable", reason: "unused" }),
      update: async (request) => { calls.push(request); return { status: "ok", value: "receipt" } },
    },
  })
  const prepared = await handoff.prepareUpdate({ noteId: "n1", sourceRef: "review", topicId: "action", values: { action: "After" } }, ui)
  if (prepared.status !== "ok") throw new Error(prepared.reason)
  expect(prepared.value.before.action).toBe("Before")
  expect(prepared.value.after.action).toBe("After")
  expect(prepared.value.request.expectedVersion).toBe(3)
  expect((await handoff.confirmUpdate(prepared.value.request, { kind: "native" } as TrustedDomainContext)).status).toBe("denied")
  expect(calls).toEqual([])
  expect(await handoff.confirmUpdate(prepared.value.request, ui)).toEqual({ status: "ok", value: "receipt" })
  expect(calls).toEqual([prepared.value.request])
})
