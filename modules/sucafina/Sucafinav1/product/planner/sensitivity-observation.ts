import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { comparePlannerPreview } from "./preview-comparison.ts"
import type { createPlannerSensitivityUnits } from "./sensitivity-units.ts"

export type PlannerReadObservation = <Value>(request: unknown, context: TrustedDomainContext,
  work: () => Promise<PortResult<Value>>) => Promise<PortResult<Value>>

type Units = ReturnType<typeof createPlannerSensitivityUnits>
type Preview = (request: Parameters<typeof comparePlannerPreview>[1], context: TrustedDomainContext) => ReturnType<typeof comparePlannerPreview>

/** Scope only complete read-only producers. Each later invocation starts afresh;
 * sample persistence and proof publication remain outside these observations. */
export function observePlannerSensitivity(input: { units: Units; preview: Preview; observe?: PlannerReadObservation }) {
  const observe: PlannerReadObservation = (request, context, work) =>
    input.observe ? input.observe(request, context, work) : work()
  const units: Units = {
    issue: (request, context) => observe(request, context, () => input.units.issue(request, context)),
    resolve: (request, context) => observe(request, context, () => input.units.resolve(request, context)),
    revalidate: async (binding, context) => {
      const result = await observe(binding, context, async () =>
        ({ status: "ok" as const, value: await input.units.revalidate(binding, context) }))
      return result.status === "ok" && result.value
    },
  }
  const preview: Preview = (request, context) => observe(request, context, () => input.preview(request, context))
  return { units, preview }
}
