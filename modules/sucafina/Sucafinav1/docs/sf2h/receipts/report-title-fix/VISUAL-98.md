# VIS88-001 — before-image evidence and mandatory after-image gate

**Scope:** only the DOCX title and opaque-ID wrapping on page 1 of composed-docx and after-drift-docx.

## Verified historical baseline, not the new result

- [PR93 reader run R3](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43678123870): source W a1be5ae4e7e934ca1c47674ee0b166cc560e2b31; snapshot S a952f1b3ce48b15473f4b07810e79efd05d759fd; job 132702648942; artifact 14146978247.
- composed-docx SHA-256 2401d27726f143033d922a4057bf15ba82d142c81bc55f140e2b059fb4bfe987; after-drift-docx SHA-256 68a9ac07f9e0487d9d213d612e93e2519e7198733071140d4289129a49d4e2ed. Each yielded 15 PDF pages.
- Original _inspection/file-0003/page-01.png and _inspection/file-0001/page-01.png visibly show title-line overlap. Confirmed in the original OOXML: Title style 28pt and inherited Normal paragraph line=280 twips. LibreOffice 24.2.7.2; Aptos was substituted.
- Original reader recorded SHA-256 equal before/after reading; do not alter these historical originals.

## New code is committed but NOT yet visually qualified

- Both DOCX-only Title paragraph constructors explicitly use minimum line height 760 twips, lineRule atLeast, before 0, after 240 and widow control; the complete original title and ID remain untouched.
- Regression code covers four title shapes in both actual producers, preserving original notes, charts, tables, footers and source metadata. No local product tests/rendering were run.
- OOXML assertions cannot sign off VIS88-001.

## Hosted after-image gate

- See CI-REQUEST-98.json: only dispatcher45 may generate the deduplicated CI snapshots. Use existing reader88 and workflow step, no new renderer and no edits to owned workflow or reader paths.
- Record actual W/S/run/job/artefact, source SHA-256, tools/font versions, all DOCX original bytes before/after, PDF page count and PNG images. Compare before/after page 1 of composed and after-drift at full scale, check glyph/title-line separation and body clearance, and inspect other pages for new clipping.
- Recheck must be independent by missions 91 and 93. Historical functional failures belong to 86/97 and remain separate from visual verdict.

**Current: code committed, functional NOT_RUN, hosted render NOT_RUN, visual NOT_SIGNED, GLOBAL_RELEASE NO.** XLSX print pagination, Aptos font substitution and other VIS88 findings remain outside this mission.
