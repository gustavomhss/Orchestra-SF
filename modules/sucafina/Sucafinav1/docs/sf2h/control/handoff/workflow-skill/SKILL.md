---
name: run-efficient-agent-campaign
description: Coordinate parallel implementation teams around existing work packages, with whole-task ownership, coherent branches, autonomous technical leads and evidence-backed PR handoffs. Use for multi-WP execution or recovery of stalled agent campaigns.
---

# Run Efficient Agent Campaign

Drive existing work packages to complete, reviewable PRs. Preserve the user's scope, acceptance predicate, testing cadence and permissions. An approved plan supplies the work; do not replace it with another decomposition campaign.

## Assign existing tasks

Map every planned task ID exactly once to an implementer within its WP. Supply its complete criteria, dependencies, output and actual consumer. Reconcile accepted code before assigning remaining work. Internal file edits advance a task; they do not replace it or its acceptance conditions.

Choose team composition from the user's requirements and verified capacity. All implementation seats take implementation tasks. The technical lead also implements, owns internal coordination and consolidates the complete WP. Keep final independent reviewers separate from authors. For Orchestra SF's specific four-seat/testing rules, read [references/orchestra-mode.md](references/orchestra-mode.md); do not impose that ratio or cadence on unrelated projects.

Do not assign a model a discovery-only or fixture-only role based on a presumed capability limit. Verify tools and normal scoped permissions first. Avoid arbitrary tiny turn limits or forced low reasoning for whole implementation tasks; preserve actual provider, user and budget controls.

## Keep each workspace coherent

Use one primary product worktree and branch per WP when the campaign adopts this topology. Helpers share that tree with disjoint write paths. Keep one Git index/commit writer: the WP lead. Read-only adapters may return complete patches for that lead to review and materialize.

Before dispatch, verify required producer APIs exist at the supplied SHA. Supply exact input versions and only assigned criteria plus necessary context. Resume with the checkpoint and delta instead of repeating every pack and transcript.

Preserve dirty work and historical outputs. Missing dependencies do not justify resetting a shared tree or creating another writer. The lead reconciles exact producer blobs or safely integrates after checking live writers and the expected head. Any base change must preserve in-flight work.

## Delegate WP closure

The lead assigns internal paths and makes compatible implementation decisions without supervisor permission for each function or file. The supervisor owns cross-WP ownership conflicts, real contract contradictions, integration between WPs and release judgment.

Verify a direct communication route between producer and consumer leads. Where transports cannot communicate, record the limitation and use a supported route. Assign a missing dependency to its actual producer; the consumer retains responsibility for wiring and verifying it.

Make useful increments available during implementation. At the end, the lead consolidates the whole WP, closes findings, runs authorized checks and returns one PR with exact input/output SHAs, criteria evidence, consumer acknowledgments and blockers. Committed code, OUTPUT_READY and checks on another SHA do not establish completion.

## Keep slots useful

Recognize instances by backend/model/session/job IDs and observed state. Distinguish logical roles from actual concurrent capacity. Reuse persistent lanes with bounded context; avoid disposable agents for tiny edits.

Use the backend's supported lifecycle. In the collaboration API, send_message does not wake a completed agent; followup_task does. Other adapters have their own resume semantics. Silence does not prove a writer is dead. Revoke/fence authority before transferring a path.

Replenish free seats with ready tasks from their WP. Do not strand ready producers behind an arbitrary wave barrier. If a backend lacks headless write permission, use an authorized patch handoff and disclose the limitation. Never bypass host trust or describe textual inference as a shell worker.

## Bound proof and coordination cost

Respect repository testing interfaces and the user's cadence. Keep one CI dispatcher, deduplicate by candidate/tree, normalized selection and relevant runtime/configuration, and reattach existing runs. Final checks prove the accepted candidate; earlier passes remain development evidence.

Require compact returns: task IDs, behavior, paths/SHAs, checks and actionable gaps. Read exact changes and evidence rather than full histories. Repeated identical failure requires diagnosis or a different supported route, not repeated continue prompts. Checkpoints record changed facts and the next executable action.

Report complete WPs separately from implemented, integrated and validated work. Measure completed WP PRs, dependency waits, completed-agent idle time, source-to-stack lag, rework and context cost. Derive percentages and ETAs from verified remaining work; busy slots and token use do not prove delivery.

Use supported native continuation with one supervisor/controller. Preserve pauses, cancellation, budgets and interruption controls. Incomplete work remains incomplete when continuation is unavailable. For demonstrated failure patterns, read [references/observed-failures.md](references/observed-failures.md).
