# Third interface refinement pass

This pass resolves **ten distinct issues** in the existing interface. It follows [PR #715](https://github.com/gustavomhss/Orchestra-SF/pull/715) and is integrated through [PR #716](https://github.com/gustavomhss/Orchestra-SF/pull/716).

- Base: `5b48dab52621037168ad4e3a6243c79a4fe5ad6e`.
- Product source: `0fd5f29298b654bf281a98dbe9f6707bfb798b6c`.
- Original browser matrix source: `4dd9e41604a4e49fe1e05396fd88fcb8f33ebb44`.
- The exact final documentation candidate, structural-gate result and merge receipt are indexed in PR #716. That receipt is written after this evidence commit to avoid a self-referential commit.
- Machine-readable runs, boundaries and all 63 qualified visual checkpoints: [round-three-runs.json](./round-three-runs.json).

## Issue ledger

| ID | Area | Observed problem | Resolution |
| --- | --- | --- | --- |
| R3-01 | Settings / Permissions | At 320px permission options are clipped and labels collapse to a narrow column. | Stack full-width copy above three equal 44px permission options within a narrow settings panel. |
| R3-02 | Settings / Models | Model names and metadata overlap Set as default in English and Brazilian Portuguese. | Keep logo and complete identity on the first grid row, with default/action and visibility toggle below. |
| R3-03 | Settings / keyboard focus | The permission segment clips the external focus outline, leaving mostly vertical traces. | Use an inset native focus outline on the radios; preserve keyboard order and locked states. |
| R3-04 | Providers / connection dialog | Connection dialog frame, title and header targets differ from the native dialog scale. | Scope native 16px radius, 20px title, 28px header actions and visible focus to this dialog; preserve existing glass. |
| R3-05 | Planner / native selects | Selected source/target version text paints under the native select arrow at 320px. | Reserve 32px of logical end padding for the native arrow; retain full option values. |
| R3-06 | Decisions / Assumptions filter | The all-state option is labeled Assumption under State. | Reuse the existing All/Todos key for value=all. |
| R3-07 | Decisions / filtered-empty state | Filtering out existing assumptions says no assumptions are recorded. | Use the existing filtered-empty message only for the filtered-empty state. |
| R3-08 | Decisions / return links | Back to case stretches across the entire work grid on three routes. | Reuse the existing start-aligned return class on Alternatives, Assumptions and Questions. |
| R3-09 | Decisions / selected-case context | Prepared changes and Receipts say Choose an existing case when a case is already selected. | Reuse Current case/Caso atual while preserving the exact source objective. |
| R3-10 | Providers / catalog refresh | Closing Configure cancels an older bootstrap query and surfaces the expected cancellation as a reload failure. | Ignore only the actual TanStack CancelledError in that bootstrap catch; preserve ordinary errors, refreshed data and disconnect failures. |

The count is ten observed problems. Files, commits, screenshots, viewport variants and the three return-link consumers are not counted as separate fixes.

## Settings: reading space, control separation and focus

The new baseline cases exposed a real defect before the CSS change. [Run 45120041464](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45120041464) passed the seven existing desktop cases and the new 390px case; the new 320px case failed. Thirteen permission rows overflowed by 7–34px. The Read row overflowed by 19px, and its Deny option was clipped.

The same originals showed a separate model-layout defect in English and Brazilian Portuguese: model names and metadata painted over the default-model action. Measuring only the direct child boxes did not detect that collision. The regression now measures rendered text fragments with `Range.getClientRects()`, checks them against action/badge bounds and requires actual text fragments to exist.

The view and panel now expose local size containers. Navigation changes to one column based on the available view width; narrow gutters retain useful space. Permission copy sits above three equal choices, and model identity occupies its own row above the actions. The visibility toggle keeps its native proportions. Wide panels retain the existing layout.

The permission focus outline is drawn inside the clipped segment. Both themes now show all four sides of the selected radio's focus ring. Arrow-key movement, checked state, locked tools and the exact ordered configuration patch remain verified. No permission controller was changed.

The final Settings cases use 320px dark/en, 390px light/pt-BR and 800px dark/en. Portuguese capture waits for the rendered “Idioma” label, in addition to the locale attribute. Every measured row has zero overflow; each of the three models has two rendered text fragments and zero intersections with controls in all three samples. At 800px the external sidebar is collapsed. The wide General and Permissions originals separately show the expanded sidebar and vertical section navigation.

## Providers: native dialog scale and a false error

The connection dialog now uses the existing native radius (16px), title size (20px), header actions (28px) and focus role. The title has natural height. Local variables hold the spacing values, and the stylesheet adds no background, blur, scrim or shadow layer. The change applies only to this provider dialog.

In the final review, a previous screenshot observation became a confirmed behavior defect. The title “Failed to reload providers” came from `toast.project.reloadFailed.title`, interpolating the basename of the test directory. Closing Configure calls the provider refresher; it cancels the exact old provider-query key before starting a new read. The bootstrap observer treated the old query's expected cancellation as a failure.

The repair checks the actual TanStack `CancelledError` class only in that provider-bootstrap catch. A normal error with the same message still follows the existing notification path. Missing-directory handoff, the refresher, request ownership and credential actions remain unchanged.

The existing bootstrap harness now has two additional controls. A real QueryClient and the production refresher cancel a held query, load a fresh catalog and avoid a failure notice. A plain `Error("CancelledError")` still requests exactly one notice. The [negative-control run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45123430979), using new tests with the old production code, produced **15 passes and one expected failure** at the spurious-notice assertion. The plain-error control passed. This diagnostic failure is excluded from final green qualification.

[Providers run 45123433733](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45123433733) passed all seven original cases at the final product source. The first case registers a GET waiter before Escape, matches the origin/path/directory, waits for HTTP 200 and transfer completion, then checks the ready list and absence of the false toast. The original genuine-failure-after-Disconnect case is unchanged and passed.

The updated confirmation original is clean. The picker contains the expected key-saved notice. Seven other reviewed provider checkpoints are byte-identical SHA-256 aliases of originals already opened from the initial shell run. Both narrow themes retain the native frame, complete error text and visible Back focus. Close focus is a browser assertion; the focus PNGs show Back.

## Planner and Decisions

Planner reserves logical end padding for native select arrows. At 320px the two CAP23 comparison selectors now keep text out of the arrow area. Long options still truncate in the closed native control at this width; complete values and options are retained. Desktop comparison names remain complete. CAP20, CAP22 and the CAP23 editor were checked for neighboring select behavior. CAP21's reviewed form/list regions remain intact and contain no visible native dropdown.

Decisions reuses existing translations and CSS roles. The Assumptions all-state option says All/Todos; a filtered empty list reports no results for the selected filters while a truly empty source retains its original message. The original journey exercises confirmed → empty result → all → two assumptions. Alternatives, Assumptions and Questions reuse the existing start-aligned return class and keep their 44px targets and original hrefs. Prepared changes and Receipts label the admitted case as Current case/Caso atual and preserve the exact objective.

No English dictionary entry was rewritten. Producers, source availability, IDs, financial values, confirmation payloads, authorization, CAS and recovery remain authoritative.

## Browser qualification

| Retained scope | Run | Cases | Result |
| --- | --- | ---: | --- |
| Settings, including the three new width/locale cases | [45121049011](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45121049011) | 10 | PASS |
| Original Planner and Decisions journeys | [45121051714](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45121051714) | 3 | PASS |
| Providers after the cancellation repair | [45123433733](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45123433733) | 7 | PASS |

This is **20 distinct qualified browser cases**, with zero failures, skips, flaky results or retries. The first shell run contained 17 cases; its seven Providers cases are superseded by the final seven-case run and are not counted twice.

The browser matrix ran on `4dd9e416`. The subsequent source delta contains only the provider cancellation guard, its two unit controls and the additional readiness assertions in the Providers spec. Settings, Planner and Decisions presentation/spec files and all styles remain byte-identical. Providers was rerun on `0fd5f29298b654bf281a98dbe9f6707bfb798b6c`.

## Visual evidence and limits

The qualified set contains **63 checkpoints**: 15 Settings/composer, 11 Planner, 28 Decisions and nine Providers. Fifty-six originals from the qualifying runs were opened; seven provider checkpoints use exact SHA-256 identity with previously opened originals. Attachment/report copies add no coverage. Each qualified path and hash is in the adjacent manifest.

The 1440px automatic checkpoint from the model/composer flow ends in Chat; it is not represented as a Settings Models screenshot. New Decisions pixel review covers UI35/36/37/39/40. Runtime coverage also retains the original UI34/38/41 journey. The observed prepared-change/receipt lists and UI41 model catalog remain empty; these states do not establish a successful native application or a live external model invocation.

Settings and Providers use their existing HTTP fixtures with the production bundle. Native Planner and Decisions retain their original registered producers and deterministic test data. This evidence does not establish live OAuth, Claude or Microsoft account behavior. The recorded narrow widths are CSS reflow, not browser zoom or owner visual acceptance.

## Final structural gate

Before merge, the composed documentation candidate must pass the existing `test-ci` workflow under strict Omni:

1. App-shell package typecheck.
2. Repository guardrails against the exact pinned `dev` base, with no approval bypass.
3. Regeneration and byte parity of the committed palettes.
4. App-shell E2E typecheck.
5. The 13 existing comparison/layout regressions.
6. The 100 existing browser-command and Teams regressions.
7. Core package typecheck.
8. All 16 provider-bootstrap cases, including the cancellation and ordinary-error controls.

The wrapper and CI request exist only on disposable CI snapshots. Product source was read and written through GitHub MCP; no local product checkout, build, typecheck, test or server execution was used. Local operations only inspected CI evidence. The final gate and merge receipt are linked from PR #716.
