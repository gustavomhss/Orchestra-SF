# W23 — short canonical Procurement evidence read scope

This is builder work and a static auxiliary audit, not an independent review. Base: W22 `4bc9c7220f04f113609393aaba38934a7e69878b`, tree `082b73607bea09a0a6252e2298c5a581c10cb645`.

## Observed W22 failure and cost

Run `43609220130`, job `132490362081`, failed historical Memory at 225020.02 ms when its 225000 ms cooperative deadline aborted work. Its Bun budget remains 240000 ms. Cleanup job `132492560014` succeeded. Raw log lines 963–999 record the phases below; exact evidence hashes are in `hosted-causality.json`.

| Phase | Seconds | Persistence calls | C08 reads | Atlas started/completed |
|---|---:|---:|---:|---:|
| memory.resolve-original | 0.481 | 175 | 3 | 0/0 |
| memory.prepare | 49.666 | 17818 | 598 | 2/2 |
| memory.verify | 49.716 | 17860 | 610 | 2/2 |
| memory.accept-output | 49.338 | 17860 | 610 | 2/2 |
| memory.exclude-history-and-isolate | 22.726 | 8188 | 282 | 1/1 |
| memory.fence-source | 15.439 | 5613 | 172 | 1/1 |
| memory.fence-capture | 15.688 | 5667 | 175 | 1/1 |
| memory.fence-principal | 13.702 | 4830 | 141 | 1/1 |
| memory.fence-clock | 5.297 | 1841 | 48 | 1/0 |

`persistenceCalls` counts wrapper invocations, including nested calls. It is not a measurement of independent SQLite connections or decodes. The clock probe had one started Atlas call and zero completed calls when cancellation fired; its mutation hook and subsequent lease/header/retry/stale/cancellation tail were not thereby qualified.

The current Memory scope already limits completed case and Atlas proof reuse to one observation. Below it, canonical historical Procurement still performs two `issueForActor` calls. Each has one `resolveCurrent` inside `issue` and two more explicitly. Two physical-continuity checks add two further direct current resolutions, and the real projection reader performs its own source reads. BCS historical continuity remains another canonical path. The new scope leaves this work intact and reduces repeated driver admission/decoding by keeping one producer in one actual read root. Any elapsed improvement remains unmeasured.

## Why the complete Memory observation cannot hold a root

The test wraps `authority.state.read`. After the actual C08 read returns a `sf-memory-case-fence`, the wrapper awaits an interleave callback. Source and capture probes execute real `commit:true` transactions inside that callback after a canonical Atlas read completed. Holding a root across the whole observation would make these writes nested and poison the root, preventing the required race from occurring.

The integration hunk wraps only `decisionEvidence.resolveEvidence`. It never wraps Memory observation, case/Atlas callbacks or their final witnesses. The producer's private marker is `sf-procurement-evidence-fence`. Historical instrumentation now proves that this marker still has an owning LocalStore root after its nested C08 read, while every `sf-memory-case-fence` sees no root and the original writer probes remain possible.

## Eligibility and failure behavior

The helper receives the real `contextFor` and reconstructs the current actor's scope from current principal/access/policy/roles/canWrite/roleMap, canonical fields, selected period and actual currency. It looks up the current key, independently of the historical reference's old version. Public source identity, scoped identity and canonical projection must agree; the complete stored entry must equal the producer's existing-entry shape. This predicts absence of a metadata write. It does not supply an archive or continuity proof.

The Request object, all headers, binding, selected-period object/digest/expiry, resolver function identity, UTC day, directory and bank key remain pinned. Records with continuous approval age are excluded. Before and after the one canonical producer, real C08 reads and host reauthorization protect the whole product state—including captures—and all three domain snapshots/source fences. Results and authorization are never cached.

Unsupported preflight leaves the root before canonical work. This includes C08 that is uninitialized or lacks preferences authority while the original source operation is otherwise authorized: the canonical producer can still return `undefined` and let BCS take its existing fresh-source path. After canonical execution begins, any changed/unsupported witness, nested writer or error returns unavailable without retry. A valid canonical `undefined` remains `undefined`.

## Counterproofs and preservation

The new complete test file has four real cases: cold C08, missing preferences grant, ready C08, and an unexpected actual nested writer. All use LocalStore, real consumed UI leases, the actual business composition/BCS and actual Procurement decision producer. The instrumentation wrapper calls that real producer and returns its real value. No state success, authority result or source proof is fabricated. The writer case requires a single invocation, unavailable output, and unchanged persisted snapshot.

Historical Memory gained root/nested counts and four additive assertions. All 75 original expect expressions, all original probes, two-Atlas/six-context count assertions, 225000/240000 ms budgets and the entire stale/cancel tail remain byte exact after removing the added instrumentation. The C07 and scenario W23 sealed files also remain unchanged.

## Integration and execution status

`own-diff.patch` contains three applied own paths: new helper, new integration test, and historical instrumentation. `business-integration.patch` is deliberately separate and was not applied by this builder. It injects the real host/contextFor/state/selection/source fences and pins the current canonical resolver function; it preserves the C06 branch and all other composition seams. Root must compose it with concurrent C12 work.

Only source reading and pure text/JSON/hash data processing were performed. No product tests, imports, typecheck or build ran locally; no publication, CI dispatch or other remote mutation occurred. All successor runtime, performance and acceptance claims remain pending hosted CI. This package does not establish native/global acceptance or replace three independent reviewers.
