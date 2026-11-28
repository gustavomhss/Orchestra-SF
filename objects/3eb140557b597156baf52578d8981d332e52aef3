/** Cooperative host-boundary deadline; it does not replace Bun's outer test budget. */
export function compositionTestDeadline(name: string, budgetMs = 105_000) {
  const started = performance.now()
  const cancellation = new AbortController()
  const deadlineError = new Error(`${name} exceeded its ${budgetMs}ms cooperative deadline`)
  const timer = setTimeout(() => cancellation.abort(deadlineError), budgetMs)
  const cleanups: (() => void | Promise<void>)[] = []
  const closing: { pending?: Promise<void> } = {}
  const check = () => {
    // Heavy synchronous work can delay the timer. Actual authority environment
    // reads also check elapsed time, so a blocked phase is identified in CI.
    if (performance.now() - started >= budgetMs && !cancellation.signal.aborted) cancellation.abort(deadlineError)
    cancellation.signal.throwIfAborted()
  }
  const phase = async <T>(label: string, work: () => Promise<T>): Promise<T> => {
    check()
    const at = performance.now()
    console.info("SF_COMPOSITION_PHASE", JSON.stringify({ fixture: name, phase: label, state: "started", elapsedMs: Math.round(at - started) }))
    try {
      const value = await work()
      check()
      return value
    } finally {
      console.info("SF_COMPOSITION_PHASE", JSON.stringify({ fixture: name, phase: label, state: "returned",
        phaseMs: Math.round(performance.now() - at), elapsedMs: Math.round(performance.now() - started), aborted: cancellation.signal.aborted }))
    }
  }
  const close = () => closing.pending ??= (async () => {
    clearTimeout(timer)
    cancellation.abort(new Error(`${name} closed`))
    const failures: unknown[] = []
    for (const cleanup of cleanups.toReversed()) {
      try { await cleanup() } catch (error) { failures.push(error) }
    }
    // A product port may translate a boundary exception to denied. Expiration
    // must still fail the test after every owned resource has been released.
    if (cancellation.signal.reason === deadlineError || performance.now() - started >= budgetMs) failures.unshift(deadlineError)
    if (failures.length) throw new AggregateError(failures, `${name} deadline or cleanup failed`)
  })()
  return { signal: cancellation.signal, check, phase, own: (cleanup: () => void | Promise<void>) => { cleanups.push(cleanup) }, close }
}
