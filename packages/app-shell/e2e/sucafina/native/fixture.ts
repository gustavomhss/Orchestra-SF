import { writeNativePrivate } from "./fixture/installed-manifest.ts"
/** Original installed journeys: existing Microsoft contexts only, selected case and Team are explicit. */
import { test } from "@playwright/test"
import type { Browser, BrowserContext, Locator, Page } from "@playwright/test"
import { digest } from "../../../../../script/sf-ci/g08-private-evidence.mjs"
import { admittedContext, connectNativeInstalledBrowser, prepareNativePage } from "./fixture/installed-browser.ts"
import type { InstalledBrowserSession } from "./fixture/installed-browser.ts"
import { proveNativeWebReadiness } from "./fixture/readiness.ts"
import type { NativeWebObservation } from "./fixture/readiness.ts"
import type { NativeActor } from "./fixture/manifest-contract.ts"
import type { InstalledNativeManifest as NativeManifest } from "./fixture/g08-manifest-contract.ts"
import { requireNativeJourney } from "./fixture/journeys.ts"
import type { NativeJourney, NativeJourneyIntent } from "./fixture/journeys.ts"
import { consumeCurrentNativeSelection, nativeManifestForTarget, nativeSuiteFromChapter,
  readNativeSelectedInstallation, u15RegisteredEnvironment } from "./fixture/selected-installation.ts"
import type { NativeSelectedInstallation, NativeInstalledCase } from "./fixture/selected-installation.ts"
import { nativeSelectedCase, nativeTitles } from "./fixture/case-contract.ts"
import { createNativeInstalledOperations } from "./fixture/installed-operations.ts"

export { createNativeScratch } from "./fixture/isolated-installation.ts"
export { registerNativeInstalledManifest } from "./fixture/installed-manifest.ts"
export { observeNativeBinding, proveNativeWebReadiness, nativeTeamHeaders } from "./fixture/readiness.ts"
export { readG08NativeManifest as readNativeManifest } from "./fixture/g08-readiness.ts"
export { nativeTeamRef, nativeOwnerQuery } from "./fixture/manifest-contract.ts"
export { attachHostedNativeBrowser, connectNativeInstalledBrowser, admittedContext, prepareNativePage } from "./fixture/installed-browser.ts"
export { nativeOriginalRequest, requireNativePeer, nativeUIResponse } from "./fixture/browser-transport.ts"
export { nativeJourneyEntryHref, nativeJourneyResolvedHref, nativeDashboardCommandTarget, requireNativeJourney } from "./fixture/journeys.ts"
export { registerNativeSelectedInstallation, readNativeSelectedInstallation, consumeCurrentNativeSelection,
  requireOriginalNativeOperations, readOriginalNativeSource, readOriginalNativePage,
  nativeSuiteFromChapter, u15RegisteredEnvironment } from "./fixture/selected-installation.ts"
export { armLostResponse, armHeldResponse, requestRealRevocation } from "./fixture/response-faults.ts"
export { nativeSelectedCase } from "./fixture/case-contract.ts"
export type { NativeActor, NativeTarget, NativeLiveBinding } from "./fixture/readiness.ts"
export type { InstalledNativeManifest as NativeManifest } from "./fixture/g08-manifest-contract.ts"
export type { NativeJourney, NativeJourneyIntent } from "./fixture/journeys.ts"
export type { NativeInstalledSuite, NativeInstalledCase, NativeSelectedInstallation,
  NativeSuiteSelection, NativeSourceVersion } from "./fixture/selected-installation.ts"
export type NativeJourneyPrecondition = Readonly<{ actor: NativeActor; capabilityId: NativeJourney; intent: NativeJourneyIntent; year?: number }>
export type InstalledNativeHarness = Readonly<{
  manifest: NativeManifest; selected: NativeSelectedInstallation; selectedCase: NativeInstalledCase
  proveWeb(nativeChapter: Locator): Promise<NativeWebObservation>
  requireJourney(input: NativeJourneyPrecondition): ReturnType<typeof requireNativeJourney>
  revokeViaOriginalProducer: ReturnType<typeof createNativeInstalledOperations>["revokeViaOriginalProducer"]
  advanceViaSecondAuthenticatedWriter: ReturnType<typeof createNativeInstalledOperations>["advanceViaSecondAuthenticatedWriter"]
  desktop: "NOT_RUN_D01_REAL_ELECTRON_REQUIRED"; componentFixture: "NOT_INSTALLED_PROOF"
}>
type State = {
  manifest: NativeManifest; bundle: NativeSelectedInstallation; caseId: NativeInstalledCase; actor: NativeActor
  context: BrowserContext; page: Page; operations: ReturnType<typeof createNativeInstalledOperations>
}
const attached = new WeakMap<Browser, InstalledBrowserSession>()
function verifyRunEnvironment(bundle: NativeSelectedInstallation) {
  if (bundle.suite === "U15")
    for (const [name, href] of Object.entries(u15RegisteredEnvironment(bundle)))
      if (process.env[name] !== href) throw new Error("F04_U15_PRIVATE_ORIGINAL_URL_NOT_BOUND")
}
export const nativeInstalledFixture = test.extend<{ nativeHarness: InstalledNativeHarness; nativeState: State }>({
  browser: [async ({}, use) => {
    const session = await connectNativeInstalledBrowser()
    attached.set(session.browser, session)
    try { await use(session.browser) }
    finally {
      attached.delete(session.browser)
      const contexts = Object.values(session.contexts)
      const contextsPreserved = contexts.every((context) => session.browser.contexts().includes(context))
      await session.disconnect()
      if (!contextsPreserved) throw new Error("F04_HOST_AUTHENTICATED_CONTEXT_WAS_DISPOSED")
      if (session.browser.isConnected()) throw new Error("F04_CDP_CLIENT_NOT_DISCONNECTED")
      await writeNativePrivate(session.manifest.scratchRoot, "native-browser-detached.json", {
        schema: "sf2h.native-browser-detached.v2", candidateSha: session.manifest.candidateSha,
        invocation: session.manifest.invocation, contextsPreserved: true, clientDisconnected: true,
      })
    }
  }, { scope: "worker" }],
  nativeState: async ({ browser }, use, testInfo) => {
    const session = attached.get(browser)
    if (!session || testInfo.retry !== 0 || testInfo.repeatEachIndex !== 0 || testInfo.project.name !== "chromium")
      throw new Error("F04_SINGLE_ORIGINAL_INVOCATION_REQUIRED")
    const suite = nativeSuiteFromChapter(session.manifest)
    if (!suite) throw new Error("F04_NATIVE_SUITE_NOT_BOUND")
    const bundle = await readNativeSelectedInstallation(session.manifest, suite)
    verifyRunEnvironment(bundle)
    const caseId = nativeSelectedCase(suite, testInfo.title)
    const selected = bundle.selections.find((row) => row.caseId === caseId)
    if (!selected) throw new Error("F04_CASE_NOT_REGISTERED")
    const manifest = nativeManifestForTarget(session.manifest, selected.target)
    const context = await admittedContext(session, selected.actor, manifest)
    const originals = new Set(browser.contexts().flatMap((entry) => entry.pages()))
    const owned: Page[] = []
    let operations: ReturnType<typeof createNativeInstalledOperations> | undefined
    let callbackCleanup: Awaited<ReturnType<ReturnType<typeof createNativeInstalledOperations>["close"]>> | undefined
    let complete = false
    try {
      const page = await context.newPage()
      owned.push(page)
      await prepareNativePage(page)
      await page.setViewportSize({ width: 1280, height: 800 })
      await page.goto(selected.href)
      let routePage = page
      if (caseId === "denied") {
        const actor = (Object.keys(manifest.actors) as NativeActor[]).find((name) =>
          manifest.actors[name] === selected.routePrincipalRef && name !== selected.actor)
        if (!actor) throw new Error("F04_ORIGINAL_F01_OBSERVER_NOT_ATTACHED")
        routePage = await (await admittedContext(session, actor, manifest)).newPage()
        owned.push(routePage)
        await prepareNativePage(routePage)
        await routePage.goto(selected.href)
      }
      await consumeCurrentNativeSelection({ page, routePage, manifest: session.manifest, bundle, caseId })
      operations = createNativeInstalledOperations({ session, manifest, actor: selected.actor, page, caseId })
      await use({ manifest, bundle, caseId, actor: selected.actor, context, page, operations })
      complete = testInfo.status === "passed"
    } finally {
      const failures: unknown[] = []
      try { if (operations) callbackCleanup = await operations.close() } catch (error) { failures.push(error) }
      for (const page of owned) {
        try { await page.close(); if (!page.isClosed()) throw new Error("F04_OWNED_PAGE_STILL_OPEN") }
        catch (error) { failures.push(error) }
      }
      const remaining = browser.contexts().flatMap((entry) => entry.pages())
      const preserved = [...originals].every((page) => remaining.includes(page) && !page.isClosed())
      if (!preserved || remaining.some((page) => !originals.has(page))) failures.push(new Error("F04_ORIGINAL_PAGE_SET_CHANGED"))
      const number = nativeTitles[suite].findIndex((title) => title === testInfo.title) + 1
      await writeNativePrivate(manifest.scratchRoot, "native-case-" + suite.toLowerCase() + "-" + String(number).padStart(2, "0") + ".json", {
        schema: "sf2h.native-case-observation.v2", candidateSha: manifest.candidateSha, invocation: manifest.invocation,
        suite, number, titleSha256: digest(testInfo.title), caseId, actor: selected.actor,
        target: manifest.target, principalRef: manifest.actors[selected.actor],
        selectedManifestSha256: digest(JSON.stringify(bundle)), bodyCompleted: complete,
        cleanup: { ownPagesClosed: owned.length, originalPagesPreserved: preserved,
          callback: callbackCleanup ?? null, completed: failures.length === 0 && callbackCleanup !== undefined },
        proofClass: "OBSERVATION_REQUIRES_ORIGINAL_REPORT_AND_HOST_VERIFICATION",
      })
      if (failures.length) throw new AggregateError(failures, "F04_ORIGINAL_INVOCATION_CLEANUP_FAILED")
    }
  },
  context: async ({ nativeState }, use) => { await use(nativeState.context) },
  page: async ({ nativeState }, use) => { await use(nativeState.page) },
  nativeHarness: async ({ nativeState }, use) => {
    const state = nativeState
    await use({ manifest: state.manifest, selected: state.bundle, selectedCase: state.caseId,
      proveWeb: (chapter) => proveNativeWebReadiness(state.page, state.manifest, chapter),
      requireJourney: (input) => requireNativeJourney({ ...input, manifest: state.manifest, page: state.page }),
      revokeViaOriginalProducer: state.operations.revokeViaOriginalProducer,
      advanceViaSecondAuthenticatedWriter: state.operations.advanceViaSecondAuthenticatedWriter,
      desktop: "NOT_RUN_D01_REAL_ELECTRON_REQUIRED", componentFixture: "NOT_INSTALLED_PROOF" })
  },
})
