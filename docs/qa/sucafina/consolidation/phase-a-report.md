# Phase A consolidation ledger — frozen inventory report

**Status: BLOCKED / NOT VALIDATED.** The historical JSONL is published byte-for-byte unchanged.
The validator fails closed on a pre-existing ownership/disposition inconsistency. No PR
closure, merge, release or CI green is asserted by this report.

## Snapshot and source integrity

| Metric | Value |
| --- | ---: |
| Raw ledger records | 37,603 |
| Open PRs in frozen source snapshot | 243 |
| PRs with at least one `REPLAY` | 206 |
| `REPLAY` records (all bundles) | 15,144 |
| `REPLAY` with admissible bundle | 5,344 |
| `REPLAY/NONE` requiring disposition | 9,800 |
| `ABSORBED_PATCH` records | 9,132 |
| Distinct `ABSORBED_PATCH` paths | 1,975 |
| Duplicate-head groups | 1 |
| `close_ready=true` records | 0 |

- Frozen `observed_at`: `2026-11-17T23:14:51.019678Z`.
- Baseline observed by classifier: `ec3df1315cfd3e3077c09f7bc1f42a608448b1c0`.
- SHA-256 of copied `ledger.jsonl`: `5cbc3cb03cf8008270d5533a3d9d789bc0908376b438cae56131c7733f83f4d8`.
- SHA-256 of original classifier `/tmp/phase-a/build_ledger.py`: `288c6348d8e2f81414939141b9a5796387913a48f2a911a3c051156be1fb0e07`.
- SHA-256 of PR source snapshot `/tmp/phase-a/open-prs.json`: `5d6afb9d2284c3024802c4a08258eef1a10bf4658eac4bb32028cd3de2012709`.
- The ledger was checked byte-for-byte against `/tmp/phase-a/consolidation-ledger.jsonl`;
  no record was normalized, reassigned, or rewritten.
- `ledger-summary.json` contains the full disposition-by-bundle matrix,
  duplicate-head groups, and sorted distinct patch-absorbed paths.
- `ownership-map.json` reproduces the classifier's ordered first-match rules
  (including the `/docs/` substring rule and default B1 fallback).
  Ownership rules matched every non-sentinel record.

## Five provenance mechanisms checked by the source classifier

1. **Ancestry:** `git merge-base --is-ancestor source_head base` establishes
   `ABSORBED_ANCESTOR` for already-reachable source heads.
2. **Empty three-dot diff:** `git diff --quiet base...head` detects zero
   surviving candidate changes (recorded as `ABSORBED_PATCH`).
3. **Content equality:** head blob OID equals the base blob OID at a path;
   deletion match means a deleted path is absent from the base. These use
   `BLOB_MATCH` / `DELETION_MATCH` evidence (`ABSORBED_BLOB`).
4. **Patch equivalence:** the builder removes `index` lines from per-path
   merge-base diffs and compares SHA-256 digests, recording `PATCH_ID`
   evidence (`ABSORBED_PATCH`). **This is not Git's canonical
   `git patch-id --stable` algorithm**; the distinction must be preserved.
5. **Duplicate source head:** identical source-head SHAs identify
   `DUPLICATE_HEAD` candidates; the builder chooses the lowest-numbered PR
   as the canonical source for classification, not as merge authorization.

`REPLAY` means the source candidate was *not proven absorbed* by these tests.
`DOCS_ONLY` and `PROMOTION_ONLY` are routing decisions, not absorption proof.

## Records by disposition

| Disposition | Records |
| --- | ---: |
| `ABSORBED_ANCESTOR` | 4 |
| `ABSORBED_PATCH` | 9,132 |
| `DOCS_ONLY` | 31 |
| `DUPLICATE_HEAD` | 14 |
| `PROMOTION_ONLY` | 13,278 |
| `REPLAY` | 15,144 |

## Replays by bundle

| Bundle | `REPLAY` records |
| --- | ---: |
| `B0` | 0 |
| `B1` | 867 |
| `B2` | 4,283 |
| `B3` | 194 |
| `FINAL` | 0 |
| `NONE` | 9,800 |

## Duplicate-head groups

- HEAD `78e35990f84335e5ddb6fcd40e785a4925141373`: PR #270, PR #272

## Validator execution (proof; non-zero exit)

Command: `node script/sf-ci/validate-ledger.mjs` (from the isolated worktree).

```text
$ node script/sf-ci/validate-ledger.mjs
INVALID_LEDGER {"records_seen":37603,"invalid_records":9800,"findings":19600,"findings_by_code":{"INVALID_REPLAY_BUNDLE":9800,"SCHEMA_INVALID":9800}}
line 297 SCHEMA_INVALID: $.bundle: unknown enum value
line 297 INVALID_REPLAY_BUNDLE: NONE
exit code: 1
```

The validator checked every line against the existing `ledger.schema.json`,
enforced unique `record_id`, required evidence, and independently enforced
the `REPLAY`-bundle and `close_ready` proof constraints.
There are **9,800 invalid records**, reported through **19,600
findings** (the schema error and the explicit fail-closed error for each invalid
record). This is not a passing proof.

Of the invalid `REPLAY/NONE` records, **9,799**
are under `modules/sucafina/Sucafinav1/docs/`; one is
`sf/docs/ADMIN-SURFACE-DESIGN.md`. The original classifier assigns paths
containing `/docs/` to `NONE/inventory`, but only converts the root
`docs/` and `.orchestra/` prefixes to `DOCS_ONLY` disposition.
As a result, nested documentation remains `REPLAY/NONE` and violates
the current schema. No history was rewritten to conceal this.

**NEEDS-INPUT (OWNER):** decide whether those 9,800 source records need
a new, separately approved classification snapshot, and which disposition /
bundle policy applies. The frozen original stays intact and the fail-closed
validator stays strict. Until this decision and a subsequent validated
snapshot, Phase A is not accepted for B1 or PR closeout.

## Limits and excluded claims

- `git diff merge-base..source-head` yields a **SOURCE_CANDIDATE_SUPERSET**,
  not an authorial delta. Stacked ancestry, carried dependencies, or unrelated
  historical work can appear in that superset. A `REPLAY` row does not
  authorize copying the whole file or closing the source PR.
- This snapshot includes 243 PRs open *when captured*; it is not a
  claim about the current live GitHub queue. Future head movements require
  a new freeze/drift audit.
- The builder's patch SHA-256 equality is a narrower check than semantic
  equivalence or canonical `git patch-id`; it does not prove a PR is merged.
- Protected receipts/research paths were classified `PROMOTION_ONLY`, not
  rewritten, accepted, or validated by this publication.
- No product tests, `bun test`, `bun build`, `bun typecheck`, local
  CI substitute, Actions evidence, installed qualification, or UAT PASS
  was generated by WP5.
- No product, workflow, historical receipt, or bundle branch is touched.
