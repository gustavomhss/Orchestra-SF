import { createEffect, For, onCleanup, Show, untrack } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { createSfOperationsClient } from "@orchestra/client/sucafina/operations"
import { useSfContext } from "../../context"
import type {
  SfSurfaceProps, SfEditScopeKey, SfOwnerKey, SfRef, SfPublicDraftController,
} from "../../context/contracts"
import type { SfIntentRef, SfOperationRef } from "@orchestra/schema/sucafina/context"
import { SfPageFrame } from "../../shared/frame"
import type { SfCopyKey, SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { SfChangeReview } from "../../shared/change-review"
import type { SfReviewField, SfReviewSnapshot } from "../../shared/change-review"
import {
  SECURITY_CAMPAIGN_FIELDS, SECURITY_CONSEQUENCES,
  SECURITY_DEPARTMENT_FIELDS, SECURITY_INCIDENT_FLAGS, SECURITY_KPI_FIELDS,
  SECURITY_MONTHS, SECURITY_OPERATION_IDS, SECURITY_YEARS,
  securityActions, securityCampaigns, securityIncidents, securityKpi,
  securityRow, securityString, securityVersion,
} from "./model"
import type { SfSecurityPage, SecurityCommand, SecurityEntity } from "./model"
import "./security.css"

type FormValues = Readonly<Record<string, string | boolean>>
type Draft = SfPublicDraftController<FormValues>
type Department = Readonly<{
  name: string
  users: string | number | null
  failed: string | number | null
  entered: string | number | null
  reported: string | number | null
}>
type SecurityEditor = Readonly<{
  entity: SecurityEntity
  command: SecurityCommand
  id: string | null
  version: number
  identity: Readonly<{ kind: "record"; recordRef: SfRef }> | Readonly<{ kind: "new"; newIntentRef: SfIntentRef }>
  scope: SfEditScopeKey
  operationRef: SfOperationRef
  review: boolean
}>
// Store state is Solid-mutated through the setter proxy; a Readonly<> type makes
// MutableKeyOf collapse to never and every setState("key", ...) stop type-checking.
type SecurityView = {
  state: SfUiState
  page: SfSecurityPage | undefined
  year: number | undefined
  month: number | undefined
  editor: SecurityEditor | null
  refresh: number
  submitting: boolean
  operationState: "idle" | "saved" | "failed" | "unknown" | "conflict"
  errorText: string | null
}
const key = (part: string) => ("sf.cap12." + part) as SfCopyKey
const common = (part: string) => ("sf.common." + part) as SfCopyKey
const msg = (copy: SfCopyKey) => ({ key: copy })
const ref = (value: string) => value as SfRef
const intent = (value: string) => value as SfIntentRef
const operation = (value: string) => value as SfOperationRef
const nonnegative = (value: string | boolean | undefined) =>
  value == null || value === "" || typeof value === "string" &&
  value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0
const validDate = (value: string | boolean | undefined) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const time = Date.parse(value)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
}
const stringOf = (value: string | boolean | undefined) => typeof value === "string" ? value : ""
const booleanOf = (value: string | boolean | undefined) => value === true
const rowId = (row: { id?: number | string | null } | undefined) => row?.id == null ? null : String(row.id)
const fields = ["title", "date", "impact", "notes"] as const
const SECURITY_TRENDS = [
  { section: "socTrend", fields: ["socTP", "socFP", "socEPS", "socIPs", "socClosure"] },
  { section: "socSeverity", fields: ["socCritical", "socHigh", "socMedium", "socLow", "socPending"] },
  { section: "patchTrend", fields: ["patch", "patchEndpoint", "patchServer"] },
] as const

function departmentsOf(value: string | boolean | undefined): Department[] {
  if (typeof value !== "string") return []
  try {
    const decoded: unknown = JSON.parse(value)
    if (!Array.isArray(decoded)) return []
    return decoded.filter((row): row is Record<string, unknown> =>
      row !== null && typeof row === "object" && !Array.isArray(row)).map((row) => ({
      name: typeof row.name === "string" ? row.name : "",
      users: typeof row.users === "number" || typeof row.users === "string" ? row.users : null,
      failed: typeof row.failed === "number" || typeof row.failed === "string" ? row.failed : null,
      entered: typeof row.entered === "number" || typeof row.entered === "string" ? row.entered : null,
      reported: typeof row.reported === "number" || typeof row.reported === "string" ? row.reported : null,
    }))
  } catch { return [] }
}

function incidentConsequencesOf(value: string | boolean | undefined): (typeof SECURITY_CONSEQUENCES)[number][] {
  if (typeof value !== "string") return []
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is (typeof SECURITY_CONSEQUENCES)[number] =>
      typeof item === "string" && SECURITY_CONSEQUENCES.some((allowed) => allowed === item))
  } catch { return [] }
}

function initialForm(page: SfSecurityPage, entity: SecurityEntity, id: string | null): FormValues {
  if (entity === "kpi") {
    const row = securityKpi(page)
    return {
      ...Object.fromEntries(SECURITY_KPI_FIELDS.map((name) => [name, securityString(row?.[name])])),
      notes: securityString(row?.notes),
    }
  }
  if (entity === "action") {
    const row = (page.data.secActions ?? []).find((entry) => String(entry.id) === id)
    return { text: securityString(row?.text), done: row?.done === true }
  }
  if (entity === "incident") {
    const row = (page.data.secIncidents ?? []).find((entry) => String(entry.id) === id)
    return {
      title: securityString(row?.title), date: securityString(row?.date),
      impact: securityString(row?.impact), notes: securityString(row?.notes),
      contained: row?.contained === true, remediated: row?.remediated === true,
      rootCause: row?.rootCause === true,
      consequences: JSON.stringify(row?.consequences ?? []),
    }
  }
  const row = (page.data.secPhishing ?? []).find((entry) => String(entry.id) === id)
  return {
    name: securityString(row?.name), start: securityString(row?.start),
    end: securityString(row?.end), notes: securityString(row?.notes),
    ...Object.fromEntries(SECURITY_CAMPAIGN_FIELDS.map((name) => [name, securityString(row?.[name])])),
    // JSON is an internal lossless draft carrier only. The user edits typed,
    // labeled department rows. No raw JSON editor or alternate producer exists.
    departments: JSON.stringify(row?.departments ?? []),
  }
}

function validForm(editor: SecurityEditor, values: FormValues, page: SfSecurityPage) {
  if (editor.command.startsWith("delete-"))
    return editor.id !== null && !!securityRow(page, editor.entity, editor.id)
  if (editor.entity === "kpi")
    return SECURITY_KPI_FIELDS.every((name) => nonnegative(values[name]))
  if (editor.entity === "action") return stringOf(values.text).trim().length > 0
  if (editor.entity === "incident")
    return stringOf(values.title).trim().length > 0 && validDate(values.date)
  if (!stringOf(values.name).trim()) return false
  if (stringOf(values.start) && !validDate(values.start)) return false
  if (stringOf(values.end) && !validDate(values.end)) return false
  if (!SECURITY_CAMPAIGN_FIELDS.every((name) => nonnegative(values[name]))) return false
  return departmentsOf(values.departments).every((row) =>
    !!row.name.trim() && [row.users, row.failed, row.entered, row.reported].every((value) =>
      value === null || value === "" || nonnegative(String(value))))
}

function securityReadState(page: SfSecurityPage): "ready" | "empty" | "filtered-empty" | "partial" | "unavailable" {
  const collections = [
    page.data.secKpi, page.data.secActions,
    page.data.secIncidents, page.data.secPhishing,
  ]
  if (collections.every((rows) => rows == null)) return "unavailable"
  if (collections.some((rows) => rows == null) || page.data.display == null) return "partial"
  const records = [
    ...(page.data.secKpi ?? []), ...(page.data.secActions ?? []),
    ...(page.data.secIncidents ?? []), ...(page.data.secPhishing ?? []),
  ]
  if (records.length === 0) return "empty"
  if ((page.data.secActions ?? []).length || (page.data.secPhishing ?? []).length ||
    (page.data.secKpi ?? []).some((row) => row.year === page.selection.year) ||
    (page.data.secIncidents ?? []).some((row) => row.date?.startsWith(String(page.selection.year)))) return "ready"
  return "filtered-empty"
}

function formFields(editor: SecurityEditor, value: FormValues): SfReviewField[] {
  if (editor.command.startsWith("delete-")) return []
  const sourceFields = editor.entity === "kpi" ? [...SECURITY_KPI_FIELDS, "notes"] :
    editor.entity === "action" ? ["text", "done"] :
    editor.entity === "incident" ? [...fields, ...SECURITY_INCIDENT_FLAGS, "consequences"] :
    ["name", "start", "end", "notes", ...SECURITY_CAMPAIGN_FIELDS, "departments"]
  return sourceFields.map((field) => ({
    path: field,
    label: msg(key("field." + field + ".label")),
    value: {
      kind: "text" as const,
      text: { kind: "data" as const,
        text: typeof value[field] === "boolean" ? String(value[field]) : stringOf(value[field]) },
    },
  }))
}

export function SfSecurityView(props: SfSurfaceProps<"CAP12">) {
  const language = useLanguage()
  const t = (copy: SfCopyKey) => language.t(copy as Parameters<typeof language.t>[0])
  const owner = useSfContext()
  const [state, setState] = createStore<SecurityView>({
    state: "loading", page: undefined,
    year: props.route.query.year, month: props.route.query.month,
    editor: null, refresh: 0, submitting: false, operationState: "idle", errorText: null,
  })
  let draft: Draft | undefined
  let draftOwner: SfOwnerKey | undefined
  let submitted: Readonly<{
    operationRef: SfOperationRef; command: SecurityCommand; entity: SecurityEntity;
    id: string | null; owner: SfOwnerKey; year: number; month: number
  }> | undefined
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
  const can = (command: SecurityCommand) =>
    state.page?.allowedActionIds.includes(command) === true &&
    ["ready", "empty", "filtered-empty"].includes(state.state) &&
    !["unknown", "conflict"].includes(state.operationState) &&
    owner.state().status === "ready" && !!owner.ready()
  const activeDraft = () => {
    state.editor
    const snapshot = draft?.snapshot()
    return snapshot?.availability === "active" ? snapshot : undefined
  }
  const values = () => activeDraft()?.value ?? {}
  const edit = (name: string, value: string | boolean) => {
    if (state.submitting || !activeDraft()) return
    draft?.edit({ ...values(), [name]: value })
  }
  const displayedYear = () => state.page?.selection.year ?? state.year
  const displayedMonth = () => state.page?.selection.month ?? state.month
  const refresh = () => setState("refresh", (value) => value + 1)

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
    if (snapshot.dirty && !window.confirm(t(common("navigationDiscard")))) return
    draft?.discard()
    owner.ready()?.drafts.discard({
      surfaceId: "CAP12", identity: editor.identity, editScopeKey: editor.scope,
    })
    draft = undefined
    draftOwner = undefined
    closeEditor()
    setState("operationState", "idle")
    setState("errorText", null)
  }

  const changeSelection = (field: "year" | "month", value: number) => {
    // Keep F01's same-owner draft registry, but never reuse a period editor.
    if (state.editor) {
      setState("editor", null)
      draft = undefined
      draftOwner = undefined
    }
    setState(field, value)
  }

  function openEditor(entity: SecurityEntity, id: string | null = null, destructive = false) {
    const page = state.page
    const active = owner.ready()
    const ownerKey = currentOwner()
    if (!page || !active || !ownerKey || state.submitting) return
    editorTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const command = (destructive ? "delete-" : "save-") + entity as SecurityCommand
    if (!can(command)) return
    if (destructive && !id) return
    if (id && !securityRow(page, entity, id)) {
      setState("state", "not-found")
      return
    }
    const version = securityVersion(page, entity, id ?? undefined)
    if (!id && entity !== "kpi" && version !== 0) return
    const scope = ("CAP12:" + command + ":" + page.selection.year + ":" +
      page.selection.month + ":" + (id ?? "new")) as SfEditScopeKey
    const identity: SecurityEditor["identity"] = id
      ? { kind: "record", recordRef: ref(id) }
      : { kind: "new", newIntentRef: intent("u29:" + scope) }
    const initial = initialForm(page, entity, id)
    const row = id ? securityRow(page, entity, id) : undefined
    try {
      draft = active.drafts.acquire({
        surfaceId: "CAP12", identity, editScopeKey: scope,
        baseVersion: id || entity === "kpi" ? version : null,
        base: id || entity === "kpi" ? initial : null, value: initial,
        revalidation: {
          operationId: "domain.page.CAP12",
          input: { ...(state.year === undefined ? {} : { secYear: state.year }),
            ...(state.month === undefined ? {} : { securityMonth: state.month }) },
          fieldPaths: row ? Object.keys(initial).filter((field) => Object.hasOwn(row, field)) : [],
          actionIds: [command],
        },
      })
      draftOwner = ownerKey
      setState("editor", {
        entity, command, id, version, identity, scope,
        operationRef: operation(crypto.randomUUID()), review: destructive,
      })
      if (destructive) draft.setPhase("reviewing")
      setState("operationState", "idle")
      setState("errorText", null)
    } catch (error) {
      console.error("Sucafina security draft unavailable", error instanceof Error ? error.name : "unknown")
      setState("state", "unavailable")
      setState("errorText", t(common("unavailable")))
    }
  }

  createEffect(() => {
    const active = owner.ready()
    const generation = owner.generation()
    const ownerState = owner.state()
    const year = state.year
    const month = state.month
    const refreshVersion = state.refresh
    const route = props.route
    void refreshVersion
    void route
    if (!active || ownerState.status !== "ready") {
      setState("page", undefined)
      setState("editor", null)
      setState("state", ownerState.status === "denied" ? "denied" :
        ownerState.status === "unauthenticated" ? "session-expired" :
        ownerState.status === "resolving" ? "loading" : "unavailable")
      setState("errorText", null)
      setState("operationState", "idle")
      draft = undefined
      draftOwner = undefined
      submitted = undefined
      return
    }
    const permitted = active.context.destinations.some((entry) =>
      entry.capabilityId === "CAP12" && entry.surface === "dashboard" &&
      entry.page === "IT Security KPIs" && entry.canRead)
    if (!permitted) {
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
      ...(year === undefined ? {} : { secYear: year }),
      ...(month === undefined ? {} : { securityMonth: month }),
    }
    void client["domain.page.CAP12"](input, { signal: request.signal }).then((response) => {
      const latest = owner.state()
      if (request.signal.aborted || owner.generation() !== generation ||
        latest.status !== "ready" || latest.ownerKey !== ownerState.ownerKey) return
      if (response.kind !== "response") {
        console.error("Sucafina CAP12 read failed", response.reason)
        setState("page", undefined)
        setState("state", "unavailable")
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
      if (draft && editing && !submitted && String(editing.scope).startsWith(
        "CAP12:" + editing.command + ":" + value.selection.year + ":" + value.selection.month + ":"
      )) {
        const currentVersion = securityVersion(value, editing.entity, editing.id ?? undefined)
        if (currentVersion !== editing.version) {
          draft.receiveRemote({
            baseVersion: currentVersion,
            value: initialForm(value, editing.entity, editing.id),
          })
          setState("operationState", "conflict")
        }
      }
      setState("page", value)
      setState("state", securityReadState(value))
      if (submitted && submitted.owner === latest.ownerKey &&
        submitted.year === value.selection.year && submitted.month === value.selection.month) {
        const wasDelete = submitted.command.startsWith("delete-")
        const remains = submitted.id !== null && securityRow(value, submitted.entity, submitted.id)
        if (!wasDelete || !remains) {
          if (draft && !wasDelete) {
            const existing = submitted.id !== null && securityRow(value, submitted.entity, submitted.id)
            // Creating a record without a returned source ref must never
            // promote an empty form or a guessed name match into proof.
            draft.confirmSave(existing
              ? { kind: "projected", operationRef: submitted.operationRef,
                  baseVersion: securityVersion(value, submitted.entity, submitted.id ?? undefined),
                  value: initialForm(value, submitted.entity, submitted.id) }
              : { kind: "confirmed-without-projection", operationRef: submitted.operationRef,
                  resultVersion: null })
          }
          if (draft && wasDelete) draft.discard()
          draft = undefined
          draftOwner = undefined
          submitted = undefined
          setState("editor", null)
          setState("operationState", "saved")
        } else {
          // Never present a deletion as confirmed if current authorized source
          // still shows the record; a later explicit read may resolve it.
          setState("operationState", "conflict")
        }
      }
      if (state.editor === null && routeEntryConsumed !== String(props.route.href)) {
        routeEntryConsumed = String(props.route.href)
        if (props.route.kind === "edit-kpi" && value.allowedActionIds.includes("save-kpi"))
          untrack(() => openEditor("kpi", rowId(securityKpi(value))))
        if (props.route.kind === "campaign" || props.route.kind === "incident" ||
          props.route.kind === "action") {
          const entity = props.route.kind
          const id = String(props.route.params.recordRef)
          if (!securityRow(value, entity, id)) {
            setState("state", "not-found")
          } else if (value.allowedActionIds.includes("save-" + entity)) {
            untrack(() => openEditor(entity, id))
          }
        }
      }
    }).catch((error) => {
      if (request.signal.aborted) return
      console.error("Sucafina CAP12 read failed", error instanceof Error ? error.name : "unknown")
      setState("page", undefined)
      setState("state", "unavailable")
    }).finally(() => pendingRequests.delete(request))
    onCleanup(() => { request.abort(); pendingRequests.delete(request) })
  })

  function review() {
    const editor = state.editor
    const page = state.page
    if (!editor || !page || !activeDraft() || state.submitting) return
    if (!validForm(editor, values(), page)) {
      draft?.setPhase("validation-error")
      setState("errorText", t(common("fieldErrorSummary")))
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
    const snapshot = activeDraft()
    if (!editor || !page || !active || !ownerKey || !snapshot ||
      !editor.review || !can(editor.command) || state.submitting ||
      snapshot.pendingOperation !== null || !validForm(editor, snapshot.value, page)) return
    if (securityVersion(page, editor.entity, editor.id ?? undefined) !== editor.version) {
      draft?.setPhase("conflict")
      setState("operationState", "conflict")
      return
    }
    const client = createSfOperationsClient(active.transport)
    const request = new AbortController()
    pendingRequests.add(request)
    const generation = owner.generation()
    const values = snapshot.value
    const options = { signal: request.signal, idempotencyKey: crypto.randomUUID() }
    const base = { version: editor.version, ...(editor.id === null ? {} : { id: editor.id }) }
    setState("submitting", true)
    try {
      const intentBytes = new TextEncoder().encode(JSON.stringify([
        SECURITY_OPERATION_IDS[editor.command], editor.id, editor.version, snapshot.value,
      ]))
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", intentBytes))
      if (request.signal.aborted || owner.generation() !== generation || currentOwner() !== ownerKey) return
      const payloadDigest = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")
      draft?.setPending({
        operationRef: editor.operationRef, idempotencyKey: options.idempotencyKey,
        payloadDigest, expectedVersion: editor.id || editor.entity === "kpi" ? editor.version : null,
      })
      draft?.setPhase("submitting")
      let result: Awaited<ReturnType<typeof client["domain.command.CAP12.save-kpi"]>>
      switch (editor.command) {
        case "save-kpi":
          result = await client["domain.command.CAP12.save-kpi"]({
            ...base, values: {
              year: page.selection.year, month: page.selection.month,
              ...Object.fromEntries(SECURITY_KPI_FIELDS.map((name) => [name, stringOf(values[name])])),
              notes: stringOf(values.notes),
            },
          }, options)
          break
        case "delete-kpi":
          result = await client["domain.command.CAP12.delete-kpi"]({
            ...base, values: { year: page.selection.year, month: page.selection.month },
          }, options)
          break
        case "save-action":
          result = await client["domain.command.CAP12.save-action"]({
            ...base, values: { text: stringOf(values.text), done: booleanOf(values.done) },
          }, options)
          break
        case "delete-action":
          if (editor.id === null) return
          result = await client["domain.command.CAP12.delete-action"]({
            id: editor.id, version: editor.version, values: {},
          }, options)
          break
        case "save-incident":
          result = await client["domain.command.CAP12.save-incident"]({
            ...base, values: {
              title: stringOf(values.title), date: stringOf(values.date),
              impact: stringOf(values.impact), notes: stringOf(values.notes),
              contained: booleanOf(values.contained), remediated: booleanOf(values.remediated),
              rootCause: booleanOf(values.rootCause),
              consequences: incidentConsequencesOf(values.consequences),
            },
          }, options)
          break
        case "delete-incident":
          if (editor.id === null) return
          result = await client["domain.command.CAP12.delete-incident"]({
            id: editor.id, version: editor.version, values: {},
          }, options)
          break
        case "save-campaign": {
          const sourceDepartments = departmentsOf(values.departments)
            .filter((row) => Object.values(row).some((value) => value !== "" && value !== null))
            .map((row) => ({
              name: row.name,
              users: row.users ?? "", failed: row.failed ?? "",
              entered: row.entered ?? "", reported: row.reported ?? "",
            }))
          result = await client["domain.command.CAP12.save-campaign"]({
            ...base, values: {
              name: stringOf(values.name), start: stringOf(values.start), end: stringOf(values.end),
              notes: stringOf(values.notes),
              ...Object.fromEntries(SECURITY_CAMPAIGN_FIELDS.map((name) => [name, stringOf(values[name])])),
              departments: sourceDepartments,
            },
          }, options)
          break
        }
        case "delete-campaign":
          if (editor.id === null) return
          result = await client["domain.command.CAP12.delete-campaign"]({
            id: editor.id, version: editor.version, values: {},
          }, options)
          break
      }
      const latest = owner.state()
      if (request.signal.aborted || owner.generation() !== generation ||
        latest.status !== "ready" || latest.ownerKey !== ownerKey) return
      if (result.kind !== "response") {
        console.error("Sucafina CAP12 command outcome", result.reason)
        draft?.setPhase(result.reason === "network" || result.reason === "aborted" ||
          result.reason === "outcome-unknown" ? "outcome-unknown" : "failed")
        setState("operationState", result.reason === "network" || result.reason === "aborted" ||
          result.reason === "outcome-unknown" ? "unknown" : "failed")
        return
      }
      if (!result.body.ok) {
        if (result.status === 409 || result.body.status === 409) {
          draft?.setPhase("conflict")
          setState("operationState", "conflict")
        } else {
          draft?.setPhase("validation-error")
        }
        setState("operationState", "failed")
        setState("errorText", result.body.errors?.join("; ") ?? t(common("fieldErrorSummary")))
        console.error("Sucafina CAP12 command rejected", result.status)
        return
      }
      submitted = {
        operationRef: editor.operationRef, command: editor.command,
        entity: editor.entity, id: editor.id, owner: ownerKey,
        year: page.selection.year, month: page.selection.month,
      }
      refresh()
    } catch (error) {
      console.error("Sucafina CAP12 command could not be reconciled", error instanceof Error ? error.name : "unknown")
      draft?.setPhase("outcome-unknown")
      setState("operationState", "unknown")
    } finally {
      pendingRequests.delete(request)
      setState("submitting", false)
    }
  }

  const textInput = (name: string, inputType: "text" | "date" | "number" | "textarea" = "text") => (
    <label class="sf-security-field">
      <span>{t(key("field." + name + ".label"))}</span>
      <Show when={inputType !== "textarea"} fallback={
        <textarea value={stringOf(values()[name])}
          onInput={(event) => edit(name, event.currentTarget.value)} />
      }>
        <input type={inputType} min={inputType === "number" ? 0 : undefined}
          step={inputType === "number" ? "any" : undefined}
          value={stringOf(values()[name])}
          onInput={(event) => edit(name, event.currentTarget.value)} />
      </Show>
    </label>
  )
  const boolInput = (name: string) => (
    <label class="sf-security-check">
      <input type="checkbox" checked={booleanOf(values()[name])}
        onChange={(event) => edit(name, event.currentTarget.checked)} />
      <span>{t(key("field." + name + ".label"))}</span>
    </label>
  )
  const departmentRows = () => departmentsOf(values().departments)
  const setDepartment = (index: number, field: (typeof SECURITY_DEPARTMENT_FIELDS)[number], value: string) => {
    const source = departmentRows().map((row) => ({ ...row }))
    if (!source[index]) return
    source[index] = { ...source[index], [field]: value }
    edit("departments", JSON.stringify(source))
  }
  const addDepartment = () => edit("departments", JSON.stringify([...departmentRows(), {
    name: "", users: "", failed: "", entered: "", reported: "",
  }]))
  const removeDepartment = (index: number) =>
    edit("departments", JSON.stringify(departmentRows().filter((_row, i) => i !== index)))
  const reviewSnapshot = (value: FormValues, original: boolean, version = state.editor!.version): SfReviewSnapshot => {
    const editor = state.editor!
    if (original && editor.identity.kind === "new")
      return { kind: "not-provided", reason: msg(common("empty")) }
    return original
      ? { kind: "persisted",
        ref: editor.identity.kind === "record" ? editor.identity.recordRef : ref(""),
        version, fields: formFields(editor, value) }
      : { kind: "draft",
        intentRef: editor.identity.kind === "new" ? editor.identity.newIntentRef : intent("u29:" + editor.scope),
        sourceRef: editor.identity.kind === "record" ? editor.identity.recordRef : null,
        sourceVersion: editor.version, fields: formFields(editor, value) }
  }
  const reviewerState = () =>
    state.operationState === "unknown" ? "outcome-unknown" :
    state.operationState === "conflict" ? "conflict" : state.state
  const editTitle = () => {
    const editor = state.editor
    if (!editor) return key("title")
    if (editor.command.startsWith("delete-")) return key("action." + editor.command)
    if (editor.entity === "kpi") return key("section.editKpi")
    return key("action." + editor.command)
  }

  return (
    <SfPageFrame
      titleKey={key("title")}
      context={state.page ? [
        { id: "year", label: msg(key("field.year.label")), value: { kind: "data", text: String(state.page.selection.year) } },
        { id: "month", label: msg(key("field.month.label")), value: { kind: "data", text: String(state.page.selection.month) } },
      ] : []}
      tabs={[]}
      activeTab={null}
      primaryAction={{
        id: "security-reference", labelKey: key("primary"),
        tone: "primary", busy: state.submitting,
        disabled: !can("save-kpi") || state.submitting,
        onInvoke: () => openEditor("kpi", rowId(state.page ? securityKpi(state.page) : undefined)),
      }}
      secondaryActions={[]}
      density="comfortable"
      layout="work"
      onLayoutMode={() => undefined}
    >
      <div class="sf-security" data-sf-surface="CAP12" data-sf-read-state={state.state}>
        <Show when={state.page && ["ready", "empty", "filtered-empty", "partial"].includes(state.state)} fallback={
          <SfStatePanel
            state={state.state}
            messageKey={state.state === "loading" ? common("loading") :
              state.state === "denied" ? common("noAccess") :
              state.state === "invalid" ? common("needsInput") :
              state.state === "session-expired" ? common("loginAgain") :
              state.state === "not-found" ? common("removed") :
              state.state === "stale" || state.state === "conflict" ? common("stale") :
              common("unavailable")}
            onRetryRead={refresh}
          />
        }>
          <Show when={state.state === "partial"}>
            <p role="status">{t(common("partial"))}</p>
            <button type="button" onClick={refresh}>{t(common("retry"))}</button>
          </Show>
          <Show when={state.state === "empty" || state.state === "filtered-empty"}>
            <p role="status">{t(state.state === "empty" ? common("empty") : common("filterEmpty"))}</p>
          </Show>
          <section class="sf-security-reference" aria-label={t(key("section.reference"))}>
            <label>{t(key("field.year.label"))}
              <select value={displayedYear()} onChange={(event) => changeSelection("year", Number(event.currentTarget.value))}>
                <For each={SECURITY_YEARS}>{(year) => <option value={year}>{year}</option>}</For>
              </select>
            </label>
            <label>{t(key("field.month.label"))}
              <select value={displayedMonth()} onChange={(event) => changeSelection("month", Number(event.currentTarget.value))}>
                <For each={SECURITY_MONTHS}>{(month) => <option value={month}>{month}</option>}</For>
              </select>
            </label>
            <Show when={!state.page!.allowedActionIds.length}>
              <span>{t(common("readOnly"))}</span>
            </Show>
          </section>

          <section aria-labelledby="sf-cap12-kpis">
            <h2 id="sf-cap12-kpis">{t(key("section.kpi"))}</h2>
            <div class="sf-security-metrics">
              <For each={state.page!.data.display?.kpis ?? []}>{(metric) => (
                <div class="sf-security-metric" data-kpi={metric.key}>
                  <span>{metric.key}</span>
                  <strong>{metric.value === null || metric.value === "" ? t(key("table.noData")) : String(metric.value)}</strong>
                  <span>{metric.status}</span>
                </div>
              )}</For>
            </div>
            <For each={SECURITY_TRENDS}>{(trend) => (
              <section aria-label={t(key("section." + trend.section))}>
                <h3>{t(key("section." + trend.section))}</h3>
                <div class="sf-security-table" role="region" tabindex="0"
                  aria-label={t(key("section." + trend.section))}>
                  <table>
                    <thead><tr>
                      <th scope="col">{t(key("table.month"))}</th>
                      <For each={trend.fields}>{(name) =>
                        <th scope="col">{t(key("field." + name + ".label"))}</th>}
                      </For>
                    </tr></thead>
                    <tbody><For each={SECURITY_MONTHS}>{(month) => {
                      const source = (state.page!.data.secKpi ?? []).find((row) =>
                        row.year === state.page!.selection.year && row.month === month)
                      return <tr>
                        <th scope="row">{month}</th>
                        <For each={trend.fields}>{(name) => (
                          <td>{source?.[name] == null ? t(key("table.noData")) : String(source[name])}</td>
                        )}</For>
                      </tr>
                    }}</For></tbody>
                  </table>
                </div>
              </section>
            )}</For>
            <div class="sf-security-table" role="region" aria-label={t(key("section.kpi"))} tabindex="0">
              <table>
                <thead><tr><th>{t(key("table.month"))}</th>
                  <For each={SECURITY_KPI_FIELDS}>{(name) => <th scope="col">{t(key("field." + name + ".label"))}</th>}</For>
                </tr></thead>
                <tbody>
                  <For each={(state.page!.data.secKpi ?? []).filter(
                    (row) => row.year === state.page!.selection.year,
                  ).slice().sort((a, b) => Number(a.month) - Number(b.month))}>
                    {(row) => <tr><th scope="row">{securityString(row.month)}</th>
                      <For each={SECURITY_KPI_FIELDS}>{(name) =>
                        <td>{row[name] == null || row[name] === "" ? t(key("table.noData")) : String(row[name])}</td>
                      }</For>
                    </tr>}
                  </For>
                </tbody>
              </table>
            </div>
            <Show when={(state.page!.data.secKpi ?? []).length === 0}>
              <p>{t(common("empty"))}</p>
            </Show>
            <div class="sf-security-actions">
              <button type="button" disabled={!can("save-kpi")}
                onClick={() => openEditor("kpi", rowId(securityKpi(state.page!)))}>
                {t(key("action.save-kpi"))}
              </button>
              <Show when={securityKpi(state.page!)}>
                <button type="button" disabled={!can("delete-kpi")}
                  onClick={() => openEditor("kpi", rowId(securityKpi(state.page!)), true)}>
                  {t(key("action.delete-kpi"))}
                </button>
              </Show>
            </div>
          </section>

          <section aria-labelledby="sf-cap12-campaigns">
            <h2 id="sf-cap12-campaigns">{t(key("section.campaigns"))}</h2>
            <For each={securityCampaigns(state.page!)}>{(campaign) => (
              <article class="sf-security-record">
                <h3>{securityString(campaign.name)}</h3>
                <Show when={state.page!.data.display?.campaigns.find(
                  (display) => display.id === String(campaign.id),
                )}>
                  {(detail) => <dl class="sf-security-rates">
                    <dt>{t(key("table.failure"))}</dt>
                    <dd>{detail().failureRate === null ? t(key("table.noData")) : String(detail().failureRate) + "%"}</dd>
                    <dt>{t(key("table.entered"))}</dt>
                    <dd>{detail().enteredRate === null ? t(key("table.noData")) : String(detail().enteredRate) + "%"}</dd>
                    <dt>{t(key("table.reported"))}</dt>
                    <dd>{detail().reportedRate === null ? t(key("table.noData")) : String(detail().reportedRate) + "%"}</dd>
                  </dl>}
                </Show>
                <div class="sf-security-table" role="region" tabindex="0" aria-label={t(key("field.departments.label"))}>
                  <table>
                    <thead><tr>
                      <For each={SECURITY_DEPARTMENT_FIELDS}>{(name) => <th scope="col">{t(key("field.departments." + name + ".label"))}</th>}</For>
                    </tr></thead>
                    <tbody><For each={campaign.departments ?? []}>{(department) => (
                      <tr><th scope="row">{securityString(department.name)}</th>
                        <td>{securityString(department.users)}</td>
                        <td>{securityString(department.failed)}</td>
                        <td>{securityString(department.entered)}</td>
                        <td>{securityString(department.reported)}</td></tr>
                    )}</For></tbody>
                  </table>
                </div>
                <div class="sf-security-actions">
                  <button type="button" disabled={!can("save-campaign")}
                    onClick={() => openEditor("campaign", rowId(campaign))}>
                    {t(common("edit"))}
                  </button>
                  <button type="button" disabled={!can("delete-campaign")}
                    onClick={() => openEditor("campaign", rowId(campaign), true)}>
                    {t(key("action.delete-campaign"))}
                  </button>
                </div>
              </article>
            )}</For>
            <Show when={securityCampaigns(state.page!).length === 0}><p>{t(common("empty"))}</p></Show>
            <button type="button" disabled={!can("save-campaign")} onClick={() => openEditor("campaign")}>
              {t(key("action.add-campaign"))}
            </button>
          </section>

          <section aria-labelledby="sf-cap12-incidents">
            <h2 id="sf-cap12-incidents">{t(key("section.incidents"))}</h2>
            <Show when={state.page!.data.display?.openIncidents != null}>
              <p>{t(key("table.openIncidents"))}: {state.page!.data.display!.openIncidents}</p>
            </Show>
            <div class="sf-security-table" role="region" aria-label={t(key("section.incidents"))} tabindex="0">
              <table><thead><tr>
                <th>{t(key("field.title.label"))}</th>
                <th>{t(key("field.date.label"))}</th>
                <th>{t(key("table.status"))}</th>
                <th>{t(key("table.impact"))}</th>
                <th>{t(common("edit"))}</th>
              </tr></thead><tbody>
                <For each={securityIncidents(state.page!)}>{(incident) => (
                  <tr><th scope="row">{securityString(incident.title)}</th>
                    <td><time dateTime={securityString(incident.date)}>{securityString(incident.date)}</time></td>
                    <td>{incident.contained && incident.remediated && incident.rootCause ?
                      t(key("table.done")) : t(key("table.open"))}</td>
                    <td>{securityString(incident.impact)}</td>
                    <td><div class="sf-security-actions">
                      <button type="button" disabled={!can("save-incident")}
                        onClick={() => openEditor("incident", rowId(incident))}>{t(common("edit"))}</button>
                      <button type="button" disabled={!can("delete-incident")}
                        onClick={() => openEditor("incident", rowId(incident), true)}>
                        {t(key("action.delete-incident"))}</button>
                    </div></td>
                  </tr>
                )}</For>
              </tbody></table>
            </div>
            <Show when={securityIncidents(state.page!).length === 0}><p>{t(common("empty"))}</p></Show>
            <button type="button" disabled={!can("save-incident")} onClick={() => openEditor("incident")}>
              {t(key("action.add-incident"))}
            </button>
          </section>

          <section aria-labelledby="sf-cap12-actions">
            <h2 id="sf-cap12-actions">{t(key("section.actions"))}</h2>
            <div class="sf-security-table" role="region" aria-label={t(key("section.actions"))} tabindex="0">
              <table><thead><tr>
                <th>{t(key("table.action"))}</th>
                <th>{t(key("table.status"))}</th>
                <th>{t(common("edit"))}</th>
              </tr></thead><tbody>
                <For each={securityActions(state.page!)}>{(action) => (
                  <tr><th scope="row">{securityString(action.text)}</th>
                    <td>{action.done === true ? t(key("table.done")) : t(key("table.open"))}</td>
                    <td><div class="sf-security-actions">
                      <button type="button" disabled={!can("save-action")}
                        onClick={() => openEditor("action", rowId(action))}>{t(common("edit"))}</button>
                      <button type="button" disabled={!can("delete-action")}
                        onClick={() => openEditor("action", rowId(action), true)}>
                        {t(key("action.delete-action"))}</button>
                    </div></td>
                  </tr>
                )}</For>
              </tbody></table>
            </div>
            <Show when={securityActions(state.page!).length === 0}><p>{t(common("empty"))}</p></Show>
            <button type="button" disabled={!can("save-action")} onClick={() => openEditor("action")}>
              {t(key("action.add-action"))}
            </button>
          </section>

          <Show when={state.operationState === "conflict"}>
            <p role="alert">{t(common("conflict"))}</p>
            <button type="button" onClick={refresh}>{t(common("retry"))}</button>
            <Show when={state.editor && activeDraft()}>
              <button type="button" onClick={discardCurrent}>{t(common("discard"))}</button>
            </Show>
          </Show>
          <Show when={state.operationState === "saved"}><p role="status">{t(common("saved"))}</p></Show>
          <Show when={state.operationState === "unknown"}><p role="alert">{t(common("operationUnknown"))}</p></Show>
          <Show when={state.operationState === "failed" || state.errorText}>
            <p role="alert">{state.errorText ?? t(common("failed"))}</p>
          </Show>

          <Show when={state.editor && activeDraft()}>
            <section class="sf-security-editor" aria-labelledby="sf-cap12-editor" aria-busy={state.submitting}
              onKeyDown={(event) => {
                if (event.key === "Escape" && !state.editor?.review && !state.submitting) {
                  event.stopPropagation()
                  closeEditor()
                }
              }}>
              <h2 id="sf-cap12-editor">{t(editTitle())}</h2>
              <Show when={!state.editor!.review} fallback={
                <SfChangeReview
                  operation={{
                    ref: state.editor!.operationRef,
                    label: msg(key("action." + state.editor!.command)),
                    scope: { kind: "data", text:
                      state.editor!.id ?? String(state.page!.selection.year) + "-" + String(state.page!.selection.month) },
                  }}
                  base={reviewSnapshot(activeDraft()!.base ?? {}, true)}
                  current={reviewSnapshot(
                     activeDraft()!.conflict?.current ?? activeDraft()!.base ?? {}, true,
                     activeDraft()!.conflict?.currentVersion ?? state.editor!.version,
                   )}
                  proposed={reviewSnapshot(values(), false)}
                  effects={[{
                    id: state.editor!.command, domain: "dashboard",
                    title: { kind: "message", message: msg(key("action." + state.editor!.command)) },
                    state: "proposed", details: formFields(state.editor!, values()),
                    ...(state.editor!.command.startsWith("delete-") ?
                      { reason: msg(common("deleteConfirmation")) } : {}),
                  }]}
                  coverage={{
                    state: "complete", summary: msg(common("currentSource")),
                    reasons: [], knownCount: null, expectedCount: null,
                  }}
                  blockingReasons={!validForm(state.editor!, values(), state.page!) ?
                    [msg(common("fieldErrorSummary"))] : []}
                  confirmation={{
                    kind: "admitted",
                    labelKey: key("action." + state.editor!.command),
                    purpose: state.editor!.command.startsWith("delete-") ? "delete" : "save",
                    binding: {
                      kind: "catalog-command",
                      operationId: SECURITY_OPERATION_IDS[state.editor!.command],
                      version: { kind: "record", expectedVersion: state.editor!.version },
                      confirmation: "presentation-only",
                    },
                  }}
                  state={reviewerState()}
                  onConfirm={() => { void submitReviewed() }}
                  onRevise={() => {
                    if (state.editor!.command.startsWith("delete-") && state.operationState !== "conflict")
                      setState("editor", null)
                    else { setState("editor", "review", false); draft?.setPhase("dirty") }
                  }}
                  onCancel={() => {
                    if (state.operationState === "conflict") setState("editor", "review", false)
                    else setState("editor", null)
                  }}
                  onReconcile={refresh}
                />
              }>
                <form onSubmit={(event) => { event.preventDefault(); review() }}>
                  <Show when={state.editor!.entity === "kpi"}>
                    <div class="sf-security-grid">
                      <For each={SECURITY_KPI_FIELDS}>{(name) => textInput(name, "number")}</For>
                      {textInput("notes", "textarea")}
                    </div>
                  </Show>
                  <Show when={state.editor!.entity === "action"}>
                    {textInput("text", "textarea")}
                    {boolInput("done")}
                  </Show>
                  <Show when={state.editor!.entity === "incident"}>
                    <div class="sf-security-grid">
                      {textInput("title")}
                      {textInput("date", "date")}
                      {textInput("impact", "textarea")}
                      {textInput("notes", "textarea")}
                    </div>
                    <div class="sf-security-checks">
                      <For each={SECURITY_INCIDENT_FLAGS}>{(name) => boolInput(name)}</For>
                    </div>
                    <fieldset>
                      <legend>{t(key("field.consequences.label"))}</legend>
                      <For each={SECURITY_CONSEQUENCES}>{(choice) => (
                        <label class="sf-security-check">
                          <input type="checkbox"
                            checked={incidentConsequencesOf(values().consequences).includes(choice)}
                            onChange={(event) => {
                              const previous = incidentConsequencesOf(values().consequences)
                              edit("consequences", JSON.stringify(event.currentTarget.checked
                                ? [...previous, choice] : previous.filter((value) => value !== choice)))
                            }} />
                          <span>{choice}</span>
                        </label>
                      )}</For>
                    </fieldset>
                  </Show>
                  <Show when={state.editor!.entity === "campaign"}>
                    <div class="sf-security-grid">
                      {textInput("name")}
                      {textInput("start", "date")}
                      {textInput("end", "date")}
                      {textInput("notes", "textarea")}
                      <For each={SECURITY_CAMPAIGN_FIELDS}>{(name) => textInput(name, "number")}</For>
                    </div>
                    <fieldset>
                      <legend>{t(key("field.departments.label"))}</legend>
                      <div class="sf-security-table" role="region" tabindex="0"
                        aria-label={t(key("field.departments.label"))}>
                        <table><thead><tr>
                          <For each={SECURITY_DEPARTMENT_FIELDS}>{(name) => (
                            <th>{t(key("field.departments." + name + ".label"))}</th>
                          )}</For>
                          <th>{t(common("close"))}</th>
                        </tr></thead><tbody>
                          <For each={departmentRows()}>{(department, index) => (
                            <tr>
                              <For each={SECURITY_DEPARTMENT_FIELDS}>{(name) => (
                                <td><label>
                                  <span class="sr-only">{t(key("field.departments." + name + ".label"))}</span>
                                  <input type={name === "name" ? "text" : "number"}
                                    min={name === "name" ? undefined : 0}
                                    step={name === "name" ? undefined : "any"}
                                    value={securityString(department[name])}
                                    onInput={(event) => setDepartment(index(), name, event.currentTarget.value)} />
                                </label></td>
                              )}</For>
                              <td><button type="button" onClick={() => removeDepartment(index())}>
                                {t(common("close"))}</button></td>
                            </tr>
                          )}</For>
                        </tbody></table>
                      </div>
                      <button type="button" onClick={addDepartment}>{t(key("action.add-campaign"))} — {t(key("field.departments.label"))}</button>
                    </fieldset>
                  </Show>
                  <div class="sf-security-actions">
                    <button type="submit" disabled={state.submitting || !validForm(state.editor!, values(), state.page!)}>
                      {t(common("review"))}
                    </button>
                    <button type="button" onClick={closeEditor}>
                      {t(common("close"))}
                    </button>
                    <button type="button" disabled={state.submitting || state.operationState === "unknown"}
                      onClick={discardCurrent}>{t(common("discard"))}</button>
                  </div>
                </form>
              </Show>
            </section>
          </Show>
        </Show>
      </div>
    </SfPageFrame>
  )
}
