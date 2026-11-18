# F04 naming collision — separate owner187 review, not a cleanup patch

Source: `690a34cdd81c12d7311f3717c19679b950276161` and branch188 `913b6b8f143e6c3e869eee293d02f04259c7cdd1`: `packages/app-shell/e2e/sucafina/native/fixture/scratch.ts` blob `75181ca2d425dd71b9fb032773be16e48883c775` (source body unchanged).

Consumer: `packages/app-shell/e2e/sucafina/native/fixture.ts` blob `d699d74f092a8211fde2611c827ed4ebd83a9274`, currently `export { createNativeScratch } from "./fixture/scratch.ts"`.

The guard rule `agent-scratch` blob `71ce321c30465faaf957a08256bd6b7d007d4173` catches `**/scratch.*` by path, with no syntax analysis. Its match cannot distinguish an actual F04 installation helper from garbage; the source demonstrably invokes runtime setup functions and returns a cleanup handle.

**Recommended owner187 design proposal (NOT APPLIED):** rename `fixture/scratch.ts` to `fixture/isolated-installation.ts` keeping its exact code and exported name, then change the known barrel export to `"./fixture/isolated-installation.ts"`. Inspect direct imports beyond the known export before writing. Preserve the real installation, auth, isolation and teardown behavior; avoid altering guard patterns/ignores or synthetic auth. This may eliminate the basename gate on a newly qualified candidate, but it does not prove readiness and is not itself a guard run.

Owner187 controls the F04 source; integrator189 or explicit successor performs consumer reconciliation, compiler190 rechecks causally changed gates, product CI191 owns real installed tests. No patch outside `closure188/**` was made by188.
