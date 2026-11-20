# C17 — fresh authority data inside an existing readonly root

## Scope and status

Base product: `1542afe3a79550d6f3002eff8dcdbc442c981a79`, tree `06d5a4e4afb84aa4e2f4fd0e6e8e19f2447e1841`.

This isolated candidate changes four runtime files, adds two test files and this manifest. It contains no request, harness, workflow, probe or main handoff edit. Its qualification history is recorded below. The proposed fixture repair changes only observation boundaries in four new tests; runtime and original tests/budgets remain unchanged. No browser nominal or sf-ci has run for this repair.

The previous C17 result is still red. Diagnostic run `44679705156`, job `136099896762`, ran the original C17 on product 1542 plus CI-only observations and hit its original deadline. Sanitized evidence is `docs/handoff/evidence/c17-synchronous-44679705156.json` at `8ae2c4e48f373712d6b7cdc4004a6876b6367cbf` (blob `f273058b6025e064f6f60f43d9e33b29a022a14b`).

Its first completed mixed.produce span was 43,561.955 ms, with one accepted physical root and 102 joins. Within that inclusive span, 91,699 currentSnapshots calls accounted for 10,804.922 ms and 333,485 materializations for 11,866.199 ms. These times overlap; they are not additive CPU totals. The profile did not measure every full product-state clone or authentication/blob query. No runtime gain is claimed for this candidate before qualification.

## Runtime changes

| File | Change |
| --- | --- |
| `runtime/local-store.ts` | A lexical WeakMap is populated only by openLocalStore. Its exported reader recognizes the exact returned store, original own data methods and an already open readonly root. It copies only the complete roleMap and access subtrees into new objects on each observation. |
| `product/integration/source-lifecycle.ts` | A separate lexical registry is populated only by createSfSourcePersistence, keyed by its freshly created currentSnapshots forwarder. The reader recognizes the factory object or its canonical spread composition through the complete original method vector and its original input.persistence. It delegates to the independently recognized LocalStore base. |
| `product/integration/product-authority.ts` | The resolve path requests all three surfaces. The principal path with a real dashboard transaction snapshot requests only Planner and Procurement; the dashboard argument remains that real snapshot. Original authenticate calls, Promise.all, grants, identity fingerprints and full-copy fallback bodies are retained. |
| `runtime/admin.ts` | The roleMap argument type widens to Pick&lt;Snapshot, "data"&gt;. Its executable body is unchanged. |

Paths above are relative to `modules/sucafina/Sucafinav1/`. Persistence and LocalStore contracts acquire no new method. There is no exported registry setter, accepted external projector or result/grant cache.

## Provenance and lifetime

- Unknown adapters, plain copies of the driver, proxies, accessors, nonstandard prototypes and method replacements use the original full-copy path before admission. Eligibility never invokes a custom getter or projector. New descriptor classifiers use Object.hasOwn(descriptor, "value"); inherited descriptor.value cannot disguise an accessor as an own data property.
- Source composition is identified by its own data descriptors for currentSnapshots, currentSnapshot, transaction, transactionAll and readSnapshotRoot. The source input and base driver must still have their original identities and descriptors. Calling a helper with bind or copying unrelated functions cannot register an owner.
- The ProductAuthority input must itself be a plain, nonproxy object with an own data persistence property. That owner is checked before/after authentication and again after the last identity callback.
- Only the existing root's private normalized graph is read. It never escapes. DTOs contain fresh roleMap/access copies; absent properties stay absent. No source/case/result identifier is used as provenance.
- An initially inherited roleMap/access property requires the full receiver, so it remains on the original full-copy path without invoking that getter during classification. Later inherited-property or provider drift invalidates the admitted observation. Failure is sticky for that observation; restoring a method does not revive it, and there is no retry through legacy.
- The current closure retains only fixed absent-field names and the existing scope, not an independent reference to private data or its descriptor values. The existing root finally still clears snapshots/copy plans. DTO graphs are caller-owned copies.
- Closed or aborted known scopes keep requireScope's original error behavior. No new root.poisoned or lifecycle.closed short-circuit was added: the original driver egress still refuses poison and drains already admitted roots during dispose. This preserves the original authentication callbacks for a poisoned but still open root.
- No lock, SQL statement, await, authorization callback or snapshot-root operation is added. The extra fences are synchronous provenance/lifetime checks, not authorization.

The only keyed-record construction assertion describes Object.fromEntries over the exact admitted surface list. It does not manufacture a Snapshot, principal, lease or approval.

## Static preservation checks

Independent in-memory inverses remove only the new queries/registration and restore all four runtime files byte for byte to 1542 (admin is type-only). LocalStore has the same SQL literal sequence. Await token counts remain LocalStore 22, source-lifecycle 11, product-authority 24, admin 0.

The otherSurfaces fallback and resolve fallback remain literal copies of the originals. The authenticate invocation and Promise.all invocation retain their original expressions. Stable observations execute all three authentication callbacks; the tests also demonstrate all three when poison alone is already present or when drift/abort occurs after the three callbacks have started. A synchronous provider/prototype mutation by the first callback can make currentRead refuse the remaining observations before their authentication callbacks. This is deliberate: a refused projection must not evaluate a newly inherited getter against a reduced receiver. The sticky-refusal test covers that case and does not claim three callbacks. There is no change to currentSnapshots/currentSnapshot implementations, transaction callbacks, source lifecycle callbacks, source receipt/digest functions, calculation producers, request identities or public authorization policy.

Root separately traced both actual extended-assets browser entries: 36 files, 66 runtime edges, no dependency on these four runtime paths. This is a static check of those entries, not an executed bundle or a claim about all repository entrypoints.

## New regression coverage

`test/local-authority-data.test.ts` declares 16 effective cases. It uses real SQLite roots and the real source factory to cover detached codec-compatible copies, absent metadata, arbitrary-driver/spread/Proxy/accessor refusal, the five individual method pins, opaque source input, two inherited-field receiver controls, poison, abort, escaped descendants and drain. Three additional controls replace an admitted driver method, source input property or source forwarder with an accessor before installing an inherited descriptor.value; all recognizers refuse without invoking that getter.

`test/product/wp10/integration/authority-read-projection.test.ts` declares 14 effective cases. Its fixture composes the real source lifecycle and real product authority and calls the real installation state initializer. The authenticator and its revocation controls are explicit component fixtures, not native or model proof. Cases cover unchanged three-surface callbacks and Request identity, before/after C08 authorization, ACL/accessRevision changes, other-principal isolation, four awaited owner/provider swaps without retry, opaque full-copy behavior, revocation/abort, poison callback order, prototype drift, sticky refusal, a final identity-callback owner swap and a positive inherited-getter/full-receiver fallback, and the consumer input accessor masked by an inherited descriptor.value during authentication.

The original candidate had 104 new literal expect() calls across these files. The proposed observation-boundary repair raises this to 129 (authority file 40 to 65; local file unchanged). The four repaired fixtures retain their original status, value, Request, full-receiver and poison expectations. Each original 3-authentication, 2-getter/1-copy and 9-receiver expectation now applies to a complete observed authorization round; the second complete round has the same exact assertions, with full-vector reconciliation. All ten other authority cases and the original C17/mixed-root tests remain byte-identical.

The initial functional selection ran all seven complete files: the two new files; product-authority.test.ts (15 cases); runtime-readonly-root/runtime.test.ts (23); source-lifecycle.test.ts (5); original C17 (1); and calculation-mixed-root.test.ts (15). No trigger is part of this fixture repair.

## Qualification and original admission boundary

- Product/runtime `53faf8db0f015431b80722f457bc1018aff17ebe`: functional run `44686066277`, job `136120565459`, cleanup `136124232394`, snapshot `9ddbf78ef3451a5380b727ace584dea6283aacb5`: **83 pass / 6 fail / 546 expects / 89 cases / 7 files / 533.41 s**. Local projection 16/0, original readonly root 23/0, source lifecycle 5/0 and product authority 15/0 were green. The authority file had 10/4. Its four failures were whole-admit counters: 3 auth versus two triples, 2 getters versus 4, poison's expected egress error masked by an inner 3-versus-6 auth assertion, and 9 inherited receiver reads versus 18. These were not runtime proof of permission or poison regressions.
- The two original deadline failures remain open: C17 `105009.77 ms` against `105000 ms`; mixed siblings `161499.05 ms` against `120000 ms`. No timeout was increased and neither was repeated for this fixture diagnosis. Sanitized complete evidence is `docs/handoff/evidence/c17-authority-data-44686066277.json` at `a19899d95aef563a00c8d638f9ae067b0540b3eb`.
- Compiler2 `44686072921`, job `136120586996`, passed CLI and failed Sucafina only on nine readonly-array matcher types in the new test. Test-only commit `8d7cb85f068d877c8e808206627ca0dc8993d39f` replaced those nine matcher inputs with equivalent array spreads; runtime and all expected values stayed identical. Sucafina-only follow-up `44686875780`, job `136123190406`, cleanup `136123923264`, snapshot `95051efd810de12d1dc23a1f7596c9ded6390196`, passed 1/0/0 skip/0 cancel in `29564.485399 ms`.
- The original baseline contract was separately controlled on product `1542afe3a79550d6f3002eff8dcdbc442c981a79`, without the projection helper or any runtime edits. Staging commit `a3a06c980e100aaa1cff1169b40b0a854c79dc21`; same-tree trigger `f2dc0fc752a56c546ce65b17ce2634a270b3bfd8`; tree `906264a709fb419937d101dd770f049d71778281`; request `c4b7d3425acd96b7ec8607db7479e192f0d442fc`. Run `44688979791`, job `136129966351`, cleanup `136130557065`, attempt 1: **4 pass / 0 fail / 57 expects / 405 ms**. Both the test job and cleanup succeeded. Omni was not applicable (focused: no declaring test ran); it made no spawn or delegation and is not a native witness.

The original `ui-authority.ts` blob `fc6b8dc2345f70520ddcc2facdbef0d90a334df9` is identical at 1542 and 53faf. Its admit calls authorize at line 65, awaits the real commandIdentity at line 70, and invokes revalidate at lines 78–79; revalidate calls authorize at line 48. A successful admit therefore contains two principal observations. Standalone revalidate contains one. Product authority's original three-surface Promise.all and opaque persistence access path account for the per-round counts; the inherited roleMap control requires the original full data receiver.

The fixture records the actual commandIdentity callback once, with its exact Request, operation and input digest, and returns its unchanged command ID. Each measurement starts immediately before the original admit call and ends immediately after it. Opaque input-getter construction accesses remain before that original measurement boundary and are retained in the append-only vector. Explicit zero assertions preserve the originally absolute baselines: no authentication precedes admit in any of the four cases, no full-copy wrapper call precedes opaque admit, and no inherited receiver observation precedes the inherited admit. Slices use only the actual callback boundary; no observation is filtered, spliced, reset or deduplicated in the four repaired cases. Concatenation must equal every recorded element between those two boundaries. Standalone projected revalidate is compared to the first complete baseline round, the second baseline round is separately proven equal, and the subsequent real state.read callbacks are retained/reconciled as well.

This control demonstrates the original admission contract, not a performance benefit or qualification of the projection implementation. The proposed fixture repair itself still requires its focused qualification; it neither changes the six-failure result above nor closes C17/mixed deadlines. No production callback, await, authority grant, Request, source identity or test budget changes in this repair.

## Integration boundary

This branch deliberately starts from 1542. Its source-lifecycle base is `c7c6b0a1088838f3c0cc32274398be768ab91e1c`. Reports' isolated 6c630 branch has a later source-lifecycle blob beginning `1b140681`, including ScopedSourceCheck/readCheckScope guards. A future composition must preserve those guards in the new registered projection path as well as the existing forwarders. Replacing either whole file with the other branch's version is not an acceptable integration.

No Reports full-snapshot fence is narrowed here. No canonical byte memo, missing-path plan change, independent private BCS root, publication READ wrapper or larger cache is included.
