import { For, Show, createEffect, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { useSfContext } from "../../context"
import type { SfSurfaceProps } from "../../context/contracts"
import type { SfRef } from "@orchestra/schema/sucafina/context"
import type {
  SfBiBiOptionsOutput, SfBiBiSourceOutput, SfBiBiDataOutput,
} from "@orchestra/schema/sucafina/bi"
import { createSfBiClient } from "@orchestra/client/sucafina/bi"
import { SfPageFrame } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import type { SfUiState } from "../../shared/frame"
import { useSfPresentation, sfCommonKey } from "../../shared/frame/presentation"
import { SfFinancialFigure } from "../finance"
import { SfOperationalFigure } from "../operations"
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
type CatalogData = Extract<SfBiBiDataOutput, { request: unknown }>

type CatalogStore = {
  viewId: ViewId | ""
  start: string
  end: string
  choice: string
  options: Options | undefined
  data: CatalogData | undefined
  selectedSource: SfRef | null
  links: SourceLinks | undefined
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
export function SfBiCatalog(_props: SfSurfaceProps<"UI45">) {
  const context = useSfContext()
  const { t } = useSfPresentation()
  const [store, setStore] = createStore<CatalogStore>({
    viewId: "", start: "", end: "", choice: "",
    options: undefined, data: undefined, links: undefined, selectedSource: null,
    sourceState: "empty", readState: "ready", busy: false, layout: "single",
  })
  let activeController: AbortController | undefined
  let ticket = 0

  const revokeReads = () => {
    activeController?.abort()
    activeController = undefined
    ticket++
    setStore({ options: undefined, data: undefined, links: undefined,
      selectedSource: null, sourceState: "empty", readState: "ready", busy: false, choice: "" })
  }
  onCleanup(revokeReads)

  // Owner generation/accessRevision is the read fence; old projections never
  // survive a context switch or arrive late after a re-authenticated owner.
  let lastFence: string | undefined
  createEffect(() => {
    const state = context.state()
    const current = context.ready()
    const fence = String(context.generation()) + ":" + state.status +
      ":" + (current?.context.stamp.accessRevision ?? "") +
      ":" + (current?.context.stamp.principalRef ?? "")
    if (lastFence !== undefined && lastFence !== fence) revokeReads()
    lastFence = fence
  })

  const ownerState = (): SfUiState => {
    const state = context.state()
    if (state.status === "denied") return "denied"
    if (state.status === "unauthenticated") return "session-expired"
    if (state.status === "resolving" || state.status === "choose-installation") return "loading"
    if (state.status !== "ready") return "unavailable"
    const availability = state.context.availability.find((entry) =>
      entry.family === "bi" && entry.resource === "catalog")
    const operation = availability?.operations.find((entry) => entry.operationId === "bi.bi-options")
    if (operation?.state === "denied") return "denied"
    return operation?.state === "ready" ? "ready" : "unavailable"
  }
  const allowedData = () => {
    const ready = context.ready()
    if (!ready) return false
    return ready.context.availability.some((entry) =>
      entry.family === "bi" && (entry.resource === "visual" || entry.resource === "catalog") &&
      entry.operations.some((op) => op.operationId === "bi.bi-data" && op.state === "ready"))
  }
  const pending = () => store.busy
  const changed = () => {
    revokeReads()
  }
  const selectionValid = () => store.viewId !== "" &&
    /^\d{4}-\d{2}-\d{2}$/.test(store.start) &&
    /^\d{4}-\d{2}-\d{2}$/.test(store.end) && store.start <= store.end

  // Each explicit read gets its own AbortSignal and authority-generation fence.
  const prepareRead = () => {
    const ready = context.ready()
    if (ownerState() !== "ready" || !ready) return undefined
    activeController?.abort()
    const controller = new AbortController()
    activeController = controller
    const requestId = ++ticket
    const generation = context.generation()
    const stamp = ready.context.stamp
    return { client: createSfBiClient(ready.transport), controller,
      current: () => !controller.signal.aborted && ticket === requestId &&
        context.generation() === generation &&
        context.ready()?.context.stamp.accessRevision === stamp.accessRevision &&
        context.ready()?.context.stamp.principalRef === stamp.principalRef &&
        context.ready()?.context.stamp.hostId === stamp.hostId,
    }
  }

  const chooseContext = async () => {
    if (!selectionValid()) { setStore("readState", "invalid"); return }
    revokeReads()
    const request = prepareRead()
    if (!request) return
    const viewId = store.viewId as ViewId
    const start = store.start, end = store.end
    setStore({ busy: true, readState: "loading" })
    try {
      const output = await request.client["bi.bi-options"]({ viewId, start, end }, { signal: request.controller.signal })
      if (!request.current()) return
      if (output.kind !== "response") {
        setStore("readState", "unavailable")
        return
      }
      const body = output.body
      if (body.status !== "ok") {
        setStore("readState", failureState(body.status))
        return
      }
      setStore("options", body.value)
      setStore("readState", body.value.choices.length ? "ready" : "filtered-empty")
    } finally {
      if (request.current()) setStore("busy", false)
    }
  }

  const preview = async () => {
    if (!selectionValid() || !allowedData() || !store.options || !store.viewId ||
        (!isFinancial(store.viewId) && !isOperational(store.viewId))) return
    // A choice is an exact producer-issued selectionRef; no derivation from labels.
    if (store.choice && !store.options.choices.some((choice) => choice.selectionRef === store.choice)) return
    const request = prepareRead()
    if (!request) return
    const viewId = store.viewId
    const start = store.start, end = store.end, selectionRef = store.choice
    setStore({ busy: true, data: undefined, links: undefined, selectedSource: null,
      sourceState: "empty", readState: "loading" })
    try {
      const output = await request.client["bi.bi-data"]({
        viewId, start, end, ...(selectionRef ? { selectionRef } : {}),
      }, { signal: request.controller.signal })
      if (!request.current()) return
      if (output.kind !== "response") { setStore("readState", "unavailable"); return }
      const body = output.body
      if ("request" in body) {
        if (body.request.viewId !== viewId || body.request.period.start !== start ||
            body.request.period.end !== end || (selectionRef && body.request.selectionRef !== selectionRef)) {
          setStore("readState", "unavailable")
          return
        }
        setStore({ data: body, readState: "ready" })
      } else setStore("readState", failureState(body.status))
    } finally {
      if (request.current()) setStore("busy", false)
    }
  }

  const openSource = async (reference: SfRef) => {
    // A value's source is resolved only via its original valueId/digest and the
    // installed C08 bi-source producer. This cannot produce arbitrary URLs.
    const result = store.data
    if (!result || !allowedData()) return
    const matched = result.projection.values.flatMap((value) =>
      [value.drilldown, ...value.sourceRefs].filter((source) => source?.refId === reference)
        .filter((source, index, all) => source && all.findIndex((item) => item?.refDigest === source.refDigest) === index)
        .map((source) => ({ value, source: source! })))
    if (matched.length !== 1) {
      setStore({ selectedSource: reference, links: undefined, sourceState: "invalid" })
      return
    }
    const request = prepareRead()
    if (!request) return
    setStore({ selectedSource: reference, links: undefined, sourceState: "loading", busy: true })
    try {
      const output = await request.client["bi.bi-source"]({
        viewId: result.request.viewId,
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

  const choice = () => BI_CATALOG.find((entry) => entry.id === store.viewId)
  const safePreview = () => store.data && ownerState() === "ready" &&
    context.ready()?.context.stamp.accessRevision === store.data.projection.context.accessRevision
      ? store.data : undefined

  return (
    <SfPageFrame titleKey={sfBiKey("sf.ui45.title")}
      context={[]} tabs={[]} activeTab={null} secondaryActions={[]}
      primaryAction={undefined} density="comfortable" layout="work"
      onLayoutMode={(mode) => setStore("layout", mode)}
    >
      <section class="sf-bi-catalog" data-sf-catalog="UI45" data-sf-layout-mode={store.layout}>
        <SfStatePanel state={ownerState()}
          messageKey={sfCommonKey(ownerState() === "denied" ? "sf.common.denied" : "sf.common.unavailable")}
          onRetryRead={() => { void context.reload() }}>
          <form class="sf-bi-catalog-form" onSubmit={(event) => { event.preventDefault(); void chooseContext() }}>
            <label>
              {t(sfBiKey("sf.u21.view"))}
              <select value={store.viewId} required disabled={pending()} data-sf-field="view"
                onChange={(event) => {
                  changed()
                  setStore("viewId", event.currentTarget.value as ViewId)
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
                data-sf-field="start" onInput={(event) => { changed(); setStore("start", event.currentTarget.value) }} />
            </label>
            <label>
              {t(sfBiKey("sf.u21.end"))}
              <input type="date" required value={store.end} disabled={pending()}
                data-sf-field="end" onInput={(event) => { changed(); setStore("end", event.currentTarget.value) }} />
            </label>
            <button class="mx-btn primary" type="submit" disabled={!selectionValid() || pending()}>
              {t(sfBiKey("sf.ui45.primary"))}
            </button>
          </form>
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
                <Show when={options().choices.length}>
                  <section>
                    <h2>{t(sfBiKey("sf.u21.authorizedChoices"))}</h2>
                    <label>{t(sfBiKey("sf.u21.selection"))}
                      <select value={store.choice} disabled={pending()} data-sf-field="selection"
                        onChange={(event) => {
                          activeController?.abort(); ticket++
                          setStore({ choice: event.currentTarget.value, data: undefined,
                            links: undefined, selectedSource: null, sourceState: "empty" })
                        }}>
                        <option value="">{t(sfBiKey("sf.u21.chooseSelection"))}</option>
                        <For each={options().choices}>
                          {(item) => <option value={item.selectionRef}>{item.label}</option>}
                        </For>
                      </select>
                    </label>
                  </section>
                </Show>
                <Show when={options().versions.length}>
                  <section><h2>{t(sfBiKey("sf.u21.versions"))}</h2>
                    <ul><For each={options().versions}>
                      {(version) => <li>{version.label} ({version.year})</li>}
                    </For></ul>
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
                <Show when={store.viewId && (isFinancial(store.viewId as ViewId) || isOperational(store.viewId as ViewId))}>
                  <button class="mx-btn primary" type="button" data-sf-action="view-data"
                    disabled={pending() || !allowedData()} onClick={() => { void preview() }}>
                    {t(sfBiKey("sf.ui46.primary"))}
                  </button>
                </Show>
                <Show when={store.viewId && !(isFinancial(store.viewId as ViewId) || isOperational(store.viewId as ViewId))}>
                  <p role="status">{t(sfBiKey("sf.u21.decisionRenderer"))}</p>
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
                <Show when={store.selectedSource}>
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
                      <ul><For each={links()}>
                        {(link) => <li><a href={link.url} target="_blank" rel="noopener noreferrer">
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
