import { Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { PeriodText, StatusText } from "../labels"
import { preservedValuePresentation, type PreservedValuePresentation } from "./presentation"
import type { PreservedValue } from "./model"

export function SfPreservedRecordLabel(props: { presentation: PreservedValuePresentation }) {
  const language = useLanguage()
  return <>
    <Show when={props.presentation.recordKey} fallback={<bdi>{props.presentation.recordRef}</bdi>}>
      {(key) => <>{language.t(key())}<span> · <bdi>{props.presentation.recordName ?? props.presentation.recordRef}</bdi></span></>}
    </Show>
  </>
}

export function SfPreservedFieldLabel(props: { value: PreservedValue; values: readonly PreservedValue[] }) {
  const language = useLanguage()
  const label = () => preservedValuePresentation(props.value, props.values).fieldKey
  return <Show when={label()} fallback={<bdi>{props.value.id}</bdi>}>{(key) => language.t(key())}</Show>
}

/** A bare scalar is literal. Only producer-declared currency/unit admits numeric formatting. */
export function SfPreservedValueText(props: { value: PreservedValue }) {
  const language = useLanguage()
  const value = () => props.value.value
  const formatted = () => {
    const current = value()
    if (current === null) return language.t("sf.u32.missing")
    if (typeof current === "number" && (props.value.currency || props.value.unit))
      return new Intl.NumberFormat(language.intl(), { maximumSignificantDigits: 21 }).format(current)
    return String(current)
  }
  return <span class="sf-preserved-value">
    <Show when={typeof value() === "boolean"} fallback={<bdi classList={{ "sf-numeric": typeof value() === "number" }}>{formatted()}</bdi>}>
      <StatusText value={String(value())} />
    </Show>
    <Show when={props.value.currency}>
      <small>{props.value.currency === "unspecified" ? language.t("sf.u32.currencyNotProvided") : props.value.currency}</small>
    </Show>
    <Show when={props.value.unit && props.value.unit !== props.value.currency}><small>{props.value.unit}</small></Show>
  </span>
}

export function SfPreservedValuePeriod(props: { value: PreservedValue }) {
  return <small class="sf-preserved-period"><PeriodText start={props.value.period.start} end={props.value.period.end} /></small>
}
