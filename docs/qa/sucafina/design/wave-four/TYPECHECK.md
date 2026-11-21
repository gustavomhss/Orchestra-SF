# E2E typecheck boundary

The existing `typecheck:e2e` command runs `tsgo -p e2e/tsconfig.json` and has `noEmit: true`. Its inherited app configuration enabled `composite` and `emitDeclarationOnly`, which also requested declaration-serialization diagnostics even though this test command produces no declaration artifact.

Canonical Procurement fixtures introduced transitive source contracts and generated JSON schemas. Runs [44955486808](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44955486808) and [44955972653](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44955972653) identified the imported file closure and an accidental internal UI-model import in the Decisions journey. The closure was listed explicitly, and the journey now uses the producer contract and references read from the actual admitted native route.

Run [44956295629](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44956295629) then reported only TS7056 at the three generated output-schema maps: their inferred declaration representations exceeded the compiler's serialization limit. No source schema, generator, runtime value or public contract has been widened or changed.

The E2E project now explicitly sets `composite: false`, `declaration: false` and `emitDeclarationOnly: false`, retaining `noEmit: true`, strict checking and every existing explicit include. The same command still performs semantic checking of all imported fixtures, producers and consumers. It no longer checks whether the test project could emit a composite declaration artifact, or enforces composite's explicit-file-list diagnostic TS6307.

The application configuration and its separate `tsgo -b` gate remain unchanged, including declaration verification. No workflow, guard, approval or allowlist was changed; no diagnostic suppression or broad type cast was added. The next hosted gate must verify the resulting candidate; this rationale is not a passing test result.
