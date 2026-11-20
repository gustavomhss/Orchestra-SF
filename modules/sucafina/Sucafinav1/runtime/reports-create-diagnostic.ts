import { AsyncLocalStorage } from "node:async_hooks"
import { installSfCreateCanonicalObserver } from "../product/contracts/reports-create-metrics.ts"

// CI-only. None of these observers is a product integration candidate.
// Request identity stays private; wire IDs are ephemeral monotonic counters.
type Owner = 1 | 2
type Metric = [number, number, number]
type Scope = { id: number; owner: Owner; request?: Request; mode: number; method: number; phase: number;
  started: number; emitted: number; open: boolean; enabled: boolean; clocks: number;
  bookkeeping: [number, number]; output: [number, number]; metrics: Map<number, Metric> }
const execution = new AsyncLocalStorage<Scope>()
const active = new Set<Scope>()
const requests = new WeakMap<Request, number>()
const queued = new WeakMap<object, Owner>()
const sequence = { value: 0 }
const stages: readonly string[] = [
  "canonical.value-inclusive",
  "storage.memo-hit-dashboard",
  "storage.memo-hit-planner",
  "storage.memo-hit-procurement",
  "storage.memo-miss-dashboard",
  "storage.memo-miss-planner",
  "storage.memo-miss-procurement",
  "storage.materialize-plan",
  "storage.clone-snapshot",
  "storage.decode-snapshot",
  "storage.plan-inclusive",
  "storage.queue-wait-inclusive",
  "storage.write-lock-inclusive",
  "storage.queue-predecessor-request",
  "storage.queue-predecessor-local-maintenance",
  "storage.queue-predecessor-unattributed",
  "request.same",
  "request.mismatch",
  "observer.clock-reads",
  "observer.metric-bookkeeping",
  "observer.output-bookkeeping"
]
const phases: readonly string[] = [
  "entry-route",
  "entry-identity-enter",
  "entry-identity-done",
  "entry-prepare-enter",
  "entry-prepare-done",
  "entry-native-enter",
  "entry-native-done",
  "entry-business-enter",
  "entry-business-done",
  "http-enter",
  "http-payload-enter",
  "http-payload-done",
  "http-admission-enter",
  "http-admission-done",
  "http-invoke-enter",
  "http-invoke-done",
  "http-finish",
  "create-enter",
  "create-admission-done",
  "create-review-state-done",
  "create-review-fence-enter",
  "create-review-fence-done",
  "create-mutation-fence-enter",
  "create-mutation-fence-done",
  "create-c08-enter",
  "create-c08-callback-enter",
  "create-c08-checks-done",
  "create-c08-done",
  "create-egress-enter",
  "create-egress-read-done",
  "create-egress-done"
]
const modes: readonly string[] = ["review-thread-context", "collaboration-storage-version", "collaboration-thread-create"]
const prefix = "SF_REPORTS_CREATE_DIAGNOSTIC "

function emit(scope: Scope, event: number) {
  try { emitMeasured(scope, event) } catch { /* Best effort; even clock/output failures stay observational. */ }
}

function emitMeasured(scope: Scope, event: number) {
  if (!scope.enabled) return
  const started = performance.now()
  scope.clocks++
  try {
    scope.emitted = started
    const counts = [0, 0]
    for (const held of active) counts[held.owner - 1] = (counts[held.owner - 1] ?? 0) + 1
    console.info(prefix + JSON.stringify({ v: 1, event, id: scope.id, owner: scope.owner,
      mode: scope.mode, method: scope.method, phase: scope.phase, elapsedMs: started - scope.started, active: counts,
      metrics: [...scope.metrics].map(([code, value]) => [code, ...value]).concat([
        [19, scope.clocks, 0, 0], [20, scope.bookkeeping[0], scope.bookkeeping[1], 0],
        [21, scope.output[0], scope.output[1], 0],
      ]) }))
  } catch { /* No diagnostic failure replaces a product result or exception. */ }
  finally {
    const ended = performance.now()
    scope.clocks++
    scope.output[0]++
    scope.output[1] += ended - started
  }
}

function run<Value>(owner: Owner, work: () => Promise<Value>, request?: Request): Promise<Value> {
  const invocation = { called: false }
  try {
    const started = performance.now()
    const scope: Scope = { id: ++sequence.value, owner, request, mode: 0, method: 0, phase: 0,
      started, emitted: started, open: true, enabled: false, clocks: 1,
      bookkeeping: [0, 0], output: [0, 0], metrics: new Map() }
    if (request) requests.set(request, scope.id)
    active.add(scope)
    const abort = () => { if (scope.open) emit(scope, 4) }
    const finish = (event: number) => {
      if (!scope.open) return
      scope.open = false
      try { emit(scope, event) } finally {
        active.delete(scope)
        try { request?.signal.removeEventListener("abort", abort) } catch { /* Best effort observation only. */ }
        scope.request = undefined
      }
    }
    return execution.run(scope, () => {
      try { request?.signal.addEventListener("abort", abort, { once: true }) } catch { /* No new cancellation policy. */ }
      invocation.called = true
      try {
        const pending = work()
        // The original work promise is returned. No await or producer replacement.
        void pending.then(() => finish(5), () => finish(6))
        return pending
      } catch (error) { finish(6); throw error }
    })
  } catch (error) {
    if (invocation.called) throw error
    // Failure before entering the product callback cannot suppress that callback.
    return work()
  }
}

export const sfCreateReportsDiagnostic = {
  request: <Value>(request: Request, work: () => Promise<Value>) => run(1, work, request),
  // Even when this work was requested by a POST, it owns no Request metrics.
  maintenance: <Value>(work: () => Promise<Value>) => run(2, work),
  route: (mode: string | null, method: string) => {
    try {
    const scope = execution.getStore()
    if (!scope?.open || scope.owner !== 1) return
    scope.mode = modes.indexOf(mode ?? "") + 1
    scope.method = ["GET", "POST", "HEAD"].indexOf(method) + 1
    scope.enabled = scope.mode !== 0
    scope.phase = 1
    emit(scope, 1)
    } catch { /* Observation only. */ }
  },
  phase: (stage: string, request?: Request) => {
    try {
    const scope = execution.getStore(), code = phases.indexOf(stage) + 1
    if (!scope?.open || !scope.enabled || !code) return
    if (request && (scope.request !== request || requests.get(request) !== scope.id)) {
      sfCreateReportsDiagnostic.metric("request.mismatch")
      return
    }
    scope.phase = code
    emit(scope, 2)
    } catch { /* Observation only. */ }
  },
  requestMatch: (request: Request | undefined) => {
    try {
    const scope = execution.getStore()
    if (!scope?.open || !scope.enabled) return
    sfCreateReportsDiagnostic.metric(request && scope.request === request && requests.get(request) === scope.id ? "request.same" : "request.mismatch")
    } catch { /* Observation only. */ }
  },
  start: (): number | undefined => {
    try {
    const scope = execution.getStore()
    if (!scope?.open || !scope.enabled) return
    const started = performance.now()
    scope.clocks++
    return started
    } catch { return }
  },
  metric: (stage: string, started?: number, units = 0) => {
    try {
    const scope = execution.getStore(), code = stages.indexOf(stage) + 1
    if (!scope?.open || !scope.enabled || !code || code >= 19) return
    const now = performance.now()
    scope.clocks++
    try {
      const prior: Metric = scope.metrics.get(code) ?? [0, 0, 0]
      scope.metrics.set(code, [prior[0] + 1, prior[1] + (started === undefined ? 0 : now - started), Math.max(prior[2], units)])
    } finally {
      const ended = performance.now()
      scope.clocks++
      scope.bookkeeping[0]++
      scope.bookkeeping[1] += ended - now
    }
    // Progress uses only existing completions, never a timer or a new read.
    if (now - scope.emitted >= 2000) emit(scope, 3)
    } catch { /* Metrics cannot replace a domain result or exception. */ }
  },
  queue: (promise: object) => {
    try {
      const scope = execution.getStore()
      if (scope?.open) queued.set(promise, scope.owner)
    } catch { /* Observation only. */ }
  },
  blockedBy: (promise?: object) => {
    try { return promise ? queued.get(promise) ?? 0 : 0 } catch { return 0 }
  },
}

installSfCreateCanonicalObserver({ start: sfCreateReportsDiagnostic.start,
  finish: (started) => sfCreateReportsDiagnostic.metric("canonical.value-inclusive", started) })

// The existing installer reassembles stdout with Stream.splitLines. Forward only
// the bounded, allowlisted numeric protocol, never raw chunks or arbitrary JSON.
export function sfCreateReportsDiagnosticLine(line: string): string | undefined {
  if (line.length > 16_384 || !line.startsWith(prefix)) return
  try {
    const value: unknown = JSON.parse(line.slice(prefix.length))
    if (!value || typeof value !== "object" || Array.isArray(value)) return
    const item = value as Record<string, unknown>
    const keys = ["v", "event", "id", "owner", "mode", "method", "phase", "elapsedMs", "active", "metrics"]
    if (Object.keys(item).length !== keys.length || Object.keys(item).some((key) => !keys.includes(key))) return
    const integer = (value: unknown, min: number, max: number): value is number =>
      typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max
    const measured = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1e12
    if (item.v !== 1 || !integer(item.event, 1, 6) || !integer(item.id, 1, 1e9) || !integer(item.owner, 1, 2) ||
      !integer(item.mode, 1, modes.length) || !integer(item.method, 0, 3) || !integer(item.phase, 0, phases.length) || !measured(item.elapsedMs)) return
    if (!Array.isArray(item.active) || item.active.length !== 2 || !item.active.every((count) => integer(count, 0, 10000))) return
    if (!Array.isArray(item.metrics) || item.metrics.length > stages.length) return
    const seen = new Set<number>()
    for (const metric of item.metrics) {
      if (!Array.isArray(metric) || metric.length !== 4 || !integer(metric[0], 1, stages.length) ||
        !integer(metric[1], 0, 1e9) || !measured(metric[2]) || !measured(metric[3]) || seen.has(metric[0])) return
      seen.add(metric[0])
    }
    return prefix + JSON.stringify(item)
  } catch { return }
}
