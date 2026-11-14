# W20 — Review atomic source-fence correction

Status: own implementation sealed in staging; no product execution, local test, local typecheck, hosted dispatch or publication was performed by this builder. W19 remains a failed hosted result. The proposed W20 correction has no passing result yet.

## Hosted facts and provenance

W19 product `d357de0b1f58abc33e86e79ad3f93b8715ba0e83`, CI snapshot `12988ada266de298d0ec0ba9d8968845ae4c7782`, run `43595658990`, job `132449464415`. The terminal result is failure: 105 pass, 17 fail, 1 error, 122 tests across 22 files, 2115.53 seconds. Cleanup succeeded. The raw log is `evidence/W19/A-job-132449464415.raw.txt`, SHA256 `37e8cd669418575398e22ca2d3bf17d8c2f82c4c36c62006f71045fdaa334c4f`. `hosted-observations.json` retains the relevant normalized tests and phase records with raw log line numbers.

| Observed case | Result and duration | Raw log line | Interpretation |
| --- | --- | --- | --- |
| Resident Review grouped read | Nested local write attempted; 40675.43 ms | 1415 | A real resident canonical reader reaches a nested writer entry under the C08 read group. |
| Review source current case | Positive request expected 200, received 409; 40561.60 ms | 1453 | Stops before the intended participant revocation. |
| Review source previous case | Positive request expected 200, received 409; 58442.71 ms | 1491 | Stops before the intended predecessor revocation. |
| Review source successor body | Positive request expected 200, received 409; 58344.37 ms | 1529 | Stops before the intended body tampering. |
| Review report/download | Cooperative 105000 ms deadline; 105084.41 ms | 1599 | Timing failure; no changed budget or claimed passing report. |
| Review successor comparison | Cooperative 105000 ms deadline; 105018.79 ms | 1637 | Timing failure remains subject to hosted qualification. |
| Review browser case revocation | Navigation commit deadline 15000 ms; total 32194.19 ms | 1740 | Valid HTML was eventually returned as 200 after 17961 ms; the browser had not yet requested review-read. |
| Review altered body and source history | Cooperative 105000 ms deadline; 105027.73 ms | 1869 | The source request began after a page response around elapsed 86195 ms and reached the deadline. |
| BI source case revocation | Cooperative 105000 ms deadline; 105047.79 ms | 1251 | Reaches the consumer; no promotion-coverage 409 is present in this failure. |
| BI browser persisted case access | Cooperative 105000 ms deadline; 105148.31 ms | 1353 | Page response 200 in 46 ms, options 200 in 14142 ms; data was pending at the deadline. Its eventual 403 followed abort and must not be relabeled as an earlier authorization failure. |

Five other BI call-scope counterproofs passed, each around 88–94 seconds. Eight Review cases passed, including the explicit default/local read scope, ordinary historical reopen, asset egress revocations, incarnation/binding/result corruption and receipt integrity. These facts do not qualify the failed cases. BI intake23 and C12/Memory corrections are owned by the integrator/other builders and were not edited here.

## Exact nested writer mechanism

The real fixture advances the case from version 1 to version 2 while preserving an actual Portfolio result and Review receipt. Its recorded Planner scenario contains an actual February exclusion operation. A current result read therefore rejects the historical case version, and the canonical Review authorization follows this path:

1. Own `review-read-integrity.ts` invokes the canonical producer twice through `legacyRead` because real resident contributions/outcome readers are installed. No resident proof cache is used.
2. Own `review-portfolio-history.ts` calls published `createReviewDecisionAccess` and `createPortfolioHistoricalProvenance` with the real case and evidence ports.
3. Published `portfolio/history-provenance.ts` opens each original candidate through `business.cases.read` and verifies its saved operation/result binding.
4. Published `decisions/case-port.ts` invokes own `scenario-operation-access.ts` to authorize the stored scenario's selectors.
5. `scenario-operation-access.ts` reads `business.readSourceFences` before and after its canonical domain checks.
6. W19 `business-services.ts` unconditionally invokes `persistence.transactionAll`, including when already inside `authority.state.read`.
7. Published `runtime/local-store.ts` routes `transactionAll` to `operation(true)`. `operation` checks the inherited provider scope, sets `root.poisoned = true`, and rejects before invoking the transaction callback. A callback returning `commit: false` cannot prevent that entry failure. At the outer read's exit the driver reports `Nested local write attempted`.

This is an exact static call path, supported by the authentic resident failure. The three HTTP 409 failures have no logged response reason; linking them to this same read-group failure is a static inference. `extended-http.ts` catches the grouped read error and maps its unavailable result to 409. No claim is made that a source response body exposing this reason was captured.

The real Memory provider's empty observation authorization only revalidates the host in this case. It is not the identified writer. Prewarming `prepare` cannot repair an unconditional new transactionAll call, so changing warm-up counts would not address the cause.

## Applied correction

`source-fence-read.ts` implements `createSfSourceFenceReader` over the existing authenticated host and persistence provider. The integrator applied the two-hunk `business-services-fence.patch`, replacing only the local source-fence reader construction and adding the helper import. The rest of the C17/G03 composition is preserved.

Before its first await the helper captures the actual Request object, every request header, method, URL, context kind/binding and a defensive copy of the provider's complete current snapshots, when present. It never accepts a caller-provided snapshot. If an atomic provider scope already exists, the helper:

- requires all three domain snapshots;
- revalidates the actual host authority and checks Request identity, non-abort, all headers and binding identity;
- reopens currentSnapshots after authentication, checks the full snapshot digest, and computes source fences from that reopened value;
- performs final real host validation and reopens currentSnapshots again;
- returns only newly computed string fences after full snapshot, Request, binding and source-fence equality checks.

There is no cross-call cache, no held snapshot returned as authority, and no nested transactionAll in this branch. Outside a provider scope the original serializable transactionAll read is retained, with additional Request/binding checks. A scope appearing across authentication is denied before attempting a writer entry. Errors yield unavailable fences.

The whole-snapshot comparison is essential. Published `sfRunSourceFence` expressly excludes `data.__sfProductV1`; equal source fences alone cannot prove unchanged C08 case membership, receipts, Review bodies or result bindings. The helper compares the complete snapshot around its awaits, while existing canonical readers still perform all of their own authority and body checks.

`review-read-integrity.ts`, `review-services.ts` and `review-portfolio-history.ts` are byte-identical to their package baseline. All final canonical Review callbacks, the real resident factory, real Memory provider, double read, C08 receipt checks and source/body guards remain. `extended-http.ts` and BI adapters were not edited.

## Counterproofs prepared for hosted execution

New full file `test/product/wp10/integration/source-fence-read.test.ts` has three tests, each retaining the canonical outer 120000 ms limit:

1. A real C08 case is committed into the real SQLite fixture. A real C08 read invokes the actual business source-fence reader twice and requires no nested transactionAll, unchanged complete state, identical source fences and unchanged durable case on reopening. Outside the group the ordinary transactionAll read is still exercised.
2. Actual provider-owned snapshots are adversarially changed at each of the two authentication boundaries. All three domain revisions and an unversioned case body are covered. The latter proves that the source-only fence remains unchanged while the helper rejects the complete snapshot change. The owning transactions roll back.
3. Actual Request headers, Request identity, AbortSignal, real UI lease and real host validity are changed at both boundaries. The adapter always delegates authority validation to the real host; no permissive verifier is introduced. The Request replacement is an explicit adversarial mapping change, not a new authenticated binding.

The existing resident grouped Review regression additionally counts nested transactionAll entries and requires zero, while preserving its assertions that the real Memory callback executes again inside the final group. No existing test or assertion was removed. The three source-egress cases retain every current-case, predecessor and successor-body expectation. Their positive 200 requirements are unchanged.

## Verification and remaining limits

Only pure text, import-path, hash and diff checks were run. `verification.json` records 96 resolved relative imports, no removed assertions/test declarations, unchanged 105000/120000 Review limits, and unchanged canonical Review reader hashes. No product parser, runtime, tests, typecheck, browser or build was executed locally. This builder did not publish or dispatch CI.

The helper targets the deterministic nested-writer failure. It is not a measured performance improvement. In particular, the browser's 17961 ms page response versus its unchanged 15000 ms navigation limit is not explained away by fixing the final grouped read. Full Review canonical rereads remain expensive; the report, successor, browser and body/source timing cases must still pass hosted execution. No timing estimate is presented as an observed result, and no foreign assertion or budget was relaxed.

The integrator should run the complete new source-fence file once and the complete existing Review portfolio HTTP file in the planned surgical request. Existing BI timing cases remain in the separate BI intake's qualification scope. This package contains no native or global acceptance claim.
