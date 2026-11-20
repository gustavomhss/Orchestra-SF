# Static C05 thread-create triage after nominal 44675679976

## Scope and provenance

Read-only analysis of product `6c6303f5a52cd6123762f8875b33822ba28e1ed8`.
No product patch, new test, compiler, browser run or sf-ci was performed.
This document is not a runtime profile and does not authorize a rerun.

Observed evidence is preserved in
[REPORTS-NOMINAL-44675679976.json](REPORTS-NOMINAL-44675679976.json) and
[REPORTS-UI-44675679976.json](REPORTS-UI-44675679976.json).
The two read-only artifact jobs were `136097709971` / run `44679031600`
and `136101790707` / run `44680294301`; both passed 1/0.
The nominal itself remains 1 pass / 3 timeouts.

RPT-02 and RPT-04 both reached a retained question intent and the recoverable
missing-response UI. Their create waiters observe any matching HTTP response
before the later status assertion, yet remained unresolved. The UI's context
and storage preflights precede intent creation, so this is not a pre-intent
failure or an ignored busy click. Neither retained artifact proves receipt
or commit at the server.

## Original Request and HTTP boundary

| Stage | Exact path and lines | Contract |
| --- | --- | --- |
| Original Request scope | `apps/cli/src/sucafina-product/host-context.ts:1021-1027` | Existing collaboration handler runs inside Review readScope for the same original Request. |
| Route | `modules/sucafina/Sucafinav1/product/collaboration/http-routes.ts:42` | thread-create maps to host.threads.create with human action collaboration.thread.create. |
| Admission | `product/collaboration/http.ts:21-64` | Origin/method/payload/size, live request, human admission and review-binding revision are checked before invoke. |
| Response | `product/collaboration/http.ts:65-70,75-76` | The handler awaits the complete port operation, then checks cancellation and emits the result. It finishes the admitted context in finally. |
| Client deadline | `product/reviews/collaboration-client.ts:59-78` | Existing 30000 ms abort timer; absent response or aborted controller produces the observed recoverable message. |
| UI intent | `product/reviews/collaboration-view.ts:65-95,224-241,374-393` | Context and mutation preflights precede retained intent; submit awaits the mutation and its read completion. Failure retains the same intent. |

All abbreviated `product/` paths in this document are beneath
`modules/sucafina/Sucafinav1/`.

The actual installed wiring is also confirmed:
`apps/cli/src/sucafina-product/business-services.ts:203-206` supplies the
stable Review binding to the collaboration host;
`extended-business-services.ts:53-57` binds the actual Review application;
`review-collaboration-binding.ts:30-32,66-71` delegates to the live producer
and preserves its ownership checks. No custom prepareReviewThreadFence
override is supplied there; collaboration/host.ts:98 selects the existing
ReviewAnswerSource fence.

Ordinary fast refusals in this HTTP path produce an HTTP response. The
artifact's unresolved response waiter does not identify a particular refusal
branch, transport cause, server entry phase or transaction outcome.

## Server creation sequence

`product/collaboration/threads.ts:53-87` is the relevant whole create path:

1. Validate and clone the exact draft/mutation, check selected record basis,
   retain the Request, then perform real human/current-host authorization
   (:54-61).
2. Read the current reviews namespace authority/version and revalidate the
   same Request/binding (:62-66).
3. Prepare the whole-C05 review fence (:68-71).
4. Prepare the mutation fence, whose callback runs the real thread
   authorization (:72).
5. Enter the thread C08 transaction with sourceFence all and the previously
   observed reviews namespace version (:76). Inside the transaction,
   reauthorize the human, await the Review fence, check the source fingerprint
   and synchronous recipient authority, and refuse an existing ID (:77).
6. Commit the first thread/message only after those checks (:78-80).
7. Before returning an ok result, perform real read authorization of the saved
   thread and revalidate the same Request once more (:84-87).

The response is held until step 7. A slow read egress can therefore leave the
client uncertain even if the durable transaction already committed. The
current evidence does not establish that this occurred.

## Conditional call count for the successful canonical self-recipient path

Assumptions: a plain supported local-record review; canonical registered
reader; unchanged dependencies; no retries/drift/replay; same live Request and
context; recipient equals the admitted actor; all gates succeed. Counts below
are a static expansion, not measurements of the failed requests.

Building blocks:

- `product/reviews/thread-context.ts:37,43`: every context read performs
  two real reviews.read calls, with current-authority and pin/body checks.
- `apps/cli/src/sucafina-product/review-collaboration.ts:96,100`:
  prepareAccess adds two more reviews.read calls. Its separate snapshot
  observations at :98,103 each use a real state read (:82-94).
- The same file's access lease fence at :108-120 performs one real
  readScope.revalidate per invocation, preserving dependency callbacks.
- `product/reviews/review-answer-source.ts:81,83,94-100`: prepareThreadFence
  obtains the context, prepares access, then verifies the returned fence in a
  readonly transaction. That fence calls the access fence twice.
- `product/collaboration/authority.ts:131` authorizes the review basis and,
  for a write with a recipient, calls reviewRecipientSources. The latter
  calls reviewThreadBasis again at :66 before its self-recipient branch at
  :69. Thus the actor-self branch still performs both Review checks.
- `product/collaboration/mutation-fence.ts:25,27` invokes the real
  authorization callback twice, around two complete source captures.

| Create phase | Whole-body validations in this conditional path |
| --- | ---: |
| Prepare Review fence: context 2 + prepareAccess 2 + initial fence checks 2 | 6 |
| Mutation fence: two authorizeThread calls, each two Review authorizations of four reads | 16 |
| Await prepared Review fence inside final C08 | 2 |
| Authorize read egress after saving: context 2 + prepareAccess 2 | 4 |
| Total before HTTP ok response | **28** |

This is 24 public reviews.read calls plus four private revalidate calls.
Drift, opaque/custom readers, a different recipient, failures or replay change
the path; the table must not be reported as an observed counter for the
nominal. The additional single-thread source/recipient checks and human
admission are not included in this table.

## Cost of one complete validation is not restricted to the chosen source

`product/reviews/port.ts:72-103` validates the actual whole preserved body:

- Evidence resolution before the selection gates (:80).
- Real section and comment authorization (:81).
- Real outcome comparison/outcome/decision/sensitivity callbacks, including
  the existing empty-list calls (:86-95).
- Full source revalidation (:98-99).
- Evidence resolution again (:101), then final current binding (:102).

The complete reference body is deduplicated only within each evidence pass
in `product/reviews/services.ts:44-68`; every pass still calls the real
resolver. Source checks in
`apps/cli/src/sucafina-product/review-services.ts:53-57,93-95` deduplicate
the exact refs within that invocation, then call the current projector,
historical fallback and optional reader as prescribed.

The private snapshot path at
`apps/cli/src/sucafina-product/review-read-integrity.ts:81-127` additionally
checks the current body and C08 receipt, reauthenticates all three domain
principals, reads current environment/day, and hashes complete snapshots.
A warm validated hit performs two complete snapshot digests at :103, another
full snapshot traversal within the proof at :105, and two further digests
after dependency validation at :118. It calls currentSnapshots at :90,103,118.
These are structural counts, not duration attribution; authority/provider
internals add further observations.

C05 fingerprints at
`apps/cli/src/sucafina-product/review-collaboration.ts:47-67,82-107` also
capture source data/identities and the real Review receipt. Their C06 row
exclusion is intentional; it does not permit source or ACL reuse.

## Why removing checks or restoring the previous cache is not a repair

At base094, review-read-integrity.ts:145 returned prior.result on the same
snapshot fence, and review-collaboration.ts:99 checked the fingerprint plus
host revalidation without repeating the producer's callbacks. The immutable
negative regression e1fad demonstrated a real mutable-projector closure
revocation escaping that reuse. The current code reexecutes the producer
at read-integrity.ts:106-119 and the C05 fence at review-collaboration.ts:110-120.

The protected body materialization can be reused; source/evidence/recipient
authorization cannot be borrowed from a previous call or a different Request.
The UI preflight Request cannot authorize the subsequent create Request.
The explicit whole-C05 contract at review-answer-source.ts:63-65 also
precludes narrowing this write's checks to only its chosen source by assumption.

This call multiplication identifies pressure on repeated pure materialization,
cloning and canonical traversal. It does not establish that a particular
copy/hash/SQL operation caused the installed timeout. Any improvement there
must preserve every real callback, SQL/authority observation, order, await,
receipt/hash comparison, owner pin and final readonly/C08 fence; opaque
providers must retain their original behavior. Native's independent C08
materialization investigation owns that lower-layer question.

## Smallest remaining measurement and existing coverage

The missing measurement is where a real create Request spends time:
server entry/admission, prepareThreadFence, each mutation-fence authorization,
C08 queue/commit, and read egress, correlated with request abort. Existing
source/materialization/canonical counters should be attributed to those phases.
That would distinguish server processing from a request that never reached it
and avoid attributing the whole timeout to a guessed subtotal. It requires a
separately reviewed CI-only proposal; no such run is authorized by this audit.

Existing relevant execution evidence, to preserve without redundant reruns:

| Coverage | Existing gate result |
| --- | --- |
| Mutable-projector regression, owner/method/await swaps, read integrity and real producer scope | A run44669631616:47 unaffected cases green; the two new cold-selector failures were repaired and the full9 scope file passed in44670697754. Historical A54/2 remains red as a run. |
| Original source-lifecycle/source-read-fence, boundary, recipient and answer-confirmation files | Passed in B run44671868001; its original whole-file result remains41/4, not green. |
| Real C05 thread-context and its two swaps, with corrected fixture authority | All3 passed in44674313577; that run's whole result remains14/3 due the later port-fixture issue. |
| Full original Review port, receipts/download/current-source egress | 44675299119:14/0 after fixture-only compatibility wiring. |
| Complete Portfolio HTTP, including delegated mixed dependencies and final C08 | 44671870082:16/0. |
| Current Sucafina package typecheck | 44675305980:1/0; no runtime changed in the final fixture-only child. |
| Installed nominal, original four scenarios,180000ms/retries0 | 44675679976:1/3; RPT03 passed67367ms. It remains the open product gate. |

Primary relevant files for any later affected selection are
`test/product/reports-draft-reconciliation/{review-projector-scope,review-source-revalidation,review-source-scope,installed-read-integrity,installed-review-scope}.test.ts`,
`test/product/wp07/review-thread-context.test.ts`,
`test/product/wp08/{review-recipient-authority,review-answer-confirmation}.test.ts`,
and the original source/C08 files named above. Every chosen file must remain
whole with its existing timeouts/assertions; this list is coverage guidance,
not permission for another gate.

Both the client30000ms and nominal180000ms budgets remain unchanged.
