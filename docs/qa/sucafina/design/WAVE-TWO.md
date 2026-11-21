# Wave two — native Sucafina design

Status: IN_PROGRESS. User authorized this wave with “do it” after approving wave one.

## Branch and reference

- Integration branch: `sf-design-two`, created directly from `dev bcdc109326de02e20c01c32ffb6b00bee3ff978d`.
- Approved reference: `sf-design-polish 8f18ca831df7b144d843e6b0b3477825abe88e46`.
- The approved product is `245e15bf10b5c5287fa9338aa98d0adb28aeda76`; its images and acceptance record remain unchanged.
- Common ancestor: `1fd255026dec8e1db1f4342f7ec206a6812b42ea`. The current dev and approved branch have no overlapping changed paths. Approved blobs are integrated onto the current dev tree, retaining every upstream change.
- No writes to shared dev, release or deployment.

## Three assigned surfaces

| Surface | Screen | Routes | Required states | Owner |
| --- | --- | --- | --- | --- |
| CAP02 | Hot Topics | /orchestra/sf-dashboard/hot-topics; /new; /:topicRef; /:topicRef/edit | List, filter, detail, create/edit, review, delete review, loading/empty/error | redesign_topics |
| CAP03 | Visão de orçamento | /orchestra/sf-dashboard/budget | Source totals, annual selection, missing/unscoped values, month/revenue editors, review/cancel/discard | redesign_budget |
| CAP04 | OPEX: realizado e previsão | /orchestra/sf-dashboard/opex; /new; /:lineRef; /:lineRef/edit | List, filter, detail, monthly entries, create/edit, review, delete review, loading/empty/error | redesign_opex |

The full 70-surface inventory remains in `inventory.json`. These are positions 4–6; remaining screens are inventory only. CAP05 shares implementation with CAP04 but is outside the redesign scope.

## Design contract

Use `.claude/skills/orchestra-design-system`, `.claude/skills/orchestra-visual-qa` and `packages/app-shell/src/orchestra/DESIGN.md`. Match the approved compact native composition: 1160px maximum, 32/24/16px gutters, native Inter typography, token colors, raised/soft fill hierarchy, 44px interaction targets and one primary action per active view. Keep clear information hierarchy, coherent alignment, comfortable form sizing and dedicated review composition. Scope new CSS to the assigned surface.

Do not modify the legacy white/green UI or native HuGR core. Preserve routing, owner selection, grants, source truth, CAS, idempotency, draft recovery and unknown outcomes. Never fabricate totals, currency, permissions or receipts. Existing English copy is frozen; new strings require English and Brazilian Portuguese keys and terminology verification.

## Ownership and validation

Three independent agents own the three surfaces. Root owns integration, common access/frame changes, the test harness, actual Actions execution, visual review and final evidence. CAP03 must not change approved CAP01 presentation through shared U02 CSS. CAP04 must not change CAP05 presentation through shared budget components.

GitHub connector only for repository operations. No local builds, tests or product runtime. Use the existing scoped Actions workflow with a real isolated installation, genuine enrollment and real producer data. No workflow, guard, allowlist or authorization bypasses.

Final review requires actual desktop dark/light, narrow layout and Brazilian Portuguese captures, visible editor/review/cancel behavior, application and E2E type checks, repository guards and palette generation parity. Prior wave green runs are historical evidence, not validation of this wave. User approval remains pending until the new result is presented.
