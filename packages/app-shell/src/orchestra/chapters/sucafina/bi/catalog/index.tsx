import { For, Show, createEffect, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { useSfContext } from "../../context"
import { nativeBiDestination } from "../native-destination"
import { clearSfBiRetention, readSfBiSelection, retainSfBiSelection, sfBiOwnerFence, sfBiStampKey } from "../lifecycle-retention"
import { createSfContextClient } from "@orchestra/client/sucafina/context"
import type { SfSurfaceProps } from "../../context/contracts"
import type { SfRef } from "@orchestra/schema/sucafina/context"
import type {
  SfBiBiOptionsOutput, SfBiBiSourceOutput, SfBiBiDataOutput, SfBiBiDecisionOutput,
} from "@orchestra/schema/sucafina/bi"
import { createSfBiClient } from "@orchestra/client/sucafina/bi"
import { SfPageFrame } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import type { SfUiState } from "../../shared/frame"
import { useSfPresentation, sfCommonKey } from "../../shared/frame/presentation"
import { SfFinancialFigure } from "../finance"
import { SfOperationalFigure } from "../operations"
import { SfDecisionFigure } from "../decisions"
import type { SfBiFinancialView, SfBiOperationalView, SfBiSnapshot } from "../finance/model"
import { sfBiKey } from "../finance/model"
import "./catalog.css"

const BI_CATALOG = [
  { id: "BI01", family: "finance", question: "sf.u20.question.BI01" },
  { id: "BI02", family: "finance", question: "sf.u20.question.BI02" },
  { id: "BI03", family: "finance", question: "sf.u20.question.BI03" },
  { id: "BI04", family: "finance", question: "sf.u20.question.BI04" },
  { id: "BI05", family: "operations", question: "sf.u21.question.BI05" },
  { id: "BI06", family: "operations", question: "sf.u21.question.BI06" },
  { id: "BI07", family: "operations", question: "sf.u21.question.BI07" },
  { id: "BI08", family: "operations", question: "sf.u21.question.BI08" },
  { id: "BI09", family: "decisions", question: "sf.u21.question.BI09" },
  { id: "BI10", family: "decisions", question: "sf.u21.question.BI10" },
  { id: "BI11", family: "decisions", question: "sf.u21.question.BI11" },
] as const

type ViewId = (typeof BI_CATALOG)[number]["id"]
type Options = Extract<SfBiBiOptionsOutput, { status: "ok" }>["value"]
type SourceLinks = Extract<SfBiBiSourceOutput, { links: unknown }>["links"]
type DecisionDetail = Extract<SfBiBiDecisionOutput, { status: "ok" }>["value"]
type CatalogData = Extract<SfBiBiDataOutput, { request: unknown }>

type CatalogStore = {
  viewId: ViewId | ""
  start: string
  end: string
  choice: string
  baseRef: string
  candidateRef: string
  currency: string
  focus: string
  requested: boolean
  options: Options | undefined
  data: CatalogData | undefined
  selectedSource: SfRef | null
  links: SourceLinks | undefined
  detail: DecisionDetail | undefined
  sourceState: SfUiState
  readState: SfUiState
  busy: boolean
  layout: "single" | "split" | "split-context"
}

function failureState(status: string): SfUiState {
  switch (status) {
    case "denied": return "denied"
    case "stale": return "stale"
    case "conflict":
    case "provider-conflict": return "conflict"
    case "needs-input":
    case "invalid": return "invalid"
    default: return "unavailable"
  }
}

function isFinancial(id: ViewId): id is SfBiFinancialView {
  return id === "BI01" || id === "BI02" || id === "BI03" || id === "BI04"
}
function isOperational(id: ViewId): id is SfBiOperationalView {
  return id === "BI05" || id === "BI06" || id === "BI07" || id === "BI08"
}

/** U21 UI45 entry: only real A08 reads, from the current F01 owner and generation. */
export function SfBiCatalog(props: SfSurfaceProps<"UI45" | "UI46">) {
  const context = useSfContext()
  const { t } = useSfPresentation()
  const retained = readSfBiSelection(context, props.route.pathname)
  const initialView = props.surfaceId === "UI46" ? props.route.params.viewId as ViewId :
    retained && BI_CATALOG.some((item) => item.id === retained.viewId) ? retained.viewId as ViewId : ""
  const [store, setStore] = createStore<CatalogStore>({
    viewId: initialView, start: retained?.start ?? "", end: retained?.end ?? "", choice: "",
    baseRef: "", candidateRef: "", currency: "", focus: "", requested: false,
    options: undefined, data: undefined, links: undefined, detail: undefined, selectedSource: null,
    sourceState: "empty", readState: "ready", busy: false, layout: "single",
  })
  let root: HTMLElement | undefined
  let activeController: AbortController | undefined
  let authorityController: AbortController | undefined
  let authorityPending: Promise<boolean> | undefined
  let ticket = 0, selectionEpoch = 0, disposed = false
  let ownerFence = sfBiOwnerFence(context)

  const remember = () => retainSfBiSelection(context, props.route.pathname, {
    viewId: store.viewId, start: store.start, end: store.end, choice: store.choice,
    baseRef: store.baseRef, candidateRef: store.candidateRef, currency: store.currency,
    focus: store.focus, requested: store.requested,
  })
  const clearResult = () => {
    activeController?.abort(); activeController = undefined; ticket++
    setStore({ data: undefined, links: undefined, detail: undefined, selectedSource: null,
      sourceState: "empty", readState: "ready", busy: false })
  }
  const revokeReads = () => {
    selectionEpoch++
    clearResult()
    setStore({ options: undefined, choice: "", baseRef: "", candidateRef: "", currency: "", focus: "", requested: false })
  }
  onCleanup(() => {
    // Keep only untrusted human input when this same F01 owner remains current.
    if (ownerFence && ownerFence === sfBiOwnerFence(context)) remember()
    disposed = true
    authorityController?.abort()
    revokeReads()
  })

  createEffect(() => {
    const expected = props.surfaceId === "UI46" ? props.route.params.viewId as ViewId : undefined
    if (expected && expected !== store.viewId) {
      revokeReads()
      setStore("viewId", expected)
    }
  })
  createEffect(() => {
    const next = sfBiOwnerFence(context)
    if (ownerFence === next) return
    ownerFence = next
    authorityController?.abort()
    clearSfBiRetention(context)
    revokeReads()
  })

  const ownerState = (): SfUiState => {
    const state = context.state()
    if (state.status === "denied") return "denied"
    if (state.status === "unauthenticated") return "session-expired"
    if (state.status === "resolving" || state.status === "choose-installation") return "loading"
    const ready = context.ready()
    if (state.status !== "ready" || !ready) return "unavailable"
    return ready.context.availability.some((entry) => entry.family === "bi" && entry.resource === "catalog" &&
      entry.operations.some((operation) => operation.operationId === "bi.bi-options" &&
        operation.state === "ready" && operation.operational)) ? "ready" : "unavailable"
  }
  const allowedData = () => context.ready()?.context.availability.some((entry) =>
    entry.family === "bi" && (entry.resource === "visual" || entry.resource === "catalog") &&
    entry.operations.some((operation) => operation.operationId === "bi.bi-data" &&
      operation.state === "ready" && operation.operational)) === true
  const pending = () => store.busy
  const changed = () => { revokeReads(); remember() }
  const selectionValid = () => Boolean(store.viewId &&
    /^\d{4}-\d{2}-\d{2}$/.test(store.start) && /^\d{4}-\d{2}-\d{2}$/.test(store.end) &&
    store.start <= store.end)
  const plannerChoice = () => store.choice === "planner" && !!store.viewId && isFinancial(store.viewId)
  const dataSelectionValid = () => !!store.options && (plannerChoice()
    ? !!store.baseRef && !!store.candidateRef && /^[A-Z]{3}$/.test(store.currency) &&
      store.options.versions.some((item) => item.ref === store.baseRef) &&
      store.options.versions.some((item) => item.ref === store.candidateRef)
    : !!store.choice && store.options.choices.some((item) => item.selectionRef === store.choice))
  const selectionChanged = () => {
    selectionEpoch++
    clearResult()
    setStore({ requested: false, focus: "" })
  }
  const prepareRead = () => {
    const ready = context.ready(), fence = sfBiOwnerFence(context)
    if (!ready || !fence || ownerState() !== "ready" || disposed) return
    activeController?.abort()
    const controller = new AbortController(), ownTicket = ++ticket
    activeController = controller
    return {
      client: createSfBiClient(ready.transport), controller,
      current: () => !disposed && !controller.signal.aborted && ticket === ownTicket &&
        context.ready()?.transport === ready.transport && sfBiOwnerFence(context) === fence,
    }
  }

  // Independent from BI reads: a delayed data response cannot stop the actual
  // context producer from detecting revocation. A successful probe does not
  // replace the owner or bless data from an earlier generation.
  const reauthorize = (): Promise<boolean> => {
    if (authorityPending) return authorityPending
    const state = context.state(), ready = context.ready(), fence = sfBiOwnerFence(context)
    if (state.status !== "ready" || !ready || !fence || disposed) return Promise.resolve(false)
    const controller = new AbortController()
    authorityController = controller
    const current = () => !disposed && !controller.signal.aborted &&
      context.ready()?.transport === ready.transport && sfBiOwnerFence(context) === fence
    const probe = (async () => {
      try {
        const result = await createSfContextClient(ready.transport)["ctx.context"]({
          installationId: state.binding.installationId, projectId: state.binding.projectId,
          hostId: state.binding.hostId,
        }, { signal: controller.signal })
        if (!current()) return false
        if (result.kind !== "response") {
          revokeReads(); setStore("readState", "unavailable"); return false
        }
        if (result.body.status === "denied" || result.body.status === "unauthenticated") {
          clearSfBiRetention(context)
          context.invalidate(result.body.status === "denied" ? "revoked" : "session-expired")
          return false
        }
        if (result.body.status !== "ok") {
          revokeReads(); setStore("readState", "unavailable"); return false
        }
        if (sfBiStampKey(result.body.value.stamp) !== sfBiStampKey(ready.context.stamp)) {
          clearSfBiRetention(context); context.invalidate("revoked"); return false
        }
        if (!result.body.value.availability.some((entry) => entry.family === "bi" &&
            entry.operations.some((operation) => operation.operationId === "bi.bi-options" &&
              operation.state === "ready" && operation.operational))) {
          revokeReads(); setStore("readState", "unavailable"); return false
        }
        return true
      } catch {
        if (current()) { revokeReads(); setStore("readState", "unavailable") }
        return false
      }
    })()
    authorityPending = probe
    void probe.finally(() => {
      if (authorityPending === probe) authorityPending = undefined
      if (authorityController === controller) authorityController = undefined
    })
    return probe
  }

  const chooseContext = async (preserve = false): Promise<boolean> => {
    if (!selectionValid() || !store.viewId) { setStore("readState", "invalid"); return false }
    if (!preserve) revokeReads()
    const request = prepareRead()
    if (!request) return false
    const viewId = store.viewId, start = store.start, end = store.end
    // Keep the last authorized options interactive while refreshing. A human
    // clear aborts this request and advances the selection epoch immediately.
    setStore({ busy: true, data: undefined, links: undefined, detail: undefined,
      selectedSource: null, sourceState: "empty", readState: store.options ? "ready" : "loading" })
    try {
      const output = await request.client["bi.bi-options"]({ viewId, start, end }, { signal: request.controller.signal })
      if (!request.current()) return false
      if (output.kind !== "response") { setStore("readState", "unavailable"); return false }
      if (output.body.status !== "ok") { setStore("readState", failureState(output.body.status)); return false }
      const options = output.body.value
      const selection = store.choice === "planner" && isFinancial(viewId) && options.versions.length > 0
        ? "planner" : options.choices.some((item) => item.selectionRef === store.choice) ? store.choice : ""
      setStore({ options, choice: selection,
        baseRef: options.versions.some((item) => item.ref === store.baseRef) ? store.baseRef : "",
        candidateRef: options.versions.some((item) => item.ref === store.candidateRef) ? store.candidateRef : "",
        readState: options.choices.length || options.versions.length ? "ready" : "filtered-empty" })
      if (!selection) setStore("requested", false)
      remember()
      return true
    } finally { if (request.current()) setStore("busy", false) }
  }

  const restoreFocus = () => {
    if (!store.focus || !store.data?.projection.values.some((value) => value.id === store.focus)) return
    const button = [...(root?.querySelectorAll<HTMLButtonElement>("button[data-sf-bi-focus]") ?? [])]
      .find((element) => element.dataset.sfBiFocus === store.focus)
    button?.focus()
  }
  const preview = async () => {
    if (!selectionValid() || !allowedData() || !dataSelectionValid() || !store.viewId) return
    const request = prepareRead()
    if (!request) return
    const viewId = store.viewId, start = store.start, end = store.end, selectionRef = store.choice
    const comparison = plannerChoice() ? {
      baseRef: store.baseRef, candidateRef: store.candidateRef, currency: store.currency,
    } : undefined
    setStore({ busy: true, data: undefined, links: undefined, detail: undefined, selectedSource: null,
      sourceState: "empty", readState: "ready", requested: true })
    remember()
    try {
      const output = comparison && isFinancial(viewId)
        ? await request.client["bi.bi-data"]({ viewId, start, end, ...comparison }, { signal: request.controller.signal })
        : await request.client["bi.bi-data"]({ viewId, start, end, selectionRef }, { signal: request.controller.signal })
      if (!request.current()) return
      if (output.kind !== "response") { setStore("readState", "unavailable"); return }
      const body = output.body
      if ("request" in body) {
        if (body.request.viewId !== viewId || body.request.period.start !== start ||
            body.request.period.end !== end || (!comparison && body.request.selectionRef !== selectionRef) ||
            (comparison && body.projection.context.currency !== comparison.currency)) {
          setStore("readState", "unavailable"); return
        }
        setStore({ data: body, readState: "ready" })
        remember()
        queueMicrotask(() => { if (request.current()) restoreFocus() })
      } else setStore("readState", failureState(body.status))
    } finally { if (request.current()) setStore("busy", false) }
  }

  const refresh = async (automatic = false) => {
    const epoch = selectionEpoch, requested = store.requested
    if (!await reauthorize() || disposed || epoch !== selectionEpoch) return
    // Still reauthorize while a result is held, without replacing its read.
    if (automatic && (store.busy || !requested)) return
    if (!selectionValid()) return
    if (await chooseContext(true) && epoch === selectionEpoch && requested && dataSelectionValid()) await preview()
  }
  if (typeof window !== "undefined") {
    const onFocus = () => { void refresh(true) }
    const timer = window.setInterval(() => { void refresh(true) }, 30_000)
    window.addEventListener("focus", onFocus)
    onCleanup(() => { window.clearInterval(timer); window.removeEventListener("focus", onFocus) })
  }
  if (retained && retained.viewId === initialView) {
    // Returning hints are untrusted until both current context and new options
    // admit exactly those references. No previous successful data is replayed.
    queueMicrotask(() => { void (async () => {
      const epoch = selectionEpoch
      if (!await reauthorize() || disposed || epoch !== selectionEpoch) return
      setStore({ choice: retained.choice, baseRef: retained.baseRef, candidateRef: retained.candidateRef,
        currency: retained.currency, focus: retained.focus, requested: retained.requested })
      if (await chooseContext(true) && epoch === selectionEpoch && retained.requested && dataSelectionValid()) await preview()
    })() })
  }

  const openSource = async (reference: SfRef) => {
    // A value's source is resolved only via its original valueId/digest and the
    // installed C08 bi-source producer. This cannot produce arbitrary URLs.
    const result = store.data
    if (!result || !allowedData()) return
    const focused = store.focus && result.projection.values.some((value) => value.id === store.focus) ? store.focus : undefined
    const matched = result.projection.values.filter((value) => !focused || value.id === focused).flatMap((value) =>
      [value.drilldown, ...value.sourceRefs].filter((source) => source?.refId === reference)
        .filter((source, index, all) => source && all.findIndex((item) => item?.refDigest === source.refDigest) === index)
        .map((source) => ({ value, source: source! })))
    if (matched.length !== 1) {
      setStore({ selectedSource: reference, links: undefined, sourceState: "invalid" })
      return
    }
    const request = prepareRead()
    if (!request) return
    // The producer echoes viewId as an open string; the closed BI catalog is the
    // only legal viewId space, and an off-catalog echo means this data is not
    // for any selectable view, so the source link cannot be resolved.
    const viewId = BI_CATALOG.some((item) => item.id === result.request.viewId)
      ? result.request.viewId as ViewId : undefined
    if (!viewId) {
      setStore({ selectedSource: reference, links: undefined, sourceState: "invalid" })
      return
    }
    setStore({ selectedSource: reference, links: undefined, sourceState: "loading", busy: true })
    try {
      const output = await request.client["bi.bi-source"]({
        viewId,
        selectionRef: result.request.selectionRef,
        valueId: matched[0]!.value.id,
        referenceDigest: matched[0]!.source.refDigest,
        start: result.request.period.start,
        end: result.request.period.end,
      }, { signal: request.controller.signal })
      if (!request.current()) return
      if (output.kind !== "response") { setStore("sourceState", "unavailable"); return }
      const body = output.body
      if ("links" in body) {
        setStore({ links: body.links, sourceState: body.links.length ? "ready" : "empty" })
      } else setStore("sourceState", failureState(body.status))
    } finally {
      if (request.current()) setStore("busy", false)
    }
  }

  const openDecision = async (target: SfRef) => {
    const result = store.data
    if (!result || !result.navigation || !result.request.selectionRef ||
        !["BI09", "BI10", "BI11"].includes(result.request.viewId) ||
        !result.navigation.entries.some((entry) => entry.token === target)) return
    const ready = context.ready()
    if (!ready?.context.availability.some((entry) => entry.operations.some((operation) =>
      operation.operationId === "bi.bi-decision" && operation.state === "ready" && operation.operational))) {
      setStore({ detail: undefined, sourceState: "unavailable" })
      return
    }
    const request = prepareRead()
    if (!request) return
    setStore({ selectedSource: target, links: undefined, detail: undefined, sourceState: "loading", busy: true })
    try {
      const output = await request.client["bi.bi-decision"]({
        viewId: result.request.viewId as "BI09" | "BI10" | "BI11",
        selectionRef: result.request.selectionRef, snapshot: result.navigation.snapshot, target,
        start: result.request.period.start, end: result.request.period.end,
      }, { signal: request.controller.signal })
      if (!request.current()) return
      if (output.kind !== "response") { setStore("sourceState", "unavailable"); return }
      if (output.body.status !== "ok") { setStore("sourceState", failureState(output.body.status)); return }
      setStore({ detail: output.body.value, sourceState: "ready" })
    } finally { if (request.current()) setStore("busy", false) }
  }

  const safeLinks = (links: ReadonlyArray<{ label: string; url: string }>) => {
    const state = context.state()
    if (state.status !== "ready" || !context.ready()) return []
    return links.flatMap((link) => {
      const href = nativeBiDestination(link.url, state.binding, state.selection)
      return href ? [{ label: link.label, href }] : []
    })
  }

  const choice = () => BI_CATALOG.find((entry) => entry.id === store.viewId)
  const safePreview = () => store.data && ownerState() === "ready" &&
    context.ready()?.context.stamp.accessRevision === store.data.projection.context.accessRevision
      ? store.data : undefined

  return (
    <SfPageFrame titleKey={sfBiKey(props.surfaceId === "UI46" ? "sf.ui46.title" : "sf.ui45.title")}
      context={[]} tabs={[]} activeTab={null} secondaryActions={[]}
      primaryAction={undefined} density="comfortable" layout="work"
      onLayoutMode={(mode) => setStore("layout", mode)}
    >
      <section ref={root} class="sf-bi-catalog" data-sf-catalog={props.surfaceId} data-sf-layout-mode={store.layout}
        onFocusIn={(event) => {
          const focus = event.target instanceof HTMLElement ? event.target.dataset.sfBiFocus : undefined
          if (focus && store.data?.projection.values.some((value) => value.id === focus)) {
            setStore("focus", focus); remember()
          }
        }}>
        <SfStatePanel state={ownerState()}
          messageKey={sfCommonKey(ownerState() === "denied" ? "sf.common.noAccess" : "sf.common.unavailable")}
          onRetryRead={() => { void context.reload() }}>
          <form class="sf-bi-catalog-form" onSubmit={(event) => { event.preventDefault(); void chooseContext() }}>
            <label>
              {t(sfBiKey("sf.u21.view"))}
              <select value={store.viewId} required disabled={pending() || props.surfaceId === "UI46"} data-sf-field="view"
                onChange={(event) => {
                  changed()
                  setStore("viewId", event.currentTarget.value as ViewId); remember()
                }}>
                <option value="">{t(sfBiKey("sf.u21.chooseView"))}</option>
                <For each={BI_CATALOG}>
                  {(entry) => <option value={entry.id}>{t(sfBiKey(entry.question))}</option>}
                </For>
              </select>
            </label>
            <label>
              {t(sfBiKey("sf.u21.start"))}
              <input type="date" required value={store.start} disabled={pending()}
                data-sf-field="start" onInput={(event) => { changed(); setStore("start", event.currentTarget.value); remember() }} />
            </label>
            <label>
              {t(sfBiKey("sf.u21.end"))}
              <input type="date" required value={store.end} disabled={pending()}
                data-sf-field="end" onInput={(event) => { changed(); setStore("end", event.currentTarget.value); remember() }} />
            </label>
            <button class="mx-btn primary" type="submit" data-sf-action="choose-context" disabled={!selectionValid() || pending()}>
              {t(sfBiKey("sf.ui45.primary"))}
            </button>
          </form>
          <button class="mx-btn" type="button" data-sf-action="refresh-data"
            disabled={!selectionValid() || pending()} onClick={() => { void refresh() }}>
            {t(sfBiKey("sf.u21.refresh"))}
          </button>
          <Show when={store.busy}><p role="status">{t(sfBiKey("sf.u21.readStatus"))}</p></Show>
          <Show when={safePreview() && !store.busy}><p role="status">{t(sfBiKey("sf.u21.updated"))}</p></Show>
          <Show when={store.options && !store.data && !store.busy}>
            <p role="status">{t(sfBiKey("sf.u21.selectionChanged"))}</p>
          </Show>
          <Show when={choice()}>
            {(entry) => <section class="sf-bi-question" aria-label={t(sfBiKey("sf.u21.question"))}>
              <h2>{t(sfBiKey(entry().question))}</h2>
              <p>{t(sfBiKey("sf.u21.family." + entry().family))}</p>
            </section>}
          </Show>
          <SfStatePanel state={store.readState}
            messageKey={sfBiKey(store.readState === "filtered-empty" ? "sf.u21.noChoices" : "sf.u21.readStatus")}
            onRetryRead={store.readState === "unavailable" ? () => { void chooseContext() } : undefined}>
            <Show when={store.options}>
              {(options) => <>
                <Show when={options().choices.length || options().versions.length && store.viewId && isFinancial(store.viewId)}>
                  <section>
                    <h2>{t(sfBiKey("sf.u21.authorizedChoices"))}</h2>
                    <label>{t(sfBiKey("sf.u21.selection"))}
                      <select value={store.choice} data-sf-field="selection"
                        onChange={(event) => {
                          selectionChanged()
                          setStore({ choice: event.currentTarget.value, baseRef: "", candidateRef: "", currency: "" })
                          remember()
                        }}>
                        {/* Recreated options must retain the current human choice even when its value did not change. */}
                        <option value="" selected={store.choice === ""}>{t(sfBiKey("sf.u21.chooseSelection"))}</option>
                        <Show when={store.viewId && isFinancial(store.viewId) && options().versions.length}>
                          <option value="planner" selected={store.choice === "planner"}>{t(sfBiKey("sf.u21.plannerComparison"))}</option>
                        </Show>
                        <For each={options().choices}>
                          {(item) => <option value={item.selectionRef} selected={store.choice === item.selectionRef}>{item.label}</option>}
                        </For>
                      </select>
                    </label>
                  </section>
                </Show>
                <Show when={plannerChoice()}>
                  <section><h2>{t(sfBiKey("sf.u21.versions"))}</h2>
                    <label>{t(sfBiKey("sf.u21.baseVersion"))}
                      <select value={store.baseRef} data-sf-field="base-version" onChange={(event) => {
                        selectionChanged(); setStore("baseRef", event.currentTarget.value); remember()
                      }}>
                        <option value="" selected={store.baseRef === ""}>{t(sfBiKey("sf.u21.chooseVersion"))}</option>
                        <For each={options().versions}>{(version) => <option value={version.ref} selected={store.baseRef === version.ref}>{version.label}</option>}</For>
                      </select>
                    </label>
                    <label>{t(sfBiKey("sf.u21.candidateVersion"))}
                      <select value={store.candidateRef} data-sf-field="candidate-version" onChange={(event) => {
                        selectionChanged(); setStore("candidateRef", event.currentTarget.value); remember()
                      }}>
                        <option value="" selected={store.candidateRef === ""}>{t(sfBiKey("sf.u21.chooseVersion"))}</option>
                        <For each={options().versions}>{(version) => <option value={version.ref} selected={store.candidateRef === version.ref}>{version.label}</option>}</For>
                      </select>
                    </label>
                    <label>{t(sfBiKey("sf.u21.comparisonCurrency"))}
                      <input value={store.currency} data-sf-field="currency" pattern="[A-Z]{3}" maxLength={3}
                        onInput={(event) => { selectionChanged(); setStore("currency", event.currentTarget.value); remember() }} />
                    </label>
                  </section>
                </Show>
                <Show when={options().links.length}>
                  <section><h2>{t(sfBiKey("sf.u21.producerPages"))}</h2>
                    <ul><For each={options().links}>
                      {(link) => <li>{link.label} — {link.surface}: {link.page}</li>}
                    </For></ul>
                  </section>
                </Show>
                <Show when={options().limitations.length}>
                  <section><h2>{t(sfBiKey("sf.u21.limitations"))}</h2>
                    <ul><For each={options().limitations}>{(note) => <li>{note}</li>}</For></ul>
                  </section>
                </Show>
                <Show when={store.viewId}>
                  <button class="mx-btn primary" type="button" data-sf-action="view-data"
                    disabled={pending() || !allowedData() || !dataSelectionValid()} onClick={() => { void preview() }}>
                    {t(sfBiKey("sf.ui46.primary"))}
                  </button>
                </Show>
              </>}
            </Show>
            <Show when={safePreview()}>
              {(data) => <>
                <Show when={store.viewId && isFinancial(store.viewId as ViewId)}>
                  <SfFinancialFigure viewId={store.viewId as SfBiFinancialView}
                    projection={data()} selection={store.selectedSource}
                    onSelect={(ref) => setStore("selectedSource", ref)}
                    onOpenSource={(ref) => { void openSource(ref) }} />
                </Show>
                <Show when={store.viewId && isOperational(store.viewId as ViewId)}>
                  <SfOperationalFigure viewId={store.viewId as SfBiOperationalView}
                    projection={data()} selection={store.selectedSource}
                    onSelect={(ref) => setStore("selectedSource", ref)}
                    onOpenSource={(ref) => { void openSource(ref) }} />
                </Show>
                <Show when={store.viewId === "BI09" || store.viewId === "BI10" || store.viewId === "BI11"}>
                  <SfDecisionFigure viewId={store.viewId as "BI09" | "BI10" | "BI11"}
                    projection={data()} selection={store.selectedSource}
                    onSelect={(ref) => { void openDecision(ref) }}
                    onOpenSource={(ref) => { void openDecision(ref) }} />
                </Show>
                <Show when={store.detail}>
                  {(detail) => <section><h2>{detail().title}</h2><p>{detail().reference}</p>
                    <dl><For each={detail().facts}>{(fact) => <><dt>{fact.label}</dt><dd>{fact.value}</dd></>}</For></dl>
                    <For each={detail().tables}>{(table) => <section><h3>{table.title}</h3><table>
                      <thead><tr><For each={table.columns}>{(column) => <th>{column}</th>}</For></tr></thead>
                      <tbody><For each={table.rows}>{(row) => <tr><For each={row}>{(cell) => <td>{cell}</td>}</For></tr>}</For></tbody>
                    </table></section>}</For>
                    <ul><For each={safeLinks(detail().links)}>{(link) => <li><a href={link.href} onClick={remember}>{link.label}</a></li>}</For></ul>
                  </section>}
                </Show>
                <Show when={store.viewId !== "BI09" && store.viewId !== "BI10" && store.viewId !== "BI11" ? store.selectedSource : null}>
                  {(ref) => <div class="sf-bi-selected-source">
                    <button class="mx-btn" type="button" onClick={() => { void openSource(ref()) }}>
                      {t(sfBiKey("sf.u21.resolveSource"))}
                    </button>
                  </div>}
                </Show>
                <SfStatePanel state={store.sourceState}
                  messageKey={sfBiKey("sf.u21.sourceStatus")}>
                  <Show when={store.links}>
                    {(links) => <nav aria-label={t(sfBiKey("sf.u21.sourceLinks"))}>
                      <ul><For each={safeLinks(links())}>
                        {(link) => <li><a href={link.href} onClick={remember}>
                          {link.label}</a></li>}
                      </For></ul>
                    </nav>}
                  </Show>
                </SfStatePanel>
              </>}
            </Show>
          </SfStatePanel>
        </SfStatePanel>
      </section>
    </SfPageFrame>
  )
}
