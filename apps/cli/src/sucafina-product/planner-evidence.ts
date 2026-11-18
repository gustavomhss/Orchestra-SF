import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DomainProjection } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { DomainPortHost, PlannerSourceHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { buildPlannerFinancialProjection, projectPlannerSource } from "../../../../modules/sucafina/Sucafinav1/product/planner/port.ts"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { SfPlannerSourceProjector } from "../../../../modules/sucafina/Sucafinav1/product/integration/planner-sources.ts"

/** Project the current source without asking coverage to authorize its own evidence recursively. */
export function createSfPlannerEvidence(input: { host: DomainPortHost; sources: PlannerSourceHost & { projectForecastSource?: SfPlannerSourceProjector } }) {
  const project = async (ref: Extract<BusinessEvidenceRef, { kind: "record" }>, call: TrustedDomainContext, selected?: { period: { start: string; end: string }; currency: "USD" }): Promise<PortResult<DomainProjection>> => {
    const request = input.host.requestFor(call)
    if (!request || call.binding.principalRef.startsWith("local:") || ref.target.surface !== "planner" || ref.target.recordType !== "planner-version" || !ref.target.period || !await input.host.revalidate(call))
      return { status: "denied", reason: "planner-source-authority-unavailable" }
    const prepare = async (evidence: typeof ref): Promise<PortResult<{ period: { start: string; end: string }; at: string }>> => {
      if (digestSfValue(evidence) !== digestSfValue(ref)) return { status: "stale", reason: "planner-source-changed" }
      const period = selected?.period ?? ref.target.period!
      if (ref.target.period!.start > period.start || ref.target.period!.end < period.end || selected && selected.currency !== "USD")
        return { status: "needs-input", reason: "planner-source-period-or-currency-mismatch" }
      const start = /^(\d{4})-(\d{2})-01$/.exec(period.start), end = /^(\d{4})-(\d{2})-(\d{2})$/.exec(period.end)
      if (!start || !end || start[1] !== end[1] || Number(start[2]) < 1 || Number(end[2]) > 12 || Number(start[2]) > Number(end[2]) ||
        Number(end[3]) !== new Date(Date.UTC(Number(end[1]), Number(end[2]), 0)).getUTCDate()) return { status: "needs-input", reason: "period-must-cover-whole-months-in-one-year" }
      const environment = await input.host.environment(request)
      return { status: "ok", value: { period, at: environment.at } }
    }
    const build = (projection: Record<string, unknown> | undefined, prepared: { period: { start: string; end: string }; at: string }): PortResult<DomainProjection> => {
      if (!projection || digestSfValue(Object.keys(projection).sort()) !== digestSfValue([...ref.target.fields].sort()) ||
        digestSfValue({ versionId: ref.target.recordId, projection }) !== ref.target.projectionDigest || projection.year !== Number(prepared.period.start.slice(0, 4)))
        return { status: "stale", reason: "planner-source-changed" }
      return { status: "ok", value: buildPlannerFinancialProjection({ projection, ref, period: prepared.period, binding: call, at: prepared.at }) }
    }
    if (input.sources.projectForecastSource) return input.sources.projectForecastSource(ref.refId, call, async (source) => {
      const prepared = await prepare(source.evidence)
      // The source host reopens this exact granular projection after this
      // callback, including changes while environment was awaited above.
      return prepared.status === "ok" ? build(source.projection, prepared.value) : prepared
    })
    // Noncomposed source hosts retain their complete envelope/projection path.
    const first = await input.sources.resolveForecastSource(ref.refId, call)
    if (first.status !== "ok") return first
    const prepared = await prepare(first.value.evidence)
    if (prepared.status !== "ok") return prepared
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
    const result = build(projection, prepared.value)
    if (result.status !== "ok") return result
    const latest = await read(), second = await input.sources.resolveForecastSource(ref.refId, call)
    if (!latest || digestSfValue(latest) !== digestSfValue(projection) || second.status !== "ok" || digestSfValue(second.value.evidence) !== digestSfValue(ref) ||
      request.signal.aborted || !await input.host.revalidate(call)) return { status: "stale", reason: "planner-source-changed" }
    return result
  }
  // Only the host composition supplies this full reader. It retains the source and
  // projection checks above so BCS does not repeat the same source envelope.
  const readEvidence = async (ref: Extract<BusinessEvidenceRef, { kind: "record" }>, call: TrustedDomainContext): Promise<BusinessEvidenceResolution> => {
    const captured = structuredClone(ref)
    const binding = digestSfValue([call.kind, call.binding])
    const unavailable = (): BusinessEvidenceResolution => ({ state: "unavailable", ref: captured, accessRevision: call.binding.accessRevision, checkedAt: new Date().toISOString() })
    const projection = await project(captured, call)
    if (projection.status !== "ok" || digestSfValue(ref) !== digestSfValue(captured) || binding !== digestSfValue([call.kind, call.binding]) || !await input.host.revalidate(call)) return unavailable()
    return { state: "fresh", ref: captured, currentRef: captured, authorizedProjection: projection.value,
      accessRevision: call.binding.accessRevision, checkedAt: new Date().toISOString() }
  }
  return Object.assign(project, { readEvidence })
}
