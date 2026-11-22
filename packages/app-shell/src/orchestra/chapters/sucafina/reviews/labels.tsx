import { useLanguage } from "@/context/language"
import type { SfContext } from "@orchestra/schema/sucafina/context"
import { SfDisplayValueText, type SfCopyKey } from "../shared/frame"

const key = (value: string) => value as SfCopyKey
const statusKey: Readonly<Record<string, SfCopyKey>> = {
  confirmed: key("sf.u44.evidenceConfirmed"),
  estimated: key("sf.u44.evidenceEstimated"),
  hypothetical: key("sf.u44.evidenceHypothetical"),
  unconfirmed: key("sf.u44.reasonUnconfirmed"),
  "incompatible-currency": key("sf.u44.reasonIncompatibleCurrency"),
  "missing-fx": key("sf.u44.reasonMissingFx"),
  "missing-rate": key("sf.u44.reasonMissingRate"),
  ready: key("sf.u32.statusReady"),
  true: key("sf.u44.yes"),
  false: key("sf.u44.no"),
  failed: key("sf.common.failed"),
  cancelled: key("sf.common.cancelled"),
  completed: key("sf.common.completed"),
  unavailable: key("sf.common.unavailable"),
  denied: key("sf.common.noAccess"),
  stale: key("sf.common.stale"),
  preparing: key("sf.common.running"),
  running: key("sf.common.running"),
  pending: key("sf.common.pending"),
  queued: key("sf.common.queued"),
  "needs-input": key("sf.common.needsInput"),
  "needs-review": key("sf.u27.needsInput"),
  conflict: key("sf.common.conflict"),
  partial: key("sf.common.partial"),
  missing: key("sf.u32.missing"),
  absent: key("sf.u32.missing"),
  restricted: key("sf.common.noAccess"),
  "not-applicable": key("sf.u32.notProvided"),
  "source-removed": key("sf.common.removed"),
  "material-change": key("sf.common.sourceChanged"),
  "source-replaced": key("sf.common.sourceChanged"),
  "dependency-change": key("sf.common.stale"),
  "access-unavailable": key("sf.common.noAccess"),
  "dependency-unavailable": key("sf.common.unavailable"),
  "unchanged-scope": key("sf.u32.unchanged"),
  valid: key("sf.u44.materialScopeReady"),
}

export function operationGranted(context: SfContext | undefined, operationId: string, scope?: { family?: string; resource?: string }) {
  return !!context?.availability.some((entry) =>
    (!scope?.family || entry.family === scope.family) &&
    (!scope?.resource || entry.resource === scope.resource) &&
    entry.operations.some((operation) => operation.operationId === operationId && operation.state === "ready" && operation.operational))
}

export function StatusText(props: { value: string }) {
  const language = useLanguage()
  const label = statusKey[props.value] ?? key("sf.common.unknown")
  return <>{language.t(label as Parameters<typeof language.t>[0])}</>
}

export function PeriodText(props: { start: string; end: string }) {
  return <>
    <SfDisplayValueText value={{ kind: "date", isoDate: props.start }} />
    {" – "}
    <SfDisplayValueText value={{ kind: "date", isoDate: props.end }} />
  </>
}

export function WhenText(props: { iso: string | undefined }) {
  const language = useLanguage()
  const iso = props.iso
  if (!iso) return <>{language.t("sf.common.unknown" as Parameters<typeof language.t>[0])}</>
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso)
  return <SfDisplayValueText value={dateOnly
    ? { kind: "date", isoDate: iso }
    : { kind: "timestamp", isoTimestamp: iso, timezone: "UTC" }} />
}

export function AmountText(props: { value: number | string | boolean | null; currency?: string | null }) {
  if (props.value === null) return <SfDisplayValueText value={{ kind: "missing", reason: { key: key("sf.u32.explicitNull") } }} />
  if (typeof props.value === "number" && Number.isFinite(props.value)) {
    return <SfDisplayValueText value={{
      kind: "number",
      value: props.value,
      fractionDigits: 2,
      unit: props.currency
        ? { kind: "currency", code: props.currency }
        : { kind: "unspecified", label: { key: key("sf.common.unknown") } },
    }} />
  }
  if (typeof props.value === "boolean") return <StatusText value={String(props.value)} />
  return <bdi>{props.value}</bdi>
}
