# Attempt 17 — Portfolio20 bounded readonly samples

**Outcome: FAILED at the unchanged 60-second preview wait. Five complete periodic samples were acquired through 50 seconds; the request's final outcome was not observed.** The last sample has four pending spans. These data show the installed readonly bridge and source-fence memo in use. They do not support treating the remaining raw-only guard lookup as the dominant cost.

This is a partial diagnostic, not a completed UI journey. UI42–44 remain pending; the wave remains **12/15**, with **41** accepted areas.

## Immutable receipt

| Item | Receipt |
| --- | --- |
| Product/QA source | `82076e542b03825ca9cbfb21dae4a86fabd0ca88` |
| Runtime | `2d3abae061c9d4be188540433b9d34c4bfaf2b24` |
| Snapshot | `cad315298856419c6da18f561e593688d38ec982` |
| Tree | `9c19365f035a5d306f927e4fb43248a8f5fc533e` |
| [Run 45015314625](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45015314625) | Existing test-ci, attempt 1, strict Omni and production channel |
| [Test 137186259049](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45015314625/job/137186259049) | FAILURE |
| [Cleanup 137188589158](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45015314625/job/137188589158) | SUCCESS |
| [Artifact 14751976530](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45015314625/artifacts/14751976530) | 8,835,915 bytes |
| Artifact digest | `sha256:cb49658a2078ecd3d0b6b6f29bc8a3193818eb44f91dd4569afad3b8563b8a23` |

Root created one branch, `ci-run-sf5portfolio20`, after preflight and peer review. Against Diagnostic19, the only change is collector `81792fc1`: it also checkpoints at the end of existing diagnostic spans, reusing the timestamp already read there. Timer and span checkpoints share the five thresholds and explicitly report any skipped threshold. No domain query, provider, callback, grant, lease or permanent budget changes.

The other 13 overlays remain exact, including the raw-only source-lifecycle query at original line 619. Permanent spec `f4eb9a5` is preserved through line 84, with its title changed only to identify the diagnostic. Preparation `581ac6c`, capture helper `ebbab2a`, seed `32b3993`, config `9724c94` and request `a119228` are unchanged. The [manifest](manifest.json) contains every blob and the preflight details. All diagnostic overlays remain excluded from product.

## Original operation and stopping point

The full original preparation passed: two A04 unit reads around an explicit criterion registration, case version 6, criterion version 2 and human portfolio selection version 1. The exact units, alternative pair, criteria and comparison readbacks matched.

| Operation | Original observation |
| --- | --- |
| Criterion registration | 200/ok, 1,428 ms |
| First comparison | 200/ok, 60,126 ms |
| Selection registration | 200/ok, 40,406 ms |
| Second comparison | 200/ok, 60,338 ms |
| Native history sequence 1 | 200/ok, 448 ms |
| Native history sequence 2 | 200/ok, 780 ms |
| Native preview sequence 3 | One original POST; request record at 11:10:18.6021079 UTC; no observed response before the original wait failed |

Both history bodies were acquired in this run. The body-unavailable limitation from Diagnostic19 is not copied into this receipt. Source timings are observations from this isolated installation; their differences from previous attempts do not establish a speedup.

The unchanged first-preview wait failed at line 72 after 60,000 ms. The failure hook ran at 11:11:18.6400177 UTC and the page closed at 11:11:19.1822937 UTC. No second preview, explicit evaluation, result detail or native sensitivity action was reached. Internal persistence is unknown because the original preview can perform internal persistence. No later status from another attempt is substituted.

[Source events](source-events.json) preserve 24 original source observations, two authenticated context observations, six capture declarations, 46 fixture stage markers and the failure-hook diagnostics. The error arrays were empty at the hook; the full journey footer was not reached.

## Sampling integrity and limits

The [profile](profile.json) preserves all **533** parsed records: one start, 17 root markers, 510 bucket rows and five periodic summaries, with zero parse errors.

| Sample | Due ms | Actual elapsed ms | Trigger | Unique buckets | Pending spans |
| --- | ---: | ---: | --- | ---: | ---: |
| 1 | 10,000 | 10,002 | Settled span | 102 | 2 |
| 2 | 20,000 | 20,001 | Settled span | 102 | 2 |
| 3 | 30,000 | 30,001 | Settled span | 102 | 6 |
| 4 | 40,000 | 40,001 | Settled span | 102 | 2 |
| 5 | 50,000 | 50,000 | Settled span | 102 | 4 |

Every sample contains exactly its declared bucket count, every bucket satisfies calls = settled + pending, and the summed pending entries match the summary. All five report zero skipped thresholds, bucket/root/line drops and diagnostic errors. No timer-triggered or final snapshot was observed.

The [last-sample aggregates](aggregates.json) select sample 5 once. Its four pending spans are HTTP preview, operations.total, operations.source.before and root.physical.callback. Inclusive milliseconds contain **settled spans only**. A pending HTTP bucket with zero inclusive milliseconds does not mean that the request has consumed no time.

At 50 seconds, seven physical callbacks had entered and six had exited. Later root markers show eight exits and a ninth entry at 58,314 ms; those markers do not update the 50-second bucket sample. Callback exit does not prove the provider's later egress accepted the operation.

## Findings from the last cumulative sample

| Observation | Count or settled inclusive duration |
| --- | --- |
| Raw guard query, original line 619 | 6,568 queries; 6,568 exact-owner registration misses |
| Prepared Planner bridge | 9,065 Choice hits; 1,276 misses with non-readonly roots |
| Prepared ACL branch | 9,064 entries; these are later observation points than the owned-proof counter |
| Generic registered authority bridge | 595 hits; 5,785 misses comprising 5,713 absent scopes and 72 non-readonly roots |
| Source-fence memo | 550 hits, 1 miss |
| Source-fence reads | 531 sealed accepted; 96 original legacy transactionAll paths |
| C08 read-scope probes | None reached in the observed prefix; no memo failure inferred |

The owned-proof, completed-prepare and ACL-entry counters observe distinct sequential boundaries. Do not infer an extra issued ACL or a failed authorization from their one-count difference in a partial sample. Each original callback and current check remains present.

### Guard digests

| Surface | Each digest's calls | sfSources digest ms | Audit digest ms |
| --- | ---: | ---: | ---: |
| Planner | 6,483 | 140 | 447 |
| Dashboard | 277 | 37 | 139 |
| Procurement | 96 | 13 | 175 |

These sequential digest measurements total **951 ms** in the observed prefix. They include paths that are not eligible for the separate line-619 candidate, including the unchanged legacy transactionAll guards. This is not a projected saving. The lookup miss is real, but the measured digest work does not explain the dominant elapsed time. The candidate was neither included nor executed as a consequence of this diagnostic.

### Other measured boundaries

| Boundary | Calls settled at 50 seconds | Inclusive ms |
| --- | ---: | ---: |
| Planner evidence source1 | 2,201 | 7,256 |
| Planner evidence source2 | 2,201 | 7,274 |
| Planner prepared callback, including its original clone | 10,341 | 1,732 |
| Planner source projector, including original clones | 10,340 | 2,074 |
| Planner first authentication | 10,340 | 636 |
| Planner egress gate, retaining its short-circuit | 10,340 | 672 |
| Planner evidence read1 / read2 | 2,201 each | 986 / 955 |
| Planner financial build | 2,201 | 134 |
| Operation fences before / after | 314 / 313 | 968 / 983 |
| Physical-root callbacks | 6 settled; 1 pending | 32,503 |

These rows overlap by call graph and include different call sets. **Do not sum them or subtract them to derive an exclusive residual.** The larger source1/source2 boundaries warrant a source-level account of what lies outside the narrower timers, without removing original callbacks or caching authority/projections. The profile does not identify all remaining cost.

## Actual visual review

All seven original JPEGs were actually viewed and preserved without regeneration or resampling. They total **537,154 bytes** from 33 original chunks. The manifest records their blob identities and remote byte verification.

| Capture | Review and limit |
| --- | --- |
| [Dark desktop list](gallery/UI42-list-dark-desktop-test-data.jpg) | Authorized cards, original versions and actions are readable. |
| [Light desktop list](gallery/UI42-list-light-desktop-test-data.jpg) | Native light treatment remains readable without overlap. |
| [Dark 390 px list](gallery/UI42-list-dark-390-test-data.jpg) | Cards stack, original titles wrap and actions fit. |
| [Light 320 px list](gallery/UI42-list-light-320-test-data.jpg) | Narrow cards, Context access and actions remain inside the viewport. |
| [Empty authorized case](gallery/UI42-empty-authorized-case-test-data.jpg) | No eligible scenario and no recorded result remain explicit; Preview is disabled. |
| [Focused candidate configuration](gallery/UI42-configure-focused-candidate-test-data.jpg) | The original candidate and version-2 criterion are selected; the monthly hypothesis is unselected; limit 4 has visible focus. |
| [Failure state](gallery/FAILED-native-wave-three-test-data.jpg) | Running, disabled inputs, pending-preview skeleton and empty history. No connection banner or result. Diagnostic only. |

The conditioned-preview capture was not reached. No UI42–44 qualification is added. There was no replay, extended observation, automatic rerun or raw transcript committed.
