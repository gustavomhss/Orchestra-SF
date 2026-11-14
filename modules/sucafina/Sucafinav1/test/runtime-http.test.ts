import { expect, test } from "bun:test"
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

test("HTTP request boundaries retain host routes and apply HTML cache/CSP policy", async () => {
  const app = fixture()
  expect(await app.handler(new Request("https://installation.example/api/session"))).toBeUndefined()
  const response = await app.handler(new Request("https://installation.example/sucafina/dashboard?page=IT%20Risks"))
  expect(response?.status).toBe(200)
  expect(response?.headers.get("cache-control")).toBe("no-store")
  expect(response?.headers.get("content-security-policy")).toContain("script-src 'sha256-")
  const html = await response?.text()
  expect(html).toContain('data-command="save"')
  expect(html).not.toContain("JSON editor")
  const head = await app.handler(
    new Request("https://installation.example/sucafina/dashboard?page=IT%20Risks", { method: "HEAD" }),
  )
  expect(await head?.text()).toBe("")
  app.identity.principal = null
  expect(
    (await app.handler(new Request("https://installation.example/sucafina/dashboard?page=IT%20Risks")))?.status,
  ).toBe(401)
})

test("Chrome submits a real form and preserves unsaved edits after blur until reload", async () => {
  const { chromium } = await import("@playwright/test")
  const app = fixture()
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => (await app.handler(request)) ?? new Response("Not found", { status: 404 }),
  })
  console.info("browser phase: launching Chrome")
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--no-sandbox"],
  })
  console.info("browser phase: Chrome launched")
  const page = await browser.newPage()
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  try {
    await page.goto(
      `http://127.0.0.1:${server.port}/sucafina/dashboard?page=IT%20Risks&year=2026&opsYear=2024&execYear=2027`,
    )
    console.info("browser phase: page loaded")
    const form = page.locator('form[data-command="save"]').last()
    await page.getByText("Add risk", { exact: true }).click()
    await form.locator('[name="name"]').fill("Browser risk")
    await form.locator('[name="impact"]').selectOption("3")
    await form.locator('[name="probability"]').selectOption("2")
    await form.locator('button[type="submit"]').click()
    await page.waitForFunction(
      () => document.querySelector('form[data-command="save"][data-record="record-1"]') !== null,
    )
    console.info("browser phase: risk committed")
    expect(app.state.dashboard.data.risks).toMatchObject([{ name: "Browser risk", impact: 3, probability: 2 }])
    const savedForm = page.locator('form[data-record="record-1"][data-command="save"]')
    await page.locator("details").filter({ has: savedForm }).locator("summary").click()
    const cell = savedForm.locator('[name="name"]')
    await cell.fill("Unsaved typing")
    await cell.focus()
    const response = await app.post({ name: "Remote edit", impact: 4, probability: 2 }, "record-1", 1)
    expect(response?.status).toBe(200)
    await page.evaluate(async () => {
      await (window as unknown as { sucafinaRefresh: () => Promise<void> }).sucafinaRefresh()
    })
    expect(await cell.inputValue()).toBe("Unsaved typing")
    await cell.blur()
    await page.evaluate(async () => {
      await (window as unknown as { sucafinaRefresh: () => Promise<void> }).sucafinaRefresh()
    })
    expect(await cell.inputValue()).toBe("Unsaved typing")
    expect(await savedForm.getAttribute("data-version")).toBe("1")
    await page.reload()
    expect(await cell.inputValue()).toBe("Remote edit")
    expect(await savedForm.getAttribute("data-version")).toBe("2")
    console.info("browser phase: dirty edit protection and explicit reload verified")
    const configuration = page.locator('form[data-command="configure-summaries"]')
    await page.locator("details").filter({ has: configuration }).locator("summary").click()
    await configuration.locator('input[value="IT Risks"]').check()
    const savedConfiguration = page.waitForResponse((response) => response.request().method() === "POST")
    await configuration.locator('button[type="submit"]').click()
    expect((await savedConfiguration).status()).toBe(200)
    await page.waitForFunction(
      () => document.querySelector<HTMLElement>('form[data-command="configure-summaries"]')?.dataset.version === "1",
    )
    console.info("browser phase: configuration refresh committed")
    expect(app.state.dashboard.data.summaries).toEqual(["IT Risks"])
    expect(await page.locator('form[method="get"] input[name="opsYear"]').first().inputValue()).toBe("2024")
    await page.locator('select[data-year="sidebar"]').selectOption("2025")
    await page.waitForURL((url) => url.searchParams.get("year") === "2025")
    expect(new URL(page.url()).searchParams.get("opsYear")).toBe("2024")
    expect(new URL(page.url()).searchParams.get("execYear")).toBe("2027")
    console.info("browser phase: year navigation verified")
    expect(errors).toEqual([])
    await mkdir(join(process.cwd(), "../../test-ci-evidence"), {
      recursive: true,
    })
    await page.screenshot({
      path: join(process.cwd(), "../../test-ci-evidence/sucafina-risks.png"),
      fullPage: true,
    })
    console.info("browser phase: screenshot saved")
  } finally {
    server.stop(true)
    console.info("browser phase: closing Chrome")
    await browser.close()
  }
}, 45000)
