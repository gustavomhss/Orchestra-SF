import { AsyncLocalStorage } from "node:async_hooks"
import type { createThreadActorsFixture } from "../../ui-split/ui-work/actors-fixture.ts"

type Metric = { calls: number; inclusiveMs: number; maxMs: number }
type Event = { atMs: number; name: string; detail?: unknown }
type Span = { name: string; phase: string; started: number }

/** Observation only: delegates every argument, callback, result and error.
 * Times are inclusive. Nested spans must not be added as independent costs.
 * Keep source-persistence method identities stable: W6 fences capture them.
 */
export function instrumentWorkReuse(app: Awaited<ReturnType<typeof createThreadActorsFixture>>) {
  const started = performance.now()
  const scope = new AsyncLocalStorage<string>()
  const metrics = new Map<string, Metric>()
  const events: Event[] = []
  const active = new Set<Span>()
  const rounded = (value: number) => Math.round(value * 100) / 100
  const mark = (name: string, detail?: unknown) => events.push({ atMs: rounded(performance.now() - started), name, ...(detail === undefined ? {} : { detail }) })
  const begin = (name: string) => {
    const span = { name, phase: scope.getStore() ?? "outside-http", started: performance.now() }
    active.add(span)
    return span
  }
  const record = (span: Span) => {
    active.delete(span)
    const key = span.phase + "/" + span.name
    const value = metrics.get(key) ?? { calls: 0, inclusiveMs: 0, maxMs: 0 }
    const elapsed = performance.now() - span.started
    value.calls++; value.inclusiveMs += elapsed; value.maxMs = Math.max(value.maxMs, elapsed)
    metrics.set(key, value)
  }
  const measure = async <T>(name: string, work: () => Promise<T>): Promise<T> => {
    const span = begin(name)
    try { return await work() } finally { record(span) }
  }
  const sync = <T>(name: string, work: () => T): T => {
    const span = begin(name)
    try { return work() } finally { record(span) }
  }
  const wrap = <T extends object, K extends keyof T>(target: T, key: K, name: string) => {
    const original = target[key]
    if (typeof original !== "function") throw new Error("Missing diagnostic boundary: " + name)
    Object.assign(target, { [key]: function (this: unknown, ...args: unknown[]) {
      const span = begin(name)
      try {
        const result: unknown = Reflect.apply(original, this, args)
        if (result instanceof Promise) return result.finally(() => record(span))
        record(span)
        return result
      } catch (error) { record(span); throw error }
    } })
  }
  // The raw SQLite store is below the stable SourcePersistence closures. No
  // state.transaction work callback is replaced (authority uses its identity).
  const transaction = app.store.transaction
  app.store.transaction = (surface, work, options) => measure("sqlite.transaction:" + surface,
    () => transaction(surface, (snapshot, blobs) => measure("sqlite.callback:" + surface, () => work(snapshot, blobs)), options))
  const all = app.store.transactionAll
  if (all) app.store.transactionAll = (work, options) => measure("sqlite.transactionAll",
    () => all((snapshots) => measure("sqlite.callbackAll", () => work(snapshots)), options))
  const snapshots = app.store.currentSnapshots
  if (snapshots) app.store.currentSnapshots = () => sync("sqlite.currentSnapshots", snapshots)
  wrap(app.state, "read", "state.read")
  wrap(app.host, "revalidate", "host.revalidate")
  wrap(app.port.threadReads, "read", "threadReads.read")
  wrap(app.records, "resolve", "records.resolve")
  wrap(app.records, "read", "records.read")
  wrap(app.persistence, "readScopedSource", "sources.readScopedSource")
  wrap(app.persistence, "resolveScopedSource", "sources.resolveScopedSource")
  wrap(app.observer, "observe", "observer.observe")
  wrap(app.observer, "verifyManifest", "observer.verifyManifest")
  wrap(app.observer, "fenceManifest", "observer.fenceManifest")
  wrap(app.observer, "fence", "observer.fence")
  if (app.port.answerReuse) {
    wrap(app.port.answerReuse, "prepare", "answerReuse.prepare")
    wrap(app.port.answerReuse, "confirm", "answerReuse.confirm")
    wrap(app.port.answerReuse, "read", "answerReuse.read")
  }
  return {
    mark, measure,
    phase: <T>(name: string, work: () => Promise<T>) => scope.run(name, work),
    report: () => ({ schema: "sf2h.work-reuse.timings.v1", elapsedMs: rounded(performance.now() - started),
      note: "Inclusive nested spans; not a sum of independent costs. Instrumentation can add overhead.",
      events, pending: [...active].map((span) => ({ name: span.name, phase: span.phase, elapsedMs: rounded(performance.now() - span.started) })), metrics: Object.fromEntries([...metrics].map(([key, value]) => [key, { calls: value.calls, inclusiveMs: rounded(value.inclusiveMs), maxMs: rounded(value.maxMs) }])) }),
  }
}
