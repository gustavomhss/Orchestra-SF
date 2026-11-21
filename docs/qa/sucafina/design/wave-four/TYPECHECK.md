# E2E typecheck boundary

The existing `typecheck:e2e` command runs `tsgo -p e2e/tsconfig.json` and has `noEmit: true`. Its inherited app configuration enabled `composite` and `emitDeclarationOnly`, which also requested declaration-serialization diagnostics even though this test command produces no declaration artifact.

Canonical Procurement fixtures introduced transitive source contracts and generated JSON schemas. Runs [44955486808](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44955486808) and [44955972653](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44955972653) identified the imported file closure and an accidental internal UI-model import in the Decisions journey. The closure was listed explicitly, and the journey now uses the producer contract and references read from the actual admitted native route.

Run [44956295629](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44956295629) then reported only TS7056 at the three generated output-schema maps: their inferred declaration representations exceeded the compiler's serialization limit. No source schema, generator, runtime value or public contract has been widened or changed.

The E2E project now explicitly sets `composite: false`, `declaration: false` and `emitDeclarationOnly: false`, retaining `noEmit: true`, strict checking and every existing explicit include. The same command still performs semantic checking of all imported fixtures, producers and consumers. It no longer checks whether the test project could emit a composite declaration artifact, or enforces composite's explicit-file-list diagnostic TS6307.

The application configuration and its separate `tsgo -b` gate remain unchanged, including declaration verification. No workflow, guard, approval or allowlist was changed; no diagnostic suppression or broad type cast was added. [Hosted gate9](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44963051950), snapshot `7f33a61d9b8152075eaa9c36871adb01f1c110a6` over product `31944b99c3e9a049f1a529c149d32fa390c783a3`, passed the application declaration build and E2E semantic check. Its twelve checks also passed exact-dev guards, palette byte parity and 83 regression tests, including the actual enrolled host.

## Additional CLI package audit

The native queue and FX fixes also received a full CLI package typecheck. Candidate run [44957864987](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44957864987) reported seven diagnostics. A separate snapshot of exact merged dev `d9ab14b6d9cab74843b0689d5d67d1c70d45cc02`, run [44958162297](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44958162297), produced the identical seven diagnostics in `host-context.ts`, `team-current-choice.ts`, `team-purchase-mcp.ts` and `sucafina-native-documents.test.ts`. The comparison normalized locations only; file, error code and message were identical. No compiler flag or source suppression was added to accept them. This audit is a known baseline failure, not a green full-CLI typecheck. The app declaration build and strict E2E check both passed.

## CLI audit after native reading-health integration

[Audit5](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44963827656) tested product `7c0caf8da905a03579379c35ce1cd49375a87509` in snapshot `71e73384e3fb0a9d10faa8b7e2b17a491469c930`. Its seven file/code/message diagnostics match [the exact-dev baseline](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44958162297); only timestamps, Actions display markers and line/column locations were normalized. The host-context location moved from 933 to 936; its diagnostic and continuation remain identical. No new diagnostic remains.

Audit4 had exposed three test-only errors in the new original SQLite fixture: implicit callback parameter types and an optional transactionAll method. Those were corrected with the exact Snapshot/BlobTransaction types and an explicit presence check for the original snapshot methods. No cast, suppression or compiler option was added. The full CLI workflow still fails because of its seven baseline diagnostics; it must not be reported as green. [Machine-readable comparison](cli-type-audit.json).
