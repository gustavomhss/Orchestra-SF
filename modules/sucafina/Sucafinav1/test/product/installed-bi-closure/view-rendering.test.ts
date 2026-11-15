import { test } from "bun:test"
import { chromium, expect, type Page } from "@playwright/test"
import path from "node:path"
import type { BiSelection } from "../../../product/analytics/catalog.ts"
import type { BiPresentation, DomainProjection, Period } from "../../../product/contracts/context.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { BiViewRequest } from "../../../product/contracts/operations.ts"
import type { BiFocusTarget } from "../../../product/analytics/view.ts"
import { captureChromiumCleanup } from "../wp07/chromium-cleanup.ts"
import { compositionTestDeadline } from "../wp10/integration/composition-test-deadline.ts"

// Renderer contract only: literal, synthetic C02-shaped input, never an installed
// result, authority receipt, persisted financial result, native proof or G7 pass.
// The actual view.ts bundle renders in Chromium. No network, producer, financial
// calculation or installed host is mocked, executed or claimed by this fixture.
const horizon: Period = { start: "2027-01-01", end: "2027-12-31" }
const november: Period = { start: "2027-11-01", end: "2027-11-30" }
const originA = "a".repeat(64), originB = "b".repeat(64)
type Payload = { request: BiViewRequest; projection: DomainProjection; presentation: BiPresentation }
type BrowserState = { payload: Payload; changes: Period[]; opened: BiSelection[] }
declare global {
  interface Window { syntheticBiRenderer: BrowserState }
}

function syntheticPayload(): Payload {
  const reference = (id: string, refDigest: string): BusinessEvidenceRef => ({
    schema: "sf-evidence-v1", refId: `synthetic-renderer:${id}`, installationId: "synthetic-renderer-only",
    projectId: "synthetic-c02-contract", refDigest, evidenceLevel: "observed", kind: "record",
    target: { surface: "planner", recordType: "planner-version", recordId: id, incarnation: `synthetic-${id}`,
      version: 1, fields: ["date"], period: { ...horizon }, projectionDigest: "c".repeat(64) },
  })
  const first = reference("origin-a", originA), second = reference("origin-b", originB)
  return {
    request: { viewId: "BI10", selectionRef: "synthetic-renderer-contract-only", period: { ...horizon } },
    projection: {
      context: { installationId: "synthetic-renderer-only", projectId: "synthetic-c02-contract", principalRef: "synthetic-no-authority",
        accessRevision: "synthetic-revision", policyVersion: "synthetic-policy", surface: "planner", period: { ...horizon },
        currency: "USD", sourceRefs: [], capabilities: [] },
      version: 1, engineVersion: "synthetic-renderer-payload-no-engine", components: [], missing: [],
      decision: { kind: "portfolio", portfolioResultRef: "synthetic-unpersisted-envelope", portfolio: {
        combinations: [], evidenceRefs: [], limitations: ["Synthetic renderer contract; no installed portfolio or authority proof."] } },
      values: [
        { id: "synthetic:outside-date", value: "2027-01-15", unit: "date", period: { ...horizon }, granularity: "record", sourceRefs: [first], drilldown: first, evidenceState: "confirmed" },
        { id: "synthetic:inside-date", value: "2027-11-15", unit: "date", period: { ...horizon }, granularity: "record", sourceRefs: [first], drilldown: first, evidenceState: "confirmed" },
        { id: "synthetic:unknown-date", value: null, unit: "date", period: { ...horizon }, granularity: "record", sourceRefs: [first], drilldown: first, evidenceState: "absent" },
        { id: "synthetic:whole-period-value", value: 200, currency: "USD", period: { ...horizon }, granularity: "year", sourceRefs: [first, second], drilldown: null, evidenceState: "confirmed" },
        { id: "synthetic:explicit-zero", value: 0, currency: "USD", period: { ...horizon }, granularity: "year", sourceRefs: [first], drilldown: first, evidenceState: "confirmed" },
      ],
    },
    presentation: { viewId: "BI10", series: [], limitations: ["Synthetic C02 renderer payload; amounts are literal supplied values."], timeline: { items: [
      { label: "Synthetic January milestone", dateValueId: "synthetic:outside-date", state: "planned" },
      { label: "Synthetic November milestone", dateValueId: "synthetic:inside-date", state: "planned" },
      { label: "Synthetic unknown date", dateValueId: "synthetic:unknown-date", state: "unknown" },
    ] } },
  }
}

async function rendererPage(deadline: ReturnType<typeof compositionTestDeadline>) {
  const built = await deadline.phase("renderer.bundle", () => Bun.build({
    entrypoints: [path.resolve(import.meta.dir, "../../../product/analytics/view.ts")], target: "browser", format: "esm",
  }))
  if (!built.success || !built.outputs[0]) throw new Error("Actual BI view renderer bundle failed")
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(await built.outputs[0].text()).toString("base64")}`
  const browser = await deadline.phase("renderer.chromium", async () => {
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
  return { page, moduleUrl, errors }
}

async function render(page: Page, moduleUrl: string, payload: Payload, period?: Period) {
  await page.evaluate(async ({ moduleUrl, payload, period }) => {
    const renderer = await import(moduleUrl) as typeof import("../../../product/analytics/view.ts")
    // Catch attempted mutation of any supplied context, value, origin or plan.
    const freeze = (value: unknown): void => {
      if (!value || typeof value !== "object") return
      for (const child of Object.values(value)) freeze(child)
      Object.freeze(value)
    }
    freeze(payload)
    const state: BrowserState = { payload, changes: [], opened: [] }
    ;window.syntheticBiRenderer = state
    const node = renderer.renderBiView(payload.request, payload.projection, (selection) => state.opened.push(selection), payload.presentation,
      undefined, undefined, { period, onPeriodChange: (next) => state.changes.push(next) })
    node.id = "synthetic-bi-renderer"
    document.body.replaceChildren(node)
  }, { moduleUrl, payload, period })
}

function dataRow(page: Page, id: string) {
  return page.getByRole("table", { name: "Dados e referências", exact: true }).getByRole("row").filter({ has: page.getByRole("cell", { name: id, exact: true }) })
}

async function focus(page: Page, moduleUrl: string, target: BiFocusTarget | string) {
  return page.evaluate(async ({ moduleUrl, target }) => {
    const renderer = await import(moduleUrl) as typeof import("../../../product/analytics/view.ts")
    const root = document.getElementById("synthetic-bi-renderer")
    if (!root) throw new Error("Synthetic renderer root missing")
    return renderer.restoreBiFocus(root, target)
  }, { moduleUrl, target })
}

test("C02 renderer BI10 crops observed dates, retains unknown dates and never prorates supplied amounts", async () => {
  const deadline = compositionTestDeadline("bi62-contract-renderer-dates", 105_000)
  try {
    const { page, moduleUrl, errors } = await rendererPage(deadline)
    const payload = syntheticPayload()
    await deadline.phase("renderer.date-crop", async () => {
      await render(page, moduleUrl, payload)
      const dated = page.getByRole("list", { name: "Marcos com data", exact: true })
      await expect(dated.getByRole("listitem")).toHaveCount(2)
      await page.getByLabel("Início do período", { exact: true }).fill(november.start)
      await page.getByLabel("Fim do período", { exact: true }).fill(november.end)
      await page.getByRole("button", { name: "Aplicar filtro", exact: true }).click()
      await expect(dated.getByRole("listitem")).toHaveCount(1)
      await expect(dated).toContainText("Synthetic November milestone")
      await expect(dataRow(page, "synthetic:outside-date")).toHaveCount(0)
      await expect(dataRow(page, "synthetic:inside-date")).toHaveCount(1)
      await expect(page.getByRole("list", { name: "Marcos sem data", exact: true })).toContainText("Synthetic unknown date: unknown; data indisponível")
      await expect(dataRow(page, "synthetic:unknown-date").locator("td").nth(1)).toHaveText("Indisponível")
      await expect(page.getByRole("group", { name: "Marcos no horizonte; a lista informa estado, data e origem", exact: true }).locator("circle")).toHaveCount(1)
      await expect(dataRow(page, "synthetic:whole-period-value").locator("td").nth(1)).toHaveText("200")
      await expect(dataRow(page, "synthetic:explicit-zero").locator("td").nth(1)).toHaveText("0")
      await expect(page.getByRole("status")).toContainText("permanecem integrais na tabela, sem repartição estimada")
      expect(await page.evaluate(() => window.syntheticBiRenderer.changes)).toEqual([horizon, november])
      expect(await page.evaluate(() => window.syntheticBiRenderer.payload)).toEqual(payload)
    })
    expect(errors).toEqual([])
  } finally { await deadline.close() }
}, 120_000)

test("C02 renderer restores only a valid visual crop and reports its changes without changing the authorized horizon", async () => {
  const deadline = compositionTestDeadline("bi62-contract-renderer-visual-period", 105_000)
  try {
    const { page, moduleUrl, errors } = await rendererPage(deadline)
    const payload = syntheticPayload()
    await deadline.phase("renderer.visual-state", async () => {
      await render(page, moduleUrl, payload, november)
      await expect(page.getByLabel("Início do período", { exact: true })).toHaveValue(november.start)
      await expect(page.getByLabel("Fim do período", { exact: true })).toHaveValue(november.end)
      await expect(page.getByLabel("Arrastar início do período", { exact: true })).toHaveAttribute("aria-valuetext", november.start)
      expect(await page.evaluate(() => window.syntheticBiRenderer.changes)).toEqual([november])
      await dataRow(page, "synthetic:inside-date").getByRole("button", { name: "Abrir origem", exact: true }).click()
      const state = await page.evaluate(() => window.syntheticBiRenderer)
      expect(state.opened).toHaveLength(1)
      expect(state.opened[0]).toMatchObject({ valueId: "synthetic:inside-date", visualPeriod: november, context: { period: horizon } })
      expect(state.payload).toEqual(payload)
      // An invalid apply leaves both the currently drawn data and callback unchanged.
      await page.getByLabel("Início do período", { exact: true }).fill("2028-01-01")
      await page.getByRole("button", { name: "Aplicar filtro", exact: true }).click()
      await expect(page.getByRole("status")).toContainText("Escolha um período válido dentro da seleção autorizada")
      expect(await page.evaluate(() => window.syntheticBiRenderer.changes)).toEqual([november])
      await expect(dataRow(page, "synthetic:inside-date")).toHaveCount(1)
      for (const invalid of [
        { start: "2026-12-31", end: "2027-11-30" },
        { start: "2027-11-30", end: "2027-11-01" },
        { start: "2027-02-30", end: "2027-03-01" },
      ]) {
        await render(page, moduleUrl, payload, invalid)
        await expect(page.getByLabel("Início do período", { exact: true })).toHaveValue(horizon.start)
        await expect(page.getByLabel("Fim do período", { exact: true })).toHaveValue(horizon.end)
        expect(await page.evaluate(() => window.syntheticBiRenderer.changes)).toEqual([horizon])
      }
      expect(await page.evaluate(() => window.syntheticBiRenderer.payload)).toEqual(payload)
    })
    expect(errors).toEqual([])
  } finally { await deadline.close() }
}, 120_000)

test("C02 renderer restores the exact origin before the first value control and falls back only to visible controls", async () => {
  const deadline = compositionTestDeadline("bi62-contract-renderer-focus", 105_000)
  try {
    const { page, moduleUrl, errors } = await rendererPage(deadline)
    await deadline.phase("renderer.exact-origin-focus", async () => {
      await render(page, moduleUrl, syntheticPayload())
      const valueId = "synthetic:whole-period-value"
      const row = dataRow(page, valueId)
      const first = row.locator(`[data-bi-origin="${originA}"]`), second = row.locator(`[data-bi-origin="${originB}"]`)
      await expect(first).toBeVisible()
      await expect(second).toBeVisible()
      expect(await focus(page, moduleUrl, { valueId, originDigest: originB })).toBe(true)
      await expect(second).toBeFocused()
      await page.keyboard.press("Enter")
      const opened = await page.evaluate(() => window.syntheticBiRenderer.opened)
      expect(opened).toHaveLength(1)
      expect(opened[0]?.reference?.refDigest).toBe(originB)
      // A fresh render can omit an origin; a retained selector cannot invent it.
      await second.evaluate((element) => element.remove())
      expect(await focus(page, moduleUrl, { valueId, originDigest: originB })).toBe(true)
      await expect(first).toBeFocused()
      await first.evaluate((element) => { element.setAttribute("hidden", "") })
      expect(await focus(page, moduleUrl, { valueId, originDigest: originB })).toBe(true)
      await expect(page.getByRole("button", { name: "Aplicar filtro", exact: true })).toBeFocused()
      expect(await focus(page, moduleUrl, "synthetic:missing-value")).toBe(true)
      await expect(page.getByRole("button", { name: "Aplicar filtro", exact: true })).toBeFocused()
      await page.locator("#synthetic-bi-renderer").evaluate((element) => { element.setAttribute("hidden", "") })
      expect(await focus(page, moduleUrl, valueId)).toBe(false)
    })
    expect(errors).toEqual([])
  } finally { await deadline.close() }
}, 120_000)
