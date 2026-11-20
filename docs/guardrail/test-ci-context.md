# Surgical SF guard approval context

The SF surgical runner can carry a real protected-paths approval from its source PR. The request itself cannot grant approval, change the canonical guard base, name an approving PR, or supply API credentials.

## Source identity

This channel applies only to Bun requests for package sucafina at modules/sucafina, pushed to a supported ci-run-linux-* snapshot in gustavomhss/Orchestra-SF.

The read-only GitHub API must establish all of the following:

1. The snapshot has exactly one parent.
2. The parent-to-snapshot comparison contains exactly one new commit and exactly one changed file: .ci-run.json. Its blob must match the raw request bytes read from the checked-out snapshot, before request normalization. Uploaded source, test, workflow, waiver, or other code changes make the channel unavailable.
3. Exactly one source PR has that parent as its current head. Its head and base repositories must be this repository, and its base must be sf-join-four.
4. The PR is open, ready for review, and unmerged. Its source branch and target branch refs must still match the head and base SHA returned by GitHub.

A source commit's association with an older or already merged PR is insufficient. A draft PR, fork, stale source head, ambiguous source PR, different target, or additional snapshot code delta receives no approval.

## Approval authority

The PR must currently carry guardrail-approved or guardrail-approved:protected-paths. The latest matching label event must be a labeled event, with its original actor returned by GitHub. The actor must be a human account that currently has write, maintain, or admin permission. A reviewer who authored the PR cannot approve it through this channel; the repository's user owner may make the owner's own decision.

The resolver reads the PR, refs, label history, and collaborator permission again before returning approval. Pagination must complete; missing permissions, API errors, malformed evidence, a revoked label, or changed authority leave approval empty.

This preserves the existing SF policy of a current approval label on the current PR. It does not infer approval freshness from author-controlled commit timestamps or claim that a historical label reviewed a particular later commit. The decision records the exact source head it observed and the label event it used. These are point-in-time API observations, not a transaction locking GitHub against subsequent changes.

Only protected-paths can be transmitted. Other approval labels do not grant other rules. No label is applied by this workflow, and no approval is taken from the request environment, PR text, commit messages, or historic PRs.

## Guards and evidence

For an admitted context the workflow retains the canonical origin/dev guard and adds an independent check against the actual source PR base SHA. Both commands must exit zero; no warn mode or assertion change is used. The existing static tests retain their own dev check. History is fetched so the engine can resolve the real merge-base.

The Run tests step receives an empty GUARDRAIL_APPROVED value unless the resolver admitted the context. Unapproved ordinary tests can still run, while tests that require protected-paths clearance remain red.

The test-ci-guard-context artifact contains minimized guard-context.json plus the two guard logs when those commands ran. It contains no token or raw API response. A negative context does not constitute guard approval, and unit-test API fixtures do not constitute real owner approval.

The token remains read-only: contents and pull-requests read permissions. If the token cannot read an approver's collaborator permission or label history, the resolver refuses the context. It does not request a stronger token or fall back to a claimed authority.

## Qualification

The focused regressions are packages/core/test/test-ci-guard-context.test.ts together with the existing packages/core/test/test-ci-request.test.ts. They cover identity, additional code deltas, request authority injection, stale or foreign PRs, labels, actor permission, self-approval, concurrent changes, pagination, API failures, and workflow wiring.

A positive live approval path must be exercised only after a real owner or eligible reviewer makes the approval decision on the concrete source PR. Publishing this code or passing its synthetic API regression tests supplies no such decision.
