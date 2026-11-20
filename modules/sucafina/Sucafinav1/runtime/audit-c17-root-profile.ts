// CI-only C17 route/phase timing probe. Do not integrate this module or its call sites.
type Metric = { started: number; completed: number; totalMs: number; maxMs: number }
const metrics = new Map<string, Metric>()
const counts = new Map<string, number>()
const begun = performance.now()
let last = begun, diagnosticMs = 0, sawAbort = false, reportedAbort = false

export function c17RootStart(label: string): number {
  const now = performance.now()
  try {
    const value = metrics.get(label) ?? { started: 0, completed: 0, totalMs: 0, maxMs: 0 }
    value.started++
    metrics.set(label, value)
  } catch { /* Diagnostics cannot change product control flow. */ }
  diagnosticMs += Math.max(0, performance.now() - now)
  return now
}

export function c17RootCount(label: string) {
  const now = performance.now()
  try { counts.set(label, (counts.get(label) ?? 0) + 1) }
  catch { /* Diagnostics cannot change product control flow. */ }
  diagnosticMs += Math.max(0, performance.now() - now)
}

export function c17RootEnd(label: string, started: number, aborted = false) {
  const now = performance.now()
  try {
    const elapsed = Math.max(0, now - started)
    const value = metrics.get(label) ?? { started: 0, completed: 0, totalMs: 0, maxMs: 0 }
    value.completed++; value.totalMs += elapsed; value.maxMs = Math.max(value.maxMs, elapsed)
    metrics.set(label, value)
    sawAbort ||= aborted
    if (now - last >= 5000 || sawAbort && !reportedAbort) {
      last = now
      reportedAbort ||= sawAbort
      // All spans are inclusive and overlap. No exclusive product cost is measured.
      // Fixed source labels only: no source, case, Request, identity or stack data.
      console.info("SF_C17_ROOT_PROFILE", JSON.stringify({
        elapsedMs: Math.round(now - begun), aborted: sawAbort, cumulative: true,
        asyncInclusive: true, exclusiveProductMsMeasured: false,
        diagnosticMs: Math.round(diagnosticMs * 1000) / 1000,
        counts: Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b))),
        metrics: Object.fromEntries([...metrics].sort(([a], [b]) => a.localeCompare(b)).map(([name, item]) =>
          [name, { started: item.started, completed: item.completed, active: item.started - item.completed,
            totalMs: Math.round(item.totalMs * 1000) / 1000, maxMs: Math.round(item.maxMs * 1000) / 1000 }])),
      }))
    }
  } catch { /* Emission cannot replace a product return or exception, including in finally. */ }
  diagnosticMs += Math.max(0, performance.now() - now)
}
