import { sfOwnerMatchesContext } from "../../navigation-state/owner"
import { useNavigate } from "@solidjs/router"
import { createEffect, createMemo, createSignal, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { SF_U19_COPY } from "@/i18n/orchestra-chapters/sf-u19"
import type { SfRef } from "@orchestra/schema/sucafina/context"
import type { SfSurfaceProps } from "../../context/contracts"
import { useSfContext } from "../../context"
import { SfPageFrame, type SfCopyKey, type SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { SfDataTable, type SfColumn, type SfCopyKey as SfTableKey } from "../../shared/table"
import { sfDecisionHref, sfCaseIsListed } from "./paths"
import { sfCandidateRef, sfDecisionControls, sfPortfolioEvaluate, sfPortfolioHistory,
  sfPortfolioPreviewRequest, sfPortfolioReady, sfPortfolioRecorded,
  type SfPortfolioPreview, type SfPortfolioRequest } from "./producer"
import type { SfCaseControls, SfPortfolioCombination, SfPortfolioHistory,
  SfPortfolioResultView, SfRecordedPortfolio } from "./model"
import "./scenarios.css"

const k = (key: keyof typeof SF_U19_COPY) => key as SfCopyKey
const horizonLabel = (start: string, end: string, locale: string) => {
  const day = (value: string) => {
    const iso = value.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return value
    const date = new Date(iso + "T00:00:00Z")
    if (!Number.isFinite(date.getTime())) return value
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(date)
  }
  return day(start) + " — " + day(end)
}
const kt = (key: keyof typeof SF_U19_COPY) => key as unknown as SfTableKey
type Result = Readonly<{ resultRef: string; result: SfPortfolioResultView }>
type View = {
  status: SfUiState
  controls: SfCaseControls | null
  caseState: SfUiState
  history: SfPortfolioHistory
  recorded: Result | null
  preview: SfPortfolioPreview | null
  previewRequestKey: string | null
  previewState: SfUiState
  selected: readonly string[]
  constraints: readonly string[]
  priorities: readonly string[]
  explorationLimit: string
  review: boolean
  busy: boolean
  outcomeUnknown: boolean
  message: keyof typeof SF_U19_COPY | null
}

/** UI42 / UI43: decision provenance and A05-evaluated portfolios only. */
export function SfPortfolioScenariosView(props: SfSurfaceProps<"UI42" | "UI43">): JSX.Element {
  const owner = useSfContext()
  const navigate = useNavigate()
  const language = useLanguage()
  const t = (key: keyof typeof SF_U19_COPY) => language.t(key as Parameters<typeof language.t>[0])
  const [refresh, setRefresh] = createSignal(0)
  const [store, set] = createStore<View>({
    status: "loading", controls: null, caseState: "loading", history: [], recorded: null,
    preview: null, previewRequestKey: null, previewState: "empty",
    selected: [], constraints: [], priorities: [], explorationLimit: "32",
    review: false, busy: false, outcomeUnknown: false, message: null,
  })
  const active = () => owner.state().status === "ready" ? owner.ready() : undefined
  const routedCase = () => "caseRef" in props.route.params ? props.route.params.caseRef as string : undefined
  const routedResult = () => "resultRef" in props.route.params ? props.route.params.resultRef as string : undefined
  const listed = () => store.controls?.cases ?? []
  const selectedCase = () => store.controls?.selected ?? null
  const can = (id: string) => {
    const context = active()?.context
    return !!context && sfPortfolioReady(context, id, id.startsWith("decisions.") ? "decisions" : "portfolio")
  }
  const routeTo = (destination: "list" | "scenarios" | "portfolio-result" | "sensitivity-selection", source?: { caseRef?: string; resultRef?: string }) => {
    const href = sfDecisionHref(props.route, destination, source)
    if (href) navigate(href)
  }
  // Source reads restart on owner epoch, route identity and explicit retry.
  createEffect(() => {
    refresh()
    const epoch = owner.generation()
    const status = owner.state().status
    const current = active()
    const wanted = routedCase()
    const resultRef = routedResult()
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    set({ status: status === "ready" ? "loading" : status === "denied" ? "denied" :
      status === "unauthenticated" ? "session-expired" : "unavailable",
      controls: null, caseState: "loading", history: [], recorded: null,
      preview: null, previewRequestKey: null, previewState: "empty", selected: [],
      constraints: [], priorities: [], review: false, busy: false, outcomeUnknown: false, message: null })
    if (!current || status !== "ready") return
    if (!sfOwnerMatchesContext(current.context, props.route.ownerSelection)) {
      set("status", "denied"); return
    }
    const live = () => !controller.signal.aborted && owner.generation() === epoch
    void (async () => {
      const list = await sfDecisionControls(current.transport, current.context, undefined, controller.signal)
      if (!live()) return
      if (list.status !== "ok") { set("status", list.state); return }
      set({ controls: list.value, status: list.value.cases.length === 0 ? "empty" : "ready" })
      if (!wanted) {
        if (props.surfaceId === "UI43") set("caseState", "invalid")
        return
      }
      if (!sfCaseIsListed(list.value.cases, wanted)) {
        set({ caseState: "denied", status: "denied" }); return
      }
      const caseResult = await sfDecisionControls(current.transport, current.context, wanted, controller.signal)
      if (!live()) return
      if (caseResult.status !== "ok" || !caseResult.value.selected) {
        set("caseState", caseResult.status === "ok" ? "unavailable" : caseResult.state); return
      }
      set({ controls: caseResult.value, caseState: "ready" })
      const caseRef = caseResult.value.selected.caseRef
      if (props.surfaceId === "UI43") {
        if (!resultRef) { set("caseState", "invalid"); return }
        const result = await sfPortfolioRecorded(current.transport, current.context, caseRef, resultRef, controller.signal)
        if (!live()) return
        if (result.status !== "ok") { set("caseState", result.state); return }
        set("recorded", { resultRef, result: result.value.result })
        return
      }
      const history = await sfPortfolioHistory(current.transport, current.context, caseRef, controller.signal)
      if (!live()) return
      if (history.status === "ok") set("history", history.value)
      else set("message", "sf.u19.action.stale")
    })().catch(() => { if (live()) set("status", "unavailable") })
  })

  const candidates = createMemo(() => {
    const source = selectedCase()
    if (!source) return []
    return source.alternatives.flatMap((entry) => {
      const ref = sfCandidateRef(source.ref, source.caseRef.version, entry.id, entry.version)
      return ref ? [{ ref, title: entry.title, alternativeId: entry.id, version: entry.version }] : []
    })
  })
  const preparedRequest = createMemo<SfPortfolioRequest | null>(() => {
    const current = selectedCase()
    const limit = Number(store.explorationLimit)
    if (!current || !store.selected.length || store.selected.length > 64 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 1024 ||
      store.selected.some((ref) => !candidates().some((candidate) => candidate.ref === ref)) ||
      store.constraints.some((ref) => !current.rules.some((rule) => rule.id === ref)) ||
      store.priorities.some((ref) => !current.priorities.some((item) => item.id === ref))) return null
    return { scope: { currency: current.currency, horizon: current.horizon },
      candidateRefs: store.selected, operations: [], constraints: store.constraints,
      priorities: store.priorities, explorationLimit: limit }
  })
  const requestKey = () => preparedRequest() ? JSON.stringify(preparedRequest()) : null
  const updateSelection = (field: "selected" | "constraints" | "priorities", value: string, include: boolean) => {
    if (store.busy) return
    const items = store[field]
    set(field, include ? [...items, value] : items.filter((item) => item !== value))
    set({ preview: null, previewRequestKey: null, review: false })
  }
  const preview = () => {
    const current = active(), currentCase = selectedCase(), request = preparedRequest()
    if (!current || !currentCase || !request || store.busy ||
      !can("portfolio.decision-portfolio-preview")) return
    const epoch = owner.generation()
    const scope = currentCase.caseRef
    const key = JSON.stringify(request)
    const controller = new AbortController()
    set({ preview: null, previewState: "loading", busy: true, message: null, review: false })
    void sfPortfolioPreviewRequest(current.transport, current.context, scope, request, controller.signal)
      .then((result) => {
        if (owner.generation() !== epoch || selectedCase()?.caseRef.version !== scope.version) return
        if (result.status !== "ok") {
          set({ preview: null, previewState: result.state, message: "sf.u19.action.stale" }); return
        }
        set({ preview: result.value, previewRequestKey: key, previewState: "ready" })
      }).catch(() => {
        if (owner.generation() === epoch) set({ previewState: "unavailable", message: "sf.u19.action.stale" })
      }).finally(() => {
        controller.abort()
        if (owner.generation() === epoch) set("busy", false)
      })
  }
  const evaluate = () => {
    const current = active(), currentCase = selectedCase(), request = preparedRequest()
    if (!current || !currentCase || !request || store.busy || store.outcomeUnknown ||
      !store.review || store.previewRequestKey !== JSON.stringify(request) || !store.preview ||
      !can("portfolio.decision-portfolio-evaluate")) return
    const epoch = owner.generation(), caseRef = currentCase.caseRef
    set({ busy: true, message: null })
    const controller = new AbortController()
    const identity = crypto.randomUUID()
    void sfPortfolioEvaluate(current.transport, current.context, caseRef, request, identity, controller.signal)
      .then((result) => {
        if (owner.generation() !== epoch || selectedCase()?.caseRef.version !== caseRef.version) return
        if (result.status !== "ok") {
          set({ previewState: result.state, outcomeUnknown: result.state === "outcome-unknown",
            review: false, message: result.state === "outcome-unknown" ?
              "sf.u19.action.unknown" : "sf.u19.action.stale" }); return
        }
        set({ review: false, preview: null, previewRequestKey: null, message: "sf.u19.action.saveAccepted" })
        setRefresh((value) => value + 1)
      }).catch(() => {
        if (owner.generation() === epoch) set({
          outcomeUnknown: true, previewState: "outcome-unknown", review: false, message: "sf.u19.action.unknown",
        })
      }).finally(() => {
        controller.abort()
        if (owner.generation() === epoch) set("busy", false)
      })
  }
  const tableCols: readonly SfColumn<SfPortfolioCombination>[] = [
    { id: "id", labelKey: kt("sf.u19.results.combination"), align: "start",
      widthPolicy: { kind: "flex", minPx: 150, weight: 2 },
      render: (row) => <bdi>{row.id}</bdi> },
    { id: "eligibility", labelKey: kt("sf.u19.results.eligibility"), align: "start",
      widthPolicy: { kind: "content", minPx: 120, maxPx: 200 },
      render: (row) => <span data-sf-eligibility={row.eligibility}>{t("sf.u19.results." + row.eligibility as keyof typeof SF_U19_COPY)}</span> },
    { id: "comparisonStatus", labelKey: kt("sf.u19.results.comparison"), align: "start",
      widthPolicy: { kind: "content", minPx: 105, maxPx: 180 },
      render: (row) => <span>{row.comparisonStatus}</span> },
    { id: "costCoverageRefs", labelKey: kt("sf.u19.results.coverage"), align: "start",
      widthPolicy: { kind: "content", minPx: 95, maxPx: 150 },
      render: (row) => <span>{row.costCoverageRefs.length} {t("sf.u19.results.sources")}</span> },
  ]
  const renderResults = (value: SfPortfolioResultView): JSX.Element =>
    <section class="sf-u19-results" aria-label={t("sf.u19.results.combinations")}>
      <p>{t("sf.u19.results.conditional")}</p>
      <p>{t("sf.u19.results.noCompleteTotal")}</p>
      <SfDataTable rows={value.combinations} getRowKey={(row) => row.id as SfRef}
        columns={tableCols} sort={{ kind: "none" }} page={{ kind: "none", total: value.combinations.length }}
        onSort={() => undefined} onPage={() => undefined} onSelect={() => undefined}
        rowActions={() => []} onRowAction={() => undefined} captionKey={kt("sf.u19.results.combinations")}
        density="comfortable" state={value.combinations.length ? "ready" : "empty"} />
      <For each={value.combinations}>{(entry) =>
        <details class="sf-u19-combination">
          <summary>{entry.id} — {entry.eligibility} / {entry.comparisonStatus}</summary>
          <dl class="sf-u19-facts">
            <div><dt>{t("sf.u19.results.sources")}</dt><dd><ul>
              <For each={entry.costCoverageRefs}>{(ref) => <li><bdi>{ref}</bdi></li>}</For>
              <Show when={entry.costCoverageRefs.length === 0}><li>{t("sf.u19.results.sourceUnknown")}</li></Show>
            </ul></dd></div>
            <div><dt>{t("sf.u19.results.conflicts")}</dt><dd><ul>
              <For each={entry.conflicts}>{(item) => <li><bdi>{item}</bdi></li>}</For>
            </ul></dd></div>
            <div><dt>{t("sf.u19.results.restrictions")}</dt><dd><ul>
              <For each={entry.restrictions}>{(item) => <li><bdi>{item}</bdi></li>}</For>
            </ul></dd></div>
          </dl>
        </details>
      }</For>
      <section><h3>{t("sf.u19.results.limits")}</h3><ul>
        <For each={value.limitations}>{(reason) => <li><bdi>{reason}</bdi></li>}</For>
      </ul></section>
    </section>
  return (
    <SfPageFrame titleKey={k(props.surfaceId === "UI42" ? "sf.ui42.title" : "sf.ui43.title")}
      context={[]} tabs={[]} activeTab={null} density="comfortable" layout="split"
      onLayoutMode={() => undefined}
      primaryAction={props.surfaceId === "UI42" && routedCase() && can("portfolio.decision-portfolio-preview") ? {
        id: "preview", labelKey: k("sf.u19.scenarios.preview"), tone: "primary",
        disabled: !preparedRequest() || store.busy || store.outcomeUnknown,
        busy: store.busy, onInvoke: preview,
      } : undefined}
      secondaryActions={[]}
    >
      <section class="sf-u19-scenarios" data-sf-scenarios data-sf-surface={props.surfaceId}>
        <SfStatePanel state={store.status} messageKey={k("sf.u19.case.missing")}
          onRetryRead={() => setRefresh((n) => n + 1)}>
          <Show when={store.message}><p role="status" class="sf-u19-message">{t(store.message!)}</p></Show>
          <Show when={!routedCase() && props.surfaceId === "UI42"}>
            <section>
              <h2>{t("sf.u19.case.list")}</h2>
              <ul class="sf-u19-case-list">
                <For each={listed()}>{(item) =>
                  <li><button class="mx-btn" type="button" onClick={() => routeTo("scenarios", { caseRef: item.ref })}>
                    <span>{item.title}</span> <small>{t("sf.u19.case.version")} {item.version}</small>
                  </button></li>
                }</For>
              </ul>
            </section>
          </Show>
          <Show when={routedCase()}>
            <SfStatePanel state={store.caseState} messageKey={k("sf.u19.case.missing")}
              onRetryRead={() => setRefresh((n) => n + 1)}>
              <Show when={selectedCase()}>
                {(source) => <>
                  <header class="sf-u19-case-head">
                    <h2>{source().objective}</h2>
                    <p>{source().currency} · {horizonLabel(source().horizon.start, source().horizon.end, language.intl())} · {t("sf.u19.case.version")} {source().caseRef.version}</p>
                    <button class="mx-btn" type="button" onClick={() => routeTo("list")}>{t("sf.u19.case.choose")}</button>
                  </header>
                  <Show when={props.surfaceId === "UI42"} fallback={
                    <Show when={store.recorded}>{(recorded) => <>
                      <h2>{t("sf.u19.results.recorded")}</h2>
                      <p><bdi>{recorded().resultRef}</bdi></p>
                      {renderResults(recorded().result)}
                      <button class="mx-btn" type="button" onClick={() => routeTo("scenarios", { caseRef: source().ref })}>
                        {t("sf.u19.action.back")}
                      </button>
                    </>}</Show>
                  }>
                    <section class="sf-u19-picker">
                      <h3>{t("sf.u19.scenarios.universe")}</h3>
                      <p>{t("sf.u19.scenarios.notCalculated")}</p>
                      <fieldset disabled={store.busy || store.outcomeUnknown}>
                        <legend>{t("sf.u19.scenarios.candidates")}</legend>
                        <For each={candidates()}>{(item) =>
                          <label class="sf-u19-check">
                            <input type="checkbox" checked={store.selected.includes(item.ref)}
                              onChange={(event) => updateSelection("selected", item.ref, event.currentTarget.checked)} />
                            <span>{item.title} · v{item.version}</span>
                          </label>
                        }</For>
                        <Show when={candidates().length === 0}><p>{t("sf.u19.scenarios.empty")}</p></Show>
                      </fieldset>
                      <fieldset disabled={store.busy || store.outcomeUnknown}>
                        <legend>{t("sf.u19.scenarios.constraints")}</legend>
                        <For each={source().rules}>{(rule) =>
                          <label class="sf-u19-check"><input type="checkbox" checked={store.constraints.includes(rule.id)}
                            onChange={(event) => updateSelection("constraints", rule.id, event.currentTarget.checked)} />
                            <span>{rule.id} · v{rule.expectedVersion ?? t("sf.u19.results.sourceUnknown")}</span></label>
                        }</For>
                      </fieldset>
                      <fieldset disabled={store.busy || store.outcomeUnknown}>
                        <legend>{t("sf.u19.scenarios.priorities")}</legend>
                        <For each={source().priorities}>{(priority) =>
                          <label class="sf-u19-check"><input type="checkbox" checked={store.priorities.includes(priority.id)}
                            onChange={(event) => updateSelection("priorities", priority.id, event.currentTarget.checked)} />
                            <span>{priority.description}</span></label>
                        }</For>
                        <label class="sf-u19-field">{t("sf.u19.scenarios.limit")}
                          <input type="number" min="1" max="1024" step="1" value={store.explorationLimit}
                            onInput={(event) => { set("explorationLimit", event.currentTarget.value); set("preview", null); set("review", false) }} />
                        </label>
                      </fieldset>
                    </section>
                    <Show when={store.previewState !== "empty"}>
                      <SfStatePanel state={store.previewState} messageKey={k("sf.u19.scenarios.noPreview")}>
                        <Show when={store.preview}>
                          <h3>{t("sf.u19.scenarios.preview")}</h3>
                          {renderResults(store.preview!.portfolio)}
                          <Show when={can("portfolio.decision-portfolio-evaluate")}>
                            <label class="sf-u19-check"><input type="checkbox" checked={store.review}
                              disabled={store.busy || store.outcomeUnknown || store.previewRequestKey !== requestKey()}
                              onChange={(event) => set("review", event.currentTarget.checked)} />
                              {t("sf.u19.scenarios.review")}</label>
                            <button type="button" class="mx-btn primary" disabled={!store.review || store.busy ||
                              store.outcomeUnknown || !preparedRequest() || store.previewRequestKey !== requestKey()}
                              onClick={evaluate}>{t("sf.u19.scenarios.confirm")}</button>
                          </Show>
                        </Show>
                      </SfStatePanel>
                    </Show>
                    <section class="sf-u19-history">
                      <h3>{t("sf.u19.results.history")}</h3>
                      <Show when={store.history.length !== 0} fallback={<p>{t("sf.u19.action.noHistoricalResult")}</p>}>
                        <ul><For each={store.history}>{(entry) => <li>
                          <button type="button" class="mx-btn" onClick={() => routeTo("portfolio-result", {
                            caseRef: source().ref, resultRef: entry.resultRef,
                          })}>{entry.createdAt} · {entry.resultRef}</button>
                        </li>}</For></ul>
                      </Show>
                    </section>
                  </Show>
                </>}</Show>
            </SfStatePanel>
          </Show>
        </SfStatePanel>
      </section>
    </SfPageFrame>
  )
}
