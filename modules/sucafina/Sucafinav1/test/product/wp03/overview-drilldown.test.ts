import { expect, test } from "bun:test"
import { rows } from "../../../runtime/contract.ts"
import type { SourceRef } from "../../../product/contracts/context.ts"
import { createPlannerOverviewHost } from "../../../product/planner/overview-host.ts"
import { plannerOverview, renderPlannerOverview } from "../../../product/planner/overview.ts"
import { plannerFixture, plannerPeriod, plannerSnapshot } from "./planner-fixture.ts"

test("Overview opens each canonical total into the correct record, monthly measure and version", async () => {
  const fixture = await plannerFixture()
  try {
    for (const vector of [
      { candidate: "v1", outlook: 602000, difference: 12000, variance: 2000, november: 124000, novemberVariance: 64000 },
      { candidate: "v2", outlook: 596000, difference: 6000, variance: -4000, november: 118000, novemberVariance: 58000 },
    ]) {
      const selected = await readOverview(fixture, vector.candidate)
      expect(selected.model.metrics).toEqual({ baselineOutlook: 590000, candidateOutlook: vector.outlook, deltaToBase: vector.difference, candidateBudget: 600000, varianceToCandidateBudget: vector.variance, officialBudget: 600000, varianceToOfficialBudget: vector.variance })
      const baseline = selected.model.baselineRefs[0]!
      const candidate = selected.model.candidateRefs[0]!
      const official = selected.model.officialRefs[0]!
      const expected = [
        { id: "baselineOutlook", label: "Baseline outlook", total: 590000, after: 112000, afterRef: baseline },
        { id: "candidateOutlook", label: "Candidate outlook", total: vector.outlook, after: vector.november, afterRef: candidate },
        { id: "deltaToBase", label: "Change from baseline", total: vector.difference, before: 112000, beforeRef: baseline, after: vector.november, afterRef: candidate, difference: vector.difference },
        { id: "candidateBudget", label: "Candidate budget", total: 600000, after: 60000, afterRef: candidate },
        { id: "varianceToCandidateBudget", label: "Variance to candidate budget", total: vector.variance, before: 60000, beforeRef: candidate, after: vector.november, afterRef: candidate, difference: vector.novemberVariance },
        { id: "officialBudget", label: "Official budget", total: 600000, after: 60000, afterRef: official },
        { id: "varianceToOfficialBudget", label: "Variance to official budget", total: vector.variance, before: 60000, beforeRef: official, after: vector.november, afterRef: candidate, difference: vector.novemberVariance },
      ]
      expect(elements(selected.tree).filter((node) => node.attributes["data-overview-metric"] !== undefined).map((node) => node.attributes["data-overview-metric"]).sort()).toEqual(expected.map((metric) => metric.id).sort())
      for (const item of expected) {
        const metric = disclosure(find(selected.tree, "data-overview-metric", item.id))
        expect(textOf(metric.children[0]!)).toContain(item.label)
        expectAmount(metric.children[0]!, item.total)
        expect(find(metric, "data-overview-composition", "reconciled").tag).toBe("p")
        expect(textOf(metric)).toContain(plannerPeriod.start)
        expect(textOf(metric)).toContain(plannerPeriod.end)
        const record = disclosure(find(metric, "data-overview-record", "line"))
        expectAmount(record.children[0]!, item.total)
        const months = elements(record).filter((node) => node.attributes["data-overview-component"] !== undefined)
        expect(months.map((node) => node.attributes["data-overview-component"])).toEqual(Array.from({ length: 12 }, (_, index) => `line:${index + 1}`))
        const november = find(record, "data-overview-component", "line:11")
        expect(november.tag).toBe("tr")
        expect(textOf(november)).toContain("2027-11-01")
        expect(textOf(november)).toContain("2027-11-30")
        expectCell(november, "after", item.after)
        expectSource(find(november, "data-overview-value", "after"), item.afterRef)
        if (item.before !== undefined && item.beforeRef && item.difference !== undefined) {
          expectCell(november, "before", item.before)
          expectCell(november, "difference", item.difference)
          expectSource(find(november, "data-overview-value", "before"), item.beforeRef)
          expect(november.attributes["data-overview-state"]).toBe("matched")
        }
      }
      expect(selected.model.coverageState).toBe("conditioned")
      expect(selected.model.gaps).toContain("cost-coverage-unavailable")
    }
    expect((await fixture.readSnapshot()).data).toEqual(plannerSnapshot().data)
  } finally { await fixture.close() }
})

test("Overview drills into the separately selected official budget and only the requested months", async () => {
  const snapshot = plannerSnapshot()
  rows(rows(snapshot.data.versions)[2]!.lines)[0]!.b = Array(12).fill(55000)
  snapshot.data.officials = { "2027": "v2" }
  const fixture = await plannerFixture(snapshot)
  try {
    const period = { start: "2027-10-01", end: "2027-12-31" }
    const selected = await readOverview(fixture, "v1", period)
    expect(selected.model.metrics).toEqual({ baselineOutlook: 190000, candidateOutlook: 202000, deltaToBase: 12000, candidateBudget: 170000, varianceToCandidateBudget: 32000, officialBudget: 165000, varianceToOfficialBudget: 37000 })
    expect(selected.model.officialRefs.map((ref) => ref.id)).toEqual(["v2"])
    const official = disclosure(find(selected.tree, "data-overview-metric", "officialBudget"))
    expectAmount(official.children[0]!, 165000)
    const record = disclosure(find(official, "data-overview-record", "line"))
    expect(elements(record).filter((node) => node.attributes["data-overview-component"] !== undefined).map((node) => node.attributes["data-overview-component"])).toEqual(["line:10", "line:11", "line:12"])
    expectCell(find(record, "data-overview-component", "line:11"), "after", 55000)
    expectSource(find(find(record, "data-overview-component", "line:11"), "data-overview-value", "after"), selected.model.officialRefs[0]!)
    const difference = find(find(selected.tree, "data-overview-metric", "varianceToOfficialBudget"), "data-overview-component", "line:11")
    expectCell(difference, "before", 55000)
    expectCell(difference, "after", 124000)
    expectCell(difference, "difference", 69000)
    expectSource(find(difference, "data-overview-value", "before"), selected.model.officialRefs[0]!)
    expectSource(find(difference, "data-overview-value", "after"), selected.model.candidateRefs[0]!)
    expect((await fixture.readSnapshot()).data).toEqual(snapshot.data)
  } finally { await fixture.close() }
})

test("Overview leaves an unselected official unavailable instead of reusing candidate records", async () => {
  const snapshot = plannerSnapshot()
  snapshot.data.officials = {}
  const fixture = await plannerFixture(snapshot)
  try {
    const selected = await readOverview(fixture)
    expect(selected.model.metrics).toMatchObject({ candidateBudget: 600000, officialBudget: null, varianceToOfficialBudget: null })
    for (const id of ["officialBudget", "varianceToOfficialBudget"]) {
      const metric = disclosure(find(selected.tree, "data-overview-metric", id))
      expect(textOf(metric.children[0]!)).toContain("Unavailable")
      expect(elements(metric).filter((node) => node.attributes["data-overview-record"] !== undefined)).toEqual([])
      expect(find(metric, "data-overview-composition", "unavailable").tag).toBe("p")
    }
    expectCell(find(find(selected.tree, "data-overview-metric", "candidateBudget"), "data-overview-component", "line:11"), "after", 60000)
  } finally { await fixture.close() }
})

test("Overview keeps known budget, missing outlook, numeric zero and structural additions or removals distinct", async () => {
  const snapshot = plannerSnapshot()
  const line = (id: string, budget: number, actual: number | null) => ({ id, sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(budget), a: [actual], f: [] })
  const baseline = rows(snapshot.data.versions)[0]!
  baseline.closed = 1
  baseline.lines = [line("zero", 0, 0), line("missing", 100, null), line("removed", 30, 0)]
  const candidate = structuredClone(baseline)
  candidate.id = "v1"
  candidate.lines = [line("zero", 0, 0), line("missing", 100, null), line("added", 40, 0)]
  snapshot.data.versions = [baseline, candidate]
  const fixture = await plannerFixture(snapshot)
  try {
    const selected = await readOverview(fixture)
    expect(selected.model.metrics).toMatchObject({ baselineOutlook: null, candidateOutlook: null, deltaToBase: null, candidateBudget: 1680, officialBudget: 1560 })
    const budget = disclosure(find(selected.tree, "data-overview-metric", "candidateBudget"))
    expectAmount(budget.children[0]!, 1680)
    expectCell(find(budget, "data-overview-component", "missing:1"), "after", 100)
    expect(find(budget, "data-overview-composition", "reconciled").tag).toBe("p")
    const outlook = disclosure(find(selected.tree, "data-overview-metric", "candidateOutlook"))
    expect(textOf(outlook.children[0]!)).toContain("Unavailable")
    expectCell(find(outlook, "data-overview-component", "zero:1"), "after", 0)
    expectCell(find(outlook, "data-overview-component", "missing:1"), "after", "Unavailable")
    expect(find(find(find(outlook, "data-overview-component", "zero:1"), "data-overview-value", "after"), "data-overview-evidence", "confirmed").tag).toBe("span")
    expect(find(find(find(outlook, "data-overview-component", "missing:1"), "data-overview-value", "after"), "data-overview-evidence", "absent").tag).toBe("span")
    const delta = disclosure(find(selected.tree, "data-overview-metric", "deltaToBase"))
    expect(textOf(delta.children[0]!)).toContain("Unavailable")
    expect(find(delta, "data-overview-composition", "unavailable").tag).toBe("p")
    const missing = find(delta, "data-overview-component", "missing:1")
    expect(missing.attributes["data-overview-state"]).toBe("matched")
    expectCell(missing, "before", "Unavailable")
    expectCell(missing, "after", "Unavailable")
    expectCell(missing, "difference", "Unavailable")
    expect(textOf(missing)).not.toContain("Not present")
    const zero = find(delta, "data-overview-component", "zero:1")
    expect(zero.attributes["data-overview-state"]).toBe("matched")
    expectCell(zero, "before", 0)
    expectCell(zero, "after", 0)
    expectCell(zero, "difference", 0)
    const added = find(delta, "data-overview-component", "added:1")
    expect(added.attributes["data-overview-state"]).toBe("added")
    expectCell(added, "before", "Not present")
    expectCell(added, "after", 0)
    expectCell(added, "difference", 0)
    const removed = find(delta, "data-overview-component", "removed:1")
    expect(removed.attributes["data-overview-state"]).toBe("removed")
    expectCell(removed, "before", 0)
    expectCell(removed, "after", "Not present")
    expectCell(removed, "difference", 0)
    expect(elements(delta).filter((node) => node.attributes["data-overview-record"] !== undefined).map((node) => node.attributes["data-overview-record"]).sort()).toEqual(["added", "missing", "removed", "zero"])
    expect(textOf(disclosure(find(delta, "data-overview-record", "missing")).children[0]!)).toContain("Unavailable")
    expectAmount(disclosure(find(delta, "data-overview-record", "zero")).children[0]!, 0)
    expect((await fixture.readSnapshot()).data).toEqual(snapshot.data)
  } finally { await fixture.close() }
})

test("Overview distinguishes original EUR inputs from converted USD measures and missing conversion", async () => {
  for (const rate of [1.5, null]) {
    const snapshot = plannerSnapshot()
    const baseline = rows(snapshot.data.versions)[0]!
    baseline.closed = 0
    baseline.lines = [{ id: "euro-license", sec: "opex", el: "licenses", cur: "EUR", b: Array(12).fill(1000), a: [], f: [] }]
    baseline.fx = [{ id: "eur", cur: "EUR", rate: 1 }]
    const candidate = structuredClone(baseline)
    candidate.id = "v1"
    candidate.fx = rate === null ? [] : [{ id: "eur", cur: "EUR", rate }]
    snapshot.data.versions = [baseline, candidate]
    const fixture = await plannerFixture(snapshot)
    try {
      const selected = await readOverview(fixture)
      expect(selected.model.metrics).toMatchObject({ baselineOutlook: 12000, candidateOutlook: rate === null ? null : 18000, candidateBudget: rate === null ? null : 18000, deltaToBase: rate === null ? null : 6000 })
      const budget = find(selected.tree, "data-overview-metric", "candidateBudget")
      const january = find(budget, "data-overview-component", "euro-license:1")
      expectCell(january, "after", rate === null ? "Unavailable" : 1500)
      const after = find(january, "data-overview-value", "after")
      expectAmount(after, 1000, "EUR")
      expect(textOf(after)).not.toContain("1500 EUR")
      expectSource(after, selected.model.candidateRefs[0]!)
      const delta = find(find(selected.tree, "data-overview-metric", "deltaToBase"), "data-overview-component", "euro-license:1")
      expectCell(delta, "before", 1000)
      expectCell(delta, "after", rate === null ? "Unavailable" : 1500)
      expectCell(delta, "difference", rate === null ? "Unavailable" : 500)
      expectAmount(find(delta, "data-overview-value", "before"), 1000, "EUR")
      expect((await fixture.readSnapshot()).data).toEqual(snapshot.data)
    } finally { await fixture.close() }
  }
})

test("Overview preserves opaque record identities and escapes HTML without cross-selecting records", async () => {
  const snapshot = plannerSnapshot()
  const malicious = 'line"][data-overview-record="line"]><img src=x onerror="alert(1)">&literal'
  const ids = ["line", malicious, "HR:IT", "month:11"]
  const baseline = rows(snapshot.data.versions)[0]!
  baseline.closed = 0
  baseline.lines = ids.map((id, index) => ({ id, sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill([10, 100, 1000, 7][index]), a: [], f: [] }))
  const candidate = structuredClone(baseline)
  candidate.id = "v1"
  rows(candidate.lines).forEach((line, index) => { line.b = Array(12).fill([20, 200, 1000, 9][index]) })
  snapshot.data.versions = [baseline, candidate]
  const fixture = await plannerFixture(snapshot)
  try {
    const selected = await readOverview(fixture)
    expect(selected.model.metrics).toMatchObject({ baselineOutlook: 13404, candidateOutlook: 14748, deltaToBase: 1344, candidateBudget: 14748 })
    expect(selected.html).toContain("&lt;img")
    expect(selected.html).toContain("&quot;")
    expect(selected.html).toContain("&amp;literal")
    expect(elements(selected.tree).filter((node) => ["img", "script", "iframe"].includes(node.tag))).toEqual([])
    expect(elements(selected.tree).flatMap((node) => Object.keys(node.attributes).filter((attribute) => /^on/i.test(attribute)))).toEqual([])
    const budget = disclosure(find(selected.tree, "data-overview-metric", "candidateBudget"))
    const records = elements(budget).filter((node) => node.attributes["data-overview-record"] !== undefined)
    expect(records.map((node) => node.attributes["data-overview-record"]).sort()).toEqual([...ids].sort())
    for (const [index, id] of ids.entries()) {
      const record = disclosure(find(budget, "data-overview-record", id))
      expect(textOf(record.children[0]!)).toContain(id)
      expectAmount(record.children[0]!, [240, 2400, 12000, 108][index]!)
      expect(elements(record).filter((node) => node.attributes["data-overview-component"] !== undefined).map((node) => node.attributes["data-overview-component"])).toEqual(Array.from({ length: 12 }, (_, month) => `${id}:${month + 1}`))
      expectCell(find(record, "data-overview-component", `${id}:11`), "after", [20, 200, 1000, 9][index]!)
    }
    expect(elements(selected.tree).filter((node) => node.attributes["data-overview-metric"] !== undefined)).toHaveLength(7)
    expect((await fixture.readSnapshot()).data).toEqual(snapshot.data)
  } finally { await fixture.close() }
})

test("Overview retains published totals but exposes incomplete or divergent detail composition", async () => {
  const fixture = await plannerFixture()
  try {
    const context = await fixture.admit("sf-human:planner.read", {}, "finance", true)
    const refs = await Promise.all(["v0", "v1"].map((id) => fixture.issueSource(id, context)))
    if (refs[0]!.status !== "ok" || refs[1]!.status !== "ok") throw new Error("Overview fixture source unavailable")
    const compared = await fixture.planner.compareForecast({ baseRef: refs[0]!.value.evidence.refId, candidateRef: refs[1]!.value.evidence.refId, period: plannerPeriod, currency: "USD" }, context)
    if (compared.status !== "ok") throw new Error("Overview fixture comparison unavailable")
    const target = compared.value.candidate.values.find((value) => value.id === "line:11:budget-usd")!
    expect(target.value).toBe(60000)
    for (const problem of ["missing", "duplicate", "period", "source", "currency", "amount"] as const) {
      const altered = problem === "period" ? { ...target, period: { start: "2027-10-01", end: "2027-10-31" } }
        : problem === "source" ? { ...target, sourceRefs: [] }
        : problem === "currency" ? { ...target, currency: "EUR" }
        : problem === "amount" ? { ...target, value: 60001 }
        : target
      const values = compared.value.candidate.values.flatMap((value) => value.id !== target.id ? [value] : problem === "missing" ? [] : problem === "duplicate" ? [value, value] : [altered])
      const model = plannerOverview({ ...compared.value, candidate: { ...compared.value.candidate, values } })
      if (model.status !== "ok") throw new Error(`Overview rejected the retained total for ${problem}`)
      expect(model.value.metrics).toMatchObject({ candidateBudget: 600000, candidateOutlook: 602000 })
      const tree = await parseHtml(renderPlannerOverview(model.value))
      const budget = disclosure(find(tree, "data-overview-metric", "candidateBudget"))
      expectAmount(budget.children[0]!, 600000)
      expect(find(budget, "data-overview-composition", problem === "amount" ? "unreconciled" : "incomplete").tag).toBe("p")
      const record = disclosure(find(budget, "data-overview-record", "line"))
      if (problem === "amount") expectAmount(record.children[0]!, 600001)
      if (problem !== "amount") expect(textOf(record.children[0]!)).toContain("Unavailable")
      expectCell(find(record, "data-overview-component", "line:11"), "after", problem === "amount" ? 60001 : "Unavailable")
      expectCell(find(record, "data-overview-component", "line:1"), "after", 40000)
      expectCell(find(find(tree, "data-overview-metric", "candidateOutlook"), "data-overview-component", "line:11"), "after", 124000)
    }
    expect(compared.value.candidate.values.find((value) => value.id === target.id)).toEqual(target)
    expect(target.value).toBe(60000)
  } finally { await fixture.close() }
})

type ParsedElement = { tag: string; attributes: Record<string, string>; text: string; children: ParsedElement[] }

// Bun's native HTML tokenizer supplies nesting and attributes. No browser or product script is executed.
async function parseHtml(html: string) {
  const root: ParsedElement = { tag: "document", attributes: {}, text: "", children: [] }
  const stack = [root]
  const parser = new HTMLRewriter().on("*", { element(element) {
    stack.forEach((parent) => { parent.text += " " })
    const node: ParsedElement = { tag: element.tagName, attributes: Object.fromEntries([...element.attributes].map(([name, value]) => [name, decodeEntities(value)])), text: "", children: [] }
    stack.at(-1)!.children.push(node)
    if (!element.canHaveContent) return
    stack.push(node)
    element.onEndTag(() => {
      if (stack.at(-1) !== node) throw new Error("Unexpected closing order in Overview HTML")
      stack.pop()
      stack.forEach((parent) => { parent.text += " " })
    })
  } }).onDocument({ text(chunk) { stack.forEach((node) => { node.text += chunk.text }) } })
  await parser.transform(new Response(html)).text()
  expect(stack).toHaveLength(1)
  return root
}

function decodeEntities(value: string) {
  const entities: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&#39;": "'", "&#039;": "'", "&#x27;": "'" }
  return value.replace(/&(amp|lt|gt|quot|apos|#0?39|#x27);/gi, (entity) => entities[entity.toLowerCase()] ?? entity)
}

function textOf(node: ParsedElement) { return decodeEntities(node.text).replace(/\s+/g, " ").trim() }

function elements(root: ParsedElement): ParsedElement[] { return root.children.flatMap((node) => [node, ...elements(node)]) }

function find(root: ParsedElement, attribute: string, value: string) {
  const matching = elements(root).filter((node) => node.attributes[attribute] === value)
  expect(matching.map((node) => node.tag)).toHaveLength(1)
  return matching[0]!
}

function disclosure(node: ParsedElement) {
  expect(node.tag).toBe("details")
  expect(node.attributes.hidden).toBeUndefined()
  expect(node.children[0]?.tag).toBe("summary")
  expect(node.children.filter((child) => child.tag === "summary")).toHaveLength(1)
  expect(textOf(node.children[0]!)).not.toBe("")
  return node
}

function expectAmount(node: ParsedElement, amount: number, currency = "USD") {
  const words = textOf(node).split(" ")
  expect(words.some((word, index) => word === String(amount) && words[index + 1] === currency)).toBe(true)
}

function expectCell(row: ParsedElement, side: string, amount: number | "Unavailable" | "Not present") {
  const cell = find(row, "data-overview-value", side)
  expect(cell.tag).toBe("td")
  const value = textOf(cell)
  if (typeof amount === "number") expect(value.startsWith(`${amount} USD `) || value === `${amount} USD`).toBe(true)
  if (amount === "Unavailable") expect(value.startsWith("Unavailable")).toBe(true)
  if (amount === "Not present") expect(value).toBe("Not present")
}

function expectSource(node: ParsedElement, source: SourceRef) {
  expect(textOf(node)).toContain(source.id)
  expect(textOf(node)).toContain(`revision ${source.version}`)
  expect(textOf(node)).toContain(source.period.start)
  expect(textOf(node)).toContain(source.period.end)
}

async function readOverview(fixture: Awaited<ReturnType<typeof plannerFixture>>, candidateVersionId = "v1", period = plannerPeriod) {
  const context = await fixture.admit("sf-human:planner.read", {}, "finance", true)
  const read = createPlannerOverviewHost({ host: fixture.host, planner: fixture.planner, issueSource: fixture.issueSource, versions: fixture.versions })
  const result = await read({ baseVersionId: "v0", candidateVersionId, period }, context)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error("Overview fixture unavailable")
  const html = renderPlannerOverview(result.value)
  return { model: result.value, html, tree: await parseHtml(html) }
}
