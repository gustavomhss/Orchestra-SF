import { SfProcurement, SfProcurementSettings } from "@orchestra/schema/sucafina/procurement"
import type { SfIntentRef, SfOperationRef, SfRef, SfVersion } from "@orchestra/schema/sucafina/context"
import type { SfCopyKey, SfDisplayValue, SfMessage } from "../../shared/frame/types"
import type { SfChangeReviewProps, SfReviewField, SfReviewSnapshot } from "../../shared/change-review/types"

export type Settings = typeof SfProcurementSettings.Type
export type SettingsProjection = Extract<
  typeof SfProcurement.operations["domain.page.CAP28"]["output"]["Type"],
  { status: "ok" }
>

/** A first-write CAS is an explicit producer fact, never inferred from a missing version. */
export function settingsVersion(current: SettingsProjection | undefined): number | undefined {
  if (!current) return undefined
  const initial = current.value.data.settingsInitialization
  if (initial) return Object.hasOwn(current.value.versions, "settings") ? undefined : initial.expectedVersion
  return current.value.versions.settings?.version
}

export const SETTINGS_REF = "settings" as SfRef
export const SETTINGS_INTENT = "settings-configuration-edit" as SfIntentRef
export const settingsLabel: Readonly<Partial<Record<keyof Settings, string>>> = {
  currency: "sf.u36.currency",
  levels: "sf.u36.matrix",
  prApprovalMode: "sf.u36.mode",
  blockSelfApproval: "sf.u36.self",
  fxRates: "sf.u36.currencies",
  minQuotes: "sf.u36.minimum",
  techWeight: "sf.u36.techWeight",
  commWeight: "sf.u36.commWeight",
  criteria: "sf.u36.technical",
  commCriteria: "sf.u36.commercial",
  requireActiveSupplier: "sf.u36.active",
  paymentTerms: "sf.u36.paymentTerms",
  categories: "sf.u36.categories",
  incoterms: "sf.u36.incoterms",
  billingAddress: "sf.u36.invoice",
  defaultDeliveryAddress: "sf.u36.delivery",
  fxUpdated: "sf.u36.rateDate",
  reminderDays: "sf.u36.reminder",
  escalationDays: "sf.u36.escalation",
  uploadCap: "sf.u36.upload",
}
const message = (key: string): SfMessage => ({ key: key as SfCopyKey })
const valueText = (text: string): SfDisplayValue => ({ kind: "text", text: { kind: "data", text } })

/** Pure presentation of exact source fields, not a policy or financial diff.
 * Missing stays missing, numeric zero stays zero, nested values remain data. */
export function displayValue(value: unknown): SfDisplayValue {
  if (value === null || value === undefined)
    return { kind: "missing", reason: message("sf.common.unknown") }
  if (Array.isArray(value))
    return { kind: "list", items: value.map((entry) => displayValue(entry)) }
  if (typeof value === "object")
    return { kind: "list", items: Object.entries(value).map(([key, entry]) =>
      valueText(key + ": " + (entry === null || entry === undefined
        ? "null" : typeof entry === "object" ? JSON.stringify(entry) : String(entry)))) }
  return valueText(String(value))
}
export function changedSettings(base: Readonly<Settings>, draft: Readonly<Settings>): readonly (keyof Settings)[] {
  return (Object.keys(settingsLabel) as (keyof Settings)[]).filter((name) =>
    (Object.hasOwn(base, name) || Object.hasOwn(draft, name)) &&
    JSON.stringify(base[name]) !== JSON.stringify(draft[name]))
}
function fields(settings: Readonly<Settings>, names: readonly (keyof Settings)[]): readonly SfReviewField[] {
  return names.map((name) => ({
    path: String(name),
    label: message(settingsLabel[name] ?? "sf.common.unknown"),
    value: displayValue(settings[name]),
  }))
}
export function settingsReview(
  current: SettingsProjection, proposed: Readonly<Settings>, operationRef: SfOperationRef,
  action: "save" | "reset" = "save",
): Omit<SfChangeReviewProps, "onConfirm" | "onRevise" | "onCancel"> {
  const persistedVersion = current.value.versions.settings?.version
  const sourceVersion = settingsVersion(current)
  const names = action === "reset"
    ? (Object.keys(settingsLabel) as (keyof Settings)[]).filter((name) =>
        Object.hasOwn(current.value.data.settings, name) || Object.hasOwn(proposed, name))
    : changedSettings(current.value.data.settings, proposed)
  const base: SfReviewSnapshot = persistedVersion === undefined
    ? { kind: "not-provided", reason: message("sf.common.previousValuesUnavailable") }
    : { kind: "persisted", ref: SETTINGS_REF, version: persistedVersion as SfVersion,
        fields: fields(current.value.data.settings, names) }
  const draft: SfReviewSnapshot = {
    kind: "draft", intentRef: SETTINGS_INTENT, sourceRef: SETTINGS_REF,
    sourceVersion: sourceVersion ?? null, fields: fields(proposed, names),
  }
  const blocked = sourceVersion === undefined || names.length === 0 ||
    action === "reset" && current.value.data.resetSettings !== proposed
  const reasons: SfMessage[] = blocked
    ? [message(sourceVersion === undefined ? "sf.common.previousValuesUnavailable" : "sf.common.changesPending")]
    : []
  return {
    operation: {
      ref: operationRef,
      label: message(action === "reset" ? "sf.u36.reset" : "sf.u36.save"),
      scope: { kind: "message", message: message("sf.cap28.title") },
    },
    base, current: base, proposed: draft, effects: [],
    coverage: {
      state: sourceVersion === undefined ? "unavailable" : "partial",
      summary: message(sourceVersion === undefined ? "sf.common.previousValuesUnavailable" : "sf.common.partial"),
      reasons: sourceVersion !== undefined && persistedVersion === undefined
        ? [message("sf.common.previousValuesUnavailable")] : reasons,
      knownCount: names.length, expectedCount: null,
    },
    blockingReasons: reasons,
    confirmation: blocked
      ? { kind: "blocked", labelKey: message("sf.common.unavailable").key, reasons }
      : {
          kind: "admitted",
          labelKey: message(action === "reset" ? "sf.u36.reset" : "sf.common.save").key,
          purpose: action,
          binding: {
            kind: "catalog-command", operationId: action === "reset" ? "domain.command.CAP28.reset" : "domain.command.CAP28.save",
            version: { kind: "record", expectedVersion: sourceVersion! },
            confirmation: "presentation-only",
          },
        },
    state: sourceVersion === undefined ? "unavailable" : "ready",
  }
}
