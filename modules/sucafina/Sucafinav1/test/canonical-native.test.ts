import { expect, test } from "bun:test"
import { canonicalSfValue, digestSfValue } from "../product/contracts/canonical.ts"

test("native canonical bytes preserve absent, null and signed zero while ordering object keys", () => {
  const value = { z: null, b: -0, a: undefined }
  expect(canonicalSfValue(value)).toBe('["object",[["a",["absent"]],["b",["number","-0"]],["z",["null"]]]]')
  expect(digestSfValue(value)).toBe("b4a421d81576203d897e3517a69b9c626cf7ffbc56c3356ee588f8c96d97be41")
  expect(digestSfValue(value)).toBe(digestSfValue({ a: undefined, z: null, b: -0 }))
  expect(digestSfValue(value)).not.toBe(digestSfValue({ ...value, b: 0 }))
  expect(digestSfValue(value)).not.toBe(digestSfValue({ z: null, b: -0 }))
})

test("native canonical bytes reject non-finite values and unsupported object prototypes", () => {
  expect(() => canonicalSfValue({ amount: Infinity })).toThrow("SF_CANONICAL_NONFINITE")
  expect(() => canonicalSfValue(new Date("2026-11-21"))).toThrow("SF_CANONICAL_UNSUPPORTED")
})
