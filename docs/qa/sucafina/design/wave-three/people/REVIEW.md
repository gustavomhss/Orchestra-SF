# Wave three — People and portfolio review

## Scope and baseline

CAP06 People overview, CAP07 Team Structure, CAP08 Talent Review, CAP09 Portfolio Dashboard and CAP10 All Projects. Branch `sf-polish-people` starts at `24c02f7f366ecea94a8511c88cdaf2bebcb46be6`, the scope commit descending directly from the approved `dev` baseline.

This change is confined to native Sucafina presentation. The existing Orchestra shell, legacy renderer, source producers, owner resolution, transport, grants and shared frame implementation are outside this group's changes.

## Presentation decisions

| Area | Result |
| --- | --- |
| CAP06 | One quiet headcount band, reported figures kept intact, followed by the leader breakdown in a single readable surface. Missing metrics stay absent. |
| CAP07 | CIO profile, leadership assignments and searchable member ledger. Dedicated member/leader detail, grouped editor, original change review and deletion confirmation. |
| CAP08 | Searchable talent ledger with translated source enums, dedicated member detail and grouped assessment editor. Import/export routes explain their distinct unavailable bindings honestly. |
| CAP09 | Project filters, three source-list counts, project ledger and milestone schedule. Recorded source context is available next to the overview without occupying the main reading hierarchy. |
| CAP10 | Collection and record detail occupy separate stages through the existing list/detail component. New/edit forms and reviews occupy a bounded stage. Milestones expand individually and commands have a record-specific review. |

The common frame uses `data-sf-wave="three"` and a CAP06–CAP10 `data-sf-surface` marker. The integration owner supplies the accepted 1160px frame and 32/24/16px gutters. Local surfaces use the existing raised/soft materials, native font scales, native radii and accent focus. No font, palette or blur architecture is introduced.

## Geometry and interaction

- Panels use 20px content rhythm and 12px secondary gaps. All regular inputs, selects and buttons have a minimum 44px block size.
- People details, editors, deletion reviews and workbook explanations are bounded to 760px. Project editors, command reviews and milestone work are also bounded to 760px.
- People forms group identity, employment and assessment fields. Notes span the form width.
- At narrow usable frame widths, member/talent ledgers become vertically labeled records. Labels and row actions remain visible.
- Portfolio tables retain their native, bounded horizontal scroll regions; page and document overflow must remain absent.
- Project save review replaces the editable fieldsets with the exact current/proposed values. The mounted draft and form persist through review and revision.
- Collection controls remain mounted behind the active record/editor stage. The existing project list/detail component retains selection focus and list scroll restoration.
- Destructive commands identify the actual selected person, project or milestone before confirmation.

## Source and command fidelity

People reads remain `domain.page.CAP06`, `CAP07` and `CAP08`. Headcount, attrition, tenure, ratios and leader totals remain producer values. Structure and talent commands keep their original versions, idempotency keys, admission checks and F01 draft registry.

Projects remain on `domain.page.CAP09/CAP10`, the original `sfReadProjects`, source version map and `sfProjectCommand`. The save/delete/milestone commands, confirmation bindings, owner generation fencing and unknown-outcome behavior remain in their owners. Budget/spent figures are locale-formatted only; no currency or financial calculation is inferred.

Existing English dictionary strings remain unchanged. New keys have English and Brazilian Portuguese values. Existing source enums are translated only for display; command values are unchanged.

## Coverage and limits

CAP08 workbook preview/download bindings are absent from the source contract in this installation. The two routes therefore remain unavailable, with specific explanatory text and disabled actions. No workbook, preview, download or receipt is manufactured.

Visual and interaction evidence must come from the grouped native Actions run, using producer-seeded records in an isolated installation. No local runtime, build or tests were used. Initial implementation is not a visual acceptance claim.

## Verification status

- Source review: complete for the five areas and their editor/controller seams.
- GitHub persistence readback: performed with each implementation commit.
- Group E2E: two journeys in `design-wave-three-people.spec.ts`, importing the integration owner's real wave-three fixture and canonical seed labels. They exercise three browser-confirmed source writes (member, project and milestone), review/revise retention, cancellation without writes, source rereads, localized pages and workbook limitations.
- Dark/light, narrow reflow, Brazilian Portuguese, review/cancel and command evidence: pending grouped Actions and screenshot critique.

## Terminology and automation references

The Portuguese action vocabulary was cross-checked against the maintained [Firefox preferences corpus](https://github.com/mozilla-l10n/firefox-l10n/blob/main/pt-BR/browser/browser/preferences/preferences.ftl) and [VS Code Git corpus](https://github.com/microsoft/vscode-loc/blob/main/i18n/vscode-language-pack-pt-BR/translations/extensions/vscode.git.i18n.json): editar, salvar, excluir, importar and descartar alterações. Headcount is retained as the established product term; CIO is the source acronym. Talent classifications and employment terms remain domain translations for native-speaker review, with their canonical English payloads untouched.

The journey uses role/label locators, explicit DOM contracts and awaited assertions as recommended in the [official Playwright locator documentation](https://github.com/microsoft/playwright/blob/main/docs/src/locators.md). Screenshots and geometry checks run only through Actions. The 320px view measures reflow, not browser zoom.

Creating an unassigned member exposed an existing presentation validation mismatch: the optional leader select visibly defaults to its empty option while the draft may omit the key. Validation now compares an omitted optional select value to its declared empty option; it does not manufacture a leader, value, version or permission.
