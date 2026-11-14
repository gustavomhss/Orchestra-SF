# Independent static review — Hot Topic source-race fixture

**Verdict: no static blocker for the exact candidate below. Runtime validation remains pending in GitHub Actions.**

Reviewer: `/root/hot_topic_s18_command_review`.

## Exact scope

- Product baseline: `29172d2e4db859eedac31e84778c447bb97f6c08` (W28), tree `8d7a7657597d024c5a55a9f5a4fdccf604c40d25`.
- Reviewed path: `modules/sucafina/Sucafinav1/test/product/wp11/hot-topic-snapshot.test.ts`.
- Published blob: `a45ca2e3e8efd8b39f53a94615cdad1064d8fe6b`.
- Candidate blob: `9a60848e9a050ffc6690cd484ce12b2d0cd2e9c8`.
- Candidate SHA256: `a4d6b16de09e9417ddba996dc1077c6daf831c2378710b80a85714b54328124e`; 20365 bytes.
- Baseline comparison uses the frozen W28 publication capture; producer bytes were independently hashed against the published remote-state manifest.

The complete diff is two line replacements: seed status `Open` becomes canonical `open`, and a failing canonical command is included in the fixture error message. The six expanded test cases, all 52 literal `expect` calls, hook timing, initialization sequence and timeout behavior are unchanged. No source producer was edited.

## Cause and preserved behavior

`DashboardPeople.saveRecord` merges defaults, stored fields, then command fields. The source-race command updates only `notes`, so the original stored `Open` survives. Its canonical enum accepts only `open`, `progress`, `blocked` and `done`; that path returns 422 before writing the record or audit. The hook then throws, and `register` catches the error before calling `verifySnapshot`. This explains the empty snapshot list in S18.

This is a direct static inference from the exact command path. S18 did **not** log a 422 response. The observed evidence is run `43593276333`, job `132442336638`, with five Hot Topic cases passing and the source-race case failing because `["dashboard"]` was expected and `[]` was received. It is not evidence that the candidate passes.

The lowercase seed repairs the invalid fixture input while retaining the real canonical Dashboard edit and all existing oracles: one Dashboard snapshot must be checked; official notes and audit must reflect the concurrent edit; no draft/private write or receipt may occur; Planner stays unchanged. The case/authority races and draft replacement during final source/case callbacks are untouched.

The expanded error message is harmless but still caught by `register`; it does not change the external result or independently expose the cause.

## Producer pins checked unchanged

| Source | Blob |
| --- | --- |
| `modules/sucafina/Sucafinav1/runtime/dashboard-people.ts` | `de499e6d34af826add34bee4125bcfba4e57ddb8` |
| `modules/sucafina/Sucafinav1/runtime/contract.ts` | `b62fce6f0fb0845dbfd18cc94009c33f1586b9c5` |
| `modules/sucafina/Sucafinav1/product/decisions/hot-topic-draft.ts` | `d8a151c558227b3bd2612dbb6caba993efa85783` |
| `modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts` | `b7988a2963a2797a96ea19ab2b3a481564548213` |
| `modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts` | `d0cab7f33b08806a6bb01a869fa789dc77e087ee` |

## Validation limits

No product code, imports, Bun, tests, CI, native runtime or remote mutation was executed by this review. Python was used only to read files, compare exact text and compute hashes. The actual concurrent source invalidation, final snapshot rejection and all six cases must still run in Actions on the published candidate. This review grants no installed native proof, C/D acceptance, integration qualification, READY or DONE status.
