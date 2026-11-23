import { For, Show, createEffect, createUniqueId, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import { createSfMemoryClient } from "@orchestra/client/sucafina/memory"
import type { SfSurfaceProps } from "../context/contracts"
import { useSfContext } from "../context"
import type { SfCopyKey, SfUiState } from "../shared/frame"
import { SfPageFrame } from "../shared/frame"
import { SfStatePanel } from "../shared/states"
import { SF_SIMILARITY217_COPY } from "./similarity-copy"

type CaseRef = { id: string; incarnation: string; version: number }
type Period = { start: string; end: string }
type ListedCase = CaseRef & { encoded: string; title: string }
type Original = { ref: CaseRef; period: Period; objective: string; state: string }
type SimilarOutput = Extract<
  typeof import("@orchestra/schema/sucafina/memory").SfMemory.operations["intelligence.memory-similar-cases"]["output"]["Type"],
  { status: "ok" }
>
type CaseListState = "idle" | SfUiState
type ViewState = {
  cases: readonly ListedCase[]
  catalogState: CaseListState
  selected: string
  source: Original | null
  sourceState: CaseListState
  query: string
  includeHistorical: boolean
  selectedCandidates: readonly string[]
  result: SimilarOutput | null
  resultState: CaseListState
  resultFilter: string
  selectedDetail: CaseRef | null
  detail: Original | null
  detailState: CaseListState
}
const INITIAL: ViewState = {
  cases: [], catalogState: "idle", selected: "", source: null, sourceState: "idle",
  query: "", includeHistorical: false, selectedCandidates: [],
  result: null, resultState: "idle", resultFilter: "",
  selectedDetail: null, detail: null, detailState: "idle",
}
const UNREADABLE_SOURCE = new Set(["revoked", "missing", "unavailable", "invalid"])
const SOURCE_STATES = ["fresh", "historical", "stale", "revoked", "replaced", "missing", "invalid", "unavailable"] as const
const positive = (n: number) => Number.isSafeInteger(n) && n > 0
const equivalent = (a: CaseRef, b: CaseRef) =>
  a.id === b.id && a.incarnation === b.incarnation && a.version === b.version
const encode = (ref: CaseRef) =>
  "case:" + encodeURIComponent(ref.id) + ":" + encodeURIComponent(ref.incarnation)
/** Only C09's original canonical case:id:incarnation selector is recognized. */
function parseOriginal(ref: string): Omit<CaseRef, "version"> | null {
  const match = /^case:([^:]+):([^:]+)$/.exec(ref)
  if (!match) return null
  try {
    const id = decodeURIComponent(match[1]!)
    const incarnation = decodeURIComponent(match[2]!)
    return id.trim() && incarnation.trim() ? { id, incarnation } : null
  } catch { return null }
}
function asListedCase(entry: { caseRef: string; title: string; version: number }): ListedCase | null {
  const parsed = parseOriginal(entry.caseRef)
  return parsed && positive(entry.version)
    ? { ...parsed, version: entry.version, encoded: entry.caseRef, title: entry.title } : null
}
function stateFrom(status: string | undefined): SfUiState {
  switch (status) {
    case "ok": return "ready"
    case "denied": return "denied"
    case "stale": return "stale"
    case "conflict": case "provider-conflict": return "conflict"
    case "needs-input": return "invalid"
    default: return "unavailable"
  }
}
/**
 * UI62 consumes original C09 projection.cases/projection.case and an additive
 * fully typed C17/Atlas read. Every request is cancelled/cleared by the F01
 * owner generation. No free-text URL, browser memory store, arbitrary dispatch,
 * speculative similarity, or reuse of a prior owner's result.
 */
export function SfSimilarCasesView(_props: SfSurfaceProps<"UI62">) {
  const owner = useSfContext()
  const language = useLanguage()
  const sourceLabelId = createUniqueId()
  const t = (key: keyof typeof SF_SIMILARITY217_COPY | "sf.u26.version" |
    "sf.u26.period" | "sf.u26.limitations" | "sf.u26.source" |
    "sf.common.loading" | "sf.common.noAccess" | "sf.common.unavailable" |
    "sf.common.empty" | "sf.common.stale" | "sf.common.invalidLink" | "sf.common.unknown" |
    "sf.common.retry" | "sf.common.loginAgain" | "sf.ui62.title") =>
    language.t(key as Parameters<typeof language.t>[0])
  const k = (key: Parameters<typeof t>[0]) => key as SfCopyKey
  const [view, setView] = createStore<ViewState>({ ...INITIAL })
  let catalogAbort: AbortController | undefined
  let sourceAbort: AbortController | undefined
  let resultAbort: AbortController | undefined
  let detailAbort: AbortController | undefined
  let generationSerial = 0
  let sourceSerial = 0
  let resultSerial = 0
  let detailSerial = 0
  const privacy = (): SfUiState => {
    const state = owner.state()
    if (state.status === "resolving") return "loading"
    if (state.status === "unauthenticated") return "session-expired"
    if (state.status === "denied") return "denied"
    if (state.status === "context-mismatch") return "invalid"
    if (state.status !== "ready") return "unavailable"
    return "ready"
  }
  const permitted = (generation: number, signal: AbortSignal) =>
    !signal.aborted && owner.generation() === generation && !!owner.ready()
  const eraseResults = () => {
    ++resultSerial
    ++detailSerial
    resultAbort?.abort()
    detailAbort?.abort()
    setView({ result: null, resultState: "idle", resultFilter: "", detail: null, detailState: "idle", selectedDetail: null })
  }
  const eraseOwner = () => {
    ++generationSerial
    ++sourceSerial
    sourceAbort?.abort()
    catalogAbort?.abort()
    eraseResults()
    setView({ ...INITIAL })
  }

  const loadCatalog = async (generation: number) => {
    const ready = owner.ready()
    if (!ready) return
    catalogAbort?.abort()
    catalogAbort = new AbortController()
    const signal = catalogAbort.signal
    const serial = generationSerial
    setView("catalogState", "loading")
    try {
      const response = await createSfDecisionsClient(ready.transport)["projection.cases"]({}, { signal })
      if (!permitted(generation, signal) || serial !== generationSerial) return
      if (response.kind !== "response" || response.body.status !== "ok") {
        if (response.kind === "transport-error") console.error("SF UI62 source case list unavailable", response.reason)
        setView("catalogState", response.kind === "response" ? stateFrom(response.body.status) : "unavailable")
        return
      }
      const parsed = response.body.value.cases.map(asListedCase)
      if (parsed.some((item) => !item) ||
        new Set(parsed.map((item) => item!.encoded)).size !== parsed.length) {
        console.error("SF UI62 malformed/duplicate authorized case catalog")
        setView("catalogState", "unavailable")
        return
      }
      setView("cases", parsed as ListedCase[])
      setView("catalogState", parsed.length ? "ready" : "empty")
    } catch (error) {
      if (permitted(generation, signal) && serial === generationSerial) {
        console.error("SF UI62 original case catalog read failed", error)
        setView("catalogState", "unavailable")
      }
    }
  }
  createEffect(() => {
    const generation = owner.generation()
    const ready = owner.ready()
    eraseOwner()
    if (ready) void loadCatalog(generation)
  })
  onCleanup(eraseOwner)

  const changeSelected = async (encoded: string) => {
    ++sourceSerial
    sourceAbort?.abort()
    eraseResults()
    setView({ selected: encoded, source: null, sourceState: "idle", selectedCandidates: [] })
    if (!encoded) return
    const selected = view.cases.find((item) => item.encoded === encoded)
    const ready = owner.ready()
    if (!ready || !selected) {
      setView("sourceState", "invalid")
      return
    }
    const generation = owner.generation()
    const serial = sourceSerial
    sourceAbort = new AbortController()
    const signal = sourceAbort.signal
    setView("sourceState", "loading")
    try {
      const response = await createSfDecisionsClient(ready.transport)["projection.case"]({ caseRef: encoded }, { signal })
      if (!permitted(generation, signal) || serial !== sourceSerial) return
      if (response.kind !== "response" || response.body.status !== "ok") {
        if (response.kind === "transport-error") console.error("SF UI62 original case read unavailable", response.reason)
        setView("sourceState", response.kind === "response" ? stateFrom(response.body.status) : "unavailable")
        if (response.kind === "response" && response.body.status === "denied") {
          eraseOwner()
          setView("catalogState", "denied")
        }
        return
      }
      const original = response.body.value.projection.case
      if (original.id !== selected.id || original.incarnation !== selected.incarnation ||
        original.version !== selected.version || !original.horizon.start || !original.horizon.end) {
        setView("sourceState", "stale")
        return
      }
      setView("source", { ref: { id: original.id, incarnation: original.incarnation, version: original.version },
        period: original.horizon, objective: original.objective, state: original.state })
      setView("sourceState", "ready")
    } catch (error) {
      if (permitted(generation, signal) && serial === sourceSerial) {
        console.error("SF UI62 source case read failed", error)
        setView("sourceState", "unavailable")
      }
    }
  }
  const eligible = () => view.cases.filter((c) => view.source && !equivalent(c, view.source.ref))
  const toggleCandidate = (encoded: string, checked: boolean) => {
    const candidate = eligible().find((c) => c.encoded === encoded)
    if (!candidate) return
    const next = checked ? [...new Set([...view.selectedCandidates, encoded])] :
      view.selectedCandidates.filter((item) => item !== encoded)
    if (next.length > 50) {
      setView("resultState", "invalid")
      return
    }
    eraseResults()
    setView("selectedCandidates", next)
  }
  const submit = async () => {
    const ready = owner.ready()
    const source = view.source
    const candidates = view.selectedCandidates.map((value) => eligible().find((c) => c.encoded === value))
    const selectedCases = candidates.filter((candidate): candidate is ListedCase => candidate !== undefined)
    if (!ready || !source || !view.query.trim() || !candidates.length || candidates.length > 50 ||
      selectedCases.length !== candidates.length) {
      setView("resultState", "invalid")
      return
    }
    eraseResults()
    resultAbort = new AbortController()
    const signal = resultAbort.signal
    const generation = owner.generation()
    const serial = resultSerial
    const selection = { caseId: source.ref.id, incarnation: source.ref.incarnation, version: source.ref.version,
      query: view.query.trim(), period: source.period, includeHistorical: view.includeHistorical,
      candidates: selectedCases.map(({ id, incarnation, version }) => ({ id, incarnation, version })) }
    setView("resultState", "loading")
    try {
      const response = await createSfMemoryClient(ready.transport)["intelligence.memory-similar-cases"](selection, { signal })
      if (!permitted(generation, signal) || serial !== resultSerial) return
      if (response.kind !== "response" || response.body.status !== "ok") {
        if (response.kind === "transport-error") console.error("SF UI62 Atlas recall transport unavailable", response.reason)
        const state = response.kind === "response" ? stateFrom(response.body.status) : "unavailable"
        if (state === "denied") {
          eraseOwner()
          setView("catalogState", "denied")
          return
        }
        setView("resultState", state)
        return
      }
      const result = response.body
      const valid = equivalent(result.cutoff.caseRef, source.ref) &&
        result.cutoff.period.start === source.period.start && result.cutoff.period.end === source.period.end &&
        result.cutoff.includeHistorical === view.includeHistorical &&
        result.matches.every((match) => selectedCases.some((candidate) => equivalent(candidate, match.caseRef)) &&
          equivalent(match.caseRef, match.explanation.candidateCaseRef) &&
          (view.includeHistorical || !match.explanation.sourceStates.includes("historical"))) &&
        new Set(result.matches.map((m) => JSON.stringify([m.caseRef, m.memoryRecordRef]))).size === result.matches.length
      if (!valid) {
        console.error("SF UI62 returned recall did not match selected source/cutoff")
        setView("resultState", "stale")
        return
      }
      const readable = result.matches.filter((match) =>
        !match.explanation.sourceStates.some((state) => UNREADABLE_SOURCE.has(state)) &&
        (view.includeHistorical || !match.explanation.sourceStates.includes("historical")))
      setView("result", readable.length ? { ...result, matches: readable } : null)
      setView("resultState", readable.length ? "ready" : "empty")
    } catch (error) {
      if (permitted(generation, signal) && serial === resultSerial) {
        console.error("SF UI62 Atlas recall failed", error)
        setView("resultState", "unavailable")
      }
    }
  }
  const readableMatches = () => (view.result?.matches ?? []).filter((match) =>
    !match.explanation.sourceStates.some((state) => UNREADABLE_SOURCE.has(state)) &&
    (view.includeHistorical || !match.explanation.sourceStates.includes("historical")))
  const filtered = () => {
    const q = view.resultFilter.toLocaleLowerCase().trim()
    const base = readableMatches()
    if (!q) return base
    return base.filter((m) =>
      [m.caseRef.id, ...m.explanation.matchedCriteria, ...m.explanation.currentDifferences].some((s) =>
        s.toLocaleLowerCase().includes(q)))
  }
  const sourceStateLabel = (state: string) =>
    (SOURCE_STATES as readonly string[]).includes(state)
      ? t(`sf.u26.similarState.${state}` as keyof typeof SF_SIMILARITY217_COPY)
      : t("sf.common.unknown")
  const resultsState = (): SfUiState =>
    privacy() !== "ready" ? privacy() :
    view.catalogState !== "ready" && view.catalogState !== "empty" ? view.catalogState === "idle" ? "loading" : view.catalogState :
    view.sourceState === "denied" ? "denied" :
    view.resultState === "idle" ? "ready" :
    view.resultState === "ready" && readableMatches().length === 0 ? "empty" :
    view.resultState === "ready" && filtered().length === 0 ? "filtered-empty" :
    view.resultState
  const resultsMessage = () =>
    resultsState() === "loading" ? "sf.common.loading" :
    resultsState() === "denied" ? "sf.common.noAccess" :
    resultsState() === "session-expired" ? "sf.common.loginAgain" :
    resultsState() === "empty" ? "sf.u26.similarEmpty" :
    resultsState() === "filtered-empty" ? "sf.u26.similarFilteredEmpty" :
    resultsState() === "invalid" ? "sf.u26.similarNoSelection" :
    resultsState() === "stale" ? "sf.common.stale" :
    resultsState() === "ready" ? "sf.u26.similarMatches" : "sf.common.unavailable"
  const openOriginal = async (ref: CaseRef) => {
    const ready = owner.ready()
    if (!ready || !view.result?.matches.some((match) => equivalent(match.caseRef, ref))) return
    ++detailSerial
    detailAbort?.abort()
    detailAbort = new AbortController()
    const signal = detailAbort.signal
    const generation = owner.generation()
    const serial = detailSerial
    setView({ selectedDetail: ref, detail: null, detailState: "loading" })
    try {
      const response = await createSfDecisionsClient(ready.transport)["projection.case"]({ caseRef: encode(ref) }, { signal })
      if (!permitted(generation, signal) || serial !== detailSerial) return
      if (response.kind !== "response" || response.body.status !== "ok") {
        if (response.kind === "transport-error") console.error("SF UI62 matched case detail unavailable", response.reason)
        const state = response.kind === "response" ? stateFrom(response.body.status) : "unavailable"
        if (state === "denied") {
          eraseOwner()
          setView("catalogState", "denied")
        } else setView("detailState", state)
        return
      }
      const found = response.body.value.projection.case
      if (!equivalent(found, ref)) {
        setView("detailState", "stale")
        return
      }
      setView("detail", { ref, period: found.horizon, objective: found.objective, state: found.state })
      setView("detailState", "ready")
    } catch (error) {
      if (permitted(generation, signal) && serial === detailSerial) {
        console.error("SF UI62 original precedent read failed", error)
        setView("detailState", "unavailable")
      }
    }
  }

  return (
    <SfPageFrame titleKey={k("sf.ui62.title")} context={[]} tabs={[]} activeTab={null}
      secondaryActions={[]} density="comfortable" layout="reading" onLayoutMode={() => undefined}>
      <section class="sf-memory sf-memory-similarity sf-workflow" data-sf-wave="six" data-sf-surface="UI62">
        <Show when={privacy() === "ready" && (view.catalogState === "ready" || view.catalogState === "empty")}>
          <form class="sf-memory-similarity-form sf-form" onSubmit={(event) => { event.preventDefault(); void submit() }}>
            <p class="sf-memory-help">{t("sf.u26.similarQueryHelp")}</p>
            <label><span id={sourceLabelId}>{t("sf.u26.similarSource")}</span>
              <select aria-labelledby={sourceLabelId} value={view.selected} onChange={(event) => { void changeSelected(event.currentTarget.value) }}>
                <option value="">{t("sf.u26.similarChoose")}</option>
                <For each={view.cases}>{(candidate) =>
                  <option value={candidate.encoded}>{candidate.title} — {candidate.version}</option>}</For>
              </select>
            </label>
            <Show when={view.sourceState === "loading" || view.sourceState === "stale" || view.sourceState === "unavailable" || view.sourceState === "invalid"}>
              <SfStatePanel
                state={view.sourceState === "loading" ? "loading" : view.sourceState === "stale" ? "stale" : view.sourceState === "invalid" ? "invalid" : "unavailable"}
                messageKey={k(view.sourceState === "loading" ? "sf.common.loading" :
                  view.sourceState === "stale" ? "sf.common.stale" :
                  view.sourceState === "invalid" ? "sf.common.invalidLink" : "sf.common.unavailable")}
                onRetryRead={view.sourceState === "loading" ? undefined : () => { void changeSelected(view.selected) }}
              />
            </Show>
            <Show when={view.source}>
              {(original) => <>
                <dl class="sf-memory-facts">
                  <dt>{t("sf.u26.similarVersion")}</dt><dd>{original().ref.version}</dd>
                  <dt>{t("sf.u26.period")}</dt><dd>{original().period.start} — {original().period.end}</dd>
                </dl>
                <label>{t("sf.u26.similarQuery")}
                  <input type="search" autocomplete="off" value={view.query} required
                    onInput={(event) => { eraseResults(); setView("query", event.currentTarget.value) }} />
                </label>
                <label class="sf-memory-check">
                  <input type="checkbox" checked={view.includeHistorical}
                    onChange={(event) => { eraseResults(); setView("includeHistorical", event.currentTarget.checked) }} />
                  {t("sf.u26.similarHistorical")}
                </label>
                <fieldset class="sf-memory-candidates">
                  <legend>{t("sf.u26.similarCandidates")}</legend>
                  <p class="sf-memory-help">{t("sf.u26.similarCandidatesHelp")}</p>
                  <Show when={eligible().length} fallback={<p>{t("sf.u26.similarNoCandidates")}</p>}>
                    <div class="sf-memory-candidate-grid">
                      <For each={eligible()}>{(candidate) =>
                        <label class="sf-memory-check">
                          <input type="checkbox" value={candidate.encoded}
                            checked={view.selectedCandidates.includes(candidate.encoded)}
                            onChange={(event) => toggleCandidate(candidate.encoded, event.currentTarget.checked)} />
                          <span>{candidate.title} — {t("sf.u26.version")}: {candidate.version}</span>
                        </label>}</For>
                    </div>
                  </Show>
                </fieldset>
                <button class="mx-btn primary" type="submit" disabled={view.resultState === "loading" ||
                  !view.query.trim() || view.selectedCandidates.length === 0 || view.selectedCandidates.length > 50}>
                  {t("sf.u26.similarSearch")}
                </button>
              </>}
            </Show>
          </form>
        </Show>
        <SfStatePanel state={resultsState()} messageKey={k(resultsMessage())}
          onRetryRead={privacy() === "ready" ? () =>
            view.resultState !== "idle" && view.source ? void submit() : void loadCatalog(owner.generation()) : undefined}>
          <Show when={view.sourceState === "ready" && view.result}>
            {(data) =>
              <section class="sf-memory-section sf-section" data-sf-similar-matches>
                <h2>{t("sf.u26.similarMatches")}</h2>
                <label>{t("sf.u26.similarFilter")}
                  <input type="search" value={view.resultFilter}
                    onInput={(event) => setView("resultFilter", event.currentTarget.value)} />
                </label>
                <p class="sf-memory-help">{t("sf.u26.similarNoCausality")}</p>
                <ul class="sf-memory-list">
                  <For each={filtered()}>{(match) =>
                    <li data-sf-similar-case={match.caseRef.id} data-sf-memory-record={match.memoryRecordRef}>
                      <div>
                        <strong>{view.cases.find((candidate) => equivalent(candidate, match.caseRef))?.title ?? match.caseRef.id}</strong>
                        <small>{t("sf.u26.version")}: {match.caseRef.version}</small>
                        <h3>{t("sf.u26.similarWhy")}</h3>
                        <dl class="sf-memory-facts">
                          <dt>{t("sf.u26.similarMatched")}</dt><dd>{match.explanation.matchedCriteria.join(", ")}</dd>
                          <dt>{t("sf.u26.similarDifferences")}</dt><dd>{match.explanation.currentDifferences.join(", ") || "—"}</dd>
                          <dt>{t("sf.u26.similarStates")}</dt><dd>{match.explanation.sourceStates.map(sourceStateLabel).join(", ")}</dd>
                        </dl>
                        <details class="sf-memory-reference">
                          <summary>{t("sf.u26.similarSourceEvidence")}</summary>
                          <dl class="sf-memory-facts"><dt>{t("sf.u26.similarMemoryRecord")}</dt><dd>{match.memoryRecordRef}</dd></dl>
                          <ul><For each={match.evidenceRefs}>{(ref) => <li>{ref.refId}</li>}</For></ul>
                        </details>
                        <Show when={match.explanation.limitations.length}>
                          <p>{t("sf.u26.limitations")}: {match.explanation.limitations.join("; ")}</p>
                        </Show>
                      </div>
                      <button type="button" class="mx-btn" onClick={() => { void openOriginal(match.caseRef) }}>
                        {t("sf.u26.similarOpen")}
                      </button>
                    </li>}</For>
                </ul>
                <h3>{t("sf.u26.similarCutoff")}</h3>
                <p>{t("sf.u26.version")}: {data().cutoff.caseRef.version} · {t("sf.u26.period")}:
                  {data().cutoff.period.start} — {data().cutoff.period.end}</p>
                <Show when={data().limitations.length}>
                  <h3>{t("sf.u26.limitations")}</h3>
                  <ul><For each={data().limitations}>{(item) => <li>{item}</li>}</For></ul>
                </Show>
              </section>}
          </Show>
        </SfStatePanel>
        <Show when={view.selectedDetail && privacy() === "ready"}>
          <SfStatePanel state={view.detailState === "idle" ? "loading" : view.detailState as SfUiState}
            messageKey={k(view.detailState === "loading" ? "sf.common.loading" :
              view.detailState === "stale" ? "sf.common.stale" :
              view.detailState === "denied" ? "sf.common.noAccess" : "sf.common.unavailable")}
            onRetryRead={view.selectedDetail ? () => void openOriginal(view.selectedDetail!) : undefined}>
            <Show when={view.detail}>{(detail) =>
              <section class="sf-memory-section sf-section" data-sf-similar-detail>
                <h2>{t("sf.u26.similarDetail")}</h2>
                <dl class="sf-memory-facts">
                  <dt>{t("sf.u26.similarObjective")}</dt><dd>{detail().objective}</dd>
                  <dt>{t("sf.u26.similarStatus")}</dt><dd>{detail().state}</dd>
                  <dt>{t("sf.u26.version")}</dt><dd>{detail().ref.version}</dd>
                  <dt>{t("sf.u26.period")}</dt><dd>{detail().period.start} — {detail().period.end}</dd>
                </dl>
              </section>}</Show>
          </SfStatePanel>
        </Show>
      </section>
    </SfPageFrame>
  )
}
