import type { Period } from "../contracts/context.ts"
import type { PortResult } from "../contracts/ports.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { ReviewAgendaItem } from "./selection.ts"

export type ReviewAgendaDomain = "dashboard" | "planner" | "procurement"
export type ReviewAgendaDiscoveryQuery = { period: Period; domain?: ReviewAgendaDomain }
export type ReviewAgendaOption = { key: string; label: string; domain: ReviewAgendaDomain; item: ReviewAgendaItem }
export type ReviewAgendaCatalog = { options: readonly ReviewAgendaOption[] }
export type ReviewAgendaDiscovery = (query: ReviewAgendaDiscoveryQuery) => Promise<PortResult<ReviewAgendaCatalog>>

/** Discovery supplies selectors only; the existing agenda port prepares and rechecks their content. */
export function createReviewAgendaDiscoveryBrowser(): ReviewAgendaDiscovery {
  return async (query) => {
    if (!isSfPeriod(query.period)) return { status: "needs-input", reason: "invalid-agenda-period" }
    const url = new URL(window.location.href)
    url.search = new URLSearchParams({ sf: "review-agenda", start: query.period.start, end: query.period.end,
      ...(query.domain ? { domain: query.domain } : {}) }).toString()
    url.hash = ""
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store" }).catch(() => undefined)
    if (!response) return { status: "unavailable", reason: "agenda-discovery-unavailable" }
    const destination = new URL(response.url || url.toString(), url)
    if (response.status === 401 || response.status === 403 || response.redirected && destination.origin === url.origin && /\/auth\/login\/?$/.test(destination.pathname))
      return { status: "denied", reason: "agenda-access-unavailable" }
    const result: unknown = await response.json().catch(() => undefined)
    if (!result || typeof result !== "object" || !("status" in result)) return { status: "unavailable", reason: "agenda-discovery-unavailable" }
    if (result.status !== "ok") {
      if (["denied", "stale", "conflict", "needs-input", "unavailable"].includes(String(result.status)) && "reason" in result && typeof result.reason === "string")
        return { status: result.status, reason: result.reason } as Exclude<PortResult<ReviewAgendaCatalog>, { status: "ok" }>
      return { status: "unavailable", reason: "agenda-discovery-unavailable" }
    }
    if (!response.ok || !("value" in result) || !validCatalog(result.value)) return { status: "unavailable", reason: "agenda-catalog-invalid" }
    return { status: "ok", value: result.value }
  }
}

/** No discovery result is automatically selected, including after a period or source change. */
export function createReviewAgendaPicker(input: {
  discover: ReviewAgendaDiscovery
  period?: Period
  selected: () => readonly ReviewAgendaItem[]
  busy: () => boolean
  add: (option: ReviewAgendaOption) => void
  refresh: (option: ReviewAgendaOption) => void
  denied: () => void
}) {
  const root = document.createElement("section")
  root.setAttribute("aria-label", "Agenda topics")
  const heading = document.createElement("h4")
  heading.textContent = "Discover agenda topics"
  const start = document.createElement("input"), end = document.createElement("input"), domain = document.createElement("select")
  start.type = "date"; end.type = "date"
  start.value = input.period?.start ?? ""; end.value = input.period?.end ?? ""
  for (const [value, label] of [["", "All domains"], ["dashboard", "Dashboard"], ["planner", "Planner / Forecast"], ["procurement", "Procurement"]]) {
    const option = document.createElement("option"); option.value = value!; option.textContent = label!; domain.append(option)
  }
  root.append(heading)
  for (const [text, control] of [["Period start", start], ["Period end", end], ["Domain", domain]] as const) {
    control.setAttribute("aria-label", text)
    const label = document.createElement("label"); label.append(document.createTextNode(text), control); root.append(label)
  }
  const search = document.createElement("button"), status = document.createElement("p"), results = document.createElement("ul")
  search.type = "button"; search.textContent = "Discover agenda topics"
  status.setAttribute("aria-live", "polite"); results.setAttribute("aria-label", "Available agenda topics")
  status.textContent = "Choose a period and discover the sources you can currently access. Adding a topic does not preserve a review."
  root.append(search, status, results)
  let generation = 0, closed = false, loading = false
  let options: readonly ReviewAgendaOption[] = []
  const update = () => {
    const disabled = closed || loading || input.busy()
    search.disabled = disabled; start.disabled = disabled; end.disabled = disabled; domain.disabled = disabled
    results.replaceChildren()
    if (closed) return
    for (const option of options) {
      const row = document.createElement("li"), title = document.createElement("span"), add = document.createElement("button")
      title.textContent = `${option.label} · ${option.domain} · ${option.item.period.start} – ${option.item.period.end}`
      const selected = input.selected().some((item) => sameReviewAgendaItem(item, option.item))
      add.type = "button"; add.textContent = `${selected ? "Refresh" : "Add"} ${option.label}`
      add.disabled = disabled
      const turn = generation
      add.addEventListener("click", () => {
        if (closed || turn !== generation || input.busy()) return
        if (selected) input.refresh(structuredClone(option))
        else input.add(structuredClone(option))
        update()
      })
      row.append(title, add); results.append(row)
    }
  }
  const clear = () => { generation++; loading = false; options = []; results.replaceChildren(); update() }
  const discover = async () => {
    if (closed || loading || input.busy()) return
    const period = { start: start.value, end: end.value }
    if (!isSfPeriod(period)) { status.textContent = "Choose a valid start and end date."; return }
    const turn = ++generation
    loading = true; options = []; status.textContent = "Checking authorized agenda sources…"; update()
    const result = await input.discover({ period, ...(domain.value ? { domain: domain.value as ReviewAgendaDomain } : {}) }).catch(() => undefined)
    if (closed || turn !== generation) return
    loading = false
    if (result?.status === "denied") { revoke(); input.denied(); return }
    if (!result || result.status !== "ok" || !validCatalog(result.value)) {
      status.textContent = "Sources could not be loaded. Your selected topics are retained; retry discovery."; update(); return
    }
    options = structuredClone(result.value.options)
    status.textContent = options.length ? `${options.length} authorized topics available. Choose each topic explicitly.` : "No authorized topics are available for this domain and period."
    update()
  }
  const revoke = () => { closed = true; clear(); start.value = ""; end.value = ""; status.textContent = "Access changed. Reopen an authorized preparation to discover topics." }
  search.addEventListener("click", () => { void discover() })
  for (const control of [start, end, domain]) control.addEventListener("change", () => { clear(); status.textContent = "Discover the sources for this period. Your selected topics keep their own periods." })
  return { element: root, discover, update, clear, revoke, dispose: () => { revoke(); root.replaceChildren() } }
}

export function reviewAgendaItemLabel(item: ReviewAgendaItem) {
  if (item.kind !== "dashboard") return item.title
  const labels: Record<string, string> = { budget: "Budget", projects: "Projects", "hot-topics": "Hot Topics", "talent-review": "Talent Review", "opex-detail": "OPEX Detail", "capex-projects": "CAPEX Projects", headcount: "Headcount", "team-structure": "Team Structure", "all-projects": "All Projects", "it-operations": "IT Operations", "it-security": "IT Security", "it-risks": "IT Risks", "vendor-contracts": "Vendor Contracts", stakeholders: "Stakeholders", executive: "Executive Dashboard", "it-performance": "IT Performance Contract" }
  return labels[item.topic] ?? "Dashboard topic"
}

export function sameReviewAgendaItem(left: ReviewAgendaItem, right: ReviewAgendaItem) {
  if (left.kind !== right.kind || left.period.start !== right.period.start || left.period.end !== right.period.end) return false
  if (left.kind === "dashboard" && right.kind === "dashboard") return left.topic === right.topic
  return left.id === right.id
}

function validCatalog(value: unknown): value is ReviewAgendaCatalog {
  if (!value || typeof value !== "object" || !("options" in value) || !Array.isArray(value.options)) return false
  return new Set(value.options.map((option: unknown) => option && typeof option === "object" && "key" in option ? option.key : undefined)).size === value.options.length &&
    value.options.every((option: unknown) => {
      if (!option || typeof option !== "object" || !("key" in option) || typeof option.key !== "string" || !option.key || !("label" in option) || typeof option.label !== "string" || !option.label.trim() || !("domain" in option) || !["dashboard", "planner", "procurement"].includes(String(option.domain)) || !("item" in option) || !option.item || typeof option.item !== "object") return false
      const item = option.item as Partial<ReviewAgendaItem>
      if (typeof item.id !== "string" || !item.id || !isSfPeriod(item.period)) return false
      if (item.kind === "dashboard") return option.domain === "dashboard" && typeof item.topic === "string" && typeof item.selectionRef === "string" && !!item.selectionRef
      if (item.kind === "forecast-comparison") return option.domain === "planner" && typeof item.title === "string" && typeof item.baseRef === "string" && typeof item.candidateRef === "string" && typeof item.currency === "string" && Array.isArray(item.sides) && item.sides.length > 0 && item.sides.every((side) => side === "baseline" || side === "candidate")
      if (option.domain !== "procurement" || typeof item.title !== "string") return false
      if (item.kind === "procurement-request") return typeof item.requestRef === "string" && !!item.requestRef
      if (item.kind !== "procurement-supplier" && item.kind !== "procurement-contract") return false
      return typeof (item.kind === "procurement-supplier" ? item.supplierRef : item.contractRef) === "string" && Array.isArray(item.fields) && item.fields.length > 0 && item.fields.every((field) => typeof field === "string" && !!field)
    })
}
