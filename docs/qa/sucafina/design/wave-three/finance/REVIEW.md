# Wave three — finance design review

Status: VERIFIED for the five scoped native areas. The final real-installation Actions journey passed. Thirty-five functional states were exercised; 26 have dedicated imagery and nine were exercised without their own capture. The final evidence and limitations below supersede the pending notes in the historical execution log.

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

## Initial validation and retained limitations

Repository work used GitHub MCP only. No local command, build, test, runtime, server or CI execution was performed by this worker.

Initial inspection verified JSX tag balance, local catalog key completeness, frozen English values and scoped style ownership. This is not a typecheck or visual acceptance. The integration owner subsequently ran the maintained Actions gates and the real-installation Playwright journey. The historical failures, corrections and final capture-based acceptance are recorded below.

CAP17 is read-only; no creation flow is claimed. CAP19 retains the original project/line edit flows; this wave does not invent an unsupported project-creation dispatcher. Error, denied, revoked and outcome-unknown states retain their real controllers and receive scoped styling; they will not be claimed as visually exercised unless the real Actions journey reaches them without mocks.

## Prepared real-browser journey

`packages/app-shell/e2e/sucafina/design-wave-three-finance.spec.ts` now uses the integration owner's `waveThreeTest` fixture without an import alias. The five-area journey exercises real CAP05 month confirmation, CAP14 contract confirmation and CAP19 project confirmation, plus non-dispatched annual/deviation/create/delete/spread reviews, original Planner paste preview, closed-month and element-split reviews. It verifies desktop and320px geometry, the12month grid including keyboard navigation to December, review action visibility and preserved drafts after Revise. A separate pt-BR browser context reuses only the genuine scoped session and sets the locale preference.

The newly added Planner wrapper and the existing contract wrapper explicitly fill their native flex host with `display:flex; flex:1 1 auto; inline-size:100%; min-block-size:0`. The journey also verifies a positive native scroller client height and actual scrolling in the long contract editor and monthly plan; horizontal reflow alone would not detect a clipped flex frame.

Known CAP05 status enums now use explicit local EN/BR presentation keys. Unrecognized source status text remains literal. Planner review field labels map canonical short paths (`desc`, `cur`, `alloc`, `cls`, `el`, `proj`) to their registered existing labels; empty values remain missing and boolean split states receive localized labels without changing payloads.

Official Playwright guides read before authoring: [best practices](https://playwright.dev/docs/best-practices), [auto-waiting](https://playwright.dev/docs/actionability), [assertions](https://playwright.dev/docs/test-assertions), [locators](https://playwright.dev/docs/locators), [network](https://playwright.dev/docs/network) and [test isolation](https://playwright.dev/docs/browser-contexts). Assertions use observable original UI outcomes, not wall-clock sleeps or mocked success.

This was the prepared scope before execution. The final PASS below records the states actually reached and the exact capture count.


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


## Third real Actions critique and command-boundary proof

Production-browser run [44941864205](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44941864205), job 136960606195, ran both installations independently. CAP14 again stopped before sending any POST. The bounded input-shape observation contained all 15 ordinary values (14 strings and one number), with no undefined values. This disproved optional absence as the cause of that particular seeded edit. CAP17 reached its first real rendered overview, then stopped because a select's wrapped label included its option text and could not be addressed by the exact Version label.

The CAP17 capture was inspected directly. Its source summary and plot were intact, but Versions and Import occupied an isolated native secondary-action row. Both actions now sit in the same local toolbar as Year and Version, preserving their original admission and handlers. The select fields across CAP14 and CAP17–19 now have explicit localized accessible names. The comparison table has its own distinct accessible region name. Complete chart coverage remains available to assistive technology; partial-source warnings stay visible. The 640px plot scroller and source table remain unchanged.

A focused command-boundary regression then reproduced the CAP14 defect with the original schema and codec. Probe [44942933262](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44942933262) used the SSR condition, so its explicit real-proxy guard correctly rejected that environment. The browser-condition probe [44943193740](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44943193740), job 136964684727, established the actual cause: the tracked Solid store exposed two symbol metadata keys; the original input failed both the typed schema and codec, while a plain object snapshot passed both. Complete plain values and zero/string/empty/null cases passed. A separate source-shaped case also proved that own optional fields containing undefined cannot cross the JSON codec.

The minimal consumer correction is in vendorCommandInput: snapshot Object.entries into a new object and omit only undefined values. It does not coerce data, remove unexpected string keys, change accepted types, add page/action discriminators, relax schema/codec validation or alter CAS. Explicit null, zero and empty strings supplied to this DTO boundary are preserved. This is not a claim that the existing source-to-editor normalization preserves every source null; that separate normalization remains unchanged.

All four regressions now live in test-browser/sucafina-vendor-contract-command.test.ts, where the maintained browser condition creates the actual Solid proxy. The proxy test retains its environment guard and additionally verifies that later store edits cannot mutate the already-created DTO or the bytes bound to the digest. The temporary product attribute, shape logger, POST logger and probe logger have been removed.

The integration owner will run the focused regressions and both real finance journeys again. No CAP14 successful confirmation or unreached CAP18/19 state is claimed until those original-source checks pass.


### Focused browser-condition regression result

The corrected consumer passed [44943957335](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44943957335), job 136967042624: all four permanent browser-condition regressions passed with 27 assertions, including a tracked Solid proxy, immutable DTO bytes after a later store edit, omitted undefined optionals, legitimate zero and unchanged numeric-string/empty-string/null inputs. The schema, codec and producer remained unchanged. This focused PASS establishes command admission and snapshot stability; the production-browser journey is still required to establish successful source dispatch and readback.


## Fourth real Actions critique

Run [44943953560](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44943953560), job 136967031151, completed with one passing journey and one failing journey. CAP05/CAP14 passed in full: the source month write, contract write and verified reread, creation and deletion reviews without dispatch, responsive stages and pt-BR entry captures. CAP17's metrics, 12 source rows, both versions, explicit select labels and comparison filter passed. No console or page errors were reported in either installation.

The run emitted 27 captures. Direct inspection of the new CAP14 creation/deletion reviews and Portuguese list found no layout overlap. Creation review did expose a semantic defect: absent optional fields used the source-unavailable message. The field mapper now distinguishes absent values (Not provided) from an explicit empty string (Empty value), and never presents source failure for a blank draft. Known contract term enums reuse their existing localized labels; unrecognized values stay literal. Existing English catalog values and command values are unchanged. The creation journey now asserts these distinctions.

CAP17's desktop summary and narrow toolbar were visually coherent. On the narrow comparison capture, only version names fitted before the horizontal scroll, forcing a swipe to compare two numbers. That three-column comparison now reflows to labeled records below 620px; the full source-series table remains a horizontally scrollable table.

CAP18's actual native vertical-scroller check passed. Keyboard End correctly changed the active descendant to December, but the real capture still displayed January through May. The shared monthly grid did not scroll after its navigation callback. With integration-owner authorization, the smallest shared correction now brings the owner-selected cell into view using block/inline nearest after a keyboard navigation event. It preserves focus on the grid, all navigation callbacks, controllers and selection semantics, and performs no scroll on mount. The existing End-to-December assertion remains the regression. The integration owner will rerun prior-wave coverage because this path is shared.

A read-only peer review also identified two local control issues. The CAP19 approval placeholder is now disabled: empty string is not an accepted approval enum, and silently omitting it would turn the user's attempted clear into a no-op. The review groups in CAP14/CAP18/CAP19 are disabled while a command is in flight or its outcome is unknown; their local Cancel/Revise callbacks also guard those states. Existing reconciliation and source controllers are unchanged.

CAP19's confirmation assertion no longer relies on a transient status that the original reload immediately clears. It awaits the original project-save response, checks successful acceptance, waits for the review to close, and re-enters the native page to verify the persisted project description independently of the edit draft. This stronger confirmation has not yet run.

The remaining visual work is CAP18's post-navigation, paste, record and settings captures plus CAP19's project and confirmation captures. The fifth production-browser run is required; no completion claim is made for those unreached states.


## Fifth real Actions critique and projection limit

Run [44945246891](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44945246891), job 136971017970, again passed CAP05/CAP14 and completed CAP17 plus all ten CAP18 functional states. The original producer preview accepted the two pasted budget values for review; no pasted values were dispatched. Record editing, Revise/discard, line-creation review, closed-month review and split review all completed. Both installations reported empty console/page-error diagnostics. The six previously approved areas also passed their regression run [44945251668](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44945251668).

Thirty-eight captures were emitted. Direct critique covered CAP18's December grid, producer paste preview, focused 760px editor, 320px record-review actions, mobile source months, creation review, closed-month review and split review; the reflowed CAP17 comparison now displays both versions and both numeric values together at 320px. No new spacing or typography changes were requested from those observed editor/review states.

The December capture exposed a remaining functional layout defect: two metadata columns shared inline-start zero, so line identity and currency overlapped; the wave's translucent background override also allowed scrolled monthly values to show through the sticky cells. CAP18/19 now reserve distinct 260px line and 88px currency columns with matching sticky headers, retaining S02's original opaque native modal material. The shared keyboard scroll now measures the actual occupied inline boundary (including each sticky offset and RTL direction) and header height before calling nearest. The journey verifies that identity and currency do not overlap at December, and that Home returns January beyond both sticky boundaries while keeping grid focus.

CAP19 stopped on an incorrect test expectation, before its project editor. The original seed command supplies approval and investment dates, and runtime/planner.ts accepts and persists them. However, the admitted native projection in apps/cli/src/sucafina-product/native-ui/planner.ts (projects mapping) returns only id, name, revision, optional code/description and owner. It omits approvalState, investmentStart and investmentEnd. Their absence in the UI is therefore correct; no projection or producer contract is expanded by this design wave.

The English and Portuguese journey now verifies Not specified/Não informada and the two absent investment dates, including the disabled empty approval placeholder in the editor. It still changes only description, confirms the real original command, and freshly re-enters the native surface to verify the persisted description. The command's existing changed-field mapper omits untouched absent project fields rather than fabricating an approval or investment window.

The sixth execution is required to verify the strengthened sticky-cell regression and complete CAP19's remaining project/line states and Portuguese capture. This run reached 30 of the 35 planned states; CAP05, CAP14, CAP17 and CAP18 account for 28 completed states, and CAP19 reached its monthly and project-list states before the assertion stopped the journey.


## Sixth real Actions critique

Run [44946398674](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44946398674), job 136974566786, passed the strengthened grid assertions: December was visible, line identity and currency occupied separate sticky columns, Home brought January outside both sticky boundaries, and focus stayed on the grid. Direct inspection of the dark December and light January captures confirmed opaque, legible metadata and intact monthly values. CAP19 then reached its desktop/narrow project cards and narrow project editor with the admitted approval/date absences correctly displayed.

This run stopped on a test-matcher mismatch, before project confirmation. The log resolved the actual native option as `<option value="" disabled>`, but the generic toBeDisabled matcher reported enabled for that option. Both English and Portuguese assertions now inspect the native HTMLOptionElement.disabled property directly using toHaveJSProperty("disabled", true). The product markup and control behavior remain unchanged.

Forty captures were emitted with no console or page errors. The remaining execution must still complete CAP19 description save/fresh read, line/spread review and pt-BR editor capture. There are no further pending product adjustments from the inspected states.


Before the next run, the project-save response assertion was checked against the unchanged endpoint and transport: runtime/application.ts returns HTTP200 with top-level { ok: true, warnings?: ... } on an accepted domain command; SfDomainCommandCap19Save declares LegacyResult at POST {mount}/planner with fixed page CAPEX/action save; the client forwards that operation and the transport decodes its output without inventing a nested receipt. The browser assertion therefore checks response.ok() and the actual top-level ok:true, followed by an independent persisted-description read.


## Final verification and capture acceptance

Final production-browser run [44947193512](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44947193512), job [136976981561](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44947193512/job/136976981561), passed both isolated native-installation journeys in 3.6 minutes. Its snapshot is `8d8d8f9d573ca386d29ed65304fe62bb2c8d445b`, built from integration product `68ad2eec9d92bcd0a81823646c04678944487e85`. All 47 captures were emitted completely, with zero preview skips. All four page-context closure diagnostics contained empty console-error and page-error arrays.

The focused CAP14 command regressions remain PASS: [44943957335](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44943957335), four tests and 27 assertions using the real Solid browser-condition proxy and unchanged schema/codec. The final shared-product regression of the six previously approved areas also passed: [44946402767](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44946402767), two tests, 67 complete captures and zero skips. The last finance patch after that product snapshot changed only the option assertion and this report.

Direct final-image critique confirmed:
- CAP18 December preserves distinct opaque line/currency columns and readable source values. The Home assertion proves January is outside the sticky boundaries and grid focus is retained; the light January capture confirms the result visually.
- CAP19 project cards retain the real approval/date absences. The focused project editor and its 320px review actions remain within the native geometry.
- The confirmed-project image shows the revised description after a fresh native entry. The spread review preserves the original source values and its explicit lack of an impact preview, and was cancelled without dispatch.
- The pt-BR 320px project editor uses localized labels and preserves source text, with the same single-column reflow and native scroll.

No further product change is requested from these inspected states.

### Exact accounting

These are five campaign areas, not 35 new pages. Themes, locale, viewport, source variants, successful-save images and repeated visits do not create additional functional states. The count was independently checked by the People reviewer against the actual journey and capture names.

| Area | Functional states visited | States with dedicated capture | States without dedicated capture | Final images |
| --- | ---: | ---: | ---: | ---: |
| CAP05 — dashboard CAPEX | 10 | 7 | 3 | 11 |
| CAP14 — vendor contracts | 7 | 6 | 1 | 10 |
| CAP17 — Planner overview | 1 | 1 | 0 | 5 |
| CAP18 — Planner OPEX | 10 | 7 | 3 | 11 |
| CAP19 — Planner CAPEX | 7 | 5 | 2 | 10 |
| **Total** | **35** | **26** | **9** | **47** |

The 47 images consist of 26 principal state captures and 21 variants. The nine states without their own image were exercised by the passing journey; no separate visual critique is claimed for them.

### State-to-capture map

Capture names below are the canonical attachment names in the final Actions run. A representative image is listed for each captured state; additional themes, widths and locales retain their full names in the manifest that follows.

| Area | Functional state | Dedicated capture or evidence |
| --- | --- | --- |
| CAP05 | Project list | `CAP05-dark-desktop-list-test-data` |
| CAP05 | Twelve-month project detail | `CAP05-dark-desktop-twelve-months-test-data` |
| CAP05 | Annual editor | Functional interaction only; no dedicated image |
| CAP05 | Annual review | `CAP05-dark-desktop-annual-review-test-data` |
| CAP05 | Deviation editor | Functional interaction only; no dedicated image |
| CAP05 | Deviation review | `CAP05-dark-desktop-deviation-review-test-data` |
| CAP05 | Monthly editor | `CAP05-dark-desktop-month-editor-test-data` |
| CAP05 | Monthly review | `CAP05-dark-320-month-review-actions-test-data` |
| CAP05 | Project creation | `CAP05-dark-desktop-create-test-data` |
| CAP05 | Project-creation review | Functional interaction only; no dedicated image |
| CAP14 | Contract list | `CAP14-dark-desktop-list-test-data` |
| CAP14 | Contract source detail | `CAP14-dark-desktop-contract-detail-test-data` |
| CAP14 | Fifteen-field editor | `CAP14-dark-desktop-fifteen-field-editor-test-data` |
| CAP14 | Edit review | `CAP14-dark-320-review-actions-test-data` |
| CAP14 | Deletion review | `CAP14-dark-desktop-delete-review-test-data` |
| CAP14 | Contract creation | Functional interaction only; no dedicated image |
| CAP14 | Contract-creation review | `CAP14-dark-desktop-create-review-test-data` |
| CAP17 | Overview with metrics, series and comparison | `CAP17-dark-desktop-summary-and-series-test-data` |
| CAP18 | Monthly plan | `CAP18-dark-desktop-monthly-grid-start-test-data` |
| CAP18 | Original-producer paste preview | `CAP18-dark-desktop-original-producer-paste-preview-test-data` |
| CAP18 | Line list | Functional interaction only; no dedicated image |
| CAP18 | Line editor | `CAP18-dark-desktop-record-editor-test-data` |
| CAP18 | Line review | `CAP18-dark-320-record-review-actions-test-data` |
| CAP18 | Line creation | Functional interaction only; no dedicated image |
| CAP18 | Line-creation review | `CAP18-dark-desktop-create-review-test-data` |
| CAP18 | Plan settings | Functional interaction only; no dedicated image |
| CAP18 | Closed-month review | `CAP18-dark-desktop-closed-month-review-test-data` |
| CAP18 | Split review | `CAP18-dark-desktop-split-review-test-data` |
| CAP19 | Monthly plan | `CAP19-dark-desktop-monthly-grid-test-data` |
| CAP19 | Project list | `CAP19-dark-desktop-projects-test-data` |
| CAP19 | Project editor | `CAP19-dark-320-project-editor-test-data` |
| CAP19 | Project review | `CAP19-dark-320-project-review-actions-test-data` |
| CAP19 | Line list | Functional interaction only; no dedicated image |
| CAP19 | Line editor | Functional interaction only; no dedicated image |
| CAP19 | Spread review | `CAP19-dark-desktop-spread-review-test-data` |

### Exact original-source writes

There were **three confirmed mutations in the browser journey**, separate from canonical fixture construction:

| Command | Actual change | Confirmation |
| --- | --- | --- |
| CAP05 save-entry | January forecast changed from 19,100 to 19,500 on the seeded project. | Exactly one additional source POST; editor closed; the reread monthly detail showed 19,500. |
| CAP14 save | Notice period changed to 120 days and notes changed to the test's revised supporting evidence, in one command. | Exactly one additional source POST; verified-current-record notice; source detail reread showed 120 days. |
| CAP19 save, projects collection | Description changed to the revised infrastructure resilience text. | Original POST succeeded with top-level ok:true; review closed; a fresh native entry and project reopen showed the persisted description. |

CAP18 issued one original-producer monthly-preview POST for two pasted budget values and cancelled the preview without Apply. It was not a mutation. Annual/deviation/create/delete/closed/split/spread reviews were inspected or exercised and then revised/cancelled/discarded without dispatch. No destructive command was confirmed by this journey.

### Limits preserved in the delivered result

- CAP19's native project projection omits approval state and investment dates even when those fields exist in the underlying source. Both locales show and test the real absence. The wave does not expand the projection, infer approval or fill dates.
- The contract producer normalizes absent amounts to zero. Its zero is displayed as a real observed zero. The CAP14 DTO preserves null received at its boundary, but the pre-existing source-to-editor null normalization is unchanged; no end-to-end source-null preservation claim is made.
- CAP05 source months without a record and Planner null actuals remain distinct from recorded zero. No currency, source amount, source preview, calculation or receipt is invented.
- Owner/project identifiers remain source identifiers when the admitted projection does not provide a display name. The UI does not invent a person or project label for them.
- CAP17 is read-only. CAP19 retains its original project/line edit operations; this wave does not add an unsupported creation dispatcher.
- Error, denial, revocation, conflict and outcome-unknown behavior remains governed by the original source/controllers. These special states were not forced with mocks and are not included in the 35 successfully exercised work states.
- Widths 1440px and 320px, dark/light schemes and en-US/pt-BR were exercised. Actual browser zoom was not measured. RTL scroll-boundary logic is retained, but no RTL-locale capture is claimed.
- Nine functional states were visited without a dedicated screenshot, as listed above. The final acceptance is limited to the evidence actually collected.

### Complete final capture manifest

```text
CAP05-dark-desktop-list-test-data
CAP05-light-desktop-list-test-data
CAP05-light-320-list-test-data
CAP05-dark-desktop-twelve-months-test-data
CAP05-dark-320-monthly-records-test-data
CAP05-dark-desktop-annual-review-test-data
CAP05-dark-desktop-deviation-review-test-data
CAP05-dark-desktop-month-editor-test-data
CAP05-dark-320-month-review-actions-test-data
CAP05-dark-desktop-create-test-data
CAP14-dark-desktop-list-test-data
CAP14-light-desktop-list-test-data
CAP14-light-320-list-test-data
CAP14-dark-desktop-contract-detail-test-data
CAP14-dark-desktop-fifteen-field-editor-test-data
CAP14-dark-320-editor-test-data
CAP14-dark-320-review-actions-test-data
CAP14-dark-desktop-delete-review-test-data
CAP14-dark-desktop-create-review-test-data
CAP05-pt-BR-dark-desktop-test-data
CAP14-pt-BR-dark-desktop-test-data
CAP17-dark-desktop-summary-and-series-test-data
CAP17-light-desktop-summary-test-data
CAP17-light-320-summary-test-data
CAP17-light-320-version-comparison-test-data
CAP18-dark-desktop-monthly-grid-start-test-data
CAP18-dark-desktop-monthly-grid-december-test-data
CAP18-light-desktop-grid-test-data
CAP18-dark-desktop-original-producer-paste-preview-test-data
CAP18-dark-320-source-months-test-data
CAP18-dark-desktop-record-editor-test-data
CAP18-dark-320-record-review-actions-test-data
CAP18-dark-desktop-create-review-test-data
CAP18-dark-desktop-closed-month-review-test-data
CAP18-dark-desktop-split-review-test-data
CAP19-dark-desktop-monthly-grid-test-data
CAP19-light-desktop-monthly-grid-test-data
CAP19-dark-desktop-projects-test-data
CAP19-dark-320-projects-test-data
CAP19-dark-320-project-editor-test-data
CAP19-dark-320-project-review-actions-test-data
CAP19-dark-desktop-confirmed-project-test-data
CAP19-dark-desktop-spread-review-test-data
CAP17-pt-BR-dark-desktop-test-data
CAP18-pt-BR-dark-desktop-test-data
CAP19-pt-BR-dark-desktop-test-data
CAP19-pt-BR-dark-320-project-editor-test-data
```
