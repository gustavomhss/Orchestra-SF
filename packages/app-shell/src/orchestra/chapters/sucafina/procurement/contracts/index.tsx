import { useNavigate } from "@solidjs/router"
import { Icon } from "@orchestra/ui/icon"
import { createEffect, createMemo, createUniqueId, For, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import type { SfEditScopeKey, SfIntentRef, SfOperationRef, SfRef } from "@orchestra/schema/sucafina/context"
import type { SfSurfaceProps } from "../../context/contracts"
import { useSfReadableContext as useSfContext } from "../../context"
import { encodeSfRouteRef } from "../../navigation-state"
import { SfPageFrame } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { SfDataTable, type SfColumn, type SfCopyKey as SfTableCopyKey, type SfSort, type SfUiState } from "../../shared/table"
import { SfChangeReview, type SfReviewField, type SfReviewSnapshot } from "../../shared/change-review"
import { SfBoundAssets } from "../../shared/attachments/bound-assets"
import { SfContractRequestLinks } from "./request-links"
import type { SfDraftState } from "../../shared/draft"
import { SF_U15_COPY } from "@/i18n/orchestra-chapters/sf-u15"
import {
  decodeVendorContractsPage, vendorAuthorizedAction, vendorCommandInput,
  vendorAmountText, vendorEditFromRecord, vendorRef, vendorVersion,
  type SfVendorAction, type SfVendorContract, type SfVendorEdit, type SfVendorRead, type SfVendorSave,
} from "./model"
import "./contracts.css"

type Key = keyof typeof SF_U15_COPY
type Ready = Extract<SfVendorRead, { kind: "ready" }>
type Review = Readonly<{
  action: SfVendorAction; ref: SfRef | undefined; version: number; values: SfVendorEdit
  intentRef: SfIntentRef; operationRef: SfOperationRef; idempotencyKey: string
}>
const key = (value: Key) => value as Parameters<typeof SfStatePanel>[0]["messageKey"]
const tableKey = (value: Key) => value as unknown as SfTableCopyKey
const message = (value: Key) => ({ key: key(value) })
const dataText = (text: string) => ({ kind: "data", text } as const)
const editScope = "vendor-contract-fields" as SfEditScopeKey
const FIELDS = [
  "vendor", "num", "name", "desc", "category", "owner", "start", "end",
  "amount", "amtType", "renewal", "renewType", "notice", "eval", "notes",
] as const satisfies readonly (keyof SfVendorEdit)[]
type Field = (typeof FIELDS)[number]
const EDIT_SECTIONS: readonly { id: string; title: Key; fields: readonly Field[] }[] = [
  { id: "general", title: "sf.u15.general", fields: ["vendor", "num", "name", "desc", "category", "owner"] },
  { id: "commercial", title: "sf.u15.commercial", fields: ["amount", "amtType"] },
  { id: "terms", title: "sf.u15.terms", fields: ["start", "end", "renewal", "renewType", "notice"] },
  { id: "evaluation", title: "sf.u15.evaluation", fields: ["eval"] },
  { id: "notes", title: "sf.u15.notes", fields: ["notes"] },
]
function fieldKey(field: Field): Key { return ("sf.u15.field." + field) as Key }
function editFields(values: SfVendorEdit, locale: string, currency: SfVendorContract["currency"]): readonly SfReviewField[] {
  return FIELDS.map<SfReviewField>((field) => {
    const value = values[field]
    const option = field === "amtType" && ["total", "monthly", "annual"].includes(String(value)) ||
      field === "renewType" && ["fixed", "na", "auto"].includes(String(value))
    return {
      path: field, label: message(fieldKey(field)),
      value: value === null || value === undefined
        ? { kind: "missing" as const, reason: message("sf.u15.reviewMissing") }
        : { kind: "text" as const, text: value === ""
          ? { kind: "message" as const, message: message("sf.u15.emptyValue") }
          : option ? { kind: "message" as const, message: message(("sf.u15.option." + value) as Key) }
            : dataText(field === "amount" ? vendorAmountText(value, locale) + (currency ? " · " + currency : "") : String(value)) },
    }
  }).concat([{
    path: "currency", label: message("sf.u15.field.currency"),
    value: currency === undefined || currency === null
      ? { kind: "missing", reason: message("sf.u15.noCurrency") }
      : { kind: "text", text: currency === ""
        ? { kind: "message", message: message("sf.u15.emptyValue") } : dataText(currency) },
  }])
}
function safeField(row: SfVendorContract, field: keyof SfVendorContract): string {
  const value = row[field]
  return value === null || value === undefined ? "" : String(value)
}
function editableVendor(values: SfVendorEdit): boolean {
  if (!values.vendor?.trim()) return false
  if (values.amount !== undefined && values.amount !== null && values.amount !== "" &&
      (!Number.isFinite(Number(values.amount)) || Number(values.amount) < 0)) return false
  return true
}

/** CAP14 consumes the A01 dashboard producer. It is not a second Procurement API. */
export function SfVendorContractsPage(props: SfSurfaceProps<"CAP14">) {
  const sf = useSfContext()
  const language = useLanguage()
  const navigate = useNavigate()
  const inputId = createUniqueId()
  const [view, setView] = createStore({
    state: "loading" as SfUiState,
    read: undefined as Ready | undefined,
    selected: undefined as SfRef | undefined,
    creating: false,
    editing: false,
    filter: "",
    sort: { kind: "none" } as SfSort,
    refresh: 0,
    reviewing: undefined as Review | undefined,
    sending: false,
    outcomeUnknown: false,
    notice: undefined as Key | undefined,
    newIntentRef: crypto.randomUUID() as SfIntentRef,
    layoutMode: "split" as "single" | "split" | "split-context",
  })
  let stage: HTMLDivElement | undefined
  let inFlight: AbortController | undefined
  const t = (value: Key) => language.t(value as Parameters<typeof language.t>[0])
  const optionText = (value: string) => value === "total" ? t("sf.u15.option.total") :
    value === "monthly" ? t("sf.u15.option.monthly") : value === "annual" ? t("sf.u15.option.annual") :
    value === "fixed" ? t("sf.u15.option.fixed") : value === "na" ? t("sf.u15.option.na") :
    value === "auto" ? t("sf.u15.option.auto") : value
  const readField = (row: SfVendorContract, field: Field) => {
    const value = row[field]
    if (field === "amount") return vendorAmountText(value, language.intl())
    return field === "amtType" || field === "renewType" ? optionText(safeField(row, field)) : safeField(row, field)
  }
  const routeRef = () =>
    (props.route.kind === "detail" || props.route.kind === "edit") ? props.route.params.contractRef : undefined
  const selectedRef = () => routeRef() ?? view.selected
  const creating = () => props.route.kind === "new" || view.creating
  const editing = () => creating() || props.route.kind === "edit" || view.editing
  const contextActions = () =>
    sf.ready()?.context.destinations.find((entry) => entry.capabilityId === "CAP14" && entry.canRead)?.allowedActionIds ?? []
  const actionAllowed = (action: SfVendorAction) =>
    !!view.read && vendorAuthorizedAction(contextActions(), view.read.actionIds, action)
  const selectedRow = createMemo(() =>
    view.read?.records.find((row) => vendorRef(row) === selectedRef()),
  )
  const sourceCurrency = () => {
    const value = selectedRow()?.currency
    return value === undefined || value === null ? t("sf.u15.noCurrency") : value === "" ? t("sf.u15.emptyValue") : value
  }
  const currentVersion = () => {
    const ref = selectedRef()
    return ref && view.read ? vendorVersion(view.read, ref) : undefined
  }
  const assetTarget = createMemo(() => {
    const row = selectedRow()
    const ref = selectedRef()
    const version = currentVersion()
    return row && ref && version !== undefined ? { row, ref, version } : undefined
  })
  const sourceAvailable = () => !!view.read && view.state === "ready"
  createEffect(() => {
    const selected = selectedRef()
    const mode = view.reviewing ? "review" : editing() ? "edit" : "detail"
    if (!sourceAvailable() || (!selected && !creating())) return
    queueMicrotask(() => {
      if (mode !== (view.reviewing ? "review" : editing() ? "edit" : "detail")) return
      stage?.querySelector<HTMLElement>(".sf-u15-detail-head h2")?.focus()
    })
  })
  const sameOwner = (ownerKey: string, epoch: number) => {
    const current = sf.state()
    return sf.generation() === epoch && current.status === "ready" && current.ownerKey === ownerKey
  }
  const buildHref = (ref?: SfRef, suffix: "" | "edit" = "") => {
    // Preserve only the F01-approved owner selection. Never put business data in URLs.
    const url = new URL(props.route.href, "http://orchestra.invalid")
    const query = new URLSearchParams()
    for (const name of ["server", "project", "installation"])
      if (url.searchParams.has(name)) query.set(name, url.searchParams.get(name)!)
    const item = ref ? "/" + encodeSfRouteRef(ref) : ""
    const extra = suffix ? "/edit" : ""
    return "/orchestra/sf-procurement/contracts" + item + extra + (query.size ? "?" + query.toString() : "")
  }

  createEffect(() => {
    const status = sf.state()
    const ready = sf.ready()
    const epoch = sf.generation()
    void view.refresh
    setView({ read: undefined, state: "loading", reviewing: undefined, sending: false, notice: undefined })
    if (status.status !== "ready" || !ready) {
      setView("state", status.status === "denied" ? "denied" :
        status.status === "unauthenticated" ? "session-expired" : "unavailable")
      return
    }
    if (!ready.context.destinations.some((entry) => entry.capabilityId === "CAP14" && entry.canRead)) {
      setView("state", "denied")
      return
    }
    const abort = new AbortController()
    const ownerKey = status.ownerKey
    const client = createSfDomainClient(ready.transport)
    void client["domain.page.CAP14"]({}, { signal: abort.signal })
      .then((result) => {
        if (abort.signal.aborted || !sameOwner(ownerKey, epoch)) return
        if (result.kind !== "response") { setView("state", "unavailable"); return }
        if (result.status === 401) { setView("state", "session-expired"); void sf.reload(); return }
        if (result.status === 403) { setView("state", "denied"); sf.invalidate("revoked"); return }
        const decoded = decodeVendorContractsPage(result.body, ready.context.stamp)
        if (decoded.kind !== "ready") {
          setView("state", decoded.kind === "unauthenticated" ? "session-expired" :
            decoded.kind === "invalid" ? "invalid" : decoded.kind)
          if (decoded.kind === "denied") sf.invalidate("revoked")
          return
        }
        setView({ read: decoded, state: "ready" })
        const ref = selectedRef()
        const row = ref && decoded.records.find((item) => vendorRef(item) === ref)
        if (ref && !row) setView("state", "unavailable") // absence is not a confirmed deletion
      })
      .catch((error) => {
        if (abort.signal.aborted || sf.generation() !== epoch) return
        console.error("CAP14 authorized read failed", error)
        setView("state", "unavailable")
      })
    onCleanup(() => abort.abort())
  })

  createEffect(() => {
    void sf.generation()
    onCleanup(() => inFlight?.abort())
  })
  onCleanup(() => inFlight?.abort())

  const draft = createMemo(() => {
    if (!sourceAvailable() || sf.state().status !== "ready" || !sf.ready() ||
        !actionAllowed("save")) return undefined
    const row = selectedRow()
    const ref = selectedRef()
    const version = currentVersion()
    if (!creating() && (!row || !ref || version === undefined)) return undefined
    const original = row ? vendorEditFromRecord(row) : vendorEditFromRecord()
    return sf.ready()!.drafts.acquire<SfVendorEdit>({
      surfaceId: "CAP14",
      identity: creating() ? { kind: "new", newIntentRef: view.newIntentRef } :
        { kind: "record", recordRef: ref! },
      editScopeKey: editScope,
      baseVersion: creating() ? null : version!,
      base: creating() ? null : original,
      value: original,
      revalidation: {
        operationId: "domain.page.CAP14",
        input: {},
        fieldPaths: row ? FIELDS.filter((field) => row[field] !== undefined) : [],
        actionIds: ["save"],
      },
    })
  })
  const snapshot = createMemo(() => draft()?.snapshot())
  const activeDraft = (): Extract<SfDraftState<SfVendorEdit>, { availability: "active" }> | undefined => {
    const current = snapshot()
    return current?.availability === "active" ? current : undefined
  }
  const setField = (field: Field, value: SfVendorEdit[Field]) => {
    const current = activeDraft()
    if (current && !view.sending && !view.reviewing && !view.outcomeUnknown)
      draft()?.edit({ ...current.value, [field]: value })
  }

  const filteredRows = createMemo(() => {
    const query = view.filter.trim().toLocaleLowerCase(language.intl())
    let records = (view.read?.records ?? []).filter((row) =>
      !query || ["vendor", "num", "name", "category", "owner"].some(
        (field) => safeField(row, field as keyof SfVendorContract).toLocaleLowerCase(language.intl()).includes(query),
      ),
    )
    if (view.sort.kind === "field") {
      const { key: field, direction } = view.sort
      records = [...records].sort((a, b) => safeField(a, field as keyof SfVendorContract)
        .localeCompare(safeField(b, field as keyof SfVendorContract), language.intl()) * (direction === "asc" ? 1 : -1))
    }
    return records
  })
  const columns: readonly SfColumn<SfVendorContract>[] = [
    { id: "vendor", labelKey: tableKey("sf.u15.field.vendor"), align: "start", sortKey: "vendor",
      widthPolicy: { kind: "flex", minPx: 130, weight: 3 }, render: (row) => <span>{safeField(row, "vendor")}</span> },
    { id: "num", labelKey: tableKey("sf.u15.field.num"), align: "start", sortKey: "num",
      widthPolicy: { kind: "content", minPx: 90, maxPx: 190 }, render: (row) => <><span class="sf-u15-cell-label" aria-hidden="true">{t("sf.u15.field.num")}</span><span>{safeField(row, "num") || <span class="sf-u15-missing" aria-label={t("sf.u15.missing")}>—</span>}</span></> },
    { id: "name", labelKey: tableKey("sf.u15.field.name"), align: "start", sortKey: "name",
      widthPolicy: { kind: "flex", minPx: 130, weight: 2 }, render: (row) => <><span class="sf-u15-cell-label" aria-hidden="true">{t("sf.u15.field.name")}</span><span>{safeField(row, "name") || <span class="sf-u15-missing" aria-label={t("sf.u15.missing")}>—</span>}</span></> },
    { id: "end", labelKey: tableKey("sf.u15.field.end"), align: "start", sortKey: "end",
      widthPolicy: { kind: "content", minPx: 96, maxPx: 160 }, render: (row) => <><span class="sf-u15-cell-label" aria-hidden="true">{t("sf.u15.field.end")}</span><span class="sf-u15-date">{safeField(row, "end") || <span class="sf-u15-missing" aria-label={t("sf.u15.missing")}>—</span>}</span></> },
  ]

  const beginReview = (action: SfVendorAction) => {
    const row = selectedRow()
    const ref = selectedRef()
    const version = action === "save" && creating() ? 0 : currentVersion()
    const current = activeDraft()
    if (!sourceAvailable() || view.sending || view.outcomeUnknown ||
        !actionAllowed(action) || version === undefined ||
        (action === "delete" && (!ref || !row)) ||
        (action === "save" && (!current || !editableVendor(current.value)))) {
      if (action === "save" && current && !editableVendor(current.value))
        setView("notice", current.value.vendor?.trim() ? "sf.u15.validationAmount" : "sf.u15.validationVendor")
      else setView("notice", "sf.u15.missingVersion")
      return
    }
    const values = action === "save" ? { ...current!.value } : vendorEditFromRecord(row)
    setView({
      reviewing: {
        action, ref: creating() && action === "save" ? undefined : ref,
        version, values,
        intentRef: crypto.randomUUID() as SfIntentRef,
        operationRef: crypto.randomUUID() as SfOperationRef,
        idempotencyKey: crypto.randomUUID(),
      },
      notice: undefined,
    })
    draft()?.setPhase("reviewing")
  }

  const refresh = () => {
    // A fresh authorized read is reconciliation only, never a replay.
    setView({ refresh: view.refresh + 1, outcomeUnknown: false })
  }
  const confirm = async () => {
    const review = view.reviewing
    const ready = sf.ready()
    const actor = sf.state()
    const current = activeDraft()
    if (!review || !ready || actor.status !== "ready" ||
        !sourceAvailable() || view.sending || view.outcomeUnknown ||
        !actionAllowed(review.action) ||
        (review.ref && vendorVersion(view.read!, review.ref) !== review.version) ||
        (review.action === "save" && (!current || JSON.stringify(current.value) !== JSON.stringify(review.values) ||
          (review.ref && current.baseVersion !== review.version)))) return

    const ownerKey = actor.ownerKey
    const epoch = sf.generation()
    const requestBody = review.action === "save"
      ? vendorCommandInput("save", review.ref, review.version, review.values)
      : vendorCommandInput("delete", review.ref!, review.version, review.values)
    const abort = new AbortController()
    inFlight = abort
    setView("sending", true)
    // The local correlation digest is not a producer receipt or approval.
    let digest = ""
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(requestBody))
      const hash = await crypto.subtle.digest("SHA-256", bytes)
      digest = [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
    } catch (error) {
      console.error("CAP14 intent digest failed", error)
      setView({ sending: false, reviewing: undefined, state: "unavailable" })
      return
    }
    if (!sameOwner(ownerKey, epoch) || abort.signal.aborted) return
    draft()?.setPending({ operationRef: review.operationRef, idempotencyKey: review.idempotencyKey,
      payloadDigest: digest, expectedVersion: review.ref ? review.version : null })
    draft()?.setPhase("submitting")
    const client = createSfDomainClient(ready.transport)
    try {
      const result = review.action === "save"
        ? await client["domain.command.CAP14.save"](requestBody as SfVendorSave, {
          signal: abort.signal, idempotencyKey: review.idempotencyKey,
        })
        : await client["domain.command.CAP14.delete"](
          vendorCommandInput("delete", review.ref!, review.version, review.values),
          { signal: abort.signal, idempotencyKey: review.idempotencyKey },
        )
      if (!sameOwner(ownerKey, epoch)) return
      if (result.kind !== "response") {
        const uncertain = !["contract-unavailable", "contract-mismatch"].includes(result.reason)
        draft()?.setPhase(uncertain ? "outcome-unknown" : "failed")
        setView({ sending: false, outcomeUnknown: uncertain, notice: uncertain ?
          "sf.u15.outcomeUnknown" : "sf.u15.notAvailable", reviewing: undefined })
        return
      }
      if (result.status === 401 || result.status === 403) {
        setView({ sending: false, read: undefined, state: result.status === 401 ? "session-expired" : "denied", reviewing: undefined })
        if (result.status === 403) sf.invalidate("revoked")
        else void sf.reload()
        return
      }
      if (result.status === 409) {
        draft()?.setPhase("conflict")
        setView({ sending: false, state: "conflict", reviewing: undefined, notice: "sf.u15.missingVersion" })
        return
      }
      if (result.status < 200 || result.status >= 300 || result.body.ok !== true) {
        draft()?.setPhase("failed")
        setView({ sending: false, reviewing: undefined, notice: "sf.u15.notAvailable" })
        return
      }
      const reread = await client["domain.page.CAP14"]({}, { signal: abort.signal })
      if (!sameOwner(ownerKey, epoch)) return
      const next = reread.kind === "response" && reread.status === 200
        ? decodeVendorContractsPage(reread.body, ready.context.stamp) : { kind: "unavailable" as const }
      const observed = next.kind === "ready" && review.ref
        ? next.records.find((row) => vendorRef(row) === review.ref) : undefined
      const nextVersion = next.kind === "ready" && review.ref ? vendorVersion(next, review.ref) : undefined
      const verified = review.action === "save" && review.ref && observed &&
        nextVersion !== undefined && nextVersion > review.version
      if (next.kind === "ready") setView({ read: next, state: "ready" })
      if (verified) {
        draft()?.confirmSave({
          kind: "projected", operationRef: review.operationRef,
          baseVersion: nextVersion!, value: vendorEditFromRecord(observed),
        })
        setView({ selected: review.ref, creating: false, notice: "sf.u15.saved" })
      } else {
        // The page projection alone does not prove a delete (redaction/filter
        // may hide the record); retain an accepted-only state pending receipt.
        // Likewise, do not guess the ID of a new contract.
        if (review.action === "save") draft()?.confirmSave({
          kind: "confirmed-without-projection", operationRef: review.operationRef, resultVersion: null,
        })
        setView("notice", "sf.u15.acceptedNoProjection")
      }
      setView({ sending: false, reviewing: undefined })
    } catch (error) {
      if (sameOwner(ownerKey, epoch)) {
        console.error("CAP14 result unknown after dispatch", error)
        draft()?.setPhase("outcome-unknown")
        setView({ sending: false, reviewing: undefined, outcomeUnknown: true, notice: "sf.u15.outcomeUnknown" })
      }
    } finally {
      if (inFlight === abort) inFlight = undefined
    }
  }

  const renderField = (field: Field) => {
    const current = activeDraft()
    const value = current?.value[field]
    const choices = field === "amtType" ? ["total", "monthly", "annual"] as const :
      field === "renewType" ? ["fixed", "na", "auto"] as const :
      field === "eval" ? ["", "A", "B", "C", "D"] as const : undefined
    const label = t(fieldKey(field))
    const disabled = view.sending || !!view.reviewing || view.outcomeUnknown || !current
    return <label class="sf-u15-field" data-field={field}>

      <span>{label}<Show when={field === "vendor"}><span aria-hidden="true"> *</span></Show></span>
      <Show when={choices} fallback={
        field === "desc" || field === "notes" ?
          <textarea rows={3} aria-label={label} disabled={disabled} value={value == null ? "" : String(value)}
            onInput={(event) => setField(field, event.currentTarget.value)} /> :
          <input aria-label={label}
            type={field === "start" || field === "end" || field === "renewal" ? "date" :
              field === "amount" ? "number" : "text"}
            step={field === "amount" ? "any" : undefined}
            required={field === "vendor"} disabled={disabled}
            value={value == null ? "" : String(value)}
            onInput={(event) => setField(field, field === "amount" && event.currentTarget.value === "" ? null : event.currentTarget.value)} />
      }>
        {(items) => <select aria-label={label} disabled={disabled} value={value == null ? "" : String(value)}
          onChange={(event) => setField(field, event.currentTarget.value)}>
          <For each={items()}>{(option) => <option value={option}>
            {field === "eval" ? option || "—" : t(("sf.u15.option." + option) as Key)}
          </option>}</For>
        </select>}
      </Show>
    </label>
  }

  const fieldReview = () => {
    const review = view.reviewing
    if (!review) return null
    const ref = review.ref
    const base = selectedRow()
    const original: SfReviewSnapshot | null = base && ref
      ? { kind: "persisted", ref, version: review.version,
        fields: editFields(vendorEditFromRecord(base), language.intl(), base.currency) } : null
    const actionKey = review.action === "save" ? "sf.u15.save" : "sf.u15.delete"
    const fields = review.action === "delete"
      ? editFields(vendorEditFromRecord(base), language.intl(), base?.currency) : editFields(review.values, language.intl(), base?.currency)
    return <fieldset class="sf-u15-review-controls" disabled={view.sending || view.outcomeUnknown}
      aria-label={t("sf.u15.reviewScope")}>
      <p class="sf-u15-field-hint" data-sf-currency>{t("sf.u15.field.currency")}: <bdi>{sourceCurrency()}</bdi></p>
      <SfChangeReview
      operation={{ ref: review.operationRef, label: message(actionKey), scope: dataText(t("sf.u15.reviewScope")) }}
      base={original} current={original}
      proposed={{ kind: "draft", intentRef: review.intentRef, sourceRef: ref ?? null,
        sourceVersion: ref ? review.version : null, fields }}
      effects={[{ id: review.action, domain: "dashboard", title: { kind: "message", message: message(actionKey) },
        state: "proposed", details: fields }]}
      coverage={{ state: "complete", summary: message("sf.u15.reviewSummary"),
        reasons: [], knownCount: fields.length, expectedCount: fields.length }}
      blockingReasons={[]}
      confirmation={{ kind: "admitted", labelKey: key(actionKey),
        purpose: review.action, binding: { kind: "catalog-command",
          operationId: review.action === "save" ? "domain.command.CAP14.save" : "domain.command.CAP14.delete",
          version: { kind: "record", expectedVersion: review.version },
          confirmation: "presentation-only" } }}
      state={view.sending ? "loading" : "ready"}
      onConfirm={() => { void confirm() }}
      onRevise={() => {
        if (view.sending || view.outcomeUnknown) return
        draft()?.setPhase("dirty"); setView("reviewing", undefined)
      }}
      onCancel={() => {
        if (view.sending || view.outcomeUnknown) return
        draft()?.setPhase("dirty"); setView("reviewing", undefined)
      }}
    /></fieldset>
  }

  return <section data-component="sf-vendor-contracts" data-sf-surface="CAP14" aria-busy={view.sending}>
    <SfPageFrame
      titleKey={key("sf.cap14.title")}
      context={[]} tabs={[]} activeTab={null}
      primaryAction={actionAllowed("save") && !selectedRow() && !creating() ? {
        id: "new", labelKey: key("sf.cap14.primary"), tone: "primary",
        disabled: view.sending || view.outcomeUnknown, busy: view.sending,
        onInvoke: () => {
          setView({ creating: true, selected: undefined, editing: true,
            newIntentRef: crypto.randomUUID() as SfIntentRef, reviewing: undefined })
        },
      } : undefined}
      secondaryActions={[]} density="comfortable" layout="reading"
      onLayoutMode={(mode) => setView("layoutMode", mode)}
    >
      <Show when={view.state === "ready" && view.read !== undefined} fallback={
        <SfStatePanel state={view.state} messageKey={key("sf.u15.notAvailable")}
          onRetryRead={view.state === "denied" ? undefined : refresh} />
      }>
        <div class="sf-u15-layout" data-sf-wave="three" ref={stage}>
          <section class="sf-u15-list" hidden={Boolean(selectedRow() || creating() || view.reviewing)} aria-labelledby={inputId + "-list"}>
            <header class="sf-u15-list-head">
              <div><div class="sf-u15-title-row"><h2 id={inputId + "-list"}>{t("sf.u15.list")}</h2>
                <span class="sf-u15-count" aria-label={t("sf.u15.records")}>{filteredRows().length}</span></div>
                <p>{t("sf.u15.listHint")}</p></div>
              <div class="sf-u15-filters">
                <label for={inputId}>{t("sf.u15.filter")}</label>
                <div class="sf-u15-search-control"><Icon name="magnifying-glass" size="small" />
                  <span class="sf-u15-sr" id={inputId + "-search-hint"}>{t("sf.u15.filterPlaceholder")}</span>
                  <input id={inputId} type="search" placeholder={t("sf.u15.filter")} aria-describedby={inputId + "-search-hint"}
                    value={view.filter} onInput={(event) => setView("filter", event.currentTarget.value)} />
                  <Show when={view.filter}><button type="button" class="mx-btn" aria-label={t("sf.u15.clearFilter")}
                    onClick={() => setView("filter", "")}><Icon name="close-small" size="small" /></button></Show>
                </div>
              </div>
            </header>
            <SfDataTable rows={filteredRows()} getRowKey={vendorRef} columns={columns}
              selectedKey={selectedRef()} sort={view.sort} page={{ kind: "none", total: filteredRows().length }}
              onSort={(sort) => setView("sort", sort)} onPage={() => undefined}
              onSelect={(ref) => setView({ selected: ref, creating: false, editing: false, reviewing: undefined })}
              rowActions={() => []} onRowAction={() => undefined}
              captionKey={tableKey("sf.u15.list")} density="comfortable"
              state={filteredRows().length ? "ready" : view.read?.records.length ? "filtered-empty" : "empty"} />
          </section>
          <Show when={selectedRow() || creating()}>
            <section class="sf-u15-detail" data-sf-contract-stage={view.reviewing ? "review" : editing() ? "edit" : "detail"}>
              <header class="sf-u15-detail-head">
                <div class="sf-u15-detail-nav" hidden={Boolean(view.reviewing)}>
                  <button type="button" class="mx-btn" disabled={view.sending || view.outcomeUnknown || Boolean(editing() && activeDraft()?.dirty)}
                    onClick={() => {
                      if (routeRef() || props.route.kind === "new") navigate(buildHref())
                      else setView({ selected: undefined, creating: false, editing: false })
                    }}><Icon name="arrow-left" size="small" />{t("sf.u15.back")}</button>
                  <Show when={!editing() && actionAllowed("save") && currentVersion() !== undefined}>
                    <button type="button" class="mx-btn primary" disabled={view.sending || view.outcomeUnknown}
                      onClick={() => navigate(buildHref(selectedRef(), "edit"))}>{t("sf.u15.edit")}</button>
                  </Show>
                </div>
                <h2 tabindex="-1">{view.reviewing ? t("sf.u15.reviewTitle") : creating() ? t("sf.cap14.primary") :
                  editing() ? t("sf.u15.edit") : safeField(selectedRow()!, "vendor")}</h2>
                <Show when={editing() && !view.reviewing}><p>{t("sf.u15.editHint")}</p></Show>
                <Show when={selectedRow() && selectedRef()}>
                  <details class="sf-u15-source">
                    <summary>{t("sf.u15.sourceDetails")}<Icon name="chevron-down" size="small" /></summary>
                    <dl><div><dt>{t("sf.u15.contractId")}</dt><dd><code>{selectedRef()}</code></dd></div>
                      <div><dt>{t("sf.u15.version")}</dt><dd>{currentVersion() ?? "—"}</dd></div></dl>
                    <a href={buildHref(selectedRef())}>{t("sf.u15.open")}</a>
                  </details>
                </Show>
              </header>
              <Show when={sourceAvailable() && (creating() || selectedRow())}>
                <Show when={activeDraft()}>
                  <form class="sf-u15-edit" hidden={!editing() || Boolean(view.reviewing)}
                    aria-label={t(creating() ? "sf.cap14.primary" : "sf.u15.edit")}
                    onSubmit={(event) => { event.preventDefault(); beginReview("save") }}>
                    <p class="sf-u15-field-hint">{t("sf.u15.requiredHint")}</p>
                    <For each={EDIT_SECTIONS}>{(section) => <fieldset data-sf-section={section.id}>
                      <legend>{t(section.title)}</legend>
                      <div class="sf-u15-fields"><For each={section.fields}>{(field) => renderField(field)}</For></div>
                      <Show when={section.id === "commercial"}>
                        <p class="sf-u15-field-hint" data-sf-currency>{t("sf.u15.field.currency")}: <bdi>{sourceCurrency()}</bdi></p>
                      </Show>
                    </fieldset>}</For>
                    <div class="sf-u15-actions">
                      <button type="submit" class="mx-btn primary" disabled={view.sending || view.outcomeUnknown ||
                        !!view.reviewing || !activeDraft() || !editableVendor(activeDraft()!.value)}>{t("sf.u15.reviewSave")}</button>
                      <button type="button" class="mx-btn" disabled={view.sending || view.outcomeUnknown}
                        onClick={() => {
                          draft()?.discard()
                          setView({ reviewing: undefined, creating: false, editing: false })
                          if (props.route.kind === "edit" || props.route.kind === "new") navigate(buildHref(selectedRef()))
                        }}>{t("sf.u15.discard")}</button>
                    </div>
                  </form>
                </Show>
                <Show when={!creating() && !!selectedRow()}>
                  <div class="sf-u15-read" hidden={editing() || Boolean(view.reviewing)}>
                    <For each={EDIT_SECTIONS}>{(section) => <section data-sf-section={section.id}>
                      <h3>{t(section.title)}</h3>
                      <dl><For each={section.fields}>{(field) =>
                        <div data-sf-field={field}><dt>{t(fieldKey(field))}</dt>
                          <dd><Show when={safeField(selectedRow()!, field) !== ""} fallback={
                            <span class="sf-u15-missing" data-sf-value="missing"><span aria-hidden="true">—</span><span class="sf-u15-sr">{t("sf.u15.missing")}</span></span>
                          }><bdi>{readField(selectedRow()!, field)}</bdi></Show></dd>
                        </div>
                      }</For>
                        <Show when={section.id === "commercial"}>
                          <div data-sf-field="currency"><dt>{t("sf.u15.field.currency")}</dt>
                            <dd><bdi>{sourceCurrency()}</bdi></dd></div>
                        </Show>
                      </dl>
                    </section>}</For>
                    <section>
                      <h3>{t("sf.u15.documents")}</h3>
                      <Show when={assetTarget()} fallback={<p>{t("sf.u15.noDocuments")}</p>}>
                        {(target) => <SfBoundAssets surface="dashboard" page="Vendor Contracts"
                          uploadKind={actionAllowed("save") ? "contract" : undefined}
                          recordRef={target().ref} recordVersion={target().version} assets={target().row.docs ?? []}
                          disabled={view.sending || view.outcomeUnknown || !!view.reviewing || !sourceAvailable() || !actionAllowed("save")}
                          onReconcile={refresh} />}
                      </Show>
                    </section>
                    <section>
                      <h3>{t("sf.u15.link")}</h3>
                      <Show when={assetTarget()} fallback={<p>{t("sf.u15.unavailableLink")}</p>}>
                        {(target) => <SfContractRequestLinks contractRef={target().ref} contractVersion={target().version}
                          routeHref={props.route.href} disabled={view.sending || view.outcomeUnknown || !!view.reviewing || !sourceAvailable()} />}
                      </Show>
                    </section>
                    <Show when={actionAllowed("delete") && currentVersion() !== undefined}>
                      <footer class="sf-u15-actions"><button type="button" class="mx-btn danger"
                        disabled={view.sending || view.outcomeUnknown}
                        onClick={() => beginReview("delete")}>{t("sf.u15.reviewDelete")}</button></footer>
                    </Show>
                  </div>
                </Show>
              </Show>
              <div class="sf-u15-review" hidden={!view.reviewing}>{fieldReview()}</div>
            </section>
          </Show>
        </div>
      </Show>
      <Show when={view.notice}>
        {(value) => <p role={view.outcomeUnknown ? "alert" : "status"} class="sf-u15-notice">{t(value())}
          <button type="button" class="mx-btn" onClick={refresh}>{t("sf.u15.retry")}</button>
        </p>}
      </Show>
    </SfPageFrame>
  </section>
}

/** I00 public U15 entrypoint; CAP14 is the only admitted surface. */
export function SfContractsView(props: SfSurfaceProps) {
  if (props.surfaceId !== "CAP14")
    return <SfStatePanel state="invalid" messageKey={key("sf.u15.invalid")} />
  return <SfVendorContractsPage {...props} />
}
