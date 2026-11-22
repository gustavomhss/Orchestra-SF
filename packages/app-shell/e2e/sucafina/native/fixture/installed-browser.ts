/** Attach only to the authorized host's existing Microsoft contexts. No auth material is copied. */
import path from "node:path"
import { chromium } from "@playwright/test"
import type { Browser, BrowserContext, Page } from "@playwright/test"
export type { Browser, Page } from "@playwright/test"
import { privateText } from "../../../../../../script/sf-ci/g08-private-evidence.mjs"
import { observeNativeBinding, readNativeManifest, requirePrivateNativeRoot } from "./readiness.ts"
import type { NativeActor, NativeManifest } from "./manifest-contract.ts"
import { readNativeInstalledHost, requireNativeInstalledHost } from "./installed-host.ts"
import { bindNativeBrowserContext, releaseNativeBrowserContext } from "./browser-transport.ts"

const names = ["requester", "holder", "denied", "dashboardAdmin"] as const
export type InstalledBrowserSession = Readonly<{
  browser: Browser; manifest: NativeManifest
  contexts: Readonly<Record<NativeActor, BrowserContext>>
  disconnect(): Promise<void>
}>
async function privateEndpoint(rootPath: string) {
  const root = await requirePrivateNativeRoot(rootPath)
  const file = process.env.SF_NATIVE_BROWSER_ENDPOINT_FILE
  if (!file || path.resolve(file) !== file || path.dirname(file) !== root)
    throw new Error("F04_PRIVATE_CDP_FILE_REQUIRED")
  const endpoint = (await privateText(root, path.basename(file), 4096)).trim()
  let url: URL
  try { url = new URL(endpoint) } catch { throw new Error("F04_PRIVATE_CDP_ENDPOINT_INVALID") }
  if (!["ws:", "http:"].includes(url.protocol) || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    !url.port || url.username || url.password || url.hash)
    throw new Error("F04_PRIVATE_CDP_ENDPOINT_NOT_LOOPBACK")
  return endpoint
}
function onShell(page: Page, origin: string) {
  try { return new URL(page.url()).origin === origin } catch { return false }
}
export async function prepareNativePage(page: Page) {
  const session = await page.context().newCDPSession(page)
  try {
    await session.send("Network.enable")
    await session.send("Network.setCacheDisabled", { cacheDisabled: true })
    await session.send("Network.setBypassServiceWorker", { bypass: true })
  } finally { await session.detach() }
}
export async function attachHostedNativeBrowser(root: string) {
  const host = await readNativeInstalledHost(root)
  const browser = await chromium.connectOverCDP(await privateEndpoint(root), { timeout: 30000 })
  try {
    for (const context of browser.contexts()) {
      bindNativeBrowserContext(context, host.plan.target.publicOrigin, host.addresses)
      for (const page of context.pages()) if (onShell(page, host.plan.target.shellOrigin)) await prepareNativePage(page)
    }
    return browser
  } catch (error) {
    await disconnectNativeBrowser(browser)
    throw error
  }
}
export async function disconnectNativeBrowser(browser: Browser) {
  for (const context of browser.contexts()) releaseNativeBrowserContext(context)
  // For connectOverCDP this disconnects our client; no context/browser was launched or owned here.
  await browser.close()
}
export async function connectNativeInstalledBrowser(): Promise<InstalledBrowserSession> {
  const manifest = await readNativeManifest()
  await requireNativeInstalledHost(manifest)
  const browser = await attachHostedNativeBrowser(manifest.scratchRoot)
  try {
    const found: Partial<Record<NativeActor, BrowserContext>> = {}
    for (const context of browser.contexts()) {
      const pages = context.pages().filter((page) => onShell(page, manifest.target.shellOrigin))
      if (!pages.length) continue
      // A failed original observation is an error, never an opportunity to authenticate or synthesize a role.
      const live = await observeNativeBinding(pages[0]!, manifest.target)
      const actor = names.find((name) => manifest.actors[name] === live.stamp.principalRef)
      if (!actor) continue
      if (found[actor]) throw new Error("F04_AMBIGUOUS_ORIGINAL_PRINCIPAL_CONTEXT")
      found[actor] = context
    }
    for (const name of names) if (!found[name]) throw new Error("F04_RESERVED_ORIGINAL_CONTEXT_MISSING")
    if (new Set(Object.values(found)).size !== names.length) throw new Error("F04_DISTINCT_ORIGINAL_CONTEXTS_REQUIRED")
    return { browser, manifest, contexts: found as Record<NativeActor, BrowserContext>,
      disconnect: () => disconnectNativeBrowser(browser) }
  } catch (error) { await disconnectNativeBrowser(browser); throw error }
}
export async function admittedContext(session: InstalledBrowserSession, actor: NativeActor, manifest = session.manifest) {
  const context = session.contexts[actor]
  const page = context.pages().find((item) => onShell(item, manifest.target.shellOrigin))
  if (!page) throw new Error("F04_ORIGINAL_ACTOR_PAGE_DISAPPEARED")
  const live = await observeNativeBinding(page, manifest.target)
  if (live.authMode !== "microsoft" || live.stamp.principalRef !== manifest.actors[actor])
    throw new Error("F04_CURRENT_ORIGINAL_PRINCIPAL_CHANGED")
  return context
}

/** Attempt every owned close and detach even after a failure; this helper emits no positive receipt. */
export async function closeNativeOwnedPages(
  pages: readonly Pick<Page, "close" | "isClosed">[],
  disconnect?: () => Promise<void>,
) {
  const failures: unknown[] = []
  try {
    for (const page of pages) {
      try {
        await page.close()
        if (!page.isClosed()) throw new Error("F04_OWNED_PAGE_NOT_CLOSED")
      } catch (error) { failures.push(error) }
    }
  } finally {
    if (disconnect) {
      try { await disconnect() } catch (error) { failures.push(error) }
    }
  }
  if (failures.length) throw new AggregateError(failures, "F04_OWNED_PAGE_CLEANUP_FAILED")
}
