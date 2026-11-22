# Sensitivity upstream regressions — four original tests pass

The isolated candidate's unchanged regression files passed **4 tests across 2 files, with 105 assertions and 0 failures** in the existing production/strict Linux runner. The result verifies sampled classification, durable reread, an exact bound for assessed components, and publication only after final authorization in the native composition.

The separate installed UI44 journey still times out at its original 120-second response wait. Its [receipt and original images](../../collab/sensitivity-isolated-02/README.md) remain partial evidence; the regression result does not qualify that UI journey.

## Exact source and execution

- Product candidate: [`0de8e697838f9083ceaadbc2b16abee14640d230`](https://github.com/gustavomhss/Orchestra-SF/commit/0de8e697838f9083ceaadbc2b16abee14640d230), parent `9341bc3d25f5771009258b58c91c0fe85cb093ae`.
- Literal upstream changes: [#641](https://github.com/gustavomhss/Orchestra-SF/pull/641) and [#643](https://github.com/gustavomhss/Orchestra-SF/pull/643), five files including their original tests and fixture. Exact blobs are in [receipt.json](receipt.json).
- Snapshot: [`1356f842ba1fd6ea0277abe85168f3d6a1121447`](https://github.com/gustavomhss/Orchestra-SF/commit/1356f842ba1fd6ea0277abe85168f3d6a1121447), tree `d59873ed5f5b53094942942c2047bff0541a71ff`.
- Only snapshot addition: `.ci-run.json`, blob `0e91f176adaefc72b7a37780e607fd15edfd0180`. The existing Bun runner received both original test paths directly; no wrapper or timeout argument was added.
- [Run 45025494458](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45025494458), test job `137217498463`: **success**. Cleanup `137221162527`: **success**. Attempt 1, push event; no replay.
- Existing `test-ci`, `ubuntu-24.04`, `ORCHESTRA_CHANNEL=prod`, `ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER=strict`. Reported test duration: **772.65 seconds**.
- No artifact was emitted by this Bun run. The original [completed job](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45025494458/job/137217498463) is linked; only curated receipts and phase events are committed.

## What the four tests establish

| Original test | Result | Runtime | Preserved deadline |
| --- | --- | ---: | ---: |
| Pending component classification | Sampled evidence; exact threshold remains null; native persistence and cold reread match | 231.09818 s | 285 s composition / 300 s Bun |
| Partial component classification | Same sampled and durable guarantees with partially assessed components | 236.17912 s | 285 s composition / 300 s Bun |
| Fully assessed known components | Exact threshold lies in [100,101), distinct from the sampled parameter values; training remains pending | 82.41651 s | 105 s composition / 120 s Bun |
| Unscoped publication and late mutation | Grant appears only after final authorization; rejected attempts and late mutations invalidate/prevent it | 222.38235 s | 285 s composition / 300 s Bun |

The pending and partial tests preserve exactly the sampled pairs `[80, -20]` and `[120, 20]`, the conditioned comparison and unresolved training condition. Both save through the native HTTP service, recompose a new portfolio proof verifier and reread the identical stored result. Durable cases remain unchanged, exactly one matching sensitivity record is present, and choices/prepared changes remain empty.

The fully assessed test proves that actual exact solving remains available for known assessed components even while training is pending. The returned bound is not merely one of the two sample points; the result retains the training and known-subtotal conditions.

The publication test verifies that no snapshot grant is visible during authorization callbacks, that it becomes visible after successful final authorization, and that a new rejected attempt invalidates the prior grant immediately. Late mutation of the borrowed stored request digest and late mutation of binding bounds each produce a rejection and no grant. The test also verifies unchanged durable state/digests and rejection of a read after authority revocation.

## Observed performance boundary

[phase-events.json](phase-events.json) preserves 30 original composition phase events and two successful persistence events. All recorded returned phases report `aborted: false`.

| Native composition phase | Observed duration |
| --- | ---: |
| Pending: native persist | 146,373 ms |
| Partial: native persist | 148,926 ms |
| Publication: native persist | 149,228 ms |
| Pending: cold read | 44,665 ms |
| Partial: cold read | 44,796 ms |

These measurements come from the regression fixtures. They do not establish the cause of the installed UI44 timeout or a performance equivalence between fixtures. They also do not support a claim that a 120-second installed response gate has been met.

This run covers exactly the two specified files. It does not include Finance pair observation, C17, a guard suite, typecheck, the complete product suite or installed UI44 qualification. No deadline, assertion, fixture source or authority rule was relaxed, and no acceptance or merge total changes.
