import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Actor } from "../../runtime/contract.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import { sfSourceIdentity } from "../integration/source-lifecycle.ts"
import { projectDashboardSource } from "./port.ts"
import type { DashboardSourceHost } from "./port.ts"

export function dashboardSourceSelector(page: string, incarnation: string, version: number, year: number) {
  return `dashboard-page:${encodeURIComponent(page)}:${encodeURIComponent(incarnation)}:${version}:${year}`
}

export function dashboardMetricSelector(selectionRef: string, metric: string) {
  return `dashboard-metric:${encodeURIComponent(selectionRef)}:${encodeURIComponent(metric)}`
}

export function createDashboardSourceHost(host: DomainPortHost): DashboardSourceHost {
  const sources: DashboardSourceHost = {
    resolveDashboardSource: async (reference, context): Promise<PortResult<{ page: string; evidence: Extract<BusinessEvidenceRef, { kind: "record" }> }>> => {
      const parts = /^dashboard-page:([^:]+):([^:]+):([1-9]\d*):(202[4-7])$/.exec(reference)
      if (!parts) return { status: "needs-input", reason: "invalid-dashboard-source-selector" }
      const page = safeDecode(parts[1]!)
      const incarnation = safeDecode(parts[2]!)
      if (!page || !incarnation || encodeURIComponent(page) !== parts[1] || encodeURIComponent(incarnation) !== parts[2] || !Number.isSafeInteger(Number(parts[3]))) return { status: "needs-input", reason: "invalid-dashboard-source-selector" }
      const request = host.requestFor(context)
      if (!request || !(await host.revalidate(context))) return { status: "denied", reason: "source-authority-unavailable" }
      const environment = await host.environment(request)
      const read = () => host.persistence.transaction("dashboard", async (snapshot) => {
        const principal = await host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
        if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: undefined }
        const access = object(object(snapshot.data.access)[principal.id])
        const roles = principal.roles.filter((entry) => entry.surface === "dashboard").map((entry) => entry.role)
        const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
        const auditStart = snapshot.audit.length
        const projection = projectDashboardSource(snapshot, actor, environment, page)
        if (!projection) return { commit: false, value: undefined }
        const identity = sfSourceIdentity(snapshot, "dashboard-page", page)
        if (!identity) return { commit: false, value: undefined }
        return { commit: snapshot.audit.length > auditStart, value: { projection, identity } }
      }, { signal: request.signal })
      const current = await read().catch(() => undefined)
      if (!current) return { status: "denied", reason: "source-unavailable" }
      if (current.identity.incarnation !== incarnation || current.identity.version !== Number(parts[3])) return { status: "stale", reason: "source-replaced-or-changed" }
      const year = Number(parts[4])
      const value: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", refId: reference, installationId: context.binding.installationId, projectId: context.binding.projectId, refDigest: "", evidenceLevel: "observed", target: { surface: "dashboard", recordType: "dashboard-page", recordId: page, incarnation, version: current.identity.version, fields: Object.keys(current.projection), period: { start: `${year}-01-01`, end: `${year}-12-31` }, projectionDigest: digestSfValue({ page, projection: current.projection }) } }
      const again = await read().catch(() => undefined)
      if (!again || digestSfValue(again) !== digestSfValue(current) || !(await host.revalidate(context))) return { status: "stale", reason: "source-or-authority-changed" }
      return { status: "ok", value: { page, evidence: { ...value, refDigest: digestSfEvidenceRef(value) } } }
    },
    resolveDashboardMetric: async (reference, context) => {
      const parts = /^dashboard-metric:([^:]+):([^:]+)$/.exec(reference)
      const selectionRef = parts && safeDecode(parts[1]!)
      const metric = parts && safeDecode(parts[2]!)
      if (!selectionRef || !metric || encodeURIComponent(selectionRef) !== parts?.[1] || encodeURIComponent(metric) !== parts?.[2]) return { status: "needs-input", reason: "invalid-dashboard-metric-selector" }
      const result = await sources.resolveDashboardSource(selectionRef, context)
      if (result.status !== "ok") return result
      if (!result.value.evidence.target.period) return { status: "unavailable", reason: "metric-period-unavailable" }
      const year = result.value.evidence.target.period.start.slice(0, 4)
      if (metric === "total-budget" && ["Budget Overview", "Executive Dashboard"].includes(result.value.page)) return { status: "ok", value: { selectionRef, field: "budgetMetrics", valuePrefix: `budgetMetrics.${year}.totalBudget` } }
      const monthly = /^(opened|closed|netChange|backlog):(0[1-9]|1[0-2])$/.exec(metric)
      if (monthly && result.value.page === "Executive Dashboard") return { status: "ok", value: { selectionRef, field: "executiveMonths", valuePrefix: `executiveMonths.${year}:${Number(monthly[2])}.${monthly[1]}` } }
      if (metric === "active-headcount" && result.value.page === "Executive Dashboard") return { status: "ok", value: { selectionRef, field: "executive", valuePrefix: "executive.active" } }
      return { status: "unavailable", reason: "metric-not-available-for-page" }
    },
  }
  return sources
}

function safeDecode(value: string) {
  try { return decodeURIComponent(value) } catch { return undefined }
}
