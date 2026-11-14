import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createCriterionRuleRegistry, criterionRuleKey } from "../../../product/decisions/criterion-rules.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
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
    const writes = new WeakSet<object>()
    const state = createSfProductState({ persistence: store, proposalCoverageWrites: writes, createId: () => "state", resolveTarget: async () => ({ incarnation: "inc" }), authorize: async () => ({ principalRef: "principal", policyVersion: "policy", accessRevision: "access" }) })
    const caseRef = { id: "case", incarnation: "inc", version: 1 }
    const decision = { ...caseRef, participants: ["principal"], criteria: [{ id: "cost", description: "Cost", required: true }] } as unknown as DecisionCase
    await state.transaction(new Request("https://example.test"), { namespace: "cases", expectedStorageVersion: 0, targetRef: "case", targetIncarnation: "inc", idempotencyKey: "seed", commandDigest: "a".repeat(64) }, async (staged) => { staged.cases.case = decision; return { commit: true, value: true } })
    const period = { start: "2027-01-01", end: "2027-12-31" }
    const evidence = { schema: "sf-evidence-v1", kind: "record", refId: "metric", installationId: "install", projectId: "project", refDigest: "b".repeat(64), evidenceLevel: "observed", target: { surface: "planner", recordType: "planner-version", recordId: "v0", incarnation: "source-inc", version: 1, fields: ["amount"], period, projectionDigest: "c".repeat(64) } } as const satisfies BusinessEvidenceRef
    const gate: { allowed: boolean; grant: boolean; unit: string; metricState: "confirmed" | "conditioned"; operation: string } = { allowed: true, grant: false, unit: "USD", metricState: "conditioned", operation: "intent" }
    const rules = createCriterionRuleRegistry({ state, host: { requestFor: () => new Request("https://example.test"), revalidate: async () => gate.allowed }, authorizeCase: async () => gate.allowed, authorizeRule: async () => gate.allowed, verifyEvidence: async () => gate.allowed, verifySnapshot: () => gate.grant, readMetric: async (request) => ({ status: "ok", value: { ...request, value: 100, unit: gate.unit, period, evidenceRefs: [evidence], state: gate.metricState, engineVersion: "planner-v1" } }), verifyMetric: async () => gate.allowed, operationIdentity: () => gate.operation, proposalCoverageWrites: writes, now: () => "2026-11-13T00:00:00Z" })
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
    const firstEvaluation = await rules.evaluate({ caseRef, criterionId: "cost", scenarioRef: "scenario", baselineRef: "baseline" }, context)
    expect(firstEvaluation).toMatchObject({ status: "ok", value: { state: "satisfied", reason: "criterion-satisfied" } })
    const firstRule = await rules.resolve({ caseRef, criterionId: "cost" }, context)
    if (firstRule.status !== "ok") throw new Error("Initial criterion rule unavailable")
    const firstRuleDigest = digestSfValue(firstRule.value)
    const firstEvaluationDigest = digestSfValue(firstEvaluation)

    // A separate explicit intent changes only the threshold. The metric
    // remains the same controlled domain-metric callback used above.
    gate.operation = "intent-revision"
    const revision = { ...request, value: 50, expectedRuleVersion: 1 }
    const revised = await rules.register(revision, context)
    expect(revised).toMatchObject({ status: "ok", value: { version: 2 } })
    if (revised.status !== "ok") throw new Error("Revised criterion rule unavailable")
    expect(revised.value.ruleRef).not.toBe(firstRule.value.ruleRef)
    expect(await rules.register(revision, context)).toEqual(revised)
    const currentRule = await rules.resolve({ caseRef, criterionId: "cost" }, context)
    expect(currentRule).toMatchObject({ status: "ok", value: { ruleRef: revised.value.ruleRef, version: 2, operator: "lte", value: 50 } })
    if (currentRule.status !== "ok") throw new Error("Current criterion rule unavailable")
    expect(await rules.evaluate({ caseRef, criterionId: "cost", scenarioRef: "scenario", baselineRef: "baseline" }, context)).toMatchObject({ status: "ok", value: { state: "failed", reason: "criterion-not-satisfied", ruleRef: revised.value.ruleRef } })
    expect(digestSfValue(firstEvaluation)).toBe(firstEvaluationDigest)

    const readHistory = () => state.read(new Request("https://example.test"), "preferences", (stored) => ({
      current: stored.preferences[criterionRuleKey(caseRef, "cost")],
      first: stored.preferences[`sf:criterion-rule:history:${firstRule.value.ruleRef}`],
      second: stored.preferences[`sf:criterion-rule:history:${revised.value.ruleRef}`],
      historyKeys: Object.keys(stored.preferences).filter((key) => key.startsWith("sf:criterion-rule:history:")).sort(),
    }))
    const history = await readHistory()
    if (history.status !== "ok") throw new Error("Criterion history unavailable")
    expect(history.value.current).toEqual(currentRule.value)
    expect(history.value.first).toEqual(firstRule.value)
    expect(history.value.second).toEqual(currentRule.value)
    expect(digestSfValue(history.value.first)).toBe(firstRuleDigest)
    expect(history.value.historyKeys).toHaveLength(2)
    gate.operation = "intent-stale"
    expect(await rules.register({ ...revision, expectedRuleVersion: 0 }, context)).toEqual({ status: "stale", reason: "criterion-rule-changed" })
    gate.operation = "intent"
    expect(await rules.register(request, context)).toEqual({ status: "unavailable", reason: "criterion-replay-unavailable" })
    const afterRefusals = await readHistory()
    if (afterRefusals.status !== "ok") throw new Error("Criterion history after refusal unavailable")
    expect(afterRefusals.value).toEqual(history.value)
    expect(digestSfValue(firstRule.value)).toBe(firstRuleDigest)
    gate.unit = "EUR"
    expect(await rules.evaluate({ caseRef, criterionId: "cost", scenarioRef: "scenario", baselineRef: "baseline" }, context)).toMatchObject({ status: "ok", value: { state: "unknown", reason: "criterion-metric-unavailable" } })
    gate.allowed = false
    expect((await rules.resolve({ caseRef, criterionId: "cost" }, context)).status).toBe("denied")
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
