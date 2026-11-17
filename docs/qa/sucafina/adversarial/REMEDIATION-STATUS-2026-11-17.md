# Orchestra-SF hidden-risk remediation status — 2026-11-17

This document is the implementation ledger for `ORCHESTRA-SF-HIDDEN-RISK-AUDIT-2026-11-17.md`. It deliberately separates source completion, focused GitHub Actions evidence, and whole-candidate qualification.

## Baseline and ownership

- Original audit: draft PR #314, branch `audit/hidden-risks-20261117`.
- First remediation bundle: merged PR #322, `fix(sf): close hidden parser, import and maintenance failure modes`.
- Residual work is split by failure domain so a red lane cannot hide unrelated correctness:
  - maintenance/recovery: draft PR #328;
  - import intake: draft PR #329;
  - parser resource budget: draft PR #331.
- No residual PR changes workflows, test selection, release gates, Azure, authentication policy, product schema, or deployment.

## Finding-to-fix matrix

| Finding | Source remediation | Focused proof | Current state |
|---|---|---|---|
| `ADV-PARSER-001` stranded boot slots | #322 retires timed-out workers and bounds resident workers; #331 preserves the bound while accounting for transferred payload lifetime | boot-hang/busy/recovery adversarial test | implemented; full `CI-SF` may still stop before this file because the shared suite uses `--bail=5` |
| `ADV-PARSER-002` unqualified concurrent input envelope | #331 adds process-global 40 MiB input reservation, maximum three resident workers, two active workers, and reservation retention until actual termination | 12 MiB transfer witness, 8 MiB excess rejection without worker creation, abort, capacity recovery | implemented; no RSS number is claimed |
| `ADV-IMPORT-001` expensive pre-admission multipart work | #322 moves human authority before body consumption; #329 adds concurrency, deadline, part-count, filename and selection-reference bounds | authority/body-use, malformed body, part fanout, concurrent excess, abort release and slow-upload deadline tests | implemented; final SHA qualification pending/recorded by Actions |
| `ADV-BACKUP-001` filesystem work under SQLite writer ownership | #322 snapshots quickly, reads fenced blob generations in short transactions, performs write/fsync/verification/prune outside the long SQL owner | backup resilience and concurrent maintenance tests | implemented |
| `ADV-JOBS-001` immediate rerun storm | #322 coalesces active calls; #328 replaces fixed interval with completion-relative one-shot scheduling | overlapping calls return one Promise; fake scheduler proves no timer while active and one timer after completion | implemented and focused tests passed on run `44161014543` before the final retention interaction correction |
| `ADV-JOBS-002` unbounded repeated archive scans | #322 introduces metadata inventory; #328 performs one list per surface and one rotating deep verification per cycle with durable cursor | 84 monthlies per surface / 252 total fixture | implemented and focused test passed on run `44161014543` |
| `ADV-BACKUP-002` corrupt archives silently omitted | #322 makes inventory and prune fail closed on a named corrupt archive rather than suppressing it | corruption/resilience tests | implemented |
| `ADV-BACKUP-003` invisible `.stage-*` copies | #322 adds allowlisted private-stage scavenging; #328 makes zero-age deterministic for the test seam while retaining the production age window | orphan cleanup and unsafe/active-stage protection tests | implemented and focused tests passed |
| `ADV-LIFECYCLE-001` maintenance shutdown lacks cooperative cancellation | #322 threads `AbortSignal` through capture/list/verify/store work; #328 cancels the scheduled timer and aborts the active cycle on dispose | cancellation/coalescing tests | implemented; kernel-level completion of an already-entered `fsync` is not represented as forcibly interruptible |

## Residual regressions found during cold review

The remediation itself exposed four defects that were not accepted as collateral:

1. a prior-hour daily archive was reused because persisted ID matching ignored `backupHour`;
2. legacy progress without `backupHour` was mistaken for an interrupted current implementation write;
3. zero-age stage cleanup could skip a fresh orphan because filesystem timestamp precision made age fractionally negative;
4. rotating verification could select a daily archive that the same cycle had already removed under retention.

PR #328 corrects all four. The fourth correction keeps the single inventory read and filters rotating candidates with the exact production windows: Planner daily 14 days, other daily 35 days, monthly 7 years. Corrupt retained archives remain fail-closed.

## Qualification rules

A finding is not marked release-qualified merely because its focused test passes. Final go-live qualification still requires the selected integration SHA to:

1. contain #328, #329 and #331 without semantic conflict;
2. run the canonical Actions matrix on that exact SHA;
3. distinguish shared pre-existing red lanes from regressions caused by these changes;
4. preserve the no-skip, no-timeout-inflation and fail-closed policies;
5. retain evidence links and run IDs in the candidate receipt.

## Known evidence limitation

`sf/test-CI-SF` currently uses `--bail=5`. On runs where five unrelated shared failures occur earlier in lexical/manifest execution, later parser tests are admitted by the manifest but are not executed. Such a run is **not** recorded as parser PASS. Package success and static review do not substitute for the missing focused runtime receipt.
