# WP07 producer recheck and proposed WP10 bindings

## Evidence status

This is a source audit of immutable GitHub pins, performed through the GitHub
connector. It supersedes the producer-availability conclusions tied to the older
WP02/WP08 pins in `SELECTION-CONSUMERS-AUDIT.md`; it does not replace their test
results or turn source inspection into an integration test.

The new `test/product/wp07/thread-producer.test.ts` exercises producers already
present in WP07. Its three tests **PASS** in hosted
[run 43535396085](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43535396085)
for product candidate `46781943bf93bad698233b995354d15c90c4821c`; the CI checkout is
`c3fb1b6c0515baecd692c02a60cdd35a2b317f65`. The inspected job log lists all three
passes and a total of 78 passed, zero failed tests across 20 files, with 921
assertions. This proof is limited to the exact producer paths described below.
No product tests or product generators were run locally for this recheck. Export
visual reconciliation is recorded separately in `visual-check-43534947545.md`.

`wp10-producer-bindings.patch` is **UNAPPLIED / UNTESTED**. It is a reviewable
proposal for the WP10 owner/S0, stored as a receipt; no WP10 production file has
been edited in this WP07 change. Its SHA-256 is
`c2bed70663ace37fd9cf0be4cb699308f2e8076006f5a3bec0985c15bffae797`.

## Immutable inputs

| Owner | Audited commit | Relevant source blobs |
| --- | --- | --- |
| WP02 / PR 21 | `5a0f1acf9fa2cdc0171cf3f5178b61ab3bcd8d49` | `dashboard/agenda.ts`: `32b95d4a270cb9b9c987c6cb3097dbd6de975895`; `dashboard/historical-bindings.ts`: `01ab380bd9a2b0b4c8db0d62984492e12598c034`; `dashboard/confirmation.ts`: `fefdb4b7814be4953e1a5e7f12e2385e0a6a03c4` |
| WP08 / PR 28 | `09df93d48c0f4ef441c7f394db5ced086e8140c6` | `collaboration/thread-history.ts`: `42ad710351aea392df2368ea84ab057ffd248e10`; `collaboration/thread-reads.ts`: `0f17addaaadb25bad3b7985526d7803e54e8f207`; `collaboration/host.ts`: `b55bf37a353acc771021b23b6906eb79ae4d43f1` |
| WP10 patch base | `d41ea01b8d9aa068301c1643c1ec3dc088900533` | `apps/cli/src/sucafina-product/business-services.ts`: `c4f4811234948daa04394e2dc82b58fd86622b16`; `host-context.ts`: `c54af94fa8c854ee4f4874eb475c0ff45625b53a` |
| WP07 previously verified candidate | `c5143e6ad6d8dca61b09572c60f5a6ed64093f74` | GitHub contents requests for `product/dashboard/agenda.ts` and `product/collaboration/thread-history.ts` both returned 404. Producer availability on another branch is therefore distinct from presence in this candidate. |

Paths beginning `dashboard/` or `collaboration/` in the table are relative to
`modules/sucafina/Sucafinav1/product/`. The WP10 base file used to generate the
patch was verified against its Git blob SHA; this is a text-integrity check, not
typechecking or product execution.

## Availability changes

| Consumer need | Current published producer | Correct integration status |
| --- | --- | --- |
| Executive agenda | `createDashboardAgendaSelector` dispatches to `selectExecutiveAgenda`. All-selection retains the authorized page projection. Explicit record selection returns only selected signal values, clears aggregate components, and reports signal-source-record coverage. | **Producer ready; canonical host composition and integrated CI pending.** The old claim that the executive selector is absent is obsolete at the new pin. |
| IT Performance agenda | Physical `itperf-item` identities are issued from existing, unique item IDs. Invalid or duplicate IDs fail closed. The selector returns the authorized item values and record refs. | **Producer ready with lifecycle dependencies.** WP10 must include the WP02 inventory/projection changes; the factory intentionally refuses operation when physical item lifecycle support is missing. |
| Partial IT Operations agenda | The selector maps authorized physical ticket records to unique year/month pairs and filters the existing `tickets:YYYY-MM:` values. It rejects ambiguous months and retains applicable missing cells. | **Producer ready; composition pending.** WP07 must consume these values without calculating a new subset/YTD aggregate. |
| Exact historical message version | `createThreadHistory.readVersion(id, messageId, incarnation, version, context)` returns the canonical message plus current authorized thread evidence and its period. | **Producer ready; history injection pending.** WP07 already accepts this structural contract. |
| Dashboard record historical capture | `createDashboardHistoricalBindings.prepare/reopen` preserves a record projection behind a protected durable capture lookup and current physical-source authorization. | **Published producer available for record captures.** It is not a page-to-record association API or a general historical-thread reader. |
| Page-to-record comment association | The agenda selector returns a page `DomainProjection` and a separate `recordRefs` list. Its implementation does not replace page `context.sourceRefs` with record identities or return a durable association receipt. | **Still requires an explicit authorized association binding.** Equal page names, logical IDs, period labels or numeric versions cannot close this gap. |
| Removed/recreated thread source | Current C06 reads require source authorization. Historical message reads first load the same current authorized thread. Physical deletion/replacement therefore remains unavailable. | **Fail-closed behavior available.** This does not prove a reader that discloses comments after source deletion, nor a deletion-tombstone message API. |

Sources: [WP02 agenda](https://github.com/gustavomhss/Orchestra-SF/blob/5a0f1acf9fa2cdc0171cf3f5178b61ab3bcd8d49/modules/sucafina/Sucafinav1/product/dashboard/agenda.ts),
[WP02 lifecycle integration patch](https://github.com/gustavomhss/Orchestra-SF/blob/5a0f1acf9fa2cdc0171cf3f5178b61ab3bcd8d49/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP02/integration/wp10-agenda.patch),
[WP08 message history](https://github.com/gustavomhss/Orchestra-SF/blob/09df93d48c0f4ef441c7f394db5ced086e8140c6/modules/sucafina/Sucafinav1/product/collaboration/thread-history.ts),
[WP02 record historical bindings](https://github.com/gustavomhss/Orchestra-SF/blob/5a0f1acf9fa2cdc0171cf3f5178b61ab3bcd8d49/modules/sucafina/Sucafinav1/product/dashboard/historical-bindings.ts).

### Agenda contract to inject unchanged

```ts
const dashboardAgenda = createDashboardAgendaSelector({
  host,
  dashboard,
  sources: dashboardSources,
  recordEvidence: dashboardRecords,
})

// Input: { selectionRef, topic, period, recordRefs? }, TrustedDomainContext
// Success: { status: "ok", value: { projection, recordRefs, recordCount, ... } }
```

An omitted `recordRefs` selects all authorized records; `[]` selects none.
Executive `recordCount` counts distinct signal source records, and its additional
`coverage` object states whether aggregate values are included. It must not be
relabeled as the number of all rows contributing to executive aggregates.
The WP07 selector already validates record counts and explicit subset identity,
consumes the returned projection, and rejects a changed displayed body. No
parallel business formula is needed. These facts follow from the
[producer selector](https://github.com/gustavomhss/Orchestra-SF/blob/5a0f1acf9fa2cdc0171cf3f5178b61ab3bcd8d49/modules/sucafina/Sucafinav1/product/dashboard/agenda.ts)
and the WP07 `product/reviews/selection.ts` consumer.

WP02 authors tests for monthly subsets and missing cells, duplicate months,
current role/source revalidation, executive signal selection, unique performance
IDs and missing lifecycle refusal in
[agenda-subselections.test.ts](https://github.com/gustavomhss/Orchestra-SF/blob/5a0f1acf9fa2cdc0171cf3f5178b61ab3bcd8d49/modules/sucafina/Sucafinav1/test/product/wp02/agenda-subselections.test.ts).
This receipt inspected that source and does not attest its CI result.

### C06 current and historical reads must share their source projection

The canonical host creates `threadReads` with
`createRecipientAwareThreadReads(collaboration.threads, recipientThread)` and
passes that same reader to `createThreadHistory`. The host returns `threadHistory`
only when its `threadHistoryWrites` input is provided. The current WP10 pin already
allocates this private `WeakSet` and passes it to the product authority, but does
not instantiate the C06 host in `host-context.ts`. Source:
[WP08 host](https://github.com/gustavomhss/Orchestra-SF/blob/09df93d48c0f4ef441c7f394db5ced086e8140c6/modules/sucafina/Sucafinav1/product/collaboration/host.ts)
and [WP10 host context](https://github.com/gustavomhss/Orchestra-SF/blob/d41ea01b8d9aa068301c1643c1ec3dc088900533/apps/cli/src/sucafina-product/host-context.ts).

The proposed binding uses the same canonical thread and recipient-reader
instances as the C06 host. It narrows historical access to `readVersion` and
requires the real reader to exist; it does not create a substitute history object.
Recipient reissue remains subject to current access, equal material scope and
physical continuity through the canonical
[reissuer](https://github.com/gustavomhss/Orchestra-SF/blob/09df93d48c0f4ef441c7f394db5ced086e8140c6/modules/sucafina/Sucafinav1/product/collaboration/reissue.ts).

`readVersion` searches the current messages and `messageRevisions` for exactly one
matching message ID/incarnation/version, then reloads and compares the thread and
visible evidence. The API exposes `edit` and `readVersion`; it does not expose a
delete-message or read-tombstone operation. A deleted, replaced or currently
inaccessible source cannot be reopened merely because a revision is stored.
WP08's
[thread lifecycle test](https://github.com/gustavomhss/Orchestra-SF/blob/09df93d48c0f4ef441c7f394db5ced086e8140c6/modules/sucafina/Sucafinav1/test/product/wp08/threads-lifecycle.test.ts)
explicitly distinguishes retained stored communication from a successful
historical source read after material changes.

## Reviewable WP10 patch

The accompanying patch targets the exact `business-services.ts` blob above and
adds `apps/cli/src/sucafina-product/review-producers.ts`. It:

1. Instantiates the WP02 agenda factory beside the canonical Dashboard port and
   record evidence host, and exposes `dashboardAgenda`/`dashboardRecords` from the
   existing business-services instance.
2. Exports a typed `createSfReviewProducerBindings` consumer that injects the real
   planner, procurement and Dashboard agenda producers into `ReviewCompositionInput`.
3. Uses the canonical recipient-aware C06 reader, requires `threadHistory`, and
   passes its `readVersion` through unchanged.
4. Requires `authorizeSourceMapping` explicitly. BI and outcome producer bindings
   remain typed optional extensions; the helper does not invent their evidence.

The patch depends on the integrated WP02 pin, WP08 pin, current WP07 composition
contract and WP02's `itperf-item` inventory/projection changes. The business-services
hunk overlaps WP02's proposed agenda integration hunk; S0 should retain one
canonical factory instance when rebasing. Source:
[WP10 base business services](https://github.com/gustavomhss/Orchestra-SF/blob/d41ea01b8d9aa068301c1643c1ec3dc088900533/apps/cli/src/sucafina-product/business-services.ts).

After the WP10 owner has composed the canonical C06 host and the remaining review
authorities, the exact injection shape is:

```ts
const producers = createSfReviewProducerBindings({
  business,
  collaboration,
  authorizeSourceMapping,
  maxMessages: 100,
  extensions: { readBiPresentation, captureBiReviewChart, reviewOutcome },
})

const reviews = createReviewApplication({
  ...reviewApplicationInputs,
  ...producers,
})
```

Here `business` is the existing `createSfBusinessServices` result; `collaboration`
is the canonical `createCollaborationHost` result configured with the same
`threadHistoryWrites` held by the host/product authority. `reviewApplicationInputs`
denotes the remaining required `createReviewApplication` parameters; it is not an
implemented fallback authority. `authorizeSourceMapping` must be the actual
authorized source-association binding. The example is intentionally an injection
fragment, not a claim that the host currently constructs these instances.

There is no speculative `host-context.ts` hunk that installs an incomplete C06 or
review host. S0/WP10 still owns its lifecycle, descriptor registration, native
dispatch and HTTP mount. The patch is not an end-to-end native integration proof.

## Source association that remains distinct

The new WP02 `apps/cli/src/sucafina-product/dashboard-services.ts` was also
inspected at `5a0f1acf9fa2cdc0171cf3f5178b61ab3bcd8d49` (blob
`24c76c54e314c0c0579bf4beaaca8f492a7038b5`). Its `discover` operation issues
currently authorized record refs through the agenda/record producers and returns
an explicit `recordLimit: 100`; it is not a complete preserved association index.
Its `capture`/`reopen` operations compose the protected record-history binding.
The local review consumer in that host accepts only empty comments and empty
sensitivity arrays. Those operations are useful integration dependencies, but
cannot be substituted for the WP07 comment/history consumer. Source:
[WP02 Dashboard host services](https://github.com/gustavomhss/Orchestra-SF/blob/5a0f1acf9fa2cdc0171cf3f5178b61ab3bcd8d49/apps/cli/src/sucafina-product/dashboard-services.ts).

`createExactReviewThreadSourceMapping` in WP07 requires the selected C01 sources
and C06 record evidence to match in surface, type, ID, scoped incarnation,
version, selected fields and period, followed by current C17 resolution. A
Dashboard page source and an individual `projects` record do not satisfy that
contract. The new agenda producer's separate `recordRefs` list is useful input to
a binding, but replacing the page source with those refs in WP07 would change the
projection's provenance and would not establish a durable association.

The published `createDashboardHistoricalBindings` explicitly refuses
`dashboard-page` captures. Its protected record receipt and
`prepareHistoricalReissue` can prove current access to the same physical record;
they do not by themselves prove that a historical page/subset contained the
thread's selected record. Source:
[historical bindings](https://github.com/gustavomhss/Orchestra-SF/blob/5a0f1acf9fa2cdc0171cf3f5178b61ab3bcd8d49/modules/sucafina/Sucafinav1/product/dashboard/historical-bindings.ts)
and [confirmation observer](https://github.com/gustavomhss/Orchestra-SF/blob/5a0f1acf9fa2cdc0171cf3f5178b61ab3bcd8d49/modules/sucafina/Sucafinav1/product/dashboard/confirmation.ts).

For exact record-based sections, the existing WP07 mapping can already consume
the real seed producers. For page-based sections, a protected association must
bind the exact selected page/source body to authorized record identities and
support current authorization at reopen. That requirement remains explicit; the
patch does not infer it from names or store a permissive `true` callback.

## New proof possible on the existing WP07 candidate

`test/product/wp07/thread-producer.test.ts` imports only producers already present
in the WP07 tree. It composes the real SQLite driver, source lifecycle/inventory
and scoped projector, Dashboard record issuer/reader, record evidence access,
business context, UI/human admission, product-state provider, collaboration
authority/thread port and the WP07 comment consumer. Authentication membership,
placement, the clock and initial business inputs are explicit fixtures; stored
message records, source refs, scoped incarnations and mutation fences come from
their canonical producers.

| Passing test at the cited candidate | Hosted proof |
| --- | --- |
| `WP07 captures a canonical C06 message and reopens its exact C17 association after replies and SQLite reload` | Capture the actual first message; reply and resolve through C06; preserve the original captured body; reopen SQLite and reauthorize the same record association; reject a forged replacement body; ensure communication leaves business data/versions/source identities unchanged. |
| `WP07 refuses preserved canonical comments after the persisted Dashboard role is revoked` | Remove the role mapping, observe C17/C06/consumer refusal and absence of the message in the denied result, while the canonical stored thread remains intact. |
| `WP07 rejects a deleted source and a same-ID recreation without rebinding its preserved C06 message` | Delete through the canonical project domain; verify a dead physical source; seed an adversarial same-ID business row, let the real C17 lifecycle allocate a new physical/scoped identity, and reject the old thread association. |

The project editor deliberately refuses normal reuse of a deleted ID. Therefore
the third test labels the reintroduced row as an adversarial persisted fixture;
it does not claim that a normal UI create operation can reuse that ID. It does
not fabricate a C17 ref, a historical message or a native receipt.

These tests close only the real producer paths executed at the cited candidate.
They do not establish `readVersion` integration, page-to-record continuity,
recipient reissue, or disclosure after deletion. Those remain separate from the
exact-record capture/reload and fail-closed proofs.
