import { expect, test } from "bun:test"
import { createDashboardPort, projectDashboardSource } from "../../../product/dashboard/port.ts"
import { projectDashboardScope } from "../../../product/dashboard/scope.ts"
import { dashboardBiPresentation } from "../../../product/dashboard/bi.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { resolve } from "../../../src/identity.ts"
import { computeBudgetTotals } from "../../../src/dashboard-accounts.ts"
import type { BudgetData } from "../../../src/dashboard-accounts.ts"
import { testPersistence } from "../../fixture/persistence.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
const environment = { at: "2026-11-13T00:00:00Z", id: () => "unused", directory: [] }
const actor = { id: "admin", roles: ["admin"], canWrite: true }
const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "admin", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext
const initial = (): Snapshot => ({ data: { roleMap: [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }], opexOwners: [{ id: "o", budget: 1200 }], opexEntries: [{ id: "jan", ownerId: "o", year: 2026, month: 1, budget: 200, actual: 0 }], members: [{ id: "m", name: "Member", cls: "Talent", outlook: "Promote", notes: "private" }] }, versions: {}, sequences: {}, audit: [], notices: [] })

test("dashboard port reads canonical effective budget and rejects stale and unauthorized sources", async () => {
  const storage = testPersistence({ dashboard: initial() })
  const page = "Budget Overview"
  const projection = projectDashboardSource(storage.state.dashboard, actor, environment, page)!
  const ref: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", refId: "budget", installationId: "i", projectId: "p", refDigest: "", evidenceLevel: "observed", kind: "record", target: { surface: "dashboard", recordType: "dashboard-page", recordId: page, incarnation: "inc", version: 1, fields: Object.keys(projection), period, projectionDigest: digestSfValue({ page, projection }) } }
  ref.refDigest = digestSfEvidenceRef(ref)
  const access = { enabled: true }
  let sourceSnapshot = structuredClone(storage.state.dashboard)
  const port = createDashboardPort({ host: { persistence: storage.persistence, authenticate: async (_request, context) => resolve("admin", [...context!.roleMap], (group) => group === "admins"), environment: async () => environment, requestFor: () => new Request("https://example.test"), revalidate: async () => access.enabled }, sources: { resolveDashboardSource: async (_reference, _binding, selection) => { if (!selection) return { status: "unavailable", reason: "selection-required" }; const scoped = projectDashboardScope(sourceSnapshot, actor, { page, fields: selection.fields, period: selection.period }, environment.at); if (!scoped) return { status: "unavailable", reason: "scope-unavailable" }; const evidence = { ...ref, target: { ...ref.target, fields: [...selection.fields], period: selection.period, projectionDigest: digestSfValue(scoped) } }; evidence.refDigest = digestSfEvidenceRef(evidence); return { status: "ok", value: { page, evidence } } }, resolveDashboardMetric: async () => ({ status: "ok", value: { selectionRef: "budget", field: "budgetMetrics", valuePrefix: "budgetMetrics.2026" } }) } })
  const result = await port.read({ selectionRef: "budget", period, fields: ["budgetMetrics"] }, binding)
  expect(result.status).toBe("ok")
  if (result.status === "ok") {
    expect(result.value.values).toContainEqual(expect.objectContaining({ id: "budgetMetrics.2026.totalBudget", value: 1300 }))
    expect(result.value.components.reduce((total, component) => total + (component.amount ?? 0), 0)).toBe(1300)
    expect(result.value.values).toContainEqual(expect.objectContaining({ id: "budgetMetrics.2026.effectiveMonthlyBudget[0]", value: 200 }))
    expect(result.value.context.currency).toBe("unspecified")
    expect(result.value.values).toContainEqual(expect.objectContaining({ id: "budget:2026-01:actual", value: 0, period: { start: "2026-01-01", end: "2026-01-31" }, evidenceState: "confirmed" }))
    expect(result.value.values).toContainEqual(expect.objectContaining({ id: "budget:2026-01:basis", value: "monthly-override" }))
    expect(result.value.values).toContainEqual(expect.objectContaining({ id: "budget:2026-02:basis", value: "annual-fallback" }))
    expect(result.value.values).toContainEqual(expect.objectContaining({ id: "budget:2026-02:actual", value: null, evidenceState: "absent" }))
    const presentation = dashboardBiPresentation("BI01", result.value)
    expect(presentation.series.find((series) => series.role === "budget")?.valueIds).toHaveLength(12)
    expect(presentation.series.find((series) => series.role === "actual")?.valueIds).toContain("budget:2026-01:actual")
    expect(presentation.series.find((series) => series.id === "forecast")).toMatchObject({ role: "other", label: "Forecast" })
  }
  const january = await port.read({ selectionRef: "budget", period: { start: "2026-01-01", end: "2026-01-31" }, fields: ["budgetSeries"] }, binding)
  expect(january.status).toBe("ok")
  if (january.status === "ok") {
    expect(january.value.values).toContainEqual(expect.objectContaining({ id: "budget:2026-01:actual", value: 0, evidenceState: "confirmed" }))
    expect(january.value.values).toContainEqual(expect.objectContaining({ id: "budget:2026-01:forecast", value: null, evidenceState: "absent" }))
    expect(january.value.values.some((value) => value.id.startsWith("budget:2026-02:") || value.id.includes("totalBudget"))).toBe(false)
  }
  const entries = await port.read({ selectionRef: "budget", period, fields: ["opexEntries"] }, binding)
  expect(entries.status).toBe("ok")
  if (entries.status === "ok") expect(entries.value.values).toContainEqual(expect.objectContaining({ id: "opexEntries[id:jan].actual", value: 0, period: { start: "2026-01-01", end: "2026-01-31" }, granularity: "month" }))
  storage.state.dashboard.data.opexOwners = [{ id: "o" }]
  sourceSnapshot = structuredClone(storage.state.dashboard)
  const missing = await port.read({ selectionRef: "budget", period, fields: ["budgetMetrics"] }, binding)
  expect(missing.status).toBe("ok")
  if (missing.status === "ok") {
    expect(missing.value.values).toContainEqual(expect.objectContaining({ id: "budget:2026-02:effective", value: null, evidenceState: "absent" }))
    expect(missing.value.components).toContainEqual(expect.objectContaining({ id: "budget:2026-02:effective", amount: null, evidenceState: "absent" }))
  }
  storage.state.dashboard.data.opexOwners = [{ id: "o", budget: 2400 }]
  expect(await port.read({ selectionRef: "budget", period, fields: ["budgetMetrics"] }, binding)).toMatchObject({ status: "stale" })
  access.enabled = false
  expect(await port.read({ selectionRef: "budget", period, fields: ["budgetMetrics"] }, binding)).toMatchObject({ status: "denied" })
})

function monthlyBudgetLedger() {
  return {
    opexOwners: [{ id: "o", budget: 1200 }],
    capexProjects: [{ id: "p", budget: 2400 }],
    opexEntries: Array.from({ length: 12 }, (_, index) => ({ id: `opex-${index + 1}`, ownerId: "o", year: 2026, month: index + 1, budget: 0, actual: 0, forecast: 0 })),
    capexEntries: Array.from({ length: 12 }, (_, index) => ({ id: `capex-${index + 1}`, projId: "p", year: 2026, month: index + 1, budget: 0, actual: 0, forecast: 0 })),
  }
}

async function readBudgetLedger(data: BudgetData, selectedPeriod = period, field: "budgetMetrics" | "budgetSeries" = "budgetMetrics") {
  const state = initial()
  state.data = { ...state.data, ...data }
  const storage = testPersistence({ dashboard: state })
  const page = "Budget Overview"
  const port = createDashboardPort({ host: {
    persistence: storage.persistence,
    authenticate: async (_request, context) => resolve("admin", [...context!.roleMap], (group) => group === "admins"),
    environment: async () => environment,
    requestFor: () => new Request("https://example.test"),
    revalidate: async () => true,
  }, sources: {
    resolveDashboardSource: async (_reference, _binding, selection) => {
      if (!selection) return { status: "unavailable", reason: "selection-required" }
      const scoped = projectDashboardScope(storage.state.dashboard, actor, { page, ...selection }, environment.at)
      if (!scoped) return { status: "unavailable", reason: "scope-unavailable" }
      const evidence: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", refId: "budget-ledger",
        installationId: "i", projectId: "p", refDigest: "", evidenceLevel: "observed",
        target: { surface: "dashboard", recordType: "dashboard-page", recordId: page, incarnation: "inc", version: 1,
          fields: [...selection.fields], period: selection.period, projectionDigest: digestSfValue(scoped) } }
      evidence.refDigest = digestSfEvidenceRef(evidence)
      return { status: "ok", value: { page, evidence } }
    },
    resolveDashboardMetric: async () => ({ status: "unavailable", reason: "not-registered" }),
  } })
  return port.read({ selectionRef: "budget-ledger", period: selectedPeriod, fields: [field] }, binding)
}

test("C02 sums all distinct monthly OPEX and CAPEX ledger rows while retaining SD02 budget fallback", async () => {
  const base = monthlyBudgetLedger()
  const data = { ...base,
    opexEntries: [...base.opexEntries, { id: "opex-january-extra", ownerId: "o", year: 2026, month: 1, budget: 900, actual: 50, forecast: 75 }],
    capexEntries: [...base.capexEntries, { id: "capex-january-extra", projectId: "p", year: 2026, month: 1, budget: 1800, actual: 20, forecast: 25 }],
  }
  expect(new Set([...data.opexEntries, ...data.capexEntries].map((row) => row.id)).size).toBe(26)
  const canonical = computeBudgetTotals(data, 2026)
  expect(canonical).toMatchObject({ opexActual: 50, opexForecast: 75, capexActual: 20, capexForecast: 25, totalActual: 70, totalForecast: 100, totalBudget: 3600 })
  const result = await readBudgetLedger(data)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.value.values).toContainEqual(expect.objectContaining({ id: "budget:2026-01:actual", value: canonical.totalActual, evidenceState: "confirmed" }))
  expect(result.value.values).toContainEqual(expect.objectContaining({ id: "budget:2026-01:forecast", value: canonical.totalForecast, evidenceState: "confirmed" }))
  expect(result.value.values).toContainEqual(expect.objectContaining({ id: "budgetMetrics.2026.totalActual", value: canonical.totalActual, evidenceState: "confirmed" }))
  expect(result.value.values).toContainEqual(expect.objectContaining({ id: "budgetMetrics.2026.totalForecast", value: canonical.totalForecast, evidenceState: "confirmed" }))
  expect(result.value.values).toContainEqual(expect.objectContaining({ id: "budgetMetrics.2026.totalBudget", value: canonical.totalBudget, evidenceState: "estimated" }))
  expect(result.value.values).toContainEqual(expect.objectContaining({ id: "budget:2026-01:effective", value: 300, evidenceState: "estimated" }))
  expect(result.value.values).toContainEqual(expect.objectContaining({ id: "budget:2026-01:basis", value: "annual-fallback" }))
  const january = await readBudgetLedger(data, { start: "2026-01-01", end: "2026-01-31" }, "budgetSeries")
  expect(january.status).toBe("ok")
  if (january.status === "ok") {
    expect(january.value.values).toContainEqual(expect.objectContaining({ id: "budget:2026-01:actual", value: 70, evidenceState: "confirmed" }))
    expect(january.value.values).toContainEqual(expect.objectContaining({ id: "budget:2026-01:forecast", value: 100, evidenceState: "confirmed" }))
    expect(january.value.values.some((value) => value.id.includes("totalActual") || value.id.startsWith("budget:2026-02:"))).toBe(false)
  }
})

test("C02 keeps a missing value in any additional monthly ledger row unknown instead of summing it as zero", async () => {
  for (const kind of ["opex", "capex"] as const) {
    for (const measure of ["actual", "forecast"] as const) {
      const base = monthlyBudgetLedger()
      const extra = { id: `${kind}-january-missing-${measure}`, year: 2026, month: 1,
        ...(kind === "opex" ? { ownerId: "o" } : { projectId: "p" }),
        actual: measure === "actual" ? undefined : 50, forecast: measure === "forecast" ? undefined : 75 }
      const data = { ...base, opexEntries: kind === "opex" ? [...base.opexEntries, extra] : base.opexEntries,
        capexEntries: kind === "capex" ? [...base.capexEntries, extra] : base.capexEntries }
      const result = await readBudgetLedger(data)
      expect(result.status).toBe("ok")
      if (result.status !== "ok") throw new Error(`budget ledger unavailable: ${kind}/${measure}`)
      const total = measure === "actual" ? "totalActual" : "totalForecast"
      const known = measure === "actual" ? "forecast" : "actual"
      expect(result.value.values).toContainEqual(expect.objectContaining({ id: `budget:2026-01:${measure}`, value: null, evidenceState: "absent" }))
      expect(result.value.values).toContainEqual(expect.objectContaining({ id: `budgetMetrics.2026.${total}`, value: null, evidenceState: "absent" }))
      expect(result.value.missing).toContainEqual({ field: `budget:2026-01:${measure}`, reason: "missing" })
      expect(result.value.missing).toContainEqual({ field: `budgetMetrics.2026.${total}`, reason: "missing" })
      expect(result.value.values).toContainEqual(expect.objectContaining({ id: `budget:2026-01:${known}`, value: known === "actual" ? 50 : 75, evidenceState: "confirmed" }))
      expect(result.value.values).toContainEqual(expect.objectContaining({ id: `budget:2026-02:${measure}`, value: 0, evidenceState: "confirmed" }))
      expect(result.value.values).toContainEqual(expect.objectContaining({ id: "budgetMetrics.2026.totalBudget", value: 3600, evidenceState: "estimated" }))
    }
  }
})

test("dashboard views remove restricted talent and deny invalid pages", () => {
  const state = initial()
  const viewer = { id: "reader", roles: ["viewer"], canWrite: false }
  state.data.summaries = ["Team Structure"]
  const result = projectDashboardSource(state, viewer, environment, "Team Structure")!
  expect(JSON.stringify(result)).toContain("Member")
  expect(JSON.stringify(result)).not.toContain("private")
  expect(JSON.stringify(result)).not.toContain("Promote")
  expect(projectDashboardSource(state, viewer, environment, "Talent Review")).toBeUndefined()
  expect(projectDashboardSource(state, actor, environment, "not-a-page")).toBeUndefined()
  const executive = projectDashboardSource(state, viewer, environment, "Executive Dashboard")!
  expect(executive).not.toHaveProperty("opexOwners")
  expect(executive).not.toHaveProperty("budgetMetrics")
  expect(executive).not.toHaveProperty("executiveMonths")
  expect(executive.executive).not.toHaveProperty("active")
  expect(JSON.stringify(executive)).not.toContain("private")
  state.data.summaries = ["IT Operations"]
  state.data.secIncidents = [{ id: "secret-incident", title: "secret-security-detail" }]
  const operations = projectDashboardSource(state, viewer, environment, "Executive Dashboard")!
  expect(operations).toHaveProperty("executiveMonths")
  expect(JSON.stringify(operations.executiveMonths)).not.toContain("openIncidents")
  expect(JSON.stringify(operations)).not.toContain("secret-security-detail")
})

test("every published page uses its authorized domain view", () => {
  const state = initial()
  const pages = ["Executive Dashboard", "Hot Topics & Actions", "Budget Overview", "OPEX Detail", "CAPEX Projects", "Headcount Overview", "Team Structure", "Talent Review", "Portfolio Dashboard", "All Projects", "IT Operations", "IT Security KPIs", "IT Risks", "Vendor Contracts", "Stakeholder Management", "IT Performance Contract"]
  for (const page of pages) expect(projectDashboardSource(state, actor, environment, page)).toBeDefined()
})

test("hot topic projection does not read unrelated talent records", () => {
  const state = initial()
  state.data.hotTopics = [{ id: "a", action: "Review", status: "open" }]
  expect(projectDashboardSource(state, actor, environment, "Hot Topics & Actions")).toMatchObject({ hotTopics: [{ id: "a", action: "Review" }] })
  expect(state.audit).toEqual([])
})

test("ticket register projection preserves period, absent cells and BI roles", async () => {
  const state = initial()
  state.data.opsCats = ["Infrastructure"]
  state.data.opsTickets = [{ year: 2026, month: 2, "Infrastructure|Incidents|Open": 10, "Infrastructure|Incidents|Closed": 15, "Infrastructure|Incidents|Initial Balance": 20 }]
  const storage = testPersistence({ dashboard: state })
  const page = "IT Operations"
  const ref: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", refId: "tickets", installationId: "i", projectId: "p", refDigest: "", evidenceLevel: "observed", kind: "record", target: { surface: "dashboard", recordType: "dashboard-page", recordId: page, incarnation: "inc", version: 1, fields: ["opsTickets"], period, projectionDigest: digestSfValue(projectDashboardScope(state, actor, { page, fields: ["opsTickets"], period }, environment.at)) } }
  ref.refDigest = digestSfEvidenceRef(ref)
  const port = createDashboardPort({ host: { persistence: storage.persistence, authenticate: async (_request, context) => resolve("admin", [...context!.roleMap], (group) => group === "admins"), environment: async () => environment, requestFor: () => new Request("https://example.test"), revalidate: async () => true }, sources: { resolveDashboardSource: async () => ({ status: "ok", value: { page, evidence: ref } }), resolveDashboardMetric: async () => ({ status: "unavailable", reason: "not-registered" }) } })
  const result = await port.read({ selectionRef: "tickets", period, fields: ["opsTickets"] }, binding)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.value.values).toContainEqual(expect.objectContaining({ id: "tickets:2026-02:Infrastructure|Incidents|Open", value: 10, unit: "tickets", period: { start: "2026-02-01", end: "2026-02-28" } }))
  expect(result.value.values).toContainEqual(expect.objectContaining({ id: "tickets:2026-02:Infrastructure|Service Requests|Open", value: null, evidenceState: "absent" }))
  const series = dashboardBiPresentation("BI07", result.value).series
  expect(series.find((entry) => entry.id === "Infrastructure|Incidents|Open")?.valueIds).toEqual(["tickets:2026-02:Infrastructure|Incidents|Open"])
  expect(series.find((entry) => entry.id === "Infrastructure|Service Requests|Open")?.valueIds).toEqual(["tickets:2026-02:Infrastructure|Service Requests|Open"])
  expect(await port.read({ selectionRef: "tickets", period: { start: "2026-02-15", end: "2026-02-28" }, fields: ["opsTickets"] }, binding)).toMatchObject({ status: "needs-input" })
})

test("milestones retain missing dates and never invent completed dates", async () => {
  const state = initial()
  state.data.projects = [{ id: "project", name: "Project", milestones: [{ id: "planned", name: "Planned", date: "2026-12-01", status: "upcoming" }, { id: "done", name: "Done", date: "2026-11-01", status: "done" }, { id: "undated", name: "Undated", date: "", status: "upcoming" }] }]
  const storage = testPersistence({ dashboard: state })
  const page = "Portfolio Dashboard"
  const ref: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", refId: "projects", installationId: "i", projectId: "p", refDigest: "", evidenceLevel: "observed", kind: "record", target: { surface: "dashboard", recordType: "dashboard-page", recordId: page, incarnation: "inc", version: 1, fields: ["projects"], period, projectionDigest: digestSfValue(projectDashboardScope(state, actor, { page, fields: ["projects"], period }, environment.at)) } }
  ref.refDigest = digestSfEvidenceRef(ref)
  const port = createDashboardPort({ host: { persistence: storage.persistence, authenticate: async (_request, context) => resolve("admin", [...context!.roleMap], (group) => group === "admins"), environment: async () => environment, requestFor: () => new Request("https://example.test"), revalidate: async () => true }, sources: { resolveDashboardSource: async () => ({ status: "ok", value: { page, evidence: ref } }), resolveDashboardMetric: async () => ({ status: "unavailable", reason: "not-registered" }) } })
  const result = await port.read({ selectionRef: "projects", period, fields: ["projects"] }, binding)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.value.values).toContainEqual(expect.objectContaining({ id: "milestone:project:undated:date", value: null, evidenceState: "absent" }))
  const presentation = dashboardBiPresentation("BI08", result.value)
  expect("timeline" in presentation).toBe(true)
  if (!("timeline" in presentation) || !presentation.timeline) return
  expect(presentation.timeline.items).toContainEqual({ label: "Done", dateValueId: "milestone:project:done:date", state: "unknown" })
  expect(presentation.timeline.items).toContainEqual({ label: "Planned", dateValueId: "milestone:project:planned:date", state: "planned" })
})

test("executive measurements preserve month, year-to-date and annual periods", async () => {
  const state = initial()
  state.data.opsSLA = [{ year: 2026, month: 1, incSLA: 80, svcSLA: 90 }, { year: 2026, month: 2, incSLA: 100, svcSLA: 80 }]
  state.data.opsCats = ["Category"]
  state.data.opsTickets = [{ year: 2026, month: 1, ...Object.fromEntries(["Incidents", "Service Requests"].flatMap((kind) => ["Initial Balance", "Open", "Closed"].map((measure) => [`Category|${kind}|${measure}`, measure === "Initial Balance" ? 10 : measure === "Open" ? 3 : 1]))) }]
  state.data.secKpi = [{ year: 2026, month: 1, socClosure: 75 }]
  state.data.secIncidents = [{ id: "incident", contained: false }]
  state.data.members = [{ id: "m", status: "Terminated", end: "2026-02-01" }]
  const storage = testPersistence({ dashboard: state })
  const page = "Executive Dashboard"
  const port = createDashboardPort({ host: { persistence: storage.persistence, authenticate: async (_request, context) => resolve("admin", [...context!.roleMap], (group) => group === "admins"), environment: async () => environment, requestFor: () => new Request("https://example.test"), revalidate: async () => true }, sources: { resolveDashboardSource: async (_ref, _binding, selection) => {
    if (!selection) return { status: "unavailable", reason: "selection-required" }
    const evidence: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", refId: "executive", installationId: "i", projectId: "p", refDigest: "", evidenceLevel: "observed", target: { surface: "dashboard", recordType: "dashboard-page", recordId: page, incarnation: "inc", version: 1, fields: [...selection.fields], period: selection.period, projectionDigest: digestSfValue(projectDashboardScope(state, actor, { page, ...selection }, environment.at)) } }
    evidence.refDigest = digestSfEvidenceRef(evidence)
    return { status: "ok", value: { page, evidence } }
  }, resolveDashboardMetric: async () => ({ status: "unavailable", reason: "not-registered" }) } })
  const annual = await port.read({ selectionRef: "executive", period, fields: ["executiveMonths", "executiveByYear"] }, binding)
  expect(annual.status).toBe("ok")
  if (annual.status !== "ok") return
  expect(annual.value.values).toContainEqual(expect.objectContaining({ id: "executiveMonths.2026:2.incYtd", value: 90, period: { start: "2026-01-01", end: "2026-02-28" }, granularity: "aggregate" }))
  expect(annual.value.values).toContainEqual(expect.objectContaining({ id: "executiveByYear.2026.departures", value: 1, period, granularity: "year" }))
  expect(annual.value.values).toContainEqual(expect.objectContaining({ id: "executiveMonths.2026:1.backlogYtd", value: 24, period: { start: "2026-01-01", end: "2026-01-31" }, granularity: "month" }))
  expect(annual.value.values.some((value) => value.id === "executiveMonths.2026:2.backlogYtd")).toBe(false)
  expect(annual.value.values).toContainEqual(expect.objectContaining({ id: "executiveMonths.2026:11.openIncidents", value: 1, period: { start: "2026-11-13", end: "2026-11-13" }, granularity: "record" }))
  expect(annual.value.values.some((value) => value.id.startsWith("executiveMonths.2026:1.kpis"))).toBe(true)
  expect(annual.value.values.some((value) => value.id.startsWith("executiveMonths.2026:2.kpis"))).toBe(false)
  expect(annual.value.missing).toEqual(expect.arrayContaining([{ field: "executiveMonths.backlogYtd", reason: "unavailable" }]))
  const february = await port.read({ selectionRef: "executive", period: { start: "2026-02-01", end: "2026-02-28" }, fields: ["executiveMonths", "executiveByYear"] }, binding)
  expect(february.status).toBe("ok")
  if (february.status === "ok") {
    expect(february.value.values).toContainEqual(expect.objectContaining({ id: "executiveByYear.2026.monthlyDepartures[1]", value: 1, period: { start: "2026-02-01", end: "2026-02-28" } }))
    expect(february.value.values.some((value) => /\.departures$|\.incYtd$|\.svcYtd$|monthlyDepartures\[(?!1\])/.test(value.id))).toBe(false)
  }
})

test("milestone dates can be selected historically without claiming historical status", async () => {
  const state = initial()
  state.data.projects = [{ id: "p", notes: "restricted-project-note", milestones: [{ id: "m", name: "Launch", date: "2026-03-05", status: "done", notes: "restricted-milestone-note" }, { id: "undated", name: "No date" }, { id: "outside", name: "Outside", date: "2026-09-01", status: "late" }] }]
  const storage = testPersistence({ dashboard: state })
  const selectedPeriod = { start: "2026-02-01", end: "2026-05-31" }
  const page = "Portfolio Dashboard"
  const scoped = projectDashboardScope(state, actor, { page, fields: ["milestoneDates"], period: selectedPeriod }, environment.at)!
  const evidence: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", refId: "milestones", installationId: "i", projectId: "p", refDigest: "", evidenceLevel: "observed", target: { surface: "dashboard", recordType: "dashboard-page", recordId: page, incarnation: "inc", version: 1, fields: ["milestoneDates"], period: selectedPeriod, projectionDigest: digestSfValue(scoped) } }
  evidence.refDigest = digestSfEvidenceRef(evidence)
  const port = createDashboardPort({ host: { persistence: storage.persistence, authenticate: async (_request, context) => resolve("admin", [...context!.roleMap], (group) => group === "admins"), environment: async () => environment, requestFor: () => new Request("https://example.test"), revalidate: async () => true }, sources: { resolveDashboardSource: async () => ({ status: "ok", value: { page, evidence } }), resolveDashboardMetric: async () => ({ status: "unavailable", reason: "not-registered" }) } })
  const result = await port.read({ selectionRef: "milestones", period: selectedPeriod, fields: ["milestoneDates"] }, binding)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.value.values).toContainEqual(expect.objectContaining({ id: "milestone:p:m:date", value: "2026-03-05", period: { start: "2026-03-05", end: "2026-03-05" } }))
  expect(result.value.values).toContainEqual(expect.objectContaining({ id: "milestone:p:m:name", value: "Launch" }))
  expect(result.value.values).toContainEqual(expect.objectContaining({ id: "milestone:p:undated:date", value: null, evidenceState: "absent", period: selectedPeriod }))
  expect(result.value.values).toContainEqual(expect.objectContaining({ id: "milestone:p:undated:name", value: "No date" }))
  expect(result.value.missing).toContainEqual({ field: "milestone:p:undated:date", reason: "missing" })
  expect(JSON.stringify(result)).not.toContain("restricted-project-note")
  expect(JSON.stringify(result)).not.toContain("restricted-milestone-note")
  expect(JSON.stringify(result)).not.toContain("milestone:p:outside")
  expect(result.value.values.some((value) => value.id.endsWith(":status"))).toBe(false)
  expect(dashboardBiPresentation("BI08", result.value).timeline?.items).toEqual([{ label: "Launch", dateValueId: "milestone:p:m:date", state: "unknown" }, { label: "No date", dateValueId: "milestone:p:undated:date", state: "unknown" }])
  evidence.target.period = period
  evidence.target.projectionDigest = digestSfValue(projectDashboardScope(storage.state.dashboard, actor, { page, fields: ["milestoneDates"], period }, environment.at))
  evidence.refDigest = digestSfEvidenceRef(evidence)
  const current = await port.read({ selectionRef: "milestones", period, fields: ["milestoneDates"] }, binding)
  expect(current.status).toBe("ok")
  if (current.status === "ok") {
    expect(current.value.values).toContainEqual(expect.objectContaining({ id: "milestone:p:m:status", value: "done", period: { start: "2026-11-13", end: "2026-11-13" } }))
    expect(dashboardBiPresentation("BI08", current.value).timeline?.items.find((item) => item.dateValueId === "milestone:p:m:date")?.state).toBe("unknown")
  }
  evidence.target.period = selectedPeriod
  ;(storage.state.dashboard.data.projects as unknown[]).push({ id: "duplicate", milestones: [{ id: "x", name: "Hidden", date: "2026-03-10" }] }, { id: "duplicate", milestones: [{ id: "x", name: "Hidden too", date: "2026-03-11" }] }, { id: "valid", milestones: [{ id: "", name: "No identifier", date: "2026-03-12" }] })
  evidence.target.projectionDigest = digestSfValue(projectDashboardScope(storage.state.dashboard, actor, { page, fields: ["milestoneDates"], period: selectedPeriod }, environment.at))
  evidence.refDigest = digestSfEvidenceRef(evidence)
  const ambiguous = await port.read({ selectionRef: "milestones", period: selectedPeriod, fields: ["milestoneDates"] }, binding)
  expect(ambiguous.status).toBe("ok")
  if (ambiguous.status === "ok") {
    expect(ambiguous.value.missing).toContainEqual({ field: "milestoneDates:identity", reason: "unavailable" })
    expect(JSON.stringify(ambiguous)).not.toContain("Hidden")
    expect(JSON.stringify(ambiguous)).not.toContain("No identifier")
  }
})
