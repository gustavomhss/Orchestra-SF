# Second interface refinement round

This continues the visual audit merged in [PR #710](https://github.com/gustavomhss/Orchestra-SF/pull/710). The second pass is integrated through [PR #715](https://github.com/gustavomhss/Orchestra-SF/pull/715).

## Source and counting

- Base: `27f04c1cc723e42d5010b8f672a640b4792787ff`.
- Native browser source: `cf241b8f45eb2f00539a3465b6d14d57ea9fadc0`.
- Final product source: `9def26cfca6dfe61deb4142b5f78a8105d068a30`.
- The difference between those browser sources is only the phone-width Home footer rule in `packages/app-shell/src/orchestra/chapters/kpis.css`.
- Eleven unique observable issues are counted below. File, commit, theme and viewport totals are not fix counts.
- Product delta: 15 files. Existing E2E delta: six files. No one-off application or substitute source producer is used.

## Issue ledger

| ID | Area | Observed issue | Change |
| --- | --- | --- | --- |
| R2-R01 | S01 / CAP21 | Comfortable table sort controls are smaller than row actions and lack focus breathing room. | 44px sorting targets and tokenized header padding. |
| R2-R02 | S01 / CAP27 / CAP10 | Record Back is centered across its grid; title and actions are stacked even at desktop width. | Start-aligned Back and responsive title/action wrapper; adapt CAP10 local overrides. |
| R2-B01 | CAP28 | Seven stacked section links consume roughly 400px of a 320px-wide page before the fields. | Compact horizontal section navigation, full labels, native keyboard focus and unchanged anchors. |
| R2-C01 | UI49 | Observed differences heading abuts previous/current cards. | Apply the existing section rhythm to compatibility content. |
| R2-C02 | UI50 | Raw review ID dominates the narrow form; coverage and selection lack metadata rhythm. | Structured metadata and native disclosure preserving the exact review ID. |
| R2-C03 | UI69 | Review changes and Current source controls touch vertically. | Tokenized grid spacing inside the existing summary-state content. |
| R2-C04 | UI54 / CAP02 shared style | Proposal sections use near-white fallback borders and transparent surfaces with cramped headings. | Use native material/border tokens and existing section spacing. |
| R2-A01 | Home | Phone-width KPI absence labels exceed their reserved content width and extend into the card’s inner padding. | Single-column phone layout preserves complete state labels and values; 700px remains two columns. |
| R2-A02 | Skills | Failed save leaves the still-open dialog with focus on document.body. | After a failed save, restore the previously focused control only if document.body is active and the control remains inside the open dialog; leave other active controls untouched. |
| R2-A03 | Providers | Credential removal confirmation uses primary-action treatment instead of the existing destructive role. | Use the native danger role for Disconnect confirmation, retaining the original removal flow. |
| R2-A04 | Home footer | At 320px in Portuguese, footer provenance and actions stay side by side; 301px of content exceeds the available 278px and clips Configure tracking. | Stack footer information and actions at phone widths while preserving complete text and buttons. |

CAP10's stylesheet adjustment is part of R2-R02. The shared CAP02/UI54 material change is part of R2-C04. Neither is counted twice.

## Production browser qualification

| Selection | Cases | Original test-ci run | Source |
| --- | ---: | --- | --- |
| Home, Skills, Providers | 37 / 37 | [45114820142](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45114820142) | `9def26cf` |
| Planning and Procurement | 6 / 6 | [45114138448](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45114138448) | `cf241b8f` |
| Business, People and Portfolio | 3 / 3 | [45114141134](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45114141134) | `cf241b8f` |
| Native workflow matrix | 5 / 5 | [45114143066](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45114143066) | `cf241b8f` |

All 51 final browser cases passed with zero failed, skipped, flaky or retried cases. The superseded foundation run is diagnostic history, not part of the final green total.

All selections use the repository's original `test-ci` workflow, maintained production Playwright config, one worker, zero retries and strict Omni. The disposable snapshots differ from their recorded source only in `.ci-run.json` and the capture setting of `packages/app-shell/e2e/playwright.production.config.ts`. The requests, source SHAs and original artifact digests are recorded in `round-two-runs.json`.

The focal visual review records 17 Home/Skills/Providers checkpoints, seven Business originals, fourteen Planning/Procurement originals and twenty-one workflow originals. In the final Home/Skills/Providers artifact, seven original PNGs were opened anew; ten checkpoints were qualified by exact SHA-256 equality with originals already opened in run 45114133902. These are explicit reviewed checkpoints, not a claim that every generated PNG was inspected.

The reviewed states confirm complete narrow Home labels and footer actions, leading-aligned record navigation, complete table focus rings, native report-reference disclosure, separated workflow sections and quiet proposal materials. The native settings journey reaches the seventh section link with real Tab presses and activates the actual destination without an extra POST. UI54 also received a 2x analysis enlargement of an original screenshot to inspect its thin borders; this is not browser zoom.

The focal evidence has these limits:

- CAP10's existing spec does not capture its detail header at 320px; its desktop detail and narrower milestone panel were reviewed.
- CAP28's final-link interaction is EN/light/320. Portuguese evidence covers the initial narrow navigation and desktop.
- The CAP02 desktop reference chooser is captured while loading. A separate dark/320 related-area capture shows the selector ready; loaded choices were not opened in this review.
- The UI49 narrow comparison is captured at the beginning of its horizontal area. The UI50 fixture does not contain a long non-empty note. UI54's narrow capture covers the upper proposal metadata; later sections continue below that viewport.
- Skills failure recovery is qualified by the active-element assertion, not by claiming a new visible pointer-focus ring. The Home checks establish layout and programmatic scroll/focus reachability, not separate wheel-gesture coverage.


The native selections exercise original installed sources and commands. Home/Skills/Providers use their existing HTTP fixtures; their result does not certify a live external provider account or Microsoft integration.

## Diagnostic history

| Run | Result | Meaning |
| --- | --- | --- |
| [45113011429](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45113011429) | 26 passed, four failed | Confirmed Home in English at 320px content overflow and Skills focus loss. Two Portuguese cases had an invalid test locale key and did not qualify Portuguese pixels. The setup now uses the existing `br` key and checks the rendered language. |
| [45114133902](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45114133902) | 36 passed, one failed | All four Home state-label combinations passed. The newly reached Portuguese at 320px footer exposed a separate 301px/278px overflow, registered as R2-A04. |
| [45114820142](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45114820142) | 37 passed | Complete replacement Home/Skills/Providers selection after R2-A04; no failures, skips, retries or flaky results. |

The Home baseline measures text wider than its reserved content box; it does not claim every character was necessarily clipped. The later Portuguese footer screenshot directly shows the clipped configuration label. Skills focus restoration is established by the active element and the original regression assertion; pointer-origin focus can produce a screenshot identical to the unfocused error view.

## Final gate and evidence boundaries

[PR #715](https://github.com/gustavomhss/Orchestra-SF/pull/715) is the record for the final-head app-shell, E2E and Core typechecks, repository guards, generated palette byte parity, comparison/layout regressions and browser command/Teams regressions. It also holds the final source-to-snapshot mapping and merge receipt.

The pass preserves original source identities, financial values and absence, labels, payloads, CAS, authorization, native admission, pending/unknown recovery and command ownership. A refused or unavailable source remains refused or unavailable. No output-generation, external-account or go-live qualification is inferred from presentation tests. CSS reflow at 320/390px is not actual browser zoom, and automated checks are distinct from owner visual acceptance.
