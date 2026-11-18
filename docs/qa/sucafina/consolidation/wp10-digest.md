# WP10 `refDigest` mismatches

Verdict: neither side of the digest contract is wrong. Do not replace the expected digests with the received ones, and do not edit the digest producer.

## Evidence

Cited run [44329483839](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44329483839), job `sf/test-CI-SF-2`, artifact `sf-shard-failure-CI-SF-2`. Tested SHA `2e5839eebb859969851b81aaa29f4f71b4c49d71`. The failure map on `origin/sf-failure-map` `2f30a186fb` records the same six first-line pairs. This note was written on `origin/sf-red-clusters` `5689525935eafd4d65b9d5c0530015f8ac3a6d0e`. `bi-call-scope.test.ts` and `product/contracts/canonical.ts` are unchanged between the tested SHA and that base.

All six failures are the same assertion, one per test, at `modules/sucafina/Sucafinav1/test/product/wp10/integration/bi-call-scope.test.ts:114`:

```ts
expect(alternative.result.costCoverage).toEqual({
  ...classifications[index]!.assessment,
  alternativeId: alternative.id,
  alternativeVersion: alternative.version,
})
```

The test file has no expected hash literals. Both sides are runtime objects. In the Jest/Bun diff, `-` is the human coverage assessment and `+` is `alternative.result.costCoverage`.

## What the diff actually shows

The first case (`bi-call-scope-identity`) differs by ten lines. Those lines swap the same two `planner-version` evidence refs:

| side | recordId | projectionDigest | refDigest |
| --- | --- | --- | --- |
| assessment first, coverage second | `bi-v1` | `327061da0096b6fd78b6f553299b1d35e537b7fab1301ececdcac1f16559f224` | `9f68b6ee55bffca18d8fca1aeb81c9b14479072e39d2cab54612eded2e87d0fa` |
| assessment second, coverage first | `bi-v0` | `fa68368f19b55d15e06503fd1266f798e3dc7a0026250ad30ce5a07acf1002e5` | `3f52cf7835721c1ded13d2c1eb71c096bc20bff3d579096f4ec0f3ddd1c3f623` |

`refId` and `incarnation` move with `recordId`. The other five cases repeat that swap with new incarnations, so their `refDigest` values differ, but each run uses the same digest on both sides of the pair. `projectionDigest` does not move: every case has `fa68368f…` on `bi-v0` and `327061da…` on `bi-v1`.

A dropped digest field would change the hash of one object while `recordId`, `incarnation`, and `projectionDigest` stayed equal. That is not this diff. `digestSfEvidenceRef` excludes only `refDigest` and hashes the rest. Both hashes here match their own identity fields. The received digest is the digest of the other source, not a stale recomputation of the expected source.

## Not changed

Ordering of evaluated source refs, and whether promotion should preserve assessment order, is a separate question. The logged diff does not prove which order is the contract. `analysis-http.ts` and `personal-views.ts` were not edited. No `bun test`, Playwright, `bun run test:ci`, or new workflow was run.
