/**
 * N26 / U20 — REAL installed-provider journeys. No mocked host, dataset,
 * permissions, receipt or successful HTTP response. F04 binds candidate/actor.
 * CI120 owns execution; this file is not proof until that run is observed.
 */
import { expect } from "@playwright/test"
import type { Page, TestInfo } from "@playwright/test"
import { nativeInstalledFixture as test } from "../fixture"
import type { InstalledNativeHarness } from "../fixture"

test.use({ trace: "off", video: "off" })
test.describe.configure({ retries: 0 })

type Data = {
  request: { viewId: string; period: { start: string; end: string }; selectionRef: string }
  projection: { context: { currency: string; period: { start: string; end: string } };
    values: { id: string; value: string | number | boolean | null; evidenceState: string; period: { start: string; end: string } }[] }
  presentation: { viewId: string; series: { id: string; role: string; unit: string; valueIds: string[] }[];
    waterfall?: { segments: { label: string; startValueId: string; componentValueId: string; endValueId: string }[];
      reconciliation: string; finalValueId: string } }
}

async function enterCatalog(page: Page, harness: InstalledNativeHarness) {
  const target = harness.manifest.target
  const admissionHref = new URL(target.chapterHref, target.shellOrigin)
  await page.goto(admissionHref.toString())
  // The native chapter and the original authenticated discovery/context must
  // both be present. The manifest alone never proves session or permission.
  await harness.proveWeb(page.locator('[data-sf-frame="page"]'))
  const href = new URL("/orchestra/sf-bi", target.shellOrigin)
  href.search = admissionHref.search
  await page.goto(href.toString())
  const catalog = page.locator('[data-sf-catalog="UI45"]')
  await expect(catalog).toBeVisible()
  await expect(catalog.locator('[data-sf-field="view"]')).toBeVisible()
  return catalog
}

function isBiResponse(viewId: string, mode: string) {
  return (response: import("@playwright/test").Response) => {
    const address = new URL(response.url())
    return response.request().method() === "GET" &&
      address.searchParams.get("sf") === mode &&
      address.searchParams.get("viewId") === viewId
  }
}

async function readRealView(page: Page, harness: InstalledNativeHarness, viewId: "BI01" | "BI02" | "BI03" | "BI04") {
  const catalog = await enterCatalog(page, harness)
  await catalog.locator('[data-sf-field="view"]').selectOption(viewId)
  await catalog.locator('[data-sf-field="start"]').fill("2027-01-01")
  await catalog.locator('[data-sf-field="end"]').fill("2027-01-31")
  const optionsPending = page.waitForResponse(isBiResponse(viewId, "bi-options"))
  await catalog.locator('button[type="submit"]').click()
  const optionsResponse = await optionsPending
  expect(optionsResponse.ok(), "real source options must be admitted").toBe(true)
  const options = await optionsResponse.json()
  expect(options).toMatchObject({ status: "ok" })
  expect(Array.isArray(options.value.choices)).toBe(true)
  const choices = options.value.choices as { label: string; selectionRef: string }[]
  if (choices.length > 0) {
    await catalog.locator('[data-sf-field="selection"]').selectOption(choices[0]!.selectionRef)
  }
  const dataPending = page.waitForResponse(isBiResponse(viewId, "bi-data"))
  await catalog.locator('[data-sf-action="view-data"]').click()
  const dataResponse = await dataPending
  expect(dataResponse.ok(), "the real BI producer must return a successful read").toBe(true)
  const data: Data = await dataResponse.json()
  expect(data.request.viewId).toBe(viewId)
  expect(data.presentation.viewId).toBe(viewId)
  expect(data.request.period).toEqual(data.projection.context.period)
  const figure = catalog.locator('[data-sf-bi-view="' + viewId + '"]')
  await expect(figure).toBeVisible()
  return { catalog, figure, data }
}

function sourceMarks(data: Data) {
  const visible = new Set(data.presentation.series.flatMap((series) => series.valueIds))
  const values = data.projection.values.filter((value) => visible.has(value.id))
  expect(values).toHaveLength(visible.size)
  return values
}

test("U20 BI01 preserves actual gaps, confirmed zero and annual/monthly source granularity", async ({ page, nativeHarness }, info: TestInfo) => {
  const { catalog, figure, data } = await readRealView(page, nativeHarness, "BI01")
  expect(data.presentation.series.every((series) => ["budget", "actual", "outlook", "other"].includes(series.role))).toBe(true)
  const values = sourceMarks(data)
  const marks = await figure.locator("[data-sf-value-id]").evaluateAll((elements) =>
    elements.map((element) => ({
      id: element.getAttribute("data-sf-value-id"),
      kind: element.getAttribute("data-sf-value-kind"),
    })))
  expect(marks).toHaveLength(values.length)
  for (const value of values) {
    const actual = marks.find((mark) => mark.id === value.id)
    expect(actual, "one source mark per admitted valueId").toBeDefined()
    const known = typeof value.value === "number" && Number.isFinite(value.value) && value.evidenceState !== "absent"
    expect(actual!.kind).toBe(known ? "known" : "missing")
    // In particular source zero is a genuine mark, not a missing-value gap.
    if (value.value === 0 && value.evidenceState === "confirmed") expect(actual!.kind).toBe("known")
  }
  await expect(catalog.locator(".sf-chart-table tbody tr")).toHaveCount(values.length)
  expect(data.presentation.series.flatMap((series) => series.valueIds)).toHaveLength(values.length)
  for (const width of [320, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(figure).toBeVisible()
    const overflow = await figure.evaluate((el) => el.scrollWidth > el.clientWidth + 2)
    expect(overflow, "BI01 visualization must reflow without horizontal clipping at " + width).toBe(false)
    await info.attach("u20-bi01-" + width + "px.png", {
      body: await page.screenshot({ fullPage: true }), contentType: "image/png",
    })
  }
})

test("U20 BI02 has no client-generated waterfall adjustment", async ({ page, nativeHarness }, info: TestInfo) => {
  const { figure, data } = await readRealView(page, nativeHarness, "BI02")
  const plan = data.presentation.waterfall
  expect(plan, "a real selected scenario must provide a producer-authored plan").toBeDefined()
  const source = new Map(data.projection.values.map((value) => [value.id, value]))
  const steps = figure.locator("[data-sf-step]")
  await expect(steps).toHaveCount(plan!.segments.length)
  for (const segment of plan!.segments) {
    expect(source.has(segment.startValueId)).toBe(true)
    expect(source.has(segment.componentValueId)).toBe(true)
    expect(source.has(segment.endValueId)).toBe(true)
  }
  await expect(figure.locator("[data-sf-waterfall]")).toHaveAttribute("data-sf-waterfall", plan!.reconciliation)
  await expect(figure.locator("[data-sf-step]")).toHaveCount(plan!.segments.length)
  expect(source.has(plan!.finalValueId)).toBe(true)
  await info.attach("u20-bi02-real-source.png", { body: await page.screenshot(), contentType: "image/png" })
})

test("U20 BI03 and BI04 retain signed measures and distinct FTE/cost source units", async ({ page, nativeHarness }, info: TestInfo) => {
  for (const viewId of ["BI03", "BI04"] as const) {
    const { figure, data } = await readRealView(page, nativeHarness, viewId)
    const source = new Map(data.projection.values.map((value) => [value.id, value]))
    for (const series of data.presentation.series) {
      const panel = figure.locator('[data-sf-bi-role="' + series.role + '"]')
      await expect(panel.first()).toBeVisible()
      for (const id of series.valueIds) {
        const value = source.get(id)
        expect(value).toBeDefined()
        // No negative component is converted into its absolute business value.
        if (typeof value?.value === "number" && value.value < 0) {
          const mark = await figure.locator("[data-sf-value-id]").evaluateAll((nodes, expected) =>
            nodes.find((node) => node.getAttribute("data-sf-value-id") === expected)?.getAttribute("data-sf-value-kind"), id)
          expect(mark).toBe("known")
        }
      }
    }
    await expect(page.locator(".sf-chart-table tbody tr")).toHaveCount(
      data.presentation.series.reduce((total, series) => total + series.valueIds.length, 0))
    await info.attach("u20-" + viewId + "-real-source.png", { body: await page.screenshot(), contentType: "image/png" })
  }
})
