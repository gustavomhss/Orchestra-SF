# Behavioral and financial presentation fixes

Implementation began at `dev` commit `e115b667d845822a1df5f523bbfd828ab57ca978`. The final combined code qualified here is `d522399b7542bb3fc2a12c516213be7f76098678`. Later closure commits change documentation only. Root owns the overall integration and merge.

All assigned findings have passing focused evidence. The eight original native finance, procurement and Planner cases are covered across the passing results below; overlapping runs are not added together. Historical mixed runs remain recorded as mixed results. The exact sources, snapshots, artifact hashes, measurements and independently reviewed PNGs are in [behavior-evidence.json](behavior-evidence.json).

## Findings and proof

| Finding | Resolution | Passing evidence |
| --- | --- | --- |
| BA-01 | Quarantine never-submitted drafts in document memory during a transport interruption. Restore only after the existing full F02 context, owner and authority-generation checks establish the same authority. Logout, revocation, principal changes and invalid provenance still purge private content. | Original production-browser reproduction passes after the controller change. Seven added controller cases cover multiple drafts, changed authority and purge. Existing uncertain-POST behavior retains one POST and read-only reconciliation. |
| BA-02 | Clear only the resolved transport-interruption notice, after the current runtime is ready, its stream is OPEN and every retained transcript is ready. Other notices, CONNECTING and failed transcripts remain distinct. | Valid-OPEN control fails before the fix and passes afterward: 13 browser cases. Two native DOM regressions cover successful recovery and OPEN with an unavailable transcript; combined controller/page group passes 33 cases. |
| BA-03 | Existing entities and allocations use localized Edit headings; new records retain Add headings. | Behavior4 CAP20/CAP21 verifies the edit heading and exact review scope. |
| BA-04 | Shared-table row-action context shows the authorized version name, year and status beside narrow-screen actions. Handlers and disabled conditions are unchanged. | Behavior4 CAP22/CAP23 verifies the full context at 320px, opens the exact source Delete review, cancels and observes no mutation. |
| BA-05 | CAP20/CAP22 review scope uses the source version name and year; CAP21 uses the record name or localized common-catalog label. Technical snapshot references remain available in Source disclosure. | Both complete Behavior4 Planner journeys assert the exact readable scope. No substitute reference or inferred identity is introduced. |
| BA-06 | Shared change-review deduplicates equivalent blocking reasons by key and normalized parameters, preserving order and distinct reasons. | Product owns the shared-component implementation. Behavior4's original unavailable roster-impact case shows exactly one reason and keeps Sync roster disabled. |
| BA-07 | Comparison titles remain outside horizontal scroll regions; identity headers stick with body labels. Fixed cells use an opaque semantic surface so moving values cannot show through them. | Behavior4 retains the original keyboard and endpoint assertions. Final CAP23 adds both themes, both native tables and both endpoints, with exact source identities, opacity measurements and eight reviewed original PNGs. |
| BA-08 | Desktop procurement metrics share intrinsic label/value rows through subgrid. The existing narrow label/value layout remains. | Requests5 measures the five English values; Behavior4's Portuguese case explicitly measures all five value tops, including the wrapped label. Spread must be at most 1 CSS pixel. |
| BA-09 | Approval references reserve 180px, leaving the flexible remainder for the subject. | Requests5 and Behavior4's Portuguese case measure each reference and localized Open action as one text line, contained in its own identity cell. Requests5 completes all eight original commands. |
| BF-01 | Annual amounts use locale grouping and the source/draft currency. Period zero and months use localized semantic labels. Numeric precision is not reduced to currency minor units. | Finance5 checks exact OPEX edit/create and CAPEX spread values, English and Portuguese closed-period labels, draft retention and original readback. |
| SYS-04, Planner portion | The warning border uses the existing `--orchestra-warm` token. | Integrated source and the final type, guard and palette gates. |
| SUP-R01, UI55/UI56 | Human-readable gap reasons and admitted file context lead; complete paths remain in disclosure. Populated categories stay separate and four empty categories share one compact summary. Closed category enums use localized labels. | The original import journey passes, including permanent UI56 reread and preserved UI57 receipt controls. All twelve Files6 UI55/UI56 checkpoints were independently reviewed; Files8 supplies the final composed native result. |

BA-06 and the changed/unchanged-field disclosure are supplied by the product branch. No grant, guard, producer codec, command payload, CAS binding or confirmation condition was relaxed.

## Final native qualification

| Run | Qualified cases and duration | Scope |
| --- | --- | --- |
| [Behavior4](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45226990144) | Suppliers 121352ms; settings 71385ms; all five procurement areas in Portuguese 143942ms; CAP20/CAP21 179668ms; CAP22/CAP23 414863ms | These five passing cases supply the non-finance/non-Requests portion of the original eight-case matrix. The run overall is **6 passed / 2 failed**; its passing CAP05/CAP14 case overlaps Finance5. |
| [Finance5](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45228241086) | CAP05/CAP14 243375ms; CAP17/CAP18/CAP19 203491ms | **2 passed, zero retries.** Includes original financial commands, CAS/payload/readback and localized reviews. |
| [Requests5](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45234374202) | Requests, sourcing and approval decisions 322080ms | **1 passed, zero retries.** Eight confirmed commands, eight original POSTs, no console or page errors. |
| [CAP23 final](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45261772401) | Fixed comparison identity 57609ms | **1 passed, zero retries.** Supplemental read-only opacity and source-preservation proof on the final code. |
| [Files8](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45236527715) | OP-IMPORT 150905ms; the complete file suite has five passing cases | **5 passed, zero retries.** System owns DOC/upload/export/scenario closure. This document owns import-preview presentation. |
| [Gates10](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45261780999) | App and E2E typechecks; 28 semantic cases / 122 assertions; 132 browser DOM cases / 1822 assertions; guards and palettes | **All six gates passed.** 78 guard rules, no errors or approved overrides, seven generated palette files unchanged. Includes both diagnostic-sanitization tests. |

The final CAP23 snapshot is `853f785464118b539d1c274d4c2cc2926afa39d9`; Gates10 is `240e9eb4fe9a5e4ae13d70848c5b3be9079d3740`. Both use source `d522399b7542bb3fc2a12c516213be7f76098678`. Existing case and action budgets, zero retries and original assertions remain intact.

### BA-08: measured Portuguese KPI alignment

The Portuguese result is not inferred from a screenshot or a route visit. In Behavior4's tested procurement spec, blob `f4d91f38b6548dff8c4164d1709df393f63ebae8`, the explicit CAP24 pt-BR branch calls `alignedMetricValues`. It requires exactly five `.sf-n21-metric dd` elements and measures `max(rect.top) - min(rect.top) <= 1` in the real browser. The same check runs in the English journey qualified by Requests5.

The original `CAP24-pt-BR-dark-desktop-test-data` PNG was independently reviewed: the first label wraps to two lines, while all five values remain aligned. The passing assertion establishes the one-pixel bound; the report does not invent precise coordinates that were not attached. Mobile containment is exercised separately by the existing reflow and capture sequence.

### BA-09: readable queue identities and completed decisions

The native assertion uses `Range.getClientRects()` for each rendered request reference and localized Open action. Each must occupy one text line, and its text bounds must remain within that exact identity cell. The check runs in English in Requests5 and Portuguese in Behavior4. The original dark/light desktop approval-list PNGs and the 320px PR-review actions were independently inspected.

Requests5 confirms these original operations: save PR, create PR, submit PR, save sourcing, approve PR, approve sourcing, reject PO and save PO. The preserved attachment records eight original `/sucafina/procurement` POSTs, with empty console/page error collections. Source identities, original/proposed review values and command effects remain checked.

The intermediate sourcing failure was an incorrect test assumption about the shared comparison disclosure. The evaluator changed; the selected quotation did not. The final test retains the original CAP25 response delivered during navigation, decodes it, and verifies the exact request number, selected quotation ID and matching supplier. It explicitly opens Unchanged fields and checks the original, current and proposed labels against that same source selection. The original proposed-value assertion remains. No additional source request, tolerance or mutation was added.

The four original procurement cases are registered once: Requests has its own supported named spec, and suppliers/settings/Portuguese remain in the original named spec, using one shared registration module. All 126 original assertion statements and the 420000ms case / 15000ms action budgets remain; the final module has nine additional assertions. There are still four cases, with no duplication.

### BF-01: exact localized values and source currency

Finance5 checks these exact strings in their respective review columns: `120,000 USD` → `126,000 USD` for the English annual edit, `36,000 USD` for creation, and `240,000 USD` for the unchanged annual value in the CAPEX spread review. Portuguese checks `120.000 USD` → `126.000 USD`. Closed-period review checks `All months open` → `February` and `Todos os meses abertos` → `Fevereiro`. Revise and Cancel preserve the original draft behavior.

The supported CAP14 fixture supplies USD only on its primary contract. Detail, editor and review display that original currency as read-only context; missing currency remains explicit on the other original records/new draft. The payload still has no currency edit, and USD survives the original save/readback. Ten selected Finance5 PNGs were independently reviewed, including Portuguese 320px annual/month reviews and contract detail/editor/actions. The report contains 49 PNG paths; that is not a claim that all 49 were independently inspected.

The CAP19 intermediate timeout followed an accepted original save: the test awaited a version query parameter that the default-version route does not emit. Commit `bd536912284d37b9e21220115616a2b797a1d793` matches the actual page/year read and verifies the selected version, project ID and exact saved description in the original DTO. No request is replayed and no deadline is raised. The planner evidence contains one save POST and the original paste-preview POST; two POST paths do not mean two saves.

## CAP23: opaque fixed labels

The Behavior4 endpoint PNG revealed a real visual defect: Actual and moving numeric values showed through the translucent fixed Month column. The local rule now uses `--surface-base`, the opaque shell-surface alias, for only the sticky identity header and body labels. The surrounding material, theme palette, source values and table semantics remain unchanged. The clean composition was `0765dc6f15ca0196061ce45a2ae291911f0a66e5` on `a4fb577`; root adopted that exact source before the final gate.

The focused native proof reads original CAP23 and two independently selected CAP17 responses. It decodes both source versions, verifies their IDs/year and names against the native selectors/headings, and requires five summary rows and twelve month rows. Both tables are checked at both horizontal endpoints in dark and light themes at 320px. Original table text is preserved, headings retain their horizontal position and no POST occurs.

The final attachment contains eight checkpoints and 76 checked sticky cells. Every cell reports alpha 255, opacity 1 and sticky positioning; all identity cells remain at x=42 in this fixture. Computed backgrounds are `rgb(14, 20, 27)` in dark and `rgb(233, 236, 240)` in light. All eight original PNGs were opened and inspected: the fixed identity is readable, and source text no longer shows through it. Source names, values and native scrolling are preserved.

The first focal run failed because it captured `innerText` and compared it with `toHaveText`'s default `textContent`; table cell separators differ between those APIs. The source values were identical and the first opacity checks had passed. Root's only test correction was `{ useInnerText: true }`, documented by Playwright's [locator assertion API](https://playwright.dev/docs/api/class-locatorassertions#locator-assertions-to-have-text). It preserves the exact content oracle, every endpoint, row count, source identity and no-POST assertion. The failed run remains recorded as failed, not as the final visual proof.

## Teams recovery and production measurements

The existing `team-profile-visual.spec.ts` HTTP fixture was measured before the session-controller edit. The audit reproduction was retained, with three observational timers that do not control readiness or replace assertions.

| Run | Result | Ready | Input observed | Recovery ready |
| --- | --- | ---: | ---: | ---: |
| [Base dev](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45205412569) | 12 passed, original draft regression failed: expected draft, received empty | 1093.04ms | 22.74ms | 161.79ms |
| [After controller fix](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45206772464) | 13 passed, exact draft restored, writes empty | 1009.63ms | 19.39ms | 150.16ms |
| [Composed controller and presentation](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45218615206) | 13 passed, exact draft restored, writes empty | 1016.89ms | 17.53ms | 156.51ms |
| [Valid OPEN control](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45221722913) | 12 passed, one failed: interruption notice remained after OPEN | 985.02ms | 17.03ms | 154.39ms |
| [Notice recovery fixed](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45223658325) | 13 passed, OPEN notice absent, exact draft restored, writes empty | 989.34ms | 19.23ms | 147.51ms |

The first three captures were READY/CONNECTING, which alone could not establish a stale warning. The test-only control sends a schema-valid session event on the new connection and observes the original recent-list GET caused by that event. It proves READY/OPEN before checking the warning. The pre-fix soft assertion allows evidence collection but leaves the result failed. After the fix, the same case passes, and finite EOF still brings back the interruption warning. Only the original installations/context/session/event GETs occur; writes remain empty.

The notice fix changes only `sf.teams.chatUpdatesStopped` recovery when the current runtime, stream and all retained transcripts are ready. It does not change authority checks or draft quarantine. Independent behavior/system review of the 390×844 before/after OPEN PNG confirms the exact draft is retained and the composer, including Submit, fits after the obsolete banner clears.

[Controller/native DOM run 45223698792](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45223698792) passes 33 cases / 300 assertions. The two added cases establish recovered draft/notice behavior and retention of the warning when OPEN coexists with an unavailable transcript. Existing unknown-POST, namespace, revocation and principal-purge cases remain included. The earlier corrected controller run passed 24 cases / 231 assertions; the first Bun request selected no tests because its path was interpreted as a filter, and is not counted as coverage.

These are one sample per state in Chromium/Linux with production assets and the existing finite synthetic HTTP authority fixture. They establish this scenario, not statistical performance equivalence, a flake rate, persistent live SSE, Microsoft/OIDC or every device/browser.

## SUP-R01: import preview hierarchy

UI55/UI56 lead with localized source-gap reasons and admitted file context. A gap is associated with a change only when exactly one full `change.path + :before/:after` matches the original producer convention. Ambiguous or unknown associations remain Source value; the UI does not infer business identity from a UUID or path. Source-provided field/sheet/row/column remain data, and complete paths and reason codes stay available in Source details.

The original import has four `missing` gaps for `desc` and `proj` in source and summary lines. Those four do not have an unambiguous cell association, so their headings remain Source value / Before import / Not provided by the source. Two populated disclosures show Added=4 and Changed=5. Removed, Unchanged, Ignored and Rejected retain exact zero counts in one collapsed summary. The six English labels are capitalized localized catalog values; Portuguese labels remain Adicionados, Alterados, Removidos, Sem alterações, Ignorados and Rejeitados. Source enums, counts and references are unchanged.

UI56's reread of the same original manifest is permanent coverage in the maintained operation journey. Both previews prove zero Apply requests before the original explicit confirmation. The original receipt proves one Apply, three changed fields, the changed record's token 1→2 and an unrelated token 1→1. Lost delivery is reconciled with explicit Refresh receipt and the independent receipt route. Cross-tab logout blocks the original context preflight; the separate viewer may export committed data but cannot read the owner's exact receipt. UI57's receipt totals, category presentation and authority checks from #713 remain intact. No #613 implementation was merged.

Files6 OP-IMPORT passed in 153797ms, while the separate DOC journey hit its original deadline; the full run was 3 passed / 1 failed. All twelve UI55/UI56 gap/category checkpoint paths were independently reviewed, representing eleven unique hashes, in English dark/light 1440px and dark 320px. Source labels, disclosures, action rows and the final Context and access menu remain contained. Files8 subsequently passes all five maintained operation cases, including OP-IMPORT in 150905ms. System owns the final file-suite evidence; this reviewer does not claim independent inspection of another Files8 image set.

## Original-response observers and diagnostic integrity

The initial composed native run failed before finding-specific assertions because the original reads were still in flight at DOM readiness checks. The helper now observes the real provider and route admission replies and each exact selected operation before applying the unchanged DOM assertions. Response bytes, HTTP/body status, installed owner tuple, source identities, CAS, negative controls and mutation counts remain checked. A preflight read cannot be mistaken for persistence: where required, the readback observer is armed after the accepted original POST body and before delivery to the application. No mutation is retried.

Two measured observer defects were corrected. `Response.finished()` could remain pending after the real application consumed both matching admission replies and rendered ready; only those two redundant completion waits were removed. Playwright 1.59.1 also removes a `times: 1` route handler before awaiting its asynchronous callback. Concurrent one-shot observers could empty interception while another original fetch was pending, leading to `Route is already handled!`. The observer now claims one request synchronously and stays registered through original delivery; close waits for its active callback before removing it. It preserves failure propagation, zero fetch retries and zero redirects. Complete Behavior4 Planner journeys, Finance5, Requests5 and the final two-source CAP23 proof qualify the maintained observer.

Historical Behavior3 remains 5 passed / 3 failed; Behavior4 remains 6 passed / 2 failed. Their exact failed cases and later focused replacements are retained in the JSON. The original fixture-context timeout in Behavior3 was not reclassified as success or given a larger deadline; later complete Requests5 provides the passing journey.

A cancellation error also exposed a closed fixture's ephemeral cookie in Playwright's diagnostic call log. The value is not copied into this record. Commit `1bffc2bc204e59e4976fe1d9603697f1f037a43e` constructs a fresh rejected error with useful method/path, category and status-assertion text, omitting credential headers, URL secrets, raw stack and nested cause. The actual transport, authority and failure result are unchanged. Both focused tests passed in Gates10, adding 21 assertions for retained rejection/classification and removed private diagnostics.

## Artifact index and limits

| Evidence | Artifact | ZIP bytes | SHA-256 |
| --- | ---: | ---: | --- |
| Behavior4 | 14847653309 | 123633920 | `5407eae56ef068c31406fb116b3d0bb235d930fabb5d018d9301267660e11f8c` |
| Finance5 | 14845742210 | 54361004 | `012879f0d46620b01de58a606fd0a2da5261d0c0cc26ac82eeb622fc90f02cbc` |
| Requests5 | 14849027318 | 26285756 | `76d6f9ac3b0a09f945bd9f9d71edcdd48e12b66ada07ec309f9eaf9e54e7c6ad` |
| Final CAP23 | 14860638005 | 1316235 | `d20260c33ee1de84324a5c8f708e0dfee2a94a22db5f410b42a1f453a8f764ff` |
| Teams valid-OPEN red control | 14842575691 | 23791456 | `2b3ca6381eea967e78e444f08dee0ac38e835741d3e609befd17d79198c2b6b2` |
| Teams valid-OPEN fixed | 14840793201 | 17880976 | `36163bf3250c5d012e7c8b3592dd6acccd11535d9740fc8995205e7326cbe5c5` |
| Files6 reviewed UI55/UI56 | 14844969385 | 45422898 | `f36faaea3394ba4384501b3e38831f6789e76abbea179a231d05b7c5335e50bf` |
| Files8 final composed | 14851385585 | 33268762 | `ee520812652c5bdf7fc3e19853857b0064bfb29a1687089421c96f3811a415ab` |

Native journeys use the original isolated installed producer and production assets in Chromium/Linux. They do not establish complete success of every route, live Microsoft integration, actual browser zoom, touch/wheel behavior or all browser/device combinations. Independent visual review is limited to the explicitly listed originals. Captured paths are not equivalent to distinct images, and passing observations from overlapping runs must not be summed as unique cases.

No product execution occurred locally. All execution used the repository's Actions `test-ci` path. Disposable CI request/wrapper files are absent from the product tree. No production writes, replacement producer, fabricated authority, retry-based admission, increased numeric deadline or CI allowlist change was introduced.
