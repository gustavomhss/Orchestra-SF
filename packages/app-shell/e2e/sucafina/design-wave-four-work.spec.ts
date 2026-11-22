import { randomUUID } from "node:crypto"
import { expect } from "@playwright/test"
import { waveFourTest, enter, ready, scheme, capture, reflow, reviewActions, scrollPageTop, observePage } from "./design-support/wave-four"
import { waveFourProcurementData } from "./design-support/wave-four-procurement-data"
import { seedWaveFourWork } from "./design-support/wave-four-work-seed"

const screens = [
  { id: "UI30", path: "/orchestra/sf-work", title: "Meu trabalho" },
  { id: "UI31", path: "/orchestra/sf-home/search", title: "Busca" },
  { id: "UI32", path: "/orchestra/sf-work/views", title: "Vistas salvas" },
] as const

for (const area of screens) waveFourTest(area.id + " · native work, private search and saved views use their admitted producer", async ({ page, browser, installation, owner }, info) => {
  waveFourTest.setTimeout(300_000)
  page.setDefaultTimeout(15_000)
  expect(info.project.metadata.bundle).toBe("production")
  const diagnostics = observePage(page)
  const writes: string[] = []
  const searchRequests: { method: string; url: string; body: string | null }[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (url.origin !== installation.origin || !url.pathname.startsWith(installation.mount + "/")) return
    if (url.pathname.endsWith("/api/ui/projections/search")) {
      searchRequests.push({ method: request.method(), url: request.url(), body: request.postData() })
    }
    if (request.method() === "POST" && url.searchParams.get("sf") === "collaboration-work-destination")
      console.info("SF_DESIGN_WORK_DESTINATION_REQUEST " + JSON.stringify({ method: request.method(), operation: "collaboration.work-destination" }))
    if (request.method() === "POST" && url.searchParams.get("sf") === "workbench-views") {
      const body: unknown = request.postDataJSON()
      if (body && typeof body === "object" && "action" in body && (body.action === "save" || body.action === "remove"))
        writes.push(body.action)
    }
  })

  if (area.id === "UI30") await waveFourTest.step("UI30 reads the actual period, original local handoff and reauthorized destination", async () => {
    const seeded = await seedWaveFourWork({
      actorId: installation.actorId,
      request: async (pathname, init) => {
        const headers = new Headers(init?.headers)
        if (init?.method === "POST") headers.set("Origin", installation.origin)
        const response = await page.context().request.fetch(installation.origin + installation.mount + pathname, {
          method: init?.method ?? "GET",
          headers: Object.fromEntries(headers),
          ...(typeof init?.body === "string" ? { data: init.body } : {}),
          timeout: 40_000,
        })
        // Adapt the real Playwright HTTP response without changing its bytes or status.
        return new Response(new Uint8Array(await response.body()), {
          status: response.status(), headers: response.headers(),
        })
      },
    }, installation.year)
    await enter(page, owner, new URL("/orchestra/sf-work", installation.origin).href, "My work")
    const surface = page.locator('[data-sf-surface="UI30"]')
    await expect(surface).toHaveAttribute("data-sf-wave", "four")
    await expect(surface.getByText("Choose a period to load current work.", { exact: true })).toBeVisible()
    await capture(page, info, "UI30-dark-desktop-choose-period")
    await surface.locator("[data-sf-work-start]").fill(installation.year + "-01-01")
    await surface.locator("[data-sf-work-end]").fill(installation.year + "-12-31")
    await surface.getByRole("button", { name: "Load my work", exact: true }).click()
    await expect(surface.getByRole("row").filter({ hasText: waveFourProcurementData.requests.prApproval })).toBeVisible()
    const item = surface.getByRole("row").filter({ hasText: seeded.title })
    await expect(item).toBeVisible()
    await capture(page, info, "UI30-dark-desktop-assigned-work")
    await item.getByRole("button", { name: "Work details", exact: true }).click()
    const details = surface.locator("[data-sf-work-detail]")
    await expect(details.getByRole("heading", { name: seeded.title, exact: true })).toBeVisible()
    await expect(details.locator("[data-sf-work-owner-ref]")).toHaveAttribute("data-sf-work-owner-ref", seeded.ownerRef)
    await expect(details.locator("[data-sf-work-source-version]")).toHaveText(String(seeded.sourceVersion))
    await expect(surface.locator(".sf-work-list")).toBeHidden()
    const destinationReply = page.waitForResponse((response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === installation.mount + "/dashboard" &&
      new URL(response.url()).searchParams.get("sf") === "collaboration-work-destination",
      { timeout: 40_000 }).then((response) => ({ status: response.status(), contentType: response.headers()["content-type"] }))
    await details.getByRole("button", { name: "Check current destination", exact: true }).click()
    const checkedDestination = await destinationReply
    console.info("SF_DESIGN_WORK_DESTINATION " + JSON.stringify(checkedDestination))
    expect(checkedDestination.status).toBe(200)
    expect(checkedDestination.contentType).toContain("application/json")
    await expect(details.getByRole("button", { name: "Open current source", exact: true })).toBeVisible()
    await scrollPageTop(page)
    await capture(page, info, "UI30-dark-desktop-authorized-detail")
    await scheme(page, "light")
    await capture(page, info, "UI30-light-desktop-authorized-detail")
    await page.setViewportSize({ width: 320, height: 900 })
    await reflow(page)
    await capture(page, info, "UI30-light-320-authorized-detail")
    await details.getByRole("button", { name: "Return to list", exact: true }).click()
    await surface.locator("[data-sf-work-filter]").fill("no matching assigned action")
    await expect(surface.getByText("No results for these filters.", { exact: true })).toBeVisible()
    await capture(page, info, "UI30-light-320-filtered-empty")
    await surface.locator("[data-sf-work-filter]").fill("")
    await page.setViewportSize({ width: 1440, height: 1100 })
    await item.getByRole("button", { name: "Work details", exact: true }).click()
    // Opening reauthorizes through the original destination producer again;
    // Work8 measured the preceding check at 18s in this real installation.
    const openedDestinationReply = page.waitForResponse((response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === installation.mount + "/dashboard" &&
      new URL(response.url()).searchParams.get("sf") === "collaboration-work-destination",
      { timeout: 40_000 }).then((response) => ({ status: response.status(), contentType: response.headers()["content-type"] }))
    await details.getByRole("button", { name: "Open authorized destination", exact: true }).click()
    const openedDestination = await openedDestinationReply
    console.info("SF_DESIGN_WORK_DESTINATION_OPEN " + JSON.stringify(openedDestination))
    expect(openedDestination.status).toBe(200)
    expect(openedDestination.contentType).toContain("application/json")
    await expect(page).toHaveURL((url) => url.origin === installation.origin &&
      url.pathname === "/orchestra/sf-dashboard/hot-topics/r_" + Buffer.from(seeded.topicId, "utf8").toString("base64url"))
    await ready(page, "Hot Topics & Actions")
    await expect(page.locator('[data-sf-surface="CAP02"]')).toContainText(seeded.title)
  })

  if (area.id === "UI31") await waveFourTest.step("UI31 sends search text only in the private POST body and renders the real empty result", async () => {
    await page.setViewportSize({ width: 1440, height: 1100 })
    await enter(page, owner, new URL("/orchestra/sf-home/search", installation.origin).href, "Search")
    const surface = page.locator('[data-sf-surface="UI31"]')
    await expect(surface).toHaveAttribute("data-sf-wave", "four")
    await scheme(page, "dark")
    await capture(page, info, "UI31-dark-desktop-before-query")
    await surface.getByRole("button", { name: "Search", exact: true }).click()
    await expect(surface.getByText("Enter a search query before continuing.", { exact: true })).toBeVisible()
    expect(searchRequests).toHaveLength(0)
    await capture(page, info, "UI31-dark-desktop-required-query")
    const query = "Design test data · source without an uploaded document"
    await surface.getByLabel("Words to search", { exact: true }).fill(query)
    const reply = page.waitForResponse((response) => new URL(response.url()).pathname === installation.mount + "/api/ui/projections/search")
      .then(async (response) => ({
        status: response.status(), contentType: response.headers()["content-type"],
        headers: await response.request().allHeaders(),
      }))
    await surface.getByRole("button", { name: "Search", exact: true }).click()
    const response = await reply
    expect(response.status).toBe(200)
    expect(response.contentType).toContain("application/json")
    // A fresh original HTTP read avoids Chromium's evicted response-body cache.
    const headers = { ...response.headers }
    delete headers["content-length"]
    delete headers.host
    const reread = await page.context().request.post(searchRequests[0]!.url, {
      headers, data: { q: query },
    })
    expect(reread.status()).toBe(200)
    expect(await reread.json()).toMatchObject({ status: "ok", value: { matches: [] } })
    await expect(surface.locator('[data-sf-state="empty"]')).toBeVisible()
    expect(searchRequests).toHaveLength(1)
    expect(searchRequests[0]?.method).toBe("POST")
    expect(JSON.parse(searchRequests[0]!.body!)).toEqual({ q: query })
    expect(new URL(searchRequests[0]!.url).searchParams.has("q")).toBe(false)
    expect(page.url()).not.toContain(encodeURIComponent(query))
    await capture(page, info, "UI31-dark-desktop-source-empty")
    await scheme(page, "light")
    await capture(page, info, "UI31-light-desktop-source-empty")
    await surface.getByLabel("Result type", { exact: true }).selectOption("record")
    expect(searchRequests).toHaveLength(1)
    await page.setViewportSize({ width: 320, height: 900 })
    await reflow(page)
    await capture(page, info, "UI31-light-320-source-empty")
  })

  if (area.id === "UI32") await waveFourTest.step("UI32 edits a source-created V1 view, retains the draft through review and rereads version two", async () => {
    const view = {
      id: "wave-four-opex-view",
      title: "Design test data · Regional OPEX view",
      surface: "planner", page: "OPEX", density: "comfortable",
      period: { start: installation.year + "-01-01", end: installation.year + "-12-31" },
      filters: { query: "Design test data", selections: { year: String(installation.year) } },
    }
    // Original human HTTP boundary; no preferences store or native response is patched.
    const endpoint = installation.origin + installation.mount + "/planner?sf=workbench-views"
    const seed = await page.context().request.post(endpoint, {
      headers: { Origin: installation.origin, "Idempotency-Key": randomUUID() },
      data: { action: "save", input: { view, expectedVersion: null } },
    })
    expect(seed.status()).toBe(200)
    expect(await seed.json()).toMatchObject({ status: "ok", value: { view, version: 1 } })
    await page.setViewportSize({ width: 1440, height: 1100 })
    await enter(page, owner, new URL("/orchestra/sf-work/views", installation.origin).href, "Saved views")
    const surface = page.locator('[data-sf-surface="UI32"]')
    await expect(surface).toHaveAttribute("data-sf-wave", "four")
    await scheme(page, "dark")
    await expect(surface.getByRole("button", { name: view.title, exact: true })).toBeVisible()
    await capture(page, info, "UI32-dark-desktop-existing-view-list")
    await surface.getByRole("button", { name: view.title, exact: true }).click()
    const editor = surface.locator(".sf-saved-view-editor")
    await expect(editor).toBeVisible()
    const revised = "Design test data · Regional OPEX review"
    await editor.getByLabel("Name", { exact: true }).fill(revised)
    await editor.getByLabel("Density", { exact: true }).selectOption("compact")
    await editor.getByRole("button", { name: "Return to list", exact: true }).click()
    await expect(editor).toBeHidden()
    await surface.getByRole("button", { name: view.title, exact: true }).click()
    await expect(editor.getByLabel("Name", { exact: true })).toHaveValue(revised)
    await expect(editor.getByLabel("Density", { exact: true })).toHaveValue("compact")
    await capture(page, info, "UI32-dark-desktop-existing-view-editor")
    await editor.getByRole("button", { name: "Review view changes", exact: true }).click()
    const review = surface.locator('[data-component="sf-change-review"]')
    await expect(review).toBeVisible()
    await expect(editor).toBeHidden()
    await expect(review).toContainText(revised)
    await review.getByRole("button", { name: "Revise", exact: true }).click()
    await expect(editor.getByLabel("Name", { exact: true })).toHaveValue(revised)
    await expect(editor.getByLabel("Density", { exact: true })).toHaveValue("compact")
    await editor.getByRole("button", { name: "Review view changes", exact: true }).click()
    await scrollPageTop(page)
    await capture(page, info, "UI32-dark-desktop-existing-view-review")
    await scheme(page, "light")
    await capture(page, info, "UI32-light-desktop-existing-view-review")
    await page.setViewportSize({ width: 320, height: 900 })
    await reflow(page)
    await reviewActions(page)
    await capture(page, info, "UI32-light-320-existing-view-review-actions")
    await review.getByRole("button", { name: "Cancel review", exact: true }).click()
    await expect(editor.getByLabel("Name", { exact: true })).toHaveValue(revised)
    await editor.getByRole("button", { name: "Review view changes", exact: true }).click()
    await review.getByRole("button", { name: "Confirm save", exact: true }).click()
    await expect(review).toBeHidden()
    await expect(editor.getByText("Version 2", { exact: true })).toBeVisible()
    expect(writes).toEqual(["save"])
    const reopened = await page.context().request.post(endpoint, {
      headers: { Origin: installation.origin, "Idempotency-Key": randomUUID() },
      data: { action: "open", input: { id: view.id } },
    })
    expect(reopened.status()).toBe(200)
    expect(await reopened.json()).toMatchObject({ status: "ok", value: {
      version: 2, view: { ...view, title: revised, density: "compact" },
    } })
    await page.setViewportSize({ width: 1440, height: 1100 })
    await enter(page, owner, new URL("/orchestra/sf-work/views/r_" + Buffer.from(view.id, "utf8").toString("base64url"), installation.origin).href, "Saved views")
    await expect(editor.getByLabel("Name", { exact: true })).toHaveValue(revised)
    await expect(editor.getByLabel("Density", { exact: true })).toHaveValue("compact")
    await capture(page, info, "UI32-light-desktop-confirmed-view-readback")
    await editor.getByRole("button", { name: "Remove saved view", exact: true }).click()
    await expect(review.getByRole("button", { name: "Confirm removal", exact: true })).toBeVisible()
    await capture(page, info, "UI32-light-desktop-removal-review")
    await review.getByRole("button", { name: "Cancel review", exact: true }).click()
    expect(writes).toEqual(["save"])
    await enter(page, owner, new URL("/orchestra/sf-work/views/new", installation.origin).href, "Saved views")
    await expect(surface.getByText("Native views and preferred entry are not available until the V2 producer is installed and admitted.", { exact: true })).toBeVisible()
    await capture(page, info, "UI32-light-desktop-native-v2-unavailable")
    expect(writes).toEqual(["save"])
  })

  const cookies = await page.context().cookies(installation.origin + installation.mount)
  const portuguese = await browser.newContext({
    locale: "pt-BR", viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1,
    reducedMotion: "reduce", colorScheme: "dark",
    httpCredentials: { username: "orchestra", password: installation.serverPassword },
    storageState: { cookies, origins: [{ origin: installation.origin,
      localStorage: [{ name: "orchestra.global.dat:language", value: JSON.stringify({ locale: "br" }) }] }] },
  })
  try {
    const localized = await portuguese.newPage()
    localized.setDefaultTimeout(15_000)
    const messages = observePage(localized)
    for (const screen of [area]) {
      await enter(localized, owner, new URL(screen.path, installation.origin).href, screen.title)
      await scheme(localized, "dark")
      await capture(localized, info, screen.id + "-pt-BR-dark-desktop")
    }
    expect(messages.pageErrors).toEqual([])
    expect(messages.consoleErrors).toEqual([])
  } finally { await portuguese.close() }

  expect(diagnostics.pageErrors).toEqual([])
  expect(diagnostics.consoleErrors).toEqual([])
  await info.attach(area.id + "-native-wave-four-evidence", {
    body: JSON.stringify({
      areas: [area.id], schemes: ["dark", "light"], locales: ["en-US", "pt-BR"],
      widths: [1440, 320], confirmedBrowserWrites: writes.length,
      source: "genuine native installation; original Procurement collection and local Handoff command, private search and original V1 preferences",
      limitations: ["Procurement work-item detail returned 503 in the earlier run; positive Work detail uses the original Hot Topic handoff", "No uploaded searchable document", "Native V2 views and preferred entry are not admitted", "Actual browser zoom not measured"],
      ...diagnostics,
    }, null, 2), contentType: "application/json",
  })
})
