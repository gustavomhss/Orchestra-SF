import { createEffect, createMemo, createUniqueId, onCleanup, Show, untrack } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { createSfProcurementClient } from "@orchestra/client/sucafina/procurement"
import type { SfEditScopeKey, SfIntentRef, SfOperationRef, SfRef } from "@orchestra/schema/sucafina/context"
import type { SfPublicDraftController, SfSurfaceProps } from "../../context/contracts"
import { useSfContext } from "../../context"
import { SfChangeReview, type SfReviewField } from "../../shared/change-review"
import { SfStatePanel } from "../../shared/states"
import type { SfUiState } from "../../shared/frame"
import type { SF_U11_REMAINING_COPY } from "./copy"
import { readRequestTitle, titleReadiness } from "./title-revalidation"

type Key = keyof typeof SF_U11_REMAINING_COPY
type Source = Extract<Awaited<ReturnType<typeof readRequestTitle>>, { status: "authorized" }>
type Intent = Readonly<{ ref: SfRef; token: string; version: number; stage: string; original: string; title: string;
  operationRef: SfOperationRef; intentRef: SfIntentRef; idempotencyKey: string }>
const key = (value: Key) => value as Parameters<typeof SfStatePanel>[0]["messageKey"]
const message = (value: Key) => ({ key: key(value) })
const data = (text: string) => ({ kind: "data" as const, text })
const field = (title: string): SfReviewField => ({ path: "pr.title", label: message("sf.u11.remaining.field.title"),
  value: { kind: "text", text: data(title) } })
const scope = "pr.title" as SfEditScopeKey

export function SfRequestTitleEdit(props: SfSurfaceProps<"CAP25"> & Readonly<{ requestRef?: SfRef; onConfirmed?: () => void }>) {
  const sf = useSfContext()
  const language = useLanguage()
  const id = createUniqueId()
  const [ui, setUi] = createStore<{ token: string | null; source: Source | null; state: SfUiState;
    review: Intent | null; busy: boolean; notice: Key | null; refresh: number }>({
    token: null, source: null, state: "loading", review: null, busy: false, notice: null, refresh: 0,
  })
  let active: AbortController | undefined
  let submitted: SfPublicDraftController<{ title: string }> | undefined
  let busy = false
  const stop = () => {
    submitted?.setPhase("outcome-unknown")
    active?.abort()
  }
  const t = (value: Key) => language.t(value as Parameters<typeof language.t>[0])
  const refValue = () => props.requestRef ?? (props.route.kind !== "entry" && props.route.kind !== "new"
    ? props.route.params.requestRef : undefined)
  const authority = () => {
    const state = sf.state(), ready = sf.ready()
    if (state.status !== "ready" || !ready || !refValue()) return null
    const selected = props.route.ownerSelection
    if (state.owner.serverKey !== selected.serverKey || state.owner.projectId !== selected.projectId ||
        selected.installationId && state.owner.installationId !== selected.installationId) return null
    return JSON.stringify([state.ownerKey, state.owner, sf.generation(), ready.context.stamp, props.route.href, refValue()])
  }
  const selection = (ref: SfRef) => ({ surfaceId: "CAP25" as const,
    identity: { kind: "record" as const, recordRef: ref }, editScopeKey: scope })
  const draft = createMemo(() => {
    const ready = sf.ready(), source = ui.source, ref = refValue()
    if (!ready || !source || !ref || ui.token !== authority() || titleReadiness(ready.context) !== "ready") return undefined
    const original = { title: source.title }
    return ready.drafts.acquire({ ...selection(ref), baseVersion: source.version, base: original, value: original,
      revalidation: { operationId: "domain.page.CAP25", input: { request: ref }, fieldPaths: ["pr.title"], actionIds: ["save"] } })
  })
  const snapshot = () => draft()?.snapshot()
  const editable = () => {
    const state = snapshot()
    return state?.availability === "active" && !state.conflict && state.phase !== "conflict" &&
      !state.pendingOperation && state.baseVersion === ui.source?.version ? state : undefined
  }
  const refresh = () => setUi("refresh", ui.refresh + 1)
  createEffect(() => {
    const token = authority(), ref = refValue(), ready = sf.ready()
    void ui.refresh
    const previous = untrack(() => ui.token === token ? ui.source : null)
    stop()
    setUi({ token, source: null, state: token ? "loading" : "unavailable", review: null, busy: false, notice: null })
    busy = false
    if (!token || !ref || !ready) return
    const abort = new AbortController()
    active = abort
    void readRequestTitle(ready.context, ready.transport, ref, abort.signal).then((result) => {
      if (abort.signal.aborted || authority() !== token) return
      if (result.status !== "authorized") {
        setUi("state", result.status === "denied" ? "denied" : "unavailable")
        return
      }
      const controller = ready.drafts.peek<{ title: string }>(selection(ref)), state = controller?.snapshot()
      if (state?.availability === "active" && (state.baseVersion !== result.version ||
          !state.base || state.base.title !== result.title ||
          !!previous && (previous.stage !== result.stage || previous.title !== result.title))) {
        if (state.dirty) controller?.setPhase("conflict")
        else controller?.receiveRemote({ baseVersion: result.version, value: { title: result.title } })
      }
      setUi({ source: result, state: "ready" })
    })
    onCleanup(stop)
  })
  onCleanup(stop)

  const current = (intent: Intent) => {
    const state = editable(), source = ui.source, ready = sf.ready()
    return ui.review === intent && !active?.signal.aborted && authority() === intent.token &&
      ui.token === intent.token && refValue() === intent.ref && !!ready && titleReadiness(ready.context) === "ready" &&
      !!source && source.version === intent.version && source.stage === intent.stage && source.title === intent.original &&
      !!state && state.value.title === intent.title && state.baseVersion === intent.version
  }
  const rejectSource = (result: Awaited<ReturnType<typeof readRequestTitle>>) => {
    if (result.status === "authorized") {
      draft()?.setPhase("conflict")
      setUi({ source: result, state: "conflict", review: null })
      return
    }
    setUi({ source: null, review: null, state: result.status === "denied" ? "denied" : "unavailable" })
  }
  const matches = (result: Awaited<ReturnType<typeof readRequestTitle>>, intent: Intent) =>
    result.status === "authorized" && result.version === intent.version && result.stage === intent.stage && result.title === intent.original

  const begin = async () => {
    const state = editable(), source = ui.source, token = authority(), ref = refValue(), ready = sf.ready()
    if (!state || !state.dirty || !source || !token || !ref || !ready || busy || ui.review) return
    const intent: Intent = Object.freeze({ ref, token, version: source.version, stage: source.stage,
      original: source.title, title: state.value.title, operationRef: crypto.randomUUID() as SfOperationRef,
      intentRef: crypto.randomUUID() as SfIntentRef, idempotencyKey: crypto.randomUUID() })
    setUi({ review: intent, busy: true, notice: null })
    const review = ui.review!
    busy = true
    const abort = new AbortController()
    stop(); active = abort
    const fresh = await readRequestTitle(ready.context, ready.transport, ref, abort.signal)
    if (!current(review) || abort.signal.aborted) { busy = false; return }
    if (!matches(fresh, review)) { rejectSource(fresh); busy = false; setUi("busy", false); return }
    draft()?.setPhase("reviewing")
    busy = false
    setUi("busy", false)
  }
  const cancel = () => {
    if (busy) return
    draft()?.setPhase("dirty")
    setUi("review", null)
  }
  const confirm = async () => {
    const intent = ui.review, ready = sf.ready(), controller = draft()
    if (!intent || !ready || !controller || busy || !current(intent)) return
    busy = true
    setUi("busy", true)
    const abort = new AbortController()
    stop(); active = abort
    const payload = { page: "Requests" as const, action: "save" as const, id: intent.ref,
      version: intent.version, values: { pr: { title: intent.title } } }
    try {
      const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload)))
      if (!current(intent) || abort.signal.aborted) return
      const digest = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("")
      const fresh = await readRequestTitle(ready.context, ready.transport, intent.ref, abort.signal)
      if (!current(intent) || abort.signal.aborted) return
      if (!matches(fresh, intent)) { rejectSource(fresh); return }
      const pending = { operationRef: intent.operationRef, idempotencyKey: intent.idempotencyKey,
        payloadDigest: digest, expectedVersion: intent.version }
      controller.setPending(pending)
      controller.setPhase("submitting")
      const state = controller.snapshot()
      if (state.availability !== "active" || state.phase !== "submitting" ||
          state.pendingOperation?.operationRef !== pending.operationRef) return
      submitted = controller
      const settling = () => {
        const now = controller.snapshot(), source = ui.source, currentReady = sf.ready()
        return !abort.signal.aborted && authority() === intent.token && ui.review === intent &&
          refValue() === intent.ref && !!currentReady && titleReadiness(currentReady.context) === "ready" &&
          !!source && source.version === intent.version && source.stage === intent.stage && source.title === intent.original &&
          now.availability === "active" && now.phase === "submitting" && now.baseVersion === intent.version &&
          now.value.title === intent.title && JSON.stringify(now.pendingOperation) === JSON.stringify(pending)
      }
      const response = await createSfProcurementClient(ready.transport)["domain.command.CAP25.save"](payload,
        { signal: abort.signal, idempotencyKey: intent.idempotencyKey })
      if (!settling()) { controller.setPhase("outcome-unknown"); return }
      if (response.kind === "response" && !response.body.ok &&
          (response.status === 409 || response.status === 422) && response.body.status === response.status) {
        controller.rejectSave({ status: response.status, operation: pending })
        submitted = undefined
        setUi({ review: null, state: response.status === 409 ? "conflict" : "ready",
          notice: response.status === 409 ? "sf.u11.remaining.missingVersion" : "sf.u11.remaining.invalidPr" })
        return
      }
      if (response.kind !== "response" || response.status < 200 || response.status >= 300 || response.body.ok !== true) {
        controller.setPhase("outcome-unknown")
        setUi({ review: null, state: "outcome-unknown", notice: "sf.u11.remaining.unknown" })
        return
      }
      const projected = await readRequestTitle(ready.context, ready.transport, intent.ref, abort.signal)
      if (!settling()) { controller.setPhase("outcome-unknown"); return }
      if (projected.status === "authorized" && projected.version > intent.version && projected.title === intent.title) {
        controller.confirmSave({ kind: "projected", operationRef: intent.operationRef,
          baseVersion: projected.version, value: { title: projected.title } })
        submitted = undefined
        setUi({ source: projected, review: null, state: "ready", notice: "sf.u11.remaining.saved" })
        props.onConfirmed?.()
        return
      }
      controller.confirmSave({ kind: "confirmed-without-projection", operationRef: intent.operationRef, resultVersion: null })
      submitted = undefined
      setUi({ source: null, review: null, state: "unavailable", notice: "sf.u11.remaining.accepted" })
    } catch {
      const state = controller.snapshot()
      if (authority() === intent.token && state.availability === "active" && state.pendingOperation) {
        controller.setPhase("outcome-unknown")
        setUi({ review: null, state: "outcome-unknown", notice: "sf.u11.remaining.unknown" })
      } else if (authority() === intent.token) setUi({ review: null, state: "unavailable" })
    } finally {
      busy = false
      if (authority() === intent.token) setUi("busy", false)
    }
  }
  const discard = () => {
    const ref = refValue(), ready = sf.ready(), state = snapshot()
    if (!ref || !ready || busy || state?.availability !== "active" || state.pendingOperation ||
        state.phase === "outcome-unknown" || state.phase === "submitting") return
    ready.drafts.discard(selection(ref))
    refresh()
  }
  const visible = () => ui.token === authority() && ui.state === "ready" && !!editable()
  const review = () => ui.review && current(ui.review) && !ui.busy ? ui.review : null
  const displayState = (): SfUiState => {
    const state = snapshot()
    if (state?.availability === "active" && state.pendingOperation) return "outcome-unknown"
    if (state?.availability === "active" && (state.phase === "conflict" || state.conflict)) return "conflict"
    return ui.state === "ready" && !editable() ? "unavailable" : ui.state
  }
  const canDiscard = () => {
    const state = snapshot()
    return state?.availability === "active" && !state.pendingOperation &&
      state.phase !== "submitting" && state.phase !== "outcome-unknown"
  }
  return <section data-component="sf-request-title">
    <Show when={visible()} fallback={<SfStatePanel state={displayState()} messageKey={key("sf.u11.remaining.noSource")} />}>
      <Show when={!review()} fallback={<Show when={review()}>{(item) => {
        const original = { kind: "persisted" as const, ref: item().ref, version: item().version, fields: [field(item().original)] }
        const fields = [field(item().title)]
        return <SfChangeReview operation={{ ref: item().operationRef, label: message("sf.u11.remaining.save"),
          scope: data(t("sf.u11.remaining.reviewScope")) }} base={original} current={original}
          proposed={{ kind: "draft", intentRef: item().intentRef, sourceRef: item().ref, sourceVersion: item().version, fields }}
          effects={[{ id: "save", domain: "procurement", title: { kind: "message", message: message("sf.u11.remaining.save") }, state: "proposed", details: fields }]}
          coverage={{ state: "complete", summary: message("sf.u11.remaining.reviewSummary"), reasons: [], knownCount: 1, expectedCount: 1 }}
          blockingReasons={[]} confirmation={{ kind: "admitted", labelKey: key("sf.u11.remaining.confirm"), purpose: "save",
            binding: { kind: "catalog-command", operationId: "domain.command.CAP25.save",
              version: { kind: "record", expectedVersion: item().version }, confirmation: "presentation-only" } }}
          state="ready" onConfirm={() => { void confirm() }} onRevise={cancel} onCancel={cancel} />
      }}</Show>}>
        <label for={id}>{t("sf.u11.remaining.field.title")}</label>
        <input id={id} value={editable()?.value.title ?? ""} disabled={ui.busy}
          onInput={(event) => { if (!busy && !ui.review) draft()?.edit({ title: event.currentTarget.value }) }} />
        <button class="mx-btn" type="button" disabled={ui.busy || !editable()?.dirty}
          onClick={() => { void begin() }}>{t("sf.u11.remaining.reviewSave")}</button>
      </Show>
    </Show>
    <Show when={canDiscard()}>
      <button class="mx-btn" type="button" disabled={ui.busy || !!ui.review} onClick={discard}>{t("sf.u11.remaining.discard")}</button>
    </Show>
    <Show when={ui.notice}>{(notice) => <p role="status">{t(notice())}</p>}</Show>
  </section>
}
