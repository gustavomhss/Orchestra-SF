import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { SensitivityRequest } from "../../../../product/contracts/operations.ts"
import { createPlannerSensitivityUnits } from "../../../../product/planner/sensitivity-units.ts"
import { createPlannerExactThreshold } from "../../../../product/planner/exact-threshold.ts"
import { comparePlannerPreview } from "../../../../product/planner/preview-comparison.ts"
import { createSfPlannerObservationBatch } from "../../../../../../../apps/cli/src/sucafina-product/planner-observation-batch.ts"
import { sfPlannerCaseReadAdmission } from "../../../../../../../apps/cli/src/sucafina-product/planner-case-read-batch.ts"
import { plannerObservationFixture, observePlannerPhase } from "./planner-observation-batch-fixture.ts"
import type { compositionTestDeadline } from "./composition-test-deadline.ts"

export async function sensitivityObservationFixture(deadline: ReturnType<typeof compositionTestDeadline>, options: { sourceOnly?: boolean; sharedBase?: boolean } = {}) {
  const fixture = await plannerObservationFixture(deadline, false, options)
  const units = createPlannerSensitivityUnits({ host: fixture.business.host, cases: fixture.business.cases,
    scenarios: fixture.scenarios, store: fixture.business.results, evidence: fixture.business.context, rules: fixture.portfolio.rules })
  const selection = { scenarioRef: fixture.request.scenarioRef, baselineRef: fixture.request.baselineRef, parameterRef: "line:1" }
  const issued = await deadline.phase("fixture.sensitivity-units", () =>
    fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
      fixture.business.withPlannerObservation(selection, fixture.call, () => units.issue(selection, fixture.call))))
  if (issued.status !== "ok") throw new Error("Actual sensitivity units unavailable: " + issued.reason)
  const rule = { caseRef: fixture.caseRef, criterionId: "cost", metricRef: "planner:known-subtotal-difference", operator: "lte" as const,
    value: 0, unit: "USD", period: fixture.period, evidenceRefs: fixture.sources, expectedRuleVersion: 1, sensitivity: issued.value.units }
  const human = await fixture.authority.human.admit(fixture.stateRequest(), "decisions.criteria", rule)
  if (human.status !== "ok") throw new Error("Actual sensitivity rule admission unavailable")
  const registered = await deadline.phase("fixture.sensitivity-rule", () =>
    fixture.business.withCase(human.value, fixture.caseRef, {}, () => fixture.portfolio.rules.register(rule, human.value)))
    .finally(() => fixture.authority.human.finish(human.value))
  if (registered.status !== "ok") throw new Error("Actual sensitivity rule registration unavailable: " + registered.reason)
  const request: SensitivityRequest = { scenarioRef: selection.scenarioRef,
    parameterBounds: { parameterRef: selection.parameterRef, minimum: 80, maximum: 400, steps: 2 },
    criterion: { id: "cost", operator: "lte", value: 0 } }
  const resolved = await deadline.phase("fixture.sensitivity-binding", () =>
    fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
      fixture.business.withPlannerObservation(request, fixture.call, () => units.resolve(request, fixture.call))))
  if (resolved.status !== "ok") throw new Error("Actual sensitivity binding unavailable: " + resolved.reason)
  const binding = resolved.value
  const preview = (incoming: Parameters<typeof comparePlannerPreview>[1]) => comparePlannerPreview({
    host: fixture.business.host, sources: fixture.business.plannerSources, scenarios: fixture.scenarios, planner: fixture.portfolio.planner,
  }, incoming, fixture.call)
  const exact = createPlannerExactThreshold({ units, preview: (incoming) => preview(incoming) })
  const operations = issued.value.scenario.operations.length ? issued.value.scenario.operations : issued.value.parameterOperation ? [issued.value.parameterOperation] : []
  if (!operations.length) throw new Error("Actual parameter operation unavailable")
  const previewRequest = { baselineRef: selection.baselineRef, scenario: { ...issued.value.scenario,
    operations: operations.map((operation) => operation.targetRef === selection.parameterRef ? { ...operation, amount: 240 } : operation) } }
  const observation = observePlannerPhase(fixture, deadline)
  const input = { host: observation.host, state: fixture.authority.state, sources: fixture.business.plannerSources,
    readerIdentity: () => fixture.business.evidence.current, lockedSourceFences: fixture.business.lockedSourceFences }
  const observe = createSfPlannerObservationBatch({ ...input, admissions: [sfPlannerCaseReadAdmission(input)],
    readerIdentities: () => [units, preview, exact, ...[units, fixture.scenarios, fixture.business.plannerSources,
      fixture.business.results, fixture.business.cases, fixture.business.context, fixture.portfolio.rules]
      .flatMap((reader) => [reader, ...Object.entries(reader).flatMap(([key, value]) => [key, value])])] })
  const phase = (incoming: unknown) => ({ kind: "comparison" as const, caseRef: fixture.caseRef, request: incoming })
  const canonical = <Value>(incoming: unknown, work: () => Promise<PortResult<Value>>) =>
    fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
      fixture.business.withScenarioObservation({ caseRef: fixture.caseRef, request: incoming }, fixture.call, work))
  return { fixture, units, selection, issued: issued.value, request, binding, preview, previewRequest, exact, observation, observe, phase, canonical,
    cases: [
      { name: "units", incoming: selection, work: () => units.issue(selection, fixture.call) },
      { name: "resolve", incoming: request, work: () => units.resolve(request, fixture.call) },
      { name: "revalidate", incoming: binding, work: async () => ({ status: "ok" as const, value: await units.revalidate(binding, fixture.call) }) },
      { name: "preview", incoming: previewRequest, work: () => preview(previewRequest) },
      { name: "exact", incoming: { request, baselineRef: selection.baselineRef }, work: () => exact(request, selection.baselineRef, fixture.call) },
      { name: "bound-exact", incoming: { request, binding }, work: () => exact(request, binding.baselineRef, fixture.call) },
    ],
    inputDigest: () => digestSfValue({ selection, request, binding, previewRequest }),
  }
}
