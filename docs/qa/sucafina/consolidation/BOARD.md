# Board

Updated 2026-11-18T16:06Z. This file is the status.

Integration: `sf-red-clusters` @ `5689525935`.
Base: `close-final-candidate` @ `a63c4c7335`.
CI in flight: none. Last evidence: run `44329483839` on `2e5839eebb`.

## Already on the integration branch

- Effect 4 `Option` decode in the two portfolio producers.
- ToolSafety fixture wired like `WriteRootsV2.safetyNode`. Not proven.

## In flight

- `sf-typecheck`: dirty in `/tmp/ag-type`, nothing pushed. Owns those dirty files.
- Dispatched, no remote head yet: `sf-wp13-campaign`, `sf-auth-callback`, `sf-enrollment-http`, `sf-body-limit`, `sf-wp10-digest`, `sf-wp10-lifecycle`, `sf-planner-ws9`, `sf-cli-hook`, `sf-docx-flow`, `sf-wp05-engine`.

## Published, not integrated

- `sf-ms-receipt` `79350b37ff`: restores the Microsoft login receipt tree. Real files. Review before merge; it includes patch sidecars, not only the missing JSON.
- Diagnosis notes only, do not merge as product: `sf-failure-map`, `sf-reports-stall`, `sf-ui-operations`, `sf-app-browser`, `sf-cli-red`, `sf-procurement-queue`, `sf-wp09-dossier` (`a2525d5d4c`).
- WP09 cause: the fixture writes `status: "rejected"` without `rejection`. The reader treats that as invalid and the dossier maps it to `document-changed`. Do not accept the invalid record. The fixture must write the rejection payload `rejectDocumentEvidence` already stores.
- WP10 digest (`8da2ad349a`): neither side is a stale hash. The six diffs swap two valid planner refs (`bi-v0` / `bi-v1`). Do not overwrite expected digests. The bug is source selection order, not the hasher.

## Not started

- One `sf-ci` on the integrated head, after typecheck lands.
- Version `coverageBaseline` only from a complete green sharded run.
- Promote #237 only after that run and an owner GO.
- Closeout `--apply` only with real `merge_sha` and owner authorization.
- Port `b1-residual`, `b2-residual`, `decisions-journey`. Close #345, #341, #327, #307, #297.
- Shards 1 and 3–6 of run `44329483839` are unknown. Do not invent their failures.
- Failure-map files with no lane: `wp02/hot-topics.test.ts`, `native-ui-contract/talent-files.test.ts`, `bi-cost-waterfall/rendering.test.ts`, `review-fixes/procurement-apply/real-apply.test.ts`, `wp08/thread-period-continuity.test.ts`, `local-entry.test.ts`, plus the rest of the 67.
