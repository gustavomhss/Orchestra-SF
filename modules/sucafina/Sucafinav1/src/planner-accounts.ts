// Contas da secção 8.8. Outlook e spread usam índice 0–11. HR e FTE usam mês 1–12. Não se unifica com o mês 1–12 do dashboard.

export function cents(amount: number): number {
  return Math.round(amount * 100) / 100
}

export type LineMonths = {
  annual: number
  b: number[]
  bm: boolean[]
}

export function emptyFlags(): boolean[] {
  return Array.from({ length: 12 }, () => false)
}

export function zeroMonths(): number[] {
  return Array.from({ length: 12 }, () => 0)
}

/** Spread. Último aberto leva o resto. Se não há mês aberto, limpa as flags e corre outra vez. */
export function spread(line: LineMonths): LineMonths {
  const manual = line.bm.map(Boolean)
  const open = manual.filter((flag) => !flag).length
  if (open === 0) return spread({ annual: line.annual, b: line.b.slice(), bm: emptyFlags() })
  const fixed = manual.reduce((sum, flag, index) => sum + (flag ? +line.b[index] || 0 : 0), 0)
  const rest = (+line.annual || 0) - fixed
  const each = Math.trunc((rest / open) * 100) / 100
  const next = line.b.slice()
  let last = -1
  for (let index = 0; index < 12; index++) {
    if (manual[index]) continue
    next[index] = each
    last = index
  }
  next[last] = cents(rest - each * (open - 1))
  return { annual: line.annual, b: next, bm: manual }
}

export function typeMonth(line: LineMonths, index: number, raw: number | null | undefined): LineMonths {
  const bm = line.bm.slice()
  const b = line.b.slice()
  bm[index] = true
  b[index] = raw == null || Number.isNaN(Number(raw)) ? 0 : Number(raw)
  return { annual: cents(b.reduce((sum, value) => sum + (+value || 0), 0)), b, bm }
}

export function changeAnnual(line: LineMonths, annual: number): LineMonths {
  return spread({ ...line, annual })
}

export function resetSpread(line: LineMonths): LineMonths {
  return spread({ annual: line.annual, b: line.b.slice(), bm: emptyFlags() })
}

/** `m` é 0–11. Mês fechado: actual, null conta 0. Aberto: forecast se não é null, e 0 conta. Senão budget. */
export function outlookMonth(monthIndex: number, closed: number, actual: number | null, forecast: number | null, budget: number): number {
  if (monthIndex < closed) return actual == null ? 0 : actual
  if (forecast != null) return forecast
  return budget
}

export function variance(outlook: number, budget: number): { value: number; over: boolean; shown: number | "–" } {
  const value = outlook - budget
  if (Math.abs(value) < 0.5) return { value, over: value > 0, shown: "–" }
  return { value, over: value > 0, shown: value }
}

export function ytd(months: number[], closed: number): number {
  if (closed === 0) return 0
  return months.slice(0, closed).reduce((sum, value) => sum + value, 0)
}

export function usdAmount(amount: number, currency: string, rate: number | null | undefined): { usd: number; warning: string | null } {
  const code = String(currency || "USD").toUpperCase()
  if (code === "USD") return { usd: amount * 1, warning: null }
  if (rate == null || !(rate > 0)) return { usd: 0, warning: code }
  return { usd: amount * rate, warning: null }
}

export function hrMonth(
  include: boolean,
  hasRate: boolean,
  fte: number,
  annual: number,
  fx: number,
  month: number,
  start: number,
  end: number,
  incMonth: number,
  incPercent: number,
): number {
  if (!include || !hasRate) return 0
  if (month < start || month > end) return 0
  const factor = month >= incMonth ? 1 + incPercent / 100 : 1
  return cents((fte * annual * fx) / 12 * factor)
}

export type RateCard = { id: string; name: string; locs: string; annual: number; cur: string }

export function normName(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()
}

export function chosenRate(
  cards: RateCard[],
  type: string,
  location: string | null | undefined,
  rateId: string | null | undefined,
  override: number | string | null | undefined,
): { annual: number; cur: string } | null {
  const selected = rateId ? cards.find((card) => card.id === rateId) || null : autoRate(cards, type, location)
  if (override != null && override !== "") {
    if (!selected) return null
    return { annual: +override, cur: selected.cur }
  }
  if (!selected) return null
  return { annual: selected.annual, cur: selected.cur }
}

export function autoRate(cards: RateCard[], type: string, location: string | null | undefined): RateCard | null {
  if (type === "Contractor") return cards.find((card) => /contract/i.test(card.name)) || null
  const loc = normName(location || "")
  if (!loc) return null
  return (
    cards.find((card) => {
      if (/contract/i.test(card.name)) return false
      return String(card.locs || "")
        .split(",")
        .map(normName)
        .filter(Boolean)
        .some((item) => loc === item || loc.includes(item))
    }) || null
  )
}

export type HrAf = { a?: (number | null)[]; f?: (number | null)[]; owner?: string; entity?: string; alloc?: string }

export type Position = {
  include: boolean
  domain?: string
  fte: number
  start: number
  end: number
  type: string
  location?: string
  rateId?: string | null
  rateOverride?: number | string | null
  months: number[]
}

export function syntheticHr(domain: string, positions: Position[], af: HrAf | undefined): {
  budget: number[]
  annual: number
  actual: (number | null)[] | undefined
  forecast: (number | null)[] | undefined
  owner: string
  entity: string
  alloc: string
} {
  const budget = zeroMonths()
  for (const position of positions) {
    position.months.forEach((value, index) => {
      budget[index] = cents(budget[index] + value)
    })
  }
  return {
    budget,
    annual: cents(budget.reduce((sum, value) => sum + value, 0)),
    actual: af?.a,
    forecast: af?.f,
    owner: af?.owner || "",
    entity: af?.entity || "",
    alloc: af?.alloc || "",
  }
}

export function hrLineDomains(positions: { domain?: string }[], hrAF: Record<string, unknown>): string[] {
  const fromPositions = positions.map((position) => position.domain).filter((domain): domain is string => !!domain)
  return [...new Set([...fromPositions, ...Object.keys(hrAF)])]
}

export function clampFte(value: number | null | undefined): number {
  if (value == null || Number.isNaN(Number(value))) return 1
  if (value < 0) return 0
  if (value > 2) return 2
  return value
}

export function orderSpan(start: number, end: number): { start: number; end: number } {
  if (start > end) return { start: end, end: start }
  return { start, end }
}

export function fteDecember(positions: { include: boolean; fte?: number | null; start?: number | null; end?: number | null }[]): number {
  return positions.reduce((sum, position) => {
    if (!position.include) return sum
    if (position.start == null || position.end == null || position.fte == null) return sum
    if (position.start <= 12 && position.end >= 12) return sum + position.fte
    return sum
  }, 0)
}

export const OPEX_ELEMENTS = ["licenses", "services", "hwo", "depr", "hr", "fac", "te", "oth"] as const

export function projectElements(): string[] {
  return OPEX_ELEMENTS.filter((element) => element !== "depr")
}

export type MoneyLine = { sec: "opex" | "capex"; el: string; cls?: string; synthetic?: boolean; usd: number }

export function natureTotals(lines: MoneyLine[]): { opex: number; capex: number } {
  const opexTab = lines.filter((line) => line.sec === "opex").reduce((sum, line) => sum + line.usd, 0)
  const projectOpex = lines
    .filter((line) => line.sec === "capex" && line.cls === "opex" && line.el !== "depr")
    .reduce((sum, line) => sum + line.usd, 0)
  const capex = lines
    .filter((line) => line.sec === "capex" && line.cls !== "opex" && line.el !== "depr")
    .reduce((sum, line) => sum + line.usd, 0)
  return { opex: opexTab + projectOpex, capex }
}

export function nextCpx(year: number, counter: number, codes: string[]): { n: number; code: string; counter: number } {
  let max = counter
  for (const code of codes) {
    const match = String(code).match(/^CPX-\d{4}-(\d+)$/i)
    if (match) max = Math.max(max, Number(match[1]))
  }
  const n = max + 1
  return { n, code: `CPX-${year}-${String(n).padStart(3, "0")}`, counter: n }
}

export function effectiveOwner(lineOwner: string, sec: string, projectOwner: string, domainLeaders: string[]): string[] {
  if (lineOwner) return [lineOwner]
  if (sec === "capex" && projectOwner) return [projectOwner]
  if (sec === "hr") return domainLeaders
  return []
}

const LOCKED_FIELDS = new Set([
  "budget",
  "structure",
  "entity",
  "allocation",
  "classification",
  "currency",
  "fx",
  "headcount",
  "rate",
  "increase",
  "year",
])

export function lockAllows(field: string, locked: boolean, official: boolean, canWrite: boolean): boolean {
  if (official && (field === "delete" || field === "unlock")) return false
  if (!locked) return true
  if (field === "closedThrough") return canWrite
  if (LOCKED_FIELDS.has(field)) return false
  return true
}

export type RosterPerson = {
  name: string
  status?: string
  start?: string
  end?: string
  leader?: string
  domain?: string
  gone?: boolean
}

export function startMonth(start: string | undefined, planYear: number): number {
  if (!start) return 1
  const year = Number(start.slice(0, 4))
  const month = Number(start.slice(5, 7))
  if (year > planYear) return 13
  if (year < planYear) return 1
  return month
}

export function isGone(person: RosterPerson): boolean {
  if (person.gone) return true
  const endMonth = person.end ? Number(person.end.slice(5, 7)) : null
  if (endMonth === 0) return true
  return person.status === "Terminated" && !person.end
}

export function syncEnters(person: RosterPerson, planYear: number): boolean {
  return !isGone(person) && startMonth(person.start, planYear) !== 13
}

export type PlanPerson = { name: string; end?: number; left?: boolean; domain?: string; domainManual?: boolean }

export function syncRoster(
  positions: PlanPerson[],
  roster: RosterPerson[],
  planYear: number,
  leaderDomains: Record<string, string>,
  locked: boolean,
): { ok: true; positions: PlanPerson[] } | { ok: false } {
  if (locked) return { ok: false }
  const next = positions.map((position) => {
    const person = roster.find((item) => normName(item.name) === normName(position.name))
    if (!person) return { ...position, left: true }
    const rosterEnd = person.end ? Number(person.end.slice(5, 7)) : null
    const end = rosterEnd != null && position.end != null && rosterEnd < position.end ? rosterEnd : position.end
    return {
      ...position,
      end,
      domain: syncDomain(position.domainManual === true, position.domain ?? "", person.leader, leaderDomains, person.domain),
    }
  })
  return { ok: true, positions: next }
}

export function applyRemoveMissing<L extends { id: string; sec: string }, P extends { id: string }>(
  lines: L[],
  projects: { id: string }[],
  positions: P[],
  seen: { opex: string[]; capex: string[] },
  seenPositions: string[],
  sheets: { opex?: boolean; capex?: boolean; headcount?: boolean },
  budgetOK: boolean,
  remove: boolean,
): { lines: L[]; projects: { id: string }[]; positions: P[] } {
  const nextLines = remove && budgetOK ? lines.filter((line) => !sheets[line.sec as "opex" | "capex"] || seen[line.sec as "opex" | "capex"].includes(line.id)) : lines.slice()
  const nextPositions = remove && budgetOK && sheets.headcount ? positions.filter((position) => seenPositions.includes(position.id)) : positions.slice()
  return { lines: nextLines, projects: projects.slice(), positions: nextPositions }
}

export function syncDomain(
  manual: boolean,
  current: string,
  leader: string | undefined,
  leaderDomains: Record<string, string>,
  rosterDomain: string | undefined,
): string {
  if (manual) return current
  if (leader && leaderDomains[leader]) return leaderDomains[leader]
  if (rosterDomain) return rosterDomain
  return "Unassigned"
}
