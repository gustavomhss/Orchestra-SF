/**
 * DIAGNOSTIC BRANCH ONLY. This module is not part of the product candidate.
 * Each original Request owns bounded numeric timing data. Nothing here grants,
 * caches, replaces or serializes an admission, principal, resource or policy.
 */
type Stage = "policy-total" | "resolve-total" | "team-resolution" | "role-maps" |
  "team-revalidate" | "grants-before" | "grants-after" | "identity-prepare" | "session-dispatch"
type Measurement = { calls: number; pending: number; totalMs: number; maxMs: number }
type Record = { request: number; route: string; started: number; overheadMs: number; stages: Map<Stage, Measurement> }
const requests = new WeakMap<Request, Record>()
let ordinal = 0
const round = (value: number) => Math.round(value * 1000) / 1000

function record(request: Request) {
  const known = requests.get(request)
  if (known) return known
  const path = new URL(request.url).pathname
  const route = request.method === "GET" && /\/api\/session$/.test(path) ? "session-list" :
    request.method === "POST" && /\/api\/session$/.test(path) ? "session-create" :
    request.method === "POST" && /\/api\/session\/[^/]+\/prompt$/.test(path) ? "session-prompt" :
    request.method === "GET" && /\/api\/session\/[^/]+\/message$/.test(path) ? "session-messages" :
    request.method === "GET" && /\/api\/session\/[^/]+$/.test(path) ? "session-get" :
    request.method === "GET" && /\/api\/event$/.test(path) ? "event-stream" : undefined
  if (!route) return
  const value: Record = { request: ++ordinal, route, started: performance.now(), overheadMs: 0, stages: new Map() }
  requests.set(request, value)
  return value
}

export async function measureTeamAuthority<Value>(request: Request, stage: Stage, run: () => Promise<Value>): Promise<Value> {
  const observerStart = performance.now(), value = record(request)
  if (!value) return run()
  const item = value.stages.get(stage) ?? { calls: 0, pending: 0, totalMs: 0, maxMs: 0 }
  value.stages.set(stage, item); item.calls++; item.pending++
  const started = performance.now()
  value.overheadMs += started - observerStart
  try { return await run() }
  finally {
    const finished = performance.now(), elapsed = finished - started
    item.pending--; item.totalMs += elapsed; item.maxMs = Math.max(item.maxMs, elapsed)
    value.overheadMs += performance.now() - finished
  }
}

export function readTeamAuthorityObservation(request: Request) {
  const value = requests.get(request)
  if (!value) return
  return {
    request: value.request, route: value.route, elapsedMs: round(performance.now() - value.started),
    observerOverheadMs: round(value.overheadMs),
    // Nested stages overlap. Their totals are not additive wall-clock time.
    stages: [...value.stages].map(([stage, item]) => ({
      stage, calls: item.calls, pending: item.pending, totalMs: round(item.totalMs), maxMs: round(item.maxMs),
    })),
  }
}
