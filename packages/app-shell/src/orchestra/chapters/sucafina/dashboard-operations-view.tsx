import { For, Match, Show, Switch } from "solid-js"
import { MxBadge, MxPage } from "../kit"
import type { NativeViewProps } from "./view-contract"

type Row = Record<string, unknown>
type Cell = string | number | boolean | null | undefined

const operationsPages = ["IT Operations", "IT Security KPIs"] as const
const ownedPages = [...operationsPages, "Vendor Contracts"] as const
const monthOptions = Array.from({ length: 12 }, (_, index) => String(index + 1))
const yearOptions = ["2024", "2025", "2026", "2027"]
const securityFields = [
  ["training", "Training"], ["assessment", "Assessment"], ["scan", "Scan"],
  ["patch", "Patch Gen."], ["patchEndpoint", "Patch Endp."], ["patchServer", "Patch Serv."],
  ["socCritical", "SOC Critical"], ["socHigh", "SOC High"], ["socMedium", "SOC Medium"],
  ["socLow", "SOC Low"], ["socPending", "Pending"], ["socTP", "True Pos."],
  ["socFP", "False Pos."], ["socEPS", "SOC EPS"], ["socIPs", "SOC IPs"],
  ["socClosure", "Closure (source value)"],
] as const

function object(value: unknown): Row | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Row) : undefined
}

function records(value: unknown): Row[] {
  return Array.isArray(value) ? value.flatMap((item) => {
    const row = object(item)
    return row ? [row] : []
  }) : []
}

function display(value: Cell): string {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  return String(value)
}

function value(row: Row, key: string): Cell {
  const cell = row[key]
  return typeof cell === "string" || typeof cell === "number" || typeof cell === "boolean" ? cell : null
}

function yearOf(row: Row): string {
  return String(row.year ?? "")
}

function monthOf(row: Row): string {
  return String(row.month ?? "")
}

function ReadTable(props: { name: string; columns: readonly string[]; rows: readonly (readonly Cell[])[]; empty: string }) {
  return (
    <section class="mx-card" aria-label={props.name}>
      <h2 class="mx-section">{props.name}</h2>
      <Show when={props.rows.length > 0} fallback={<p class="mx-note">{props.empty}</p>}>
        <div class="mx-table" role="region" aria-label={props.name} tabIndex={0}>
          <table>
            <thead><tr><For each={props.columns}>{(column) => <th scope="col">{column}</th>}</For></tr></thead>
            <tbody>
              <For each={props.rows}>
                {(row) => <tr><For each={row}>{(cell) => <td>{display(cell)}</td>}</For></tr>}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </section>
  )
}

function PeriodFilters(props: { year: string; month: string; onYear: (year: string) => void; onMonth: (month: string) => void }) {
  return (
    <div class="mx-card">
      <div class="mx-fields">
        <label class="mx-field"><span>Year</span>
          <select value={props.year} onChange={(event) => props.onYear(event.currentTarget.value)}>
            <For each={yearOptions}>{(year) => <option value={year}>{year}</option>}</For>
          </select>
        </label>
        <label class="mx-field"><span>Month</span>
          <select value={props.month} onChange={(event) => props.onMonth(event.currentTarget.value)}>
            <For each={monthOptions}>{(month) => <option value={month}>{month}</option>}</For>
          </select>
        </label>
      </div>
    </div>
  )
}

function YearFilter(props: { year: string; onYear: (year: string) => void }) {
  return (
    <div class="mx-card">
      <label class="mx-field"><span>Year</span>
        <select value={props.year} onChange={(event) => props.onYear(event.currentTarget.value)}>
          <For each={yearOptions}>{(year) => <option value={year}>{year}</option>}</For>
        </select>
      </label>
    </div>
  )
}

function OperationsView(props: NativeViewProps) {
  const selectedYear = () => yearOptions.includes(props.query.opsYear ?? "") ? props.query.opsYear! : String(props.page.year)
  const tickets = () => records(props.page.data.opsTickets).filter((row) => yearOf(row) === selectedYear())
  const slaRows = () => records(props.page.data.opsSLA).filter((row) => yearOf(row) === selectedYear())
  const heatRows = () => records(props.page.data.opsHeatmap).filter((row) => yearOf(row) === selectedYear())
  const categories = () => Array.isArray(props.page.data.opsCats) ? props.page.data.opsCats.filter((item): item is string => typeof item === "string") : []
  const itemNames = () => Array.isArray(props.page.data.opsHmItems) ? props.page.data.opsHmItems.filter((item): item is string => typeof item === "string") : []
  const ticketRows = () => tickets().flatMap((row) => Object.entries(row).flatMap(([key, cell]) => {
    const match = /^([^|]+)\|(Incidents|Service Requests)\|(Initial Balance|Open|Closed)$/.exec(key)
    return match ? [[monthOf(row), match[1]!, match[2]!, match[3]!, typeof cell === "string" || typeof cell === "number" ? cell : null] as const] : []
  }))
  return (
    <>
      <YearFilter year={selectedYear()} onYear={(year) => props.onQuery({ ...props.query, opsYear: year })} />
      <Show when={Array.isArray(props.page.data.opsTickets)} fallback={<ProjectionUnavailable name="Ticket Register" />}>
        <ReadTable name="Ticket Register · source records" columns={["Month", "Category", "Type", "Measure", "Value"]} rows={ticketRows()} empty="No ticket records for this year." />
      </Show>
      <ReadTable name="SLA and Availability" columns={["Month", "Incident SLA", "Service SLA", "Availability"]}
        rows={slaRows().map((row) => [monthOf(row), value(row, "incSLA"), value(row, "svcSLA"), value(row, "avail")])}
        empty={Array.isArray(props.page.data.opsSLA) ? "No SLA records for this year." : "SLA projection unavailable."} />
      <Show when={Array.isArray(props.page.data.opsHeatmap)} fallback={<ProjectionUnavailable name="Heat Map" />}>
        <ReadTable name="Heat Map · selected year" columns={["Item", "Month", "P1", "P2", "Tickets", "Comments"]}
          rows={heatRows().map((row) => [value(row, "item"), monthOf(row), value(row, "p1"), value(row, "p2"), value(row, "tickets"), value(row, "comments")])}
          empty="No heat-map records for this year." />
      </Show>
      <Show when={Array.isArray(props.page.data.opsHmItems)} fallback={<ProjectionUnavailable name="Heat-map items" />}>
        <ReadTable name="Heat-map item names" columns={["Item"]} rows={itemNames().map((item) => [item])} empty="No heat-map items are available." />
      </Show>
      <Show when={Array.isArray(props.page.data.opsCats)} fallback={<ProjectionUnavailable name="Ticket categories" />}>
        <ReadTable name="Ticket categories" columns={["Category"]} rows={categories().map((category) => [category])} empty="No ticket categories are available." />
      </Show>
      <ProjectionNote text="Customer monthly totals, annual totals, Final Balance, and the opened/closed chart require a server-owned projection. This view shows source ticket values only." />
    </>
  )
}

function SecurityView(props: NativeViewProps) {
  const selectedYear = () => yearOptions.includes(props.query.secYear ?? "") ? props.query.secYear! : String(props.page.year)
  const selectedMonth = () => monthOptions.includes(props.query.securityMonth ?? "") ? props.query.securityMonth! : String(props.page.month)
  const monthly = () => records(props.page.data.secKpi).filter((row) => yearOf(row) === selectedYear() && monthOf(row) === selectedMonth())
  const incidentRows = () => records(props.page.data.secIncidents).filter((row) => typeof row.date === "string" && row.date.startsWith(selectedYear()))
  const campaignRows = () => records(props.page.data.secPhishing)
  return (
    <>
      <PeriodFilters
        year={selectedYear()} month={selectedMonth()}
        onYear={(year) => props.onQuery({ ...props.query, secYear: year })}
        onMonth={(month) => props.onQuery({ ...props.query, securityMonth: month })}
      />
      <Show when={Array.isArray(props.page.data.secKpi)} fallback={<ProjectionUnavailable name="Monthly Entries" />}>
        <ReadTable name="Monthly Entries · source values" columns={["Month", ...securityFields.map(([, label]) => label), "Notes"]}
          rows={monthly().map((row) => [monthOf(row), ...securityFields.map(([field]) => value(row, field)), value(row, "notes")])}
          empty="No monthly KPI record for this period." />
      </Show>
      <ProjectionNote text="KPI status/targets, missing-versus-zero summaries, calculated SOC Closure, and derived SOC severity totals require a server-owned projection." />
      <Show when={Array.isArray(props.page.data.secActions)} fallback={<ProjectionUnavailable name="Management Actions" />}>
        <ReadTable name="Management Actions" columns={["Action", "Done"]} rows={records(props.page.data.secActions).map((row) => [value(row, "text"), value(row, "done")])} empty="No management actions." />
      </Show>
      <Show when={Array.isArray(props.page.data.secPhishing)} fallback={<ProjectionUnavailable name="Phishing Simulation" />}>
        <ReadTable name="Phishing Campaigns · source values"
          columns={["Campaign", "Start", "End", "Targeted", "No interaction", "Opened only", "Clicked", "Entered", "Reported", "Training completion", "Average minutes", "Notes"]}
          rows={campaignRows().map((row) => [value(row, "name"), value(row, "start"), value(row, "end"), value(row, "targeted"), value(row, "noInteraction"), value(row, "openedOnly"), value(row, "clicked"), value(row, "entered"), value(row, "reported"), value(row, "trainingCompletion"), value(row, "avgMinutes"), value(row, "notes")])}
          empty="No phishing campaigns." />
        <For each={campaignRows()}>
          {(campaign) => {
            const departmentName = "Departments · " + display(value(campaign, "name"))
            if (!Array.isArray(campaign.departments)) return <ProjectionUnavailable name={departmentName} />
            const departments = records(campaign.departments)
            return <ReadTable name={departmentName} columns={["Department", "Users", "Failed", "Entered", "Reported"]} rows={departments.map((row) => [value(row, "name"), value(row, "users"), value(row, "failed"), value(row, "entered"), value(row, "reported")])} empty="No department rows in this campaign." />
          }}
        </For>
      </Show>
      <Show when={Array.isArray(props.page.data.secIncidents)} fallback={<ProjectionUnavailable name="Security Incidents with Business Impact" />}>
        <ReadTable name="Security Incidents with Business Impact"
          columns={["Title", "Date", "Impact", "Notes", "Contained", "Remediated", "Root cause fixed", "Consequences"]}
          rows={incidentRows().map((row) => [value(row, "title"), value(row, "date"), value(row, "impact"), value(row, "notes"), value(row, "contained"), value(row, "remediated"), value(row, "rootCause"), Array.isArray(row.consequences) ? row.consequences.filter((item): item is string => typeof item === "string").join(", ") : null])}
          empty="No incidents for this year." />
      </Show>
      <ProjectionNote text="Campaign rates and tones, incident status, and selected-year open incident count require a server-owned projection." />
    </>
  )
}

function ContractsView(props: NativeViewProps) {
  const contractsAvailable = () => Array.isArray(props.page.data.contracts)
  const contracts = () => records(props.page.data.contracts)
  const evaluation = () => props.query.filter ?? ""
  const search = () => (props.query.q ?? "").trim().toLocaleLowerCase()
  const visibleContracts = () => contracts().filter((contract) => {
    if (evaluation() && value(contract, "eval") !== evaluation()) return false
    if (!search()) return true
    return ["vendor", "num", "name", "desc", "category", "owner", "notes"].some((field) => String(contract[field] ?? "").toLocaleLowerCase().includes(search()))
  })
  const contractRows = () => visibleContracts().map((contract) => [
    value(contract, "vendor"), value(contract, "num"), value(contract, "amount"),
    value(contract, "amtType"), value(contract, "currency"), value(contract, "renewType"),
    value(contract, "renewal"), value(contract, "eval"), value(contract, "desc"),
    records(contract.docs).map((doc) => display(value(doc, "name"))).join(", ") || "—",
  ])
  return (
    <>
      <div class="mx-card"><div class="mx-fields">
        <label class="mx-field"><span>Evaluation</span>
          <select value={evaluation()} onChange={(event) => props.onQuery({ ...props.query, filter: event.currentTarget.value || undefined })}>
            <option value="">All evaluations</option>
            <For each={["A", "B", "C", "D"]}>{(grade) => <option value={grade}>{grade}</option>}</For>
          </select>
        </label>
        <label class="mx-field"><span>Search contracts</span>
          <input class="mx-search" type="search" value={props.query.q ?? ""} onInput={(event) => props.onQuery({ ...props.query, q: event.currentTarget.value || undefined })} />
        </label>
      </div></div>
      <Show when={contractsAvailable()} fallback={<ProjectionUnavailable name="Contract Register" />}>
        <ReadTable name="Contract Register"
          columns={["Vendor", "Contract #", "Amount", "Type", "Currency", "Renewal", "Renewal date", "Eval", "Notes", "Documents"]}
          rows={contractRows()} empty="No contracts match these filters." />
        <For each={visibleContracts()}>
          {(contract) => {
            const docs = records(contract.docs)
            const vendor = display(value(contract, "vendor"))
            return (
              <section class="mx-card" aria-label={"Contract details · " + vendor}>
                <h2 class="mx-section">{vendor}</h2>
                <dl class="mx-fields">
                  <Detail label="Contract name" value={value(contract, "name")} />
                  <Detail label="Description" value={value(contract, "desc")} />
                  <Detail label="Category" value={value(contract, "category")} />
                  <Detail label="Owner" value={value(contract, "owner")} />
                  <Detail label="Start" value={value(contract, "start")} />
                  <Detail label="End" value={value(contract, "end")} />
                  <Detail label="Notice period" value={value(contract, "notice")} />
                  <Detail label="Stored notes" value={value(contract, "notes")} />
                </dl>
                <ReadTable name={"Documents · " + vendor} columns={["Document", "Size", "Type", "Added", "Availability"]}
                  rows={docs.map((doc) => [value(doc, "name"), value(doc, "size"), value(doc, "type"), value(doc, "added"), value(doc, "status")])}
                  empty="No document metadata is available for this contract." />
              </section>
            )
          }}
        </For>
      </Show>
      <ProjectionNote text="Contract sort modes and fixed-renewal alerts are not supplied by the native projection. Currency display semantics are unverified; amounts are shown as source values with their supplied currency and amount type." />
    </>
  )
}

function Detail(props: { label: string; value: Cell }) {
  return <div><dt>{props.label}</dt><dd>{display(props.value)}</dd></div>
}

function ProjectionUnavailable(props: { name: string }) {
  return <section class="mx-card" aria-label={props.name}><h2 class="mx-section">{props.name}</h2><p class="mx-note">Projection unavailable.</p></section>
}

function ProjectionNote(props: { text: string }) {
  return <aside class="mx-card" aria-label="Projection requirements"><MxBadge>{props.text}</MxBadge></aside>
}

export function DashboardOperationsView(props: NativeViewProps) {
  const authorizedPage = () =>
    props.page.surface === "dashboard" &&
    ownedPages.includes(props.page.page as (typeof ownedPages)[number]) &&
    props.page.pages.includes(props.page.page)
  return (
    <Show when={authorizedPage()} fallback={<section class="mx-page" role="status" aria-label="Dashboard page unavailable" />}>
      <MxPage id="dashboard-operations" title={props.page.page} description="Read-only dashboard information from the authorized page projection.">
        <Switch>
          <Match when={props.page.page === "IT Operations"}><OperationsView {...props} /></Match>
          <Match when={props.page.page === "IT Security KPIs"}><SecurityView {...props} /></Match>
          <Match when={props.page.page === "Vendor Contracts"}><ContractsView {...props} /></Match>
        </Switch>
      </MxPage>
    </Show>
  )
}

