import { createMemo, createUniqueId, For, Show, type JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import type { SF_COMMON_COPY } from "@/i18n/orchestra-chapters/sf-common"
import type { SF_S03_COPY } from "@/i18n/orchestra-chapters/sf-s03"
import { SfStatePanel } from "../states"
import type {
  SfCopyKey, SfDisplayValue, SfMessage, SfText,
} from "../frame/types"
import type { SfReviewField, SfReviewSnapshot, SfEffect, SfChangeReviewProps } from "./types"
import { sfReviewComparison, sfReviewReasons, type SfReviewComparison } from "./compare"
import "./s03.css"

export type {
  SfReviewField, SfReviewSnapshot, SfEffect, SfReviewPurpose,
  SfCommandVersion, SfReviewBinding, SfReviewConfirmation, SfChangeReviewProps,
} from "./types"

type Translation = ReturnType<typeof useLanguage>
type SfPresentationKey = keyof typeof SF_COMMON_COPY | keyof typeof SF_S03_COPY | SfCopyKey

export function sfMessage(language: Translation, message: SfMessage): string {
  // SfCopyKey is a frozen dictionary brand; I00 merges S03 and F03 keys.
  return language.t(message.key as Parameters<typeof language.t>[0], message.params)
}

export function sfCopy(language: Translation, key: SfPresentationKey, params?: Record<string, string | number>): string {
  return language.t(key as Parameters<typeof language.t>[0], params)
}

export function sfText(language: Translation, value: SfText): string {
  return value.kind === "data" ? value.text : sfMessage(language, value.message)
}

const EFFECT_KEYS: Readonly<Record<SfEffect["state"], keyof typeof SF_S03_COPY>> = {
  proposed: "sf.s03.effect.proposed",
  blocked: "sf.s03.effect.blocked",
  applied: "sf.s03.effect.applied",
  "not-applied": "sf.s03.effect.not-applied",
  unknown: "sf.s03.effect.unknown",
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
              {sfCopy(language, EFFECT_KEYS[effect.state])}
            </span>
          </div>
          <Show when={effect.reason}>
            {(reason) => <p>{sfMessage(language, reason())}</p>}
          </Show>
          <Show when={effect.details.length > 0}>
            <details class="sf-s03-effect-details">
              <summary>{sfCopy(language, "sf.s03.effectDetails")}</summary>
              <SfReviewFieldList fields={effect.details} />
            </details>
          </Show>
        </li>
      )}</For>
    </ul>
  )
}

function SnapshotHeading(props: Readonly<{
  title: SfPresentationKey
  value: SfReviewSnapshot
}>): JSX.Element {
  const language = useLanguage()
  const snapshot = () => props.value.kind === "not-provided" ? undefined : props.value
  const version = () => {
    const value = snapshot()
    return value?.kind === "draft" ? value.sourceVersion : value?.version
  }
  const reference = () => {
    const value = snapshot()
    if (!value || value.kind === "source") return undefined
    return value.kind === "persisted" ? value.ref : value.sourceRef ?? value.intentRef
  }
  return (
    <section class="sf-s03-snapshot">
      <h3>{sfCopy(language, props.title)}</h3>
      <Show when={props.value.kind === "not-provided" ? props.value : undefined}>
        {(value) => <p class="sf-s03-snapshot-note">{sfMessage(language, value().reason)}</p>}
      </Show>
      <Show when={snapshot()}>
        <details class="sf-s03-provenance">
          <summary>{sfCopy(language, "sf.common.source")}</summary>
          <Show when={version() !== null && version() !== undefined}>
            <p>{sfCopy(language, "sf.s03.receiptVersion", { version: String(version()) })}</p>
          </Show>
          <Show when={props.value.kind === "source" ? props.value : undefined}>
            {(value) => <p>{sfText(language, value().scope)}</p>}
          </Show>
          <Show when={reference()}>{(ref) => <code>{ref()}</code>}</Show>
        </details>
      </Show>
    </section>
  )
}

function ComparisonValue(props: Readonly<{ field: SfReviewField | undefined }>): JSX.Element {
  const language = useLanguage()
  return (
    <Show when={props.field} fallback={<span class="sf-s03-absence">{sfCopy(language, "sf.s03.notSupplied")}</span>}>
      {(field) => <>
        <div class="sf-s03-field-value"><SfReviewValue value={field().value} /></div>
        <Show when={field().source}>
          {(source) => <details class="sf-s03-provenance">
            <summary>{sfText(language, source().label)}</summary>
            <p>{sfText(language, source().scope)}</p>
            <p>{sfCopy(language, "sf.s03.receiptVersion", { version: String(source().version) })}</p>
            <code>{source().ref}</code>
            <p>{sfMessage(language, source().coverage.summary)}</p>
            <Show when={source().coverage.reasons.length > 0}>
              <ul><For each={source().coverage.reasons}>{(reason) => <li>{sfMessage(language, reason)}</li>}</For></ul>
            </Show>
          </details>}
        </Show>
      </>}
    </Show>
  )
}

type ComparisonColumn = Readonly<{
  id: "base" | "current" | "proposed"
  title: SfPresentationKey
  value: SfReviewSnapshot
}>

function ComparisonField(props: Readonly<{
  field: SfReviewComparison
  columns: readonly ComparisonColumn[]
}>): JSX.Element {
  const language = useLanguage()
  const id = createUniqueId()
  return (
    <section class="sf-s03-comparison-field" data-difference={props.field.difference}
      data-source-changed={props.field.sourceChanged} aria-labelledby={id}>
      <header class="sf-s03-field-heading">
        <h4 id={id}>{sfMessage(language, props.field.label)}</h4>
        <Show when={props.field.difference === "changed"}>
          <span class="sf-s03-difference">{sfCopy(language, "sf.s03.changed")}</span>
        </Show>
        <Show when={props.field.sourceChanged}>
          <span class="sf-s03-source-change">{sfCopy(language, "sf.s03.sourceDifference")}</span>
        </Show>
      </header>
      <dl class="sf-s03-versions">
        <For each={props.columns}>{(column) => (
          <div class="sf-s03-version" data-version={column.id}>
            <dt>{sfCopy(language, column.title)}</dt>
            <dd><ComparisonValue field={props.field[column.id]} /></dd>
          </div>
        )}</For>
      </dl>
    </section>
  )
}

/** Producer-admitted read-only comparison; never dispatches a command. */
export function SfChangeReview(props: SfChangeReviewProps): JSX.Element {
  const language = useLanguage()
  const id = createUniqueId()
  const isRevoked = () => props.state === "denied" || props.state === "session-expired"
  const isUncertain = () => props.state === "outcome-unknown"
  const deleting = () => props.confirmation.kind === "admitted" && props.confirmation.purpose === "delete"
  const comparison = createMemo(() => isRevoked() ? [] : sfReviewComparison(props.base, props.current, props.proposed))
  const changed = () => comparison().filter((field) => field.difference === "changed").length
  const foreground = createMemo(() => [
    ...comparison().filter((field) => field.difference === "changed" || field.sourceChanged),
    ...comparison().filter((field) => field.difference === "unavailable" && !field.sourceChanged),
  ])
  const unchanged = createMemo(() => comparison().filter((field) => field.difference === "same" && !field.sourceChanged))
  const columns = createMemo(() => [
    ...(props.base === null ? [] : [{ id: "base" as const, title: "sf.s03.base" as const, value: props.base }]),
    ...(props.current === null ? [] : [{ id: "current" as const, title: "sf.common.currentSource" as const, value: props.current }]),
    { id: "proposed" as const, title: "sf.common.proposedValues" as const, value: props.proposed },
  ])
  const confirmationBlocked = () => !props.busy && props.confirmation.kind === "blocked"
  const mayConfirm = () =>
    !props.busy && (props.state === "ready" || props.state === "partial") &&
    props.coverage.state !== "unavailable" &&
    props.blockingReasons.length === 0 &&
    props.confirmation.kind === "admitted"
  const confirm = () => {
    const review = props.confirmation
    if (!mayConfirm() || review.kind !== "admitted") return
    props.onConfirm(review)
  }
  return (
    <section class="sf-s03-review" data-component="sf-change-review" data-state={props.state} data-purpose={props.confirmation.kind === "admitted" ? props.confirmation.purpose : undefined} aria-labelledby={id}>
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
          <p class="sf-s03-eyebrow">{sfCopy(language, "sf.common.review")}</p>
          <h2 id={id}>{sfMessage(language, props.operation.label)}</h2>
          <p class="sf-s03-scope">{sfText(language, props.operation.scope)}</p>
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

        <Show when={deleting()}>
          <p class="sf-s03-delete-notice">{sfCopy(language, "sf.s03.deleteEffect")}</p>
        </Show>

        <div class="sf-s03-comparison" style={{ "--sf-review-columns": String(columns().length) }}>
          <div class="sf-s03-comparison-heading">
            <h3>{sfCopy(language, "sf.s03.comparison")}</h3>
            <Show when={changed() > 0}>
              <span class="sf-s03-change-count">{sfCopy(language, "sf.s03.changedFields")}: {changed()}</span>
            </Show>
          </div>
          <div class="sf-s03-snapshot-headings">
            <For each={columns()}>{(column) => <SnapshotHeading title={column.title} value={column.value} />}</For>
          </div>
          <div class="sf-s03-comparison-rows">
            <For each={foreground()}>{(field) => <ComparisonField field={field} columns={columns()} />}</For>
            <Show when={unchanged().length > 0}>
              <details class="sf-s03-unchanged">
                <summary>{language.plural("sf.s03.unchangedFields", unchanged().length)}</summary>
                <For each={unchanged()}>{(field) => <ComparisonField field={field} columns={columns()} />}</For>
              </details>
            </Show>
            <Show when={comparison().length === 0}>
              <p class="sf-s03-absence">{sfCopy(language, "sf.s03.noFields")}</p>
            </Show>
          </div>
        </div>

        <Show when={props.effects.length > 0}>
          <section aria-label={sfCopy(language, "sf.s03.effects")}>
            <h3>{sfCopy(language, "sf.s03.effects")}</h3>
            <SfEffectList effects={props.effects} />
          </section>
        </Show>

        <Show when={props.blockingReasons.length > 0 || confirmationBlocked()}>
          <div class="sf-s03-notice" role="alert">
            <p>{sfCopy(language, "sf.s03.confirmationBlocked")}</p>
            <ul>
              <For each={sfReviewReasons([...props.blockingReasons, ...(confirmationBlocked() && props.confirmation.kind === "blocked" ? props.confirmation.reasons : [])])}>
                {(reason) => <li>{sfMessage(language, reason)}</li>}
              </For>
            </ul>
          </div>
        </Show>

        {props.confirmationContext}

        <footer class="sf-s03-footer">
          <div class="sf-s03-confirm-context">
            <strong>{sfMessage(language, props.operation.label)}</strong>
            <p>{sfText(language, props.operation.scope)}</p>
          </div>
          <div class="sf-s03-actions">
            <button type="button" class="mx-btn" disabled={props.busy} onClick={props.onCancel}>
              {sfCopy(language, "sf.s03.cancel")}
            </button>
            <button type="button" class="mx-btn" disabled={props.busy} onClick={props.onRevise}>
              {sfCopy(language, "sf.s03.revise")}
            </button>
            <button
              type="button"
              class="mx-btn sf-s03-confirm"
              classList={{ primary: !deleting(), danger: deleting() }}
              disabled={!mayConfirm()}
              onClick={confirm}
            >
              {deleting() ? sfMessage(language, props.operation.label) : sfCopy(language, props.confirmation.labelKey)}
            </button>
          </div>
        </footer>
      </Show>
    </section>
  )
}
