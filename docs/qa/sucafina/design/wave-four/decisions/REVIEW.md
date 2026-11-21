# Wave four — Decisions UI34–UI41

## Implementation boundary

Source implementation on `sf-twenty-decisions`, based on `dev` at `2a68bcb676ed0c159c5c48130c2413e0e5637a00`. Integration branch: `sf-design-twenty`. Shared frame, navigation, fixture lifecycle and workflow are owned by the integration agent.

Only the eight Decisions leaves, their scoped stylesheet, one browser journey, two fixture files and this evidence directory are changed. UI33, shared business contracts, producers, transport, grants, workflow files and earlier waves remain outside this patch.

## Composition

| Surface | Reading | Interaction and review |
| --- | --- | --- |
| UI34 — Case summary | A single intent brief; period/currency/state/version context; criteria beside constraints; source and participant disclosures; separate history. | Centered editor and review at 760px. Closing the editor preserves the draft; save reopens the authoritative case. Inputs stay mounted while the review is shown. |
| UI35 — Alternatives | Two alternatives share one comparison surface with aligned source amounts. Coverage qualification remains visible; basis, category detail and provenance are accessible disclosures. | Two-item selection, explicit comparison and historical choice. Opaque route reference is checked against both case ID and incarnation. |
| UI36 — Assumptions | Quiet source ledger with state filter; missing cost categories and event divergences share one divided surface. | Selecting an assumption opens its source detail. No standalone confirmation command is created. |
| UI37 — Questions | Existing question ledger and cycles remain source-backed. New question is a deliberate expandable composer. | Retained form → review → preparation. Preparation is distinct from recording/sending; optional recipient remains explicit. |
| UI38 — Current choice | One source choice ledger with title, reason and admitted action. | Producer-admitted choice prepares the existing exact review; the ledger gives way to a focused review stage. Missing provenance keeps preparation disabled. |
| UI39 — Prepared changes | One source ledger, selection and expected target version; explicit empty state. | Existing producer review/apply/CAS/recovery path in a centered stage. No fabricated change or retry. |
| UI40 — Application result | Original receipt ledger with outcome/date/version; identifiers and idempotency reference disclosed on demand. | Existing exact receipt detail and named producer recovery. Empty ledger does not imply a failed write. |
| UI41 — Analysis | Authorized case/type/model controls, objective and history have distinct surfaces. | Exact prepared input is reviewed before start; technical source fields remain accessible. Draft remains mounted during review/start. Source absence states explain whether cases, skills or models are missing. |

The root marker is `data-sf-wave="four"`; `data-sf-decision="UIxx"` identifies the leaf. The shared frame provides the 1160px reading axis and 32/24/16px gutters. Leaf controls and disclosure summaries have a minimum 44px target. Narrow layouts stack at 979/767/479px and retain intrinsic minimum sizes.

No new visible copy is introduced. Existing English and pt-BR dictionary entries are reused without edits. Existing producer values and technical labels remain literal data.

## Consumer defects corrected

### Opaque case identity in UI35

The historical-choice response provides `caseRef.id` and `caseRef.incarnation`; the route contains the opaque `case:id:incarnation` reference. Raw-ID equality discarded valid responses. The view now uses its existing `sameRouteCase` helper consistently in read admission, selection, preparation, eligibility and review display. No producer admission rule is relaxed.

### POST reads in UI41

The typed F02 transport owns identity for POST read operations and rejects an explicit command idempotency key. `choices`, `list`, `read` and `output` now receive only their abort signal. Prepare/start/cancel retain fresh command keys. Owner generation, read epochs, aborts, frozen prepared input and unknown-outcome reconciliation remain intact.

## Canonical fixture and browser proof

`seedWaveFourDecisions(installed, year): Promise<void>` runs after the native host starts. `installed.request` is the real authenticated original boundary. It uses:

1. BI01 `bi-options` and `bi-data` to obtain emitted evidence from the existing wave-three Planner versions.
2. `sf_case_draft` to create two human-authored test cases.
3. `decision-edit` to attach those sources and two explicitly open assumptions.
4. `decision-coverage` to register pending categories, then `decision-promote` for two alternatives.
5. `decision-criteria`, `decision-compare` and `decision-choose` to record a conditioned choice.

No snapshot projection, authorization, model, source archive, choice request, prepared change or receipt is inserted directly. The two original Planner versions are read without changing their financial values.

The executable Playwright journey covers all eight surfaces in dark and light desktop, 390px English and pt-BR desktop; 320px comparison and pt-BR question review are additional stress cases. It exercises:

- UI34 edit, cancel review, close/reopen retained draft, save once with exact case CAS and original idempotency, and authoritative readback.
- UI35 two-source comparison, original values, cost uncertainty, provenance disclosure and the formerly broken historical choice on an opaque route.
- UI36 open/confirmed filter, filtered empty state and evidence detail.
- UI37 review/cancel retention, one preparation command, and proof that the case/question list was not committed or sent.
- UI38 actual recorded choice with producer admission blocked by missing archive provenance.
- UI39/UI40 genuine empty prepared-change and application-receipt ledgers, with no apply/recover command fabricated.
- UI41 actual choices/list POST responses, exact selector counts, source-reported absence, objective input and prepared-input review when the real catalog provides a supported skill and admitted model.

Screenshots and source-count evidence are written by the shared Actions capture helper. Real session cookies are reused only for the localized isolated browser context and are excluded from traces and attachments.

## Validation status and limits

**Source reviewed; browser and type checks have not been executed by this child agent.** The repository/user workflow permits execution only through consolidated GitHub Actions, owned by the integration agent. Screenshots do not yet exist in this branch and visual approval is not claimed.

This fixture does not provide an Atlas archive admitting current-choice recalculation. It does not prepare a domain application, so UI39 apply/recovery and UI40 populated receipt detail need a separate canonically admitted source setup for runtime qualification. These paths are preserved and styled, but are not marked browser-proven.

The analysis fixture does not invent provider credentials, models or output. If the source returns no admitted models, the test proves that absence and disabled preparation. Actual start/cancel/output remains unqualified until an independently configured authorized catalog permits it.

The test reports source errors instead of treating unavailable responses as successful evidence. Any Actions failure, overflow, focus issue or screenshot defect must be resolved on the integration branch before approval.
