import { For, Show, createMemo, createSignal } from "solid-js"
import type { JSX } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { createSfPeopleClient } from "@orchestra/client/sucafina/people"
import type { SfOperationRef, SfRef } from "@orchestra/schema/sucafina/context"
import type { SfSurfaceProps } from "../../context/contracts"
import { encodeSfRouteRef } from "../../navigation-state"
import { SfPageFrame } from "../../shared/frame"
import { SfExecutiveAction, SfExecutiveRelatedLinks } from "../../cross-links/view"
import { SfStatePanel } from "../../shared/states"
import { SfChangeReview } from "../../shared/change-review"
import { SF_STATE_FALLBACK_KEY, sfCommonKey, useSfPresentation } from "../../shared/frame/presentation"
import type { SfCopyKey } from "../../shared/frame/types"
import { SF_U38_COPY } from "@/i18n/orchestra-chapters/sf-u38"
import { SfHotTopicEditor } from "./edit"
import { useHotTopicsSource } from "./reader"
import type { Topic, TopicStatus } from "./reader"
import "./u38.css"

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
  const [deleteRequested, setDeleteRequested] = createSignal(false)
  const [deleteBusy, setDeleteBusy] = createSignal(false)
  const [deleteState, setDeleteState] = createSignal<"none" | "saved" | "unknown" | "rejected">("none")
  const [inlineRef, setInlineRef] = createSignal<string | null>(null)
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
  const back = () => { setInlineRef(null);setDeleteRequested(false);navigate(topicPath(props, "list")) }
  const edit = () => selected() ? open(selected()!, "edit") : undefined
  const current = () => source.owner()

  const canPropose = () => current()?.context.availability.some((resource) =>
    resource.family === "domain-read" && resource.resource === "hot-topic-proposal" &&
    resource.operations.some((operation) => operation.operationId === "dashboard.dashboard-hot-topic-draft" &&
      operation.state === "ready" && operation.operational)) === true
  const newProposal = () => {
    if (!canPropose()) return
    const query = new URLSearchParams({ server: props.route.ownerSelection.serverKey, project: props.route.ownerSelection.projectId })
    if (props.route.ownerSelection.installationId) query.set("installation", props.route.ownerSelection.installationId)
    navigate("/orchestra/sf-dashboard/hot-topics/proposals/" + encodeSfRouteRef("new") + "?" + query.toString())
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
  return <SfPageFrame titleKey={key("sf.cap02.title")} context={[]} tabs={[]} activeTab={null} secondaryActions={[]}
      density="comfortable" layout="work" onLayoutMode={() => {}} primaryAction={primaryAction()}>
    <div class="sf-u38-page" data-sf-surface="CAP02">
      <SfStatePanel state={state()} messageKey={sfCommonKey(SF_STATE_FALLBACK_KEY[state()])}
        onRetryRead={source.refresh} onBack={back}>
        <Show when={props.route.kind === "entry"}>
          <section class="sf-u38-section" aria-labelledby="sf-topics-list">
            <h2 id="sf-topics-list">{t(key("sf.u38.topicList"))}</h2>
            <button type="button" class="mx-btn" disabled={!canPropose()} onClick={newProposal}>{t(key("sf.u38.newProposal"))}</button>
            <label class="sf-u38-filter">{t(key("sf.u38.filter"))}
              <select value={source.filter()} onChange={(event) => source.setFilter(event.currentTarget.value as TopicStatus)}>
                <For each={statuses}>{(option) =>
                  <option value={option}>{option ? t(key(labelForStatus(option)!)) : t(key("sf.u38.all"))}</option>
                }</For>
              </select>
            </label>
            <Show when={filtered().length} fallback={<p role="status">{t(sfCommonKey(source.filter() ? "sf.common.filterEmpty" : "sf.common.empty"))}</p>}>
              <div class="sf-u38-table-scroll">
                <table><caption>{t(key("sf.u38.topicList"))}</caption>
                  <thead><tr><th scope="col">{t(key("sf.u38.action"))}</th>
                    <th scope="col">{t(key("sf.u38.owner"))}</th>
                    <th scope="col">{t(key("sf.u38.status"))}</th>
                    <th scope="col">{t(key("sf.u38.priority"))}</th>
                    <th scope="col">{t(key("sf.u38.due"))}</th>
                    <th scope="col">{t(key("sf.u38.topicDetail"))}</th></tr></thead>
                  <tbody><For each={filtered()}>{(topic) =>
                    <tr data-sf-topic={topic.id}>
                      <th scope="row">{topic.action ?? t(key("sf.u38.unknown"))}</th>
                      <td>{topic.owner ?? t(key("sf.u38.unknown"))}</td>
                      <td>{topic.status && labelForStatus(topic.status) ? t(key(labelForStatus(topic.status)!)) : t(key("sf.u38.unknown"))}</td>
                      <td>{topic.priority && labelForPriority(topic.priority) ? t(key(labelForPriority(topic.priority)!)) : t(key("sf.u38.unknown"))}</td>
                      <td>{topic.due ? <time dateTime={topic.due}>{shownDate(topic.due)}</time> : t(key("sf.u38.unknown"))}</td>
                      <td><button type="button" class="mx-btn" onClick={() => open(topic, "detail")}>{t(key("sf.u38.show"))}</button></td>
                    </tr>}</For></tbody>
                </table>
              </div>
            </Show>
          </section>
        </Show>
        <Show when={props.route.kind === "new" ? current() : undefined}>
          {(ready) => <SfHotTopicEditor transport={ready().transport} drafts={ready().drafts}
            readInput={{ topicStatus: source.filter(), ...(props.route.query.year === undefined ? {} : { year: props.route.query.year }),
              ...(props.route.query.month === undefined ? {} : { month: props.route.query.month }) }}
            canSave={source.allowed("save")} scope="new" version={0} onBack={back} onRefetch={source.refresh} />}
        </Show>
        <Show when={props.route.kind === "edit" || props.route.kind === "detail" ? selected() : undefined}>
          {(topic) => <section class="sf-u38-section" data-sf-topic-detail aria-labelledby="sf-topic-heading">
            <header class="sf-u38-detail-header">
              <h2 id="sf-topic-heading">{topic().action ?? t(key("sf.u38.topicDetail"))}</h2>
              <button type="button" class="mx-btn" onClick={back}>{t(key("sf.u38.back"))}</button>
            </header>
            <Show when={props.route.kind === "detail"}>
              <dl class="sf-u38-meta">
                <div><dt>{t(key("sf.u38.owner"))}</dt><dd>{topic().owner || t(key("sf.u38.unknown"))}</dd></div>
                <div><dt>{t(key("sf.u38.due"))}</dt><dd>{(() => { const due = topic().due; return due ? <time dateTime={due}>{shownDate(due)}</time> : t(key("sf.u38.unknown")) })()}</dd></div>
                <div><dt>{t(key("sf.u38.status"))}</dt>
                  <dd>{topic().status && labelForStatus(topic().status!) ? t(key(labelForStatus(topic().status!)!)) : t(key("sf.u38.unknown"))}</dd></div>
                <div><dt>{t(key("sf.u38.priority"))}</dt>
                  <dd>{topic().priority && labelForPriority(topic().priority!) ? t(key(labelForPriority(topic().priority!)!)) : t(key("sf.u38.unknown"))}</dd></div>
                <div><dt>{t(key("sf.u38.notes"))}</dt><dd class="sf-u38-long">{topic().notes || t(key("sf.u38.unknown"))}</dd></div>
                <div><dt>{t(key("sf.u38.version"))}</dt><dd>{version() ?? t(key("sf.u38.unknown"))}</dd></div>
              </dl>
              <div class="sf-u38-actions" data-sf-executive-handoff>
                <SfExecutiveAction from={props.route}
                  target={{ kind: "relations", source: { kind: "topic", ref: topic().id } }}
                  label={{ pt: "Relacionar ação por referência", en: "Relate action by reference" }} />
              </div>
              <SfExecutiveRelatedLinks from={props.route} omit="topic" />
              <div class="sf-u38-actions">
                <button type="button" class="mx-btn primary" disabled={!source.allowed("save") || version() === undefined}
                  onClick={edit}>{t(key("sf.u38.editTopic"))}</button>
                <button type="button" class="mx-btn" disabled={!source.allowed("delete") ||
                    version() === undefined || deleteBusy() || deleteState() === "unknown"}
                  onClick={() => setDeleteRequested(true)}>{t(key("sf.u38.deleteTopic"))}</button>
              </div>
              <h3>{t(key("sf.u38.topicHistory"))}</h3>
              <p>{t(key("sf.u38.noHistory"))}</p>
              <Show when={deleteRequested() && version() !== undefined && source.allowed("delete")}>
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
                  onRevise={() => setDeleteRequested(false)} onCancel={() => setDeleteRequested(false)} />
              </Show>
              <Show when={deleteState() !== "none"}><p role="alert" data-delete-state={deleteState()}>
                {t(key(deleteState() === "saved" ? "sf.u38.savedRefetch" :
                  deleteState() === "unknown" ? "sf.u38.savePending" : "sf.u38.applyError"))}
              </p></Show>
            </Show>
            <Show when={props.route.kind === "edit" ? current() : undefined}>
              {(ready) => <SfHotTopicEditor record={topic()} version={version()} transport={ready().transport}
                readInput={{ topicStatus: source.filter(), ...(props.route.query.year === undefined ? {} : { year: props.route.query.year }),
                  ...(props.route.query.month === undefined ? {} : { month: props.route.query.month }) }}
                drafts={ready().drafts} canSave={source.allowed("save")}
                scope={topic().id} onBack={back} onRefetch={source.refresh} />}
            </Show>
          </section>}
        </Show>
      </SfStatePanel>
    </div>
  </SfPageFrame>
}

// Frozen U38 entrypoint consumed by I00/current integrator125.
export { SfHotTopicsPage as SfHotTopicsView }
