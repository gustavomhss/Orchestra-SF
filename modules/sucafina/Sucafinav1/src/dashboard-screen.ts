// Secção 7.0. Desenha a chave que o servidor abriu. Não importa planner nem procurement.

import { dashboardMoney, executiveReportTotals, riskScore, riskTier } from "./dashboard-accounts.ts"
import type { BudgetData } from "./dashboard-accounts.ts"
import { budgetCard } from "./dashboard-role.ts"
import type { AuditLine, Member } from "./dashboard-role.ts"
import { FOOTER, dashboardPages, openDashboard, sidebarYear, yearFor } from "./nav.ts"
import { documentHtml, esc, links, listed, openKey, pageMain } from "./screen-shell.ts"
import type { Drawn, ScreenActor } from "./screen-shell.ts"
import { executiveScreen, talentScreen } from "./surfaces.ts"

const SECTIONS: { label: string; keys: readonly string[] }[] = [
  { label: "Overview", keys: ["Executive Dashboard"] },
  { label: "Action Tracker", keys: ["Hot Topics & Actions"] },
  { label: "Budget", keys: ["Budget Overview", "OPEX Detail", "CAPEX Projects"] },
  { label: "People", keys: ["Headcount Overview", "Team Structure", "Talent Review"] },
  { label: "Projects", keys: ["Portfolio Dashboard", "All Projects"] },
  { label: "Operations", keys: ["IT Operations"] },
  { label: "Service", keys: ["IT Security KPIs"] },
  {
    label: "Contracts and Risks",
    keys: ["IT Risks", "Vendor Contracts", "Stakeholder Management", "IT Performance Contract"],
  },
]

export function dashboardScreen(input: {
  actor: ScreenActor
  key?: string
  summaries?: readonly string[]
  year?: number
  ownYear?: number
  budget?: BudgetData
  members?: Member[]
  at?: string
  audit?: AuditLine[]
  risks?: { impact: number; probability: number }[]
}): { drawn: Drawn; html: string } {
  const keys = dashboardPages(input.actor, input.summaries)
  const nav = listed(keys, "dashboard")
  const opened = openKey(keys, input.key ?? keys[0], (key) => openDashboard(key, input.actor, input.summaries))
  const drawn = {
    surface: "dashboard" as const,
    nav,
    active: opened,
    aside: FOOTER.map((key) => ({ key, page: false as const })),
  }
  const sidebar = sidebarYear(input.year)
  return {
    drawn,
    html: documentHtml(
      "CIO Dashboard",
      "dashboard",
      dashboardNav(nav),
      dashboardMain(input, opened, sidebar),
      footerHtml(sidebar),
    ),
  }
}

function dashboardNav(nav: { key: string; index: number }[]): string {
  const grouped = new Set(SECTIONS.flatMap((section) => section.keys))
  const groups = SECTIONS.flatMap((section) => {
    const items = nav.filter((item) => section.keys.includes(item.key))
    if (!items.length) return []
    return [`<div class="nav-section">${esc(section.label)}</div>`, links(items)]
  })
  return groups.join("") + links(nav.filter((item) => !grouped.has(item.key)))
}

function dashboardMain(
  input: {
    actor: ScreenActor
    budget?: BudgetData
    members?: Member[]
    at?: string
    audit?: AuditLine[]
    ownYear?: number
    risks?: { impact: number; probability: number }[]
  },
  active: Drawn["active"],
  sidebar: number,
): string {
  if (!active.drawn) return pageMain(active)
  const own = yearFor(active.key, sidebar, input.ownYear)
  return pageMain(active, `${ownYearSelect(active.key, own)}${bodyOf(input, active.key, sidebar)}`)
}

function ownYearSelect(page: string, own: number | undefined): string {
  // yearFor devolve o ano próprio. 0 e 1 não são anos da lista. Perguntam. Não gravam.
  if (yearFor(page, 0, 1) !== 1) return ""
  const options = [2024, 2025, 2026, 2027]
    .map((year) => `<option${year === own ? " selected" : ""}>${year}</option>`)
    .join("")
  return `<select data-year="own" data-query="${page === "Executive Dashboard" ? "execYear" : page === "IT Operations" ? "opsYear" : "secYear"}"><option></option>${options}</select>`
}

function bodyOf(
  input: {
    actor: ScreenActor
    budget?: BudgetData
    members?: Member[]
    at?: string
    audit?: AuditLine[]
    ownYear?: number
    risks?: { impact: number; probability: number }[]
  },
  key: string,
  sidebar: number,
): string {
  if ((key === "Executive Dashboard" || key === "Budget Overview") && input.budget)
    return budgetBody(input.budget, key === "Executive Dashboard" ? input.ownYear : sidebar)
  if (key === "Talent Review" && input.members && input.at && input.audit)
    return talentBody(input.members, input.actor, input.at, input.audit)
  if (key === "IT Risks" && input.risks)
    return input.risks.map((risk) => riskLine(risk.impact, risk.probability)).join("")
  return ""
}

function budgetBody(data: BudgetData, year: number | undefined): string {
  if (year == null) return ""
  const screen = executiveScreen(data, year)
  const card = budgetCard(screen.totals.totalBudget)
  const report = executiveReportTotals(data, year)
  return `<p data-label="${esc(card.label)}">${esc(card.label)}</p><p data-money="total">${esc(dashboardMoney(screen.totals.totalBudget))}</p><p data-report="${esc(dashboardMoney(report.totalBudget))}"></p><ol data-chart="server">${screen.chart.map((value) => `<li>${esc(String(value))}</li>`).join("")}</ol>`
}

function talentBody(members: Member[], actor: ScreenActor, at: string, audit: AuditLine[]): string {
  const screen = talentScreen(members, actor, at, audit)
  if (!screen.drawn) return ""
  return screen.members.map((member) => `<p>${shown(member)}</p>`).join("")
}

function shown(member: Member): string {
  return ["name", "cls", "outlook", "notes"]
    .flatMap((field) => {
      const value = member[field]
      if (value == null || value === "") return []
      return [esc(String(value))]
    })
    .join(" ")
}

function riskLine(impact: number, probability: number): string {
  const score = riskScore(impact, probability)
  return `<p>${score} ${riskTier(score)}</p>`
}

function footerHtml(sidebar: number): string {
  const years = [2024, 2025, 2026, 2027]
    .map((year) => `<option${year === sidebar ? " selected" : ""}>${year}</option>`)
    .join("")
  const buttons = FOOTER.map((key) => `<button type="button" data-action="${esc(key)}">${esc(key)}</button>`).join("")
  return `<div data-slot="footer" data-page="false"><label>FY <select data-year="sidebar">${years}</select></label>${buttons}</div>`
}
