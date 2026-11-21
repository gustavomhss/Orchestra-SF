# Wave two — native Sucafina design

Status: **ACCEPTED_FOR_INTEGRATION**. User authorized this wave with “do it” after approving wave one, then praised the delivered result and instructed completion of the merge to dev. The exact statements and fresh integration verification are recorded in [DEV-INTEGRATION.md](DEV-INTEGRATION.md); the merge event is recorded by [PR #583](https://github.com/gustavomhss/Orchestra-SF/pull/583).

## Branch and reference

- Integration branch: [`sf-design-two`](https://github.com/gustavomhss/Orchestra-SF/tree/sf-design-two), created directly from `dev bcdc109326de02e20c01c32ffb6b00bee3ff978d`.
- Verified product: [`5012d7adf0e5d02576fe6a0add6f79331a812137`](https://github.com/gustavomhss/Orchestra-SF/commit/5012d7adf0e5d02576fe6a0add6f79331a812137).
- Approved reference: `sf-design-polish 8f18ca831df7b144d843e6b0b3477825abe88e46`.
- The first-wave approved product is `245e15bf10b5c5287fa9338aa98d0adb28aeda76`; its images and explicit user acceptance remain unchanged.
- The approved first-wave tree was integrated onto the current dev tree. Forty of the 41 upstream-changed paths are preserved byte for byte; one exported return type required a type-only annotation. See [integration](wave-two/INTEGRATION.md).
- The original delivery did not modify shared dev. Subsequent integration to dev is explicitly authorized through PR #583. Deployment is outside this change.

## Three independently assigned surfaces

| Surface | Screen | Agent / branch | Delivered composition |
| --- | --- | --- | --- |
| CAP02 | Hot Topics | `redesign_topics` / `sf-redesign-topics` | One readable list; separated detail, 760px editor and dedicated review; consistent metadata and fields; confirmed save and fresh re-edit |
| CAP03 | Visão do orçamento | `redesign_budget` / `sf-redesign-budget` | Compact year toolbar; metrics and OPEX/CAPEX ledger in one financial surface; honest scope/absence; annual settings and focused review |
| CAP04 | OPEX: realizado e previsão | `redesign_opex` / `sf-redesign-opex` | Aligned list and filter; full-width identity/annual-budget detail; monthly ledger; focused editor and review; narrow reflow |

These are positions 4–6 in the [70-surface inventory](inventory.json). With the three approved first-wave screens, six have been reworked and **64 remain inventoried**. CAP05 shares implementation with CAP04 but stays outside this redesign.

## Design contract and preserved behavior

The source of truth is `packages/app-shell/src/orchestra/DESIGN.md`, read with the repository's `orchestra-design-system` and `orchestra-visual-qa` skills. Current quiet-glass rules govern older broad guidance. The approved foundation supplies a 1160px maximum width, 32/24/16px gutters, native type, token colors, material hierarchy, 44px targets and one primary action per active view.

Styles are scoped to each assigned surface. The compact source navigation is shared by CAP01–04 with the original approved geometry. Existing routing, owner selection, grants, source truth, CAS, idempotency, pending/unknown outcomes and draft recovery remain enforced by their original ports. No substituted currency or fabricated totals are introduced. Existing English strings are frozen; new strings have English and Brazilian Portuguese keys.

The native HuGR core and legacy white/green console are outside the design scope. Root owns integration, the native Sucafina access menu, test harness, Actions execution and consolidated evidence. The three workers own their individual page design and critique.

## Result and review

- **PASS:** [final real browser journey](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44920647017), 1 test, 2.9 minutes, three genuine confirmed writes.
- **PASS:** [application/E2E types, guards and palette parity](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44920652075), 4 checks; 78 guards, zero errors, five documented advisory warnings; all seven palette files unchanged.
- **PASS:** [six confirmed-draft registry cases](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44919739363), 29 assertions; relevant blobs unchanged in the final product.
- **39 actual captures**, 11 in Portuguese: [gallery](wave-two/evidence/README.md), [manifest](wave-two/evidence/manifest.json).
- Exact behavior coverage, image review, diagnostic history and limits: [VALIDATION.md](wave-two/VALIDATION.md).
- Worker reports: [Topics](wave-two/topics/REVIEW.md), [Budget](wave-two/budget/REVIEW.md), [OPEX](wave-two/opex/REVIEW.md).

All repository operations used the GitHub connector. Verification used the existing scoped Actions workflow with a real isolated installation and canonical producer data. No local product runtime, workflow or guard bypass was used. Reflow is not presented as browser zoom; unvisited states and remaining screens are not declared verified.
