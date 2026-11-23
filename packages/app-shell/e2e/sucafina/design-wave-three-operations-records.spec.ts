import { expect, type Locator, type Page, type TestInfo } from "@playwright/test"
import { waveThreeTest, scheme, capture, reflow, reviewActions, scrollPageTop, observePage, enter, originalRead } from "./design-support/wave-three"
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
const riskNotes = "Design test data · Risk ownership and mitigation reviewed."
const relationshipNotes = "Design test data · Engagement plan reviewed with the service owner."
const performanceNotes = "Design test data · Quarterly evidence checked before confirmation."

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
    await enter(page, owner, periodURL(screen, installation.origin, installation.year, installation.month), screen.title,
      undefined, { path: "/api/ui/pages/" + screen.id })
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
    await originalRead(page, owner, { path: "/api/ui/pages/CAP13" }, () =>
      surface.getByRole("button", { name: "Apply filters", exact: true }).click())
    await expect(surface.locator("tr[data-sf-row]")).toHaveCount(0)
    await expect(surface.locator(".sf-u30-count strong")).toHaveText("0")
    await scrollPageTop(page)
    await capture(page, info, "CAP13-filtered-empty-dark-desktop-test-data")
    await surface.getByLabel("Status", { exact: true }).selectOption("")
    await originalRead(page, owner, { path: "/api/ui/pages/CAP13" }, () =>
      surface.getByRole("button", { name: "Apply filters", exact: true }).click())
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
    await expect(review.getByRole("heading", { name: "Edit", exact: true })).toBeVisible()
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
    await originalRead(page, owner, { path: "/api/ui/pages/CAP13" }, () =>
      review.getByRole("button", { name: "Save", exact: true }).click())
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
    await enter(page, owner, periodURL(screen, installation.origin, installation.year, installation.month), screen.title,
      undefined, { path: "/api/ui/pages/" + screen.id })
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
    await originalRead(page, owner, { path: "/api/ui/pages/CAP15" }, () =>
      surface.getByRole("button", { name: "Apply filters", exact: true }).click())
    await expect(surface.locator(".sf-u30-count strong")).toHaveText("1")
    await expect(surface.locator("tr[data-sf-row]")).toHaveCount(1)
    await surface.getByLabel("Search", { exact: true }).fill("")
    await originalRead(page, owner, { path: "/api/ui/pages/CAP15" }, () =>
      surface.getByRole("button", { name: "Apply filters", exact: true }).click())
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
    await expect(review.getByRole("heading", { name: "Edit", exact: true })).toBeVisible()
    await scrollPageTop(page)
    await capture(page, info, "CAP15-review-top-dark-desktop-test-data")
    await reviewActions(page)
    await capture(page, info, "CAP15-review-dark-desktop-test-data")
    await review.getByRole("button", { name: "Cancel review", exact: true }).click()
    await expect(editor.getByLabel("Notes", { exact: true })).toHaveValue(relationshipNotes)
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    expect(mutations).toHaveLength(0)
    await originalRead(page, owner, { path: "/api/ui/pages/CAP15" }, () =>
      review.getByRole("button", { name: "Save", exact: true }).click())
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
    await enter(page, owner, periodURL(screen, installation.origin, installation.year, installation.month), screen.title,
      undefined, { path: "/api/ui/pages/" + screen.id })
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
    await expect(review.getByRole("heading", { level: 4 }).first()).toHaveText("Notes")
    await expect(review.locator(".sf-s03-effect-details")).not.toHaveAttribute("open", "")
    await expect(review.locator(".sf-s03-unchanged")).not.toHaveAttribute("open", "")
    await expect(surface.getByLabel("Confirm weights exceeding total allocation", { exact: true })).toHaveCount(0)
    await scrollPageTop(page)
    await capture(page, info, "CAP16-subitem-review-top-dark-desktop-test-data")
    await reviewActions(page)
    await capture(page, info, "CAP16-subitem-review-dark-desktop-test-data")
    await review.getByRole("button", { name: "Cancel review", exact: true }).click()
    await expect(editor.getByLabel("Notes", { exact: true })).toHaveValue(performanceNotes)
    await expect(editor.getByLabel("Score", { exact: true })).toHaveValue("3")
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    expect(mutations).toHaveLength(0)
    await originalRead(page, owner, { path: "/api/ui/pages/CAP16" }, () =>
      review.getByRole("button", { name: "Save", exact: true }).click())
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

waveThreeTest("installed native operations · weight exceptions require fresh producer-backed consent", async ({ page, installation, owner }, info) => {
  // This separate scenario includes two genuine producer refusals, explicit consent,
  // one accepted command and a fresh source readback; no existing case budget changes.
  waveThreeTest.setTimeout(300_000)
  const started = performance.now()
  expect(info.project.metadata.bundle).toBe("production")
  const messages = observePage(page)
  await enter(page, owner, new URL(screens[4].path, installation.origin).href, screens[4].title,
    undefined, { path: "/api/ui/pages/CAP16" })
  await loaded(page, "CAP16")
  const surface = page.locator('[data-sf-surface="CAP16"]')
  await surface.locator(".sf-u31-open").filter({ hasText: waveThreeData.operations.subitem }).click()
  const detail = surface.locator("[data-sf-performance-detail]")
  await detail.getByRole("button", { name: "Edit sub-item", exact: true }).click()
  const editor = surface.locator("[data-sf-performance-editor]")
  await expect(editor.getByLabel("Owner weight", { exact: true })).toHaveValue("0.4")
  await editor.getByLabel("Owner weight", { exact: true }).fill("0.8")
  await editor.getByLabel("Notes", { exact: true }).fill("Design test data · First allocation exception review.")
  await editor.getByRole("button", { name: "Review changes", exact: true }).click()
  const review = surface.locator('[data-component="sf-change-review"]')
  const consent = review.getByRole("checkbox", { name: "Confirm weights exceeding total allocation", exact: true })
  await expect(consent).toHaveCount(0)
  const firstResponse = page.waitForResponse((response) =>
    response.request().method() === "POST" &&
    new URL(response.url()).pathname === installation.mount + "/dashboard" &&
    response.request().postDataJSON()?.action === "save-sub")
  await review.getByRole("button", { name: "Save", exact: true }).click()
  const first = await firstResponse
  expect(first.status()).toBe(422)
  expect(await first.json()).toMatchObject({ ok: false, errors: ["Confirm owner and co-owner weights exceeding the total before saving."] })
  expect(first.request().postDataJSON()).toMatchObject({ page: "IT Performance Contract", action: "save-sub",
    confirmed: false, values: { ownerWeight: 0.8 } })
  await expect(consent).not.toBeChecked()
  await expect(review.getByRole("button", { name: "Save", exact: true })).toBeDisabled()
  await expect(review.locator(".sf-u31-weight-context")).toContainText("The source rejected this change")
  await review.getByText("Current source allocations", { exact: true }).click()
  const source = review.locator(".sf-u31-weight-context").getByRole("region", { name: waveThreeData.operations.subitem, exact: true })
  await expect(source).toContainText("Owner weight")
  await expect(source.getByText("0.4", { exact: true })).toBeVisible()
  await expect(source.getByText("0.6", { exact: true })).toBeVisible()
  await consent.check()
  await expect(review.getByRole("button", { name: "Save", exact: true })).toBeEnabled()
  await page.setViewportSize({ width: 320, height: 900 })
  await reflow(page)
  await reviewActions(page)
  await capture(page, info, "CAP16-weight-exception-consent-dark-320-test-data")

  // Revising the proposal invalidates consent; the next command must reach the producer unconfirmed.
  await review.getByRole("button", { name: "Revise", exact: true }).click()
  await expect(editor.getByLabel("Owner weight", { exact: true })).toHaveValue("0.8")
  await editor.getByLabel("Notes", { exact: true }).fill("Design test data · Revised allocation exception explicitly accepted.")
  await editor.getByRole("button", { name: "Review changes", exact: true }).click()
  await expect(consent).toHaveCount(0)
  const secondResponse = page.waitForResponse((response) =>
    response.request().method() === "POST" &&
    new URL(response.url()).pathname === installation.mount + "/dashboard" &&
    response.request().postDataJSON()?.action === "save-sub")
  await review.getByRole("button", { name: "Save", exact: true }).click()
  const second = await secondResponse
  expect(second.status()).toBe(422)
  expect(second.request().postDataJSON().confirmed).toBe(false)
  await expect(consent).not.toBeChecked()
  await consent.check()
  const acceptedResponse = page.waitForResponse((response) =>
    response.request().method() === "POST" &&
    new URL(response.url()).pathname === installation.mount + "/dashboard" &&
    response.request().postDataJSON()?.action === "save-sub")
  await originalRead(page, owner, { path: "/api/ui/pages/CAP16" }, () =>
    review.getByRole("button", { name: "Save", exact: true }).click())
  const accepted = await acceptedResponse
  expect(accepted.status()).toBe(200)
  expect(await accepted.json()).toMatchObject({ ok: true })
  const payload = accepted.request().postDataJSON()
  expect(payload).toMatchObject({ confirmed: true, version: first.request().postDataJSON().version,
    values: { ownerWeight: 0.8, notes: "Design test data · Revised allocation exception explicitly accepted." } })
  const keys = await Promise.all([first, second, accepted].map((response) => response.request().headerValue("Idempotency-Key")))
  expect(keys.every((value) => !!value)).toBe(true)
  expect(new Set(keys).size).toBe(3)
  await expect(review).toHaveCount(0)
  await expect(detail).toContainText("Revised allocation exception explicitly accepted")
  await enter(page, owner, new URL(screens[4].path, installation.origin).href, screens[4].title,
    undefined, { path: "/api/ui/pages/CAP16" })
  await loaded(page, "CAP16")
  await surface.locator(".sf-u31-open").filter({ hasText: waveThreeData.operations.subitem }).click()
  await detail.getByRole("button", { name: "Edit sub-item", exact: true }).click()
  await expect(editor.getByLabel("Owner weight", { exact: true })).toHaveValue("0.8")
  await expect(editor.getByLabel("Notes", { exact: true })).toHaveValue("Design test data · Revised allocation exception explicitly accepted.")
  expect(messages.pageErrors).toEqual([])
  expect(messages.consoleErrors.filter((value) =>
    !/^Failed to load resource: the server responded with a status of 422 \(Unprocessable (Entity|Content)\)$/.test(value))).toEqual([])
  await info.attach("native-weight-consent-evidence", { contentType: "application/json",
    body: JSON.stringify({ source: "canonical IT Performance Contract producer", elapsedFromEntryMs: Math.round(performance.now() - started), rejected: [first.status(), second.status()],
      accepted: accepted.status(), freshIdempotencyKeys: new Set(keys).size, confirmed: [false, false, true],
      unchangedVersionAfterRejection: payload.version === first.request().postDataJSON().version, ...messages }, null, 2) })
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
