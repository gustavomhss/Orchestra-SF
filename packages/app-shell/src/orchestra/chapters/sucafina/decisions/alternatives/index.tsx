import { A } from "@solidjs/router"
import { createEffect, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import type { Schema } from "effect"
import { useLanguage } from "@/context/language"
import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import { SfDecisions } from "@orchestra/schema/sucafina/decisions"
import { SfPageFrame, type SfCopyKey, type SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import type { SfSurfaceProps } from "../../context/contracts"
import { useSfCase, sfFailureUiState, sfOperationReady } from "../cases/model"
import { sfDecisionHref } from "../cases/route"
import "../cases/n24.css"

type ChoiceEnvelope = Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.choice.read"]["output"]>
type ChoiceValue = Extract<ChoiceEnvelope, { status: "ok" }>["value"]
type ReviewEnvelope = Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.current-choice-prepare"]["output"]>
type ReviewValue = Extract<ReviewEnvelope, { status: "ok" }>["value"]
const k = (value: string) => value as SfCopyKey

/** UI35: strictly source-backed comparison. Never changes recorded choices. */
export function SfAlternativesView(props: SfSurfaceProps): JSX.Element {
  const language = useLanguage()
  const t = (value: string) => language.t(value as Parameters<typeof language.t>[0])
  const valid = () => props.surfaceId === "UI35"
  const route = () => valid() ? props.route as SfSurfaceProps<"UI35">["route"] : undefined
  const sourceRef = () => valid() ? String(props.route.params.caseRef) : ""
  const caseData = useSfCase(sourceRef)
  const [ui, setUi] = createStore<{
    selection: readonly string[]
    choices?: ChoiceValue
    choicesState: SfUiState
    choiceReview?: ReviewValue
    reviewState: SfUiState
    compare: boolean
    readSequence: number
  }>({ selection: [], choicesState: "loading", reviewState: "empty", compare: false, readSequence: 0 })
  const caseRecord = () => caseData.read.projection?.case
  const displayed = () => {
    const alternatives = caseRecord()?.alternatives ?? []
    if (route()?.kind === "detail") {
      const focus = String(route()!.params.alternativeRef)
      return alternatives.filter((item) => item.id === focus)
    }
    if (!ui.compare || ui.selection.length === 0) return alternatives
    return alternatives.filter((item) => ui.selection.includes(item.id))
  }
  const sameBasis = () => {
    const items = displayed()
    if (!ui.compare || items.length !== 2) return false
    const first = items[0]!.result
    const second = items[1]!.result
    return first.comparisonStatus === "complete" && second.comparisonStatus === "complete"
      && first.currency === second.currency
      && first.horizon.start === second.horizon.start && first.horizon.end === second.horizon.end
      && first.costCoverage.basisId === second.costCoverage.basisId
      && first.costCoverage.basisVersion === second.costCoverage.basisVersion
  }

  createEffect(() => {
    const active = caseData.owner.ready()
    const current = sourceRef()
    const generation = caseData.owner.generation()
    const refresh = ui.readSequence
    setUi({ choices: undefined, choicesState: active ? "loading" : "unavailable", choiceReview: undefined, reviewState: "empty" })
    if (!active || !current || !sfOperationReady(active.context, "decisions.choice.read")) return
    const abort = new AbortController()
    onCleanup(() => abort.abort())
    void createSfDecisionsClient(active.transport)["decisions.choice.read"](
      { case: current }, { signal: abort.signal },
    ).then((result) => {
      if (abort.signal.aborted || caseData.owner.generation() !== generation) return
      if (result.kind === "transport-error") {
        setUi("choicesState", "unavailable")
        return
      }
      if (result.body.status !== "ok") {
        setUi("choicesState", sfFailureUiState(result.body.status, result.status))
        return
      }
      setUi({ choices: result.body.value, choicesState: "ready" })
    }).catch((error: unknown) => {
      if (abort.signal.aborted) return
      console.error("Sucafina choice projection failed", error)
      setUi("choicesState", "unavailable")
    })
    void refresh
  })

  const select = (ref: string) => {
    const present = ui.selection.includes(ref)
    setUi({ selection: present ? ui.selection.filter((item) => item !== ref) :
      [...ui.selection.slice(-1), ref], compare: false, choiceReview: undefined })
  }
  const prepare = async (choiceId: string) => {
    const current = ui.choices?.selected?.choices.find((item) => item.id === choiceId)
    const active = caseData.owner.ready()
    if (!current?.request || !active || !sfOperationReady(active.context, "decisions.current-choice-prepare") ||
      ui.reviewState === "loading" || ui.reviewState === "outcome-unknown") return
    const ticket = caseData.owner.generation()
    setUi({ reviewState: "loading", choiceReview: undefined })
    const abort = new AbortController()
    try {
      const result = await createSfDecisionsClient(active.transport)["decisions.current-choice-prepare"](
        current.request, { signal: abort.signal, idempotencyKey: crypto.randomUUID() },
      )
      if (caseData.owner.generation() !== ticket || !caseData.owner.ready()) return
      if (result.kind === "transport-error") {
        setUi("reviewState", "outcome-unknown")
      } else if (result.body.status !== "ok") {
        setUi("reviewState", sfFailureUiState(result.body.status, result.status))
      } else {
        setUi({ choiceReview: result.body.value, reviewState: "ready" })
      }
    } catch (error) {
      console.error("Sucafina current-choice comparison failed", error)
      setUi("reviewState", "outcome-unknown")
    }
  }
  const amount = (value: number | null) => value === null ? t("sf.ui35.missing") : String(value)
  const canReview = () => !!ui.choices?.selected?.choices.some((choice) => !!choice.request)
    && !!caseData.owner.ready()?.context && sfOperationReady(caseData.owner.ready()!.context, "decisions.current-choice-prepare")
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
        disabled: caseData.read.state !== "ready" || ui.selection.length !== 2,
        busy: false, onInvoke: () => setUi("compare", true),
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
            <Show when={record().alternatives.length} fallback={<SfStatePanel state="empty" messageKey={k("sf.ui35.noItems")} />}>
              <div class="sf-n24-compare">
                <For each={displayed()}>
                  {(alternative) => {
                    const result = alternative.result
                    const chosen = () => ui.selection.includes(alternative.id)
                    return <article class="sf-n24-compare-card" aria-current={chosen() ? "true" : undefined}>
                      <h2><bdi>{alternative.title}</bdi></h2>
                      <p>{t("sf.ui35.version")}: {alternative.version}</p>
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
                          <li><bdi>{assumption}</bdi></li>}</For></ul>
                      </details>
                    </article>
                  }}
                </For>
              </div>
              <Show when={ui.compare && ui.selection.length === 2 && !sameBasis()}>
                <p role="status">{t("sf.ui35.incompatible")}</p>
              </Show>
            </Show>
            <section class="mx-card sf-n24-section" aria-label={t("sf.ui35.choice")}>
              <h2>{t("sf.ui35.choice")}</h2>
              <Show when={ui.choicesState === "ready" && ui.choices?.selected} fallback={
                <SfStatePanel state={ui.choicesState === "ready" ? "empty" : ui.choicesState}
                  messageKey={k(ui.choicesState === "ready" ? "sf.ui35.noChoices" : "sf.ui35.unavailable")} />
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
              <Show when={ui.reviewState === "ready" && ui.choiceReview}>
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
              <Show when={ui.reviewState === "outcome-unknown" || ui.reviewState === "conflict" || ui.reviewState === "denied" || ui.reviewState === "unavailable"}>
                <SfStatePanel state={ui.reviewState} messageKey={k("sf.ui35.error")} />
              </Show>
            </section>
          </>}
        </Show>
      </div>
    </SfPageFrame>
  )
}
