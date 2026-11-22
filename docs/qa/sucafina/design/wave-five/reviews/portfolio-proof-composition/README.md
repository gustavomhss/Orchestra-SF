# Portfolio preview: comparison and proof composition audit

## Scope and evidence status

Audited runtime: **6acd67a926c664c696df3ae1c0791599ef58e811**. This is a read-only source audit by design_reviews. No runtime file was changed and no test or CI run was launched for this report. The later root checkpoint bacd7c48e7b00844dd6683f25938f5f06b6783dc was reported as documentation-only with the same runtime.

The call counts below are a conditional static model. They are not a successful installed preview, a timing estimate, an authorization to remove a check, or proof that the UI completes within its 60-second expectation. Diagnostic16 counts were reported and cross-checked by analytics/root; its logs were not independently decoded again in this audit.

Diagnostic16: [run 44998750010](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44998750010). Its installed source preceded the optional metric-batch forwarding now present in the audited runtime. That difference preserves the public comparison phases but prevents treating its physical-read or elapsed-time measurements as measurements of this audited runtime.

The exact source inventory at the end provides complete paths, immutable links and blob SHAs. Line references in this report refer to that commit.

## Findings

1. The source chain contains no unbounded criterion recursion. The inner comparison used to read a metric has an empty criteria list.
2. The selection comparison scope is already carried through the CLI adapter. Its cache deliberately declines nonempty criteria and unsupported source dependencies.
3. Binding reads repeat live comparisons and rule evaluations by design. Their first/second observations, write boundaries and final authority checks are distinct.
4. Two sibling-reading sites in planner/persistence.ts still use scalar readers despite available original batch capabilities. One is compatible with the existing historical helper's parallel-joint fallback; the other is not a blind substitution because its original scalar scheduling differs.
5. The diagnostic prefix fits the static call sequence. This correspondence suggests a location; it does not replace a measured binding span or establish a latency cause.

## Original preview chain

product/portfolio/product.ts:95 authorizes the case and calls contribution.preview. contribution.ts:32–35 invokes port.evaluateWithSelections. The port resolves candidates and evaluates a bounded sequence of combinations. For each assessed combination, production.ts:80–98 calls analysis.evaluate.

analysis.ts:44–87 performs these steps:

1. Resolve the original human selection.
2. Read the historical alternative and current rule proofs.
3. Run the Planner comparison.
4. Look up the C08 by its request; persist and bind it if absent.
5. Read the current binding; use the bind recovery path only when that read is non-ok.
6. Perform a separate mandatory binding read.
7. Resolve the human selection again and require complete equality.
8. Run the analysis's own revalidation.

After assessment, port.ts:97–104 invokes revalidateEvaluation. production.ts:100–109 delegates to analysis.revalidate again after its source, coverage and stored-result checks.

The preview does not persist a portfolio result through contribution.persistent, but its original analysis may write a new C08 and its comparison binding. Therefore the entire preview, analysis.evaluate or Planner persistence function cannot be enclosed in one read-only root. The original C08 write and preferences transaction must remain outside any read-only phase.

## What a binding read proves

decisions/criterion-comparison.ts:44–58 reads preferences, validates the binding, reads preferences again, validates again, compares both observations, and revalidates the original host and request.

Each validate pass at :35–42:

- Reads the stored comparison and resolves the current rule proofs.
- Calls the composed verifyBinding callback.
- Evaluates every criterion again.
- Compares the evaluated criterion identity, state and reason against the stored comparison.

The CLI callback in portfolio-authority.ts:138–140 first verifies current evidence and then calls verifyComparison. portfolio/verification.ts:99–105 reads the original source fences, invokes planner.compareScenarios, requires the complete result digest to equal the stored digest, and captures the current fence only after another live source/authority boundary.

The captured fence used by verifySnapshot (:277–280) is a short-lived proof for the original snapshot/write check. It is not an API for skipping a later read, comparison, rule evaluation or authorization.

## Conditional metric-count model

The following model applies to one existing required criterion whose metric is consistently conditioned, whose rules and sources remain valid, and whose comparisons are neither incompatible nor unavailable.

decisions/criterion-rules.ts:108–130 reads one metric, then the conditioned state short-circuits before verifyMetric and metricAgain. The outcome is unknown. A confirmed metric takes a different branch and is outside this count model.

The original comparator in planner/scenario-comparison-port.ts:50–67 evaluates criteria twice. Therefore, under this model:

- One external Planner comparison = two metric reads.
- One binding validate = one external comparison plus one direct rule evaluation = three metric reads.
- One complete binding read = two binding validates = two external comparisons and six metric reads.

portfolio-authority.ts:59–83 invokes the inner readMetric comparison with criteria: []. It does not recursively evaluate the same rule. The original optional batch now forwarded by that facade preserves the two fresh scenario phases; it does not remove a metric or return a saved comparison.

### Diagnostic16 prefix: static correspondence

Analytics confirmed that scenarios.direct=15 already includes the four compare.canonical calls. Of 35 metrics, 28 are inside scenarios.direct and seven are outside; eight metrics are inside the four canonical comparisons. These sets overlap and must not be added as independent branches.

| Completed phase | Added external comparisons | Added metrics | Cumulative comparisons / metrics |
|---|---:|---:|---:|
| Initial selection resolver: two selection.read calls, each with two canonical comparisons | 4 | 8 | 4 / 8 |
| Direct analysis comparison | 1 | 2 | 5 / 10 |
| New C08 persistence and canonical binding | 7 | 19 | 12 / 29 |
| previousBinding.read | 2 | 6 | 14 / 35 |
| Start of the independent binding read | Starts comparison 15 | Depends on progress within that comparison | — |

The C08 persistence contribution is seven external comparisons and nineteen metrics: pre-write validate (1/2), bind's pre-write validate (1/3), the read returned by bind (2/6), post-write validate (1/2), and the final binding.read (2/6). Sources: planner/persistence.ts:73–113 and decisions/criterion-comparison.ts:61–87.

The independent binding read begins at analysis.ts:79 and precedes selectAgain at :82. Thus a prefix of 15 external comparison starts, 35 metric invocations and only two selection.read calls is consistent with expiration inside that independent binding read before its next metric begins. **This location is inferred from counts, not established by a measured binding span.**

### Structural successful path for one combination

Assumptions: one assessed combination; one existing required conditioned criterion; new C08; canonical binding creation succeeds; no bind recovery path; every source, rule, authority and equality check succeeds.

| Phase | External comparisons | Metrics |
|---|---:|---:|
| Initial selection resolver | 4 | 8 |
| Direct analysis comparison | 1 | 2 |
| Canonical C08 persistence | 7 | 19 |
| Read the existing binding | 2 | 6 |
| Independent binding read | 2 | 6 |
| Resolve the selection again | 4 | 8 |
| Analysis's own revalidation | 5 | 14 |
| Port's final revalidateEvaluation | 5 | 14 |
| Total under these assumptions | **30** | **77** |

External comparisons here mean the wrapper counted as scenarios.direct. Eight canonical comparisons are included in those thirty. Each metric's inner criteria-free comparison is not another entry in this table's external-comparison column.

analysis.revalidate performs inspect → comparison replay → inspect. Each inspect includes a full binding.read, hence 2/6 + 1/2 + 2/6 = 5/14. The final port revalidation invokes that procedure again.

This table is not a count for an arbitrary whole request: the port may evaluate multiple combinations, and existing C08s, missing rules, confirmed metrics, recovery paths or early failures change the work. It is not a projection of elapsed time and does not demonstrate that any proposed reduction is sufficient to meet 60 seconds.

## Existing capabilities not used at particular call sites

### Historical scenario siblings in Planner persistence

planner/persistence.ts:64 uses Promise.all over readHistoricalScenario and clones the entire result array after the promises settle.

decisions/result-store.ts:30–66 already offers readHistoricalScenarios with a parallel-joint mode. For a recognized original reader it uses the original sibling batch. For opaque facades, parallel-joint retains concurrent calls, joint cloning, late mutation/alias observation up to that fence, and a reader-identity check. analysis.revalidate already uses that exact mode at analysis.ts:29.

This is a concrete candidate for capability forwarding, subject to original-source qualification and authorization to edit that producer. No substitution was made in this audit.

### Live scenario siblings in Planner persistence

planner/persistence.ts:74 uses Promise.all over scenarios.resolve in each of its two validate phases, then clones the joint array. The original host can expose resolveMany.

However, resolvePlannerScenarioBatch's absent-capability fallback at scenario-comparison-port.ts:82–84 is serial: it awaits and clones each scalar result before calling the next reader. The producer's current fallback is parallel and clones only after both settle. Replacing the call with that helper without preserving this difference would change opaque-reader callback ordering, concurrency, alias/mutation observations and potentially which failure is observed.

A future candidate would have to preserve the exact original Promise.all/joint-clone path when batching is absent, start a new original batch for each validate phase, retain cardinality and identity checks, and never fall back or replay after a batch has started. No such candidate or test was created here.

### Selection historical reads are intentionally fail-fast

portfolio/selection.ts:21–24 reads the alternative first, immediately returns its non-ok result, and only then reads the baseline. Batching those two reads would invoke the baseline reader even when the original path would not. This is not a drop-in opportunity.

## Comparison scope is already present and intentionally limited

portfolio-authority.ts:128–131 carries withComparisonScope and wraps selection.read, selection.inspect and selection.register in comparisons.run. portfolio-services.ts:100–105 passes the original results and scenarios objects to the product; it does not insert another facade that strips those optional capabilities.

portfolio-comparison-scope.ts:144 deliberately executes the full canonical comparator for nonempty criteria. Its plannerOnlyEvidence eligibility at :189–200 also rejects criteria, choices, ledger and other unsupported dependencies. The installed criterion-bearing case therefore cannot legitimately enter that cache merely by extending the lexical scope.

The current physical observation adapter separately wraps the original read-only canonical comparator and direct Planner comparison. portfolio-comparison-observation.ts:94–96 explicitly keeps selection, analysis, result persistence and binding writes outside that root. No broader eligibility, allowlist, result cache, source cache, grant cache or lease change is proposed.

The comparison binding registry exports bind, read and proofs at criterion-comparison.ts:90. It does not expose a lighter inspect or a binding-batch capability that the consumer forgot to forward. A new binding observation boundary would be a new design requiring proof of its preferences admissions, source closure and egress, not a missing-method fix.

## Decision boundary

The next measured attribution belongs to diagnostic17: original cases.read, operation access and Planner projection/calculation costs. This audit explains repeated comparisons and identifies two limited batch-forwarding opportunities; it does not select a latency fix.

Preserve every original first/second observation, pre-write/post-write check, authority and preferences admission, provider identity, source fence, original scalar scheduling, cache eligibility and comparison/result equality. Do not enclose analysis or persistence writes in a read-only root.

## Exact source inventory

All links and blob SHAs below were read at the audited commit. This is provenance for this audit, not a global protected-file equality claim.

| Path | Blob SHA |
|---|---|
| [modules/sucafina/Sucafinav1/product/portfolio/product.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/modules/sucafina/Sucafinav1/product/portfolio/product.ts) | `d4c5d9c9aabcf70bb71739d3952776517dc55923` |
| [modules/sucafina/Sucafinav1/product/portfolio/contribution.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/modules/sucafina/Sucafinav1/product/portfolio/contribution.ts) | `527549734e66439a4298877f5b9e90918dd8b3f5` |
| [modules/sucafina/Sucafinav1/product/portfolio/port.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/modules/sucafina/Sucafinav1/product/portfolio/port.ts) | `452877ad2c82835fe883ea05dbf15f80f84f51c5` |
| [modules/sucafina/Sucafinav1/product/portfolio/production.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/modules/sucafina/Sucafinav1/product/portfolio/production.ts) | `a1765988434920f8dc9c71eaea2427b6ecac59cb` |
| [modules/sucafina/Sucafinav1/product/portfolio/analysis.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/modules/sucafina/Sucafinav1/product/portfolio/analysis.ts) | `47c4388c34c21c7294b0ffc34e4adcbe65b138de` |
| [modules/sucafina/Sucafinav1/product/portfolio/selection.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/modules/sucafina/Sucafinav1/product/portfolio/selection.ts) | `6dd2fd49f585d9449f4dbd93e03a19f6c49449ec` |
| [modules/sucafina/Sucafinav1/product/planner/persistence.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/modules/sucafina/Sucafinav1/product/planner/persistence.ts) | `6306e5e165495947cd9e00408c0d88c6051dfb64` |
| [modules/sucafina/Sucafinav1/product/planner/scenario-comparison-port.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/modules/sucafina/Sucafinav1/product/planner/scenario-comparison-port.ts) | `1782c2094239c3712d3a895a6a25f4160fb429c7` |
| [modules/sucafina/Sucafinav1/product/decisions/portfolio-selection.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/modules/sucafina/Sucafinav1/product/decisions/portfolio-selection.ts) | `64deee2c7570d718686eb2181ff197f4347e6764` |
| [modules/sucafina/Sucafinav1/product/decisions/comparison.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/modules/sucafina/Sucafinav1/product/decisions/comparison.ts) | `948dcf99765e9e668bd999018f1fcba6c575bb10` |
| [modules/sucafina/Sucafinav1/product/decisions/criterion-comparison.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/modules/sucafina/Sucafinav1/product/decisions/criterion-comparison.ts) | `dbd02e2d4d15ca2b866179759d38a0066e6550dc` |
| [modules/sucafina/Sucafinav1/product/decisions/criterion-rules.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/modules/sucafina/Sucafinav1/product/decisions/criterion-rules.ts) | `c357c6c66aac544394ab355306e1f6f7195395f7` |
| [modules/sucafina/Sucafinav1/product/decisions/result-store.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/modules/sucafina/Sucafinav1/product/decisions/result-store.ts) | `bf1b2e6d62b21f9ebf1819d84a6e3e075f2a2efc` |
| [modules/sucafina/Sucafinav1/product/portfolio/verification.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/modules/sucafina/Sucafinav1/product/portfolio/verification.ts) | `254e22ea35f5b422b59c8f0549c8f12d1d4fb492` |
| [apps/cli/src/sucafina-product/portfolio-authority.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/apps/cli/src/sucafina-product/portfolio-authority.ts) | `3404aa793a7c73f370a750c4dadc9f6410379706` |
| [apps/cli/src/sucafina-product/portfolio-services.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/apps/cli/src/sucafina-product/portfolio-services.ts) | `881ce4672d9d0e641d1cc849663c0980c118774d` |
| [apps/cli/src/sucafina-product/portfolio-comparison-scope.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/apps/cli/src/sucafina-product/portfolio-comparison-scope.ts) | `7d43f60fdb1a6400cdec1b89c1717e6a2b8a2f11` |
| [apps/cli/src/sucafina-product/portfolio-comparison-observation.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/apps/cli/src/sucafina-product/portfolio-comparison-observation.ts) | `6c34520bf11aa42c0d42244a830bf00433894757` |
| [apps/cli/src/sucafina-product/finance-pair-observation.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6acd67a926c664c696df3ae1c0791599ef58e811/apps/cli/src/sucafina-product/finance-pair-observation.ts) | `17c5369261be13910e5b1d237a5391a4178ee245` |

## Change receipt

- Artifact only: this report.
- Runtime changes: none.
- Tests or CI launched for this audit: none.
- Root/dev/other worker branches changed by this audit: none.
- Independent measurement claim: none; reported diagnostic counters are explicitly attributed above.
