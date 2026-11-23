# Final wave: memory, context and local administration

## Scope and behavior

This change covers UI61 Signals, UI62 Similar cases, UI63 Expected and observed, UI67 Context and access, and UI69 Local administration. It starts from the fixed dev base `a5eee3584da531d087a419b8f3ef29d3881117c7`, preserves the relevant presentation refinements from #710, and retains the native material, fonts and color tokens.

| Area | User-facing change | Source and behavior retained |
| --- | --- | --- |
| UI61 | Authorized case chooser, exact-reference disclosure, selected-condition state and clearer evidence hierarchy | Original case catalogue and condition, signal and materiality reads; source uncertainty and owner fences |
| UI62 | Authorized case names, orderly candidate selection and evidence disclosure | Explicit candidate set, private POST recall question, Atlas event references, source reauthorization and original-case read |
| UI63 | Recorded choices with original names, reasons and dates, independent of signal conditions; an explicit message for original incomplete coverage | Original case projection and closed-month Planner observation, exact case version, opaque selection locator, baseline references, coverage and limitations. Numeric comparison remains conditional on the original producer. |
| UI67 | Current-context card, responsive identifiers and explicit refresh | Original F01 provider and exact active server, project, installation and principal |
| UI69 | Local access status, independent summary settings and an explicit unavailable state for notifications/backups | Original local-operator admission, reviewed summary configuration, CAS version, one-shot intent and persisted readback |

UI63 no longer requires a signal condition before a recorded choice can be selected. It reads choices through the existing typed `projection.case` operation, only when that operation is ready and operational. The result must match the selected case ID, incarnation and version. Duplicate choice IDs, changed owners, stale replies and changed selections cannot restore a prior result.

The exact reference fields remain available. The case chooser is offered only when `projection.cases` is ready and operational. Neither an option, a manual identity nor an opaque locator supplies authority.

## Design and language

The pages use the existing raised material, restrained borders, native typography and blue interaction token. Controls retain a minimum 44px target. Dense identifiers move into disclosures or wrap within their source fields. A marker inside each native page frame, including context and administration, opts into the shared 1160px axis and responsive gutters.

Selected conditions and choices have an explicit border and expanded state. Case selectors link their visible label with `aria-labelledby`, so option text cannot inflate the accessible field name. When the original producer supplies a comparable result, outcome values occupy three comparable cells, followed by exact provenance, facts, pending observations, coverage and the source warning against causal attribution. A typed `coverage-incomplete` refusal instead displays localized guidance and no numeric values. Similarity remains a source-inspection workflow; the page invents neither a score nor a recommendation.

The summary review replaces the editable form while open. Cancel and Revise retain the draft. Save uses the original command and checks the persisted readback before reporting the new revision. Review and Current source share a wrapping action row with a 12px gap and become a column at narrow widths. Labels use the existing `--font-size-base` token (14px in `packages/ui/src/styles/theme.css`), while the 44px hit area remains intact.

Typed memory requests materialize only the scalar fields declared by their wire contract. Solid store objects can carry a `$PROXY` symbol that the strict codec correctly rejects as an excess property; copying the authorized case ID, incarnation, version and selected period preserves both the original authority and the closed schema. No generic transport or codec behavior changes.

Existing English catalogue values are unchanged. New English and Brazilian Portuguese copy follows the repository's case, condition, source, observation and access vocabulary. Local-administration labels are complete in Brazilian Portuguese. Source-owned business text remains as returned.

Copy references:

- [Microsoft Portuguese (Brazil) style guide](https://aka.ms/portuguese-brazil-styleguide).
- [Mozilla Brazilian Portuguese settings terminology](https://support.mozilla.org/pt-BR/kb/opcoes-preferencias-e-configuracoes-do-firefox).

## Real-source qualification

`packages/app-shell/e2e/sucafina/final-memory.spec.ts` uses an isolated installation, genuine operator enrollment and the existing four-decisions fixture. It does not patch product state, authority, grants, Atlas responses, transport or application receipts.

The final `final-memory-seed.ts` reads the existing original Planner projections and emitted evidence, creates an additional January case through the human HTTP boundary, records pending cost categories, promotes both alternatives and retains the producer's conditioned comparison. It records an original closed-month outcome selection before any signal condition exists. The original outcome response must be HTTP 503 with `reason: "coverage-incomplete"`; the browser must present that limit and must not render numeric comparison cells. Only afterward does the helper register the original condition for UI61.

A separate attempt at complete numeric qualification is preserved in commit [94ca7bf](https://github.com/gustavomhss/Orchestra-SF/commit/94ca7bf318e5f37a007e596f03e568b6458c9dd2) and run R3. The original Planner accepted two copied plans, each with nine separately priced, confirmed January components, and the original coverage and promotion commands accepted both inventories. The subsequent original `decision-compare` request exceeded the unchanged 40-second deadline. That run failed; **numeric expected/observed comparison is not qualified by this delivery**. The exploratory inventory helper is absent from the final candidate. No subtotal was relabeled as nine categories, missing cost made zero or unsupported not-applicable assertion submitted.

The journeys verify:

- UI61 original condition/materiality and immediate erasure after a changed case selection.
- UI63 a recorded choice with no condition, the exact original coverage refusal, absence of numeric values, selection invalidation and opaque locator reopening.
- UI62 the private POST question, exact candidates and original match count, including either a truthful empty result or reopening the original case.
- UI67 active identities and the real context refresh.
- UI69 Cancel/Revise draft retention, zero commands before confirmation, exactly one save, source CAS increment and a fresh persisted page.
- Dark and light desktop, 320px reflow and Brazilian Portuguese.

All JavaScript page errors and unexpected browser console errors fail the journeys. The expected Chromium 503 network diagnostic is accepted only when its exact URL has already returned the asserted original `memory-outcome` status and `coverage-incomplete` body. No general status/error suppression is used.

The canonical PNG screenshots are attached to Playwright. Bounded JPEG log records `SF_FINAL14_VISUAL` identify actual area/state pairs for review through GitHub without rewriting the screenshots.

## Original memory reader availability

The first browser attempt that reached UI63 found discovery and provider ready but the route denied. The original five A14 GET readers were present in the HTTP dispatcher, but F01 had no operational observer for them. Only the independent similar-case observer was composed.

`apps/cli/src/sucafina-product/native-ui/memory-health.ts` now observes those five original reads. The composition supplies the exact `memoryHttp` handler, `createSfMemoryServices` instance, mounted dispatcher binding, Planner scenario source and original dependencies. Each operation uses the same private `sf-human:analysis.read` admission as its HTTP handler, consumes validation once, reads only original C08 case/preference metadata twice and checks actor, access revision, namespace revisions, abort, dependency replacement and lifecycle completion before publishing availability. No memory producer, signal reconciliation, condition registration, outcome selection or numerical comparison is invoked during F01 observation.

The observer publishes read infrastructure, not comparable data. It does not add a write operation, loosen a route guard or replace record-level authorization. Numerical coverage refusal remains an original result. If the scenario source is absent, only the original catalog and outcome reader can qualify. Existing UI61/UI63 behavior remains read-only; source conditions and outcome selections are created by the original human HTTP producer in the isolated setup.

The focused [health run 45100755257](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45100755257) passed **52 tests / 433 assertions / 0 failures** using the original UI authority, C08 state reader and source lifecycle. Tests also prove that no installed memory producer is called by health and that all admitted leases are closed. The root's later [native run 45102243868](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45102243868) passed **53 tests / 647 assertions**, combining those 52 cases with a genuine native installation check and verifying that both observers preserve state, audit and C08.

## Local-administration boundary

The pinned original handler `apps/cli/src/sucafina-product/native-ui/domain.ts` returns `local-operator-reader-not-bound` for the notifications/backups projection. Its private I00 reader is not exported. This change preserves that boundary and does not bind a synthetic reader.

The UI now distinguishes validated local access from that unavailable projection. It consults F01 operational availability before attempting the read, shows a named unavailable section, and keeps the independently admitted summaries reader/command usable. It does not claim that the unavailable notification or backup collections are empty. No backup, restore or JSON import command is newly admitted.

## Evidence and gallery

### Technical gates

The root's combined candidates passed app types, e2e types, guards and palette checks in [45093119702](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45093119702) and [45094187488](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45094187488). The canonical process-bootstrap correction passed app/core/e2e types, guards, palette and regressions in [45094586912](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45094586912), including eleven existing filesystem/Omni tests. One existing mode-1 case is skipped by its original strict-mode condition.

The later composed [Gate5 run 45097130282](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45097130282) passed all seven technical checks, including CLI types and the same eleven Core regressions. The [Gate8 run 45100895381](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45100895381), snapshot `05d03508e4c2dce30f22ae4517cc96647cd638bb` on composed candidate `eb8ddf92853ca9bbd37745658632c2ae51d47b82`, passed all seven checks: app, e2e, Core and CLI types, original guards, palette and eleven original Core regressions (one original strict-mode skip). This candidate includes the memory observer and independent journey steps. The subsequent scalar payload delta is verified by a later gate; it is not covered by an assumed equivalence.

### Focused browser runs

| Run | Observed result | Consequence |
| --- | --- | --- |
| [45093745713](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45093745713) | Startup failed when Playwright transformed a TypeScript declare field reached through AppProcess | No screen evidence; use the independently reviewed canonical leaf-import bootstrap fix |
| [45094574346](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45094574346) | 1/3 passed: UI67. Memory seed received the original incomplete-coverage refusal; UI69 exposed the unbound source | Preserve the source limits and separate validated local access from the unavailable projection |
| [45096429681](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45096429681) | 2/3 passed in 9.1 minutes: UI67 and UI69. Complete-inventory memory seed timed out in original decision-compare at 40 seconds | Numeric comparison remains unqualified; UI69 real review/save/CAS/readback passed. Preserve the failed qualification and exercise the original pending flow explicitly |
| [45098619818](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45098619818) | 2/3 passed in 9.7 minutes: UI67 and UI69 with final layout. Pending memory setup passed; UI63 route was denied before its leaf | Add the missing original read observer. Preserve the denied route evidence; no route guard is relaxed |
| [45100913281](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45100913281) | 2/3 passed in 12.9 minutes: UI67 and UI69. UI63 opened its no-condition choice and rendered the verified coverage refusal; UI62 rejected a reactive period object before transport, and the memory test reached 300 seconds | Preserve the failure; use exact scalar payloads. Correct the test's raw opaque deep links through the existing F01 route codec, and log every failed independent step without suppressing it |
| [45101681785](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45101681785) | 2/3 passed in 13.1 minutes: UI67 and UI69. UI63 repeated its first real capture; the old raw test deep link was still present. Memory failed its aggregate, with no page errors or repeated contract-mismatch diagnostic | Preserve the failure. The older aggregate reporter does not expose the individual failures; UI61 and UI62 are not qualified by this run |
| [45102802678](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45102802678) | Composed browser run with canonical test deep links and per-step diagnostics in progress | Do not mark memory UI qualified until original responses, assertions and images are observed |

UI67's successful run includes four actual captures: dark desktop current context, light desktop refreshed context, light 320px context and Brazilian Portuguese dark desktop. The desktop preview was reviewed by the area implementer and root; hierarchy, card, identifiers and gutters were accepted. All four captures passed viewport overflow checks, the refresh retained the exact principal, and console/page error collections were empty. The evidence is in [artifact 14783036959](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45094574346/artifacts/14783036959).

R3 includes five actual UI69 captures: dark desktop settings, light desktop review, light 320px review actions, light desktop persisted summaries and Brazilian Portuguese dark desktop administration. The original summary save occurred exactly once after review, advanced the source CAS by one and survived a fresh page. UI67 also passed again. Both areas had no console or page errors. The original evidence is in [artifact 14783443814](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45096429681/artifacts/14783443814). Review of its desktop JPEG prompted the final action-row and label refinements.

R4, on composed candidate `ccbc79ca47352691d0acbc812ca04db83435088e`, reconfirmed all nine UI67/UI69 captures, the context refresh and the real reviewed summary save/readback. Four JPEG previews were reviewed: dark and light context, dark administration and 320px light review actions. The corrected action row, 14px labels, native material, spacing and narrow controls were accepted. All nine PNG captures passed horizontal viewport checks; both tests had no console or page errors. See [artifact 14785125752](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45098619818/artifacts/14785125752).

R5 supplied the first actual UI63 desktop image with its selected recorded choice, original reason/date and the exact incomplete-coverage message. The area implementer and root accepted its hierarchy, selection treatment and spacing. The original [artifact 14785698742](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45100913281/artifacts/14785698742) preserves this partial evidence and the failed memory journey; it does not constitute a fully passed UI61–UI63 qualification.

The test now encodes both opaque outcome links with the original `encodeSfRouteRef` function. The original route matcher requires its `r_` UTF-8 base64url segment and passes the decoded producer locator to the leaf. This corrects test navigation without changing the product route, codec or admission.

Final memory browser qualification is running on composed candidate `b4aa09ca71f1bd64d1ca3e0d105613fe0011d502` plus the final spec blob `e0be64b3387478f115d0281cc75eabca16b88a1d`, snapshot `1c9c2270d0bb65895d0e3c8a2495f7fc41745c58`. Each memory step runs independently, retains every failure and reports a bounded assertion/location diagnostic. Final browser-error checks also remain in the aggregate before any success-summary attachment. No assertion or deadline is removed. The report must be updated after the final results and images are observed.

## Limits

Actual browser zoom is not measured. Numeric expected/observed comparison is not qualified: the full nine-component attempt exceeded the original 40-second comparison deadline and remains recorded as a failure. The final pending fixture preserves incomplete coverage and renders the source refusal. Notifications and backups remain unavailable at the original I00 boundary; summary settings are independently admitted and tested. An observed difference does not establish causality. Source absence or denial remains visible and cannot be converted into a successful read or recommendation by presentation code.
