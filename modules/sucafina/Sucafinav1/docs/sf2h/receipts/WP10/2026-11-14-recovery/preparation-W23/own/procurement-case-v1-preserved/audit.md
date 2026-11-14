# W23 — one current planned Procurement case read in one LocalStore scope

## Delivery and authority

This package contains two new WP10-owned files and a separate integration patch. The builder did not edit the central business-services.ts. The captured central base is byte-identical to W22 commit `4bc9c7220f04f113609393aaba38934a7e69878b`, tree `082b73607bea09a0a6252e2298c5a581c10cb645`. Root must reconcile this small patch with the other W23 host changes and publish the reviewed result. No foreign product file, frozen archive, prior audit, receipt, branch or CI request was changed by this builder.

The work is frozen for root reconciliation and hosted qualification. Source inspection and hashes are not functional or typecheck acceptance. There was no local product execution, import, test, build, typecheck, browser, publication or CI dispatch. This is a builder's review and does not count as any of the three independent reviewers. Native and global acceptance remain unexecuted.

## Cause and measured predecessor

W21 B run `43605495862`, job `132479126824`, selected product `532da498e08fa36fadbd3c01e3e7da00d869dd47` and snapshot `6cc1999f0614f6002f2d1bfc72be2edd82ae7594` ended in failure: 49 pass, 30 fail, one error, 79 tests, 10 files, 2206.17 seconds. The package records the exact raw log digest and the normalized terminal provenance in prior-hosted-metrics.json.

The actual WP04 metrics show review at 2,152 instrumented SQLite transaction API calls: H02 7,734 ms; H03 13,287 ms; H05 7,928 ms; H06 7,707 ms. Total H02 was 47,466 ms against 45,000 ms; H03 47,755 against 35,000; H05 16,942 against 15,000; H06 38,147 against 30,000. These are W21 observations, not W23 estimates or successes. The producer's instrumentation labels do not establish numbers of physical commits.

One case projection legitimately repeats authorization, C08, source and BCS reads. The LocalStore driver starts a root SQLite transaction and decodes the three snapshots whenever such a call is outside an already-held snapshot. Its nested readonly transaction path can perform the same canonical proof on the retained three snapshots. The new wrapper reduces repeated root transaction/decode work for one exact case read; it does not eliminate the two BCS context passes or their scenario resolutions.

The static target is one root transaction API invocation for each admitted case read, while retaining one canonical case.read, two BCS context passes and four explicit scenario resolves in the duplicate fixture. The new test measures these counters when hosted; no W23 reduction or latency has yet been measured. A whole HTTP review can include other work, so the W21 total of 2,152 must not be represented as a promised 2,152-to-one reduction.

## Exact eligibility and failure behavior

The wrapper applies only to a real, current C08 case read from a live UI Request with an unchanged full binding and canonical selected period. The raw case must contain at least one prepared change, every change must be planned and target Procurement, and the case and changes must have no receipts. Every evidence item must be an exact current Procurement request record. Mixed evidence, Planner, historical sources, native calls, implicit replacement selectors, assumptions and timed approval records remain on their canonical paths. Ordinary chosen or draft cases without prepared changes leave the wrapper's transaction before their canonical read.

This final restriction is essential. The existing scenario-operation-access tests retain eight actual canonical fences and write actual sources/protected state after the second fence. Wrapping all fresh cases would add three witness reads and prohibit those intended writes. Their fixture deliberately stops at prepareDomainCommands, with no preparedChanges. The new planned-change eligibility leaves that entire canonical observation and all interleaving counterproofs outside the wrapper's lock. The parent has independently corrected that fixture's exact sf_work_list period admission; this package records the current bytes and does not overwrite that correction.

Within the retained snapshot, real C08 state.read selects the raw case. The existing proof scope witnesses complete C08 state and __sfProductV1, all three source fences, current principals and directory/bank inputs, day semantics, Request method/URL/all headers, full binding, reader identity and exact selection identity/value/expiry. The new helper additionally reconstructs the exact source scope issueForActor would reissue for this call: principal/access/policy, ordered roles, canWrite, role map digest, current full fields, selected period and currency. It requires the unique alive entry, actual physical/scoped identities and published projection, and equality of the whole stored entry with the canonical entry shape. Legacy fields, another actor/policy, extra stored metadata keys, or pending normalization cannot enter this path.

isCurrent alone would be insufficient. The canonical historical resolver reads an original capture, then calls issueForActor even if it ultimately returns undefined because the source is still fresh. That issuance can materialize another actor's or policy's scope, or normalize metadata. Only an existing exact current entry makes the producer's canonical readScopedSource return commit:false. The helper never synthesizes evidence, source output, authorization or a prepared change.

After eligibility and another current witness, the wrapper invokes the canonical reader once. It preserves its authorized projection, including changeView/receiptView shaping, and does not compare public projection bytes to the raw C08 case. A final real witness must match and the id/incarnation/version must agree. The returned result is cloned. The scope closes in finally; the Request/header/binding/selection pins are checked again immediately after the store await without adding a new outside-lock await.

Only unsupported eligibility before the canonical invocation can leave the owned transaction and invoke the canonical path outside it. Changed authority/material, a canonical refusal, and a real nested write never retry. A writer that catches its own nested-write exception cannot clear LocalStore's poisoned root. The helper contains no persistent result map, authority cache, shared Promise or new AsyncLocalStorage.

## Tests supplied and scope of proof

The whole new file declares 13 tests. The fixture uses actual LocalStore/SQLite, source lifecycle persistence, C08 state authority, separately admitted and consumed UI intents, actual source issuance/resolution, the actual BCS and canonical case port. It stores an explicit upstream choice with pending cost coverage, then obtains the original capture and prepared change from the real Procurement human preparation producer. No Session, model run, complete-cost claim, accepted contribution or native receipt is fabricated.

The positive compares two separate scoped reads with a complete canonical baseline, checks the canonical prepared public view, keeps both BCS passes, measures exactly one root transaction invocation and requires zero commit requests and unchanged snapshots. A real unprepared case proves canonical boundaries remain outside the helper. Four separate fallback cases use source advancement, another real actor, a recomposed policy and an actually issued legacy field scope; all have a real prepared change so the fallback cause is not an absent preparation. For legacy fields, refusal is allowed only when the canonical producer itself refuses; result status is compared with a new canonical read.

Five after-canonical counterproofs revoke real actor access, replace a Request header, finish the UI lease, choose a different period with a separately admitted real intent, or move the semantic day. A nested-write counterproof uses an actual persistence transaction requesting commit:true, catches its exception and still requires a refused read without retry or durable mutation. A full C08 witness counterproof changes a protected preference while preserving revision counters, then rereads freshly; corruption of the actual original capture can still use an independently current fresh source, but cannot revive the old source after a real source advance.

The existing whole scenario guard, WP04 host integration and WP11 execution/reconciliation files must remain in hosted CI. No existing budget or assertion was changed. The new file has its own 120,000 ms outer / 105,000 ms cooperative limits, matching the existing own integration harness; none of the H02/H03/H05/H06 or Memory limits was increased.

## Which existing calls can benefit

| Existing scenario | Eligible stage | Canonical stages retained |
| --- | --- | --- |
| H02 | Real planned-change review and first-application preflight while sources are current | Initial unprepared case/preparation; source history after application; persisted-receipt retry and final authorization failures |
| H03 | Review and first-application reads while the exact actor/current source scope is materialized | Original-evidence integrity counterproofs, changed/replacement Request, history and receipt inspection |
| H05 | Review and pre-application planned/current case reads | Durable receipt reconciliation and its concurrent case edit; the expected409/received200 semantic divergence remains |
| H06 | Planned/current review and initial execution preflight | Receipt recovery after a lost commit response, reconciliation/replay after source advancement, and post-application authorization refusals |

This is static call-path eligibility, not a claim that every case read in those HTTP stages is eligible. The canonical apply producer, domain write transaction and prepared-application egress guards are not wrapped or changed. Historical/mixed or already applied cases remain canonical even when that leaves performance work pending. A readonly logical root uses LocalStore's actual serialized transaction machinery; it can hold the writer lock longer for one case read. That serialization effect and actual performance need hosted observation.

## Owner boundary still open

H05 also emitted an independent assertion failure: expected HTTP409, received200. The published apply producer permits a case version advancement when reconciling an already durable receipt and preserves an unrelated objective edit. The foreign WP04 test expects a conflict. This package changes neither side, and performance success would not resolve that owner-level semantic disagreement. S0 and the producing owners must decide it from the published contracts and evidence.
