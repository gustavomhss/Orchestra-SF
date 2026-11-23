# Product validation journeys

## Why the cases were separated

Product3 (`45221345638`) returned three complete passing native journeys: risks (141.292 s), relationships (138.472 s), and normal performance (110.008 s). The separate consent case reached the real producer's 422 response, then hit a strict locator ambiguity: the section and its checkbox had the same accessible name. The locator now selects the checkbox role exactly. The actual refusal, unchecked consent, disabled save, stale-consent reset and original command assertions remain.

The original People and Portfolio cases reached their 300 s case deadlines after many complete admissions. Each original leaf read took roughly 26–27 s; both hosts were ready and reported no page errors. People had completed its English interactions/workbook checks and was in the direct-link sequence. Portfolio had completed the genuine project and milestone writes and was starting Portuguese captures.

Wave-two reached 240 s while capturing the topic detail. Product2 also exposed a separate readiness dependency: the topic detail correctly kept its references selector disabled while its original CAP13 and CAP15 catalogue reads were pending. The test now arms only the catalogue reads admitted by the actual F01 response, before the detail action. It still requires an enabled selector containing the canonical seeded risk.

## Wave-two mapping

The original single case is now five isolated native cases, each retaining **240,000 ms**, the **190,000 ms fixture limit**, retries **0**, the same production runner and the unchanged producer fixture.

| New journey | Preserved checks | Genuine writes |
| --- | --- | ---: |
| Topic collections, keyboard and source filters | All original CAP02 starting captures; access menu keyboard behavior; empty, all and blocked source filters | 0 |
| Topic creation, revision and two genuine writes | Review cancellation, exact retained values, genuine create/update, fresh details/editor, related canonical references and narrow focus | 2 |
| Portuguese topic source detail and retained draft | Collection, detail, editor and review captures; cancel/discard behavior | 0 |
| Budget source scope and localized before-after review | All CAP03 starting captures; annual/unscoped data; June → July base/current/proposed in EN/PT; revenue and missing currency; draft discard | 0 |
| OPEX source write and localized complete periods | All CAP04 starting captures; absent source month; line cancellation; retained monthly draft; actual 14,200 → 14,600 write; Portuguese 14,600 readback; January/September/December at 1440/320 | 1 |

The Portuguese topic case reads `installation.topicName` from a fresh unchanged original fixture, whose topic count is three. The create/update case still proves the newly created topic's four-record collection and exact saved notes. No seed or additional write is introduced solely for a screenshot.

## People and Portfolio mapping

The previous two cases are now five, each retaining **300,000 ms**, the **190,000 ms fixture limit**, retries **0** and the original fixture.

| New journey | Preserved checks | Genuine writes |
| --- | --- | ---: |
| Original collections and Portuguese assessment views | CAP06/07/08 dark/light/narrow collections; complete Portuguese collection, assessment and workbook captures | 0 |
| Source-bound structure, talent and honest workbooks | CIO/leader/member editors; member save and source display; new-member draft; delete cancel; talent context, narrow actions and unavailable workbooks | 1 |
| Semantic returns preserve owner and filters | All three new-tab CIO/import/export returns, owner selection, year, month, status and source record | 0 |
| Original collections and new project draft | CAP09/10 dark/light/narrow collections, overview milestones, new-project draft/review/discard and Portuguese CAP09 | 0 |
| Exact project and milestone writes with Portuguese readback | Project 190,000 write/reread; milestone original/proposed notes and actual save/reread; delete cancel; Portuguese CAP10 still reads exactly 190,000 from that same fixture | 2 |

Collection screenshots in independent cases use their own unchanged original fixture. The two real Portfolio writes and Portuguese amount readback remain together. The new-project draft case now correctly asserts zero writes rather than the former cumulative two.

## Verifiable oracle accounting

The companion JSON records every changed literal assertion line. Wave-two has **119 → 123** source lines containing `expect(`; People/Portfolio has **89 → 88**. These are source-site counts, not executed assertion counts.

All differences are enumerated: cumulative write counts become per-case counts; common origin, page-error and final write assertions move into helpers called by every case; the Portuguese topic count follows the fresh fixture; original F01 ownership, a real risk option, the original Portuguese topic heading and direct-tab page errors gain explicit assertions. No functional assertion is removed to accept a failure.

Every existing screenshot name is retained. The three complete Operations cases are unchanged. The consent case moves intact to `design-wave-three-performance-consent.spec.ts` so the existing runner can select that named file. The `test-ci` validator rejected `--grep` before execution in run `45230267164`; its file-only policy and configuration are preserved. Product code, producers, fixtures, native command count, retry policy and shared read helpers are unchanged by this adjustment. The larger number of independent cases increases the possible aggregate suite duration; it does not extend any individual case deadline.

The dedicated consent run `45230759990` reached the original 422 but Chromium could not return its CDP response body (`Network.getResponseBody`). The case now obtains each command receipt through the existing `forwardOnce` observer: the API response's original bytes are delivered unchanged to the browser and checked directly. All 29 original assertion sites retain their meaning; one extra assertion verifies the exact page/action on each receipt. There is no command replay or retry, and the accepted command still waits for its real CAP16 readback.

## Final named Wave-two selections

WaveTwo5 (`45230251834`) fully passed topic collections (100.184 s), Portuguese topic source detail/draft (136.233 s), and CAP03 before-after review (142.030 s). Those three case bodies remain byte-identical in `design-wave-two.spec.ts` and are not rerun merely to repeat their existing proof.

The same-record topic case reached its 240 s deadline after real create/update confirmations and the second detail entry. Individual CAP02 transitions took about 21 s; waiting for the admitted CAP13/CAP15 catalogues made each detail group about 48–49 s. The independent references block now runs in `design-wave-two-topics.spec.ts` as a separate original-reference case. Its enabled selector, exact seeded risk, focus, viewport and existing `CAP02-dark-320-related-test-data` screenshot stay together. Both real writes, both four-record collections, every saved-note assertion, deletion cancellation and the final fresh editor remain together in the original write case and use the same created record. The reference case additionally asserts the original topic's exact heading.

OPEX failed with the real DOM still showing Loading after New line. The current product source confirms native CAP04 navigation for New line, discard-new confirmation and both EN/PT record opens. `design-wave-two-opex.spec.ts` arms those four exact original reads before their actions and then keeps every existing visible outcome. It does not infer readiness from a response alone. The actual 14,600 write/readback and all twelve period/locale/width combinations remain in that case.

These named files use the existing runner's supported selection. The common helper bodies and defaults are moved unchanged into `design-support/wave-two-journey.ts`. Aggregate Wave-two cases increase from five to six, while **every case remains 240,000 ms**, fixtures remain **190,000 ms**, and retries remain **0**. Static assertion accounting across the four code files is **123 → 124**, with **zero missing assertion lines** and one added exact topic-heading assertion. Existing screenshot names are retained. Product code, source fixtures, commands and shared network observer implementation are unchanged.
