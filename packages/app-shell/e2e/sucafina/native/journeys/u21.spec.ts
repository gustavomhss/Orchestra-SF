/**
 * N26 / U21 installed-only BI05–BI08 and UI45. No mocked producer or synthetic
 * server result. All expected marks are derived from the real admitted response.
 * Only CI120 may execute, and the F04 private manifest is mandatory.
 */
import { expect } from "@playwright/test"
import type { Page, Response, TestInfo } from "@playwright/test"
import { nativeInstalledFixture as test } from "../fixture"
import type { InstalledNativeHarness } from "../fixture"

test.use({ trace: "off", video: "off" })
test.describe.configure({ retries: 0 })

type Data = {
  request: { viewId: string; selectionRef: string; period: { start: string; end: string } }
  projection: { values: { id: string; value: string | number | null; evidenceState: string; period: { start: string; end: string } }[] }
  presentation: { viewId: string; series: { role: string; valueIds: string[] }[];
    timeline?: { items: { dateValueId: string; label: string; state: string }[] } }
}
const modeIs = (viewId: string, mode: string) => (response: Response) => {
  const address = new URL(response.url())
  return response.request().method() === "GET" &&
    address.searchParams.get("sf") === mode &&
    address.searchParams.get("viewId") === viewId
}

async function catalogReady(page: Page, nativeHarness: InstalledNativeHarness) {
  const owner = nativeHarness.manifest.target
  const start = new URL(owner.chapterHref, owner.shellOrigin)
  await page.goto(start.toString())
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  const destination = new URL("/orchestra/sf-bi", owner.shellOrigin)
  destination.search = start.search
  await page.goto(destination.toString())
  const catalog = page.locator('[data-sf-catalog="UI45"]')
  await expect(catalog).toBeVisible()
  await expect(catalog.locator('[data-sf-field="view"]')).toBeVisible()
  return catalog
}

async function readOperational(page: Page, nativeHarness: InstalledNativeHarness, viewId: "BI05" | "BI06" | "BI07" | "BI08") {
  const catalog = await catalogReady(page, nativeHarness)
  await catalog.locator('[data-sf-field="view"]').selectOption(viewId)
  await catalog.locator('[data-sf-field="start"]').fill("2027-01-01")
  await catalog.locator('[data-sf-field="end"]').fill("2027-12-31")
  const optionsPending = page.waitForResponse(modeIs(viewId, "bi-options"))
  await catalog.locator('button[type="submit"]').click()
  const optionsResponse = await optionsPending
  expect(optionsResponse.ok()).toBe(true)
  const options = await optionsResponse.json()
  expect(options.status).toBe("ok")
  expect(Array.isArray(options.value.choices)).toBe(true)
  const choices = options.value.choices as { selectionRef: string }[]
  if (choices.length) await catalog.locator('[data-sf-field="selection"]').selectOption(choices[0]!.selectionRef)
  const dataPending = page.waitForResponse(modeIs(viewId, "bi-data"))
  await catalog.locator('[data-sf-action="view-data"]').click()
  const dataResponse = await dataPending
  expect(dataResponse.ok()).toBe(true)
  const data: Data = await dataResponse.json()
  expect(data.request.viewId).toBe(viewId)
  expect(data.presentation.viewId).toBe(viewId)
  const figure = catalog.locator('[data-sf-bi-view="' + viewId + '"]')
  await expect(figure).toBeVisible()
  return { catalog, figure, data }
}

test("U21 UI45 requires complete input and never issues an invalid period request", async ({ page, nativeHarness }, info: TestInfo) => {
  const catalog = await catalogReady(page, nativeHarness)
  const submit = catalog.locator('button[type="submit"]')
  await expect(submit).toBeDisabled()
  await catalog.locator('[data-sf-field="view"]').selectOption("BI05")
  await catalog.locator('[data-sf-field="start"]').fill("2027-12-31")
  await catalog.locator('[data-sf-field="end"]').fill("2027-01-01")
  await expect(submit).toBeDisabled()
  await catalog.locator('[data-sf-field="end"]').fill("2027-12-31")
  await expect(submit).toBeEnabled()
  await info.attach("u21-ui45-real-ready.png", { body: await page.screenshot(), contentType: "image/png" })
  for (const width of [320, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(catalog.locator('[data-sf-field="view"]')).toBeVisible()
    expect(await catalog.evaluate((el) => el.scrollWidth > el.clientWidth + 2)).toBe(false)
    await info.attach("u21-ui45-" + width + "px.png", { body: await page.screenshot(), contentType: "image/png" })
  }
})

test("U21 BI05 current stock and BI06 observed aging preserve exactly the admitted values", async ({ page, nativeHarness }, info: TestInfo) => {
  for (const viewId of ["BI05", "BI06"] as const) {
    const { figure, data } = await readOperational(page, nativeHarness, viewId)
    const ids = new Set(data.presentation.series.flatMap((series) => series.valueIds))
    const admitted = data.projection.values.filter((value) => ids.has(value.id))
    expect(admitted).toHaveLength(ids.size)
    const marks = await figure.locator("[data-sf-value-id]").evaluateAll((nodes) =>
      nodes.map((node) => ({
        id: node.getAttribute("data-sf-value-id"),
        kind: node.getAttribute("data-sf-value-kind"),
      })))
    expect(marks).toHaveLength(ids.size)
    for (const value of admitted) {
      const mark = marks.find((candidate) => candidate.id === value.id)
      expect(mark).toBeDefined()
      expect(mark!.kind).toBe(typeof value.value === "number" && value.evidenceState !== "absent" ? "known" : "missing")
      // Unknown age is still in the authorized universe, never treated as zero.
      if (viewId === "BI06" && (value.value === null || value.evidenceState === "absent")) expect(mark!.kind).toBe("missing")
      if (value.value === 0 && value.evidenceState === "confirmed") expect(mark!.kind).toBe("known")
    }
    await expect(page.locator(".sf-chart-table tbody tr")).toHaveCount(ids.size)
    await info.attach("u21-" + viewId + "-admitted.png", { body: await page.screenshot(), contentType: "image/png" })
  }
})

test("U21 BI07 displays no invented ticket history; BI08 uses only source milestone dates", async ({ page, nativeHarness }, info: TestInfo) => {
  const tickets = await readOperational(page, nativeHarness, "BI07")
  const ticketIds = new Set(tickets.data.presentation.series.flatMap((series) => series.valueIds))
  await expect(tickets.figure.locator("[data-sf-value-id]")).toHaveCount(ticketIds.size)
  // A single current-period value cannot be expanded to twelve fabricated months.
  expect(ticketIds.size).toBeLessThanOrEqual(tickets.data.projection.values.length)
  await info.attach("u21-bi07-exact-source.png", { body: await page.screenshot(), contentType: "image/png" })

  const milestones = await readOperational(page, nativeHarness, "BI08")
  const plan = milestones.data.presentation.timeline
  expect(plan, "BI08 must expose observed milestone metadata from the installed producer").toBeDefined()
  const values = new Map(milestones.data.projection.values.map((value) => [value.id, value]))
  await expect(milestones.figure.locator("[data-sf-milestone]")).toHaveCount(plan!.items.length)
  for (const item of plan!.items) {
    const original = values.get(item.dateValueId)
    expect(original, "the milestone must resolve to a real source value").toBeDefined()
    const displayed = await milestones.figure.locator("[data-sf-milestone]").evaluateAll((nodes, expected) =>
      nodes.find((node) => node.getAttribute("data-sf-milestone") === expected)?.textContent ?? "", item.dateValueId)
    if (typeof original?.value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(original.value) && original.evidenceState !== "absent")
      expect(displayed).toContain(original.value)
    else
      expect(displayed).not.toMatch(/\b202[4-7]-\d{2}-\d{2}\b/)
  }
  await info.attach("u21-bi08-real-milestones.png", { body: await page.screenshot(), contentType: "image/png" })
})
