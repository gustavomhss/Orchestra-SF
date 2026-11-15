import { For, Show, createEffect, onCleanup, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { createSfFilesClient } from "@orchestra/client/sucafina/files"
import type { SfFilesOperationOutput } from "@orchestra/schema/sucafina/files"
import type { SfTransportResult } from "@orchestra/schema/sucafina/common"
import type { SfSurfaceProps } from "../context/contracts"
import { useSfContext } from "../context"
import { SfPageFrame } from "../shared/frame"
import type { SfCopyKey, SfUiState } from "../shared/frame"
import { SfStatePanel } from "../shared/states"
import "./documents.css"

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

// Documents are producer-owned; this leaf uses only A06's closed operations.
// A candidate never becomes confirmed because of UI selection or extraction.
export function SfDocumentsView(props: SfSurfaceProps<"UI58" | "UI59" | "UI60">): JSX.Element {
  const auth = useSfContext()
  const language = useLanguage()
  const key = (value: string): SfCopyKey => value as SfCopyKey
  const t = (value: string) => language.t(value as Parameters<typeof language.t>[0])
  const [state, setState] = createStore<LeafState>({
    status: "loading", busy: false, phase: "catalog", surface: "procurement",
    requests: [], sources: [], requestSelectionRef: "", sourceSelectionRef: "",
    documentRef: "", candidates: [], selectedCandidateId: "", opened: undefined,
    fieldId: "", fieldType: "number", fieldUnit: "", search: "", matches: undefined,
    targets: [], selectedTarget: "", preview: undefined, error: undefined,
  })
  let generation = 0
  let controller = new AbortController()
  let mutationUnknown = false
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
  const client = () => {
    const ready = auth.ready()
    return ready ? createSfFilesClient(ready.transport) : undefined
  }
  const permitted = (operationId: string) => {
    const ready = auth.ready()
    const resource = ready?.context.availability.find((entry) =>
      entry.family === "files" && entry.operations.some((op) => op.operationId === operationId))
    return resource?.operations.some((op) => op.operationId === operationId && op.state === "ready") ?? false
  }
  const fail = (reason: SfUiState, mutation = false) => {
    if (reason === "denied" || reason === "session-expired") {
      setState({ candidates: [], sources: [], requests: [], matches: undefined, opened: undefined,
        targets: [], preview: undefined, documentRef: "", selectedCandidateId: "" })
    }
    if (reason === "stale" || reason === "conflict") {
      setState({ selectedCandidateId: "", opened: undefined, targets: [], preview: undefined, phase: "catalog" })
    }
    mutationUnknown = mutation && (reason === "outcome-unknown" || reason === "unavailable")
    setState({ status: mutationUnknown ? "outcome-unknown" : reason, error: reason, busy: false,
      phase: mutationUnknown ? "unknown" : state.phase })
  }
  const accept = <Value,>(token: ReturnType<typeof fence>, result: Result<Value>): Value | undefined => {
    if (!current(token)) return undefined
    if (result.kind === "failure") { fail(result.state); return undefined }
    return result.value
  }
  const clearSelection = () => {
    mutationUnknown = false
    setState({ candidates: [], selectedCandidateId: "", opened: undefined,
      targets: [], selectedTarget: "", preview: undefined, matches: undefined, phase: "catalog" })
  }
  const clearOnSourceChange = () => {
    fence()
    clearSelection()
    setState({ documentRef: "", status: "ready" })
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
    setState({ sources: value, busy: false, status: value.length ? "ready" : "empty" })
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
    setState({ sources, status: sources.length ? "ready" : "empty", busy: false })
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
    setState({ candidates, status: candidates.length ? "ready" : "empty", busy: false,
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
  const search = async () => {
    const api = client()
    if (!api || !state.search.trim() || !permitted("files.document-search")) return
    const token = fence()
    setState({ busy: true, status: "loading", matches: undefined })
    const result = await api["files.document-search"]({
      surface: state.surface, query: state.search.trim(), limit: 20,
      ...(state.documentRef ? { documentRefs: [state.documentRef] } : {}),
    }, { signal: token.signal, idempotencyKey: crypto.randomUUID() })
    const matches = accept(token, unpack(result))
    if (!matches || !current(token)) return
    setState({ matches, status: matches.matches.length ? "ready" : "filtered-empty", busy: false })
  }
  const selected = () => state.candidates.find((item) => item.id === state.selectedCandidateId)
  const openSearchSource = async (ref: Matches["matches"][number]["documentRef"]) => {
    const api = client()
    if (!api || !permitted("files.document-open")) { setState("status", "unavailable"); return }
    const token = fence()
    setState({ selectedCandidateId: "", opened: undefined, status: "loading", busy: true })
    const result = await api["files.document-open"]({ surface: state.surface, ref }, { signal: token.signal })
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
    const result = await api["files.document-open"]({ surface: state.surface, ref: candidate.ref }, { signal: token.signal })
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
      surface: state.surface, evidence: candidate,
    }, { signal: token.signal, idempotencyKey: crypto.randomUUID() }))
    if (!current(token)) return
    if (result.kind === "failure") { fail(result.state, true); return }
    if (result.value.status !== "confirmed" || result.value.id !== candidate.id ||
      result.value.ref.target.documentId !== candidate.ref.target.documentId) {
      fail("outcome-unknown", true)
      return
    }
    const fresh = await readCandidates(state.documentRef, token)
    if (!current(token)) return
    if (fresh?.some((entry) => entry.id === result.value.id &&
      entry.status === "confirmed" && entry.version === result.value.version)) {
      setState({ phase: "confirmed", status: "ready" })
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
      surface: state.surface, ref: candidate.ref,
    }, { signal: token.signal })))
    if (!opened || !current(token)) return
    setState("opened", opened)
    const result = await api["files.document-scenario-targets"]({
      surface: state.surface, ref: candidate.ref,
    }, { signal: token.signal })
    const targets = accept(token, unpack(result))
    if (!targets || !current(token)) return
    setState({ targets, selectedCandidateId: candidate.id,
      status: targets.length ? "ready" : "empty", phase: "scenario", busy: false })
  }
  const scenario = async () => {
    const api = client()
    const candidate = selected()
    const target = state.targets.find((item) => item.targetRef === state.selectedTarget)
    if (!api || !candidate || !validCurrency(candidate) || !target ||
      !permitted("files.document-scenario-preview") || state.busy) return
    const token = fence()
    setState({ status: "loading", phase: "scenario", preview: undefined, busy: true })
    const result = unpack(await api["files.document-scenario-preview"]({
      surface: state.surface, documentRef: candidate.ref,
      baseRef: target.baseRef, targetRef: target.targetRef, period: target.period,
    }, { signal: token.signal, idempotencyKey: crypto.randomUUID() }))
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
    if (props.surfaceId === "UI58" && props.route.kind !== "detail") void loadCatalog()
    else void loadRouteCandidates()
  }
  createEffect(() => {
    const ready = auth.ready()
    const selectedOwner = ownerStamp()
    const routeKind = props.route.kind
    const section = props.surfaceId
    fence()
    mutationUnknown = false
    setState({
      status: ready ? "ready" : auth.state().status === "resolving" ? "loading" :
        auth.state().status === "unauthenticated" ? "session-expired" :
        auth.state().status === "denied" ? "denied" : "unavailable",
      requests: [], sources: [], documentRef: "", candidates: [], selectedCandidateId: "",
      opened: undefined, targets: [], selectedTarget: "", preview: undefined, matches: undefined,
      requestSelectionRef: "", sourceSelectionRef: "", phase: "catalog", busy: false,
    })
    if (!ready || !selectedOwner) return
    if (section === "UI58" && routeKind !== "detail") void loadCatalog()
    else void loadRouteCandidates()
  })
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
  const preview = () => state.preview
  const canSelect = (item: Evidence) => item.ref.target.documentId === state.documentRef && !state.busy
  return (
    <SfPageFrame titleKey={key(title())} context={[]} tabs={[]} activeTab={null}
      secondaryActions={[]} density="comfortable" layout="work" onLayoutMode={() => undefined}>
      <section class="sf-files" data-sf-leaf="u24" data-sf-surface={props.surfaceId}
        data-sf-phase={state.phase} data-sf-read-state={state.status}>
        <SfStatePanel state={state.status} messageKey={key(message())} onRetryRead={refresh}>
          <Show when={!catalog() || props.route.kind === "detail"}>
            <div class="sf-files-fields">
              <label>{t("sf.u24.source")}
                <select value={state.surface} disabled={state.busy}
                  onChange={(e) => { fence(); clearSelection(); setState("surface", e.currentTarget.value as FileSurface); void loadRouteCandidates() }}>
                  <option value="procurement">Procurement</option><option value="dashboard">Dashboard</option>
                </select>
              </label>
              <button type="button" class="mx-btn" disabled={state.busy}
                onClick={refresh}>{t("sf.u24.reconcile")}</button>
            </div>
          </Show>
          <Show when={catalog() && props.route.kind !== "detail"}>
            <div class="sf-files-fields">
              <label>{t("sf.u24.source")}
                <select value={state.surface} disabled={state.busy}
                  onChange={(e) => { clearOnSourceChange(); setState("surface", e.currentTarget.value as FileSurface); void loadCatalog() }}>
                  <option value="procurement">Procurement</option><option value="dashboard">Dashboard</option>
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
              <label>{t("sf.u24.document")}
                <select value={state.sourceSelectionRef} disabled={state.busy || !state.sources.length}
                  onChange={(e) => { clearOnSourceChange(); setState("sourceSelectionRef", e.currentTarget.value) }}>
                  <option value="">{t("sf.u24.chooseDocument")}</option>
                  <For each={state.sources}>{(source) =>
                    <option value={source.selectionRef}>{source.label}</option>}</For>
                </select>
              </label>
              <button type="button" class="mx-btn primary"
                disabled={!state.sourceSelectionRef || state.busy} onClick={() => { void admit() }}>
                {t("sf.u24.openDocument")}
              </button>
            </div>
            <form class="sf-files-fields" onSubmit={(e) => { e.preventDefault(); void search() }}>
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
                    <article class="mx-card">
                      <p>{match.text}</p>
                      <p>{t("sf.u24.score")}: {match.lexicalScore}</p>
                      <p>{match.documentRef.refId}</p>
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
              <Show when={!state.candidates.length}><p>{t("sf.u24.noCandidates")}</p></Show>
              <ul class="sf-files-candidates">
                <For each={state.candidates}>{(candidate) =>
                  <li class="mx-card" data-sf-evidence-state={candidate.status} data-sf-evidence-id={candidate.id}>
                    <button type="button" class="mx-btn"
                      aria-pressed={state.selectedCandidateId === candidate.id}
                      disabled={!canSelect(candidate)}
                      onClick={() => { void openEvidence(candidate) }}>
                      {candidate.fieldCandidate}: {candidate.value === null ? "null" : String(candidate.value)}
                      {" "}{candidate.unit ?? ""} · {candidate.status} · {candidate.version}
                    </button>
                    <Show when={evidence() && candidate.status === "extracted"}>
                      <button type="button" class="mx-btn" disabled={state.busy || !canSelect(candidate) || state.selectedCandidateId !== candidate.id || !state.opened}
                        onClick={() => {
                          setState({ selectedCandidateId: candidate.id, phase: "confirm-review", preview: undefined })
                        }}>{t("sf.ui59.primary")}</button>
                    </Show>
                    <Show when={scenarioView() && validCurrency(candidate)}>
                      <button type="button" class="mx-btn" disabled={state.busy}
                        onClick={() => { void readScenarioTargets(candidate) }}>{t("sf.u24.useScenario")}</button>
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
            <form class="sf-files-fields" onSubmit={(e) => { e.preventDefault(); void extractField() }}>
              <h2>{t("sf.u24.fields")}</h2>
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
                  state.phase === "unknown"}>{t("sf.u24.extract")}</button>
            </form>
            <Show when={evidence() && selected()?.status === "extracted" && state.phase === "confirm-review"}>
              <section class="sf-files-section" data-sf-confirmation="review">
                <h2>{t("sf.ui59.title")}</h2>
                <p>{selected()!.fieldCandidate}: {selected()!.value === null ? "null" : String(selected()!.value)}
                  {" "}{selected()!.unit ?? ""}</p>
                <p>{t("sf.u24.documentVersion")}: {selected()!.ref.target.revision} · {selected()!.location}</p>
                <Show when={state.opened}><blockquote>{state.opened!.excerpt}</blockquote></Show>
                <button type="button" class="mx-btn" disabled={state.busy}
                  onClick={() => { setState("phase", "candidates") }}>{t("sf.common.keepEditing")}</button>
                <button type="button" class="mx-btn primary" disabled={state.busy}
                  onClick={() => { void confirm() }}>{t("sf.u24.confirmField")}</button>
              </section>
            </Show>
          </Show>
          <Show when={scenarioView()}>
            <section class="sf-files-section">
              <p>{t("sf.u24.scenarioInfo")}</p>
              <Show when={selected() && validCurrency(selected()!)}>
                <p>{selected()!.fieldCandidate}: {selected()!.value} · {selected()!.unit} ·
                  {selected()!.ref.refId}</p>
              </Show>
              <button type="button" class="mx-btn" disabled={state.busy || !selected() || !validCurrency(selected()!)}
                onClick={() => { const value = selected(); if (value) void readScenarioTargets(value) }}>
                {t("sf.u24.refreshDestinations")}
              </button>
              <label>{t("sf.u24.scenarioDestination")}
                <select value={state.selectedTarget} disabled={state.busy || !state.targets.length}
                  onChange={(e) => { setState({ selectedTarget: e.currentTarget.value, preview: undefined, phase: "scenario" }) }}>
                  <option value="">{t("sf.u24.scenarioDestination")}</option>
                  <For each={state.targets}>{(target) =>
                    <option value={target.targetRef}>{target.label}</option>}</For>
                </select>
              </label>
              <Show when={!state.targets.length}><p role="status">{t("sf.u24.noTargets")}</p></Show>
              <button type="button" class="mx-btn primary" disabled={!state.selectedTarget || state.busy}
                onClick={() => { void scenario() }}>{t("sf.u24.previewScenario")}</button>
            </section>
            <Show when={preview()}>
              {(value) => <section class="sf-files-section" data-sf-scenario="preview">
                <h2>{t("sf.u24.scenarioResult")}</h2>
                <p>{value().evidence.ref.refId} · {value().evidence.fieldCandidate}:
                  {value().evidence.value === null ? "null" : String(value().evidence.value)}
                  {" "}{value().evidence.unit ?? ""}</p>
                <dl>
                  <dt>currency</dt><dd>{showScenarioValue(value().scenario, "currency") ?? t("sf.common.unknown")}</dd>
                  <dt>knownSubtotal</dt><dd>{showScenarioValue(value().scenario, "knownSubtotal") ?? t("sf.common.unknown")}</dd>
                  <dt>total</dt><dd>{showScenarioValue(value().scenario, "total") ?? t("sf.common.unknown")}</dd>
                </dl>
                <p role="status">{t("sf.u24.scenarioReady")}</p>
              </section>}</Show>
          </Show>
        </SfStatePanel>
        <Show when={state.status === "unavailable" || state.status === "outcome-unknown" || state.status === "stale"}>
          <p role="alert" class="sf-files-note">{t(message())}</p>
          <Show when={state.phase === "unknown"}>
            <button type="button" class="mx-btn" disabled={state.busy}
              onClick={refresh}>{t("sf.u24.reconcile")}</button>
          </Show>
        </Show>
      </section>
    </SfPageFrame>
  )
}
