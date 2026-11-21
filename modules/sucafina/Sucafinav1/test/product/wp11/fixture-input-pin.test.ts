import { expect, test } from "bun:test"
import { canonicalSfValue, digestSfValue } from "../../../product/contracts/canonical.ts"
import { captureFixtureInput } from "./fixture-input-pin.ts"

test("flat fixture input pins preserve every tagged primitive distinction of the canonical digest", () => {
  const mutations: [string, (value: Record<string, unknown>) => void][] = [
    ["selector", (value) => { value.caseRef = "different-case" }],
    ["zero", (value) => { value.amount = -0 }],
    ["absent", (value) => { delete value.missing }],
    ["null", (value) => { value.missing = null }],
    ["boolean", (value) => { value.allowed = true }],
    ["additional", (value) => { value.extra = undefined }],
  ]
  for (const [, mutate] of mutations) {
    const value: Record<string, unknown> = { caseRef: "original-case", amount: 0, missing: undefined, nullable: null, allowed: false }
    const original = digestSfValue(value), pin = captureFixtureInput(value)
    expect(pin()).toBe(true)
    mutate(value)
    expect(digestSfValue(value)).not.toBe(original)
    expect(pin()).toBe(false)
  }
})

test("fixture pins preserve own-key and null-prototype canonical semantics without retaining a digest outcome", () => {
  const value: Record<string, unknown> = { caseRef: "same" }
  const original = digestSfValue(value), pin = captureFixtureInput(value)
  Object.defineProperty(value, "hidden", { value: "not-canonical", configurable: true })
  Object.defineProperty(value, Symbol("not-canonical"), { value: "symbol", configurable: true })
  Object.setPrototypeOf(value, null)
  expect(digestSfValue(value)).toBe(original)
  expect(pin()).toBe(true)
  Object.defineProperty(value, "hidden", { value: "now-canonical", enumerable: true })
  expect(digestSfValue(value)).not.toBe(original)
  expect(pin()).toBe(false)
})

test("flat pins invoke all current getters in canonical order even after an earlier value changed", () => {
  const calls: string[] = []
  let first = "original", last = 0
  const value = Object.defineProperties({}, {
    z: { enumerable: true, get: () => { calls.push("z"); return last } },
    a: { enumerable: true, get: () => { calls.push("a"); return first } },
  })
  const pin = captureFixtureInput(value)
  expect(calls).toEqual(["a", "z"])
  calls.length = 0
  expect(pin()).toBe(true)
  expect(calls).toEqual(["a", "z"])
  first = "changed"; last = -0; calls.length = 0
  expect(pin()).toBe(false)
  expect(calls).toEqual(["a", "z"])
  calls.length = 0
  canonicalSfValue(value)
  expect(calls).toEqual(["a", "z"])
})

test("flat pins still inspect a replacement nested value and preserve canonical errors", () => {
  let nestedReads = 0
  const value: Record<string, unknown> = { first: "initial", last: "initial" }
  const pin = captureFixtureInput(value)
  value.first = "different"
  value.last = Object.defineProperty({}, "nested", { enumerable: true, get: () => { nestedReads++; return "real" } })
  expect(pin()).toBe(false)
  expect(nestedReads).toBe(1)
  value.last = Number.NaN
  expect(() => canonicalSfValue(value)).toThrow("SF_CANONICAL_NONFINITE")
  expect(() => pin()).toThrow("SF_CANONICAL_NONFINITE")
  value.last = new Date("2026-01-01T00:00:00Z")
  expect(() => canonicalSfValue(value)).toThrow("SF_CANONICAL_UNSUPPORTED")
  expect(() => pin()).toThrow("SF_CANONICAL_UNSUPPORTED")
})

test("complex fixture inputs retain the original canonical path for arrays, holes, aliases and nested mutations", () => {
  const shared = { amount: -0, absent: undefined }
  const array: unknown[] = [shared, null, undefined]
  array.length = 4
  const value = { first: shared, second: shared, array }
  const original = digestSfValue(value), pin = captureFixtureInput(value)
  expect(pin()).toBe(true)
  shared.amount = 0
  expect(digestSfValue(value)).not.toBe(original)
  expect(pin()).toBe(false)
  shared.amount = -0
  expect(pin()).toBe(true)
  array[3] = undefined
  expect(digestSfValue(value)).not.toBe(original)
  expect(pin()).toBe(false)
})

test("each nested fixture input remains pinned independently through later same-value and changed replacements", () => {
  const inputs = Array.from({ length: 64 }, (_, index) => ({ caseRef: "same-case", ordinal: index }))
  const pins = inputs.map(captureFixtureInput)
  expect(pins.every((pin) => pin())).toBe(true)
  inputs[31]!.caseRef = "changed-case"
  expect(pins.map((pin) => pin()).filter((current) => !current)).toHaveLength(1)
  inputs[31]!.caseRef = "same-case"
  expect(pins.every((pin) => pin())).toBe(true)
})
