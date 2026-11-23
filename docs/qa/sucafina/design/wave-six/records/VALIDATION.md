# Records validation — UI57, UI58, UI59, UI60 and UI68

## Current result

**R15 passed all four original Operations tests** on the composed source, with the real ClamD scanner and unchanged requests, retry policy and deadlines. The result covers the complete import/receipt recovery, document confirmation and source revocation, exact XLSX download, and positive native UI60 scenario. Both the test job and cleanup completed successfully.

The executed snapshot is [f3125875](https://github.com/gustavomhss/Orchestra-SF/commit/f312587515353b15f59c5c362678d3090e167677), exact parent [d5f620ae](https://github.com/gustavomhss/Orchestra-SF/commit/d5f620aeee7a9db0e83d195ffada03c703f3a59d), run [45121980778](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45121980778), test job 137517602373 and cleanup job 137520897264. GitHub comparison confirms one commit and only `.ci-run.json` added to that source. The log reports **4 passed (7.7m)**, `SF_REAL_CLAMD_INSTREAM_READY`, 30 PNG states and 10 JPEG previews.

| Original test | Completed proof |
| --- | --- |
| OP-IMPORT-01 | Original targets, scanned XLSX, preview, one Apply, lost-delivery reconciliation, exact independent values/CAS, receipt/history reentry, cross-tab logout and foreign-owner denial |
| OP-DOC-01 | Real private upload and signed bytes, schema/extraction/digests, human confirmation, readable confirmed source, restricted scenario denial and final source revocation/discovery |
| OP-EXPORT-01 | UI68 downloads the original authorized XLSX with exact filename, MIME and bytes |
| OP-SCENARIO-01 | Original native installation previews confirmed 42 USD evidence; one real preview, partial total, unchanged baseline/CAS and no persistent link |

The unchanged request is:

```json
{
  "package": "app",
  "directory": "packages/app-shell",
  "runner": "playwright",
  "config": "e2e/playwright.production.config.ts",
  "args": ["e2e/sucafina/operations.spec.ts"]
}
```

The existing Linux test-ci lane qualifies the real ClamD scanner only for this exact request. Repository work and execution used GitHub MCP. No local execution, Azure lane, workflow change, substituted response, mocked DTO or invented grant was used. The earlier partial runs remain in [attempts.json](attempts.json) and the table below; they are retained as diagnostics, not aggregated into a substitute for this green composed execution.

## Product scope and design

| Area | Implemented journey and presentation |
| --- | --- |
| UI57 — Import history | Reopen a producer-issued reference; receipt/outcome and counts lead; before/after field values and technical source disclosures support review. There is no invented history collection. |
| UI58 — Documents | Choose an authorized source, register its original document and define an explicit extraction schema. Source/request/refresh and document/open controls occupy clear rows; upload is a native disclosure. |
| UI59 — Document evidence | Select a candidate, open its exact source excerpt, review the original value and confirm it. Compact value/state/action rows replace stretched cards. Rejection retains required reason/page controls. |
| UI60 — Evidence in scenario | Read confirmed evidence, discover an original authorized Planner destination and preview a scenario. The UI explains access limits, retains source identity and distinguishes partial coverage from a complete total. |
| UI68 — Exports | Select an admitted format and download the original authorized file through a concise form. Each download reauthorizes; no reusable retained blob link is invented. |

The implementation uses existing material, color and font tokens, native maximum width 1160px, body 13px, section headings 16px and 44px controls. Native disclosures and responsive stacking keep metadata subordinate to reading and actions. Dark/light and pt-BR use actual application preferences. No generated mock screen is evidence.

The document consumer's scope key includes route/surface/href and original owner/access/session generation. Equivalent same-owner publications preserve reads and confirmation state; genuine owner, authority and route changes abort and clear private data. The source selector is available outside the private state panel for an admitted owner, but remains disabled while busy or outcome-unknown. Server authorization still applies to every operation.

UI55/UI56 preserve the workflow styling and copy merged by [#710](https://github.com/gustavomhss/Orchestra-SF/pull/710). The seven overlapping files were resolved from common base a5eee358, composed records source 7749f7dd and dev 65349c1c. Resolution [cad6a473](https://github.com/gustavomhss/Orchestra-SF/commit/cad6a4737a37fdfca513dbf313d9bc219eedad63) preserves upstream labels, source disclosures, menu/tab selectors and optional captures alongside the records scope and unknown-state fences. It unions the header-row label. The later #714 dev update was documentation-only. The R15 source also includes [#715](https://github.com/gustavomhss/Orchestra-SF/pull/715), dev 5b48dab5. Its record/table presentation affects CAP23/CAP27 prerequisites used by the original journeys; those selectors and assertions remain unchanged. The five record leaves do not import the changed S01 record/table components. Shared/root-owned runtime observations are documented centrally, rather than claimed as new record producers.

## Functional evidence

**Import.** One real preview and one Apply; loss-of-response recovery resolves the same receipt; independent workbook/data/CAS checks retain exact values and mutation counts. UI57 reopens the original reference and shows its exact diff. Original cross-tab logout and foreign-owner denial remain. The post-save CAP23 observer is armed only after review and before the unique confirmation. Only an observed original socket failure or HTTP error permits the existing bounded read-only recovery; helper, codec and assertion errors propagate.

**Documents.** The original supplier source and real scanner upload are retained, followed by an authorized signed download of the exact private bytes. Invalid schema creates no candidate; explicit schema/extraction returns the exact value 42 USD, UTF-16 range 7–9 and blob/text digests. Human confirmation produces the original confirmation version and new evidence digest. Deleting the same supplier preserves CAS and revokes the asset 403, evidence 409/stale and candidates 503/unavailable; the UI removes source text and candidates, and final discovery must be empty. R15 completed every original revocation assertion and the final empty discovery. Earlier partial runs are separately retained in the attempt ledger.

**Restricted scenario.** The old Operations policy intentionally lacks sf_scenario_simulate and planner.preview. It checks original target discovery 403, disabled simulation actions and readable confirmed evidence, then continues its original source-revocation journey. No grant was added to make it positive.

**Native positive scenario.** A separate original native installation uses the canonical local operator and qualified ClamD. Its existing Dashboard contract authority creates a real contract (CAS 0→1), identifies its unique new ID through independent CAP14 readback, uploads under the original 25 MiB limit (CAS 1→2) and reads back attachment name/size. Explicit extraction and human confirmation supply the original 42 USD evidence. Planner setup independently reads its version/line and baseline. These API steps are fixture preconditions, not UI coverage. The actual UI discovers targets, submits its one original preview and verifies the exact request/evidence, domainApplied:false, original total:null and unchanged Planner baseline/CAS. All 28 preview assertions and empty page/console error arrays passed in R12, R14 and R15. No persistent scenario link is submitted.

**Export.** UI68's actual XLSX download matches the original authorized producer bytes. JSON, suppliers and register were source/health reviewed, not claimed as executed downloads. No individual purchase-order or other format download is added to this slice's proof.

## Observation and deadline boundaries

The client performs a real F01 authority read before every web Files operation and another after decoding its JSON response. A producer HTTP200 alone does not prove that the consumer has received the result. The test observes original producer bytes and outgoing checks before starting the existing DOM assertion; it forwards a selected request once with retries/redirects disabled and delivers the original APIResponse unchanged. It emits no additional request and fabricates no reply.

The shared navigation helper observes the two distinct original provider/route context reads on a fresh page, with closed schema, exact tuple/principal/stamp and the original 40-second read deadline. Its module is free of fixture imports and suite hooks. The initial document catalog additionally validates its original source response and next authority read before the unchanged option/value check. The normal consumer serializes requests before sources. Correlation relies on that actual serial path; final DOM checks and bounded diagnostics still detect another concurrent load.

The systematic review is complete in [c5af35b](https://github.com/gustavomhss/Orchestra-SF/commit/c5af35b59123a59ff5b94cfdfac2d057a7c7da82) and [cc16504](https://github.com/gustavomhss/Orchestra-SF/commit/cc16504f67115cad96f672dfd3da322beca757eb). Successful import target/admission/preview/reference reads and both history reads (reference then detail) observe the existing outgoing context before DOM checks. Documents do the same after admission, schema, extraction, candidate reads, presentation and confirmation, including reentry and typed candidate-unavailable 503. Original payload/value/digest/CAS comparisons precede the authority check. Fresh entries observe the two original provider/route reads; optional locale mounts arm observations before navigation.

Multipart import admission keeps Chromium's own bytes and boundary at CDP response stage. The intentionally lost Apply and aborted receipt read, preflight 401, foreign-owner 403 and independent API readbacks keep their original observers. Byte downloads retain the original bounded reader and its authorization checks; the JSON observer does not replace it. A single forwarded original request is delivered with its own status, headers and body, without extra requests, automatic retries or a substituted response. Every new registration is closed, including on assertion failure; cleanup preserves a primary failure and propagates its own failure after an otherwise successful action.

The original live-context RESOURCES list repeats all six import operations in each of import-admit, import-preview and import-apply. The assertion therefore verifies each resource independently. Document operations are checked in documents and evidence; scenario discovery/preview is checked only in document-scenario. Both root and a peer reviewed the source delta before the unchanged Operations request was dispatched.

Default deadlines remain 210s for import, 180s for documents, 60s for export and 300s for native scenario, including the unchanged 180s native setup scope. Retries remain 0. The existing opt-in SF_WORKFLOW_VISUAL_CAPTURE=1 mode retains 420s; this lane does not enable it. Extra pt-BR remounts of the same document/evidence/scenario review are confined to that original optional sweep; their real earlier captures and assertions remain preserved. No original functional source/CAS/revocation assertion was removed.

## Captures and visual review

[R15 artifact 14794332605](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45121980778/artifacts/14794332605) contains the complete final capture set: **30 PNG states and 10 JPEG previews**, 21,216,198 bytes, artifact digest `sha256:8ebe1b0dfe9de0b573aecdc49a2b706939df2c723f4cd98934825efbb13c86ed`. The [central evidence gallery](../evidence/README.md) and [manifest](../evidence/manifest.json) persist all ten R15 JPEGs with exact run/snapshot/blob provenance. The separately retained pt-BR UI59 review is from R10 and keeps its own source attribution.

| Area | PNG states | JPEG frames personally inspected in R15 |
| --- | ---: | --- |
| UI57 | 7 | pt-BR confirmed receipt; light before/after original field values |
| UI58 | 5 | Dark authorized catalog |
| UI59 | 5 | Original-source review in dark/light desktop and light 320 |
| UI60 | 8 | Restricted confirmed-source desktop; focused positive native scenario result |
| UI68 | 5 | Authorized export form in EN and pt-BR desktop |

All ten final JPEG frames were directly inspected. UI57 prioritizes outcome/counts and keeps technical metadata in disclosures. The diff preserves aligned before/after values. UI58's source/request/refresh and document/open controls remain grouped. UI59's compact candidate row and long filename wrap without horizontal overflow at 320px. UI68 preserves a clear format selection and export action. No blocking visual defect was found in these observed frames.

Root and peer reviews of earlier matching product states are retained in the central gallery. The routines peer independently reviewed the final R15 [UI59 light 320 frame](../evidence/ui59-review-original-source-light-narrow.jpg) and [positive UI60 desktop frame](../evidence/ui60-preview-from-confirmed-evidence.jpg). The UI60 frame shows the original 42 USD source, destination/month, preview action, known subtotal 42, unavailable total and no-domain-change copy, distinctly from the optional link action. The approval does not establish an unshown positive pt-BR or narrow result, or a submitted link. UI59's narrow JPEG ends at Open original and does not show the lower confirmation actions; the original functional assertions and PNG state are separate evidence. Likewise, the restricted UI60 screenshot starts at the top; it does not visually prove the below-fold access notice that the test asserts.

Desktop captures use 1440×1100; narrow captures use 320×900. Full-page screenshots do not expand the application's internal scroller. Focused previews scroll the real scroller; images are not generated, stitched or recomposed. A PNG existing is not a claim that every below-fold region was manually reviewed. Native overflow assertions accompany all 30 captures.

## Copy audit

Against dev 5b48dab5 after #715, [copy-audit.json](copy-audit.json) verifies 178 pre-existing English pairs unchanged, no changed or removed English pair, 23 new EN/pt-BR pairs and 89 existing BR values translated in sf-u23.ts and sf-u24.ts. The two baseline catalogs are byte-identical to dev 65349 after #710, and the R15 catalogs match the previously audited candidate. This does not claim that upstream #710 preserved earlier English copy. Planner remains the product name. Summary outcomes localize only known enums; technical details retain the original raw values and unknown enums use raw fallback.

Terminology follows existing domain vocabulary, the [Microsoft Portuguese (Brazil) style guide](https://aka.ms/portuguese-brazil-styleguide) and [Mozilla's pt-BR vocabulary](https://support.mozilla.org/pt-BR/products/firefox/settings/import-and-export-settings). These are language references, not a formal localization certification.

## Technical gates and scope

[Gate 17 run 45122426354](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45122426354), test job 137519017208 and cleanup 137519768016, snapshot `f76d89f2b6b4791034da108c5a6f80840da2e11e`, exercised source `d62c4b500695d248240a48944461a0d2262a589f`. All **9 checks** passed, with 16 wrapper assertions. This includes app-shell/E2E/Core/CLI/client typechecks, guards, generated palette parity, original filesystem/strict-process regressions and original JSON/Files codecs. The result records:

- 78 guard rules against dev `5b48dab52621037168ad4e3a6243c79a4fe5ad6e`, 105 paths, zero errors or approved exceptions, 13 deadline-declaration warnings and no guard modifications.
- Seven generated palettes byte-identical to their committed contents.
- Eleven existing filesystem/process tests passed, one pre-existing skip and 37 assertions.
- Twelve original/client codec tests passed with 243 assertions, including all 28 original Files codec registrations.

A direct GitHub comparison from the R15 product parent `d5f620ae` to Gate 17 source `d62c4b50` contains only the focused memory consultation spec and three UI61 files (copy, view and CSS). None of the four records observation helpers, five record leaves, Files producers or transport changed. Gate 17 therefore typechecks the exact records sources exercised by R15. Its snapshot adds only the verification wrapper and its `.ci-run.json`.

[Native run 45112013210](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45112013210), job 137486273104, snapshot `2032885b3d834bbc17a5ee1cdf51a05531ab00ee`, exercised backend `c2794f7fe028f9febd764cddeb094ca959d63088`: **69 tests/887 assertions passed**. The memory observation batch keeps five separate original leases, two source snapshots, per-operation and final revalidation, isolated cleanup and four namespace reads per invocation. F01's before/after pair therefore makes eight such reads. This is a count/contract proof, not an end-user latency benchmark.

Later composition-wide evidence is tracked in [central validation](../VALIDATION.md). These records qualify the source and operations named here; they do not claim that an older run executes unrelated later changes.

## Attempts

Exact snapshots, jobs and artifact IDs are retained in [attempts.json](attempts.json). A failed run establishes only the states it actually reached.

| Attempt | Run | Passed | Outcome |
| --- | --- | --- | --- |
| 1 | [45093613217](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45093613217) | 0/3 | Initial CAP23 precondition, document scope/reset and export admission failures. The first real UI58/UI59 captures identified an oversized candidate row; presentation and consumer fixes followed. |
| 2 | [45094613425](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45094613425) | 0/3 | Import navigation and original document scope/availability remained unresolved; export admission was still unavailable. |
| 3 | [45096465160](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45096465160) | 0/3 | Receipt/diff states were reached. The new fixture incorrectly expected an internal Planner ID omitted by public HTTP; independent CAP23 readback replaced that assumption. Existing menu and original Files route composition were aligned. |
| 4 | [45097457156](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45097457156) | 1/3 | The original import journey passed. The additional pt-BR source catalog used a different read's opaque selection reference; it was corrected to select the current uniquely named source. Export health had a typed-array hash input corrected by root. |
| 5 | [45098377984](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45098377984) | 2/3 | Import and exact XLSX export passed. UI59 light 320 and pt-BR and UI68 forms were captured. The old restricted Operations policy intentionally lacks scenario simulation; a separate original native installation was chosen for positive coverage without adding grants. |
| 6 | [45100334877](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45100334877) | 2/4 | Full original document/revocation and XLSX passed. Import hit its CAP23 precondition reader boundary. The new positive scenario fixture discovered that Settings.reset leaves the upload cap null; it was replaced with the original explicit save and independent CAS/readback. |
| 7 | [45102308724](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45102308724) | 2/4 | Import and XLSX passed. Chromium lost the original upload response body, so the existing one-request forwarder was reused. The native administrator lacks supplier policy; its original Dashboard contract source was used without adding buyer grants. |
| 8 | [45104593507](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45104593507) | 2/4 | Import and XLSX passed. Documents reached confirmation and restricted scenario but exhausted 180s before revocation; duplicate locale mounts moved into the existing optional visual sweep. Native preview POST 200 was reached, but its body was lost to CDP; this is not positive preview proof. |
| 9 | [45106511287](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45106511287) | 3/4 | Import, complete original document/revocation and XLSX passed after #710 composition. Native UI60 stopped at a DOM check before selected-source transport completion. |
| 10 | [45107932060](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45107932060) | 3/4 | The same three original journeys passed. The new context assertion expected one global candidates entry, although the frozen catalog publishes it in both documents and evidence; the assertion was corrected to resource-scoped uniqueness before any positive UI60 navigation. |
| 11 | [45109095822](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45109095822) | 2/4 | Complete documents/revocation and XLSX passed. Import remained loading after one acknowledged save while Bun logged its original 10s idle timeout. Native candidates returned 200 but still owed an outgoing F01 check. Response/fence observation was added without changing server or test budgets. |
| 12 | [45112944681](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45112944681) | 3/4 | Import, exact XLSX and the complete positive native scenario passed. Positive preview retained all 28 payload/evidence/domainApplied=false/total=null/baseline/CAS assertions. Documents passed deletion and source revocation but reached 180s on final catalog navigation. The duplicate UI59 pt-BR mount was moved to the existing optional sweep. |
| 13 | [45114882863](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45114882863) | 2/4 | Import and XLSX passed. Native navigation hit CDP Network.getResponseBody loss on an original context 200 response, fixed by the shared durable response observer. Documents returned the expected source but no option appeared by DOM 10s; the original navigation and sources exit fences were observed before that check. |
| 14 | [45116737792](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45116737792) | 2/4 | Exact XLSX and complete positive native scenario passed. Import targets returned the expected original selectionRef but the option was absent at DOM 10s (imports.ts:441). Documents returned the confirmed excerpt 42 and original asset but UI60 was still loading at DOM 10s (documents.ts:582). The subsequent c5af35/cc165 observation patch addresses the full response-to-DOM map while preserving runtime, requests, retries and deadlines. |
| 15 | [45121980778](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45121980778) | **4/4** | Complete original import/recovery/history/authority checks, document confirmation and final source revocation, exact XLSX and native positive UI60 all passed on source d5f620 with real ClamD. The systematic observer waits for the existing Files outgoing F01 before DOM, preserving all requests, negative cases, bytes, CAS, retries and deadlines. Thirty PNGs and ten JPEGs; all ten JPEGs reviewed. |

## Limits

- XLSX is the only executed UI68 file-byte proof in this slice. Other export formats have source/health review, not an executed download claim.
- UI59 verifies the rejection disclosure and required fields but does not persist a rejection.
- UI60's link action is visible but not submitted; total remains unavailable under original incomplete coverage.
- Fixture API preconditions are not UI coverage; restricted Procurement and authorized native Dashboard installations are distinct.
- No full assistive-technology or WCAG certification is claimed.
- The four green journeys and visual frames named above define this qualification. Earlier failures and unexecuted operations remain explicitly recorded.
