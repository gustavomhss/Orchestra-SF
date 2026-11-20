import { expect } from "@playwright/test"
import type { Page } from "@playwright/test"

type SfProfile = {
  origin: string
  directory: string
  chapterPath?: string
  server?: { username: string; password: string }
}

/** Select the enrolled installation's real directory through the shell profile UI. */
export async function selectSfProfile(page: Page, input: SfProfile) {
  const errors: string[] = []
  const record = (error: Error) => {
    if (errors.length < 8) errors.push(["TypeError", "ReferenceError", "SyntaxError", "RangeError"].includes(error.name) ? error.name : "Error")
  }
  page.on("pageerror", record)
  try {
    await selectProfile(page, input)
  } catch (error) {
    await profileDiagnostics(page, errors)
    throw error
  } finally {
    page.off("pageerror", record)
  }
}

async function selectProfile(page: Page, input: SfProfile) {
  const chapter = new URL(input.chapterPath ?? "/orchestra/sf-dashboard/budget", input.origin)
  expect(chapter.origin).toBe(new URL(input.origin).origin)
  expect(chapter.search).toBe("")
  expect(input.directory).not.toBe("")
  await page.goto(chapter.href)
  if (input.server) await connectServer(page, chapter.origin, input.server)

  const profile = page.locator('[data-slot="orchestra-profile"]')
  await expect(profile).toBeVisible()
  await profile.click()
  const picker = page.locator('[data-component="orchestra-profile-picker"]')
  const add = picker.getByRole("menuitem", { name: "Add project", exact: true })
  await expect(add, "The isolated context has one selected server").toHaveCount(1)
  await add.click()

  const dialog = page.getByRole("dialog", { name: "Open project", exact: true })
  await dialog.getByPlaceholder("Search folders", { exact: true }).fill(input.directory)
  const directory = dialog.locator(`[data-directory-path=${JSON.stringify(input.directory)}]`)
  await expect(directory).toHaveCount(1)
  const discovered = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return response.request().method() === "GET" && url.origin === chapter.origin
      && url.pathname === "/api/sucafina/installations"
      && url.searchParams.get("select") === "location"
      && url.searchParams.get("location[directory]") === input.directory
  })
  await directory.click()
  const response = await discovered
  expect(response.status()).toBe(200)
  const installed: unknown = await response.json()
  expect(installed).toEqual({
    installations: [expect.objectContaining({
      installationId: expect.stringMatching(/\S/),
      projectId: expect.stringMatching(/\S/),
      publicOrigin: chapter.origin,
      contractRevision: "sf-native-ui/1",
    })],
  })

  const owner = page.locator('[data-sf-host="owner-runtime231"]')
  await expect(owner).toHaveAttribute("data-sf-provider-state", "ready")
  await expect(profile.locator("small")).toHaveAttribute("title", input.directory)
  // A bare route and reload must keep the real profile; exact business anchors
  // deliberately do not carry server/project/installation query parameters.
  await page.reload()
  await expect(page).toHaveURL(chapter.href)
  await expect(owner).toHaveAttribute("data-sf-provider-state", "ready")
  await expect(profile.locator("small")).toHaveAttribute("title", input.directory)
}

/** Save the isolated daemon's actual credential through the production recovery form. */
async function connectServer(page: Page, origin: string, server: NonNullable<SfProfile["server"]>) {
  if (!server.username || !server.password) throw new Error("The isolated daemon credential is missing")
  const recovery = page.getByRole("region", { name: "Servers", exact: true })
  await expect(recovery).toBeVisible()
  await recovery.getByRole("button", { name: "Edit server", exact: true }).click()
  await recovery.getByLabel("Server address", { exact: true }).fill(origin)
  await recovery.getByLabel("Username (optional)", { exact: true }).fill(server.username)
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
  })
  await recovery.getByRole("button", { name: "Save", exact: true }).click()
  const health = await checked
  expect(health.status()).toBe(200)
  expect(await health.json()).toMatchObject({ healthy: true, version: expect.stringMatching(/\S/) })
}

/** Only mount counts and allowlisted labels leave the isolated context; never URL queries, fields or storage. */
async function profileDiagnostics(page: Page, pageErrors: readonly string[]) {
  const snapshot = await page.evaluate(() => ({
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
  console.error("SfProfile bootstrap failed", JSON.stringify({ ...snapshot, pageErrors }))
}
