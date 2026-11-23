import { expect, test } from "bun:test"
import { canonicalSfValue, digestSfValue } from "../product/contracts/canonical.ts"
import { cloneSfCanonicalValues, sfCanonicalCloneTree, sfCanonicalCloneBytes } from "../product/contracts/canonical-clone.ts"
import { prepareSfCapturedContextIdentity } from "../product/host-binding/captured-context-identity.ts"

const cloneBytesAdmitted = Bun.version === "1.3.14" &&
  Bun.revision === "0d9b296af33f2b851fcbf4df3e9ec89751734ba4"
const cloneBytesReleaseFallback = Bun.version === "1.4.1" &&
  Bun.revision === "4661e494f052c83c80dade1318e5710238340be6"

function cloneForBytes<Value extends object>(source: Value) {
  const value = cloneSfCanonicalValues([source])[0]
  if (!value) throw new Error("Expected one native clone")
  return value
}

function expectOriginalBytes(value: unknown) {
  // This native clone bypasses registration and exercises the original codec.
  const oracle = structuredClone(value)
  expect(sfCanonicalCloneBytes(oracle)).toBeUndefined()
  const expected = canonicalSfValue(oracle)
  expect(sfCanonicalCloneBytes(value)).toBe(cloneBytesAdmitted ? expected : undefined)
  expect(canonicalSfValue(value)).toBe(expected)
  expect(digestSfValue(value)).toBe(digestSfValue(oracle))
  return expected
}

test("clone-born bytes bind capture before first comparison and reread alias mutations", () => {
  const shared = { amount: -0, absent: undefined, nested: [null, true, 'quote"\n'] }
  const value = cloneForBytes({
    left: shared, right: shared, keys: { "10": "ten", "2": "two", "": false },
    text: 'Café 漢字 😀 \u0000 \b \f \n \r \t " \\',
    loneHigh: "\ud800", loneLow: "\udfff",
    numbers: [-0, 0, Number.MIN_VALUE, Number.MAX_VALUE, 1e21, 1e-7],
  })
  expect(value.left).toBe(value.right)
  expect(value.left).not.toBe(shared)
  const original = expectOriginalBytes(value)
  const same = prepareSfCapturedContextIdentity(value)

  value.left.amount = 2
  expect(value.right.amount).toBe(2)
  expect(same(value)).toBe(false)
  expect(expectOriginalBytes(value)).not.toBe(original)
  expect(shared.amount).toBe(-0)

  value.right.amount = -0
  expect(same(value)).toBe(true)
  expect(expectOriginalBytes(value)).toBe(original)
  value.left.nested[0] = "changed after comparison"
  expect(same(value)).toBe(false)
  expect(expectOriginalBytes(value)).not.toBe(original)

  const golden = cloneForBytes({ z: null, b: -0, a: undefined })
  expectOriginalBytes(golden)
  expect(digestSfValue(golden)).toBe("b4a421d81576203d897e3517a69b9c626cf7ffbc56c3356ee588f8c96d97be41")
})

test("clone-byte refusals preserve getter effects and a late self-restoring serializer", () => {
  const accessor = cloneForBytes({ amount: 1 })
  const failure = new Error("original canonical getter")
  let getterReads = 0
  Object.defineProperty(accessor, "amount", {
    configurable: true, enumerable: true,
    get() { getterReads++; throw failure },
  })
  expect(sfCanonicalCloneBytes(accessor)).toBeUndefined()
  expect(getterReads).toBe(0)
  expect(() => canonicalSfValue(accessor)).toThrow(failure)
  expect(getterReads).toBe(1)

  const value = cloneForBytes({ child: { amount: 1 } })
  let traps = 0
  value.child = new Proxy({ amount: 2 }, {
    getPrototypeOf() { traps++; throw failure },
  })
  expect(sfCanonicalCloneBytes(value)).toBeUndefined()
  expect(traps).toBe(0)
  expect(() => canonicalSfValue(value)).toThrow(failure)
  expect(traps).toBe(1)
  value.child = { amount: 3 }
  expect(sfCanonicalCloneBytes(value)).toBeUndefined()
  expect(canonicalSfValue(value)).toBe(canonicalSfValue(structuredClone(value)))

  const copied = cloneForBytes({ z: [1, undefined], a: -0 })
  const property = Object.getOwnPropertyDescriptor(JSON, "stringify")
  if (!property || !Object.hasOwn(property, "value")) throw new Error("Expected original serializer")
  const changedBytes = '"late canonical serializer"'
  const changedDigest = new Bun.CryptoHasher("sha256").update(changedBytes).digest("hex")
  for (const hashing of [false, true]) {
    let getterCalls = 0, serializerCalls = 0
    let observed: { direct: string | undefined; before: number; actual: string } | undefined
    Object.defineProperty(JSON, "stringify", {
      configurable: true, enumerable: property.enumerable,
      get() {
        getterCalls++
        Object.defineProperty(JSON, "stringify", property)
        return () => { serializerCalls++; return changedBytes }
      },
    })
    try {
      const direct = sfCanonicalCloneBytes(copied), before = getterCalls
      const actual = hashing ? digestSfValue(copied) : canonicalSfValue(copied)
      observed = { direct, before, actual }
    } finally {
      Object.defineProperty(JSON, "stringify", property)
    }
    expect(observed).toEqual({ direct: undefined, before: 0, actual: hashing ? changedDigest : changedBytes })
    expect(getterCalls).toBe(1)
    expect(serializerCalls).toBe(1)
  }
  expectOriginalBytes(copied)
})

test("clone-byte admission preserves graph limits and the actual Release fallback", () => {
  expect(cloneBytesAdmitted || cloneBytesReleaseFallback).toBe(true)
  const value = cloneForBytes({ amount: 1, values: [null, -0, undefined] })
  expectOriginalBytes(value)
  expect(sfCanonicalCloneTree(value) !== undefined).toBe(cloneBytesAdmitted)
  expect(sfCanonicalCloneBytes(value) !== undefined).toBe(cloneBytesAdmitted)

  let deep: object = { amount: 1 }
  for (let index = 0; index < 66; index++) deep = { child: deep }
  const nodes = Array.from({ length: 4097 }, () => ({}))
  const properties = Object.fromEntries(Array.from({ length: 32769 }, (_, index) => [String(index), index]))
  const units = { text: "x".repeat(1024 * 1024) }
  for (const input of [deep, nodes, properties, units]) {
    const copied = cloneForBytes(input)
    expect(sfCanonicalCloneBytes(copied)).toBeUndefined()
    expect(canonicalSfValue(copied)).toBe(canonicalSfValue(structuredClone(input)))
  }

  let aliases: unknown[] = []
  for (let index = 0; index < 16; index++) aliases = [aliases, aliases]
  expect(sfCanonicalCloneBytes(cloneForBytes(aliases))).toBeUndefined()

  const nonfinite = cloneForBytes({ amount: Infinity })
  expect(sfCanonicalCloneBytes(nonfinite)).toBeUndefined()
  expect(() => canonicalSfValue(nonfinite)).toThrow("SF_CANONICAL_NONFINITE")
  expect(() => canonicalSfValue(structuredClone(nonfinite))).toThrow("SF_CANONICAL_NONFINITE")
})
