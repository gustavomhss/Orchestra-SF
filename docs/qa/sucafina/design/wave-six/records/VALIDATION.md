# Records validation — UI57, UI58, UI59, UI60 and UI68

## Current result

This is an evidence checkpoint through **R14**, not an all-green declaration. The latest original Operations lane passed **2 of 4 tests**: exact XLSX export and the complete native positive scenario. Import and document journeys each stopped at a response-to-DOM boundary. The ongoing correction observes the existing outgoing authority checks; it must preserve the original requests, retries, producer results and deadlines.

Earlier executions separately prove the full original import journey (including recovery, exact effects and foreign-owner controls) and the full original document journey through final source revocation. R9 and R10 passed those three original journeys; R11 passed complete documents/revocation and export. R12 and R14 passed the separate positive UI60 scenario. These records do not substitute for a final green composed lane.

The most recent executed snapshot is [0076fde9](https://github.com/gustavomhss/Orchestra-SF/commit/0076fde9ce0349949ff7214fc72bed892c9fb4c6), exact parent [3311ce94](https://github.com/gustavomhss/Orchestra-SF/commit/3311ce94e3d1c7e9de0a09a6d6c60868c440489c), run [45116737792](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45116737792), job 137501190158. It adds only this unchanged request:

```json
{
  "package": "app",
  "directory": "packages/app-shell",
  "runner": "playwright",
  "config": "e2e/playwright.production.config.ts",
  "args": ["e2e/sucafina/operations.spec.ts"]
}
```

The existing Linux test-ci lane qualifies the real ClamD scanner for that exact request. Repository work and execution used GitHub MCP. No local execution, Azure lane, workflow change, fake response, mocked DTO or invented grant was used.

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

UI55/UI56 preserve the workflow styling and copy merged by [#710](https://github.com/gustavomhss/Orchestra-SF/pull/710). The seven overlapping files were resolved from common base a5eee358, composed records source 7749f7dd and dev 65349c1c. Resolution [cad6a473](https://github.com/gustavomhss/Orchestra-SF/commit/cad6a4737a37fdfca513dbf313d9bc219eedad63) preserves upstream labels, source disclosures, menu/tab selectors and optional captures alongside the records scope and unknown-state fences. It unions the header-row label. The later #714 dev update was documentation-only. Shared/root-owned runtime observations are documented centrally, rather than claimed as new record producers.

## Functional evidence

**Import.** One real preview and one Apply; loss-of-response recovery resolves the same receipt; independent workbook/data/CAS checks retain exact values and mutation counts. UI57 reopens the original reference and shows its exact diff. Original cross-tab logout and foreign-owner denial remain. The post-save CAP23 observer is armed only after review and before the unique confirmation. Only an observed original socket failure or HTTP error permits the existing bounded read-only recovery; helper, codec and assertion errors propagate.

**Documents.** The original supplier source and real scanner upload are retained, followed by an authorized signed download of the exact private bytes. Invalid schema creates no candidate; explicit schema/extraction returns the exact value 42 USD, UTF-16 range 7–9 and blob/text digests. Human confirmation produces the original confirmation version and new evidence digest. Deleting the same supplier preserves CAS and revokes the asset 403, evidence 409/stale and candidates 503/unavailable; the UI removes source text and candidates, and final discovery must be empty. R9–R11 completed this original revocation path. R12 reached the clearing assertions but expired during final discovery; R14 stopped earlier at presentation rendering and is not claimed as a full document pass.

**Restricted scenario.** The old Operations policy intentionally lacks sf_scenario_simulate and planner.preview. It checks original target discovery 403, disabled simulation actions and readable confirmed evidence, then continues its original source-revocation journey. No grant was added to make it positive.

**Native positive scenario.** A separate original native installation uses the canonical local operator and qualified ClamD. Its existing Dashboard contract authority creates a real contract (CAS 0→1), identifies its unique new ID through independent CAP14 readback, uploads under the original 25 MiB limit (CAS 1→2) and reads back attachment name/size. Explicit extraction and human confirmation supply the original 42 USD evidence. Planner setup independently reads its version/line and baseline. These API steps are fixture preconditions, not UI coverage. The actual UI discovers targets, submits its one original preview and verifies the exact request/evidence, domainApplied:false, original total:null and unchanged Planner baseline/CAS. All 28 preview assertions and empty page/console error arrays passed in R12 and R14. No persistent scenario link is submitted.

**Export.** UI68's actual XLSX download matches the original authorized producer bytes. JSON, suppliers and register were source/health reviewed, not claimed as executed downloads. No individual purchase-order or other format download is added to this slice's proof.

## Observation and deadline boundaries

The client performs a real F01 authority read before every web Files operation and another after decoding its JSON response. A producer HTTP200 alone does not prove that the consumer has received the result. The test observes original producer bytes and outgoing checks before starting the existing DOM assertion; it forwards a selected request once with retries/redirects disabled and delivers the original APIResponse unchanged. It emits no additional request and fabricates no reply.

The shared navigation helper observes the two distinct original provider/route context reads on a fresh page, with closed schema, exact tuple/principal/stamp and the original 40-second read deadline. Its module is free of fixture imports and suite hooks. The initial document catalog additionally validates its original source response and next authority read before the unchanged option/value check. The normal consumer serializes requests before sources. Correlation relies on that actual serial path; final DOM checks and bounded diagnostics still detect another concurrent load.

The systematic review now in progress covers successful JSON reads/writes, typed errors, automatic chained operations and reentry. Bytes, denied 401/403 outcomes and intentionally lost mutation responses have different original transport behavior and must not be forced through a nonexistent success fence. Independent API readbacks and original domain commands remain separate.

Default deadlines remain 210s for import, 180s for documents, 60s for export and 300s for native scenario, including the unchanged 180s native setup scope. Retries remain 0. The existing opt-in SF_WORKFLOW_VISUAL_CAPTURE=1 mode retains 420s; this lane does not enable it. Extra pt-BR remounts of the same document/evidence/scenario review are confined to that original optional sweep; their real earlier captures and assertions remain preserved. No original functional source/CAS/revocation assertion was removed.

## Captures and visual review

The [central evidence gallery](../evidence/README.md) and [manifest](../evidence/manifest.json) persist selected original JPEGs with exact run/snapshot/blob provenance. [R12 artifact 14791015797](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45112944681/artifacts/14791015797) contains 31 PNG states and 11 JPEG previews. [R14 artifact 14792197238](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45116737792/artifacts/14792197238) contains 19 PNG states and 7 JPEG previews.

Records, root and the routines peer directly reviewed the positive UI60 desktop frame: original 42 USD source, destination/month, preview action, known subtotal 42, unavailable total and no-domain-change copy are visible and distinct from the optional link action. The approval is limited to that actual frame; it does not establish an unshown positive pt-BR or narrow result.

UI57's pt-BR receipt and light before/after values, UI58's catalog, UI59's compact original-source review in light 320 and pt-BR, and UI68's forms were also directly reviewed on their cited snapshots. The oversized candidate row was corrected. Names wrap without horizontal overflow; original field values remain aligned; technical source metadata stays in disclosures. Root's central manifest identifies the particular persisted captures.

Desktop captures use 1440×1100; narrow captures use 320×900. Full-page screenshots do not expand the application's internal scroller. Focused previews scroll the real scroller; images are not generated, stitched or recomposed. A PNG existing is not a claim that every below-fold region was manually reviewed. Native overflow assertions accompany the captures.

## Copy audit

Against dev after #710, [copy-audit.json](copy-audit.json) verifies 178 pre-existing English pairs unchanged, no changed or removed English pair, 23 new EN/pt-BR pairs and 89 existing BR values translated in sf-u23.ts and sf-u24.ts. This does not claim that upstream #710 preserved earlier English copy. Planner remains the product name. Summary outcomes localize only known enums; technical details retain the original raw values and unknown enums use raw fallback.

Terminology follows existing domain vocabulary, the [Microsoft Portuguese (Brazil) style guide](https://aka.ms/portuguese-brazil-styleguide) and [Mozilla's pt-BR vocabulary](https://support.mozilla.org/pt-BR/products/firefox/settings/import-and-export-settings). These are language references, not a formal localization certification.

## Technical gates and scope

[Gate14 run 45112967729](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45112967729), job 137489259871, snapshot 6229c5c97f194bde0c5c91eda63aa2a7123a85ab, exercised product c66b9857: all 7 checks passed (app-shell/E2E/Core/CLI types, guards, palette parity, original filesystem/strict regressions). There were 78 guard rules against dev 27f04c1c, zero errors or approved exceptions, 10 declared-budget warnings, 7 byte-identical generated palettes and 11 original regression passes plus 1 pre-existing skip.

[Native run 45112013210](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45112013210), job 137486273104, snapshot 2032885b3d834bbc17a5ee1cdf51a05531ab00ee, exercised backend c2794f7f: 69 tests/887 assertions passed. The memory observation batch keeps five separate original leases, two source snapshots, per-operation and final revalidation, isolated cleanup and four namespace reads per invocation. F01's before/after pair therefore makes eight such reads. This is a count/contract proof, not an end-user latency benchmark.

A GitHub comparison from c66b9857 to R14 parent 3311ce94 identified only six E2E paths, with product/runtime/client/catalog/workflow bytes unchanged. Subsequent shared client changes and their technical suites are recorded in [central validation](../VALIDATION.md); an older successful product gate is not represented as testing later source. The final browser gate is still open at this checkpoint.

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
| 12 | [45112944681](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45112944681) | 3/4 | Import, exact XLSX and the complete positive native scenario passed. Positive preview retained all28 payload/evidence/domainApplied=false/total=null/baseline/CAS assertions. Documents passed deletion and source revocation but reached 180s on final catalog navigation. The duplicate UI59 pt-BR mount was moved to the existing optional sweep. |
| 13 | [45114882863](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45114882863) | 2/4 | Import and XLSX passed. Native navigation hit CDP Network.getResponseBody loss on an original context 200 response, fixed by the shared durable response observer. Documents returned the expected source but no option appeared by DOM 10s; the original navigation and sources exit fences were observed before that check. |
| 14 | [45116737792](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45116737792) | 2/4 | Exact XLSX and complete positive native scenario passed. Import targets returned the expected original selectionRef but the option was absent at DOM 10s (imports.ts:441). Documents returned the confirmed excerpt 42 and original asset but UI60 was still loading at DOM 10s (documents.ts:582). A systematic review of every Files response-to-DOM transition is in progress; no runtime, request, retry or deadline change is authorized by this result. |

## Limits

- XLSX is the only executed UI68 file-byte proof in this slice.
- UI59 verifies rejection disclosure and required fields but does not persist a rejection.
- UI60's link action is visible but not submitted; total remains unavailable under original incomplete coverage.
- Fixture API preconditions are not UI coverage; restricted Procurement and authorized native Dashboard installations are distinct.
- No full assistive-technology or WCAG certification is claimed.
- This checkpoint preserves actual successes and failures. It is not authorization to treat incomplete browser qualification as green.
