# Context integrity attempt 01 — C17 completes, verification remains failed

This attempt records the **first complete run of the original C17 ancestry test in this cycle**, under its unchanged 105-second cooperative deadline and 120-second Bun test budget. The original four-file composition group passed. The candidate is **not fully verified**: the new context-integrity test gate and Sucafina package typecheck both failed. The outer wrapper reported **4 pass / 2 fail**.

This is an observed composition result from one run. It does not establish a causal speedup, installed UI completion or reliable deadline margin. UI42, UI43 and UI44 remain pending; the block stays at 12/15 qualified surfaces and the accepted/merged total stays at 41.

## Exact execution

- Product: [`62b66c502640d31d35cae31ef354101aa9b25d81`](https://github.com/gustavomhss/Orchestra-SF/commit/62b66c502640d31d35cae31ef354101aa9b25d81), tree `4e0a85c76ced17ef591a76c4324406b90c1189c0`.
- Snapshot: [`0e62f4e66dc000bddf4f73cbc2bf4de7ffbab7d5`](https://github.com/gustavomhss/Orchestra-SF/commit/0e62f4e66dc000bddf4f73cbc2bf4de7ffbab7d5), tree `69acd0645ee43c2bb5a8968fcfa89d7ea0c14d49`. Its only additions are `.ci-run.json` and the snapshot-only verification wrapper.
- [Run 45028131990](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45028131990), test job `137225529279`: **failure**. Cleanup job `137226797976`: **success**.
- Branch `ci-run-sf5context1`, attempt 1, existing `test-ci`, Linux `ubuntu-24.04`, `ORCHESTRA_CHANNEL=prod` and `ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER=strict`.
- Wrapper blob `f28bdc1b08fe74eeb7937c1b1fd2fe948677c413` preserves the entire original `631a2df11496d14c961c4bd257c085a4494ce437` literally and appends two separate gates. Request blob `07de5f0330f10d5fa4dfbfd3163ef9d6cc7d0765` only adds their names to the original `-t` filter.
- No artifacts or screenshots were emitted. The [completed job](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45028131990/job/137225529279) remains the log source. This archive contains structured evidence, not raw logs.

## Six selected wrapper gates

| Gate | Observed result | Detail |
| --- | --- | --- |
| Guardrails from exact dev base | Pass | 78 rules, 731 files, 36 warnings, zero gate findings, errors or approvals |
| Permanent app-shell e2e typecheck | Pass | Exit 0 |
| CLI package typecheck | Pass | Exit 0 |
| Original LocalStore / CurrentChoice / C17 / Finance group | Pass | 54 pass, 0 fail, 2 skips, 985 assertions; 56 tests across four files |
| New UI context integrity | Fail | 6 pass, 1 fail, 96 assertions; test setup cannot redefine a non-configurable native method as an accessor |
| Sucafina package typecheck | Fail | One TS2769 at the existing LocalStore test assertion |

The complete wrapper reported six selected tests, 10 wrapper assertions and 209.41 seconds. The original composition child reported 160.47 seconds. Both `stdoutTruncated` and `stderrTruncated` were false for every recorded command.

[receipt.json](receipt.json) contains exact commands, source blobs, gate durations and failure boundaries. [guard-report.json](guard-report.json) preserves the original parsed guard report, including all 36 warnings. The pinned base is `d3ccea42b5f8409c8d6c68e4909f7b868b50322c`; `bootstrap` and `touchesGuards` are false. The report has no `gate`-severity findings and no approved exceptions.

## Original C17 and Finance observations

The C17 test reported **102,717.47 ms**. All seven original phases completed with `aborted: false`:

| Original phase | Reported phase duration | Fixture elapsed at return |
| --- | ---: | ---: |
| initialize | 14 ms | 14 ms |
| produce-inner | 1,075 ms | 1,089 ms |
| produce-outer | 73,228 ms | 74,319 ms |
| reopen | 5 ms | 74,325 ms |
| resolve-reopened-ancestry | 27,962 ms | 102,287 ms |
| reject-persisted-cycle | 13 ms | 102,305 ms |
| recovery-and-revocation | 404 ms | 102,711 ms |

The two original ancestry events reported **14/14** canonical result reads/completions for the inner production and **1,952/1,952** for the outer production, both without abort. The test reached reopened ancestry resolution, persisted-cycle rejection, recovery and authority revocation.

The unchanged Finance test reported **50,655.93 ms** and passed its original pair-read, metric, source-change and revocation assertions. The two group skips are the existing foreign-UID directory/database fixtures, which require root privileges.

C17 and Finance retain their original **105,000 ms cooperative / 120,000 ms Bun** budgets. The four-file group retains **300,000 ms command / 360,000 ms wrapper** limits. No timeout, source, assertion or authority condition was changed by this verification snapshot.

### Timestamp interpretation

[phase-events.json](phase-events.json) preserves **14 original composition events covering seven phases**, plus **two original ancestry events**.

The wrapper captures child stdout/stderr and prints them after the process completes. Consequently, the GitHub timestamps clustered around `13:38:12Z` are stored as **`wrapperLogTimestamp`**, separate from the original JSON payloads. They are not phase execution wall-clock timestamps.

For `SF_COMPOSITION_PHASE`, `elapsedMs` is fixture elapsed time and `phaseMs` is the phase duration. For `SF_CALCULATION_ANCESTRY`, `elapsedMs` is that producer interval. These values retain their original meanings; no phase wall-clock timeline or speedup is inferred from the buffered log timestamps.

## New test failure boundary

The new file, blob `0ac9d8249d898fc799ec5dbc312c06906c38f071`, ran seven cases and reported **6 pass / 1 fail / 96 assertions** in 31 ms.

The failed case is “a temporary hasher or update getter cannot attest a capture made under hooks.” Its transient-constructor subcase completed the capture and the two assertions at lines 247–249. The subsequent update-getter setup failed:

> TypeError: Attempting to change access mechanism for an unconfigurable property.

The stack points to `withProperty` at `ui-context-integrity.test.ts:30:3`, called at `255:20`. It attempts to redefine `Bun.CryptoHasher.prototype.update` as an accessor. The error occurs **before** the callback reaches `observeSfUiContextIntegrity` at line 268 in that subcase. Its capture assertions therefore remain untested in this attempt. This is a failing gate, despite the six completed cases and the earlier transient-constructor assertions.

The integrity test runs in its own Bun child process, with **120,000 ms command / 180,000 ms gate** limits. It does not consume the original composition group's budget.

## Sucafina typecheck failure boundary

The package typecheck returned exit 2 and reported one diagnostic:

- `test/local-store.test.ts(211,20): TS2769: No overload matches this call.`
- The assertion receives `Snapshot | undefined` from `store.currentSnapshot?.("planner")`, where its overload expects `Snapshot`.

This is the original LocalStore test blob `b67a3fd90eefc5ebf880528d22be2afcdc25c3c8`. The runtime composition test can pass while its package typecheck fails; neither result replaces the other. The new typecheck gate retains **240,000 ms command / 300,000 ms gate** limits.

No corrected test version or later passing result is included here. This QA archive changes only its four documentation files over product `62b66c5`; it does not modify runtime, tests, main/PR state, aggregate rollups or any CI request.
