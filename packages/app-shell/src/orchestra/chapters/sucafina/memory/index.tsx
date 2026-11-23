import { For, Show, createEffect, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { SF_U26_COPY } from "@/i18n/orchestra-chapters/sf-u26"
import { createSfMemoryClient } from "@orchestra/client/sucafina/memory"
import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import { SfMemory } from "@orchestra/schema/sucafina/memory"
import { useSfContext } from "../context"
import type { SfSurfaceProps } from "../context/contracts"
import { SfPageFrame } from "../shared/frame"
import type { SfCopyKey, SfUiState } from "../shared/frame"
import { SfStatePanel } from "../shared/states"
import { SfSimilarCasesView } from "./similar-cases"
import { SfMemoryCasePicker } from "./case-picker"
import "./memory.css"

type Conditions = Extract<typeof SfMemory.operations["intelligence.memory-conditions"]["output"]["Type"], { status: "ok" }>["value"]
type Signals = Extract<typeof SfMemory.operations["intelligence.memory-signals"]["output"]["Type"], { status: "ok" }>["signals"]
type Material = Extract<typeof SfMemory.operations["intelligence.memory-materiality"]["output"]["Type"], { status: "ok" }>
type Outcome = Extract<typeof SfMemory.operations["intelligence.memory-outcome"]["output"]["Type"], { status: "comparable" }>
type CaseQuery = { caseId: string; incarnation: string; version: number }
type RecordedChoice = { id: string; title: string; reason: string; at: string }
type ReadState = "idle" | SfUiState
type MemoryViewState = {
  caseId: string; incarnation: string; versionText: string
  active: CaseQuery | null
  catalog: readonly string[]
  conditions: Conditions
  choices: readonly RecordedChoice[]
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

const EMPTY: Pick<MemoryViewState, "active" | "catalog" | "conditions" | "choices" | "signals" | "selectedCondition" | "selectedChoice" | "material" | "outcome" | "listState" | "detailState" | "catalogState" | "message"> = {
  active: null, catalog: [], conditions: [], choices: [], signals: [], selectedCondition: "", selectedChoice: "",
  material: null, outcome: null, listState: "idle", detailState: "idle", catalogState: "idle", message: null,
}

/**
 * U26 / UI61–UI63. UI61/UI63 retain the seven A14 memory operations and use
 * the admitted C09 case catalogue for selection. UI63 reads recorded choices
 * from the original case projection; a signal condition is not a prerequisite.
 * UI62 delegates to the typed
 * CaseRecall consumer. No new authority or server admission is derived here.
 */
export function SfMemoryView(props: SfSurfaceProps): import("solid-js").JSX.Element {
  // UI62 has a real C09/C17 producer and its own owner-fenced typed consumer.
  // The picker and recorded choices use C09; memory results remain original A14 reads.
  if (props.surfaceId === "UI62") return <SfSimilarCasesView {...(props as SfSurfaceProps<"UI62">)} />
  const owner = useSfContext()
  const language = useLanguage()
  const k = (value: keyof typeof SF_U26_COPY | "sf.common.loading" | "sf.common.empty" |
    "sf.common.unavailable" | "sf.common.noAccess" | "sf.common.partial" |
    "sf.common.filterEmpty" | "sf.common.stale" | "sf.common.invalidLink" |
    "sf.common.loginAgain" | "sf.common.retry" | "sf.common.currentSource") => value as SfCopyKey
  const t = (value: keyof typeof SF_U26_COPY) => language.t(value as Parameters<typeof language.t>[0])
  const closed = (prefix: "sf.u26.impactState" | "sf.u26.severityValue" | "sf.u26.availability" | "sf.u26.coverage", value: string) => {
    const name = `${prefix}.${value}` as keyof typeof SF_U26_COPY
    return name in SF_U26_COPY ? t(name) : t("sf.u26.unknown")
  }
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
    const signal = catalogAbort.signal
    setView("catalogState", "loading")
    void createSfMemoryClient(ready.transport)["intelligence.memory-catalog"](undefined, { signal })
      .then((result) => {
        if (signal.aborted || generation !== owner.generation() || !owner.ready()) return
        if (result.kind === "response" && result.body.status === "ok") {
          setView("catalog", result.body.value)
          setView("catalogState", "ready")
          return
        }
        setView("catalogState", stateFrom(result))
      })
      .catch(() => {
        if (!signal.aborted && generation === owner.generation() && owner.ready()) setView("catalogState", "unavailable")
      })
  })
  onCleanup(() => { requestEpoch += 1; listAbort?.abort(); detailAbort?.abort(); catalogAbort?.abort() })

  const changeCase = (field: "caseId" | "incarnation" | "versionText", value: string) => {
    requestEpoch += 1
    listAbort?.abort()
    detailAbort?.abort()
    setView({ active: null, conditions: [], choices: [], signals: [], material: null, outcome: null,
      selectedCondition: "", selectedChoice: "", listState: "idle", detailState: "idle", message: null })
    setView(field, value)
  }

  const parsedCase = (): CaseQuery | null => {
    const version = Number(view.versionText)
    return view.caseId.trim() && view.incarnation.trim() && /^\d+$/.test(view.versionText) &&
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
      active: caseRef, conditions: [], choices: [], signals: [], material: null, outcome: null,
      selectedCondition: "", selectedChoice: "", listState: "loading", detailState: "idle", message: null,
    })
    if (props.surfaceId === "UI63") {
      // Outcomes belong to recorded choices, including choices with no signal condition.
      // The original C09 reader enforces current per-case authority and the F02 stamp.
      if (!ready.context.availability.some((entry) => entry.operations.some((operation) =>
        operation.operationId === "projection.case" && operation.state === "ready" && operation.operational))) {
        setView("listState", "unavailable")
        return
      }
      const result = await createSfDecisionsClient(ready.transport)["projection.case"]({
        caseRef: "case:" + encodeURIComponent(caseRef.caseId) + ":" + encodeURIComponent(caseRef.incarnation),
      }, { signal }).catch(() => undefined)
      if (!current(epoch, generation, signal) || owner.ready() !== ready) return
      if (result?.kind !== "response" || result.body.status !== "ok") {
        setView({ choices: [], listState: result ? stateFrom(result) : "unavailable" })
        if (result?.kind === "response" && result.body.status === "denied") setView("active", null)
        return
      }
      const original = result.body.value.projection.case
      if (original.id !== caseRef.caseId || original.incarnation !== caseRef.incarnation ||
          original.version !== caseRef.version) {
        setView("listState", "stale")
        return
      }
      if (original.choices.some((choice) => !choice.id.trim()) ||
          new Set(original.choices.map((choice) => choice.id)).size !== original.choices.length) {
        setView("listState", "unavailable")
        return
      }
      const choices = original.choices.map((choice) => ({
        id: choice.id,
        title: original.alternatives.find((alternative) =>
          alternative.id === choice.alternativeId && alternative.version === choice.alternativeVersion)?.title || choice.id,
        reason: choice.reason,
        at: choice.at,
      }))
      setView({ choices, listState: choices.length ? "ready" : "empty" })
      return
    }
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
      if (result.body.snapshot.condition.id !== conditionId || result.body.scope.choiceId !== view.conditions.find((item) => item.conditionId === conditionId)?.choiceId) {
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
    if (!ready || !caseRef || !view.choices.some((item) => item.id === choiceId)) return
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
  const referenceRoute = () => props.surfaceId === "UI63" && props.route.kind === "entry"
    ? props.route.params.selectionRef : undefined
  const readReference = async (selectionRef: string) => {
    const ready = owner.ready()
    if (!ready) return
    detailAbort?.abort()
    const controller = new AbortController()
    detailAbort = controller
    const epoch = ++requestEpoch
    const generation = owner.generation()
    setView({ selectedChoice: "", material: null, outcome: null, detailState: "loading" })
    if (!/^[a-f0-9]{64}$/.test(selectionRef)) {
      setView("detailState", "invalid")
      return
    }
    const result = await createSfMemoryClient(ready.transport)["intelligence.memory-outcome"](
      { selectionRef }, { signal: controller.signal },
    ).catch(() => undefined)
    if (!current(epoch, generation, controller.signal) || referenceRoute() !== selectionRef) return
    if (result?.kind === "response" && result.body.status === "comparable") {
      setView({ outcome: result.body, detailState: "ready" })
      return
    }
    setView("detailState", result ? stateFrom(result) : "unavailable")
  }
  createEffect(() => {
    const selectionRef = referenceRoute()
    owner.generation()
    const active = owner.ready()
    if (!selectionRef || !active) return
    void readReference(selectionRef)
    onCleanup(() => detailAbort?.abort())
  })
  const choiceDate = (value: string) => {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(language.intl(), {
      dateStyle: "medium", timeStyle: "short",
    }).format(parsed)
  }
  // UI62 is delegated to SfSimilarCasesView in the early return above; these branches are UI61/UI63 only.
  const title = () => props.surfaceId === "UI63" ? "sf.ui63.title" : "sf.ui61.title"
  const detailMessage = (): keyof typeof SF_U26_COPY | "sf.common.loading" | "sf.common.unavailable" | "sf.common.noAccess" | "sf.common.stale" | "sf.common.invalidLink" =>
    view.detailState === "loading" ? "sf.common.loading" :
    view.detailState === "denied" ? "sf.common.noAccess" :
    view.detailState === "stale" ? "sf.common.stale" :
    view.detailState === "invalid" ? "sf.common.invalidLink" : "sf.common.unavailable"
  const pageState = (): SfUiState =>
    privacy() !== "ready" ? privacy() :
    view.listState === "idle" ? "ready" :
    view.listState === "loading" ? "loading" : view.listState
  const pageMessage = () => privacy() === "denied" ? "sf.common.noAccess" :
    privacy() === "session-expired" ? "sf.common.loginAgain" :
    privacy() === "loading" || view.listState === "loading" ? "sf.common.loading" :
    view.listState === "empty" ? "sf.common.empty" :
    view.listState === "denied" ? "sf.common.noAccess" :
    view.listState === "partial" ? "sf.common.partial" :
    view.listState === "invalid" ? "sf.u26.invalidCase" :
    view.listState === "stale" ? "sf.common.stale" : "sf.common.unavailable"
  return (
    <SfPageFrame titleKey={k(title())} subtitleKey={k(props.surfaceId === "UI63" ? "sf.u26.outcomesDescription" : "sf.u26.signalsDescription")} context={[]} tabs={[]} activeTab={null} secondaryActions={[]}
      density="comfortable" layout="reading" onLayoutMode={() => undefined}>
      <section class="sf-memory sf-workflow" data-sf-wave="six" data-sf-surface={props.surfaceId}>
        <Show when={privacy() === "ready" && !referenceRoute()}>
          <form class="sf-memory-form sf-form" onSubmit={(event) => { event.preventDefault(); void loadCase() }}>
            <header class="sf-memory-section-heading">
              <h2>{t("sf.u26.authorizedCase")}</h2>
              <p class="sf-memory-help">{t("sf.u26.noCase")}</p>
            </header>
            <SfMemoryCasePicker current={parsedCase()} onSelect={(choice) => {
              changeCase("caseId", choice?.caseId ?? "")
              setView({ incarnation: choice?.incarnation ?? "", versionText: choice ? String(choice.version) : "" })
            }} />
            <details class="sf-memory-reference">
              <summary>{t("sf.u26.caseReference")}</summary>
              <p class="sf-memory-help">{t("sf.u26.caseHelp")}</p>
              <div class="sf-memory-reference-fields">
                <label>{t("sf.u26.caseId")}<input autocomplete="off" value={view.caseId}
                  onInput={(event) => changeCase("caseId", event.currentTarget.value)} /></label>
                <label>{t("sf.u26.incarnation")}<input autocomplete="off" value={view.incarnation}
                  onInput={(event) => changeCase("incarnation", event.currentTarget.value)} /></label>
                <label>{t("sf.u26.version")}<input type="number" min="1" step="1" value={view.versionText}
                  onInput={(event) => changeCase("versionText", event.currentTarget.value)} /></label>
              </div>
            </details>
            <div class="sf-memory-actions">
              <button class="mx-btn primary" type="submit" disabled={!parsedCase() || view.listState === "loading"}>
                {t("sf.u26.openCase")}
              </button>
              <Show when={view.active}><button class="mx-btn" type="button" disabled={view.listState === "loading"}
                onClick={() => void loadCase(view.active!)}>{t("sf.u26.refresh")}</button></Show>
            </div>
          </form>
        </Show>
        <SfStatePanel state={pageState()} messageKey={k(pageMessage())}
          onRetryRead={view.active && privacy() === "ready" ? () => void loadCase(view.active!) : undefined}>
          <Show when={view.active}>
            <Show when={props.surfaceId === "UI63"}>
              <section class="sf-memory-section sf-section">
                <h2>{t("sf.u26.recordedChoices")}</h2>
                <p class="sf-memory-help">{t("sf.u26.selectChoice")}</p>
                <Show when={view.choices.length} fallback={<p>{t("sf.u26.noChoices")}</p>}>
                  <ul class="sf-memory-list">
                    <For each={view.choices}>{(choice) => (
                      <li data-sf-memory-choice={choice.id} data-selected={view.selectedChoice === choice.id}>
                        <div>
                          <strong>{choice.title}</strong>
                          <small>{t("sf.u26.recordedAt")}: <time dateTime={choice.at}>{choiceDate(choice.at)}</time></small>
                          <Show when={choice.reason}><p>{choice.reason}</p></Show>
                        </div>
                        <button type="button" class="mx-btn" aria-expanded={view.selectedChoice === choice.id}
                          onClick={() => void readOutcome(choice.id)}>{t("sf.u26.outcomeDetail")}</button>
                      </li>
                    )}</For>
                  </ul>
                </Show>
              </section>
            </Show>
            <Show when={props.surfaceId === "UI61"}>
              <section class="sf-memory-section sf-section">
                <h2>{t("sf.u26.conditions")}</h2>
                <Show when={view.conditions.length} fallback={<p>{t("sf.u26.noConditions")}</p>}>
                  <ul class="sf-memory-list">
                    <For each={view.conditions}>{(condition) => (
                      <li data-selected={view.selectedCondition === condition.conditionId} data-sf-condition-id={condition.conditionId} data-sf-choice-id={condition.choiceId}>
                        <div><strong>{condition.label}</strong>
                          <small>{t("sf.u26.criterion")}: {condition.criterionId} · {t("sf.u26.period")}: {condition.period.start} – {condition.period.end}</small>
                        </div>
                        <button type="button" class="mx-btn" aria-expanded={view.selectedCondition === condition.conditionId}
                          onClick={() => void readMateriality(condition.conditionId)}>{t("sf.u26.conditionDetail")}</button>
                      </li>
                    )}</For>
                  </ul>
                </Show>
              </section>
              <section class="sf-memory-section sf-section">
                <h2>{t("sf.u26.signals")}</h2>
                <Show when={view.signals.length} fallback={<p>{t("sf.u26.noSignals")}</p>}>
                  <ul class="sf-memory-list">
                    <For each={view.signals}>{(signal) => <li>
                      <div><strong>{signal.label}</strong>
                        <small>{t("sf.u26.materiality")}: {closed("sf.u26.impactState", signal.impact.state)} · {t("sf.u26.action")}: {t(signal.action === "open" ? "sf.u26.actionOpen" : signal.action === "update" ? "sf.u26.actionUpdate" : "sf.u26.actionNone")}</small>
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
              <section class="sf-memory-section sf-section" data-sf-memory-materiality>
                <h2>{t("sf.u26.materiality")}</h2>
                <dl class="sf-memory-facts">
                  <dt>{t("sf.u26.condition")}</dt><dd>{data().snapshot.condition.id}</dd>
                  <dt>{t("sf.u26.impact")}</dt><dd>{closed("sf.u26.impactState", data().impact.state)}</dd>
                  <dt>{t("sf.u26.reason")}</dt><dd>{data().impact.reason}</dd>
                  <dt>{t("sf.u26.source")}</dt><dd>{data().scope.source.type}: {data().scope.source.id}</dd>
                  <dt>{t("sf.u26.version")}</dt><dd>{data().scope.source.version}</dd>
                  <dt>{t("sf.u26.period")}</dt><dd>{data().scope.period.start} – {data().scope.period.end}</dd>
                  <dt>{t("sf.u26.fields")}</dt><dd>{data().scope.fields.join(", ")}</dd>
                  <dt>{t("sf.u26.observedAt")}</dt><dd>{data().scope.source.observedAt}</dd>
                  <dt>{t("sf.u26.changed")}</dt><dd>{closed("sf.u26.availability", data().snapshot.change.availability)}</dd>
                  <dt>{t("sf.u26.before")}</dt><dd>{data().snapshot.change.before.length}</dd>
                  <dt>{t("sf.u26.after")}</dt><dd>{data().snapshot.change.after.length}</dd>
                </dl>
                <Show when={data().signal}>{(signal) => (
                  <p role="status">{t("sf.u26.severity")}: {closed("sf.u26.severityValue", signal().severity)} · {signal().reason}</p>
                )}</Show>
                <p>{t("sf.u26.causality")}</p>
                <p class="sf-memory-help">{t("sf.u26.selectionRequired")}</p>
              </section>
            )}</Show>
          </SfStatePanel>
        </Show>
        <Show when={privacy() === "ready" && props.surfaceId === "UI63" && (view.selectedChoice || referenceRoute())}>
          <SfStatePanel state={view.detailState === "idle" ? "loading" : view.detailState}
            messageKey={k(detailMessage())}
            onRetryRead={() => { const selectionRef = referenceRoute(); if (selectionRef) void readReference(selectionRef); else void readOutcome(view.selectedChoice) }}>
            <Show when={view.outcome}>{(data) => (
              <section class="sf-memory-section sf-section" data-sf-memory-outcome>
                <h2>{t("sf.ui63.title")}</h2>
                <div class="sf-memory-comparison" aria-label={t("sf.ui63.title")}>
                  <div><span>{t("sf.u26.expected")}</span><strong data-sf-memory-expected>{data().expected} <small>{data().currency || data().unit}</small></strong></div>
                  <div><span>{t("sf.u26.observed")}</span><strong data-sf-memory-observed>{data().observed} <small>{data().currency || data().unit}</small></strong></div>
                  <div><span>{t("sf.u26.delta")}</span><strong data-sf-memory-delta>{data().delta}</strong></div>
                </div>
                <dl class="sf-memory-facts">
                  <dt>{t("sf.u26.choice")}</dt><dd>{data().choiceId}</dd>
                  <dt>{t("sf.u26.cutoff")}</dt><dd>{data().cutoff}</dd>
                  <dt>{t("sf.u26.period")}</dt><dd>{data().period.start} – {data().period.end}</dd>
                  <dt>{t("sf.u26.coverage")}</dt><dd>{closed("sf.u26.coverage", data().compatibility.coverage)}</dd>
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
