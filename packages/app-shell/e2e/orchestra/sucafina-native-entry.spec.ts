import { base64Encode } from "@orchestra/core/util/encode"
import { expect, test, type Page } from "@playwright/test"
import { mockOrchestraServer } from "../utils/mock-server"

const foreignOrigin = "http://foreign.invalid:4111"
const appPath = "/orchestra/sucafina/dashboard"
const projectedRecord = "Native entry projected record"
const fixtureStatus = {
  configured: true,
  authentication: "local-operator",
  authenticated: true,
  enrollmentRequired: false,
  surfaces: ["dashboard"],
  hostAuthenticated: true,
  principal: { id: "native-fixture-operator", name: "Native Fixture Operator" },
  sessionScope: "a".repeat(64),
}

test.use({ serviceWorkers: "block" })

test.beforeEach(async ({}, testInfo) => {
  expect(testInfo.config.metadata.bundle).toBe("production")
  expect(process.env.VITE_ORCHESTRA_SF_NATIVE).toBe("1")
})

async function prepare(page: Page, baseURL: string, options: { configured?: boolean; holdStatus?: boolean; holdLogout?: boolean; noProjects?: boolean } = {}) {
  const origin = new URL(baseURL).origin
  const observed: { url: string; method: string; resourceType: string; authorization?: string; referer?: string }[] = []
  page.on("request", (request) => {
    observed.push({ url: request.url(), method: request.method(), resourceType: request.resourceType(), authorization: request.headers()["authorization"], referer: request.headers()["referer"] })
  })
  let releaseStatus: (() => void) | undefined
  let releaseLogout: (() => void) | undefined
  const statusHeld = new Promise<void>((resolve) => { releaseStatus = resolve })
  const logoutHeld = new Promise<void>((resolve) => { releaseLogout = resolve })
  const hostileServer = JSON.stringify({
    default: foreignOrigin,
    list: [{ type: "http", http: { url: foreignOrigin, username: "foreign-user", password: "foreign-password" }, authToken: true }],
    profiles: [{ url: foreignOrigin, username: "foreign-user", password: "foreign-password", authToken: "foreign-token" }],
  })
  const hostileDefault = foreignOrigin

  await mockOrchestraServer(page, {
    directory: "/native-entry-project",
    project: { id: "native-entry-project", name: "Unselected project", worktree: "/native-entry-project", sandboxes: [], time: { created: 1, updated: 1 } },
    provider: { all: [], connected: [], default: {} },
    sessions: [],
    pageMessages: () => ({ items: [] }),
  })
  if (options.noProjects) await page.route((url) => url.origin === origin && (url.pathname === "/api/project" || url.pathname === "/project"), (route) => route.fulfill({ status: 200, contentType: "application/json", json: [] }))
  await page.route(`${foreignOrigin}/**`, (route) => route.abort())
  await page.route((url) => url.origin === origin && url.pathname.startsWith("/api/sucafina/"), async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === "GET" && url.pathname === "/api/sucafina/status") {
      if (options.holdStatus) await statusHeld
      return route.fulfill({ status: 200, contentType: "application/json", json: options.configured === false
        ? { ...fixtureStatus, configured: false, authentication: "unconfigured", authenticated: false, hostAuthenticated: false, principal: undefined, sessionScope: undefined, surfaces: [] }
        : fixtureStatus })
    }
    if (request.method() === "GET" && url.pathname === "/api/sucafina/dashboard/state")
      return route.fulfill({ status: 200, contentType: "application/json", json: {
        surface: "dashboard", page: "IT Risks", pages: ["IT Risks"],
        actor: { id: fixtureStatus.principal.id, name: fixtureStatus.principal.name, canWrite: false, roles: [], assigned: [], domains: [] },
        year: 2026, month: 3, data: { risks: [{ id: "native-risk-1", name: projectedRecord, status: "open" }] }, versions: {}, directory: [],
      } })
    if (request.method() === "POST" && url.pathname === "/api/sucafina/auth/logout") {
      if (options.holdLogout) await logoutHeld
      return route.fulfill({ status: 503, contentType: "application/json", json: { error: "fixture logout failure" } })
    }
    return route.fallback()
  })
  await page.addInitScript(({ hostileServer, hostileDefault }) => {
    localStorage.setItem("language.v1", JSON.stringify({ locale: "en" }))
    localStorage.setItem("orchestra.global.dat:server", hostileServer)
    localStorage.setItem("orchestra.settings.dat:defaultServerUrl", hostileDefault)
    localStorage.setItem("orchestra.global.dat:language", JSON.stringify({ locale: "en" }))
  }, { hostileServer, hostileDefault })
  return {
    get requests() { return observed.filter((request) => ["fetch", "xhr", "eventsource", "websocket"].includes(request.resourceType) || new URL(request.url).origin !== origin) },
    releaseStatus: () => releaseStatus?.(),
    releaseLogout: () => releaseLogout?.(),
    hostileServer,
    hostileDefault,
  }
}

test("unconfigured native status shows setup and does not start Host or business APIs", async ({ page, baseURL }) => {
  const fixture = await prepare(page, baseURL!, { configured: false })
  await page.goto(appPath)
  await expect(page.getByText("This installation is not ready yet.", { exact: true })).toBeVisible()
  const layout = await page.evaluate(() => ({
    html: document.documentElement.getAttribute("data-new-layout"),
    body: document.body.getAttribute("data-new-layout"),
    lineToken: getComputedStyle(document.body).getPropertyValue("--mx-line").trim(),
  }))
  expect(layout.html).not.toBeNull()
  expect(layout.body).not.toBeNull()
  expect(layout.lineToken).not.toBe("")
  await expect.poll(() => fixture.requests.map((request) => new URL(request.url).pathname)).toContain("/api/sucafina/status")
  expect(fixture.requests.every((request) => new URL(request.url).origin === new URL(baseURL!).origin && new URL(request.url).pathname === "/api/sucafina/status")).toBe(true)
  expect(fixture.requests.some((request) => /\/(?:api\/)?(?:provider|project|location)(?:\/|$)/.test(new URL(request.url).pathname))).toBe(false)
})

test("a pending public status keeps Host and native business APIs behind the gate", async ({ page, baseURL }) => {
  const fixture = await prepare(page, baseURL!, { holdStatus: true })
  await page.goto(appPath)
  await expect.poll(() => fixture.requests.some((request) => new URL(request.url).pathname === "/api/sucafina/status")).toBe(true)
  expect(fixture.requests.every((request) => new URL(request.url).origin === new URL(baseURL!).origin && new URL(request.url).pathname === "/api/sucafina/status")).toBe(true)
  expect(fixture.requests.some((request) => new URL(request.url).pathname.endsWith("/state"))).toBe(false)
  fixture.releaseStatus()
  await expect(page.getByText(projectedRecord, { exact: true }).first()).toBeVisible()
})

test("a verified native entry reads projected data only from its own origin and preserves hostile profile bytes", async ({ page, baseURL }) => {
  const fixture = await prepare(page, baseURL!)
  await page.goto(appPath)
  await expect(page.getByText(projectedRecord, { exact: true }).first()).toBeVisible()
  const persisted = await page.evaluate(() => ({
    server: localStorage.getItem("orchestra.global.dat:server"),
    defaultServer: localStorage.getItem("orchestra.settings.dat:defaultServerUrl"),
  }))
  expect(persisted).toEqual({ server: fixture.hostileServer, defaultServer: fixture.hostileDefault })
  expect(fixture.requests.map((request) => new URL(request.url).origin)).toEqual(expect.arrayContaining([new URL(page.url()).origin]))
  expect(fixture.requests.every((request) => new URL(request.url).origin === new URL(page.url()).origin)).toBe(true)
  expect(fixture.requests.some((request) => request.url.includes("foreign.invalid"))).toBe(false)
})

test("a legacy auth_token URL is removed before native API dispatch and never becomes Authorization", async ({ page, baseURL }) => {
  const fixture = await prepare(page, baseURL!)
  const legacyToken = Buffer.from("legacy-fixture-user:legacy-fixture-password").toString("base64")
  await page.goto(`${appPath}?${new URLSearchParams({ auth_token: legacyToken })}`)
  await expect(page.getByText(projectedRecord, { exact: true }).first()).toBeVisible()
  expect(new URL(page.url()).searchParams.has("auth_token")).toBe(false)
  expect(fixture.requests.every((request) => request.authorization === undefined)).toBe(true)
  const status = fixture.requests.find((request) => new URL(request.url).pathname === "/api/sucafina/status")
  expect(status?.referer).toBeDefined()
  expect(fixture.requests.every((request) => !new URL(request.url).searchParams.has("auth_token") && (!request.referer || !new URL(request.referer).searchParams.has("auth_token")))).toBe(true)
})

test("an explicit foreign ServerKey route returns to the native entry without probing that server", async ({ page, baseURL }) => {
  const fixture = await prepare(page, baseURL!)
  const key = base64Encode(foreignOrigin)
  await page.goto(`/server/${key}/session/00000000-0000-4000-8000-000000000001`)
  await expect(page).toHaveURL(new URL("/", baseURL!).href)
  expect(fixture.requests.some((request) => new URL(request.url).origin === foreignOrigin)).toBe(false)
  expect(fixture.requests.some((request) => request.url.includes("foreign.invalid"))).toBe(false)
})

test("the Sucafina menu opens its server-wide native page without selecting a project", async ({ page, baseURL }) => {
  const fixture = await prepare(page, baseURL!, { noProjects: true })
  const projects = page.waitForResponse((response) => new URL(response.url()).origin === new URL(baseURL!).origin && new URL(response.url()).pathname === "/api/project")
  await page.goto("/")
  expect(await (await projects).json()).toEqual([])
  await expect(page.locator('[data-component="orchestra-sidebar"]')).toBeVisible()
  await expect(page.locator("#orchestra-profile-name")).toHaveText("Choose a project")
  await page.getByRole("button", { name: "Sucafina", exact: true }).click()
  await expect(page).toHaveURL(/\/orchestra\/sucafina(?:\/|$)/)
  await expect(page.getByText(projectedRecord, { exact: true }).first()).toBeVisible()
  await expect(page.locator("#orchestra-profile-name")).toHaveText("Choose a project")
  expect(fixture.requests.every((request) => new URL(request.url).origin === new URL(page.url()).origin)).toBe(true)
})

test("native sign out clears the private view before the logout response settles", async ({ page, baseURL }) => {
  const fixture = await prepare(page, baseURL!, { holdLogout: true })
  await page.goto(appPath)
  await expect(page.getByText(projectedRecord, { exact: true }).first()).toBeVisible()
  await expect(page.locator('[data-component="orchestra-sidebar"]')).toBeVisible()
  await page.getByRole("button", { name: "Sign out", exact: true }).click()
  await expect(page.locator('[data-component="orchestra-sidebar"]')).toHaveCount(0)
  await expect(page.getByText(projectedRecord, { exact: true })).toHaveCount(0)
  expect(fixture.requests.some((request) => new URL(request.url).pathname === "/api/sucafina/auth/logout" && request.method === "POST")).toBe(true)
  await expect(page.locator('[data-sf-view-group="dashboard-portfolio"]')).toHaveCount(0)
  await expect(page.locator('[data-component="orchestra-sidebar"]')).toHaveCount(0)
  const statusCount = fixture.requests.filter((request) => new URL(request.url).pathname === "/api/sucafina/status").length
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  expect(fixture.requests.filter((request) => new URL(request.url).pathname === "/api/sucafina/status")).toHaveLength(statusCount)
  const logoutResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/sucafina/auth/logout")
  fixture.releaseLogout()
  expect((await logoutResponse).status()).toBe(503)
  await expect(page.getByRole("alert")).toBeVisible()
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await page.waitForTimeout(500)
  expect(fixture.requests.filter((request) => new URL(request.url).pathname === "/api/sucafina/status")).toHaveLength(statusCount)
  await expect(page.getByText(projectedRecord, { exact: true })).toHaveCount(0)
  await expect(page.locator('[data-sf-view-group="dashboard-portfolio"]')).toHaveCount(0)
  await expect(page.locator('[data-component="orchestra-sidebar"]')).toHaveCount(0)
})
