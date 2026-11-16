import { For, Show, createEffect, onCleanup, type JSX } from "solid-js"
import { A } from "@solidjs/router"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { createSfFilesClient } from "@orchestra/client/sucafina/files"
import type { SfFilesOperationOutput } from "@orchestra/schema/sucafina/files"
import type { SfTransportResult } from "@orchestra/schema/sucafina/common"
import type { SfSurfaceProps } from "../context/contracts"
import { useSfContext } from "../context"
import { encodeSfRouteRef } from "../navigation-state"
import { SfPageFrame } from "../shared/frame"
import type { SfCopyKey, SfUiState } from "../shared/frame"
import { SfStatePanel } from "../shared/states"
import { readSfAuthorizedImportHistoryReference } from "./history"
import "./imports.css"

type ImportSurface = "planner" | "dashboard"
type TargetDiscovery = Readonly<{ surface: ImportSurface; start: string; end: string; owner: string }>
type Target = Extract<SfFilesOperationOutput<"files.import-targets">, { status: "ok" }>["value"][number]
type Manifest = Extract<SfFilesOperationOutput<"files.import-preview">, { status: "ok" }>["value"]
type Detail = Extract<SfFilesOperationOutput<"files.import-detail">, { status: "ok" }>["value"]
type Reference = Extract<SfFilesOperationOutput<"files.import-reference">, { status: "ok" }>["value"]
type Failure = Exclude<SfFilesOperationOutput<"files.import-targets">, { status: "ok" }>
type Port<Value> = Readonly<{ status: "ok"; value: Value }> | Failure
type Result<Value> = Readonly<{ kind: "value"; value: Value }> | Readonly<{ kind: "failure"; state: SfUiState }>

function unpack<Value>(reply: SfTransportResult<Port<Value>>): Result<Value> {
  if (reply.kind === "transport-error") {
    return { kind: "failure", state: reply.reason === "outcome-unknown" ? "outcome-unknown" : "unavailable" }
  }
  if (reply.status === 401) return { kind: "failure", state: "session-expired" }
  if (reply.status === 403) return { kind: "failure", state: "denied" }
  if (reply.status === 404) return { kind: "failure", state: "not-found" }
  if (reply.status === 409) return { kind: "failure", state: "stale" }
  const body = reply.body
  if (body.status === "ok" && reply.status >= 200 && reply.status < 300) return { kind: "value", value: body.value }
  if (body.status === "denied") return { kind: "failure", state: "denied" }
  if (body.status === "stale" || body.status === "conflict" || body.status === "provider-conflict")
    return { kind: "failure", state: "stale" }
  if (body.status === "invalid" || body.status === "needs-input") return { kind: "failure", state: "invalid" }
  return { kind: "failure", state: "unavailable" }
}

type LeafState = {
  status: SfUiState
  phase: "selecting" | "preview" | "reviewing" | "submitting" | "receipt" | "unknown"
  surface: ImportSurface
  start: string
  end: string
  targets: readonly Target[]
  discovery: TargetDiscovery | undefined
  selectionRef: string
  reviewedSelectionRef: string
  needsDiscovery: boolean
  historyRef: string
  file: File | undefined
  newVersion: boolean
  removeMissing: boolean
  replace: boolean
  headerRow: string
  manifest: Manifest | undefined
  reference: Reference | undefined
  detail: Detail | undefined
  busy: boolean
  error: SfUiState | undefined
  exportKind: "xlsx" | "suppliers" | "register" | "json"
  download: Readonly<{ href: string; name: string }> | undefined
}

// The document contract remains the authority for the financial result, receipt,
// scanner and current-base admission. This leaf never calculates, caches or retries effects.
export function SfImportsView(props: SfSurfaceProps<"UI55" | "UI56" | "UI57" | "UI68">): JSX.Element {
  const auth = useSfContext()
  const language = useLanguage()
  const key = (value: string): SfCopyKey => value as SfCopyKey
  const t = (value: string) => language.t(value as Parameters<typeof language.t>[0])
  const [state, setState] = createStore<LeafState>({
    status: "loading", phase: "selecting", surface: "planner",
    start: "", end: "", targets: [], discovery: undefined, selectionRef: "",
    reviewedSelectionRef: "", needsDiscovery: false, historyRef: "",
    file: undefined, newVersion: false, removeMissing: false, replace: false,
    headerRow: "", manifest: undefined, reference: undefined, detail: undefined,
    busy: false, error: undefined, exportKind: "xlsx", download: undefined,
  })
  let generation = 0
  let controller = new AbortController()
  let applyIntent: Readonly<{ id: string; version: number; digest: string; key: string }> | undefined
  let exportHref: string | undefined

  const ownerStamp = () => {
    const context = auth.state()
    return context.status === "ready"
      ? String(context.ownerKey) + ":" + context.context.stamp.accessRevision + ":" + auth.generation()
      : undefined
  }
  const fence = () => {
    generation += 1
    controller.abort()
    controller = new AbortController()
    return { generation, stamp: ownerStamp(), signal: controller.signal }
  }
  const current = (token: ReturnType<typeof fence>) =>
    !token.signal.aborted && token.generation === generation && token.stamp === ownerStamp()
  const revokeExport = () => {
    if (exportHref) URL.revokeObjectURL(exportHref)
    exportHref = undefined
    setState("download", undefined)
  }
  const clearReview = () => {
    applyIntent = undefined
    setState({ manifest: undefined, reference: undefined, detail: undefined,
      reviewedSelectionRef: "", phase: "selecting", error: undefined })
  }
  const failure = (result: Readonly<{ state: SfUiState }>, isMutation = false) => {
    if (result.state === "denied" || result.state === "session-expired") {
      clearReview()
      setState({ targets: [], discovery: undefined, selectionRef: "", needsDiscovery: true,
        file: undefined, historyRef: "" })
    }
    if (result.state === "stale" || result.state === "conflict") applyIntent = undefined
    setState({
      error: result.state,
      status: result.state,
      phase: isMutation && result.state === "outcome-unknown" ? "unknown" : state.phase,
      busy: false,
    })
  }
  const client = () => {
    const ready = auth.ready()
    return ready ? createSfFilesClient(ready.transport) : undefined
  }
  const accept = <Value,>(token: ReturnType<typeof fence>, result: Result<Value>): Value | undefined => {
    if (!current(token)) return undefined
    if (result.kind === "failure") { failure(result); return undefined }
    return result.value
  }
  const permitted = (operationId: string) => {
    const ready = auth.ready()
    const resource = ready?.context.availability.find((entry) =>
      entry.family === "files" && entry.operations.some((op) => op.operationId === operationId))
    return resource?.operations.some((op) => op.operationId === operationId && op.state === "ready") ?? false
  }
  const editLocked = () => state.busy || state.phase === "unknown" || state.phase === "submitting"
  const newSource = (surface: ImportSurface) => {
    if (editLocked()) return
    fence()
    revokeExport()
    clearReview()
    setState({ surface, targets: [], discovery: undefined, selectionRef: "",
      historyRef: "", needsDiscovery: true, status: "ready" })
  }
  const change = () => {
    // A file/target/option change invalidates any reviewed source version.
    fence()
    clearReview()
    setState({ status: "ready", phase: "selecting" })
  }
  const changePeriod = (field: "start" | "end", value: string) => {
    if (state[field] === value || editLocked()) return
    // Targets are period-bound; a reply from the prior period cannot restore selection.
    fence()
    clearReview()
    setState({ targets: [], discovery: undefined, selectionRef: "", needsDiscovery: true,
      status: "ready", phase: "selecting", busy: false })
    setState(field, value)
  }
  const discover = async () => {
    if (editLocked()) return
    const api = client()
    const owner = ownerStamp()
    if (!api || !owner || !permitted("files.import-targets")) { setState("status", "unavailable"); return }
    if (!!state.start !== !!state.end || (state.start && state.start > state.end)) {
      setState("status", "invalid")
      return
    }
    const requested: TargetDiscovery = {
      surface: state.surface, start: state.start, end: state.end, owner,
    }
    const token = fence()
    setState({ status: "loading", busy: true, targets: [], discovery: undefined, selectionRef: "" })
    const reply = await api["files.import-targets"]({
      surface: requested.surface,
      ...(requested.start && requested.end ? { start: requested.start, end: requested.end } : {}),
    }, { signal: token.signal })
    const targets = accept(token, unpack(reply))
    if (!targets || !current(token) || requested.owner !== ownerStamp() ||
      requested.surface !== state.surface || requested.start !== state.start || requested.end !== state.end) return
    setState({ targets, discovery: requested, needsDiscovery: false,
      status: targets.length ? "ready" : "empty", busy: false })
  }
  const sourceFormat = () => state.file?.name.toLowerCase().split(".").pop() ?? ""
  const selectedTarget = () => {
    const scope = state.discovery
    if (!scope || scope.owner !== ownerStamp() || scope.surface !== state.surface ||
      scope.start !== state.start || scope.end !== state.end) return undefined
    return state.targets.find((item) => item.selectionRef === state.selectionRef && item.surface === scope.surface)
  }
  const options = () => ({
    newVersion: state.newVersion && state.surface === "planner",
    removeMissing: state.removeMissing && state.surface === "planner",
    preview: {
      ...(selectedTarget()?.sheet ? { sheet: selectedTarget()!.sheet } : {}),
      ...(selectedTarget()?.sheet && ["All Members", "Projects Import", "All Projects"].includes(selectedTarget()!.sheet!)
        ? { replace: state.replace } : {}),
      ...(state.headerRow ? { headerRow: Number(state.headerRow) } : {}),
    },
  })
  const refreshReference = async (manifestId: string, surface: ImportSurface, token: ReturnType<typeof fence>) => {
    const api = client()
    if (!api || !permitted("files.import-reference")) return undefined
    const reply = await api["files.import-reference"]({ surface, importPreviewRef: manifestId }, { signal: token.signal })
    const reference = accept(token, unpack(reply))
    if (!reference || !current(token)) return undefined
    if (reference.manifest.id !== manifestId || reference.manifest.context.surface !== surface) {
      failure({ state: "invalid" })
      return undefined
    }
    setState({ manifest: reference.manifest, detail: { digest: reference.digest, detail: reference.detail, receipt: reference.receipt },
      reference, phase: reference.receipt ? "receipt" : "preview",
      status: reference.manifest.state === "stale" ? "stale" : "ready", busy: false })
    return reference
  }
  const loadReference = async () => {
    const route = props.route
    if (!("manifestId" in route.params)) return
    const token = fence()
    setState({ busy: true, status: "loading" })
    const result = await refreshReference(route.params.manifestId, state.surface, token)
    if (current(token) && result && route.kind === "review" && result.manifest.state === "preview" && !result.receipt)
      setState("phase", "reviewing")
    if (current(token) && !result) setState("busy", false)
  }
  const loadHistory = async () => {
    if (props.surfaceId !== "UI57" || props.route.kind !== "history") return
    const currentOwner = auth.state()
    const api = client()
    const id = state.historyRef
    const source = state.surface
    if (currentOwner.status !== "ready" || !api ||
        !permitted("files.import-reference") || !permitted("files.import-detail")) {
      clearReview()
      setState("status", currentOwner.status === "denied" ? "denied" : "unavailable")
      return
    }
    const token = fence()
    clearReview()
    setState({ status: "loading", busy: true })
    const stamp = currentOwner.context.stamp
    const result = await readSfAuthorizedImportHistoryReference({
      client: api, manifestId: id, surface: source,
      owner: {
        installationId: stamp.installationId, projectId: stamp.projectId,
        principalRef: stamp.principalRef, accessRevision: stamp.accessRevision,
        policyVersion: stamp.policyVersion,
      },
      signal: token.signal,
      isCurrent: () => current(token) && state.historyRef === id && state.surface === source,
    })
    if (!current(token) || result.kind === "discarded") return
    if (result.kind === "error") { failure({ state: result.state }); return }
    const reference = result.reference
    setState({
      status: reference.manifest.state === "stale" ? "stale" : "ready",
      phase: reference.receipt ? "receipt" : "preview", busy: false,
      manifest: reference.manifest, reference, detail: result.detail,
    })
  }
  const prepare = async () => {
    const api = client()
    const file = state.file
    const target = selectedTarget()
    if (!api || !file || !target || !state.discovery || editLocked() || !permitted("files.import-admit") ||
      !permitted("files.import-preview") || !permitted("files.import-detail") ||
      !permitted("files.import-reference")) { setState("status", "unavailable"); return }
    if (file.size < 1 || file.size > 16 * 1024 * 1024 ||
      !["xls", "xlsx", "json"].includes(sourceFormat()) ||
      !target.formats.includes(sourceFormat()) ||
      (state.headerRow && (!Number.isSafeInteger(Number(state.headerRow)) || Number(state.headerRow) < 1))) {
      setState("status", "invalid")
      return
    }
    const token = fence()
    clearReview()
    setState({ busy: true, status: "loading", phase: "selecting" })
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (!current(token)) return
    const admit = unpack(await api["files.import-admit"]({
      surface: target.surface, selectionRef: target.selectionRef,
      fileName: file.name, mediaType: file.type || "application/octet-stream", bytes,
      options: options(),
    }, { signal: token.signal, idempotencyKey: crypto.randomUUID() }))
    if (admit.kind === "failure") { if (current(token)) failure(admit, true); return }
    if (!current(token)) return
    const preview = unpack(await api["files.import-preview"]({
      surface: target.surface, admittedFileRef: admit.value.ref,
      format: sourceFormat(), options: options().preview,
    }, { signal: token.signal, idempotencyKey: crypto.randomUUID() }))
    if (preview.kind === "failure") { if (current(token)) failure(preview, true); return }
    if (!current(token)) return
    const manifest = preview.value
    if (manifest.context.surface !== target.surface || manifest.domainApplied ||
      manifest.state !== "preview") { failure({ state: "invalid" }); return }
    const reference = await refreshReference(manifest.id, target.surface, token)
    if (!reference || !current(token)) return
    if (reference.manifest.version !== manifest.version || reference.manifest.sourceDigest !== manifest.sourceDigest) {
      failure({ state: "stale" })
      return
    }
    setState({ reviewedSelectionRef: target.selectionRef, phase: "reviewing", busy: false, status: "ready" })
  }
  const cancelPreview = () => {
    fence()
    clearReview()
    setState({ status: "ready", busy: false })
  }
  const applyReviewed = async () => {
    const api = client()
    const manifest = state.manifest
    const reference = state.reference
    if (!api || !manifest || !reference || state.busy || state.phase !== "reviewing" ||
      reference.receipt || manifest.domainApplied || manifest.state !== "preview" ||
      (props.surfaceId === "UI55" && (!state.reviewedSelectionRef ||
        selectedTarget()?.selectionRef !== state.reviewedSelectionRef)) ||
      !permitted("files.import-apply")) return
    const token = fence()
    setState({ phase: "submitting", busy: true, status: "ready" })
    const source = manifest.context.surface
    if (source !== "planner" && source !== "dashboard") { failure({ state: "invalid" }); return }
    const fresh = await refreshReference(manifest.id, source, token)
    if (!fresh || !current(token)) return
    if (fresh.manifest.version !== manifest.version || fresh.digest !== reference.digest ||
      fresh.manifest.state !== "preview" || fresh.manifest.domainApplied || fresh.receipt) {
      failure({ state: "stale" })
      return
    }
    // One key per reviewed manifest+digest. A lost response only allows a read.
    const intent = { id: manifest.id, version: manifest.version, digest: fresh.digest,
      key: crypto.randomUUID() }
    applyIntent = intent
    setState({ phase: "submitting", busy: true })
    const reply = await api["files.import-apply"]({
      surface: manifest.context.surface, manifestId: intent.id, version: intent.version,
    }, { signal: token.signal, idempotencyKey: intent.key })
    if (!current(token)) return
    const outcome = unpack(reply)
    if (outcome.kind === "failure") {
      // Do not infer that a mutation failed after a lost response; reconcile by read.
      failure({ state: outcome.state === "unavailable" ? "outcome-unknown" : outcome.state }, true)
      return
    }
    if (outcome.value.id !== intent.id || outcome.value.state !== "applied" ||
      !outcome.value.domainApplied) {
      failure({ state: "outcome-unknown" }, true)
      return
    }
    await refreshReference(intent.id, manifest.context.surface, token)
    if (current(token)) setState({ phase: "receipt", busy: false })
  }
  const reconcile = async () => {
    const ref = state.manifest?.id ?? applyIntent?.id
    if (!ref) return
    const token = fence()
    setState({ busy: true, status: "loading" })
    const source = state.manifest?.context.surface ?? state.surface
    if (source !== "planner" && source !== "dashboard") { failure({ state: "invalid" }); return }
    const fresh = await refreshReference(ref, source, token)
    if (!current(token)) return
    if (!fresh) { setState("busy", false); return }
    if (fresh.receipt) setState({ phase: "receipt", status: "ready" })
    else if (state.phase === "unknown" || applyIntent) setState({ phase: "unknown", status: "outcome-unknown" })
    else setState({ phase: "reviewing", status: "ready" })
    setState("busy", false)
  }
  const download = async () => {
    const api = client()
    if (!api || state.busy || !permitted("files.export." + state.exportKind)) {
      setState("status", "unavailable")
      return
    }
    const token = fence()
    revokeExport()
    setState({ busy: true, status: "loading" })
    const result = state.exportKind === "xlsx"
      ? await api["files.export.xlsx"]({ surface: "planner" }, { signal: token.signal })
      : state.exportKind === "suppliers"
        ? await api["files.export.suppliers"]({ surface: "procurement" }, { signal: token.signal })
        : state.exportKind === "register"
          ? await api["files.export.register"]({ surface: "procurement" }, { signal: token.signal })
          : await api["files.export.json"]({ surface: "dashboard" }, { signal: token.signal })
    if (!current(token)) return
    if (result.kind !== "response" || result.status >= 400) {
      failure({ state: result.kind === "transport-error" && result.reason === "outcome-unknown"
        ? "outcome-unknown" : result.kind === "response" && result.status === 403 ? "denied" : "unavailable" })
      return
    }
    const blob = new Blob([Uint8Array.from(result.body)], {
      type: result.headers["content-type"] || "application/octet-stream",
    })
    const disposition = result.headers["content-disposition"] ?? ""
    const matched = /filename="?([^";\r\n]+)"?/i.exec(disposition)
    const originalName = matched?.[1]?.replace(/[^a-zA-Z0-9_.-]/g, "_")
    const filename = originalName && !originalName.startsWith(".")
      ? originalName : "sucafina-" + state.exportKind + (state.exportKind === "xlsx" ? ".xlsx" : state.exportKind === "json" ? ".json" : ".csv")
    exportHref = URL.createObjectURL(blob)
    setState({ download: { href: exportHref, name: filename }, status: "ready", busy: false })
  }

  createEffect(() => {
    const routeKind = props.route.kind
    const chapter = props.surfaceId
    const ready = auth.ready()
    const selectedOwner = ownerStamp()
    fence()
    revokeExport()
    applyIntent = undefined
    setState({ status: ready ? "ready" : auth.state().status === "resolving" ? "loading" :
      auth.state().status === "unauthenticated" ? "session-expired" :
      auth.state().status === "denied" ? "denied" : "unavailable",
      phase: "selecting", targets: [], discovery: undefined, selectionRef: "",
      reviewedSelectionRef: "", needsDiscovery: true, manifest: undefined,
      historyRef: "", reference: undefined, detail: undefined, file: undefined,
      busy: false, error: undefined })
    if (!ready || !selectedOwner) return
    if (chapter === "UI57" && routeKind === "history") {
      // No auto-fetch of an unscoped collection: original Files only authorizes
      // reference/detail reads. Never infer an empty collection or issue a grant.
      setState("historyRef", "")
    }
    // Route-param consumers must request an explicit producer surface: no guessed
    // dashboard→planner fallback and no replay of a hidden previous selection.
  })
  onCleanup(() => { fence(); revokeExport() })

  const title = () => "sf." + props.surfaceId.toLowerCase() + ".title"
  const message = () =>
    state.error === "stale" || state.status === "stale" ? "sf.common.sourceChanged" :
    state.status === "filtered-empty" ? "sf.common.filterEmpty" :
    state.status === "empty" ? "sf.common.empty" :
    state.status === "not-found" ? "sf.common.removed" :
    state.status === "denied" ? "sf.common.noAccess" :
    state.status === "session-expired" ? "sf.common.loginAgain" :
    state.status === "outcome-unknown" ? "sf.common.operationUnknown" :
    state.status === "invalid" ? "sf.common.invalidLink" :
    state.status === "loading" ? "sf.common.loading" : "sf.common.unavailable"
  const isImport = () => props.surfaceId === "UI55"
  const isHistory = () => props.surfaceId === "UI57" && props.route.kind === "history"
  const isReference = () => props.surfaceId === "UI56" || (props.surfaceId === "UI57" && !isHistory())
  const isExport = () => props.surfaceId === "UI68"
  const canApply = () => !state.busy && state.phase === "reviewing" &&
    !!state.manifest && !state.manifest.domainApplied && state.manifest.state === "preview" &&
    !!state.reference && !state.reference.receipt &&
    (!isImport() || (!!state.reviewedSelectionRef &&
      selectedTarget()?.selectionRef === state.reviewedSelectionRef))
  const changeSummary = (kind: Detail["detail"]["changes"][number]["kind"]) =>
    state.detail?.detail.changes.filter((item) => item.kind === kind) ?? []
  const displayValue = (value: Detail["detail"]["changes"][number]["before"]) =>
    value.state !== "present" ? value.state : value.value === null ? "null" : JSON.stringify(value.value)
  const matchedSurface = () => state.manifest?.context.surface === state.surface

  return (
    <SfPageFrame titleKey={key(title())} context={[]} tabs={[]} activeTab={null}
      secondaryActions={[]} density="comfortable" layout="work" onLayoutMode={() => undefined}
      primaryAction={isExport() ? {
        id: "export", labelKey: key("sf.ui68.primary"), tone: "primary", disabled: state.busy,
        busy: state.busy, onInvoke: () => { void download() },
      } : undefined}
    >
      <section class="sf-files" data-sf-leaf="u23" data-sf-surface={props.surfaceId}
        data-sf-phase={state.phase} data-sf-read-state={state.status}>
        <SfStatePanel state={state.status} messageKey={key(message())}
          onRetryRead={() => { if (isHistory()) void loadHistory(); else if (isReference()) void loadReference(); else if (isImport()) void discover(); else if (isExport()) void download() }}
          onBack={isHistory() && state.status === "not-found" ? () => {
            fence(); clearReview(); setState({ status: "ready", historyRef: "", busy: false })
          } : undefined}>
          <Show when={isImport()}>
            <div class="sf-files-fields">
              <label>{t("sf.u23.source")}
                <select value={state.surface} disabled={editLocked()} onChange={(e) => newSource(e.currentTarget.value as ImportSurface)}>
                  <option value="planner">Planner</option><option value="dashboard">Dashboard</option>
                </select>
              </label>
              <label>{t("sf.u23.periodStart")}
                <input type="date" value={state.start} disabled={editLocked()}
                  onChange={(e) => changePeriod("start", e.currentTarget.value)} />
              </label>
              <label>{t("sf.u23.periodEnd")}
                <input type="date" value={state.end} disabled={editLocked()}
                  onChange={(e) => changePeriod("end", e.currentTarget.value)} />
              </label>
              <button type="button" class="mx-btn" disabled={editLocked()}
                onClick={() => { void discover() }}>{t("sf.u23.find")}</button>
              <Show when={state.needsDiscovery}>
                <p role="status" class="sf-files-note" data-sf-discovery="required">
                  {t("sf.u23.periodRediscover")}
                </p>
              </Show>
              <label>{t("sf.u23.destination")}
                <select value={state.selectionRef} disabled={editLocked() || !state.targets.length}
                  onChange={(e) => { change(); setState("selectionRef", e.currentTarget.value) }}>
                  <option value="">{t("sf.u23.destinationEmpty")}</option>
                  <For each={state.targets}>{(target) =>
                    <option value={target.selectionRef}>{target.label}</option>}</For>
                </select>
              </label>
              <label>{t("sf.u23.file")}
                <input type="file" accept=".xls,.xlsx,.json" disabled={editLocked()}
                  onChange={(e) => { change(); setState("file", e.currentTarget.files?.[0]) }} />
              </label>
              <Show when={state.surface === "planner"}>
                <label><input type="checkbox" checked={state.newVersion} disabled={editLocked()}
                  onChange={(e) => { change(); setState("newVersion", e.currentTarget.checked) }} />
                  {t("sf.u23.newVersion")}</label>
                <label><input type="checkbox" checked={state.removeMissing} disabled={editLocked()}
                  onChange={(e) => { change(); setState("removeMissing", e.currentTarget.checked) }} />
                  {t("sf.u23.removeMissing")}</label>
              </Show>
              <Show when={selectedTarget()?.sheet && ["All Members", "Projects Import", "All Projects"].includes(selectedTarget()!.sheet!)}>
                <label><input type="checkbox" checked={state.replace} disabled={editLocked()}
                  onChange={(e) => { change(); setState("replace", e.currentTarget.checked) }} />
                  {t("sf.u23.replace")}</label>
              </Show>
              <label>{t("sf.u23.headerRow")}
                <input type="number" min="1" step="1" value={state.headerRow} disabled={editLocked()}
                  onChange={(e) => { change(); setState("headerRow", e.currentTarget.value) }} />
              </label>
              <button type="button" class="mx-btn primary" disabled={editLocked() || !selectedTarget() || !state.file}
                onClick={() => { void prepare() }}>{t("sf.ui55.primary")}</button>
            </div>
          </Show>
          <Show when={isHistory()}>
            <form class="sf-files-fields" data-sf-history="authorized-reference"
              onSubmit={(event) => { event.preventDefault(); void loadHistory() }}>
              <label>{t("sf.u23.source")}
                <select value={state.surface} disabled={editLocked()}
                  onChange={(event) => newSource(event.currentTarget.value as ImportSurface)}>
                  <option value="planner">Planner</option><option value="dashboard">Dashboard</option>
                </select>
              </label>
              <label>importPreviewRef
                <input type="text" maxlength="512" required autocomplete="off" spellcheck={false}
                  value={state.historyRef} disabled={editLocked()}
                  onInput={(event) => {
                    fence()
                    clearReview()
                    setState({ historyRef: event.currentTarget.value, status: "ready", busy: false })
                  }} />
              </label>
              <button type="submit" class="mx-btn primary"
                disabled={state.busy || !state.historyRef.trim()}>{t("sf.u23.reconcile")}</button>
            </form>
          </Show>
          <Show when={isReference()}>
            <div class="sf-files-fields">
              <label>{t("sf.u23.source")}
                <select value={state.surface} disabled={editLocked()} onChange={(e) => newSource(e.currentTarget.value as ImportSurface)}>
                  <option value="planner">Planner</option><option value="dashboard">Dashboard</option>
                </select>
              </label>
              <button type="button" class="mx-btn" disabled={state.busy || !("manifestId" in props.route.params)}
                onClick={() => { void loadReference() }}>{t("sf.u23.reconcile")}</button>
            </div>
          </Show>
          <Show when={(isImport() || isReference() || isHistory()) && state.manifest && matchedSurface()}>
            <section class="sf-files-section" aria-label={t("sf.u23.context")}>
              <h2>{state.manifest!.domainApplied ? t("sf.u23.confirmed") : t("sf.u23.simulation")}</h2>
              <p>{state.manifest!.context.period.start} – {state.manifest!.context.period.end} · {state.manifest!.context.currency}</p>
              <dl>
                <For each={state.manifest!.baseIdentity}>{(base) => <>
                  <dt>{base.type} · {base.id}</dt><dd>{t("sf.u23.version")} {base.version} · {base.period.start} – {base.period.end}</dd>
                </>}</For>
              </dl>
            </section>
            <section class="sf-files-section" aria-label={t("sf.u23.context")}>
              <h2>{t("sf.u23.context")}</h2>
              <For each={state.manifest!.commands}>{(command) => <article class="mx-card">
                <p>{command.preview.engineVersion} · {t("sf.u23.version")} {command.preview.version}</p>
                <dl>
                  <For each={command.preview.components}>{(item) => <>
                    <dt>{item.id}</dt><dd>{item.amount === null ? t("sf.common.unknown") : item.amount} · {item.currency} · {item.evidenceState}</dd>
                  </>}</For>
                  <For each={command.preview.values}>{(item) => <>
                    <dt>{item.id}</dt><dd>{item.value === null ? t("sf.common.unknown") : String(item.value)} · {item.unit ?? ""} · {item.evidenceState}</dd>
                  </>}</For>
                  <For each={command.preview.missing}>{(item) => <>
                    <dt>{item.field}</dt><dd>{item.reason}</dd>
                  </>}</For>
                </dl>
              </article>}</For>
              <For each={state.manifest!.issues}>{(issue) =>
                <p role="status">{t("sf.u23.issues")}: {t("sf.u23.row")} {issue.row} · {issue.field} · {issue.reason}</p>
              }</For>
            </section>
            <section class="sf-files-section" aria-label={t("sf.u23.changes")}>
              <h2>{t("sf.u23.changes")}</h2>
              <For each={["added", "changed", "removed", "unchanged", "ignored", "rejected"] as const}>
                {(kind) => <details>
                  <summary>{t("sf.u23." + kind)} ({changeSummary(kind).length})</summary>
                  <Show when={changeSummary(kind).length === 0}><p>{t("sf.u23.noImpact")}</p></Show>
                  <For each={changeSummary(kind)}>{(entry) => <article class="sf-files-change">
                    <h3>{entry.path}</h3>
                    <p>{displayValue(entry.before)} → {displayValue(entry.after)}</p>
                    <p>{entry.source.kind === "file"
                      ? entry.source.sheet + " · " + t("sf.u23.row") + " " + entry.source.row +
                        ", " + t("sf.u23.column") + " " + entry.source.column + " · " + entry.source.address
                      : entry.source.reference}</p>
                    <Show when={entry.reason}><p>{entry.reason}</p></Show>
                    <Show when={kind === "ignored" || kind === "rejected"}><p>{t("sf.u23.notApplied")}</p></Show>
                  </article>}</For>
                </details>}
              </For>
            </section>
            <Show when={state.reference?.receipt}>
              {(receipt) => <section class="sf-files-section" data-sf-receipt="producer">
                <h2>{receipt().outcome === "rejected" ? t("sf.u23.rejectedReceipt") : t("sf.u23.recorded")}</h2>
                <p>{receipt().receiptId} · {t("sf.u23.outcome")}: {receipt().outcome} · {receipt().changedFields}</p>
                <For each={state.manifest!.receipts}>{(item) =>
                  <p>{item.id} · {item.at} · {item.status} · {item.version}</p>}</For>
              </section>}
            </Show>
            <div class="sf-files-actions">
              <Show when={isImport()}>
                <button type="button" class="mx-btn" disabled={state.busy}
                  onClick={cancelPreview}>{t("sf.u23.cancel")}</button>
              </Show>
              <Show when={isReference() && props.surfaceId === "UI56" && state.manifest?.state === "preview" && !state.reference?.receipt}>
                <A class="mx-btn" href={"/orchestra/sf-imports/" + encodeSfRouteRef(state.manifest!.id) + "/review"}>
                  {t("sf.ui56.primary")}
                </A>
              </Show>
              <Show when={(isImport() || isHistory()) && state.reference?.receipt}>
                <A class="mx-btn" href={"/orchestra/sf-imports/" + encodeSfRouteRef(state.manifest!.id) + "/receipt"}>
                  {t("sf.ui57.primary")}
                </A>
              </Show>
              <Show when={isReference() && props.surfaceId === "UI57"}>
                <A class="mx-btn" href="/orchestra/sf-imports">
                  {t("sf.common.returnToList")}
                </A>
              </Show>
              <Show when={isImport() || props.route.kind === "review"}>
                <button type="button" class="mx-btn primary" disabled={!canApply()}
                  onClick={() => { void applyReviewed() }}>{t("sf.u23.apply")}</button>
              </Show>
              <button type="button" class="mx-btn" disabled={state.busy}
                onClick={() => { if (isHistory()) void loadHistory(); else void reconcile() }}>
                {t("sf.u23.reconcile")}
              </button>
            </div>
          </Show>
          <Show when={isExport()}>
            <div class="sf-files-fields">
              <label>{t("sf.u23.format")}
                <select value={state.exportKind} disabled={state.busy}
                  onChange={(e) => { revokeExport(); setState("exportKind", e.currentTarget.value as LeafState["exportKind"]) }}>
                  <option value="xlsx">{t("sf.u23.exportXlsx")}</option>
                  <option value="suppliers">{t("sf.u23.exportSuppliers")}</option>
                  <option value="register">{t("sf.u23.exportRegister")}</option>
                  <option value="json">{t("sf.u23.exportJson")}</option>
                </select>
              </label>
              <Show when={state.download}>
                {(download) => <a class="mx-btn" href={download().href} download={download().name}
                  data-sf-export="authorized-bytes">{t("sf.u23.download")}: {download().name}</a>}
              </Show>
            </div>
          </Show>
        </SfStatePanel>
        <Show when={state.status === "unavailable" || state.status === "outcome-unknown" || state.status === "stale"}>
          <p role="alert" class="sf-files-note">{t(message())}</p>
          <Show when={state.phase === "unknown" && state.manifest}>
            <button type="button" class="mx-btn" disabled={state.busy}
              onClick={() => { void reconcile() }}>{t("sf.u23.reconcile")}</button>
          </Show>
        </Show>
      </section>
    </SfPageFrame>
  )
}
