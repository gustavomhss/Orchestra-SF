import { createEffect, For, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useNavigate } from "@solidjs/router"
import type { SfEditScopeKey, SfIntentRef, SfOperationRef, SfRef } from "@orchestra/schema/sucafina/context"
import { createSfPlannerClient } from "@orchestra/client/sucafina/planner"
import type { SfSurfaceProps, SfPublicDraftController } from "../../context/contracts"
import { SfPageFrame, SfContextBar } from "../../shared/frame"
import type { SfAction, SfCopyKey, SfDisplayValue, SfLayoutMode, SfMessage, SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { SfDataTable } from "../../shared/table"
import { SfRecordDetail } from "../../shared/detail"
import {
  SfChangeReview, type SfReviewField, type SfReviewSnapshot, type SfReviewPurpose,
} from "../../shared/change-review"
import { useSfPresentation } from "../../shared/frame/presentation"
import { SF_U46_COPY } from "@/i18n/orchestra-chapters/sf-u46"
import { plannerHref, useSfPlannerVersions, type PlannerVersion } from "./model"
import "./versions.css"

type CommandAction = "save" | "copy" | "official" | "lock" | "unlock" | "delete"
type EditableVersion = Readonly<{ name: string; year: number }>
const op = {
  save: "domain.command.CAP23.save",
  copy: "domain.command.CAP23.copy",
  official: "domain.command.CAP23.official",
  lock: "domain.command.CAP23.lock",
  unlock: "domain.command.CAP23.unlock",
  delete: "domain.command.CAP23.delete",
} as const
type Review = Readonly<{
  ref: SfOperationRef
  action: CommandAction
  versionId: string
  expected: number
  version: PlannerVersion | null
  proposed: EditableVersion
  first: boolean
  copyNameProvided: boolean
  idempotencyKey: string
}>
const key = (value: keyof typeof SF_U46_COPY | "sf.common.loading" | "sf.common.empty" |
  "sf.common.unavailable" | "sf.common.noAccess" | "sf.common.invalidLink" |
  "sf.common.stale" | "sf.common.loginAgain" | "sf.common.partial" |
  "sf.common.operationUnknown" | "sf.common.conflict" | "sf.common.saved" |
  "sf.common.review" | "sf.common.currentSource" | "sf.common.returnToList" |
  "sf.common.pending" | "sf.common.failed" | "sf.common.filterEmpty" | "sf.common.removed"): SfCopyKey => value as SfCopyKey
const msg = (value: keyof typeof SF_U46_COPY, params?: Record<string, string | number>): SfMessage =>
  ({ key: key(value), params })
const data = (text: string) => ({ kind: "data" as const, text })
const textValue = (text: string): SfDisplayValue => ({ kind: "text", text: data(text) })
const yearValue = (value: number): SfDisplayValue => ({
  kind: "number", value, fractionDigits: 0, unit: { kind: "unspecified", label: msg("sf.u46.year") },
})

function stateCopy(value: SfUiState): SfCopyKey {
  switch (value) {
    case "loading": return key("sf.common.loading")
    case "empty": return key("sf.common.empty")
    case "filtered-empty": return key("sf.common.filterEmpty")
    case "not-found": return key("sf.common.removed")
    case "denied": return key("sf.common.noAccess")
    case "session-expired": return key("sf.common.loginAgain")
    case "invalid": return key("sf.common.invalidLink")
    case "stale": return key("sf.common.stale")
    case "conflict": return key("sf.common.conflict")
    case "outcome-unknown": return key("sf.common.operationUnknown")
    default: return key("sf.common.unavailable")
  }
}

export function SfPlannerVersionsView(props: SfSurfaceProps<"CAP23">) {
  const model = useSfPlannerVersions(props)
  const navigate = useNavigate()
  const copy = useSfPresentation()
  const [screen, setScreen] = createStore<{
    layout: SfLayoutMode
    draft: SfPublicDraftController<EditableVersion> | undefined
    draftId: string | undefined
    copyName: string
    review: Review | undefined
    busy: boolean
    outcome: "idle" | "unknown" | "failed" | "conflict" | "succeeded"
    error: string | undefined
    verified: Readonly<{ ref: SfOperationRef; action: CommandAction; versionId: string;
      expected: number; requestNumber: number; beforeCount: number; createdRef: string | undefined }> | undefined
  }>({ layout: "single", draft: undefined, draftId: undefined, copyName: "",
    review: undefined, busy: false, outcome: "idle", error: undefined, verified: undefined })
  let commandAbort: AbortController | undefined

  createEffect(() => {
    model.owner.generation()
    commandAbort?.abort()
    setScreen({ review: undefined, busy: false, outcome: "idle", error: undefined, verified: undefined,
      draft: undefined, draftId: undefined, copyName: "" })
  })
  onCleanup(() => commandAbort?.abort())

  const page = () => model.view.page
  const year = () => props.route.query.year ?? page()?.selection.year
  const records = () => page()?.data.versions.filter((record) => year() === undefined || record.year === year()) ?? []
  const routeRecordId = () => props.route.kind === "detail" ? props.route.params.versionRef : undefined
  const record = () => page()?.data.versions.find((version) => version.id === routeRecordId())
  const pageState = (): SfUiState => page() && props.route.kind === "detail" && !record()
    ? "not-found" : model.view.state === "ready" && !records().length
      ? "filtered-empty" : model.view.state
  const go = (destination: "overview" | "versions" | "new" | "compare" | "detail" | "import", options?: { year?: number; versionRef?: string }) =>
    navigate(plannerHref(props.route, destination, options))

  // The owner-scoped F01/S03 draft remains alive when this leaf unmounts.
  // An access change makes F01 quarantine/revoke it; do not persist locally.
  createEffect(() => {
    const ready = model.owner.ready()
    const current = record()
    const revision = current && page()
      ? page()!.versions["versions:" + current.id]?.version ?? 0 : undefined
    if (!ready || !current || revision === undefined || !model.can("save")) {
      setScreen({ draftId: undefined, draft: undefined })
      return
    }
    const next = ready.drafts.acquire<EditableVersion>({
      surfaceId: "CAP23",
      identity: { kind: "record", recordRef: current.id as SfRef },
      editScopeKey: ("planner:" + current.year + ":" + current.id) as SfEditScopeKey,
      baseVersion: revision,
      base: { name: current.name, year: current.year },
      value: { name: current.name, year: current.year },
      revalidation: {
        operationId: "domain.page.CAP23", input: { year: current.year },
        fieldPaths: ["data.versions", "versions"],
        actionIds: ["save"],
      },
    })
    setScreen({ draftId: current.id, draft: next })
    const snapshot = next.snapshot()
    if (snapshot.availability === "active" && snapshot.baseVersion !== revision)
      next.receiveRemote({ baseVersion: revision, value: { name: current.name, year: current.year } })
  })

  const draftValue = (): EditableVersion | undefined => {
    if (!record() || record()?.id !== screen.draftId) return undefined
    const state = screen.draft?.snapshot()
    return state?.availability === "active" ? state.value : undefined
  }
  // Original producer contract.ts conflict() and renderer revision() both
  // define a never-written CAS key as revision zero, not "not authorized".
  // Record presence and model.can() remain mandatory before a command.
  const currentCas = (item: PlannerVersion, action: CommandAction): number | undefined =>
    page() ? page()!.versions[action === "official" ? "officials:" + item.year : "versions:" + item.id]?.version ?? 0 : undefined

  const allowed = (item: PlannerVersion | null, action: CommandAction, first = false) => {
    if (!page() || screen.busy || screen.outcome === "unknown" || !model.can(action)) return false
    if (first) return action === "save" && page()!.data.versions.length === 0
    if (!item || currentCas(item, action) === undefined) return false
    if ((action === "unlock" || action === "delete") && item.official) return false
    if (action === "lock" && item.locked) return false
    if (action === "unlock" && !item.locked) return false
    return true
  }
  const begin = (action: CommandAction, version: PlannerVersion | null, first = false) => {
    if (!allowed(version, action, first)) return
    if (action === "save" && !first && screen.draft?.snapshot().availability === "active" &&
      !screen.draft.snapshot().dirty) return
    const revision = first ? page()?.versions["versions:first"]?.version ?? 0
      : version && currentCas(version, action)
    if (revision === undefined) return
    const draft = draftValue()
    const proposed = first ? { name: "", year: year() ?? page()!.selection.year }
      : action === "save" && version && draft ? draft
        : version ? { name: action === "copy" && screen.copyName.trim() ? screen.copyName.trim() : version.name, year: version.year }
          : { name: "", year: page()!.selection.year }
    if (action === "save" && !first && !proposed.name.trim()) {
      setScreen({ error: "name", outcome: "failed" })
      return
    }
    if (action === "save" && !first && (!Number.isInteger(proposed.year) || proposed.year <= 2000 || proposed.year >= 2100)) {
      setScreen({ error: "year", outcome: "failed" })
      return
    }
    if (version && version.year !== proposed.year && (version.locked || version.official)) return
    const request: Review = {
      ref: crypto.randomUUID() as SfOperationRef, action, versionId: version?.id ?? "", expected: revision,
      version, proposed, first, copyNameProvided: !!screen.copyName.trim(), idempotencyKey: crypto.randomUUID(),
    }
    if (action === "save" && !first) screen.draft?.setPhase("reviewing")
    setScreen({ review: request, busy: false, outcome: "idle", error: undefined })
  }

  const submit = async (request: Review) => {
    if (screen.busy || screen.outcome !== "idle" || screen.verified || screen.review?.ref !== request.ref) return
    const ready = model.owner.ready()
    const active = model.owner.state()
    if (!ready || active.status !== "ready" || !model.can(request.action)) return
    if (request.first) {
      if (page()?.data.versions.length !== 0 || (page()?.versions["versions:first"]?.version ?? 0) !== request.expected) return
    } else {
      const fresh = page()?.data.versions.find((version) => version.id === request.versionId)
      if (!fresh || currentCas(fresh, request.action) !== request.expected) {
        setScreen({ outcome: "conflict", error: "stale" })
        return
      }
    }
    if (request.action === "save" && !request.first) {
      const draft = screen.draft?.snapshot()
      if (screen.draftId !== request.versionId || draft?.availability !== "active" ||
          draft.conflict || draft.baseVersion !== request.expected ||
          draft.value.name !== request.proposed.name || draft.value.year !== request.proposed.year) {
        setScreen({ outcome: "conflict", error: "stale" })
        return
      }
    }
    const generation = model.owner.generation()
    const beforeCount = page()?.data.versions.length ?? 0
    // A locked or official version rejects a year field, even for name-only edits.
    const saveValues = request.first ? {} : {
      name: request.proposed.name,
      ...(request.version && request.proposed.year !== request.version.year
        ? { year: request.proposed.year } : {}),
    }
    const abort = new AbortController()
    commandAbort = abort
    setScreen({ busy: true, outcome: "idle", error: undefined })
    try {
      if (request.action === "save" && !request.first && screen.draft) {
        const reviewedPayload = JSON.stringify({
          operationId: op.save, versionId: request.versionId, expected: request.expected,
          values: saveValues,
        })
        const digestBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(reviewedPayload))
        if (abort.signal.aborted || generation !== model.owner.generation()) return
        const digest = Array.from(new Uint8Array(digestBytes), (byte) =>
          byte.toString(16).padStart(2, "0")).join("")
        screen.draft.setPending({
          operationRef: request.ref, idempotencyKey: request.idempotencyKey,
          payloadDigest: digest, expectedVersion: request.expected,
        })
        const admitted = screen.draft.snapshot()
        if (admitted.availability !== "active" || admitted.pendingOperation?.operationRef !== request.ref) {
          setScreen({ outcome: "conflict", error: "stale", busy: false })
          return
        }
        screen.draft.setPhase("submitting")
      }
      const client = createSfPlannerClient(ready.transport)
      const options = { signal: abort.signal, idempotencyKey: request.idempotencyKey }
      const command = { page: "Versions" as const, id: request.versionId || undefined,
        version: request.expected, confirmed: true }
      // Each case is a source-locked catalog operation; never a generic action dispatcher.
      const result = request.action === "save"
        ? await client["domain.command.CAP23.save"]({
          ...command, action: "save", values: saveValues,
        }, options)
        : request.action === "copy"
          ? await client["domain.command.CAP23.copy"]({
            ...command, action: "copy", values: request.copyNameProvided ? { name: request.proposed.name } : {},
          }, options)
          : request.action === "official"
            ? await client["domain.command.CAP23.official"]({ ...command, action: "official", values: {} }, options)
            : request.action === "lock"
              ? await client["domain.command.CAP23.lock"]({ ...command, action: "lock", values: {} }, options)
              : request.action === "unlock"
                ? await client["domain.command.CAP23.unlock"]({ ...command, action: "unlock", values: {} }, options)
                : await client["domain.command.CAP23.delete"]({ ...command, action: "delete", values: {} }, options)
      if (abort.signal.aborted || model.owner.generation() !== generation || screen.review?.ref !== request.ref) return
      if (result.kind !== "response") {
        setScreen({ outcome: result.reason === "outcome-unknown" ? "unknown" : "failed", busy: false, error: result.reason })
        if (request.action === "save" && !request.first)
          screen.draft?.setPhase(result.reason === "outcome-unknown" ? "outcome-unknown" : "failed")
        return
      }
      if (!result.body.ok) {
        setScreen({ outcome: result.body.status === 409 ? "conflict" : "failed", busy: false,
          error: result.body.errors?.join("; ") ?? String(result.body.status) })
        if (request.action === "save" && !request.first)
          screen.draft?.setPhase(result.body.status === 409 ? "conflict" : "failed")
        return
      }
      // Creation/copy must return an exact source-assigned identity. Another
      // writer increasing the count is not proof of this command.
      const createdRef = request.first || request.action === "copy"
        ? typeof result.body.value === "string" && result.body.value ? result.body.value : undefined
        : undefined
      if ((request.first || request.action === "copy") && !createdRef) {
        setScreen({ busy: false, outcome: "unknown", error: "missing-created-reference" })
        return
      }
      // Do not allow a second command while the authorized readback is pending.
      setScreen({ busy: true, outcome: "succeeded", error: undefined,
        verified: { ref: request.ref, action: request.action, versionId: request.versionId,
          expected: request.expected, requestNumber: model.view.request + 1, beforeCount, createdRef } })
      model.refresh()
    } catch (error) {
      if (abort.signal.aborted || model.owner.generation() !== generation) return
      console.error("Sucafina Planner version command failed", error instanceof Error ? error.name : "unknown")
      setScreen({ busy: false, outcome: "unknown", error: "outcome-unknown" })
      if (request.action === "save" && !request.first) screen.draft?.setPhase("outcome-unknown")
    }
  }

  createEffect(() => {
    const verified = screen.verified
    const current = page()
    if (!verified || !current || model.view.loadedRequest < verified.requestNumber ||
        (model.view.state !== "ready" && model.view.state !== "empty")) return
    const projected = current.data.versions.find((version) => version.id === verified.versionId)
    const revision = projected && current.versions["versions:" + projected.id]?.version
    const created = current.data.versions.find((version) => version.id === verified.createdRef)
    const createdRevision = created && current.versions["versions:" + created.id]?.version
    const reviewed = screen.review
    const proven = verified.action === "save" ? verified.versionId
      ? !!projected && revision !== undefined && revision !== verified.expected &&
        projected.name === reviewed?.proposed.name && projected.year === reviewed.proposed.year
      : !!created && createdRevision !== undefined && current.data.versions.length > verified.beforeCount
      : verified.action === "copy" ? !!created && createdRevision !== undefined &&
          created.id !== verified.versionId && created.year === reviewed?.version?.year &&
          (!reviewed?.copyNameProvided || created.name === reviewed?.proposed.name)
      : verified.action === "official" ? !!projected?.official && projected.locked &&
          current.versions["officials:" + projected.year]?.version !== verified.expected
      : verified.action === "lock" ? !!projected?.locked && revision !== undefined && revision !== verified.expected
      : verified.action === "unlock" ? !!projected && !projected.locked &&
          revision !== undefined && revision !== verified.expected
      : verified.action === "delete" && !projected
    if (!proven) {
      setScreen({ verified: undefined, outcome: "conflict", error: "stale", busy: false })
      return
    }
    if (verified.action === "save" && projected && revision !== undefined && screen.draft) {
      screen.draft.confirmSave({
        kind: "projected", operationRef: verified.ref, baseVersion: revision,
        value: { name: projected.name, year: projected.year },
      })
    }
    setScreen({ verified: undefined, review: undefined, outcome: "idle", error: undefined, copyName: "", busy: false })
    if (created && (verified.action === "copy" || !verified.versionId)) {
      go("detail", { year: created.year, versionRef: created.id })
    } else if (verified.action === "delete" && props.route.kind === "detail") {
      go("versions", { year: reviewed?.version?.year })
    }
  })

  const fields = (item: EditableVersion): readonly SfReviewField[] => [
    { path: "name", label: msg("sf.u46.name"), value: textValue(item.name) },
    { path: "year", label: msg("sf.u46.year"), value: yearValue(item.year) },
  ]
  const reviewBase = (request: Review): SfReviewSnapshot | null => request.first || !request.version
    ? null : { kind: "persisted", ref: request.versionId as SfRef, version: request.expected,
      fields: fields({ name: request.version.name, year: request.version.year }) }
  // The first version receives its name and year on the server. Never preview
  // the page selection as if those values were a confirmed source proposal.
  const reviewProposed = (request: Review): SfReviewSnapshot => request.first
    ? { kind: "not-provided", reason: msg("sf.u46.firstDescription") }
    : {
        kind: "draft", intentRef: request.ref as unknown as SfIntentRef,
        sourceRef: request.versionId as SfRef,
        sourceVersion: request.expected, fields: fields(request.proposed),
      }
  const visibleReview = () => model.owner.state().status === "ready" && !!page() && !!screen.review
  const reviewAction = (request: Review): SfReviewPurpose => request.first ? "create" : request.action

  const table = () => (
    <SfDataTable
      rows={records()}
      getRowKey={(item) => item.id as SfRef}
      columns={[
        { id: "name", labelKey: key("sf.u46.version"), align: "start", widthPolicy: { kind: "flex", minPx: 160, weight: 2 },
          render: (item: PlannerVersion) => <span>{item.name}</span> },
        { id: "year", labelKey: key("sf.u46.year"), align: "start", widthPolicy: { kind: "content", minPx: 70, maxPx: 115 },
          render: (item: PlannerVersion) => <span>{item.year}</span> },
        { id: "state", labelKey: key("sf.u46.state"), align: "start", widthPolicy: { kind: "content", minPx: 95, maxPx: 150 },
          render: (item: PlannerVersion) =>
            <span>{copy.t(key(item.official ? "sf.u46.officialState" : item.locked ? "sf.u46.locked" : "sf.u46.draft"))}</span> },
      ]}
      selectedKey={record()?.id as SfRef | undefined}
      sort={{ kind: "none" }}
      page={{ kind: "none", total: records().length }}
      onSort={() => undefined}
      onPage={() => undefined}
      onSelect={(ref) => {
        const selected = records().find((item) => item.id === ref)
        if (selected) go("detail", { versionRef: selected.id, year: selected.year })
      }}
      rowActions={(item) => ([
        { id: "copy", labelKey: key("sf.u46.copy"), tone: "secondary" as const, disabled: !allowed(item, "copy"), busy: screen.busy },
        { id: item.locked ? "unlock" : "lock", labelKey: key(item.locked ? "sf.u46.unlock" : "sf.u46.lock"),
          tone: "secondary" as const, disabled: !allowed(item, item.locked ? "unlock" : "lock"), busy: screen.busy },
        { id: "official", labelKey: key("sf.u46.official"), tone: "secondary" as const,
          disabled: !allowed(item, "official"), busy: screen.busy },
        { id: "delete", labelKey: key("sf.u46.delete"), tone: "danger" as const,
          disabled: !allowed(item, "delete"), busy: screen.busy },
      ])}
      onRowAction={({ recordRef, actionId }) => {
        const found = page()?.data.versions.find((item) => item.id === recordRef)
        if (found && ["copy", "lock", "unlock", "official", "delete"].includes(actionId))
          begin(actionId as CommandAction, found)
      }}
      captionKey={key("sf.u46.versions")}
      density="comfortable"
      state={pageState()}
    />
  )

  const detail = (item: PlannerVersion) => {
    const draft = draftValue()
    const editable = !!draft && allowed(item, "save")
    const actions: readonly SfAction[] = ([
      { id: "copy", labelKey: key("sf.u46.copy"), tone: "secondary", disabled: !allowed(item, "copy"), busy: screen.busy,
        onInvoke: () => begin("copy", item) },
      { id: "official", labelKey: key("sf.u46.official"), tone: "secondary", disabled: !allowed(item, "official"), busy: screen.busy,
        onInvoke: () => begin("official", item) },
      { id: "lock", labelKey: key(item.locked ? "sf.u46.unlock" : "sf.u46.lock"),
        tone: "secondary", disabled: !allowed(item, item.locked ? "unlock" : "lock"), busy: screen.busy,
        onInvoke: () => begin(item.locked ? "unlock" : "lock", item) },
      { id: "delete", labelKey: key("sf.u46.delete"), tone: "danger", disabled: !allowed(item, "delete"), busy: screen.busy,
        onInvoke: () => begin("delete", item) },
    ])
    return (
      <SfRecordDetail
        title={data(item.name)}
        secondaryId={data(item.id)}
        status={{
          code: item.official ? "official" : item.locked ? "locked" : "draft",
          text: { kind: "message", message: msg(item.official ? "sf.u46.officialState" : item.locked ? "sf.u46.locked" : "sf.u46.draft") },
          tone: item.official ? "success" : item.locked ? "warning" : "neutral",
        }}
        metadata={[
          { id: "year", label: msg("sf.u46.year"), value: yearValue(item.year) },
          { id: "state", label: msg("sf.u46.state"), value: textValue(copy.t(key(item.official ? "sf.u46.officialState" : item.locked ? "sf.u46.locked" : "sf.u46.draft"))) },
        ]}
        sections={[{
          id: "fields", titleKey: key("sf.u46.edit"), state: model.view.state,
          content: <div class="sf-u46-fields">
            <label for="sf-u46-name">{copy.t(key("sf.u46.name"))}</label>
            <input id="sf-u46-name" type="text" class="mx-input" value={draft?.name ?? item.name} disabled={!editable}
              onInput={(event) => {
                const state = screen.draft?.snapshot()
                if (state?.availability === "active" && editable)
                  screen.draft?.edit({ ...state.value, name: event.currentTarget.value })
              }} />
            <label for="sf-u46-year">{copy.t(key("sf.u46.year"))}</label>
            <input id="sf-u46-year" type="number" class="mx-input" min="2001" max="2099"
              value={String(draft?.year ?? item.year)} disabled={!editable || item.locked || item.official}
              onInput={(event) => {
                const state = screen.draft?.snapshot()
                const raw = event.currentTarget.value
                if (state?.availability === "active" && editable && /^\d{4}$/.test(raw))
                  screen.draft?.edit({ ...state.value, year: Number(raw) })
              }} />
            <Show when={screen.error}>
              <p role="alert">{screen.error === "year" ? copy.t(key("sf.u46.invalidYear"))
                : copy.t(key("sf.common.conflict"))}</p>
            </Show>
          </div>,
        }]}
        primaryAction={{
          id: "save", labelKey: key("sf.u46.save"), tone: "primary", disabled: !editable ||
            screen.draft?.snapshot().availability !== "active" || !screen.draft.snapshot().dirty,
          busy: screen.busy, onInvoke: () => begin("save", item),
        }}
        secondaryActions={actions.filter((item) => item.tone !== "danger")}
        sourceActions={actions.filter((item) => item.tone === "danger")}
        onBack={() => go("versions", { year: item.year })}
        onOpenPage={() => go("detail", { year: item.year, versionRef: item.id })}
      />
    )
  }

  return (
    <SfPageFrame
      titleKey={key("sf.cap23.title")}
      context={year() === undefined ? [] : [
        { id: "year", label: msg("sf.u46.year"), value: data(String(year())) },
      ]}
      tabs={[]}
      activeTab={null}
      primaryAction={{
        id: "new", labelKey: key("sf.cap23.primary"), tone: "primary", busy: false,
        disabled: !(model.can("copy") || allowed(null, "save", true)),
        onInvoke: () => go("new", { year: year() }),
      }}
      secondaryActions={[
        { id: "compare", labelKey: key("sf.u46.compare"), tone: "secondary" as const, busy: false,
          disabled: !(model.owner.ready()?.context.destinations.some((item) => item.capabilityId === "CAP17" && item.canRead) && records().length > 1),
          onInvoke: () => go("compare", { year: year() }),
        },
        { id: "overview", labelKey: key("sf.u46.version"), tone: "secondary" as const, busy: false,
          disabled: false, onInvoke: () => go("overview", { year: year() }),
        },
        { id: "import", labelKey: key("sf.u46.importWorkbook"), tone: "secondary" as const, busy: false,
          disabled: !model.can("import-workbook"), onInvoke: () => go("import"),
        },
      ]}
      density="comfortable"
      layout={props.route.kind === "detail" ? "split" : "work"}
      onLayoutMode={(layout) => setScreen("layout", layout)}
    >
      <SfStatePanel state={pageState()} messageKey={stateCopy(pageState())}
        onBack={props.route.kind === "detail" ? () => go("versions", { year: year() }) : undefined}
        onRetryRead={model.refresh}>
        <Show when={page()}>
          {(loaded) => (
            <section class="sf-u46" data-sf-surface="CAP23">
              <SfContextBar
                state={model.view.state}
                selection={[{ control: "year", optionId: year() === undefined ? null : String(year()) }]}
                catalog={[...new Set(loaded().data.versions.map((version) => version.year))]
                  .sort((left, right) => left - right).map((option) => ({
                    id: String(option), control: "year" as const, value: option,
                    label: data(String(option)), available: true,
                  }))}
                lockedReasons={[]}
                onRequestChange={({ control, optionId }) => {
                  if (control !== "year") return
                  const available = loaded().data.versions.some((version) => String(version.year) === optionId)
                  if (available) go("versions", { year: Number(optionId) })
                }}
              />
              <Show when={screen.verified}>
                <p role="status" class="sf-u46-alert">{copy.t(key("sf.common.pending"))}</p>
              </Show>
              <Show when={screen.outcome === "failed" || screen.outcome === "conflict"}>
                <p role="alert" class="sf-u46-alert">{copy.t(key(screen.outcome === "conflict" ? "sf.common.conflict" : "sf.common.failed"))}</p>
              </Show>
              <Show when={screen.outcome === "unknown"}>
                <div role="alert" class="sf-u46-alert">
                  <p>{copy.t(key("sf.u46.outcomeUnknown"))}</p>
                  <button class="mx-btn" type="button" onClick={model.refresh}>
                    {copy.t(key("sf.common.currentSource"))}
                  </button>
                </div>
              </Show>
              <Show when={visibleReview() && screen.review}>
                {(request) => (
                  <SfChangeReview
                    operation={{ ref: request().ref, label: msg("sf.u46.reviewScope"), scope: data(request().versionId || copy.t(key("sf.u46.createFirst"))) }}
                    base={reviewBase(request())}
                    current={reviewBase(request())}
                    proposed={reviewProposed(request())}
                    effects={[{
                      id: request().ref, domain: "planner", title: data(copy.t(key("sf.u46." + request().action as keyof typeof SF_U46_COPY))),
                      state: "proposed", details: [{
                        path: "action", label: msg("sf.u46.actions"),
                        value: textValue(copy.t(key(("sf.u46." + request().action) as keyof typeof SF_U46_COPY))),
                      }],
                    }]}
                    coverage={{ state: "complete", summary: msg("sf.u46.reviewScope"), reasons: [],
                      knownCount: 1, expectedCount: 1 }}
                    blockingReasons={model.can(request().action) ? [] : [msg("sf.u46.reviewScope")]}
                    confirmation={model.can(request().action) && screen.outcome === "idle" && !screen.busy && !screen.verified
                      ? { kind: "admitted", labelKey: key("sf.u46.confirm"), purpose: reviewAction(request()),
                          binding: { kind: "catalog-command", operationId: op[request().action],
                            version: { kind: "record", expectedVersion: request().expected }, confirmation: "presentation-only" } }
                      : { kind: "blocked", labelKey: key("sf.u46.confirm"), reasons: [msg("sf.u46.reviewScope")] }}
                    state={screen.outcome === "unknown" ? "outcome-unknown" :
                      screen.outcome === "conflict" ? "conflict" : "ready"}
                    onConfirm={() => { void submit(request()) }}
                    onCancel={() => {
                      if (request().action === "save") {
                        const snapshot = screen.draft?.snapshot()
                        if (snapshot?.availability === "active") screen.draft?.setPhase(snapshot.dirty ? "dirty" : "clean")
                      }
                      setScreen({ review: undefined, error: undefined })
                    }}
                    onRevise={() => {
                      if (request().action === "save") {
                        const snapshot = screen.draft?.snapshot()
                        if (snapshot?.availability === "active") screen.draft?.setPhase(snapshot.dirty ? "dirty" : "clean")
                      }
                      setScreen({ review: undefined, error: undefined })
                    }}
                    onReconcile={model.refresh}
                  />
                )}
              </Show>
              <Show when={!screen.review}>
                <Show when={props.route.kind === "new"}>
                  <section class="sf-u46-new" aria-label={copy.t(key("sf.cap23.primary"))}>
                    <Show when={loaded().data.versions.length === 0}
                      fallback={
                        <>
                          <p>{copy.t(key("sf.u46.cannotCreateAnother"))}</p>
                          <label for="sf-u46-copy-name">{copy.t(key("sf.u46.name"))}</label>
                          <input id="sf-u46-copy-name" class="mx-input" value={screen.copyName}
                            onInput={(event) => setScreen("copyName", event.currentTarget.value)} />
                          <ul class="sf-u46-source-choices">
                            <For each={loaded().data.versions}>
                              {(version) => <li>
                                <span>{version.name} · {version.year}</span>
                                <button class="mx-btn" type="button" disabled={!allowed(version, "copy")}
                                  onClick={() => begin("copy", version)}>{copy.t(key("sf.u46.copy"))}</button>
                              </li>}
                            </For>
                          </ul>
                        </>
                      }>
                      <p>{copy.t(key("sf.u46.firstDescription"))}</p>
                      <button class="mx-btn primary" type="button" disabled={!allowed(null, "save", true)}
                        onClick={() => begin("save", null, true)}>
                        {copy.t(key("sf.u46.createFirst"))}
                      </button>
                    </Show>
                  </section>
                </Show>
                <Show when={props.route.kind === "detail" && record()}>
                  {(selected) => detail(selected())}
                </Show>
                <Show when={props.route.kind === "entry"}>{table()}</Show>
              </Show>
            </section>
          )}
        </Show>
      </SfStatePanel>
    </SfPageFrame>
  )
}
