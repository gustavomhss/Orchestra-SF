import { createEffect, createMemo, createUniqueId, For, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import type { SfEditScopeKey, SfIntentRef, SfOperationRef, SfRef } from "@orchestra/schema/sucafina/context"
import type { SfSurfaceProps } from "../../context/contracts"
import { useSfContext } from "../../context"
import { encodeSfRouteRef } from "../../navigation-state"
import { SfPageFrame } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { SfDataTable, type SfColumn, type SfSort, type SfUiState } from "../../shared/table"
import { SfChangeReview, type SfReviewField, type SfReviewSnapshot } from "../../shared/change-review"
import type { SfDraftState } from "../../shared/draft"
import { SF_U15_COPY } from "@/i18n/orchestra-chapters/sf-u15"
import {
  decodeVendorContractsPage, vendorAuthorizedAction, vendorCommandInput,
  vendorEditFromRecord, vendorRef, vendorVersion,
  type SfVendorAction, type SfVendorContract, type SfVendorEdit, type SfVendorRead,
} from "./model"
import "./contracts.css"

type Key = keyof typeof SF_U15_COPY
type Ready = Extract<SfVendorRead, { kind: "ready" }>
type Review = Readonly<{
  action: SfVendorAction; ref: SfRef | undefined; version: number; values: SfVendorEdit
  intentRef: SfIntentRef; operationRef: SfOperationRef; idempotencyKey: string
}>
const key = (value: Key) => value as Parameters<typeof SfStatePanel>[0]["messageKey"]
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
function editFields(values: SfVendorEdit): readonly SfReviewField[] {
  return FIELDS.map((field) => {
    const value = values[field]
    return {
      path: field, label: message(fieldKey(field)),
      value: value === null || value === undefined
        ? { kind: "missing" as const, reason: message("sf.u15.notAvailable") }
        : { kind: "text" as const, text: dataText(String(value)) },
    }
  })
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
function sameOwnerStamp(ready: ReturnType<typeof useSfContext>["ready"], epoch: number, sf: ReturnType<typeof useSfContext>, ownerKey: string) {
  return sf.generation() === epoch && sf.state().status === "ready" &&
    sf.state().ownerKey === ownerKey && sf.ready() === ready()
}

/** CAP14 consumes the A01 dashboard producer. It is not a second Procurement API. */
export function SfVendorContractsPage(props: SfSurfaceProps<"CAP14">) {
  const sf = useSfContext()
  const language = useLanguage()
  const inputId = createUniqueId()
  const [view, setView] = createStore({
    state: "loading" as SfUiState,
    read: undefined as Ready | undefined,
    selected: undefined as SfRef | undefined,
    creating: false,
    filter: "",
    sort: { kind: "none" } as SfSort,
    refresh: 0,
    reviewing: undefined as Review | undefined,
    sending: false,
    outcomeUnknown: false,
    notice: undefined as Key | undefined,
    newIntentRef: crypto.randomUUID() as SfIntentRef,
  })
  let inFlight: AbortController | undefined
  const t = (value: Key) => language.t(value as Parameters<typeof language.t>[0])
  const routeRef = () =>
    (props.route.kind === "detail" || props.route.kind === "edit") ? props.route.params.contractRef : undefined
  const selectedRef = () => routeRef() ?? view.selected
  const creating = () => props.route.kind === "new" || view.creating
  const contextActions = () =>
    sf.ready()?.context.destinations.find((entry) => entry.capabilityId === "CAP14" && entry.canRead)?.allowedActionIds ?? []
  const actionAllowed = (action: SfVendorAction) =>
    !!view.read && vendorAuthorizedAction(contextActions(), view.read.actionIds, action)
  const selectedRow = createMemo(() =>
    view.read?.records.find((row) => vendorRef(row) === selectedRef()),
  )
  const currentVersion = () => {
    const ref = selectedRef()
    return ref && view.read ? vendorVersion(view.read, ref) : undefined
  }
  const state = () => sf.state().status
  const sourceAvailable = () => !!view.read && view.state === "ready"
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
        if (abort.signal.aborted || sf.generation() !== epoch || sf.state().status !== "ready" ||
            sf.state().ownerKey !== ownerKey) return
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
    { id: "vendor", labelKey: key("sf.u15.field.vendor"), align: "start", sortKey: "vendor",
      widthPolicy: { kind: "flex", minPx: 130, weight: 3 }, render: (row) => <span>{safeField(row, "vendor")}</span> },
    { id: "num", labelKey: key("sf.u15.field.num"), align: "start", sortKey: "num",
      widthPolicy: { kind: "content", minPx: 90, maxPx: 190 }, render: (row) => <span>{safeField(row, "num")}</span> },
    { id: "name", labelKey: key("sf.u15.field.name"), align: "start", sortKey: "name",
      widthPolicy: { kind: "flex", minPx: 130, weight: 2 }, render: (row) => <span>{safeField(row, "name")}</span> },
    { id: "end", labelKey: key("sf.u15.field.end"), align: "start", sortKey: "end",
      widthPolicy: { kind: "content", minPx: 96, maxPx: 160 }, render: (row) => <span>{safeField(row, "end")}</span> },
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
    if (sf.generation() !== epoch || sf.state().status !== "ready" ||
        sf.state().ownerKey !== ownerKey || abort.signal.aborted) return
    draft()?.setPending({ operationRef: review.operationRef, idempotencyKey: review.idempotencyKey,
      payloadDigest: digest, expectedVersion: review.ref ? review.version : null })
    draft()?.setPhase("submitting")
    const client = createSfDomainClient(ready.transport)
    try {
      const result = review.action === "save"
        ? await client["domain.command.CAP14.save"](requestBody as ReturnType<typeof vendorCommandInput<"save">>, {
          signal: abort.signal, idempotencyKey: review.idempotencyKey,
        })
        : await client["domain.command.CAP14.delete"](
          vendorCommandInput("delete", review.ref!, review.version, review.values),
          { signal: abort.signal, idempotencyKey: review.idempotencyKey },
        )
      if (sf.generation() !== epoch || sf.state().status !== "ready" ||
          sf.state().ownerKey !== ownerKey) return
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
      if (sf.generation() !== epoch || sf.state().status !== "ready" ||
          sf.state().ownerKey !== ownerKey) return
      const next = reread.kind === "response" && reread.status === 200
        ? decodeVendorContractsPage(reread.body, ready.context.stamp) : { kind: "unavailable" as const }
      const observed = next.kind === "ready" && review.ref
        ? next.records.find((row) => vendorRef(row) === review.ref) : undefined
      const nextVersion = next.kind === "ready" && review.ref ? vendorVersion(next, review.ref) : undefined
      const verified = review.action === "save" && review.ref && observed &&
        nextVersion !== undefined && nextVersion > review.version
      const deleted = review.action === "delete" && review.ref && next.kind === "ready" &&
        !next.records.some((row) => vendorRef(row) === review.ref)
      if (next.kind === "ready") setView({ read: next, state: "ready" })
      if (verified) {
        draft()?.confirmSave({
          kind: "projected", operationRef: review.operationRef,
          baseVersion: nextVersion!, value: vendorEditFromRecord(observed),
        })
        setView({ selected: review.ref, creating: false, notice: "sf.u15.saved" })
      } else if (deleted) {
        setView({ selected: undefined, creating: false, notice: "sf.u15.deleted" })
      } else {
        // No synthetic identity for a newly created contract, or false claim
        // of record deletion from an incomplete/failed authorized refetch.
        if (review.action === "save") draft()?.confirmSave({
          kind: "confirmed-without-projection", operationRef: review.operationRef, resultVersion: null,
        })
        setView("notice", "sf.u15.acceptedNoProjection")
      }
      setView({ sending: false, reviewing: undefined })
    } catch (error) {
      if (sf.generation() === epoch && sf.state().status === "ready" &&
          sf.state().ownerKey === ownerKey) {
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
      <span>{label}</span>
      <Show when={choices} fallback={
        field === "desc" || field === "notes" ?
          <textarea rows={3} disabled={disabled} value={value == null ? "" : String(value)}
            onInput={(event) => setField(field, event.currentTarget.value)} /> :
          <input
            type={field === "start" || field === "end" || field === "renewal" ? "date" :
              field === "amount" ? "number" : "text"}
            step={field === "amount" ? "any" : undefined}
            required={field === "vendor"} disabled={disabled}
            value={value == null ? "" : String(value)}
            onInput={(event) => setField(field, event.currentTarget.value)} />
      }>
        {(items) => <select disabled={disabled} value={value == null ? "" : String(value)}
          onChange={(event) => setField(field, event.currentTarget.value)}>
          <For each={items()}>{(option) => <option value={option}>
            {field === "eval" ? option : t(("sf.u15.option." + option) as Key)}
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
        fields: editFields(vendorEditFromRecord(base)) } : null
    const actionKey = review.action === "save" ? "sf.u15.save" : "sf.u15.delete"
    const fields = review.action === "delete"
      ? editFields(vendorEditFromRecord(base)) : editFields(review.values)
    return <SfChangeReview
      operation={{ ref: review.operationRef, label: message(actionKey), scope: dataText(t("sf.u15.reviewScope")) }}
      base={original} current={original}
      proposed={{ kind: "draft", intentRef: review.intentRef, sourceRef: ref ?? null,
        sourceVersion: ref ? review.version : null, fields }}
      effects={[{ id: review.action, domain: "dashboard", title: { kind: "message", message: message(actionKey) },
        state: "proposed", details: fields }]}
      coverage={{ state: "complete", summary: message("sf.u15.reviewSummary"),
        reasons: [], knownCount: fields.length, expectedCount: fields.length }}
      blockingReasons={[]}
      confirmation={{ kind: "admitted", labelKey: key("sf.u15.confirm"),
        purpose: review.action, binding: { kind: "catalog-command",
          operationId: review.action === "save" ? "domain.command.CAP14.save" : "domain.command.CAP14.delete",
          version: { kind: "record", expectedVersion: review.version },
          confirmation: "presentation-only" } }}
      state={view.sending ? "loading" : "ready"}
      onConfirm={() => { void confirm() }}
      onRevise={() => { draft()?.setPhase("dirty"); setView("reviewing", undefined) }}
      onCancel={() => { draft()?.setPhase("dirty"); setView("reviewing", undefined) }}
    />
  }

  return <section data-component="sf-vendor-contracts" aria-busy={view.sending}>
    <SfPageFrame
      titleKey={key("sf.cap14.title")}
      context={[]}
      tabs={[]}
      activeTab={null}
      primaryAction={actionAllowed("save") ? {
        id: "new", labelKey: key("sf.cap14.primary"), tone: "primary",
        disabled: view.sending || view.outcomeUnknown, busy: view.sending,
        onInvoke: () => {
          setView({ creating: true, selected: undefined,
            newIntentRef: crypto.randomUUID() as SfIntentRef, reviewing: undefined })
        },
      } : undefined}
      secondaryActions={[]}
      density="comfortable"
      layout="work"
      onLayoutMode={() => undefined}
    >
      <Show when={view.state === "ready" && view.read !== undefined} fallback={
        <SfStatePanel state={view.state} messageKey={key("sf.u15.notAvailable")}
          onRetryRead={view.state === "denied" ? undefined : refresh} />
      }>
        <div class="sf-u15-layout">
          <div class="sf-u15-list">
            <label for={inputId}>{t("sf.u15.filter")}</label>
            <div class="sf-u15-filters">
              <input id={inputId} type="search" placeholder={t("sf.u15.filterPlaceholder")}
                value={view.filter} onInput={(event) => setView("filter", event.currentTarget.value)} />
              <button type="button" class="mx-btn" disabled={!view.filter}
                onClick={() => setView("filter", "")}>{t("sf.u15.clearFilter")}</button>
            </div>
            <SfDataTable
              rows={filteredRows()} getRowKey={vendorRef} columns={columns}
              selectedKey={selectedRef()} sort={view.sort} page={{ kind: "none", total: filteredRows().length }}
              onSort={(sort) => setView("sort", sort)} onPage={() => undefined}
              onSelect={(ref) => setView({ selected: ref, creating: false, reviewing: undefined })}
              rowActions={() => []} onRowAction={() => undefined}
              captionKey={key("sf.u15.list")} density="comfortable"
              state={filteredRows().length ? "ready" : view.read?.records.length ? "filtered-empty" : "empty"}
            />
          </div>
          <div class="sf-u15-detail">
            <Show when={selectedRow() || creating()} fallback={<p role="status">{t("sf.u15.open")}</p>}>
              <header class="sf-u15-detail-head">
                <h2>{creating() ? t("sf.cap14.primary") : safeField(selectedRow()!, "vendor")}</h2>
                <Show when={selectedRow() && selectedRef()}>
                  <a href={buildHref(selectedRef())}>{t("sf.u15.open")}</a>
                  <span>{t("sf.u15.version")}: {currentVersion() ?? "—"}</span>
                </Show>
              </header>
              <Show when={sourceAvailable() && (creating() || selectedRow())}>
                <Show when={activeDraft() && (creating() || props.route.kind === "edit" || view.selected)}>
                  <div class="sf-u15-edit">
                    <For each={EDIT_SECTIONS}>{(section) => <fieldset>
                      <legend>{t(section.title)}</legend>
                      <div class="sf-u15-fields"><For each={section.fields}>{(field) => renderField(field)}</For></div>
                    </fieldset>}</For>
                    <Show when={selectedRow()?.currency !== undefined}>
                      <p>{t("sf.u15.field.currency")}: {safeField(selectedRow()!, "currency")}</p>
                    </Show>
                    <div class="sf-u15-actions">
                      <button type="button" class="mx-btn primary"
                        disabled={view.sending || view.outcomeUnknown || !!view.reviewing ||
                          !activeDraft() || !editableVendor(activeDraft()!.value)}
                        onClick={() => beginReview("save")}>{t("sf.u15.reviewSave")}</button>
                      <button type="button" class="mx-btn" disabled={view.sending || view.outcomeUnknown}
                        onClick={() => {
                          draft()?.discard()
                          setView({ reviewing: undefined, creating: false })
                        }}>{t("sf.u15.discard")}</button>
                    </div>
                  </div>
                </Show>
                <Show when={!creating() && !!selectedRow()}>
                  <div class="sf-u15-read">
                    <For each={EDIT_SECTIONS}>{(section) => <section>
                      <h3>{t(section.title)}</h3>
                      <dl><For each={section.fields}>{(field) =>
                        <div><dt>{t(fieldKey(field))}</dt><dd>{safeField(selectedRow()!, field)}</dd></div>
                      }</For></dl>
                    </section>}</For>
                    <section>
                      <h3>{t("sf.u15.documents")}</h3>
                      <Show when={(selectedRow()?.docs?.length ?? 0) > 0}
                        fallback={<p>{t("sf.u15.noDocuments")}</p>}>
                        <ul><For each={selectedRow()?.docs}>{(item) =>
                          <li>{item.name == null ? String(item.id ?? "") : String(item.name)} ({String(item.status ?? "")})</li>
                        }</For></ul>
                      </Show>
                    </section>
                    <section><h3>{t("sf.u15.link")}</h3><p>{t("sf.u15.unavailableLink")}</p></section>
                    <Show when={actionAllowed("delete") && currentVersion() !== undefined}>
                      <button type="button" class="mx-btn danger"
                        disabled={view.sending || view.outcomeUnknown}
                        onClick={() => beginReview("delete")}>{t("sf.u15.reviewDelete")}</button>
                    </Show>
                  </div>
                </Show>
              </Show>
              {fieldReview()}
            </Show>
          </div>
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
