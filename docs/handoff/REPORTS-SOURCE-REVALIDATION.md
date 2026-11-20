# Reports — real dependency revalidation candidate

## Status and provenance

This is an isolated product candidate, not a qualification or an installed-browser witness. No gate has been launched for this repair yet.

- Common product base: `094d8919819dcbad73dc6d7f02ef7b8dd4faefd4`.
- Confirmed negative regression base: `8e5e4f2623d7dfe80240b4381064fc3d6c638ff4`.
- Runtime revisions: `7d8e9271e4f5eb66cd2d9231a631564fcc70fee4`, `79ffb67ff26a3a7ca858b903ae9d1eaca8a2722a`, `6e2a0595d9097aa86b3d0e1f3feb54966fec643a`, `fbbde4794c90f6170a64733091f1920f3b22a4b2`.
- Branch: `reports-source-revalidation`. Commits use `[skip ci]`; audit-one, original tests, workflow files and request files are untouched.
- The original negative file `modules/sucafina/Sucafinav1/test/product/reports-draft-reconciliation/review-projector-scope.test.ts` is retained literally (blob `e1fad78af8a1c440b9c4dad8cb53a3dfeff12815`).

The negative was observed in run `44661290311`, job `136039877051`, snapshot `95419d90022136114c9c680a608e76abbdfb64e8`: **0 passed / 1 failed / 29 expectations**. Its final assertion at line 109 expected denied and received ok. Earlier controls passed: first ok; repeated ok with zero projector calls; a fresh scope denied with two projector calls; snapshots and method identities unchanged. This establishes a mutable-closure dependency bug, not a claim that every custom provider is unsafe.

## Runtime paths and boundaries

| Path | Relevant lines | Change |
| --- | --- | --- |
| `modules/sucafina/Sucafinav1/product/reviews/port.ts` | 55–69, 71–98, 189–230 | Exact factory port/read registry; extract the existing body validator without deleting or reordering evidence/access/source callbacks. Public read still obtains its own C08 body. The internal validator receives an isolated actual C08 body from the protected reader. |
| `modules/sucafina/Sucafinav1/product/reviews/services.ts` | 28–36, 44–56 | Descriptor-only owner/method pins. The real evidence resolver, its before/after authority checks and unavailable/denied distinction remain. |
| `modules/sucafina/Sucafinav1/product/reviews/read-identity.ts` | 5–16 | Private structural admission/egress helper: plain own data properties, actual optional absence and prototype identity. Proxy/accessor/inherited composition is opaque without invoking its getters/traps. No callback purity or authority is inferred. |
| `apps/cli/src/sucafina-product/review-services.ts` | 106–127 | Pin actual consumer owners, context/source/agenda methods; capture the actual Atlas provider per read. The source and evidence callbacks execute afresh, including custom closures. |
| `apps/cli/src/sucafina-product/review-read-integrity.ts` | 35–59, 75–125, 127–249 | Pin authority.state/read and creation target; materialize/reopen actual body and receipt in current C08; validate real dependencies on a prior-proof match. The prior proof retains only a fence, not a successful body. Closed/foreign/aborted scope is refused before any opaque fallback, and a legacy await is checked on egress. |
| `modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts` | 37–81, 103–173, 195–300 | Lexical source-check context owns exact host/Request/open state. Real projector and both real authorizations still run. An admitted factory may only observe an existing matching source identity; it cannot create/refresh metadata. Initially opaque factories keep the original materializing behavior; the actual final C08 forbids nested writes. |
| `apps/cli/src/sucafina-product/review-collaboration.ts` | 69–125, 127–166 | A prepared C05 lease repeats real asynchronous dependency validation before each final source fence. The synchronous check remains a structural/body/receipt/provider check; it does not claim asynchronous authorization. |

## Invariants retained

1. The body comes from the current C08 state and is checked against its actual review receipt, digest, current principals, role maps, environment day and the existing full-snapshot fences. A previous successful body is not returned.
2. Every body validation retains actual evidence before/after, sections, comments, outcome comparison, outcome, decision, sensitivity and source callbacks, including empty arrays. No callback result or grant is memoized across leases or Requests.
3. The new source context is a readonly policy for admitted factories, never a source authority. `observe` still invokes the exact projector, two authorizations and the same before/after digest check. Existing incarnation/version/inputDigest must match.
4. Factory admission is not purity recognition. An unchanged custom projector can revoke through its closure and is called again. Once a factory is admitted, changed identity is sticky failure; it cannot become an opaque fallback.
5. Initial Proxy/accessor/inherited source factory/driver composition retains its real original path, including transaction, transactionAll and initializeSources behavior. A nested write in actual C08 still poisons/refuses the local group.
6. The returned source `current()` is only a structural pin after the lexical work ends. A retained descendant cannot execute after close; mismatched nested owner/Request is sticky even when caught.
7. Review readScope separately checks open state and original Request before default/resident/capture eligibility or legacy fallback. Genuine absence of a scope preserves the original legacy reader. Scope closure during a legacy await refuses its result.
8. Resident native/portfolio/document/comment/outcome/sensitivity bodies still delegate through the existing exclusions. Existing default-reader portfolio classification, original budgets and assertions remain.
9. C05 snapshots, source fingerprint, exact Request/call binding, recipient provider callbacks and final synchronous identity checks remain. Real consumers still await the source fence before their final recipient check; no method identity substitutes for reauthorization.

## Atlas initialization and per-observation pins

The installed order is `apps/cli/src/sucafina-product/host-context.ts:297–305` (resident readers, extended Review, then Memory), while the real Atlas is initialized at `:880–881`. In `apps/cli/src/sucafina-product/business-services.ts`, the evidence holder begins empty at `:135`, `context.resolve` consults it at `:157–158`, and `initializeAtlas` assigns `atlas.context` at `:573`.

A construction-time pin of evidence.current would reject that legitimate first bind. The candidate captures holder/current provider/resolve identities per actual read and retains them through the observation and C05 egress. A new actual read can observe the new provider and execute its callback. A swap while an observation or prepared lease is active is refused.

## New tests (not yet executed)

`modules/sucafina/Sucafinav1/test/product/reports-draft-reconciliation/source-revalidation-fixture.ts` is a dedicated copy of the real financial composition fixture with its original authentication, grant contents, SQLite, C08 and Atlas setup. It adds only controlled factory input/await hooks and deferred Atlas initialization. It seeds no successful review, receipt or authorization. The original fixture remains byte-identical.

`review-source-revalidation.test.ts`: **30 cases**, each with its own 120000ms limit:

- Five real shared compositions: own factory, Proxy configuration, accessor configuration, alternate configuration prototype and inherited driver. Real Review and prepared C05 pass while available, then the unchanged projector closure revokes both.
- Custom evidence resolver closure revocation; projector method replacement during a real authorization await; closure revocation during the final C05 await.
- Seven consumer swaps during an actual await: persistence owner, context resolver, agenda owner, authority.state owner, state.read, Atlas provider and Atlas resolve. The interrupted read refuses; a subsequent actual read executes current callbacks.
- Six synchronous C05 egress replacements after a successful real async fence: source projector, context resolver, state owner, state.read, Atlas provider and Atlas resolve.
- Real installed initialization order: create extended/Memory, bind Atlas, then actual Review/C05.
- Closed Review descendant plus opaque provider; closure during a legacy authorization await; another authenticated call with a different Request.
- Closed source descendant; nested wrong owner and wrong Request with caught inner error and refused outer egress.
- Own and opaque source creation: exact readonly admission, unchanged opaque materialization, and real final C08 write refusal with snapshot preservation.

`review-read-identity.test.ts`: **4 cases** for non-observing proxy/accessor admission, method replacement, optional inherited callback and prototype change.

The original one-case projector regression is unmodified. Thus the new candidate requests 34 additional cases plus that existing negative. Existing installed-read-integrity, installed-review-scope, complete Portfolio and relevant source/C05 tests must remain unfiltered when root authorizes their gates.

## Limits and pending qualification

- No new test or compiler result is claimed in this manifest.
- This fixes a confirmed dependency-validation boundary; it does not by itself establish performance or close the full Reports browser gate.
- The installed profile `44659526852` identified the heavy HTML review route, with 16 producer and 15 legacy reads. Native's separate agenda change omits unused historical catalog work without memoization; it is not part of this branch.
- No diagnostic observers, metrics workflows or synthetic payloads belong in this product delta.
- Root and Native must review these tests and the final diff before Actions. No nominal Reports, no sf-ci and no main integration is authorized by this manifest.
