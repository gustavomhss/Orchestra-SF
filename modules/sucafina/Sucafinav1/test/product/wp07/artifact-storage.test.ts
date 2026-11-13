import { expect, test } from "bun:test"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createReviewPort } from "../../../product/reviews/port.ts"
import { renderPreservedReview } from "../../../product/reviews/render.ts"
import { createReviewArtifactStorage } from "../../../product/reports/storage.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { testPersistence } from "../../fixture/persistence.ts"
import { exportFixture } from "./export-fixture.ts"

test("artifact retry preserves the first bytes across ZIP timestamps, conflicts on changed intent, and rechecks access", async () => {
  const persistence = testPersistence()
  const access = { allowed: true }
  const context = { kind: "ui", binding: { principalRef: "fixture-admin", installationId: "fixture", projectId: "fixture", accessRevision: "fixture-access-v1", policyVersion: "fixture-policy-v1" } } as unknown as TrustedDomainContext
  const request = new Request("https://example.test/wp07")
  const state = createSfProductState({ persistence: persistence.persistence, createId: () => "fixture-state", resolveTarget: async () => ({ incarnation: "fixture-creation" }), authorize: async () => access.allowed ? { principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion } : undefined })
  const fixture = exportFixture()
  const section = fixture.review.sections[0]!
  const reviews = createReviewPort({
    state, creationTarget: { ref: "review-creation", incarnation: "fixture-creation" }, now: () => "2026-11-13T04:01:10Z", requestFor: () => request,
    revalidate: async () => access.allowed, revalidateEvidence: async () => access.allowed,
    authorizeSections: async () => access.allowed, authorizeComments: async () => access.allowed, authorizeDecision: async () => access.allowed, authorizeSensitivity: async () => access.allowed, authorizeOutcome: async () => access.allowed, authorizeOutcomeComparison: async () => access.allowed,
    select: async () => ({ status: "ok", value: [{ id: section.id, title: section.title, period: section.period, recordCount: section.count, projection: section.content as DomainProjection, comments: fixture.review.comments }] }),
  })
  const preserved = await reviews.preserve({ id: "retry-review", selectionRef: "fixture", sectionRefs: [section.id], expectedStorageVersion: 0, idempotencyKey: "preserve", targetIncarnation: "fixture-creation" }, context)
  if (preserved.status !== "ok") throw new Error(`Review unavailable: ${preserved.reason}`)
  const storage = createReviewArtifactStorage({ state, host: { requestFor: () => request, revalidate: async () => access.allowed }, reviews, creationTarget: { ref: "review-creation", incarnation: "fixture-creation" }, operationIdentity: () => "artifact-save", maxBytes: 5_000_000 })
  const first = await renderPreservedReview(preserved.value, { title: "Retry report", format: "docx", sectionRefs: [section.id] })
  if (!first.ok) throw new Error("First render unavailable")
  const entry = { reviewRef: preserved.value.id, sectionRefs: [section.id], format: "docx" as const, recordCount: 25, evidenceRefs: [], artifact: first }
  const saved = await storage.put(entry, context)
  if (saved.status !== "ok") throw new Error(`Storage unavailable: ${saved.reason}`)
  const before = await state.read(request, "documents", () => null)
  // ZIP's timestamp resolution is two seconds. This discriminates the old byte-based command digest.
  await new Promise((resolve) => setTimeout(resolve, 2100))
  const rerendered = await renderPreservedReview(preserved.value, { title: "Retry report", format: "docx", sectionRefs: [section.id] })
  if (!rerendered.ok) throw new Error("Retry render unavailable")
  expect(rerendered.bytes).not.toEqual(first.bytes)
  expect(await storage.put({ ...entry, artifact: rerendered }, context)).toEqual(saved)
  const after = await state.read(request, "documents", () => null)
  expect(after).toEqual(before)
  expect(new Uint8Array(await (await storage.download(saved.value.artifactRef, context)).arrayBuffer())).toEqual(first.bytes)
  const renamed = await renderPreservedReview(preserved.value, { title: "Retry-report", format: "docx", sectionRefs: [section.id] })
  if (!renamed.ok) throw new Error("Changed render unavailable")
  expect(renamed.name).toBe(first.name)
  expect((await storage.put({ ...entry, artifact: renamed }, context)).status).toBe("conflict")
  const changedFormat = await renderPreservedReview(preserved.value, { title: "Retry report", format: "pptx", sectionRefs: [section.id] })
  if (!changedFormat.ok) throw new Error("Changed format unavailable")
  expect((await storage.put({ ...entry, format: "pptx", artifact: changedFormat }, context)).status).toBe("conflict")
  access.allowed = false
  expect((await storage.put(entry, context)).status).toBe("denied")
  expect((await storage.read(saved.value.artifactRef, context)).status).toBe("denied")
  expect((await storage.download(saved.value.artifactRef, context)).status).toBe(403)
}, 15000)
