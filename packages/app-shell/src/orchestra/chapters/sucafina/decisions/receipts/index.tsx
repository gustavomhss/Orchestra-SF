/**
 * N25/U18 UI40 — historical receipts read from the original case ledger.
 * A missing receipt is not treated as a failed write or an opportunity to retry.
 */
import { createEffect, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import type { SfSurfaceProps } from "../../context/contracts"
import { useSfContext } from "../../context"
import { SfPageFrame } from "../../shared/frame"
import type { SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { SfReceiptView, type SfReceipt } from "../../shared/receipt"
import type { SfEffect } from "../../shared/change-review"
import type { SfOperationRef } from "@orchestra/schema/sucafina/context"
import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import { sfOperationReady } from "../cases/model"
import type { SF_U18_COPY } from "@/i18n/orchestra-chapters/sf-u18"
import {
  u18ErrorKey, u18Key, u18Message, u18PortState, u18Ref,
  type SfCase, type SfCaseReceipt, type SfCaseChange,
} from "../choice/model"
import "../choice/u18.css"
import "../intent/decision.css"
import "../../reviews/workflows.css"

type View = {
  state: SfUiState
  caseData: SfCase | null
  selectedReceiptId: string | null
  busy: boolean
  recovery: "idle" | "confirmed" | "unknown"
  outcome: { receiptId: string; outcome: string } | null
}

function receiptEffect(receipt: SfCaseReceipt): SfEffect {
  const state = receipt.status === "applied" ? "applied" :
    receipt.status === "failed" || receipt.status === "conflict" || receipt.status === "cancelled"
      ? "not-applied" : "blocked"
  return {
    id: receipt.id, domain: receipt.surface, state,
    title: { kind: "data", text: receipt.id },
    details: receipt.errors.map((error, index) => ({
      path: "errors." + index,
      label: u18Message("sf.u18.receipts.errors"),
      value: { kind: "text" as const, text: { kind: "data" as const, text: error } },
    })),
    receiptRef: u18Ref(receipt.id),
  }
}

export function SfDecisionReceiptsView(props: SfSurfaceProps<"UI40">): JSX.Element {
  const owner = useSfContext()
  const language = useLanguage()
  const t = (key: keyof typeof SF_U18_COPY) => language.t(key as Parameters<typeof language.t>[0])
  const [view, setView] = createStore<View>({
    state: "loading", caseData: null, selectedReceiptId: null,
    busy: false, recovery: "idle", outcome: null,
  })
  let activeAbort: AbortController | undefined
  let serial = 0
  let boundCase = ""
  const requested = () => props.route.kind === "entry" ? props.route.params.receiptRef : null
  const ledger = () => (view.caseData?.receipts ?? []).filter((receipt) =>
    receipt.targetIncarnation === view.caseData?.incarnation)
  const selected = () => ledger().find((receipt) => receipt.id === (view.selectedReceiptId ?? requested()))
  const canRecover = () => {
    const ready = owner.ready()
    return !!ready && sfOperationReady(ready.context, "decisions.decision-recover")
  }
  const change = (): SfCaseChange | undefined => {
    const receipt = selected()
    return receipt && view.caseData?.preparedChanges.find((entry) => entry.receiptRef === receipt.id)
  }
  const currentState = () => {
    const status = owner.state().status
    return status === "ready" ? view.state : status === "unauthenticated" ? "session-expired" :
      status === "denied" ? "denied" : status === "resolving" ? "loading" : "unavailable"
  }
  const clearPrivate = (state: SfUiState) => {
    activeAbort?.abort()
    setView({ state, caseData: null, selectedReceiptId: null, busy: false, recovery: "idle", outcome: null })
  }

  const read = async () => {
    const ready = owner.ready()
    const ref = props.route.params.caseRef
    const generation = owner.generation()
    if (!ready || owner.state().status !== "ready") {
      clearPrivate(currentState())
      return
    }
    activeAbort?.abort()
    const controller = new AbortController()
    activeAbort = controller
    const requestNo = ++serial
    setView("state", "loading")
    try {
      const result = await createSfDecisionsClient(ready.transport)["projection.case"]({ caseRef: ref }, { signal: controller.signal })
      if (controller.signal.aborted || generation !== owner.generation() ||
        requestNo !== serial || ref !== props.route.params.caseRef) return
      if (result.kind === "response" && result.body.status === "ok") {
        const data = result.body.value.projection.case
        if (!sameRouteCase(ref, data.id, data.incarnation)) {
          setView({ caseData: null, selectedReceiptId: null, outcome: null, state: "not-found" })
          return
        }
        const receiptRef = requested()
        const kept = view.selectedReceiptId && data.receipts.some((entry) =>
          entry.id === view.selectedReceiptId && entry.targetIncarnation === data.incarnation)
          ? view.selectedReceiptId : null
        const visible = data.receipts.filter((entry) => entry.targetIncarnation === data.incarnation)
        setView({
          caseData: data, selectedReceiptId: kept, outcome: kept ? view.outcome : null,
          state: receiptRef && !visible.some((entry) => entry.id === receiptRef)
            ? "not-found" : visible.length ? "ready" : "empty",
        })
      } else if (result.kind === "response") {
        const state = u18PortState(result)
        if (state === "denied" || state === "session-expired") clearPrivate(state)
        else setView("state", state)
      } else if (result.reason !== "aborted") {
        console.error("N25 UI40 receipt read failed", result.reason)
        setView("state", "unavailable")
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("N25 UI40 authorized receipt read", error instanceof Error ? error.name : "unknown")
        setView("state", "unavailable")
      }
    }
  }

  createEffect(() => {
    const ref = props.route.params.caseRef
    if (ref !== boundCase) {
      boundCase = ref
      setView({ caseData: null, selectedReceiptId: null, outcome: null, recovery: "idle" })
    }
    owner.generation()
    owner.ready()
    owner.state().status
    requested()
    void read()
    onCleanup(() => activeAbort?.abort())
  })

  /**
   * Explicit original decision-recover is admissible only with the producer's
   * choiceId/changeId, the same owner, and a human click. No apply redispatch.
   */
  const recover = async () => {
    const original = change()
    const current = view.caseData
    const ready = owner.ready()
    if (!original || !current || !ready || !canRecover() || view.busy || currentState() !== "ready" ||
      !sameRouteCase(props.route.params.caseRef, current.id, current.incarnation)) return
    const controller = new AbortController()
    activeAbort?.abort()
    activeAbort = controller
    const generation = owner.generation()
    setView("busy", true)
    try {
      const result = await createSfDecisionsClient(ready.transport)["decisions.decision-recover"](
        { purpose: "recover",
          caseRef: { id: current.id, incarnation: current.incarnation, version: current.version },
          choiceId: original.choiceId, changeId: original.id },
        { signal: controller.signal, idempotencyKey: crypto.randomUUID() },
      )
      if (controller.signal.aborted || generation !== owner.generation()) return
      if (result.kind === "response" && result.status === 200 && result.body.status === "ok" && result.body.value.outcome === "applied") {
        setView({ outcome: { receiptId: result.body.value.receiptId,
          outcome: result.body.value.outcome }, recovery: "confirmed" })
      } else if (result.kind === "response" && result.status === 200 && result.body.status === "ok") {
        setView({ outcome: { receiptId: result.body.value.receiptId, outcome: result.body.value.outcome },
          recovery: "unknown", state: result.body.value.outcome === "conflict" ? "conflict" : "partial" })
      } else if (result.kind === "response") {
        const state = u18PortState(result)
        if (state === "denied" || state === "session-expired") clearPrivate(state)
        else setView({ recovery: "unknown", state })
      } else {
        console.error("N25 UI40 producer reconciliation unconfirmed", result.reason)
        setView("recovery", "unknown")
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("N25 UI40 recovery failed", error instanceof Error ? error.name : "unknown")
        setView("recovery", "unknown")
      }
    } finally {
      setView("busy", false)
    }
  }

  const displayReceipt = (receipt: SfCaseReceipt): JSX.Element => (
    <article class="sf-u18-receipt" data-producer-receipt={receipt.id} aria-current={selected()?.id === receipt.id ? "true" : undefined}>
      <header class="sf-decision-section-heading"><h3><bdi>{receipt.surface}</bdi></h3><span class="sf-decision-state">{receipt.status}</span></header>
      <dl>
        <dt>{t("sf.u18.receipts.outcome")}</dt><dd>{receipt.status}</dd>
        <dt>{t("sf.u18.receipts.surface")}</dt><dd>{receipt.surface}</dd>
        <dt>{t("sf.u18.receipts.at")}</dt><dd><time dateTime={receipt.at}>{receipt.at}</time></dd>
        <dt>{t("sf.u18.receipts.version")}</dt><dd>{receipt.version}</dd>
      </dl>
      <details class="sf-decision-source-scope">
        <summary>{t("sf.u18.changes.receipt")}</summary>
        <dl><dt>{t("sf.u18.changes.receipt")}</dt><dd class="sf-u18-ref">{receipt.id}</dd>
          <dt>{t("sf.u18.receipts.operation")}</dt><dd class="sf-u18-ref">{receipt.idempotencyKey}</dd></dl>
      </details>
      <Show when={receipt.errors.length}>
        <h4>{t("sf.u18.receipts.errors")}</h4>
        <ul><For each={receipt.errors}>{(error) => <li>{error}</li>}</For></ul>
      </Show>
      <button type="button" class="mx-btn" disabled={view.busy} aria-pressed={selected()?.id === receipt.id}
        onClick={() => setView("selectedReceiptId", receipt.id)}>
        {language.t("sf.common.showDetails")}
      </button>
    </article>
  )

  const exactProducerReceipts = (): readonly SfReceipt[] => {
    const receipt = selected()
    if (!receipt) return []
    return [{
      ref: u18Ref(receipt.id), producer: receipt.surface,
      recordedAt: receipt.at, sourceVersion: receipt.version,
      effects: [receiptEffect(receipt)],
    }]
  }

  return <SfPageFrame
    titleKey={u18Key("sf.ui40.title")}
    context={view.caseData ? [{ id: "case", label: u18Message("sf.common.chooseCase"),
      value: { kind: "data", text: view.caseData.objective } }] : []}
    tabs={[]} activeTab={null} secondaryActions={[]} density="comfortable" layout="reading"
    onLayoutMode={() => undefined}
  >
    <div class="sf-decision-page sf-decision-receipts sf-workflow" data-sf-wave="four" data-sf-decision="UI40" data-sf-surface="UI40">
    <SfStatePanel state={currentState()} messageKey={u18ErrorKey(currentState())}
      onRetryRead={() => void read()}>
      <Show when={view.caseData}>
        {(data) => <>
          <section class="mx-card sf-u18-section sf-decision-receipt-ledger" aria-label={t("sf.u18.receipts.history")}>
            <h2>{t("sf.u18.receipts.history")}</h2>
            <Show when={ledger().length} fallback={<p>{t("sf.u18.receipts.noHistory")}</p>}>
              <div class="sf-u18-receipt-list">
                <For each={ledger()}>{(receipt) => displayReceipt(receipt)}</For>
              </div>
            </Show>
          </section>
          <Show when={selected()}>
            {(receipt) => <section class="sf-u18-section sf-decision-review-stage" aria-label={t("sf.u18.receipts.title")}>
              <Show when={change()} fallback={displayReceipt(receipt())}>
                {(prepared) => <SfReceiptView
                  operationRef={prepared().operationRef as SfOperationRef}
                  producerStatus={{ kind: "receipt-found" }}
                  effects={[receiptEffect(receipt())]}
                  receipts={exactProducerReceipts()}
                  state={currentState()}
                />}
              </Show>
              <Show when={view.outcome}>
                {(outcome) => <p role="status" class="mx-card">
                  {t("sf.u18.receipts.outcome")}: {outcome().outcome}
                  {" · "}{outcome().receiptId}
                </p>}
              </Show>
              <Show when={change()}>
                <button type="button" class="mx-btn" disabled={view.busy || !canRecover()}
                  onClick={() => void recover()}>{t("sf.u18.changes.recover")}</button>
                <details class="sf-decision-source-scope"><summary>{t("sf.u18.receipts.operation")}</summary><code>decisions.decision-recover</code></details>
              </Show>
              <Show when={view.recovery === "unknown"}>
                <p role="alert">{t("sf.u18.receipts.pending")}</p>
              </Show>
            </section>}
          </Show>
        </>}
      </Show>
    </SfStatePanel>
    </div>
  </SfPageFrame>
}

function sameRouteCase(routeRef: string, id: string, incarnation: string) {
  return `case:${encodeURIComponent(id)}:${encodeURIComponent(incarnation)}` === routeRef
}
