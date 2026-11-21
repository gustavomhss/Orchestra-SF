import { For, Show, createEffect, createMemo, createSignal } from "solid-js"
import { createStore } from "solid-js/store"
import type { JSX } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { Icon } from "@orchestra/ui/icon"
import { createSfPeopleClient } from "@orchestra/client/sucafina/people"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfOperationRef, SfRef } from "@orchestra/schema/sucafina/context"
import type { SfSurfaceProps } from "../../context/contracts"
import { encodeSfRouteRef } from "../../navigation-state"
import { SfPageFrame } from "../../shared/frame"
import { SfExecutiveAction, SfExecutiveRelatedLinks } from "../../cross-links/view"
import { SfStatePanel } from "../../shared/states"
import { SfChangeReview } from "../../shared/change-review"
import { SF_STATE_FALLBACK_KEY, sfCommonKey, useSfPresentation } from "../../shared/frame/presentation"
import type { SfCopyKey } from "../../shared/frame/types"
import { SF_U38_COPY, SF_U38_COPY_BR } from "@/i18n/orchestra-chapters/sf-u38"
import { SfHotTopicEditor } from "./edit"
import { useHotTopicsSource } from "./reader"
import type { Topic, TopicStatus } from "./reader"
import "./u38.css"
import "./topics.css"
import "../../shared/wave-one.css"

type Key = keyof typeof SF_U38_COPY
const key = (value: Key): SfCopyKey => value as SfCopyKey
const statuses: readonly TopicStatus[] = ["", "open", "progress", "blocked", "done"]

/** Uses F01's original-ref codec and the frozen CAP02 manifest path. I00 remains
 * responsible for routing, grants and resolving the chosen owner. */
function topicPath(props: SfSurfaceProps<"CAP02">, view: "list" | "new" | "detail" | "edit", id?: string): string {
  const path = "/orchestra/sf-dashboard/hot-topics"
  const fragment = view === "list" ? "" : view === "new" ? "/new" :
    "/" + encodeSfRouteRef(id ?? "") + (view === "edit" ? "/edit" : "")
  // Keep the explicit canonical selection, never borrow the ambient connection.
  const query = new URLSearchParams()
  if (props.route.ownerSelection.installationId) {
    query.set("server", props.route.ownerSelection.serverKey)
    query.set("project", props.route.ownerSelection.projectId)
    query.set("installation", props.route.ownerSelection.installationId)
  }
  if (props.route.query.year !== undefined) query.set("year", String(props.route.query.year))
  if (props.route.query.month !== undefined) query.set("month", String(props.route.query.month))
  if (props.route.query.status) query.set("status", props.route.query.status)
  return path + fragment + "?" + query.toString()
}
function labelForStatus(value: string): Key | undefined {
  if (value === "open" || value === "progress" || value === "blocked" || value === "done") return ("sf.u38." + value) as Key
}
function labelForPriority(value: string): Key | undefined {
  if (value === "critical" || value === "high" || value === "normal") return ("sf.u38." + value) as Key
}

export function SfHotTopicsPage(props: SfSurfaceProps<"CAP02">): JSX.Element {
  const { t, locale } = useSfPresentation()
  const shownDate = (value: string) => {
    const iso = value.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return value
    const date = new Date(iso + "T00:00:00Z")
    if (!Number.isFinite(date.getTime())) return value
    return new Intl.DateTimeFormat(locale(), { dateStyle: "medium", timeZone: "UTC" }).format(date)
  }
  const navigate = useNavigate()
  const source = useHotTopicsSource(props.route)
  const [completion, setCompletion] = createStore({ generation: -1, route: "" })
  const [deleteRequested, setDeleteRequested] = createSignal(false)
  const [deleteBusy, setDeleteBusy] = createSignal(false)
  const [deleteState, setDeleteState] = createSignal<"none" | "saved" | "unknown" | "rejected">("none")
  const [inlineRef, setInlineRef] = createSignal<string | null>(null)
  let deleteButton: HTMLButtonElement | undefined
  let detailHeading: HTMLHeadingElement | undefined
  let confirmedMessage: HTMLParagraphElement | undefined
  const cancelDelete = () => {
    setDeleteRequested(false)
    queueMicrotask(() => deleteButton?.focus())
  }
  const list = () => source.records() ?? []
  const routeRef = () => props.route.kind === "detail" || props.route.kind === "edit" ?
    props.route.params.topicRef : undefined
  const selectedId = () => routeRef() ?? inlineRef()
  const selected = createMemo(() => selectedId() ? list().find((item) => item.id === selectedId()) : undefined)
  const version = () => selected() ? source.versions()["hotTopics:" + selected()!.id] : undefined
  const filtered = () => list().filter((item) => !source.filter() || item.status === source.filter())
  const state = () => {
    if (source.state() !== "ready" && source.state() !== "empty" &&
      source.state() !== "filtered-empty") return source.state()
    if (routeRef() && !selected()) return "not-found" as const
    return source.state()
  }
  const open = (topic: Topic, mode: "detail" | "edit") => {
    setDeleteRequested(false);setDeleteState("none")
    setInlineRef(topic.id)
    navigate(topicPath(props, mode, topic.id))
  }
  const back = () => {
    setCompletion({ generation: -1, route: "" })
    setInlineRef(null);setDeleteRequested(false);navigate(topicPath(props, "list"))
  }
  const edit = () => selected() ? open(selected()!, "edit") : undefined
  const current = () => source.owner()
  const editorScope = () => props.route.kind === "new" ? "new" :
    props.route.kind === "edit" ? "edit:" + props.route.params.topicRef : ""
  const confirmationOwner = () => {
    const ready = current()
    return ready?.context.destinations.some((item) => item.capabilityId === "CAP02" && item.canRead) ? ready : undefined
  }
  const confirmed = () => completion.route !== "" && completion.route === editorScope() &&
    completion.generation === source.context.generation() && !!confirmationOwner()
  createEffect(() => {
    if (completion.route && (!confirmationOwner() || completion.generation !== source.context.generation() ||
        completion.route !== editorScope())) setCompletion({ generation: -1, route: "" })
  })
  // Only the transport that sent the successful command may publish this notice.
  // No record values survive the source refresh, owner change or route change.
  const onSaved = (transport: SfTransport) => {
    if (!editorScope() || confirmationOwner()?.transport !== transport) return
    setCompletion({ generation: source.context.generation(), route: editorScope() })
    queueMicrotask(() => confirmedMessage?.focus())
  }

  async function remove() {
    const record = selected(), originalVersion = version()
    const ready = current()
    if (!record || originalVersion === undefined || !ready || !source.allowed("delete") || deleteBusy() || deleteState() === "unknown") {
      setDeleteRequested(false);setDeleteState("rejected");return
    }
    setDeleteBusy(true);setDeleteRequested(false)
    const keyForCall = crypto.randomUUID()
    try {
      const response = await createSfPeopleClient(ready.transport)["domain.command.CAP02.delete"]({
        id: record.id, version: originalVersion, values: {},
      }, { idempotencyKey: keyForCall, signal: new AbortController().signal })
      if (response.kind !== "response") {
        setDeleteState("unknown")
      } else if (!response.body.ok) {
        setDeleteState("rejected");source.refresh()
      } else {
        setDeleteState("saved");source.refresh()
      }
    } catch { setDeleteState("unknown") }
    finally { setDeleteBusy(false) }
  }

  const primaryAction = () => ({
    id: "new-topic", labelKey: key("sf.cap02.primary"), tone: "primary" as const,
    disabled: !source.allowed("save"), busy: false,
    reasonKey: !source.allowed("save") ? key("sf.u38.saveDenied") : undefined,
    onInvoke: () => navigate(topicPath(props, "new")),
  })
  return <SfPageFrame titleKey={key("sf.cap02.title")}
      eyebrow={{ kind: "message", message: { key: "sf.design.eyebrow" as SfCopyKey } }}
      context={[]} tabs={[]} activeTab={null} secondaryActions={[]}
      density="comfortable" layout="work" onLayoutMode={() => {}}
      primaryAction={props.route.kind === "entry" ? primaryAction() : undefined}>
    <div class="sf-u38-page sf-topics" data-sf-surface="CAP02" data-sf-wave="two" data-sf-view={props.route.kind}>
      <Show when={confirmed()}>
        <section class="sf-topics-editor sf-topics-confirmed" data-sf-topic-confirmed aria-labelledby="sf-topic-saved">
          <p ref={confirmedMessage} tabindex="-1" id="sf-topic-saved" role="status" data-topic-feedback="saved">
            {t(key("sf.u38.savedRefetch"))}
          </p>
          <button type="button" class="mx-btn primary" onClick={back}>{t(key("sf.u38.back"))}</button>
        </section>
      </Show>
      <SfStatePanel state={state()} messageKey={sfCommonKey(SF_STATE_FALLBACK_KEY[state()])}
        onRetryRead={source.refresh} onBack={back}>
        <Show when={props.route.kind === "entry"}>
          <section class="sf-topics-list" data-sf-topic-list aria-labelledby="sf-topics-list">
            <header class="sf-topics-list-head">
              <div class="sf-topics-list-title">
                <h2 id="sf-topics-list">{t(key("sf.u38.topicList"))}</h2>
                <span class="sf-topics-count">
                  <span class="sf-topics-sr-only">{t(key("sf.u38.filteredCount"))}: </span>
                  {filtered().length}
                </span>
              </div>
              <div class="sf-topics-tools">
                <label class="sf-topics-filter">
                  <span class="sf-topics-sr-only">{t(key("sf.u38.filter"))}</span>
                  <select value={source.filter()} onChange={(event) => source.setFilter(event.currentTarget.value as TopicStatus)}>
                    <For each={statuses}>{(option) =>
                      <option value={option}>{option ? t(key(labelForStatus(option)!)) : t(key("sf.u38.all"))}</option>
                    }</For>
                  </select>
                </label>
                <button type="button" class="mx-btn sf-topics-refresh" onClick={source.refresh}>
                  {t(key("sf.u38.refresh"))}
                </button>
              </div>
            </header>
            <Show when={filtered().length} fallback={
              <p class="sf-topics-empty" role="status">{t(sfCommonKey(source.filter() ? "sf.common.filterEmpty" : "sf.common.empty"))}</p>
            }>
              <table class="sf-topics-table">
                <caption class="sf-topics-sr-only">{t(key("sf.u38.topicList"))}</caption>
                <thead><tr>
                  <th scope="col">{t(key("sf.u38.action"))}</th>
                  <th scope="col">{t(key("sf.u38.owner"))}</th>
                  <th scope="col">{t(key("sf.u38.status"))}</th>
                  <th scope="col">{t(key("sf.u38.due"))}</th>
                  <th scope="col"><span class="sf-topics-sr-only">{t(key("sf.u38.topicDetail"))}</span></th>
                </tr></thead>
                <tbody><For each={filtered()}>{(topic) =>
                  <tr data-sf-topic={topic.id}>
                    <th scope="row" class="sf-topics-action">
                      <strong><bdi>{topic.action ?? t(key("sf.u38.unknown"))}</bdi></strong>
                      <span class="sf-topics-priority" data-priority={topic.priority}>
                        <span class="sf-topics-priority-dot" aria-hidden="true" />
                        <span>{t(key("sf.u38.priority"))}: {topic.priority && labelForPriority(topic.priority) ? t(key(labelForPriority(topic.priority)!)) : t(key("sf.u38.unknown"))}</span>
                      </span>
                    </th>
                    <td class="sf-topics-owner">
                      <span class="sf-topics-cell-label">{t(key("sf.u38.owner"))}</span>
                      <bdi>{topic.owner ?? t(key("sf.u38.unknown"))}</bdi>
                    </td>
                    <td class="sf-topics-status-cell">
                      <span class="sf-topics-cell-label">{t(key("sf.u38.status"))}</span>
                      <span class="sf-topics-status" data-status={topic.status}>
                        {topic.status && labelForStatus(topic.status) ? t(key(labelForStatus(topic.status)!)) : t(key("sf.u38.unknown"))}
                      </span>
                    </td>
                    <td class="sf-topics-due">
                      <span class="sf-topics-cell-label">{t(key("sf.u38.due"))}</span>
                      {topic.due ? <time dateTime={topic.due}>{shownDate(topic.due)}</time> : t(key("sf.u38.unknown"))}
                    </td>
                    <td class="sf-topics-open">
                      <button type="button" class="mx-btn" onClick={() => open(topic, "detail")}>
                        {t(key("sf.u38.show"))}<Icon name="arrow-right" size="small" />
                      </button>
                    </td>
                  </tr>
                }</For></tbody>
              </table>
            </Show>
          </section>
        </Show>
        <Show when={!confirmed() && props.route.kind === "new" ? current() : undefined}>
          {(ready) => <SfHotTopicEditor transport={ready().transport} drafts={ready().drafts}
            readInput={{ topicStatus: source.filter(), ...(props.route.query.year === undefined ? {} : { year: props.route.query.year }),
              ...(props.route.query.month === undefined ? {} : { month: props.route.query.month }) }}
            canSave={source.allowed("save")} scope="new" version={0} onBack={back} onRefetch={source.refresh} onSaved={onSaved} />}
        </Show>
        <Show when={props.route.kind === "edit" || props.route.kind === "detail" ? selected() : undefined}>
          {(topic) => <>
            <Show when={props.route.kind === "detail"}>
              <section class="sf-topics-detail" data-sf-topic-detail data-sf-deleting={deleteRequested() ? "true" : "false"}
                aria-labelledby="sf-topic-heading">
                <header class="sf-topics-detail-head">
                  <div>
                    <p class="sf-topics-overline">{t(key("sf.u38.topicDetail"))}</p>
                    <h2 ref={detailHeading} tabindex="-1" id="sf-topic-heading">{topic().action ?? t(key("sf.u38.topicDetail"))}</h2>
                  </div>
                  <button type="button" class="mx-btn" disabled={deleteBusy()} onClick={back}>
                    {t(key("sf.u38.back"))}
                  </button>
                </header>
                <div class="sf-topics-detail-body" hidden={deleteRequested()}>
                  <dl class="sf-topics-meta">
                    <div><dt>{t(key("sf.u38.owner"))}</dt><dd>{topic().owner || t(key("sf.u38.unknown"))}</dd></div>
                    <div><dt>{t(key("sf.u38.due"))}</dt><dd>{(() => { const due = topic().due; return due ? <time dateTime={due}>{shownDate(due)}</time> : t(key("sf.u38.unknown")) })()}</dd></div>
                    <div><dt>{t(key("sf.u38.status"))}</dt>
                      <dd><span class="sf-topics-status" data-status={topic().status}>
                        {topic().status && labelForStatus(topic().status!) ? t(key(labelForStatus(topic().status!)!)) : t(key("sf.u38.unknown"))}
                      </span></dd></div>
                    <div><dt>{t(key("sf.u38.priority"))}</dt>
                      <dd>{topic().priority && labelForPriority(topic().priority!) ? t(key(labelForPriority(topic().priority!)!)) : t(key("sf.u38.unknown"))}</dd></div>
                  </dl>
                  <section class="sf-topics-notes" aria-labelledby="sf-topic-notes">
                    <h3 id="sf-topic-notes">{t(key("sf.u38.notes"))}</h3>
                    <p>{topic().notes || t(key("sf.u38.unknown"))}</p>
                  </section>
                  <div class="sf-topics-detail-actions">
                    <button type="button" class="mx-btn primary" disabled={!source.allowed("save") || version() === undefined || deleteBusy()}
                      onClick={edit}>{t(key("sf.u38.editTopic"))}</button>
                    <button ref={deleteButton} type="button" class="mx-btn danger" disabled={!source.allowed("delete") ||
                        version() === undefined || deleteBusy() || deleteState() === "unknown"}
                      onClick={() => { setDeleteRequested(true);queueMicrotask(() => detailHeading?.focus()) }}>{t(key("sf.u38.deleteTopic"))}</button>
                  </div>
                  <div class="sf-topics-related" data-sf-executive-handoff>
                    <SfExecutiveAction from={props.route}
                      target={{ kind: "relations", source: { kind: "topic", ref: topic().id } }}
                      label={{ pt: SF_U38_COPY_BR["sf.u38.relate"], en: SF_U38_COPY["sf.u38.relate"] }} />
                    <SfExecutiveRelatedLinks from={props.route} omit="topic" />
                  </div>
                  <details class="sf-topics-source">
                    <summary>{t(key("sf.u38.source"))}<Icon name="chevron-down" size="small" /></summary>
                    <div class="sf-topics-source-content">
                      <dl>
                        <div><dt>{t(key("sf.u38.confirmSelected"))}</dt><dd><code><bdi>{topic().id}</bdi></code></dd></div>
                        <div><dt>{t(key("sf.u38.version"))}</dt><dd>{version() ?? t(key("sf.u38.unknown"))}</dd></div>
                      </dl>
                      <h3>{t(key("sf.u38.topicHistory"))}</h3>
                      <p>{t(key("sf.u38.noHistory"))}</p>
                    </div>
                  </details>
                </div>
                <Show when={deleteRequested() && version() !== undefined && source.allowed("delete")}>
                  <div class="sf-topics-delete-review">
                    <SfChangeReview operation={{ ref: ("topic-delete:" + topic().id) as SfOperationRef,
                        label: { key: key("sf.u38.deleteTopic") }, scope: { kind: "data", text: topic().id } }}
                      base={{ kind: "persisted", ref: topic().id as SfRef, version: version()!,
                        fields: [{ path: "action", label: { key: key("sf.u38.action") },
                          value: { kind: "text", text: { kind: "data", text: topic().action ?? "" } } }] }}
                      current={{ kind: "persisted", ref: topic().id as SfRef, version: version()!,
                        fields: [{ path: "action", label: { key: key("sf.u38.action") },
                          value: { kind: "text", text: { kind: "data", text: topic().action ?? "" } } }] }}
                      proposed={{ kind: "not-provided", reason: { key: key("sf.u38.deleteWarning") } }}
                      effects={[]}
                      coverage={{ state: "complete", summary: { key: key("sf.u38.confirmRisk") },
                        reasons: [], knownCount: 1, expectedCount: 1 }}
                      blockingReasons={[]}
                      confirmation={{ kind: "admitted", labelKey: key("sf.u38.confirmDelete"),
                        purpose: "delete", binding: { kind: "catalog-command", operationId: "domain.command.CAP02.delete",
                          version: { kind: "record", expectedVersion: version()! }, confirmation: "presentation-only" } }}
                      state="ready" onConfirm={() => {void remove()}}
                      onRevise={cancelDelete} onCancel={cancelDelete} />
                  </div>
                </Show>
                <Show when={deleteState() !== "none"}><p role="alert" data-delete-state={deleteState()}>
                  {t(key(deleteState() === "saved" ? "sf.u38.savedRefetch" :
                    deleteState() === "unknown" ? "sf.u38.savePending" : "sf.u38.applyError"))}
                </p></Show>
              </section>
            </Show>
            <Show when={!confirmed() && props.route.kind === "edit" ? current() : undefined}>
              {(ready) => <SfHotTopicEditor record={topic()} version={version()} transport={ready().transport}
                readInput={{ topicStatus: source.filter(), ...(props.route.query.year === undefined ? {} : { year: props.route.query.year }),
                  ...(props.route.query.month === undefined ? {} : { month: props.route.query.month }) }}
                drafts={ready().drafts} canSave={source.allowed("save")}
                scope={topic().id} onBack={back} onRefetch={source.refresh} onSaved={onSaved} />}
            </Show>
          </>}
        </Show>
      </SfStatePanel>
    </div>
  </SfPageFrame>
}

// Frozen U38 entrypoint consumed by I00/current integrator125.
export { SfHotTopicsPage as SfHotTopicsView }
