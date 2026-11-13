import { expect, test } from "bun:test"
import type { Page } from "@playwright/test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomBytes, randomUUID } from "node:crypto"
import { createModule } from "../../../index.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import { decorateSfProductHtml } from "../../../product/interface/html.ts"
import { initialProcurementSettings } from "../../../src/initial-settings.ts"

type SearchPolicy = { role: "admin" | "viewer"; urls: string[]; entryReads: number; downgradeAtRevalidation: boolean }
type SearchFixture = { page: Page; origin: string; policy: SearchPolicy; errors: string[]; store: Awaited<ReturnType<typeof openLocalStore>> }

async function withSearch(role: SearchPolicy["role"], check: (fixture: SearchFixture) => Promise<void>) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-record-search-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const policy: SearchPolicy = { role, urls: [], entryReads: 0, downgradeAtRevalidation: false }
  const state: { handle?: (request: Request) => Promise<Response | undefined> } = {}
  const server = Bun.serve({ hostname: "localhost", port: 0, fetch: async (request) => {
    const url = new URL(request.url)
    if (request.method === "GET" && url.pathname === "/sucafina/dashboard" && !url.searchParams.has("sf")) {
      policy.urls.push(url.href)
      if (policy.downgradeAtRevalidation && !url.searchParams.has("page")) {
        policy.entryReads++
        if (policy.entryReads === 2) policy.role = "viewer"
      }
    }
    return await state.handle?.(request) ?? new Response(null, { status: 503 })
  } })
  const origin = server.url.origin
  const operator = { installationId: randomUUID(), uid: 1000, name: "Search test operator" }
  const identity = createOperatorIdentity({ origin, mount: "/sucafina", operator, secrets: store.secrets, key: randomBytes(32) })
  // Explicit integration-test policy: restrict an already authenticated, durably
  // enrolled principal to viewer. This neither replaces authentication nor proves
  // production role provisioning/native resident execution.
  const authenticate: typeof identity.authenticate = async (request, context) => {
    const principal = await identity.authenticate(request, context)
    if (!principal || !context || policy.role === "admin") return principal
    return { ...principal, canWrite: false, roles: [{ surface: context.surface, role: "viewer" }] }
  }
  const environment = async (request: Request) => ({ at: "2026-11-13T08:00:00Z", id: randomUUID, directory: await identity.directory(request) })
  const app = createModule("/sucafina", { persistence: store, authenticate, environment, productHtml: decorateSfProductHtml, maxJsonBytes: 100000 })
  state.handle = async (request) => await identity.handle(request) ?? await app(request)
  try {
    await store.transaction("dashboard", async (snapshot) => {
      snapshot.data.summaries = ["All Projects"]
      snapshot.data.projects = [
        { id: "project:needle", name: "Migration Needle", status: "In Progress", risk: "Low", budget: 1200, spent: 400, pct: 20, notes: "Editor-only project note", milestones: [] },
        { id: "other-project", name: "Unrelated project", status: "Planning", risk: "Low", budget: 500, spent: 0, pct: 0, milestones: [] },
      ]
      snapshot.data.contracts = [{ id: "private-contract", vendor: "Confidential Needle Supplier", amount: 900, amtType: "Annual", renewType: "Manual", eval: "Pending", renewal: "2027-01-01" }]
      return { commit: true, value: undefined }
    })
    const { chromium } = await import("@playwright/test")
    const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] })
    try {
      const page = await browser.newPage()
      const errors: string[] = []
      page.on("pageerror", (error) => { errors.push(error.message) })
      await page.goto(`${origin}/sucafina/auth/local?code=${await identity.enroll()}`)
      await check({ page, origin, policy, errors, store })
    } finally { await browser.close() }
  } finally {
    await server.stop(true)
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}

test("record search opens an actual authorized project with year, canonical anchor and focus, restores back and clears after logout", async () => {
  await withSearch("admin", async (fixture) => {
    const page = fixture.page
    const original = `${fixture.origin}/sucafina/dashboard?page=IT+Risks&year=2025&opsYear=2026&operationsMonth=3`
    await page.goto(original)
    const before = await fixture.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data.projects) }))
    await page.getByLabel("Record name or value", { exact: true }).fill("Migration Needle")
    await page.getByRole("button", { name: "Find records", exact: true }).click()
    await page.getByText("Open a result to review its current record.", { exact: true }).waitFor()
    const result = page.locator('[data-record-results] a[href*="page=All+Projects"]').filter({ hasText: "Migration Needle" })
    expect(await result.count()).toBe(1)
    const href = await result.getAttribute("href")
    if (!href) throw new Error("search result has no URL")
    const destination = new URL(href)
    expect(destination.origin).toBe(fixture.origin)
    expect(destination.pathname).toBe("/sucafina/dashboard")
    expect(destination.searchParams.get("page")).toBe("All Projects")
    expect(destination.searchParams.get("year")).toBe("2025")
    expect(destination.searchParams.get("opsYear")).toBe("2026")
    expect(destination.searchParams.get("operationsMonth")).toBe("3")
    expect(decodeURIComponent(destination.hash)).toBe("#record-project:needle")
    expect(await result.locator("..").textContent()).toContain("Year 2025")
    expect(await result.textContent()).not.toContain("Editor-only project note")
    await result.click()
    await page.waitForURL((url) => url.searchParams.get("page") === "All Projects" && decodeURIComponent(url.hash) === "#record-project:needle")
    await page.waitForFunction(() => document.activeElement?.querySelector('[id="record-project:needle"]') !== null && document.activeElement?.tagName === "TR")
    expect(await page.locator('select[data-query="year"]').inputValue()).toBe("2025")
    await page.goBack()
    await page.getByText("Open a result to review its current record.", { exact: true }).waitFor()
    expect(new URL(page.url()).searchParams.get("page")).toBe("IT Risks")
    expect(new URL(page.url()).searchParams.get("year")).toBe("2025")
    expect(await page.getByLabel("Record name or value", { exact: true }).inputValue()).toBe("Migration Needle")
    expect(await page.locator('[data-record-results] a[href*="page=All+Projects"]').count()).toBe(1)
    expect(await fixture.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.data.projects }))).toEqual(before)
    expect(await page.evaluate(async () => (await fetch("/sucafina/auth/logout", { method: "POST", credentials: "same-origin" })).status)).toBe(204)
    await page.getByRole("button", { name: "Find records", exact: true }).click()
    await page.getByText("Access changed. Results cleared; reopen the application to continue.", { exact: true }).waitFor()
    expect(await page.locator("[data-record-results] li").count()).toBe(0)
    expect(await page.locator("[data-record-results]").textContent()).not.toContain("Migration Needle")
    expect(fixture.errors).toEqual([])
  })
}, 60_000)

test("record search queries only the real viewer navigation and exposes no title or count for a forbidden collection", async () => {
  await withSearch("viewer", async (fixture) => {
    const page = fixture.page
    await page.goto(`${fixture.origin}/sucafina/dashboard?page=All+Projects&year=2026`)
    expect(await page.locator('.sidebar nav a[href*="Vendor"]').count()).toBe(0)
    fixture.policy.urls.length = 0
    await page.getByLabel("Record name or value", { exact: true }).fill("Needle")
    await page.getByRole("button", { name: "Find records", exact: true }).click()
    await page.getByText("Open a result to review its current record.", { exact: true }).waitFor()
    expect(await page.locator("[data-record-results] li").count()).toBe(1)
    expect(await page.locator("[data-record-results]").textContent()).toContain("Migration Needle")
    expect(await page.locator("body").textContent()).not.toContain("Confidential Needle Supplier")
    expect(fixture.policy.urls.length).toBeGreaterThan(0)
    expect(fixture.policy.urls.every((value) => {
      const url = new URL(value)
      return [null, "Executive Dashboard", "All Projects"].includes(url.searchParams.get("page")) && !url.searchParams.has("download") && !url.searchParams.has("state")
    })).toBe(true)
    expect((await page.request.get(`${fixture.origin}/sucafina/dashboard?page=Vendor+Contracts`)).status()).toBe(403)
    await page.getByLabel("Record name or value", { exact: true }).fill("Confidential Needle Supplier")
    await page.getByRole("button", { name: "Find records", exact: true }).click()
    await page.getByText("No matching records were found in the available pages.", { exact: true }).waitFor()
    expect(await page.locator("[data-record-results] li").count()).toBe(0)
    expect(fixture.errors).toEqual([])
  })
}, 60_000)

test("a role reduction during final search revalidation clears earlier authorized results even without an access revision header", async () => {
  await withSearch("admin", async (fixture) => {
    const page = fixture.page
    await page.goto(`${fixture.origin}/sucafina/dashboard?page=IT+Risks&year=2026`)
    fixture.policy.entryReads = 0
    fixture.policy.downgradeAtRevalidation = true
    await page.getByLabel("Record name or value", { exact: true }).fill("Needle")
    await page.getByRole("button", { name: "Find records", exact: true }).click()
    await page.getByText("Access changed. Results cleared; reopen the application to continue.", { exact: true }).waitFor()
    expect(fixture.policy.entryReads).toBe(2)
    expect(fixture.policy.role).toBe("viewer")
    expect(await page.locator("[data-record-results] li").count()).toBe(0)
    expect(await page.locator("[data-record-results]").textContent()).not.toContain("Confidential Needle Supplier")
    expect(await page.locator("[data-record-results]").textContent()).not.toContain("Migration Needle")
    expect((await page.request.get(`${fixture.origin}/sucafina/dashboard?page=Vendor+Contracts`)).status()).toBe(403)
    expect(fixture.errors).toEqual([])
  })
}, 60_000)

test("Planner record search pins the effective default plan from authorized HTML when the starting URL omits version", async () => {
  await withSearch("admin", async (fixture) => {
    await fixture.store.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [
        { id: "default-plan", name: "Operating baseline", year: 2027, closed: 0, lines: [{ id: "renewal-line", name: "Renewal Needle", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(100), f: [] }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} },
        { id: "alternative-plan", name: "Alternative plan", year: 2027, closed: 0, lines: [{ id: "other-line", name: "Different line", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(200), f: [] }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} },
      ]
      return { commit: true, value: undefined }
    })
    const page = fixture.page
    await page.goto(`${fixture.origin}/sucafina/planner?page=Overview&year=2027`)
    expect(new URL(page.url()).searchParams.has("version")).toBe(false)
    expect(await page.locator('select[name="version"]').inputValue()).toBe("default-plan")
    await page.getByLabel("Record name or value", { exact: true }).fill("Renewal Needle")
    await page.getByRole("button", { name: "Find records", exact: true }).click()
    await page.getByText("Open a result to review its current record.", { exact: true }).waitFor()
    const result = page.locator('[data-record-results] a[href*="page=OPEX"]').filter({ hasText: "Renewal Needle" })
    expect(await result.count()).toBe(1)
    const href = await result.getAttribute("href")
    if (!href) throw new Error("Planner result has no URL")
    const destination = new URL(href)
    expect(destination.pathname).toBe("/sucafina/planner")
    expect(destination.searchParams.get("version")).toBe("default-plan")
    expect(destination.searchParams.get("year")).toBe("2027")
    expect(destination.hash).toBe("#record-renewal-line")
    expect(await result.locator("..").textContent()).toContain("Plan Operating baseline")
    await result.click()
    await page.waitForURL((url) => url.searchParams.get("page") === "OPEX" && url.searchParams.get("version") === "default-plan")
    expect(await page.locator('select[name="version"]').inputValue()).toBe("default-plan")
    await page.waitForFunction(() => document.activeElement?.tagName === "TR" && !!document.activeElement.querySelector('form[data-record="renewal-line"]'))
    expect(fixture.errors).toEqual([])
  })
}, 60_000)

test("Procurement search opens the actual request and supplier details through their canonical selectors", async () => {
  await withSearch("admin", async (fixture) => {
    await fixture.store.transaction("procurement", async (snapshot) => {
      snapshot.data.store = {
        settings: initialProcurementSettings(),
        suppliers: [{ id: "supplier-needle", number: "SUP-00042", status: "active", legalName: "Needle Supply", contacts: [], categories: [], history: [] }],
        requests: { "PR-2026-0042": { version: 1, by: "fixture-seed", request: { number: "PR-2026-0042", status: "draft", createdBy: "fixture-seed", pr: { title: "Needle Requisition", description: "Replacement licenses", estAmount: 150, expenseType: "OPEX" }, history: [] } } },
        issued: { pr: ["PR-2026-0042"], po: [] }, sup: ["SUP-00042"], actCalls: 0, lastIssued: null,
      }
      return { commit: true, value: undefined }
    })
    const page = fixture.page
    const before = await fixture.store.transaction("procurement", async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data.store) }))
    await page.goto(`${fixture.origin}/sucafina/procurement?page=Dashboard&year=2026`)
    await page.getByLabel("Record name or value", { exact: true }).fill("Needle")
    await page.getByRole("button", { name: "Find records", exact: true }).click()
    await page.getByText("Open a result to review its current record.", { exact: true }).waitFor()
    const request = page.locator('[data-record-results] a[href*="request=PR-2026-0042"]')
    const supplier = page.locator('[data-record-results] a[href*="supplier=supplier-needle"]')
    expect(await request.count()).toBe(1)
    expect(await supplier.count()).toBe(1)
    expect(await request.textContent()).toContain("Needle Requisition")
    expect(await supplier.textContent()).toContain("Needle Supply")
    for (const [result, expectedPage] of [[request, "Requests"], [supplier, "Suppliers"]] as const) {
      const href = await result.getAttribute("href")
      if (!href) throw new Error("Procurement result has no URL")
      const destination = new URL(href)
      expect(destination.origin).toBe(fixture.origin)
      expect(destination.pathname).toBe("/sucafina/procurement")
      expect(destination.searchParams.get("page")).toBe(expectedPage)
      expect(destination.searchParams.get("year")).toBe("2026")
      expect(destination.searchParams.has("download")).toBe(false)
    }
    await request.click()
    await page.waitForURL((url) => url.searchParams.get("request") === "PR-2026-0042")
    await page.locator('details[id="PR-2026-0042"][open]').waitFor()
    await page.waitForFunction(() => document.activeElement?.id === "PR-2026-0042")
    await page.goBack()
    await page.getByText("Open a result to review its current record.", { exact: true }).waitFor()
    await page.locator('[data-record-results] a[href*="supplier=supplier-needle"]').click()
    await page.waitForURL((url) => url.searchParams.get("supplier") === "supplier-needle")
    await page.locator('details[id="supplier-supplier-needle"][open]').waitFor()
    await page.waitForFunction(() => document.activeElement?.id === "supplier-supplier-needle")
    expect(await fixture.store.transaction("procurement", async (snapshot) => ({ commit: false, value: snapshot.data.store }))).toEqual(before)
    expect(fixture.errors).toEqual([])
  })
}, 60_000)
