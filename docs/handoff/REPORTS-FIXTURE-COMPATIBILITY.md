# Reports — original fixture compatibility

## Scope and causal control

This candidate is based on product `a68031a56c9472b6777a8842d98e9f159c7dfa4b`
(tree `f19ade0eecd02ffdceac8ca3d577b04e762a55a6`). It changes only the two
original WP07 test setups, a focused test helper and this document. Production,
shared WP08 fixtures, assertions, budgets, requests and workflows are unchanged.

The unfiltered B suite actually contains **45 tests**, not the earlier estimate
of 43. Run [44671868001](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44671868001),
job `136074458045`, produced 41 pass / 4 fail / 496 expectations / 369.74 s on
snapshot `3f387279af05432a526573b054e269d38b17e539`.

A single authorized control of both affected files on the previous product
`094d8919819dcbad73dc6d7f02ef7b8dd4faefd4` reproduced exactly those four signatures:
run [44673170663](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44673170663),
job `136078668651`, cleanup `136079106866` success; 13 pass / 4 fail /
208 expectations / 14.66 s, attempt 1. Snapshot
`082847860bb251cde317f461aec6d571321aa66d` is a direct child of that product,
tree `5ae879962a50c8e8b510b08960de13d6e1083a59`, with only
`.ci-run.json` (blob `2e05f15f97174edca2905e3d16150c2341cc3e13`).
The control retained both whole files, `--timeout 30000` and OMNI=1.
No status/signature divergence was observed.

| Original file and line | Signature on both products | Cause |
| --- | --- | --- |
| `test/product/wp07/review-port.test.ts:79` | Expected ok; received denied | Each requestFor invocation constructed a different Request. |
| `test/product/wp07/review-port.test.ts:238` | binding-unavailable | Same missing stable Request during preserved receipt reopening. |
| `test/product/wp07/review-port.test.ts:340` | Expected ok; received denied | Same missing stable Request before body authorization. |
| `test/product/wp07/review-thread-context.test.ts:151` | unavailable: review-thread-source-fence-unavailable | Reply egress requires a self-recipient lease; the fixture omitted reviewRecipientAuthority. |

Paths in that table are relative to `modules/sucafina/Sucafinav1/`.
The exact Request equality check exists unchanged in both product versions.
The recipient path is also unchanged: `product/collaboration/recipient-actions.ts:67`
requests `requireSelfLease=true`; `authority.ts:69,73–76` consequently requires
the real provider. The two provider-replacement negatives passed in both runs.
This identifies fixture incompatibilities inherited by the union, not evidence
that the original tests or runtime fences should be weakened.

## Changes and preserved boundaries

### Stable Request mapping in three port setups

`test/product/wp07/review-port.test.ts` now gives the first test a local
WeakMap from TrustedDomainContext to one Request, used only by its three
review ports. The same test later exercises a real UI download admission with
a different context; that context gets its own stable Request. The mapping
contains no authorization, review body, result or grant.

The receipt/restart test and the source-egress test each capture one Request
for their one original binding. Their domain projections and authentication
remain the original declared fixture boundaries. Artifact storage's requestFor,
the download handler, the negative fixtures and the production identity fence
are unchanged.

### Real self-recipient authority for the original C05 thread test

The new `test/product/wp07/review-thread-recipient-fixture.ts` implements the
existing real protocol from `test/product/wp08/review-answers-fixture.ts:31–59`.
The shared WP08 file remains byte-identical. The helper accepts only `person`
mapped to the fixture's actually admitted `f.author`; it does not grant
`reader-b` or substitute a new Request.

Preparation revalidates the admitted recipient, authorizes the immutable C05
pin through the real threadContext, reads the real review, compares its digest,
collects every captured record reference, prepares real historical source
proofs and executes every fence in a real `transactionAll` with `commit:false`.
Only after those observations and another current ACL/host check does it retain
a private lease keyed by recipient, complete basis and caller binding.

The synchronous commit check requires that lease, current `access.review`,
the enabled actor and access revision, the actor digest, the complete protected
source snapshot fingerprint and the actual stored review digest. It performs
no asynchronous authorization and does not fabricate a grant. Review ACL and
the principal directory remain explicit fixture boundaries, as in WP08;
this component composition is not an installed/native-host witness.

The first thread setup supplies this helper and publishes the existing
Review services to it after composition. Its original
`authorizeReviewThreadContext`, `prepareReviewThreadFence`,
`revokeAfterFirstRead`, `reader-b` rejection and both transaction-entry
revocation races are unchanged. No original test body was replaced.

## Assertion and qualification ledger

The 146 original expect/matcher lines in review-port and all 72 in
review-thread-context are retained literally: **218 / 218**. The other test
bodies in both files remain unchanged. There is no new timeout, retry,
test-name filter, waiver, grant stub, production flag or workflow modification.

Qualification of this fixture-only candidate is **pending** cold review and
explicit authorization. The candidate does not turn the historical B45 or
control17 results green. Their exact red results remain recorded above.
A future focused qualification must run both complete affected files and
compile the new helper; do not repeat unrelated green suites automatically.

The union's already observed C16 full Portfolio run `44671870082`
(job `136074464698`) remains 16 / 0 / 474 expectations / 299.34 s.
Union compiler run `44671896565` (job `136074547008`) remains 2 / 0.
Neither is execution evidence for the new fixture-only candidate.
No nominal Reports or sf-ci run is included here.
