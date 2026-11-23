# Final wave: memory, context and local administration

> UI63 and UI67 passed their complete R11 journeys; UI69 also passed the focused R13 repetition after PR715. UI61's recorded conditions and two isolated native cancellation journeys passed in R15. Original materiality, signal and numerical results remain unqualified. R16 established UI62's exact source refusal: HTTP 503, `unavailable`, `similarity-source-unavailable`; the positive 200 assertion remains a failure. No exclusive internal cause is inferred from that category.

## Scope and behavior

This change covers UI61 Signals, UI62 Similar cases, UI63 Expected and observed, UI67 Context and access, and UI69 Local administration. It starts from the fixed dev base `a5eee3584da531d087a419b8f3ef29d3881117c7`, preserves the relevant presentation refinements from #710, and retains the native material, fonts and color tokens.

| Area | User-facing change | Source and behavior retained |
| --- | --- | --- |
| UI61 | Authorized case chooser, independent conditions, explicit current-signal consultation, local cancellation of materiality and signal waits, selected-condition state and clearer evidence hierarchy | Original case catalogue and condition, signal and materiality reads; source reconciliation, uncertainty and owner fences |
| UI62 | Authorized case names, orderly candidate selection and evidence disclosure | Explicit candidate set, private POST recall question, Atlas event references, source reauthorization and original-case read |
| UI63 | Recorded choices with original names, reasons and dates, independent of signal conditions; an explicit message for original incomplete coverage | Original case projection and closed-month Planner observation, exact case version, opaque selection locator, baseline references, coverage and limitations. Numeric comparison remains conditional on the original producer. |
| UI67 | Current-context card, responsive identifiers and explicit refresh | Original F01 provider and exact active server, project, installation and principal |
| UI69 | Local access status, independent summary settings and an explicit unavailable state for notifications/backups | Original local-operator admission, reviewed summary configuration, CAS version, one-shot intent and persisted readback |

UI63 no longer requires a signal condition before a recorded choice can be selected. It reads choices through the existing typed `projection.case` operation, only when that operation is ready and operational. The result must match the selected case ID, incarnation and version. Duplicate choice IDs, changed owners, stale replies and changed selections cannot restore a prior result.

After reading an authorized case, UI61 presents its recorded conditions without automatically starting the expensive signal reevaluation. **Read current signals** starts that original reading explicitly. A separate controller exposes loading and local cancellation, retains the condition while pending, and fences late responses by case, owner, epoch and generation. Changing the case or owner aborts and clears the reading. Denial still clears the case. An empty signal list is shown only after an authorized source returns an actual empty list. The cancellation text says that this view stopped waiting and received no current result; it does not claim server cancellation, rollback or absence of reconciliation.

The exact reference fields remain available. The case chooser is offered only when `projection.cases` is ready and operational. Neither an option, a manual identity nor an opaque locator supplies authority.

## Design and language

The pages use the existing raised material, restrained borders, native typography and blue interaction token. Controls retain a minimum 44px target. Dense identifiers move into disclosures or wrap within their source fields. A marker inside each native page frame, including context and administration, opts into the shared 1160px axis and responsive gutters.

Selected conditions and choices have an explicit border and expanded state. Case selectors link their visible label with `aria-labelledby`, so option text cannot inflate the accessible field name. When the original producer supplies a comparable result, outcome values occupy three comparable cells, followed by exact provenance, facts, pending observations, coverage and the source warning against causal attribution. A typed `coverage-incomplete` refusal instead displays localized guidance and no numeric values. Similarity remains a source-inspection workflow; the page invents neither a score nor a recommendation.

The summary review replaces the editable form while open. Cancel and Revise retain the draft. Save uses the original command and checks the persisted readback before reporting the new revision. Review and Current source share a wrapping action row with a 12px gap and become a column at narrow widths. Labels use the existing `--font-size-base` token (14px in `packages/ui/src/styles/theme.css`), while the 44px hit area remains intact.

Typed memory requests materialize only the scalar fields declared by their wire contract. Solid store objects can carry a `$PROXY` symbol that the strict codec correctly rejects as an excess property; copying the authorized case ID, incarnation, version and selected period preserves both the original authority and the closed schema. Those scalar copies do not relax codec parsing. The separate final client correction preserves top-level undefined only after the original source schema explicitly admits it; all other values still require the original JSON check.

Existing English catalogue values are unchanged. New English and Brazilian Portuguese copy follows the repository's case, condition, source, observation and access vocabulary. Local-administration labels are complete in Brazilian Portuguese. Source-owned business text remains as returned.

A full literal comparison of candidate `d62c4b500695d248240a48944461a0d2262a589f`, including the three new materiality-cancel keys, against the fixed base covered every English quoted-string property and both current locale key sets. [copy-audit.json](./copy-audit.json) records the method and exact revisions.

| Catalog | Existing English literals preserved | Current English / Brazilian Portuguese keys | Missing or extra Portuguese keys |
| --- | ---: | ---: | ---: |
| sf-u26.ts | 76 / 76 | 97 / 97 | 0 |
| sf-u28.ts | 21 / 21 | 26 / 26 | 0 |
| sf-context.ts | 84 / 84 | 97 / 97 | 0 |

No property line was unparsed and no existing English value changed. Context totals include the root-composed routine-gate copy.

Copy references:

- [Microsoft Portuguese (Brazil) style guide](https://aka.ms/portuguese-brazil-styleguide).
- [Mozilla Brazilian Portuguese settings terminology](https://support.mozilla.org/pt-BR/kb/opcoes-preferencias-e-configuracoes-do-firefox).

## Composition with merged interface polish

PR #710 entered dev as `65349c1c723a8c626135d5b8032b929f5c635193`. The area owner compared that source with fixed base `a5eee3584da531d087a419b8f3ef29d3881117c7` and candidate `7749f7dd16f063b1d6f603887dc038b77c3a1496`, preserving the source changes individually.

| Files | Resolution |
| --- | --- |
| Context page and CSS | Preserve #710 card, material, identifiers and bidi refinements, original refresh and the inner wave marker |
| Administration page, CSS and summaries | Preserve localized dates/page names and hidden review form, validated local access, separate unavailable source, native labels and spaced actions; retain intent/CAS/readback |
| sf-u28.ts | Preserve #710 copy and the additional access/source keys in both locales |
| Memory pages and CSS | Preserve typed readers, scalar payloads, choices and owner fences. Remove only the broad sf-workflow wrapper marker to avoid its global 760px layout; retain the local 1160px composition. Textarea receives the established native control/focus tokens and vertical resizing |

Resolution [a28348dd](https://github.com/gustavomhss/Orchestra-SF/commit/a28348dd960f0d1217527a5502fb577a52a9e2fc) changes the two memory wrapper classes and local textarea selectors. Six other overlaps were already source supersets. No shared stylesheet, producer, DTO, route codec, guard or deadline changed in that resolution.

## Real-source qualification

`packages/app-shell/e2e/sucafina/final-memory.spec.ts` uses a separate isolated installation for each UI61, UI62 and UI63 journey, genuine operator enrollment and the original four-decisions fixture. Each journey retains 300 seconds, original HTTP observations 40 seconds and DOM assertions 10 seconds. Test observers forward selected original requests once and deliver unchanged source responses; they do not fabricate product state, authority, grants, Atlas responses or receipts, add an application read or retry mutations.

The final `final-memory-seed.ts` reads the existing original Planner projections and emitted evidence, creates an additional January case through the human HTTP boundary, records pending cost categories, promotes both alternatives and retains the producer's conditioned comparison. It records an original closed-month outcome selection before any signal condition exists. The original outcome response must be HTTP 503 with `reason: "coverage-incomplete"`; the browser must present that limit and must not render numeric comparison cells. Only afterward does the helper register the original condition for UI61.

A separate attempt at complete numeric qualification is preserved in commit [94ca7bf](https://github.com/gustavomhss/Orchestra-SF/commit/94ca7bf318e5f37a007e596f03e568b6458c9dd2) and run R3. The original Planner accepted two copied plans, each with nine separately priced, confirmed January components, and the original coverage and promotion commands accepted both inventories. The subsequent original `decision-compare` request exceeded the unchanged 40-second deadline. That run failed; **numeric expected/observed comparison is not qualified by this delivery**. The exploratory inventory helper is absent from the final candidate. No subtotal was relabeled as nine categories, missing cost made zero or unsupported not-applicable assertion submitted.

The journeys retain these required assertions; actual outcomes are reported separately below:

- UI61 original conditions without automatic signal reads, independent materiality, real signal request start and local abortion, preserved condition while pending, exact cancellation copy, no resend and selection erasure. Signal consultation is the last step; nothing afterward depends on a new source response.
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


The final [0d11a60f](https://github.com/gustavomhss/Orchestra-SF/commit/0d11a60f952243b967b664847ce300bb99353b32) observes the common metadata snapshots once per invocation while preserving five separate admissions, digests, bindings and one-shot validations. Two passes across the cases/preferences namespaces now perform **four original C08 reads**, with individual revalidation after every namespace and final lifecycle checks. There is no cache across requests or F01 invocations. Common metadata instability closes all operations; an individual binding, validation or cleanup failure drops only that operation. Every admitted lease is registered before validation and every finish is attempted independently; final currentness is checked after all cleanup.

Fourteen new cases cover four/eight reads across one/two invocations, canonical ordering, validation/revalidation revocation, per-operation failure isolation, throwing finish at multiple positions, late binding changes, metadata changes, shared read failure and abort. Root and both peer implementers independently reviewed this source.

[Native69 run 45112013210](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45112013210), job `137486273104`, snapshot `2032885b3d834bbc17a5ee1cdf51a05531ab00ee` of candidate `c2794f7fe028f9febd764cddeb094ca959d63088`, passed **69 tests, zero failures and 887 expectations**: 66 memory cases, one original native installation check and two routine phase-origin cases. State/C08/business content remained unchanged; only the two declared derived-bookkeeping families were observed. The later client codec fix does not change this CLI backend.

## Local-administration boundary

The pinned original handler `apps/cli/src/sucafina-product/native-ui/domain.ts` returns `local-operator-reader-not-bound` for the notifications/backups projection. Its private I00 reader is not exported. This change preserves that boundary and does not bind a synthetic reader.

The UI now distinguishes validated local access from that unavailable projection. It consults F01 operational availability before attempting the read, shows a named unavailable section, and keeps the independently admitted summaries reader/command usable. It does not claim that the unavailable notification or backup collections are empty. No backup, restore or JSON import command is newly admitted.

## Evidence and gallery

The durable [R11 gallery](./GALLERY.md) contains the actual bounded previews. Its [manifest](./evidence/manifest.json) separates successful journeys from visible states captured within failed journeys.

### Technical gates

The root's combined candidates passed app types, e2e types, guards and palette checks in [45093119702](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45093119702) and [45094187488](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45094187488). The canonical process-bootstrap correction passed app/core/e2e types, guards, palette and regressions in [45094586912](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45094586912), including eleven existing filesystem/Omni tests. One existing mode-1 case is skipped by its original strict-mode condition.

The later composed [Gate5 run 45097130282](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45097130282) passed all seven technical checks, including CLI types and the same eleven Core regressions. The [Gate8 run 45100895381](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45100895381), snapshot `05d03508e4c2dce30f22ae4517cc96647cd638bb` on composed candidate `eb8ddf92853ca9bbd37745658632c2ae51d47b82`, passed all seven checks: app, e2e, Core and CLI types, original guards, palette and eleven original Core regressions (one original strict-mode skip). This candidate includes the memory observer and independent journey steps. The subsequent scalar payload delta is verified by a later gate; it is not covered by an assumed equivalence.


[Gate14 run 45112967729](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45112967729), job `137489259871`, snapshot `6229c5c97f194bde0c5c91eda63aa2a7123a85ab` on R10 candidate `c66b9857d86fd2b91fb6c57237a82923c460ed02`, passed the seven original technical checks with the batched observer.

The final [Gate16 run 45117046888](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45117046888), job `137502149296`, snapshot `a42eb2adf1e8447c865feba3ea3d30227d9266ac` on exact R11 candidate `cb924bd6cda9bb1fd2ac304618d3a8760b80d94e`, passed **nine checks**: app, E2E, Core, CLI and client types; original guardrails; unchanged palettes; original Core regressions; and native/Files codec regressions. The codec suites passed **12 tests and 243 expectations**, including all six new undefined-wire tests. The unchanged 78-rule guard set, pinned to base `27f04c1cc723e42d5010b8f672a640b4792787ff`, checked 71 paths with zero errors, zero approval exemptions and ten declared-timeout warnings. Seven palettes remained byte-identical. Eleven Core regressions passed with the one existing strict-mode skip. Technical qualification does not substitute for browser outcomes.

### Focused browser runs

| Run | Observed result | Consequence |
| --- | --- | --- |
| [45093745713](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45093745713) | Startup failed when Playwright transformed a TypeScript declare field reached through AppProcess | No screen evidence; use the independently reviewed canonical leaf-import bootstrap fix |
| [45094574346](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45094574346) | 1/3 passed: UI67. Memory seed received the original incomplete-coverage refusal; UI69 exposed the unbound source | Preserve the source limits and separate validated local access from the unavailable projection |
| [45096429681](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45096429681) | 2/3 passed in 9.1 minutes: UI67 and UI69. Complete-inventory memory seed timed out in original decision-compare at 40 seconds | Numeric comparison remains unqualified; UI69 real review/save/CAS/readback passed. Preserve the failed qualification and exercise the original pending flow explicitly |
| [45098619818](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45098619818) | 2/3 passed in 9.7 minutes: UI67 and UI69 with final layout. Pending memory setup passed; UI63 route was denied before its leaf | Add the missing original read observer. Preserve the denied route evidence; no route guard is relaxed |
| [45100913281](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45100913281) | 2/3 passed in 12.9 minutes: UI67 and UI69. UI63 opened its no-condition choice and rendered the verified coverage refusal; UI62 rejected a reactive period object before transport, and the memory test reached 300 seconds | Preserve the failure; use exact scalar payloads. Correct the test's raw opaque deep links through the existing F01 route codec, and log every failed independent step without suppressing it |
| [45101681785](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45101681785) | 2/3 passed in 13.1 minutes: UI67 and UI69. UI63 repeated its first real capture; the old raw test deep link was still present. Memory failed its aggregate, with no page errors or repeated contract-mismatch diagnostic | Preserve the failure. The older aggregate reporter does not expose the individual failures; UI61 and UI62 are not qualified by this run |
| [45102802678](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45102802678) | 2/3 passed in 13.3m: UI67/UI69; canonical UI63 deep link admitted but DOM10 preceded original reads | Await original HTTP before unchanged DOM10, preserving the failed aggregate |


| [45104661696](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45104661696) | R8: 2/3 passed, 13.5m. UI67/UI69 passed; full English UI63 step passed. Conditions HTTP 200 in 5,967ms; original signals did not respond within 40s | Preserve the source limit; expose conditions independently, make signals explicit and locally cancellable; isolate memory installations |
| [45107929407](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45107929407) | R9: 1/5 passed, 21.5m: UI67. Initial reads reached DOM too early. UI61 independent actual signal start/cancel and UI63 Portuguese deep-link refusal passed | No materiality or recall request was exercised. UI61 image filename said light 320 but actual image was 1440px dark; qualify only actual dimensions/theme |
| [45112934520](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45112934520) | R10: 0/5 passed, 23.1m. CDP body eviction, a catalog codec rejection before HTTP, summary readback timing and narrow-theme order | Preserve all distinct failures; correct source-admitted undefined and the observation order without larger deadlines |
| [45117078885](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45117078885) | R11: 3/5 passed in 25.8 minutes; UI63, UI67 and UI69 passed. UI61 original materiality exceeded 40 seconds; UI62 original recall POST returned 503 | Conditions, choices without conditions, exact coverage refusal, context refresh and one summary save/readback are proven separately; materiality and recall remain unqualified |

UI67's successful run includes four actual captures: dark desktop current context, light desktop refreshed context, light 320px context and Brazilian Portuguese dark desktop. The desktop preview was reviewed by the area implementer and root; hierarchy, card, identifiers and gutters were accepted. All four captures passed viewport overflow checks, the refresh retained the exact principal, and console/page error collections were empty. The evidence is in [artifact 14783036959](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45094574346/artifacts/14783036959).

R3 includes five actual UI69 captures: dark desktop settings, light desktop review, light 320px review actions, light desktop persisted summaries and Brazilian Portuguese dark desktop administration. The original summary save occurred exactly once after review, advanced the source CAS by one and survived a fresh page. UI67 also passed again. Both areas had no console or page errors. The original evidence is in [artifact 14783443814](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45096429681/artifacts/14783443814). Review of its desktop JPEG prompted the final action-row and label refinements.

R4, on composed candidate `ccbc79ca47352691d0acbc812ca04db83435088e`, reconfirmed all nine UI67/UI69 captures, the context refresh and the real reviewed summary save/readback. Four JPEG previews were reviewed: dark and light context, dark administration and 320px light review actions. The corrected action row, 14px labels, native material, spacing and narrow controls were accepted. All nine PNG captures passed horizontal viewport checks; both tests had no console or page errors. See [artifact 14785125752](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45098619818/artifacts/14785125752).

R5 supplied the first actual UI63 desktop image with its selected recorded choice, original reason/date and the exact incomplete-coverage message. The area implementer and root accepted its hierarchy, selection treatment and spacing. The original [artifact 14785698742](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45100913281/artifacts/14785698742) preserves this partial evidence and the failed memory journey; it does not constitute a fully passed UI61–UI63 qualification.

The test now encodes both opaque outcome links with the original `encodeSfRouteRef` function. The original route matcher requires its `r_` UTF-8 base64url segment and passes the decoded producer locator to the leaf. This corrects test navigation without changing the product route, codec or admission.

### Directed corrections after R8–R10

R8 [artifact 14787368136](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45104661696/artifacts/14787368136) preserves the original signal request's 40-second failure. The producer can reconcile observed records and perform Planner work before returning; cancellation in this view does not stop that source work. Product [ea20f0dc](https://github.com/gustavomhss/Orchestra-SF/commit/ea20f0dc98903a7d9533494cec326ccc504618f7) separates recorded conditions from explicit signal reading. The final test runs signals last and proves only actual request start, browser abortion and current local state, never an invented signal HTTP 200.

R9 [artifact 14789106497](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45107929407/artifacts/14789106497) preserves six PNGs. Conditions returned HTTP 200 in 6,152ms in the final independent step. The signal request was observed and locally aborted; the condition remained visible, cancellation copy was precise, and changing selection erased local state with no resend. Materiality and recall were not reached. Its UI61 cancellation image was **1440×1100 dark**, despite its light-320 filename. Only that actual state is qualified. UI67's four context captures and refresh passed; Portuguese UI63 preserved the exact original coverage refusal.

R10 snapshot `ee44197dd7ce1d0ba83cd3bacb0b6ca71d7855b9` tested candidate `c66b9857d86fd2b91fb6c57237a82923c460ed02`. [Artifact 14790834255](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45112934520/artifacts/14790834255) preserves all five failed journeys and three real UI69 PNGs: dark desktop settings 1440×1100, light desktop review 1440×1100 and light narrow review actions 320×900. The two JPEGs were visually approved by the implementer and root: hierarchy, labels, native material, action spacing and narrow wrapping. These qualify presentation states, not persisted save.

- **CDP body eviction:** UI61/UI62/UI67 hit `Network.getResponseBody: No data found for resource with given identifier` in the original observer. Shared helper [6e56f318](https://github.com/gustavomhss/Orchestra-SF/commit/6e56f3182c1fde560c3042e3c0d01538366f83c7) forwards each selected original GET exactly once, with no retries/redirects, retains its durable APIResponse and fulfills the original bytes unchanged. Caller [d782d8a3](https://github.com/gustavomhss/Orchestra-SF/commit/d782d8a3af757c4ce5922dd26a4e91b342719678) registers/closes asynchronously and attempts every cleanup.
- **Catalog never dispatched:** `SfIntelligenceMemoryCatalog.input` is the original `Schema.Undefined`. Client bindings parsed it correctly, then rejected it as JSON before I/O. The original `SfWireDecodeResult` already permits `SfJson | undefined` and the GET URL builder already handles it. [0dae6496](https://github.com/gustavomhss/Orchestra-SF/commit/0dae6496fb20997d4327fec79ee6894afaf0bfd2) adds only the source-admitted absent-value branch after closed schema parsing. Six real-codec tests preserve required-input/output, excess-property and nested-undefined rejection. Schema, registry, authority and transport admission are unchanged. Gate16 passed all six new and six original Files codec tests.
- **UI69 readback timing:** POST 200 precedes the product's original persisted GET. [6fbcbe5a](https://github.com/gustavomhss/Orchestra-SF/commit/6fbcbe5af4286138e8b0ef8fa312eab6583f9c8b) observes that GET before the single save, waits within HTTP40, decodes the original closed schema and compares exact stamp, version+1, pages and original CAS payload. All DOM10 checks and the one-write assertion remain.
- **Theme order:** UI61 tried the native desktop toggle after entering 320px, where it is hidden. The same spec correction chooses theme at desktop width before narrowing in both materiality and independent cancellation steps. The cancellation stage still starts last. All 108 existing expectations remain; six readback checks were added.

No materiality or signal request was exercised in R10. Its catalog wait is **not** evidence of a slow producer: the client stopped before HTTP. Browser JavaScript/console diagnostics were empty in that run, but its incomplete journeys remain failures.

### R11 outcome and exact evidence

[Run 45117078885](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45117078885), job `137502251987`, snapshot `257717aa632d7f029ec27b4d3cb8b9a603bad0a6` on candidate `cb924bd6cda9bb1fd2ac304618d3a8760b80d94e`, completed at 05:47:18 UTC on 23 November 2026. It passed three of five test-scoped journeys. All journeys retained 300 seconds, original source observations 40 seconds, DOM assertions 10 seconds and retries 0. The original five-test spec retains all 114 expectations.

| Area | Proven in R11 | Remaining boundary |
| --- | --- | --- |
| UI61 | Initial catalog and cases returned 200; the original conditions read returned 200 in 6,046 ms. Recorded condition, idle signal control and zero automatic signal requests passed. Dark/light 1440px and light 320px captures are real. | Original materiality did not respond within 40 seconds. Subsequent same-host work also timed out. The R11 signal step never reached its GET; no signal response or cancellation is claimed from R11. The separate R9 native abort evidence remains historical. |
| UI62 | Case list and selected case were returned by the original producer; the Brazilian Portuguese authorized-candidate step passed. | The original similar-cases POST returned 503. The test had read its body but did not log the reason before its unchanged 200 assertion failed. R11 therefore does not identify a source reason or qualify recall matches. |
| UI63 | Entire journey passed: original recorded choice with no signal condition, exact `coverage-incomplete` 503, no numeric comparison cells, opaque locator reopening, owner/stamp checks, selection clearing, zero browser memory commands, dark/light/narrow and Brazilian Portuguese. | The numerical comparison remains unavailable in the original source; no numerical result is inferred. |
| UI67 | Entire journey passed: active server/project/installation/principal, original context refresh, responsive identifiers and Brazilian Portuguese, with no page or console errors. | Actual browser zoom was not measured. |
| UI69 | Entire journey passed: local operator authorization, original I00 unavailable presentation, retained draft through Revise and Cancel, exactly one reviewed save, closed-schema persisted readback, exact context, CAS version increment and proposed pages, fresh-page persistence and Brazilian Portuguese. | PR715 subsequently added spacing inside the summary content wrapper. The focused R13 repetition passed on that composition. Notifications/backups remain unavailable at their original I00 boundary. |

R11 produced 19 full-page PNG attachments and 14 bounded JPEG previews. The original Playwright artifact is `14792609948`, 32,801,200 bytes, with digest `sha256:11e1b788ee2c8a4beae575e889c4d9cd3c4dec29e690b7e9e92ecf22a1db5a45`. The JPEG bytes are preserved in this directory without editing; [GALLERY.md](./GALLERY.md) and [evidence/manifest.json](./evidence/manifest.json) identify their exact source run, states, dimensions and Git blobs. Every recorded capture had document width equal to its viewport width.

The fourteen previews were visually reviewed. UI61 preserves a useful condition independently of the signal action; the 320px controls stack without horizontal overflow. UI62's Brazilian Portuguese labels and selected original case are legible, but this is an authorized-candidate presentation, not a successful recall result. UI63 keeps the choice hierarchy and coverage warning readable in dark, light and narrow views. UI67 aligns identifiers and the refresh action inside the shared page width. UI69 separates the summary editor from the unavailable notifications/backups source; the review actions stack with full targets at 320px.

### Focused follow-ups after R11

PR715 was composed at `722b703b060e5cc578fa8d23568b3f9c56d72077`, tree `6949be73c3bce882df95ed956685bdbc39f50311`. Its only overlap here adds a grid and row gap to the authorized summary state content. Source review confirmed compatibility with the unchanged fieldset, review actions, hidden-state rule and 44px targets.

A first focused request, run [45120144344](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45120144344), was rejected by the original test-ci request validator because `--grep` is not an admitted spec path. No browser test executed. The validator and workflow were not changed. The corrected R13 uses a snapshot-only named spec containing the byte-identical original UI69 test, setup and mutation observer; it retains the permanent five-test spec.

- UI69 R13: [run 45121178514](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45121178514), job `137515072792`, snapshot `4d1aa02cca18a6116933c9a23acf50767fba6271`, base `722b703b`: **passed, 1/1 in 4.7 minutes**, with the 30 original body expectations and preflight preserved. The single save, exact CAS/readback, fresh page and Brazilian Portuguese all passed without page or console errors.
- UI62 R14: [run 45121399352](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45121399352), job `137515748521`, snapshot `0729f9e4c3cc0e91956a8c8209c73f80bf06ed3e`, same base plus the reviewed bounded diagnostic: failed at `response.json` with `Network.getResponseBody: No data found for resource with given identifier`. The original source returned 503 and the browser rendered unavailable, but its reason was not captured. The original case read returned 200 and the Brazilian Portuguese candidate step passed. Artifact `14793947041` preserves that failed observation. The positive 200 assertion and all match, privacy and source checks remain.
- The recall diagnostic in commit `bb97d390f56a104c095638b0866f11a13eec5942` emits only original HTTP status, source status/reason and match count, before the unchanged assertion. It does not emit request headers, question content or a private body, and adds no request.

R13's five PNGs and three original JPEG previews had document width equal to viewport width. All three previews were visually reviewed: the added summary gap is present, the original two-column controls and native fonts are preserved, and 320px review actions remain readable. [GALLERY.md](./GALLERY.md) includes them; [evidence/r13-ui69-manifest.json](./evidence/r13-ui69-manifest.json) records exact blobs and artifact `14794405155` (4,289,649 bytes).

The R14 evidence-collection defect is isolated to the observer. Commit `9b9831a12d63a9ff9abbb0909841d39c37ba819b` adds an observation of the one original POST through a durable APIResponse, with zero retries, zero redirects and the same 40-second deadline. It uses the original closed response schema and delivers the unchanged response to the browser even when decoding fails. All 114 existing expectations remain byte-identical. No source expectation changes before the original reason is obtained.

UI61's local materiality-cancel controls passed in [run 45122439989](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45122439989), job `137519060570`, snapshot `b0931669e80589776a6ce8a1e63b8957a5e2d280` on `d62c4b500695d248240a48944461a0d2262a589f`: **two journeys passed in 11.7 minutes**. They use independent installations and native Request/requestfailed observations, completing all healthy condition/language reads before the expensive consultation. Both recorded exactly one original GET and `net::ERR_ABORTED`: materiality in English and signals in Brazilian Portuguese. Single-flight controls, retained condition, exact local-cancellation copy, absence of invented results/empty state, zero resend and selection cleanup all passed. The materiality action retained keyboard focus when its label changed to Read materiality. Page and console error lists were empty.

R15 produced twelve full-page PNGs and eight original JPEG previews. Every capture used an actual 1440px or 320px viewport with matching document width. All eight previews were visually reviewed: condition cards and source actions remain distinct, narrow controls stack, references wrap and the cancellation wording does not claim source rollback. [evidence/r15-ui61-manifest.json](./evidence/r15-ui61-manifest.json) records exact states/blobs and artifact `14795160692` (8,799,295 bytes).

The positive materiality and signal-result assertions stay in the original spec and remain unqualified. Source reconciliation may continue after the browser abort. Late-response and owner fences were reviewed in source; these tests did not receive or inject a late source body, and no such exercise is claimed.

R16 [run 45123256492](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45123256492), job `137521673423`, snapshot `de718cd31d6e38a22934274a8d4bba72b108587f` on `6a9f4e9768019ceb3a7924523885a9c3ebc51fb7`, obtained the original recall body with the durable observer. At 06:26:02 UTC, both the bounded raw marker and the post-decode marker recorded **HTTP 503, status `unavailable`, reason `similarity-source-unavailable`**, without truncation. The original closed output schema accepted the body. The preserved positive assertion then failed with expected 200 / received 503; the run remains a failure. The case read returned 200, Brazilian Portuguese candidates passed, no browser memory command was issued and page errors were empty. Artifact `14795175598` retains the result.

This reason is a collapsed source category. Source review establishes that the fixture records original choices and features but does not attest completed Atlas publication; it does not establish that an outbox, model or any particular internal branch caused this response. No publisher, grant, alternate result or retry was introduced. Positive recall matches remain unqualified. A separate presentation qualification can assert this exact refusal without changing the preserved positive test.

See [qualification.json](./qualification.json) for durable revisions and status. No pending follow-up is recorded as a pass.

## Limits

Actual browser zoom is not measured. Materiality and recall are not qualified by R11; their original timeout and 503 remain recorded. No original signal response has been qualified. Numeric expected/observed comparison is not qualified: the full nine-component attempt exceeded the original 40-second comparison deadline and remains recorded as a failure. The final pending fixture preserves incomplete coverage and renders the source refusal. Notifications and backups remain unavailable at the original I00 boundary; summary settings are independently admitted and tested. An observed difference does not establish causality. Source absence or denial remains visible and cannot be converted into a successful read or recommendation by presentation code.
