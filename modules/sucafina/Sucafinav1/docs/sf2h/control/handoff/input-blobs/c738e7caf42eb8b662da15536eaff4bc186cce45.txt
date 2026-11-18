import { object, rows, text } from "../../runtime/contract.ts"
import { approvalStageEntry } from "../../src/procurement-screen.ts"
import type { RequestView } from "../../src/procurement-screen.ts"
import { procurementMonetaryFacts } from "./monetary.ts"

const FIELDS = ["status", "subject", "reason", "holder", "approvalStage", "nextStep", "stageEnteredAt", "baseAmount", "originalAmount", "originalCurrency", "fxRate", "fxSource", "monetaryState", "submittedAmount", "submittedCurrency", "submittedFxRate"] as const
const FINANCIAL = ["baseAmount", "originalAmount", "originalCurrency", "fxRate", "fxSource", "monetaryState", "submittedAmount", "submittedCurrency", "submittedFxRate"]
const STATUSES = ["draft", "pr_pending", "pr_rejected", "sourcing", "src_pending", "src_rejected", "po_draft", "po_pending", "po_rejected", "po_approved", "po_issued", "cancelled"]

export function isProcurementConfirmationFields(fields: readonly string[]) {
  return Array.isArray(fields) && fields.length > 0 && new Set(fields).size === fields.length && fields.every((field) => FIELDS.includes(field as typeof FIELDS[number]))
}

/** Status and the inputs needed for each selected fact are material dependencies. */
export function projectProcurementConfirmationFields(record: Record<string, unknown>, fields: readonly string[], options?: { currency: string; formSettings?: unknown }) {
  if (!isProcurementConfirmationFields(fields) || fields.some((field) => FINANCIAL.includes(field)) && (!options || !/^[A-Z]{3}$/.test(options.currency))) return undefined
  const raw = text(record.status)
  const status = STATUSES.includes(raw) ? raw : null
  const approval = object(raw === "pr_pending" ? record.prApproval : raw === "src_pending" ? object(record.sourcing).approval : raw === "po_pending" ? object(record.po).approval : null)
  const steps = rows(approval.steps)
  const pendingIndex = steps.findIndex((step) => step.status === "pending")
  const holder = pendingIndex < 0 ? undefined : steps[pendingIndex]
  const reason = ["draft", "pr_rejected", "pr_pending"].includes(raw) ? text(object(record.pr).justification) : raw === "src_pending" ? text(object(record.sourcing).selectionJustification) : raw === "po_pending" ? text(object(record.po).description) : ""
  const next = raw === "draft" ? "Complete and submit requisition" : raw === "pr_rejected" ? "Revise and resubmit requisition" : raw === "pr_pending" ? "Sourcing after all approvals" : raw === "sourcing" ? "Compare and select proposals" : raw === "src_rejected" ? "Revise and resubmit sourcing" : raw === "src_pending" ? "PO draft after all approvals" : raw === "po_draft" ? "Complete and submit purchase order" : raw === "po_rejected" ? "Revise and resubmit purchase order" : raw === "po_pending" ? "Internal issuance after all approvals" : raw === "po_approved" ? "Issue purchase order internally" : raw === "po_issued" ? "Issued internally" : raw === "cancelled" ? "Cancelled" : ""
  const money = options ? procurementMonetaryFacts(record, options.currency, options.formSettings) : undefined
  const values = { status, subject: text(object(record.pr).title) || null, reason: reason || null, holder: text(holder?.holderId) || null, approvalStage: text(holder?.levelName) || null, nextStep: next || null, stageEnteredAt: approvalStageEntry(record as RequestView), baseAmount: money?.baseAmount ?? null, originalAmount: money?.original != null && Number.isFinite(money.original) ? money.original : null, originalCurrency: money?.currency || null, fxRate: money?.validRate ?? null, fxSource: money?.fxSource ?? null, monetaryState: money?.monetaryState ?? null, submittedAmount: money?.submittedAmount ?? null, submittedCurrency: money?.submittedCurrency || null, submittedFxRate: money?.submittedFxRate ?? null }
  const dependencies = Object.fromEntries(fields.flatMap((field): [string, unknown][] => {
    if (field === "stageEnteredAt") return [[field, { entry: values.stageEnteredAt, pendingLevel: text(holder?.levelName) || null, previousLevel: pendingIndex > 0 ? text(steps[pendingIndex - 1]?.levelName) || null : null, previousStatus: pendingIndex > 0 ? text(steps[pendingIndex - 1]?.status) || null : null }]]
    if (!money) return []
    if (field === "baseAmount") return [[field, { amount: money.amountInput, fx: money.fxDependency }]]
    if (field === "originalAmount") return [[field, money.amountInput]]
    if (field === "originalCurrency") return [[field, money.currencyDependency]]
    if (field === "fxRate" || field === "fxSource") return [[field, money.fxDependency]]
    if (["submittedAmount", "submittedCurrency", "submittedFxRate"].includes(field)) return [[field, money.submittedDependency]]
    return []
  }))
  const states = Object.fromEntries(fields.map((field) => {
    const value = values[field as typeof FIELDS[number]]
    if (value == null) return [field, "absent"]
    if (field === "baseAmount" || field === "originalAmount") return [field, money?.moneyEvidence ?? "confirmed"]
    if (field === "originalCurrency" || field === "fxRate") return [field, money?.explicitCurrency ? "confirmed" : "estimated"]
    return [field, "confirmed"]
  }))
  const currencies = Object.fromEntries(fields.flatMap((field) => {
    if (field === "baseAmount" && options?.currency) return [[field, options.currency]]
    if (field === "originalAmount" && money?.currency) return [[field, money.currency]]
    if (field === "submittedAmount" && money?.submittedCurrency) return [[field, money.submittedCurrency]]
    return []
  }))
  return { status, values: Object.fromEntries(fields.map((field) => [field, values[field as typeof FIELDS[number]]])), dependencies, states, currencies }
}
