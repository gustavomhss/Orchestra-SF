// Snapshot-only count diagnostic for the original Preview. Never promote.
const source = "97c921ab0054bd5154227593adcbcca56b0538c3"
const sourceTree = "3f04bc2f32be61ea4596b2d8c008c3f944e5841b"
const prefix = "SF_PORTFOLIO_VALUE_TYPES "
const windowMs = 45_000, pulseEvery = 16_384
const maximumStringUnits = 512, maximumEntries = 1024
const maximumLines = 4, maximumLineBytes = 1024, maximumCount = 9_007_199_254_740_991
// This module is also reachable from browser canonical imports. It has no
// backend imports, Bun dependency, sampler, environment lookup or input probe.
const native = (() => {
  try {
    return {
      Map, apply: Reflect.apply, has: Map.prototype.has, set: Map.prototype.set, clear: Map.prototype.clear,
      clock: performance.now.bind(performance), write: console.info.bind(console),
      schedule: setTimeout, cancel: clearTimeout, round: Math.round,
    }
  } catch { return undefined }
})()

type Reason = "window-timer" | "window-pulse" | "original-evaluate-settled" | "observer-error" | "setup-error" | "counter-limit"
type Observation = {
  started: number
  timer?: ReturnType<typeof setTimeout>
  memo: Map<string, true>
  total: number
  kinds: { undefined: number; object: number; boolean: number; number: number; bigint: number; string: number; symbol: number; function: number }
  nulls: number
  eligible: number
  hits: number
  misses: number
  clears: number
  entries: number
  peakEntries: number
  retainedStringUnits: number
  peakStringUnits: number
  pulseClockReads: number
}
let claimed = false, active: Observation | undefined
let lines = 0, dropped = 0, outputErrors = 0, observerErrors = 0

// All fragments below are fixed ASCII literals, bounded counters or elapsed
// numbers. No JSON serializer, input value, string key or error text is emitted.
function emit(phase: string, fields: string) {
  try {
    if (!native || lines >= maximumLines) return
    const line = prefix + '{"schema":"sf-portfolio-value-types-v1","qualification":false,"source":"' + source +
      '","sourceTree":"' + sourceTree + '","phase":"' + phase + '",' + fields + '}'
    if (line.length + 1 > maximumLineBytes) { dropped++; return }
    lines++
    native.write(line)
  } catch { outputErrors++ }
}
function elapsed(observation: Observation): number | null {
  try {
    if (!native) return null
    const duration = native.clock() - observation.started
    return duration >= 0 && duration <= maximumCount ? native.round(duration) : null
  } catch { observerErrors++; return null }
}
function stop(observation: Observation, reason: Reason) {
  try {
    if (active !== observation) return
    active = undefined
    try { if (native && observation.timer !== undefined) native.cancel(observation.timer) } catch { observerErrors++ }
    try { if (native) native.apply(native.clear, observation.memo, []) } catch { observerErrors++ }
    const at = elapsed(observation), kinds = observation.kinds
    emit("counts", '"reason":"' + reason + '","elapsedMs":' + at + ',"total":' + observation.total +
      ',"typeof":{"undefined":' + kinds.undefined + ',"object":' + kinds.object + ',"boolean":' + kinds.boolean +
      ',"number":' + kinds.number + ',"bigint":' + kinds.bigint + ',"string":' + kinds.string +
      ',"symbol":' + kinds.symbol + ',"function":' + kinds.function + '},"nulls":' + observation.nulls)
    emit("memo", '"eligibleStrings":' + observation.eligible + ',"hits":' + observation.hits +
      ',"misses":' + observation.misses + ',"clears":' + observation.clears + ',"entriesAtStop":' + observation.entries +
      ',"peakEntries":' + observation.peakEntries + ',"stringUnitsAtStop":' + observation.retainedStringUnits +
      ',"peakStringUnits":' + observation.peakStringUnits + ',"hashesSkipped":0')
    emit("complete", '"elapsedMs":' + at + ',"pulseClockReads":' + observation.pulseClockReads +
      ',"observerErrors":' + observerErrors + ',"dropped":' + dropped + ',"outputErrorsBeforeComplete":' + outputErrors +
      ',"lineAttemptsBeforeComplete":' + lines + ',"complete":true')
  } catch {
    active = undefined
    observerErrors++
  }
}

/** First original evaluate only; observer failures never replace its result. */
export function beginPortfolioValueTypesDiagnostic() {
  if (claimed) return undefined
  claimed = true
  try {
    if (!native) return undefined
    const observation: Observation = {
      started: native.clock(), memo: new native.Map<string, true>(), total: 0,
      kinds: { undefined: 0, object: 0, boolean: 0, number: 0, bigint: 0, string: 0, symbol: 0, function: 0 },
      nulls: 0, eligible: 0, hits: 0, misses: 0, clears: 0, entries: 0, peakEntries: 0,
      retainedStringUnits: 0, peakStringUnits: 0, pulseClockReads: 0,
    }
    active = observation
    emit("start", '"scope":"whole-isolate-canonical-entry","counts":"entries-not-completions","objectsIncludeNull":true' +
      ',"windowMs":45000,"pulseEvery":16384,"maximumStringUnits":512,"maximumEntries":1024' +
      ',"memoPolicy":"clear-on-full-miss","memoStores":"string-membership-only","originalWork":"unchanged"' +
      ',"maximumLines":4,"maximumLineBytes":1024')
    observation.timer = native.schedule(() => { stop(observation, "window-timer") }, windowMs)
    return { finish() { stop(observation, "original-evaluate-settled") } }
  } catch {
    observerErrors++
    if (active) stop(active, "setup-error")
    else emit("complete", '"reason":"setup-error","observerErrors":' + observerErrors + ',"complete":false')
    return undefined
  }
}

/** Inactive calls do not inspect values, update counters, allocate or read time. */
export function observePortfolioValueType(value: unknown) {
  const observation = active
  if (!observation || !native) return
  try {
    if (observation.total >= maximumCount) { stop(observation, "counter-limit"); return }
    observation.total++
    observation.kinds[typeof value]++
    if (value === null) observation.nulls++
    if (typeof value === "string" && value.length <= maximumStringUnits) {
      observation.eligible++
      if (native.apply(native.has, observation.memo, [value])) observation.hits++
      else {
        observation.misses++
        if (observation.entries >= maximumEntries) {
          native.apply(native.clear, observation.memo, [])
          observation.entries = 0
          observation.retainedStringUnits = 0
          observation.clears++
        }
        native.apply(native.set, observation.memo, [value, true])
        observation.entries++
        observation.retainedStringUnits += value.length
        if (observation.entries > observation.peakEntries) observation.peakEntries = observation.entries
        if (observation.retainedStringUnits > observation.peakStringUnits) observation.peakStringUnits = observation.retainedStringUnits
      }
    }
    if (observation.total % pulseEvery === 0) {
      observation.pulseClockReads++
      const at = elapsed(observation)
      if (at !== null && at >= windowMs) stop(observation, "window-pulse")
    }
  } catch {
    observerErrors++
    stop(observation, "observer-error")
  }
}
