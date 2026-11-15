// F04 native fixture: implementation only; installed/auth/desktop proof requires the real host.
import { test } from "@playwright/test"
import type { Locator } from "@playwright/test"
import { readNativeManifest, proveNativeWebReadiness } from "./fixture/readiness.ts"
import type { NativeManifest, NativeWebObservation } from "./fixture/readiness.ts"

export { createNativeScratch } from "./fixture/scratch.ts"
export { nativeCorpus, sourceNativeVolume, seedNativeProcurementCorpus } from "./fixture/corpus.ts"
export { armLostResponse, armHeldResponse, requestRealRevocation } from "./fixture/response-faults.ts"

export type InstalledNativeHarness = Readonly<{
  manifest: NativeManifest
  proveWeb: (nativeChapter: Locator) => Promise<NativeWebObservation>
  desktop: "NOT_RUN_D01_REAL_ELECTRON_REQUIRED"
  componentFixture: "NOT_INSTALLED_PROOF"
}>

/** Never spawns its own fake app, intercepts auth, or invents successful roles.
 * 114's real host registration supplies the private manifest and mounted app.
 * A missing real installation is an explicit failure, not an E2E skip/pass.
 */
export const nativeInstalledFixture = test.extend<{ nativeHarness: InstalledNativeHarness }>({
  nativeHarness: async ({ page }, use) => {
    const manifest = await readNativeManifest()
    await use({
      manifest,
      proveWeb: (nativeChapter) => proveNativeWebReadiness(page, manifest, nativeChapter),
      desktop: "NOT_RUN_D01_REAL_ELECTRON_REQUIRED",
      componentFixture: "NOT_INSTALLED_PROOF",
    })
  },
})
