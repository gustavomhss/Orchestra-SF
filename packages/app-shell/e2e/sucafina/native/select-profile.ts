import { expect } from "@playwright/test"
import type { Page } from "@playwright/test"

type SfProfile = {
  origin: string
  directory: string
  chapterPath?: string
  server?: { username: string; password: string }
}

type ProfilePhase =
  | "validation" | "home-navigation" | "server-recovery" | "server-form"
  | "server-password" | "server-save" | "server-health" | "home-profile"
  | "profile-menu" | "directory-search" | "directory-row" | "directory-selection"
  | "selected-profile" | "chapter-navigation" | "discovery-response" | "discovery-body"
  | "owner-ready" | "chapter-profile" | "chapter-reload"
  | "reloaded-url" | "reloaded-owner" | "reloaded-profile"
type MarkPhase = (phase: ProfilePhase) => void

/** Select the enrolled installation's real directory through the shell profile UI. */
export async function selectSfProfile(page: Page, input: SfProfile) {
  const errors: string[] = []
  const progress: { phase: ProfilePhase } = { phase: "validation" }
  const record = (error: Error) => {
    if (errors.length < 8) errors.push(["TypeError", "ReferenceError", "SyntaxError", "RangeError"].includes(error.name) ? error.name : "Error")
  }
  page.on("pageerror", record)
  try {
    await selectProfile(page, input, (phase) => { progress.phase = phase })
  } catch (error) {
    await profileDiagnostics(page, errors, progress.phase)
    throw new Error("SfProfile bootstrap [" + progress.phase + "] failed", { cause: error })
  } finally {
    page.off("pageerror", record)
  }
}

async function selectProfile(page: Page, input: SfProfile, mark: MarkPhase) {
  const chapter = new URL(input.chapterPath ?? "/orchestra/sf-dashboard/budget", input.origin)
  const home = new URL("/", input.origin)
  expect(chapter.origin).toBe(home.origin)
  expect(chapter.search).toBe("")
  expect(input.directory).not.toBe("")

  // Select the actual shell profile before the native chapter mounts its owner.
  // Home uses the same persisted profile and has no F01 owner to leave/remount.
  mark("home-navigation")
  const homeResponse = await page.goto(home.href)
  expect(homeResponse?.status()).toBe(200)
  if (input.server) await connectServer(page, home.origin, input.server, mark)
  const profile = page.locator('[data-slot="orchestra-profile"]')
  const owner = page.locator('[data-sf-host="owner-runtime231"]')
  mark("home-profile")
  await expect(profile).toBeVisible()
  await expect(page).toHaveURL(home.href)
  await expect(owner).toHaveCount(0)

  mark("profile-menu")
  await profile.click()
  const picker = page.locator('[data-component="orchestra-profile-picker"]')
  const add = picker.getByRole("menuitem", { name: "Add project", exact: true })
  await expect(add, "The isolated context has one selected server").toHaveCount(1)
  await add.click()

  const dialog = page.getByRole("dialog", { name: "Open project", exact: true })
  mark("directory-search")
  await dialog.getByPlaceholder("Search folders", { exact: true }).fill(input.directory)
  const directory = dialog.locator(`[data-directory-path=${JSON.stringify(input.directory)}]`)
  mark("directory-row")
  await expect(directory).toHaveCount(1)
  mark("directory-selection")
  await directory.click()
  await expect(dialog).not.toBeVisible()
  mark("selected-profile")
  await expect(profile.locator("small")).toHaveAttribute("title", input.directory)
  await expect(page).toHaveURL(home.href)
  await expect(owner).toHaveCount(0)

  // The complete selected profile is present before this request can start.
  // Observe the original location discovery caused by entering the real chapter.
  const discovered = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return response.request().method() === "GET" && url.origin === chapter.origin
      && url.pathname === "/api/sucafina/installations"
      && url.searchParams.get("select") === "location"
      && url.searchParams.get("location[directory]") === input.directory
  }).then(
    (response) => ({ kind: "response" as const, response }),
    (error: unknown) => ({ kind: "error" as const, error }),
  )
  mark("chapter-navigation")
  const entry = await page.goto(chapter.href)
  expect(entry?.status()).toBe(200)
  mark("discovery-response")
  const observation = await discovered
  if (observation.kind === "error") throw observation.error
  const response = observation.response
  expect(response.status()).toBe(200)
  mark("discovery-body")
  const installed: unknown = await response.json()
  expect(installed).toEqual({
    installations: [expect.objectContaining({
      installationId: expect.stringMatching(/\S/),
      projectId: expect.stringMatching(/\S/),
      publicOrigin: chapter.origin,
      contractRevision: "sf-native-ui/1",
    })],
  })

  mark("owner-ready")
  await expect(owner).toHaveAttribute("data-sf-provider-state", "ready")
  mark("chapter-profile")
  await expect(profile.locator("small")).toHaveAttribute("title", input.directory)
  // A bare route and reload must keep the real profile; exact business anchors
  // deliberately do not carry server/project/installation query parameters.
  mark("chapter-reload")
  const reloaded = await page.reload()
  expect(reloaded?.status()).toBe(200)
  mark("reloaded-url")
  await expect(page).toHaveURL(chapter.href)
  mark("reloaded-owner")
  await expect(owner).toHaveAttribute("data-sf-provider-state", "ready")
  mark("reloaded-profile")
  await expect(profile.locator("small")).toHaveAttribute("title", input.directory)
}

/** Save the isolated daemon's actual credential through the production recovery form. */
async function connectServer(page: Page, origin: string, server: NonNullable<SfProfile["server"]>, mark: MarkPhase) {
  if (!server.username || !server.password) throw new Error("The isolated daemon credential is missing")
  mark("server-recovery")
  const recovery = page.getByRole("region", { name: "Servers", exact: true })
  await expect(recovery).toBeVisible()
  mark("server-form")
  await recovery.getByRole("button", { name: "Edit server", exact: true }).click()
  await recovery.getByLabel("Server address", { exact: true }).fill(origin)
  await recovery.getByLabel("Username (optional)", { exact: true }).fill(server.username)
  mark("server-password")
  const password = recovery.getByLabel("Password (optional)", { exact: true })
  await expect(password).toBeVisible()
  await expect(password).toBeEditable()
  // Playwright action errors can echo fill arguments. Do not retain a daemon credential in those errors.
  await password.fill(server.password).catch(() => {
    throw new Error("Could not enter the isolated daemon credential through connection recovery")
  })
  const checked = page.waitForResponse(async (response) => {
    const url = new URL(response.url())
    const request = response.request()
    if (request.method() !== "GET" || url.origin !== origin || url.pathname !== "/api/health") return false
    return (await request.headerValue("authorization"))?.startsWith("Basic ") === true
  }).then(
    (response) => ({ kind: "response" as const, response }),
    (error: unknown) => ({ kind: "error" as const, error }),
  )
  mark("server-save")
  await recovery.getByRole("button", { name: "Save", exact: true }).click()
  mark("server-health")
  const observation = await checked
  if (observation.kind === "error") throw observation.error
  const health = observation.response
  expect(health.status()).toBe(200)
  expect(await health.json()).toMatchObject({ healthy: true, version: expect.stringMatching(/\S/) })
}

/** Only mount counts and allowlisted labels leave the isolated context; never URL queries, fields or storage. */
async function profileDiagnostics(page: Page, pageErrors: readonly string[], phase: ProfilePhase) {
  // This line does not need a browser connection and survives timeout teardown.
  console.error("SfProfile bootstrap phase", JSON.stringify({ phase, pageErrors, closed: page.isClosed() }))
  const snapshot = page.isClosed() ? { unavailable: true } : await page.evaluate(() => ({
    location: location.origin + location.pathname,
    root: document.getElementById("root") !== null,
    loading: document.querySelectorAll("[data-app-loading]").length,
    profile: document.querySelectorAll('[data-slot="orchestra-profile"]').length,
    picker: document.querySelectorAll('[data-component="orchestra-profile-picker"]').length,
    owners: [...document.querySelectorAll('[data-sf-host="owner-runtime231"]')].map((owner) => {
      const state = owner.getAttribute("data-sf-provider-state")
      return state && ["ready", "loading", "denied", "error", "empty", "unbound"].includes(state) ? state : "other"
    }),
    controls: [...document.querySelectorAll("button, h1, h2")].map((node) => node.textContent?.trim())
      .filter((label) => ["Edit server", "Add server", "Save", "Requests", "Budget"].includes(label ?? "")),
  })).catch(() => ({ unavailable: true }))
  console.error("SfProfile bootstrap state", JSON.stringify({ phase, ...snapshot }))
}
