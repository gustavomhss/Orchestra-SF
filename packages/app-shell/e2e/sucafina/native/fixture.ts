/** F04 bridge for genuine installed Playwright journeys.
 * Never creates a listener, fake auth state or a product implementation.
 * I00/162 owns the production config and already-running authorized host.
 */
import { test } from "@playwright/test"
import type { Locator } from "@playwright/test"
import { readNativeManifest, proveNativeWebReadiness } from "./fixture/readiness.ts"
import type { NativeActor, NativeManifest, NativeWebObservation } from "./fixture/readiness.ts"
import { requireNativeJourney } from "./fixture/journeys.ts"
import type { NativeJourney, NativeJourneyIntent } from "./fixture/journeys.ts"

export { createNativeScratch } from "./fixture/scratch.ts"
export { nativeCorpus, sourceNativeVolume, seedNativeProcurementCorpus } from "./fixture/corpus.ts"
export { registerNativeInstalledManifest } from "./fixture/installed-manifest.ts"
export { readNativeManifest, observeNativeBinding, proveNativeWebReadiness } from "./fixture/readiness.ts"
export {
  nativeJourneyEntryHref, nativeJourneyResolvedHref,
  nativeDashboardCommandTarget, requireNativeJourney,
} from "./fixture/journeys.ts"
export { armLostResponse, armHeldResponse, requestRealRevocation } from "./fixture/response-faults.ts"
export type { NativeManifest, NativeActor, NativeTarget, NativeLiveBinding } from "./fixture/readiness.ts"
export type { NativeJourney, NativeJourneyIntent } from "./fixture/journeys.ts"

export type NativeJourneyPrecondition = Readonly<{
  actor: NativeActor
  capabilityId: NativeJourney
  intent: NativeJourneyIntent
  year?: number
}>
export type InstalledNativeHarness = Readonly<{
  manifest: NativeManifest
  proveWeb: (nativeChapter: Locator) => Promise<NativeWebObservation>
  requireJourney: (input: NativeJourneyPrecondition) =>
    ReturnType<typeof requireNativeJourney>
  desktop: "NOT_RUN_D01_REAL_ELECTRON_REQUIRED"
  componentFixture: "NOT_INSTALLED_PROOF"
}>

/** The runner and I00 must have installed and authenticated the selected host.
 * A missing manifest/current principal/capability explicitly fails this fixture,
 * rather than producing skip, mock coverage or a synthesized green test.
 */
export const nativeInstalledFixture = test.extend<{ nativeHarness: InstalledNativeHarness }>({
  nativeHarness: async ({ page }, use) => {
    const manifest = await readNativeManifest()
    await use({
      manifest,
      proveWeb: (nativeChapter) => proveNativeWebReadiness(page, manifest, nativeChapter),
      requireJourney: (input) => requireNativeJourney({ ...input, manifest, page }),
      desktop: "NOT_RUN_D01_REAL_ELECTRON_REQUIRED",
      componentFixture: "NOT_INSTALLED_PROOF",
    })
  },
})
