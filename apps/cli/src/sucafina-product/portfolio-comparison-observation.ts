import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { ScenarioCompareRequest } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { createDecisionComparisonService } from "../../../../modules/sucafina/Sucafinav1/product/decisions/comparison.ts"
import type { CriterionRule, createCriterionRuleRegistry } from "../../../../modules/sucafina/Sucafinav1/product/decisions/criterion-rules.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import { plannerRequestIdentity } from "./planner-calculation-read-scope.ts"

type Compare = ReturnType<typeof createDecisionComparisonService>

/** Physical read ownership only. Every original comparator and rule reader still runs. */
export function createSfPortfolioComparisonObservation(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  rules: ReturnType<typeof createCriterionRuleRegistry>
}) {
  const { authority, business, rules } = input
  const host = authority.host
  const resolve = rules.resolve, evaluate = rules.evaluate
  const rulesCurrent = () => input.authority === authority && input.business === business &&
    authority.host === host && business.host === host && input.rules === rules && rules.resolve === resolve && rules.evaluate === evaluate
  const observe = business.createPlannerCriteriaObservation({
    current: rulesCurrent,
    resolve: async (caseRef, ids, call) => {
      if (!rulesCurrent()) return undefined
      const values: CriterionRule[] = []
      for (const criterionId of ids) {
        // This original reader independently authorizes cases and preferences,
        // verifies all rule evidence, and repeats its live authority checks.
        const rule = await resolve({ caseRef, criterionId }, call)
        if (!rulesCurrent() || rule.status !== "ok") return undefined
        values.push(rule.value)
      }
      return values
    },
  })
  const unavailable = () => ({ status: "unavailable" as const, reason: "portfolio-comparison-observation-changed" })
  const scenarios = <Value>(request: ScenarioCompareRequest, call: TrustedDomainContext,
    work: () => Promise<PortResult<Value>>): Promise<PortResult<Value>> =>
    Array.isArray(request.criteria) && request.criteria.length ? observe(request, call, work) : work()

  const alternatives = async (incoming: Parameters<Compare>[0], call: TrustedDomainContext,
    work: () => ReturnType<Compare>): ReturnType<Compare> => {
    try {
      // Preserve the existing criteria-free route before any additional read.
      if (!Array.isArray(incoming.criteria) || !incoming.criteria.length || call.kind !== "ui") return work()
      const persistence = host.persistence
      const readRoot = persistence.readSnapshotRoot, snapshots = persistence.currentSnapshots
      if (!readRoot || !snapshots || snapshots.call(persistence)) return work()
      const source = host.requestFor(call)
      if (!source || source.signal.aborted || !rulesCurrent()) return unavailable()
      const request = structuredClone(incoming), requestDigest = digestSfValue(request)
      const binding = call.binding, lease = call.lease, bindingDigest = digestSfValue([call.kind, binding])
      const headers = plannerRequestIdentity(source)
      const cases = business.cases, readCase = cases.read, lookup = business.scenarioLookup
      const requestFor = host.requestFor, revalidate = host.revalidate
      const authenticate = host.authenticate, environment = host.environment
      const transaction = persistence.transaction, transactionAll = persistence.transactionAll
      const snapshotScope = persistence.currentSnapshotScope
      const current = () => rulesCurrent() && authority.host === host && host.persistence === persistence &&
        persistence.readSnapshotRoot === readRoot && persistence.currentSnapshots === snapshots &&
        persistence.transaction === transaction && persistence.transactionAll === transactionAll &&
        persistence.currentSnapshotScope === snapshotScope && host.requestFor === requestFor &&
        host.revalidate === revalidate && host.authenticate === authenticate && host.environment === environment &&
        call.binding === binding && call.lease === lease && digestSfValue([call.kind, binding]) === bindingDigest &&
        host.requestFor(call) === source && !source.signal.aborted && plannerRequestIdentity(source) === headers &&
        digestSfValue(incoming) === requestDigest && business.cases === cases && cases.read === readCase &&
        business.scenarioLookup === lookup
      const fallback = () => current() ? work() : Promise.resolve(unavailable())
      if (!current()) return unavailable()
      const decision = await readCase({ caseRef: encodeCaseRef(request.caseRef) }, call)
      if (!current()) return unavailable()
      if (decision.status !== "ok" || digestSfValue({ id: decision.value.case.id,
        incarnation: decision.value.case.incarnation, version: decision.value.case.version }) !== digestSfValue(request.caseRef))
        return fallback()
      const selected = [request.baselineAlternativeId, request.alternativeId].map((id) =>
        decision.value.case.alternatives.filter((alternative) => alternative.id === id))
      if (selected.some((matches) => matches.length !== 1) || request.baselineAlternativeId === request.alternativeId)
        return fallback()
      const scenarioRefs: string[] = []
      for (const matches of selected) {
        const alternative = matches[0]!
        const resolved = await lookup({ caseRef: request.caseRef, alternativeId: alternative.id,
          alternativeVersion: alternative.version }, call)
        if (!current()) return unavailable()
        if (resolved.status !== "ok") return fallback()
        scenarioRefs.push(resolved.value.resultRef)
      }
      if (scenarioRefs.length !== 2 || scenarioRefs[0] === scenarioRefs[1]) return fallback()
      const pair = { scenarioRefs, criteria: request.criteria }
      // Only this read-only comparator is inside the owned root. Selection,
      // analysis, result persistence and binding writes remain outside it.
      const observed = await observe(pair, call, async () => {
        if (!current()) return unavailable()
        const result = await work()
        if (!current() || (result.status === "ok" && digestSfValue(result.value.request) !== digestSfValue(pair)))
          return unavailable()
        return result
      })
      return current() ? observed : unavailable()
    } catch { return unavailable() }
  }
  return { scenarios, alternatives }
}
