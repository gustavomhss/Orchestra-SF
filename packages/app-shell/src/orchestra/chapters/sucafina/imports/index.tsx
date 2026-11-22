import { For, Show, createEffect, onCleanup, untrack, type JSX } from "solid-js"
import { A } from "@solidjs/router"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { createSfFilesClient } from "@orchestra/client/sucafina/files"
import { createSfProcurementClient } from "@orchestra/client/sucafina/procurement"
import { decodeRequestsPage, requestRef, requestVersion, type SfRequestsRead } from "../procurement/requests/model"
import type { SfFilesOperationOutput } from "@orchestra/schema/sucafina/files"
import type { SfTransportResult } from "@orchestra/schema/sucafina/common"
import type { SfSurfaceProps } from "../context/contracts"
import { useSfContext } from "../context"
import { encodeSfRouteRef } from "../navigation-state"
import { sfReadyOwnerSelection } from "../host/native-chapter-entry"
import { SfPageFrame } from "../shared/frame"
import type { SfCopyKey, SfUiState } from "../shared/frame"
import { SfStatePanel } from "../shared/states"
import { readSfAuthorizedImportHistoryReference } from "./history"
import "./imports.css"
import "../reviews/workflows.css"

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
  exportKind: "xlsx" | "suppliers" | "register" | "json" | "po"
  download: Readonly<{ name: string }> | undefined
  poRead: Extract<SfRequestsRead, { kind: "ready" }> | undefined
  poSelection: string
  poState: "idle" | "loading" | "ready" | "denied" | "stale" | "unavailable"
  poRefresh: number
}

// The document contract remains the authority for the financial result, receipt,
// scanner and current-base admission. This leaf never calculates, caches or retries effects.
export function SfImportsView(props: SfSurfaceProps<"UI55" | "UI56" | "UI57" | "UI68">): JSX.Element {
  const auth = useSfContext()
  const language = useLanguage()
  const key = (value: string): SfCopyKey => value as SfCopyKey
  const t = (value: string, params?: Record<string, string | number>) => language.t(value as Parameters<typeof language.t>[0], params)
  const [state, setState] = createStore<LeafState>({
    status: "loading", phase: "selecting", surface: "planner",
    start: "", end: "", targets: [], discovery: undefined, selectionRef: "",
    reviewedSelectionRef: "", needsDiscovery: false, historyRef: "",
    file: undefined, newVersion: false, removeMissing: false, replace: false,
    headerRow: "", manifest: undefined, reference: undefined, detail: undefined,
    busy: false, error: undefined, exportKind: "xlsx", download: undefined,
    poRead: undefined, poSelection: "", poState: "idle", poRefresh: 0,
  })
  let generation = 0
  let controller = new AbortController()
  let applyIntent: Readonly<{ id: string; version: number; digest: string; key: string }> | undefined
  let installedScope: string | undefined

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
  // Export bytes must not remain as a reusable blob URL after authorization changes.
  const revokeExport = () => setState("download", undefined)
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
    return resource?.operations.some((op) => op.operationId === operationId && op.state === "ready" && op.operational) ?? false
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
    // Keep the native file/date controls mounted while the read is in flight.
    // SfStatePanel removes its children on "loading", losing the browser FileList.
    setState({ status: "ready", busy: true, targets: [], discovery: undefined, selectionRef: "" })
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
  const refreshReference = async (manifestId: string, surface: ImportSurface, token: ReturnType<typeof fence>, publish = true) => {
    const api = client()
    if (!api || !permitted("files.import-reference")) return undefined
    const reply = await api["files.import-reference"]({ surface, importPreviewRef: manifestId }, { signal: token.signal })
    const reference = accept(token, unpack(reply))
    if (!reference || !current(token)) return undefined
    if (reference.manifest.id !== manifestId || reference.manifest.context.surface !== surface) {
      failure({ state: "invalid" })
      return undefined
    }
    if (!publish || (state.phase === "unknown" && !reference.receipt)) return reference
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
    // Admission and preview are busy actions, not a new page load. Unmounting
    // SfStatePanel here would discard the selected native file input.
    setState({ busy: true, status: "ready", phase: "selecting" })
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
    if (editLocked()) return
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
    setState({ busy: true, status: "ready" })
    const source = manifest.context.surface
    if (source !== "planner" && source !== "dashboard") { failure({ state: "invalid" }); return }
    const fresh = await refreshReference(manifest.id, source, token, false)
    if (!current(token)) return
    if (!fresh) { setState("busy", false); return }
    if (fresh.manifest.version !== manifest.version || fresh.digest !== reference.digest ||
      fresh.manifest.state !== "preview" || fresh.manifest.domainApplied || fresh.receipt) {
      setState("phase", "preview")
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
      const uncertain = outcome.state === "unavailable" || outcome.state === "outcome-unknown"
      if (!uncertain) setState("phase", "preview")
      failure({ state: uncertain ? "outcome-unknown" : outcome.state }, true)
      return
    }
    if (outcome.value.id !== intent.id || outcome.value.state !== "applied" ||
      !outcome.value.domainApplied) {
      failure({ state: "outcome-unknown" }, true)
      return
    }
    // The Apply response is not the receipt. Until it can be read, only reconciliation is allowed.
    setState({ phase: "unknown", status: "outcome-unknown" })
    await refreshReference(intent.id, source, token)
    if (current(token)) setState("busy", false)
  }
  const reconcile = async () => {
    const ref = applyIntent?.id ?? state.manifest?.id
    if (!ref || state.busy || !permitted("files.import-reference")) return
    const token = fence()
    const pending = state.phase === "unknown"
    setState({ busy: true, status: pending ? "outcome-unknown" : isImport() ? "ready" : "loading" })
    const source = state.manifest?.context.surface ?? state.surface
    if (source !== "planner" && source !== "dashboard") { failure({ state: "invalid" }); return }
    const fresh = await refreshReference(ref, source, token)
    if (!current(token)) return
    if (!fresh) { setState("busy", false); return }
    if (fresh.receipt) setState({ phase: "receipt", status: "ready" })
    else if (pending || applyIntent) setState({ phase: "unknown", status: "outcome-unknown" })
    else setState({ phase: "reviewing", status: "ready" })
    setState("busy", false)
  }
  const poCandidates = () => {
    const read = state.poRead
    if (!read) return []
    return read.records.filter((row) => {
      const ref = requestRef(row)
      return !!ref && !!row.po && !!row.po.number &&
        requestVersion(read, ref) !== undefined && /^[A-Za-z0-9._:-]{1,128}$/.test(ref)
    })
  }
  // A new PO selection MUST come from an authorized CAP25 projection, never a free-text URL.
  createEffect(() => {
    if (props.surfaceId !== "UI68" || state.exportKind !== "po") return
    const expectedOwner = ownerStamp()
    const ready = auth.ready()
    const generationAtRead = auth.generation()
    void state.poRefresh
    setState({ poRead: undefined, poSelection: "", poState: "loading" })
    if (!ready || !expectedOwner ||
        !ready.context.destinations.some((item) => item.capabilityId === "CAP25" && item.canRead) ||
        !ready.context.availability.some((item) => item.family === "procurement" && item.resource === "CAP25" &&
          item.operations.some((operation) => operation.operationId === "domain.page.CAP25" &&
            operation.state === "ready" && operation.operational))) {
      setState("poState", "denied")
      return
    }
    const abort = new AbortController()
    void createSfProcurementClient(ready.transport)["domain.page.CAP25"]({}, { signal: abort.signal })
      .then((reply) => {
        if (abort.signal.aborted || expectedOwner !== ownerStamp() || generationAtRead !== auth.generation()) return
        if (reply.kind !== "response") { setState("poState", "unavailable"); return }
        if (reply.status === 401 || reply.status === 403) { setState("poState", "denied"); return }
        const read = decodeRequestsPage(reply.body, ready.context.stamp)
        if (read.kind !== "ready") {
          setState("poState", read.kind === "stale" ? "stale" :
            read.kind === "denied" || read.kind === "unauthenticated" ? "denied" : "unavailable")
          return
        }
        setState({ poRead: read, poState: "ready" })
      }).catch(() => {
        if (!abort.signal.aborted && generationAtRead === auth.generation()) setState("poState", "unavailable")
      })
    onCleanup(() => abort.abort())
  })
  const download = async () => {
    const api = client()
    const kind = state.exportKind
    const poSelection = state.poSelection
    const poRead = state.poRead
    const selectedPo = kind === "po" && poRead
      ? poCandidates().find((row) => requestRef(row) === poSelection) : undefined
    const selectedRef = selectedPo && requestRef(selectedPo)
    const selectedVersion = selectedRef && poRead
      ? requestVersion(poRead, selectedRef) : undefined
    if (!api || state.busy || !permitted("files.export." + kind) ||
        kind === "po" && (!selectedPo || !selectedRef || selectedVersion === undefined ||
          !poRead || state.poState !== "ready")) {
      setState("status", "unavailable")
      return
    }
    const token = fence()
    revokeExport()
    setState({ busy: true, status: "loading" })
    // Re-read the selected PO from its authorized producer immediately before exporting.
    if (kind === "po") {
      const ready = auth.ready()
      if (!ready || !selectedPo || !selectedRef || selectedVersion === undefined) {
        if (current(token)) failure({ state: "denied" })
        return
      }
      const fresh = await createSfProcurementClient(ready.transport)["domain.page.CAP25"](
        { request: selectedRef }, { signal: token.signal },
      )
      if (!current(token)) return
      if (fresh.kind !== "response" || fresh.status !== 200) {
        failure({ state: fresh.kind === "response" && fresh.status === 403 ? "denied" : "unavailable" })
        return
      }
      const verified = decodeRequestsPage(fresh.body, ready.context.stamp)
      if (verified.kind !== "ready" || !verified.records.some((row) => {
        const ref = requestRef(row)
        return ref === selectedRef && !!row.po && !!row.po.number &&
          requestVersion(verified, ref) === selectedVersion
      })) {
        failure({ state: "stale" })
        return
      }
    }
    const result = kind === "po"
      ? await api["files.export.po"]({ surface: "procurement", request: poSelection }, { signal: token.signal })
      : kind === "xlsx"
        ? await api["files.export.xlsx"]({ surface: "planner" }, { signal: token.signal })
        : kind === "suppliers"
          ? await api["files.export.suppliers"]({ surface: "procurement" }, { signal: token.signal })
          : kind === "register"
            ? await api["files.export.register"]({ surface: "procurement" }, { signal: token.signal })
            : await api["files.export.json"]({ surface: "dashboard" }, { signal: token.signal })
    if (!current(token)) return
    if (result.kind !== "response" || result.status !== 200 || !(result.body instanceof Uint8Array) ||
        result.body.byteLength === 0) {
      failure({ state: result.kind === "response" && result.status === 403 ? "denied" :
        result.kind === "response" && (result.status === 404 || result.status === 409) ? "stale" : "unavailable" })
      return
    }
    if (kind === "po" && (state.poSelection !== poSelection || state.poState !== "ready" ||
        !poCandidates().some((row) => requestRef(row) === poSelection))) {
      failure({ state: "stale" })
      return
    }
    const disposition = result.headers["content-disposition"] ?? ""
    const matched = /filename="?([^";\r\n]+)"?/i.exec(disposition)
    const originalName = matched?.[1]?.replace(/[^a-zA-Z0-9_.-]/g, "_")
    const suffix = kind === "po" ? ".html" : kind === "xlsx" ? ".xlsx" :
      kind === "json" ? ".json" : ".csv"
    const filename = originalName && !originalName.startsWith(".") && originalName.endsWith(suffix)
      ? originalName : "sucafina-" + kind +
        (kind === "po" ? "-" + poSelection.replace(/[^A-Za-z0-9._-]/g, "_") : "") + suffix
    const href = URL.createObjectURL(new Blob([new Uint8Array(result.body)], {
      type: result.headers["content-type"] ?? "application/octet-stream",
    }))
    const anchor = document.createElement("a")
    anchor.href = href
    anchor.download = filename
    anchor.click()
    requestAnimationFrame(() => URL.revokeObjectURL(href))
    // Terminal result only: there is no persistent authorization-free download link.
    setState({ download: { name: filename }, status: "ready", busy: false })
  }

  createEffect(() => {
    const routeKind = props.route.kind
    const chapter = props.surfaceId
    const ready = auth.ready()
    const selectedOwner = ownerStamp()
    const authStatus = auth.state().status
    const scope = JSON.stringify([routeKind, chapter, props.route.href, selectedOwner, authStatus])
    // A same-owner context publication must not erase an in-progress import.
    // Revoke private state on an actual route, authority or session transition.
    if (scope === installedScope) return
    installedScope = scope
    untrack(() => {
      fence()
      revokeExport()
      applyIntent = undefined
      setState({ status: ready ? "ready" : authStatus === "resolving" ? "loading" :
        authStatus === "unauthenticated" ? "session-expired" :
        authStatus === "denied" ? "denied" : "unavailable",
        phase: "selecting", targets: [], discovery: undefined, selectionRef: "",
        reviewedSelectionRef: "", needsDiscovery: true, manifest: undefined,
        historyRef: "", reference: undefined, detail: undefined, file: undefined,
        busy: false, error: undefined, poRead: undefined, poSelection: "", poState: "idle" })
      if (chapter === "UI57" && routeKind === "history" && ready && selectedOwner) {
        // Reference/detail reads only; no inferred history collection.
        setState("historyRef", "")
      }
      // Route-param consumers require an explicit producer surface.
    })
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
  const canApply = () => permitted("files.import-apply") && !state.busy && state.phase === "reviewing" &&
    !!state.manifest && !state.manifest.domainApplied && state.manifest.state === "preview" &&
    !!state.reference && !state.reference.receipt &&
    (!isImport() || (!!state.reviewedSelectionRef &&
      selectedTarget()?.selectionRef === state.reviewedSelectionRef))
  const changeSummary = (kind: Detail["detail"]["changes"][number]["kind"]) =>
    state.detail?.detail.changes.filter((item) => item.kind === kind) ?? []
  const displayValue = (value: Detail["detail"]["changes"][number]["before"]) =>
    value.state !== "present" ? t("sf.u23." + value.state) : value.value === null ? t("sf.u23.null") : JSON.stringify(value.value)
  const matchedSurface = () => state.manifest?.context.surface === state.surface
  const continuationHref = (step: "review" | "receipt" | "list") => {
    const current = auth.state()
    if (current.status !== "ready" || !auth.ready()) return
    const selected = sfReadyOwnerSelection(current)
    const requested = props.route.ownerSelection
    if (!selected || !selected.serverKey || !selected.projectId || !selected.installationId) return
    if (selected.serverKey !== requested.serverKey || selected.projectId !== requested.projectId ||
        selected.installationId !== requested.installationId) return
    const id = state.manifest?.id
    if (!id) return
    const path = step === "list" ? "/orchestra/sf-imports" :
      "/orchestra/sf-imports/" + encodeSfRouteRef(id) + "/" + step
    // These are same-owner continuations. F01 still readmits the destination.
    return path + "?" + new URLSearchParams({
      server: selected.serverKey, project: selected.projectId, installation: selected.installationId,
    }).toString()
  }

  return (
    <SfPageFrame titleKey={key(title())} context={[]} tabs={[]} activeTab={null}
      secondaryActions={[]} density="comfortable" layout="work" onLayoutMode={() => undefined}
      primaryAction={isExport() ? {
        id: "export", labelKey: key("sf.ui68.primary"), tone: "primary",
        disabled: state.busy || !permitted("files.export." + state.exportKind) ||
          state.exportKind === "po" && (!state.poSelection || state.poState !== "ready"),
        busy: state.busy, onInvoke: () => { void download() },
      } : undefined}
    >
      <section data-sf-wave="polish" class="sf-files sf-workflow" data-sf-leaf="u23" data-sf-surface={props.surfaceId}
        data-sf-phase={state.phase} data-sf-read-state={state.status}>
        <SfStatePanel state={state.status} messageKey={key(message())}
          onRetryRead={state.phase === "unknown" ? undefined : () => { if (isHistory()) void loadHistory(); else if (isReference()) void loadReference(); else if (isImport()) void discover(); else if (isExport()) {
              if (state.exportKind === "po") setState("poRefresh", state.poRefresh + 1)
              else void download()
            } }}
          onBack={isHistory() && state.status === "not-found" ? () => {
            fence(); clearReview(); setState({ status: "ready", historyRef: "", busy: false })
          } : undefined}>
          <Show when={isImport()}>
            <div class="sf-files-fields">
              <label>{t("sf.u23.label.source")}
                <select aria-label={t("sf.u23.label.source")} value={state.surface} disabled={editLocked()} onChange={(e) => newSource(e.currentTarget.value as ImportSurface)}>
                  <option value="planner">{t("sf.u23.planner")}</option><option value="dashboard">{t("sf.u23.dashboard")}</option>
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
                <select aria-label={t("sf.u23.destination")} value={state.selectionRef} disabled={editLocked() || !state.targets.length}
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
              <label>{t("sf.u23.label.headerRow")}
                <input type="number" min="1" step="1" value={state.headerRow} disabled={editLocked()}
                  onChange={(e) => { change(); setState("headerRow", e.currentTarget.value) }} />
              </label>
              <button type="button" class="mx-btn primary" disabled={editLocked() || !selectedTarget() || !state.file ||
                !permitted("files.import-admit") || !permitted("files.import-preview")}
                onClick={() => { void prepare() }}>{t("sf.ui55.primary")}</button>
            </div>
          </Show>
          <Show when={isHistory()}>
            <form class="sf-files-fields" data-sf-history="authorized-reference"
              onSubmit={(event) => { event.preventDefault(); void loadHistory() }}>
              <label>{t("sf.u23.label.source")}
                <select value={state.surface} disabled={editLocked()}
                  onChange={(event) => newSource(event.currentTarget.value as ImportSurface)}>
                  <option value="planner">{t("sf.u23.planner")}</option><option value="dashboard">{t("sf.u23.dashboard")}</option>
                </select>
              </label>
              <label>{t("sf.u23.label.previewRef")}
                <input type="text" maxlength="512" required autocomplete="off" spellcheck={false}
                  value={state.historyRef} disabled={editLocked()}
                  onInput={(event) => {
                    fence()
                    clearReview()
                    setState({ historyRef: event.currentTarget.value, status: "ready", busy: false })
                  }} />
              </label>
              <button type="submit" class="mx-btn primary"
                disabled={state.busy || !state.historyRef.trim() ||
                  !permitted("files.import-reference") || !permitted("files.import-detail")}>{t("sf.u23.reconcile")}</button>
            </form>
          </Show>
          <Show when={isReference()}>
            <div class="sf-files-fields">
              <label>{t("sf.u23.label.source")}
                <select value={state.surface} disabled={editLocked()} onChange={(e) => newSource(e.currentTarget.value as ImportSurface)}>
                  <option value="planner">{t("sf.u23.planner")}</option><option value="dashboard">{t("sf.u23.dashboard")}</option>
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
                    <h3>{entry.source.kind === "file" ? t("sf.u23.changeCell", {
                      sheet: entry.source.sheet, row: entry.source.row, column: entry.source.column,
                    }) : t("sf.u23.sourceChange")}</h3>
                    <div class="sf-files-diff">
                      <div><h4>{t("sf.u23.before")}</h4><p>{displayValue(entry.before)}</p></div>
                      <div><h4>{t("sf.u23.after")}</h4><p>{displayValue(entry.after)}</p></div>
                    </div>
                    <details class="sf-technical-details">
                      <summary>{t("sf.u23.sourceDetails")}</summary>
                      <p>{t("sf.u23.fieldReference")}: <code>{entry.path}</code></p>
                      <p>{entry.source.kind === "file"
                        ? entry.source.sheet + " · " + t("sf.u23.row") + " " + entry.source.row +
                          ", " + t("sf.u23.column") + " " + entry.source.column + " · " + entry.source.address
                        : entry.source.reference}</p>
                    </details>
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
            <div class="sf-files-actions sf-form-actions">
              <Show when={isImport()}>
                <button type="button" class="mx-btn" disabled={editLocked()}
                  onClick={cancelPreview}>{t("sf.u23.cancel")}</button>
              </Show>
              <Show when={isReference() && props.surfaceId === "UI56" && state.manifest?.state === "preview" && !state.reference?.receipt && continuationHref("review")}>
                {(href) => <A class="mx-btn" href={href()}>
                  {t("sf.ui56.primary")}
                </A>}
              </Show>
              <Show when={(isImport() || isHistory()) && state.reference?.receipt && continuationHref("receipt")}>
                {(href) => <A class="mx-btn" href={href()}>
                  {t("sf.ui57.primary")}
                </A>}
              </Show>
              <Show when={isReference() && props.surfaceId === "UI57" && continuationHref("list")}>
                {(href) => <A class="mx-btn" href={href()}>
                  {t("sf.common.returnToList")}
                </A>}
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
            <Show when={!permitted("files.export." + state.exportKind)}>
              <p role="status" class="sf-files-note">{t("sf.u23.exportUnavailable")}</p>
            </Show>
            <div class="sf-files-fields">
              <label>{t("sf.u23.label.format")}
                <select aria-label={t("sf.u23.label.format")} value={state.exportKind} disabled={state.busy}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    if (value !== "xlsx" && value !== "suppliers" && value !== "register" &&
                        value !== "json" && value !== "po") return
                    revokeExport()
                    setState("exportKind", value)
                  }}>
                  <option value="xlsx">{t("sf.u23.exportXlsx")}</option>
                  <option value="suppliers">{t("sf.u23.exportSuppliers")}</option>
                  <option value="register">{t("sf.u23.exportRegister")}</option>
                  <option value="json">{t("sf.u23.exportJson")}</option>
                  <option value="po">{t("sf.u23.exportPo")}</option>
                </select>
              </label>
              <Show when={state.exportKind === "po"}>
                <label>{t("sf.u23.poCurrent")}
                  <select value={state.poSelection} disabled={state.busy || state.poState !== "ready"}
                    onChange={(event) => { revokeExport(); setState("poSelection", event.currentTarget.value) }}>
                    <option value="">{t("sf.u23.poSelect")}</option>
                    <For each={poCandidates()}>{(row) =>
                      <option value={requestRef(row)}>{row.po?.number} · {row.number} · {row.status}</option>
                    }</For>
                  </select>
                </label>
                <p role="status">{t("sf.u23.selection", { state: t("sf.u23.poState." + state.poState) })} {t("sf.u23.poOnly")}</p>
                <button type="button" class="mx-btn" disabled={state.busy}
                  onClick={() => { revokeExport(); setState("poRefresh", state.poRefresh + 1) }}>
                  {t("sf.u23.poRefresh")}
                </button>
              </Show>
              <Show when={state.download}>
                {(download) => <p role="status" data-sf-export="authorized-bytes">
                  {t("sf.u23.download")}: {download().name}. {t("sf.u23.downloadAgain")}
                </p>}
              </Show>
            </div>
          </Show>
        </SfStatePanel>
        <Show when={state.phase === "unknown" && state.manifest && permitted("files.import-reference")}>
          <button type="button" class="mx-btn" disabled={state.busy}
            onClick={() => { void reconcile() }}>{t("sf.u23.reconcile")}</button>
        </Show>
      </section>
    </SfPageFrame>
  )
}
