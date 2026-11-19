import { test } from "bun:test"
import { chromium, expect } from "@playwright/test"
import path from "node:path"
import { resolveWaterfall } from "../../../product/analytics/waterfall.ts"
import type { BiSelection } from "../../../product/analytics/catalog.ts"
import { captureChromiumCleanup } from "../wp07/chromium-cleanup.ts"
import { compositionTestDeadline } from "../wp10/integration/composition-test-deadline.ts"
import { ok, waterfallFixture } from "./fixture.ts"

// This consumes createSfBiServices through its real authenticated dispatcher.
// Only the view transport is about:blank; the module, plan and financial data are
// the actual installed renderer and domain output. No server or financial mock.
test("installed BI09 renders persisted components, equivalent table and exact origins with keyboard access", async () => {
  const deadline = compositionTestDeadline("bi09-installed-browser")
  try {
    const fixture = await waterfallFixture(deadline)
    const output = ok(await deadline.phase("BI09.dispatch", () => fixture.dispatch()), "Installed browser presentation")
    const plan = output.presentation.waterfall
    if (!plan) throw new Error("Installed BI09 returned no waterfall")
    const resolved = resolveWaterfall(output.projection, plan)
    if (resolved.status !== "ok") throw new Error(`Supplied waterfall: ${resolved.reason}`)
    const built = await deadline.phase("browser.bundle", () => Bun.build({
      entrypoints: [path.resolve(import.meta.dir, "../../../product/analytics/view.ts")], target: "browser", format: "esm",
    }))
    if (!built.success || !built.outputs[0]) throw new Error("Actual BI renderer bundle failed")
    const moduleUrl = `data:text/javascript;base64,${Buffer.from(await built.outputs[0].text()).toString("base64")}`
    const browser = await deadline.phase("browser.launch", async () => {
      const value = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] })
      let close: (() => Promise<void>) | undefined
      deadline.own(() => close ? close() : value.close())
      close = await captureChromiumCleanup(value)
      return value
    })
    const page = await browser.newPage({ viewport: { width: 1024, height: 900 } })
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto("about:blank")
    await deadline.phase("browser.render", () => page.evaluate(async ({ moduleUrl, output }) => {
      const renderer = await import(moduleUrl)
      const open = (selection: BiSelection) => { document.body.dataset.selection = JSON.stringify(selection) }
      const rendered = renderer.renderBiView(output.request, output.projection, open, output.presentation)
      rendered.id = "installed-bi09"
      document.body.replaceChildren(rendered)
    }, { moduleUrl, output }))
    const view = page.locator("#installed-bi09")
    const chart = view.getByRole("group", { name: "Waterfall de componentes; valores e fontes estão na tabela equivalente" })
    await expect(chart.locator("[data-bi-value]")).toHaveCount(plan.segments.length + 2)
    await expect(chart.locator('[data-bi-value="difference:baseline"]')).toHaveAttribute("aria-label", /Subtotal conhecido inicial/)
    await expect(chart.locator('[data-bi-value="difference:candidate-total"]')).toHaveAttribute("aria-label", /Subtotal conhecido final/)
    await expect(view).toContainText("Reconciliação: reconciled")
    await expect(view).toContainText("custos pendentes permanecem na tabela")
    await expect(view).toContainText(fixture.candidate.resultRef)
    await expect(view).toContainText(fixture.baseline.resultRef)
    await expect(view).toContainText(fixture.comparisonRef)
    const table = view.getByRole("table", { name: "Composição e origens", exact: true })
    const rows = table.locator("tbody tr")
    await expect(rows).toHaveCount(plan.segments.length + 2)
    await expect(rows.first()).toContainText(String(resolved.initial))
    await expect(rows.last()).toContainText(String(resolved.final))
    for (const [index, segment] of resolved.segments.entries()) {
      const row = rows.nth(index + 1)
      await expect(row.locator("td").nth(0)).toHaveText(segment.label)
      await expect(row.locator("td").nth(1)).toHaveText(String(segment.start ?? "indisponível"))
      await expect(row.locator("td").nth(2)).toHaveText(segment.amount === null ? "indisponível" : segment.amount > 0 ? `+${segment.amount}` : String(segment.amount))
      await expect(row.locator("td").nth(3)).toHaveText(String(segment.end ?? "indisponível"))
      const mark = chart.locator(`[data-bi-value="${segment.componentValueId}"]`)
      const description = `${segment.label}: ${segment.amount !== null && segment.amount > 0 ? `+${segment.amount}` : String(segment.amount)} USD`
      await expect(mark.locator("title")).toHaveText(description)
      await expect(mark).toHaveAttribute("aria-label", `${description}; ${segment.source.drilldown || segment.source.sourceRefs.length === 1 ? "abrir origem" : "escolher origem"}`)
    }
    const decision = output.projection.decision
    if (decision?.kind !== "scenario") throw new Error("Actual scenario decision unavailable")
    await expect(view.getByRole("table", { name: "Componentes fornecidos pelo domínio", exact: true }).locator("tbody tr")).toHaveCount(decision.scenario.components.length)
    const values = view.getByRole("table", { name: "Dados e referências", exact: true })
    await expect(values.getByRole("row").filter({ hasText: "scenario:candidate-complete-total" })).toContainText("Indisponível")
    await expect(values.getByRole("row").filter({ hasText: "scenario:complete-difference" })).toContainText("Indisponível")
    await expect(view.getByRole("list", { name: "Cobertura de custos e condições" })).toContainText("pendente")
    const zero = resolved.segments.find((segment) => segment.amount === 0)
    if (!zero) throw new Error("Producer omitted the explicit zero contribution")
    await expect(chart.locator(`[data-bi-value="${zero.componentValueId}"] circle`)).toHaveCount(1)
    const selected = resolved.segments.find((segment) => segment.source.sourceRefs.length > 1)
    if (!selected) throw new Error("Actual comparison lost its two explicit origins")
    const mark = chart.locator(`[data-bi-value="${selected.componentValueId}"]`)
    await mark.focus()
    await page.keyboard.press("Enter")
    const chooser = view.locator("[data-bi-source-chooser]:visible")
    await expect(chooser).toHaveCount(1)
    expect(await page.locator("body").getAttribute("data-selection")).toBeNull()
    await page.keyboard.press("Escape")
    await expect(mark).toBeFocused()
    await mark.press("Enter")
    const firstReference = selected.source.sourceRefs[0]!
    const origin = chooser.locator(`[data-bi-origin="${firstReference.refDigest}"]`)
    await origin.focus()
    await page.keyboard.press("Enter")
    const opened = JSON.parse(await page.locator("body").getAttribute("data-selection") ?? "null") as BiSelection
    expect(opened).toMatchObject({ valueId: selected.componentValueId, selectionRef: fixture.selectionRef,
      projectionVersion: output.projection.version, engineVersion: output.projection.engineVersion,
      context: { currency: "USD", period: fixture.period }, reference: firstReference })
    const tableOrigin = rows.nth(resolved.segments.indexOf(selected) + 1).locator(`[data-bi-origin="${firstReference.refDigest}"]`)
    await tableOrigin.click()
    expect(JSON.parse(await page.locator("body").getAttribute("data-selection") ?? "null")).toEqual(opened)
    await page.setViewportSize({ width: 320, height: 800 })
    await expect(chart).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(errors).toEqual([])
  } finally { await deadline.close() }
}, 120_000)

test("installed BI09 renderer keeps unavailable endpoints and table rows without drawing null as zero", async () => {
  const deadline = compositionTestDeadline("bi09-missing-browser")
  try {
    const fixture = await waterfallFixture(deadline, { missing: true })
    const output = ok(await deadline.phase("BI09.dispatch", () => fixture.dispatch()), "Missing-cost browser presentation")
    const plan = output.presentation.waterfall
    if (!plan) throw new Error("Installed BI09 returned no missing-cost plan")
    const resolved = resolveWaterfall(output.projection, plan)
    if (resolved.status !== "ok") throw new Error(`Missing-cost waterfall: ${resolved.reason}`)
    const built = await deadline.phase("browser.bundle", () => Bun.build({
      entrypoints: [path.resolve(import.meta.dir, "../../../product/analytics/view.ts")], target: "browser", format: "esm",
    }))
    if (!built.success || !built.outputs[0]) throw new Error("Actual BI renderer bundle failed")
    const moduleUrl = `data:text/javascript;base64,${Buffer.from(await built.outputs[0].text()).toString("base64")}`
    const browser = await deadline.phase("browser.launch", async () => {
      const value = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] })
      let close: (() => Promise<void>) | undefined
      deadline.own(() => close ? close() : value.close())
      close = await captureChromiumCleanup(value)
      return value
    })
    const page = await browser.newPage()
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto("about:blank")
    await page.evaluate(async ({ moduleUrl, output }) => {
      const renderer = await import(moduleUrl)
      document.body.replaceChildren(renderer.renderBiView(output.request, output.projection, () => undefined, output.presentation))
    }, { moduleUrl, output })
    await expect(page.getByRole("table", { name: "Composição e origens", exact: true }).locator("tbody tr")).toHaveCount(plan.segments.length + 2)
    await expect(page.locator("body")).toContainText("Reconciliação: unavailable")
    await expect(page.getByRole("table", { name: "Composição e origens", exact: true })).toContainText("indisponível")
    await expect(page.locator('svg [data-bi-value="difference:baseline"]')).toHaveCount(0)
    await expect(page.locator('svg [data-bi-value="difference:candidate-total"]')).toHaveCount(0)
    for (const segment of resolved.segments.filter((segment) => segment.amount === null)) {
      await expect(page.locator(`svg [data-bi-value="${segment.componentValueId}"]`)).toHaveCount(0)
    }
    const missing = output.projection.components.find((component) => component.amount === null)
    if (!missing) throw new Error("Canonical missing component disappeared")
    await expect(page.getByRole("table", { name: "Componentes fornecidos pelo domínio", exact: true }).getByRole("row").filter({ hasText: missing.id })).toContainText("Indisponível")
    expect(errors).toEqual([])
  } finally { await deadline.close() }
}, 120_000)
