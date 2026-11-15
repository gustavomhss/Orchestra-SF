# Mission52 — independent review of nominal10 teardown correction

**Verdict: PASS static, no blocking issue identified.** This is a source and identity review, not runtime qualification.

The two proposals change only owned E2E helpers. Their complete patches exactly reconstruct the supplied postimages from immutable W812d preimages. All 2 closure assertions and all 27 journey assertion lines are unchanged. The five nominal test identities, 180000 ms budgets, zero retries, the choice caller and the shared WP03 installation fixture remain unchanged.

## Response interception

A matching original POST failure before its response is paused now rejects `completed`. The unchanged caller's `Promise.all` can therefore exit through its existing finally. The handler sets `responsePaused` before its first await, so the intended `Fetch.failRequest` after reading the original response does not incorrectly reject success. The existing URL/method assertions and all response and payload acceptance checks remain authoritative. The patch does not issue a replacement request or supply a synthetic response.

Page closure also rejects completion. Cleanup is memoized, removes only listeners owned by this helper and attempts CDP detach in a finally. A session that is already closed may still cause cleanup to replace the original error text; it cannot turn failure into acceptance.

## Installation ownership and timeout cleanup

The unchanged five tests pass their actual TestInfo to `withInstallation`. The WeakMap retains only the returned stop closure for that TestInfo. The body finally and runner afterEach await the same memoized promise. Concurrent calls do not duplicate stop, and a normally completed stop removes the map entry before the hook's no-op. The hook does not search for, borrow or kill another service.

The existing fixture stop remains responsible for its captured child, existing exit and port-release assertions, sanitized CLI attachment and temporary directory cleanup. The patch neither changes that implementation nor any timeout. Startup that has not returned remains the fixture's existing cleanup responsibility.

## Evidence boundary and choice pipeline

Nominal10 contains screenshot/video/error-context attachments, with no observations or CLI log from body finally. It does not prove a choice HTTP status, payload, network-failure event, producer duration or persisted outcome. The static unresolved-promise path is compatible with its timeout and later port collision, but that is not proof of the actual event sequence.

The canonical choice path performs authorization/replay/confirmation, loads the case, compares, reads both stored histories, resolves rule and metric values, constructs a choice snapshot, then commits through the fenced C08 mutation and outbox. The installed comparison and value resolution use separate finished read snapshots. `withCase` binds private selection rather than holding a transaction around saveCase. No inevitable read-scope/write conflict or nominal refusal was identified. Work count alone is not latency evidence.

A later run must establish the actual choice response and finish the four independent journeys. This review transfers no PASS to nominal10, and does not change financial approval policy, C12 or CurrentChoice.

## packages/app-shell/e2e/sucafina/decisions-support/closure-response.ts

- Preimage: `fa509e9d7a7da9d0024c9487975f7b26b3b29146`.
- Postimage: `e1c78c9311d9af5df81191acc490b9574421ad3d`.
- Material SHA256: `30904f9cf80eaa8097bdb42db87c19193d336546567d36e6a60b31ab5d020305`.
- Complete patch SHA256: `ebbb55358858669d787d25c1531e74722f21fdab70fc26dd91781b4c9d9486b7`.

## packages/app-shell/e2e/sucafina/decisions-support/journey.ts

- Preimage: `3f548f0afdbb2d0c17c3cf9f0c3d4dd63b25f2b2`.
- Postimage: `e5a510068cc16a41b29446524b4c7870c98568c5`.
- Material SHA256: `2fda11837974fea357e14c79d4eeae8c0c370175d06c77b0d0df291875e59c09`.
- Complete patch SHA256: `6dba4f9145fa01820da747c9a4daeddbed42fdee9b440626788bbafd222c76e7`.
