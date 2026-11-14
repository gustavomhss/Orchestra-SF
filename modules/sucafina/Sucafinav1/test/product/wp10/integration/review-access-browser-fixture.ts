import { expect } from "bun:test"
import type { Page } from "@playwright/test"
import type { createSfExtendedHttp } from "../../../../../../../apps/cli/src/sucafina-product/extended-http.ts"

/** Real browser, producer and HTTP handler; route transport forwards exact handler bytes.
 * This seam does not qualify TCP hosting, installed identity, native AI or global E2E.
 */
export async function prepareSfReviewAccessBrowser(input: { http: ReturnType<typeof createSfExtendedHttp>; url: string; privateText: string; signal?: AbortSignal }) {
  const { chromium } = await import("@playwright/test")
  const { captureChromiumCleanup } = await import("../../wp07/chromium-cleanup.ts")
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"], timeout: 15_000 })
  const pending = { release: () => {}, observed: (_status: number) => {}, settled: () => {} }
  const release = new Promise<void>((resolve) => { pending.release = resolve })
  const observed = new Promise<number>((resolve) => { pending.observed = resolve })
  const settled = new Promise<void>((resolve) => { pending.settled = resolve })
  const errors: string[] = []
  const bounded = async <T>(work: Promise<T>) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([work, new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("WP10_REVIEW_BROWSER_TRANSPORT_DEADLINE")), 10_000)
      })])
    } finally { if (timer) clearTimeout(timer) }
  }
  let closeBrowser: (() => Promise<void>) | undefined
  let closed = false, held = false
  let focusPage: Page | undefined
  const dispose = async () => {
    if (closed) return
    closed = true; pending.release()
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
      const response = await input.http(new Request(request.url(), { method: request.method(), headers: await request.allHeaders(), signal: input.signal,
        ...(request.postDataBuffer() ? { body: request.postDataBuffer()! } : {}) }), "dashboard")
      if (!response) { await route.abort("blockedbyclient"); return }
      // Capture only actual host output. Status, headers and bytes are never
      // synthesized to emulate a successful projection or a denied response.
      const forwarded = { status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) }
      const delayed = !held && request.frame().page() === focusPage && new URL(request.url()).searchParams.get("sf") === "review-source"
      if (delayed) {
        held = true; pending.observed(response.status)
        await release
      }
      try { await route.fulfill(forwarded) }
      catch (error) {
        // Revocation aborts the in-flight source fetch. It must not revive the DOM.
        if (!closed && !delayed) errors.push(error instanceof Error ? error.message : String(error))
      } finally { if (delayed) pending.settled() }
    })
    focusPage = await context.newPage()
    const sourcePage = await context.newPage()
    const pages = [focusPage, sourcePage]
    for (const page of pages) {
      page.on("pageerror", (error) => errors.push(error.message))
      const firstRead = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "review-read")
      expect((await page.goto(input.url))?.status()).toBe(200)
      expect((await firstRead).status()).toBe(200)
      await page.locator("[data-sf-review-selected-section] table").waitFor({ state: "visible" })
      expect(await page.locator("[data-sf-review-workspace]").textContent()).toContain(input.privateText)
      expect(await page.locator("script[data-sf-review-bootstrap]").count()).toBe(0)
    }
    // Hold a genuinely authorized source response across the later case-only
    // revocation; no response payload or access decision is substituted.
    await focusPage.locator("[data-sf-review-selected-section]").getByRole("button", { name: "Abrir origem", exact: true }).first()
      .evaluate((button) => (button as HTMLButtonElement).click())
    expect(await bounded(observed)).toBe(200)
    return {
      dispose,
      async verifyAfterCaseRevocation() {
        const probe = focusPage!.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "review")
        await focusPage!.evaluate(() => window.dispatchEvent(new Event("focus")))
        const probeStatus = (await probe).status()
        expect(probeStatus).toBe(403)
        const source = sourcePage.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "review-source")
        await sourcePage.locator("[data-sf-review-selected-section]").getByRole("button", { name: "Abrir origem", exact: true }).first()
          .evaluate((button) => (button as HTMLButtonElement).click())
        const sourceStatus = (await source).status()
        expect(sourceStatus).toBe(403)
        const checkEmpty = async (page: Page) => {
          await page.waitForFunction(() => document.querySelector("[data-sf-review-workspace]")?.textContent === "O acesso mudou. Reabra uma revisão autorizada.")
          const workspace = page.locator("[data-sf-review-workspace]")
          expect(await workspace.locator("table, a, button, [data-sf-review-selected-section]").count()).toBe(0)
          expect(await workspace.textContent()).not.toContain(input.privateText)
          expect(await page.locator("script[data-sf-review-bootstrap]").count()).toBe(0)
        }
        await Promise.all(pages.map(checkEmpty))
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
      },
    }
  } catch (error) { await dispose(); throw error }
}
