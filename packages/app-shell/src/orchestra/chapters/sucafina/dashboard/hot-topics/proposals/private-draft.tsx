import { For, Show, createEffect, createSignal, onCleanup, untrack, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { sfHotTopicProposalRoute } from "./proposal-route"
import { clearSfDashboardRecovery, openSfDashboardRecovery, SF_DASHBOARD_RECOVERY_LIFETIME_MS } from "./recovery-intents"
import type { SfDashboardRecoveryIntent, SfDashboardRecoveryStore } from "./recovery-intents"
import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import { createSfReviewsClient } from "@orchestra/client/sucafina/reviews"
import type { SfEditScopeKey, SfIntentRef, SfOperationRef, SfRef } from "@orchestra/schema/sucafina/context"
import type { SfPublicDraftController, SfSurfaceProps } from "../../../context/contracts"
import type { SfDraftIdentity, SfPendingOperation } from "../../../shared/draft"
import { useSfContext } from "../../../context"
import { SfPageFrame, type SfCopyKey } from "../../../shared/frame"
import { useSfPresentation } from "../../../shared/frame/presentation"
import { changedPrivateBase, copyPrivateDraft, decodeCurrentPrivateDraft, decodePrivateWorkbench, object,
  privateFieldsValid, readSelection, sourceDraft, type CurrentRead, type DraftValue, type Fields,
  type Permissions, type Workbench } from "./private-draft-model"
import type { SF_U38_COPY } from "@/i18n/orchestra-chapters/sf-u38"

type Key = keyof typeof SF_U38_COPY
const key = (text: Key) => text as SfCopyKey
const fieldNames = ["action", "owner", "due", "priority", "notes"] as const
const noPermissions = (): Permissions => ({ draft: false, prepare: false, apply: false, capture: false, preserve: false })
type Selection = { surfaceId: "UI54"; identity: SfDraftIdentity; editScopeKey: SfEditScopeKey }
type Review = { previous: Fields; current: DraftValue; source: Fields }
type Attempt = { operation: SfPendingOperation; original: DraftValue }

/** Actual UI54 private proposal editor. F01 owns all retained edits and pending intentions. */
export function SfPrivateHotTopicEditor(_props: SfSurfaceProps<"UI54">): JSX.Element {
  const owner = useSfContext()
  const { t } = useSfPresentation()
  const [editor, setEditor] = createSignal<SfPublicDraftController<DraftValue>>()
  const [state, setState] = createStore<{
    workbench: Workbench | null; caseId: string; draftRef: string; sourceId: string; captureRef: string
    busy: boolean; readConfirmed: boolean; permissions: Permissions; notice: Key
    review: Review | null; confirmed: boolean; conflict: boolean; unknown: boolean
    correlation: "loading" | "ready" | "unavailable"; recovery: SfDashboardRecoveryIntent | null; expired: boolean
  }>({ workbench: null, caseId: "", draftRef: "new", sourceId: "", captureRef: "",
    busy: false, readConfirmed: false, permissions: noPermissions(), notice: "sf.u38.privateLoading",
    review: null, confirmed: false, conflict: false, unknown: false, correlation: "loading", recovery: null, expired: false })
  let selection: Selection | undefined
  let attempt: Attempt | undefined
  let request: AbortController | undefined
  let generation = -1
  let disposed = false
  let recoveryStore: SfDashboardRecoveryStore | undefined
  const unresolved = (intent: SfDashboardRecoveryIntent, pending: boolean) => intent.kind === "draft" && current()?.drafts.markUnresolved({
    surfaceId: "UI54", identity: { kind: "new", newIntentRef: intent.key as SfIntentRef },
    editScopeKey: "UI54:first-save" as SfEditScopeKey,
  }, pending)
  const clearCorrelation = (key: string) => {
    if (!state.recovery || state.recovery.key !== key) return true
    if (!recoveryStore?.clear(key)) return false
    unresolved(state.recovery, false)
    setState({ recovery: null, expired: false })
    return true
  }
  const current = () => owner.ready()
  const snapshot = () => {
    const value = editor()?.snapshot()
    return value?.availability === "active" ? value : undefined
  }
  const value = () => snapshot()?.value
  const operationReady = (operationId: string) => !!current()?.context.availability.some((resource) =>
    resource.operations.some((entry) => entry.operationId === operationId && entry.state === "ready" && entry.operational))
  const editable = () => state.correlation === "ready" && !state.recovery && !!value() && state.readConfirmed && state.permissions.draft && !state.busy && !state.unknown &&
    !snapshot()?.pendingOperation && operationReady("dashboard.dashboard-hot-topic-draft")
  const saveReady = () => editable() && !!snapshot()?.dirty && !!value() && privateFieldsValid(value()!.request.fields) &&
    !state.conflict && (!state.review || state.confirmed)
  const lockedSelection = () => state.busy || state.unknown || !!snapshot()?.dirty || !!snapshot()?.pendingOperation
  const candidates = () => state.workbench?.drafts.filter((item) => item.value.request.caseRef.id === state.caseId) ?? []
  const sources = () => state.workbench?.records.filter((record) => {
    const selected = state.workbench?.cases.find((item) => item.caseRef.id === state.caseId)
    return selected && sourceDraft(record, selected.caseRef)
  }) ?? []
  const sourceId = (record: Workbench["records"][number]) => object(object(record.draft)?.target)?.id
  const fence = (original: NonNullable<ReturnType<typeof current>>, epoch: number, abort: AbortController) =>
    !disposed && !abort.signal.aborted && owner.generation() === epoch && current() === original
  const revoke = () => {
    request?.abort(); attempt = undefined; selection = undefined; setEditor(undefined)
    clearSfDashboardRecovery(owner); recoveryStore = undefined
    setState({ workbench: null, caseId: "", draftRef: "new", sourceId: "", captureRef: "", review: null,
      permissions: noPermissions(), readConfirmed: false, busy: false, confirmed: false, conflict: false, unknown: false,
      correlation: "unavailable", recovery: null, expired: false })
    owner.invalidate("revoked")
  }
  const unavailable = () => setState({ readConfirmed: false, permissions: noPermissions(), notice: "sf.u38.privateReadUnavailable" })
  const attach = (source: DraftValue, reuse = true) => {
    const incoming = copyPrivateDraft(source)
    const ready = current()
    if (!ready) return
    const nextSelection: Selection = {
      surfaceId: "UI54", editScopeKey: "UI54:private-hot-topic" as SfEditScopeKey,
      identity: incoming.id ? { kind: "record", recordRef: incoming.id as SfRef } :
        // Scope incarnation is not physical identity. Retain by case and record;
        // the original draft-read evidence proves continuity before reuse.
        { kind: "new", newIntentRef: JSON.stringify(["UI54", incoming.request.caseRef.id, incoming.request.caseRef.incarnation,
          incoming.request.target.surface, incoming.request.target.type, incoming.request.target.id]) as SfIntentRef },
    }
    const old = reuse ? ready.drafts.peek<DraftValue>(nextSelection) : undefined
    const controller = old ?? ready.drafts.acquire<DraftValue>({
      ...nextSelection, baseVersion: incoming.request.expectedVersion,
      base: incoming.id ? incoming : null, value: incoming,
      revalidation: { operationId: "dashboard.dashboard-draft-read", input: readSelection(incoming),
        fieldPaths: fieldNames, actionIds: [] },
    })
    selection = nextSelection; setEditor(controller)
    const actual = controller.snapshot()
    const selected = actual.availability === "active" ? actual.value : incoming
    attempt = actual.availability === "active" && actual.pendingOperation ? { operation: actual.pendingOperation, original: actual.value } : undefined
    setState({ caseId: selected.request.caseRef.id, draftRef: selected.request.draftRef ?? "new",
      sourceId: selected.request.target.id, review: null, confirmed: false, conflict: false, unknown: !!attempt })
  }
  const acceptRead = (proof: CurrentRead, original: DraftValue, explicit: boolean) => {
    setState({ permissions: proof.permissions, readConfirmed: true, unknown: false })
    const active = snapshot()
    if (!active) return
    if (active.pendingOperation) {
      setState({ unknown: true, readConfirmed: false, notice: "sf.u38.privateUnknown" }); return
    }
    if (changedPrivateBase(original, proof.current) || explicit) {
      // Current source and active proposal are evidence for comparison, never an automatic overwrite.
      editor()?.receiveRemote({ baseVersion: proof.current.request.expectedVersion, value: proof.current })
      setState({ review: { previous: active.base?.request.fields ?? original.request.fields,
        current: proof.current, source: proof.sourceFields }, confirmed: false, conflict: false,
        notice: "sf.u38.privateCurrentLoaded" })
    } else {
      setState({ notice: active.dirty ? "sf.u38.privateRetained" : "sf.u38.privateLoaded", conflict: false })
    }
  }
  const readCurrent = async (ready: NonNullable<ReturnType<typeof current>>, epoch: number, abort: AbortController,
    original: DraftValue, explicit: boolean) => {
    const response = await createSfDomainClient(ready.transport)["dashboard.dashboard-draft-read"](
      readSelection(original), { signal: abort.signal })
    if (!fence(ready, epoch, abort)) return false
    if (response.kind !== "response") { unavailable(); return false }
    if (response.status === 403 || response.body.status === "denied") { revoke(); return false }
    if (response.body.status !== "ok") { unavailable(); return false }
    const proof = decodeCurrentPrivateDraft(response.body.value, original)
    if (!proof) { unavailable(); return false }
    acceptRead(proof, original, explicit)
    return true
  }
  const load = async (explicit = false) => {
    const ready = current()
    if (!ready || state.busy || state.unknown && !state.recovery || !operationReady("dashboard.dashboard-workbench")) return
    request?.abort()
    const abort = new AbortController(); request = abort
    const epoch = owner.generation(), retained = value()
    setState({ busy: true, readConfirmed: false, notice: "sf.u38.privateLoading" })
    try {
      const response = await createSfDomainClient(ready.transport)["dashboard.dashboard-workbench"](
        { page: "Hot Topics & Actions" }, { signal: abort.signal })
      if (!fence(ready, epoch, abort)) return
      if (response.kind !== "response") { unavailable(); return }
      if (response.status === 403 || response.body.status === "denied") { revoke(); return }
      if (response.body.status !== "ok") { unavailable(); return }
      const workbench = decodePrivateWorkbench(response.body.value)
      if (!workbench) { unavailable(); return }
      setState("workbench", workbench)
      if (state.recovery) {
        const slot = recoveryStore?.read()
        setState({ permissions: workbench.permissions, readConfirmed: true, unknown: true,
          expired: slot?.state !== "pending" || slot.expired,
          notice: slot?.state === "pending" && !slot.expired ? "sf.u38.privateRecoveryPending" : "sf.u38.recoveryExpired" })
      } else if (retained) await readCurrent(ready, epoch, abort, retained, explicit)
      else setState({ permissions: workbench.permissions, readConfirmed: true, notice: "sf.u38.privateLoaded" })
    } catch {
      if (fence(ready, epoch, abort)) unavailable()
    } finally { if (fence(ready, epoch, abort)) setState("busy", false) }
  }
  const choose = async (incoming: DraftValue) => {
    const ready = current()
    if (!ready || state.busy || state.unknown || snapshot()?.dirty) return
    if (selection) ready.drafts.discard(selection)
    attach(incoming)
    const original = value()
    if (!original) return
    request?.abort(); const abort = new AbortController(); request = abort
    const epoch = owner.generation()
    setState({ busy: true, readConfirmed: false })
    try { await readCurrent(ready, epoch, abort, original, false) }
    catch { if (fence(ready, epoch, abort)) unavailable() }
    finally { if (fence(ready, epoch, abort)) setState("busy", false) }
  }
  const chooseCase = (id: string) => {
    if (id === state.caseId || lockedSelection()) return
    if (selection) current()?.drafts.discard(selection)
    selection = undefined; setEditor(undefined)
    setState({ caseId: id, draftRef: "new", sourceId: "", review: null, confirmed: false })
  }
  const chooseDraft = (ref: string) => {
    if (ref === state.draftRef || lockedSelection()) return
    if (ref === "new") {
      if (selection) current()?.drafts.discard(selection)
      selection = undefined; setEditor(undefined); setState({ draftRef: "new", sourceId: "", review: null, confirmed: false })
      return
    }
    const candidate = candidates().find((item) => item.value.request.draftRef === ref)
    if (candidate) void choose(candidate.value)
  }
  const chooseSource = (id: string) => {
    if (lockedSelection()) return
    const selected = state.workbench?.cases.find((item) => item.caseRef.id === state.caseId)
    const source = sources().find((item) => sourceId(item) === id)
    const incoming = selected && source ? sourceDraft(source, selected.caseRef) : undefined
    if (incoming) void choose(incoming)
  }
  const edit = (field: keyof Fields, next: string) => {
    const active = snapshot()
    if (!active || !editable() || field === "priority" && !["critical", "high", "normal"].includes(next)) return
    editor()?.edit({ ...active.value, request: { ...active.value.request,
      fields: { ...active.value.request.fields, [field]: next } as Fields } })
  }
  const confirmCurrent = (confirmed: boolean) => {
    if (!state.review || !snapshot() || state.busy) return
    if (confirmed) {
      const retained = snapshot()!.value.request.fields, next = copyPrivateDraft(state.review.current)
      // Explicit consent adopts the complete current binding, including a source
      // change that did not increment the private proposal version.
      editor()?.discard()
      editor()?.receiveRemote({ baseVersion: next.request.expectedVersion, value: next })
      editor()?.edit({ ...next, request: { ...next.request, fields: retained } })
    }
    setState("confirmed", confirmed)
  }
  const finishSave = async (ready: NonNullable<ReturnType<typeof current>>, epoch: number, abort: AbortController,
    pending: Attempt, returned: unknown) => {
    const result = object(returned)
    if (typeof result?.draftRef !== "string" || typeof result.version !== "number" ||
      !Number.isSafeInteger(result.version) || result.version !== pending.original.request.expectedVersion + 1) return false
    const response = await createSfDomainClient(ready.transport)["dashboard.dashboard-workbench"](
      { page: "Hot Topics & Actions" }, { signal: abort.signal })
    if (!fence(ready, epoch, abort)) return false
    if (response.kind !== "response") return false
    if (response.status === 403 || response.body.status === "denied") { revoke(); return false }
    if (response.body.status !== "ok") return false
    const workbench = decodePrivateWorkbench(response.body.value)
    const saved = workbench?.drafts.find((candidate) => candidate.value.request.draftRef === result.draftRef &&
      candidate.value.request.expectedVersion === result.version &&
      candidate.value.request.caseRef.id === pending.original.request.caseRef.id &&
      candidate.value.request.caseRef.incarnation === pending.original.request.caseRef.incarnation)
    if (!workbench || !saved || pending.original.id && (saved.value.id !== pending.original.id || saved.value.incarnation !== pending.original.incarnation)) return false
    if (!clearCorrelation(pending.operation.idempotencyKey)) return false
    editor()?.confirmSave({ kind: "projected", operationRef: pending.operation.operationRef,
      baseVersion: saved.value.request.expectedVersion, value: saved.value })
    const previous = selection
    if (pending.original.id === null) {
      if (previous) ready.drafts.discard(previous)
      attach(saved.value, false)
    }
    attempt = undefined
    setState({ workbench, permissions: workbench.permissions, readConfirmed: true, draftRef: saved.value.request.draftRef!,
      sourceId: saved.value.request.target.id, review: null, confirmed: false, conflict: false, unknown: false,
      notice: "sf.u38.privateSaved" })
    return true
  }
  const save = async () => {
    const ready = current(), active = snapshot()
    if (!ready || !active || !saveReady()) return
    const original = structuredClone(active.value)
    const abort = new AbortController(); request?.abort(); request = abort
    const epoch = owner.generation(), operationRef = crypto.randomUUID() as SfOperationRef, idempotencyKey = crypto.randomUUID()
    setState("busy", true)
    try {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(original.request)))
      if (!fence(ready, epoch, abort)) return
      const pending: Attempt = { original, operation: { operationRef, idempotencyKey,
        payloadDigest: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
        expectedVersion: active.baseVersion } }
      if (!original.request.draftRef) {
        const intent: SfDashboardRecoveryIntent = { kind: "draft", key: idempotencyKey,
          caseRef: { ...original.request.caseRef }, expiresAt: Date.now() + SF_DASHBOARD_RECOVERY_LIFETIME_MS }
        if (!recoveryStore?.write(intent)) {
          setState({ correlation: "unavailable", unknown: true, notice: "sf.u38.recoveryUnavailable" }); return
        }
        unresolved(intent, true); setState("recovery", intent)
      }
      attempt = pending; editor()?.setPending(pending.operation); editor()?.setPhase("submitting")
      if (snapshot()?.pendingOperation?.operationRef !== operationRef) {
        clearCorrelation(idempotencyKey); attempt = undefined; return
      }
      const response = await createSfDomainClient(ready.transport)["dashboard.dashboard-hot-topic-draft"](
        original.request, { signal: abort.signal, idempotencyKey })
      if (!fence(ready, epoch, abort)) return
      if (response.kind === "response" && (response.status === 403 || response.body.status === "denied")) { revoke(); return }
      if (response.kind === "response" && response.status === 409) {
        if (!clearCorrelation(idempotencyKey)) { setState({ unknown: true, notice: "sf.u38.privateUnknown" }); return }
        editor()?.rejectSave({ status: 409, operation: pending.operation }); attempt = undefined
        setState({ conflict: true, readConfirmed: false, notice: "sf.u38.privateChanged" }); return
      }
      if (response.kind === "response" && response.status === 400) {
        if (!clearCorrelation(idempotencyKey)) { setState({ unknown: true, notice: "sf.u38.privateUnknown" }); return }
        editor()?.rejectSave({ status: 422, operation: pending.operation }); attempt = undefined
        setState({ notice: "sf.u38.privateInvalid" }); return
      }
      if (response.kind === "response" && response.body.status === "ok" &&
        await finishSave(ready, epoch, abort, pending, response.body.value)) return
      if (!fence(ready, epoch, abort)) return
      editor()?.setPhase("outcome-unknown"); setState({ unknown: true, readConfirmed: false, notice: "sf.u38.privateUnknown" })
    } catch {
      if (fence(ready, epoch, abort)) {
        editor()?.setPhase("outcome-unknown"); setState({ unknown: true, readConfirmed: false, notice: "sf.u38.privateUnknown" })
      }
    } finally { if (fence(ready, epoch, abort)) setState("busy", false) }
  }
  const finishRestoredSave = async (ready: NonNullable<ReturnType<typeof current>>, epoch: number, abort: AbortController,
    intent: Extract<SfDashboardRecoveryIntent, { kind: "draft" }>, returned: unknown) => {
    const result = object(returned)
    if (!result || Object.keys(result).sort().join(",") !== "draftRef,version" ||
      typeof result.draftRef !== "string" || !result.draftRef || result.version !== 1) return false
    const response = await createSfDomainClient(ready.transport)["dashboard.dashboard-workbench"](
      { page: "Hot Topics & Actions" }, { signal: abort.signal })
    if (!fence(ready, epoch, abort)) return false
    if (response.kind !== "response") return false
    if (response.status === 403 || response.body.status === "denied") { revoke(); return false }
    if (response.body.status !== "ok") return false
    const workbench = decodePrivateWorkbench(response.body.value)
    const matches = workbench?.drafts.filter((candidate) => candidate.value.request.draftRef === result.draftRef &&
      candidate.value.request.expectedVersion === result.version &&
      candidate.value.request.caseRef.id === intent.caseRef.id &&
      candidate.value.request.caseRef.incarnation === intent.caseRef.incarnation) ?? []
    if (!workbench || matches.length !== 1 || !clearCorrelation(intent.key)) return false
    attach(matches[0]!.value, false); attempt = undefined
    setState({ workbench, permissions: workbench.permissions, readConfirmed: true, unknown: false,
      notice: "sf.u38.privateRecovered" })
    return true
  }
  const recover = async () => {
    const ready = current(), pending = attempt, intent = state.recovery
    if (!ready || !intent || intent.kind !== "draft" || state.busy || state.correlation !== "ready" ||
      !recoveryStore?.current() || state.expired || Date.now() >= intent.expiresAt ||
      !operationReady("dashboard.dashboard-hot-topic-draft-outcome")) return
    request?.abort(); const abort = new AbortController(); request = abort
    const epoch = owner.generation(); setState("busy", true)
    try {
      const response = await createSfDomainClient(ready.transport)["dashboard.dashboard-hot-topic-draft-outcome"](
        { caseRef: { id: intent.caseRef.id, incarnation: intent.caseRef.incarnation, version: intent.caseRef.version } },
        { signal: abort.signal, idempotencyKey: intent.key })
      if (!fence(ready, epoch, abort)) return
      if (response.kind === "response" && (response.status === 403 || response.body.status === "denied")) { revoke(); return }
      if (response.kind === "response" && response.body.status === "ok") {
        if (pending && !pending.original.request.draftRef) await finishSave(ready, epoch, abort, pending, response.body.value)
        else await finishRestoredSave(ready, epoch, abort, intent, response.body.value)
      }
    } catch { if (fence(ready, epoch, abort)) setState("notice", "sf.u38.privateUnknown") }
    finally { if (fence(ready, epoch, abort)) setState("busy", false) }
  }
  const captureReady = () => state.readConfirmed && state.permissions.capture && !!state.captureRef && !state.busy && !state.unknown &&
    operationReady("dashboard.dashboard-capture")
  const capture = async () => {
    const ready = current()
    if (!ready || !captureReady()) return
    request?.abort(); const abort = new AbortController(); request = abort
    const epoch = owner.generation(); setState("busy", true)
    try {
      const response = await createSfReviewsClient(ready.transport)["dashboard.dashboard-capture"](
        { sourceRef: state.captureRef }, { signal: abort.signal, idempotencyKey: crypto.randomUUID() })
      if (!fence(ready, epoch, abort)) return
      if (response.kind === "response" && (response.status === 403 || response.body.status === "denied")) { revoke(); return }
      if (response.kind === "response" && response.body.status === "ok") setState("notice", "sf.u38.privateCaptured")
      else setState({ unknown: true, readConfirmed: false, notice: "sf.u38.privateUnknown" })
    } catch { if (fence(ready, epoch, abort)) setState({ unknown: true, readConfirmed: false, notice: "sf.u38.privateUnknown" }) }
    finally { if (fence(ready, epoch, abort)) setState("busy", false) }
  }

  createEffect(() => {
    const ready = current(), next = owner.generation()
    if (!ready) {
      request?.abort(); setEditor(undefined); selection = undefined; attempt = undefined; recoveryStore = undefined
      setState({ correlation: "loading", recovery: null, expired: false, workbench: null, review: null, caseId: "", sourceId: "", captureRef: "",
        busy: false, readConfirmed: false, permissions: noPermissions() })
      return
    }
    if (generation === next) return
    generation = next
    const epoch = next
    untrack(() => {
      void openSfDashboardRecovery(owner).then((storage) => {
        if (disposed || owner.generation() !== epoch || current()?.transport !== ready.transport) return
        recoveryStore = storage
        const slot = storage?.read()
        if (!slot || slot.state === "unavailable") {
          setState({ correlation: "unavailable", unknown: true, notice: "sf.u38.recoveryUnavailable" }); return
        }
        if (slot.state === "pending") {
          unresolved(slot.intent, true)
          setState({ correlation: "ready", recovery: slot.intent, expired: slot.expired,
            unknown: true, notice: slot.expired ? "sf.u38.recoveryExpired" : "sf.u38.privateRecoveryPending" })
        } else setState({ correlation: "ready", recovery: null, expired: false })
        void load()
      }).catch(() => {
        if (!disposed && owner.generation() === epoch) setState({ correlation: "unavailable", unknown: true, notice: "sf.u38.recoveryUnavailable" })
      })
    })
  })
  onCleanup(() => { disposed = true; request?.abort(); attempt = undefined })

  return <SfPageFrame titleKey={key("sf.ui54.title")} context={[]} tabs={[]} activeTab={null}
    secondaryActions={[]} density="comfortable" layout="work" onLayoutMode={() => undefined}>
    <section class="sf-u38-section" aria-label={t(key("sf.u38.privateEditor"))}>
      <h2>{t(key("sf.u38.privateEditor"))}</h2>
      <p role="status" aria-live="polite">{t(key(state.notice))}</p>
      <button type="button" class="mx-btn" disabled={state.busy || state.unknown && !state.recovery || !current()} onClick={() => { void load() }}>
        {t(key("sf.u38.privateLoad"))}
      </button>
      <Show when={state.workbench}>
        <div class="sf-u38-actions">
          <label>{t(key("sf.u38.privateCase"))}
            <select value={state.caseId} disabled={lockedSelection()} onChange={(event) => chooseCase(event.currentTarget.value)}>
              <option value="">{t(key("sf.u38.privateChoose"))}</option>
              <For each={state.workbench?.cases}>{(item) => <option value={item.caseRef.id}>{item.label}</option>}</For>
            </select>
          </label>
          <label>{t(key("sf.u38.privateProposal"))}
            <select value={state.draftRef} disabled={lockedSelection() || !state.caseId} onChange={(event) => chooseDraft(event.currentTarget.value)}>
              <option value="new">{t(key("sf.u38.privateNew"))}</option>
              <For each={candidates()}>{(item) => <option value={item.value.request.draftRef}>{item.label}</option>}</For>
            </select>
          </label>
          <label>{t(key("sf.u38.privateSource"))}
            <select value={state.sourceId} disabled={lockedSelection() || !state.caseId || state.draftRef !== "new"}
              onChange={(event) => chooseSource(event.currentTarget.value)}>
              <option value="">{t(key("sf.u38.privateChoose"))}</option>
              <For each={sources()}>{(item) => <option value={String(sourceId(item))}>{item.label}</option>}</For>
            </select>
          </label>
        </div>
      </Show>
      <Show when={snapshot()}>{(active) =>
        <section aria-label={t(key("sf.u38.privateForm"))} data-dirty={active().dirty}>
          <For each={fieldNames}>{(field) =>
            <label class="block">{t(key(("sf.u38." + field) as Key))}
              <Show when={field === "notes"} fallback={
                <Show when={field === "priority"} fallback={
                  <input type={field === "due" ? "date" : "text"} value={active().value.request.fields[field]}
                    disabled={!editable()} onInput={(event) => edit(field, event.currentTarget.value)} />
                }>
                  <select value={active().value.request.fields.priority} disabled={!editable()} onChange={(event) => edit("priority", event.currentTarget.value)}>
                    <For each={["critical", "high", "normal"] as const}>{(priority) => <option value={priority}>{t(key(("sf.u38." + priority) as Key))}</option>}</For>
                  </select>
                </Show>
              }>
                <textarea value={active().value.request.fields.notes} disabled={!editable()} onInput={(event) => edit("notes", event.currentTarget.value)} />
              </Show>
            </label>}
          </For>
          <Show when={!state.unknown && state.readConfirmed && !active().dirty && active().value.request.draftRef}>
            {(draftRef) => <a class="mx-btn" href={sfHotTopicProposalRoute(props, draftRef())}>
              {t(key("sf.u38.privateReviewSaved"))}
            </a>}
          </Show>
          <div class="sf-u38-actions">
            <button type="button" class="mx-btn primary" disabled={!saveReady()} onClick={() => { void save() }}>{t(key("sf.u38.privateSave"))}</button>
            <button type="button" class="mx-btn" disabled={state.busy || state.unknown} onClick={() => { void load(true) }}>{t(key("sf.u38.privateCurrent"))}</button>
            <button type="button" class="mx-btn" disabled={state.busy || !!active().pendingOperation}
              onClick={() => { editor()?.discard(); setState({ review: null, confirmed: false, conflict: false }) }}>{t(key("sf.u38.privateDiscard"))}</button>
          </div>
        </section>}
      </Show>
      <Show when={state.review}>{(review) =>
        <section aria-label={t(key("sf.u38.privateComparison"))}>
          <table><thead><tr>
            <th>{t(key("sf.u38.privateField"))}</th><th>{t(key("sf.u38.privatePrevious"))}</th>
            <th>{t(key("sf.u38.privateCurrentVersion"))}</th><th>{t(key("sf.u38.privateMine"))}</th>
          </tr></thead><tbody><For each={fieldNames}>{(field) => <tr>
            <td>{t(key(("sf.u38." + field) as Key))}</td><td>{review().previous[field]}</td>
            <td>{review().current.request.fields[field]}</td><td>{value()?.request.fields[field]}</td>
          </tr>}</For></tbody></table>
          <table><thead><tr><th>{t(key("sf.u38.privateField"))}</th><th>{t(key("sf.u38.privateCurrentSource"))}</th></tr></thead>
            <tbody><For each={fieldNames}>{(field) => <tr><td>{t(key(("sf.u38." + field) as Key))}</td><td>{review().source[field]}</td></tr>}</For></tbody>
          </table>
          <label><input type="checkbox" checked={state.confirmed} disabled={state.busy}
            onChange={(event) => confirmCurrent(event.currentTarget.checked)} />{t(key("sf.u38.privateConfirm"))}</label>
        </section>}
      </Show>
      <Show when={state.unknown && state.recovery?.kind === "draft"}>
        <section aria-label={t(key("sf.u38.privateRecovery"))}>
          <p role="status">{t(key(state.expired ? "sf.u38.recoveryExpired" : "sf.u38.privateRecoveryPending"))}</p>
          <button type="button" class="mx-btn" disabled={state.busy || state.expired || state.correlation !== "ready" ||
            !operationReady("dashboard.dashboard-hot-topic-draft-outcome")} onClick={() => { void recover() }}>
            {t(key("sf.u38.privateRecover"))}
          </button>
          <button type="button" class="mx-btn" disabled>{t(key("sf.u38.privateSave"))}</button>
        </section>
      </Show>
      <Show when={state.workbench}>
        <section>
          <label>{t(key("sf.u38.privateCaptureSource"))}
            <select value={state.captureRef} disabled={state.busy} onChange={(event) => setState("captureRef", event.currentTarget.value)}>
              <option value="">{t(key("sf.u38.privateChoose"))}</option>
              <For each={state.workbench?.records}>{(item) => <option value={item.sourceRef}>{item.label}</option>}</For>
            </select>
          </label>
          <button type="button" class="mx-btn" disabled={!captureReady()} onClick={() => { void capture() }}>{t(key("sf.u38.privateCapture"))}</button>
        </section>
      </Show>
    </section>
  </SfPageFrame>
}
