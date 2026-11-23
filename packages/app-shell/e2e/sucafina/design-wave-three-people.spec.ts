import { expect } from "@playwright/test"
import { waveThreeTest, ready, scheme, capture, reflow, reviewActions, scrollPageTop, observePage, enter, originalRead } from "./design-support/wave-three"
import { waveThreeData } from "./design-support/wave-three-data"

// Keep the original enrollment and scoped session out of traces in every test file.
waveThreeTest.use({ trace: "off", video: "off" })
waveThreeTest.describe.configure({ retries: 0 })

const peopleScreens = [
  { id: "CAP06", path: "/orchestra/sf-people/overview", title: "Headcount Overview", br: "Visão de headcount" },
  { id: "CAP07", path: "/orchestra/sf-people/structure", title: "Team Structure", br: "Estrutura da equipe" },
  { id: "CAP08", path: "/orchestra/sf-people/talent", title: "Talent Review", br: "Avaliação de talentos" },
] as const
const portfolioScreens = [
  { id: "CAP09", path: "/orchestra/sf-portfolio/overview", title: "Portfolio Dashboard", br: "Visão do portfólio" },
  { id: "CAP10", path: "/orchestra/sf-portfolio/projects", title: "All Projects", br: "Projetos" },
] as const

waveThreeTest("native people design · reported headcount, structure, talent and honest workbooks", async ({ page, browser, installation, owner }, info) => {
  waveThreeTest.setTimeout(300_000)
  page.setDefaultTimeout(15_000)
  expect(info.project.metadata.bundle).toBe("production")
  const messages = observePage(page)
  const mutations: string[] = []
  const origins = new Set<string>()
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (!url.pathname.startsWith(installation.mount + "/")) return
    origins.add(url.origin)
    if (request.method() === "POST") mutations.push(url.pathname)
  })

  await waveThreeTest.step("three native collections in both schemes and at narrow width", async () => {
    for (const screen of peopleScreens) {
      await page.setViewportSize({ width: 1440, height: 1100 })
      await enter(page, owner, new URL(screen.path, installation.origin).href, screen.title,
        undefined, { path: "/api/ui/pages/" + screen.id })
      const surface = page.locator('[data-sf-surface="' + screen.id + '"]')
      await expect(surface).toHaveAttribute("data-sf-wave", "three")
      if (screen.id === "CAP06") {
        await expect(surface.locator('[data-sf-metrics="headcount"]')).toContainText("Active")
        await expect(surface.locator("tbody")).toContainText(waveThreeData.people.leader)
      }
      if (screen.id === "CAP07") {
        await expect(surface.getByRole("heading", { name: waveThreeData.people.cio, exact: true })).toBeVisible()
        await expect(surface.locator("tr[data-sf-record]")).toHaveCount(5)
      }
      if (screen.id === "CAP08") await expect(surface.locator("tbody")).toContainText(waveThreeData.people.member)
      await scheme(page, "dark")
      await capture(page, info, screen.id + "-dark-desktop-test-data")
      if (screen.id === "CAP07") {
        await surface.locator('.sf-people-table-region[aria-label="Members"]').scrollIntoViewIfNeeded()
        await capture(page, info, "CAP07-dark-desktop-members-test-data")
        await scrollPageTop(page)
      }
      await scheme(page, "light")
      await capture(page, info, screen.id + "-light-desktop-test-data")
      await page.setViewportSize({ width: 320, height: 900 })
      await reflow(page)
      await scrollPageTop(page)
      await capture(page, info, screen.id + "-light-320-test-data")
      if (screen.id === "CAP07") {
        await surface.locator('.sf-people-table-region[aria-label="Members"]').scrollIntoViewIfNeeded()
        await capture(page, info, "CAP07-light-320-members-test-data")
      }
      if (screen.id === "CAP06") {
        await surface.locator(".sf-people-table-region").scrollIntoViewIfNeeded()
        await capture(page, info, "CAP06-light-320-leaders-test-data")
      }
    }
  })

  await waveThreeTest.step("CIO, leader, member and change review remain source bound", async () => {
    await page.setViewportSize({ width: 1440, height: 1100 })
    await enter(page, owner, new URL(peopleScreens[1].path, installation.origin).href, peopleScreens[1].title,
      undefined, { path: "/api/ui/pages/CAP07" })
    await scheme(page, "dark")
    const surface = page.locator('[data-sf-surface="CAP07"]')
    await surface.getByRole("button", { name: "Edit CIO", exact: true }).click()
    await expect(surface.locator('[data-sf-editor="cio"]')).toBeVisible()
    await scrollPageTop(page)
    await capture(page, info, "CAP07-dark-desktop-cio-editor-test-data")
    await surface.getByRole("button", { name: "Back to team", exact: true }).click()

    await surface.getByRole("button", { name: waveThreeData.people.leader, exact: true }).click()
    await expect(surface.locator('[data-sf-selection="details"]')).toContainText(waveThreeData.people.leader)
    await scrollPageTop(page)
    await capture(page, info, "CAP07-dark-desktop-leader-detail-test-data")
    await surface.locator('[data-sf-selection="details"]').getByRole("button", { name: "Edit", exact: true }).click()
    await expect(surface.locator('[data-sf-editor="leader"]')).toBeVisible()
    await capture(page, info, "CAP07-dark-desktop-leader-editor-test-data")
    await surface.getByRole("button", { name: "Back to team", exact: true }).click()

    await surface.getByLabel("Search members", { exact: true }).fill("no matching member")
    await expect(surface.getByText("No members match this search.", { exact: true })).toBeVisible()
    await surface.getByLabel("Search members", { exact: true }).fill("")
    await surface.getByRole("button", { name: waveThreeData.people.member, exact: true }).click()
    await scrollPageTop(page)
    await capture(page, info, "CAP07-dark-desktop-member-detail-test-data")
    await surface.locator('[data-sf-selection="details"]').getByRole("button", { name: "Edit", exact: true }).click()
    const editor = surface.locator('[data-sf-editor="member"]')
    await editor.getByLabel("Title", { exact: true }).fill("Design test data · Regional service delivery manager")
    await scrollPageTop(page)
    await capture(page, info, "CAP07-dark-desktop-member-editor-test-data")
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    const review = editor.locator('[data-component="sf-change-review"]')
    await expect(review).toContainText("Regional service delivery manager")
    await expect(editor.getByRole("textbox", { name: "Title", exact: true })).toBeHidden()
    await review.getByRole("button", { name: "Revise", exact: true }).click()
    await expect(editor.getByLabel("Title", { exact: true })).toHaveValue("Design test data · Regional service delivery manager")
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    await scrollPageTop(page)
    await capture(page, info, "CAP07-dark-desktop-member-review-test-data")
    await page.setViewportSize({ width: 320, height: 900 })
    await reflow(page)
    await reviewActions(page)
    await capture(page, info, "CAP07-dark-320-member-review-actions-test-data")
    expect(mutations).toHaveLength(0)
    await originalRead(page, owner, { path: "/api/ui/pages/CAP07" }, () =>
      review.getByRole("button", { name: "Save member", exact: true }).click())
    await expect(editor.getByLabel("Title", { exact: true })).toHaveValue("Design test data · Regional service delivery manager")
    expect(mutations).toHaveLength(1)
    await page.setViewportSize({ width: 1440, height: 1100 })
    await surface.getByRole("button", { name: "Back to team", exact: true }).click()
    await expect(surface.locator('.sf-people-table-region[aria-label="Members"]')).toContainText("Regional service delivery manager")

    await page.getByRole("button", { name: "Add member", exact: true }).click()
    await editor.getByRole("textbox", { name: "Name", exact: true }).fill("Design test data · New member draft")
    await editor.getByLabel("Title", { exact: true }).fill("Regional programme analyst")
    await scrollPageTop(page)
    await capture(page, info, "CAP07-dark-desktop-new-member-test-data")
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    await expect(review).toContainText("New member draft")
    await capture(page, info, "CAP07-dark-desktop-new-member-review-test-data")
    await review.getByRole("button", { name: "Revise", exact: true }).click()
    await editor.getByRole("button", { name: "Discard draft", exact: true }).click()
    await surface.getByRole("button", { name: "Back to team", exact: true }).click()

    await surface.locator("tr[data-sf-record]").filter({ hasText: waveThreeData.people.leader })
      .filter({ has: page.getByRole("button", { name: "Delete leader", exact: true }) })
      .getByRole("button", { name: "Delete leader", exact: true }).click()
    await expect(surface.getByRole("alertdialog")).toContainText(waveThreeData.people.leader)
    await scrollPageTop(page)
    await capture(page, info, "CAP07-dark-desktop-delete-review-test-data")
    await surface.getByRole("alertdialog").getByRole("button", { name: "Back", exact: true }).click()
    expect(mutations).toHaveLength(1)
  })

  await waveThreeTest.step("talent filter, record, assessment and unavailable workbook routes", async () => {
    await enter(page, owner, new URL(peopleScreens[2].path, installation.origin).href, peopleScreens[2].title,
      undefined, { path: "/api/ui/pages/CAP08" })
    const surface = page.locator('[data-sf-surface="CAP08"]')
    await surface.getByLabel("Search members", { exact: true }).fill("no matching talent")
    await expect(surface.locator("tbody tr")).toHaveCount(0)
    await surface.getByLabel("Search members", { exact: true }).fill("")
    await surface.getByLabel("Filter by status", { exact: true }).selectOption("Terminated")
    await expect(surface.locator("tbody")).toContainText(waveThreeData.people.departed)
    await capture(page, info, "CAP08-dark-desktop-terminated-filter-test-data")
    await surface.getByLabel("Filter by status", { exact: true }).selectOption("Active")
    await surface.getByRole("button", { name: waveThreeData.people.member, exact: true }).click()
    await scrollPageTop(page)
    await capture(page, info, "CAP08-dark-desktop-member-detail-test-data")
    await page.getByRole("button", { name: "Edit review", exact: true }).click()
    const editor = surface.locator('[data-sf-editor="talent"]')
    await expect(editor.getByRole("heading", { name: "Edit review", exact: true })).toBeVisible()
    await expect(editor.getByLabel("Classification", { exact: true })).toBeVisible()
    await expect(editor.getByLabel("Leader reference", { exact: true })).toBeHidden()
    await editor.getByLabel("Notes", { exact: true }).fill("Design test data · Discuss regional responsibilities and next development steps.")
    await scrollPageTop(page)
    await expect(editor.getByLabel("Classification", { exact: true })).toBeInViewport({ ratio: 1 })
    await capture(page, info, "CAP08-dark-desktop-assessment-editor-test-data")
    await page.setViewportSize({ width: 320, height: 900 })
    await reflow(page)
    await scrollPageTop(page)
    await expect(editor.getByLabel("Classification", { exact: true })).toBeInViewport({ ratio: 1 })
    await capture(page, info, "CAP08-dark-320-focused-assessment-editor-test-data")
    await page.setViewportSize({ width: 1440, height: 1100 })
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    const talentReview = editor.locator('[data-component="sf-change-review"]')
    await expect(talentReview).toContainText("next development steps")
    await expect(talentReview.getByRole("heading", { level: 4 }).first()).toHaveText("Notes")
    await expect(talentReview.getByRole("button", { name: "Save review", exact: true })).toBeEnabled()
    const context = talentReview.locator(".sf-s03-unchanged > summary")
    await context.focus()
    await page.keyboard.press("Enter")
    await expect(talentReview.getByRole("region", { name: "Name", exact: true })).toContainText(waveThreeData.people.member)
    await page.keyboard.press("Enter")
    await scrollPageTop(page)
    await capture(page, info, "CAP08-dark-desktop-assessment-review-test-data")
    await page.setViewportSize({ width: 320, height: 900 })
    await reflow(page)
    await reviewActions(page)
    await capture(page, info, "CAP08-dark-320-assessment-review-actions-test-data")
    await editor.getByRole("button", { name: "Revise", exact: true }).click()
    await expect(editor.getByLabel("Notes", { exact: true })).toHaveValue("Design test data · Discuss regional responsibilities and next development steps.")
    await editor.getByRole("button", { name: "Discard draft", exact: true }).click()
    await surface.getByRole("button", { name: "Back to talent review", exact: true }).click()
    await page.setViewportSize({ width: 1440, height: 1100 })

    for (const kind of ["import", "export"] as const) {
      await enter(page, owner, new URL(peopleScreens[2].path + "/" + kind, installation.origin).href, peopleScreens[2].title,
        undefined, { path: "/api/ui/pages/CAP08" })
      const workbook = page.locator('[data-sf-section="' + kind + '"]')
      await expect(workbook).toContainText(kind === "import" ? "has not provided a workbook preview" : "has not provided a download")
      await expect(workbook.getByRole("button")).toBeDisabled()
      await capture(page, info, "CAP08-dark-desktop-" + kind + "-unavailable-test-data")
    }
    expect(mutations).toHaveLength(1)
  })

  await waveThreeTest.step("semantic returns from direct people links preserve owner and filters", async () => {
    for (const route of [
      { id: "CAP07", path: "/orchestra/sf-people/structure/cio", title: "Team Structure", back: "Back to team",
        collection: "/orchestra/sf-people/structure" },
      { id: "CAP08", path: "/orchestra/sf-people/talent/import", title: "Talent Review", back: "Back to talent review",
        collection: "/orchestra/sf-people/talent" },
      { id: "CAP08", path: "/orchestra/sf-people/talent/export", title: "Talent Review", back: "Back to talent review",
        collection: "/orchestra/sf-people/talent" },
    ]) {
      const direct = await page.context().newPage()
      try {
        const url = new URL(route.path, installation.origin)
        url.searchParams.set("year", String(installation.year))
        url.searchParams.set("month", String(installation.month))
        if (route.collection.endsWith("/talent")) url.searchParams.set("status", "Terminated")
        await enter(direct, owner, url.href, route.title, undefined, { path: "/api/ui/pages/" + route.id,
          query: { year: String(installation.year), month: String(installation.month) } })
        await originalRead(direct, owner, { path: "/api/ui/pages/" + route.id,
          query: { year: String(installation.year), month: String(installation.month) } }, () =>
          direct.getByRole("button", { name: route.back, exact: true }).click())
        await expect(direct).toHaveURL((url) => url.pathname === route.collection &&
          url.searchParams.get("installation") === owner.installationId &&
          url.searchParams.get("year") === String(installation.year) &&
          url.searchParams.get("month") === String(installation.month))
        if (route.collection.endsWith("/talent")) {
          await expect(direct.getByLabel("Filter by status", { exact: true })).toHaveValue("Terminated")
          await expect(direct.locator('tbody')).toContainText(waveThreeData.people.departed)
        } else await expect(direct.locator('.sf-people-table-region[aria-label="Members"]')).toContainText(waveThreeData.people.member)
      } finally {
        await direct.close()
      }
    }
  })

  const localizedCookies = await page.context().cookies(installation.origin + installation.mount)
  const portuguese = await browser.newContext({
    locale: "pt-BR", viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1,
    reducedMotion: "reduce", colorScheme: "dark",
    httpCredentials: { username: "orchestra", password: installation.serverPassword },
    storageState: { cookies: localizedCookies, origins: [{ origin: installation.origin,
      localStorage: [{ name: "orchestra.global.dat:language", value: JSON.stringify({ locale: "br" }) }] }] },
  })
  try {
    const localized = await portuguese.newPage()
    localized.setDefaultTimeout(15_000)
    const diagnostics = observePage(localized)
    for (const screen of peopleScreens) {
      await enter(localized, owner, new URL(screen.path, installation.origin).href, screen.br,
        undefined, { path: "/api/ui/pages/" + screen.id })
      await scheme(localized, "dark")
      await capture(localized, info, screen.id + "-pt-BR-dark-desktop-test-data")
    }
    await localized.locator('[data-sf-surface="CAP08"]').getByRole("button", { name: waveThreeData.people.member, exact: true }).click()
    await localized.getByRole("button", { name: "Editar avaliação", exact: true }).click()
    await scrollPageTop(localized)
    await capture(localized, info, "CAP08-pt-BR-dark-desktop-assessment-editor-test-data")
    await localized.locator('[data-sf-editor="talent"]').getByRole("button", { name: "Revisar alterações", exact: true }).click()
    await reviewActions(localized)
    await capture(localized, info, "CAP08-pt-BR-dark-desktop-assessment-review-test-data")
    await localized.locator('[data-sf-editor="talent"]').getByRole("button", { name: "Revisar", exact: true }).click()
    await localized.getByRole("button", { name: "Voltar à avaliação de talentos", exact: true }).click()
    for (const kind of ["import", "export"] as const) {
      await enter(localized, owner, new URL(peopleScreens[2].path + "/" + kind, installation.origin).href, peopleScreens[2].br,
        undefined, { path: "/api/ui/pages/CAP08" })
      await expect(localized.locator('[data-sf-section="' + kind + '"]')).toContainText("está indisponível")
      await capture(localized, info, "CAP08-pt-BR-dark-desktop-" + kind + "-unavailable-test-data")
    }
    expect(diagnostics.pageErrors).toEqual([])
  } finally {
    await portuguese.close()
  }
  expect([...origins]).toEqual([installation.origin])
  expect(mutations).toHaveLength(1)
  expect(messages.pageErrors).toEqual([])
  await info.attach("native-wave-three-people-evidence", {
    body: JSON.stringify({ source: "isolated canonical producer data; one real browser-confirmed member update",
      areas: ["CAP06", "CAP07", "CAP08"], schemes: ["dark", "light"], locales: ["en-US", "pt-BR"],
      widths: [1440, 320], writes: mutations.length, actualBrowserZoom: "not measured",
      workbookBindings: "unavailable; no preview or download manufactured", ...messages }, null, 2),
    contentType: "application/json",
  })
})

waveThreeTest("native portfolio design · overview, projects, milestones and exact change reviews", async ({ page, browser, installation, owner }, info) => {
  waveThreeTest.setTimeout(300_000)
  page.setDefaultTimeout(15_000)
  expect(info.project.metadata.bundle).toBe("production")
  const messages = observePage(page)
  const mutations: string[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (request.method() === "POST" && url.pathname.startsWith(installation.mount + "/")) mutations.push(url.pathname)
  })
  await waveThreeTest.step("portfolio and project collection across both schemes and narrow reflow", async () => {
    for (const screen of portfolioScreens) {
      await page.setViewportSize({ width: 1440, height: 1100 })
      await enter(page, owner, new URL(screen.path, installation.origin).href, screen.title,
        undefined, { path: "/api/ui/pages/" + screen.id })
      const surface = page.locator('[data-sf-surface="' + screen.id + '"]')
      await expect(surface.locator("tr[data-sf-row]")).toHaveCount(3)
      await expect(surface).toContainText(waveThreeData.projects.primary)
      await expect(surface.getByLabel("Status", { exact: true })).toHaveValue("")
      await expect(surface.getByLabel("Show", { exact: true })).toHaveValue("")
      await scheme(page, "dark")
      await capture(page, info, screen.id + "-dark-desktop-test-data")
      if (screen.id === "CAP09") {
        await surface.locator('.sf-u05-overview-scroll[aria-label="Milestones"]').scrollIntoViewIfNeeded()
        await capture(page, info, "CAP09-dark-desktop-milestones-test-data")
        await scrollPageTop(page)
      }
      await scheme(page, "light")
      await capture(page, info, screen.id + "-light-desktop-test-data")
      await page.setViewportSize({ width: 320, height: 900 })
      await reflow(page)
      await scrollPageTop(page)
      await capture(page, info, screen.id + "-light-320-test-data")
    }
  })

  await waveThreeTest.step("filters, detail, edit, exact proposal and real project write", async () => {
    await page.setViewportSize({ width: 1440, height: 1100 })
    await enter(page, owner, new URL(portfolioScreens[1].path, installation.origin).href, portfolioScreens[1].title,
      undefined, { path: "/api/ui/pages/CAP10" })
    await scheme(page, "dark")
    const surface = page.locator('[data-sf-surface="CAP10"]')
    await surface.getByLabel("Search", { exact: true }).fill("no matching project")
    await expect(surface.locator("tr[data-sf-row]")).toHaveCount(0)
    await surface.getByRole("button", { name: "Reset filters", exact: true }).click()
    await surface.getByLabel("Status", { exact: true }).selectOption("Planning")
    await expect(surface.locator("tr[data-sf-row]")).toHaveCount(1)
    await expect(surface.locator("tr[data-sf-row]")).toContainText(waveThreeData.projects.long)
    await surface.getByRole("button", { name: "Reset filters", exact: true }).click()
    const row = surface.locator("tr[data-sf-row]").filter({ hasText: waveThreeData.projects.primary })
    await expect(surface.locator("#sf-cap10-currency")).toHaveText("Budget and spent: source currency not specified.")
    await expect(surface.getByRole("table")).toHaveAccessibleDescription(/Budget and spent: source currency not specified\./)
    await expect(row).not.toContainText("Source currency not specified")
    await row.locator('[data-sf-action="select"]').click()
    await expect(surface.locator("[data-sf-record-detail]")).toContainText(waveThreeData.projects.primary)
    await expect(surface.locator('[data-sf-section="budget-spent"]')).toContainText("Source currency not specified")
    await expect(surface.getByLabel("Search", { exact: true })).toBeHidden()
    await scrollPageTop(page)
    await capture(page, info, "CAP10-dark-desktop-project-detail-test-data")
    await originalRead(page, owner, { path: "/api/ui/pages/CAP10" }, () =>
      surface.getByRole("button", { name: "Edit project", exact: true }).click())
    await ready(page, portfolioScreens[1].title)
    const editor = surface.locator("[data-sf-project-editor]")
    await expect(editor.locator(".sf-u05-currency-hint")).toHaveText("Source currency not specified")
    await editor.getByLabel("Budget", { exact: true }).fill("190000")
    await editor.getByLabel("Description", { exact: true }).fill("Design test data · Align regional delivery and retain the source record for review.")
    await scrollPageTop(page)
    await capture(page, info, "CAP10-dark-desktop-project-editor-test-data")
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    await expect(editor.getByLabel("Budget", { exact: true })).toBeHidden()
    await expect(editor.locator(".sf-u05-review-values")).toContainText("190,000")
    await expect(editor.locator(".sf-u05-review-values").getByRole("row").filter({ hasText: "190,000" })).toContainText("Source currency not specified")
    await scrollPageTop(page)
    await capture(page, info, "CAP10-dark-desktop-project-review-test-data")
    await editor.getByRole("button", { name: "Continue editing", exact: true }).click()
    await expect(editor.getByLabel("Budget", { exact: true })).toHaveValue("190000")
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    await page.setViewportSize({ width: 320, height: 900 })
    await reflow(page)
    await editor.locator(".sf-u05-form-actions").scrollIntoViewIfNeeded()
    for (const action of await editor.locator(".sf-u05-form-actions").getByRole("button").all())
      await expect(action).toBeInViewport({ ratio: 1 })
    await capture(page, info, "CAP10-dark-320-project-review-actions-test-data")
    expect(mutations).toHaveLength(0)
    await originalRead(page, owner, { path: "/api/ui/pages/CAP10" }, () =>
      editor.getByRole("button", { name: "Save project", exact: true }).click())
    await expect(surface.locator(".sf-u05-notice")).toContainText("Changes were accepted")
    await page.setViewportSize({ width: 1440, height: 1100 })
    await enter(page, owner, new URL(portfolioScreens[1].path, installation.origin).href, portfolioScreens[1].title,
      undefined, { path: "/api/ui/pages/CAP10" })
    await expect(surface.locator("tr[data-sf-row]").filter({ hasText: waveThreeData.projects.primary })).toContainText("190,000")
    expect(mutations).toHaveLength(1)
  })

  await waveThreeTest.step("milestone edit, revision retention, command review and genuine source confirmation", async () => {
    const surface = page.locator('[data-sf-surface="CAP10"]')
    await surface.locator("tr[data-sf-row]").filter({ hasText: waveThreeData.projects.primary }).locator('[data-sf-action="select"]').click()
    await originalRead(page, owner, { path: "/api/ui/pages/CAP10" }, () =>
      surface.getByRole("button", { name: "Milestones", exact: true }).click())
    await ready(page, portfolioScreens[1].title)
    await expect(surface).toHaveAttribute("data-sf-route", "milestones")
    const milestone = surface.locator("[data-sf-milestone]").filter({ hasText: waveThreeData.projects.milestone })
    await expect(milestone).toHaveCount(1)
    await scrollPageTop(page)
    await capture(page, info, "CAP10-dark-desktop-milestones-test-data")
    await milestone.locator("summary").click()
    const originalNotes = await milestone.getByLabel("Notes", { exact: true }).inputValue()
    await milestone.getByLabel("Notes", { exact: true }).fill("Design test data · Regional discovery reviewed with the delivery owner.")
    await milestone.scrollIntoViewIfNeeded()
    await capture(page, info, "CAP10-dark-desktop-milestone-editor-test-data")
    await milestone.getByRole("button", { name: "Review changes", exact: true }).click()
    const review = surface.locator(".sf-u05-command-review")
    await expect(review).toContainText("Regional discovery reviewed")
    const notesComparison = review.getByRole("region", { name: "Notes", exact: true })
    await expect(notesComparison.locator('[data-version="base"] .sf-s03-field-value')).toHaveText(originalNotes)
    await expect(notesComparison.locator('[data-version="proposed"] .sf-s03-field-value')).toHaveText("Design test data · Regional discovery reviewed with the delivery owner.")
    await scrollPageTop(page)
    await capture(page, info, "CAP10-dark-desktop-milestone-review-test-data")
    await review.getByRole("button", { name: "Revise", exact: true }).click()
    await expect(milestone.getByLabel("Notes", { exact: true })).toHaveValue("Design test data · Regional discovery reviewed with the delivery owner.")
    await milestone.getByRole("button", { name: "Review changes", exact: true }).click()
    const milestoneHref = page.url()
    await originalRead(page, owner, { path: "/api/ui/pages/CAP10" }, () =>
      review.getByRole("button", { name: "Save milestone", exact: true }).click())
    await expect(surface.locator(".sf-u05-notice")).toContainText("Changes were accepted")
    await enter(page, owner, milestoneHref, portfolioScreens[1].title,
      undefined, { path: "/api/ui/pages/CAP10" })
    await milestone.locator("summary").click()
    await expect(milestone.getByLabel("Notes", { exact: true })).toHaveValue("Design test data · Regional discovery reviewed with the delivery owner.")
    expect(mutations).toHaveLength(2)
    await surface.getByRole("button", { name: "Delete project", exact: true }).click()
    await expect(review).toContainText(waveThreeData.projects.primary)
    await scrollPageTop(page)
    await capture(page, info, "CAP10-dark-desktop-delete-review-test-data")
    await review.getByRole("button", { name: "Continue editing", exact: true }).click()
    expect(mutations).toHaveLength(2)
  })

  await waveThreeTest.step("new project draft and review have their own stage", async () => {
    await enter(page, owner, new URL(portfolioScreens[1].path, installation.origin).href, portfolioScreens[1].title,
      undefined, { path: "/api/ui/pages/CAP10" })
    await originalRead(page, owner, { path: "/api/ui/pages/CAP10" }, () =>
      page.getByRole("button", { name: "New project", exact: true }).click())
    await ready(page, portfolioScreens[1].title)
    const editor = page.locator("[data-sf-project-editor]")
    await editor.getByLabel("Project name", { exact: true }).fill("Design test data · New project draft")
    await editor.getByLabel("Budget", { exact: true }).fill("50000")
    await editor.getByLabel("Spent", { exact: true }).fill("0")
    await editor.getByLabel("Progress (%)", { exact: true }).fill("0")
    await scrollPageTop(page)
    await capture(page, info, "CAP10-dark-desktop-new-project-test-data")
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    await expect(editor.locator(".sf-u05-review-values")).toContainText("New project draft")
    await scrollPageTop(page)
    await capture(page, info, "CAP10-dark-desktop-new-project-review-test-data")
    await editor.getByRole("button", { name: "Continue editing", exact: true }).click()
    await editor.getByRole("button", { name: "Discard changes", exact: true }).click()
    await expect(editor.getByLabel("Project name", { exact: true })).toHaveValue("")
    expect(mutations).toHaveLength(2)
  })

  const localizedCookies = await page.context().cookies(installation.origin + installation.mount)
  const portuguese = await browser.newContext({
    locale: "pt-BR", viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1,
    reducedMotion: "reduce", colorScheme: "dark",
    httpCredentials: { username: "orchestra", password: installation.serverPassword },
    storageState: { cookies: localizedCookies, origins: [{ origin: installation.origin,
      localStorage: [{ name: "orchestra.global.dat:language", value: JSON.stringify({ locale: "br" }) }] }] },
  })
  try {
    const localized = await portuguese.newPage()
    localized.setDefaultTimeout(15_000)
    const diagnostics = observePage(localized)
    for (const screen of portfolioScreens) {
      await enter(localized, owner, new URL(screen.path, installation.origin).href, screen.br,
        undefined, { path: "/api/ui/pages/" + screen.id })
      await scheme(localized, "dark")
      await capture(localized, info, screen.id + "-pt-BR-dark-desktop-test-data")
    }
    const surface = localized.locator('[data-sf-surface="CAP10"]')
    await expect(surface.locator("#sf-cap10-currency")).toHaveText("Orçamento e realizado: moeda não especificada na fonte.")
    await expect(surface.getByRole("table")).toHaveAccessibleDescription(/Orçamento e realizado: moeda não especificada na fonte\./)
    await originalRead(localized, owner, { path: "/api/ui/pages/CAP10" }, () =>
      surface.locator("tr[data-sf-row]").filter({ hasText: waveThreeData.projects.primary })
        .getByRole("button", { name: "Editar projeto", exact: true }).click())
    const editor = surface.locator("[data-sf-project-editor]")
    await expect(editor.getByLabel("Orçamento", { exact: true })).toHaveValue("190000")
    await scrollPageTop(localized)
    await capture(localized, info, "CAP10-pt-BR-dark-desktop-project-editor-test-data")
    await editor.getByRole("button", { name: "Revisar alterações", exact: true }).click()
    await scrollPageTop(localized)
    await capture(localized, info, "CAP10-pt-BR-dark-desktop-project-review-test-data")
    await localized.setViewportSize({ width: 320, height: 900 })
    await reflow(localized)
    await editor.locator(".sf-u05-form-actions").scrollIntoViewIfNeeded()
    await capture(localized, info, "CAP10-pt-BR-dark-320-project-review-actions-test-data")
    expect(diagnostics.pageErrors).toEqual([])
  } finally {
    await portuguese.close()
  }
  expect(mutations).toHaveLength(2)
  expect(messages.pageErrors).toEqual([])
  await info.attach("native-wave-three-portfolio-evidence", {
    body: JSON.stringify({ source: "isolated canonical producer data; two real browser-confirmed project/milestone writes",
      areas: ["CAP09", "CAP10"], schemes: ["dark", "light"], locales: ["en-US", "pt-BR"],
      widths: [1440, 320], writes: mutations.length, actualBrowserZoom: "not measured", ...messages }, null, 2),
    contentType: "application/json",
  })
})
