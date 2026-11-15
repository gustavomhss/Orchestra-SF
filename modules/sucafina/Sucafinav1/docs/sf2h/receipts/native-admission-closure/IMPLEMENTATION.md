# Mission64 — authenticated native admission consumer

## Delivered behavior and boundary

The source delta adds `routine-native-admission.ts`, reuses the existing mission41 owner witness and registry, and adds non-replacing `tryBind` to the existing governance wrapper. The new hook surrounds the **original** core Task settlement. It does not dispatch a second Task, adopt a running coordinator, generate approval or write a second native ledger.

For an SF plan the hook requires a private, already authenticated origin capability. Its output must contain the exact original POST Request, its consumed `TrustedUiContext`, a live native authority Session, the exact human `routines.run` intent, and the origin's cancellation/current-authority lifetime. Caller IDs and the retained `SF_ROUTINE_INPUT.owner` only provide consistency checks. No default origin is constructed.

Before using the existing native owner binding, the hook checks the native Task witness, the current principal/access/policy/provider generation, the actual case incarnation/version, canonical source digests, and the live publication. Native review, direct human approval, authorization, Permission, Task/Relay arm and execution remain with their existing native producers. The same authority, case, source and publication checks run around the settlement and through the governance lease before its result can leave the hook.

The registry claims replay ownership before `tryBind`. A duplicate or a contender for an occupied plan cannot replace or release the active caller's lease. The original effect's result and errors retain their identity. The existing governance `bind` replacement behavior is preserved for existing callers.

Request acquisition now registers cancellation **before** its first asynchronous generation/authority read. Abort, explicit revocation, expiry, disposal and generation invalidation reach the pending acquisition as well as a fully bound operation. The acquisition set belongs to the existing registry and contains cancellation handles only; it issues no owner capability. The deadline begins before those awaits. Admission disposal also cancels a pending origin lookup, only after the plan has been classified as SF. Unrelated native tools/workflows retain the original native policy.

## Shared composition

`assembly/host-context.patch` is a complete, inert five-hunk patch with exact preimage/postimage and hashes for mission60. The live shared file is not edited. The patch instantiates registry41, mounts the existing governance/runtime dependency graph, points `ownerHook` to admission64, and connects the canonical Request, human-intent, case, source, publication and generation readers. It revokes admission/registry synchronously before asynchronous shutdown.

The normal factory still supplies **no authenticated origin**. Readiness is therefore unavailable and routine descriptors remain unadvertised. The patch does not invent dynamic tool registration; a genuine readiness subscription and scoped provider registration are external composition prerequisites. Applying the patch alone is not an installed native journey.

## Concrete external capability

See `contracts/capability-contract.json` and `contracts/API-NOTES.md`. The native Session, prompt, Task, Permission, Maestro review/approval and Relay APIs exist. What is missing in the inspected installed host is their authenticated SF origin and lifecycle, including a legitimate C15 ticket/budget specialization for native Maestro and its children. A resident `sf_maestro` binding cannot be relabelled as native `maestro`. Removing SF scope markers to evade the token gate is also invalid.

The producer must possess the original Request and legitimately establish the native Session relationship. It must supply the real independent review/direct human approval/Permission continuation, current C15 budget/policy and revocation, and a supported authenticated historical/result-read relationship after reload. The hook owns `registry.withRequest` for each Task settlement; the producer must not install a nested scope around the whole runner. Historical read authority is separate from a live running Task witness. Schedule remains a separate admission capability and watch stays unadvertised.

Source41's witness rejects `provider.executed === true`; that remains an explicit provider compatibility limit. No actual provider turn, native Task execution, Relay return, immutable output consumer or Schedule run was observed in mission64.

## Evidence discipline

`test/product/native-admission-closure/` uses real component41 SQLite/native readers, publication and registry code with deliberately synthetic Request/UI grants, origin, native frame and Task/governance records. The inherited Task implementation throws if dispatched. The observed original effect is a test effect. These tests prove component behavior only, even when hosted CI succeeds.

Hosted runs, their exact W/S trees and selected files belong in `checks/`; compiler/guards belong to mission45. No product test, compiler, build or guard is run locally. `CRITERIA.json` retains all 98 exact actor criteria without declaring the whole task complete. `AM-COVERAGE.json` retains AM01–AM06 and the 5/18/8/39 obligations with no invented installed credit. Source delivery does not constitute integrated C/G7, D/G8, the final eight selections, three independent campaign reviews or GLOBAL_RELEASE.
