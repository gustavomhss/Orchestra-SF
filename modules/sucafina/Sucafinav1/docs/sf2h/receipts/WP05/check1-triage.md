# WP05 Check 1: exact product, failed typecheck, passing guards

The GitHub Actions run [43518137324](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43518137324), attempt 1, completed with `failure`. Job `132205264384` failed only the `Typecheck Sucafina package` step. The guard check, exact-product verification and evidence upload succeeded.

## Identity recorded by the running job

| Field | Recorded identity |
| --- | --- |
| Product / `GITHUB_SHA` | `19a8d725584b89ad97cd9a9bdbb018b5339b9d16` |
| Product tree | `010642fac42902b8601af8ebbe07ac81d9262e63` |
| Branch | `astra-check-wp05` |
| Guard base reference | `origin/dev` |
| Guard base commit | `a1d37698a7bb097c1578f827eba6a19b9917ef07` |
| Guard merge-base | `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf` |
| Product parent / seed | `b33541ede0fd715fc0990aebeb3fe484d0991cb7` |

The remote Git commit and workflow run both agree with the job's recorded SHA/tree. The job's final check also confirmed `HEAD` remained exact and tracked content was unchanged.

## Typecheck attribution

Command: `bun typecheck`, working directory `modules/sucafina`, exit code **2**. The complete decoded log contains **186 TypeScript diagnostics**.

| Classification | Count | Evidence / action |
| --- | ---: | --- |
| External files inherited from seed | 141 | W1 changes none of these paths. 139 have the same path, TS code and primary message in the previously observed WP02 check. |
| WP05, existing seed imports of absent WP00 contracts | 4 | `BiPresentation` import/export in `analytics/semantics.ts`; `SfBiArtifact` imports in `analytics/contextual.ts` and `wp05/contextual.test.ts`. All four import lines already exist in the seed. |
| WP05, existing seed callbacks affected by absent `BiPresentation` | 35 | Exact source lines map back to the seed. Contextual callback types cascade from the unresolved presentation type. |
| WP05, new callbacks affected by that same missing contract | 4 | Three callbacks at `analytics/semantics.ts(26,90/119/126)` and one at `wp05/consumer-dashboard.test.ts(103,48)`. No replacement contract or `any` suppression was introduced. |
| WP05, new fixture type errors | 2 | `engine-fixture.ts(128,11)` and `(129,11)`: spreading a discriminated `ScenarioResult` before narrowing did not retain the relation between comparison and coverage completeness. Corrected locally after W1 by explicitly requiring both actual previews to be `conditioned` before assigning case coverage identity. Awaiting the next CI run. |

The absent-contract attribution is based on source comparison and type flow. An exact typecheck of the seed was not executed locally or claimed. The comparison baseline for previously observed diagnostics is run `43515394127`, job `132195964120`; it is a different WP branch, not a substitute exact-seed gate.

The two external diagnostics without an identical primary message in that prior log are `product/imports/dashboard-preview.ts(38,75)` (a differently rendered union message) and `test/product/wp03/port.test.ts(77,54)` (a `series` callback affected by the absent presentation contract). Both paths are unchanged by W1. All 186 records, precise locations, source-line correspondence, and correlation flags are in `check1-triage.json`.

## Guards

Command: `bun run check:guards --base origin/dev`. Exact result:

```text
guards: 78 rules, 591 changed paths, 0 gate and 11 warn findings, 0 errors.
```

All 11 warning paths are inherited from the seed, unchanged by W1: ten dependency warnings in `apps/cli/package.json`, `modules/atlas/boundary/package.json` and `modules/sucafina/package.json`, plus one preexisting double cast in `product/decisions/analysis-acceptance.ts`. The JSON report retains each warning verbatim. Guards succeeded; their success does not turn the failed typecheck green.

## Retained evidence

Complete decoded job log: `ci-evidence/check1-132205264384.log`, **137570 UTF-8 bytes**, SHA256 `75ea3c6737789e3c45874476a56c18af5e40f9ad57c2f413f02074ce65de4ea6`. The saved bytes are the complete MCP log response content.

Uploaded artifact: [astra-wp05-check-1](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43518137324/artifacts/14082096095), ID `14082096095`, **8656 bytes**, digest `sha256:b3a306fce9e37af68157f8d3a6f185cfe6c84e8b857c366b957b6d357e284e97`. Metadata reports creation at `2026-11-13T22:19:18Z`, expiry at `2026-11-27T22:19:17Z`, and the same W1 SHA. The job log confirms the upload and digest. The parent audit downloaded this ZIP with the supported GitHub MCP artifact tool, verified that SHA256, inspected all three members (product.json, typecheck.log and guards.log), and confirmed the recorded product SHA/tree. Raw logs remain in Actions artifacts; the repository retains structured summaries rather than scratch log files.

Other retained files: `check1-run.json`, `check1-jobs.json`, `check1-artifacts.json`, `check1-product.json`, `check1-changed-paths.json`, `check1-source-files.json` and the exact W1 source excerpts under `check1-source/`. Reproduction of log/source attribution is metadata-only: `node ci-evidence/triage-check1.mjs`.

## Additional fixture correction after Test 1

The independent test run later identified a fixture setup failure for EUR: the actual Planner save command rejects a non-USD line whose currency is absent from its FX catalog (`runtime/planner.ts`, the `Unknown currency` guard). A registered EUR entry with `rate: null` is explicitly supported by the same runtime and preserves missing FX. The WP05 fixture now provides `{ id: "EUR", cur: "EUR", rate: null }`; it supplies no rate or computed financial result. The existing EUR/USD, unavailable-threshold, persisted-reference and stale-criterion assertions remain intact. This correction, like the type narrowing, requires the next published CI result before being called verified.
