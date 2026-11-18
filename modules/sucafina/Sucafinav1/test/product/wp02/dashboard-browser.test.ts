import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { launchBrowserDriver } from "./browser-driver-fixture.ts"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomBytes, randomUUID } from "node:crypto"
import { createModule } from "../../../index.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { object, rows } from "../../../runtime/contract.ts"

// Browser events reach the production module, encrypted operator identity and SQLite.
// Only the initial business records and the clock are fixed by this test.
test("Dashboard browser keeps the monthly draft through a real conflict, reviews three values and preserves record navigation", async () => {
  expectSpawn(import.meta.path)
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "wp02-dashboard-browser-"))
  await chmod(directory, 0o700)
  const driver = await openLocalStore(directory)
  const delayed: { next: boolean; release?: () => void; started?: () => void } = { next: false }
  const routing: { handle: (request: Request) => Promise<Response | undefined> } = { handle: async () => undefined }
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (request) => await routing.handle(request) ?? new Response("Not found", { status: 404 }) })
  const origin = server.url.origin
  const persistence = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID })
  const identity = createOperatorIdentity({ origin, mount: "/sucafina", operator: { installationId: randomUUID(), uid: 1000, name: "Dashboard operator" }, secrets: driver.secrets, key: randomBytes(32) })
  const handler = createModule("/sucafina", { persistence, authenticate: identity.authenticate,
    environment: async (request) => ({ at: "2026-11-13T08:00:00Z", id: randomUUID, directory: await identity.directory(request) }), maxJsonBytes: 100000 })
  routing.handle = async (request) => {
    const command: unknown = request.method === "POST" ? await request.clone().json().catch(() => undefined) : undefined
    const response = await identity.handle(request) ?? await handler(request)
    if (delayed.next && object(command).action === "save-deviation" && response?.ok) {
      delayed.next = false
      await new Promise<void>((resolve) => { delayed.release = resolve; delayed.started?.() })
    }
    return response
  }
  const browserDriver = await launchBrowserDriver("dashboard-monthly").catch(async (error) => {
    await server.stop(true); await driver.dispose(); await rm(directory, { recursive: true, force: true }); throw error
  })
  const browser = browserDriver.browser
  try {
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.opexOwners = [{ id: "owner-1", name: "Operations", budget: 1200 }, { id: "owner-2", name: "Other area", budget: 2400 }]
      snapshot.data.opexEntries = [
        { id: "jan", ownerId: "owner-1", year: 2026, month: 1, budget: 100, actual: 25, forecast: 90 },
        { id: "feb", ownerId: "owner-1", year: 2026, month: 2, budget: 100, actual: 50, forecast: 95 },
      ]
      snapshot.data.projects = [
        { id: "project-1", name: "Cloud migration", status: "Planning", risk: "High", pm: "Owner", end: "2026-12-10", watchList: true },
        { id: "project-2", name: "Other project", status: "Completed", risk: "Low", pm: "Other", watchList: false },
      ]
      snapshot.data.hotTopics = [{ id: "review-action", action: "Review action", owner: "owner", status: "open", priority: "normal", due: "2026-10-01", notes: "" }]
      snapshot.data.risks = Array.from({ length: 20 }, (_, index) => ({ id: `risk-${index + 1}`, title: `Review risk ${String(index + 1).padStart(2, "0")}`, status: "open", impact: 4, probability: 4, due: `2026-11-${String(index + 1).padStart(2, "0")}` }))
      return { commit: true, value: undefined }
    })
    const context = await browser.newContext()
    const enrollment = await identity.enroll()
    const page = await context.newPage()
    const login = await page.goto(`${origin}/sucafina/auth/local?code=${enrollment}`)
    expect(login?.ok()).toBe(true)
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    page.on("dialog", (dialog) => dialog.accept())
    const url = `${origin}/sucafina/dashboard?page=OPEX+Detail&year=2026`
    await page.goto(url)
    const month = page.locator('form[data-command="save-entry"][data-record="jan"]')
    const row = page.locator("tr").filter({ has: month })
    await row.getByRole("button", { name: "Edit", exact: true }).click()
    await month.locator("..").locator("summary").click()
    await month.getByLabel("Budget", { exact: true }).fill("123")
    await month.getByLabel("Actual", { exact: true }).fill("34")
    await month.getByLabel("Forecast", { exact: true }).fill("140")

    // A second authenticated request commits while the open editor retains version zero.
    const competing = await context.request.post(url, { headers: { origin }, data: { page: "OPEX Detail", action: "save-entry", id: "jan", version: 0,
      values: { ownerId: "owner-1", year: 2026, month: 1, budget: 110, actual: 30, forecast: 115 } } })
    expect(competing.status()).toBe(200)
    expect(await competing.json()).toMatchObject({ ok: true })
    await month.getByRole("button", { name: "Save month", exact: true }).click()
    await page.getByText("This record changed since you opened it.", { exact: false }).waitFor()
    expect(await month.getByLabel("Budget", { exact: true }).inputValue()).toBe("123")
    expect(await month.getByLabel("Actual", { exact: true }).inputValue()).toBe("34")
    expect(await month.getByLabel("Forecast", { exact: true }).inputValue()).toBe("140")
    expect(await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: rows(snapshot.data.opexEntries).find((item) => item.id === "jan") }))).toMatchObject({ budget: 110, actual: 30, forecast: 115 })
    await month.getByRole("button", { name: "Load current version and keep my edits" }).click()
    await month.getByText("Current record — review before saving your edits", { exact: true }).waitFor()
    expect(await month.locator("[data-current-revision]").textContent()).toContain("budget: 110")
    expect(await month.getByLabel("Budget", { exact: true }).inputValue()).toBe("123")
    expect(await month.getAttribute("data-version")).toBe("1")
    await month.getByRole("button", { name: "Save month", exact: true }).click()
    await month.getByText("Review changes before applying", { exact: true }).waitFor()
    const changes = await month.locator("[data-preview]").textContent()
    expect(changes).toContain("110 → 123")
    expect(changes).toContain("30 → 34")
    expect(changes).toContain("115 → 140")
    await month.getByRole("button", { name: "Confirm and apply" }).click()
    await page.getByRole("dialog", { name: "Edit record", exact: true }).waitFor({ state: "hidden" })
    await page.locator('form[data-command="save-entry"][data-record="jan"][data-version="2"]').waitFor({ state: "attached" })
    expect(new URL(page.url()).searchParams.get("year")).toBe("2026")
    expect(await row.locator("[data-open-editor]:focus").count()).toBe(1)
    const after = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    expect(rows(after.data.opexEntries).find((item) => item.id === "jan")).toMatchObject({ budget: 123, actual: 34, forecast: 140 })
    expect(rows(after.data.opexEntries).find((item) => item.id === "feb")).toEqual({ id: "feb", ownerId: "owner-1", year: 2026, month: 2, budget: 100, actual: 50, forecast: 95 })
    expect(rows(after.data.opexOwners).find((item) => item.id === "owner-2")).toEqual({ id: "owner-2", name: "Other area", budget: 2400 })

    await row.getByRole("button", { name: "Edit", exact: true }).click()
    const deviation = row.locator('form[data-command="save-deviation"]')
    await deviation.locator("..").locator("summary").click()
    await deviation.getByLabel("Deviation notes").fill("Approved renewal shifted the January forecast.")
    await deviation.getByLabel(/^Flag/).selectOption("dev-amber")
    const started = new Promise<void>((resolve) => { delayed.started = resolve })
    delayed.next = true
    await deviation.getByRole("button", { name: "Save deviation", exact: true }).click()
    await started
    const finalNote = "Approved renewal shifted the January forecast. Supplier timing is confirmed."
    await deviation.getByLabel("Deviation notes").fill(finalNote)
    delayed.release?.()
    await page.getByText("The submitted changes were saved. New edits remain unsaved; review them before saving again.", { exact: true }).waitFor()
    expect(await deviation.getByLabel("Deviation notes").inputValue()).toBe(finalNote)
    expect(await deviation.getAttribute("data-dirty")).toBe("true")
    expect(await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: object(snapshot.data.deviations)["opex-owner-1-2026-1"] }))).toEqual({ flag: "dev-amber", text: "Approved renewal shifted the January forecast." })
    await deviation.getByRole("button", { name: "Save deviation", exact: true }).click()
    await deviation.getByRole("button", { name: "Load current version and keep my edits" }).waitFor()
    await deviation.getByRole("button", { name: "Load current version and keep my edits" }).click()
    await deviation.getByText("Current record — review before saving your edits", { exact: true }).waitFor()
    expect(await deviation.getByLabel("Deviation notes").inputValue()).toBe(finalNote)
    await deviation.getByRole("button", { name: "Save deviation", exact: true }).click()
    await page.getByRole("dialog", { name: "Edit record", exact: true }).waitFor({ state: "hidden" })
    await page.locator('form[data-command="save-deviation"][data-record="owner-1"][data-version="2"]').waitFor({ state: "attached" })
    const note = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: object(snapshot.data.deviations)["opex-owner-1-2026-1"] }))
    expect(note).toEqual({ flag: "dev-amber", text: finalNote })
    await page.reload()
    expect(await page.locator('form[data-command="save-entry"][data-record="jan"] input[name="budget"]').inputValue()).toBe("123")
    expect(await page.locator('form[data-command="save-deviation"] input[name="text"]').first().inputValue()).toBe(finalNote)

    await page.goto(`${origin}/sucafina/dashboard?page=Portfolio+Dashboard&year=2026&q=Cloud&filter=watch`)
    await page.getByRole("link", { name: "Cloud migration", exact: true }).first().click()
    const destination = new URL(page.url())
    expect(destination.searchParams.get("page")).toBe("All Projects")
    expect(destination.searchParams.get("q")).toBe("Cloud")
    expect(destination.searchParams.get("filter")).toBe("watch")
    expect(destination.searchParams.get("year")).toBe("2026")
    expect(destination.hash).toBe("#record-project-1")
    await page.locator("#record-project-1").waitFor()
    expect(await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: rows(snapshot.data.projects).map((item) => item.id) }))).toEqual(["project-1", "project-2"])

    await page.goto(url)
    const invalid = page.locator('form[data-command="year-amount"][data-record="owner-1"]')
    await invalid.locator("..").locator("summary").click()
    await invalid.getByLabel("Year amount", { exact: true }).fill("-10")
    await invalid.getByRole("button", { name: "Apply year amount", exact: true }).click()
    await page.getByText("Enter a nonnegative year amount or clear the field.", { exact: true }).waitFor()
    expect(await invalid.getByLabel("Year amount", { exact: true }).inputValue()).toBe("-10")
    expect(await invalid.getAttribute("data-dirty")).toBe("true")
    expect(await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: rows(snapshot.data.opexEntries) }))).toEqual(rows(after.data.opexEntries))
    const risks = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data.risks) }))
    await page.goto(`${origin}/sucafina/dashboard?page=Executive+Dashboard&year=2026&execYear=2026&executiveMonth=11`)
    const signals = page.locator("[data-dashboard-signals]")
    await signals.getByText("Showing 21 of 21 eligible signals", { exact: false }).waitFor()
    expect(await signals.locator("tbody tr").first().textContent()).toContain("Review action")
    await signals.getByRole("button", { name: "Prioritize Review risk 20", exact: true }).click()
    expect(await signals.locator("tbody tr").first().textContent()).toContain("Review risk 20")
    expect(await signals.locator("[data-signal-order]").textContent()).toContain("1 of 21 signals prioritized by you")
    expect(new URL(page.url()).searchParams.getAll("signalPriority")).toEqual(["risks:risk-20"])
    await page.reload()
    await signals.getByRole("button", { name: "Remove priority for Review risk 20", exact: true }).waitFor()
    expect(await signals.locator("tbody tr").first().textContent()).toContain("Review risk 20")
    await signals.locator("tbody tr").first().getByRole("link", { name: "Open record", exact: true }).click()
    expect(new URL(page.url()).searchParams.get("page")).toBe("IT Risks")
    expect(new URL(page.url()).searchParams.get("execYear")).toBe("2026")
    expect(new URL(page.url()).searchParams.get("executiveMonth")).toBe("11")
    expect(new URL(page.url()).hash).toBe("#record-risk-20")
    await page.locator("#record-risk-20").waitFor()
    expect(await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.data.risks }))).toEqual(risks)
    expect(errors).toEqual([])
  } finally {
    delayed.release?.()
    try { await browserDriver.close() }
    finally { await server.stop(true); await driver.dispose(); await rm(directory, { recursive: true, force: true }) }
  }
  browserDriver.report()
}, 60000)
