import { expect, test } from "bun:test"
import { createAnswerReusePort } from "../../../product/collaboration/answer-reuse.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

test("answer reuse delegates cross-actor scope and authorization to producer", async () => {
  const context = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "reviewer", accessRevision: "a", policyVersion: "v" } } as unknown as TrustedDomainContext
  const scope = { sourceRef: { surface: "dashboard", type: "projects", id: "project", incarnation: "physical" }, fields: ["milestone"], period: { start: "2026-03-01", end: "2026-03-31" }, materialDependencies: [], scopeDefinitionVersion: "1" } as const
  const viewer = { incarnation: "physical", sourceFingerprint: "source", version: 1, allowed: true, now: 1000, readsUntilChange: 0 }
  const answer = { id: "a1", ref: "r1", authorRef: "responder", questionId: "q1", body: "March response", digest: digestSfValue({ message: "answer" }), threadDigest: digestSfValue({ message: "thread" }) }
  let authorized = false
  let state: Record<string, unknown> = { threads: { q1: { message: "thread" } } }
  const port = createAnswerReusePort({
    host: { requestFor: () => new Request("https://local.invalid"), revalidate: async () => true, persistence: { transactionAll: async (work: (snapshots: never) => Promise<{ commit: boolean; value: unknown }>) => (await work({} as never)).value, currentSnapshots: () => ({}) } as never },
    state: {
      transaction: async (_request: Request, _command: unknown, work: (value: never, authority: never) => Promise<{ commit: boolean; value: boolean }>) => { const result = await work(state as never, { principalRef: "reviewer", accessRevision: "a", policyVersion: "v" } as never); return { status: "ok" as const, storageVersion: 1, aggregateRevision: 1, incarnation: "i", value: result.value } },
      read: async (_request: Request, _namespace: string, read: (value: never, authority: never) => unknown) => ({ status: "ok" as const, storageVersion: 1, aggregateRevision: 1, incarnation: "i", value: read(state as never, { principalRef: "reviewer", accessRevision: "a", policyVersion: "v" } as never) }),
    } as never,
    target: { ref: "target", incarnation: "target-inc" },
    answer: async () => { if (viewer.readsUntilChange > 0 && --viewer.readsUntilChange === 0) viewer.sourceFingerprint = "changed-during-egress"; return { status: "ok" as const, value: answer } },
    belongsToQuestion: async () => true,
    scopeForAnswer: async () => ({ status: "ok" as const, value: { scope: { ...scope, sourceRef: { ...scope.sourceRef, incarnation: viewer.incarnation } } } }),
    observe: async () => viewer.allowed ? { state: "available" as const, sourceVersion: viewer.version, incarnation: viewer.incarnation, physicalIncarnation: "physical", sourceFingerprint: viewer.sourceFingerprint, dependencyFingerprint: "deps", scopeFingerprint: "scope" } : { state: "access-unavailable" as const, sourceVersion: viewer.version },
    fence: async (_scope, observation) => viewer.allowed && observation.sourceFingerprint === viewer.sourceFingerprint,
    authorizeConfirmation: async (_context, questionId, answerRef, mutation) => { authorized = questionId === "q1" && answerRef === "r1" && mutation.idempotencyKey === "confirm"; return authorized },
    now: () => viewer.now,
  })
  const prepared = await port.prepare("q1", "r1", context)
  if (prepared.status !== "ok" || !("observationRef" in prepared.value)) throw new Error("answer observation unavailable")
  const mutation = { expectedStorageVersion: 0, idempotencyKey: "confirm", observationRef: prepared.value.observationRef, observedSourceVersion: prepared.value.observedSourceVersion, expectedScopeFingerprint: prepared.value.expectedScopeFingerprint }
  expect(await port.read("q1", context)).toEqual({ status: "needs-input", reason: "answer-unconfirmed" })
  expect(await port.read("q1", { ...context, binding: { ...context.binding, principalRef: "another-user" } } as TrustedDomainContext)).toEqual({ status: "unavailable", reason: "answer-reuse-unavailable" })
  viewer.allowed = false
  expect(await port.read("q1", context)).toEqual({ status: "unavailable", reason: "answer-reuse-unavailable" })
  viewer.allowed = true
  expect(await port.confirm("q1", "different-answer", mutation, context)).toMatchObject({ status: "denied" })
  expect(await port.confirm("qq", "r1", mutation, context)).toMatchObject({ status: "denied" })
  expect(await port.confirm("q1", "r1", { ...mutation, observationRef: "forged" }, context)).toMatchObject({ status: "denied" })
  expect(await port.confirm("q1", "r1", { ...mutation, expectedScopeFingerprint: "forged" }, context)).toMatchObject({ status: "denied" })
  expect(await port.confirm("q1", "r1", { ...mutation, observedSourceVersion: 2 }, context)).toMatchObject({ status: "denied" })
  expect(await port.confirm("q1", "r1", mutation, { ...context, binding: { ...context.binding, principalRef: "another-user" } } as TrustedDomainContext)).toMatchObject({ status: "denied" })
  viewer.sourceFingerprint = "changed-before-confirm"
  expect(await port.confirm("q1", "r1", mutation, context)).toMatchObject({ status: "conflict" })
  expect(Object.keys(state.threads as object)).toEqual(["q1"])
  viewer.sourceFingerprint = "source"
  viewer.version = 2
  expect(await port.confirm("q1", "r1", mutation, context)).toMatchObject({ status: "ok", value: { observedVersion: 1 } })
  expect(authorized).toBe(true)
  expect(await port.read("q1", context)).toMatchObject({ status: "ok", value: { answerRef: "r1", answer: "March response", authorRef: "responder", observedVersion: 1 } })
  const resolved = { message: "thread", state: "resolved", followingAuthorMessage: "Thank you" }
  ;(state.threads as Record<string, unknown>).q1 = resolved
  answer.threadDigest = digestSfValue(resolved)
  expect(await port.read("q1", context)).toMatchObject({ status: "ok", value: { answerRef: "r1", observedVersion: 1 } })
  const originalDigest = answer.digest
  answer.digest = digestSfValue({ message: "edited answer" })
  expect(await port.read("q1", context)).toEqual({ status: "unavailable", reason: "answer-reuse-unavailable" })
  answer.digest = originalDigest
  viewer.incarnation = "other-viewer-scope"
  expect(await port.read("q1", context)).toMatchObject({ status: "ok", value: { answerRef: "r1" } })
  viewer.sourceFingerprint = "changed"
  expect(await port.read("q1", context)).toMatchObject({ status: "stale", reason: "answer-scope-changed" })
  viewer.sourceFingerprint = "source"
  viewer.allowed = false
  expect(await port.read("q1", context)).toEqual({ status: "unavailable", reason: "answer-reuse-unavailable" })
  viewer.allowed = true
  viewer.readsUntilChange = 2
  expect(await port.read("q1", context)).toMatchObject({ status: "stale" })
  viewer.readsUntilChange = 0
  viewer.sourceFingerprint = "source"
  viewer.now = Number.NaN
  expect(await port.confirm("q1", "r1", mutation, context)).toMatchObject({ status: "denied", reason: "answer-observation-unavailable" })
  viewer.now = 0
  expect(await port.confirm("q1", "r1", mutation, context)).toMatchObject({ status: "denied", reason: "answer-observation-unavailable" })
  viewer.now = 1000
  viewer.now += 5 * 60 * 1000
  expect(await port.confirm("q1", "r1", mutation, context)).toMatchObject({ status: "denied", reason: "answer-observation-unavailable" })
})

