import { expect, test } from "bun:test"
import { chromium, expect as expectBrowser } from "@playwright/test"
import path from "node:path"
import { resolveBiPresentation } from "../../../product/analytics/semantics.ts"
import type { BiPresentation, DomainProjection, ProjectionValue } from "../../../product/contracts/context.ts"

const jan = { start: "2027-01-01", end: "2027-01-31" }
const feb = { start: "2027-02-01", end: "2027-02-28" }
const horizon = { start: jan.start, end: feb.end }

function point(id: string, amount: number | null, input: {
  unit?: string
  currency?: string
  period?: { start: string; end: string }
} = {}): ProjectionValue {
  return {
    id,
    value: amount,
    ...(input.unit !== undefined ? { unit: input.unit } : {}),
    ...(input.currency !== undefined ? { currency: input.currency } : {}),
    period: input.period ?? jan,
    granularity: "month",
    sourceRefs: [],
    drilldown: null,
    evidenceState: amount === null ? "absent" : "confirmed",
  }
}

function projection(values: readonly ProjectionValue[]): DomainProjection {
  return {
    context: {
      installationId: "unit-integrity215",
      projectId: "unit-integrity215",
      principalRef: "authorized-projection-fixture",
      policyVersion: "unchanged",
      accessRevision: "unchanged",
      surface: "planner",
      currency: "USD",
      period: horizon,
      sourceRefs: [],
      capabilities: [],
    },
    version: 7,
    engineVersion: "unchanged-producer-fixture",
    components: [],
    missing: [],
    values,
  }
}

function presentation(viewId: BiPresentation["viewId"], series: BiPresentation["series"]): BiPresentation {
  return { viewId, series, limitations: ["Producer-supplied values; no FX or capacity conversion."] }
}

test("USD currency-only series retains confirmed zero and absent null without inventing a unit or FX", () => {
  const data = projection([
    point("cost-zero", 0, { currency: "USD" }),
    point("cost-absent", null, { currency: "USD", period: feb }),
    point("unassigned-eur", 9, { unit: "money", currency: "EUR" }),
  ])
  const result = resolveBiPresentation(data, presentation("BI01", [
    { id: "cost", label: "Cost", unit: "USD", role: "budget", valueIds: ["cost-zero", "cost-absent"] },
  ]))
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.series[0]?.values).toEqual(data.values.slice(0, 2))
  expect(result.series[0]?.values.map((value) => value.value)).toEqual([0, null])
  expect(result.unassigned).toEqual([data.values[2]])
  expect(data.values[0]?.unit).toBeUndefined()
})

test("FTE unit-only series remains valid without optional currency", () => {
  const data = projection([point("fte-zero", 0, { unit: "fte" }), point("fte-missing", null, { unit: "fte", period: feb })])
  const result = resolveBiPresentation(data, presentation("BI04", [
    { id: "capacity", label: "Capacidade", unit: "fte", role: "fte", valueIds: ["fte-zero", "fte-missing"], alignmentKeys: ["jan", "feb"] },
  ]))
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect<readonly ProjectionValue[] | undefined>(result.series[0]?.values).toEqual(data.values)
})

test("an explicit dimension with optional currency is not rejected merely because its currency differs from its unit", () => {
  const data = projection([point("cost", 20, { unit: "money", currency: "USD" }), point("capacity", 2, { unit: "fte", currency: "USD" })])
  const result = resolveBiPresentation(data, presentation("BI04", [
    { id: "money", label: "Money", unit: "money", role: "cost", valueIds: ["cost"] },
    { id: "fte", label: "Capacity", unit: "fte", role: "fte", valueIds: ["capacity"] },
  ]))
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.series.map((entry) => entry.values.map((value) => value.id))).toEqual([["cost"], ["capacity"]])
})

test("REV208-NEW-001 rejects hours+USD in a USD currency series rather than allowing currency equality to mask units", () => {
  const data = projection([point("worked-hours", 8, { unit: "hours", currency: "USD" })])
  expect(resolveBiPresentation(data, presentation("BI01", [
    { id: "cost", label: "Cost", unit: "USD", role: "actual", valueIds: ["worked-hours"] },
  ]))).toEqual({ status: "unavailable", reason: "incompatible-unit" })
})

test("explicit units cannot be relabelled by another physical dimension even with identical currency", () => {
  const data = projection([point("hours", 8, { unit: "hours", currency: "USD" }), point("fte", 2, { unit: "fte", currency: "USD" })])
  for (const [axis, id] of [["fte", "hours"], ["hours", "fte"], ["USD", "fte"]] as const) {
    expect(resolveBiPresentation(data, presentation("BI04", [
      { id: "capacity", label: "Capacity", unit: axis, role: "fte", valueIds: [id] },
    ]))).toEqual({ status: "unavailable", reason: "incompatible-unit" })
  }
})

test("unit-less currency still cannot be relabelled as a different currency", () => {
  const data = projection([point("eur", 9, { currency: "EUR" })])
  expect(resolveBiPresentation(data, presentation("BI01", [
    { id: "cost", label: "Cost", unit: "USD", role: "budget", valueIds: ["eur"] },
  ]))).toEqual({ status: "unavailable", reason: "incompatible-unit" })
})

test("heterogeneous producer currencies are rejected even if every explicit unit matches", () => {
  const data = projection([
    point("usd", 10, { unit: "money", currency: "USD" }),
    point("eur", 20, { unit: "money", currency: "EUR", period: feb }),
  ])
  expect(resolveBiPresentation(data, presentation("BI01", [
    { id: "budget", label: "Budget", unit: "money", role: "budget", valueIds: ["usd", "eur"] },
  ]))).toEqual({ status: "unavailable", reason: "incompatible-currency" })
})

test("a priced numeric series refuses a second numeric row whose currency was omitted", () => {
  const data = projection([
    point("priced", 10, { unit: "money", currency: "USD" }),
    point("unknown-currency", 4, { unit: "money", period: feb }),
  ])
  expect(resolveBiPresentation(data, presentation("BI01", [
    { id: "actual", label: "Actual", unit: "money", role: "actual", valueIds: ["priced", "unknown-currency"] },
  ]))).toEqual({ status: "unavailable", reason: "currency-missing" })
})

test("no unspecified dimensions are invented; an explicitly empty unit cannot borrow a currency", () => {
  const unspecified = projection([point("unknown", null)])
  const result = resolveBiPresentation(unspecified, presentation("BI05", [
    { id: "count", label: "Count", unit: "tickets", role: "stock", valueIds: ["unknown"] },
  ]))
  expect(result.status).toBe("ok")
  const contradictory = projection([point("empty-unit", 1, { unit: "", currency: "USD" })])
  expect(resolveBiPresentation(contradictory, presentation("BI01", [
    { id: "budget", label: "Budget", unit: "USD", role: "budget", valueIds: ["empty-unit"] },
  ]))).toEqual({ status: "unavailable", reason: "incompatible-unit" })
})

test("renderer keeps true FTE/USD scales separate while retaining a conflicting hours row, zero and null in its table", async () => {
  const build = await Bun.build({
    entrypoints: [path.resolve(import.meta.dir, "../../../product/analytics/view.ts")],
    target: "browser",
    format: "esm",
  })
  expect(build.success).toBe(true)
  if (!build.outputs[0]) throw new Error("Actual BI renderer entrypoint missing")
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(await build.outputs[0].text()).toString("base64")}`
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] })
  try {
    const page = await browser.newPage()
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto("about:blank")
    // BI03 has no BI04 FTE/cost alignment gate: a bad chart here specifically
    // demonstrates the unit/currency defect rather than an unrelated block.
    const negative = {
      request: { viewId: "BI03" as const, selectionRef: "same-authorized-selection", period: horizon },
      projection: projection([
        point("hours-in-cost", 8, { unit: "hours", currency: "USD" }),
        point("cost-zero", 0, { currency: "USD", period: feb }),
        point("cost-missing", null, { currency: "USD", period: feb }),
      ]),
      presentation: presentation("BI03", [
        { id: "cost", label: "Orçamento de pessoas", unit: "USD", role: "cost", valueIds: ["hours-in-cost", "cost-zero", "cost-missing"] },
      ]),
    }
    const positive = {
      request: { viewId: "BI04" as const, selectionRef: "same-authorized-selection", period: horizon },
      projection: projection([
        point("fte-zero", 0, { unit: "fte" }),
        point("fte-two", 2, { unit: "fte", period: feb }),
        point("cost-high", 900000, { currency: "USD" }),
        point("cost-missing", null, { currency: "USD", period: feb }),
      ]),
      presentation: presentation("BI04", [
        { id: "fte", label: "Capacidade planejada", unit: "fte", role: "fte", valueIds: ["fte-zero", "fte-two"], alignmentKeys: [jan.start, feb.start] },
        { id: "cost", label: "Orçamento de pessoas", unit: "USD", role: "cost", valueIds: ["cost-high", "cost-missing"], alignmentKeys: [jan.start, feb.start] },
      ]),
    }
    await page.evaluate(async ({ url, negative, positive }) => {
      const { renderBiView } = await import(url)
      const negativeView = renderBiView(negative.request, negative.projection, () => {}, negative.presentation)
      negativeView.id = "unit-215-invalid"
      const positiveView = renderBiView(positive.request, positive.projection, () => {}, positive.presentation)
      positiveView.id = "unit-215-valid"
      document.body.append(negativeView, positiveView)
    }, { url: moduleUrl, negative, positive })

    const invalid = page.locator("#unit-215-invalid")
    const invalidTable = invalid.getByRole("table", { name: "Dados e referências" })
    await expectBrowser(invalid.getByRole("status")).toContainText("Gráfico indisponível")
    await expectBrowser(invalid.locator("svg")).toHaveCount(0)
    await expectBrowser(invalidTable.getByRole("row").filter({ hasText: "hours-in-cost" }).getByRole("cell").nth(1)).toHaveText("8")
    await expectBrowser(invalidTable.getByRole("row").filter({ hasText: "hours-in-cost" }).getByRole("cell").nth(2)).toHaveText("hours")
    await expectBrowser(invalidTable.getByRole("row").filter({ hasText: "cost-zero" }).getByRole("cell").nth(1)).toHaveText("0")
    await expectBrowser(invalidTable.getByRole("row").filter({ hasText: "cost-missing" }).getByRole("cell").nth(1)).toHaveText("Indisponível")

    const valid = page.locator("#unit-215-valid")
    const validTable = valid.getByRole("table", { name: "Dados e referências" })
    await expectBrowser(valid.locator('svg[role="group"]')).toHaveCount(2)
    await expectBrowser(valid.locator('svg[role="group"][aria-label*="fte"]')).toHaveCount(1)
    await expectBrowser(valid.locator('svg[role="group"][aria-label*="USD"]')).toHaveCount(1)
    await expectBrowser(valid.getByText("Medida: Capacidade planejada · fte")).toHaveCount(1)
    await expectBrowser(valid.getByText("Medida: Orçamento de pessoas · USD")).toHaveCount(1)
    await expectBrowser(valid.locator('svg[role="group"][aria-label*="fte"] circle')).toHaveCount(2)
    await expectBrowser(valid.locator('svg[role="group"][aria-label*="USD"] circle')).toHaveCount(1)
    await expectBrowser(validTable.getByRole("row").filter({ hasText: "fte-zero" }).getByRole("cell").nth(1)).toHaveText("0")
    await expectBrowser(validTable.getByRole("row").filter({ hasText: "cost-high" }).getByRole("cell").nth(1)).toHaveText("900000")
    await expectBrowser(validTable.getByRole("row").filter({ hasText: "cost-high" }).getByRole("cell").nth(2)).toHaveText("USD")
    await expectBrowser(validTable.getByRole("row").filter({ hasText: "cost-missing" }).getByRole("cell").nth(1)).toHaveText("Indisponível")
    await expectBrowser(valid.getByText(/Escala: .* fte;/)).toHaveCount(1)
    await expectBrowser(valid.getByText(/Escala: .* USD;/)).toHaveCount(1)
    expect(errors).toEqual([])
  } finally {
    await browser.close()
  }
}, 90_000)
