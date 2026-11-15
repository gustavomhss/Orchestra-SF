# 121 — Creation/recovery proof repair handoff

**Authority / intake:** `creation-proof-repair-e1-browser121` on branch `creation-proof-repair`, PR [#117](https://github.com/gustavomhss/Orchestra-SF/pull/117). Only integrator **114/PR65** may compose this patch into `sf2-stack`; no direct merge by 121. The Goal remains paused.

## Source and exact changes

- Immutable C58 base `422f1ed7b549021d7c62c834c9d9041279112af4`, tree `647b024075265fc76d6253c99bec00a82618f816`.
- Pre-edit remote ACK `57ff988230109506ed1ddcf6fb077a0cec254b60`; material source `1091aa090f9e401ece1b52b2aa74138560d04c88`, tree `d65bb675029dce47be41c189f69eb5c8028ad4f5`.
- Three scoped test files changed, **zero** source-product, shared registries, workflow or lifecycle/pool changes. Existing 96/111 authored preimage blobs match PR103/PR109 at their given heads.
- [Exact pre/post blob manifest](SOURCE-VERIFICATION121.json) and [complete unified patch](FULL-PATCH121.patch); source commit itself is also a complete, immutable Git delta.

### Type and trust boundaries

1. Every `createDecisionCasePort` host `requestFor`, `revalidate`, `operationIdentity`, `authorizeCase` and `verifyScenarioOperations` callback uses the actual `TrustedDomainContext.kind` discriminator. Only `kind === "ui"` can enter a `createSfUiAuthority` method. Native contexts receive `undefined`/denial; no fake lease, cast or allow-all fallback.
2. `creation-browser.test.ts` constrains the UI's allowed operations to `sf_case_read` and `sf_case_draft`, guards the possibly unavailable runtime and decodes the untrusted POST JSON through `decodeSfOperationInput`, replacing the unsafe `typeof runtime.cases.draft` assertion. The persisted operation, digest, principal and recovery path stay real.
3. Removed two now-unnecessary optional-method type casts only after confirming C58's actual case-port exports `recoverCreation`. Kept their **runtime assertions**, all original test cases, `expect` statements, 180s timeouts, no-repost, actor isolation, revocation and incarnation checks intact.

## CI and ownership routing

- 120 receives [the exact surgical request](CI-REQUEST121.json), posted to [PR106](https://github.com/gustavomhss/Orchestra-SF/pull/106#issuecomment-6896953498). Browser order must be `wp01/browser-startup` → `96/creation-browser` → `111/recovery-browser` → `wp01/browser-lifecycle` in **one** Linux/Bun invocation; separate HTTP selection includes both `creation-correlation` and `recovery-http`. Deduplicate on actual composed candidate/tree, config/fixture/OS and exact named order before new dispatch.
- C54 [run 43724652351](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43724652351), job `132843876161`, ended the pool with lifecycle **before** consumers. Later sealed-pool failure is invalid test ordering, **not** evidence of product creation failure. Never change pool or weaken its oracle to manufacture green.
- 119 receives [compiler verification request](https://github.com/gustavomhss/Orchestra-SF/pull/107#issuecomment-6896953961), baseline C58 [run 43726143757](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43726143757)/job `132848377567`, artifact `14166956181`. Mission's target is 16 diagnostics; that visible job log returned 10 exact matching diagnostics for the scoped files. **A new hosted check is required** to state post-fix number; no local test/typecheck occurred.
- 114 was [informed for intake](https://github.com/gustavomhss/Orchestra-SF/pull/65#issuecomment-6896954375). 112/113 remain independent reviewers; writer 121 did not assume the integration lease.

## Gate status

**Source: READY_FOR_114_INTAKE.** The exact patch and post-blobs are published and reread remotely. **Typecheck: PENDING 119. Product CI: PENDING 120.** No W/S/run/job exists for this post-fix patch at handoff, and historical 116–118 successes cannot be transferred. If the corrected selection reproduces an actual product bug, route an exact complete patch to the authorized producer/114; don't edit HTTP52, pool or unleased product sources.

No local tests, standalone dispatcher, changed policy, merge into `sf2-stack` or `dev`, force push, deployment, Azure or native Goal reactivation. `GLOBAL_RELEASE=false`.
