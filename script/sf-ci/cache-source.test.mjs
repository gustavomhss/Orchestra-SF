import assert from "node:assert/strict"
import test from "node:test"
import { selectCacheSource } from "./cache-source.mjs"

const sha = "a".repeat(40)
const promoted = "b".repeat(40)
const push = { eventName: "push", defaultBranch: "dev", refName: "dev", sha, changedPaths: ["bun.lock"] }
const promotion = { schema: 1, sourceRef: "sf-join-four", sourceSha: promoted }
const changedPaths = [".github/sf-cache-source.json"]

test("ordinary dependency pushes warm their own exact default source", () => {
  assert.deepEqual(selectCacheSource({ ...push, promotion }),
    { sourceRef: "dev", sourceSha: sha, reason: "default-push" })
})
test("only a changed promotion file selects the reviewed integration SHA", () => {
  assert.deepEqual(selectCacheSource({ ...push, changedPaths, promotion }),
    { sourceRef: "sf-join-four", sourceSha: promoted, reason: "reviewed-promotion" })
})
test("manual refresh uses explicit input and ignores a stored promotion", () => {
  assert.deepEqual(selectCacheSource({ ...push, eventName: "workflow_dispatch",
    dispatchRef: "close-final-candidate", dispatchSha: promoted, promotion }),
    { sourceRef: "close-final-candidate", sourceSha: promoted, reason: "manual-reviewed-source" })
})
for (const eventName of ["pull_request", "pull_request_target", "workflow_run", "schedule"]) {
  test("rejects unadmitted event " + eventName, () => {
    assert.throws(() => selectCacheSource({ ...push, eventName }), /EVENT_NOT_ADMITTED/)
  })
}
for (const input of [
  { refName: "sf-join-four" }, { defaultBranch: "main" }, { sha: "HEAD" },
  { sha: "0".repeat(40) }, { changedPaths: undefined }, { changedPaths: [null] },
]) {
  test("rejects invalid writer context " + JSON.stringify(input), () => {
    assert.throws(() => selectCacheSource({ ...push, ...input }), /SF_CACHE_/)
  })
}
for (const invalid of [
  undefined, [], {}, { ...promotion, schema: 2 }, { ...promotion, sourceRef: "ci-run-linux-unreviewed" },
  { ...promotion, sourceSha: "sf-join-four" }, { ...promotion, sourceSha: "0".repeat(40) },
  { ...promotion, extra: true },
]) {
  test("rejects malformed or unadmitted promotion " + JSON.stringify(invalid), () => {
    assert.throws(() => selectCacheSource({ ...push, changedPaths, promotion: invalid }), /SF_CACHE_/)
  })
}
test("manual source is required and never silently falls back to default", () => {
  assert.throws(() => selectCacheSource({ ...push, eventName: "workflow_dispatch" }), /SF_CACHE_/)
})
