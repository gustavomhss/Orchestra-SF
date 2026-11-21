import { createEffect, createMemo, createSignal, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfEditScopeKey, SfIntentRef, SfOperationRef, SfRef } from "@orchestra/schema/sucafina/context"
import type { SfOperationId } from "@orchestra/schema/sucafina/common"
import type { SfPublicDraftController, SfSurfaceProps } from "../../context/contracts"
import { useSfContext } from "../../context"
import { SfPageFrame } from "../../shared/frame"
import { SfExecutiveAction, SfExecutiveRelatedLinks } from "../../cross-links/view"
import type { SfColumn, SfCopyKey, SfUiState } from "../../shared/table"
import { SfStatePanel } from "../../shared/states"
import { SfDataTable } from "../../shared/table"
import { SfChangeReview } from "../../shared/change-review"
import type { SfReviewField, SfReviewSnapshot } from "../../shared/change-review"
import "./collection.css"

type Cap = "CAP13" | "CAP15"
type Entity = Readonly<{ id: string | number }>
// Mutable: store paths write through setStore("filtersEdit", key, ...), which requires writable keys.
export type Filters = { q?: string; status?: string; filter?: string; owner?: string }
export type PageResult<Row> =
  | Readonly<{ kind: "ok"; rows: readonly Row[]; versions: Readonly<Record<string, number>>; actions: readonly string[] }>
  | Readonly<{ kind: "error"; state: SfUiState }>
export type WriteResult =
  | Readonly<{ kind: "ok"; warnings: readonly string[] }>
  | Readonly<{ kind: "error"; state: SfUiState; errors: readonly string[] }>
  | Readonly<{ kind: "outcome-unknown" }>
export type Field<Row, Value> = Readonly<{
  name: Extract<keyof Row & keyof Value, string>
  label: string
  kind: "text" | "textarea" | "date" | "email" | "select"
  required?: boolean
  options?: readonly Readonly<{ value: string; label: string }>[]
}>
export type Column<Row> = Readonly<{
  name: Extract<keyof Row, string>
  label: string
  secondary?: readonly Extract<keyof Row, string>[]
}>
export type CollectionSpec<Id extends Cap, Row extends Entity, Values extends object> = Readonly<{
  id: Id
  collection: "risks" | "stakeholders"
  title: string
  primary: string
  fields: readonly Field<Row, Values>[]
  columns: readonly Column<Row>[]
  groups: readonly Readonly<{
    label: string
    fields: readonly Extract<keyof Row & keyof Values, string>[]
  }>[]
  name: (record: Row) => string
  initial: (record?: Row) => Values
  deepRef: (route: SfSurfaceProps<Id>["route"]) => string | null
  query: (route: SfSurfaceProps<Id>["route"]) => Filters
  readOperation: SfOperationId
  saveOperation: SfOperationId
  deleteOperation: SfOperationId
  read: (transport: SfTransport, query: Filters, signal: AbortSignal) => Promise<PageResult<Row>>
  save: (transport: SfTransport, command: { id?: string; version: number; values: Values },
    signal: AbortSignal, key: string) => Promise<WriteResult>
  delete: (transport: SfTransport, command: { id: string; version: number },
    signal: AbortSignal, key: string) => Promise<WriteResult>
}>
type Mode = "list" | "detail" | "edit" | "review-save" | "review-delete"
type LiveDraft<Row, Values> = Readonly<{
  controller: SfPublicDraftController<Values>
  entity: Row | undefined
  identity: { kind: "record"; recordRef: SfRef } | { kind: "new"; newIntentRef: SfIntentRef }
  operationRef: SfOperationRef
}>
const k = (text: string) => text as SfCopyKey
const idOf = (value: string | number) => String(value) as SfRef
const scalar = (value: unknown) => value === undefined || value === null ? "" :
  typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : ""
const message = (label: string) => ({ key: k(label) })
const reviewField = (path: string, label: string, value: unknown,
  options?: readonly Readonly<{ value: string; label: string }>[]): SfReviewField => {
  const option = scalar(value) ? options?.find((choice) => choice.value === scalar(value)) : undefined
  return {
    path, label: message(label), value: value === undefined || value === null
      ? { kind: "missing", reason: message("sf.common.unknown") }
      : { kind: "text", text: option
        ? { kind: "message", message: message(option.label) }
        : { kind: "data", text: scalar(value) } },
  }
}
const initialError = (status: string): SfUiState =>
  status === "denied" ? "denied" : status === "unauthenticated" ? "session-expired" :
  status === "stale" ? "stale" : status === "needs-input" ? "invalid" : "unavailable"

export function readFailure(result: Readonly<{ kind: string; status?: number; body?: { status: string } }>): SfUiState {
  if (result.kind !== "response") return "unavailable"
  if (result.status === 401) return "session-expired"
  if (result.status === 403) return "denied"
  return initialError(result.body?.status || "unavailable")
}
export function writeOutcome(result: Readonly<
  | { kind: "response"; status: number; body: { ok: boolean; warnings?: readonly string[]; errors?: readonly string[] } }
  | { kind: "transport-error"; reason: string }
>): WriteResult {
  if (result.kind !== "response") return result.reason === "outcome-unknown"
    ? { kind: "outcome-unknown" } : { kind: "error", state: "unavailable", errors: [] }
  if (result.body.ok && result.status >= 200 && result.status < 300)
    return { kind: "ok", warnings: result.body.warnings || [] }
  return { kind: "error", state: result.status === 401 ? "session-expired"
    : result.status === 403 ? "denied" : result.status === 409 ? "conflict"
    : result.status === 404 ? "not-found" : "invalid", errors: result.body.errors || [] }
}

/** Source-frozen CAP13 and CAP15 collection shell. No arbitrary command dispatcher.
 * F01 retains per-owner drafts, A01 supplies typed operations, S03 owns review.
 */
export function SfNativeCollection<Id extends Cap, Row extends Entity, Values extends object>(
  props: SfSurfaceProps<Id> & { spec: CollectionSpec<Id, Row, Values> },
): JSX.Element {
  const spec = props.spec
  const owner = useSfContext()
  const language = useLanguage()
  const [store, setStore] = createStore({
    status: "loading" as SfUiState,
    rows: undefined as readonly Row[] | undefined,
    versions: {} as Readonly<Record<string, number>>,
    actions: [] as readonly string[],
    ownerId: "",
    filters: spec.query(props.route),
    filtersEdit: spec.query(props.route),
    readFilters: {} as Filters,
    selected: null as SfRef | null,
    mode: "list" as Mode,
    order: "none" as "none" | "asc" | "desc",
    error: null as string | null,
    warnings: [] as readonly string[],
    busy: false,
    unknown: false,
    reload: 0,
  })
  const [draft, setDraft] = createSignal<LiveDraft<Row, Values> | null>(null)
  const [confirmed, setConfirmed] = createSignal<
    Readonly<{ draft: SfPublicDraftController<Values>; operationRef: SfOperationRef; id: SfRef | null }> | null>(null)
  let lastOwner = ""
  let admittedLink = ""
  const t = (label: string) => language.t(label as Parameters<typeof language.t>[0])
  const nowReady = () => {
    const state = owner.state()
    const ready = owner.ready()
    return state.status === "ready" && ready
      ? { state, ready, identity: [state.ownerKey, state.context.stamp.accessRevision].join("|") }
      : undefined
  }
  const isCurrent = () => !!nowReady() && store.ownerId !== "" && store.ownerId === nowReady()?.identity
  const rows = () => isCurrent() && store.rows ? store.rows : []
  const destination = () => nowReady()?.state.context.destinations.find(
    (entry) => entry.capabilityId === spec.id && entry.canRead)
  const admitted = (action: "save" | "delete") => {
    const operationId = action === "save" ? spec.saveOperation : spec.deleteOperation
    return isCurrent() && !!destination() &&
      destination()!.allowedActionIds.includes(action) && store.actions.includes(action) &&
      nowReady()!.state.context.availability.some((family) => family.operations.some(
        (operation) => operation.operationId === operationId && operation.state === "ready"))
  }
  const version = (row: Row) => store.versions[spec.collection + ":" + String(row.id)]
  const selected = () => {
    if (!store.selected) return undefined
    const matches = rows().filter((entry) => String(entry.id) === String(store.selected))
    return matches.length === 1 ? matches[0] : undefined
  }
  const refresh = () => setStore("reload", (n) => n + 1)

  createEffect(() => {
    const r = nowReady()
    const generation = owner.generation()
    const query = {
      ...(store.filters.q === undefined ? {} : { q: store.filters.q }),
      ...(store.filters.status === undefined ? {} : { status: store.filters.status }),
      ...(store.filters.filter === undefined ? {} : { filter: store.filters.filter }),
      ...(store.filters.owner === undefined ? {} : { owner: store.filters.owner }),
    }
    void store.reload
    if (!r || !r.state.context.destinations.some(
      (entry) => entry.capabilityId === spec.id && entry.canRead)) {
      lastOwner = ""
      admittedLink = ""
      setDraft(null)
      setConfirmed(null)
      const status = !r ? owner.state().status === "resolving" ? "loading"
        : owner.state().status === "unauthenticated" ? "session-expired"
        : owner.state().status === "denied" ? "denied" : "unavailable" : "denied"
      setStore({ status, rows: undefined, ownerId: "", versions: {},
        actions: [], selected: null, mode: "list", error: null, warnings: [] })
      return
    }
    const identity = r.identity
    if (lastOwner !== identity) {
      lastOwner = identity
      admittedLink = ""
      setDraft(null)
      setConfirmed(null)
      setStore({ ownerId: "", rows: undefined, selected: null,
        mode: "list", error: null, warnings: [] })
    }
    setStore("status", "loading")
    const abort = new AbortController()
    let active = true
    void spec.read(r.ready.transport, query, abort.signal).then((result) => {
      if (!active || owner.generation() !== generation || nowReady()?.identity !== identity) return
      if (result.kind === "error") {
        setStore({ status: result.state, rows: undefined, ownerId: "", actions: [], versions: {} })
        return
      }
      setStore({ rows: result.rows, versions: result.versions, actions: result.actions, readFilters: { ...query },
        ownerId: identity, status: result.rows.length ? "ready" :
          query.q || query.filter || query.owner || query.status ? "filtered-empty" : "empty" })
      const pending = confirmed()
      if (pending) {
        const match = pending.id ? result.rows.find((row) => String(row.id) === String(pending.id)) : undefined
        const current = match ? result.versions[spec.collection + ":" + String(match.id)] : undefined
        if (match && current !== undefined) pending.draft.confirmSave({
          kind: "projected", operationRef: pending.operationRef, baseVersion: current, value: spec.initial(match),
        })
        else pending.draft.confirmSave({ kind: "confirmed-without-projection",
          operationRef: pending.operationRef, resultVersion: null })
        setConfirmed(null)
      }
      // Refetch never overwrites a dirty editor. S03 carries a version conflict
      // separately, preserving user input and the originally reviewed CAS.
      const liveDraft = draft()
      if (!pending && liveDraft?.entity) {
        const row = result.rows.find((item) => String(item.id) === String(liveDraft.entity!.id))
        const updatedVersion = row ? result.versions[spec.collection + ":" + String(row.id)] : undefined
        if (row && updatedVersion !== undefined)
          liveDraft.controller.receiveRemote({ baseVersion: updatedVersion, value: spec.initial(row) })
      }
      if (admittedLink !== identity + "/" + props.route.pathname) {
        admittedLink = identity + "/" + props.route.pathname
        const wanted = spec.deepRef(props.route)
        if (wanted) {
          const matches = result.rows.filter((row) => String(row.id) === wanted)
          if (matches.length !== 1) {
            setStore({ status: "not-found", ownerId: "", rows: undefined })
          } else {
            setStore({ selected: idOf(matches[0]!.id),
              mode: props.route.kind === "edit" ? "edit" : "detail" })
            if (props.route.kind === "edit") beginEdit(matches[0])
          }
        } else if (props.route.kind === "new") beginEdit(undefined)
      }
    }).catch((error: unknown) => {
      if (!active || abort.signal.aborted) return
      console.error("N16 native collection read failed")
      setStore({ status: "unavailable", ownerId: "", rows: undefined, actions: [] })
    })
    onCleanup(() => { active = false; abort.abort() })
  })

  const beginEdit = (row: Row | undefined) => {
    const r = nowReady()
    if (!r || !admitted("save") || (row && version(row) === undefined)) return
    const initial = spec.initial(row)
    const identity: LiveDraft<Row, Values>["identity"] = row
      ? { kind: "record", recordRef: idOf(row.id) }
      : { kind: "new", newIntentRef: ("n16-new:" + spec.id) as SfIntentRef }
    const controller = r.ready.drafts.acquire<Values>({
      surfaceId: spec.id,
      identity,
      editScopeKey: ("native-record:" + spec.id) as SfEditScopeKey,
      baseVersion: row ? version(row)! : null,
      base: row ? initial : null,
      value: initial,
      revalidation: { operationId: spec.readOperation, input: {
        ...(store.readFilters.q === undefined ? {} : { q: store.readFilters.q }),
        ...(store.readFilters.status === undefined ? {} : { status: store.readFilters.status }),
        ...(store.readFilters.filter === undefined ? {} : { filter: store.readFilters.filter }),
        ...(store.readFilters.owner === undefined ? {} : { owner: store.readFilters.owner }),
      },
        fieldPaths: spec.fields.filter((field) => row && Object.hasOwn(row, field.name))
          .map((field) => field.name), actionIds: ["save"] },
    })
    setDraft({ controller, entity: row, identity, operationRef: crypto.randomUUID() as SfOperationRef })
    setStore({ mode: "edit", selected: row ? idOf(row.id) : null, error: null, warnings: [] })
  }
  const fieldList = (entity: Row | undefined) =>
    spec.fields.filter((field) => !entity || Object.hasOwn(entity, field.name))
  const reviewFields = (entity: Row | undefined, value: Values | Row | undefined): SfReviewField[] =>
    value ? fieldList(entity).map((field) =>
      reviewField(field.name, field.label, value[field.name as keyof typeof value], field.options)) : []
  const originalSnapshot = (row: Row | undefined): SfReviewSnapshot | null =>
    row && version(row) !== undefined ? { kind: "persisted", ref: idOf(row.id),
      version: version(row)!, fields: reviewFields(row, row) } : null
  const activeState = () => draft()?.controller.snapshot()
  const beginSaveReview = () => {
    const current = draft()
    const snap = activeState()
    if (!admitted("save") || !current || snap?.availability !== "active" || store.unknown) return
    if (fieldList(current.entity).some((field) => field.required &&
        !scalar(snap.value[field.name]).trim())) {
      setStore("error", t("sf.common.fieldErrorSummary"))
      return
    }
    current.controller.setPhase("reviewing")
    setStore({ mode: "review-save", error: null })
  }
  const beginDeleteReview = (row: Row) => {
    if (admitted("delete") && version(row) !== undefined) setStore({
      selected: idOf(row.id), mode: "review-delete", error: null })
  }

  const commit = async (action: "save" | "delete") => {
    if (!admitted(action) || store.busy || store.unknown) return
    const r = nowReady()
    if (!r) return
    const currentDraft = draft()
    const row = action === "delete" ? selected() : currentDraft?.entity
    const snap = action === "save" ? currentDraft?.controller.snapshot() : undefined
    if ((row && version(row) === undefined) ||
        (action === "save" && (!currentDraft || snap?.availability !== "active" ||
          (row && snap.baseVersion !== version(row))))) {
      setStore({ error: t("sf.common.stale"), mode: action === "save" ? "edit" : "detail" })
      return
    }
    const operationRef = action === "save" ? currentDraft!.operationRef : crypto.randomUUID() as SfOperationRef
    const callKey = crypto.randomUUID()
    const abort = new AbortController()
    setStore({ busy: true, error: null })
    let commitStage = "prepare-pending"
    try {
      if (action === "save" && snap?.availability === "active") {
        const bytes = new TextEncoder().encode(JSON.stringify(
          [spec.saveOperation, row ? String(row.id) : null, row ? version(row) : 0, snap.value, callKey]))
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
          .map((n) => n.toString(16).padStart(2, "0")).join("")
        currentDraft!.controller.setPending({ operationRef, idempotencyKey: callKey,
          payloadDigest: digest, expectedVersion: row ? version(row)! : null })
        commitStage = "publish-submitting"
        currentDraft!.controller.setPhase("submitting")
      }
      commitStage = "send-command"
      const result: WriteResult = action === "save" && snap?.availability === "active"
        ? await spec.save(r.ready.transport, { id: row ? String(row.id) : undefined,
          version: row ? version(row)! : 0, values: snap.value }, abort.signal, callKey)
        : action === "delete" && row
          ? await spec.delete(r.ready.transport, { id: String(row.id), version: version(row)! },
            abort.signal, callKey)
          : { kind: "error", state: "invalid", errors: [] }
      commitStage = "present-result"
      if (nowReady()?.identity !== r.identity) return
      if (result.kind === "ok") {
        commitStage = "publish-confirmed"
        setStore({ error: null, warnings: result.warnings, mode: action === "delete" ? "list" : "detail",
          selected: action === "delete" ? null : store.selected })
        commitStage = "track-confirmed"
        if (action === "save") setConfirmed({ draft: currentDraft!.controller, operationRef,
          id: row ? idOf(row.id) : null })
        commitStage = "reload-source"
        refresh()
      } else if (result.kind === "outcome-unknown") {
        currentDraft?.controller.setPhase("outcome-unknown")
        setStore({ unknown: true, error: t("sf.common.operationUnknown") })
      } else {
        currentDraft?.controller.setPhase(result.state === "conflict" ? "conflict" : "validation-error")
        setStore({ error: result.errors.join(" ") || t("sf.common.failed"),
          mode: action === "save" ? "edit" : "detail" })
        if (result.state === "denied" || result.state === "session-expired")
          setStore({ status: result.state, ownerId: "", rows: undefined, actions: [] })
      }
    } catch (error: unknown) {
      const stack = error instanceof Error ? error.stack?.split("\n").slice(1, 7).join("\n")
        .replace(/https?:\/\/[^/\s)]+/g, "[origin]")
        .replace(/[?#][^\s)]*/g, "")
        .slice(0, 2048) : undefined
      console.error("N16 mutation result unknown", commitStage,
        error instanceof Error ? error.name : "unknown", stack ?? "")
      currentDraft?.controller.setPhase("outcome-unknown")
      setStore({ unknown: true, error: t("sf.common.operationUnknown") })
    } finally {
      setStore("busy", false)
    }
  }
  const sortRows = createMemo(() => store.order === "none" ? rows() : [...rows()].sort(
    (a, b) => scalar(a[spec.columns[0]!.name]).localeCompare(scalar(b[spec.columns[0]!.name])) *
      (store.order === "asc" ? 1 : -1)))
  const displayValue = (name: Extract<keyof Row, string>, value: unknown) => {
    const raw = scalar(value)
    const option = spec.fields.find((field) => field.name === name)?.options?.find((choice) => choice.value === raw)
    return raw ? option ? t(option.label) : raw : t("sf.u30.fieldMissing")
  }
  const fieldGroups = (entity: Row | undefined) => spec.groups.map((group) => ({
    label: group.label, fields: fieldList(entity).filter((field) => group.fields.includes(field.name)),
  })).filter((group) => group.fields.length > 0)
  const columns: readonly SfColumn<Row>[] = spec.columns.map((field, index) => ({
    id: field.name, labelKey: k(field.label),
    align: ["impact", "probability", "biz", "iti", "perc"].includes(field.name) ? "end" : "start",
    widthPolicy: { kind: "content", minPx: index === 0 ? 240 : 80, maxPx: index === 0 ? 360 : 200 },
    sortKey: index === 0 ? field.name : undefined,
    render: (row) => <span class="sf-u30-cell" data-field={field.name}>
      <span class="sf-u30-cell-label">{t(field.label)}</span>
      <bdi>{index === 0 ? spec.name(row) || t("sf.u30.fieldMissing") : displayValue(field.name, row[field.name])}</bdi>
      <Show when={field.secondary?.length}>
        <span class="sf-u30-cell-secondary">
          <For each={field.secondary?.filter((name) => scalar(row[name]) && scalar(row[name]) !== spec.name(row))}>{(name) => <bdi>{scalar(row[name])}</bdi>}</For>
        </span>
      </Show>
    </span>,
  }))
  const statusCopy = () => store.status === "loading" ? "sf.common.loading"
    : store.status === "empty" ? "sf.common.empty"
    : store.status === "filtered-empty" ? "sf.common.filterEmpty"
    : store.status === "denied" ? "sf.common.noAccess"
    : store.status === "session-expired" ? "sf.common.loginAgain"
    : store.status === "not-found" ? "sf.common.removed"
    : store.status === "stale" ? "sf.common.stale" : "sf.common.unavailable"
  const complete = () => ({ state: "complete", summary: message("sf.common.currentSource"),
    reasons: [], knownCount: null, expectedCount: null } as const)

  return (
    <div class="sf-u30-host" data-sf-authorized={isCurrent()}>
      <SfPageFrame titleKey={k(spec.title)} context={[]} tabs={[]} activeTab={null}
        density="comfortable" layout="work" onLayoutMode={() => undefined}
        primaryAction={store.mode === "list" && admitted("save") ? { id: "new", labelKey: k(spec.primary), tone: "primary",
          disabled: store.busy || store.unknown, busy: store.busy,
          onInvoke: () => beginEdit(undefined) } : undefined}
        secondaryActions={[]}>
        <SfStatePanel state={store.status === "empty" || store.status === "filtered-empty" ? "ready" : store.status} messageKey={k(statusCopy())} onRetryRead={refresh}
          onBack={() => setStore({ mode: "list", selected: null })}>
          <Show when={isCurrent()}>
            <div class="sf-u30-root" data-sf-surface={spec.id} data-sf-wave="three" data-sf-view={store.mode}>
              <Show when={store.status === "empty" || store.status === "filtered-empty"}>
                <p role="status">{t(statusCopy())}</p>
              </Show>
              <Show when={store.error}>{(error) => <p role="alert" class="sf-u30-error"><bdi>{error()}</bdi></p>}</Show>
              <Show when={store.warnings.length}>
                <ul role="status"><For each={store.warnings}>{(warning) => <li><bdi>{warning}</bdi></li>}</For></ul>
              </Show>
              <Show when={store.unknown}>
                <SfStatePanel state="outcome-unknown" messageKey={k("sf.common.operationUnknown")}
                  onRetryRead={refresh} />
              </Show>
              <div class="sf-u30-panels">
                <section class="sf-u30-list" hidden={store.mode !== "list"}>
                  <header class="sf-u30-list-head">
                    <div><h2>{t(spec.id === "CAP13" ? "sf.u30.design.riskRegister" : "sf.u30.design.relationships")}</h2>
                      <p>{t(spec.id === "CAP13" ? "sf.u30.design.riskIntro" : "sf.u30.design.stakeholderIntro")}</p></div>
                    <p class="sf-u30-count"><strong>{rows().length}</strong> {t("sf.u30.design.recordsShown")}</p>
                  </header>
              <form class="sf-u30-filters" onSubmit={(event) => { event.preventDefault(); setStore("filters", { ...store.filtersEdit }) }} aria-label={t("sf.u30.filters")}>
                <label>{t("sf.u30.search")}<input value={store.filtersEdit.q || ""}
                  onInput={(event) => setStore("filtersEdit", "q", event.currentTarget.value)} /></label>
                <Show when={spec.id === "CAP13"}>
                  <label>{t("sf.u30.status")}
                    <select aria-label={t("sf.u30.status")} value={store.filtersEdit.status || ""}
                      onChange={(event) => setStore("filtersEdit", "status", event.currentTarget.value)}>
                      <option value="">{t("sf.u30.all")}</option>
                      <For each={["open", "mitigating", "monitoring", "closed"]}>{(option) =>
                        <option value={option}>{t("sf.u30.risk.option.status." + option)}</option>}</For>
                    </select>
                  </label>
                </Show>
                <button class="mx-btn" type="submit">{t("sf.u30.apply")}</button>
              </form>

                  <div class="sf-u30-ledger" role="region" aria-label={t(spec.title)} tabindex="0">
                  <SfDataTable<Row> rows={sortRows()} getRowKey={(row) => idOf(row.id)}
                    columns={columns} selectedKey={store.selected || undefined}
                    sort={store.order === "none" ? { kind: "none" }
                      : { kind: "field", key: spec.columns[0]!.name, direction: store.order }}
                    page={{ kind: "none", total: rows().length }}
                    onSort={(sort) => setStore("order", sort.kind === "field" ? sort.direction : "none")}
                    onPage={() => undefined} onSelect={(recordRef) => setStore({
                      mode: "detail", selected: recordRef })}
                    rowActions={() => [
                      ...(admitted("save") ? [{ id: "edit", labelKey: k("sf.common.edit"), tone: "secondary" as const,
                        disabled: store.busy, busy: store.busy }] : []),
                      ...(admitted("delete") ? [{ id: "delete", labelKey: k("sf.u30.delete"), tone: "danger" as const,
                        disabled: store.busy, busy: store.busy }] : []),
                    ]}
                    onRowAction={({ recordRef, actionId }) => {
                      const candidates = rows().filter((row) => String(row.id) === String(recordRef))
                      if (candidates.length !== 1) return
                      if (actionId === "edit") beginEdit(candidates[0])
                      if (actionId === "delete") beginDeleteReview(candidates[0]!)
                    }}
                    captionKey={k(spec.title)} density="comfortable" state="ready" />
                  </div>
                </section>
                <Show when={store.mode !== "list"}>
                  <section class="sf-u30-detail" data-mode={store.mode}>
                    <button type="button" class="mx-btn sf-u30-back" onClick={() => setStore({ mode: "list", selected: null })}>
                      {t("sf.common.back")}
                    </button>
                    <Show when={store.mode === "detail" && selected()}>
                      {(row) => <article class="sf-u30-record" data-sf-record-detail>
                        <header class="sf-u30-record-head">
                          <div><p class="sf-u30-caption">{t(spec.title)}</p><h2><bdi>{spec.name(row())}</bdi></h2></div>
                          <div class="sf-u30-actions">
                            <Show when={admitted("save")}><button type="button" class="mx-btn primary"
                              onClick={() => beginEdit(row())}>{t("sf.common.edit")}</button></Show>
                            <Show when={admitted("delete")}><button type="button" class="mx-btn danger"
                              onClick={() => beginDeleteReview(row())}>{t("sf.u30.delete")}</button></Show>
                          </div>
                        </header>
                        <div class="sf-u30-detail-groups">
                          <For each={fieldGroups(row())}>{(group) => (
                            <section class="sf-u30-detail-group" aria-label={t(group.label)}>
                              <h3>{t(group.label)}</h3>
                              <dl class="sf-u30-definition">
                                <For each={group.fields}>{(field) => <div data-field-kind={field.kind}>
                                  <dt>{t(field.label)}</dt>
                                  <dd data-sf-missing={!scalar(row()[field.name as keyof Row])}>
                                    <bdi>{displayValue(field.name, row()[field.name as keyof Row])}</bdi>
                                  </dd>
                                </div>}</For>
                              </dl>
                            </section>
                          )}</For>
                        </div>
                        <details class="sf-u30-source">
                          <summary>{t("sf.u30.design.source")}</summary>
                          <dl class="sf-u30-definition">
                            <div><dt>{t("sf.u30.design.reference")}</dt><dd><bdi>{String(row().id)}</bdi></dd></div>
                            <div><dt>{t("sf.u30.design.version")}</dt><dd>{version(row()) ?? t("sf.u30.fieldMissing")}</dd></div>
                          </dl>
                        </details>
                        <div class="sf-u30-actions sf-u30-related" data-sf-executive-handoff>
                          <SfExecutiveAction from={props.route} target={{ kind: "new-topic" }}
                            label={{ pt: "Criar ação em Hot Topics", en: "Create Hot Topic action" }} />
                          <SfExecutiveAction from={props.route}
                            target={{ kind: "relations", source: {
                              kind: spec.id === "CAP13" ? "risk" : "stakeholder", ref: String(row().id),
                            } }}
                            label={{ pt: "Encaminhar vínculo por referência", en: "Link action by reference" }} />
                        </div>
                        <SfExecutiveRelatedLinks from={props.route}
                          omit={spec.id === "CAP13" ? "risk" : "stakeholder"} />
                      </article>}
                    </Show>
                    <Show when={store.mode === "edit" && activeState()?.availability === "active" ? draft() : null}>
                      {(active) => <form class="sf-u30-editor" data-sf-editor onSubmit={(event) => {
                        event.preventDefault(); beginSaveReview()
                      }}>
                        <header class="sf-u30-editor-head">
                          <h2>{t(active().entity ? "sf.common.edit" : spec.primary)}</h2>
                          <p>{t("sf.u30.design.editHint")}</p>
                        </header>
                        <For each={fieldGroups(active().entity)}>{(group) => (
                          <fieldset class="sf-u30-field-group">
                            <legend>{t(group.label)}</legend>
                            <div class="sf-u30-fields">
                        <For each={group.fields}>{(field) => {
                          const getValue = () => {
                            const snapshot = active().controller.snapshot()
                            return snapshot.availability === "active" ? scalar(snapshot.value[field.name]) : ""
                          }
                          const change = (next: string) => {
                            const snapshot = active().controller.snapshot()
                            if (snapshot.availability === "active")
                              active().controller.edit({ ...snapshot.value, [field.name]: next } as Values)
                          }
                          return <label data-field-kind={field.kind} data-field-name={field.name}>{t(field.label)}
                            <Show when={field.kind === "textarea"} fallback={
                              <Show when={field.kind === "select"} fallback={
                                <input name={field.name} aria-label={t(field.label)} type={field.kind === "email" ? "email"
                                  : field.kind === "date" ? "date" : "text"}
                                  required={field.required} value={getValue()}
                                  onInput={(event) => change(event.currentTarget.value)} />
                              }>
                                <select name={field.name} aria-label={t(field.label)} required={field.required} value={getValue()}
                                  onChange={(event) => change(event.currentTarget.value)}>
                                  <For each={field.options || []}>{(option) =>
                                    <option value={option.value}>{t(option.label)}</option>}</For>
                                </select>
                              </Show>
                            }>
                              <textarea name={field.name} aria-label={t(field.label)} required={field.required} value={getValue()}
                                onInput={(event) => change(event.currentTarget.value)} />
                            </Show>
                          </label>
                        }}</For>
                            </div>
                          </fieldset>
                        )}</For>
                        <div class="sf-u30-actions">
                          <button type="submit" class="mx-btn primary" disabled={store.busy || store.unknown}>
                            {t("sf.common.review")}
                          </button>
                          <button type="button" class="mx-btn" onClick={() => setStore("mode", "detail")}>
                            {t("sf.common.back")}
                          </button>
                          <button type="button" class="mx-btn" onClick={() => {
                            active().controller.discard()
                            setStore({ mode: "detail", error: null })
                          }}>{t("sf.common.discard")}</button>
                        </div>
                      </form>}
                    </Show>
                    <Show when={store.mode === "review-save" && activeState()?.availability === "active" ? draft() : null}>
                      {(active) => {
                        const current = () => active().controller.snapshot()
                        const sourceVersion = () => { const state = current(); return state.availability === "active" ? state.baseVersion : null }
                        const proposedFields = () => { const state = current(); return state.availability === "active"
                          ? reviewFields(active().entity, state.value) : [] }
                        const intentRef = () => {
                          const identity = active().identity
                          return identity.kind === "new" ? identity.newIntentRef
                            : ("n16-review:" + String(active()!.entity!.id)) as SfIntentRef
                        }
                        return <SfChangeReview
                          operation={{ ref: active().operationRef,
                            label: message(active().entity ? "sf.common.edit" : spec.primary),
                            scope: { kind: "message", message: message(spec.title) } }}
                          base={originalSnapshot(active().entity)}
                          current={originalSnapshot(active().entity)}
                          proposed={{ kind: "draft",
                            intentRef: intentRef(),
                            sourceRef: active().entity ? idOf(active().entity!.id) : null,
                            sourceVersion: sourceVersion(), fields: proposedFields() }}
                          effects={[{ id: "domain-save", domain: "dashboard", state: "proposed",
                            title: { kind: "message", message: message(spec.title) },
                            details: proposedFields() }]}
                          coverage={complete()}
                          blockingReasons={store.unknown ? [message("sf.common.operationUnknown")] : []}
                          confirmation={!store.unknown && admitted("save") &&
                            (!active().entity || version(active().entity!) !== undefined)
                            ? { kind: "admitted", labelKey: k("sf.common.save"), purpose: "save",
                              binding: { kind: "catalog-command", operationId: spec.saveOperation,
                                version: active().entity
                                  ? { kind: "record", expectedVersion: version(active().entity!)! }
                                  : { kind: "none" }, confirmation: "presentation-only" } }
                            : { kind: "blocked", labelKey: k("sf.common.unavailable"),
                              reasons: [message("sf.common.unavailable")] }}
                          state={store.unknown ? "outcome-unknown" : "ready"}
                          onConfirm={() => { void commit("save") }}
                          onRevise={() => setStore("mode", "edit")}
                          onCancel={() => setStore("mode", "edit")}
                          onReconcile={refresh}
                        />
                      }}
                    </Show>
                    <Show when={store.mode === "review-delete" && selected()}>
                      {(row) => <SfChangeReview
                        operation={{ ref: ("n16-delete:" + String(row().id)) as SfOperationRef,
                          label: message("sf.u30.delete"),
                          scope: { kind: "data", text: spec.name(row()) } }}
                        base={originalSnapshot(row())} current={originalSnapshot(row())}
                        proposed={{ kind: "not-provided", reason: message("sf.common.removed") }}
                        effects={[{ id: "domain-delete", domain: "dashboard", state: "proposed",
                          title: { kind: "data", text: spec.name(row()) }, details: [] }]}
                        coverage={complete()}
                        blockingReasons={store.unknown ? [message("sf.common.operationUnknown")] : []}
                        confirmation={!store.unknown && admitted("delete") && version(row()) !== undefined
                          ? { kind: "admitted", labelKey: k("sf.u30.delete"), purpose: "delete",
                            binding: { kind: "catalog-command", operationId: spec.deleteOperation,
                              version: { kind: "record", expectedVersion: version(row())! },
                              confirmation: "presentation-only" } }
                          : { kind: "blocked", labelKey: k("sf.common.unavailable"),
                            reasons: [message("sf.common.unavailable")] }}
                        state={store.unknown ? "outcome-unknown" : "ready"}
                        onConfirm={() => { void commit("delete") }}
                        onRevise={() => setStore("mode", "detail")}
                        onCancel={() => setStore("mode", "detail")}
                        onReconcile={refresh}
                      />}
                    </Show>
                  </section>
                </Show>
              </div>
            </div>
          </Show>
        </SfStatePanel>
      </SfPageFrame>
    </div>
  )
}
