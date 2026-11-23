# Fourth interface refinement pass

This pass refines the existing native interface across Teams, Agents, MCP, Settings, Planner, Procurement, Documents, Memory and local administration. It is integrated through [PR #718](https://github.com/gustavomhss/Orchestra-SF/pull/718), starting from `e115b667d845822a1df5f523bbfd828ab57ca978`.

The issue ledger counts distinct observed defects. Files, commits, viewport variants, screenshot copies and follow-up corrections to the same defect are not additional fixes. Test-fixture maintenance is recorded separately. The machine-readable source, run, artifact and review index is [round-four-runs.json](./round-four-runs.json).

## Issue ledger

| ID | Area | Observed defect | Resolution |
| --- | --- | --- | --- |
| R4-01 | Teams | Expanded chat administration escaped its raised surface. | Correct intrinsic sizing for the expanded chat layout. |
| R4-02 | Teams | Empty active fields had weak boundaries in both themes. | Use a scoped native dim edge while preserving hover and keyboard focus. |
| R4-03 | Planner / Versions | The version identity vanished from narrow action-side table views. | Repeat the real source name beside narrow actions with the original accessible identity retained. |
| R4-04 | Procurement / Overview | Wrapped labels displaced adjacent metric values. | Share label, value and note tracks with native subgrid. |
| R4-05 | Procurement / Approvals | Request numbers and their action wrapped unnecessarily. | Reserve the existing 180px identity-column budget. |
| R4-06 | Documents / Evidence | Candidate selection shrank within its row and its text was centered. | Fill the candidate column, align value and metadata, and separate confirmation. |
| R4-07 | Memory / Signals | Selected case text approached the native select arrow. | Give the local 32px end reserve enough specificity to survive the shared form rule. |
| R4-08 | Local administration | The same summary heading appeared twice. | Use one heading and preserve the fieldset's accessible name. |
| R4-09 | Settings / Add server | Dialog rules targeted the wrong DOM level. | Apply the native frame, gutters, title and mobile controls to DialogV2 Content. |
| R4-10 | MCP / Remove | Removal used the primary-action tone. | Use the established danger treatment. |
| R4-11 | Native warning role | Three consumers referenced an undeclared warning alias. | Resolve warning through the existing warm role in each palette. |
| R4-12 | Agents / Roster | Duplicate gutters compressed cards and a metric label. | Use shared responsive inner geometry and local compact metric insets. |
| R4-13 | Agents / Tabs | Mobile tabs had 37px targets. | Apply native 44px targets within the existing scroller. |
| R4-14 | Agents / Prompt editor | The counter wrapped into two or three lines beside Reset. | Allow the footer to wrap while preserving the whole counter and action. |
| R4-15 | MCP / Tools | A long endpoint expanded scroll width to 1234px and hid controls. | Shrink the text block and wrap the full redacted endpoint inside the dialog. |
| R4-16 | Native page reads | Unchanged dev returned valid page data after the original 10-second ready bound. | Use the original installation observations for exact internal page GETs while retaining all authority and source comparisons. |

## Teams: surface containment and readable field boundaries

The expanded administration content could outgrow the raised chat surface because the initial viewport constrained its intrinsic height. The scoped layout now grows around that content while retaining the original composer and scroll paths. The review includes wide, compact desktop and narrow views in both native themes.

Active empty fields previously had weak edges against their surrounding panel. Their local border now uses a 68% mix of the existing dim role; hover uses the dim role itself. The painted 1px stroke remains distinct from the 2px native keyboard outline. The regression measures the actual stroke color against both adjacent surfaces and verifies keyboard focus. The observed minimum edge contrast was 3.87 against the inner surface and 4.10 against the outer surface. These are component measurements, not a claim of comprehensive accessibility conformance.

The final combined shell run passed all 16 original Teams cases with the strengthened containment, border and focus checks. Six representative final originals were opened directly: 320px keyboard focus in both themes, 1440px expanded administration/chat, and 1280px expanded administration/chat. Additional automatically produced checkpoints are not represented as manually reviewed.

## Agents: useful space and coherent narrow controls

Agents now uses the shared `mx-inner` geometry. Removing the duplicated local gutter raises useful card width from 230 to 270px at a 320px viewport, and from 300 to 340px at 390px. The narrow top padding follows the native 28px value instead of accumulating to 52px. A local compact metric inset keeps the complete label inside its cell without shrinking the type.

The tabs retain their existing horizontal scroller and now have 44px targets rather than 37px. The prompt footer may reflow between metadata and Reset, while the entire character counter stays together. At the two narrow widths its former three-line/two-line counter now occupies one line. The original savebar remains 66px high, with no horizontal overflow and 44px actions.

All 27 original and added Agents cases passed. Thirteen final originals were opened, alongside twelve baseline originals. Draft editing, command intent, Escape and focus return remain exercised by the original journeys.

## Settings and MCP: native framing, complete text and action meaning

Add server now targets DialogV2's actual Content/container relationship. The local frame has the native 480px maximum width, 16px viewport inset, 24px body padding, 16px radius and 20px title. At viewports of 320, 390 and 1440px, the observed modal widths are 288, 358 and 480px. Narrow inputs/actions retain 44px targets. Field-linked error descriptions, retry behavior, Escape and return focus remain in the original flow.

MCP removal now uses the existing danger action. A separate Tools defect came from a long redacted endpoint refusing to shrink: it expanded the modal scroll width to 1234px and moved the header outside the viewport. The endpoint's text block can now shrink and wrap. At 320 and 390px, scroll width equals client width (286 and 356px), and the header begins at x=17 rather than x=-931 or x=-861. The full endpoint remains present with its existing credential redaction.

The warning role was referenced by three consumers without a declared alias. It now resolves through the existing warm role, including the selected palette. The measured native values remain #cfbd95 in dark and #4d390f in light. No new color family, blur layer or shadow treatment was introduced.

The final shared visual suite passed 24 cases; twelve final Add server/error originals were opened. MCP passed all 15 cases after the endpoint fix; nine final Tools/removal originals were opened. The earlier nine MCP captures are retained only as before/intermediate evidence and are not counted again as final coverage. Browser assertions preserve Escape, focus, exact action intent and zero writes in the read-only Tools flow.

## Native business and final areas

Planner Versions repeats the actual source name beside the action group below 640px. It does not substitute a fixture label or new identifier. The existing identity and accessible action labels remain authoritative; the extra visual label is hidden from assistive technology. This gives a narrow, horizontally scrolled action region enough context to identify the row.

Procurement overview cards use common label/value/note tracks. A wrapped label can no longer push only one neighboring value down. The established stacked mobile arrangement remains. The approvals table reserves the existing 180px identity-column budget, keeping request number and open-record action coherent.

Documents evidence selection fills its useful column and aligns value and revision to the same padded start edge. Confirmation remains a distinct action and occupies its own full row at narrow widths. The first successful run still showed centered candidate text; that inspection led to the follow-up repair. The final four-case original operations suite passed with the corrected alignment. Dark/light desktop and light 320px original JPEG previews were opened. This suite ran alone so the existing ClamD/filesPair installation recipe remained active.

Memory selects reserve 32px at the logical end for the native arrow. The first run exposed a specificity conflict: the shared form selector overrode the local reserve. The repaired local selector wins that existing cascade. The original geometry requirement remains unchanged; it was not reduced to accept the failed appearance.

Local administration now has one visible summary-settings heading. The same title also names the fieldset through `aria-labelledby`, preserving grouping without duplicate copy. The source's actual unavailable state remains visible.

## Repairing native page loading at its source

The original business journeys failed before reaching the new visual assertions. A separate diagnostic used the unchanged dev product and the complete original Procurement spec with sanitized HTTP timing observers only. In the first case, the valid CAP24 response arrived after 10.745 seconds; the original ready assertion had failed after its unchanged 10-second bound. The response completed with an `ok` envelope. The other three first-page reads were still pending after roughly 10.6–11.0 seconds. This established a server response delay rather than a missing UI assertion or invented test datum.

The host's full operational-health observation repeated unrelated native-operation probes while constructing exact internal page reads. The private `pageOperational` port now supplies those reads with the installation's original observations, including asset readiness. It is restricted to internal GETs at exact registered page paths. Public/context reads, other GETs and commands retain the full operational port. The existing CAP25 zero-probe path remains explicit.

This changes which operational-health source is used, without removing the original principal, binding, lease, abort, destination, access-revision or data-stability checks. Two equal observations and the final authority/source comparisons remain. CAP27 still consumes the original asset-health information needed for supplier attachment links and downloads. A missing optional page port retains the old behavior; a present but failing page port fails closed.

The request-context suite contains 53 cases, including controls for exact routes and methods, authority revocation, identity changes, failed observations, fallback and asset availability. Planner, Procurement, asset and installed-host regressions accompany it. The original browser readiness bounds, original per-test deadlines and retry:0 remain unchanged.

## Verification integrity and fixture maintenance

The expanded structural run initially passed eight outer checks and found two stale test setups. Both failures remain in the machine-readable ledger:

- Native web discovery selected the private installation parent even though the original host registers its physical workspace. The test now resolves that workspace through the existing `prepareSfLocalWorkspace` owner. Its original unauthenticated 401, authenticated 200, exactly-one-installation, schema and context assertions remain.
- The ownership test expected 403 for another actor who could not see the request. The original runtime intentionally returns 404 in that case. The existing 403 attack now uses requester + viewer roles, proves that the actual foreign record is visible and still requires unchanged state. A separate requester-only attack proves invisibility, requires 404 and again checks unchanged state. No production authorization behavior was changed.

These are test-setup corrections, not additional product fixes. The failed run is not counted as green qualification. No assertion was skipped, no retry added, and no deadline increased.

## Qualification and evidence boundaries

| Retained scope | Run | Cases | Result |
| --- | --- | ---: | --- |
| Teams / shared visual | [45207326593](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45207326593) | 40 | PASS |
| Agents | [45209024988](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45209024988) | 27 | PASS |
| MCP | [45209554231](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45209554231) | 15 | PASS |
| Documents | [45210521937](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45210521937) | 4 | PASS |

These retained runs currently establish 86 distinct browser cases. The original business and Memory qualification remains in progress. The consultation follow-up has completed successfully; its artifact and final original-image review are still being indexed. A failed combined Memory run is retained in the ledger and is not counted as final green coverage.

The expanded [gate 45217577648](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45217577648) passed all ten checks on product source `2d8b354742df54e65c28317500feea92b8155d7d`: app-shell/CLI/Sucafina types, E2E types, 78 guardrails against the exact pinned base, generation and byte parity of seven palette outputs, and 256 nested regression cases (13 comparison/layout, 103 browser-command/Teams, 136 page/domain/asset and four installed-context/Procurement cases). Strict Omni declared ten wrapper tests, observed twelve spawns and zero delegated executions, and passed its positive control.

This is an intermediate evidence checkpoint, not a merge receipt. Remaining producer repairs and the final documentation candidate must pass their original suites before the PR is merged.

The retained visual evidence uses default native skins, original source values and the production bundle. Component HTTP fixtures remain distinct from genuine isolated installation journeys. These runs do not establish live Microsoft account, OAuth or external model behavior. CSS viewport reflow is not browser zoom, and reviewer inspection is not owner visual acceptance.

Diagnostic-only UI61/UI62 copies and static stage markers were kept on disposable CI snapshots. Their original actions, assertions, time bounds and retry:0 were preserved. They do not enter the product branch and cannot substitute for the original full-spec qualification.

Product/source reads and writes used GitHub MCP. Execution used the existing Linux `test-ci` workflow with strict Omni and disposable `ci-run-*` snapshots. Local operations only inspected CI evidence. No workflow changes, guardrail approval bypass, local product checkout/build/server or production deployment were used.

The exact final documentation candidate, structural result and merge receipt are indexed in PR #718 after this evidence commit, avoiding a self-referential commit identifier.
