import { expect, type Locator, type Page, type TestInfo } from "@playwright/test"
import { waveThreeTest, scheme, capture, reflow, reviewActions, scrollPageTop, observePage, enter } from "./design-support/wave-three"
import { waveThreeData } from "./design-support/wave-three-data"

const screens = [
  { id: "CAP11", path: "/orchestra/sf-operations/service", title: "IT Operations", br: "Serviço de TI" },
  { id: "CAP12", path: "/orchestra/sf-operations/security", title: "IT Security KPIs", br: "Segurança de TI" },
  { id: "CAP13", path: "/orchestra/sf-operations/risks", title: "IT Risks", br: "Riscos de TI" },
  { id: "CAP15", path: "/orchestra/sf-operations/stakeholders", title: "Stakeholder Management", br: "Relacionamento" },
  { id: "CAP16", path: "/orchestra/sf-operations/performance", title: "IT Performance Contract", br: "Contrato de performance" },
] as const
const sourceNotes = "Design test data · Reviewed with the regional source owner."
const riskNotes = "Design test data · Risk ownership and mitigation reviewed."
const relationshipNotes = "Design test data · Engagement plan reviewed with the service owner."
const performanceNotes = "Design test data · Quarterly evidence checked before confirmation."

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

waveThreeTest("installed native operations · risks source filtering and a real reviewed write", async ({ page, installation, owner }, info) => {
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
  const selectedScreens = [screens[2]]

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

  await waveThreeTest.step("risk detail, filter, cancellation and an exact-source reviewed edit", async () => {
    await visit(screens[2])
    await scheme(page, "dark")
    const surface = page.locator('[data-sf-surface="CAP13"]')
    await surface.getByLabel("Status", { exact: true }).selectOption("closed")
    await expect(surface.locator(".sf-u30-count strong")).toHaveText("2")
    await surface.getByRole("button", { name: "Apply filters", exact: true }).click()
    await expect(surface.locator("tr[data-sf-row]")).toHaveCount(0)
    await expect(surface.locator(".sf-u30-count strong")).toHaveText("0")
    await scrollPageTop(page)
    await capture(page, info, "CAP13-filtered-empty-dark-desktop-test-data")
    await surface.getByLabel("Status", { exact: true }).selectOption("")
    await surface.getByRole("button", { name: "Apply filters", exact: true }).click()
    const row = surface.locator("tr[data-sf-row]").filter({ hasText: waveThreeData.operations.risk })
    await row.getByRole("button", { name: "Open record", exact: true }).click()
    const detail = surface.locator("[data-sf-record-detail]")
    await expect(detail).toContainText(waveThreeData.operations.risk)
    await expect(surface.locator(".sf-u30-list")).toBeHidden()
    await scrollPageTop(page)
    await capture(page, info, "CAP13-detail-dark-desktop-test-data")
    await detail.getByRole("button", { name: "Delete record", exact: true }).click()
    await reviewActions(page)
    await capture(page, info, "CAP13-delete-review-dark-desktop-test-data")
    await surface.getByRole("button", { name: "Cancel review", exact: true }).click()
    await detail.getByRole("button", { name: "Edit", exact: true }).click()
    const editor = surface.locator("[data-sf-editor]")
    await expect(editor.getByLabel("Impact", { exact: true })).toHaveValue("3")
    await expect(editor.getByLabel("Probability", { exact: true })).toHaveValue("2")
    await editor.getByLabel("Notes", { exact: true }).fill(riskNotes)
    await editorGeometry(editor)
    await scrollPageTop(page)
    await capture(page, info, "CAP13-editor-dark-desktop-test-data")
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    const review = surface.locator('[data-component="sf-change-review"]')
    await expect(review).toContainText(riskNotes)
    await scrollPageTop(page)
    await capture(page, info, "CAP13-review-top-dark-desktop-test-data")
    await reviewActions(page)
    await capture(page, info, "CAP13-review-dark-desktop-test-data")
    await review.getByRole("button", { name: "Cancel review", exact: true }).click()
    await expect(editor.getByLabel("Notes", { exact: true })).toHaveValue(riskNotes)
    await expect(editor.getByLabel("Impact", { exact: true })).toHaveValue("3")
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    expect(mutations).toHaveLength(0)
    await review.getByRole("button", { name: "Save", exact: true }).click()
    await expect(review).toHaveCount(0)
    await expect(surface.locator("[data-sf-record-detail]")).toContainText(riskNotes)
    await visit(screens[2])
    await page.locator("tr[data-sf-row]").filter({ hasText: waveThreeData.operations.risk })
      .getByRole("button", { name: "Open record", exact: true }).click()
    await expect(page.locator("[data-sf-record-detail]")).toContainText(riskNotes)
    expect(mutations).toHaveLength(1)
  })

  expect([...sourceOrigins]).toEqual([installation.origin])
  expect(messages.pageErrors).toEqual([])
  expect(messages.consoleErrors).toEqual([])
  await info.attach("native-operations-source-evidence", {
    body: JSON.stringify({ areas: selectedScreens.map((screen) => screen.id), data: "isolated canonical source producers",
      writes: mutations.length, mutationPaths: mutations, widths: [1440], themes: ["dark", "light"],
      checks: ["risk filter and delete cancellation","cancel/revise retains draft","one reviewed browser command","updated same-view projection","fresh source readback"], ...messages }, null, 2),
    contentType: "application/json",
  })
})

waveThreeTest("installed native operations · relationships source values and a real reviewed write", async ({ page, installation, owner }, info) => {
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
  const selectedScreens = [screens[3]]

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

  await waveThreeTest.step("relationship profile, localized option values and one reviewed save", async () => {
    await visit(screens[3])
    await scheme(page, "dark")
    const surface = page.locator('[data-sf-surface="CAP15"]')
    await surface.getByLabel("Search", { exact: true }).fill("  REGIONAL OPERATIONS COUNCIL  ")
    await expect(surface.locator(".sf-u30-count strong")).toHaveText("2")
    await surface.getByRole("button", { name: "Apply filters", exact: true }).click()
    await expect(surface.locator(".sf-u30-count strong")).toHaveText("1")
    await expect(surface.locator("tr[data-sf-row]")).toHaveCount(1)
    await surface.getByLabel("Search", { exact: true }).fill("")
    await surface.getByRole("button", { name: "Apply filters", exact: true }).click()
    await expect(surface.locator(".sf-u30-count strong")).toHaveText("2")
    await surface.locator("tr[data-sf-row]").filter({ hasText: waveThreeData.operations.stakeholder })
      .getByRole("button", { name: "Open record", exact: true }).click()
    const detail = surface.locator("[data-sf-record-detail]")
    await expect(detail).toContainText("Action Plan Required")
    await scrollPageTop(page)
    await capture(page, info, "CAP15-detail-dark-desktop-test-data")
    await detail.getByRole("button", { name: "Edit", exact: true }).click()
    const editor = surface.locator("[data-sf-editor]")
    await expect(editor.getByLabel("Business influence", { exact: true })).toHaveValue("4")
    await expect(editor.getByLabel("IT influence", { exact: true })).toHaveValue("5")
    await editor.getByLabel("Notes", { exact: true }).fill(relationshipNotes)
    await editorGeometry(editor)
    await scrollPageTop(page)
    await capture(page, info, "CAP15-editor-dark-desktop-test-data")
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    const review = surface.locator('[data-component="sf-change-review"]')
    await scrollPageTop(page)
    await capture(page, info, "CAP15-review-top-dark-desktop-test-data")
    await reviewActions(page)
    await capture(page, info, "CAP15-review-dark-desktop-test-data")
    await review.getByRole("button", { name: "Cancel review", exact: true }).click()
    await expect(editor.getByLabel("Notes", { exact: true })).toHaveValue(relationshipNotes)
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    expect(mutations).toHaveLength(0)
    await review.getByRole("button", { name: "Save", exact: true }).click()
    await expect(review).toHaveCount(0)
    await expect(surface.locator("[data-sf-record-detail]")).toContainText(relationshipNotes)
    await visit(screens[3])
    await page.locator("tr[data-sf-row]").filter({ hasText: waveThreeData.operations.stakeholder })
      .getByRole("button", { name: "Open record", exact: true }).click()
    await expect(page.locator("[data-sf-record-detail]")).toContainText(relationshipNotes)
    expect(mutations).toHaveLength(1)
  })

  expect([...sourceOrigins]).toEqual([installation.origin])
  expect(messages.pageErrors).toEqual([])
  expect(messages.consoleErrors).toEqual([])
  await info.attach("native-operations-source-evidence", {
    body: JSON.stringify({ areas: selectedScreens.map((screen) => screen.id), data: "isolated canonical source producers",
      writes: mutations.length, mutationPaths: mutations, widths: [1440], themes: ["dark", "light"],
      checks: ["relationship source profile","cancel/revise retains draft","one reviewed browser command","updated same-view projection","fresh source readback"], ...messages }, null, 2),
    contentType: "application/json",
  })
})

waveThreeTest("installed native operations · performance hierarchy and a real reviewed write", async ({ page, installation, owner }, info) => {
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
  const selectedScreens = [screens[4]]

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

  await waveThreeTest.step("performance hierarchy, item editor, sub-item detail and confirmed write", async () => {
    await visit(screens[4])
    await scheme(page, "dark")
    const surface = page.locator('[data-sf-surface="CAP16"]')
    const item = surface.locator("[data-sf-performance-item]").filter({ hasText: waveThreeData.operations.objective })
    await expect(surface.locator(".sf-u31-source-note")).toContainText("The source does not provide an overall score")
    await panelCapture(page, info, "CAP16-items-dark-desktop-test-data", item)
    await panelCapture(page, info, "CAP16-owner-assignments-dark-desktop-test-data", surface.locator("#owner-dashboard"))
    await item.getByRole("button", { name: "Edit item", exact: true }).click()
    const editor = surface.locator("[data-sf-performance-editor]")
    await expect(editor.getByLabel("Item weight (1 = 100%)", { exact: true })).toHaveValue("0.6")
    await editorGeometry(editor)
    await scrollPageTop(page)
    await capture(page, info, "CAP16-item-editor-dark-desktop-test-data")
    await editor.getByRole("button", { name: "Back", exact: true }).click()
    await item.locator(".sf-u31-open").filter({ hasText: waveThreeData.operations.subitem }).click()
    const detail = surface.locator("[data-sf-performance-detail]")
    await expect(detail.getByRole("heading", { name: waveThreeData.operations.subitem, exact: true })).toBeVisible()
    await expect(detail).toContainText("98%")
    await scrollPageTop(page)
    await capture(page, info, "CAP16-subitem-detail-dark-desktop-test-data")
    await panelCapture(page, info, "CAP16-subitem-quarters-dark-desktop-test-data", detail.locator(".sf-u31-quarters"))
    await detail.getByRole("button", { name: "Edit sub-item", exact: true }).click()
    await expect(editor.getByLabel("Score", { exact: true })).toHaveValue("3")
    await expect(editor.getByLabel("Total weight (1 = 100%)", { exact: true })).toHaveValue("0.6")
    await editor.getByLabel("Notes", { exact: true }).fill(performanceNotes)
    await scrollableEditor(page)
    await editorGeometry(editor)
    await scrollPageTop(page)
    await capture(page, info, "CAP16-subitem-editor-dark-desktop-test-data")
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    const review = surface.locator('[data-component="sf-change-review"]')
    await expect(review).toContainText(performanceNotes)
    await expect(surface.getByLabel("Confirm weights exceeding total allocation", { exact: true })).not.toBeChecked()
    await scrollPageTop(page)
    await capture(page, info, "CAP16-subitem-review-top-dark-desktop-test-data")
    await reviewActions(page)
    await capture(page, info, "CAP16-subitem-review-dark-desktop-test-data")
    await review.getByRole("button", { name: "Cancel review", exact: true }).click()
    await expect(editor.getByLabel("Notes", { exact: true })).toHaveValue(performanceNotes)
    await expect(editor.getByLabel("Score", { exact: true })).toHaveValue("3")
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    expect(mutations).toHaveLength(0)
    await review.getByRole("button", { name: "Save", exact: true }).click()
    await expect(review).toHaveCount(0)
    await expect(surface.locator("[data-sf-performance-detail]")).toContainText(performanceNotes)
    await visit(screens[4])
    await page.locator(".sf-u31-open").filter({ hasText: waveThreeData.operations.subitem }).click()
    await expect(page.locator("[data-sf-performance-detail]")).toContainText(performanceNotes)
    expect(mutations).toHaveLength(1)
  })

  expect([...sourceOrigins]).toEqual([installation.origin])
  expect(messages.pageErrors).toEqual([])
  expect(messages.consoleErrors).toEqual([])
  await info.attach("native-operations-source-evidence", {
    body: JSON.stringify({ areas: selectedScreens.map((screen) => screen.id), data: "isolated canonical source producers",
      writes: mutations.length, mutationPaths: mutations, widths: [1440], themes: ["dark", "light"],
      checks: ["item/sub-item hierarchy","cancel/revise retains draft","one reviewed browser command","updated same-view projection","fresh source readback","bounded internal scroll"], ...messages }, null, 2),
    contentType: "application/json",
  })
})

waveThreeTest("installed native operations · Portuguese desktop and 390px editors and reviews", async ({ browser, context, installation, owner }, info) => {
  waveThreeTest.setTimeout(240_000)
  expect(info.project.metadata.bundle).toBe("production")
  const cookies = await context.cookies(installation.origin + installation.mount)
  expect(cookies.filter((cookie) => /^sucafina_operator_[a-f0-9]{24}$/.test(cookie.name))).toHaveLength(1)
  const localized = await browser.newContext({
    locale: "pt-BR", viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1,
    reducedMotion: "reduce", colorScheme: "dark",
    httpCredentials: { username: "orchestra", password: installation.serverPassword },
    storageState: { cookies, origins: [{ origin: installation.origin,
      localStorage: [{ name: "orchestra.global.dat:language", value: JSON.stringify({ locale: "br" }) }] }] },
  })
  try {
    const page = await localized.newPage()
    page.setDefaultTimeout(15_000)
    const messages = observePage(page)
    const writes: string[] = []
    page.on("request", (request) => {
      const url = new URL(request.url())
      if (request.method() === "POST" && url.pathname.startsWith(installation.mount + "/")) writes.push(url.pathname)
    })
    for (const screen of screens) {
      await page.setViewportSize({ width: 1440, height: 1100 })
      await enter(page, owner, periodURL(screen, installation.origin, installation.year, installation.month), screen.br)
      await loaded(page, screen.id)
      await scheme(page, "dark")
      await capture(page, info, screen.id + "-operations-pt-BR-dark-desktop-test-data")
      await page.setViewportSize({ width: 390, height: 900 })
      await reflow(page)
      await scrollPageTop(page)
      await capture(page, info, screen.id + "-operations-pt-BR-dark-390-test-data")
      const surface = page.locator('[data-sf-surface="' + screen.id + '"]')
      if (screen.id === "CAP11") {
        await surface.getByRole("button", { name: "Editar níveis de serviço", exact: true }).click()
        await surface.getByLabel("SLA de incidentes", { exact: true }).fill("98.5")
      } else if (screen.id === "CAP12") {
        await surface.locator("[data-sf-security-campaign]").getByRole("button", { name: "Editar", exact: true }).click()
        await surface.getByLabel("Observações", { exact: true }).fill("Dados de teste · Revisão da campanha regional.")
      } else if (screen.id === "CAP13" || screen.id === "CAP15") {
        const name = screen.id === "CAP13" ? waveThreeData.operations.risk : waveThreeData.operations.stakeholder
        await surface.locator("tr[data-sf-row]").filter({ hasText: name })
          .getByRole("button", { name: "Abrir registro", exact: true }).click()
        await scrollPageTop(page)
        await capture(page, info, screen.id + "-detail-pt-BR-dark-390-test-data")
        await surface.locator("[data-sf-record-detail]").getByRole("button", { name: "Editar", exact: true }).click()
        await surface.getByLabel("Observações", { exact: true }).fill("Dados de teste · Rascunho em português.")
      } else {
        await surface.locator(".sf-u31-open").filter({ hasText: waveThreeData.operations.subitem }).click()
        await scrollPageTop(page)
        await capture(page, info, "CAP16-subitem-detail-pt-BR-dark-390-test-data")
        await surface.getByRole("button", { name: "Editar subitem", exact: true }).click()
        await surface.getByLabel("Observações", { exact: true }).fill("Dados de teste · Evidência trimestral.")
      }
      const editor = surface.locator("[data-sf-editor]")
      if (screen.id === "CAP13" || screen.id === "CAP15" || screen.id === "CAP16") await scrollableEditor(page)
      await editorGeometry(editor)
      await reflow(page)
      await scrollPageTop(page)
      await capture(page, info, screen.id + "-editor-pt-BR-dark-390-test-data")
      if (screen.id === "CAP12") {
        await panelCapture(page, info, "CAP12-departments-pt-BR-dark-390-test-data", editor.locator(".sf-security-departments"))
        await expect(editor.locator('input[name="department.0.users"]')).toHaveValue("70")
      }
      if (screen.id === "CAP16") {
        const quarters = editor.getByRole("group", { name: "Progresso por trimestre", exact: true })
        await expect(quarters.getByLabel("Q1", { exact: true })).toHaveValue("3")
        await expect(quarters.getByLabel("Status do 1º trimestre", { exact: true })).toHaveValue("on")
        await panelCapture(page, info, "CAP16-quarter-editor-pt-BR-dark-390-test-data", quarters)
      }
      await editor.getByRole("button", { name: "Revisar alterações", exact: true }).click()
      await reflow(page)
      await reviewActions(page)
      await capture(page, info, screen.id + "-review-pt-BR-dark-390-test-data")
      const review = surface.locator('[data-component="sf-change-review"]')
      if (screen.id === "CAP13") await expect(review).toContainText("Em acompanhamento")
      if (screen.id === "CAP15") await expect(review).toContainText("Requer plano de ação")
      await review.getByRole("button", { name: "Revisar", exact: true }).click()
      await expect(editor).toBeVisible()
      if (screen.id === "CAP11")
        await expect(editor.getByLabel("SLA de incidentes", { exact: true })).toHaveValue("98.5")
      else await expect(editor.getByLabel("Observações", { exact: true })).toHaveValue(/Dados de teste/)
    }
    expect(writes).toHaveLength(0)
    expect(messages.pageErrors).toEqual([])
    await info.attach("native-operations-localized-evidence", {
      body: JSON.stringify({ areas: screens.map((screen) => screen.id), locale: "pt-BR",
        widths: [1440, 390], writes: writes.length, actualBrowserZoom: "not measured", ...messages }, null, 2),
      contentType: "application/json",
    })
  } finally {
    await localized.close()
  }
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

async function scrollableEditor(page: Page) {
  const scroller = page.locator('[data-sf-frame="page"] .mx-page')
  const sizes = await scroller.evaluate((element) => ({ client: element.clientHeight, content: element.scrollHeight }))
  expect(sizes.client, "the frame receives bounded height through the native view wrapper").toBeGreaterThan(0)
  expect(sizes.content, "the long editor stays inside the native scroll region").toBeGreaterThan(sizes.client)
  await scroller.evaluate((element) => element.scrollTo({ top: element.scrollHeight, behavior: "instant" }))
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
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
