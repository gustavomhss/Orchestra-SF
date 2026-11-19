import { expect, test } from "@playwright/test"
import { asRecord } from "../decisions-support/journey"
import { startPlannerInstallation } from "../wp03/installation-fixture"
import { horizon, prepareInstalledBi, records, type InstalledBiCorpus } from "./installed-fixture"
import { biReply, dataRow, expectValue, responseFor, showScenario } from "./browser"

// Native BI acceptance probes preserve the human display crop and the exact
// producer-issued source choices across reload and keyboard navigation.
test.use({ trace: "off", video: "off" })
test.describe.configure({ retries: 0 })

let installation: Awaited<ReturnType<typeof startPlannerInstallation>> | undefined
let corpus: InstalledBiCorpus

test.beforeAll(async ({ browser }, info) => {
  test.setTimeout(180_000)
  const host = await startPlannerInstallation(info)
  installation = host
  const context = await browser.newContext()
  const observations: Record<string, unknown>[] = []
  try {
    const page = await context.newPage()
    await host.signIn(page)
    corpus = await prepareInstalledBi(page, host, observations)
  } catch (error) {
    await host.stop()
    installation = undefined
    throw error
  } finally {
    await info.attach("bi62-regression-canonical-setup.json", { body: JSON.stringify({
      snapshot: process.env.GITHUB_SHA ?? null, observations,
      boundary: "Synthetic Planner source inputs saved through real UI; real enrollment, factory, domain persistence and HTTP. No generated results or authority are seeded.",
    }, null, 2), contentType: "application/json" })
    await context.close()
  }
})

test.afterAll(async () => {
  if (installation) { await installation.stop(); installation = undefined }
})

test("BI62 native chapter preserves the human date crop across a real reload", async ({ page }, info) => {
  test.setTimeout(180_000)
  const host = installation!
  const observations: Record<string, unknown>[] = []
  try {
    await host.signIn(page)
    const result = await showScenario(page, host.origin, corpus, "resolved", "BI10")
    const projection = asRecord(result.projection)
    const items = records(asRecord(asRecord(result.presentation).timeline).items)
    const values = records(projection.values)
    const visible = items.filter((item) => values.some((value) => value.id === item.dateValueId &&
      typeof value.value === "string" && value.value >= "2027-11-01" && value.value <= "2027-11-30"))
    expect(visible.length).toBeGreaterThan(0)
    expect(visible.length).toBeLessThan(items.length)
    const panel = page.locator('[data-sf-catalog="UI46"]')
    await panel.getByLabel("Display start date", { exact: true }).fill("2027-11-01")
    await panel.getByLabel("Display end date", { exact: true }).fill("2027-11-30")
    await panel.getByRole("button", { name: "Apply display filter", exact: true }).click()
    await expect(panel.getByRole("list", { name: "Dated milestones", exact: true }).getByRole("listitem")).toHaveCount(visible.length)
    const selectionRef = await page.locator('[data-sf-field="selection"]').inputValue()
    const pending = page.waitForResponse(responseFor("bi-data", "BI10"))
    await page.reload()
    const reloaded = await biReply(await pending)
    expect(asRecord(reloaded.request)).toMatchObject({ selectionRef, period: horizon })
    expect(asRecord(reloaded.projection).decision).toEqual(projection.decision)
    observations.push({ stage: "real-reload", selectionRef, authorizedPeriod: horizon,
      requestedVisualPeriod: { start: "2027-11-01", end: "2027-11-30" },
      observedVisualPeriod: { start: await panel.getByLabel("Display start date", { exact: true }).inputValue(),
        end: await panel.getByLabel("Display end date", { exact: true }).inputValue() } })
    await expect(panel.getByLabel("Display start date", { exact: true })).toHaveValue("2027-11-01")
    await expect(panel.getByLabel("Display end date", { exact: true })).toHaveValue("2027-11-30")
    await expect(panel.getByRole("list", { name: "Dated milestones", exact: true }).getByRole("listitem")).toHaveCount(visible.length)
    for (const item of visible) await expect(dataRow(page, String(item.dateValueId))).toBeVisible()
    for (const item of items.filter((item) => !visible.includes(item))) await expect(dataRow(page, String(item.dateValueId))).toHaveCount(0)
    await expectValue(page, "scenario:candidate-known-subtotal", "250000")
    await expectValue(page, "scenario:known-difference", "10000")
  } finally {
    await info.attach("bi62-reload-crop-observations.json", { body: JSON.stringify(observations, null, 2), contentType: "application/json" })
    await info.attach("bi62-reload-crop.png", { body: await page.screenshot(), contentType: "image/png" })
  }
})

test("BI62 native timeline lets the keyboard choose between both real source versions", async ({ page }, info) => {
  test.setTimeout(180_000)
  const host = installation!
  const observations: Record<string, unknown>[] = []
  try {
    await host.signIn(page)
    const result = await showScenario(page, host.origin, corpus, "resolved", "BI10")
    const values = records(asRecord(result.projection).values)
    const items = records(asRecord(asRecord(result.presentation).timeline).items)
    // The copied renewal line becomes the bridge line. Both source versions
    // establish its November difference, so neither origin may be guessed.
    const candidates = items.flatMap((item) => {
      const value = values.find((entry) => entry.id === item.dateValueId)!
      const refs = records(value.sourceRefs)
      const versions = refs.filter((ref) => ref.kind === "record").map((ref) => asRecord(ref.target).recordId)
      return value.value === "2027-11-01" && value.drilldown === null && versions.includes(corpus.plans.baseline.id) && versions.includes(corpus.plans.resolved.id)
        ? [{ item, value, refs: refs.filter((ref, index) => refs.findIndex((other) => other.refDigest === ref.refDigest) === index) }] : []
    })
    expect(candidates).toHaveLength(1)
    const { item, value, refs } = candidates[0]!
    expect(refs.length).toBeGreaterThan(1)
    const selected = refs.filter((ref) => ref.kind === "record" && asRecord(ref.target).recordId === corpus.plans.resolved.id)
    expect(selected).toHaveLength(1)
    const chart = page.getByRole("group", { name: "Milestones in the horizon; the list provides state, date and source", exact: true })
    const mark = chart.locator(`[data-bi-focus="${String(item.dateValueId)}"]`)
    observations.push({ stage: "multi-source-milestone", valueId: value.id, date: value.value,
      sourceDigests: refs.map((ref) => ref.refDigest), accessibleMarkCount: await mark.count() })
    await expect(mark).toHaveCount(1)
    await expect(mark).toHaveAttribute("role", "button")
    await expect(mark).toHaveAttribute("tabindex", "0")
    await mark.focus()
    await expect(mark).toBeFocused()
    await mark.press("Enter")
    const chooser = page.getByRole("group", { name: `Choose a source for ${String(item.label)}`, exact: true })
    await expect(chooser).toBeVisible()
    await expect(chooser.locator("button[data-bi-origin]")).toHaveCount(refs.length)
    await chooser.getByRole("button", { name: "Cancel source selection", exact: true }).press("Escape")
    await expect(chooser).toBeHidden()
    await expect(mark).toBeFocused()
    await mark.press("Space")
    await expect(chooser).toBeVisible()
    const pending = page.waitForResponse(responseFor("bi-source", "BI10"))
    await chooser.locator(`button[data-bi-origin="${String(selected[0]!.refDigest)}"]`).press("Enter")
    const response = await pending
    expect(response.status()).toBe(200)
    expect(new URL(response.url()).searchParams.get("referenceDigest")).toBe(selected[0]!.refDigest)
    const destinations = records(asRecord(await response.json()).links).filter((link) => {
      const url = new URL(String(link.url), host.origin)
      return url.pathname === "/sucafina/planner" && url.searchParams.get("version") === corpus.plans.resolved.id
    })
    expect(destinations).toHaveLength(1)
    const nav = page.getByRole("navigation", { name: "Authorized source links", exact: true })
    const destination = nav.getByRole("link", { name: String(destinations[0]!.label), exact: true })
    await expect(destination).toBeVisible()
    await destination.press("Enter")
    await expect(page).toHaveURL((url) => url.pathname === "/orchestra/sf-planner/overview" && url.searchParams.get("version") === corpus.plans.resolved.id)
    await expect(page.locator('[data-sf-surface="CAP17"]')).toBeVisible()
      await expect(page.getByRole("heading", { name: "Overview", exact: true, level: 1 })).toBeVisible()
    observations.push({ stage: "chosen-source-opened", versionId: corpus.plans.resolved.id, action: "keyboard" })
  } finally {
    await info.attach("bi62-timeline-origins-observations.json", { body: JSON.stringify(observations, null, 2), contentType: "application/json" })
    await info.attach("bi62-timeline-origins.png", { body: await page.screenshot(), contentType: "image/png" })
  }
})
