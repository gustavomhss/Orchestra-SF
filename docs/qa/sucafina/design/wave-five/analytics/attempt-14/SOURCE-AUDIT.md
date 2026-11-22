# Planner source resolver audit after Portfolio17

This is a read-only audit of product `6acd67a926c664c696df3ae1c0791599ef58e811`, informed by [Attempt14](README.md). No runtime file, authority rule, lease or test budget was changed by this audit. Root and the separate source-fence audit control any subsequent implementation.

## Finding

The original prepared reader is preserved. The installed ownership chain loses a narrower readonly ACL capability at a private object-identity boundary.

| Boundary | Original behavior retained |
| --- | --- |
| CLI business services → Planner product | Uses product.sources; source persistence is passed without dropping readScopedSourcePrepared. |
| Planner product → source host | Original source selectors go through createSfPlannerSourceHost; standalone procurement selectors retain their own route. |
| Source host resolution | Validates the canonical selector, revalidates authority, performs two original read observations and compares their complete projection/identity. |
| Prepared read | Prepares the selector from an isolated snapshot, runs the registered original authorizer twice, projects the original source and resolves its physical/scoped identity. |
| Final resolution | Retains live context revalidation, exact evidence identity and original materialization/refusal behavior. |

In source-lifecycle.ts, readScopedSourcePrepared asks `currentLocalReadonlyAuthorityData(input.persistence, ["planner"])`. The installed local entry supplies `currentChoiceFence.persistence`. LocalStore's private WeakMap registers only its original store object, and the lookup is by that exact object. The wrapper therefore does not acquire the original Planner ACL optimization through this call.

Without plannerAcl, observe retains its generic complete-snapshot path: a full snapshot digest before callbacks, original callback execution against the snapshot, and a second digest afterward. The original prepared callback still receives its own complete clone. No batch or prepared method was found missing in the Planner composition itself.

## Evidence boundaries

The two source phases recorded 17,336 calls and 64,624ms inclusive; 16,084 calls / 49,852ms were within recorded physical invocations. The profile did not separately time the internal copies, hashes, authorization callbacks or metadata traversal. Their full measured duration must not be attributed to a single internal operation.

The existing injected observeAuthority is not an interchangeable readonly proof: LocalStore admits both real readonly roots and a writer's held preimage through that API. The generic private readonly reader explicitly requires a real readOnly root and its original store methods. A future bridge must preserve this distinction.

CurrentChoice provenance must remain factory-owned, with no externally supplied authority callback, shape-only token or result cache. A matching bytesIdentity does not establish the same physical or lexical root. The metadata scope identity and observation identity are also different tokens; neither should be compared to the other as if they were one.

For Planner, retain provider and transaction-method pins after the prepare await and both original authorization awaits. The original owned.current callback completes this protection through LocalStore's sameStore test. Replacing it with a weaker wrapper check would lose that guarantee.

Every selector, authorization, source projection, physical/scoped lookup and fresh egress must still execute. The audit proposes no cache of sources, results or grants and no fallback/replay after a changed admitted owner.

## Exact inspected sources

| File | Blob |
| --- | --- |
| [apps/cli/src/sucafina-product/planner-evidence.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/apps/cli/src/sucafina-product/planner-evidence.ts) | `13153182e357b716a12d2554654905d54fa30ee4` |
| [apps/cli/src/sucafina-product/business-services.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/apps/cli/src/sucafina-product/business-services.ts) | `6dc58b4b9106961ee0044620cd4ee42ac4b0a0f6` |
| [modules/sucafina/Sucafinav1/product/planner/product.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/modules/sucafina/Sucafinav1/product/planner/product.ts) | `6f5e6c9aaa5687f76b113e232f03fb433fc0c0aa` |
| [modules/sucafina/Sucafinav1/product/integration/planner-sources.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/modules/sucafina/Sucafinav1/product/integration/planner-sources.ts) | `b8f7b22413a9c6ae912b97e546186a7441794d52` |
| [modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts) | `ac2d7219d3dbeae866d8c81220a841acfde59214` |
| [modules/sucafina/Sucafinav1/product/integration/source-projections.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/modules/sucafina/Sucafinav1/product/integration/source-projections.ts) | `eb2ac067e45f5917e782d9a36267a64ae9998896` |
| [modules/sucafina/Sucafinav1/runtime/local-store.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/modules/sucafina/Sucafinav1/runtime/local-store.ts) | `49264cc74348c29554cc4f89f5a7ba9662c08cb3` |
| [modules/sucafina/Sucafinav1/local/entry.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/modules/sucafina/Sucafinav1/local/entry.ts) | `abfbaac4a88a9b6dc7501cad8fb475e447295bdc` |

The separate source-fence audit covers the first measured 52,077ms read and its unmeasured final counterpart. This audit covers Planner's source1/source2 path and its private readonly boundary.
