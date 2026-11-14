import { expect, test } from "bun:test"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createReviewPort } from "../../../product/reviews/port.ts"
import { renderPreservedReview } from "../../../product/reviews/render.ts"
import { createReviewArtifactStorage } from "../../../product/reports/storage.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { SfProductState } from "../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { testPersistence } from "./persistence.ts"
import { exportFixture } from "./export-fixture.ts"

test("artifact retry preserves the first bytes across ZIP timestamps, conflicts on changed intent, and rechecks access", async () => {
  const persistence = testPersistence()
  const access = { allowed: true, revision: "fixture-access-v1", policy: "fixture-policy-v1" }
  const context = { kind: "ui", binding: { principalRef: "fixture-admin", installationId: "fixture", projectId: "fixture", accessRevision: "fixture-access-v1", policyVersion: "fixture-policy-v1" } } as unknown as TrustedDomainContext
  const current = (call: TrustedDomainContext) => access.allowed && call.binding.principalRef === context.binding.principalRef && call.binding.installationId === context.binding.installationId && call.binding.projectId === context.binding.projectId && call.binding.accessRevision === access.revision && call.binding.policyVersion === access.policy
  const request = new Request("https://example.test/wp07")
  const state = createSfProductState({ persistence: persistence.persistence, createId: () => "fixture-state", resolveTarget: async () => ({ incarnation: "fixture-creation" }), authorize: async () => access.allowed ? { principalRef: context.binding.principalRef, accessRevision: access.revision, policyVersion: access.policy } : undefined })
  const fixture = exportFixture()
  const section = fixture.review.sections[0]!
  // The render corpus deliberately contains no resolver. This storage fixture
  // supplies typed synthetic C17 identities and admits exactly those identities.
  const captured = section.content as DomainProjection
  const projection: DomainProjection = {
    ...captured,
    values: captured.values.map((value) => {
      const target = { surface: "dashboard" as const, recordType: "projects", recordId: value.id, incarnation: `fixture-${value.id}-v1`, version: 1, fields: ["notes"], period: value.period, projectionDigest: digestSfValue(value) }
      const evidence: BusinessEvidenceRef = { schema: "sf-evidence-v1", refId: `fixture-evidence:${value.id}`, installationId: "fixture", projectId: "fixture", refDigest: digestSfValue(target), evidenceLevel: "observed", kind: "record", target }
      return { ...value, sourceRefs: [evidence], drilldown: evidence }
    }),
  }
  const evidenceRefs = projection.values.flatMap((value) => value.sourceRefs)
  const evidenceIdentities = new Set(evidenceRefs.map(digestSfValue))
  const reviews = createReviewPort({
    state, creationTarget: { ref: "review-creation", incarnation: "fixture-creation" }, now: () => "2026-11-13T04:01:10Z", requestFor: () => request,
    revalidate: async () => access.allowed, revalidateEvidence: async (_context, refs) => access.allowed && refs.every((ref) => evidenceIdentities.has(digestSfValue(ref))),
    authorizeSections: async () => access.allowed, authorizeComments: async () => access.allowed, authorizeDecision: async () => access.allowed, authorizeSensitivity: async () => access.allowed, authorizeOutcome: async () => access.allowed, authorizeOutcomeComparison: async () => access.allowed,
    select: async () => ({ status: "ok", value: [{ id: section.id, title: section.title, period: section.period, recordCount: section.count, projection, comments: fixture.review.comments }] }),
  })
  const preserved = await reviews.preserve({ id: "retry-review", selectionRef: "fixture", sectionRefs: [section.id], expectedStorageVersion: 0, idempotencyKey: "preserve", targetIncarnation: "fixture-creation" }, context)
  if (preserved.status !== "ok") throw new Error(`Review unavailable: ${preserved.reason}`)
  const storage = createReviewArtifactStorage({ state, host: { requestFor: () => request, revalidate: async (call) => current(call) }, reviews, creationTarget: { ref: "review-creation", incarnation: "fixture-creation" }, operationIdentity: () => "artifact-save", maxBytes: 5_000_000 })
  const first = await renderPreservedReview(preserved.value, { title: "Retry report", format: "docx", sectionRefs: [section.id] })
  if (!first.ok) throw new Error("First render unavailable")
  const entry = { reviewRef: preserved.value.id, sectionRefs: [section.id], format: "docx" as const, recordCount: 25, evidenceRefs, artifact: first }
  const unavailableStorage = createReviewArtifactStorage({ state: { ...state, transaction: async () => ({ status: "unavailable", reason: "cross-surface-transaction-unavailable" }) }, host: { requestFor: () => request, revalidate: async (call) => current(call) }, reviews, creationTarget: { ref: "review-creation", incarnation: "fixture-creation" }, operationIdentity: () => "artifact-save", maxBytes: 5_000_000 })
  expect(await unavailableStorage.put(entry, context)).toEqual({ status: "unavailable", reason: "cross-surface-transaction-unavailable" })
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
  expect([...new Uint8Array(await (await storage.download(saved.value.artifactRef, context)).arrayBuffer())]).toEqual([...first.bytes])
  const renamed = await renderPreservedReview(preserved.value, { title: "Retry-report", format: "docx", sectionRefs: [section.id] })
  if (!renamed.ok) throw new Error("Changed render unavailable")
  expect(renamed.name).toBe(first.name)
  expect((await storage.put({ ...entry, artifact: renamed }, context)).status).toBe("conflict")
  const changedFormat = await renderPreservedReview(preserved.value, { title: "Retry report", format: "pptx", sectionRefs: [section.id] })
  if (!changedFormat.ok) throw new Error("Changed format unavailable")
  expect((await storage.put({ ...entry, format: "pptx", artifact: changedFormat }, context)).status).toBe("conflict")
  access.revision = "fixture-access-v2"
  access.policy = "fixture-policy-v2"
  const renewed = { ...context, binding: { ...context.binding, accessRevision: access.revision, policyVersion: access.policy } } as TrustedDomainContext
  expect((await storage.download(saved.value.artifactRef, context)).status).toBe(403)
  expect((await storage.read(saved.value.artifactRef, renewed)).status).toBe("ok")
  expect([...new Uint8Array(await (await storage.download(saved.value.artifactRef, renewed)).arrayBuffer())]).toEqual([...first.bytes])
  const documents = (persistence.state.dashboard.data.__sfProductV1 as SfProductState).documents
  const originalArtifact = structuredClone(documents[saved.value.artifactRef]!)
  if (!originalArtifact || typeof originalArtifact !== "object" || Array.isArray(originalArtifact)) throw new Error("Stored artifact unavailable")
  expect(originalArtifact).toMatchObject({ policyVersion: "fixture-policy-v1" })
  const replaced = { ...originalArtifact, reviewRef: "different-review" }
  documents[saved.value.artifactRef] = replaced
  expect((await storage.download(saved.value.artifactRef, renewed)).status).toBe(403)
  documents[saved.value.artifactRef] = originalArtifact
  const foreign = { ...renewed, binding: { ...renewed.binding, principalRef: "another-principal" } } as TrustedDomainContext
  expect((await storage.download(saved.value.artifactRef, foreign)).status).toBe(403)
  access.allowed = false
  expect((await storage.download(saved.value.artifactRef, renewed)).status).toBe(403)
  expect((await storage.put(entry, context)).status).toBe("denied")
  expect((await storage.read(saved.value.artifactRef, context)).status).toBe("denied")
  expect((await storage.download(saved.value.artifactRef, context)).status).toBe(403)
}, 15000)

