import { expect, type Browser, type Page, type Request, type TestInfo } from "@playwright/test"
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
  const response = await page.request.post(owner.publicOrigin + owner.mount + "/dashboard?sf=" + operation, {
    headers: { origin: owner.publicOrigin, "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
    data: input,
  })
  const body = object(await response.json())
  console.info("SF_ANALYTICS_SOURCE " + JSON.stringify({ operation, http: response.status(), status: body.status, reason: body.reason }))
  expect(response.status()).toBe(200)
  expect(body.status).toBe("ok")
  return body.value
}
/** Report the actual native ctx.context reads without changing their admission. */
export function observeAnalyticsContext(page: Page, owner: AnalyticsOwner) {
  const reads: Promise<{ http: number; body: unknown }>[] = []
  page.on("response", (response) => {
    if (response.request().method() !== "GET" || !new URL(response.url()).pathname.endsWith("/api/ui/context")) return
    reads.push(response.json().then((body: unknown) => ({ http: response.status(), body })))
  })
  return async (stage: string) => {
    expect(reads.length).toBeGreaterThan(0)
    for (const pending of reads.splice(0)) {
      const { http, body: raw } = await pending
      const body = object(raw)
      expect(http).toBe(200)
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
      console.info("SF_ANALYTICS_CONTEXT " + JSON.stringify({ stage, http, status: body.status,
        ownerBinding: "exact", resources }))
    }
  }
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
export async function captureModes(page: Page, info: TestInfo, prefix: string) {
  await page.setViewportSize({ width: 1440, height: 1100 })
  await scheme(page, "dark")
  await scrollPageTop(page)
  await captureAnalytics(page, info, prefix + "-dark-desktop-test-data")
  await scheme(page, "light")
  await captureAnalytics(page, info, prefix + "-light-desktop-test-data")
  // The native shell places its theme toggle outside the compact navigation.
  // Choose each actual theme while that control is visible, then measure narrow CSS reflow.
  await scheme(page, "dark")
  await page.setViewportSize({ width: 390, height: 844 })
  await scrollPageTop(page)
  await captureAnalytics(page, info, prefix + "-dark-390-test-data")
  await page.setViewportSize({ width: 1440, height: 1100 })
  await scheme(page, "light")
  await page.setViewportSize({ width: 320, height: 800 })
  await scrollPageTop(page)
  await captureAnalytics(page, info, prefix + "-light-320-test-data")
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
