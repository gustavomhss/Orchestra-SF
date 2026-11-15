# NOVA131 — independent Office original / rendered-page assessment

**Campaign:** sf2h-integral-20261112. **Lease:** office-review-e1-browser131. **Reviewer:** NOVA131, GPT-6, new independent session, no Office product or reader authorship. The runtime conversation/session identifier was not exposed and was not fabricated. **Status:** SOURCE W102 FIX-FIRST; DOCX130 NOT_PROVEN; 125 integrated candidate NOT_PROVEN. This is not a whole-product R01/R02/R03 opinion or global FINAL.

## Exact provenance and inspection boundary

- Source W102: PR105, product 104bf61f67da9740024f38427c1580ba29f36e99; hosted run 43725105940, job 132845224624, Actions artifact 14166480115, snapshot 079e57e84705105cefe03db9082e11a4c1973163. ZIP SHA256 f7c4fc8503214e5ab046d71812f145adafdfc330ee42d1a6a50db40dd309b37f agrees with artifact digest. Reader COMPLETED, Run tests step success, numeric test exit not captured by the reader. Twelve real exporter cases, twelve hosted PDFs and 121 PNG pages; 25/25 originals checked SHA256 and unchanged before/after reader.
- C58 comparator, **different product source** 422f1ed7b549021d7c62c834c9d9041279112af4; run 43726378502, artifact 14166341968, snapshot 110a5aacb241326abc105534981169a331a3f161; ZIP SHA256 44bf585bbd508c21c2a8bbe962f72e03b4ff90b2d3b5f63ad478de3d04023a77. Its separate 25 originals, 12 PDF and 139 PNG also checked. C58 is a comparison sample, not necessarily a direct parent-of-W102 render.
- Source112 baseline: PR108, C51 artifact14148499941 / run43682455278; its independent prior findings and hashes were read. The fresh 131 inspection is against genuine W102 artifacts, not a claim that 112 authored this result.
- 130 writer delta: at review, branch docx-continuation-fix had commit e1ed069223ef76e853d690f1728033c3c7a0b947 in product/reviews/render.ts. It is **code only** from this reviewer’s perspective, not a genuine post-fix rendered DOCX. 129 remains sole dispatcher for any additional hosted render.
- 125 composition observed: sf2-stack a15434ab558a650137f2472c7d59e6ae1e98e72a. Neither W102 nor C58 artifact has this product-source SHA. **No transfer of source green or source visual outcomes to this composed candidate.**

Method: inspect only real downloaded ZIP entries, OOXML cell/range/formula/print metadata and original Office bytes, already hosted PDF/PNG per page, PDF text bounding boxes, font inventory, and provided 88/91/93/112 review records. No office re-render, new output generation, product/test execution, CI dispatch or original artifact modification. Original Office material remains unchanged.

## Worksheet / original / PDF mapping and criterion-level decision

Page numbers below are one-based within the **individual resulting PDF**, not combined gallery page numbers. Every sheet name below was matched to the original workbook XML and the sequential hosted PDF pages. W102 uses fit-to-height unconstrained and explicit print areas; repeating header rows does not imply repeating identifying columns across a horizontal page cut.

| Original XLSX / worksheet | OOXML area / cells | Hosted PDF | Font median | Data, value and unit review | Layout and print decision |
| --- | --- | --- | --- | --- | --- |
| Planner / Info | A1:B28, 38 populated | p1 | 11pt | Version v66, year 2026, base USD, closure Feb, instructions and list values visible in source | **FAIL VIS131-002**: p1 reference-list labels touch/overlap next-column values, e.g. Valid OPEX cost elementsLicenses; Valid classifications (CAPCAPEX |
| Planner / OPEX | A1:V7, 98 populated | p2–3 | 10.31pt | Page 2 includes row IDs and EUR/USD units; p3 values 24, 155555.58 reconcile with original V2/V5 cached SUM results | **FAIL VIS131-001/003**: A3 landscape two horizontal pieces, p3 Mar-Dec/Total without repeated ID/currency/measure; p2 vendor literal visibly truncated |
| Planner / CAPEX | A1:X1, 24 populated | p4–5 | 9.51pt | **Header-only** original; all printed headers detected over p4/p5 | PASS **only** for empty baseline; nonempty CAPEX and meaningful two-piece data association **NOT_PROVEN** |
| Planner / Headcount | A1:M2, 23 populated | p6 | 8.8pt | position-66, FTE=1 and row fields represented; FY calculated field blank where rate missing, not fabricated zero | Scoped sample PASS; small print and long/multi-role headcount NOT_PROVEN |
| Planner / Rate cards | A1:E1, 5 populated | p7 | 11pt | Header only, no source rate records | Scoped empty-sheet PASS; nonempty rate/unit values NOT_PROVEN |
| Planner / FX rates | A1:B3, 5 populated | p8 | 11pt | Header USD per 1 unit; EUR=1.2; GBP blank rather than 0 | Scoped sample PASS; no substituted exchange rate observed |
| Members / All Members | A1:L2, 24 populated | p1 | 8.6pt | 12 headers plus one synthetic member; no page-boundary overflow detected | Scoped single-member PASS, typography small; density/long records NOT_PROVEN |
| Members / Summary by Leader | A1:K2, 22 populated | p2 | 9.3pt | 11 headers plus one leader; values preserved in OOXML | Scoped single-leader PASS; additional leaders and long labels NOT_PROVEN |
| Template OPEX / OPEX | A1:N1, 14 populated | p1 | 11pt | Exactly 14 header cells in source and one PDF page; no records | Scoped header-only template PASS; no second empty print page |

**Print settings actually present:** Planner Info A4 landscape; OPEX/CAPEX A3 landscape / two pages wide; Headcount A3 landscape / one page wide; Rate cards A4 landscape; FX rates A4 portrait. Members sheets A3 landscape / one page wide. OPEX template A4 landscape / one page wide. Data-grid sheet headers repeat row 1. PDF geometry audit found zero text spans outside physical PDF page bounds, which **does not** certify against overlapping A/B texts or a clipped cell string inside the printable area.

**Original-data check:** Across the three genuine workbook pairs in W102/C58, decoding OOXML values, cell types and formulas yielded **zero differences in nine worksheets**. This is bounded synthetic-data parity, not a proof that unseen variants, external integrations, UI imports or the 125 composed product compute the right business value. W102 numerical examples: Planner OPEX V2 = SUM(J2:U2), cached 24 **EUR**; V5 = SUM(J5:U5), cached 155555.58 **USD**. Both appear in p3 but their units/measure/identity are only in p2. FX EUR is 1.2 USD per 1 EUR; GBP is missing. Misattribution across p2/p3 is a presentation flaw despite intact original cells.

**Page economy:** Planner 21→8, Members 6→2, template 2→1 compared with C58. This is an observed reduction, **not an independent PASS** of print readability. Carlito-Regular is embedded in the hosted XLSX PDFs, which does not establish layout fidelity under native Aptos/Excel.

## XLSX findings and required proof

- **VIS131-001, HIGH readability, OPEX p2–3:** p3 numeric rows lack their identifying columns and currencies. Make every printed segment independently attributable to line, measure and currency while maintaining readable font, full formulas, totals and all months. Source102 author owns print design; 125 composes only qualified blobs.
- **VIS131-002, MEDIUM, Info p1:** list keys and values collide at A22:B24, including a visibly interleaved classification label and CAPEX value. Widen/wrap/reflow, keep full original list cells.
- **VIS131-003, MEDIUM, OPEX p2:** the literal source Vendor/item value beginning =HYPERLINK("https://example.invalid","literal") is represented in PDF text only as =HYPERLINK("https://exa. Keep it safely literal and expose its full content without clipping.
- **NOT_PROVEN (scenario matrix):** 102 source describes four independent normal/empty/wide/long situations, but the downloaded W102 reader artifact contains one 12-case standard synthetic export set, **not** separately identified PDFs/PNGs/page mappings for each scenario. A passing CI step is not per-scenario visual proof. Use the existing 129 dispatch/dedup lane, never a second dispatcher.

## DOCX: both real 15-page outputs, before hypothetical 130 fix

The original W102 composed-docx and after-drift-docx have two tables, 169 Word XML rows, two repeated table-header flags and zero w:cantSplit flags in each. Existing PDF/PNG inspection and p2/p3/p4/p14/p15 PDF text confirm:

| Pages in each DOCX PDF | Criterion | Source W102 outcome |
| --- | --- | --- |
| p1 | Title/opaque review ID separates; no visible word collision | Limited PASS for existing source, consistent with fixed VIS88-001 |
| p2 | Unicode/long note, END-EXPORT-66-NOTE sentinel, literal <scope> and start of captured-value table | Limited PASS for checked content |
| p3–p15 | Continuation rows must retain identifying first-column captured value and corresponding period/source | **FAIL / VIS112-001 persists**. The first data row after the repeated header begins with period/source tail, with no first-column record key. Identical class of issue in both DOCX cases. |
| p15 | Last table rows/footers, no page-overflow spans | Limited PASS only for geometry/footer; does not cancel p15 continuation failure |

New source130 commit e1ed069 changes render.ts to chunk original row fragments in blocks of 12 text lines, introduce continuation labels and mark the smaller physical rows cantSplit. This is a **source observation only**. No genuine output with new SHA/original/PDF/PNG was obtained at the audit instant. The new code requires actual page-by-page checks of all carried values, period/source associations, changed pagination, text clipping, title and note sentinels, and whether an atypical captured-value key lacking delimiter ': ' is still labeled correctly. **130 delta visual verdict = NOT_PROVEN**, not fixed, not rejected as a fabricated runtime defect.

## PPTX: both genuine 29-slide outputs

Composed and after-drift PPTX each have 29 actual hosted pages. Existing page-montage and PDF-level checks show: slide 1 full review title and opaque ID; slide 2 coverage; slides 3–5 All Projects; slide 6 Forecast coverage; slides 7–29 Forecast table segments. Title and long-note sentinels survive PDF text extraction, and zero PDF text boxes were located outside physical page extents. This is **limited table and content presence**, not proof that every selected item/cell/comment is complete or that fine clipping never occurs in native PowerPoint. Source presentations contain zero actual ppt/charts/chart*.xml objects; similarly, XLSX samples contain zero xl/charts/chart*.xml. Empty chart folders are not chart evidence. Therefore all chart axis-title/scale/series/units criteria are **NOT_PROVEN**, not silently PASSED.

## Scope and disposition

**Proven, bounded:** authentic W102 and C58 existing hosted artifact integrity; 25 preserved originals per archive; W102/C58 selected nine-sheet OOXML value/formula equivalence; exact worksheet-to-page mapping; selected readable cells; isolated title and note presence; existing slide/table pages.

**Open visual issues:** VIS131-001, VIS131-002, VIS131-003, and VIS112-001 for the source W102 DOCX. **Unproven:** source130 visual delta, all four scenario-specific outputs, charts/nonempty source coverage, target-font parity, frozen 125 candidate, and global R01/R02/R03 acceptance. No waiver, no silent SKIP/PASS.

Owned actions: 102/125 address XLSX layout; 130 owns DOCX correction and tests; 129 provides genuine deduplicated hosted render artifacts when material is available; 128 compile gate; 125 consumes source and returns a uniquely identified composed candidate for independent recheck. This session wrote only receipts in office-review131 and did not request, run or approve other work. Global release remains false.

