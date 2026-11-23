import { expect, test } from "bun:test"
import { canonicalSfValue } from "../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { cloneSfCanonicalValues } from "../../../modules/sucafina/Sucafinav1/product/contracts/canonical-clone.ts"
import { canonicalSfIncludesDiagnosticValue, sfCanonicalIncludesDiagnosticAvailable, sfCanonicalIncludesDiagnosticBootstrapAvailable } from "./fixture/sucafina-includes-diagnostic.ts"
import { plannerProjectionReference, plannerProjectionRows } from "./fixture/sucafina-planner-projection-loading.ts"

const property = Object.getOwnPropertyDescriptor, define = Object.defineProperty
const remove = Reflect.deleteProperty, apply = Reflect.apply
const prototype = Object.getPrototypeOf, originalIncludes = Array.prototype.includes
const originalObject = Object, originalKeys = Object.keys, originalIs = Object.is

function withProperty<Value>(owner: object, key: PropertyKey, replacement: PropertyDescriptor | undefined, work: () => Value): Value {
  const saved = property(owner, key)
  if (replacement) define(owner, key, replacement)
  else remove(owner, key)
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

test("bootstrap proof rejects a transient replacement before capturing a literal prototype", () => {
  const descriptor = property(originalObject, "getPrototypeOf")
  if (!descriptor) throw new Error("Missing original prototype method")
  let replacements = 0
  const fake = { includes: originalIncludes }
  const available = withProperty(originalObject, "getPrototypeOf", {
    ...descriptor,
    value() {
      replacements++
      define(originalObject, "getPrototypeOf", descriptor)
      return fake
    },
  }, () => sfCanonicalIncludesDiagnosticBootstrapAvailable())
  expect(available).toBe(false)
  expect(replacements).toBe(0)
  expect(sfCanonicalIncludesDiagnosticBootstrapAvailable()).toBe(true)
})

test("prototype-check candidate retains full canonical bytes and current values", () => {
  expect(sfCanonicalIncludesDiagnosticAvailable()).toBe(true)
  for (const fixture of fixtures())
    expect(canonicalSfIncludesDiagnosticValue(fixture.value)).toBe(canonicalSfValue(fixture.value))
  const shared = { count: 1 }, value = { left: shared, right: shared }
  const before = canonicalSfIncludesDiagnosticValue(value)
  shared.count = 2
  expect(canonicalSfIncludesDiagnosticValue(value)).toBe(canonicalSfValue(value))
  expect(canonicalSfIncludesDiagnosticValue(value)).not.toBe(before)
  const cloned = cloneSfCanonicalValues([value])[0]
  expect(canonicalSfIncludesDiagnosticValue(cloned)).toBe(canonicalSfValue(cloned))
  for (const input of [undefined, null, "", false, true, -0, 0, 1.25])
    expect(canonicalSfIncludesDiagnosticValue(input)).toBe(canonicalSfValue(input))
  const sparse: unknown[] = []
  sparse.length = 2
  expect(canonicalSfIncludesDiagnosticValue(sparse)).toBe(canonicalSfValue(sparse))
  for (const input of [new Date(0), 1n, Symbol("unsupported"), () => 1, NaN, Infinity]) {
    const baseline = thrown(() => canonicalSfValue(input))
    const candidate = thrown(() => canonicalSfIncludesDiagnosticValue(input))
    if (!(baseline instanceof Error) || !(candidate instanceof Error)) throw new Error("Expected canonical errors")
    expect(candidate.name).toBe(baseline.name)
    expect(candidate.message).toBe(baseline.message)
  }
})

test("hooked accessor and inherited includes retain receiver, method selection and error order", () => {
  for (const mode of ["data", "accessor", "inherited"]) {
    const observe = (codec: (value: unknown) => string) => {
      const events: string[] = [], receivers: boolean[] = []
      const value = new Proxy({ z: 2, a: 1 }, {
        getPrototypeOf(target) { events.push("prototype"); return prototype(target) },
      })
      const method = function(this: unknown, searched: unknown) {
        events.push("call")
        receivers.push(Array.isArray(this) && this.length === 2 && this[0] === originalObject.prototype && this[1] === null)
        return apply(originalIncludes, this, [searched])
      }
      const descriptor = mode === "accessor" ? {
        configurable: true,
        get: function(this: unknown) {
          events.push("get")
          receivers.push(Array.isArray(this) && this.length === 2 && this[0] === originalObject.prototype && this[1] === null)
          return method
        },
      } : { configurable: true, writable: true, value: method }
      const result = mode === "inherited"
        ? withProperty(originalObject.prototype, "includes", descriptor, () =>
          withProperty(Array.prototype, "includes", undefined, () => codec(value)))
        : withProperty(Array.prototype, "includes", descriptor, () => codec(value))
      return { result, events, receivers }
    }
    const baseline = observe(canonicalSfValue), candidate = observe(canonicalSfIncludesDiagnosticValue)
    expect(candidate).toEqual(baseline)
    expect(candidate.receivers.every((value) => value)).toBe(true)
    expect(candidate.events).toEqual(mode === "accessor" ? ["get", "prototype", "call"] : ["prototype", "call"])
  }

  const sentinel = new Error("original includes failure")
  for (const mode of ["getter", "method"]) {
    for (const codec of [canonicalSfValue, canonicalSfIncludesDiagnosticValue]) {
      let prototypes = 0
      const value = new Proxy({ count: 1 }, {
        getPrototypeOf(target) { prototypes++; return prototype(target) },
      })
      const descriptor = mode === "getter" ? {
        configurable: true, get() { throw sentinel },
      } : { configurable: true, writable: true, value() { throw sentinel } }
      const failure = withProperty(Array.prototype, "includes", descriptor, () => thrown(() => codec(value)))
      expect(failure).toBe(sentinel)
      expect(prototypes).toBe(mode === "getter" ? 0 : 1)
    }
  }
  expect(sfCanonicalIncludesDiagnosticAvailable()).toBe(true)
})

test("prototype traps changing includes run after the original native method was selected", () => {
  const descriptor = property(Array.prototype, "includes")
  if (!descriptor) throw new Error("Missing original includes")
  const expected = canonicalSfValue({ value: 1 })
  for (const codec of [canonicalSfValue, canonicalSfIncludesDiagnosticValue]) {
    let prototypes = 0, replacements = 0
    const value = new Proxy({ value: 1 }, {
      getPrototypeOf(target) {
        prototypes++
        define(Array.prototype, "includes", { ...descriptor,
          value() { replacements++; throw new Error("late includes replacement") },
        })
        return prototype(target)
      },
    })
    let result = ""
    try { result = codec(value) }
    finally { define(Array.prototype, "includes", descriptor) }
    expect(result).toBe(expected)
    expect(prototypes).toBe(1)
    expect(replacements).toBe(0)
  }

  // An includes getter may change which prototype method the subsequent
  // argument expression observes. That path must retain the original ordering.
  const prototypeDescriptor = property(originalObject, "getPrototypeOf")
  if (!prototypeDescriptor) throw new Error("Missing original prototype method")
  const sentinel = new Error("prototype method replaced by includes getter")
  for (const codec of [canonicalSfValue, canonicalSfIncludesDiagnosticValue]) {
    const events: string[] = []
    let failure: unknown
    try {
      failure = withProperty(Array.prototype, "includes", {
        configurable: true,
        get() {
          events.push("includes")
          define(originalObject, "getPrototypeOf", { ...prototypeDescriptor,
            value() { events.push("prototype"); throw sentinel },
          })
          return originalIncludes
        },
      }, () => thrown(() => codec({ value: 1 })))
    } finally { define(originalObject, "getPrototypeOf", prototypeDescriptor) }
    expect(failure).toBe(sentinel)
    expect(events).toEqual(["includes", "prototype"])
  }
  expect(sfCanonicalIncludesDiagnosticAvailable()).toBe(true)
})

test("custom Object reads retain receiver and SameValueZero prototype membership", () => {
  // Replacing the global binding is necessary to exercise Object.prototype
  // facades; the real constructor's prototype property is not configurable.
  for (const selected of [NaN, undefined, -0, "facade", Symbol("facade")]) {
    const observe = (codec: (value: unknown) => string) => {
      const events: string[] = [], receivers: boolean[] = []
      const facade = {
        get prototype() { events.push("prototype-value"); return selected },
        get getPrototypeOf() {
          events.push("prototype-method")
          return function(this: unknown) {
            events.push("prototype-call")
            receivers.push(this === facade)
            return selected
          }
        },
        get keys() { events.push("keys"); return originalKeys },
        get is() { events.push("is"); return originalIs },
      }
      const result = withProperty(globalThis, "Object", {
        configurable: true, get() { events.push("Object"); return facade },
      }, () => codec({ value: 1 }))
      return { result, events, receivers }
    }
    const baseline = observe(canonicalSfValue), candidate = observe(canonicalSfIncludesDiagnosticValue)
    expect(candidate).toEqual(baseline)
    expect(candidate.receivers).toEqual([true])
  }
  expect(sfCanonicalIncludesDiagnosticAvailable()).toBe(true)
})

test("paired full canonical comparison includes the prototype descriptor guard", () => {
  const pinned = (Bun.version === "1.3.14" && Bun.revision === "0d9b296af33f2b851fcbf4df3e9ec89751734ba4") ||
    (Bun.version === "1.4.1" && Bun.revision === "4661e494f052c83c80dade1318e5710238340be6")
  expect(pinned).toBe(true)
  expect(sfCanonicalIncludesDiagnosticAvailable()).toBe(true)
  const clock = performance.now.bind(performance)
  let lines = 0, measuredCalls = 0
  const emit = (data: object) => {
    const line = "SF_CANONICAL_INCLUDES_DIAGNOSTIC " + JSON.stringify({
      schema: "sf-canonical-includes-v1", qualification: false, fixtureOnly: true,
      source: "97c921ab0054bd5154227593adcbcca56b0538c3",
      runtime: { version: Bun.version, revision: Bun.revision }, ...data,
    })
    expect(++lines).toBeLessThanOrEqual(7)
    expect(line.length + 1).toBeLessThanOrEqual(4096)
    expect(/^[\x20-\x7e]+$/.test(line)).toBe(true)
    console.info(line)
  }
  emit({ phase: "start", pairsPerFixture: 4, warmupCallsPerLane: 100,
    fullCanonicalMeasured: true, cloneTreeFirstInBothLanes: true,
    candidateDifference: "guarded private prototype membership only",
    perObjectGuard: "captured native own descriptor plus own-data identity check",
    broadRuntimeScanPerNode: false, objectMemo: false, nativeHashMeasured: false,
    installedPreviewMeasured: false, heapMeasured: false,
    bootstrapTrustOnly: true, bootstrapProof: "existing canonical proof checked once outside timing",
    originalHasherChanged: false,
    maxLines: 7, maxLineBytes: 4096 })
  const rounded = (value: number) => {
    if (!Number.isFinite(value) || value < 0) throw new Error("Invalid monotonic diagnostic duration")
    return Math.round(value * 1000) / 1000
  }
  for (const fixture of fixtures()) {
    const expected = canonicalSfValue(fixture.value)
    expect(canonicalSfIncludesDiagnosticValue(fixture.value)).toBe(expected)
    const run = (candidate: boolean, iterations: number) => {
      let units = 0, last = ""
      const start = clock()
      for (let index = 0; index < iterations; index++) {
        last = candidate ? canonicalSfIncludesDiagnosticValue(fixture.value) : canonicalSfValue(fixture.value)
        units += last.length
      }
      const ms = rounded(clock() - start)
      expect(last).toBe(expected)
      expect(units).toBe(expected.length * iterations)
      return ms
    }
    run(false, 100); run(true, 100)
    const pairs: number[][] = []
    for (let pair = 0; pair < 4; pair++) {
      const candidateFirst = pair % 2 === 1
      const first = run(candidateFirst, fixture.iterations), second = run(!candidateFirst, fixture.iterations)
      pairs.push([candidateFirst ? 1 : 0, candidateFirst ? second : first, candidateFirst ? first : second])
      measuredCalls += fixture.iterations
    }
    emit({ phase: "fixture", fixture: fixture.name, iterationsPerLane: fixture.iterations,
      canonicalUnits: expected.length, columns: ["candidateFirst", "originalMs", "candidateMs"], pairs })
  }
  emit({ phase: "complete", fixtures: 5, pairs: 20, measuredCallsPerLane: measuredCalls,
    timeThresholdApplied: false, productAdoption: false })
}, 120_000)
