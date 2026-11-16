import { createEffect, createSignal, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import type { JSX } from "solid-js"
import type { Schema } from "effect"
import { useLanguage } from "@/context/language"
import type { SF_U09_COPY } from "@/i18n/orchestra-chapters/sf-u09"
import type { SF_COMMON_COPY } from "@/i18n/orchestra-chapters/sf-common"
import { createSfPlannerClient } from "@orchestra/client/sucafina/planner"
import { SfPlanner } from "@orchestra/schema/sucafina/planner"
import { useSfContext } from "../../context"
import type { SfIntentRef } from "@orchestra/schema/sucafina/context"
import type { SfEditScopeKey, SfRef, SfSurfaceProps } from "../../context/contracts"
import { SfPageFrame } from "../../shared/frame"
import type { SfCopyKey, SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { SfDataTable } from "../../shared/table"
import type { SfSort } from "../../shared/table"
import { SfChangeReview } from "../../shared/change-review"
import type { SfReviewField, SfReviewSnapshot } from "../../shared/change-review"
import type { SfPublicDraftController } from "../../context/contracts"
import "./allocations.css"

type Result = Schema.Schema.Type<(typeof SfPlanner)["operations"]["domain.page.CAP21"]["output"]>
type Authorized = Extract<Result, { status: "ok" }>
type CatalogRow = Authorized["value"]["data"]["entities"][number]
type Catalog = "entities" | "allocations"
type RecordDraft = Readonly<{ collection: Catalog; id: string | null; name: string; detail?: string }>
type Intent = Readonly<{ kind: "save" | "delete" | "common"; collection: Catalog; id: string | null; version: number; ref: string }>
type Copy = keyof typeof SF_U09_COPY | keyof typeof SF_COMMON_COPY
const key = (value: Copy) => value as SfCopyKey
const ref = (value: string) => value as SfRef
const field = (label: Copy, text: string): SfReviewField => ({
  path: label,
  label: { key: key(label) },
  value: { kind: "text", text: { kind: "data", text } },
})

async function hashReviewedCommand(command: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(command))
  const fingerprint = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(fingerprint), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

/** U09/CAP21: a view over A02's exact typed page and commands. No financial
 * distribution or auth rules are implemented in this browser leaf.
 */
export function SfAllocationsView(props: SfSurfaceProps<"CAP21">): JSX.Element {
  const host = useSfContext()
  const language = useLanguage()
  const [screen, setScreen] = createStore<{
    state: SfUiState
    page: Authorized | null
    filter: string
    collection: Catalog
    selected: string | null
    sort: SfSort
    intent: Intent | null
    busy: boolean
    problem: string | null
    lockedOutcome: boolean
  }>({
    state: "loading", page: null, filter: props.route.query.filter ?? "",
    collection: props.route.kind === "allocation" ? "allocations" : "entities",
    selected: props.route.kind === "entity" ? props.route.params.entityRef
      : props.route.kind === "allocation" ? props.route.params.allocationRef : null,
    sort: { kind: "none" }, intent: null, busy: false, problem: null,
    lockedOutcome: false,
  })
  const [draft, setDraft] = createSignal<SfPublicDraftController<RecordDraft> | null>(null)
  const [newIntent, setNewIntent] = createSignal<SfIntentRef | null>(null)
  const canRead = () => host.ready()?.context.destinations.some(
    (item) => item.capabilityId === "CAP21" && item.canRead,
  ) === true
  const can = (action: string) => {
    const ready = host.ready()
    const destination = ready?.context.destinations.find((item) => item.capabilityId === "CAP21")
    return !!screen.page && !!destination?.canRead &&
      destination.allowedActionIds.includes(action) &&
      screen.page.value.allowedActionIds.includes(action) &&
      !screen.lockedOutcome
  }
  const rows = (collection: Catalog) => screen.page?.value.data[collection] ?? []
  const selectedRow = () => rows(screen.collection).find((row) => row.id === screen.selected)
  const currentValue = () => {
    const state = draft()?.snapshot()
    return state?.availability === "active" ? state.value : null
  }
  const selectedDetail = (row: CatalogRow, collection: Catalog) =>
    collection === "entities" ? row.code : row.desc
  const versionFor = (collection: Catalog, id: string | null) =>
    screen.page?.value.versions[collection + ":" + (id ?? "")]?.version ??
    rows(collection).find((row) => row.id === id)?.revision ?? 0
  const sourceState = (): SfUiState => {
    switch (host.state().status) {
      case "ready": return screen.state
      case "resolving": return "loading"
      case "denied": return "denied"
      case "unauthenticated": return "session-expired"
      case "context-mismatch": return "invalid"
      default: return "unavailable"
    }
  }
  const stateMessage = (): Copy => {
    switch (sourceState()) {
      case "ready": return "sf.cap21.shared"
      case "loading": return "sf.common.loading"
      case "empty": return "sf.common.empty"
      case "filtered-empty": return "sf.common.filterEmpty"
      case "denied": return "sf.common.noAccess"
      case "session-expired": return "sf.common.loginAgain"
      case "not-found": return "sf.common.removed"
      case "outcome-unknown": return "sf.common.operationUnknown"
      case "conflict": return "sf.common.conflict"
      case "stale": return "sf.common.stale"
      case "invalid": return "sf.common.invalidLink"
      default: return "sf.common.unavailable"
    }
  }
  const read = async (signal: AbortSignal, generation: number) => {
    const owner = host.ready()
    if (!owner || !canRead()) return
    const client = createSfPlannerClient(owner.transport)
    const query = props.route.query.year === undefined ? {} : { year: props.route.query.year }
    const result = await client["domain.page.CAP21"](query, { signal }).catch(() => {
      console.error("N20 CAP21: authorized source read failed")
      return { kind: "transport-error", reason: "network" } as const
    })
    if (signal.aborted || host.generation() !== generation || !host.ready()) return
    if (result.kind !== "response") {
      setScreen("state", "unavailable")
      setScreen("problem", result.reason)
      return
    }
    if (result.body.status === "ok") {
      if (result.body.context.installationId !== owner.context.stamp.installationId ||
          result.body.context.projectId !== owner.context.stamp.projectId ||
          result.body.context.hostId !== owner.context.stamp.hostId ||
          result.body.context.principalRef !== owner.context.stamp.principalRef) {
        setScreen({ page: null, state: "denied", problem: null })
        host.invalidate("host-changed")
        return
      }
      setScreen("page", result.body)
      setScreen("problem", null)
      if (!screen.lockedOutcome) setScreen("state", "ready")
      const current = currentValue()
      if (current?.id) {
        const source = result.body.value.data[current.collection].find((row) => row.id === current.id)
        const controller = draft()
        if (controller && source) {
          const remote: RecordDraft = {
            collection: current.collection, id: source.id, name: source.name,
            ...(selectedDetail(source, current.collection) === undefined ? {}
              : { detail: selectedDetail(source, current.collection) }),
          }
          controller.receiveRemote({ baseVersion: source.revision, value: remote })
        }
      }
      if (props.route.kind === "entity" && !result.body.value.data.entities.some(
        (row) => row.id === props.route.params.entityRef,
      )) setScreen("state", "not-found")
      if (props.route.kind === "allocation" && !result.body.value.data.allocations.some(
        (row) => row.id === props.route.params.allocationRef,
      )) setScreen("state", "not-found")
      return
    }
    const status = result.body.status
    if (status === "denied" || status === "unauthenticated") {
      setScreen({ state: status === "denied" ? "denied" : "session-expired", page: null, intent: null })
      setDraft(null)
      return
    }
    setScreen("state", status === "stale" ? "stale" : status === "invalid" || status === "needs-input" ? "invalid" : "unavailable")
    setScreen("problem", result.body.reason)
  }
  createEffect(() => {
    const status = host.state().status
    const generation = host.generation()
    const year = props.route.query.year
    const controller = new AbortController()
    if (status !== "ready" || !host.ready() || !canRead()) {
      setScreen({ page: null, state: status === "denied" || status === "ready" ? "denied" : "loading", intent: null })
      setDraft(null)
    } else {
      void read(controller.signal, generation)
    }
    onCleanup(() => controller.abort())
    void year
  })
  const refresh = () => {
    const controller = new AbortController()
    void read(controller.signal, host.generation())
  }
  const ordered = (collection: Catalog) => {
    const filter = screen.filter.trim().toLocaleLowerCase()
    const items = rows(collection).filter((row) =>
      !filter || [row.name, selectedDetail(row, collection), row.id]
        .some((value) => value?.toLocaleLowerCase().includes(filter)),
    )
    if (screen.sort.kind === "none") return items
    const column = screen.sort.key
    return [...items].sort((left, right) => {
      const value = (row: CatalogRow) => column === "name" ? row.name
        : column === "detail" ? selectedDetail(row, collection) ?? "" : row.id
      const compare = value(left).localeCompare(value(right), undefined, { numeric: true })
      return screen.sort.kind === "field" && screen.sort.direction === "desc" ? -compare : compare
    })
  }
  const showDetail = (collection: Catalog, id: string) => {
    setScreen({ collection, selected: id, intent: null, problem: null })
  }
  const begin = (collection: Catalog, row?: CatalogRow) => {
    if (!can("save")) return
    const owner = host.ready()
    if (!owner) return
    setScreen({ collection, selected: row?.id ?? null, intent: null, problem: null })
    const intent = row ? null : crypto.randomUUID() as SfIntentRef
    setNewIntent(intent)
    const value: RecordDraft = {
      collection, id: row?.id ?? null, name: row?.name ?? "",
      ...(row && selectedDetail(row, collection) === undefined ? {}
        : { detail: row ? selectedDetail(row, collection) : "" }),
    }
    const version = row ? versionFor(collection, row.id) : null
    const controller = owner.drafts.acquire<RecordDraft>({
      surfaceId: "CAP21", editScopeKey: ("shared-catalog:" + collection) as SfEditScopeKey,
      identity: row ? { kind: "record", recordRef: ref(row.id) }
        : { kind: "new", newIntentRef: intent! },
      baseVersion: version, base: row ? value : null, value,
      revalidation: {
        operationId: "domain.page.CAP21",
        input: props.route.query.year === undefined ? {} : { year: props.route.query.year },
        fieldPaths: row ? ["id", "name", ...(selectedDetail(row, collection) === undefined ? []
          : [collection === "entities" ? "code" : "desc"])] : [],
        actionIds: ["save"],
      },
    })
    setDraft(controller)
  }
  const discard = () => {
    const state = draft()?.snapshot()
    if (state?.availability === "active" && state.dirty &&
        !window.confirm(language.t("sf.cap21.discard-confirm"))) return
    draft()?.discard()
    setDraft(null)
    setNewIntent(null)
    setScreen({ intent: null, problem: null })
  }
  const prepare = (kind: Intent["kind"], collection: Catalog, id: string | null) => {
    if (!can(kind === "common" ? "common" : kind === "delete" ? "delete" : "save")) return
    const version = versionFor(collection, kind === "common" ? "common" : id)
    const value = currentValue()
    if (kind === "save" && (!value || !value.name.trim())) {
      draft()?.setPhase("validation-error")
      setScreen("problem", language.t("sf.cap21.field.name.label"))
      return
    }
    if (kind === "save") draft()?.setPhase("reviewing")
    setScreen({ intent: { kind, collection, id, version, ref: crypto.randomUUID() }, problem: null })
  }
  const submit = async () => {
    const intent = screen.intent
    const owner = host.ready()
    if (!intent || !owner || screen.busy || !can(intent.kind === "common" ? "common" : intent.kind)) return
    const prior = draft()?.snapshot()
    if (intent.kind === "save" && (!prior || prior.availability !== "active" ||
        prior.conflict !== null || prior.pendingOperation !== null ||
        !Object.is(prior.baseVersion, intent.id === null ? null : intent.version))) {
      setScreen({ state: "conflict", problem: language.t("sf.common.conflict") })
      return
    }
    const client = createSfPlannerClient(owner.transport)
    const generation = host.generation()
    const options = { signal: new AbortController().signal, idempotencyKey: crypto.randomUUID() }
    const value = currentValue()
    const command = (() => {
      if (intent.kind === "common") {
        const input = {
          page: "Entities & allocations", action: "common", version: intent.version,
          values: { collection: "allocations" },
        } as const
        return { input, call: () => client["domain.command.CAP21.common"](input, options) }
      }
      if (intent.kind === "delete") {
        const input = {
          page: "Entities & allocations", action: "delete", ...(intent.id ? { id: intent.id } : {}),
          version: intent.version, values: { collection: intent.collection },
        } as const
        return { input, call: () => client["domain.command.CAP21.delete"](input, options) }
      }
      const input = {
        page: "Entities & allocations", action: "save", ...(intent.id ? { id: intent.id } : {}),
        version: intent.version,
        values: {
          collection: intent.collection, name: value!.name,
          ...(value?.detail === undefined ? {} :
            intent.collection === "entities" ? { code: value.detail } : { desc: value.detail }),
        },
      } as const
      return { input, call: () => client["domain.command.CAP21.save"](input, options) }
    })()
    setScreen({ busy: true, problem: null })
    let digest: string
    try {
      digest = await hashReviewedCommand(command.input)
    } catch {
      setScreen({ busy: false, state: "unavailable", problem: language.t("sf.common.unavailable") })
      console.error("N20 CAP21: command fingerprint unavailable; write not submitted")
      return
    }
    if (host.generation() !== generation || !host.ready()) return
    const bindPending = () => {
      if (intent.kind !== "save") return
      draft()?.setPending({
        operationRef: ref(intent.ref) as Parameters<NonNullable<ReturnType<typeof draft>>["setPending"]>[0]["operationRef"],
        idempotencyKey: options.idempotencyKey,
        payloadDigest: digest,
        expectedVersion: intent.id === null ? null : intent.version,
      })
    }
    const result = await command.call().catch(() => {
      console.error("N20 CAP21: submitted command delivery failed; outcome unconfirmed")
      return { kind: "transport-error", reason: "outcome-unknown" } as const
    })
    if (host.generation() !== generation || !host.ready()) return
    setScreen("busy", false)
    if (result.kind !== "response") {
      if (result.reason !== "contract-unavailable" && result.reason !== "contract-mismatch") {
        bindPending()
        draft()?.setPhase("outcome-unknown")
        setScreen({ state: "outcome-unknown", lockedOutcome: true, problem: null })
      } else {
        setScreen({ state: "unavailable", problem: result.reason })
        draft()?.setPhase("failed")
      }
      return
    }
    if (!result.body.ok) {
      const status = result.body.status
      setScreen("state", status === 409 ? "conflict" : status === 403 ? "denied"
        : status === 404 ? "not-found" : status === 422 || status === 400 ? "invalid" : "unavailable")
      setScreen("problem", result.body.errors?.join("; ") ?? language.t("sf.cap21.errors"))
      if (status === 403) { setScreen({ page: null, intent: null }); setDraft(null) }
      if (status === 409) draft()?.setPhase("conflict")
      else draft()?.setPhase("validation-error")
      return
    }
    if (intent.kind === "save") {
      bindPending()
      draft()?.confirmSave({
        kind: "confirmed-without-projection",
        operationRef: ref(intent.ref) as Parameters<NonNullable<ReturnType<typeof draft>>["confirmSave"]>[0]["operationRef"],
        resultVersion: null,
      })
      if (draft()?.snapshot().availability === "confirmed-without-projection") setDraft(null)
    }
    if (intent.kind === "delete") setScreen("selected", null)
    setScreen({ intent: null, problem: null, state: "loading" })
    await read(new AbortController().signal, generation)
  }
  const selectedDraft = () => currentValue()
  const reviewFields = (value: RecordDraft): SfReviewField[] => [
    field("sf.cap21.field.name.label", value.name),
    ...(value.detail === undefined ? [] : [field(
      value.collection === "entities" ? "sf.cap21.field.code.label" : "sf.cap21.field.desc.label",
      value.detail,
    )]),
  ]
  const revisionSnapshot = (): SfReviewSnapshot | null => {
    const intent = screen.intent
    if (!intent || intent.kind === "common") return null
    const row = rows(intent.collection).find((item) => item.id === intent.id)
    if (!row) return null
    return {
      kind: "persisted", ref: ref(row.id), version: versionFor(intent.collection, row.id),
      fields: reviewFields({
        collection: intent.collection, id: row.id, name: row.name,
        ...(selectedDetail(row, intent.collection) === undefined ? {}
          : { detail: selectedDetail(row, intent.collection) }),
      }),
    }
  }
  const proposedSnapshot = (): SfReviewSnapshot => {
    const intent = screen.intent!
    const value = selectedDraft()
    if (intent.kind === "common") return {
      kind: "draft", intentRef: (newIntent() ?? intent.ref) as SfIntentRef,
      sourceRef: null, sourceVersion: intent.version,
      fields: [field("sf.cap21.common-scope", language.t("sf.cap21.common-warning"))],
    }
    if (intent.kind === "delete") return {
      kind: "draft", intentRef: intent.ref as SfIntentRef,
      sourceRef: intent.id ? ref(intent.id) : null, sourceVersion: intent.version,
      fields: [field("sf.cap21.review-delete", selectedRow()?.name ?? intent.id ?? "")],
    }
    return {
      kind: "draft", intentRef: (newIntent() ?? intent.ref) as SfIntentRef,
      sourceRef: intent.id ? ref(intent.id) : null, sourceVersion: intent.version,
      fields: value ? reviewFields(value) : [],
    }
  }
  const reviewTitle = (): Copy =>
    screen.intent?.kind === "common" ? "sf.cap21.review-common"
      : screen.intent?.kind === "delete" ? "sf.cap21.review-delete" : "sf.cap21.review-save"
  const sectionRows = (collection: Catalog) => (
    <section class="sf-n20-catalog" data-sf-catalog={collection}>
      <div class="sf-n20-catalog-heading">
        <h2>{language.t(collection === "entities" ? "sf.cap21.entity" : "sf.cap21.allocation")}</h2>
        <button type="button" class="mx-btn" disabled={!can("save")}
          onClick={() => begin(collection)}>
          {language.t(collection === "entities" ? "sf.cap21.action.create-entity" : "sf.cap21.action.create-allocation")}
        </button>
      </div>
      <Show when={rows(collection).length > 0 && ordered(collection).length === 0}>
        <p role="status">{language.t("sf.common.filterEmpty")}</p>
        <button type="button" class="mx-link" onClick={() => setScreen("filter", "")}>
          {language.t("sf.cap21.clear-filter")}
        </button>
      </Show>
      <SfDataTable<CatalogRow>
        rows={ordered(collection)}
        getRowKey={(row) => ref(row.id)}
        columns={[
          { id: "name", labelKey: key("sf.cap21.field.name.label"), align: "start",
            widthPolicy: { kind: "flex", minPx: 140, weight: 2 }, sortKey: "name",
            render: (row) => <bdi>{row.name}</bdi> },
          { id: "detail", labelKey: key(collection === "entities" ? "sf.cap21.field.code.label" : "sf.cap21.field.desc.label"),
            align: "start", widthPolicy: { kind: "flex", minPx: 140, weight: 1 },
            render: (row) => <bdi>{selectedDetail(row, collection) ?? language.t("sf.cap21.missing")}</bdi> },
        ]}
        selectedKey={screen.collection === collection && screen.selected ? ref(screen.selected) : undefined}
        sort={screen.sort} onSort={(value) => setScreen("sort", value)}
        page={{ kind: "none", total: rows(collection).length }}
        onPage={() => undefined}
        onSelect={(value) => showDetail(collection, value)}
        rowActions={() => [
          { id: "edit", labelKey: key("sf.common.edit"), tone: "secondary", disabled: !can("save"), busy: screen.busy },
          { id: "delete", labelKey: key("sf.cap21.action.delete"), tone: "danger", disabled: !can("delete"), busy: screen.busy },
        ]}
        onRowAction={(request) => {
          const row = rows(collection).find((item) => item.id === request.recordRef)
          if (!row) return
          showDetail(collection, row.id)
          if (request.actionId === "edit") begin(collection, row)
          if (request.actionId === "delete") prepare("delete", collection, row.id)
        }}
        captionKey={key(collection === "entities" ? "sf.cap21.entity" : "sf.cap21.allocation")}
        density="comfortable" state={screen.state === "ready" ? "ready" : screen.state}
      />
    </section>
  )
  return (
    <SfPageFrame titleKey={key("sf.cap21.title")}
      context={[]}
      tabs={[]} activeTab={null}
      primaryAction={{
        id: "add", labelKey: key("sf.cap21.primary"), tone: "primary",
        disabled: !can("save"), busy: screen.busy, onInvoke: () => begin(screen.collection),
      }}
      secondaryActions={[
        { id: "common", labelKey: key("sf.cap21.action.common"), tone: "secondary",
          disabled: !can("common"), busy: screen.busy,
          onInvoke: () => prepare("common", "allocations", null) },
      ]}
      density="comfortable" layout="work" onLayoutMode={() => undefined}
    >
      <SfStatePanel state={sourceState()} messageKey={key(stateMessage())}
        onRetryRead={refresh}
        onBack={() => { setScreen("selected", null); setScreen("state", "ready") }}
      >
        <div class="sf-n20-allocations" data-sf-surface="CAP21">
          <p>{language.t("sf.cap21.shared")}</p>
          <div class="sf-n20-toolbar">
            <label>
              <span>{language.t("sf.cap21.search")}</span>
              <input type="search" class="mx-input" value={screen.filter}
                onInput={(event) => setScreen("filter", event.currentTarget.value)} />
            </label>
            <Show when={can("import-workbook")}>
              <p class="sf-n20-source-only">{language.t("sf.cap21.import-hint")}</p>
            </Show>
          </div>
          <div class="sf-n20-catalog-grid">
            {sectionRows("entities")}
            {sectionRows("allocations")}
          </div>
          <Show when={screen.selected && !draft() && !screen.intent}>
            <section class="mx-card sf-n20-detail" aria-labelledby="sf-n20-detail-heading">
              <h2 id="sf-n20-detail-heading">{language.t("sf.cap21.detail")}</h2>
              <Show when={selectedRow()} keyed fallback={<p>{language.t("sf.common.removed")}</p>}>
                {(row) => (
                  <dl>
                    <dt>{language.t("sf.cap21.id")}</dt><dd><bdi>{row.id}</bdi></dd>
                    <dt>{language.t("sf.cap21.field.name.label")}</dt><dd><bdi>{row.name}</bdi></dd>
                    <dt>{language.t(screen.collection === "entities" ? "sf.cap21.field.code.label" : "sf.cap21.field.desc.label")}</dt>
                    <dd><bdi>{selectedDetail(row, screen.collection) ?? language.t("sf.cap21.missing")}</bdi></dd>
                    <dt>{language.t("sf.cap21.current-version")}</dt><dd>{versionFor(screen.collection, row.id)}</dd>
                  </dl>
                )}
              </Show>
            </section>
          </Show>
          <Show when={currentValue() && !screen.intent && !screen.lockedOutcome}>
            {(value) => (
              <form class="mx-card sf-n20-editor" onSubmit={(event) => {
                event.preventDefault()
                prepare("save", value().collection, value().id)
              }}>
                <h2>{language.t(value().collection === "entities" ? "sf.cap21.action.create-entity" : "sf.cap21.action.create-allocation")}</h2>
                <label>
                  <span>{language.t("sf.cap21.field.name.label")}</span>
                  <input class="mx-input" required value={value().name}
                    onInput={(event) => draft()?.edit({ ...value(), name: event.currentTarget.value })} />
                </label>
                <Show when={value().detail !== undefined}>
                  <label>
                    <span>{language.t(value().collection === "entities" ? "sf.cap21.field.code.label" : "sf.cap21.field.desc.label")}</span>
                    <input class="mx-input" value={value().detail ?? ""}
                      onInput={(event) => draft()?.edit({ ...value(), detail: event.currentTarget.value })} />
                  </label>
                </Show>
                <div class="sf-n20-actions">
                  <button class="mx-btn primary" type="submit" disabled={!can("save") || screen.busy}>
                    {language.t("sf.common.review")}
                  </button>
                  <button type="button" class="mx-btn" onClick={discard}>
                    {language.t("sf.common.discard")}
                  </button>
                </div>
              </form>
            )}
          </Show>
          <Show when={screen.intent}>
            {(intent) => (
              <section class="sf-n20-review" aria-label={language.t(reviewTitle())}>
                <SfChangeReview
                  operation={{
                    ref: intent().ref as Parameters<typeof SfChangeReview>[0]["operation"]["ref"],
                    label: { key: key(reviewTitle()) },
                    scope: { kind: "data", text: intent().collection },
                  }}
                  base={revisionSnapshot()} current={revisionSnapshot()} proposed={proposedSnapshot()}
                  effects={[]}
                  coverage={{
                    state: "partial", summary: { key: key("sf.common.partial") },
                    reasons: [], knownCount: null, expectedCount: null,
                  }}
                  blockingReasons={[]}
                  confirmation={{
                    kind: "admitted", labelKey: key(intent().kind === "delete" ? "sf.cap21.action.delete" :
                      intent().kind === "common" ? "sf.cap21.action.common" : "sf.cap21.action.save"),
                    purpose: intent().kind === "common" ? "common" : intent().kind,
                    binding: {
                      kind: "catalog-command",
                      operationId: intent().kind === "common" ? "domain.command.CAP21.common"
                        : intent().kind === "delete" ? "domain.command.CAP21.delete" : "domain.command.CAP21.save",
                      version: { kind: "record", expectedVersion: intent().version },
                      confirmation: "presentation-only",
                    },
                  }}
                  state={screen.busy ? "loading" : "ready"}
                  onConfirm={() => { void submit() }}
                  onRevise={() => { draft()?.setPhase("dirty"); setScreen("intent", null) }}
                  onCancel={() => { draft()?.setPhase("dirty"); setScreen("intent", null) }}
                />
                <Show when={intent().kind === "delete" || intent().kind === "common"}>
                  <p>{language.t(intent().kind === "delete" ? "sf.cap21.delete-warning" : "sf.cap21.common-warning")}</p>
                </Show>
              </section>
            )}
          </Show>
          <Show when={screen.problem}>
            {(problem) => <p role="alert" class="sf-n20-error"><bdi>{problem()}</bdi></p>}
          </Show>
        </div>
      </SfStatePanel>
    </SfPageFrame>
  )
}
