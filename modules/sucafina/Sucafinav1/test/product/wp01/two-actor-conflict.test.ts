import { afterAll, beforeAll, expect, test } from "bun:test"
import type { Browser, BrowserContext, Page } from "@playwright/test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomBytes, randomUUID } from "node:crypto"
import { createModule } from "../../../index.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { object } from "../../../runtime/contract.ts"
import { closeWp01Browser, launchWp01Browser } from "./browser-fixture.ts"

let browser: Browser
beforeAll(async () => { browser = await launchWp01Browser() }, 35_000)
afterAll(async () => { if (browser) await closeWp01Browser(browser) }, 25_000)

async function openDeviation(page: Page) {
  const month = page.locator('form[data-command="save-entry"][data-record="jan"]')
  await page.locator("tr").filter({ has: month }).getByRole("button", { name: "Edit", exact: true }).click()
  const form = page.locator('form[data-command="save-deviation"][data-record="owner-1"]').first()
  await form.locator("..").locator("summary").click()
  return form
}

// Each cookie comes from the production enrollment handler and is checked by
// its production authenticator over encrypted SQLite sessions. Installing that
// issued cookie keeps two local operators on the same real application mount.
async function enrollContext(identity: ReturnType<typeof createOperatorIdentity>, context: BrowserContext, origin: string) {
  const response = await identity.handle(new Request(`${origin}/sucafina/auth/local?code=${await identity.enroll()}`))
  expect(response?.status).toBe(303)
  const cookie = response!.headers.get("set-cookie")!.split(";")[0]!
  const separator = cookie.indexOf("=")
  expect(separator).toBeGreaterThan(0)
  await context.addCookies([{ name: cookie.slice(0, separator), value: cookie.slice(separator + 1), domain: new URL(origin).hostname, path: "/sucafina", httpOnly: true, sameSite: "Lax" }])
}

test("two authenticated principals preserve the losing draft and reconcile a real version conflict only after explicit review", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "wp01-two-actor-conflict-"))
  await chmod(directory, 0o700)
  const driver = await openLocalStore(directory)
  const persistence = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID })
  const routing: { handle?: (request: Request) => Promise<Response | undefined> } = {}
  const server = Bun.serve({ hostname: "localhost", port: 0, fetch: async (request) => await routing.handle?.(request) ?? new Response(null, { status: 503 }) })
  const origin = server.url.origin
  const installationId = randomUUID()
  const first = createOperatorIdentity({ origin, mount: "/sucafina", operator: { installationId, uid: 1001, name: "First reviewer" }, secrets: driver.secrets, key: randomBytes(32) })
  const second = createOperatorIdentity({ origin, mount: "/sucafina", operator: { installationId, uid: 1002, name: "Second reviewer" }, secrets: driver.secrets, key: randomBytes(32) })
  const firstId = `macos:${installationId}:1001`
  const secondId = `macos:${installationId}:1002`
  const authenticate: typeof first.authenticate = async (request, context) => await first.authenticate(request, context) ?? await second.authenticate(request, context)
  const app = createModule("/sucafina", { persistence, authenticate,
    environment: async (request) => ({ at: "2026-11-13T08:00:00Z", id: randomUUID, directory: [...await first.directory(request), ...await second.directory(request)] }), maxJsonBytes: 100000 })
  const writes: { principal: string | undefined; version: unknown; status: number; text: unknown }[] = []
  routing.handle = async (request) => {
    const command = request.method === "POST" ? object(await request.clone().json()) : {}
    const principal = command.action === "save-deviation" ? await first.person(request) ?? await second.person(request) : undefined
    const response = await app(request)
    if (command.action === "save-deviation" && response) writes.push({ principal: principal?.id, version: command.version, status: response.status, text: object(command.values).text })
    return response
  }
  const contexts: BrowserContext[] = []
  try {
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.opexOwners = [{ id: "owner-1", name: "Operations", budget: 1200 }]
      snapshot.data.opexEntries = [{ id: "jan", ownerId: "owner-1", year: 2026, month: 1, budget: 100, actual: 25, forecast: 90 }]
      return { commit: true, value: undefined }
    })
    const firstContext = await browser.newContext()
    contexts.push(firstContext)
    const secondContext = await browser.newContext()
    contexts.push(secondContext)
    await enrollContext(first, firstContext, origin)
    await enrollContext(second, secondContext, origin)
    const firstPage = await firstContext.newPage()
    const secondPage = await secondContext.newPage()
    const errors: string[] = []
    for (const page of [firstPage, secondPage]) {
      page.setDefaultTimeout(10_000)
      page.on("pageerror", (error) => errors.push(error.message))
      page.on("dialog", (dialog) => dialog.accept())
    }
    const url = `${origin}/sucafina/dashboard?page=OPEX+Detail&year=2026`
    expect((await firstPage.goto(url))?.status()).toBe(200)
    expect((await secondPage.goto(url))?.status()).toBe(200)
    const firstForm = await openDeviation(firstPage)
    const secondForm = await openDeviation(secondPage)
    expect(await firstForm.getAttribute("data-version")).toBe("0")
    expect(await secondForm.getAttribute("data-version")).toBe("0")
    const firstText = "January forecast reviewed by the first operator."
    const secondText = "The second operator still needs supplier timing confirmed."
    await firstForm.getByLabel("Deviation notes").fill(firstText)
    await firstForm.getByLabel(/^Flag/).selectOption("dev-green")
    await secondForm.getByLabel("Deviation notes").fill(secondText)
    await secondForm.getByLabel(/^Flag/).selectOption("dev-amber")

    const firstSaved = firstPage.waitForResponse((response) => response.request().method() === "POST" && response.url() === url)
    await firstForm.getByRole("button", { name: "Save deviation", exact: true }).click()
    expect((await firstSaved).status()).toBe(200)
    await firstPage.getByRole("dialog", { name: "Edit record", exact: true }).waitFor({ state: "hidden" })
    const record = "deviations:opex-owner-1-2026-1"
    const afterFirst = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    expect(afterFirst.versions[record]).toEqual({ version: 1, by: firstId })
    expect(object(afterFirst.data.deviations)["opex-owner-1-2026-1"]).toEqual({ flag: "dev-green", text: firstText })

    const conflict = secondPage.waitForResponse((response) => response.request().method() === "POST" && response.url() === url)
    await secondForm.getByRole("button", { name: "Save deviation", exact: true }).click()
    const rejected = await conflict
    expect(rejected.status()).toBe(409)
    expect(await rejected.json()).toMatchObject({ ok: false, by: firstId, stored: { flag: "dev-green", text: firstText } })
    await secondPage.getByText("This record changed since you opened it.", { exact: false }).waitFor()
    const conflictText = await secondPage.locator("dialog[open] [data-editor-status]").textContent()
    expect(conflictText).toContain(firstText)
    expect(conflictText).toContain(secondText)
    expect(await secondForm.getByLabel("Deviation notes").inputValue()).toBe(secondText)
    expect(await secondForm.getByLabel(/^Flag/).inputValue()).toBe("dev-amber")
    expect(await secondForm.getAttribute("data-version")).toBe("0")
    expect(await secondForm.getAttribute("data-dirty")).toBe("true")
    expect(await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.audit.length }))).toBe(afterFirst.audit.length)

    await secondForm.getByRole("button", { name: "Load current version and keep my edits", exact: true }).click()
    await secondForm.getByText("Current record — review before saving your edits", { exact: true }).waitFor()
    expect(await secondForm.locator("[data-current-revision]").textContent()).toContain(firstText)
    expect(await secondForm.locator("[data-current-revision]").textContent()).toContain("dev-green")
    expect(await secondForm.getByLabel("Deviation notes").inputValue()).toBe(secondText)
    expect(await secondForm.getByLabel(/^Flag/).inputValue()).toBe("dev-amber")
    expect(await secondForm.getAttribute("data-version")).toBe("1")
    expect(writes).toEqual([
      { principal: firstId, version: 0, status: 200, text: firstText },
      { principal: secondId, version: 0, status: 409, text: secondText },
    ])
    expect(await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.audit.length }))).toBe(afterFirst.audit.length)

    const reviewedSave = secondPage.waitForResponse((response) => response.request().method() === "POST" && response.url() === url)
    await secondForm.getByRole("button", { name: "Save deviation", exact: true }).click()
    expect((await reviewedSave).status()).toBe(200)
    await secondPage.getByRole("dialog", { name: "Edit record", exact: true }).waitFor({ state: "hidden" })
    const final = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    expect(final.versions[record]).toEqual({ version: 2, by: secondId })
    expect(object(final.data.deviations)["opex-owner-1-2026-1"]).toEqual({ flag: "dev-amber", text: secondText })
    const history = final.audit.filter((entry) => entry.record === record)
    expect(history).toHaveLength(2)
    expect(history.map((entry) => ({ who: entry.who, name: entry.name }))).toEqual([{ who: firstId, name: "First reviewer" }, { who: secondId, name: "Second reviewer" }])
    expect(history[1]?.was).toEqual({ flag: "dev-green", text: firstText })
    expect(history[1]?.became).toEqual({ flag: "dev-amber", text: secondText })
    expect(writes).toHaveLength(3)
    expect(writes[2]).toEqual({ principal: secondId, version: 1, status: 200, text: secondText })
    expect(errors).toEqual([])
  } finally {
    const closed = await Promise.allSettled(contexts.map((context) => context.close()))
    await server.stop(true)
    await driver.dispose()
    await rm(directory, { recursive: true, force: true })
    const failed = closed.filter((result): result is PromiseRejectedResult => result.status === "rejected")
    if (failed.length) throw new AggregateError(failed.map((result) => result.reason), "Two-actor browser contexts did not close")
  }
}, 60_000)
