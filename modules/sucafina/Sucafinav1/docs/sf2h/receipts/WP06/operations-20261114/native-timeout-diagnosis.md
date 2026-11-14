# WP06 native import analysis: W1 failure diagnosis

The scoped W1 run is **failed**. This record does not classify the failure as a flake and does not replace it with the older green result.

| Receipt | Product | Snapshot | Run / job | Observation |
| --- | --- | --- | --- | --- |
| U20 control | `e7fd8ff797441681f360e7775155a8cc2830280c` | `2fa1f2cf08fd575e162c252c87a07e9aed104822` | `43557187051` / `132332582167` | Same long case passed in 234691.80 ms. Six cases in three files passed. |
| Operations W1 | `de6959db82dbe48bd59e3d012ff668a86347a6cd` | `acd7f87c28c70a68bd75ab65bac6c05477f470fe` | `43578845234` / `132399004959` | 100 cases passed, one failed, zero skipped, 43 files. Long case interrupted at 300101.81 ms. |

The failed case is `recorded forecast and intent Sessions preserve selected C04 importPreviewRef through rendered preview links and fail after source or authority change`, in `modules/sucafina/Sucafinav1/test/product/wp06/native/import-analysis.test.ts`.

## Evidence and mechanism

The two logs have the same ordered checkpoint sequence through event 514. There are 256 matched completed stages before the first difference: the U20 `call:dispatch` ends, while W1's same stage reports failure at the cooperative fixture deadline. The fixture budget is 300000 ms; its Bun case deadline is 360000 ms. W1's final dispatch started at total 290576 ms and was interrupted 9459 ms later. U20's same dispatch took 17104 ms. The final dispatch is therefore not evidence of a localized deadlock: it had less remaining time than the measured successful control took.

| Matching stage | U20 ms | W1 ms | W1 / U20 |
| --- | ---: | ---: | ---: |
| forecast prepare | 7429 | 11237 | 1.513 |
| forecast verify | 7553 | 11313 | 1.498 |
| first run publication | 38733 | 58028 | 1.498 |
| intent prepare | 6629 | 10057 | 1.517 |
| second run publication | 38133 | 55958 | 1.467 |
| final HTTP preview before native calls | 6368 | 9649 | 1.515 |

Completed control cases in the same two runs also took longer in W1: ordinary import HTTP 1.284×; first native parity case 1.410×; Dashboard Members 1.391×, Projects 1.498× and Operations 1.492×. Both runs report Ubuntu image `20261111.370.1` and Bun `1.3.14 (0d9b296a)`.

This establishes accumulated elapsed time and broad slowdown, not the cause of that slowdown. Runner speed, process history and shared-composition costs remain possible explanations; the logs do not separate them. No functional assertion failed before cancellation. This is not proof that the full case would pass on W1: its final native/MCP active previews and logout assertions were not completed.

## Source review

The test file is identical to U20. The owned native fixture changes introduce one `WeakSet<object>` provenance capability and pass that same identity to the authority and business services. The reused storage fixture adds the corresponding optional argument. Neither change changes the time budget, drops assertions, bypasses authorization, caches a grant or substitutes a producer. The import/document services and HTTP implementations retain the W20 bytes. `source-lifecycle.ts` remains blob `65867a3e6aa9b5b85266bb637fb22cf1c6c6d539`.

The new shared state-provider branch fences writes to `sf:procurement-evidence:*`; this case does not write that namespace. The additional prepared-target authority callback is absent in this fixture. The new Procurement dossier, queue and sourcing bindings are constructed but this case operates on Planner imports, forecast and intent. The generated output schemas were compared as complete reachable `$ref` graphs: the import/document operation shapes remain equivalent; changed generator numbering does not establish a validation regression. These reviews identify no owned functional defect that can responsibly be repaired by altering the test.

## Next discriminating validation

Run only the existing `native/import-analysis.test.ts` file in a fresh GitHub Actions process at the next composed product pin, with **the same 300000/360000 ms limits and every assertion intact**. This is a targeted follow-up to the concrete failed case and the changed composition. Keep the 100 completed W1 observations as observations of W1 and apply the composition impact ledger before reusing them. Do not rerun all 43 files solely because this case exhausted its budget.

The test still uses actual Session/Agent stores, installed skill receipts, the production event publisher and private MCP with recorded ingress. A later pass would establish that scoped mechanism; it would not qualify an external model provider, installed scanner, GNATIVE or global acceptance.

## Local evidence files

- `audit-ci/wp06-U20-43557187051.log`: exact retrieved U20 job log.
- `audit-ci/operations-bun43-43578845234.log`: exact retrieved W1 job log.
- `audit-wp06/native-U20-W1-comparison.json`: ordered stage alignment and completed controls.
- `audit-wp06/native-failure-stages.json`: failing fixture's 518 logged events.

This analysis reads existing source and GitHub Actions receipts only. No product tests or typechecks were executed locally.
