# Context integrity attempt 02 — targeted follow-up passes

The three selected follow-up gates passed: **guardrails, all seven UI context-integrity cases, and the Sucafina package typecheck**. The wrapper reported **3 pass / 0 fail**. The previously failing getter subcase now executes its original assertions, and the existing LocalStore test type error is corrected.

Together with the passing CLI, e2e and original composition gates from [attempt 01](../attempt-01/README.md), there is passing evidence for all six selected verification gates. **Attempt 01 remains a global failure** with its original 4 pass / 2 fail result. The six gates were not rerun together in attempt 02.

The product comparison between the two attempts contains exactly two test-file changes and **no production-file changes**. This supports combining the stated verification evidence. It does not establish installed UI completion or a causal performance gain.

## Exact execution

- Product: [`e4cc03bb3fa6deaed5c66f0050ffebf878dfef5d`](https://github.com/gustavomhss/Orchestra-SF/commit/e4cc03bb3fa6deaed5c66f0050ffebf878dfef5d), tree `1ed3cafc973db7f4103646c3f0fa06c1586a9ff5`.
- Snapshot: [`d24f52d7c36d300e8d543a156da57154d7bd9b69`](https://github.com/gustavomhss/Orchestra-SF/commit/d24f52d7c36d300e8d543a156da57154d7bd9b69), tree `16e616f6fad99fe0b0f539995717a75ec4e4909b`.
- [Run 45029061059](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45029061059), test job `137228382586`: **success**. Cleanup `137228762050`: **success**.
- Branch `ci-run-sf5context2`, workflow attempt 1, existing `test-ci`, `ubuntu-24.04`, `prod` + `strict`.
- The wrapper remains exactly `f28bdc1b08fe74eeb7937c1b1fd2fe948677c413`. The request is `e5d89e2b4d287cec178def3e28003f7a9dc7aeca`, selecting `guardrails|immutable UI context integrity|Sucafina package typecheck`.
- Original command/gate limits remain unchanged: context test **120,000 / 180,000 ms**, Sucafina typecheck **240,000 / 300,000 ms**, request Bun timeout **360,000 ms**. No test-specific deadline was added.
- No artifacts or screenshots were emitted. The [completed job](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45029061059/job/137228382586) is the original log source. Raw logs are not committed.

## Two test corrections, identical production

The [exact product compare](https://github.com/gustavomhss/Orchestra-SF/compare/62b66c502640d31d35cae31ef354101aa9b25d81...e4cc03bb3fa6deaed5c66f0050ffebf878dfef5d) contains only:

| Test correction | Exact change | Preserved behavior |
| --- | --- | --- |
| CryptoHasher update-getter subcase | Commit `58126990696aa8c2ba5e59cc6192887dd4a30919` places a configurable own `update` getter on a real hasher instance returned by a temporary constructor proxy. | It removes the instance shadow, returns the original native update method, applies/restores the same transient serializer hook and retains the original capture/current assertions. It no longer attempts to redefine the native non-configurable prototype property. |
| LocalStore assertion type | Commit `e4cc03bb3fa6deaed5c66f0050ffebf878dfef5d` adds `expect<Snapshot | undefined>`. | The callback, returned snapshot, optional `currentSnapshot` call and `toEqual` comparison are unchanged. This corrects the assertion overload without changing its runtime comparison. |

The resulting blobs are `51dc68c5e4dced64641e265344aa3099e1301946` for `ui-context-integrity.test.ts` and `e9a1f32896f8094edaf71a519430c9dc0c70f8f4` for `local-store.test.ts`. All production files remain byte-identical to attempt 01.

## Observed results

| Selected gate | Result |
| --- | --- |
| Guardrails | 78 rules, 731 files, 36 warnings, zero gate findings, errors or approvals; exit 0 |
| UI context integrity | **7 pass / 0 fail / 100 assertions**, one file, reported child duration **31 ms** |
| Sucafina package typecheck | **Pass**, exit 0, no diagnostics |

The wrapper reported **3 pass / 0 fail / 7 wrapper assertions** in **19.14 seconds**. Every recorded command has `stdoutTruncated: false` and `stderrTruncated: false`.

The corrected integrity test still has the same seven cases, now 294 source lines. Its previously blocked update-getter assertions are reached; the child assertion count increases from 96 to 100. The original transient-constructor, opaque-context, live-authority, serializer, native-hasher and private-integrity cases also pass.

[guard-report.json](guard-report.json) is the original parsed report from this run. It is JSON-identical to the attempt-01 report, including all 36 warning findings. The pinned base is `d3ccea42b5f8409c8d6c68e4909f7b868b50322c`, with `bootstrap: false`, `touchesGuards: false`, no errors and no approved exceptions.

[receipt.json](receipt.json) records exact source identities, commands, case results, deadlines, both test fixes and the evidence mapping below.

## Evidence across the two attempts

| Verification gate | Passing evidence |
| --- | --- |
| Guardrails from the exact dev base | Attempt 02, run `45029061059` |
| Permanent app-shell e2e typecheck | Attempt 01, run `45028131990` |
| CLI package typecheck | Attempt 01, run `45028131990` |
| Original LocalStore / CurrentChoice / C17 / Finance composition | Attempt 01, run `45028131990` |
| UI context integrity | Attempt 02, run `45029061059` |
| Sucafina package typecheck | Attempt 02, run `45029061059` |

The first complete original C17 observation remains documented only in [attempt-01/phase-events.json](../attempt-01/phase-events.json). Attempt 02 does not rerun the original composition group or emit C17 phase/ancestry events, and this archive does not duplicate those phases.

The historical attempt-01 failure is preserved. The passing evidence above is scoped to the six selected verification gates across identical production code and the two documented test corrections. Installed Portfolio and Sensitivity journeys are outside this follow-up; no result is inferred for them. UI42–UI44 remain pending here, with 12/15 qualified surfaces and 41 accepted/merged unchanged.

This append changes only the three new attempt-02 QA files on `sf-context-qa`. That archival branch retains its original product base `62b66c5`; the corrected tested product is referenced by the exact `e4cc03b` / `d24f52d` SHAs above. The archive does not copy test fixes into the QA branch, modify runtime or prior evidence, or start another CI execution.
