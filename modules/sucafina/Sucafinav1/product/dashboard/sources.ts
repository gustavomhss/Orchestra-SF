import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Actor } from "../../runtime/contract.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { SfScopedSourcePort } from "../integration/source-lifecycle.ts"
import type { DashboardSourceHost } from "./port.ts"

export function dashboardSourceSelector(incarnation: string, version: number) {
  return `sf-source:${encodeURIComponent(incarnation)}:${version}`
}

export function dashboardMetricSelector(selectionRef: string, metric: string) {
  return `dashboard-metric:${encodeURIComponent(selectionRef)}:${encodeURIComponent(metric)}`
}

export function createDashboardSourceHost(input: { host: DomainPortHost; scopedSources: SfScopedSourcePort }): DashboardSourceHost {
  const host = input.host
  const sources: DashboardSourceHost = {
    resolveDashboardSource: async (reference, context, selection): Promise<PortResult<{ page: string; evidence: Extract<BusinessEvidenceRef, { kind: "record" }> }>> => {
      const parts = /^sf-source:([^:]+):([1-9]\d*)$/.exec(reference)
      const incarnation = parts && safeDecode(parts[1]!)
      if (!incarnation || encodeURIComponent(incarnation) !== parts?.[1] || !Number.isSafeInteger(Number(parts[2]))) return { status: "needs-input", reason: "invalid-dashboard-source-selector" }
      const request = host.requestFor(context)
      if (!request || !(await host.revalidate(context))) return { status: "denied", reason: "source-authority-unavailable" }
      const read = () => input.scopedSources.resolveScopedSource("dashboard", incarnation, async (snapshot, scope) => {
        if (request.signal.aborted || scope.principalRef !== context.binding.principalRef || scope.accessRevision !== context.binding.accessRevision || scope.policyVersion !== context.binding.policyVersion || scope.recordType !== "dashboard-page") return false
        const principal = await host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
        if (!principal || principal.id !== scope.principalRef || principal.id.startsWith("local:")) return false
        const access = object(object(snapshot.data.access)[principal.id])
        const roles = principal.roles.filter((entry) => entry.surface === "dashboard").map((entry) => entry.role)
        const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
        const selector = object(scope.selector)
        if (scope.recordId !== selector.page || digestSfValue(selector.actor) !== digestSfValue(actor)) return false
        if (selection && (digestSfValue(selector.fields) !== digestSfValue([...selection.fields].sort()) || digestSfValue(selector.period) !== digestSfValue(selection.period))) return false
        return true
      })
      const current = await read().catch(() => undefined)
      if (!current || !(await host.revalidate(context))) return { status: "denied", reason: "source-unavailable" }
      if (current.version !== Number(parts[2])) return { status: "stale", reason: "source-replaced-or-changed" }
      const selector = object(current.scope.selector)
      const period = object(selector.period)
      if (typeof selector.page !== "string" || !Array.isArray(selector.fields) || selector.fields.some((field) => typeof field !== "string") || typeof period.start !== "string" || typeof period.end !== "string") return { status: "unavailable", reason: "invalid-source-scope" }
      const value: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", refId: reference, installationId: context.binding.installationId, projectId: context.binding.projectId, refDigest: "", evidenceLevel: "observed", target: { surface: "dashboard", recordType: "dashboard-page", recordId: selector.page, incarnation, version: current.version, fields: selector.fields, period: { start: period.start, end: period.end }, projectionDigest: current.inputDigest } }
      const again = await read().catch(() => undefined)
      if (!again || digestSfValue(again) !== digestSfValue(current) || !(await host.revalidate(context))) return { status: "stale", reason: "source-or-authority-changed" }
      return { status: "ok", value: { page: selector.page, evidence: { ...value, refDigest: digestSfEvidenceRef(value) } } }
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
