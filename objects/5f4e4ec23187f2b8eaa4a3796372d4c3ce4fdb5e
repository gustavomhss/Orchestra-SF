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
/**
 * Observe the original native BI GET without intercepting its request or response.
 * A new GET would advance BI06's observation clock and cannot supply its oracle.
 */
export async function captureOriginalBiData(
  page: Page, owner: AnalyticsOwner, viewId: string,
  acquire: (observe: (response: Response) => Promise<void>) => Promise<Response>,
) {
  const matches = (method: string, href: string) => {
    const url = new URL(href)
    return method === "GET" && url.origin === owner.publicOrigin && url.pathname === owner.mount + "/dashboard" &&
      url.searchParams.get("sf") === "bi-data" && url.searchParams.get("viewId") === viewId
  }
  const session = await page.context().newCDPSession(page)
  const producer = Promise.withResolvers<{ url: string; status: number; body: unknown }>()
  const completion = Promise.withResolvers<Request>()
  void producer.promise.catch(() => undefined) // The original response wait receives the failure below.
  void completion.promise.catch(() => undefined)
  const requests: Request[] = []
  const observed: { response: Response; body: unknown }[] = []
  const failures: string[] = []
  const completedRequests: Request[] = []
  let primaryFailure: { error: unknown } | undefined
  let responses = 0, networkRequests = 0, networkCompletions = 0
  let networkRequest: { id: string; url: string } | undefined
  let networkResponse: { id: string; url: string; status: number } | undefined
  type TeardownPhase = "observing" | "detaching" | "detached"
  let teardownPhase: TeardownPhase = "observing"
  const fail = (phase: string, error: unknown, requestFailure?: {
    sameNativeRequest: boolean; bodyObserved: boolean; http: number | null; teardownPhase: TeardownPhase; errorText: string
  } | { networkLoadingFailed: true; errorText: string; canceled: boolean }) => {
    failures.push(phase)
    primaryFailure ??= { error }
    console.info("SF_ANALYTICS_SOURCE " + JSON.stringify({ operation: "bi-data-original-acquisition",
      view: viewId, acquisition: "native-response-cdp", phase, acquisitionFailure: true,
      errorClass: error instanceof SyntaxError ? "SyntaxError" : error instanceof Error ? "Error" : "NonError", ...requestFailure }))
    producer.reject(error)
    completion.reject(error)
  }
  const onRequest = (request: Request) => {
    if (matches(request.method(), request.url())) requests.push(request)
  }
  const onRequestFinished = (request: Request) => {
    if (!matches(request.method(), request.url())) return
    completedRequests.push(request)
    completion.resolve(request)
  }
  const onRequestFailed = (request: Request) => {
    if (!matches(request.method(), request.url())) return
    const original = observed.length === 1 ? observed[0] : undefined
    const sameNativeRequest = original?.response.request() === request
    const nativeError = request.failure()?.errorText
    const errorText = typeof nativeError === "string" && /^net::ERR_[A-Z0-9_]{1,80}$/.test(nativeError)
      ? nativeError : "unclassified"
    const requestFailure = { sameNativeRequest, bodyObserved: observed.length > 0,
      http: original?.response.status() ?? null, teardownPhase, errorText }
    fail("native-request-failed", new Error("Original BI request failed"), requestFailure)
  }
  const onPageClose = () => fail("page-closed", new Error("Page closed during original BI acquisition"))
  const onSessionClose = () => fail("session-closed", new Error("CDP session closed during original BI acquisition"))
  const onNetworkRequest = (event: {
    requestId: string; request: { method: string; url: string }; redirectResponse?: unknown
  }) => {
    if (!matches(event.request.method, event.request.url)) return
    try {
      expect(++networkRequests, "one original BI network request").toBe(1)
      expect(event.redirectResponse, "no redirected original BI network request").toBeUndefined()
      networkRequest = { id: event.requestId, url: event.request.url }
    } catch (error) { fail("network-request-identity", error) }
  }
  const onNetworkResponse = (event: { requestId: string; response: { url: string; status: number } }) => {
    const original = networkRequest
    if (!original || event.requestId !== original.id) return
    try {
      expect(++responses, "one original BI response").toBe(1)
      expect(event.response.url).toBe(original.url)
      networkResponse = { id: event.requestId, url: event.response.url, status: event.response.status }
    } catch (error) { fail("network-response-identity", error) }
  }
  const onNetworkFinished = async (event: { requestId: string }) => {
    const request = networkRequest
    if (!request || event.requestId !== request.id) return
    let phase = "network-request-completion"
    try {
      expect(++networkCompletions, "one completed original BI network request").toBe(1)
      const original = networkResponse
      if (!original || original.id !== event.requestId) throw new Error("Original BI network response missing")
      phase = "original-response-body"
      // Read only the retained bytes of this completed network request. No Fetch
      // interception, loadNetworkResource, browser fetch, readback or replay.
      const raw = await session.send("Network.getResponseBody", { requestId: event.requestId })
      phase = "original-response-json"
      const text = raw.base64Encoded
        ? new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(raw.body, "base64"))
        : raw.body
      const body: unknown = JSON.parse(text)
      producer.resolve({ url: original.url, status: original.status, body })
    } catch (error) { fail(phase, error) }
  }
  const onNetworkFailed = (event: { requestId: string; errorText: string; canceled?: boolean }) => {
    if (event.requestId !== networkRequest?.id) return
    const errorText = /^net::ERR_[A-Z0-9_]{1,80}$/.test(event.errorText) ? event.errorText : "unclassified"
    fail("network-loading-failed", new Error("Original BI request failed"),
      { networkLoadingFailed: true, errorText, canceled: event.canceled === true })
  }
  page.on("request", onRequest)
  page.on("requestfinished", onRequestFinished)
  page.on("requestfailed", onRequestFailed)
  page.on("close", onPageClose)
  session.on("close", onSessionClose)
  session.on("Network.requestWillBeSent", onNetworkRequest)
  session.on("Network.responseReceived", onNetworkResponse)
  session.on("Network.loadingFinished", onNetworkFinished)
  session.on("Network.loadingFailed", onNetworkFailed)
  const acquired = await (async () => {
    try {
      // The native JSON transport admits at most 32 MiB of UTF-8. Chromium
      // also charges decoded UTF-16 storage; reserve twice that resource budget.
      await session.send("Network.enable", { maxTotalBufferSize: 128 * 1024 * 1024, maxResourceBufferSize: 64 * 1024 * 1024 })
      const response = await acquire(async (response) => {
        expect(matches(response.request().method(), response.url()), "exact original BI owner and operation").toBe(true)
        const original = await producer.promise
        expect(response.url()).toBe(original.url)
        expect(response.status()).toBe(original.status)
        const completed = await completion.promise
        expect(completed === response.request(), "the same native BI Request must finish").toBe(true)
        if (primaryFailure) throw primaryFailure.error
        observed.push({ response, body: original.body })
        console.info("SF_ANALYTICS_SOURCE " + JSON.stringify({ operation: "bi-data-original-acquisition",
          view: viewId, acquisition: "native-response-cdp", phase: "original-request-completed",
          http: response.status(), sameNativeRequest: true, nativeRequestFinished: true, observer: "Network" }))
      })
      if (primaryFailure) throw primaryFailure.error
      expect(observed.length, "capture completed within the original response wait").toBe(1)
      expect(response === observed[0]!.response, "same observed native Response identity").toBe(true)
      return { response, body: observed[0]!.body }
    } catch (error) {
      primaryFailure ??= { error }
      throw primaryFailure.error
    } finally {
      const ended = new Error("Original BI observation ended before acquisition")
      producer.reject(ended)
      completion.reject(ended)
      session.off("close", onSessionClose)
      teardownPhase = "detaching"
      try {
        await session.detach()
        teardownPhase = "detached"
      } catch (error) {
        console.info("SF_ANALYTICS_SOURCE " + JSON.stringify({ operation: "bi-data-original-acquisition",
          view: viewId, acquisition: "native-response-cdp", phase: "detach-failed", acquisitionFailure: true,
          primaryFailurePreserved: primaryFailure !== undefined,
          errorClass: error instanceof SyntaxError ? "SyntaxError" : error instanceof Error ? "Error" : "NonError" }))
        primaryFailure ??= { error }
      } finally {
        page.off("request", onRequest)
        page.off("requestfinished", onRequestFinished)
        page.off("requestfailed", onRequestFailed)
        page.off("close", onPageClose)
        session.off("Network.requestWillBeSent", onNetworkRequest)
        session.off("Network.responseReceived", onNetworkResponse)
        session.off("Network.loadingFinished", onNetworkFinished)
        session.off("Network.loadingFailed", onNetworkFailed)
      }
      if (primaryFailure) throw primaryFailure.error
    }
  })()
  expect(failures, "original BI response acquisition must succeed").toEqual([])
  expect(responses, "one original BI response").toBe(1)
  expect(networkRequests, "one original BI network request").toBe(1)
  expect(networkCompletions, "one completed original BI network request").toBe(1)
  expect(requests.length, "one native BI request; no readback or retry").toBe(1)
  expect(completedRequests.length, "one finished native BI request").toBe(1)
  expect(acquired.response.request() === requests[0], "same native Request identity").toBe(true)
  expect(acquired.response.request().redirectedFrom() === null, "no redirected BI request").toBe(true)
  return acquired
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
