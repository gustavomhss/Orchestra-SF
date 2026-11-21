import { For, Show, createEffect, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { snapshotDecisionRequest } from "../intent/request"
import { SfAnalysisOutput } from "./output"
import { useLanguage } from "@/context/language"
import { SF_U37_COPY } from "@/i18n/orchestra-chapters/sf-u37"
import { createSfAnalysesClient } from "@orchestra/client/sucafina/analyses"
import { SfAnalyses } from "@orchestra/schema/sucafina/analyses"
import { useSfContext } from "../../context"
import { sfOperationReady } from "../cases/model"
import type { SfSurfaceProps } from "../../context/contracts"
import { SfPageFrame } from "../../shared/frame"
import type { SfCopyKey, SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import "./analyses.css"
import "../intent/decision.css"

type Choices = Extract<typeof SfAnalyses.operations["intelligence.analysis.choices"]["output"]["Type"], { status: "ok" }>["value"]
type Case = Choices["cases"][number]
type Analysis = Choices["analyses"][number]
type Model = Choices["models"][number]
type Run = Extract<typeof SfAnalyses.operations["intelligence.analysis.read"]["output"]["Type"], { status: "ok" }>["value"]
type Output = Extract<typeof SfAnalyses.operations["intelligence.analysis.output"]["output"]["Type"], { status: "ok" }>["value"]
type Request = typeof SfAnalyses.operations["intelligence.analysis.prepare"]["input"]["Type"]["input"]["request"]
type Prepared = Extract<typeof SfAnalyses.operations["intelligence.analysis.prepare"]["output"]["Type"], { status: "ok" }>["value"]

type Phase = "idle" | "preparing" | "reviewing" | "starting" | "cancelling" | "confirm-cancel" | "outcome-unknown" | "failed"
type AnalysisState = {
  cases: Choices["cases"]
  analyses: Choices["analyses"]
  models: Choices["models"]
  caseKey: string; analysisKey: string; modelKey: string; objective: string
  runs: readonly Run[]; runRef: string
  run: Run | null; output: Output | null
  prepared: Prepared | null; preparedRequest: Request | null
  choicesState: SfUiState; historyState: SfUiState; runState: SfUiState; outputState: SfUiState
  phase: Phase
  notice: keyof typeof SF_U37_COPY | null
}

const caseKey = (item: Case["caseRef"]) => JSON.stringify([item.id, item.incarnation, item.version])
// The original decision-case reference is source-locked in case-port.ts.
// F01 already decoded its URL routeRefCodec; compare only authorized choices.
const sourceCaseRef = (item: Case["caseRef"]) => `case:${encodeURIComponent(item.id)}:${encodeURIComponent(item.incarnation)}`
const analysisKey = (item: Analysis) => JSON.stringify([item.profileId, item.profileVersion, item.skillId, item.skillVersion, item.manifestDigest])
const modelKey = (item: Model) => JSON.stringify([item.providerID, item.id, item.variant ?? ""])
const keyState = (status: string): SfUiState => {
  switch (status) {
    case "ok": return "ready"
    case "denied": return "denied"
    case "stale": return "stale"
    case "conflict": case "provider-conflict": return "conflict"
    case "invalid": case "needs-input": return "invalid"
    case "unauthenticated": return "session-expired"
    default: return "unavailable"
  }
}
const initial = (): AnalysisState => ({
  cases: [], analyses: [], models: [], caseKey: "", analysisKey: "", modelKey: "", objective: "",
  runs: [], runRef: "", run: null, output: null, prepared: null, preparedRequest: null,
  choicesState: "loading", historyState: "ready", runState: "ready", outputState: "ready",
  phase: "idle", notice: null,
})

/**
 * U37 / UI41: an authorized analysis is a producer-owned native run, not a
 * client-side LLM completion. Every POST uses the original typed A15 client.
 * Only sf-enquadrar-decisao has a frozen empty selection in the C60 producer.
 * Other skill input schemas have no public selector here and remain blocked.
 */
export function SfAnalysesView(props: SfSurfaceProps<"UI41">): import("solid-js").JSX.Element {
  const owner = useSfContext()
  const language = useLanguage()
  const t = (value: keyof typeof SF_U37_COPY) => language.t(value as Parameters<typeof language.t>[0])
  const k = (value: keyof typeof SF_U37_COPY | "sf.common.loading" | "sf.common.empty" |
    "sf.common.noAccess" | "sf.common.stale" | "sf.common.unavailable" |
    "sf.common.loginAgain" | "sf.common.partial" | "sf.common.pending" |
    "sf.common.invalidLink" | "sf.common.operationUnknown") => value as SfCopyKey
  const [view, setView] = createStore<AnalysisState>(initial())
  let choicesAbort: AbortController | undefined
  let historyAbort: AbortController | undefined
  let runAbort: AbortController | undefined
  let outputAbort: AbortController | undefined
  let commandAbort: AbortController | undefined
  let epoch = 0
  let commandSent = false
  const privacy = (): SfUiState => {
    const state = owner.state().status
    return state === "ready" ? "ready" : state === "resolving" ? "loading" :
      state === "unauthenticated" ? "session-expired" : state === "denied" ? "denied" :
      state === "context-mismatch" ? "invalid" : "unavailable"
  }
  const authorized = (ticket: number, generation: number, signal: AbortSignal) =>
    !signal.aborted && ticket === epoch && generation === owner.generation() && privacy() === "ready" && !!owner.ready()
  // F02 owns POST-read identity. Explicit intent keys belong only to commands.
  const callOptions = (signal: AbortSignal) => ({ signal, idempotencyKey: crypto.randomUUID() })
  const abortReads = () => { choicesAbort?.abort(); historyAbort?.abort(); runAbort?.abort(); outputAbort?.abort() }
  const invalidatePrepared = () => {
    commandAbort?.abort()
    commandSent = false
    setView({ prepared: null, preparedRequest: null, phase: "idle", notice: null })
  }

  const loadChoices = async () => {
    epoch += 1
    abortReads()
    commandAbort?.abort()
    commandSent = false
    setView(initial())
    const ready = owner.ready()
    if (!ready || privacy() !== "ready") return
    choicesAbort = new AbortController()
    const signal = choicesAbort.signal
    const generation = owner.generation()
    const ticket = epoch
    const result = await createSfAnalysesClient(ready.transport)["intelligence.analysis.choices"](
      {}, { signal },
    ).catch(() => undefined)
    if (!authorized(ticket, generation, signal)) return
    if (!result || result.kind !== "response" || result.body.status !== "ok") {
      setView("choicesState", result?.kind === "response" ? keyState(result.body.status) : "unavailable")
      return
    }
    const value = result.body.value
    setView({
      cases: value.cases, analyses: value.analyses, models: value.models,
      choicesState: value.cases.length && value.analyses.length && value.models.length ? "ready" : "partial",
    })
    // An opaque deep-link is only admitted after matching an entry in the
    // current authorized choices. No cross-case implicit lookup is performed.
    const route = props.route
    const linked = value.cases.find((item) => sourceCaseRef(item.caseRef) === route.params.caseRef)
    if (!linked) {
      setView("notice", "sf.u37.notFound")
      return
    }
    setView("caseKey", caseKey(linked.caseRef))
    await loadHistory(linked, ticket, generation)
  }
  const selectedCase = () => view.cases.find((item) => caseKey(item.caseRef) === view.caseKey)
  const selectedAnalysis = () => view.analyses.find((item) => analysisKey(item) === view.analysisKey)
  const selectedModel = () => view.models.find((item) => modelKey(item) === view.modelKey)
  const isBusy = () => view.phase === "preparing" || view.phase === "starting" || view.phase === "cancelling"
  const granted = (operationId: string) => {
    const ready = owner.ready()
    return !!ready && sfOperationReady(ready.context, operationId)
  }
  const canPrepare = () => privacy() === "ready" && granted("intelligence.analysis.prepare") && view.choicesState === "ready" && !!selectedCase() &&
    !!selectedModel() && selectedAnalysis()?.skillId === "sf-enquadrar-decisao" &&
    !!view.objective.trim() && !isBusy() && view.phase !== "outcome-unknown"

  const loadHistory = async (target: Case, ticket = epoch, generation = owner.generation(), preferredRunRef?: string) => {
    const ready = owner.ready()
    if (!ready || privacy() !== "ready") return
    historyAbort?.abort()
    runAbort?.abort()
    outputAbort?.abort()
    historyAbort = new AbortController()
    const signal = historyAbort.signal
    setView({
      historyState: "loading", runState: "ready", outputState: "ready", runs: [], run: null,
      runRef: "", output: null, notice: null,
    })
    const result = await createSfAnalysesClient(ready.transport)["intelligence.analysis.list"](
      { caseRef: { ...target.caseRef } }, { signal },
    ).catch(() => undefined)
    if (!authorized(ticket, generation, signal) || view.caseKey !== caseKey(target.caseRef)) return
    if (!result || result.kind !== "response" || result.body.status !== "ok") {
      setView("historyState", result?.kind === "response" ? keyState(result.body.status) : "unavailable")
      return
    }
    setView("runs", result.body.value)
    setView("historyState", result.body.value.length ? "ready" : "empty")
    const desired = preferredRunRef ?? (props.route.kind === "entry" && sourceCaseRef(target.caseRef) === props.route.params.caseRef
      ? props.route.params.analysisRef : undefined)
    if (desired) {
      const requested = result.body.value.find((run) => run.runRef === desired)
      if (requested) await readRun(requested.runRef, ticket, generation)
      else setView("notice", "sf.u37.notFound")
    }
  }

  const readRun = async (runRef: string, ticket = epoch, generation = owner.generation()) => {
    const ready = owner.ready()
    if (!ready || privacy() !== "ready" || !view.runs.some((item) => item.runRef === runRef)) return
    runAbort?.abort()
    outputAbort?.abort()
    runAbort = new AbortController()
    const signal = runAbort.signal
    setView({ runRef, run: null, runState: "loading", output: null, outputState: "ready" })
    const result = await createSfAnalysesClient(ready.transport)["intelligence.analysis.read"](
      { runRef }, { signal },
    ).catch(() => undefined)
    if (!authorized(ticket, generation, signal) || view.runRef !== runRef) return
    if (!result || result.kind !== "response" || result.body.status !== "ok") {
      setView("runState", result?.kind === "response" ? keyState(result.body.status) : "unavailable")
      return
    }
    if (result.body.value.runRef !== runRef) {
      setView("runState", "stale")
      return
    }
    setView({ run: result.body.value, runState: result.body.value.state === "stale" ? "stale" : "ready" })
  }

  const readOutput = async () => {
    const ready = owner.ready()
    const run = view.run
    if (!ready || privacy() !== "ready" || !run || run.state !== "ready" || !run.outputRef ||
      !view.runs.some((item) => item.runRef === run.runRef)) return
    outputAbort?.abort()
    outputAbort = new AbortController()
    const signal = outputAbort.signal
    const ticket = epoch
    const generation = owner.generation()
    setView({ outputState: "loading", output: null })
    const result = await createSfAnalysesClient(ready.transport)["intelligence.analysis.output"](
      { runRef: run.runRef }, { signal },
    ).catch(() => undefined)
    if (!authorized(ticket, generation, signal) || view.run?.runRef !== run.runRef) return
    if (!result || result.kind !== "response" || result.body.status !== "ok") {
      setView("outputState", result?.kind === "response" ? keyState(result.body.status) : "unavailable")
      return
    }
    if (result.body.value.outputRef && result.body.value.outputRef !== run.outputRef) {
      setView("outputState", "stale")
      return
    }
    setView({ output: result.body.value, outputState: "ready" })
  }

  const prepare = async () => {
    if (!canPrepare()) return
    const ready = owner.ready()
    const selected = selectedAnalysis()
    const chosen = selectedCase()
    if (!ready || !selected || !chosen) return
    const request: Request = {
      caseRef: { ...chosen.caseRef },
      objective: view.objective.trim(),
      profileId: selected.profileId,
      profileVersion: selected.profileVersion,
      skillId: selected.skillId,
      skillVersion: selected.skillVersion,
      manifestDigest: selected.manifestDigest,
      outputSchemaVersion: selected.outputSchemaVersion,
      requestedOperationScope: [...selected.requestedOperationScope],
    }
    commandAbort?.abort()
    commandAbort = new AbortController()
    const signal = commandAbort.signal
    const ticket = epoch
    const generation = owner.generation()
    const caseSelection = view.caseKey
    const skillSelection = view.analysisKey
    setView({ phase: "preparing", preparedRequest: null, prepared: null, notice: null })
    // Exact empty selection is admitted for sf-enquadrar-decisao by
    // case-analysis-input.ts; the producer still validates ACL/version.
    const result = await createSfAnalysesClient(ready.transport)["intelligence.analysis.prepare"](
      { input: { request, selection: {} } }, callOptions(signal),
    ).catch(() => undefined)
    if (!authorized(ticket, generation, signal) ||
      view.caseKey !== caseSelection || view.analysisKey !== skillSelection) return
    if (!result || result.kind !== "response" || result.status === 401 || result.status === 403 || result.body.status === "denied" || result.status !== 200 || result.body.status !== "ok") {
      const bodyStatus = result?.kind === "response" ? result.body.status : ""
      const http = result?.kind === "response" ? result.status : 0
      setView({
        phase: "failed", notice: !result || result.kind !== "response" ? "sf.u37.unavailable" :
          http === 401 || http === 403 || bodyStatus === "denied" ? "sf.u37.denied" :
          bodyStatus === "stale" ? "sf.u37.stale" :
          bodyStatus === "needs-input" ? "sf.u37.needsInput" : "sf.u37.unavailable",
      })
      return
    }
    setView({ prepared: result.body.value, preparedRequest: request, phase: "reviewing" })
  }

  const start = async () => {
    const ready = owner.ready()
    const model = selectedModel()
    const request = view.preparedRequest
    const skillInput = view.prepared
    if (!ready || !granted("intelligence.analysis.start") || !model || !request || skillInput === null || view.phase !== "reviewing" || commandSent ||
      request.caseRef.id !== selectedCase()?.caseRef.id || request.caseRef.version !== selectedCase()?.caseRef.version ||
      request.manifestDigest !== selectedAnalysis()?.manifestDigest) return
    commandSent = true
    commandAbort?.abort()
    commandAbort = new AbortController()
    const signal = commandAbort.signal
    const ticket = epoch
    const generation = owner.generation()
    setView({ phase: "starting", notice: null })
    const result = await createSfAnalysesClient(ready.transport)["intelligence.analysis.start"](
      snapshotDecisionRequest({ input: { request, skillInput, model } }), callOptions(signal),
    ).catch(() => undefined)
    if (!authorized(ticket, generation, signal)) return
    if (!result || result.kind !== "response") {
      setView({ phase: "outcome-unknown", notice: "sf.u37.unknownOutcome" })
      return
    }
    if (result.status === 401 || result.status === 403 || result.body.status === "denied") {
      commandSent = false
      setView({ phase: "failed", notice: "sf.u37.denied" })
      return
    }
    if (result.status !== 200 || result.body.status !== "ok") {
      const refused = result.body.status === "stale" || result.body.status === "needs-input" || result.body.status === "invalid" || result.body.status === "conflict"
      if (refused) commandSent = false
      setView({ phase: refused ? "failed" : "outcome-unknown", notice:
        result.body.status === "stale" ? "sf.u37.stale" :
            result.body.status === "needs-input" ? "sf.u37.needsInput" :
              refused ? "sf.u37.unavailable" : "sf.u37.unknownOutcome" })
      return
    }
    // No synthetic run state/receipt and no background replay. Human explicitly
    // reconciles the original case history after the producer acknowledges.
    commandSent = false
    setView({ phase: "idle", prepared: null, preparedRequest: null })
    const selected = selectedCase()
    if (selected) await loadHistory(selected, ticket, generation, result.body.value.runRef)
  }

  const cancel = async () => {
    const ready = owner.ready()
    const run = view.run
    if (!ready || !granted("intelligence.analysis.cancel") || !run || view.phase !== "confirm-cancel" || commandSent ||
      !["preparing", "queued", "running", "needs-input"].includes(run.state)) return
    commandSent = true
    commandAbort?.abort()
    commandAbort = new AbortController()
    const signal = commandAbort.signal
    const ticket = epoch
    const generation = owner.generation()
    setView({ phase: "cancelling", notice: null })
    const result = await createSfAnalysesClient(ready.transport)["intelligence.analysis.cancel"](
      { runRef: run.runRef }, callOptions(signal),
    ).catch(() => undefined)
    if (!authorized(ticket, generation, signal)) return
    if (!result || result.kind !== "response") {
      setView({ phase: "outcome-unknown", notice: "sf.u37.unknownOutcome" })
      return
    }
    const refused = result.status === 401 || result.status === 403 ||
      result.body.status === "denied" || result.body.status === "stale" ||
      result.body.status === "needs-input" || result.body.status === "invalid" || result.body.status === "conflict"
    const acknowledged = result.status === 200 && result.body.status === "ok"
    if (acknowledged || refused) commandSent = false
    setView({
      phase: acknowledged || refused ? "idle" : "outcome-unknown",
      notice: acknowledged && result.body.value.cancelled ? "sf.u37.cancelled" :
        result.body.status === "stale" ? "sf.u37.stale" :
          result.status === 401 || result.status === 403 || result.body.status === "denied" ? "sf.u37.denied" :
            acknowledged ? "sf.u37.unavailable" : "sf.u37.unknownOutcome",
    })
  }

  createEffect(() => {
    // A change to the original context generation destroys all private views
    // and fences every in-flight response before the next authorized read.
    owner.generation()
    owner.ready()
    void loadChoices()
  })
  onCleanup(() => { epoch += 1; abortReads(); commandAbort?.abort() })

  const contextState = () => privacy()
  const viewState = (): SfUiState => contextState() !== "ready" ? contextState() : view.choicesState
  const message = (): keyof typeof SF_U37_COPY | "sf.common.loading" | "sf.common.noAccess" |
    "sf.common.unavailable" | "sf.common.stale" | "sf.common.loginAgain" |
    "sf.common.partial" | "sf.common.invalidLink" => {
    if (contextState() === "session-expired") return "sf.common.loginAgain"
    if (contextState() === "denied" || view.choicesState === "denied") return "sf.common.noAccess"
    if (contextState() === "loading" || view.choicesState === "loading") return "sf.common.loading"
    if (contextState() === "invalid") return "sf.common.invalidLink"
    if (view.choicesState === "partial") return !view.cases.length ? "sf.u37.noChoices" :
      !view.analyses.length ? "sf.u37.noSkill" : "sf.u37.noModel"
    if (view.choicesState === "stale") return "sf.common.stale"
    return "sf.common.unavailable"
  }
  return (
    <SfPageFrame titleKey={k("sf.ui41.title")} density="comfortable" layout="work"
      context={[]} tabs={[]} activeTab={null} secondaryActions={[]}
      onLayoutMode={() => undefined}>
      <section class="sf-analyses sf-decision-page sf-decision-analyses" data-sf-wave="four" data-sf-decision="UI41" data-sf-surface="UI41">
        <SfStatePanel state={viewState()} messageKey={k(message())}
          onRetryRead={() => { void loadChoices() }}>
          <div class="mx-card sf-decision-analysis-editor" hidden={view.phase === "reviewing" || view.phase === "starting"}>
          <div class="sf-decision-section-heading"><h2>{t("sf.u37.prepare")}</h2></div>
          <div class="sf-analyses-controls">
            <label>{t("sf.u37.chooseCase")}
              <select value={view.caseKey} disabled={isBusy() || view.phase === "outcome-unknown"}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  invalidatePrepared()
                  epoch += 1
                  abortReads()
                  setView({
                    caseKey: value, runRef: "", run: null, runs: [], output: null,
                    historyState: "ready", runState: "ready", outputState: "ready", notice: null,
                  })
                  const found = view.cases.find((item) => caseKey(item.caseRef) === value)
                  if (found) void loadHistory(found)
                }}>
                <option value="">{t("sf.u37.selectCase")}</option>
                <For each={view.cases}>{(item) => (
                  <option value={caseKey(item.caseRef)}>{item.label || item.caseRef.id}</option>
                )}</For>
              </select>
            </label>
            <label>{t("sf.u37.chooseAnalysis")}
              <select value={view.analysisKey} disabled={isBusy() || view.phase === "outcome-unknown"}
                onChange={(event) => { invalidatePrepared(); setView("analysisKey", event.currentTarget.value) }}>
                <option value="">{t("sf.u37.selectSkill")}</option>
                <For each={view.analyses}>{(item) => (
                  <option value={analysisKey(item)}>{item.label}</option>
                )}</For>
              </select>
            </label>
            <label>{t("sf.u37.chooseModel")}
              <select value={view.modelKey} disabled={isBusy() || view.phase === "outcome-unknown"}
                onChange={(event) => { invalidatePrepared(); setView("modelKey", event.currentTarget.value) }}>
                <option value="">{t("sf.u37.selectModel")}</option>
                <For each={view.models}>{(item) => (
                  <option value={modelKey(item)}>{item.providerID}/{item.id}</option>
                )}</For>
              </select>
            </label>
            <label class="sf-analyses-wide">{t("sf.u37.objective")}
              <textarea rows="3" value={view.objective} disabled={isBusy() || view.phase === "outcome-unknown"}
                onInput={(event) => { invalidatePrepared(); setView("objective", event.currentTarget.value) }} />
            </label>
            <button class="mx-btn primary" type="button" onClick={() => void prepare()}
              disabled={!canPrepare()}>{t("sf.u37.prepare")}</button>
            <button class="mx-btn" type="button" onClick={() => void loadChoices()}
              disabled={isBusy() || view.phase === "outcome-unknown"}>{t("sf.u37.refreshChoices")}</button>
          </div>
          </div>
          <Show when={selectedAnalysis() && selectedAnalysis()!.skillId !== "sf-enquadrar-decisao"}>
            <p role="status" class="sf-analyses-note">{t("sf.u37.inputNotPublished")}</p>
          </Show>
          <Show when={view.phase === "preparing" || view.phase === "starting" || view.phase === "cancelling"}>
            <p role="status" aria-live="polite">{t("sf.u37.pending")}</p>
          </Show>
          <Show when={(view.phase === "reviewing" || view.phase === "starting") && view.prepared !== null && view.preparedRequest}>
            <section class="mx-card sf-analyses-section sf-decision-review-stage" data-sf-analysis-review>
              <h2>{t("sf.u37.reviewInput")}</h2>
              <dl class="sf-analyses-facts">
                <dt>{t("sf.u37.case")}</dt><dd>{view.preparedRequest!.caseRef.id}</dd>
                <dt>{t("sf.u37.profile")}</dt><dd>{view.preparedRequest!.profileId}</dd>
                <dt>{t("sf.u37.skill")}</dt><dd>{view.preparedRequest!.skillId}</dd>
                <dt>{t("sf.u37.objective")}</dt><dd>{view.preparedRequest!.objective}</dd>
                <dt>{t("sf.u37.requested")}</dt><dd>{view.preparedRequest!.requestedOperationScope.join(", ")}</dd>
                <dt>{t("sf.u37.chooseModel")}</dt><dd>{selectedModel() ? selectedModel()!.providerID + "/" + selectedModel()!.id + (selectedModel()!.variant ? "/" + selectedModel()!.variant : "") : ""}</dd>
              </dl>
              <details class="sf-decision-source-scope"><summary>{t("sf.u37.source")}</summary>
              <dl class="sf-analyses-facts"><dt>caseRef.incarnation</dt><dd>{view.preparedRequest!.caseRef.incarnation}</dd>
                <dt>caseRef.version</dt><dd>{view.preparedRequest!.caseRef.version}</dd>
                <dt>profileVersion</dt><dd>{view.preparedRequest!.profileVersion}</dd>
                <dt>skillVersion</dt><dd>{view.preparedRequest!.skillVersion}</dd>
                <dt>manifestDigest</dt><dd>{view.preparedRequest!.manifestDigest}</dd>
                <dt>outputSchemaVersion</dt><dd>{view.preparedRequest!.outputSchemaVersion}</dd>
                <dt>skillInput</dt><dd><pre class="sf-analyses-original">{JSON.stringify(view.prepared)}</pre></dd>
              </dl></details>
              <p>{t("sf.u37.reviewSource")}</p>
              <p class="sf-analyses-note">{t("sf.u37.reviewWarning")}</p>
              <button class="mx-btn primary" type="button" disabled={!selectedModel() || !granted("intelligence.analysis.start") || commandSent}
                onClick={() => void start()}>{t("sf.u37.confirmStart")}</button>
              <button class="mx-btn" type="button" disabled={view.phase === "starting"} onClick={invalidatePrepared}>{t("sf.u37.returnToList")}</button>
            </section>
          </Show>
          <Show when={view.notice}>
            {(notice) => <p class="sf-analyses-note" role="status">{t(notice())}</p>}
          </Show>
          <Show when={view.phase === "outcome-unknown"}>
            <p role="alert">{t("sf.u37.unknownOutcome")}</p>
            <button class="mx-btn" type="button" onClick={() => {
              // Reconcile with an authorized read; do not replay a mutation.
              const selected = selectedCase()
              if (!selected) return
              commandSent = false
              setView({ phase: "idle", prepared: null, preparedRequest: null })
              void loadHistory(selected)
            }}>{t("sf.u37.reconcile")}</button>
          </Show>
          <Show when={selectedCase()}>
            <section class="mx-card sf-analyses-section sf-decision-analysis-history" hidden={view.phase === "reviewing" || view.phase === "starting"}>
              <h2>{t("sf.u37.list")}</h2>
              <button class="mx-btn" type="button" onClick={() => void loadHistory(selectedCase()!)}
                disabled={isBusy() || view.phase === "outcome-unknown"}>{t("sf.u37.readList")}</button>
              <SfStatePanel state={view.historyState} messageKey={k(view.historyState === "loading"
                ? "sf.common.loading" : view.historyState === "empty" ? "sf.u37.empty" :
                  view.historyState === "denied" ? "sf.common.noAccess" : "sf.common.unavailable")}
                onRetryRead={() => void loadHistory(selectedCase()!)}>
                <ul class="sf-analyses-list">
                  <For each={view.runs}>{(run) => (
                    <li>
                      <span>{t("sf.u37.reference")}: {run.runRef}</span>
                      <span>{t("sf.u37.status")}: {run.state}</span>
                      <button type="button" class="mx-btn" disabled={isBusy()}
                        onClick={() => void readRun(run.runRef)}>{t("sf.u37.openRun")}</button>
                    </li>
                  )}</For>
                </ul>
              </SfStatePanel>
            </section>
            <Show when={view.runRef}>
              <SfStatePanel state={view.runState}
                messageKey={k(view.runState === "loading" ? "sf.common.loading" :
                  view.runState === "stale" ? "sf.u37.stale" :
                    view.runState === "denied" ? "sf.common.noAccess" : "sf.common.unavailable")}
                onRetryRead={() => void readRun(view.runRef)}>
                <Show when={view.run}>{(run) => (
                  <section class="mx-card sf-analyses-section" data-sf-analysis-run>
                    <h2>{t("sf.u37.detail")}</h2>
                    <dl class="sf-analyses-facts">
                      <dt>{t("sf.u37.reference")}</dt><dd>{run().runRef}</dd>
                      <dt>{t("sf.u37.status")}</dt><dd>{run().state}</dd>
                      <dt>{t("sf.u37.version")}</dt><dd>{run().version}</dd>
                      <Show when={run().outputRef}><dt>{t("sf.u37.outputRef")}</dt><dd>{run().outputRef}</dd></Show>
                    </dl>
                    <div class="sf-analyses-actions">
                      <button class="mx-btn" type="button" onClick={() => void readRun(run().runRef)}
                        disabled={isBusy()}>{t("sf.u37.read")}</button>
                      <Show when={run().state === "ready" && run().outputRef}>
                        <button class="mx-btn primary" type="button" onClick={() => void readOutput()}
                          disabled={isBusy()}>{t("sf.u37.openOutput")}</button>
                      </Show>
                      <Show when={["preparing", "queued", "running", "needs-input"].includes(run().state)}>
                        <button class="mx-btn" type="button" disabled={isBusy() || commandSent}
                          onClick={() => setView("phase", "confirm-cancel")}>{t("sf.u37.cancel")}</button>
                      </Show>
                    </div>
                    <Show when={view.phase === "confirm-cancel"}>
                      <div class="sf-analyses-warning">
                        <p>{t("sf.u37.cancelWarning")}</p>
                        <button class="mx-btn danger" type="button" onClick={() => void cancel()}
                          disabled={commandSent || !granted("intelligence.analysis.cancel")}>{t("sf.u37.confirmCancel")}</button>
                        <button class="mx-btn" type="button" onClick={() => setView("phase", "idle")}>{t("sf.u37.returnToList")}</button>
                      </div>
                    </Show>
                  </section>
                )}</Show>
              </SfStatePanel>
            </Show>
            <Show when={view.outputState === "loading" || view.output}>
              <SfStatePanel state={view.outputState} messageKey={k(view.outputState === "loading"
                ? "sf.common.loading" : "sf.common.unavailable")}
                onRetryRead={() => void readOutput()}>
                <Show when={view.output}>{(output) => (
                  <SfAnalysisOutput output={output()} owner={props.route.ownerSelection} />
                )}</Show>
              </SfStatePanel>
            </Show>
          </Show>
        </SfStatePanel>
      </section>
    </SfPageFrame>
  )
}
