// CI-only numeric observation. Never integrate this module or its callers.
// Spans and synchronous measurements are inclusive and can overlap. In particular,
// root.live includes currentSnapshots, sameOwner includes canonical work, and
// canonical.digest includes canonical.bytes. Do not add nested measurements.
// diagnosticMs measures bookkeeping and prior emissions, not external observer cost.
// syncClockReads counts the probe's clock reads. No per-call output or sampling timer.
type Initializer = () => Promise<boolean | "unsupported">
type Kind = 0 | 1 | 2
type RootEvent = "new" | "join" | "foreign" | "unsupported" | "callback" | "accepted"
const spanLabels = ["publish.replay", "publish.persist", "publish.register", "publish.issue",
  "mixed.prepare", "mixed.produce"] as const
type SpanLabel = typeof spanLabels[number]
type Span = { started: number; completed: number; active: number; inclusiveMs: number; lastMs: number }
const spans = Object.fromEntries(spanLabels.map((label) => [label,
  { started: 0, completed: 0, active: 0, inclusiveMs: 0, lastMs: 0 }])) as Record<SpanLabel, Span>
const syncLabels = ["root.live", "service.sameOwner", "driver.currentSnapshots", "driver.currentSnapshot",
  "canonical.bytes", "canonical.digest", "sqlite.connect", "sqlite.close", "sqlite.begin",
  "sqlite.select.snapshot", "sqlite.select.skipped", "snapshot.clone", "snapshot.decode",
  "snapshot.encode", "snapshot.plan", "snapshot.materialize"] as const
type SyncLabel = typeof syncLabels[number]
type SyncMetric = { count: number; totalMs: number; maxMs: number }
const synchronous = Object.fromEntries(syncLabels.map((label) => [label,
  { count: 0, totalMs: 0, maxMs: 0 }])) as Record<SyncLabel, SyncMetric>
const roots = {
  0: { new: 0, join: 0, foreign: 0, unsupported: 0, callback: 0, accepted: 0 },
  1: { new: 0, join: 0, foreign: 0, unsupported: 0, callback: 0, accepted: 0 },
  2: { new: 0, join: 0, foreign: 0, unsupported: 0, callback: 0, accepted: 0 },
}
const initializers = new WeakMap<Initializer, Kind>()
const started = performance.now()
let overheadMs = 0, emissions = 0, syncClockReads = 0
const rounded = (value: number) => Math.round(value * 1000) / 1000
function emit(label: SpanLabel, state: "start" | "finish") {
  try {
    const at = performance.now()
    try {
      emissions++
      console.info("SF_C17_SYNCHRONOUS_BOUNDARY", JSON.stringify({ label, state,
        elapsedMs: rounded(at - started), emissions, diagnosticMs: rounded(overheadMs),
        syncClockReads, inclusive: 1,
        spans: Object.fromEntries(spanLabels.map((key) => [key, { ...spans[key],
          inclusiveMs: rounded(spans[key].inclusiveMs), lastMs: rounded(spans[key].lastMs) }])),
        roots, synchronous: Object.fromEntries(syncLabels.map((key) => [key, {
          count: synchronous[key].count, totalMs: rounded(synchronous[key].totalMs),
          maxMs: rounded(synchronous[key].maxMs) }])) }))
    } finally { overheadMs += performance.now() - at }
  } catch { /* Diagnostic failure cannot replace a product return or exception. */ }
}
export function c17Clock(): number | undefined {
  try {
    const at = performance.now()
    syncClockReads++
    const value = performance.now()
    syncClockReads++
    overheadMs += value - at
    return value
  } catch { return undefined }
}
export function c17End(label: SyncLabel, at: number | undefined) {
  try {
    if (at === undefined) return
    const now = performance.now()
    syncClockReads++
    const elapsed = Math.max(0, now - at), metric = synchronous[label]
    metric.count++
    metric.totalMs += elapsed
    metric.maxMs = Math.max(metric.maxMs, elapsed)
    const ended = performance.now()
    syncClockReads++
    overheadMs += ended - now
  } catch { /* Only completed observations are counted; no exception escapes. */ }
}
export function c17MixedInitializer(kind: Kind, initialize: Initializer): Initializer {
  try {
    const at = performance.now()
    initializers.set(initialize, kind)
    overheadMs += performance.now() - at
  } catch {}
  return initialize
}
export function c17MixedRootKind(initialize: Initializer): Kind {
  try { return initializers.get(initialize) ?? 0 } catch { return 0 }
}
export function c17MixedRootCount(kind: Kind, event: RootEvent) {
  try {
    const at = performance.now()
    roots[kind][event]++
    overheadMs += performance.now() - at
  } catch {}
}
export function c17MixedSpan(label: SpanLabel): () => void {
  try {
    const at = performance.now()
    spans[label].started++
    spans[label].active++
    overheadMs += performance.now() - at
    emit(label, "start")
    let finished = false
    return () => {
      try {
        if (finished) return
        const ended = performance.now()
        finished = true
        const duration = ended - at
        spans[label].completed++
        spans[label].active--
        spans[label].inclusiveMs += duration
        spans[label].lastMs = duration
        overheadMs += performance.now() - ended
        emit(label, "finish")
      } catch {}
    }
  } catch { return () => {} }
}
