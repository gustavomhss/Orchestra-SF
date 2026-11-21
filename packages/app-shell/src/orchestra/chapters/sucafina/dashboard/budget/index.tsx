import { For, Show } from "solid-js"
import type { JSX } from "solid-js"
import { Icon } from "@orchestra/ui/icon"
import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import { SfDomainPageData } from "@orchestra/schema/sucafina/domain"
import type { SfSurfaceProps } from "../../context/contracts"
import { SfPageFrame } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { sfCommonKey, SF_STATE_FALLBACK_KEY, useSfPresentation } from "../../shared/frame/presentation"
import type { SfCopyKey } from "../../shared/frame/types"
import { SF_U02_COPY } from "@/i18n/orchestra-chapters/sf-u02"
import { SfU02Edit } from "../executive/edit"
import { useU02Projection, knownNumber, valueAt } from "../executive/reader"
import "../executive/u02.css"
import "../../shared/wave-one.css"
import "./budget.css"

type BudgetData = typeof SfDomainPageData.CAP03.Type
type Key = keyof typeof SF_U02_COPY
const key = (value: Key): SfCopyKey => value as SfCopyKey

/** U02 — CAP03. Financial values are producer projections, never browser sums. */
export function SfBudgetOverview(props: SfSurfaceProps<"CAP03">): JSX.Element {
  const { t, locale } = useSfPresentation()
  const read = useU02Projection<BudgetData>("CAP03", () => props.route, "domain.page.CAP03",
    (transport, selection, signal) => createSfDomainClient(transport)["domain.page.CAP03"]({
      ...(selection.year === undefined ? {} : { year: selection.year }),
      ...(selection.month === undefined ? {} : { month: selection.month }),
    }, { signal }))
  const data = () => read.snapshot()?.data
  const selection = () => read.selection()
  const year = () => selection().year
  const versions = () => read.snapshot()?.versions ?? {}
  const money = (value: number | null | undefined) => knownNumber(value) === undefined
    ? t(key("sf.u02.noValue"))
    : new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(value!)
  const currentMonth = () => valueAt(data()?.budgetCurrentMonth, year())
  const revenue = () => valueAt(data()?.revenueByYear, year())
  const unscoped = () => t(key("sf.u02.sourceWarning"))
  const periodTotals = () => year() === undefined ? data()?.totals : undefined
  const admitted = (action: "save-month" | "save-revenue") =>
    read.canAction(action, "domain.command.CAP03." + action)
  const metric = (id: string, label: Key, value: number | null | undefined, outsidePeriod = false) =>
    <div class="sf-budget-metric" data-sf-metric={id} data-sf-scope={outsidePeriod ? "unscoped" : undefined}
        data-sf-value={knownNumber(value) === undefined ? "missing" : "number"}>
      <dt>{t(key(label))}</dt>
      <dd><Show when={knownNumber(value) !== undefined} fallback={
        <><span aria-hidden="true">—</span><span class="sf-budget-sr-only">{t(key("sf.u02.noValue"))}</span></>
      }>{money(value)}</Show></dd>
    </div>

  return <SfPageFrame titleKey={key("sf.cap03.title")} context={[]} tabs={[]} activeTab={null} secondaryActions={[]}
      eyebrow={{ kind: "message", message: { key: "sf.design.eyebrow" as SfCopyKey } }}
      density="comfortable" layout="reading" onLayoutMode={() => {}}>
    <div class="sf-u02-page sf-budget-overview" data-sf-surface="CAP03" data-sf-wave="two">
      <SfStatePanel state={read.state()} messageKey={sfCommonKey(SF_STATE_FALLBACK_KEY[read.state()])}
          onRetryRead={read.refresh}>
        <section class="sf-budget-period" aria-labelledby="sf-u02-budget-period">
          <h2 id="sf-u02-budget-period" class="sf-budget-sr-only">{t(key("sf.u02.period"))}</h2>
          <label>{t(key("sf.u02.year"))}
            <select aria-label={t(key("sf.u02.year"))} value={year() ?? ""}
                onChange={(event) => read.setYear(Number(event.currentTarget.value))}>
              <option value="" disabled>{t(key("sf.u02.sourcePeriod"))}</option>
              <For each={[2024, 2025, 2026, 2027]}>{(item) => <option value={item}>{item}</option>}</For>
            </select>
          </label>
          <details class="sf-budget-provenance">
            <summary><Icon name="help" size="small" />{t(key("sf.u02.aboutData"))}</summary>
            <div><p>{t(key("sf.u02.currentData"))}</p><p>{unscoped()}</p></div>
          </details>
        </section>

        <section class="sf-budget-panel sf-budget-financial" aria-labelledby="sf-u02-budget-outlook">
          <header class="sf-budget-section-head">
            <div class="sf-budget-section-title"><Icon name="review" size="small" />
              <h2 id="sf-u02-budget-outlook">{t(key("sf.u02.financial"))}</h2></div>
            <p class="sf-budget-note">{t(key("sf.u02.noCurrency"))}</p>
          </header>
          <Show when={year() !== undefined}>
            <p class="sf-budget-scope-note" role="status">{t(key("sf.u02.sourceMissing"))}</p>
          </Show>
          <dl class="sf-budget-metrics">
            {metric("budget", "sf.u02.budget", periodTotals()?.totalBudget, year() !== undefined)}
            {metric("actual", "sf.u02.actual", periodTotals()?.totalActual, year() !== undefined)}
            {metric("forecast", "sf.u02.forecast", periodTotals()?.totalForecast, year() !== undefined)}
          </dl>
          <Show when={year() === undefined && data()?.totals}
              fallback={year() === undefined ? <p class="sf-budget-empty" role="status">{t(key("sf.u02.sourceMissing"))}</p> : null}>
            {(totals) => <div class="sf-budget-ledger" tabindex="0" role="region"
                aria-label={t(key("sf.u02.budgetByLine"))}>
              <table>
                <caption class="sf-budget-sr-only">{t(key("sf.u02.budgetByLine"))}</caption>
                <thead><tr><th scope="col">{t(key("sf.u02.line"))}</th>
                  <th scope="col">{t(key("sf.u02.budget"))}</th>
                  <th scope="col">{t(key("sf.u02.actual"))}</th>
                  <th scope="col">{t(key("sf.u02.forecast"))}</th></tr></thead>
                <tbody>
                  <tr><th scope="row">{t(key("sf.u02.opex"))}</th>
                    <td>{money(totals().opexBudget)}</td><td>{money(totals().opexActual)}</td>
                    <td>{money(totals().opexForecast)}</td></tr>
                  <tr><th scope="row">{t(key("sf.u02.capex"))}</th>
                    <td>{money(totals().capexBudget)}</td><td>{money(totals().capexActual)}</td>
                    <td>{money(totals().capexForecast)}</td></tr>
                  <tr><th scope="row">{t(key("sf.u02.total"))}</th>
                    <td>{money(totals().totalBudget)}</td><td>{money(totals().totalActual)}</td>
                    <td>{money(totals().totalForecast)}</td></tr>
                </tbody>
              </table>
            </div>}
          </Show>
          <Show when={year() === undefined}><p class="sf-budget-source-note">{unscoped()}</p></Show>
        </section>

        <Show when={year() !== undefined ? read.owner() : undefined}>
          {(ready) => <section class="sf-budget-maintenance" aria-labelledby="sf-u02-budget-maintenance">
            <header class="sf-budget-section-head">
              <div class="sf-budget-section-title"><Icon name="edit" size="small" />
                <h2 id="sf-u02-budget-maintenance">{t(key("sf.u02.inputs"))}</h2></div>
              <p class="sf-budget-note">{t(key("sf.u02.year"))} {year()}</p>
            </header>
            <div class="sf-budget-annual">
              <section class="sf-budget-panel sf-budget-input" aria-labelledby="sf-budget-month-heading">
                <div class="sf-budget-input-head">
                  <h3 id="sf-budget-month-heading">{t(key("sf.u02.currentMonth"))}</h3>
                  <dl>{metric("current-month", "sf.u02.currentMonth", knownNumber(currentMonth()))}</dl>
                </div>
                <Show when={admitted("save-month")}>
                  <details class="sf-budget-edit">
                    <summary><Icon name="edit" size="small" />{t(key("sf.u02.editMonth"))}<Icon name="chevron-down" size="small" /></summary>
                    <SfU02Edit surfaceId="CAP03" operationId="domain.command.CAP03.save-month"
                      actionId="save-month" labelKey="sf.u02.editMonth" valueLabelKey="sf.u02.currentMonth"
                      value={knownNumber(currentMonth())} version={versions()["budgetCurrentMonth"] ?? undefined}
                      scope={String(year()) + ":month"} year={year()!} integerOnly min={1} max={12}
                      admitted={admitted("save-month")} drafts={ready().drafts}
                      readInput={{ year: year()! }} onConfirmed={read.refresh}
                      onWrite={(value, version, idempotencyKey, signal) => createSfDomainClient(ready().transport)["domain.command.CAP03.save-month"]({
                        version, values: { year: year()!, month: value },
                      }, { signal, idempotencyKey })} />
                  </details>
                </Show>
              </section>
              <section class="sf-budget-panel sf-budget-input" aria-labelledby="sf-budget-revenue-heading">
                <div class="sf-budget-input-head">
                  <h3 id="sf-budget-revenue-heading">{t(key("sf.u02.revenue"))}</h3>
                  <dl>{metric("revenue", "sf.u02.revenue", revenue())}</dl>
                  <p class="sf-budget-note">{t(key("sf.u02.noCurrency"))}</p>
                </div>
                <Show when={admitted("save-revenue")}>
                  <details class="sf-budget-edit">
                    <summary><Icon name="edit" size="small" />{t(key("sf.u02.editRevenue"))}<Icon name="chevron-down" size="small" /></summary>
                    <SfU02Edit surfaceId="CAP03" operationId="domain.command.CAP03.save-revenue"
                      actionId="save-revenue" labelKey="sf.u02.editRevenue" valueLabelKey="sf.u02.revenue"
                      value={knownNumber(revenue())} version={versions()["revenueByYear"] ?? undefined}
                      scope={String(year()) + ":revenue"} year={year()!} integerOnly={false} min={0}
                      admitted={admitted("save-revenue")} drafts={ready().drafts}
                      readInput={{ year: year()! }} onConfirmed={read.refresh}
                      onWrite={(value, version, idempotencyKey, signal) => createSfDomainClient(ready().transport)["domain.command.CAP03.save-revenue"]({
                        version, values: { year: year()!, revenue: value },
                      }, { signal, idempotencyKey })} />
                    <p class="sf-budget-note sf-budget-revenue-hint">{t(key("sf.u02.clearRevenue"))}</p>
                  </details>
                </Show>
              </section>
            </div>
            <Show when={!admitted("save-month") && !admitted("save-revenue")}>
              <p class="sf-budget-note" role="status">{t(sfCommonKey("sf.common.readOnly"))}</p>
            </Show>
          </section>}
        </Show>
        <footer class="sf-budget-footer">
          <a class="mx-btn" href="/orchestra/sf-reviews/agenda">{t(key("sf.u02.reportsBackup"))}</a>
        </footer>
      </SfStatePanel>
    </div>
  </SfPageFrame>
}

export { SfBudgetOverview as SfDashboardBudgetView }
