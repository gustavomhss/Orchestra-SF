import { describe, expect, test } from "bun:test"
import { digestSfEvidenceRef, digestSfValue, sfEvidenceSourceMaps } from "../../../product/contracts/canonical.ts"
import { decideSfRecallInvalidation } from "../../../product/decision-memory/invalidation.ts"
import { deriveSfMemoryOwner } from "../../../product/decision-memory/atlas-projection.ts"
import { planSfRecallInvalidation, rankSfRecalledCases, rankSfRecalledCasesAuthorized, sfRecallCacheKey } from "../../../product/decision-memory/recall.ts"
import type { BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { TrustedDomainContext, TrustedUiLease } from "../../../product/contracts/sf-execution.ts"
import type { AuthorizedMemoryProjection, RecallFeatures, RecallScope } from "../../../product/decision-memory/recall.ts"

const features: RecallFeatures = { decisionType: "renewal", horizon: "2027", components: ["service"], restrictions: ["budget"], resultAvailable: true }
const originalRef = { schema: "sf-evidence-v1", refId: "quote", refDigest: "", installationId: "install", projectId: "project", kind: "record", evidenceLevel: "observed", target: { surface: "planner", recordType: "quote", recordId: "q", incarnation: "one", version: 1, fields: ["price"], projectionDigest: "b".repeat(64) } } as const
const ref = { ...originalRef, refDigest: digestSfEvidenceRef(originalRef) }
const owner = deriveSfMemoryOwner({ installationId: "install", projectId: "project", principalRef: "alice", accessRevision: "a1", policyVersion: "p1", kind: "ui" }, { id: "prior", incarnation: "one" })
if (!owner) throw new Error("fixture owner missing")
const bundleBase = { schema: "sf-evidence-v1", refId: "bundle", refDigest: "", installationId: "install", projectId: "project", kind: "case-event", evidenceLevel: "decision", target: { caseId: "prior", caseIncarnation: "one", caseVersion: 1, eventId: "event", outputDigest: "e".repeat(64), evidenceRefs: [ref] } } as const
const bundle = { ...bundleBase, refDigest: digestSfEvidenceRef(bundleBase) }
const maps = sfEvidenceSourceMaps([bundle, ref])
const scope: RecallScope = { installationId: "install", projectId: "project", principalRef: "alice", accessRevision: "a1", policyVersion: "p1", boundaryVersion: "b1", schemaVersion: "s1", manifestVersion: "m1", skillVersion: "k1", ...maps }
const entry = { taskId: "sf-work:prior:event", attempted: ["renewal"], failedWith: [], stoppedAt: "chosen", lesson: "Compare", ref: `sf-evidence:v1:${bundle.refId}:${bundle.refDigest}` }
const projection = { kind: "task", owner, entry, sourceEventId: "event", evidenceRefs: [bundle, ref] }
const authorizedProjection: DomainProjection = { context: { installationId: "install", projectId: "project", principalRef: "alice", accessRevision: "a1", policyVersion: "p1", surface: "planner", period: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", sourceRefs: [], capabilities: ["read"] }, version: 1, engineVersion: "test-v1", components: [], values: [], missing: [] }
const candidate = { entry, envelope: { ...projection, kind: "task", projectionDigest: digestSfValue(projection), caseRef: { id: "prior", incarnation: "one", version: 1 }, accessRevision: "a1", ...maps, dependencies: [ref], schemaVersion: 1, eventId: "atlas-event", writerPrincipalRef: "alice", scannerReceipt: { name: "fixture", version: "1", status: "clean", digest: "c".repeat(64) }, createdAt: "2026-01-01T00:00:00Z" }, case: { context: { installationId: "install", projectId: "project", principalRef: "alice", accessRevision: "a1", policyVersion: "p1", kind: "ui" }, case: { id: "prior", incarnation: "one", version: 1, state: "chosen", objective: "Renew", horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", criteria: [], participants: ["alice"], sourceRefs: [ref], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }, events: [], evidenceRefs: [ref], checkedAt: "2026-01-01T00:00:00Z" }, features, resolutions: [{ ref: bundle, state: "fresh", accessRevision: "a1", checkedAt: "2026-01-01T00:00:00Z", currentRef: bundle, authorizedProjection }, { ref, state: "fresh", accessRevision: "a1", checkedAt: "2026-01-01T00:00:00Z", currentRef: ref, authorizedProjection }], atlasTrace: { module: "@orchestra/atlas-boundary/business-memory-ports", operation: "createMemoryRead.recall", recordDigest: "c".repeat(64) }, accessRevision: "a1" } as const satisfies AuthorizedMemoryProjection

describe("authorized recall", () => {
  test("explains an Atlas candidate and rejects a different decision type", () => {
    const results = rankSfRecalledCases({ scope, features, candidates: [candidate] })
    expect(results[0]?.matchedCriteria).toContain("decision-type")
    expect(results[0]?.candidateCaseRef.id).toBe("prior")
    expect(rankSfRecalledCases({ scope, features: { ...features, decisionType: "unrelated" }, candidates: [candidate] })).toEqual([])
  })
  test("allows an authorized historical source without treating a changed version as current", () => {
    const original = candidate.resolutions[1]
    const current = { ...ref, refId: "quote-v2", target: { ...ref.target, version: 2 } }
    const historical: BusinessEvidenceResolution = { ...original, state: "historical", currentRef: { ...current, refDigest: digestSfEvidenceRef(current) }, authorizedProjection, differences: [{ field: "price", before: 100, after: 120 }] }
    const result = rankSfRecalledCases({ scope: { ...scope, sourceVersions: { ...scope.sourceVersions, [ref.refDigest]: 2 } }, features, candidates: [{ ...candidate, resolutions: [candidate.resolutions[0], historical] }] })
    expect(result).toHaveLength(1)
    expect(result[0]?.sourceStates).toContain("historical")
    expect(result[0]?.currentDifferences).toContain("price: 100 → 120")
    expect(rankSfRecalledCases({ scope: { ...scope, sourceVersions: { ...scope.sourceVersions, [ref.refDigest]: 2 } }, features, candidates: [{ ...candidate, resolutions: [candidate.resolutions[0], { ...historical, authorizedProjection: undefined }] }] })).toEqual([])
  })
  test("host-only wrapper requires current continuity both before ranking and on egress", async () => {
    const call: TrustedDomainContext = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "alice", requestId: "request", accessRevision: "a1", policyVersion: "p1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} as TrustedUiLease }
    const changed = { ...ref, target: { ...ref.target, incarnation: "bob-scope" } }
    const currentRef = { ...changed, refDigest: digestSfEvidenceRef(changed) }
    const projection = authorizedProjection
    const memory: AuthorizedMemoryProjection = { ...candidate, envelope: { ...candidate.envelope, accessRevision: "previous" }, resolutions: [{ ...candidate.resolutions[0]!, currentRef: bundle, authorizedProjection: projection }, { ...candidate.resolutions[1]!, currentRef, authorizedProjection: projection }] }
    const currentScope = { ...scope, sourceIncarnations: { ...scope.sourceIncarnations, [ref.refDigest]: "bob-scope" } }
    const base = { scope: currentScope, features, candidates: [memory], call, authorizeAtlas: async () => true, proveContinuity: async () => true, revalidate: async () => true }
    expect(rankSfRecalledCases({ scope: currentScope, features, candidates: [memory] })).toEqual([])
    expect(await rankSfRecalledCasesAuthorized(base)).toMatchObject({ status: "ok", cases: [{ candidateCaseRef: { id: "prior" } }] })
    expect(await rankSfRecalledCasesAuthorized({ ...base, proveContinuity: async () => false })).toEqual({ status: "unavailable" })
    const phases = { count: 0 }
    expect(await rankSfRecalledCasesAuthorized({ ...base, authorizeAtlas: async () => ++phases.count === 1 })).toEqual({ status: "unavailable" })
  })
  test("suppresses the entire candidate after revocation or a principal/source change", () => {
    const revoked = { ...candidate, resolutions: [{ ...candidate.resolutions[0], state: "revoked" as const }] }
    expect(rankSfRecalledCases({ scope, features, candidates: [revoked] })).toEqual([])
    expect(rankSfRecalledCases({ scope, features, candidates: [{ ...candidate, envelope: { ...candidate.envelope, projectionDigest: "0".repeat(64) } }] })).toEqual([])
    expect(rankSfRecalledCases({ scope, features, candidates: [{ ...candidate, envelope: { ...candidate.envelope, owner: "forged" } }] })).toEqual([])
    expect(rankSfRecalledCases({ scope: { ...scope, principalRef: "bob" }, features, candidates: [candidate] })).toEqual([])
    expect(rankSfRecalledCases({ scope: { ...scope, sourceIncarnations: { ...scope.sourceIncarnations, [ref.refDigest]: "two" } }, features, candidates: [candidate] })).toEqual([])
    expect(sfRecallCacheKey(scope)).not.toBe(sfRecallCacheKey({ ...scope, accessRevision: "a2" }))
    expect(planSfRecallInvalidation(scope, { ...scope, accessRevision: "a2" })).toEqual({ invalidate: true, reasons: ["access-revision"], reauthorize: true })
    expect(planSfRecallInvalidation(scope, scope)).toEqual({ invalidate: false, reasons: [], reauthorize: true })
  })
})

test("invalidation follows the envelope dependencies and fails closed on revocation", () => {
  const input = { previous: scope, current: scope, dependencies: [bundle, ref], resolutions: candidate.resolutions }
  expect(decideSfRecallInvalidation(input)).toMatchObject({ status: "reuse", reauthorize: true })
  expect(decideSfRecallInvalidation({ ...input, current: { ...scope, sourceVersions: { ...scope.sourceVersions, unrelated: 2 } } })).toMatchObject({ status: "reuse" })
  const changed = { ...ref, target: { ...ref.target, version: 2 } }
  const currentRef = { ...changed, refDigest: digestSfEvidenceRef(changed) }
  const current = { ...scope, sourceVersions: { ...scope.sourceVersions, [ref.refDigest]: 2 } }
  expect(decideSfRecallInvalidation({ ...input, current })).toEqual({ status: "unavailable", reauthorize: true })
  expect(decideSfRecallInvalidation({ ...input, current, resolutions: [candidate.resolutions[0], { ...candidate.resolutions[1], state: "historical", currentRef, differences: [{ field: "price", before: 100, after: 120 }] }] })).toMatchObject({ status: "invalidate", reasons: ["source-version"] })
  expect(decideSfRecallInvalidation({ ...input, resolutions: [candidate.resolutions[0]] })).toEqual({ status: "unavailable", reauthorize: true })
  expect(decideSfRecallInvalidation({ ...input, resolutions: [candidate.resolutions[0], { ...candidate.resolutions[1], state: "revoked" }] })).toEqual({ status: "unavailable", reauthorize: true })
})

test("recall features require an authorized case and an unambiguous decision type", async () => {
  const { deriveAuthorizedRecallFeatures } = await import("../../../product/decision-memory/case-features.ts")
  const call: TrustedDomainContext = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "alice", requestId: "request", accessRevision: "a1", policyVersion: "p1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} as TrustedUiLease }
  const basis = { id: "coverage", version: 1, decisionType: "renewal", categoryIds: [], additionalCategoryIds: [], sourceRefs: [ref] }
  const projection = { ...candidate.case, case: { ...candidate.case.case, costCoverageBases: [basis] } }
  expect(deriveAuthorizedRecallFeatures(projection, call)).toEqual({ decisionType: "renewal", horizon: "2027-01-01/2027-12-31", components: [], restrictions: [], resultAvailable: false })
  expect(deriveAuthorizedRecallFeatures({ ...projection, case: { ...projection.case, costCoverageBases: [basis, { ...basis, decisionType: "purchase" }] } }, call)).toBeUndefined()
  expect(deriveAuthorizedRecallFeatures(projection, { ...call, binding: { ...call.binding, principalRef: "bob" } })).toBeUndefined()
})
