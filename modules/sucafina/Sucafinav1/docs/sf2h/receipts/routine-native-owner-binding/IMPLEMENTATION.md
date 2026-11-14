# Mission41 — private native owner registry

Status before hosted qualification: independent implementation and shared-host patch prepared. The authenticated SF Request → native Maestro admission/continuation producer is absent from the inspected host. This delivery does not claim a usable end-to-end native routine connection, AM02, AM06, or global acceptance.

## Authority and lineage

Planning is pinned to `dbf9547211d9b0fade619790de7c19c0869b7c7d`; mission41 is pinned to `e4c1bb7c914a29cb3d4fcddc9e196823289ccc80`. Source continues `astra-wp09` / PR30 from observed `d9e1aca275bd04b2066ca84a605c7c315ea14c77`, after mission30 terminal. The mission41 claim is `e4ccf93df3e5d3ad0e8c2de0d0b07111902b62ef`. The prior adapter product is `7676fd9173015e2c7d7c91745cc486f50018fc85`.

Only the five listed private TypeScript modules, the new owner-binding tests, and this receipt directory are changed. `routine-native-services.ts` was unnecessary. Native Maestro, Relay and Schedule engines, shared host composition, public protocols and source services outside the mission remain unchanged. Root is the sole remote source writer, via GitHub MCP, compare-and-swap and `force:false`.

## Implemented boundaries

`routine-native-owner.ts` reads the existing `CapabilityInvocation.require` frame inside a real Task settlement. It requires native Maestro, the root core-issued Task invocation, the actual scoped Task registration, matching project/Location, canonical SessionStore session/message/tool part, current plan, approved intent and native governance records. It checks real Permission evaluation without answering prompts or saving grants. Retained SF input is checked for consistency after native identity is established; it is never an independent grant. A frozen witness re-reads canonical facts and detects mutation.

`routine-native-registry.ts` owns only ephemeral capabilities. Its private `withRequest` scope takes an actual authenticated Request and a currently consumed SF context, never session or call selectors. The ToolSafety hook joins that scope with the canonical native witness. Exact Request/context/binding/lease/resource identities, headers, installation/project/Location, principal, policyVersion, accessRevision, provider generation and expiry are fenced before and after asynchronous work. Abort, explicit revocation, generation invalidation, runtime replacement and scope finalization remove the live binding. Successful resolutions return the same frozen object. A process-local set rejects replay of a captured canonical call; it is not a durable admission/run ledger.

The maximum scope lifetime is five minutes, bounded further by the existing context expiry, with the same shorter lifetime enforced monotonically against wall-clock rollback. The registry delegates one original settlement and finalizes through Effect acquire/use/release, including interruption. Scope revocation uses the existing private `withSfRoutineNativeAbort` helper to interrupt only that scoped effect while it awaits; no session is stopped by a guessed ID. This is cancellation and authority fencing, not transactional rollback of already committed native effects. It neither dispatches Task again nor creates sessions, messages, plans, approvals, reservations, arms or run identifiers.

`routine-native-governance.ts` adds an optional private observer around its existing ToolSafety guard. The guard retains native permissions, human approval, plan authority, before/after checks and Relay fencing. The registry does not call `governance.bind`: ownership must not replace the adapter/admission lease that additionally revalidates case, sources and publication. This was a concrete finding in the independent source review and was corrected before publication.

`routine-native-runtime.ts` captures the existing scoped Permission service alongside its other actual native services. `routine-native-adapter.ts` respects the concrete registry's availability. Existing custom test ports without the optional availability predicate retain their previous contract; the supplied production assembly removes the optional externally supplied owner port and instantiates the concrete registry.

## Consumable shared-host patch

`assembly/host-context.patch` has complete preimage/postimage files and content hashes. It modifies the actual `createSfHostRuntime` → `createSfHostRuntimeWithRoutineNative` call chain, constructs the registry, connects the existing private ToolSafety observer, feeds the existing adapter, and disposes the registry before asynchronous shutdown. It is a proposal for the integration owner, not a direct shared-host write or an executed integrated candidate.

That patch cannot supply the missing authenticated native admission origin. Native Task frames contain no SF Request; the existing SF resident host creates a selected resident profile such as `sf_maestro`, which is not native `maestro`, and has no canonical principal-to-Maestro association. Keeping a Task frame alive after settlement, inferring ownership from retained parameters, or calling the adapter reentrantly while the session coordinator is already occupied would be invalid substitutes.

`assembly/missing-capability.json` specifies the exact required private producer and its consumers. It also identifies operation-specific C07/case/source/publication authorization, coordinator-safe continuation ownership, and descriptor readiness before provider materialization. No caller of `withRequest` is fabricated. The patch's current default therefore registers zero routine descriptors. The five Task operations remain unavailable until this producer is installed and qualified. `sf_watch_prepare` additionally needs real Schedule admission.

## Qualification boundaries

The two new test files use real SQLite, EventV2, SessionStore, AgentV2, Permission/PermissionSaved, ToolRegistry, publication storage/compiler and native record readers. Persisted sessions, assistant messages, Task calls, human approval and arm records are explicitly synthetic fixtures. The authenticated host lease and native frame are injected fixtures; the registered Task implementation is deliberately nonexecuting. Unused native services throw if touched.

Positive coverage joins the fixture-scoped Request to existing canonical records, observes stable identity and reads the real published plan through the existing adapter. Negative coverage exercises forged identifiers, actor/project/Location, stale governance, Request/headers/policy/access/lease/provider/resource changes, concurrent duplicate and replay, revocation, abort and interruption. Original guard failure remains a failure; publication revocation remains enforced independently of live ownership.

Hosted Actions will select only the two owner-binding files and the two directly affected previous adapter-boundary/governance-lease files. The existing package typecheck and guard workflow is used unchanged. Product source is not executed locally. Every attempt, product W, CI snapshot S, result and limitation is recorded separately; inherited failures are not relabeled green. Shared-host postimage compilation and actual admitted native model/reviewer/Task/Relay/Schedule execution remain outside this component proof.

The complete S0-B criterion ledger is preserved in `criteria.json`; source component results do not replace the integrated proof families or the exact canonical text.
