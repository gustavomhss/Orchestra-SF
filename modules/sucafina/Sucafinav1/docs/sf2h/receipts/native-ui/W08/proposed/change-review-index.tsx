import { createUniqueId, For, Show, type JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import type { SfIntentRef, SfOperationRef, SfRef, SfVersion } from "../../context/contracts"
import type { SfOperationId } from "@orchestra/schema/sucafina/common"
import { SfStatePanel } from "../states"
import type {
  SfCopyKey, SfCoverage, SfDisplayValue, SfMessage, SfSource,
  SfText, SfUiState,
} from "../frame"
import "./s03.css"

export type SfReviewField = Readonly<{
  path: string
  label: SfMessage
  value: SfDisplayValue
  source?: SfSource
}>

export type SfReviewSnapshot =
  | Readonly<{ kind: "persisted"; ref: SfRef; version: SfVersion; fields: readonly SfReviewField[] }>
  | Readonly<{ kind: "draft"; intentRef: SfIntentRef; sourceRef: SfRef | null; sourceVersion: SfVersion | null; fields: readonly SfReviewField[] }>
  | Readonly<{ kind: "not-provided"; reason: SfMessage }>

export type SfEffect = Readonly<{
  id: string
  domain:
    | "dashboard" | "planner" | "procurement" | "decisions"
    | "portfolio" | "files" | "reviews" | "collaboration" | "intelligence"
  title: SfText
  state: "proposed" | "blocked" | "applied" | "not-applied" | "unknown"
  details: readonly SfReviewField[]
  reason?: SfMessage
  receiptRef?: SfRef
}>

export type SfReviewPurpose =
  | "create" | "save" | "update" | "submit" | "approve" | "reject"
  | "select" | "apply" | "delete" | "cancel" | "issue" | "reset"
  | "spread" | "sync" | "copy" | "official" | "lock" | "unlock"
  | "activate" | "block" | "inactivate" | "change-bank" | "common"
  | "import" | "export" | "confirm" | "pause" | "prepare" | "run"

export type SfCommandVersion =
  | Readonly<{ kind: "record"; expectedVersion: SfVersion }>
  | Readonly<{ kind: "admission"; admissionRef: SfRef; expectedAdmissionVersion: number }>
  | Readonly<{ kind: "none" }>

export type SfReviewBinding =
  | Readonly<{ kind: "producer-review"; operationId: SfOperationId; reviewRef: SfRef; reviewDigest: string; baseVersion: SfVersion }>
  | Readonly<{ kind: "catalog-command"; operationId: SfOperationId; version: SfCommandVersion; confirmation: "presentation-only" | "producer-confirmed-field" }>

export type SfReviewConfirmation =
  | Readonly<{ kind: "blocked"; labelKey: SfCopyKey; reasons: readonly SfMessage[] }>
  | Readonly<{ kind: "admitted"; labelKey: SfCopyKey; purpose: SfReviewPurpose; binding: SfReviewBinding }>

export type SfChangeReviewProps = Readonly<{
  operation: Readonly<{ ref: SfOperationRef; label: SfMessage; scope: SfText }>
  base: SfReviewSnapshot | null
  current: SfReviewSnapshot | null
  proposed: SfReviewSnapshot
  effects: readonly SfEffect[]
  coverage: SfCoverage
  blockingReasons: readonly SfMessage[]
  confirmation: SfReviewConfirmation
  state: SfUiState
  onConfirm: (review: Extract<SfReviewConfirmation, { kind: "admitted" }>) => void
  onRevise: () => void
  onCancel: () => void
  onReconcile?: (operationRef: SfOperationRef) => void
}>

type Translation = ReturnType<typeof useLanguage>

export function sfMessage(language: Translation, message: SfMessage): string {
  // SfCopyKey is a frozen dictionary brand; I00 merges S03 and F03 keys.
  return language.t(message.key as Parameters<typeof language.t>[0], message.params)
}

export function sfCopy(language: Translation, key: string, params?: Record<string, string | number>): string {
  return language.t(key as Parameters<typeof language.t>[0], params)
}

export function sfText(language: Translation, value: SfText): string {
  return value.kind === "data" ? value.text : sfMessage(language, value.message)
}

// Values are display-only producer DTOs, not a financial/domain calculator.
// Never parse a source path, infer a number from missing, or compute an effect.
export function SfReviewValue(props: Readonly<{ value: SfDisplayValue }>): JSX.Element {
  const language = useLanguage()
  const rendered = (): JSX.Element => {
    const value = props.value
    switch (value.kind) {
      case "text":
        return <>{sfText(language, value.text)}</>
      case "number": {
        const options = {
          minimumFractionDigits: value.fractionDigits,
          maximumFractionDigits: value.fractionDigits,
        }
        if (value.unit.kind === "currency") {
          return <>{new Intl.NumberFormat(language.intl(), {
            ...options, style: "currency", currency: value.unit.code,
          }).format(value.value)}</>
        }
        if (value.unit.kind === "percent") {
          return <>{new Intl.NumberFormat(language.intl(), {
            ...options, style: "unit", unit: "percent",
          }).format(value.value)}</>
        }
        return (
          <span>
            <span>{new Intl.NumberFormat(language.intl(), options).format(value.value)}</span>
            {" "}
            <span>{sfMessage(language, value.unit.label)}</span>
          </span>
        )
      }
      case "boolean":
        return <>{sfMessage(language, value.value ? value.trueLabel : value.falseLabel)}</>
      case "date": {
        const date = new Date(`${value.isoDate}T00:00:00Z`)
        return <time dateTime={value.isoDate}>
          {Number.isNaN(date.getTime()) ? value.isoDate : new Intl.DateTimeFormat(language.intl(), {
            dateStyle: "medium", timeZone: "UTC",
          }).format(date)}
        </time>
      }
      case "timestamp": {
        const date = new Date(value.isoTimestamp)
        return <time dateTime={value.isoTimestamp}>
          {Number.isNaN(date.getTime()) ? value.isoTimestamp : new Intl.DateTimeFormat(language.intl(), {
            dateStyle: "medium", timeStyle: "short", timeZone: value.timezone,
          }).format(date)}
        </time>
      }
      case "missing":
      case "unavailable":
        return <>{sfMessage(language, value.reason)}</>
      case "list":
        return <ul class="sf-s03-value-list">
          <For each={value.items}>{(item) => <li><SfReviewValue value={item} /></li>}</For>
        </ul>
    }
  }
  return <>{rendered()}</>
}

export function SfReviewFieldList(props: Readonly<{ fields: readonly SfReviewField[] }>): JSX.Element {
  const language = useLanguage()
  return (
    <dl class="sf-s03-field-list">
      <For each={props.fields}>{(field) => (
        <div class="sf-s03-field">
          <dt>{sfMessage(language, field.label)}</dt>
          <dd><SfReviewValue value={field.value} /></dd>
          <Show when={field.source}>
            {(source) => <dd class="sf-s03-source">{sfText(language, source().label)}</dd>}
          </Show>
        </div>
      )}</For>
    </dl>
  )
}

export function SfEffectList(props: Readonly<{ effects: readonly SfEffect[] }>): JSX.Element {
  const language = useLanguage()
  return (
    <ul class="sf-s03-effects">
      <For each={props.effects}>{(effect) => (
        <li data-effect-state={effect.state}>
          <div class="sf-s03-effect-title">
            <strong>{sfText(language, effect.title)}</strong>
            <span class="sf-s03-effect-state">
              {sfCopy(language, `sf.s03.effect.${effect.state}`)}
            </span>
          </div>
          <Show when={effect.reason}>
            {(reason) => <p>{sfMessage(language, reason())}</p>}
          </Show>
          <Show when={effect.details.length > 0}>
            <SfReviewFieldList fields={effect.details} />
          </Show>
        </li>
      )}</For>
    </ul>
  )
}

function SnapshotColumn(props: Readonly<{
  title: string
  value: SfReviewSnapshot | null
}>): JSX.Element {
  const language = useLanguage()
  const headingId = createUniqueId()
  return (
    <section class="mx-card sf-s03-snapshot" aria-labelledby={headingId}>
      <h3 id={headingId}>{sfCopy(language, props.title)}</h3>
      <Show when={props.value} keyed fallback={<p>{sfCopy(language, "sf.s03.noOriginal")}</p>}>
        {(snapshot) => snapshot.kind === "not-provided"
          ? <p>{sfMessage(language, snapshot.reason)}</p>
          : <SfReviewFieldList fields={snapshot.fields} />}
      </Show>
    </section>
  )
}

/** Producer-admitted read-only comparison; never dispatches a command. */
export function SfChangeReview(props: SfChangeReviewProps): JSX.Element {
  const language = useLanguage()
  const id = createUniqueId()
  const isRevoked = () => props.state === "denied" || props.state === "session-expired"
  const isUncertain = () => props.state === "outcome-unknown"
  const mayConfirm = () =>
    (props.state === "ready" || props.state === "partial") &&
    props.coverage.state !== "unavailable" &&
    props.blockingReasons.length === 0 &&
    props.confirmation.kind === "admitted"
  const confirm = () => {
    const review = props.confirmation
    if (!mayConfirm() || review.kind !== "admitted") return
    props.onConfirm(review)
  }
  return (
    <section class="sf-s03-review" data-component="sf-change-review" data-state={props.state} aria-labelledby={id}>
      <Show
        when={!isRevoked()}
        fallback={
          <SfStatePanel
            state={props.state}
            messageKey={("sf.common.noAccess" as SfCopyKey)}
          />
        }
      >
        <header class="sf-s03-head">
          <h2 id={id}>{sfCopy(language, "sf.common.review")}</h2>
          <p>{sfMessage(language, props.operation.label)}</p>
          <p>{sfText(language, props.operation.scope)}</p>
        </header>

        <Show when={isUncertain()}>
          <div role="status" class="sf-s03-notice">
            {sfCopy(language, "sf.common.operationUnknown")}
            <Show when={props.onReconcile}>
              <button type="button" class="mx-btn" onClick={() => props.onReconcile?.(props.operation.ref)}>
                {sfCopy(language, "sf.s03.checkOutcome")}
              </button>
            </Show>
          </div>
        </Show>

        <section aria-label={sfCopy(language, "sf.s03.coverage")} class="sf-s03-coverage">
          <p role="status">{sfMessage(language, props.coverage.summary)}</p>
          <Show when={props.coverage.reasons.length > 0}>
            <ul><For each={props.coverage.reasons}>{(reason) => <li>{sfMessage(language, reason)}</li>}</For></ul>
          </Show>
        </section>

        <div class="sf-s03-snapshots">
          <Show when={props.base !== null}>
            <SnapshotColumn title="sf.s03.base" value={props.base} />
          </Show>
          <Show when={props.current !== null}>
            <SnapshotColumn title="sf.s03.current" value={props.current} />
          </Show>
          <SnapshotColumn title="sf.s03.proposed" value={props.proposed} />
        </div>

        <Show when={props.effects.length > 0}>
          <section aria-label={sfCopy(language, "sf.s03.effects")}>
            <h3>{sfCopy(language, "sf.s03.effects")}</h3>
            <SfEffectList effects={props.effects} />
          </section>
        </Show>

        <Show when={props.blockingReasons.length > 0 || props.confirmation.kind === "blocked"}>
          <div class="sf-s03-notice" role="alert">
            <p>{sfCopy(language, "sf.s03.confirmationBlocked")}</p>
            <ul>
              <For each={[...props.blockingReasons, ...(props.confirmation.kind === "blocked" ? props.confirmation.reasons : [])]}>
                {(reason) => <li>{sfMessage(language, reason)}</li>}
              </For>
            </ul>
          </div>
        </Show>

        <div class="sf-s03-actions">
          <button type="button" class="mx-btn" onClick={props.onCancel}>
            {sfCopy(language, "sf.s03.cancel")}
          </button>
          <button type="button" class="mx-btn" onClick={props.onRevise}>
            {sfCopy(language, "sf.s03.revise")}
          </button>
          <button
            type="button"
            class="mx-btn primary"
            disabled={!mayConfirm()}
            onClick={confirm}
          >
            {sfCopy(language, props.confirmation.labelKey)}
          </button>
        </div>
      </Show>
    </section>
  )
}
