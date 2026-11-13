import { createMemo, For, Show } from "solid-js"
import { MxPage } from "../kit"
import type { NativeViewProps } from "./view-contract"

type Row = Record<string, unknown>
type Column = { label: string; value: (row: Row) => unknown; format?: (value: unknown) => string }

const OWNED_PAGES = new Set(["Headcount", "Entities & allocations", "FX rates"])
const tableCellStyle = {
  "border-bottom": "1px solid var(--mx-line)",
  padding: "9px 12px",
  "text-align": "start",
  "vertical-align": "top",
} as const

export function PlannerHeadcountView(props: NativeViewProps) {
  const authorizedPage = () =>
    props.page.surface === "planner" &&
    OWNED_PAGES.has(props.page.page) &&
    props.page.pages.includes(props.page.page)
  const data = createMemo(() => row(props.page.data))
  const versionData = createMemo(() => arrayField(data(), "versions"))
  const versions = createMemo(() => versionData() ?? [])
  const activeVersion = () => {
    if (props.query.version) return versions().find((version) => identifier(version.id) === props.query.version)
    return versions()[0]
  }
  const selectedVersionLabel = (version: Row) => {
    const name = string(version.name)
    const year = display(version.year)
    return name ? `${name} · FY${year}` : `FY${year}`
  }
  const selectVersion = (id: string) => props.onQuery({ ...props.query, version: id || undefined })

  return (
    <Show when={authorizedPage()} fallback={null}>
      <MxPage
        id="sucafina-planner-view"
        eyebrow="Planner"
        title={props.page.page}
        description={pageDescription(props.page.page)}
      >
        <Show when={props.page.page !== "Entities & allocations" && versions().length > 0}>
          <div class="mx-card" aria-label="Budget version selection">
            <label class="mx-field">
              <span>Budget version</span>
              <select
                aria-label="Budget version"
                value={props.query.version && !activeVersion() ? props.query.version : identifier(activeVersion()?.id) ?? ""}
                onChange={(event) => selectVersion(event.currentTarget.value)}
              >
                <Show when={props.query.version && !activeVersion()}>
                  <option value={props.query.version} disabled>Requested version unavailable</option>
                </Show>
                <For each={versions()}>
                  {(version) => <option value={identifier(version.id) ?? ""}>{selectedVersionLabel(version)}</option>}
                </For>
              </select>
            </label>
          </div>
        </Show>

        <Show when={props.page.page === "Headcount" && activeVersion()}>
          {(version) => <Headcount version={version()} data={data()} directory={props.page.directory} query={props.query} onQuery={props.onQuery} />}
        </Show>
        <Show when={props.page.page === "Entities & allocations"}>
          <Lists data={data()} />
        </Show>
        <Show when={props.page.page === "FX rates" && activeVersion()}>
          {(version) => <FxRates version={version()} />}
        </Show>
        <Show when={props.page.page !== "Entities & allocations" && props.query.version && !activeVersion()}>
          <div class="mx-empty" role="status">
            <strong>Selected budget version unavailable</strong>
            The requested version is not present in the authorized version list.
          </div>
        </Show>
        <Show when={props.page.page !== "Entities & allocations" && versionData() === undefined}>
          <div class="mx-empty" role="status">
            <strong>Budget version data unavailable</strong>
            No authorized version projection is present for this page.
          </div>
        </Show>
        <Show when={props.page.page !== "Entities & allocations" && versionData()?.length === 0}>
          <div class="mx-empty" role="status">
            <strong>No budget versions yet</strong>
            No budget versions are present in this authorized view.
          </div>
        </Show>
      </MxPage>
    </Show>
  )
}

function Headcount(props: {
  version: Row
  data: Row
  directory: NativeViewProps["page"]["directory"]
  query: NativeViewProps["query"]
  onQuery: NativeViewProps["onQuery"]
}) {
  const version = () => props.version
  const hc = () => row(version().hc)
  const summary = () => row(version().summary)
  const positionData = createMemo(() => arrayField(hc(), "positions"))
  const positions = createMemo(() => positionData() ?? [])
  const ratesData = createMemo(() => arrayField(hc(), "rates"))
  const rates = createMemo(() => ratesData() ?? [])
  const ratesById = createMemo(() => new Map(rates().flatMap((rate) => {
    const id = identifier(rate.id)
    return id === undefined ? [] : [[id, rate] as const]
  })))
  const domainOptions = createMemo(() =>
    [...new Set(positions().map((position) => string(position.domain)).filter(Boolean))],
  )
  const filteredPositions = createMemo(() => {
    const search = (props.query.q ?? "").trim().toLocaleLowerCase()
    const domain = props.query.filter ?? ""
    return positions().filter((position) => {
      const matchesDomain = domain === "" || string(position.domain) === domain
      const matchesSearch =
        search === "" ||
        [position.name, position.title, position.location, position.domain]
          .map(string)
          .some((value) => value.toLocaleLowerCase().includes(search))
      return matchesDomain && matchesSearch
    })
  })
  const updateQuery = (key: "q" | "filter", value: string) =>
    props.onQuery({ ...props.query, [key]: value || undefined })
  const positionsColumns = createMemo<Column[]>(() => {
    const columns: Column[] = [
      { label: "Include", value: (position) => position.include, format: yesNo },
      { label: "Name", value: (position) => position.name },
      { label: "Title", value: (position) => position.title },
      { label: "Domain", value: (position) => position.domain },
      { label: "Location", value: (position) => position.location },
      { label: "Type", value: (position) => position.type },
    ]
    if (ratesData() !== undefined) {
      columns.push({
        label: "Rate card",
        value: (position) => {
          const rateId = identifier(position.rateId)
          if (rateId === undefined) return "Automatic"
          return ratesById().get(rateId)?.name
        },
      })
    }
    columns.push(
      { label: "FTE", value: (position) => position.fte, format: numberDisplay },
      { label: "From", value: (position) => position.start },
      { label: "To", value: (position) => position.end },
    )
    if (positions().some((position) => Object.hasOwn(position, "rateOverride"))) {
      columns.push({ label: "Rate override", value: (position) => position.rateOverride, format: numberDisplay })
    }
    columns.push({ label: "Status", value: positionStatus })
    return columns
  })
  const domainRows = createMemo(() => arrayField(summary(), "hr") ?? arrayField(version(), "hr"))
  const roster = createMemo(() => arrayField(props.data, "roster"))
  const leaderDomains = () => isRow(hc().leaderDomains) ? hc().leaderDomains as Row : undefined
  const leaders = createMemo(() => [...new Set((roster() ?? []).map((person) => identifier(person.leader)).filter((id): id is string => id !== undefined))].map((id) => ({
    leader: props.directory.find((person) => identifier(person.id) === id)?.name ?? id,
    domain: leaderDomains()?.[id],
  })))

  return (
    <>
      <Show when={summary().fte !== undefined || summary().hrTotal !== undefined}>
        <dl class="mx-grid" aria-label="Headcount summary">
          <Show when={summary().fte !== undefined}>
            <Metric label="FTE in December" value={summary().fte} format={numberDisplay} />
          </Show>
          <Show when={summary().hrTotal !== undefined}>
            <Metric label="HR Staff budget USD" value={summary().hrTotal} format={usdDisplay} />
          </Show>
        </dl>
      </Show>

      <Show when={hc().exampleRates === true || hc().ratesAreExamples === true}>
        <div class="mx-card" role="status">
          <strong>Example rates</strong>
          Replace the example values with the approved HR rate data before relying on this budget.
        </div>
      </Show>

      <Show
        when={domainRows()}
        fallback={<Unavailable title="Headcount by domain unavailable" detail="The authorized view does not include the computed HR domain rows." />}
      >
        {(domainData) =>
          domainData().length > 0 ? (
            <ReadTable
              title="HR Staff budget by domain"
              label="HR Staff budget by domain"
              rows={domainData()}
              columns={[
                { label: "Domain", value: (domain) => domain.domain },
                { label: "Budget USD", value: (domain) => domain.annual, format: usdDisplay },
              ]}
            />
          ) : (
            <div class="mx-empty" role="status">
              <strong>No HR Staff budget by domain</strong>
              No computed domain rows are present in this version.
            </div>
          )
        }
      </Show>

      <Show when={props.data.headcountMappingVisible === true && roster() !== undefined && leaderDomains() !== undefined}>
        <Show when={leaders().length > 0} fallback={<div class="mx-empty" role="status"><strong>No roster leaders yet</strong></div>}>
          <ReadTable title="Roster leader to domain mapping" label="Roster leader to domain mapping" rows={leaders()} columns={[
            { label: "Roster leader", value: (leader) => leader.leader },
            { label: "Domain", value: (leader) => leader.domain },
          ]} />
        </Show>
      </Show>

      <Show when={ratesData()}>
        {(rateData) =>
          rateData().length > 0 ? (
            <ReadTable
              title="Rate cards"
              label="Headcount rate cards"
              rows={rateData()}
              columns={[
                { label: "Rate card", value: (rate) => rate.name },
                { label: "Locations it covers", value: (rate) => rate.locs },
                { label: "Currency", value: (rate) => rate.cur },
                { label: "Per FTE / year", value: (rate) => rate.annual, format: numberDisplay },
              ]}
            />
          ) : (
            <div class="mx-empty" role="status">
              <strong>No rate cards yet</strong>
              No rate-card rows are present in this version.
            </div>
          )
        }
      </Show>
      <Show when={ratesData() === undefined}>
        <Unavailable title="Rate-card details unavailable" detail="Rate-card salary fields are not present in this authorized view." />
      </Show>

      <Show
        when={positionData()}
        fallback={<Unavailable title="Position data unavailable" detail="The authorized view does not include position rows." />}
      >
        {(positionRows) =>
          positionRows().length > 0 ? (
            <>
              <div class="mx-toolbar">
                <label class="mx-field">
                  <span>Search name, title, location</span>
                  <input
                    class="mx-search"
                    type="search"
                    aria-label="Search name, title, location"
                    value={props.query.q ?? ""}
                    onInput={(event) => updateQuery("q", event.currentTarget.value)}
                  />
                </label>
                <label class="mx-field">
                  <span>Domain</span>
                  <select
                    aria-label="Filter by domain"
                    value={props.query.filter ?? ""}
                    onChange={(event) => updateQuery("filter", event.currentTarget.value)}
                  >
                    <option value="">All domains</option>
                    <For each={domainOptions()}>{(domain) => <option value={domain}>{domain}</option>}</For>
                  </select>
                </label>
              </div>
              <Show
                when={filteredPositions().length > 0}
                fallback={
                  <div class="mx-empty" role="status">
                    <strong>No positions match these filters</strong>
                    Clear the search or choose another domain to see positions.
                  </div>
                }
              >
                <ReadTable
                  title="Positions"
                  label="Headcount positions"
                  rows={filteredPositions()}
                  columns={positionsColumns()}
                />
              </Show>
            </>
          ) : (
            <div class="mx-empty" role="status">
              <strong>No positions yet</strong>
              No position rows are present in this version.
            </div>
          )
        }
      </Show>
    </>
  )
}

function Lists(props: { data: Row }) {
  const entityData = () => arrayField(props.data, "entities")
  const allocationData = () => arrayField(props.data, "allocations")
  return (
    <div class="mx-grid">
      <Show
        when={entityData()}
        fallback={<Unavailable title="Entity list unavailable" detail="The authorized view does not include entity records." />}
      >
        {(entities) =>
          entities().length > 0 ? (
            <ReadTable
              title="Entities"
              label="Entities"
              rows={entities()}
              columns={[
                { label: "Name", value: (entity) => entity.name },
                { label: "Code", value: (entity) => entity.code },
              ]}
            />
          ) : (
            <div class="mx-empty" role="status">
              <strong>No entities yet</strong>
              No entity records are present in this authorized view.
            </div>
          )
        }
      </Show>
      <Show
        when={allocationData()}
        fallback={<Unavailable title="Allocation list unavailable" detail="The authorized view does not include allocation records." />}
      >
        {(allocations) =>
          allocations().length > 0 ? (
            <ReadTable
              title="Allocations"
              label="Allocations"
              rows={allocations()}
              columns={[
                { label: "Name", value: (allocation) => allocation.name },
                { label: "Description", value: (allocation) => allocation.desc },
              ]}
            />
          ) : (
            <div class="mx-empty" role="status">
              <strong>No allocations yet</strong>
              No allocation records are present in this authorized view.
            </div>
          )
        }
      </Show>
    </div>
  )
}

function FxRates(props: { version: Row }) {
  const fxData = () => arrayField(props.version, "fx")
  const warnings = createMemo(() => {
    const summary = row(props.version.summary)
    return stringArray(summary.warnings)
  })

  return (
    <>
      <Show when={warnings().length > 0}>
        <div class="mx-card" role="status" aria-label="FX conversion warnings">
          <strong>FX conversion warnings</strong>
          <ul>
            <For each={warnings()}>{(warning) => <li>{warning}</li>}</For>
          </ul>
        </div>
      </Show>
      <Show
        when={fxData() !== undefined}
        fallback={<Unavailable title="FX rate data unavailable" detail="The authorized view does not include version FX rows." />}
      >
        <Show when={(fxData()?.length ?? 0) > 0} fallback={<div class="mx-empty" role="status"><strong>No FX rates yet</strong></div>}>
          <ReadTable
            title="FX rates"
            label="FX rates"
            rows={fxData() ?? []}
            columns={[
              { label: "Currency", value: (rate) => rate.cur },
              { label: "USD per 1 unit", value: (rate) => rate.rate, format: numberDisplay },
              { label: "Rate status", value: (rate) => (rate.rate == null ? "No rate" : "Available") },
            ]}
          />
        </Show>
      </Show>
    </>
  )
}

function ReadTable(props: { title: string; label: string; rows: Row[]; columns: Column[] }) {
  return (
    <section class="mx-card" aria-label={props.title}>
      <h2>{props.title}</h2>
      <div class="mx-table" role="region" aria-label={`${props.label} table`} style={{ "overflow-x": "auto" }}>
        <table aria-label={props.label} style={{ "border-collapse": "collapse", "min-width": "100%", width: "max-content" }}>
          <thead>
            <tr>
              <For each={props.columns}>
                {(column) => <th scope="col" style={tableCellStyle}>{column.label}</th>}
              </For>
            </tr>
          </thead>
          <tbody>
            <For each={props.rows}>
              {(item) => (
                <tr>
                  <For each={props.columns}>
                    {(column) => {
                      const value = column.value(item)
                      return <td style={tableCellStyle}>{column.format ? column.format(value) : display(value)}</td>
                    }}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Metric(props: { label: string; value: unknown; format: (value: unknown) => string }) {
  return (
    <div class="mx-card">
      <dt class="mx-meta">{props.label}</dt>
      <dd><strong>{props.format(props.value)}</strong></dd>
    </div>
  )
}

function Unavailable(props: { title: string; detail: string }) {
  return (
    <div class="mx-empty" role="status">
      <strong>{props.title}</strong>
      {props.detail}
    </div>
  )
}

function pageDescription(page: string) {
  if (page === "Headcount") return "Review authorized positions, rate cards, and projected HR Staff data for the selected budget version."
  if (page === "Entities & allocations") return "Review the entity codes and allocation descriptions available to budget lines."
  return "Review the selected version’s currency codes, USD rates, and server-provided conversion warnings."
}

function row(value: unknown): Row {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Row : {}
}

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter(isRow) : []
}

function arrayField(source: Row, key: string): Row[] | undefined {
  const value = source[key]
  return Array.isArray(value) && value.every(isRow) ? rows(value) : undefined
}

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function string(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function identifier(value: unknown): string | undefined {
  if (typeof value === "string" && value !== "") return value
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return undefined
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "string") return value
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "—"
  return "—"
}

function numberDisplay(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—"
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN
  return Number.isFinite(number)
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(number)
    : "—"
}

function usdDisplay(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—"
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN
  return Number.isFinite(number)
    ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(number)
    : "—"
}

function yesNo(value: unknown): string {
  return typeof value === "boolean" ? (value ? "Included" : "Excluded") : display(value)
}

function positionStatus(position: Row): string {
  if (position.include !== true) return "Excluded"
  if (position.left === true) return "Not in roster"
  if (position.hasRate === false) return "No rate"
  if (position.src === "new") return "New hire"
  return "In roster"
}
