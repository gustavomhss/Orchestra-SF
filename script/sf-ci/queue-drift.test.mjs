import assert from "node:assert/strict"
import { test } from "node:test"
import { diffQueues, driftLines, hasDrift, validateSnapshot } from "./queue-lib.mjs"

const sha = char => char.repeat(40)
const pr = (number, headRefOid = sha("a")) => ({
  number, headRefOid, headRefName: `feature-${number}`, baseRefName: "close-final-candidate",
  isDraft: true, labels: [],
})

test("new PRs are detected, even when the input arrays are unordered", () => {
  const result = diffQueues([pr(7)], [pr(9), pr(7), pr(8)])
  assert.deepEqual(result.newPrs.map(x => x.number), [8, 9])
  assert.deepEqual(result.closedPrs, [])
  assert.equal(hasDrift(result), true)
  assert.match(driftLines(result).join("\n"), /NEW_PR #8/)
})

test("closed PRs retain the frozen head identity", () => {
  const result = diffQueues([pr(4), pr(3)], [pr(4)])
  assert.deepEqual(result.closedPrs.map(x => x.number), [3])
  assert.equal(result.closedPrs[0].headRefOid, sha("a"))
  assert.match(driftLines(result).join("\n"), /CLOSED_PR #3/)
})

test("head-SHA movements carry both the frozen and live SHAs", () => {
  const result = diffQueues([pr(21, sha("a"))], [pr(21, sha("b"))])
  assert.deepEqual(result.movedPrs, [{ number: 21, headRefName: "feature-21",
    from: sha("a"), to: sha("b") }])
  assert.match(driftLines(result)[0], /HEAD_MOVED #21/)
})

test("unchanged PR heads pass even after harmless label changes", () => {
  const labeled = { ...pr(11), labels: ["consolidation-frozen"] }
  const result = diffQueues([pr(11), pr(2)], [labeled, pr(2)])
  assert.deepEqual(result.unchangedPrs.map(x => x.number), [2, 11])
  assert.equal(hasDrift(result), false)
  assert.deepEqual(driftLines(result), [])
})

test("all drift classes are reported together, without hiding unchanged PRs", () => {
  const result = diffQueues([pr(1), pr(2), pr(3)], [pr(1), pr(3, sha("c")), pr(4)])
  assert.deepEqual([result.newPrs.length, result.closedPrs.length,
    result.movedPrs.length, result.unchangedPrs.length], [1, 1, 1, 1])
})

test("malformed and duplicate records fail closed", () => {
  assert.throws(() => diffQueues([pr(1), pr(1)], []), /DUPLICATE_PR/)
  assert.throws(() => diffQueues([], [{ ...pr(1), headRefOid: "bad" }]), /INVALID_HEAD_SHA/)
  assert.throws(() => diffQueues([], [{ ...pr(1), labels: undefined }]), /INVALID_LABELS/)
  assert.throws(() => validateSnapshot({ capturedAt: "not-a-date", prs: [] }), /INVALID_SNAPSHOT/)
  assert.throws(() => validateSnapshot({ capturedAt: new Date().toISOString(), prs: [pr(2), pr(1)] }), /sorted/)
})
