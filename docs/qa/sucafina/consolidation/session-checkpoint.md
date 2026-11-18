# Session checkpoint

Saved 2026-11-18T15:26Z so the conversation can be compacted. Resume from this file, not from chat memory.

## Where the campaign stands

Base `close-final-candidate` is `a63c4c7335`. Bundles already merged:

- #337 B0 `3ba969783a`
- #342 B1 `f30e1356a3`
- #343 B2 `66ef77dcde`
- #344 B3 `a63c4c7335`

Promotion PR #237 (`close-final-candidate` → `go-live-close`) was CLEAN after those merges. Do not promote without an owner GO and a green `sf/verify`.

Active fix branch: `sf-red-clusters` @ `a26a35f135` (descendant of base `a63c4c7335`, no rebase needed). Worktree: `/tmp/w-base`. Lane ownership: `docs/qa/sucafina/consolidation/lane-ownership.md`. Do not use the owner checkout.

## What is already on `sf-red-clusters`

- Enrollment failure message now keeps the underlying error (`8f158cc097`).
- WP01 ordered-pool inventory rebased to the real 40-file closure (`2e5839eebb`). Reciprocity guard rejected 4 stale names after the merges.
- Shard failure artifact: `sf-shard-failure-CI-SF-<n>` uploads `run.log` + `report.xml` (`4e7104928a`).
- Decisions fixtures address controls by `select[name=...]` and require the option value (`30b8a619e0`). Adopted from #307. Not adopted: review-flow assertion deletions, and the enrollment target revert to `/dashboard` (product contract is `/`).
- Reports `put` is traced behind `SF_REPORTS_TRACE` (`6da50b05e5`).
- ToolSafety fixture rewrite is **unverified** (`a9951bd87b`, `a22ec86874`, `a73efe9429`, `5c4f4fabd6`). Last observed error was still `Service not found: @orchestra/ToolSafety`. Production pattern to copy: `apps/cli/src/sucafina-product/routine-native-governance.ts` (`WriteRootsV2.safetyNode` + `Layer.provide(implementation)`).
- First type batch committed (`41975be6aa`): native-host SessionStore provision, live-context `id: string`, protocol `Record<string, unknown>`, decision-result overload, analysis-http read narrowing, contribution-body default return, `conflict()` returns `Extract<Result, { ok: false }>`.

Local typecheck after that commit was aborted before the recount. Last known remaining count was 20, then the batch was applied. Re-run `bun run typecheck` in `modules/sucafina` before claiming a number.

## CI facts

- `CI-SF` is 8 shards. Bun does not honor argv order (verified: `bun test a b c` ran `b c a`, sequential not concurrent). The WP01 pool fixture requires `browser-startup.test.ts` first and `browser-lifecycle.test.ts` last in `/proc/self/cmdline`. Those 40 files are `harnessOwnedFiles` and must stay excluded until an integrator-owned lane exists.
- Base run `44182616679` executed only 289 of 918 files, had 43 `(fail)` lines, and the job still reported success. That is why `sf/verify` was red. `coverageBaseline.status` is still `PENDING_REAL_COMPLETE_RUN`.
- Full inventory on head `33bc9a0cc3` (pre-merge) showed shard failures 58/80/27. Do not treat those counts as current; the merged tree is different.
- Run `44329483839` on `2e5839eebb` completed failure. It does not include `30b8a619e0`, `41975be6aa`, or `a26a35f135`. Failed jobs: static `134889959050`, procurement-queue `134890490309`, APP-BROWSER `134890490385`, UI-OPERATIONS `134890490464`, UI-REPORTS `134890490475`, UI-DECISIONS `134890490492`, CLI `134890490527`, SF-2 `134890490763`, SF-7 `134890490891`, SF-8 `134890490924`, verify `134911301816`. Shards 1 and 3–6 were cancelled. Shard failure artifacts exist only for 2, 7 and 8.
- `test:ci` from a dirty or unpushed tree refuses when more than 400 files differ. Push first.

## Preserved agent work (do not drop)

Pushed branches, not merged, not gated:

- `b1-residual` `e1421148d0` — azure-mvp workflow + fence-identity test
- `b2-residual` `46beb6dc40` — WIP wp13 handoff proofs adapted to merged decision ports
- `decisions-journey` `707eac9855` — stall instrumentation + Effect v4 Result decoders

Patches also in `.git/agent-recovery/` of the owner checkout (4 files, 92K). `b3-residual` and `reports-artifact-put` had no commits of their own.

Free-model subagents died on upstream rate limit. Next fan-out must use Grok (`Grok 4.7`, provider `xai`), one writer per branch.

## Rules that already burned us

- Never overwrite a newer base file with an older PR blob.
- Never delete or weaken an assertion to go green. #307's review-flow hunks do that; do not take them.
- Never run `bun test` locally. `bun run typecheck` from a package directory is allowed. `bun run test:ci <package> <files>` is the test oracle.
- One writer per branch. Do not edit `sf-red-clusters` from two agents at once.
- Lease before merge: re-read `origin/close-final-candidate` and do not merge if it moved unless the owner asked.

## Next work, disjoint

1. Finish the remaining type errors on a branch cut from `41975be6aa`. Known leftovers before the aborted recount: `desktop-origin-bridge238.ts` (`SfTransportFetch`), `closure238` missing `validateSfOwnedLocationProbe`, `export-artifact-closure` UUID template, `installed-post-cause`, `planner-fixture` `.reason`, `proof233` implicit any, `proof234` missing modules, `workbench-analysis`, `personal-view-persistence`, `native-scenario-preparation`, `procurement.ts` if the conflict() change did not land in the running typecheck.
2. Re-verify ToolSafety against the production `WriteRootsV2.safetyNode` pattern. Do not keep iterating the current fixture if the next `test:ci` of `planning-runner.test.ts` is still `Service not found`.
3. After a shard run on a typecheck-clean head, download `sf-shard-failure-CI-SF-*` and cluster failures by file. Do not guess from the pre-merge logs.
4. Reports stall: read `SF_REPORTS_TRACE_PUT_*` from the UI-REPORTS job once a traced head runs. Last known stop was after `REPORT_READ2_DONE`, before `REPORT_STORED_DONE`.
5. Version `coverageBaseline` only from a complete green sharded run, with the run id in the commit.

## Commands

```sh
cd /tmp/w-base
git fetch origin
git switch sf-red-clusters
git pull --ff-only
cd modules/sucafina && bun run typecheck
# tests:
cd /tmp/w-base && bun run test:ci sucafina <files...>
```
