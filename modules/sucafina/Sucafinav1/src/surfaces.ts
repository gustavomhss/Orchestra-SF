// Secções 7.0, 8.0 e 9.0. showPage só desenha chave que existe. Rodapé, Excel e detalhe não são páginas a mais.

import { budgetCard, readMember } from "./dashboard-role.ts"
import type { AuditLine, Member } from "./dashboard-role.ts"
import { budgetChartSeries, executiveReportTotals } from "./dashboard-accounts.ts"
import type { BudgetData } from "./dashboard-accounts.ts"
import { surfaceAdmin } from "./identity.ts"
import type { ResolvedActor } from "./identity.ts"
import { writeVersioned } from "./records.ts"
import type { Change, Versioned } from "./records.ts"
import { DASHBOARD_PAGES, DASHBOARD_START, openDashboard } from "./nav.ts"

export {
  DASHBOARD_PAGES,
  DASHBOARD_START,
  FOOTER,
  PLANNER_DEFAULT,
  PLANNER_TABS,
  PROCUREMENT_NAV,
  budgetLineWrite,
  dashboardPages,
  dashboardWrite,
  excelFile,
  openDashboard,
  openPlanner,
  openProcurement,
  setYear,
  showPage,
  sidebarYear,
  yearFor,
} from "./nav.ts"

export function setViewerSummaries(
  current: Versioned<string[]> | null,
  pages: readonly string[],
  version: number,
  actor: ResolvedActor,
  at: string,
  audit: Change[],
): { ok: true; row: Versioned<string[]> } | { ok: false; status?: 409; stored?: string[]; by?: string } {
  if (!surfaceAdmin(actor, "dashboard")) return { ok: false }
  const extras = DASHBOARD_PAGES.filter((page) => page !== DASHBOARD_START && pages.includes(page))
  return writeVersioned(current, version, [...extras], actor, at, audit)
}

export function setBudgetLines(
  current: Versioned<string[]> | null,
  ids: readonly string[],
  version: number,
  actor: ResolvedActor,
  at: string,
  audit: Change[],
): { ok: true; row: Versioned<string[]> } | { ok: false; status?: 409; stored?: string[]; by?: string } {
  if (!surfaceAdmin(actor, "dashboard")) return { ok: false }
  return writeVersioned(current, version, uniqueTrimmed(ids), actor, at, audit)
}

function uniqueTrimmed(ids: readonly string[]): string[] {
  const next: string[] = []
  for (const id of ids) {
    const trimmed = id.trim()
    if (!trimmed || next.includes(trimmed)) continue
    next.push(trimmed)
  }
  return next
}

export function importDataset(actor: { roles: string[] }, next: unknown, confirmed: boolean): { ok: true; data: unknown } | { ok: false } {
  if (!actor.roles.includes("admin") || confirmed !== true) return { ok: false }
  return { ok: true, data: next }
}

export function reportSlide(metrics: unknown[], rows: unknown[]): { ok: true; metrics: unknown[]; rows: unknown[]; word: false } | { ok: false } {
  if (metrics.length > 6 || rows.length > 12) return { ok: false }
  return { ok: true, metrics, rows, word: false }
}

export function wordScript(
  title: string,
  year: number,
  generated: string,
  topics: { title: string; subtitle?: string; bullets?: string[]; metrics?: { label: string; value: string }[] }[],
): { ok: false } | { ok: true; page: false; title: string; line: string; file: string; sections: { heading: string; subtitle?: string; bullets: string[]; figures?: string }[] } {
  if (!topics.length) return { ok: false }
  const heading = title || "Sucafina IT — CIO Dashboard Report"
  return {
    ok: true,
    page: false,
    title: heading,
    line: `Presenter script · FY ${year} · Generated ${generated}`,
    file: `${heading.replace(/[^a-z0-9]+/gi, "_") || "CIO_Report_Script"}.docx`,
    sections: topics.map((topic, index) => ({
      heading: `${index + 1}. ${topic.title}`,
      subtitle: topic.subtitle,
      bullets: (topic.bullets ?? []).map((bullet) => `» ${bullet}`),
      figures: topic.metrics?.length ? topic.metrics.map((metric) => `${metric.label}: ${metric.value}`).join("  ·  ") : undefined,
    })),
  }
}

export function executiveScreen(data: BudgetData, year: number) {
  const totals = executiveReportTotals(data, year)
  return { ...budgetCard(totals.totalBudget), totals, chart: budgetChartSeries(totals.totalBudget) }
}

export function talentScreen(members: Member[], actor: { id: string; roles: string[] }, at: string, audit: AuditLine[]) {
  if (!openDashboard("Talent Review", actor).drawn) return { drawn: false as const }
  return { drawn: true as const, members: members.map((member) => readMember(member, actor, at, audit)) }
}
