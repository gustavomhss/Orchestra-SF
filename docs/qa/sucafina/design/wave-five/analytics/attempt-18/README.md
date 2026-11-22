# Attempt 18 — Portfolio21 authority and storage diagnostic

**Outcome: FAILED at the original 60-second first-preview wait.** This is a partial installed diagnostic, not a completed Portfolio journey. The full original preparation passed, both native history responses were acquired as HTTP 200/ok, and the single native preview had no observed response before the original timeout. The five periodic profile snapshots were complete. No final profile snapshot or completed preview was observed.

No UI42–44 qualification is added. The wave remains **12/15**, with **41** previously approved inventory areas. Existing UI45/46 qualification is unchanged.

## Immutable receipt

| Item | Evidence |
| --- | --- |
| Product source | `82076e542b03825ca9cbfb21dae4a86fabd0ca88` |
| Product runtime | `2d3abae061c9d4be188540433b9d34c4bfaf2b24` |
| Diagnostic snapshot | `27499e0b3f81bed868dfe2d4724b295fd5aab9c6` |
| Snapshot tree | `34e6570e08faa0333bc521cd393b0789cbf2909c` |
| Immediate parent | `cad315298856419c6da18f561e593688d38ec982` — Portfolio20 |
| Execution | [test-ci run 45019357466](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45019357466), attempt 1, branch `ci-run-sf5portfolio21` |
| Test job | [137198592243](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45019357466/job/137198592243) — FAILURE |
| Cleanup job | [137201120833](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45019357466/job/137201120833) — SUCCESS |
| Artifact | [14753253173](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45019357466/artifacts/14753253173), 8,833,654 bytes |
| Artifact digest | `sha256:2c166412fee28288196c58b2d0633c366e218bf711ccb976c4ab15ce18500008` |

Root created the single CI ref after the complete preflight. The request, production Playwright configuration, strict Omni and production-channel flags, source helper, capture helper and original wave-four seed remained exact. The diagnostic declaration retains the original body through its first conditioned-preview capture, with the original 780-second test budget, 20-second default and **60-second preview waiter**. It ends before a second preview or explicit evaluation. The planned conditioned-preview capture was not reached.

The snapshot has 14 overlay paths against product source and nine deltas against Portfolio20. It restores the original `planner-calculation-read-scope.ts`, `source-fence-read.ts` and `scenario-operation-access.ts` bodies, while adding focused SourceLife, LocalStore/Choice, authority, Finance and canonical measurements. The helper `81792fc1fba96de5b4cc0b93a2213862a2d2bc2a` remains identical to Portfolio20; its limits remain 256 buckets, 2,048 records and five periodic observations. The preflight estimate was 248 buckets; the run observed 122. The original RAW-only query remains unchanged, and the separate line-619 candidate was not included or executed.

[manifest.json](manifest.json) records every overlay SHA, preserved helper, limit, job and image. [profile.json](profile.json) preserves the 625 original profiler records; [aggregates.json](aggregates.json) retains all five summaries, integrity checks, the 122 last-snapshot rows and root markers. [source-events.json](source-events.json) preserves 24 source events, two context events, six capture-metadata events, 46 fixture stages and three diagnostics. No raw job transcript is committed.

## Original source progression and first failure

The existing helper `581ac6c7f506c9ef7e46c633e70139edebddcfdd` completed the same original source preparation: parameter promotion, two A04 units reads, one human criterion registration with observed version 1→2, exact units/case readback, and original portfolio selection at version 1 for case version 6. The exact original alternative pair, required criterion and unchanged current comparison were confirmed by the original readbacks.

| Original operation | Observed outcome | Logged duration |
| --- | --- | ---: |
| Criterion registration | HTTP 200 / ok | 1,742 ms |
| Canonical comparison before selection | HTTP 200 / ok | 74,551 ms |
| Portfolio selection registration | HTTP 200 / ok | 55,024 ms |
| Canonical comparison after selection | HTTP 200 / ok | 70,776 ms |
| Native history, sequence 1 | HTTP 200 / ok, body acquired | 529 ms |
| Native history, sequence 2 | HTTP 200 / ok, body acquired | 1,064 ms |
| Native preview, sequence 3 | Request observed; no response/status/body observed | Original waiter failed at 60,000 ms |

The native preview request was logged at **2026-11-22T12:00:40.9091417Z**. The original `page.waitForResponse` at spec line 72 timed out after 60,000 ms. The failure hook ran at 12:01:40.8925562Z and page closure was recorded at 12:01:41.6978630Z. Those are logger timestamps from separate observers, not a replacement request-duration measurement.

There was no second preview, explicit portfolio evaluation, native UI43 result, native UI44 evaluation or result localization. The original preview can perform internal persistence; without its response, that internal outcome remains unknown. No earlier attempt's 403 or other source refusal is attributed to this run. The failure and close diagnostics report empty page-error and console-error arrays, but the full-journey footer was not reached.

## Profile completeness and interpretation

The completed test log contains **625 valid profiler records with no parse errors**: one start, nine root markers, 610 bucket rows and five periodic summaries. Every periodic sample has exactly 122 unique rows; every row satisfies `calls = settled + pending`, and each row-pending sum equals its summary.

| Sample | Due ms | Observed elapsed ms | Unique buckets | Pending spans | Drops / errors / skipped thresholds |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 10,000 | 10,000 | 122 | 6 | 0 |
| 2 | 20,000 | 20,000 | 122 | 9 | 0 |
| 3 | 30,000 | 30,000 | 122 | 8 | 0 |
| 4 | 40,000 | 40,000 | 122 | 9 | 0 |
| 5 | 50,000 | 50,015 | 122 | 4 | 0 |

Every periodic summary was emitted at a **settled-span** checkpoint. No timer-triggered or final summary was observed. The last sample is cumulative at **50,015 ms**, before request completion, with four pending spans: HTTP preview, dashboard transaction ingress, physical-root callback and Finance work.

Five physical-root entries and four callback exits were observed. Their completed callback intervals are 7,257–23,373; 23,379–23,556; 26,945–42,918; and 42,923–43,117 ms. The fifth begins at 47,042 ms and has no observed callback exit. These markers describe the original callback boundaries, not final acceptance by the enclosing provider.

### Selected exact rows from the last sample

The following table is an index into the complete aggregates, not an exclusive-time decomposition. All rows below have origin `none`; narrower query-origin populations are retained separately in the JSON.

| Boundary | Calls | Settled | Pending | Settled inclusive ms |
| --- | ---: | ---: | ---: | ---: |
| canonical.digest.total | 748,497 | 748,497 | 0 | 15,457 |
| authority.principal.total | 33,687 | 33,687 | 0 | 14,058 |
| local.file.lstat | 1,934,412 | 1,934,412 | 0 | 5,788 |
| local.scope.require | 1,153,681 | 1,153,681 | 0 | 4,422 |
| local.snapshot.materialize | 12,937 | 12,937 | 0 | 3,005 |
| planner-evidence.source1 (Planner) | 1,502 | 1,502 | 0 | 7,883 |
| planner-evidence.source2 (Planner) | 1,502 | 1,502 | 0 | 7,833 |
| source.observe.full-before (Planner) | 1,036 | 1,036 | 0 | 239 |
| source.observe.full-after (Planner) | 1,036 | 1,036 | 0 | 200 |
| source.observe.source-identity (Planner) | 7,062 | 7,062 | 0 | 164 |
| source.observe.projection-digest-return (Planner) | 7,062 | 7,062 | 0 | 354 |
| source.scoped.finish (Planner) | 7,062 | 7,062 | 0 | 558 |
| finance.witness | 7 | 7 | 0 | 1,318 |
| finance.work | 3 | 2 | 1 | 31,324 |

The SourceLife identity row includes whichever original identity helper the source-root condition selected, including its existing metadata validation. The two full-snapshot rows execute only in the original no-ACL branches. The projection-return row includes return-object assembly. The scoped-finish row starts after successful observe and includes the original identity/clone or materialization branch; it stops before the enclosing provider's later egress.

The LocalStore ingress timers distinguish operation queue/SQL admission from transaction snapshot preparation. Transaction egress and operation cleanup include rejected callbacks; their completion does not prove commit. The `all` surface combines the original transactionAll and readSnapshotRoot paths. Finance work covers only work inside the admitted grouped branch, while the original fallback work paths are outside that timer. Authority principal includes concurrent surface observations and derived checks; those are not disjoint durations.

**Do not add cumulative snapshots, sum nested parents and children, or subtract rows with different call populations to infer an exclusive residual.** Inclusive milliseconds contain settled spans only and omit the active pending work. Instrumentation coverage changed between Portfolio20 and21; changes in observed counts or elapsed progress do not alone establish a product regression, gain or causal attribution. This archive records evidence and does not prescribe an optimization.

## Actual visual review

All seven original JPEGs were actually viewed and then verified byte-for-byte through the repository readback. They total **536,797 bytes** from **33 original chunks**, without regeneration or resampling.

| Capture | Review and limit |
| --- | --- |
| [Dark desktop list](gallery/UI42-list-dark-desktop-test-data.jpg) | Two authorized cards, original versions and Open case actions remain readable. |
| [Light desktop list](gallery/UI42-list-light-desktop-test-data.jpg) | The same source cases and actions remain readable in the native light treatment. |
| [Dark 390 px list](gallery/UI42-list-dark-390-test-data.jpg) | Cards stack, long titles wrap and both actions remain within the viewport. |
| [Light 320 px list](gallery/UI42-list-light-320-test-data.jpg) | Narrow cards, Context access, versions and actions fit without visible horizontal clipping. |
| [Empty authorized case](gallery/UI42-empty-authorized-case-test-data.jpg) | No eligible scenario and no recorded result remain explicit; Preview is disabled. |
| [Focused candidate configuration](gallery/UI42-configure-focused-candidate-test-data.jpg) | One original candidate and the v2 constraint are selected; limit 4 has a visible focus outline. No result is displayed. |
| [Failure state](gallery/FAILED-native-wave-three-test-data.jpg) | Running, disabled controls, unavailable-preview skeleton and empty history. No source-refusal or connection banner appears. Failure evidence only. |

The conditioned-preview capture was not reached. These readable list/configuration states do not qualify the complete UI42 flow or UI43/UI44. There was no replay, extended observation, automatic rerun, product integration or workflow change.
