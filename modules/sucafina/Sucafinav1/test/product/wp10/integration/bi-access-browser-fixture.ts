import { expect } from "bun:test"
import type { Page, Route } from "@playwright/test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { documentHtml } from "../../../../src/screen-shell.ts"
import type { createSfExtendedHttp } from "../../../../../../../apps/cli/src/sucafina-product/extended-http.ts"

type BrowserRequest = ReturnType<Route["request"]>
type BrowserResponse = NonNullable<Awaited<ReturnType<BrowserRequest["response"]>>>
type Handled = { status: number; body: Buffer }

/** Chromium uses the real composed HTML/bundle and exact HTTP-handler output.
 * Route forwarding is a transport seam, not TCP hosting or installed-auth/native/global acceptance.
 */
export async function prepareSfBiAccessBrowser(input: { http: ReturnType<typeof createSfExtendedHttp>; biAsset: () => Promise<string>; url: string; selectionRef: string;
  privateReferences: readonly string[]; signal: AbortSignal }) {
  const { chromium } = await import("@playwright/test")
  const { captureChromiumCleanup } = await import("../../wp07/chromium-cleanup.ts")
  input.signal.throwIfAborted()
  const canonicalShell = [...documentHtml("BI", "dashboard", "", "", "").matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)]
  if (canonicalShell.length !== 1) throw new Error("WP10_BI_CANONICAL_SHELL_SHAPE_CHANGED")
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"], timeout: 15_000 })
  const pending = { release: () => {}, settled: () => {} }
  const release = new Promise<void>((resolve) => { pending.release = resolve })
  const settled = new Promise<void>((resolve) => { pending.settled = resolve })
  const errors: string[] = []
  const consoleEvents: { type: string; text: string }[] = []
  const requestFailures: { mode: string; navigation: boolean; reason?: string }[] = []
  const navigations: { mode: string; mainFrame: boolean }[] = []
  const observed: { page?: Page } = {}
  let stage = "browser.context"
  const bounded = async <T>(work: Promise<T>) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([work, new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("WP10_BI_BROWSER_TRANSPORT_DEADLINE")), 10_000)
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
  const watches: { mode: string; request?: BrowserRequest; sent: ReturnType<typeof observedEvent<BrowserRequest>>;
    handled: ReturnType<typeof observedEvent<Handled>>; response: ReturnType<typeof observedEvent<BrowserResponse>>;
    handledStatus?: number; delivered?: boolean }[] = []
  const observe = (mode: string) => {
    const watch = { mode, request: undefined as BrowserRequest | undefined, sent: observedEvent<BrowserRequest>(),
      handled: observedEvent<Handled>(), response: observedEvent<BrowserResponse>() }
    watches.push(watch)
    return {
      handled: async () => { await bounded(ready(watch.sent.promise)); return ready(watch.handled.promise) },
      response: async () => {
        await bounded(ready(watch.sent.promise))
        // The real producer remains within the test's 105s cancellation budget.
        // The 10s browser delivery window starts after actual handler output;
        // it does not expire while goto is still awaiting the HTML/bundle.
        await ready(watch.handled.promise)
        return bounded(ready(watch.response.promise))
      },
    }
  }
  let closeBrowser: (() => Promise<void>) | undefined
  let closed = false, held = false
  const diagnose = async (error: unknown) => {
    console.error("SF_BI_BROWSER_FAILURE", JSON.stringify({ stage, error: error instanceof Error ? error.message : String(error),
      aborted: input.signal.aborted, errors, console: consoleEvents, requestFailures, navigations,
      watches: watches.map((watch) => ({ mode: watch.mode, requested: !!watch.request,
        handledStatus: watch.handledStatus, delivered: !!watch.delivered })) }))
    const page = observed.page
    if (!page || input.signal.aborted) return
    try {
      const dom = await bounded(ready(page.evaluate((references) => {
        const root = document.querySelector("[data-sf-bi]"), content = root?.querySelector(":scope > div")
        return { readyState: document.readyState, rootPresent: !!root, rootChildren: root ? [...root.children].map((child) => child.tagName) : [],
          status: root?.querySelector(':scope > [role="status"]')?.textContent?.slice(0, 300),
          tableCount: content?.querySelectorAll("table").length ?? 0, buttonCount: content?.querySelectorAll("button").length ?? 0,
          privateReferencesPresent: references.map((reference) => content?.textContent?.includes(reference) ?? false),
          selectionPresent: !!root?.querySelector('select[aria-label="Dados para visualizar"]'),
          scripts: [...document.scripts].map((script) => ({ type: script.type, inline: !script.src, length: script.textContent?.length ?? 0 })) }
      }, [...input.privateReferences])))
      console.error("SF_BI_BROWSER_DOM", JSON.stringify({ stage, dom }))
    } catch (error) { console.error("SF_BI_BROWSER_DOM", JSON.stringify({ stage, unavailable: error instanceof Error ? error.message : String(error) })) }
  }
  const dispose = async () => {
    if (closed) return
    closed = true; pending.release()
    for (const watch of watches) {
      const error = new Error("WP10_BI_BROWSER_CLOSED")
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
      const mode = new URL(request.url()).searchParams.get("sf") ?? "other"
      const watch = watches.find((entry) => entry.mode === mode && !entry.request)
      if (watch) { watch.request = request; watch.sent.resolve(request) }
      const at = performance.now()
      console.info("SF_BI_BROWSER_HTTP", JSON.stringify({ mode, state: "started", navigation: request.isNavigationRequest(), resource: request.resourceType() }))
      try {
        const response = await input.http(new Request(request.url(), { method: request.method(), headers: await request.allHeaders(), signal: input.signal,
          ...(request.postDataBuffer() ? { body: new Uint8Array(request.postDataBuffer()!).buffer } : {}) }), "dashboard")
        if (!response) {
          if (watch) throw new Error(`Real handler did not handle browser request ${mode}`)
          await route.abort("blockedbyclient")
          return
        }
        const forwarded = { status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) }
        if (mode === "bi" && response.status === 200) {
          const asset = await ready(input.biAsset())
          const inline = asset.replace(/<\/script/gi, "<\\/script")
          const scripts = [...forwarded.body.toString("utf8").matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)]
          const inserted = scripts.at(-1)?.[1]
          const matches = inserted === inline
          const shellMatches = scripts.length === 2 && scripts[0]?.[1] === canonicalShell[0]?.[1]
          const digest = (value: string) => new Bun.CryptoHasher("sha256").update(value).digest("hex")
          console.info("SF_BI_BROWSER_ASSET", JSON.stringify({ matches, shellMatches, scriptCount: scripts.length,
            assetBytes: Buffer.byteLength(asset), inlineBytes: Buffer.byteLength(inline), insertedBytes: inserted === undefined ? null : Buffer.byteLength(inserted),
            assetSha256: digest(asset), inlineSha256: digest(inline), insertedSha256: inserted === undefined ? null : digest(inserted) }))
          if (!matches || !shellMatches || !forwarded.body.toString("utf8").includes("data-sf-bi data-sf-retain-view")) throw new Error("WP10_BI_BROWSER_LIFECYCLE_ASSET_MISMATCH")
        }
        if (watch) watch.handledStatus = response.status
        watch?.handled.resolve({ status: response.status, body: forwarded.body })
        console.info("SF_BI_BROWSER_HTTP", JSON.stringify({ mode, state: "handled", status: response.status, elapsedMs: Math.round(performance.now() - at) }))
        const delayed = !held && mode === "bi-source"
        if (delayed) { held = true; await release }
        try { await route.fulfill(forwarded) }
        catch (error) {
          // clearPrivate legitimately aborts the old source fetch. The retained
          // genuine success must not restore private data after that abort.
          if (!closed && !delayed) throw error
        } finally { if (delayed) pending.settled() }
      } catch (error) {
        watch?.handled.reject(error); watch?.response.reject(error)
        if (!closed && !input.signal.aborted) errors.push(error instanceof Error ? error.message : String(error))
        await route.abort("failed").catch(() => undefined)
      }
    })
    const page = await context.newPage()
    observed.page = page
    page.on("pageerror", (error) => errors.push(error.message))
    page.on("console", (message) => {
      if (!["error", "warning"].includes(message.type())) return
      consoleEvents.push({ type: message.type(), text: message.text().slice(0, 1200) })
      if (consoleEvents.length > 16) consoleEvents.shift()
    })
    page.on("requestfailed", (request) => {
      requestFailures.push({ mode: new URL(request.url()).searchParams.get("sf") ?? "other", navigation: request.isNavigationRequest(), reason: request.failure()?.errorText })
      if (requestFailures.length > 16) requestFailures.shift()
    })
    page.on("framenavigated", (frame) => {
      navigations.push({ mode: new URL(frame.url()).searchParams.get("sf") ?? "other", mainFrame: frame === page.mainFrame() })
      if (navigations.length > 16) navigations.shift()
    })
    page.on("response", (response) => {
      const watch = watches.find((watch) => watch.request === response.request())
      if (watch) { watch.delivered = true; watch.response.resolve(response) }
    })
    const optionsResponse = observe("bi-options")
    stage = "navigate"
    expect((await page.goto(input.url, { waitUntil: "commit" }))?.status()).toBe(200)
    stage = "options"
    const options = await optionsResponse.response()
    expect(options.status()).toBe(200)
    const optionsBody = await options.json()
    expect(optionsBody.status).toBe("ok")
    expect(optionsBody.value.choices.some((choice: { selectionRef: string }) => choice.selectionRef === input.selectionRef)).toBe(true)
    await page.waitForFunction((selectionRef) => (document.querySelector('select[aria-label="Dados para visualizar"]') as HTMLSelectElement)?.value === selectionRef, input.selectionRef)
    const dataResponse = observe("bi-data")
    stage = "data"
    await page.getByRole("button", { name: "Atualizar visualização", exact: true }).evaluate((button) => (button as HTMLButtonElement).click())
    const data = await dataResponse.response()
    expect(data.status()).toBe(200)
    const dataBody = await data.json()
    expect(dataBody.request.selectionRef).toBe(input.selectionRef)
    expect(dataBody.receipt).toMatchObject({ kind: "ui", operation: "sf_bi_view", handlerExport: "readBiView", inputDigest: digestSfValue(dataBody.request), resultDigest: digestSfValue(dataBody.projection) })
    const content = page.locator("[data-sf-bi] > div")
    stage = "data.private-table"
    await content.locator("table").first().waitFor({ state: "visible" })
    for (const reference of input.privateReferences) expect(await content.textContent()).toContain(reference)
    const sourceButton = content.getByRole("button", { name: "Abrir origem", exact: true }).first()
    const sourceResponse = observe("bi-source")
    stage = "source.authorized"
    await sourceButton.evaluate((button) => (button as HTMLButtonElement).click())
    const prior = await sourceResponse.handled()
    expect(prior.status).toBe(200)
    expect(JSON.parse(prior.body.toString()).links.length).toBeGreaterThan(0)
    return {
      dispose,
      async verifyAfterCaseRevocation() {
        try {
          stage = "source.revoked"
          const sourceResponse = observe("bi-source")
          // The page retains its visible data while a previous real source fetch
          // is held. A second ordinary source click must receive the real403.
          await sourceButton.evaluate((button) => (button as HTMLButtonElement).click())
          const source = await sourceResponse.response()
          expect(source.status()).toBe(403)
          const denied = await source.json()
          expect(denied).toMatchObject({ status: "denied" })
          expect(denied).not.toHaveProperty("projection")
          expect(denied).not.toHaveProperty("links")
          const checkEmpty = async () => {
            await page.waitForFunction(() => document.querySelector("[data-sf-bi] > [role=status]")?.textContent === "O acesso mudou. Abra novamente os dados autorizados.")
            expect(await content.textContent()).toBe("")
            expect(await content.locator("table, a, button, svg, canvas").count()).toBe(0)
            expect(await page.locator('[data-sf-bi] nav a').count()).toBe(0)
            expect(await page.getByLabel("Dados para visualizar", { exact: true }).inputValue()).toBe("")
            expect(await page.getByLabel("Dados para visualizar", { exact: true }).locator("option").count()).toBe(1)
            expect(await page.getByRole("button", { name: "Atualizar visualização", exact: true }).isDisabled()).toBe(true)
            for (const reference of input.privateReferences) expect(await page.locator("[data-sf-bi]").textContent()).not.toContain(reference)
            expect(await page.locator("script[data-sf-review-bootstrap], script[data-sf-bi-bootstrap]").count()).toBe(0)
          }
          stage = "revoked.private-dom"
          await checkEmpty()
          stage = "revoked.late-authorized-response"
          pending.release()
          await bounded(settled)
          await bounded(page.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 0))))
          await checkEmpty()
          expect(errors).toEqual([])
          console.info("WP10 BI case-only revocation", { optionsStatus: options.status(), dataStatus: data.status(), sourceStatus: source.status(),
            delayedSourceStatus: prior.status, privateDomCleared: true, delayedSourceDiscarded: true,
            transport: "Exact HTTP handler bytes through Playwright route seam" })
        } catch (error) { await diagnose(error); throw error }
      },
    }
  } catch (error) { await diagnose(error); await dispose(); throw error }
}

function observedEvent<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((done, failed) => { resolve = done; reject = failed })
  // The observer is installed before navigation or clicking. A later error is
  // already handled while another action/producer is still pending, and the
  // awaiting stage will still receive and throw the original rejection.
  void promise.catch(() => undefined)
  return { promise, resolve, reject }
}
