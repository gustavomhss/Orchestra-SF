# 102 — Source-tree pre/post, print-only changes and dependency closure

## Lease and inputs
- Branch: `xlsx-print-layout`; T0 2026-11-13T04:01:10Z; lease `xlsx-layout-browser102`.
- C51 input HEAD: `529142f63683de8e4b1f7d4232f88faf8ffcef6c`. Fixed plan: `dbf9547211d9b0fade619790de7c19c0869b7c7d`; scope: mission102 `ffdfff17bd3708cc606e8f0dd962d468c075dc51`.
- ACK-before-code: `229c070a8e31e8f4de311297cc35bb924a09efaa`, logged model GPT-6, session ID unavailable. Authenticated GitHub login `gustavomhss`.
- Producer corrections: `0376b4dac490ca64968dc03196248726075a3ef6`; real-producer OOXML regression added `2baa04fa371bf9a7a9485c00136e9dc30b343073`, all-OXML privacy scan refined `104bf61f67da9740024f38427c1580ba29f36e99`. Source tree at code HEAD: `a30bf96023767bb27fc803060f0653554bf34286`.

## Exact preimages / postimages
| File | Preimage (Git blob) | Postimage (Git blob) | Strict change |
| --- | --- | --- | --- |
| `runtime/workbooks.ts` | `3884ad35c7b471d2805d7444d24c4143b86ce197` | `567042ed8fadf2f1354947a60df8ababe332ae1d` | After existing frozen views and autoFilter, set printArea, paper, width/height scale, margin, header repetition. No cell mutation. |
| `runtime/downloads.ts` | `7fa9c254c7c08b894d8b4c3336653c32b6270126` | `ac73b9edc44bd5c8a616ce583084969d2a69e771` | OPEX template only: print settings. All existing header values unchanged. |
| `test/product/xlsx-print-layout/print-layout.test.ts` | not present in C51 | `041ed70f302f0b0f4d13c6e8bea07f19e85f4c49` | 4 scenario HTTP producer and OOXML content regressions. |
| `docs/sf2h/receipts/xlsx-print-layout/ACK-102.json` | not present in C51 | ACK commit above | First-write ownership evidence. |

## Per-sheet print policy, not acceptance
| Producer | Worksheet | Paper/orientation | Pages wide | Height | Repeat header |
| --- | --- | --- | --- | --- | --- |
| Planner | Info | A4 landscape | 1 | automatic | no (instructions) |
| Planner | OPEX / CAPEX | A3 landscape | 2 (legibility) | automatic | 1:1 |
| Planner | Headcount | A3 landscape | 1 | automatic | 1:1 |
| Planner | Rate cards | A4 landscape | 1 | automatic | 1:1 |
| Planner | FX rates | A4 portrait | 1 | automatic | 1:1 |
| Members | All Members / Summary by Leader | A3 landscape | 1 | automatic | 1:1 |
| OPEX template | OPEX A1:N1 | A4 landscape | 1 | automatic | 1:1 |

ExcelJS 4.4.0 serializer writes `xl/worksheets/sheet*.xml` `pageSetUpPr`/`pageSetup`/`pageMargins` plus `xl/workbook.xml` `_xlnm.Print_Area`/`_xlnm.Print_Titles`. Page height deliberately `0` means unconstrained, so long records are not shrunk into a single illegible page. Two horizontal A3 pages for wide financial grids intentionally allow horizontal page turns; final readability must be judged visually.

## Historical before (read-only)
PR #93 / reader88 R3: W `a1be5ae4e7e934ca1c47674ee0b166cc560e2b31`; S `a952f1b3ce48b15473f4b07810e79efd05d759fd`; Actions run `43678123870`, job `132702648942`, artifact `14146978247`. `planner-viewer`: 21 pages, original SHA256 `9c28316209eb996bc18af9e1ef11e93735bd6244c80779bf1dbbed2b5d7d408f`; `members-admin`: 6 pages, SHA256 `7b9f4aea4c3051e43b88cea7c87d6b8a9a4d5c5c2f469e80b73b8146671c1c59`; `opex-template`: 2 pages, SHA256 `fd001b494c27b4c2c2910e6b155c54179e0cc9098561f8c91a69e1dccff618a4`. Historical files remain untouched.

## Dependency closure / validation matrix
- Runtime: `download(...,"xlsx")` → `exportPlanner`, `download(...,"members")` → `exportMembers`, `download(...,"opex-template")` → template worksheet. Real authenticated HTTP producer paths are exercised in new tests. `parseWorkbook`, importer, authorization, persistence, styles, formulas, FX and calculations were not edited.
- New tests: `normal`, `empty`, `wide`, `long` with source selection `Sucafinav1/test/product/xlsx-print-layout/print-layout.test.ts`; CRC and raw OOXML; all nine sheets (six Planner, two Members, one template); formula literal vs formula, version, private salary/rates, template cells, 403 viewer denial.
- Existing `test/product/export-artifact-closure/format-consumers.test.ts` qualifies original producer/HTTP and triggers reader88 in existing CI workflow when run alone; it cannot replace wide/long source proof.
- New W/S/run/job and PDF/PNG **NOT_RUN/NOT_OBSERVED**. 101 dispatch only, with candidate source/tree fixed, dedup and recorded run/job/artifact; existing workflow does **not** auto-render the novel test path. See `REQUEST-101.json`. No local Bun product tests were run.
- Source-level print changes and tests are **not a visual PASS**: per-sheet before/after including 4 cases, dimensions, clipping, font readability, source hashes, independent 91/93 recheck are pending. R3 built-in sheet HTML view is not a native PDF page-sheet correspondence oracle.
- **Other findings excluded/open:** VIS88-001 DOCX98, Aptos fallback VIS88-005, admin JSON salary policy VIS88-006, source denied-write and EGRESS, unrelated reports and business logic. No `GLOBAL_RELEASE`.
