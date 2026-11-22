# Review and proposal qualification attempts

All runtime execution uses the repository's existing test-ci workflow. Temporary ci-run branches carry only the existing runner selector and an exact shared header/fixture composition. No workflow is changed.

## Attempt 1 — source identity boundary

- Product: `b5d5bfaefce6c85f81f2d4f3ad45cb083a956e1c`
- Snapshot: `693a8e985f556f7fe3eba533f7c4668613d7644a`
- Branch: `ci-run-sf5reviews1`
- [Run 44977715259](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44977715259)
- Test job: `137071223168`; failed. Cleanup job `137072061750`; succeeded.
- Production native bundle built, but the channel still showed DEV in this first diagnostic run. All later acceptance candidates explicitly use ORCHESTRA_CHANNEL=prod. Original Budget Overview and Portfolio Dashboard review projections both returned HTTP 200 / status ok.
- Failure: the second Add to agenda control remained disabled because both original sections use the same canonical `dashboard` identity. No producer identity was replaced to bypass the condition.
- Correction: preserve the original one-section agenda; verify disabled reorder and meeting-navigation controls, a real preservation preview/confirmation, two original preservations and the comparison between them. Multiple-section ordering is explicitly not qualified.
- Browser diagnostics at failure: no uncaught page errors.
- Two JPEGs extracted from the test's SF_DESIGN_PREVIEW log chunks and manually viewed. The initial source/selection hierarchy is readable. The source filter and Available sections heading needed additional spacing; scoped CSS now supplies that gap. These are failed-attempt evidence, not final acceptance captures.

### Captures

- [Initial agenda](attempt-01/UI47-dark-desktop-initial-selection-test-data.jpg)
- [Failure at the original shared section identity](attempt-01/FAILED-native-wave-three-test-data.jpg)

## Original fixture requirement

The corrected installed journey uses an original Hot Topic draft seed. The original seed must include a notes string, since the existing producer only publishes an editable draft when all required fields are present. That source field is populated through the existing fixture's DashboardPeople command, without an authorization, identity or receipt patch.

## Attempt 2 — original preservation and reader boundary

- Worker source: `a94b78407fb39870ea7c79e3c4c4f8ff5fccc9aa`; tree `91e2fd1e12d27d9b5d165c20292c047821afaeb1`.
- Root composition: `243f954da9dceb505795e7c7457b4de9c7c074d6`.
- Snapshot: `1ab66bc6c2cfde0744c07dd781090317f06587fc`; branch `ci-run-sf5reviews2`.
- [Run 44978497130](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44978497130); test job `137073622833` failed; cleanup `137074691096` succeeded.
- Production bundle succeeded. Two original preservations and original preserved-review reads returned HTTP 200 / ok. The source update returned HTTP 409 / stale / `review-read-changed`, visibly retained by the presentation. The test had incorrectly required editable-successor data.
- The native reader also rejected preserved material although the original read succeeded. No replacement material was supplied. This required a separate source/reader diagnosis.
- Nine JPEG previews were manually viewed. The production badge is absent, the corrected filter gap is readable and 390px confirmation controls fit. Confirmation metadata needed a completed-stage heading and spacing; those changes are included in the later fix.
- Shared source fixture notes were added through the existing DashboardPeople save; exact native-host blob `b940b99d4739cd5ef38620fad982bbfd997909a3`.
- The root composed exact owned contents after GitHub rejected worker ref/parent operations despite readable objects. Unlaunched snapshot objects had no run and no runtime result.

Selected diagnostic captures:
- [UI47 desktop preview](attempt-02/UI47-dark-desktop-preservation-review-test-data.jpg)
- [UI47 390px preview](attempt-02/UI47-dark-390-preservation-review-test-data.jpg)
- [UI48 original material boundary](attempt-02/UI48-detail-dark-desktop-test-data.jpg)
- [UI48 true stale update](attempt-02/FAILED-native-wave-three-test-data.jpg)

## Attempt 3 — raw source passed, reactive reader failed

- Snapshot: `d5772a4c1ea148e84ed9c8ad6dd5899919fa2f6a`; root parent `096224f`.
- Branch: `ci-run-sf5reviews3`.
- [Run 44979219718](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44979219718); test job `137075805492` failed; cleanup `137076837211` succeeded.
- Direct original source JSON passed the unchanged `SfReviewDomainProjection` codec. Content keys were exactly context, version, engineVersion, components, values and missing. The native stored value still showed material unavailable.
- The protected update again returned HTTP 409 / stale / `review-read-changed`; its visible alert passed the revised negative assertion.
- Failure: the page-wide Compare reviews button locator matched the sidebar and native primary action. The test now submits the existing scoped comparison form.
- Ten PNG/JPEG captures were produced. The two focused diagnostic JPEGs below were manually viewed; the remaining eight reproduce the earlier stages and are retained in the workflow's canonical artifact.

Focused diagnostic captures:
- [UI48 presentation still rejecting reactive material](attempt-03/UI48-present-dark-desktop-test-data.jpg)
- [UI49 two references before scoped submission](attempt-03/FAILED-native-wave-three-test-data.jpg)

## Attempt 4 — native store boundary repair

- Worker source: `cdcd063ec3064237b38cdcba23955cf7883f3f90`; tree `e352e74f08d46e1735d99455b5e76863a8e4b4ca`.
- Root composition: `9b6e0fea1c228a40bee20afe5643da86767bed5f`.
- Snapshot: `ecf798af379fb05a6dcd1d9abb43dfabe69a8029`; branch `ci-run-sf5reviews4`.
- [Run 44979779861](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44979779861); test job `137077528027` failed; cleanup `137078954180` succeeded.
- Both production channel and strict process mode are enabled.
- The owned reader unwraps and clones only a Solid proxy before applying the original closed codec. Raw input continues through the same strict decoder. No source field, schema, authority or receipt is added.
- Tests use the original preserved source as the positive case; five malformed copies must fail. Actual native value count must equal the original producer's value count after opening the preserved result.
- The original source passed the unchanged codec; all five malformed-copy negatives passed. The installed native values matched the original count. The unsent question survived presentation entry/exit. Both original reviews compared compatibly with no numeric or section-order change. Real source-provenance differences were displayed.
- Failure: the report format select did not resolve by its exact Office format accessible label. The captured live control also occupied a malformed tall card with the label on the far right. No report generation was attempted.
- 21 JPEG previews were extracted from the logs. Five representative previews were manually inspected independently by the review owner and root reviewer. UI47 confirmation was clean. UI48 presentation still formed a raw text wall; the detail grid crowded identifiers into four columns. UI49 needed section gaps and a stable first column. UI50 needed a native explicit label and compact format control.
- Source evidence states were also incorrectly passed to a workflow-status formatter, displaying confirmed as Unavailable. Unitless source scalars were marked Unavailable by the generic amount formatter. The next correction is limited to preserved-source display: exact literal scalar, source currency/unit separately, and an exhaustive mapping of the original evidence enum.
- Narrow, pt-BR and proposal stages were not reached in this attempt. No acceptance claim covers those unexecuted stages.
- Canonical artifact: `14737252394`, `playwright-ubuntu-24.04-1`, 35,872,639 bytes; digest `sha256:4eb273c5947ff932c369b168435a44979feca76940c207f067693a97e394093f`, expires 2026-11-29T03:21:15Z.
- Saved representative JPEGs are in [attempt-04](attempt-04). Their original log names and Git blob identities are recorded in [capture-provenance.json](capture-provenance.json).

## Attempt 5 — source-value layout and independent proposal fixture

- Worker source: `0c80f6d29b05a21c9d4b4d6553c0cc84863a1029`; tree `e5263ad08007d8701bc870b181638eb301cbd2b5`.
- UI54 is a separate first Playwright journey with its own test-scoped original installation, registered original draft seed, page diagnostics and external-write guard. UI47–50 retain the two original preserved revisions as their shared source.
- UI48 now uses two value columns, one narrow; presentation shows structured literal values and complete source evidence in expandable sections. Controls precede the content. Additional captures target actual value content as well as the page top.
- UI49 uses stable table columns and the existing accessible scroll region. UI50 uses an explicitly associated Office format label and a 44px select.
- Positive assertions compare actual native scalar text and evidence labels with the original preserved JSON. Comparison rows are derived from the two original source reads and checked against the rendered cells.
- Root composition `72884298af5b1f22fa060dfea1d021ed73a308bd`; snapshot `9727a17a9917568fdb15221f05aadaa546c42130`; branch `ci-run-sf5reviews5`.
- [Run 44981425185](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44981425185); test job `137082540215` failed; cleanup `137085115830` succeeded. Two independent tests failed.
- UI54: first original dashboard-workbench read returned HTTP 503 / unavailable with no reason, before any case or draft creation. No proposal success, application or receipt was synthesized.
- UI47–50: all planned dark/light/390px/pt-BR stages ran. Exact original scalar/evidence assertions, source-backed comparison rows, Office format selection and unsent-draft retention passed. Both page-error collections were empty. The final broad external-write observer incorrectly counted ten POSTs; original metadata declares collaboration.recipients to be a read. The next observer uses the complete original method/path/fixed query/discriminator and only admits an unambiguous read, retaining every unknown or non-read as a violation.
- Forty JPEGs are saved in attempt-05. The run remains FAILURE. Only captures explicitly listed as manually viewed in capture-provenance.json are claimed reviewed.
- Actual visual inspection found the report selector corrected, comparison columns/gaps readable and presentation structured. The detail grid still showed four columns: the earlier shared :is selector's type specificity outranked the two-column rule. The following correction removes values from that shared summary selector.
- No report or message action was invoked. The failed observer does not by itself prove ten mutations; the next run will identify the exact original operations.

## Attempt 6 — exact read classification and original draft setup

- Worker source `36c95712654468326a5398d2cf687b32776a26ca`; tree `d8d35ecc5f803473696b0cc9f3e5f8bf2f7b492b`.
- The only product change is the source-value grid specificity correction.
- UI54 first opens the native proposal route and records its actual state. Current context operation availability is logged. The fixture then follows the original Decisions seed order: sf_case_draft with empty source references, original control read, original workbench target evidence, then original draft registration. No readiness result is forced. This is a diagnosis of the original source boundary, not a claim that the 503 has been resolved.
- The presentation additionally expands an original source line and checks the preserved source period and reference IDs before capture.
- Root product `a4a672733d1e7dc31f6c3be23d721751791e1c67`; snapshot `b14c5cf12617115062f41fcad95522a101e06ab1`; branch `ci-run-sf5reviews6`.
- [Run 44982867971](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44982867971); test job `137086993796` failed overall; cleanup `137088951777` succeeded. One test passed, one failed.
- UI47–50 passed the complete source-backed journey, including dark/light/390px/pt-BR, literal source values and evidence, malformed-copy rejection, original comparison rows, Office format selection and unsent discussion draft retention. The exact original descriptor classified all ten observed collaboration.recipients POSTs as reads. There were zero prohibited external writes and no uncaught page errors.
- UI54: the actual native page's initial dashboard-workbench POST returned HTTP 200 / ok. Native context also returned 200 and the original workbench, draft and case commands were ready/operational. The genuine case draft succeeded. A separately reconstructed APIRequestContext workbench request with an explicit period then returned HTTP 503 / unavailable with no reason. This does not establish unavailable native source or a readiness failure, and case-first ordering did not resolve that reconstructed request.
- The next test uses the successful original response consumed by the native app as its target/evidence and verifies draft registration with a second actual native read. The separately reconstructed 503 remains a recorded diagnostic boundary.
- Forty-two JPEG previews were produced. Three focused images were manually viewed and saved in attempt-06: the corrected two-column light detail, expanded original source evidence, and the native initial proposal missing record. The remaining previews are retained in the canonical artifact and are not independently claimed visually approved.
- Canonical artifact `14739006661`, 56,568,356 bytes, digest `sha256:71921c5f09710ff7a468b07f5fb5a4643f337f75c9977065d7a92062dfb94bfc`; expires 2026-11-29T04:05:34Z.

## Attempt 7 — actual native response and final coverage

- Worker spec/helper: `50fa5f1bebdc61b57fd89c3f6e6f53032b20f395`; spec blob `411458a4777f78f06e09cfcd0f936c9b4d37c6a6`; helper blob `5b08c2b74e77d8cc71cb49929421cb313d1b6370`.
- Root product `2a73ad159e3c5529425f11b94b71677cef7dd1bb`; snapshot `f342372f5562a5a7aeedc1bd78a8ace5e7816962`; tree `8ec48a3a5f4d84a15e3f486e9edecaae4c3a9ec9`; branch `ci-run-sf5reviews7`.
- [Run 44983842825](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44983842825); test job `137089978301`.
- The proposal setup consumes the actual successful workbench response received by the installed native app. The original case and draft commands remain real authenticated source writes; the registered draft must appear in a second successful native workbench read, with exactly one draft, zero preparations and zero applied changes.
- Capture-only coverage also targets the actual UI48 protected stale-update alert and the UI49 mobile table at both its leading and current-source columns.
- Production channel and strict process mode are enabled; existing trace-disabled Playwright fixture and test-ci workflow are unchanged.
- Overall FAILURE: UI47–50 passed; UI54 failed before case/draft creation. Cleanup job `137092153047` succeeded.
- UI54 failure was response-body acquisition: Chromium returned `Network.getResponseBody: No data found for resource with given identifier` when the test read the already-observed HTTP 200 response after enter() completed. No source 503, proposal success or draft registration was inferred from this instrumentation failure.
- UI47–50 again passed every original-source assertion. New captures show the protected 409 alert and the real 390px comparison scroll region, including its fully scrolled Current column. Exact source operation classification and empty uncaught-page-error assertions passed.
- Forty-four JPEGs are saved in attempt-07. Thirty-three were manually viewed, covering every UI47–50 dark/light/narrow/pt-BR stage plus lists, preview, confirmation, draft retention, source expansion, PPTX and the new negative/mobile captures. Remaining previews are preserved without a separate visual approval claim.
- Canonical artifact `14738754452`, 57,823,198 bytes; digest `sha256:5073a328bbc3f8552106fb186b288d4138539e8bfc3ebdf0b64252ba0cb33073`; expires 2026-11-29T04:19:32Z.

## Attempt 8 — isolated proposal body acquisition

- Worker full spec `63124044504ad277093cfc829ca6bad48293c3f8`, blob `7cda60f820508ac4123693a97cd9ffe2e0eeee56`; helper remains `5b08c2b74e77d8cc71cb49929421cb313d1b6370`.
- Same root product `2a73ad159e3c5529425f11b94b71677cef7dd1bb`; snapshot `18d749eaa2202d7f92a310f22612bd51c92892a7`; tree `d1cf39b7b3a5d71f8a4107df8812dd1ab64741c4`; branch `ci-run-sf5reviews8`.
- [Run 44984801462](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44984801462), test job `137092914888` SUCCESS; cleanup `137093729824` SUCCESS. One isolated proposal journey passed in 2.0 minutes.
- The response-body promise begins immediately, concurrently with the unchanged enter() helper, which performs one navigation. Only a DevTools-body acquisition error can fall back to APIRequestContext.fetch with the exact observed Request. Origin, path, POST method and sf value must match dashboard-workbench; its original descriptor must declare effect read. No period, headers, source fields or authority are reconstructed and no write is replayed.
- In this successful execution, both bodies came directly from the original native browser responses. The exact-read fallback was not used.
- Original workbench returned 200 / ok; original sf_case_draft returned 200 / ok; original dashboard-hot-topic-draft returned 200 / ok. The second native workbench returned 200 / ok and verified exactly one registered draft, zero preparations and zero applied changes.
- The original draft rendered the exact seeded action. Missing-selector negative, light/dark desktop, 320px reflow and pt-BR all passed. Both browser contexts had zero page errors and zero console errors. No forbidden write was observed.
- Only the disposable CI spec overlay removes the second UI47–50 test declaration. The product spec retains both. Workflow, runner arguments, source producers and trace-disabled fixture remain unchanged.
- All six JPEGs were manually viewed and saved in attempt-08. The proposal fields remain readable, the narrow view uses one column, and the source-unavailable negative remains explicit. Preparation and original receipt remain unavailable because no current choice was registered; no successful application or receipt is manufactured.
- Canonical artifact `14739805051`, 7,040,756 bytes; digest `sha256:1637f43c17d3b52deac7d255f32b60395bd48976131e88c388c4b441218e4b64`; expires 2026-11-29T04:26:29Z.
- Final functional coverage is the UI47–50 PASS from attempt 7 plus the isolated UI54 PASS from attempt 8, on the same product parent. Earlier failed runs retain their failure status.

## Parallel technical finding

Composed technical run `44978462385` found TS2367 in the agenda primary-action branch: stages already excluded by the conditional were redundantly compared inside the disabled predicate. The correction removes only impossible comparisons and keeps review/recovery visibility intact. Corrected interim agenda blob: `d7f1a85fa88536574cda43a5ef791a41e0a33691`.

## Composed technical qualification

[Run 44981671317](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44981671317), job `137083298996`, snapshot `d3cb92d71c89a42531a40a617d8f5863b40c17ac`, product `b69429f5632cd15d524ef3df3527714a2ab8c13e`: root reported all 12 gates passed, including 94 regressions, CLI/app/E2E type checks, guards, palettes and English/pt-BR parity. This qualifies the review source at 0c80f6d; later CSS/test-only deltas are being requalified with the final composed candidate.

## Later composed technical receipts by scope

The following scope results were reported by the root reviewer; workflow conclusion and exact snapshot parent were independently read through GitHub. This is a combined receipt across runs, not one all-green workflow.

| Run / job | Exact product and snapshot | Passing scope | Whole run |
| --- | --- | --- | --- |
| [44984291851](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44984291851) / 137091355355 | Product `825fb6254cee8a1408c7209184fc39b28e469fbc`; snapshot `24c57bb6df131d58a20382115ff56fd46d6b0795` | app-shell/client/E2E type checks; 78 guard checks over 82 files: zero errors, zero approved exceptions, touchesGuards false; 8 BI cases | failure |
| [44984522074](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44984522074) / 137092065071 | Product `1034d148cdccbb5116b1e24ecb27e545103bf0f8`; snapshot `af362894ef621eafb4e2c649c5809373c47d50a4` | 14 A05 cases after the test-only oracle correction | success |
| [44982954980](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44982954980) / 137087267520 | Product `71d28fd6ee3a3fb9850ee3439a6952cbf2554d44`; snapshot `62649821b05061b9eb19d56974241fefdcbca500` | palette equality; 46 new bilingual pairs; 357 original English values unchanged | success |
| [44982725552](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44982725552) / 137086557478 | Product `7a9e0696ff353d9352938abd2c5527d76f0a47b1`; snapshot `6b0c54613d3df6436735b122fe1670d4e32b2d66` | CLI type check; 94 original-source regression cases | failure |

The A05 failure was an oracle issue corrected in the subsequent test-only run. The newest review spec body-acquisition change is later than that E2E type-check receipt; its runtime is covered by attempt 8, and root owns any final narrow integration type check. Localization is unchanged by the final CSS/test-only changes.
