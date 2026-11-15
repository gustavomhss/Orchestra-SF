type Timing = { calls: number; completed: number; elapsedMs: number; maximumMs: number }

/** Timings wrap existing calls only. Async times are inclusive and may overlap. */
export function createPortfolioPerformanceTrace() {
  const started = performance.now()
  const counts: Record<string, Timing> = {}
  const active = new Map<number, string>()
  let sequence = 0
  const begin = (name: string) => {
    const count = counts[name] ??= { calls: 0, completed: 0, elapsedMs: 0, maximumMs: 0 }
    count.calls++
    return { count, at: performance.now() }
  }
  const complete = (entry: ReturnType<typeof begin>) => {
    const elapsed = performance.now() - entry.at
    entry.count.completed++
    entry.count.elapsedMs += elapsed
    entry.count.maximumMs = Math.max(entry.count.maximumMs, elapsed)
  }
  const snapshot = () => ({ elapsedMs: Math.round(performance.now() - started), active: [...active.values()],
    counts: Object.fromEntries(Object.entries(counts).map(([name, value]) => [name, { ...value, elapsedMs: Math.round(value.elapsedMs), maximumMs: Math.round(value.maximumMs) }])) })
  const event = (name: string, phase: string) => console.info("[wp13-performance-boundary]", JSON.stringify({ name, phase, ...snapshot() }))
  return {
    snapshot,
    sync<T>(name: string, work: () => T): T {
      const entry = begin(name)
      try { return work() } finally { complete(entry) }
    },
    async measure<T>(name: string, work: () => Promise<T>, boundary = false): Promise<T> {
      const entry = begin(name)
      const id = ++sequence
      if (boundary) { active.set(id, name); event(name, "start") }
      try { return await work() } finally {
        complete(entry)
        if (boundary) { active.delete(id); event(name, "complete") }
      }
    },
  }
}
