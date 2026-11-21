# CAP04 — OPEX design review

Status: native CAP04 candidate `5012d7adf0e5d02576fe6a0add6f79331a812137` reviewed through the complete earlier visual pass and the additional final 320px detail capture below. The scoped browser journey passed. User visual acceptance remains pending.

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

## Actual visual review

Reviewed the real application from [run 44919606458](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44919606458), job `136892554713`, on integration candidate `263e694ef565376cc1af61cae0dc9e44777075b8`. The log reports one passed journey in 2.8 minutes. Root's journey exercises new-line review/revise/discard and monthly draft retention/cancel/reopen followed by a real save and authorized source reread.

Images actually inspected in this final pass:

- `CAP04-dark-desktop-new-line-test-data`
- `CAP04-dark-desktop-detail-test-data`
- `CAP04-dark-desktop-editor-test-data`
- `CAP04-dark-desktop-review-test-data`
- `CAP04-dark-320-review-test-data`
- `CAP04-pt-BR-dark-desktop-detail-test-data`
- `CAP04-pt-BR-dark-desktop-editor-test-data`
- `CAP04-pt-BR-dark-desktop-review-test-data`

The detail keeps identity and annual budget distinct from the monthly ledger. Known amounts align with their financial columns and absent source values remain dashes. The new-line and monthly forms have a clear label/input hierarchy; the three monthly financial fields align. Desktop review has three readable comparison columns. In the scrolled 320px review capture, all three actions are wholly visible with separate targets. Portuguese detail shows the genuinely refreshed January forecast `14.600`; the subsequent editor/review keeps the new `14800` draft separate from the `14600` source and version 2. No relevant visual defect was identified that justified another product patch.

A prior pass inspected the four list/toolbar captures (dark desktop, dark 1440×800, light desktop, light 320px) from run `44918211856`: search alignment, budget alignment and narrow row reflow were sound. That earlier journey failed later in CAP02 and is not presented as a green test run. Root subsequently corrected the shared navigation strip; the final eight captures above include the corrected navigation.

## Final 320px detail inspection

Inspected only `CAP04-dark-320-detail-test-data` from [run 44920647017](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44920647017), job `136895711016`, on product `5012d7adf0e5d02576fe6a0add6f79331a812137`. Root's consolidated journey reports one pass in 2.9 minutes and 39 captures. CAP04 product code is unchanged from the complete pass recorded above; this is additional viewport evidence, not a new redesign.

At 320 CSS pixels, the selected line identity wraps across two readable lines without clipping. The header Edit and Delete controls remain fully visible, separated, and comfortably sized. The annual budget remains readable. The monthly ledger presents January's budget `15,000`, actual `12,400` and forecast `14,200` in three aligned columns with visible labels; those values are not clipped or merged. The first row's remaining metadata continues below the captured viewport. No material visual defect was found and no product patch was made.

This image verifies the header's Edit action visually. It does not show the monthly edit buttons, the later month blocks or the ledger footer, so this narrow capture is not cited as visual inspection of those controls. The earlier desktop and 320px review evidence remains recorded above. Approval by the user and any golden-image baseline remain pending.

## Verification limits

Application/E2E type checks, scoped guards, palette parity and the final complete evidence manifest are consolidated by root. CAP05 isolation was reviewed statically against its unchanged `surface.css`, original branches and flattened wrappers; this leaf review does not claim a CAP05 browser capture. The final captures above do not add screenshot coverage for annual-entry, deviation editing or delete review. CSS media reflow is not real browser zoom. No golden baseline or user approval is asserted.
