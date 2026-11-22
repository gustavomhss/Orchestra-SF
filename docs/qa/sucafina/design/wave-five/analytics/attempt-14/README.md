# Attempt 14 — original source phases, bounded same-request diagnosis

## Outcome

**Failed.** [Run 45002137493](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45002137493), test job `137145783704`, preserved the original 60-second preview assertion. One native preview POST was emitted. The same request subsequently returned HTTP 403 / denied / `decision-authority-changed`; the test rethrew its original timeout. Cleanup job `137149005151` passed.

The original A04 units preparation, one human rule registration, original comparisons, one human portfolio selection registration and their exact readbacks all passed. UI42's authorized list, empty case and selected configuration were captured. This diagnostic reached no portfolio result, sensitivity screen or explicit evaluation submission. It does not qualify the complete UI42 journey, UI43 or UI44.

- Product source: `6acd67a926c664c696df3ae1c0791599ef58e811`.
- Diagnostic snapshot: `9ec17019b555606c5e3a47cf6dd7602ff5f65ac0`; tree `01a8fc6a28b37dd316901eb6253ad3fe7a7cf484`.
- Disposable branch: `ci-run-sf5portfolio17`.
- Existing workflow `.github/workflows/test-ci.yml` and production Playwright configuration; strict omni control and production channel.
- [Canonical artifact 14746593251](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45002137493/artifacts/14746593251): 9,448,788 bytes, `sha256:3eb5b4bf10390ebbb339cb7935c08f8a313b675dec08a6e89e50a0c505bc49fc`.
- [Manifest](manifest.json), [complete profile](profile.json), [aggregates and complete upper intervals](aggregates.json), [read-only source audit](SOURCE-AUDIT.md).

All fifteen snapshot paths and the preflight reviews are recorded in the manifest. The diagnostic overlays are excluded from product. No workflow, permanent budget, source lease, guard, permission or original producer result was altered.

## Original preparation and response boundaries

| Original operation | Observed result | Elapsed time |
| --- | --- | ---: |
| A04 controls with scenario/baseline/parameter | 200 / ok, complete original units | 14,374ms |
| Human criterion registration | 200 / ok, original rule v1 → v2 | 1,449ms |
| Repeated A04 controls | 200 / ok, identical units/case/decision and new rule version | 14,563ms |
| Canonical comparison before selection | 200 / ok | 60,729ms |
| Human portfolio selection | 200 / ok, first selection receipt v1 | 64,644ms |
| Fresh canonical comparison | 200 / ok, selected original pair/criteria unchanged | 62,488ms |
| Empty-case native history | 200 / ok | 449ms |
| Selected-case native history | 200 / ok | 790ms |
| Native preview | One POST; original 60s assertion failed | 60,003ms to failure |
| Same native preview completion | 403 / denied / decision-authority-changed | 300,176ms in the test observer |

The original operation observer recorded 300,092ms for the preview; the profiler's source duration was 300,003ms. These clocks start at different boundaries. The profiler separately recorded 62ms of diagnostic emission. The handler's final authority revalidation can replace the inner result after its five-minute admission expires, so this final response does not identify an inner computation's result.

The preparation uses the existing helper `581ac6c7f506c9ef7e46c633e70139edebddcfdd`. It leaves the earlier wave's seed unchanged, promotes the genuine parameterized scenario, reads original A04 units, registers the existing lte/2000 criterion once with the observed expected rule version and complete units, then checks the original receipt and repeated controls. It subsequently performs the same original portfolio-selection preparation. No external full stored-rule read endpoint exists; the controls readback is not described as one.

The diagnostic helper adds elapsed time only to the two existing A04 response logs. The body before the preview is the same 3,714 characters as the permanent combined declaration. A maximum of 420 seconds observes the same one preview after its original deadline; it never retries or submits an evaluation. Preview itself may perform original analysis/binding persistence internally. This record makes no claim that the source performed no writes.

Both explicit context readbacks returned 200 / ok and matched the installed owner. The exact A04 operation and the targeted portfolio operations remained ready while genuinely unavailable sibling operations stayed unavailable.

## Profile integrity and limits

The forwarded profile contains **3,503 valid records**: one start, 3,501 aggregate buckets and one summary. There were no JSON parse errors, missing buckets or pending recorded calls. All 293,334 timed call settlements are accounted for by 190,037 stored intervals plus 103,297 discarded lower-level intervals.

The approved logger reserves the final 10,000 slots of its absolute 200,000-interval ceiling for upper-level intervals. Lower-level buckets hit their 190,000-slot boundary. Their calls, completed counts and accumulated inclusive durations remain complete, but an affected bucket's union is null. No upper-level interval was discarded. No bucket was discarded. The request's signal was not aborted at the final profiler summary.

A completed timing span means that its original call settled, either by returning or throwing. It does not itself mean source admission or a successful analysis. Every timing belongs to this instrumented runtime, and each accumulated duration is rounded per bucket.

**Inclusive rows overlap. Do not add a parent to its children, or sum per-bucket unions from different categories as total wall time.** The full upper intervals are provided so that a reader can recompute category unions. Lower-level cross-bucket unions cannot be reconstructed after interval drops.

## Measured attribution

### Planner calculation and source boundaries

| Span | Calls | Accumulated inclusive ms | Discarded intervals |
| --- | ---: | ---: | ---: |
| `planner.project-source` | 58,250 | 6,373 | 20,544 |
| `planner.domain-view` | 58,251 | 5,620 | 20,544 |
| `planner.calculated` | 116,502 | 2,458 | 41,086 |
| `planner.project` | 8,668 | 79,753 | 3,062 |
| `planner.source1` | 8,668 | 32,142 | 3,061 |
| `planner.read1` | 8,668 | 3,434 | 3,061 |
| `planner.financial-build` | 8,668 | 642 | 3,061 |
| `planner.read2` | 8,668 | 3,574 | 3,061 |
| `planner.source2` | 8,668 | 32,482 | 3,062 |

The recorded version-count amount is 116,502 across 58,251 domain views: an aggregate ratio of two versions per view. Pure `calculated` accounts for about 2.5 seconds, and the entire synchronous source-projector boundary about 6.4 seconds. Those values do not support a monthly-array or selective-version optimization as the main remedy for a 300-second preview.

The two source resolution boundaries contain 17,336 calls and 64,624ms of accumulated inclusive duration. Of those, 16,084 calls / 49,852ms occur inside recorded physical invocations; 1,252 calls / 14,772ms occur outside them. This isolates a meaningful boundary for source review, but does not separately measure copying, hashing, authentication, materialization or transaction overhead inside it.

### Case and operation guards

| Span | Calls | Accumulated inclusive ms | Discarded intervals |
| --- | ---: | ---: | ---: |
| `case.read` | 541 | 167,211 | 181 |
| `case.namespace1` | 541 | 1,336 | 181 |
| `case.accessible1` | 541 | 18,613 | 181 |
| `case.operations1` | 541 | 62,565 | 181 |
| `case.accessible2` | 541 | 18,812 | 181 |
| `case.operations2` | 541 | 62,426 | 181 |
| `case.namespace2` | 541 | 1,426 | 181 |
| `operations.fences-before` | 1,082 | 52,077 | 362 |
| `operations.source-before` | 1,082 | 4,305 | 362 |
| `operations.project` | 1,082 | 9,704 | 362 |
| `operations.source-after` | 1,082 | 3,873 | 362 |

The operation guard still calls the original source-fence reader a second time at its final egress. Only the first call has the `operations.fences-before` span. It is a plausible contributor to the remaining operation-guard duration, but the unmeasured second call is not assigned an invented duration.

All original short circuits, selector checks, source comparisons, projectors and revalidations were preserved by the instrumented bodies. The two case phases remain distinct.

### Complete upper interval unions

| Category | Calls | Union ms within that category |
| --- | ---: | ---: |
| `http.preview` | 1 | 300,002 |
| `root.invoke` | 39 | 264,755 |
| `metric` | 34 | 145,596 |
| `compare.canonical` | 4 | 89,293 |
| `scenarios.direct` | 14 | 224,099 |
| `selection.read` | 2 | 89,335 |

There were 39 physical invocations: all entered their callback, 38 staged their work and were accepted, and the final invocation was refused. All 34 metric calls completed, using 68 original batches and 136 selected references. No scalar metric fallback was recorded. Four canonical comparisons are included in the fourteen direct comparisons; these sets must not be added.

The earlier Attempt13 used scalar-only forwarding and the previous rule preparation. This attempt includes both original resolveMany forwarding and the rule's sensitivity source references. Its total duration and completed prefix are therefore not a controlled one-variable benchmark against Attempt13.

## Read-only follow-up

The [source audit](SOURCE-AUDIT.md) confirms that Planner's original prepared reader is present. It also finds a composition gap: the source lifecycle asks the private LocalStore readonly lookup about the CurrentChoice wrapper object, whereas that lookup recognizes the original LocalStore object. This can discard an existing readonly ACL capability while retaining the generic complete-snapshot path.

This is a static boundary finding. The profile does not assign every millisecond in source resolution to that gap. A potential repair must recover only the original closed readonly provenance and preserve fresh authorization, identity checks and callback execution; a writer preimage or matching bytes alone is insufficient. No runtime change is part of this audit.

## Visual review

All seven JPEGs were reconstructed from their original log chunks, emitted as images and manually inspected. No crop, recolor or regenerated UI was used.

| Original capture | Review |
| --- | --- |
| [UI42-list-dark-desktop-test-data](UI42-list-dark-desktop.jpg) | Dark desktop list: clear title/card hierarchy, two authorized cases with complete titles, source versions and open actions; compact Context and access remains separate. |
| [UI42-list-light-desktop-test-data](UI42-list-light-desktop.jpg) | Light desktop list: readable metadata and action contrast; same complete source cases and balanced native card spacing. |
| [UI42-list-dark-390-test-data](UI42-list-dark-390.jpg) | Dark390: cards stack within the gutter, titles wrap without clipping, source versions and open actions remain visible; no page-wide horizontal overflow observed. |
| [UI42-list-light-320-test-data](UI42-list-light-320.jpg) | Light320: heading and source copy wrap in the native column; both cards and actions fit without clipping. |
| [UI42-empty-authorized-case-test-data](UI42-empty-authorized-case.jpg) | Authorized empty case: genuine empty-scenario and empty-history messages remain visible; Preview combinations is disabled, source metadata retained. |
| [UI42-configure-focused-candidate-test-data](UI42-configure-focused-candidate.jpg) | Configured case: actual candidate and original criterionv2 checked, limit4 retained with full visible focus outline, source context/history visible. |
| [FAILED-native-wave-three-test-data](UI42-original-authority-refusal.jpg) | Original final refusal state is visible with retained source candidate/criterionv2/limit; no portfolio result or complete total is supplied. |

The six preceding stage layouts are readable in their captured modes. The final screenshot retains the real candidate, original criterion v2 and limit 4, alongside the original source-change warning and unavailable preview. That warning is a generic UI classification; it does not establish that a source version changed. The final image is diagnostic evidence of the failed state.

There is no successful preview, UI43 result, UI44 result or Portuguese capture in this attempt. Narrow viewport captures are reflow evidence, not browser zoom. Presentation approval of a captured stage does not convert this failed journey into a pass.
