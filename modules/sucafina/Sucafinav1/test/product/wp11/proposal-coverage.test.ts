import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createProposalCoverageRegistry } from "../../../product/decisions/proposal-coverage.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"

test("proposal coverage is durable, scoped, and fenced against changed sources", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-proposal-coverage-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
    const state = createSfProductState({ persistence: store, createId: () => "state", resolveTarget: async () => ({ incarnation: "inc" }), authorize: async () => ({ principalRef: "principal", policyVersion: "policy", accessRevision: "access" }) })
    const source = new Request("https://example.test")
    const decision = { id: "case", incarnation: "inc", version: 1, participants: ["principal"] } as unknown as DecisionCase
    await state.transaction(source, { namespace: "cases", expectedStorageVersion: 0, targetRef: "case", targetIncarnation: "inc", idempotencyKey: "seed", commandDigest: "a".repeat(64) }, async (staged) => { staged.cases.case = decision; return { commit: true, value: true } })
    await store.transaction("planner", async (snapshot) => { snapshot.data.proof = "fresh"; return { commit: true, value: true } })
    const scope = { allowed: true }
    const registry = createProposalCoverageRegistry({ state, host: { requestFor: () => new Request("https://example.test"), revalidate: async () => true }, authorizeCase: async () => true, verifyEvidence: async () => scope.allowed, verifySnapshot: (snapshot) => snapshot.data.proof === "fresh", operationIdentity: () => "intent", proposalCoverageWrites: new WeakSet(), now: () => "2026-11-13T00:00:00Z" })
    const plannerRef = { schema: "sf-evidence-v1", kind: "record", refId: "planner", installationId: "install", projectId: "project", refDigest: "b".repeat(64), evidenceLevel: "observed", target: { surface: "planner", recordType: "planner-version", recordId: "base", incarnation: "base-inc", version: 1, fields: ["amount"], projectionDigest: "c".repeat(64) } } as const
    const basis = { id: "basis", version: 1, decisionType: "unknown", categoryIds: [], additionalCategoryIds: [], sourceRefs: [] } as const
    const assessment = { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon: { start: "2027-01-01", end: "2027-12-31" }, issues: ["inventory-unavailable"], evaluatedSourceRefs: [plannerRef], entries: [], derivedMissingCategoryIds: [], coverageState: "pending" } as const
    const result = { id: "scenario", version: 1, components: [], currency: "USD", horizon: assessment.horizon, sourceRefs: [plannerRef], unresolvedConditions: ["inventory-unavailable"], restrictions: [], costCoverage: assessment, comparisonStatus: "conditioned", knownSubtotal: null, total: null } as const
    const request = { caseRef: "case:case:inc", expectedCaseVersion: 1, basis, assessment, result, scenario: { baseRef: "base", operations: [], assumptions: [] } }
    const first = await registry.registerProposalCoverage(request, context)
    expect(first.status).toBe("ok")
    if (first.status !== "ok") throw new Error(first.reason)
    expect(await registry.registerProposalCoverage(request, context)).toEqual(first)
    expect(await registry.resolveForecastCoverage(first.value.coverageRef, context)).toMatchObject({ status: "ok", value: { basis, assessment } })
    scope.allowed = false
    expect((await registry.resolveForecastCoverage(first.value.coverageRef, context)).status).toBe("denied")
    scope.allowed = true
    await store.transaction("planner", async (snapshot) => { snapshot.data.proof = "stale"; return { commit: true, value: true } })
    const next = createProposalCoverageRegistry({ state, host: { requestFor: () => new Request("https://example.test"), revalidate: async () => true }, authorizeCase: async () => true, verifyEvidence: async () => true, verifySnapshot: (snapshot) => snapshot.data.proof === "fresh", operationIdentity: () => "different-intent", proposalCoverageWrites: new WeakSet(), now: () => "2026-11-13T00:00:00Z" })
    expect((await next.registerProposalCoverage(request, context)).status).toBe("conflict")
    const record = await state.read(new Request("https://example.test"), "preferences", (staged) => Object.keys(staged.preferences).filter((key) => key.startsWith("sf:proposal-coverage:")))
    if (record.status === "ok") expect(record.value).toHaveLength(1)
    const currentCase = await state.read(new Request("https://example.test"), "cases", (staged) => staged.cases.case)
    if (currentCase.status !== "ok" || !currentCase.value) throw new Error("case unavailable")
    await state.transaction(new Request("https://example.test"), { namespace: "cases", expectedStorageVersion: currentCase.storageVersion, targetRef: "case", targetIncarnation: "inc", idempotencyKey: "advance", commandDigest: "f".repeat(64) }, async (staged) => { staged.cases.case = { ...currentCase.value!, version: 2 }; return { commit: true, value: true } })
    expect((await registry.resolveForecastCoverage(first.value.coverageRef, context)).status).toBe("denied")
    expect((await registry.registerProposalCoverage(request, context)).status).toBe("denied")
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
