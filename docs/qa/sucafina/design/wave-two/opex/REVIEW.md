# CAP04 — OPEX design review

Status: implemented candidate; actual browser/Actions review pending. This is not user acceptance.

## Scope and source

- Branch: `sf-redesign-opex`, starting at `a169c6b1ddca854a58dbf467a6573d5b1359c66f`.
- Native routes: `/orchestra/sf-dashboard/opex`, `/new`, `/:lineRef`, `/:lineRef/edit`.
- Source rules: root/app AGENTS, `.claude/skills/orchestra-design-system`, `.claude/skills/orchestra-visual-qa`, `packages/app-shell/src/orchestra/DESIGN.md`.
- The approved real UI33 Portuguese screenshot and CAP01 source styling are the finish reference. Legacy white/green and HuGR core are untouched.
- No local repository, product runtime or tests were used. Root owns the consolidated Actions run and visual evidence.

## Composition

The list is a single native raised surface with a 20px header, title/count, 360px search and aligned numeric budget column. The period becomes a compact 44px selector. The currency-source warning appears once for CAP04, while amounts remain producer-provided numbers. Selecting a line gives its detail the full canvas; the mounted list retains search and sort. Editing hides the mounted list/detail, leaving a focused stage no wider than 760px.

The detail separates line identity and annual budget from a monthly ledger. Record identity/version are available in Source details; the version is a count, never a monetary display. Annual adjustments are an explicit disclosure. The ledger preserves the original twelve months and exact producer values; missing data uses an em dash, accessible “Not available” and a visible absence legend. No annual division, aggregation, currency inference, estimated delta or synthetic receipt is introduced.

Forms use native Inter, 13px input text, 12px labels, 20px titles and 44px controls. Month/financial inputs are grouped; notes span the stage. Review uses the existing read-only source/base/proposed component in a dedicated stage, with accessible focus on opening and revision. 620px reflow turns ledger rows into labeled blocks; at 420px the form and review actions use one column. Every new CSS selector is under `.sf-budget-surface[data-sf-budget="CAP04"]`.

## Behavior preserved

The source segment from `rememberView` through immediately before `sourceAction` is byte-identical to the foundation except for one presentation-only translation in `draftFields`: CAP04 reviews display stored deviation flag colors through `flagLabel` and annual field names through their existing dictionary keys. The underlying `BudgetForm` values, commands and payloads remain unchanged, and CAP05 displays its original strings. Year/route selection, filtering and sorting, reads, source reconciliation, draft acquisition, validation, CAS, pending digests/idempotency, later edits, unknown outcomes, confirmation and discard are unchanged. `model.ts` and `surface.css` are unchanged.

CAP05 keeps the original frame context, context bar, amountText output, generic detail, action visibility and original table/editor CSS. Presentation wrappers flatten with `display: contents` for CAP05. No wave marker or CAP04 CSS applies there. The new focus effect is CAP04-only.

CAP04 New line is available on the list, Edit is the detail primary action, and Review/Save is the active editor primary action. The year selector is disabled while its editor is active. These are presentation fences; action admission and commands are unchanged.

## Copy and localization

All existing English dictionary entries are byte-identical. The previously untranslated Brazilian Portuguese CAP04 labels now use the native finance vocabulary. The only dictionary value intentionally equal to English is “Status”, an established UI borrowing. OPEX and Excel remain product/domain names.

Reference corpora:

- Microsoft Dynamics 365 Finance, [financial report column definitions](https://learn.microsoft.com/pt-br/dynamics365/fin-ops-core/fin-ops/analytics/column-definitions-financial-reports): orçamento, realizado and financial columns.
- Microsoft Dynamics 365, [project management and accounting](https://learn.microsoft.com/pt-br/dynamics365/project-operations/prod-pma/overview-project-management-accounting): previsão and desvio in financial comparison.
- Microsoft Dynamics 365, [budget planning](https://learn.microsoft.com/pt-br/dynamics365/finance/budgeting/budget-plan): linhas, valores, orçamento and review.
- Mozilla Firefox, [download management](https://support.mozilla.org/pt-BR/kb/gerenciador-de-downloads): Cancelar, Excluir and salvar in action context.
- Mozilla Firefox, [keyboard shortcuts](https://support.mozilla.org/pt-BR/kb/atalhos-teclado-execute-tarefas-comuns-rapidamente): opening, saving and focus terminology.
- Brazilian public financial terminology, [ANCINE budget execution](https://www.gov.br/ancine/pt-br/fsa/resultados/execucao-orcamentaria-e-financeira): orçamento anual and despesas operacionais.

“Lançamento anual ÷ 12” retains the producer action meaning; the UI does not perform that calculation. Green/Amber/Red label only the stored deviation flag colors, without assigning invented risk meanings. Native-speaker review can still refine domain terminology.

## Journey contract for root

- Main title: EN `OPEX Detail`; BR `Detalhamento de OPEX`.
- Search: EN `Name`; BR `Nome`. Placeholder: Search by name / Buscar por nome.
- Rows: `tr[data-sf-row]`; original `button[data-sf-action="select"|"edit"|"delete"]`.
- Detail: `[data-sf-opex-detail]`; monthly ledger `tr[data-sf-month="1"]`.
- Monthly actions: `button[data-sf-action="save-entry"]` (Save month / Salvar mês), `save-deviation`.
- Editor: `.sf-budget-editor[data-sf-action][data-sf-draft-phase][data-sf-draft-dirty]`.
- Financial fields: budget / Orçamento, actual / Realizado, forecast / Previsão.
- New line fields: Owner name / Nome do responsável; Annual budget / Orçamento anual.
- Review: `[data-component="sf-change-review"]`. Existing Revise returns to the fields. Existing Cancel closes the editor while the owner-scoped registry retains the draft. Reopening uses the same registry.
- Source detail shows version without the currency-warning suffix; original owner scope and Source navigation remain.

## Remaining verification

Root must run current-source application/E2E type checks, scoped guards and palette parity, then inspect actual dark/light desktop, narrow and Portuguese renders. Specifically inspect list search alignment, financial/notes wrapping, editor review focus and fully accessible narrow footer, unchanged saved numbers, and CAP05 isolation. CSS media reflow is not real browser zoom. No golden baseline or user approval is asserted.
