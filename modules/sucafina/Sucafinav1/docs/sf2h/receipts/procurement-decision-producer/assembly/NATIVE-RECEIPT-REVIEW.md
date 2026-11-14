# Mission37 — transient Procurement capability review

Static auxiliary review of Mission37 assembly entries 04 and 10. The explicit succession is closed session33 to integrator42, with S0 as the proof executor. This review did not modify product source, execute a test, run a guard or dispatch CI. It is not an independent campaign acceptance. Source W2/W3 results do not verify these shared-file postimages.

## Result

The reviewed composition removes the identified implicit C08 write from Procurement `sf_scenario_simulate`. It retains the same operation, handler export, schemas, profiles and required authority. The Procurement result is a typed transient preview; explicit human promotion remains the existing C08 operation.

Reviewed consumer base: `e7e97591edfc15f230856a035e32951f2f700c2f`.

| Assembly path | Preimage Git blob | Reviewed postimage Git blob |
| --- | --- | --- |
| `modules/sucafina/Sucafinav1/product/planner/capabilities.ts` | `511508ad5c225e48d21cdffacd9f0e1b3139b402` | `0947902acfba1b45d7f2950e8aaa64e1c7305f6d` |
| `apps/cli/src/sucafina-product/business-services.ts` | `ce3a281bf07819f90af7fad10f98861980f3273b` | `6bb862ce96d3ca2b6478e5f00c257e0b38c1bfee` |

Local artifact hashes were calculated from the postimage bytes and agree with the manifest: capabilities SHA-256 `a51efe7c1a0dddde6e9df9f4fff8afdb7b75dba27e1bfa4c4e1238a73676f995`; business services SHA-256 `c16f0b23685a47a17aa5b07c548784559da443c72f28e81cd29259feca572f0e`.

## Boundary review

`simulateScenario` decodes the canonical input and clones the request before its first awaited receipt admission. Its input digest uses that captured request. The host-owned predicate is evaluated after admission and before calculation; the current `producer.supports` is a pure prefix test, independent of mutable external state. The calculator receives another clone, leaving the captured request unavailable for mutation by the port.

The transient branch does not require or call `persist`. A successful calculation gets a result-digest-bound receipt and returns `{status: "ok", result, receipt}` with no `outputRef`. Failures keep the existing status handling. The nontransient branch retains its existing persistence invocation and returned persisted reference. The factory's optional predicate has no effect for existing callers that omit it.

Business services supplies only `procurementScenarios.producer.supports` as that predicate. Its persistence facade separately refuses a Procurement scenario with `procurement-scenario-explicit-promotion-required`; there is no fallback to `basePersist`. Together these two changes remove both the intended call and the accidental fallback to implicit publication. The default Planner branch remains delegated to `calculations.persist`.

`CapabilityResult` already makes `outputRef` optional in the normative C16 TypeScript shape. No new operation or grant is introduced. A transient result does not satisfy the persisted output/consumer witness required for C15/native AM02. The assembly README makes this distinction explicit; the existing human promotion, durable reload and consumer replay still need their own assembled evidence.

## Why the capability receipt is not a domain write

Read through GitHub MCP at the consumer base:

| Path / symbol | Git blob | Observed behavior |
| --- | --- | --- |
| `product/host-binding/execution-context.ts` / registry `receiptFor` | `18a9d4dbfa4bd8b3421685482f431fa6b5b1469f` | Reads the active consumed lease and frozen operation route, checks input/result digests, and constructs a native receipt object. Registry state uses memory maps; this function invokes no transaction or persistence. |
| `product/integration/ui-authority.ts` / `receiptFor`, `createSfDomainAuthority` | `502fb1ab3a4116a62aeb504a4bb26040c66d81b2` | Reads the consumed in-memory UI admission and constructs a bound receipt. Domain authority delegates to UI/native receipt factories. |
| `product/host-binding/capability-dispatch.ts` / `dispatchSfCapability` | `6ba1b02eee73d44133c78599284f9772b26007b1` | Revalidates authority after the handler, validates output schema, and compares exact receipt metadata and result digest. It does not require an output reference or persist a result. |
| `product/host-binding/sf-mcp-bridge.ts` / `call` | `bc00a2fe70bb37d6132369c3767388e544e18510` | Uses a private in-memory transport and validates the returned receipt. It has an optional external `onVerifiedCall` observer, whose effects cannot be inferred solely from `receiptFor`. |

The admission receipt is a temporary object; only the successful result-bound receipt is returned. These capability receipts are not C12 command receipts and do not create another Apply. The wider native run has its own lifecycle/trace persistence; the static result here establishes that the preview handler, its producer and capability receipt factory perform no business/C08 mutation. The assembled invocation should measure the relevant persistence boundary, including configured observers, before making a broader zero-write assertion.

## Required assembled evidence

After session42 assembly and ACK, S0 must exercise the mounted descriptor through real dispatch with a valid binding: the Procurement result must carry the exact input/result digests and bound actor/session data, have no `outputRef`, invoke result persistence zero times and leave the business/protected result state unchanged. The existing source/principal/stale negatives should also remain effect-free through this mounted route. A corresponding Planner scenario must retain its normal persisted reference and single publication. Reuse the original human promotion/C08 CAS-idempotency/reload checks for durable Procurement results; a transient preview alone is not that witness.

No financial approval semantics, C12 files, contract shapes or engine policies were changed by this assembly. The independent producer still reports the exact financial-command incompatibility; this review does not turn that blocked acceptance into a positive financial Apply.
