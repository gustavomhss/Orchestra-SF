# Mission 122 — six residual C58 TypeScript diagnostics

**State:** five source paths patched and remotely verified; ready for **114 intake only**, with one mandatory owner-owned shared-fixture dependency. This is **not** a compiled or product-tested candidate, not an approval for merge, and **GLOBAL_RELEASE=false**.

## Identity / immutable evidence

- Campaign `sf2h-integral-20261112`; fixed plan `dbf9547211d9b0fade619790de7c19c0869b7c7d`; C58 source `422f1ed7b549021d7c62c834c9d9041279112af4` (tree `647b024075265fc76d6253c99bec00a82618f816`).
- Mission JSON pinned at `2dc0f8f1640495a84d1207710c50a9dabfd66bde`. Lease `residual-type-repair-e1-browser122`; effective model GPT-6; separate session ID not exposed. Manual browser continuation; no native Goal resumed.
- Before source edits: [ACK122.json](ACK122.json), commit `1af5cc577b433b1dfdedd9fefa1bcfc52c06e615`, committed remotely from exact C58 HEAD by CAS.
- **Material source**: [commit 4ab69f8](https://github.com/gustavomhss/Orchestra-SF/commit/4ab69f8ae6b7d734f6b96002e3937f2ba32b0f7e), tree `b7c5fcf93cf7783c18aa1c1ce3c9ccae5f2797cb`, five paths only, [complete patch](PATCH122.diff), [all pre/post Git blob SHAs](PREPOST122.json). Five material postimages separately fetched from GitHub and matched.
- C58 compiler evidence: [run 43726143757](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43726143757), job `132848377567`, artifact `14166956181`: 22 unique errors / 16 owned by 121 / six allocated here. No new run by 122.

## Changes (exact scope)

| Source | C58 diagnostic | Minimal semantic repair |
| --- | --- | --- |
| `apps/cli/src/sucafina-product/bi-services.ts` | TS2322:228 | Capture validated `BI09 | BI10` view ID after guard, before async closure; no cast |
| `product/interface/http.ts` | TS2367:111 | Preserve `provider-conflict` HTTP 409 rather than compare nonexistent `conflict` in this dispatcher status union; denied403/stale409/needs-input400/other503 retained |
| `test/product/export-artifact-closure/fixture.ts` | TS2345:80/82 | Independent stable v4 UUIDs for the source project row and unselected private row; synthetic names, auth, tenant isolation unchanged |
| `test/product/reports-draft-reconciliation/history-provider-read.test.ts` | TS2322:50 | Canonical typed ref from authenticated installation; assert actual fixture target matches before reading original C08 receipt |
| `test/product/reports-draft-reconciliation/installed-read-integrity.test.ts` | TS2322:31 | Same typed identity and fail-closed fixture target validation; no oracle/authorization relaxation |

Path prefixes in the table are relative to `modules/sucafina/Sucafinav1/`, except the first `apps/cli` path.

## Mandatory shared owner handoff — not silently applied

The source fixture `test/product/wp08/relations-fixture.ts` (outside the mission 122 allowlist) still seeds **real C08 receipts** under `{ref:"workspace", incarnation:"workspace-inc"}`. Both consumer tests now require the production target `{ref:`sf-workspace:<installationId>`,incarnation:installationId}` and deliberately **fail closed** if that real receipt identity is inconsistent. A typed ref without migrating the actual writer is *not* a real fix.

- Exact original shared blob `be5780125d823cc73323f16683d52e962d79d5a5`.
- [Complete owner patch](OWNER-RELATIONS-122.patch) (not applied) and [owner manifest](OWNER-RELATIONS-122.json); proposed full-file Git blob `d7983764984d04dba911819b004701866810e179`.
- Patch derives the target from the already admitted, validated `read.binding.installationId` in the original fixture, ensuring the producer and consumers share an actual installation identity without any casts/grants/test removal. It does not invent new auth or bypass receipt comparison.
- **114 must reconcile that fixture's active owner and apply this exact patch together with the five source postimages (or obtain its authoritative equivalent)** before 120 runs these report tests. Source branch intentionally leaves the shared producer unchanged. Until consumed, these two tests are known to reject the legacy fixture and cannot be described as PASS.

## Ownership / intake

1. **114 / PR65**: verify five C58 preimages or reconcile fresh HEAD; ingest only the five postimages/patch, not the entire source branch; separately adopt the owner-owned fixture patch under legitimate authority and verify unchanged original C08 assertions. Source 116/PR112 and 118/PR114 were already composed into C58; owner 52/PR40 has an explicit terminal authority receipt and 111/PR109's scoped private HTTP patch is already in the HTTP preimage. Keep their work.
2. **119 / PR107**: run hosted `bun typecheck` in `modules/sucafina/Sucafinav1` and `apps/cli` plus relevant compiler/guard gates on the **114 composed** candidate; report exact W/tree/program/errors. No typecheck by 122.
3. **120 / PR106**: deduplicate and dispatch surgical `test:ci` Actions on a pinned composed W/S, including the two reports tests, export fixture consumers, BI/portfolio consumers, and HTTP conflict mapping. [Prepared request](CI-REQUEST122.json) is **not** a dispatch or a passing result.

[Dependency closure](DEPENDENCIES122.json) retains owners, blocked tests and consumer actions. No local tests or TypeScript commands; no second CI dispatcher, generated-file edits, scope/grant/policy change, dev/sf2-stack edit, force, merge, deploy, Azure, restart or native Goal reactivation.

**Evidence status:** source changes delivered; reported diagnostics addressed at source coordinates, **compiler verification pending 119**; **consumer tests pending 120 after 114 accepts shared patch**; consumer ACK pending. No synthetic green, no C/G7 or D/G8 acceptance.
