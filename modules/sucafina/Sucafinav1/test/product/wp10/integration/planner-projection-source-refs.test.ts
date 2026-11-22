import { expect, test } from "bun:test"
import { sfCanonicalProjectionRuntime } from "../../../../product/contracts/canonical.ts"
import { matchesSfPlannerProjectionSourceRefs } from "../../../../product/host-binding/planner-projection-source-refs.ts"
import type { BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import type { ProjectionValue } from "../../../../product/contracts/context.ts"
import { plannerProjectionReference, plannerProjectionRows, plannerProjectionLoadingModes,
  runSfPlannerProjectionLoadingControl } from "../../../../../../../apps/cli/test/fixture/sucafina-planner-projection-loading.ts"

const property = Object.getOwnPropertyDescriptor, define = Object.defineProperty
const remove = Reflect.deleteProperty, nativeEvery = Array.prototype.every
const create = Object.create, assign = Object.assign
function projectionValueAt(values: readonly ProjectionValue[], index: number): ProjectionValue {
  const value = values[index]
  if (!value) throw new Error("Expected projected value at " + index)
  return value
}
function descriptor(value: PropertyDescriptor): PropertyDescriptor { return assign(create(null), value) }
function withProperty<Value>(owner: object, key: PropertyKey, replacement: PropertyDescriptor, work: () => Value): Value {
  const saved = property(owner, key)
  define(owner, key, descriptor(replacement))
  try { return work() } finally { if (saved) define(owner, key, descriptor(saved)); else remove(owner, key) }
}
function withValue<Value>(owner: object, key: PropertyKey, value: unknown, work: () => Value): Value {
  const saved = property(owner, key)
  if (!saved || !Object.hasOwn(saved, "value")) throw new Error("Expected an own data property")
  return withProperty(owner, key, { ...saved, value }, work)
}
function extra(ref: BusinessEvidenceRef, value: unknown) {
  define(ref, "extra", descriptor({ configurable: true, enumerable: true, writable: true, value }))
}
// An own, unchanged native every selects the production fallback without
// copying the comparator, replacing its digest, or adding a debug capability.
function original(values: ProjectionValue[], ref: BusinessEvidenceRef) {
  return withProperty(values, "every", { configurable: true, value: nativeEvery }, () => matchesSfPlannerProjectionSourceRefs(values, ref))
}
function thrown(work: () => unknown): unknown { try { work(); return undefined } catch (error) { return error } }
function settled(work: () => boolean): boolean | string {
  try { return work() } catch (error) {
    if (!(error instanceof Error)) throw error
    return error.name + ":" + error.message
  }
}

test("planner source bytes compare independent refs and are fresh on every invocation", () => {
  const runtime = sfCanonicalProjectionRuntime()
  expect(runtime).toBeDefined()
  expect(runtime?.current()).toBe(true)
  expect(Object.isFrozen(runtime)).toBe(true)
  const left = plannerProjectionReference(), right = structuredClone(left), values = plannerProjectionRows(left)
  expect(right).not.toBe(left)
  expect(values.every((row) => row.sourceRefs[0] === left)).toBe(true)
  expect(matchesSfPlannerProjectionSourceRefs(values, right)).toBe(true)
  expect(matchesSfPlannerProjectionSourceRefs(values, right)).toBe(true)
  left.target.version = 2
  expect(matchesSfPlannerProjectionSourceRefs(values, right)).toBe(false)
  right.target.version = 2
  expect(matchesSfPlannerProjectionSourceRefs(values, right)).toBe(true)
  values[1] = projectionValueAt(plannerProjectionRows(plannerProjectionReference(), 1), 0)
  expect(matchesSfPlannerProjectionSourceRefs(values, right)).toBe(false)
  values[1] = projectionValueAt(plannerProjectionRows(structuredClone(left), 1), 0)
  expect(matchesSfPlannerProjectionSourceRefs(values, right)).toBe(true)
  right.target.fields = ["changed"]
  expect(matchesSfPlannerProjectionSourceRefs(values, right)).toBe(false)
})

test("empty, sparse and heterogeneous rows retain original every short-circuit behavior", () => {
  const ref = plannerProjectionReference(), error = new Error("unvisited row"), trace: string[] = []
  const unread = new Proxy(ref, { get() { trace.push("ref"); throw error } })
  expect(matchesSfPlannerProjectionSourceRefs([], unread)).toBe(true)
  const sparse = plannerProjectionRows(ref, 1); sparse.length = 3
  expect(matchesSfPlannerProjectionSourceRefs(sparse, plannerProjectionReference())).toBe(true)
  const missing: BusinessEvidenceRef[] = []; missing.length = 1
  const hole = plannerProjectionRows(ref, 1); projectionValueAt(hole, 0).sourceRefs = missing
  expect(matchesSfPlannerProjectionSourceRefs(hole, plannerProjectionReference())).toBe(false)
  const first = projectionValueAt(plannerProjectionRows(ref, 1), 0)
  first.sourceRefs = []
  const later = new Proxy(projectionValueAt(plannerProjectionRows(ref, 1), 0), { get() { trace.push("later"); throw error } })
  expect(matchesSfPlannerProjectionSourceRefs([first, later], plannerProjectionReference())).toBe(false)
  expect(trace).toEqual([])
  const values = plannerProjectionRows(ref)
  projectionValueAt(values, 1).sourceRefs = [ref, ref]
  expect(matchesSfPlannerProjectionSourceRefs(values, plannerProjectionReference())).toBe(false)
})

test("accessors and proxies add no observations before the original fallback", () => {
  const sentinel = new Error("original getter identity"), left = plannerProjectionReference(), right = plannerProjectionReference()
  let reads = 0
  define(left, "refId", descriptor({ enumerable: true, get() { reads++; throw sentinel } }))
  expect(thrown(() => original(plannerProjectionRows(left), right))).toBe(sentinel)
  expect(reads).toBe(1)
  reads = 0
  expect(thrown(() => matchesSfPlannerProjectionSourceRefs(plannerProjectionRows(left), right))).toBe(sentinel)
  expect(reads).toBe(1)
  const trace: string[] = []
  const proxy = new Proxy(plannerProjectionReference(), {
    getPrototypeOf(value) { trace.push("prototype"); return Reflect.getPrototypeOf(value) },
    ownKeys(value) { trace.push("keys"); return Reflect.ownKeys(value) },
    getOwnPropertyDescriptor(value, key) { trace.push("descriptor:" + String(key)); return property(value, key) },
    get(value, key, receiver) { trace.push("get:" + String(key)); return Reflect.get(value, key, receiver) },
  })
  expect(original(plannerProjectionRows(proxy), right)).toBe(true)
  const expected = trace.slice(); trace.length = 0
  expect(matchesSfPlannerProjectionSourceRefs(plannerProjectionRows(proxy), right)).toBe(true)
  expect(trace).toEqual(expected)
  const changed = projectionValueAt(plannerProjectionRows(plannerProjectionReference(), 1), 0)
  define(changed, "sourceRefs", descriptor({ get() { reads++; throw sentinel } }))
  reads = 0
  expect(thrown(() => matchesSfPlannerProjectionSourceRefs([changed], right))).toBe(sentinel)
  expect(reads).toBe(1)
})

test("tagged values and unsupported graphs keep the original results and errors", () => {
  const left = plannerProjectionReference(), right = plannerProjectionReference()
  extra(left, undefined)
  expect(matchesSfPlannerProjectionSourceRefs(plannerProjectionRows(left), right)).toBe(false)
  extra(right, undefined)
  expect(matchesSfPlannerProjectionSourceRefs(plannerProjectionRows(left), right)).toBe(true)
  left.target.version = -0; right.target.version = 0
  expect(matchesSfPlannerProjectionSourceRefs(plannerProjectionRows(left), right)).toBe(false)
  const cycle: { next?: unknown } = {}; cycle.next = cycle
  for (const value of [NaN, Infinity, -Infinity, 1n, () => 1, Symbol("value"), new Date(0), new Map(), new Set(), cycle]) {
    const a = plannerProjectionReference(), b = plannerProjectionReference(); extra(a, value); extra(b, value)
    expect(settled(() => matchesSfPlannerProjectionSourceRefs(plannerProjectionRows(a, 1), b))).toBe(settled(() => original(plannerProjectionRows(a, 1), b)))
  }
})

test("native brands preserve the original lazy Error stack and reparented-view behavior", () => {
  const runtime = sfCanonicalProjectionRuntime()
  if (!runtime) throw new Error("Pinned native projection capability is required")
  const sentinel = new Error("original stack effect")
  const createBrands = () => [new Error("unmaterialized"), new SharedArrayBuffer(8),
    new Uint8Array(new SharedArrayBuffer(8)), new DataView(new SharedArrayBuffer(8)), new Proxy({}, {})]
  const baseline = createBrands(), candidate = createBrands()
  for (const value of [...baseline, ...candidate]) Object.setPrototypeOf(value, Object.prototype)
  expect(candidate.map((value) => runtime.reject(value))).toEqual([true, true, true, true, true])
  const observe = (values: readonly object[], fallback: boolean) => {
    let stackReads = 0
    const results = withProperty(Error, "prepareStackTrace", { configurable: true,
      value: () => { stackReads++; throw sentinel } }, () => values.map((value) => {
      const left = plannerProjectionReference(), right = plannerProjectionReference()
      extra(left, value); extra(right, value)
      return settled(() => fallback ? original(plannerProjectionRows(left, 1), right)
        : matchesSfPlannerProjectionSourceRefs(plannerProjectionRows(left, 1), right))
    }))
    return { results, stackReads }
  }
  expect(observe(candidate, false)).toEqual(observe(baseline, true))
})

test("bounded admission retains the same fallback at row and graph limits", () => {
  let deep: unknown = null, expanded: unknown = 0
  for (let i = 0; i < 70; i++) deep = { next: deep }
  for (let i = 0; i < 17; i++) expanded = [expanded, expanded]
  const cases = [deep, expanded, "x".repeat(4 * 1024 * 1024 + 1),
    Array.from({ length: 4097 }, () => ({})),
    Object.fromEntries(Array.from({ length: 32769 }, (_, i) => [String(i), i]))]
  for (const value of cases) {
    const left = plannerProjectionReference(), right = plannerProjectionReference(); extra(left, value); extra(right, value)
    expect(matchesSfPlannerProjectionSourceRefs(plannerProjectionRows(left, 1), right)).toBe(original(plannerProjectionRows(left, 1), right))
  }
  const left = plannerProjectionReference(), right = plannerProjectionReference(), values = plannerProjectionRows(left, 4097)
  expect(matchesSfPlannerProjectionSourceRefs(values, right)).toBe(true)
  expect(original(values, right)).toBe(true)
})

test("real hashers preserve two constructions per visited row and getter-before-bytes order", () => {
  const NativeHasher = Bun.CryptoHasher, update = NativeHasher.prototype.update
  for (const mutateAt of [0, 3]) {
    const left = plannerProjectionReference(), right = plannerProjectionReference(), values = plannerProjectionRows(left)
    const trace: string[] = []; let constructions = 0
    const hooked = new Proxy(NativeHasher, { construct(target, args) {
      const index = ++constructions
      trace.push("construct:" + index)
      const hasher = Reflect.construct(target, args)
      define(hasher, "update", descriptor({ configurable: true, get() {
        trace.push("update:" + index)
        if (index === mutateAt) left.target.version = 2
        return update
      } }))
      return hasher
    } })
    const result = withValue(Bun, "CryptoHasher", hooked, () => matchesSfPlannerProjectionSourceRefs(values, right))
    expect(result).toBe(mutateAt === 0)
    expect(constructions).toBe(mutateAt === 0 ? 6 : 4)
    expect(trace).toEqual(Array.from({ length: constructions }, (_, i) => ["construct:" + (i + 1), "update:" + (i + 1)]).flat())
  }
  expect(sfCanonicalProjectionRuntime()).toBeDefined()
})

test("a self-restoring hasher getter keeps current serializer effects and cannot seed a later call", () => {
  const left = plannerProjectionReference(), right = plannerProjectionReference(), values = plannerProjectionRows(left)
  const constructor = property(Bun, "CryptoHasher"), stringify = property(JSON, "stringify")
  if (!constructor || !stringify) throw new Error("Expected native hash and serializer descriptors")
  const update = Bun.CryptoHasher.prototype.update, trace: string[] = []
  const hooked = new Proxy(Bun.CryptoHasher, { construct(target, args) {
    trace.push("construct")
    define(Bun, "CryptoHasher", descriptor(constructor))
    const hasher = Reflect.construct(target, args)
    define(hasher, "update", descriptor({ configurable: true, get() {
      trace.push("update"); remove(hasher, "update")
      define(JSON, "stringify", descriptor({ ...stringify, value: () => {
        trace.push("stringify"); define(JSON, "stringify", descriptor(stringify))
        return '"transient-source-bytes"'
      } }))
      return update
    } }))
    return hasher
  } })
  const result = withValue(Bun, "CryptoHasher", hooked, () => {
    try { return matchesSfPlannerProjectionSourceRefs(values, right) } finally { define(JSON, "stringify", descriptor(stringify)) }
  })
  expect(result).toBe(false)
  expect(trace).toEqual(["construct", "update", "stringify"])
  expect(matchesSfPlannerProjectionSourceRefs(values, right)).toBe(true)
  expect(sfCanonicalProjectionRuntime()).toBeDefined()
})

for (const mode of plannerProjectionLoadingModes) test("planner projection anchors precede late import: " + mode, async () => {
  const result = await runSfPlannerProjectionLoadingControl(import.meta.path, mode)
  expect(result.omniSpawns).toBe(1)
  expect(result.omniDelegations).toBe(0)
  const limited = mode === "missing-detector", trace = mode === "late-every" ? ["every"] : []
  expect(result.receipt).toMatchObject({
    mode, order: [...(limited ? ["bootstrap-limited"] : []), "canonical-loaded", "hook-arranged", "helper-loaded", "restored"],
    beforeHookAdmitted: !limited, duringHookAdmitted: mode === "clean", restoredAdmitted: !limited,
    oldCaptureBefore: true, oldCaptureRestored: true, loadTrace: [],
    expected: true, actual: true, expectedTrace: trace, actualTrace: trace,
    changedExpected: false, changedActual: false, changedExpectedTrace: trace, changedActualTrace: trace,
  })
})
