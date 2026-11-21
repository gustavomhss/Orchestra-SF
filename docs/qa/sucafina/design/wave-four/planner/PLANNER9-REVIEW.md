# Planner wave four: Planner9 visual review

## Verdict and evidence boundary

**Approved with minor, non-blocking presentation findings** for CAP20 Headcount, CAP21 Entities & allocations, CAP22 FX, and CAP23 Versions / Compare.

Review date: 2026-11-21. This review inspected all **40 JPEG previews** reconstructed from the real [Planner9 job](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44961772161/job/137021924555). The executed snapshot was `9f52fd75da5f789f91b61d595a86651277ec2ec0`. It does not certify later product changes.

The Actions job reports **2 passed (4.4m)**. Five `SF_DESIGN_COMMAND` records report HTTP 200 and native review completion: Headcount/save, Entities & allocations/save, FX rates/save, Versions/save, Versions/copy. The executed spec requires one original POST per confirmation, no POST for cancel/revise, and fresh authorized source reads afterward. Four page-closure diagnostics report empty `consoleErrors` and `pageErrors` arrays. These are observed Actions results; this reviewer did not execute local tests or launch a rerun.

The screenshots cover 1440 × 1100 desktop and 320 × 900 narrow viewports. They are viewport captures, not full-page renders. In particular, `CAP20-dark-320-position-editor-test-data` shows the beginning of the editor; that image alone does not prove every field is visible. Actual browser zoom and numerical WCAG contrast were not measured. No claim is made that every below-fold table column is simultaneously visible at 320px.

## Visual assessment

| Area | Observed result | Representative evidence |
| --- | --- | --- |
| CAP20 Headcount | Plan context, FTE/cost summary, position roster and rate cards have a clear hierarchy. The narrow review exposes the proposed fields and all review actions. The confirmed view shows FTE 0.9 in the edited position and the updated summary. The unavailable roster preview remains explicit and cannot confirm. | `CAP20-list-dark-desktop-test-data`, `CAP20-list-light-desktop-test-data`, `CAP20-dark-320-position-review-test-data`, `CAP20-dark-desktop-confirmed-source-test-data`, `CAP20-dark-desktop-unavailable-roster-impact-test-data` |
| CAP21 Entities & allocations | Shared catalog explanation, filter and separate entity/allocation lists remain distinct. The distribution review shows 60% / 40% and total 100%; Cancel review, Revise and Save fit the narrow viewport. Confirmed detail shows the original record identity, contract-source absence, distribution and source version. | `CAP21-shared-catalogs-dark-desktop-test-data`, `CAP21-shared-catalogs-light-desktop-test-data`, `CAP21-dark-320-distribution-review-test-data`, `CAP21-dark-desktop-confirmed-distribution-test-data` |
| CAP22 FX | Version context, fixed USD rate, editable rates and missing-rate explanation are separated. The rate editor/review exposes the source reference, provider and observation time. Confirmed EUR 1.09 retains its provenance while BRL stays explicitly missing. | `CAP22-rates-and-provenance-dark-desktop-test-data`, `CAP22-rates-and-provenance-light-desktop-test-data`, `CAP22-dark-320-rate-editor-test-data`, `CAP22-dark-320-provenance-review-test-data`, `CAP22-dark-desktop-confirmed-provenance-test-data` |
| CAP23 Versions | The ledger keeps names, years, states and row commands aligned in both themes. Narrow detail actions wrap within the frame. The review shows year 2026 without thousands grouping. Confirmed copy appears as a third real ledger row. | `CAP23-version-ledger-dark-desktop-test-data`, `CAP23-version-ledger-light-desktop-test-data`, `CAP23-dark-320-version-review-test-data`, `CAP23-dark-desktop-copy-review-test-data`, `CAP23-dark-desktop-confirmed-copy-test-data` |
| CAP23 Compare | Source selectors precede the side-by-side comparison. The producer's missing currency is explicit, including alongside zero values. Monthly data use internal horizontal scrolling at 320px; the keyboard-scroll image shows the focused scroll region. The page frame does not visibly expand with the table. | `CAP23-source-comparison-dark-desktop-test-data`, `CAP23-source-comparison-light-desktop-test-data`, `CAP23-source-comparison-light-320-test-data`, `CAP23-dark-320-keyboard-monthly-scroll-test-data` |
| Portuguese | All four areas and comparison were inspected in desktop and narrow dark mode. Translated headings, helper text and controls remain legible. The longer Headcount currency summary stacks at 320px. Source-authored names and numeric representations remain source values; this review does not claim universal numeric localization. | All `*-pt-BR-*` captures listed below |

Across the inspected views, no overlapping review controls, clipped primary actions or document-level horizontal overflow was visible. Narrow tables intentionally show a scrollable portion of their columns. Standard source-backed fields, missing values and dates remain distinguishable. Reviews stay narrower than the listing frame, and the glass sections organize each task without turning every field into a separate card.

## Minor findings

1. **CAP20 Portuguese desktop word wrap.** In `CAP20-pt-BR-dark-desktop-test-data`, the source value `Infrastructure` wraps with its final letter on a separate line in the Área column. The value is readable and the row is operable, but the column could use a small presentation adjustment.
2. **Repeated review explanation.** `CAP20-dark-desktop-unavailable-roster-impact-test-data` repeats the missing-preview explanation and the original denial sentence. `CAP23-dark-desktop-copy-review-test-data` also repeats its review explanation before the comparison cards. These repetitions do not hide actions or change confirmation state.

No product or spec was changed as part of this final visual review. These observations refer to the tested snapshot and should remain separate from any later cleanup.

## Complete inspected capture inventory

1. `CAP20-list-dark-desktop-test-data`
2. `CAP20-list-light-desktop-test-data`
3. `CAP20-list-light-320-test-data`
4. `CAP20-dark-320-position-editor-test-data`
5. `CAP20-dark-320-position-review-test-data`
6. `CAP20-dark-desktop-confirmed-source-test-data`
7. `CAP20-dark-desktop-unavailable-roster-impact-test-data`
8. `CAP21-shared-catalogs-dark-desktop-test-data`
9. `CAP21-shared-catalogs-light-desktop-test-data`
10. `CAP21-shared-catalogs-light-320-test-data`
11. `CAP21-dark-320-distribution-editor-test-data`
12. `CAP21-dark-320-distribution-review-test-data`
13. `CAP21-dark-desktop-confirmed-distribution-test-data`
14. `CAP20-pt-BR-dark-desktop-test-data`
15. `CAP20-pt-BR-dark-320-test-data`
16. `CAP21-pt-BR-dark-desktop-test-data`
17. `CAP21-pt-BR-dark-320-test-data`
18. `CAP22-rates-and-provenance-dark-desktop-test-data`
19. `CAP22-rates-and-provenance-light-desktop-test-data`
20. `CAP22-rates-and-provenance-light-320-test-data`
21. `CAP22-dark-320-rate-editor-test-data`
22. `CAP22-dark-320-provenance-review-test-data`
23. `CAP22-dark-desktop-confirmed-provenance-test-data`
24. `CAP23-version-ledger-dark-desktop-test-data`
25. `CAP23-version-ledger-light-desktop-test-data`
26. `CAP23-version-ledger-light-320-test-data`
27. `CAP23-dark-320-version-editor-test-data`
28. `CAP23-dark-320-version-review-test-data`
29. `CAP23-dark-desktop-copy-review-test-data`
30. `CAP23-dark-desktop-confirmed-copy-test-data`
31. `CAP23-source-comparison-dark-desktop-test-data`
32. `CAP23-source-comparison-light-desktop-test-data`
33. `CAP23-source-comparison-light-320-test-data`
34. `CAP23-dark-320-keyboard-monthly-scroll-test-data`
35. `CAP22-pt-BR-dark-desktop-test-data`
36. `CAP22-pt-BR-dark-320-test-data`
37. `CAP23-pt-BR-dark-desktop-test-data`
38. `CAP23-pt-BR-dark-320-test-data`
39. `CAP23-compare-pt-BR-dark-desktop-test-data`
40. `CAP23-compare-pt-BR-dark-320-test-data`

## Separation from Work, Search and Saved views

This Planner9 pass does **not** qualify UI30, UI31 or UI32. Their real journeys run in `design-wave-four-work.spec.ts` with independent installation fixtures.

Work7 independently proved the canonical Handoff seed, UI30 listing and current owner/source-version detail. Its destination check remained Loading when the test failed, and no JavaScript error was reported. The cause was not established by that browser run. Inspection of the original code found that destination resolution repeats C58 read, then invokes two additional work-list presentations and a final witness; no external transaction is opened merely by the Review read-scope wrapper. HTTP completion diagnostics in the subsequent root-owned run are required to distinguish a pending producer from a discarded browser result. C58 and the original request clock were not modified.
