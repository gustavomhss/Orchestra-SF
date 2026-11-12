// Secções 7.0, 8.0 e 9.0. A lista e quem abre. Não é conta de uma superfície. Não importa outra.

export const DASHBOARD_PAGES = [
  "Executive Dashboard",
  "Hot Topics & Actions",
  "Budget Overview",
  "OPEX Detail",
  "CAPEX Projects",
  "Headcount Overview",
  "Team Structure",
  "Talent Review",
  "Portfolio Dashboard",
  "All Projects",
  "IT Operations",
  "IT Security KPIs",
  "IT Risks",
  "Vendor Contracts",
  "Stakeholder Management",
  "IT Performance Contract",
] as const

export const FOOTER = ["Generate Report", "Export JSON", "Import JSON"] as const

export const PLANNER_TABS = [
  "Overview",
  "OPEX",
  "CAPEX",
  "Headcount",
  "Entities & allocations",
  "FX rates",
  "Versions",
] as const

export const PROCUREMENT_NAV = ["Dashboard", "Requests", "My approvals", "Suppliers", "Settings"] as const

export const DASHBOARD_START = "Executive Dashboard"
export const PLANNER_DEFAULT = "Overview"

const OWN_YEAR = new Set(["Executive Dashboard", "IT Operations", "IT Security KPIs"])

const CONTRIBUTOR_SEE: Record<string, readonly string[]> = {
  Operations: ["IT Operations"],
  security: ["IT Security KPIs"],
  projects: ["Portfolio Dashboard", "All Projects"],
  risks: ["IT Risks"],
  contracts: ["Vendor Contracts"],
}

const BUDGET_PAGES = new Set(["Budget Overview", "OPEX Detail", "CAPEX Projects"])

const DASHBOARD_ROLES = ["admin", "domain leader", "contributor", "viewer"]
const PLANNER_ROLES = ["admin", "finance", "hr", "budget owner", "viewer"]
const PROCUREMENT_ROLES = ["requester", "buyer", "approver", "supplier admin", "admin", "viewer"]

const PAGES = new Map<string, { surface: "dashboard" | "planner" | "procurement"; index: number }>()
DASHBOARD_PAGES.forEach((key, index) => PAGES.set(key, { surface: "dashboard", index }))
PLANNER_TABS.forEach((key, index) => PAGES.set(key, { surface: "planner", index }))
PROCUREMENT_NAV.forEach((key, index) => PAGES.set(key, { surface: "procurement", index }))

export function showPage(key: string): { drawn: true; surface: "dashboard" | "planner" | "procurement"; index: number } | { drawn: false } {
  const found = PAGES.get(key)
  if (!found) return { drawn: false }
  return { drawn: true, surface: found.surface, index: found.index }
}

export function sidebarYear(year?: number): number {
  if (year == null || year < 2024 || year > 2027) return 2026
  return year
}

export function yearFor(page: string, sidebar: number, own: number | undefined): number | undefined {
  if (OWN_YEAR.has(page)) return own
  return sidebar
}

export function setYear(page: string, year: number, sidebar: number): { page: string; year: number; sidebar: number } | { ok: false } {
  const drawn = showPage(page)
  if (!drawn.drawn || drawn.surface !== "dashboard") return { ok: false }
  if (year < 2024 || year > 2027) return { ok: false }
  if (OWN_YEAR.has(page)) return { page, year, sidebar }
  return { page, year, sidebar: year }
}

export function dashboardPages(actor: { roles: string[] }, summaries: readonly string[] = []): string[] {
  if (!actor.roles.some((role) => DASHBOARD_ROLES.includes(role))) return []
  if (actor.roles.includes("admin") || actor.roles.includes("domain leader")) return [...DASHBOARD_PAGES]
  const allowed = new Set<string>()
  if (actor.roles.includes("viewer")) allowed.add("Executive Dashboard")
  if (actor.roles.includes("viewer")) for (const page of summaries) if ((DASHBOARD_PAGES as readonly string[]).includes(page)) allowed.add(page)
  if (actor.roles.includes("contributor")) {
    for (const pages of Object.values(CONTRIBUTOR_SEE)) for (const page of pages) allowed.add(page)
  }
  return DASHBOARD_PAGES.filter((page) => allowed.has(page))
}

export function openDashboard(key: string, actor: { roles: string[] }, summaries: readonly string[] = []) {
  const page = showPage(key)
  if (!page.drawn || page.surface !== "dashboard") return { drawn: false as const }
  if (!dashboardPages(actor, summaries).includes(key)) return { drawn: false as const }
  return { drawn: true as const, key, index: page.index }
}

export function budgetLineWrite(actor: { canWrite: boolean; roles: string[] }, lineId: string, plugged: readonly string[] = []): boolean {
  if (!actor.canWrite) return false
  if (actor.roles.includes("admin")) return true
  if (!actor.roles.includes("domain leader")) return false
  return plugged.includes(lineId)
}

export function dashboardWrite(page: string, actor: { canWrite: boolean; roles: string[]; assigned?: string[] }): boolean {
  if (!actor.canWrite) return false
  if (!dashboardPages(actor).includes(page)) return false
  if (actor.roles.includes("admin")) return true
  if (BUDGET_PAGES.has(page)) return false
  if (page === "Talent Review") return false
  if (actor.roles.includes("domain leader")) return true
  const assigned = actor.assigned ?? []
  if (!assigned.length) return false
  return assigned.some((module) => CONTRIBUTOR_SEE[module]?.includes(page) === true)
}

export function openPlanner(key: string, actor: { roles: string[] }) {
  const page = showPage(key)
  if (!page.drawn || page.surface !== "planner") return { drawn: false as const }
  if (!actor.roles.some((role) => PLANNER_ROLES.includes(role))) return { drawn: false as const }
  return { drawn: true as const, key, index: page.index }
}

export function openProcurement(key: string, actor: { roles: string[] }) {
  const page = showPage(key)
  if (!page.drawn || page.surface !== "procurement") return { drawn: false as const }
  if (!actor.roles.some((role) => PROCUREMENT_ROLES.includes(role))) return { drawn: false as const }
  return { drawn: true as const, key, index: page.index }
}

export function excelFile() {
  return { file: true as const, tab: false as const }
}

export function plannerKeys(actor: { roles: string[] }): string[] {
  return PLANNER_TABS.filter((key) => openPlanner(key, actor).drawn)
}

export function procurementKeys(actor: { roles: string[] }): string[] {
  return PROCUREMENT_NAV.filter((key) => openProcurement(key, actor).drawn)
}
