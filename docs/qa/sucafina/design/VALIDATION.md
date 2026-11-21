# First-wave verification plan

## Current status

The target dev base is `948fab6ef2f8bbbcf2c8a6b787755a1d5713e6e1`; the native frontend reference is `fdeb988881c927f952a2d9fd5b8002c892f56635`. Native source and installed harness are not present in the target base. All product test, typecheck, render, screenshot and palette execution gates below are **NOT_RUN**. A reviewable patch is not an installed product.

This plan does not start CI or change any test/workflow. It names the existing source-backed checks that become meaningful only after the intended native frontend and its genuine installed harness have been composed in a dev-descended candidate.

## Required review before application

- Validate each unified patch against the exact pinned source blob. Refuse a mismatched source; review/rebase the small diff against the actual imported frontend instead of replacing newer files with old postimages.
- Keep edits inside Today UI29, Cases UI33 and Executive CAP01. Preserve `n24.css`, `u02.css`, Executive `edit.tsx`, shared frame, native shell, business/controller/transport modules and unrelated pages. Source snippets used only for review are not product changes.
- Reconcile shared imports: `n24.css` serves multiple decision screens; `u02.css` and `SfU02Edit` serve Budget CAP03. New scoped CSS must leave those consumers unchanged.
- Retain native DOM/source contracts used by existing tests: all `data-sf-*` identity/state/provenance selectors, Today resume focus behavior, actual absent/denied states and the explicit read→review→confirm command sequence.
- Review i18n literals/keys and authority/read effects separately from markup. No copy change, fabricated KPI, new command or hidden warning is authorized by styling.

## Existing regression inventory

All paths below are relative to `packages/app-shell/` in the pinned native source. Their presence is verified; their execution is not.

| Surface/risk | Existing checks | What they establish when run |
| --- | --- | --- |
| Today/UI29 | `e2e/sucafina/native/journeys/u01.spec.ts` | Authorized projection content, visible unavailable sections, 320 CSS px reflow, keyboard/pointer resume, return focus and late response cancellation |
| Native Today owner binding | `e2e/sucafina/native/journeys/u01-host231.spec.ts` | Original-case navigation, back focus, wrong/partial owner rejection and response cancellation on the actual installed shell; its own precondition requires F01/227/228/231 composition |
| Today resume mechanism | `test-browser/sucafina-native/today-resume227.test.ts` | Existing resume/focus and owner generation contracts |
| UI33 creation/edit/reopen | `e2e/sucafina/decisions-native-authoring.spec.ts` | Original creation/edit/reload/reopen and lost creation response reconciliation |
| Decision recovery | `e2e/sucafina/decisions-native-recovery.spec.ts` | Existing recovery paths remain intact around the authoring entry point |
| CAP01 and CAP03 | `e2e/sucafina/native/journeys/u02.spec.ts` | Source values, independent period, no write from filter change, shared Budget editor review and no private metric children in denied/expired states |
| Executive source actions/signals | `test/sucafina-native/executive-cross-links.test.ts`, `test/sucafina-native/executive-signals.test.ts` | Existing authorized destinations and signal semantics, if markup changes interact with their presentation |
| Installed visual captures | `e2e/sucafina/native/visual.spec.ts` | Genuine native frame/identity before screenshot, three first-wave chapter entries in Dark/Light; shared state/token captures across five additional palettes |
| Reflow and keyboard | `e2e/sucafina/native/accessibility.spec.ts` | Existing UI29 at 320 px, UI33 at 1024 px and CAP01 at 1440 px samples; actual focusable geometry |

The existing Q02 200% text-only case targets **Procurement CAP25**, not the three first-wave pages. It is not proof of first-wave zoom. Inspect 200% text and 400% equivalent reflow for each of the three actual pages when capturing them; never report coverage borrowed from another surface.

The current `u02.spec.ts` requires real installed environment inputs: `SF_NATIVE_E2E_EXECUTIVE_URL`, `SF_NATIVE_E2E_BUDGET_URL`, `SF_NATIVE_E2E_DASHBOARD_YEAR`, `SF_NATIVE_E2E_DASHBOARD_MONTH`. Missing inputs are a failed precondition, not permission to substitute a mock or skip assertions.

## Visual review matrix

Use the actual native app at the final composed SHA and actual authorized data, in English and pt-BR. Capture the ready state, genuine empty/error/unavailable/denied/stale states when the installed harness can produce them, long labels/IDs and relevant form/review states. Source review cannot establish actual computed typography, contrast, symmetry or clipping.

- Dark and Light: 1440×900 and 1280×800 desktop; 1024×768; narrow 390×844 and 320 CSS px usable reflow.
- 200% text scaling and 400% equivalent reflow on **each** first-wave page, including creation/review form and Executive editor when authorized.
- Relevant Graphite, Gruvbox, GitHub, Nord and AMOLED token resolution, with no unintended fallback color or missing font.
- Keyboard order, visible focus, label/field associations, disabled states and text wrapping. Existing inline editors stay inline unless a separately reviewed product change is requested.
- CAP03 Budget and other `n24.css` consumers: compare that loading a first-wave stylesheet does not change their computed appearance.
- Quantitative AA contrast (text 4.5:1, meaningful icons 3:1) in actual composite material; source token names alone are not measured contrast.

## Hosted cadence

After the full first wave is applied and reviewed, use the existing change-scoped Linux GitHub Actions path in `.github/workflows/test-ci.yml`, with one coherent composed candidate. No local product tests or typecheck, no broad `sf-ci`, no Windows/macOS lanes, no workflow rewrites for this design change. Use the repository's request validator and the actual installed harness; do not create a run that can only fail because native sources are absent.

Package typecheck and guardrail checks must run through the authorized hosted candidate, along with the relevant existing package tests. Record run URLs, exact SHA, verdict and selected tests. An old green on another tree is not acceptance of these patches.

## Palette parity

The current dev `orchestra/palette/generate.ts` has a fixed `PALETTE_SOURCES` list. It includes the native theme/kit but no Sucafina page files. Page-local rules consuming only existing theme roles should inherit the selected palette; this must be checked in the actual app. Rerun the existing generator/parity/contrast gate in the composed candidate as required by the design skill. Do not hand-edit generated output or add unrelated global stylesheet changes.

## Evidence rules

Missing screenshots, native mount, harness identity or reviewer-approved image baselines remain visible blockers. The visual suite intentionally fails on missing baselines. Never auto-accept a screenshot as design approval, replace expected images blindly, suppress an assertion, or describe the current document-only branch as green/visually complete.

References: repository AGENTS, Orchestra design/QA skills, and the source test contracts above. The E2E guidelines also require Playwright's official [best practices](https://playwright.dev/docs/best-practices), [auto-waiting](https://playwright.dev/docs/actionability), [assertions](https://playwright.dev/docs/test-assertions) and [locators](https://playwright.dev/docs/locators) when reviewing or changing tests.
