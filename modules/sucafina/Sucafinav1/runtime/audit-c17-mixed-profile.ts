// CI-only numeric observation. Never integrate this module or its callers.
// Spans are inclusive/overlapping and include nested diagnostic work. The
// separately measured diagnostic overhead is reported through the prior emit.
type Initializer = () => Promise<boolean | "unsupported">
type Kind = 0 | 1 | 2 // unclassified, record, mixed; no product identity is retained
type RootEvent = "new" | "join" | "foreign" | "unsupported" | "callback" | "accepted"
const spanLabels = ["publish.replay", "publish.persist", "publish.register", "publish.issue",
  "mixed.prepare", "mixed.produce", "siblings.fixture", "siblings.produce", "siblings.issue"] as const
type SpanLabel = typeof spanLabels[number]
type PointLabel = "siblings.root.enter" | "siblings.root.leave" | "siblings.barrier.enter" |
  "siblings.barrier.release" | "siblings.barrier.complete"
type Span = { started: number; completed: number; active: number; inclusiveMs: number; lastMs: number }
const spans = Object.fromEntries(spanLabels.map((label) => [label,
  { started: 0, completed: 0, active: 0, inclusiveMs: 0, lastMs: 0 }])) as Record<SpanLabel, Span>
const roots = {
  0: { new: 0, join: 0, foreign: 0, unsupported: 0, callback: 0, accepted: 0 },
  1: { new: 0, join: 0, foreign: 0, unsupported: 0, callback: 0, accepted: 0 },
  2: { new: 0, join: 0, foreign: 0, unsupported: 0, callback: 0, accepted: 0 },
}
const points: Record<PointLabel, number> = { "siblings.root.enter": 0, "siblings.root.leave": 0,
  "siblings.barrier.enter": 0, "siblings.barrier.release": 0, "siblings.barrier.complete": 0 }
const initializers = new WeakMap<Initializer, Kind>()
const started = performance.now()
let overheadMs = 0, emissions = 0
const rounded = (value: number) => Math.round(value * 1000) / 1000
function emit(label: SpanLabel | PointLabel, state: "start" | "finish" | "point") {
  try {
    const at = performance.now()
    try {
      emissions++
      console.info("SF_C17_MIXED_BOUNDARY", JSON.stringify({ label, state,
        elapsedMs: rounded(at - started), emissions, diagnosticMs: rounded(overheadMs), inclusive: 1,
        spans: Object.fromEntries(spanLabels.map((key) => [key, { ...spans[key],
          inclusiveMs: rounded(spans[key].inclusiveMs), lastMs: rounded(spans[key].lastMs) }])),
        roots, points }))
    } finally { overheadMs += performance.now() - at }
  } catch { /* Diagnostic failure cannot replace a product return or exception. */ }
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
export function c17MixedPoint(label: PointLabel) {
  try {
    const at = performance.now()
    points[label]++
    overheadMs += performance.now() - at
    emit(label, "point")
  } catch {}
}
