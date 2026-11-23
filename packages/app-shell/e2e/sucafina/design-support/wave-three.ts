import { test, expect, type Page, type TestInfo } from "@playwright/test"
import { ServerConnection } from "../../../src/context/server-connection"
import { authenticateDesignInstallation, withDesignInstallation, type DesignInstallation } from "./installation"

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
// The real single-use enrollment and scoped session must never enter a trace.
waveThreeTest.use({ trace: "off", video: "off" })
waveThreeTest.describe.configure({ retries: 0 })
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
  // Each observed native page (including pt-BR) gets at most 128 ASCII lines, 1024 bytes each including newline.
  let importLifecycleLines = 0
  page.on("console", (entry) => {
    try {
      if (entry.type() !== "info" || importLifecycleLines >= 128) return
      const message = entry.text()
      const prefix = "SF_IMPORT_LIFECYCLE "
      if (!message.startsWith(prefix) || message.length + 1 > 1024 || !/^[\x20-\x7e]+$/.test(message)) return
      const value: unknown = JSON.parse(message.slice(prefix.length))
      if (!value || typeof value !== "object" || Array.isArray(value) ||
          !("schema" in value) || value.schema !== "sf-import-lifecycle-v1" ||
          !("qualification" in value) || value.qualification !== false ||
          !("source" in value) || !["imports", "transport"].includes(String(value.source)) ||
          !("label" in value) || typeof value.label !== "string" ||
          !("timeMs" in value) || typeof value.timeMs !== "number") return
      const valid = Object.entries(value).every(([key, item]) => {
        if (key === "schema" || key === "qualification" || key === "source") return true
        if (key === "chapter") return typeof item === "string" && ["UI55", "UI56", "UI57", "UI68"].includes(item)
        if (["label", "caller", "status", "phase", "reason", "check"].includes(key))
          return typeof item === "string" && /^[a-z-]{1,40}$/.test(item)
        if (["timeMs", "ticket", "generation", "size", "limit"].includes(key))
          return typeof item === "number" && Number.isFinite(item)
        if (["controllerPresent", "aborted", "busy", "tokenAborted", "resultPresent", "live",
          "initialScope", "routeKindChanged", "chapterChanged", "hrefChanged", "ownerStampChanged",
          "authStatusChanged"].includes(key)) return typeof item === "boolean"
        return false
      })
      if (!valid) return
      importLifecycleLines++
      console.info(message)
    } catch { /* Invalid diagnostics and logger failures must not affect the original test. */ }
  })
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
export async function enter(page: Page, owner: Owner, href: string, title: string, busyTimeoutMs = 10_000) {
  const target = new URL(href)
  target.searchParams.set("server", ServerConnection.key({ type: "http", http: { url: target.origin } }))
  target.searchParams.set("project", owner.projectId)
  target.searchParams.set("installation", owner.installationId)
  await page.goto(target.href)
  await ready(page, title, busyTimeoutMs)
  await expect(page).toHaveURL((url) => url.origin === target.origin && url.pathname === target.pathname &&
    url.searchParams.get("project") === owner.projectId && url.searchParams.get("installation") === owner.installationId)
  await reflow(page)
  await scrollPageTop(page)
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
