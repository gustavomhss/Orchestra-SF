// CI-only C17 timing probe. Do not integrate this module or its call sites.
type Metric = { count: number; totalMs: number; maxMs: number }
const metrics = new Map<string, Metric>()
const begun = performance.now()
let last = begun
let reportedAbort = false

export const c17Clock = () => performance.now()
export function c17End(label: string, started: number, aborted = false) {
  const now = performance.now(), elapsed = Math.max(0, now - started)
  const value = metrics.get(label) ?? { count: 0, totalMs: 0, maxMs: 0 }
  value.count++; value.totalMs += elapsed; value.maxMs = Math.max(value.maxMs, elapsed)
  metrics.set(label, value)
  if (now - last < 5000 && (!aborted || reportedAbort)) return
  last = now
  if (aborted) reportedAbort = true
  // Async measurements are inclusive and overlap; never sum them as CPU time.
  // Labels are fixed source categories. No state, Request or source bytes escape.
  try {
    console.info("SF_C17_PROFILE", JSON.stringify({
      product: "094d8919819dcbad73dc6d7f02ef7b8dd4faefd4",
      elapsedMs: Math.round(now - begun), aborted, cumulative: true, asyncInclusive: true,
      metrics: Object.fromEntries([...metrics].sort(([a], [b]) => a.localeCompare(b)).map(([name, item]) =>
        [name, { count: item.count, totalMs: Math.round(item.totalMs * 1000) / 1000, maxMs: Math.round(item.maxMs * 1000) / 1000 }])),
    }))
  } catch { /* Diagnostic output cannot replace a product return or exception. */ }
}

// Origin enum: 0 other, 1 scenario-request-store, 2 calculation-read-scope, 3 unclassified.
export function c17ReadOrigin(): 0 | 1 | 2 | 3 {
  const started = c17Clock()
  try {
    for (const frame of (new Error().stack ?? "").split("\n")) {
      if (!/\.tsx?:\d+/.test(frame) || frame.includes("/audit-c17-profile.ts") || frame.includes("/state-provider.ts")) continue
      if (frame.includes("/scenario-request-store.ts:")) return 1
      if (frame.includes("/planner-calculation-read-scope.ts:")) return 2
      return 0
    }
    return 3
  } finally { c17End("instrumentation.stack", started) }
}

export function c17Clone<T>(value: T, label: 0 | 1 | 2 | 3): T {
  const started = c17Clock()
  try { return structuredClone(value) }
  finally { c17End("state.fullClone." + label, started) }
}
