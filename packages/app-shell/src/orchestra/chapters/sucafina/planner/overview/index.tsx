import { createEffect, onCleanup, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useNavigate } from "@solidjs/router"
import type { Schema } from "effect"
import { SfDomainPageCap17 } from "@orchestra/schema/sucafina/planner"
import { createSfPlannerClient } from "@orchestra/client/sucafina/planner"
import type { SfRef } from "@orchestra/schema/sucafina/context"
import { useSfContext } from "../../context"
import type { SfSurfaceProps } from "../../context/contracts"
import { SfPageFrame, SfContextBar, SfChartFrame } from "../../shared/frame"
import type { SfCopyKey, SfMessage, SfUiState, SfDisplayValue, SfChartTable } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { useSfPresentation } from "../../shared/frame/presentation"
import { plannerHref } from "../versions/model"
import { SF_U06_COPY } from "@/i18n/orchestra-chapters/sf-u06"
import "./overview.css"

type Page = Extract<Schema.Schema.Type<typeof SfDomainPageCap17.output>, { status: "ok" }>["value"]
type Summary = NonNullable<Page["data"]["summary"]>
type Version = Page["data"]["versions"][number]

const key = (value: keyof typeof SF_U06_COPY | "sf.common.empty" | "sf.common.loading" |
  "sf.common.unavailable" | "sf.common.noAccess" | "sf.common.invalidLink" |
  "sf.common.stale" | "sf.common.loginAgain" | "sf.common.partial" | "sf.common.removed" |
  "sf.common.observedZero"): SfCopyKey => value as SfCopyKey
const message = (value: keyof typeof SF_U06_COPY, params?: Record<string, string | number>): SfMessage =>
  ({ key: key(value), params })
const data = (value: string) => ({ kind: "data" as const, text: value })

function stateOfContext(status: ReturnType<ReturnType<typeof useSfContext>["state"]>["status"]): SfUiState {
  switch (status) {
    case "ready": return "ready"
    case "resolving": case "choose-installation": return "loading"
    case "unauthenticated": return "session-expired"
    case "denied": return "denied"
    case "context-mismatch": return "invalid"
    default: return "unavailable"
  }
}

const months = Array.from({ length: 12 }, (_, index) => String(index + 1))
function currencyValue(value: number | null): SfDisplayValue {
  if (value === null) return { kind: "missing", reason: message("sf.u06.missingActual") }
  return { kind: "number", value, unit: { kind: "currency", code: "USD" }, fractionDigits: 2 }
}

function chartTable(summary: Summary): SfChartTable {
  return {
    caption: message("sf.u06.monthly"),
    columns: [
      { id: "month", label: message("sf.u06.month") },
      { id: "budget", label: message("sf.u06.budgetUsd") },
      { id: "actual", label: message("sf.u06.actualUsd") },
      { id: "outlook", label: message("sf.u06.outlookUsd") },
    ],
    rows: months.map((month, index) => ({
      id: month,
      cells: {
        month: { kind: "text" as const, text: data(month) },
        budget: currencyValue(summary.budget[index] ?? null),
        actual: currencyValue(summary.actual[index] ?? null),
        outlook: currencyValue(summary.outlook[index] ?? null),
      },
    })),
  }
}

export function SfPlannerOverviewView(props: SfSurfaceProps<"CAP17">) {
  const owner = useSfContext()
  const navigate = useNavigate()
  const copy = useSfPresentation()
  const [view, setView] = createStore<{
    state: SfUiState
    page: Page | undefined
    request: number
    selectedMonth: string | null
  }>({ state: "loading", page: undefined, request: 0, selectedMonth: null })
  let pending: AbortController | undefined

  createEffect(() => {
    const request = view.request
    const current = owner.state()
    const ready = owner.ready()
    const generation = owner.generation()
    const year = props.route.query.year
    const version = props.route.query.version
    const filter = props.route.query.filter
    pending?.abort()
    if (!ready || current.status !== "ready") {
      setView({ state: stateOfContext(current.status), page: undefined, selectedMonth: null, request })
      return
    }
    const destination = ready.context.destinations.find((item) => item.capabilityId === "CAP17")
    const resource = ready.context.availability.find((item) => item.family === "planner" && item.resource === "CAP17")
    const read = resource?.operations.find((item) => item.operationId === "domain.page.CAP17")
    if (!destination?.canRead || read?.state === "denied") {
      setView({ state: "denied", page: undefined, selectedMonth: null, request })
      return
    }
    if (!read || read.state !== "ready") {
      setView({ state: "unavailable", page: undefined, selectedMonth: null, request })
      return
    }
    const abort = new AbortController()
    pending = abort
    setView({ state: "loading", page: undefined, selectedMonth: null, request })
    void createSfPlannerClient(ready.transport)["domain.page.CAP17"](
      { ...(year === undefined ? {} : { year }), ...(version ? { version } : {}),
        ...(filter ? { filter } : {}) },
      { signal: abort.signal },
    ).then((result) => {
      if (abort.signal.aborted || owner.generation() !== generation) return
      if (result.kind !== "response") {
        setView("state", result.reason === "outcome-unknown" ? "outcome-unknown" : "unavailable")
        return
      }
      const body = result.body
      if (body.status === "ok") {
        // Never display the producer's default as a different explicitly
        // requested fiscal plan; a missing ref is a removed/not-found state.
        if (version && (body.value.data.selectedVersion?.id !== version ||
          (year !== undefined && body.value.data.selectedVersion?.year !== year))) {
          setView({ state: "not-found", page: undefined, selectedMonth: null, request })
          return
        }
        setView({
          state: body.value.data.versions.length ? "ready" : "empty",
          page: body.value,
          selectedMonth: null, request,
        })
        return
      }
      setView("state", body.status === "unauthenticated" ? "session-expired"
        : body.status === "denied" ? "denied" : body.status === "stale" ? "stale"
          : body.status === "needs-input" || body.status === "invalid" ? "invalid" : "unavailable")
    }).catch((error: unknown) => {
      if (abort.signal.aborted || owner.generation() !== generation) return
      console.error("Sucafina Planner overview read failed", error instanceof Error ? error.name : "unknown")
      setView("state", "unavailable")
    })
  })
  onCleanup(() => pending?.abort())

  const page = () => view.page
  const selected = (): Version | undefined => page()?.data.selectedVersion
  const summary = (): Summary | undefined => page()?.data.summary
  const year = () => selected()?.year ?? page()?.selection.year
  const open = (destination: "overview" | "versions" | "compare" | "import", options?: { year?: number; version?: string; filter?: string }) =>
    navigate(plannerHref(props.route, destination, options))
  const versionOptions = () => page()?.data.versions.filter((version) => year() === undefined || version.year === year()) ?? []
  const canCompare = () => {
    const ready = owner.ready()
    const dest = ready?.context.destinations.find((item) => item.capabilityId === "CAP23")
    const read = ready?.context.availability.find((item) => item.family === "planner" && item.resource === "CAP23")
      ?.operations.find((item) => item.operationId === "domain.page.CAP23")
    return !!dest?.canRead && read?.state === "ready"
  }
  const importReady = () => {
    const ready = owner.ready()
    if (!ready || !page() || view.state !== "ready") return false
    const dest = ready.context.destinations.find((item) => item.capabilityId === "CAP17")
    const resource = ready.context.availability.find((item) => item.family === "planner" && item.resource === "CAP17")
    return !!dest?.canRead && !!dest.allowedActionIds.includes("import-workbook") &&
      !!page()?.allowedActionIds.includes("import-workbook") &&
      resource?.operations.some((item) => item.operationId === "domain.command.CAP17.import-workbook" && item.state === "ready") === true
  }
  const stateMessage = () => {
    switch (view.state) {
      case "loading": return key("sf.common.loading")
      case "empty": return key("sf.u06.noVersion")
      case "not-found": return key("sf.common.removed")
      case "denied": return key("sf.common.noAccess")
      case "session-expired": return key("sf.common.loginAgain")
      case "invalid": return key("sf.common.invalidLink")
      case "stale": return key("sf.common.stale")
      default: return key("sf.common.unavailable")
    }
  }
  const coverage = () => {
    const source = summary()
    const known = source?.actual.filter((value) => value !== null).length ?? null
    const partial = !!source && (source.warnings.length > 0 || known !== 12)
    return {
      state: partial ? "partial" as const : source ? "complete" as const : "unavailable" as const,
      summary: message("sf.u06.monthly"),
      reasons: source?.warnings.map((warning) => message("sf.u06.missingFx", { codes: warning })) ?? [],
      knownCount: known,
      expectedCount: source ? 12 : null,
    }
  }
  const series = () => {
    const source = summary()
    if (!source) return []
    return ([
      { id: "budget", values: source.budget, label: "sf.u06.budget" },
      { id: "actual", values: source.actual, label: "sf.u06.actual" },
      { id: "outlook", values: source.outlook, label: "sf.u06.outlookShort" },
    ] as const).map((series) => ({
      id: series.id, label: message(series.label), unit: { kind: "currency" as const, code: "USD" },
      semanticToken: series.id,
      points: series.values.map((value, index) => ({
        id: String(index + 1), x: index + 1, xLabel: data(String(index + 1)),
        value: value === null
          ? { kind: "missing" as const, reason: message("sf.u06.missingActual") }
          : { kind: "known" as const, value },
        selectionRef: String(index + 1) as SfRef,
      })),
    }))
  }
  const plot = () => {
    const source = summary()
    const numbers = source ? [...source.budget, ...source.actual, ...source.outlook].filter((v): v is number => v !== null) : []
    const min = Math.min(0, ...numbers)
    const max = Math.max(1, ...numbers)
    return series().flatMap((line, seriesIndex) => line.points.flatMap((point, index) => (
      point.value.kind === "known" ? [{
        id: line.id + "-" + point.id,
        x: 24 + index * 30 + (seriesIndex - 1) * 6,
        y: 124 - ((point.value.value - min) / (max - min)) * 100,
        className: "sf-u06-point-" + line.id,
      }] : []
    )))
  }
  return (
    <SfPageFrame
      titleKey={key("sf.cap17.title")}
      context={selected() ? [
        { id: "year", label: message("sf.u06.year"), value: data(String(selected()!.year)) },
        { id: "version", label: message("sf.u06.version"), value: data(selected()!.name) },
        { id: "currency", label: message("sf.u06.currency"), value: data("USD") },
      ] : []}
      tabs={[]}
      activeTab={null}
      primaryAction={{
        id: "compare", labelKey: key("sf.cap17.primary"), tone: "primary", busy: false,
        disabled: !canCompare() || view.state !== "ready",
        onInvoke: () => open("compare", { year: year() }),
      }}
      secondaryActions={[
        {
          id: "versions", labelKey: key("sf.u06.version"), tone: "secondary" as const,
          disabled: !canCompare(), busy: false,
          onInvoke: () => open("versions", { year: year() }),
        },
        {
          id: "import", labelKey: key("sf.u06.importWorkbook"), tone: "secondary" as const,
          disabled: !importReady(), busy: false,
          onInvoke: () => open("import"),
        },
      ]}
      density="comfortable"
      layout="reading"
      onLayoutMode={() => undefined}
    >
      <SfStatePanel
        state={view.state}
        messageKey={stateMessage()}
        onRetryRead={() => setView("request", (value) => value + 1)}
        onBack={() => open("versions", { year: props.route.query.year })}
      >
        <Show when={page()}>
          {(loaded) => (
            <section class="sf-u06" data-sf-surface="CAP17">
              <SfContextBar
                state={view.state}
                selection={[
                  { control: "year", optionId: year() === undefined ? null : String(year()) },
                  { control: "version", optionId: selected()?.id ?? null },
                ]}
                catalog={[
                  ...[...new Set(loaded().data.versions.map((version) => version.year))]
                    .sort((a, b) => a - b).map((value) => ({
                      id: String(value), control: "year" as const, value,
                      label: data(String(value)), available: true,
                    })),
                  ...versionOptions().map((version) => ({
                    id: version.id, control: "version" as const, value: version.id,
                    label: data(version.name), available: true,
                  })),
                ]}
                lockedReasons={[]}
                onRequestChange={(change) => {
                  if (change.control === "year") {
                    const available = loaded().data.versions.find((version) => String(version.year) === change.optionId)
                    if (available) open("overview", { year: available.year, version: available.id })
                  }
                  if (change.control === "version") {
                    const available = versionOptions().find((version) => version.id === change.optionId)
                    if (available) open("overview", { year: available.year, version: available.id })
                  }
                }}
              />
              <Show when={summary()} fallback={<p role="status">{copy.t(key("sf.u06.noVersion"))}</p>}>
                {(item) => (
                  <>
                    <dl class="sf-u06-metrics">
                      <For each={[
                        { label: "sf.u06.totalBudget", value: item().total },
                        { label: "sf.u06.actualYtd", value: item().actualYTD },
                        { label: "sf.u06.outlook", value: item().fullYear },
                        { label: "sf.u06.hrStaff", value: item().hrTotal },
                      ] as const}>
                        {(metric) => (
                          <div class="sf-u06-metric">
                            <dt>{copy.t(key(metric.label))}</dt>
                            <dd>{metric.value === null ? copy.t(key("sf.u06.missingActual")) :
                              new Intl.NumberFormat(copy.locale(), { style: "currency", currency: "USD" }).format(metric.value)}</dd>
                          </div>
                        )}
                      </For>
                    </dl>
                    <Show when={item().warnings.length > 0}>
                      <ul class="sf-u06-warnings" role="status">
                        <For each={item().warnings}>
                          {(warning) => <li>{copy.t(key("sf.u06.missingFx"), { codes: warning })}</li>}
                        </For>
                      </ul>
                    </Show>
                    <SfChartFrame
                      titleKey={key("sf.u06.monthly")}
                      questionKey={key("sf.u06.missingActual")}
                      context={[{ label: message("sf.u06.year"), value: data(String(year())) }]}
                      coverage={coverage()}
                      series={series()}
                      table={chartTable(item())}
                      selection={view.selectedMonth as SfRef | null}
                      state={coverage().state === "partial" ? "partial" : "ready"}
                      onSelect={(ref) => setView("selectedMonth", ref)}
                      onOpenSource={() => undefined}
                    >
                      <svg class="sf-u06-plot" viewBox="0 0 390 155" aria-hidden={"true"} focusable={"false"}>
                        <path d="M 16 10 V 128 H 380" fill="none" stroke="currentColor" opacity=".4"/>
                        <For each={plot()}>
                          {(point) => <circle class={point.className} cx={point.x} cy={point.y} r="4" />}
                        </For>
                      </svg>
                    </SfChartFrame>
                    <p class="sf-u06-description">{copy.t(key("sf.u06.budgetExplanation"), { year: year() ?? "" })}</p>
                    <div class="sf-u06-compare">
                      <label for="sf-u06-compare-filter">{copy.t(key("sf.u06.compareBudget"))}</label>
                      <select id="sf-u06-compare-filter" class="mx-input"
                        value={props.route.query.filter ?? ""}
                        onChange={(event) => {
                          const chosen = versionOptions().find((version) => version.id === event.currentTarget.value &&
                            version.id !== selected()?.id)
                          open("overview", { year: year(), version: selected()?.id, filter: chosen?.id })
                        }}>
                        <option value="">{copy.t(key("sf.u06.allBudgets"))}</option>
                        <For each={versionOptions().filter((version) => version.id !== selected()?.id)}>
                          {(version) => <option value={version.id}>{version.name}</option>}
                        </For>
                      </select>
                      <button class="mx-btn" type="button" disabled={!canCompare()} onClick={() => open("compare", { year: year() })}>
                        {copy.t(key("sf.u06.compareBudgets"))}
                      </button>
                    </div>
                    <Show when={props.route.query.filter &&
                      !versionOptions().some((version) => version.id === props.route.query.filter)}>
                      <p role="status">{copy.t(key("sf.u06.invalidComparison"))}</p>
                    </Show>
                    <section class="sf-u06-comparison-list" aria-label={copy.t(key("sf.u06.compareBudgets"))}>
                      <div class="sf-u06-scroll">
                        <table>
                          <caption>{copy.t(key("sf.u06.compareBudgets"))}</caption>
                          <thead><tr>
                            <th scope="col">{copy.t(key("sf.u06.version"))}</th>
                            <th scope="col">{copy.t(key("sf.u06.budgetUsd"))}</th>
                            <th scope="col">{copy.t(key("sf.u06.fteDecember"))}</th>
                          </tr></thead>
                          <tbody>
                            <For each={loaded().data.comparisons.filter((item) =>
                              (year() === undefined || item.year === year()) &&
                              (!props.route.query.filter || item.id === selected()?.id || item.id === props.route.query.filter)
                            )}>
                              {(comparison) => <tr>
                                <th scope="row">{comparison.name}</th>
                                <td>{comparison.total === null ? copy.t(key("sf.u06.missingActual")) :
                                  new Intl.NumberFormat(copy.locale(), { style: "currency", currency: "USD" }).format(comparison.total)}</td>
                                <td>{comparison.fte === null ? copy.t(key("sf.u06.missingActual")) :
                                  new Intl.NumberFormat(copy.locale()).format(comparison.fte)}</td>
                              </tr>}
                            </For>
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </>
                )}
              </Show>
            </section>
          )}
        </Show>
      </SfStatePanel>
    </SfPageFrame>
  )
}
