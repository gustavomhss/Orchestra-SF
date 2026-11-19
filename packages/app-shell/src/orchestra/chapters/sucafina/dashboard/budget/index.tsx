import { For, Show } from "solid-js"
import type { JSX } from "solid-js"
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

type BudgetData = typeof SfDomainPageData.CAP03.Type
type Key = keyof typeof SF_U02_COPY
const key = (value: Key): SfCopyKey => value as SfCopyKey

/** U02 — CAP03. Financial values are producer projections, never browser sums. */
export function SfBudgetOverview(props: SfSurfaceProps<"CAP03">): JSX.Element {
  const { t, locale } = useSfPresentation()
  const read = useU02Projection<BudgetData>("CAP03", props.route, "domain.page.CAP03",
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
  const stat = (id: string, label: Key, value: number | null | undefined) =>
    <div class="sf-u02-stat" data-sf-metric={id}><dt>{t(key(label))}</dt><dd>{money(value)}</dd></div>
  const unscopedStat = (id: string, label: Key) =>
    <div class="sf-u02-stat" data-sf-metric={id} data-sf-scope="unscoped"><dt>{t(key(label))}</dt><dd>{unscoped()}</dd></div>

  return <SfPageFrame titleKey={key("sf.cap03.title")} context={[]} tabs={[]} activeTab={null} secondaryActions={[]}
      density="comfortable" layout="reading" onLayoutMode={() => {}}>
    <div class="sf-u02-page" data-sf-surface="CAP03">
      <SfStatePanel state={read.state()} messageKey={sfCommonKey(SF_STATE_FALLBACK_KEY[read.state()])}
          onRetryRead={read.refresh}>
        <section class="sf-u02-section" aria-labelledby="sf-u02-budget-period">
          <h2 id="sf-u02-budget-period">{t(key("sf.u02.period"))}</h2>
          <div class="sf-u02-controls">
            <label>{t(key("sf.u02.year"))}
              <select value={year() ?? ""} onChange={(event) => read.setYear(Number(event.currentTarget.value))}>
                <option value="" disabled>{t(key("sf.u02.noValue"))}</option>
                <For each={[2024, 2025, 2026, 2027]}>{(item) => <option value={item}>{item}</option>}</For>
              </select>
            </label>
            <p>{t(key("sf.u02.currentMonth"))}: {currentMonth() ?? t(key("sf.u02.noValue"))}</p>
          </div>
        </section>
        <section class="sf-u02-section" aria-labelledby="sf-u02-budget-outlook">
          <h2 id="sf-u02-budget-outlook">{t(key("sf.u02.financial"))}</h2>
          <p role="status">{unscoped()} {t(key("sf.u02.noCurrency"))}</p>
          <dl class="sf-u02-stats sf-u02-four">
            {year() === undefined ? stat("budget", "sf.u02.budget", periodTotals()?.totalBudget) : unscopedStat("budget", "sf.u02.budget")}
            {year() === undefined ? stat("actual", "sf.u02.actual", periodTotals()?.totalActual) : unscopedStat("actual", "sf.u02.actual")}
            {year() === undefined ? stat("forecast", "sf.u02.forecast", periodTotals()?.totalForecast) : unscopedStat("forecast", "sf.u02.forecast")}
            {stat("revenue", "sf.u02.revenue", revenue())}
          </dl>
        </section>
        <section class="sf-u02-section" aria-labelledby="sf-u02-budget-variance">
          <h2 id="sf-u02-budget-variance">{t(key("sf.u02.budgetByLine"))}</h2>
          <Show when={year() !== undefined}>
            <p role="status">{unscoped()}</p>
          </Show>
          <Show when={year() === undefined && data()?.totals} fallback={year() === undefined ? <p role="status">{t(key("sf.u02.sourceMissing"))}</p> : null}>
            {(totals) => <div class="sf-u02-table-scroll"><table>
              <caption>{t(key("sf.u02.budgetByLine"))}</caption>
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
            </table></div>}
          </Show>
          <p>{t(key("sf.u02.sourceWarning"))}</p>
        </section>
        <Show when={year() !== undefined ? read.owner() : undefined}>
          {(ready) => <section class="sf-u02-section" aria-labelledby="sf-u02-budget-maintenance">
            <h2 id="sf-u02-budget-maintenance">{t(key("sf.u02.inputs"))}</h2>
            <div class="sf-u02-edit-grid">
              <Show when={admitted("save-month")}>
                <SfU02Edit surfaceId="CAP03" operationId="domain.command.CAP03.save-month"
                  actionId="save-month" labelKey="sf.u02.editMonth" valueLabelKey="sf.u02.currentMonth"
                  value={knownNumber(currentMonth())} version={versions()["budgetCurrentMonth"] ?? undefined}
                  scope={String(year()) + ":month"} year={year()!} integerOnly min={1} max={12}
                  admitted={admitted("save-month")} drafts={ready().drafts}
                  readInput={{ year: year()! }} onConfirmed={read.refresh}
                  onWrite={(value, version, idempotencyKey, signal) => createSfDomainClient(ready().transport)["domain.command.CAP03.save-month"]({
                    version, values: { year: year()!, month: value },
                  }, { signal, idempotencyKey })} />
              </Show>
              <Show when={admitted("save-revenue")}>
                <SfU02Edit surfaceId="CAP03" operationId="domain.command.CAP03.save-revenue"
                  actionId="save-revenue" labelKey="sf.u02.editRevenue" valueLabelKey="sf.u02.revenue"
                  value={knownNumber(revenue())} version={versions()["revenueByYear"] ?? undefined}
                  scope={String(year()) + ":revenue"} year={year()!} integerOnly={false} min={0}
                  admitted={admitted("save-revenue")} drafts={ready().drafts}
                  readInput={{ year: year()! }} onConfirmed={read.refresh}
                  onWrite={(value, version, idempotencyKey, signal) => createSfDomainClient(ready().transport)["domain.command.CAP03.save-revenue"]({
                    version, values: { year: year()!, revenue: value },
                  }, { signal, idempotencyKey })} />
                <p>{t(key("sf.u02.clearRevenue"))}</p>
              </Show>
            </div>
          </section>}
        </Show>
        <Show when={!admitted("save-month") && !admitted("save-revenue")}>
          <p role="status">{t(sfCommonKey("sf.common.readOnly"))}</p>
        </Show>
      </SfStatePanel>
    </div>
  </SfPageFrame>
}

// Frozen U02 entrypoint consumed by I00/current integrator125.
export { SfBudgetOverview as SfDashboardBudgetView }
