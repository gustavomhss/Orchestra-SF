import { readFile } from "node:fs/promises"
import path from "node:path"
import { expect } from "@playwright/test"
import type { APIResponse, Locator, Page, Route, TestInfo } from "@playwright/test"
import { Schema } from "effect"
import { SfContextResult, SfInstallationList } from "@orchestra/schema/sucafina/context"

export type Account = { baseURL: string; principal: string; origin: string; projectId: string; installationId: string }
type EnrolledAccount = Omit<Account, "origin"> & { enrollments: Record<string, string> }
type Manifest = {
  origin: string
  directory: string
  accounts: Record<"first" | "second" | "viewer", EnrolledAccount>
  records: { supplier: string; comparison: string }
}

/** The existing host owns SQLite, authentication and fixture lifecycle. No server is started here. */
export async function readManifest(): Promise<Manifest> {
  const filename = path.join(import.meta.dirname, "../wp04/.host-manifest.json")
  const source = await readFile(filename, "utf8").catch((error: unknown) => {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error("CI-UI-OPERATIONS requires the real Sucafina host managed by the production fixture")
    }
    throw error
  })
  const manifest = JSON.parse(source) as Manifest
  const origin = new URL(manifest.origin)
  expect(origin.protocol, "Operations must use the isolated local Actions fixture").toBe("http:")
  expect(["127.0.0.1", "localhost", "[::1]"]).toContain(origin.hostname)
  expect(origin.origin).toBe(manifest.origin)
  expect(path.isAbsolute(manifest.directory)).toBe(true)
  for (const key of ["first", "second", "viewer"] as const) {
    const account = manifest.accounts[key]
    const base = new URL(account.baseURL)
    expect(base.origin).toBe(manifest.origin)
    expect(base.pathname).toBe("/sucafina")
    expect(base.search).toBe("")
    expect(base.hash).toBe("")
    expect(account.principal).toMatch(/^macos:.+:\d+$/)
  }
  expect(new Set(Object.values(manifest.accounts).map((account) => account.principal)).size).toBe(3)
  expect(manifest.records.supplier).not.toBe("")
  expect(manifest.records.comparison).toMatch(/^PR-2026-\d+$/)
  return manifest
}

export async function login(page: Page, key: "first" | "second" | "viewer", scenario: string): Promise<Account> {
  const manifest = await readManifest()
  const selected = manifest.accounts[key]
  const enrollment = selected.enrollments[scenario]
  if (!enrollment) throw new Error("The existing real-host enrollment is missing for " + key + "/" + scenario)
  const url = new URL(enrollment)
  expect(url.origin).toBe(manifest.origin)
  expect(url.pathname).toBe(new URL(selected.baseURL).pathname + "/auth/local")
  const admitted = await page.request.get(enrollment, { maxRedirects: 0, maxRetries: 0 })
  expect(admitted.status(), "The real local-operator enrollment must succeed once").toBe(303)
  const account = { baseURL: selected.baseURL, principal: selected.principal, origin: manifest.origin }
  const discovery = new URL("/api/sucafina/installations", account.origin)
  discovery.search = new URLSearchParams({ select: "location", "location[directory]": manifest.directory }).toString()
  const discovered = await page.request.get(discovery.href)
  expect(discovered.status()).toBe(200)
  const { installations } = Schema.decodeUnknownSync(SfInstallationList)(await discovered.json())
  expect(installations).toHaveLength(1)
  const binding = installations[0]!
  expect(binding.publicOrigin).toBe(account.origin)
  expect(binding.mount).toBe(new URL(account.baseURL).pathname)
  expect(binding.authMode).toBe("local-operator")
  const contextURL = new URL(binding.mount + "/api/ui/context", binding.publicOrigin)
  contextURL.search = new URLSearchParams({ installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId }).toString()
  const contextResponse = await page.request.get(contextURL.href)
  expect(contextResponse.status()).toBe(200)
  const context = Schema.decodeUnknownSync(SfContextResult)(await contextResponse.json())
  if (context.status !== "ok") throw new Error("Operations did not receive its original native context")
  expect(context.value.stamp).toMatchObject({ installationId: binding.installationId, projectId: binding.projectId,
    hostId: binding.hostId, principalRef: account.principal })

  // Subsequent journey navigations use bare chapter routes. Persist the real
  // installation directory through the shell's project picker first.
  expect((await page.goto(account.origin + "/"))?.status()).toBe(200)
  const profile = page.getByRole("button", { name: "Choose project", exact: true })
  await profile.click()
  await page.locator('[data-component="orchestra-profile-picker"]').getByRole("menuitem", { name: "Add project", exact: true }).click()
  const folders = page.getByRole("dialog", { name: "Open project", exact: true })
  await folders.getByPlaceholder("Search folders", { exact: true }).fill(manifest.directory)
  await folders.locator(`[data-directory-path=${JSON.stringify(manifest.directory)}]`).click()
  await expect(profile.locator("small")).toHaveAttribute("title", manifest.directory)

  const response = await page.goto(new URL("/orchestra/sf-procurement/requests/new", account.origin).href)
  expect(response?.status(), "The authenticated Procurement application must be mounted").toBe(200)
  await expect(page.getByRole("heading", { name: "Requests", exact: true })).toHaveCount(1)
  const create = page.locator("form[data-command='create'][data-page='Requests']").getByRole("button", { name: "Create request", exact: true })
  await expect(create).toHaveCount(key === "viewer" ? 0 : 1)
  if (key !== "viewer") await expect(create).toBeEnabled()
  return { ...account, projectId: binding.projectId, installationId: binding.installationId }
}

export function chapterURL(account: Account, path: string) {
  const url = new URL(path, account.origin)
  if (url.origin !== account.origin || !url.pathname.startsWith("/orchestra/"))
    throw new Error("Operations requires a native route on its selected host")
  url.searchParams.set("server", account.origin)
  url.searchParams.set("project", account.projectId)
  url.searchParams.set("installation", account.installationId)
  return url
}

export function modeURL(account: Account, surface: "planner" | "dashboard" | "procurement", mode: string, query: Record<string, string> = {}) {
  const url = new URL(account.baseURL + "/" + surface)
  url.search = new URLSearchParams({ sf: mode, ...query }).toString()
  return url
}

export async function observation(info: TestInfo, name: string, value: Record<string, unknown>) {
  await info.attach(name + ".json", {
    body: Buffer.from(JSON.stringify({ selection: "CI-UI-OPERATIONS", testId: info.testId, ...value, humanTimingMeasured: false, nativeParityMeasured: false })),
    contentType: "application/json",
  })
}

export async function captureProcurementCommand(page: Page, account: Account, confirm: Locator, expected: {
  page: "Requests" | "My approvals" | "Settings"; action: string; id?: string; version?: number; values?: Record<string, unknown>
}) {
  const endpoint = new URL(account.baseURL + "/procurement")
  const match = (url: URL) => url.origin === endpoint.origin && url.pathname === endpoint.pathname &&
    url.searchParams.size === 1 && url.searchParams.get("page") === expected.page
  const producer = Promise.withResolvers<{ response: APIResponse; command: unknown }>()
  let posts = 0
  const forward = async (route: Route) => {
    const request = route.request()
    if (request.method() !== "POST") return route.fallback()
    try {
      const command = request.postDataJSON() as { page?: unknown; action?: unknown; id?: unknown } | null
      if (command?.page !== expected.page || command.action !== expected.action || command.id !== expected.id) return route.fallback()
      expect(++posts, `one ${expected.page} ${expected.action} POST per confirmation`).toBe(1)
      expect(command).toMatchObject(expected)
      // Retain the real response before Chromium can discard its copy during readback.
      const response = await route.fetch({ maxRetries: 0, maxRedirects: 0 })
      await route.fulfill({ response })
      producer.resolve({ response, command })
    } catch (error) {
      producer.reject(error)
      await route.abort("failed").catch(() => undefined)
    }
  }
  await page.route(match, forward)
  try {
    const [{ response, command }] = await Promise.all([producer.promise, confirm.click()])
    const body: unknown = await response.json()
    expect(posts).toBe(1)
    return { status: response.status(), body, command }
  } finally {
    await page.unroute(match, forward)
  }
}
