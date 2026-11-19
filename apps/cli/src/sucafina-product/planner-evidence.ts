import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DomainProjection } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { DomainPortHost, PlannerSourceHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { buildPlannerFinancialProjection, projectPlannerSource } from "../../../../modules/sucafina/Sucafinav1/product/planner/port.ts"
import type { createSfPlannerSourceHost } from "../../../../modules/sucafina/Sucafinav1/product/integration/planner-sources.ts"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"

/** Project the current source without asking coverage to authorize its own evidence recursively. */
export function createSfPlannerEvidence(input: { host: DomainPortHost; sources: PlannerSourceHost;
  readSourceProjection?: ReturnType<typeof createSfPlannerSourceHost>["readProjection"] }) {
  type Source = Extract<Awaited<ReturnType<PlannerSourceHost["resolveForecastSource"]>>, { status: "ok" }>["value"]
  type Selected = { period: { start: string; end: string }; currency: "USD" }
  const canonicalProjection = async (reference: string, call: TrustedDomainContext, selected?: Selected,
    expected?: Extract<BusinessEvidenceRef, { kind: "record" }>): Promise<PortResult<{ source: Source; projection: DomainProjection }>> => {
    const captured = structuredClone({ reference, selected, expected })
    const capturedDigest = digestSfValue(captured)
    const request = input.host.requestFor(call), lease = call.lease
    const binding = digestSfValue([call.kind, call.binding])
    const requestDigest = request && digestSfValue({ method: request.method, url: request.url, headers: [...request.headers] })
    const current = () => !!request && !request.signal.aborted && input.host.requestFor(call) === request && call.lease === lease &&
      digestSfValue([call.kind, call.binding]) === binding && digestSfValue({ reference, selected, expected }) === capturedDigest &&
      digestSfValue({ method: request.method, url: request.url, headers: [...request.headers] }) === requestDigest
    if (!current() || call.binding.principalRef.startsWith("local:") || !input.readSourceProjection) return { status: "denied", reason: "planner-source-authority-unavailable" }
    // This is the real source producer's final body after its independent
    // source/actor observations, never a caller supplied or retained projection.
    const environment = await input.host.environment(request!)
    if (!current()) return { status: "stale", reason: "planner-source-changed" }
    const observed = await input.readSourceProjection(captured.reference, call)
    if (!current()) return { status: "stale", reason: "planner-source-changed" }
    if (observed.status !== "ok") return observed
    const { projection, ...source } = observed.value
    const ref = source.evidence
    if (ref.target.surface !== "planner" || ref.target.recordType !== "planner-version" || !ref.target.period ||
      captured.expected && digestSfValue(ref) !== digestSfValue(captured.expected))
      return { status: "stale", reason: "planner-source-changed" }
    const period = captured.selected?.period ?? ref.target.period
    if (ref.target.period.start > period.start || ref.target.period.end < period.end || captured.selected && captured.selected.currency !== "USD")
      return { status: "needs-input", reason: "planner-source-period-or-currency-mismatch" }
    const start = /^(\d{4})-(\d{2})-01$/.exec(period.start), end = /^(\d{4})-(\d{2})-(\d{2})$/.exec(period.end)
    if (!start || !end || start[1] !== end[1] || Number(start[2]) < 1 || Number(end[2]) > 12 || Number(start[2]) > Number(end[2]) ||
      Number(end[3]) !== new Date(Date.UTC(Number(end[1]), Number(end[2]), 0)).getUTCDate())
      return { status: "needs-input", reason: "period-must-cover-whole-months-in-one-year" }
    if (digestSfValue(Object.keys(projection).sort()) !== digestSfValue([...ref.target.fields].sort()) ||
      digestSfValue({ versionId: source.versionId, projection }) !== ref.target.projectionDigest || projection.year !== Number(period.start.slice(0, 4)))
      return { status: "stale", reason: "planner-source-changed" }
    return { status: "ok", value: { source, projection: buildPlannerFinancialProjection({ projection, ref, period, binding: call, at: environment.at }) } }
  }
  const project = async (ref: Extract<BusinessEvidenceRef, { kind: "record" }>, call: TrustedDomainContext, selected?: { period: { start: string; end: string }; currency: "USD" }): Promise<PortResult<DomainProjection>> => {
    if (input.readSourceProjection) {
      const observed = await canonicalProjection(ref.refId, call, selected, ref)
      return observed.status === "ok" ? { status: "ok", value: observed.value.projection } : observed
    }
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
  const readSource = async (reference: string, call: TrustedDomainContext, selected: Selected): Promise<PortResult<{ source: Source; projection: DomainProjection }>> => {
    if (input.readSourceProjection) return canonicalProjection(reference, call, selected)
    const source = await input.sources.resolveForecastSource(reference, call)
    if (source.status !== "ok") return source
    const projection = await project(source.value.evidence, call, selected)
    if (projection.status !== "ok") return projection
    const again = await input.sources.resolveForecastSource(reference, call)
    if (again.status !== "ok" || digestSfValue(again.value.evidence) !== digestSfValue(source.value.evidence) || !await input.host.revalidate(call))
      return { status: "stale", reason: "planner-source-changed" }
    return { status: "ok", value: { source: source.value, projection: projection.value } }
  }
  return Object.assign(project, { readEvidence, readSource })
}
