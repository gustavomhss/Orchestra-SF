# Independent source review of the other shared unions

Reviewed the following files at operations product `de6959db82dbe48bd59e3d012ff668a86347a6cd`, tree `e7c36171c132009e34d4f870e5d300bab4a1c82a`. Remote GitHub blobs match the local source reviewed. This is independent review of root-authored reconciliation; it does not review or accept the three host files authored by this reviewer.

| File | Published blob | Result of source review |
| --- | --- | --- |
| `product/integration/product-authority.ts` | `6e6338ca557304774051864b47900640e216c031` | Retains WP04 procurement evidence write capability and prepared receipt target callback, while keeping WP06 captured snapshot reuse. Receipt target resolution still requires the namespace grant and writable actor; native binding and identity checks remain. No lost branch delta identified. |
| `product/host-binding/business-context.ts` | `6f37ca1d108639731ff678c681608dbaa1ec4797` | Retains WP04 Procurement evidence routing and continuity hook, including physical-source proof after the broader scoped historical source match. Every historical result still requires `host.proveContinuity` and revalidation. Retains WP06 Planner evidence reader and Atlas task-entry discrimination. No lost branch delta identified. |
| `product/interface/http.ts` | `e79a5aa7b601cd6e0ab50c62033c72ec89362ab7` | Equals WP04 behavior with WP06 mount forwarded to analysis HTTP. Sourcing-input route, source-based sourcing/forecast form selection and history scripts coexist with analysis inputs. Origin/path/query and UI revalidation controls remain. |
| `runtime/application.ts` | `b8b03573d4e21e330b60ad308f4300702f43cbdd` | Equals WP04 queue projection preparation/fence/finalization with WP06 import/document/dossier navigation links. Authentication remains inside the page transaction; projection is checked against that snapshot and actor; `finish()` remains in `finally`. |

Paths in the table are relative to `modules/sucafina/Sucafinav1/`. Exact diffs against both input branches are in `cold-review-{04,06}-*.diff`. No product was executed locally. The focused hosted validation remains required; source review is not a substitute for it.

## First hosted check

- Product W: `de6959db82dbe48bd59e3d012ff668a86347a6cd`, tree `e7c36171c132009e34d4f870e5d300bab4a1c82a`.
- W parents: WP04 delivery `91e1f60bc6f7e85517e2b4f963eec5ac7da13e62` and WP06 W20 `e7fd8ff797441681f360e7775155a8cc2830280c`.
- Check snapshot S: `a04e0ab099a568b25fe2385da0d50772f8278df0`, tree `0de3e8518c7f859978cddbb26a7e31b3d58b5151`; sole parent W; diff exactly one added `.astra-operations-check.json`. Every product blob is unchanged.
- Envelope guard base: `a1d37698a7bb097c1578f827eba6a19b9917ef07`; recorded merge base `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`.
- Run [43578238861](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43578238861), job `132397139678`, completed **failure** at `2026-11-14T08:59:27Z`.
- Envelope, exact product checkout, setup, CLI `bun typecheck` and guards all succeeded. Guards: 78 rules, 712 changed paths, 0 gate findings, 11 warnings, 0 errors.
- Sucafina `bun typecheck` has exactly one compiler diagnostic: TS2741 at `test/product/wp14/source-access-atlas.test.ts(167,41)`, missing required `procurementEvidenceWrites` in a call to `createSfBusinessServices`. This is the remaining fixture call identified before publication, not a product type error. Root was informed immediately.
- Artifact `14107352748`, `astra-operations-check-1`, 1579 bytes, SHA256 `9660acb92cc9c28c8ad4d2cee6386d4d3df201258e6e0b423c6797396b5b5efd`; downloaded bytes match the digest. `revisions.txt` independently confirms W, W tree and origin/dev. Archive and extracted logs are retained beside this report.

After a test-only fixture correction, the Sucafina typecheck and affected test must be rerun. The CLI result can be retained if its inputs/closure are unchanged. Preserve this failed attempt and its diagnostic in the evidence lineage; do not label the whole run successful.
