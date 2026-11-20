import { For, Show, createMemo } from "solid-js"
import type { JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import type { SfSurfaceProps } from "../../context/contracts"
import { SfPageFrame } from "../../shared/frame"
import { SfExecutiveAction } from "../../cross-links/view"
import { SfStatePanel } from "../../shared/states"
import { sfCommonKey, useSfPresentation, SF_STATE_FALLBACK_KEY } from "../../shared/frame/presentation"
import type { SfCopyKey } from "../../shared/frame/types"
import { SfDomainPageData } from "@orchestra/schema/sucafina/domain"
import { SF_U02_COPY } from "@/i18n/orchestra-chapters/sf-u02"
import { SfU02Edit, sfU02ExecutiveTarget } from "./edit"
import { useU02Projection, knownNumber } from "./reader"
import { parseSfSignalPriorities, sfExecutiveSignals, sfExecutiveSignalTarget } from "./signals"
import "./u02.css"

type ExecutiveData = typeof SfDomainPageData.CAP01.Type
type Key = keyof typeof SF_U02_COPY
const key = (value: Key): SfCopyKey => value as SfCopyKey
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

/** U02 — CAP01. No snapshot, local financial calculator or hidden fetch. */
export function SfExecutiveDashboard(props: SfSurfaceProps<"CAP01">): JSX.Element {
  const { t, locale } = useSfPresentation()
  const language = useLanguage()
  const reader = useU02Projection<ExecutiveData>("CAP01", () => props.route, "domain.page.CAP01",
    (transport, selection, signal) => createSfDomainClient(transport)["domain.page.CAP01"]({
      ...(selection.year === undefined ? {} : { execYear: selection.year }),
      ...(selection.month === undefined ? {} : { executiveMonth: selection.month }),
      ...(selection.opsMonth === undefined ? {} : { opsMonth: selection.opsMonth }),
    }, { signal }))
  const data = () => reader.snapshot()?.data
  const selected = () => reader.selection()
  const year = () => selected().year
  const month = () => selected().month
  const missing = () => t(key("sf.u02.noValue"))
  const numeric = (value: number | undefined | null) => knownNumber(value) === undefined ? missing() :
    new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(value!)
  const monetary = (value: number | undefined | null) => numeric(value)
  const entries = () => data()?.signals ?? []
  const shownDate = (value: string) => {
    const iso = value.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return value
    const date = new Date(iso + "T00:00:00Z")
    if (!Number.isFinite(date.getTime())) return value
    return new Intl.DateTimeFormat(locale(), { dateStyle: "medium", timeZone: "UTC" }).format(date)
  }
  const pinned = createMemo(() => new Set((props.route.query.signalPriority ?? [])
    .filter((id) => entries().some((signal) => signal.id === id))))
  const signals = createMemo(() => sfExecutiveSignals(entries(), [...pinned()]))
  const signalFrom = () => ({
    ownerSelection: props.route.ownerSelection,
    query: { ...(year() === undefined ? {} : { year: year() }), ...(month() === undefined ? {} : { month: month() }) },
  })
  const nextPriority = (id: string) => pinned().has(id)
    ? [...pinned()].filter((value) => value !== id) : [...pinned(), id]
  const byYear = () => year() === undefined ? undefined : data()?.executiveByYear?.[String(year())]
  const executive = () => byYear()
  const unscoped = () => t(key("sf.u02.sourceWarning"))
  const periodTotals = () => year() === undefined ? data()?.totals : undefined
  const operations = () => {
    const period = year() !== undefined && selected().opsMonth !== undefined ?
      String(year()) + ":" + String(selected().opsMonth) :
      year() !== undefined && month() !== undefined ? String(year()) + ":" + String(month()) : undefined
    return period ? data()?.executiveMonths?.[period] : undefined
  }
  const versions = () => reader.snapshot()?.versions ?? {}
  const sourceSelected = () => reader.snapshot()?.selection.year === year() && reader.snapshot()?.selection.month === month()
  const usersTarget = createMemo(() => sfU02ExecutiveTarget(sourceSelected() ? data()?.itUsersMonthly : undefined, year(), month(), "itUsersMonthly", versions()))
  const benchmarkTarget = createMemo(() => sfU02ExecutiveTarget(sourceSelected() ? data()?.costPerUserBenchmarks : undefined, year(), month(), "costPerUserBenchmarks", versions()))
  const users = () => { const target = usersTarget();return target.kind === "record" ? target.row : undefined }
  const benchmark = () => { const target = benchmarkTarget();return target.kind === "record" ? target.row : undefined }
  const usersVersion = () => { const target = usersTarget();return target.kind === "unavailable" ? undefined : target.version }
  const benchmarkVersion = () => { const target = benchmarkTarget();return target.kind === "unavailable" ? undefined : target.version }
  const canEdit = (action: string) => reader.canAction(action, "domain.command.CAP01." + action)
  const stat = (id: string, label: Key, value: number | null | undefined) =>
    <div class="sf-u02-stat" data-sf-metric={id}><dt>{t(key(label))}</dt><dd>{numeric(value)}</dd></div>
  const unscopedStat = (id: string, label: Key) =>
    <div class="sf-u02-stat" data-sf-metric={id} data-sf-scope="unscoped"><dt>{t(key(label))}</dt><dd>{unscoped()}</dd></div>
  const metricTable = () => {
    if (year() !== undefined) return <p role="status">{unscoped()}</p>
    const totals = periodTotals()
    if (!totals) return <p role="status">{t(key("sf.u02.sourceMissing"))}</p>
    return <div class="sf-u02-table-scroll">
      <table><caption>{t(key("sf.u02.budgetByLine"))}</caption>
        <thead><tr><th scope="col">{t(key("sf.u02.line"))}</th>
          <th scope="col">{t(key("sf.u02.budget"))}</th>
          <th scope="col">{t(key("sf.u02.actual"))}</th>
          <th scope="col">{t(key("sf.u02.forecast"))}</th></tr></thead>
        <tbody>
          <tr><th scope="row">{t(key("sf.u02.opex"))}</th><td>{monetary(totals.opexBudget)}</td>
            <td>{monetary(totals.opexActual)}</td><td>{monetary(totals.opexForecast)}</td></tr>
          <tr><th scope="row">{t(key("sf.u02.capex"))}</th><td>{monetary(totals.capexBudget)}</td>
            <td>{monetary(totals.capexActual)}</td><td>{monetary(totals.capexForecast)}</td></tr>
          <tr><th scope="row">{t(key("sf.u02.total"))}</th><td>{monetary(totals.totalBudget)}</td>
            <td>{monetary(totals.totalActual)}</td><td>{monetary(totals.totalForecast)}</td></tr>
        </tbody>
      </table>
    </div>
  }
  return <SfPageFrame titleKey={key("sf.cap01.title")} context={[]} tabs={[]} activeTab={null} secondaryActions={[]}
      density="comfortable" layout="reading" onLayoutMode={() => {}}>
    <div class="sf-u02-page" data-sf-surface="CAP01">
      <nav class="flex flex-wrap gap-2" aria-label="Executive cross-links" data-sf-executive-crosslinks>
        <SfExecutiveAction from={props.route} target={{ kind: "agenda" }}
          label={{ pt: "Criar pauta de revisão", en: "Create review agenda" }} />
        <SfExecutiveAction from={props.route} target={{ kind: "topics" }}
          label={{ pt: "Hot Topics e ações", en: "Hot Topics & actions" }} />
        <SfExecutiveAction from={props.route} target={{ kind: "risks" }}
          label={{ pt: "Riscos", en: "Risks" }} />
        <SfExecutiveAction from={props.route} target={{ kind: "stakeholders" }}
          label={{ pt: "Stakeholders", en: "Stakeholders" }} />
      </nav>
      <SfStatePanel state={reader.state()} messageKey={sfCommonKey(SF_STATE_FALLBACK_KEY[reader.state()])}
        onRetryRead={reader.refresh}>
        <section class="sf-u02-section" aria-labelledby="sf-u02-period">
          <h2 id="sf-u02-period">{t(key("sf.u02.period"))}</h2>
          <div class="sf-u02-controls">
            <label>{t(key("sf.u02.year"))}
              <select value={year() ?? ""} onChange={(event) => reader.setYear(Number(event.currentTarget.value))}>
                <option value="" disabled>{missing()}</option>
                <For each={[2024, 2025, 2026, 2027]}>{(item) =>
                  <option value={item}>{item}</option>}</For>
              </select></label>
            <label>{t(key("sf.u02.month"))}
              <select value={month() ?? ""} onChange={(event) => reader.setMonth(Number(event.currentTarget.value))}>
                <option value="" disabled>{missing()}</option>
                <For each={MONTHS}>{(item) => <option value={item}>{item}</option>}</For>
              </select></label>
            <label>{t(key("sf.u02.opsMonth"))}
              <select value={selected().opsMonth ?? ""} onChange={(event) => reader.setOpsMonth(Number(event.currentTarget.value))}>
                <option value="" disabled>{missing()}</option>
                <For each={MONTHS}>{(item) => <option value={item}>{item}</option>}</For>
              </select></label>
          </div>
          <p>{t(key("sf.u02.currentData"))}. {t(key("sf.u02.sourceWarning"))}</p>
        </section>
        <section class="sf-u02-section" aria-labelledby="sf-u02-financial">
          <h2 id="sf-u02-financial">{t(key("sf.u02.financial"))}</h2>
          <p role="status">{unscoped()}</p>
          <dl class="sf-u02-stats sf-u02-four">
            {year() === undefined ? stat("budget", "sf.u02.budget", periodTotals()?.totalBudget) : unscopedStat("budget", "sf.u02.budget")}
            {year() === undefined ? stat("actual", "sf.u02.actual", periodTotals()?.totalActual) : unscopedStat("actual", "sf.u02.actual")}
            {year() === undefined ? stat("forecast", "sf.u02.forecast", periodTotals()?.totalForecast) : unscopedStat("forecast", "sf.u02.forecast")}
            {stat("active", "sf.u02.active", executive()?.active)}
          </dl>
          <p>{t(key("sf.u02.noCurrency"))}</p>
          <div data-sf-bi-slot="BI01">{metricTable()}</div>
        </section>
        <section class="sf-u02-section" aria-labelledby="sf-u02-variance">
          <h2 id="sf-u02-variance">{t(key("sf.u02.variance"))}</h2>
          <p>{t(key("sf.u02.sourceWarning"))}</p>
          <dl class="sf-u02-stats">
            {year() === undefined ? stat("opex-budget", "sf.u02.opex", periodTotals()?.opexBudget) : unscopedStat("opex-budget", "sf.u02.opex")}
            {year() === undefined ? stat("capex-budget", "sf.u02.capex", periodTotals()?.capexBudget) : unscopedStat("capex-budget", "sf.u02.capex")}
            {year() === undefined ? stat("total-forecast", "sf.u02.forecast", periodTotals()?.totalForecast) : unscopedStat("total-forecast", "sf.u02.forecast")}
          </dl>
        </section>
        <section class="sf-u02-section" aria-labelledby="sf-u02-delivery">
          <h2 id="sf-u02-delivery">{t(key("sf.u02.delivery"))}</h2>
          <dl class="sf-u02-stats">
            {stat("pmo-active", "sf.u02.pmoActive", executive()?.pmoActive)}
            {stat("pmo-risk", "sf.u02.pmoRisk", executive()?.pmoAtRisk)}
            {stat("risks", "sf.u02.activeRisks", executive()?.activeRisks)}
            {stat("top-risks", "sf.u02.topRisks", executive()?.topRisks)}
            {stat("on-target", "sf.u02.onTarget", executive()?.onTarget)}
            {stat("departures", "sf.u02.departures", executive()?.departures)}
          </dl>
        </section>
        <section class="sf-u02-section" aria-labelledby="sf-u02-people">
          <h2 id="sf-u02-people">{t(key("sf.u02.people"))}</h2>
          <dl class="sf-u02-stats">
            {stat("it-users", "sf.u02.users", users()?.users)}
            {stat("benchmark", "sf.u02.benchmark", benchmark()?.value)}
          </dl>
        </section>
        <section class="sf-u02-section" aria-labelledby="sf-u02-ops">
          <h2 id="sf-u02-ops">{t(key("sf.u02.operations"))}</h2>
          <dl class="sf-u02-stats">
            {stat("opened", "sf.u02.opened", operations()?.opened)}
            {stat("closed", "sf.u02.closed", operations()?.closed)}
            {stat("backlog", "sf.u02.backlog", operations()?.backlog)}
            {stat("delta", "sf.u02.netChange", operations()?.netChange)}
            {stat("sla-inc", "sf.u02.incSla", operations()?.incSLA)}
            {stat("sla-svc", "sf.u02.svcSla", operations()?.svcSLA)}
          </dl>
          <h3>{t(key("sf.u02.security"))}</h3>
          <dl class="sf-u02-stats">
            {stat("p1", "sf.u02.p1", operations()?.p1)}
            {stat("open-security", "sf.u02.openSecurity", operations()?.openIncidents)}
          </dl>
        </section>
        <section class="sf-u02-section" aria-labelledby="sf-u02-alerts" data-dashboard-signals
          data-signal-order={JSON.stringify(signals().map((signal) => signal.id))}>
          <h2 id="sf-u02-alerts">{t(key("sf.u02.signals"))}</h2>
          <p>{language.plural("sf.u02.signalsShowing", entries().length, { shown: signals().length, total: entries().length })}</p>
          <p>{language.plural("sf.u02.signalsPrioritized", entries().length, { prioritized: pinned().size, total: entries().length })}</p>
          <Show when={signals().length} fallback={<p>{t(sfCommonKey("sf.common.empty"))}</p>}>
            <div class="sf-u02-table-scroll"><table>
              <thead><tr><th scope="col">{t(key("sf.u02.fact"))}</th>
                <th scope="col">{t(key("sf.u02.rule"))}</th><th scope="col">{t(key("sf.u02.date"))}</th>
                <th scope="col">{t(key("sf.u02.origin"))}</th><th scope="col">{t(key("sf.u02.priority"))}</th></tr></thead>
              <tbody><For each={signals()}>{(signal) =>
                <tr data-signal-id={signal.id}><th scope="row">{signal.fact}</th><td>{signal.rule}</td>
                  <td><time dateTime={signal.date}>{signal.date ? shownDate(signal.date) : missing()}</time></td>
                  <td><bdi>{signal.page + " / " + signal.recordId}</bdi>
                    <Show when={sfExecutiveSignalTarget(signal)}>{(target) =>
                      <SfExecutiveAction from={signalFrom()} target={target()}
                        label={{ key: key("sf.u02.openRecord") }} />}
                    </Show>
                  </td>
                  <td><SfExecutiveAction from={signalFrom()} target={{ kind: "signal-priority", ids: nextPriority(signal.id) }}
                    pressed={pinned().has(signal.id)}
                    title={parseSfSignalPriorities(nextPriority(signal.id)) ? undefined : t(key("sf.u02.priorityLimit"))}
                    label={{ key: key(pinned().has(signal.id) ? "sf.u02.unprioritizeSignal" : "sf.u02.prioritizeSignal"),
                      params: { fact: signal.fact } }} /></td>
                </tr>}</For></tbody></table></div>
          </Show>
        </section>
        <Show when={year() !== undefined && month() !== undefined ? reader.owner() : undefined}>
          {(ready) => <section class="sf-u02-section" aria-labelledby="sf-u02-inputs">
            <h2 id="sf-u02-inputs">{t(key("sf.u02.inputs"))}</h2>
            <div class="sf-u02-edit-grid">
              <Show when={canEdit("save-users") && usersTarget().kind === "unavailable"}><p role="status">{t(key("sf.u02.sourceMissing"))}</p></Show>
              <Show when={canEdit("save-users") && usersTarget().kind !== "unavailable"}>
                <SfU02Edit surfaceId="CAP01" operationId="domain.command.CAP01.save-users"
                  actionId="save-users" labelKey="sf.u02.editUsers" valueLabelKey="sf.u02.users"
                  value={knownNumber(users()?.users)} version={usersVersion()}
                  recordId={users()?.id === undefined ? undefined : String(users()?.id)} year={year()!} month={month()!}
                  scope={String(year()) + ":" + String(month()) + ":users"} integerOnly min={0}
                  admitted={canEdit("save-users")} drafts={ready().drafts}
                  readInput={{ execYear: year()!, executiveMonth: month()! }}
                  onConfirmed={reader.refresh}
                  onWrite={(value, version, idempotencyKey, signal) => createSfDomainClient(ready().transport)["domain.command.CAP01.save-users"]({
                    id: users()?.id === undefined ? undefined : String(users()?.id),
                    version, values: { year: year()!, month: month()!, value },
                  }, { signal, idempotencyKey })} />
              </Show>
              <Show when={canEdit("save-benchmark") && benchmarkTarget().kind === "unavailable"}><p role="status">{t(key("sf.u02.sourceMissing"))}</p></Show>
              <Show when={canEdit("save-benchmark") && benchmarkTarget().kind !== "unavailable"}>
                <SfU02Edit surfaceId="CAP01" operationId="domain.command.CAP01.save-benchmark"
                  actionId="save-benchmark" labelKey="sf.u02.editBenchmark" valueLabelKey="sf.u02.benchmark"
                  value={knownNumber(benchmark()?.value)}
                  version={benchmarkVersion()}
                  recordId={benchmark()?.id === undefined ? undefined : String(benchmark()?.id)}
                  year={year()!} month={month()!} scope={String(year()) + ":benchmark"} integerOnly={false} min={0}
                  admitted={canEdit("save-benchmark")} drafts={ready().drafts}
                  readInput={{ execYear: year()! }}
                  onConfirmed={reader.refresh}
                  onWrite={(value, version, idempotencyKey, signal) => createSfDomainClient(ready().transport)["domain.command.CAP01.save-benchmark"]({
                    id: benchmark()?.id === undefined ? undefined : String(benchmark()?.id),
                    version, values: { year: year()!, month: month()!, value },
                  }, { signal, idempotencyKey })} />
              </Show>
            </div>
          </section>}
        </Show>
      </SfStatePanel>
    </div>
  </SfPageFrame>
}

// Frozen U02 entrypoint consumed by I00/current integrator125.
export { SfExecutiveDashboard as SfDashboardExecutiveView }
