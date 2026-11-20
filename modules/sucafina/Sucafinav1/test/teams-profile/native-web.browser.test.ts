import { expect, test } from "bun:test"
import type { BrowserContext, Page } from "@playwright/test"
import { expectSpawn } from "../../../../../packages/core/test/fixture/omni-expect.ts"
import { launchBrowserDriver } from "../product/wp02/browser-driver-fixture.ts"
import { buildNativeTeamsWeb } from "./native-web-build.ts"
import { nativeTeamWebFixture } from "./native-web-fixture.ts"
import { serveNativeTeamsWeb } from "./native-web-network.ts"
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
  const networks: Awaited<ReturnType<typeof serveNativeTeamsWeb>>[] = []
  const contexts: BrowserContext[] = [], errors: string[] = [], runtimeErrors: string[] = []
  const contextReplies: { status: string; teams?: string; bound: boolean }[] = []
  const observed: { fixture: "business" | "admin"; path: string; method: string; cookie: boolean; basic: boolean; selector: string | null; status: number }[] = []
  const startedAt = performance.now()
  const httpPhases: { fixture: "business" | "admin"; path: string; method: string; startedMs: number; elapsedMs?: number; status?: number }[] = []
  let passed = false, phase = "build", holdLogout = false, loseConfigurationResponse = false
  const logoutEntered = Promise.withResolvers<void>(), logoutRelease = Promise.withResolvers<void>(), logoutHandled = Promise.withResolvers<void>()
  try {
    phase = "browser-start"
    driver = await launchBrowserDriver("teams-web-transport")
    phase = "build"
    built = await buildNativeTeamsWeb()
    f = await nativeTeamWebFixture({ enabled: [profileA, profileB], direct: [profileA, profileB],
      sessionActions: ["read", "create", "prompt", "run", "control"] })
    await f.seedPlannerVersion()
    admin = await nativeTeamWebFixture({ roles: false, grants: [], enabled: [], direct: [] })
    admin.provider.teamResources.set(profileA.teamObjectId, teamRow())
    admin.provider.hooks.before = (request) => new URL(request.url).pathname === "/v1.0/me/joinedTeams"
      ? Response.json({ error: { code: "ServiceUnavailable" } }, { status: 503 }) : undefined
    const open = async (fixture: NonNullable<typeof f>, name: "business" | "admin") => {
      const network = await serveNativeTeamsWeb({
        origin: fixture.binding.origin,
        authorize: async (address) => {
          const url = new URL(address), code = await fixture.provider.issueCode(url.href, oid)
          const callback = new URL(url.searchParams.get("redirect_uri")!)
          callback.searchParams.set("code", code)
          callback.searchParams.set("state", url.searchParams.get("state")!)
          return new Response(null, { status: 303, headers: { Location: callback.href, "Cache-Control": "no-store" } })
        },
        handle: async (request) => {
          const url = new URL(request.url)
          if (name === "business" && holdLogout && url.pathname === fixture.binding.mount + "/auth/logout") {
            logoutEntered.resolve(); await logoutRelease.promise
          }
          const start = performance.now()
          const measured = /^\/api\/(?:session(?:\/|$)|event$)/.test(url.pathname.slice(fixture.binding.mount.length))
            ? { fixture: name, path: url.pathname, method: request.method, startedMs: Math.round(start - startedAt) } : undefined
          if (measured) httpPhases.push(measured)
          // The actual TLS Request is passed unchanged to the installed handlers.
          const response = url.pathname.startsWith(fixture.binding.mount + "/") || url.pathname.startsWith("/api/")
            ? await fixture.handle(request) : await built!.asset(request) ?? new Response(null, { status: 404 })
          if (measured) {
            Object.assign(measured, { elapsedMs: Math.round(performance.now() - start), status: response.status })
            console.info("SF_TEAMS_NATIVE_HTTP_PHASE " + JSON.stringify(measured))
          }
          if (url.pathname.endsWith("/api/ui/context")) {
            const decoded: unknown = await response.clone().json()
            if (decoded && typeof decoded === "object" && "status" in decoded && typeof decoded.status === "string") {
              const value = "value" in decoded && decoded.value && typeof decoded.value === "object" ? decoded.value : undefined
              const profile = value && "profile" in value && value.profile && typeof value.profile === "object" ? value.profile : undefined
              const teams = profile && "teams" in profile && profile.teams && typeof profile.teams === "object" ? profile.teams : undefined
              const stamp = value && "stamp" in value && value.stamp && typeof value.stamp === "object" ? value.stamp : undefined
              contextReplies.push({ status: decoded.status,
                teams: teams && "status" in teams && typeof teams.status === "string" ? teams.status : undefined,
                bound: !!stamp && "team" in stamp })
            }
          }
          let delivered = response
          if (name === "admin" && loseConfigurationResponse && request.method === "POST" &&
              url.pathname === fixture.binding.mount + "/api/ui/team-profiles/configuration" && response.status === 200) {
            // The real command already committed. Lose only its HTTP reply so
            // the native UI must reconcile a retained reference without retry.
            loseConfigurationResponse = false
            void response.body?.cancel().catch(() => {})
            delivered = new Response("Synthetic lost response after commit", { status: 502, headers: { "Cache-Control": "no-store" } })
          }
          observed.push({ fixture: name, path: url.pathname, method: request.method,
            cookie: request.headers.has("cookie"), basic: request.headers.has("authorization"),
            selector: request.headers.get("x-sf-team-profile"), status: delivered.status })
          if (name === "business" && url.pathname === fixture.binding.mount + "/auth/logout") logoutHandled.resolve()
          return delivered
        },
      })
      networks.push(network)
      // The only trusted TLS exception is this known synthetic certificate.
      // The proxy itself rejects every host except the two exact fixture hosts.
      const browser = await driver!.browser.newContext({ proxy: { server: network.proxy },
        ignoreHTTPSErrors: true, serviceWorkers: "block", locale: "en-US", viewport: { width: 1360, height: 900 } })
      browser.setDefaultTimeout(7000)
      contexts.push(browser)
      browser.on("page", (page) => {
        page.on("pageerror", (error) => errors.push(error.message))
        page.on("console", (message) => {
          if (message.type() === "error" && /^(Teams |Microsoft sign-out)/.test(message.text()))
            runtimeErrors.push(message.text())
        })
      })
      const page = await browser.newPage()
      await page.goto(fixture.binding.origin + "/", { waitUntil: "domcontentloaded" })
      return { browser, page }
    }
    const waitState = (page: Page, state: string) => page.waitForFunction((expected) =>
      document.querySelector("[data-sf-teams-shell]")?.getAttribute("data-sf-teams-state") === expected, state)
    const waitTeam = (page: Page, id: string) => page.waitForFunction((expected) => {
      const picker = document.querySelector<HTMLSelectElement>(".sf-team-picker-wide [data-sf-team-picker]")
      // The admitted context publishes before the guarded history commit. Wait
      // for the whole user action to settle, then assert the URL separately.
      return document.querySelector("[data-sf-teams-shell]")?.getAttribute("data-sf-team-selected") === expected &&
        !!picker && !picker.disabled
    }, id)
    const picker = (page: Page) => page.locator(".sf-team-picker-wide [data-sf-team-picker]")
    const signIn = async (page: Page, fixture: NonNullable<typeof f>) => {
      await waitState(page, "unauthenticated")
      const link = page.locator("[data-sf-microsoft-login]")
      const login = fixture.binding.origin + fixture.binding.mount + "/auth/login?returnTo=%2F"
      expect(await link.getAttribute("href")).toBe(login)
      expect(await link.getAttribute("target")).toBe("_self")
      const start = page.waitForResponse((response) => response.url() === login && response.request().isNavigationRequest())
      const issued = page.waitForResponse((response) => {
        const url = new URL(response.url())
        return url.origin + url.pathname === authority + "/oauth2/v2.0/authorize" && response.request().isNavigationRequest()
      })
      const completed = page.waitForResponse((response) => {
        const url = new URL(response.url())
        return url.origin + url.pathname === fixture.binding.origin + fixture.binding.mount + "/auth/callback" &&
          response.request().isNavigationRequest()
      })
      // Chromium follows the unchanged signed redirect chain and stores the
      // Secure HttpOnly mount cookie itself. No route, cookie or token injection.
      const [begin, authorization, callback] = await Promise.all([start, issued, completed, link.click()])
      expect(begin.status()).toBe(303)
      expect(authorization.status()).toBe(303)
      expect(callback.status()).toBe(303)
      const authorize = new URL(begin.headers()["location"]!)
      expect(authorize.origin + authorize.pathname).toBe(authority + "/oauth2/v2.0/authorize")
      const returned = new URL(authorization.headers()["location"]!)
      expect(returned.origin + returned.pathname).toBe(fixture.binding.origin + fixture.binding.mount + "/auth/callback")
      expect(new URL(callback.headers()["location"]!, callback.url()).href).toBe(fixture.binding.origin + "/")
      await waitState(page, "authenticated")
      expect(new URL(page.url()).pathname).toBe("/")
    }

    phase = "business-bootstrap"
    const human = await open(f, "business")
    await waitState(human.page, "unauthenticated")
    expect(observed.some((call) => call.path === "/api/sucafina/installations" && call.status === 200 && !call.basic)).toBe(true)
    expect(f.metadataCalls.locations).toBe(0)
    phase = "microsoft-login"
    await signIn(human.page, f)
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
    await human.page.waitForURL((url) => url.searchParams.get("teamObjectId") === profileA.teamObjectId)
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

    phase = "native-session-creation"
    const chat = (page: Page) => page.locator('[data-sf-session-workspace][data-sf-session-state="ready"]')
    const editor = (page: Page) => chat(page).locator('[data-slot="prompt-input-v2-editor"] [contenteditable="true"]')
    const send = (page: Page) => chat(page).locator('[data-action="prompt-submit"]')
    const openChat = async (page: Page) => {
      await page.locator(".sf-team-sidebar [data-sf-open-chat]").click()
      await chat(page).waitFor({ state: "visible" })
      await page.waitForFunction(() => document.querySelector("[data-sf-session-workspace]")?.getAttribute("data-sf-session-stream") === "open")
    }
    const submit = async (page: Page, text: string) => {
      await editor(page).fill(text)
      await send(page).click()
      await chat(page).locator("[data-sf-prompt-admitted]").filter({ hasText: text }).waitFor({ state: "visible" })
      const id = new URL(page.url()).pathname.split("/").at(-1)!
      expect(id).toMatch(/^ses_[A-Za-z0-9_-]+$/)
      return id
    }
    await openChat(human.page)
    expect(await chat(human.page).locator("[data-sf-session-id]").count()).toBe(0)
    const createdA = await submit(human.page, "Recorded prompt for Team A")
    expect(observed.some((call) => call.path === f!.binding.mount + "/api/session" && call.method === "POST" &&
      call.cookie && !call.basic && call.selector === JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: profileA }))).toBe(true)
    expect(observed.some((call) => call.path === f!.binding.mount + "/api/event" && call.status === 200 && call.cookie && !call.basic)).toBe(true)
    expect(await chat(human.page).locator("[data-sf-session-id]").getAttribute("data-sf-session-id")).toBe(createdA)

    phase = "native-session-owner-isolation"
    await openChat(second)
    expect(await chat(second).locator("[data-sf-session-id]").count()).toBe(0)
    const createdB = await submit(second, "Recorded prompt for Team B")
    expect(createdB).not.toBe(createdA)
    expect(await chat(second).locator('[data-sf-session-id="' + createdA + '"]').count()).toBe(0)
    expect(await chat(human.page).locator('[data-sf-session-id="' + createdB + '"]').count()).toBe(0)

    phase = "native-session-incremental-stream"
    await editor(human.page).fill("Private chat draft in A")
    await picker(second).selectOption(profileA.teamObjectId)
    await waitTeam(second, profileA.teamObjectId)
    await openChat(second)
    await chat(second).locator('[data-sf-session-id="' + createdA + '"]').waitFor({ state: "visible" })
    const streamReads = observed.filter((call) => call.path === f!.binding.mount + "/api/event").length
    const peerA = await submit(second, "A new session from the other window")
    // The first document stays in the background. This title appears through
    // its already-open, namespace-checked SSE; no focus or refresh is requested.
    await chat(human.page).locator('[data-sf-session-id="' + peerA + '"]').waitFor({ state: "visible" })
    expect(observed.filter((call) => call.path === f!.binding.mount + "/api/event")).toHaveLength(streamReads)
    expect(await editor(human.page).textContent()).toBe("Private chat draft in A")
    expect(await chat(human.page).locator('[data-sf-session-id="' + createdB + '"]').count()).toBe(0)

    phase = "native-session-close-and-restore"
    await human.page.bringToFront()
    await waitTeam(human.page, profileA.teamObjectId)
    await chat(human.page).waitFor({ state: "visible" })
    expect(await editor(human.page).textContent()).toBe("Private chat draft in A")
    await chat(human.page).locator(".sf-team-session-tab[data-active]").getByRole("button", { name: "Close tab", exact: true }).click()
    await human.page.getByRole("button", { name: "Cancel", exact: true }).click()
    expect(await editor(human.page).textContent()).toBe("Private chat draft in A")
    await chat(human.page).locator(".sf-team-session-tab[data-active]").getByRole("button", { name: "Close tab", exact: true }).click()
    await human.page.locator("[data-sf-confirm-discard]").click()
    await chat(human.page).locator('[data-sf-session-reopen="' + createdA + '"]').waitFor({ state: "visible" })
    expect(await editor(human.page).textContent()).toBe("")
    await chat(human.page).locator('[data-sf-session-reopen="' + createdA + '"]').click()
    await chat(human.page).locator("[data-sf-prompt-admitted]").filter({ hasText: "Recorded prompt for Team A" }).waitFor({ state: "visible" })
    const storedChat = await human.page.evaluate(() => Object.values(sessionStorage).join("\n"))
    expect(storedChat).not.toMatch(/Private chat draft in A|Recorded prompt for Team A|Recorded prompt for Team B/)
    await human.page.reload({ waitUntil: "domcontentloaded" })
    await chat(human.page).waitFor({ state: "visible" })
    await chat(human.page).locator("[data-sf-prompt-admitted]").filter({ hasText: "Recorded prompt for Team A" }).waitFor({ state: "visible" })
    expect(new URL(human.page.url()).pathname.split("/").at(-1)).toBe(createdA)
    expect(await editor(human.page).textContent()).toBe("")
    expect(f.sessionCalls.wakes).toBe(3)
    expect(f.sessionCalls.resumes).toBe(0)
    expect(f.business.all("SELECT session_id FROM session_input")).toHaveLength(3)

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
    await signIn(administrator.page, admin)
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
    phase = "shared-team-configuration"
    await administrator.page.locator('[data-sf-config-open="' + profileA.teamObjectId + '"]').click()
    const configuration = administrator.page.locator('[data-sf-team-configuration="ready"]')
    await configuration.waitFor({ state: "visible" })
    await configuration.locator("[data-sf-config-model]").fill("fixture/shared-model")
    await configuration.locator("[data-sf-config-default-agent]").fill("analyst")
    await configuration.locator("[data-sf-config-agent-id]").fill("analyst")
    await configuration.locator("[data-sf-config-add-agent]").click()
    await configuration.locator("[data-sf-config-instructions]").fill("Shared instructions configured by the independent administrator.")
    const configured = administrator.page.waitForResponse((response) =>
      new URL(response.url()).pathname === admin!.binding.mount + "/api/ui/team-profiles/configuration" &&
      response.request().method() === "POST")
    await configuration.locator("[data-sf-config-save]").click()
    expect((await configured).status()).toBe(200)
    await administrator.page.locator('[data-sf-team-administration="ready"]').waitFor({ state: "visible" })
    expect(await admin.profiles.readConfiguration(profileA)).toEqual({
      origin: "installation-team-store", profile: profileA, configRevision: 2,
      document: { version: 1, settings: { model: "fixture/shared-model", default_agent: "analyst",
        agents: { analyst: { system: "Shared instructions configured by the independent administrator." } } } },
    })
    expect(await admin.profiles.read()).toEqual({ configRevision: 2, profiles: [{ profile: profileA, enabled: true }] })
    expect(await picker(administrator.page).isDisabled()).toBe(true)
    expect(observed.some((call) => call.fixture === "admin" && call.path.endsWith("/api/ui/team-profiles/configuration") &&
      call.method === "POST" && call.cookie && !call.basic && call.selector === null && call.status === 200)).toBe(true)
    phase = "shared-configuration-unknown-reload"
    await administrator.page.locator('[data-sf-config-open="' + profileA.teamObjectId + '"]').click()
    await configuration.waitFor({ state: "visible" })
    await configuration.locator("[data-sf-config-agent]").selectOption("analyst")
    await configuration.locator("[data-sf-config-instructions]").fill("Observed only after the original administrator is admitted again.")
    loseConfigurationResponse = true
    await configuration.locator("[data-sf-config-save]").click()
    await configuration.locator("[data-sf-config-check]").waitFor({ state: "visible" })
    expect((await admin.profiles.read()).configRevision).toBe(3)
    const retainedConfiguration = await administrator.page.evaluate(() =>
      Object.values(sessionStorage).filter((value) => value.includes('"documentHash"')))
    expect(retainedConfiguration).toHaveLength(1)
    expect(retainedConfiguration.join("")).not.toMatch(/Observed only|fixture\/shared-model|"settings"|"system"/)
    administrator.page.once("dialog", (dialog) => { void dialog.accept() })
    await administrator.page.reload({ waitUntil: "domcontentloaded" })
    await administrator.page.locator('[data-sf-team-administration="ready"]').waitFor({ state: "visible" })
    expect(await administrator.page.locator("body").textContent()).not.toContain("Observed only after")
    await administrator.page.locator('[data-sf-config-open="' + profileA.teamObjectId + '"]').click()
    await administrator.page.locator(".sf-team-notice").filter({ hasText: "matches the settings you submitted" }).waitFor({ state: "visible" })
    expect(await administrator.page.evaluate(() =>
      Object.values(sessionStorage).filter((value) => value.includes('"documentHash"')))).toEqual([])
    expect(observed.filter((call) => call.fixture === "admin" &&
      call.path.endsWith("/api/ui/team-profiles/configuration") && call.method === "POST").map((call) => call.status)).toEqual([200, 502])
    admin.provider.account.groups = admin.provider.account.groups.filter((value) => value !== group)
    await administrator.page.getByRole("button", { name: "Read current configuration", exact: true }).click()
    await administrator.page.locator('[data-sf-team-administration="denied"]').waitFor({ state: "visible" })
    expect(await admin.profiles.read()).toEqual({ configRevision: 3, profiles: [{ profile: profileA, enabled: true }] })
    expect(admin.metadataCalls.locations).toBe(0)

    expect(observed.some((call) => call.basic)).toBe(false)
    expect(observed.some((call) => call.path === "/api/session" || call.path === "/api/reference" || call.path === "/api/global/health")).toBe(false)
    expect(errors).toEqual([])
    passed = true
  } catch (error) {
    const clean = (text: string) => text.replace(/https?:\/\/[^\s"'<>]+/g, (raw) => {
      try { const url = new URL(raw); return url.origin + url.pathname } catch { return "[redacted URL]" }
    })
    console.info("SF_TEAMS_NATIVE_WEB_PRIMARY_FAILURE " + JSON.stringify({
      phase, name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? clean(error.message.split("\n")[0] ?? "") : "Non-error failure",
      stack: error instanceof Error ? error.stack?.split("\n").filter((line) => /^\s+at /.test(line)).map(clean).slice(0,5) : [],
    }))
    throw error
  } finally {
    logoutRelease.resolve()
    if (!passed) {
      const pages = await Promise.allSettled(contexts.flatMap((context) => context.pages().map((page) => page.evaluate(() => ({
        path: location.pathname,
        state: document.querySelector("[data-sf-teams-shell]")?.getAttribute("data-sf-teams-state"),
        selected: document.querySelector("[data-sf-teams-shell]")?.getAttribute("data-sf-team-selected"),
        status: document.querySelector("[data-sf-team-status]")?.textContent,
        fatal: document.querySelector<HTMLTextAreaElement>("textarea[readonly]")?.value.slice(0,1200),
        notices: [...document.querySelectorAll(".sf-team-notice")].map((element) => element.textContent),
        pickers: [...document.querySelectorAll<HTMLSelectElement>("[data-sf-team-picker]")]
          .map((element) => ({ value: element.value, disabled: element.disabled })),
      })))))
      console.info("SF_TEAMS_NATIVE_WEB_FAILURE " + JSON.stringify({ phase, errors, runtimeErrors, contextReplies,
        authorityTimings: { business: f?.authorityTimings(), administration: admin?.authorityTimings() },
        providerRequestCounts: { business: f?.providerRequestCounts(), administration: admin?.providerRequestCounts() },
        httpPhases: httpPhases.map((item) => ({ ...item, pendingMs: item.elapsedMs === undefined ? Math.round(performance.now() - startedAt - item.startedMs) : undefined })),
        pages: pages.map((page) => page.status === "fulfilled" ? page.value : { inaccessible: true }),
        calls: observed.map(({ fixture, path, method, status }) => ({ fixture, path, method, status })) }))
    }
    const browserClosed = await Promise.allSettled(contexts.map((context) => context.close()))
    const networkClosed = await Promise.allSettled(networks.map((network) => network.close()))
    const driverClosed = await Promise.allSettled([driver?.close()])
    const fixturesClosed = await Promise.allSettled([f?.close(), admin?.close()])
    const buildClosed = await Promise.allSettled([built?.close()])
    console.info("SF_TEAMS_NATIVE_POLICY_TIMINGS " + JSON.stringify({
      phase: "after-cleanup", business: f?.authorityTimings(), administration: admin?.authorityTimings(),
      providerRequestCounts: { business: f?.providerRequestCounts(), administration: admin?.providerRequestCounts() },
    }))
    const failures = [...browserClosed, ...networkClosed, ...driverClosed, ...fixturesClosed, ...buildClosed]
      .flatMap((entry) => entry.status === "rejected" ? [entry.reason] : [])
    if (failures.length) throw new AggregateError(failures, "Native Teams Web qualification cleanup failed")
  }
  if (passed) driver?.report()
}, 180000)
