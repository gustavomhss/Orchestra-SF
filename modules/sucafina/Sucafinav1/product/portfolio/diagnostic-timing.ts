// Snapshot-only readonly diagnostic. Never integrate into the product.
import { AsyncLocalStorage } from "node:async_hooks"
import { setInterval, clearInterval } from "node:timers"

type Bucket = { name: string; origin: string; surface: string; calls: number; settled: number; pending: number; milliseconds: number }
type Frame = {
  request: Request; sequence: number; started: number; origin: string; buckets: Map<string, Bucket>;
  bucketDrops: number; rootDrops: number; lineDrops: number; diagnosticErrors: number;
  emitted: number; snapshot: number; roots: Map<object, number>; rootSequence: number
}
type Measurement = { frame: Frame; bucket: Bucket; started: number; ended: boolean }
type Origin = { frame: Frame; previous: string }
const frames = new AsyncLocalStorage<Frame>()
let sequence = 0
const now = () => performance.now()
const maximumBuckets = 256, maximumRoots = 64, maximumLines = 2048, maximumLineLength = 4096

function emit(frame: Frame, value: Record<string, unknown>) {
  try {
    const summary = value.phase === "snapshot" || value.phase === "started"
    const limit = summary ? maximumLines : maximumLines - 16
    if (frame.emitted >= limit) { frame.lineDrops++; return }
    const line = "SF_PORTFOLIO_READONLY " + JSON.stringify({ request: frame.sequence, ...value })
    if (line.length > maximumLineLength) { frame.lineDrops++; return }
    frame.emitted++
    console.info(line)
  } catch { frame.diagnosticErrors++ }
}
function bucket(frame: Frame, name: string, surface: string): Bucket | undefined {
  // Physical-root ordinals deliberately do not contribute to this key.
  const key = JSON.stringify([name, frame.origin, surface])
  let value = frame.buckets.get(key)
  if (!value) {
    if (frame.buckets.size >= maximumBuckets) { frame.bucketDrops++; return undefined }
    value = { name, origin: frame.origin, surface, calls: 0, settled: 0, pending: 0, milliseconds: 0 }
    frame.buckets.set(key, value)
  }
  return value
}
/** Only surround a synchronous original lookup; never hold this across await. */
export function enterSfReadonlyDiagnostic(origin: string): Origin | undefined {
  try {
    const frame = frames.getStore()
    if (!frame) return undefined
    const previous = frame.origin
    if (previous === "none") frame.origin = origin
    return { frame, previous }
  } catch { return undefined }
}
export function leaveSfReadonlyDiagnostic(origin: Origin | undefined) {
  if (origin) origin.frame.origin = origin.previous
}
export function beginSfReadonlyDiagnostic(name: string, surface = "none"): Measurement | undefined {
  try {
    const frame = frames.getStore()
    if (!frame) return undefined
    const value = bucket(frame, name, surface)
    if (!value) return undefined
    value.calls++; value.pending++
    return { frame, bucket: value, started: now(), ended: false }
  } catch { return undefined }
}
export function endSfReadonlyDiagnostic(value: Measurement | undefined) {
  try {
    if (!value || value.ended) return
    value.ended = true
    value.bucket.settled++; value.bucket.pending--
    value.bucket.milliseconds += now() - value.started
  } catch { if (value) value.frame.diagnosticErrors++ }
}
export function countSfReadonlyDiagnostic(name: string, surface = "none") {
  try {
    const frame = frames.getStore()
    if (!frame) return
    const value = bucket(frame, name, surface)
    if (value) { value.calls++; value.settled++ }
  } catch { /* Diagnostic counters never replace an original outcome. */ }
}
/** Accept only the already-captured original identity, never query a provider. */
export function recordSfReadonlyRoot(phase: string, identity?: object) {
  try {
    const frame = frames.getStore()
    if (!frame) return
    let ordinal = identity && frame.roots.get(identity)
    if (identity && !ordinal) {
      if (frame.roots.size >= maximumRoots) frame.rootDrops++
      else { ordinal = ++frame.rootSequence; frame.roots.set(identity, ordinal) }
    }
    emit(frame, { phase: "root", kind: phase, ordinal: ordinal ?? null,
      elapsedMs: Math.round(now() - frame.started) })
  } catch { /* Root markers do not participate in ownership. */ }
}
function snapshot(frame: Frame, phase: "periodic" | "final") {
  const index = ++frame.snapshot, elapsedMs = Math.round(now() - frame.started)
  for (const value of frame.buckets.values()) {
    emit(frame, { phase: "bucket", snapshot: index, snapshotPhase: phase, elapsedMs,
      name: value.name, origin: value.origin, surface: value.surface,
      calls: value.calls, settled: value.settled, pending: value.pending,
      inclusiveMs: Math.round(value.milliseconds) })
  }
  emit(frame, { phase: "snapshot", snapshot: index, snapshotPhase: phase, elapsedMs,
    buckets: frame.buckets.size, pending: [...frame.buckets.values()].reduce((sum, row) => sum + row.pending, 0),
    bucketDrops: frame.bucketDrops, rootDrops: frame.rootDrops, lineDrops: frame.lineDrops,
    diagnosticErrors: frame.diagnosticErrors, emitted: frame.emitted,
    semantics: "cumulative; nested inclusive durations overlap; pending is not completion" })
}
export function withSfReadonlyDiagnostic<Value>(request: Request, operation: string, work: () => Promise<Value>): Promise<Value> {
  if (operation !== "decision-portfolio-preview") return work()
  // The existing HTTP Request enters this private ALS exactly once. No provider is wrapped.
  const frame: Frame = { request, sequence: ++sequence, started: now(), origin: "none", buckets: new Map(),
    bucketDrops: 0, rootDrops: 0, lineDrops: 0, diagnosticErrors: 0,
    emitted: 0, snapshot: 0, roots: new Map(), rootSequence: 0 }
  return frames.run(frame, async () => {
    emit(frame, { phase: "started", operation, schema: "sf-portfolio-readonly-v1",
      originalObservationWindowMs: 60000, maximumBuckets, maximumRoots, maximumLines, maximumLineLength })
    let ticks = 0
    const timer = setInterval(() => {
      try {
        if (now() - frame.started >= 60000 || ticks >= 5) { clearInterval(timer); return }
        ticks++
        snapshot(frame, "periodic")
        if (ticks >= 5) clearInterval(timer)
      } catch { frame.diagnosticErrors++ }
    }, 10000)
    timer.unref()
    const measured = beginSfReadonlyDiagnostic("http.preview")
    try { return await work() }
    finally {
      endSfReadonlyDiagnostic(measured)
      clearInterval(timer)
      try { snapshot(frame, "final") } catch { frame.diagnosticErrors++ }
    }
  })
}
