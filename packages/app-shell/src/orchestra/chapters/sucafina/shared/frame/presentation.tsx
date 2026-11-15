import { For, Show, createUniqueId } from "solid-js"
import type { JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import { SF_COMMON_COPY } from "@/i18n/orchestra-chapters/sf-common"
import type {
  SfAction,
  SfCopyKey,
  SfCoverage,
  SfDisplayValue,
  SfMessage,
  SfText,
  SfUiState,
  SfUnit,
} from "./types"

export function sfCommonKey(key: keyof typeof SF_COMMON_COPY): SfCopyKey {
  return key as SfCopyKey
}

// The shared catalogue supplies every new message verbatim in en and pt-BR.
// I00 registers it in language.tsx's existing Orchestra dictionary.
// Preserve dynamic data and parameter values: they must never become copy keys.
export function useSfPresentation() {
  const language = useLanguage()
  const t = (key: SfCopyKey, params?: Readonly<Record<string, string | number>>) =>
    language.t(key as Parameters<typeof language.t>[0], params ? { ...params } : undefined)
  return { t, locale: language.intl }
}

export function SfMessageText(props: { message: SfMessage }) {
  const { t } = useSfPresentation()
  return <>{t(props.message.key, props.message.params)}</>
}

export function SfTextValue(props: { value: SfText }) {
  return (
    <>
      <Show when={props.value.kind === "data" ? props.value : undefined}>
        {(value) => <bdi>{value().text}</bdi>}
      </Show>
      <Show when={props.value.kind === "message" ? props.value : undefined}>
        {(value) => <SfMessageText message={value().message} />}
      </Show>
    </>
  )
}

function formattedNumber(value: number, digits: number, locale: string) {
  if (!Number.isFinite(value) || digits < 0 || digits > 20 || !Number.isInteger(digits)) return null
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

function dateLabel(iso: string, locale: string, timezone: string | undefined) {
  const date = new Date(timezone ? iso : `${iso}T00:00:00Z`)
  if (!Number.isFinite(date.getTime())) return iso
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      ...(timezone ? { timeStyle: "short", timeZone: timezone } : { timeZone: "UTC" }),
    }).format(date)
  } catch {
    // Preserve the producer's exact value instead of guessing a timezone.
    return iso
  }
}

export function SfUnitText(props: { unit: SfUnit }) {
  return (
    <>
      <Show when={props.unit.kind === "currency" ? props.unit : undefined}>
        {(unit) => <bdi>{unit().code}</bdi>}
      </Show>
      <Show when={props.unit.kind === "percent"}>%</Show>
      <Show when={props.unit.kind === "quantity" || props.unit.kind === "unspecified" ? props.unit : undefined}>
        {(unit) => <SfMessageText message={unit().label} />}
      </Show>
    </>
  )
}

export function SfDisplayValueText(props: { value: SfDisplayValue }) {
  const { locale } = useSfPresentation()
  return (
    <>
      <Show when={props.value.kind === "text" ? props.value : undefined}>
        {(value) => <SfTextValue value={value().text} />}
      </Show>
      <Show when={props.value.kind === "number" ? props.value : undefined}>
        {(number) => (
          <span class="sf-numeric" dir="auto">
            {formattedNumber(number().value, number().fractionDigits, locale()) ??
              <SfMessageText message={{ key: sfCommonKey("sf.common.unknown") }} />}
            <span class="sf-unit"><SfUnitText unit={number().unit} /></span>
          </span>
        )}
      </Show>
      <Show when={props.value.kind === "boolean" ? props.value : undefined}>
        {(value) => <SfMessageText message={value().value ? value().trueLabel : value().falseLabel} />}
      </Show>
      <Show when={props.value.kind === "date" ? props.value : undefined}>
        {(value) => (
          <time dateTime={value().isoDate}>
            {dateLabel(value().isoDate, locale(), undefined)}
          </time>
        )}
      </Show>
      <Show when={props.value.kind === "timestamp" ? props.value : undefined}>
        {(value) => (
          <time dateTime={value().isoTimestamp}>
            {dateLabel(value().isoTimestamp, locale(), value().timezone)}
          </time>
        )}
      </Show>
      <Show when={props.value.kind === "missing" || props.value.kind === "unavailable" ? props.value : undefined}>
        {(value) => <span class="sf-missing"><SfMessageText message={value().reason} /></span>}
      </Show>
      <Show when={props.value.kind === "list" ? props.value : undefined}>
        {(value) => (
          <ul class="sf-value-list">
            <For each={value().items}>
              {(item) => <li><SfDisplayValueText value={item} /></li>}
            </For>
          </ul>
        )}
      </Show>
    </>
  )
}

export function SfCoverageView(props: { coverage: SfCoverage; compact?: boolean }): JSX.Element {
  return (
    <div class="sf-coverage" data-sf-coverage={props.coverage.state}>
      <strong><SfMessageText message={props.coverage.summary} /></strong>
      <Show when={!props.compact && props.coverage.reasons.length > 0}>
        <ul class="sf-coverage-reasons">
          <For each={props.coverage.reasons}>{(reason) => <li><SfMessageText message={reason} /></li>}</For>
        </ul>
      </Show>
    </div>
  )
}

export function SfActionButton(props: { action: SfAction; variant?: "primary" | "secondary" }): JSX.Element {
  const { t } = useSfPresentation()
  const actionId = `sf-action-${createUniqueId()}`
  const disabled = () => props.action.disabled || props.action.busy
  return (
    <span class="sf-action" data-sf-action={props.action.id}>
      <button
        type="button"
        class="mx-btn sf-action-button"
        classList={{
          primary: props.variant === "primary" && props.action.tone !== "danger",
          "sf-danger": props.action.tone === "danger",
        }}
        disabled={disabled()}
        aria-busy={props.action.busy}
        aria-describedby={props.action.reasonKey ? actionId : undefined}
        onClick={() => { if (!disabled()) props.action.onInvoke() }}
      >
        {t(props.action.labelKey, props.action.labelParams)}
        <Show when={props.action.busy}>
          <span class="sf-action-running" role="status">{t(sfCommonKey("sf.common.running"))}</span>
        </Show>
      </button>
      <Show when={props.action.reasonKey}>
        <small class="sf-action-reason" id={actionId}>
          {t(props.action.reasonKey!)}
        </small>
      </Show>
    </span>
  )
}

export const SF_STATE_FALLBACK_KEY: Readonly<Record<SfUiState, keyof typeof SF_COMMON_COPY>> = {
  loading: "sf.common.loading",
  ready: "sf.common.currentSource",
  empty: "sf.common.empty",
  "filtered-empty": "sf.common.filterEmpty",
  partial: "sf.common.partial",
  invalid: "sf.common.fieldErrorSummary",
  "not-found": "sf.common.removed",
  stale: "sf.common.stale",
  conflict: "sf.common.conflict",
  unavailable: "sf.common.unavailable",
  denied: "sf.common.noAccess",
  "session-expired": "sf.common.loginAgain",
  "outcome-unknown": "sf.common.operationUnknown",
}
