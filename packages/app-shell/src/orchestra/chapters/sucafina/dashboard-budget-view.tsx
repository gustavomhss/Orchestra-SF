import { For, Show } from "solid-js"
import type { NativeViewProps } from "./view-contract"

type Row = Record<string, unknown>

const pages = ["Executive Dashboard", "Budget Overview", "OPEX Detail", "CAPEX Projects"]
const years = ["2024", "2025", "2026", "2027"]
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

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

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "number" && Number.isFinite(value)) return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
  return label(value) || "—"
}

function available(data: Row, key: string): boolean {
  return Object.hasOwn(data, key) && data[key] !== null && data[key] !== undefined
}

export function DashboardBudgetView(props: NativeViewProps) {
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
            <h2>Executive snapshot</h2>
            <div class="mx-fields">
              <label class="mx-field"><span>Year</span><select value={execYear()} onChange={(event) => changeQuery("execYear", event.currentTarget.value)}><For each={years}>{(year) => <option value={year}>{year}</option>}</For></select></label>
              <label class="mx-field"><span>Month</span><select value={String(execMonth())} onChange={(event) => changeQuery("executiveMonth", event.currentTarget.value)}><For each={monthNames}>{(month, index) => <option value={String(index() + 1)}>{month}</option>}</For></select></label>
            </div>
            <Show when={available(data(), "executiveMonths")} fallback={<p class="mx-empty">Executive snapshot projection is unavailable.</p>}>
              <Show when={Object.keys(snapshot()).length > 0} fallback={<p class="mx-empty">No executive snapshot is available for this year and month.</p>}>
                <dl class="mx-grid">
                  <div><dt>Active people</dt><dd>{display(executive().active)}</dd></div>
                  <div><dt>Departures this year</dt><dd>{display(executive().departures)}</dd></div>
                  <div><dt>Departures this month</dt><dd>{display(Array.isArray(executive().monthlyDepartures) ? (executive().monthlyDepartures as unknown[])[execMonth() - 1] : undefined)}</dd></div>
                  <div><dt>Active PMO projects</dt><dd>{display(object(data().executive).pmoActive)}</dd></div>
                  <div><dt>PMO at risk</dt><dd>{display(object(data().executive).pmoAtRisk)}</dd></div>
                  <div><dt>Active risks</dt><dd>{display(object(data().executive).activeRisks)}</dd></div>
                  <div><dt>Top risks</dt><dd>{display(object(data().executive).topRisks)}</dd></div>
                  <div><dt>IT performance on target</dt><dd>{display(object(data().executive).onTarget)}</dd></div>
                  <div><dt>Cost per User Benchmark</dt><dd>{display(rows(data().costPerUserBenchmarks).find((item) => item.year === Number(execYear()))?.value)}</dd></div>
                  <div><dt>Budget and cost per user metrics</dt><dd>Unavailable: authoritative budget summary projection is not supplied.</dd></div>
                </dl>
              </Show>
            </Show>
          </div>
          <div class="mx-card">
            <h2>Reported monthly IT users · {execYear()}</h2>
            <Show when={available(data(), "itUsersMonthly")} fallback={<p class="mx-empty">Monthly IT users projection is unavailable.</p>}>
              <Show when={monthlyUsers().length > 0} fallback={<p class="mx-empty">No monthly IT users records are available for {execYear()}.</p>}>
                <div class="mx-table" style={{ overflow: "auto" }}><table aria-label={"Reported monthly IT users for " + execYear()}>
                  <thead><tr><th>Year</th><th>Month</th><th>Reported users</th></tr></thead>
                  <tbody><For each={monthlyUsers()}>{(item) => <tr><th scope="row">{display(item.year)}</th><td>{display(item.month)}</td><td>{display(item.users)}</td></tr>}</For></tbody>
                </table></div>
              </Show>
            </Show>
          </div>
          <div class="mx-card">
            <h2>Service operations</h2>
            <label class="mx-field"><span>Operations month</span><select value={String(opsMonth())} onChange={(event) => changeQuery("opsMonth", event.currentTarget.value)}><For each={monthNames}>{(month, index) => <option value={String(index() + 1)}>{month}</option>}</For></select></label>
            <Show when={available(data(), "executiveMonths")} fallback={<p class="mx-empty">Operations projection is unavailable.</p>}>
              <dl class="mx-grid">
                <div><dt>Tickets opened</dt><dd>{display(operations().opened)}</dd></div>
                <div><dt>Tickets closed</dt><dd>{display(operations().closed)}</dd></div>
                <div><dt>Final backlog</dt><dd>{display(operations().backlog)}</dd></div>
                <div><dt>Backlog YTD — latest month</dt><dd>{display(operations().backlogYtd)}</dd></div>
                <div><dt>Incidents SLA</dt><dd>{display(operations().incSLA)}{operations().incSLA == null ? "" : "%"}</dd></div>
                <div><dt>Service Requests SLA</dt><dd>{display(operations().svcSLA)}{operations().svcSLA == null ? "" : "%"}</dd></div>
                <div><dt>Incidents SLA YTD</dt><dd>{display(operations().incYtd)}{operations().incYtd == null ? "" : "%"}</dd></div>
                <div><dt>Service Requests SLA YTD</dt><dd>{display(operations().svcYtd)}{operations().svcYtd == null ? "" : "%"}</dd></div>
                <div><dt>P1</dt><dd>{display(operations().p1)}</dd></div>
                <div><dt>Open security incidents for selected snapshot</dt><dd>{display(snapshot().openIncidents)}</dd></div>
              </dl>
            </Show>
            <Show when={Array.isArray(snapshot().kpis)} fallback={<p>Security KPI projection is unavailable.</p>}>
              <div class="mx-table" style={{ overflow: "auto" }}><table aria-label="Security KPI status">
                <thead><tr><th>Security KPI</th><th>Latest value</th><th>Status</th></tr></thead>
                <tbody><For each={rows(snapshot().kpis)}>{(item) => <tr><th scope="row">{display(item.key)}</th><td>{display(item.value)}</td><td>{display(item.status)}</td></tr>}</For></tbody>
              </table></div>
            </Show>
          </div>
          <div class="mx-card">
            <h2>Budget summary</h2>
            <p class="mx-empty">Budget, actual, forecast, variance, and cost per user totals require an authoritative server summary projection. No totals are calculated from budget rows in this view.</p>
          </div>
        </Show>

        <Show when={props.page.page === "Budget Overview"}>
          <div class="mx-card">
            <h2>Budget Overview · {selectedYear()}</h2>
            <p class="mx-empty">OPEX/CAPEX totals, variance, actual-to-budget, revenue ratios, progress, and monthly budget series are unavailable until the server supplies the authoritative summary projection.</p>
            <dl class="mx-grid">
              <div><dt>Current month</dt><dd>{display(object(data().budgetCurrentMonth)[selectedYear()])}</dd></div>
              <div><dt>Revenue</dt><dd>{display(object(data().revenueByYear)[selectedYear()])}</dd></div>
            </dl>
          </div>
          <For each={["opex", "capex"] as const}>{(collection) => {
            const name = collection === "opex" ? "OPEX" : "CAPEX"
            const ownersKey = collection === "opex" ? "opexOwners" : "capexProjects"
            return <div class="mx-card">
              <h2>{name} records · {selectedYear()}</h2>
              <Show when={available(data(), ownersKey)} fallback={<p>{name} projection is unavailable.</p>}>
                <Show when={budgetRows(collection).length === 0}><p>No {name} records are available.</p></Show>
              </Show>
              <Show when={available(data(), collection === "opex" ? "opexEntries" : "capexEntries")} fallback={<p>{name} monthly entry projection is unavailable.</p>}>
                <Show when={available(data(), ownersKey) && budgetRows(collection).length > 0}>
                  <div class="mx-table" style={{ overflow: "auto" }}><table aria-label={name + " budget records for " + selectedYear()}>
                    <thead><tr><th>{collection === "opex" ? "Owner" : "Project"}</th><th>Annual budget</th><th>Month</th><th>Budget</th><th>Actual</th><th>Forecast</th></tr></thead>
                    <tbody><For each={budgetRows(collection)}>{(record) => <Show when={record.entries.length > 0} fallback={<tr><th scope="row">{display(record.owner.name)}</th><td>{display(record.owner.budget)}</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>}>
                      <For each={record.entries}>{(entry) => <tr><th scope="row">{display(record.owner.name)}</th><td>{display(record.owner.budget)}</td><td>{display(entry.month)}</td><td>{display(entry.budget)}</td><td>{display(entry.actual)}</td><td>{display(entry.forecast)}</td></tr>}</For>
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
            const name = () => capex() ? "CAPEX Projects" : "OPEX owners"
            const records = () => rows(data()[collection()])
            return <div class="mx-card">
              <h2>{name()} · {selectedYear()}</h2>
              <p>Read-only projection for fiscal year {selectedYear()}. Monthly effective budgets, deviations, utilization, and 12-month totals are not supplied as authoritative fields.</p>
              <Show when={!available(data(), entriesKey())}><p class="mx-empty">Monthly entry projection is unavailable.</p></Show>
              <Show when={available(data(), collection())} fallback={<p class="mx-empty">{name()} projection is unavailable.</p>}>
                <Show when={records().length > 0} fallback={<p class="mx-empty">No {capex() ? "projects" : "owners"} are available for this year.</p>}>
                  <For each={records()}>{(record) => {
                    const entries = () => rows(data()[entriesKey()]).filter((item) =>
                      item.year === props.page.year && label(item.ownerId ?? item.projId ?? item.projectId) === label(record.id),
                    )
                    return <section class="mx-card" aria-label={label(record.name)}>
                      <h3>{display(record.name)}</h3>
                      <dl class="mx-grid">
                        <div><dt>Annual budget</dt><dd>{display(record.budget)}</dd></div>
                        <Show when={capex()}><div><dt>Status</dt><dd>{display(record.status)}</dd></div></Show>
                        <div><dt>Total 12mo</dt><dd>Unavailable: server projection required.</dd></div>
                        <div><dt>Overridden</dt><dd>Unavailable: server projection required.</dd></div>
                      </dl>
                      <Show when={available(data(), entriesKey())}>
                      <Show when={entries().length > 0} fallback={<p>No monthly records are available for {selectedYear()}.</p>}>
                        <div class="mx-table" style={{ overflow: "auto" }}><table aria-label={display(record.name) + " monthly budget records"}>
                          <thead><tr><th>Month</th><th>Budget</th><th>Actual</th><th>Forecast</th><th>Deviation flag</th><th>Deviation notes</th></tr></thead>
                          <tbody><For each={entries()}>{(entry) => {
                            return <tr><th scope="row">{display(entry.month)}</th><td>{display(entry.budget)}</td><td>{display(entry.actual)}</td><td>{display(entry.forecast)}</td><td>{display(deviationFor(record, entry).flag ?? entry.flag)}</td><td>{display(deviationFor(record, entry).text)}</td></tr>
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
