/**
 * N25/U18 UI38 — current choice. The read/prepare/promote trio is the original
 * A04 producer; no browsing of another case, fabricated choice or replay-on-timeout.
 */
import { createEffect, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import type { SfSurfaceProps } from "../../context/contracts"
import { useSfContext } from "../../context"
import { SfPageFrame } from "../../shared/frame"
import type { SfCoverage, SfDisplayValue, SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { SfChangeReview, type SfReviewField, type SfReviewSnapshot, type SfEffect, type SfReviewConfirmation } from "../../shared/change-review"
import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import type { SF_U18_COPY } from "@/i18n/orchestra-chapters/sf-u18"
import {
  u18Coverage, u18ErrorKey, u18Key, u18Message, u18PortState,
  u18Ref, u18Text, u18TransportState, type SfChoiceOptions, type SfChoiceReview,
} from "./model"
import "./u18.css"

type View = {
  state: SfUiState
  options: SfChoiceOptions | null
  review: SfChoiceReview | null
  selectedChoiceId: string | null
  busy: boolean
  outcome: "idle" | "confirmed" | "unknown"
  resultRef: string | null
  operationRef: string | null
}

export function SfChoiceView(props: SfSurfaceProps<"UI38">): JSX.Element {
  const owner = useSfContext()
  const language = useLanguage()
  const t = (key: keyof typeof SF_U18_COPY) => language.t(key as Parameters<typeof language.t>[0])
  const [view, setView] = createStore<View>({
    state: "loading", options: null, review: null, selectedChoiceId: null,
    busy: false, outcome: "idle", resultRef: null, operationRef: null,
  })
  let readGeneration = 0
  let readAbort: AbortController | undefined
  let mutationAbort: AbortController | undefined
  let mutationFence = 0

  const selected = () => view.options?.selected
  const chosen = () => selected()?.choices.find((entry) => entry.id === view.selectedChoiceId)
  const privacy = () => view.state === "denied" || view.state === "session-expired"
  const currentState = () => {
    const status = owner.state().status
    if (status === "ready") return view.state
    return status === "unauthenticated" ? "session-expired" :
      status === "denied" ? "denied" : status === "resolving" ? "loading" : "unavailable"
  }
  const clearPrivate = (state: SfUiState) => {
    readAbort?.abort()
    mutationAbort?.abort()
    mutationFence++
    setView({
      state, options: null, review: null, selectedChoiceId: null, busy: false,
      outcome: "idle", resultRef: null, operationRef: null,
    })
  }

  const read = async () => {
    const ready = owner.ready()
    const ref = props.route.params.caseRef
    const generation = owner.generation()
    if (!ready || owner.state().status !== "ready") {
      clearPrivate(currentState())
      return
    }
    readAbort?.abort()
    const controller = new AbortController()
    readAbort = controller
    const serial = ++readGeneration
    setView("state", "loading")
    try {
      const result = await createSfDecisionsClient(ready.transport)["decisions.choice.read"](
        { case: ref }, { signal: controller.signal },
      )
      if (controller.signal.aborted || serial !== readGeneration ||
        generation !== owner.generation() || ref !== props.route.params.caseRef) return
      if (result.kind === "response" && result.body.status === "ok") {
        const data = result.body.value
        // The producer answers only the case selected in this authorized query.
        setView({ state: data.selected ? "ready" : "not-found", options: data })
      } else if (result.kind === "response") {
        const state = u18PortState(result)
        if (state === "denied" || state === "session-expired") clearPrivate(state)
        else setView("state", state)
      } else if (result.reason !== "aborted") {
        console.error("N25 UI38 current-choice read failed", result.reason)
        setView("state", "unavailable")
      }
    } catch (error) {
      if (controller.signal.aborted) return
      console.error("N25 UI38 authorized read failed", error instanceof Error ? error.name : "unknown")
      setView("state", "unavailable")
    }
  }

  createEffect(() => {
    owner.generation()
    owner.ready()
    owner.state().status
    props.route.params.caseRef
    void read()
    onCleanup(() => {
      readAbort?.abort()
      mutationAbort?.abort()
      mutationFence++
    })
  })

  const prepare = async (choiceId: string) => {
    const current = selected()
    const choice = current?.choices.find((item) => item.id === choiceId)
    const ready = owner.ready()
    if (!current || !choice?.request || !ready || view.busy ||
      currentState() !== "ready" || view.outcome === "unknown") return
    const generation = owner.generation()
    const fence = ++mutationFence
    mutationAbort?.abort()
    const controller = new AbortController()
    mutationAbort = controller
    const key = crypto.randomUUID()
    setView({ review: null, selectedChoiceId: choiceId, busy: true, outcome: "idle", operationRef: key })
    try {
      const result = await createSfDecisionsClient(ready.transport)["decisions.current-choice-prepare"](
        choice.request, { signal: controller.signal, idempotencyKey: key },
      )
      if (controller.signal.aborted || fence !== mutationFence || generation !== owner.generation()) return
      if (result.kind === "response" && result.body.status === "ok") {
        const review = result.body.value
        if (review.promotion.choiceId !== choiceId ||
          review.promotion.caseRef.id !== current.caseRef.id ||
          review.promotion.caseRef.incarnation !== current.caseRef.incarnation ||
          review.promotion.caseRef.version !== current.caseRef.version) {
          setView("state", "stale")
        } else {
          setView({ review, state: "ready" })
        }
      } else if (result.kind === "response") {
        setView("state", u18PortState(result))
      } else {
        console.error("N25 UI38 choice preparation not confirmed", result.reason)
        setView("state", "unavailable")
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("N25 UI38 preparation error", error instanceof Error ? error.name : "unknown")
        setView("state", "unavailable")
      }
    } finally {
      if (fence === mutationFence) setView("busy", false)
    }
  }

  const promote = async () => {
    const review = view.review
    const current = selected()
    const ready = owner.ready()
    if (!review || !current || !ready || !view.selectedChoiceId ||
      view.busy || view.outcome !== "idle" || currentState() !== "ready" ||
      review.promotion.caseRef.version !== current.caseRef.version ||
      review.promotion.choiceId !== view.selectedChoiceId) return
    const generation = owner.generation()
    const fence = ++mutationFence
    const controller = new AbortController()
    mutationAbort = controller
    const key = crypto.randomUUID() // one new human command, never reused as retry
    setView({ busy: true, operationRef: key })
    try {
      const result = await createSfDecisionsClient(ready.transport)["decisions.current-choice-promote"](
        review.promotion, { signal: controller.signal, idempotencyKey: key },
      )
      if (controller.signal.aborted || fence !== mutationFence || generation !== owner.generation()) return
      if (result.kind === "response" && result.body.status === "ok") {
        setView({ outcome: "confirmed", resultRef: result.body.value.resultRef, review: null, busy: false })
      } else if (result.kind === "response") {
        const state = u18PortState(result)
        if (state === "denied" || state === "session-expired") clearPrivate(state)
        else if (result.status >= 500) setView({ outcome: "unknown", state: "outcome-unknown" })
        else setView({ state, review: null })
      } else {
        console.error("N25 UI38 promotion outcome unresolved", result.reason)
        setView({ outcome: "unknown", state: u18TransportState(result) })
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("N25 UI38 promotion outcome unresolved", error instanceof Error ? error.name : "unknown")
        setView({ outcome: "unknown", state: "outcome-unknown" })
      }
    } finally {
      if (fence === mutationFence) setView("busy", false)
    }
  }

  const reviewFields = (item: SfChoiceReview["current"]): readonly SfReviewField[] => [
    { path: "knownSubtotal", label: u18Message("sf.u18.choice.knownSubtotal"), value: financial(item.knownSubtotal, item.currency) },
    { path: "total", label: u18Message("sf.u18.choice.total"), value: financial(item.total, item.currency) },
    { path: "comparisonStatus", label: u18Message("sf.u18.choice.status"), value: u18Text(item.comparisonStatus) },
    { path: "coverageState", label: u18Message("sf.u18.choice.coverage"), value: u18Text(item.costCoverage.coverageState) },
    { path: "horizon", label: u18Message("sf.u18.choice.period"), value: u18Text(item.horizon.start + " – " + item.horizon.end) },
  ]
  const financial = (value: number | null, currency: string): SfDisplayValue =>
    value === null ? { kind: "missing", reason: u18Message("sf.common.unknown") } :
      { kind: "text", text: { kind: "data", text: String(value) + " " + currency } }
  const snapshot = (item: SfChoiceReview["current"]): SfReviewSnapshot => ({
    kind: "persisted", ref: u18Ref(item.id), version: item.version, fields: reviewFields(item),
  })
  const coverage = (): SfCoverage => view.review ? u18Coverage(view.review.current.costCoverage) : {
    state: "unavailable", summary: u18Message("sf.u18.choice.coverage"),
    reasons: [], knownCount: null, expectedCount: null,
  }
  const admitted = () => !!view.review &&
    view.review.current.comparisonStatus === "complete" &&
    view.review.current.costCoverage.coverageState === "complete" &&
    view.review.current.unresolvedConditions.length === 0 &&
    view.review.current.restrictions.length === 0 &&
    view.outcome === "idle" && !view.busy && currentState() === "ready"
  const reviewConfirmation = (): SfReviewConfirmation => view.review && admitted()
    ? {
      kind: "admitted", labelKey: u18Key("sf.u18.choice.confirm"), purpose: "select",
      binding: {
        kind: "catalog-command", operationId: "decisions.current-choice-promote",
        version: { kind: "record", expectedVersion: view.review.promotion.caseRef.version },
        confirmation: "presentation-only",
      },
    }
    : { kind: "blocked", labelKey: u18Key("sf.u18.choice.confirm"), reasons: [u18Message("sf.u18.choice.notEligible")] }
  const effect = (): readonly SfEffect[] => {
    const review = view.review
    if (!review) return []
    return [{
      id: review.promotion.resultRef, domain: "decisions", title: { kind: "data", text: chosen()?.title ?? review.promotion.choiceId },
      state: "proposed", details: [...reviewFields(review.current)],
    }]
  }

  return (
    <SfPageFrame
      titleKey={u18Key("sf.ui38.title")}
      context={selected() ? [{
        id: "case", label: u18Message("sf.common.chooseCase"),
        value: { kind: "data", text: selected()!.title },
      }] : []}
      tabs={[]} activeTab={null} secondaryActions={[]} density="comfortable" layout="comparison"
      onLayoutMode={() => undefined}
    >
      <SfStatePanel
        state={currentState()} messageKey={u18ErrorKey(currentState())}
        onRetryRead={view.outcome === "unknown" ? undefined : () => void read()}
      >
        <Show when={selected()}>
          {(caseData) => <>
            <section aria-label={t("sf.u18.choice.current")}>
              <h2>{t("sf.u18.choice.current")}</h2>
              <Show when={caseData().choices.length > 0} fallback={<p>{t("sf.u18.choice.noChoices")}</p>}>
                <div class="sf-u18-choice-list">
                  <For each={caseData().choices}>
                    {(choice) => (
                      <article class="mx-card sf-u18-choice" data-choice-id={choice.id}>
                        <h3>{choice.title}</h3>
                        <p>{choice.reason}</p>
                        <button
                          type="button" class="mx-btn"
                          disabled={!choice.request || view.busy || view.outcome !== "idle"}
                          aria-pressed={view.selectedChoiceId === choice.id}
                          onClick={() => void prepare(choice.id)}
                        >
                          {t("sf.u18.choice.prepare")}
                        </button>
                        <Show when={!choice.request}><p>{t("sf.u18.choice.notEligible")}</p></Show>
                      </article>
                    )}
                  </For>
                </div>
              </Show>
            </section>
            <Show when={view.review && !privacy()}>
              {(review) => <>
                <SfChangeReview
                  operation={{
                    ref: u18Ref(view.operationRef ?? review().bindingDigest),
                    label: u18Message("sf.u18.choice.review"),
                    scope: { kind: "data", text: selected()?.title ?? "" },
                  }}
                  base={snapshot(review().historical)}
                  current={snapshot(review().current)}
                  proposed={snapshot(review().current)}
                  effects={effect()}
                  coverage={coverage()}
                  blockingReasons={review().current.unresolvedConditions.map(() => u18Message("sf.u18.choice.condition"))}
                  confirmation={reviewConfirmation()}
                  state={view.state}
                  onConfirm={() => void promote()}
                  onRevise={() => setView({ review: null, selectedChoiceId: null })}
                  onCancel={() => setView({ review: null, selectedChoiceId: null })}
                />
                <section class="mx-card">
                  <h3>{t("sf.u18.choice.constraints")}</h3>
                  <ul>
                    <For each={[...review().current.unresolvedConditions, ...review().current.restrictions, ...review().current.costCoverage.issues]}>
                      {(condition) => <li>{condition}</li>}
                    </For>
                  </ul>
                  <h3>{t("sf.u18.choice.coverage")}</h3>
                  <ul>
                    <For each={review().current.costCoverage.entries}>
                      {(item) => <li>{item.categoryId} · {item.status}
                        <Show when={item.status === "pending"}>{(pending) => " — " + (item.status === "pending" ? item.reason : "")}</Show>
                      </li>}
                    </For>
                  </ul>
                </section>
              </>}
            </Show>
            <Show when={view.outcome === "confirmed"}>
              <p role="status" class="mx-card">{t("sf.u18.choice.promoted")}
                <span class="sf-u18-ref">{view.resultRef}</span>
              </p>
              <button type="button" class="mx-btn" onClick={() => void read()}>{t("sf.u18.choice.recheck")}</button>
            </Show>
          </>}
        </Show>
      </SfStatePanel>
      <Show when={view.outcome === "unknown"}>
        <div role="alert" class="mx-card">{t("sf.u18.choice.unknown")}</div>
      </Show>
    </SfPageFrame>
  )
}
