import { expect, test } from "bun:test"
import type { BrowserContext, Page, Request as BrowserRequest } from "@playwright/test"
import { expectSpawn } from "../../../../../packages/core/test/fixture/omni-expect.ts"
import { launchBrowserDriver } from "../product/wp02/browser-driver-fixture.ts"
import { buildNativeTeamsWeb } from "./native-web-build.ts"
import { nativeTeamWebFixture } from "./native-web-fixture.ts"
import { profileA, profileB, teamRow } from "./installation-fixture.ts"
import { authority, group, oid } from "../microsoft-login/oidc-fixture.ts"

test("native Web composition retains the live host identity through anonymous F02 admission", async () => {
  const f = await nativeTeamWebFixture()
  try {
    const response = await f.handle(new Request(f.contextRequest().url))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ status: "unauthenticated" })
    expect(response.headers.get("cache-control")).toBe("no-store")
  } finally { await f.close() }
})

// Focused G02 production Web composition, outside the fixed 40-source G04 pool.
// The OAuth provider is synthetic; challenge/PKCE/JWKS/session/SQLite/HTTP/UI are real.
test("native SF Web admits Microsoft Teams, isolates windows, fences drafts and administers without a Team", async () => {
  expectSpawn(import.meta.path)
  let built: Awaited<ReturnType<typeof buildNativeTeamsWeb>> | undefined
  let f: Awaited<ReturnType<typeof nativeTeamWebFixture>> | undefined
  let admin: Awaited<ReturnType<typeof nativeTeamWebFixture>> | undefined
  let driver: Awaited<ReturnType<typeof launchBrowserDriver>> | undefined
  const contexts: BrowserContext[] = [], errors: string[] = []
  const observed: { fixture: "business" | "admin"; path: string; method: string; cookie: boolean; basic: boolean; selector: string | null; status: number }[] = []
  let passed = false, phase = "build", holdLogout = false
  const logoutEntered = Promise.withResolvers<void>(), logoutRelease = Promise.withResolvers<void>(), logoutHandled = Promise.withResolvers<void>()
  try {
    built = await buildNativeTeamsWeb()
    f = await nativeTeamWebFixture({ enabled: [profileA, profileB], direct: [profileA, profileB] })
    await f.seedPlannerVersion()
    admin = await nativeTeamWebFixture({ roles: false, grants: [], enabled: [], direct: [] })
    admin.provider.teamResources.set(profileA.teamObjectId, teamRow())
    admin.provider.hooks.before = (request) => new URL(request.url).pathname === "/v1.0/me/joinedTeams"
      ? Response.json({ error: { code: "ServiceUnavailable" } }, { status: 503 }) : undefined
    driver = await launchBrowserDriver("teams-web-transport")
    const open = async (fixture: NonNullable<typeof f>, name: "business" | "admin") => {
      const browser = await driver!.browser.newContext({ locale: "en-US", viewport: { width: 1360, height: 900 } })
      browser.setDefaultTimeout(7000)
      contexts.push(browser)
      browser.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)))
      await browser.route("**/*", async (route) => {
        const wire = route.request(), url = new URL(wire.url())
        if (url.href.startsWith(authority + "/oauth2/v2.0/authorize?")) {
          const code = await fixture.provider.issueCode(url.href, oid)
          const callback = new URL(url.searchParams.get("redirect_uri")!)
          callback.searchParams.set("code", code)
          callback.searchParams.set("state", url.searchParams.get("state")!)
          await route.fulfill({ status: 303, headers: { Location: callback.href, "Cache-Control": "no-store" } })
          return
        }
        if (url.origin !== fixture.binding.origin) { await route.abort(); return }
        const headers = await wire.allHeaders(), bytes = wire.postDataBuffer(), abort = new AbortController()
        const failed = (request: BrowserRequest) => { if (request === wire) abort.abort() }
        browser.on("requestfailed", failed)
        try {
          const request = new Request(wire.url(), { method: wire.method(), headers, signal: abort.signal,
            ...(["GET", "HEAD"].includes(wire.method()) ? {} : { body: bytes === null ? undefined : new Uint8Array(bytes).buffer }) })
          if (name === "business" && holdLogout && url.pathname === fixture.binding.mount + "/auth/logout") {
            logoutEntered.resolve(); await logoutRelease.promise
          }
          const response = url.pathname.startsWith(fixture.binding.mount + "/") || url.pathname.startsWith("/api/")
            ? await fixture.handle(request) : await built!.asset(request) ?? new Response(null, { status: 404 })
          observed.push({ fixture: name, path: url.pathname, method: request.method,
            cookie: request.headers.has("cookie"), basic: request.headers.has("authorization"),
            selector: request.headers.get("x-sf-team-profile"), status: response.status })
          if (name === "business" && url.pathname === fixture.binding.mount + "/auth/logout") logoutHandled.resolve()
          const outgoing = Object.fromEntries(response.headers)
          const cookies = response.headers.getSetCookie()
          if (cookies.length) outgoing["set-cookie"] = cookies.join("\n")
          if (!abort.signal.aborted) await route.fulfill({ status: response.status, headers: outgoing,
            body: Buffer.from(await response.arrayBuffer()) })
        } catch (error) {
          // A cancelled original browser request has no recipient for a late reply.
          if (!abort.signal.aborted) throw error
        } finally { browser.off("requestfailed", failed) }
      })
      const page = await browser.newPage()
      await page.goto(fixture.binding.origin + "/", { waitUntil: "domcontentloaded" })
      return { browser, page }
    }
    const waitState = (page: Page, state: string) => page.waitForFunction((expected) =>
      document.querySelector("[data-sf-teams-shell]")?.getAttribute("data-sf-teams-state") === expected, state)
    const waitTeam = (page: Page, id: string) => page.waitForFunction((expected) =>
      document.querySelector("[data-sf-teams-shell]")?.getAttribute("data-sf-team-selected") === expected, id)
    const picker = (page: Page) => page.locator(".sf-team-picker-wide [data-sf-team-picker]")
    const signIn = async (page: Page) => {
      await waitState(page, "unauthenticated")
      const link = page.locator("[data-sf-microsoft-login]")
      expect(await link.getAttribute("href")).toBe(f!.binding.origin + f!.binding.mount + "/auth/login?returnTo=%2F")
      expect(await link.getAttribute("target")).toBe("_self")
      await link.click()
      await waitState(page, "authenticated")
      expect(new URL(page.url()).pathname).toBe("/")
    }

    phase = "business-bootstrap"
    const human = await open(f, "business")
    await waitState(human.page, "unauthenticated")
    expect(observed.some((call) => call.path === "/api/sucafina/installations" && call.status === 200 && !call.basic)).toBe(true)
    expect(f.metadataCalls.locations).toBe(0)
    phase = "microsoft-login"
    await signIn(human.page)
    const session = (await human.browser.cookies()).find((cookie) => cookie.name.includes("_session"))
    expect(session).toMatchObject({ httpOnly: true, secure: true, path: f.binding.mount, sameSite: "Lax" })
    expect(await human.page.evaluate(() => document.cookie)).not.toContain("_session")
    expect(await picker(human.page).inputValue()).toBe("")
    expect(await picker(human.page).locator("option").allTextContents()).toEqual([
      "Select a Team",
      "Synthetic shared Team · " + profileA.teamObjectId,
      "Synthetic shared Team · " + profileB.teamObjectId,
    ])
    phase = "selection-and-history"
    await picker(human.page).selectOption(profileA.teamObjectId)
    await waitTeam(human.page, profileA.teamObjectId)
    await picker(human.page).selectOption(profileB.teamObjectId)
    await waitTeam(human.page, profileB.teamObjectId)
    await human.page.goBack()
    await waitTeam(human.page, profileA.teamObjectId)
    expect(new URL(human.page.url()).searchParams.get("teamObjectId")).toBe(profileA.teamObjectId)

    phase = "narrow-and-keyboard"
    await human.page.setViewportSize({ width: 390, height: 844 })
    await human.page.keyboard.press("Control+Shift+P")
    const narrowPicker = human.page.locator(".sf-team-mobile [data-sf-team-picker]")
    await narrowPicker.waitFor({ state: "visible" })
    expect(await narrowPicker.inputValue()).toBe(profileA.teamObjectId)
    expect(await narrowPicker.evaluate((element) => document.activeElement === element)).toBe(true)
    await narrowPicker.selectOption(profileB.teamObjectId)
    await waitTeam(human.page, profileB.teamObjectId)
    await narrowPicker.selectOption(profileA.teamObjectId)
    await waitTeam(human.page, profileA.teamObjectId)
    expect(await human.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await human.page.locator(".sf-team-menu-toggle").click()
    await human.page.setViewportSize({ width: 1360, height: 900 })
    await human.page.keyboard.press("Control+Shift+P")
    expect(await picker(human.page).evaluate((element) => document.activeElement === element)).toBe(true)

    phase = "two-independent-windows"
    // A duplicated document initially copies sessionStorage. Web Locks force a
    // distinct actual window identity; the copied Team hint does not select it.
    const popupPromise = human.browser.waitForEvent("page")
    await human.page.evaluate(() => { window.open("/", "_blank") })
    const second = await popupPromise
    await waitState(second, "authenticated")
    expect(await picker(second).inputValue()).toBe("")
    const firstWindow = await human.page.evaluate(() => sessionStorage.getItem("orchestra.team.window.v1"))
    const secondWindow = await second.evaluate(() => sessionStorage.getItem("orchestra.team.window.v1"))
    expect(firstWindow).toMatch(/^[0-9a-f-]{36}$/)
    expect(secondWindow).toMatch(/^[0-9a-f-]{36}$/)
    expect(secondWindow).not.toBe(firstWindow)
    await picker(second).selectOption(profileB.teamObjectId)
    await waitTeam(second, profileB.teamObjectId)
    expect(await picker(human.page).inputValue()).toBe(profileA.teamObjectId)

    phase = "native-planner-draft"
    const owner = new URLSearchParams({ contractRevision: "sf-team-profile/1", server: f.binding.origin,
      installationId: f.binding.installationId, tenantId: f.binding.tenantId, teamObjectId: profileA.teamObjectId })
    const versionPath = "/orchestra/sf-planner/versions/r_" + Buffer.from("version-native").toString("base64url") + "?" + owner + "&year=2026"
    await human.page.goto(f.binding.origin + versionPath, { waitUntil: "domcontentloaded" })
    const name = human.page.locator("#sf-u46-name")
    await name.waitFor({ state: "visible" })
    expect(await name.inputValue()).toBe("Original version")
    expect(observed.some((call) => call.path.endsWith("/api/ui/pages/CAP23") && call.status === 200 &&
      call.cookie && call.selector === JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: profileA }))).toBe(true)
    await name.fill("Private unsaved Team A")
    await picker(human.page).selectOption(profileB.teamObjectId)
    await human.page.locator("dialog.sf-team-dialog[open]").waitFor({ state: "visible" })
    await human.page.getByRole("button", { name: "Cancel", exact: true }).click()
    expect(await name.inputValue()).toBe("Private unsaved Team A")
    expect(await picker(human.page).inputValue()).toBe(profileA.teamObjectId)

    await picker(human.page).selectOption(profileB.teamObjectId)
    await human.page.locator("[data-sf-confirm-discard]").click()
    await waitTeam(human.page, profileB.teamObjectId)
    expect(await human.page.locator("#sf-u46-name").count()).toBe(0)
    expect(await human.page.locator("body").textContent()).not.toContain("Private unsaved Team A")

    await human.page.goto(f.binding.origin + versionPath, { waitUntil: "domcontentloaded" })
    await human.page.locator("#sf-u46-name").fill("Revoked unsaved Team A")
    await picker(human.page).selectOption(profileB.teamObjectId)
    await human.page.locator("dialog.sf-team-dialog[open]").waitFor({ state: "visible" })
    phase = "logout-before-server-confirmation"
    holdLogout = true
    const contextReads = observed.filter((call) => call.fixture === "business" && call.path.endsWith("/api/ui/context")).length
    await second.locator("[data-sf-sign-out]").click()
    await logoutEntered.promise
    await waitState(human.page, "unauthenticated")
    await waitState(second, "unauthenticated")
    await human.page.bringToFront()
    await waitState(human.page, "unauthenticated")
    expect(observed.filter((call) => call.fixture === "business" && call.path.endsWith("/api/ui/context"))).toHaveLength(contextReads)
    logoutRelease.resolve()
    await logoutHandled.promise
    expect(await human.page.locator("dialog[open]").count()).toBe(0)
    expect(await human.page.locator("#sf-u46-name").count()).toBe(0)
    expect(await human.page.locator("body").textContent()).not.toContain("Revoked unsaved Team A")
    const logout = observed.filter((call) => call.fixture === "business" && call.path.endsWith("/auth/logout"))
    expect(logout).toHaveLength(1)
    expect(logout[0]).toMatchObject({ method: "POST", cookie: true, basic: false, selector: null, status: 204 })
    const persisted = await f.persistence.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot.data.versions }))
    expect(persisted).toMatchObject([{ id: "version-native", name: "Original version" }])

    phase = "independent-administration"
    const administrator = await open(admin, "admin")
    await signIn(administrator.page)
    expect(await administrator.page.locator("[data-sf-team-status]").textContent()).toContain("currently unavailable")
    await administrator.page.locator(".sf-team-sidebar").getByRole("button", { name: "Team administration", exact: true }).click()
    await administrator.page.locator('[data-sf-team-administration="ready"]').waitFor({ state: "visible" })
    expect(await admin.profiles.read()).toEqual({ configRevision: 0, profiles: [] })
    await administrator.page.locator("[data-sf-team-id-input]").fill(profileA.teamObjectId)
    await administrator.page.getByRole("button", { name: "Enable Team", exact: true }).click()
    await administrator.page.locator('[data-sf-admin-team="' + profileA.teamObjectId + '"]').waitFor({ state: "visible" })
    expect(await admin.profiles.read()).toEqual({ configRevision: 1, profiles: [{ profile: profileA, enabled: true }] })
    expect(await picker(administrator.page).isDisabled()).toBe(true)
    expect(observed.some((call) => call.fixture === "admin" && call.path.endsWith("/api/ui/team-profiles") &&
      call.method === "POST" && call.cookie && !call.basic && call.selector === null && call.status === 200)).toBe(true)
    admin.provider.account.groups = admin.provider.account.groups.filter((value) => value !== group)
    await administrator.page.getByRole("button", { name: "Read current configuration", exact: true }).click()
    await administrator.page.locator('[data-sf-team-administration="denied"]').waitFor({ state: "visible" })
    expect(await admin.profiles.read()).toEqual({ configRevision: 1, profiles: [{ profile: profileA, enabled: true }] })
    expect(admin.metadataCalls.locations).toBe(0)

    expect(observed.some((call) => call.basic)).toBe(false)
    expect(observed.some((call) => call.path === "/api/session" || call.path === "/api/reference" || call.path === "/api/global/health")).toBe(false)
    expect(errors).toEqual([])
    passed = true
  } finally {
    logoutRelease.resolve()
    if (!passed) console.info("SF_TEAMS_NATIVE_WEB_FAILURE " + JSON.stringify({ phase, errors,
      calls: observed.map(({ fixture, path, method, status }) => ({ fixture, path, method, status })) }))
    const browserClosed = await Promise.allSettled(contexts.map((context) => context.close()))
    const driverClosed = await Promise.allSettled([driver?.close()])
    const fixturesClosed = await Promise.allSettled([f?.close(), admin?.close()])
    const buildClosed = await Promise.allSettled([built?.close()])
    const failures = [...browserClosed, ...driverClosed, ...fixturesClosed, ...buildClosed]
      .flatMap((entry) => entry.status === "rejected" ? [entry.reason] : [])
    if (failures.length) throw new AggregateError(failures, "Native Teams Web qualification cleanup failed")
  }
  if (passed) driver?.report()
}, 180000)
