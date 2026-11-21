# First wave — reviewed implementation candidates

## Delivery status

**The three implementation candidates are source-reviewed and committed. They are not applied to the product and have not been rendered or visually approved.**

The integration branch `sf-design-polish` was created directly from `dev` at `948fab6ef2f8bbbcf2c8a6b787755a1d5713e6e1`. The complete initial packages tree contains no native Sucafina frontend, and the navigation and chapter router have no native Sucafina registrations. A later check of `dev` at `b5297b938735eab8ae37a686f01015f37c727724` still found the native directory absent; the two intervening commits modify no app-shell files.

The candidate source is the pinned native Solid frontend at [`sf-join-four @ fdeb988`](https://github.com/gustavomhss/Orchestra-SF/tree/fdeb988881c927f952a2d9fd5b8002c892f56635). This is a read-only reference, not the base of the integration branch. None of that frontend has been imported. Actual branch changes remain under `docs/qa/sucafina/design/`.

## Three actual delegated workstreams

Each worker branch starts directly at planning commit `20bd10681b83c51d1f5d369b7a438b58d57c9f18`, whose single parent is the selected dev base. The inventory was committed before delegation.

| Order | Screen | Worker branch and commit | Concrete candidate |
| --- | --- | --- | --- |
| 1 | UI29 · Today | [`sf-polish-today`](https://github.com/gustavomhss/Orchestra-SF/tree/sf-polish-today) · [`1a31738`](https://github.com/gustavomhss/Orchestra-SF/commit/1a317384bd0dcef67c924e5056dc059edfcf547b) | [Patch](wave-one/01-today/candidate.patch) · [Review](wave-one/01-today/REVIEW.md) |
| 2 | UI33 · Cases / Decisions | [`sf-polish-cases`](https://github.com/gustavomhss/Orchestra-SF/tree/sf-polish-cases) · [`2f87d46`](https://github.com/gustavomhss/Orchestra-SF/commit/2f87d4637b127056495a5ab46cca864f64d0b10c) | [Patch](wave-one/02-cases/candidate.patch) · [Review](wave-one/02-cases/REVIEW.md) |
| 3 | CAP01 · Executive | [`sf-polish-executive`](https://github.com/gustavomhss/Orchestra-SF/tree/sf-polish-executive) · [`73b7e5b`](https://github.com/gustavomhss/Orchestra-SF/commit/73b7e5bbd7b378fdfdd3a64d79442a2447ee0a60) | [Patch](wave-one/03-executive/candidate.patch) · [Review](wave-one/03-executive/REVIEW.md) |

The first three follow the native navigation: `/orchestra/sf-home`, `/orchestra/sf-decisions`, and `/orchestra/sf-dashboard/executive`. The remaining 67 surfaces are inventoried and unassigned. [README.md](README.md) lists all 70 surfaces; [inventory.json](inventory.json) preserves all 165 recognized routes and source blobs.

## Intended presentation changes

| Screen | Candidate changes | Retained boundaries |
| --- | --- | --- |
| Today | Native type hierarchy; readable attention/risk lists; aligned forecast values and provenance; structured case/routine resume; quieter but visible unavailable meetings/material changes | Existing read and ownership fences, resume preflight, source links, state messages and focus restoration |
| Cases | One list surface with aligned title, ID, version and action; aligned search; comfortable controls; full-width objective/criteria; balanced dates/currency; labeled inline review; clear primary action per creation stage | Original creation logic and field helper, operation checks, review/confirm stages, idempotency and lost-response recovery, labels and native links |
| Executive | Quiet section surfaces; comparable KPI columns and readable missing-value text; correct financial versus textual table alignment; named keyboard-focusable table scrollers; styling of the actual inline editor markup | Existing calculations, period filters, authorized links, private-state disclosure and review/confirm behavior; shared Budget components unchanged |

The current `DESIGN.md` quiet-glass direction and actual native theme/kit govern all three. New styles consume existing native font, color, radius and focus roles. Page-local spacing and container queries address the available workspace. These are design intentions backed by source changes; their rendered quality is not yet demonstrated.

## Exact proposed product scope

Paths below are relative to `packages/app-shell/src/orchestra/chapters/sucafina/`. None currently exists on the integration branch.

| Worker | Existing files modified by candidate | New stylesheet |
| --- | --- | --- |
| Today | `home/index.tsx` | `home/today.css` |
| Cases | `decisions/cases/index.tsx`, presentation in `decisions/cases/create.tsx` | `decisions/cases/cases.css` |
| Executive | `dashboard/executive/index.tsx` | `dashboard/executive/executive.css` |

The seven proposed paths do not overlap. Shared `n24.css`, `u02.css` and `edit.tsx` are unchanged. Executive replaces its own stylesheet import with the new CAP01 stylesheet; Budget retains the original import. Native HuGR shell, shared frame/kit, global palettes, routes, translations, APIs and the legacy white/green console are outside the patch scope.

## Independent integration review performed

The root reviewer fetched each committed artifact and reconstructed every unified patch in memory against the exact pinned source. Context lines, removal lines and hunk positions/counts matched for all seven postimages. Each worker comparison is one commit ahead of the planning commit, zero behind, with only its allowed documentation files.

| Check | Observed result |
| --- | --- |
| Today logic and selectors | Business prefix identical except CSS import; existing copy-key occurrences, state selectors and visible unavailable sections retained |
| Cases logic and copy | List logic/frame actions and creation implementation through its field helper byte-identical; existing UI33 copy-key set unchanged; added labels reuse existing keys |
| Executive logic and selectors | Prefix logic and copy/command identifier occurrences unchanged; existing selectors retained; diff limited to declared presentation/accessibility changes |
| Native style references | All new CSS variable references resolve in the inspected native theme/kit/frame or local stylesheet definitions; no literal color or new backdrop filter added |
| Shared-style isolation | Page-scoped selectors; Cases header paint explicitly gated to its create state; CAP01 rules confined to the CAP01 root |
| Additional peer review | Today worker reviewed the committed Cases candidate and relevant cascade; no material presentation, accessibility or scope regression identified in that bounded static review |

The hunk replay is artifact integrity checking, not `git apply --check`, compilation, a browser test or visual acceptance. Selector and token inspection cannot prove computed layout or contrast.

## What still blocks the requested UI delivery

The native frontend that the user is seeing must be identified and composed on the dev lineage before these changes can be applied. A wholesale import of the reference branch would include unrelated frontend, host and runtime work and has not been performed as part of this three-screen design pass.

After that dependency is resolved:

1. Verify the actual imported source blobs and rebase the small candidates where necessary. Apply the three bounded diffs to a complete dev-descended native frontend.
2. Run the scoped hosted checks in [VALIDATION.md](VALIDATION.md), including Cases authoring/recovery and CAP01/CAP03 nonregression. Typecheck, guardrails and palette verification are still pending.
3. Inspect real dark/light and generated-palette renders, long content, loading/empty/error/denied/stale states, keyboard use, table scrolling and open inline reviews. Review desktop, narrow layouts and actual 200%/400% zoom on these three screens.
4. Record actual screenshots, measured typography/spacing/contrast and the required `DESIGN.md` geometry addendum. Refine the result until the visual bar is met.

**Product integration, typecheck, tests/Actions, rendering, screenshots, palette generation/parity, measured contrast and visual acceptance are all NOT_RUN.** No PR, merge, deployment or visual baseline approval was performed.
