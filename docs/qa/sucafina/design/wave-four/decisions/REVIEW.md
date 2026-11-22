# Wave four — Decisions UI34–UI41

## Implementation boundary

Source implementation on `sf-twenty-decisions`, based on `dev` at `2a68bcb676ed0c159c5c48130c2413e0e5637a00`. Integration branch: `sf-design-twenty`. Shared frame, navigation, fixture lifecycle and workflow are owned by the integration agent.

The implementation owns the eight Decisions leaves, their scoped stylesheet, one browser journey, two fixture files and this evidence directory. Subsequent installed-host evidence required two narrowly scoped native read-health observers, their tests, and four entries in the native read-binding type union; the integration agent owns the corresponding host callsites. UI33, business schemas and producers, transport, grants, workflow files and earlier waves remain outside this patch.

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

Visual inspection of the real Decisions6 desktop and 390px UI34 captures found no overflow, readable controls and visible keyboard focus. Full source identifiers occupied a disproportionate share of the editor/review stage. Both lists now use the existing localized Source references disclosure with the actual source count. Complete references remain in the document and the journey opens the review disclosure and checks every original reference before closing it. This compact composition awaits the next real capture; payloads, frozen source refs and confirmation behavior are unchanged.

Independent review corrected the effective choice route check to the registry's dashboard override and strengthened the health proof: both namespace observations run within the actual registered choice fence, with final snapshot verification and pinned persistence methods. Decision health tests now use the real isolated SQLite driver (24 cases); loss of snapshots or method replacement must fail closed. UI37 cycle/recipient guards also resolve unpublished operations to unavailable, without substituting empty lists. The primary question preparation assertions remain mandatory; optional Collaboration reads are separately disclosed in safe availability diagnostics.

## Consolidated verification after the native-read repairs

Gate9, run [44963051950](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44963051950), passed all 12 consolidated checks. Its official job log records all 24 decision-reading-health cases and all 19 analysis-reading-health cases passing, including the real SQLite fence, operation/namespace denials, revocation, dependency replacement and lease finalization. The five browser-condition command codec cases also remain in the passing gate.

The follow-up fixture-only commit `96877de60ddecf1b60ad4eca96353c34ec4080e3` adds exact `Snapshot`/`BlobTransaction` callback annotations and explicitly guards the original SQLite snapshot methods. Full CLI audit5, run [44963827656](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44963827656), then returned exactly the seven diagnostics already recorded on dev, with zero new diagnostics after normalizing only locations/timestamps. The full CLI audit itself remains failing on that established baseline; it is not represented as a clean typecheck.

Decisions7, run [44963049158](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44963049158), reached the real host with all four new read/preparation observations ready. Both actual current-choice GETs returned HTTP 200 (9,142ms and 9,878ms). UI34 completed its retained draft/review/save/CAS sequence; UI35 proved the authorized empty case and actual historical choice, comparison and 320px reflow. Console and page error collections were empty at failure.

The run stopped in UI36 because an exact getByLabel selector for its nested select included option text and never located the filter. The failure was not a read timeout. The test now targets the named combobox; the existing visible labels explicitly name the selects in UI36, UI37 and UI41. Page actions have a 15-second default timeout, while the explicitly awaited original command/read responses retain a 40-second bound and the overall 780-second limit is unchanged. The source projection also proves no derived missing categories: unresolved migration coverage is an event divergence. The assertion now preserves that distinction by checking the original empty derived array, its empty message and the actual coverage divergence.

The four successful official previews were visually inspected: UI34 desktop editor and 390px review, UI35 desktop empty choice and 320px comparison. The source-reference disclosure is compact, action targets and focus are readable, and no horizontal overflow is present. These four states are approved within the captured dark-theme scope. UI36 onward and the complete theme/locale matrix await the next journey; the eight-surface visual review is not complete.

## Decisions8: closed analysis inputs require a bound native route

[Run 44964845981](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44964845981) passed the functional steps through UI40: the UI36 combobox/filter and source-detail assertions, the original UI37 question preparation, and the UI38 historical choice all completed. Three actual current-choice GETs returned HTTP 200 (7,411ms, 7,800ms and 3,999ms); the failure diagnostic still reported no console or page errors. UI41 then reached its unavailable state before any choices POST; its explicit 40-second response wait failed.

The A15 inputs in packages/schema/src/sucafina/analyses.ts are closed and contain no surface field. Their effective registry entries still used {mount}/{surface}. F02 only resolves that placeholder from an admitted input.surface, so the otherwise valid choices({}) call failed route construction before HTTP. The original CLI analysis HTTP handler explicitly accepts the dashboard path and closes the choices body to action; the original history handler accepts only action and caseRef. Adding surface to those bodies or relaxing F02 would be incorrect.

The integration agent owns the source-backed registry override for all seven A15 operations to {mount}/dashboard, retaining every original method, effect, query, action discriminator and request limit. This worker follow-up updates the two-read health guard to require that exact effective dashboard route. It must be integrated together with the registry override. It adds no analysis prepare/start/cancel readiness or grant and changes no schema, input or producer. The existing 19 health tests continue to require the real effective registry and original source/authority fences; no test literal needed adjustment. Decisions9 will qualify the combined route repair on the newly incorporated dev composition.

## Visual refinement from the actual Decisions8 captures

The UI36 source-detail capture exposed grid stretching: its short missing-category message was vertically separated from its heading by the much taller divergence column, and the Open status chip filled a grid track like an input. The scoped stylesheet now starts gap-section content at the top and keeps that status badge at its intrinsic width using native line/text tokens.

The UI37 review capture exposed long technical references beside the question and criterion. The visible question, criterion description and recipient remain primary; the complete source references, criterion/recipient IDs and evidence levels now live in the existing localized Source scope disclosure with the actual source count. The journey opens it and asserts every original source reference plus the selected criterion ID before closing it. No source value, preparation input, draft lifecycle or action changes.

The integration branch has since incorporated dev through 3ce1acd0. [Gate12 run 44965223657](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44965223657), snapshot dacaec3b11b0dce7244268f7de1ade2a6df0aece on root 331cafc50bee2112f6366ff428658de938c6f58e, passed all 13 checks including the full CLI typecheck. This supersedes the earlier seven-diagnostic baseline limit after the upstream type fixes. The following consolidated gate and Decisions9 will cover the combined A15 route repair and these visual refinements.

## Decisions9: functional progress, source loss and UI41 finishing

[Gate13 run 44966016316](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44966016316), snapshot 0849344a07285ae4eef3b362817f9fe8d017d6fb on product head 250e8faf80931c807a86c5f06c0e797de469adca, passed all 14 consolidated checks and 87 regression cases, including full CLI/app/E2E typechecks, the 24 decision health cases and the 19 analysis health cases. The effective dashboard route is included in this evidence.

[Decisions9 run 44966014444](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44966014444), snapshot 8cfd3eb141d31d18ee2b32dda629d67e7d44c10a on the same product head, passed the eight functional sequences. UI41 made the original choices/history POST reads, showed the actual authorized cases and analysis catalog, and retained the genuine absence of an admitted model. The EN dark desktop captures preserve those positive states. Visual inspection confirms that the UI36 gap/pill and UI37 source-disclosure refinements worked.

The journey later failed. UI41's light desktop capture at 00:27:41Z already had no authorized cases; narrow and Portuguese captures then showed source refusals. Current-choice returned 200 through 00:27:16Z and 403 from 00:27:55Z. Console diagnostics contained original 503/403 responses; pageErrors was empty. These later captures are not approved visual evidence. The session/lease/source cause was not established by that log, so no expiration is asserted and the test is not split or its limits enlarged to hide the failure.

The isolated E2E follow-up f64ca83a21d53916c9e8827ee5f6e5f7b649d5fd requires actual source-backed content on every screen before a positive capture. It observes case/current-choice/analysis read timings, stops at the first failed source and records only producer status/reason codes and original operation availability. Fresh read-only probes cannot turn the first failure into a pass. Decisions10 uses the unchanged product composition for this diagnosis.

The positive UI41 dark capture also showed its editor extending across the full frame and touching the history section. A separate visual-only follow-up caps that editor at the native 760px stage, gives the authorized case its own full row, places analysis/model selectors in two columns, and adds 24px before history. The existing narrow single-column rule and hidden draft fields remain. This new CSS requires a subsequent real visual run; it is not represented by the Decisions9 captures.
