import { sfSameOwnerSelection } from "../../navigation-state/owner"
import { createEffect, createMemo, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useSfContext } from "../../context"
import type { SfIntentRef, SfOperationRef } from "@orchestra/schema/sucafina/context"
import type { SfEditScopeKey, SfRef, SfSurfaceProps } from "../../context/contracts"
import { SfPageFrame } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { SfDataTable } from "../../shared/table"
import { SfRecordDetail } from "../../shared/detail"
import { SfChangeReview } from "../../shared/change-review"
import {
  createSfProcurementClient, exportSfSupplierCsv, sfSupplierCsvBindingInstalled,
} from "@orchestra/client/sucafina/procurement"
import type { SfReviewField, SfReviewSnapshot } from "../../shared/change-review"
import type { SfCopyKey, SfDisplayValue, SfMessage, SfText, SfUiState } from "../../shared/frame"
import type { SfSort } from "../../shared/table"
import type { SfU14CopyKey } from "@/i18n/orchestra-chapters/sf-u14"
import {
  bankFields, booleanFields, generalFields, generalDraftFields, linkedRequests,
  multilineFields, supplierEdit, supplierRevision, supplierVersion,
  uniqueSupplier, type Cap27PageOk, type Supplier, type SupplierAction, type SupplierEdit,
} from "./model"
import "./suppliers.css"

type Read =
  | Readonly<{ kind: "ok"; page: Cap27PageOk }>
  | Readonly<{ kind: "denied" | "unavailable" | "session-expired" | "not-found" | "stale" | "invalid" }>
type Mode = "detail" | "edit" | "new" | "bank"
type Intent = Readonly<{
  action: SupplierAction
  ref: string | null
  version: number
  revision: string | null
  token: string
  value: SupplierEdit
  intentRef: SfIntentRef
}>
type Phase = "idle" | "reviewing" | "checking" | "submitting" | "outcome-unknown" | "verifying" | "producer-confirmed" | "conflict" | "failed"
type CsvState = "idle" | "downloading" | "denied" | "unauthenticated" | "stale" | "unavailable"
const k = (value: SfU14CopyKey) => value as SfCopyKey
const m = (value: SfU14CopyKey): SfMessage => ({ key: k(value) })
const data = (text: string): SfText => ({ kind: "data", text })
const value = (item: unknown): SfDisplayValue => {
  if (item === undefined || item === null || item === "") return { kind: "missing", reason: m("sf.u14.missing") }
  if (typeof item === "boolean") return { kind: "boolean", value: item, trueLabel: m("sf.u14.active"), falseLabel: m("sf.u14.inactive") }
  if (Array.isArray(item)) return { kind: "list", items: item.map(value) }
  if (typeof item === "object") return { kind: "text", text: data(JSON.stringify(item)) }
  return { kind: "text", text: data(String(item)) }
}
const display = (item: unknown) => typeof item === "string" ? item : item == null ? "" : String(item)
const fieldKey = (field: string) => k(("sf.u14.field." + field) as SfU14CopyKey)
const bankSet = new Set<string>(bankFields)
const active = (phase: Phase) => phase === "reviewing" || phase === "checking" || phase === "submitting" || phase === "verifying" || phase === "outcome-unknown"

export function SfSuppliersView(props: SfSurfaceProps<"CAP27">): JSX.Element {
  const host = useSfContext()
  const language = useLanguage()
  const platform = usePlatform()
  const t = (key: SfU14CopyKey) => language.t(k(key) as Parameters<typeof language.t>[0])
  const [ui, setUi] = createStore<{
    token: string | null
    state: SfUiState
    page: Cap27PageOk | null
    selected: string | null
    mode: Mode
    search: string
    filter: string
    sort: SfSort
    layoutMode: "single" | "split" | "split-context"
    phase: Phase
    review: Intent | null
    unknownOperation: string | null
    error: SfUiState | null
    confirmedMessage: string | null
    csvState: CsvState
  }>({
    token: null, state: "loading", page: null, selected: null, mode: "detail",
    search: "", filter: "All", sort: { kind: "none" }, layoutMode: "split",
    phase: "idle", review: null, unknownOperation: null, error: null,
    confirmedMessage: null, csvState: "idle",
  })
  let readAbort: AbortController | undefined
  let writeAbort: AbortController | undefined
  let csvAbort: AbortController | undefined
  let readSequence = 0
  let sending = false

  // A route is a locator, not a grant. F01 owns the authenticated tuple and
  // purges private projection/draft when its identity changes.
  const authority = () => {
    const state = host.state()
    if (state.status !== "ready" || !host.ready()) return null
    const requested = props.route.ownerSelection
    if (!sfSameOwnerSelection(state.selection, requested)) return null
    return JSON.stringify([state.ownerKey, host.generation(), state.owner.authEpoch, state.context.stamp, props.route.href])
  }
  const page = () => authority() && ui.token === authority() ? ui.page : null

  // The CAP27 projection grants neither a download nor hidden bank fields.
  // The current files/exports operation, source destination and installed
  // byte binding must ALL be admitted for this owner and policy epoch.
  const csvAllowed = () => {
    const ready = host.ready(), current = page()
    if (!ready || !current || current.value.capabilityId !== "CAP27" ||
        ui.state !== "ready" || !authority()) return false
    return sfSupplierCsvBindingInstalled(ready.transport) &&
      ready.context.destinations.some((dest) =>
        dest.capabilityId === "CAP27" && dest.surface === "procurement" &&
        dest.page === "Suppliers" && dest.canRead) &&
      ready.context.availability.some((resource) =>
        resource.family === "files" && resource.resource === "exports" &&
        resource.operations.some((op) =>
          op.operationId === "files.export.suppliers" && op.state === "ready" && op.operational))
  }
  const csvReady = () => csvAllowed() && ui.csvState !== "downloading"
  const routeRef = () => props.route.kind === "detail" || props.route.kind === "edit"
    ? props.route.params.supplierRef : null
  const ref = () => routeRef() ?? ui.selected
  const supplier = createMemo(() => {
    const projection = page(), selected = ref()
    return projection && selected ? uniqueSupplier(projection, selected) : null
  })
  const version = () => {
    const current = page(), selected = ref()
    return current && selected ? supplierVersion(current, selected) : null
  }
  const can = (action: SupplierAction) => {
    const current = page()
    const context = host.ready()?.context
    return !!current && !!context &&
      current.value.allowedActionIds.includes(action) &&
      context.availability.some((resource) =>
        resource.family === "procurement" && resource.resource === "CAP27" &&
        resource.operations.some((operation) =>
          operation.operationId === "domain.command.CAP27." + action &&
          operation.state === "ready" && operation.operational,
        ),
      )
  }
  const read = async (token: string, source: string | undefined, signal: AbortSignal): Promise<Read> => {
    const ready = host.ready()
    if (!ready || authority() !== token) return { kind: "unavailable" }
    try {
      const response = await createSfProcurementClient(ready.transport)["domain.page.CAP27"](
        source ? { supplier: source } : {}, { signal },
      )
      if (signal.aborted || authority() !== token) return { kind: "unavailable" }
      if (response.kind === "transport-error") return { kind: "unavailable" }
      if (response.status === 401 || response.body.status === "unauthenticated") return { kind: "session-expired" }
      if (response.status === 403 || response.body.status === "denied") return { kind: "denied" }
      if (response.status === 404) return { kind: "not-found" }
      if (response.status === 409 || response.body.status === "stale") return { kind: "stale" }
      if (response.status !== 200 || response.body.status !== "ok") return { kind: "unavailable" }
      const page = response.body
      if (page.value.capabilityId !== "CAP27" ||
          Object.keys(ready.context.stamp).some((field) =>
            page.context[field as keyof typeof page.context] !==
            ready.context.stamp[field as keyof typeof ready.context.stamp],
          )) return { kind: "invalid" }
      return { kind: "ok", page }
    } catch {
      return { kind: "unavailable" }
    }
  }
  const refresh = async (token: string, source?: string) => {
    readAbort?.abort()
    const controller = new AbortController()
    readAbort = controller
    const sequence = ++readSequence
    const result = await read(token, source, controller.signal)
    if (controller.signal.aborted || sequence !== readSequence || authority() !== token) return null
    if (result.kind !== "ok") {
      if (result.kind === "denied" || result.kind === "session-expired" || result.kind === "invalid")
        setUi("page", null)
      setUi("state", result.kind)
      return null
    }
    setUi("page", result.page)
    setUi("state", "ready")
    return result.page
  }
  createEffect(() => {
    const token = authority()
    const chosen = routeRef()
    readAbort?.abort()
    writeAbort?.abort()
    csvAbort?.abort()
    csvAbort = undefined
    sending = false
    setUi({
      token, state: token ? "loading" : "session-expired", page: null,
      selected: chosen, mode: props.route.kind === "new" ? "new" : props.route.kind === "edit" ? "edit" : "detail",
      review: null, phase: "idle", unknownOperation: null, error: null, confirmedMessage: null,
      csvState: "idle",
    })
    if (token) void refresh(token, chosen ?? undefined)
    onCleanup(() => { readAbort?.abort(); writeAbort?.abort(); csvAbort?.abort() })
  })

  const draft = createMemo(() => {
    const ready = host.ready(), current = supplier(), projection = page()
    if (!ready || !projection || !authority()) return null
    if (ui.mode === "new" && can("create")) {
      return ready.drafts.acquire<SupplierEdit>({
        surfaceId: "CAP27", identity: { kind: "new", newIntentRef: "CAP27:supplier-create" as SfIntentRef },
        editScopeKey: "CAP27:general" as SfEditScopeKey, baseVersion: null, base: null, value: {},
        revalidation: { operationId: "domain.page.CAP27", input: {}, fieldPaths: generalDraftFields,
          actionIds: ["create"] },
      })
    }
    if (!current?.id || version() === null) return null
    const bank = ui.mode === "bank"
    if (!can(bank ? "change-bank" : "save") || bank && !projection.value.data.bankVerificationAvailable) return null
    const original = bank ? {} : supplierEdit(current)
    return ready.drafts.acquire<SupplierEdit>({
      surfaceId: "CAP27", identity: { kind: "record", recordRef: current.id as SfRef },
      editScopeKey: (bank ? "CAP27:bank" : "CAP27:general") as SfEditScopeKey,
      baseVersion: version(), base: original, value: original,
      revalidation: { operationId: "domain.page.CAP27", input: { supplier: current.id },
        fieldPaths: bank ? bankFields : generalDraftFields, actionIds: [bank ? "change-bank" : "save"] },
    })
  })
  createEffect(() => {
    const source = supplier(), currentVersion = version(), controller = draft()
    if (!source || currentVersion === null || !controller) return
    const state = controller.snapshot()
    if (state.availability === "active" && state.baseVersion !== currentVersion)
      controller.receiveRemote({ baseVersion: currentVersion, value: ui.mode === "bank" ? {} : supplierEdit(source) })
  })
  const editState = () => draft()?.snapshot()
  const draftValue = (): SupplierEdit => {
    const current = editState()
    return current?.availability === "active" ? current.value : {}
  }
  const edit = (field: keyof SupplierEdit, next: string | boolean | readonly string[]) => {
    const controller = draft(), state = controller?.snapshot()
    if (!controller || state?.availability !== "active" || active(ui.phase)) return
    controller.edit({ ...state.value, [field]: next })
  }
  const updateSection = (field: "commercial" | "compliance", next: string) => {
    const controller = draft(), state = controller?.snapshot()
    if (!controller || state?.availability !== "active" || active(ui.phase)) return
    controller.edit({ ...state.value, [field]: { ...state.value[field], notes: next } })
  }
  const updateContact = (index: number, field: "name" | "email" | "phone", next: string) => {
    const controller = draft(), state = controller?.snapshot()
    if (!controller || state?.availability !== "active" || active(ui.phase)) return
    const contacts = [...(state.value.contacts ?? [])]
    contacts[index] = { ...contacts[index], [field]: next }
    controller.edit({ ...state.value, contacts })
  }
  const addContact = () => {
    const controller = draft(), state = controller?.snapshot()
    if (!controller || state?.availability !== "active" || active(ui.phase)) return
    controller.edit({ ...state.value, contacts: [...(state.value.contacts ?? []), { name: "", email: "", phone: "" }] })
  }
  const removeContact = (index: number) => {
    const controller = draft(), state = controller?.snapshot()
    if (!controller || state?.availability !== "active" || active(ui.phase)) return
    controller.edit({ ...state.value, contacts: (state.value.contacts ?? []).filter((_, position) => position !== index) })
  }
  const rows = () => {
    const current = page()
    if (!current) return []
    const query = ui.search.trim().toLocaleLowerCase()
    const filtered = current.value.data.suppliers.filter((item) =>
      (ui.filter === "All" || item.status === ui.filter) &&
      (!query || [item.number, item.legalName]
        .some((v) => display(v).toLocaleLowerCase().includes(query))),
    )
    if (ui.sort.kind !== "field") return filtered
    const sorted = [...filtered]
    const field = ui.sort.key as "number" | "legalName" | "status"
    sorted.sort((a, b) => display(a[field]).localeCompare(display(b[field])))
    return ui.sort.direction === "desc" ? sorted.reverse() : sorted
  }
  const state = (): SfUiState => {
    if (!authority() || ui.token !== authority()) {
      const current = host.state().status
      return current === "denied" ? "denied" :
        current === "resolving" ? "loading" :
        current === "context-mismatch" ? "invalid" :
        current === "unavailable" || current === "choose-installation" ? "unavailable" : "session-expired"
    }
    if (ui.state !== "ready") return ui.state
    if (ui.phase === "outcome-unknown") return "outcome-unknown"
    if (ui.phase === "conflict") return "conflict"
    if (ui.phase === "failed") {
      const snap = editState()
      return ui.error === "denied" || ui.error === "session-expired" || ui.error === "not-found" ||
        !!(snap?.availability === "active" && snap.pendingOperation) ? ui.error ?? "unavailable" : "ready"
    }
    if (routeRef() && !supplier()) return "not-found"
    if (ui.mode !== "new" && !routeRef() && page()?.value.data.suppliers.length === 0) return "empty"
    if (ui.mode !== "new" && !routeRef() && rows().length === 0) return "filtered-empty"
    return "ready"
  }
  const stateKey = (): SfU14CopyKey => ({
    loading: "sf.u14.loading", empty: "sf.u14.empty", "filtered-empty": "sf.u14.filteredEmpty",
    "not-found": "sf.u14.notFound", denied: "sf.u14.denied", "session-expired": "sf.u14.sessionExpired",
    unavailable: "sf.u14.unavailable", stale: "sf.u14.stale", conflict: "sf.u14.stale",
    invalid: "sf.u14.invalid", "outcome-unknown": "sf.u14.unknown",
  } as Partial<Record<SfUiState, SfU14CopyKey>>)[state()] ?? "sf.u14.unavailable"


  /**
   * Only the exact A06/F02 producer bytes are downloaded; never CSV-serialize
   * CAP27 rows or embed a bearer URL. F02 reauthorizes actor/policy/stamp after
   * receiving the bytes, while this view fences owner changes before egress.
   */
  const beginCsv = async () => {
    const token = authority(), ready = host.ready()
    if (!token || !ready || !csvReady() || csvAbort) return
    const controller = new AbortController()
    const principal = ready.context.stamp
    csvAbort = controller
    setUi("csvState", "downloading")
    try {
      const result = await exportSfSupplierCsv(ready.transport, { surface: "procurement" }, {
        signal: controller.signal,
      })
      if (controller.signal.aborted || authority() !== token ||
          host.ready()?.transport !== ready.transport) return
      if (result.status !== "ok") {
        if (result.status === "aborted") return
        console.error("SF_SUPPLIER_CSV_PRODUCER_REFUSED", result.status)
        if (result.status === "denied" || result.status === "unauthenticated" || result.status === "stale") {
          setUi("page", null)
          setUi("state", result.status === "unauthenticated" ? "session-expired" :
            result.status === "denied" ? "denied" : "stale")
        }
        setUi("csvState", result.status === "invalid" ? "unavailable" : result.status)
        return
      }
      const current = host.ready()?.context.stamp
      const sameStamp = current && Object.keys(principal).every((key) =>
        principal[key as keyof typeof principal] === current[key as keyof typeof current] &&
        current[key as keyof typeof current] === result.stamp[key as keyof typeof result.stamp])
      if (!sameStamp || !csvAllowed() || authority() !== token) {
        setUi("csvState", "stale")
        return
      }

      if (controller.signal.aborted || authority() !== token || !csvAllowed()) return
      if (platform.downloadResponse) {
        // Existing native response-download IPC: chooser, 64-KiB writes, temp
        // file, atomic finish and cancel. Check the active owner every chunk;
        // a change errors reader.closed and cancels even an in-flight chooser.
        let offset = 0
        let sink: ReadableStreamDefaultController<Uint8Array> | undefined
        const revoke = () => {
          try { sink?.error(new DOMException("Supplier CSV owner changed", "AbortError")) }
          catch { /* source already closed */ }
        }
        const bytes = new Uint8Array(result.bytes)
        const source = new ReadableStream<Uint8Array>({
          start(current) {
            sink = current
            controller.signal.addEventListener("abort", revoke, { once: true })
          },
          pull(current) {
            if (controller.signal.aborted || authority() !== token ||
                host.ready()?.transport !== ready.transport || !csvAllowed()) {
              revoke()
              return
            }
            if (offset === bytes.byteLength) { current.close(); return }
            const end = Math.min(offset + 64 * 1024, bytes.byteLength)
            current.enqueue(new Uint8Array(bytes.subarray(offset, end)))
            offset = end
          },
          cancel() { controller.signal.removeEventListener("abort", revoke) },
        }, { highWaterMark: 0 })
        try {
          await platform.downloadResponse(
            new Response(source as BodyInit, { headers: { "Content-Type": result.mediaType } }),
            result.fileName,
          )
        } finally {
          controller.signal.removeEventListener("abort", revoke)
          sink = undefined
        }
        if (controller.signal.aborted || authority() !== token) return
      } else {
        // Web: original producer bytes only, never frontend-generated CSV.
        const blob = new Blob([new Uint8Array(result.bytes)], { type: result.mediaType })
        if (controller.signal.aborted || authority() !== token || !csvAllowed()) return
        const url = URL.createObjectURL(blob)
        try {
          const anchor = document.createElement("a")
          anchor.href = url
          anchor.download = result.fileName
          anchor.rel = "noopener"
          document.body.append(anchor)
          try { anchor.click() }
          finally { anchor.remove() }
        } finally {
          setTimeout(() => URL.revokeObjectURL(url), 10_000)
        }
      }
      setUi("csvState", "idle")
    } catch (error) {
      if (!controller.signal.aborted &&
          !(error instanceof DOMException && error.name === "AbortError") &&
          authority() === token) {
        console.error("SF_SUPPLIER_CSV_DOWNLOAD_FAILED")
        setUi("csvState", "unavailable")
      }
    } finally {
      if (csvAbort === controller) {
        csvAbort = undefined
        if (authority() === token && ui.csvState === "downloading") setUi("csvState", "idle")
      }
    }
  }

  const bankAuthorized = () =>
    can("change-bank") && page()?.value.data.bankVerificationAvailable === true

  const begin = (action: SupplierAction) => {
    const token = authority(), current = page()
    if (!token || !current || ui.review || active(ui.phase) || sending || !can(action)) return
    const isCreate = action === "create"
    const selected = supplier()
    const ref = !isCreate ? selected?.id : null
    const recordVersion = isCreate ? 0 : version()
    if (!isCreate && (!ref || recordVersion === null)) return
    if (action === "delete" && (!selected || selected.status !== "pending" ||
        linkedRequests(current, selected.id ?? "").length !== 0)) return
    if (action === "change-bank" && !bankAuthorized()) return
    if (["create", "save", "change-bank"].includes(action) &&
        !(action === "change-bank" ? ui.mode === "bank" : draft())) return
    const draftState = draft()?.snapshot()
    if (["create", "save", "change-bank"].includes(action) &&
        (draftState?.availability !== "active" || !!draftState.pendingOperation ||
         !!draftState.conflict || (action === "change-bank" && Object.keys(draftState.value).length === 0))) return
    const requested: SupplierEdit =
      action === "create" || action === "save" || action === "change-bank"
        ? draftValue() : {}
    if ((action === "create" || action === "save") && !requested.legalName?.trim()) {
      setUi("error", "invalid")
      return
    }
    if (draftState?.availability === "active" && draftState.baseVersion !== (isCreate ? null : recordVersion)) return
    if (action === "delete" && ui.mode === "bank") return
    const intent = {
      action, ref: ref ?? null, version: recordVersion ?? 0,
      revision: ref ? supplierRevision(current, ref) : null, token,
      value: requested, intentRef: crypto.randomUUID() as SfIntentRef,
    } satisfies Intent
    if (ref && !intent.revision) return
    if (draftState?.availability === "active") draft()?.setPhase("reviewing")
    setUi("review", intent)
    setUi("phase", "reviewing")
    setUi("error", null)
  }
  const fieldsFor = (item: SupplierEdit, bank: boolean): SfReviewField[] => {
    const names = bank ? bankFields.filter((field) => Object.hasOwn(item, field)) :
      [...generalFields.filter((field) => Object.hasOwn(item, field)),
       ...(item.contacts === undefined ? [] : ["contacts"] as const),
       ...(item.commercial === undefined ? [] : ["commercial.notes"] as const),
       ...(item.compliance === undefined ? [] : ["compliance.notes"] as const)]
    return names.map((field) => ({
      path: field, label: m(field === "contacts" ? "sf.u14.contacts" :
        field === "commercial.notes" ? "sf.u14.field.commercial.notes" :
        field === "compliance.notes" ? "sf.u14.field.compliance.notes" :
        ("sf.u14.field." + field) as SfU14CopyKey),
      value: bank ? { kind: "text", text: { kind: "message", message: m("sf.u14.changed") } } :
        value(field === "commercial.notes" ? item.commercial?.notes :
          field === "compliance.notes" ? item.compliance?.notes : item[field as keyof SupplierEdit]),
    }))
  }
  const baseSnapshot = (intent: Intent): SfReviewSnapshot | null => {
    const current = page(), row = supplier()
    if (!current || !row?.id || intent.ref !== row.id) return null
    return { kind: "persisted", ref: row.id as SfRef, version: intent.version,
      fields: [
        { path: "status", label: m("sf.u14.status"), value: value(row.status) },
        ...(intent.action === "change-bank" ? [] : fieldsFor(supplierEdit(row), false)),
      ],
    }
  }
  const confirmation = () => {
    const intent = ui.review
    if (!intent) return { kind: "blocked", labelKey: k("sf.u14.readOnly"), reasons: [m("sf.u14.readOnly")] } as const
    if (!can(intent.action) || intent.token !== authority())
      return { kind: "blocked", labelKey: k("sf.u14.readOnly"), reasons: [m("sf.u14.readOnly")] } as const
    return {
      kind: "admitted", labelKey: k("sf.u14.confirm"), purpose: intent.action,
      binding: { kind: "catalog-command", operationId: ("domain.command.CAP27." + intent.action) as
        "domain.command.CAP27.create" | "domain.command.CAP27.save" | "domain.command.CAP27.activate" |
        "domain.command.CAP27.block" | "domain.command.CAP27.inactivate" |
        "domain.command.CAP27.delete" | "domain.command.CAP27.change-bank",
        version: intent.ref ? { kind: "record", expectedVersion: intent.version } as const : { kind: "none" } as const, confirmation: "presentation-only",
      },
    } as const
  }
  const confirm = async (admitted: Extract<ReturnType<typeof confirmation>, {kind:"admitted"}>) => {
    const intent = ui.review, token = authority(), current = page()
    if (!intent || !token || !current || sending || ui.phase !== "reviewing" ||
        !can(intent.action) || !admitted || admitted.purpose !== intent.action ||
        admitted.binding.operationId !== "domain.command.CAP27." + intent.action ||
        admitted.binding.kind !== "catalog-command") return
    if (intent.ref && (admitted.binding.version.kind !== "record" ||
        admitted.binding.version.expectedVersion !== intent.version)) return
    if (!intent.ref && admitted.binding.version.kind !== "none") return
    sending = true
    writeAbort?.abort()
    const controller = new AbortController()
    writeAbort = controller
    setUi("phase", "checking")
    const before = await read(token, intent.ref ?? undefined, controller.signal)
    if (controller.signal.aborted || token !== authority()) { sending = false; return }
    if (before.kind !== "ok" ||
        !before.page.value.allowedActionIds.includes(intent.action) ||
        (intent.ref && (supplierRevision(before.page, intent.ref) !== intent.revision ||
          supplierVersion(before.page, intent.ref) !== intent.version))) {
      setUi("review", null)
      setUi("phase", "conflict")
      sending = false
      return
    }
    const controllerDraft = draft(), ds = controllerDraft?.snapshot()
    if (["save","create","change-bank"].includes(intent.action) &&
        (ds?.availability !== "active" || ds.pendingOperation ||
         ds.conflict || JSON.stringify(ds.value) !== JSON.stringify(intent.value))) {
      setUi("review", null)
      setUi("phase", "conflict")
      sending = false
      return
    }
    const opRef = crypto.randomUUID() as SfOperationRef
    const idempotencyKey = crypto.randomUUID()
    const requestBody = { page: "Suppliers", action: intent.action, id: intent.ref ?? undefined,
      version: intent.version,
      values: ["create","save","change-bank"].includes(intent.action) ? { supplier: intent.value } : {} }
    let payloadDigest: string
    try {
      const bytes = new Uint8Array(await crypto.subtle.digest(
        "SHA-256", new TextEncoder().encode(JSON.stringify(requestBody)),
      ))
      payloadDigest = Array.from(bytes, (item) => item.toString(16).padStart(2,"0")).join("")
    } catch {
      setUi("phase","failed")
      setUi("error","unavailable")
      sending = false
      return
    }
    if (controller.signal.aborted || token !== authority()) { sending = false; return }
    // A status action never consumes the general or privileged bank draft.
    const editsDraft = intent.action === "create" || intent.action === "save" || intent.action === "change-bank"
    if (editsDraft) {
      controllerDraft?.setPending({operationRef:opRef,idempotencyKey,payloadDigest,
        expectedVersion:intent.ref ? intent.version : null})
      controllerDraft?.setPhase("submitting")
    }
    setUi("phase", "submitting")
    try {
      const client = createSfProcurementClient(host.ready()!.transport)
      const options = { signal: controller.signal, idempotencyKey }
      const record = { page:"Suppliers" as const, id:intent.ref ?? undefined,version:intent.version }
      const response =
        intent.action === "create"
          ? await client["domain.command.CAP27.create"]({ ...record, action:"create", values: {supplier:intent.value} }, options)
        : intent.action === "save"
          ? await client["domain.command.CAP27.save"]({ ...record, action:"save", values: {supplier:intent.value} }, options)
        : intent.action === "change-bank"
          ? await client["domain.command.CAP27.change-bank"]({ ...record, action:"change-bank", values: {supplier:intent.value} }, options)
        : intent.action === "activate"
          ? await client["domain.command.CAP27.activate"]({ ...record, action:"activate", values:{} }, options)
        : intent.action === "block"
          ? await client["domain.command.CAP27.block"]({ ...record, action:"block", values:{} }, options)
        : intent.action === "inactivate"
          ? await client["domain.command.CAP27.inactivate"]({ ...record, action:"inactivate", values:{} }, options)
          : await client["domain.command.CAP27.delete"]({ ...record, action:"delete", values:{} }, options)
      if (controller.signal.aborted || token !== authority()) return
      if (response.kind === "transport-error") {
        controllerDraft?.setPhase("outcome-unknown")
        setUi("phase", "outcome-unknown")
        setUi("unknownOperation", opRef)
        setUi("review", null)
        return
      }
      if (response.status !== 200 || !response.body.ok) {
        const status = response.body.ok ? response.status : response.body.status
        controllerDraft?.setPhase(status === 409 ? "conflict" : "failed")
        setUi("review", null)
        setUi("phase", status === 409 ? "conflict" : "failed")
        setUi("error", status === 401 ? "session-expired" : status === 403 ? "denied" :
          status === 404 ? "not-found" : status === 409 ? "conflict" : "invalid")
        if (status === 401 || status === 403) setUi("page", null)
        return
      }
      // A successful producer acknowledgement can close only this exact
      // operation fence. Neither a hidden bank value nor a new supplier ID
      // is reconstructed from the submitted request.
      setUi("confirmedMessage", response.body.warnings?.join("; ") ?? null)
      setUi("review", null)
      setUi("phase", "verifying")
      if (editsDraft && intent.action !== "save") {
        controllerDraft?.confirmSave({kind:"confirmed-without-projection",
          operationRef:opRef,resultVersion:null})
        host.ready()?.drafts.discard({
          surfaceId:"CAP27",
          identity:intent.ref
            ? {kind:"record",recordRef:intent.ref as SfRef}
            : {kind:"new",newIntentRef:"CAP27:supplier-create" as SfIntentRef},
          editScopeKey:(intent.action==="change-bank"?"CAP27:bank":"CAP27:general") as SfEditScopeKey,
        })
      }
      if (intent.action === "create" || intent.action === "delete") {
        setUi("selected", null)
        setUi("mode", "detail")
      } else if (intent.action === "change-bank") {
        setUi("mode", "detail")
      }
      const confirmedPage=await refresh(token)
      if(controller.signal.aborted||authority()!==token)return
      if(intent.action==="save"&&controllerDraft) {
        const confirmed=confirmedPage&&intent.ref?uniqueSupplier(confirmedPage,intent.ref):null
        const confirmedVersion=confirmedPage&&intent.ref?supplierVersion(confirmedPage,intent.ref):null
        if(confirmed&&confirmedVersion!==null&&confirmedVersion!==intent.version)
          controllerDraft.confirmSave({kind:"projected",operationRef:opRef,
            baseVersion:confirmedVersion,value:supplierEdit(confirmed)})
        else controllerDraft.confirmSave({kind:"confirmed-without-projection",
          operationRef:opRef,resultVersion:confirmedVersion})
      }
      setUi("phase", "producer-confirmed")
    } catch {
      if (!controller.signal.aborted && token === authority()) {
        controllerDraft?.setPhase("outcome-unknown")
        setUi("phase", "outcome-unknown")
        setUi("unknownOperation", opRef)
        setUi("review", null)
      }
    } finally {
      sending = false
    }
  }
  const field = (name: typeof generalFields[number] | typeof bankFields[number]): JSX.Element => {
    const item = draftValue()[name]
    const isBoolean = booleanFields.includes(name)
    const isMultiline = multilineFields.includes(name)
    const isList = name === "categories" || name === "certifications"
    const shown = isList && Array.isArray(item) ? item.join("\n") : display(item)
    const locked = ui.phase === "checking" || ui.phase === "submitting" || ui.phase === "outcome-unknown"
    return <label class="sf-u14-field" for={"sf-u14-" + name}>
      <span>{language.t(fieldKey(name) as Parameters<typeof language.t>[0])}</span>
      <Show when={isBoolean} fallback={
        <Show when={isMultiline} fallback={<input
          id={"sf-u14-" + name} name={name} type={name === "contactEmail" || name === "financeEmail" ? "email" :
            name === "sanctionsDate" ? "date" : "text"}
          value={shown} disabled={locked}
          onInput={(event) => edit(name, event.currentTarget.value)}
        />}>
          <textarea id={"sf-u14-" + name} name={name} value={shown} disabled={locked}
            aria-describedby={isList ? "sf-u14-list-hint" : undefined}
            onInput={(event) => edit(name, isList
              ? event.currentTarget.value.split("\n").map((row) => row.trim()).filter(Boolean)
              : event.currentTarget.value)}
          />
        </Show>
      }>
        <input id={"sf-u14-" + name} name={name} type="checkbox" disabled={locked}
          checked={item === true || item === "true" || item === "on"}
          onChange={(event) => edit(name, event.currentTarget.checked)}
        />
      </Show>
    </label>
  }
  const editor = (): JSX.Element => {
    const controller = draft(), snapshot = controller?.snapshot()
    if (!controller || snapshot?.availability !== "active")
      return <SfStatePanel state="unavailable" messageKey={k("sf.u14.readOnly")} />
    const bank = ui.mode === "bank"
    return <section class="sf-u14-editor" aria-label={t(bank ? "sf.u14.bank" : "sf.u14.general")}>
      <h2>{t(ui.mode === "new" ? "sf.u14.create" : bank ? "sf.u14.bank" : "sf.u14.general")}</h2>
      <Show when={bank} fallback={
        <>
          <div class="sf-u14-fields">{generalFields.map((name) => field(name))}</div>
          <span id="sf-u14-list-hint" class="sf-u14-hint">{t("sf.u14.categoriesHint")}</span>
          <section aria-label={t("sf.u14.contacts")}>
            <h3>{t("sf.u14.contacts")}</h3>
            <For each={draftValue().contacts ?? []}>{(contact, index) => (
              <fieldset class="sf-u14-contact">
                <legend>{t("sf.u14.contacts")} {index() + 1}</legend>
                <For each={["name","email","phone"] as const}>{(name) =>
                  <label>{language.t(fieldKey("contact." + name) as Parameters<typeof language.t>[0])}
                    <input type={name === "email" ? "email" : "text"} value={contact[name] ?? ""}
                      onInput={(event) => updateContact(index(),name,event.currentTarget.value)}
                      disabled={active(ui.phase)} />
                  </label>
                }</For>
                <button class="mx-btn" type="button" disabled={active(ui.phase)} onClick={() => removeContact(index())}>{t("sf.u14.removeContact")}</button>
              </fieldset>
            )}</For>
            <button class="mx-btn" type="button" disabled={active(ui.phase)} onClick={addContact}>{t("sf.u14.addContact")}</button>
          </section>
          <div class="sf-u14-fields">
            <label>{t("sf.u14.field.commercial.notes")}
              <textarea value={draftValue().commercial?.notes ?? ""}
                disabled={active(ui.phase)} onInput={(event) => updateSection("commercial",event.currentTarget.value)} />
            </label>
            <label>{t("sf.u14.field.compliance.notes")}
              <textarea value={draftValue().compliance?.notes ?? ""}
                disabled={active(ui.phase)} onInput={(event) => updateSection("compliance",event.currentTarget.value)} />
            </label>
          </div>
        </>
      }>
        <p>{t("sf.u14.bankChangeCaution")}</p>
        <Show when={bankAuthorized()} fallback={<p role="alert">{t("sf.u14.bankKeyUnavailable")}</p>}>
          <div class="sf-u14-fields">{bankFields.map((name) => field(name))}</div>
        </Show>
      </Show>
      <div class="sf-u14-controls">
        <button class="mx-btn-primary" type="button"
          disabled={!snapshot.dirty || !!snapshot.conflict || active(ui.phase) ||
            (bank ? !bankAuthorized() : !can(ui.mode === "new" ? "create" : "save"))}
          onClick={() => begin(bank ? "change-bank" : ui.mode === "new" ? "create" : "save")}>
          {t(bank ? "sf.u14.changeBank" : ui.mode === "new" ? "sf.u14.create" : "sf.u14.save")}
        </button>
        <button class="mx-btn" type="button" onClick={() => { setUi("mode","detail"); setUi("error",null) }} disabled={active(ui.phase)}>{t("sf.u14.cancel")}</button>
      </div>
      <Show when={snapshot.conflict}><p role="alert">{t("sf.u14.stale")}</p></Show>
    </section>
  }
  const currentDetail = (): JSX.Element => {
    const selected = supplier(), current = page()
    if (!selected?.id || !current)
      return <SfStatePanel state="not-found" messageKey={k("sf.u14.notFound")} />
    const linked = linkedRequests(current,selected.id)
    const id = selected.id
    return <div class="sf-u14-detail">
      <SfRecordDetail
        title={data(selected.legalName ?? selected.number ?? id)}
        secondaryId={data(selected.number ?? id)}
        status={{ code:selected.status ?? "unknown", text:data(selected.status ?? t("sf.u14.missing")),
          tone:selected.status === "active" ? "success" : selected.status === "blocked" ? "danger" : "warning" }}
        metadata={[{id:"number",label:m("sf.u14.number"),value:value(selected.number)},
          {id:"status",label:m("sf.u14.status"),value:value(selected.status)}]}
        sections={[
          {id:"general",titleKey:k("sf.u14.general"),state:"ready",
           content:<dl class="sf-u14-record-fields">
             <For each={generalFields}>{(name) => <div><dt>{language.t(fieldKey(name) as Parameters<typeof language.t>[0])}</dt>
               <dd>{name === "categories" || name === "certifications"
                 ? Array.isArray(selected[name]) ? selected[name].join(", ") : display(selected[name])
                 : display(selected[name]) || t("sf.u14.missing")}</dd></div>}</For>
           </dl>},
          {id:"contacts",titleKey:k("sf.u14.contacts"),state:"ready",
            content:<ul><For each={selected.contacts ?? []}>{(contact) =>
              <li>{contact.name ?? t("sf.u14.missing")} · {contact.email ?? ""} · {contact.phone ?? ""}</li>
            }</For></ul>},
          {id:"commercial",titleKey:k("sf.u14.commercial"),state:"ready",content:<p>{selected.commercial?.notes ?? t("sf.u14.missing")}</p>},
          {id:"compliance",titleKey:k("sf.u14.compliance"),state:"ready",content:<p>{selected.compliance?.notes ?? t("sf.u14.missing")}</p>},
          {id:"bank",titleKey:k("sf.u14.bank"),state:bankAuthorized() ? "ready" : "denied",
            content:<div>
              <p>{t("sf.u14.bankMasked")}</p>
              <Show when={selected.status === "pending" && selected.validatedAt === null &&
                selected.validatedBy === null && (selected.history ?? []).some((entry) => bankSet.has(entry.field))}>
                <p role="status">{t("sf.u14.reactivation")}</p>
              </Show>
              <button class="mx-btn" type="button" disabled={!bankAuthorized() || active(ui.phase)}
                onClick={() => setUi("mode","bank")}>{t("sf.u14.changeBank")}</button>
            </div>},
          {id:"linked",titleKey:k("sf.u14.linked"),state:"ready",
            content:<Show when={linked.length} fallback={<p>{t("sf.u14.noLinked")}</p>}>
              <ul><For each={linked}>{(request) => <li>{request.number ?? t("sf.u14.missing")} · {request.pr?.title ?? ""}</li>}</For></ul>
            </Show>},
          {id:"audit",titleKey:k("sf.u14.audit"),state:"ready",
            content:<ul><For each={selected.history ?? []}>{(entry) =>
              <li>{t("sf.u14.auditField")}: {entry.field}</li>
            }</For></ul>},
        ]}
        primaryAction={can("save") ? {id:"save",labelKey:k("sf.u14.save"),tone:"primary",disabled:active(ui.phase),
          busy:false,onInvoke:()=>setUi("mode","edit")} : undefined}
        secondaryActions={[
          ...(["activate","block","inactivate"] as const).filter(can).map((action) =>
            ({id:action,labelKey:k(({activate:"sf.u14.activate",block:"sf.u14.block",inactivate:"sf.u14.inactivate"} as const)[action]),tone:"secondary" as const,
              disabled:active(ui.phase),busy:false,onInvoke:()=>begin(action)})),
          ...(can("delete") ? [{id:"delete",labelKey:k("sf.u14.delete"),tone:"danger" as const,
            disabled:active(ui.phase) || selected.status !== "pending" || linked.length !== 0,
            busy:false,onInvoke:()=>begin("delete")}] : []),
        ]}
        sourceActions={[]}
        onBack={()=>setUi("selected",null)}
        onOpenPage={()=>setUi("mode","detail")}
      />
      <p class="sf-u14-hint">{t("sf.u14.activationCaution")}</p>
      <Show when={linked.length && selected.status === "pending"}>
        <p role="status">{t("sf.u14.linkedNotice")}</p>
      </Show>
    </div>
  }

  return <SfPageFrame
    titleKey={k("sf.cap27.title")}
    context={[]} tabs={[]} activeTab={null} density="comfortable"
    layout={ui.layoutMode === "single" ? "reading" : "split"}
    onLayoutMode={(mode) => setUi("layoutMode",mode)}
    primaryAction={can("create") ? {id:"create",labelKey:k("sf.cap27.primary"),tone:"primary",
      disabled:active(ui.phase),busy:false,
      onInvoke:()=>{setUi("mode","new");setUi("selected",null)}} : undefined}
    secondaryActions={[{id:"csv",labelKey:k("sf.u14.csv"),tone:"secondary",
      disabled:!csvReady(),reasonKey:csvReady() ? undefined : k("sf.u14.csvUnavailable"),
      busy:ui.csvState==="downloading",onInvoke:()=>void beginCsv()}]}
  >
    <div class="sf-u14-layout">
      <Show when={state() === "ready" || state() === "empty" || state() === "filtered-empty" || state() === "outcome-unknown"}
        fallback={<SfStatePanel state={state()} messageKey={k(stateKey())} onRetryRead={() => {
          const token = authority()
          if (token) void refresh(token,ref() ?? undefined)
        }} />}>
        <Show when={ui.phase === "outcome-unknown"}>
          <p role="alert">{t("sf.u14.unknown")}</p>
          <p>{t("sf.u14.unknownReconcile")}</p>
          <button class="mx-btn" type="button" onClick={() => {
            const token = authority()
            if (token) void refresh(token,ref() ?? undefined)
          }}>{t("sf.u14.refresh")}</button>
        </Show>
        <Show when={ui.phase === "producer-confirmed"}><p role="status">
          {t("sf.u14.confirmed")} {ui.confirmedMessage ?? ""}
        </p></Show>
        <Show when={ui.error && ui.phase === "failed"}><p role="alert">{t("sf.u14.failure")}</p></Show>
        <Show when={ui.phase !== "outcome-unknown"}>
        <Show when={!ui.review} fallback={<SfChangeReview
          operation={{ref:(ui.review?.intentRef ?? "CAP27:unknown") as SfOperationRef,
            label:m("sf.u14.review"),scope:data(ui.review?.ref ?? t("sf.u14.create"))}}
          base={ui.review ? baseSnapshot(ui.review) : null}
          current={ui.review ? baseSnapshot(ui.review) : null}
          proposed={{kind:"draft",intentRef:(ui.review?.intentRef ?? "CAP27:unknown") as SfIntentRef,
            sourceRef:(ui.review?.ref ?? null) as SfRef | null,
            sourceVersion:ui.review?.ref ? ui.review.version : null,
            fields:ui.review ? fieldsFor(ui.review.value,ui.review.action === "change-bank") : []}}
          effects={ui.review ? [{
            id:ui.review.action,domain:"procurement",title:data(ui.review.action),
            state:"proposed",details:[],
          }] : []}
          coverage={{state:"complete",summary:m("sf.u14.coverage"),reasons:[],knownCount:1,expectedCount:1}}
          blockingReasons={[]}
          confirmation={confirmation()}
          state={ui.phase === "conflict" ? "conflict" : "ready"}
          onConfirm={(decision) => void confirm(decision as Extract<ReturnType<typeof confirmation>,{kind:"admitted"}>)}
          onRevise={()=>{setUi("review",null);setUi("phase","idle")}}
          onCancel={()=>{setUi("review",null);setUi("phase","idle")}}
        />}>
          <div class="sf-u14-list">
            <div class="sf-u14-filters">
              <label>{t("sf.u14.search")}
                <input type="search" value={ui.search} onInput={(event) => setUi("search",event.currentTarget.value)} />
              </label>
              <label>{t("sf.u14.statusFilter")}
                <select value={ui.filter} onChange={(event) => setUi("filter",event.currentTarget.value)}>
                  <For each={["All","pending","active","blocked","inactive"]}>{(option) =>
                    <option value={option}>{t(("sf.u14."+option) as SfU14CopyKey)}</option>
                  }</For>
                </select>
              </label>
            </div>
            <SfDataTable<Supplier>
              rows={rows()}
              getRowKey={(row) => (row.id ?? "") as SfRef}
              columns={[
                {id:"number",labelKey:k("sf.u14.number"),align:"start",
                  widthPolicy:{kind:"content",minPx:70,maxPx:160},sortKey:"number",
                  render:(row)=><>{row.number ?? ""}</>},
                {id:"legalName",labelKey:k("sf.u14.supplier"),align:"start",
                  widthPolicy:{kind:"flex",minPx:140,weight:2},sortKey:"legalName",
                  render:(row)=><>{row.legalName ?? ""}</>},
                {id:"status",labelKey:k("sf.u14.status"),align:"start",
                  widthPolicy:{kind:"content",minPx:90,maxPx:170},sortKey:"status",
                  render:(row)=><>{row.status ?? ""}</>},
              ]}
              selectedKey={supplier()?.id as SfRef | undefined}
              sort={ui.sort} page={{kind:"none",total:rows().length}}
              onSort={(sort) => setUi("sort",sort)}
              onPage={()=>{}}
              onSelect={(selection) => {setUi("selected",selection);setUi("mode","detail")}}
              rowActions={(row) => can("save") && row.id ? [{
                id:"edit",labelKey:k("sf.u14.save"),tone:"secondary",disabled:active(ui.phase),busy:false,
              }] : []}
              onRowAction={(entry) => {setUi("selected",entry.recordRef);setUi("mode","edit")}}
              captionKey={k("sf.cap27.title")} density="comfortable"
              state={rows().length===0 ? page()?.value.data.suppliers.length===0 ? "empty" : "filtered-empty" : "ready"}
            />
            <Show when={!csvAllowed()}><p class="sf-u14-hint">{t("sf.u14.csvUnavailable")}</p></Show>
            <Show when={ui.csvState === "downloading"}><p role="status">{t("sf.u14.loading")}</p></Show>
            <Show when={ui.csvState === "unavailable"}><p role="alert">{t("sf.u14.unavailable")}</p></Show>
            <Show when={ui.csvState === "stale"}><p role="alert">{t("sf.u14.stale")}</p></Show>
          </div>
          <Show when={ui.mode === "new" || (supplier() && (ui.mode === "edit" || ui.mode === "bank"))}
            fallback={<Show when={supplier()}>{currentDetail()}</Show>}>
            {editor()}
          </Show>
        </Show>
        </Show>
      </Show>
    </div>
  </SfPageFrame>
}
