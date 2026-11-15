# FINDING118 — WP00 journey metadata absent in frozen oracle

- **Severity:** observed contract conflict; source owner decision required, **not** a TypeScript waiver.
- **Test:** `modules/sucafina/Sucafinav1/test/product/wp00/baseline-corpus-coverage.test.ts`, journey metadata assertion (original ~L60).
- **Oracle:** `modules/sucafina/Sucafinav1/docs/product-campaign/wp00/oracles/journeys-j01-j08.json` at the C53 baseline (`180212940105e7b9ad15171b067c1c1b7841df5f`).
- **Observed:** all eight J01–J08 entries expose `id`, `title`, `actors`, `given`, `when`, `then`; neither `fixtureBindings` nor `executionStatus` exists on the actual rows.
- **Required by existing test:** each journey must include nonempty `fixtureBindings` and `executionStatus === "NOT_RUN"`.
- **Repair in mission 118:** runtime property guards `"fixtureBindings" in journey && Array.isArray(journey.fixtureBindings)` and `"executionStatus" in journey` eliminate TS2339 but do **not** invent fixture bindings, fake an execution status, or change the assertion. The test is expected to report failing until the actual authoritative oracle data has the required metadata, **unless the frozen contract owner explicitly revises the test/data contract**.
- **Action for integrator 114:** route finding to WP00 oracle/data authority; do not weaken, suppress, or change the expected predicate. Preserve immutable fixed-plan and oracle constraints.
- **Status:** reproducibility from static source comparison; GitHub Actions 120 has not executed this branch yet.
