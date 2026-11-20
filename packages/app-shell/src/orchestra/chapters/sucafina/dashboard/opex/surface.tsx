import { sfAppendOwnerQuery } from "../../navigation-state/owner"
import { useNavigate } from "@solidjs/router"
import { createEffect, createMemo, createSignal, createUniqueId, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import type { SfCallOptions } from "@orchestra/client/sucafina/transport"
import type {
  SfEditScopeKey, SfIntentRef, SfOperationRef, SfRef, SfResolvedRoute, SfOperationId,
} from "@orchestra/schema/sucafina/context"
import { useSfContext } from "../../context"
import type { SfPublicDraftController } from "../../context/contracts"
import {
  SfContextBar, SfPageFrame, type SfAction, type SfCopyKey, type SfDisplayValue,
  type SfMessage, type SfUiState,
} from "../../shared/frame"
import { SfDisplayValueText, sfCommonKey, useSfPresentation } from "../../shared/frame/presentation"
import { SfStatePanel } from "../../shared/states"
import { SfDataTable, type SfColumn, type SfSort } from "../../shared/table"
import { SfRecordDetail } from "../../shared/detail"
import {
  SfChangeReview, type SfReviewField, type SfReviewSnapshot,
  type SfReviewConfirmation,
} from "../../shared/change-review"
import { SfReceiptView } from "../../shared/receipt"
import { encodeSfRouteRef } from "../../navigation-state"
import {
  readBudgetPage, writeBudgetPage, budgetDeviationSourceMatches,
  type BudgetCapability, type BudgetCommand, type BudgetCommandName,
  type BudgetEntry, type BudgetForm, type BudgetOwner, type BudgetPage,
} from "./model"
import "./surface.css"

/** U39 + U40 share presentation, never producer logic or a new dispatcher. */
export type SfBudgetRoute = SfResolvedRoute<"CAP04" | "CAP05">
export type SfBudgetSurfaceProps = Readonly<{ capability: BudgetCapability; route: SfBudgetRoute }>

const months = Array.from({ length: 12 }, (_, index) => index + 1)
// Keep list presentation state in memory only, scoped to the F01 owner's
// draft-registry object AND the capability. Never serialize name searches in
// URLs, a shared singleton, another installation or the original producer.
const budgetViewByOwner = new WeakMap<object, Map<BudgetCapability, {
  filter: string; sort: SfSort
}>>()
const LABELS = [
  "name", "annualBudget", "month", "budget", "actual", "forecast",
  "deviation", "flag", "notes", "annual", "field", "saveMonth",
  "saveDeviation", "applyAnnual", "yearAmount", "applyYear", "delete",
  "save", "source", "missing", "entry", "yearHintStale", "import",
  "sourceVersion", "monthly", "nameHeading", "ownerScope", "projectScope",
  "record", "year", "select", "status", "saveLabel", "filter", "cancel",
  "loadCurrent", "savedLater", "savedReadPending", "yearAmountInvalid",
] as const
type Label = typeof LABELS[number]
type Editing = Readonly<{
  action: BudgetCommandName
  owner: BudgetOwner | undefined
  entry: BudgetEntry | undefined
  month: number
  parentId: string | null
  recordId: string | undefined
  version: number
  versionKey: string
  operationRef: SfOperationRef
  draft: SfPublicDraftController<BudgetForm>
  returnFocus: HTMLElement | undefined
}>
const entryCollection = (capability: BudgetCapability) => capability === "CAP04" ? "opexEntries" : "capexEntries"
const ownerCollection = (capability: BudgetCapability) => capability === "CAP04" ? "opexOwners" : "capexProjects"
const kind = (capability: BudgetCapability) => capability === "CAP04" ? "opex" : "capex"
const raw = (value: number | string | null | undefined): string => value === null || value === undefined ? "" : String(value)
const numberPresent = (value: string) => value.trim().length > 0 && Number.isFinite(Number(value))
const asRef = (id: string | number): SfRef => String(id) as SfRef

export function SfBudgetSurface(props: SfBudgetSurfaceProps): JSX.Element {
  const context = useSfContext()
  const navigate = useNavigate()
  const { t, locale } = useSfPresentation()
  const unspecified = () => t(("sf.u02.noCurrency") as SfCopyKey)
  const amountText = (value: number | null | undefined) =>
    value === null || value === undefined ? t(key("missing")) :
    new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(value) + " · " + unspecified()
  const formId = createUniqueId()
  const [view, setView] = createStore<{
    page: BudgetPage | undefined
    state: SfUiState
    reload: number
    filter: string
    sort: SfSort
    message: SfCopyKey | undefined
    error: string | undefined
    busy: boolean
    confirmDiscard: boolean
  }>({
    page: undefined, state: "loading", reload: 0, filter: "",
    sort: { kind: "none" }, message: undefined, error: undefined,
    busy: false, confirmDiscard: false,
  })
  const [editing, setEditing] = createSignal<Editing>()
  const [laterEdits, setLaterEdits] = createSignal<Partial<BudgetForm>>({})
  const [reviewedCurrent, setReviewedCurrent] = createSignal<Readonly<{ version: number; value: BudgetForm }>>()
  let confirmedOperation: SfOperationRef | undefined
  const [layoutMode, setLayoutMode] = createSignal<"single" | "split" | "split-context">("single")
  let activeSubmissionRef: SfOperationRef | undefined
  const rememberView = (partial: Partial<{ filter: string; sort: SfSort }>) => {
    const registry = context.ready()?.drafts
    if (!registry) return
    const perSurface = budgetViewByOwner.get(registry) ?? new Map()
    const prior = perSurface.get(props.capability) ?? { filter: "", sort: { kind: "none" } as SfSort }
    perSurface.set(props.capability, { ...prior, ...partial })
    budgetViewByOwner.set(registry, perSurface)
  }
  createEffect(() => {
    const registry = context.ready()?.drafts
    const remembered = registry ? budgetViewByOwner.get(registry)?.get(props.capability) : undefined
    setView("filter", remembered?.filter ?? "")
    setView("sort", remembered?.sort ?? { kind: "none" })
  })
  const editPhase = (editor: Editing) => {
    const draft = editor.draft.snapshot()
    return draft.availability === "active" ? draft.phase : draft.availability
  }
  const year = () => props.route.query.year ?? 2026 // pinned application.ts defaults to 2026
  const key = (label: Label): SfCopyKey =>
    (props.capability === "CAP04" ? "sf.u39." + label : "sf.u40." + label) as SfCopyKey
  const titleKey = (): SfCopyKey =>
    (props.capability === "CAP04" ? "sf.cap04.title" : "sf.cap05.title") as SfCopyKey
  const primaryKey = (): SfCopyKey =>
    (props.capability === "CAP04" ? "sf.cap04.primary" : "sf.cap05.primary") as SfCopyKey
  const message = (label: Label): SfMessage => ({ key: key(label) })
  const contextReady = () => context.ready()
  const destination = () => contextReady()?.context.destinations.find(
    (item) => item.capabilityId === props.capability && item.canRead,
  )
  const availability = () => contextReady()?.context.availability.find(
    (item) => item.family === "domain-read" && item.resource === props.capability,
  )
  const canRead = () => Boolean(destination() && availability()?.operations.some(
    (item) => item.operationId === "domain.page." + props.capability && item.state === "ready" && item.operational,
  ))
  const allowed = (action: BudgetCommandName | "import"): boolean => {
    const id = "domain.command." + props.capability + "." + action
    return Boolean(
      view.page && destination()?.allowedActionIds.includes(action) &&
      view.page.allowedActionIds.includes(action) &&
      availability()?.operations.some((item) => item.operationId === id && item.state === "ready" && item.operational),
    )
  }
  const listHref = (mode: "entry" | "new" | "detail" | "edit", recordId?: string, selectedYear = year()) => {
    const root = props.capability === "CAP04" ? "/orchestra/sf-dashboard/opex" : "/orchestra/sf-dashboard/capex"
    const path = root + (
      mode === "entry" ? "" : mode === "new" ? "/new" :
      "/" + encodeSfRouteRef(recordId ?? "") + (mode === "edit" ? "/edit" : "")
    )
    const query = new URLSearchParams()
    const selection = props.route.ownerSelection
    if (selection.installationId) {
      sfAppendOwnerQuery(query, selection)
    }
    query.set("year", String(selectedYear))
    return path + "?" + query.toString()
  }
  const otherSourceHref = () => {
    const query = new URLSearchParams()
    const selection = props.route.ownerSelection
    if (selection.installationId) {
      sfAppendOwnerQuery(query, selection)
    }
    query.set("year", String(year()))
    return "/orchestra/sf-dashboard/budget?" + query.toString()
  }
  const importHref = () => otherSourceHref().replace("/orchestra/sf-dashboard/budget", "/orchestra/sf-imports/new")
  const selectedRef = (): string | undefined => {
    const route = props.route
    if (route.kind !== "detail" && route.kind !== "edit") return undefined
    return route.surfaceId === "CAP04" ? route.params.lineRef : route.params.projectRef
  }
  const selected = () => view.page?.owners?.find((owner) => String(owner.id) === selectedRef())
  const filtered = createMemo(() => {
    const all = view.page?.owners ?? []
    const q = view.filter.trim().toLocaleLowerCase()
    const shown = q ? all.filter((owner) => (owner.name ?? "").toLocaleLowerCase().includes(q)) : [...all]
    if (view.sort.kind === "none") return shown
    const { key: field, direction } = view.sort
    const multiplier = direction === "asc" ? 1 : -1
    return [...shown].sort((a, b) => {
      if (field === "name") return multiplier * String(a.name ?? "").localeCompare(String(b.name ?? ""))
      if (field === "budget") {
        const av = a.budget
        const bv = b.budget
        // Sorting is presentation-only. Missing values are never treated as zero.
        if (av == null && bv == null) return 0
        if (av == null) return 1
        if (bv == null) return -1
        return multiplier * (av === bv ? 0 : av < bv ? -1 : 1)
      }
      return 0
    })
  })
  const pageState = (): SfUiState => {
    if (!contextReady() || !destination()) {
      if (context.state().status === "unauthenticated") return "session-expired"
      return context.state().status === "resolving" ? "loading" :
        context.state().status === "denied" ? "denied" : "unavailable"
    }
    if (view.state !== "ready" && view.state !== "partial") return view.state
    if (view.page?.owners === undefined) return "partial"
    if (props.route.kind !== "entry" && props.route.kind !== "new" && !selected()) return "not-found"
    if (view.page.owners.length === 0) return "empty"
    return view.page.entries === undefined ? "partial" : "ready"
  }
  const messageFor = (state: SfUiState): SfCopyKey => sfCommonKey({
    loading: "sf.common.loading",
    ready: "sf.common.currentSource",
    empty: "sf.common.empty",
    "filtered-empty": "sf.common.filterEmpty",
    partial: "sf.common.partial",
    invalid: "sf.common.fieldErrorSummary",
    "not-found": "sf.common.removed",
    stale: "sf.common.stale",
    conflict: "sf.common.conflict",
    unavailable: "sf.common.unavailable",
    denied: "sf.common.noAccess",
    "session-expired": "sf.common.loginAgain",
    "outcome-unknown": "sf.common.operationUnknown",
  }[state] as Parameters<typeof sfCommonKey>[0])

  // Never present stale private projections across generation/owner transitions.
  createEffect(() => {
    const ready = contextReady()
    const generation = context.generation()
    const targetYear = year()
    const tick = view.reload
    const state = context.state().status
    if (state !== "ready" || !ready || !canRead()) {
      setView("page", undefined)
      setView("state", state === "unauthenticated" ? "session-expired" : state === "denied" ? "denied" : state === "ready" ? "unavailable" : "loading")
      return
    }
    const signal = new AbortController()
    setView("page", undefined)
    setView("state", "loading")
    void readBudgetPage(ready.transport, props.capability, targetYear, ready.context.stamp, signal.signal)
      .then((result) => {
        if (signal.signal.aborted || context.generation() !== generation || context.ready() !== ready) return
        if (result.state === "ready") {
          setView("page", result.page)
          setView("state", result.page.owners === undefined || result.page.entries === undefined ? "partial" : "ready")
        } else {
          setView("page", undefined)
          setView("state", result.state)
        }
      })
      .catch(() => {
        if (!signal.signal.aborted && context.generation() === generation) {
          setView("page", undefined)
          setView("state", "unavailable")
        }
      })
    onCleanup(() => signal.abort())
    void tick
  })
  createEffect<number | undefined>((prior) => {
    const generation = context.generation()
    if (prior !== undefined && generation !== prior) {
      // Old outstanding mutations must not update the successor owner.
      activeSubmissionRef = undefined
      confirmedOperation = undefined
      setLaterEdits({})
      setReviewedCurrent(undefined)
      setEditing(undefined)
      setView("busy", false)
      setView("confirmDiscard", false)
      setView("error", undefined)
      setView("message", undefined)
    }
    return generation
  })

  const entryFor = (owner: BudgetOwner, month: number, page = view.page): BudgetEntry | undefined =>
    page?.entries?.find((entry) =>
      String(entry.ownerId ?? entry.projId ?? entry.projectId ?? "") === String(owner.id) &&
      entry.year === year() && entry.month === month,
    )
  const deviationFor = (owner: BudgetOwner, month: number, page = view.page) =>
    page?.deviations?.[kind(props.capability) + "-" + String(owner.id) + "-" + year() + "-" + month]
  const hintFor = (owner: BudgetOwner, page = view.page) => page?.ytd?.[year() + ":" + String(owner.id)]
  const formFor = (owner: BudgetOwner | undefined, entry: BudgetEntry | undefined, month: number, page = view.page): BudgetForm => ({
    name: owner?.name ?? "",
    budget: raw(entry ? entry.budget : owner?.budget),
    month,
    actual: raw(entry?.actual),
    forecast: raw(entry?.forecast),
    annual: "",
    field: "budget",
    amount: owner ? raw(hintFor(owner, page)?.amount) : "",
    flag: owner ? (deviationFor(owner, month, page)?.flag ?? "") : "",
    text: owner ? (deviationFor(owner, month, page)?.text ?? "") : "",
  })
  const versionKey = (action: BudgetCommandName, owner: BudgetOwner | undefined, entry: BudgetEntry | undefined, month: number) => {
    if (action === "year-amount") return "budgetYtd"
    if (action === "save-entry") return entry ? entryCollection(props.capability) + ":" + entry.id : ""
    if (action === "save-deviation") return "deviations:" + kind(props.capability) + "-" + String(owner?.id ?? "") + "-" + year() + "-" + month
    return owner ? ownerCollection(props.capability) + ":" + owner.id : ""
  }
  const startEdit = (action: BudgetCommandName, owner?: BudgetOwner, month = 1) => {
    const ready = contextReady()
    const page = view.page
    if (!ready || !page || view.busy || !allowed(action)) return
    if (!owner && action !== "save") return
    const entry = action === "save-entry" && owner ? entryFor(owner, month) : undefined
    const recordId = action === "save-entry" ? (entry ? String(entry.id) : undefined) : owner ? String(owner.id) : undefined
    const keyValue = versionKey(action, owner, entry, month)
    const existingVersion = page.versions[keyValue]
    // An existing entity without CAS is not writable. Absence for a new entity starts at v0.
    if (existingVersion === undefined && (
      (action === "save-entry" && entry !== undefined) ||
      (action === "save-deviation" && owner !== undefined && deviationFor(owner, month) !== undefined) ||
      (action === "save" && owner !== undefined) ||
      action === "delete" || action === "annual-entry" || action === "year-amount"
    )) {
      setView("error", t(sfCommonKey("sf.common.stale")))
      return
    }
    const base = formFor(owner, entry, month)
    const sourcePresent = action === "save-entry" ? entry !== undefined :
      action === "save-deviation" ? (owner ? deviationFor(owner, month) !== undefined : false) :
      owner !== undefined
    // Form-specific identity lives only inside the owner-scoped draft registry.
    const intent = (props.capability + ":" + year() + ":" + action + ":" + (owner?.id ?? "new") + ":" + month) as SfIntentRef
    const recordRef = recordId ? asRef(recordId) : undefined
    const identity = recordRef && sourcePresent ? { kind: "record" as const, recordRef } : { kind: "new" as const, newIntentRef: intent }
    const revalidationFields = action === "year-amount" ? ["budgetYtd"] :
      action === "save-deviation" ? ["deviations"] :
      action === "save-entry" ? [entryCollection(props.capability)] : [ownerCollection(props.capability)]
    const draft = ready.drafts.acquire<BudgetForm>({
      surfaceId: props.capability,
      identity,
      editScopeKey: (year() + ":" + action + ":" + (owner?.id ?? "new") + ":" + month) as SfEditScopeKey,
      baseVersion: existingVersion ?? 0,
      base: sourcePresent ? base : null,
      value: base,
      revalidation: {
        operationId: ("domain.page." + props.capability) as "domain.page.CAP04" | "domain.page.CAP05",
        input: { year: year() },
        fieldPaths: revalidationFields,
        actionIds: [action],
      },
    })
    if (sourcePresent && existingVersion !== undefined)
      draft.receiveRemote({ baseVersion: existingVersion, value: base })
    setView("confirmDiscard", false)
    setView("error", undefined)
    setView("message", undefined)
    setLaterEdits({})
    setReviewedCurrent(undefined)
    confirmedOperation = undefined
    setEditing({
      action, owner, entry, month, parentId: owner ? String(owner.id) : null, recordId,
      version: existingVersion ?? 0, versionKey: keyValue,
      operationRef: crypto.randomUUID() as SfOperationRef,
      draft,
      returnFocus: document.activeElement instanceof HTMLElement ? document.activeElement : undefined,
    })
  }

  createEffect(() => {
    const page = view.page
    const current = editing()
    const kindRoute = props.route.kind
    if (!page || current || (kindRoute !== "new" && kindRoute !== "edit")) return
    if (kindRoute === "new") startEdit("save")
    if (kindRoute === "edit" && selected()) startEdit("save", selected())
  })

  const updateField = (field: keyof BudgetForm, value: string) => {
    const editor = editing()
    const snapshot = editor?.draft.snapshot()
    if (!editor || !snapshot || snapshot.availability !== "active") return
    const change = { [field]: field === "month" ? Number(value) : value }
    if (snapshot.pendingOperation) {
      // The submitted draft and its digest stay immutable. Later typing belongs
      // to this mounted editor only until the known reply and a fresh source read.
      if (snapshot.phase !== "submitting" || !allowsLaterEdits(editor)) return
      setLaterEdits((prior) => ({ ...prior, ...change }))
    } else editor.draft.edit({ ...snapshot.value, ...change } as BudgetForm)
    setView("error", undefined)
  }
  const validate = (editor: Editing): string | undefined => {
    const state = editor.draft.snapshot()
    if (state.availability !== "active") return t(sfCommonKey("sf.common.unavailable"))
    if (state.conflict || state.phase === "conflict" || state.pendingOperation !== null) return t(sfCommonKey("sf.common.stale"))
    if (state.baseVersion !== editor.version) return t(sfCommonKey("sf.common.stale"))
    const fields = state.value
    if (editor.action === "save" && (!fields.name.trim() || !numberPresent(fields.budget))) return t(sfCommonKey("sf.common.fieldErrorSummary"))
    if (editor.action === "save-entry" && ![fields.budget, fields.actual, fields.forecast].every(numberPresent)) return t(sfCommonKey("sf.common.fieldErrorSummary"))
    if (editor.action === "annual-entry" && !numberPresent(fields.annual)) return t(sfCommonKey("sf.common.fieldErrorSummary"))
    if (editor.action === "year-amount" && fields.amount.trim() !== "" && (!numberPresent(fields.amount) || Number(fields.amount) < 0)) return t(key("yearAmountInvalid"))
    if (editor.action !== "save" && editor.action !== "save-entry" && editor.action !== "annual-entry" && editor.action !== "year-amount" && editor.action !== "save-deviation" && editor.action !== "delete") return t(sfCommonKey("sf.common.invalidLink"))
    if (editor.action === "save-deviation" && !budgetDeviationSourceMatches(
      view.page, props.capability, year(), { ...editor, sourcePresent: state.base !== null },
    )) return t(sfCommonKey("sf.common.stale"))
    if (editor.recordId !== undefined && view.page?.versions[editor.versionKey] !== editor.version &&
        editor.action !== "save-entry" && editor.action !== "save-deviation") return t(sfCommonKey("sf.common.stale"))
    if (!allowed(editor.action)) return t(sfCommonKey("sf.common.noAccess"))
    return undefined
  }
  const beginReview = () => {
    const editor = editing()
    if (!editor || view.busy) return
    const error = validate(editor)
    if (error) {
      setView("error", error)
      editor.draft.setPhase("validation-error")
      return
    }
    editor.draft.setPhase("reviewing")
    setView("error", undefined)
  }
  const hasDraft = () => {
    const state = editing()?.draft.snapshot()
    return state?.availability === "active" && state.dirty
  }
  const shownSelected = () => {
    const owner = selected()
    if (!owner) return undefined
    return filtered().some((row) => String(row.id) === String(owner.id)) ? owner : undefined
  }
  createEffect(() => {
    const ref = selectedRef()
    if (!view.page || !ref || !view.filter.trim()) return
    if (filtered().some((owner) => String(owner.id) === ref)) return
    if (editing()?.owner && String(editing()!.owner!.id) === ref) setEditing(undefined)
    if (props.route.kind === "detail" || props.route.kind === "edit") navigate(listHref("entry"))
  })
  const restoreEditorFocus = (editor: Editing) => {
    const ready = contextReady()
    queueMicrotask(() => {
      if (!ready || contextReady() !== ready) return
      if (editor.returnFocus?.isConnected) { editor.returnFocus.focus(); return }
      if (editor.action === "save-entry" || editor.action === "save-deviation") {
        document.querySelector<HTMLButtonElement>(
          '.sf-budget-detail tr[data-sf-month="' + editor.month + '"] button[data-sf-action="' + editor.action + '"]',
        )?.focus()
      }
    })
  }
  const closeEditor = () => {
    if (view.busy) return
    const editor = editing()
    const snapshot = editor?.draft.snapshot()
    if (snapshot?.availability === "active" && snapshot.pendingOperation) return
    if (editor) restoreEditorFocus(editor)
    setLaterEdits({})
    setReviewedCurrent(undefined)
    confirmedOperation = undefined
    setEditing(undefined)
    setView("confirmDiscard", false)
    setView("error", undefined)
    if (props.route.kind === "new") navigate(listHref("entry"))
    if (props.route.kind === "edit") navigate(selectedRef() ? listHref("detail", selectedRef()) : listHref("entry"))
  }
  const discard = () => {
    const editor = editing()
    if (!editor || view.busy) return
    editor.draft.discard()
    closeEditor()
  }
  const draftFields = (editor: Editing, values: BudgetForm): readonly SfReviewField[] => {
    const fields: [Label, string][] = editor.action === "delete" ? [] :
      editor.action === "save" ? [["name", values.name], ["annualBudget", values.budget]] :
      editor.action === "save-entry" ? [["month", String(values.month)], ["budget", values.budget], ["actual", values.actual], ["forecast", values.forecast]] :
      editor.action === "save-deviation" ? [["month", String(values.month)], ["flag", values.flag], ["notes", values.text]] :
      editor.action === "annual-entry" ? [["annual", values.annual], ["field", values.field]] :
      [["yearAmount", values.amount]]
    return fields.map(([label, value]) => ({
      path: label,
      label: message(label),
      value: value.length ? ({ kind: "text", text: { kind: "data", text: value } } as SfDisplayValue) :
        ({ kind: "missing", reason: { key: key("missing") } } as SfDisplayValue),
    }))
  }
  const reviewBase = (editor: Editing): SfReviewSnapshot | null => {
    const snapshot = editor.draft.snapshot()
    if (snapshot.availability !== "active" || !snapshot.base) return null
    return {
      kind: "persisted", ref: asRef(editor.recordId ?? editor.parentId ?? "new"),
      version: editor.version, fields: draftFields(editor, snapshot.base),
    }
  }
  const reviewProposed = (editor: Editing): SfReviewSnapshot => {
    const snapshot = editor.draft.snapshot()
    if (snapshot.availability !== "active") return { kind: "not-provided", reason: { key: sfCommonKey("sf.common.unavailable") } }
    if (editor.action === "delete") return { kind: "not-provided", reason: { key: key("delete") } }
    return {
      kind: "draft",
      intentRef: (props.capability + ":review:" + editor.operationRef) as SfIntentRef,
      sourceRef: editor.recordId ? asRef(editor.recordId) : null,
      sourceVersion: editor.recordId ? editor.version : null,
      fields: draftFields(editor, snapshot.value),
    }
  }
  const reviewConfirmation = (editor: Editing): SfReviewConfirmation => {
    if (validate(editor) || view.state !== "ready" && view.state !== "partial") {
      return { kind: "blocked", labelKey: sfCommonKey("sf.common.review"), reasons: [{ key: sfCommonKey("sf.common.stale") }] }
    }
    return {
      kind: "admitted",
      labelKey: editor.action === "delete" ? key("delete") : key("save"),
      purpose: editor.action === "delete" ? "delete" : editor.action === "annual-entry" || editor.action === "year-amount" ? "apply" : "save",
      binding: {
        kind: "catalog-command",
        operationId: ("domain.command." + props.capability + "." + editor.action) as SfOperationId,
        version: editor.recordId ? { kind: "record", expectedVersion: editor.version } : { kind: "none" },
        confirmation: "presentation-only",
      },
    }
  }

  const allowsLaterEdits = (editor: Editing) =>
    editor.parentId !== null && (editor.action === "save-entry" || editor.action === "save-deviation")
  const currentEditorSource = (editor: Editing, page: BudgetPage) => {
    const owner = page.owners?.find((item) => String(item.id) === editor.parentId)
    if (!owner) return
    const entry = editor.action === "save-entry" ? entryFor(owner, editor.month, page) : undefined
    if (editor.action === "save-entry" && (!entry ||
        editor.recordId !== undefined && String(entry.id) !== editor.recordId)) return
    const keyValue = versionKey(editor.action, owner, entry, editor.month)
    const version = page.versions[keyValue]
    if (version === undefined) return
    return {
      owner, entry, versionKey: keyValue, version,
      recordId: editor.action === "save-entry" ? String(entry!.id) : String(owner.id),
      value: formFor(owner, entry, editor.month, page),
    }
  }
  const publishPage = (page: BudgetPage) => {
    setView("page", page)
    setView("state", page.owners === undefined || page.entries === undefined ? "partial" : "ready")
  }
  const finishConfirmed = (editor: Editing, page: BudgetPage) => {
    const snapshot = editor.draft.snapshot()
    if (confirmedOperation !== editor.operationRef || snapshot.availability !== "active" ||
        snapshot.pendingOperation?.operationRef !== editor.operationRef) return false
    const later = laterEdits()
    if (Object.keys(later).length) {
      const current = currentEditorSource(editor, page)
      // A stale/absent projection cannot become the base of an unsent draft.
      if (!current || current.version <= editor.version) return false
      editor.draft.confirmSave({ kind: "projected", operationRef: editor.operationRef,
        baseVersion: current.version, value: current.value })
      editor.draft.edit({ ...current.value, ...later })
      publishPage(page)
      setLaterEdits({})
      setReviewedCurrent({ version: current.version, value: current.value })
      setEditing({ ...editor, ...current, operationRef: crypto.randomUUID() as SfOperationRef })
      setView("message", key("savedLater"))
    } else {
      // The reply confirms the command; the separate authorized read refreshes
      // the screen. Neither is fabricated from the submitted values.
      const current = currentEditorSource(editor, page)
      if (current && current.version > editor.version)
        editor.draft.confirmSave({ kind: "projected", operationRef: editor.operationRef,
          baseVersion: current.version, value: current.value })
      else editor.draft.confirmSave({ kind: "confirmed-without-projection", operationRef: editor.operationRef, resultVersion: null })
      publishPage(page)
      setView("message", sfCommonKey("sf.common.saved"))
      setEditing(undefined)
      setReviewedCurrent(undefined)
      restoreEditorFocus(editor)
      if (editor.action === "delete" || props.route.kind === "new") navigate(listHref("entry"))
      else if (props.route.kind === "edit" && editor.parentId) navigate(listHref("detail", editor.parentId))
    }
    confirmedOperation = undefined
    return true
  }
  const loadCurrent = async (editor: Editing) => {
    const ready = contextReady(), snapshot = editor.draft.snapshot()
    if (!ready || view.busy || editing() !== editor || snapshot.availability !== "active" ||
        (snapshot.pendingOperation && confirmedOperation !== editor.operationRef)) return
    const abort = new AbortController()
    setView("busy", true)
    try {
      const result = await readBudgetPage(ready.transport, props.capability, year(), ready.context.stamp, abort.signal)
      if (contextReady() !== ready || editing() !== editor) return
      if (result.state !== "ready") { setView("error", t(messageFor(result.state))); return }
      if (confirmedOperation === editor.operationRef) {
        if (!finishConfirmed(editor, result.page)) setView("error", t(key("savedReadPending")))
        return
      }
      const current = currentEditorSource(editor, result.page)
      if (!current || !result.page.allowedActionIds.includes(editor.action)) {
        setView("error", t(sfCommonKey("sf.common.stale"))); return
      }
      const retained = editor.draft.snapshot()
      if (retained.availability !== "active" || retained.pendingOperation) return
      // This explicit action adopts only a newly authenticated source version.
      // Keep every unsent value, then require a new review before any command.
      editor.draft.receiveRemote({ baseVersion: current.version, value: current.value })
      editor.draft.discard()
      editor.draft.edit(retained.value)
      publishPage(result.page)
      setReviewedCurrent({ version: current.version, value: current.value })
      setEditing({ ...editor, ...current, operationRef: crypto.randomUUID() as SfOperationRef })
      setView("error", undefined)
    } catch {
      console.error("SF budget current-source read failed")
      if (contextReady() === ready && editing() === editor)
        setView("error", t(sfCommonKey("sf.common.unavailable")))
    } finally {
      abort.abort()
      if (contextReady() === ready) setView("busy", false)
    }
  }
  const confirmReview = async () => {
    const editor = editing()
    const ready = contextReady()
    const page = view.page
    const snapshot = editor?.draft.snapshot()
    if (!editor || !ready || !page || !snapshot || snapshot.availability !== "active" || validate(editor) || view.busy) return
    if (context.state().status !== "ready" || page.context.accessRevision !== ready.context.stamp.accessRevision) return
    const input: BudgetCommand = {
      action: editor.action, recordId: editor.recordId, parentId: editor.parentId,
      year: year(), version: editor.version, versions: page.versions, form: snapshot.value,
    }
    const abort = new AbortController()
    const operationRef = editor.operationRef
    const idempotencyKey = crypto.randomUUID()
    const bytes = new TextEncoder().encode(JSON.stringify(input))
    const fingerprint = await crypto.subtle.digest("SHA-256", bytes).catch(() => undefined)
    const current = editor.draft.snapshot()
    if (!fingerprint || context.ready() !== ready || editing() !== editor || validate(editor) ||
        current.availability !== "active" || current.value !== snapshot.value) return
    const payloadDigest = Array.from(new Uint8Array(fingerprint), (byte) => byte.toString(16).padStart(2, "0")).join("")
    editor.draft.setPending({ operationRef, idempotencyKey, payloadDigest, expectedVersion: editor.version })
    const pendingSnapshot = editor.draft.snapshot()
    if (pendingSnapshot.availability !== "active" || pendingSnapshot.pendingOperation?.operationRef !== operationRef) return
    editor.draft.setPhase("submitting")
    activeSubmissionRef = operationRef
    setLaterEdits({})
    setView("busy", true)
    setView("error", undefined)
    setView("message", undefined)
    try {
      const result = await writeBudgetPage(ready.transport, props.capability, input, {
        signal: abort.signal, idempotencyKey,
      } satisfies SfCallOptions & { idempotencyKey: string })
      if (context.ready() !== ready || editing() !== editor) return
      if (result.kind !== "response") {
        editor.draft.setPhase("outcome-unknown")
        setView("error", t(sfCommonKey("sf.common.operationUnknown")))
        return
      }
      if (!result.body.ok) {
        if (result.body.status === 409 || result.body.status === 422) {
          editor.draft.rejectSave({ status: result.body.status, operation: { operationRef, idempotencyKey, payloadDigest, expectedVersion: editor.version } })
          const later = laterEdits()
          if (Object.keys(later).length) {
            const retained = editor.draft.snapshot()
            if (retained.availability === "active" && !retained.pendingOperation)
              editor.draft.edit({ ...retained.value, ...later })
          }
          setLaterEdits({})
          editor.draft.setPhase(result.body.status === 409 ? "conflict" : "validation-error")
          setView("error", result.body.status === 409 ? t(sfCommonKey("sf.common.conflict")) :
            result.body.errors?.join("; ") ?? t(sfCommonKey("sf.common.fieldErrorSummary")))
        } else if (result.body.status === 403) {
          context.invalidate("revoked")
        } else {
          editor.draft.setPhase("outcome-unknown")
          setView("error", t(sfCommonKey("sf.common.operationUnknown")))
        }
        return
      }
      confirmedOperation = operationRef
      const postRead = await readBudgetPage(ready.transport, props.capability, year(), ready.context.stamp, abort.signal)
      if (context.ready() !== ready || editing() !== editor) return
      if (postRead.state !== "ready" || !finishConfirmed(editor, postRead.page)) {
        editor.draft.setPhase("outcome-unknown")
        setView("error", t(key("savedReadPending")))
      }
    } catch {
      console.error("SF budget save or confirmation read failed")
      if (context.ready() === ready && editing() === editor) {
        editor.draft.setPhase("outcome-unknown")
        setView("error", t(confirmedOperation === operationRef ? key("savedReadPending") : sfCommonKey("sf.common.operationUnknown")))
      }
    } finally {
      abort.abort()
      if (activeSubmissionRef === operationRef) {
        activeSubmissionRef = undefined
        if (context.ready() === ready) setView("busy", false)
      }
    }
  }
  const sourceAction = (): readonly SfAction[] =>
    contextReady()?.context.destinations.some((item) => item.capabilityId === "CAP03" && item.canRead)
      ? [{ id: "source", labelKey: sfCommonKey("sf.common.source"), tone: "secondary", disabled: false, busy: false, onInvoke: () => navigate(otherSourceHref()) }]
      : []
  const ownerColumns: readonly SfColumn<BudgetOwner>[] = [
    { id: "name", labelKey: key("name"), align: "start", sortKey: "name", widthPolicy: { kind: "flex", minPx: 180, weight: 2 }, render: (owner) => <bdi>{owner.name ?? t(key("missing"))}</bdi> },
    { id: "budget", labelKey: key("annualBudget"), align: "end", sortKey: "budget", widthPolicy: { kind: "content", minPx: 140, maxPx: 220 }, render: (owner) => <span class="sf-budget-number">{amountText(owner.budget)}</span> },
    ...(props.capability === "CAP05" ? [{
      id: "status", labelKey: key("status"), align: "start" as const, widthPolicy: { kind: "content" as const, minPx: 120, maxPx: 180 },
      render: (owner: BudgetOwner) => <bdi>{owner.status ?? t(key("missing"))}</bdi>,
    }] : []),
  ]
  const pageAction = (): SfAction | undefined => !allowed("save") ? undefined : ({
    id: "new", labelKey: primaryKey(), tone: "primary",
    disabled: view.busy, busy: view.busy, onInvoke: () => navigate(listHref("new")),
  })
  const showMonth = (owner: BudgetOwner, month: number) => {
    const entry = entryFor(owner, month)
    const deviation = deviationFor(owner, month)
    return (
      <tr data-sf-month={month}>
        <th scope="row">{month}</th>
        <td>{amountText(entry?.budget)}</td>
        <td>{amountText(entry?.actual)}</td>
        <td>{amountText(entry?.forecast)}</td>
        <td>{deviation?.flag === undefined ? t(key("missing")) : deviation.flag}</td>
        <td><bdi>{deviation?.text ?? t(key("missing"))}</bdi></td>
        <Show when={allowed("save-entry") || allowed("save-deviation")}>
          <td class="sf-budget-row-actions">
            <Show when={allowed("save-entry")}>
              <button type="button" class="mx-btn" disabled={view.busy} data-sf-action="save-entry" onClick={() => startEdit("save-entry", owner, month)}>{t(key("saveMonth"))}</button>
            </Show>
            <Show when={allowed("save-deviation")}>
              <button type="button" class="mx-btn" disabled={view.busy} data-sf-action="save-deviation" onClick={() => startEdit("save-deviation", owner, month)}>{t(key("saveDeviation"))}</button>
            </Show>
          </td>
        </Show>
      </tr>
    )
  }
  const value = (v: number | string | null | undefined): SfDisplayValue =>
    v === null || v === undefined ? { kind: "missing", reason: { key: key("missing") } } :
      { kind: "text", text: { kind: "data", text: typeof v === "number" ? amountText(v) : String(v) } }
  const detail = (owner: BudgetOwner) => (
    <SfRecordDetail
      title={{ kind: "data", text: owner.name ?? String(owner.id) }}
      secondaryId={{ kind: "data", text: String(owner.id) }}
      status={{ code: owner.status ?? "record", text: owner.status ? { kind: "data", text: owner.status } : { kind: "message", message: { key: sfCommonKey("sf.common.currentSource") } }, tone: "neutral" }}
      metadata={[
        { id: "budget", label: message("annualBudget"), value: value(owner.budget) },
        { id: "source-version", label: message("sourceVersion"), value: value(view.page?.versions[ownerCollection(props.capability) + ":" + owner.id]) },
      ]}
      sections={[
        { id: "annual-monthly", titleKey: key("entry"), state: view.page?.entries ? "ready" : "partial", content: (
          <div class="sf-budget-detail-section">
            <Show when={allowed("annual-entry") || allowed("year-amount")}>
              <div class="sf-budget-actions">
                <Show when={allowed("annual-entry")}>
                  <button class="mx-btn" type="button" disabled={view.busy} onClick={() => startEdit("annual-entry", owner)}>{t(key("applyAnnual"))}</button>
                </Show>
                <Show when={allowed("year-amount")}>
                  <button class="mx-btn" type="button" disabled={view.busy} onClick={() => startEdit("year-amount", owner)}>{t(key("applyYear"))}</button>
                </Show>
              </div>
            </Show>
            <Show when={hintFor(owner)}>
              {(hint) => <dl class="sf-budget-hint">
                <div><dt>{t(key("yearAmount"))}</dt><dd>{amountText(hint().amount)}</dd></div>
                <div><dt>{t(key("month"))}</dt><dd>{hint().months}</dd></div>
                <div><dt>{t(key("sourceVersion"))}</dt><dd>{view.page?.versions.budgetYtd ?? t(key("missing"))}</dd></div>
              </dl>}
            </Show>
            <div class="sf-budget-months-scroll" tabindex="0" role="region" aria-label={t(key("entry"))}>
              <table class="sf-budget-months">
                <caption>{t(key("entry"))} · {year()}</caption>
                <thead><tr>
                  <th scope="col">{t(key("month"))}</th>
                  <th scope="col">{t(key("budget"))}</th>
                  <th scope="col">{t(key("actual"))}</th>
                  <th scope="col">{t(key("forecast"))}</th>
                  <th scope="col">{t(key("flag"))}</th>
                  <th scope="col">{t(key("notes"))}</th>
                  <Show when={allowed("save-entry") || allowed("save-deviation")}>
                    <th scope="col">{t(sfCommonKey("sf.common.edit"))}</th>
                  </Show>
                </tr></thead>
                <tbody><For each={months}>{(month) => showMonth(owner, month)}</For></tbody>
              </table>
            </div>
          </div>
        ) },
        { id: "source", titleKey: key("source"), state: "ready", content: (
          <div class="sf-budget-source">
            <p>{t(sfCommonKey("sf.common.currentSource"))}</p>
            <code>{ownerCollection(props.capability) + ":" + owner.id}</code>
            <Show when={view.page?.versions[ownerCollection(props.capability) + ":" + owner.id] !== undefined}>
              <p>{t(key("sourceVersion"))}: {view.page?.versions[ownerCollection(props.capability) + ":" + owner.id]}</p>
            </Show>
          </div>
        ) },
      ]}
      primaryAction={allowed("save") ? { id: "edit", labelKey: sfCommonKey("sf.common.edit"), tone: "primary", disabled: view.busy, busy: view.busy, onInvoke: () => navigate(listHref("edit", String(owner.id))) } : undefined}
      secondaryActions={allowed("delete") ? [{ id: "delete", labelKey: key("delete"), tone: "danger", disabled: view.busy, busy: view.busy, onInvoke: () => startEdit("delete", owner) }] : []}
      sourceActions={sourceAction()}
      onBack={() => navigate(listHref("entry"))}
      onOpenPage={() => navigate(listHref("detail", String(owner.id)))}
    />
  )

  const BudgetEditor = (editorProps: Readonly<{ editor: Editing }>): JSX.Element => {
    const editor = editorProps.editor
    const active = () => {
      const snapshot = editor.draft.snapshot()
      return snapshot.availability === "active" ? snapshot : undefined
    }
    const phase = () => active()?.phase
    const form = (): BudgetForm => ({ ...active()!.value, ...laterEdits() })
    const fieldsLocked = () => Boolean(active()?.pendingOperation) && !allowsLaterEdits(editor)
    return <Show when={Boolean(active())} fallback={
      <SfStatePanel state={editor.draft.snapshot().availability === "quarantined" ? "session-expired" : "denied"}
        messageKey={sfCommonKey("sf.common.noAccess")} />
    }>
      <Show when={phase() === "outcome-unknown"} fallback={
        <Show when={phase() === "reviewing" || editor.action === "delete"} fallback={
      <form class="sf-budget-form mx-card" aria-label={t(key("record"))} onSubmit={(event) => { event.preventDefault(); beginReview() }}>
        <h2>{editor.action === "save" ? t(key("save")) : editor.action === "save-entry" ? t(key("saveMonth")) : editor.action === "save-deviation" ? t(key("saveDeviation")) : editor.action === "annual-entry" ? t(key("applyAnnual")) : t(key("applyYear"))}</h2>
        <p>{t(key("year"))}: {year()} · {t(key("sourceVersion"))}: {editor.version}</p>
        <Show when={phase() === "submitting"}>
          <p role="status" aria-live="polite">{t(sfCommonKey("sf.common.loading"))}</p>
        </Show>
        <Show when={reviewedCurrent()}>
          {(current) => <section class="sf-budget-current" data-sf-current-version={current().version}
            aria-label={t(sfCommonKey("sf.common.currentSource"))}>
            <h3>{t(sfCommonKey("sf.common.currentSource"))}</h3>
            <dl><For each={draftFields(editor, current().value)}>{(field) =>
              <div><dt>{t(field.label.key)}</dt><dd><SfDisplayValueText value={field.value} /></dd></div>
            }</For></dl>
          </section>}
        </Show>
        <Show when={editor.action === "save"}>
          <label for={formId + "-name"}>{t(key("name"))}</label>
          <input id={formId + "-name"} required type="text" value={form().name} disabled={fieldsLocked()} onInput={(event) => updateField("name", event.currentTarget.value)} />
          <label for={formId + "-budget"}>{t(key("annualBudget"))}</label>
          <input id={formId + "-budget"} required type="number" step="any" value={form().budget} disabled={fieldsLocked()} onInput={(event) => updateField("budget", event.currentTarget.value)} />
        </Show>
        <Show when={editor.action === "save-entry"}>
          <label for={formId + "-month"}>{t(key("month"))}</label>
          <input id={formId + "-month"} type="number" value={form().month} readOnly />
          <For each={["budget", "actual", "forecast"] as const}>{(field) => (
            <>
              <label for={formId + "-" + field}>{t(key(field))}</label>
              <input id={formId + "-" + field} required type="number" step="any" value={form()[field]} disabled={fieldsLocked()} onInput={(event) => updateField(field, event.currentTarget.value)} />
            </>
          )}</For>
        </Show>
        <Show when={editor.action === "save-deviation"}>
          <label for={formId + "-month"}>{t(key("month"))}</label>
          <input id={formId + "-month"} type="number" value={form().month} readOnly />
          <label for={formId + "-flag"}>{t(key("flag"))}</label>
          <select id={formId + "-flag"} value={form().flag} disabled={fieldsLocked()} onChange={(event) => updateField("flag", event.currentTarget.value)}>
            <option value=""></option>
            <option value="dev-green">dev-green</option>
            <option value="dev-amber">dev-amber</option>
            <option value="dev-red">dev-red</option>
          </select>
          <label for={formId + "-notes"}>{t(key("notes"))}</label>
          <textarea id={formId + "-notes"} value={form().text} disabled={fieldsLocked()} onInput={(event) => updateField("text", event.currentTarget.value)} />
        </Show>
        <Show when={editor.action === "annual-entry"}>
          <label for={formId + "-annual"}>{t(key("annual"))}</label>
          <input id={formId + "-annual"} required type="number" step="any" value={form().annual} disabled={fieldsLocked()} onInput={(event) => updateField("annual", event.currentTarget.value)} />
          <label for={formId + "-field"}>{t(key("field"))}</label>
          <select id={formId + "-field"} value={form().field} disabled={fieldsLocked()} onChange={(event) => updateField("field", event.currentTarget.value)}>
            <option value="budget">budget</option><option value="actual">actual</option><option value="forecast">forecast</option>
          </select>
        </Show>
        <Show when={editor.action === "year-amount"}>
          <label for={formId + "-amount"}>{t(key("yearAmount"))}</label>
          <input id={formId + "-amount"} type="number" step="any" value={form().amount} disabled={fieldsLocked()} onInput={(event) => updateField("amount", event.currentTarget.value)} />
        </Show>
        <Show when={view.error}><p role="alert" class="sf-budget-error">{view.error}</p></Show>
        <div class="sf-budget-actions">
          <button class="mx-btn primary" type="submit" disabled={view.busy}>{t(sfCommonKey("sf.common.review"))}</button>
          <button class="mx-btn" type="button" disabled={view.busy || Boolean(active()?.pendingOperation)} onClick={closeEditor}>{t(key("cancel"))}</button>
          <Show when={phase() === "conflict"}>
            <button class="mx-btn" type="button" disabled={view.busy} onClick={() => { void loadCurrent(editor) }}>{t(key("loadCurrent"))}</button>
          </Show>
          <Show when={hasDraft() && !active()?.pendingOperation}>
            <button class="mx-btn" type="button" onClick={() => setView("confirmDiscard", true)}>{t(sfCommonKey("sf.common.discard"))}</button>
          </Show>
        </div>
        <Show when={view.confirmDiscard}>
          <div class="sf-budget-confirm" role="group" aria-label={t(sfCommonKey("sf.common.navigationDiscard"))}>
            <p>{t(sfCommonKey("sf.common.navigationDiscard"))}</p>
            <button class="mx-btn danger" type="button" onClick={discard}>{t(sfCommonKey("sf.common.discard"))}</button>
            <button class="mx-btn" type="button" onClick={() => setView("confirmDiscard", false)}>{t(sfCommonKey("sf.common.keepEditing"))}</button>
          </div>
        </Show>
      </form>
        }>
          <SfChangeReview
            operation={{ ref: editor.operationRef, label: { key: editor.action === "delete" ? key("delete") : key("save") }, scope: { kind: "data", text: editor.owner?.name ?? t(primaryKey()) } }}
            base={reviewBase(editor)} current={reviewBase(editor)}
            proposed={reviewProposed(editor)}
            effects={[]}
            coverage={{ state: "complete", summary: { key: sfCommonKey("sf.common.currentSource") }, reasons: [], knownCount: null, expectedCount: null }}
            blockingReasons={[]}
            confirmation={reviewConfirmation(editor)}
            state={view.state === "stale" ? "stale" : "ready"}
            onConfirm={() => { void confirmReview() }}
            onRevise={() => { editor.draft.setPhase("dirty"); setView("error", undefined) }}
            onCancel={closeEditor}
            onReconcile={() => { void loadCurrent(editor) }}
          />
        </Show>
      }>
        <Show when={view.error}><p role="status">{view.error}</p></Show>
        <SfReceiptView
          operationRef={editor.operationRef}
          producerStatus={{ kind: "pending" }}
          effects={[]} receipts={[]} state="outcome-unknown"
          onReconcileRead={() => { void loadCurrent(editor) }}
        />
      </Show>
    </Show>
  }

  return (
    <div class="sf-budget-surface" data-sf-budget={props.capability} data-sf-layout-mode={layoutMode()}>
      <SfPageFrame
        titleKey={titleKey()}
        context={[{ id: "year", label: { key: key("year") }, value: { kind: "data", text: String(year()) } }]}
        tabs={[]} activeTab={null}
        primaryAction={pageAction()}
        secondaryActions={[]}
        density="comfortable" layout="split"
        onLayoutMode={(mode) => setLayoutMode(mode)}
      >
        <SfContextBar
          state={pageState()}
          selection={[{ control: "year", optionId: String(year()) }]}
          catalog={([2024, 2025, 2026, 2027] as const).map((value) => ({
            id: String(value), control: "year" as const, value, label: { kind: "data" as const, text: String(value) }, available: true,
          }))}
          lockedReasons={[]}
          onRequestChange={(change) => {
            const selectedYear = Number(change.optionId)
            if (change.control === "year" && [2024, 2025, 2026, 2027].includes(selectedYear)) {
              navigate(listHref("entry", undefined, selectedYear))
            }
          }}
        />
        <Show when={view.message}><p class="sf-budget-status" role="status">{t(view.message!)}</p></Show>
        <Show when={view.error && !editing()}><p class="sf-budget-error" role="alert">{view.error}</p></Show>
        <SfStatePanel
          state={pageState()}
          messageKey={messageFor(pageState())}
          onRetryRead={() => setView("reload", (v) => v + 1)}
          onBack={() => navigate(listHref("entry"))}
          onLogin={() => { void context.reload() }}
        >
          <div class="sf-budget-body">
            <section class="sf-budget-owners" aria-label={t(titleKey())}>
              <label for={formId + "-filter"}>{t(key("filter"))}</label>
              <input id={formId + "-filter"} type="search" value={view.filter} onInput={(event) => {
                const filter = event.currentTarget.value
                setView("filter", filter)
                rememberView({ filter })
              }} />
              <Show when={view.filter.trim() && filtered().length === 0}>
                <SfStatePanel state="filtered-empty" messageKey={sfCommonKey("sf.common.filterEmpty")} />
              </Show>
              <SfDataTable
                rows={filtered()}
                getRowKey={(owner) => asRef(owner.id)}
                columns={ownerColumns}
                selectedKey={shownSelected() ? asRef(shownSelected()!.id) : undefined}
                sort={view.sort}
                page={{ kind: "none", total: view.page?.owners?.length ?? null }}
                onSort={(next) => { setView("sort", next); rememberView({ sort: next }) }}
                onPage={() => setView("reload", (value) => value + 1)}
                onSelect={(recordRef) => navigate(listHref("detail", String(recordRef)))}
                rowActions={() => [
                  ...(allowed("save") ? [{ id: "edit", labelKey: sfCommonKey("sf.common.edit"), tone: "secondary" as const, disabled: view.busy, busy: view.busy }] : []),
                  ...(allowed("delete") ? [{ id: "delete", labelKey: key("delete"), tone: "danger" as const, disabled: view.busy, busy: view.busy }] : []),
                ]}
                onRowAction={(request) => {
                  const owner = view.page?.owners?.find((item) => String(item.id) === String(request.recordRef))
                  if (!owner) return
                  if (request.actionId === "edit") navigate(listHref("edit", String(owner.id)))
                  if (request.actionId === "delete") startEdit("delete", owner)
                }}
                captionKey={titleKey()}
                density="comfortable"
                state={pageState()}
              />
              <Show when={props.capability === "CAP04" && allowed("import")}>
                <a class="mx-btn" href={importHref()}>{t(key("import"))}</a>
              </Show>
            </section>
            <Show when={shownSelected()}>
              {(owner) => <section class="sf-budget-detail" aria-label={t(key("record"))}>{detail(owner())}</section>}
            </Show>
          </div>
        </SfStatePanel>
        <Show when={context.state().status === "ready" && view.page && editing() ? editing() : undefined} keyed>
          {(editor) => <section class="sf-budget-editor" data-sf-action={editor.action} data-sf-version={editor.version}
            data-sf-draft-phase={editPhase(editor)} data-sf-draft-dirty={hasDraft()}>
            <BudgetEditor editor={editor} />
          </section>}
        </Show>
      </SfPageFrame>
    </div>
  )
}
