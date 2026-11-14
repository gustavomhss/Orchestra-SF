import { object, rows, text } from "../../runtime/contract.ts"
import { requestValue } from "../../src/procurement-screen.ts"
import type { RequestView } from "../../src/procurement-screen.ts"

export const PROCUREMENT_MONETARY_RULE_VERSION = "procurement-money-v3"

/** Computes the same monetary facts used by C02 and by scoped confirmations. */
export function procurementMonetaryFacts(record: Record<string, unknown>, baseCurrency: string, formSettings?: unknown) {
  const status = text(record.status)
  const known = ["draft", "pr_pending", "pr_rejected", "sourcing", "src_pending", "src_rejected", "po_draft", "po_pending", "po_rejected", "po_approved", "po_issued", "cancelled"].includes(status)
  const sourcing = object(record.sourcing)
  const po = object(record.po)
  const pr = object(record.pr)
  const lines = rows(po.lines)
  const selectedId = text(sourcing.selectedId)
  const selectedQuotes = selectedId ? rows(sourcing.quotes).filter((quote) => quote.id === selectedId) : []
  const selected = selectedQuotes.length === 1 ? selectedQuotes[0] : undefined
  // select_quote creates a future PO before the sourcing decision is submitted.
  const sourcingStage = ["sourcing", "src_pending", "src_rejected"].includes(status)
  const order = !sourcingStage && (lines.length > 0 || ["po_draft", "po_pending", "po_rejected", "po_approved", "po_issued"].includes(status))
  const quotation = !order && (!!selectedId || status === "src_pending" || sourcing.fxSnapshot != null || sourcing.approval != null || sourcing.approvalBaseCurrency != null)
  const lineTotal = lines.length && Array.isArray(po.lines) && lines.length === po.lines.length && lines.every((line) => typeof line.qty === "number" && typeof line.unitPrice === "number" && Number.isFinite(line.qty * line.unitPrice)) ? lines.reduce((sum, line) => sum + Number(line.qty) * Number(line.unitPrice), 0) : null
  const original = order
    ? lineTotal != null && Number.isFinite(lineTotal) ? lineTotal : null
    : selected ? typeof selected.total === "number" && Number.isFinite(selected.total) ? selected.total : null
      : quotation ? null
      : typeof pr.estAmount === "number" && Number.isFinite(pr.estAmount) ? pr.estAmount : null
  const frozen = order ? po.fxRate != null || po.approval != null || po.approvalBaseCurrency != null || ["po_pending", "po_approved", "po_issued"].includes(status) : quotation ? sourcing.fxSnapshot != null || sourcing.approval != null || sourcing.approvalBaseCurrency != null || status === "src_pending" : record.prApproval != null || record.prApprovalBaseCurrency != null || ["pr_pending", "sourcing", "src_rejected"].includes(status)
  // A submitted PR estimate is denominated in its submission base, even after Settings changes.
  const currencyInput = order ? text(po.currency) : quotation ? text(selected?.currency) : frozen ? text(record.prApprovalBaseCurrency) : baseCurrency
  const explicitCurrency = /^[A-Z]{3}$/.test(currencyInput) ? currencyInput : ""
  const currency = explicitCurrency
  const snapshot = order ? po.fxRate : quotation ? object(sourcing.fxSnapshot)[currency] : 1
  const live = rows(object(formSettings).fxRates).find((rate) => rate.code === currency)?.rate
  const submittedBase = order ? po.approvalBaseCurrency : quotation ? sourcing.approvalBaseCurrency : record.prApprovalBaseCurrency
  const rate = !currency || !/^[A-Z]{3}$/.test(baseCurrency) || frozen && submittedBase !== baseCurrency ? null : currency === baseCurrency ? 1 : frozen ? snapshot : live
  const validRate = typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : null
  const rates = { currency: baseCurrency, fxRates: rows(object(formSettings).fxRates).flatMap((rate) => typeof rate.code === "string" && typeof rate.rate === "number" ? [{ code: rate.code, rate: rate.rate }] : []) }
  const baseAmount = known && original != null && validRate != null ? requestValue((sourcingStage ? { ...record, po: null } : record) as RequestView, rates) : null
  const submittedApproval = order ? object(po.approval) : quotation ? object(sourcing.approval) : object(record.prApproval)
  const submittedCurrencyInput = order ? text(po.approvalBaseCurrency) : quotation ? text(sourcing.approvalBaseCurrency) : text(record.prApprovalBaseCurrency)
  const submittedCurrency = /^[A-Z]{3}$/.test(submittedCurrencyInput) ? submittedCurrencyInput : ""
  const submittedAmount = submittedCurrency && typeof submittedApproval.amount === "number" && Number.isFinite(submittedApproval.amount) ? submittedApproval.amount : null
  const submittedFxRate = submittedCurrency && currency === submittedCurrency ? 1 : submittedCurrency && typeof snapshot === "number" && Number.isFinite(snapshot) && snapshot > 0 ? snapshot : null
  const monetaryState = !known ? null : status === "po_issued" ? "issued-internally" : status === "po_approved" ? "approved" : status === "cancelled" ? "cancelled" : ["pr_pending", "src_pending", "po_pending"].includes(status) ? "pending-approval" : "estimate"
  const moneyEvidence = !known || monetaryState === "estimate" || !explicitCurrency ? "estimated" as const : "confirmed" as const
  const amountInput = order ? { lines: lines.map((line) => ({ qty: line.qty ?? null, unitPrice: line.unitPrice ?? null })) } : quotation ? { quoteId: text(sourcing.selectedId) || null, total: selected?.total ?? null, qty: selected?.qty ?? null, unitPrice: selected?.unitPrice ?? null } : { estimate: pr.estAmount ?? null }
  const currencyDependency = { currencyInput, baseCurrency }
  const fxDependency = { ...currencyDependency, frozen, submittedBase: frozen ? submittedBase ?? null : null, rate: rate ?? null }
  return { original, explicitCurrency, currency, validRate, baseAmount, submittedCurrency, submittedAmount, submittedFxRate, monetaryState, moneyEvidence, fxSource: validRate == null ? null : !explicitCurrency ? "base-default" : currency === baseCurrency ? "base" : frozen ? "submitted" : "current", amountInput, currencyDependency, fxDependency, submittedDependency: { amount: submittedApproval.amount ?? null, fxRate: submittedApproval.fxRate ?? null, submittedCurrency, snapshot: snapshot ?? null } }
}
