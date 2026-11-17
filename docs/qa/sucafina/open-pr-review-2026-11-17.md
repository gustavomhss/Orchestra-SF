# Cold review — open PRs #301, #318, #319, #332
Date: 2026-11-17. Read-only GitHub API review; no code execution, no merge, close, labels, or mutations to reviewed PRs.
Verified target: `close-final-candidate` = `50d05ff381c7656da642ce818ab7d744c1f98608` (compare identical to explicit SHA).
All SHA references below are returned by the GitHub API. **NOT-VERIFIED** means no execution or external attestation was performed.

## 1. #301 — ADR PostgreSQL and SQLite
**Verdict: NEEDS-EDITS (documentation only), then READY-FOR-OWNER-DECISION.** The architectural choice is explicitly proposed, not deployed: PostgreSQL corporate target, isolated SQLite local mode, no automatic fallback, no dual writes, and separately scoped Orchestra core store. Stage A EU-resident SQLite pilot requires residency/AZ-03 evidence; Stage B PostgreSQL is conditional and budgeted separately. No intrinsic contradiction between the *target* and the *current* SQLite authority, but the document must not imply a completed migration or qualifying deployment.

### Reference existence by API
| Path / ref | Result |
| --- | --- |
| `modules/sucafina/Sucafinav1/runtime/local-store.ts` @ base | EXISTS; blob `d9eaac043514141abb2f1f978a6fd2ceaf4040d6`; **677 lines** (split on newline; verify trailing-newline convention). |
| `sf/ci/PENDING-WORK.md` @ base | EXISTS; blob `b20d6fb1e404710d0d583fcd4628256226febc65`. |
| `infra/azure/main.bicep` @ base | NOT FOUND (GitHub Contents 404). |
| `infra/azure/main.bicep` @ `azure-hardening` | EXISTS; blob `8d8bf79ddfeb7dbbab2def5c9f36b068e263cc71`; `param location string = resourceGroup().location`. |
| `sf/azure/runbooks/AZ-03-LINUX-DATA-RECOVERY.md` @ base | NOT FOUND (GitHub Contents 404). |
| Same AZ-03 file @ `pull/248/head` | EXISTS; blob `dd534bb3a0ee37ca426d8b9381c7428007506689`. **Explicitly says SUPERSEDED FOR REAL CI FACTORY DEPLOYMENT**; directs to `A7-REAL-FACTORY-MI-DEPLOY.md`. |
| `sf/docs/ADR-001-postgresql-primary-sqlite-local.md` @ base | NOT FOUND (expected new file). |
| Same ADR @ `pull/301/head` | EXISTS; blob `c0e990d2018b4877b75bbc6ab9890e89235c114b`; 137 content lines. |

**Minimum edits (2 findings):**
1. Clarify that `infra/azure/main.bicep` is on `azure-hardening`, **not** the present candidate; no assertion about currently installed Azure resources follows from this template.
2. Replace the ambiguous phrase “Existing AZ-03 runbooks” with “draft #248, not in current base, superseded for real CI factory deployment”; reference the current A7 real-factory runbook for actual qualification, while retaining #248 as provenance only. Do not execute older deployment commands. **Live VM/backup region: NOT-VERIFIED.**

**Owner-only decisions** (not resolved by this ADR): (1) approved monthly Azure/PostgreSQL budget and operating owner; (2) “Europe” means (a) geographic Europe, (b) EU/EFTA Data Boundary, (c) EU only, or (d) Switzerland only; (3) whether pilot Stage A with SQLite is contractually acceptable and what evidence signs acceptance; (4) whether Stage B PostgreSQL is mandated at contract signature or separately purchased; (5) region, backup/DR and service-provider residency exceptions with legal/security approval; (6) production SLO/RTO/RPO, workload and HA spend.
Public price quotations, actual deployment residency and Python/CI: **NOT-VERIFIED** by this review.

## 2. #318 — 94 runtime-ready journey campaign
**Verdict: MERGE-CANDIDATE, subject to CI and independent selection receipt; execution NOT-VERIFIED.**
Read all six files through GitHub Contents: `runtime-campaign/README.md`, `selection.schema.json`, `scripts/runtime_campaign/{__init__.py,control.py,prepare.py,test_reconcile_history.py}` at `pull/318/head`. API compare against target identifies these six files as added; PR is behind target and should be assessed against target CI before landing.

Positive static evidence: `prepare.py:91-101` loads the two canonical JSONL inventories, enforces 185 distinct IDs; `:104-155` requires exactly 94 reviewed IDs, classification `PATH_PRESENT_RUNTIME_REQUIRED`, no conditional release and exact 40/64-character SHA shapes. `:184-236` carries source story, candidate/tree/artifact, negative proof and evidence template; `:239-265` assigns bounded non-overlapping leases. `:324-346` refuses output inside checkout; `:349-419` checks counts, job digests, wave coverage and lease overlap; `control.py:37-60` independently rebuilds and compares manifest and every job. `test_reconcile_history.py` includes duplicates, 93 stories, conditional-story rejection, tamper/manifest rewrite and checkout-output tests. Source JSONL files are present in base; `reconcile_execution.py` exists.

**Static limitation / finding 3:** The external classification receipt and candidate/tree/artifact hashes are accepted as shaped input; no API-backed proof binds those supplied values to the actual installed candidate or validates the classification receipt's digest against independently fetched bytes. This is correctly an external review/operational prerequisite, **not a PASS or signed receipt**. An absent or malformed selection fails closed; if incorrectly typed scalar fields pass directly to regex or malformed manifest fields cause uncaught Python exceptions, rejection still occurs, but polished diagnostic handling is desirable (not a release-blocking PASS bypass). Syntax/test execution: **NOT-VERIFIED**; no definitive syntax error established by static inspection. No fake receipts observed.

## 3. #319 — 13 capability / 8 environment preflight
**Verdict: MERGE-CANDIDATE, subject to CI and actual reviewed inputs; execution NOT-VERIFIED.**
Read all six files: `blocked-harness/README.md`, `contracts.schema.json`, `scripts/blocked_harness/{__init__.py,control.py,evaluate.py,test_reconcile_history.py}` at `pull/319/head`.

Positive static evidence: `evaluate.py:127-137` uses 185 canonical distinct source stories; `:140-217` checks unique IDs, exactly 21 selected (13 capability + 8 environment), allowed requirement kinds and source status; `:220-273` demands one observation per requirement and exact candidate/tree/artifact equality between selection and observations; `:316-413` emits only BLOCKED, PRECHECK_INCOMPLETE or READY_FOR_EXECUTION, with `journeys_executed=0` and `pass_claims=0`; `:416-448` refuses output in checkout; `:451-535` checks manifest and record digests; `control.py:33-115` validates canonical actor bindings, calls existing `reconcile_execution.validate_record` (present at base, line 250), and re-evaluates all results against external inputs. Tests cover 13/8, actor binding, changed candidate, tampering and no checkout writes. `UNAVAILABLE` capability stays incomplete (not fabricated absence); `UNAVAILABLE` environment stays environment-blocked per documented decision.

**Static limitation / finding 4:** Classification and probe-bundle SHA-256 are supplied by external reviewers/operators; the program checks syntax and cross-input matching but **does not independently attest** supplied observations, probe bytes, deployment provenance or correctness of actual host state. This is intentionally a preflight **formatter/verifier**, not a probe executor. The documented separate ledger admission is still required. Python syntax/tests and receipt provenance: **NOT-VERIFIED**. No missing `validate_record` import in the reviewed base.

## 4. #332 — hidden-risk remediation versus #329
**Verdict: LAND-#329 (once its own CI qualifies); #332 adds no unique effective blobs versus current base + #329.** Do not land either from this review.

Blob-for-blob GitHub Contents comparison (same path at current base, `pull/332/head`, and `pull/329/head`):
| File under `modules/sucafina/Sucafinav1/` | #332 vs base | #332 vs #329 |
| --- | --- | --- |
| `product/documents/parser.ts` | identical | different |
| `product/interface/import-http.ts` | **different** | **identical** (`f6b4f6175abcd3a00714dcdbf3997f040304dfc5`) |
| `runtime/local-backups.ts` | identical | different |
| `runtime/local-jobs.ts` | identical | different |
| `test/document-parser-resilience.test.ts` | identical | different |
| `test/fixture/parser-probe-worker.ts` | identical | different |
| `test/fixture/parser-ready-hanging-worker.ts` | identical | absent on #329 branch |
| `test/import-http-admission.test.ts` | **different** | **identical** (`d3c3044f558e27f14bc842999f0158e88a88142e`) |
| `test/local-maintenance-resilience.test.ts` | identical | different |

**Finding 5 — seven redundant paths and two exact matches:** relative to verified current base, #332 changes exactly the two import files. The seven other paths are already in base byte-for-byte, although the older PR compare reports nine changed files because its merge base predates the integrations (#328/#331 per task context). Current #329 head has **exactly the same two import blobs** as #332. Thus landing #332 immediately delivers the same import-intake behavior/tests as #329, but bypasses the choice to await #329 green; waiting for #329 CI offers the same content with a more direct PR lineage. #329 is the complete intake-bounds fix **for the two files under comparison**: `import-http.ts` has multipart body size/deadline/part/concurrency controls and bounded JSON body; the matching admission test covers over-limit parts, stalled input, concurrency/abort and deadline. Full runtime correctness, successful CI, factory flake attribution, historical exact #328/#331 merger SHAs: **NOT-VERIFIED** in this API-only cold review. Do not interpret blob equivalence as green CI.

## Findings / gates
**Five review findings**: 2 ADR reference corrections (#301); 1 external receipt provenance gate (#318); 1 external observation/probe provenance gate (#319); 1 duplicate effective changes / landing-order decision (#332). No runtime tests or Python were executed; all four PRs are unchanged. Static inspections are not deployment, review signature, or CI proof.
