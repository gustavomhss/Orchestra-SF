import { expect, type Browser, type Locator, type Page, type Request, type Response, type TestInfo } from "@playwright/test"
import type { DesignInstallation } from "./installation"
import { waveFourTest, capture, enter, reflow, scheme, scrollPageTop } from "./wave-four"

export const analyticsTest = waveFourTest
analyticsTest.use({ designWave: "four-decisions" })
export type AnalyticsOwner = Parameters<typeof enter>[1]

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected the original analytics response")
  return value as Record<string, unknown>
}
export function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Expected an original source list")
  return value
}
export function sourceText(value: unknown): string {
  if (typeof value !== "string" || !value) throw new Error("Expected an original source reference")
  return value
}
export function isOperation(request: Request, operation: string) {
  return request.method() === "POST" && new URL(request.url()).searchParams.get("sf") === operation
}
export async function controls(page: Page, owner: AnalyticsOwner, reference?: string) {
  const response = await page.request.get(owner.publicOrigin + owner.mount + "/dashboard", {
    params: { sf: "decision-controls", format: "json", ...(reference ? { case: reference } : {}) },
  })
  const body = object(await response.json())
  console.info("SF_ANALYTICS_SOURCE " + JSON.stringify({ operation: "decision-controls", http: response.status(), status: body.status, reason: body.reason }))
  expect(response.status()).toBe(200)
  expect(body.status).toBe("ok")
  return object(body.value)
}
export async function readPortfolio(page: Page, owner: AnalyticsOwner, operation: string, input: unknown) {
  const started = performance.now()
  console.info("SF_ANALYTICS_SOURCE " + JSON.stringify({ operation, phase: "source-request", method: "POST", ownerBinding: "exact" }))
  const response = await page.request.post(owner.publicOrigin + owner.mount + "/dashboard?sf=" + operation, {
    headers: { origin: owner.publicOrigin, "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
    data: input,
  })
  const body = object(await response.json())
  console.info("SF_ANALYTICS_SOURCE " + JSON.stringify({ operation, http: response.status(), status: body.status,
    reason: body.reason, elapsedMs: Math.round(performance.now() - started) }))
  expect(response.status()).toBe(200)
  expect(body.status).toBe("ok")
  return body.value
}
/**
 * Reopen the exact mounted ctx.context URL observed in the native journey.
 * APIRequestContext retains its body across page navigations; collecting every
 * CDP response body also collects requests cancelled by those navigations.
 */
export function observeAnalyticsContext(page: Page, owner: AnalyticsOwner) {
  const requests: string[] = []
  const onRequest = (request: Request) => {
    if (request.method() === "GET" && new URL(request.url()).pathname.endsWith("/api/ui/context"))
      requests.push(request.url())
  }
  page.on("request", onRequest)
  return async (stage: string, stop = false) => {
    if (stop) page.off("request", onRequest)
    expect(requests.length, "The native journey must request its original context").toBeGreaterThan(0)
    const url = new URL(sourceText(requests.at(-1)))
    expect(url.origin).toBe(owner.publicOrigin)
    expect(url.pathname).toBe(owner.mount + "/api/ui/context")
    expect(url.searchParams.size).toBe(3)
    expect(url.searchParams.get("installationId")).toBe(owner.installationId)
    expect(url.searchParams.get("projectId")).toBe(owner.projectId)
    expect(url.searchParams.get("hostId")).toBe(owner.hostId)
    const response = await page.request.get(url.href)
    const body = object(await response.json())
    expect(response.status()).toBe(200)
    expect(body.status).toBe("ok")
    const context = object(body.value)
    expect(object(context.stamp)).toEqual(expect.objectContaining({
      installationId: owner.installationId, projectId: owner.projectId, hostId: owner.hostId,
    }))
    const resources = array(context.availability).map(object)
      .filter((resource) => resource.family === "portfolio" || array(resource.operations).map(object)
        .some((operation) => operation.operationId === "decisions.controls.read"))
      .map((resource) => ({ family: resource.family, resource: resource.resource, state: resource.state,
        operations: array(resource.operations).map(object)
          .filter((operation) => String(operation.operationId).startsWith("portfolio.") ||
            operation.operationId === "decisions.controls.read")
          .map((operation) => ({ operationId: operation.operationId, state: operation.state,
            operational: operation.operational, reason: operation.reason ?? null })) }))
    console.info("SF_ANALYTICS_CONTEXT " + JSON.stringify({ stage, http: response.status(), status: body.status,
      acquisition: "authenticated-original-readback", ownerBinding: "exact", resources }))
  }
}
/** Bounded original request timing and public codes; acquisition failures never create readiness. */
export function observeAnalyticsOperations(page: Page, owner: AnalyticsOwner) {
  const modes = new Set(["decision-portfolio-preview", "decision-portfolio-evaluate", "decision-portfolio-results",
    "decision-portfolio-read", "decision-sensitivity-units", "decision-sensitivity-read", "decision-sensitivity-evaluate"])
  const pending = new WeakMap<Request, { operation: string; started: number; sequence: number; ownerBinding: string }>()
  let sequence = 0
  page.on("request", (request) => {
    const url = new URL(request.url()), operation = url.searchParams.get("sf")
    if (request.method() !== "POST" || !operation || !modes.has(operation)) return
    const observed = { operation, started: performance.now(), sequence: ++sequence,
      ownerBinding: url.origin === owner.publicOrigin && url.pathname === owner.mount + "/dashboard" ? "exact" : "mismatch" }
    pending.set(request, observed)
    console.info("SF_ANALYTICS_SOURCE " + JSON.stringify({ operation, phase: "native-request", sequence: observed.sequence,
      method: request.method(), ownerBinding: observed.ownerBinding }))
  })
  page.on("requestfailed", (request) => {
    const observed = pending.get(request)
    if (!observed) return
    console.info("SF_ANALYTICS_SOURCE " + JSON.stringify({ operation: observed.operation, phase: "native-request-failed",
      sequence: observed.sequence, ownerBinding: observed.ownerBinding, elapsedMs: Math.round(performance.now() - observed.started) }))
  })
  page.on("response", (response) => {
    const observed = pending.get(response.request())
    if (!observed) return
    const timing = { sequence: observed.sequence, ownerBinding: observed.ownerBinding,
      elapsedMs: Math.round(performance.now() - observed.started) }
    void response.json().then((raw: unknown) => {
      const body = object(raw)
      console.info("SF_ANALYTICS_SOURCE " + JSON.stringify({ operation: observed.operation, phase: "native-response", ...timing,
        http: response.status(), status: body.status, reason: body.reason ?? null,
        valueShape: Array.isArray(body.value) ? "array" : typeof body.value }))
    }).catch(() => console.info("SF_ANALYTICS_SOURCE " + JSON.stringify({ operation: observed.operation, phase: "native-response", ...timing,
      http: response.status(), acquisitionFailure: "response-body-unavailable" })))
  })
}
export async function captureAnalytics(page: Page, info: TestInfo, name: string) {
  await reflow(page)
  const root = page.locator('[data-sf-wave="five"]')
  await expect(root).toHaveCount(1)
  const box = await root.boundingBox()
  expect(box?.width).toBeLessThanOrEqual(1160)
  await capture(page, info, name)
  console.info("SF_ANALYTICS_CAPTURE " + JSON.stringify({ name, width: page.viewportSize()?.width,
    surface: await root.getAttribute("data-sf-surface"), stage: await root.getAttribute("data-sf-stage") }))
}
export async function captureModes(page: Page, info: TestInfo, prefix: string, focus?: Locator) {
  const captureMode = async (suffix: string) => {
    await scrollPageTop(page)
    if (focus) {
      // Oversized scroll containers center on middle rows; anchor their real heading instead.
      const heading = focus.locator("caption, thead").first()
      if (await heading.count()) await heading.scrollIntoViewIfNeeded()
      else await focus.scrollIntoViewIfNeeded()
    }
    await captureAnalytics(page, info, prefix + suffix + "-test-data")
    const plot = focus?.locator(".sf-bi-plot-region").first()
    if ((page.viewportSize()?.width ?? 1440) <= 390 && plot && await plot.count()) {
      const overflow = await plot.evaluate((element) => element.scrollWidth > element.clientWidth)
      expect(overflow).toBe(true)
      await plot.evaluate((element) => { element.scrollLeft = element.scrollWidth })
      expect(await plot.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
      await captureAnalytics(page, info, prefix + suffix + "-scrolled-values-test-data")
      await plot.evaluate((element) => { element.scrollLeft = 0 })
    }
  }
  await page.setViewportSize({ width: 1440, height: 1100 })
  await scheme(page, "dark")
  await captureMode("-dark-desktop")
  await scheme(page, "light")
  await captureMode("-light-desktop")
  // The native shell places its theme toggle outside the compact navigation.
  // Choose each actual theme while that control is visible, then measure narrow CSS reflow.
  await scheme(page, "dark")
  await page.setViewportSize({ width: 390, height: 844 })
  await captureMode("-dark-390")
  await page.setViewportSize({ width: 1440, height: 1100 })
  await scheme(page, "light")
  await page.setViewportSize({ width: 320, height: 800 })
  await captureMode("-light-320")
  await page.setViewportSize({ width: 1440, height: 1100 })
  await scheme(page, "dark")
}
export async function withPortuguese(page: Page, browser: Browser, installation: DesignInstallation, use: (localized: Page) => Promise<void>) {
  const cookies = await page.context().cookies(installation.origin + installation.mount)
  expect(cookies.filter((cookie) => /^sucafina_operator_[a-f0-9]{24}$/.test(cookie.name))).toHaveLength(1)
  const context = await browser.newContext({
    locale: "pt-BR", viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1,
    reducedMotion: "reduce", colorScheme: "dark",
    httpCredentials: { username: "orchestra", password: installation.serverPassword },
    storageState: { cookies, origins: [{ origin: installation.origin, localStorage: [
      { name: "orchestra.global.dat:language", value: JSON.stringify({ locale: "br" }) },
    ] }] },
  })
  try { await use(await context.newPage()) } finally { await context.close() }
}
export { enter, reflow, scheme, scrollPageTop, observePage, ready } from "./wave-four"
