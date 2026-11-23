# Fourth interface refinement pass

This pass refines the existing native interface across Teams, Agents, MCP, Settings, Planner, Procurement, Documents, Memory and local administration. The change is tracked in [PR #718](https://github.com/gustavomhss/Orchestra-SF/pull/718), starting from `e115b667d845822a1df5f523bbfd828ab57ca978`.

The issue ledger counts distinct observed defects. Files, commits, viewport variants, screenshot copies and follow-up corrections to the same defect are not additional fixes. Test-fixture maintenance is recorded separately. The machine-readable source, run, artifact and review index is [round-four-runs.json](./round-four-runs.json).

## Current checkpoint after dev reconciliation

The working branch now includes actual `dev` `490a1e1352081d28c0eb22afcd05fffea8b5323f` through the two-parent integration [`34df764`](https://github.com/gustavomhss/Orchestra-SF/commit/34df764a67a3dd540f9066186dc8cab8b30a5aa0). Upstream changed 191 paths, with 16 overlaps in this round; one blob was already identical and all remaining changes were reconciled. Upstream changed no CLI or Sucafina module files. Its five generated-palette changes are preserved, with zero palette-file delta from the new base.

The 18 entries below are tracked findings. Team containment, the richer version identity and the exact approval-column width independently arrived in the new base. They are preserved and rechecked; this is not a claim of 18 additional fixes against `490a`. Procurement's split registrars remain intact, and the complete six-case cohort spans three spec files. New English and Portuguese 768px checks verify the actual 1+2+2 metric rows without changing their original deadlines.

**PR #718 remains a draft and is not merged.** The previous 94 passed browser cases and 64 reviewed original images remain historical evidence on the earlier base. Teams/shared/MCP, Agents and the expanded five-case Documents cohort are being requalified on the reconciled UI. They are not counted as current successes before result and original-image review.

The composed structural [run 45265427046](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45265427046) passed all ten gates and 265 nested regressions before reconciliation. The published Recall control [run 45267597134](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45267597134) passed three independent cases and 224 assertions; each retains its original 105-second cooperative and 120-second Bun bounds. The earlier two-case aggregate exceeded its unchanged cooperative bound and remains recorded as a failure. Original native Atlas [run 45265524052](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45265524052) also passed, with 24 assertions and the genuine scanner/writer.

Installed-host counters established actual completed-record-proof admission: every observed Finance owner admitted the native proof, with 46 completed-proof hits and two canonical misses per pair. This did **not** resolve the browser deadline. Materiality [run 45263884281](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45263884281) and Recall [run 45265432458](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45265432458) exceeded the unchanged 40-second request guard. The aborted transactions returned no observed headers or body; later condition responses are separate transactions.

The integrated follow-up gives each existing source-validation phase its own original observation owner. All source/coverage reads, criteria phases and egress checks remain. Its full three-case control [run 45274052784](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45274052784) passed 576 assertions. The prior failed control had mistaken the original outer monotonic authorization refusal for the inner comparison result. The revised test observes the real comparison before egress and asserts both exact results: stale internally and denied externally, with no second resolution. That failed attempt remains preserved. Plain Materiality [run 45268191931](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45268191931) still exceeded 40 seconds, so no end-to-end performance success is claimed.

CPU sampling remains in progress. Separate numeric-only Recall [run 45272518555](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45272518555) confirms the English request's original 40-second failure before the later Portuguese 15-second navigation failure. Counters are emitted only when an owner settles; no completed Recall row does not prove that an owner was never admitted. These diagnostics cannot substitute for the complete original Memory qualification.

The full Memory cohort, final producer cohort, affected business journeys and final structural checks against `490a` remain required. The current evidence source is `08e6f7f97d63296b768cdf4120a62f9ed1bdcebe`; the following documentation commit is not a merge receipt.

## Issue ledger

| ID | Area | Observed defect | Resolution |
| --- | --- | --- | --- |
| R4-01 | Teams | Expanded chat administration escaped its raised surface. | Correct intrinsic sizing for the expanded chat layout. |
| R4-02 | Teams | Empty active fields had weak boundaries in both themes. | Use a scoped native dim edge while preserving hover and keyboard focus. |
| R4-03 | Planner / Versions | The version identity vanished from narrow action-side table views. | Repeat the real source name beside narrow actions with the original accessible identity retained. |
| R4-04 | Procurement / Overview | Wrapped labels displaced adjacent metric values. | Share label, value and note tracks with native subgrid. |
| R4-05 | Procurement / Approvals | Request numbers and their action wrapped unnecessarily. | Reserve the existing 180px identity-column budget. |
| R4-06 | Documents / Evidence | Candidate selection shrank within its row and its text was centered. | Fill the candidate column, align value and metadata, and separate confirmation. |
| R4-07 | Memory / Signals | Selected case text approached the native select arrow. | Give the local 32px end reserve enough specificity to survive the shared form rule. |
| R4-08 | Local administration | The same summary heading appeared twice. | Use one heading and preserve the fieldset's accessible name. |
| R4-09 | Settings / Add server | Dialog rules targeted the wrong DOM level. | Apply the native frame, gutters, title and mobile controls to DialogV2 Content. |
| R4-10 | MCP / Remove | Removal used the primary-action tone. | Use the established danger treatment. |
| R4-11 | Native warning role | Three consumers referenced an undeclared warning alias. | Resolve warning through the existing warm role in each palette. |
| R4-12 | Agents / Roster | Duplicate gutters compressed cards and a metric label. | Use shared responsive inner geometry and local compact metric insets. |
| R4-13 | Agents / Tabs | Mobile tabs had 37px targets. | Apply native 44px targets within the existing scroller. |
| R4-14 | Agents / Prompt editor | The counter wrapped into two or three lines beside Reset. | Allow the footer to wrap while preserving the whole counter and action. |
| R4-15 | MCP / Tools | A long endpoint expanded scroll width to 1234px and hid controls. | Shrink the text block and wrap the full redacted endpoint inside the dialog. |
| R4-16 | Native page reads | Unchanged dev returned valid page data after the original 10-second ready bound. | Use the original installation observations for exact internal page GETs while retaining all authority and source comparisons. CAP23 alone omits operational-health probes unused by its original handler; other pages retain them. |
| R4-17 | Memory / Planner comparisons | Repeated canonical scenario and criterion reads exceeded the original materiality deadline. | Give each scenario-pair resolution its own existing observation scope, preserving criteria outside the scope and fresh initial, second and final reads. |
| R4-18 | Planner / calculation ancestry | The original ancestry regression exceeded its unchanged 105-second cooperative deadline after amplifying canonical request/result reads. | Return the canonical request and its already fenced result together within each observation, while retaining both result reads, the final C08 fence, independent replay phases and source/authority checks. |

## Teams: surface containment and readable field boundaries

The expanded administration content could outgrow the raised chat surface because the initial viewport constrained its intrinsic height. The scoped layout now grows around that content while retaining the original composer and scroll paths. The review includes wide, compact desktop and narrow views in both native themes.

Active empty fields previously had weak edges against their surrounding panel. Their local border now uses a 68% mix of the existing dim role; hover uses the dim role itself. The painted 1px stroke remains distinct from the 2px native keyboard outline. The regression measures the actual stroke color against both adjacent surfaces and verifies keyboard focus. The observed minimum edge contrast was 3.87 against the inner surface and 4.10 against the outer surface. These are component measurements, not a claim of comprehensive accessibility conformance.

The final combined shell run passed all 16 original Teams cases with the strengthened containment, border and focus checks. Six representative final originals were opened directly: 320px keyboard focus in both themes, 1440px expanded administration/chat, and 1280px expanded administration/chat. Additional automatically produced checkpoints are not represented as manually reviewed.

## Agents: useful space and coherent narrow controls

Agents now uses the shared `mx-inner` geometry. Removing the duplicated local gutter raises useful card width from 230 to 270px at a 320px viewport, and from 300 to 340px at 390px. The narrow top padding follows the native 28px value instead of accumulating to 52px. A local compact metric inset keeps the complete label inside its cell without shrinking the type.

The tabs retain their existing horizontal scroller and now have 44px targets rather than 37px. The prompt footer may reflow between metadata and Reset, while the entire character counter stays together. At the two narrow widths its former three-line/two-line counter now occupies one line. The original savebar remains 66px high, with no horizontal overflow and 44px actions.

All 27 original and added Agents cases passed. Thirteen final originals were opened, alongside twelve baseline originals. Draft editing, command intent, Escape and focus return remain exercised by the original journeys.

## Settings and MCP: native framing, complete text and action meaning

Add server now targets DialogV2's actual Content/container relationship. The local frame has the native 480px maximum width, 16px viewport inset, 24px body padding, 16px radius and 20px title. At viewports of 320, 390 and 1440px, the observed modal widths are 288, 358 and 480px. Narrow inputs/actions retain 44px targets. Field-linked error descriptions, retry behavior, Escape and return focus remain in the original flow.

MCP removal now uses the existing danger action. A separate Tools defect came from a long redacted endpoint refusing to shrink: it expanded the modal scroll width to 1234px and moved the header outside the viewport. The endpoint's text block can now shrink and wrap. At 320 and 390px, scroll width equals client width (286 and 356px), and the header begins at x=17 rather than x=-931 or x=-861. The full endpoint remains present with its existing credential redaction.

The warning role was referenced by three consumers without a declared alias. It now resolves through the existing warm role, including the selected palette. The measured native values remain #cfbd95 in dark and #4d390f in light. No new color family, blur layer or shadow treatment was introduced.

The final shared visual suite passed 24 cases; twelve final Add server/error originals were opened. MCP passed all 15 cases after the endpoint fix; nine final Tools/removal originals were opened. The earlier nine MCP captures are retained only as before/intermediate evidence and are not counted again as final coverage. Browser assertions preserve Escape, focus, exact action intent and zero writes in the read-only Tools flow.

## Native business and final areas

Planner Versions repeats the actual source name beside the action group below 640px. It does not substitute a fixture label or new identifier. The existing identity and accessible action labels remain authoritative; the extra visual label is hidden from assistive technology. This gives a narrow, horizontally scrolled action region enough context to identify the row.

Procurement overview cards use common label/value/note tracks. A wrapped label can no longer push only one neighboring value down. The established stacked mobile arrangement remains. The approvals table reserves the existing 180px identity-column budget, keeping request number and open-record action coherent.

Documents evidence selection fills its useful column and aligns value and revision to the same padded start edge. Confirmation remains a distinct action and occupies its own full row at narrow widths. The first successful run still showed centered candidate text; that inspection led to the follow-up repair. The final four-case original operations suite passed with the corrected alignment. Dark/light desktop and light 320px original JPEG previews were opened. This suite ran alone so the existing ClamD/filesPair installation recipe remained active.

Memory selects reserve 32px at the logical end for the native arrow. The first run exposed a specificity conflict: the shared form selector overrode the local reserve. The repaired local selector wins that existing cascade. The original geometry requirement remains unchanged; it was not reduced to accept the failed appearance.

Local administration now has one visible summary-settings heading. The same title also names the fieldset through `aria-labelledby`, preserving grouping without duplicate copy. The source's actual unavailable state remains visible.

## Repairing native page loading at its source

The original business journeys failed before reaching the new visual assertions. A separate diagnostic used the unchanged dev product and the complete original Procurement spec with sanitized HTTP timing observers only. In the first case, the valid CAP24 response arrived after 10.745 seconds; the original ready assertion had failed after its unchanged 10-second bound. The response completed with an `ok` envelope. The other three first-page reads were still pending after roughly 10.6–11.0 seconds. This established a server response delay rather than a missing UI assertion or invented test datum.

The host's full operational-health observation repeated unrelated native-operation probes while constructing exact internal page reads. The private `pageOperational` port now supplies those reads with the installation's original observations, including asset readiness. It is restricted to internal GETs at exact registered page paths. Public/context reads, other GETs and commands retain the full operational port. The existing CAP25 zero-probe path remains explicit.

This changes which operational-health source is used, without removing the original principal, binding, lease, abort, destination, access-revision or data-stability checks. Two equal observations and the final authority/source comparisons remain. CAP27 still consumes the original asset-health information needed for supplier attachment links and downloads. A missing optional page port retains the old behavior; a present but failing page port fails closed.

The request-context suite contains 62 cases, including controls for exact routes and methods, authority revocation, identity changes, failed observations, fallback and asset availability. Planner, Procurement, asset and installed-host regressions accompany it. The original browser readiness bounds, original per-test deadlines and retry:0 remain unchanged.

The Back diagnostic passed the original two-case Planner spec and measured sequential full-context and CAP23 reads. Its list body arrived 8.567 seconds after the click, inside but close to the unchanged 10-second bound. This did not reproduce the earlier failed return, and does not retrospectively measure it. The original CAP23 handler only consumes the context stamp, destinations and action IDs, then reads its own current Planner source. Its private page callback now omits operational-health probes unused by that handler. It returns explicit unavailable operation availability, retains all three admissions, and keeps the full route-context admission unchanged. Other page callbacks, including CAP27 attachment-health evidence, retain their original observations. Nine new controls cover the exact route, final authority drift, delegation, asset drift and full-context separation.

## Repairing repeated comparison reads

The isolated original UI61 diagnostic retained its 40-second bound and recorded 305 internal stages, 145 after the materiality GET. The first canonical observation took 60.764 seconds: the two comparisons alone took 21.719 and 21.940 seconds, with additional registry and scenario reads. Work continued beyond the deadline and began the second independent observation. This established repeated producer cost, without a held lock or an observed successful late HTTP response.

Each scenario-pair resolution now uses the existing Planner observation owner. The initial, second and final phases remain separate; criteria still run after the pair root closes. The stored scenario batch keeps the canonical scalar fallback, and the metric facade preserves its actual observations and clones. No comparison result is reused between phases or requests. The existing owner still checks source and reader identity, principal, environment, selected case, authority and a fresh egress witness. Its eligibility and refusal rules are unchanged.

The new original-fixture regression compares the complete result with and without the callback, requires all three pair phases to run again on a second call, and keeps criteria outside those roots. It also covers revocation, reader replacement and a real source change after a root closes. Existing Finance-pair, subtotal, ancestry, sensitivity and case-scope regressions accompany it. Their original assertions and time bounds remain.


An independent review found that the new host callback needed the same detached-pair boundary as the original batch resolver. Each callback response now goes through that existing resolver in every phase. The original full phase test and a separate real-fixture control passed in [run 45239858966](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45239858966): two cases, 127 assertions, zero failures. The new case rejects five empty/short observations and three typed refusals without fallback, then proves full output parity after mutation of a retained earlier callback result. Each case retains its own 105-second cooperative and 120-second Bun limits. This completes the original R4-17 boundary; it is not counted as another product defect.

The first repair is active: a later diagnostic observed all 40 scenario-pair owners admitted and completed, with no fallback or unsupported scope. The two full materiality observations still took 36.010 and 35.689 seconds; the internal producer returned after 72.005 seconds, beyond the original 40-second HTTP bound. No successful late HTTP response was observed. This narrows the remaining work to repeated work inside the canonical readers; it does not qualify the original positive materiality journey.


The next instrumented run separated the work inside the pair reads: 40 pairs took 36.953 seconds in total, explained by historical-result callbacks (10.704s), 160 case reads (12.014s), and 80 forecasts (13.970s). Forecast coverage accounted for 13.231s; its physical source/projection work was only 0.552s. The original whole GET still took 68.676s internally. These are nested measurements and are not added to one another indiscriminately.

A deeper diagnostic counted 1,176 BCS evidence resolutions and 24,823 UI reauthorizations in its first complete observation. Per-call logging produced 944,271 markers overall and inflated that observation to 60.310s; the second was cut by teardown. Those fine-grained times are unsuitable as clean production measurements. The replacement aggregate-only [diagnostic 45243608894](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45243608894) completed both observations at 35.906s and 35.732s, with 440 numeric rows and no active timers. Per observation, roughly 1.5 million database-file checks cost 2.1s and 297,159 SQL calls cost 0.44s. The 591 measured BCS capture digests cost about 3.1s; this covers only that call site and does not exclude canonicalization elsewhere. Nested and parallel totals are not summed. The original HTTP request still failed its unchanged 40s bound, with no observed successful response. The four-file aggregate supplement [45246722659](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45246722659) completed at 36.403s and 36.180s per observation, with all 468 numeric rows inactive and 126 paired marker groups balanced. Each observation made 649,624 canonical digests costing 13.094s and 13.205s; their nested canonical-byte work cost 11.272s and 11.410s and is not added again. Source identity catalog checks cost under 0.4s; concrete prepare/project snapshot copies cost about 0.95s. The original HTTP request still failed its unchanged 40-second bound. The evidence supports reducing repeated canonical work, without changing serialization, evidence, authentication or original deadlines.

The same observation contained 99,053 authentication-session checks. A mechanically equivalent repair derives the identical session-id SHA256 once per session call instead of three times. It preserves the original revocation/session/revocation read order, each clock read, decryption, expiry and final revocation. The complete original [14-case authentication suite 45244188685](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45244188685) passed with 132 assertions, including in-flight logout, exact expiry and tamper controls. This repair is integrated at `60d18cc9de59cde7b4abffd6be9cf3bacfb8ee8d` as part of R4-17; no end-to-end latency improvement is claimed before the composed browser qualification.


The existing fine-grained trace also establishes scope coverage without using its distorted timings: of 1,176 BCS resolutions per observation, 960 occur inside 20 separate pair-work owners and 216 outside. Similarly, 480 of 591 context captures occur inside pair work. These counts locate potential reuse; they do not establish a latency improvement.

The installed CurrentChoice persistence composition previously lacked the narrow native readonly-owner proof required for the prepared Planner source path. The repair recognizes only factory-created adapters, pins the original base and wrapper methods, retains fresh authorization and detached callback values, and preserves poison, preimage and closed-owner refusal. The Planner-specific source helper retains the physical root and byte identities; the existing general helpers are unchanged. The composed [owner verification 45253041565](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45253041565) passed four complete suites: 45 executed tests, zero failures and 816 assertions. LocalStore retained its two existing foreign-UID conditional skips. No skip was added. This repair and its real-composition control are integrated at `83a62ec384bb59ad53d5c2c2d789956501bf307a` as part of R4-17.

The composed candidate reuses only completed, detached, fresh terminal Planner evidence inside one separately admitted owner. It preserves every new phase, current authorization, full references and payloads, original timestamps, and fresh egress. The first [proof gate 45257154019](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45257154019), source `5d9ede025232ee8190af66812d94f50c597f3217`, passed five complete suites, seven tests and 437 assertions. The [native-child follow-up 45258337739](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45258337739) passed those five complete suites with seven tests and 522 assertions, including active child continuity and inherited closed-child refusal.

The Source factory's retained callbacks are also pinned privately for Planner admission; general readonly helpers and canonical source readers keep their existing behavior. Each eligible Recall and selected case preflight now owns its own bounded observation. Its actual case and published Atlas closure, source and authority witnesses, full canonical result and separate fresh egress remain required. No case result or Atlas result is cached. The [composed gate 45262111572](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45262111572), source `86ba4548b0a91243e6b4f64db45a8dcaa2d223ef`, passed six complete suites, nine tests and 1,024 assertions. This includes the two source-owner controls and the case-preflight control. The separately added published-Atlas Recall control uses the real scanner/writer, a complete canonical baseline, malformed input, private child selection, retained-result mutation before root closure, receipt drift and zero-write checks; its complete two-case file is still under qualification.

The earlier isolated [UI61 attempt 45257236373](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45257236373) on the first proof source failed the unchanged 40-second materiality guard. The trace records no response within that bound; it does not prove a later producer duration or that reuse was admitted. It precedes the native-child, factory-pin and Recall composition above, and remains recorded as failed diagnostic evidence. The current source `3cb30732b8db46bfcb0b4df61e757bd7b2df5362` contains all these changes and typed controls. The actual installed-host admission diagnostic and unchanged isolated UI62 journey are running separately. No end-to-end latency improvement or complete Memory qualification is claimed yet.

## Calculation ancestry without redundant result reads

The original ancestry regression also failed at its unchanged 105-second cooperative bound. A parent-source diagnostic reproduced its 1,952 canonical result reads before the materiality change. A later diagnostic found 97.5% of the instrumented reads already inside a sealed physical observation root. The repeated logical validation remained expensive despite physical batching.

The request store now returns the detached request and the canonical result it has already fenced together. Both original result reads and the final C08 fence remain. Calculation evidence consumes that pair independently in the initial and final phases, preserves both canonical replays, and retains source closure, cycle, authority and final consistency checks. The optional callback's absence retains the original reader sequence; a present refusal remains closed.

[Run 45234793351](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45234793351) passed the complete original ancestry test in 71.533 seconds and the new control in 2.183 seconds. The outer producer made 1,078 canonical result reads, eliminating 874 repeated calls (44.77%). Runtime duration varies across runners; the call-count change is the direct evidence of reduced work. Reopen, full ancestry resolution, absent totals, foreign-case refusal, persisted cycles, recovery and revocation all remain exercised. The new control compares full output with the original fallback, proves fresh independent observations and detached values, and rejects changed canonical reads, revocation and a real Planner source mutation. A subsequent test-only change expresses the same detached-array mutation with `Reflect.set` to satisfy its readonly TypeScript type; the final composed type/control gates cover that exact blob.

## Atlas publication precondition

The original UI62 recall returned 503 because its selected precedent still had a pending outbox event. The isolated diagnostic reached canonical case-read and owner readiness, then recorded `recall-atlas-outbox-pending` before opening the Atlas partition. The reader intentionally refuses that incomplete publication state. The fixture had recorded the original decision choice but had not completed the original Atlas publication.

The isolated Memory fixture now publishes that actual event through the existing authority, persistence, pinned gitleaks scanner and canonical writer. A one-use private setup pipe carries the admitted case and session into the same native host process. The before/after checks preserve cases and unrelated outbox state, require the canonical matching receipt, and revalidate authority. No public route or production recall rule changed. The original native reviewer regression passed in [run 45230578999](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45230578999), including a new pending-state negative, detached map and namespace-revision equality, then its complete original publication and positive recall flow.

The first browser attempt stopped before publication because the isolated child lacked the host-tool PATH. The original pinned tar.gz acquisition requires `tar` before download; the scanner diagnostic reported `extractor-missing` in the original boot and its cached refusal during preparation. The fixture now explicitly passes PATH and the two requested runtime-mode values while preserving isolated credentials and writable stores. Original scanner policy, pin, acquisition, deadlines and refusal remain. The explicit setup POST also now supplies the original command-identity owner's required Idempotency-Key, derived from the actual case revision. [Run 45238030823](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45238030823) then completed canonical publication in 1.552 seconds and entered the browser; the original case read returned HTTP 200 in 22.169 seconds. The subsequent original similar-cases request exceeded its 40-second guard. The original observer aborts that route on the failure, so the trace establishes absence of a response within the bound, not the producer's later duration. No result checkpoint was reached. The full original Memory spec remains required after the shared reader cost is repaired.

This is scenario maintenance, recorded separately from product-fix counts.

## Verification integrity and fixture maintenance

The expanded structural run initially passed eight outer checks and found two stale test setups. Both failures remain in the machine-readable ledger:

- Native web discovery selected the private installation parent even though the original host registers its physical workspace. The test now resolves that workspace through the existing `prepareSfLocalWorkspace` owner. Its original unauthenticated 401, authenticated 200, exactly-one-installation, schema and context assertions remain.
- The ownership test expected 403 for another actor who could not see the request. The original runtime intentionally returns 404 in that case. The existing 403 attack now uses requester + viewer roles, proves that the actual foreign record is visible and still requires unchanged state. A separate requester-only attack proves invisibility, requires 404 and again checks unchanged state. No production authorization behavior was changed.

These are test-setup corrections, not additional product fixes. The failed run is not counted as green qualification. No assertion was skipped, no retry added, and no deadline increased.

The composed structural run [45262866348](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45262866348) passed nine of ten gates and all 265 nested regressions. Sucafina typechecking found two missing callback parameter types and two possibly undefined captured-result variables in the new controls. Explicit types and required-value guards now resolve those findings without removing any complete-value comparison or scenario. The subsequent full ten-gate run 45265427046 passed. Final structural qualification against the reconciled dev base remains required. This failed run remains separate from green qualification.

## Historical qualification before dev reconciliation

| Retained scope | Run | Cases | Result |
| --- | --- | ---: | --- |
| Teams / shared visual | [45207326593](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45207326593) | 40 | PASS |
| Agents | [45209024988](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45209024988) | 27 | PASS |
| MCP | [45209554231](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45209554231) | 15 | PASS |
| Documents | [45210521937](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45210521937) | 4 | PASS |
| Planner / Procurement | [45225004108](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45225004108) | 6 | PASS |
| Memory consultation | [45227929041](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45227929041) | 2 | PASS |

Before dev reconciliation, these runs established 94 distinct passed browser cases and 64 reviewed original images. Changed UI paths now require qualification on the updated base. Planner / Procurement includes the complete original six-case cohort, including CAP23 rename, Back, fresh read, copy/comparison and Portuguese. Memory consultation has been repeated on the composed producer source; its four current images replace the earlier four. It qualifies the original CSS and local cancellation behavior. The complete original five-case Memory spec remains pending. Failed and diagnostic attempts stay separate in the ledger.

The [structural gate 45231648647](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45231648647) passed all ten checks on source `0a06f132c53e1a9374c26ab60fb5cd3808395cfc`: app-shell/CLI/Sucafina and E2E types, 78 guardrails against the exact pinned base, generation and byte parity of seven palette outputs, and 265 nested regressions (13 comparison/layout, 103 browser-command/Teams, 145 page/domain/asset and four installed-context/Procurement cases). Strict Omni observed ten declared wrapper tests, twelve spawns and zero delegated executions, with a passing positive control. The subsequent [composed gate 45236453824](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45236453824), source `42abce1949cc1a533f62baab6597896d359f3129`, also passed all ten checks and 265 nested regressions, including the final readonly-array test correction. The guard evaluated 78 rules over 56 snapshot paths, with no findings, errors or approved exceptions; palette parity remained exact. Later fixture-intent, observer-boundary, authentication and native-owner changes remain scheduled for the final structural gate.

The first producer gate passed 11 of 12 internal tests. Its original ancestry failure is retained; the separate ancestry correction then passed the complete unchanged case and new controls. Final producer qualification, the original Memory cohort and the final documentation gate remain required before merge.

This is an intermediate evidence checkpoint, not a merge receipt.

Before dev advanced, the carried cohorts retained the recorded direct UI, theme and spec paths. Reconciliation changes that boundary: new-base results and original images must replace affected qualifications. Earlier path comparisons remain historical evidence, not a current dependency proof.

The retained visual evidence uses default native skins, original source values and the production bundle. Component HTTP fixtures remain distinct from genuine isolated installation journeys. These runs do not establish live Microsoft account, OAuth or external model behavior. CSS viewport reflow is not browser zoom, and reviewer inspection is not owner visual acceptance.

Diagnostic-only UI61/UI62 copies and static stage markers were kept on disposable CI snapshots. Their original actions, assertions, time bounds and retry:0 were preserved. They do not enter the product branch and cannot substitute for the original full-spec qualification.

Product/source reads and writes used GitHub MCP. Execution used the existing Linux `test-ci` workflow with strict Omni and disposable `ci-run-*` snapshots. Local operations only inspected CI evidence. No workflow changes, guardrail approval bypass, local product checkout/build/server or production deployment were used.

The exact final documentation candidate, structural result and merge receipt are indexed in PR #718 after this evidence commit, avoiding a self-referential commit identifier.
