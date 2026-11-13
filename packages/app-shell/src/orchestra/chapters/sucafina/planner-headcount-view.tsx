import { createMemo, For, Show } from "solid-js"
import { useLanguage } from "@/context/language"
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
  const language = useLanguage()
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
    const year = display(version.year, language)
    return name ? `${name} · FY${year}` : `FY${year}`
  }
  const selectVersion = (id: string) => props.onQuery({ ...props.query, version: id || undefined })

  return (
    <Show when={authorizedPage()} fallback={null}>
      <MxPage
        id="sucafina-planner-view"
        eyebrow={language.t("sucafina.native.planner-headcount.page.planner")}
        title={pageTitle(props.page.page, language)}
        description={pageDescription(props.page.page, language)}
      >
        <Show when={props.page.page !== "Entities & allocations" && versions().length > 0}>
          <div class="mx-card" aria-label={language.t("sucafina.native.planner-headcount.version.selection")}>
            <label class="mx-field">
              <span>{language.t("sucafina.native.planner-headcount.version.label")}</span>
              <select
                aria-label={language.t("sucafina.native.planner-headcount.version.label")}
                value={props.query.version && !activeVersion() ? props.query.version : identifier(activeVersion()?.id) ?? ""}
                onChange={(event) => selectVersion(event.currentTarget.value)}
              >
                <Show when={props.query.version && !activeVersion()}>
                  <option value={props.query.version} disabled>{language.t("sucafina.native.planner-headcount.version.requestedUnavailable")}</option>
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
            <strong>{language.t("sucafina.native.planner-headcount.version.selectedUnavailable")}</strong>
            {language.t("sucafina.native.planner-headcount.version.selectedUnavailableDetail")}
          </div>
        </Show>
        <Show when={props.page.page !== "Entities & allocations" && versionData() === undefined}>
          <div class="mx-empty" role="status">
            <strong>{language.t("sucafina.native.planner-headcount.version.dataUnavailable")}</strong>
            {language.t("sucafina.native.planner-headcount.version.dataUnavailableDetail")}
          </div>
        </Show>
        <Show when={props.page.page !== "Entities & allocations" && versionData()?.length === 0}>
          <div class="mx-empty" role="status">
            <strong>{language.t("sucafina.native.planner-headcount.version.none")}</strong>
            {language.t("sucafina.native.planner-headcount.version.noneDetail")}
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
  const language = useLanguage()
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
      { label: language.t("sucafina.native.planner-headcount.position.include"), value: (position) => position.include, format: (value) => yesNo(value, language) },
      { label: language.t("sucafina.native.planner-headcount.position.name"), value: (position) => position.name },
      { label: language.t("sucafina.native.planner-headcount.position.title"), value: (position) => position.title },
      { label: language.t("sucafina.native.planner-headcount.domains.domain"), value: (position) => position.domain },
      { label: language.t("sucafina.native.planner-headcount.position.location"), value: (position) => position.location },
      { label: language.t("sucafina.native.planner-headcount.position.type"), value: (position) => position.type },
    ]
    if (ratesData() !== undefined) {
      columns.push({
        label: language.t("sucafina.native.planner-headcount.rates.name"),
        value: (position) => {
          const rateId = identifier(position.rateId)
          if (rateId === undefined) return language.t("sucafina.native.planner-headcount.position.automatic")
          return ratesById().get(rateId)?.name
        },
      })
    }
    columns.push(
      { label: language.t("sucafina.native.planner-headcount.position.fte"), value: (position) => position.fte, format: numberDisplay },
      { label: language.t("sucafina.native.planner-headcount.position.start"), value: (position) => position.start },
      { label: language.t("sucafina.native.planner-headcount.position.end"), value: (position) => position.end },
    )
    if (positions().some((position) => Object.hasOwn(position, "rateOverride"))) {
      columns.push({ label: language.t("sucafina.native.planner-headcount.position.rateOverride"), value: (position) => position.rateOverride, format: numberDisplay })
    }
    columns.push({ label: language.t("sucafina.native.planner-headcount.position.status"), value: (position) => positionStatus(position, language) })
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
        <dl class="mx-grid" aria-label={language.t("sucafina.native.planner-headcount.summary.label")}>
          <Show when={summary().fte !== undefined}>
            <Metric label={language.t("sucafina.native.planner-headcount.summary.fteDecember")} value={summary().fte} format={numberDisplay} />
          </Show>
          <Show when={summary().hrTotal !== undefined}>
            <Metric label={language.t("sucafina.native.planner-headcount.summary.hrBudgetUsd")} value={summary().hrTotal} format={usdDisplay} />
          </Show>
        </dl>
      </Show>

      <Show when={hc().exampleRates === true || hc().ratesAreExamples === true}>
        <div class="mx-card" role="status">
          <strong>{language.t("sucafina.native.planner-headcount.exampleRates.title")}</strong>
          {language.t("sucafina.native.planner-headcount.exampleRates.detail")}
        </div>
      </Show>

      <Show
        when={domainRows()}
        fallback={<Unavailable title={language.t("sucafina.native.planner-headcount.domains.unavailable")} detail={language.t("sucafina.native.planner-headcount.domains.unavailableDetail")} />}
      >
        {(domainData) =>
          domainData().length > 0 ? (
            <ReadTable
              title={language.t("sucafina.native.planner-headcount.domains.title")}
              label={language.t("sucafina.native.planner-headcount.domains.title")}
              rows={domainData()}
              columns={[
                { label: language.t("sucafina.native.planner-headcount.domains.domain"), value: (domain) => domain.domain },
                { label: language.t("sucafina.native.planner-headcount.domains.budgetUsd"), value: (domain) => domain.annual, format: usdDisplay },
              ]}
            />
          ) : (
            <div class="mx-empty" role="status">
              <strong>{language.t("sucafina.native.planner-headcount.domains.none")}</strong>
              {language.t("sucafina.native.planner-headcount.domains.noneDetail")}
            </div>
          )
        }
      </Show>

      <Show when={props.data.headcountMappingVisible === true && roster() !== undefined && leaderDomains() !== undefined}>
        <Show when={leaders().length > 0} fallback={<div class="mx-empty" role="status"><strong>{language.t("sucafina.native.planner-headcount.roster.none")}</strong></div>}>
          <ReadTable title={language.t("sucafina.native.planner-headcount.roster.title")} label={language.t("sucafina.native.planner-headcount.roster.title")} rows={leaders()} columns={[
            { label: language.t("sucafina.native.planner-headcount.roster.leader"), value: (leader) => leader.leader },
            { label: language.t("sucafina.native.planner-headcount.domains.domain"), value: (leader) => leader.domain },
          ]} />
        </Show>
      </Show>

      <Show when={ratesData()}>
        {(rateData) =>
          rateData().length > 0 ? (
            <ReadTable
              title={language.t("sucafina.native.planner-headcount.rates.title")}
              label={language.t("sucafina.native.planner-headcount.rates.label")}
              rows={rateData()}
              columns={[
                { label: language.t("sucafina.native.planner-headcount.rates.name"), value: (rate) => rate.name },
                { label: language.t("sucafina.native.planner-headcount.rates.locations"), value: (rate) => rate.locs },
                { label: language.t("sucafina.native.planner-headcount.rates.currency"), value: (rate) => rate.cur },
                { label: language.t("sucafina.native.planner-headcount.rates.annual"), value: (rate) => rate.annual, format: numberDisplay },
              ]}
            />
          ) : (
            <div class="mx-empty" role="status">
              <strong>{language.t("sucafina.native.planner-headcount.rates.none")}</strong>
              {language.t("sucafina.native.planner-headcount.rates.noneDetail")}
            </div>
          )
        }
      </Show>
      <Show when={ratesData() === undefined}>
        <Unavailable title={language.t("sucafina.native.planner-headcount.rates.unavailable")} detail={language.t("sucafina.native.planner-headcount.rates.unavailableDetail")} />
      </Show>

      <Show
        when={positionData()}
        fallback={<Unavailable title={language.t("sucafina.native.planner-headcount.positions.unavailable")} detail={language.t("sucafina.native.planner-headcount.positions.unavailableDetail")} />}
      >
        {(positionRows) =>
          positionRows().length > 0 ? (
            <>
              <div class="mx-toolbar">
                <label class="mx-field">
                  <span>{language.t("sucafina.native.planner-headcount.positions.search")}</span>
                  <input
                    class="mx-search"
                    type="search"
                    aria-label={language.t("sucafina.native.planner-headcount.positions.search")}
                    value={props.query.q ?? ""}
                    onInput={(event) => updateQuery("q", event.currentTarget.value)}
                  />
                </label>
                <label class="mx-field">
                  <span>{language.t("sucafina.native.planner-headcount.domains.domain")}</span>
                  <select
                    aria-label={language.t("sucafina.native.planner-headcount.positions.filterDomain")}
                    value={props.query.filter ?? ""}
                    onChange={(event) => updateQuery("filter", event.currentTarget.value)}
                  >
                    <option value="">{language.t("sucafina.native.planner-headcount.positions.allDomains")}</option>
                    <For each={domainOptions()}>{(domain) => <option value={domain}>{domain}</option>}</For>
                  </select>
                </label>
              </div>
              <Show
                when={filteredPositions().length > 0}
                fallback={
                  <div class="mx-empty" role="status">
                    <strong>{language.t("sucafina.native.planner-headcount.positions.noMatches")}</strong>
                    {language.t("sucafina.native.planner-headcount.positions.noMatchesDetail")}
                  </div>
                }
              >
                <ReadTable
                  title={language.t("sucafina.native.planner-headcount.positions.title")}
                  label={language.t("sucafina.native.planner-headcount.positions.label")}
                  rows={filteredPositions()}
                  columns={positionsColumns()}
                />
              </Show>
            </>
          ) : (
            <div class="mx-empty" role="status">
              <strong>{language.t("sucafina.native.planner-headcount.positions.none")}</strong>
              {language.t("sucafina.native.planner-headcount.positions.noneDetail")}
            </div>
          )
        }
      </Show>
    </>
  )
}

function Lists(props: { data: Row }) {
  const language = useLanguage()
  const entityData = () => arrayField(props.data, "entities")
  const allocationData = () => arrayField(props.data, "allocations")
  return (
    <div class="mx-grid">
      <Show
        when={entityData()}
        fallback={<Unavailable title={language.t("sucafina.native.planner-headcount.lists.entityListUnavailable")} detail={language.t("sucafina.native.planner-headcount.lists.entityListUnavailableDetail")} />}
      >
        {(entities) =>
          entities().length > 0 ? (
            <ReadTable
              title={language.t("sucafina.native.planner-headcount.lists.entities")}
              label={language.t("sucafina.native.planner-headcount.lists.entities")}
              rows={entities()}
              columns={[
                { label: language.t("sucafina.native.planner-headcount.lists.entityName"), value: (entity) => entity.name },
                { label: language.t("sucafina.native.planner-headcount.lists.entityCode"), value: (entity) => entity.code },
              ]}
            />
          ) : (
            <div class="mx-empty" role="status">
              <strong>{language.t("sucafina.native.planner-headcount.lists.noEntities")}</strong>
              {language.t("sucafina.native.planner-headcount.lists.noEntitiesDetail")}
            </div>
          )
        }
      </Show>
      <Show
        when={allocationData()}
        fallback={<Unavailable title={language.t("sucafina.native.planner-headcount.lists.allocationListUnavailable")} detail={language.t("sucafina.native.planner-headcount.lists.allocationListUnavailableDetail")} />}
      >
        {(allocations) =>
          allocations().length > 0 ? (
            <ReadTable
              title={language.t("sucafina.native.planner-headcount.lists.allocations")}
              label={language.t("sucafina.native.planner-headcount.lists.allocations")}
              rows={allocations()}
              columns={[
                { label: language.t("sucafina.native.planner-headcount.lists.allocationName"), value: (allocation) => allocation.name },
                { label: language.t("sucafina.native.planner-headcount.lists.allocationDescription"), value: (allocation) => allocation.desc },
              ]}
            />
          ) : (
            <div class="mx-empty" role="status">
              <strong>{language.t("sucafina.native.planner-headcount.lists.noAllocations")}</strong>
              {language.t("sucafina.native.planner-headcount.lists.noAllocationsDetail")}
            </div>
          )
        }
      </Show>
    </div>
  )
}

function FxRates(props: { version: Row }) {
  const language = useLanguage()
  const fxData = () => arrayField(props.version, "fx")
  const warnings = createMemo(() => {
    const summary = row(props.version.summary)
    return stringArray(summary.warnings)
  })

  return (
    <>
      <Show when={warnings().length > 0}>
        <div class="mx-card" role="status" aria-label={language.t("sucafina.native.planner-headcount.fx.warningsLabel")}>
          <strong>{language.t("sucafina.native.planner-headcount.fx.warningsTitle")}</strong>
          <ul>
            <For each={warnings()}>{(warning) => <li>{warning}</li>}</For>
          </ul>
        </div>
      </Show>
      <Show
        when={fxData() !== undefined}
        fallback={<Unavailable title={language.t("sucafina.native.planner-headcount.fx.unavailable")} detail={language.t("sucafina.native.planner-headcount.fx.unavailableDetail")} />}
      >
        <Show when={(fxData()?.length ?? 0) > 0} fallback={<div class="mx-empty" role="status"><strong>{language.t("sucafina.native.planner-headcount.fx.none")}</strong></div>}>
          <ReadTable
            title={language.t("sucafina.native.planner-headcount.fx.title")}
            label={language.t("sucafina.native.planner-headcount.fx.title")}
            rows={fxData() ?? []}
            columns={[
              { label: language.t("sucafina.native.planner-headcount.fx.currency"), value: (rate) => rate.cur },
              { label: language.t("sucafina.native.planner-headcount.fx.rate"), value: (rate) => rate.rate, format: numberDisplay },
              { label: language.t("sucafina.native.planner-headcount.fx.rateStatus"), value: (rate) => language.t(rate.rate == null ? "sucafina.native.planner-headcount.fx.noRate" : "sucafina.native.planner-headcount.fx.available") },
            ]}
          />
        </Show>
      </Show>
    </>
  )
}

function ReadTable(props: { title: string; label: string; rows: Row[]; columns: Column[] }) {
  const language = useLanguage()
  return (
    <section class="mx-card" aria-label={props.title}>
      <h2>{props.title}</h2>
      <div class="mx-table" role="region" aria-label={language.t("sucafina.native.planner-headcount.table.region", { label: props.label })} style={{ "overflow-x": "auto" }}>
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
                      return <td style={tableCellStyle}>{column.format ? column.format(value) : display(value, language)}</td>
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

function pageTitle(page: string, language: ReturnType<typeof useLanguage>) {
  if (page === "Headcount") return language.t("sucafina.native.planner-headcount.page.headcount")
  if (page === "Entities & allocations") return language.t("sucafina.native.planner-headcount.page.entitiesAllocations")
  return language.t("sucafina.native.planner-headcount.page.fxRates")
}

function pageDescription(page: string, language: ReturnType<typeof useLanguage>) {
  if (page === "Headcount") return language.t("sucafina.native.planner-headcount.pageDescription.headcount")
  if (page === "Entities & allocations") return language.t("sucafina.native.planner-headcount.pageDescription.entitiesAllocations")
  return language.t("sucafina.native.planner-headcount.pageDescription.fxRates")
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

function display(value: unknown, language: ReturnType<typeof useLanguage>): string {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "string") return value
  if (typeof value === "boolean") return language.t(value ? "sucafina.native.planner-headcount.value.yes" : "sucafina.native.planner-headcount.value.no")
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

function yesNo(value: unknown, language: ReturnType<typeof useLanguage>): string {
  if (typeof value !== "boolean") return display(value, language)
  return language.t(value ? "sucafina.native.planner-headcount.position.included" : "sucafina.native.planner-headcount.position.excluded")
}

function positionStatus(position: Row, language: ReturnType<typeof useLanguage>): string {
  if (position.include !== true) return language.t("sucafina.native.planner-headcount.position.excluded")
  if (position.left === true) return language.t("sucafina.native.planner-headcount.position.notInRoster")
  if (position.hasRate === false) return language.t("sucafina.native.planner-headcount.position.noRate")
  if (position.src === "new") return language.t("sucafina.native.planner-headcount.position.newHire")
  return language.t("sucafina.native.planner-headcount.position.inRoster")
}
