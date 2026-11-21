import { waveThreeTest } from "./wave-three"
import { withDesignInstallation } from "./installation"

// Reuse the same original enrollment, owner fences, capture and diagnostic
// lifecycle. Only the isolated producer seed changes for this wave.
export const waveFourTest = waveThreeTest.extend({
  installation: [async ({}, use) => { await withDesignInstallation(use, "four") }, { timeout: 190_000 }],
})

export {
  capture, enter, observePage, ready, reflow, reviewActions, scheme, scrollPageTop,
} from "./wave-three"
