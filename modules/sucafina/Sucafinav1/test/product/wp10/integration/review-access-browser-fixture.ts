import { expect } from "bun:test"
import type { Page, Route } from "@playwright/test"
import type { createSfExtendedHttp } from "../../../../../../../apps/cli/src/sucafina-product/extended-http.ts"

type BrowserRequest = ReturnType<Route["request"]>
type BrowserResponse = NonNullable<Awaited<ReturnType<BrowserRequest["response"]>>>

/** Real browser, producer and HTTP handler; route transport forwards exact handler bytes.
 * This seam does not qualify TCP hosting, installed identity, native AI or global E2E.
 */
export async function prepareSfReviewAccessBrowser(input: { http: ReturnType<typeof createSfExtendedHttp>; url: string; privateText: string; signal: AbortSignal }) {
  const { chromium } = await import("@playwright/test")
  const { captureChromiumCleanup } = await import("../../wp07/chromium-cleanup.ts")
  input.signal.throwIfAborted()
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"], timeout: 15_000 })
  const pending = { release: () => {}, settled: () => {} }
  const release = new Promise<void>((resolve) => { pending.release = resolve })
  const settled = new Promise<void>((resolve) => { pending.settled = resolve })
  const errors: string[] = []
  const consoleEvents: { page: string; type: string; text: string }[] = []
  const pageErrors: { page: string; message: string; stack?: string }[] = []
  const requestFailures: { page: string; mode: string; resource: string; reason?: string }[] = []
  const pages: Page[] = []
  let stage = "browser.context"
  const bounded = async <T>(work: Promise<T>) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([work, new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("WP10_REVIEW_BROWSER_TRANSPORT_DEADLINE")), 10_000)
      })])
    } finally { if (timer) clearTimeout(timer) }
  }
  const ready = async <T>(work: Promise<T>) => {
    input.signal.throwIfAborted()
    let stop: (() => void) | undefined
    const cancelled = new Promise<never>((_resolve, reject) => {
      stop = () => reject(input.signal.reason)
      input.signal.addEventListener("abort", stop, { once: true })
    })
    try { return await Promise.race([work, cancelled]) }
    finally { if (stop) input.signal.removeEventListener("abort", stop) }
  }
  const watches: { page: Page; mode: string; request?: BrowserRequest; sent: ReturnType<typeof observedEvent<BrowserRequest>>;
    handled: ReturnType<typeof observedEvent<number>>; response: ReturnType<typeof observedEvent<BrowserResponse>>;
    handledStatus?: number; delivered?: boolean }[] = []
  const observe = (page: Page, mode: string) => {
    const watch = { page, mode, request: undefined as BrowserRequest | undefined, sent: observedEvent<BrowserRequest>(),
      handled: observedEvent<number>(), response: observedEvent<BrowserResponse>() }
    watches.push(watch)
    return {
      handled: async () => { await bounded(ready(watch.sent.promise)); return ready(watch.handled.promise) },
      response: async () => {
        await bounded(ready(watch.sent.promise))
        // Producer work remains inside the caller's 105s cancellation budget.
        // The 10s delivery window starts after the actual handler has returned,
        // so it cannot reject while goto is still producing its HTML/bundle.
        await ready(watch.handled.promise)
        return bounded(ready(watch.response.promise))
      },
    }
  }
  let closeBrowser: (() => Promise<void>) | undefined
  let closed = false, held = false
  let focusPage: Page | undefined
  const pageName = (page: Page) => page === focusPage ? "focus" : "source"
  const diagnose = async (error: unknown) => {
    // Keep the original failure and the observations made before cleanup. In
    // particular, a missing initial request must not hide a CSP or script error.
    // Only DOM structure/booleans are recorded; no preserved body is logged.
    console.error("SF_REVIEW_BROWSER_FAILURE", JSON.stringify({ stage, error: error instanceof Error ? error.message : String(error),
      aborted: input.signal.aborted, errors, pageErrors, console: consoleEvents, requestFailures,
      watches: watches.map((watch) => ({ page: pageName(watch.page), mode: watch.mode, requested: !!watch.request,
        handledStatus: watch.handledStatus, delivered: !!watch.delivered })) }))
    if (input.signal.aborted) return
    try {
      const states = await bounded(ready(Promise.all(pages.map(async (page) => {
        try {
          const dom = await page.evaluate((privateText) => {
            const workspace = document.querySelector("[data-sf-review-workspace]")
            const bootstrap = document.querySelector("script[data-sf-review-bootstrap]")
            return { readyState: document.readyState, workspacePresent: !!workspace,
              workspaceChildren: workspace ? [...workspace.children].map((child) => child.tagName) : [],
              tableCount: workspace?.querySelectorAll("table").length ?? 0,
              buttonCount: workspace?.querySelectorAll("button").length ?? 0,
              linkCount: workspace?.querySelectorAll("a").length ?? 0,
              selectedSectionCount: workspace?.querySelectorAll("[data-sf-review-selected-section]").length ?? 0,
              privateTextPresent: workspace?.textContent?.includes(privateText) ?? false,
              bootstrapPresent: !!bootstrap, bootstrapLength: bootstrap?.textContent?.length ?? 0,
              scripts: [...document.scripts].map((script) => ({ type: script.type, inline: !script.src,
                length: script.textContent?.length ?? 0, bootstrap: script.hasAttribute("data-sf-review-bootstrap") })) }
          }, input.privateText)
          return { page: pageName(page), dom }
        } catch (error) { return { page: pageName(page), error: error instanceof Error ? error.message : String(error) } }
      }))))
      console.error("SF_REVIEW_BROWSER_DOM", JSON.stringify({ stage, states }))
    } catch (error) {
      // Diagnostics share the existing delivery and caller cancellation bounds.
      // An unavailable page cannot replace the original bootstrap failure.
      console.error("SF_REVIEW_BROWSER_DOM", JSON.stringify({ stage, unavailable: error instanceof Error ? error.message : String(error) }))
    }
  }
  const dispose = async () => {
    if (closed) return
    closed = true; pending.release()
    for (const watch of watches) {
      const error = new Error("WP10_REVIEW_BROWSER_CLOSED")
      watch.sent.reject(error); watch.handled.reject(error); watch.response.reject(error)
    }
    if (closeBrowser) await closeBrowser()
    else await browser.close()
  }
  try {
    closeBrowser = await captureChromiumCleanup(browser)
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" })
    context.setDefaultTimeout(10_000)
    context.setDefaultNavigationTimeout(15_000)
    await context.route("https://example.test/**", async (route) => {
      const request = route.request()
      const page = request.frame().page()
      const mode = new URL(request.url()).searchParams.get("sf") ?? "other"
      const watch = watches.find((entry) => entry.page === page && entry.mode === mode && !entry.request)
      if (watch) { watch.request = request; watch.sent.resolve(request) }
      const at = performance.now()
      console.info("SF_REVIEW_BROWSER_HTTP", JSON.stringify({ page: page === focusPage ? "focus" : "source", mode, state: "started" }))
      try {
        const response = await input.http(new Request(request.url(), { method: request.method(), headers: await request.allHeaders(), signal: input.signal,
          ...(request.postDataBuffer() ? { body: request.postDataBuffer()! } : {}) }), "dashboard")
        if (!response) {
          if (watch) throw new Error(`Real handler did not handle browser request ${mode}`)
          await route.abort("blockedbyclient")
          return
        }
        // Capture only actual host output. Status, headers and bytes are never
        // synthesized to emulate a successful projection or a denied response.
        const forwarded = { status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) }
        if (watch) watch.handledStatus = response.status
        watch?.handled.resolve(response.status)
        console.info("SF_REVIEW_BROWSER_HTTP", JSON.stringify({ page: page === focusPage ? "focus" : "source", mode, state: "handled", status: response.status, elapsedMs: Math.round(performance.now() - at) }))
        const delayed = !held && page === focusPage && mode === "review-source"
        if (delayed) { held = true; await release }
        try { await route.fulfill(forwarded) }
        catch (error) {
          // Revocation aborts the in-flight source fetch. It must not revive the DOM.
          if (!closed && !delayed) throw error
        } finally { if (delayed) pending.settled() }
      } catch (error) {
        watch?.handled.reject(error); watch?.response.reject(error)
        if (!closed && !input.signal.aborted) errors.push(error instanceof Error ? error.message : String(error))
        await route.abort("failed").catch(() => undefined)
      }
    })
    focusPage = await context.newPage()
    const sourcePage = await context.newPage()
    pages.push(focusPage, sourcePage)
    for (const page of pages) {
      page.on("pageerror", (error) => {
        errors.push(error.message)
        pageErrors.push({ page: pageName(page), message: error.message, stack: error.stack?.slice(0, 1200) })
        if (pageErrors.length > 16) pageErrors.shift()
      })
      page.on("console", (message) => {
        if (!["error", "warning"].includes(message.type())) return
        consoleEvents.push({ page: pageName(page), type: message.type(), text: message.text().slice(0, 1200) })
        if (consoleEvents.length > 16) consoleEvents.shift()
      })
      page.on("requestfailed", (request) => {
        requestFailures.push({ page: pageName(page), mode: new URL(request.url()).searchParams.get("sf") ?? "other",
          resource: request.resourceType(), reason: request.failure()?.errorText })
        if (requestFailures.length > 16) requestFailures.shift()
      })
      page.on("response", (response) => {
        const watch = watches.find((watch) => watch.request === response.request())
        if (watch) { watch.delivered = true; watch.response.resolve(response) }
      })
      const firstRead = observe(page, "review-read")
      stage = `${pageName(page)}.navigate`
      expect((await page.goto(input.url, { waitUntil: "commit" }))?.status()).toBe(200)
      stage = `${pageName(page)}.initial-read`
      expect((await firstRead.response()).status()).toBe(200)
      stage = `${pageName(page)}.selected-dom`
      await page.locator("[data-sf-review-selected-section] table").waitFor({ state: "visible" })
      expect(await page.locator("[data-sf-review-workspace]").textContent()).toContain(input.privateText)
      expect(await page.locator("script[data-sf-review-bootstrap]").count()).toBe(0)
    }
    // Hold a genuinely authorized source response across the later case-only
    // revocation; no response payload or access decision is substituted.
    const priorSource = observe(focusPage, "review-source")
    stage = "focus.authorized-source"
    await focusPage.locator("[data-sf-review-selected-section]").getByRole("button", { name: "Abrir origem", exact: true }).first()
      .evaluate((button) => (button as HTMLButtonElement).click())
    expect(await priorSource.handled()).toBe(200)
    return {
      dispose,
      async verifyAfterCaseRevocation() {
        try {
          stage = "focus.revoked-probe"
          const probe = observe(focusPage!, "review")
          await focusPage!.evaluate(() => window.dispatchEvent(new Event("focus")))
          const probeStatus = (await probe.response()).status()
          expect(probeStatus).toBe(403)
          stage = "source.revoked-source"
          const source = observe(sourcePage, "review-source")
          await sourcePage.locator("[data-sf-review-selected-section]").getByRole("button", { name: "Abrir origem", exact: true }).first()
            .evaluate((button) => (button as HTMLButtonElement).click())
          const sourceStatus = (await source.response()).status()
          expect(sourceStatus).toBe(403)
          const checkEmpty = async (page: Page) => {
            await page.waitForFunction(() => document.querySelector("[data-sf-review-workspace]")?.textContent === "O acesso mudou. Reabra uma revisão autorizada.")
            const workspace = page.locator("[data-sf-review-workspace]")
            expect(await workspace.locator("table, a, button, [data-sf-review-selected-section]").count()).toBe(0)
            expect(await workspace.textContent()).not.toContain(input.privateText)
            expect(await page.locator("script[data-sf-review-bootstrap]").count()).toBe(0)
          }
          stage = "revoked.private-dom"
          await Promise.all(pages.map(checkEmpty))
          stage = "revoked.late-authorized-response"
          pending.release()
          await bounded(settled)
          // Observe another browser task after transport settlement, including a
          // source request already aborted by clearPrivate. Background tabs do
          // not reliably receive animation frames, so no paint is awaited here.
          await bounded(Promise.all(pages.map((page) => page.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 0))))))
          await Promise.all(pages.map(checkEmpty))
          expect(errors).toEqual([])
          console.info("WP10 Review case-only revocation", { probeStatus, sourceStatus, pagesCleared: pages.length,
            delayedSource: "Actual authorized200 released after denied focus; private DOM remains empty", transport: "Exact HTTP handler bytes through Playwright route seam" })
        } catch (error) { await diagnose(error); throw error }
      },
    }
  } catch (error) { await diagnose(error); await dispose(); throw error }
}

function observedEvent<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((done, failed) => { resolve = done; reject = failed })
  // Install the rejection handler before navigation or clicking. Awaiting the
  // original promise still propagates the exact failure at its observed stage.
  void promise.catch(() => undefined)
  return { promise, resolve, reject }
}
