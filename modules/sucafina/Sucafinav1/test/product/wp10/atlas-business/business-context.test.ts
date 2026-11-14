import { expect, test } from "bun:test"
import { createSfUiAuthority } from "../../../../product/integration/ui-authority.ts"
import { digestSfEvidenceRef, sfEvidenceSourceMaps } from "../../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../../product/contracts/business-context.ts"
import { createSfBusinessContext } from "../../../../product/host-binding/business-context.ts"

test("over-budget evidence ancestry is refused before source IO", async () => {
  const authority = createSfUiAuthority({ authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "actor", policyVersion: "v1", accessRevision: "a1" }), commandIdentity: async () => "command", createId: () => "request", now: () => 0 })
  const admitted = await authority.admit(new Request("http://localhost"), "sf_evidence_get", "a".repeat(64))
  if (admitted.status !== "ok") throw new Error("UI admission failed")
  let sourceReads = 0
  const context = createSfBusinessContext({
    revalidate: (call) => call.kind === "ui" ? authority.revalidate(call) : Promise.resolve(false),
    resolveSource: async (ref) => { sourceReads++; return { state: "fresh", ref, accessRevision: "a1", checkedAt: "2026-01-01" } },
    proveContinuity: async () => false, recall: async () => [],
    emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "event", scanner: { name: "", version: "", status: "unavailable" } }),
  })
  let refs: BusinessEvidenceRef[] = []
  for (let index = 0; index < 7; index++) {
    const value: Extract<BusinessEvidenceRef, { kind: "case-event" }> = { schema: "sf-evidence-v1", kind: "case-event", refId: `event-${index}`, installationId: "i", projectId: "p", refDigest: "", evidenceLevel: "decision",
      target: { caseId: "case", caseIncarnation: "inc", caseVersion: 1, eventId: `event-${index}`, outputDigest: "d", evidenceRefs: refs } }
    refs = [{ ...value, refDigest: digestSfEvidenceRef(value) }]
  }
  expect((await context.resolve(refs[0]!, admitted.value)).state).toBe("unavailable")
  expect((await context.context({ refs }, admitted.value)).every((result) => result.state === "unavailable")).toBe(true)
  expect(sourceReads).toBe(0)
  authority.finish(admitted.value)
})

test("shared event dependencies resolve independently in sibling branches", async () => {
  const authority = createSfUiAuthority({ authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "actor", policyVersion: "v1", accessRevision: "a1" }), commandIdentity: async () => "command", createId: () => "request", now: () => 0 })
  const admitted = await authority.admit(new Request("http://localhost"), "sf_evidence_get", "a".repeat(64))
  if (admitted.status !== "ok") throw new Error("UI admission failed")
  const event = (id: string, evidenceRefs: BusinessEvidenceRef[]) => {
    const value: Extract<BusinessEvidenceRef, { kind: "case-event" }> = { schema: "sf-evidence-v1", kind: "case-event", refId: id, installationId: "i", projectId: "p", refDigest: "", evidenceLevel: "decision", target: { caseId: "case", caseIncarnation: "inc", caseVersion: 1, eventId: id, outputDigest: "d", evidenceRefs } }
    return { ...value, refDigest: digestSfEvidenceRef(value) }
  }
  const leaf = event("leaf", [])
  const root = event("root", [event("left", [leaf]), event("right", [leaf])])
  const context = createSfBusinessContext({
    revalidate: (call) => call.kind === "ui" ? authority.revalidate(call) : Promise.resolve(false),
    resolveSource: async (ref) => ({ state: "fresh", ref, accessRevision: "a1", checkedAt: "2026-01-01" }),
    proveContinuity: async () => false,
    recall: async () => [],
    emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "event", scanner: { name: "", version: "", status: "unavailable" } }),
  })
  expect((await context.resolve(root, admitted.value)).state).toBe("fresh")
  authority.finish(admitted.value)
})

test("duplicate evidence shares one pass without retaining authority for the next read", async () => {
  let active = true
  let reads = 0
  const authority = createSfUiAuthority({ authorize: async () => active ? { installationId: "i", projectId: "p", principalRef: "actor", policyVersion: "v1", accessRevision: "a1" } : undefined,
    commandIdentity: async () => "command", createId: () => "request", now: () => 0 })
  const admitted = await authority.admit(new Request("http://localhost"), "sf_evidence_get", "a".repeat(64))
  if (admitted.status !== "ok") throw new Error("UI admission failed")
  const value: Extract<BusinessEvidenceRef, { kind: "case-event" }> = { schema: "sf-evidence-v1", kind: "case-event", refId: "event", installationId: "i", projectId: "p", refDigest: "", evidenceLevel: "decision",
    target: { caseId: "case", caseIncarnation: "inc", caseVersion: 1, eventId: "event", outputDigest: "d", evidenceRefs: [] } }
  const ref = { ...value, refDigest: digestSfEvidenceRef(value) }
  const context = createSfBusinessContext({
    revalidate: (call) => call.kind === "ui" ? authority.revalidate(call) : Promise.resolve(false),
    resolveSource: async (reference) => { reads++; return { state: "fresh", ref: reference, accessRevision: "a1", checkedAt: "2026-01-01" } },
    proveContinuity: async () => false, recall: async () => [],
    emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "event", scanner: { name: "", version: "", status: "unavailable" } }),
  })
  const found = await context.context({ refs: [ref, structuredClone(ref)] }, admitted.value)
  expect(found.map((result) => result.state)).toEqual(["fresh", "fresh"])
  expect(found[0]).not.toBe(found[1])
  expect(reads).toBe(1)
  expect((await context.context({ refs: [ref] }, admitted.value))[0]!.state).toBe("fresh")
  expect(reads).toBe(2)
  active = false
  expect((await context.context({ refs: [ref, ref] }, admitted.value)).every((result) => result.state === "unavailable")).toBe(true)
  expect(reads).toBe(2)
  authority.finish(admitted.value)
})

test("aggregate evidence budget is checked before deduplication or source IO", async () => {
  let reads = 0
  const authority = createSfUiAuthority({ authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "actor", policyVersion: "v1", accessRevision: "a1" }),
    commandIdentity: async () => "command", createId: () => "request", now: () => 0 })
  const admitted = await authority.admit(new Request("http://localhost"), "sf_evidence_get", "a".repeat(64))
  if (admitted.status !== "ok") throw new Error("UI admission failed")
  const value: Extract<BusinessEvidenceRef, { kind: "case-event" }> = { schema: "sf-evidence-v1", kind: "case-event", refId: "event", installationId: "i", projectId: "p", refDigest: "", evidenceLevel: "decision",
    target: { caseId: "case", caseIncarnation: "inc", caseVersion: 1, eventId: "event", outputDigest: "d", evidenceRefs: [] } }
  const ref = { ...value, refDigest: digestSfEvidenceRef(value) }
  const context = createSfBusinessContext({ revalidate: (call) => call.kind === "ui" ? authority.revalidate(call) : Promise.resolve(false),
    resolveSource: async (reference) => { reads++; return { state: "fresh", ref: reference, accessRevision: "a1", checkedAt: "2026-01-01" } },
    proveContinuity: async () => false, recall: async () => [],
    emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "event", scanner: { name: "", version: "", status: "unavailable" } }) })
  const result = await context.context({ refs: Array.from({ length: 513 }, () => ref) }, admitted.value)
  expect(result).toHaveLength(513)
  expect(result.every((entry) => entry.state === "unavailable")).toBe(true)
  expect(reads).toBe(0)
  authority.finish(admitted.value)
})

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
  await expect(context.recall(request, admitted.value)).rejects.toThrow("SF_MEMORY_EVIDENCE_UNAVAILABLE")
  authority.finish(admitted.value)
  await expect(context.recall(request, admitted.value)).rejects.toThrow("SF_MEMORY_AUTHORITY_UNAVAILABLE")
})
