# First wave — delegated implementation record

The first three native Sucafina screens are implemented on `sf-design-polish`, descended from dev and synchronized with `39355aa1988b33653151ddc8b76bc2dac55e55dd`. Product candidate: `41ea32b657ed2a9c170e544ac76ed6ecaaefe1ff`. Current outcomes and actual browser evidence are recorded in [VALIDATION.md](VALIDATION.md) and the [capture gallery](evidence/README.md).

## Three actual delegated workstreams

Each worker branch starts directly at planning commit `20bd10681b83c51d1f5d369b7a438b58d57c9f18`, whose single parent is the selected dev base. The inventory was committed before delegation.

| Order | Screen | Worker branch and commit | Concrete candidate |
| --- | --- | --- | --- |
| 1 | UI29 · Today | [`sf-polish-today`](https://github.com/gustavomhss/Orchestra-SF/tree/sf-polish-today) · [`1a31738`](https://github.com/gustavomhss/Orchestra-SF/commit/1a317384bd0dcef67c924e5056dc059edfcf547b) | [Patch](wave-one/01-today/candidate.patch) · [Review](wave-one/01-today/REVIEW.md) |
| 2 | UI33 · Cases / Decisions | [`sf-polish-cases`](https://github.com/gustavomhss/Orchestra-SF/tree/sf-polish-cases) · [`2f87d46`](https://github.com/gustavomhss/Orchestra-SF/commit/2f87d4637b127056495a5ab46cca864f64d0b10c) | [Patch](wave-one/02-cases/candidate.patch) · [Review](wave-one/02-cases/REVIEW.md) |
| 3 | CAP01 · Executive | [`sf-polish-executive`](https://github.com/gustavomhss/Orchestra-SF/tree/sf-polish-executive) · [`73b7e5b`](https://github.com/gustavomhss/Orchestra-SF/commit/73b7e5bbd7b378fdfdd3a64d79442a2447ee0a60) | [Patch](wave-one/03-executive/candidate.patch) · [Review](wave-one/03-executive/REVIEW.md) |

The first three follow the native navigation: `/orchestra/sf-home`, `/orchestra/sf-decisions`, and `/orchestra/sf-dashboard/executive`. The remaining 67 surfaces are inventoried and unassigned. [README.md](README.md) lists all 70 surfaces; [inventory.json](inventory.json) preserves all 165 recognized routes and source blobs.


## Presentation changes

| Screen | Candidate changes | Retained boundaries |
| --- | --- | --- |
| Today | Native type hierarchy; readable attention/risk lists; aligned forecast values and provenance; structured case/routine resume; quieter but visible unavailable meetings/material changes | Existing read and ownership fences, resume preflight, source links, state messages and focus restoration |
| Cases | One list surface with aligned title, ID, version and action; aligned search; comfortable controls; full-width objective/criteria; balanced dates/currency; labeled inline review; clear primary action per creation stage | Original creation logic and field helper, operation checks, review/confirm stages, idempotency and lost-response recovery, labels and native links |
| Executive | Quiet section surfaces; comparable KPI columns and readable missing-value text; correct financial versus textual table alignment; named keyboard-focusable table scrollers; styling of the actual inline editor markup | Existing calculations, period filters, authorized links, private-state disclosure and review/confirm behavior; Budget presentation unchanged; the shared editor correction is documented below |

The current `DESIGN.md` quiet-glass direction and actual native theme/kit govern all three. New styles consume existing native font, color, radius and focus roles. Page-local spacing and container queries address the available workspace. The original patches were refined after real browser inspection. Current captures, coverage and limitations take precedence over the historical source-only reviews.


## Integration and review

The root reviewer replayed each worker's original patch against the exact native source blobs, preserving context and removals. These seven presentation files were then applied to the actual dev-descended frontend. The workers remained responsible for source and visual peer review of their own screen.

Real rendering led to further refinements: equal Today attention-card heights, native CAP01 subnavigation, accessible period selectors, unbroken signal dates, a compact Cases filter/refresh header, numbered criteria and localized source-absence copy. Narrow Today case titles now use the full row with the resume action underneath; CAP01 user-count review no longer attaches a currency warning. The Executive month-selection journey also exposed a self-subscribing remote-draft effect; a minimal untrack fix was applied and independently reviewed.

That editor is shared with CAP03. Its targeted functional fix is documented in [INTEGRATION.md](INTEGRATION.md); the initial source-only instruction to keep the file untouched is superseded by this concrete bug repair. No CAP03 visual redesign, shared CSS change, HuGR core redesign or legacy-interface change is included.

The `candidate.patch`, source locks and original `REVIEW.md` files under each worker directory preserve their **historical** context and NOT_RUN statuses at authoring time. Use the current validation report for what actually ran on the integrated product.
