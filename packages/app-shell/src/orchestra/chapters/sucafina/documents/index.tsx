import { For, Show, createEffect, createUniqueId, on, onCleanup, untrack, type JSX } from "solid-js"
import { createStore, unwrap } from "solid-js/store"
import { A } from "@solidjs/router"
import { useLanguage } from "@/context/language"
import { createSfFilesClient } from "@orchestra/client/sucafina/files"
import type { SfFilesOperationOutput } from "@orchestra/schema/sucafina/files"
import type { SfTransportResult } from "@orchestra/schema/sucafina/common"
import type { SfSurfaceProps } from "../context/contracts"
import { useSfContext } from "../context"
import { sfReadyOwnerSelection } from "../host/native-chapter-entry"
import { encodeSfRouteRef } from "../navigation-state"
import { SfPageFrame } from "../shared/frame"
import type { SfCopyKey, SfUiState } from "../shared/frame"
import { SfStatePanel } from "../shared/states"
import "./documents.css"
import "./records.css"
import { readSfUploadTargets, sfUploadTargetOperation, type SfDocumentUploadKind, type SfDocumentUploadTarget } from "./upload-targets"

type FileSurface = "dashboard" | "planner" | "procurement"
type Requests = Extract<SfFilesOperationOutput<"files.document-requests">, { status: "ok" }>["value"]
type Sources = Extract<SfFilesOperationOutput<"files.document-sources">, { status: "ok" }>["value"]
type Candidates = Extract<SfFilesOperationOutput<"files.document-candidates">, { status: "ok" }>["value"]
type Evidence = Candidates[number]
type Opened = Extract<SfFilesOperationOutput<"files.document-open">, { status: "ok" }>["value"]
type Matches = Extract<SfFilesOperationOutput<"files.document-search">, { status: "ok" }>["value"]
type Targets = Extract<SfFilesOperationOutput<"files.document-scenario-targets">, { status: "ok" }>["value"]
type Preview = Extract<SfFilesOperationOutput<"files.document-scenario-preview">, { status: "ok" }>["value"]
type Failure = Exclude<SfFilesOperationOutput<"files.document-candidates">, { status: "ok" }>
type Port<Value> = Readonly<{ status: "ok"; value: Value }> | Failure
type Result<Value> = Readonly<{ kind: "value"; value: Value }> | Readonly<{ kind: "failure"; state: SfUiState }>

// The transport validates the exact producer shape, outside Solid store proxies.
const documentInput = <T,>(value: T): T => structuredClone(unwrap(value))

function unpack<Value>(reply: SfTransportResult<Port<Value>>): Result<Value> {
  if (reply.kind === "transport-error")
    return { kind: "failure", state: reply.reason === "outcome-unknown" ? "outcome-unknown" : "unavailable" }
  if (reply.status === 401) return { kind: "failure", state: "session-expired" }
  if (reply.status === 403) return { kind: "failure", state: "denied" }
  if (reply.status === 404) return { kind: "failure", state: "not-found" }
  if (reply.status === 409) return { kind: "failure", state: "stale" }
  if (reply.body.status === "ok" && reply.status >= 200 && reply.status < 300)
    return { kind: "value", value: reply.body.value }
  if (reply.body.status === "denied") return { kind: "failure", state: "denied" }
  if (reply.body.status === "stale" || reply.body.status === "conflict" || reply.body.status === "provider-conflict")
    return { kind: "failure", state: "stale" }
  if (reply.body.status === "needs-input" || reply.body.status === "invalid")
    return { kind: "failure", state: "invalid" }
  return { kind: "failure", state: "unavailable" }
}

type LeafState = {
  status: SfUiState
  busy: boolean
  phase: "catalog" | "candidates" | "extracting" | "confirm-review" | "confirming" |
    "confirmed" | "scenario" | "preview" | "unknown"
  surface: FileSurface
  requests: Requests
  sources: Sources
  requestSelectionRef: string
  sourceSelectionRef: string
  documentRef: string
  candidates: Candidates
  selectedCandidateId: string
  opened: Opened | undefined
  fieldId: string
  fieldType: "string" | "number" | "boolean" | "date"
  fieldUnit: string
  search: string
  matches: Matches | undefined
  targets: Targets
  selectedTarget: string
  preview: Preview | undefined
  uploadKind: SfDocumentUploadKind
  uploadRecord: string
  uploadTargets: SfDocumentUploadTarget[]
  uploadReadState: SfUiState
  uploadReadRevision: number
  uploadOpened: boolean
  uploadExpanded: boolean
  uploadConflictRecord: string
  uploadName: string
  uploadNotice: string
  rejectionReason: string
  rejectionPage: string
  linkedRef: string
  error: SfUiState | undefined
}

const validCurrency = (value: Evidence) =>
  value.status === "confirmed" && typeof value.value === "number" &&
  Number.isFinite(value.value) && /^[A-Z]{3}$/.test(value.unit ?? "") &&
  value.ref.target.fieldCandidateId !== undefined &&
  value.ref.target.confirmationVersion !== undefined
const showScenarioValue = (scenario: unknown, field: string): string | null => {
  if (typeof scenario !== "object" || scenario === null || Array.isArray(scenario) ||
      !Object.hasOwn(scenario, field)) return null
  const value = (scenario as Record<string, unknown>)[field]
  return value === null ? null : typeof value === "string" || typeof value === "number" ||
    typeof value === "boolean" ? String(value) : null
}

// Documents use A06's closed operations; upload selection reads the original A01/A03 record catalogs.
// A candidate never becomes confirmed because of UI selection or extraction.
export function SfDocumentsView(props: SfSurfaceProps<"UI58" | "UI59" | "UI60">): JSX.Element {
  const auth = useSfContext()
  const language = useLanguage()
  const uploadHelpId = createUniqueId()
  const key = (value: string): SfCopyKey => value as SfCopyKey
  const t = (value: string) => language.t(value as Parameters<typeof language.t>[0])
  const [state, setState] = createStore<LeafState>({
    status: "loading", busy: false, phase: "catalog", surface: "procurement",
    requests: [], sources: [], requestSelectionRef: "", sourceSelectionRef: "",
    documentRef: "", candidates: [], selectedCandidateId: "", opened: undefined,
    fieldId: "", fieldType: "number", fieldUnit: "", search: "", matches: undefined,
    targets: [], selectedTarget: "", preview: undefined,
    uploadKind: "quote", uploadRecord: "", uploadTargets: [], uploadReadState: "loading", uploadReadRevision: 0,
    uploadOpened: props.route.kind === "new", uploadExpanded: props.route.kind === "new", uploadConflictRecord: "",
    uploadName: "", uploadNotice: "",
    rejectionReason: "", rejectionPage: "1", linkedRef: "", error: undefined,
  })
  let generation = 0
  let controller = new AbortController()
  let mutationUnknown = false
  let uploadFile: File | undefined
  let installedScope: string | undefined
  const ownerStamp = () => {
    const context = auth.state()
    return context.status === "ready"
      ? JSON.stringify([context.ownerKey, context.owner.authEpoch, context.context.stamp, auth.generation()])
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
  const client = () => {
    const ready = auth.ready()
    return ready ? createSfFilesClient(ready.transport) : undefined
  }
  const permitted = (operationId: string) => {
    const ready = auth.ready()
    const resource = ready?.context.availability.find((entry) =>
      entry.operations.some((op) => op.operationId === operationId))
    return resource?.operations.some((op) => op.operationId === operationId && op.state === "ready") ?? false
  }
  const fail = (reason: SfUiState, mutation = false) => {
    if (reason === "denied" || reason === "session-expired") {
      uploadFile = undefined
      setState({ uploadRecord: "", uploadTargets: [], uploadReadState: reason, uploadName: "", uploadConflictRecord: "" })
      setState({ candidates: [], sources: [], requests: [], matches: undefined, opened: undefined,
        targets: [], preview: undefined, documentRef: "", selectedCandidateId: "" })
    }
    if (reason === "stale" || reason === "conflict") {
      setState("uploadRecord", "")
      setState({ selectedCandidateId: "", opened: undefined, targets: [], preview: undefined, phase: "catalog" })
    }
    mutationUnknown = mutation && (reason === "outcome-unknown" || reason === "unavailable")
    setState({ status: mutationUnknown ? "outcome-unknown" : reason, error: reason, busy: false, uploadNotice: "",
      phase: mutationUnknown ? "unknown" : state.phase })
  }
  const accept = <Value,>(token: ReturnType<typeof fence>, result: Result<Value>): Value | undefined => {
    if (!current(token)) return undefined
    if (result.kind === "failure") { fail(result.state); return undefined }
    return result.value
  }
  const clearSelection = () => {
    mutationUnknown = false
    setState({ documentRef: "", candidates: [], selectedCandidateId: "", opened: undefined,
      targets: [], selectedTarget: "", preview: undefined, matches: undefined,
      rejectionReason: "", rejectionPage: "1", linkedRef: "", phase: "catalog" })
  }
  const clearOnSourceChange = () => {
    fence()
    clearSelection()
    setState({ status: "ready" })
  }
  const loadSources = async () => {
    const api = client()
    if (!api || !permitted("files.document-sources")) { setState("status", "unavailable"); return }
    const token = fence()
    clearSelection()
    setState({ busy: true, status: "loading", sources: [], sourceSelectionRef: "" })
    const result = await api["files.document-sources"]({
      surface: state.surface,
      ...(state.requestSelectionRef ? { requestSelectionRef: state.requestSelectionRef } : {}),
    }, { signal: token.signal })
    const value = accept(token, unpack(result))
    if (!value || !current(token)) return
    setState({ sources: value, busy: false, status: "ready" })
  }
  const loadCatalog = async () => {
    const api = client()
    if (!api || !permitted("files.document-requests")) { setState("status", "unavailable"); return }
    const token = fence()
    clearSelection()
    setState({ requests: [], sources: [], status: "loading", busy: true })
    const result = await api["files.document-requests"]({ surface: state.surface }, { signal: token.signal })
    const requests = accept(token, unpack(result))
    if (!requests || !current(token)) return
    setState({ requests, busy: false, status: "ready" })
    // Read only: the original producer restricts these sources to the actor.
    const sourcesResult = await api["files.document-sources"]({ surface: state.surface }, { signal: token.signal })
    const sources = accept(token, unpack(sourcesResult))
    if (!sources || !current(token)) return
    setState({ sources, status: "ready", busy: false })
  }
  const readCandidates = async (documentRef: string, token: ReturnType<typeof fence>) => {
    const api = client()
    if (!api || !permitted("files.document-candidates")) return undefined
    const result = await api["files.document-candidates"]({
      surface: state.surface, documentRef,
    }, { signal: token.signal })
    const candidates = accept(token, unpack(result))
    if (!candidates || !current(token)) return undefined
    if (documentRef !== state.documentRef) return undefined
    setState({ candidates, status: "ready", busy: false,
      phase: candidates.length ? "candidates" : "catalog" })
    return candidates
  }
  const loadRouteCandidates = async () => {
    const route = props.route
    if (!("documentRef" in route.params)) return
    const token = fence()
    clearSelection()
    setState({ documentRef: route.params.documentRef, status: "loading", busy: true })
    await readCandidates(route.params.documentRef, token)
    if (current(token)) setState("busy", false)
  }
  const admit = async () => {
    const api = client()
    if (!api || !state.sourceSelectionRef || !permitted("files.document-admit") || state.busy) return
    const token = fence()
    clearSelection()
    setState({ status: "loading", busy: true, documentRef: "" })
    const reply = await api["files.document-admit"]({
      surface: state.surface, selectionRef: state.sourceSelectionRef,
    }, { signal: token.signal, idempotencyKey: crypto.randomUUID() })
    if (!current(token)) return
    const result = unpack(reply)
    if (result.kind === "failure") { fail(result.state, true); return }
    if (!result.value.documentRef) { fail("invalid"); return }
    setState("documentRef", result.value.documentRef)
    await readCandidates(result.value.documentRef, token)
  }
  const uploadTarget = () => state.uploadTargets.find((target) => target.record === state.uploadRecord && target.kind === state.uploadKind)
  const upload = async () => {
    const api = client()
    const file = uploadFile
    const kind = state.uploadKind
    const target = uploadTarget()
    const record = target?.record
    const version = target?.version
    const extension = file?.name.split(".").pop()?.toLowerCase()
    const mime = extension === "pdf" ? "application/pdf" :
      extension === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" :
      extension === "txt" ? "text/plain" : undefined
    const page = kind === "contract" ? "Vendor Contracts" :
      kind === "supplier" ? "Suppliers" : "Requests"
    if (!api || !permitted("files.asset.upload") || state.busy || !file ||
        !mime || file.type && file.type !== mime ||
        file.size < 1 || file.size > 20 * 1024 * 1024 || file.name.length > 255 ||
        state.uploadReadState !== "ready" || !target || !record ||
        version === undefined || !Number.isSafeInteger(version) || version < 0 ||
        (state.surface === "dashboard" ? kind !== "contract" :
          state.surface !== "procurement" || kind === "contract")) {
      setState({ uploadNotice: "sf.u24.uploadInvalid", status: "ready" })
      return
    }
    const token = fence()
    setState({ busy: true, status: "ready", uploadNotice: "sf.u24.uploadWorking", uploadConflictRecord: "" })
    let bytes: Uint8Array
    try { bytes = new Uint8Array(await file.arrayBuffer()) }
    catch { if (current(token)) fail("unavailable"); return }
    if (!current(token)) return
    if (bytes.byteLength !== file.size || bytes.byteLength === 0) { fail("invalid"); return }
    const reply = await api["files.asset.upload"]({
      surface: state.surface === "dashboard" ? "dashboard" : "procurement",
      upload: kind, record, recordVersion: version, name: file.name,
      page, mediaType: mime, bytes,
    }, { signal: token.signal, idempotencyKey: crypto.randomUUID() })
    if (!current(token)) return
    // Asset upload uses the legacy {ok} producer envelope, not a document PortResult.
    // Require the producer's actual successful HTTP response; never invent a scan verdict.
    if (reply.kind === "transport-error") {
      fail(reply.reason === "outcome-unknown" ? "outcome-unknown" : "unavailable", true)
      return
    }
    if (reply.status === 401) { fail("session-expired", true); return }
    if (reply.status === 403) { fail("denied", true); return }
    if (reply.status === 404) { fail("not-found", true); return }
    if (reply.status === 409) {
      setState("uploadConflictRecord", target.label)
      fail("stale", true)
      return
    }
    if (reply.status < 200 || reply.status >= 300 || reply.body.ok !== true) {
      fail("unavailable", true)
      return
    }
    uploadFile = undefined
    mutationUnknown = false
    setState({ uploadName: "", uploadRecord: "", uploadConflictRecord: "", uploadNotice: "sf.u24.uploadAccepted",
      uploadReadRevision: state.uploadReadRevision + 1 })
    await loadCatalog()
  }
  const search = async () => {
    const api = client()
    if (!api || !state.search.trim() || !permitted("files.document-search")) return
    const token = fence()
    setState({ busy: true, status: "loading", matches: undefined })
    const result = await api["files.document-search"]({
      surface: state.surface, query: state.search.trim(), limit: 20,
      ...(state.documentRef ? { documentRefs: [state.documentRef] } : {}),
    }, { signal: token.signal })
    const matches = accept(token, unpack(result))
    if (!matches || !current(token)) return
    setState({ matches, status: matches.matches.length ? "ready" : "filtered-empty", busy: false })
  }
  const selected = () => state.candidates.find((item) => item.id === state.selectedCandidateId)
  const canLinkCurrency = () => { const candidate = selected(); return !!candidate && validCurrency(candidate) }
  const openSearchSource = async (ref: Matches["matches"][number]["documentRef"]) => {
    const api = client()
    if (!api || !permitted("files.document-open")) { setState("status", "unavailable"); return }
    const token = fence()
    setState({ selectedCandidateId: "", opened: undefined, status: "loading", busy: true })
    const result = await api["files.document-open"]({ surface: state.surface, ref: documentInput(ref) }, { signal: token.signal })
    const source = accept(token, unpack(result))
    if (!source || !current(token)) return
    setState({ opened: source, status: "ready", busy: false })
  }
  const openEvidence = async (candidate: Evidence) => {
    const api = client()
    if (!api || !permitted("files.document-open") ||
      !state.candidates.some((item) => item.id === candidate.id && item.version === candidate.version)) return
    const token = fence()
    setState({ selectedCandidateId: candidate.id, opened: undefined, status: "loading", busy: true,
      preview: undefined, targets: [], selectedTarget: "" })
    const result = await api["files.document-open"]({ surface: state.surface, ref: documentInput(candidate.ref) }, { signal: token.signal })
    const opened = accept(token, unpack(result))
    if (!opened || !current(token)) return
    setState({ opened, status: "ready", busy: false, phase: "candidates" })
  }
  const extractField = async () => {
    const api = client()
    if (!api || !state.documentRef || !state.fieldId.trim() || state.fieldId.length > 120 ||
      state.fieldUnit.length > 40 || !permitted("files.document-schema") ||
      !permitted("files.document-extract") || state.busy) return
    const token = fence()
    setState({ phase: "extracting", busy: true, status: "loading" })
    const schema = unpack(await api["files.document-schema"]({
      surface: state.surface, documentRef: state.documentRef,
      fields: [{ id: state.fieldId.trim(), type: state.fieldType,
        ...(state.fieldUnit.trim() ? { unit: state.fieldUnit.trim() } : {}) }],
    }, { signal: token.signal, idempotencyKey: crypto.randomUUID() }))
    if (!current(token)) return
    if (schema.kind === "failure") { fail(schema.state, true); return }
    const extraction = unpack(await api["files.document-extract"]({
      surface: state.surface, documentRef: state.documentRef, fieldSchemaRef: schema.value.ref,
    }, { signal: token.signal, idempotencyKey: crypto.randomUUID() }))
    if (!current(token)) return
    if (extraction.kind === "failure") { fail(extraction.state, true); return }
    if (extraction.value.fileRef !== state.documentRef ||
      extraction.value.status !== "extracted") { fail("stale"); return }
    await readCandidates(state.documentRef, token)
  }
  const confirm = async () => {
    const api = client()
    const candidate = selected()
    if (!api || !candidate || !state.opened || candidate.status !== "extracted" ||
      !permitted("files.document-confirm") || state.phase !== "confirm-review" || state.busy) return
    const token = fence()
    setState({ busy: true, phase: "confirming", status: "loading" })
    const result = unpack(await api["files.document-confirm"]({
      surface: state.surface, evidence: documentInput(candidate),
    }, { signal: token.signal, idempotencyKey: crypto.randomUUID() }))
    if (!current(token)) return
    if (result.kind === "failure") { fail(result.state, true); return }
    const confirmedEvidence = result.value
    if (!("status" in confirmedEvidence) || confirmedEvidence.status !== "confirmed" ||
      !("version" in confirmedEvidence) || confirmedEvidence.id !== candidate.id ||
      confirmedEvidence.ref.target.documentId !== candidate.ref.target.documentId) {
      fail("outcome-unknown", true)
      return
    }
    const confirmedVersion = confirmedEvidence.version
    const fresh = await readCandidates(state.documentRef, token)
    if (!current(token)) return
    if (fresh?.some((entry) => entry.id === confirmedEvidence.id &&
      entry.status === "confirmed" && entry.version === confirmedVersion)) {
      setState({ phase: "confirmed", status: "ready" })
      mutationUnknown = false
    } else fail("stale")
  }
  const reject = async () => {
    const api = client()
    const candidate = selected()
    const reason = state.rejectionReason.trim()
    const page = Number(state.rejectionPage)
    if (!api || !candidate || !state.opened || candidate.status !== "extracted" ||
        state.phase !== "confirm-review" || state.busy || !permitted("files.document-confirm") ||
        reason.length < 5 || reason.length > 500 || /[\r\n\0]/.test(reason) ||
        !/^[1-9]\d*$/.test(state.rejectionPage) || !Number.isSafeInteger(page) || page > 500)
      return
    const token = fence()
    setState({ phase: "confirming", busy: true, status: "loading" })
    const result = unpack(await api["files.document-confirm"]({
      surface: state.surface, action: "reject", evidence: documentInput(candidate), reason, page,
    }, { signal: token.signal, idempotencyKey: crypto.randomUUID() }))
    if (!current(token)) return
    if (result.kind === "failure") { fail(result.state, true); return }
    if (!("status" in result.value) || result.value.status !== "rejected" ||
        result.value.id !== candidate.id || !result.value.rejection ||
        result.value.rejection.reason !== reason || result.value.rejection.page !== page) {
      fail("outcome-unknown", true)
      return
    }
    const fresh = await readCandidates(state.documentRef, token)
    if (!current(token)) return
    if (fresh?.some((entry) => entry.id === candidate.id && entry.status === "rejected" &&
        !!entry.rejection && entry.rejection.reason === reason && entry.rejection.page === page)) {
      setState({ status: "ready", phase: "candidates", busy: false })
      mutationUnknown = false
    } else fail("stale")
  }
  const readScenarioTargets = async (candidate: Evidence) => {
    const api = client()
    if (!api || !validCurrency(candidate) ||
      !permitted("files.document-scenario-targets")) return
    const token = fence()
    setState({ selectedCandidateId: candidate.id, targets: [], selectedTarget: "",
      preview: undefined, status: "loading", busy: true })
    if (!permitted("files.document-open")) { fail("unavailable"); return }
    const opened = accept(token, unpack(await api["files.document-open"]({
      surface: state.surface, ref: documentInput(candidate.ref),
    }, { signal: token.signal })))
    if (!opened || !current(token)) return
    setState("opened", opened)
    const result = await api["files.document-scenario-targets"]({
      surface: state.surface, ref: documentInput(candidate.ref),
    }, { signal: token.signal })
    const targets = accept(token, unpack(result))
    if (!targets || !current(token)) return
    setState({ targets, selectedCandidateId: candidate.id,
      status: "ready", phase: "scenario", busy: false })
  }
  const scenario = async () => {
    const api = client()
    const candidate = selected()
    const target = /^\d+$/.test(state.selectedTarget) ? state.targets[Number(state.selectedTarget)] : undefined
    if (!api || !candidate || !validCurrency(candidate) || !target ||
      !permitted("files.document-scenario-preview") || state.busy) return
    const token = fence()
    setState({ status: "loading", phase: "scenario", preview: undefined, busy: true })
    const result = unpack(await api["files.document-scenario-preview"]({
      surface: state.surface, documentRef: documentInput(candidate.ref),
      baseRef: target.baseRef, targetRef: target.targetRef, period: documentInput(target.period),
    }, { signal: token.signal }))
    if (!current(token)) return
    if (result.kind === "failure") { fail(result.state, true); return }
    const preview = result.value
    if (preview.domainApplied !== false || preview.evidence.id !== candidate.id ||
      preview.evidence.ref.refId !== candidate.ref.refId ||
      preview.evidence.status !== "confirmed" ||
      preview.evidence.ref.target.revision !== candidate.ref.target.revision) {
      fail("stale")
      return
    }
    setState({ preview, phase: "preview", busy: false, status: "ready" })
  }
  const linkScenario = async () => {
    const api = client()
    const candidate = selected()
    const target = /^\d+$/.test(state.selectedTarget) ? state.targets[Number(state.selectedTarget)] : undefined
    const preview = state.preview
    if (!api || !candidate || !target || !preview || target.linkRef || !validCurrency(candidate) ||
        preview.domainApplied !== false || preview.evidence.id !== candidate.id ||
        preview.evidence.ref.refDigest !== candidate.ref.refDigest || state.busy ||
        state.phase !== "preview" || !permitted("files.document-confirm") ||
        !permitted("files.document-scenario-targets")) return
    const token = fence()
    setState({ busy: true, status: "loading" })
    const result = unpack(await api["files.document-confirm"]({
      surface: state.surface, action: "link", documentRef: documentInput(candidate.ref),
      baseRef: target.baseRef, targetRef: target.targetRef, period: documentInput(target.period),
    }, { signal: token.signal, idempotencyKey: crypto.randomUUID() }))
    if (!current(token)) return
    if (result.kind === "failure") { fail(result.state, true); return }
    if (!("kind" in result.value) || result.value.kind !== "scenario-link" ||
        result.value.domainApplied !== false || result.value.targetRef !== target.targetRef ||
        result.value.documentRef.refDigest !== candidate.ref.refDigest) {
      fail("outcome-unknown", true)
      return
    }
    const receipt = result.value
    const refreshed = unpack(await api["files.document-scenario-targets"]({
      surface: state.surface, ref: documentInput(candidate.ref),
    }, { signal: token.signal }))
    if (!current(token)) return
    if (refreshed.kind === "failure") { fail(refreshed.state); return }
    if (!refreshed.value.some((item) => item.linkRef === receipt.id &&
        item.baseRef === target.baseRef && item.targetRef === target.targetRef &&
        item.linkedAt === receipt.at)) { fail("stale"); return }
    mutationUnknown = false
    setState({ targets: refreshed.value, linkedRef: receipt.id, phase: "preview",
      status: "ready", busy: false })
  }
  const safeHref = () => {
    const href = state.opened?.href
    if (!href) return undefined
    try {
      const url = new URL(href, window.location.origin)
      return url.origin === window.location.origin && ["http:", "https:"].includes(url.protocol)
        ? url.href : undefined
    } catch { return undefined }
  }
  const refresh = () => {
    mutationUnknown = false
    setState({ uploadRecord: "", uploadReadRevision: state.uploadReadRevision + 1 })
    if (props.surfaceId === "UI58" && props.route.kind !== "detail") void loadCatalog()
    else void loadRouteCandidates()
  }
  createEffect(() => {
    const ready = auth.ready()
    const selectedOwner = ownerStamp()
    const routeKind = props.route.kind
    const section = props.surfaceId
    const authStatus = auth.state().status
    const scope = JSON.stringify([routeKind, section, props.route.href, selectedOwner, authStatus, !!ready])
    // A same-owner context publication must not erase a document read or confirmation.
    // Actual route, authority and session transitions still abort and clear all private state.
    if (scope === installedScope) return
    installedScope = scope
    untrack(() => {
      fence()
      mutationUnknown = false
      uploadFile = undefined
      setState({
        uploadName: "", uploadNotice: "", uploadKind: state.surface === "dashboard" ? "contract" : "quote",
        uploadRecord: "", uploadTargets: [], uploadReadState: "loading", uploadOpened: routeKind === "new",
        uploadExpanded: routeKind === "new", uploadConflictRecord: "",
        rejectionReason: "", rejectionPage: "1", linkedRef: "",
        status: ready ? "ready" : authStatus === "resolving" ? "loading" :
          authStatus === "unauthenticated" ? "session-expired" :
          authStatus === "denied" ? "denied" : "unavailable",
        requests: [], sources: [], documentRef: "", candidates: [], selectedCandidateId: "",
        opened: undefined, targets: [], selectedTarget: "", preview: undefined, matches: undefined,
        requestSelectionRef: "", sourceSelectionRef: "", phase: "catalog", busy: false,
      })
      if (!ready || !selectedOwner) return
      if (section === "UI58" && routeKind !== "detail") void loadCatalog()
      else void loadRouteCandidates()
    })
  })
  createEffect(on(() => [ownerStamp(), state.surface, state.uploadKind, state.uploadReadRevision, state.uploadOpened, props.surfaceId, props.route.href], () => {
    const ready = auth.ready(), stamp = ownerStamp(), kind = state.uploadKind, surface = state.surface
    setState({ uploadRecord: "", uploadTargets: [], uploadReadState: "loading" })
    if (!ready || !stamp || !state.uploadOpened || props.surfaceId !== "UI58" || props.route.kind === "detail") return
    if ((surface === "dashboard" ? kind !== "contract" : surface !== "procurement" || kind === "contract") ||
        !permitted(sfUploadTargetOperation(kind))) { setState("uploadReadState", "unavailable"); return }
    const reading = new AbortController()
    onCleanup(() => reading.abort())
    const current = () => !reading.signal.aborted && ownerStamp() === stamp && state.surface === surface && state.uploadKind === kind
    void readSfUploadTargets(ready.transport, kind, documentInput(ready.context.stamp), reading.signal)
      .then((result) => {
        if (!current()) return
        if (result.kind !== "ready") {
          console.error("Document upload record catalog unavailable", result.kind)
          setState("uploadReadState", result.kind)
          return
        }
        setState({ uploadTargets: [...result.targets], uploadReadState: "ready" })
      })
      .catch((error: unknown) => {
        if (!current()) return
        console.error("Document upload record catalog read failed", error instanceof Error ? error.name : "unknown")
        setState("uploadReadState", "unavailable")
      })
  }))
  onCleanup(() => { fence(); clearSelection() })

  const title = () => "sf." + props.surfaceId.toLowerCase() + ".title"
  const message = () =>
    state.status === "loading" ? "sf.common.loading" :
    state.status === "denied" ? "sf.common.noAccess" :
    state.status === "session-expired" ? "sf.common.loginAgain" :
    state.status === "stale" || state.status === "conflict" ? "sf.common.stale" :
    state.status === "empty" ? "sf.common.empty" :
    state.status === "filtered-empty" ? "sf.common.filterEmpty" :
    state.status === "invalid" ? "sf.common.invalidLink" :
    state.status === "not-found" ? "sf.common.removed" :
    state.status === "outcome-unknown" ? "sf.common.operationUnknown" :
    "sf.common.unavailable"
  const catalog = () => props.surfaceId === "UI58"
  const evidence = () => props.surfaceId === "UI59"
  const scenarioView = () => props.surfaceId === "UI60"
  const showCandidates = () => evidence() || scenarioView() || (catalog() && props.route.kind === "detail")
  const documentHref = (destination: "evidence" | "scenario") => {
    if (state.status !== "ready" || state.busy || !state.documentRef || !permitted("files.document-candidates")) return
    const currentOwner = auth.state()
    if (currentOwner.status !== "ready" || !auth.ready()) return
    const selected = sfReadyOwnerSelection(currentOwner), requested = props.route.ownerSelection
    if (!selected?.serverKey || !selected.projectId || !selected.installationId ||
      selected.serverKey !== requested.serverKey || selected.projectId !== requested.projectId ||
      selected.installationId !== requested.installationId) return
    return `/orchestra/sf-documents/${encodeSfRouteRef(state.documentRef)}/${destination}?` + new URLSearchParams({
      server: selected.serverKey, project: selected.projectId, installation: selected.installationId,
    })
  }
  const preview = () => state.preview
  const canSelect = (item: Evidence) => item.ref.target.documentId === state.documentRef && !state.busy
  return (
    <SfPageFrame titleKey={key(title())}
      subtitleKey={key(evidence() ? "sf.u24.evidenceSubtitle" : scenarioView() ? "sf.u24.scenarioSubtitle" : "sf.u24.documentsSubtitle")}
      context={[]} tabs={[]} activeTab={null}
      secondaryActions={[]} density="comfortable" layout="work" onLayoutMode={() => undefined}>
      <section class="sf-files sf-records-documents" data-sf-records="six" data-sf-wave="six" data-sf-leaf="u24" data-sf-surface={props.surfaceId}
        data-sf-phase={state.phase} data-sf-read-state={state.status}>
        <Show when={auth.ready() && (!catalog() || props.route.kind === "detail")}>
          <div class="sf-files-fields">
            <label>{t("sf.u24.source")}
              <select value={state.surface} disabled={state.busy || state.phase === "unknown"}
                onChange={(e) => { fence(); clearSelection(); setState("surface", e.currentTarget.value as FileSurface); void loadRouteCandidates() }}>
                <option value="procurement">{t("sf.u24.sourceProcurement")}</option><option value="dashboard">{t("sf.u24.sourceDashboard")}</option>
              </select>
            </label>
            <button type="button" class="mx-btn" disabled={state.busy}
              onClick={refresh}>{t("sf.u24.reconcile")}</button>
          </div>
        </Show>
        <SfStatePanel state={state.status} messageKey={key(message())} onRetryRead={refresh}>
          <Show when={catalog() && props.route.kind !== "detail"}>
            <details class="sf-records-register" open={state.uploadExpanded}
              onToggle={(event) => {
                setState("uploadExpanded", event.currentTarget.open)
                if (event.currentTarget.open) setState("uploadOpened", true)
              }}>
              <summary>{t("sf.ui58.primary")}</summary>
            <form class="sf-files-fields" data-sf-document-upload="authorized-asset" aria-busy={state.busy}
              onSubmit={(event) => { event.preventDefault(); void upload() }}>
              <h2>{t("sf.u24.uploadTitle")}</h2>
              <p>{t("sf.u24.uploadHelp")}</p>
              <Show when={state.uploadConflictRecord}>
                <p role="alert">{language.t("sf.u24.uploadConflict", { record: state.uploadConflictRecord })}</p>
              </Show>
              <label>{t("sf.u24.uploadKind")}
                <select value={state.uploadKind} disabled={state.busy}
                  onChange={(event) => setState({ uploadKind: event.currentTarget.value === "contract" ? "contract" :
                    event.currentTarget.value === "supplier" ? "supplier" :
                    event.currentTarget.value === "signed-po" ? "signed-po" : "quote", uploadConflictRecord: "", uploadNotice: "" })}>
                  <Show when={state.surface === "dashboard"}>
                    <option value="contract">{t("sf.u24.uploadContract")}</option>
                  </Show>
                  <Show when={state.surface === "procurement"}>
                    <option value="quote">{t("sf.u24.uploadQuote")}</option>
                    <option value="signed-po">{t("sf.u24.uploadSignedPo")}</option>
                    <option value="supplier">{t("sf.u24.uploadSupplier")}</option>
                  </Show>
                </select>
              </label>
              <div class="sf-records-upload-targets" data-sf-upload-target-state={state.uploadReadState}>
                <label>{t("sf.u24.uploadTarget")}
                  <select value={state.uploadRecord} required disabled={state.busy || state.uploadReadState !== "ready" || !state.uploadTargets.length}
                    aria-describedby={state.uploadReadState !== "ready" || !state.uploadTargets.length ? uploadHelpId : undefined}
                    onChange={(event) => setState({ uploadRecord: state.uploadTargets.some((target) => target.record === event.currentTarget.value)
                      ? event.currentTarget.value : "", uploadConflictRecord: "", uploadNotice: "" })}>
                    <option value="">{t("sf.u24.uploadChoose")}</option>
                    <For each={state.uploadTargets}>{(target) => <option value={target.record}>{target.label}</option>}</For>
                  </select>
                </label>
                <button type="button" class="mx-btn" disabled={state.busy || state.uploadReadState === "loading"}
                  onClick={() => setState({ uploadRecord: "", uploadReadRevision: state.uploadReadRevision + 1 })}>
                  {t("sf.u24.uploadRefresh")}
                </button>
                <Show when={state.uploadReadState !== "ready" || !state.uploadTargets.length}>
                  <p id={uploadHelpId} role={state.uploadReadState === "loading" || state.uploadReadState === "ready" ? "status" : "alert"}>
                    {t(state.uploadReadState === "loading" ? "sf.u24.uploadLoading" :
                      state.uploadReadState === "ready" ? "sf.u24.uploadEmpty" :
                      state.uploadReadState === "denied" ? "sf.common.noAccess" :
                      state.uploadReadState === "session-expired" ? "sf.common.loginAgain" : "sf.u24.uploadUnavailable")}
                  </p>
                </Show>
              </div>
              <label>{t("sf.u24.uploadFile")}
                <input type="file" accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  required disabled={state.busy} onChange={(event) => {
                    uploadFile = event.currentTarget.files?.[0]
                    setState({ uploadName: uploadFile?.name ?? "", uploadNotice: "" })
                  }} />
              </label>
              <button type="submit" class="mx-btn primary" disabled={state.busy ||
                !state.uploadName || state.uploadReadState !== "ready" || !uploadTarget() ||
                !permitted("files.asset.upload")}>{t("sf.u24.uploadSubmit")}</button>
              <Show when={state.uploadNotice}><p role="status" data-sf-upload-outcome>{t(state.uploadNotice)}</p></Show>
            </form>
            </details>
            <div class="sf-files-fields sf-records-source-picker">
              <header class="sf-records-heading">
                <h2>{t("sf.u24.browseDocuments")}</h2>
                <p>{t("sf.u24.browseHelp")}</p>
              </header>
              <label>{t("sf.u24.source")}
                <select value={state.surface} disabled={state.busy}
                  onChange={(e) => { clearOnSourceChange(); uploadFile = undefined; setState({ surface: e.currentTarget.value as FileSurface,
                  uploadKind: e.currentTarget.value === "dashboard" ? "contract" : "quote", uploadName: "",
                  uploadConflictRecord: "", uploadNotice: "" }); void loadCatalog() }}>
                  <option value="procurement">{t("sf.u24.sourceProcurement")}</option><option value="dashboard">{t("sf.u24.sourceDashboard")}</option>
                </select>
              </label>
              <label>{t("sf.u24.request")}
                <select value={state.requestSelectionRef} disabled={state.busy}
                  onChange={(e) => { clearOnSourceChange(); setState("requestSelectionRef", e.currentTarget.value); void loadSources() }}>
                  <option value="">{t("sf.u24.allAttachments")}</option>
                  <For each={state.requests}>{(request) =>
                    <option value={request.selectionRef}>{request.label}</option>}</For>
                </select>
              </label>
              <button type="button" class="mx-btn" disabled={state.busy}
                onClick={() => { void loadSources() }}>{t("sf.u24.refresh")}</button>
              <label class="sf-records-document-choice">{t("sf.u24.document")}
                <select value={state.sourceSelectionRef} disabled={state.busy || !state.sources.length}
                  onChange={(e) => { clearOnSourceChange(); setState("sourceSelectionRef", e.currentTarget.value) }}>
                  <option value="">{t("sf.u24.chooseDocument")}</option>
                  <For each={state.sources}>{(source) =>
                    <option value={source.selectionRef}>{source.label}</option>}</For>
                </select>
              </label>
              <button type="button" class="mx-btn primary"
                disabled={!state.sourceSelectionRef || state.busy || !permitted("files.document-admit")} onClick={() => { void admit() }}>
                {t("sf.u24.openDocument")}
              </button>
            </div>
            <form class="sf-files-fields sf-records-search" onSubmit={(e) => { e.preventDefault(); void search() }}>
              <h2>{t("sf.u24.search")}</h2>
              <label>{t("sf.u24.query")}
                <input type="search" maxlength="256" value={state.search}
                  onInput={(e) => setState("search", e.currentTarget.value)} />
              </label>
              <button type="submit" class="mx-btn" disabled={!state.search.trim() || state.busy}>
                {t("sf.u24.searchButton")}
              </button>
              <Show when={state.matches}>
                {(matches) => <section class="sf-files-section">
                  <For each={matches().matches}>{(match) =>
                    <article class="mx-card sf-records-match">
                      <blockquote>{match.text}</blockquote>
                      <details class="sf-records-technical">
                        <summary>{t("sf.u24.sourceDetails")}</summary>
                        <p>{t("sf.u24.score")}: {match.lexicalScore}</p>
                        <p><code>{match.documentRef.refId}</code></p>
                      </details>
                      <button type="button" class="mx-btn" disabled={state.busy}
                        onClick={() => { void openSearchSource(match.documentRef) }}>
                        {t("sf.u24.openOriginal")}
                      </button>
                    </article>}</For>
                  <For each={matches().limitations}>{(item) => <p role="status">{item}</p>}</For>
                  <Show when={matches().matches.length === 0}><p>{t("sf.u24.noMatches")}</p></Show>
                  <Show when={state.opened && !state.selectedCandidateId}>
                    <section class="sf-files-section" data-sf-search-source="authorized">
                      <h3>{state.opened!.title}</h3>
                      <p>{state.opened!.location}</p>
                      <blockquote>{state.opened!.excerpt}</blockquote>
                      <Show when={safeHref()}>{(href) =>
                        <a href={href()} rel="noopener noreferrer">{t("sf.u24.openOriginal")}</a>}</Show>
                    </section>
                  </Show>
                </section>}</Show>
            </form>
          </Show>
          <Show when={showCandidates() || (catalog() && state.documentRef)}>
            <section class="sf-files-section">
              <h2>{t("sf.u24.candidates")}</h2>
              <Show when={catalog() ? documentHref("evidence") : undefined}>
                {(href) => <A class="mx-btn" href={href()}>{t("sf.ui59.title")}</A>}
              </Show>
              <Show when={!state.candidates.length}><p>{t("sf.u24.noCandidates")}</p></Show>
              <ul class="sf-files-candidates">
                <For each={state.candidates}>{(candidate) =>
                  <li class="mx-card" data-sf-evidence-state={candidate.status} data-sf-evidence-id={candidate.id}
                    data-sf-evidence-selected={state.selectedCandidateId === candidate.id}>
                    <button type="button" class="mx-btn sf-records-candidate"
                      aria-pressed={state.selectedCandidateId === candidate.id}
                      disabled={!canSelect(candidate)}
                      onClick={() => { void openEvidence(candidate) }}>
                      <span class="sf-records-candidate-value">
                        {candidate.fieldCandidate}: {candidate.value === null ? "null" : String(candidate.value)}
                        {" "}{candidate.unit ?? ""}
                      </span>
                      <span class="sf-records-candidate-meta">
                        {t("sf.u24.state." + candidate.status)} · {t("sf.u24.documentVersion")} {candidate.version}
                      </span>
                    </button>
                    <Show when={candidate.status === "rejected" && candidate.rejection}>
                      <p role="status" data-sf-rejection="persisted">
                        {t("sf.u24.rejectPageNotice")} {candidate.rejection?.page}: {candidate.rejection?.reason}
                      </p>
                    </Show>
                    <Show when={evidence() && candidate.status === "extracted"}>
                      <button type="button" class="mx-btn" disabled={state.busy || !canSelect(candidate) || state.selectedCandidateId !== candidate.id || !state.opened}
                        onClick={() => {
                          setState({ selectedCandidateId: candidate.id, phase: "confirm-review", preview: undefined })
                        }}>{t("sf.ui59.primary")}</button>
                    </Show>
                    <Show when={scenarioView() && validCurrency(candidate)}>
                      <button type="button" class="mx-btn"
                        disabled={state.busy || !permitted("files.document-scenario-targets")}
                        onClick={() => { void readScenarioTargets(candidate) }}>{t("sf.u24.useScenario")}</button>
                    </Show>
                    <Show when={evidence() && validCurrency(candidate) ? documentHref("scenario") : undefined}>
                      {(href) => <A class="mx-btn" href={href()}>{t("sf.u24.useScenario")}</A>}
                    </Show>
                  </li>
                }</For>
              </ul>
            </section>
            <Show when={state.opened && selected()}>
              <section class="sf-files-section" aria-label={t("sf.u24.sourceText")}>
                <h2>{state.opened!.title}</h2>
                <p>{state.opened!.location}</p>
                <blockquote>{state.opened!.excerpt}</blockquote>
                <Show when={safeHref()}>{(href) =>
                  <a href={href()} rel="noopener noreferrer">{t("sf.u24.openOriginal")}</a>}</Show>
              </section>
            </Show>
          </Show>
          <Show when={evidence() || (catalog() && state.documentRef)}>
            <Show when={evidence() && selected()?.status === "extracted" && state.phase === "confirm-review"}>
              <section class="sf-files-section sf-records-evidence-review" data-sf-confirmation="review">
                <h2>{t("sf.ui59.title")}</h2>
                <p>{selected()!.fieldCandidate}: {selected()!.value === null ? "null" : String(selected()!.value)}
                  {" "}{selected()!.unit ?? ""}</p>
                <p>{t("sf.u24.documentVersion")}: {selected()!.ref.target.revision} · {selected()!.location}</p>
                <Show when={state.opened}><blockquote>{state.opened!.excerpt}</blockquote></Show>
                <div class="sf-files-actions">
                <button type="button" class="mx-btn" disabled={state.busy}
                  onClick={() => { setState("phase", "candidates") }}>{t("sf.common.keepEditing")}</button>
                <button type="button" class="mx-btn primary" disabled={state.busy || !permitted("files.document-confirm")}
                  onClick={() => { void confirm() }}>{t("sf.u24.confirmField")}</button>
                </div>
                <details class="sf-records-reject">
                  <summary>{t("sf.u24.rejectCandidate")}</summary>
                  <div class="sf-records-reject-fields">
                <label>{t("sf.u24.rejectReason")}
                  <textarea maxlength="500" rows="3" value={state.rejectionReason} disabled={state.busy}
                    onInput={(event) => setState("rejectionReason", event.currentTarget.value)} />
                </label>
                <label>{t("sf.u24.rejectPage")}
                  <input type="number" min="1" max="500" step="1" value={state.rejectionPage}
                    disabled={state.busy}
                    onInput={(event) => setState("rejectionPage", event.currentTarget.value)} />
                </label>
                <button type="button" class="mx-btn" disabled={state.busy ||
                  state.rejectionReason.trim().length < 5 || state.rejectionReason.trim().length > 500 ||
                  !/^[1-9]\d*$/.test(state.rejectionPage) || Number(state.rejectionPage) > 500}
                  onClick={() => { void reject() }}>{t("sf.u24.rejectSubmit")}</button>
                  </div>
                </details>
              </section>
            </Show>
            <details class="sf-records-extraction" open={!evidence() || !state.candidates.length}>
              <summary>{t("sf.u24.fields")}</summary>
            <form class="sf-files-fields" onSubmit={(e) => { e.preventDefault(); void extractField() }}>
              <p>{t("sf.u24.fieldHelp")}</p>
              <label>{t("sf.u24.field")}
                <input maxlength="120" required value={state.fieldId} disabled={state.busy}
                  onInput={(e) => setState("fieldId", e.currentTarget.value)} />
              </label>
              <label>{t("sf.u24.type")}
                <select value={state.fieldType} disabled={state.busy}
                  onChange={(e) => setState("fieldType", e.currentTarget.value as LeafState["fieldType"])}>
                  <option value="string">{t("sf.u24.text")}</option>
                  <option value="number">{t("sf.u24.number")}</option>
                  <option value="boolean">{t("sf.u24.boolean")}</option>
                  <option value="date">{t("sf.u24.date")}</option>
                </select>
              </label>
              <label>{t("sf.u24.unit")}
                <input maxlength="40" value={state.fieldUnit} disabled={state.busy}
                  onInput={(e) => setState("fieldUnit", e.currentTarget.value)} />
              </label>
              <button type="submit" class="mx-btn primary"
                disabled={!state.documentRef || !state.fieldId.trim() || state.busy ||
                  state.phase === "unknown" || !permitted("files.document-schema") ||
                  !permitted("files.document-extract")}>{t("sf.u24.extract")}</button>
            </form>
            </details>
          </Show>
          <Show when={scenarioView()}>
            <section class="sf-files-section sf-records-scenario">
              <header class="sf-records-heading">
                <h2>{t("sf.u24.scenarioDestination")}</h2>
                <p>{t("sf.u24.scenarioInfo")}</p>
              </header>
              <Show when={selected() && validCurrency(selected()!)}>
                <p>{selected()!.fieldCandidate}: {selected()!.value} · {selected()!.unit} ·
                  {selected()!.ref.refId}</p>
              </Show>
              <button type="button" class="mx-btn" disabled={state.busy || !selected() || !validCurrency(selected()!) ||
                !permitted("files.document-scenario-targets")}
                onClick={() => { const value = selected(); if (value) void readScenarioTargets(value) }}>
                {t("sf.u24.refreshDestinations")}
              </button>
              <label>{t("sf.u24.scenarioDestination")}
                <select value={state.selectedTarget} disabled={state.busy || !state.targets.length}
                  onChange={(e) => { setState({ selectedTarget: e.currentTarget.value, preview: undefined, phase: "scenario" }) }}>
                  <option value="">{t("sf.u24.scenarioDestination")}</option>
                  <For each={state.targets}>{(target, index) =>
                    <option value={String(index())}>{target.label}{target.linkRef ? " " + t("sf.u24.scenarioLinkLabel") : ""}</option>}</For>
                </select>
              </label>
              <Show when={!permitted("files.document-scenario-targets") || !permitted("files.document-scenario-preview")}
                fallback={<Show when={!state.targets.length}><p role="status">{t("sf.u24.noTargets")}</p></Show>}>
                <p role="status">{t("sf.u24.scenarioUnavailable")}</p>
              </Show>
              <button type="button" class="mx-btn primary" disabled={!state.selectedTarget || state.busy ||
                !permitted("files.document-scenario-preview")}
                onClick={() => { void scenario() }}>{t("sf.u24.previewScenario")}</button>
            </section>
            <Show when={preview()}>
              {(value) => <section class="sf-files-section" data-sf-scenario="preview">
                <h2>{t("sf.u24.scenarioResult")}</h2>
                <p>{value().evidence.ref.refId} · {value().evidence.fieldCandidate}:
                  {value().evidence.value === null ? "null" : String(value().evidence.value)}
                  {" "}{value().evidence.unit ?? ""}</p>
                <dl>
                  <dt>{t("sf.u24.label.currency")}</dt><dd>{showScenarioValue(value().scenario, "currency") ?? t("sf.common.unknown")}</dd>
                  <dt>{t("sf.u24.label.knownSubtotal")}</dt><dd>{showScenarioValue(value().scenario, "knownSubtotal") ?? t("sf.common.unknown")}</dd>
                  <dt>{t("sf.u24.label.total")}</dt><dd>{showScenarioValue(value().scenario, "total") ?? t("sf.common.unknown")}</dd>
                </dl>
                <p role="status">{t("sf.u24.scenarioReady")}</p>
                <p>{t("sf.u24.scenarioLinkHelp")}</p>
                <Show when={/^\d+$/.test(state.selectedTarget) && state.targets[Number(state.selectedTarget)]?.linkRef}>
                  <p role="status" data-sf-scenario-link="persisted">
                    {t("sf.u24.scenarioLinked")} {state.targets[Number(state.selectedTarget)]?.linkRef}
                  </p>
                </Show>
                <button type="button" class="mx-btn primary" data-sf-scenario-link-action
                  disabled={state.busy || !permitted("files.document-confirm") ||
                    !/^\d+$/.test(state.selectedTarget) ||
                    !!state.targets[Number(state.selectedTarget)]?.linkRef ||
                    !canLinkCurrency()}
                  onClick={() => { void linkScenario() }}>{t("sf.u24.scenarioLinkSubmit")}</button>
              </section>}</Show>
          </Show>
        </SfStatePanel>
        <Show when={state.status === "unavailable" || state.status === "outcome-unknown" || state.status === "stale"}>
          <Show when={state.phase === "unknown"}>
            <button type="button" class="mx-btn" disabled={state.busy}
              onClick={refresh}>{t("sf.u24.reconcile")}</button>
          </Show>
        </Show>
      </section>
    </SfPageFrame>
  )
}
