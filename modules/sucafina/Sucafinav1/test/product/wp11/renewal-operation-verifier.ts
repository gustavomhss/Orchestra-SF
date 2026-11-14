import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { ScenarioRequest } from "../../../product/contracts/operations.ts"
import type { DomainPortHost, PlannerSourceHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { decodeSfOperationInput } from "../../../product/contracts/schema-admission.ts"
import { createPlannerOperationVerifier } from "../../../product/planner/operation-verifier.ts"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { createPlannerScenarioInputs } from "../../../product/planner/scenario-inputs.ts"
import { roleMap } from "../../../runtime/admin.ts"
import { object, type Actor } from "../../../runtime/contract.ts"
import type { createWp11FixtureTrace } from "./fixture-trace.ts"

/** Source-only alternatives have no operation targets to execute in a copied
 * snapshot. Observe their canonical source/projection under current authority;
 * every nonempty operation/assumption scenario retains the complete verifier.
 * This fixture guard returns only admission, never a financial observation or
 * C10 assessment. No result or authority observation is memoized between calls.
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
      const bindingDigest = digestSfValue(context.binding)
      const source = structuredClone(await sources.resolveForecastSource(parsed.value.baseRef, context))
      if (source.status !== "ok" || !source.value.evidence.target.period) return false
      const selected = source.value, ref = selected.evidence, period = ref.target.period
      if (!period || ref.kind !== "record" || ref.schema !== "sf-evidence-v1" || ref.refId !== parsed.value.baseRef ||
        ref.refDigest !== digestSfEvidenceRef(ref) || ref.installationId !== context.binding.installationId ||
        ref.projectId !== context.binding.projectId || ref.target.surface !== "planner" ||
        ref.target.recordType !== "planner-version" || ref.target.recordId !== selected.versionId) return false
      const start = /^(\d{4})-(\d{2})-01$/.exec(period.start)
      const end = /^(\d{4})-(\d{2})-(\d{2})$/.exec(period.end)
      if (!start || !end || start[1] !== end[1] || Number(start[2]) < 1 || Number(end[2]) > 12 || Number(start[2]) > Number(end[2]) ||
        Number(end[3]) !== new Date(Date.UTC(Number(end[1]), Number(end[2]), 0)).getUTCDate()) return false
      const sourceYear = Number(start[1])
      // Reuse the canonical actor-filtered Planner projector in two fresh real
      // snapshots. Resolving a synthetic fixture reference twice alone would
      // miss a source edit because the original reference array is immutable.
      const observe = (final = false) => measure("planner.verifySourceProjection", () => host.persistence.transaction("planner", async (snapshot) => {
        const principal = await host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
        if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:") || request.signal.aborted) return { commit: false, value: false }
        // Authentication is asynchronous too: its last observation may revoke
        // the private lease. Fence that callback before the final projection,
        // while retaining the external source-CAS fence before this transaction.
        if (final && (!await host.revalidate(context) || request.signal.aborted || host.requestFor(context) !== request ||
          digestSfValue(context.binding) !== bindingDigest)) return { commit: false, value: false }
        const roles = principal.roles.filter((entry) => entry.surface === "planner").map((entry) => entry.role)
        const access = object(object(snapshot.data.access)[principal.id])
        const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
          assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [],
          domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
        const projection = projectPlannerSource(snapshot, actor, selected.versionId)
        return { commit: false, value: !!projection && projection.year === sourceYear &&
          digestSfValue(Object.keys(projection).sort()) === digestSfValue([...ref.target.fields].sort()) &&
          digestSfValue({ versionId: selected.versionId, projection }) === ref.target.projectionDigest }
      }, { signal: request.signal }).catch(() => false))
      if (!await observe()) return false
      const again = structuredClone(await sources.resolveForecastSource(parsed.value.baseRef, context))
      if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(selected) || !await host.revalidate(context) ||
        request.signal.aborted || host.requestFor(context) !== request || digestSfValue(context.binding) !== bindingDigest) return false
      // The last source callback precedes the final authenticated snapshot;
      // its final lease check precedes projection. No callback runs afterward.
      const latest = await observe(true)
      return latest && !request.signal.aborted && host.requestFor(context) === request && digestSfValue(context.binding) === bindingDigest
    })
  }
}
