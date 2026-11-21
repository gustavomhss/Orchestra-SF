import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Actor } from "../../runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainPortHost, PlannerPort, PlannerSourceHost } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { plannerMonthlyPrefix } from "./bi.ts"
import { projectPlannerSource } from "./port.ts"
import { projectionDigest } from "./scenario-comparison-port.ts"

type ObservedSelection = { valueId: string; period: { start: string; end: string }; evidenceRefs: readonly BusinessEvidenceRef[] }

/** Observations are only actual, confirmed, closed-month Planner values under current source authority. */
export function createPlannerObservedProjection(input: { host: DomainPortHost; planner: Pick<PlannerPort, "compareForecast">; sources: PlannerSourceHost }) {
  return async (selection: ObservedSelection, context: TrustedDomainContext) => {
    const request = input.host.requestFor(context)
    if (!request || request.signal.aborted || !await input.host.revalidate(context)) return undefined
    const evidence = selection.evidenceRefs.filter((ref): ref is Extract<BusinessEvidenceRef, { kind: "record" }> => ref.kind === "record" && ref.target.surface === "planner" && ref.target.recordType === "planner-version" && ref.installationId === context.binding.installationId && ref.projectId === context.binding.projectId && ref.refDigest === digestSfEvidenceRef(ref))
    if (evidence.length !== 1 || !selection.valueId.trim()) return undefined
    const source = evidence[0]!
    const start = /^(\d{4})-(\d{2})-01$/.exec(selection.period.start)
    const end = /^(\d{4})-(\d{2})-(\d{2})$/.exec(selection.period.end)
    if (!start || !end || start[1] !== end[1] || start[2] !== end[2] || Number(start[2]) < 1 || Number(start[2]) > 12 || Number(end[3]) !== new Date(Date.UTC(Number(end[1]), Number(end[2]), 0)).getUTCDate() || !source.target.period || source.target.period.start > selection.period.start || source.target.period.end < selection.period.end) return undefined
    const environment = await input.host.environment(request)
    const cutoff = `${selection.period.end}T23:59:59.999Z`
    if (!Number.isFinite(Date.parse(environment.at)) || Date.parse(environment.at) < Date.parse(cutoff)) return undefined
    const read = () => input.host.persistence.transaction("planner", async (snapshot) => {
      const principal = await input.host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
      if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: undefined }
      const roles = principal.roles.filter((role) => role.surface === "planner").map((role) => role.role)
      const access = object(object(snapshot.data.access)[principal.id])
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
      const projection = projectPlannerSource(snapshot, actor, source.target.recordId)
      if (!projection || digestSfValue({ versionId: source.target.recordId, projection }) !== source.target.projectionDigest || projection.year !== Number(start[1]) || typeof projection.closed !== "number" || projection.closed < Number(start[2])) return { commit: false, value: undefined }
      return { commit: false, value: { digest: digestSfValue(projection), closed: projection.closed } }
    }, { signal: request.signal }).catch(() => undefined)
    const first = await read()
    if (!first) return undefined
    const current = await input.sources.resolveForecastSource(source.refId, context)
    if (current.status !== "ok" || current.value.evidence.refDigest !== source.refDigest) return undefined
    const compare = () => input.planner.compareForecast({ baseRef: source.refId, candidateRef: source.refId, period: selection.period, currency: "USD" }, context)
    const result = await compare()
    if (result.status !== "ok") return undefined
    const projection = result.value.baseline
    const monthlyId = `${plannerMonthlyPrefix(projection.components)}:${Number(start[2])}:actual`
    if (selection.valueId !== monthlyId && !selection.valueId.endsWith(`:${Number(start[2])}:actual-usd`)) return undefined
    const values = projection.values.filter((value) => value.id === selection.valueId)
    const value = values[0]
    if (values.length !== 1 || !value || value.evidenceState !== "confirmed" || value.currency !== "USD" || typeof value.value !== "number" || !Number.isFinite(value.value) || digestSfValue(value.period) !== digestSfValue(selection.period) || !value.sourceRefs.some((ref) => ref.refDigest === source.refDigest)) return undefined
    const latest = await compare()
    const sourceAgain = await input.sources.resolveForecastSource(source.refId, context)
    const again = await read()
    if (latest.status !== "ok" || projectionDigest(latest.value.baseline) !== projectionDigest(projection) || sourceAgain.status !== "ok" || sourceAgain.value.evidence.refDigest !== source.refDigest || digestSfValue(again) !== digestSfValue(first) || request.signal.aborted || !await input.host.revalidate(context)) return undefined
    return { projection: { ...projection, values: projection.values.map((entry) => entry.id === value.id ? { ...entry, unit: "USD" } : entry) }, unit: "USD", cutoff, coverage: "complete" as const, limitations: ["Coverage applies only to this confirmed closed-month actual, not to decision-wide cost coverage."] }
  }
}
