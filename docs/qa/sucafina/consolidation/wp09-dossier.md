# WP09 request dossier

Proven from run `44329483839` artifact `sf-shard-failure-CI-SF-7` (`run.log`) on SHA `2e5839eebb859969851b81aaa29f4f71b4c49d71`, and from the same sources on `sf-wp09-dossier` base `9dd6af0cacc0ededb2b92de7b3dd885ceda54040`. Those files are unchanged between the two SHAs. No writer edit. The line 90 assertion stays.

## What failed

All three cases (`txt`, `docx`, `pdf`) fail at `modules/sucafina/Sucafinav1/test/product/wp09/request-dossier.test.ts:90` after `setCandidateStatus("rejected")`.

Received `{ status: "stale", reason: "document-changed" }`. Expected `{ status: "ok" }` with a rejected Price document.

The pending assertion at line 71 is not the failure. A stable extracted document is accepted before the fixture write.

## Cause

The fixture does not change the asset. It copies the extracted evidence and sets `status: "rejected"` without `rejection`.

`readDocumentEvidence` (`product/documents/store.ts`) refuses that record as `candidate-invalid`. A rejected candidate must have no `confirmationVersion` and a `rejection` whose reason is 5–500 characters and whose page is an integer from 1 to 500.

`listDocumentEvidence` maps that to `candidate-unavailable`. `createSfRequestDocumentEvidence` (`product/documents/request-evidence.ts`), the `selectedDocuments` port `prepareSourcingDossier` returns as-is, maps every non-ok list to `{ status: "stale", reason: "document-changed" }`.

`rejectDocumentEvidence` is the producer write. It stores `status: "rejected"` together with `rejection: { reason, page }` and re-reads through `readDocumentEvidence`. The fixture comment says there is no public reject command and writes producer state directly, but the write omits the payload that read requires. The asset catalog, incarnation, revision, and blob digest are untouched, which is why the extracted prepare succeeds and only the rejected prepare reports `document-changed`.

Accepting this record in the dossier writer would admit an invalid rejection. `runtime/procurement.ts` was not edited.

## Not run

No `bun test`, Playwright, `bun run test:ci`, `gh workflow run`, or new CI.
