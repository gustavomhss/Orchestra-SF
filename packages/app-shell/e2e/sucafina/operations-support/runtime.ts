import { readFile } from "node:fs/promises"
import path from "node:path"
import { expect, test } from "@playwright/test"
import type { Page, TestInfo } from "@playwright/test"
import { Schema } from "effect"
import { SfContextResult, SfInstallationList } from "@orchestra/schema/sucafina/context"

export type Account = { baseURL: string; principal: string; origin: string }
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
      throw new Error("CI-UI-OPERATIONS requires the existing Sucafina host to be mounted for operations.spec.ts. The production selection currently starts it only for wp04/procurement.spec.ts; see the Operations dependency receipt. No synthetic fallback is permitted.")
    }
    throw error
  })
  const manifest = JSON.parse(source) as Manifest
  const origin = new URL(manifest.origin)
  expect(origin.protocol, "Operations must use the isolated local Actions fixture").toBe("http:")
  expect(["127.0.0.1", "localhost", "[::1]"]).toContain(origin.hostname)
  expect(origin.origin).toBe(manifest.origin)
  expect(origin.port).toBe("3000")
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
  // Bounded failure codes only: never emit form values, auth data or response bodies.
  page.on("console", (message) => {
    const text = message.text()
    if (text.startsWith("SF_PROCUREMENT_COMMAND_BOUNDARY ")) console.info(text.slice(0, 512))
  })
  const manifest = await readManifest()
  const selected = manifest.accounts[key]
  const enrollmentKey = path.basename(test.info().file) + ":" + scenario
  const enrollment = selected.enrollments[enrollmentKey]
  if (!enrollment) throw new Error("The existing real-host enrollment is missing for " + key + "/" + enrollmentKey)
  const url = new URL(enrollment)
  expect(url.origin).toBe(manifest.origin)
  expect(url.pathname).toBe(new URL(selected.baseURL).pathname + "/auth/local")
  const admitted = await page.request.get(enrollment, { maxRedirects: 0, maxRetries: 0 })
  expect(admitted.status(), "The real local-operator enrollment must succeed once").toBe(303)
  const account = { baseURL: selected.baseURL, principal: selected.principal, origin: manifest.origin }
  const discoveryURL = new URL("/api/sucafina/installations", manifest.origin)
  discoveryURL.search = new URLSearchParams({ select: "location", "location[directory]": manifest.directory }).toString()
  const discoveryResponse = await page.request.get(discoveryURL.toString())
  expect(discoveryResponse.status(), "The embedded host must expose its real installation").toBe(200)
  const discovery = Schema.decodeUnknownSync(SfInstallationList, { onExcessProperty: "error" })(await discoveryResponse.json())
  expect(discovery.installations).toHaveLength(1)
  const binding = discovery.installations[0]!
  expect(binding.publicOrigin).toBe(account.origin)
  expect(binding.mount).toBe("/sucafina")
  expect(binding.authMode).toBe("local-operator")
  const contextURL = new URL(binding.mount + "/api/ui/context", binding.publicOrigin)
  contextURL.search = new URLSearchParams({ installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId }).toString()
  const contextResponse = await page.request.get(contextURL.toString())
  expect(contextResponse.status(), "The original operator session must admit the native context").toBe(200)
  const context = Schema.decodeUnknownSync(SfContextResult, { onExcessProperty: "error" })(await contextResponse.json())
  if (context.status !== "ok") throw new Error("OPERATIONS_NATIVE_CONTEXT_NOT_ADMITTED")
  expect(context.value.stamp).toMatchObject({
    installationId: binding.installationId, projectId: binding.projectId,
    hostId: binding.hostId, principalRef: account.principal,
  })
  await page.goto(account.origin + "/")
  const project = page.getByRole("button", { name: "Choose project", exact: true })
  await project.click()
  await page.locator('[data-component="orchestra-profile-picker"]').getByRole("menuitem", { name: "Add project", exact: true }).click()
  const folders = page.getByRole("dialog")
  await folders.getByPlaceholder("Search folders", { exact: true }).fill(manifest.directory)
  await folders.locator(`[data-directory-path=${JSON.stringify(manifest.directory)}]`).click()
  await expect(project.locator("small")).toHaveAttribute("title", manifest.directory)
  const response = await page.goto(new URL("/orchestra/sf-procurement/requests/new", account.origin).href)
  expect(response?.status(), "The authenticated Procurement application must be mounted").toBe(200)
  try {
    await expect(page.locator('[data-component="sf-requests-pr-po"]').getByRole("heading", { name: "Requests", exact: true })).toHaveCount(1)
  } catch (error) {
    // Bounded rendered state only: no enrollment URL, credential, cookie or response body.
    const [headings, statuses, alerts, requests, hostStates, owners, serverUnavailable] = await Promise.all([
      page.getByRole("heading").allTextContents(),
      page.getByRole("status").allTextContents(),
      page.getByRole("alert").allTextContents(),
      page.locator('[data-component="sf-requests-pr-po"]').count(),
      page.locator("[data-sf-host]").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-sf-host"))),
      page.locator("[data-sf-f01]").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-sf-f01"))),
      page.locator('[data-slot="server-unavailable"]').count(),
    ])
    const bounded = (values: string[]) => values.slice(0, 12).map((value) => value.slice(0, 240))
    console.info("OPERATIONS_NATIVE_RENDER " + JSON.stringify({
      path: new URL(page.url()).pathname, requests, hostStates, owners, serverUnavailable,
      headings: bounded(headings), statuses: bounded(statuses), alerts: bounded(alerts),
    }))
    throw error
  }
  const create = page.locator("form[data-command='create'][data-page='Requests']").getByRole("button", { name: "Create request", exact: true })
  await expect(create).toHaveCount(key === "viewer" ? 0 : 1)
  if (key !== "viewer") await expect(create).toBeEnabled()
  return account
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