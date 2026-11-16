/** F04 installed Playwright consumer.
 * The browser is an already-running, host-owned CDP browser; every test page
 * inherits an existing Microsoft-authenticated BrowserContext. Never launch,
 * manufacture context/storageState, or copy authentication to a new session.
 */
import { test } from "@playwright/test"
import type { Browser, Locator } from "@playwright/test"
import {
  admittedContext, connectNativeInstalledBrowser,
} from "./fixture/installed-browser.ts"
import type { InstalledBrowserSession } from "./fixture/installed-browser.ts"
import { readNativeManifest, proveNativeWebReadiness } from "./fixture/readiness.ts"
import type { NativeActor, NativeManifest, NativeWebObservation } from "./fixture/readiness.ts"
import { requireNativeJourney } from "./fixture/journeys.ts"
import type { NativeJourney, NativeJourneyIntent } from "./fixture/journeys.ts"
import {
  consumeCurrentNativeSelection, nativeSuiteFromChapter,
  readNativeSelectedInstallation, u15RegisteredEnvironment,
} from "./fixture/selected-installation.ts"
import type {
  NativeInstalledCase, NativeSelectedInstallation, NativeInstalledSuite,
} from "./fixture/selected-installation.ts"

export { createNativeScratch } from "./fixture/isolated-installation.ts"
export { nativeCorpus, sourceNativeVolume, seedNativeProcurementCorpus } from "./fixture/corpus.ts"
export { registerNativeInstalledManifest } from "./fixture/installed-manifest.ts"
export { readNativeManifest, observeNativeBinding, proveNativeWebReadiness } from "./fixture/readiness.ts"
export { attachHostedNativeBrowser, connectNativeInstalledBrowser, admittedContext } from "./fixture/installed-browser.ts"
export {
  nativeJourneyEntryHref, nativeJourneyResolvedHref,
  nativeDashboardCommandTarget, requireNativeJourney,
} from "./fixture/journeys.ts"
export {
  registerNativeSelectedInstallation, readNativeSelectedInstallation,
  consumeCurrentNativeSelection, requireOriginalNativeOperations,
  readOriginalNativeSource, nativeSuiteFromChapter, u15RegisteredEnvironment,
} from "./fixture/selected-installation.ts"
export { armLostResponse, armHeldResponse, requestRealRevocation } from "./fixture/response-faults.ts"
export type { NativeManifest, NativeActor, NativeTarget, NativeLiveBinding } from "./fixture/readiness.ts"
export type { NativeJourney, NativeJourneyIntent } from "./fixture/journeys.ts"
export type {
  NativeInstalledSuite, NativeInstalledCase, NativeSelectedInstallation,
  NativeSuiteSelection, NativeSourceVersion,
} from "./fixture/selected-installation.ts"

export type NativeJourneyPrecondition = Readonly<{
  actor: NativeActor
  capabilityId: NativeJourney
  intent: NativeJourneyIntent
  year?: number
}>
export type InstalledNativeHarness = Readonly<{
  manifest: NativeManifest
  selected?: NativeSelectedInstallation
  selectedCase?: NativeInstalledCase
  proveWeb: (nativeChapter: Locator) => Promise<NativeWebObservation>
  requireJourney: (input: NativeJourneyPrecondition) =>
    ReturnType<typeof requireNativeJourney>
  desktop: "NOT_RUN_D01_REAL_ELECTRON_REQUIRED"
  componentFixture: "NOT_INSTALLED_PROOF"
}>

const attached = new WeakMap<Browser, InstalledBrowserSession>()

/** Bind titles of 194's *existing* tests to the private per-case actor
 * selection. An unrecognized title fails rather than silently reusing an
 * authorized requester for a denied scenario. This does not grant access:
 * consumeCurrentNativeSelection rechecks the real producer.
 */
export function nativeSelectedCase(
  suite: NativeInstalledSuite, title: string,
): NativeInstalledCase {
  if (suite === "U39" || suite === "U40") return "entry"
  const cases: readonly [string, NativeInstalledCase][] = [
    ["CAP14 real authorized list reads Dashboard contracts", "list"],
    ["CAP14 real edit uses source version", "editable"],
    ["CAP14 real denied second actor", "denied"],
    ["CAP14 real version conflict", "stale"],
    ["CAP14 real lost response", "lost"],
    ["CAP14 real owner-scoped 320px", "list"],
  ]
  const found = cases.filter(([prefix]) => title.startsWith(prefix))
  if (found.length !== 1)
    throw new Error("F04_U15_UNKNOWN_REAL_TEST_SELECTION_TITLE")
  return found[0]![1]
}

function verifyRunEnvironment(bundle: NativeSelectedInstallation) {
  if (bundle.suite !== "U15") return
  const required = u15RegisteredEnvironment(bundle)
  for (const [name, href] of Object.entries(required)) {
    if (process.env[name] !== href)
      throw new Error("F04_U15_PRIVATE_ORIGINAL_URL_NOT_BOUND_TO_TEST_" + name)
  }
}

/** Original host supplies already authenticated contexts via private CDP
 * descriptor; the default Playwright blank browser MUST NOT be used as
 * evidence of Microsoft sign-in or of the packaged desktop.
 */
export const nativeInstalledFixture = test.extend<{ nativeHarness: InstalledNativeHarness }>({
  browser: [async ({}, use) => {
    const session = await connectNativeInstalledBrowser()
    attached.set(session.browser, session)
    try { await use(session.browser) }
    finally {
      attached.delete(session.browser)
      await session.disconnect()
    }
  }, { scope: "worker" }],
  context: async ({ browser }, use, testInfo) => {
    const session = attached.get(browser)
    if (!session) throw new Error("F04_NO_HOST_OWNED_BROWSER_SESSION")
    const suite = nativeSuiteFromChapter(session.manifest)
    const selected = suite
      ? await readNativeSelectedInstallation(session.manifest, suite)
      : undefined
    if (selected) verifyRunEnvironment(selected)
    const caseId = selected && suite ? nativeSelectedCase(suite, testInfo.title) : undefined
    const actor: NativeActor = caseId && selected
      ? (selected.selections.find((entry) => entry.caseId === caseId)?.actor ??
          (() => { throw new Error("F04_CASE_ACTOR_NOT_REGISTERED") })())
      : "requester"
    const context = await admittedContext(session, actor)
    if (selected && caseId) {
      const sourcePage = context.pages().find((page) => {
        try { return new URL(page.url()).origin === session.manifest.target.shellOrigin }
        catch { return false }
      })
      if (!sourcePage) throw new Error("F04_CURRENT_SELECTED_CONTEXT_SHELL_PAGE_REQUIRED")
      await consumeCurrentNativeSelection({
        page: sourcePage, manifest: session.manifest,
        bundle: selected, caseId,
      })
    }
    // Do not dispose the host's authenticated context at test completion.
    await use(context)
  },
  nativeHarness: async ({ page }, use) => {
    const manifest = await readNativeManifest()
    const suite = nativeSuiteFromChapter(manifest)
    const selected = suite ? await readNativeSelectedInstallation(manifest, suite) : undefined
    await use({
      manifest, selected,
      proveWeb: (nativeChapter) => proveNativeWebReadiness(page, manifest, nativeChapter),
      requireJourney: (input) => requireNativeJourney({ ...input, manifest, page }),
      desktop: "NOT_RUN_D01_REAL_ELECTRON_REQUIRED",
      componentFixture: "NOT_INSTALLED_PROOF",
    })
  },
})
