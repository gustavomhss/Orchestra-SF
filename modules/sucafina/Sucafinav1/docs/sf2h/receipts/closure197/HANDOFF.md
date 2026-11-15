# Mission 197 — AM03/AM04 Native Closure Handoff

**Authority:** `native-closure-e1-browser197`, branch `sf-proof-authority`; accepted initial SHA `5e32f2ad8dfc9d71e165e348769d9203fff91add`. Canonical planning `dbf9547211d9b0fade619790de7c19c0869b7c7d`; UX normative `cbac654784714f68779ae1434d30e6ea8970c4d1`; integrated product base `6607c60d2a2be183d59c2e929b3ff06633e1cb54`. The S0-FENCE was inspected at blob `8ea145e2a38c2320f9fd2912af2ff61d3b437966`; ACK published at `4e5c62b0cafe71fb76e1a41a163e4359a53b05e6`. Previous missions 167/168 relinquished **future writes on these namespaces**, not their historical work. No reset or force.

## Published implementation

Three **new functional test drivers** complement, rather than replace, the integrated AM03 provider-generation/correlation and AM04 trace gate. They reuse original production composition and durable receipts:

| New file (relative to Sucafinav1) | Preimage at reserved HEAD | Immutable postimage blob |
|---|---|---|
| `test/product/integrated-proofs/am03/functional-boundaries.test.ts` | absent | `530b1d6618218f11cefa699e3e6def1bd8f96270` |
| `test/product/integrated-proofs/am04/domain-recovery-functional.test.ts` | absent | `1fbabb2be4bd2540f1f280cf432630e6dd3f486d` |
| `test/product/integrated-proofs/am04/receipt-key-collision.test.ts` | absent | `4a7100ca6d4a3c109924674fc6d6ae8c4e79aee0` |
| `docs/sf2h/receipts/closure197/ACK.json` | absent | `fb38703b02df10990049adf865bf2da66ab0de8f` |

Code commits: `c7fcb0e462b509fcd1c0c35de6a4fdb241572de1` and `de007eca612e3a6a0b084b3d09229529d74ef7a4`. Nothing in integrated product, SDK generated files, Actions, engines, native desktop/server, infrastructure, allowlists or guards was written. Correlators not duplicated or altered.

### AM03 — direct authority, discovery/execution and search/detail

The new public tool proof composes real `SessionV2`, `SkillV2`, registered `sf_finance` profile and `sf-explicar-forecast` instructions, `ToolRegistry.materialize/settle`, actual private MCP dispatch, actor-scoped Planner evidence and SQLite. Two distinct actors/sessions bind the same profile and use different source refs. Direct native lease attempts alter case ID, case incarnation/version, installation, host, project, location, run ID, native session, principal, policy, access revision, manifest digest, profile ID/version and provider generation, plus wrong agent/role and ungranted operation; access must fail before any business output. Actor A is revoked **after discovery but before first execution**; actor B can still execute. Provider generation is invalidated and rollback is refused; a fresh authenticated Request + Session + actual loaded skill is required for subsequent execution. The independent source proof issues a real actor-specific source, checks cross-principal detail rejection, then revokes authority before detail access. Neither creates a fabricated model turn or a corporate grant.

These cover component paths only. Installed memory/prompt, BI, report/link search→detail; provider **object/homonym** hot swap; real process/session restart; separate corporate installation and project; and multiple real grant scopes are **not attested**. The requested installed fixture, activation and supported actions are specified exactly in `CI-REQUESTS.json`. Existing real lifecycle and source tests are retained and selected for the dispatcher. The absence of installed providers is not converted into fabricated PASS.

### AM04 — real command, fault, receipt and replay

The HTTP driver calls the actual domain `Procurement Requests.save` (`PR-1`, `estAmount` 100→150), with real human `decision-review` / `decision-apply` via configured fixture grants. It hooks the existing persistence boundary **after** the atomic Procurement + raw CommandReceipt `transactionAll` commit and **before** the HTTP handler/case reconciliation; the first response is expected unavailable. It verifies one physical history entry and original receipt while the DecisionCase remains planned/unlinked, refuses a changed review proof with the reused public request key, tears down the SQLite-backed service and genuinely reopens the same directory with a new composition, recovers the original receipt, links the case, retries the same recover command and rejects a subsequently revoked principal. The receipt is observed from the durable store, never injected.

The second driver begins with a successful real HTTP application and reads the canonical `receiptProofTransactionKey` persisted by the original production path. It uses the *same* authorized state port and exact namespace/domain/CAS identity to prove identical `idempotencyKey` + review-bound command digest replays the actual committed receipt **without entering the mutation callback**, and a changed digest with the same key returns `idempotency-content-changed`. This is a storage/receipt proof, not a second simulated domain command. Per-domain mixed success/conflict and partial state is covered by the pre-existing real `wp11/cross-domain-execution.test.ts` and the existing C12 recovery browser tests, selected for CI; there is no assertion of global transaction.

This component fixture uses deterministic `alice`/`bob` Request authorization, not actual corporate identity; typed decision setup is persisted, **not generated by a model**. Full installed AM04 requires a genuine model preparatory run/receipt and supported installed postcommit injection; it remains unproven until 191 consumes hosted evidence.

## Criteria and owners

- AM03: E11/E12/E15/E16, WP10.T06/WP10.T07, S0-A/S0-B; assigned WP06/WP06.T05, WP12/WP12.T01/WP12.T02, WP10/WP10.T06/WP10.T03 as packet 197 (each DOD/INV/QLT/CMP/SUC and task CHK where specified).
- AM04: E10/E16, WP11.T03/WP11.T04/WP10.T01, S4-A/S0; assigned WP10/WP10.T03 as packet 197. Neither AM is changed from `NOT_RUN` or promoted to acceptance by creation of these tests.
- 189 remains sole writer of `sf2-stack` (PR #65) and consumer of this PR; 190 owns compiler; **191** (PR #106) alone dispatches surgical CI. Fixture 199 owns real installation and missing external inputs. 194/195 own U15/U39/U40 and are untouched. All broader and final eight selections wait for accepted bundle C.

## Evidence classification, blockers, next actions

**Obtained:** GitHub read of current product/AGENTS/planning/packs, S0-FENCE, verified original branch HEAD; immutable test blobs and three CAS-published commits including ACK. `S0-FENCE` unchanged. No tests have been executed; no logs, run IDs, browser captures, model outcomes or installed receipts were obtained. **NOT_RUN:** all three new suites, retained lifecycle/partial/browser selectors, installed AM03/AM04; typecheck/build/validators; any CI workflow; native model invocation and service restart. No claims of PASS or integrated release. Runtime model/session ID not exposed. Assistant effective model: GPT-6. `native_goal=paused`, `GLOBAL_RELEASE=false`.

**External prerequisites, not invented:** actual installed host URL/installation/project/location identifiers, two legitimately authorized principal/grant bindings and case refs, supported access-revision/revocation action, active provider identity + generation + supported object replacement and restart action, native Task/session/skill receipts; for AM04 additionally the model-provided prepared choice, human authorization and installed postcommit fault boundary. This session has no permission to create these corporate grants, expose credentials, restart hosts or edit infra. Full nonsecret requirements are enumerated in the machine-readable request, owner 199.

**Causal defects outside write paths:** none verified; tests were intentionally not run, so no unsupported bug or patch is presented as fact. Any genuine 191 failure must return its exact failing input, tool/handler trace and preimage to 189 for a complete inert pre/post patch before owner-authorized integration. Do not extrapolate a generic refactor. No source patch was applied outside the allowlist.

**191 next:** reconcile your queue/runs, dispatch the exact new file selectors + selected retained C12/WP11/browser paths on immutable code SHA `de007eca612e3a6a0b084b3d09229529d74ef7a4`; consume cases, authorized and denied receipts, real writes, snapshots, and any explicit installed fixture gap. Do not launch overlapping CI or mark proof PASS based only on this record. **189 next:** inspect this mission PR, preserve all unrelated changes, then integrate only with normal owner/fence authority once relevant checks are accepted. Comments to PR65/PR106 are notifications, **not ACK** nor chat wake.

`CI-REQUESTS.json` is authoritative for file selectors, checks, exact input/effect/receipt expectations, external prerequisites, and ownership.
