import { test, expect, type Page, type Response, type TestInfo } from "@playwright/test"
import { ServerConnection } from "../../../src/context/server-connection"
import { authenticateDesignInstallation, withDesignInstallation, type DesignInstallation } from "./installation"
import { originalReads, type OriginalRead } from "./original-read"
export { armOriginalRead, originalRead, originalReads, type OriginalRead } from "./original-read"

type Owner = Awaited<ReturnType<typeof authenticateDesignInstallation>>
export const waveThreeTest = test.extend<{ installation: DesignInstallation; owner: Owner }>({
  installation: [async ({}, use) => { await withDesignInstallation(use, "three") }, { timeout: 190_000 }],
  context: async ({ browser, installation }, use) => {
    const context = await browser.newContext({
      locale: "en-US", viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1,
      reducedMotion: "reduce", colorScheme: "dark",
      httpCredentials: { username: "orchestra", password: installation.serverPassword },
    })
    try { await use(context) } finally { await context.close() }
  },
  owner: async ({ context, installation }, use) => {
    await use(await authenticateDesignInstallation(context, installation))
  },
})
const previewBytes = new WeakMap<TestInfo, number>()
const diagnostics = new WeakMap<Page, { consoleErrors: string[]; pageErrors: string[] }>()

export function observePage(page: Page) {
  const messages = { consoleErrors: [] as string[], pageErrors: [] as string[] }
  diagnostics.set(page, messages)
  const record = (list: string[], value: string) => {
    const safe = redact(value).slice(0, 1024)
    if (!list.includes(safe)) list.push(safe)
    if (list.length > 8) list.shift()
  }
  page.on("pageerror", (error) => record(messages.pageErrors, error.stack ?? error.message))
  page.on("console", (entry) => { if (entry.type() === "error") record(messages.consoleErrors, entry.text()) })
  page.once("close", () => {
    console.info("SF_DESIGN_DIAGNOSTICS " + JSON.stringify({ kind: "wave-three-page-closed", ...messages }))
  })
  return messages
}

waveThreeTest.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return
  console.info("SF_DESIGN_DIAGNOSTICS " + JSON.stringify({ kind: "wave-three-failure", ...diagnostics.get(page) }))
  if (page.isClosed()) return
  try {
    const state = await page.locator('[data-sf-host="owner-runtime231"]').evaluate((host) => ({
      discovery: host.getAttribute("data-sf-discovery-state"),
      provider: host.getAttribute("data-sf-provider-state"),
      view: host.getAttribute("data-sf-view-state"),
      text: host.textContent?.slice(0, 2400),
    }))
    console.info("SF_DESIGN_DIAGNOSTICS " + JSON.stringify({ kind: "native-view", state }))
    await capture(page, info, "FAILED-native-wave-three-test-data")
  } catch {
    await info.attach("FAILED-capture-unavailable", { body: "The real browser could not produce a diagnostic screenshot.", contentType: "text/plain" })
  }
})

/** Absolute source URL; owner-bound bookmark navigation uses the real installed host. */
export async function enter(page: Page, owner: Owner, href: string, title: string, busyTimeoutMs = 10_000,
  operation?: OriginalRead | readonly OriginalRead[], beforeReady?: () => Promise<unknown>) {
  const target = new URL(href)
  target.searchParams.set("server", ServerConnection.key({ type: "http", http: { url: target.origin } }))
  target.searchParams.set("project", owner.projectId)
  target.searchParams.set("installation", owner.installationId)
  // The owner has two distinct original reads: provider admission, then route
  // admission. Keep Playwright's existing response deadline for both replies;
  // the caller's unchanged DOM budget starts after the actual read contracts.
  // A matching response proves the original HTTP status. The existing ready()
  // assertions below prove that the app consumed and rendered the admissions;
  // Response.finished() can remain pending after that state in routed Chromium.
  const contexts: { status: number; elapsedMs: number }[] = []
  const started = performance.now()
  const contextResponse = (response: Response) => {
    const url = new URL(response.url())
    return response.request().method() === "GET" && url.origin === target.origin &&
      url.pathname === owner.mount + "/api/ui/context" &&
      url.searchParams.get("projectId") === owner.projectId &&
      url.searchParams.get("installationId") === owner.installationId &&
      url.searchParams.get("hostId") === owner.hostId
  }
  let routeAdmission: Promise<Response> | undefined
  const providerAdmission = page.waitForResponse((response) => {
    if (!contextResponse(response)) return false
    if (response.status() === 200)
      routeAdmission = page.waitForResponse(contextResponse)
    return true
  })
  const originalAdmissions = async () => {
    const provider = await providerAdmission
    contexts.push({ status: provider.status(), elapsedMs: performance.now() - started })
    expect(provider.status(), "the original provider context is authorized").toBe(200)
    expect(routeAdmission, "route admission rereads the original context").toBeDefined()
    const route = await routeAdmission!
    contexts.push({ status: route.status(), elapsedMs: performance.now() - started })
    console.info("SF_OWNER_ADMISSION_READS " + JSON.stringify({ contexts }))
    expect(route.status(), "the original route context is authorized").toBe(200)
  }
  const navigate = () => Promise.all([page.goto(target.href), originalAdmissions()])
  const observed = operation
    ? await originalReads(page, owner, Array.isArray(operation) ? operation : [operation as OriginalRead], navigate)
    : (await navigate(), undefined)
  await beforeReady?.()
  await ready(page, title, busyTimeoutMs)
  await expect(page).toHaveURL((url) => url.origin === target.origin && url.pathname === target.pathname &&
    url.searchParams.get("project") === owner.projectId && url.searchParams.get("installation") === owner.installationId)
  await reflow(page)
  await scrollPageTop(page)
  return observed?.receipts
}

export async function ready(page: Page, title: string, busyTimeoutMs = 10_000) {
  const host = page.locator('[data-sf-host="owner-runtime231"]')
  await expect(host).toHaveCount(1)
  for (const attribute of ["data-sf-discovery-state", "data-sf-provider-state", "data-sf-view-state"])
    await expect(host).toHaveAttribute(attribute, "ready")
  await expect(host.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible()
  await expect(host.locator('[data-sf-frame="page"]')).toHaveCount(1)
  await expect(host.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: busyTimeoutMs })
}

export async function scheme(page: Page, expected: "dark" | "light") {
  const html = page.locator("html")
  await expect(html).toHaveAttribute("data-color-scheme", /^(dark|light)$/)
  if (await html.getAttribute("data-color-scheme") !== expected)
    await page.locator('[data-slot="orchestra-theme-toggle"]').click()
  await expect(html).toHaveAttribute("data-color-scheme", expected)
}

export async function scrollPageTop(page: Page) {
  const scroller = page.locator('[data-sf-frame="page"] .mx-page')
  await scroller.evaluate((element) => element.scrollTo({ top: 0, left: 0, behavior: "instant" }))
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop), {
    message: "the actual native page scroller starts the capture at the top",
  }).toBe(0)
}

export async function reflow(page: Page) {
  await expect.poll(() => page.locator('[data-sf-frame="page"]').evaluate((element) => {
    const scroller = element.querySelector(".mx-page")
    if (!(scroller instanceof HTMLElement)) throw new Error("Native page scroller missing")
    return Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth,
      scroller.scrollWidth - scroller.clientWidth)
  }), { message: "the native document and page do not overflow horizontally" }).toBeLessThanOrEqual(1)
}

export async function reviewActions(page: Page) {
  const actions = page.locator('[data-component="sf-change-review"] .sf-s03-actions')
  await actions.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }))
  await expect(actions).toBeInViewport({ ratio: 1 })
  for (const button of await actions.getByRole("button").all()) await expect(button).toBeInViewport({ ratio: 1 })
}

export async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  const path = info.outputPath(name + ".png")
  await page.screenshot({ path, fullPage: true, animations: "disabled" })
  await info.attach(name, { path, contentType: "image/png" })
  const jpeg = await page.screenshot({ type: "jpeg", quality: 78, fullPage: true, animations: "disabled" })
  const used = previewBytes.get(info) ?? 0
  if (jpeg.byteLength > 480 * 1024 || (!name.startsWith("FAILED-") && used + jpeg.byteLength > 6 * 1024 * 1024)) {
    console.info("SF_DESIGN_PREVIEW " + JSON.stringify({ name, skipped: "bounded preview budget; canonical PNG attached" }))
    return
  }
  previewBytes.set(info, used + jpeg.byteLength)
  const encoded = jpeg.toString("base64")
  const parts = Math.ceil(encoded.length / 24000)
  for (let part = 0; part < parts; part++)
    console.info("SF_DESIGN_PREVIEW " + JSON.stringify({ name, part: part + 1, parts, data: encoded.slice(part * 24000, (part + 1) * 24000) }))
}

function redact(value: string) {
  return value.replace(/[a-f0-9]{64}/g, "[redacted]")
    .replace(/https?:\/\/[^\s"'<>]+/g, "[url]")
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi, "[credential]")
    .replace(/\b(code|token|password|secret|authorization)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s&,]+)/gi, "$1=[redacted]")
}
