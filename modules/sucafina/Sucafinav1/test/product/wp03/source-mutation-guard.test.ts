import { expect, test } from "bun:test"
import type { Snapshot } from "../../../runtime/contract.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createSfSnapshotMutationGuard } from "../../../product/integration/snapshot-mutation-guard.ts"

type Probe = { value: Record<string, unknown>; reads: string[] }
type Case = { name: string; create: () => Record<string, unknown>; change: (value: Record<string, unknown>) => void }
const unchanged = () => {}
const cases: Case[] = [
  { name: "plain nested data", create: () => ({ a: [{ present: undefined, nil: null, zero: 0, negative: -0 }], b: "same" }), change: unchanged },
  { name: "reordered keys", create: () => ({ a: 1, b: 2 }), change: (value) => { delete value.a; value.a = 1 } },
  { name: "null prototype normalization", create: () => ({ nested: Object.assign(Object.create(null), { a: 1 }) }),
    change: (value) => { value.nested = { a: 1 } } },
  { name: "shared pure children", create: () => { const child = { a: 1 }; return { a: child, b: child } }, change: unchanged },
  { name: "new undefined property", create: () => ({}), change: (value) => { value.added = undefined } },
  { name: "removed undefined property", create: () => ({ a: undefined }), change: (value) => { delete value.a } },
  { name: "negative zero change", create: () => ({ a: -0 }), change: (value) => { value.a = 0 } },
  { name: "dense array mutation", create: () => ({ a: [1, 2] }), change: (value) => { (value.a as number[])[1] = 3 } },
  { name: "dense array becomes sparse", create: () => ({ a: [1, undefined] }), change: (value) => { delete (value.a as unknown[])[1] } },
  { name: "sparse array remains sparse", create: () => ({ a: Array(2) }), change: unchanged },
  { name: "sparse slot becomes undefined", create: () => ({ a: Array(2) }), change: (value) => { (value.a as unknown[])[0] = undefined } },
  { name: "array extras stay ignored", create: () => ({ a: Object.assign([1], { extra: 2 }) }),
    change: (value) => { Reflect.set(value.a as object, "extra", 3) } },
  { name: "array extra introduced", create: () => ({ a: [1] }),
    change: (value) => { Reflect.set(value.a as object, "extra", () => "ignored") } },
  { name: "symbol property stays ignored", create: () => ({ a: 1, [Symbol("private")]: "ignored" }),
    change: (value) => { Reflect.set(value, Object.getOwnPropertySymbols(value)[0]!, "still ignored") } },
  { name: "non-enumerable property introduced", create: () => ({ a: 1 }),
    change: (value) => { Object.defineProperty(value, "private", { value: () => "ignored" }) } },
  { name: "nonfinite number introduced", create: () => ({ a: 1 }), change: (value) => { value.a = Infinity } },
  { name: "nonfinite number originally present", create: () => ({ a: NaN }), change: unchanged },
  { name: "unsupported date introduced", create: () => ({ a: 1 }), change: (value) => { value.a = new Date(0) } },
  { name: "unsupported function introduced", create: () => ({ a: 1 }), change: (value) => { value.a = () => 1 } },
  { name: "unsupported bigint introduced", create: () => ({ a: 1 }), change: (value) => { value.a = 1n } },
  { name: "unsupported prototype introduced", create: () => ({ a: 1 }),
    change: (value) => { Object.setPrototypeOf(value, { inherited: "unsupported" }) } },
  { name: "cycle introduced", create: () => ({ a: 1 }), change: (value) => { value.self = value } },
]

function originalGuard(value: Snapshot) {
  const before = digestSfValue(value)
  return () => digestSfValue(value) === before
}

function outcome(create: () => Probe, change: (probe: Probe) => void,
  guard: typeof createSfSnapshotMutationGuard) {
  const probe = create()
  try {
    const same = guard(probe.value as unknown as Snapshot)
    change(probe)
    return { result: same(), reads: probe.reads }
  } catch (error) {
    return { error: error instanceof Error ? [error.name, error.message] : String(error), reads: probe.reads }
  }
}

for (const item of cases) test("source mutation comparison preserves canonical " + item.name, () => {
  const create = () => ({ value: item.create(), reads: [] })
  const change = (probe: Probe) => item.change(probe.value)
  expect(outcome(create, change, createSfSnapshotMutationGuard)).toEqual(outcome(create, change, originalGuard))
})

test("source mutation comparison retains canonical accessor reads before and after callbacks", () => {
  const create = (): Probe => {
    const reads: string[] = []
    const value = { stable: 1 }
    Object.defineProperty(value, "a", { enumerable: true, get: () => { reads.push("get:a"); return 1 } })
    return { value, reads }
  }
  const expected = outcome(create, unchanged, originalGuard)
  expect(expected).toEqual({ result: true, reads: ["get:a", "get:a"] })
  expect(outcome(create, unchanged, createSfSnapshotMutationGuard)).toEqual(expected)
})

test("source mutation comparison falls back when a callback introduces an accessor", () => {
  const create = (): Probe => ({ value: { a: 1 }, reads: [] })
  const change = ({ value, reads }: Probe) => {
    Object.defineProperty(value, "a", { enumerable: true, get: () => { reads.push("get:a"); return 1 } })
  }
  const expected = outcome(create, change, originalGuard)
  expect(expected).toEqual({ result: true, reads: ["get:a"] })
  expect(outcome(create, change, createSfSnapshotMutationGuard)).toEqual(expected)
})

test("source mutation comparison inspects neither original nor introduced proxies", () => {
  const createProxy = (reads: string[]) => new Proxy({ a: 1 }, {
    getPrototypeOf(target) { reads.push("prototype"); return Reflect.getPrototypeOf(target) },
    ownKeys(target) { reads.push("keys"); return Reflect.ownKeys(target) },
    getOwnPropertyDescriptor(target, key) { reads.push("descriptor:" + String(key)); return Reflect.getOwnPropertyDescriptor(target, key) },
    get(target, key, receiver) { reads.push("get:" + String(key)); return Reflect.get(target, key, receiver) },
  })
  for (const introduced of [false, true]) {
    const create = (): Probe => {
      const reads: string[] = []
      return { value: { nested: introduced ? { a: 1 } : createProxy(reads) }, reads }
    }
    const change = ({ value, reads }: Probe) => { if (introduced) value.nested = createProxy(reads) }
    const expected = outcome(create, change, originalGuard)
    expect(expected).toMatchObject({ result: true })
    expect(outcome(create, change, createSfSnapshotMutationGuard)).toEqual(expected)
  }
})

test("source mutation comparison keeps custom array map access in the canonical fallback", () => {
  const create = (): Probe => {
    const reads: string[] = []
    const array = [1]
    Object.defineProperty(array, "map", { get: () => { reads.push("get:map"); return Array.prototype.map } })
    return { value: { array }, reads }
  }
  const expected = outcome(create, unchanged, originalGuard)
  expect(expected).toEqual({ result: true, reads: ["get:map", "get:map"] })
  expect(outcome(create, unchanged, createSfSnapshotMutationGuard)).toEqual(expected)
})
