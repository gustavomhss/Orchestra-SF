# Review and proposal handoff

## Outcome

The five owned areas have passing original-source installed journeys and manually reviewed dark/light, narrow and Brazilian Portuguese evidence. UI47–50 passed in attempt 7; UI54 passed in isolated attempt 8, both on product `2a73ad159e3c5529425f11b94b71677cef7dd1bb`. The combined attempt 7 workflow keeps its failure status because its separate proposal test failed response-body acquisition. No failed run is relabeled as successful.

The actual UI is presented in [REVIEW-GALLERY.md](REVIEW-GALLERY.md). This is a draft candidate for Gustavo to inspect before merge. No merge, deployment, PR comment or user approval was performed by this worker.

## Exact source and runtime receipts

| Item | Identity |
| --- | --- |
| Pinned source base | `d3ccea42b5f8409c8d6c68e4909f7b868b50322c` |
| Worker branch | `sf-next-reviews` |
| Last product delta | `36c95712654468326a5398d2cf687b32776a26ca`, only source-value grid specificity after `0c80f6d29b05a21c9d4b4d6553c0cc84863a1029` |
| Final full journey source | `63124044504ad277093cfc829ca6bad48293c3f8` |
| Full spec blob | `7cda60f820508ac4123693a97cd9ffe2e0eeee56` |
| Original draft seed helper blob | `5b08c2b74e77d8cc71cb49929421cb313d1b6370` |
| UI47–50 runtime | [run 44983842825](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44983842825), test job `137089978301`; review test passed, whole run failed proposal acquisition |
| UI47–50 snapshot | `f342372f5562a5a7aeedc1bd78a8ace5e7816962`, root parent `2a73ad159e3c5529425f11b94b71677cef7dd1bb` |
| UI54 runtime | [run 44984801462](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44984801462), test job `137092914888`, cleanup `137093729824`; both successful |
| UI54 snapshot | `18d749eaa2202d7f92a310f22612bd51c92892a7`, same root product parent |
| Durable image commits | `bd188aaaa7ea5a9155736f701be6f351847c98c7` contains all 6 proposal JPEGs; `8de842517534c88ceac377d5d3cae58914c19767` also contains all 44 final review-run JPEGs |
| Workflow | Existing test-ci only; production channel and strict mode; no workflow changes; original trace-disabled fixture |

The isolated attempt 8 CI overlay removes only the second test declaration from its disposable spec. The full product spec retains both independent tests. No runtime product file differs between the final two qualification snapshots because of this worker.

## Result by area

| Area | Product behavior | Genuine source exercised | Boundary retained |
| --- | --- | --- | --- |
| UI47 agenda | Separate discovery and selected sequence; explicit preview, revise, confirm and completed stage | Original Budget Overview discovery and two original preservations | One canonical dashboard section; reorder and next/previous controls correctly disabled |
| UI48 preserved review | Known-reference opening; distinct detail and presentation; values primary, complete source identifiers secondary; expandable evidence | Original preserved JSON, unchanged closed codec, exact rendered values/evidence, preserved periods and source references | No native authorized list; real stale update 409; local unsent discussion retained |
| UI49 comparison | Paired reference form and stable columns in accessible horizontal scroll region | Two original preserved reads; comparison cells asserted against source-derived rows | Only real source provenance differences; no numeric/order differences invented |
| UI50 reports | Known-reference source opening; one labeled Office format control; original section selection | Original preserved source; DOCX/PPTX selection and section retention | No native report list; no report generated, published or sent |
| UI54 proposal | Source-bound draft and existing preparation/review/receipt stages | Actual native workbench body, original case/draft commands and native registered-draft re-read | No current choice, preparation, applied change or successful receipt fabricated |

## Source reader correction

The original preservation succeeded, but Solid wrapping made the native consumer fail the strict decoder. The owned adapter now unwraps and clones only that reactive value before applying the same `SfReviewDomainProjection` codec. It does not coerce, fill, authorize or relax source data.

The actual producer-created JSON supplies the positive test. Five malformed copies must fail: missing context, missing capabilities, unexpected period property, non-finite value and invalid granularity. Actual native value counts and literal scalar/evidence text are checked against the original source.

Source evidence is mapped exhaustively to native bilingual labels. Currency/unit metadata is separate from the literal scalar, so raw values are not mislabeled through unrelated amount or workflow-state formatters. Every original value, period and source reference remains available.

## Proposal acquisition and original writes

Attempts5/6 retain the reconstructed explicit-period request 503. Attempt 6 also established that the actual native workbench returned 200 / ok and the original operations were ready. Attempt 7 failed only DevTools response-body acquisition after navigation readiness.

The final spec begins body acquisition as soon as the original response arrives, in parallel with the unchanged navigation helper. A fallback permits only the exact observed original read Request when DevTools cannot expose its body. It verifies the original read descriptor and exact origin/path/method/sf; it constructs no period or authority and replays no write. This fallback was not used in the successful attempt 8.

The successful run consumed both native bodies directly. Original case draft and original Hot Topic draft registration returned 200 / ok. The subsequent native read contained exactly the registered draft, zero preparations and zero changes. Both language contexts had no page or console errors. No forbidden write occurred.

## Visual evidence and review

All 44 attempt 7 JPEGs and all 6 attempt 8 JPEGs are committed. The worker manually viewed 33 and 6 respectively, covering the full display matrix and these additional states: preserve preview/confirmation, missing native lists, real 409, unsent discussion retention, expanded source references, both mobile comparison positions, PowerPoint selection and missing proposal reference.

The other attempt 7 JPEGs are retained without an independent manual-review claim. Older diagnostic runs remain in their own folders, including the first DEV-channel attempt. Each attempt's original run/job, snapshot, artifact digest, saved blob identities and inspected names are recorded in [capture-provenance.json](capture-provenance.json); attempts7/8 also have standalone capture-manifest.json files.

Source limitations are not visually disguised. Multi-section reorder, a native review/report list, successful review successor, report generation/delivery, proposal application and original receipt success are not claimed. Reflow at 390/320px is not actual browser zoom or physical-device testing.

## Existing behavior and localization

The legacy report tests use legacy Dashboard routes and are untouched. Their report-form helpers were not rewritten. Existing native source preparation/recovery behavior and owner-bound references remain intact.

All 231 original English key/value pairs in the four owned catalogs remain byte-for-byte unchanged. There are 24 new bilingual pairs and 37 existing discussion messages translated for pt-BR. Producer-supplied values and identifiers stay original. [LOCALIZATION.md](LOCALIZATION.md) records terminology references and the existing English-map Portuguese literal that was deliberately preserved.

POST does not by itself imply a write. The original operation registry classifies the observed collaboration.recipients requests as reads. The test observer admits only one exact method/path/fixed-query/body-discriminator match with effect read; unknown or non-read operations in the forbidden send/publish/report/proposal families fail. No message, notification, report action or proposal application is invoked.

## Integration and technical scope

Root owns the shared frame, installed fixture host, source-composition fixes, inventory and integration. This worker changed only the 17 source/test files below and its QA directory. It did not write dev, sf-design-next, another worker branch, source producers, schemas, authorization, guards or workflows.

The root's technical receipts are recorded by exact scope in [ATTEMPTS.md](ATTEMPTS.md) and capture-provenance.json. They span CLI/original-source regression, palette/copy, app/client/E2E types/guards/BI and the later A05 oracle correction. Some whole workflows failed unrelated scopes. They must not be presented as one all-green run.

The final body-acquisition spec came after the latest recorded E2E type-check receipt. Its runtime passed attempt 8; root will perform the final narrow E2E integration type check after integrating this exact full spec blob. Product and catalog files remained frozen during this final acquisition correction.

### Owned source/test paths

- `packages/app-shell/e2e/sucafina/design-support/wave-five-reviews-seed.ts`
- `packages/app-shell/e2e/sucafina/design-wave-five-reviews.spec.ts`
- `packages/app-shell/src/i18n/orchestra-chapters/sf-u25.ts`
- `packages/app-shell/src/i18n/orchestra-chapters/sf-u32.ts`
- `packages/app-shell/src/i18n/orchestra-chapters/sf-u33.ts`
- `packages/app-shell/src/i18n/orchestra-chapters/sf-u38.ts`
- `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/hot-topics/proposals/index.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/hot-topics/proposals/proposals.css`
- `packages/app-shell/src/orchestra/chapters/sucafina/reviews/agenda/index.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/reviews/compare/index.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/reviews/open-reference.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/answer.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/index.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/model.ts`
- `packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/value.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/reviews/reports/index.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/reviews/wave-five.css`

All evidence and this handoff are under `docs/qa/sucafina/design/wave-five/reviews/**`. Integrate the complete directory tree so the gallery links and provenance remain together.
