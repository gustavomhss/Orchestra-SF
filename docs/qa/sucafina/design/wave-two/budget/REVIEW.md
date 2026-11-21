# CAP03 — Budget overview, second design wave

Status: IMPLEMENTED, awaiting integrated Actions and real visual inspection. This document does not grant user acceptance or claim a render that has not happened.

## Source and scope

- Foundation: `a169c6b1ddca854a58dbf467a6573d5b1359c66f` on `sf-design-two`, based directly on current `dev bcdc109326de02e20c01c32ffb6b00bee3ff978d`.
- Worker branch: `sf-redesign-budget`.
- Surface: CAP03, `/orchestra/sf-dashboard/budget`.
- Files owned: budget/index.tsx, budget/budget.css, orchestra-chapters/sf-u02.ts, this review.
- Root/app AGENTS and both Orchestra design skills were read. Parent paths were checked for additional AGENTS; none exist between package and owned sources.
- The approved CAP01 Portuguese desktop capture was inspected as the visual reference. Shared executive files, shared U02 CSS, source models, routes, the legacy interface and HuGR core remain unchanged.

## Composition

The page uses the approved native Sucafina frame and eyebrow. A compact year control and About this data disclosure form the period toolbar. Three source metrics and the OPEX/CAPEX ledger share one raised native surface. Numeric columns align consistently.

For a selected year, totals retain the existing unscoped behavior: no annual amounts are inferred from source totals. Missing financial values have `data-sf-value="missing"`, an aria-hidden dash, full accessible absence content and one visible source explanation. Without a year, producer totals and ledger remain visible; there is no empty annual-revenue hero.

Current month and annual revenue appear in two annual source panels only when a year is selected. Native disclosures reveal the existing source editor; its draft controller stays mounted when the disclosure closes. During review, the active panel spans the full band and its input controls plus the sibling panel are hidden with CAP03-only CSS. Cancel restores the same mounted editor. Review buttons remain visually secondary; the write confirmation is the saturated action.

Reports and backup retains the exact original destination and English wording, now localized.

## Geometry for root DESIGN.md integration

- Existing wave frame: 1160px maximum; 32/24/16px gutters.
- Page and annual-band gaps 16px, raised panel padding 20px, period control 170px, metrics gap/padding 24px, 44px controls.
- Readout heads have an 84px minimum for symmetric resting annual panels; expanded editors keep independent heights.
- Financial ledger minimum width 480px inside a named keyboard-focusable scroller; no numeric fade mask.
- At a 620px frame the annual panels stack and panel padding becomes 16px; at 420px the period, financial metrics, editor actions and review snapshots become narrow-friendly rows/stacks.
- All sizes/radii/type/colors come from native or local geometry tokens. No new blur, palette, asset or global selector.

## Behavior retained

The original typed producer read, `read.setYear` owner navigation, year bounds, source projections, finite-number checks, missing-vs-zero behavior, versions, action admission, `SfU02Edit` identity/scopes, min/max/month constraints, idempotency keys, source writes, confirmation, conflict/unknown outcomes, draft registry and read refresh are retained. No financial totals are summed in the browser. No currency is inferred.

The shared editor's existing Base/Current snapshots remain untouched: CAP03 does not acquire a fabricated record identity or version. This may show source absence in those snapshots by the existing contract. Only the explicitly proposed new value is presented as a draft.

## Localization evidence

Only one key was added, in both English and Brazilian Portuguese:

- `sf.u02.reportsBackup`: `Reports and backup` / `Relatórios e backup`.

Existing English keys and values were checked byte-for-byte against the foundation and preserved. All other text reuses the established U02 catalog. Product names and OPEX/CAPEX acronyms stay unchanged. The repo's `.orchestra/glossary/br.md` was read.

Terminology cross-checks:

- Microsoft localized UI documentation uses both `Relatórios` and the established loanword `backup`: https://learn.microsoft.com/pt-br/azure/backup/view-reports and https://learn.microsoft.com/pt-br/azure/backup/backup-center-monitor-operate .
- Mozilla's maintained Brazilian Portuguese support/UI corpus also uses `relatórios` and `arquivo de backup`: https://support.mozilla.org/pt-BR/kb/opcoes-preferencias-e-configuracoes-do-firefox .
- An Academia Brasileira de Letras site lookup for `backup` did not return an authoritative entry; no dictionary verification is claimed for that borrowing. Its established UI use is evidenced by the two independent primary product corpora above.

## Root CI contract

- Root: `[data-sf-surface="CAP03"][data-sf-wave="two"]`.
- Financial metrics: `[data-sf-metric="budget"|"actual"|"forecast"]`; finite values have `data-sf-value="number"`, missing values `missing`; selected-year financial metrics also have `data-sf-scope="unscoped"`.
- Annual metrics after selecting a year: `[data-sf-metric="current-month"]` and `[data-sf-metric="revenue"]`.
- Year select: accessible label `Year` / `Ano`. Unselected placeholder is existing `Source period` / `Período da fonte`.
- Editor disclosures: `Edit current month` / `Editar mês corrente`; `Edit revenue` / `Editar receita`.
- Editors: `[data-sf-u02-edit="save-month"]` and `[data-sf-u02-edit="save-revenue"]`.
- Inputs: `Current month` / `Mês atual`; `Annual revenue` / `Receita anual`.
- Review: `Review source change` / `Revisar alteração da fonte`.
- Shared controls use the original strings: `Cancel review` / `Cancelar revisão`, `Discard draft` / `Descartar rascunho`, `Confirm save` / `Confirmar salvamento`.
- Native review: `[data-component="sf-change-review"]`.
- Closing a disclosure is presentation-only and does not discard its mounted draft.

No local tests, builds or product runtime were executed. Root owns the real isolated installation, scoped Actions, dark/light/Portuguese/narrow captures, type checks, palette generator parity, repository guards and final visual review. The 320 CSS-pixel check is reflow, not actual browser zoom.
