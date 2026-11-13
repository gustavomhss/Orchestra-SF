import { For, Match, Show, Switch, createMemo } from "solid-js"
import { SF_NATIVE_DASHBOARD_PORTFOLIO_COPY } from "@/i18n/orchestra-chapters/sucafina-native-dashboard-portfolio"
import { useLanguage } from "@/context/language"
import type { NativeViewProps } from "./view-contract"

type CopyKey = keyof typeof SF_NATIVE_DASHBOARD_PORTFOLIO_COPY
type Copy = (key: CopyKey, params?: Record<string, string | number | boolean>) => string

const pages = [
  "Hot Topics & Actions",
  "Portfolio Dashboard",
  "All Projects",
  "IT Risks",
  "Stakeholder Management",
  "IT Performance Contract",
]

type Row = Record<string, unknown>
type Column = { label: CopyKey; key: string; format?: "percent" | "fraction" | "boolean" }

const projectColumns: Column[] = [
  { label: "sucafina.native.dashboard-portfolio.column.project", key: "name" },
  { label: "sucafina.native.dashboard-portfolio.column.projectManager", key: "pm" },
  { label: "sucafina.native.dashboard-portfolio.column.status", key: "status" },
  { label: "sucafina.native.dashboard-portfolio.column.risk", key: "risk" },
  { label: "sucafina.native.dashboard-portfolio.column.priority", key: "priority" },
  { label: "sucafina.native.dashboard-portfolio.column.start", key: "start" },
  { label: "sucafina.native.dashboard-portfolio.column.end", key: "end" },
  { label: "sucafina.native.dashboard-portfolio.column.budget", key: "budget" },
  { label: "sucafina.native.dashboard-portfolio.column.spent", key: "spent" },
  { label: "sucafina.native.dashboard-portfolio.column.progress", key: "pct", format: "percent" },
  { label: "sucafina.native.dashboard-portfolio.column.watchList", key: "watchList", format: "boolean" },
]
const topicColumns: Column[] = [
  { label: "sucafina.native.dashboard-portfolio.column.action", key: "action" },
  { label: "sucafina.native.dashboard-portfolio.column.responsible", key: "responsible" },
  { label: "sucafina.native.dashboard-portfolio.column.due", key: "due" },
  { label: "sucafina.native.dashboard-portfolio.column.priority", key: "priority" },
  { label: "sucafina.native.dashboard-portfolio.column.status", key: "status" },
  { label: "sucafina.native.dashboard-portfolio.column.notes", key: "notes" },
]
const riskColumns: Column[] = [
  { label: "sucafina.native.dashboard-portfolio.column.riskTitle", key: "title" },
  { label: "sucafina.native.dashboard-portfolio.column.risk", key: "name" },
  { label: "sucafina.native.dashboard-portfolio.column.impact", key: "impact" },
  { label: "sucafina.native.dashboard-portfolio.column.probability", key: "probability" },
  { label: "sucafina.native.dashboard-portfolio.column.actionPlan", key: "action" },
  { label: "sucafina.native.dashboard-portfolio.column.responsible", key: "responsible" },
  { label: "sucafina.native.dashboard-portfolio.column.status", key: "status" },
]
const stakeholderColumns: Column[] = [
  { label: "sucafina.native.dashboard-portfolio.column.stakeholder", key: "name" },
  { label: "sucafina.native.dashboard-portfolio.column.position", key: "position" },
  { label: "sucafina.native.dashboard-portfolio.column.businessInfluence", key: "biz" },
  { label: "sucafina.native.dashboard-portfolio.column.itInfluence", key: "iti" },
  { label: "sucafina.native.dashboard-portfolio.column.itPerception", key: "perc" },
  { label: "sucafina.native.dashboard-portfolio.column.priorityOverride", key: "priority" },
  { label: "sucafina.native.dashboard-portfolio.column.owner", key: "owner" },
]
const milestoneColumns: Column[] = [
  { label: "sucafina.native.dashboard-portfolio.column.milestone", key: "name" },
  { label: "sucafina.native.dashboard-portfolio.column.date", key: "date" },
  { label: "sucafina.native.dashboard-portfolio.column.status", key: "status" },
  { label: "sucafina.native.dashboard-portfolio.column.notes", key: "notes" },
]
const performanceColumns: Column[] = [
  { label: "sucafina.native.dashboard-portfolio.column.subItem", key: "label" },
  { label: "sucafina.native.dashboard-portfolio.column.objective", key: "objective" },
  { label: "sucafina.native.dashboard-portfolio.column.description", key: "description" },
  { label: "sucafina.native.dashboard-portfolio.column.target", key: "target" },
  { label: "sucafina.native.dashboard-portfolio.column.weight", key: "totalWeight", format: "fraction" },
  { label: "sucafina.native.dashboard-portfolio.column.owner", key: "owner" },
  { label: "sucafina.native.dashboard-portfolio.column.ownerWeight", key: "ownerWeight", format: "fraction" },
  { label: "sucafina.native.dashboard-portfolio.column.firstCoOwner", key: "co1" },
  { label: "sucafina.native.dashboard-portfolio.column.firstCoOwnerWeight", key: "co1Weight", format: "fraction" },
  { label: "sucafina.native.dashboard-portfolio.column.secondCoOwner", key: "co2" },
  { label: "sucafina.native.dashboard-portfolio.column.secondCoOwnerWeight", key: "co2Weight", format: "fraction" },
  { label: "sucafina.native.dashboard-portfolio.column.score", key: "score" },
  { label: "sucafina.native.dashboard-portfolio.column.status", key: "status" },
  { label: "sucafina.native.dashboard-portfolio.column.q1", key: "q1" },
  { label: "sucafina.native.dashboard-portfolio.column.q1Status", key: "statusQ1" },
  { label: "sucafina.native.dashboard-portfolio.column.q2", key: "q2" },
  { label: "sucafina.native.dashboard-portfolio.column.q2Status", key: "statusQ2" },
  { label: "sucafina.native.dashboard-portfolio.column.q3", key: "q3" },
  { label: "sucafina.native.dashboard-portfolio.column.q3Status", key: "statusQ3" },
  { label: "sucafina.native.dashboard-portfolio.column.q4", key: "q4" },
  { label: "sucafina.native.dashboard-portfolio.column.q4Status", key: "statusQ4" },
  { label: "sucafina.native.dashboard-portfolio.column.notes", key: "notes" },
]

export function DashboardPortfolioView(props: NativeViewProps) {
  const language = useLanguage()
  const copy: Copy = (key, params) => language.t(key, params)
  const active = () => props.page.surface === "dashboard" && pages.includes(props.page.page) && props.page.pages.includes(props.page.page)
  const data = () => props.page.data
  const collection = () => {
    if (props.page.page === "Hot Topics & Actions") return "hotTopics"
    if (props.page.page === "Portfolio Dashboard" || props.page.page === "All Projects") return "projects"
    if (props.page.page === "IT Risks") return "risks"
    if (props.page.page === "Stakeholder Management") return "stakeholders"
    return "itperf"
  }
  const source = () => active() ? data()[collection()] : undefined
  const projectPage = () => props.page.page === "Portfolio Dashboard" || props.page.page === "All Projects"
  const filtered = createMemo(() => {
    const entries = rows(source())
    const page = props.page.page
    if (page === "Hot Topics & Actions") return entries.filter((row) =>
      (!props.query.topicStatus || row.status === props.query.topicStatus) &&
      (!props.query.priority || row.priority === props.query.priority),
    )
    if (page === "Portfolio Dashboard" || page === "All Projects" || page === "IT Risks" || page === "Stakeholder Management") {
      const query = (props.query.q ?? "").trim().toLowerCase()
      return entries.filter((row) =>
        (!query || [row.name, row.title, row.desc].some((value) => typeof value === "string" && value.toLowerCase().includes(query))) &&
        (!props.query.status || row.status === props.query.status) &&
        (!props.query.owner || [row.owner, row.responsible, row.pm].includes(props.query.owner)) &&
        (props.query.filter !== "watch" || row.watchList === true) &&
        (!projectPage() || props.query.filter !== "at-risk" || row.risk === "Medium" || row.risk === "High"),
      )
    }
    return entries
  })
  const setQuery = (key: "q" | "status" | "filter" | "topicStatus" | "priority", value: string) =>
    props.onQuery({ ...props.query, [key]: value })

  return (
    <Show when={active()}>
      <section aria-label={copy(pageLabelKey(props.page.page))}>
        <Switch>
          <Match when={props.page.page === "Hot Topics & Actions"}>
            <div class="mx-card">
              <div class="mx-fields">
                <Select copy={copy} label="sucafina.native.dashboard-portfolio.filter.topicStatus" value={props.query.topicStatus ?? ""} options={[["", "sucafina.native.dashboard-portfolio.option.allStatuses"], ["open", "sucafina.native.dashboard-portfolio.option.notStarted"], ["progress", "sucafina.native.dashboard-portfolio.option.inProgress"], ["blocked", "sucafina.native.dashboard-portfolio.option.blocked"], ["done", "sucafina.native.dashboard-portfolio.option.done"]]} onChange={(value) => setQuery("topicStatus", value)} />
                <Select copy={copy} label="sucafina.native.dashboard-portfolio.filter.priority" value={props.query.priority ?? ""} options={[["", "sucafina.native.dashboard-portfolio.option.allPriorities"], ["critical", "sucafina.native.dashboard-portfolio.option.critical"], ["high", "sucafina.native.dashboard-portfolio.option.high"], ["normal", "sucafina.native.dashboard-portfolio.option.normal"]]} onChange={(value) => setQuery("priority", value)} />
              </div>
              <Collection copy={copy} name="sucafina.native.dashboard-portfolio.collection.actions" source={source()} entries={filtered()} columns={topicColumns} />
            </div>
          </Match>
          <Match when={projectPage()}>
            <div class="mx-card">
              <div class="mx-fields">
                <label class="mx-field"><span>{copy("sucafina.native.dashboard-portfolio.filter.search")}</span><input type="search" value={props.query.q ?? ""} onChange={(event) => setQuery("q", event.currentTarget.value)} /></label>
                <Select copy={copy} label="sucafina.native.dashboard-portfolio.filter.status" value={props.query.status ?? ""} options={[["", "sucafina.native.dashboard-portfolio.option.allStatuses"], ["Planning", "sucafina.native.dashboard-portfolio.option.planning"], ["In Progress", "sucafina.native.dashboard-portfolio.option.inProgress"], ["On Hold", "sucafina.native.dashboard-portfolio.option.onHold"], ["Completed", "sucafina.native.dashboard-portfolio.option.completed"]]} onChange={(value) => setQuery("status", value)} />
                <Select copy={copy} label="sucafina.native.dashboard-portfolio.filter.show" value={props.query.filter === "watch" || props.query.filter === "at-risk" ? props.query.filter : ""} options={[["", "sucafina.native.dashboard-portfolio.option.allProjects"], ["watch", "sucafina.native.dashboard-portfolio.option.watchList"], ["at-risk", "sucafina.native.dashboard-portfolio.option.atRisk"]]} onChange={(value) => setQuery("filter", value)} />
              </div>
              <Collection copy={copy} name="sucafina.native.dashboard-portfolio.collection.projects" source={source()} entries={filtered()} columns={projectColumns} />
              <For each={filtered()}>{(project) => (
                <details>
                  <summary>{display(project.name, copy)}</summary>
                  <Fields copy={copy} row={project} fields={[["sucafina.native.dashboard-portfolio.column.description", "desc"], ["sucafina.native.dashboard-portfolio.column.notes", "notes"]]} />
                  <Collection copy={copy} name="sucafina.native.dashboard-portfolio.collection.milestones" source={project.milestones} entries={rows(project.milestones)} columns={milestoneColumns} />
                </details>
              )}</For>
            </div>
          </Match>
          <Match when={props.page.page === "IT Risks"}>
            <div class="mx-card">
              <div class="mx-fields">
                <label class="mx-field"><span>{copy("sucafina.native.dashboard-portfolio.filter.search")}</span><input type="search" value={props.query.q ?? ""} onChange={(event) => setQuery("q", event.currentTarget.value)} /></label>
                <Select copy={copy} label="sucafina.native.dashboard-portfolio.filter.status" value={props.query.status ?? ""} options={[["", "sucafina.native.dashboard-portfolio.option.allStatuses"], ["open", "sucafina.native.dashboard-portfolio.option.open"], ["mitigating", "sucafina.native.dashboard-portfolio.option.mitigating"], ["monitoring", "sucafina.native.dashboard-portfolio.option.monitoring"], ["closed", "sucafina.native.dashboard-portfolio.option.closed"]]} onChange={(value) => setQuery("status", value)} />
              </div>
              <Show when={!props.query.filter} fallback={<div role="status"><p><bdi>{copy("sucafina.native.dashboard-portfolio.status.riskTierUnavailable", { filter: props.query.filter ?? "" })}</bdi></p><button type="button" class="mx-btn" onClick={() => setQuery("filter", "")}>{copy("sucafina.native.dashboard-portfolio.action.clearFilter")}</button></div>}>
                <Collection copy={copy} name="sucafina.native.dashboard-portfolio.collection.riskRegister" source={source()} entries={filtered()} columns={riskColumns} />
                <For each={filtered()}>{(risk) => <details><summary>{display(risk.name, copy)}</summary><Fields copy={copy} row={risk} fields={[["sucafina.native.dashboard-portfolio.column.description", "desc"], ["sucafina.native.dashboard-portfolio.field.category", "category"], ["sucafina.native.dashboard-portfolio.column.owner", "owner"], ["sucafina.native.dashboard-portfolio.field.mitigation", "mitigation"], ["sucafina.native.dashboard-portfolio.field.dueDate", "due"], ["sucafina.native.dashboard-portfolio.column.notes", "notes"]]} /></details>}</For>
              </Show>
            </div>
          </Match>
          <Match when={props.page.page === "Stakeholder Management"}>
            <div class="mx-card">
              <label class="mx-field"><span>{copy("sucafina.native.dashboard-portfolio.filter.search")}</span><input type="search" value={props.query.q ?? ""} onChange={(event) => setQuery("q", event.currentTarget.value)} /></label>
              <Collection copy={copy} name="sucafina.native.dashboard-portfolio.collection.stakeholderRegister" source={source()} entries={filtered()} columns={stakeholderColumns} />
              <For each={filtered()}>{(stakeholder) => <details><summary>{display(stakeholder.name, copy)}</summary><Fields copy={copy} row={stakeholder} fields={[["sucafina.native.dashboard-portfolio.field.title", "title"], ["sucafina.native.dashboard-portfolio.field.company", "company"], ["sucafina.native.dashboard-portfolio.field.department", "department"], ["sucafina.native.dashboard-portfolio.field.role", "role"], ["sucafina.native.dashboard-portfolio.field.email", "email"], ["sucafina.native.dashboard-portfolio.field.actionPlan", "action"], ["sucafina.native.dashboard-portfolio.column.notes", "notes"]]} /></details>}</For>
            </div>
          </Match>
          <Match when={props.page.page === "IT Performance Contract"}>
            <div class="mx-card">
              <Performance copy={copy} source={source()} />
            </div>
          </Match>
        </Switch>
      </section>
    </Show>
  )
}

function pageLabelKey(page: string): CopyKey {
  if (page === "Hot Topics & Actions") return "sucafina.native.dashboard-portfolio.page.hotTopics"
  if (page === "Portfolio Dashboard") return "sucafina.native.dashboard-portfolio.page.portfolioDashboard"
  if (page === "All Projects") return "sucafina.native.dashboard-portfolio.page.allProjects"
  if (page === "IT Risks") return "sucafina.native.dashboard-portfolio.page.itRisks"
  if (page === "Stakeholder Management") return "sucafina.native.dashboard-portfolio.page.stakeholders"
  return "sucafina.native.dashboard-portfolio.page.performance"
}

function Select(props: { copy: Copy; label: CopyKey; value: string; options: [string, CopyKey][]; onChange: (value: string) => void }) {
  return <label class="mx-field"><span>{props.copy(props.label)}</span><select value={props.value} onChange={(event) => props.onChange(event.currentTarget.value)}><For each={props.options}>{(option) => <option value={option[0]}>{props.copy(option[1])}</option>}</For></select></label>
}

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((row): row is Row => row !== null && typeof row === "object" && !Array.isArray(row)) : []
}

function display(value: unknown, copy: Copy, format?: Column["format"]): string {
  if (value === null || value === undefined || value === "") return "—"
  if (format === "boolean") return value === true ? copy("sucafina.native.dashboard-portfolio.value.yes") : value === false ? copy("sucafina.native.dashboard-portfolio.value.no") : "—"
  if (format === "fraction" && typeof value === "number" && Number.isFinite(value)) return new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 2 }).format(value)
  if (format === "percent" && (typeof value === "number" || typeof value === "string")) return `${value}%`
  if (typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) return String(value)
  return "—"
}

function Collection(props: { copy: Copy; name: CopyKey; params?: Record<string, string | number | boolean>; source: unknown; entries: Row[]; columns: Column[] }) {
  const name = () => props.copy(props.name, props.params)
  return (
    <section aria-label={name()}>
      <h2 class="mx-section">{name()}</h2>
      <Show when={Array.isArray(props.source)} fallback={<p role="status">{props.copy("sucafina.native.dashboard-portfolio.status.unavailable")}</p>}>
        <div class="mx-table" style={{ "overflow-x": "auto", "max-width": "100%" }}>
          <table aria-label={name()}>
            <thead><tr><For each={props.columns}>{(column) => <th scope="col">{props.copy(column.label)}</th>}</For></tr></thead>
            <tbody><For each={props.entries}>{(row) => <tr><For each={props.columns}>{(column) => <td><bdi>{display(row[column.key], props.copy, column.format)}</bdi></td>}</For></tr>}</For></tbody>
          </table>
        </div>
        <Show when={props.entries.length === 0}><p role="status">{props.copy("sucafina.native.dashboard-portfolio.status.empty")}</p></Show>
      </Show>
    </section>
  )
}

function Fields(props: { copy: Copy; row: Row; fields: [CopyKey, string][] }) {
  return <dl><For each={props.fields}>{(field) => <><dt>{props.copy(field[0])}</dt><dd><bdi>{display(props.row[field[1]], props.copy)}</bdi></dd></>}</For></dl>
}

function Performance(props: { copy: Copy; source: unknown }) {
  const performance = () => props.source !== null && typeof props.source === "object" && !Array.isArray(props.source) ? props.source as Row : undefined
  return (
    <Show when={performance()} fallback={<p role="status">{props.copy("sucafina.native.dashboard-portfolio.status.unavailable")}</p>}>
      {(contract) => <>
        <Fields copy={props.copy} row={contract()} fields={[["sucafina.native.dashboard-portfolio.field.contract", "name"], ["sucafina.native.dashboard-portfolio.field.year", "year"]]} />
        <Show when={Array.isArray(contract().items)} fallback={<p role="status">{props.copy("sucafina.native.dashboard-portfolio.status.itemsUnavailable")}</p>}>
          <Show when={rows(contract().items).length > 0} fallback={<p role="status">{props.copy("sucafina.native.dashboard-portfolio.status.noContractItems")}</p>}>
            <For each={rows(contract().items)}>{(item) => <section>
              <h2 class="mx-section">{display(item.name, props.copy)}</h2>
              <Fields copy={props.copy} row={item} fields={[["sucafina.native.dashboard-portfolio.column.description", "description"]]} />
              <dl><dt>{props.copy("sucafina.native.dashboard-portfolio.field.itemWeight")}</dt><dd>{display(item.totalWeight, props.copy, "fraction")}</dd><dt>{props.copy("sucafina.native.dashboard-portfolio.column.ownerWeight")}</dt><dd>{display(item.ownerWeight, props.copy, "fraction")}</dd><dt>{props.copy("sucafina.native.dashboard-portfolio.field.firstCoOwnerWeight")}</dt><dd>{display(item.co1Weight, props.copy, "fraction")}</dd><dt>{props.copy("sucafina.native.dashboard-portfolio.field.secondCoOwnerWeight")}</dt><dd>{display(item.co2Weight, props.copy, "fraction")}</dd></dl>
              <Collection copy={props.copy} name="sucafina.native.dashboard-portfolio.collection.subItems" params={{ name: display(item.name, props.copy) }} source={item.subs} entries={rows(item.subs)} columns={performanceColumns} />
            </section>}</For>
          </Show>
        </Show>
      </>}
    </Show>
  )
}
