import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { object, rows } from "../runtime/contract.ts"
import { createApplication } from "../runtime/application.ts"
import { domain, pages, render } from "../runtime/dashboard-portfolio.ts"
import type { ResolvedActor } from "../src/identity.ts"
import { empty, testPersistence } from "./fixture/persistence.ts"
import { join } from "node:path"
import { mkdir } from "node:fs/promises"

function fixture() {
  const storage = testPersistence()
  const identity: { principal: ResolvedActor | null } = {
    principal: {
      id: "admin",
      canWrite: true,
      roles: [{ surface: "dashboard", role: "admin" }],
    },
  }
  const count = { id: 0 }
  const handler = createApplication("/sucafina", {
    authenticate: async () => identity.principal,
    persistence: storage.persistence,
    environment: async () => ({
      at: "2026-11-11T12:00:00Z",
      id: () => `record-${++count.id}`,
      directory: [{ id: "admin", name: "Admin from directory" }],
    }),
    domains: {
      dashboard: [{ pages, domain, render }],
      planner: [],
      procurement: [],
    },
    maxJsonBytes: 100000,
  })
  const post = (values: Record<string, unknown>, id?: string, version = 0, extra: Record<string, unknown> = {}) =>
    handler(
      new Request("https://installation.example/sucafina/dashboard?page=IT%20Risks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://installation.example",
        },
        body: JSON.stringify({
          page: "IT Risks",
          action: "save",
          id,
          version,
          values,
          ...extra,
        }),
      }),
    )
  return { ...storage, identity, handler, post }
}

test("HTTP commits the actual risk, version and audit together; concurrent stale writes do not overwrite", async () => {
  const app = fixture()
  const created = await app.post({
    name: "Infrastructure",
    impact: 6,
    probability: 1,
  })
  expect(created?.status).toBe(200)
  expect(app.state.dashboard.data.risks).toMatchObject([{ id: "record-1", impact: 6 }])
  expect(app.state.dashboard.versions["risks:record-1"]).toEqual({
    version: 1,
    by: "admin",
  })
  expect(app.state.dashboard.audit).toHaveLength(1)
  const result = await Promise.all([
    app.post({ name: "First", impact: 2, probability: 1 }, "record-1", 1),
    app.post({ name: "Second", impact: 3, probability: 1 }, "record-1", 1),
  ])
  expect(result.map((response) => response?.status).sort()).toEqual([200, 409])
  expect(app.state.dashboard.audit).toHaveLength(2)
  expect(app.state.dashboard.versions["risks:record-1"].version).toBe(2)
  const stale = result.find((response) => response?.status === 409)
  expect(await stale?.json()).toMatchObject({
    ok: false,
    by: "admin",
    stored: { name: "First" },
  })
})

test("HTTP write checks current identity, rejects spoofed actors and cross-origin requests, and rolls back storage failure", async () => {
  const app = fixture()
  app.identity.principal = {
    id: "viewer",
    canWrite: false,
    roles: [{ surface: "dashboard", role: "viewer" }],
  }
  app.state.dashboard.data.summaries = ["IT Risks"]
  const before = structuredClone(app.state)
  expect((await app.post({ name: "Refused" }))?.status).toBe(403)
  expect(app.state).toEqual(before)
  app.identity.principal = {
    id: "admin",
    canWrite: true,
    roles: [{ surface: "dashboard", role: "admin" }],
  }
  expect(
    (
      await app.post({ name: "Spoof" }, undefined, 0, {
        actor: { roles: ["admin"] },
      })
    )?.status,
  ).toBe(400)
  const crossed = await app.handler(
    new Request("https://installation.example/sucafina/dashboard", {
      method: "POST",
      headers: {
        Origin: "https://attacker.example",
        "Content-Type": "application/json",
      },
      body: "{}",
    }),
  )
  expect(crossed?.status).toBe(403)
  expect(app.state).toEqual(before)
  app.fail.beforeCommit = true
  await expect(app.post({ name: "Must roll back", impact: 3, probability: 2 })).rejects.toThrow(
    "Injected commit failure",
  )
  expect(app.state).toEqual(before)
})

test("HTTP request boundaries retain host routes and retire console HTML GET/HEAD", async () => {
  const app = fixture()
  expect(await app.handler(new Request("https://installation.example/api/session"))).toBeUndefined()
  const response = await app.handler(new Request("https://installation.example/sucafina/dashboard?page=IT%20Risks"))
  expect(response?.status).toBe(404)
  expect(response?.headers.get("cache-control")).toBe("no-store")
  expect(response?.headers.get("content-type")).toContain("text/plain")
  expect(await response?.text()).toBe("legacy console decommissioned — use /")
  const head = await app.handler(
    new Request("https://installation.example/sucafina/dashboard?page=IT%20Risks", { method: "HEAD" }),
  )
  expect(head?.status).toBe(404)
  expect(await head?.text()).toBe("")
  for (const surface of ["planner", "procurement"])
    expect((await app.handler(new Request(`https://installation.example/sucafina/${surface}`)))?.status).toBe(404)
  app.identity.principal = null
  // Export is still an authorized data operation, not an HTML route.
  expect((await app.handler(new Request("https://installation.example/sucafina/dashboard?download=json")))?.status).toBe(401)
})

test("Chrome submits a real form and preserves unsaved edits after blur until reload", async () => {
  expectSpawn(import.meta.path)
  const started = performance.now()
  const phase = (stage: string) => console.info("SF_NATIVE_RUNTIME_STAGE",
    JSON.stringify({ stage, elapsedMs: Math.round(performance.now() - started) }))
  phase("build native fixture")
  const [{ createNativeDashboardFixture }, { launchBrowserDriver }] = await Promise.all([
    import("./product/wp02/native-browser-fixture.ts"),
    import("./product/wp02/browser-driver-fixture.ts"),
  ])
  const native = await createNativeDashboardFixture()
  phase("launch native browser")
  const browserDriver = await launchBrowserDriver("wp05-renderer").catch(async (error) => {
    await native.close()
    throw error
  })
  try {
    const context = await browserDriver.browser.newContext()
    await context.addCookies([native.cookie])
    const page = await context.newPage()
    const errors: string[] = []
    const writes: unknown[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    page.on("dialog", (dialog) => dialog.accept())
    page.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname === "/sucafina/dashboard")
        writes.push(request.postDataJSON())
    })
    const riskPage = native.origin + "/orchestra/sf-operations/risks"
    phase("open real risk page")
    expect((await page.goto(riskPage))?.ok()).toBe(true)
    phase("open new risk editor")
    await page.getByRole("button", { name: "New risk", exact: true }).click()
    const editor = page.locator("form.sf-u30-editor")
    const cell = editor.getByLabel("Risk description", { exact: true })
    await cell.fill("Browser risk")
    await editor.getByLabel("Impact", { exact: true }).selectOption("3")
    await editor.getByLabel("Probability", { exact: true }).selectOption("2")
    await editor.getByLabel("Status", { exact: true }).selectOption("open")
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    phase("submit reviewed risk")
    const created = page.waitForResponse((response) => response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/sucafina/dashboard")
    await page.getByRole("button", { name: "Save", exact: true }).click()
    expect((await created).status()).toBe(200)
    const stored = await native.persistence.transaction("dashboard", async (snapshot) => ({ commit: false,
      value: { rows: rows(snapshot.data.risks), versions: { ...snapshot.versions } } }))
    expect(stored.rows).toMatchObject([{ name: "Browser risk", impact: 3, probability: 2 }])
    const riskId = stored.rows[0]?.id
    if (typeof riskId !== "string" || !riskId) throw new Error("The original risk command did not return a stored record")
    expect(stored.versions["risks:" + riskId]?.version).toBe(1)
    const edit = page.locator('tr[data-sf-row="' + riskId + '"] button[data-sf-action="edit"]')
    phase("edit persisted risk")
    await edit.click()
    const filters = page.locator(".sf-u30-filters")
    await filters.getByLabel("Status", { exact: true }).selectOption("open")
    await cell.fill("Unsaved typing")
    await cell.focus()
    // A competing command uses the same actual encrypted session and HTTP
    // producer, outside the browser editor's retained draft and CAS.
    const remote = await context.request.post(native.origin + "/sucafina/dashboard?page=IT%20Risks", {
      headers: { origin: native.origin },
      data: { page: "IT Risks", action: "save", id: riskId, version: 1,
        values: { name: "Remote edit", impact: 4, probability: 2, status: "open" } },
    })
    expect(remote.status()).toBe(200)
    phase("observe remote edit while focused")
    const focusedRead = page.waitForResponse((response) => new URL(response.url()).pathname === "/sucafina/api/ui/pages/CAP13" &&
      new URL(response.url()).searchParams.get("status") === "open")
    // Dispatch the existing public control without moving focus out of the
    // editor. No private window hook or fabricated producer response is used.
    await filters.getByRole("button", { name: "Apply filters", exact: true }).dispatchEvent("click")
    const focused = await focusedRead
    expect(focused.status()).toBe(200)
    expect(object(object(await focused.json()).value).versions).toMatchObject({ ["risks:" + riskId]: 2 })
    expect(await cell.inputValue()).toBe("Unsaved typing")
    phase("observe remote edit after blur")
    await cell.blur()
    await filters.getByLabel("Status", { exact: true }).selectOption("")
    const blurredRead = page.waitForResponse((response) => new URL(response.url()).pathname === "/sucafina/api/ui/pages/CAP13" &&
      new URL(response.url()).searchParams.get("status") !== "open")
    await filters.getByRole("button", { name: "Apply filters", exact: true }).click()
    expect((await blurredRead).status()).toBe(200)
    expect(await cell.inputValue()).toBe("Unsaved typing")
    phase("reject stale review")
    // The native controller retains CAS 1 despite seeing source version 2.
    // Attempting the reviewed save must block before dispatch, not adopt CAS 2.
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await page.getByText("Review the current source before continuing.", { exact: true }).waitFor()
    expect(await cell.inputValue()).toBe("Unsaved typing")
    expect(writes).toHaveLength(1)
    expect(await native.persistence.transaction("dashboard", async (snapshot) => ({ commit: false,
      value: snapshot.versions["risks:" + riskId]?.version }))).toBe(2)
    phase("reload and confirm current CAS")
    const reloadRead = page.waitForResponse((response) => new URL(response.url()).pathname === "/sucafina/api/ui/pages/CAP13")
    await page.reload()
    const reloaded = await reloadRead
    expect(reloaded.status()).toBe(200)
    expect(object(object(await reloaded.json()).value).versions).toMatchObject({ ["risks:" + riskId]: 2 })
    await edit.click()
    expect(await cell.inputValue()).toBe("Remote edit")
    // Verify that the fresh editor really binds the restored source's CAS 2.
    await editor.getByRole("button", { name: "Review changes", exact: true }).click()
    phase("submit fresh reviewed CAS")
    const freshSave = page.waitForResponse((response) => response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/sucafina/dashboard")
    const freshRead = page.waitForResponse((response) => response.request().method() === "GET" &&
      new URL(response.url()).pathname === "/sucafina/api/ui/pages/CAP13")
    await page.getByRole("button", { name: "Save", exact: true }).click()
    const fresh = await freshSave
    expect(fresh.status()).toBe(200)
    expect(fresh.request().postDataJSON()).toMatchObject({ page: "IT Risks", action: "save", id: riskId, version: 2,
      values: { name: "Remote edit", impact: "4", probability: "2" } })
    const confirmed = await freshRead
    expect(confirmed.status()).toBe(200)
    expect(object(object(await confirmed.json()).value).versions).toMatchObject({ ["risks:" + riskId]: 3 })
    await editor.waitFor({ state: "hidden" })
    await page.locator('tr[data-sf-row="' + riskId + '"]').getByText("Remote edit", { exact: true }).waitFor()
    await mkdir(join(process.cwd(), "../../test-ci-evidence"), { recursive: true })
    await page.screenshot({ path: join(process.cwd(), "../../test-ci-evidence/sucafina-risks.png"), fullPage: true })

    // Preserve the original checkbox → submit → refreshed configuration UI
    // guarantee on its admitted native administration surface.
    phase("configure summaries")
    expect((await page.goto(native.origin + "/orchestra/sf-home/administration"))?.ok()).toBe(true)
    const configuration = page.locator("form[data-sf-summary-form]")
    await configuration.getByLabel("IT Risks", { exact: true }).check()
    await configuration.getByRole("button", { name: "Review changes", exact: true }).click()
    const savedConfiguration = page.waitForResponse((response) => response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/sucafina/api/ui/local-admin/configure-summaries")
    await page.getByRole("button", { name: "Save summaries", exact: true }).click()
    expect((await savedConfiguration).status()).toBe(200)
    await page.waitForFunction(() => document.querySelector<HTMLElement>("form[data-sf-summary-form]")?.dataset.version === "1")
    expect(await native.persistence.transaction("dashboard", async (snapshot) => ({ commit: false,
      value: snapshot.data.summaries }))).toEqual(["IT Risks"])

    // Native F01 gives each surface its own canonical year. Exercise the
    // producer's execYear/opsYear mappings and browser history, rather than
    // forwarding the decommissioned console's global selectors to CAP03.
    const yearField = page.getByRole("combobox", { name: "Year", exact: true })
    const period = async (path: string, capability: "CAP01" | "CAP03" | "CAP11",
      query: "execYear" | "year" | "opsYear", year: number, action?: "back" | "reload") => {
      phase("verify period " + capability + " " + year + " " + (action ?? "navigate"))
      const result = page.waitForResponse((response) => {
        const url = new URL(response.url())
        return url.pathname === "/sucafina/api/ui/pages/" + capability && url.searchParams.get(query) === String(year)
      })
      if (action === "back") await page.goBack()
      else if (action === "reload") await page.reload()
      else expect((await page.goto(native.origin + path))?.ok()).toBe(true)
      const response = await result
      expect(response.status()).toBe(200)
      expect(object(object(await response.json()).value).selection).toMatchObject({ year })
      await yearField.waitFor()
      expect(await yearField.inputValue()).toBe(String(year))
      const url = new URL(page.url())
      expect(url.pathname).toBe(path.split("?")[0]!)
      expect(url.searchParams.get("year")).toBe(String(year))
      expect(url.searchParams.has("opsYear")).toBe(false)
      expect(url.searchParams.has("execYear")).toBe(false)
    }
    await period("/orchestra/sf-dashboard/executive?year=2027", "CAP01", "execYear", 2027)
    await period("/orchestra/sf-operations/service?year=2024", "CAP11", "opsYear", 2024)
    await period("/orchestra/sf-dashboard/budget?year=2026", "CAP03", "year", 2026)
    phase("change budget year")
    const changedPeriod = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return url.pathname === "/sucafina/api/ui/pages/CAP03" && url.searchParams.get("year") === "2025"
    })
    await yearField.selectOption("2025")
    await page.waitForURL((url) => url.pathname === "/orchestra/sf-dashboard/budget" && url.searchParams.get("year") === "2025")
    const changed = await changedPeriod
    expect(changed.status()).toBe(200)
    expect(object(object(await changed.json()).value).selection).toMatchObject({ year: 2025 })
    expect(await yearField.inputValue()).toBe("2025")
    await period("/orchestra/sf-dashboard/budget?year=2025", "CAP03", "year", 2025, "reload")
    await period("/orchestra/sf-dashboard/budget?year=2026", "CAP03", "year", 2026, "back")
    await period("/orchestra/sf-operations/service?year=2024", "CAP11", "opsYear", 2024, "back")
    await period("/orchestra/sf-dashboard/executive?year=2027", "CAP01", "execYear", 2027, "back")
    expect(errors).toEqual([])
  } finally {
    phase("close owned browser")
    try { await browserDriver.close() } finally { await native.close() }
  }
}, 45000)
