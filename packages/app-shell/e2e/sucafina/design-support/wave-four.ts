import { waveThreeTest } from "./wave-three"
import { withDesignInstallation } from "./installation"

// Reuse the same original enrollment, owner fences, capture and diagnostic
// lifecycle. Only the isolated producer seed changes for this wave.
export const waveFourTest = waveThreeTest.extend<{ designWave: "four" | "four-decisions" }>({
  designWave: ["four", { option: true }],
  installation: [async ({ designWave }, use) => { await withDesignInstallation(use, designWave) }, { scope: "test", timeout: 190_000 }],
})

export {
  armOriginalRead, capture, enter, observePage, originalRead, originalReads, type OriginalRead, ready, reflow, reviewActions, scheme, scrollPageTop,
} from "./wave-three"
