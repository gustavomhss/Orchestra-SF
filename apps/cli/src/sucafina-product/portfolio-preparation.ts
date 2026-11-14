import { randomUUID } from "node:crypto"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { createDecisionMutations } from "../../../../modules/sucafina/Sucafinav1/product/decisions/mutations.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { createProcurementDecisionHost } from "../../../../modules/sucafina/Sucafinav1/product/procurement/decision-host.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { createSfPortfolioAuthority } from "./portfolio-authority.ts"
import { createSfPortfolioHandoff } from "./portfolio-handoff.ts"
import { createSfPortfolioCoverage } from "./portfolio-coverage.ts"

type Mutations = Parameters<typeof createDecisionMutations>[0]

/** Real human confirmations, domain metrics and C12 command preparation share C08 authority. */
export function createSfPortfolioPreparation(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  registries: ReturnType<typeof createSfPortfolioAuthority>
  procurementEvidenceWrites?: WeakSet<object>
}) {
  const { authority, business, registries } = input
  const handoff = createSfPortfolioHandoff(input)
  const action = (operation: Parameters<Mutations["authorizeMutation"]>[0]) => operation === "add-alternative" ? "decisions.promote-alternative" : operation === "prepare-changes" ? "decisions.prepare-changes" : operation === "record-choice" ? "decisions.choose" : operation === "add-question" ? "decisions.add-question" : "decisions.answer-question"
  const procurementHost: Parameters<typeof createProcurementDecisionHost>[0]["host"] = { ...authority.host, ...business.registry,
    resolveRequestSource: async (reference, call) => {
      const selected = await business.registry.resolveRequestSource(reference, call)
      return selected.status === "unavailable" && selected.reason === "Request unavailable" ? business.individual.resolve(reference, call) : selected
    },
    isCurrentRequestSource: (snapshot, evidence) => business.registry.isCurrentRequestSource(snapshot, evidence) || business.individual.isCurrent(snapshot, evidence),
    resolveSupplierSource: business.individual.resolve, isCurrentSupplierSource: business.individual.isCurrent,
    readContractSource: business.contracts.readContractSource,
  }
  const procurement = input.procurementEvidenceWrites ? createProcurementDecisionHost({ host: procurementHost, port: business.procurement, individual: business.individual,
    authority: { ...authority, human: { ...authority.human, authorize: async (call, name, payload) =>
      await authority.human.authorize(call, name, payload) || name === "decisions.prepare-changes" && await handoff.authorize("prepare-changes", payload, call) } },
    procurementEvidenceWrites: input.procurementEvidenceWrites, cases: business.cases, planner: registries.planner, plannerSources: business.plannerSources,
    operationIdentity: business.operationIdentity, readSourceFences: business.readSourceFences, lockedSourceFences: business.lockedSourceFences,
    createId: randomUUID, now: () => new Date().toISOString(),
  }) : undefined
  const authorizeMutation: Mutations["authorizeMutation"] = async (operation, request, call) => {
    const authorized = handoff.parent(operation, request, call) !== undefined
      ? await handoff.authorize(operation, request, call) : await registries.intent.authorize(call, action(operation), request)
    return authorized && (operation !== "add-alternative" || coverage.remember(request, call))
  }
  const verifyMutation: Mutations["verifyMutation"] = (_snapshot, operation, request, call) => handoff.parent(operation, request, call) !== undefined
    ? handoff.verify(operation, request, call) : registries.intent.verify(call, action(operation), request)
  const coverage = createSfPortfolioCoverage({ authority, business, verifyIntent: verifyMutation })
  const confirmChoice: Mutations["confirmChoice"] = async (caseRef, alternativeId, call) => {
    const payload = registries.intent.payload(call, "decisions.choose")
    const value = object(payload)
    return same(value.caseRef, caseRef) && value.alternativeId === alternativeId && await authority.human.authorize(call, "decisions.choose", payload)
  }
  const confirmAnswer: Mutations["confirmAnswer"] = async (caseRef, questionId, answerRef, call) => {
    const payload = registries.intent.payload(call, "decisions.answer-question")
    const value = object(payload)
    return same(value.caseRef, caseRef) && value.questionId === questionId && value.answerRef === answerRef &&
      await authority.human.authorize(call, "decisions.answer-question", payload) && await business.collaboration.answerEvidence.belongsToQuestion(questionId, answerRef, call)
  }
  const resolveChoiceValues: Mutations["resolveChoiceValues"] = async (caseRef, comparison, call) => {
    const payload = registries.intent.payload(call, "decisions.choose")
    const choice = object(payload)
    if (!same(choice.caseRef, caseRef) || !same(choice.comparison, comparison) || comparison.scenarioRefs.length !== 2 || !comparison.criteria.length ||
      new Set(comparison.criteria).size !== comparison.criteria.length || !await authority.human.authorize(call, "decisions.choose", payload)) return { status: "denied", reason: "choice-values-human-intent-mismatch" }
    const current = await business.cases.read({ caseRef: encodeCaseRef(caseRef) }, call)
    if (current.status !== "ok") return current
    if (current.value.case.version !== caseRef.version) return { status: "stale", reason: "choice-case-changed" }
    const values: { criterionRef: string; value: number | null; unit: string; currency: string; horizon: { start: string; end: string } }[] = []
    for (const criterionId of comparison.criteria) {
      const rule = await registries.rules.resolve({ caseRef, criterionId }, call)
      if (rule.status !== "ok") return rule
      const request = { caseRef, criterionId, ruleRef: rule.value.ruleRef, ruleVersion: rule.value.version, metricRef: rule.value.metricRef,
        baselineRef: comparison.scenarioRefs[0]!, scenarioRef: comparison.scenarioRefs[1]! }
      const metric = await registries.readMetric(request, call)
      if (metric.status !== "ok") return metric
      if (metric.value.state === "unavailable" || metric.value.unit !== rule.value.unit || metric.value.unit !== current.value.case.currency || !same(metric.value.period, rule.value.period) ||
        !same(metric.value.period, current.value.case.horizon) || metric.value.value !== null && !Number.isFinite(metric.value.value) ||
        rule.value.sensitivity && rule.value.sensitivity.baselineRef !== request.baselineRef) return { status: "unavailable", reason: "choice-domain-metric-unavailable" }
      const again = await registries.readMetric(request, call)
      const sameRule = await registries.rules.resolve({ caseRef, criterionId }, call)
      if (again.status !== "ok" || !same(again.value, metric.value) || sameRule.status !== "ok" || !same(sameRule.value, rule.value)) return { status: "stale", reason: "choice-domain-metric-changed" }
      values.push({ criterionRef: criterionId, value: metric.value.value, unit: metric.value.unit, currency: current.value.case.currency, horizon: structuredClone(metric.value.period) })
    }
    const again = await business.cases.read({ caseRef: encodeCaseRef(caseRef) }, call)
    return again.status === "ok" && same(again.value.case, current.value.case) && await authority.human.authorize(call, "decisions.choose", payload) && await authority.host.revalidate(call)
      ? { status: "ok", value: values } : { status: "stale", reason: "choice-values-changed" }
  }
  const prepareDomainCommands: Mutations["prepareDomainCommands"] = (caseRef, choiceId, operations, call) => procurement
    ? procurement.prepareDomainCommands(caseRef, choiceId, operations, call)
    : Promise.resolve({ status: "unavailable", reason: "portfolio-procurement-evidence-authority-unavailable" })
  return { authorizeMutation, verifyMutation, coverageEvidence: coverage.evidence, portfolioParent: handoff.parent, confirmChoice, confirmAnswer, resolveChoiceValues, prepareDomainCommands,
    handoff, dispose: () => { coverage.dispose(); procurement?.dispose() }, unavailable: input.procurementEvidenceWrites ? [] : ["portfolio-procurement-evidence-authority-unavailable"] }
}

function same(left: unknown, right: unknown) { return digestSfValue(left) === digestSfValue(right) }
