import { createEffect, For, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useNavigate } from "@solidjs/router"
import type { Schema } from "effect"
import { SfDomainPageCap17 } from "@orchestra/schema/sucafina/planner"
import { createSfPlannerClient } from "@orchestra/client/sucafina/planner"
import type { SfSurfaceProps } from "../../context/contracts"
import { SfPageFrame, SfContextBar } from "../../shared/frame"
import type { SfCopyKey, SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { useSfPresentation } from "../../shared/frame/presentation"
import { SF_U46_COPY } from "@/i18n/orchestra-chapters/sf-u46"
import { SF_U06_COPY } from "@/i18n/orchestra-chapters/sf-u06"
import { plannerHref, useSfPlannerVersions } from "../versions/model"
import "./compare.css"

type OverviewPage = Extract<Schema.Schema.Type<typeof SfDomainPageCap17.output>, { status: "ok" }>["value"]
type Summary = NonNullable<OverviewPage["data"]["summary"]>
const key = (value: keyof typeof SF_U46_COPY | keyof typeof SF_U06_COPY |
  "sf.common.loading" | "sf.common.empty" | "sf.common.unavailable" |
  "sf.common.noAccess" | "sf.common.loginAgain" | "sf.common.invalidLink" |
  "sf.common.partial" | "sf.common.stale" | "sf.common.filterEmpty" | "sf.common.removed"): SfCopyKey => value as SfCopyKey
const data = (text: string) => ({ kind: "data" as const, text })
const months = Array.from({ length: 12 }, (_, index) => String(index + 1))

export function SfPlannerCompareView(props: SfSurfaceProps<"CAP23">) {
  const model = useSfPlannerVersions(props)
  const navigate = useNavigate()
  const copy = useSfPresentation()
  const [comparison, setComparison] = createStore<{
    selectionKey: string
    left: string
    right: string
    state: SfUiState
    leftPage: OverviewPage | undefined
    rightPage: OverviewPage | undefined
    request: number
  }>({ selectionKey: "", left: "", right: "", state: "loading",
    leftPage: undefined, rightPage: undefined, request: 0 })
  let pending: AbortController | undefined
  const year = () => props.route.query.year ?? model.view.page?.selection.year
  const choices = () => model.view.page?.data.versions.filter((item) => year() === item.year) ?? []
  const go = (destination: "overview" | "versions") =>
    navigate(plannerHref(props.route, destination, { year: year(), version: comparison.left }))

  // A local comparison selection is not a changed business version or a producer write.
  // It resets when the authenticated owner, version inventory, or fiscal year changes.
  createEffect(() => {
    const page = model.view.page
    const generation = model.owner.generation()
    const selectedYear = year()
    if (!page || selectedYear === undefined) {
      setComparison({ selectionKey: "", left: "", right: "", leftPage: undefined,
        rightPage: undefined, state: "loading" })
      return
    }
    const identity = generation + ":" + selectedYear + ":" +
      choices().map((item) => item.id).join("|")
    if (comparison.selectionKey !== identity ||
        !choices().some((item) => item.id === comparison.left) ||
        !choices().some((item) => item.id === comparison.right)) {
      const available = choices()
      setComparison({ selectionKey: identity, left: available[0]?.id ?? "",
        right: available.find((item) => item.id !== available[0]?.id)?.id ?? "",
        leftPage: undefined, rightPage: undefined,
        state: available.length < 2 ? "empty" : "loading" })
    }
  })

  createEffect(() => {
    const request = comparison.request
    const versions = model.view.page
    const ready = model.owner.ready()
    const generation = model.owner.generation()
    const selectedYear = year()
    const leftRef = comparison.left
    const rightRef = comparison.right
    pending?.abort()
    if (!versions || !ready || model.view.state !== "ready") {
      setComparison({ state: model.view.state, leftPage: undefined, rightPage: undefined, request })
      return
    }
    const left = choices().find((item) => item.id === leftRef)
    const right = choices().find((item) => item.id === rightRef)
    if (!left || !right || left.id === right.id || left.year !== right.year || selectedYear === undefined) {
      setComparison({ state: "empty", leftPage: undefined, rightPage: undefined, request })
      return
    }
    const cap17 = ready.context.destinations.find((item) => item.capabilityId === "CAP17")
    const resource = ready.context.availability.find((item) => item.family === "planner" && item.resource === "CAP17")
    const operation = resource?.operations.find((item) => item.operationId === "domain.page.CAP17")
    if (!cap17?.canRead || operation?.state === "denied") {
      setComparison({ state: "denied", leftPage: undefined, rightPage: undefined, request })
      return
    }
    if (!operation || operation.state !== "ready") {
      setComparison({ state: "unavailable", leftPage: undefined, rightPage: undefined, request })
      return
    }
    const abort = new AbortController()
    pending = abort
    setComparison({ state: "loading", leftPage: undefined, rightPage: undefined, request })
    const client = createSfPlannerClient(ready.transport)
    const options = { signal: abort.signal }
    void Promise.all([
      client["domain.page.CAP17"]({ year: left.year, version: left.id }, options),
      client["domain.page.CAP17"]({ year: right.year, version: right.id }, options),
    ]).then(([first, second]) => {
      if (abort.signal.aborted || generation !== model.owner.generation()) return
      if (first.kind !== "response" || second.kind !== "response") {
        setComparison("state", first.kind !== "response" && first.reason === "outcome-unknown" ||
          second.kind !== "response" && second.reason === "outcome-unknown" ? "outcome-unknown" : "unavailable")
        return
      }
      if (first.body.status !== "ok" || second.body.status !== "ok") {
        const failures = [first.body.status, second.body.status]
        setComparison("state", failures.includes("unauthenticated") ? "session-expired"
          : failures.includes("denied") ? "denied" : failures.includes("stale") ? "stale" : "unavailable")
        return
      }
      // The producer may resolve a default selection; do NOT silently compare it.
      if (first.body.value.data.selectedVersion?.id !== leftRef ||
          second.body.value.data.selectedVersion?.id !== rightRef ||
          first.body.value.data.selectedVersion?.year !== selectedYear ||
          second.body.value.data.selectedVersion?.year !== selectedYear) {
        setComparison("state", "stale")
        return
      }
      if (!first.body.value.data.summary || !second.body.value.data.summary) {
        setComparison("state", "unavailable")
        return
      }
      const values = [first.body.value.data.summary, second.body.value.data.summary]
      const partial = values.some((value) => value.warnings.length > 0 || value.actual.some((v) => v === null))
      setComparison({ state: partial ? "partial" : "ready",
        leftPage: first.body.value, rightPage: second.body.value, request })
    }).catch((error: unknown) => {
      if (abort.signal.aborted || generation !== model.owner.generation()) return
      console.error("Sucafina Planner comparison read failed", error instanceof Error ? error.name : "unknown")
      setComparison("state", "unavailable")
    })
  })
  onCleanup(() => pending?.abort())

  const left = (): Summary | undefined => comparison.leftPage?.data.summary
  const right = (): Summary | undefined => comparison.rightPage?.data.summary
  const stateMessage = () => {
    switch (comparison.state) {
      case "loading": return key("sf.common.loading")
      case "empty": return key("sf.common.empty")
      case "partial": return key("sf.common.partial")
      case "filtered-empty": return key("sf.common.filterEmpty")
      case "not-found": return key("sf.common.removed")
      case "denied": return key("sf.common.noAccess")
      case "session-expired": return key("sf.common.loginAgain")
      case "invalid": return key("sf.common.invalidLink")
      case "stale": return key("sf.common.stale")
      default: return key("sf.common.unavailable")
    }
  }
  const showNumber = (value: number | null | undefined, money = true) => {
    if (value === undefined || value === null) return copy.t(key("sf.u46.noValue"))
    const text = new Intl.NumberFormat(copy.locale(), { maximumFractionDigits: 2 }).format(value)
    return money ? text + " unspecified" : text
  }
  const metricRows = () => [
    { id: "budget", label: "sf.u06.budget" as const, left: left()?.total, right: right()?.total },
    { id: "actual", label: "sf.u06.actualYtd" as const, left: left()?.actualYTD, right: right()?.actualYTD },
    { id: "outlook", label: "sf.u06.outlook" as const, left: left()?.fullYear, right: right()?.fullYear },
    { id: "hr", label: "sf.u06.hrStaff" as const, left: left()?.hrTotal, right: right()?.hrTotal },
    { id: "fte", label: "sf.u46.fte" as const, left: left()?.fte, right: right()?.fte },
  ]

  return (
    <SfPageFrame
      titleKey={key("sf.u46.compare")}
      context={year() === undefined ? [] : [
        { id: "year", label: { key: key("sf.u46.year") }, value: data(String(year())) },
      ]}
      tabs={[]}
      activeTab={null}
      secondaryActions={[
        { id: "back", labelKey: key("sf.u46.versions"), tone: "secondary" as const,
          disabled: false, busy: false, onInvoke: () => go("versions") },
        { id: "overview", labelKey: key("sf.cap17.title"), tone: "secondary" as const,
          disabled: !comparison.left, busy: false, onInvoke: () => go("overview") },
      ]}
      density="comfortable"
      layout="comparison"
      onLayoutMode={() => undefined}
    >
      <SfStatePanel state={model.view.state}
        messageKey={model.view.state === "loading" ? key("sf.common.loading") :
          model.view.state === "denied" ? key("sf.common.noAccess") :
            model.view.state === "session-expired" ? key("sf.common.loginAgain") :
              key("sf.common.unavailable")}
        onRetryRead={model.refresh}>
        <Show when={model.view.page}>
          {(inventory) => (
            <section class="sf-u46-compare" data-sf-surface="CAP23-compare">
              <SfContextBar
                state={model.view.state}
                selection={[{ control: "year", optionId: year() === undefined ? null : String(year()) }]}
                catalog={[...new Set(inventory().data.versions.map((version) => version.year))]
                  .sort((a, b) => a - b).map((item) => ({
                    id: String(item), control: "year" as const, value: item, label: data(String(item)), available: true,
                  }))}
                lockedReasons={[]}
                onRequestChange={({ control, optionId }) => {
                  if (control !== "year" || !inventory().data.versions.some((v) => String(v.year) === optionId)) return
                  navigate(plannerHref(props.route, "compare", { year: Number(optionId) }))
                }}
              />
              <div class="sf-u46-compare-select">
                <label for="sf-u46-base">{copy.t(key("sf.u46.source"))}
                  <select id="sf-u46-base" class="mx-input" value={comparison.left}
                    disabled={choices().length < 2}
                    onChange={(event) => {
                      const candidate = choices().find((v) => v.id === event.currentTarget.value && v.id !== comparison.right)
                      if (candidate) setComparison("left", candidate.id)
                      else event.currentTarget.value = comparison.left
                    }}>
                    <For each={choices()}>
                      {(item) => <option value={item.id} disabled={item.id === comparison.right}>{item.name}</option>}
                    </For>
                  </select>
                </label>
                <label for="sf-u46-candidate">{copy.t(key("sf.u46.target"))}
                  <select id="sf-u46-candidate" class="mx-input" value={comparison.right}
                    disabled={choices().length < 2}
                    onChange={(event) => {
                      const candidate = choices().find((v) => v.id === event.currentTarget.value && v.id !== comparison.left)
                      if (candidate) setComparison("right", candidate.id)
                      else event.currentTarget.value = comparison.right
                    }}>
                    <For each={choices()}>
                      {(item) => <option value={item.id} disabled={item.id === comparison.left}>{item.name}</option>}
                    </For>
                  </select>
                </label>
              </div>
              <Show when={choices().length < 2}>
                <p role="status">{copy.t(key("sf.u46.noComparison"))}</p>
              </Show>
              <SfStatePanel state={comparison.state} messageKey={stateMessage()}
                onRetryRead={() => setComparison("request", (n) => n + 1)}>
                <Show when={left() && right()}>
                  <div class="sf-u46-compare-content">
                    <div class="sf-u46-compare-scroll">
                      <table>
                        <caption>{copy.t(key("sf.u46.compare"))}</caption>
                        <thead>
                          <tr>
                            <th scope="col">{copy.t(key("sf.u46.difference"))}</th>
                            <th scope="col">{comparison.leftPage?.data.selectedVersion?.name}</th>
                            <th scope="col">{comparison.rightPage?.data.selectedVersion?.name}</th>
                          </tr>
                        </thead>
                        <tbody>
                          <For each={metricRows()}>
                            {(row) => <tr>
                              <th scope="row">{copy.t(key(row.label))}</th>
                              <td>{showNumber(row.left, row.id !== "fte")}</td>
                              <td>{showNumber(row.right, row.id !== "fte")}</td>
                            </tr>}
                          </For>
                        </tbody>
                      </table>
                    </div>
                    <p>{copy.t(key("sf.u06.budget"))}</p>
                    <div class="sf-u46-compare-scroll">
                      <table class="sf-u46-monthly">
                        <caption>{copy.t(key("sf.u06.budget"))}</caption>
                        <thead>
                          <tr>
                            <th rowSpan={2} scope="col">{copy.t(key("sf.u06.month"))}</th>
                            <th scope="colgroup" colSpan={3}>{comparison.leftPage?.data.selectedVersion?.name}</th>
                            <th scope="colgroup" colSpan={3}>{comparison.rightPage?.data.selectedVersion?.name}</th>
                          </tr>
                          <tr>
                            <For each={[comparison.left, comparison.right]}>
                              {() => <>
                                <th scope="col">{copy.t(key("sf.u06.budget"))}</th>
                                <th scope="col">{copy.t(key("sf.u06.actual"))}</th>
                                <th scope="col">{copy.t(key("sf.u06.outlookShort"))}</th>
                              </>}
                            </For>
                          </tr>
                        </thead>
                        <tbody>
                          <For each={months}>
                            {(month, index) => <tr>
                              <th scope="row">{month}</th>
                              <For each={[left(), right()]}>
                                {(item) => <>
                                  <td>{showNumber(item?.budget[index()] ?? null)}</td>
                                  <td>{showNumber(item?.actual[index()] ?? null)}</td>
                                  <td>{showNumber(item?.outlook[index()] ?? null)}</td>
                                </>}
                              </For>
                            </tr>}
                          </For>
                        </tbody>
                      </table>
                    </div>
                    <For each={[
                      { id: comparison.left, source: left() },
                      { id: comparison.right, source: right() },
                    ]}>
                      {(item) => <Show when={item.source && item.source.warnings.length > 0}>
                        <ul class="sf-u46-compare-warnings" role="status">
                          <For each={item.source!.warnings}>
                            {(warning) => <li>{copy.t(key("sf.u06.missingFx"), { codes: warning })}</li>}
                          </For>
                        </ul>
                      </Show>}
                    </For>
                  </div>
                </Show>
              </SfStatePanel>
            </section>
          )}
        </Show>
      </SfStatePanel>
    </SfPageFrame>
  )
}
