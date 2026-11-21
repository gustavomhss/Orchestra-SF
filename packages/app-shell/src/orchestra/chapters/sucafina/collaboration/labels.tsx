import { useLanguage } from "@/context/language"
import { SfDisplayValueText } from "../shared/frame"

const ENUM_KEY: Readonly<Record<string, string>> = {
  confirmed: "sf.u44.evidenceConfirmed",
  estimated: "sf.u44.evidenceEstimated",
  hypothetical: "sf.u44.evidenceHypothetical",
  absent: "sf.u44.evidenceAbsent",
  missing: "sf.u44.missing",
  unavailable: "sf.common.unavailable",
  restricted: "sf.common.noAccess",
  "not-applicable": "sf.u44.reasonNotApplicable",
  "incompatible-currency": "sf.u44.reasonIncompatibleCurrency",
  "missing-fx": "sf.u44.reasonMissingFx",
  "missing-rate": "sf.u44.reasonMissingRate",
  unconfirmed: "sf.u44.reasonUnconfirmed",
  valid: "sf.u44.validityValid",
  stale: "sf.common.stale",
  "unchanged-scope": "sf.u44.reasonUnchanged",
  "material-change": "sf.u44.reasonMaterialChange",
  "dependency-change": "sf.u44.reasonDependencyChange",
  "source-removed": "sf.common.removed",
  "source-replaced": "sf.u44.reasonSourceReplaced",
  "access-unavailable": "sf.common.noAccess",
  "dependency-unavailable": "sf.common.unavailable",
  true: "sf.u44.yes",
  false: "sf.u44.no",
}

export function sfEnumKey(value: string) {
  return ENUM_KEY[value] ?? "sf.common.unknown"
}
export function SfEnumText(props: { value: string }) {
  const language = useLanguage()
  return <>{language.t(sfEnumKey(props.value) as Parameters<typeof language.t>[0])}</>
}

export function SfPeriodText(props: { start: string; end: string }) {
  return (
    <>
      <SfDisplayValueText value={{ kind: "date", isoDate: props.start }} />
      {" – "}
      <SfDisplayValueText value={{ kind: "date", isoDate: props.end }} />
    </>
  )
}

export function SfWhenText(props: { iso: string }) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(props.iso)
  return (
    <SfDisplayValueText value={dateOnly
      ? { kind: "date", isoDate: props.iso }
      : { kind: "timestamp", isoTimestamp: props.iso, timezone: "UTC" }} />
  )
}

export function SfAmountText(props: { value: string | number | boolean | null; currency?: string }) {
  const language = useLanguage()
  if (props.value === null) return <SfEnumText value="missing" />
  if (typeof props.value === "boolean") return <SfEnumText value={String(props.value)} />
  if (typeof props.value !== "number" || !Number.isFinite(props.value)) return <bdi>{props.value}</bdi>
  if (props.currency) {
    return (
      <SfDisplayValueText value={{
        kind: "number",
        value: props.value,
        fractionDigits: 2,
        unit: { kind: "currency", code: props.currency },
      }} />
    )
  }
  return <span class="sf-numeric" dir="auto">{new Intl.NumberFormat(language.intl()).format(props.value)}</span>
}
