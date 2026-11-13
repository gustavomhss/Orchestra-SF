import { expect, test } from "bun:test"
import { createSfUiAuthority } from "../../../../product/integration/ui-authority.ts"
import { digestSfEvidenceRef, sfEvidenceSourceMaps } from "../../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../../product/contracts/business-context.ts"
import { createSfBusinessContext } from "../../../../product/host-binding/business-context.ts"

test("historical evidence keeps its original identity and requires authorized historical content", async () => {
  const authority = createSfUiAuthority({
    authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "actor", policyVersion: "v1", accessRevision: "a1" }),
    commandIdentity: async () => "command", createId: () => "request", now: () => 0,
  })
  const admitted = await authority.admit(new Request("http://localhost"), "sf_evidence_get", "a".repeat(64))
  if (admitted.status !== "ok") throw new Error("UI admission failed")
  const value: Extract<BusinessEvidenceRef, { kind: "case-event" }> = {
    schema: "sf-evidence-v1", kind: "case-event", refId: "r", installationId: "i", projectId: "p", refDigest: "", evidenceLevel: "decision",
    target: { caseId: "case", caseIncarnation: "inc", caseVersion: 1, eventId: "event", outputDigest: "d", evidenceRefs: [] },
  }
  const original = { ...value, refDigest: digestSfEvidenceRef(value) }
  const later = { ...original, target: { ...original.target, caseVersion: 2 }, refDigest: "" }
  const current = { ...later, refDigest: digestSfEvidenceRef(later) }
  let proofAllowed = true
  let result: BusinessEvidenceResolution = { state: "historical", ref: original, currentRef: current, differences: [], accessRevision: "a1", checkedAt: "2026-01-01" }
  const context = createSfBusinessContext({
    revalidate: (call) => call.kind === "ui" ? authority.revalidate(call) : Promise.resolve(false),
    resolveSource: async () => result,
    proveContinuity: async () => proofAllowed,
    recall: async () => [],
    emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "event", scanner: { name: "", version: "", status: "unavailable" } }),
  })
  expect((await context.resolve(original, admitted.value)).state).toBe("unavailable")
  result = { ...result, authorizedProjection: { id: "event", caseRef: { id: "case", incarnation: "inc", version: 1 }, kind: "choice-recorded", principalRef: "actor", at: "2026-01-01", consideredActions: [], factualGaps: [], lifecycleState: "draft", rationale: "reason", evidenceRefs: [], outputDigest: "d" } }
  const resolved = await context.resolve(original, admitted.value)
  expect(resolved.state).toBe("historical")
  expect(resolved.ref.refDigest).toBe(original.refDigest)
  expect(resolved.currentRef?.refDigest).toBe(current.refDigest)
  proofAllowed = false
  expect((await context.resolve(original, admitted.value)).state).toBe("unavailable")
  proofAllowed = true
  const replaced = { ...current, target: { ...current.target, caseIncarnation: "new-inc" }, refDigest: "" }
  result = { ...result, currentRef: { ...replaced, refDigest: digestSfEvidenceRef(replaced) } }
  expect((await context.resolve(original, admitted.value)).state).toBe("unavailable")
  authority.finish(admitted.value)
  expect((await context.resolve(original, admitted.value)).state).toBe("unavailable")
})


test("recall rejects forged source versions after current authorization", async () => {
  const authority = createSfUiAuthority({
    authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "actor", policyVersion: "v1", accessRevision: "a1" }),
    commandIdentity: async () => "command", createId: () => "request", now: () => 0,
  })
  const admitted = await authority.admit(new Request("http://localhost"), "sf_decision_recall", "b".repeat(64))
  if (admitted.status !== "ok") throw new Error("UI admission failed")
  const value: Extract<BusinessEvidenceRef, { kind: "case-event" }> = {
    schema: "sf-evidence-v1", kind: "case-event", refId: "r", installationId: "i", projectId: "p", refDigest: "", evidenceLevel: "decision",
    target: { caseId: "case", caseIncarnation: "inc", caseVersion: 1, eventId: "event", outputDigest: "d", evidenceRefs: [] },
  }
  const ref = { ...value, refDigest: digestSfEvidenceRef(value) }
  const maps = sfEvidenceSourceMaps([ref])
  const entry = { taskId: "work", attempted: [], failedWith: [], stoppedAt: "draft", lesson: "reason", ref: "sf-evidence:v1:r:d" }
  const envelope = { schemaVersion: 1 as const, eventId: "event", owner: "owner", kind: "task" as const, caseRef: { id: "case", incarnation: "inc", version: 1 }, sourceEventId: "event", evidenceRefs: [ref], dependencies: [], ...maps, projectionDigest: "digest", writerPrincipalRef: "actor", accessRevision: "a1", scannerReceipt: { name: "gitleaks", version: "v1", status: "clean" as const, digest: "digest" }, createdAt: "2026-01-01" }
  const records = [{ envelope, entry }]
  const context = createSfBusinessContext({
    revalidate: (call) => call.kind === "ui" ? authority.revalidate(call) : Promise.resolve(false),
    resolveSource: async (reference) => ({ state: "fresh", ref: reference, accessRevision: "a1", checkedAt: "2026-01-01" }),
    proveContinuity: async () => false,
    recall: async () => records,
    emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "event", scanner: { name: "", version: "", status: "unavailable" } }),
  })
  const request = { caseRefs: [{ id: "case", incarnation: "inc" }], query: "work" }
  expect(await context.recall(request, admitted.value)).toHaveLength(1)
  envelope.sourceVersions[ref.refDigest] = 2
  expect(await context.recall(request, admitted.value)).toEqual([])
})
