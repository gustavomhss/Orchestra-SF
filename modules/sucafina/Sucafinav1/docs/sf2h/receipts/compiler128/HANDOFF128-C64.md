# Handoff 128 → integradora 125 — compiler C64, SDK, guards

**Authority:** `compiler-e2-browser128`, [ACK128.json](./ACK128.json). Mission119 revoked by S0; no runtime termination or session ID inferred. Compiler branch `sf-compiler-checks` / [PR107](https://github.com/gustavomhss/Orchestra-SF/pull/107); **125 exclusively owns `sf2-stack` / [PR65](https://github.com/gustavomhss/Orchestra-SF/pull/65)**. Product tests are 129's exclusive lane.

## Actual frozen input and hosted execution

- **C64:** `8f933d3249f49e1234b745036672d7c7a6aabcd4`, tree `3ff9cda9d0e2bf45a379cc580341031787c3c815`. Compiler W `b7d04113f6904a65d5fb37a8cd7e7acd229783a0`; GitHub Actions [run 43738074189](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43738074189) / [job 132884987559](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43738074189/job/132884987559), attempt 1; [artifact 14171118214](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43738074189/artifacts/14171118214), ZIP 371,517 bytes, SHA256 `a5d461c04472046a6944f1ff27ded9fe5f66586f5ca8884fafd81c676e71d078`. All source files fetched from C64 only, not from an in-flight branch.
- **Actual dev:** `a1d37698a7bb097c1578f827eba6a19b9917ef07`; **merge-base:** `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`. Hosted Ubuntu 24.04, Bun 1.3.14.
- **23 executed: 15 exit0 / 8 nonzero, entire job FAIL.** See [RESULTS128-C64.json](./RESULTS128-C64.json) for every command, cwd, exit and source identity; 23 raw logs + generated artifacts + E2E inclusion remain in true Action artifact. No fabricated PASS or cross-SHA reuse.

## SDK generation BLOCKED (not a generated patch)

`cd packages/client && bun run generate` **exit1**: `GenerationError: Input schema must be a struct: server.sucafina.sucafina.installations.query`, from `tooling/httpapi-codegen/src/index.ts:761`. `packages/protocol/src/groups/sucafina.ts` passes `SfInstallationSelector` as HttpApi GET query, whereas `packages/schema/src/sucafina/context.ts` defines a union of two structures. **Owner W02/F01, with 125 integrating**: reconcile actual public query/source contract *without weakening strict admission*; do not patch the generated output or codegen validator to hide it. Generator was genuinely attempted; capture succeeded, but the patch is **0 bytes, no valid regeneration**. All **56 old generated leaves unchanged** and their exact Git pre/post blob IDs are in [SDK-PREPOST128-C64.json](./SDK-PREPOST128-C64.json). Original 21,470-byte per-file SHA256 manifest, generator logs, and empty patch are retained in Action artifact. **SDK requires rerun after upstream change**.

## Final-bundle artifact, NOT executed

Existing builder v2, pinned actual test-ci source blob `3185885e123f9bb13c16c670e4df2fcffab38290`, generated `sf2-epic.generated.yml` **57,314 bytes / SHA256 `c6c0e2583a5be2bb393d3db832232c6625ceb28370bf1f7f815eb3a661b77394`**; committed old epic differs (**54,846 bytes / SHA256 `5c87488dbb717ad4e5a410aa69cc0cb15264465512d8546838497c2ae58301b8`**): **`BUNDLE_DRIFT` exit1**. Original emitted YAML, before-image, 4,370-byte patch and both hashes in artifact for **125-only** preimage-checked integration. This is NOT accepted C, NOT an epic dispatch, NOT green.

## Exact TypeScript diagnostic routing

| Owner | File:line:column | Code | Diagnosis |
| --- | --- | --- | --- |
| W16/A04 | `packages/schema/src/sucafina/decisions/source-contracts.ts:16:262` | `TS1005` | ';' expected; shared parser failure repeats in schema/client/sucafina |
| W11/A03 | `apps/cli/src/sucafina-product/native-ui/procurement.ts:333:84` | `TS2345` | Transaction callback result is incompatible with inferred typed signature |
| W11/A03 | `apps/cli/src/sucafina-product/native-ui/procurement.ts:375:11` | `TS2367` | unauthenticated vs ok types have no overlap |
| W03/F02 | `apps/cli/src/sucafina-product/native-ui/router.ts:57:16` | `TS2339` | metadata union lacks maxRequestBytes at access 1 |
| W03/F02 | `apps/cli/src/sucafina-product/native-ui/router.ts:57:72` | `TS2339` | metadata union lacks maxRequestBytes at access 2 |
| W06/S01 | `packages/app-shell/src/orchestra/chapters/sucafina/shared/table/index.tsx:226:31` | `TS2657` | JSX expressions must have one parent element |

6 unique diagnostics. Schema `TS1005` repeats in Client and Sucafina (three failed package checks). Typecheck **PASS** for Protocol, Server, Core, Atlas; **FAIL** for Schema, Client, Sucafina, CLI, App. Full original logs unchanged in artifact. **No source fixes by 128**.

## Guards, real baseline, no suppression

`bun run check:guards --base origin/dev` **exit1**: **56 GATE** (`agent-scratch`) and **115 WARN**. Of 56: **55 historical `*.log` gates** preserved intact in [119 Guard55 immutable manifest](../gate-tooling-repair/GUARD55-MANIFEST.json), require genuine external reviewer/Maestro determination; **1 new gate**, `packages/app-shell/e2e/sucafina/native/fixture/scratch.ts`, belongs **W05/F04**. WARNs: timeout73 / new deps22 / binary11 / large files4 / test-globalThis2 / empty-catch1 / abs path1 / ts-double-cast1. No ignore, self-approval, rule relaxation, log deletion, or invented waiver. Original guard log SHA256 `0bde4013731b9f603c3eee0c8f369eda36aa0e2b7caeae436d6ab34a6d1a3869` in artifact.

## Positive checks, scoped precisely

Sucafina real E2E compiler `--showConfig`/`--listFiles` + strict verifier **PASS** (3,697 files, 78 declared roots, zero TS diagnostics); Atlas generated before/generate/after/diff **PASS**, spawn-imports **PASS**, bundle requests/inventory **PASS**. These are **not product tests**, nor installed proof; 129 dispatches test CI after 125 readiness.

**Checkpoint `HOLD`**. 125 to route W02/F01 codegen query and W16/A04 schema parser first; W11/A03 CLI procurement; W03/F02 router metadata; W06/S01 JSX; W05/F04 guard; independent reviewer handles historical 55. After 125 integrates actual corrections on a new identified C/tree, request **one** scoped 128 recheck (dedup unchanged inputs). No epic, no dev merge, no deployment, no Goal restart, no GLOBAL_RELEASE.
