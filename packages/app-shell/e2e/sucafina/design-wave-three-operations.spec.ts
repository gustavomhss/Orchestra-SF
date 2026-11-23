import { expect, type Locator, type Page, type TestInfo } from "@playwright/test"
import { waveThreeTest, scheme, capture, reflow, reviewActions, scrollPageTop, observePage, enter } from "./design-support/wave-three"
import { waveThreeData } from "./design-support/wave-three-data"

// Keep the original enrollment and scoped session out of traces in every test file.
waveThreeTest.use({ trace: "off", video: "off" })
waveThreeTest.describe.configure({ retries: 0 })

const screens = [
  { id: "CAP11", path: "/orchestra/sf-operations/service", title: "IT Operations", br: "Serviço de TI" },
  { id: "CAP12", path: "/orchestra/sf-operations/security", title: "IT Security KPIs", br: "Segurança de TI" },
  { id: "CAP13", path: "/orchestra/sf-operations/risks", title: "IT Risks", br: "Riscos de TI" },
  { id: "CAP15", path: "/orchestra/sf-operations/stakeholders", title: "Stakeholder Management", br: "Relacionamento" },
  { id: "CAP16", path: "/orchestra/sf-operations/performance", title: "IT Performance Contract", br: "Contrato de performance" },
] as const
const sourceNotes = "Design test data · Reviewed with the regional source owner."

waveThreeTest("installed native operations · service source values and a real reviewed write", async ({ page, installation, owner }, info) => {
  waveThreeTest.setTimeout(300_000)
  page.setDefaultTimeout(15_000)
  expect(info.project.metadata.bundle).toBe("production")
  const messages = observePage(page)
  const mutations: string[] = []
  const sourceOrigins = new Set<string>()
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith(installation.mount + "/")) sourceOrigins.add(url.origin)
    if (request.method() === "POST" && url.pathname.startsWith(installation.mount + "/")) mutations.push(url.pathname)
  })
  const visit = async (screen: typeof screens[number]) => {
    await enter(page, owner, periodURL(screen, installation.origin, installation.year, installation.month), screen.title)
    await loaded(page, screen.id)
  }
  const selectedScreens = [screens[0]]

  await waveThreeTest.step("desktop dark and light overviews use the installed producer data", async () => {
    for (const screen of selectedScreens) {
      await page.setViewportSize({ width: 1440, height: 1100 })
      await visit(screen)
      await scheme(page, "dark")
      await capture(page, info, screen.id + "-operations-dark-desktop-test-data")
      await scheme(page, "light")
      await capture(page, info, screen.id + "-operations-light-desktop-test-data")
    }
  })

  await waveThreeTest.step("service ledgers, settings, import and one confirmed SLA update", async () => {
    await visit(screens[0])
    await scheme(page, "dark")
    const service = page.locator('[data-sf-surface="CAP11"]')
    await expect(service.getByLabel("Year", { exact: true })).toHaveValue(String(installation.year))
    await expect(service.getByLabel("Month", { exact: true })).toHaveValue(String(installation.month))
    await expect(service.locator(".sf-ops-metrics")).toContainText("98.4")
    const tickets = service.locator(".sf-ops-ticket-table")
    await expect(tickets.locator("thead th")).toHaveCount(5)
    await expect(tickets.getByRole("row").filter({ hasText: "Infrastructure" })).toContainText("12")
    await panelCapture(page, info, "CAP11-ticket-ledger-dark-desktop-test-data", service.locator('section[aria-labelledby="sf-cap11-tickets-title"]'))
    await panelCapture(page, info, "CAP11-application-health-dark-desktop-test-data", service.locator('section[aria-labelledby="sf-cap11-heat-title"]'))
    await service.getByRole("button", { name: "Edit · iRely", exact: true }).click()
    const editor = service.locator("[data-sf-editor]")
    await expect(editor.getByLabel("P1 incidents", { exact: true })).toHaveValue("0")
    await expect(editor.getByLabel("P2 incidents", { exact: true })).toHaveValue("1")
    await expect(editor.getByLabel("Tickets", { exact: true })).toHaveValue("12")
    await scrollPageTop(page)
    await capture(page, info, "CAP11-application-editor-dark-desktop-test-data")
    await editor.getByRole("button", { name: "Close", exact: true }).click()
    await service.locator(".sf-ops-settings > summary").click()
    await panelCapture(page, info, "CAP11-settings-dark-desktop-test-data", service.locator(".sf-ops-settings"))
    await service.getByRole("button", { name: "Edit categories", exact: true }).click()
    await expect(editor.getByLabel("Names", { exact: true })).toHaveValue(/Infrastructure/)
    await scrollPageTop(page)
    await capture(page, info, "CAP11-categories-editor-dark-desktop-test-data")
    await editor.getByRole("button", { name: "Close", exact: true }).click()
    await service.getByRole("button", { name: "Prepare monthly replacement", exact: true }).click()
    await expect(editor.locator('input[name="ticket.Infrastructure|Incidents|Open"]')).toHaveValue("12")
    await expect(editor.locator('input[name="sla.incSLA"]')).toHaveValue("98.4")
    await expect(editor.locator('input[name="heatmap.iRely.p2"]')).toHaveValue("1")
    await scrollPageTop(page)
    await capture(page, info, "CAP11-import-editor-dark-desktop-test-data")
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    const importReview = editor.locator('[data-component="sf-change-review"]')
    await expect(importReview.getByRole("button", { name: "Replace month", exact: true })).toBeEnabled()
    await expect(importReview).toContainText("Infrastructure · Incidents · Opened")
    const incidents = importReview.getByRole("region", { name: "Infrastructure · Incidents · Opened", exact: true })
    const sla = importReview.getByRole("region", { name: "Incident SLA", exact: true })
    for (const version of ["base", "current"]) {
      await expect(importReview.locator('[data-version="' + version + '"]')
        .filter({ hasText: "No records yet." })).toHaveCount(0)
      await expect(incidents.locator('[data-version="' + version + '"] .sf-s03-field-value')).toHaveText("12")
      await expect(sla.locator('[data-version="' + version + '"] .sf-s03-field-value')).toHaveText("98.4")
    }
    await scrollPageTop(page)
    await capture(page, info, "CAP11-import-review-top-dark-desktop-test-data")
    await reviewActions(page)
    await capture(page, info, "CAP11-import-review-dark-desktop-test-data")
    await importReview.getByRole("button", { name: "Cancel review", exact: true }).click()
    await expect(editor.locator('input[name="ticket.Infrastructure|Incidents|Open"]')).toHaveValue("12")
    await editor.getByRole("button", { name: "Close", exact: true }).click()
    expect(mutations).toHaveLength(0)

    await service.getByRole("button", { name: "Edit service levels", exact: true }).click()
    await editor.getByLabel("Incident SLA", { exact: true }).fill("98.6")
    await editorGeometry(editor)
    await scrollPageTop(page)
    await capture(page, info, "CAP11-sla-editor-dark-desktop-test-data")
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    const review = editor.locator('[data-component="sf-change-review"]')
    await expect(review).toContainText("98.6")
    await reviewActions(page)
    await capture(page, info, "CAP11-sla-review-dark-desktop-test-data")
    await review.getByRole("button", { name: "Cancel review", exact: true }).click()
    await expect(editor.getByLabel("Incident SLA", { exact: true })).toHaveValue("98.6")
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    expect(mutations).toHaveLength(0)
    await review.getByRole("button", { name: "Save SLA", exact: true }).click()
    await expect(editor).toHaveCount(0)
    await expect(service.locator(".sf-ops-metrics")).toContainText("98.6")
    await visit(screens[0])
    await expect(page.locator(".sf-ops-metrics")).toContainText("98.6")
    expect(mutations).toHaveLength(1)
  })

  expect([...sourceOrigins]).toEqual([installation.origin])
  expect(messages.pageErrors).toEqual([])
  expect(messages.consoleErrors).toEqual([])
  await info.attach("native-operations-source-evidence", {
    body: JSON.stringify({ areas: selectedScreens.map((screen) => screen.id), data: "isolated canonical source producers",
      writes: mutations.length, mutationPaths: mutations, widths: [1440], themes: ["dark", "light"],
      checks: ["source ticket transposition","settings and import","cancel/revise retains draft","one reviewed browser command","updated same-view projection","fresh source readback"], ...messages }, null, 2),
    contentType: "application/json",
  })
})

waveThreeTest("installed native operations · security source values and a real reviewed write", async ({ page, installation, owner }, info) => {
  waveThreeTest.setTimeout(300_000)
  page.setDefaultTimeout(15_000)
  expect(info.project.metadata.bundle).toBe("production")
  const messages = observePage(page)
  const mutations: string[] = []
  const sourceOrigins = new Set<string>()
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith(installation.mount + "/")) sourceOrigins.add(url.origin)
    if (request.method() === "POST" && url.pathname.startsWith(installation.mount + "/")) mutations.push(url.pathname)
  })
  const visit = async (screen: typeof screens[number]) => {
    await enter(page, owner, periodURL(screen, installation.origin, installation.year, installation.month), screen.title)
    await loaded(page, screen.id)
  }
  const selectedScreens = [screens[1]]

  await waveThreeTest.step("desktop dark and light overviews use the installed producer data", async () => {
    for (const screen of selectedScreens) {
      await page.setViewportSize({ width: 1440, height: 1100 })
      await visit(screen)
      await scheme(page, "dark")
      await capture(page, info, screen.id + "-operations-dark-desktop-test-data")
      await scheme(page, "light")
      await capture(page, info, screen.id + "-operations-light-desktop-test-data")
    }
  })

  await waveThreeTest.step("security campaigns, incidents and honest unscoped actions", async () => {
    await visit(screens[1])
    await scheme(page, "dark")
    const security = page.locator('[data-sf-surface="CAP12"]')
    const campaign = security.locator("[data-sf-security-campaign]").filter({ hasText: waveThreeData.operations.campaign })
    await expect(campaign.locator(".sf-security-rates")).toContainText("4.17%")
    await campaign.locator("[data-sf-source-rates] > summary").click()
    await expect(campaign.locator("[data-sf-source-rates]")).toContainText("4.166666666666666%")
    await campaign.locator("summary").filter({ hasText: "Department breakdown" }).click()
    await expect(campaign.getByRole("row").filter({ hasText: "Regional operations" })).toContainText("70")
    await panelCapture(page, info, "CAP12-campaign-departments-dark-desktop-test-data", campaign)
    await panelCapture(page, info, "CAP12-incidents-dark-desktop-test-data", security.locator('section[aria-labelledby="sf-cap12-incidents"]'))
    const incident = security.locator(".sf-security-incident-table tbody tr").filter({ hasText: waveThreeData.operations.incident })
    await incident.getByRole("button", { name: "Delete incident", exact: true }).click()
    await expect(security.locator('[data-component="sf-change-review"]').getByRole("button", { name: "Delete incident", exact: true })).toBeEnabled()
    await expect(security.locator('[data-component="sf-change-review"]')).toContainText(waveThreeData.operations.incident)
    await expect(security.locator('[data-component="sf-change-review"]')).toContainText("This record will be deleted.")
    await scrollPageTop(page)
    await capture(page, info, "CAP12-incident-delete-review-top-dark-desktop-test-data")
    await reviewActions(page)
    await capture(page, info, "CAP12-incident-delete-review-dark-desktop-test-data")
    await security.getByRole("button", { name: "Cancel review", exact: true }).click()
    await expect(incident).toBeVisible()
    const actions = security.locator('section[aria-labelledby="sf-cap12-actions"]')
    await expect(actions).toContainText("These actions have no reporting period in the source")
    await actions.locator("summary").click()
    await expect(actions).toContainText("Design test data · Review regional identity access")
    await panelCapture(page, info, "CAP12-unscoped-actions-dark-desktop-test-data", actions)
    await campaign.getByRole("button", { name: "Edit", exact: true }).click()
    const editor = security.locator("[data-sf-editor]")
    await expect(editor.locator(".sf-security-department")).toHaveCount(2)
    await expect(editor.locator('input[name="department.0.users"]')).toHaveValue("70")
    await editor.getByLabel("Notes", { exact: true }).fill(sourceNotes)
    await editorGeometry(editor)
    await scrollPageTop(page)
    await capture(page, info, "CAP12-campaign-editor-dark-desktop-test-data")
    await panelCapture(page, info, "CAP12-department-editor-dark-desktop-test-data", editor.locator(".sf-security-departments"))
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    const review = editor.locator('[data-component="sf-change-review"]')
    await expect(review).toContainText(sourceNotes)
    await expect(review).toContainText("Department name: Regional operations")
    await scrollPageTop(page)
    await capture(page, info, "CAP12-campaign-review-top-dark-desktop-test-data")
    await reviewActions(page)
    await capture(page, info, "CAP12-campaign-review-dark-desktop-test-data")
    await review.getByRole("button", { name: "Revise", exact: true }).click()
    await expect(editor.getByLabel("Notes", { exact: true })).toHaveValue(sourceNotes)
    await expect(editor.locator('input[name="department.0.users"]')).toHaveValue("70")
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    expect(mutations).toHaveLength(0)
    await review.getByRole("button", { name: "Save campaign", exact: true }).click()
    await expect(editor).toHaveCount(0)
    await expect(security.locator("[data-sf-security-campaign]")).toContainText(sourceNotes)
    await visit(screens[1])
    await expect(page.locator("[data-sf-security-campaign]")).toContainText(sourceNotes)
    expect(mutations).toHaveLength(1)
  })

  expect([...sourceOrigins]).toEqual([installation.origin])
  expect(messages.pageErrors).toEqual([])
  expect(messages.consoleErrors).toEqual([])
  await info.attach("native-operations-source-evidence", {
    body: JSON.stringify({ areas: selectedScreens.map((screen) => screen.id), data: "isolated canonical source producers",
      writes: mutations.length, mutationPaths: mutations, widths: [1440], themes: ["dark", "light"],
      checks: ["unscoped security actions","exact rate precision","campaign departments","cancel/revise retains draft","one reviewed browser command","updated same-view projection","fresh source readback"], ...messages }, null, 2),
    contentType: "application/json",
  })
})

function periodURL(screen: typeof screens[number], origin: string, year: number, month: number) {
  const url = new URL(screen.path, origin)
  if (screen.id === "CAP11" || screen.id === "CAP12") {
    url.searchParams.set("year", String(year))
    url.searchParams.set("month", String(month))
  }
  return url.href
}

async function loaded(page: Page, id: typeof screens[number]["id"]) {
  const surface = page.locator('[data-sf-surface="' + id + '"]')
  await expect(surface).toBeVisible()
  await expect(surface).toHaveAttribute("data-sf-wave", "three")
  if (id === "CAP11") await expect(surface.locator(".sf-ops-metrics")).toBeVisible()
  else if (id === "CAP12") await expect(surface.locator("[data-sf-security-campaign]")).toHaveCount(1)
  else if (id === "CAP16") await expect(surface.locator("[data-sf-performance-item]")).toHaveCount(2)
  else await expect(surface.locator("tr[data-sf-row]").first()).toBeVisible()
  await reflow(page)
  await scrollPageTop(page)
}

async function editorGeometry(editor: Locator) {
  await expect(editor).toBeVisible()
  const bounds = await editor.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.width).toBeLessThanOrEqual(760)
}

async function panelCapture(page: Page, info: TestInfo, name: string, panel: Locator) {
  await panel.evaluate((element) => element.scrollIntoView({ block: "start", inline: "nearest", behavior: "instant" }))
  await reflow(page)
  await capture(page, info, name)
}
