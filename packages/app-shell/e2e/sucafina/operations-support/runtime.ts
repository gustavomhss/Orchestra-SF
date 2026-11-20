import { readFile } from "node:fs/promises"
import path from "node:path"
import { expect, test } from "@playwright/test"
import type { Locator, Page, TestInfo } from "@playwright/test"
import { Schema } from "effect"
import { SfContextResult, SfInstallationList } from "@orchestra/schema/sucafina/context"
import { selectSfProfile } from "../native/select-profile"

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
      throw new Error("CI-UI-OPERATIONS requires the existing real Sucafina host manifest for operations.spec.ts. The production fixture owns its lifecycle; no synthetic fallback is permitted.")
    }
    throw error
  })
  const manifest = JSON.parse(source) as Manifest
  const origin = new URL(manifest.origin)
  expect(origin.protocol, "Operations must use the isolated local Actions fixture").toBe("http:")
  expect(["127.0.0.1", "localhost", "[::1]"]).toContain(origin.hostname)
  expect(origin.origin).toBe(manifest.origin)
  expect(origin.port).toBe("4174")
  expect(path.isAbsolute(manifest.directory)).toBe(true)
  for (const key of ["first", "second", "viewer"] as const) {
    const account = manifest.accounts[key]
    const base = new URL(account.baseURL)
    expect(base.origin).toBe(manifest.origin)
    expect(base.pathname).toBe("/sucafina")
    expect(base.search).toBe("")
    expect(base.hash).toBe("")
    expect(account.principal).toMatch(/^macos:.+:\d+$/)
    expect(account.projectId).toMatch(/\S+/)
    expect(account.installationId).toMatch(/\S+/)
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
  await test.step("Operations local operator enrollment", async () => {
    const admitted = await page.request.get(enrollment, { maxRedirects: 0, maxRetries: 0 })
    expect(admitted.status(), "The real local-operator enrollment must succeed once").toBe(303)
  })
  const account = { baseURL: selected.baseURL, principal: selected.principal, origin: manifest.origin,
    projectId: selected.projectId, installationId: selected.installationId }
  const binding = await test.step("Operations installation discovery", async () => {
    const discoveryURL = new URL("/api/sucafina/installations", manifest.origin)
    discoveryURL.search = new URLSearchParams({ select: "location", "location[directory]": manifest.directory }).toString()
    const discoveryResponse = await page.request.get(discoveryURL.toString())
    expect(discoveryResponse.status(), "The embedded host must expose its real installation").toBe(200)
    const discovery = Schema.decodeUnknownSync(SfInstallationList, { onExcessProperty: "error" })(await discoveryResponse.json())
    expect(discovery.installations).toHaveLength(1)
    const binding = discovery.installations[0]!
    expect(binding.publicOrigin).toBe(account.origin)
    expect(binding.projectId).toBe(account.projectId)
    expect(binding.installationId).toBe(account.installationId)
    expect(binding.mount).toBe("/sucafina")
    expect(binding.authMode).toBe("local-operator")
    return binding
  })
  await test.step("Operations native context admission", async () => {
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
  })
  await test.step("Operations native profile selection", () =>
    selectSfProfile(page, { origin: account.origin, directory: manifest.directory,
      chapterPath: "/orchestra/sf-procurement/requests/new" }))
  await test.step("Operations Requests ready for the original operator", async () => {
    const response = await page.goto(chapterURL(account, "/orchestra/sf-procurement/requests/new").href)
    expect(response?.status(), "The authenticated Procurement application must be mounted").toBe(200)
    await expect(page.locator('[data-component="sf-requests-pr-po"]').getByRole("heading", { name: "Requests", exact: true })).toHaveCount(1)
    const create = page.locator("form[data-command='create'][data-page='Requests']").getByRole("button", { name: "Create request", exact: true })
    await expect(create).toHaveCount(key === "viewer" ? 0 : 1)
    if (key !== "viewer") await expect(create).toBeEnabled()
  })
  return account
}

/** Use only the owner triplet issued by the real fixture; retain each native route's query. */
export function chapterURL(account: Account, pathname: string) {
  const url = new URL(pathname, account.origin)
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

type PausedCommand = {
  requestId: string
  request: { url: string; method: string; postData?: string }
  responseStatusCode?: number
  responseHeaders?: { name: string; value: string }[]
}

/** Capture the original response before a native reread can evict its body.
 * The response stage preserves the same request, status, headers and bytes:
 * no replacement request, command retry, synthetic grant or substitute result.
 */
export async function captureCommandResponse(page: Page, account: Account,
  surface: "planner" | "procurement", expected: { action: string; page?: string; id?: string }, button: Locator) {
  await expect(button).toBeEnabled()
  const session = await page.context().newCDPSession(page)
  const captured = Promise.withResolvers<{ status: number; body: unknown; command: unknown }>()
  // Observe teardown rejection without replacing the promise awaited below.
  void captured.promise.catch(() => undefined)
  const endpoint = new URL(account.baseURL + "/" + surface)
  let count = 0
  session.on("Fetch.requestPaused", async (event: PausedCommand) => {
    try {
      const url = new URL(event.request.url)
      if (event.request.method !== "POST" || url.origin !== endpoint.origin ||
          url.pathname !== endpoint.pathname || url.searchParams.has("sf")) {
        await session.send("Fetch.continueRequest", { requestId: event.requestId })
        return
      }
      expect(++count, "One native confirmation sends exactly one original domain command").toBe(1)
      if (typeof event.request.postData !== "string") throw new Error("Original domain command body is missing")
      const command: unknown = JSON.parse(event.request.postData)
      expect(command).toMatchObject(expected)
      const status = event.responseStatusCode
      if (typeof status !== "number") throw new Error("Original domain command status is missing")
      const headers = event.responseHeaders ?? []
      expect(headers.find((header) => header.name.toLowerCase() === "content-type")?.value).toContain("application/json")
      const raw = await session.send("Fetch.getResponseBody", { requestId: event.requestId })
      const bytes = raw.base64Encoded ? Buffer.from(raw.body, "base64") : Buffer.from(raw.body, "utf8")
      const body: unknown = JSON.parse(bytes.toString("utf8"))
      await session.send("Fetch.fulfillRequest", { requestId: event.requestId, responseCode: status,
        responseHeaders: headers, body: bytes.toString("base64") })
      captured.resolve({ status, body, command })
    } catch (error) {
      try { await session.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "Failed" }) }
      catch { /* Keep the original observation failure if Chromium already released the response. */ }
      captured.reject(error)
    }
  })
  await session.send("Fetch.enable", {
    patterns: [{ urlPattern: endpoint.href + "*", requestStage: "Response" }],
  })
  try {
    await button.click()
    const original = await captured.promise
    expect(count).toBe(1)
    return original
  } finally {
    await session.send("Fetch.disable")
    await session.detach()
  }
}

export async function observation(info: TestInfo, name: string, value: Record<string, unknown>) {
  await info.attach(name + ".json", {
    body: Buffer.from(JSON.stringify({ selection: "CI-UI-OPERATIONS", testId: info.testId, ...value, humanTimingMeasured: false, nativeParityMeasured: false })),
    contentType: "application/json",
  })
}