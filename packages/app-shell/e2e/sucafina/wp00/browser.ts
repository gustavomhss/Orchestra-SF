import { chromium, expect } from "@playwright/test"
import type { Page, Worker } from "@playwright/test"
import { Effect, Stream } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { AppProcess } from "@orchestra/core/process"
import path from "node:path"
import { fileURLToPath } from "node:url"

declare const chrome: {
  runtime: {
    id: string
    getManifest(): { name: string; version: string; background?: { service_worker?: string }; permissions?: string[] }
  }
  permissions: { contains(permissions: { permissions: string[] }): Promise<boolean> }
  tabs: {
    query(query: { active?: boolean; currentWindow?: boolean }): Promise<{ id?: number; url?: string }[]>
    setZoomSettings(id: number, settings: { mode: "automatic"; scope: "per-origin" }): Promise<void>
    setZoom(id: number, factor: number): Promise<void>
    getZoom(id: number): Promise<number>
  }
}

/** Launch the existing bundled Chromium through Omni, with an isolated profile and a zoom-only extension. */
export function scopedWp00Browser(directory: string) {
  return Effect.gen(function* () {
    const process = yield* AppProcess.Service
    const extension = path.join(path.dirname(fileURLToPath(import.meta.url)), "zoom-extension")
    const status = { endpoint: "", exitCode: null as number | null, diagnostic: "" }
    const browserProcess = yield* process.spawn(ChildProcess.make(chromium.executablePath(), [
      "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check",
      "--disable-background-networking", "--disable-component-update",
      "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0",
      "--user-data-dir=" + path.join(directory, "browser-profile"),
      "--disable-extensions-except=" + extension, "--load-extension=" + extension, "about:blank",
    ], { cwd: directory, extendEnv: true, stdin: "ignore", stdout: "pipe", stderr: "pipe" }))
    const receive = (chunk: Uint8Array) => Effect.sync(() => {
      status.diagnostic = (status.diagnostic + Buffer.from(chunk).toString("utf8")).slice(-16384)
      status.endpoint = /DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[a-z0-9-]+)/i.exec(status.diagnostic)?.[1] ?? status.endpoint
    })
    yield* Effect.forkScoped(Stream.runForEach(browserProcess.stdout, receive))
    yield* Effect.forkScoped(Stream.runForEach(browserProcess.stderr, receive))
    yield* Effect.forkScoped(browserProcess.exitCode.pipe(Effect.tap((value) => Effect.sync(() => { status.exitCode = Number(value) }))))
    yield* Effect.promise(async () => {
      await expect.poll(() => status.endpoint || (status.exitCode === null ? "" : "exited"), {
        timeout: 60000, message: "Bundled Chromium must expose its real CDP endpoint through the scoped process",
      }).not.toBe("")
      if (!status.endpoint) throw new Error("Chromium exited before readiness: " + status.diagnostic)
    })
    const browser = yield* Effect.acquireRelease(
      Effect.promise(() => chromium.connectOverCDP(status.endpoint)),
      (value) => Effect.promise(() => value.close()),
    )
    const context = browser.contexts()[0]
    if (!context) throw new Error("The isolated Chromium profile did not expose a browser context")
    context.setDefaultTimeout(30000)
    // Chromium can expose component-extension workers too. Only our manifest's worker is eligible.
    const isZoomWorker = (value: Worker) => value.url().startsWith("chrome-extension://")
      && new URL(value.url()).pathname === "/worker.js"
    const worker = context.serviceWorkers().find(isZoomWorker)
      ?? (yield* Effect.promise(() => context.waitForEvent("serviceworker", {
        predicate: isZoomWorker, timeout: 30000,
      }).catch(() => { throw new Error("Zoom extension did not start in bundled Chromium; workers="
        + JSON.stringify(context.serviceWorkers().map((value) => value.url())) + "; " + status.diagnostic) })))
    const extensionObservation = yield* Effect.promise(() => worker.evaluate(async () => ({
      id: chrome.runtime.id, manifest: chrome.runtime.getManifest(),
      tabsPermission: await chrome.permissions.contains({ permissions: ["tabs"] }),
      workerUrl: location.href,
    })))
    expect(extensionObservation.manifest.name).toBe("WP00 isolated browser zoom evidence")
    expect(extensionObservation.manifest.version).toBe("1.0.0")
    expect(extensionObservation.manifest.background?.service_worker).toBe("worker.js")
    expect(new URL(extensionObservation.workerUrl).hostname).toBe(extensionObservation.id)
    expect(extensionObservation.tabsPermission, JSON.stringify(extensionObservation)).toBe(true)
    const page = yield* Effect.promise(() => context.newPage())
    return { browser, context, page, worker, extensionObservation }
  })
}

/** Chrome's tabs API changes browser zoom; CSS zoom and page-scale emulation are never used. */
export async function setBrowserZoom(page: Page, worker: Worker, percent: 100 | 200) {
  await page.bringToFront()
  const factor = await worker.evaluate(async (input) => {
    // A headless service worker need not have a current/focused browser window.
    // The private browser has no user tabs; identify exactly one real tab by the measured URL.
    const tabs = await chrome.tabs.query({})
    const matching = tabs.filter((entry) => entry.url === input.url)
    const id = matching.length === 1 ? matching[0]?.id : undefined
    if (id === undefined)
      throw new Error("Expected one isolated zoom tab for " + input.url + "; observed " + JSON.stringify({
        workerUrl: location.href, extensionId: chrome.runtime.id, manifest: chrome.runtime.getManifest(), tabs,
      }))
    await chrome.tabs.setZoomSettings(id, { mode: "automatic", scope: "per-origin" })
    await chrome.tabs.setZoom(id, input.percent / 100)
    return chrome.tabs.getZoom(id)
  }, { url: page.url(), percent })
  expect(factor, "Chrome must report the requested browser zoom").toBe(percent / 100)
  const observed = await page.evaluate(() => ({
    devicePixelRatio: window.devicePixelRatio,
    cssViewportWidth: window.innerWidth,
    cssViewportHeight: window.innerHeight,
    visualViewportScale: window.visualViewport?.scale ?? null,
  }))
  return { ...observed, zoomPercent: factor * 100, mechanism: "chrome.tabs.setZoom/getZoom", url: page.url() }
}
