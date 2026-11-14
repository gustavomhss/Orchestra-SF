# Mission37 — independent assembly boundary review

Status: static review only. No product, test, server, typecheck, guard, or workflow was executed by this reviewer. GitHub Actions is the only permitted runtime verification venue. The source implementation and the assembly postimages remain separate until the authorized integrator applies the owner patches.

Product authority inspected: `e7e97591edfc15f230856a035e32951f2f700c2f` (sf2-stack after C11). Parent reconciliation reports current authority `c5ab23fd7c9b231917bf70123958c9ff03e7d420` with documentation-only successors and unchanged product preimages. Original handoff target session33 has closed; session42 is the sole assembly integrator and S0 is the proof executor through the existing dispatcher. Session42 has no test, typecheck or CI execution authority. The original C9 patch variant is retained for its exact preimage only; it is not interchangeable with the current variant.

## Findings and disposition

1. **Implicit persistence in the native scenario descriptor.** The original `sf_scenario_simulate` handler persisted every successful scenario. Calling the real Procurement producer through this descriptor would therefore violate the preview contract despite a read-only calculator. Assembly entry10 now accepts a host-owned `readOnlyScenario` predicate. It clones the decoded request before the first await, obtains the normal admission receipt, determines the disposition before invoking the calculator, and returns the result plus a bound receipt without calling persistence or returning an `outputRef`. Entry04 supplies only the real Procurement producer's `supports` predicate and defensively refuses those scenario writes through the exposed calculation persistence wrapper. Explicit alternative promotion remains the C08 write path.

2. **Numeric criterion controls exposed evidence that the write fence rejected.** Entry09 exposes Procurement evidence from actual saved alternatives, but the former `decision-domain-services.ts` fence accepted only Planner records. Assembly entry11 captures a bounded, private proof for the actual human registration call: original request, transport, authority binding, full case digest, exact current Procurement refs belonging to saved alternatives, and all physical source fences. At the registry's write boundary it retains the existing Planner actor and human intent checks, uses the locked Procurement snapshot to verify each current source, checks the locked dashboard case and full source fences, and still sends any Planner refs through the original Planner guard. Procurement sensitivity is explicitly unavailable; numeric comparison rules are allowed only with the existing shared comparison producer, exact case currency/horizon, and canonical known-subtotal metric.

3. **Registry lifecycle matches the new proof lifetime.** In the real registry, `verifySnapshot` is called only from the registration work callback. The command uses `domainSurface: "planner"`, and the state provider performs a cross-surface transaction that passes the locked Planner snapshot to that callback. The actual C08 case is at `locked.dashboard.data.__sfProductV1.cases`. Subsequent `resolve` and `evaluate` use persisted rule integrity, current case authorization and `verifyEvidence`; they do not depend on the per-registration WeakMap. Deleting the private proof after registration is therefore compatible with replay and reopen.

4. **The shared comparison path can consume Procurement.** The real shared portfolio registry obtains the metric by reopening both stored scenarios through the canonical comparator and returns conditioned/null output faithfully. The Planner-only comparison cache declines unsupported Procurement evidence and invokes the complete producer; it does not deny the canonical path. The unchanged standalone fallback remains Planner-only. The assembled host must retain the existing shared-portfolio composition required by entry11.

## Exact runtime criteria for S0 after session42 assembly

These are requirements for focused consumer tests after assembly, not claims of completed runs. S0 must use the existing dispatcher and deduplicate by consumer SHA plus selector. Do not run a full/epic suite, add skips, or increase budgets. Existing typecheck and guards remain mandatory for the mounted head and must be executed by the authorized proof executor.

### Consumer boundary A: the real `sf_scenario_simulate` descriptor

Use real SQLite/lifecycle initialization and actual product authority. Issue the source through the legitimate source API before the preview. Admit the real native operation for a current case, and invoke the mounted descriptor rather than a parallel test-only handler.

- A valid baseline and typed replacement must return the exact source/proposed monetary amount, pending C10 categories, null total, and a receipt bound to the actual input/result digests and call. The response has no `outputRef`.
- Snapshot all physical surfaces plus C08 before and after; count actual committed transactions, including transactionAll. Repeating either preview must leave domain rows, audit/history, C08 results/transactions/versions/receipts and source identities byte-identical, with zero preview commits. A persistence callback spy is supplementary evidence; it cannot replace the real storage comparison.
- A mutated caller-owned payload after invocation cannot change the classified request or calculated amount. Missing source cost, wrong principal, stale source/version, replaced incarnation and changed target are refused with the same no-write proof.
- A subsequent explicit `decision-promote` with the existing human intent must create exactly one alternative and one immutable stored scenario through the canonical C08 mutation. Replaying the exact operation must return the same result without another effect. Changed content with the same operation identity must conflict. This explicit promotion is distinct from the preview.
- Keep the existing Planner scenario descriptor regression: non-Procurement requests still use their existing persistence path. The optional disposition callback must not classify unrelated requests as Procurement.

### Consumer boundary B: the real numeric criterion POST and registry

Use a case with legitimately promoted Procurement baseline and replacement alternatives, issued current source evidence, the existing human criterion intent, and the actual mounted `decision-criteria` route. Preserve all grants, roles and policy.

- Controls must offer the exact saved Procurement ref. Register a numeric rule over that offered evidence with the current case version, exact currency/horizon and the canonical known-subtotal-difference metric. Assert one persisted rule history/head and one idempotent transaction. Repeating the same operation must not create another rule revision.
- End that invocation, re-admit a new request, reopen SQLite and resolve/evaluate the persisted rule. It must work without the former private WeakMap proof. With all nine cost categories pending, the real comparison remains conditioned and evaluation remains unknown; it must not claim a complete or financially approved alternative.
- Reject a current Procurement ref that is not in that case's saved alternatives, altered evidence/fields/period/projection, a different case incarnation/version, another principal, missing human intent, sensitivity over Procurement, and a rule whose unit/horizon differs from the case. Assert zero criterion writes for each negative.
- Mutate a real source, the target/case or authority between capture and the registry's locked write callback. The registration must fail and preserve preferences/history/idempotency state. Count only the deliberately introduced external mutation; the failed registration must add no commit. A delete/recreate/restore ABA must remain stale because the scope incarnation changes.
- Retain a Planner-only numeric criterion positive and negative using the original Planner fence; mixed evidence must validate both surfaces, never replace their granular checks with a broad digest.

### Shared retained invariants

Do not reinterpret these assembly criteria as a successful financial Apply. Numeric Procurement preparation remains blocked by `financial-approval-command-unavailable`; the existing policy still requires pending-stage formal approval while Requests/save is limited to draft/pr_rejected. Exact amount/version approval is proved separately through the real command path. Old/different amount approval cannot authorize the proposed amount. Metadata-only C12 regressions continue proving one effect/receipt, CAS, idempotency and recovery; no C12 implementation or policy is replaced.

## Sources read at the current consumer authority

| File | Git blob SHA |
| --- | --- |
| `product/decisions/criterion-rules.ts` | `c357c6c66aac544394ab355306e1f6f7195395f7` |
| `product/host-binding/state-provider.ts` | `71ce2ba1b04d3c7f63f7c444ca23dd084a8e2b0c` |
| `product/integration/product-authority.ts` | `2c82d60d220d8d5365da8322bad648a64bbb62d2` |
| `product/decisions/host-evidence.ts` | `da41f148e5b3592d700cdfb81d72ea23d8774500` |
| `product/decisions/baseline-fence.ts` | `06e8b9938ce6a09b54556aacce5894c528cd5935` |
| `product/planner/scenario-comparison-port.ts` | `1782c2094239c3712d3a895a6a25f4160fb429c7` |
| `apps/cli/src/sucafina-product/decision-domain-services.ts` (preimage) | `149cc8fb12dd54b6622842cfa4e0c1a2e2bf4f93` |
| `apps/cli/src/sucafina-product/portfolio-authority.ts` | `138238ca9273e84f39f8e1db484378a3e62d41d4` |
| `apps/cli/src/sucafina-product/portfolio-services.ts` | `881ce4672d9d0e641d1cc849663c0980c118774d` |
| `apps/cli/src/sucafina-product/portfolio-comparison-scope.ts` | `7d43f60fdb1a6400cdec1b89c1717e6a2b8a2f11` |

Product-relative rows are under `modules/sucafina/Sucafinav1/`. Sources were fetched through GitHub MCP by the exact consumer commit. Final patch hashes and strict preimage-to-postimage reconstruction are recorded separately in `INTEGRITY_REVIEW.json` after the owner freezes both manifests.
