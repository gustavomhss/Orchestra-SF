// Snapshot-only, isomorphic pulse bridge. No sampler or runtime dependency.
let activePulse: (() => void) | undefined
let pulseCount = 0

export function setPortfolioJscPulse(pulse: (() => void) | undefined) {
  activePulse = pulse
  pulseCount = 0
}

/** Inactive digest calls neither increment the counter nor read a clock. */
export function pulsePortfolioJscDiagnostic() {
  try {
    if (!activePulse) return
    pulseCount = (pulseCount + 1) & 1023
    if (pulseCount === 0) activePulse()
  } catch { /* Observation cannot replace a digest or its exception. */ }
}
