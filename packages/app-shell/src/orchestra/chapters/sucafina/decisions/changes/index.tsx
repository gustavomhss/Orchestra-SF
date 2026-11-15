/**
 * N25/U18 UI39 — prepared changes and exact producer review/apply/recovery.
 * A04 owns all CAS, domain effects, receipts and authorizations.
 */
import { createEffect, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import type { SfSurfaceProps } from "../../context/contracts"
import { useSfContext } from "../../context"
import { SfPageFrame } from "../../shared/frame"
import type { SfCoverage, SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import {
  SfChangeReview, type SfReviewField,
  type SfEffect, type SfReviewConfirmation,
} from "../../shared/change-review"
import { SfReceiptView, type SfReceipt } from "../../shared/receipt"
import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import type { SfIntentRef, SfOperationRef } from "@orchestra/schema/sucafina/context"
import type { SF_U18_COPY } from "@/i18n/orchestra-chapters/sf-u18"
import {
  u18Coverage, u18ErrorKey, u18Key, u18Message, u18PortState, u18Ref,
  u18Text, u18TransportState, type SfCase, type SfCaseChange, type SfDecisionReview,
} from "../choice/model"
import "../choice/u18.css"

type ApplyOutcome = Readonly<{ receiptId: string; surface: string; version: number; outcome: "applied" | "conflict" | "failed" }>
type View = {
  state: SfUiState
  caseData: SfCase | null
  selectedChangeId: string | null
  review: SfDecisionReview | null
  reviewIntent: string | null
  busy: boolean
  applyOutcome: ApplyOutcome | null
  outcomeUnknown: boolean
  operationRef: string | null
}

export function SfPreparedChangesView(props: SfSurfaceProps<"UI39">): JSX.Element {
  const owner = useSfContext()
  const language = useLanguage()
  const t = (key: keyof typeof SF_U18_COPY) => language.t(key as Parameters<typeof language.t>[0])
  const [view, setView] = createStore<View>({
    state: "loading", caseData: null, selectedChangeId: null,
    review: null, reviewIntent: null, busy: false, applyOutcome: null,
    outcomeUnknown: false, operationRef: null,
  })
  let readAbort: AbortController | undefined
  let writeAbort: AbortController | undefined
  let serial = 0
  let mutationFence = 0

  const initialChangeRef = () => props.route.kind === "entry" ? props.route.params.changeRef : null
  const selected = () => view.caseData?.preparedChanges.find((item) => item.id ===
    (view.selectedChangeId ?? initialChangeRef()))
  const active = () => {
    const state = owner.state().status
    return state === "ready" ? view.state : state === "unauthenticated"
      ? "session-expired" : state === "denied" ? "denied" : state === "resolving" ? "loading" : "unavailable"
  }
  const privateState = () => active() === "denied" || active() === "session-expired"
  const clearPrivate = (state: SfUiState) => {
    readAbort?.abort()
    writeAbort?.abort()
    mutationFence++
    setView({
      state, caseData: null, selectedChangeId: null, review: null,
      reviewIntent: null, busy: false, applyOutcome: null,
      outcomeUnknown: false, operationRef: null,
    })
  }

  const read = async () => {
    const ready = owner.ready()
    const contextStatus = owner.state().status
    const caseRef = props.route.params.caseRef
    const generation = owner.generation()
    if (contextStatus !== "ready" || !ready) {
      clearPrivate(active())
      return
    }
    readAbort?.abort()
    const controller = new AbortController()
    readAbort = controller
    const current = ++serial
    setView("state", "loading")
    try {
      const result = await createSfDecisionsClient(ready.transport)["projection.case"](
        { caseRef }, { signal: controller.signal },
      )
      if (controller.signal.aborted || current !== serial || generation !== owner.generation() ||
        caseRef !== props.route.params.caseRef) return
      if (result.kind === "response" && result.body.status === "ok") {
        const caseData = result.body.value.projection.case
        const target = initialChangeRef()
        if (target && !caseData.preparedChanges.some((item) => item.id === target)) {
          setView({ caseData, state: "not-found" })
          return
        }
        const next = view.review && view.caseData && view.caseData.version !== caseData.version ? "stale" :
          caseData.preparedChanges.length ? "ready" : "empty"
        setView({ caseData, state: next })
      } else if (result.kind === "response") {
        const state = u18PortState(result)
        if (state === "denied" || state === "session-expired") clearPrivate(state)
        else setView("state", state)
      } else if (result.reason !== "aborted") {
        console.error("N25 UI39 case projection read", result.reason)
        setView("state", "unavailable")
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("N25 UI39 case read", error instanceof Error ? error.name : "unknown")
        setView("state", "unavailable")
      }
    }
  }

  createEffect(() => {
    owner.generation()
    owner.ready()
    owner.state().status
    props.route.params.caseRef
    initialChangeRef()
    void read()
    onCleanup(() => {
      readAbort?.abort()
      writeAbort?.abort()
      mutationFence++
    })
  })

  const choose = (changeId: string) => {
    if (view.busy || view.outcomeUnknown || privateState()) return
    setView({
      selectedChangeId: changeId, review: null,
      reviewIntent: null, applyOutcome: null,
      state: "ready",
    })
  }

  const requestReview = async () => {
    const current = selected()
    const data = view.caseData
    const ready = owner.ready()
    if (!current || !data || !ready || view.busy || view.outcomeUnknown ||
      !["ready", "partial"].includes(active())) return
    const generation = owner.generation()
    const fence = ++mutationFence
    const controller = new AbortController()
    writeAbort = controller
    const intent = crypto.randomUUID()
    setView({ busy: true, review: null, reviewIntent: intent })
    try {
      const result = await createSfDecisionsClient(ready.transport)["decisions.decision-review"](
        { caseRef: { id: data.id, incarnation: data.incarnation, version: data.version },
          choiceId: current.choiceId, changeId: current.id },
        { signal: controller.signal },
      )
      if (controller.signal.aborted || fence !== mutationFence || generation !== owner.generation()) return
      if (result.kind === "response" && result.body.status === "ok") {
        const review = result.body.value
        if (review.changeId !== current.id || review.choiceId !== current.choiceId ||
          review.expectedVersion !== current.expectedVersion || current.caseVersion !== data.version) {
          setView({ state: "stale", review: null })
        } else {
          setView({ review, state: "ready" })
        }
      } else if (result.kind === "response") {
        setView({ state: u18PortState(result), review: null })
      } else if (result.reason !== "aborted") {
        console.error("N25 UI39 producer review", result.reason)
        setView("state", "unavailable")
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("N25 UI39 review unavailable", error instanceof Error ? error.name : "unknown")
        setView("state", "unavailable")
      }
    } finally {
      if (fence === mutationFence) setView("busy", false)
    }
  }

  const producerFields = (side: "before" | "after"): readonly SfReviewField[] =>
    view.review?.fields.map((field) => ({
      path: field.field,
      label: { key: u18Key("sf.u18.changes.target"), params: { field: field.field } },
      value: u18Text(
        field[side] === null ? null :
          String(field[side]) + (field[side === "before" ? "beforeCurrency" : "afterCurrency"] ? " " +
            field[side === "before" ? "beforeCurrency" : "afterCurrency"] : ""),
      ),
    })) ?? []
  const reviewAllowed = () => {
    const change = selected()
    const review = view.review
    const data = view.caseData
    return !!(change && review && data &&
      review.state === "planned" && change.state === "planned" &&
      change.caseVersion === data.version &&
      review.expectedVersion === change.expectedVersion &&
      review.changeId === change.id && review.choiceId === change.choiceId &&
      !review.receipt && !view.busy && !view.outcomeUnknown && active() === "ready" &&
      change.preview.costCoverage.coverageState === "complete")
  }
  const coverage = (): SfCoverage => selected() ? u18Coverage(selected()!.preview.costCoverage) :
    { state: "unavailable", summary: u18Message("sf.u18.choice.coverage"), reasons: [], knownCount: null, expectedCount: null }
  const confirmation = (): SfReviewConfirmation => view.review && reviewAllowed() ? ({
    kind: "admitted", labelKey: u18Key("sf.u18.changes.apply"), purpose: "apply",
    binding: {
      kind: "producer-review", operationId: "decisions.decision-apply",
      reviewRef: u18Ref(view.review.changeId), reviewDigest: view.review.reviewDigest,
      baseVersion: view.review.expectedVersion,
    },
  }) : ({ kind: "blocked", labelKey: u18Key("sf.u18.changes.apply"),
    reasons: [u18Message("sf.u18.changes.unconfirmed")] })
  const effects = (): readonly SfEffect[] => {
    const r = view.review
    if (!r) return []
    return [{
      id: r.changeId,
      domain: r.surface,
      title: { kind: "data", text: r.target.label ?? r.target.id },
      state: r.state === "planned" ? "proposed" : r.state === "applied" ? "applied" :
        r.state === "failed" || r.state === "conflict" ? "not-applied" : "blocked",
      details: producerFields("after"),
      ...(r.receipt ? { receiptRef: u18Ref(r.receipt.id) } : {}),
    }]
  }

  const apply = async () => {
    const r = view.review
    const change = selected()
    const data = view.caseData
    const ready = owner.ready()
    if (!reviewAllowed() || !r || !change || !data || !ready) return
    const controller = new AbortController()
    writeAbort = controller
    const fence = ++mutationFence
    const generation = owner.generation()
    const operationRef = crypto.randomUUID()
    setView({ busy: true, operationRef })
    try {
      const result = await createSfDecisionsClient(ready.transport)["decisions.decision-apply"](
        { caseRef: { id: data.id, incarnation: data.incarnation, version: data.version },
          choiceId: r.choiceId, changeId: r.changeId, reviewDigest: r.reviewDigest },
        { signal: controller.signal, idempotencyKey: operationRef },
      )
      if (controller.signal.aborted || fence !== mutationFence || generation !== owner.generation()) return
      if (result.kind === "response" && result.body.status === "ok") {
        const value = result.body.value
        setView({
          applyOutcome: value, review: null,
          state: value.outcome === "applied" ? "ready" : value.outcome === "conflict" ? "conflict" : "partial",
        })
      } else if (result.kind === "response") {
        if (result.status >= 500) setView({ outcomeUnknown: true, state: "outcome-unknown" })
        else setView({ state: u18PortState(result), review: null })
      } else {
        console.error("N25 UI39 apply unconfirmed", result.reason)
        setView({ outcomeUnknown: true, state: u18TransportState(result) })
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("N25 UI39 apply response lost", error instanceof Error ? error.name : "unknown")
        setView({ outcomeUnknown: true, state: "outcome-unknown" })
      }
    } finally {
      if (fence === mutationFence) setView("busy", false)
    }
  }

  /** Recovery is the named original producer operation, never a repeat of apply. */
  const reconcile = async () => {
    const change = selected()
    const data = view.caseData
    const ready = owner.ready()
    if (!change || !data || !ready || view.busy || privateState()) return
    const controller = new AbortController()
    writeAbort = controller
    const generation = owner.generation()
    const fence = ++mutationFence
    setView("busy", true)
    try {
      const result = await createSfDecisionsClient(ready.transport)["decisions.decision-recover"](
        { purpose: "recover",
          caseRef: { id: data.id, incarnation: data.incarnation, version: data.version },
          choiceId: change.choiceId, changeId: change.id },
        { signal: controller.signal, idempotencyKey: crypto.randomUUID() },
      )
      if (controller.signal.aborted || fence !== mutationFence || generation !== owner.generation()) return
      if (result.kind === "response" && result.body.status === "ok") {
        setView({ applyOutcome: result.body.value, outcomeUnknown: false,
          state: result.body.value.outcome === "applied" ? "ready" : "partial" })
      } else if (result.kind === "response") {
        const state = u18PortState(result)
        if (state === "denied" || state === "session-expired") clearPrivate(state)
        else setView("state", state)
      } else {
        console.error("N25 UI39 recovery unavailable", result.reason)
        setView("state", "outcome-unknown")
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("N25 UI39 recovery read failed", error instanceof Error ? error.name : "unknown")
        setView("state", "outcome-unknown")
      }
    } finally {
      if (fence === mutationFence) setView("busy", false)
    }
  }

  const receipts = (): readonly SfReceipt[] => {
    const change = selected()
    const data = view.caseData
    const receipt = change?.receiptRef ? data?.receipts.find((r) => r.id === change.receiptRef) : undefined
    if (!receipt) return []
    return [{ ref: u18Ref(receipt.id), producer: receipt.surface,
      recordedAt: receipt.at, sourceVersion: receipt.version, effects: [{
        id: receipt.id, domain: receipt.surface, title: { kind: "data", text: receipt.id },
        state: receipt.status === "applied" ? "applied" :
          receipt.status === "failed" || receipt.status === "conflict" || receipt.status === "cancelled" ? "not-applied" : "blocked",
        details: [],
      }],
    }]
  }

  return <SfPageFrame
    titleKey={u18Key("sf.ui39.title")}
    context={view.caseData ? [{
      id: "case", label: u18Message("sf.common.chooseCase"),
      value: { kind: "data", text: view.caseData.objective },
    }] : []}
    tabs={[]} activeTab={null} secondaryActions={[]} density="comfortable" layout="work"
    onLayoutMode={() => undefined}
  >
    <SfStatePanel state={active()} messageKey={u18ErrorKey(active())}
      coverage={selected() ? coverage() : undefined}
      onRetryRead={() => void read()}>
      <Show when={view.caseData}>
        {(data) => <>
          <section class="sf-u18-section">
            <h2>{t("sf.u18.changes.title")}</h2>
            <Show when={data().preparedChanges.length > 0} fallback={<p>{language.t("sf.common.empty")}</p>}>
              <ul class="sf-u18-change-list">
                <For each={data().preparedChanges}>
                  {(change) => <li>
                    <button class="mx-btn" type="button"
                      disabled={view.busy || view.outcomeUnknown}
                      aria-current={selected()?.id === change.id ? "true" : undefined}
                      onClick={() => choose(change.id)}>
                      {change.target.id} · {change.state} · v{change.expectedVersion}
                    </button>
                  </li>}
                </For>
              </ul>
            </Show>
          </section>
          <Show when={selected()}>
            {(change) => <>
              <section class="mx-card sf-u18-section">
                <h3>{t("sf.u18.changes.current")}</h3>
                <dl>
                  <dt>{t("sf.u18.changes.target")}</dt><dd>{change().target.id}</dd>
                  <dt>{t("sf.u18.changes.state")}</dt><dd>{change().state}</dd>
                  <dt>{t("sf.u18.changes.version")}</dt><dd>{change().expectedVersion}</dd>
                </dl>
                <Show when={change().requiredAuthority.length > 0}>
                  <h4>{t("sf.u18.changes.blockers")}</h4>
                  <ul><For each={change().requiredAuthority}>{(item) => <li>{item}</li>}</For></ul>
                </Show>
                <Show when={!view.review && !view.outcomeUnknown}>
                  <button type="button" class="mx-btn primary"
                    disabled={view.busy || change().state !== "planned" || active() !== "ready"}
                    onClick={() => void requestReview()}>
                    {t("sf.u18.changes.review")}
                  </button>
                </Show>
              </section>
              <Show when={view.review && !privateState()}>
                {(review) => <SfChangeReview
                  operation={{
                    ref: (view.reviewIntent ?? change().operationRef) as SfOperationRef,
                    label: u18Message("sf.u18.changes.review"),
                    scope: { kind: "data", text: change().target.id },
                  }}
                  base={{ kind: "persisted", ref: u18Ref(change().target.id),
                    version: review().expectedVersion, fields: producerFields("before") }}
                  current={{ kind: "persisted", ref: u18Ref(change().target.id),
                    version: review().expectedVersion, fields: producerFields("before") }}
                  proposed={{ kind: "draft", intentRef: view.reviewIntent as SfIntentRef,
                    sourceRef: u18Ref(change().target.id),
                    sourceVersion: review().expectedVersion, fields: producerFields("after") }}
                  effects={effects()} coverage={coverage()}
                  blockingReasons={reviewAllowed() ? [] : [u18Message("sf.u18.changes.stale")]}
                  confirmation={confirmation()} state={active()}
                  onConfirm={() => void apply()}
                  onRevise={() => setView("review", null)}
                  onCancel={() => setView("review", null)}
                  onReconcile={() => void reconcile()}
                />}
              </Show>
              <Show when={view.applyOutcome}>
                {(outcome) => <div class="mx-card" role="status">
                  <h3>{t("sf.u18.changes.receipt")}</h3>
                  <dl>
                    <dt>{t("sf.u18.receipts.outcome")}</dt><dd>{outcome().outcome}</dd>
                    <dt>{t("sf.u18.changes.receipt")}</dt><dd class="sf-u18-ref">{outcome().receiptId}</dd>
                    <dt>{t("sf.u18.receipts.version")}</dt><dd>{outcome().version}</dd>
                  </dl>
                  <button type="button" class="mx-btn" onClick={() => void read()}>
                    {t("sf.u18.choice.recheck")}
                  </button>
                </div>}
              </Show>
              <Show when={receipts().length > 0 || view.outcomeUnknown}>
                <SfReceiptView
                  operationRef={change().operationRef as SfOperationRef}
                  producerStatus={receipts().length ? { kind: "receipt-found" } : { kind: "pending" }}
                  effects={effects()} receipts={receipts()}
                  state={view.outcomeUnknown ? "outcome-unknown" : active()}
                  onReconcileRead={() => void reconcile()}
                />
              </Show>
              <Show when={view.outcomeUnknown}>
                <p role="alert" class="mx-card">{t("sf.u18.changes.unknown")}</p>
              </Show>
            </>}
          </Show>
        </>}
      </Show>
    </SfStatePanel>
    <Show when={view.outcomeUnknown && active() === "outcome-unknown"}>
      <button type="button" class="mx-btn"
        disabled={view.busy} onClick={() => void reconcile()}>
        {t("sf.u18.receipts.reconcile")}
      </button>
    </Show>
  </SfPageFrame>
}
