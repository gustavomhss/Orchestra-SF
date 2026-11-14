import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { ScenarioRequest } from "../../../product/contracts/operations.ts"
import type { DomainPortHost, PlannerSourceHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { decodeSfOperationInput } from "../../../product/contracts/schema-admission.ts"
import { createPlannerOperationVerifier } from "../../../product/planner/operation-verifier.ts"
import { createPlannerPort } from "../../../product/planner/port.ts"
import { createPlannerScenarioInputs } from "../../../product/planner/scenario-inputs.ts"
import type { createWp11FixtureTrace } from "./fixture-trace.ts"

/** Source-only alternatives have no operation targets to execute in a copied
 * snapshot. Observe their canonical source/projection under current authority;
 * every nonempty operation/assumption scenario retains the complete verifier.
 * No financial result or authority observation is memoized between calls.
 */
export function createRenewalOperationVerifier(host: DomainPortHost, sources: PlannerSourceHost, trace?: ReturnType<typeof createWp11FixtureTrace>) {
  const planner = createPlannerPort({ host, sources })
  const verify = createPlannerOperationVerifier({ host, planner, sources, scenarioInputs: createPlannerScenarioInputs({ planner, sources }) })
  const measure = <T>(label: string, work: () => Promise<T>) => trace ? trace.measure(label, work) : work()
  return async (incoming: ScenarioRequest, context: TrustedDomainContext) => {
    const parsed = decodeSfOperationInput("sf_scenario_simulate", incoming)
    if (!parsed.ok) return false
    if (parsed.value.operations.length || parsed.value.assumptions.length) return measure("planner.verifyOperation", () => verify(parsed.value, context))
    return measure("planner.verifySourceOnly", async () => {
      const request = host.requestFor(context)
      if (!request || request.signal.aborted || !await host.revalidate(context)) return false
      const source = structuredClone(await sources.resolveForecastSource(parsed.value.baseRef, context))
      if (source.status !== "ok" || !source.value.evidence.target.period) return false
      // This real producer re-observes the actor, source scope, projection and
      // coverage at ingress/egress. Its monetary output is not supplied by us.
      const observed = await planner.compareForecast({ baseRef: parsed.value.baseRef, candidateRef: parsed.value.baseRef, period: source.value.evidence.target.period, currency: "USD" }, context)
      const again = await sources.resolveForecastSource(parsed.value.baseRef, context)
      return observed.status === "ok" && observed.value.sourceRefs.some((ref) => digestSfValue(ref) === digestSfValue(source.value.evidence)) && again.status === "ok" && digestSfValue(again.value) === digestSfValue(source.value) && !request.signal.aborted && await host.revalidate(context)
    })
  }
}
