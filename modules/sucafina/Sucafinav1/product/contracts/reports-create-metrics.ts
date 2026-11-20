// CI-only gateway: no Node imports, globals, domain values or authority decisions.
type Observer = { start: () => number | undefined; finish: (started: number) => void }
const observation: { current?: Observer } = {}

export function installSfCreateCanonicalObserver(observer: Observer) {
  observation.current = observer
}

export function startSfCreateCanonicalObservation(): number | undefined {
  try { return observation.current?.start() } catch { return }
}

export function finishSfCreateCanonicalObservation(started: number | undefined) {
  if (started === undefined) return
  try { observation.current?.finish(started) } catch { /* Diagnostics cannot replace a result or exception. */ }
}
