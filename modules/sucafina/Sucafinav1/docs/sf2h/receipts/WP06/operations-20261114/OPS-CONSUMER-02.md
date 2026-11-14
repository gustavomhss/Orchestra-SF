# OPS-CONSUMER-02 — proposed consumer patch, not applied

Owner routing: astra-compose / the WP14 test consumer owner, via PR #32. This patch is scoped to the missing composition argument in the existing WP06 Documents → BusinessContext → Atlas proof. No repository test file was edited and no CI was dispatched by this reviewer.

## Exact base and change

- Base product: `de6959db82dbe48bd59e3d012ff668a86347a6cd` (operations PR #34).
- Base tree: `e7c36171c132009e34d4f870e5d300bab4a1c82a`.
- File: `modules/sucafina/Sucafinav1/test/product/wp14/source-access-atlas.test.ts`.
- Before blob: `fbe627ffde443ff7e2d3b1204bbcf67523404f41`.
- Proposed after blob: `d7d2a69837560f42438d470b83724c1a61939a73`.
- Patch: `OPS-CONSUMER-02.patch` (two hunks, one declaration and two argument additions).

Declare one `procurementEvidenceWrites = new WeakSet<object>()` in the existing document/Atlas scenario. Pass that exact instance to its `createSfProductAuthority` and `createSfBusinessServices` calls. The published business service contract remains required. Existing grants, policy, assertions, test scenarios, scanner, replay and revocation checks are unchanged.

The mismatch was observed in Actions run [43578238861](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43578238861), job `132397139678`: the sole Sucafina compiler diagnostic was TS2741 at the business-services call. CLI typecheck and guards passed independently. Preserve that failed attempt in the lineage.

## Existing owner heads checked before proposing the patch

| Owner source | Checked blob | Finding |
| --- | --- | --- |
| astra-compose `ff7a99753d1fd1bc8b68b4f2642fed26e3cadbdf` | `3f2b5f6fac83233cd97b200450a402897e110ece` | Contains the earlier Atlas continuity test; no `createSfBusinessServices` consumer or confirmed C17 document scenario. No corresponding fix exists here. |
| Intelligence product `2fb7e9c792327725384d99d656cc44b232ddc485`, snapshot `290ca0553d97e9e25991611f5dc002d2900e1dcb` | `d31c8dc6867bcbb7f389bde79df644a5133de51a` | Also omits the WP06 document/BusinessContext/Atlas consumer. Its in-flight run does not exercise the failing scenario. |

The intelligence run is [43578709182](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43578709182), job `132398584340`, with 12 WP14 files plus `--timeout 120000`. It was in progress at inspection. Its source contains no compatible patch to consume for this error. Replacing the operations file wholesale with either owner blob would delete the WP06 consumer proof, so that is not a valid fix.

Owner action: consume the operations test containing both existing scenarios, reconcile any independently owned WP14 deltas, then apply these two minimal hunks. The proposed after hash applies only when the before blob matches exactly; if the owner reconciles other content, publish the resulting new blob and pin its evidence separately.

## Required hosted evidence after owner consumption

1. Sucafina `bun typecheck` for the exact resulting candidate must remove TS2741. Record product SHA/tree and snapshot relation.
2. Run the existing `Sucafinav1/test/product/wp14/source-access-atlas.test.ts` selection with both cases, via CI.md/GitHub MCP. `proof-request.json` is the normalized single-file request; it is not a dispatch.
3. The existing Omni declaring test requires its positive control verdict. Preserve scanner/version, actual pass counts and revocation outcomes; a skipped case or absent verdict is not proof.
4. Run guards according to AGENTS on the resulting candidate. Reuse the successful CLI typecheck from `43578238861` only if its dependency closure is unchanged.

The change is confined to a test fixture; it does not invalidate other independent operations selections run on the unchanged product code. It also does not turn the previous failed overall check green, qualify GNATIVE, or provide S0 global acceptance.
