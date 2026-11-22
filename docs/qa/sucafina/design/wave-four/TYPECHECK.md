# Technical verification and typechecks

## Current composed candidate

[Gate15 / run 44968622344](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44968622344) passed all **14 checks / 87 regression cases** on snapshot `bf0ef86bb6f9e7e3d19ab5a1826bb9f188b0e004`, product `218a5ee39935336c88abeb92b0a4d2cc980f21de`, after incorporating exact dev `699ad1a1f837ef4a918b73ba89b06aa9cc0a10db`. Application declarations, E2E semantics and the full CLI package typecheck each exited 0. Exact-dev guards passed with 78 rules, zero errors, 21 warnings and no approvals; seven generated palette files remained byte-identical.

Gate14 passed thirteen checks and all 87 regression cases, but its E2E typecheck caught a diagnostic-only method-access mistake: new URL received request.url instead of request.url(). Correcting that one accessor resolved the error; no type suppression or weakened compiler option was introduced. Gate15 includes the correction and final UI41 CSS.

The historical CLI diagnostics below were corrected by incorporated upstream commits. They are preserved as history, not a current typecheck limitation.

## E2E typecheck boundary

The existing `typecheck:e2e` command runs `tsgo -p e2e/tsconfig.json` and has `noEmit: true`. Its inherited app configuration enabled `composite` and `emitDeclarationOnly`, which also requested declaration-serialization diagnostics even though this test command produces no declaration artifact.

Canonical Procurement fixtures introduced transitive source contracts and generated JSON schemas. Runs [44955486808](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44955486808) and [44955972653](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44955972653) identified the imported file closure and an accidental internal UI-model import in the Decisions journey. The closure was listed explicitly, and the journey now uses the producer contract and references read from the actual admitted native route.

Run [44956295629](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44956295629) then reported only TS7056 at the three generated output-schema maps: their inferred declaration representations exceeded the compiler's serialization limit. No source schema, generator, runtime value or public contract has been widened or changed.

The E2E project now explicitly sets `composite: false`, `declaration: false` and `emitDeclarationOnly: false`, retaining `noEmit: true`, strict checking and every existing explicit include. The same command still performs semantic checking of all imported fixtures, producers and consumers. It no longer checks whether the test project could emit a composite declaration artifact, or enforces composite's explicit-file-list diagnostic TS6307.

The application configuration and its separate `tsgo -b` gate remain unchanged, including declaration verification. No workflow, guard, approval or allowlist was changed; no diagnostic suppression or broad type cast was added. [Hosted gate11](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44964454946), snapshot `7fa02bcd424429bf4fb86ea2cc458db76400ccb4` over product `3c57dcc8e64dbc3b725f27af82242bd9ac9fbdd0`, passed the application declaration build and E2E semantic check. Its twelve checks also passed exact-dev guards, palette byte parity and 84 regression tests, including the actual enrolled host.

## Historical additional CLI package audit

The native queue and FX fixes also received a full CLI package typecheck. Candidate run [44957864987](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44957864987) reported seven diagnostics. A separate snapshot of exact merged dev `d9ab14b6d9cab74843b0689d5d67d1c70d45cc02`, run [44958162297](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44958162297), produced the identical seven diagnostics in `host-context.ts`, `team-current-choice.ts`, `team-purchase-mcp.ts` and `sucafina-native-documents.test.ts`. The comparison normalized locations only; file, error code and message were identical. No compiler flag or source suppression was added to accept them. That historical audit was a known baseline failure; the current full CLI typecheck above is green. The app declaration build and strict E2E check both passed.

## CLI audit after native reading-health integration

[Audit5](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44963827656) tested product `7c0caf8da905a03579379c35ce1cd49375a87509` in snapshot `71e73384e3fb0a9d10faa8b7e2b17a491469c930`. Its seven file/code/message diagnostics match [the exact-dev baseline](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44958162297); only timestamps, Actions display markers and line/column locations were normalized. The host-context location moved from 933 to 936; its diagnostic and continuation remain identical. No new diagnostic remains.

Audit4 had exposed three test-only errors in the new original SQLite fixture: implicit callback parameter types and an optional transactionAll method. Those were corrected with the exact Snapshot/BlobTransaction types and an explicit presence check for the original snapshot methods. No cast, suppression or compiler option was added. Audit5 remains a historical failed workflow on the earlier base. The current composed full CLI run above passed after the upstream repairs; the two results must not be conflated. [Machine-readable comparison](cli-type-audit.json).
