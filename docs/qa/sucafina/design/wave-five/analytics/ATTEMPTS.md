# Analytics qualification attempts

This ledger preserves failed execution and the exact scope of the evidence. No screenshot in this folder is an approval or a fabricated result. Images are original Chromium screenshots from the installed native UI, decoded from the existing bounded preview log; the full canonical PNGs remain in the Actions artifact.

## Attempt 1 — diagnostic production bundle, development channel

- Source composition: `6931e774b963a2a8ab7a07e2fb89e9d777fdae2e`.
- Test snapshot: `00d145b52dedd28d3d1bedd06faf1e418e325097`.
- Branch: `ci-run-sf5analytics2`.
- [Run 44978115976](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44978115976), job `137072448099`, attempt 1.
- Existing workflow: `.github/workflows/test-ci.yml`; existing `e2e/playwright.production.config.ts`.
- Environment requested `ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER=strict`. It omitted `ORCHESTRA_CHANNEL=prod`; the screenshots show the development channel badge. This attempt proves neither the production channel nor completed UI42–UI46 journeys.
- Result: both grouped tests failed; no retries. The source fixture and original one-use enrollment completed for both installations. No page or console errors were observed.
- [Canonical artifact 14736393406](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44978115976/artifacts/14736393406): `playwright-ubuntu-24.04-1`, 5,747,526 bytes, SHA-256 `64391944d8bfb92f39861e467a0d7aa0c3da4243837f566cfda62c686e859a9d`.

### Observed failures

UI42's two independent original `decision-controls` reads returned HTTP 200 and `status:ok`; the fixture exposed two cases and two conditioned alternatives. The native page then displayed the preserved authority error and no case list. Its original readiness helper required the whole resource to be ready, even when the exact controls operation was independently ready in a partially available resource. The integration owner corrected that narrow adapter gate in `c75a561ed9fa634cc4fc7d289c755f708d79a2c3`, retaining exact family, exact operation, ready state and operational checks.

UI45 rendered all eleven questions in three families. Its desktop dark and light captures succeeded. The journey then resized to 390px before invoking the shell theme switch, which is absent from compact navigation. The failure was a test-helper ordering error, not a claim that mobile dark mode was rendered. Commit `072cfe4b75fb34b40c0e950da414089c077a8a75` chooses the actual native theme at desktop width before resizing to measure 390px/320px reflow.

### Actual image inspection

All four images below were emitted through the image tool and visually inspected. The UI45 desktop composition has a clear title, compact Context access, three aligned question families and legible question controls in both themes. The 390px failure capture shows a one-column catalog with readable wrapped titles and no visible horizontal spill; it remains a light-theme interrupted capture. UI42's error panel is legible and preserves the denial, but it supplies no successful scenario content evidence.

| Capture | Observed content | Qualification |
| --- | --- | --- |
| [UI42 denied desktop](attempt-01/UI42-denied-desktop.jpg) | Original error state, dark desktop | Failed admission; source content not reached |
| [UI45 dark desktop](attempt-01/UI45-dark-desktop.jpg) | Eleven questions, three native families | Visual inspection only; grouped test failed later |
| [UI45 light desktop](attempt-01/UI45-light-desktop.jpg) | Same original catalog, light theme | Visual inspection only; grouped test failed later |
| [UI45 mobile interruption](attempt-01/UI45-mobile-theme-interruption.jpg) | Light catalog at 390px | Interrupted before requested dark capture |

## Source preparation correction before requalification

The unchanged `four-decisions` fixture promotes source-only scenarios with no operations. The original controls producer publishes sensitivity parameters only for explicit finite replacement operations; a bare scenario title is insufficient evidence of an admitted parameter. The owned helper `wave-five-analytics-source.ts` therefore reopens an authorized Planner forecast and its issued pending-coverage receipt, selects its confirmed February monthly component, and promotes one explicit replacement hypothesis through the original `decision-promote` API. The hypothesis uses that component's exact amount, currency, period and identity. It does not edit a stored scenario, manufacture a sensitivity result, or patch admission.

The journey selects the newly published scenario by the original result reference and alternative identity, and selects its original parameter reference. The original seed remains unchanged. Empty authorized cases still receive their real no-units state. The final sensitivity assertion reads the persisted threshold proof and compares its actual sampled interval or unavailable reason with the UI. Pending coverage remains conditioned and no exact threshold or complete total is inferred.

Requalification must include both strict omni control and `ORCHESTRA_CHANNEL=prod`, using the composed integration source and the original installed endpoints.

## Attempt 2 — production channel, source admission and route diagnostics

- Source composition: `096224f666ed44974478e25ac227455aa4c81e99`.
- Test snapshot: `a24ad03151646a9a1bc8e50d130b8f427e217a2b`.
- Branch: `ci-run-sf5analytics3`.
- [Run 44979219065](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44979219065), failed test job `137075803565`, attempt 1, no retries.
- Existing production Playwright configuration, one worker, both `ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER=strict` and `ORCHESTRA_CHANNEL=prod`.
- [Canonical artifact 14737690500](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44979219065/artifacts/14737690500): `playwright-ubuntu-24.04-1`, 14,418,014 bytes, SHA-256 `d1841c5ba6986558dd16afd7aaac667b538201928171a342b75a5f2601dfc629`.
- Result: both grouped tests failed. No page or console errors were observed. This is partial runtime evidence, not a completed five-surface qualification.

### Original source reached

The original Planner parameter source read returned HTTP 200 / `ok`. Original `decision-promote` then issued one parameterized scenario using the confirmed February 2026 component, USD currency and exact source amount. Reopened original controls returned the new alternative, scenario and parameter identities. No source-only scenario was retroactively patched, and no portfolio or sensitivity result was inserted.

UI42 displayed two original authorized cases and the current source versions, including the main case at version 6 after the real promotion. All four list modes completed. The empty case correctly displayed no eligible scenarios, but the native Preview combinations button was absent and the history adapter displayed its failure message. The unchanged assertion expected the admitted preview action to exist and be disabled for an empty selection; it failed rather than relabeling absent access as a pass. Integration inspection identified missing native observations for the installed portfolio HTTP operations; the parent is correcting that composition under the original admission. No completed preview, portfolio result or sensitivity sample is claimed by this attempt.

UI45 rendered the eleven original questions, completed both desktop themes and 390px/320px modes, selected the original authorized BI01 context and loaded its original BI data. The first contextual UI46 navigation then failed native route recognition because the test passed a plain `BI01` path segment. The frozen route parser requires every parameter to use the existing `encodeSfRouteRef` codec. The owned test now imports that original codec for BI01/BI06/BI11, including Portuguese navigation; no route was added or relaxed.

### Actual image inspection and concrete correction

All twelve preserved JPEGs below were emitted as image output and visually inspected. The UI42 list has a restrained title and two balanced case rows at desktop; narrow layouts stack both full objectives, version labels and open actions without horizontal spill. The empty-case capture is legible and retains the source warning, empty candidates and history; it demonstrates the admission failure, not a successful workflow.

The UI45 desktop catalog groups eleven questions into three aligned native panels. In light mode, question text and borders remain distinct; at 390px/320px the groups become one column and labels wrap within their controls. Context selection groups the analysis and period controls in one band, with the authorized selection and original metadata below.

The BI result capture shows the source's partial-coverage header, but its plot and rows are below the shell's scrollable viewport. A full-page screenshot does not expand that internal viewport. The next specification retains context captures and explicitly scrolls to the actual plot and table for dark/light desktop and narrow evidence. It also reaches the named scroll regions through keyboard Tab/Shift+Tab before checking their focus outline. No screenshot has been edited or reassembled.

| Capture | Observed state | Limit |
| --- | --- | --- |
| [UI42 dark desktop list](attempt-02/UI42-list-dark-desktop.jpg) | Two original cases | List only |
| [UI42 light desktop list](attempt-02/UI42-list-light-desktop.jpg) | Same source versions | List only |
| [UI42 dark 390px list](attempt-02/UI42-list-dark-390.jpg) | Stacked full objectives | List only |
| [UI42 light 320px list](attempt-02/UI42-list-light-320.jpg) | Narrow reflow, visible open actions | List only |
| [UI42 empty case](attempt-02/UI42-empty-case-no-preview.jpg) | No eligible scenarios; history warning | Missing portfolio admission |
| [UI45 dark desktop catalog](attempt-02/UI45-catalog-dark-desktop.jpg) | Eleven original questions | Grouped test failed later |
| [UI45 light desktop catalog](attempt-02/UI45-catalog-light-desktop.jpg) | Original catalog | Grouped test failed later |
| [UI45 dark 390px catalog](attempt-02/UI45-catalog-dark-390.jpg) | One-column question groups | Grouped test failed later |
| [UI45 light 320px catalog](attempt-02/UI45-catalog-light-320.jpg) | Wrapped questions, no visible spill | Grouped test failed later |
| [UI45 authorized context](attempt-02/UI45-authorized-financial-context.jpg) | BI01 and original selection | Before read |
| [UI45 financial result header](attempt-02/UI45-financial-result-header.jpg) | Actual partial-coverage panel | Plot and rows outside viewport |
| [UI46 rejected unencoded route](attempt-02/UI46-invalid-unencoded-route.jpg) | Original invalid-link state | Test route corrected with original codec |

The next attempt must retain exact native context stamp checks, source-issued identities, original readback comparisons and the unchanged operation assertions. Runtime qualification of UI43/UI44/UI46 remains outstanding after this attempt.

## Attempt 3 — admitted operations, diagnostic lifetime and BI source identity

- Source composition: `72884298af5b1f22fa060dfea1d021ed73a308bd`.
- Test snapshot: `676a3d9eaf169fba8e6303525d239a08965dba06`; branch `ci-run-sf5analytics4`.
- [Run 44981425097](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44981425097), test job `137082540064`, attempt 1, no retries.
- Existing production Playwright configuration and workflow; both strict omni control and production channel.
- [Canonical artifact 14737943395](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44981425097/artifacts/14737943395): `playwright-ubuntu-24.04-1`, 25,207,682 bytes, SHA-256 `f5aed91c94608fd9d81ada17cc8f329175ad82643a1cfe74974e78786d23a74d`.
- Result: both grouped journeys failed. The browser emitted no page/console errors. Twenty-two captures were produced; eleven selected captures were emitted as images, inspected and persisted here. The manifest distinguishes inspected images from other canonical artifact captures.

### Proven original admission

Three actual native `ctx.context` responses returned HTTP 200 / `ok` with the exact installation/project/host binding. Every one of the seven targeted portfolio operations was `ready` and `operational:true`. Campaign/results resources remained `partial` because unrelated reconciliation/preparation/promotion operations were genuinely unavailable; sensitivity was `ready`. These original states are preserved in the manifest. No resource or grant was fabricated.

The original parameter-source read and real parameter promotion again returned 200 / `ok`. UI42 listed both authorized cases and reached the empty case with a present disabled Preview combinations action. Its existing history warning remained, so successful admission is not misreported as successful history read. Bounded native response-code diagnostics were added for the next attempt.

The first grouped test then aborted because its diagnostic listener continued acquiring context response bodies after the required reports. A later navigation evicted a CDP body and an unhandled acquisition promise failed the test. The interrupted screenshot shows the original loading state; it does not establish a denied main case. The correction settles all acquisitions to data or an explicit failure, keeps strict owner/body assertions at the two required reports, and detaches that listener after the empty-case report.

### Proven financial BI and observed source failure

The canonical encoded UI46 route succeeded. An independent original BI01 read matched all thirty-six rendered row identities and chart evidence/known-missing states. Fourteen observations were numeric; twenty-two were missing. The source's unspecified currency remained unspecified. Every numeric value was checked against the original response.

Dark/light desktop and 390px/320px plot/table captures completed. The named table region passed keyboard focus and outline assertions. The source action then produced no `bi-source` HTTP response and the test timed out. The original renderer passed only a reference ID; the catalog matched that ID across all observations and refused ambiguous matches. A repeated monthly source ID must retain its selected value ID and digest. The parent is correcting that exact native tuple boundary, preserving rejection of missing, duplicate or mismatched identity. The next test uses two genuinely published rows sharing a reference, when present, and checks each original request's value ID and reference digest separately.

### Visual critique and corrections

The financial plot has readable labels, bars and original values in both desktop themes. At narrow widths it retains the original 700px geometry inside a local horizontal scroller. A capture at the left edge contains dates but not the off-screen numeric labels. The next helper retains that view and adds a real rightward-scrolled capture; it does not resize or redraw the source chart.

The table captures exposed two concrete problems. Centering an oversized table captured middle rows without headings; the next capture anchors at the original caption/thead. Generic anywhere-wrapping split short words such as “Confirmed” and “unspecified” within cells. The owned CSS now preserves whole words in financial/operational value, unit and evidence columns while retaining local table overflow and wrapped opaque references.

| Inspected capture | Observed content | Qualification limit |
| --- | --- | --- |
| [UI42 empty case with admitted preview](attempt-03/UI42-empty-admitted-preview.jpg) | Disabled action, real empty candidates, retained history warning | History not yet proven |
| [UI42 interrupted loading](attempt-03/UI42-interrupted-loading.jpg) | Loading after diagnostic acquisition failure | No result qualification |
| [UI46 dark desktop plot](attempt-03/UI46-plot-dark-desktop.jpg) | Original monthly budget values and bars | Source navigation failed later |
| [UI46 light desktop plot](attempt-03/UI46-plot-light-desktop.jpg) | Same original values | Source navigation failed later |
| [UI46 dark 390px plot left edge](attempt-03/UI46-plot-left-dark-390.jpg) | Original date labels, local horizontal scroller | Numeric labels off-screen |
| [UI46 light 320px plot left edge](attempt-03/UI46-plot-left-light-320.jpg) | Original date labels | Numeric labels off-screen |
| [UI46 dark desktop middle table](attempt-03/UI46-table-middle-dark-desktop.jpg) | Known and missing actuals; source references | Heading outside viewport, short-word wrapping |
| [UI46 light desktop middle table](attempt-03/UI46-table-middle-light-desktop.jpg) | Same source values | Same capture/wrapping issues |
| [UI46 dark 390px middle table](attempt-03/UI46-table-middle-dark-390.jpg) | Genuine missing observations | Heading outside viewport |
| [UI46 light 320px middle table](attempt-03/UI46-table-middle-light-320.jpg) | Genuine missing observations | Heading outside viewport |
| [UI46 source action without request](attempt-03/UI46-source-action-no-request.jpg) | First original monthly source action invoked | Missing exact value binding |

UI43, UI44, operational BI, Portuguese final states and completed source navigation remain unqualified after this attempt. The next production run must resolve the concrete failures and retain these receipts.

## Attempt 4 — exact BI request, destination admission and portfolio transport

- Source composition: `7a9e0696ff353d9352938abd2c5527d76f0a47b1`.
- Test snapshot: `fc7e2584abbf9a9f647b58f38c98415a284a3d94`; branch `ci-run-sf5analytics5`.
- [Run 44982724281](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44982724281), job `137086553639`, attempt 1, no retries.
- Existing production Playwright configuration and workflow, strict omni control and production channel.
- [Canonical artifact 14738631409](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44982724281/artifacts/14738631409): `playwright-ubuntu-24.04-1`, 20,224,029 bytes, SHA-256 `95a47f76dbc963879f3131f72ec274ce9de8b961bf38ce841ce2e7007b1de3b4`.
- Result: both grouped journeys failed. No page or console errors were recorded. Nineteen captures were produced; thirteen were emitted as images, inspected and saved in this attempt folder. Remaining captures exist in the canonical artifact and are explicitly marked unreviewed in the manifest.

### Context diagnostic failure and original route diagnosis

The parameter source read, original parameter promotion and controls readback again succeeded. UI42 displayed both authorized cases with their original versions. One actual mounted context response returned 200 / ok with the exact owner tuple and all seven targeted portfolio operations ready/operational. A concurrent context request lost its CDP body during navigation. The diagnostic required every collected body to be readable and failed before the first capture matrix. The screenshot records the real list, not a completed portfolio evaluation.

The next diagnostic observes the exact native context URL, verifies its installed origin, mount and three selector values, and explicitly reopens that original endpoint with the authenticated APIRequestContext at each required point. It still requires HTTP 200, status ok and the exact original owner stamp. It records acquisition as an authenticated original readback, not as the body of a cancelled native request. No readiness value is substituted.

Read-only source investigation also isolated a transport defect. The canonical `SfPortfolio` family contains ten operations whose original inputs are closed and contain no top-level `surface`. Their catalog routes use `{mount}/{surface}`; the generic transport consequently rejected the unbound segment before HTTP. The original portfolio HTTP consumer accepts the installed dashboard page. Commit `3c308e8dcae615ad3d1fa8c0adeff89d3d44c73a` resolves that source page separately from the unchanged input, recognizes only the original family, and adds fourteen pure codec/URL regressions. It changes no schema, registry, permission, producer or admission. Renderer IPC still receives the original wire input. No additional D01 broker URL construction was found in the installed desktop composition. This patch was made after the attempt and awaits hosted validation.

### Financial BI request and remaining destination boundary

UI45's original eleven questions, real BI01 context, result and desktop/mobile captures passed. UI46 matched all thirty-six original row identities, fourteen numeric observations and twenty-two missing observations. Exact source values, evidence, period and unspecified currency were preserved.

For the first genuinely published value, the native action now sent `bi-source` to the exact installed origin/dashboard with the current selection, its original value ID and its original reference digest. The original HTTP response was 200 and contained one source link. The navigation region rendered, but its filtered list contained zero anchors; the grouped test failed before opening the second same-reference value. The parent traced this to an existing destination filter that accepts legacy mounted pages while the original source publishes native Orchestra routes. The native route/owner boundary is being corrected separately. This attempt proves the first exact request/response, not completed source navigation, the two-value regression, operational BI or Portuguese end states.

### Visual findings and subsequent correction

The original monthly bar values are readable in both desktop themes. New narrow captures scroll the actual local chart container to show its numeric labels at 390px and 320px, alongside the separately captured left edge. No source geometry or value changed.

Anchoring table captures at the caption exposes the heading and source limitations. The earlier cell rule did not override the child `.sf-numeric` anywhere-wrapping; “Measure”, “Effective” and “unspecified” still split within words at narrow widths. Commit `e700e17276b134484350425861fcb8a22e4fdbc4` changes only this financial/operational table's wrapping, including the numeric span, while keeping opaque references breakable. The screenshots below deliberately preserve the observed defect; they are not final corrected previews.

| Inspected image | Observed state |
| --- | --- |
| [UI42 list at diagnostic failure](attempt-04/UI42-context-diagnostic-failure.jpg) | Two real cases; diagnostic failed before the list matrix |
| [UI45 dark desktop catalog](attempt-04/UI45-catalog-dark-desktop.jpg) | Original eleven questions in three families |
| [UI45 dark 390px catalog](attempt-04/UI45-catalog-dark-390.jpg) | Stacked source question groups |
| [UI45 light 320px catalog](attempt-04/UI45-catalog-light-320.jpg) | Wrapped question text and original family labels |
| [UI46 dark desktop plot](attempt-04/UI46-plot-dark-desktop.jpg) | Original monthly values and unspecified currency |
| [UI46 light desktop plot](attempt-04/UI46-plot-light-desktop.jpg) | Same original geometry and values |
| [UI46 dark 390px scrolled values](attempt-04/UI46-plot-values-dark-390.jpg) | Right side of the original local chart scroller |
| [UI46 light 320px scrolled values](attempt-04/UI46-plot-values-light-320.jpg) | Original values remain readable |
| [UI46 dark desktop table](attempt-04/UI46-table-heading-dark-desktop.jpg) | Caption, source limitations and value rows |
| [UI46 light desktop table](attempt-04/UI46-table-heading-light-desktop.jpg) | Original values; numeric span still breaks a word |
| [UI46 dark 390px table](attempt-04/UI46-table-heading-dark-390.jpg) | Whole-word correction still needed |
| [UI46 light 320px table](attempt-04/UI46-table-heading-light-320.jpg) | Local table overflow; whole-word correction still needed |
| [UI46 source action after exact request](attempt-04/UI46-source-request-links-filtered.jpg) | Original response received; destination filtered from link list |

UI43, UI44, a completed UI46 source journey and the final Portuguese states remain unqualified after this failed attempt. The next composed production run must exercise the fixes and retain these failed receipts.
