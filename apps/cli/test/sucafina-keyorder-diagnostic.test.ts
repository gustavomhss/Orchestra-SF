import { expect, test } from "bun:test"
import { plannerProjectionReference, plannerProjectionRows } from "./fixture/sucafina-planner-projection-loading.ts"
import { sfCanonicalKeyOrderDiagnostic, sfCanonicalKeyOrderDiagnosticState, resetSfCanonicalKeyOrderDiagnostic } from "./fixture/sucafina-keyorder-diagnostic.ts"

const property = Object.getOwnPropertyDescriptor, define = Object.defineProperty
const remove = Reflect.deleteProperty, apply = Reflect.apply
const originalKeys = Object.keys, originalSort = Array.prototype.sort

function original(record: Record<string, unknown>) { return Object.keys(record).sort() }
function withProperty<Value>(owner: object, key: PropertyKey, replacement: PropertyDescriptor, work: () => Value): Value {
  const saved = property(owner, key)
  define(owner, key, replacement)
  try { return work() } finally {
    if (saved) define(owner, key, saved)
    else remove(owner, key)
  }
}
function thrown(work: () => unknown): unknown { try { work(); return undefined } catch (error) { return error } }

function fixtures(): { name: string; value: unknown; iterations: number }[] {
  const ref = plannerProjectionReference()
  const shared = { amount: -0, absent: undefined, nested: [null, true, 'quote"\n'] }
  const keys: Record<string, unknown> = Object.create(null)
  define(keys, "__proto__", { enumerable: true, value: { count: -0 } })
  keys[""] = undefined
  keys["\ud800"] = "\udc00"
  keys["\uffff"] = "emoji:\ud83d\ude00"
  keys["\ud83d\ude00"] = "control:\u0000\b\f\n\r\t\"\\"
  const rows = plannerProjectionRows(ref, 32)
  return [
    { name: "tagged-values", iterations: 1000, value: [keys, null, undefined, -0, 0, false, true,
      Number.MIN_VALUE, Number.MAX_VALUE, 1e21, 1e-7, "e\u0301", "\u00e9", "\u2028\u2029"] },
    { name: "evidence-reference", iterations: 1000, value: ref },
    { name: "captured-context", iterations: 500, value: { left: shared, right: shared,
      values: Array.from({ length: 32 }, (_, index) => ({ total: index, optional: undefined, active: true })) } },
    { name: "aliased-projection", iterations: 250, value: rows },
    { name: "distinct-projection", iterations: 250, value: rows.map((row) => structuredClone(row)) },
  ]
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}
function records(value: unknown) {
  const result: Record<string, unknown>[] = []
  const visit = (input: unknown) => {
    if (Array.isArray(input)) { input.forEach(visit); return }
    if (!record(input)) return
    result.push(input)
    Object.keys(input).forEach((key) => visit(input[key]))
  }
  visit(value)
  return result
}

test("key-order candidates preserve native order and observe every current key set", () => {
  for (const fixture of fixtures()) {
    for (const value of records(fixture.value)) {
      expect(sfCanonicalKeyOrderDiagnostic(value, false)).toEqual(original(value))
      expect(sfCanonicalKeyOrderDiagnostic(value, true)).toEqual(original(value))
    }
  }
  const value: Record<string, unknown> = { z: 1, a: undefined, b: -0 }
  const first = sfCanonicalKeyOrderDiagnostic(value, true)
  first[0] = "external mutation"
  expect(sfCanonicalKeyOrderDiagnostic(value, true)).toEqual(["a", "b", "z"])
  delete value.a
  value.c = 2
  expect(sfCanonicalKeyOrderDiagnostic(value, true)).toEqual(original(value))
  delete value.c
  value.a = 3
  expect(sfCanonicalKeyOrderDiagnostic(value, true)).toEqual(original(value))
  for (const wide of [Object.fromEntries(Array.from({ length: 65 }, (_, index) => [String(65 - index), index])),
    { ["x".repeat(40000)]: 1, z: 2 }]) {
    expect(sfCanonicalKeyOrderDiagnostic(wide, true)).toEqual(original(wide))
  }
  expect(sfCanonicalKeyOrderDiagnosticState().retainedUnits).toBeLessThanOrEqual(65536)
})

test("key-order candidates retain key traps and original method getters, receivers and errors", () => {
  for (const memo of [false, true]) {
    const trace: string[] = []
    const value = new Proxy({ z: 2, a: 1 }, {
      ownKeys(target) { trace.push("keys"); return Reflect.ownKeys(target) },
      getOwnPropertyDescriptor(target, key) { trace.push("descriptor:" + String(key)); return property(target, key) },
      get(target, key, receiver) { trace.push("get:" + String(key)); return Reflect.get(target, key, receiver) },
    })
    const expected = original(value), expectedTrace = trace.slice()
    trace.length = 0
    expect(sfCanonicalKeyOrderDiagnostic(value, memo)).toEqual(expected)
    expect(trace).toEqual(expectedTrace)

    const sentinel = new Error("key-order original method")
    let calls = 0
    const failedKeys = withProperty(Object, "keys", { configurable: true,
      get() { calls++; throw sentinel } }, () => thrown(() => sfCanonicalKeyOrderDiagnostic(value, memo)))
    expect(failedKeys).toBe(sentinel)
    expect(calls).toBe(1)
    calls = 0
    const failedSort = withProperty(Array.prototype, "sort", { configurable: true,
      get() { calls++; throw sentinel } }, () => thrown(() => sfCanonicalKeyOrderDiagnostic(value, memo)))
    expect(failedSort).toBe(sentinel)
    expect(calls).toBe(1)

    let receiver: unknown, getterCalls = 0, methodCalls = 0
    const hookedKeys = withProperty(Object, "keys", { configurable: true,
      get() {
        getterCalls++
        return function(this: unknown, input: object) {
          receiver = this; methodCalls++
          return originalKeys(input)
        }
      },
    }, () => sfCanonicalKeyOrderDiagnostic({ z: 2, a: 1 }, memo))
    expect(hookedKeys).toEqual(["a", "z"])
    expect(receiver).toBe(Object)
    expect(getterCalls).toBe(1)
    expect(methodCalls).toBe(1)

    const originalDescriptor = property(Array.prototype, "sort")
    if (!originalDescriptor) throw new Error("Missing original sort descriptor")
    let sortCalls = 0
    const changing = new Proxy({ z: 2, a: 1 }, {
      ownKeys(target) {
        define(Array.prototype, "sort", { ...originalDescriptor,
          value: function(this: string[]) {
            sortCalls++
            return apply(originalSort, this, [])
          },
        })
        return Reflect.ownKeys(target)
      },
    })
    let actual: string[] = []
    try { actual = sfCanonicalKeyOrderDiagnostic(changing, memo) }
    finally { define(Array.prototype, "sort", originalDescriptor) }
    expect(actual).toEqual(["a", "z"])
    expect(sortCalls).toBe(1)
  }
})

test("memo arrays remain private under prototype setters and later map mutation", () => {
  for (const memo of [false, true]) {
    resetSfCanonicalKeyOrderDiagnostic()
    const value = { z: 2, a: 1 }
    let setterCalls = 0
    const actual = withProperty(Array.prototype, "0", { configurable: true,
      set() { setterCalls++; throw new Error("Private index escaped") } },
    () => sfCanonicalKeyOrderDiagnostic(value, memo))
    expect(actual).toEqual(["a", "z"])
    expect(setterCalls).toBe(0)
    const originalMap = Array.prototype.map
    const mapped = withProperty(Array.prototype, "map", {
      configurable: true, writable: true,
      value: function(this: string[]) {
        const result = apply(originalMap, this, [(key: string) => key])
        this[0] = "changed after sorting"
        return result
      },
    }, () => sfCanonicalKeyOrderDiagnostic(value, memo).map((key) => key))
    expect(mapped).toEqual(["a", "z"])
    expect(sfCanonicalKeyOrderDiagnostic(value, memo)).toEqual(["a", "z"])
  }
})

test("paired key-order microcomparison measures guards and bounded memo overhead", () => {
  const pinned = (Bun.version === "1.3.14" && Bun.revision === "0d9b296af33f2b851fcbf4df3e9ec89751734ba4") ||
    (Bun.version === "1.4.1" && Bun.revision === "4661e494f052c83c80dade1318e5710238340be6")
  expect(pinned).toBe(true)
  const clock = performance.now.bind(performance)
  const cases = fixtures().map((fixture) => ({ ...fixture, records: records(fixture.value) }))
  const ordered = Object.fromEntries(Array.from({ length: 32 }, (_, index) => ["key" + String(index).padStart(2, "0"), index]))
  const wide = Object.fromEntries(Array.from({ length: 48 }, (_, index) => ["key" + String(48 - index).padStart(2, "0"), index]))
  const churn = Array.from({ length: 16 }, (_, shape) =>
    Object.fromEntries(Array.from({ length: 16 }, (_, index) => ["shape" + shape + "-" + String(16 - index).padStart(2, "0"), index])))
  cases.push(
    { name: "ordered-stress", value: ordered, records: [ordered], iterations: 1000 },
    { name: "wide-repeat-stress", value: wide, records: [wide], iterations: 1000 },
    { name: "same-length-churn-stress", value: churn, records: churn, iterations: 1000 },
  )
  let lines = 0
  const emit = (data: object) => {
    const line = "SF_CANONICAL_KEYORDER_DIAGNOSTIC " + JSON.stringify({
      schema: "sf-canonical-keyorder-v1", qualification: false, fixtureOnly: true,
      source: "97c921ab0054bd5154227593adcbcca56b0538c3",
      runtime: { version: Bun.version, revision: Bun.revision }, ...data,
    })
    expect(++lines).toBeLessThanOrEqual(10)
    expect(line.length + 1).toBeLessThanOrEqual(4096)
    expect(/^[\x20-\x7e]+$/.test(line)).toBe(true)
    console.info(line)
  }
  emit({ phase: "start", lanes: ["original", "already-sorted", "bounded-key-memo"],
    method: "Object.keys plus sort only, repeated records preserve alias traversal weighting",
    warmupPassesPerLane: 100, pairs: 4, measurementsMultiplier: 4,
    wholeCanonicalMeasured: false, installedPreviewMeasured: false, originalHasherChanged: false,
    maximumKeys: 64, maximumRetainedStringUnits: 65536, countersIncludedInTiming: true })
  const rounded = (value: number) => {
    if (!Number.isFinite(value) || value < 0) throw new Error("Invalid monotonic diagnostic duration")
    return Math.round(value * 1000) / 1000
  }
  let measuredRecordCalls = 0
  for (const fixture of cases) {
    const expected = fixture.records.map(original)
    const expectedUnits = expected.reduce((sum, keys) => sum + keys.length +
      (keys[0]?.length ?? 0) + (keys[keys.length - 1]?.length ?? 0), 0)
    const run = (mode: number, iterations: number) => {
      resetSfCanonicalKeyOrderDiagnostic()
      let units = 0, last: string[] = []
      const start = clock()
      for (let iteration = 0; iteration < iterations; iteration++) {
        for (let index = 0; index < fixture.records.length; index++) {
          const value = fixture.records[index]
          if (!value) throw new Error("Missing fixture record")
          last = mode === 0 ? original(value) : sfCanonicalKeyOrderDiagnostic(value, mode === 2)
          units += last.length + (last[0]?.length ?? 0) + (last[last.length - 1]?.length ?? 0)
        }
      }
      const ms = rounded(clock() - start)
      expect(units).toBe(expectedUnits * iterations)
      expect(last).toEqual(expected[expected.length - 1] ?? [])
      const state = sfCanonicalKeyOrderDiagnosticState()
      expect(state.retainedUnits).toBeLessThanOrEqual(65536)
      return { ms, ...state }
    }
    run(0, 100); run(1, 100); run(2, 100)
    const pairs: number[][] = []
    const orders = [[0, 1, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]
    for (const order of orders) {
      const observations = order.map((mode) => ({ mode, result: run(mode, fixture.iterations * 4) }))
      const baseline = observations.find((item) => item.mode === 0)?.result
      const sorted = observations.find((item) => item.mode === 1)?.result
      const memo = observations.find((item) => item.mode === 2)?.result
      if (!baseline || !sorted || !memo) throw new Error("Missing comparison lane")
      pairs.push([order[0]!, baseline.ms, sorted.ms, memo.ms, sorted.ordered,
        memo.hit, memo.miss, memo.refused, memo.clears, memo.retainedUnits])
      measuredRecordCalls += fixture.records.length * fixture.iterations * 4
    }
    emit({ phase: "fixture", fixture: fixture.name, recordsPerPass: fixture.records.length,
      iterationsPerLane: fixture.iterations * 4,
      columns: ["firstLane", "originalMs", "sortedMs", "memoMs", "alreadyOrdered",
        "memoHits", "memoMisses", "memoRefused", "memoClears", "retainedUnits"], pairs })
  }
  emit({ phase: "complete", fixtures: cases.length, measuredRecordCallsPerLane: measuredRecordCalls,
    timeThresholdApplied: false, productAdoption: false })
}, 120_000)
