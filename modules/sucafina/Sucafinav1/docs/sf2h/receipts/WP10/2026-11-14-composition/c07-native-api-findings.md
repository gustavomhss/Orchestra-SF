# WP10 C07 native composition findings

Builder: `/root/runtime_analysis`. This is implementation triage, not one of the three independent final reviews.

## Source pin

Remote API inspection used GitHub MCP at commit `d02c64430d459d183eeb9e467e1c35d9a6b958f8`. WP09 producer updates subsequently consumed by root are used from the shared local snapshot. No remote writes, engine edits, local product tests, or local typecheck were performed by this builder.

## Local implementation

New host-owned sources:

- `apps/cli/src/sucafina-product/routine-services.ts`: all six WP09 descriptors; BusinessPorts.routines; pinned preparation; native record/input/case/source checks; artifact, input digest and terminal execution readers; authenticated discovery and openResult through the WP09 factory.
- `apps/cli/src/sucafina-product/routine-publication.ts`: scoped contribution/getter using the existing `WorkflowRelayV2.publication` inside the actual `LocationServiceMap`. It reuses Relay's canonical authoring store, native skill resolver, native Atlas knowledge resolver and mandatory acceptance controls. No publication, approval or second ledger is created. Disposal invalidates retained ports and checks again after asynchronous reads.
- `apps/cli/src/sucafina-product/routine-inputs.ts`: case-owned `refId`/`refDigest` selectors resolve through `BusinessContextService`; C07 SourceRefs are taken from the current producer's actual DomainProjection. Unsupported document/policy projection shapes return a specific unavailable reason; they are not fabricated as record sources.

New surgical selector:

`Sucafinav1/test/product/wp10/native-host/routine-services.test.ts`

Its tests use the real UI registry, AuthoringStore and actual graph publication. Native C07 admission/run/artifact I/O is explicitly a boundary fixture. The test covers absent API; real published catalog without a plan; exact plan/input binding; stale admission not invoking start; real producer result validation; terminal digest mismatch suppressing content; revoked UI authority; and retained publication ports denied after scope disposal. It is not GNATIVE, live provider, schedule occurrence, or global acceptance evidence.

The earlier native-host lifecycle change and its selector remain:

`Sucafinav1/test/product/wp10/native-host/native-host-disposal.test.ts`

## Composition

```ts
const routinePublication = createSfRoutinePublicationContribution({
  identity,
  authorize: authority.authority.revalidateDomainContext,
})
const routineInputs = createSfRoutineInputReaders({
  cases: business.cases,
  context: business.context,
  resolveCase: business.resolveCase,
  revalidate: authority.host.revalidate,
})
const routines = createSfRoutineServices({
  authority: authority.authority,
  publication: routinePublication.publication,
  resolveCase: business.resolveCase,
  ...routineInputs,
  // native: host-owned installed SfRoutineNativePort, only when a real C07 adapter exists
  // prepareWatch: verified canonical condition/recipe proposal reader, when mounted
})
```

Mount `routinePublication.contribution`; merge `routines.descriptors`; supply `routines.routines` to analysisHost and `routines.routineRuns` to SfHostServices. `@orchestra/relay: workspace:*` is a new direct CLI dependency required by the publication composition; root owns package/lock reconciliation.

## Native API evidence and precise missing boundary

| File / symbol | Blob SHA | Observation |
| --- | --- | --- |
| `packages/core/src/tool/task.ts`: registered Task executor and private `requireParent` | `0e82455ca428e5b498551496bc65bdc0f6551df3` | The module exports Input/Output/node and Task identity/result helpers. Its executor is registered in Tools.Service. `requireParent` requires a persisted assistant tool part named `task`, matching call ID, turn owner and exact decoded recorded input. A `sf_mcp` call or UI request is not such an invocation. There is no exported host createTask/admitTask function in this module. |
| `packages/core/src/tool/task-governance.ts`: Interface.admit | `12173c0769e62212a4a01003a0a253e7d1d1ba38` | This is a hook inside Task's checks. Its contract forbids replacing target/model/depth/placement/approval checks or publishing Session events. Calling it as a replacement Task would bypass native admission. |
| `modules/maestro/coordination/src/v2/governance/workflow-admission.ts`: before/admit/turn | `633cfc60d784e5df8d6d616bed568e5f881b3f11` | Requires the real approval/reservation, current plan revision, upstream provenance, exact workflow parameters/write paths, arm, parent/child and actual authority call. An SF profile name grants none of these. |
| `modules/maestro/coordination/src/v2/workflow/host.ts`: Interface.admit/current/settle/grade | `111dac220a84bdeffe94956244b728b29eb98ea4` | Operates existing native WorkflowBound receipts and arms. It does not create SF admission identities or C07 immutable artifacts. |
| `packages/core/src/relay-workflow-session.ts`: current/reconcile/settle | `fc006686eb25e96aa55cd8b93fc60994ebdd9dfd` | Reads actual WorkflowBound events. An absent host is a HOLD; it is not an ordinary Session escape. |
| `packages/core/src/relay-workflow-currentstep.ts`: View/read | `c34249dde50c821e405128a148f015775095ac62` | Exposes state, step, position, attempt, ledger sequence and pending settlement. It has no C07 input digest, immutable artifact or terminal output digest reader. |
| `packages/core/src/relay-workflow-binding.ts`: PublicationPort/catalog/acquire/revalidate | `7149e276e0c214d70c2dafad90dadff5d2c21059` | Real consumable native publication interface, now reused by WP10. Retained workflow bindings revalidate their immutable published version; unpublish still holds. |
| `modules/maestro/coordination/src/v2/workflow/relay.ts`: publication | `66c147f58f29334e1cfe541f240c14619a87d05c` | Existing native adapter supplies AuthoringStore, acceptance checks, skills and knowledge. The WP10 contribution calls this function rather than copying it. |
| `packages/protocol/src/groups/relay-run.ts`: RelayRunGroup | `98e60955b216d71887830cda06f8d07cd442fa98` | Only GET list/get/audit/ledger for external LangGraph runs; no create/admit/start endpoint. |
| `packages/server/src/handlers/relay-run.ts` | `9af748eb25d441d8ed3766b09ef9a610a915b731` | Reads `.relay/runs/.../ledger.jsonl`; intact external self-report explicitly remains pending, never pass. Not a C07 native admission source. |
| `packages/protocol/src/groups/session.ts`; `packages/server/src/handlers/session.ts` | `9eb3339edbe03951145165f1b856ec8ece90baab`; `9e078b6a9870a6f9684e493da8220f28b411d696` | Native Session create/prompt/resume are available but do not create a governed workflow approval/Task binding or C07 artifact receipt. |
| `modules/maestro/coordination/package.json` | `438c5a89f01d13d992e86582030d1a3b59f277a3` | No exported public workflow host dispatch service. WP10 publication uses the existing source module at the composition layer, without modifying Maestro. |

The code-search terms `createTask`, `admitTask`, `TaskV2`, and `TaskAPI` returned no default-branch results; the conclusion above relies on the pinned file APIs and endpoint listings, not those empty search results alone.

### Minimum owner delta still required for real admission/execution

The native owner must expose a host invocation entry that preserves all Task checks while accepting a separately authenticated SF request/admission, instead of requiring WP10 to forge an assistant `task` message. Its durable return must bind admissionRef/version, current authorization, arm, child Session, exact plan/publication, SF principal/project/case, full admitted input digest, sources and correlation. It must provide read/revalidate/index and atomic start/retry semantics under current authority. Completion must supply a native terminal receipt with resultRef/outputDigest and an authenticated immutable artifact; session resume returning void is insufficient.

`SfRoutineNativePort` in the host source documents and consumes those requirements. It does not fabricate their implementation. Until an adapter is installed, preparation/run/read paths report specific `native-routine-...-unavailable` reasons. A real published catalog with no current plan returns `published-workflow-plan-required`.

The current `sf_watch_prepare` producer accepts a host callback but does not implement a native condition/occurrence bridge. `decision-memory/signal-registry.ts#createSfSignalRegistry.list` supplies canonical condition records when mounted; `routines/schedule-native.ts` requires an existing scheduled-task owner mapping, native session-to-routine binding, terminal receipt and artifact access. No occurrence is created or reported complete by this WP10 builder.

## Criteria impact

This work supports T06 C16 wiring and denial invariants, specifically `WP10.T06.CHK.60`, `INV.60`, `QLT.60` and `CMP.60`, subject to hosted CI. It does not close `WP10.T06.SUC.60` or `DOD.60` on the strength of descriptor registration or boundary fixtures; the criterion explicitly says an always-refused tool does not count as delivered. `WP10.T01.CHK.03`, C07 persistence/composition criteria, full AM02/AM06 and GNATIVE/global outcomes remain pending the real native adapter and independent proof.
