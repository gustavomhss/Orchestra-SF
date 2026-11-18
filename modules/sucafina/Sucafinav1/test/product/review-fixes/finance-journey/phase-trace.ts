/** Test-owned observation only: no cache, extra domain reads, authority changes or deadlines. */
export function createFinanceJourneyTrace() {
  const started = Date.now()
  const sequence = { value: 0 }
  const active = new Map<number, { label: string; started: number }>()
  const counts = new Map<string, { calls: number; completed: number; failed: number; inclusiveMs: number }>()
  const emit = (event: Record<string, unknown>) => console.info("[finance-journey-phase]", JSON.stringify({ elapsedMs: Date.now() - started, ...event }))
  const measure = async <T>(label: string, work: () => Promise<T>): Promise<T> => {
    const id = ++sequence.value
    const at = Date.now()
    const count = counts.get(label) ?? { calls: 0, completed: 0, failed: 0, inclusiveMs: 0 }
    count.calls += 1
    counts.set(label, count)
    emit({ event: "start", id, label, active: [...active.keys()] })
    active.set(id, { label, started: at })
    try {
      const value = await work()
      count.completed += 1
      emit({ event: "complete", id, label, durationMs: Date.now() - at, status: value && typeof value === "object" && "status" in value ? value.status : typeof value === "boolean" ? value : undefined })
      return value
    } catch (error) {
      count.failed += 1
      emit({ event: "error", id, label, durationMs: Date.now() - at, error: error instanceof Error ? error.message : String(error) })
      throw error
    } finally {
      count.inclusiveMs += Date.now() - at
      active.delete(id)
    }
  }
  return {
    measure,
    wrap: <A extends unknown[], R>(label: string, operation: (...args: A) => Promise<R>) => (...args: A) => measure(label, () => operation(...args)),
    mark: (label: string, detail: Record<string, unknown> = {}) => emit({ event: "checkpoint", label, ...detail }),
    summary: () => emit({ event: "summary", counts: Object.fromEntries(counts), active: [...active].map(([id, span]) => ({ id, label: span.label, durationMs: Date.now() - span.started })) }),
  }
}
