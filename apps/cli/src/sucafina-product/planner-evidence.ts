import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DomainProjection } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { DomainPortHost, PlannerSourceHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { buildPlannerFinancialProjection, projectPlannerSource } from "../../../../modules/sucafina/Sucafinav1/product/planner/port.ts"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"

/** Project the current source without asking coverage to authorize its own evidence recursively. */
export function createSfPlannerEvidence(input: { host: DomainPortHost; sources: PlannerSourceHost }) {
  return async (ref: Extract<BusinessEvidenceRef, { kind: "record" }>, call: TrustedDomainContext, selected?: { period: { start: string; end: string }; currency: "USD" }): Promise<PortResult<DomainProjection>> => {
    const request = input.host.requestFor(call)
    if (!request || ref.target.surface !== "planner" || ref.target.recordType !== "planner-version" || !ref.target.period || !await input.host.revalidate(call))
      return { status: "denied", reason: "planner-source-authority-unavailable" }
    const first = await input.sources.resolveForecastSource(ref.refId, call)
    if (first.status !== "ok") return first
    if (digestSfValue(first.value.evidence) !== digestSfValue(ref)) return { status: "stale", reason: "planner-source-changed" }
    const period = selected?.period ?? ref.target.period
    if (ref.target.period.start > period.start || ref.target.period.end < period.end || selected && selected.currency !== "USD")
      return { status: "needs-input", reason: "planner-source-period-or-currency-mismatch" }
    const start = /^(\d{4})-(\d{2})-01$/.exec(period.start), end = /^(\d{4})-(\d{2})-(\d{2})$/.exec(period.end)
    if (!start || !end || start[1] !== end[1] || Number(start[2]) < 1 || Number(end[2]) > 12 || Number(start[2]) > Number(end[2]) ||
      Number(end[3]) !== new Date(Date.UTC(Number(end[1]), Number(end[2]), 0)).getUTCDate()) return { status: "needs-input", reason: "period-must-cover-whole-months-in-one-year" }
    const environment = await input.host.environment(request)
    const read = () => input.host.persistence.transaction("planner", async (snapshot) => {
      const principal = await input.host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
      if (!principal || principal.id !== call.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: undefined }
      const roles = principal.roles.filter((role) => role.surface === "planner").map((role) => role.role)
      const access = object(object(snapshot.data.access)[principal.id])
      const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
      return { commit: false, value: projectPlannerSource(snapshot, { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
        assigned: strings(access.assigned), domains: strings(access.domains) }, first.value.versionId) }
    }, { signal: request.signal })
    const projection = await read()
    if (!projection || digestSfValue(Object.keys(projection).sort()) !== digestSfValue([...ref.target.fields].sort()) ||
      digestSfValue({ versionId: ref.target.recordId, projection }) !== ref.target.projectionDigest || projection.year !== Number(period.start.slice(0, 4)))
      return { status: "stale", reason: "planner-source-changed" }
    const result = buildPlannerFinancialProjection({ projection, ref, period, binding: call, at: environment.at })
    const latest = await read(), second = await input.sources.resolveForecastSource(ref.refId, call)
    if (!latest || digestSfValue(latest) !== digestSfValue(projection) || second.status !== "ok" || digestSfValue(second.value.evidence) !== digestSfValue(ref) ||
      request.signal.aborted || !await input.host.revalidate(call)) return { status: "stale", reason: "planner-source-changed" }
    return { status: "ok", value: result }
  }
}
