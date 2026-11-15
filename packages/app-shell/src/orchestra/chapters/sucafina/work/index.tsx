import { A } from "@solidjs/router"
import { For, Show, createEffect, createMemo, createSignal, on, onCleanup } from "solid-js"
import { useLanguage } from "@/context/language"
import { SF_U41_COPY } from "@/i18n/orchestra-chapters/sf-u41"
import { createSfWorkClient } from "@orchestra/client/sucafina/work"
import { createSfCollaborationClient } from "@orchestra/client/sucafina/collaboration"
import { SfCollaboration } from "@orchestra/schema/sucafina/collaboration"
import type { SfRef } from "@orchestra/schema/sucafina/context"
import { useSfContext } from "../context"
import type { SfSurfaceProps } from "../context/contracts"
import { encodeSfRouteRef } from "../navigation-state"
import { SfPageFrame } from "../shared/frame"
import { SfStatePanel } from "../shared/states"
import { SfDataTable, type SfColumn, type SfSort, type SfUiState } from "../shared/table"
import "./work.css"

type Listed = Extract<typeof SfCollaboration.operations["collaboration.work-list"]["output"]["Type"], { status: "ok" }>["value"]
type WorkItem = Listed["items"][number]
type Selection = Readonly<{ selectionRef: string; period: Readonly<{ start: string; end: string }> }>
type Details = Readonly<{ item: WorkItem; details: readonly Readonly<{ label: string; value: string }>[]; links: readonly Readonly<{ label: string; url: string }>[] }>
type Snapshot = Readonly<{ generation: number; ownerKey: string; accessRevision: string; transport: NonNullable<ReturnType<ReturnType<typeof useSfContext>["ready"]>>["transport"]; publicOrigin: string; mount: string }>

/** U41 only reads the two real product projections. It never creates a task or infers an owner. */
function resultState(result: { kind: string; status?: number; reason?: string; body?: unknown }): SfUiState {
  if (result.kind === "transport-error") {
    return result.reason === "outcome-unknown" ? "outcome-unknown" : "unavailable"
  }
  if (result.status === 401) return "session-expired"
  if (result.status === 403) return "denied"
  const status = (result.body as { status?: string } | undefined)?.status
  if (status === "denied") return "denied"
  if (status === "stale") return "stale"
  if (status === "conflict") return "conflict"
  if (status === "invalid" || status === "needs-input") return "invalid"
  return "unavailable"
}
const dateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
function safeSourceHref(raw: string, publicOrigin: string, mount: string): string | undefined {
  // Desktop is oc://renderer: a remote producer URL cannot become a renderer navigation.
  if (typeof window === "undefined" || window.location.origin !== publicOrigin || !raw || raw.startsWith("//")) return undefined
  try {
    const url = new URL(raw, publicOrigin)
    if (url.origin !== publicOrigin || url.username || url.password || url.hash) return undefined
    if (url.pathname !== mount && !url.pathname.startsWith(mount + "/") && !url.pathname.startsWith("/orchestra/")) return undefined
    return url.pathname + url.search
  } catch { return undefined }
}
function nextNativeRoute(item: WorkItem): string | undefined {
  const destination = item.destination
  if (destination?.kind !== "thread") return undefined
  return "/orchestra/sf-work/threads/" + encodeSfRouteRef(destination.threadId)
}

export function SfWorkView(_props: SfSurfaceProps<"UI30">) {
  const owner = useSfContext()
  const language = useLanguage()
  type Copy = keyof typeof SF_U41_COPY | "sf.common.loading" | "sf.common.empty" |
    "sf.common.filterEmpty" | "sf.common.unavailable" | "sf.common.noAccess" |
    "sf.common.invalidLink" | "sf.common.loginAgain" | "sf.common.stale" |
    "sf.common.conflict" | "sf.common.operationUnknown" | "sf.common.partial"
  type Key = Parameters<typeof SfPageFrame>[0]["titleKey"]
  const key = (copy: Copy): Key => copy as Key
  const t = (copy: Copy) => language.t(copy as Parameters<typeof language.t>[0])
  const [start, setStart] = createSignal("")
  const [end, setEnd] = createSignal("")
  const [filter, setFilter] = createSignal("")
  const [sort, setSort] = createSignal<SfSort>({ kind: "none" })
  const [selection, setSelection] = createSignal<Selection>()
  const [items, setItems] = createSignal<readonly WorkItem[]>()
  const [selectedRef, setSelectedRef] = createSignal<string>()
  const [details, setDetails] = createSignal<Details>()
  const [destination, setDestination] = createSignal<string>()
  const [state, setState] = createSignal<SfUiState>("ready")
  const [detailState, setDetailState] = createSignal<SfUiState>("ready")
  let listAbort: AbortController | undefined
  let detailAbort: AbortController | undefined
  let destinationAbort: AbortController | undefined

  const snapshot = (): Snapshot | undefined => {
    const current = owner.state()
    const active = owner.ready()
    if (current.status !== "ready" || !active) return undefined
    return {
      generation: owner.generation(), ownerKey: current.ownerKey,
      accessRevision: current.context.stamp.accessRevision,
      transport: active.transport, publicOrigin: current.binding.publicOrigin, mount: current.binding.mount,
    }
  }
  const current = (source: Snapshot, signal: AbortSignal) => {
    const now = snapshot()
    return !signal.aborted && !!now && source.generation === now.generation &&
      source.ownerKey === now.ownerKey && source.accessRevision === now.accessRevision &&
      source.transport === now.transport
  }
  // Abort and erase every private read, including detail and links, on owner/access change.
  createEffect(on(() => {
    const current = owner.state()
    return current.status === "ready"
      ? String(current.ownerKey) + "|" + current.context.stamp.accessRevision + "|" + owner.generation()
      : current.status + "|" + owner.generation()
  }, () => {
    listAbort?.abort(); detailAbort?.abort(); destinationAbort?.abort()
    setItems(undefined); setSelection(undefined); setSelectedRef(undefined)
    setDetails(undefined); setDestination(undefined)
    setState("ready"); setDetailState("ready")
    setStart(""); setEnd(""); setFilter(""); setSort({ kind: "none" })
  }))
  onCleanup(() => { listAbort?.abort(); detailAbort?.abort(); destinationAbort?.abort() })

  const contextState = (): SfUiState => {
    const status = owner.state().status
    if (status === "denied") return "denied"
    if (status === "unauthenticated") return "session-expired"
    if (status === "context-mismatch") return "invalid"
    return status === "ready" ? state() : status === "resolving" ? "loading" : "unavailable"
  }
  const stateKey = (value: SfUiState): Copy => {
    switch (value) {
      case "loading": return "sf.common.loading"
      case "empty": return "sf.common.empty"
      case "filtered-empty": return "sf.common.filterEmpty"
      case "denied": return "sf.common.noAccess"
      case "session-expired": return "sf.common.loginAgain"
      case "invalid": return "sf.common.invalidLink"
      case "stale": return "sf.common.stale"
      case "conflict": return "sf.common.conflict"
      case "outcome-unknown": return "sf.common.operationUnknown"
      case "partial": return "sf.common.partial"
      default: return "sf.common.unavailable"
    }
  }
  const loadWork = async () => {
    const s = snapshot()
    if (!s) return
    listAbort?.abort(); detailAbort?.abort(); destinationAbort?.abort()
    const abort = new AbortController()
    listAbort = abort
    setSelection(undefined); setItems(undefined); setSelectedRef(undefined)
    setDetails(undefined); setDestination(undefined)
    if (!dateOnly(start()) || !dateOnly(end()) || start() > end()) { setState("invalid"); return }
    setState("loading")
    const work = createSfWorkClient(s.transport)
    const collaboration = createSfCollaborationClient(s.transport)
    try {
      // Selection is obtained only from the admitted source for an explicit period;
      // never derive a principal/selectionRef from a title or URL.
      const chosen = await work["projection.work-selection"]({ start: start(), end: end() }, { signal: abort.signal })
      if (!current(s, abort.signal)) return
      if (chosen.kind !== "response" || chosen.body.status !== "ok") {
        setState(resultState(chosen)); return
      }
      const selected = { selectionRef: chosen.body.value.selectionRef, period: chosen.body.value.period }
      if (!selected.selectionRef || selected.period.start !== start() || selected.period.end !== end()) {
        setState("invalid"); return
      }
      const list = await collaboration["collaboration.work-list"](selected, { signal: abort.signal })
      if (!current(s, abort.signal)) return
      if (list.kind !== "response" || list.body.status !== "ok") {
        setState(resultState(list)); return
      }
      setSelection(selected)
      setItems(list.body.value.items)
      setState(list.body.value.items.length ? "ready" : "empty")
    } catch {
      if (current(s, abort.signal)) setState("unavailable")
    }
  }
  const selectWork = async (actionRef: string) => {
    const s = snapshot(), selected = selection()
    if (!s || !selected || !items()?.some((item) => item.actionRef === actionRef)) return
    detailAbort?.abort(); destinationAbort?.abort()
    const abort = new AbortController()
    detailAbort = abort
    setSelectedRef(actionRef); setDetails(undefined); setDestination(undefined); setDetailState("loading")
    try {
      const work = createSfWorkClient(s.transport)
      const result = await work["projection.work-item"]({
        selectionRef: selected.selectionRef, actionRef,
        start: selected.period.start, end: selected.period.end,
      }, { signal: abort.signal })
      if (!current(s, abort.signal) || selection() !== selected || selectedRef() !== actionRef) return
      if (result.kind !== "response" || result.body.status !== "ok") { setDetailState(resultState(result)); return }
      if (result.body.value.item.actionRef !== actionRef) { setDetailState("invalid"); return }
      // Work-item output is the producer's currently authorized selection, not HTML parsing.
      setDetails(result.body.value)
      setDetailState("ready")
    } catch {
      if (current(s, abort.signal)) setDetailState("unavailable")
    }
  }
  const readDestination = async () => {
    const s = snapshot(), selected = selection(), actionRef = selectedRef()
    if (!s || !selected || !actionRef || detailState() !== "ready") return
    destinationAbort?.abort()
    const abort = new AbortController()
    destinationAbort = abort
    setDestination(undefined)
    const result = await createSfCollaborationClient(s.transport)["collaboration.work-destination"](
      { selection: selected, actionRef }, { signal: abort.signal },
    ).catch(() => undefined)
    if (!result || !current(s, abort.signal) || selection() !== selected || selectedRef() !== actionRef) return
    if (result.kind !== "response" || result.body.status !== "ok") {
      setDetailState(resultState(result)); return
    }
    const internal = safeSourceHref(result.body.value.href, s.publicOrigin, s.mount)
    if (internal) setDestination(internal)
    else setDetailState("partial") // desktop/unsupported origin: keep details, do not navigate off-owner.
  }

  const visible = createMemo(() => {
    const q = filter().trim().toLocaleLowerCase()
    const source = items() ?? []
    const matched = q ? source.filter((row) =>
      [row.title ?? "", row.kind, row.state, row.ownerLabel ?? "", row.reason ?? "", row.actionRef]
        .some((value) => value.toLocaleLowerCase().includes(q))) : [...source]
    const sorting = sort()
    if (sorting.kind !== "field") return matched
    const value = (row: WorkItem) =>
      sorting.key === "state" ? row.state : sorting.key === "due" ? row.due ?? "" : row.title ?? ""
    return [...matched].sort((a, b) =>
      (sorting.direction === "asc" ? 1 : -1) * value(a).localeCompare(value(b)))
  })
  const tableState = createMemo<SfUiState>(() =>
    state() === "ready" && items() && visible().length === 0 ? "filtered-empty" : state())
  const columns: readonly SfColumn<WorkItem>[] = [
    { id: "title", labelKey: key("sf.u41.action"), align: "start",
      widthPolicy: { kind: "flex", minPx: 210, weight: 3 }, sortKey: "title",
      render: (row) => <span class="sf-work-action">{row.title ?? t("sf.common.unavailable")}</span> },
    { id: "kind", labelKey: key("sf.u41.kind"), align: "start",
      widthPolicy: { kind: "content", minPx: 100, maxPx: 170 },
      render: (row) => <span>{row.kind}</span> },
    { id: "state", labelKey: key("sf.u41.state"), align: "start",
      widthPolicy: { kind: "content", minPx: 90, maxPx: 165 }, sortKey: "state",
      render: (row) => <span>{row.state}</span> },
    { id: "owner", labelKey: key("sf.u41.owner"), align: "start",
      widthPolicy: { kind: "flex", minPx: 130, weight: 2 },
      render: (row) => <span>{row.ownerLabel ?? row.ownerRef}</span> },
    { id: "due", labelKey: key("sf.u41.due"), align: "start",
      widthPolicy: { kind: "content", minPx: 100, maxPx: 145 }, sortKey: "due",
      render: (row) => <span>{row.due ?? "—"}</span> },
  ]
  return (
    <SfPageFrame
      titleKey={key("sf.ui30.title")}
      subtitleKey={key("sf.u41.subtitle")}
      context={[]}
      tabs={[]}
      activeTab={null}
      density="comfortable"
      layout="work"
      secondaryActions={[]}
      onLayoutMode={() => undefined}
      primaryAction={state() === "ready" && !!items()?.length ? {
        id: "open-next", labelKey: key("sf.ui30.primary"), tone: "primary", disabled: false,
        busy: detailState() === "loading", onInvoke: () => { const next = selectedRef() ?? items()?.[0]?.actionRef; if (next) void selectWork(next) },
      } : undefined}
    >
      <section class="sf-work" data-sf-surface="UI30">
        <Show when={owner.state().status === "ready"}>
          <form class="sf-work-filters" data-sf-work-period onSubmit={(event) => { event.preventDefault(); void loadWork() }}>
            <label>{t("sf.u41.start")}
              <input type="date" data-sf-work-start required value={start()} onInput={(event) => setStart(event.currentTarget.value)} />
            </label>
            <label>{t("sf.u41.end")}
              <input type="date" data-sf-work-end required value={end()} onInput={(event) => setEnd(event.currentTarget.value)} />
            </label>
            <button type="submit" class="mx-btn primary" disabled={state() === "loading"}>{t("sf.u41.load")}</button>
          </form>
        </Show>
        <SfStatePanel
          state={contextState()}
          messageKey={key(stateKey(contextState()))}
          onRetryRead={start() && end() ? () => void loadWork() : undefined}
        >
          <Show when={selection()} fallback={<p class="sf-work-help">{t("sf.u41.choosePeriod")}</p>}>
            {(selected) => (
              <div class="sf-work-main">
                <div class="sf-work-list">
                  <p class="sf-work-scope">{t("sf.u41.selection")}: {selected().selectionRef}</p>
                  <label class="sf-work-search">{t("sf.u41.filter")}
                    <input type="search" data-sf-work-filter value={filter()} onInput={(event) => setFilter(event.currentTarget.value)} />
                  </label>
                  <Show when={tableState() === "filtered-empty"}>
                    <p role="status">{t("sf.common.filterEmpty")}</p>
                  </Show>
                  <SfDataTable<WorkItem>
                    rows={visible()}
                    getRowKey={(row) => row.actionRef as SfRef}
                    columns={columns}
                    selectedKey={selectedRef() as SfRef | undefined}
                    sort={sort()}
                    page={{ kind: "none", total: visible().length }}
                    onSort={setSort}
                    onPage={() => undefined}
                    onSelect={(ref) => void selectWork(ref)}
                    rowActions={() => [{ id: "details", labelKey: key("sf.u41.details"), tone: "secondary", disabled: false, busy: false }]}
                    onRowAction={(request) => void selectWork(request.recordRef)}
                    captionKey={key("sf.u41.table")}
                    density="comfortable"
                    state={tableState()}
                  />
                </div>
                <Show when={selectedRef()}>
                  {(actionRef) => (
                    <section class="sf-work-detail" aria-label={t("sf.u41.details")} data-sf-work-detail>
                      <SfStatePanel state={detailState()} messageKey={key(stateKey(detailState()))}
                        onRetryRead={() => void selectWork(actionRef())}>
                        <Show when={details()}>
                          {(view) => (
                            <>
                              <h2>{view().item.title ?? t("sf.common.unavailable")}</h2>
                              <dl>
                                <div><dt>{t("sf.u41.owner")}</dt><dd>{view().item.ownerLabel ?? view().item.ownerRef}</dd></div>
                                <div><dt>{t("sf.u41.state")}</dt><dd>{view().item.state}</dd></div>
                                <Show when={view().item.sourceVersion !== undefined}>
                                  <div><dt>{t("sf.u41.sourceVersion")}</dt><dd>{view().item.sourceVersion}</dd></div>
                                </Show>
                                <Show when={view().item.observedVersion !== undefined}>
                                  <div><dt>{t("sf.u41.observedVersion")}</dt><dd>{view().item.observedVersion}</dd></div>
                                </Show>
                                <For each={view().details}>{(field) => <div><dt>{field.label}</dt><dd>{field.value}</dd></div>}</For>
                              </dl>
                              <div class="sf-work-links">
                                <Show when={nextNativeRoute(view().item)}>
                                  {(href) => <A href={href()} class="mx-btn primary">{t("sf.u41.openThread")}</A>}
                                </Show>
                                <For each={view().links}>
                                  {(link) => <Show when={safeSourceHref(link.url, snapshot()?.publicOrigin ?? "", snapshot()?.mount ?? "")}>
                                    {(href) => <A href={href()}>{link.label}</A>}
                                  </Show>}
                                </For>
                                <button class="mx-btn" type="button" onClick={() => void readDestination()}>
                                  {t("sf.u41.checkDestination")}
                                </button>
                                <Show when={destination()}>{(href) => <A href={href()}>{t("sf.u41.openSource")}</A>}</Show>
                              </div>
                            </>
                          )}
                        </Show>
                      </SfStatePanel>
                    </section>
                  )}
                </Show>
              </div>
            )}
          </Show>
        </SfStatePanel>
      </section>
    </SfPageFrame>
  )
}
