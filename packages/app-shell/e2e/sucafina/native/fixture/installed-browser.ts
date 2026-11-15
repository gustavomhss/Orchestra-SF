/** F04 installed browser attachment. No browser is launched, no cookie or storageState is imported.
 * The existing, host-authenticated Microsoft BrowserContexts are attached through
 * an exclusive, runner-owned private CDP descriptor. This descriptor never reaches
 * Git, test artifacts, CLI output, or an agent tool result.
 */
import { lstat, readFile, realpath } from "node:fs/promises"
import path from "node:path"
import { chromium } from "@playwright/test"
import type { Browser, BrowserContext, Page } from "@playwright/test"
import { observeNativeBinding, readNativeManifest, requirePrivateNativeRoot } from "./readiness.ts"
import type { NativeActor, NativeManifest } from "./readiness.ts"

export type InstalledBrowserSession = Readonly<{
  browser: Browser
  manifest: NativeManifest
  contexts: Readonly<Partial<Record<NativeActor, BrowserContext>>>
  disconnect(): Promise<void>
}>

const actorNames = ["requester", "holder", "denied", "dashboardAdmin"] as const

async function privateEndpoint(rootPath: string): Promise<string> {
  const root = await requirePrivateNativeRoot(rootPath)
  const file = process.env.SF_NATIVE_BROWSER_ENDPOINT_FILE
  if (!file || !path.isAbsolute(file) || path.dirname(path.resolve(file)) !== root)
    throw new Error("F04_HOSTED_PRIVATE_CDP_ENDPOINT_FILE_REQUIRED")
  const stat = await lstat(file)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0 || stat.size > 4096 ||
      (stat.mode & 0o077) !== 0 || await realpath(file) !== path.resolve(file) ||
      (typeof process.getuid === "function" && stat.uid !== process.getuid()))
    throw new Error("F04_PRIVATE_CDP_ENDPOINT_FILE_ISOLATION_REQUIRED")
  const endpoint = (await readFile(file, "utf8")).trim()
  let url: URL
  try { url = new URL(endpoint) }
  catch { throw new Error("F04_PRIVATE_CDP_ENDPOINT_INVALID") }
  if (!["ws:", "http:"].includes(url.protocol) ||
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      !url.port || url.username || url.password || url.hash)
    throw new Error("F04_PRIVATE_CDP_ENDPOINT_NOT_LOOPBACK")
  return endpoint
}

function onShell(page: Page, manifest: NativeManifest) {
  try { return new URL(page.url()).origin === manifest.target.shellOrigin }
  catch { return false }
}

/** Attach a browser which was launched and authenticated by the authorized host,
 * before the first F04 manifest can exist. Never launch/restart a browser here.
 */
export async function attachHostedNativeBrowser(scratchRoot: string): Promise<Browser> {
  const endpoint = await privateEndpoint(scratchRoot)
  try { return await chromium.connectOverCDP(endpoint, { timeout: 30000 }) }
  catch { throw new Error("F04_APPROVED_HOST_BROWSER_NOT_CONNECTED") }
}

/** Re-attach only; this must NOT create a Playwright BrowserContext. */
export async function connectNativeInstalledBrowser(): Promise<InstalledBrowserSession> {
  const manifest = await readNativeManifest()
  const browser = await attachHostedNativeBrowser(manifest.scratchRoot)
  try {
    const found: Partial<Record<NativeActor, BrowserContext>> = {}
    const contexts = browser.contexts()
    if (contexts.length < 3) throw new Error("F04_THREE_PREAUTHENTICATED_MICROSOFT_CONTEXTS_REQUIRED")
    for (const context of contexts) {
      const existing = context.pages().find((page) => onShell(page, manifest))
      if (!existing) continue
      // The *actual* cookie jar is used by the original producer; failures are
      // not converted into a login, role, grant, session or synthetic fixture.
      const live = await observeNativeBinding(existing, manifest.target).catch(() => undefined)
      if (!live || live.authMode !== "microsoft") continue
      const actor = actorNames.find((name) =>
        manifest.actors[name] === live.stamp.principalRef)
      if (!actor) continue
      if (found[actor]) throw new Error("F04_AMBIGUOUS_AUTHENTICATED_PRINCIPAL_CONTEXT")
      found[actor] = context
    }
    for (const actor of ["requester", "holder", "denied"] as const)
      if (!found[actor]) throw new Error("F04_REAL_MICROSOFT_" + actor.toUpperCase() + "_BROWSER_CONTEXT_NOT_ATTACHED")
    if (manifest.actors.dashboardAdmin && !found.dashboardAdmin)
      throw new Error("F04_REAL_MICROSOFT_DASHBOARD_ADMIN_CONTEXT_NOT_ATTACHED")
    const distinct = Object.values(found)
    if (new Set(distinct).size !== distinct.length)
      throw new Error("F04_BROWSER_CONTEXTS_NOT_DISTINCT")
    return { browser, manifest, contexts: found, disconnect: () => browser.close() }
  } catch (error) {
    await browser.close()
    throw error
  }
}

/** Reverify the current principal with the original producer before a test uses
 * a selected context; a private actor label is NEVER treated as a grant. */
export async function admittedContext(
  session: InstalledBrowserSession, actor: NativeActor,
): Promise<BrowserContext> {
  const context = session.contexts[actor]
  if (!context) throw new Error("F04_MISSING_AUTHENTICATED_ACTOR_CONTEXT_" + actor.toUpperCase())
  const page = context.pages().find((value) => onShell(value, session.manifest))
  if (!page) throw new Error("F04_ACTOR_SHELL_WINDOW_DISAPPEARED")
  const live = await observeNativeBinding(page, session.manifest.target)
  if (live.authMode !== "microsoft" ||
      live.stamp.principalRef !== session.manifest.actors[actor])
    throw new Error("F04_ACTOR_AUTHORIZATION_CHANGED")
  return context
}
