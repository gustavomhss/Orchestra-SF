import { object, rows, text } from "../../runtime/contract.ts"

/** Computes the same monetary facts used by C02 and by scoped confirmations. */
export function procurementMonetaryFacts(record: Record<string, unknown>, baseCurrency: string, formSettings?: unknown) {
  const status = text(record.status)
  const known = ["draft", "pr_pending", "pr_rejected", "sourcing", "src_pending", "src_rejected", "po_draft", "po_pending", "po_rejected", "po_approved", "po_issued", "cancelled"].includes(status)
  const sourcing = object(record.sourcing)
  const po = object(record.po)
  const pr = object(record.pr)
  const lines = rows(po.lines)
  const selected = rows(sourcing.quotes).find((quote) => quote.id === sourcing.selectedId)
  const original = lines.length
    ? lines.every((line) => typeof line.qty === "number" && typeof line.unitPrice === "number" && Number.isFinite(line.qty * line.unitPrice)) ? lines.reduce((sum, line) => sum + Number(line.qty) * Number(line.unitPrice), 0) : null
    : selected ? typeof selected.total === "number" && Number.isFinite(selected.total) ? selected.total : null
      : typeof pr.estAmount === "number" && Number.isFinite(pr.estAmount) ? pr.estAmount : null
  const currencyInput = lines.length ? text(po.currency) : selected ? text(selected.currency) : baseCurrency
  const explicitCurrency = /^[A-Z]{3}$/.test(currencyInput) ? currencyInput : ""
  const currency = explicitCurrency || baseCurrency
  const frozen = lines.length ? po.fxRate != null || ["po_pending", "po_approved", "po_issued"].includes(status) : sourcing.fxSnapshot != null || ["src_pending", "po_draft", "po_pending", "po_approved", "po_issued", "po_rejected"].includes(status)
  const snapshot = lines.length ? po.fxRate : object(sourcing.fxSnapshot)[currency]
  const live = rows(object(formSettings).fxRates).find((rate) => rate.code === currency)?.rate
  const submittedBase = lines.length ? po.approvalBaseCurrency : sourcing.approvalBaseCurrency
  const rate = frozen && submittedBase !== baseCurrency ? null : currency === baseCurrency ? 1 : frozen ? snapshot : live
  const validRate = typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : null
  const baseAmount = validRate != null && typeof record.value === "number" && Number.isFinite(record.value) ? record.value : null
  const submittedApproval = lines.length ? object(po.approval) : selected ? object(sourcing.approval) : object(record.prApproval)
  const submittedCurrencyInput = lines.length ? text(po.approvalBaseCurrency) : selected ? text(sourcing.approvalBaseCurrency) : text(record.prApprovalBaseCurrency)
  const submittedCurrency = /^[A-Z]{3}$/.test(submittedCurrencyInput) ? submittedCurrencyInput : ""
  const submittedAmount = submittedCurrency && typeof submittedApproval.amount === "number" && Number.isFinite(submittedApproval.amount) ? submittedApproval.amount : null
  const submittedFxRate = submittedCurrency && currency === submittedCurrency ? 1 : submittedCurrency && typeof snapshot === "number" && Number.isFinite(snapshot) && snapshot > 0 ? snapshot : null
  const monetaryState = !known ? null : status === "po_issued" ? "issued-internally" : status === "po_approved" ? "approved" : status === "cancelled" ? "cancelled" : ["pr_pending", "src_pending", "po_pending"].includes(status) ? "pending-approval" : "estimate"
  const moneyEvidence = !known || monetaryState === "estimate" || !explicitCurrency ? "estimated" as const : "confirmed" as const
  const amountInput = lines.length ? { lines: lines.map((line) => ({ qty: line.qty ?? null, unitPrice: line.unitPrice ?? null })) } : selected ? { quoteId: text(selected.id), total: selected.total ?? null, qty: selected.qty ?? null, unitPrice: selected.unitPrice ?? null } : { estimate: pr.estAmount ?? null }
  const currencyDependency = { currencyInput, baseCurrency }
  const fxDependency = { ...currencyDependency, frozen, submittedBase: frozen ? submittedBase ?? null : null, rate: rate ?? null }
  return { original, explicitCurrency, currency, validRate, baseAmount, submittedCurrency, submittedAmount, submittedFxRate, monetaryState, moneyEvidence, fxSource: validRate == null ? null : !explicitCurrency ? "base-default" : currency === baseCurrency ? "base" : frozen ? "submitted" : "current", amountInput, currencyDependency, fxDependency, submittedDependency: { amount: submittedApproval.amount ?? null, fxRate: submittedApproval.fxRate ?? null, submittedCurrency, snapshot: snapshot ?? null } }
}
