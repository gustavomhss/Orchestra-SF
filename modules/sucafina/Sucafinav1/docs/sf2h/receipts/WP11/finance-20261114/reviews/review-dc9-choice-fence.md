# Independent intake review: PR40 final current-choice fence

## Verdict

Static review supports exact intake of `current-choice-preview.ts` and the new `current-choice-read-fence.test.ts`, plus an additive lifecycle assertion. Affected GitHub Actions validation remains required. This report does not extend W31/S19 acceptance to the new product code.

Source: `dc9d4327d07db58d026e7672cf619717394f5ffd`, delta after `d7775d6f1eb17af1590ccfb98547259eb017cd1b`. Finance basis: `c449efc092e507fca2b4f61d1e7ce057faf05c89`.

| Path | Finance blob | Intake blob / disposition |
| --- | --- | --- |
| `product/decisions/current-choice-preview.ts` | `12f9bda4f964763e8c6d60fb67e5fb68a08cd9ee` | Exact source `38f82f4b931682e255a18d52856e192f2ee43390` |
| `test/product/wp11/current-choice-read-fence.test.ts` | Absent | Exact source `46b004a1b374229ad46077930134ba0469213087` |
| `test/product/wp11/current-choice-lifecycle.test.ts` | `7a5100d9e60a81f654cc31714efd2b1e7d0b68f5` | Proposed additive `d220c42a28e87b034ca3513aca088a0dd0db262b`; source `45d2821fbd01c13183d450f1347e9017adba9fe2` not copied wholesale |

## Why the product change matters

The W31 reader captured its second case/result observation before the final external `authorizeCase` call. A callback could validly authorize that supplied snapshot and then remove membership or preferences read access while the general UI lease stayed valid. The caller would subsequently release the older binding. The source change moves that callback and lease revalidation before the private preferences reauthorization and the final joint observation. It compares the case, reviewed result, producer result and binding after those callbacks, and returns a detached copy of the final binding. Existing producer/source/provenance checks remain intact. It changes no producer formula, financial policy, Planner operation or shared host contract.

The real composition in `product/decisions/product.ts` uses this reader both directly and as the provenance check preceding current-choice promotion. `prepare` also verifies its just-persisted binding through the same reader.

## Tests and assertion preservation

The new test expands into two cases. Both establish that an authorized read still succeeds after write permission is removed. One commits membership removal in real SQLite state during the final case-authorization callback; the other revokes preferences read. Both require the callback race to occur, reject a returned binding, retain the original choice and empty prepared changes/receipts, and require zero calls to calculate, prepare, promote or dispatch. The pending result uses unknown financial values and explicitly states its seeded reader-only purpose. It is a focused authorization test, not a substitute for the existing canonical lifecycle.

Source lifecycle code also isolates the matcher and checks a combined digest of `coverage.assessment` and `coverage.entries`. Finance already has the detached observation, an assessment digest assertion, and S19-confirmed diagnostics of Bun's mutation of the detached object. Preserve those diagnostics and assertions, adding the combined digest check. The scratch proposal adds two lines, increasing `expect` call sites from 41 to 42; the existing `180000` millisecond deadline remains unchanged.

Run exactly `Sucafinav1/test/product/wp11/current-choice-read-fence.test.ts` and `Sucafinav1/test/product/wp11/current-choice-lifecycle.test.ts` for this boundary, combined with any independently required renewal intake scope selected by the root. Product tests must use the published Finance W and `.ci-run.json` child S through the existing CI protocol. No local product tests were run by this reviewer.

## Review limits

This is a static source and dependency review. It does not qualify the new code before CI, prove native or installed UI execution, establish C/D acceptance, or extend the seeded reader fixture into a human-choice application claim. C08 still supplies the canonical state read and authorization guarantees. No owned product or test file was changed by this reviewer; only scratch review/proposal files were written.
