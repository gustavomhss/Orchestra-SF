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
import { object, rows } from "../../../runtime/contract.ts"
import { closeWp01Browser, launchWp01Browser } from "./browser-fixture.ts"

type Fault = {
  action?: string
  mode?: "lose-before" | "lose-after" | "hold-after" | "body-timeout"
  used: boolean
  started?: () => void
  release?: () => void
  denied?: 401 | 403
  posts: { action: string; body: string }[]
}
type Fixture = {
  page: Page
  context: BrowserContext
  origin: string
  url: string
  fault: Fault
  persistence: ReturnType<typeof createSfSourcePersistence>
  errors: string[]
}

let browser: Browser
beforeAll(async () => { browser = await launchWp01Browser() }, 35_000)
afterAll(async () => { if (browser) await closeWp01Browser(browser) }, 25_000)

// The domain, authentication, HTTP handlers and SQLite remain real. Faults affect
// only delivery, after the actual transaction or before it reaches the handler.
async function withWorkbench(check: (fixture: Fixture) => Promise<void>) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "wp01-shell-recovery-"))
  await chmod(directory, 0o700)
  const driver = await openLocalStore(directory)
  const persistence = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID })
  const fault: Fault = { used: false, posts: [] }
  const routing: { handle?: (request: Request) => Promise<Response | undefined> } = {}
  const server = Bun.serve({ hostname: "localhost", port: 0, fetch: async (request) => await routing.handle?.(request) ?? new Response(null, { status: 503 }) })
  const origin = server.url.origin
  const identity = createOperatorIdentity({ origin, mount: "/sucafina", operator: { installationId: randomUUID(), uid: 1000, name: "Shell recovery operator" }, secrets: driver.secrets, key: randomBytes(32) })
  const authenticate: typeof identity.authenticate = async (request, context) => {
    const actor = await identity.authenticate(request, context)
    if (!actor || fault.denied === 401) return null
    if (context && fault.denied === 403) return { ...actor, canWrite: false, roles: [{ surface: context.surface, role: "viewer" }] }
    return actor
  }
  const app = createModule("/sucafina", { persistence, authenticate,
    environment: async (request) => ({ at: "2026-11-13T08:00:00Z", id: randomUUID, directory: await identity.directory(request) }), maxJsonBytes: 100000 })
  routing.handle = async (request) => {
    const body = request.method === "POST" && new URL(request.url).pathname === "/sucafina/dashboard" ? await request.clone().text() : ""
    const command = body ? object(JSON.parse(body)) : {}
    const action = typeof command.action === "string" ? command.action : ""
    if (action) fault.posts.push({ action, body })
    const selected = !fault.used && action === fault.action
    if (selected && fault.mode === "lose-before") {
      fault.used = true
      return new Response("{", { headers: { "Content-Type": "application/json" } })
    }
    const response = await identity.handle(request) ?? await app(request)
    if (!selected || !response?.ok) return response
    fault.used = true
    if (fault.mode === "hold-after") await new Promise<void>((resolve) => { fault.release = resolve; fault.started?.() })
    if (fault.mode === "lose-after") return new Response("{", { headers: { "Content-Type": "application/json" } })
    if (fault.mode === "body-timeout") return new Response(new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode('{"ok":')) } }), { headers: { "Content-Type": "application/json" } })
    return response
  }
  let context: BrowserContext | undefined
  const errors: string[] = []
  try {
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.opexOwners = [{ id: "owner-1", name: "Operations", budget: 1200 }]
      snapshot.data.opexEntries = [{ id: "jan", ownerId: "owner-1", year: 2026, month: 1, budget: 100, actual: 25, forecast: 90 }]
      return { commit: true, value: undefined }
    })
    context = await browser.newContext()
    const page = await context.newPage()
    page.setDefaultTimeout(10_000)
    page.on("pageerror", (error) => errors.push(error.message))
    page.on("dialog", (dialog) => dialog.accept())
    const login = await page.goto(`${origin}/sucafina/auth/local?code=${await identity.enroll()}`)
    expect(login?.status()).toBe(200)
    const url = `${origin}/sucafina/dashboard?page=OPEX+Detail&year=2026`
    await page.goto(url)
    await check({ page, context, origin, url, fault, persistence, errors })
    expect(errors).toEqual([])
  } finally {
    fault.release?.()
    await context?.close()
    await server.stop(true)
    await driver.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}

async function openMonthly(page: Page) {
  const form = page.locator('form[data-command="save-entry"][data-record="jan"]')
  await page.locator("tr").filter({ has: form }).getByRole("button", { name: "Edit", exact: true }).click()
  await form.locator("..").locator("summary").click()
  return form
}

async function openDeviation(page: Page) {
  await openMonthly(page)
  const form = page.locator('form[data-command="save-deviation"][data-record="owner-1"]').first()
  await form.locator("..").locator("summary").click()
  return form
}

async function prepareMonthly(page: Page) {
  const form = await openMonthly(page)
  await form.getByLabel("Budget", { exact: true }).fill("123")
  await form.getByLabel("Actual", { exact: true }).fill("34")
  await form.getByLabel("Forecast", { exact: true }).fill("140")
  await form.getByRole("button", { name: "Save month", exact: true }).click()
  await form.getByText("Review changes before applying", { exact: true }).waitFor()
  return form
}

async function assertOneMonthlyEffect(fixture: Fixture, auditLength?: number) {
  const saved = await fixture.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
  expect(rows(saved.data.opexEntries)).toEqual([{ id: "jan", ownerId: "owner-1", year: 2026, month: 1, budget: 123, actual: 34, forecast: 140 }])
  expect(saved.versions["opexEntries:jan"]?.version).toBe(1)
  if (auditLength !== undefined) expect(saved.audit.length).toBe(auditLength)
  return saved.audit.length
}

test("a real generic save with lost delivery stays unknown, preserves edits and never resends without a receipt", async () => {
  await withWorkbench(async (fixture) => {
    const form = await openDeviation(fixture.page)
    await form.getByLabel("Deviation notes").fill("PRIVATE-ORIGINAL-ATTEMPT")
    fixture.fault.action = "save-deviation"
    fixture.fault.mode = "lose-after"
    await form.getByRole("button", { name: "Save deviation", exact: true }).click()
    await fixture.page.getByText("The save response was lost or could not be verified.", { exact: false }).waitFor()
    const after = await fixture.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    expect(object(after.data.deviations)["opex-owner-1-2026-1"]).toMatchObject({ text: "PRIVATE-ORIGINAL-ATTEMPT" })
    expect(await form.getAttribute("data-result-uncertain")).toBe("true")
    await form.getByLabel("Deviation notes").fill("PRIVATE-LATER-DRAFT")
    await form.getByRole("button", { name: "Save deviation", exact: true }).click()
    await fixture.page.getByText("The earlier save is still unconfirmed.", { exact: false }).waitFor()
    expect(fixture.fault.posts.filter((entry) => entry.action === "save-deviation")).toHaveLength(1)
    const version = await form.getAttribute("data-version")
    await form.getByRole("button", { name: "Inspect current record without resending" }).click()
    await form.getByText("Current record — the earlier save remains unconfirmed", { exact: true }).waitFor()
    expect(await form.locator("[data-current-revision]").textContent()).toContain("PRIVATE-ORIGINAL-ATTEMPT")
    expect(await form.getByLabel("Deviation notes").inputValue()).toBe("PRIVATE-LATER-DRAFT")
    expect(await form.getAttribute("data-version")).toBe(version)
    expect(fixture.fault.posts.filter((entry) => entry.action === "save-deviation")).toHaveLength(1)
    expect(await fixture.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.audit.length }))).toBe(after.audit.length)
    expect(await fixture.page.evaluate(() => JSON.stringify(history.state))).not.toContain("PRIVATE-")
    expect(await fixture.page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0)
  })
}, 45_000)

test.each([401, 403] as const)("a real generic POST refused with %i removes protected drafts and has no effect", async (status) => {
  await withWorkbench(async (fixture) => {
    const form = await openDeviation(fixture.page)
    await form.getByLabel("Deviation notes").fill("PRIVATE-DENIED-DRAFT")
    fixture.fault.denied = status
    await form.getByRole("button", { name: "Save deviation", exact: true }).click()
    await fixture.page.locator("main[data-access-unavailable]").waitFor()
    expect(await fixture.page.locator("form, input, dialog").count()).toBe(0)
    expect(await fixture.page.content()).not.toContain("PRIVATE-DENIED-DRAFT")
    expect(await fixture.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: object(snapshot.data.deviations) }))).toEqual({})
    expect(await fixture.page.evaluate(() => history.state)).toBeNull()
  })
}, 45_000)

test("a duplicate submit is fenced and a late successful response cannot restore a revoked page", async () => {
  await withWorkbench(async (fixture) => {
    const form = await openDeviation(fixture.page)
    await form.getByLabel("Deviation notes").fill("PRIVATE-DELAYED-SAVE")
    fixture.fault.action = "save-deviation"
    fixture.fault.mode = "hold-after"
    const started = new Promise<void>((resolve) => { fixture.fault.started = resolve })
    await form.getByRole("button", { name: "Save deviation", exact: true }).click()
    await started
    await form.dispatchEvent("submit")
    expect(fixture.fault.posts.filter((entry) => entry.action === "save-deviation")).toHaveLength(1)
    expect((await fixture.context.request.post(`${fixture.origin}/sucafina/auth/logout`, { headers: { origin: fixture.origin } })).status()).toBe(204)
    await fixture.page.evaluate(() => (window as unknown as { sucafinaRefresh: () => Promise<void> }).sucafinaRefresh())
    await fixture.page.getByRole("heading", { name: "Your session has expired" }).waitFor()
    fixture.fault.release?.()
    expect(await fixture.page.locator("form, dialog").count()).toBe(0)
    expect(await fixture.page.content()).not.toContain("PRIVATE-DELAYED-SAVE")
    expect(await fixture.page.locator("body").textContent()).not.toContain("Saved.")
    expect(fixture.fault.posts.filter((entry) => entry.action === "save-deviation")).toHaveLength(1)
  })
}, 45_000)

test("loading a current version after a real conflict revalidates access before showing any stored fields", async () => {
  await withWorkbench(async (fixture) => {
    const form = await openDeviation(fixture.page)
    await form.getByLabel("Deviation notes").fill("PRIVATE-CONFLICT-DRAFT")
    const competing = await fixture.context.request.post(fixture.url, { headers: { origin: fixture.origin }, data: {
      page: "OPEX Detail", action: "save-deviation", id: "owner-1", version: 0, values: { year: 2026, month: 1, flag: "", text: "PRIVATE-OTHER-REVISION" },
    } })
    expect(competing.status()).toBe(200)
    await form.getByRole("button", { name: "Save deviation", exact: true }).click()
    await form.getByRole("button", { name: "Load current version and keep my edits" }).waitFor()
    fixture.fault.denied = 403
    await form.getByRole("button", { name: "Load current version and keep my edits" }).click()
    await fixture.page.getByRole("heading", { name: "Your access has changed" }).waitFor()
    expect(await fixture.page.locator("form, dialog, [data-current-revision]").count()).toBe(0)
    expect(await fixture.page.content()).not.toContain("PRIVATE-")
  })
}, 45_000)

test("the deadline covers a partial response body after a real generic commit", async () => {
  await withWorkbench(async (fixture) => {
    const form = await openDeviation(fixture.page)
    await form.getByLabel("Deviation notes").fill("Confirmed only in the domain")
    fixture.fault.action = "save-deviation"
    fixture.fault.mode = "body-timeout"
    const started = performance.now()
    await form.getByRole("button", { name: "Save deviation", exact: true }).click()
    await fixture.page.getByText("The save response was lost or could not be verified.", { exact: false }).waitFor({ timeout: 15_000 })
    expect(performance.now() - started).toBeGreaterThanOrEqual(9_000)
    expect(await form.getByLabel("Deviation notes").inputValue()).toBe("Confirmed only in the domain")
    expect(await form.getAttribute("data-result-uncertain")).toBe("true")
    expect(fixture.fault.posts.filter((entry) => entry.action === "save-deviation")).toHaveLength(1)
    expect(await fixture.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: object(snapshot.data.deviations)["opex-owner-1-2026-1"] }))).toMatchObject({ text: "Confirmed only in the domain" })
  })
}, 45_000)

test("a lost preview-apply acknowledgement is recovered by its real receipt without a second mutation", async () => {
  await withWorkbench(async (fixture) => {
    const form = await prepareMonthly(fixture.page)
    fixture.fault.action = "apply-preview"
    fixture.fault.mode = "lose-after"
    await form.getByRole("button", { name: "Confirm and apply" }).click()
    await form.getByRole("button", { name: "Check saved outcome" }).waitFor()
    const auditLength = await assertOneMonthlyEffect(fixture)
    await form.getByLabel("Budget", { exact: true }).fill("222")
    await form.getByRole("button", { name: "Check saved outcome" }).click()
    await fixture.page.getByText("The reviewed changes were saved. New edits remain unsaved; review them before applying.", { exact: true }).waitFor()
    expect(await form.getByLabel("Budget", { exact: true }).inputValue()).toBe("222")
    expect(await form.getAttribute("data-dirty")).toBe("true")
    expect(await form.getAttribute("data-result-uncertain")).toBeNull()
    expect(fixture.fault.posts.filter((entry) => entry.action === "apply-preview")).toHaveLength(1)
    expect(fixture.fault.posts.filter((entry) => entry.action === "read-preview")).toHaveLength(1)
    await assertOneMonthlyEffect(fixture, auditLength)
  })
}, 45_000)

test("a preview application not delivered to the domain requires inspection then an explicit exact retry", async () => {
  await withWorkbench(async (fixture) => {
    const form = await prepareMonthly(fixture.page)
    fixture.fault.action = "apply-preview"
    fixture.fault.mode = "lose-before"
    await form.getByRole("button", { name: "Confirm and apply" }).click()
    await form.getByRole("button", { name: "Check saved outcome" }).waitFor()
    expect(await fixture.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: rows(snapshot.data.opexEntries)[0]?.budget }))).toBe(100)
    await form.getByRole("button", { name: "Check saved outcome" }).click()
    await form.getByRole("button", { name: "Retry reviewed application" }).waitFor()
    expect(fixture.fault.posts.filter((entry) => entry.action === "apply-preview")).toHaveLength(1)
    await form.getByRole("button", { name: "Retry reviewed application" }).click()
    await fixture.page.getByRole("dialog", { name: "Edit record", exact: true }).waitFor({ state: "hidden" })
    const requests = fixture.fault.posts.filter((entry) => entry.action === "apply-preview")
    expect(requests).toHaveLength(2)
    expect(requests[1]?.body).toBe(requests[0]?.body)
    await assertOneMonthlyEffect(fixture)
  })
}, 45_000)

test("reload resumes the authorized saved preview without storing financial drafts or applying it automatically", async () => {
  await withWorkbench(async (fixture) => {
    await prepareMonthly(fixture.page)
    const refs = await fixture.page.evaluate(() => history.state.sfCommandPreviews as Record<string, unknown>[])
    expect(refs).toHaveLength(1)
    expect(Object.keys(refs[0]!).sort()).toEqual(["action", "context", "page", "record", "ref", "uncertain", "url"])
    expect(refs[0]?.uncertain).toBe(false)
    await fixture.page.reload()
    const form = fixture.page.locator('form[data-command="save-entry"][data-record="jan"]')
    await form.getByText("A saved preview was recovered.", { exact: false }).waitFor()
    expect(await form.getByLabel("Budget", { exact: true }).inputValue()).toBe("100")
    expect(await form.locator("[data-preview]").textContent()).toContain("100 → 123")
    expect(fixture.fault.posts.filter((entry) => entry.action === "preview-change")).toHaveLength(1)
    expect(fixture.fault.posts.filter((entry) => entry.action === "apply-preview")).toHaveLength(0)
    await form.getByRole("button", { name: "Confirm and apply" }).click()
    await fixture.page.getByRole("dialog", { name: "Edit record", exact: true }).waitFor({ state: "hidden" })
    await assertOneMonthlyEffect(fixture)
    expect(await fixture.page.evaluate(() => history.state.sfCommandPreviews)).toEqual([])
  })
}, 45_000)

test("reload recovers a lost committed preview response from the receipt and never sends apply again", async () => {
  await withWorkbench(async (fixture) => {
    const form = await prepareMonthly(fixture.page)
    fixture.fault.action = "apply-preview"
    fixture.fault.mode = "lose-after"
    await form.getByRole("button", { name: "Confirm and apply" }).click()
    await form.getByRole("button", { name: "Check saved outcome" }).waitFor()
    const auditLength = await assertOneMonthlyEffect(fixture)
    await fixture.page.reload()
    await fixture.page.getByText("The earlier reviewed change was saved. Its original result has been recovered.", { exact: true }).waitFor()
    expect(fixture.fault.posts.filter((entry) => entry.action === "apply-preview")).toHaveLength(1)
    expect(fixture.fault.posts.filter((entry) => entry.action === "read-preview")).toHaveLength(1)
    expect(await fixture.page.evaluate(() => history.state.sfCommandPreviews)).toEqual([])
    await assertOneMonthlyEffect(fixture, auditLength)
  })
}, 45_000)
