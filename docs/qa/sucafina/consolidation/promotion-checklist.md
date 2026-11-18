# WP10 — PR #237 promotion checklist (fail closed)

**Scope:** `close-final-candidate` (PR head) → `go-live-close` (PR base). This checklist does **not** authorize promotion, deployment, receipt edits, or a GO decision. PR #237 must remain **open and draft** until all gates are evidenced on the same SHA/tree.

## Snapshot (topology only; not acceptance)

| Ref | Pinned value from GitHub on 2026-11-17 |
| --- | --- |
| PR | `https://github.com/gustavomhss/Orchestra-SF/pull/237` (open, draft) |
| `go-live-close` before promotion | `104f844380e4b86da1ac2283f645602a45d4a43a` |
| `close-final-candidate` | `ec3df1315cfd3e3077c09f7bc1f42a608448b1c0` |
| GitHub `refs/pull/237/merge` | `7ce5a6215818896c57a9ec7e70d41c4386dfbc85` |
| Candidate and synthetic merge tree | `f9a188631f006e88b6ff956bd111d8ab5c3df117` |
| Go-live distance from candidate | 0 ahead / 143 behind; go-live is an ancestor |
| Local Git merge-tree | **NOT_RUN**; `promotion-proof.json` is pending local regeneration |

The SHA values above expire when either branch moves. `refs/pull/237/merge` is synthetic; its tree equality does not prove that the required CI and installed tests passed.

## Run the actual promotion proof

From a **dedicated worktree** on branch `promotion-readiness` (no source-branch checkout, no product tests):

```bash
node script/sf-ci/promotion-proof.mjs
node script/sf-ci/promotion-proof.mjs --check
cat docs/qa/sucafina/consolidation/promotion-proof.json
```

The script fetches refs, checks live PR metadata, verifies ancestry and ahead/behind, computes `git merge-tree --write-tree` (or detached temporary fast-forward worktree on older Git), compares candidate/tree and GitHub merge ref parentage, and writes the JSON atomically. `--check` must be nonzero if the stored proof is missing/incomplete, the PR is not a draft, or its base/head/merge ref has drifted. Never treat topology-only proof as release acceptance.

## 12/12 qualification proof table

Each row requires a real artifact or the **exact** command below, associated with the *same* candidate tree. `NOT_VERIFIED` means no evidence was supplied or executed here; no blank row can be treated as PASS. For the CI commands, set `BASELINE_RUN_ID` and `MERGE_RUN_ID` only from genuine completed GitHub Actions runs. No local Bun test/build/typecheck.

| # | Required proof | Exact evidence artifact / retrieval command | State |
| ---: | --- | --- | --- |
| 01 | Fast-forward, locally built merge tree and pinned refs | `docs/qa/sucafina/consolidation/promotion-proof.json`; `node script/sf-ci/promotion-proof.mjs --check` | **NOT_VERIFIED locally** |
| 02 | Full green baseline **and** full green PR merge-ref CI; no cancelled/skipped/unknown lanes | `gh run view "$BASELINE_RUN_ID" --repo gustavomhss/Orchestra-SF --json headSha,conclusion,jobs`; `gh run view "$MERGE_RUN_ID" --repo gustavomhss/Orchestra-SF --json headSha,conclusion,jobs`; require respective heads `ec3df1315cfd3e3077c09f7bc1f42a608448b1c0` and `7ce5a6215818896c57a9ec7e70d41c4386dfbc85` (repin when moved) | **NOT_VERIFIED** |
| 03 | Linux package plus SHA-256 of **every** distributed binary; tied to the merge SHA | `gh run download "$MERGE_RUN_ID" --repo gustavomhss/Orchestra-SF -n "sf-omni-linux-7ce5a6215818896c57a9ec7e70d41c4386dfbc85" -D /tmp/sf-237/package`; `find /tmp/sf-237/package -type f -print0 \| sort -z \| xargs -0 sha256sum > /tmp/sf-237/package-files.sha256` (Linux runner); archive/upload immutable `package-files.sha256` with run ID | **NOT_VERIFIED** |
| 04 | Package extraction / factory acceptance on the **same** package digest | `gh run view "$MERGE_RUN_ID" --repo gustavomhss/Orchestra-SF --json jobs`; installed extraction log artifact **to be attached** as `promotion-evidence/package-extraction.json` with SHA-256 from row 03 | **NOT_VERIFIED** |
| 05 | Installed native host / Linux x64 runtime receipt (not a mock) | `promotion-evidence/installed-host.json`, with `mergeRunId`, `treeSha`, `packageSha256` and installed-host provenance | **NOT_VERIFIED** |
| 06 | Actual Microsoft Entra/SSO smoke; no synthetic grant | `promotion-evidence/entra-sso-smoke.json`, with sanitized actor/issuer, installation witness, `treeSha` and pass/fail | **NOT_VERIFIED** |
| 07 | AM01 installed proof | `promotion-evidence/AM01.json`, bound to same tree/package/run | **NOT_VERIFIED** |
| 08 | AM02 installed proof | `promotion-evidence/AM02.json`, bound to same tree/package/run | **NOT_VERIFIED** |
| 09 | AM03 installed proof | `promotion-evidence/AM03.json`, bound to same tree/package/run | **NOT_VERIFIED** |
| 10 | AM04 installed proof | `promotion-evidence/AM04.json`, bound to same tree/package/run | **NOT_VERIFIED** |
| 11 | AM05 installed proof | `promotion-evidence/AM05.json`, bound to same tree/package/run | **NOT_VERIFIED** |
| 12 | AM06 installed proof | `promotion-evidence/AM06.json`, bound to same tree/package/run | **NOT_VERIFIED** |

`promotion-evidence/*.json` above are **required evidence attachment names**, not claims that those files already exist. Do not write PASS receipts from this checklist. Inspect each artifact and correlate actual SHA/tree, digest, identity, timestamps, run, and execution environment; do not accept name-only matches.

## Mandatory gates outside the 12/12 table

| Gate | Exact artifact or command | Current status |
| --- | --- | --- |
| Baseline green run ID | `gh run list --repo gustavomhss/Orchestra-SF --branch close-final-candidate --limit 30 --json databaseId,headSha,conclusion,url`; enter `BASELINE_RUN_ID=...` for the exact candidate SHA | **NOT_VERIFIED** |
| Merge-ref run ID | `gh pr checks 237 --repo gustavomhss/Orchestra-SF`; `gh api repos/gustavomhss/Orchestra-SF/commits/7ce5a6215818896c57a9ec7e70d41c4386dfbc85/check-runs`; enter `MERGE_RUN_ID=...` | **NOT_VERIFIED** |
| Full package digest | `/tmp/sf-237/package-files.sha256`, securely archived with the run, package filenames and SHA-256 | **NOT_VERIFIED** |
| UAT authorized sign-off | `promotion-evidence/uat-signoff.json` — signatory/role: **NEEDS-INPUT**; signed date: **NEEDS-INPUT**; candidate tree: `f9a188631f006e88b6ff956bd111d8ab5c3df117` | **NOT_VERIFIED** |
| Triple independent cold review | `promotion-evidence/review-a.json`, `promotion-evidence/review-b.json`, `promotion-evidence/review-c.json`, each with exact candidate head and disposition | **NOT_VERIFIED** |
| Final ledger state | `docs/qa/sucafina/consolidation/ledger.jsonl` and `ledger-summary.json` (once published), verified zero unreviewed/unknown/orphaned replay | **NOT_VERIFIED** |
| Explicit owner GO/NO-GO | `promotion-evidence/owner-go-no-go.json`, issued only after all other gates | **NEEDS-INPUT** |

## Rollback — command and decision boundary

The **pre-promotion code tree** is pinned to `104f844380e4b86da1ac2283f645602a45d4a43a`. If a promotion has occurred and an authorized rollback is required, prepare a **new revert PR** instead of force-moving `go-live-close`:

```bash
# DO NOT RUN without owner authorization. Execute in a fresh isolated worktree.
git fetch origin go-live-close
git worktree add -b rollback/pr237 /tmp/orchestra-sf-rollback-pr237 origin/go-live-close
git -C /tmp/orchestra-sf-rollback-pr237 restore --source=104f844380e4b86da1ac2283f645602a45d4a43a --staged --worktree :/
git -C /tmp/orchestra-sf-rollback-pr237 commit -m "revert(sf): restore pre-promotion go-live tree"
git -C /tmp/orchestra-sf-rollback-pr237 push --set-upstream origin rollback/pr237
# Review and full GitHub Actions qualification must precede any merge of the revert PR.
```

This is **source-code rollback preparation**, not a tested deployed-runtime rollback. The exact **deployed artifact reactivation command** is **NEEDS-INPUT** from the deployment owner and must be independently exercised, evidenced and approved. Never rewrite historical receipts, reset `go-live-close`, force-push, deploy, or flip PR #237 from this pack.

## GO/NO-GO decision rule

Default **NO-GO**. Require valid `promotion-proof.json --check`, a genuine completed green baseline and merge-ref CI, 12/12 independently evidenced rows, package digest, real installed-host + SSO qualification, UAT, approved runnable rollback, triple cold review, terminal ledger and explicit owner authorization. Any base/head movement invalidates the pack and requires recapture/requalification. PR #237 stays draft until then.
