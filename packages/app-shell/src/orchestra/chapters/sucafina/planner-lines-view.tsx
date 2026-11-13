import { For, Show } from "solid-js"
import type { NativeViewProps } from "./view-contract"

type Row = Record<string, unknown>

const pages = ["Overview", "OPEX", "CAPEX", "Versions"]
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const elements: Record<string, string> = {
  licenses: "Licenses", services: "Services", hwo: "Hardware", depr: "Depreciation",
  hr: "HR Staff", fac: "Facilities", te: "Travel & Expenses", oth: "Others",
}

function object(value: unknown): Row {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Row : {}
}
function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((item): item is Row => item !== null && typeof item === "object" && !Array.isArray(item)) : []
}
function text(value: unknown): string {
  if (typeof value === "string") return value
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
}
function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "number" && Number.isFinite(value)) return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
  return text(value) || "—"
}
function reference(value: unknown, choices: readonly { id: string; name: string }[]): string {
  const person = object(value)
  const id = text(person.id) || text(value)
  return text(person.name) || choices.find((item) => item.id === id)?.name || (id ? id : "—")
}
function lookup(value: unknown, choices: Row[]): string {
  const id = text(value)
  return text(choices.find((item) => text(item.id) === id)?.name) || (id ? id : "—")
}

export function PlannerLinesView(props: NativeViewProps) {
  const valid = () => props.page.surface === "planner" && pages.includes(props.page.page) && props.page.pages.includes(props.page.page)
  const data = () => object(props.page.data)
  const versions = () => rows(data().versions)
  const selected = () => props.query.version
    ? versions().find((item) => text(item.id) === props.query.version)
    : versions().find((item) => item.year === props.page.year) || versions()[0]
  const summary = () => object(selected()?.summary)
  const directory = () => props.page.directory
  const projects = () => rows(selected()?.projects)
  const section = () => props.page.page === "OPEX" ? "opex" : "capex"
  const mode = () => ["budget", "actual", "forecast", "compare"].includes(props.query.mode || "") ? props.query.mode || "budget" : "budget"
  const lineRows = () => {
    const version = selected()
    if (!version) return []
    const all = rows(version.lines).filter((line) => line.sec === section())
    const hr = section() === "opex" ? rows(version.hr) : []
    return [...all, ...hr].filter((line) => {
      const project = projects().find((item) => text(item.id) === text(line.proj))
      const owner = text(object(line.owner).id) || text(line.owner) || text(object(project?.owner).id) || text(project?.owner)
      const search = `${text(line.name)} ${text(line.desc)}`.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
      const query = (props.query.q || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()
      return (!props.query.owner || owner === props.query.owner)
        && (!props.query.class || text(line.cls) === props.query.class)
        && (!query || search.includes(query))
    })
  }
  const change = (key: "version" | "filter" | "owner" | "class" | "q" | "mode", value: string) =>
    props.onQuery({ ...props.query, [key]: value })

  return (
    <Show when={valid()}>
      <section aria-label={`Planner ${props.page.page}`}>
        <h2>{props.page.page}</h2>
        <Show when={Array.isArray(data().versions)} fallback={<div class="mx-empty">Plan information is unavailable.</div>}>
          <Show when={props.page.page === "Versions"}>
            <div class="mx-card">
              <h3>Budget versions</h3>
              <Show when={versions().length > 0} fallback={<p>No versions yet.</p>}>
                <div class="mx-table" style={{ overflow: "auto" }}>
                  <table aria-label="Budget versions">
                    <thead><tr><th>Version</th><th>Year</th><th>Status</th><th>Copied from</th><th>Created</th><th>Total budget USD</th><th>FTE December</th></tr></thead>
                    <tbody><For each={versions()}>{(item) => (
                      <tr>
                        <td><bdi>{display(item.name)}</bdi><Show when={text(item.note)}><div>{text(item.note)}</div></Show></td>
                        <td>{text(item.year) || "—"}</td>
                        <td>{text(object(data().officials)[text(item.year)]) === text(item.id) && text(item.id) ? "Official" : item.locked === true ? "Locked" : item.locked === false ? "Draft" : "—"}</td>
                        <td>{lookup(item.basedOn, versions())}</td>
                        <td>{display(item.created)}</td>
                        <td>{display(object(item.summary).total)}</td>
                        <td>{display(object(item.summary).fte)}</td>
                      </tr>
                    )}</For></tbody>
                  </table>
                </div>
              </Show>
            </div>
          </Show>
          <Show when={props.page.page !== "Versions"}>
            <Show when={selected()} fallback={<div class="mx-empty">No version. A plan can be created in Versions.</div>}>
              {(version) => (
                <>
                  <div class="mx-card">
                    <div class="mx-fields">
                      <label class="mx-field"><span>Plan</span><select value={text(version().id)} onChange={(event) => change("version", event.currentTarget.value)}>
                        <For each={versions()}>{(item) => <option value={text(item.id)}>{display(item.name)}</option>}</For>
                      </select></label>
                      <Show when={props.page.page === "Overview" && versions().length > 1}>
                        <label class="mx-field"><span>Compare budget</span><select value={props.query.filter || ""} onChange={(event) => change("filter", event.currentTarget.value)}>
                          <option value="">All budgets</option><For each={versions().filter((item) => item.id !== version().id)}>{(item) => <option value={text(item.id)}>{display(item.name)}</option>}</For>
                        </select></label>
                      </Show>
                    </div>
                    <p>Fiscal year {text(version().year) || "—"} · Actuals closed through {display(version().closed)}</p>
                    <Show when={Array.isArray(summary().warnings) && (summary().warnings as unknown[]).length > 0}>
                      <p role="status">Missing FX rate: {(summary().warnings as unknown[]).map(text).filter(Boolean).join(", ")}</p>
                    </Show>
                  </div>
                  <Show when={props.page.page === "Overview"}>
                    <div class="mx-card">
                      <h3>Plan overview</h3>
                      <Show when={version().summary && typeof version().summary === "object"} fallback={<p>Plan totals are unavailable.</p>}>
                        <dl>
                          <dt>Total budget OPEX + CAPEX USD</dt><dd>{display(summary().total)}</dd>
                          <dt>Actual YTD</dt><dd>{display(summary().actualYTD)}</dd>
                          <dt>Full-year outlook</dt><dd>{display(summary().fullYear)}</dd>
                          <dt>HR Staff</dt><dd>{display(summary().hrTotal)}</dd>
                          <dt>FTE December</dt><dd>{display(summary().fte)}</dd>
                        </dl>
                      </Show>
                    </div>
                    <div class="mx-card">
                      <h3>Monthly view</h3>
                      <Show when={Array.isArray(summary().budget) && Array.isArray(summary().actual) && Array.isArray(summary().outlook)} fallback={<p>Monthly totals are unavailable.</p>}>
                        <div class="mx-table" style={{ overflow: "auto" }}><table aria-label="Monthly budget actual and outlook">
                          <thead><tr><th>Month</th><th>Budget USD</th><th>Actual USD</th><th>Outlook USD</th></tr></thead>
                          <tbody><For each={months}>{(month, index) => <tr><th scope="row">{month}</th><td>{display((summary().budget as unknown[])[index()])}</td><td>{display((summary().actual as unknown[])[index()])}</td><td>{display((summary().outlook as unknown[])[index()])}</td></tr>}</For></tbody>
                        </table></div>
                      </Show>
                    </div>
                    <div class="mx-card"><h3>By cost element</h3><p>Cost element totals are unavailable.</p></div>
                    <div class="mx-card">
                      <h3>Compare versions</h3>
                      <Show when={versions().length > 1} fallback={<p>Only one version so far.</p>}>
                        <div class="mx-table" style={{ overflow: "auto" }}><table aria-label="Version comparison">
                          <thead><tr><th>Version</th><th>Budget USD</th><th>FTE December</th></tr></thead>
                          <tbody><For each={versions().filter((item) => !props.query.filter || text(item.id) === text(version().id) || text(item.id) === props.query.filter)}>{(item) => <tr><td>{display(item.name)}</td><td>{display(object(item.summary).total)}</td><td>{display(object(item.summary).fte)}</td></tr>}</For></tbody>
                        </table></div>
                      </Show>
                    </div>
                  </Show>
                  <Show when={props.page.page === "OPEX" || props.page.page === "CAPEX"}>
                    <div class="mx-card">
                      <div class="mx-fields">
                        <label class="mx-field"><span>Grid</span><select value={mode()} onChange={(event) => change("mode", event.currentTarget.value)}><option value="budget">Budget</option><option value="actual">Actual</option><option value="forecast">Forecast</option><option value="compare">Compare</option></select></label>
                        <Show when={props.page.page === "CAPEX"}>
                          <label class="mx-field"><span>Owner</span><select value={props.query.owner || ""} onChange={(event) => change("owner", event.currentTarget.value)}><option value="">All</option><For each={directory()}>{(person) => <option value={person.id}>{person.name}</option>}</For></select></label>
                          <label class="mx-field"><span>Classification</span><select value={props.query.class || ""} onChange={(event) => change("class", event.currentTarget.value)}><option value="">All</option><option value="capex">CAPEX</option><option value="opex">OPEX</option></select></label>
                          <label class="mx-field"><span>Search</span><input value={props.query.q || ""} onInput={(event) => change("q", event.currentTarget.value)} /></label>
                        </Show>
                      </div>
                    </div>
                    <Show when={props.page.page === "CAPEX"}>
                      <div class="mx-card"><h3>Projects</h3>
                        <Show when={Array.isArray(version().projects)} fallback={<p>Projects are unavailable.</p>}>
                          <Show when={projects().length} fallback={<p>No projects yet.</p>}>
                            <div class="mx-table" style={{ overflow: "auto" }}><table aria-label="Projects"><thead><tr><th>Project</th><th>Code</th><th>Owner</th><th>Description</th></tr></thead><tbody><For each={projects()}>{(project) => <tr><td>{display(project.name)}</td><td>{display(project.code)}</td><td>{reference(project.owner, directory())}</td><td>{display(project.desc)}</td></tr>}</For></tbody></table></div>
                          </Show>
                        </Show>
                      </div>
                    </Show>
                    <div class="mx-card"><h3>{props.page.page} lines</h3>
                      <Show when={mode() === "compare"}><p>Comparison totals are unavailable.</p></Show>
                      <Show when={Array.isArray(version().lines) && (section() !== "opex" || Array.isArray(version().hr))} fallback={<p>Line information is unavailable.</p>}>
                        <Show when={lineRows().length} fallback={<p>No lines match this view.</p>}>
                          <div class="mx-table" style={{ overflow: "auto" }}><table aria-label={`${props.page.page} lines`}>
                            <thead><tr><th>Element</th><th>Line</th><th>Description</th><th>Owner</th><th>Entity</th><th>Allocation</th><Show when={section() === "capex"}><th>Project</th><th>Classification</th></Show><th>Currency</th><th>Annual budget</th><Show when={mode() !== "compare"}><For each={months}>{(month) => <th>{month}</th>}</For></Show></tr></thead>
                            <tbody><For each={lineRows()}>{(line) => <tr>
                              <td>{elements[text(line.el)] || display(line.el)}</td><td>{display(line.name)}</td><td>{display(line.desc)}</td><td>{reference(line.owner, directory())}</td><td>{lookup(line.entity, rows(data().entities))}</td><td>{lookup(line.alloc, rows(data().allocations))}</td>
                              <Show when={section() === "capex"}><td>{lookup(line.proj, projects())}</td><td>{display(line.cls)}</td></Show>
                              <td>{display(line.cur)}</td><td>{display(line.annual)}</td>
                              <Show when={mode() !== "compare"}><For each={months}>{(_, index) => <td>{display(Array.isArray(line[mode() === "budget" ? "b" : mode() === "actual" ? "a" : "f"]) ? (line[mode() === "budget" ? "b" : mode() === "actual" ? "a" : "f"] as unknown[])[index()] : undefined)}</td>}</For></Show>
                            </tr>}</For></tbody>
                          </table></div>
                        </Show>
                      </Show>
                    </div>
                  </Show>
                </>
              )}
            </Show>
          </Show>
        </Show>
      </section>
    </Show>
  )
}
