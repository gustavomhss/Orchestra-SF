import { createEffect, For, onCleanup, Show, untrack } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { createSfOperationsClient } from "@orchestra/client/sucafina/operations"
import { useSfContext } from "../../context"
import type { SfSurfaceProps, SfEditScopeKey, SfRef, SfOwnerKey, SfPublicDraftController } from "../../context/contracts"
import type { SfIntentRef, SfOperationRef } from "@orchestra/schema/sucafina/context"
import { SfPageFrame } from "../../shared/frame"
import type { SfCopyKey, SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { SfChangeReview } from "../../shared/change-review"
import type { SfReviewField, SfReviewSnapshot } from "../../shared/change-review"
import {
  SERVICE_HEAT_FIELDS, SERVICE_MONTHS, SERVICE_SLA_FIELDS, SERVICE_YEARS,
  SOURCE_OPERATION_IDS, serviceCategories, serviceCurrentHeatmap, serviceCurrentMonthHeatmap,
  serviceCurrentSla, serviceCurrentTickets, serviceItems, serviceListVersion,
  serviceMonthVersion, serviceRecordId, serviceString, serviceTicketKeys,
} from "./model"
import type { SfServiceAction, SfServicePage } from "./model"
import "./service.css"

type DraftValues = Readonly<Record<string, string>>
type Draft = SfPublicDraftController<DraftValues>
type Editor = Readonly<{
  action: SfServiceAction
  item: string | null
  version: number
  identity: Readonly<{ kind: "record"; recordRef: SfRef }> | Readonly<{ kind: "new"; newIntentRef: SfIntentRef }>
  scope: SfEditScopeKey
  review: boolean
  operationRef: SfOperationRef
}>
// Solid store state: no Readonly<> wrapper, see security/index.tsx.
type ReadState = {
  state: SfUiState
  page: SfServicePage | undefined
  year: number | undefined
  month: number | undefined
  refresh: number
  editor: Editor | null
  submitting: boolean
  operationState: "idle" | "saved" | "failed" | "unknown" | "conflict"
  errorText: string | null
}
const sourceKey = (part: string) => ("sf.cap11." + part) as SfCopyKey
const commonKey = (part: string) => ("sf.common." + part) as SfCopyKey
const message = (key: SfCopyKey) => ({ key })
const asRef = (value: string) => value as SfRef
const asIntent = (value: string) => value as SfIntentRef
const asOperation = (value: string) => value as SfOperationRef
const numeric = (value: string) => value === "" || Number.isFinite(Number(value)) && Number(value) >= 0
const lists = (value: string) => value.split("\n").map((row) => row.trim()).filter(Boolean)
const noDupes = (items: string[]) => new Set(items).size === items.length && items.every((item) => !item.includes("|"))

function initialValues(page: SfServicePage, action: SfServiceAction, item: string | null): DraftValues {
  if (action === "save-categories" || action === "save-items") {
    return { names: (action === "save-categories" ? serviceCategories(page) : serviceItems(page)).join("\n") }
  }
  if (action === "save-tickets") {
    const row = serviceCurrentTickets(page)
    return Object.fromEntries(serviceTicketKeys(page).map((field) => [field, serviceString(row?.[field])]))
  }
  if (action === "save-sla") {
    const row = serviceCurrentSla(page)
    return Object.fromEntries(SERVICE_SLA_FIELDS.map((field) => [
      field, serviceString(row?.[field] ?? (field === "avail" ? 100 : undefined)),
    ]))
  }
  if (action === "save-heatmap") {
    const chosen = item ?? serviceItems(page)[0] ?? ""
    const row = serviceCurrentHeatmap(page, chosen)
    return {
      item: chosen,
      p1: serviceString(row?.p1), p2: serviceString(row?.p2),
      tickets: serviceString(row?.tickets), comments: serviceString(row?.comments),
    }
  }
  // The existing domain contract consumes these three exact structured
  // fieldsets. No second upload endpoint, hidden workbook parser or snapshot.
  const tickets = serviceCurrentTickets(page)
  const sla = serviceCurrentSla(page)
  const fields: Record<string, string> = {}
  for (const name of serviceTicketKeys(page)) fields["ticket." + name] = serviceString(tickets?.[name])
  for (const name of SERVICE_SLA_FIELDS) fields["sla." + name] = serviceString(sla?.[name])
  for (const item of serviceItems(page)) {
    const row = serviceCurrentHeatmap(page, item)
    for (const name of SERVICE_HEAT_FIELDS)
      fields["heatmap." + item + "." + name] = serviceString(row?.[name])
    fields["heatmap." + item + ".comments"] = serviceString(row?.comments)
  }
  return fields
}

function sourceFields(action: SfServiceAction, values: DraftValues): string[] {
  if (action === "save-tickets") return Object.keys(values)
  if (action === "save-sla") return [...SERVICE_SLA_FIELDS]
  if (action === "save-heatmap") return ["item", ...SERVICE_HEAT_FIELDS, "comments"]
  if (action === "save-categories" || action === "save-items") return ["names"]
  return Object.keys(values)
}

function isValid(action: SfServiceAction, values: DraftValues, page: SfServicePage): boolean {
  if (action === "save-categories" || action === "save-items") return noDupes(lists(values.names ?? ""))
  if (action === "save-tickets") return serviceTicketKeys(page).every((key) => numeric(values[key] ?? ""))
  if (action === "save-sla") return SERVICE_SLA_FIELDS.every((key) => numeric(values[key] ?? ""))
  if (action === "save-heatmap") return serviceItems(page).includes(values.item ?? "") &&
    SERVICE_HEAT_FIELDS.every((key) => numeric(values[key] ?? ""))
  return Object.entries(values).every(([field, value]) =>
    field.endsWith(".comments") || numeric(value))

}

function serviceReadState(page: SfServicePage): "ready" | "empty" | "filtered-empty" | "partial" | "unavailable" {
  // The source union permits omitted/redacted collections. An absent projection
  // is not evidence that the authorized collection is empty.
  const collections = [page.data.opsTickets, page.data.opsSLA, page.data.opsHeatmap]
  if (collections.every((rows) => rows == null)) return "unavailable"
  if (collections.some((rows) => rows == null) || page.data.display == null) return "partial"
  const records = [
    ...(page.data.opsTickets ?? []), ...(page.data.opsSLA ?? []),
    ...(page.data.opsHeatmap ?? []),
  ]
  if (records.length === 0) return "empty"
  return records.some((row) => row.year === page.selection.year) ? "ready" : "filtered-empty"
}

function reviewFields(action: SfServiceAction, values: DraftValues): SfReviewField[] {
  return sourceFields(action, values).map((field) => ({
    path: field,
    label: message(field.startsWith("ticket.") ? sourceKey("section.tickets") :
      field.startsWith("sla.") ? sourceKey("section.sla") :
      field.startsWith("heatmap.") ? sourceKey("section.heatmap") :
      sourceKey("field." + field + ".label")),
    value: { kind: "text" as const, text: { kind: "data" as const, text: values[field] ?? "" } },
  }))
}

export function SfServiceView(props: SfSurfaceProps<"CAP11">) {
  const language = useLanguage()
  const t = (key: SfCopyKey) => language.t(key as Parameters<typeof language.t>[0])
  const owner = useSfContext()
  const [state, setState] = createStore<ReadState>({
    state: "loading", page: undefined,
    year: props.route.query.year, month: props.route.query.month,
    refresh: 0, editor: null, submitting: false, operationState: "idle", errorText: null,
  })
  let draft: Draft | undefined
  let draftOwner: SfOwnerKey | undefined
  let submitted: Readonly<{ operationRef: SfOperationRef; action: SfServiceAction; owner: SfOwnerKey; year: number; month: number }> | undefined
  let routeEntryConsumed: string | undefined
  let editorTrigger: HTMLElement | null = null
  const pendingRequests = new Set<AbortController>()
  onCleanup(() => {
    for (const request of pendingRequests) request.abort()
    pendingRequests.clear()
    draft = undefined
  })

  const currentOwner = () => {
    const current = owner.state()
    return current.status === "ready" ? current.ownerKey : undefined
  }
  const can = (action: SfServiceAction) =>
    state.page?.allowedActionIds.includes(action) === true &&
    ["ready", "empty", "filtered-empty"].includes(state.state) &&
    !["unknown", "conflict"].includes(state.operationState) &&
    owner.state().status === "ready" && !!owner.ready()
  const activeDraft = () => {
    state.editor
    const snapshot = draft?.snapshot()
    return snapshot?.availability === "active" ? snapshot : undefined
  }
  const fields = (): DraftValues => activeDraft()?.value ?? {}
  const edit = (name: string, value: string) => {
    if (!activeDraft() || state.submitting) return
    draft?.edit({ ...fields(), [name]: value })
  }

  function openEditor(action: SfServiceAction, item: string | null = null) {
    const page = state.page
    const active = owner.ready()
    const key = currentOwner()
    if (!page || !active || !key || !can(action)) return
    editorTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const version = action === "save-categories" || action === "save-items"
      ? serviceListVersion(page, action === "save-categories" ? "opsCats" : "opsHmItems")
      : serviceMonthVersion(page)
    const selectedItem = action === "save-heatmap" ? item ?? serviceItems(page)[0] ?? "" : item
    const scope = ("CAP11:" + action + ":" + page.selection.year + "-" + page.selection.month +
      (selectedItem === null ? "" : ":" + selectedItem)) as SfEditScopeKey
    const entity = action === "save-categories" ? "opsCats" : action === "save-items" ? "opsHmItems" :
      action === "save-heatmap" ? serviceCurrentHeatmap(page, selectedItem ?? "")?.id :
      action === "save-tickets" ? serviceCurrentTickets(page)?.id :
      action === "save-sla" ? serviceCurrentSla(page)?.id : undefined
    const identity: Editor["identity"] = entity === undefined || entity === null
      ? { kind: "new", newIntentRef: asIntent("u04:" + scope) }
      : { kind: "record", recordRef: asRef(String(entity)) }
    const values = initialValues(page, action, selectedItem)
    const sourceRow = action === "save-heatmap" ? serviceCurrentHeatmap(page, selectedItem ?? "") :
      action === "save-tickets" ? serviceCurrentTickets(page) : action === "save-sla" ? serviceCurrentSla(page) : undefined
    try {
      // F01 persists this owner-scoped draft beyond chapter unmount; keys never
      // include mutable record revision, only the business selection.
      draft = active.drafts.acquire({
        surfaceId: "CAP11", identity, editScopeKey: scope, baseVersion: version,
        base: values, value: values,
        revalidation: {
          operationId: "domain.page.CAP11",
          input: { ...(state.year === undefined ? {} : { opsYear: state.year }),
            ...(state.month === undefined ? {} : { operationsMonth: state.month }) },
          fieldPaths: action === "save-categories" ? ["opsCats"] :
            action === "save-items" ? ["opsHmItems"] :
            sourceRow ? sourceFields(action, values).filter((field) => Object.hasOwn(sourceRow, field)) : [],
          actionIds: [action],
        },
      })
      draftOwner = key
      setState("editor", {
        action, item: selectedItem, version, identity, scope, review: false,
        operationRef: asOperation(crypto.randomUUID()),
      })
      setState("operationState", "idle")
      setState("errorText", null)
    } catch (error) {
      console.error("Sucafina operations draft unavailable", error instanceof Error ? error.name : "unknown")
      setState("state", "unavailable")
      setState("errorText", t(commonKey("unavailable")))
    }
  }

  function closeEditor() {
    setState("editor", null)
    const trigger = editorTrigger
    editorTrigger = null
    if (trigger?.isConnected) queueMicrotask(() => { if (trigger.isConnected) trigger.focus() })
  }

  function discardCurrent() {
    const editor = state.editor
    const snapshot = activeDraft()
    if (!editor || !snapshot || state.submitting || state.operationState === "unknown") return
    if (snapshot.dirty && !window.confirm(t(commonKey("navigationDiscard")))) return
    draft?.discard()
    owner.ready()?.drafts.discard({
      surfaceId: "CAP11", identity: editor.identity, editScopeKey: editor.scope,
    })
    draft = undefined
    draftOwner = undefined
    closeEditor()
    setState("operationState", "idle")
    setState("errorText", null)
  }

  const changeSelection = (field: "year" | "month", value: number) => {
    // F01 retains drafts across periods; park the UI reference, not the draft.
    if (state.editor) {
      setState("editor", null)
      draft = undefined
      draftOwner = undefined
    }
    setState(field, value)
  }

  // Owner + generation + selected period + refresh are the only read inputs.
  // Late responses cannot repopulate a changed or revoked owner.
  createEffect(() => {
    const active = owner.ready()
    const generation = owner.generation()
    const ownerState = owner.state()
    const year = state.year
    const month = state.month
    const refresh = state.refresh
    const route = props.route
    void refresh
    void route
    if (!active || ownerState.status !== "ready") {
      setState("page", undefined)
      setState("editor", null)
      setState("state", ownerState.status === "denied" ? "denied" :
        ownerState.status === "unauthenticated" ? "session-expired" :
        ownerState.status === "resolving" ? "loading" : "unavailable")
      draft = undefined
      draftOwner = undefined
      submitted = undefined
      return
    }
    const destination = active.context.destinations.find((entry) =>
      entry.capabilityId === "CAP11" && entry.surface === "dashboard" &&
      entry.page === "IT Operations" && entry.canRead,
    )
    if (!destination) {
      setState("page", undefined)
      setState("editor", null)
      setState("state", "denied")
      draft = undefined
      submitted = undefined
      return
    }
    if (draftOwner !== undefined && draftOwner !== ownerState.ownerKey) {
      draft = undefined
      draftOwner = undefined
      setState("editor", null)
      submitted = undefined
    }
    const request = new AbortController()
    pendingRequests.add(request)
    setState("page", undefined)
    setState("state", "loading")
    const client = createSfOperationsClient(active.transport)
    const input = {
      ...(year === undefined ? {} : { opsYear: year }),
      ...(month === undefined ? {} : { operationsMonth: month }),
    }
    void client["domain.page.CAP11"](input, { signal: request.signal }).then((response) => {
      const latest = owner.state()
      if (request.signal.aborted || owner.generation() !== generation ||
        latest.status !== "ready" || latest.ownerKey !== ownerState.ownerKey) return
      if (response.kind !== "response") {
        console.error("Sucafina CAP11 read failure", response.reason)
        setState("page", undefined)
        setState("state", response.reason === "contract-unavailable" ? "unavailable" : "unavailable")
        return
      }
      const body = response.body
      if (body.status !== "ok") {
        setState("page", undefined)
        setState("state", body.status === "denied" ? "denied" :
          body.status === "unauthenticated" ? "session-expired" :
          body.status === "stale" ? "stale" :
          body.status === "needs-input" ? "invalid" : "unavailable")
        return
      }
      if (body.context.installationId !== active.context.stamp.installationId ||
        body.context.projectId !== active.context.stamp.projectId ||
        body.context.hostId !== active.context.stamp.hostId ||
        body.context.principalRef !== active.context.stamp.principalRef ||
        body.context.accessRevision !== active.context.stamp.accessRevision) {
        setState("page", undefined)
        setState("state", "stale")
        return
      }
      const value = body.value
      const editing = state.editor
      if (editing && draft && !submitted && String(editing.scope).startsWith(
        "CAP11:" + editing.action + ":" + value.selection.year + "-" + value.selection.month
      )) {
        const currentVersion = editing.action === "save-categories" || editing.action === "save-items"
          ? serviceListVersion(value, editing.action === "save-categories" ? "opsCats" : "opsHmItems")
          : serviceMonthVersion(value)
        if (currentVersion !== editing.version) {
          draft.receiveRemote({
            baseVersion: currentVersion,
            value: initialValues(value, editing.action, editing.item),
          })
          setState("operationState", "conflict")
        }
      }
      setState("page", value)
      setState("state", serviceReadState(value))
      if (submitted && submitted.owner === ownerState.ownerKey &&
        submitted.year === value.selection.year && submitted.month === value.selection.month) {
        if (draft) {
          const projected = initialValues(value, submitted.action, untrack(() => state.editor?.item ?? null))
          const newVersion = submitted.action === "save-categories" || submitted.action === "save-items"
            ? serviceListVersion(value, submitted.action === "save-categories" ? "opsCats" : "opsHmItems")
            : serviceMonthVersion(value)
          const sourcePresent =
            submitted.action === "save-tickets" ? !!serviceCurrentTickets(value) :
            submitted.action === "save-sla" ? !!serviceCurrentSla(value) :
            submitted.action === "save-heatmap" ?
              !!serviceCurrentHeatmap(value, untrack(() => state.editor?.item ?? "")) : true
          draft.confirmSave(sourcePresent
            ? { kind: "projected", operationRef: submitted.operationRef,
                baseVersion: newVersion, value: projected }
            : { kind: "confirmed-without-projection", operationRef: submitted.operationRef,
                resultVersion: newVersion })
        }
        submitted = undefined
        draft = undefined
        draftOwner = undefined
        setState("editor", null)
        setState("operationState", "saved")
      }
      if (state.editor === null && routeEntryConsumed !== String(props.route.href)) {
        routeEntryConsumed = String(props.route.href)
        const kind = props.route.kind
        if (kind === "edit-month" && value.allowedActionIds.includes("save-tickets"))
          untrack(() => openEditor("save-tickets"))
        if (kind === "settings" && value.allowedActionIds.includes("save-categories"))
          untrack(() => openEditor("save-categories"))
        if (kind === "import" && value.allowedActionIds.includes("import-month"))
          untrack(() => openEditor("import-month"))
      }
    }).catch((error) => {
      if (request.signal.aborted) return
      console.error("Sucafina CAP11 read failure", error instanceof Error ? error.name : "unknown")
      setState("page", undefined)
      setState("state", "unavailable")
    }).finally(() => { pendingRequests.delete(request) })
    onCleanup(() => {
      request.abort()
      pendingRequests.delete(request)
    })
  })

  function showReview() {
    const editor = state.editor
    const page = state.page
    if (!editor || !page || !activeDraft() || state.submitting) return
    if (!isValid(editor.action, fields(), page)) {
      draft?.setPhase("validation-error")
      setState("errorText", t(commonKey("fieldErrorSummary")))
      return
    }
    draft?.setPhase("reviewing")
    setState("editor", "review", true)
    setState("errorText", null)
  }

  async function submitReviewed() {
    const editor = state.editor
    const page = state.page
    const active = owner.ready()
    const ownerKey = currentOwner()
    const snap = activeDraft()
    if (!editor || !page || !active || !ownerKey || !snap || editor.review !== true ||
      !can(editor.action) || state.submitting || snap.pendingOperation !== null ||
      !isValid(editor.action, snap.value, page)) return
    if (editor.version !== (
      editor.action === "save-categories" || editor.action === "save-items"
        ? serviceListVersion(page, editor.action === "save-categories" ? "opsCats" : "opsHmItems")
        : serviceMonthVersion(page)
    )) {
      draft?.setPhase("conflict")
      setState("operationState", "conflict")
      return
    }
    const request = new AbortController()
    pendingRequests.add(request)
    const generation = owner.generation()
    const client = createSfOperationsClient(active.transport)
    const values = snap.value
    const inputBase = { version: editor.version }
    setState("submitting", true)
    // This key and digest bind exactly one reviewed intent. They are never
    // regenerated for an implicit replay of an uncertain result.
    const options = { signal: request.signal, idempotencyKey: crypto.randomUUID() }
    try {
      const intentBytes = new TextEncoder().encode(JSON.stringify([
        SOURCE_OPERATION_IDS[editor.action], editor.version, snap.value,
      ]))
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", intentBytes))
      if (request.signal.aborted || owner.generation() !== generation || currentOwner() !== ownerKey) return
      const payloadDigest = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")
      draft?.setPending({
        operationRef: editor.operationRef, idempotencyKey: options.idempotencyKey,
        payloadDigest, expectedVersion: editor.version,
      })
      draft?.setPhase("submitting")
      let result: Awaited<ReturnType<typeof client["domain.command.CAP11.save-sla"]>>
      switch (editor.action) {
        case "save-categories":
          result = await client["domain.command.CAP11.save-categories"]({
            ...inputBase, values: { names: lists(values.names ?? "") },
          }, options)
          break
        case "save-items":
          result = await client["domain.command.CAP11.save-items"]({
            ...inputBase, values: { names: lists(values.names ?? "") },
          }, options)
          break
        case "save-tickets":
          result = await client["domain.command.CAP11.save-tickets"]({
            ...inputBase,
            values: {
              year: page.selection.year, month: page.selection.month,
              ...Object.fromEntries(serviceTicketKeys(page).map((key) => [key, values[key] ?? ""])),
            },
          }, options)
          break
        case "save-sla":
          result = await client["domain.command.CAP11.save-sla"]({
            ...inputBase,
            values: { year: page.selection.year, month: page.selection.month,
              incSLA: values.incSLA ?? "", svcSLA: values.svcSLA ?? "", avail: values.avail ?? "100" },
          }, options)
          break
        case "save-heatmap":
          result = await client["domain.command.CAP11.save-heatmap"]({
            ...inputBase,
            values: {
              year: page.selection.year, month: page.selection.month,
              item: values.item ?? "", p1: values.p1 ?? "", p2: values.p2 ?? "",
              tickets: values.tickets ?? "", comments: values.comments ?? "",
            },
          }, options)
          break
        case "import-month": {
          const tickets = Object.fromEntries(serviceTicketKeys(page).map(
            (name) => [name, values["ticket." + name] ?? ""],
          ))
          const sla = {
            incSLA: values["sla.incSLA"] ?? "", svcSLA: values["sla.svcSLA"] ?? "",
            avail: values["sla.avail"] ?? "",
          }
          const heatmap = serviceItems(page).flatMap((item) => {
            const prefix = "heatmap." + item + "."
            const cell = {
              item, p1: values[prefix + "p1"] ?? "", p2: values[prefix + "p2"] ?? "",
              tickets: values[prefix + "tickets"] ?? "", comments: values[prefix + "comments"] ?? "",
            }
            return [cell.p1, cell.p2, cell.tickets, cell.comments].every((value) => value === "")
              ? [] : [cell]
          })
          result = await client["domain.command.CAP11.import-month"]({
            ...inputBase, confirmed: true,
            values: { year: page.selection.year, month: page.selection.month, tickets, sla, heatmap,
              categoriesVersion: serviceListVersion(page, "opsCats"),
              itemsVersion: serviceListVersion(page, "opsHmItems") },
          }, options)
          break
        }
      }
      if (request.signal.aborted || owner.generation() !== generation ||
        currentOwner() !== ownerKey) return
      if (result.kind !== "response") {
        if (result.reason === "outcome-unknown" || result.reason === "network" ||
          result.reason === "aborted") {
          draft?.setPhase("outcome-unknown")
          setState("operationState", "unknown")
        } else {
          draft?.setPhase("failed")
          setState("operationState", "failed")
        }
        console.error("Sucafina CAP11 mutation outcome", result.reason)
        return
      }
      if (!result.body.ok) {
        if (result.status === 409 || result.body.status === 409) {
          draft?.setPhase("conflict")
          setState("operationState", "conflict")
        } else {
          draft?.setPhase("validation-error")
        }
        setState("errorText", result.body.errors?.join("; ") ?? t(commonKey("fieldErrorSummary")))
        setState("operationState", "failed")
        console.error("Sucafina CAP11 mutation rejected", result.status)
        return
      }
      submitted = {
        operationRef: editor.operationRef,
        action: editor.action, owner: ownerKey,
        year: page.selection.year, month: page.selection.month,
      }
      setState("refresh", (value) => value + 1)
    } catch (error) {
      // A throw can follow a submitted request; never issue it a second time.
      console.error("Sucafina CAP11 mutation could not be reconciled", error instanceof Error ? error.name : "unknown")
      draft?.setPhase("outcome-unknown")
      setState("operationState", "unknown")
    } finally {
      pendingRequests.delete(request)
      setState("submitting", false)
    }
  }

  const currentFields = () => fields()
  const heading = () => {
    const action = state.editor?.action
    if (!action) return sourceKey("title")
    if (action === "save-tickets") return sourceKey("section.editTickets")
    if (action === "save-sla") return sourceKey("section.editSla")
    if (action === "save-heatmap") return sourceKey("section.editHeatmap")
    if (action === "import-month") return sourceKey("section.import")
    return sourceKey("section.settings")
  }
  const sourceDataField = (name: string, type: "number" | "text" | "textarea" = "number") => (
    <label class="sf-ops-field">
      <span>{name.startsWith("ticket.") ? name.slice(7) :
        name.startsWith("sla.") ? t(sourceKey("field." + name.slice(4) + ".label")) :
        name.startsWith("heatmap.") ? name.slice(8).replace(/.(p1|p2|tickets|comments)$/, " / $1") :
        name.includes("|") ? name : t(sourceKey("field." + name + ".label"))}</span>
      <Show when={type !== "textarea"} fallback={
        <textarea value={currentFields()[name] ?? ""} onInput={(event) => edit(name, event.currentTarget.value)} />
      }>
        <input type={type} min={type === "number" ? 0 : undefined} step={type === "number" ? "any" : undefined}
          value={currentFields()[name] ?? ""}
          onInput={(event) => edit(name, event.currentTarget.value)} />
      </Show>
    </label>
  )
  const reviewState = () => state.operationState === "conflict" ? "conflict" :
    state.operationState === "unknown" ? "outcome-unknown" :
    state.operationState === "failed" ? "invalid" : state.state
  const reviewSnapshot = (values: DraftValues, original: boolean, version = state.editor!.version): SfReviewSnapshot => {
    const editor = state.editor!
    if (original && editor.identity.kind === "new")
      return { kind: "not-provided", reason: message(commonKey("empty")) }
    return original
      ? { kind: "persisted", ref: editor.identity.kind === "record" ? editor.identity.recordRef : asRef(""),
        version, fields: reviewFields(editor.action, values) }
      : { kind: "draft",
        intentRef: editor.identity.kind === "new" ? editor.identity.newIntentRef : asIntent("u04:" + editor.scope),
        sourceRef: editor.identity.kind === "record" ? editor.identity.recordRef : null,
        sourceVersion: editor.version, fields: reviewFields(editor.action, values) }
  }
  const displayedYear = () => state.page?.selection.year ?? state.year
  const displayedMonth = () => state.page?.selection.month ?? state.month

  return (
    <SfPageFrame
      titleKey={sourceKey("title")}
      context={state.page ? [
        { id: "year", label: message(sourceKey("field.year.label")),
          value: { kind: "data", text: String(state.page.selection.year) } },
        { id: "month", label: message(sourceKey("field.month.label")),
          value: { kind: "data", text: String(state.page.selection.month) } },
      ] : []}
      tabs={[]}
      activeTab={null}
      primaryAction={{
        id: "update-month", labelKey: sourceKey("primary"), tone: "primary",
        disabled: !can("save-tickets") || state.submitting, busy: state.submitting,
        onInvoke: () => openEditor("save-tickets"),
      }}
      secondaryActions={[]}
      density="comfortable"
      layout="work"
      onLayoutMode={() => undefined}
    >
      <section class="sf-ops-service" data-sf-surface="CAP11" data-sf-read-state={state.state}>
        <Show when={state.page && ["ready", "empty", "filtered-empty", "partial"].includes(state.state)} fallback={
          <SfStatePanel
            state={state.state}
            messageKey={state.state === "loading" ? commonKey("loading") :
              state.state === "denied" ? commonKey("noAccess") :
              state.state === "invalid" ? commonKey("needsInput") :
              state.state === "session-expired" ? commonKey("loginAgain") :
              state.state === "conflict" || state.state === "stale" ? commonKey("stale") :
              commonKey("unavailable")}
            onRetryRead={() => { setState("refresh", (value) => value + 1) }}
          />
        }>
          <Show when={state.state === "partial"}>
            <p role="status">{t(commonKey("partial"))}</p>
            <button type="button" onClick={() => setState("refresh", (value) => value + 1)}>
              {t(commonKey("retry"))}
            </button>
          </Show>
          <Show when={state.state === "empty" || state.state === "filtered-empty"}>
            <p role="status">{t(state.state === "empty" ? commonKey("empty") : commonKey("filterEmpty"))}</p>
          </Show>
          <div class="sf-ops-period" role="group" aria-label={t(sourceKey("section.month"))}>
            <label>{t(sourceKey("field.year.label"))}
              <select value={displayedYear()} onChange={(event) => changeSelection("year", Number(event.currentTarget.value))}>
                <For each={SERVICE_YEARS}>{(year) => <option value={year}>{year}</option>}</For>
              </select>
            </label>
            <label>{t(sourceKey("field.month.label"))}
              <select value={displayedMonth()} onChange={(event) => changeSelection("month", Number(event.currentTarget.value))}>
                <For each={SERVICE_MONTHS}>{(month) => <option value={month}>{month}</option>}</For>
              </select>
            </label>
            <Show when={!state.page!.allowedActionIds.length}>
              <span>{t(commonKey("readOnly"))}</span>
            </Show>
          </div>

          <section aria-labelledby="sf-cap11-tickets-title">
            <h2 id="sf-cap11-tickets-title">{t(sourceKey("section.tickets"))}</h2>
            <div class="sf-ops-table" role="region" aria-label={t(sourceKey("section.tickets"))} tabindex="0">
              <table>
                <thead>
                  <tr><th scope="col">{t(sourceKey("field.month.label"))}</th>
                    <For each={serviceTicketKeys(state.page!)}>{(key) => <th scope="col">{key}</th>}</For>
                  </tr>
                </thead>
                <tbody>
                  <For each={(state.page!.data.opsTickets ?? []).filter(
                    (row) => row.year === state.page!.selection.year,
                  ).slice().sort((a, b) => Number(a.month) - Number(b.month))}>
                    {(row) => (
                      <tr><th scope="row">{serviceString(row.month)}</th>
                        <For each={serviceTicketKeys(state.page!)}>{(key) => (
                          <td>{row[key] == null ? t(sourceKey("table.noData")) : String(row[key])}</td>
                        )}</For>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
            <Show when={(state.page!.data.opsTickets ?? []).length === 0}><p>{t(commonKey("empty"))}</p></Show>
            <h3>{t(sourceKey("section.openedClosed"))}</h3>
            <div class="sf-ops-table" role="region" aria-label={t(sourceKey("section.openedClosed"))} tabindex="0">
              <table>
                <thead><tr>
                  <th scope="col">{t(sourceKey("table.month"))}</th>
                  <th scope="col">{t(sourceKey("table.opened"))}</th>
                  <th scope="col">{t(sourceKey("table.closed"))}</th>
                </tr></thead>
                <tbody>
                  <For each={SERVICE_MONTHS}>{(month) => (
                    <tr>
                      <th scope="row">{month}</th>
                      <td>{state.page!.data.display?.opened[month - 1] == null
                        ? t(sourceKey("table.noData")) : String(state.page!.data.display!.opened[month - 1])}</td>
                      <td>{state.page!.data.display?.closed[month - 1] == null
                        ? t(sourceKey("table.noData")) : String(state.page!.data.display!.closed[month - 1])}</td>
                    </tr>
                  )}</For>
                </tbody>
              </table>
            </div>
            <button type="button" disabled={!can("save-tickets")} onClick={() => openEditor("save-tickets")}>
              {t(sourceKey("action.save-tickets"))}
            </button>
          </section>

          <section aria-labelledby="sf-cap11-sla-title">
            <h2 id="sf-cap11-sla-title">{t(sourceKey("section.sla"))}</h2>
            <div class="sf-ops-table" role="region" aria-label={t(sourceKey("section.sla"))} tabindex="0">
              <table>
                <thead><tr><th>{t(sourceKey("table.month"))}</th>
                  <th>{t(sourceKey("table.incidentSla"))}</th>
                  <th>{t(sourceKey("table.serviceSla"))}</th>
                  <th>{t(sourceKey("table.availability"))}</th>
                </tr></thead>
                <tbody>
                  <For each={(state.page!.data.opsSLA ?? []).filter(
                    (row) => row.year === state.page!.selection.year,
                  ).slice().sort((a, b) => Number(a.month) - Number(b.month))}>
                    {(row) => <tr><th scope="row">{serviceString(row.month)}</th>
                      <For each={SERVICE_SLA_FIELDS}>{(key) =>
                        <td>{row[key] == null ? t(sourceKey("table.noData")) : String(row[key])}</td>}
                      </For>
                    </tr>}
                  </For>
                </tbody>
              </table>
            </div>
            <h3>{t(sourceKey("section.slaTrend"))}</h3>
            <div class="sf-ops-table" role="region" aria-label={t(sourceKey("section.slaTrend"))} tabindex="0">
              <table>
                <thead><tr>
                  <th scope="col">{t(sourceKey("table.month"))}</th>
                  <th scope="col">{t(sourceKey("table.incidentSla"))}</th>
                  <th scope="col">{t(sourceKey("table.serviceSla"))}</th>
                  <th scope="col">{t(sourceKey("table.availability"))}</th>
                </tr></thead>
                <tbody>
                  <For each={SERVICE_MONTHS}>{(month) => {
                    const row = (state.page!.data.opsSLA ?? []).find((source) =>
                      source.year === state.page!.selection.year && source.month === month)
                    return <tr>
                      <th scope="row">{month}</th>
                      <For each={SERVICE_SLA_FIELDS}>{(name) =>
                        <td>{row?.[name] == null ? t(sourceKey("table.noData")) : String(row[name])}</td>}
                      </For>
                    </tr>
                  }}</For>
                </tbody>
              </table>
            </div>
            <button type="button" disabled={!can("save-sla")} onClick={() => openEditor("save-sla")}>
              {t(sourceKey("action.save-sla"))}
            </button>
          </section>

          <section aria-labelledby="sf-cap11-heat-title">
            <h2 id="sf-cap11-heat-title">{t(sourceKey("section.heatmap"))}</h2>
            <div class="sf-ops-table" role="region" aria-label={t(sourceKey("section.heatmap"))} tabindex="0">
              <table>
                <thead><tr><th>{t(sourceKey("table.item"))}</th>
                  <For each={SERVICE_MONTHS}>{(month) => <th scope="col">{month}</th>}</For>
                </tr></thead>
                <tbody>
                  <For each={serviceItems(state.page!)}>{(item) => (
                    <tr><th scope="row">{item}</th>
                      <For each={SERVICE_MONTHS}>{(month) => {
                        const row = (state.page!.data.opsHeatmap ?? []).find(
                          (candidate) => candidate.year === state.page!.selection.year &&
                            candidate.month === month && candidate.item === item,
                        )
                        return <td>{row ? (
                          <span title={serviceString(row.comments)}>
                            {[row.p1 ?? "", row.p2 ?? "", row.tickets ?? ""].join("/")}
                          </span>
                        ) : t(sourceKey("table.noData"))}</td>
                      }}</For>
                    </tr>
                  )}</For>
                </tbody>
              </table>
            </div>
            <div class="sf-ops-actions">
              <For each={serviceItems(state.page!)}>{(item) => (
                <button type="button" disabled={!can("save-heatmap")} onClick={() => openEditor("save-heatmap", item)}>
                  {t(sourceKey("action.save-heatmap"))} — {item}
                </button>
              )}</For>
            </div>
          </section>

          <section aria-labelledby="sf-cap11-config-title">
            <h2 id="sf-cap11-config-title">{t(sourceKey("section.settings"))}</h2>
            <dl><dt>{t(sourceKey("field.opsCats.label"))}</dt>
              <dd>{serviceCategories(state.page!).join(", ")}</dd>
              <dt>{t(sourceKey("field.opsHmItems.label"))}</dt>
              <dd>{serviceItems(state.page!).join(", ")}</dd></dl>
            <div class="sf-ops-actions">
              <button type="button" disabled={!can("save-categories")} onClick={() => openEditor("save-categories")}>
                {t(sourceKey("action.save-categories"))} — {t(sourceKey("field.opsCats.label"))}
              </button>
              <button type="button" disabled={!can("save-items")} onClick={() => openEditor("save-items")}>
                {t(sourceKey("action.save-items"))} — {t(sourceKey("field.opsHmItems.label"))}
              </button>
            </div>
          </section>

          <section aria-labelledby="sf-cap11-import-title">
            <h2 id="sf-cap11-import-title">{t(sourceKey("section.import"))}</h2>
            <button type="button" disabled={!can("import-month")} onClick={() => openEditor("import-month")}>
              {t(sourceKey("action.import-month"))}
            </button>
          </section>

          <Show when={state.operationState === "conflict"}>
            <p role="alert">{t(commonKey("conflict"))}</p>
            <button type="button" onClick={() => setState("refresh", (value) => value + 1)}>
              {t(commonKey("retry"))}
            </button>
            <Show when={state.editor && activeDraft()}>
              <button type="button" onClick={discardCurrent}>{t(commonKey("discard"))}</button>
            </Show>
          </Show>
          <Show when={state.operationState === "saved"}>
            <p role="status">{t(commonKey("saved"))}</p>
          </Show>
          <Show when={state.operationState === "unknown"}>
            <p role="alert">{t(commonKey("operationUnknown"))}</p>
          </Show>
          <Show when={state.operationState === "failed" || state.errorText}>
            <p role="alert">{state.errorText ?? t(commonKey("failed"))}</p>
          </Show>

          <Show when={state.editor && activeDraft()}>
            <section class="sf-ops-editor" aria-labelledby="sf-cap11-editor-title" aria-busy={state.submitting}
              onKeyDown={(event) => {
                if (event.key === "Escape" && !state.editor?.review && !state.submitting) {
                  event.stopPropagation()
                  closeEditor()
                }
              }}>
              <h2 id="sf-cap11-editor-title">{t(heading())}</h2>
              <Show when={!state.editor!.review} fallback={
                <SfChangeReview
                  operation={{
                    ref: state.editor!.operationRef,
                    label: message(sourceKey("action." + state.editor!.action)),
                    scope: { kind: "data", text: serviceRecordId(state.page!.selection.year, state.page!.selection.month) },
                  }}
                  base={reviewSnapshot(activeDraft()!.base ?? {}, true)}
                  current={reviewSnapshot(
                     activeDraft()!.conflict?.current ?? activeDraft()!.base ?? {}, true,
                     activeDraft()!.conflict?.currentVersion ?? state.editor!.version,
                   )}
                  proposed={reviewSnapshot(currentFields(), false)}
                  effects={[{
                    id: state.editor!.action,
                    domain: "dashboard", title: { kind: "message", message: message(sourceKey("action." + state.editor!.action)) },
                    state: "proposed", details: reviewFields(state.editor!.action, currentFields()),
                  }]}
                  coverage={{
                    state: "complete", summary: message(commonKey("currentSource")),
                    reasons: [], knownCount: null, expectedCount: null,
                  }}
                  blockingReasons={!isValid(state.editor!.action, currentFields(), state.page!) ?
                    [message(commonKey("fieldErrorSummary"))] : []}
                  confirmation={{
                    kind: "admitted",
                    labelKey: sourceKey("action." + state.editor!.action),
                    purpose: state.editor!.action === "import-month" ? "import" : "save",
                    binding: {
                      kind: "catalog-command",
                      operationId: SOURCE_OPERATION_IDS[state.editor!.action],
                      version: { kind: "record", expectedVersion: state.editor!.version },
                      confirmation: state.editor!.action === "import-month" ?
                        "producer-confirmed-field" : "presentation-only",
                    },
                  }}
                  state={reviewState()}
                  onConfirm={() => { void submitReviewed() }}
                  onRevise={() => { setState("editor", "review", false); draft?.setPhase("dirty") }}
                  onCancel={() => setState("editor", "review", false)}
                   onReconcile={() => setState("refresh", (value) => value + 1)}
                />
              }>
                <form onSubmit={(event) => { event.preventDefault(); showReview() }}>
                  <Show when={state.editor!.action === "save-tickets"}>
                    <div class="sf-ops-grid">
                      <For each={serviceTicketKeys(state.page!)}>{(name) => sourceDataField(name)}</For>
                    </div>
                  </Show>
                  <Show when={state.editor!.action === "save-sla"}>
                    <div class="sf-ops-grid">
                      <For each={SERVICE_SLA_FIELDS}>{(name) => sourceDataField(name)}</For>
                    </div>
                  </Show>
                  <Show when={state.editor!.action === "save-heatmap"}>
                    <label class="sf-ops-field">{t(sourceKey("field.item.label"))}
                      <select value={currentFields().item ?? ""}
                        onChange={(event) => edit("item", event.currentTarget.value)}>
                        <For each={serviceItems(state.page!)}>{(item) => <option value={item}>{item}</option>}</For>
                      </select>
                    </label>
                    <div class="sf-ops-grid">
                      <For each={SERVICE_HEAT_FIELDS}>{(name) => sourceDataField(name)}</For>
                      {sourceDataField("comments", "textarea")}
                    </div>
                  </Show>
                  <Show when={state.editor!.action === "save-categories" || state.editor!.action === "save-items"}>
                    {sourceDataField("names", "textarea")}
                  </Show>
                  <Show when={state.editor!.action === "import-month"}>
                    <section>
                      <h3>{t(sourceKey("section.tickets"))}</h3>
                      <div class="sf-ops-grid">
                        <For each={serviceTicketKeys(state.page!)}>{(name) =>
                          sourceDataField("ticket." + name)}</For>
                      </div>
                    </section>
                    <section>
                      <h3>{t(sourceKey("section.sla"))}</h3>
                      <div class="sf-ops-grid">
                        <For each={SERVICE_SLA_FIELDS}>{(name) =>
                          sourceDataField("sla." + name)}</For>
                      </div>
                    </section>
                    <section>
                      <h3>{t(sourceKey("section.heatmap"))}</h3>
                      <div class="sf-ops-grid">
                        <For each={serviceItems(state.page!)}>{(item) =>
                          <For each={[...SERVICE_HEAT_FIELDS, "comments"]}>{(name) =>
                            sourceDataField("heatmap." + item + "." + name,
                              name === "comments" ? "textarea" : "number")}</For>
                        }</For>
                      </div>
                    </section>
                    <p>{t(commonKey("reviewImport"))}</p>
                  </Show>
                  <div class="sf-ops-actions">
                    <button type="submit" disabled={state.submitting || !isValid(state.editor!.action, currentFields(), state.page!)}>
                      {t(commonKey("review"))}
                    </button>
                    <button type="button" onClick={closeEditor}>
                      {t(commonKey("close"))}
                    </button>
                    <button type="button" disabled={state.submitting || state.operationState === "unknown"}
                      onClick={discardCurrent}>{t(commonKey("discard"))}</button>
                  </div>
                </form>
              </Show>
            </section>
          </Show>
        </Show>
      </section>
    </SfPageFrame>
  )
}
