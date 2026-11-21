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
