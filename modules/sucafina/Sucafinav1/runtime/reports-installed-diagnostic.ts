import { AsyncLocalStorage } from "node:async_hooks"

// CI-only instrumentation. No blob in this diagnostic tree is an integration candidate.
// Numeric wire schema: owner 1=request, 2=local maintenance, 3=auth maintenance;
// event 1=begin, 2=phase, 3=progress, 4=abort, 5=resolved, 6=rejected.
type Owner = 1 | 2 | 3
type Metric = [number, number, number]
type Scope = { id: number; owner: Owner; request?: Request; mode: number; method: number;
  started: number; emitted: number; open: boolean; metrics: Map<number, Metric> }
const execution = new AsyncLocalStorage<Scope>()
const active = new Set<Scope>()
const queued = new WeakMap<object, Owner>()
const sequence = { value: 0 }
const stages: readonly string[] = [
  "storage.memo-hit-dashboard",
  "storage.memo-hit-planner",
  "storage.memo-hit-procurement",
  "storage.memo-miss-dashboard",
  "storage.memo-miss-planner",
  "storage.memo-miss-procurement",
  "storage.plan-inclusive",
  "storage.plan-accepted",
  "storage.plan-rejected",
  "storage.current-snapshot-via-plan",
  "storage.current-snapshot-via-clone",
  "storage.queue-wait-inclusive",
  "storage.queue-empty",
  "storage.write-lock-inclusive",
  "storage.read-without-lock",
  "storage.decode-snapshot",
  "storage.clone-snapshot",
  "storage.encode-snapshot",
  "storage.plan-payload-budget",
  "storage.plan-unit-budget",
  "storage.plan-node-or-depth-budget",
  "storage.plan-missing-budget",
  "storage.materialize-plan",
  "storage.queue-predecessor-request",
  "storage.queue-predecessor-local-maintenance",
  "storage.queue-predecessor-auth-maintenance",
  "storage.queue-predecessor-unattributed",
  "source.full-snapshot-before-digest",
  "source.first-authorize-inclusive",
  "source.projection-snapshot-clone",
  "source.project-scope-inclusive",
  "source.second-authorize-inclusive",
  "source.full-snapshot-after-digest",
  "source.observe-inclusive",
  "source.prepare-snapshot-clone",
  "review.current-snapshots-copy",
  "review.current-snapshots-empty",
  "review.review-and-receipt-digests",
  "review.live-full-snapshot-digest",
  "review.captured-full-snapshot-digest",
  "review.access-digest",
  "review.full-snapshot-fence-digest",
  "review.scope-state-read-inclusive",
  "review.canonical-producer-read",
  "review.legacy-state-read-inclusive",
  "review.producer-result-clone",
  "auth.session-inclusive",
  "auth.request-mismatch"
]
const phases: readonly string[] = [
  "route",
  "entry-person-enter",
  "entry-person-done",
  "entry-native-enter",
  "entry-native-done",
  "entry-business-enter",
  "entry-business-done",
  "HTTP_READ_ENTER",
  "HTTP_READ_ADMIT_DONE",
  "HTTP_READ_VALIDATE_DONE",
  "HTTP_READ_PORT_DONE",
  "HTTP_READ_POST_AUTH_ENTER",
  "HTTP_READ_POST_AUTH_DONE",
  "HTTP_READ_JSON_ENTER",
  "HTTP_READ_JSON_DONE"
]
const modes: readonly string[] = ["review-read", "review-agenda", "review-preserve", "review", "workbench",
  "review-current-thread", "review-thread-context", "collaboration-storage-version", "collaboration-thread-read",
  "collaboration-answer-read"]
const prefix = "SF_REPORTS_INSTALLED_DIAGNOSTIC "

function emit(scope: Scope, event: number, phase = 0) {
  // Instrumentation failure cannot replace a product result or an exception.
  try {
    const now = performance.now()
    scope.emitted = now
    const counts = [0, 0, 0]
    for (const held of active) counts[held.owner - 1] = (counts[held.owner - 1] ?? 0) + 1
    console.info(prefix + JSON.stringify({ v: 1, event, id: scope.id, owner: scope.owner,
      mode: scope.mode, method: scope.method, phase, elapsedMs: now - scope.started, active: counts,
      metrics: [...scope.metrics].map(([code, value]) => [code, ...value]) }))
  } catch { /* Diagnostic output is best effort; product control flow is untouched. */ }
}

function run<Value>(owner: Owner, work: () => Promise<Value>, request?: Request): Promise<Value> {
  const started = performance.now()
  const scope: Scope = { id: ++sequence.value, owner, request, mode: 0, method: 0,
    started, emitted: started, open: true, metrics: new Map() }
  active.add(scope)
  const abort = () => emit(scope, 4)
  const finish = (event: number) => {
    if (!scope.open) return
    scope.open = false
    emit(scope, event)
    active.delete(scope)
    request?.signal.removeEventListener("abort", abort)
    scope.request = undefined
  }
  return execution.run(scope, () => {
    request?.signal.addEventListener("abort", abort, { once: true })
    emit(scope, 1)
    try {
      const pending = work()
      // Observe the original promise; return that same promise, with no added await.
      void pending.then(() => finish(5), () => finish(6))
      return pending
    } catch (error) { finish(6); throw error }
  })
}

export const sfInstalledReportsDiagnostic = {
  request: <Value>(request: Request, work: () => Promise<Value>) => run(1, work, request),
  maintenance: <Value>(owner: "local" | "auth", work: () => Promise<Value>) => run(owner === "local" ? 2 : 3, work),
  route: (mode: string | null, method: string) => {
    const scope = execution.getStore()
    if (!scope?.open) return
    scope.mode = modes.indexOf(mode ?? "") + 1
    scope.method = ["GET", "POST", "HEAD"].indexOf(method) + 1
    emit(scope, 2, 1)
  },
  phase: (stage: string) => {
    const scope = execution.getStore(), code = phases.indexOf(stage) + 1
    if (scope?.open && code) emit(scope, 2, code)
  },
  metric: (stage: string, started?: number, units = 0) => {
    const scope = execution.getStore(), code = stages.indexOf(stage) + 1
    if (!scope?.open || !code) return
    const now = performance.now()
    const prior: Metric = scope.metrics.get(code) ?? [0, 0, 0]
    scope.metrics.set(code, [prior[0] + 1, prior[1] + (started === undefined ? 0 : now - started), Math.max(prior[2], units)])
    // Emit during existing completions, not a timer, sleep, probe or extra observation.
    if (now - scope.emitted >= 2000) emit(scope, 3)
  },
  session: (request: Request, started: number) => {
    const scope = execution.getStore()
    sfInstalledReportsDiagnostic.metric(scope?.request === request ? "auth.session-inclusive" : "auth.request-mismatch", started)
  },
  queue: (promise: object) => {
    const scope = execution.getStore()
    if (scope) queued.set(promise, scope.owner)
  },
  blockedBy: (promise?: object) => promise ? queued.get(promise) ?? 0 : 0,
}

// Stream.splitLines in the existing installer already reassembles stdout chunks.
// Consume only bounded complete lines; never forward raw chunks or arbitrary JSON.
export function sfInstalledReportsDiagnosticLine(line: string): string | undefined {
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
    if (item.v !== 1 || !integer(item.event, 1, 6) || !integer(item.id, 1, 1e9) || !integer(item.owner, 1, 3) ||
      !integer(item.mode, 0, modes.length) || !integer(item.method, 0, 3) || !integer(item.phase, 0, phases.length) || !measured(item.elapsedMs)) return
    if (!Array.isArray(item.active) || item.active.length !== 3 || !item.active.every((count) => integer(count, 0, 10000))) return
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
