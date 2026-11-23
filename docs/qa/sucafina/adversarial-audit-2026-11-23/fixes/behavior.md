# Behavioral and financial presentation fixes

Base: `e115b667d845822a1df5f523bbfd828ab57ca978` (`dev`). Branch: `sf-fix-behavior`.

## Implemented changes

| Finding | Resolution | Regression evidence |
| --- | --- | --- |
| BA-01 | A transport interruption quarantines never-submitted drafts in document memory. The existing full F02 context, owner and authority-generation equality checks must pass before restoring them. Logout, revocation, principal changes and invalid provenance continue to clear private content. | Original production-browser probe now passes; seven added controller cases cover multiple drafts, changed authority and purge after interruption. Existing uncertain-POST case continues to require one POST and read-only reconciliation. |
| BA-03 | Existing entities/allocations use localized Edit headings; new records retain Add headings. | Native allocation journey checks the edit heading; review scope names the source record. |
| BA-04 | Optional shared-table row-action context renders the exact authorized version name, year and status beside narrow-screen actions. Existing handlers and disabled-state rules remain unchanged. | Native 320px journey checks full context visibility, opens Delete review, checks the exact source reference, cancels, and observes no mutation. |
| BA-05 | CAP20/CAP22 review scopes use version name and year; CAP21 uses record name or the localized common-catalog label. Technical snapshot references remain available through Source disclosure. | Native journeys assert the exact human-readable scope. No substitute references or inferred source identities were introduced. |
| BA-06 | Shared change-review deduplicates equivalent blocking messages by key and normalized parameters, preserving order and distinct reasons. | Implemented on the product agent's shared-component branch. Our native Sync roster assertion requires one reason and a disabled action. |
| BA-07 | Comparison titles sit outside horizontal scroll regions; the identity header sticks with the body labels. Tables retain accessible names through their visible headings. | Existing keyboard-scroll journey now checks both horizontal endpoints and captures the final endpoint. |
| BA-08 | Desktop procurement metrics share intrinsic label/value rows using subgrid; existing narrow-screen label/value layout remains. | Existing EN and PT-BR native journeys compare the five value baselines. |
| BA-09 | PR approval references reserve 180px, leaving the flexible remainder to the subject. | Existing EN and PT-BR native journeys verify one-line reference/open-action text and containment in the identity column. |
| BF-01 | Annual amounts use locale grouping and the currency supplied by the record/draft; period zero and months use existing localized semantic labels. Numeric precision is not reduced to currency minor units. | Native OPEX edit/create and CAPEX spread assert exact formatted amounts; OPEX period and draft preservation are checked in English and Portuguese. |
| SYS-04, Planner portion | Planner warning rule uses the existing `--orchestra-warm` token. | Combined visual/source qualification. |

BA-06 and the changed/unchanged-field disclosure used by the updated native specs are supplied by the product branch. Run these native specs on the composed candidate. No grants, producer codecs, command payloads, CAS bindings or confirmation handlers were relaxed.

## Teams production baseline and after measurement

The existing `team-profile-visual.spec.ts` production HTTP harness was measured before the session-controller edit. The audit's original reproduction was retained, with three observational timers added. They do not govern readiness or replace semantic assertions.

| Run | Source/snapshot | Result | Ready | Input observed | Recovery ready |
| --- | --- | --- | ---: | ---: | ---: |
| [Baseline](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45205412569) | Product `e115b667`; snapshot `452695d76384787bd3045222d6fe67a85c5932dc` | 12 passed, original regression failed: expected draft, received empty | 1093.04ms | 22.74ms | 161.79ms |
| [After](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45206772464) | Product `824ad6efa248e9130c00eb76830fc40106e91c04`; snapshot `3a992a495773f62c4655cdd1b3d64a16fa127561` | 13 passed, exact draft restored, writes empty | 1009.63ms | 19.39ms | 150.16ms |
| [Composed](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45218615206) | Product `77f3104662e5ce4a7181403761a3b7e51c138704`; snapshot `2758bf0651eb6765383795030c656d7bbe4fc25b` | 13 passed, exact draft restored, writes empty | 1016.89ms | 17.53ms | 156.51ms |

These are one sample per state in Chromium/Linux, original production assets with the existing synthetic HTTP authority fixture. They prove this recovery scenario, not statistical performance equivalence, live Microsoft/OIDC, a persistent live SSE reconnect, or a flake rate. All three browser runs use one worker and zero retries. The recorded recovery state is ready/connecting, as in the original reproduction.

The first focused Bun request ([45206814417](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45206814417)) selected no tests because Bun interpreted the path as a filter. The corrected disposable request uses the explicit `./test-browser/team-sessions.test.ts` path; the test code and timeouts are unchanged. [Run 45207802862](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45207802862), snapshot `b201c7aef7f4d951d977b2e076a26e6f90e04de9`, passed all 24 tests with 231 assertions. It includes all seven new cases and the existing unknown-POST, namespace/protocol, and principal-purge regressions.

## Remaining qualification

Combined production native runs must finish before merge. The twelve UI55/UI56 screenshots from Files2 have been inspected, with the focused result below. Existing fixtures exercise original installed producers; no replacement test application, fabricated permission, automatic mutation retry, or production write was added. The horizontal endpoint assertions measure actual browser layout and programmatic endpoints in addition to the existing keyboard gesture; they do not claim touch/wheel or browser-zoom qualification.

## Supplemental SUP-R01: import preview hierarchy

UI55/UI56 now render source gaps through the original public `missing.reason` enum and the admitted change's file metadata. A gap is associated with a change only when exactly one full `change.path + ":before" / ":after"` matches. This convention is read directly in both original producers, `product/imports/planner-preview.ts` and `dashboard-preview.ts`. Unknown or ambiguous associations use a generic source-value heading; the UI does not derive a business identity from a UUID/path.

The source-provided field, sheet, row and column remain data. The Before/Proposed labels and eight closed reason labels use the English/Portuguese catalog. The complete original path and reason code remain available in Source details. No gap is converted into permission to apply.

Only nonempty change categories retain individual disclosures. A single collapsed category summary exposes every empty category and its zero count. Actual changes, before/after values, ignored/rejected entries and full provenance remain available. UI57's receipt, totals and six-category rendering from #713 are preserved. No #613 implementation was copied or merged.

The existing real XLSX journey in `operations-support/imports.ts` now checks the compact category count and exact gap metadata, opens/closes the technical disclosure, rereads the same producer manifest through UI56, and captures the gap presentation. Its existing assertions still prove no preview mutation, one explicit Apply, identical original receipt recovery and unchanged UI57 behavior. A focused pure presentation test rejects ambiguous/similar/financial-only identifiers rather than fabricating file provenance. These new checks require the combined Files CI run before merge.

## Original-read synchronization and qualification status

The first composed native run, [45209857978](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45209857978), failed all eight tests before the new finding-specific assertions. Seven failures still had the original page read in flight when the existing 10-second DOM busy assertion expired; one failed while the native view was still resolving. Console and page error collections were empty. This run does not qualify the presentation fixes.

The maintained design helper now observes the original provider and route admission replies, then the exact native operation selected by each journey. The existing forwarding observer retains and delivers the original response bytes with redirects and retries disabled. Native page responses must preserve HTTP/body status and the installed owner tuple. Selector assertions use actual source option identities. For commands with a source-validation GET before POST, the readback observer is armed after the original accepted POST body and before that body reaches the application, so a preflight cannot be mistaken for persistence. Comparison waits consume both independently selected CAP17 responses. Existing DOM, source values, CAS, negative assertions and mutation counts still follow those receipts.

No numerical timeout, retry, sleep or network-idle wait was added. F01 uses Playwright's existing response deadline; the caller's original DOM budget applies after the contracts have actually arrived. Timing logs distinguish original admission reads and operation receipts. The temporary rejection observer on an armed read does not replace its promise: callers await the same rejecting promise and retain the failure.

A read-only source comparison found no producer/runtime changes between the pinned base and the composed frontend candidate; the primary Vendor Contracts fixture alone adds its canonically supported USD value. The repeated original authority and projection probes were not optimized, cached or weakened.

### Files first composed result

[Run 45212950301](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45212950301), snapshot `49fa3ffeb4e98675ce0b3a3934645004e40909e5`, finished **3 passed / 1 failed**. OP-IMPORT, OP-EXPORT and OP-SCENARIO passed; the independent document journey failed its new readback assertion. The overall run is not green.

The real import proved four original missing-source gaps, exact hidden/opened/closed technical references, compact empty categories, one Apply and a recovered receipt with three changed fields. UI55 assertions ran. The original optional capture argument was absent, so this run did **not** execute UI56's optional block or produce UI55/UI56 PNGs.

Commit `168d51a351c203e5c0635dd44398726205c7a100` makes UI56's same-manifest reread permanent coverage. Both UI55 and UI56 now capture source-gap and change-category checkpoints through the existing native capture helper in dark/light desktop and dark 320px presentation. A small dedicated attachment records the exact source gap paths/reasons, displayed headings and category counts. The Apply observer starts before those checkpoints and requires zero Apply calls before the original single explicit mutation. No workflow environment flag or allowlist was changed. A composed rerun and review of its original PNGs remain required.


### Composed gate and recovery scope

[Run 45217689162](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45217689162), snapshot `05c7ba8efddb0fdba093d39613f263be5290a228`, passed app-shell and E2E typechecking, the 25-test / 118-assertion pure presentation group (including both import location cases), and the 127-test / 1776-assertion browser group (including the 24 Teams controller cases). This gate is distinct from native installed-producer journeys.

The composed Teams attachment `audit-unsent-draft-recovery` confirms the exact draft, unchanged fixture authority and zero writes. Its post-refresh screenshot is READY/CONNECTING. A red notice in that frame alone does not establish that the notice persists after the recovered stream opens. Test-only commit `64091e2afbea0f853aa201e10aea0a2c03034f2b` extends the original probe with a schema-checked event on the new connection and a barrier on the original list GET triggered by that event. The OPEN control is being qualified separately before a product change. Releasing the barrier must still let the finite fixture reach EOF and retire the workspace; no persistent/live SSE claim is made.

### Files2 import result and original image review

[Run 45216741705](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45216741705), snapshot `f5b1de9e9f20672a8e78552e08603561eb73f31b`, again finished **3 passed / 1 failed**. OP-IMPORT passed in 120621ms, with OP-EXPORT and OP-SCENARIO also passing. The document journey timed out while its capture helper attempted to reach the desktop theme control from a 320px viewport. This is not an overall green run.

The original artifact `14839089214` contains 27,530,529 bytes, SHA-256 `6244bbc292655c2cce15174606da29ffff5c897dc9dc93a55e9c2a68883e36f5`. All twelve import PNGs were inspected individually: UI55 and UI56, gap and category checkpoints, dark/light 1440px and dark 320px. At these checkpoints the headings, Before import labels, disclosures and action rows remain contained and aligned; the narrow actions stack within the page. This review does not claim unmeasured zoom, touch, Portuguese rendering or an entire application visual approval.

`operations-import-preview-presentation.json` records four original `missing` gaps (`desc` and `proj`, in both the source line and summary line). Their exact original paths remain in closed Source details, with open/close behavior checked. The source did not provide an unambiguous cell association for these four gaps, so each heading deliberately remains Source value, followed by Before import and Not provided by the source. The UI does not invent a record name or spreadsheet location.

The same attachment records added=4, changed=5 and removed=unchanged=ignored=rejected=0. The two populated categories remain distinct; the four empty categories share one collapsed summary. UI56 rereads the same original manifest and must produce the identical presentation record.

The original receipt attachment records **one Apply**, three changed fields, the changed record's version token advancing 1→2 and the unrelated record remaining 1. Preview plus independent review observe zero Apply requests before that explicit mutation. Lost-delivery reconciliation, the separate receipt route, cross-tab revocation and the independent viewer's denial still pass.

Canonical PNG name prefixes are `UI55-source-gap-context`, `UI55-original-preview`, `UI56-source-gap-context` and `UI56-original-manifest-preview`; each has `-dark-desktop`, `-light-desktop` and `-dark-320` variants in the Playwright artifact.

### Admission completion-signal correction

Decisions2 run `45216596111` completed UI33 and rendered UI34's original Case summary with the host discovery/provider/view all ready and no console/page errors, but the helper remained inside `Response.finished()` until the unchanged total test deadline. Both matching admission replies and the original case response had already arrived. Commit `e92a3232dcea5e90da2e5b6b1fc6627dc3b3bbf2` removes only the two redundant admission `finished()` waits, retaining exact request matching, both HTTP 200 assertions, operation receipts and all original DOM readiness checks. No request is repeated and no timeout is extended. Native composed reruns must qualify this correction.

### Final import category copy

The image review also exposed raw lowercase English category labels. The six values are a closed producer enum in `schema/sucafina/files/structures.ts`. Their existing UI catalog entries now read Added, Changed, Removed, Unchanged, Ignored and Rejected. The already localized Portuguese entries remain Adicionados, Alterados, Removidos, Sem alterações, Ignorados and Rejeitados. Data attributes, source enum values, counts and references do not change. The original Files2 PNGs remain the before record. The maintained journey asserts the populated and empty English labels and all six Portuguese receipt labels against counts from the original detail. UI57's layout, totals, six disclosures and persistence oracles remain intact; only its English Changed locator follows the visible catalog label. A subsequent composed Files run must capture this copy update.
