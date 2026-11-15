# Mission 110 — handoff to owner95 / integrator106 / 107 / 108

**Status: SOURCE_READY / INTEGRATION_HOLD / NOT_RUN.** All changes remain under mission110's allowed paths, with GitHub MCP/CAS; no engine edits, merge, local tests, Azure, deployment, Permission.reply, readiness or watch.

## Observed API boundaries

Core CapabilityInvocation.require(context,{projectID,location}) validates an issued core frame; IDs and plan.owner are not authority. TaskGovernance.Interface.admit runs during the original Task; beforeTurn(child SessionInfo) is invoked after child creation and before provider dispatch. TaskTool owns Session creation/model resolution/Permission.assert/prompt/resume. SessionStore.message(assistantMessageID) allows checking one real persisted Task tool-part with state.status=running, matching input and provider.executed!=true. SessionStore.get/scope/narrow are public. PermissionV2.forSession can observe pending questions; mission110 neither sends nor fakes replies.

Owner95 currently has only registerMaestro/validMaestro for the root. SessionRunnerModel and LLMClient intentionally block SF descendants with no private child ticket; ExecutionHost rejects SF lineage. This missing public issue API is why the 110 helper must remain fail-closed until 95/106 integrate its handoff.

## Owner95: token-gate patch

Use assembly/95-token-gate.patch (10 hunks), with full assembly/95-token-gate.pre.ts and .post.ts. Preimage 5a3e39ff379d51a15f5f601ed9739191ff7071c4 on native-host-provider@9757b5e; proposed postimage cf7ee32b50f906bbc2013a830d2ad582bde196fb.

Adds traceChildRoot(parentSessionID) from actual private root C15 and SF-ownership registry; a missing/revoked SF root is BLOCKED, not outside. Adds registerChild(binding) only after independently reading the persisted original Task, parent/child Sessions, matching root model/Location/scope/budget/Permission floor and current root Request. Binds SessionRunnerModel and the token-oracle LLMClient stream to that exact private child record. Shared Catalog Model objects are not session grants. Root revoke, abort, expiry and disposition invalidate child ticket and in-flight stream.

Owner95 must review child token-receipt provenance under durable C09; the suggested patch reuses the live root C09 token-writer and cannot itself claim installed native-proof acceptance. It does not bypass ExecutionHost's hosted-route deny. Only95 edits the actual target.

## Integrator106: host-context patch

Target host-context.ts only for sole writer106. Patch assembly/106-host-context-post95.patch (4 hunks). Preimage is owner95's COMPLETE assembly postimage acdd01117cf8c83e011dd9576c36cf38f5b173c7 (936 lines), not the base C53 host blob f03ab621e96cfda23456be73bba2d24f24754d36. Proposed postimage e9a5efd8b5ed3967e765a99f9d1d144814253253. Reconcile current sf2-stack and later authors; never copy whole stale files.

Wrap canonical MaestroGovernanceV2.node, never TaskGovernance.allowAll, via a Location TaskGovernance replacement wired to the 95 private traceChildRoot/registerChild and the real SessionStore/PermissionV2. Dispose the helper with Location. Producer95's enabled:()=>false stays false until 107/108 evidence plus independent reviewers. No readiness/watch uplift from source or fixture alone.

## Proofs, negative tests and holds

Helper enforces core frame, original Task state, default root actor, actual Session/instance/model, root scope budget, model selector, upstream governance, pending Permission refusal, child Scope.narrow and ticket validity. Child never inherits arbitrary allows: no Task, SF/MCP, bash/write/edit; read/grep/glob/list only if in parent scope. It rechecks after awaits and at settlement. Background, worktree, task_id continuation and nested Task are intentionally denied until a real fresh human continuation/child contract exists.

12 component-only bun:test scenarios were authored: absent core frame, foreign child/model, running-state changes, hosted provider, abort, expiry, revocation, pending Permission, scope and unregistered C15. **NO test has been executed.** Request surgical Actions via mission107 and compilation/guards via108; attach exact Actions request/run/job output and owner95/106 integration ACKs. Native installed C15, real Permission UI and model transport, full 15WP/74task/17contract/1610criteria acceptance, readiness/watch and GLOBAL_RELEASE remain UNPROVEN/OFF.
