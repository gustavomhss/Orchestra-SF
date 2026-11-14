import { describe, expect, test } from "bun:test"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { AuthorizedCaseProjection, AuthorizedPolicyProjection, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { deriveSfMemoryOwner, mapSfAtlasEntry } from "../../../product/decision-memory/atlas-projection.ts"

const context = { installationId: "install", projectId: "project", principalRef: "principal", accessRevision: "a1", policyVersion: "p1", kind: "native", profileId: "sf_finance" } as const
const evidenceBase = { schema: "sf-evidence-v1", refId: "evidence", installationId: "install", projectId: "project", refDigest: "a".repeat(64), evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "quote", recordId: "q", incarnation: "one", version: 1, fields: ["price"], projectionDigest: "b".repeat(64) } } as const
const evidence = { ...evidenceBase, refDigest: digestSfEvidenceRef(evidenceBase) }
const event = { id: "event", caseRef: { id: "case", incarnation: "one", version: 1 }, kind: "choice-recorded", principalRef: "principal", at: "2026-01-01T00:00:00Z", consideredActions: ["renew", "replace"], factualGaps: ["delivery pending"], lifecycleState: "chosen", rationale: "Compare the options", evidenceRefs: [evidence], outputDigest: "c".repeat(64) } as const
const bundleBase = { schema: "sf-evidence-v1", refId: "bundle", installationId: "install", projectId: "project", refDigest: "d".repeat(64), evidenceLevel: "decision", kind: "case-event", target: { caseId: "case", caseIncarnation: "one", caseVersion: 1, eventId: "event", outputDigest: event.outputDigest, evidenceRefs: [evidence] } } as const satisfies BusinessEvidenceRef
const bundle = { ...bundleBase, refDigest: digestSfEvidenceRef(bundleBase) }
const projection = { context, case: { id: "case", incarnation: "one", version: 1, state: "chosen", objective: "Compare alternatives", horizon: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD", criteria: [{ id: "cost", description: "Cost", required: true }], participants: ["principal"], sourceRefs: [evidence], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [event] }, events: [event], evidenceRefs: [evidence], checkedAt: "2026-01-01T00:00:00Z" } as const satisfies AuthorizedCaseProjection
const policyBase = { schema: "sf-evidence-v1", refId: "policy", installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "decision", kind: "policy", target: { packageId: "rules", version: "p1", sourceDigest: "f".repeat(64), ruleId: "r1", reviewRef: "review", scope: "finance" } } as const
const policy = { context, policyRef: { ...policyBase, refDigest: digestSfEvidenceRef(policyBase) }, rule: "Review evidence", scope: "finance", reviewedAt: "2026-01-01T00:00:00Z", reviewedBy: "principal", sourceDigest: "f".repeat(64), ruleDigest: digestSfValue("Review evidence"), sourceEventId: "policy-event", validCitationCount: 2, dependencies: [evidence] } as const satisfies AuthorizedPolicyProjection

describe("Atlas translation", () => {
  test("maps a ledger event deterministically and preserves its dependencies", () => {
    const input = { kind: "task" as const, projection, eventId: "event", bundleRef: bundle }
    const result = mapSfAtlasEntry(input)
    expect(result.status).toBe("mapped")
    if (result.status !== "mapped") return
    expect(result.projection.evidenceRefs).toEqual([bundle, evidence])
    expect(mapSfAtlasEntry(input)).toEqual(result)
    expect(deriveSfMemoryOwner(context, { id: "case", incarnation: "one" })).not.toBe(deriveSfMemoryOwner(context, { id: "case", incarnation: "two" }))
    expect(mapSfAtlasEntry({ ...input, projection: { ...projection, case: { ...projection.case, ledger: [] } } }).status).toBe("refused")
    expect(mapSfAtlasEntry({ ...input, projection: { ...projection, evidenceRefs: [] } }).status).toBe("refused")
    expect(mapSfAtlasEntry({ ...input, bundleRef: { ...bundle, refDigest: "0".repeat(64) } }).status).toBe("refused")
  })
  test("requires a reviewed policy bound to a native profile and its rule digest", () => {
    expect(mapSfAtlasEntry({ kind: "project", projection: policy }).status).toBe("mapped")
    expect(mapSfAtlasEntry({ kind: "project", projection: { ...policy, rule: "Different rule" } }).status).toBe("refused")
    expect(mapSfAtlasEntry({ kind: "project", projection: { ...policy, context: { installationId: "install", projectId: "project", principalRef: "principal", accessRevision: "a1", policyVersion: "p1", kind: "ui" } } }).status).toBe("refused")
  })
  test("rejects a nested foreign source even when every digest is valid", () => {
    const foreignBase = { ...evidence, projectId: "another-project" }
    const foreign = { ...foreignBase, refDigest: digestSfEvidenceRef(foreignBase) }
    const calculationBase = { schema: "sf-evidence-v1", refId: "calculation", installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", kind: "calculation", target: { calculationId: "calculation", runId: "run", engineVersion: "1", inputDigest: "a".repeat(64), resultDigest: "b".repeat(64), sourceRefs: [foreign], period: projection.case.horizon, currency: "USD" } } as const satisfies BusinessEvidenceRef
    const calculation = { ...calculationBase, refDigest: digestSfEvidenceRef(calculationBase) }
    const nestedEvent = { ...event, evidenceRefs: [calculation] }
    const nestedBase = { ...bundle, target: { ...bundle.target, evidenceRefs: [calculation] } }
    const nestedBundle = { ...nestedBase, refDigest: digestSfEvidenceRef(nestedBase) }
    const nestedProjection = { ...projection, evidenceRefs: [calculation], events: [nestedEvent], case: { ...projection.case, ledger: [nestedEvent] } }
    expect(mapSfAtlasEntry({ kind: "task", projection: nestedProjection, eventId: event.id, bundleRef: nestedBundle })).toEqual({ status: "refused", reason: "invalid-evidence-scope" })
    expect(mapSfAtlasEntry({ kind: "project", projection: { ...policy, dependencies: [calculation] } })).toEqual({ status: "refused", reason: "invalid-evidence-scope" })
  })
  test("requires current case access and a real ledger event identity", () => {
    const input = { kind: "task" as const, projection, eventId: event.id, bundleRef: bundle }
    expect(mapSfAtlasEntry({ ...input, projection: { ...projection, context: { ...context, principalRef: "outsider" } } }).status).toBe("refused")
    const invalidEvent = { ...event, at: "not-a-date" }
    expect(mapSfAtlasEntry({ ...input, projection: { ...projection, events: [invalidEvent], case: { ...projection.case, ledger: [invalidEvent] } } }).status).toBe("refused")
    expect(mapSfAtlasEntry({ ...input, projection: { ...projection, context: { ...context, accessRevision: "" } } }).status).toBe("refused")
  })
})
