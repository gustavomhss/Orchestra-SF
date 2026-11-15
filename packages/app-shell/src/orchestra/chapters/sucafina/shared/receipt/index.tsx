import { createUniqueId, For, Show, type JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import type { SfOperationRef, SfRef, SfVersion } from "@orchestra/schema/sucafina/context"
import { SfStatePanel } from "../states"
import type { SfCopyKey, SfMessage, SfSource, SfUiState } from "../frame"
import { SfEffectList, sfCopy, sfMessage, type SfEffect } from "../change-review"
import "../change-review/s03.css"

export type SfReceipt = Readonly<{
  ref: SfRef
  producer: string
  recordedAt: string
  sourceVersion: SfVersion | null
  effects: readonly SfEffect[]
}>

export type SfProducerOutcome =
  | Readonly<{ kind: "receipt-found" }>
  | Readonly<{ kind: "confirmed-by-authorized-refetch"; source: SfSource }>
  | Readonly<{ kind: "pending" }>
  | Readonly<{ kind: "not-found" }>
  | Readonly<{ kind: "unavailable"; reason: SfMessage }>

export type SfReceiptViewProps = Readonly<{
  operationRef: SfOperationRef
  producerStatus: SfProducerOutcome
  effects: readonly SfEffect[]
  receipts: readonly SfReceipt[]
  state: SfUiState
  onReconcileRead?: (operationRef: SfOperationRef) => void
  onOpenSource?: (sourceRef: SfRef) => void
}>

/**
 * A receipt is displayed only when delivered by the original producer.
 * A separately-authorized reread can confirm an outcome but is never rendered
 * as though a producer receipt had been issued.
 */
export function SfReceiptView(props: SfReceiptViewProps): JSX.Element {
  const language = useLanguage()
  const headingId = createUniqueId()
  const redacted = () => props.state === "denied" || props.state === "session-expired"
  const outcomeNotice = () => {
    const outcome = props.producerStatus
    if (outcome.kind === "not-found") return sfCopy(language, "sf.s03.receiptNotFound")
    if (outcome.kind === "unavailable") return sfCopy(language, "sf.s03.receiptUnavailable")
    return sfCopy(language, "sf.s03.pendingReceipt")
  }
  const unavailableOutcome = () => {
    const status = props.producerStatus
    return status.kind === "unavailable" ? status : undefined
  }
  const confirmedOutcome = () => {
    const status = props.producerStatus
    return status.kind === "confirmed-by-authorized-refetch" ? status : undefined
  }
  const uncertain = () =>
    props.state === "outcome-unknown" ||
    props.producerStatus.kind === "pending" ||
    props.producerStatus.kind === "not-found" ||
    props.producerStatus.kind === "unavailable" ||
    (props.producerStatus.kind === "receipt-found" && props.receipts.length === 0)

  return (
    <section class="sf-s03-receipts" data-component="sf-receipt-view" data-state={props.state} aria-labelledby={headingId}>
      <Show
        when={!redacted()}
        fallback={<SfStatePanel state={props.state} messageKey={("sf.common.noAccess" as SfCopyKey)} />}
      >
        <h2 id={headingId}>{sfCopy(language, "sf.s03.receipts")}</h2>

        <Show when={uncertain()}>
          <div class="sf-s03-notice" role="status" data-outcome="unconfirmed">
            <p>
              {outcomeNotice()}
            </p>
            <Show when={unavailableOutcome()} keyed>
              {(outcome) => <p>{sfMessage(language, outcome.reason)}</p>}
            </Show>
            <Show when={props.onReconcileRead}>
              <button type="button" class="mx-btn" onClick={() => props.onReconcileRead?.(props.operationRef)}>
                {sfCopy(language, "sf.s03.checkOutcome")}
              </button>
            </Show>
          </div>
        </Show>

        <Show
          when={confirmedOutcome()}
          keyed
        >
          {(confirmed) => (
            <div class="sf-s03-notice" role="status" data-outcome="confirmed-by-refetch">
              <p>{sfCopy(language, "sf.s03.confirmedRefetch")}</p>
              <p>{confirmed.source.label.kind === "data"
                ? confirmed.source.label.text
                : sfMessage(language, confirmed.source.label.message)}</p>
              <Show when={props.onOpenSource}>
                <button
                  type="button"
                  class="mx-btn"
                  onClick={() => props.onOpenSource?.(confirmed.source.ref)}
                >
                  {sfCopy(language, "sf.s03.openAuthorizedSource")}
                </button>
              </Show>
            </div>
          )}
        </Show>

        <Show when={props.receipts.length > 0}>
          <ol class="sf-s03-receipt-list">
            <For each={props.receipts}>{(receipt) => (
              <li class="mx-card" data-receipt="producer">
                <p>{sfCopy(language, "sf.s03.receiptProducer", { producer: receipt.producer })}</p>
                <p>{sfCopy(language, "sf.s03.receiptRecorded", { time: receipt.recordedAt })}</p>
                <Show when={receipt.sourceVersion !== null}>
                  <p>{sfCopy(language, "sf.s03.receiptVersion", { version: receipt.sourceVersion ?? "" })}</p>
                </Show>
                <Show when={receipt.effects.length > 0}>
                  <SfEffectList effects={receipt.effects} />
                </Show>
              </li>
            )}</For>
          </ol>
        </Show>

        <Show when={props.receipts.length === 0 && !uncertain() && props.producerStatus.kind !== "confirmed-by-authorized-refetch"}>
          <p>{sfCopy(language, "sf.s03.noReceipts")}</p>
        </Show>

        <Show when={props.effects.length > 0}>
          <section aria-label={sfCopy(language, "sf.s03.effects")}>
            <h3>{sfCopy(language, "sf.s03.effects")}</h3>
            <SfEffectList effects={props.effects} />
          </section>
        </Show>
      </Show>
    </section>
  )
}
