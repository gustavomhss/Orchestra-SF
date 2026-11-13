import { roleMap } from "../../runtime/admin.ts"
import { object, rows } from "../../runtime/contract.ts"
import type { Actor, Environment, Snapshot } from "../../runtime/contract.ts"
import { DashboardBudget } from "../../runtime/dashboard-budget.ts"
import { budgetData } from "../../runtime/dashboard-budget.ts"
import { DashboardPeople, hotTopicView } from "../../runtime/dashboard-people.ts"
import { DashboardOperations } from "../../runtime/dashboard-operations.ts"
import { DashboardPortfolio } from "../../runtime/dashboard-portfolio.ts"
import { dashboardPages } from "../../src/nav.ts"
import { computeBudgetTotals, effectiveBudgetSeries, SECURITY_KPIS, securityKpiStatus, socClosureValue } from "../../src/dashboard-accounts.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainProjection, Period } from "../contracts/context.ts"
import type { DashboardReadRequest, KpiExplainRequest } from "../contracts/operations.ts"
import type { DashboardPort, DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { projectDashboardScope } from "./scope.ts"

const pageFields: Record<string, readonly string[]> = {
  "Executive Dashboard": ["executive", "executiveByYear", "executiveMonths", "opsDefaultMonth", "opexOwners", "opexEntries", "capexProjects", "capexEntries", "itUsersMonthly", "signals"],
  "Budget Overview": ["opexOwners", "opexEntries", "capexProjects", "capexEntries", "revenueByYear", "budgetCurrentMonth"],
  "OPEX Detail": ["opexOwners", "opexEntries", "budgetLineIds", "deviations"],
  "CAPEX Projects": ["capexProjects", "capexEntries", "budgetLineIds", "deviations"],
  "Hot Topics & Actions": ["hotTopics"],
  "Headcount Overview": ["members", "leaders", "itUsersMonthly"],
  "Team Structure": ["members", "leaders", "cio"],
  "Talent Review": ["members", "leaders"],
  "Portfolio Dashboard": ["projects"], "All Projects": ["projects"],
  "IT Operations": ["opsTickets", "opsSLA", "opsHeatmap", "opsCats", "opsHmItems"],
  "IT Security KPIs": ["secKpi", "secActions", "secIncidents", "secPhishing"],
  "IT Risks": ["risks"], "Vendor Contracts": ["contracts"], "Stakeholder Management": ["stakeholders"], "IT Performance Contract": ["itperf"],
}

export type DashboardSourceHost = {
  resolveDashboardSource: (selectionRef: string, binding: TrustedDomainContext, selection?: { fields: readonly string[]; period: Period }) => Promise<PortResult<{ page: string; evidence: Extract<BusinessEvidenceRef, { kind: "record" }> }>>
  resolveDashboardMetric: (metricRef: string, binding: TrustedDomainContext) => Promise<PortResult<{ selectionRef: string; field: string; valuePrefix: string }>>
}

// The resolver hashes exactly this actor-filtered view; no raw snapshot leaves the domain boundary.
export function projectDashboardSource(snapshot: Snapshot, actor: Actor, environment: Environment, page: string): Record<string, unknown> | undefined {
  if (!Number.isFinite(Date.parse(environment.at))) return undefined
  const utcEnvironment = { ...environment, at: new Date(environment.at).toISOString() }
  const summaries = Array.isArray(snapshot.data.summaries) ? snapshot.data.summaries.filter((x): x is string => typeof x === "string") : []
  const allowed = dashboardPages(actor, summaries)
  if (!Object.hasOwn(pageFields, page) || !allowed.includes(page)) return undefined
  if (page === "Hot Topics & Actions") return { hotTopics: hotTopicView(snapshot, actor) }
  const domains = [DashboardBudget, DashboardPeople, DashboardOperations, DashboardPortfolio]
  const selected = domains.find((domain) => (domain.pages as readonly string[]).includes(page))
  if (!selected) return undefined
  const view = selected.domain.view(snapshot, actor, utcEnvironment)
  const projection = Object.fromEntries(pageFields[page].filter((field) => Object.hasOwn(view.data, field)).map((field) => [field, view.data[field]]))
  if (page === "Executive Dashboard") {
    if (!allowed.includes("Budget Overview")) ["opexOwners", "opexEntries", "capexProjects", "capexEntries"].forEach((key) => delete projection[key])
    if (!allowed.includes("Headcount Overview")) { delete projection.executiveByYear; delete projection.itUsersMonthly }
    if (!allowed.includes("IT Operations")) delete projection.opsDefaultMonth
    if (!allowed.includes("IT Operations") && !allowed.includes("IT Security KPIs")) delete projection.executiveMonths
    if (Object.hasOwn(projection, "executiveMonths")) {
      const fields = allowed.includes("IT Operations") ? ["opened", "closed", "netChange", "backlog", "p1", "incSLA", "svcSLA", "incYtd", "svcYtd"] : []
      const operationsView = allowed.includes("IT Operations") || allowed.includes("IT Security KPIs") ? DashboardOperations.domain.view(snapshot, actor, utcEnvironment).data : {}
      const securityView = allowed.includes("IT Security KPIs") ? operationsView : {}
      const security = rows(securityView.secKpi)
      projection.executiveMonths = Object.fromEntries(Object.entries(object(projection.executiveMonths)).map(([key, value]) => {
        const [year, month] = key.split(":").map(Number)
        const entries = security.filter((entry) => entry.year === year && entry.month === month)
        const kpis = entries.length === 1 ? SECURITY_KPIS.map((definition) => {
          const raw = definition.key === "socClosure" ? socClosureValue(entries[0]!) : entries[0]![definition.key]
          const numeric = raw === null || raw === undefined || raw === "" ? null : Number(raw)
          const value = numeric !== null && Number.isFinite(numeric) ? numeric : null
          return { key: definition.key, value, status: securityKpiStatus(definition.better, definition.target, definition.moderate, value) }
        }) : undefined
        const directBacklog = allowed.includes("IT Operations") && rows(operationsView.opsTickets).filter((entry) => entry.year === year && entry.month === month).length === 1 ? { backlogYtd: object(value).backlogYtd } : {}
        const currentMonth = `${year}-${String(month).padStart(2, "0")}` === utcEnvironment.at.slice(0, 7)
        const incidents = currentMonth && allowed.includes("IT Security KPIs") ? { openIncidents: Array.isArray(securityView.secIncidents) ? rows(securityView.secIncidents).filter((row) => !row.contained || !row.remediated || !row.rootCause).length : null } : {}
        return [key, { ...Object.fromEntries(Object.entries(object(value)).filter(([field]) => fields.includes(field))), ...(kpis ? { kpis } : {}), ...directBacklog, ...incidents }]
      }))
    }
    const executive = object(projection.executive)
    delete executive.departures
    delete executive.monthlyDepartures
    if (!allowed.includes("Headcount Overview")) ["active", "departures", "monthlyDepartures"].forEach((key) => delete executive[key])
    if (!allowed.includes("Portfolio Dashboard")) ["pmoActive", "pmoAtRisk"].forEach((key) => delete executive[key])
    if (!allowed.includes("IT Risks")) ["activeRisks", "topRisks"].forEach((key) => delete executive[key])
    if (!allowed.includes("IT Performance Contract")) delete executive.onTarget
  }
  if (page === "Budget Overview" || (page === "Executive Dashboard" && allowed.includes("Budget Overview"))) {
    const data = budgetData(view.data)
    projection.budgetMetrics = Object.fromEntries([2024, 2025, 2026, 2027].map((year) => [year, { ...computeBudgetTotals(data, year), effectiveMonthlyBudget: effectiveBudgetSeries(data, year) }]))
  }
  return projection
}

export function createDashboardPort(input: { host: DomainPortHost; sources: DashboardSourceHost }): DashboardPort & { explain: (request: KpiExplainRequest, binding: TrustedDomainContext) => Promise<PortResult<DomainProjection>> } {
  return {
    read: (request, binding) => read(input, structuredClone(request), binding),
    explain: async (incoming, binding) => {
      const request = structuredClone(incoming)
      if (request.comparisonRef) return { status: "unavailable", reason: "dashboard-comparison-not-connected" }
      if (!(await input.host.revalidate(binding))) return { status: "denied", reason: "invalid-binding" }
      const metric = await input.sources.resolveDashboardMetric(request.metricRef, binding)
      if (metric.status !== "ok") return metric
      const result = await read(input, { selectionRef: metric.value.selectionRef, period: request.period, fields: [metric.value.field] }, binding)
      if (result.status !== "ok") return result
      const values = result.value.values.filter((value) => value.id === metric.value.valuePrefix || value.id.startsWith(`${metric.value.valuePrefix}.`) || value.id.startsWith(`${metric.value.valuePrefix}[`))
      if (!values.length) return { status: "unavailable", reason: "metric-not-found" }
      const current = await input.sources.resolveDashboardMetric(request.metricRef, binding)
      if (!(await input.host.revalidate(binding)) || current.status !== "ok" || digestSfValue(current.value) !== digestSfValue(metric.value)) return { status: "stale", reason: "metric-or-authority-changed" }
      const components = metric.value.valuePrefix.endsWith(".totalBudget") || metric.value.valuePrefix.endsWith(".effectiveMonthlyBudget") ? result.value.components : []
      return { status: "ok", value: { ...result.value, context: { ...result.value.context, capabilities: ["sf_kpi_explain"] }, components, values } }
    },
  }
}

async function read(input: { host: DomainPortHost; sources: DashboardSourceHost }, request: DashboardReadRequest, binding: TrustedDomainContext): Promise<PortResult<DomainProjection>> {
  if (!(await input.host.revalidate(binding))) return { status: "denied", reason: "invalid-binding" }
  const http = input.host.requestFor(binding)
  if (!http) return { status: "denied", reason: "missing-request" }
  if (!request.fields.length) return { status: "needs-input", reason: "fields-required" }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.period.start) || !/^\d{4}-\d{2}-\d{2}$/.test(request.period.end) || request.period.start > request.period.end || request.period.start.slice(0, 4) !== request.period.end.slice(0, 4) || [request.period.start, request.period.end].some((date) => !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date))
    return { status: "needs-input", reason: "invalid-period" }
  const year = Number(request.period.start.slice(0, 4))
  if (year < 2024 || year > 2027) return { status: "needs-input", reason: "unsupported-dashboard-year" }
  if (request.fields.some((field) => ["opsTickets", "opsSLA", "opsHeatmap", "secKpi", "itUsersMonthly", "opexEntries", "capexEntries", "executiveMonths"].includes(field)) && (request.period.start.slice(8) !== "01" || Number(request.period.end.slice(8)) !== new Date(Date.UTC(year, Number(request.period.end.slice(5, 7)), 0)).getUTCDate())) return { status: "needs-input", reason: "monthly-data-requires-full-months" }
  const source = await input.sources.resolveDashboardSource(request.selectionRef, binding, { fields: request.fields, period: request.period }).catch(() => ({ status: "unavailable" as const, reason: "source-resolver-failed" }))
  if (source.status !== "ok") return source
  const selected = structuredClone(source.value)
  const ref = selected.evidence
  if (!Object.hasOwn(pageFields, selected.page)) return { status: "needs-input", reason: "unknown-dashboard-page" }
  if (ref.refDigest !== digestSfEvidenceRef(ref) || ref.installationId !== binding.binding.installationId || ref.projectId !== binding.binding.projectId || ref.target.surface !== "dashboard" || ref.target.recordType !== "dashboard-page" || ref.target.recordId !== selected.page || !ref.target.period || ref.target.period.start > request.period.start || ref.target.period.end < request.period.end)
    return { status: "denied", reason: "source-scope-mismatch" }
  const observedEnvironment = await input.host.environment(http)
  if (!/^\d{4}-\d{2}-\d{2}T/.test(observedEnvironment.at) || !Number.isFinite(Date.parse(observedEnvironment.at))) return { status: "unavailable", reason: "observation-time-unavailable" }
  const environment = { ...observedEnvironment, at: new Date(observedEnvironment.at).toISOString() }
  const get = () => input.host.persistence.transaction("dashboard", async (snapshot) => {
    const principal = await input.host.authenticate(http, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
    if (!principal || principal.id !== binding.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: undefined }
    const roles = principal.roles.filter((entry) => entry.surface === "dashboard").map((entry) => entry.role)
    const access = object(object(snapshot.data.access)[principal.id])
    const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((x): x is string => typeof x === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((x): x is string => typeof x === "string") : [] }
    const auditStart = snapshot.audit.length
    const value = projectDashboardSource(snapshot, actor, environment, selected.page)
    const scoped = projectDashboardScope(snapshot, actor, { page: selected.page, fields: [...request.fields].sort(), period: request.period }, `${environment.at.slice(0, 10)}T00:00:00Z`)
    const summaries = Array.isArray(snapshot.data.summaries) ? snapshot.data.summaries.filter((item): item is string => typeof item === "string") : []
    const allowed = dashboardPages(actor, summaries)
    const unavailable = selected.page === "Executive Dashboard" && request.fields.includes("executiveMonths") ? [...(allowed.includes("IT Operations") && Object.entries(object(scoped?.selected.executiveMonths)).some(([, entry]) => !Object.hasOwn(object(entry), "backlogYtd")) ? ["executiveMonths.backlogYtd"] : []), ...(allowed.includes("IT Security KPIs") ? [...(environment.at.slice(0, 10) < request.period.start || environment.at.slice(0, 10) > request.period.end ? ["executiveMonths.openIncidents"] : []), ...(Object.entries(object(scoped?.selected.executiveMonths)).some(([, entry]) => !Array.isArray(object(entry).kpis)) ? ["executiveMonths.kpis"] : [])] : [])] : []
    return { commit: snapshot.audit.length > auditStart, value: value && scoped ? { projection: value, scoped, unavailable } : undefined }
  }, { signal: http.signal })
  const current = await get().catch(() => null)
  if (current === null) return { status: "unavailable", reason: "source-read-failed" }
  if (!current) return { status: "denied", reason: "source-unavailable" }
  const projection: Record<string, unknown> = { ...current.projection, ...current.scoped.selected }
  if (digestSfValue([...request.fields].sort()) !== digestSfValue([...ref.target.fields].sort()) || digestSfValue(current.scoped) !== ref.target.projectionDigest) return { status: "stale", reason: "source-changed" }
  if (request.fields.some((field) => !Object.hasOwn(projection, field))) return { status: "needs-input", reason: "field-unavailable" }
  if (request.fields.includes("budgetMetrics") && (request.period.start.slice(5) !== "01-01" || request.period.end.slice(5) !== "12-31")) return { status: "needs-input", reason: "budget-metrics-require-full-year" }
  const sourceRef = { surface: "dashboard" as const, type: ref.target.recordType, id: ref.target.recordId, incarnation: ref.target.incarnation, version: ref.target.version, fields: ref.target.fields, period: request.period, observedAt: environment.at }
  const values: DomainProjection["values"][number][] = []
  const missing: DomainProjection["missing"][number][] = [...(request.fields.includes("budgetMetrics") ? [{ field: "actual-and-forecast-coverage", reason: "unconfirmed" as const }] : []), ...current.unavailable.map((field) => ({ field, reason: "unavailable" as const }))]
  const append = (id: string, value: unknown, recordPeriod?: Period, recordGranularity?: "month" | "year") => {
    if (value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) {
      const monthly = /^budgetMetrics\.(\d{4})\.effectiveMonthlyBudget\[(\d+)\]$/.exec(id)
      const departures = /^executiveByYear\.(\d{4})\.monthlyDepartures\[(\d+)\]$/.exec(id)
      const operationMonth = /^executiveMonths\.(\d{4}):(\d{1,2})\./.exec(id)
      const annualDepartures = /^executiveByYear\.(\d{4})\.departures$/.exec(id)
      if (annualDepartures && (request.period.start.slice(5) !== "01-01" || request.period.end.slice(5) !== "12-31")) return
      const ytd = /^executiveMonths\.\d{4}:\d{1,2}\.(incYtd|svcYtd)$/.test(id)
      if (ytd && request.period.start.slice(5) !== "01-01") return
      const month = monthly ? Number(monthly[2]) + 1 : departures ? Number(departures[2]) + 1 : operationMonth ? Number(operationMonth[2]) : 0
      const year = monthly?.[1] ?? departures?.[1] ?? operationMonth?.[1]
      const current = ["members", "leaders", "cio", "projects", "risks", "contracts", "stakeholders", "itperf", "signals", "hotTopics", "executive"].some((field) => id === field || id.startsWith(`${field}.`) || id.startsWith(`${field}[`)) || /^executiveByYear\.\d{4}\.active$/.test(id) || /^executiveMonths\.\d{4}:\d{1,2}\.openIncidents$/.test(id)
      const today = environment.at.slice(0, 10)
      if (current && (today < request.period.start || today > request.period.end)) return
      if (year && month && (month < Number(request.period.start.slice(5, 7)) || month > Number(request.period.end.slice(5, 7)))) return
      const period = current ? { start: today, end: today } : annualDepartures ? { start: `${annualDepartures[1]}-01-01`, end: `${annualDepartures[1]}-12-31` } : year ? { start: ytd ? `${year}-01-01` : `${year}-${String(month).padStart(2, "0")}-01`, end: `${year}-${String(month).padStart(2, "0")}-${String(new Date(Date.UTC(Number(year), month, 0)).getUTCDate()).padStart(2, "0")}` } : current ? { start: today, end: today } : recordPeriod ?? request.period
      const currency = /^(opexEntries|capexEntries|opexOwners|capexProjects)\[.*\]\.(budget|actual|forecast)$/.test(id) ? { currency: "unspecified" } : {}
      values.push({ id, value: value as string | number | boolean | null, ...currency, ...(/\.(opened|closed|netChange|backlog)$/.test(id) && operationMonth ? { unit: "tickets" } : {}), period, granularity: current ? "record" : annualDepartures ? "year" : ytd ? "aggregate" : year ? "month" : current ? "record" : recordGranularity ?? (id.startsWith("budgetMetrics.") ? "year" : "record"), sourceRefs: [ref], drilldown: ref, evidenceState: value === null ? "absent" : ytd || id.startsWith("budgetMetrics.") ? "estimated" : "confirmed" })
      if (value === null) missing.push({ field: id, reason: "missing" })
      return
    }
    if (Array.isArray(value)) return value.forEach((entry, index) => {
      const row = object(entry)
      if (typeof row.year === "number" && row.year !== Number(request.period.start.slice(0, 4))) return
      if (typeof row.month === "number" && (row.month < Number(request.period.start.slice(5, 7)) || row.month > Number(request.period.end.slice(5, 7)))) return
      if (typeof row.month === "number" && (!Number.isInteger(row.month) || row.month < 1 || row.month > 12 || !Number.isInteger(row.year))) { missing.push({ field: `${id}[${index}]:period`, reason: "missing" }); return }
      const recordId = typeof row.id === "string" || typeof row.id === "number" ? String(row.id) : ""
      if (recordId && value.filter((candidate) => String(object(candidate).id ?? "") === recordId).length !== 1) {
        missing.push({ field: `${id}:duplicate-id`, reason: "unavailable" })
        return
      }
      const year = typeof row.year === "number" && Number.isInteger(row.year) ? row.year : undefined
      const month = typeof row.month === "number" ? row.month : undefined
      const period = year === undefined ? recordPeriod : month === undefined ? { start: `${year}-01-01`, end: `${year}-12-31` } : { start: `${year}-${String(month).padStart(2, "0")}-01`, end: `${year}-${String(month).padStart(2, "0")}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}` }
      append(`${id}[${recordId ? `id:${encodeURIComponent(recordId)}` : index}]`, entry, period, year === undefined ? recordGranularity : month === undefined ? "year" : "month")
    })
    if (value && typeof value === "object") Object.entries(value).forEach(([key, entry]) => {
      if ((id === "budgetMetrics" || id === "executiveByYear") && key !== request.period.start.slice(0, 4)) return
      if (id === "executiveMonths" && (Number(key.split(":")[1]) < Number(request.period.start.slice(5, 7)) || key.split(":")[0] !== request.period.start.slice(0, 4) || Number(key.split(":")[1]) > Number(request.period.end.slice(5, 7)))) return
      append(`${id}.${key}`, entry, recordPeriod, recordGranularity)
    })
  }
  request.fields.filter((field) => field !== "opsTickets" && field !== "budgetMetrics").forEach((field) => append(field, projection[field]))
  if (request.fields.includes("opsTickets")) {
    const categories = Array.isArray(projection.opsCats) && projection.opsCats.length ? projection.opsCats.filter((value): value is string => typeof value === "string") : ["IT Security", "Infrastructure", "Application", "IT Operations", "Others (Beyers OT)"]
    rows(projection.opsTickets).forEach((row) => {
      const year = Number(row.year)
      const month = Number(row.month)
      if (year !== Number(request.period.start.slice(0, 4)) || !Number.isInteger(month) || month < Number(request.period.start.slice(5, 7)) || month > Number(request.period.end.slice(5, 7))) return
      const period = { start: `${year}-${String(month).padStart(2, "0")}-01`, end: `${year}-${String(month).padStart(2, "0")}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}` }
      categories.forEach((category) => ["Incidents", "Service Requests"].forEach((type) => ["Initial Balance", "Open", "Closed"].forEach((measure) => {
        const key = `${category}|${type}|${measure}`
        const id = `tickets:${year}-${String(month).padStart(2, "0")}:${key}`
        const amount = typeof row[key] === "number" && Number.isFinite(row[key]) ? row[key] as number : null
        values.push({ id, value: amount, unit: "tickets", period, granularity: "month", sourceRefs: [ref], drilldown: ref, evidenceState: amount === null ? "absent" : "confirmed" })
        if (amount === null) missing.push({ field: id, reason: "missing" })
      })))
    })
  }
  if (request.fields.includes("budgetMetrics")) {
    const year = Number(request.period.start.slice(0, 4))
    const owners = rows(projection.opexOwners).map((row) => ({ row, entries: rows(projection.opexEntries), key: "ownerId" as const }))
    const projects = rows(projection.capexProjects).map((row) => ({ row, entries: rows(projection.capexEntries), key: "projectId" as const }))
    const records = [...owners, ...projects]
    const effective = effectiveBudgetSeries(budgetData(projection), year)
    Array.from({ length: 12 }, (_, index) => index + 1).forEach((month) => {
      const period = { start: `${year}-${String(month).padStart(2, "0")}-01`, end: `${year}-${String(month).padStart(2, "0")}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}` }
      const entry = (item: typeof records[number]) => item.entries.find((row) => row.year === year && row.month === month && (item.key === "ownerId" ? row.ownerId == item.row.id : (row.projId ?? row.projectId) == item.row.id))
      const measurements = (["actual", "forecast"] as const).map((measure) => {
        const numbers = records.map((item) => entry(item)?.[measure])
        const amount = numbers.length && numbers.every((value) => typeof value === "number" && Number.isFinite(value)) ? numbers.reduce<number>((sum, value) => sum + Number(value), 0) : null
        return { measure, amount }
      })
      const budgetKnown = records.length > 0 && records.every((item) => {
        const override = entry(item)?.budget
        return (typeof override === "number" && Number.isFinite(override) && override > 0) || (typeof item.row.budget === "number" && Number.isFinite(item.row.budget))
      })
      const overrides = records.filter((item) => {
        const budget = entry(item)?.budget
        return typeof budget === "number" && Number.isFinite(budget) && budget > 0
      }).length
      const basis = !budgetKnown ? "unknown" : overrides === 0 ? "annual-fallback" : overrides === records.length ? "monthly-override" : "mixed"
      values.push({ id: `budget:${year}-${String(month).padStart(2, "0")}:basis`, value: basis, period, granularity: "month", sourceRefs: [ref], drilldown: ref, evidenceState: budgetKnown ? "confirmed" : "absent" })
      const series = [{ measure: "effective", amount: budgetKnown ? effective[month - 1] : null }, ...measurements]
      series.forEach(({ measure, amount }) => {
        const id = `budget:${year}-${String(month).padStart(2, "0")}:${measure}`
        values.push({ id, value: amount, currency: "unspecified", period, granularity: "month", sourceRefs: [ref], drilldown: ref, evidenceState: amount === null ? "absent" : measure === "effective" ? "estimated" : "confirmed" })
        if (measure === "effective") values.push({ id: `budgetMetrics.${year}.effectiveMonthlyBudget[${month - 1}]`, value: amount, currency: "unspecified", period, granularity: "month", sourceRefs: [ref], drilldown: ref, evidenceState: amount === null ? "absent" : "estimated" })
        if (amount === null) missing.push({ field: id, reason: "missing" })
      })
    })
    const totals = [{ measure: "effective", name: "totalBudget" }, { measure: "actual", name: "totalActual" }, { measure: "forecast", name: "totalForecast" }] as const
    totals.forEach(({ measure, name }) => {
      const months = values.filter((value) => value.id.startsWith(`budget:${year}-`) && value.id.endsWith(`:${measure}`))
      const total = months.length === 12 && months.every((value) => typeof value.value === "number") ? months.reduce((sum, value) => sum + Number(value.value), 0) : null
      values.push({ id: `budgetMetrics.${year}.${name}`, value: total, currency: "unspecified", period: request.period, granularity: "year", sourceRefs: [ref], drilldown: ref, evidenceState: total === null ? "absent" : measure === "effective" ? "estimated" : "confirmed" })
      if (total === null) missing.push({ field: `budgetMetrics.${year}.${name}`, reason: "missing" })
    })
  }
  if (request.fields.includes("projects")) {
    const projects = rows(projection.projects)
    projects.forEach((project) => {
      if (typeof project.id !== "string" || !project.id || projects.filter((entry) => entry.id === project.id).length !== 1) return
      const milestones = rows(project.milestones)
      milestones.forEach((milestone) => {
        if (typeof milestone.id !== "string" || !milestone.id || milestones.filter((entry) => entry.id === milestone.id).length !== 1) return
        const prefix = `milestone:${encodeURIComponent(project.id as string)}:${encodeURIComponent(milestone.id)}`
        const date = typeof milestone.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(milestone.date) && Number.isFinite(Date.parse(milestone.date)) && new Date(milestone.date).toISOString().slice(0, 10) === milestone.date ? milestone.date : null
        const fields = [{ key: "name", value: typeof milestone.name === "string" ? milestone.name : "" }, { key: "status", value: typeof milestone.status === "string" ? milestone.status : "" }, { key: "date", value: date }]
        fields.forEach((field) => values.push({ id: `${prefix}:${field.key}`, value: field.value, ...(field.key === "date" ? { unit: "date" } : {}), period: date && field.key === "date" ? { start: date, end: date } : { start: environment.at.slice(0, 10), end: environment.at.slice(0, 10) }, granularity: "record", sourceRefs: [ref], drilldown: ref, evidenceState: field.value === null || field.value === "" ? "absent" : "confirmed" }))
        if (!date) missing.push({ field: `${prefix}:date`, reason: "missing" })
      })
    })
  }
  const latest = await get().catch(() => null)
  const refreshed = await input.sources.resolveDashboardSource(request.selectionRef, binding, { fields: request.fields, period: request.period }).catch(() => ({ status: "unavailable" as const, reason: "source-resolver-failed" }))
  if (!(await input.host.revalidate(binding)) || !latest || digestSfValue(latest.scoped) !== ref.target.projectionDigest || refreshed.status !== "ok" || refreshed.value.evidence.refDigest !== ref.refDigest)
    return { status: "stale", reason: "source-or-authority-changed" }
  const components: DomainProjection["components"][number][] = values.filter((value) => value.id.startsWith("budget:") && value.id.endsWith(":effective")).map((value) => ({ id: value.id, amount: typeof value.value === "number" ? value.value : null, currency: "unspecified", period: value.period, sourceRefs: [sourceRef], evidenceState: value.value === null ? "absent" : "estimated" }))
  return { status: "ok", value: { context: { installationId: binding.binding.installationId, projectId: binding.binding.projectId, principalRef: binding.binding.principalRef, accessRevision: binding.binding.accessRevision, policyVersion: binding.binding.policyVersion, surface: "dashboard", period: request.period, currency: "unspecified", sourceRefs: [sourceRef], capabilities: ["sf_dashboard_read"] }, version: ref.target.version, engineVersion: "dashboard-runtime-v1", components, values, missing } }
}
