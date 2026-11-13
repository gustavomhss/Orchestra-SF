import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createCriterionRuleRegistry } from "../../../product/decisions/criterion-rules.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

test("explicit criterion rule is versioned, authorized and evaluated using the domain metric", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-criterion-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
    const state = createSfProductState({ persistence: store, createId: () => "state", resolveTarget: async () => ({ incarnation: "inc" }), authorize: async () => ({ principalRef: "principal", policyVersion: "policy", accessRevision: "access" }) })
    const caseRef = { id: "case", incarnation: "inc", version: 1 }
    const decision = { ...caseRef, participants: ["principal"], criteria: [{ id: "cost", description: "Cost", required: true }] } as unknown as DecisionCase
    await state.transaction(new Request("https://example.test"), { namespace: "cases", expectedStorageVersion: 0, targetRef: "case", targetIncarnation: "inc", idempotencyKey: "seed", commandDigest: "a".repeat(64) }, async (staged) => { staged.cases.case = decision; return { commit: true, value: true } })
    const period = { start: "2027-01-01", end: "2027-12-31" }
    const evidence = { schema: "sf-evidence-v1", kind: "record", refId: "metric", installationId: "install", projectId: "project", refDigest: "b".repeat(64), evidenceLevel: "observed", target: { surface: "planner", recordType: "planner-version", recordId: "v0", incarnation: "source-inc", version: 1, fields: ["amount"], period, projectionDigest: "c".repeat(64) } } as const satisfies BusinessEvidenceRef
    const gate: { allowed: boolean; grant: boolean; unit: string; metricState: "confirmed" | "conditioned" } = { allowed: true, grant: false, unit: "USD", metricState: "conditioned" }
    const rules = createCriterionRuleRegistry({ state, host: { requestFor: () => new Request("https://example.test"), revalidate: async () => gate.allowed }, authorizeCase: async () => gate.allowed, authorizeRule: async () => gate.allowed, verifyEvidence: async () => gate.allowed, verifySnapshot: () => gate.grant, readMetric: async (request) => ({ status: "ok", value: { ...request, value: 100, unit: gate.unit, period, evidenceRefs: [evidence], state: gate.metricState, engineVersion: "planner-v1" } }), verifyMetric: async () => gate.allowed, operationIdentity: () => "intent", proposalCoverageWrites: new WeakSet(), now: () => "2026-11-13T00:00:00Z" })
    expect(await rules.evaluate({ caseRef, criterionId: "cost", scenarioRef: "scenario" }, context)).toMatchObject({ status: "ok", value: { state: "unknown", reason: "criterion-rule-unavailable" } })
    const request = { caseRef, criterionId: "cost", metricRef: "planner:known-subtotal-difference", operator: "lte", value: 150, unit: "USD", period, evidenceRefs: [evidence], expectedRuleVersion: 0, sensitivity: { baselineRef: "baseline", parameterRef: "headcount", parameterUnit: "FTE", resultUnit: "USD", engineVersion: "planner-v1", sourceRefs: [evidence] } } as const
    expect((await rules.register(request, context)).status).toBe("conflict")
    gate.grant = true
    const registered = await rules.register(request, context)
    expect(registered.status).toBe("ok")
    expect(await rules.register(request, context)).toEqual(registered)
    expect((await rules.register({ ...request, value: 200 }, context)).status).toBe("conflict")
    expect(await rules.resolve({ caseRef, criterionId: "cost" }, context)).toMatchObject({ status: "ok", value: { version: 1, sensitivity: { parameterUnit: "FTE", resultUnit: "USD" } } })
    expect(await rules.evaluate({ caseRef, criterionId: "cost", scenarioRef: "scenario", baselineRef: "baseline" }, context)).toMatchObject({ status: "ok", value: { state: "unknown", reason: "criterion-metric-conditioned" } })
    gate.metricState = "confirmed"
    expect(await rules.evaluate({ caseRef, criterionId: "cost", scenarioRef: "scenario", baselineRef: "baseline" }, context)).toMatchObject({ status: "ok", value: { state: "satisfied", reason: "criterion-satisfied" } })
    gate.unit = "EUR"
    expect(await rules.evaluate({ caseRef, criterionId: "cost", scenarioRef: "scenario", baselineRef: "baseline" }, context)).toMatchObject({ status: "ok", value: { state: "unknown", reason: "criterion-metric-unavailable" } })
    gate.allowed = false
    expect((await rules.resolve({ caseRef, criterionId: "cost" }, context)).status).toBe("denied")
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
