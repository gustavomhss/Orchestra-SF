import { expect, type Browser, type Locator, type Page, type TestInfo } from "@playwright/test"
import { waveFourTest, enter, ready, observePage, scheme, reflow, capture, scrollPageTop, reviewActions } from "./design-support/wave-four"
import { waveThreeData } from "./design-support/wave-three-data"
import { waveFourPlannerData } from "./design-support/wave-four-planner-data"
import type { DesignInstallation } from "./design-support/installation"

// Keep the original enrollment and scoped session out of traces in every test file.
waveFourTest.use({ trace: "off", video: "off" })
waveFourTest.describe.configure({ retries: 0 })

const screens = [
  { id: "CAP20", path: "/orchestra/sf-planner/headcount", title: "Headcount", br: "Headcount" },
  { id: "CAP21", path: "/orchestra/sf-planner/allocations", title: "Entities & allocations", br: "Entidades e alocações" },
  { id: "CAP22", path: "/orchestra/sf-planner/fx", title: "FX rates", br: "Câmbio" },
  { id: "CAP23", path: "/orchestra/sf-planner/versions", title: "Versions", br: "Versões" },
  { id: "CAP23-compare", path: "/orchestra/sf-planner/versions/compare", title: "Compare versions", br: "Comparar versões" },
] as const
type Screen = typeof screens[number]
type Owner = Parameters<typeof enter>[1]
const review = (page: Page) => page.locator('[data-component="sf-change-review"]')

async function go(page: Page, owner: Owner, installation: DesignInstallation, screen: Screen, portuguese = false) {
  const url = new URL(screen.path, installation.origin)
  url.searchParams.set("year", String(installation.year))
  await enter(page, owner, url.href, portuguese ? screen.br : screen.title)
  await expect(page.locator('[data-sf-surface="' + screen.id + '"]')).toHaveAttribute("data-sf-wave", "four")
}
async function width(page: Page, pixels: 1440 | 320) {
  await page.setViewportSize({ width: pixels, height: pixels === 320 ? 900 : 1100 })
  await reflow(page)
  await scrollPageTop(page)
}
async function views(page: Page, info: TestInfo, id: string) {
  await width(page, 1440)
  await scheme(page, "dark")
  await capture(page, info, id + "-dark-desktop-test-data")
  await scheme(page, "light")
  await capture(page, info, id + "-light-desktop-test-data")
  await width(page, 320)
  await capture(page, info, id + "-light-320-test-data")
  // The shell exposes its theme control at desktop width. Use that real
  // control, then return to the narrow viewport for the editor journey.
  await width(page, 1440)
  await scheme(page, "dark")
  await width(page, 320)
}
async function confirm(page: Page, installation: DesignInstallation, sourcePage: string, action: string, label: string, collection?: string) {
  const saved = page.waitForResponse((response) => {
    const request = response.request()
    if (request.method() !== "POST" || new URL(response.url()).pathname !== installation.mount + "/planner") return false
    const input = request.postDataJSON()
    return input?.page === sourcePage && input.action === action && (collection === undefined || input.values?.collection === collection)
  }).then((response) => ({
    status: response.status(), contentType: response.headers()["content-type"],
  })).catch(() => undefined)
  await review(page).getByRole("button", { name: label, exact: true }).click()
  const response = await saved
  if (!response) throw new Error("The original Planner producer did not return a command response")
  expect(response.status).toBe(200)
  expect(response.contentType).toContain("application/json")
  // CDP body retrieval was unavailable after completed native requests in CI.
  // Observe the real HTTP status and the UI's
  // acknowledged transition instead; every caller also requires an exact fresh
  // canonical readback and exactly one POST, independent of the edited draft.
  await expect(review(page)).toHaveCount(0)
  const host = page.locator('[data-sf-host="owner-runtime231"]')
  await expect(host).toHaveAttribute("data-sf-provider-state", "ready")
  await expect(host).toHaveAttribute("data-sf-view-state", "ready")
  await expect(host.locator('[data-sf-frame="page"]')).toHaveCount(1)
  await expect(host.locator('[aria-busy="true"]')).toHaveCount(0)
  console.info("SF_DESIGN_COMMAND " + JSON.stringify({ sourcePage, action, status: response.status,
    acknowledgement: "native review completed; canonical readback follows" }))
}
async function discard(page: Page, editor: Locator) {
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm")
    await dialog.accept()
  })
  await editor.getByRole("button", { name: "Discard draft", exact: true }).click()
  await expect(editor).toHaveCount(0)
}
async function portuguese(browser: Browser, page: Page, owner: Owner, installation: DesignInstallation, info: TestInfo, selection: readonly Screen[]) {
  const cookies = await page.context().cookies(installation.origin + installation.mount)
  expect(cookies.filter((cookie) => /^sucafina_operator_[a-f0-9]{24}$/.test(cookie.name))).toHaveLength(1)
  const context = await browser.newContext({
    locale: "pt-BR", viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1,
    reducedMotion: "reduce", colorScheme: "dark",
    httpCredentials: { username: "orchestra", password: installation.serverPassword },
    storageState: { cookies, origins: [{ origin: installation.origin,
      localStorage: [{ name: "orchestra.global.dat:language", value: JSON.stringify({ locale: "br" }) }] }] },
  })
  try {
    const localized = await context.newPage()
    localized.setDefaultTimeout(15_000)
    const messages = observePage(localized)
    for (const screen of selection) {
      await go(localized, owner, installation, screen, true)
      await width(localized, 1440)
      await scheme(localized, "dark")
      await expect(localized.locator('[data-sf-frame="page"]')).not.toContainText(/sf\.(?:u08|cap21|cap22|u46)\./)
      await capture(localized, info, screen.id + "-pt-BR-dark-desktop-test-data")
      await width(localized, 320)
      await capture(localized, info, screen.id + "-pt-BR-dark-320-test-data")
    }
    expect(messages.pageErrors).toEqual([])
    expect(messages.consoleErrors).toEqual([])
    await info.attach("planner-pt-BR-diagnostics", { body: JSON.stringify(messages, null, 2), contentType: "application/json" })
  } finally { await context.close() }
}

waveFourTest("native Planner wave four · CAP20 headcount and CAP21 shared allocations", async ({ page, browser, installation, owner }, info) => {
  waveFourTest.setTimeout(360_000)
  page.setDefaultTimeout(15_000)
  expect(info.project.metadata.bundle, "maintained production browser runner").toBe("production")
  const messages = observePage(page)
  const mutations: string[] = []
  const savedPositionRateRefs: unknown[] = []
  page.on("request", (request) => {
    if (request.method() !== "POST" || new URL(request.url()).pathname !== installation.mount + "/planner") return
    const input = request.postDataJSON()
    mutations.push(input.page + "/" + input.action)
    if (input.page === "Headcount" && input.action === "save" && input.values?.collection === "positions")
      savedPositionRateRefs.push(input.values.rateId)
  })

  await waveFourTest.step("CAP20 · source roster, draft preservation, review and persisted position", async () => {
    await go(page, owner, installation, screens[0])
    const surface = page.locator('[data-sf-surface="CAP20"]')
    await surface.getByLabel("Version", { exact: true }).selectOption({ label: waveThreeData.planner.version })
    await ready(page, "Headcount")
    const positions = surface.locator(".sf-u08-positions")
    await expect(positions.locator("tbody tr")).toHaveCount(3)
    await expect(positions).toContainText(waveFourPlannerData.headcount.unpriced)
    await expect(surface.locator(".sf-u08-rate-list")).toContainText(waveFourPlannerData.headcount.zeroRate)
    await views(page, info, "CAP20-list")
    const positionRow = positions.locator("tbody tr").filter({ has: page.getByText(waveFourPlannerData.headcount.position, { exact: true }) })
    await positionRow.getByRole("button", { name: "Show details", exact: true }).click()
    const detail = surface.locator("[data-sf-headcount-position]")
    await expect(detail.getByLabel("Name", { exact: true })).toHaveValue(waveFourPlannerData.headcount.position)
    await expect(detail.getByLabel("FTE", { exact: true })).toHaveValue("1")
    const rateCard = detail.getByRole("combobox", { name: "Rate card", exact: true })
    await expect(rateCard.locator("option:checked")).toHaveText(waveFourPlannerData.headcount.rate)
    const rateRef = await rateCard.inputValue()
    expect(rateRef).not.toBe("")
    await expect(detail.getByRole("region", { name: "Monthly cost (USD)", exact: true }).locator("tbody td")).toHaveCount(12)
    await detail.getByLabel("FTE", { exact: true }).fill("0.9")
    await scrollPageTop(page)
    await capture(page, info, "CAP20-dark-320-position-editor-test-data")
    await rateCard.scrollIntoViewIfNeeded()
    await capture(page, info, "CAP20-dark-320-rate-card-label-test-data")
    const before = mutations.length
    await detail.getByRole("button", { name: "Review changes", exact: true }).click()
    await expect(surface).toBeHidden()
    await expect(review(page)).toContainText("0.9")
    await expect(review(page).getByRole("region", { name: "Rate card", exact: true })
      .locator('[data-version="proposed"] .sf-s03-field-value'))
      .toHaveText(waveFourPlannerData.headcount.rate + " · " + rateRef)
    await reviewActions(page)
    await capture(page, info, "CAP20-dark-320-position-review-test-data")
    expect(mutations).toHaveLength(before)
    await review(page).getByRole("button", { name: "Revise", exact: true }).click()
    await expect(detail.getByLabel("FTE", { exact: true })).toHaveValue("0.9")
    await detail.getByRole("button", { name: "Review changes", exact: true }).click()
    await review(page).getByRole("button", { name: "Cancel review", exact: true }).click()
    await expect(detail.getByLabel("FTE", { exact: true })).toHaveValue("0.9")
    expect(mutations).toHaveLength(before)
    await width(page, 1440)
    await detail.getByRole("button", { name: "Review changes", exact: true }).click()
    await confirm(page, installation, "Headcount", "save", "Save position", "positions")
    expect(savedPositionRateRefs).toEqual([rateRef])
    expect(mutations).toHaveLength(before + 1)
    await go(page, owner, installation, screens[0])
    await surface.getByLabel("Version", { exact: true }).selectOption({ label: waveThreeData.planner.version })
    await ready(page, "Headcount")
    await positionRow.getByRole("button", { name: "Show details", exact: true }).click()
    await expect(detail.getByLabel("FTE", { exact: true })).toHaveValue("0.9")
    await expect(rateCard).toHaveValue(rateRef)
    await expect(rateCard.locator("option:checked")).toHaveText(waveFourPlannerData.headcount.rate)
    // The mounted roster can be reopened without clearing the selected record or its draft owner.
    await positions.locator("summary").click()
    await expect(positionRow).toContainText("0.9")
    await scrollPageTop(page)
    await capture(page, info, "CAP20-dark-desktop-confirmed-source-test-data")
    await surface.getByRole("button", { name: "Sync roster", exact: true }).click()
    await expect(review(page)).toContainText("No roster preview was supplied")
    await expect(review(page).getByRole("button", { name: "Sync roster", exact: true })).toBeDisabled()
    await reviewActions(page)
    await capture(page, info, "CAP20-dark-desktop-unavailable-roster-impact-test-data")
    await review(page).getByRole("button", { name: "Cancel review", exact: true }).click()
    expect(mutations).toHaveLength(before + 1)
    await surface.locator(".sf-u08-rate-list").getByRole("button").filter({ hasText: waveFourPlannerData.headcount.zeroRate }).click()
    await expect(surface.getByLabel("Annual", { exact: true })).toHaveValue("0")
    await expect(surface.getByLabel("Currency", { exact: true })).toHaveValue("USD")
    await expect(surface).not.toContainText("sf.u08.cur")
  })

  await waveFourTest.step("CAP21 · list/detail return, invalid distribution, cancel/revise and confirmed source", async () => {
    await go(page, owner, installation, screens[1])
    const surface = page.locator('[data-sf-surface="CAP21"]')
    const entities = surface.locator('[data-sf-catalog="entities"]')
    const allocations = surface.locator('[data-sf-catalog="allocations"]')
    await expect(entities.locator("tr[data-sf-row]")).toHaveCount(2)
    await expect(allocations.locator("tr[data-sf-row]")).toHaveCount(2)
    await views(page, info, "CAP21-shared-catalogs")
    await surface.getByLabel("Filter records", { exact: true }).fill("no matching catalog record")
    await expect(allocations.locator("tr[data-sf-row]")).toHaveCount(0)
    await surface.getByRole("button", { name: "Clear filters", exact: true }).first().click()
    const allocation = allocations.locator("tr[data-sf-row]").filter({ has: page.getByText(waveFourPlannerData.allocations.allocation, { exact: true }) })
    await allocation.getByRole("button", { name: "Open record", exact: true }).click()
    const detail = surface.locator(".sf-n20-detail")
    await expect(detail).toContainText("65%")
    await expect(detail).toContainText("35%")
    await detail.getByRole("button", { name: "Return to list", exact: true }).click()
    await expect(allocation).toBeVisible()
    await allocation.getByRole("button", { name: "Edit", exact: true }).click()
    const editor = surface.locator(".sf-n20-editor")
    const first = editor.getByLabel(waveFourPlannerData.allocations.entity + " Percentage", { exact: true })
    const second = editor.getByLabel(waveFourPlannerData.allocations.secondEntity + " Percentage", { exact: true })
    await first.fill("60")
    const before = mutations.length
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    await expect(surface.getByRole("alert")).toContainText("must total exactly 100%")
    await expect(review(page)).toHaveCount(0)
    expect(mutations).toHaveLength(before)
    await second.fill("40")
    await scrollPageTop(page)
    await capture(page, info, "CAP21-dark-320-distribution-editor-test-data")
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    await expect(review(page)).toContainText("60%")
    await expect(review(page)).toContainText("40%")
    await reviewActions(page)
    await capture(page, info, "CAP21-dark-320-distribution-review-test-data")
    await review(page).getByRole("button", { name: "Cancel review", exact: true }).click()
    await expect(first).toHaveValue("60")
    await expect(second).toHaveValue("40")
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    await review(page).getByRole("button", { name: "Revise", exact: true }).click()
    await expect(second).toHaveValue("40")
    expect(mutations).toHaveLength(before)
    await width(page, 1440)
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    await confirm(page, installation, "Entities & allocations", "save", "Save", "allocations")
    expect(mutations).toHaveLength(before + 1)
    await ready(page, "Entities & allocations")
    await detail.getByRole("button", { name: "Return to list", exact: true }).click()
    await expect(allocation).toBeVisible()
    await go(page, owner, installation, screens[1])
    await allocation.getByRole("button", { name: "Open record", exact: true }).click()
    await expect(detail).toContainText("60%")
    await expect(detail).toContainText("40%")
    await capture(page, info, "CAP21-dark-desktop-confirmed-distribution-test-data")
    await detail.getByRole("button", { name: "Return to list", exact: true }).click()
    const unconfigured = allocations.locator("tr[data-sf-row]").filter({ has: page.getByText(waveFourPlannerData.allocations.classification, { exact: true }) })
    await unconfigured.getByRole("button", { name: "Open record", exact: true }).click()
    await expect(detail).toContainText("No distribution configured")
    await expect(detail).toContainText("0%")
  })

  await portuguese(browser, page, owner, installation, info, screens.slice(0, 2))
  expect(mutations).toEqual(["Headcount/save", "Entities & allocations/save"])
  expect(messages.pageErrors).toEqual([])
    expect(messages.consoleErrors).toEqual([])
  await info.attach("native-planner-headcount-allocation-evidence", {
    body: JSON.stringify({ source: "Original domain commands and fresh authorized native reads; no request, authority or receipt mocks",
      areas: ["CAP20", "CAP21"], widths: [1440, 320], schemes: ["dark", "light"], locales: ["en-US", "pt-BR"],
      actualBrowserZoom: "not measured", confirmedCommands: mutations, ...messages }, null, 2), contentType: "application/json",
  })
})

waveFourTest("native Planner wave four · CAP22 exchange rates and CAP23 versions/comparison", async ({ page, browser, installation, owner }, info) => {
  waveFourTest.setTimeout(420_000)
  page.setDefaultTimeout(15_000)
  expect(info.project.metadata.bundle, "maintained production browser runner").toBe("production")
  const messages = observePage(page)
  const mutations: string[] = []
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === installation.mount + "/planner")
      mutations.push(request.postDataJSON().page + "/" + request.postDataJSON().action)
  })

  await waveFourTest.step("CAP22 · known and missing rates, provenance, review preservation and source readback", async () => {
    await go(page, owner, installation, screens[2])
    const surface = page.locator('[data-sf-surface="CAP22"]')
    await surface.getByLabel("Plan version", { exact: true }).selectOption({ label: waveThreeData.planner.version + " · " + installation.year })
    await ready(page, "FX rates")
    const rates = surface.locator(".sf-n20-fx-rates")
    await expect(rates.locator('[data-sf-rate-state="known"]')).toHaveText("1.08")
    await expect(rates.locator('[data-sf-rate-state="missing"]')).toHaveText("No rate")
    await expect(rates).toContainText(waveFourPlannerData.fx.provider)
    await views(page, info, "CAP22-rates-and-provenance")
    await surface.getByLabel("Filter currencies", { exact: true }).fill("EUR")
    await expect(rates.locator("tr[data-sf-row]")).toHaveCount(1)
    await surface.getByLabel("Filter currencies", { exact: true }).fill("")
    const euro = rates.locator("tr[data-sf-row]").filter({ has: page.getByText("EUR", { exact: true }) })
    await euro.getByRole("button", { name: "Edit", exact: true }).click()
    const editor = surface.locator(".sf-n20-fx-editor")
    await editor.getByLabel("Rate", { exact: true }).fill("1.09")
    await editor.getByLabel("Source reference", { exact: true }).fill(waveFourPlannerData.fx.sourceRef + ":reviewed")
    const observation = new Date(Date.now() - 60_000).toISOString()
    await editor.getByLabel("Observed at (ISO 8601)", { exact: true }).fill(observation)
    await scrollPageTop(page)
    await capture(page, info, "CAP22-dark-320-rate-editor-test-data")
    const before = mutations.length
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    await expect(review(page)).toContainText("1.09")
    await expect(review(page)).toContainText(observation)
    await reviewActions(page)
    await capture(page, info, "CAP22-dark-320-provenance-review-test-data")
    await review(page).getByRole("button", { name: "Revise", exact: true }).click()
    await expect(editor.getByLabel("Rate", { exact: true })).toHaveValue("1.09")
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    await review(page).getByRole("button", { name: "Cancel review", exact: true }).click()
    await expect(editor.getByLabel("Observed at (ISO 8601)", { exact: true })).toHaveValue(observation)
    expect(mutations).toHaveLength(before)
    await width(page, 1440)
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    await confirm(page, installation, "FX rates", "save", "Save")
    expect(mutations).toHaveLength(before + 1)
    await go(page, owner, installation, screens[2])
    await surface.getByLabel("Plan version", { exact: true }).selectOption({ label: waveThreeData.planner.version + " · " + installation.year })
    await ready(page, "FX rates")
    await expect(euro.locator('[data-sf-rate-state="known"]')).toHaveText("1.09")
    await expect(euro.locator("time")).toHaveAttribute("datetime", observation)
    await expect(rates.locator('[data-sf-rate-state="missing"]')).toHaveText("No rate")
    await capture(page, info, "CAP22-dark-desktop-confirmed-provenance-test-data")
    await page.getByRole("button", { name: "Add currency", exact: true }).click()
    await editor.getByLabel("Currency", { exact: true }).fill("USD")
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    await expect(review(page)).toHaveCount(0)
    await expect(surface.getByRole("alert")).toHaveText("Currency")
    expect(mutations).toHaveLength(before + 1)
    await discard(page, editor)
    await expect(rates).toBeVisible()
  })

  const revised = "Design test data · Planning version reviewed"
  const copyName = "Design test data · Reviewable scenario copy"
  await waveFourTest.step("CAP23 · version detail, cancel/revise, confirmed rename and canonical copy", async () => {
    await go(page, owner, installation, screens[3])
    const surface = page.locator('[data-sf-surface="CAP23"]')
    const list = surface.locator(".sf-u46-ledger")
    expect(await list.locator("tr[data-sf-row]").count()).toBeGreaterThanOrEqual(2)
    await views(page, info, "CAP23-version-ledger")
    const primary = list.locator("tr[data-sf-row]").filter({ has: page.getByText(waveThreeData.planner.version, { exact: true }) })
    await expect(primary.getByRole("cell", { name: "Draft", exact: true })).toBeVisible()
    for (const name of ["Copy version", "Lock version", "Make official", "Delete version"])
      await expect(primary.getByRole("button", { name, exact: true })).toBeVisible()
    await expect.poll(async () => (await primary.boundingBox())?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(200)
    // Scroll the real table to its existing actions without invoking a command.
    await primary.getByRole("button", { name: "Delete version", exact: true }).scrollIntoViewIfNeeded()
    await capture(page, info, "CAP23-dark-320-version-actions-test-data")
    await primary.getByRole("button", { name: "Open record", exact: true }).click()
    await ready(page, "Versions")
    const detail = surface.locator("[data-sf-record-detail]")
    await expect(detail.getByLabel("Name", { exact: true })).toHaveValue(waveThreeData.planner.version)
    await detail.getByLabel("Name", { exact: true }).fill(revised)
    await capture(page, info, "CAP23-dark-320-version-editor-test-data")
    const before = mutations.length
    await detail.getByRole("button", { name: "Save version", exact: true }).click()
    await expect(review(page)).toContainText(revised)
    await reviewActions(page)
    await capture(page, info, "CAP23-dark-320-version-review-test-data")
    await review(page).getByRole("button", { name: "Revise", exact: true }).click()
    await expect(detail.getByLabel("Name", { exact: true })).toHaveValue(revised)
    await detail.getByRole("button", { name: "Save version", exact: true }).click()
    await review(page).getByRole("button", { name: "Cancel review", exact: true }).click()
    await expect(detail.getByLabel("Name", { exact: true })).toHaveValue(revised)
    expect(mutations).toHaveLength(before)
    await width(page, 1440)
    await detail.getByRole("button", { name: "Save version", exact: true }).click()
    await confirm(page, installation, "Versions", "save", "Save version")
    await ready(page, "Versions")
    await expect(detail.getByRole("heading", { name: revised, exact: true })).toBeVisible()
    expect(mutations).toHaveLength(before + 1)
    await detail.getByRole("button", { name: "Back", exact: true }).click()
    await expect(list).toContainText(revised)
    // Fresh native entry proves the rename independently of the local version draft.
    await go(page, owner, installation, screens[3])
    await expect(list).toContainText(revised)
    await page.getByRole("button", { name: "Create version", exact: true }).click()
    await ready(page, "Versions")
    const create = surface.locator(".sf-u46-new")
    await create.getByLabel("Name", { exact: true }).fill(copyName)
    const source = create.locator("li").filter({ hasText: revised })
    await source.getByRole("button", { name: "Copy version", exact: true }).click()
    await expect(review(page)).toContainText(copyName)
    await reviewActions(page)
    await capture(page, info, "CAP23-dark-desktop-copy-review-test-data")
    await review(page).getByRole("button", { name: "Cancel review", exact: true }).click()
    await expect(create.getByLabel("Name", { exact: true })).toHaveValue(copyName)
    expect(mutations).toHaveLength(before + 1)
    await source.getByRole("button", { name: "Copy version", exact: true }).click()
    await confirm(page, installation, "Versions", "copy", "Copy version")
    await ready(page, "Versions")
    // The mounted producer confirms the command without returning a record ID.
    // Open the copy from the newly authorized list, as the native page requires.
    const copied = list.locator("tr[data-sf-row]").filter({ has: page.getByText(copyName, { exact: true }) })
    await expect(copied).toHaveCount(1)
    await copied.getByRole("button", { name: "Open record", exact: true }).click()
    await ready(page, "Versions")
    await expect(detail.getByRole("heading", { name: copyName, exact: true })).toBeVisible()
    await detail.getByRole("button", { name: "Back", exact: true }).click()
    await expect(list).toContainText(copyName)
    expect(mutations).toHaveLength(before + 2)
    await capture(page, info, "CAP23-dark-desktop-confirmed-copy-test-data")
  })

  await waveFourTest.step("CAP23 compare · independent source selection and twelve source months", async () => {
    const before = mutations.length
    await go(page, owner, installation, screens[4])
    const comparison = page.locator('[data-sf-surface="CAP23-compare"]')
    await comparison.getByLabel("Compare budget", { exact: true }).selectOption({ label: copyName })
    await comparison.getByLabel("Source version", { exact: true }).selectOption({ label: revised })
    await expect(comparison.locator(".sf-u46-monthly tbody tr")).toHaveCount(12)
    await expect(comparison.locator(".sf-u46-compare-content")).toContainText(revised)
    await expect(comparison.locator(".sf-u46-compare-content")).toContainText(copyName)
    const selectedRight = await comparison.getByLabel("Compare budget", { exact: true }).inputValue()
    await expect(comparison.getByLabel("Source version", { exact: true }).locator('option[value="' + selectedRight + '"]')).toHaveJSProperty("disabled", true)
    await views(page, info, "CAP23-source-comparison")
    const monthly = comparison.locator(".sf-u46-compare-scroll").filter({ has: page.locator(".sf-u46-monthly") })
    await expect.poll(() => monthly.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeGreaterThan(0)
    await monthly.focus()
    await page.keyboard.press("ArrowRight")
    await expect.poll(() => monthly.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
    await reflow(page)
    await capture(page, info, "CAP23-dark-320-keyboard-monthly-scroll-test-data")
    expect(mutations).toHaveLength(before)
    await width(page, 1440)
  })

  await portuguese(browser, page, owner, installation, info, screens.slice(2))
  expect(mutations).toEqual(["FX rates/save", "Versions/save", "Versions/copy"])
  expect(messages.pageErrors).toEqual([])
    expect(messages.consoleErrors).toEqual([])
  await info.attach("native-planner-fx-versions-evidence", {
    body: JSON.stringify({ source: "Original domain commands and fresh authorized native reads; no request, authority or receipt mocks",
      areas: ["CAP22", "CAP23", "CAP23-compare"], widths: [1440, 320], schemes: ["dark", "light"], locales: ["en-US", "pt-BR"],
      actualBrowserZoom: "not measured", confirmedCommands: mutations, ...messages }, null, 2), contentType: "application/json",
  })
})
