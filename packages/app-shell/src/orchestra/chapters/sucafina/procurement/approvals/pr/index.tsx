import { useNavigate } from "@solidjs/router"
import { createEffect, createMemo, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { createSfProcurementClient } from "@orchestra/client/sucafina/procurement"
import { useLanguage } from "@/context/language"
import { useSfContext } from "../../../context"
import type { SfRef, SfSurfaceProps } from "../../../context/contracts"
import type { SfIntentRef, SfOperationRef } from "@orchestra/schema/sucafina/context"
import { SfPageFrame } from "../../../shared/frame"
import { SfStatePanel } from "../../../shared/states"
import { SfDataTable } from "../../../shared/table"
import { SfListDetail, SfRecordDetail } from "../../../shared/detail"
import { SfChangeReview } from "../../../shared/change-review"
import { SfReceiptView } from "../../../shared/receipt"
import type { SfU13CopyKey } from "./copy"
import { acquirePrDecisionDraft, receivePrSourceVersion, PR_EDIT_SCOPE } from "./draft"
import {
  findSubmittedPr, samePrReview, sourceChangedAfterIntent,
  type Cap26PageOk, type Cap26Request, type PrDecision, type PrGroup, type PrProjection,
} from "./model"

type State = Parameters<typeof SfStatePanel>[0]["state"]
type CopyKey = Parameters<typeof SfStatePanel>[0]["messageKey"]
type Snapshot = NonNullable<Parameters<typeof SfChangeReview>[0]["base"]>
type AdmittedReview = Extract<Parameters<typeof SfChangeReview>[0]["confirmation"], { kind: "admitted" }>
type Pending = Readonly<{
  source: PrProjection
  decision: PrDecision
  key: string
  note: string
  operationRef: string
  producerAcknowledged: boolean
}>
type Phase =
  | "idle" | "reviewing" | "checking" | "submitting" | "verifying"
  | "outcome-unknown" | "source-changed" | "producer-confirmed" | "conflict" | "failed"

const key = (value: SfU13CopyKey): CopyKey => value as CopyKey
const data = (text: string) => ({ kind: "data", text } as const)
const label = (value: SfU13CopyKey) => ({ key: key(value) })
const textField = (value: string | null | undefined, missing: SfU13CopyKey = "sf.u13.unknownValue") =>
  value === null || value === undefined || value === ""
    ? { kind: "unavailable", reason: label(missing) } as const
    : { kind: "text", text: data(value) } as const

type ReadResult =
  | Readonly<{ kind: "ok"; page: Cap26PageOk }>
  | Readonly<{ kind: "unavailable" | "denied" | "session-expired" | "stale" | "not-found" }>

function snapshot(review: PrProjection): Snapshot {
  return {
    kind: "persisted",
    ref: review.requestRef as SfRef,
    version: review.version,
    fields: [
      { path: "pr.title", label: label("sf.u13.title"), value: textField(review.request.pr?.title) },
      { path: "status", label: label("sf.u13.status"), value: textField(review.request.status) },
      { path: "prApproval.steps", label: label("sf.u13.holder"), value: textField(review.holderId === null ? null : review.holderName ?? review.holderId, "sf.u13.unassigned") },
      { path: "prApproval.amount", label: label("sf.u13.amount"), value: { kind: "number", value: review.amount, unit: review.baseCurrency ? { kind: "currency", code: review.baseCurrency } : { kind: "unspecified", label: label("sf.u13.baseCurrency") }, fractionDigits: 2 } },
      { path: "prApprovalBaseCurrency", label: label("sf.u13.baseCurrency"), value: textField(review.baseCurrency) },
    ],
  }
}

/** CAP26 P1 only: no other approval family, no title-save, no invented receipt. */
export function SfPrApprovalView(props: SfSurfaceProps<"CAP26">): JSX.Element {
  const host = useSfContext()
  const language = useLanguage()
  const navigate = useNavigate()
  const t = (value: SfU13CopyKey) => language.t(value as Parameters<typeof language.t>[0])
  const [ui, setUi] = createStore<{
    authority: string | null
    page: Cap26PageOk | null
    state: State
    selected: string | null
    group: PrGroup | "all"
    search: string
    layoutMode: "single" | "split" | "split-context"
    detailPage: boolean
    review: Readonly<{ source: PrProjection; decision: PrDecision; intentRef: SfIntentRef }> | null
    phase: Phase
    pending: Pending | null
    failure: "denied" | "not-found" | "stale" | "unavailable" | "invalid" | null
    conflictReview: Readonly<{ requestRef: string; decision: PrDecision; note: string; version: number;
      currentVersion: number | null; status: string | null; admitted: boolean | null }> | null
  }>({
    authority: null, page: null, state: "loading", selected: null,
    group: "all", search: "", layoutMode: "single", detailPage: false,
    review: null, phase: "idle", pending: null, failure: null, conflictReview: null,
  })
  let readController: AbortController | undefined
  let actionController: AbortController | undefined
  let readSequence = 0
  let actionBusy = false

  // F01, not the URL, supplies the admitted authenticated owner. A resolver
  // route cannot confer grants. Never compare principalRef to holderId:
  // Procurement's holder IDs belong to the producer's actor namespace.
  const authority = () => {
    const state = host.state()
    if (state.status !== "ready" || !host.ready()) return null
    const requested = props.route.ownerSelection
    if (state.selection.serverKey !== requested.serverKey ||
        state.selection.projectId !== requested.projectId ||
        state.selection.installationId !== requested.installationId) return null
    return JSON.stringify([
      state.ownerKey, host.generation(), state.owner.authEpoch,
      state.context.stamp, props.route.href,
    ])
  }
  const authorizedPage = () => authority() !== null && ui.authority === authority() ? ui.page : null
  const routeRef = () => props.route.kind === "entry" ? ui.selected : props.route.params.requestRef
  const current = createMemo(() => {
    const page = authorizedPage()
    const ref = routeRef()
    return page && ref ? findSubmittedPr(page, ref) : null
  })
  const selectedPr = () => {
    const projection = current()
    return projection?.kind === "submitted-pr" ? projection : null
  }

  const sourceRead = async (expected: string, ref: string | undefined, signal: AbortSignal): Promise<ReadResult> => {
    const ready = host.ready()
    if (!ready || authority() !== expected) return { kind: "unavailable" }
    try {
      const response = await createSfProcurementClient(ready.transport)["domain.page.CAP26"](
        ref ? { request: ref } : {}, { signal },
      )
      if (signal.aborted || authority() !== expected) return { kind: "unavailable" }
      if (response.kind === "transport-error") return { kind: "unavailable" }
      if (response.status === 401 || response.body.status === "unauthenticated") return { kind: "session-expired" }
      if (response.status === 403 || response.body.status === "denied") return { kind: "denied" }
      if (response.status === 404) return { kind: "not-found" }
      if (response.status === 409 || response.body.status === "stale") return { kind: "stale" }
      if (response.status !== 200 || response.body.status !== "ok") return { kind: "unavailable" }
      const stamp = ready.context.stamp
      const incoming = response.body.context
      if (Object.keys(stamp).some((field) =>
        incoming[field as keyof typeof incoming] !== stamp[field as keyof typeof stamp],
      )) return { kind: "denied" }
      if (response.body.value.capabilityId !== "CAP26") return { kind: "unavailable" }
      return { kind: "ok", page: response.body }
    } catch {
      return { kind: "unavailable" }
    }
  }

  const refresh = async (token: string, ref?: string): Promise<Cap26PageOk | null> => {
    readController?.abort()
    const controller = new AbortController()
    readController = controller
    const sequence = ++readSequence
    const result = await sourceRead(token, ref, controller.signal)
    if (controller.signal.aborted || authority() !== token || sequence !== readSequence) return null
    if (result.kind !== "ok") {
      if (result.kind === "denied" || result.kind === "session-expired" || result.kind === "not-found") {
        setUi("page", null)
        setUi("review", null)
      }
      setUi("state", result.kind === "session-expired" ? "session-expired" : result.kind)
      return null
    }
    setUi("page", null)
    setUi("page", result.page)
    setUi("state", "ready")
    return result.page
  }

  createEffect(() => {
    const token = authority()
    const directRef = props.route.kind === "entry" ? undefined : props.route.params.requestRef
    readController?.abort()
    actionController?.abort()
    actionBusy = false
    setUi({
      authority: token, page: null, state: token ? "loading" : "session-expired",
      selected: directRef ?? null, group: "all", search: "", detailPage: false,
      review: null, pending: null, phase: "idle", failure: null, conflictReview: null,
    })
    if (token) {
      void refresh(token, directRef).then((page) => {
        // A review deep link may open a read-only review of its *current*
        // submitted record, but never submits a command on navigation.
        if (!page || authority() !== token || props.route.kind !== "review") return
        const result = findSubmittedPr(page, props.route.params.requestRef)
        if (result.kind === "submitted-pr" && result.actions.includes("approve"))
          setUi("review", { source: result, decision: "approve", intentRef: crypto.randomUUID() as SfIntentRef })
      })
    }
    onCleanup(() => {
      readController?.abort()
      actionController?.abort()
    })
  })

  const decisionDraft = createMemo(() => {
    const active = host.ready()
    const source = selectedPr()
    if (!active || !source || !authority()) return null
    try { return acquirePrDecisionDraft(active.drafts, source) }
    catch { return null } // Missing/revoked draft admission must fail closed.
  })
  const decisionValue = () => {
    const snapshot = decisionDraft()?.snapshot()
    return snapshot?.availability === "active" ? snapshot.value : null
  }
  const restoredOperation = () => {
    const state = decisionDraft()?.snapshot()
    return state?.availability === "active" ? state.pendingOperation : null
  }
  const orphanPending = () => {
    const state = decisionDraft()?.snapshot()
    return !ui.pending && state?.availability === "active" &&
      (state.pendingOperation !== null || state.value.commandStarted)
  }
  createEffect(() => {
    const source = selectedPr()
    const draft = decisionDraft()
    if (source && draft) receivePrSourceVersion(draft, source.version)
  })

  const allRows = () => authorizedPage()?.value.data.requests.filter(
    (request): request is Cap26Request & { number: string } =>
      request.status === "pr_pending" && typeof request.number === "string" && request.number.length > 0,
  ) ?? []
  const visibleRows = () => allRows().filter((request) => {
    const page = authorizedPage()
    if (!page) return false
    const inGroup = (group: PrGroup) =>
      (group === "you" ? page.value.data.waitingForYou :
        group === "others" ? page.value.data.waitingForOthers : page.value.data.unassigned)
        .some((row) => row.number === request.number)
    return (ui.group === "all" || inGroup(ui.group)) &&
      (!ui.search || [request.number, request.pr?.title]
        .some((item) => item?.toLocaleLowerCase().includes(ui.search.toLocaleLowerCase())))
  })
  const viewState = (): State => {
    if (!authority() || ui.authority !== authority()) {
      const state = host.state().status
      return state === "denied" ? "denied" :
        state === "context-mismatch" ? "invalid" :
        state === "resolving" ? "loading" :
        state === "unavailable" || state === "choose-installation" ? "unavailable" : "session-expired"
    }
    if (ui.state !== "ready") return ui.state
    if (ui.phase === "outcome-unknown" || ui.phase === "source-changed" || orphanPending()) return "partial"
    if (ui.phase === "conflict") return "conflict"
    if (ui.phase === "failed") return ui.failure === "denied" ? "denied" :
      ui.failure === "not-found" ? "not-found" : ui.failure === "stale" ? "conflict" : "unavailable"
    if (props.route.kind !== "entry" && current()?.kind === "not-found") return "not-found"
    if (props.route.kind !== "entry" && current()?.kind === "not-submitted") return "invalid"
    if (props.route.kind !== "entry" && current()?.kind === "source-unavailable") return "unavailable"
    if (allRows().length === 0) return "empty"
    if (visibleRows().length === 0) return "filtered-empty"
    return "ready"
  }
  const stateMessage = (): SfU13CopyKey => {
    if (ui.phase === "source-changed") return "sf.u13.sourceChanged"
    if (orphanPending()) return "sf.u13.unknown"
    if (ui.phase === "outcome-unknown") return "sf.u13.unknown"
    if (ui.phase === "conflict") return "sf.u13.conflict"
    if (ui.phase === "submitting") return "sf.u13.submitting"
    if (ui.phase === "verifying") return "sf.u13.verifying"
    if (ui.phase === "producer-confirmed") return "sf.u13.producerConfirmed"
    if (ui.phase === "failed") return ui.failure === "denied" ? "sf.u13.denied" :
      ui.failure === "not-found" ? "sf.u13.notFound" :
      ui.failure === "stale" ? "sf.u13.stale" : "sf.u13.writeFailure"
    switch (viewState()) {
      case "loading": return "sf.u13.loading"
      case "empty": return "sf.u13.empty"
      case "filtered-empty": return "sf.u13.filteredEmpty"
      case "denied": return "sf.u13.denied"
      case "session-expired": return "sf.u13.sessionExpired"
      case "not-found": return "sf.u13.notFound"
      case "invalid": return "sf.u13.notSubmitted"
      case "stale": return "sf.u13.stale"
      case "conflict": return "sf.u13.conflict"
      case "unavailable": return "sf.u13.unavailable"
      default: return "sf.u13.submitted"
    }
  }

  const beginReview = (decision: PrDecision) => {
    if (ui.pending || ui.conflictReview || actionBusy || ui.phase === "outcome-unknown" || ui.phase === "source-changed") return
    const candidate = selectedPr()
    const edit = decisionDraft()
    const editState = edit?.snapshot()
    if (!candidate || !candidate.actions.includes(decision) ||
        !edit || editState?.availability !== "active" ||
        editState.pendingOperation || editState.conflict || editState.value.commandStarted) return
    edit.setPhase("reviewing")
    setUi("review", { source: candidate, decision, intentRef: crypto.randomUUID() as SfIntentRef })
    setUi("phase", "reviewing")
    setUi("failure", null)
  }

  const confirm = async (admitted: AdmittedReview) => {
    const intent = ui.review
    const token = authority()
    if (actionBusy || ui.pending || ui.conflictReview || !intent || !token || !intent.source.actions.includes(intent.decision)) return
    const operation = intent.decision === "approve" ? "domain.command.CAP26.approve" : "domain.command.CAP26.reject"
    if (admitted.purpose !== intent.decision ||
        admitted.binding.kind !== "catalog-command" ||
        admitted.binding.operationId !== operation ||
        admitted.binding.version.kind !== "record" ||
        admitted.binding.version.expectedVersion !== intent.source.version) return
    if (intent.decision === "reject" && !decisionValue()?.reason.trim()) {
      setUi("failure", "invalid")
      return
    }
    actionBusy = true
    actionController?.abort()
    const controller = new AbortController()
    actionController = controller
    setUi("phase", "checking")
    const ready = host.ready()
    const before = ready && await sourceRead(token, intent.source.requestRef, controller.signal)
    if (!ready || controller.signal.aborted || authority() !== token) { actionBusy = false; return }
    if (!before || before.kind !== "ok" ||
        !samePrReview(intent.source, findSubmittedPr(before.page, intent.source.requestRef))) {
      setUi("review", null)
      setUi("phase", "conflict")
      actionBusy = false
      return
    }
    const after = findSubmittedPr(before.page, intent.source.requestRef)
    if (after.kind !== "submitted-pr" || !after.actions.includes(intent.decision)) {
      setUi("review", null)
      setUi("phase", "conflict")
      actionBusy = false
      return
    }

    // Exactly one idempotency key for one explicit command. If the response is
    // lost, the command is NEVER dispatched again, even with the same key.
    const idempotencyKey = crypto.randomUUID()
    const operationRef = crypto.randomUUID()
    const note = intent.decision === "reject" ? (decisionValue()?.reason.trim() ?? "") :
      (decisionValue()?.comment ?? "")
    const draftBefore = decisionDraft()
    const snapshotBefore = draftBefore?.snapshot()
    if (!draftBefore || snapshotBefore?.availability !== "active" ||
        snapshotBefore.pendingOperation || snapshotBefore.conflict ||
        snapshotBefore.value.commandStarted ||
        snapshotBefore.baseVersion !== intent.source.version) {
      setUi("review", null)
      setUi("phase", "conflict")
      actionBusy = false
      return
    }
    const payload = { page: "My approvals", action: intent.decision,
      id: intent.source.requestRef, version: intent.source.version,
      values: intent.decision === "reject" ? { reason: note } : note ? { comment: note } : {} }
    let payloadDigest: string
    try {
      const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload))))
      payloadDigest = Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("")
    } catch {
      setUi("phase", "failed")
      setUi("failure", "unavailable")
      actionBusy = false
      return
    }
    if (controller.signal.aborted || authority() !== token) { actionBusy = false; return }
    // Mark local dirty before network dispatch so the owner-level LeaveGuard
    // cannot discard an in-flight command. No replay is ever initiated.
    draftBefore.edit({ ...snapshotBefore.value, commandStarted: true })
    setUi("pending", { source: intent.source, decision: intent.decision,
      key: idempotencyKey, note, operationRef, producerAcknowledged: false })
    setUi("phase", "submitting")
    try {
      const client = createSfProcurementClient(ready.transport)
      const options = { signal: controller.signal, idempotencyKey }
      const result = intent.decision === "approve"
        ? await client["domain.command.CAP26.approve"]({
            page: "My approvals", action: "approve", id: intent.source.requestRef,
            version: intent.source.version, values: note ? { comment: note } : {},
          }, options)
        : await client["domain.command.CAP26.reject"]({
            page: "My approvals", action: "reject", id: intent.source.requestRef,
            version: intent.source.version, values: { reason: note },
          }, options)
      if (controller.signal.aborted || authority() !== token) return
      if (result.kind === "transport-error") {
        const draft = decisionDraft()
        draft?.setPending({ operationRef: operationRef as SfOperationRef,
          idempotencyKey, payloadDigest, expectedVersion: intent.source.version })
        draft?.setPhase("outcome-unknown")
        setUi("phase", "outcome-unknown")
        return
      }
      if (result.status !== 200 || !result.body.ok) {
        const status = result.body.ok ? result.status : result.body.status
        const draft = decisionDraft()
        const state = draft?.snapshot()
        if (draft && state?.availability === "active" && !state.pendingOperation) {
          draft.edit({ ...state.value, commandStarted: false })
          draft.setPhase("failed")
        }
        console.error("Procurement approval was rejected", status)
        setUi("pending", null)
        setUi("review", null)
        setUi("conflictReview", status === 409 ? {
          requestRef: intent.source.requestRef, decision: intent.decision, note, version: intent.source.version,
          currentVersion: !result.body.ok && typeof result.body.currentVersionCAS === "number"
            ? result.body.currentVersionCAS : null,
          status: null, admitted: null,
        } : null)
        setUi("phase", status === 409 ? "conflict" : "failed")
        setUi("failure", status === 401 || status === 403 ? "denied" :
          status === 404 ? "not-found" : status === 409 ? "stale" :
          status === 422 ? "invalid" : "unavailable")
        if (status === 401 || status === 403 || status === 404) setUi("page", null)
        return
      }
      const draft = decisionDraft()
      if (draft && draft.snapshot().availability === "active") draft.discard()
      setUi("pending", (pending) => pending ? { ...pending, producerAcknowledged: true } : pending)
      setUi("phase", "verifying")
      const refreshed = await sourceRead(token, intent.source.requestRef, controller.signal)
      if (controller.signal.aborted || authority() !== token) return
      if (refreshed.kind !== "ok") {
        // 200 is a command acknowledgement; refetch is still needed for display.
        setUi("phase", "producer-confirmed")
        return
      }
      setUi("page", null)
      setUi("page", refreshed.page)
      setUi("state", "ready")
      setUi("review", null)
      if (sourceChangedAfterIntent(intent.source, refreshed.page)) setUi("pending", null)
      setUi("phase", "producer-confirmed")
      // No C12 receipt: source reflects what is currently persisted, not an
      // invented financial approval receipt or claim about downstream M31/MI07.
    } catch {
      if (!controller.signal.aborted && authority() === token) {
        const draft = decisionDraft()
        draft?.setPending({ operationRef: operationRef as SfOperationRef,
          idempotencyKey, payloadDigest, expectedVersion: intent.source.version })
        draft?.setPhase("outcome-unknown")
        setUi("phase", "outcome-unknown")
      }
    } finally {
      actionBusy = false
    }
  }

  const reconcile = async () => {
    const pending = ui.pending
    const token = authority()
    if (!pending || !token || actionBusy) return
    actionBusy = true
    const controller = new AbortController()
    actionController = controller
    const reread = await sourceRead(token, pending.source.requestRef, controller.signal)
    if (!controller.signal.aborted && authority() === token) {
      if (reread.kind === "ok") {
        setUi("page", null)
        setUi("page", reread.page)
        setUi("state", "ready")
        setUi("phase", pending.producerAcknowledged ? "producer-confirmed" :
          sourceChangedAfterIntent(pending.source, reread.page) ? "source-changed" : "outcome-unknown")
      } else if (reread.kind === "denied" || reread.kind === "session-expired" || reread.kind === "not-found") {
        setUi("page", null)
        setUi("review", null)
        setUi("state", reread.kind === "session-expired" ? "session-expired" : reread.kind)
      }
    }
    actionBusy = false
  }

  /** A restored F01 draft may retain a lost operation across chapter changes. */
  const reconcileAbandoned = async () => {
    const token = authority()
    const source = selectedPr()
    const state = decisionDraft()?.snapshot()
    if (!token || !source || state?.availability !== "active" ||
        (!state.pendingOperation && !state.value.commandStarted) || actionBusy) return
    actionBusy = true
    const controller = new AbortController()
    actionController = controller
    const result = await sourceRead(token, source.requestRef, controller.signal)
    if (!controller.signal.aborted && authority() === token) {
      if (result.kind === "ok") {
        setUi("page", null)
        setUi("page", result.page)
        setUi("state", "ready")
        const later = findSubmittedPr(result.page, source.requestRef)
        setUi("phase", later.kind === "not-submitted" ||
          (later.kind === "submitted-pr" && later.version !== state.baseVersion)
          ? "source-changed" : "outcome-unknown")
      } else if (result.kind === "denied" || result.kind === "session-expired") {
        setUi("page", null)
        setUi("state", result.kind)
      }
    }
    actionBusy = false
  }

  const reviewConflictSource = async () => {
    const conflict = ui.conflictReview, token = authority()
    if (!conflict || !token || actionBusy) return
    actionBusy = true
    actionController?.abort()
    const controller = new AbortController()
    actionController = controller
    const result = await sourceRead(token, conflict.requestRef, controller.signal)
    if (controller.signal.aborted || authority() !== token) { actionBusy = false; return }
    if (result.kind !== "ok") {
      console.error("Procurement approval conflict read failed", result.kind)
      setUi("failure", result.kind === "denied" || result.kind === "session-expired" ? "denied" : "unavailable")
      if (result.kind === "denied" || result.kind === "session-expired") {
        setUi("conflictReview", null)
        setUi("page", null)
        setUi("state", result.kind)
      }
      actionBusy = false
      return
    }
    const records = result.page.value.data.requests.filter((record) => record.number === conflict.requestRef)
    const version = result.page.value.versions["requests:" + conflict.requestRef]?.version
    if (records.length !== 1 || typeof version !== "number" || !Number.isSafeInteger(version)) {
      console.error("Procurement approval conflict source is unavailable")
      setUi("failure", "unavailable")
      actionBusy = false
      return
    }
    const current = findSubmittedPr(result.page, conflict.requestRef)
    setUi("conflictReview", { ...conflict, currentVersion: version, status: records[0]!.status,
      admitted: current.kind === "submitted-pr" && current.actions.includes(conflict.decision) })
    actionBusy = false
  }

  const onBack = () => {
    if (ui.detailPage) {
      setUi("detailPage", false)
      return
    }
    if (props.route.kind !== "entry" && props.route.query.returnTo) {
      navigate(props.route.query.returnTo)
      return
    }
    setUi("selected", null)
    setUi("review", null)
    setUi("phase", "idle")
  }

  const recordDetail = () => {
    const review = selectedPr()
    if (!review) return (
      <SfStatePanel state={current()?.kind === "not-found" ? "not-found" : "unavailable"} messageKey={key("sf.u13.notFound")} />
    )
    const holder = review.holderId === null ? t("sf.u13.unassigned") :
      review.holderName ?? review.holderId
    return (
      <SfRecordDetail
        title={data(review.request.pr?.title || review.requestRef)}
        secondaryId={data(review.requestRef)}
        status={{ code: "pr_pending", text: data(t("sf.u13.submitted")), tone: "info" }}
        metadata={[
          { id: "version", label: label("sf.u13.version"), value: { kind: "number", value: review.version, unit: { kind: "unspecified", label: label("sf.u13.version") }, fractionDigits: 0 } },
          { id: "holder", label: label("sf.u13.holder"), value: textField(holder) },
          { id: "step", label: label("sf.u13.stage"), value: textField(review.levelName) },
          { id: "amount", label: label("sf.u13.amount"), value: { kind: "number", value: review.amount, unit: review.baseCurrency ? { kind: "currency", code: review.baseCurrency } : { kind: "unspecified", label: label("sf.u13.baseCurrency") }, fractionDigits: 2 } },
          { id: "reason", label: label("sf.u13.justification"), value: textField(review.request.pr?.justification) },
          { id: "created", label: label("sf.u13.createdBy"), value: textField(review.request.createdBy) },
        ]}
        sections={[
          { id: "submitted-version", titleKey: key("sf.u13.currentRecord"), state: "ready",
            content: <dl><dt>{t("sf.u13.version")}</dt><dd>{review.version}</dd><dt>{t("sf.u13.holder")}</dt><dd>{holder}</dd></dl> },
          { id: "amount-fx-delta", titleKey: key("sf.u13.fx"), state: review.baseCurrency ? "ready" : "partial",
            content: <p>{review.baseCurrency ? String(review.amount) + " " + review.baseCurrency : t("sf.u13.fxMissing")}</p> },
          { id: "offer-comparison", titleKey: key("sf.u13.offerComparison"), state: "empty",
            content: <p>{t("sf.u13.notApplicable")}</p> },
          { id: "conditions", titleKey: key("sf.u13.conditions"), state: "ready",
            content: <p>{review.request.pr?.justification || t("sf.u13.unknownValue")}</p> },
          { id: "decision-review", titleKey: key("sf.u13.decision"), state: "ready",
            content: <p>{t("sf.u13.proofSeparate")}</p> },
        ]}
        primaryAction={review.actions.includes("approve") && !ui.pending ? {
          id: "approve", labelKey: key("sf.u13.review"), tone: "primary",
          disabled: !review.actions.includes("approve") || ui.phase === "submitting", busy: actionBusy,
          onInvoke: () => beginReview("approve"),
        } : undefined}
        secondaryActions={review.actions.includes("reject") && !ui.pending ? [{
          id: "reject", labelKey: key("sf.u13.reject"), tone: "danger",
          disabled: !review.actions.includes("reject") || ui.phase === "submitting",
          busy: actionBusy, onInvoke: () => beginReview("reject"),
        }] : []}
        sourceActions={[]}
        onBack={onBack}
        onOpenPage={() => setUi("detailPage", true)}
      />
    )
  }

  return (
    <SfPageFrame
      titleKey={key("sf.cap26.title")}
      context={[]}
      tabs={[]}
      activeTab={null}
      secondaryActions={[]}
      density="comfortable"
      layout="split"
      onLayoutMode={(mode) => setUi("layoutMode", mode)}
    >
      <Show when={authorizedPage() && ui.conflictReview}>
        {(conflict) => <section data-sf-approval-conflict aria-label={t("sf.u13.conflict")}>
          <h2 tabindex="-1" ref={(element) => queueMicrotask(() => element.isConnected && element.focus())}>
            {t("sf.u13.currentRecord")}
          </h2>
          <p role="alert">{t("sf.u13.conflict")}</p>
          <p>{conflict().requestRef}</p>
          <p data-current-version-cas>{t("sf.u13.version")}: {conflict().currentVersion ?? t("sf.u13.unknownValue")}</p>
          <label>{t(conflict().decision === "approve" ? "sf.u13.comment" : "sf.u13.reason")}
            <textarea value={conflict().note} readOnly />
          </label>
          <button type="button" class="mx-btn" onClick={() => { void reviewConflictSource() }}>
            {t("sf.u13.refresh")}
          </button>
          <Show when={conflict().status}>
            <p data-sf-current-status>{t("sf.u13.status")}: {conflict().status}</p>
          </Show>
          <Show when={conflict().admitted === false}>
            <p role="status">{t("sf.u13.actionUnavailable")}</p>
          </Show>
          <Show when={ui.failure === "unavailable"}>
            <p role="alert">{t("sf.u13.readFailure")}</p>
          </Show>
          <button type="button" class="mx-btn" disabled>
            {t(conflict().decision === "approve" ? "sf.u13.approve" : "sf.u13.reject")}
          </button>
        </section>}
      </Show>
      <SfStatePanel
        state={ui.conflictReview ? "invalid" : viewState()}
        messageKey={key(stateMessage())}
        onRetryRead={() => {
          if (ui.pending) { void reconcile(); return }
          if (orphanPending()) { void reconcileAbandoned(); return }
          const token = authority()
          if (token) void refresh(token, routeRef() ?? undefined)
        }}
        onBack={onBack}
      >
        <Show when={authorizedPage()}>
          <section class="flex min-w-0 flex-col gap-3" data-sf-cap26="submitted-pr">
            <div class="flex flex-wrap items-end gap-3">
              <label class="flex min-w-32 flex-col gap-1 text-sm">
                <span>{t("sf.u13.filtered")}</span>
                <select class="rounded-md border border-border bg-background p-2 text-foreground"
                  value={ui.group} onChange={(event) => setUi("group", event.currentTarget.value as PrGroup | "all")}>
                  <option value="all">{t("sf.u13.all")}</option>
                  <option value="you">{t("sf.u13.yourQueue")}</option>
                  <option value="others">{t("sf.u13.othersQueue")}</option>
                  <option value="unassigned">{t("sf.u13.unassigned")}</option>
                </select>
              </label>
              <label class="flex min-w-44 flex-1 flex-col gap-1 text-sm">
                <span>{t("sf.u13.search")}</span>
                <input class="rounded-md border border-border bg-background p-2 text-foreground"
                  type="search" value={ui.search} onInput={(event) => setUi("search", event.currentTarget.value)} />
              </label>
              <button type="button" class="rounded-md border border-border px-3 py-2 text-sm"
                onClick={() => { const token = authority(); if (token) void refresh(token, routeRef() ?? undefined) }}>
                {t("sf.u13.refresh")}
              </button>
            </div>
            <Show when={!ui.detailPage} fallback={recordDetail()}>
            <SfListDetail
              selectedRef={selectedPr()?.requestRef as SfRef | undefined}
              layoutMode={ui.layoutMode}
              onBack={onBack}
              onOpenPage={() => setUi("detailPage", true)}
              list={<SfDataTable
                rows={visibleRows()}
                getRowKey={(row) => row.number as SfRef}
                columns={[
                  { id: "number", labelKey: key("sf.u13.request"), align: "start", widthPolicy: { kind: "content", minPx: 92, maxPx: 180 }, render: (row) => row.number ?? t("sf.u13.unknownValue") },
                  { id: "title", labelKey: key("sf.u13.title"), align: "start", widthPolicy: { kind: "flex", minPx: 150, weight: 1 }, render: (row) => row.pr?.title || t("sf.u13.unknownValue") },
                  { id: "status", labelKey: key("sf.u13.stage"), align: "start", widthPolicy: { kind: "content", minPx: 120, maxPx: 220 }, render: (row) => row.status === "pr_pending" ? t("sf.u13.submitted") : t("sf.u13.unknownValue") },
                ]}
                selectedKey={selectedPr()?.requestRef as SfRef | undefined}
                sort={{ kind: "none" }}
                page={{ kind: "none", total: visibleRows().length }}
                onSort={() => undefined}
                onPage={() => undefined}
                onSelect={(recordRef) => {
                  if (ui.pending) return
                  setUi("selected", recordRef)
                  setUi("detailPage", false)
                  setUi("review", null)
                  setUi("phase", "idle")
                }}
                rowActions={() => []}
                onRowAction={() => undefined}
                captionKey={key("sf.cap26.title")}
                density="comfortable"
                state={viewState()}
              />}
              detail={recordDetail()}
            />
            </Show>
            <Show when={(ui.review && selectedPr()) ? (samePrReview(ui.review.source, selectedPr()!) ? ui.review : undefined) : undefined}>
              {(_) => {
                const review = ui.review!
                const approved = review.decision === "approve"
                const canConfirm = review.source.actions.includes(review.decision) && (approved || (decisionValue()?.reason.trim().length ?? 0) > 0)
                const persisted = snapshot(review.source)
                const admitted: AdmittedReview = {
                  kind: "admitted",
                  labelKey: key(approved ? "sf.u13.approve" : "sf.u13.reject"),
                  purpose: review.decision,
                  binding: {
                    kind: "catalog-command",
                    operationId: approved ? "domain.command.CAP26.approve" : "domain.command.CAP26.reject",
                    version: { kind: "record", expectedVersion: review.source.version },
                    confirmation: "presentation-only",
                  },
                }
                return (
                  <section class="min-w-0 rounded-lg border border-border p-3" aria-label={t("sf.u13.decision")}>
                    <label class="flex flex-col gap-1 text-sm">
                      <span>{t(approved ? "sf.u13.comment" : "sf.u13.reason")}</span>
                      <textarea class="min-h-20 rounded-md border border-border bg-background p-2 text-foreground"
                        value={approved ? decisionValue()?.comment ?? "" : decisionValue()?.reason ?? ""}
                        onInput={(event) => {
                          const draft = decisionDraft()
                          const state = draft?.snapshot()
                          if (draft && state?.availability === "active" && !state.pendingOperation)
                            draft.edit({ ...state.value, [approved ? "comment" : "reason"]: event.currentTarget.value })
                        }}
                        disabled={ui.phase === "submitting" || ui.phase === "checking"} />
                    </label>
                    <SfChangeReview
                      operation={{ ref: (ui.pending?.operationRef ?? review.source.requestRef) as Parameters<typeof SfChangeReview>[0]["operation"]["ref"],
                        label: label(approved ? "sf.u13.approve" : "sf.u13.reject"),
                        scope: data(review.source.requestRef) }}
                      base={persisted}
                      current={persisted}
                      proposed={{
                        kind: "draft", intentRef: review.intentRef,
                        sourceRef: persisted.kind === "persisted" ? persisted.ref : null,
                        sourceVersion: review.source.version,
                        fields: [
                          ...(persisted.kind === "persisted" ? persisted.fields : []),
                          { path: "decision", label: label("sf.u13.decision"),
                            value: textField(t(approved ? "sf.u13.approve" : "sf.u13.reject")) },
                          { path: approved ? "comment" : "reason",
                            label: label(approved ? "sf.u13.comment" : "sf.u13.reason"),
                            value: textField(approved ? decisionValue()?.comment : decisionValue()?.reason) },
                        ],
                      }}
                      effects={[{
                        id: review.decision, domain: "procurement",
                        title: { kind: "message", message: label(approved ? "sf.u13.approve" : "sf.u13.reject") },
                        state: "proposed", details: [],
                      }]}
                      coverage={{
                        state: review.source.baseCurrency ? "complete" : "partial",
                        summary: label("sf.u13.coverage"),
                        reasons: review.source.baseCurrency ? [] : [label("sf.u13.fxMissing")],
                        knownCount: review.source.baseCurrency ? 1 : 0, expectedCount: 1,
                      }}
                      blockingReasons={canConfirm ? [] : [label("sf.u13.reasonRequired")]}
                      confirmation={canConfirm ? admitted : {
                        kind: "blocked", labelKey: key("sf.u13.review"), reasons: [label("sf.u13.reasonRequired")],
                      }}
                      state={ui.phase === "submitting" || ui.phase === "checking" ? "loading" : "ready"}
                      onConfirm={(decision) => { void confirm(decision) }}
                      onRevise={() => setUi("phase", "reviewing")}
                      onCancel={() => { if (!ui.pending && !actionBusy) setUi("review", null) }}
                    />
                  </section>
                )
              }}
            </Show>
            <Show when={orphanPending()}>
              <section class="rounded-lg border border-border p-3" role="status">
                <p>{t("sf.u13.unknown")}</p>
                <p>{t("sf.u13.noReceipt")}</p>
                <Show when={restoredOperation()}>
                  {(operation) => (
                    <SfReceiptView
                      operationRef={operation().operationRef}
                      producerStatus={{ kind: "pending" }}
                      effects={[]}
                      receipts={[]}
                      state="outcome-unknown"
                      onReconcileRead={() => { void reconcileAbandoned() }}
                    />
                  )}
                </Show>
                <button type="button" class="rounded-md border border-border px-3 py-2"
                  onClick={() => { void reconcileAbandoned() }}>{t("sf.u13.reconcile")}</button>
              </section>
            </Show>
            <Show when={ui.pending}>
              {(pending) => <div class="rounded-lg border border-border p-3" aria-live="polite">
                <p>{t(stateMessage())}</p>
                <p>{t("sf.u13.noReceipt")}</p>
                <SfReceiptView
                  operationRef={pending().operationRef as Parameters<typeof SfReceiptView>[0]["operationRef"]}
                  producerStatus={{ kind: "pending" }}
                  effects={[]}
                  receipts={[]}
                  state={ui.phase === "outcome-unknown" || ui.phase === "source-changed" ? "outcome-unknown" : "partial"}
                  onReconcileRead={() => { void reconcile() }}
                />
                <button type="button" class="mt-2 rounded-md border border-border px-3 py-2"
                  onClick={() => { void reconcile() }}>{t("sf.u13.reconcile")}</button>
              </div>}
            </Show>
          </section>
        </Show>
      </SfStatePanel>
    </SfPageFrame>
  )
}
