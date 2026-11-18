// Contas da secção 7.18. Mês do dashboard é 1–12. Não é o índice 0–11 do planner.

export type MonthEntry = {
  year: number
  month: number
  ownerId?: string | number
  projId?: string | number
  projectId?: string | number
  budget?: number
  actual?: number
  forecast?: number
}

export type BudgetData = {
  opexOwners?: { id: string | number; budget?: number }[]
  opexEntries?: MonthEntry[]
  capexProjects?: { id: string | number; budget?: number }[]
  capexEntries?: MonthEntry[]
}

export type BudgetTotals = {
  opexBudget: number
  opexActual: number
  opexForecast: number
  capexBudget: number
  capexActual: number
  capexForecast: number
  totalBudget: number
  totalActual: number
  totalForecast: number
}

/** `entry.budget` definido e `> 0` substitui o anual/12. `0` e ausência não são zero. */
export function effectiveMonthlyBudget(entryBudget: number | undefined, annual: number | undefined): number {
  if (entryBudget !== undefined && entryBudget > 0) return entryBudget
  return (annual || 0) / 12
}

export function computeBudgetTotals(data: BudgetData, year: number): BudgetTotals {
  const opexEntries = (data.opexEntries || []).filter((entry) => entry.year === year)
  const capexEntries = (data.capexEntries || []).filter((entry) => entry.year === year)
  let opexBudget = 0
  let opexActual = 0
  let opexForecast = 0
  for (const owner of data.opexOwners || []) {
    const ownerEntries = opexEntries.filter((entry) => entry.ownerId == owner.id)
    for (let month = 1; month <= 12; month++) {
      const found = ownerEntries.find((entry) => entry.month === month)
      opexBudget += effectiveMonthlyBudget(found?.budget, owner.budget)
    }
    opexActual += ownerEntries.reduce((sum, entry) => sum + (entry.actual || 0), 0)
    opexForecast += ownerEntries.reduce((sum, entry) => sum + (entry.forecast || 0), 0)
  }
  let capexBudget = 0
  let capexActual = 0
  let capexForecast = 0
  for (const project of data.capexProjects || []) {
    const projectEntries = capexEntries.filter((entry) => entry.projId == project.id || entry.projectId == project.id)
    for (let month = 1; month <= 12; month++) {
      const found = projectEntries.find((entry) => entry.month === month)
      capexBudget += effectiveMonthlyBudget(found?.budget, project.budget)
    }
    capexActual += projectEntries.reduce((sum, entry) => sum + (entry.actual || 0), 0)
    capexForecast += projectEntries.reduce((sum, entry) => sum + (entry.forecast || 0), 0)
  }
  return {
    opexBudget,
    opexActual,
    opexForecast,
    capexBudget,
    capexActual,
    capexForecast,
    totalBudget: opexBudget + capexBudget,
    totalActual: opexActual + capexActual,
    totalForecast: opexForecast + capexForecast,
  }
}

export function sumOwnerBudget(data: BudgetData): number {
  const opex = (data.opexOwners || []).reduce((sum, owner) => sum + (owner.budget || 0), 0)
  const capex = (data.capexProjects || []).reduce((sum, project) => sum + (project.budget || 0), 0)
  return opex + capex
}

/** Relatório usa a soma dos 12 meses, não a soma de `owner.budget`. */
export function executiveReportTotals(data: BudgetData, year: number): BudgetTotals {
  return computeBudgetTotals(data, year)
}

/** Dashboard não tem FX. O ecrã prefixa `$`. Não é a taxa do planner nem a do procurement. */
export function dashboardMoney(amount: number): string {
  return `$${amount}`
}

/** Série do gráfico: `total/12` plano. Não é o budget efectivo mês a mês. */
export function budgetChartSeries(totalBudget: number): number[] {
  const flat = totalBudget / 12
  return Array.from({ length: 12 }, () => flat)
}

export function cents(amount: number): number {
  return Math.round(amount * 100) / 100
}

export type YearAmountResult =
  | { cleared: true }
  | { cleared: false; per: number; last: number; actual: number[]; forecast: number[] }

export type YearAmountParse =
  | { kind: "clear" }
  | { kind: "invalid" }
  | { kind: "value"; amount: number }

/**
 * Null, blank, or a string that strips to empty clears. That empty strip is not zero.
 * NaN, Infinity, negatives, and a stripped string that is not a finite nonnegative number are invalid.
 */
export function parseYearAmount(raw: unknown): YearAmountParse {
  if (raw === null || raw === undefined) return { kind: "clear" }
  if (typeof raw === "number") return finiteYearAmount(raw)
  if (typeof raw !== "string") return { kind: "invalid" }
  if (raw.trim() === "") return { kind: "clear" }
  const stripped = raw.replace(/[^0-9.\-]/g, "")
  if (stripped === "") return { kind: "clear" }
  return finiteYearAmount(Number(stripped))
}

/**
 * Year amount. Forecast dos 12 meses é `per`, incluindo o mês M.
 * Limpar não devolve meses: as entries ficam como estão.
 * Entrada inválida lança RangeError; não limpa.
 */
export function applyYearAmount(raw: string | number | null | undefined, currentMonth: number): YearAmountResult {
  const parsed = parseYearAmount(raw)
  if (parsed.kind === "clear") return { cleared: true }
  if (parsed.kind === "invalid") throw new RangeError("invalid year amount")
  const amount = parsed.amount
  const per = cents(amount / currentMonth)
  const last = cents(amount - per * (currentMonth - 1))
  const actual = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    if (month < currentMonth) return per
    if (month === currentMonth) return last
    return 0
  })
  const forecast = Array.from({ length: 12 }, () => per)
  return { cleared: false, per, last, actual, forecast }
}

function finiteYearAmount(amount: number): YearAmountParse {
  if (!Number.isFinite(amount) || amount < 0) return { kind: "invalid" }
  return { kind: "value", amount: amount === 0 ? 0 : amount }
}

/** Annual Entry ÷12, sem resto no último. Não é o year amount. */
export function annualEntryMonths(annual: number): number[] {
  const month = Math.round((annual / 12) * 100) / 100
  return Array.from({ length: 12 }, () => month)
}

export function costPerUser(total: number, itUsers: number): number {
  if (!itUsers) return 0
  return total / itUsers
}

export function costPerUserTone(ratio: number, benchmark: number): "green" | "red" {
  if (ratio <= benchmark) return "green"
  return "red"
}

export type ItUsersEntry = { year: number; month: number; users: number }

export function itUsersForMonth(entries: ItUsersEntry[], month: number, year: number): number {
  const inYear = entries.filter((entry) => entry.year === year).sort((a, b) => a.month - b.month)
  const exact = inYear.find((entry) => entry.month === month)
  if (exact) return exact.users
  const prior = inYear.filter((entry) => entry.month <= month).pop()
  if (prior) return prior.users
  const all = entries.slice().sort((a, b) => a.year - b.year || a.month - b.month)
  return all.length ? all[all.length - 1].users : 0
}

/** Escrita do Executive: vazio grava 0. Não apaga. */
export function itUsersWrite(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined || String(raw).trim() === "") return 0
  const value = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isFinite(value)) return 0
  return value
}

export function isYearDeparture(status: string, end: string | undefined, year: string): boolean {
  return status === "Terminated" && !!end && end.startsWith(year)
}

export function attritionYtd(yearDepartures: number, active: number): number {
  return (yearDepartures / (active + yearDepartures / 2)) * 100
}

export function attritionTone(pct: number): "red" | "amber" | "green" {
  if (pct > 15) return "red"
  if (pct > 8) return "amber"
  return "green"
}

export function riskScore(impact: number, probability: number): number {
  return impact * probability
}

export function riskTier(score: number): "Critical" | "Very High" | "High" | "Medium" | "Low" {
  if (score > 20) return "Critical"
  if (score >= 16) return "Very High"
  if (score >= 9) return "High"
  if (score >= 3) return "Medium"
  return "Low"
}

/** `parseInt || 1`. Vazio e 0 gravam 1. Sem max. 6 fica 6. */
export function riskFactorWrite(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined || String(raw).trim() === "") return 1
  const value = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10)
  if (!value) return 1
  return value
}

export const SECURITY_KPIS = [
  { key: "training", target: 95, moderate: 80, better: "high" as const },
  { key: "patch", target: 95, moderate: 70, better: "high" as const },
  { key: "patchEndpoint", target: 95, moderate: 70, better: "high" as const },
  { key: "patchServer", target: 95, moderate: 70, better: "high" as const },
  { key: "scan", target: 95, moderate: 85, better: "high" as const },
  { key: "assessment", target: 80, moderate: 70, better: "high" as const },
  { key: "socPending", target: 0, moderate: 5, better: "low" as const },
  { key: "socClosure", target: 100, moderate: 95, better: "high" as const },
]

export function securityKpiStatus(
  better: "low" | "high",
  target: number,
  moderate: number,
  value: number | string | null | undefined,
): "No data" | "Good" | "Moderate" | "High risk" {
  if (value == null || value === "" || (typeof value === "number" && Number.isNaN(value))) return "No data"
  const parsed = typeof value === "number" ? value : Number(value)
  if (Number.isNaN(parsed)) return "No data"
  const good = better === "low" ? parsed <= target : parsed >= target
  const mid = better === "low" ? parsed <= moderate : parsed >= moderate
  if (good) return "Good"
  if (mid) return "Moderate"
  return "High risk"
}

export type SeverityEntry = {
  socCritical?: number | string | null
  socHigh?: number | string | null
  socMedium?: number | string | null
  socLow?: number | string | null
  socPending?: number | string | null
  socClosure?: number | string | null
}

function severityNumber(value: number | string | null | undefined): number | null {
  if (value === "" || value == null || (typeof value === "number" && Number.isNaN(value))) return null
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return null
  return parsed
}

/** Soma 0 não divide. O campo fica. Vazio no entry não é 0. */
export function socClosureValue(entry: SeverityEntry): number | null {
  const parts = [entry.socCritical, entry.socHigh, entry.socMedium, entry.socLow].map(severityNumber)
  const total = parts.every((part) => part === null) ? null : parts.reduce<number>((sum, part) => sum + (part || 0), 0)
  if (total) return Math.round(((total - (severityNumber(entry.socPending) || 0)) / total) * 1000) / 10
  return severityNumber(entry.socClosure)
}

export function relevance(biz: number, iti: number): number {
  return biz * iti
}

export function relevanceTier(score: number): "action" | "monitor" | "low" {
  if (score > 16) return "action"
  if (score > 9) return "monitor"
  return "low"
}

export function stakeholderCategory(score: number, perception: number): string {
  const high = score > 9
  const band = perception >= 4 ? "positive" : perception <= 2 ? "negative" : "neutral"
  if (high && band === "positive") return "Champion"
  if (high && band === "negative") return "Sceptic"
  if (high) return "Engaged Neutral"
  if (band === "positive") return "Ally"
  if (band === "negative") return "Low Engagement"
  return "Passive"
}

/** `biz`, `iti`, `perc` vazios gravam 1. */
export function stakeholderFactorWrite(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined || String(raw).trim() === "") return 1
  const value = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isFinite(value)) return 1
  return value
}

export type PerfSub = { score: number | string | null | undefined; totalWeight: number; status?: string }

export function itPerfScore(subs: PerfSub[]): number | null {
  const scored = subs.filter((sub) => sub.score !== "" && sub.score != null && !Number.isNaN(Number(sub.score)))
  const weight = scored.reduce((sum, sub) => sum + (sub.totalWeight || 0), 0)
  if (!scored.length || !weight) return null
  const weighted = scored.reduce((sum, sub) => sum + Number(sub.score) * (sub.totalWeight || 0), 0)
  return weighted / weight
}

export function isOnTarget(status: string | undefined): boolean {
  return status === "ahead" || status === "on" || status === "complete"
}

export function onTargetCount(subs: PerfSub[]): number {
  return subs.filter((sub) => isOnTarget(sub.status)).length
}

export function heatCell(p1: number, p2: number, tickets: number): { bg: string; dot: string } {
  if (!p1 && !p2 && !tickets) return { bg: "", dot: "⚪" }
  if (p1 >= 2) return { bg: "rgba(239,68,68,.18)", dot: "🔴" }
  if (p1 >= 1 || p2 >= 5) return { bg: "rgba(245,158,11,.18)", dot: "🟠" }
  if (p2 >= 1 || tickets >= 20) return { bg: "rgba(234,179,8,.10)", dot: "🟡" }
  return { bg: "rgba(20,184,166,.08)", dot: "🟢" }
}

export function phishRate(count: number, targeted: number): number | null {
  if (!targeted) return null
  return (count / targeted) * 100
}

export function phishTone(better: "low" | "high", pct: number | null, target: number, moderate: number): "none" | "good" | "moderate" | "high" {
  if (pct == null) return "none"
  if (better === "low") return pct < target ? "good" : pct < moderate ? "moderate" : "high"
  return pct > target ? "good" : pct > moderate ? "moderate" : "high"
}

export function deptFailColor(fail: number | null): "red" | "amber" | "green" {
  if (fail != null && fail >= 40) return "red"
  if (fail != null && fail >= 20) return "amber"
  return "green"
}

export function itPerfColor(score: number | null): "muted" | "green" | "blue" | "amber" | "red" {
  if (score == null) return "muted"
  if (score >= 4.5) return "green"
  if (score >= 3.5) return "blue"
  if (score >= 2.5) return "amber"
  return "red"
}

export function itPerfWeightWarn(total: number, against: number): boolean {
  return Math.abs(total - against) > 0.005
}

export function itPerfOwnerOver(total: number, owner: number, co1: number, co2: number): boolean {
  return owner + co1 + co2 - total > 0.0005
}

export function completedQuarter(month: number): "q4" | "q1" | "q2" | "q3" {
  const current = Math.ceil(month / 3)
  if (current === 1) return "q4"
  if (current === 2) return "q1"
  if (current === 3) return "q2"
  return "q3"
}

export type PmoProject = {
  id: string
  name: string
  createdAt?: string
  milestones?: unknown[]
} & Record<string, unknown>

export function importProjects(
  projects: PmoProject[],
  capexProjects: { id: string }[],
  rows: ({ name: string; _status?: string } & Record<string, unknown>)[],
  mode: "replace" | "update",
  confirmed: boolean,
  today: string,
  nextId: () => string,
): { ok: false } | { ok: true; projects: PmoProject[]; capexProjects: { id: string }[]; added: number; updated: number } {
  const valid = rows.filter((row) => row._status !== "error")
  if (!valid.length) return { ok: false }
  if (mode === "replace" && confirmed !== true) return { ok: false }
  const next = mode === "replace" ? [] : projects.map((project) => ({ ...project }))
  let added = 0
  let updated = 0
  for (const row of valid) {
    const existing = next.find((project) => project.name.toLowerCase().trim() === row.name.toLowerCase().trim())
    const written = {
      name: row.name,
      desc: row.desc,
      status: row.status,
      risk: row.risk,
      priority: row.priority,
      pm: row.pm,
      leaderId: row.leaderId,
      start: row.start,
      end: row.end,
      budget: row.budget,
      spent: row.spent,
      pct: row.pct,
      notes: row.notes,
      updatedAt: today,
    }
    if (existing) {
      Object.assign(existing, written)
      updated++
    } else {
      next.push({ id: nextId(), createdAt: today, milestones: [], ...written })
      added++
    }
  }
  return { ok: true, projects: next, capexProjects: capexProjects.slice(), added, updated }
}

// Secção 6. projects do PMO não é capexProjects. Apagar um não apaga o outro.
export function deletePmoProject<T extends { id: string }, C extends { id: string }>(projects: T[], capexProjects: C[], id: string): { projects: T[]; capexProjects: C[] } {
  return { projects: projects.filter((project) => project.id !== id), capexProjects: capexProjects.slice() }
}

export function deleteBudgetProject<T extends { id: string }>(projects: T[], capexProjects: T[], id: string): { projects: T[]; capexProjects: T[] } {
  return { projects: projects.slice(), capexProjects: capexProjects.filter((project) => project.id !== id) }
}
