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

### Separate binding admission from source permissions

After stable Requests allowed the original port tests to continue, the focused
17-case run on `3cf615be425b6acccb967be4741a91ad3be71da5` reached three later
assertions. Two expected domain access refusal but received binding refusal;
the source-egress case saw an empty binding-check batch after its source batch.
The same optional read-access contract and fallback already exist in product
`094d891`, at `product/reviews/port.ts:48,142,146,178`. The baseline control
stopped earlier, so these later signatures were observed on 3cf, not executed
by that baseline run.

The fixture now supplies `revalidateReadAccess` explicitly. Its original
controlled binding must be the exact captured object and its Request must be
live. In the first test, additional download contexts must pass the real
`authority.revalidate` already composed in that test. Before composition, or
for an unknown context, that route refuses. It does not return a blanket grant
or accept a principal-shaped object.

All source `revalidate(context, refs)` callbacks and permission flags remain
unchanged. The distinction prevents a domain refusal from masquerading as a
binding refusal and prevents binding checks from being counted as source
batches. No batches are filtered, no source observation is skipped, and no
Expected value or runtime fence changes. The original forged-binding control
and the positive download admission remain in the full file.

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

The first fixture candidate `3cf615be425b6acccb967be4741a91ad3be71da5`
was cold-reviewed and qualified once:

- Focused run [44674313577](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44674313577),
  job `136082381229`, cleanup `136083032411` success:
  **14 pass / 3 fail / 302 expectations / 57.54 s**. Snapshot
  `14f70283796ea8e35475a0f495b44965f265e321`, tree
  `9f94391b9dd3f5e8d290b2e48c62e1c948cea064`, request
  `2e05f15f97174edca2905e3d16150c2341cc3e13`; direct product child,
  request-only, both complete files, attempt 1.
- The original C05 scenario passed in 50.77388 s, including the recipient
  refusal, both commit revocation races, the actual historical reply and
  revokeAfterFirstRead. Both C05 provider-swap cases also passed.
- The three remaining failures were `review-port.test.ts:187` and `:296`
  (Expected access-unavailable; Received binding-unavailable) and `:351`
  (Expected last batch to contain overview; Received an empty array).
  These are the signatures addressed by the explicit admission setup above.
- Sucafina compiler run
  [44674320660](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44674320660),
  job `136082404485`, cleanup `136082954976` success:
  **1 pass / 0 fail / 0 skip / 36.272607558 s**. Snapshot
  `047a760277c249580712fa3020031168df5fd83d`, tree
  `afc0554d06cb894f83cbcf2d02b58ccfb15d9ea9`, request
  `e359ff4033d50207f9770b1838b3667a6453321e`, harness
  `9090eb4bb96a7d6ada9082d9a604820fc141b1f9`. The harness ran the real
  `bun run typecheck`, kept all three assertions and printed the exact
  3cf product marker; no TypeScript diagnostic appeared.

Qualification of this follow-up admission setup is **pending** cold review
and explicit authorization. The historical B45, baseline control17 and
first fixture qualification remain separate results. The next focused gate
is the complete original review-port file (14 cases) and Sucafina compiler.
The C05 helper, thread file, production, shared WP08 fixtures, CLI and Portfolio
are unchanged; their already green focused checks are not repeated here.

The union's already observed C16 full Portfolio run `44671870082`
(job `136074464698`) remains 16 / 0 / 474 expectations / 299.34 s.
Union compiler run `44671896565` (job `136074547008`) remains 2 / 0.
Neither is execution evidence for the new fixture-only candidate.
No nominal Reports or sf-ci run is included here.
