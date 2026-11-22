# Observed source boundaries

## Agenda identity

The unchanged `apps/cli/src/sucafina-product/dashboard-services.ts` discovery assigns `id: "dashboard"` to the agenda section of each dashboard page. Native UI47 deduplicates canonical section identities. The installed fixture therefore exercises one section and verifies disabled reorder/meeting navigation. It never invents section IDs to manufacture a multi-section success.

## Preserved projection and reactive store

The original `product/reviews/port.ts` preserves the exact section projection as content. Attempt 3 directly read this original JSON and successfully decoded it with `SfReviewDomainProjection`, while the native stored value was rejected.

The pinned Solid 1.9.10 store uses non-enumerable symbol metadata on wrapped objects; its ownKeys trap returns Reflect.ownKeys. The original review codec closes its period objects. The owned adapter restores only a reactive proxy to plain source data with unwrap and structuredClone, then applies the unchanged codec. It does not fill absent fields, coerce values, relax the schema or authorize a read.

Validation uses actual producer-created review JSON. Copies missing context or capabilities, with an unexpected period field, a non-finite value or invalid granularity must fail. Those invalid copies are never returned by an HTTP mock or rendered as a review. The native rendered value count, literal scalar text and evidence labels match the original preserved JSON. Evidence states are mapped exhaustively; currency/unit metadata is displayed separately without inferring semantics from field identifiers.

## Lists and successor

The source publishes no native authorized preserved-review list or report list. Known-reference opening is owner-bound navigation to an original reader. No empty/populated list is fabricated, and a no-reference list does not offer a meaningless retry.

The protected review-update operation returned HTTP 409 / stale / review-read-changed. The original warning remains visible and is checked as a negative. Source integrity guards remain unchanged.

## Proposal response acquisition

The source fixture supplies required Hot Topic fields through its original DashboardPeople save. The final fixture consumes the actual native app's original workbench response for target, evidence and existing values, creates a case through original sf_case_draft, reads original decision-controls, and registers the draft through original dashboard-hot-topic-draft. A subsequent native workbench read must contain exactly that draft and no preparations or applied changes.

Attempt 6 showed a successful native workbench response and ready/operational original operations, but a separately reconstructed explicit-period APIRequestContext request returned 503 / unavailable without a reason. That failed envelope is retained as a diagnostic, not treated as evidence that native workbench access is unavailable.

Attempt 7 then failed only DevTools body acquisition after navigation readiness. In attempt 8, the body promise starts immediately. A guarded exact observed read replay exists only for that DevTools acquisition error, but was not used in the successful run. The final original case, draft and native re-read all returned 200 / ok. No source response, readiness, permission or receipt is fabricated.

The fixture does not create an original current choice. Preparation, application and receipt success remain unqualified and visibly unavailable. No hot-topic preparation or application is invoked.

## Reports and discussion

Reports use original preserved sections and the existing Office format selection. No report is generated, published or sent. No discussion, notification or external message is sent. An unsent local discussion draft is checked across presentation toggles.

The external-write observer uses the original operation registry. A POST is treated as a read only for one exact method/path/fixed-query/body-discriminator match whose descriptor declares effect read. Unknown or non-read matches in the guarded send/publish/report/proposal operation families remain failures. The ten observed collaboration.recipients POSTs in the passing review journey are original declared reads.

## Evidence limits

The matrix covers actual production-channel Chromium rendering through the repository's existing test-ci runner. Reflow at 390px for reviews and 320px for proposals is not actual browser zoom or a physical-device claim. Scope receipts are split across runs; the failed attempts are not relabeled as passed.
