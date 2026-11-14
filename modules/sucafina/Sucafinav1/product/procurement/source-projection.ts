import { roleMap } from "../../runtime/admin.ts"
import { object, rows, text } from "../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../runtime/contract.ts"
import { domain } from "../../runtime/procurement.ts"
import type { Surface } from "../../src/identity.ts"
import { procurementKeys } from "../../src/nav.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { SfSourceScope } from "../integration/source-lifecycle.ts"
import { projectProcurementConfirmationFields } from "./confirmation-fields.ts"
import { digestProcurementSource } from "./sources.ts"

export const procurementRequestFields = ["status", "holder", "approvalStage", "stageEnteredAt", "ageDays", "baseAmount", "submittedAmount", "submittedCurrency", "submittedFxRate", "originalAmount", "originalCurrency", "fxRate", "fxSource", "monetaryState", "subject", "reason", "nextStep", "sourcing"] as const
export const procurementSupplierFields = ["number", "legalName", "status", "categories", "taxId"] as const
const statuses = ["draft", "pr_pending", "pr_rejected", "sourcing", "src_pending", "src_rejected", "po_draft", "po_pending", "po_rejected", "po_approved", "po_issued", "cancelled"]

/** Install in createSfSourcePersistence.projectScope so every committed mutation refreshes material identity. */
export function projectProcurementScope(surface: Surface, snapshot: Snapshot, scope: SfSourceScope) {
  const selector = object(scope.selector)
  if (surface !== "procurement" || selector.roleMapDigest !== digestSfValue(roleMap(snapshot, "procurement")) || typeof selector.canWrite !== "boolean" || !Array.isArray(selector.roles) || !selector.roles.every((role): role is string => typeof role === "string") || !procurementKeys({ roles: selector.roles }).length) return undefined
  const actor: Actor = { id: scope.principalRef, roles: selector.roles, canWrite: selector.canWrite, assigned: [], domains: [] }
  const view = domain.view(snapshot, actor, { at: "1970-01-01T00:00:00Z", directory: [], id: () => "" })
  if (selector.kind === "procurement-confirmation-v1" && scope.recordType === "procurement-request") {
    if (!isSfPeriod(selector.period) || typeof selector.currency !== "string" || !/^[A-Z]{3}$/.test(selector.currency) || selector.currency !== text(object(view.data.formSettings).currency) || !Array.isArray(selector.fields) || !selector.fields.every((field): field is string => typeof field === "string") || digestSfValue(selector.fields) !== digestSfValue([...selector.fields].sort())) return undefined
    const records = rows(view.data.requests).filter((record) => record.number === scope.recordId)
    if (records.length !== 1) return undefined
    const material = projectProcurementConfirmationFields(records[0]!, selector.fields, { currency: selector.currency, formSettings: view.data.formSettings })
    return material ? { id: scope.recordId, ...material } : undefined
  }
  if (selector.kind === "procurement-record-v1" && (scope.recordType === "procurement-request" || scope.recordType === "procurement-supplier")) {
    if (!isSfPeriod(selector.period) || typeof selector.currency !== "string" || !/^[A-Z]{3}$/.test(selector.currency) || selector.currency !== text(object(view.data.formSettings).currency)) return undefined
    const fields = scope.recordType === "procurement-request" ? procurementRequestFields : procurementSupplierFields
    const legacyFields = scope.recordType === "procurement-request" ? fields.filter((field) => field !== "approvalStage") : fields
    if (digestSfValue(selector.fields) !== digestSfValue(fields) && digestSfValue(selector.fields) !== digestSfValue(legacyFields)) return undefined
    const records = rows(scope.recordType === "procurement-request" ? view.data.requests : view.data.suppliers).filter((record) => (scope.recordType === "procurement-request" ? record.number : record.id) === scope.recordId)
    if (records.length !== 1) return undefined
    return { id: scope.recordId, privateDependencyDigest: digestProcurementSource(records[0], view.data.formSettings, scope.recordType === "procurement-supplier" ? "supplier" : "request") }
  }
  if (scope.recordType !== "procurement-request-selection" || scope.recordId !== "all" || selector.kind !== "procurement-selection-v1" || typeof selector.status !== "string" || !["all", "unknown", ...statuses].includes(selector.status)) return undefined
  const records = rows(view.data.requests).map((record) => ({ id: text(record.number), status: statuses.includes(text(record.status)) ? text(record.status) : "unknown", privateDependencyDigest: digestProcurementSource(record, view.data.formSettings) })).filter((record) => selector.status === "all" || record.status === selector.status).sort((a, b) => a.id.localeCompare(b.id))
  if (records.some((record) => !record.id) || new Set(records.map((record) => record.id)).size !== records.length) return undefined
  return { records }
}
