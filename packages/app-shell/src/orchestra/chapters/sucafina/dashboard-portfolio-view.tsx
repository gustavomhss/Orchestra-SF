import { For, Match, Show, Switch, createMemo } from "solid-js"
import type { NativeViewProps } from "./view-contract"

const pages = [
  "Hot Topics & Actions",
  "Portfolio Dashboard",
  "All Projects",
  "IT Risks",
  "Stakeholder Management",
  "IT Performance Contract",
]

type Row = Record<string, unknown>
type Column = { label: string; key: string; format?: "percent" | "fraction" | "boolean" }

const projectColumns: Column[] = [
  { label: "Project", key: "name" },
  { label: "Project manager", key: "pm" },
  { label: "Status", key: "status" },
  { label: "Risk", key: "risk" },
  { label: "Priority", key: "priority" },
  { label: "Start", key: "start" },
  { label: "End", key: "end" },
  { label: "Budget", key: "budget" },
  { label: "Spent", key: "spent" },
  { label: "Progress", key: "pct", format: "percent" },
  { label: "Watch list", key: "watchList", format: "boolean" },
]
const topicColumns: Column[] = [
  { label: "Action", key: "action" },
  { label: "Responsible", key: "responsible" },
  { label: "Due", key: "due" },
  { label: "Priority", key: "priority" },
  { label: "Status", key: "status" },
  { label: "Notes", key: "notes" },
]
const riskColumns: Column[] = [
  { label: "Risk Title", key: "title" },
  { label: "Risk", key: "name" },
  { label: "Impact", key: "impact" },
  { label: "Probability", key: "probability" },
  { label: "Action Plan", key: "action" },
  { label: "Responsible", key: "responsible" },
  { label: "Status", key: "status" },
]
const stakeholderColumns: Column[] = [
  { label: "Stakeholder", key: "name" },
  { label: "Position", key: "position" },
  { label: "Business influence", key: "biz" },
  { label: "IT influence", key: "iti" },
  { label: "IT perception", key: "perc" },
  { label: "Priority override", key: "priority" },
  { label: "Owner", key: "owner" },
]
const milestoneColumns: Column[] = [
  { label: "Milestone", key: "name" },
  { label: "Date", key: "date" },
  { label: "Status", key: "status" },
  { label: "Notes", key: "notes" },
]
const performanceColumns: Column[] = [
  { label: "Sub-item", key: "label" },
  { label: "Objective", key: "objective" },
  { label: "Description", key: "description" },
  { label: "Target", key: "target" },
  { label: "Weight", key: "totalWeight", format: "fraction" },
  { label: "Owner", key: "owner" },
  { label: "Owner weight", key: "ownerWeight", format: "fraction" },
  { label: "First co-owner", key: "co1" },
  { label: "First co-owner weight", key: "co1Weight", format: "fraction" },
  { label: "Second co-owner", key: "co2" },
  { label: "Second co-owner weight", key: "co2Weight", format: "fraction" },
  { label: "Score", key: "score" },
  { label: "Status", key: "status" },
  { label: "Q1", key: "q1" },
  { label: "Q1 status", key: "statusQ1" },
  { label: "Q2", key: "q2" },
  { label: "Q2 status", key: "statusQ2" },
  { label: "Q3", key: "q3" },
  { label: "Q3 status", key: "statusQ3" },
  { label: "Q4", key: "q4" },
  { label: "Q4 status", key: "statusQ4" },
  { label: "Notes", key: "notes" },
]

export function DashboardPortfolioView(props: NativeViewProps) {
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
      <section aria-label={props.page.page}>
        <Switch>
          <Match when={props.page.page === "Hot Topics & Actions"}>
            <div class="mx-card">
              <div class="mx-fields">
                <Select label="Filter status" value={props.query.topicStatus ?? ""} options={[["", "All statuses"], ["open", "Not Started"], ["progress", "In Progress"], ["blocked", "Blocked"], ["done", "Done"]]} onChange={(value) => setQuery("topicStatus", value)} />
                <Select label="Priority" value={props.query.priority ?? ""} options={[["", "All priorities"], ["critical", "Critical"], ["high", "High"], ["normal", "Normal"]]} onChange={(value) => setQuery("priority", value)} />
              </div>
              <Collection name="Actions" source={source()} entries={filtered()} columns={topicColumns} />
            </div>
          </Match>
          <Match when={projectPage()}>
            <div class="mx-card">
              <div class="mx-fields">
                <label class="mx-field"><span>Search</span><input type="search" value={props.query.q ?? ""} onChange={(event) => setQuery("q", event.currentTarget.value)} /></label>
                <Select label="Status" value={props.query.status ?? ""} options={[["", "All statuses"], ["Planning", "Planning"], ["In Progress", "In Progress"], ["On Hold", "On Hold"], ["Completed", "Completed"]]} onChange={(value) => setQuery("status", value)} />
                <Select label="Show" value={props.query.filter === "watch" || props.query.filter === "at-risk" ? props.query.filter : ""} options={[["", "All projects"], ["watch", "Watch list"], ["at-risk", "At risk"]]} onChange={(value) => setQuery("filter", value)} />
              </div>
              <Collection name="Projects" source={source()} entries={filtered()} columns={projectColumns} />
              <For each={filtered()}>{(project) => (
                <details>
                  <summary>{display(project.name)}</summary>
                  <Fields row={project} fields={[["Description", "desc"], ["Notes", "notes"]]} />
                  <Collection name="Milestones" source={project.milestones} entries={rows(project.milestones)} columns={milestoneColumns} />
                </details>
              )}</For>
            </div>
          </Match>
          <Match when={props.page.page === "IT Risks"}>
            <div class="mx-card">
              <div class="mx-fields">
                <label class="mx-field"><span>Search</span><input type="search" value={props.query.q ?? ""} onChange={(event) => setQuery("q", event.currentTarget.value)} /></label>
                <Select label="Status" value={props.query.status ?? ""} options={[["", "All statuses"], ["open", "Open"], ["mitigating", "Mitigating"], ["monitoring", "Monitoring"], ["closed", "Closed"]]} onChange={(value) => setQuery("status", value)} />
              </div>
              <Show when={!props.query.filter} fallback={<div role="status"><p>Risk tier data is unavailable for the selected filter: <bdi>{props.query.filter}</bdi>.</p><button type="button" class="mx-btn" onClick={() => setQuery("filter", "")}>Clear filter</button></div>}>
                <Collection name="Risk Register" source={source()} entries={filtered()} columns={riskColumns} />
                <For each={filtered()}>{(risk) => <details><summary>{display(risk.name)}</summary><Fields row={risk} fields={[["Description", "desc"], ["Category", "category"], ["Owner", "owner"], ["Mitigation", "mitigation"], ["Due date", "due"], ["Notes", "notes"]]} /></details>}</For>
              </Show>
            </div>
          </Match>
          <Match when={props.page.page === "Stakeholder Management"}>
            <div class="mx-card">
              <label class="mx-field"><span>Search</span><input type="search" value={props.query.q ?? ""} onChange={(event) => setQuery("q", event.currentTarget.value)} /></label>
              <Collection name="Stakeholder Register" source={source()} entries={filtered()} columns={stakeholderColumns} />
              <For each={filtered()}>{(stakeholder) => <details><summary>{display(stakeholder.name)}</summary><Fields row={stakeholder} fields={[["Title", "title"], ["Company", "company"], ["Department", "department"], ["Role", "role"], ["Email", "email"], ["Action plan", "action"], ["Notes", "notes"]]} /></details>}</For>
            </div>
          </Match>
          <Match when={props.page.page === "IT Performance Contract"}>
            <div class="mx-card">
              <Performance source={source()} />
            </div>
          </Match>
        </Switch>
      </section>
    </Show>
  )
}

function Select(props: { label: string; value: string; options: [string, string][]; onChange: (value: string) => void }) {
  return <label class="mx-field"><span>{props.label}</span><select value={props.value} onChange={(event) => props.onChange(event.currentTarget.value)}><For each={props.options}>{(option) => <option value={option[0]}>{option[1]}</option>}</For></select></label>
}

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((row): row is Row => row !== null && typeof row === "object" && !Array.isArray(row)) : []
}

function display(value: unknown, format?: Column["format"]): string {
  if (value === null || value === undefined || value === "") return "—"
  if (format === "boolean") return value === true ? "Yes" : value === false ? "No" : "—"
  if (format === "fraction" && typeof value === "number" && Number.isFinite(value)) return new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 2 }).format(value)
  if (format === "percent" && (typeof value === "number" || typeof value === "string")) return `${value}%`
  if (typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) return String(value)
  return "—"
}

function Collection(props: { name: string; source: unknown; entries: Row[]; columns: Column[] }) {
  return (
    <section aria-label={props.name}>
      <h2 class="mx-section">{props.name}</h2>
      <Show when={Array.isArray(props.source)} fallback={<p role="status">Information unavailable.</p>}>
        <div class="mx-table" style={{ "overflow-x": "auto", "max-width": "100%" }}>
          <table aria-label={props.name}>
            <thead><tr><For each={props.columns}>{(column) => <th scope="col">{column.label}</th>}</For></tr></thead>
            <tbody><For each={props.entries}>{(row) => <tr><For each={props.columns}>{(column) => <td><bdi>{display(row[column.key], column.format)}</bdi></td>}</For></tr>}</For></tbody>
          </table>
        </div>
        <Show when={props.entries.length === 0}><p role="status">No records to show.</p></Show>
      </Show>
    </section>
  )
}

function Fields(props: { row: Row; fields: [string, string][] }) {
  return <dl><For each={props.fields}>{(field) => <><dt>{field[0]}</dt><dd><bdi>{display(props.row[field[1]])}</bdi></dd></>}</For></dl>
}

function Performance(props: { source: unknown }) {
  const performance = () => props.source !== null && typeof props.source === "object" && !Array.isArray(props.source) ? props.source as Row : undefined
  return (
    <Show when={performance()} fallback={<p role="status">Information unavailable.</p>}>
      {(contract) => <>
        <Fields row={contract()} fields={[["Contract", "name"], ["Year", "year"]]} />
        <Show when={Array.isArray(contract().items)} fallback={<p role="status">Items unavailable.</p>}>
          <Show when={rows(contract().items).length > 0} fallback={<p role="status">No contract items to show.</p>}>
            <For each={rows(contract().items)}>{(item) => <section>
              <h2 class="mx-section">{display(item.name)}</h2>
              <Fields row={item} fields={[["Description", "description"]]} />
              <dl><dt>Item weight</dt><dd>{display(item.totalWeight, "fraction")}</dd><dt>Owner weight</dt><dd>{display(item.ownerWeight, "fraction")}</dd><dt>First co-owner weight</dt><dd>{display(item.co1Weight, "fraction")}</dd><dt>Second co-owner weight</dt><dd>{display(item.co2Weight, "fraction")}</dd></dl>
              <Collection name={`Sub-items: ${display(item.name)}`} source={item.subs} entries={rows(item.subs)} columns={performanceColumns} />
            </section>}</For>
          </Show>
        </Show>
      </>}
    </Show>
  )
}
