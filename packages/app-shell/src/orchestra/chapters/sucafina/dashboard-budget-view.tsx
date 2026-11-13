import { For, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import type { NativeViewProps } from "./view-contract"

type Row = Record<string, unknown>

const pages = ["Executive Dashboard", "Budget Overview", "OPEX Detail", "CAPEX Projects"]
const years = ["2024", "2025", "2026", "2027"]

function object(value: unknown): Row {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Row : {}
}

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((item): item is Row => item !== null && typeof item === "object" && !Array.isArray(item)) : []
}

function label(value: unknown): string {
  if (typeof value === "string") return value
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
}

function display(value: unknown, language: ReturnType<typeof useLanguage>): string {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "number" && Number.isFinite(value)) return new Intl.NumberFormat(language.intl(), { maximumFractionDigits: 2 }).format(value)
  return label(value) || "—"
}

function available(data: Row, key: string): boolean {
  return Object.hasOwn(data, key) && data[key] !== null && data[key] !== undefined
}

export function DashboardBudgetView(props: NativeViewProps) {
  const language = useLanguage()
  const valid = () => props.page.surface === "dashboard" && pages.includes(props.page.page) && props.page.pages.includes(props.page.page)
  const data = () => object(props.page.data)
  const execYear = () => years.includes(props.query.execYear || "") ? props.query.execYear || String(props.page.year) : String(props.page.year)
  const execMonth = () => {
    const selected = Number(props.query.executiveMonth || props.page.month)
    return Number.isInteger(selected) && selected >= 1 && selected <= 12 ? selected : props.page.month
  }
  const opsMonth = () => {
    const selected = [props.query.opsMonth, object(data().opsDefaultMonth)[execYear()]]
      .map((value) => typeof value === "string" || typeof value === "number" ? Number(value) : NaN)
      .find((month) => Number.isInteger(month) && month >= 1 && month <= 12)
    return selected ?? props.page.month
  }
  const selectedExecutive = () => object(object(data().executiveByYear)[execYear()])
  const executive = () => ({ ...object(data().executive), ...selectedExecutive() })
  const snapshot = () => object(object(data().executiveMonths)[execYear() + ":" + execMonth()])
  const operations = () => object(object(data().executiveMonths)[execYear() + ":" + opsMonth()])
  const changeQuery = (key: "year" | "execYear" | "executiveMonth" | "opsMonth", value: string) =>
    props.onQuery({ ...props.query, [key]: value })
  const selectedYear = () => String(props.page.year)
  const monthNames = () => [
    language.t("sucafina.native.dashboard-budget.january"),
    language.t("sucafina.native.dashboard-budget.february"),
    language.t("sucafina.native.dashboard-budget.march"),
    language.t("sucafina.native.dashboard-budget.april"),
    language.t("sucafina.native.dashboard-budget.may"),
    language.t("sucafina.native.dashboard-budget.june"),
    language.t("sucafina.native.dashboard-budget.july"),
    language.t("sucafina.native.dashboard-budget.august"),
    language.t("sucafina.native.dashboard-budget.september"),
    language.t("sucafina.native.dashboard-budget.october"),
    language.t("sucafina.native.dashboard-budget.november"),
    language.t("sucafina.native.dashboard-budget.december"),
  ]
  const monthlyUsers = () => rows(data().itUsersMonthly).filter((item) => item.year === Number(execYear()))
  const deviationFor = (record: Row, entry: Row) => {
    const key = (props.page.page === "CAPEX Projects" ? "capex-" : "opex-") + label(record.id) + "-" + props.page.year + "-" + label(entry.month)
    return object(object(data().deviations)[key])
  }
  const budgetRows = (collection: "opex" | "capex") => {
    const ownerKey = collection === "opex" ? "opexOwners" : "capexProjects"
    const entryKey = collection === "opex" ? "opexEntries" : "capexEntries"
    const owners = rows(data()[ownerKey])
    const entries = rows(data()[entryKey]).filter((item) => item.year === props.page.year)
    return owners.map((owner) => ({
      owner,
      entries: entries.filter((item) => label(item.ownerId ?? item.projId ?? item.projectId) === label(owner.id)),
    }))
  }

  return (
    <Show when={valid()}>
      <section aria-label={props.page.page} data-dashboard-budget-page={props.page.page}>
        <Show when={props.page.page === "Executive Dashboard"}>
          <div class="mx-card">
            <h2>{language.t("sucafina.native.dashboard-budget.executiveSnapshot")}</h2>
            <div class="mx-fields">
              <label class="mx-field"><span>{language.t("sucafina.native.dashboard-budget.year")}</span><select value={execYear()} onChange={(event) => changeQuery("execYear", event.currentTarget.value)}><For each={years}>{(year) => <option value={year}>{year}</option>}</For></select></label>
              <label class="mx-field"><span>{language.t("sucafina.native.dashboard-budget.month")}</span><select value={String(execMonth())} onChange={(event) => changeQuery("executiveMonth", event.currentTarget.value)}><For each={monthNames()}>{(month, index) => <option value={String(index() + 1)}>{month}</option>}</For></select></label>
            </div>
            <Show when={available(data(), "executiveMonths")} fallback={<p class="mx-empty">{language.t("sucafina.native.dashboard-budget.executiveUnavailable")}</p>}>
              <Show when={Object.keys(snapshot()).length > 0} fallback={<p class="mx-empty">{language.t("sucafina.native.dashboard-budget.executiveEmpty")}</p>}>
                <dl class="mx-grid">
                  <div><dt>{language.t("sucafina.native.dashboard-budget.activePeople")}</dt><dd>{display(executive().active, language)}</dd></div>
                  <div><dt>{language.t("sucafina.native.dashboard-budget.departuresThisYear")}</dt><dd>{display(executive().departures, language)}</dd></div>
                  <div><dt>{language.t("sucafina.native.dashboard-budget.departuresThisMonth")}</dt><dd>{display(Array.isArray(executive().monthlyDepartures) ? (executive().monthlyDepartures as unknown[])[execMonth() - 1] : undefined, language)}</dd></div>
                  <div><dt>{language.t("sucafina.native.dashboard-budget.activePmoProjects")}</dt><dd>{display(object(data().executive).pmoActive, language)}</dd></div>
                  <div><dt>{language.t("sucafina.native.dashboard-budget.pmoAtRisk")}</dt><dd>{display(object(data().executive).pmoAtRisk, language)}</dd></div>
                  <div><dt>{language.t("sucafina.native.dashboard-budget.activeRisks")}</dt><dd>{display(object(data().executive).activeRisks, language)}</dd></div>
                  <div><dt>{language.t("sucafina.native.dashboard-budget.topRisks")}</dt><dd>{display(object(data().executive).topRisks, language)}</dd></div>
                  <div><dt>{language.t("sucafina.native.dashboard-budget.itPerformanceOnTarget")}</dt><dd>{display(object(data().executive).onTarget, language)}</dd></div>
                  <div><dt>{language.t("sucafina.native.dashboard-budget.costPerUserBenchmark")}</dt><dd>{display(rows(data().costPerUserBenchmarks).find((item) => item.year === Number(execYear()))?.value, language)}</dd></div>
                  <div><dt>{language.t("sucafina.native.dashboard-budget.budgetAndCostPerUserMetrics")}</dt><dd>{language.t("sucafina.native.dashboard-budget.budgetSummaryUnavailable")}</dd></div>
                </dl>
              </Show>
            </Show>
          </div>
          <div class="mx-card">
            <h2>{language.t("sucafina.native.dashboard-budget.reportedMonthlyUsers", { year: execYear() })}</h2>
            <Show when={available(data(), "itUsersMonthly")} fallback={<p class="mx-empty">{language.t("sucafina.native.dashboard-budget.monthlyUsersUnavailable")}</p>}>
              <Show when={monthlyUsers().length > 0} fallback={<p class="mx-empty">{language.t("sucafina.native.dashboard-budget.monthlyUsersEmpty", { year: execYear() })}</p>}>
                <div class="mx-table" style={{ overflow: "auto" }}><table aria-label={language.t("sucafina.native.dashboard-budget.reportedMonthlyUsersTable", { year: execYear() })}>
                  <thead><tr><th>{language.t("sucafina.native.dashboard-budget.year")}</th><th>{language.t("sucafina.native.dashboard-budget.month")}</th><th>{language.t("sucafina.native.dashboard-budget.reportedUsers")}</th></tr></thead>
                  <tbody><For each={monthlyUsers()}>{(item) => <tr><th scope="row">{label(item.year) || "—"}</th><td>{display(item.month, language)}</td><td>{display(item.users, language)}</td></tr>}</For></tbody>
                </table></div>
              </Show>
            </Show>
          </div>
          <div class="mx-card">
            <h2>{language.t("sucafina.native.dashboard-budget.serviceOperations")}</h2>
            <label class="mx-field"><span>{language.t("sucafina.native.dashboard-budget.operationsMonth")}</span><select value={String(opsMonth())} onChange={(event) => changeQuery("opsMonth", event.currentTarget.value)}><For each={monthNames()}>{(month, index) => <option value={String(index() + 1)}>{month}</option>}</For></select></label>
            <Show when={available(data(), "executiveMonths")} fallback={<p class="mx-empty">{language.t("sucafina.native.dashboard-budget.operationsUnavailable")}</p>}>
              <dl class="mx-grid">
                <div><dt>{language.t("sucafina.native.dashboard-budget.ticketsOpened")}</dt><dd>{display(operations().opened, language)}</dd></div>
                <div><dt>{language.t("sucafina.native.dashboard-budget.ticketsClosed")}</dt><dd>{display(operations().closed, language)}</dd></div>
                <div><dt>{language.t("sucafina.native.dashboard-budget.finalBacklog")}</dt><dd>{display(operations().backlog, language)}</dd></div>
                <div><dt>{language.t("sucafina.native.dashboard-budget.backlogYtdLatestMonth")}</dt><dd>{display(operations().backlogYtd, language)}</dd></div>
                <div><dt>{language.t("sucafina.native.dashboard-budget.incidentsSla")}</dt><dd>{display(operations().incSLA, language)}{operations().incSLA == null ? "" : "%"}</dd></div>
                <div><dt>{language.t("sucafina.native.dashboard-budget.serviceRequestsSla")}</dt><dd>{display(operations().svcSLA, language)}{operations().svcSLA == null ? "" : "%"}</dd></div>
                <div><dt>{language.t("sucafina.native.dashboard-budget.incidentsSlaYtd")}</dt><dd>{display(operations().incYtd, language)}{operations().incYtd == null ? "" : "%"}</dd></div>
                <div><dt>{language.t("sucafina.native.dashboard-budget.serviceRequestsSlaYtd")}</dt><dd>{display(operations().svcYtd, language)}{operations().svcYtd == null ? "" : "%"}</dd></div>
                <div><dt>{language.t("sucafina.native.dashboard-budget.p1")}</dt><dd>{display(operations().p1, language)}</dd></div>
                <div><dt>{language.t("sucafina.native.dashboard-budget.openSecurityIncidents")}</dt><dd>{display(snapshot().openIncidents, language)}</dd></div>
              </dl>
            </Show>
            <Show when={Array.isArray(snapshot().kpis)} fallback={<p>{language.t("sucafina.native.dashboard-budget.securityKpiUnavailable")}</p>}>
              <div class="mx-table" style={{ overflow: "auto" }}><table aria-label={language.t("sucafina.native.dashboard-budget.securityKpiTable")}>
                <thead><tr><th>{language.t("sucafina.native.dashboard-budget.securityKpi")}</th><th>{language.t("sucafina.native.dashboard-budget.latestValue")}</th><th>{language.t("sucafina.native.dashboard-budget.status")}</th></tr></thead>
                <tbody><For each={rows(snapshot().kpis)}>{(item) => <tr><th scope="row">{display(item.key, language)}</th><td>{display(item.value, language)}</td><td>{display(item.status, language)}</td></tr>}</For></tbody>
              </table></div>
            </Show>
          </div>
          <div class="mx-card">
            <h2>{language.t("sucafina.native.dashboard-budget.budgetSummary")}</h2>
            <p class="mx-empty">{language.t("sucafina.native.dashboard-budget.authoritativeBudgetSummaryRequired")}</p>
          </div>
        </Show>

        <Show when={props.page.page === "Budget Overview"}>
          <div class="mx-card">
            <h2>{language.t("sucafina.native.dashboard-budget.budgetOverview", { year: selectedYear() })}</h2>
            <p class="mx-empty">{language.t("sucafina.native.dashboard-budget.budgetSummaryGaps")}</p>
            <dl class="mx-grid">
              <div><dt>{language.t("sucafina.native.dashboard-budget.currentMonth")}</dt><dd>{display(object(data().budgetCurrentMonth)[selectedYear()], language)}</dd></div>
              <div><dt>{language.t("sucafina.native.dashboard-budget.revenue")}</dt><dd>{display(object(data().revenueByYear)[selectedYear()], language)}</dd></div>
            </dl>
          </div>
          <For each={["opex", "capex"] as const}>{(collection) => {
            const name = () => collection === "opex"
              ? language.t("sucafina.native.dashboard-budget.opex")
              : language.t("sucafina.native.dashboard-budget.capex")
            const ownersKey = collection === "opex" ? "opexOwners" : "capexProjects"
            const entriesKey = collection === "opex" ? "opexEntries" : "capexEntries"
            const tableLabel = collection === "opex"
              ? "sucafina.native.dashboard-budget.opexBudgetRecordsTable"
              : "sucafina.native.dashboard-budget.capexBudgetRecordsTable"
            return <div class="mx-card">
              <h2>{language.t("sucafina.native.dashboard-budget.recordsHeading", { collection: name(), year: selectedYear() })}</h2>
              <Show when={available(data(), ownersKey)} fallback={<p>{collection === "opex" ? language.t("sucafina.native.dashboard-budget.opexProjectionUnavailable") : language.t("sucafina.native.dashboard-budget.capexProjectionUnavailable")}</p>}>
                <Show when={budgetRows(collection).length === 0}><p>{collection === "opex" ? language.t("sucafina.native.dashboard-budget.opexEmpty") : language.t("sucafina.native.dashboard-budget.capexEmpty")}</p></Show>
              </Show>
              <Show when={available(data(), entriesKey)} fallback={<p>{language.t("sucafina.native.dashboard-budget.monthlyEntriesUnavailable", { collection: name() })}</p>}>
                <Show when={available(data(), ownersKey) && budgetRows(collection).length > 0}>
                  <div class="mx-table" style={{ overflow: "auto" }}><table aria-label={language.t(tableLabel, { year: selectedYear() })}>
                    <thead><tr><th>{collection === "opex" ? language.t("sucafina.native.dashboard-budget.owner") : language.t("sucafina.native.dashboard-budget.project")}</th><th>{language.t("sucafina.native.dashboard-budget.annualBudget")}</th><th>{language.t("sucafina.native.dashboard-budget.month")}</th><th>{language.t("sucafina.native.dashboard-budget.budget")}</th><th>{language.t("sucafina.native.dashboard-budget.actual")}</th><th>{language.t("sucafina.native.dashboard-budget.forecast")}</th></tr></thead>
                    <tbody><For each={budgetRows(collection)}>{(record) => <Show when={record.entries.length > 0} fallback={<tr><th scope="row">{display(record.owner.name, language)}</th><td>{display(record.owner.budget, language)}</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>}>
                      <For each={record.entries}>{(entry) => <tr><th scope="row">{display(record.owner.name, language)}</th><td>{display(record.owner.budget, language)}</td><td>{display(entry.month, language)}</td><td>{display(entry.budget, language)}</td><td>{display(entry.actual, language)}</td><td>{display(entry.forecast, language)}</td></tr>}</For>
                    </Show>}</For></tbody>
                  </table></div>
                </Show>
              </Show>
            </div>
          }}</For>
        </Show>

        <Show when={props.page.page === "OPEX Detail" || props.page.page === "CAPEX Projects"}>
          {(() => {
            const capex = () => props.page.page === "CAPEX Projects"
            const collection = () => capex() ? "capexProjects" : "opexOwners"
            const entriesKey = () => capex() ? "capexEntries" : "opexEntries"
            const name = () => capex()
              ? language.t("sucafina.native.dashboard-budget.capexProjects")
              : language.t("sucafina.native.dashboard-budget.opexOwners")
            const records = () => rows(data()[collection()])
            return <div class="mx-card">
              <h2>{language.t("sucafina.native.dashboard-budget.detailRecordsHeading", { collection: name(), year: selectedYear() })}</h2>
              <p>{language.t("sucafina.native.dashboard-budget.detailProjection", { year: selectedYear() })}</p>
              <Show when={!available(data(), entriesKey())}><p class="mx-empty">{language.t("sucafina.native.dashboard-budget.monthlyEntryUnavailable")}</p></Show>
              <Show when={available(data(), collection())} fallback={<p class="mx-empty">{capex() ? language.t("sucafina.native.dashboard-budget.projectsUnavailable") : language.t("sucafina.native.dashboard-budget.ownersUnavailable")}</p>}>
                <Show when={records().length > 0} fallback={<p class="mx-empty">{capex() ? language.t("sucafina.native.dashboard-budget.projectsEmpty") : language.t("sucafina.native.dashboard-budget.ownersEmpty")}</p>}>
                  <For each={records()}>{(record) => {
                    const entries = () => rows(data()[entriesKey()]).filter((item) =>
                      item.year === props.page.year && label(item.ownerId ?? item.projId ?? item.projectId) === label(record.id),
                    )
                    return <section class="mx-card" aria-label={label(record.name)}>
                      <h3>{display(record.name, language)}</h3>
                      <dl class="mx-grid">
                        <div><dt>{language.t("sucafina.native.dashboard-budget.annualBudget")}</dt><dd>{display(record.budget, language)}</dd></div>
                        <Show when={capex()}><div><dt>{language.t("sucafina.native.dashboard-budget.status")}</dt><dd>{display(record.status, language)}</dd></div></Show>
                        <div><dt>{language.t("sucafina.native.dashboard-budget.total12Months")}</dt><dd>{language.t("sucafina.native.dashboard-budget.serverProjectionRequired")}</dd></div>
                        <div><dt>{language.t("sucafina.native.dashboard-budget.overridden")}</dt><dd>{language.t("sucafina.native.dashboard-budget.serverProjectionRequired")}</dd></div>
                      </dl>
                      <Show when={available(data(), entriesKey())}>
                      <Show when={entries().length > 0} fallback={<p>{language.t("sucafina.native.dashboard-budget.noMonthlyRecords", { year: selectedYear() })}</p>}>
                        <div class="mx-table" style={{ overflow: "auto" }}><table aria-label={language.t("sucafina.native.dashboard-budget.monthlyBudgetRecordsTable", { name: display(record.name, language) })}>
                          <thead><tr><th>{language.t("sucafina.native.dashboard-budget.month")}</th><th>{language.t("sucafina.native.dashboard-budget.budget")}</th><th>{language.t("sucafina.native.dashboard-budget.actual")}</th><th>{language.t("sucafina.native.dashboard-budget.forecast")}</th><th>{language.t("sucafina.native.dashboard-budget.deviationFlag")}</th><th>{language.t("sucafina.native.dashboard-budget.deviationNotes")}</th></tr></thead>
                          <tbody><For each={entries()}>{(entry) => {
                            return <tr><th scope="row">{display(entry.month, language)}</th><td>{display(entry.budget, language)}</td><td>{display(entry.actual, language)}</td><td>{display(entry.forecast, language)}</td><td>{display(deviationFor(record, entry).flag ?? entry.flag, language)}</td><td>{display(deviationFor(record, entry).text, language)}</td></tr>
                          }}</For></tbody>
                        </table></div>
                      </Show>
                      </Show>
                    </section>
                  }}</For>
                </Show>
              </Show>
            </div>
          })()}
        </Show>
      </section>
    </Show>
  )
}
