// Snapshot-only, isomorphic pulse bridge. No sampler or runtime dependency.
let activePulse: (() => void) | undefined
let pulseCount = 0

export function setContextJscPulse(pulse: (() => void) | undefined) {
  activePulse = pulse
  pulseCount = 0
}

/** Inactive digest calls neither increment the counter nor read a clock. */
export function pulseContextJscDiagnostic() {
  try {
    if (!activePulse) return
    pulseCount = (pulseCount + 1) & 1023
    if (pulseCount === 0) activePulse()
  } catch { /* Observation cannot replace a digest or its exception. */ }
}
