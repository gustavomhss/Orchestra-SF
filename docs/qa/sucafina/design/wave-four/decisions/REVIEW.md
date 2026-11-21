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

The authorized selection may also exist with an empty `choices` array. Its list now uses the existing localized no-choice fallback instead of an empty section. The test reopens the real editable case in UI35 and checks both its authoritative empty collections and the displayed message.

### POST reads in UI41

The typed F02 transport owns identity for POST read operations and rejects an explicit command idempotency key. `choices`, `list`, `read` and `output` now receive only their abort signal. Prepare/start/cancel retain fresh command keys. Owner generation, read epochs, aborts, frozen prepared input and unknown-outcome reconciliation remain intact.

### Reactive metadata at the closed input boundary

The first installed browser pass reached UI34, then its local review decoder rejected unchanged source references held by the Solid store. Solid 1.9.10 attaches non-enumerable proxy symbols to wrapped records; Effect 4 beta.83 checks `Reflect.ownKeys` when `onExcessProperty` is `error`. The source evidence therefore remained valid JSON while its in-memory wrapper was rejected before HTTP.

UI34 and UI37 now take `structuredClone(unwrap(...))` snapshots of source references before decoding/sending. UI37 also snapshots the selected cycle period and the already prepared contribution before its original confirmation command. UI35/UI38 use the same copy for producer preparation/promotion objects already held in stores. UI41 copies its case reference/scope and frozen start request. String keys, versions, digests, explicit unknown keys, optional fields and source values are retained; F02 and the original closed schemas are unchanged. UI39/UI40 already construct their request objects from scalar fields and require no change. The browser journey still requires exact authoritative source-reference equality after UI34 save and one real UI37 preparation POST. `test-browser/sucafina-decision-command.test.ts` also exercises the actual browser-condition Solid tracked store, unchanged Effect schemas and native codecs, asserting the pre-fix rejection, exact detached values, question/analysis/cycle/consumption inputs, retained mutation identity and continued rejection of unexpected keys or explicit undefined.

## Canonical fixture and browser proof

`seedWaveFourDecisions(installed, year): Promise<void>` runs after the native host starts. `installed.request` is the real authenticated original boundary. It uses:

1. BI01 `bi-options` and `bi-data` to obtain emitted evidence from two small canonical Planner versions in the isolated Decisions fixture.
2. `sf_case_draft` to create two human-authored test cases.
3. `decision-edit` to attach those sources and two explicitly open assumptions.
4. `decision-coverage` to register pending categories, then `decision-promote` for two alternatives.
5. `decision-criteria`, `decision-compare` and `decision-choose` to record a conditioned choice.

No snapshot projection, authorization, model, source archive, choice request, prepared change or receipt is inserted directly. The pre-start `seedWaveFourDecisionsPlanner` hook creates two empty versions through Versions/save and copy, then adds one USD service line through OPEX/save and closes month 1 through the producer. This is used only by `four-decisions`; the other wave-four journeys retain their richer Planner data.

The executable Playwright journey covers all eight surfaces in dark and light desktop, 390px English and pt-BR desktop; 320px comparison and pt-BR question review are additional stress cases. It exercises:

- UI34 edit, cancel review, close/reopen retained draft, save once with exact case CAS and original idempotency, and authoritative readback.
- UI35 the separate editable case's authoritative empty alternative/choice state, two-source comparison, original values, cost uncertainty, provenance disclosure and the formerly broken historical choice on an opaque route.
- UI36 open/confirmed filter, filtered empty state and evidence detail.
- UI37 review/cancel retention, one preparation command, and proof that the case/question list was not committed or sent.
- UI38 actual recorded choice with producer admission blocked by missing archive provenance.
- UI39/UI40 genuine empty prepared-change and application-receipt ledgers, with no apply/recover command fabricated.
- UI41 actual choices/list POST responses, exact selector counts, source-reported absence, objective input and prepared-input review when the real catalog provides a supported skill and admitted model.

Screenshots and source-count evidence are written by the shared Actions capture helper. Real session cookies are reused only for the localized isolated browser context and are excluded from traces and attachments.

## Validation status and limits

**Source gates passed; the installed browser journey is still being qualified.** The repository/user workflow permits execution only through consolidated GitHub Actions, owned by the integration agent. Gate run 44956908951 passed. Run 44956714182 exceeded the fixture's 40-second request boundary at decision-compare against the large Planner demonstration. With the small canonical Planner fixture, run 44957467750 completed comparison in 20.7 seconds and recording the choice in 27.6 seconds, then reached the native browser. Its first UI34 editor capture showed the intended native layout and focus ring, but review stopped on the reactive-metadata defect described above. Run 44958368425 confirmed the fix: UI34 completed review/cancel, close/reopen retention, the 390px action review, its one original POST and authoritative CAS/source readback. UI35 rendered both alternatives but the shared helper stopped after 10 seconds while the original choice read was still busy. Its screenshot also revealed an unavailable message beside a loading skeleton; that pending panel now uses the existing localized loading message. That run also exposed a disposed Show accessor in UI34 save finalization; the callback now checks that its pending request still owns the editor before reading its props. The next journey records current-choice request duration/status and requires an empty console-error collection. Only UI35/UI38 use the shared helper's 40-second busy-state wait for that read; other surfaces retain 10 seconds. Fixture and original request deadlines are unchanged and no retry is added. All eight surfaces are not yet visually approved.

This fixture does not provide an Atlas archive admitting current-choice recalculation. It does not prepare a domain application, so UI39 apply/recovery and UI40 populated receipt detail need a separate canonically admitted source setup for runtime qualification. These paths are preserved and styled, but are not marked browser-proven.

The analysis fixture does not invent provider credentials, models or output. If the source returns no admitted models, the test proves that absence and disabled preparation. Actual start/cancel/output remains unqualified until an independently configured authorized catalog permits it.

The test reports source errors instead of treating unavailable responses as successful evidence. Any Actions failure, overflow, focus issue or screenshot defect must be resolved on the integration branch before approval.

## Native availability follow-up after Decisions6

Run 44960543566 reached the actual host, completed the isolated canonical seed and passed UI34's full edit/review/cancel/reopen/save/CAS sequence with empty consoleErrors and pageErrors. UI35's empty-case choice panel remained loading for 40 seconds. Source inspection found that its guard returned before a current-choice request when the context omitted operational readiness, without updating the loading state. UI35 now resolves that guard to unavailable; UI38 similarly handles the expected unadmitted read before calling its client. Empty and unavailable remain separate states.

The current-choice service and original question-preparation descriptor are actually installed. Their missing context observations are a composition defect, not a legitimate absence of business data. The new decision-reading health observer verifies the original installed binding, registered current-choice fence, original question descriptor/schemas, canonical C08 reader and namespace authority. Two unchanged metadata observations, Request ownership, dependency identity and final revalidation are required; no case enumeration, preparation, receipt or business write occurs. The parent installs the exact callsite recorded in HANDOFF.md. The browser journey retains the positive choice/question assertions and now reports safe operation availability and request-start/status timings.

Gate7 (44959409056) passed app/E2E type checks, source guards, palette parity and all five actual browser-condition command codec tests. Gate8 also passed the parent's consolidated checks. The new health tests and Decisions7 have not run at the time of this follow-up. Eight-surface visual approval is still pending.

The UI41 follow-up repairs the same native-publication omission for the real choices/history POST reads. Its health observation retains the original private analysis.prepare (catalog) / analysis.read (history) action admissions and original Cases/Contributions reads. No prepare/start/cancel capability is inferred. The test now verifies the browser POST status and visible selectors against a fresh original API read, avoiding Chromium response-body handle expiry. Nineteen additional health cases are written but not yet executed. The actual models array remains the only evidence of model availability.
