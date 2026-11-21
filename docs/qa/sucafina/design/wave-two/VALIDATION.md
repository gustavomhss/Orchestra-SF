# Wave two — validation and evidence

Historical wave-two verification. The user subsequently accepted the result and authorized integration; see [DEV-INTEGRATION.md](../DEV-INTEGRATION.md) and [PR #583](https://github.com/gustavomhss/Orchestra-SF/pull/583). Product: [`5012d7adf0e5d02576fe6a0add6f79331a812137`](https://github.com/gustavomhss/Orchestra-SF/commit/5012d7adf0e5d02576fe6a0add6f79331a812137). Branch: [`sf-design-two`](https://github.com/gustavomhss/Orchestra-SF/tree/sf-design-two), created directly from `dev bcdc109326de02e20c01c32ffb6b00bee3ff978d`. Date: 2026-11-21.

This record covers CAP02 Hot Topics, CAP03 Budget Overview and CAP04 OPEX. The first-wave approval applies only to UI29, UI33 and CAP01. It remains preserved in the parent inventory and first-wave evidence.

## Successful verification

| Verification | Product / snapshot | Result | Evidence |
| --- | --- | --- | --- |
| Real native Chromium journey | Product `5012d7a`; snapshot `270682e59522aaa5eb13486ea9a12e7a1d8b18f1` | **1 passed, 0 failed**, 2.9 minutes; retries 0; 39 preview names; no preview skips | [Run 44920647017](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44920647017), [job 136895711016](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44920647017/job/136895711016) |
| Application types, E2E types, repository guards and palette parity | Product `5012d7a`; snapshot `85c2129a35fd00eeebfe4c421e0366a1109bb1fd` | **4 passed, 0 failed**, 11 assertions; both type checks pass; 78 guards, 0 errors; all 7 generated palette files unchanged | [Run 44920652075](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44920652075), [job 136895726744](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44920652075/job/136895726744) |
| Confirmed-draft registry boundary | Product `263e694ef565376cc1af61cae0dc9e44777075b8`; snapshot `16247b0e6f7de087e8ce5d03fe0934fd53de4ac9` | **6 passed, 0 failed**, 29 assertions, 226ms | [Run 44919739363](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44919739363), [job 136892953895](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44919739363/job/136892953895) |

The registry, contracts and focused test blobs are identical in the final product. The later diff changes only the CAP02 reference-selector stylesheet, the browser journey coverage and review documentation; it does not invalidate that registry result.

All execution used the existing scoped `test-ci` workflow. The gate wrapper and `.ci-run.json` requests exist only on test snapshots, not on the product branch. No local product runtime, local build/test, workflow changes, guard suppressions or allowlist changes were used. Gate Omni positive control passed with six actual spawns; the registry suite has no spawn path and records the control as not applicable.

## Real installation and data

The browser suite builds the production app and starts an isolated installation using genuine enrollment and existing canonical producer commands. The original host, source adapters, authorization, review and command paths are exercised. No network interception, fabricated grants, fake receipts or alternate UI implementation is used.

The installation contains three initial topics, three OPEX lines, one CAPEX project and annual source settings. Visible labels beginning with “Dados de teste” distinguish test records. OPEX's regional line has an annual budget of 180000; January starts at budget 15000, actual 12400 and forecast 14200. Months with no producer value remain missing. The annual settings use month 6 and revenue 2400000.

The English and Portuguese contexts share only the genuine scoped installation cookie issued by the server. Portuguese uses the application's existing locale preference. Both contexts assert zero page errors. Console messages are attached for diagnosis; this report does not claim zero console errors.

## Behaviors verified

### CAP02 — Hot Topics

- Initial list, exact status filter, blocked subset and empty done subset; clearing returns the original three topics.
- Accessible field names for status/priority and explicit filter name.
- Creation editor, review, revise and cancel preserve entered values and focus. The narrow review keeps its action buttons completely in the viewport.
- One confirmed create command yields a visible success notice and no replacement editor/send control. Returning to the list reveals the fourth genuine record.
- Detail displays the saved source. Delete review can be canceled without a delete command.
- Existing-record review and cancel preserve the proposal; discard restores the source notes.
- One confirmed update rereads the source, keeps confirmation visible and permits a fresh edit of the same record using the new version.
- The final detail reference selector has a filled native field, 44px height, clear label spacing and a complete focus outline at 320px. Portuguese detail/editor/review were captured.

The focused registry suite covers exact confirmed-operation cleanup, omitted/wrong reference protection, unresolved state protection, pending/unknown protection and refusal to apply this success-only cleanup to clean/dirty/conflict states. It uses the real registry and draft controller; isolated external dependencies fail if unexpectedly called.

### CAP03 — Budget Overview

- Source-period totals remain source-period values. Selecting 2026 does not relabel unscoped totals as annual totals: missing annual financial values are explicit.
- Source month 6 and revenue 2400000 remain available in their correct annual scope.
- Month 7 enters review. Closing the disclosure restores the month/revenue readouts; reopening resumes the same proposed value and review.
- Cancel retains the proposal; discard restores month 6. Revenue 2600000 has the same review/cancel/discard behavior, restoring 2400000.
- Selecting the source-period option clears the year through the existing owner-bound port and restores source totals.
- Narrow review actions and Portuguese editor/review are covered.

No CAP03 mutation is confirmed in this journey. It verifies its existing edit/review/cancel/discard behavior and source scope, not a new successful budget write.

### CAP04 — OPEX

- List filtering, a new owner line, review/revise and confirmed draft discard produce no write and no new row.
- Detail presents the source identity, annual budget and monthly entries. January's known values are shown; month 7 explicitly remains unavailable.
- Monthly forecast changes from 14200 to 14600. Review/revise retains all fields; cancel closes the editor while retaining the draft; reopening resumes 14600.
- One confirmed save updates the real source. Fresh English and Portuguese reads show 14,600 / 14.600.
- A later Portuguese proposal of 14800 remains a draft after review/revise and is not sent.
- The 320px detail capture verifies header actions, annual budget and the beginning of the labeled monthly ledger. Separate narrow review captures verify all review buttons within the viewport.

The complete journey asserts **exactly three real confirmed commands**: topic create, topic update and OPEX monthly save. Cancel/discard paths do not add mutations.

## Visual evidence

The [gallery](evidence/README.md) and [manifest](evidence/manifest.json) preserve **39 JPEGs**, totaling 3,248,755 bytes. The JPEGs use quality 78; canonical PNGs and diagnostics are attached to [artifact 14713935784](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44920647017/artifacts/14713935784), retained until 2026-11-28. Artifact size: 48,782,184 bytes; SHA-256: `e632f3b61555497aa643efb34988ee1154b7bb516a926e5ceaefe0ce03497910`.

| Coverage | Evidence |
| --- | --- |
| All three initial views | Dark 1440×1100, dark 1440×800, light 1440×1100 and light 320×900 |
| Editors, detail and review | Named CAP02/CAP03/CAP04 states in the manifest |
| Narrow interactions | Three review action regions; CAP02 reference selector focus; beginning of CAP04 detail |
| Brazilian Portuguese | 11 actual captures: three main views, three editor/review pairs and CAP02/CAP04 detail |

The three workers performed the broader visual critique on the preceding complete green candidate `263e694`. Their exact inspected images are listed in [Topics](topics/REVIEW.md), [Budget](budget/REVIEW.md) and [OPEX](opex/REVIEW.md). That critique found the last CAP02 reference-field styling omission. The final candidate fixes it and reruns the entire journey; root and the relevant workers reviewed the new Portuguese detail, focused 320px selector and 320px OPEX detail. CAP03 and CAP04 product files are unchanged since their broader critique. This is not a claim that every worker individually inspected all 39 final files.

## Repository and source preservation

The current route registry blob `6e1e711e2ff3a95e460026053cb91772693da572` is unchanged. All **70 surfaces, 165 route patterns, 15 chapters and 75 component entrypoints** were checked against the non-truncated final app tree. Six surfaces have design work across the two waves; 64 remain inventoried for later work.

The final base comparison preserves 40 of the 41 upstream-changed paths byte for byte. The sole overlap is the necessary return-type annotation in `team-profile-web.ts`, described in [INTEGRATION.md](INTEGRATION.md); its runtime is unchanged. Existing 208 English catalog strings in sf-u02, sf-u38 and sf-u39 are unchanged. Added keys have English and Brazilian Portuguese values. New page CSS uses native tokens; the palette generator produces exactly the original seven files.

## Advisory findings and diagnostic history

The final guard run has **five warnings**, all from the timeout rule, and **zero errors or approval records**. Two warnings are inherited first-wave fixture/journey budgets. Three identify the second-wave 240-second installation/journey budget and the two 15-second per-action bounds. The 15-second bounds reduce previously unbounded per-action waiting; no timeout was increased to make a failing assertion pass. No guard file or ignore entry was changed.

Earlier diagnostic results are retained as history:

- Run 44918211856 captured twelve initial views, then failed on CAP02's implicit select accessible name. Explicit localized names repaired the product.
- Run 44918216827 found TS7056 in the new dev return-type inference. The explicit original-DTO return annotation fixed it.
- Run 44919606458 passed the full journey with 36 images on `263e694`. Its visual review found the reference-selector finish issue fixed in the final candidate.
- Run 44919616807 selected no registry tests because its Bun path omitted `./`. The corrected request ran the real six cases in 44919739363. The empty selection is not counted as a pass.

## Boundaries

- Actual browser zoom was **not measured**. 320 CSS-pixel reflow is reported only as reflow.
- This is Chromium coverage, not an exhaustive browser, device, network-failure or accessibility-certification matrix.
- Narrow captures are viewport crops. The OPEX 320px detail image does not show later months, the ledger footer or monthly edit controls below the viewport.
- CAP04 annual-entry, deviation editing and delete review have no new screenshots in this matrix. CAP05 isolation was reviewed statically, without a new CAP05 runtime matrix.
- Guards and type checks do not prove that every unvisited state or all 70 inventoried screens are visually approved.
- At the time of this snapshot, shared dev had not been modified and no merge/deployment had been performed. The subsequent authorized merge is tracked by PR #583.
- Subsequent user acceptance and integration authorization are recorded in DEV-INTEGRATION.md. No golden baseline is asserted.
