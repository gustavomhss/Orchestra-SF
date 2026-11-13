import { validatePO, validatePR, validateSourcing, type FormSettings } from "../../src/form.ts"

type PR = Parameters<typeof validatePR>[0]
type SourcingRecord = Parameters<typeof validateSourcing>[0]
type PurchaseOrderRecord = Parameters<typeof validatePO>[0]
type Suppliers = Parameters<typeof validatePO>[2]

export type FieldError = {
  /** Input name the message belongs beside. */
  field: string
  message: string
}

const PR_FIELD: Record<string, string> = {
  Title: "pr.title",
  "Type (product / service)": "pr.type",
  "Description of product or service": "pr.description",
  "Estimated amount": "pr.estAmount",
  "Cost centre": "pr.costCenter",
  "Needed by date": "pr.needBy",
  "Business justification": "pr.justification",
  "Recurrence frequency": "pr.frequency",
  "Estimated annual value": "pr.estAnnual",
}

const PO_FIELD: Record<string, string> = {
  "Supplier is required": "po.supplier",
  "Description is required": "po.description",
  "At least one line with an agreed price is required": "po.lines",
  "Payment terms are required": "po.paymentTerms",
  "Mark the PO as OPEX or CAPEX": "po.expenseType",
  "Delivery date is required": "po.deliveryDate",
  "Specific delivery conditions are required": "po.deliveryConditions",
  "Contract reference is required (call-off under existing contract)": "po.contractRef",
}

function described(field: string, message: string): FieldError {
  return { field, message }
}

function quoteField(message: string, suffix: string): FieldError {
  const index = Number(/^Quote (\d+):/.exec(message)?.[1] ?? 1) - 1
  return described(`sourcing.quotes.${index}.${suffix}`, message)
}

export function requisitionFieldErrors(pr: PR): FieldError[] {
  return validatePR(pr).map((message) => described(PR_FIELD[message.replace(/ is required$/, "")] ?? "pr", message))
}

export function sourcingFieldErrors(record: SourcingRecord, settings: FormSettings, suppliers: Suppliers): FieldError[] {
  return validateSourcing(record, settings, suppliers).map((message) => {
    if (message.includes("justification for fewer quotes")) return described("sourcing.fewQuotesJustification", message)
    if (message.includes("supplier and price")) return quoteField(message, "supplier")
    if (message.includes("no FX rate defined")) return quoteField(message, "currency")
    if (message.includes("scores incomplete")) return quoteField(message, "scores")
    if (message === "Technical evaluator is required") return described("sourcing.evaluator", message)
    if (message.startsWith("Technical and commercial weights")) return described("sourcing.weights", message)
    if (message === "Select the winning quotation") return described("sourcing.selectedId", message)
    if (message.includes("supplier master") || message.includes("status Active") || message.includes("non-compliant")) return described("sourcing.selectedId", message)
    if (message.startsWith("Selected quote is not the top-ranked")) return described("sourcing.selectionJustification", message)
    if (message.startsWith("Contract strategy")) return described("sourcing.contractStrategy", message)
    return described("sourcing", message)
  })
}

export function purchaseOrderFieldErrors(record: PurchaseOrderRecord, settings: FormSettings, suppliers: Suppliers): FieldError[] {
  return validatePO(record, settings, suppliers).map((message) => {
    if (message.startsWith("No FX rate defined")) return described("po.currency", message)
    if (message.includes("supplier master") || message.includes("status Active")) return described("po.supplierId", message)
    return described(PO_FIELD[message] ?? "po", message)
  })
}
