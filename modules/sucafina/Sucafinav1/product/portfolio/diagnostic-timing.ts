// Snapshot-only readonly diagnostic. Never integrate into the product.
import { AsyncLocalStorage } from "node:async_hooks"
import { setInterval, clearInterval } from "node:timers"

type Bucket = { name: string; origin: string; surface: string; calls: number; settled: number; pending: number; milliseconds: number }
type Frame = {
  request: Request; sequence: number; started: number; origin: string; buckets: Map<string, Bucket>;
  bucketDrops: number; rootDrops: number; lineDrops: number; diagnosticErrors: number;
  emitted: number; snapshot: number; roots: Map<object, number>; rootSequence: number;
  nextPeriodic: number; periodicSnapshots: number; skippedPeriodicThresholds: number; checkpointing: boolean
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
    const ended = now()
    value.bucket.milliseconds += ended - value.started
    checkpoint(value.frame, ended, "settled-span")
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
function snapshot(frame: Frame, phase: "periodic" | "final", at = now(), trigger: "timer" | "settled-span" | "unwind" = "unwind", dueMs?: number) {
  const index = ++frame.snapshot, elapsedMs = Math.round(at - frame.started)
  for (const value of frame.buckets.values()) {
    emit(frame, { phase: "bucket", snapshot: index, snapshotPhase: phase, elapsedMs, trigger, dueMs,
      name: value.name, origin: value.origin, surface: value.surface,
      calls: value.calls, settled: value.settled, pending: value.pending,
      inclusiveMs: Math.round(value.milliseconds) })
  }
  emit(frame, { phase: "snapshot", snapshot: index, snapshotPhase: phase, elapsedMs, trigger, dueMs,
    periodicSnapshots: frame.periodicSnapshots, skippedPeriodicThresholds: frame.skippedPeriodicThresholds,
    nextPeriodicDueMs: frame.nextPeriodic <= 50000 ? frame.nextPeriodic : null,
    buckets: frame.buckets.size, pending: [...frame.buckets.values()].reduce((sum, row) => sum + row.pending, 0),
    bucketDrops: frame.bucketDrops, rootDrops: frame.rootDrops, lineDrops: frame.lineDrops,
    diagnosticErrors: frame.diagnosticErrors, emitted: frame.emitted,
    semantics: "cumulative; nested inclusive durations overlap; pending is not completion" })
}
/** Report at an existing diagnostic boundary even when timers cannot run between microtasks. */
function checkpoint(frame: Frame, at: number, trigger: "timer" | "settled-span") {
  if (frame.checkpointing || frame.nextPeriodic > 50000) return
  const elapsed = at - frame.started
  if (elapsed >= 60000) {
    frame.skippedPeriodicThresholds += (60000 - frame.nextPeriodic) / 10000
    frame.nextPeriodic = 60000
    return
  }
  if (elapsed < frame.nextPeriodic) return
  const dueMs = frame.nextPeriodic
  const next = (Math.floor(elapsed / 10000) + 1) * 10000
  // Coalesce crossed thresholds into one actual observation. Never invent earlier samples.
  frame.skippedPeriodicThresholds += (next - dueMs) / 10000 - 1
  frame.nextPeriodic = next
  frame.periodicSnapshots++
  frame.checkpointing = true
  try { snapshot(frame, "periodic", at, trigger, dueMs) }
  finally { frame.checkpointing = false }
}
export function withSfReadonlyDiagnostic<Value>(request: Request, operation: string, work: () => Promise<Value>): Promise<Value> {
  if (operation !== "decision-portfolio-preview") return work()
  // The existing HTTP Request enters this private ALS exactly once. No provider is wrapped.
  const frame: Frame = { request, sequence: ++sequence, started: now(), origin: "none", buckets: new Map(),
    bucketDrops: 0, rootDrops: 0, lineDrops: 0, diagnosticErrors: 0,
    emitted: 0, snapshot: 0, roots: new Map(), rootSequence: 0,
    nextPeriodic: 10000, periodicSnapshots: 0, skippedPeriodicThresholds: 0, checkpointing: false }
  return frames.run(frame, async () => {
    emit(frame, { phase: "started", operation, schema: "sf-portfolio-readonly-v2", scopeOrigin: "before-human-admit",
      canonicalDigestSurface: { meaning: "direct-caller-label", labels: ["principal.direct", "source.scope-validation", "source.other", "finance.current", "finance.other", "bcs.planner.projection-period", "bcs.planner.expected-period", "bcs.planner.source-ref", "bcs.planner.expected-ref", "canonical.evidence-ref", "planner.source.projection", "planner.source.selector", "planner.source.envelope", "planner.evidence.projection", "planner.source.role-map", "source.run-fence", "bcs.capture.sources", "bcs.capture.snapshots", "bcs.capture.extras", "bcs.capture.captures", "unlabelled"] },
      canonicalDirect: "direct canonicalSfValue calls; internal digest canonicalization excluded",
      bcsCaptureStable: "sync captureObservations.read stable body; conditional on readSfMemoryCaptureIntegrity use; includes currentSnapshots and argument work when reached; nested digest durations overlap; initial snapshot capture excluded",
      originalObservationWindowMs: 60000, maximumBuckets, maximumRoots, maximumLines, maximumLineLength,
      periodicThresholdsMs: [10000, 20000, 30000, 40000, 50000], checkpointModes: ["timer", "settled-span"] })
    const timer = setInterval(() => {
      try {
        const at = now()
        checkpoint(frame, at, "timer")
        if (at - frame.started >= 60000 || frame.nextPeriodic > 50000) clearInterval(timer)
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
