import { expect, test } from "bun:test"
import { displayLabel, fields, form, table } from "../runtime/ui.ts"
import { PlannerModule } from "../runtime/planner.ts"
import { DashboardOperations } from "../runtime/dashboard-operations.ts"

const context = {
  actor: { id: "presentation-admin", roles: ["admin"], canWrite: true },
  year: 2026,
  month: 11,
  at: "2026-11-12T12:00:00Z",
  versions: {},
}

function figure(html: string | undefined, title: string) {
  const found = html?.match(/<figure\b[^>]*>[\s\S]*?<\/figure>/g)?.find((part) => part.includes(`<figcaption>${title}</figcaption>`))
  expect(found).toBeDefined()
  return found!
}

function chartPresentation(html: string, names: string[]) {
  expect(html).toMatch(/<svg[^>]*role="img"[^>]*aria-label="[^"]+"|<svg[^>]*aria-label="[^"]+"[^>]*role="img"/)
  expect(html).toMatch(/<svg[^>]*viewBox="[^"]+"/)
  const legend = html.match(/<ul\b[^>]*class="[^"]*chart-legend[^\"]*"[^>]*>([\s\S]*?)<\/ul>/)?.[1]
  expect(legend).toBeDefined()
  for (const name of names) {
    const item = legend?.match(/<li\b[^>]*>[\s\S]*?<\/li>/g)?.find((item) => item.includes(name))
    expect(item).toBeDefined()
    const color = item?.match(/#[\da-f]{6}/i)?.[0]
    expect(color).toBeDefined()
    expect(html).toContain(`fill="${color}"`)
  }
  const svg = html.match(/<svg\b[\s\S]*?<\/svg>/)?.[0] ?? ""
  const ticks = [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((match) => match[1].replace(/<[^>]*>/g, ""))
  expect(ticks.some((tick) => /^(Jan|1)$/.test(tick))).toBe(true)
  expect(ticks.some((tick) => /^(Dec|12)$/.test(tick))).toBe(true)
  expect(ticks.some((tick) => /^\$?0(?:\.0+)?(?: USD)?$/.test(tick))).toBe(true)
  expect(ticks.some((tick) => /[1-9]/.test(tick))).toBe(true)
  expect(svg).not.toMatch(/NaN|Infinity/)
}

function planner(summary: Record<string, unknown>, closed = 1) {
  return PlannerModule.render("Overview", {
    versions: [{ id: "plan", name: "Plan", year: 2026, closed, lines: [], projects: [], hc: {}, fx: [], summary }],
  }, context)
}

const monthlyTitle = "Monthly Budget, Actual, Outlook (USD)"

test("display labels separate technical composites and camelCase without expanding acronyms", () => {
  expect(displayLabel("IT Security|Service Requests|Initial Balance")).toMatch(/^IT Security\s+[^|\w]+\s+Service Requests\s+[^|\w]+\s+Initial Balance$/)
  expect(displayLabel("socPending")).toBe("SOC Pending")
  expect(displayLabel("incSLA")).toBe("Inc SLA")
  expect(displayLabel("rootCause")).toBe("Root Cause")
  expect(displayLabel("notes")).toBe("Notes")
  expect(displayLabel("opsCats")).toBe("Ticket categories")
  expect(displayLabel("opsHmItems")).toBe("Heat map items")
  for (const acronym of ["IT", "SOC", "SLA", "FX", "YTD", "USD", "ID", "PO", "PR", "FTE", "OPEX", "CAPEX"])
    expect(displayLabel(acronym)).toBe(acronym)
})

test("only field captions and table headers normalize; binding names, options, cells and commands stay exact", () => {
  const names = ["IT Security|Incidents|Open", "rootCause", "opsCats", "socPending"]
  const html = form("IT Operations", "save-tickets", "ops-list:opsCats", 7, fields([
    { name: names[0]!, label: names[0]!, value: "rawValue|USD" },
    { name: names[1]!, label: names[1]!, type: "checkbox", value: true },
    { name: names[2]!, label: names[2]!, type: "textarea", value: "rawValue|USD" },
    { name: names[3]!, label: names[3]!, type: "select", options: ["rawValue|USD"], value: "rawValue|USD" },
  ]))
  expect([...html.matchAll(/\bname="([^"]+)"/g)].map((match) => match[1])).toEqual(names)
  expect(html).toContain('<label>Root Cause<input')
  expect(html).toContain('<label>Ticket categories<textarea')
  expect(html).toContain('<label>SOC Pending<select')
  expect(html).toContain('<option value="rawValue|USD" selected>rawValue|USD</option>')
  expect(html).toContain('value="rawValue|USD"')
  expect(html).toContain('data-command="save-tickets" data-page="IT Operations" data-record="ops-list:opsCats" data-version="7"')
  const grid = table(["socPending", "notes"], [["rawValue|USD", "rootCause"]])
  expect(grid).toContain('>SOC Pending</th>')
  expect(grid).toContain('>Notes</th>')
  expect(grid).toContain('<td>rawValue|USD</td><td>rootCause</td>')
  expect(fields([{ name: "unsafe", label: "<script>", value: "<script>" }])).not.toContain("<script>")
})

test("operations pages normalize visible technical labels while retaining exact submitted names and list records", () => {
  const html = DashboardOperations.render("IT Operations", { opsCats: ["IT Security"], opsHmItems: ["Network"] }, context)!
  expect(html).toContain('name="IT Security|Incidents|Open"')
  expect(html).not.toContain('<label>IT Security|Incidents|Open')
  expect(html).not.toContain('>IT Security|Incidents|Open</th>')
  expect(html).toContain('<label>Ticket categories<textarea name="names"')
  expect(html).toContain('<label>Heat map items<textarea name="names"')
  expect(html).toContain('data-record="opsCats"')
  expect(html).toContain('data-record="opsHmItems"')
})

test("planner chart has keyed colors, visible months and USD scale, preserves signed amounts and closed-month zero rules", () => {
  // Domain totals alone do not establish an observed actual: supply genuine line-level evidence.
  const observed = [0, ...Array(11).fill(null)]
  const summary = { budget: [120, -60, ...Array(10).fill(0)], actual: observed, outlook: [100, -60, ...Array(10).fill(0)], lines: [{ a: observed, actual: observed, cur: "USD" }], total: 60, actualYTD: 0, fullYear: 40 }
  const before = structuredClone(summary)
  const html = planner(summary)!
  const chart = figure(html, monthlyTitle)
  chartPresentation(chart, ["Budget", "Actual", "Outlook"])
  expect(chart).toContain("USD")
  expect(chart).toMatch(/<text\b[^>]*>[^<]*-\$?60/)
  expect(chart).toContain("Actual 1: $0")
  expect(chart).not.toContain("Actual 2:")
  expect(chart).toContain("Budget 1: $120")
  expect(chart).toContain("Budget 2: -$60")
  expect(summary).toEqual(before)
})

test("planner actual chart proves missing versus observed zero versus signed recorded actual across close boundary", () => {
  // A numeric domain total is NOT sufficient when no contributing line was observed.
  const withoutEvidence = { budget: [120, ...Array(11).fill(0)], actual: [0, ...Array(11).fill(null)], outlook: [] }
  const missing = figure(planner(withoutEvidence), monthlyTitle)
  expect(missing).not.toContain('data-planner-series="actual"')
  expect(missing).not.toContain("Actual 1: $0")

  // Month 1 is closed and observed zero; month 2 is an open recorded negative;
  // month 3 is an open observed zero; month 4 has a numeric domain value but
  // is missing line-level proof and must not be silently converted into zero.
  const domain = [0, -25, 0, 0, ...Array(8).fill(null)]
  const observed = [0, -25, 0, null, ...Array(8).fill(null)]
  const summary = { ...withoutEvidence, actual: domain, lines: [{ cur: "USD", a: observed, actual: observed }] }
  const before = structuredClone(summary)
  const chart = figure(planner(summary), monthlyTitle)
  const markers = [...chart.matchAll(/<circle\b[^>]*data-planner-series="actual"[^>]*>[\s\S]*?<\/circle>/g)].map((match) => match[0])
  expect(markers).toHaveLength(3)
  expect(markers[0]).toContain('data-month="1"')
  expect(markers[0]).toContain('fill="#b54a22"')
  expect(markers[0]).toContain("Actual 1: $0")
  expect(markers[1]).toContain('data-month="2"')
  expect(markers[1]).toContain("Actual 2: -$25")
  expect(markers[2]).toContain('data-month="3"')
  expect(markers[2]).toContain("Actual 3: $0")
  expect(chart).not.toContain("Actual 4:")
  expect(summary).toEqual(before)
})

test("planner missing series show a clear empty state without fabricated zero points; explicit zero remains plotted", () => {
  for (const summary of [{}, { budget: Array(12).fill(null), actual: [], outlook: Array(12).fill(null) }]) {
    const chart = figure(planner(summary), monthlyTitle)
    expect(chart).toMatch(/class="chart-empty"[^>]*>[^<]*No data/i)
    expect(chart).not.toMatch(/<circle\b/)
  }
  const chart = figure(planner({ budget: [0], actual: [null], outlook: [] }), monthlyTitle)
  expect(chart).not.toContain('class="chart-empty"')
  expect(chart).toContain("Budget 1: $0")
  expect(chart).not.toContain("Budget 2:")
  expect(chart).not.toContain("Actual 1:")
})

test("operations charts expose legend, month and numeric scale and retain their original data tables", () => {
  const data = { opsCats: ["IT"], opsTickets: [{ year: 2026, month: 1, "IT|Incidents|Open": 12, "IT|Incidents|Closed": 0 }] }
  const before = structuredClone(data)
  const chart = figure(DashboardOperations.render("IT Operations", data, context), "Opened vs Closed")
  chartPresentation(chart, ["Opened", "Closed"])
  expect(chart).toContain("1 Opened: 12")
  expect(chart).toContain("1 Closed: 0")
  expect(chart).not.toContain("2 Opened:")
  expect(chart).toContain('<td>1</td><td>12</td><td>0</td>')
  expect(chart).toContain('<td>2</td><td>No data</td><td>No data</td>')
  expect(data).toEqual(before)
})

test("operations and security all-absent charts have empty messages, while actual zero has a mark and title", () => {
  for (const [page, titles] of [
    ["IT Operations", ["Opened vs Closed", "SLA and availability trend"]],
    ["IT Security KPIs", ["SOC trend", "SOC severity", "Patch trend"]],
  ] as const) {
    for (const title of titles) {
      const chart = figure(DashboardOperations.render(page, {}, context), title)
      expect(chart).toMatch(/class="chart-empty"[^>]*>[^<]*No data/i)
      expect(chart).not.toMatch(/<rect\b/)
    }
  }
  const data = { secKpi: [{ year: 2026, month: 1, socPending: 0, socTP: null, socFP: "" }] }
  const chart = figure(DashboardOperations.render("IT Security KPIs", data, context), "SOC trend")
  expect(chart).not.toContain('class="chart-empty"')
  expect(chart).toMatch(/<rect\b/)
  expect(chart).toContain(": 0</title>")
  expect(chart.match(/<rect\b/g)?.length).toBe(1)
  expect(chart).toContain("No data</td>")
})
