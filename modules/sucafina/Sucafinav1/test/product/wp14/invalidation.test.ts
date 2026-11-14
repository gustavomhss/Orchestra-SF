import { expect, test } from "bun:test"
import { digestSfEvidenceRef, sfEvidenceSourceMaps } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import { createSfInvalidationEnvelope, decideSfRecallInvalidation, planSfMemoryInvalidation } from "../../../product/decision-memory/invalidation.ts"
import { planSfRecallInvalidation, sfRecallCacheKey } from "../../../product/decision-memory/recall.ts"
import type { RecallScope } from "../../../product/decision-memory/recall.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const source = { schema: "sf-evidence-v1", refId: "quote", refDigest: "", installationId: "install", projectId: "project", kind: "record", evidenceLevel: "observed", target: { surface: "planner", recordType: "quote", recordId: "q", incarnation: "one", version: 1, fields: ["price"], period, projectionDigest: "b".repeat(64) } } as const
const reference = { ...source, refDigest: digestSfEvidenceRef(source) }
const authorizedProjection: DomainProjection = { context: { installationId: "install", projectId: "project", principalRef: "alice", accessRevision: "a1", policyVersion: "p1", surface: "planner", period, currency: "USD", sourceRefs: [], capabilities: ["read"] }, version: 1, engineVersion: "producer-v1", components: [], values: [], missing: [] }

function scope(ref: BusinessEvidenceRef): RecallScope {
  return { installationId: "install", projectId: "project", principalRef: "alice", accessRevision: "a1", policyVersion: "p1", boundaryVersion: "b1", schemaVersion: "s1", manifestVersion: "m1", skillVersion: "k1", ...sfEvidenceSourceMaps([ref]) }
}

function resolution(ref: BusinessEvidenceRef, currentRef: BusinessEvidenceRef, state: "fresh" | "historical" = "fresh"): BusinessEvidenceResolution {
  return { ref, currentRef, state, authorizedProjection, differences: state === "historical" ? [{ field: "price", before: 100, after: 120 }] : undefined, accessRevision: "a1", checkedAt: "2026-11-14T12:00:00Z" }
}

test("invalidation refuses a different source despite matching kind, version and incarnation", () => {
  const input = { previous: scope(reference), current: scope(reference), dependencies: [reference], resolutions: [resolution(reference, reference)] }
  expect(decideSfRecallInvalidation(input)).toMatchObject({ status: "reuse" })
  for (const replacement of [
    { ...reference, projectId: "other-project" },
    { ...reference, installationId: "other-installation" },
    { ...reference, target: { ...reference.target, recordId: "another-quote" } },
    { ...reference, target: { ...reference.target, fields: ["private-notes"] } },
    { ...reference, target: { ...reference.target, period: { start: "2028-01-01", end: "2028-12-31" } } },
  ]) {
    const currentRef = { ...replacement, refDigest: digestSfEvidenceRef(replacement) }
    expect(decideSfRecallInvalidation({ ...input, resolutions: [resolution(reference, currentRef, "historical")] })).toEqual({ status: "unavailable", reauthorize: true })
  }
})

test("fresh resolutions cannot smuggle a changed projection behind the same source version", () => {
  const changed = { ...reference, target: { ...reference.target, projectionDigest: "c".repeat(64) } }
  const currentRef = { ...changed, refDigest: digestSfEvidenceRef(changed) }
  expect(decideSfRecallInvalidation({ previous: scope(reference), current: scope(reference), dependencies: [reference], resolutions: [resolution(reference, currentRef)] })).toEqual({ status: "unavailable", reauthorize: true })
})

test("historical authorization invalidates changed material even when source version and incarnation are unchanged", () => {
  const changed = { ...reference, target: { ...reference.target, projectionDigest: "c".repeat(64) } }
  const currentRef = { ...changed, refDigest: digestSfEvidenceRef(changed) }
  expect(decideSfRecallInvalidation({ previous: scope(reference), current: scope(reference), dependencies: [reference], resolutions: [resolution(reference, currentRef, "historical")] }))
    .toEqual({ status: "invalidate", reasons: ["source-digest"], reauthorize: true })
})

test("document N/N coordinates cannot reuse changed bytes, segments or confirmation material", () => {
  const document = { schema: "sf-evidence-v1", refId: "document", refDigest: "", installationId: "install", projectId: "project", kind: "document", evidenceLevel: "observed", target: { documentId: "contract", incarnation: "document-inc", revision: 7, blobDigest: { algorithm: "sha256", value: "a".repeat(64) }, segment: { start: 0, end: 10, unit: "utf16", textDigest: { algorithm: "sha256", value: "b".repeat(64) } }, ragSourceId: "rag-source", ragRevisionId: "rag-revision-1", ragSourceHash: { algorithm: "blake3", value: "c".repeat(64) }, fieldCandidateId: "amount", confirmationVersion: 2 } } as const
  const original = { ...document, refDigest: digestSfEvidenceRef(document) }
  const fixedScope = scope(original)
  const input = { previous: fixedScope, current: fixedScope, dependencies: [original] }
  for (const state of ["fresh", "historical"] as const) {
    expect(decideSfRecallInvalidation({ ...input, resolutions: [resolution(original, original, state)] }))
      .toEqual({ status: "reuse", reasons: [], reauthorize: true })
  }
  for (const target of [
    { ...document.target, blobDigest: { algorithm: "sha256", value: "d".repeat(64) } },
    { ...document.target, segment: { ...document.target.segment, start: 1, end: 11 } },
    { ...document.target, segment: { ...document.target.segment, textDigest: { algorithm: "sha256", value: "e".repeat(64) } } },
    { ...document.target, confirmationVersion: 3 },
    { ...document.target, ragRevisionId: "rag-revision-2" },
    { ...document.target, ragSourceHash: { algorithm: "blake3", value: "f".repeat(64) } },
  ] satisfies readonly Extract<BusinessEvidenceRef, { kind: "document" }>["target"][]) {
    const changed = { ...document, target }
    const currentRef = { ...changed, refDigest: digestSfEvidenceRef(changed) }
    const currentMaps = sfEvidenceSourceMaps([currentRef])
    expect(currentMaps.sourceVersions[currentRef.refDigest]).toBe(fixedScope.sourceVersions[original.refDigest])
    expect(currentMaps.sourceIncarnations[currentRef.refDigest]).toBe(fixedScope.sourceIncarnations[original.refDigest])
    expect(decideSfRecallInvalidation({ ...input, resolutions: [resolution(original, currentRef, "historical")] }))
      .toEqual({ status: "invalidate", reasons: ["source-digest"], reauthorize: true })
    expect(decideSfRecallInvalidation({ ...input, resolutions: [resolution(original, currentRef)] }))
      .toEqual({ status: "unavailable", reauthorize: true })
  }
})

test("case-event N/N coordinates cannot reuse a changed output or transitive evidence bundle", () => {
  const event = { schema: "sf-evidence-v1", refId: "case-event", refDigest: "", installationId: "install", projectId: "project", kind: "case-event", evidenceLevel: "decision", target: { caseId: "case", caseIncarnation: "case-inc", caseVersion: 7, eventId: "event", outputDigest: "a".repeat(64), evidenceRefs: [reference] } } as const
  const original = { ...event, refDigest: digestSfEvidenceRef(event) }
  const fixedScope = scope(original)
  const input = { previous: fixedScope, current: fixedScope, dependencies: [original] }
  expect(decideSfRecallInvalidation({ ...input, resolutions: [resolution(original, original), resolution(reference, reference)] }))
    .toEqual({ status: "reuse", reasons: [], reauthorize: true })
  const reissued = { ...reference, refId: "reissued-quote" }
  const currentEvidence = { ...reissued, refDigest: digestSfEvidenceRef(reissued) }
  for (const target of [
    { ...event.target, outputDigest: "d".repeat(64) },
    { ...event.target, evidenceRefs: [currentEvidence] },
    { ...event.target, evidenceRefs: [] },
  ] satisfies readonly Extract<BusinessEvidenceRef, { kind: "case-event" }>["target"][]) {
    const changed = { ...event, target }
    const currentRef = { ...changed, refDigest: digestSfEvidenceRef(changed) }
    const currentMaps = sfEvidenceSourceMaps([currentRef])
    expect(currentMaps.sourceVersions[currentRef.refDigest]).toBe(fixedScope.sourceVersions[original.refDigest])
    expect(currentMaps.sourceIncarnations[currentRef.refDigest]).toBe(fixedScope.sourceIncarnations[original.refDigest])
    expect(decideSfRecallInvalidation({ ...input, resolutions: [resolution(original, currentRef, "historical"), resolution(reference, reference)] }))
      .toEqual({ status: "invalidate", reasons: ["source-digest"], reauthorize: true })
  }
})

test("a receipt with unchanged numeric coordinates cannot reuse a different evidence level", () => {
  const receipt = { schema: "sf-evidence-v1", refId: "receipt", refDigest: "", installationId: "install", projectId: "project", kind: "receipt", evidenceLevel: "observed", target: { surface: "planner", receiptId: "receipt-1", idempotencyKey: "operation-1", targetIncarnation: "target-inc", commandDigest: "a".repeat(64), version: 7 } } as const
  const original = { ...receipt, refDigest: digestSfEvidenceRef(receipt) }
  const changed = { ...receipt, evidenceLevel: "claim" as const }
  const currentRef = { ...changed, refDigest: digestSfEvidenceRef(changed) }
  const input = { previous: scope(original), current: scope(original), dependencies: [original] }
  expect(decideSfRecallInvalidation({ ...input, resolutions: [resolution(original, original)] })).toMatchObject({ status: "reuse" })
  expect(decideSfRecallInvalidation({ ...input, resolutions: [resolution(original, currentRef, "historical")] }))
    .toEqual({ status: "invalidate", reasons: ["source-digest"], reauthorize: true })
})

test("an authorized fresh reissue for another principal invalidates the prior scope without rejecting unchanged content", () => {
  // This is the source-access contract for a Dashboard page reissued under Bob's
  // current scope after physical-source continuity has been established by the host.
  const page = { ...reference, refId: "alice-budget", target: { ...reference.target, surface: "dashboard" as const, recordType: "dashboard-page", recordId: "Budget", incarnation: "alice-scope", version: 7 } }
  const original = { ...page, refDigest: digestSfEvidenceRef(page) }
  const reissued = { ...original, refId: "bob-budget", target: { ...original.target, incarnation: "bob-scope", version: 1 } }
  const currentRef = { ...reissued, refDigest: digestSfEvidenceRef(reissued) }
  const previous = scope(original)
  const current = { ...previous, principalRef: "bob", accessRevision: "b1", sourceVersions: { [original.refDigest]: currentRef.target.version }, sourceIncarnations: { [original.refDigest]: currentRef.target.incarnation } }
  const projected = { ...authorizedProjection, context: { ...authorizedProjection.context, principalRef: "bob", accessRevision: "b1", surface: "dashboard" as const } }
  const resolved = { ...resolution(original, currentRef), accessRevision: "b1", authorizedProjection: projected }
  const input = { previous, current, dependencies: [original], resolutions: [resolved] }
  const decision = decideSfRecallInvalidation(input)
  expect(decision.status).toBe("invalidate")
  if (decision.status === "invalidate") {
    expect(decision.reasons).toContain("authority-scope")
    expect(decision.reasons).toContain("source-incarnation")
  }
  expect(decideSfRecallInvalidation({ ...input, current: { ...current, sourceIncarnations: previous.sourceIncarnations } })).toEqual({ status: "unavailable", reauthorize: true })
  const changed = { ...currentRef, target: { ...currentRef.target, projectionDigest: "c".repeat(64) } }
  expect(decideSfRecallInvalidation({ ...input, resolutions: [{ ...resolved, currentRef: { ...changed, refDigest: digestSfEvidenceRef(changed) } }] })).toEqual({ status: "unavailable", reauthorize: true })
})

test("changed immutable calculation and policy identities invalidate their dependent envelope", () => {
  const calculation = { schema: "sf-evidence-v1", refId: "calculation", refDigest: "", installationId: "install", projectId: "project", kind: "calculation", evidenceLevel: "observed", target: { calculationId: "scenario", runId: "run-1", engineVersion: "producer-v1", inputDigest: "d".repeat(64), resultDigest: "e".repeat(64), sourceRefs: [reference], period, currency: "USD" } } as const
  const policy = { schema: "sf-evidence-v1", refId: "policy", refDigest: "", installationId: "install", projectId: "project", kind: "policy", evidenceLevel: "decision", target: { packageId: "finance", version: "1", sourceDigest: "a".repeat(64), ruleId: "review", reviewRef: "review-1", scope: "project" } } as const
  for (const [before, after] of [
    [calculation, { ...calculation, target: { ...calculation.target, runId: "run-2", resultDigest: "f".repeat(64) } }],
    [policy, { ...policy, target: { ...policy.target, version: "2", sourceDigest: "b".repeat(64), reviewRef: "review-2" } }],
  ] satisfies readonly (readonly [BusinessEvidenceRef, BusinessEvidenceRef])[]) {
    const original = { ...before, refDigest: digestSfEvidenceRef(before) }
    const current = { ...after, refDigest: digestSfEvidenceRef(after) }
    const unchanged = { previous: scope(original), current: scope(original), dependencies: [original], resolutions: [resolution(original, original), resolution(reference, reference)] }
    expect(decideSfRecallInvalidation(unchanged)).toMatchObject({ status: "reuse" })
    expect(decideSfRecallInvalidation({ ...unchanged, resolutions: [resolution(original, current, "historical"), resolution(reference, reference)] })).toMatchObject({ status: "invalidate", reasons: ["immutable-source"], reauthorize: true })
  }
})

test("cache scope dimensions invalidate the pure envelope without granting reusable authority", () => {
  const previous = scope(reference)
  const changes: readonly { label: string; current: RecallScope; reason: string }[] = [
    { label: "installation", current: { ...previous, installationId: "another-installation" }, reason: "authority-scope" },
    { label: "project", current: { ...previous, projectId: "another-project" }, reason: "authority-scope" },
    { label: "principal", current: { ...previous, principalRef: "bob" }, reason: "authority-scope" },
    { label: "ACL revision", current: { ...previous, accessRevision: "a2" }, reason: "access-revision" },
    { label: "policy", current: { ...previous, policyVersion: "p2" }, reason: "policy-version" },
    { label: "boundary", current: { ...previous, boundaryVersion: "b2" }, reason: "runtime-version" },
    { label: "schema", current: { ...previous, schemaVersion: "s2" }, reason: "runtime-version" },
    { label: "manifest", current: { ...previous, manifestVersion: "m2" }, reason: "runtime-version" },
    { label: "skill", current: { ...previous, skillVersion: "k2" }, reason: "runtime-version" },
    { label: "source version", current: { ...previous, sourceVersions: { ...previous.sourceVersions, [reference.refDigest]: 2 } }, reason: "source-version" },
    { label: "source incarnation", current: { ...previous, sourceIncarnations: { ...previous.sourceIncarnations, [reference.refDigest]: "replacement" } }, reason: "source-incarnation" },
  ]
  const originalKey = sfRecallCacheKey(previous)
  for (const { current, reason } of changes) {
    expect(sfRecallCacheKey(current)).not.toBe(originalKey)
    expect(planSfRecallInvalidation(previous, current)).toEqual({ invalidate: true, reasons: [reason], reauthorize: true })
    expect(planSfMemoryInvalidation(previous, current, [reference])).toEqual({ action: "invalidate", reasons: [reason], dependencyDigests: [reference.refDigest], reauthorize: true })
    const envelope = createSfInvalidationEnvelope(previous, current, [reference])
    expect(envelope).toMatchObject({ schema: "sf-memory-invalidation-v1", action: "invalidate", reasons: [reason], dependencyDigests: [reference.refDigest], reauthorize: true })
    expect(envelope.scopeDigest).not.toBe(originalKey)
  }
  expect(createSfInvalidationEnvelope(previous, previous, [reference])).toMatchObject({ action: "reuse", reasons: [], reauthorize: true })
})

test("a substitutive import invalidates its source while an unrelated replacement preserves the envelope", () => {
  const previous = scope(reference)
  const replacementBase = { ...reference, refId: "quote-after-import", target: { ...reference.target, incarnation: "replacement" } }
  const replacement = { ...replacementBase, refDigest: digestSfEvidenceRef(replacementBase) }
  const current = { ...previous, sourceIncarnations: { ...previous.sourceIncarnations, [reference.refDigest]: replacement.target.incarnation } }
  const imported = { ...resolution(reference, replacement, "historical"), differences: [{ field: "source-incarnation", before: reference.target.incarnation, after: replacement.target.incarnation }] }
  expect(decideSfRecallInvalidation({ previous, current, dependencies: [reference], resolutions: [imported] })).toEqual({ status: "invalidate", reasons: ["source-incarnation"], reauthorize: true })
  expect(decideSfRecallInvalidation({ previous, current, dependencies: [reference], resolutions: [resolution(reference, reference)] })).toEqual({ status: "unavailable", reauthorize: true })

  const unrelatedBase = { ...reference, refId: "another-quote", target: { ...reference.target, recordId: "another-quote" } }
  const unrelated = { ...unrelatedBase, refDigest: digestSfEvidenceRef(unrelatedBase) }
  const sharedPrevious = { ...previous, ...sfEvidenceSourceMaps([reference, unrelated]) }
  const sharedCurrent = { ...sharedPrevious,
    sourceVersions: { ...sharedPrevious.sourceVersions, [unrelated.refDigest]: 2 },
    sourceIncarnations: { ...sharedPrevious.sourceIncarnations, [unrelated.refDigest]: "unrelated-replacement" } }
  expect(planSfMemoryInvalidation(sharedPrevious, sharedCurrent, [reference])).toEqual({ action: "reuse", reasons: [], dependencyDigests: [reference.refDigest], reauthorize: true })
  expect(createSfInvalidationEnvelope(sharedPrevious, sharedCurrent, [reference])).toMatchObject({ action: "reuse", reasons: [], reauthorize: true })
  expect(decideSfRecallInvalidation({ previous: sharedPrevious, current: sharedCurrent, dependencies: [reference], resolutions: [resolution(reference, reference)] })).toEqual({ status: "reuse", reasons: [], reauthorize: true })
  expect(planSfMemoryInvalidation(sharedPrevious, sharedCurrent, [unrelated])).toMatchObject({ action: "invalidate", reasons: ["source-version", "source-incarnation"], reauthorize: true })
})
