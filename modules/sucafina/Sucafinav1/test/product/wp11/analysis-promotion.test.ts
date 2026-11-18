import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfContribution } from "../../../product/contracts/canonical.ts"
import { createAnalysisAlternativePromotion } from "../../../product/decisions/analysis-promotion.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { ContributionEnvelope } from "../../../product/contracts/resident-ai.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { SfNativeRunRecord } from "../../../product/contracts/state.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

test("promotion commits the reviewed alternative, result and audit event together, and reconciles retries", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-analysis-promotion-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
    const source = new Request("https://example.test")
    const state = createSfProductState({ persistence: store, createId: () => "state", resolveTarget: async () => ({ incarnation: "inc" }), authorize: async () => ({ principalRef: "principal", policyVersion: "policy", accessRevision: "access" }) })
    const caseRef = { id: "case", incarnation: "inc", version: 1 }
    const horizon = { start: "2027-01-01", end: "2027-12-31" }
    // This contract fixture supplies the observed Planner source boundary; native capture is tested separately.
    const plannerRef = { schema: "sf-evidence-v1", kind: "record", refId: "planner", installationId: "install", projectId: "project", refDigest: "f".repeat(64), evidenceLevel: "observed", target: { surface: "planner", recordType: "planner-version", recordId: "base", incarnation: "base-inc", version: 1, fields: ["amount"], period: horizon, projectionDigest: "a".repeat(64) } } as const
    const basis = { id: "basis", version: 1, decisionType: "unknown", categoryIds: [], additionalCategoryIds: [], sourceRefs: [] } as const
    const assessment = { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon, issues: ["inventory-unavailable"], evaluatedSourceRefs: [plannerRef], entries: [], derivedMissingCategoryIds: [], coverageState: "pending" } as const
    const result = { id: "scenario", version: 1, components: [], currency: "USD", horizon, sourceRefs: [plannerRef], unresolvedConditions: ["inventory-unavailable"], restrictions: [], costCoverage: assessment, comparisonStatus: "conditioned", knownSubtotal: null, total: null } as const
    const alternative = { id: "alternative", version: 1, title: "Alternative", scenario: { baseRef: "base", operations: [], assumptions: [] }, result }
    const payload = { caseRef: "case:case:inc", proposal: alternative, costCoverageBasis: basis, coverageRef: "coverage", domainApplied: false } as const
    const receipt = { runId: "run", nativeSessionId: "session", profileId: "sf_finance", profileVersion: "1", profileDigest: "a".repeat(64), skillId: "skill", skillVersion: "1", sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64), loadedMessageId: "message", loadedAt: "2026-11-13T00:00:00Z", manifestDigest: "d".repeat(64) } as const
    const initial = { id: "output", caseRef, kind: "AlternativeDraft", schemaVersion: "sf-contribution-v1", state: "ready", payload, evidenceRefs: [], runProvenance: { ...receipt, actualModel: "model", contextFingerprint: "context" }, accessRevision: "access", createdAt: "2026-11-13T00:00:00Z", outputDigest: "" } as const
    const output = { ...initial, outputDigest: digestSfContribution(initial as unknown as ContributionEnvelope) } as unknown as ContributionEnvelope
    const run = { runRef: "run", state: "ready", outputRef: "output", principalRef: "principal", accessRevision: "access", policyVersion: "policy", caseRef, native: { sessionID: "session", skillReceipt: receipt } } as unknown as SfNativeRunRecord
    const decision: DecisionCase = { ...caseRef, state: "draft", objective: "Decision", horizon, currency: "USD", criteria: [], participants: ["principal"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    await state.transaction(source, { namespace: "cases", expectedStorageVersion: 0, additionalNamespaces: [{ namespace: "contributions", expectedStorageVersion: 0 }], targetRef: "case", targetIncarnation: "inc", idempotencyKey: "seed", commandDigest: "e".repeat(64) }, async (staged) => { staged.cases.case = decision; staged.contributions.output = output; staged.nativeRuns = { run }; return { commit: true, value: true } })
    const grant = { proof: false, snapshot: true }
    const promote = createAnalysisAlternativePromotion({ state, host: { requestFor: () => new Request("https://example.test"), revalidate: async () => true }, sources: { resolveForecastCoverage: async () => ({ status: "ok", value: { coverageRef: "coverage", basis, assessment } }) }, authorizeCase: async () => true, authorizePromotion: async () => true, readContribution: async () => ({ status: "ok", value: { output, run } }), verifyProposal: async () => grant.proof, verifySnapshot: () => grant.snapshot, operationIdentity: () => "human-intent", createId: () => "event", now: () => "2026-11-13T00:00:00Z" })
    const request = { caseRef, outputRef: "output", runRef: "run", outputDigest: output.outputDigest, rationale: "Reviewed alternative" }
    expect((await promote(request, context)).status).toBe("denied")
    grant.proof = true
    grant.snapshot = false
    expect((await promote(request, context)).status).toBe("conflict")
    const before = await state.read(source, "cases", (staged) => staged.cases.case)
    if (before.status !== "ok") throw new Error("case unavailable")
    expect(before.value).toMatchObject({ version: 1, alternatives: [], ledger: [] })
    grant.snapshot = true
    const promoted = await promote(request, context)
    expect(promoted).toMatchObject({ status: "ok", value: { caseRef: { ...caseRef, version: 2 } } })
    if (promoted.status !== "ok") throw new Error(promoted.reason)
    grant.proof = false
    expect(await promote(request, context)).toEqual(promoted)
    expect((await promote({ ...request, rationale: "Different" }, context)).status).toBe("conflict")
    const after = await state.read(source, "cases", (staged) => ({ decision: staged.cases.case, result: staged.decisionResults?.[promoted.value.resultRef] }))
    if (after.status !== "ok") throw new Error("case unavailable")
    expect(after.value).toMatchObject({ decision: { version: 2, alternatives: [alternative], ledger: [{ kind: "analysis-accepted", analysisRunId: "run", outputDigest: output.outputDigest }] }, result: { kind: "scenario", result } })
    const outbox = await state.read(source, "outbox", (staged) => Object.values(staged.outbox))
    if (outbox.status !== "ok") throw new Error("outbox unavailable")
    expect(outbox.value).toMatchObject([{ state: "pending", eventRef: { kind: "case-event", target: { eventId: "event", outputDigest: output.outputDigest } } }])
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
