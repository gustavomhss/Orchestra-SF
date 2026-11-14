import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { DomainPortHost, PlannerSourceHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { createDecisionCasePort } from "../../../product/decisions/case-port.ts"
import { createDecisionCoverageAccess, decisionCoverageRef } from "../../../product/decisions/coverage-access.ts"
import { createCriterionRuleRegistry } from "../../../product/decisions/criterion-rules.ts"
import { createDecisionMutations } from "../../../product/decisions/mutations.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createPlannerCriterionMetric } from "../../../product/planner/criterion-metric.ts"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { comparePlannerPreview } from "../../../product/planner/preview-comparison.ts"
import { createPlannerSensitivityUnits } from "../../../product/planner/sensitivity-units.ts"
import { createStoredPlannerScenarioHost } from "../../../product/planner/stored-scenarios.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { wp05Horizon } from "../wp05/engine-fixture.ts"
import type { createRenewalChoiceHistory } from "./renewal-choice-fixture.ts"
import { createRenewalCaseOperationVerifier } from "./renewal-operation-verifier.ts"
import { renewalEvidenceContext } from "./renewal-source-fixture.ts"

type History = Awaited<ReturnType<typeof createRenewalChoiceHistory>>
type Phase = History["before"]
export type RenewalHumanChoiceRequest = Parameters<ReturnType<typeof createDecisionMutations>["recordChoice"]>[0]
const origin = "https://example.test"
const at = "2026-11-14T13:00:00Z"
const humanAction = "decisions.choose"
const command = `sf-human:${humanAction}`
const sourceReader = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }

/** A real human/UI lease and real C08 provider over the financial fixture's SAME store/case.
 * Request identities and scope declarations remain explicit fixture host inputs. Canonical
 * result/source/criterion readers receive this human context; no fixture comparison is returned.
 */
export function createRenewalHumanChoices(history: History) {
  const fixture = history.fixture
  const controls = { active: true, request: 0, event: 0 }
  const intentions = new WeakMap<Request, { operationId: string; inputDigest: string }>()
  const admittedPayloads = new WeakMap<TrustedUiContext, RenewalHumanChoiceRequest>()
  const contexts: TrustedUiContext[] = []
  const identity = { installationId: fixture.context.binding.installationId, projectId: fixture.context.binding.projectId, principalRef: fixture.context.binding.principalRef, policyVersion: fixture.context.binding.policyVersion, accessRevision: fixture.context.binding.accessRevision }
  const authorize = async (request: Request) => controls.active && intentions.has(request) && request.headers.get("x-principal") === identity.principalRef ? identity : undefined
  const ui = createSfUiAuthority({ authorize, commandIdentity: async (request, operation, inputDigest) => {
    const intention = intentions.get(request)
    return operation === command && intention?.inputDigest === inputDigest ? intention.operationId : undefined
  }, privateCommands: [command], createId: () => `renewal-human-request-${++controls.request}`, now: () => Date.parse(at) })
  const human = createSfHumanAuthority({ origin, ui })
  const host: DomainPortHost = { ...fixture.host,
    requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined,
    revalidate: (context) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false),
  }
  const state = createSfProductState({ persistence: fixture.store, createId: () => "renewal-human-state", resolveTarget: async () => ({ incarnation: fixture.caseRef.incarnation }), authorize })
  const authorizeCase = async (decision: DecisionCase, context: TrustedDomainContext) => decision.id === fixture.caseRef.id && decision.incarnation === fixture.caseRef.incarnation && decision.participants.includes(context.binding.principalRef) && await host.revalidate(context)
  const readCase = async (context: TrustedDomainContext) => {
    const request = host.requestFor(context)
    if (!request || !await host.revalidate(context)) return undefined
    const read = await state.read(request, "cases", (value) => value.cases[fixture.caseRef.id])
    return read.status === "ok" && read.value && await authorizeCase(read.value, context) ? read.value : undefined
  }
  const known = new Map<string, BusinessEvidenceRef>()
  const adoptPhase = (phase: Phase) => {
    for (const ref of [...phase.sourceRefs, ...phase.selectedResult.sourceRefs, ...phase.selectedResult.costCoverage.evaluatedSourceRefs, ...phase.baselineResult.sourceRefs, ...phase.baselineResult.costCoverage.evaluatedSourceRefs]) known.set(digestSfValue(ref), structuredClone(ref))
  }
  adoptPhase(history.before)
  const matchesSnapshot = (snapshot: Snapshot, ref: BusinessEvidenceRef) => {
    if (!known.has(digestSfValue(ref)) || ref.kind !== "record") return false
    if (ref.target.recordType === "synthetic-scope") return true
    if (ref.target.surface !== "planner" || ref.target.recordType !== "planner-version") return false
    const projection = projectPlannerSource(snapshot, sourceReader, ref.target.recordId)
    return !!projection && digestSfValue({ versionId: ref.target.recordId, projection }) === ref.target.projectionDigest
  }
  const currentSource = async (ref: BusinessEvidenceRef, context: TrustedDomainContext) => {
    if (!await host.revalidate(context)) return false
    return fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: matchesSnapshot(snapshot, ref) }))
  }
  const evidence: BusinessContextService = {
    resolve: async (ref, context) => ({ state: await currentSource(ref, context) ? "fresh" : "revoked", ref, accessRevision: context.binding.accessRevision, checkedAt: at }),
    context: renewalEvidenceContext((ref, context) => evidence.resolve(ref, context)),
    recall: async () => [], emitFromLedger: async () => { throw new Error("No native memory emission in human choice fixture") },
  }
  const verifyEvidence = async (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => (await evidence.context({ refs }, context)).every((resolved) => resolved.state === "fresh")
  const caseCoverage = createDecisionCoverageAccess({ state, host, authorizeCase, verifyEvidence: (basis, assessment, context) => verifyEvidence([...basis.sourceRefs, ...assessment.evaluatedSourceRefs], context) })
  const sources: PlannerSourceHost = {
    resolveForecastSource: async (reference, context) => {
      const candidates = [...known.values()].filter((ref): ref is Extract<BusinessEvidenceRef, { kind: "record" }> => ref.kind === "record" && ref.refId === reference && ref.target.surface === "planner" && ref.target.recordType === "planner-version")
      if (candidates.length !== 1 || !await currentSource(candidates[0]!, context)) return { status: "unavailable", reason: "human-choice-source-unavailable" }
      return { status: "ok", value: { versionId: candidates[0]!.target.recordId, evidence: candidates[0]! } }
    },
    resolveForecastCoverage: async (reference, context) => {
      if (reference.startsWith("case-coverage:")) return caseCoverage(reference, context)
      const decision = await readCase(context)
      const alternative = decision?.alternatives.find((item) => item.scenario.baseRef === reference)
      const basis = decision?.costCoverageBases.find((item) => item.id === alternative?.result.costCoverage.basisId && item.version === alternative?.result.costCoverage.basisVersion)
      if (!alternative || !basis || !await verifyEvidence([...basis.sourceRefs, ...alternative.result.costCoverage.evaluatedSourceRefs], context)) return { status: "unavailable", reason: "human-choice-coverage-unavailable" }
      return { status: "ok", value: { coverageRef: `human-source-coverage:${reference}`, basis, assessment: alternative.result.costCoverage } }
    },
  }
  const planner = createPlannerPort({ host, sources, evidence })
  const results = createSfDecisionResultStore({ state, host, authorizeCase, verifySources: (_value, refs, context) => verifyEvidence(refs, context), createId: () => `unused-human-result-${++controls.event}`, now: () => at })
  // Admission needs current canonical targets; C10 stays on the judgment Planner.
  const operationSources: PlannerSourceHost = { resolveForecastSource: sources.resolveForecastSource, resolveForecastCoverage: async () => ({ status: "unavailable", reason: "coverage-not-needed-for-operation-admission" }) }
  // Stored scenarios retain their persisted C10 result and basis. This port
  // supplies only the canonical source DomainProjection; judgment and preview
  // keep the classified Planner and revalidate their complete C10 observations.
  const sourcePlanner = createPlannerPort({ host, sources: operationSources })
  const verifyOperations = createRenewalCaseOperationVerifier(host, operationSources)
  const cases = createDecisionCasePort({ state, host, creationTarget: { ref: fixture.caseRef.id, incarnation: fixture.caseRef.incarnation }, operationIdentity: (context) => context.kind === "ui" ? ui.operationIdentity(context) : undefined, authorizeCase, verifyScenarioOperations: verifyOperations, evidence, createId: () => `unused-human-case-${++controls.event}`, now: () => at })
  const scenarios = createStoredPlannerScenarioHost({ store: results, cases, planner: sourcePlanner, coverageRefFor: (ref, alternative) => decisionCoverageRef(ref, alternative.id, alternative.version) })
  const preview = (request: Parameters<typeof comparePlannerPreview>[1], context: TrustedDomainContext) => comparePlannerPreview({ host, sources, scenarios, planner }, request, context)
  const metrics: { read?: ReturnType<typeof createPlannerCriterionMetric> } = {}
  const rules = createCriterionRuleRegistry({ state, host, authorizeCase, authorizeRule: async () => false, verifyEvidence: (rule, context) => verifyEvidence(rule.evidenceRefs, context), verifySnapshot: () => false, readMetric: (request, context) => {
    if (!metrics.read) throw new Error("Human criterion metric not wired")
    return metrics.read(request, context)
  }, verifyMetric: (metric, context) => verifyEvidence(metric.evidenceRefs, context), operationIdentity: (context) => context.kind === "ui" ? ui.operationIdentity(context) : undefined, proposalCoverageWrites: new WeakSet<object>(), now: () => at })
  const units = createPlannerSensitivityUnits({ host, cases, scenarios, store: results, evidence, rules })
  metrics.read = createPlannerCriterionMetric({ host, rules, units, preview })
  const withCriteria = createPlannerPort({ host, sources, scenarios, evidence, criteria: { evaluate: async (request, context) => {
    const decision = await readCase(context)
    return decision ? rules.evaluate({ caseRef: { id: decision.id, incarnation: decision.incarnation, version: decision.version }, ...request }, context) : { status: "denied", reason: "human-choice-case-unavailable" }
  } } })
  const unavailable = async () => ({ status: "unavailable" as const, reason: "outside-human-choice-test" })
  const mutations = createDecisionMutations({ state, host, planner: withCriteria, sources, authorizeCase,
    authorizeMutation: (operation, payload, context) => operation === "record-choice" ? human.authorize(context, humanAction, payload) : Promise.resolve(false),
    verifyMutation: (snapshot, operation, payload, context) => operation === "record-choice" && context.kind === "ui" && ui.matchesIntent(context, command, digestSfValue(payload)) && [...known.values()].every((ref) => matchesSnapshot(snapshot, ref)),
    operationIdentity: (context) => context.kind === "ui" ? ui.operationIdentity(context) : undefined,
    confirmChoice: (caseRef, alternativeId, context) => {
      const payload = context.kind === "ui" ? admittedPayloads.get(context) : undefined
      return payload && digestSfValue(payload.caseRef) === digestSfValue(caseRef) && payload.alternativeId === alternativeId ? human.authorize(context, humanAction, payload) : Promise.resolve(false)
    },
    resolveQuestion: unavailable, resolveAnswer: unavailable, confirmAnswer: async () => false, prepareDomainCommands: unavailable,
    resolveChoiceValues: async (_caseRef, request, context) => {
      const compared = await withCriteria.compareScenarios(request, context)
      return compared.status === "ok" ? { status: "ok", value: [{ criterionRef: "renewal-difference", value: compared.value.knownDifference, unit: "USD", currency: "USD", horizon: wp05Horizon }] } : compared
    },
    readScenarioResult: (resultRef, context) => results.readHistoricalScenario({ resultRef }, context), createId: () => `renewal-human-event-${++controls.event}`, now: () => at,
  })
  const admit = async (operationId: string, payload: RenewalHumanChoiceRequest, requestOrigin = origin) => {
    const request = new Request(`${origin}/decisions/choose`, { method: "POST", headers: { origin: requestOrigin, "x-principal": identity.principalRef, "content-type": "application/json" }, body: JSON.stringify(payload) })
    intentions.set(request, { operationId, inputDigest: digestSfValue(payload) })
    const granted = await human.admit(request, humanAction, payload)
    if (granted.status === "ok") {
      admittedPayloads.set(granted.value, structuredClone(payload))
      contexts.push(granted.value)
    }
    return granted
  }
  return { state, ui, human, mutations, admit, adoptPhase, host, controls, readCase, finish: () => { for (const context of contexts) human.finish(context) } }
}
