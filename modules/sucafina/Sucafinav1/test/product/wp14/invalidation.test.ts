import { expect, test } from "bun:test"
import { digestSfEvidenceRef, sfEvidenceSourceMaps } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import { decideSfRecallInvalidation } from "../../../product/decision-memory/invalidation.ts"
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

test("historical content changes invalidate even when numeric version and incarnation are unchanged", () => {
  const document = { ...source, kind: "document", target: { documentId: "document", incarnation: "one", revision: 1, blobDigest: { algorithm: "sha256", value: "d".repeat(64) }, segment: { start: 0, end: 10, unit: "utf16", textDigest: { algorithm: "sha256", value: "e".repeat(64) } } } } as const
  const event = { ...source, kind: "case-event", target: { caseId: "case", caseIncarnation: "one", caseVersion: 1, eventId: "choice", outputDigest: "f".repeat(64), evidenceRefs: [reference] } } as const
  for (const [before, after] of [
    [reference, { ...reference, target: { ...reference.target, projectionDigest: "c".repeat(64) } }],
    [document, { ...document, target: { ...document.target, blobDigest: { algorithm: "sha256", value: "c".repeat(64) } } }],
    [document, { ...document, target: { ...document.target, segment: { ...document.target.segment, textDigest: { algorithm: "sha256", value: "c".repeat(64) } } } }],
    [event, { ...event, target: { ...event.target, outputDigest: "c".repeat(64) } }],
  ] satisfies readonly (readonly [BusinessEvidenceRef, BusinessEvidenceRef])[]) {
    const original = { ...before, refDigest: digestSfEvidenceRef(before) }
    const current = { ...after, refDigest: digestSfEvidenceRef(after) }
    const nested = original.kind === "case-event" ? [resolution(reference, reference)] : []
    const input = { previous: scope(original), current: scope(original), dependencies: [original] }
    expect(decideSfRecallInvalidation({ ...input, resolutions: [resolution(original, original), ...nested] })).toMatchObject({ status: "reuse" })
    expect(decideSfRecallInvalidation({ ...input, resolutions: [resolution(original, current, "historical"), ...nested] })).toMatchObject({ status: "invalidate", reasons: ["source-content"], reauthorize: true })
  }
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
