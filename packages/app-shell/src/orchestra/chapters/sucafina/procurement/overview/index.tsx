import { createEffect, createMemo, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { createSfProcurementClient } from "@orchestra/client/sucafina/procurement"
import { SfProcurement } from "@orchestra/schema/sucafina/procurement"
import { useSfContext } from "../../context"
import type { SfSurfaceProps } from "../../context/contracts"
import { SfPageFrame } from "../../shared/frame"
import { sfCommonKey, useSfPresentation } from "../../shared/frame/presentation"
import type { SfCopyKey, SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import "./overview.css"

type Projection = Extract<typeof SfProcurement.operations["domain.page.CAP24"]["output"]["Type"], { status: "ok" }>
type Request = Projection["value"]["data"]["requests"][number]

/** CAP24 is the admitted source of financial aggregates. Do not derive an approval
 * holder, timestamp/age or business total from the client-visible request list.
 * Those fields require the frozen queue/BI producer's own measured output. */
export function SfProcurementOverviewView(props: SfSurfaceProps<"CAP24">): JSX.Element {
  const owner = useSfContext()
  const language = useLanguage()
  const { t } = useSfPresentation()
  const key = (value: string) => value as SfCopyKey
  const [view, setView] = createStore<{
    state: SfUiState
    projection?: Projection
    readGeneration?: number
    statusFilter: string
    refresh: number
  }>({ state: "loading", statusFilter: "", refresh: 0 })

  createEffect(() => {
    const contextState = owner.state()
    const ready = owner.ready()
    const generation = owner.generation()
    const _refresh = view.refresh
    if (!ready || contextState.status !== "ready") {
      setView({
        projection: undefined, readGeneration: undefined, statusFilter: "",
        state: contextState.status === "resolving" ? "loading"
          : contextState.status === "unauthenticated" ? "session-expired"
          : contextState.status === "denied" ? "denied"
          : contextState.status === "context-mismatch" ? "invalid" : "unavailable",
      })
      return
    }
    const allowed = ready.context.destinations.find((destination) =>
      destination.capabilityId === "CAP24" && destination.surface === "procurement" &&
      destination.page === "Dashboard" && destination.canRead)
    if (!allowed) {
      setView({ projection: undefined, readGeneration: undefined, state: "denied" })
      return
    }
    const abort = new AbortController()
    setView({ projection: undefined, readGeneration: undefined, state: "loading" })
    const input = {
      ...(props.route.query.year !== undefined ? { year: props.route.query.year } : {}),
      ...(props.route.query.month !== undefined ? { month: props.route.query.month } : {}),
    }
    void createSfProcurementClient(ready.transport)["domain.page.CAP24"](input, {
      signal: abort.signal,
    }).then((result) => {
      if (abort.signal.aborted || owner.generation() !== generation) return
      if (owner.state().status !== "ready" || !owner.ready()) return
      if (result.kind !== "response") {
        setView({ projection: undefined, state: "unavailable" })
        return
      }
      const body = result.body
      if (body.status !== "ok") {
        setView({
          projection: undefined,
          state: body.status === "unauthenticated" ? "session-expired"
            : body.status === "denied" ? "denied"
            : body.status === "needs-input" ? "invalid"
            : body.status === "stale" ? "stale" : "unavailable",
        })
        return
      }
      const stamp = ready.context.stamp
      if (body.value.capabilityId !== "CAP24" ||
          body.context.projectId !== stamp.projectId ||
          body.context.installationId !== stamp.installationId ||
          body.context.hostId !== stamp.hostId ||
          body.context.principalRef !== stamp.principalRef ||
          body.context.accessRevision !== stamp.accessRevision ||
          body.context.policyVersion !== stamp.policyVersion) {
        setView({ projection: undefined, state: "denied" })
        return
      }
      setView({
        projection: body, readGeneration: generation,
        state: body.value.data.metrics.unavailable.length ? "partial"
          : body.value.data.requests.length ? "ready" : "empty",
      })
    }).catch((error: unknown) => {
      if (abort.signal.aborted || owner.generation() !== generation) return
      console.error("Procurement overview read failed", error instanceof Error ? error.name : "unknown")
      setView({ projection: undefined, state: "unavailable" })
    })
    onCleanup(() => abort.abort())
  })

  const currentProjection = () => {
    const current = owner.ready()
    const projection = view.projection
    if (owner.state().status !== "ready" || !current || !projection ||
        view.readGeneration !== owner.generation()) return undefined
    const stamp = current.context.stamp
    return projection.context.projectId === stamp.projectId &&
      projection.context.installationId === stamp.installationId &&
      projection.context.hostId === stamp.hostId &&
      projection.context.principalRef === stamp.principalRef &&
      projection.context.policyVersion === stamp.policyVersion &&
      projection.context.accessRevision === stamp.accessRevision ? projection : undefined
  }
  const requests = createMemo(() => currentProjection()?.value.data.requests ?? [])
  const statuses = createMemo(() => [...new Set(requests().map((row) => row.status))])
  const filtered = createMemo(() => requests().filter((row) =>
    !view.statusFilter || row.status === view.statusFilter))
  const state = (): SfUiState =>
    currentProjection() && view.statusFilter && filtered().length === 0 ? "filtered-empty" : view.state
  const currency = () => currentProjection()?.value.data.formSettings.currency ?? ""
  const money = (value: number | null | undefined): JSX.Element =>
    value === null || value === undefined || !Number.isFinite(value)
      ? <span class="sf-n21-unknown">{t(sfCommonKey("sf.common.unknown"))}</span>
      : <span class="sf-n21-number">{new Intl.NumberFormat(language.intl(), {
          minimumFractionDigits: 2, maximumFractionDigits: 2,
        }).format(value)} <bdi>{currency()}</bdi></span>
  const metric = (label: string, value: number | null, unavailable = false): JSX.Element => (
    <div class="mx-card sf-n21-metric">
      <dt>{t(key(label))}</dt>
      <dd>{money(value)}</dd>
      <Show when={unavailable}>
        <small role="status">{t(sfCommonKey("sf.common.partial"))}</small>
      </Show>
    </div>
  )
  const requestId = (record: Request) => record.number ?? null

  return (
    <SfPageFrame
      titleKey={key("sf.cap24.title")}
      context={[]}
      tabs={[]}
      activeTab={null}
      primaryAction={{
        id: "open-requests", labelKey: key("sf.cap24.primary"), tone: "primary",
        disabled: true, reasonKey: sfCommonKey("sf.common.unavailable"),
        busy: false, onInvoke: () => undefined,
      }}
      secondaryActions={[]}
      density="comfortable"
      layout="work"
      onLayoutMode={() => undefined}
    >
      <div class="sf-n21-overview" data-sf-surface="CAP24">
        <SfStatePanel
          state={state()}
          messageKey={sfCommonKey(
            state() === "ready" ? "sf.common.currentSource"
              : state() === "partial" ? "sf.common.partial"
              : state() === "empty" ? "sf.common.empty"
              : state() === "filtered-empty" ? "sf.common.filterEmpty"
              : state() === "denied" ? "sf.common.noAccess"
              : state() === "session-expired" ? "sf.common.loginAgain"
              : state() === "stale" ? "sf.common.stale"
              : state() === "invalid" ? "sf.common.fieldErrorSummary"
              : state() === "loading" ? "sf.common.loading" : "sf.common.unavailable",
          )}
          onRetryRead={() => setView("refresh", (value) => value + 1)}
        >
          <Show when={currentProjection()}>
            {(projection) => (
              <>
                <section class="sf-n21-filter" aria-label={t(key("sf.n21.filter"))}>
                  <label for="sf-n21-status">{t(key("sf.n21.filter"))}</label>
                  <select
                    id="sf-n21-status"
                    value={view.statusFilter}
                    onChange={(event) => setView("statusFilter", event.currentTarget.value)}
                  >
                    <option value="">{t(key("sf.n21.all"))}</option>
                    <For each={statuses()}>{(status) => <option value={status}>{status}</option>}</For>
                  </select>
                  <Show when={view.statusFilter}>
                    <button class="mx-btn" type="button" onClick={() => setView("statusFilter", "")}>
                      {t(key("sf.n21.clear"))}
                    </button>
                  </Show>
                </section>
                <dl class="sf-n21-metrics">
                  {metric("sf.n21.open", projection().value.data.metrics.open)}
                  {metric("sf.n21.approvedOpex", projection().value.data.metrics.approved.OPEX,
                    projection().value.data.metrics.unavailable.length > 0)}
                  {metric("sf.n21.approvedCapex", projection().value.data.metrics.approved.CAPEX,
                    projection().value.data.metrics.unavailable.length > 0)}
                  {metric("sf.n21.issuedOpex", projection().value.data.metrics.issued.OPEX,
                    projection().value.data.metrics.unavailable.length > 0)}
                  {metric("sf.n21.issuedCapex", projection().value.data.metrics.issued.CAPEX,
                    projection().value.data.metrics.unavailable.length > 0)}
                </dl>
                <section class="mx-card sf-n21-list">
                  <h2>{t(key("sf.n21.stock"))}</h2>
                  <div class="sf-n21-table-scroll">
                    <table>
                      <caption>{t(key("sf.cap24.title"))}</caption>
                      <thead><tr>
                        <th scope="col">{t(key("sf.n21.request"))}</th>
                        <th scope="col">{t(key("sf.n21.status"))}</th>
                        <th scope="col">{t(key("sf.n21.amount"))}</th>
                      </tr></thead>
                      <tbody>
                        <For each={filtered()}>
                          {(record) => (
                            <tr data-sf-request={requestId(record) ?? undefined}>
                              <th scope="row"><bdi>{requestId(record) ?? t(sfCommonKey("sf.common.unknown"))}</bdi></th>
                              <td><bdi>{record.status}</bdi></td>
                              <td>{money(record.value)}</td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>
                </section>
                <div class="sf-n21-unsupported">
                  <section class="mx-card">
                    <h2>{t(key("sf.n21.holder"))}</h2>
                    <p role="status">{t(sfCommonKey("sf.common.unavailable"))}</p>
                  </section>
                  <section class="mx-card">
                    <h2>{t(key("sf.n21.aging"))}</h2>
                    <p role="status">{t(sfCommonKey("sf.common.unavailable"))}</p>
                  </section>
                </div>
              </>
            )}
          </Show>
        </SfStatePanel>
      </div>
    </SfPageFrame>
  )
}
