import { test, expect, type Page, type TestInfo } from "@playwright/test"
import { ServerConnection } from "../../src/context/server-connection"
import { authenticateDesignInstallation, withDesignInstallation, type DesignInstallation } from "./design-support/installation"

type Owner = Awaited<ReturnType<typeof authenticateDesignInstallation>>
const designTest = test.extend<{ installation: DesignInstallation; owner: Owner }>({
  installation: [async ({}, use) => { await withDesignInstallation(use) }, { timeout: 190_000 }],
  context: async ({ browser, installation }, use) => {
    const context = await browser.newContext({
      locale: "en-US", viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1,
      reducedMotion: "reduce", colorScheme: "dark",
      httpCredentials: { username: "orchestra", password: installation.serverPassword },
    })
    try { await use(context) } finally { await context.close() }
  },
  owner: async ({ context, installation }, use) => {
    await use(await authenticateDesignInstallation(context, installation))
  },
})
// Enrollment is real, single use and private. It must never enter a retained trace.
designTest.use({ trace: "off", video: "off" })
designTest.describe.configure({ retries: 0 })

const objective = "Design test data · Compare regional supplier scenarios while preserving delivery continuity and source evidence"
const criteria = [
  "Keep the original source references readable during the review.",
  "Compare the delivery horizon and the total cost in USD.",
  "Require an explicit confirmation before creating the decision.",
]
const screens = [
  { id: "UI29", path: "/orchestra/sf-home", title: "Today" },
  { id: "UI33", path: "/orchestra/sf-decisions", title: "Decisions" },
  { id: "CAP01", path: "/orchestra/sf-dashboard/executive", title: "Executive Dashboard" },
] as const
let previewBytes = 0

type Cap01ReadDiagnostic = {
  httpStatus: number | null
  selection: Record<string, number>
  body: Record<string, unknown>
}
type CaptureDiagnostics = {
  consoleErrors: string[]
  pageErrors: string[]
  cap01Reads: Cap01ReadDiagnostic[]
}
const diagnosticsByPage = new WeakMap<Page, CaptureDiagnostics>()

designTest.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return
  await emitFailureDiagnostics(page, info)
  if (page.isClosed()) return
  try {
    await capture(page, info, "FAILED-native-wave-one-test-data", true)
  } catch {
    await info.attach("FAILED-capture-unavailable", { body: "The real browser could not produce a diagnostic screenshot.", contentType: "text/plain" })
  }
})

designTest("installed native first-wave design · real operator, source data, review and captures", async ({ page, browser, installation, owner }, info) => {
  designTest.setTimeout(240_000)
  expect(info.project.metadata.bundle, "use the existing production runner").toBe("production")
  previewBytes = 0
  const diagnostics: CaptureDiagnostics = { consoleErrors: [], pageErrors: [], cap01Reads: [] }
  diagnosticsByPage.set(page, diagnostics)
  const errors = diagnostics.pageErrors
  const consoleErrors = diagnostics.consoleErrors
  const sourceOrigins = new Set<string>()
  const creationRequests: string[] = []
  page.on("pageerror", (error) => recordMessage(errors, error.stack ?? error.name + ": " + error.message))
  page.on("console", (message) => { if (message.type() === "error") recordMessage(consoleErrors, message.text()) })
  // Original GET route verified in native-ui/domain.ts; never log headers,
  // enrollment URLs, or an unfiltered response envelope.
  const cap01Path = installation.mount + "/api/ui/pages/CAP01"
  page.on("response", (response) => {
    const url = new URL(response.url())
    if (response.request().method() !== "GET" || url.origin !== installation.origin || url.pathname !== cap01Path) return
    const entry: Cap01ReadDiagnostic = {
      httpStatus: response.status(), selection: numericSelection(Object.fromEntries(url.searchParams)),
      body: { state: "response body pending" },
    }
    recordRead(diagnostics, entry)
    void response.text().then((body) => { entry.body = readBodyDiagnostic(body) }).catch(() => {
      entry.body = { state: "response body unavailable" }
    })
  })
  page.on("requestfailed", (request) => {
    const url = new URL(request.url())
    if (request.method() !== "GET" || url.origin !== installation.origin || url.pathname !== cap01Path) return
    recordRead(diagnostics, {
      httpStatus: null, selection: numericSelection(Object.fromEntries(url.searchParams)),
      body: { failure: redact(request.failure()?.errorText ?? "transport failed").slice(0, 512) },
    })
  })
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (url.pathname === "/api/sucafina/installations" || url.pathname.startsWith(installation.mount + "/"))
      sourceOrigins.add(url.origin)
    if (request.method() === "POST" && url.pathname === installation.mount + "/dashboard" &&
        url.searchParams.get("sf") === "workbench-command") creationRequests.push(request.postData() ?? "")
  })
  const href = (pathname: string) => {
    const url = new URL(pathname, installation.origin)
    url.search = new URLSearchParams({
      server: ServerConnection.key({ type: "http", http: { url: installation.origin } }),
      project: owner.projectId, installation: owner.installationId,
    }).toString()
    return url.href
  }
  const enter = async (screen: typeof screens[number]) => {
    await page.goto(href(screen.path))
    await ready(page, screen.title)
    await expect(page).toHaveURL((url) => url.origin === installation.origin && url.pathname === screen.path &&
      url.searchParams.get("project") === owner.projectId && url.searchParams.get("installation") === owner.installationId)
    if (screen.id === "UI29") {
      await expect(page.locator('[data-sf-home="authorized"]')).toBeVisible()
      await expect(page.getByRole("button", { name: installation.topicName, exact: true })).toBeVisible()
      await expect(page.getByRole("button", { name: installation.riskName, exact: true })).toBeVisible()
      await expect(page.locator("[data-sf-home-forecast] dd")).toHaveCount(5)
      await expect(page.getByRole("button", { name: "Resume case: " + objective, exact: true })).toBeEnabled()
      await expect(page.getByText("No authorized meeting snapshot is supplied by this projection.", { exact: true })).toBeVisible()
    }
    if (screen.id === "UI33") {
      const list = page.getByRole("region", { name: "Authorized decision cases", exact: true })
      await expect(list.getByRole("listitem").filter({ hasText: objective })).toHaveCount(1)
      await expect(list.getByRole("link", { name: "Open decision", exact: true })).toBeEnabled()
    }
    if (screen.id === "CAP01") {
      await expect(page.locator('[data-sf-surface="CAP01"]')).toBeVisible()
      await expect(page.locator('[data-sf-metric="budget"]')).toHaveAttribute("data-sf-value", "number")
      await expect(page.locator('[data-sf-metric="forecast"]')).toHaveAttribute("data-sf-value", "number")
      await expect(page.locator('[data-sf-metric="risks"]')).toHaveAttribute("data-sf-value", "missing")
    }
    await reflow(page)
    await scrollPageTop(page)
  }

  // Create exactly one case through the actual inline form and original command.
  await page.goto(href("/orchestra/sf-decisions"))
  await ready(page, "Decisions")
  await scheme(page, "dark")
  // The first-wave account actions use the native menu, with keyboard return
  // to the same trigger and the original admitted actions still reachable.
  const access = page.getByRole("button", { name: "Context and access", exact: true })
  await expect(access).toBeEnabled()
  await access.focus()
  await page.keyboard.press("Enter")
  const accessMenu = page.getByRole("menu", { name: "Context and access", exact: true })
  await expect(accessMenu.getByRole("menuitem", { name: "Refresh access", exact: true })).toBeEnabled()
  await expect(accessMenu.getByRole("menuitem", { name: "Sign out", exact: true })).toBeEnabled()
  await capture(page, info, "UI33-dark-desktop-access-menu-test-data", true)
  await page.keyboard.press("Escape")
  await expect(accessMenu).toBeHidden()
  await expect(access).toBeFocused()
  const start = page.getByRole("button", { name: "New case", exact: true })
  await expect(start).toBeEnabled()
  await start.focus()
  await page.keyboard.press("Enter")
  const form = page.locator("section.sf-n24-create form")
  await expect(form).toHaveCount(1)
  await fillCase(form, installation.year, objective)
  await expect(start).toHaveCount(0)
  await form.getByRole("button", { name: "Back to decisions", exact: true }).click()
  await expect(form).toBeHidden()
  const resumeDraft = page.getByRole("button", { name: "Resume draft", exact: true })
  await expect(resumeDraft).toBeEnabled()
  await resumeDraft.focus()
  await page.keyboard.press("Enter")
  await expect(form).toBeVisible()
  await expect(form.getByLabel("Decision objective", { exact: true })).toHaveValue(objective)
  await expect(form.getByLabel("Decision objective", { exact: true })).toBeFocused()
  await expect(form.getByLabel("Criteria, one per line", { exact: true })).toHaveValue(criteria.join("\n"))
  await reflow(page)
  await capture(page, info, "UI33-dark-desktop-editor-test-data", true)
  await expect(form.getByRole("button", { name: "Confirm this decision creation", exact: true })).toHaveCount(0)
  await form.getByRole("button", { name: "Review creation", exact: true }).click()
  const review = form.getByRole("group", { name: "Review creation", exact: true })
  await expect(review).toContainText(objective)
  await expect(review.getByRole("listitem")).toHaveText(criteria)
  await expect(form.getByLabel("Decision objective", { exact: true })).toHaveCount(0)
  await expect(review.getByRole("heading", { name: "Review creation", exact: true })).toBeFocused()
  // Returning from review must restore the original draft after inputs unmount.
  await form.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(form.getByLabel("Decision objective", { exact: true })).toHaveValue(objective)
  await expect(form.getByLabel("Decision objective", { exact: true })).toBeFocused()
  await expect(form.getByLabel("Start", { exact: true })).toHaveValue(installation.year + "-01-01")
  await expect(form.getByLabel("End", { exact: true })).toHaveValue(installation.year + "-12-31")
  await expect(form.getByLabel("Currency", { exact: true })).toHaveValue("USD")
  await expect(form.getByLabel("Criteria, one per line", { exact: true })).toHaveValue(criteria.join("\n"))
  await form.getByRole("button", { name: "Review creation", exact: true }).click()
  await expect(review.getByRole("listitem")).toHaveText(criteria)
  expect(creationRequests).toHaveLength(0)
  const confirm = form.getByRole("button", { name: "Confirm this decision creation", exact: true })
  await expect(confirm).toBeEnabled()
  await reflow(page)
  await capture(page, info, "UI33-dark-desktop-inline-review-test-data", true)
  const createPanel = page.getByRole("region", { name: "Create a decision", exact: true })
  await createPanel.scrollIntoViewIfNeeded()
  await expect(createPanel).toBeInViewport({ ratio: 1 })
  await expect(confirm).toBeInViewport({ ratio: 1 })
  await expect(form.getByRole("button", { name: "Cancel", exact: true })).toBeInViewport({ ratio: 1 })
  await capture(page, info, "UI33-dark-desktop-review-actions-test-data", true)
  await confirm.click()
  const opened = form.getByRole("link", { name: "Open decision", exact: true })
  await expect(opened).toBeVisible()
  await expect(form.getByRole("status")).toBeVisible()
  expect(creationRequests).toHaveLength(1)
  const createdHref = await opened.getAttribute("href")
  expect(createdHref).toMatch(/^\/orchestra\/sf-decisions\//)
  const list = page.getByRole("region", { name: "Authorized decision cases", exact: true })
  await expect(list).toBeHidden()
  await form.getByRole("button", { name: "Back to decisions", exact: true }).click()
  await expect(form).toHaveCount(0)
  await expect(list.getByRole("listitem").filter({ hasText: objective }).getByRole("link", { name: "Open decision", exact: true }))
    .toHaveAttribute("href", createdHref!)
  await expect(start).toBeEnabled()
  await start.click()
  await expect(form.getByLabel("Decision objective", { exact: true })).toBeEditable()
  await expect(form.getByLabel("Decision objective", { exact: true })).toHaveValue("")
  await expect(form.getByLabel("Criteria, one per line", { exact: true })).toHaveValue("")
  expect(creationRequests).toHaveLength(1)
  await enter(screens[1])

  // A real filter, keyboard clear and visible focus ring; no synthetic row click.
  const search = list.getByRole("searchbox")
  await search.fill("no-matching-design-test-case")
  await expect(list.getByRole("listitem")).toHaveCount(0)
  await search.press("Tab")
  const clear = list.getByRole("button", { name: "Clear filter", exact: true })
  await expect(clear).toHaveCount(1)
  await expect(clear).toBeFocused()
  await expect(clear).toHaveCSS("outline-style", "solid")
  await page.keyboard.press("Enter")
  await expect(search).toHaveValue("")
  await expect(list.getByRole("listitem").filter({ hasText: objective })).toHaveCount(1)

  for (const screen of screens) {
    await enter(screen)
    await capture(page, info, screen.id + "-dark-desktop-test-data", true)
    if (screen.id === "UI29") {
      const resume = page.locator(".sf-today-resume").filter({
        has: page.getByRole("heading", { name: "Resume", exact: true }),
      })
      await resume.scrollIntoViewIfNeeded()
      await expect(resume).toBeInViewport({ ratio: 1 })
      await capture(page, info, "UI29-dark-desktop-resume-test-data", true)
      const availability = page.locator(".sf-today-availability").filter({
        has: page.getByRole("heading", { name: "Material changes", exact: true }),
      })
      await availability.scrollIntoViewIfNeeded()
      await expect(availability).toBeInViewport({ ratio: 1 })
      await expect(availability.getByText("Material changes are not supplied by this projection.", { exact: true }))
        .toBeInViewport({ ratio: 1 })
      await capture(page, info, "UI29-dark-desktop-source-availability-test-data", true)
    }
    if (screen.id === "CAP01") {
      const people = page.getByRole("region", { name: "People and efficiency", exact: true })
      await people.scrollIntoViewIfNeeded()
      await expect(people).toBeInViewport({ ratio: 1 })
      await capture(page, info, "CAP01-dark-desktop-people-test-data", true)
      await page.locator("[data-dashboard-signals]").scrollIntoViewIfNeeded()
      await capture(page, info, "CAP01-dark-desktop-signals-test-data", true)
    }
  }
  // Review actual density in a shorter laptop window as well as the large capture.
  await page.setViewportSize({ width: 1440, height: 800 })
  for (const screen of screens) {
    await enter(screen)
    await capture(page, info, screen.id + "-dark-1440x800-test-data", true)
  }
  await page.setViewportSize({ width: 1440, height: 1100 })
  await scheme(page, "light")
  for (const screen of screens) {
    await enter(screen)
    await expect(page.locator("html")).toHaveAttribute("data-color-scheme", "light")
    await capture(page, info, screen.id + "-light-desktop-test-data", true)
  }

  // 320 CSS pixels is a reflow probe, not a claim of actual browser zoom.
  await page.setViewportSize({ width: 320, height: 1100 })
  for (const screen of [screens[1], screens[2]]) {
    await enter(screen)
    await capture(page, info, screen.id + "-light-320-test-data", true)
  }
  await enter(screens[1])
  await page.getByRole("button", { name: "New case", exact: true }).click()
  await fillCase(form, installation.year, objective + " · unsubmitted review")
  await form.getByRole("button", { name: "Review creation", exact: true }).click()
  await expect(form.getByRole("group", { name: "Review creation", exact: true }).getByRole("listitem")).toHaveText(criteria)
  const narrowActions = form.locator(".sf-n24-actions")
  // Center the real scroll target with breathing room inside the native page.
  // Nearest alignment can leave a fractional pixel under the rounded shell edge.
  await narrowActions.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }))
  await expect(narrowActions).toBeInViewport({ ratio: 1 })
  await expect(narrowActions.getByRole("button", { name: "Cancel", exact: true })).toBeInViewport({ ratio: 1 })
  await expect(narrowActions.getByRole("button", { name: "Confirm this decision creation", exact: true })).toBeInViewport({ ratio: 1 })
  await reflow(page)
  await capture(page, info, "UI33-light-320-inline-review-test-data", true)
  await form.getByRole("button", { name: "Cancel", exact: true }).click()
  expect(creationRequests).toHaveLength(1)

  await page.setViewportSize({ width: 1440, height: 1100 })
  await scheme(page, "dark")
  await page.setViewportSize({ width: 390, height: 1100 })
  await enter(screens[0])
  await capture(page, info, "UI29-dark-390-test-data", true)
  const narrowResume = page.locator(".sf-today-resume").filter({
    has: page.getByRole("heading", { name: "Resume", exact: true }),
  })
  await narrowResume.scrollIntoViewIfNeeded()
  await expect(narrowResume).toBeInViewport({ ratio: 1 })
  await capture(page, info, "UI29-dark-390-resume-test-data", true)
  // Collect all static views first. The real editor remains a required gate:
  // any unavailable source, broken draft or review still fails this test.
  await page.setViewportSize({ width: 1440, height: 1100 })
  await enter(screens[2])
  await scheme(page, "dark")
  const yearControl = page.getByLabel("Year", { exact: true })
  await expect(yearControl).toBeVisible()
  await expect(yearControl).toBeEnabled()
  await expect(yearControl.getByRole("option", { name: String(installation.year), exact: true })).toHaveCount(1)
  await yearControl.selectOption(String(installation.year))
  await expect(yearControl).toHaveValue(String(installation.year))
  await ready(page, "Executive Dashboard")
  // The original annual summary has no activeRisks field. Do not promote
  // the separately supplied current risk count into a selected-year value.
  const annualRisks = page.locator('[data-sf-metric="risks"]')
  await expect(annualRisks).toHaveAttribute("data-sf-value", "missing")
  // Native definition elements expose their content, not an author-supplied name.
  // Require exactly the absence message in the actual accessibility tree.
  await expect(annualRisks.locator("dd")).toMatchAriaSnapshot(`
    - definition:
      - /children: equal
      - text: Not available from this source
  `)
  await expect(annualRisks.locator('dd [aria-hidden="true"]')).toHaveText("—")
  await expect(page.locator(".sf-u02-missing-legend")).toBeVisible()
  await expect(page.locator(".sf-u02-missing-legend")).toContainText("Not available from this source")
  const monthControl = page.getByLabel("Month", { exact: true })
  await expect(monthControl).toBeVisible()
  await expect(monthControl).toBeEnabled()
  await expect(monthControl.getByRole("option", { name: String(installation.month), exact: true })).toHaveCount(1)
  await monthControl.selectOption(String(installation.month))
  await expect(monthControl).toHaveValue(String(installation.month))
  const editor = page.locator('[data-sf-u02-edit="save-users"]')
  await expect(editor.getByLabel("Total IT users", { exact: true })).toHaveValue("128")
  await editor.getByLabel("Total IT users", { exact: true }).fill("129")
  await editor.getByRole("button", { name: "Review source change", exact: true }).click()
  const change = page.locator('[data-component="sf-change-review"]')
  await expect(change.getByRole("button", { name: "Confirm save", exact: true })).toBeEnabled()
  await change.scrollIntoViewIfNeeded()
  await capture(page, info, "CAP01-dark-desktop-inline-review-test-data", true)
  await change.getByRole("button", { name: "Cancel review", exact: true }).click()
  await expect(change).toHaveCount(0)
  await editor.getByRole("button", { name: "Discard draft", exact: true }).click()
  await expect(editor.getByLabel("Total IT users", { exact: true })).toHaveValue("128")
  expect([...sourceOrigins]).toEqual([installation.origin])
  // The original operator cookie is scoped to /sucafina, not the origin root.
  // Preserve the actual issued cookie and its policy when changing locale.
  const localizedCookies = await page.context().cookies(installation.origin + installation.mount)
  expect(localizedCookies.filter((cookie) => /^sucafina_operator_[a-f0-9]{24}$/.test(cookie.name)).length).toBe(1)
  // No producer data, response or authorization is fabricated.
  const portuguese = await browser.newContext({
    locale: "pt-BR", viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1,
    reducedMotion: "reduce", colorScheme: "dark",
    httpCredentials: { username: "orchestra", password: installation.serverPassword },
    storageState: {
      cookies: localizedCookies,
      origins: [{
        origin: installation.origin,
        localStorage: [{ name: "orchestra.global.dat:language", value: JSON.stringify({ locale: "br" }) }],
      }],
    },
  })
  try {
    const localized = await portuguese.newPage()
    localized.on("pageerror", (error) => recordMessage(errors, error.stack ?? error.name + ": " + error.message))
    const localizedScreens = [
      { id: "UI29", path: "/orchestra/sf-home", title: "Hoje" },
      { id: "UI33", path: "/orchestra/sf-decisions", title: "Decisões" },
      { id: "CAP01", path: "/orchestra/sf-dashboard/executive", title: "Visão executiva" },
    ] as const
    for (const screen of localizedScreens) {
      await localized.goto(href(screen.path))
      await ready(localized, screen.title)
      if (screen.id === "UI29") {
        await expect(localized.locator('[data-sf-home="authorized"]')).toBeVisible()
        await expect(localized.getByRole("button", { name: installation.topicName, exact: true })).toBeVisible()
        await expect(localized.getByRole("button", { name: installation.riskName, exact: true })).toBeVisible()
        await expect(localized.locator("[data-sf-home-forecast] dd")).toHaveCount(5)
        await expect(localized.getByRole("button", { name: "Retomar caso: " + objective, exact: true })).toBeEnabled()
      }
      if (screen.id === "UI33") {
        const cases = localized.getByRole("region", { name: "Casos de decisão autorizados", exact: true })
        await expect(cases.getByRole("listitem").filter({ hasText: objective })).toHaveCount(1)
        await expect(cases.getByRole("link", { name: "Abrir decisão", exact: true })).toBeEnabled()
      }
      if (screen.id === "CAP01") {
        await expect(localized.locator('[data-sf-surface="CAP01"]')).toBeVisible()
        await expect(localized.locator('[data-sf-metric="budget"]')).toHaveAttribute("data-sf-value", "number")
        await expect(localized.locator('[data-sf-metric="forecast"]')).toHaveAttribute("data-sf-value", "number")
        await expect(localized.locator('[data-sf-metric="risks"]')).toHaveAttribute("data-sf-value", "missing")
      }
      await scheme(localized, "dark")
      await reflow(localized)
      await scrollPageTop(localized)
      await capture(localized, info, screen.id + "-pt-BR-dark-desktop-test-data", true)
      if (screen.id === "UI33") {
        await localized.getByRole("button", { name: "Novo caso", exact: true }).click()
        const draft = localized.locator("section.sf-n24-create form")
        await draft.getByLabel("Objetivo da decisão", { exact: true }).fill(objective)
        await draft.getByLabel("Início", { exact: true }).fill(installation.year + "-01-01")
        await draft.getByLabel("Fim", { exact: true }).fill(installation.year + "-12-31")
        await draft.getByLabel("Moeda", { exact: true }).fill("USD")
        await draft.getByLabel("Critérios, um por linha", { exact: true }).fill(criteria.join("\n"))
        await expect(localized.getByRole("region", { name: "Casos de decisão autorizados", exact: true })).toBeHidden()
        await reflow(localized)
        await capture(localized, info, "UI33-pt-BR-dark-desktop-editor-test-data", true)
        await draft.getByRole("button", { name: "Revisar criação", exact: true }).click()
        await expect(draft.getByRole("button", { name: "Confirmar a criação desta decisão", exact: true })).toBeEnabled()
        await expect(draft.getByRole("group", { name: "Revisar criação", exact: true }).getByRole("listitem")).toHaveText(criteria)
        await reflow(localized)
        await capture(localized, info, "UI33-pt-BR-dark-desktop-inline-review-test-data", true)
        await draft.getByRole("button", { name: "Cancelar", exact: true }).click()
        await expect(draft.getByLabel("Objetivo da decisão", { exact: true })).toHaveValue(objective)
        await draft.getByRole("button", { name: "Voltar às decisões", exact: true }).click()
        await expect(draft).toBeHidden()
      }
    }
  } finally {
    await portuguese.close()
  }
  await info.attach("native-wave-one-evidence", {
    body: JSON.stringify({ source: "isolated canonical producer test data", casesCreated: creationRequests.length,
      views: ["UI29", "UI33", "CAP01"], widths: [1440, 320, 390], heights: [1100, 800], schemes: ["dark", "light"], locales: ["en-US", "pt-BR"],
      actualBrowserZoom: "not measured", consoleErrors, pageErrors: errors, cap01Reads: diagnostics.cap01Reads }, null, 2),
    contentType: "application/json",
  })
  expect(errors, "unhandled errors from the real native application").toEqual([])
})

async function fillCase(form: ReturnType<Page["locator"]>, year: number, title: string) {
  await expect(form.getByLabel("Decision objective", { exact: true })).toBeEditable()
  await form.getByLabel("Decision objective", { exact: true }).fill(title)
  await form.getByLabel("Start", { exact: true }).fill(year + "-01-01")
  await form.getByLabel("End", { exact: true }).fill(year + "-12-31")
  await form.getByLabel("Currency", { exact: true }).fill("USD")
  await form.getByLabel("Criteria, one per line", { exact: true }).fill(criteria.join("\n"))
}

async function ready(page: Page, title: string) {
  const host = page.locator('[data-sf-host="owner-runtime231"]')
  await expect(host).toHaveCount(1)
  for (const attribute of ["data-sf-discovery-state", "data-sf-provider-state", "data-sf-view-state"])
    await expect(host).toHaveAttribute(attribute, "ready")
  await expect(host.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible()
  await expect(host.locator('[data-sf-frame="page"]')).toHaveCount(1)
  await expect(host.locator('[aria-busy="true"]')).toHaveCount(0)
}

async function scheme(page: Page, expected: "dark" | "light") {
  const html = page.locator("html")
  await expect(html).toHaveAttribute("data-color-scheme", /^(dark|light)$/)
  if (await html.getAttribute("data-color-scheme") !== expected)
    await page.locator('[data-slot="orchestra-theme-toggle"]').click()
  await expect(html).toHaveAttribute("data-color-scheme", expected)
}

async function scrollPageTop(page: Page) {
  const scroller = page.locator('[data-sf-frame="page"] .mx-page')
  await scroller.evaluate((element) => element.scrollTo({ top: 0, left: 0, behavior: "instant" }))
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop), {
    message: "the actual native page scroller starts the main capture at the top",
  }).toBe(0)
}

async function reflow(page: Page) {
  const frame = page.locator('[data-sf-frame="page"]')
  await expect.poll(() => frame.evaluate((element) => {
    const page = element.querySelector(".mx-page")
    if (!(page instanceof HTMLElement)) throw new Error("Native page scroller missing")
    return Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, page.scrollWidth - page.clientWidth)
  }), { message: "native document and page scroller do not overflow horizontally" }).toBeLessThanOrEqual(1)
}

async function capture(page: Page, info: TestInfo, name: string, preview: boolean) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  const path = info.outputPath(name + ".png")
  await page.screenshot({ path, fullPage: true, animations: "disabled" })
  await info.attach(name, { path, contentType: "image/png" })
  if (!preview) return
  const jpeg = await page.screenshot({ type: "jpeg", quality: 78, fullPage: true, animations: "disabled" })
  if (jpeg.byteLength > 480 * 1024 || (!name.startsWith("FAILED-") && previewBytes + jpeg.byteLength > 4 * 1024 * 1024)) {
    console.info("SF_DESIGN_PREVIEW " + JSON.stringify({ name, skipped: "bounded preview budget; canonical PNG attached" }))
    return
  }
  previewBytes += jpeg.byteLength
  const encoded = jpeg.toString("base64")
  const parts = Math.ceil(encoded.length / 24000)
  for (let part = 0; part < parts; part++)
    console.info("SF_DESIGN_PREVIEW " + JSON.stringify({ name, part: part + 1, parts, data: encoded.slice(part * 24000, (part + 1) * 24000) }))
}

function recordMessage(messages: string[], value: string) {
  const safe = redact(value).slice(0, 1024)
  if (!messages.includes(safe)) messages.push(safe)
  if (messages.length > 8) messages.shift()
}

function recordRead(diagnostics: CaptureDiagnostics, entry: Cap01ReadDiagnostic) {
  diagnostics.cap01Reads.push(entry)
  if (diagnostics.cap01Reads.length > 8) diagnostics.cap01Reads.shift()
}

function numericSelection(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {}
  const selection: Record<string, number> = {}
  for (const key of ["year", "month", "execYear", "executiveMonth", "opsMonth"]) {
    const field: unknown = Reflect.get(value, key)
    if (typeof field === "number" && Number.isFinite(field)) selection[key] = field
    if (typeof field === "string" && /^\d{1,4}$/.test(field)) selection[key] = Number(field)
  }
  return selection
}

function readBodyDiagnostic(text: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(text)
    if (!parsed || typeof parsed !== "object") return { state: "non-object JSON response" }
    const status: unknown = Reflect.get(parsed, "status")
    const reason: unknown = Reflect.get(parsed, "reason")
    const value: unknown = Reflect.get(parsed, "value")
    const selection = value && typeof value === "object" ? Reflect.get(value, "selection") : undefined
    return {
      status: typeof status === "string" ? redact(status).slice(0, 64) : "not provided",
      ...(typeof reason === "string" ? { reason: redact(reason).slice(0, 512) } : {}),
      selection: numericSelection(selection),
    }
  } catch {
    return { state: "non-JSON response", excerpt: redact(text).slice(0, 512) }
  }
}

async function emitFailureDiagnostics(page: Page, info: TestInfo) {
  const diagnostics = diagnosticsByPage.get(page) ?? { consoleErrors: [], pageErrors: [], cap01Reads: [] }
  await info.attach("FAILED-native-wave-one-diagnostics", {
    body: JSON.stringify(diagnostics, null, 2), contentType: "application/json",
  })
  console.info("SF_DESIGN_DIAGNOSTICS " + JSON.stringify({ kind: "summary", testStatus: info.status,
    consoleErrors: diagnostics.consoleErrors.length, pageErrors: diagnostics.pageErrors.length,
    cap01Reads: diagnostics.cap01Reads.length }))
  for (const [index, message] of diagnostics.consoleErrors.entries())
    console.info("SF_DESIGN_DIAGNOSTICS " + JSON.stringify({ kind: "console-error", index, message }))
  for (const [index, message] of diagnostics.pageErrors.entries())
    console.info("SF_DESIGN_DIAGNOSTICS " + JSON.stringify({ kind: "page-error", index, message }))
  for (const [index, read] of diagnostics.cap01Reads.entries())
    console.info("SF_DESIGN_DIAGNOSTICS " + JSON.stringify({ kind: "CAP01-read", index, ...read }))
}

function redact(value: string) {
  return value.replace(/[a-f0-9]{64}/g, "[redacted]")
    .replace(/https?:\/\/[^\s"'<>]+/g, "[url]")
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi, "[credential]")
    .replace(/\b(code|token|password|secret|authorization)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s&,]+)/gi, "$1=[redacted]")
}
