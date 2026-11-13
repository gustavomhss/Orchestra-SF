import { For, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import type { NativeViewProps } from "./view-contract"

type Row = Record<string, unknown>

const pages = ["Overview", "OPEX", "CAPEX", "Versions"]
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
  const language = useLanguage()
  const months = () => [
    language.t("sucafina.native.planner-lines.month.jan"),
    language.t("sucafina.native.planner-lines.month.feb"),
    language.t("sucafina.native.planner-lines.month.mar"),
    language.t("sucafina.native.planner-lines.month.apr"),
    language.t("sucafina.native.planner-lines.month.may"),
    language.t("sucafina.native.planner-lines.month.jun"),
    language.t("sucafina.native.planner-lines.month.jul"),
    language.t("sucafina.native.planner-lines.month.aug"),
    language.t("sucafina.native.planner-lines.month.sep"),
    language.t("sucafina.native.planner-lines.month.oct"),
    language.t("sucafina.native.planner-lines.month.nov"),
    language.t("sucafina.native.planner-lines.month.dec"),
  ]
  const elements = () => ({
    licenses: language.t("sucafina.native.planner-lines.element.licenses"),
    services: language.t("sucafina.native.planner-lines.element.services"),
    hwo: language.t("sucafina.native.planner-lines.element.hardware"),
    depr: language.t("sucafina.native.planner-lines.element.depreciation"),
    hr: language.t("sucafina.native.planner-lines.element.hrStaff"),
    fac: language.t("sucafina.native.planner-lines.element.facilities"),
    te: language.t("sucafina.native.planner-lines.element.travelExpenses"),
    oth: language.t("sucafina.native.planner-lines.element.others"),
  })
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
      <section aria-label={language.t("sucafina.native.planner-lines.section", { page: props.page.page })}>
        <h2><bdi>{props.page.page}</bdi></h2>
        <Show when={Array.isArray(data().versions)} fallback={<div class="mx-empty">{language.t("sucafina.native.planner-lines.planUnavailable")}</div>}>
          <Show when={props.page.page === "Versions"}>
            <div class="mx-card">
              <h3>{language.t("sucafina.native.planner-lines.budgetVersions")}</h3>
              <Show when={versions().length > 0} fallback={<p>{language.t("sucafina.native.planner-lines.noVersions")}</p>}>
                <div class="mx-table" style={{ overflow: "auto" }}>
                  <table aria-label={language.t("sucafina.native.planner-lines.table.budgetVersions")}>
                    <thead><tr>
                      <th>{language.t("sucafina.native.planner-lines.column.version")}</th>
                      <th>{language.t("sucafina.native.planner-lines.column.year")}</th>
                      <th>{language.t("sucafina.native.planner-lines.column.status")}</th>
                      <th>{language.t("sucafina.native.planner-lines.column.copiedFrom")}</th>
                      <th>{language.t("sucafina.native.planner-lines.column.created")}</th>
                      <th>{language.t("sucafina.native.planner-lines.column.totalBudgetUsd")}</th>
                      <th>{language.t("sucafina.native.planner-lines.column.fteDecember")}</th>
                    </tr></thead>
                    <tbody><For each={versions()}>{(item) => (
                      <tr>
                        <td><bdi>{display(item.name)}</bdi><Show when={text(item.note)}><div><bdi>{text(item.note)}</bdi></div></Show></td>
                        <td><bdi>{text(item.year) || "—"}</bdi></td>
                        <td>{text(object(data().officials)[text(item.year)]) === text(item.id) && text(item.id)
                          ? language.t("sucafina.native.planner-lines.status.official")
                          : item.locked === true
                            ? language.t("sucafina.native.planner-lines.status.locked")
                            : item.locked === false
                              ? language.t("sucafina.native.planner-lines.status.draft")
                              : "—"}</td>
                        <td><bdi>{lookup(item.basedOn, versions())}</bdi></td>
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
            <Show when={selected()} fallback={<div class="mx-empty">{language.t("sucafina.native.planner-lines.noVersion")}</div>}>
              {(version) => (
                <>
                  <div class="mx-card">
                    <div class="mx-fields">
                      <label class="mx-field"><span>{language.t("sucafina.native.planner-lines.field.plan")}</span><select value={text(version().id)} onChange={(event) => change("version", event.currentTarget.value)}>
                        <For each={versions()}>{(item) => <option value={text(item.id)}>{display(item.name)}</option>}</For>
                      </select></label>
                      <Show when={props.page.page === "Overview" && versions().length > 1}>
                        <label class="mx-field"><span>{language.t("sucafina.native.planner-lines.field.compareBudget")}</span><select value={props.query.filter || ""} onChange={(event) => change("filter", event.currentTarget.value)}>
                          <option value="">{language.t("sucafina.native.planner-lines.option.allBudgets")}</option><For each={versions().filter((item) => item.id !== version().id)}>{(item) => <option value={text(item.id)}>{display(item.name)}</option>}</For>
                        </select></label>
                      </Show>
                    </div>
                    <p>{language.t("sucafina.native.planner-lines.fiscalYear", {
                      year: text(version().year) || "—",
                      month: display(version().closed),
                    })}</p>
                    <Show when={Array.isArray(summary().warnings) && (summary().warnings as unknown[]).length > 0}>
                      <p role="status">{language.t("sucafina.native.planner-lines.missingFx", {
                        rates: (summary().warnings as unknown[]).map(text).filter(Boolean).join(", "),
                      })}</p>
                    </Show>
                  </div>
                  <Show when={props.page.page === "Overview"}>
                    <div class="mx-card">
                      <h3>{language.t("sucafina.native.planner-lines.planOverview")}</h3>
                      <Show when={version().summary && typeof version().summary === "object"} fallback={<p>{language.t("sucafina.native.planner-lines.planTotalsUnavailable")}</p>}>
                        <dl>
                          <dt>{language.t("sucafina.native.planner-lines.totalBudget")}</dt><dd>{display(summary().total)}</dd>
                          <dt>{language.t("sucafina.native.planner-lines.actualYtd")}</dt><dd>{display(summary().actualYTD)}</dd>
                          <dt>{language.t("sucafina.native.planner-lines.fullYearOutlook")}</dt><dd>{display(summary().fullYear)}</dd>
                          <dt>{language.t("sucafina.native.planner-lines.hrStaff")}</dt><dd>{display(summary().hrTotal)}</dd>
                          <dt>{language.t("sucafina.native.planner-lines.fteDecember")}</dt><dd>{display(summary().fte)}</dd>
                        </dl>
                      </Show>
                    </div>
                    <div class="mx-card">
                      <h3>{language.t("sucafina.native.planner-lines.monthlyView")}</h3>
                      <Show when={Array.isArray(summary().budget) && Array.isArray(summary().actual) && Array.isArray(summary().outlook)} fallback={<p>{language.t("sucafina.native.planner-lines.monthlyTotalsUnavailable")}</p>}>
                        <div class="mx-table" style={{ overflow: "auto" }}><table aria-label={language.t("sucafina.native.planner-lines.table.monthlyTotals")}>
                          <thead><tr>
                            <th>{language.t("sucafina.native.planner-lines.column.month")}</th>
                            <th>{language.t("sucafina.native.planner-lines.column.budgetUsd")}</th>
                            <th>{language.t("sucafina.native.planner-lines.column.actualUsd")}</th>
                            <th>{language.t("sucafina.native.planner-lines.column.outlookUsd")}</th>
                          </tr></thead>
                          <tbody><For each={months()}>{(month, index) => <tr><th scope="row">{month}</th><td>{display((summary().budget as unknown[])[index()])}</td><td>{display((summary().actual as unknown[])[index()])}</td><td>{display((summary().outlook as unknown[])[index()])}</td></tr>}</For></tbody>
                        </table></div>
                      </Show>
                    </div>
                    <div class="mx-card"><h3>{language.t("sucafina.native.planner-lines.byCostElement")}</h3><p>{language.t("sucafina.native.planner-lines.costElementTotalsUnavailable")}</p></div>
                    <div class="mx-card">
                      <h3>{language.t("sucafina.native.planner-lines.compareVersions")}</h3>
                      <Show when={versions().length > 1} fallback={<p>{language.t("sucafina.native.planner-lines.onlyOneVersion")}</p>}>
                        <div class="mx-table" style={{ overflow: "auto" }}><table aria-label={language.t("sucafina.native.planner-lines.table.versionComparison")}>
                          <thead><tr>
                            <th>{language.t("sucafina.native.planner-lines.column.version")}</th>
                            <th>{language.t("sucafina.native.planner-lines.column.budgetUsd")}</th>
                            <th>{language.t("sucafina.native.planner-lines.column.fteDecember")}</th>
                          </tr></thead>
                          <tbody><For each={versions().filter((item) => !props.query.filter || text(item.id) === text(version().id) || text(item.id) === props.query.filter)}>{(item) => <tr><td>{display(item.name)}</td><td>{display(object(item.summary).total)}</td><td>{display(object(item.summary).fte)}</td></tr>}</For></tbody>
                        </table></div>
                      </Show>
                    </div>
                  </Show>
                  <Show when={props.page.page === "OPEX" || props.page.page === "CAPEX"}>
                    <div class="mx-card">
                      <div class="mx-fields">
                        <label class="mx-field"><span>{language.t("sucafina.native.planner-lines.field.grid")}</span><select value={mode()} onChange={(event) => change("mode", event.currentTarget.value)}>
                          <option value="budget">{language.t("sucafina.native.planner-lines.mode.budget")}</option>
                          <option value="actual">{language.t("sucafina.native.planner-lines.mode.actual")}</option>
                          <option value="forecast">{language.t("sucafina.native.planner-lines.mode.forecast")}</option>
                          <option value="compare">{language.t("sucafina.native.planner-lines.mode.compare")}</option>
                        </select></label>
                        <Show when={props.page.page === "CAPEX"}>
                          <label class="mx-field"><span>{language.t("sucafina.native.planner-lines.field.owner")}</span><select value={props.query.owner || ""} onChange={(event) => change("owner", event.currentTarget.value)}><option value="">{language.t("sucafina.native.planner-lines.option.allOwners")}</option><For each={directory()}>{(person) => <option value={person.id}>{person.name}</option>}</For></select></label>
                          <label class="mx-field"><span>{language.t("sucafina.native.planner-lines.field.classification")}</span><select value={props.query.class || ""} onChange={(event) => change("class", event.currentTarget.value)}>
                            <option value="">{language.t("sucafina.native.planner-lines.option.allClassifications")}</option>
                            <option value="capex">{language.t("sucafina.native.planner-lines.option.capex")}</option>
                            <option value="opex">{language.t("sucafina.native.planner-lines.option.opex")}</option>
                          </select></label>
                          <label class="mx-field"><span>{language.t("sucafina.native.planner-lines.field.search")}</span><input value={props.query.q || ""} onInput={(event) => change("q", event.currentTarget.value)} /></label>
                        </Show>
                      </div>
                    </div>
                    <Show when={props.page.page === "CAPEX"}>
                      <div class="mx-card"><h3>{language.t("sucafina.native.planner-lines.projects")}</h3>
                        <Show when={Array.isArray(version().projects)} fallback={<p>{language.t("sucafina.native.planner-lines.projectsUnavailable")}</p>}>
                          <Show when={projects().length} fallback={<p>{language.t("sucafina.native.planner-lines.noProjects")}</p>}>
                            <div class="mx-table" style={{ overflow: "auto" }}><table aria-label={language.t("sucafina.native.planner-lines.table.projects")}><thead><tr>
                              <th>{language.t("sucafina.native.planner-lines.column.project")}</th>
                              <th>{language.t("sucafina.native.planner-lines.column.code")}</th>
                              <th>{language.t("sucafina.native.planner-lines.column.owner")}</th>
                              <th>{language.t("sucafina.native.planner-lines.column.description")}</th>
                            </tr></thead><tbody><For each={projects()}>{(project) => <tr><td><bdi>{display(project.name)}</bdi></td><td><bdi>{display(project.code)}</bdi></td><td><bdi>{reference(project.owner, directory())}</bdi></td><td><bdi>{display(project.desc)}</bdi></td></tr>}</For></tbody></table></div>
                          </Show>
                        </Show>
                      </div>
                    </Show>
                    <div class="mx-card"><h3>{language.t("sucafina.native.planner-lines.table.lines", { page: props.page.page })}</h3>
                      <Show when={mode() === "compare"}><p>{language.t("sucafina.native.planner-lines.comparisonTotalsUnavailable")}</p></Show>
                      <Show when={Array.isArray(version().lines) && (section() !== "opex" || Array.isArray(version().hr))} fallback={<p>{language.t("sucafina.native.planner-lines.linesUnavailable")}</p>}>
                        <Show when={lineRows().length} fallback={<p>{language.t("sucafina.native.planner-lines.noMatchingLines")}</p>}>
                          <div class="mx-table" style={{ overflow: "auto" }}><table aria-label={language.t("sucafina.native.planner-lines.table.lines", { page: props.page.page })}>
                            <thead><tr>
                              <th>{language.t("sucafina.native.planner-lines.column.element")}</th>
                              <th>{language.t("sucafina.native.planner-lines.column.line")}</th>
                              <th>{language.t("sucafina.native.planner-lines.column.description")}</th>
                              <th>{language.t("sucafina.native.planner-lines.column.owner")}</th>
                              <th>{language.t("sucafina.native.planner-lines.column.entity")}</th>
                              <th>{language.t("sucafina.native.planner-lines.column.allocation")}</th>
                              <Show when={section() === "capex"}>
                                <th>{language.t("sucafina.native.planner-lines.column.project")}</th>
                                <th>{language.t("sucafina.native.planner-lines.column.classification")}</th>
                              </Show>
                              <th>{language.t("sucafina.native.planner-lines.column.currency")}</th>
                              <th>{language.t("sucafina.native.planner-lines.column.annualBudget")}</th>
                              <Show when={mode() !== "compare"}><For each={months()}>{(month) => <th>{month}</th>}</For></Show>
                            </tr></thead>
                            <tbody><For each={lineRows()}>{(line) => <tr>
                              <td><bdi>{elements()[text(line.el) as keyof ReturnType<typeof elements>] || display(line.el)}</bdi></td><td><bdi>{display(line.name)}</bdi></td><td><bdi>{display(line.desc)}</bdi></td><td><bdi>{reference(line.owner, directory())}</bdi></td><td><bdi>{lookup(line.entity, rows(data().entities))}</bdi></td><td><bdi>{lookup(line.alloc, rows(data().allocations))}</bdi></td>
                              <Show when={section() === "capex"}><td><bdi>{lookup(line.proj, projects())}</bdi></td><td><bdi>{display(line.cls)}</bdi></td></Show>
                              <td>{display(line.cur)}</td><td>{display(line.annual)}</td>
                              <Show when={mode() !== "compare"}><For each={months()}>{(_, index) => <td>{display(Array.isArray(line[mode() === "budget" ? "b" : mode() === "actual" ? "a" : "f"]) ? (line[mode() === "budget" ? "b" : mode() === "actual" ? "a" : "f"] as unknown[])[index()] : undefined)}</td>}</For></Show>
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
