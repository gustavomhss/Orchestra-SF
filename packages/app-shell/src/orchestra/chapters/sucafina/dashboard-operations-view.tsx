import { For, Match, Show, Switch } from "solid-js"
import { useLanguage } from "@/context/language"
import { MxBadge, MxPage } from "../kit"
import type { NativeViewProps } from "./view-contract"

type Row = Record<string, unknown>
type Cell = string | number | boolean | null | undefined

const operationsPages = ["IT Operations", "IT Security KPIs"] as const
const ownedPages = [...operationsPages, "Vendor Contracts"] as const
const monthOptions = Array.from({ length: 12 }, (_, index) => String(index + 1))
const yearOptions = ["2024", "2025", "2026", "2027"]
const securityFields = [
  ["training", "sucafina.native.dashboard-operations.kpi.training"],
  ["assessment", "sucafina.native.dashboard-operations.kpi.assessment"],
  ["scan", "sucafina.native.dashboard-operations.kpi.scan"],
  ["patch", "sucafina.native.dashboard-operations.kpi.patchGeneral"],
  ["patchEndpoint", "sucafina.native.dashboard-operations.kpi.patchEndpoint"],
  ["patchServer", "sucafina.native.dashboard-operations.kpi.patchServer"],
  ["socCritical", "sucafina.native.dashboard-operations.kpi.socCritical"],
  ["socHigh", "sucafina.native.dashboard-operations.kpi.socHigh"],
  ["socMedium", "sucafina.native.dashboard-operations.kpi.socMedium"],
  ["socLow", "sucafina.native.dashboard-operations.kpi.socLow"],
  ["socPending", "sucafina.native.dashboard-operations.kpi.pending"],
  ["socTP", "sucafina.native.dashboard-operations.kpi.truePositive"],
  ["socFP", "sucafina.native.dashboard-operations.kpi.falsePositive"],
  ["socEPS", "sucafina.native.dashboard-operations.kpi.socEps"],
  ["socIPs", "sucafina.native.dashboard-operations.kpi.socIps"],
  ["socClosure", "sucafina.native.dashboard-operations.kpi.closureSource"],
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

function display(value: Cell, language: ReturnType<typeof useLanguage>): string {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "boolean") return language.t(value ? "sucafina.native.dashboard-operations.value.yes" : "sucafina.native.dashboard-operations.value.no")
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
  const language = useLanguage()
  return (
    <section class="mx-card" aria-label={props.name}>
      <h2 class="mx-section">{props.name}</h2>
      <Show when={props.rows.length > 0} fallback={<p class="mx-note">{props.empty}</p>}>
        <div class="mx-table" role="region" aria-label={props.name} tabIndex={0}>
          <table>
            <thead><tr><For each={props.columns}>{(column) => <th scope="col">{column}</th>}</For></tr></thead>
            <tbody>
              <For each={props.rows}>
                {(row) => <tr><For each={row}>{(cell) => <td>{display(cell, language)}</td>}</For></tr>}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </section>
  )
}

function PeriodFilters(props: { year: string; month: string; onYear: (year: string) => void; onMonth: (month: string) => void }) {
  const language = useLanguage()
  return (
    <div class="mx-card">
      <div class="mx-fields">
        <label class="mx-field"><span>{language.t("sucafina.native.dashboard-operations.filter.year")}</span>
          <select value={props.year} onChange={(event) => props.onYear(event.currentTarget.value)}>
            <For each={yearOptions}>{(year) => <option value={year}>{year}</option>}</For>
          </select>
        </label>
        <label class="mx-field"><span>{language.t("sucafina.native.dashboard-operations.filter.month")}</span>
          <select value={props.month} onChange={(event) => props.onMonth(event.currentTarget.value)}>
            <For each={monthOptions}>{(month) => <option value={month}>{month}</option>}</For>
          </select>
        </label>
      </div>
    </div>
  )
}

function YearFilter(props: { year: string; onYear: (year: string) => void }) {
  const language = useLanguage()
  return (
    <div class="mx-card">
      <label class="mx-field"><span>{language.t("sucafina.native.dashboard-operations.filter.year")}</span>
        <select value={props.year} onChange={(event) => props.onYear(event.currentTarget.value)}>
          <For each={yearOptions}>{(year) => <option value={year}>{year}</option>}</For>
        </select>
      </label>
    </div>
  )
}

function OperationsView(props: NativeViewProps) {
  const language = useLanguage()
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
      <Show when={Array.isArray(props.page.data.opsTickets)} fallback={<ProjectionUnavailable name={language.t("sucafina.native.dashboard-operations.table.ticketRegisterUnavailable")} />}>
        <ReadTable name={language.t("sucafina.native.dashboard-operations.table.ticketRegister")} columns={[
          language.t("sucafina.native.dashboard-operations.column.month"), language.t("sucafina.native.dashboard-operations.column.category"),
          language.t("sucafina.native.dashboard-operations.column.type"), language.t("sucafina.native.dashboard-operations.column.measure"),
          language.t("sucafina.native.dashboard-operations.column.value"),
        ]} rows={ticketRows()} empty={language.t("sucafina.native.dashboard-operations.empty.tickets")} />
      </Show>
      <ReadTable name={language.t("sucafina.native.dashboard-operations.table.sla")} columns={[
        language.t("sucafina.native.dashboard-operations.column.month"), language.t("sucafina.native.dashboard-operations.column.incidentSla"),
        language.t("sucafina.native.dashboard-operations.column.serviceSla"), language.t("sucafina.native.dashboard-operations.column.availability"),
      ]}
        rows={slaRows().map((row) => [monthOf(row), value(row, "incSLA"), value(row, "svcSLA"), value(row, "avail")])}
        empty={language.t(Array.isArray(props.page.data.opsSLA) ? "sucafina.native.dashboard-operations.empty.sla" : "sucafina.native.dashboard-operations.unavailable.sla")} />
      <Show when={Array.isArray(props.page.data.opsHeatmap)} fallback={<ProjectionUnavailable name={language.t("sucafina.native.dashboard-operations.table.heatMapUnavailable")} />}>
        <ReadTable name={language.t("sucafina.native.dashboard-operations.table.heatMap")} columns={[
          language.t("sucafina.native.dashboard-operations.column.item"), language.t("sucafina.native.dashboard-operations.column.month"),
          language.t("sucafina.native.dashboard-operations.column.p1"), language.t("sucafina.native.dashboard-operations.column.p2"),
          language.t("sucafina.native.dashboard-operations.column.tickets"), language.t("sucafina.native.dashboard-operations.column.comments"),
        ]}
          rows={heatRows().map((row) => [value(row, "item"), monthOf(row), value(row, "p1"), value(row, "p2"), value(row, "tickets"), value(row, "comments")])}
          empty={language.t("sucafina.native.dashboard-operations.empty.heatMap")} />
      </Show>
      <Show when={Array.isArray(props.page.data.opsHmItems)} fallback={<ProjectionUnavailable name={language.t("sucafina.native.dashboard-operations.table.heatMapItemsUnavailable")} />}>
        <ReadTable name={language.t("sucafina.native.dashboard-operations.table.heatMapItems")} columns={[language.t("sucafina.native.dashboard-operations.column.item")]} rows={itemNames().map((item) => [item])} empty={language.t("sucafina.native.dashboard-operations.empty.heatMapItems")} />
      </Show>
      <Show when={Array.isArray(props.page.data.opsCats)} fallback={<ProjectionUnavailable name={language.t("sucafina.native.dashboard-operations.table.ticketCategories")} />}>
        <ReadTable name={language.t("sucafina.native.dashboard-operations.table.ticketCategories")} columns={[language.t("sucafina.native.dashboard-operations.column.category")]} rows={categories().map((category) => [category])} empty={language.t("sucafina.native.dashboard-operations.empty.ticketCategories")} />
      </Show>
      <ProjectionNote text={language.t("sucafina.native.dashboard-operations.note.operationsProjection")} />
    </>
  )
}

function SecurityView(props: NativeViewProps) {
  const language = useLanguage()
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
      <Show when={Array.isArray(props.page.data.secKpi)} fallback={<ProjectionUnavailable name={language.t("sucafina.native.dashboard-operations.table.monthlyEntriesUnavailable")} />}>
        <ReadTable name={language.t("sucafina.native.dashboard-operations.table.monthlyEntries")} columns={[
          language.t("sucafina.native.dashboard-operations.column.month"), ...securityFields.map(([, key]) => language.t(key)),
          language.t("sucafina.native.dashboard-operations.column.notes"),
        ]}
          rows={monthly().map((row) => [monthOf(row), ...securityFields.map(([field]) => value(row, field)), value(row, "notes")])}
          empty={language.t("sucafina.native.dashboard-operations.empty.monthlyEntries")} />
      </Show>
      <ProjectionNote text={language.t("sucafina.native.dashboard-operations.note.securityProjection")} />
      <Show when={Array.isArray(props.page.data.secActions)} fallback={<ProjectionUnavailable name={language.t("sucafina.native.dashboard-operations.table.managementActions")} />}>
        <ReadTable name={language.t("sucafina.native.dashboard-operations.table.managementActions")} columns={[
          language.t("sucafina.native.dashboard-operations.column.action"), language.t("sucafina.native.dashboard-operations.column.done"),
        ]} rows={records(props.page.data.secActions).map((row) => [value(row, "text"), value(row, "done")])} empty={language.t("sucafina.native.dashboard-operations.empty.managementActions")} />
      </Show>
      <Show when={Array.isArray(props.page.data.secPhishing)} fallback={<ProjectionUnavailable name={language.t("sucafina.native.dashboard-operations.table.phishingUnavailable")} />}>
        <ReadTable name={language.t("sucafina.native.dashboard-operations.table.phishingCampaigns")}
          columns={[
            language.t("sucafina.native.dashboard-operations.column.campaign"), language.t("sucafina.native.dashboard-operations.column.start"),
            language.t("sucafina.native.dashboard-operations.column.end"), language.t("sucafina.native.dashboard-operations.column.targeted"),
            language.t("sucafina.native.dashboard-operations.column.noInteraction"), language.t("sucafina.native.dashboard-operations.column.openedOnly"),
            language.t("sucafina.native.dashboard-operations.column.clicked"), language.t("sucafina.native.dashboard-operations.column.entered"),
            language.t("sucafina.native.dashboard-operations.column.reported"), language.t("sucafina.native.dashboard-operations.column.trainingCompletion"),
            language.t("sucafina.native.dashboard-operations.column.averageMinutes"), language.t("sucafina.native.dashboard-operations.column.notes"),
          ]}
          rows={campaignRows().map((row) => [value(row, "name"), value(row, "start"), value(row, "end"), value(row, "targeted"), value(row, "noInteraction"), value(row, "openedOnly"), value(row, "clicked"), value(row, "entered"), value(row, "reported"), value(row, "trainingCompletion"), value(row, "avgMinutes"), value(row, "notes")])}
          empty={language.t("sucafina.native.dashboard-operations.empty.phishingCampaigns")} />
        <For each={campaignRows()}>
          {(campaign) => {
            const departmentName = language.t("sucafina.native.dashboard-operations.table.departmentGroup", { campaign: display(value(campaign, "name"), language) })
            if (!Array.isArray(campaign.departments)) return <ProjectionUnavailable name={departmentName} />
            const departments = records(campaign.departments)
            return <ReadTable name={departmentName} columns={[
              language.t("sucafina.native.dashboard-operations.column.department"), language.t("sucafina.native.dashboard-operations.column.users"),
              language.t("sucafina.native.dashboard-operations.column.failed"), language.t("sucafina.native.dashboard-operations.column.entered"),
              language.t("sucafina.native.dashboard-operations.column.reported"),
            ]} rows={departments.map((row) => [value(row, "name"), value(row, "users"), value(row, "failed"), value(row, "entered"), value(row, "reported")])} empty={language.t("sucafina.native.dashboard-operations.empty.departments")} />
          }}
        </For>
      </Show>
      <Show when={Array.isArray(props.page.data.secIncidents)} fallback={<ProjectionUnavailable name={language.t("sucafina.native.dashboard-operations.table.securityIncidents")} />}>
        <ReadTable name={language.t("sucafina.native.dashboard-operations.table.securityIncidents")}
          columns={[
            language.t("sucafina.native.dashboard-operations.column.title"), language.t("sucafina.native.dashboard-operations.column.date"),
            language.t("sucafina.native.dashboard-operations.column.impact"), language.t("sucafina.native.dashboard-operations.column.notes"),
            language.t("sucafina.native.dashboard-operations.column.contained"), language.t("sucafina.native.dashboard-operations.column.remediated"),
            language.t("sucafina.native.dashboard-operations.column.rootCauseFixed"), language.t("sucafina.native.dashboard-operations.column.consequences"),
          ]}
          rows={incidentRows().map((row) => [value(row, "title"), value(row, "date"), value(row, "impact"), value(row, "notes"), value(row, "contained"), value(row, "remediated"), value(row, "rootCause"), Array.isArray(row.consequences) ? row.consequences.filter((item): item is string => typeof item === "string").join(", ") : null])}
          empty={language.t("sucafina.native.dashboard-operations.empty.incidents")} />
      </Show>
      <ProjectionNote text={language.t("sucafina.native.dashboard-operations.note.securityDerived")} />
    </>
  )
}

function ContractsView(props: NativeViewProps) {
  const language = useLanguage()
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
    records(contract.docs).map((doc) => display(value(doc, "name"), language)).join(", ") || "—",
  ])
  return (
    <>
      <div class="mx-card"><div class="mx-fields">
        <label class="mx-field"><span>{language.t("sucafina.native.dashboard-operations.filter.evaluation")}</span>
          <select value={evaluation()} onChange={(event) => props.onQuery({ ...props.query, filter: event.currentTarget.value || undefined })}>
            <option value="">{language.t("sucafina.native.dashboard-operations.empty.allEvaluations")}</option>
            <For each={["A", "B", "C", "D"]}>{(grade) => <option value={grade}>{grade}</option>}</For>
          </select>
        </label>
        <label class="mx-field"><span>{language.t("sucafina.native.dashboard-operations.filter.searchContracts")}</span>
          <input class="mx-search" type="search" value={props.query.q ?? ""} onInput={(event) => props.onQuery({ ...props.query, q: event.currentTarget.value || undefined })} />
        </label>
      </div></div>
      <Show when={contractsAvailable()} fallback={<ProjectionUnavailable name={language.t("sucafina.native.dashboard-operations.table.contractRegister")} />}>
        <ReadTable name={language.t("sucafina.native.dashboard-operations.table.contractRegister")}
          columns={[
            language.t("sucafina.native.dashboard-operations.column.vendor"), language.t("sucafina.native.dashboard-operations.column.contractNumber"),
            language.t("sucafina.native.dashboard-operations.column.amount"), language.t("sucafina.native.dashboard-operations.column.amountType"),
            language.t("sucafina.native.dashboard-operations.column.currency"), language.t("sucafina.native.dashboard-operations.column.renewal"),
            language.t("sucafina.native.dashboard-operations.column.renewalDate"), language.t("sucafina.native.dashboard-operations.column.evaluation"),
            language.t("sucafina.native.dashboard-operations.column.notes"), language.t("sucafina.native.dashboard-operations.column.documents"),
          ]}
          rows={contractRows()} empty={language.t("sucafina.native.dashboard-operations.empty.contracts")} />
        <For each={visibleContracts()}>
          {(contract) => {
            const docs = records(contract.docs)
            const vendor = display(value(contract, "vendor"), language)
            return (
              <section class="mx-card" aria-label={language.t("sucafina.native.dashboard-operations.table.contractDetails", { vendor })}>
                <h2 class="mx-section">{vendor}</h2>
                <dl class="mx-fields">
                  <Detail label={language.t("sucafina.native.dashboard-operations.detail.contractName")} value={value(contract, "name")} />
                  <Detail label={language.t("sucafina.native.dashboard-operations.detail.description")} value={value(contract, "desc")} />
                  <Detail label={language.t("sucafina.native.dashboard-operations.detail.category")} value={value(contract, "category")} />
                  <Detail label={language.t("sucafina.native.dashboard-operations.detail.owner")} value={value(contract, "owner")} />
                  <Detail label={language.t("sucafina.native.dashboard-operations.detail.start")} value={value(contract, "start")} />
                  <Detail label={language.t("sucafina.native.dashboard-operations.detail.end")} value={value(contract, "end")} />
                  <Detail label={language.t("sucafina.native.dashboard-operations.detail.noticePeriod")} value={value(contract, "notice")} />
                  <Detail label={language.t("sucafina.native.dashboard-operations.detail.storedNotes")} value={value(contract, "notes")} />
                </dl>
                <ReadTable name={language.t("sucafina.native.dashboard-operations.table.documents", { vendor })} columns={[
                  language.t("sucafina.native.dashboard-operations.column.document"), language.t("sucafina.native.dashboard-operations.column.size"),
                  language.t("sucafina.native.dashboard-operations.column.documentType"), language.t("sucafina.native.dashboard-operations.column.added"),
                  language.t("sucafina.native.dashboard-operations.column.availability"),
                ]}
                  rows={docs.map((doc) => [value(doc, "name"), value(doc, "size"), value(doc, "type"), value(doc, "added"), value(doc, "status")])}
                  empty={language.t("sucafina.native.dashboard-operations.empty.documents")} />
              </section>
            )
          }}
        </For>
      </Show>
      <ProjectionNote text={language.t("sucafina.native.dashboard-operations.note.contractsProjection")} />
    </>
  )
}

function Detail(props: { label: string; value: Cell }) {
  const language = useLanguage()
  return <div><dt>{props.label}</dt><dd>{display(props.value, language)}</dd></div>
}

function ProjectionUnavailable(props: { name: string }) {
  const language = useLanguage()
  return <section class="mx-card" aria-label={props.name}><h2 class="mx-section">{props.name}</h2><p class="mx-note">{language.t("sucafina.native.dashboard-operations.projection.unavailable")}</p></section>
}

function ProjectionNote(props: { text: string }) {
  const language = useLanguage()
  return <aside class="mx-card" aria-label={language.t("sucafina.native.dashboard-operations.projection.requirements")}><MxBadge>{props.text}</MxBadge></aside>
}

export function DashboardOperationsView(props: NativeViewProps) {
  const language = useLanguage()
  const title = () => props.page.page === "IT Operations"
    ? language.t("sucafina.native.dashboard-operations.page.operations")
    : props.page.page === "IT Security KPIs"
      ? language.t("sucafina.native.dashboard-operations.page.security")
      : language.t("sucafina.native.dashboard-operations.page.contracts")
  const authorizedPage = () =>
    props.page.surface === "dashboard" &&
    ownedPages.includes(props.page.page as (typeof ownedPages)[number]) &&
    props.page.pages.includes(props.page.page)
  return (
      <Show when={authorizedPage()} fallback={<section class="mx-page" role="status" aria-label={language.t("sucafina.native.dashboard-operations.page.unavailable")} />}>
      <MxPage id="dashboard-operations" title={title()} description={language.t("sucafina.native.dashboard-operations.page.description")}>
        <Switch>
          <Match when={props.page.page === "IT Operations"}><OperationsView {...props} /></Match>
          <Match when={props.page.page === "IT Security KPIs"}><SecurityView {...props} /></Match>
          <Match when={props.page.page === "Vendor Contracts"}><ContractsView {...props} /></Match>
        </Switch>
      </MxPage>
    </Show>
  )
}

