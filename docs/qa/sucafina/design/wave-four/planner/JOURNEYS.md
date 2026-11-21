# Wave four — Planner journey and seed contract

## Canonical installation seed

Files:
- packages/app-shell/e2e/sucafina/design-support/wave-four-planner-data.ts
- packages/app-shell/e2e/sucafina/design-support/wave-four-planner-seed.ts

Export: seedWaveFourPlanner(snapshot: Snapshot, actor: Actor, environment: Environment, year: number): void.

Call after seedWaveThreePlanner in the existing Planner snapshot transaction. The helper requires the two wave-three versions for the selected year and writes only through PlannerModule.domain.execute. Rejection aborts installation setup. It never edits projection data directly, mints authority or fabricates a receipt.

Source-generated IDs remain dynamic. The exported waveFourPlannerData labels locate records in native rows and inputs. The helper does not return metadata because its consumers need names, currencies and accepted source values rather than predetermined IDs.

| Source | Canonical data |
| --- | --- |
| Entities | Regional services, Group operations; stable test labels and source IDs |
| Allocations | Shared infrastructure 65/35; separate unconfigured classification with no splits |
| Each seeded version | Three positions: full-year engineer, half-FTE specialist from April and excluded vacancy |
| Rate cards | USD annual132000 and separately recorded USD annual0 |
| Increase | 3.5%, effective month7 |
| FX | EUR1.08 with source reference, provider and prior-day observation; BRL with missing rate/provenance |

## Executable Planner journeys

Spec: packages/app-shell/e2e/sucafina/design-wave-four-planner.spec.ts.

Uses waveFourTest/enter/ready/observePage/scheme/reflow/capture/scrollPageTop/reviewActions from the common wave-four harness. Runs against the maintained production browser bundle and the real single-use enrolled operator session. No route interception, mocked authorization, substituted projection, grant or receipt is used.

| Area | Meaningful interaction | Confirmed original command and readback |
| --- | --- | --- |
| CAP20 | Open position; edit FTE; revise and cancel without a write; reopen ledger; inspect zero card; blocked roster preview | Headcount/save for positions; fresh native entry shows FTE0.9 |
| CAP21 | Filter; open detail and return; reject95% total; edit60/40; cancel/revise with values retained; inspect unconfigured detail | Entities & allocations/save; fresh detail shows60/40 |
| CAP22 | Filter currencies; distinguish absent BRL from EUR; edit provenance; cancel/revise; rejectUSD entry; discard | FX rates/save; fresh row shows1.09 and new observation |
| CAP23 | Open record; rename draft; cancel/revise; return to list; create a copy from a named source | Versions/save and Versions/copy; source-driven detail and fresh list prove persisted records |
| CAP23 comparison | Select distinct named versions; inspect twelve months; keyboard-scroll the local table | Read-only, with no additional Planner command |

The spec captures dark and light at1440px, narrow320px reading/editor/review stages, and BR desktop/narrow surfaces. It asserts document/frame reflow and records page errors. Source requests are counted so review-only steps cannot silently write. Both accepted business responses and independent fresh reads are required for committed edits.

UI30/UI31/UI32 journeys are owned by the integration root in design-wave-four-work.spec.ts. They exercise their real work/search/view producers using this group's product components. The split prevents two agents editing one spec while preserving coverage of all seven assigned areas.

## State map for review

| State | Presentation obligation | Authored coverage |
| --- | --- | --- |
| Loading | Existing state panels and pending indicator; no guessed values | Native entry/readiness helpers |
| Empty/filter-empty | Keep actionable filters and original source copy | CAP21/CAP22 filters; UI work spec |
| Missing/zero | Preserve semantic distinction | USD zero card, BRL missing rate and unconfigured allocation |
| Editor | Clear scope, readable fields, local draft owner | Position, allocation, provenance, version, source view |
| Review | Bounded layout, visible actions, no write before confirmation | All four Planner domains, plus root work spec |
| Revise/cancel | Return to original local draft without mutation | All four Planner domains |
| Confirmed | Require original response and current authorized source | Five Planner commands and root source-view save |
| Denied/locked/unknown | Existing state and command gates remain authoritative | Preserved implementation; exhaustive fault injection is outside this visual spec |
| Unsupported capability | Explicit unavailability and no invented action | Roster-impact absence; native V2 saved views |

## Evidence status

Authored, not executed by the Planner agent. All runtime, guard, type and visual results must be filled from the consolidated wave-four Actions run and its screenshot artifacts. Actual browser zoom is not measured by these viewport tests. Do not describe320px as measured browser zoom.
