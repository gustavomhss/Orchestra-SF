# Native Sucafina design integration

## Branch and source

The work branch `sf-design-polish` was created directly from `dev` at `948fab6ef2f8bbbcf2c8a6b787755a1d5713e6e1`. The inventory was committed before three real workers began the first three screens.

During implementation, native Web contracts [#572](https://github.com/gustavomhss/Orchestra-SF/pull/572) and native Web shell [#573](https://github.com/gustavomhss/Orchestra-SF/pull/573) merged upstream. The candidate now includes **dev `39355aa1988b33653151ddc8b76bc2dac55e55dd`** through integration commit `1359d9aebe1acd771e603ee821d1040d3f7432dd`. Dev is an ancestor, with zero behind at integration. The agent did not modify the shared dev branch or merge those upstream PRs.

The final upstream packages tree was byte-identical to the initially composed #573 dependency. Upstream apps/modules changes were adopted unchanged; the only upstream docs change was an unrelated Microsoft install guide. The candidate preserves that update and its own design documentation without overwriting either.

Product under review: **`41ea32b657ed2a9c170e544ac76ed6ecaaefe1ff`**. Subsequent evidence/documentation commits do not change the tested application or E2E source files.

## Actual product scope

Paths are relative to `packages/app-shell/src/orchestra/chapters/sucafina/`.

| Surface | Presentation files |
| --- | --- |
| UI29 · Today | `home/index.tsx`, `home/today.css` |
| UI33 · Cases / Decisions | `decisions/cases/index.tsx`, `create.tsx`, `cases.css` |
| CAP01 · Executive | `dashboard/executive/index.tsx`, `executive.css` |

The seven presentation files use native fonts, theme roles, radii and focus treatments. CAP01 source-navigation paint is additionally gated by the active CAP01 link in the existing navigation. Other dashboard tabs retain their source styles.

The following necessary corrections also change **`dashboard/executive/edit.tsx`**, shared with CAP03: remote synchronization runs inside Solid `untrack`. Its effect still observes incoming version/value and the draft controller. The original `receiveRemote` call reads and publishes draft state; subscribing to that internal snapshot recursively triggered the effect when a populated monthly editor mounted. The real browser exposed this as CAP01 becoming unavailable after month selection. The fix does not change draft transitions, owner checks, CAS versions, command payloads or confirmation rules. A second display-only branch, restricted to CAP01 + save-users, presents the base/current count with the existing localized numeric formatter and field label instead of adding a currency warning to a headcount; other operations retain their exact original numeric display.

This explicitly supersedes the initial plan to leave the shared editor file untouched. CAP03 markup/styles, `u02.css`, `n24.css`, global shell/frame/kit, palette sources, APIs, route registry and the legacy white/green interface are unchanged.

## Real capture path

The permanent Playwright spec is `packages/app-shell/e2e/sucafina/design-wave-one.spec.ts`. Its two `design-support/` helpers build the real Web app into private temporary files, serve it through a real installed CLI on its public origin, discover the genuine owner descriptor, and enroll once through the actual operator flow.

Source data is declared **isolated canonical-producer test data**, never a production/customer data claim. The test creates one decision through the actual inline review and confirmation. The Executive editor reads 128 users, prepares 129, opens review, cancels and discards back to 128 without saving. Missing annual-risk and meeting/change projections remain visibly unavailable.

The test retains authenticated/unauthorized controls, same-origin checks, source-authorized routes, keyboard clear/focus, whole-footer viewport assertions and page-error checks. Trace/video are off to avoid retaining the private enrollment URL. Failure diagnostics are bounded and redact credentials and URLs. Permanent E2E typecheck inclusion lists the exact spec, helpers and their transitive imports, with no compiler-option or exclusion change.

## Evidence and acceptance

See [VALIDATION.md](VALIDATION.md) for exact run verdicts and limits, and [evidence/README.md](evidence/README.md) for actual browser captures. Historical worker patches remain under `wave-one/` as the original delegation record; they are not full replacements for the refined product files.

No image baseline is automatically approved. User design acceptance remains a review of the finished result. The other 67 native surfaces are inventoried only.
