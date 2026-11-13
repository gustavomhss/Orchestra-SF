import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { AgentV2 } from "@orchestra/core/agent"
import type { Mcp } from "@orchestra/core/mcp"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionSchema } from "@orchestra/core/session/schema"
import { Effect } from "effect"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageAssessment, CostCoverageBasis, DecisionCase } from "../../../product/contracts/decisions.ts"
import type { PlannerSourceHost } from "../../../product/contracts/ports.ts"
import type { ResidentProfile, SkillLoadReceipt, SkillManifest } from "../../../product/contracts/resident-ai.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfBusinessContext } from "../../../product/host-binding/business-context.ts"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { createSfBusinessMcpBridge } from "../../../product/host-binding/sf-mcp-bridge.ts"
import { createDecisionCasePort, encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createDecisionCoverageAccess, decisionCoverageRef } from "../../../product/decisions/coverage-access.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createPlannerCapabilities } from "../../../product/planner/capabilities.ts"
import { createPlannerPort } from "../../../product/planner/port.ts"
import { createPlannerResultPersistence } from "../../../product/planner/persistence.ts"
import { createStoredPlannerScenarioHost } from "../../../product/planner/stored-scenarios.ts"
import { plannerAt, plannerFixture, plannerPeriod } from "./planner-fixture.ts"

// Admission is a deterministic fixture, not a loaded resident skill. Everything from the
// private lease through MCP/dispatch to Planner, case access, C10 and C08 executes here.
test("C16 scenario simulation and comparison share UI/MCP handlers and persist their real results in C08", async () => {
  const fixture = await plannerFixture()
  try {
    const read = await fixture.admit("sf-human:planner.read", {}, "finance", true)
    const request = fixture.authority.requestFor(read)!
    const issued = await Promise.all(["v0", "v1"].map((id) => fixture.issueSource(id, read)))
    if (issued.some((item) => item.status !== "ok")) throw new Error("sources unavailable")
    const refs = issued.flatMap((item) => item.status === "ok" ? [item.value.evidence] : [])
    const domainBefore = (await fixture.readSnapshot()).data
    const state = createSfProductState({ persistence: fixture.store, createId: randomUUID, resolveTarget: async (_request, _snapshot, _namespace, target) => target === "case" ? { incarnation: "case-inc" } : undefined, authorize: async (http) => fixture.access.allowed && http.headers.get("authorization") === "finance" ? { principalRef: "finance", policyVersion: "1", accessRevision: fixture.access.revision } : undefined })
    const authorizeCase = async (decision: DecisionCase, context: TrustedDomainContext) => decision.participants.includes(context.binding.principalRef) && await fixture.host.revalidate(context)
    const verifyRefs = async (evidenceRefs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => {
      const checked = await Promise.all(evidenceRefs.map(async (ref) => {
        if (ref.kind !== "record") return false
        const current = await fixture.sources.resolveForecastSource(ref.refId, context)
        return current.status === "ok" && current.value.evidence.refDigest === ref.refDigest
      }))
      return checked.every(Boolean)
    }
    const evidence = createSfBusinessContext({
      revalidate: fixture.host.revalidate,
      resolveSource: async (ref, context): Promise<BusinessEvidenceResolution> => {
        const unavailable = (): BusinessEvidenceResolution => ({ state: "unavailable", ref, accessRevision: context.binding.accessRevision, checkedAt: plannerAt })
        if (ref.kind !== "record" || ref.target.surface !== "planner" || ref.target.recordType !== "planner-version" || !ref.target.period) return unavailable()
        const current = await fixture.sources.resolveForecastSource(ref.refId, context)
        if (current.status !== "ok" || digestSfValue(current.value.evidence) !== digestSfValue(ref)) return unavailable()
        const projection = await fixture.planner.compareForecast({ baseRef: ref.refId, candidateRef: ref.refId, period: ref.target.period, currency: "USD" }, context)
        if (projection.status !== "ok") return unavailable()
        return { state: "fresh", ref, currentRef: current.value.evidence, authorizedProjection: projection.value.baseline, accessRevision: context.binding.accessRevision, checkedAt: plannerAt }
      },
      proveContinuity: async () => false,
      recall: async () => [],
      emitFromLedger: async () => { throw new Error("No ledger emission in this fixture") },
    })
    const caseCoverage = createDecisionCoverageAccess({ state, host: fixture.host, authorizeCase, verifyEvidence: async (basis, assessment, context) => verifyRefs([...basis.sourceRefs, ...assessment.evaluatedSourceRefs], context) })
    const basis: CostCoverageBasis = { id: "basis", version: 1, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: refs }
    const baselineCoverage = refs.map((ref, index): CostCoverageAssessment => ({ basisId: basis.id, basisVersion: 1, alternativeId: `alternative-${index}`, alternativeVersion: 1, currency: "USD", horizon: plannerPeriod, evaluatedSourceRefs: [ref], coverageState: "pending", entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => ({ status: "pending", categoryId, reason: "This fixture has no human cost classification" })), derivedMissingCategoryIds: [...RENEWAL_TRANSITION_CATEGORIES], issues: ["human-cost-classification-required"] }))
    const sources: PlannerSourceHost = { resolveForecastSource: fixture.sources.resolveForecastSource, resolveForecastCoverage: async (reference, context) => {
      if (reference.startsWith("case-coverage:")) return caseCoverage(reference, context)
      const index = refs.findIndex((ref) => ref.refId === reference)
      if (index < 0) return { status: "unavailable", reason: "unknown-baseline" }
      const current = await fixture.sources.resolveForecastSource(reference, context)
      if (current.status !== "ok") return current
      if (current.value.evidence.refDigest !== refs[index]!.refDigest) return { status: "stale", reason: "baseline-changed" }
      return { status: "ok", value: { coverageRef: `baseline:${index}`, basis, assessment: baselineCoverage[index]! } }
    } }
    const base = createPlannerPort({ host: fixture.host, sources })
    const inputs = refs.map((ref) => ({ baseRef: ref.refId, operations: [], assumptions: [] }))
    const previews = await Promise.all(inputs.map((input) => base.simulateScenario(input, read)))
    if (previews.some((preview) => preview.status !== "ok")) throw new Error("scenario setup failed")
    const results = previews.flatMap((preview) => preview.status === "ok" ? [preview.value] : [])
    const decision: DecisionCase = { id: "case", incarnation: "case-inc", version: 1, state: "comparing", objective: "Compare the current Planner alternatives", currency: "USD", horizon: plannerPeriod, criteria: [], participants: ["finance"], sourceRefs: refs, alternatives: results.map((result, index) => ({ id: `alternative-${index}`, version: 1, title: `Alternative ${index}`, scenario: inputs[index]!, result })), costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const seeded = await state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed", commandDigest: digestSfValue(decision), targetRef: "case", targetIncarnation: "case-inc" }, async (staged) => { staged.cases.case = decision; return { commit: true, value: true } })
    expect(seeded.status).toBe("ok")
    const store = createSfDecisionResultStore({ state, host: fixture.host, authorizeCase, verifySources: async (_value, sourceRefs, context) => verifyRefs(sourceRefs, context), createId: randomUUID, now: () => plannerAt })
    const cases = createDecisionCasePort({ state, host: fixture.host, creationTarget: { ref: "case", incarnation: "case-inc" }, operationIdentity: () => undefined, authorizeCase, evidence, createId: randomUUID, now: () => plannerAt })
    const caseEvidence = await evidence.context({ refs }, read)
    expect(caseEvidence).toHaveLength(refs.length)
    expect(caseEvidence.every((resolved) => resolved.state === "fresh" && resolved.authorizedProjection)).toBe(true)
    expect(await cases.read({ caseRef: encodeCaseRef(decision) }, read)).toMatchObject({ status: "ok", value: { evidenceRefs: refs } })
    const scenarios = createStoredPlannerScenarioHost({ store, cases, planner: base, coverageRefFor: (caseRef, alternative) => decisionCoverageRef(caseRef, alternative.id, alternative.version) })
    const planner = createPlannerPort({ host: fixture.host, sources, scenarios })
    const persist = createPlannerResultPersistence({ store, scenarios, resolveCase: async (context) => {
      const current = await cases.read({ caseRef: encodeCaseRef(decision) }, context)
      return current.status === "ok" ? { status: "ok", value: { id: current.value.case.id, incarnation: current.value.case.incarnation, version: current.value.case.version } } : current
    } })
    const descriptors = createPlannerCapabilities(planner, fixture.authority.receiptFor, persist)
    const operations = ["sf_forecast_compare", "sf_scenario_simulate", "sf_scenario_compare"] as const
    const dispatch = (operation: string, payload: unknown, context: TrustedDomainContext) => dispatchSfCapability({ operation, payload, context, descriptors, authority: fixture.authority,
      validateInput: (descriptor, value) => { const id = operations.find((entry) => entry === descriptor.id); return !!id && decodeSfOperationInput(id, value).ok },
      validateOutput: (descriptor, value) => { const id = operations.find((entry) => entry === descriptor.id); return value.status !== "ok" || !!id && decodeSfOperationOutput(id, value.result).ok },
    })
    const humanBase = await dispatch("sf_scenario_simulate", inputs[0], await fixture.admit("sf_scenario_simulate", inputs[0]))
    const humanAlternative = await dispatch("sf_scenario_simulate", inputs[1], await fixture.admit("sf_scenario_simulate", inputs[1]))
    expect(humanBase.status).toBe("ok")
    expect(humanAlternative.status).toBe("ok")
    if (humanBase.status !== "ok" || humanAlternative.status !== "ok") throw new Error("UI persistence failed")
    expect(typeof humanBase.outputRef).toBe("string")
    expect(typeof humanAlternative.outputRef).toBe("string")
    if (typeof humanBase.outputRef !== "string" || typeof humanAlternative.outputRef !== "string") throw new Error("UI output references must be strings")
    const humanBaseRef = humanBase.outputRef
    const humanAlternativeRef = humanAlternative.outputRef
    expect(humanBaseRef).toStartWith("decision-result:")
    expect(humanAlternativeRef).toStartWith("decision-result:")
    expect(humanBase.result).toMatchObject({ knownSubtotal: 590000, total: null })
    expect(humanAlternative.result).toMatchObject({ knownSubtotal: 602000, total: null })
    expect(humanBase.receipt).toMatchObject({ kind: "ui", handlerExport: "simulateScenario" })
    expect(await store.read({ resultRef: humanBaseRef, kind: "scenario" }, read)).toMatchObject({ status: "ok", value: { requestDigest: digestSfValue(inputs[0]), resultDigest: digestSfValue(humanBase.result) } })

    const sessionID = SessionSchema.ID.make("ses_wp03_scenario_parity")
    const allowedOperations = ["sf_scenario_simulate", "sf_scenario_compare"]
    const profile: ResidentProfile = { id: "sf_finance", version: "1", mission: "Compare scenario fixture", sourcePath: "profile.json", sourceDigest: "a".repeat(64), allowedSkills: ["sf-comparar-cenarios"], allowedOperations, outputTypes: ["ScenarioComparison"], contextBudgetTokens: 1000, maxSteps: 3, maxDelegations: 0, modelClass: "reasoning", resumePolicy: "fresh" }
    const skill: SkillManifest = { id: "sf-comparar-cenarios", version: "1", sourcePath: "skill/SKILL.md", sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64), inputSchemaRef: "ScenarioComparisonInput", outputSchemaRefs: ["ScenarioComparison"], allowedProfiles: ["sf_finance"], allowedOperations, workflow: ["simulate", "compare"], limits: { maxSteps: 3, contextBudgetTokens: 1000 }, positiveAcceptance: ["compare"], negativeAcceptance: ["deny"] }
    const receipt: SkillLoadReceipt = { runId: "scenario-parity-fixture", nativeSessionId: sessionID, profileId: profile.id, profileVersion: profile.version, profileDigest: profile.sourceDigest, skillId: skill.id, skillVersion: skill.version, sourceDigest: skill.sourceDigest, instructionsDigest: skill.instructionsDigest, loadedMessageId: "msg_wp03_scenario_loaded", loadedAt: plannerAt, manifestDigest: "d".repeat(64) }
    const bound = await fixture.registry.bind({ request: new Request("https://example.test/planner", { headers: { authorization: "finance" } }), selected: { profile, manifestDigest: receipt.manifestDigest, skills: [skill], operationIds: allowedOperations }, sessionID, runId: receipt.runId, caseRef: { id: decision.id, incarnation: decision.incarnation, version: 1 }, profile, manifestDigest: receipt.manifestDigest, skillReceipts: [receipt], entryMode: "interactive" })
    expect(bound.status).toBe("ok")
    const nativeContext = { sessionID, agent: AgentV2.ID.make(profile.id), assistantMessageID: SessionMessage.ID.make("msg_wp03_scenario"), toolCallID: "simulate" }
    const bridge = createSfBusinessMcpBridge({ registry: fixture.registry, mcp: { config: () => Effect.succeed({}) } as unknown as Mcp.Interface, descriptors, dispatch })
    const nativeBase = await bridge.call(nativeContext, "sf_scenario_simulate", inputs[0])
    expect(nativeBase.status).toBe("ok")
    if (nativeBase.status !== "ok") throw new Error("MCP scenario persistence failed")
    // Check and retain primitive references before matching result objects that are
    // reused as input below; asymmetric matchers must not enter the replay request.
    expect(typeof nativeBase.outputRef).toBe("string")
    if (typeof nativeBase.outputRef !== "string") throw new Error("MCP output reference must be a string")
    const nativeBaseRef = nativeBase.outputRef
    expect(nativeBaseRef).toStartWith("decision-result:")
    expect(nativeBase.result).toEqual(humanBase.result)
    expect(nativeBase.receipt).toMatchObject({ kind: "native", handlerExport: "simulateScenario", resultDigest: digestSfValue(humanBase.result) })
    expect(await store.read({ resultRef: nativeBaseRef, kind: "scenario" }, read)).toMatchObject({ status: "ok", value: { resultDigest: digestSfValue(humanBase.result) } })
    const comparisonInput = { scenarioRefs: [humanBaseRef, humanAlternativeRef], criteria: [] }
    const humanComparison = await dispatch("sf_scenario_compare", comparisonInput, await fixture.admit("sf_scenario_compare", comparisonInput))
    const nativeComparison = await bridge.call({ ...nativeContext, toolCallID: "compare" }, "sf_scenario_compare", comparisonInput)
    expect(humanComparison.status).toBe("ok")
    expect(nativeComparison.status).toBe("ok")
    if (humanComparison.status !== "ok" || nativeComparison.status !== "ok") throw new Error("comparison persistence failed")
    expect(typeof humanComparison.outputRef).toBe("string")
    expect(typeof nativeComparison.outputRef).toBe("string")
    if (typeof humanComparison.outputRef !== "string" || typeof nativeComparison.outputRef !== "string") throw new Error("Comparison output references must be strings")
    const comparisonRefs = [humanComparison.outputRef, nativeComparison.outputRef]
    comparisonRefs.forEach((ref) => expect(ref).toStartWith("decision-result:"))
    expect(humanComparison.result).toMatchObject({ knownDifference: 12000, completeDifference: null, comparisonStatus: "conditioned" })
    expect(humanComparison.receipt).toMatchObject({ kind: "ui", handlerExport: "compareScenarios" })
    expect(nativeComparison.receipt).toMatchObject({ kind: "native", handlerExport: "compareScenarios" })
    expect(nativeComparison.result).toEqual(humanComparison.result)
    expect(nativeComparison.receipt).toMatchObject({ resultDigest: digestSfValue(humanComparison.result) })
    for (const resultRef of comparisonRefs) expect(await store.read({ resultRef, kind: "comparison" }, read)).toMatchObject({ status: "ok", value: { requestDigest: digestSfValue(comparisonInput), resultDigest: digestSfValue(humanComparison.result) } })
    expect(await bridge.call({ ...nativeContext, toolCallID: "compare" }, "sf_scenario_compare", comparisonInput)).toMatchObject({ status: "denied" })
    const beforeRevocation = await fixture.admit("sf_scenario_compare", comparisonInput)
    fixture.access.revision = "revoked"
    expect(await dispatch("sf_scenario_compare", comparisonInput, beforeRevocation)).toMatchObject({ status: "denied" })
    expect(await bridge.call({ ...nativeContext, toolCallID: "revoked-simulation" }, "sf_scenario_simulate", inputs[0])).toMatchObject({ status: "denied" })
    expect((await fixture.readSnapshot()).data).toEqual(domainBefore)
  } finally { await fixture.close() }
}, 20_000)
