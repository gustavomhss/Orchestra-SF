import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { test } from "node:test"
import { createShardBatch, verifyShardBindings, verifyShardRequest } from "./shard-adoption.mjs"

const SOURCE = "a".repeat(40)
const ATTEMPT = "b".repeat(32)

function fixture() {
  const shards = Array.from({ length: 8 }, (_, index) => ({
    index: index + 1,
    files: ["test/shard-" + (index + 1) + "-a.test.ts", "test/shard-" + (index + 1) + "-b.test.ts"],
    historicalLoadSeconds: 20, unprofiledFiles: 2,
  }))
  const plan = {
    schemaVersion: 1, suiteId: "CI-SF", algorithm: "LPT",
    profileStatus: "HISTORICAL_RED_OR_PARTIAL", fallbackSeconds: 10,
    selectedFiles: 16,
    selectedFilesSha256: createHash("sha256").update(shards.flatMap((part) => part.files).sort().join("\n")).digest("hex"),
    shards,
  }
  const batch = createShardBatch({ sourceSha: SOURCE, attemptId: ATTEMPT, plan })
  const contexts = batch.requests.map((entry, index) => ({
    plan, snapshotSha: String(index + 1).padStart(40, "0"), parentShas: [SOURCE],
    changedPaths: [".ci-run.json"], refName: entry.refName,
  }))
  return { plan, batch, contexts }
}

test("generates one deterministic complete batch and eight distinct create-only identities", () => {
  const { plan, batch } = fixture()
  assert.deepEqual(createShardBatch({ sourceSha: SOURCE, attemptId: ATTEMPT, plan }), batch)
  assert.equal(batch.requests.length, 8)
  assert.equal(new Set(batch.requests.map((entry) => entry.refName)).size, 8)
  const files = batch.requests.flatMap((entry) => entry.request.args.slice(2)).sort()
  assert.deepEqual(files, plan.shards.flatMap((part) => part.files).sort())
  for (const entry of batch.requests) {
    assert.ok(entry.refName.includes(SOURCE))
    assert.ok(entry.refName.includes(ATTEMPT))
    assert.deepEqual(entry.request.args.slice(0, 2), ["--timeout", "30000"])
    assert.deepEqual(entry.request.env, { ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER: "1" })
    assert.equal(entry.request.runner, "bun")
  }
  assert.equal(batch.manifest.scope, "selection-only")
  assert.equal(Object.hasOwn(batch.manifest, "conclusion"), false)
})

test("a new attempt or full source produces disjoint branch identities", () => {
  const { plan, batch } = fixture()
  for (const options of [
    { sourceSha: "c".repeat(40), attemptId: ATTEMPT },
    { sourceSha: SOURCE, attemptId: "d".repeat(32) },
  ]) {
    const next = createShardBatch({ ...options, plan })
    assert.ok(next.requests.every((entry) => !batch.requests.some((old) => old.refName === entry.refName)))
  }
})

test("JSON property order does not change the bound plan", () => {
  const { plan, batch } = fixture()
  const reordered = Object.fromEntries(Object.entries(plan).reverse())
  reordered.shards = plan.shards.map((part) => Object.fromEntries(Object.entries(part).reverse()))
  assert.deepEqual(createShardBatch({ sourceSha: SOURCE, attemptId: ATTEMPT, plan: reordered }), batch)
})

for (const [name, update] of [
  ["abbreviated source SHA", (input) => { input.sourceSha = SOURCE.slice(0, 12) }],
  ["uppercase source SHA", (input) => { input.sourceSha = SOURCE.toUpperCase() }],
  ["unsafe attempt identity", (input) => { input.attemptId = "../reuse" }],
]) {
  test("generation rejects " + name, () => {
    const input = { sourceSha: SOURCE, attemptId: ATTEMPT, plan: fixture().plan }
    update(input)
    assert.throws(() => createShardBatch(input), /SF_SHARD_ADOPTION:/)
  })
}

for (const [name, update] of [
  ["missing shard", (plan) => { plan.shards.pop() }],
  ["empty shard", (plan) => { plan.shards[0].files = [] }],
  ["repeated shard index", (plan) => { plan.shards[1].index = 1 }],
  ["duplicate file across shards", (plan) => { plan.shards[1].files[0] = plan.shards[0].files[0] }],
  ["unsorted shard files", (plan) => { plan.shards[0].files.reverse() }],
  ["missing selected file", (plan) => { plan.shards[0].files.pop(); plan.shards[0].unprofiledFiles = 1 }],
  ["foreign selected file", (plan) => { plan.shards[0].files[0] = "foreign/unselected.test.ts" }],
  ["path traversal", (plan) => { plan.shards[0].files[0] = "../outside.test.ts" }],
  ["option-like filename", (plan) => { plan.shards[0].files[0] = "-outside.test.ts" }],
  ["wrong selection digest", (plan) => { plan.selectedFilesSha256 = "0".repeat(64) }],
  ["nonfinite load", (plan) => { plan.shards[0].historicalLoadSeconds = Infinity }],
  ["impossible unknown count", (plan) => { plan.shards[0].unprofiledFiles = 3 }],
]) {
  test("generation rejects " + name, () => {
    const { plan } = fixture()
    update(plan)
    assert.throws(() => createShardBatch({ sourceSha: SOURCE, attemptId: ATTEMPT, plan }), /SF_SHARD_ADOPTION:/)
  })
}

test("validates all eight request overlays and their adoption bindings without claiming test success", () => {
  const { plan, batch, contexts } = fixture()
  const bindings = batch.requests.map((entry, index) => verifyShardRequest(entry.request, contexts[index]))
  const summary = verifyShardBindings(batch.manifest, bindings, plan)
  assert.equal(summary.bindings, 8)
  assert.equal(summary.scope, "selection-only")
  for (const binding of bindings) {
    assert.equal(binding.kind, "sf-ci-shard-binding")
    assert.equal(binding.sourceSha, SOURCE)
    assert.equal(binding.scope, "selection-only")
    assert.equal(Object.hasOwn(binding, "conclusion"), false)
  }
})

test("ordinary explicit focused requests remain outside the managed-shard contract", () => {
  const request = { package: "sucafina", runner: "bun", args: ["test/focused.test.ts"], env: {} }
  const before = structuredClone(request)
  assert.equal(verifyShardRequest(request, { refName: "ci-run-linux-focused" }), undefined)
  assert.deepEqual(request, before)
  assert.throws(() => verifyShardRequest(request, { refName: "ci-run-linux-sfshard-unbound" }), /requires binding/)
})

for (const [name, update] of [
  ["source parent drift", (context) => { context.parentShas = ["c".repeat(40)] }],
  ["multiple parents", (context) => { context.parentShas.push("c".repeat(40)) }],
  ["source used as snapshot", (context) => { context.snapshotSha = SOURCE }],
  ["foreign source changes", (context) => { context.changedPaths.push("modules/sucafina/product.ts") }],
  ["missing request overlay", (context) => { context.changedPaths = [] }],
  ["another attempt's ref", (context) => { context.refName = context.refName.replace(ATTEMPT, "d".repeat(32)) }],
]) {
  test("admission rejects " + name, () => {
    const { batch, contexts } = fixture()
    update(contexts[0])
    assert.throws(() => verifyShardRequest(batch.requests[0].request, contexts[0]), /SF_SHARD_ADOPTION:/)
  })
}

test("changed assignment with the same selected union requires a new plan", () => {
  const { plan, batch, contexts } = fixture()
  const first = plan.shards[0].files
  plan.shards[0].files = plan.shards[1].files
  plan.shards[1].files = first
  assert.throws(() => verifyShardRequest(batch.requests[0].request, contexts[0]), /plan drift/)
})

test("changed profile diagnostics are bound even when assignment stays identical", () => {
  const { plan, batch, contexts } = fixture()
  plan.shards[0].historicalLoadSeconds += 1
  assert.throws(() => verifyShardRequest(batch.requests[0].request, contexts[0]), /plan drift/)
})

for (const [name, update] of [
  ["missing file", (request) => { request.args.pop() }],
  ["duplicate file", (request) => { request.args.push(request.args[2]) }],
  ["foreign file", (request) => { request.args[2] = "foreign/other.test.ts" }],
  ["test filter", (request) => { request.args.push("-t", "only one case") }],
  ["bail", (request) => { request.args.push("--bail=1") }],
  ["legacy spawner", (request) => { request.env.ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER = "0" }],
  ["other runner", (request) => { request.runner = "node" }],
  ["other package", (request) => { request.package = "core" }],
  ["altered shard count", (request) => { request.sfShard.shardCount = 7 }],
]) {
  test("admission rejects request mutation: " + name, () => {
    const { batch, contexts } = fixture()
    update(batch.requests[0].request)
    assert.throws(() => verifyShardRequest(batch.requests[0].request, contexts[0]), /current generated shard/)
  })
}

for (const [name, update] of [
  ["missing receipt", (bindings) => { bindings.pop() }],
  ["duplicate shard receipt", (bindings) => { bindings[1] = bindings[0] }],
  ["foreign source receipt", (bindings) => { bindings[0].sourceSha = "c".repeat(40) }],
  ["changed plan receipt", (bindings) => { bindings[0].planSha256 = "0".repeat(64) }],
  ["reused snapshot identity", (bindings) => { bindings[1].snapshotSha = bindings[0].snapshotSha }],
]) {
  test("batch verification rejects " + name, () => {
    const { plan, batch, contexts } = fixture()
    const bindings = batch.requests.map((entry, index) => verifyShardRequest(entry.request, contexts[index]))
    update(bindings)
    assert.throws(() => verifyShardBindings(batch.manifest, bindings, plan), /SF_SHARD_ADOPTION:/)
  })
}

test("batch manifest changes cannot be accepted against the current plan", () => {
  const { plan, batch, contexts } = fixture()
  const bindings = batch.requests.map((entry, index) => verifyShardRequest(entry.request, contexts[index]))
  batch.manifest.shards[0].requestSha256 = "0".repeat(64)
  assert.throws(() => verifyShardBindings(batch.manifest, bindings, plan), /manifest differs/)
})
