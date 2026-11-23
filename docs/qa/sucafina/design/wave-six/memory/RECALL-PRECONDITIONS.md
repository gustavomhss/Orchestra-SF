# UI62 recall preconditions

## Qualification at this checkpoint

This is a read-only source review of product `d62c4b500695d248240a48944461a0d2262a589f`. The fixture establishes an original decision, evidence, a recorded choice, and its ledger event. It does **not** establish completed Atlas publication. A pending event is not an empty recall result. The preserved R16 response now qualifies the original refusal category, **HTTP 503 / unavailable / similarity-source-unavailable**. It does not identify a unique internal cause or qualify a positive recall result.

Primary evidence:

- [R11, job 137502251987](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45117078885/job/137502251987), source `cb924bd6cda9bb1fd2ac304618d3a8760b80d94e): the UI62 step failed with “Expected: 200” / “Received: 503”. The primary log did not preserve a qualified source reason. The separate Portuguese candidate-selection step passed; that does not qualify a recall result.
- [R14, job 137515748521](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45121399352/job/137515748521), snapshot `0729f9e4c3cc0e91956a8c8209c73f80bf06ed3e`: the case GET returned 200, but reading the recall body failed with `Network.getResponseBody: No data found for resource with given identifier`. The intended original-response marker was never emitted. Diagnostics show a 503 browser resource error and “Currently unavailable”, without a primary business reason.

- [R16, job 137521673423](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45123256492/job/137521673423), snapshot `de718cd31d6e38a22934274a8d4bba72b108587f`: the single original POST was decoded against the closed output contract. At 06:26:02 UTC, `SF_FINAL_MEMORY_RECALL_ORIGINAL` recorded HTTP 503, status `unavailable`, reason `similarity-source-unavailable`, `reasonTruncated: false`, and `matchingCases: null`. The unchanged positive assertion then failed with “Expected: 200” / “Received: 503”. No match count or empty result was qualified.

None of these runs isolates the Atlas, authority, evidence, feature, or continuity check responsible for the refusal.

## What the fixture actually prepares

The candidate selected by the UI62 spec is identified by **`waveFourDecisionsData.objective`**. The similarly named `plannerCandidate` is a Planner version label, not that case selector.

| Original preparation | Established precondition |
| --- | --- |
| [wave-four-decisions-seed.ts](https://github.com/gustavomhss/Orchestra-SF/blob/d62c4b500695d248240a48944461a0d2262a589f/packages/app-shell/e2e/sucafina/design-support/wave-four-decisions-seed.ts) reads two distinct Planner versions through BI01 and attaches their original record evidence. | The precedent has original Planner sources, rather than invented feature vectors. |
| It promotes two alternatives, records a conditioned comparison, and calls the original `decision-choose` route. Controls then require one choice, two alternatives, open assumptions, and no application receipts. | A choice exists; incomplete cost coverage is deliberately preserved. |
| [final-memory-seed.ts](https://github.com/gustavomhss/Orchestra-SF/blob/d62c4b500695d248240a48944461a0d2262a589f/packages/app-shell/e2e/sucafina/design-support/final-memory-seed.ts) creates another case over January using those same two Planner sources and records its own conditioned choice. | The source case and precedent are distinct authorized decisions. |
| Neither seed invokes or asserts Atlas emission or a settled publication receipt. | Positive Atlas recall remains an additional, unproved precondition. |

These assertions describe successful preparation. Current authority, versions, evidence, and continuity are checked again by the original recall producer.

## Feature and selection contract

[similarity217.ts](https://github.com/gustavomhss/Orchestra-SF/blob/d62c4b500695d248240a48944461a0d2262a589f/modules/sucafina/Sucafinav1/product/memory/similarity217.ts) requires current UI authority, an exact source case/version, a nonempty private query, a valid period equal to the source case horizon, and explicit distinct candidate tuples. It delegates to CaseRecall and revalidates the original source and result before delivery.

The feature builder in [business-services.ts](https://github.com/gustavomhss/Orchestra-SF/blob/d62c4b500695d248240a48944461a0d2262a589f/apps/cli/src/sucafina-product/business-services.ts) reopens the authorized case and compares its case/evidence digests. Its decision type comes from original record types or prepared-change targets. Both seeds provide `planner:planner-version` record sources. Components, required-criterion descriptions, horizon, and result availability are derived from original case data.

A recorded choice is present here, but a complete financial result is **not** required by the feature builder. `resultAvailable` is a boolean feature. In the [original ranking](https://github.com/gustavomhss/Orchestra-SF/blob/d62c4b500695d248240a48944461a0d2262a589f/modules/sucafina/Sucafinav1/product/decision-memory/recall.ts), matching decision type is required; horizon, components, restrictions, and result availability also describe matches or differences. The precedent's annual horizon and the source's January horizon are therefore not, by themselves, a demonstrated failure. Changing periods or completing pending costs would lack evidentiary support.

## Ledger is separate from Atlas publication

[portfolio-http.ts](https://github.com/gustavomhss/Orchestra-SF/blob/d62c4b500695d248240a48944461a0d2262a589f/apps/cli/src/sucafina-product/portfolio-http.ts) calls `mutations.recordChoice`, revalidates, and returns its result. [mutations.ts](https://github.com/gustavomhss/Orchestra-SF/blob/d62c4b500695d248240a48944461a0d2262a589f/modules/sucafina/Sucafinav1/product/decisions/mutations.ts) appends `choice-recorded` and commits cases plus outbox atomically. [enqueueSfLedgerEvent](https://github.com/gustavomhss/Orchestra-SF/blob/d62c4b500695d248240a48944461a0d2262a589f/modules/sucafina/Sucafinav1/product/integration/ledger-outbox.ts) creates the item with `state: "pending"` and `attempts: 0`. This choice path does not call the Atlas emitter.

The separate [original Atlas writer](https://github.com/gustavomhss/Orchestra-SF/blob/d62c4b500695d248240a48944461a0d2262a589f/modules/sucafina/Sucafinav1/product/host-binding/atlas-memory.ts), `emitFromLedger`, validates caller, ledger, evidence, scanner, captures, and fences before committing Atlas and a settled outbox receipt. The seeds do not prove that operation completed.

The public Atlas reader checks for pending outbox items for the selected case before handling a missing partition. Pending means unavailable. A missing partition can produce an authorized empty result only after the original no-pending and current-state checks. Existing records additionally require a matching publication, envelope, ledger event, capture, and readable evidence through final revalidation.

## Observed refusal and remaining limits

R16 used the durable observer in helper `9b9831a12d63a9ff9abbb0909841d39c37ba819b`: one original POST, no retry or redirect, the original 40-second bound, closed output decoding, and unchanged response delivery even if observer decoding fails. The caller retained HTTP 200 and all original positive assertions; the refusal correctly failed that positive journey.

The confirmed `similarity-source-unavailable` reason is a collapsed category, not proof of a particular internal check. A separate refusal presentation can describe that observed source limitation while retaining the user's criteria and showing no matches. Its UI qualification must remain separate from the failed positive journey. If further isolation is needed, inspect the original selected event/publication state under existing authority. Do not replace pending with empty, fabricate publication, change grants, or adjust the candidate solely to obtain green CI.

No backend, fixture, schema, authorization, deadline, or memory report was changed during this review. This note records preconditions, the qualified R16 refusal category, and the remaining uncertainty. It does not claim successful recall or an independently verified refusal presentation.
