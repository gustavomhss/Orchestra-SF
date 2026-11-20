import { createEffect, createMemo, createUniqueId, For, onCleanup, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { createSfProcurementClient } from "@orchestra/client/sucafina/procurement"
import type { SfEditScopeKey, SfIntentRef, SfOperationRef, SfRef } from "@orchestra/schema/sucafina/context"
import type { SfSurfaceProps } from "../../context/contracts"
import { useSfContext } from "../../context"
import { encodeSfRouteRef } from "../../navigation-state"
import { SfPageFrame } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { SfDataTable, type SfColumn, type SfCopyKey as SfTableCopyKey, type SfSort, type SfUiState } from "../../shared/table"
import { SfChangeReview, type SfReviewField, type SfReviewSnapshot } from "../../shared/change-review"
import { SfBoundAssets } from "../../shared/attachments/bound-assets"
import { SfRequestTitleEdit } from "./title" // W19 protected: never duplicated/modified here
import { sfDraftConflicted, sfDraftForEdit, sfRetainDraft } from "../draft-conflict"
import { SfRequisitionForm, SfPurchaseOrderForm } from "./forms"
import { SF_U11_REMAINING_COPY } from "./copy"
import {
  decodeRequestsPage, displayScalar, isPoWritable, isPrWritable, poFromRecord, postedPoLine, prFromRecord,
  requestRef, requestVersion, uiCommandAction, validatePo, validatePr,
  type SfPoEdit, type SfPrEdit, type SfRequest, type SfRequestCommand, type SfRequestsRead,
} from "./model"
import "./requests.css"

type Key = keyof typeof SF_U11_REMAINING_COPY
type Ready = Extract<SfRequestsRead, { kind: "ready" }>
type EditKind = "pr" | "po"
type Review = Readonly<{
  action: SfRequestCommand
  ref: SfRef | undefined
  version: number
  status: string
  pr: SfPrEdit | undefined
  po: SfPoEdit | undefined
  reason: string
  operationRef: SfOperationRef
  intentRef: SfIntentRef
  idempotencyKey: string
}>
const copyKey = (key: Key) => key as Parameters<typeof SfStatePanel>[0]["messageKey"]
const tableKey = (value: Key) => value as unknown as SfTableCopyKey
const message = (key: Key) => ({ key: copyKey(key) })
const dataText = (text: string) => ({ kind: "data", text } as const)
const prScope = "pr.details" as SfEditScopeKey
const poScope = "po.fields" as SfEditScopeKey
const PR_FIELDS = [
  "title", "type", "description", "estAmount", "costCenter", "needBy",
  "justification", "recurring", "frequency", "estAnnual", "expenseType", "category",
] as const satisfies readonly (keyof SfPrEdit)[]
const PO_FIELDS = [
  "currency", "expenseType", "supplier", "supplierId", "description", "lines",
  "paymentTerms", "deliveryDate", "deliveryConditions", "contractRef",
  "incoterm", "incoterms", "assetRef", "supplierContact", "quoteRef",
  "billingAddress", "deliveryAddress", "acceptance", "warranty", "notes",
] as const satisfies readonly (keyof SfPoEdit)[]
const actionKey: Record<SfRequestCommand, Key> = {
  create: "sf.u11.remaining.new",
  "save-pr": "sf.u11.remaining.savePr",
  "save-po": "sf.u11.remaining.savePo",
  submit_pr: "sf.u11.remaining.submitPr",
  submit_po: "sf.u11.remaining.submitPo",
  issue: "sf.u11.remaining.issue",
  cancel: "sf.u11.remaining.cancel",
  delete: "sf.u11.remaining.delete",
}
function fieldsOf(values: SfPrEdit | SfPoEdit | undefined, kind: EditKind): readonly SfReviewField[] {
  if (!values) return []
  const fields = kind === "pr" ? PR_FIELDS : PO_FIELDS
  return fields.filter((field) => Object.prototype.hasOwnProperty.call(values, field)).map((field) => {
    const actual = (values as Record<string, unknown>)[field]
    return {
      path: kind + "." + field,
      label: message(("sf.u11.remaining.field." + field) as Key),
      value: actual === undefined || actual === null
        ? { kind: "missing" as const, reason: message("sf.u11.remaining.noSource") }
        : { kind: "text" as const, text: dataText(
          typeof actual === "object" ? JSON.stringify(actual) : String(actual),
        ) },
    }
  })
}
function stageOf(status: string): "pr" | "sourcing" | "po" | "closed" {
  if (status.startsWith("pr_") || status === "draft") return "pr"
  if (status.startsWith("src_") || status === "sourcing") return "sourcing"
  if (status.startsWith("po_")) return "po"
  return "closed"
}

export type RequestsDispatchFence = Readonly<{
  reviewing: object | undefined
  mode: "create" | "pr" | "po"
  newIntentRef: SfIntentRef
  ref: SfRef | undefined
  sourceRevision: string
  stage: ReturnType<typeof stageOf>
  version: number | undefined
  row: object | undefined
  ownerKey: string | undefined
  epoch: number
  prController: object | undefined
  poController: object | undefined
  payload: string
}>

/** The reviewed row, source and draft owner must survive the digest unchanged. */
export function sameRequestsDispatchFence(before: RequestsDispatchFence, after: RequestsDispatchFence): boolean {
  return before.reviewing === after.reviewing &&
    before.mode === after.mode && before.newIntentRef === after.newIntentRef &&
    before.ref === after.ref && before.sourceRevision === after.sourceRevision &&
    before.stage === after.stage && before.version === after.version &&
    before.row === after.row && before.ownerKey === after.ownerKey &&
    before.epoch === after.epoch && before.prController === after.prController &&
    before.poController === after.poController && before.payload === after.payload
}

export function SfRequestsPage(props: SfSurfaceProps<"CAP25">) {
  const sf = useSfContext()
  const language = useLanguage()
  const searchId = createUniqueId()
  const reasonId = createUniqueId()
  const [view, setView] = createStore({
    state: "loading" as SfUiState,
    read: undefined as Ready | undefined,
    selected: undefined as SfRef | undefined,
    creating: false,
    filter: "",
    sort: { kind: "none" } as SfSort,
    refresh: 0,
    layoutMode: "split" as "single" | "split" | "split-context",
    reviewing: undefined as Review | undefined,
    reason: "",
    sending: false,
    outcomeUnknown: false,
    notice: undefined as Key | undefined,
    newIntentRef: crypto.randomUUID() as SfIntentRef,
  })
  let inFlight: AbortController | undefined
  const t = (key: Key) => language.t(key as Parameters<typeof language.t>[0])
  const routeRef = () => props.route.kind !== "entry" && props.route.kind !== "new"
    ? props.route.params.requestRef : undefined
  const selectedRef = () => routeRef() ?? view.selected
  const creating = () => props.route.kind === "new" || view.creating
  const sourceAvailable = () => view.state === "ready" && !!view.read
  const ownerMatches = (ownerKey: string, epoch: number) => {
    const current = sf.state()
    return sf.generation() === epoch && current.status === "ready" && current.ownerKey === ownerKey
  }
  const contextActions = () =>
    sf.ready()?.context.destinations.find((item) => item.capabilityId === "CAP25" && item.canRead)?.allowedActionIds ?? []
  const actionAllowed = (action: SfRequestCommand) => {
    const original = uiCommandAction(action)
    return !!view.read && contextActions().includes(original) && view.read.actionIds.includes(original) &&
      sf.ready()?.context.availability.some((resource) => resource.family === "procurement" && resource.resource === "CAP25" &&
        resource.state !== "denied" && resource.state !== "unavailable" && resource.operations.some((operation) =>
          operation.operationId === "domain.command.CAP25." + original && operation.state === "ready" && operation.operational)) === true
  }
  const row = createMemo(() => view.read?.records.find((item) => requestRef(item) === selectedRef()))
  const version = () => {
    const ref = selectedRef()
    return ref && view.read ? requestVersion(view.read, ref) : undefined
  }
  const canPr = () => !!row() && isPrWritable(row()!) && actionAllowed("save-pr")
  const canPo = () => !!row() && isPoWritable(row()!) && actionAllowed("save-po")
  const stage = () => row() ? stageOf(row()!.status) : "pr"
  const sourceRevision = () => JSON.stringify({
    row: row(), version: version(), actionIds: view.read?.actionIds, stamp: sf.ready()?.context.stamp,
  })
  const stageHref = (ref: SfRef, part: "detail" | "requisition" | "po" | "history" | "sourcing" | "quotes") => {
    const url = new URL(props.route.href, "http://orchestra.invalid")
    const query = new URLSearchParams()
    for (const param of ["server", "project", "installation"])
      if (url.searchParams.has(param)) query.set(param, url.searchParams.get(param)!)
    return "/orchestra/sf-procurement/requests/" + encodeSfRouteRef(ref) +
      (part === "detail" ? "" : "/" + part) + (query.size ? "?" + query.toString() : "")
  }

  createEffect(() => {
    const owner = sf.state()
    const ready = sf.ready()
    const epoch = sf.generation()
    const targetRef = routeRef()
    void view.refresh
    setView({ read: undefined, state: "loading", reviewing: undefined, sending: false, notice: undefined })
    if (owner.status !== "ready" || !ready) {
      setView("state", owner.status === "denied" ? "denied" :
        owner.status === "unauthenticated" ? "session-expired" : "unavailable")
      return
    }
    if (!ready.context.destinations.some((item) => item.capabilityId === "CAP25" && item.canRead)) {
      setView("state", "denied")
      return
    }
    const abort = new AbortController()
    const client = createSfProcurementClient(ready.transport)
    const ownerKey = owner.ownerKey
    void client["domain.page.CAP25"](targetRef ? { request: targetRef } : {}, { signal: abort.signal })
      .then((response) => {
        if (abort.signal.aborted || !ownerMatches(ownerKey, epoch)) return
        if (response.kind !== "response") { setView("state", "unavailable"); return }
        if (response.status === 401) { setView("state", "session-expired"); void sf.reload(); return }
        if (response.status === 403) { setView("state", "denied"); sf.invalidate("revoked"); return }
        const decoded = decodeRequestsPage(response.body, ready.context.stamp)
        if (decoded.kind !== "ready") {
          setView("state", decoded.kind === "unauthenticated" ? "session-expired" :
            decoded.kind === "invalid" ? "invalid" : decoded.kind)
          if (decoded.kind === "denied") sf.invalidate("revoked")
          return
        }
        setView({ read: decoded, state: "ready" })
        const id = targetRef ?? view.selected
        if (id && !decoded.records.some((record) => requestRef(record) === id))
          setView("state", "unavailable") // filtered/redacted absence != not-found
      })
      .catch((error) => {
        if (abort.signal.aborted || !ownerMatches(ownerKey, epoch)) return
        console.error("CAP25 authorized read failed", error)
        setView("state", "unavailable")
      })
    onCleanup(() => abort.abort())
  })

  createEffect(() => {
    void sf.generation()
    onCleanup(() => inFlight?.abort())
  })
  onCleanup(() => inFlight?.abort())

  const prDraft = createMemo(() => {
    const currentRow = row()
    const currentVersion = version()
    const ready = sf.ready()
    if (!ready || sf.state().status !== "ready" || !sourceAvailable() ||
        !(creating() ? actionAllowed("create") : actionAllowed("save-pr")) ||
        (!creating() && (!currentRow || !isPrWritable(currentRow) || currentVersion === undefined))) return undefined
    const original = prFromRecord(creating() ? undefined : currentRow)
    const selection = { surfaceId: "CAP25" as const,
      identity: creating() ? { kind: "new" as const, newIntentRef: view.newIntentRef } :
        { kind: "record" as const, recordRef: selectedRef()! }, editScopeKey: prScope }
    return sfRetainDraft<SfPrEdit>(ready.drafts, {
      ...selection,
      baseVersion: creating() ? null : currentVersion!,
      base: creating() ? null : original,
      value: original,
      revalidation: {
        operationId: "domain.page.CAP25",
        input: creating() ? {} : { request: selectedRef()! },
        fieldPaths: creating() ? [] : PR_FIELDS.filter((field) =>
          field !== "title" && currentRow?.pr?.[field] !== undefined).map((field) => "pr." + field),
        actionIds: [creating() ? "create" : "save"],
      },
    })
  })
  const poDraft = createMemo(() => {
    const currentRow = row()
    const currentVersion = version()
    const ready = sf.ready()
    if (!ready || sf.state().status !== "ready" || !sourceAvailable() ||
        !currentRow || !isPoWritable(currentRow) || currentVersion === undefined ||
        !actionAllowed("save-po")) return undefined
    const original = poFromRecord(currentRow)
    const selection = { surfaceId: "CAP25" as const,
      identity: { kind: "record" as const, recordRef: selectedRef()! }, editScopeKey: poScope }
    return sfRetainDraft<SfPoEdit>(ready.drafts, {
      ...selection,
      baseVersion: currentVersion,
      base: original,
      value: original,
      revalidation: {
        operationId: "domain.page.CAP25",
        input: { request: selectedRef()! },
        fieldPaths: PO_FIELDS.filter((field) => currentRow.po?.[field] !== undefined)
          .map((field) => "po." + field),
        actionIds: ["save"],
      },
    })
  })
  const activePr = () => {
    const snapshot = prDraft()?.snapshot()
    return sfDraftForEdit(snapshot, creating() ? null : version())
  }
  const activePo = () => {
    const snapshot = poDraft()?.snapshot()
    return sfDraftForEdit(snapshot, version())
  }
  const prConflict = () => sfDraftConflicted(prDraft()?.snapshot(), creating() ? null : version())
  const poConflict = () => sfDraftConflicted(poDraft()?.snapshot(), version())
  const prPending = () => { const state = prDraft()?.snapshot(); return state?.availability === "active" && !!state.pendingOperation }
  const poPending = () => { const state = poDraft()?.snapshot(); return state?.availability === "active" && !!state.pendingOperation }
  const editPr = (next: SfPrEdit) => {
    if (activePr() && !view.sending && !view.reviewing && !view.outcomeUnknown) prDraft()?.edit(next)
  }
  const editPo = (next: SfPoEdit) => {
    if (activePo() && !view.sending && !view.reviewing && !view.outcomeUnknown) poDraft()?.edit(next)
  }
  const stageAllowed = (action: SfRequestCommand, inCurrentDispatch = false) => {
    if (!sourceAvailable() || !actionAllowed(action) || view.outcomeUnknown ||
        (view.sending && !inCurrentDispatch) ||
        prConflict() || poConflict() || prPending() || poPending()) return false
    const current = row()
    if (action === "create") return creating() && !!activePr()
    if (!current || version() === undefined) return false
    if (action === "save-pr" || action === "submit_pr") return isPrWritable(current) && !!activePr()
    if (action === "save-po" || action === "submit_po") return isPoWritable(current) && !!activePo()
    if (action === "delete") return current.status === "draft"
    if (action === "cancel") return !["cancelled", "po_issued"].includes(current.status)
    if (action === "issue") return current.status === "po_approved"
    return false
  }
  const reviewAction = (action: SfRequestCommand) => {
    if (!stageAllowed(action) || view.reviewing) return
    const pr = action === "create" || action === "save-pr" || action === "submit_pr" ? activePr()?.value : undefined
    const po = action === "save-po" || action === "submit_po" ? activePo()?.value : undefined
    const reason = action === "cancel" ? view.reason.trim() : ""
    if (pr && !validatePr(pr, action === "create")) { setView("notice", "sf.u11.remaining.invalidPr"); return }
    if (po && !validatePo(po)) { setView("notice", "sf.u11.remaining.invalidPo"); return }
    if (action === "cancel" && !reason) { setView("notice", "sf.u11.remaining.requiredReason"); return }
    const currentRow = row()
    const review: Review = {
      action,
      ref: action === "create" ? undefined : selectedRef(),
      version: action === "create" ? 0 : version()!,
      status: currentRow?.status ?? "draft",
      pr: pr ? { ...pr } : undefined,
      po: po ? { ...po, ...(po.lines ? { lines: po.lines.map(postedPoLine) } : {}) } : undefined,
      reason,
      operationRef: crypto.randomUUID() as SfOperationRef,
      intentRef: crypto.randomUUID() as SfIntentRef,
      idempotencyKey: crypto.randomUUID(),
    }
    setView({ reviewing: review, notice: undefined })
    if (pr) prDraft()?.setPhase("reviewing")
    if (po) poDraft()?.setPhase("reviewing")
  }
  const refresh = () => setView("refresh", view.refresh + 1)
  const discardConflict = (kind: "pr" | "po") => {
    const ready = sf.ready(), ref = selectedRef(), controller = kind === "pr" ? prDraft() : poDraft()
    const snapshot = controller?.snapshot()
    if (!ready || (!ref && !(kind === "pr" && creating())) || snapshot?.availability !== "active" || snapshot.pendingOperation ||
        view.sending || view.outcomeUnknown) return
    const selection = { surfaceId: "CAP25" as const, identity: kind === "pr" && creating()
      ? { kind: "new" as const, newIntentRef: view.newIntentRef }
      : { kind: "record" as const, recordRef: ref! },
      editScopeKey: kind === "pr" ? prScope : poScope }
    ready.drafts.discard(selection)
    if (ready.drafts.peek(selection)) return
    setView({ read: undefined, state: "loading", reviewing: undefined })
    refresh()
  }
  const cancelReview = () => {
    if (view.sending) return
    prDraft()?.setPhase("dirty")
    poDraft()?.setPhase("dirty")
    setView("reviewing", undefined)
  }

  const confirm = async () => {
    const review = view.reviewing
    const actor = sf.state()
    const ready = sf.ready()
    if (!review || !ready || actor.status !== "ready" ||
        !stageAllowed(review.action) || !sourceAvailable() || view.sending) return
    if (review.action !== "create" && (!review.ref || version() !== review.version ||
        row()?.status !== review.status)) return
    const pr = review.pr
    const po = review.po
    if (pr && (!activePr() || JSON.stringify(activePr()?.value) !== JSON.stringify(pr) ||
        (review.ref && activePr()?.baseVersion !== review.version))) return
    if (po && (!activePo() || JSON.stringify(activePo()?.value) !== JSON.stringify(po) ||
        activePo()?.baseVersion !== review.version)) return
    // These are the originating controllers, not whichever row is selected after hashing.
    const prController = pr ? prDraft() : undefined
    const poController = po ? poDraft() : undefined
    if ((pr && !prController) || (po && !poController)) return
    const client = createSfProcurementClient(ready.transport)
    const ownerKey = actor.ownerKey
    const epoch = sf.generation()
    const abort = new AbortController()
    inFlight = abort
    setView("sending", true)

    const base = { page: "Requests" as const, version: review.version,
      ...(review.ref ? { id: review.ref } : {}) }
    const input = (() => {
      switch (review.action) {
        case "create": return { ...base, action: "create" as const, values: { pr: review.pr! } }
        case "save-pr": return { ...base, action: "save" as const, values: { pr: review.pr! } }
        case "save-po": return { ...base, action: "save" as const, values: { po: review.po! } }
        case "submit_pr": return { ...base, action: "submit_pr" as const, values: { pr: review.pr! } }
        case "submit_po": return { ...base, action: "submit_po" as const, values: { po: review.po! } }
        case "issue": return { ...base, action: "issue" as const, values: {} }
        case "cancel": return { ...base, action: "cancel" as const, values: { reason: review.reason } }
        case "delete": return { ...base, action: "delete" as const, values: {} }
      }
    })()
    const payloadJson = JSON.stringify(input)
    const fence: RequestsDispatchFence = {
      reviewing: review, mode: creating() ? "create" : stage() === "po" ? "po" : "pr",
      newIntentRef: view.newIntentRef, ref: selectedRef(), sourceRevision: sourceRevision(),
      stage: stage(), version: version(), row: row(), ownerKey, epoch,
      prController, poController, payload: payloadJson,
    }
    const declineBeforePost = () => {
      if (inFlight !== abort) return
      inFlight = undefined
      abort.abort()
      if (!ownerMatches(ownerKey, epoch)) return
      // Return only the originating draft to edit mode; never modify the newly selected row.
      prController?.setPhase("dirty")
      poController?.setPhase("dirty")
      if (view.reviewing === review) setView("reviewing", undefined)
      setView("sending", false)
    }
    let digest: string
    try {
      const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payloadJson))
      digest = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("")
    } catch (error) {
      console.error("CAP25 intent digest failed", error)
      if (ownerMatches(ownerKey, epoch) && view.reviewing === review)
        setView("notice", "sf.u11.remaining.notAvailable")
      declineBeforePost()
      return
    }
    const currentOwner = sf.state()
    if (!ownerMatches(ownerKey, epoch) || abort.signal.aborted ||
        !sameRequestsDispatchFence(fence, {
          reviewing: view.reviewing, mode: creating() ? "create" : stage() === "po" ? "po" : "pr",
          newIntentRef: view.newIntentRef, ref: selectedRef(), sourceRevision: sourceRevision(),
          stage: stage(), version: version(), row: row(),
          ownerKey: currentOwner.status === "ready" ? currentOwner.ownerKey : undefined,
          epoch: sf.generation(), prController: pr ? prDraft() : undefined,
          poController: po ? poDraft() : undefined, payload: JSON.stringify(input),
        }) || inFlight !== abort || !stageAllowed(review.action, true) ||
        (pr && (!activePr() || JSON.stringify(activePr()?.value) !== JSON.stringify(pr) ||
          activePr()?.baseVersion !== (review.ref ? review.version : null))) ||
        (po && (!activePo() || JSON.stringify(activePo()?.value) !== JSON.stringify(po) ||
          activePo()?.baseVersion !== review.version))) {
      declineBeforePost()
      return
    }
    const pending = {
      operationRef: review.operationRef, idempotencyKey: review.idempotencyKey,
      payloadDigest: digest, expectedVersion: review.ref ? review.version : null,
    }
    prController?.setPending(pending)
    poController?.setPending(pending)
    const prState = prController?.snapshot()
    const poState = poController?.snapshot()
    const pendingMatches = (state: typeof prState | typeof poState) => {
      const recorded = state?.availability === "active" ? state.pendingOperation : null
      return !!recorded && recorded.operationRef === pending.operationRef &&
        recorded.idempotencyKey === pending.idempotencyKey &&
        recorded.payloadDigest === pending.payloadDigest &&
        Object.is(recorded.expectedVersion, pending.expectedVersion)
    }
    if ((prController && !pendingMatches(prState)) || (poController && !pendingMatches(poState))) {
      if (view.reviewing === review) setView("notice", "sf.u11.remaining.notAvailable")
      declineBeforePost()
      return
    }
    prController?.setPhase("submitting")
    poController?.setPhase("submitting")
    const options = { signal: abort.signal, idempotencyKey: review.idempotencyKey }

    try {
      const result = await (async () => {
        switch (review.action) {
          case "create": return client["domain.command.CAP25.create"](
            { ...base, action: "create", values: { pr: review.pr! } }, options)
          case "save-pr": return client["domain.command.CAP25.save"](
            { ...base, action: "save", values: { pr: review.pr! } }, options)
          case "save-po": return client["domain.command.CAP25.save"](
            { ...base, action: "save", values: { po: review.po! } }, options)
          case "submit_pr": return client["domain.command.CAP25.submit_pr"](
            { ...base, action: "submit_pr", values: { pr: review.pr! } }, options)
          case "submit_po": return client["domain.command.CAP25.submit_po"](
            { ...base, action: "submit_po", values: { po: review.po! } }, options)
          case "issue": return client["domain.command.CAP25.issue"](
            { ...base, action: "issue", values: {} }, options)
          case "cancel": return client["domain.command.CAP25.cancel"](
            { ...base, action: "cancel", values: { reason: review.reason } }, options)
          case "delete": return client["domain.command.CAP25.delete"](
            { ...base, action: "delete", values: {} }, options)
        }
      })()
      if (!ownerMatches(ownerKey, epoch)) return
      if (result.kind !== "response") {
        prController?.setPhase("outcome-unknown")
        poController?.setPhase("outcome-unknown")
        setView({ sending: false, reviewing: undefined, outcomeUnknown: true, notice: "sf.u11.remaining.unknown" })
        return
      }
      if (result.status >= 500 || (result.body.ok ? result.status < 200 || result.status >= 300 : result.body.status !== result.status)) {
        prController?.setPhase("outcome-unknown")
        poController?.setPhase("outcome-unknown")
        setView({ sending: false, reviewing: undefined, outcomeUnknown: true, notice: "sf.u11.remaining.unknown" })
        return
      }
      if (result.status === 401 || result.status === 403) {
        setView({ sending: false, reviewing: undefined, read: undefined,
          state: result.status === 401 ? "session-expired" : "denied" })
        if (result.status === 403) sf.invalidate("revoked")
        else void sf.reload()
        return
      }
      if (result.status === 409 && !result.body.ok && result.body.status === 409) {
        prController?.rejectSave({ status: 409, operation: pending })
        poController?.rejectSave({ status: 409, operation: pending })
        setView({ sending: false, reviewing: undefined, state: prController || poController ? "ready" : "stale",
          notice: "sf.u11.remaining.missingVersion" })
        return
      }
      if (result.status === 422 && !result.body.ok && result.body.status === 422) {
        prController?.rejectSave({ status: 422, operation: pending })
        poController?.rejectSave({ status: 422, operation: pending })
        setView({ sending: false, reviewing: undefined, notice: po ? "sf.u11.remaining.invalidPo" : "sf.u11.remaining.invalidPr" })
        return
      }
      if (result.status < 200 || result.status >= 300 || result.body.ok !== true) {
        prController?.setPhase(result.status === 422 ? "validation-error" : "failed")
        poController?.setPhase(result.status === 422 ? "validation-error" : "failed")
        setView({ sending: false, reviewing: undefined,
          notice: result.status === 422 ? (po ? "sf.u11.remaining.invalidPo" : "sf.u11.remaining.invalidPr") :
            "sf.u11.remaining.notAvailable" })
        return
      }
      // Authorized refetch only. No local approval/FX/amount/PO computation.
      const fresh = await client["domain.page.CAP25"](
        review.ref ? { request: review.ref } : {}, { signal: abort.signal },
      )
      if (!ownerMatches(ownerKey, epoch)) return
      const next = fresh.kind === "response" && fresh.status === 200
        ? decodeRequestsPage(fresh.body, ready.context.stamp) : { kind: "unavailable" as const }
      const updated = next.kind === "ready" && review.ref
        ? next.records.find((record) => requestRef(record) === review.ref) : undefined
      const updatedVersion = next.kind === "ready" && review.ref ? requestVersion(next, review.ref) : undefined
      if (next.kind === "ready") setView({ read: next, state: "ready" })
      const verified = !!updated && updatedVersion !== undefined && updatedVersion > review.version
      if (verified && updated && updatedVersion !== undefined) {
        if (prController) prController.confirmSave({
          kind: "projected", operationRef: review.operationRef,
          baseVersion: updatedVersion, value: prFromRecord(updated),
        })
        if (poController) poController.confirmSave({
          kind: "projected", operationRef: review.operationRef,
          baseVersion: updatedVersion, value: poFromRecord(updated),
        })
        setView({ selected: review.ref, creating: false, notice: "sf.u11.remaining.saved" })
      } else {
        // A successful command may not carry a canonical newly created ID.
        // Missing from the list is not enough to claim a deleted record.
        if (prController) prController.confirmSave({
          kind: "confirmed-without-projection", operationRef: review.operationRef, resultVersion: null,
        })
        if (poController) poController.confirmSave({
          kind: "confirmed-without-projection", operationRef: review.operationRef, resultVersion: null,
        })
        setView("notice", review.action === "create" ? "sf.u11.remaining.noReturn" : "sf.u11.remaining.accepted")
      }
      setView({ sending: false, reviewing: undefined })
    } catch (error) {
      if (ownerMatches(ownerKey, epoch)) {
        console.error("CAP25 unknown command result", error)
        prController?.setPhase("outcome-unknown")
        poController?.setPhase("outcome-unknown")
        setView({ sending: false, reviewing: undefined, outcomeUnknown: true, notice: "sf.u11.remaining.unknown" })
      }
    } finally {
      if (inFlight === abort) inFlight = undefined
    }
  }

  const rows = createMemo(() => {
    const query = view.filter.trim().toLocaleLowerCase(language.intl())
    let records = (view.read?.records ?? []).filter((record) =>
      !query || [record.number, record.pr?.title, record.status, record.createdBy,
        record.buyerId, record.po?.supplier].some((part) =>
        typeof part === "string" && part.toLocaleLowerCase(language.intl()).includes(query),
      ),
    )
    if (view.sort.kind === "field") {
      const { key, direction } = view.sort
      records = [...records].sort((a, b) => {
        const text = (record: SfRequest) => key === "number" ? displayScalar(record.number) :
          key === "status" ? record.status : key === "title" ? record.pr?.title ?? "" :
          key === "requester" ? record.createdBy : record.po?.supplier ?? ""
        return text(a).localeCompare(text(b), language.intl()) * (direction === "asc" ? 1 : -1)
      })
    }
    return records
  })
  const columns: readonly SfColumn<SfRequest>[] = [
    { id: "number", labelKey: tableKey("sf.u11.remaining.identity"), sortKey: "number",
      align: "start", widthPolicy: { kind: "content", minPx: 130, maxPx: 200 },
      render: (row) => {
        if (row.number === undefined) return null
        return <a
          href={"?request=" + encodeURIComponent(row.number) + "#" + encodeURIComponent(row.number)}
          data-source-ref={row.sourceRef ?? undefined}
          data-source-digest={row.sourceDigest ?? undefined}
          data-source-version={row.sourceVersion === null || row.sourceVersion === undefined ? undefined : String(row.sourceVersion)}
        >{row.number}</a>
      } },
    { id: "title", labelKey: tableKey("sf.u11.remaining.field.title"), sortKey: "title",
      align: "start", widthPolicy: { kind: "flex", minPx: 150, weight: 3 },
      render: (row) => <span>{row.pr?.title ?? "—"}</span> },
    { id: "status", labelKey: tableKey("sf.u11.remaining.status"), sortKey: "status",
      align: "start", widthPolicy: { kind: "content", minPx: 110, maxPx: 180 },
      render: (row) => <span>{row.status}</span> },
    { id: "requester", labelKey: tableKey("sf.u11.remaining.requester"), sortKey: "requester",
      align: "start", widthPolicy: { kind: "content", minPx: 110, maxPx: 170 },
      render: (row) => <span>{row.requesterName ?? row.createdBy}</span> },
  ]

  const reviewPane = () => {
    const intent = view.reviewing
    if (!intent) return null
    const editKind: EditKind = intent.po ? "po" : "pr"
    const fields = intent.action === "cancel" ? [
      { path: "reason", label: message("sf.u11.remaining.reason"),
        value: { kind: "text" as const, text: dataText(intent.reason) } },
    ] : fieldsOf(intent.po ?? intent.pr, editKind)
    const persisted = row()
    const original: SfReviewSnapshot | null = persisted && intent.ref
      ? { kind: "persisted", ref: intent.ref, version: intent.version,
        fields: fieldsOf(intent.po ? poFromRecord(persisted) : prFromRecord(persisted), editKind) } : null
    const operationId = ("domain.command.CAP25." + uiCommandAction(intent.action)) as
      "domain.command.CAP25.create" | "domain.command.CAP25.save" |
      "domain.command.CAP25.submit_pr" | "domain.command.CAP25.submit_po" |
      "domain.command.CAP25.issue" | "domain.command.CAP25.cancel" | "domain.command.CAP25.delete"
    const purpose = intent.action === "create" ? "create" :
      intent.action === "save-pr" || intent.action === "save-po" ? "save" :
      intent.action === "delete" ? "delete" : intent.action === "cancel" ? "cancel" :
      intent.action === "issue" ? "issue" : "submit"
    return <SfChangeReview
      operation={{ ref: intent.operationRef, label: message(actionKey[intent.action]),
        scope: dataText(t("sf.u11.remaining.reviewScope")) }}
      base={original} current={original}
      proposed={{ kind: "draft", intentRef: intent.intentRef, sourceRef: intent.ref ?? null,
        sourceVersion: intent.ref ? intent.version : null, fields }}
      effects={[{ id: uiCommandAction(intent.action), domain: "procurement",
        title: { kind: "message", message: message(actionKey[intent.action]) },
        state: "proposed", details: fields }]}
      coverage={{ state: "complete", summary: message("sf.u11.remaining.reviewSummary"),
        reasons: [], knownCount: fields.length, expectedCount: fields.length }}
      blockingReasons={[]}
      confirmation={{ kind: "admitted", labelKey: tableKey("sf.u11.remaining.confirm"),
        purpose, binding: { kind: "catalog-command", operationId,
          version: { kind: "record", expectedVersion: intent.version },
          confirmation: "presentation-only" } }}
      state={view.sending ? "loading" : "ready"}
      onConfirm={() => { void confirm() }}
      onRevise={cancelReview} onCancel={cancelReview}
    />
  }

  const renderDetail = () => {
    const current = row()
    if (!current && !creating()) return null
    const ref = selectedRef()
    const currentVersion = version()
    const assetTarget = current && ref && currentVersion !== undefined
      ? { row: current, ref, version: currentVersion } : undefined
    const stageWritable = !!current && (
      (isPrWritable(current) && actionAllowed("save-pr")) ||
      (isPoWritable(current) && actionAllowed("save-po"))
    )
    const uploadKind = !stageWritable ? undefined
      : current?.status === "sourcing" || current?.status === "src_rejected" ? "quote"
      : current?.status === "po_approved" || current?.status === "po_issued" ? "signed-po"
      : undefined
    return <article class="sf-u11-detail" data-sf-request-ref={ref ?? undefined}>
      <header class="sf-u11-detail-head">
        <h2>{creating() ? t("sf.u11.remaining.new") : current?.pr?.title ?? ref}</h2>
        <Show when={!creating() && ref}>
          <p>{t("sf.u11.remaining.identity")}: {ref}</p>
          <p>{t("sf.u11.remaining.status")}: {current?.status}</p>
          <p>{t("sf.u11.remaining.version")}: {version() ?? "—"}</p>
          <Show when={current?.requestSummary}>
            <p data-request-summary={ref}>{current?.requestSummary}</p>
          </Show>
          <Show when={current?.moneySentence}>
            <p data-request-money={ref}>{current?.moneySentence}</p>
          </Show>
        </Show>
        <Show when={current}>
          <p>{t("sf.u11.remaining.stage")}: {stage()}</p>
        </Show>
        <Show when={current?.poEstimate}><p role="status">{current?.poEstimate}</p></Show>
        <Show when={current?.orderDifference}><p role="status">{current?.orderDifference}</p></Show>
        <Show when={current?.po?.supplierId && stage() !== "po"}>
          <p>{t("sf.u11.remaining.field.supplierId")}: {current!.po?.supplierId}</p>
        </Show>
        <Show when={current?.status === "sourcing" || current?.status === "src_pending"}>
          <section>
            <Show when={current?.po}>
              <fieldset disabled>
                <label>{t("sf.u11.remaining.field.supplier")}
                  <input type="text" value={current?.po?.supplier ?? ""} disabled />
                </label>
                <label>{t("sf.u11.remaining.field.currency")}
                  <input type="text" value={current?.po?.currency ?? ""} disabled />
                </label>
                <label>{t("sf.u11.remaining.field.unitPrice")}
                  <input type="number" step="any" value={displayScalar(current?.po?.lines?.[0]?.unitPrice)} disabled />
                </label>
              </fieldset>
            </Show>
            <button type="button" disabled={!stageAllowed("submit_po")} onClick={() => reviewAction("submit_po")}>
              {t("sf.u11.remaining.submitPo")}
            </button>
          </section>
        </Show>
      </header>
      <Show when={current && ref}>
        <nav class="sf-u11-tabs" aria-label={t("sf.u11.remaining.progress")}>
          <a href={stageHref(ref!, "requisition")}>{t("sf.u11.remaining.pr")}</a>
          <a href={stageHref(ref!, "sourcing")}>{t("sf.u11.remaining.sourcing")}</a>
          <a href={stageHref(ref!, "quotes")}>{t("sf.u11.remaining.comparison")}</a>
          <a href={stageHref(ref!, "po")}>{t("sf.u11.remaining.po")}</a>
          <a href={stageHref(ref!, "history")}>{t("sf.u11.remaining.history")}</a>
        </nav>
      </Show>
      <Show when={prPending() || poPending()}><p role="alert">{t("sf.u11.remaining.unknown")}</p></Show>
      <Show when={prConflict()}>
        <section class="sf-u11-stage" data-draft-conflict="pr">
          <p role="alert">{language.t("sf.common.conflict")}</p>
          <button type="button" class="mx-btn" disabled={view.sending || view.outcomeUnknown || prPending()}
            onClick={() => discardConflict("pr")}>{t("sf.u11.remaining.discard")}</button>
        </section>
      </Show>
      <Show when={activePr() && (creating() || isPrWritable(current!))}>
        <section class="sf-u11-stage" data-stage="pr">
          <Dynamic component={creating() ? "form" : "div"}
            {...(creating() ? { "data-command": "create", "data-page": "Requests", "data-record": "", "data-version": "0" } : {})}>
          <Show when={current && !creating()}>
            <p>{t("sf.u11.remaining.noTitleMutation")}: {current?.pr?.title ?? ""}</p>
            {/* The W19 title editor is a separate source-locked intent/draft. */}
            <SfRequestTitleEdit {...props} requestRef={selectedRef()} onConfirmed={refresh} />
          </Show>
          <SfRequisitionForm value={activePr()!.value} creating={creating()}
            disabled={view.sending || !!view.reviewing || view.outcomeUnknown}
            onEdit={editPr} />
          <div class="sf-u11-actions">
            <Show when={creating() && stageAllowed("create")}>
              <button type="button" class="mx-btn primary" onClick={() => reviewAction("create")}>
                {t("sf.u11.remaining.new")}
              </button>
            </Show>
            <Show when={!creating() && canPr()}>
              <button type="button" class="mx-btn" onClick={() => reviewAction("save-pr")}>
                {t("sf.u11.remaining.savePr")}
              </button>
            </Show>
            <Show when={!creating() && stageAllowed("submit_pr")}>
              <button type="button" class="mx-btn primary" onClick={() => reviewAction("submit_pr")}>
                {t("sf.u11.remaining.submitPr")}
              </button>
            </Show>
            <button type="button" class="mx-btn"
              disabled={view.sending || !!view.reviewing || view.outcomeUnknown}
              onClick={() => prDraft()?.discard()}>{t("sf.u11.remaining.discard")}</button>
          </div>
          </Dynamic>
        </section>
      </Show>
      <Show when={current && stage() === "pr" && !canPr()}>
        <section class="sf-u11-stage"><h3>{t("sf.u11.remaining.pr")}</h3>
          <p>{current?.pr?.description ?? t("sf.u11.remaining.readonly")}</p>
        </section>
      </Show>
      <Show when={current && stage() === "po"}>
        <section class="sf-u11-stage" data-stage="po">
          <h3>{t("sf.u11.remaining.po")}</h3>
          <Show when={poConflict()}>
            <div data-draft-conflict="po"><p role="alert">{language.t("sf.common.conflict")}</p>
              <button type="button" class="mx-btn" disabled={view.sending || view.outcomeUnknown || poPending()}
                onClick={() => discardConflict("po")}>{t("sf.u11.remaining.discard")}</button></div>
          </Show>
          <Show when={canPo() && activePo()} fallback={<p>{t("sf.u11.remaining.readonly")}</p>}>
            <SfPurchaseOrderForm value={activePo()!.value}
              disabled={view.sending || !!view.reviewing || view.outcomeUnknown}
              onEdit={editPo} />
            <div class="sf-u11-actions">
              <button type="button" class="mx-btn" onClick={() => reviewAction("save-po")}>
                {t("sf.u11.remaining.savePo")}
              </button>
              <Show when={stageAllowed("submit_po")}>
                <button type="button" class="mx-btn primary" onClick={() => reviewAction("submit_po")}>
                  {t("sf.u11.remaining.submitPo")}
                </button>
              </Show>
              <button type="button" class="mx-btn" disabled={view.sending || !!view.reviewing}
                onClick={() => poDraft()?.discard()}>{t("sf.u11.remaining.discard")}</button>
            </div>
          </Show>
          <Show when={current?.po?.supplierId}><p>{t("sf.u11.remaining.field.supplierId")}: {current!.po?.supplierId}</p></Show>
          <Show when={current?.po?.contractRef}><p>{t("sf.u11.remaining.field.contractRef")}: {current!.po?.contractRef}</p></Show>
          <Show when={current?.po?.quoteRef}><p>{t("sf.u11.remaining.selectedQuote")}: {current!.po?.quoteRef}</p></Show>
          <Show when={stageAllowed("issue")}>
            <button type="button" class="mx-btn" onClick={() => reviewAction("issue")}>
              {t("sf.u11.remaining.issue")}
            </button>
          </Show>
        </section>
      </Show>
      <Show when={current && (props.route.kind === "history" || props.route.kind === "detail")}>
        <section class="sf-u11-stage" data-stage="history">
          <h3>{t("sf.u11.remaining.history")}</h3>
          <Show when={(current?.history?.length ?? 0) > 0} fallback={<p>{t("sf.u11.remaining.noHistory")}</p>}>
            <ol><For each={current?.history}>{(entry) =>
              <li><time>{entry.at}</time> · {entry.action} · {entry.by} · {entry.note}</li>
            }</For></ol>
          </Show>
        </section>
      </Show>
      <Show when={current}>
        <section class="sf-u11-stage" data-stage="attachments">
          <h3>{t("sf.u11.remaining.attachments")}</h3>
          <Show when={assetTarget} fallback={<p role="status">{t("sf.u11.remaining.notUploaded")}</p>}>
            {(target) => <SfBoundAssets surface="procurement" page="Requests"
              uploadKind={uploadKind} recordRef={target().ref} recordVersion={target().version}
              assets={target().row.attachments ?? []}
              disabled={view.sending || view.outcomeUnknown || !!view.reviewing || !sourceAvailable() || !stageWritable}
              onReconcile={refresh} />}
          </Show>
        </section>
        <div class="sf-u11-actions">
          <Show when={stageAllowed("cancel")}>
            <label for={reasonId}>{t("sf.u11.remaining.reason")}</label>
            <textarea id={reasonId} rows={2} value={view.reason}
              disabled={view.sending || view.outcomeUnknown}
              onInput={(event) => setView("reason", event.currentTarget.value)} />
            <button type="button" class="mx-btn danger" disabled={!view.reason.trim()}
              onClick={() => reviewAction("cancel")}>{t("sf.u11.remaining.cancel")}</button>
          </Show>
          <Show when={stageAllowed("delete")}>
            <button type="button" class="mx-btn danger" onClick={() => reviewAction("delete")}>
              {t("sf.u11.remaining.delete")}
            </button>
          </Show>
        </div>
      </Show>
      {reviewPane()}
    </article>
  }

  return <section data-component="sf-requests-pr-po" aria-busy={view.sending}>
    <SfPageFrame
      titleKey={copyKey("sf.u11.remaining.list")}
      context={[]} tabs={[]} activeTab={null}
      primaryAction={actionAllowed("create") ? {
        id: "create", labelKey: copyKey("sf.u11.remaining.new"), tone: "primary",
        disabled: view.sending || view.outcomeUnknown, busy: view.sending,
        onInvoke: () => setView({ creating: true, selected: undefined,
          newIntentRef: crypto.randomUUID() as SfIntentRef, reviewing: undefined }),
      } : undefined}
      secondaryActions={[]} density="comfortable"
      layout={view.layoutMode === "single" ? "reading" : "split"}
      onLayoutMode={(mode) => setView("layoutMode", mode)}
    >
      <Show when={sourceAvailable()} fallback={
        <SfStatePanel state={view.state} messageKey={copyKey("sf.u11.remaining.noSource")}
          onRetryRead={view.state === "denied" ? undefined : refresh} />
      }>
        <div class="sf-u11-layout">
          <div class="sf-u11-list">
            <label for={searchId}>{t("sf.u11.remaining.filter")}</label>
            <div class="sf-u11-filters">
              <input id={searchId} type="search" placeholder={t("sf.u11.remaining.filterPlaceholder")}
                value={view.filter} onInput={(event) => setView("filter", event.currentTarget.value)} />
              <button type="button" class="mx-btn" disabled={!view.filter}
                onClick={() => setView("filter", "")}>{t("sf.u11.remaining.clearFilter")}</button>
            </div>
            <SfDataTable rows={rows()} getRowKey={(record) => requestRef(record)!}
              columns={columns} selectedKey={selectedRef()} sort={view.sort}
              page={{ kind: "none", total: rows().length }} onSort={(sort) => setView("sort", sort)}
              onPage={() => undefined} onSelect={(ref) => setView({ selected: ref, creating: false, reviewing: undefined })}
              rowActions={() => []} onRowAction={() => undefined}
              captionKey={tableKey("sf.u11.remaining.list")} density="comfortable"
              state={rows().length ? "ready" : view.read?.records.length ? "filtered-empty" : "empty"}
            />
          </div>
          <div class="sf-u11-detail-wrap">
            <Show when={row() || creating()} fallback={<p role="status">{t("sf.u11.remaining.open")}</p>}>
              {renderDetail()}
            </Show>
          </div>
        </div>
      </Show>
      <Show when={view.notice}>
        {(key) => <p role={view.outcomeUnknown ? "alert" : "status"} class="sf-u11-notice">
          {t(key())}
          <button type="button" class="mx-btn" onClick={refresh}>{t("sf.u11.remaining.retry")}</button>
        </p>}
      </Show>
    </SfPageFrame>
  </section>
}

/** I00 public U11 entrypoint. The protected requests/index.tsx re-export is 125-owned. */
export function SfRequestView(props: SfSurfaceProps) {
  if (props.surfaceId !== "CAP25")
    return <SfStatePanel state="invalid" messageKey={copyKey("sf.u11.remaining.noSource")} />
  return <SfRequestsPage {...props} />
}
