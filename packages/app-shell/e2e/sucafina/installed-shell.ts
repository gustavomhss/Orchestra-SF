import { expect, type Locator, type Page } from "@playwright/test"
import { Schema } from "effect"
import { SfContextResult, SfInstallationList } from "@orchestra/schema/sucafina/context"
import { lstat, readFile } from "node:fs/promises"
import path from "node:path"

export function installedShellOrigin() {
  const value = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? "3000"}`
  const origin = new URL(value)
  if (value !== origin.origin || origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" || origin.port === "4110")
    throw new Error("Installed browser requires the configured loopback shell origin")
  return value
}

/** Select the real host through its server/project controls. No response,
 * authority, cookie, storage record or installation descriptor is synthesized.
 * The password is the credential issued by this isolated CLI's own Daemon.
 * Callers disable traces because enrollment and connection are authenticated.
 */
export async function connectInstalledShell(page: Page, installation: {
  root: string; origin: string; mount: string; actorId: string; embedded?: boolean
}) {
  const discovery = new URL("/api/sucafina/installations", installation.origin)
  discovery.search = new URLSearchParams({ select: "location", "location[directory]": installation.root }).toString()
  console.info("[sf-installed] Reading authenticated host discovery")
  const read = async () => {
    if (installation.embedded) {
      const response = await page.request.get(discovery.href, { timeout: 10_000 })
      return { status: response.status(), body: await response.json(), password: undefined }
    }
    const file = path.join(installation.root, "host-state", "orchestra", "password")
    const metadata = await lstat(file)
    if (!metadata.isFile() || metadata.isSymbolicLink() || (metadata.mode & 0o077) !== 0 ||
        process.getuid && metadata.uid !== process.getuid())
      throw new Error("The isolated host must issue its private owner-only credential")
    const password = await readFile(file, "utf8")
    if (!password) throw new Error("The isolated host has no issued credential")
    const response = await fetch(discovery, {
      headers: { Authorization: "Basic " + Buffer.from("orchestra:" + password).toString("base64") },
      signal: AbortSignal.timeout(10_000),
    })
    return { status: response.status, body: await response.json(), password }
  }
  const discoveredHost = await read()
  expect(discoveredHost.status, "The selected host must expose real installation discovery").toBe(200)
  const discovered = Schema.decodeUnknownSync(SfInstallationList, { onExcessProperty: "error" })(discoveredHost.body)
  expect(discovered.installations).toHaveLength(1)
  const binding = discovered.installations[0]!
  expect(binding.publicOrigin).toBe(installation.origin)
  expect(binding.mount).toBe(installation.mount)
  expect(binding.authMode).toBe("local-operator")
  const contextURL = new URL(binding.mount + "/api/ui/context", binding.publicOrigin)
  contextURL.search = new URLSearchParams({ installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId }).toString()
  console.info("[sf-installed] Reading the original native context")
  const contextResponse = await page.request.get(contextURL.toString())
  expect(contextResponse.status(), "The operator session must admit its original native context").toBe(200)
  const context = Schema.decodeUnknownSync(SfContextResult, { onExcessProperty: "error" })(await contextResponse.json())
  if (context.status !== "ok") throw new Error("The isolated native context was not admitted")
  expect(context.value.stamp).toMatchObject({ installationId: binding.installationId, projectId: binding.projectId,
    hostId: binding.hostId, principalRef: installation.actorId })

  console.info("[sf-installed] Selecting the issued server credential in the shell")
  await page.goto(installation.origin + "/", { waitUntil: "domcontentloaded", timeout: 10_000 })
  console.info("[sf-installed] The shell document is loaded")
  if (discoveredHost.password) {
    const status = page.getByRole("button", { name: "Status", exact: true })
    const recovery = page.getByRole("region", { name: "Servers", exact: true })
    await expect(status.or(recovery)).toBeVisible({ timeout: 10_000 })
    let add: Locator
    let submit: string
    if (await recovery.isVisible()) {
      // A fresh browser has no admitted server yet. Use the existing startup
      // recovery form; its health check verifies the issued host credential.
      await recovery.getByRole("button", { name: "Add server", exact: true }).click({ timeout: 10_000 })
      add = recovery.locator("form")
      submit = "Save"
    } else {
      await status.click({ timeout: 10_000 })
      await page.getByRole("button", { name: "Manage servers", exact: true }).click({ timeout: 10_000 })
      const servers = page.getByRole("dialog", { name: "Servers", exact: true })
      await servers.getByRole("button", { name: "Add server", exact: true }).click({ timeout: 10_000 })
      add = page.getByRole("dialog", { name: "Add server", exact: true })
      submit = "Add server"
    }
    console.info("[sf-installed] The server credential form is open")
    await add.getByLabel("Server address", { exact: true }).fill(installation.origin, { timeout: 10_000 })
    await add.getByLabel("Username (optional)", { exact: true }).fill("orchestra", { timeout: 10_000 })
    const credential = add.getByLabel("Password (optional)", { exact: true })
    await expect(credential).toBeEditable({ timeout: 10_000 })
    await credential.fill(discoveredHost.password, { timeout: 10_000 }).catch(() => { throw new Error("Could not enter the isolated host credential") })
    await add.getByRole("button", { name: submit, exact: true }).click({ timeout: 10_000 })
    await expect(add).toHaveCount(0, { timeout: 10_000 })
  }

  console.info("[sf-installed] Selecting the installation project in the shell")
  const profile = page.getByRole("button", { name: "Choose project", exact: true })
  await profile.click({ timeout: 10_000 })
  await page.locator('[data-component="orchestra-profile-picker"]').getByRole("menuitem", { name: "Add project", exact: true }).click({ timeout: 10_000 })
  const folders = page.getByRole("dialog")
  await folders.getByPlaceholder("Search folders", { exact: true }).fill(installation.root, { timeout: 10_000 })
  await folders.locator(`[data-directory-path=${JSON.stringify(installation.root)}]`).click({ timeout: 10_000 })
  await expect(profile.locator("small")).toHaveAttribute("title", installation.root, { timeout: 10_000 })
  return { binding, context: context.value }
}
