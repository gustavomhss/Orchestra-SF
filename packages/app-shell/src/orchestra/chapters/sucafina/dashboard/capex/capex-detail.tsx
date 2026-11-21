import { createUniqueId, For, Show, type JSX } from "solid-js"
import { Icon } from "@orchestra/ui/icon"
import type { SF_U40_COPY } from "@/i18n/orchestra-chapters/sf-u40"
import type { SfAction, SfCopyKey, SfUiState } from "../../shared/frame"
import { SfActionButton, SF_STATE_FALLBACK_KEY, sfCommonKey, useSfPresentation } from "../../shared/frame/presentation"
import { SfStatePanel } from "../../shared/states"
import type { BudgetOwner } from "../opex/model"

const key = (value: keyof typeof SF_U40_COPY): SfCopyKey => value as SfCopyKey

/** CAP05 presentation only. All source selection and command admission stay in the shared controller. */
export function SfCapexDetail(props: Readonly<{
  owner: BudgetOwner
  year: number
  budget: JSX.Element
  version: number | undefined
  state: SfUiState
  rows: JSX.Element
  canEditMonths: boolean
  hint: JSX.Element
  hasHint: boolean
  actions: readonly SfAction[]
  annualActions: readonly SfAction[]
  sourceActions: readonly SfAction[]
  onBack: () => void
}>): JSX.Element {
  const { t } = useSfPresentation()
  const id = createUniqueId()
  return <article class="sf-opex-detail-panel" data-sf-capex-detail aria-labelledby={id}>
    <header class="sf-opex-detail-head">
      <button type="button" class="mx-btn sf-opex-back" onClick={props.onBack}>
        <Icon name="arrow-left" size="small" />
        {t(key("sf.u40.backToProjects"))}
      </button>
      <div class="sf-opex-detail-actions">
        <For each={props.actions}>{(action) => <SfActionButton action={action} variant={action.tone === "primary" ? "primary" : "secondary"} />}</For>
      </div>
      <div class="sf-opex-detail-title">
        <h2 id={id} tabindex="-1" data-sf-detail-heading><bdi>{props.owner.name ?? String(props.owner.id)}</bdi></h2>
        <details class="sf-opex-reference">
          <summary>{t(key("sf.u40.detailsSource"))}<Icon name="chevron-down" size="small" /></summary>
          <dl>
            <div><dt>{t(key("sf.u40.source"))}</dt><dd><code>capexProjects:{props.owner.id}</code></dd></div>
            <div><dt>{t(key("sf.u40.sourceVersion"))}</dt><dd>{props.version ?? t(key("sf.u40.missing"))}</dd></div>
            <Show when={props.owner.status}><div><dt>{t(key("sf.u40.status"))}</dt><dd><bdi>{props.owner.status}</bdi></dd></div></Show>
          </dl>
        </details>
      </div>
      <dl class="sf-opex-annual-budget"><div>
        <dt>{t(key("sf.u40.annualBudget"))}</dt>
        <dd>{props.budget}</dd>
      </div></dl>
    </header>
    <section class="sf-opex-ledger" aria-labelledby={id + "-months"}>
      <div class="sf-opex-ledger-heading">
        <div><h3 id={id + "-months"}>{t(key("sf.u40.monthlyEntries"))}</h3>
          <p>{t(key("sf.u40.monthlyHint"))}</p></div>
        <span class="sf-opex-period">{props.year}</span>
      </div>
      <SfStatePanel state={props.state} messageKey={sfCommonKey(SF_STATE_FALLBACK_KEY[props.state])}>
        <div class="sf-budget-months-scroll" tabindex="0" role="region" aria-label={t(key("sf.u40.monthlyEntries"))}>
          <table class="sf-budget-months">
            <caption>{t(key("sf.u40.monthlyEntries"))} · {props.year}</caption>
            <thead><tr>
              <th scope="col">{t(key("sf.u40.month"))}</th>
              <th scope="col">{t(key("sf.u40.budget"))}</th>
              <th scope="col">{t(key("sf.u40.actual"))}</th>
              <th scope="col">{t(key("sf.u40.forecast"))}</th>
              <th scope="col">{t(key("sf.u40.flag"))}</th>
              <th scope="col">{t(key("sf.u40.notes"))}</th>
              <Show when={props.canEditMonths}><th scope="col">{t(sfCommonKey("sf.common.edit"))}</th></Show>
            </tr></thead>
            <tbody>{props.rows}</tbody>
          </table>
        </div>
        <p class="sf-opex-missing-legend">{t(key("sf.u40.missingLegend"))}</p>
      </SfStatePanel>
    </section>
    <div class="sf-opex-detail-foot">
      <Show when={props.annualActions.length > 0 || props.hasHint}>
        <details class="sf-opex-annual-actions">
          <summary>{t(key("sf.u40.annualSettings"))}<Icon name="chevron-down" size="small" /></summary>
          <div class="sf-budget-actions"><For each={props.annualActions}>{(action) => <SfActionButton action={action} />}</For></div>
          {props.hint}
        </details>
      </Show>
      <div class="sf-opex-source-actions"><For each={props.sourceActions}>{(action) => <SfActionButton action={action} />}</For></div>
    </div>
  </article>
}
