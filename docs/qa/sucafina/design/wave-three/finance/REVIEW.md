# Wave three — finance design review

Status: IMPLEMENTED, awaiting the integrated Actions run and visual critique of its real captures.

Branch: `sf-polish-finance`.
Pinned parent: `24c02f7f366ecea94a8511c88cdaf2bebcb46be6`, descended directly from the accepted `dev` snapshot `acc0181508ceda7416bce57284b2307a9b20385b`.

## Scope and ownership

Five native inventory areas: CAP05 (dashboard CAPEX), CAP14 (vendor contracts), CAP17 (Planner overview), CAP18 (Planner OPEX), and CAP19 (Planner CAPEX). Locale, theme, viewport, screenshots and repeated views are not additional inventory areas.

No changes to the legacy dashboard, host navigation, authority resolution, source adapters, command schemas, workflows, guards, allowlists, installation seed, or shared E2E helpers are included in this worker branch. The integration owner handles the shared frame, source navigation, real installation and Actions.

CAP05 retains the shared budget controller. Its detail component and entire stylesheet are isolated under `dashboard/capex` and `[data-sf-budget="CAP05"]`. The approved `sf-u39.ts`, `opex.css` and `opex-detail.tsx` are unchanged. Shared `surface.tsx` changes extend presentation to CAP05 while retaining CAP04's rendered geometry, copy, handlers and controller behavior.

## Geometry and visual decisions

| Concern | Implementation |
| --- | --- |
| Host canvas | Uses the shared wave marker and the integration owner's 1160px native page frame. |
| Typography | Native Orchestra body 13px, secondary 12px, record labels 14px, section labels 16px, prominent values 24px. No external font. |
| Materials | Existing `--mx-raised`, `--mx-soft`, `--mx-line`, `--mx-strong`, `--mx-dim`, `--mx-blue` and semantic states. No new palette or glass layer. |
| Rhythm | Named local 4/8/12/16/20/24/32px spacing tokens. Panel padding20px, reducing to16px in narrow containers. |
| Inputs and actions | Minimum44px controls and summaries, visible2px focus outlines, wrapping actions, explicit labels. |
| Editors | Maximum760px for contract, budget-line, project and review tasks. Fields use two columns where practical and one below420px. |
| Tables | Full-width source tables; CAP05/14 and Planner record lists reflow to labeled records below620px. Monthly grid preserves the original keyboard/paste/mobile controller. |
| Review | Existing draft, source/current/proposed and command confirmation remain authoritative. Other task content is hidden during review while its state remains mounted. |
| Missing values | Visible dash with accessible reason for source absence; actual numeric zero remains numeric0. No invented currency, default status or monetary total. |

The CAP05 ledger keeps the established budget geometry (860px scrollable desktop ledger, then labeled month records), source references in a disclosure, one annual budget anchor, and annual commands in a separate disclosure. The source-derived year and unspecified currency remain explicit once per view.

CAP14 uses a full list with supplier identity, searchable original values, source detail, read view and focused editing. All15 editable fields stay in their original groups: general, commercial, terms, evaluation and notes. Documents and decision links retain their original bound components and authorization. A row now opens its reading stage; the explicit Edit action opens the existing draft editor. Drafts remain mounted when switching to review.

CAP17 groups four producer metrics into one calm summary surface. The chart's coordinates are presentation only: scale, axis ticks, month labels, line segments and dots use existing source series. Missing points break the line; no value is imputed. The table remains present for exact source values. Comparison is grouped by selected fiscal year and retains the original version filter.

CAP18/19 separate Monthly plan, Lines, Projects (CAP19) and Plan settings (CAP18) with keyboard-operable local tabs. The original grid stays mounted across tabs. Creation, record management and review each occupy the focused editor stage. CAP18's existing save, spread, reset, delete, closed-through and split operations use the same original dispatch and revision checks. CAP19's source project approval values are rendered literally when outside the known label set; absent state is not presented as draft.

## Source and state coverage

| Area | Product states styled | Real journey planned |
| --- | --- | --- |
| CAP05 | List/filter/empty; detail12months; create/edit; month; deviation; annual entry; year hint; delete review; pending/unknown receipt; conflict/current source. | Source projects, long labels, zero month, absent months, monthly/deviation review, annual disclosure, responsive list/detail, create review. |
| CAP14 | List/filter/empty; source read;15field editor; creation; save/delete review; attachments/decision source; stale/denied/unknown notices. | Three canonical contracts, open/read/edit/revise, new contract, delete review without dispatch, source fields and narrow layout. |
| CAP17 | Selected year/version; original metrics; partial coverage warnings; source chart/table; same-year comparison. | Both canonical versions, source rows and comparison filter; dark/light and narrow views. |
| CAP18 | Monthly grid; lines; new line; record edit; save/spread/reset/delete review; closed period; split; paste preparing/review/partial/conflict/failure; source errors. | Original OPEX lines, edit/review/revise, creation, settings review, paste source preview, responsive stage. |
| CAP19 | Monthly grid; lines; projects; project/line editor; approval; investment dates; save/delete/spread/reset review; paste and source error states. | Original CAPEX lines/projects, project edits and source review, monthly and narrow views. |

The fixture must call original domains. The integration owner supplied `design-support/wave-three-seed.ts` at `dd84fe0a4cd735c7028d50d37190021f882cba43`: CAP05 months1–6 contain recorded values, month6 has real zero and months7–12 have no record. The producer normalizes contract amount absence to0; this is tested as an observed zero, never mislabeled as missing. Planner actual vectors support real nulls.

## Copy and invariants

All pre-existing English catalog entries were compared with the pinned parent and remain byte-identical in their values. New EN/BR keys are local to sf-u40, sf-u15, sf-u06 and sf-u07. Portuguese uses the existing native campaign terms (orçamento, realizado, previsão, fonte, responsável, revisão, projeto, vigência); source enum values and command payloads remain unchanged.

No producer calculations, forecasts, allocation, FX, totals, defaults, grants, source revisions, pending/unknown handling, idempotency keys, receipt contracts or CAS checks were replaced. The new chart calculates display coordinates only. Original English labels and source field identifiers are not redesigned into new business meaning.

## Validation and limitations

Repository work used GitHub MCP only. No local command, build, test, runtime, server or CI execution was performed by this worker.

Initial inspection verified JSX tag balance, local catalog key completeness, frozen English values and scoped style ownership. This is not a typecheck or visual acceptance. The integration owner will run the maintained Actions gates and the real-installation Playwright journey. Capture-based critique is pending and will be appended here before design acceptance.

CAP17 is read-only; no creation flow is claimed. CAP19 retains the original project/line edit flows; this wave does not invent an unsupported project-creation dispatcher. Error, denied, revoked and outcome-unknown states retain their real controllers and receive scoped styling; they will not be claimed as visually exercised unless the real Actions journey reaches them without mocks.

## Prepared real-browser journey

`packages/app-shell/e2e/sucafina/design-wave-three-finance.spec.ts` now uses the integration owner's `waveThreeTest` fixture without an import alias. The five-area journey exercises real CAP05 month confirmation, CAP14 contract confirmation and CAP19 project confirmation, plus non-dispatched annual/deviation/create/delete/spread reviews, original Planner paste preview, closed-month and element-split reviews. It verifies desktop and320px geometry, the12month grid including keyboard navigation to December, review action visibility and preserved drafts after Revise. A separate pt-BR browser context reuses only the genuine scoped session and sets the locale preference.

The newly added Planner wrapper and the existing contract wrapper explicitly fill their native flex host with `display:flex; flex:1 1 auto; inline-size:100%; min-block-size:0`. The journey also verifies a positive native scroller client height and actual scrolling in the long contract editor and monthly plan; horizontal reflow alone would not detect a clipped flex frame.

Known CAP05 status enums now use explicit local EN/BR presentation keys. Unrecognized source status text remains literal. Planner review field labels map canonical short paths (`desc`, `cur`, `alloc`, `cls`, `el`, `proj`) to their registered existing labels; empty values remain missing and boolean split states receive localized labels without changing payloads.

Official Playwright guides read before authoring: [best practices](https://playwright.dev/docs/best-practices), [auto-waiting](https://playwright.dev/docs/actionability), [assertions](https://playwright.dev/docs/test-assertions), [locators](https://playwright.dev/docs/locators), [network](https://playwright.dev/docs/network) and [test isolation](https://playwright.dev/docs/browser-contexts). Assertions use observable original UI outcomes, not wall-clock sleeps or mocked success.

The prepared journey is not a PASS claim. Integration execution and capture critique remain pending.


## First real Actions critique — 21 November 2026

Integration run [44939055525](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44939055525) passed the maintained all-specs gates. Real production-browser run [44939045347](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44939045347), job 136951971544, reached CAP14 editing after completing the CAP05 journey, including the confirmed source forecast change from 19,100 to 19,500. The run then stopped on an exact label locator for Vendor: the required-field asterisk belongs to the label text. There were no page or console errors in the failure diagnostics. The two Vendor locators now use the textbox's accessible name.

Fifteen canonical captures were emitted before the stop. Direct image inspection covered CAP05 dark desktop list and twelve-month detail, light 320px list and dark 320px review actions, plus CAP14 dark list, read stage, edit failure capture and light 320px list. CAP05's typography, alignment, real-zero/missing distinction, 44px actions and narrow review action stack were coherent. This is an acceptance of those observed states only.

The CAP14 narrow capture exposed a real collision: its metadata cells still inherited S01's fixed 44px height after conversion to flex cells, so a long contract name overlapped the following date. The scoped fix resets block size to auto and the real journey now measures content against the following cell. At the narrowest width the record-opening action sits below the vendor name. The source date stays on one line in the desktop table, and the unused actions column is removed. Search uses its short registered label as the visible placeholder, while the existing full search hint remains available through an accessible description.

The contract content stage explicitly reapplies the campaign's 13px body typography inside the native frame; numeric source amounts receive locale grouping only, with no currency invented and no value rewritten. The same inner-stage font inheritance is made explicit for Planner budgets. The contract source link has a 44px target.

Static review additionally identified a small-screen chart risk: scaling the entire CAP17 SVG to the narrow container could shrink axis labels below a useful reading size. Its plot now retains a 640px minimum in a named, focusable local scroller while the existing accessible source table stays intact. This adjustment remains awaiting its first real capture. The shared chart, S01, native frame and controllers are not modified by these corrections.

Re-execution and remaining CAP17–19 visual critique are pending. The first browser run is a recorded failure with a concrete correction, not a five-area PASS claim.


## Second real Actions critique

Maintained gates [44940199079](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44940199079) passed. Production-browser run [44940189566](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44940189566), job 136955469566, emitted 18 captures. The CAP14 320px image now shows the long contract name above a separate, intact end date; the new geometry assertion passed. The full editor, native scroller and narrow review actions also passed and were inspected directly. The input rhythm is now consistent with the 13px campaign body and the review's three 44px actions remain visible and ordered.

CAP14 confirmation still failed: the consumer displayed the original unavailable-source message rather than a verified-save notice. Both page and console diagnostics were empty. No success, receipt or write is inferred from this state. Its original command schema, codec and producer normalization are under investigation; no source contract or permission has been relaxed.

The journey is now split into two isolated native installations: CAP05/CAP14 and CAP17–19. This preserves every assertion and confirmation while allowing independent Planner evidence to execute. A temporary bounded diagnostic records only the CAP14 command's field names and types (including explicit undefined), plus observed POST status and public validation categories. It does not log field values, credentials, tokens, owner headers, stored records or fabricated results. The diagnostic attribute will be removed after the failure is explained.

The Planner's final confirmation now reuses the existing Confirm/Confirmar catalog entry for every admitted review action. Previously some project and settings confirmations displayed the entry action's Review changes text even though clicking submitted the command. The original English catalog values and all command handlers remain intact.

### Functional-state accounting

These are five campaign areas. The conservative journey covers 35 functional work states; themes, locale, viewport, repeated source variants, search emptiness and save notices do not count as additional screens.

| Area | Work states in the journey | Count |
| --- | --- | ---: |
| CAP05 | List; monthly detail; annual editor and review; deviation editor and review; monthly editor and review; project creation and review. | 10 |
| CAP14 | List; source detail; editing; edit review; deletion review; creation; creation review. | 7 |
| CAP17 | Overview, including source metrics/series and version comparison in one work state. | 1 |
| CAP18 | Monthly grid; producer paste preview; lines; line editor and review; line creation and review; settings; closed-month review; split review. | 10 |
| CAP19 | Monthly grid; projects; project editor and review; lines; line editor; spread review. | 7 |

The count describes the retained journey, not 35 newly created pages, and does not claim the as-yet-unreached Planner states have passed.
