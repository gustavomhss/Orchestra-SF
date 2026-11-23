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

These are one sample per state in Chromium/Linux, original production assets with the existing synthetic HTTP authority fixture. They prove this recovery scenario, not statistical performance equivalence, live Microsoft/OIDC, a persistent live SSE reconnect, or a flake rate. Both browser runs use one worker and zero retries. The recorded recovery state is ready/connecting, as in the original reproduction.

The first focused Bun request ([45206814417](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45206814417)) selected no tests because Bun interpreted the path as a filter. The corrected disposable request uses the explicit `./test-browser/team-sessions.test.ts` path; the test code and timeouts are unchanged. [Run 45207802862](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45207802862), snapshot `b201c7aef7f4d951d977b2e076a26e6f90e04de9`, passed all 24 tests with 231 assertions. It includes all seven new cases and the existing unknown-POST, namespace/protocol, and principal-purge regressions.

## Remaining qualification

Combined production native runs and screenshot review must finish before merge. Existing fixtures exercise original installed producers; no replacement test application, fabricated permission, automatic mutation retry, or production write was added. The horizontal endpoint assertions measure actual browser layout and programmatic endpoints in addition to the existing keyboard gesture; they do not claim touch/wheel or browser-zoom qualification.

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
