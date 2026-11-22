# UI30 — original Work detail sources

## Observed behavior

The real installed host in [Work run 44960541317](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44960541317) loaded three owned Procurement approvals in UI30. Opening the continuity requisition detail returned HTTP 503 with the native unavailable state. The diagnostic recorded no page exception. The selected list remained in memory.

The native adapter calls the original C58 `workDestinations.read`. It preserves the producer's status and performs another authorization and terminal verification before returning any successful detail.

## Concrete preexisting comparison risk

The original Procurement port computes `ageDays` as:

```text
(Date.parse(environment.at) - Date.parse(stageEnteredAt)) / 86400000
```

Its declared unit is `days`. The local installation obtains a new timestamp at each `environmentFor(request)` invocation. C58 collects the complete detail twice and compares both views byte for byte; its Procurement details stringify every projected value, including `ageDays`. Advancing time can therefore change that display while the source identity and CAS revision remain unchanged.

This is a source-level diagnosis candidate, not a claim that a private runtime trace has proved the exact failed branch. The observed 503 alone does not identify which unavailable branch ran. Neither the global environment clock nor C58's comparison, source checks, authorization, period handling or two witnesses is changed by this design work.

## Stable detail fixture

`seedWaveFourWork(installed, year)` in `design-support/wave-four-work-seed.ts` is an optional post-host helper for the UI30 journey only. It uses `installed.request` and the exact `installed.actorId`.

The helper performs these original operations:

1. Read the original recipient directory. If the enrolled operator is absent, read its original Dashboard assignment form, require revision 0 with no selected modules, and submit `configure-assignment` with the exact actor ID and `assigned: []`. Re-read the form at revision 1 with no selected modules, then require the exact operator from the recipient directory. Any existing revision, selected module, conflict or continued denial stops the helper.
2. Discover the annual Procurement Work selection.
3. Read the canonical Work list and select the owned continuity requisition.
4. Call `collaboration-handoff-create` using the unmodified evidence returned by the list.
5. Re-read Work and require the returned Hot Topic, relation-backed assignment, owner and source version to appear.

The optional empty registration uses the original admin authorizer (`runtime/admin.ts`): `canWrite` and the admin role are mandatory; the selected person must come from the live directory; CAS must match. That command writes only the `assigned` field and its original audit/revision. An empty array assigns no contributor module, and `src/nav.ts` denies assignment-derived writes for an empty array. Roles and role maps are untouched. The helper never clears an existing assignment. Registration runs before selecting sources because it legitimately changes the current authority revision.

The Handoff producer itself calls the Dashboard Hot Topic command and C08 relation/assignment transactions. The helper does not write business maps, make source references, mint authority, alter grants or construct receipts. This path creates local product data and sends no external communication.

Returned metadata is `{ title, topicId, actionRef, sourceVersion, ownerRef, ownerName }`. The source evidence stays inside the helper. The browser must acquire its own fresh Work selection through the normal UI.

## UI30 journey integration

Root owns the shared installation and `design-wave-four-work.spec.ts`; neither is overwritten by this helper.

For the stable detail, locate the unique Work row by `waveFourWorkData.title`, click its existing Work details button, then check:

- Original title, owner reference and current source version.
- The bounded detail composition and its dark/light/BR/narrow views.
- Return to list restores the selected period, filters and original list.
- A current source link routes to the authorized native Hot Topic page and opens the same producer record.

Keep the real Procurement failure as a separate source-state scenario: opening the continuity requisition must show the explicit unavailable state, keep the list selection/data and allow returning to it. Record its observed HTTP status and diagnostics; do not relabel it as a successful detail. An exact claim about `ageDays` requires a private diagnostic of the differing fields first.

The helper is source-reviewed but not executed locally. Root must add it only to the UI30 fixture path, include its TypeScript dependency, and run the original remote journey. It must not delay or gate the independent UI31 and UI32 journeys.
