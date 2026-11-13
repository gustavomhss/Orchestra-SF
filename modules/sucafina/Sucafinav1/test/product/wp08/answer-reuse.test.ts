import { expect, test } from "bun:test"
import { createAnswerReusePort } from "../../../product/collaboration/answer-reuse.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

test("answer reuse delegates cross-actor scope and authorization to producer", async () => {
  const context = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "reviewer", accessRevision: "a", policyVersion: "v" } } as unknown as TrustedDomainContext
  const scope = { sourceRef: { surface: "dashboard", type: "projects", id: "project", incarnation: "physical" }, fields: ["milestone"], period: { start: "2026-03-01", end: "2026-03-31" }, materialDependencies: [], scopeDefinitionVersion: "1" } as const
  const viewer = { incarnation: "physical", sourceFingerprint: "source" }
  const answer = { id: "a1", ref: "r1", authorRef: "responder", questionId: "q1", body: "March response", digest: digestSfValue({ message: "thread" }) }
  let authorized = false
  let state: Record<string, unknown> = { threads: { q1: { message: "thread" } } }
  const port = createAnswerReusePort({
    host: { requestFor: () => new Request("https://local.invalid"), revalidate: async () => true, persistence: { transactionAll: async (work: (snapshots: never) => Promise<{ commit: boolean; value: unknown }>) => (await work({} as never)).value, currentSnapshots: () => ({}) } as never },
    state: {
      transaction: async (_request: Request, _command: unknown, work: (value: never, authority: never) => Promise<{ commit: boolean; value: boolean }>) => { const result = await work(state as never, { principalRef: "reviewer", accessRevision: "a", policyVersion: "v" } as never); return { status: "ok" as const, storageVersion: 1, aggregateRevision: 1, incarnation: "i", value: result.value } },
      read: async (_request: Request, _namespace: string, read: (value: never, authority: never) => unknown) => ({ status: "ok" as const, storageVersion: 1, aggregateRevision: 1, incarnation: "i", value: read(state as never, { principalRef: "reviewer", accessRevision: "a", policyVersion: "v" } as never) }),
    } as never,
    target: { ref: "target", incarnation: "target-inc" },
    answer: async () => ({ status: "ok" as const, value: answer }),
    belongsToQuestion: async () => true,
    scopeForAnswer: async () => ({ status: "ok" as const, value: { scope: { ...scope, sourceRef: { ...scope.sourceRef, incarnation: viewer.incarnation } } } }),
    observe: async () => ({ state: "available" as const, sourceVersion: 1, incarnation: viewer.incarnation, physicalIncarnation: "physical", sourceFingerprint: viewer.sourceFingerprint, dependencyFingerprint: "deps", scopeFingerprint: "scope" }),
    fence: async () => true,
    authorizeConfirmation: async (_context, questionId, answerRef, mutation) => { authorized = questionId === "q1" && answerRef === "r1" && mutation.idempotencyKey === "confirm"; return authorized },
  })
  expect(await port.confirm("q1", "different-answer", { expectedStorageVersion: 0, idempotencyKey: "confirm" }, context)).toMatchObject({ status: "denied" })
  expect(await port.confirm("qq", "r1", { expectedStorageVersion: 0, idempotencyKey: "confirm" }, context)).toMatchObject({ status: "denied" })
  expect(await port.confirm("q1", "r1", { expectedStorageVersion: 0, idempotencyKey: "confirm" }, context)).toMatchObject({ status: "ok" })
  expect(authorized).toBe(true)
  expect(await port.read("q1", context)).toMatchObject({ status: "ok", value: { answerRef: "r1", answer: "March response", authorRef: "responder" } })
  viewer.incarnation = "other-viewer-scope"
  expect(await port.read("q1", context)).toMatchObject({ status: "ok", value: { answerRef: "r1" } })
  viewer.sourceFingerprint = "changed"
  expect(await port.read("q1", context)).toMatchObject({ status: "stale", reason: "answer-scope-changed" })
})
