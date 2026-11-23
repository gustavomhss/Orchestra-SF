import { createEffect, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import type { SfContextStamp, SfIntentRef, SfOperationRef, SfRef } from "@orchestra/schema/sucafina/context"
import type { SfSurfaceProps } from "../context/contracts"
import { useSfContext } from "../context"
import { SfChangeReview, type SfReviewField } from "../shared/change-review"
import type { SfCopyKey, SfMessage, SfUiState } from "../shared/frame"
import { SfStatePanel } from "../shared/states"

type ReadReply = typeof SfDomain.operations["local-admin.summary-read"]["output"]["Type"]
type Settings = Extract<ReadReply, { status: "ok" }>["value"]
type SummaryPage = Settings["pages"][number]
const key = (value: string) => value as SfCopyKey
const message = (value: string): SfMessage => ({ key: key(value) })
const sameStamp = (a: SfContextStamp, b: SfContextStamp) =>
  a.installationId === b.installationId && a.projectId === b.projectId &&
  a.hostId === b.hostId && a.principalRef === b.principalRef &&
  a.policyVersion === b.policyVersion && a.accessRevision === b.accessRevision
const readId = "local-admin.summary-read"
const writeId = "local-admin.summary-configure"

/** The original config:summaries CAS, rendered only under the current UI69 owner. */
export function SfSummarySettings(props: SfSurfaceProps<"UI69">): JSX.Element {
  const owner = useSfContext()
  const language = useLanguage()
  const text = (value: string) => language.t(value as Parameters<typeof language.t>[0])
  const titles = {
    "Executive Dashboard": "sf.cap01.title",
    "Hot Topics & Actions": "sf.cap02.title",
    "Budget Overview": "sf.cap03.title",
    "OPEX Detail": "sf.cap04.title",
    "CAPEX Projects": "sf.cap05.title",
    "Headcount Overview": "sf.cap06.title",
    "Team Structure": "sf.cap07.title",
    "Talent Review": "sf.cap08.title",
    "Portfolio Dashboard": "sf.cap09.title",
    "All Projects": "sf.cap10.title",
    "IT Operations": "sf.cap11.title",
    "IT Security KPIs": "sf.cap12.title",
    "IT Risks": "sf.cap13.title",
    "Vendor Contracts": "sf.cap14.title",
    "Stakeholder Management": "sf.cap15.title",
    "IT Performance Contract": "sf.cap16.title",
  } as const satisfies Readonly<Record<SummaryPage, Parameters<typeof language.t>[0]>>
  const pageTitle = (page: SummaryPage) => language.t(titles[page])
  const [state, setState] = createStore({
    page: "loading" as SfUiState,
    scope: "",
    data: undefined as Settings | undefined,
    selected: [] as SummaryPage[],
    review: false,
    intent: null as string | null,
    busy: false,
    blocked: false,
    notice: "",
    revision: 0,
  })
  let writing: AbortController | undefined
  const admitted = (id: typeof readId | typeof writeId) => {
    const state = owner.state()
    const ready = owner.ready()
    if (state.status !== "ready" || !ready ||
        state.context.authMode !== "local-operator" || state.binding.authMode !== "local-operator" ||
        state.selection.serverKey !== props.route.ownerSelection.serverKey ||
        ready.context.stamp.projectId !== props.route.ownerSelection.projectId ||
        ready.context.stamp.installationId !== props.route.ownerSelection.installationId ||
        !ready.context.availability.some((entry) => entry.family === "domain-read" && entry.resource === "local-admin" &&
          entry.operations.some((operation) => operation.operationId === id &&
            operation.state === "ready" && operation.operational))) return
    return { ready, generation: owner.generation(),
      scope: JSON.stringify([state.ownerKey, ready.context.stamp.accessRevision, ready.context.stamp.policyVersion]) }
  }
  const visible = () => {
    const current = admitted(readId)
    if (!current || current.scope !== state.scope) return
    return state.data
  }
  const canWrite = () => !!visible()?.canConfigure && !!admitted(writeId)
  const sameOwner = (original: NonNullable<ReturnType<typeof admitted>>) => {
    const current = admitted(readId)
    return !!current && current.scope === original.scope && current.generation === original.generation &&
      current.ready.transport === original.ready.transport && sameStamp(current.ready.context.stamp, original.ready.context.stamp)
  }
  const clear = (page: SfUiState) => {
    writing?.abort()
    setState({ page, scope: "", data: undefined, selected: [], review: false, intent: null, busy: false, blocked: false, notice: "" })
  }
  const failure = (status: number): SfUiState => status === 401 ? "session-expired"
    : status === 403 ? "denied" : status === 409 ? "stale" : status === 400 || status === 422 ? "invalid" : "unavailable"
  const read = async (current: NonNullable<ReturnType<typeof admitted>>, signal: AbortSignal) =>
    createSfDomainClient(current.ready.transport)[readId]({}, { signal })
  createEffect(() => {
    const current = admitted(readId)
    void state.revision
    writing?.abort()
    if (!current) {
      const status = owner.state().status
      clear(status === "resolving" ? "loading" : status === "denied" ? "denied"
        : status === "unauthenticated" ? "session-expired" : "unavailable")
      return
    }
    clear("loading")
    const abort = new AbortController()
    void read(current, abort.signal).then((result) => {
      if (abort.signal.aborted || !sameOwner(current)) return
      if (result.kind !== "response") return clear("unavailable")
      if (result.status !== 200 || result.body.status !== "ok") return clear(failure(result.status))
      if (!sameStamp(result.body.context, current.ready.context.stamp)) return clear("denied")
      setState({ page: "ready", scope: current.scope, data: result.body.value,
        selected: [...result.body.value.pages], review: false, intent: null, busy: false, blocked: false, notice: "" })
    }).catch(() => { if (!abort.signal.aborted && sameOwner(current)) clear("unavailable") })
    onCleanup(() => abort.abort())
  })
  onCleanup(() => writing?.abort())
  const refresh = () => { if (!state.busy) setState("revision", (value) => value + 1) }
  const select = (page: SummaryPage, checked: boolean) => {
    if (!canWrite() || state.busy || state.blocked || !visible()?.availablePages.includes(page)) return
    setState({ selected: checked ? [...state.selected.filter((value) => value !== page), page]
      : state.selected.filter((value) => value !== page), review: false, notice: "" })
  }
  const save = async () => {
    const current = admitted(writeId)
    const source = visible()
    if (!current || !source || !canWrite() || !state.review || !state.intent || state.busy || state.blocked) return
    const idempotencyKey = state.intent
    const pages = source.availablePages.filter((page) => state.selected.includes(page))
    const version = source.version
    const abort = new AbortController()
    writing?.abort()
    writing = abort
    setState({ busy: true, notice: "" })
    try {
      const result = await createSfDomainClient(current.ready.transport)[writeId]({
        context: { ...current.ready.context.stamp }, version, pages,
      }, { signal: abort.signal, idempotencyKey })
      if (abort.signal.aborted || !sameOwner(current)) return
      if (result.kind !== "response") {
        setState({ blocked: true, notice: "sf.common.operationUnknown" })
        return
      }
      if (result.status === 401 || result.status === 403) return clear(failure(result.status))
      if (result.status !== 200 || !("ok" in result.body) || !result.body.ok) {
        setState({ blocked: true, review: false, notice: result.status === 409 ? "sf.common.stale" : "sf.common.unavailable" })
        return
      }
      // A successful command is not a replacement for the original persisted read.
      const after = await read(current, abort.signal)
      if (abort.signal.aborted || !sameOwner(current)) return
      if (after.kind !== "response") {
        setState({ blocked: true, notice: "sf.common.operationUnknown" })
        return
      }
      if (after.status === 401 || after.status === 403) return clear(failure(after.status))
      if (after.status !== 200 || after.body.status !== "ok") {
        setState({ blocked: true, notice: "sf.common.operationUnknown" })
        return
      }
      if (!sameStamp(after.body.context, current.ready.context.stamp)) return clear("denied")
      if (after.body.value.version !== version + 1 || JSON.stringify(after.body.value.pages) !== JSON.stringify(pages)) {
        setState({ blocked: true, review: false, notice: "sf.common.stale" })
        return
      }
      setState({ data: after.body.value, selected: [...after.body.value.pages],
        review: false, intent: null, blocked: false, notice: "sf.common.saved" })
    } catch {
      if (!abort.signal.aborted && sameOwner(current)) setState({ blocked: true, notice: "sf.common.operationUnknown" })
    } finally {
      if (writing === abort) writing = undefined
      if (!abort.signal.aborted && sameOwner(current)) setState("busy", false)
    }
  }
  const fields = (pages: readonly SummaryPage[]): readonly SfReviewField[] => [{
    path: "pages", label: message("sf.u28.summaries"),
    value: {
      kind: "list",
      items: pages.map((page) => ({
        kind: "text",
        text: { kind: "message", message: message(titles[page]) },
      })),
    },
  }]
  const persisted = () => {
    const source = visible()
    return source ? { kind: "persisted" as const, ref: "config:summaries" as SfRef,
      version: source.version, fields: fields(source.pages) } : null
  }
  const copy = () => state.page === "loading" ? "sf.common.loading" : state.page === "denied" ? "sf.common.noAccess"
    : state.page === "session-expired" ? "sf.common.loginAgain" : state.page === "stale" ? "sf.common.stale" : "sf.common.unavailable"
  return <section class="sf-u28-summaries" aria-labelledby="sf-u28-summaries-title" data-sf-summary-settings>
    <h2 id="sf-u28-summaries-title">{text("sf.u28.summaries")}</h2>
    <SfStatePanel state={state.page} messageKey={key(copy())} onRetryRead={refresh}>
      <Show when={visible()}>
        {(source) => <>
          <p>{text("sf.u28.version")}: <output data-sf-summary-version>{source().version}</output></p>
          <Show when={state.notice}><p role="status">{text(state.notice)}</p></Show>
          <Show when={canWrite()} fallback={<>
            <p>{text("sf.common.readOnly")}</p>
            <ul><For each={source().pages}>{(page) => <li>{pageTitle(page)}</li>}</For></ul>
          </>}>
            <form hidden={state.review} data-sf-summary-form data-version={source().version} onSubmit={(event) => {
              event.preventDefault()
              if (canWrite() && !state.busy && !state.blocked) setState({ review: true, intent: crypto.randomUUID() })
            }}>
              <fieldset disabled={state.busy || state.blocked || state.review}>
                <legend>{text("sf.u28.summaries")}</legend>
                <For each={source().availablePages}>{(page) => <label>
                  <input type="checkbox" name="pages" value={page} checked={state.selected.includes(page)}
                    onChange={(event) => select(page, event.currentTarget.checked)} />
                  <span>{pageTitle(page)}</span>
                </label>}</For>
              </fieldset>
              <button type="submit" class="mx-btn primary" disabled={state.busy || state.blocked || state.review}>
                {text("sf.common.review")}
              </button>
            </form>
          </Show>
          <button type="button" class="mx-btn" hidden={state.review} disabled={state.busy} onClick={refresh}>{text("sf.common.currentSource")}</button>
          <Show when={state.review && canWrite()}>
            <SfChangeReview
              operation={{ ref: state.intent as SfOperationRef,
                label: message("sf.u28.saveSummaries"), scope: { kind: "message", message: message("sf.u28.summaries") } }}
              base={persisted()} current={persisted()}
              proposed={{ kind: "draft", intentRef: state.intent as SfIntentRef,
                sourceRef: "config:summaries" as SfRef, sourceVersion: source().version, fields: fields(state.selected) }}
              effects={[{ id: "configure-summaries", domain: "dashboard", state: "proposed",
                title: { kind: "message", message: message("sf.u28.summaries") }, details: fields(state.selected) }]}
              coverage={{ state: "complete", summary: message("sf.common.currentSource"), reasons: [], knownCount: null, expectedCount: null }}
              blockingReasons={state.blocked ? [message(state.notice || "sf.common.unavailable")] : []}
              confirmation={!state.blocked && canWrite() ? { kind: "admitted", labelKey: key("sf.u28.saveSummaries"), purpose: "save",
                binding: { kind: "catalog-command", operationId: writeId,
                  version: { kind: "record", expectedVersion: source().version }, confirmation: "presentation-only" } }
                : { kind: "blocked", labelKey: key("sf.u28.saveSummaries"), reasons: [message("sf.common.unavailable")] }}
              state={state.busy ? "loading" : state.notice === "sf.common.operationUnknown" ? "outcome-unknown" : "ready"}
              onConfirm={() => { void save() }}
              onRevise={() => { if (!state.busy && !state.blocked) setState("review", false) }}
              onCancel={() => { if (!state.busy && !state.blocked) setState("review", false) }}
              onReconcile={refresh}
            />
          </Show>
        </>}
      </Show>
    </SfStatePanel>
  </section>
}
