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
  const periodTotals = () => {
    const snapshot = read.snapshot()
    return snapshot && (year() === undefined || snapshot.selection.year === year()) ? snapshot.data.totals : undefined
  }
  const monthly = () => {
    const series = periodTotals() ? data()?.budgetSeries : undefined
    return series?.effective.length === 12 && series.flatReference.length === 12 ? series : undefined
  }
  // Coordinates scale the producer series for display; no business values are recomputed.
  const graphY = (amount: number) => {
    const source = monthly()
    if (!source) return 160
    const minimum = Math.min(0, ...source.effective), maximum = Math.max(0, ...source.effective)
    return 160 - (maximum === minimum ? 0 : (amount - minimum) / (maximum - minimum) * 110)
  }
  const admitted = (action: "save-month" | "save-revenue") =>
    read.canAction(action, "domain.command.CAP03." + action)
  const stat = (id: string, label: Key, value: number | null | undefined) =>
    <div class="sf-u02-stat" data-sf-metric={id}><dt>{t(key(label))}</dt><dd>{money(value)}</dd></div>

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
          <p role="status">{!periodTotals() ? unscoped() + " " : ""}{t(key("sf.u02.noCurrency"))}</p>
          <dl class="sf-u02-stats sf-u02-four">
            {stat("budget", "sf.u02.budget", periodTotals()?.totalBudget)}
            {stat("actual", "sf.u02.actual", periodTotals()?.totalActual)}
            {stat("forecast", "sf.u02.forecast", periodTotals()?.totalForecast)}
            {stat("revenue", "sf.u02.revenue", revenue())}
          </dl>
        </section>
        <section class="sf-u02-section" aria-labelledby="sf-u02-budget-variance">
          <h2 id="sf-u02-budget-variance">{t(key("sf.u02.budgetByLine"))}</h2>
          <Show when={periodTotals()} fallback={<p role="status">{t(key("sf.u02.sourceMissing"))}</p>}>
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
          <Show when={!periodTotals()}><p>{t(key("sf.u02.sourceWarning"))}</p></Show>
        </section>
        <section class="sf-u02-section" aria-label={t(key("sf.u02.effectiveMonthly"))}>
          <Show when={monthly()} fallback={<p role="status">{t(key("sf.u02.monthlySeries"))}</p>}>
            {(series) => <>
              <figure>
                <svg role="img" aria-label={t(key("sf.u02.effectiveMonthly"))} viewBox="0 0 700 200"
                    style={{ display: "block", width: "100%", height: "auto" }}>
                  <title>{t(key("sf.u02.effectiveMonthly"))}</title>
                  <line x1="45" y1={graphY(0)} x2="665" y2={graphY(0)} stroke="currentColor" />
                  <polyline data-budget-series="effective"
                    points={series().effective.map((amount, index) => (45 + index * 55) + "," + graphY(amount)).join(" ")}
                    fill="none" stroke="currentColor" stroke-width="3" />
                  <For each={series().effective}>{(amount, index) => <>
                    <circle cx={45 + index() * 55} cy={graphY(amount)} r="4" fill="currentColor">
                      <title>{String(index() + 1) + ": " + money(amount)}</title>
                    </circle>
                    <text x={45 + index() * 55} y="185" text-anchor="middle" fill="currentColor">{index() + 1}</text>
                  </>}</For>
                </svg>
                <figcaption>{t(key("sf.u02.effectiveCaption"))}</figcaption>
              </figure>
              <div class="sf-u02-table-scroll"><table data-sf-budget-months>
                <caption>{t(key("sf.u02.effectiveMonthly"))}</caption>
                <thead><tr><th scope="col">{t(key("sf.u02.month"))}</th>
                  <th scope="col">{t(key("sf.u02.effectiveBudget"))}</th>
                  <th scope="col">{t(key("sf.u02.flatReference"))}</th></tr></thead>
                <tbody><For each={series().effective}>{(amount, index) => <tr>
                  <th scope="row">{index() + 1}</th><td>{money(amount)}</td><td>{money(series().flatReference[index()])}</td>
                </tr>}</For></tbody>
              </table></div>
            </>}
          </Show>
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
        <SfBudgetReportLink year={year()} />
      </SfStatePanel>
    </div>
  </SfPageFrame>
}

/** Reports and backup is the real reviews chapter, never a local form stub. */
function SfBudgetReportLink(props: { year?: number }) {
  const href = () => "/orchestra/sf-reviews/agenda" + (props.year === undefined ? "" : "?year=" + props.year)
  return <p><a href={href()}>Reports and backup</a></p>
}

export { SfBudgetOverview as SfDashboardBudgetView }
