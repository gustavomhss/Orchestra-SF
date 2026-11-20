type Waiter<Value> = (value: Value | undefined) => void

export type SfSettingsReadQueue<Value> = Readonly<{
  refresh(): void
  beginCommand(): void
  afterCommand(): Promise<Value | undefined>
  finishCommand(): void
  setEnabled(enabled: boolean): void
  dispose(): void
}>

/** One CAP28 read at a time within one F01 generation and page selection.
 * Refreshes coalesce. A command fences older reads; only a read started after
 * its reply may confirm it. Hiding the page suspends reads, never the POST. */
export function createSfSettingsReadQueue<Value>(options: Readonly<{
  read(signal: AbortSignal): Promise<Value>
  publish(value: Value): void
  failed(error: unknown): void
  current(): boolean
}>): SfSettingsReadQueue<Value> {
  let disposed = false
  let enabled = false
  let command = false
  let epoch = 0
  let pending = false
  const waiting: Waiter<Value>[] = []
  let flight: {
    abort: AbortController
    epoch: number
    waiting: Waiter<Value>[]
  } | undefined
  const settle = (items: Waiter<Value>[], value: Value | undefined) => {
    for (const resolve of items.splice(0)) resolve(value)
  }
  const dispose = () => {
    if (disposed) return
    disposed = true
    pending = false
    settle(waiting, undefined)
    if (flight) {
      settle(flight.waiting, undefined)
      flight.abort.abort()
    }
  }
  const drain = () => {
    if (disposed || !enabled || command || flight || !pending) return
    if (!options.current()) { dispose(); return }
    pending = false
    const next = { abort: new AbortController(), epoch, waiting: waiting.splice(0) }
    flight = next
    void (async () => {
      try {
        const value = await options.read(next.abort.signal)
        if (disposed || next.abort.signal.aborted || next.epoch !== epoch || !options.current()) {
          settle(next.waiting, undefined)
          return
        }
        // Confirmation owns publication: the F01 draft must be confirmed before
        // receiveRemote can inspect the newly committed source version.
        if (next.waiting.length === 0) options.publish(value)
        settle(next.waiting, value)
      } catch (error) {
        if (!disposed && !next.abort.signal.aborted && next.epoch === epoch && options.current())
          options.failed(error)
        settle(next.waiting, undefined)
      } finally {
        if (flight === next) flight = undefined
        drain()
      }
    })()
  }
  return {
    refresh() {
      if (disposed || !enabled) return
      pending = true
      drain()
    },
    beginCommand() {
      if (disposed) return
      command = true
      epoch++
    },
    afterCommand() {
      if (disposed || !options.current()) return Promise.resolve(undefined)
      command = false
      return new Promise<Value | undefined>((resolve) => {
        waiting.push(resolve)
        pending = true
        drain()
      })
    },
    finishCommand() {
      command = false
      // A failed/unknown action remains visible until an explicit retry. Do not
      // let a refresh queued before it replace that outcome automatically.
      pending = false
      settle(waiting, undefined)
    },
    setEnabled(value) {
      if (disposed || enabled === value) return
      enabled = value
      if (!enabled) {
        epoch++
        if (flight) {
          // A known committed command still needs its own fresh read when the
          // page becomes visible again; an aborted read cannot confirm it.
          waiting.push(...flight.waiting.splice(0))
          if (waiting.length > 0) pending = true
          flight.abort.abort()
        }
        return
      }
      drain()
    },
    dispose,
  }
}
