type BoundaryMetric = 1 | 2 | 3 | 4 | 5 | 6

const closed = new Float64Array(6)
const timed = new Float64Array(6)
const milliseconds = new Float64Array(6)
let starts = 0
let ends = 0
let failures = 0
let emitted = false

export function c17BoundaryStart(): number | undefined {
  try {
    starts++
    const at = performance.now()
    if (Number.isFinite(at)) return at
    failures++
  } catch { failures++ }
  return undefined
}

export function c17BoundaryEnd(started: number | undefined, metric: BoundaryMetric): void {
  let elapsed: number | undefined
  try {
    ends++
    if (started !== undefined) {
      const value = performance.now() - started
      if (Number.isFinite(value) && value >= 0) elapsed = value
      else failures++
    }
  } catch { failures++ }
  try {
    const index = metric - 1
    closed[index] = (closed[index] ?? 0) + 1
    if (elapsed !== undefined) {
      timed[index] = (timed[index] ?? 0) + 1
      milliseconds[index] = (milliseconds[index] ?? 0) + elapsed
    }
  } catch { failures++ }
}

export function c17BoundaryMeasure<T>(metric: BoundaryMetric, work: () => T): T {
  const started = c17BoundaryStart()
  try { return work() }
  finally { c17BoundaryEnd(started, metric) }
}

export function flushC17BoundaryProfile(): void {
  if (emitted) return
  emitted = true
  try {
    const spans: number[][] = []
    for (let index = 0; index < 6; index++) {
      const count = closed[index] ?? 0
      if (count) spans.push([index + 1, count, timed[index] ?? 0, Number((milliseconds[index] ?? 0).toFixed(3))])
    }
    console.info("SF_C17_BOUNDARY_PROFILE", JSON.stringify({ schemaVersion: 1, spans, clock: [starts, ends, failures] }))
  } catch { failures++ }
}
