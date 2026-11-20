import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { parseShardCosts, planShards } from "./shard-plan.mjs"

function profile() {
  return {
    schemaVersion: 1, status: "HISTORICAL_RED_OR_PARTIAL", unit: "seconds",
    pathPrefix: "test/", fallbackSeconds: 10, minimumObservedSeconds: 5,
    sourceCount: 1, observedFiles: 3, weightedFiles: 2,
    sources: [{ id: "run-1", runId: 123, jobId: 456, headSha: "a".repeat(40),
      status: "failure", partial: false, observedFiles: 3, passedTests: 2, failedTests: 1 }],
    exclusionsFromCostProfile: [{ path: "test/changed.test.ts", reason: "STRUCTURE_CHANGED" }],
    costs: [["slow.test.ts", 80, "run-1"], ["medium.test.ts", 20, "run-1"]],
  }
}

test("LPT places the longest files first and returns canonical file order", () => {
  const files = ["h.test.ts", "b.test.ts", "f.test.ts", "d.test.ts", "g.test.ts", "a.test.ts", "e.test.ts", "c.test.ts"]
  const weights = new Map([["a.test.ts", 9], ["b.test.ts", 8], ["c.test.ts", 7], ["d.test.ts", 6],
    ["e.test.ts", 5], ["f.test.ts", 4], ["g.test.ts", 3], ["h.test.ts", 2]])
  assert.deepEqual(planShards(files, 3, { weights }), [
    { files: ["a.test.ts", "f.test.ts", "g.test.ts"], loadSeconds: 16, unprofiledFiles: 0 },
    { files: ["b.test.ts", "e.test.ts", "h.test.ts"], loadSeconds: 15, unprofiledFiles: 0 },
    { files: ["c.test.ts", "d.test.ts"], loadSeconds: 13, unprofiledFiles: 0 },
  ])
})

test("input and Map insertion order do not change partition or mutate callers", () => {
  const files = Object.freeze(["test/d.test.ts", "test/b.test.ts", "test/c.test.ts", "test/a.test.ts"])
  const weights = new Map([["test/c.test.ts", 7], ["test/a.test.ts", 7]])
  const before = [...weights]
  const first = planShards(files, 2, { weights })
  assert.deepEqual(first, planShards([...files].reverse(), 2, { weights: new Map([...weights].reverse()) }))
  assert.deepEqual(first, planShards([...files.slice(1), files[0]], 2, { weights }))
  assert.deepEqual([...weights], before)
  assert.deepEqual(files, ["test/d.test.ts", "test/b.test.ts", "test/c.test.ts", "test/a.test.ts"])
})

test("new, unprofiled and structurally changed files remain selected; stale weights add none", () => {
  const parsed = parseShardCosts(profile())
  parsed.weights.set("test/no-longer-selected.test.ts", 10000)
  const files = ["test/slow.test.ts", "test/new.test.ts", "test/changed.test.ts", "test/fast-unprofiled.test.ts"]
  const planned = planShards(files, 2, parsed)
  assert.deepEqual(planned.flatMap((shard) => shard.files).sort(), [...files].sort())
  assert.equal(planned.reduce((total, shard) => total + shard.unprofiledFiles, 0), 3)
  assert.equal(planned.reduce((total, shard) => total + shard.loadSeconds, 0), 110)
  assert.equal(parsed.weights.has("test/changed.test.ts"), false)
})

test("883 unprofiled files form eight nonempty disjoint balanced shards", () => {
  const files = Array.from({ length: 883 }, (_, index) => "test/new-" + index + ".test.ts")
  const planned = planShards(files, 8)
  const flattened = planned.flatMap((shard) => shard.files)
  assert.equal(planned.length, 8)
  assert.deepEqual(flattened.toSorted(), files.toSorted())
  assert.equal(new Set(flattened).size, 883)
  assert.ok(planned.every((shard) => shard.files.length > 0))
  assert.deepEqual(planned.map((shard) => shard.files.length).sort((a, b) => a - b), [110, 110, 110, 110, 110, 111, 111, 111])
  assert.equal(Math.max(...planned.map((shard) => shard.loadSeconds)) - Math.min(...planned.map((shard) => shard.loadSeconds)), 10)
})

test("one shard and one file per shard preserve the entire caller selection", () => {
  const files = ["test/z.test.ts", "test/a.test.ts", "test/b.test.ts"]
  assert.deepEqual(planShards(files, 1), [{ files: [...files].sort(), loadSeconds: 30, unprofiledFiles: 3 }])
  assert.ok(planShards(files, 3).every((shard) => shard.files.length === 1 && shard.loadSeconds === 10))
})

test("invalid selections and impossible shard counts fail closed", () => {
  for (const files of [null, [], "test/a.test.ts", ["test/a.test.ts", "test/a.test.ts"], Array(2)]) {
    assert.throws(() => planShards(files, 1), /SF_CI_FAIL_CLOSED/)
  }
  for (const count of [0, -1, 1.5, NaN, Infinity, "1", 3, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => planShards(["a.test.ts", "b.test.ts"], count), /SF_CI_FAIL_CLOSED/)
  }
})

test("selected paths and every historical weight use canonical relative paths", () => {
  for (const path of ["/a.test.ts", "../a.test.ts", "a/../b.test.ts", "./a.test.ts", "a//b.test.ts",
    "a\\b.test.ts", "C:/a.test.ts", "a\nb.test.ts", "a\0b.test.ts", " a.test.ts", "%2e%2e/a.test.ts", ".", ""]) {
    assert.throws(() => planShards([path], 1), /SF_CI_FAIL_CLOSED/)
    assert.throws(() => planShards(["safe.test.ts"], 1, { weights: new Map([[path, 10]]) }), /SF_CI_FAIL_CLOSED/)
  }
})

test("invalid, zero and nonfinite costs cannot turn missing or known work into zero load", () => {
  for (const cost of [0, -1, NaN, Infinity, -Infinity, "10", null, Number.MAX_VALUE]) {
    assert.throws(() => planShards(["a.test.ts"], 1, { fallbackSeconds: cost }), /SF_CI_FAIL_CLOSED/)
    assert.throws(() => planShards(["a.test.ts"], 1, { weights: new Map([["a.test.ts", cost]]) }), /SF_CI_FAIL_CLOSED/)
  }
  for (const options of [null, [], "bad", { weights: {} }, { weights: null }]) {
    assert.throws(() => planShards(["a.test.ts"], 1, options), /SF_CI_FAIL_CLOSED/)
  }
  assert.throws(() => planShards(["a.test.ts", "b.test.ts"], 1, {
    weights: new Map([["a.test.ts", Number.MAX_SAFE_INTEGER], ["b.test.ts", Number.MAX_SAFE_INTEGER]]),
  }), /shard cost overflow/)
})

test("profile provenance, duplicates, unknown sources and invalidated weights fail closed", () => {
  const mutations = [
    (value) => { value.status = "PASS" },
    (value) => { value.schemaVersion = 2 },
    (value) => { value.unit = "milliseconds" },
    (value) => { value.pathPrefix = "../test/" },
    (value) => { value.pathPrefix = "test" },
    (value) => { value.fallbackSeconds = 0 },
    (value) => { value.minimumObservedSeconds = NaN },
    (value) => { value.sources[0].headSha = "missing" },
    (value) => { value.sources[0].runId = -1 },
    (value) => { value.sources[0].jobId = Infinity },
    (value) => { value.sources[0].partial = "no" },
    (value) => { value.sources[0].status = "success" },
    (value) => { value.sources[0].passedTests = -1 },
    (value) => { value.sources.push(value.sources[0]); value.sourceCount++ },
    (value) => { value.weightedFiles++ },
    (value) => { value.observedFiles++ },
    (value) => { value.costs.push(value.costs[0]); value.weightedFiles++ },
    (value) => { value.costs[0][0] = "/outside.test.ts" },
    (value) => { value.costs[0][1] = NaN },
    (value) => { value.costs[0][1] = Infinity },
    (value) => { value.costs[0][1] = 1 },
    (value) => { value.costs[0][2] = "missing-run" },
    (value) => { value.costs[0].push("unexpected") },
    (value) => { value.costs[0][0] = "changed.test.ts" },
    (value) => { value.exclusionsFromCostProfile[0].reason = "SKIP" },
    (value) => { value.exclusionsFromCostProfile.push(value.exclusionsFromCostProfile[0]) },
  ]
  for (const mutate of mutations) {
    const value = profile()
    mutate(value)
    assert.throws(() => parseShardCosts(value), /SF_CI_FAIL_CLOSED/)
  }
})

test("the checked-in profile remains advisory and cannot narrow coverage", () => {
  const data = JSON.parse(readFileSync(new URL("../../sf/ci/shard-costs.json", import.meta.url), "utf8"))
  const parsed = parseShardCosts(data)
  assert.equal(data.status, "HISTORICAL_RED_OR_PARTIAL")
  assert.equal(data.weightedFiles, parsed.weights.size)
  assert.ok(data.sources.some((source) => source.partial))
  const files = [...parsed.weights.keys(), ...data.exclusionsFromCostProfile.map((entry) => entry.path),
    "new-tree/never-observed.test.ts"]
  const planned = planShards(files, 8, parsed)
  assert.deepEqual(planned.flatMap((shard) => shard.files).sort(), [...files].sort())
  assert.equal(new Set(planned.flatMap((shard) => shard.files)).size, files.length)
  assert.ok(planned.every((shard) => shard.files.length > 0))
  for (const { path } of data.exclusionsFromCostProfile) assert.equal(parsed.weights.has(path), false)
})
