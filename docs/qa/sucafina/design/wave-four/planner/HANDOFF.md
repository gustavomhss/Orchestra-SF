# Wave four — Planner handoff

Branch: sf-twenty-planner. Starting source:2a68bcb676ed0c159c5c48130c2413e0e5637a00. Integration owner:sf-design-twenty.

## Product delivery

- 03d3bd8c14e018fe60b111d76160e85683291a4c: seven-area composition, scoped styles and BR catalogs.
- f54fdd065e325726129effda8cb0e081791e5e7d: explicit shared wave-four markers, native font token and real record-detail selector.
- d7e490be175e39ec38bcd2f54b06620e732b75f6: canonical Planner data and seed helpers.
- The subsequent journey commit adds the executable Planner spec, keyed reviews, rate-label correction, saved-view list/editor return and these documents.

Owned production paths are planner/headcount, planner/allocations, planner/fx, planner/versions, planner/compare, work, search and views. Owned catalogs changed are sf-u08/09/45/46. The existing sf-u41/42/43 catalogs were read but did not need edits.

Shared frame/navigation, installation, native host and waveFourTest integration are root-owned. The group does not modify producers, schemas, transports, guard inventories, allowlists or workflows.

## Integration requirements

1. Run seedWaveFourPlanner after seedWaveThreePlanner with the same original snapshot/actor/environment and numeric year.
2. Include design-wave-four-planner.spec.ts and the root's design-wave-four-work.spec.ts in the existing production Actions runner.
3. Include the seed/data helpers in the maintained E2E type boundary.
4. Review the dark/light/BR/narrow artifacts and record run URL, source SHA, acceptance and any final visual changes in consolidated evidence.

## Remaining verification

No local build, tests, user-machine execution or browser was used by this agent. GitHub Actions is the required runtime gate. Type checking, source guards, actual screenshot inspection and full page-error diagnostics remain pending until root records the remote result.

Pay particular attention to review unmounts after revise/cancel/submit, restored F01 saved-view drafts,320px review action visibility, long position names, local comparison scroll and the difference between missing and recorded zero.

The preexisting V2 saved-view gap, absent roster-impact preview and producer-owned financial calculations remain explicit product limits, not waived checks.

## Pending-operation controls

A separate follow-up passes the existing busy contract to CAP21/CAP22/CAP23 change reviews during the original command and its source readback. Cancel and Revise stay available again in editable phases. Unknown outcomes retain the existing reconciliation behavior. UI32 edit fields and discard are disabled as soon as its mutation enters digest/submitting, before the pending-operation fingerprint is attached. This closes the brief opportunity to type into a draft already being submitted without changing any command, idempotency key, CAS rule or producer response.

## Work filter status

The work list delegates filtered-empty presentation to SfDataTable and its original SfStatePanel. The redundant leaf status paragraph was removed after source inspection confirmed both rendered the same sf.common.filterEmpty message. Filtering behavior, source reads and the table status announcement are unchanged.

## First browser findings

Remote Planner run [44956708140](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44956708140), snapshot 6d1a40be15ca1fb5ea2deddd3fe38e72266d68d8, reached the real native browser in both tests. It failed before the intended journeys because wrapped select labels included their option text, preventing exact accessible-label selection. The six selects in this group now explicitly use their existing visible i18n label as the accessible name. The test selectors remain unchanged.

The two failure captures show the CAP20/CAP22 dark desktop reading surfaces. They were inspected, yielding two local Headcount refinements: left-aligned row headings and an explicit position-ledger summary hierarchy. They do not approve the unvisited editor, review, light, BR or narrow stages. Both recorded page and console error arrays were empty at these stops.

The FX capture also exposed missing provenance in the existing CAP22 projection. The canonical seed and FxEntry schema already contain sourceRef/provider/observedAt; apps/cli/src/sucafina-product/native-ui/planner.ts omitted them from its mapped rows. The root owns the narrow producer passthrough fix; this group does not counterfeit the values or weaken readback assertions.
