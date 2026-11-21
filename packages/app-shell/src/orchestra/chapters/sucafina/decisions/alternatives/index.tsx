import { A } from "@solidjs/router"
import { createEffect, createMemo, createSignal, For, on, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import type { Schema } from "effect"
import { useLanguage } from "@/context/language"
import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import { SfDecisions } from "@orchestra/schema/sucafina/decisions"
import { SfPageFrame, type SfCopyKey, type SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import type { SfSurfaceProps } from "../../context/contracts"
import { useSfCase, sfContextUiState, sfFailureUiState, sfOperationReady } from "../cases/model"
import { sfDecisionHref } from "../cases/route"
import "../cases/n24.css"
import { SfNumericRule } from "./numeric-rule"
import { SfRecordChoice } from "./record-choice"

type ChoiceEnvelope = Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.choice.read"]["output"]>
type ChoiceValue = Extract<ChoiceEnvelope, { status: "ok" }>["value"]
type ReviewEnvelope = Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.current-choice-prepare"]["output"]>
type ReviewValue = Extract<ReviewEnvelope, { status: "ok" }>["value"]
const comparisonOperation = "decisions.decision-compare"
type ComparisonEnvelope = Schema.Schema.Type<(typeof SfDecisions.operations)[typeof comparisonOperation]["output"]>
type ComparisonValue = Extract<ComparisonEnvelope, { status: "ok" }>["value"]
const k = (value: string) => value as SfCopyKey

/** UI35: source-backed comparison and explicit human choice recording. */
export function SfAlternativesView(props: SfSurfaceProps): JSX.Element {
  const language = useLanguage()
  const t = (value: string) => language.t(value as Parameters<typeof language.t>[0])
  const valid = () => props.surfaceId === "UI35"
  const route = () => valid() ? props.route as SfSurfaceProps<"UI35">["route"] : undefined
  const sourceRef = () => {
    if (props.surfaceId !== "UI35") return ""
    return String(props.route.params.caseRef)
  }
  const caseData = useSfCase(sourceRef)
  const [ui, setUi] = createStore<{
    selection: readonly string[]
    choices?: ChoiceValue
    choicesCase?: string
    choicesState: SfUiState
    choiceReview?: ReviewValue
    reviewState: SfUiState
    readSequence: number
  }>({ selection: [], choicesState: "loading", reviewState: "empty", readSequence: 0 })
  const caseRecord = () => caseData.read.projection?.case
  const selectedPair = createMemo(() => {
    const record = caseRecord()
    if (caseData.read.state !== "ready" || !record || !sameRouteCase(sourceRef(), record.id, record.incarnation) ||
        route()?.kind === "detail" || ui.selection.length !== 2) return
    const [baseline, alternative] = ui.selection.map((id) => record.alternatives.filter((item) => item.id === id))
    if (baseline?.length !== 1 || alternative?.length !== 1 || baseline[0]!.id === alternative[0]!.id) return
    return [baseline[0]!, alternative[0]!] as const
  })
  const comparisonTarget = createMemo(() => {
    const active = caseData.owner.ready()
    const generation = caseData.owner.generation()
    const refresh = caseData.read.refresh
    const pair = selectedPair()
    const record = caseRecord()
    if (!active || !pair || !record?.criteria.length || !sfOperationReady(active.context, comparisonOperation)) return
    return { active, generation, refresh, input: {
      caseRef: { id: record.id, incarnation: record.incarnation, version: record.version },
      baselineAlternativeId: pair[0].id,
      alternativeId: pair[1].id,
      criteria: record.criteria.map((item) => item.id),
    } }
  })
  const [comparison, setComparison] = createSignal<{
    target: NonNullable<ReturnType<typeof comparisonTarget>>
    abort: AbortController
    state: SfUiState
    value?: ComparisonValue
  }>()
  const currentComparison = () => {
    const run = comparison()
    return run?.target === comparisonTarget() ? run : undefined
  }
  createEffect(on([sourceRef, caseData.owner.generation, () => route()?.kind], () => setUi("selection", [])))
  createEffect(on(comparisonTarget, (target) => {
    const run = comparison()
    if (run && run.target !== target) {
      run.abort.abort()
      setComparison(undefined)
    }
  }))
  onCleanup(() => comparison()?.abort.abort())

  const compare = async () => {
    const target = comparisonTarget()
    if (!target || currentComparison()?.state === "loading") return
    const abort = new AbortController()
    setComparison({ target, abort, state: "loading" })
    const stillCurrent = () => !abort.signal.aborted && currentComparison()?.abort === abort
    try {
      const result = await createSfDecisionsClient(target.active.transport)[comparisonOperation](target.input, { signal: abort.signal })
      if (!stillCurrent()) return
      if (result.kind === "transport-error") {
        setComparison({ target, abort, state: "unavailable" })
        return
      }
      if (result.body.status !== "ok") {
        setComparison({ target, abort, state: sfFailureUiState(result.body.status, result.status) })
        return
      }
      const value = result.body.value
      if (result.status !== 200 || value.request.scenarioRefs.length !== 2 ||
          value.request.scenarioRefs[0] === value.request.scenarioRefs[1] ||
          value.request.scenarioRefs[0] !== value.comparison.baselineResultRef ||
          value.request.scenarioRefs[1] !== value.comparison.alternativeResultRef ||
          value.request.criteria.length !== target.input.criteria.length ||
          value.request.criteria.some((id, index) => id !== target.input.criteria[index])) {
        setComparison({ target, abort, state: "stale" })
        return
      }
      setComparison({ target, abort, state: "ready", value })
    } catch {
      if (stillCurrent()) setComparison({ target, abort, state: "unavailable" })
    }
  }

  const displayed = () => {
    const alternatives = caseRecord()?.alternatives ?? []
    const currentRoute = route()
    if (currentRoute?.kind === "detail") {
      const focus = String(currentRoute.params.alternativeRef)
      return alternatives.filter((item) => item.id === focus)
    }
    return currentComparison() ? selectedPair() ?? alternatives : alternatives
  }

  const routeCase = () => sourceRef()
  const matchesCurrentCase = (ref: NonNullable<ChoiceValue["selected"]>["caseRef"]) => {
    const record = caseRecord()
    return caseData.read.state === "ready" && !!record && sameRouteCase(routeCase(), ref.id, ref.incarnation) &&
      ref.id === record.id && ref.incarnation === record.incarnation && ref.version === record.version
  }
  const choicesForRoute = () => {
    if (ui.choicesState !== "ready" || ui.choicesCase !== routeCase()) return undefined
    const selected = ui.choices?.selected
    if (!selected || !matchesCurrentCase(selected.caseRef)) return undefined
    return selected
  }
  const choicePanelState = (): SfUiState => {
    if (ui.choicesState !== "ready") return ui.choicesState
    if (ui.choicesCase !== routeCase()) return "stale"
    const selected = ui.choices?.selected
    if (selected && !matchesCurrentCase(selected.caseRef)) return "stale"
    return selected ? "ready" : "empty"
  }
  createEffect(() => {
    const active = caseData.owner.ready()
    const ownerStatus = caseData.owner.state().status
    const current = sourceRef()
    const generation = caseData.owner.generation()
    const refresh = ui.readSequence
    const blocked = !active && (ownerStatus === "unauthenticated" || ownerStatus === "denied")
      ? sfContextUiState(ownerStatus)
      : undefined
    setUi({
      choices: undefined, choicesCase: undefined,
      choicesState: active ? "loading" : blocked ?? "unavailable",
      choiceReview: undefined, reviewState: blocked ?? "empty",
    })
    if (!active || !current || !sfOperationReady(active.context, "decisions.choice.read")) return
    const abort = new AbortController()
    onCleanup(() => abort.abort())
    void createSfDecisionsClient(active.transport)["decisions.choice.read"](
      { case: current }, { signal: abort.signal },
    ).then((result) => {
      if (abort.signal.aborted || caseData.owner.generation() !== generation || sourceRef() !== current) return
      if (result.kind === "transport-error") {
        setUi({ choices: undefined, choicesCase: undefined, choicesState: "unavailable" })
        return
      }
      if (result.body.status !== "ok") {
        const failure = sfFailureUiState(result.body.status, result.status)
        setUi({
          choices: undefined, choicesCase: undefined, choicesState: failure, choiceReview: undefined,
          ...(failure === "denied" || failure === "session-expired" ? { reviewState: failure } : {}),
        })
        return
      }
      const selected = result.body.value.selected
      if (selected && !sameRouteCase(current, selected.caseRef.id, selected.caseRef.incarnation)) {
        setUi({ choices: undefined, choicesCase: undefined, choicesState: "stale" })
        return
      }
      setUi({ choices: result.body.value, choicesCase: current, choicesState: "ready" })
    }).catch((error: unknown) => {
      if (abort.signal.aborted) return
      console.error("Sucafina choice projection failed", error)
      setUi({ choices: undefined, choicesCase: undefined, choicesState: "unavailable" })
    })
    void refresh
  })

  const select = (ref: string) => {
    const present = ui.selection.includes(ref)
    setUi({ selection: present ? ui.selection.filter((item) => item !== ref) :
      [...ui.selection.slice(-1), ref], choiceReview: undefined })
  }
  const prepare = async (choiceId: string) => {
    const requestedCase = routeCase()
    const current = choicesForRoute()?.choices.find((item) => item.id === choiceId)
    const active = caseData.owner.ready()
    if (!current?.request || !matchesCurrentCase(current.request.caseRef) || !active ||
      !sfOperationReady(active.context, "decisions.current-choice-prepare") ||
      ui.reviewState === "loading" || ui.reviewState === "outcome-unknown") return
    const ticket = caseData.owner.generation()
    setUi({ reviewState: "loading", choiceReview: undefined })
    const abort = new AbortController()
    try {
      const result = await createSfDecisionsClient(active.transport)["decisions.current-choice-prepare"](
        current.request, { signal: abort.signal, idempotencyKey: crypto.randomUUID() },
      )
      if (sourceRef() !== requestedCase) return
      if (result.kind === "response" && result.body.status !== "ok") {
        const failure = sfFailureUiState(result.body.status, result.status)
        if (failure === "denied" || failure === "session-expired") {
          setUi({
            choices: undefined, choicesCase: undefined, choicesState: failure,
            choiceReview: undefined, reviewState: failure,
          })
          return
        }
      }
      if (caseData.owner.generation() !== ticket || !caseData.owner.ready()) return
      if (result.kind === "transport-error") {
        setUi({ reviewState: "outcome-unknown", choiceReview: undefined })
        return
      }
      if (result.body.status !== "ok") {
        setUi({ reviewState: sfFailureUiState(result.body.status, result.status), choiceReview: undefined })
        return
      }
      const review = result.body.value
      if (!matchesCurrentCase(review.promotion.caseRef) || review.promotion.choiceId !== choiceId) {
        setUi({ reviewState: "stale", choiceReview: undefined })
        return
      }
      setUi({ choiceReview: review, reviewState: "ready" })
    } catch (error) {
      if (sourceRef() !== requestedCase) return
      console.error("Sucafina current-choice comparison failed", error)
      setUi({ reviewState: "outcome-unknown", choiceReview: undefined })
    }
  }
  const amount = (value: number | null) => value === null ? t("sf.ui35.missing") : String(value)
  const difference = (value: number | null) => value === null ? amount(value) : `${amount(value)} ${selectedPair()?.[0].result.currency ?? ""}`
  const canReview = () => {
    const active = caseData.owner.ready()
    const selected = choicesForRoute()
    return !!active && !!selected?.choices.some((choice) => choice.request && matchesCurrentCase(choice.request.caseRef)) &&
      sfOperationReady(active.context, "decisions.current-choice-prepare")
  }
  return (
    <SfPageFrame
      titleKey={k("sf.ui35.title")}
      context={[]}
      tabs={[]}
      activeTab={null}
      density="comfortable"
      layout="comparison"
      onLayoutMode={() => undefined}
      primaryAction={{
        id: "compare-alternatives", labelKey: k("sf.ui35.primary"), tone: "primary",
        disabled: !comparisonTarget() || currentComparison()?.state === "loading",
        busy: currentComparison()?.state === "loading", onInvoke: () => void compare(),
      }}
      secondaryActions={[{
        id: "refresh-alternatives", labelKey: k("sf.ui35.reload"), tone: "secondary",
        disabled: caseData.read.state === "loading", busy: false,
        onInvoke: () => { caseData.reload(); setUi("readSequence", (value) => value + 1) },
      }]}
    >
      <div class="sf-n24">
        <Show when={route()}>
          {(current) => <A class="mx-btn" href={sfDecisionHref(current(), "case", sourceRef())}>{t("sf.ui35.return")}</A>}
        </Show>
        <Show when={caseData.read.state === "ready" && caseRecord()} fallback={
          <SfStatePanel state={caseData.read.state}
            messageKey={k(caseData.read.state === "loading" ? "sf.ui35.reading" : "sf.ui35.unavailable")}
            onRetryRead={() => caseData.reload()} />
        }>
          {(record) => <>
            <Show when={route()?.kind === "new"}>
              <p role="status" class="sf-n24-status">{t("sf.ui35.newUnavailable")}</p>
            </Show>
            <Show when={ui.reviewState !== "session-expired" && ui.choicesState !== "session-expired"} fallback={
              <SfStatePanel state="session-expired" messageKey={k("sf.common.loginAgain")} />
            }>
            <Show when={record().alternatives.length} fallback={<SfStatePanel state="empty" messageKey={k("sf.ui35.noItems")} />}>
              <div class="sf-n24-compare">
                <For each={displayed()}>
                  {(alternative) => {
                    const result = alternative.result
                    const chosen = () => ui.selection.includes(alternative.id)
                    return <article class="sf-n24-compare-card" aria-current={chosen() ? "true" : undefined}>
                      <h2><bdi>{alternative.title}</bdi></h2>
                      <p>{t("sf.ui35.version")}: {alternative.version}</p>
                      <Show when={selectedPair()?.[0].id === alternative.id}>
                        <p>{t("sf.u19.sensitivity.baseline")}</p>
                      </Show>
                      <button class="mx-btn" type="button" aria-pressed={chosen()}
                        onClick={() => select(alternative.id)}>{t("sf.ui35.choose")}</button>
                      <section aria-label={t("sf.ui35.result")}>
                        <h3>{t("sf.ui35.result")}</h3>
                        <dl>
                          <dt>{t(result.comparisonStatus === "complete" ? "sf.ui35.total" : "sf.ui35.knownSubtotal")}</dt>
                          <dd><bdi>{amount(result.comparisonStatus === "complete" ? result.total : result.knownSubtotal)} {result.currency}</bdi></dd>
                          <dt>{t("sf.ui35.status")}</dt><dd><bdi>{result.comparisonStatus}</bdi></dd>
                          <dt>{t("sf.ui35.coverage")}</dt><dd><bdi>{result.costCoverage.coverageState}</bdi></dd>
                          <dt>{t("sf.ui35.basis")}</dt><dd><bdi>{result.costCoverage.basisId}</bdi> · {result.costCoverage.basisVersion}</dd>
                          <dt>{t("sf.ui35.horizon")}</dt><dd>{result.horizon.start} – {result.horizon.end}</dd>
                        </dl>
                      </section>
                      <Show when={result.costCoverage.derivedMissingCategoryIds.length}>
                        <h3>{t("sf.ui35.categories")}</h3>
                        <ul class="sf-n24-list"><For each={result.costCoverage.derivedMissingCategoryIds}>{(value) => <li><bdi>{value}</bdi></li>}</For></ul>
                      </Show>
                      <Show when={result.costCoverage.issues.length}>
                        <h3>{t("sf.ui35.issues")}</h3>
                        <ul class="sf-n24-list"><For each={result.costCoverage.issues}>{(value) => <li><bdi>{value}</bdi></li>}</For></ul>
                      </Show>
                      <Show when={result.unresolvedConditions.length}>
                        <h3>{t("sf.ui35.conditions")}</h3>
                        <ul class="sf-n24-list"><For each={result.unresolvedConditions}>{(value) => <li><bdi>{value}</bdi></li>}</For></ul>
                      </Show>
                      <Show when={result.restrictions.length}>
                        <h3>{t("sf.ui35.restrictions")}</h3>
                        <ul class="sf-n24-list"><For each={result.restrictions}>{(value) => <li><bdi>{value}</bdi></li>}</For></ul>
                      </Show>
                      <details>
                        <summary>{t("sf.ui35.sources")}</summary>
                        <ul class="sf-n24-list"><For each={result.sourceRefs}>{(source) => <li><bdi>{source.refId}</bdi></li>}</For></ul>
                      </details>
                      <details>
                        <summary>{t("sf.ui35.assumptions")}</summary>
                        <ul class="sf-n24-list"><For each={alternative.scenario.assumptions}>{(assumption) =>
                          <li><bdi>{assumption.id}</bdi>: <bdi>{assumption.value === null ? t("sf.ui35.missing") : String(assumption.value)}</bdi> · <bdi>{assumption.state}</bdi></li>}</For></ul>
                      </details>
                    </article>
                  }}
                </For>
              </div>
              <Show when={selectedPair() && !comparisonTarget()}>
                <p role="status">{t("sf.ui35.error")}</p>
              </Show>
              <Show when={currentComparison()}>
                {(run) => <section class="mx-card sf-n24-section" aria-label={t("sf.u22.chart.comparison")} aria-live="polite">
                  <h2>{t("sf.u22.chart.comparison")}</h2>
                  <SfStatePanel state={run().state} messageKey={k(
                    run().state === "loading" ? "sf.ui35.prepareBusy" :
                    run().state === "denied" ? "sf.common.noAccess" :
                    run().state === "session-expired" ? "sf.common.loginAgain" : "sf.ui35.error"
                  )}>
                    <Show when={run().value?.comparison}>
                      {(result) => <>
                        <dl>
                          <dt>{t("sf.ui35.status")}</dt><dd><bdi>{result().comparisonStatus}</bdi></dd>
                          <dt>{t("sf.u26.delta")} ({t("sf.ui35.knownSubtotal")})</dt>
                          <dd><bdi>{difference(result().knownDifference)}</bdi></dd>
                          <dt>{t("sf.u26.delta")} ({t("sf.ui35.total")})</dt>
                          <dd><bdi>{difference(result().completeDifference)}</bdi></dd>
                        </dl>
                        <Show when={result().comparisonStatus !== "complete"}>
                          <p role="status">{t("sf.ui35.incompatible")}</p>
                        </Show>
                        <Show when={result().criterionResults.length}>
                          <h3>{t("sf.ui35.criterion")}</h3>
                          <ul class="sf-n24-list"><For each={result().criterionResults}>{(criterion) =>
                            <li><bdi>{caseRecord()?.criteria.find((item) => item.id === criterion.criterionId)?.description ?? criterion.criterionId}</bdi>
                              : <bdi>{criterion.state}</bdi> · <bdi>{criterion.reason}</bdi></li>
                          }</For></ul>
                        </Show>
                        <Show when={result().unresolvedConditions.length}>
                          <h3>{t("sf.ui35.conditions")}</h3>
                          <ul class="sf-n24-list"><For each={result().unresolvedConditions}>{(condition) => <li><bdi>{condition}</bdi></li>}</For></ul>
                        </Show>
                        <details>
                          <summary>{t("sf.u19.results.resultRef")}</summary>
                          <ol class="sf-n24-list"><For each={run().value?.request.scenarioRefs}>{(ref) => <li><bdi>{ref}</bdi></li>}</For></ol>
                        </details>
                      </>}
                    </Show>
                  </SfStatePanel>
                </section>}
              </Show>
              <Show when={selectedPair()}>
                {(pair) => <SfNumericRule owner={caseData.owner} caseSelector={sourceRef()} record={record()} pair={pair()}
                  onSaved={() => setComparison(undefined)} />}
              </Show>
              <SfRecordChoice owner={caseData.owner} caseSelector={sourceRef()} record={record()}
                pair={selectedPair()} comparison={currentComparison()} />
            </Show>
            </Show>
            <section class="mx-card sf-n24-section" aria-label={t("sf.ui35.choice")}>
              <h2>{t("sf.ui35.choice")}</h2>
              <Show when={choicesForRoute()} fallback={
                <SfStatePanel state={choicePanelState()}
                  messageKey={k(choicePanelState() === "empty" ? "sf.ui35.noChoices" :
                    choicePanelState() === "denied" ? "sf.common.noAccess" :
                    choicePanelState() === "session-expired" ? "sf.common.loginAgain" :
                    "sf.ui35.unavailable")} />
              }>
                {(selection) => <div class="sf-n24">
                  <p><bdi>{selection().title}</bdi></p>
                  <For each={selection().choices}>
                    {(choice) => <article class="sf-n24-review">
                      <h3><bdi>{choice.title}</bdi></h3>
                      <p><bdi>{choice.reason}</bdi></p>
                      <button type="button" class="mx-btn" disabled={!choice.request || !canReview() || ui.reviewState === "loading" || ui.reviewState === "outcome-unknown"}
                        onClick={() => void prepare(choice.id)}>{t("sf.ui35.prepare")}</button>
                    </article>}
                  </For>
                </div>}
              </Show>
              <Show when={ui.reviewState === "ready" && ui.choiceReview && matchesCurrentCase(ui.choiceReview.promotion.caseRef) ? ui.choiceReview : undefined}>
                {(review) => <section class="sf-n24-review" aria-live="polite">
                  <h3>{t("sf.ui35.prepareReview")}</h3>
                  <p>{t("sf.ui35.prepared")}</p>
                  <dl>
                    <dt>{t("sf.ui35.choice")}</dt><dd><bdi>{review().promotion.choiceId}</bdi></dd>
                    <dt>{t("sf.ui35.basis")}</dt><dd><bdi>{review().promotion.coverageRef}</bdi></dd>
                    <dt>{t("sf.ui35.status")}</dt><dd><bdi>{review().current.comparisonStatus}</bdi></dd>
                    <dt>{t("sf.ui35.knownSubtotal")}</dt><dd>{amount(review().current.knownSubtotal)} <bdi>{review().current.currency}</bdi></dd>
                  </dl>
                </section>}
              </Show>
              <Show when={ui.reviewState === "outcome-unknown" || ui.reviewState === "conflict" || ui.reviewState === "stale" || ui.reviewState === "denied" || ui.reviewState === "session-expired" || ui.reviewState === "unavailable"}>
                <SfStatePanel state={ui.reviewState} messageKey={k(
                  ui.reviewState === "denied" ? "sf.common.noAccess" :
                  ui.reviewState === "session-expired" ? "sf.common.loginAgain" :
                  "sf.ui35.error"
                )} />
              </Show>
            </section>
          </>}
        </Show>
      </div>
    </SfPageFrame>
  )
}

function sameRouteCase(routeRef: string, id: string, incarnation: string) {
  return `case:${encodeURIComponent(id)}:${encodeURIComponent(incarnation)}` === routeRef
}
