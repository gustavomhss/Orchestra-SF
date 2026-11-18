import { test } from "node:test"
import assert from "node:assert/strict"
import { parseExportNames, decidePath } from "./canonical-decisions.mjs"

const head = (n) => String(n).repeat(40).slice(0, 40)
const blob = (n) => String(n).padStart(40, "0")
const source = (pr, headTime, exports, extra = {}) => ({
  pr,
  head: head(pr),
  blob: blob(pr),
  exports,
  headTime,
  ...extra,
})
const never = () => false
const decide = (input) => decidePath({ path: "src/thing.ts", bundle: "B2", isAncestor: never, ...input })

test("parseExportNames collects declarations, named, namespace and default exports", () => {
  const text = [
    "export function alpha() {}",
    "export const beta = 1",
    "export type Gamma = string",
    "export interface Delta {}",
    "export enum Epsilon { A }",
    "export class Zeta {}",
    "export async function eta() {}",
    "export { theta, iota as kappa }",
    "export type { lambda }",
    "export * as mu from './mu'",
    "export default function () {}",
    "function hidden() {}",
    "  const notExported = 1",
  ].join("\n")
  assert.deepEqual(parseExportNames(text), [
    "Gamma",
    "Delta",
    "Epsilon",
    "Zeta",
    "alpha",
    "beta",
    "default",
    "eta",
    "kappa",
    "lambda",
    "mu",
    "theta",
  ].sort())
  assert.deepEqual(parseExportNames(""), [])
})

test("base-superset rejects every source the base export set covers", () => {
  const decision = decide({
    base: { blob: blob(0), exports: ["a", "b", "c"] },
    sources: [source(11, 2000, ["a", "b"]), source(12, 1000, ["c"])],
  })
  assert.equal(decision.kind, "base-superset")
  assert.equal(decision.chosen_pr, null)
  assert.equal(decision.chosen_blob, blob(0))
  assert.deepEqual(
    decision.rejected.map((item) => item.pr),
    [11, 12],
  )
  assert.match(decision.rejected[0].reason, /base-superset: all 2 export\(s\) present in base \(3 export\(s\)\)/)
  assert.ok(decision.evidence.some((item) => item.type === "base-superset" && item.ref.includes("src/thing.ts")))
})

test("base-superset keeps a source that exports a name the base lacks", () => {
  const decision = decide({
    base: { blob: blob(0), exports: ["a"] },
    sources: [source(21, 2000, ["a", "extra"]), source(22, 1000, ["a"])],
  })
  assert.equal(decision.kind, "base-superset")
  assert.equal(decision.chosen_pr, 21)
  assert.equal(decision.chosen_blob, blob(21))
  assert.deepEqual(
    decision.rejected.map((item) => item.pr),
    [22],
  )
})

test("export-superset wins when one source strictly covers every other", () => {
  const decision = decide({
    base: null,
    sources: [source(31, 1000, ["a", "b", "c"]), source(32, 3000, ["a"]), source(33, 2000, ["b", "c"])],
  })
  assert.equal(decision.kind, "export-superset")
  assert.equal(decision.chosen_pr, 31)
  assert.deepEqual(
    decision.rejected.map((item) => item.pr),
    [32, 33],
  )
})

test("newest-head wins and records the compared export counts", () => {
  const decision = decide({
    base: null,
    sources: [source(41, 1000, ["a"]), source(42, 5000, ["b"]), source(43, 3000, ["c", "d"])],
  })
  assert.equal(decision.kind, "newest-head")
  assert.equal(decision.chosen_pr, 42)
  assert.equal(decision.chosen_blob, blob(42))
  assert.deepEqual(
    decision.rejected.map((item) => item.pr),
    [41, 43],
  )
  assert.match(decision.rejected[0].reason, /newest-head:.*exports 1 vs 1/)
  assert.match(decision.rejected[1].reason, /newest-head:.*exports 2 vs 1/)
  assert.ok(decision.evidence.some((item) => item.type === "newest-head" && item.detail.includes("newest of 3")))
})

test("newest-head does not fire when one head is an ancestor of another", () => {
  const ancestors = new Map([[head(51), new Set([head(52)])]])
  const decision = decide({
    base: null,
    isAncestor: (a, b) => ancestors.get(a)?.has(b) ?? false,
    sources: [source(51, 1000, ["a"]), source(52, 9000, ["b"])],
  })
  assert.equal(decision.kind, "ancestry")
  assert.equal(decision.chosen_pr, 52)
  assert.deepEqual(
    decision.rejected.map((item) => item.pr),
    [51],
  )
  assert.match(decision.rejected[0].reason, /ancestry:.*ancestor of #52/)
})

test("identical head time and identical export set is NEEDS_INPUT, never a guess", () => {
  const decision = decide({
    base: null,
    sources: [source(61, 4000, ["a", "b"]), source(62, 4000, ["a", "b"])],
  })
  assert.equal(decision.kind, "NEEDS_INPUT")
  assert.equal(decision.chosen_pr, null)
  assert.equal(decision.chosen_blob, null)
  assert.deepEqual(
    decision.rejected.map((item) => item.pr),
    [61, 62],
  )
  assert.ok(decision.rejected.every((item) => item.reason.startsWith("needs-input: identical head time")))
  assert.ok(decision.evidence.some((item) => item.type === "newest-head" && item.detail.includes("identical")))
})

test("identical head time with different export sets is also NEEDS_INPUT", () => {
  const decision = decide({
    base: null,
    sources: [source(71, 4000, ["a"]), source(72, 4000, ["b", "c"])],
  })
  assert.equal(decision.kind, "NEEDS_INPUT")
  assert.ok(decision.rejected.every((item) => item.reason.startsWith("needs-input: identical head time")))
})

test("decision records every source exactly once", () => {
  const decision = decide({
    base: { blob: blob(0), exports: ["a"] },
    sources: [source(81, 1000, ["a"]), source(82, 2000, ["a", "b"]), source(83, 3000, ["a"])],
  })
  const accounted = [...(decision.chosen_pr === null ? [] : [decision.chosen_pr]), ...decision.rejected.map((item) => item.pr)]
  assert.deepEqual(accounted.sort(), [81, 82, 83])
  assert.deepEqual(Object.keys(decision), ["path", "bundle", "chosen_pr", "chosen_blob", "kind", "evidence", "rejected"])
})

test("a diverged path needs at least two sources", () => {
  assert.throws(
    () => decide({ base: null, sources: [source(91, 1000, ["a"])] }),
    /NOT_DIVERGED: src\/thing\.ts has 1 source/,
  )
})
