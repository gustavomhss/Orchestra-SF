# WP14 requirements and evidence analysis

This is a read-only analysis of the immutable plan at `dbf9547211d9b0fade619790de7c19c0869b7c7d`. It does not declare implementation, CI or native proofs complete. Product source audit belongs to the root/builders. The canonical campaign SHA-256 to verify is `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`.

## Exact inventory

`wp14-criteria-inventory.json` contains 91 distinct WP14 criteria, verbatim: 23 WP axioms, 14 T01 criteria, 15 T02 criteria, 8 T03 criteria, 14 T04 criteria and 17 T05 criteria. `wp14-full.json` preserves the full five-task definition. S0-C contains all five tasks; S4 contains T01, T02 and T05 and matches those definitions.

The full S4 pack was read in structured sections, including all contracts C01–C17, included profiles/skills/routes, proofs, numeric oracles, owners and handoffs. S0-C WP14 definitions and proof bindings were extracted. Mandatory appendices read: `specs/product-acceptance.md`, `specs/resident-runtime.md`, `specs/atlas-packaging.md`, and `specs/execution-reconciliation.md`. S4 requires the fourth appendix in addition to the three common ones. COMMON, START, WORKFLOW, AGENTS, prior WP14 handoff and CI handoff were also read.

## Nonnegotiable ownership boundary

The current user grants all five WP14 tasks to the same continuation, so the historical S4/S0-C division is not a scope limit. The user reserves host composition and shared Atlas/scanner/public linkage to active WP10, decisions to WP11, AI to WP12 and portfolio to WP13. Current authorization supersedes the historical timing/actor assignments, but does not transfer those foreign sources.

WP14 owns only `product/decision-memory/`, `test/product/wp14/` and `docs/sf2h/receipts/WP14/` under `modules/sucafina/Sucafinav1/`. The approved plan explicitly keeps WP14 pure: no concrete store, filesystem/HTTP I/O, UI, domain writes, scheduler or message delivery. Durable memory is required for product acceptance through WP10.T07; implementing a second durable store in WP14 would violate WP14.INV.01/.40 and T02/T04/T05 invariants. Tests can exercise real host ports without transferring production ownership.

Consume published producer blobs with source commit/path/blob provenance and avoid whole old snapshots. Foreign corrections should be findings or reviewable patches for the current owner, never writes to their branch or sf2-stack. No change to approved plan, engines, deployment, identity, financial policy, spawn guards/allowlists or generated Atlas bytes by hand. Preserve prior evidence and archived inputs.

## T01 — materiality

Compare the original condition with a producer-supplied event at reference, incarnation, field, period and material dependency granularity. A global source version change alone is insufficient. Produce a reasoned ReconsiderationSignal with source, affected condition, before/after values, textual severity and correlation key. Do not recompute financial formulas, undo the current choice, approve a purchase or apply a change.

Required discriminators:

- Implementation price 45,000 → 70,000 produces canonical transition cost 210,000 → 235,000 and advantage 30,000 → 5,000, breaking minimum 20,000. Retain the original choice and sources.
- An irrelevant description edit or out-of-scope month remains silent; relevant deadline change produces its own reason.
- Reused ID/new incarnation is explicitly invalid; unavailable data is unknown rather than a satisfied condition.
- Cost-coverage resolution uses the actual C10 comparison producer. Initial omitted training must truly be absent, not a precreated pending cost line. Original known subtotal 210,000 / known difference 30,000 is conditioned; confirmed additional training 40,000 gives 250,000 / −10,000 and minimum broken. Preserve the historical conditioned basis and its caveat, and dedupe a repeated resolution event.
- Cover pending → supported not-applicable as well as pending → included, revoked sources, threshold kept, threshold broken, and a human who retains the choice with a new justification.

The base AI-RENEWAL quote includes training within implementation; the independent omitted-category variant uses a different quote expressly excluding training. Adding training to the base would double count. Original baseline and current comparison cannot be interchanged.

Producer dependencies: WP11 C09 choice and C10 coverage assessment; WP03 canonical calculator/projections; WP08 authorized relations; WP10 composition. Required consuming paths include WP01 decision desk, WP08 My Work, WP09 routines, and WP12 portfolio re-evaluation skill.

## T02 — authorized precedent recall

Rank only `AuthorizedMemoryProjection` returned by BCS/Atlas C17. Keep ranking, match explanation and invalidation/cache key construction pure. Never query a separate WP14 ledger/store as a substitute for createMemoryRead.recall.

Matches disclose their explicit criteria: decision type, horizon, component, restriction and available result. Similarity does not establish current validity; explain changed conditions and preserve the historical period/basis. A name match with incompatible context is not an equivalent recommendation. Cover no cases, compatible/incompatible cases, historical cases, source missing, partly visible content and revoked content.

Authorization applies before ranking and again at detail/open/egress. A revoked field, replaced incarnation or inaccessible dependency suppresses the whole dependent record, including title, summary, counts, score and deltas. Two actors using the same profile do not share grants. No hidden user preference profile. Scope/owner is only partition selection, never ACL. Query arguments cannot supply owner, kind or raw Atlas query. Provenance must identify the real Atlas read module and the resolved evidence reference; ledger-only trace cannot satisfy AM05.

Cache/invalidation identity must include installation/project/principal, accessRevision, policyVersion, scope/derived owner, source versions and incarnations, boundary/schema/manifest/skill versions. Revocation between search and detail invalidates the result and requires fresh authorization even if an ID was already displayed.

Consumers include WP01 desk, WP11 case, WP09 analysis preparation, WP12 memory skill, and WP10 Knowledge pack `recallSfDecisions`/BCS. The Planner recall finding must be resolved against those real consumers, not merely by passing a pure ranking test.

## T03 — expected versus observed

Input is original ChoiceRecord plus authorized C02 observed result/cutoff. Compare by metric, unit, period, currency and coverage, keeping the original scenario and sources. Produce `ExpectedObservedComparison`, `CoverageCompatibility` and factual summary; renderers belong to WP01/WP07.

Required cases: full/partial/absent observation; compatible/incompatible basis; favorable/unfavorable delta; source access revoked. Incompatible currency or period, partial observation and missing result must not become zero, realized saving or confirmed success. Even a favorable delta cannot claim causation or AI-attributed ROI. Restricted underlying content cannot be recovered by subtraction of public aggregates. Compatibility, coverage, units and limits must accompany the number.

Proof must use actual choice/projection outputs and demonstrate consumption in a review/meeting/memory consumer, not a fixture-shaped table alone. Dependencies include WP11 choices, WP03 canonical observed projection, WP10 state/host, and WP07 preserved review/export.

## T04 — dedupe, invalidation and replay

Pure policies distinguish signaled/resolved/changed-again. Same condition/version/cause event or repeated read produces one canonical signal. A distinct material change updates its reason; resolving and then breaking the condition reopens an attributable signal. Irrelevant changes remain silent. Consumer outages must preserve retry/replay identity rather than lose or duplicate signals.

Expose SignalDedupePolicy, InvalidationEnvelope, ProjectionContract and MemoryInvalidationPlan. The host performs physical persistence/cache/index/lease invalidation. A plan does not conflate stale with authorized. Required invalidators include principal/accessRevision/policyVersion, source version/incarnation, field dependencies, manifest, skill, boundary and replacing import.

At least one real My Work / decision desk / routine / BCS path must apply the policy. A pure dedupe unit test alone cannot prove actual consumer behavior. Revocation must remove restricted information from the consumer's signal, details and cache. Keep choice history separate from the current signal state and any current human justification.

## T05 — exact Atlas translation and ancestry

`mapSfAtlasEntry` and `deriveSfMemoryOwner` produce a closed Atlas entry from a real accepted case event or explicitly reviewed policy. Use real public boundary `memoryKindOf` and `validate`; no replicated validator and no cast hiding a mismatched template.

Task entry keys: taskId, attempted, failedWith, stoppedAt, lesson, ref. taskId is a real `sf-work:<caseId>:<analysisRunId|decisionEventId>`; attempted/failedWith/stoppedAt/lesson reflect actual case work, verified gaps and rationale. Ref is the opaque string `sf-evidence:v1:<bundleRefId>:<digest>`. Raw BusinessEvidenceRef objects and extra metadata keys are rejected.

Project entry keys: rule, scope, finite deterministic frecency, optional grounding. Only explicitly reviewed/versioned procedures become rules; personal preferences and unreviewed model instructions do not. No pr/logbook mapping, fake PR IDs, technical seats or fabricated StructRefs.

Case owner is `sf-case-v1:<sha256(installationId,projectId,caseId,caseIncarnation)>`; policy owner is `sf-policy-v1:<sha256(installationId,projectId,profileId,policyVersion)>`. Trusted scope determines these values; owner supplied by a model is rejected. Principal stays outside MemberId and outside the closed MemoryEntry. Same input gives the same projection digest, and a new incarnation changes owner/ref.

The external BusinessMemoryEnvelope must preserve complete evidence ancestry and field-level dependencies, source versions/incarnations, event/case identity, projection digest, writer principal, access revision and scanner receipt. Missing/unknown dependencies prevent admission. Nested calculation and case-event refs must retain all dependency ancestry so revoking any dependent field invalidates the memory; a flattened incomplete catalog is insufficient.

## Durable Atlas proof and limits

WP10.T07 owns `createSfBusinessContext`, `createSfAtlasMemory`, `createSfAtlasDurableMemory`, scanner, protected C08 state and the public Atlas package. The required route is real `createMemoryEmit` → snapshot-local synchronous append → awaited SF Persistence.transaction commit → new process/restart → authorized `createMemoryRead.recall` → actual consumer. Emit/append before transaction completion is not committed. Failed/cancelled/no-commit writes leave no new entry after restart. Lost responses and concurrent writes preserve idempotency and caps.

Protected storage is `Snapshot.data.__sfProductV1.atlas` on the existing dashboard surface, not a fourth surface or dashboard-derived cross-domain permission. Business export/import/audits, unrestricted snapshots, git/logs and revoked prompts must not disclose it.

Real scanner binary path/version is mandatory for native scanner proof. Clean, synthetic secret canary, timeout and absence must execute. Clean permits, hit refuses, unavailable/timeout/error returns scanner-unavailable and makes no append. Always-clean callbacks cannot qualify AM05. Synthetic authentication harness IDs may prove isolation, but must not be labeled real enterprise users; the native chain also requires existing authorized installation identity.

Package proof is WP10-owned: canonical generated business-memory-ports factories/types/validators/fold; scanner from native-memory; exact memory-emit.ts → ./scanner.js external edge; four generated digests; generate/check:generated/typecheck; AST and root check:spawn-imports with guards/allowlist unchanged. Missing scanner export is a WP10 finding, not permission to modify Atlas engines from WP14.

## Consumer and evidence matrix

| Path | Producer → consumer | Required observation |
| --- | --- | --- |
| Material C10 cost change | WP11/WP03 → WP14 T01 → WP01/WP08/WP09 | Correct before/after reason; original choice unchanged; repeat creates no extra item |
| Recall | WP10 real Atlas read → WP14 T02 → WP01/WP11/WP12/WP09 | Current authorized precedent, original source plus differences; revoked field suppresses all derivatives |
| Outcomes | WP11 original choice + C02 → WP14 T03 → WP07/WP12/WP01 | Original baseline/cutoff, compatibility and coverage kept in meeting/export/memory |
| Invalidation | WP14 T04 → WP10 BCS/cache/leases + WP08/WP09 | Fresh authorization, one actionable item per cause, resolution/reopen, replay after temporary outage |
| Atlas translation | WP14 T05 → WP10 emit/store/read | Closed validated task/project entry, complete nested ancestry, idempotent restart and actual read provenance |

All WP14 criteria bind E12; T05 and .40 integration criteria also bind E15/E16 and AM05. AM03 covers authorization/isolation; AM02 covers native/UI/MCP operation parity. AM01 memory skill witnesses and AM06 routine consumption remain distinct integrated obligations; a scoped green cannot silently promote them.

## Check and delivery rules

Use only GitHub MCP for remote operations. Product tests run only in GitHub Actions and are scoped to changed product and transitive consumers, no local test and no epic per WP. Read validators/workflow on the actual candidate. Commit product W first, construct S as a direct child changing only `.ci-run.json`, create the unique `ci-run-linux-astra-wp14-...` ref at S only after the request exists, and allow at most one WP14 test run in flight. Search equivalent runs before dispatch.

Record W/tree and S separately, normalized request hash, run/attempt/jobs/artifacts, actual selected tests, and omni positive control pass/not applicable. Failed/cancelled/empty/mismatched/no-artifact results are not PASS. Run package `bun typecheck`, never tsc, and root `bun run check:guards --base origin/dev` with real base. CI.md permits an explicitly scoped hosted check workflow when local execution is unavailable, using existing pinned actions and no deployment.

Final PR targets sf2-stack, with exact published head/tree, incoming source pins and all 91 criteria mapped to expected/observed evidence or precise missing proof. Persist receipts append-only at new paths; never relabel old evidence with new candidate SHA. S0 owns final composition/review/merge and global eight-selection/AM01–AM06 acceptance. A PR or scoped test result is not full memory/native approval.
