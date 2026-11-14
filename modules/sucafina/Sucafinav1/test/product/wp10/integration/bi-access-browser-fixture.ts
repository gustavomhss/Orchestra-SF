import { expect } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { createSfExtendedHttp } from "../../../../../../../apps/cli/src/sucafina-product/extended-http.ts"

/** Chromium uses the real composed HTML/bundle and exact HTTP-handler output.
 * Route forwarding is a transport seam, not TCP hosting or installed-auth/native/global acceptance.
 */
export async function prepareSfBiAccessBrowser(input: { http: ReturnType<typeof createSfExtendedHttp>; url: string; selectionRef: string;
  privateReferences: readonly string[]; signal: AbortSignal }) {
  const { chromium } = await import("@playwright/test")
  const { captureChromiumCleanup } = await import("../../wp07/chromium-cleanup.ts")
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"], timeout: 15_000 })
  const pending = { release: () => {}, observed: (_value: { status: number; body: Buffer }) => {}, settled: () => {} }
  const release = new Promise<void>((resolve) => { pending.release = resolve })
  const observed = new Promise<{ status: number; body: Buffer }>((resolve) => { pending.observed = resolve })
  const settled = new Promise<void>((resolve) => { pending.settled = resolve })
  const errors: string[] = []
  const bounded = async <T>(work: Promise<T>) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([work, new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("WP10_BI_BROWSER_TRANSPORT_DEADLINE")), 10_000)
      })])
    } finally { if (timer) clearTimeout(timer) }
  }
  let closeBrowser: (() => Promise<void>) | undefined
  let closed = false, held = false
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
      const forwarded = { status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) }
      const delayed = !held && new URL(request.url()).searchParams.get("sf") === "bi-source"
      if (delayed) {
        held = true; pending.observed({ status: response.status, body: forwarded.body })
        await release
      }
      try { await route.fulfill(forwarded) }
      catch (error) {
        // clearPrivate legitimately aborts the old source fetch. The retained
        // genuine success must not restore private data after that abort.
        if (!closed && !delayed) errors.push(error instanceof Error ? error.message : String(error))
      } finally { if (delayed) pending.settled() }
    })
    const page = await context.newPage()
    page.on("pageerror", (error) => errors.push(error.message))
    const optionsResponse = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-options")
    expect((await page.goto(input.url))?.status()).toBe(200)
    const options = await optionsResponse
    expect(options.status()).toBe(200)
    const optionsBody = await options.json()
    expect(optionsBody.status).toBe("ok")
    expect(optionsBody.value.choices.some((choice: { selectionRef: string }) => choice.selectionRef === input.selectionRef)).toBe(true)
    await page.waitForFunction((selectionRef) => (document.querySelector('select[aria-label="Dados para visualizar"]') as HTMLSelectElement)?.value === selectionRef, input.selectionRef)
    const dataResponse = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-data")
    await page.getByRole("button", { name: "Atualizar visualização", exact: true }).evaluate((button) => (button as HTMLButtonElement).click())
    const data = await dataResponse
    expect(data.status()).toBe(200)
    const dataBody = await data.json()
    expect(dataBody.request.selectionRef).toBe(input.selectionRef)
    expect(dataBody.receipt).toMatchObject({ kind: "ui", operation: "sf_bi_view", handlerExport: "readBiView", inputDigest: digestSfValue(dataBody.request), resultDigest: digestSfValue(dataBody.projection) })
    const content = page.locator("[data-sf-bi] > div")
    await content.locator("table").first().waitFor({ state: "visible" })
    for (const reference of input.privateReferences) expect(await content.textContent()).toContain(reference)
    const sourceButton = content.getByRole("button", { name: "Abrir origem", exact: true }).first()
    await sourceButton.evaluate((button) => (button as HTMLButtonElement).click())
    const prior = await bounded(observed)
    expect(prior.status).toBe(200)
    expect(JSON.parse(prior.body.toString()).links.length).toBeGreaterThan(0)
    return {
      dispose,
      async verifyAfterCaseRevocation() {
        const sourceResponse = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-source")
        // The page retains its visible data while a previous real source fetch
        // is held. A second ordinary source click must receive the real403.
        await sourceButton.evaluate((button) => (button as HTMLButtonElement).click())
        const source = await sourceResponse
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
        await checkEmpty()
        pending.release()
        await bounded(settled)
        await bounded(page.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 0))))
        await checkEmpty()
        expect(errors).toEqual([])
        console.info("WP10 BI case-only revocation", { optionsStatus: options.status(), dataStatus: data.status(), sourceStatus: source.status(),
          delayedSourceStatus: prior.status, privateDomCleared: true, delayedSourceDiscarded: true,
          transport: "Exact HTTP handler bytes through Playwright route seam" })
      },
    }
  } catch (error) { await dispose(); throw error }
}
