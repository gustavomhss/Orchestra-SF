import { expect, test } from "bun:test"
import { download } from "../runtime/downloads.ts"
import { domain, render } from "../runtime/procurement.ts"
import type { Snapshot } from "../runtime/contract.ts"
import { quoteRanking } from "../src/form.ts"
import type { FormSettings } from "../src/form.ts"
import { legalInitialSettings } from "../src/initial-settings.ts"

const actor = { id: "buyer", canWrite: true, roles: ["admin", "buyer", "requester"] }
const environment = {
  at: "2026-11-12T12:00:00Z",
  id: () => "stable-generated-id",
  directory: [{ id: "buyer", name: "Buyer" }],
}
// Scores of 5 on weights 35/20/15/15/15. Commercial auto price weight 70 is not a manual score;
// the manual cscores are 5 and 5 at weight 15. Overall weights are 60/40.
const technicalScores = [5, 5, 5, 5, 5]
const commercialScores = [0, 5, 5]
const frozenEur = legalInitialSettings().fxRates.find((rate) => rate.code === "EUR")?.rate
const selectionRankError =
  "Selected quote is not the top-ranked one \u2014 a selection justification is required"
const primaryOracle = [
  {
    id: "q1",
    supplier: "Alpha",
    total: 8000,
    technical: "100.0",
    price: "100.0",
    commercial: "100.0",
    overall: "100.0",
    rank: "1",
  },
  {
    id: "q2",
    supplier: "Bravo",
    total: 10000,
    technical: "100.0",
    price: "80.0",
    commercial: "86.0",
    overall: "94.4",
    rank: "2",
  },
  {
    id: "q3",
    supplier: "Charlie",
    total: 16000,
    technical: "100.0",
    price: "50.0",
    commercial: "65.0",
    overall: "86.0",
    rank: "3",
  },
] as const

type QuoteInput = {
  id: string
  supplier: string
  currency: string
  qty: number
  unitPrice: number
  total: number
  techPass?: boolean
}

type Cell = { text: string; header: boolean }
type El = { tag: string; attrs: string; children: Array<El | string>; parent?: El }
type ScoreKind = "technical" | "price" | "commercial" | "overall" | "rank"

function begin() {
  const state: Snapshot = { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
  must(state, "Settings", "reset", {})
  if (frozenEur !== 1.08) throw new Error("original EUR rate is not 1.08")
  if (10000 * frozenEur !== 10800) throw new Error("10000 × 1.08 is not 10800")
  if (9000 * frozenEur !== 9720) throw new Error("9000 × 1.08 is not 9720")
  if (40000 * frozenEur !== 43200) throw new Error("40000 × 1.08 is not 43200")
  return state
}

function must(state: Snapshot, page: string, action: string, values: Record<string, unknown>, id?: string) {
  const key = page === "Settings" ? "settings" : `requests:${id ?? ""}`
  const version = state.versions[key]?.version ?? 0
  const result = domain.execute(
    state,
    actor,
    { page, action, ...(id ? { id } : {}), version, values },
    environment,
  )
  if (!result.ok) throw new Error(`${page} ${action} ${id ?? ""} failed: ${JSON.stringify(result)}`)
  return result
}

function refused(state: Snapshot, number: string, action: string, values: Record<string, unknown> = {}) {
  return domain.execute(
    state,
    actor,
    {
      page: "Requests",
      action,
      id: number,
      version: state.versions[`requests:${number}`]?.version ?? 0,
      values,
    },
    environment,
  )
}

function requestNumber(result: { value?: unknown }) {
  const value = result.value
  if (!value || typeof value !== "object" || !("number" in value) || typeof value.number !== "string") {
    throw new Error("create did not return a request number")
  }
  return value.number
}

function requisition(title: string, expenseType: string, estAmount: number) {
  return {
    pr: {
      title,
      type: "product",
      description: `${title} description`,
      estAmount,
      costCenter: "IT",
      needBy: "2026-12-01",
      justification: "Business need",
      recurring: false,
      expenseType,
    },
  }
}

function sourcingFields(quotes: QuoteInput[], extra: Record<string, string> = {}) {
  const values: Record<string, unknown> = {
    "sourcing.evaluator": "Technical evaluator",
    "sourcing.fewQuotesJustification": "",
    "sourcing.selectionJustification": extra.selectionJustification ?? "",
    "sourcing.contractStrategy": "",
    "sourcing.selectedId": extra.selectedId ?? "",
  }
  quotes.forEach((quote, index) => {
    const prefix = `sourcing.quotes.${index}`
    values[`${prefix}.id`] = quote.id
    values[`${prefix}.supplier`] = quote.supplier
    values[`${prefix}.supplierId`] = ""
    values[`${prefix}.currency`] = quote.currency
    values[`${prefix}.qty`] = quote.qty
    values[`${prefix}.unitPrice`] = quote.unitPrice
    values[`${prefix}.total`] = quote.total
    values[`${prefix}.techPass`] = quote.techPass !== false
    technicalScores.forEach((score, scoreIndex) => {
      values[`${prefix}.scores.${scoreIndex}`] = score
    })
    commercialScores.forEach((score, scoreIndex) => {
      values[`${prefix}.cscores.${scoreIndex}`] = score
    })
  })
  return values
}

function purchaseOrderFields(input: {
  currency: string
  expenseType: string
  unitPrice: number
  qty?: number
  supplier?: string
  description?: string
}) {
  return {
    "po.currency": input.currency,
    "po.expenseType": input.expenseType,
    "po.supplier": input.supplier ?? "Mill Supplier",
    "po.supplierId": "",
    "po.description": input.description ?? "Roasting equipment",
    "po.paymentTerms": "Net 30",
    "po.deliveryDate": "2026-12-20",
    "po.deliveryConditions": "Deliver to the plant dock",
    "po.lines.0.desc": "Roaster",
    "po.lines.0.qty": input.qty ?? 1,
    "po.lines.0.unitPrice": input.unitPrice,
    "po.lines.0.uom": "each",
  }
}

function reachSourcing(state: Snapshot, title: string, expenseType: string, estAmount: number) {
  const created = must(state, "Requests", "create", requisition(title, expenseType, estAmount))
  const number = requestNumber(created)
  must(state, "Requests", "submit_pr", {}, number)
  must(state, "Requests", "approve", {}, number)
  return number
}

function approveSourcing(state: Snapshot, number: string) {
  sourcingApproval(storedRequest(state, number)).levelIds.forEach(() => {
    if (storedRequest(state, number).status === "src_pending") must(state, "Requests", "approve", {}, number)
  })
  expect(storedRequest(state, number).status).toBe("po_draft")
}

function reachDraft(state: Snapshot, unitPrice = 10000) {
  const quotes: QuoteInput[] = [0, 1000, 2000].map((extra, index) => ({
    id: `q${index + 1}`,
    supplier: `Mill ${index + 1}`,
    currency: "USD",
    qty: 1,
    unitPrice: unitPrice + extra,
    total: unitPrice + extra,
  }))
  const number = reachSourcing(state, "Approved sourcing", "OPEX", unitPrice)
  must(state, "Requests", "save", sourcingFields(quotes), number)
  must(state, "Requests", "select_quote", { quoteId: quotes[0]!.id }, number)
  must(state, "Requests", "submit_sourcing", {}, number)
  approveSourcing(state, number)
  return number
}

function reachPending(
  state: Snapshot,
  input: { title: string; expenseType: "OPEX" | "CAPEX"; currency: string; unitPrice: number },
) {
  const quotes: QuoteInput[] = [0, 1000, 2000].map((extra, index) => ({
    id: `q${index + 1}`,
    supplier: `${input.title} ${index + 1}`,
    currency: input.currency,
    qty: 1,
    unitPrice: input.unitPrice + extra,
    total: input.unitPrice + extra,
  }))
  const number = reachSourcing(state, input.title, input.expenseType, input.unitPrice)
  must(state, "Requests", "save", sourcingFields(quotes), number)
  must(state, "Requests", "select_quote", { quoteId: quotes[0]!.id }, number)
  must(state, "Requests", "submit_sourcing", {}, number)
  approveSourcing(state, number)
  must(
    state,
    "Requests",
    "save",
    purchaseOrderFields({
      currency: input.currency,
      expenseType: input.expenseType,
      unitPrice: input.unitPrice,
      supplier: quotes[0]!.supplier,
    }),
    number,
  )
  must(state, "Requests", "submit_po", {}, number)
  return number
}

function shown(state: Snapshot, page: string, extra: Record<string, unknown> = {}) {
  const viewed = domain.view(state, actor, environment)
  const html = render(
    page,
    { ...viewed.data, ...extra },
    { actor, year: 2026, month: 11, at: environment.at, versions: state.versions },
  )
  if (html === undefined) throw new Error(`${page} did not render`)
  return { viewed, html }
}

function between(html: string, startMarker: string, endMarker: string) {
  const start = html.indexOf(startMarker)
  const end = start < 0 ? -1 : html.indexOf(endMarker, start + startMarker.length)
  if (start < 0 || end < 0) throw new Error(`missing section ${startMarker}`)
  return html.slice(start, end)
}

function poSection(html: string, number: string) {
  return between(html, `id="${number}-po"`, `id="${number}-history"`)
}

function sourcingSection(html: string, number: string) {
  return between(html, `id="${number}-sourcing"`, `id="${number}-po"`)
}

function decode(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
}

function visibleText(html: string) {
  return decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()
}

function firstNumber(value: string) {
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)
  if (!match) return undefined
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : undefined
}

function numericCell(value: string) {
  const parsed = firstNumber(value)
  if (parsed === undefined) throw new Error(`not a number: ${value}`)
  return parsed
}

function parseFragment(html: string) {
  const root: El = { tag: "root", attrs: "", children: [] }
  const stack = [root]
  const token = /<!--[\s\S]*?-->|<\/([A-Za-z0-9]+)>|<([A-Za-z0-9]+)([^>]*)>|([^<]+)/g
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"])
  for (const match of html.matchAll(token)) {
    const parent = stack.at(-1)
    if (!parent) throw new Error("html walker lost its parent")
    if (match[1]) {
      const tag = match[1].toLowerCase()
      for (let index = stack.length - 1; index > 0; index -= 1) {
        if (stack[index]?.tag === tag) {
          stack.length = index
          break
        }
      }
      continue
    }
    if (match[2]) {
      const attrs = match[3] ?? ""
      const node: El = { tag: match[2].toLowerCase(), attrs, children: [], parent }
      parent.children.push(node)
      if (!voidTags.has(node.tag) && !/\/\s*$/.test(attrs)) stack.push(node)
      continue
    }
    if (match[4]) parent.children.push(decode(match[4]))
  }
  return root
}

function walk(node: El): El[] {
  const found = [node]
  for (const child of node.children) if (typeof child !== "string") found.push(...walk(child))
  return found
}

function directText(node: El) {
  return node.children
    .filter((child): child is string => typeof child === "string")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
}

function allText(node: El): string {
  return node.children
    .map((child) => (typeof child === "string" ? child : allText(child)))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
}

function attr(node: El, name: string) {
  const match = new RegExp(
    `(?:^|\\s)${name}(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+)))?`,
    "i",
  ).exec(node.attrs)
  if (!match) return undefined
  const raw = match[1] ?? match[2] ?? match[3]
  return raw === undefined ? "" : decode(raw)
}

function nextElement(node: El) {
  const siblings = node.parent?.children ?? []
  const index = siblings.indexOf(node)
  for (let cursor = index + 1; cursor < siblings.length; cursor += 1) {
    const sibling = siblings[cursor]
    if (typeof sibling !== "string") return sibling
  }
  return undefined
}

function inputValues(node: El): string[] {
  const values: string[] = []
  if (node.tag === "input" || node.tag === "textarea") {
    const value = attr(node, "value") ?? (node.tag === "textarea" ? allText(node) : undefined)
    if (value) values.push(value)
  }
  for (const child of node.children) if (typeof child !== "string") values.push(...inputValues(child))
  return values
}

function metricValue(html: string, label: string) {
  const labels = walk(parseFragment(html)).filter(
    (node) => directText(node) === label || attr(node, "aria-label") === label,
  )
  if (labels.length === 0) throw new Error(`missing metric ${label}`)
  for (const labelNode of labels) {
    if (attr(labelNode, "aria-label") === label) {
      const inside = firstNumber(allText(labelNode))
      if (inside !== undefined && directText(labelNode) !== label) return inside
    }
    for (const sibling of labelNode.parent?.children ?? []) {
      if (typeof sibling === "string" || sibling === labelNode) continue
      const value = firstNumber(allText(sibling))
      if (value !== undefined) return value
    }
  }
  throw new Error(`missing value for ${label}`)
}

function parseTables(html: string) {
  const tables: Cell[][][] = []
  for (const tableMatch of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const rows: Cell[][] = []
    for (const rowMatch of (tableMatch[1] ?? "").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells: Cell[] = []
      for (const cellMatch of (rowMatch[1] ?? "").matchAll(/<(th|td)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
        const attrs = cellMatch[2] ?? ""
        const labelled = /(?:^|\s)aria-label\s*=\s*"([^"]*)"/i.exec(attrs)
        const values = [...(cellMatch[3] ?? "").matchAll(/\bvalue="([^"]*)"/gi)].map((match) => decode(match[1] ?? ""))
        cells.push({
          header: (cellMatch[1] ?? "").toLowerCase() === "th",
          text: [visibleText(cellMatch[3] ?? ""), labelled ? decode(labelled[1] ?? "") : "", ...values].filter(Boolean).join(" "),
        })
      }
      if (cells.length > 0) rows.push(cells)
    }
    if (rows.length > 0) tables.push(rows)
  }
  return tables
}

function amountFor(html: string, requestNumber: string) {
  const needle = new RegExp(`(?:^|\\D)${requestNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\D|$)`)
  const found: number[] = []
  for (const table of parseTables(html)) {
    const header = table[0]
    if (!header) continue
    const index = header.findIndex((cell) => cell.header && cell.text.trim() === "Amount")
    if (index < 0) continue
    for (const row of table.slice(1)) {
      if (!row.some((cell) => needle.test(cell.text))) continue
      const cell = row[index]
      if (!cell) throw new Error(`amount cell missing for ${requestNumber}`)
      found.push(numericCell(cell.text))
    }
  }
  if (found.length === 0) throw new Error(`no Amount cell for ${requestNumber}`)
  if (found.some((value) => value !== found[0])) throw new Error(`Amount disagreed for ${requestNumber}`)
  return found[0]!
}

function kindOf(text: string): ScoreKind | null {
  const label = text.replace(/\s+/g, " ").trim()
  // The weight rows say "share of overall score". Only the score rows themselves count.
  if (/^overall score\b/i.test(label)) return "overall"
  if (/^commercial score\b/i.test(label)) return "commercial"
  if (/^technical score\b/i.test(label)) return "technical"
  if (/^rank\b/i.test(label)) return "rank"
  if (/^price\b/i.test(label)) return "price"
  return null
}

function evaluationTable(section: string, suppliers: readonly string[]) {
  const found = parseTables(section).filter((table) =>
    suppliers.every((supplier) => table.some((row) => row.some((cell) => cell.header && cell.text.includes(supplier)))),
  )
  if (found.length !== 1) throw new Error(`expected one evaluation table, found ${found.length}`)
  return found[0]!
}

function associatedCell(table: Cell[][], supplier: string, kind: ScoreKind) {
  const found: string[] = []
  const header = table[0] ?? []
  const column = header.findIndex((cell, index) => index > 0 && cell.header && cell.text.includes(supplier))
  if (column > 0) {
    const row = table.find((cells) => kindOf(cells[0]?.text ?? "") === kind)
    const cell = row?.[column]
    if (cell) found.push(cell.text)
  }
  const dataRow = table.find((cells, index) => index > 0 && cells[0]?.header && cells[0].text.includes(supplier))
  if (dataRow) {
    const index = header.findIndex((cell) => kindOf(cell.text) === kind)
    const cell = index >= 0 ? dataRow[index] : undefined
    if (cell) found.push(cell.text)
  }
  if (found.length === 0) throw new Error(`no ${kind} cell for ${supplier}`)
  if (found.some((value) => value !== found[0])) throw new Error(`${kind} for ${supplier} disagreed`)
  return found[0]!
}

function rankToken(text: string) {
  const nested = /rank\s*:?\s*(\d+)/i.exec(text)
  if (nested?.[1]) return nested[1]
  const exact = /^(\d+)$/.exec(text.trim())
  if (exact?.[1]) return exact[1]
  throw new Error(`rank not readable: ${text}`)
}

function shows(cell: string, figure: string) {
  expect(cell.replace(/,/g, "")).toMatch(new RegExp(`(?<![\\d.])${figure.replace(".", "\\.")}(?!\\d)`))
}

function expectEvaluation(
  section: string,
  rows: readonly { supplier: string; technical: string; price: string; commercial: string; overall: string; rank: string }[],
) {
  const suppliers = rows.map((row) => row.supplier)
  for (const row of rows) {
    const technical = associatedCell(evaluationTable(section, suppliers), row.supplier, "technical")
    const price = associatedCell(evaluationTable(section, suppliers), row.supplier, "price")
    const commercial = associatedCell(evaluationTable(section, suppliers), row.supplier, "commercial")
    const overall = associatedCell(evaluationTable(section, suppliers), row.supplier, "overall")
    let rankText = ""
    try {
      rankText = associatedCell(evaluationTable(section, suppliers), row.supplier, "rank")
    } catch {
      rankText = overall
    }
    shows(technical, row.technical)
    shows(price, row.price)
    shows(commercial, row.commercial)
    shows(overall, row.overall)
    expect(rankToken(rankText)).toBe(row.rank)
  }
}

function isLiveRegion(node: El) {
  const role = attr(node, "role")
  if (role === "alert" || role === "status") return true
  if (node.tag === "output") return true
  const live = attr(node, "aria-live")
  return live === "polite" || live === "assertive"
}

// banner + warn are tokens, so class order and extra classes still count.
// A carrier that also contains the purchase-order editor is the surrounding section.
function isWarnBanner(node: El) {
  const tokens = (attr(node, "class") ?? "").trim().split(/\s+/)
  return tokens.includes("banner") && tokens.includes("warn")
}

function isWarningCarrier(node: El) {
  return isLiveRegion(node) || isWarnBanner(node)
}

function containsPurchaseEditor(node: El) {
  return walk(node).some(
    (child) =>
      child !== node &&
      (child.tag === "table" ||
        child.tag === "form" ||
        child.tag === "input" ||
        child.tag === "textarea" ||
        child.tag === "select"),
  )
}

function amountsIn(text: string) {
  return [...text.replace(/,/g, "").matchAll(/(?<![\d.])\d+(?:\.\d+)?(?!\d|\.\d)/g)].map((match) => Number(match[0]))
}

function sameMoney(shownAmount: number, actual: number) {
  if (Math.abs(shownAmount - actual) < 1e-9) return true
  return Math.abs(shownAmount - Math.round(actual * 100) / 100) < 1e-9
}

function mentions(text: string, base: number, approved: number) {
  const values = amountsIn(text)
  const baseAt = values.findIndex((value) => sameMoney(value, base))
  if (baseAt < 0) return false
  return values.some(
    (value, index) => sameMoney(value, approved) && (index !== baseAt || Math.abs(base - approved) < 1e-9),
  )
}

test("warning amount oracle accepts sentence punctuation without matching partial numbers", () => {
  expect(mentions("Purchase order base 43200 is above sourcing amount 10000.", 43200, 10000)).toBe(true)
  expect(mentions("Purchase order base 10000.006 is above sourcing amount 10000.", 10000.006, 10000)).toBe(true)
  expect(mentions("Purchase order base $43,200.00 is above sourcing amount $10,000.00.", 43200, 10000)).toBe(true)
  expect(mentions("Purchase order base 143200 is above sourcing amount 100001.", 43200, 10000)).toBe(false)
})

function poAlerts(section: string) {
  const carriers = walk(parseFragment(section)).filter(
    (node) => isWarningCarrier(node) && !containsPurchaseEditor(node),
  )
  return carriers
    .filter((node) => !carriers.some((other) => other !== node && walk(node).includes(other)))
    .map((node) => allText(node))
    .filter((text) => text.length > 0)
}

function expectWarning(section: string, base: number, approved: number) {
  expect(poAlerts(section).filter((text) => mentions(text, base, approved)).length).toBeGreaterThan(0)
}

function expectNoWarning(section: string, base: number, approved: number) {
  expect(poAlerts(section).filter((text) => mentions(text, base, approved))).toEqual([])
}

function expectSubmitPoEnabled(section: string) {
  const forms = walk(parseFragment(section)).filter(
    (node) => node.tag === "form" && attr(node, "data-command") === "submit_po",
  )
  expect(forms.length).toBe(1)
  const controls = walk(forms[0]!).filter(
    (node) =>
      (node.tag === "button" && (attr(node, "type") || "submit") === "submit") ||
      (node.tag === "input" && attr(node, "type") === "submit"),
  )
  expect(controls.length).toBe(1)
  expect(attr(controls[0]!, "disabled")).toBeUndefined()
}

function labeledTotals(node: El) {
  const found: number[] = []
  for (const labelNode of walk(node)) {
    if (!["label", "th", "span", "legend", "dt"].includes(labelNode.tag)) continue
    const caption = directText(labelNode)
    if (!/^total\b/i.test(caption) || /^total\s*(?:\(base\)|base\b)/i.test(caption)) continue
    const control = walk(labelNode).find(
      (child) => child !== labelNode && (child.tag === "input" || child.tag === "output"),
    )
    const controlNumber = control ? firstNumber(attr(control, "value") ?? allText(control)) : undefined
    if (controlNumber !== undefined) found.push(controlNumber)
    const sibling = nextElement(labelNode)
    const siblingNumber = sibling ? firstNumber(allText(sibling)) : undefined
    if (siblingNumber !== undefined) found.push(siblingNumber)
  }
  return found
}

function visibleQuoteTotal(section: string, supplier: string) {
  const root = parseFragment(section)
  const candidates = walk(root).filter((node) => {
    const blob = `${allText(node)} ${inputValues(node).join(" ")}`
    return blob.includes(supplier) && labeledTotals(node).length > 0
  })
  const smallest = candidates.filter(
    (node) => !candidates.some((other) => other !== node && walk(node).includes(other)),
  )
  if (smallest.length !== 1) throw new Error(`expected one total region for ${supplier}, found ${smallest.length}`)
  const totals = labeledTotals(smallest[0]!)
  if (totals.length === 0 || totals.some((value) => value !== totals[0])) {
    throw new Error(`total for ${supplier} disagreed: ${totals.join(", ")}`)
  }
  return totals[0]!
}

function parseCsv(bytes: Uint8Array) {
  const lines = new TextDecoder().decode(bytes).split("\r\n").filter((line) => line.length > 0)
  const header = parseCsvLine(lines[0] ?? "")
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    return Object.fromEntries(header.map((column, index) => [column, cells[index] ?? ""]))
  })
}

function parseCsvLine(line: string) {
  const cells: string[] = []
  let current = ""
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (quoted && char === '"' && line[index + 1] === '"') {
      current += '"'
      index += 1
      continue
    }
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (char === "," && !quoted) {
      cells.push(current)
      current = ""
      continue
    }
    current += char ?? ""
  }
  cells.push(current)
  return cells
}

async function registerRows(state: Snapshot) {
  const register = await download("register", state, actor, environment, new URLSearchParams())
  if (!register.ok) throw new Error("register refused")
  return parseCsv(register.bytes)
}

function registerMoney(rows: Record<string, string>[], number: string) {
  const row = rows.find((item) => item["PR number"] === number)
  if (!row) throw new Error(`register missed ${number}`)
  return {
    currencyTotal: Number(row["PO total"]),
    base: Number(row["PO total (base)"]),
    currency: row["PO currency"],
  }
}

type StoredRow = {
  request: Record<string, unknown>
  rank?: { id?: string; rank: number | null; overall: number }[]
}

function storeRequests(state: Snapshot) {
  const store = state.data.store
  if (!store || typeof store !== "object" || !("requests" in store)) throw new Error("store missing")
  return (store as { requests: Record<string, StoredRow> }).requests
}

function storedRequest(state: Snapshot, number: string) {
  const row = storeRequests(state)[number]
  if (!row) throw new Error(`stored ${number} missing`)
  return row.request
}

function quoteRecord(request: Record<string, unknown>, id: string) {
  const sourcing = request.sourcing
  if (!sourcing || typeof sourcing !== "object" || !Array.isArray((sourcing as { quotes?: unknown }).quotes)) {
    throw new Error("quotes missing")
  }
  const quote = (sourcing as { quotes: Record<string, unknown>[] }).quotes.find((item) => item.id === id)
  if (!quote) throw new Error(`quote ${id} missing`)
  return quote
}

function sourcingAmount(request: Record<string, unknown>) {
  const sourcing = request.sourcing
  if (!sourcing || typeof sourcing !== "object") throw new Error("sourcing missing")
  const amount = (sourcing as { approval?: { amount?: unknown } }).approval?.amount
  if (typeof amount !== "number") throw new Error("sourcing approval amount missing")
  return amount
}

function sourcingApproval(request: Record<string, unknown>) {
  const sourcing = request.sourcing
  if (!sourcing || typeof sourcing !== "object") throw new Error("sourcing missing")
  const approval = (sourcing as { approval?: unknown }).approval
  if (!approval || typeof approval !== "object") throw new Error("sourcing approval missing")
  const record = approval as { amount?: unknown; fxRate?: unknown; steps?: unknown }
  if (typeof record.amount !== "number" || typeof record.fxRate !== "number" || !Array.isArray(record.steps)) {
    throw new Error("sourcing approval missing")
  }
  return {
    amount: record.amount,
    fxRate: record.fxRate,
    levelIds: record.steps.map((step) => (step as { levelId?: unknown }).levelId),
    thresholds: record.steps.map((step) => (step as { threshold?: unknown }).threshold),
    holderIds: record.steps.map((step) => (step as { holderId?: unknown }).holderId ?? null),
  }
}

function fxSnapshotOf(request: Record<string, unknown>) {
  const sourcing = request.sourcing
  if (!sourcing || typeof sourcing !== "object") throw new Error("sourcing missing")
  if (!("fxSnapshot" in sourcing)) return null
  return (sourcing as { fxSnapshot: unknown }).fxSnapshot
}

function poAccount(request: Record<string, unknown>) {
  const po = request.po
  if (!po || typeof po !== "object") throw new Error("purchase order missing")
  const record = po as Record<string, unknown>
  const approval = record.approval
  const steps =
    approval && typeof approval === "object" && Array.isArray((approval as { steps?: unknown }).steps)
      ? ((approval as { steps: Record<string, unknown>[] }).steps)
      : []
  return {
    currency: record.currency,
    fxRate: record.fxRate ?? null,
    approval: approval ?? null,
    amount: approval && typeof approval === "object" ? (approval as { amount?: unknown }).amount : undefined,
    supplier: record.supplier,
    supplierId: record.supplierId ?? null,
    sourceQuoteId: record.sourceQuoteId,
    lines: record.lines,
    issuedAt: record.issuedAt ?? null,
    levelIds: steps.map((step) => step.levelId),
    thresholds: steps.map((step) => step.threshold),
    holderIds: steps.map((step) => (step.holderId ?? null)),
    steps,
  }
}

function lineTotal(request: Record<string, unknown>) {
  const lines = poAccount(request).lines
  if (!Array.isArray(lines)) throw new Error("purchase order lines missing")
  return lines.reduce((sum: number, line) => {
    const row = line as { qty?: unknown; unitPrice?: unknown }
    return sum + Number(row.qty) * Number(row.unitPrice)
  }, 0)
}

function formSettings(data: Record<string, unknown>): FormSettings {
  const settings = data.formSettings
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) throw new Error("form settings missing")
  return settings as FormSettings
}

function scoreRaw(base: number, cheapest: number) {
  const price = (cheapest / base) * 100
  const commercial = (price * 70 + 100 * 15 + 100 * 15) / 100
  const overall = (100 * 60 + commercial * 40) / 100
  return { price, commercial, overall }
}

function publishedScore(base: number, cheapest: number) {
  const raw = scoreRaw(base, cheapest)
  return {
    price: raw.price.toFixed(1),
    commercial: raw.commercial.toFixed(1),
    overall: raw.overall.toFixed(1),
  }
}

function ranksFor(rows: { id: string; base: number }[]) {
  const cheapest = Math.min(...rows.map((row) => row.base))
  const scored = rows.map((row) => ({
    id: row.id,
    ...publishedScore(row.base, cheapest),
    overallValue: scoreRaw(row.base, cheapest).overall,
  }))
  const order = [...scored].sort(
    (left, right) => right.overallValue - left.overallValue || left.id.localeCompare(right.id),
  )
  return scored.map((row) => ({
    id: row.id,
    overall: row.overall,
    rank: order.findIndex((item) => item.id === row.id) + 1,
  }))
}

function expectPublishedArithmetic() {
  const technical =
    ((5 / 5) * 35 + (5 / 5) * 20 + (5 / 5) * 15 + (5 / 5) * 15 + (5 / 5) * 15) /
    (35 + 20 + 15 + 15 + 15) *
    100
  expect(technical.toFixed(1)).toBe("100.0")
  for (const row of primaryOracle) {
    expect(publishedScore(row.total, primaryOracle[0]!.total)).toEqual({
      price: row.price,
      commercial: row.commercial,
      overall: row.overall,
    })
  }
  expect(ranksFor(primaryOracle.map((row) => ({ id: row.id, base: row.total })))).toEqual(
    primaryOracle.map((row) => ({ id: row.id, overall: row.overall, rank: Number(row.rank) })),
  )
}

function lockScoreOracle(settings: FormSettings) {
  expect(settings.currency).toBe("USD")
  expect(settings.minQuotes).toBe(3)
  expect(settings.techWeight).toBe(60)
  expect(settings.commWeight).toBe(40)
  expect(settings.criteria?.map((item) => item.weight)).toEqual([35, 20, 15, 15, 15])
  expect(settings.commCriteria?.map((item) => ({ weight: item.weight, auto: item.auto === true }))).toEqual([
    { weight: 70, auto: true },
    { weight: 15, auto: false },
    { weight: 15, auto: false },
  ])
  expect(settings.fxRates?.find((rate) => rate.code === "EUR")?.rate).toBe(1.08)
  expectPublishedArithmetic()
}

function rankingQuotes(): QuoteInput[] {
  return primaryOracle.map((row) => ({
    id: row.id,
    supplier: row.supplier,
    currency: "USD",
    qty: 1,
    unitPrice: row.total,
    total: row.total,
  }))
}

function storedQuotes(request: Record<string, unknown>, ids: string[]) {
  return ids.map((id) => quoteRecord(request, id))
}

function rankingOf(settings: FormSettings, quotes: Record<string, unknown>[]) {
  return quoteRanking(
    {
      sourcing: {
        quotes: quotes.map((quote) => ({
          id: String(quote.id),
          supplier: String(quote.supplier ?? ""),
          supplierId: null,
          currency: String(quote.currency),
          total: Number(quote.total),
          qty: Number(quote.qty),
          unitPrice: Number(quote.unitPrice),
          techPass: quote.techPass !== false,
          scores: Array.isArray(quote.scores) ? quote.scores : technicalScores,
          cscores: Array.isArray(quote.cscores) ? quote.cscores : commercialScores,
        })),
      },
    },
    settings,
  ).map((item) => ({
    id: item.id,
    overall: item.overall.toFixed(1),
    rank: item.rank,
  }))
}

function storedRanking(state: Snapshot, number: string) {
  const rank = storeRequests(state)[number]?.rank
  if (!rank) throw new Error(`stored rank missing for ${number}`)
  return rank.map((item) => ({
    id: item.id,
    overall: item.overall.toFixed(1),
    rank: item.rank,
  }))
}

function rankedById(rows: { id?: unknown; overall: string; rank: unknown }[]) {
  return rows.slice().sort((left, right) => String(left.id).localeCompare(String(right.id)))
}

function viewRanking(request: Record<string, unknown>) {
  if (!Array.isArray(request.ranking)) throw new Error("view ranking missing")
  return request.ranking.map((item) => {
    const row = item as { id?: unknown; overall?: unknown; rank?: unknown }
    if (typeof row.overall !== "number") throw new Error("view ranking overall missing")
    return { id: row.id, overall: row.overall.toFixed(1), rank: row.rank }
  })
}

function primaryRanking() {
  return primaryOracle.map((row) => ({ id: row.id, overall: row.overall, rank: Number(row.rank) }))
}

function sourcingScreen(state: Snapshot, number: string) {
  const { viewed, html } = shown(state, "Requests", { filter: "All" })
  const requests = viewed.data.requests
  if (!Array.isArray(requests)) throw new Error("requests missing")
  const request = requests.find(
    (item) => !!item && typeof item === "object" && "number" in item && item.number === number,
  )
  if (!request || typeof request !== "object") throw new Error(`view missed ${number}`)
  const settings = formSettings(viewed.data)
  lockScoreOracle(settings)
  return { request: request as Record<string, unknown>, settings, section: sourcingSection(html, number) }
}

function changeSettings(state: Snapshot, change: (settings: Record<string, unknown>) => void) {
  const current = shown(state, "Settings").viewed.data.settings
  if (!current || typeof current !== "object") throw new Error("settings missing")
  const next = structuredClone(current) as Record<string, unknown>
  change(next)
  must(state, "Settings", "save", next)
}

function setEur(settings: Record<string, unknown>, rate: number) {
  if (!Array.isArray(settings.fxRates)) throw new Error("fx rates missing")
  settings.fxRates = settings.fxRates.map((item) => {
    if (!item || typeof item !== "object" || !("code" in item)) return item
    return (item as { code?: unknown }).code === "EUR" ? { ...item, rate } : item
  })
}

function liveSettings(state: Snapshot) {
  const store = state.data.store
  if (!store || typeof store !== "object" || !("settings" in store)) throw new Error("live settings missing")
  const settings = (store as { settings?: Record<string, unknown> }).settings
  if (!settings) throw new Error("live settings missing")
  return settings
}

function liveEur(state: Snapshot) {
  const rates = liveSettings(state).fxRates
  if (!Array.isArray(rates)) throw new Error("live fx rates missing")
  const eur = rates.find((rate) => !!rate && typeof rate === "object" && (rate as { code?: unknown }).code === "EUR") as
    | { rate?: unknown }
    | undefined
  if (typeof eur?.rate !== "number") throw new Error("live EUR rate missing")
  return eur.rate
}

function requestsPage(state: Snapshot) {
  return shown(state, "Requests", { filter: "All" }).html
}

test("pending purchase orders keep the frozen approval amount after the euro rate changes", () => {
  const state = begin()
  const eurIssued = reachPending(state, { title: "Euro issued", expenseType: "OPEX", currency: "EUR", unitPrice: 10000 })
  const eurApproved = reachPending(state, {
    title: "Euro approved",
    expenseType: "CAPEX",
    currency: "EUR",
    unitPrice: 10000,
  })
  const usdIssued = reachPending(state, { title: "Dollar issued", expenseType: "OPEX", currency: "USD", unitPrice: 5000 })
  changeSettings(state, (settings) => setEur(settings, 2))
  expect(liveEur(state)).toBe(2)
  const approvals = shown(state, "My approvals").html
  expect({
    eurIssued: amountFor(approvals, eurIssued),
    eurApproved: amountFor(approvals, eurApproved),
    usdIssued: amountFor(approvals, usdIssued),
    eurIssuedStored: poAccount(storedRequest(state, eurIssued)).amount,
    eurApprovedStored: poAccount(storedRequest(state, eurApproved)).amount,
    usdStored: poAccount(storedRequest(state, usdIssued)).amount,
    eurFx: poAccount(storedRequest(state, eurIssued)).fxRate,
    capexFx: poAccount(storedRequest(state, eurApproved)).fxRate,
    usdFx: poAccount(storedRequest(state, usdIssued)).fxRate,
  }).toEqual({
    eurIssued: 10800,
    eurApproved: 10800,
    usdIssued: 5000,
    eurIssuedStored: 10800,
    eurApprovedStored: 10800,
    usdStored: 5000,
    eurFx: 1.08,
    capexFx: 1.08,
    usdFx: 1,
  })
})

function issuedFrozenTrio() {
  const state = begin()
  const eurIssued = reachPending(state, { title: "Euro issued", expenseType: "OPEX", currency: "EUR", unitPrice: 10000 })
  const eurApproved = reachPending(state, {
    title: "Euro approved",
    expenseType: "CAPEX",
    currency: "EUR",
    unitPrice: 10000,
  })
  const usdIssued = reachPending(state, { title: "Dollar issued", expenseType: "OPEX", currency: "USD", unitPrice: 5000 })
  must(state, "Requests", "approve", {}, eurIssued)
  must(state, "Requests", "issue", {}, eurIssued)
  must(state, "Requests", "approve", {}, eurApproved)
  must(state, "Requests", "approve", {}, usdIssued)
  must(state, "Requests", "issue", {}, usdIssued)
  const frozenRequests = structuredClone(storeRequests(state))
  changeSettings(state, (settings) => setEur(settings, 2))
  expect(storeRequests(state)).toEqual(frozenRequests)
  expect(liveEur(state)).toBe(2)
  return { state, eurIssued, eurApproved, usdIssued }
}

test("issued and approved purchase orders keep the pre-change base on screen", () => {
  const { state, eurIssued, eurApproved, usdIssued } = issuedFrozenTrio()
  expect(liveSettings(state).currency).toBe("USD")
  expect(liveSettings(state).levels).toEqual([
    { id: "L1", name: "CIO-1 (Level 1)", threshold: 0, holderId: null },
    { id: "L2", name: "CIO (Level 2)", threshold: 30000, holderId: null },
  ])
  const dashboard = shown(state, "Dashboard").html
  const requests = requestsPage(state)
  expect({
    open: metricValue(dashboard, "Open requests"),
    issuedOpex: metricValue(dashboard, "Issued OPEX"),
    issuedCapex: metricValue(dashboard, "Issued CAPEX"),
  }).toEqual({ open: 1, issuedOpex: 15800, issuedCapex: 10800 })
  expect({
    dashboardEurIssued: amountFor(dashboard, eurIssued),
    dashboardEurApproved: amountFor(dashboard, eurApproved),
    dashboardUsdIssued: amountFor(dashboard, usdIssued),
    requestsEurIssued: amountFor(requests, eurIssued),
    requestsEurApproved: amountFor(requests, eurApproved),
    requestsUsdIssued: amountFor(requests, usdIssued),
  }).toEqual({
    dashboardEurIssued: 10800,
    dashboardEurApproved: 10800,
    dashboardUsdIssued: 5000,
    requestsEurIssued: 10800,
    requestsEurApproved: 10800,
    requestsUsdIssued: 5000,
  })
  expect(poAccount(storedRequest(state, eurIssued)).fxRate).toBe(1.08)
  expect(poAccount(storedRequest(state, usdIssued)).fxRate).toBe(1)
})

test("issued and approved register bases stay at the pre-change rate and match the screen", async () => {
  const { state, eurIssued, eurApproved, usdIssued } = issuedFrozenTrio()
  const rows = await registerRows(state)
  const dashboard = shown(state, "Dashboard").html
  const requests = requestsPage(state)
  expect(registerMoney(rows, eurIssued)).toEqual({ currencyTotal: 10000, base: 10800, currency: "EUR" })
  expect(registerMoney(rows, eurApproved)).toEqual({ currencyTotal: 10000, base: 10800, currency: "EUR" })
  expect(registerMoney(rows, usdIssued)).toEqual({ currencyTotal: 5000, base: 5000, currency: "USD" })
  expect(amountFor(dashboard, eurIssued)).toBe(10800)
  expect(amountFor(requests, eurIssued)).toBe(registerMoney(rows, eurIssued).base)
  expect(amountFor(dashboard, eurApproved)).toBe(registerMoney(rows, eurApproved).base)
  expect(amountFor(requests, usdIssued)).toBe(registerMoney(rows, usdIssued).base)
})

function euroPairAfterRateChange() {
  const state = begin()
  const earlier = reachPending(state, { title: "Earlier euro", expenseType: "OPEX", currency: "EUR", unitPrice: 10000 })
  changeSettings(state, (settings) => setEur(settings, 2))
  expect(liveEur(state)).toBe(2)
  const later = reachPending(state, { title: "Later euro", expenseType: "OPEX", currency: "EUR", unitPrice: 10000 })
  return { state, earlier, later }
}

test("a euro purchase order submitted after the rate change keeps the earlier frozen approval", async () => {
  const { state, earlier, later } = euroPairAfterRateChange()
  expect(poAccount(storedRequest(state, earlier))).toMatchObject({ currency: "EUR", fxRate: 1.08, amount: 10800 })
  expect(poAccount(storedRequest(state, later))).toMatchObject({ currency: "EUR", fxRate: 2, amount: 20000 })
  const pendingApprovals = shown(state, "My approvals").html
  expect(amountFor(pendingApprovals, earlier)).toBe(10800)
  expect(amountFor(pendingApprovals, later)).toBe(20000)
  const pendingRows = await registerRows(state)
  expect(registerMoney(pendingRows, earlier)).toEqual({ currencyTotal: 10000, base: 10800, currency: "EUR" })
  expect(registerMoney(pendingRows, later)).toEqual({ currencyTotal: 10000, base: 20000, currency: "EUR" })
})

test("dashboard and requests keep the earlier base and show the new base after the rate change", async () => {
  const { state, earlier, later } = euroPairAfterRateChange()
  must(state, "Requests", "approve", {}, earlier)
  must(state, "Requests", "issue", {}, earlier)
  must(state, "Requests", "approve", {}, later)
  const dashboard = shown(state, "Dashboard").html
  const requests = requestsPage(state)
  const rows = await registerRows(state)
  expect(metricValue(dashboard, "Open requests")).toBe(1)
  expect(metricValue(dashboard, "Issued OPEX")).toBe(30800)
  expect(amountFor(dashboard, earlier)).toBe(10800)
  expect(amountFor(dashboard, later)).toBe(20000)
  expect(amountFor(requests, earlier)).toBe(10800)
  expect(amountFor(requests, later)).toBe(20000)
  expect(amountFor(dashboard, earlier)).toBe(registerMoney(rows, earlier).base)
  expect(amountFor(requests, later)).toBe(registerMoney(rows, later).base)
  expect(registerMoney(rows, earlier).base).toBe(10800)
  expect(registerMoney(rows, later).base).toBe(20000)
})

test("a purchase order of 30000 freezes only level one", () => {
  const state = begin()
  const number = reachPending(state, { title: "Exact route", expenseType: "OPEX", currency: "USD", unitPrice: 30000 })
  const account = poAccount(storedRequest(state, number))
  expect(account.amount).toBe(30000)
  expect(account.fxRate).toBe(1)
  expect(account.levelIds).toEqual(["L1"])
  expect(account.thresholds).toEqual([0])
  expect(account.holderIds).toEqual([null])
  expect(account.amount === 30000).toBe(true)
  expect(Number(account.amount) > 30000).toBe(false)
})

test("a euro purchase order strictly above 30000 freezes level one then level two", () => {
  const state = begin()
  const number = reachPending(state, { title: "Upper route", expenseType: "CAPEX", currency: "EUR", unitPrice: 40000 })
  const account = poAccount(storedRequest(state, number))
  expect(account.currency).toBe("EUR")
  expect(account.fxRate).toBe(1.08)
  expect(account.amount).toBe(43200)
  expect(Number(account.amount) > 30000).toBe(true)
  expect(account.levelIds).toEqual(["L1", "L2"])
  expect(account.thresholds).toEqual([0, 30000])
  expect(account.holderIds).toEqual([null, null])
})

test("converted purchase order totals copy both levels only when the base is strictly above 30000", () => {
  const state = begin()
  expect(liveSettings(state).levels).toEqual([
    { id: "L1", name: "CIO-1 (Level 1)", threshold: 0, holderId: null },
    { id: "L2", name: "CIO (Level 2)", threshold: 30000, holderId: null },
  ])
  const aboveNumber = reachPending(state, {
    title: "Euro crosses",
    expenseType: "OPEX",
    currency: "EUR",
    unitPrice: 28000,
  })
  const above = storedRequest(state, aboveNumber)
  const aboveAccount = poAccount(above)
  const aboveCurrency = lineTotal(above)
  const aboveBase = aboveCurrency * 1.08
  expect(aboveAccount.currency).toBe("EUR")
  expect(aboveAccount.fxRate).toBe(1.08)
  expect(aboveCurrency).toBe(28000)
  expect(aboveCurrency <= 30000).toBe(true)
  expect(aboveBase > 30000).toBe(true)
  expect(aboveAccount.amount).toBe(aboveBase)
  expect(aboveAccount.levelIds).toEqual(["L1", "L2"])
  expect(aboveAccount.thresholds).toEqual([0, 30000])
  expect(aboveAccount.holderIds).toEqual([null, null])

  const withinNumber = reachPending(state, {
    title: "Euro within",
    expenseType: "CAPEX",
    currency: "EUR",
    unitPrice: 27000,
  })
  const within = storedRequest(state, withinNumber)
  const withinAccount = poAccount(within)
  const withinCurrency = lineTotal(within)
  const withinBase = withinCurrency * 1.08
  expect(withinAccount.currency).toBe("EUR")
  expect(withinAccount.fxRate).toBe(1.08)
  expect(withinCurrency).toBe(27000)
  expect(withinBase <= 30000).toBe(true)
  expect(withinBase > 30000).toBe(false)
  expect(withinAccount.amount).toBe(withinBase)
  expect(withinAccount.levelIds).toEqual(["L1"])
  expect(withinAccount.thresholds).toEqual([0])
  expect(withinAccount.holderIds).toEqual([null])

  const exactNumber = reachPending(state, {
    title: "Exact base boundary",
    expenseType: "OPEX",
    currency: "USD",
    unitPrice: 30000,
  })
  const exactAccount = poAccount(storedRequest(state, exactNumber))
  expect(exactAccount.amount).toBe(30000)
  expect(exactAccount.fxRate).toBe(1)
  expect(exactAccount.amount === 30000).toBe(true)
  expect(Number(exactAccount.amount) > 30000).toBe(false)
  expect(exactAccount.levelIds).toEqual(["L1"])
  expect(exactAccount.thresholds).toEqual([0])
  expect(exactAccount.holderIds).toEqual([null])
})

test("later settings do not rewrite copied steps or an already issued purchase order", () => {
  const state = begin()
  const exact = reachPending(state, { title: "Issued exact", expenseType: "OPEX", currency: "USD", unitPrice: 30000 })
  const above = reachPending(state, { title: "Pending upper", expenseType: "CAPEX", currency: "EUR", unitPrice: 40000 })
  must(state, "Requests", "approve", {}, exact)
  must(state, "Requests", "issue", {}, exact)
  const issuedBefore = poAccount(storedRequest(state, exact))
  const upperBefore = poAccount(storedRequest(state, above))
  expect(storedRequest(state, exact).status).toBe("po_issued")
  expect(issuedBefore.levelIds).toEqual(["L1"])
  expect(upperBefore.levelIds).toEqual(["L1", "L2"])
  changeSettings(state, (settings) => {
    setEur(settings, 2)
    if (!Array.isArray(settings.levels)) throw new Error("levels missing")
    settings.levels = settings.levels.map((level) => {
      if (!level || typeof level !== "object") return level
      const record = level as { id?: unknown; threshold?: unknown; holderId?: unknown }
      if (record.id === "L1") return { ...record, holderId: "buyer" }
      if (record.id === "L2") return { ...record, threshold: 0 }
      return level
    })
  })
  const live = liveSettings(state)
  expect(liveEur(state)).toBe(2)
  expect(live.levels).toEqual([
    { id: "L1", name: "CIO-1 (Level 1)", threshold: 0, holderId: "buyer" },
    { id: "L2", name: "CIO (Level 2)", threshold: 0, holderId: null },
  ])
  const issuedAfter = poAccount(storedRequest(state, exact))
  const upperAfter = poAccount(storedRequest(state, above))
  expect(storedRequest(state, exact).status).toBe("po_issued")
  expect(issuedAfter.issuedAt).toBe(issuedBefore.issuedAt)
  expect(issuedAfter.steps).toEqual(issuedBefore.steps)
  expect(issuedAfter.fxRate).toBe(1)
  expect(issuedAfter.amount).toBe(30000)
  expect(issuedAfter.holderIds).toEqual([null])
  expect(upperAfter.steps).toEqual(upperBefore.steps)
  expect(upperAfter.fxRate).toBe(1.08)
  expect(upperAfter.amount).toBe(43200)
  expect(upperAfter.levelIds).toEqual(["L1", "L2"])
  expect(upperAfter.holderIds).toEqual([null, null])
})

test("an over-approved purchase order above 30000 still submits and freezes both levels", () => {
  const state = begin()
  const number = reachDraft(state, 10000)
  expect(sourcingAmount(storedRequest(state, number))).toBe(10000)
  expect(poAccount(storedRequest(state, number)).fxRate).toBeNull()
  expect(poAccount(storedRequest(state, number)).approval).toBeNull()
  must(
    state,
    "Requests",
    "save",
    purchaseOrderFields({ currency: "EUR", expenseType: "OPEX", unitPrice: 40000, supplier: "Mill 1" }),
    number,
  )
  const before = storedRequest(state, number)
  const base = lineTotal(before) * 1.08
  expect(base).toBe(43200)
  expect(base > sourcingAmount(before) + 0.005).toBe(true)
  expect(base > 30000).toBe(true)
  expect(poAccount(before).fxRate).toBeNull()
  const section = poSection(requestsPage(state), number)
  expectSubmitPoEnabled(section)
  expectWarning(section, base, sourcingAmount(before))
  const submitted = must(state, "Requests", "submit_po", {}, number)
  expect(submitted.ok).toBe(true)
  const after = storedRequest(state, number)
  expect(after.status).toBe("po_pending")
  expect(poAccount(after)).toMatchObject({
    currency: "EUR",
    fxRate: 1.08,
    amount: 43200,
    levelIds: ["L1", "L2"],
    thresholds: [0, 30000],
  })
  expectWarning(poSection(requestsPage(state), number), base, sourcingAmount(after))
})

test("an excess of 0.005 does not warn and still submits", () => {
  const state = begin()
  const number = reachDraft(state)
  const approved = sourcingAmount(storedRequest(state, number))
  expect(approved).toBe(10000)
  const unitPrice = approved + 0.005
  must(
    state,
    "Requests",
    "save",
    purchaseOrderFields({ currency: "USD", expenseType: "OPEX", unitPrice, supplier: "Mill 1" }),
    number,
  )
  const before = storedRequest(state, number)
  const base = lineTotal(before)
  expect(base).toBe(unitPrice)
  expect(base > approved + 0.005).toBe(false)
  expect(poAccount(before).fxRate).toBeNull()
  const section = poSection(requestsPage(state), number)
  expectNoWarning(section, base, approved)
  expectSubmitPoEnabled(section)
  expect(must(state, "Requests", "submit_po", {}, number).ok).toBe(true)
  const after = storedRequest(state, number)
  expect(after.status).toBe("po_pending")
  expect(poAccount(after).amount).toBe(base)
  expect(poAccount(after).fxRate).toBe(1)
  expectNoWarning(poSection(requestsPage(state), number), base, approved)
})

test("an excess of 0.006 warns without blocking submit", () => {
  const state = begin()
  const number = reachDraft(state)
  const approved = sourcingAmount(storedRequest(state, number))
  expect(approved).toBe(10000)
  const unitPrice = approved + 0.006
  must(
    state,
    "Requests",
    "save",
    purchaseOrderFields({ currency: "USD", expenseType: "OPEX", unitPrice, supplier: "Mill 1" }),
    number,
  )
  const before = storedRequest(state, number)
  const base = lineTotal(before)
  expect(base).toBe(unitPrice)
  expect(base > approved + 0.005).toBe(true)
  const section = poSection(requestsPage(state), number)
  expectWarning(section, base, approved)
  expectSubmitPoEnabled(section)
  expect(poAccount(before).fxRate).toBeNull()
  expect(must(state, "Requests", "submit_po", {}, number).ok).toBe(true)
  const after = storedRequest(state, number)
  expect(after.status).toBe("po_pending")
  expect(poAccount(after).amount).toBe(base)
  expect(poAccount(after).fxRate).toBe(1)
  expectWarning(poSection(requestsPage(state), number), base, approved)
})

test("a non-base purchase order inside the tolerance does not warn", () => {
  const state = begin()
  const number = reachDraft(state)
  const approved = sourcingAmount(storedRequest(state, number))
  expect(approved).toBe(10000)
  const unitPrice = 9259
  must(
    state,
    "Requests",
    "save",
    purchaseOrderFields({ currency: "EUR", expenseType: "OPEX", unitPrice, supplier: "Mill 1" }),
    number,
  )
  const before = storedRequest(state, number)
  const base = lineTotal(before) * 1.08
  expect(lineTotal(before)).toBe(unitPrice)
  expect(base).not.toBe(unitPrice)
  expect(base <= approved + 0.005).toBe(true)
  expect(poAccount(before)).toMatchObject({ currency: "EUR", fxRate: null, approval: null })
  const section = poSection(requestsPage(state), number)
  expectNoWarning(section, base, approved)
  expectSubmitPoEnabled(section)
  expect(must(state, "Requests", "submit_po", {}, number).ok).toBe(true)
  const after = storedRequest(state, number)
  expect(after.status).toBe("po_pending")
  expect(poAccount(after)).toMatchObject({ currency: "EUR", fxRate: 1.08, amount: base })
  expectNoWarning(poSection(requestsPage(state), number), base, approved)
})

test("a non-base purchase order above the tolerance warns and still submits", () => {
  const state = begin()
  const number = reachDraft(state)
  const approved = sourcingAmount(storedRequest(state, number))
  expect(approved).toBe(10000)
  must(
    state,
    "Requests",
    "save",
    purchaseOrderFields({ currency: "EUR", expenseType: "OPEX", unitPrice: 10000, supplier: "Mill 1" }),
    number,
  )
  const before = storedRequest(state, number)
  const base = lineTotal(before) * 1.08
  expect(lineTotal(before)).toBe(10000)
  expect(base).toBe(10800)
  expect(base > approved + 0.005).toBe(true)
  expect(poAccount(before).fxRate).toBeNull()
  const section = poSection(requestsPage(state), number)
  expectWarning(section, base, approved)
  expectSubmitPoEnabled(section)
  expect(must(state, "Requests", "submit_po", {}, number).ok).toBe(true)
  const after = storedRequest(state, number)
  expect(after.status).toBe("po_pending")
  expect(poAccount(after)).toMatchObject({ currency: "EUR", fxRate: 1.08, amount: 10800, levelIds: ["L1"] })
  expectWarning(poSection(requestsPage(state), number), base, approved)
})

test("one draft freezes sourcing at 1.08 and the purchase order at the rate on submit", () => {
  const state = begin()
  const unitPrice = 20000
  const quotes: QuoteInput[] = [0, 1000, 2000].map((extra, index) => ({
    id: `q${index + 1}`,
    supplier: `Mill ${index + 1}`,
    currency: "EUR",
    qty: 1,
    unitPrice: unitPrice + extra,
    total: unitPrice + extra,
  }))
  const number = reachSourcing(state, "Same draft euro", "OPEX", unitPrice)
  must(state, "Requests", "save", sourcingFields(quotes), number)
  must(state, "Requests", "select_quote", { quoteId: "q1" }, number)
  must(state, "Requests", "submit_sourcing", {}, number)
  must(state, "Requests", "approve", {}, number)
  const drafted = storedRequest(state, number)
  const approvedBase = unitPrice * 1.08
  expect(drafted.status).toBe("po_draft")
  expect(quoteRecord(drafted, "q1")).toMatchObject({ currency: "EUR", total: unitPrice, qty: 1, unitPrice })
  expect(approvedBase <= 30000).toBe(true)
  expect(sourcingApproval(drafted)).toEqual({
    amount: approvedBase,
    fxRate: 1.08,
    levelIds: ["L1"],
    thresholds: [0],
    holderIds: [null],
  })
  expect(fxSnapshotOf(drafted)).toEqual({ EUR: 1.08 })
  expect(poAccount(drafted)).toMatchObject({ currency: "EUR", fxRate: null, approval: null })
  expect(lineTotal(drafted)).toBe(unitPrice)
  const frozenSourcing = sourcingApproval(drafted)
  const frozenSnapshot = structuredClone(fxSnapshotOf(drafted))
  must(
    state,
    "Requests",
    "save",
    purchaseOrderFields({ currency: "EUR", expenseType: "OPEX", unitPrice, supplier: "Mill 1" }),
    number,
  )
  expect(lineTotal(storedRequest(state, number))).toBe(unitPrice)
  expect(poAccount(storedRequest(state, number)).fxRate).toBeNull()
  expect(poAccount(storedRequest(state, number)).approval).toBeNull()
  changeSettings(state, (settings) => setEur(settings, 2))
  expect(liveEur(state)).toBe(2)
  const liveBase = lineTotal(storedRequest(state, number)) * 2
  expect(liveBase).toBe(40000)
  expect(liveBase > frozenSourcing.amount + 0.005).toBe(true)
  expect(poAccount(storedRequest(state, number)).fxRate).toBeNull()
  expect(poAccount(storedRequest(state, number)).approval).toBeNull()
  expectWarning(poSection(requestsPage(state), number), liveBase, frozenSourcing.amount)
  expect(sourcingApproval(storedRequest(state, number))).toEqual(frozenSourcing)
  expect(fxSnapshotOf(storedRequest(state, number))).toEqual(frozenSnapshot)
  const submitted = must(state, "Requests", "submit_po", {}, number)
  expect(submitted.ok).toBe(true)
  const pending = storedRequest(state, number)
  expect(pending.status).toBe("po_pending")
  expect(lineTotal(pending)).toBe(unitPrice)
  expect(poAccount(pending)).toMatchObject({
    currency: "EUR",
    fxRate: 2,
    amount: liveBase,
    levelIds: ["L1", "L2"],
    thresholds: [0, 30000],
    holderIds: [null, null],
  })
  expect(liveBase > 30000).toBe(true)
  expect(sourcingApproval(pending)).toEqual(frozenSourcing)
  expect(fxSnapshotOf(pending)).toEqual(frozenSnapshot)
  const copiedSteps = structuredClone(poAccount(pending).steps)
  changeSettings(state, (settings) => {
    setEur(settings, 3)
    if (!Array.isArray(settings.levels)) throw new Error("levels missing")
    settings.levels = settings.levels.map((level) => {
      if (!level || typeof level !== "object") return level
      const record = level as { id?: unknown }
      if (record.id === "L1") return { ...level, holderId: "buyer" }
      if (record.id === "L2") return { ...level, threshold: 0 }
      return level
    })
  })
  expect(liveEur(state)).toBe(3)
  expect(liveSettings(state).levels).toEqual([
    { id: "L1", name: "CIO-1 (Level 1)", threshold: 0, holderId: "buyer" },
    { id: "L2", name: "CIO (Level 2)", threshold: 0, holderId: null },
  ])
  expect(lineTotal(storedRequest(state, number)) * 3).toBe(60000)
  const later = poAccount(storedRequest(state, number))
  expect(later.fxRate).toBe(2)
  expect(later.amount).toBe(liveBase)
  expect(later.steps).toEqual(copiedSteps)
  expect(later.levelIds).toEqual(["L1", "L2"])
  expect(later.thresholds).toEqual([0, 30000])
  expect(later.holderIds).toEqual([null, null])
  expect(sourcingApproval(storedRequest(state, number))).toEqual(frozenSourcing)
  expect(fxSnapshotOf(storedRequest(state, number))).toEqual(frozenSnapshot)
  const laterSection = poSection(requestsPage(state), number)
  expectWarning(laterSection, liveBase, frozenSourcing.amount)
  expect(poAlerts(laterSection).filter((text) => mentions(text, 60000, frozenSourcing.amount))).toEqual([])
})

test("a missing description is refused and the over-amount warning stays visible", () => {
  const state = begin()
  const number = reachDraft(state)
  const approved = sourcingAmount(storedRequest(state, number))
  expect(approved).toBe(10000)
  must(
    state,
    "Requests",
    "save",
    purchaseOrderFields({
      currency: "USD",
      expenseType: "OPEX",
      unitPrice: 15000,
      supplier: "Mill 1",
      description: "",
    }),
    number,
  )
  const before = storedRequest(state, number)
  const base = lineTotal(before)
  expect(base).toBe(15000)
  const section = poSection(requestsPage(state), number)
  expectWarning(section, base, approved)
  expectSubmitPoEnabled(section)
  const failed = refused(state, number, "submit_po")
  expect(failed.ok).toBe(false)
  if (failed.ok) throw new Error("incomplete purchase order was accepted")
  const after = storedRequest(state, number)
  expect(after.status).toBe("po_draft")
  expect(poAccount(after).fxRate).toBeNull()
  expect(poAccount(after).approval).toBeNull()
  const again = poSection(requestsPage(state), number)
  expectWarning(again, base, approved)
  expectSubmitPoEnabled(again)
})

function savedPrimaryQuotes(title: string) {
  const state = begin()
  const quotes = rankingQuotes()
  const number = reachSourcing(state, title, "OPEX", 8000)
  must(state, "Requests", "save", sourcingFields(quotes), number)
  return { state, quotes, number, ...sourcingScreen(state, number) }
}

test("sourcing shows the published evaluation before submit", () => {
  const { request, section } = savedPrimaryQuotes("Ranked sourcing")
  expect(quoteRecord(request, "q2").scores).toEqual(technicalScores)
  expect(quoteRecord(request, "q2").cscores).toEqual(commercialScores)
  expectEvaluation(section, primaryOracle)
  expect(section).not.toContain("not the top-ranked quote")
})

test("quoteRanking matches the published arithmetic before submit", () => {
  const { request, settings, quotes } = savedPrimaryQuotes("Ranked formula")
  const stored = storedQuotes(request, quotes.map((quote) => quote.id))
  expect(rankingOf(settings, stored)).toEqual(primaryRanking())
})

function submitRanked(title: string, quoteId: string) {
  const state = begin()
  const quotes = rankingQuotes()
  const number = reachSourcing(state, title, "OPEX", 8000)
  must(state, "Requests", "save", sourcingFields(quotes), number)
  must(state, "Requests", "select_quote", { quoteId }, number)
  return { state, quotes, number }
}

test("rank 1 submits without justification and stores the published ranking", () => {
  const { state, quotes, number } = submitRanked("Submitted ranking", "q1")
  expect(sourcingSection(requestsPage(state), number)).not.toContain("not the top-ranked quote")
  const submitted = must(state, "Requests", "submit_sourcing", {}, number)
  expect(submitted.ok).toBe(true)
  const { request, settings } = sourcingScreen(state, number)
  const stored = storedQuotes(request, quotes.map((quote) => quote.id))
  expect(storedRanking(state, number)).toEqual(primaryRanking())
  expect(viewRanking(request)).toEqual(primaryRanking())
  expect(rankingOf(settings, stored)).toEqual(primaryRanking())
  expect(quoteRecord(request, "q1").cscores).toEqual(commercialScores)
})

test("the published evaluation remains after a rank-1 submit", () => {
  const { state, number } = submitRanked("Submitted evaluation", "q1")
  must(state, "Requests", "submit_sourcing", {}, number)
  const { section } = sourcingScreen(state, number)
  expect(section).not.toContain("not the top-ranked quote")
  expectEvaluation(section, primaryOracle)
})

test("a non-rank-1 selection is marked and refused without justification", () => {
  const { state, number } = submitRanked("Marked selection", "q2")
  expect(sourcingSection(requestsPage(state), number)).toContain("not the top-ranked quote")
  const failed = refused(state, number, "submit_sourcing")
  expect(failed.ok).toBe(false)
  if (failed.ok) throw new Error("non-rank-1 sourcing was accepted")
  expect(failed.errors).toContain(selectionRankError)
  expect(storedRequest(state, number).status).toBe("sourcing")
})

test("a non-rank-1 selection still shows the published evaluation", () => {
  const { state, number } = submitRanked("Marked evaluation", "q2")
  expectEvaluation(sourcingScreen(state, number).section, primaryOracle)
})

test("a justified non-rank-1 selection stores the published ranking", () => {
  const { state, number } = submitRanked("Justified selection", "q2")
  const accepted = must(
    state,
    "Requests",
    "submit_sourcing",
    { "sourcing.selectionJustification": "Bravo delivers sooner and the price gap is accepted." },
    number,
  )
  expect(accepted.ok).toBe(true)
  const after = sourcingScreen(state, number)
  expect(after.section).toContain("not the top-ranked quote")
  expect(storedRanking(state, number)).toEqual(primaryRanking())
  expectEvaluation(after.section, primaryOracle)
})

function crossedFxQuotes() {
  const state = begin()
  const quotes: QuoteInput[] = [
    { id: "q-euro", supplier: "Euro Mill", currency: "EUR", qty: 1, unitPrice: 9000, total: 9000 },
    { id: "q-dollar", supplier: "Dollar Mill", currency: "USD", qty: 1, unitPrice: 9500, total: 9500 },
    { id: "q-high", supplier: "High Mill", currency: "USD", qty: 1, unitPrice: 19000, total: 19000 },
  ]
  const number = reachSourcing(state, "Crossed fx", "OPEX", 9000)
  must(state, "Requests", "save", sourcingFields(quotes), number)
  const screen = sourcingScreen(state, number)
  const stored = storedQuotes(screen.request, quotes.map((quote) => quote.id))
  const oracle = ranksFor([
    { id: "q-euro", base: 9000 * 1.08 },
    { id: "q-dollar", base: 9500 },
    { id: "q-high", base: 19000 },
  ])
  return { stored, oracle, ...screen }
}

test("price scores follow base order when raw currency order disagrees", () => {
  const { stored, settings, oracle } = crossedFxQuotes()
  expect(stored.map((quote) => ({ id: quote.id, currency: quote.currency, total: quote.total }))).toEqual([
    { id: "q-euro", currency: "EUR", total: 9000 },
    { id: "q-dollar", currency: "USD", total: 9500 },
    { id: "q-high", currency: "USD", total: 19000 },
  ])
  expect(9000).toBeLessThan(9500)
  expect(9000 * 1.08).toBeGreaterThan(9500)
  expect(9000 * 1.08).toBe(9720)
  const dollar = oracle.find((row) => row.id === "q-dollar")
  const euro = oracle.find((row) => row.id === "q-euro")
  const high = oracle.find((row) => row.id === "q-high")
  if (!dollar || !euro || !high) throw new Error("cross oracle missing")
  expect(publishedScore(9500, 9500)).toEqual({ price: "100.0", commercial: "100.0", overall: "100.0" })
  expect(publishedScore(9000 * 1.08, 9500).price).not.toBe("100.0")
  expect(dollar).toEqual({ id: "q-dollar", overall: "100.0", rank: 1 })
  expect(euro.rank).toBe(2)
  expect(high.rank).toBe(3)
  expect(rankingOf(settings, stored)).toEqual(oracle)
})

test("the evaluation table and quote totals follow that base order", () => {
  const { section, oracle } = crossedFxQuotes()
  const euroScore = publishedScore(9000 * 1.08, 9500)
  const highScore = publishedScore(19000, 9500)
  const euro = oracle.find((row) => row.id === "q-euro")
  const high = oracle.find((row) => row.id === "q-high")
  expect(euro?.rank).toBe(2)
  expect(high?.rank).toBe(3)
  expect(euroScore.price).not.toBe("100.0")
  expectEvaluation(section, [
    {
      supplier: "Euro Mill",
      technical: "100.0",
      price: euroScore.price,
      commercial: euroScore.commercial,
      overall: euroScore.overall,
      rank: "2",
    },
    { supplier: "Dollar Mill", technical: "100.0", price: "100.0", commercial: "100.0", overall: "100.0", rank: "1" },
    {
      supplier: "High Mill",
      technical: "100.0",
      price: highScore.price,
      commercial: highScore.commercial,
      overall: highScore.overall,
      rank: "3",
    },
  ])
  expect(visibleQuoteTotal(section, "Euro Mill")).toBe(9000)
  expect(visibleQuoteTotal(section, "Euro Mill")).not.toBe(9720)
  expect(visibleQuoteTotal(section, "Dollar Mill")).toBe(9500)
  expect(visibleQuoteTotal(section, "High Mill")).toBe(19000)
})

test("ranking stays on the frozen fx snapshot when the live rate would reorder quotes", () => {
  const state = begin()
  const quotes: QuoteInput[] = [
    { id: "q-euro", supplier: "Euro Mill", currency: "EUR", qty: 1, unitPrice: 9000, total: 9000 },
    { id: "q-dollar", supplier: "Dollar Mill", currency: "USD", qty: 1, unitPrice: 9500, total: 9500 },
    { id: "q-high", supplier: "High Mill", currency: "USD", qty: 1, unitPrice: 19000, total: 19000 },
  ]
  const rows = [
    { supplier: "Euro Mill", technical: "100.0", price: "97.7", commercial: "98.4", overall: "99.4", rank: "2" },
    { supplier: "Dollar Mill", technical: "100.0", price: "100.0", commercial: "100.0", overall: "100.0", rank: "1" },
    { supplier: "High Mill", technical: "100.0", price: "50.0", commercial: "65.0", overall: "86.0", rank: "3" },
  ]
  const frozenRank = [
    { id: "q-dollar", overall: "100.0", rank: 1 },
    { id: "q-euro", overall: "99.4", rank: 2 },
    { id: "q-high", overall: "86.0", rank: 3 },
  ]
  const number = reachSourcing(state, "Frozen fx ranking", "OPEX", 9000)
  must(state, "Requests", "save", sourcingFields(quotes), number)
  const before = sourcingScreen(state, number)
  expect(fxSnapshotOf(storedRequest(state, number))).toBeNull()
  expect(quoteRecord(storedRequest(state, number), "q-euro").scores).toEqual(technicalScores)
  expect(quoteRecord(storedRequest(state, number), "q-euro").cscores).toEqual(commercialScores)
  expect(9000 * 1.08).toBe(9720)
  expect(9720).toBeGreaterThan(9500)
  expectEvaluation(before.section, rows)
  must(state, "Requests", "select_quote", { quoteId: "q-dollar" }, number)
  const submitted = must(state, "Requests", "submit_sourcing", {}, number)
  expect(submitted.ok).toBe(true)
  const frozenSnapshot = structuredClone(fxSnapshotOf(storedRequest(state, number)))
  expect(frozenSnapshot).toEqual({ EUR: 1.08, USD: 1 })
  const submittedScreen = sourcingScreen(state, number)
  expect(rankedById(storedRanking(state, number))).toEqual(frozenRank)
  expect(rankedById(viewRanking(submittedScreen.request))).toEqual(frozenRank)
  expectEvaluation(submittedScreen.section, rows)
  changeSettings(state, (settings) => setEur(settings, 1))
  expect(liveEur(state)).toBe(1)
  expect(9000 * liveEur(state)).toBeLessThan(9500)
  expect(fxSnapshotOf(storedRequest(state, number))).toEqual(frozenSnapshot)
  const opened = shown(state, "Requests", { filter: "All" })
  const requests = opened.viewed.data.requests
  if (!Array.isArray(requests)) throw new Error("requests missing")
  const request = requests.find(
    (item) => !!item && typeof item === "object" && "number" in item && item.number === number,
  )
  if (!request || typeof request !== "object") throw new Error(`view missed ${number}`)
  expect(rankedById(storedRanking(state, number))).toEqual(frozenRank)
  expect(rankedById(viewRanking(request as Record<string, unknown>))).toEqual(frozenRank)
  expectEvaluation(sourcingSection(opened.html, number), rows)
  expect(quoteRecord(storedRequest(state, number), "q-euro").total).toBe(9000)
  expect(quoteRecord(storedRequest(state, number), "q-dollar").total).toBe(9500)
  expect(quoteRecord(storedRequest(state, number), "q-high").total).toBe(19000)
})

test("saving a quote replaces a stale total and leaves the other quote totals", () => {
  const state = begin()
  const quotes: QuoteInput[] = [
    { id: "q-stale", supplier: "Stale Mill", currency: "USD", qty: 2, unitPrice: 10000, total: 10000 },
    { id: "q-mid", supplier: "Mid Mill", currency: "USD", qty: 1, unitPrice: 15000, total: 15000 },
    { id: "q-high", supplier: "High Mill", currency: "USD", qty: 1, unitPrice: 18000, total: 18000 },
  ]
  const number = reachSourcing(state, "Stale total", "OPEX", 10000)
  must(state, "Requests", "save", sourcingFields(quotes), number)
  const request = storedRequest(state, number)
  expect(quoteRecord(request, "q-stale").scores).toEqual(technicalScores)
  expect(quoteRecord(request, "q-stale").cscores).toEqual(commercialScores)
  expect({
    stale: quoteRecord(request, "q-stale").total,
    mid: quoteRecord(request, "q-mid").total,
    high: quoteRecord(request, "q-high").total,
    qty: quoteRecord(request, "q-stale").qty,
    unitPrice: quoteRecord(request, "q-stale").unitPrice,
  }).toEqual({ stale: 20000, mid: 15000, high: 18000, qty: 2, unitPrice: 10000 })
  const section = sourcingSection(requestsPage(state), number)
  expect(visibleQuoteTotal(section, "Stale Mill")).toBe(20000)
  expect(visibleQuoteTotal(section, "Mid Mill")).toBe(15000)
  expect(visibleQuoteTotal(section, "High Mill")).toBe(18000)
})

test("saving rounds half cents and non-binary products with the HTML cent rule", () => {
  const state = begin()
  const half = Math.round(2.5 * 10.25 * 100) / 100
  const odd = Math.round(0.1 * 3 * 100) / 100
  const cent = Math.round(1.005 * 1 * 100) / 100
  expect(2.5 * 10.25).toBe(25.625)
  expect(half).toBe(25.63)
  expect(0.1 * 3).not.toBe(odd)
  expect(1.005).not.toBe(cent)
  const quotes: QuoteInput[] = [
    { id: "q-half", supplier: "Half Mill", currency: "USD", qty: 2.5, unitPrice: 10.25, total: 9 },
    { id: "q-odd", supplier: "Odd Mill", currency: "USD", qty: 3, unitPrice: 0.1, total: 9 },
    { id: "q-cent", supplier: "Cent Mill", currency: "USD", qty: 1, unitPrice: 1.005, total: 9 },
  ]
  const number = reachSourcing(state, "Rounded total", "OPEX", 120)
  must(state, "Requests", "save", sourcingFields(quotes), number)
  const request = storedRequest(state, number)
  expect(quoteRecord(request, "q-half").total).toBe(25.63)
  expect(quoteRecord(request, "q-odd").total).toBe(odd)
  expect(quoteRecord(request, "q-cent").total).toBe(cent)
  expect(quoteRecord(request, "q-odd").total).not.toBe(0.1 * 3)
  expect(quoteRecord(request, "q-cent").total).not.toBe(1.005)
  expect(quoteRecord(request, "q-half").cscores).toEqual(commercialScores)
  const section = sourcingSection(requestsPage(state), number)
  expect(visibleQuoteTotal(section, "Half Mill")).toBe(25.63)
  expect(visibleQuoteTotal(section, "Odd Mill")).toBe(odd)
  expect(visibleQuoteTotal(section, "Cent Mill")).toBe(cent)
})

test("selecting a quote normalizes the total and proposes fxRate null", () => {
  const state = begin()
  const quotes: QuoteInput[] = [
    { id: "q-stale", supplier: "Stale Mill", currency: "USD", qty: 2, unitPrice: 10000, total: 10000 },
    { id: "q-mid", supplier: "Mid Mill", currency: "USD", qty: 1, unitPrice: 15000, total: 15000 },
    { id: "q-high", supplier: "High Mill", currency: "USD", qty: 1, unitPrice: 18000, total: 18000 },
  ]
  const number = reachSourcing(state, "Select stale", "OPEX", 10000)
  must(state, "Requests", "save", sourcingFields(quotes), number)
  quoteRecord(storedRequest(state, number), "q-stale").total = 10000
  must(state, "Requests", "select_quote", { quoteId: "q-stale" }, number)
  const request = storedRequest(state, number)
  expect(quoteRecord(request, "q-stale").scores).toEqual(technicalScores)
  expect(quoteRecord(request, "q-stale").cscores).toEqual(commercialScores)
  expect(quoteRecord(request, "q-stale").total).toBe(20000)
  expect(quoteRecord(request, "q-mid").total).toBe(15000)
  expect(quoteRecord(request, "q-high").total).toBe(18000)
  expect(poAccount(request)).toMatchObject({
    currency: "USD",
    fxRate: null,
    approval: null,
    supplier: "Stale Mill",
    sourceQuoteId: "q-stale",
  })
  expect(poAccount(request).lines).toEqual([{ qty: 2, unitPrice: 10000 }])
  expect(request.status).toBe("sourcing")
  const section = sourcingSection(requestsPage(state), number)
  expect(visibleQuoteTotal(section, "Stale Mill")).toBe(20000)
  expect(visibleQuoteTotal(section, "Mid Mill")).toBe(15000)
})

test("selecting a non-binary euro quote keeps the rounded total in quote currency", () => {
  const state = begin()
  const odd = Math.round(0.1 * 3 * 100) / 100
  expect(0.1 * 3).not.toBe(odd)
  const quotes: QuoteInput[] = [
    { id: "q-euro", supplier: "Euro Mill", currency: "EUR", qty: 3, unitPrice: 0.1, total: 9 },
    { id: "q-half", supplier: "Half Mill", currency: "USD", qty: 2.5, unitPrice: 10.25, total: 9 },
    { id: "q-exact", supplier: "Exact Mill", currency: "USD", qty: 4, unitPrice: 2.5, total: 10 },
  ]
  const number = reachSourcing(state, "Select euro", "OPEX", 10)
  must(state, "Requests", "save", sourcingFields(quotes), number)
  quoteRecord(storedRequest(state, number), "q-euro").total = 9
  must(state, "Requests", "select_quote", { quoteId: "q-euro" }, number)
  const request = storedRequest(state, number)
  expect(quoteRecord(request, "q-euro").total).toBe(odd)
  expect(quoteRecord(request, "q-euro").total).not.toBe(odd * 1.08)
  expect(quoteRecord(request, "q-half").total).toBe(25.63)
  expect(quoteRecord(request, "q-exact").total).toBe(10)
  expect(poAccount(request)).toMatchObject({
    currency: "EUR",
    fxRate: null,
    approval: null,
    supplier: "Euro Mill",
    sourceQuoteId: "q-euro",
  })
  expect(poAccount(request).lines).toEqual([{ qty: 3, unitPrice: 0.1 }])
  const section = sourcingSection(requestsPage(state), number)
  expect(visibleQuoteTotal(section, "Euro Mill")).toBe(odd)
  expect(visibleQuoteTotal(section, "Euro Mill")).not.toBe(odd * 1.08)
  expect(visibleQuoteTotal(section, "Exact Mill")).toBe(10)
})

test("sourcing approval and stored ranking use the normalized quote-currency total", () => {
  const state = begin()
  const quotes: QuoteInput[] = [
    { id: "q-stale", supplier: "Stale Mill", currency: "USD", qty: 2, unitPrice: 10000, total: 10000 },
    { id: "q-mid", supplier: "Mid Mill", currency: "USD", qty: 1, unitPrice: 15000, total: 15000 },
    { id: "q-high", supplier: "High Mill", currency: "USD", qty: 1, unitPrice: 18000, total: 18000 },
  ]
  const number = reachSourcing(state, "Rank stale", "OPEX", 10000)
  must(state, "Requests", "save", sourcingFields(quotes), number)
  must(state, "Requests", "select_quote", { quoteId: "q-stale" }, number)
  must(
    state,
    "Requests",
    "submit_sourcing",
    { "sourcing.selectionJustification": "The normalized total is accepted for delivery reasons." },
    number,
  )
  const screen = sourcingScreen(state, number)
  const stored = storedQuotes(screen.request, quotes.map((quote) => quote.id))
  expect(stored.map((quote) => quote.total)).toEqual([20000, 15000, 18000])
  const expected = ranksFor([
    { id: "q-stale", base: 20000 },
    { id: "q-mid", base: 15000 },
    { id: "q-high", base: 18000 },
  ])
  expect(expected.find((row) => row.id === "q-stale")?.rank).not.toBe(1)
  expect(sourcingAmount(screen.request)).toBe(20000)
  expect(storedRanking(state, number)).toEqual(expected)
  expect(viewRanking(screen.request)).toEqual(expected)
  expect(rankingOf(screen.settings, stored)).toEqual(expected)
  expect(quoteRecord(screen.request, "q-stale").scores).toEqual(technicalScores)
  expect(quoteRecord(screen.request, "q-stale").cscores).toEqual(commercialScores)
})
