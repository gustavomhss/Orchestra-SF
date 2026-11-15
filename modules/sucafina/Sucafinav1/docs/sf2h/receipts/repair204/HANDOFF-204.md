# Mission 204 — causal XLSX / BI / People type closure

## Authority and ACK

- Campaign: `sf2h-integral-20261112`, T0 `2026-11-13T04:01:10Z`.
- Explicit mission/epoch: `204 / compiler-source-e1-browser204`. This is a new ChatGPT conversation, ACK of the assignment only; model reported by this assistant: **GPT-6**; host session identifier: **NOT_EXPOSED**. No predecessor session or termination was observed/claimed.
- Prepared branch `sf-fixture-types`; exact live reserved head **2c086e65163feaa15b59f91e9daa8a9d45e1a691** verified before authoring and before Git-object creation. Parent product `4426445c05823ed4932b8a8e35391df024bf74f3`. S0-FENCE read from `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair204/S0-FENCE.json`, blob `fafb8f1ff9556254c8d96bdbb0da75473b396219`, matching mission/epoch/write paths; administrative transfer, not host lifecycle evidence.
- Immutable planning `dbf9547211d9b0fade619790de7c19c0869b7c7d`, normative UX `cbac654784714f68779ae1434d30e6ea8970c4d1`; root AGENTS and current applicable sources read. Package `204.json` blob `605660f6d4ea52be64918a1d6fd1c47aeeac33d6`, no predecessor packets or own work orders specified.
- Authoritative patch commit: **the commit containing this receipt on `sf-fixture-types`**, GitHub PR/branch readback identifies SHA after CAS. Deliberately do not self-reference a prospective commit in its own content. No merge into `sf2-stack` or `dev` by this writer.

## Complete source patch and Git pre/post blobs

The complete unified diff is `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair204/PATCH-204.diff` (Git blob `da5df647874357789fd12c5faba5506c0eb69917`). This is the only source change set:

| Path | Preimage Git blob | Postimage Git blob | Causal change |
|---|---|---|---|
| `modules/sucafina/Sucafinav1/runtime/workbooks.ts` | `2cae2a7f0a8b76f4759572099d8e27729c698b98` | `a1b569413d4214a4c4310429b1d7a139e6d12204` | TS2322 ExcelJS PaperSize, preserve documented A3=8 and existing A4=9 |
| `modules/sucafina/Sucafinav1/test/native-ui-contract/bi.test.ts` | `26017329781b67185ffdfb2b0e5cfdfc00c001b2` | `09d294a0ff7131f625420aa1a94c560891f880bf` | 11 BI diagnostics: 3 root decodeUnknownSync input services and 8 transitive unknown projections |
| `modules/sucafina/Sucafinav1/test/native-ui-contract/people.test.ts` | `0f5d05fba397355585e8a96013387f146f4208f5` | `16661879c65c608e63451743c13caabe97b63feb` | 4 People diagnostics: Object.entries string key and widened member enum literals |

1. ExcelJS **4.4.0** is pinned in Sucafinav1/package.json (blob `18911fee9313f8fb57c1a972bc70eec2f7864c55`). Its public `index.d.ts` has a `const enum PaperSize` with A4=9 but omits A3, while the exact v4.4.0 README documents **A3 = 8**, and `lib/xlsx/xform/sheet/page-setup-xform.js` serializes and parses numeric `paperSize`. The authorized module adds only a compatible TypeScript module augmentation `PaperSize.A3 = 8` and accepts the real public `PaperSize` type at the helper boundary, **without importing an enum runtime value** or casting an unknown number. The A3/A4 selection remains 8/9; OPEX/CAPEX remain two pages wide and others one, fit height=0, orientation, ordering, print titles, print area, margins, wrapped row heights, all columns and data are untouched.
2. The eleven historical `bi.test.ts` TypeScript occurrences are caused by **three** `Schema.decodeUnknownSync` invocations on public `SfBi` output unions: `bi.bi-data` line 59 and the denied/stale table loop lines 117/118. Effect 4's `Schema.toEncoded` projects the **public wire-side** schema, with no decoding services required, without weakening or replacing any declared wire field, success/failure branch, assertion or raw payload. All six BI test cases remain, including 0 vs null, redaction reasons, digest mismatch, stale/denied, four typed operation IDs and AbortSignal.
3. The four `people.test.ts` local diagnostics are one Bun `toBe` literal-key mismatch (compare `id` with the schema literal operationId) and three widened `string` fields in the save input and mutation base. `as const` preserves only exact public enum literals (`Employee`, `Active`, `Talent`); runtime input, unsupported-field negative, CAS, transport outcome and expectations remain identical. All eleven People cases remain, including non-admin Talent redaction, audit, version conflicts, invalid source fail-closed, and refusal of an extra private payload. No fake identity, grant or new source field introduced.
4. No other code changed and no shared path touched. Historical Client/F02, Work/A12/201, Transport/203, UI, SDK, schema and product integrations are owned by other sessions. Never treat their transitive compiler diagnostics as local 204 failure.

## Evidence and validation status

- Historic compiler evidence ONLY: W77e `77e58de895b5157b2a32e3427483bd12f40a7525`, run **43772959867**, job **132992733158**, artifact **14185067705** (SHA256 `10cc10bd1d742c06ce8cd87ea8d7b2b14dbb80fada9551c826e3f6383f70d547`), old compiler product head `b935f51ca9333c77d2b13ced8e7ad743df79468d`. W77e = 3 PASS/6 FAIL of nine checks, **not** current product C. Browser run 43773852118 = 7 PASS/1 FAIL, NOT a native positive proof.
- Local tests: **NOT_RUN (explicit mission prohibition)**. Local typecheck: **NOT_RUN**. Local build/validator: **NOT_RUN**. New CI: **NOT_DISPATCHED**. No positive validation/accepted C claim is made by this author.
- Static authored patch review: full diff and known-public contracts reconciled to the reserved source blobs; this is **not** proof of compilation, package exports, installed ExcelJS behavior or a native browser execution.
- This fixes the historical static type root for `workbooks.ts:384` that blocked TSGo E2E inventory. Inventory and export regression **must be measured after integration**, not inferred from the patch.

## Next consumers: no dispatch by 204

- **189 / sole `sf2-stack` integrator**: consume PR from `sf-fixture-types` by exact commit and file blob preimages above with compare-and-swap, preserve current product/parallel work, and reconcile any stale preimage before applying; no general branch overwrite. The patched source itself is ready for consumption; the S0-FENCE/receipt are evidence and not global-release gates.
- **190 / `sf-compiler-checks`, PR #107**: **after 189 consumption**, compile only change-scoped Sucafinav1 inputs (`runtime/workbooks.ts`, `test/native-ui-contract/bi.test.ts`, `test/native-ui-contract/people.test.ts`) with their actual imported public schema/transport dependencies using the existing hosted compiler lane; rerun affected E2E inventory that W77e blocked. Report all exact diagnostics/new run and distinguish remainders inherited from 201/203 rather than creating a second compiler.
- **200 / sole product CI, `sf-ci-validation`, PR #106**: **after 189 consumption and coordinated 190 result**, request a deduplicated surgical run using the existing `test:ci` dispatcher for `modules/sucafina/Sucafinav1/test/workbooks.test.ts` (Planner print/export, salary privacy, member XLSX), `test/native-ui-contract/bi.test.ts`, `test/native-ui-contract/people.test.ts`, and relevant `test/dashboard-people-runtime.test.ts` selections; record exact W/tree/runtime/fixtures, expected cases and whether tests actually ran, plus print XML A3/A4/fit/repeat and Talent negative outcomes. Do not treat a request/comment as a CI execution.
- Original criteria, eight FINAL suites, AM01–AM06, C/G7, D/G8, three independent reviews remain obligatory. **native_goal=paused**, **GLOBAL_RELEASE=false** until all gates.

## Ownership / outstanding external dependency

This writer authored all independent causal changes available in its three files; **no blockers to source PR**. Integration 189, hosted typecheck 190, and CI dispatch 200 are external, unperformed dependencies and must retain their single owners. No engine, infra, SDK generated, cloud, auth, guard or other session paths were edited.
