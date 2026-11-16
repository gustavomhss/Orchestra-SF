# Orchestra-SF — CI-only campaign, evidence and ownership

**Scope:** this document closes **CI/test infrastructure classification**, not product go-live. Product code, Task, Permission, Relay, issuer, draft guards and financial policies are untouched by the CI campaign. This is an isolated PR against `close-final-candidate`.

## Platform / qualification contract

- Production target: Azure **Linux x86_64**, web + actual Linux host runtime.
- No Windows or macOS runners, binary distribution, desktop packaging, native guest, or multiplatform matrix is required by `sf-ci.yml`.
- A **full green** still requires all eight declared CI suite families and static/Omni; a failed suite never becomes a green receipt. `sf/verify` must remain red when any suite or proof is missing.
- AM01–AM06, real Azure activation, authenticated origin, persistence, rollback and independent reviewers are external **release obligations**, and are **not** asserted by a green unit or preflight check.
- CI-CLI and CI-ATLAS-BUSINESS selections are declared in one file (`sf/ci/suites.json`) and executed from that manifest rather than a second, drifting YAML list.
- Linux-only `test-ci` selector contract is tested in the independent preflight, so a TypeScript error in the product cannot hide an untested CI selector.
- The generic repo `AGENTS.md` is deliberately unchanged from the PR base, to avoid altering protected policy to document a fork-specific OS decision. The new SF contract and enforced request parser remain the source of truth for this pilot.

## Observed evidence (do not transpose to another SHA)

Source: GitHub Actions run [43951326271](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43951326271), candidate PR head `2b386661a5b389958e93a8f5dd54d44c5d746c09`. A pull-request run tests an observed merge ref; exact run / head / receipt identities must be preserved.

| Job | Observed class | Grounded observation | CI action |
|---|---|---|---|
| sf/preflight | HARNESS_PASS | Node gate negative tests passed | Keep as independent gate |
| sf/linux-native-omni | HARNESS_PASS | Ubuntu x64 native Omni binaries available | Keep, never replace with mocked native |
| CI-APP-SRC | PRODUCT_TEST_PASS | The tested app source selection completed successfully | Keep |
| CI-CLI | PRODUCT_TEST_PASS | Installed SF host, authority and service tests passed | Keep explicit Linux scope |
| CI-ATLAS-BUSINESS | PRODUCT_TEST_PASS | Business memory/Atlas boundary selection passed | Keep generated check separate |
| sf/static-and-contracts | PRODUCT_RED + CI_POLICY | TypeScript TS2322 at `packages/app-shell/src/orchestra/chapters/sucafina/planner/overview/index.tsx:331`; guard blocked changed `AGENTS.md` | Product owner resolves TS; CI-only PR restores protected AGENTS to original blob; guard stays enforced |
| CI-SF | PRODUCT_RED + ENVIRONMENT_BLOCKED | Business browser/chart assertions fail; `test/parity-pitr.test.ts` requires real Litestream executable for macOS local continuity | Do not fabricate Litestream; assign Linux Azure backup/restore obligation to release owner, do not count this proof PASS |
| CI-APP-BROWSER | PRODUCT_RED + ENVIRONMENT_BLOCKED | Native transport catalog / Sourcing draft assertions red; Q01 `readNativeManifest()` demands a real F04 installed manifest bound to candidate | Keep red; live installed manifest proof belongs with installed-host acceptance, not synthetic unit fixtures |
| CI-UI-OPERATIONS | PRODUCT_RED | Two UI assertions rejected the observed product | Product owner, never weaken expected result |
| CI-UI-DECISIONS | PRODUCT_RED | UI state/recovery and response consumption assertions failed | Product owner, no retry/skip workaround |
| CI-UI-REPORTS | PENDING_AT_OBSERVATION | The live Reports journey had not completed when the run was inspected | Do not infer PASS / FAIL |
| sf/verify | NOT_GREEN | Any missing/failed/blocked suite or step must keep aggregate RED | No bypass, no required-check promotion |

**Categories are diagnostic, not green statuses.** `HARNESS_PASS` does not mean `PRODUCT_PASS`, `CI_READY_TO_PROMOTE` or `GO_LIVE`. `ENVIRONMENT_BLOCKED` is an unsatisfied obligation, **not** a waived check.

## Why this was consuming so much CI

The former Epic attempted full upstream Core and multi-OS matrices; the SF-specific pilot reduces the intended topology to 12 jobs including the final verifier. After the first product failures, Bun selected Sucafina tests stop at five failures, SF browser tests stop at five, and Playwright journeys at two. A fully passing run still executes every selected case: this is **fail-early, not skip**.

The current test layout still mixes true installed-app tests and macOS-local acceptance fixtures with portable Bun unit tests. The new CI is honest about this: it flags missing Litestream / F04 live manifest as environment blockers. Removing them silently would invalidate the product acceptance. The Linux Azure architecture must provide equivalent release proofs or the product remains RED.

## Follow-up: required unit vs. release-only boundaries

**Change under validation:** `CI-SF` continues testing its complete Linux-appropriate
Sucafina unit tree except the original `parity-pitr.test.ts` for macOS
local-operator Litestream. The excluded test remains in the repository and
is recorded as `releaseOnlyFiles`. Actual Azure backup and restore is a
**separate unsatisfied production requirement**, not PASS-by-exclusion.

`CI-APP-BROWSER` continues selecting the whole `sucafina-native` directory
except `transport-integration.test.ts`, which requires the installed F04
manifest bound to real authorized sessions. Its exact test file remains
in the repository and the release workflow checks its presence while
remaining explicitly BLOCKED. No fake host, identity, credentials or
synthetic green status is introduced.

The runner builds ignore arguments only from the **validated, exact paths**
in `sf/ci/suites.json`. Deletion, widening or renaming the release-owned
files fails the manifest gate; documentation alone cannot waive them.
These two cases are **not counted among tests passed by the PR**. Their
Azure/live counterparts must be exercised before `GLOBAL_RELEASE`.

The revised `sf/verify` prechecks all upstream job conclusions before
downloading any suite evidence. A failed product job results in a
specific fail-closed diagnosis, never an artifact failure mistaken for
a product error. The unit gate may become green while the separate
`sf-release` remains BLOCKED; this is intended evidence separation.

## Acceptance for this CI-specific PR

1. The isolated PR HEAD passes **harness self-tests**, with Linux-only platform admission and no duplicate automatic runs.
2. Actual CLI/Atlas selected files come from the canonical manifest; zero selections and mismatches are rejected.
3. Bun/Playwright produce truthful test results and no PASS receipt after failure, cancellation, skipped cases, missing artifact, wrong SHA, unknown runner or incomplete coverage. Sanitized Playwright receipts never carry sensitive runtime traces.
4. Repository guards run even when product TypeScript fails; **protected policy is unchanged in the PR**, with no self-approved guard exception.
5. Every failed suite is classified with reproducible owner and environment prerequisites; classification cannot lower `sf/verify`.
6. An independent reviewer assesses CI coverage equivalence and guardrails before required-check migration. The legacy Epic stays enabled and no Azure deployment is attempted by this PR.

**Current release disposition: BLOCKED.** Keep the draft PR open until the above checks are independently validated. A green CI-harness validation is an engineering result; live Azure readiness and AM01–AM06 are separate obligations.
