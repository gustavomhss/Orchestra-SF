import { For, Show, createEffect, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { SF_U26_COPY } from "@/i18n/orchestra-chapters/sf-u26"
import { createSfMemoryClient } from "@orchestra/client/sucafina/memory"
import { SfMemory } from "@orchestra/schema/sucafina/memory"
import { useSfContext } from "../context"
import type { SfSurfaceProps } from "../context/contracts"
import { SfPageFrame } from "../shared/frame"
import type { SfCopyKey, SfUiState } from "../shared/frame"
import { SfStatePanel } from "../shared/states"
import "./memory.css"

type Conditions = Extract<typeof SfMemory.operations["intelligence.memory-conditions"]["output"]["Type"], { status: "ok" }>["value"]
type Signals = Extract<typeof SfMemory.operations["intelligence.memory-signals"]["output"]["Type"], { status: "ok" }>["signals"]
type Material = Extract<typeof SfMemory.operations["intelligence.memory-materiality"]["output"]["Type"], { status: "ok" }>
type Outcome = Extract<typeof SfMemory.operations["intelligence.memory-outcome"]["output"]["Type"], { status: "comparable" }>
type CaseQuery = { caseId: string; incarnation: string; version: number }
type ReadState = "idle" | SfUiState
type MemoryViewState = {
  caseId: string; incarnation: string; versionText: string
  active: CaseQuery | null
  catalog: readonly string[]
  conditions: Conditions
  signals: Signals
  selectedCondition: string
  selectedChoice: string
  material: Material | null
  outcome: Outcome | null
  listState: ReadState
  detailState: ReadState
  catalogState: ReadState
  message: string | null
}
type MemoryOperationResult = { kind: "transport-error" } | { kind: "response"; body: { status: string } }

const stateFrom = (result: MemoryOperationResult): SfUiState => {
  if (result.kind !== "response") return "unavailable"
  switch (result.body.status) {
    case "ok": case "comparable": return "ready"
    case "denied": return "denied"
    case "stale": return "stale"
    case "conflict": case "provider-conflict": return "conflict"
    case "needs-input": return "invalid"
    default: return "unavailable"
  }
}

const EMPTY: Pick<MemoryViewState, "active" | "catalog" | "conditions" | "signals" | "selectedCondition" | "selectedChoice" | "material" | "outcome" | "listState" | "detailState" | "catalogState" | "message"> = {
  active: null, catalog: [], conditions: [], signals: [], selectedCondition: "", selectedChoice: "",
  material: null, outcome: null, listState: "idle", detailState: "idle", catalogState: "idle", message: null,
}

/**
 * U26 / UI61–UI63. Only A14's seven source-locked operations are legal here.
 * Case identity is explicit and is re-authorized by the producer on EVERY read.
 * In particular, UI62 has no similarity operation in the C60 catalog; it cannot
 * substitute Atlas memory, an inferred case list or a private server import.
 */
export function SfMemoryView(props: SfSurfaceProps): import("solid-js").JSX.Element {
  const owner = useSfContext()
  const language = useLanguage()
  const k = (value: keyof typeof SF_U26_COPY | "sf.common.loading" | "sf.common.empty" |
    "sf.common.unavailable" | "sf.common.noAccess" | "sf.common.partial" |
    "sf.common.filterEmpty" | "sf.common.stale" | "sf.common.invalidLink" |
    "sf.common.loginAgain" | "sf.common.retry" | "sf.common.currentSource") => value as SfCopyKey
  const t = (value: keyof typeof SF_U26_COPY) => language.t(value as Parameters<typeof language.t>[0])
  const [view, setView] = createStore<MemoryViewState>({
    caseId: "", incarnation: "", versionText: "", ...EMPTY,
  })
  let listAbort: AbortController | undefined
  let detailAbort: AbortController | undefined
  let catalogAbort: AbortController | undefined
  let requestEpoch = 0
  const privacy = () => {
    const state = owner.state()
    if (state.status === "resolving") return "loading" as const
    if (state.status === "unauthenticated") return "session-expired" as const
    if (state.status === "denied") return "denied" as const
    if (state.status === "context-mismatch") return "invalid" as const
    if (state.status !== "ready") return "unavailable" as const
    return "ready" as const
  }
  const current = (epoch: number, generation: number, signal: AbortSignal) =>
    !signal.aborted && requestEpoch === epoch && owner.generation() === generation && !!owner.ready()
  const clear = () => {
    requestEpoch += 1
    listAbort?.abort()
    detailAbort?.abort()
    catalogAbort?.abort()
    setView(EMPTY)
    setView({ caseId: "", incarnation: "", versionText: "" })
  }

  createEffect(() => {
    // Generation/availability is the F01 owner fence, not a client-side grant.
    const generation = owner.generation()
    const ready = owner.ready()
    clear()
    if (!ready) return
    catalogAbort = new AbortController()
    const epoch = requestEpoch
    const signal = catalogAbort.signal
    setView("catalogState", "loading")
    void createSfMemoryClient(ready.transport)["intelligence.memory-catalog"](undefined, { signal })
      .then((result) => {
        if (!current(epoch, generation, signal)) return
        if (result.kind === "response" && result.body.status === "ok") {
          setView("catalog", result.body.value)
          setView("catalogState", "ready")
          return
        }
        setView("catalogState", stateFrom(result))
      })
      .catch(() => {
        if (current(epoch, generation, signal)) setView("catalogState", "unavailable")
      })
  })
  onCleanup(() => { requestEpoch += 1; listAbort?.abort(); detailAbort?.abort(); catalogAbort?.abort() })

  const parsedCase = (): CaseQuery | null => {
    const version = Number(view.versionText)
    return view.caseId.trim() && view.incarnation.trim() && /^\\d+$/.test(view.versionText) &&
      Number.isSafeInteger(version) && version > 0
      ? { caseId: view.caseId.trim(), incarnation: view.incarnation.trim(), version } : null
  }
  const loadCase = async (existing?: CaseQuery) => {
    const ready = owner.ready()
    const caseRef = existing ?? parsedCase()
    if (!ready || !caseRef) {
      setView("listState", "invalid")
      return
    }
    requestEpoch += 1
    listAbort?.abort()
    detailAbort?.abort()
    listAbort = new AbortController()
    const signal = listAbort.signal
    const generation = owner.generation()
    const epoch = requestEpoch
    const client = createSfMemoryClient(ready.transport)
    setView({
      active: caseRef, conditions: [], signals: [], material: null, outcome: null,
      selectedCondition: "", selectedChoice: "", listState: "loading", detailState: "idle", message: null,
    })
    // Both are current ACL reads, not a cached similarity or re-evaluation.
    const [conditions, signals] = await Promise.allSettled([
      client["intelligence.memory-conditions"](caseRef, { signal }),
      client["intelligence.memory-signals"](caseRef, { signal }),
    ])
    if (!current(epoch, generation, signal)) return
    const c = conditions.status === "fulfilled" ? conditions.value : undefined
    const s = signals.status === "fulfilled" ? signals.value : undefined
    const cOk = c?.kind === "response" && c.body.status === "ok"
    const sOk = s?.kind === "response" && s.body.status === "ok"
    if (c?.kind === "response" && c.body.status === "denied" || s?.kind === "response" && s.body.status === "denied") {
      setView({ conditions: [], signals: [], active: null, listState: "denied" })
      return
    }
    setView("conditions", cOk ? c.body.value : [])
    setView("signals", sOk ? s.body.signals : [])
    const state = cOk && sOk
      ? c.body.value.length || s.body.signals.length ? "ready" : "empty"
      : cOk || sOk ? "partial"
      : c ? stateFrom(c) : s ? stateFrom(s) : "unavailable"
    setView("listState", state)
  }
  const readMateriality = async (conditionId: string) => {
    const ready = owner.ready()
    const caseRef = view.active
    if (!ready || !caseRef || !view.conditions.some((item) => item.conditionId === conditionId)) return
    detailAbort?.abort()
    detailAbort = new AbortController()
    const signal = detailAbort.signal
    const epoch = requestEpoch
    const generation = owner.generation()
    setView({ selectedCondition: conditionId, selectedChoice: "", material: null, outcome: null, detailState: "loading" })
    const result = await createSfMemoryClient(ready.transport)["intelligence.memory-materiality"](
      { ...caseRef, conditionId }, { signal },
    ).catch(() => undefined)
    if (!current(epoch, generation, signal)) return
    if (result?.kind === "response" && result.body.status === "ok") {
      if (result.body.scope.source.incarnation !== view.active?.incarnation) {
        setView("detailState", "stale")
        return
      }
      setView({ material: result.body, detailState: "ready" })
      return
    }
    setView("detailState", result ? stateFrom(result) : "unavailable")
  }
  const readOutcome = async (choiceId: string) => {
    const ready = owner.ready()
    const caseRef = view.active
    if (!ready || !caseRef || !view.conditions.some((item) => item.choiceId === choiceId)) return
    detailAbort?.abort()
    detailAbort = new AbortController()
    const signal = detailAbort.signal
    const epoch = requestEpoch
    const generation = owner.generation()
    setView({ selectedChoice: choiceId, selectedCondition: "", material: null, outcome: null, detailState: "loading" })
    const result = await createSfMemoryClient(ready.transport)["intelligence.memory-outcome"](
      { ...caseRef, choiceId }, { signal },
    ).catch(() => undefined)
    if (!current(epoch, generation, signal)) return
    if (result?.kind === "response" && result.body.status === "comparable") {
      if (result.body.caseRef.id !== caseRef.caseId || result.body.caseRef.incarnation !== caseRef.incarnation ||
        result.body.caseRef.version !== caseRef.version || result.body.choiceId !== choiceId) {
        setView("detailState", "stale")
        return
      }
      setView({ outcome: result.body, detailState: "ready" })
      return
    }
    setView("detailState", result ? stateFrom(result) : "unavailable")
  }
  const title = () => props.surfaceId === "UI63" ? "sf.ui63.title" : props.surfaceId === "UI62" ? "sf.ui62.title" : "sf.ui61.title"
  const detailMessage = (): keyof typeof SF_U26_COPY | "sf.common.loading" | "sf.common.unavailable" | "sf.common.noAccess" | "sf.common.stale" | "sf.common.invalidLink" =>
    view.detailState === "loading" ? "sf.common.loading" :
    view.detailState === "denied" ? "sf.common.noAccess" :
    view.detailState === "stale" ? "sf.common.stale" :
    view.detailState === "invalid" ? "sf.common.invalidLink" : "sf.common.unavailable"
  const pageState = (): SfUiState =>
    privacy() !== "ready" ? privacy() :
    props.surfaceId === "UI62" ? "unavailable" :
    view.listState === "idle" ? "ready" :
    view.listState === "loading" ? "loading" : view.listState
  const pageMessage = () => privacy() === "denied" ? "sf.common.noAccess" :
    privacy() === "session-expired" ? "sf.common.loginAgain" :
    privacy() === "loading" || view.listState === "loading" ? "sf.common.loading" :
    props.surfaceId === "UI62" ? "sf.u26.noSimilarity" :
    view.listState === "empty" ? "sf.common.empty" :
    view.listState === "denied" ? "sf.common.noAccess" :
    view.listState === "partial" ? "sf.common.partial" :
    view.listState === "invalid" ? "sf.u26.invalidCase" :
    view.listState === "stale" ? "sf.common.stale" : "sf.common.unavailable"
  return (
    <SfPageFrame titleKey={k(title())} context={[]} tabs={[]} activeTab={null} secondaryActions={[]}
      density="comfortable" layout="reading" onLayoutMode={() => undefined}>
      <section class="sf-memory" data-sf-surface={props.surfaceId}>
        <Show when={privacy() === "ready" && props.surfaceId !== "UI62"}>
          <form class="sf-memory-form" onSubmit={(event) => { event.preventDefault(); void loadCase() }}>
            <p class="sf-memory-help">{t("sf.u26.caseHelp")}</p>
            <label>{t("sf.u26.caseId")}<input autocomplete="off" required value={view.caseId}
              onInput={(event) => setView("caseId", event.currentTarget.value)} /></label>
            <label>{t("sf.u26.incarnation")}<input autocomplete="off" required value={view.incarnation}
              onInput={(event) => setView("incarnation", event.currentTarget.value)} /></label>
            <label>{t("sf.u26.version")}<input type="number" min="1" step="1" required value={view.versionText}
              onInput={(event) => setView("versionText", event.currentTarget.value)} /></label>
            <button class="mx-btn primary" type="submit" disabled={!parsedCase() || view.listState === "loading"}>
              {t("sf.u26.openCase")}
            </button>
            <Show when={view.active}><button class="mx-btn" type="button" onClick={() => void loadCase(view.active!)}>
              {t("sf.u26.refresh")}</button></Show>
          </form>
        </Show>
        <SfStatePanel state={pageState()} messageKey={k(pageMessage())}
          onRetryRead={view.active && privacy() === "ready" ? () => void loadCase(view.active!) : undefined}>
          <Show when={props.surfaceId === "UI62"}>
            <p role="status">{t("sf.u26.noSimilarity")}</p>
          </Show>
          <Show when={props.surfaceId !== "UI62" && view.active}>
            <section class="sf-memory-section">
              <h2>{t("sf.u26.conditions")}</h2>
              <Show when={view.conditions.length} fallback={<p>{t("sf.u26.noConditions")}</p>}>
                <ul class="sf-memory-list">
                  <For each={view.conditions}>{(condition) => (
                    <li>
                      <div><strong>{condition.label}</strong>
                        <small>{t("sf.u26.criterion")}: {condition.criterionId} · {t("sf.u26.period")}: {condition.period.start} – {condition.period.end}</small>
                      </div>
                      <button type="button" class="mx-btn" onClick={() => void (
                        props.surfaceId === "UI63" ? readOutcome(condition.choiceId) : readMateriality(condition.conditionId)
                      )}>{props.surfaceId === "UI63" ? t("sf.u26.outcomeDetail") : t("sf.u26.conditionDetail")}</button>
                    </li>
                  )}</For>
                </ul>
              </Show>
            </section>
            <Show when={props.surfaceId === "UI61"}>
              <section class="sf-memory-section">
                <h2>{t("sf.u26.signals")}</h2>
                <Show when={view.signals.length} fallback={<p>{t("sf.u26.noSignals")}</p>}>
                  <ul class="sf-memory-list">
                    <For each={view.signals}>{(signal) => <li>
                      <div><strong>{signal.label}</strong>
                        <small>{t("sf.u26.materiality")}: {signal.impact.state} · {t("sf.u26.action")}: {signal.action}</small>
                        <p>{signal.impact.reason}</p>
                        <small>{t("sf.u26.evidence")}: {signal.impact.current.length}</small>
                      </div>
                    </li>}</For>
                  </ul>
                </Show>
              </section>
            </Show>
          </Show>
        </SfStatePanel>
        <Show when={privacy() === "ready" && props.surfaceId === "UI61" && view.selectedCondition}>
          <SfStatePanel state={view.detailState === "idle" ? "loading" : view.detailState}
            messageKey={k(detailMessage())}
            onRetryRead={() => void readMateriality(view.selectedCondition)}>
            <Show when={view.material}>{(data) => (
              <section class="sf-memory-section" data-sf-memory-materiality>
                <h2>{t("sf.u26.materiality")}</h2>
                <dl class="sf-memory-facts">
                  <dt>{t("sf.u26.condition")}</dt><dd>{data().snapshot.condition.id}</dd>
                  <dt>{t("sf.u26.impact")}</dt><dd>{data().impact.state}</dd>
                  <dt>{t("sf.u26.reason")}</dt><dd>{data().impact.reason}</dd>
                  <dt>{t("sf.u26.source")}</dt><dd>{data().scope.source.type}: {data().scope.source.id}</dd>
                  <dt>{t("sf.u26.version")}</dt><dd>{data().scope.source.version}</dd>
                  <dt>{t("sf.u26.period")}</dt><dd>{data().scope.period.start} – {data().scope.period.end}</dd>
                  <dt>{t("sf.u26.fields")}</dt><dd>{data().scope.fields.join(", ")}</dd>
                  <dt>{t("sf.u26.observedAt")}</dt><dd>{data().scope.source.observedAt}</dd>
                  <dt>{t("sf.u26.changed")}</dt><dd>{data().snapshot.change.availability}</dd>
                  <dt>{t("sf.u26.before")}</dt><dd>{data().snapshot.change.before.length}</dd>
                  <dt>{t("sf.u26.after")}</dt><dd>{data().snapshot.change.after.length}</dd>
                </dl>
                <Show when={data().signal}>{(signal) => (
                  <p role="status">{t("sf.u26.severity")}: {signal().severity} · {signal().reason}</p>
                )}</Show>
                <p>{t("sf.u26.causality")}</p>
                <p class="sf-memory-help">{t("sf.u26.selectionRequired")}</p>
              </section>
            )}</Show>
          </SfStatePanel>
        </Show>
        <Show when={privacy() === "ready" && props.surfaceId === "UI63" && view.selectedChoice}>
          <SfStatePanel state={view.detailState === "idle" ? "loading" : view.detailState}
            messageKey={k(detailMessage())}
            onRetryRead={() => void readOutcome(view.selectedChoice)}>
            <Show when={view.outcome}>{(data) => (
              <section class="sf-memory-section" data-sf-memory-outcome>
                <h2>{t("sf.ui63.title")}</h2>
                <dl class="sf-memory-facts">
                  <dt>{t("sf.u26.choice")}</dt><dd>{data().choiceId}</dd>
                  <dt>{t("sf.u26.expected")}</dt><dd>{data().expected} {data().currency || data().unit}</dd>
                  <dt>{t("sf.u26.observed")}</dt><dd>{data().observed} {data().currency || data().unit}</dd>
                  <dt>{t("sf.u26.delta")}</dt><dd>{data().delta}</dd>
                  <dt>{t("sf.u26.cutoff")}</dt><dd>{data().cutoff}</dd>
                  <dt>{t("sf.u26.period")}</dt><dd>{data().period.start} – {data().period.end}</dd>
                  <dt>{t("sf.u26.coverage")}</dt><dd>{data().compatibility.coverage}</dd>
                  <dt>{t("sf.u26.source")}</dt><dd>{data().sourceRefs.map((ref) => ref.refId).join(", ")}</dd>
                  <dt>{t("sf.u26.history")}</dt><dd>{data().baselineRefs.map((ref) => ref.refId).join(", ")}</dd>
                </dl>
                <Show when={!data().compatibility.compatible}><p role="alert">{t("sf.u26.incompatible")}</p></Show>
                <h3>{t("sf.u26.known")}</h3><ul><For each={data().summary.facts}>{(fact) => <li>{fact}</li>}</For></ul>
                <h3>{t("sf.u26.pending")}</h3><ul><For each={data().summary.pending}>{(item) => <li>{item}</li>}</For></ul>
                <h3>{t("sf.u26.limitations")}</h3><ul><For each={data().limitations}>{(item) => <li>{item}</li>}</For></ul>
                <p>{t("sf.u26.causality")}</p>
              </section>
            )}</Show>
          </SfStatePanel>
        </Show>
      </section>
    </SfPageFrame>
  )
}
