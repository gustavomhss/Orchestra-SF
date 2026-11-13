import { validatePO, validatePR, validateSourcing, type FormSettings } from "../../src/form.ts"
import { esc } from "../../src/screen-shell.ts"
import { object, rows, text } from "../../runtime/contract.ts"

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
  return validateSourcing(record, settings, suppliers).flatMap((message): FieldError | FieldError[] => {
    if (message.includes("justification for fewer quotes")) return described("sourcing.fewQuotesJustification", message)
    if (message.includes("supplier and price")) {
      const index = Number(/^Quote (\d+):/.exec(message)?.[1] ?? 1) - 1
      const quote = record.sourcing?.quotes?.[index]
      return [
        ...(!quote?.supplier ? [quoteField(message, "supplier")] : []),
        ...(!(Number.isFinite(Number(quote?.total)) && Number(quote?.total) > 0) ? [quoteField(message, "total")] : []),
      ]
    }
    if (message.includes("no FX rate defined")) return quoteField(message, "currency")
    if (message.includes("scores incomplete")) {
      const index = Number(/^Quote (\d+):/.exec(message)?.[1] ?? 1) - 1
      const quote = record.sourcing?.quotes?.[index]
      const weights = record.sourcing?.weights ?? settings
      return [
        ...(weights.criteria ?? []).flatMap((_, score) => quote?.scores?.[score] == null || quote?.scores?.[score] === "" ? [quoteField(message, `scores.${score}`)] : []),
        ...(weights.commCriteria ?? []).flatMap((criterion, score) => !criterion.auto && (quote?.cscores?.[score] == null || quote?.cscores?.[score] === "") ? [quoteField(message, `cscores.${score}`)] : []),
      ]
    }
    if (message === "Technical evaluator is required") return described("sourcing.evaluator", message)
    if (message.startsWith("Technical and commercial weights")) return described("sourcing.weights", message)
    if (message === "Select the winning quotation") return described("sourcing.selectedId", message)
    if (message.includes("supplier master") || message.includes("status Active") || message.includes("non-compliant")) return described("sourcing.selectedId", message)
    if (message.startsWith("Selected quote is not the top-ranked")) return described("sourcing.selectionJustification", message)
    if (message.startsWith("Contract strategy")) return described("sourcing.contractStrategy", message)
    return described("sourcing", message)
  })
}

/** Adds accessible, adjacent feedback only to controls emitted by the Procurement form renderer. */
export function presentProcurementFieldErrors(html: string, errors: readonly FieldError[], scope: string): string {
  return html.replace(/<label\b[^>]*>[\s\S]*?<\/label>/g, (label) => {
    const control = /<(?:input|textarea|select)\b[^>]*\bname="([^"]+)"/.exec(label)
    if (!control) return label
    const name = control[1]!
    const messages = [...new Set(errors.filter((error) => name === esc(error.field) || name.startsWith(`${esc(error.field)}.`)).map((error) => error.message))]
    if (!messages.length) return label
    const id = esc(`${scope}-error-${name}`)
    return label.replace(/<(input|textarea|select)\b/, (_, tag: string) => `<${tag} aria-invalid="true" aria-describedby="${id}"`)
      .replace("</label>", () => `<span id="${id}" class="field-error" data-error-for="${name}" role="status">${messages.map(esc).join("; ")}</span></label>`)
  })
}

/** Candidates describe recorded origins; reading them never applies a default or overwrites a negotiated field. */
export function purchaseOrderFieldSources(request: Record<string, unknown>, settings: Record<string, unknown>, suppliers: readonly Record<string, unknown>[]) {
  const po = object(request.po)
  const sourcing = object(request.sourcing)
  const selectedId = text(sourcing.selectedId)
  const selected = selectedId ? rows(sourcing.quotes).filter((quote) => quote.id === selectedId) : []
  const quote = selected.length === 1 ? selected[0] : undefined
  const supplierId = text(po.supplierId)
  const matches = supplierId ? suppliers.filter((supplier) => supplier.id === supplierId) : []
  const supplier = matches.length === 1 ? matches[0] : undefined
  const line = rows(po.lines)[0]
  const fields = [
    { field: "po.supplier", label: "Supplier", current: po.supplier, candidate: quote?.supplier, origin: "Selected quotation" },
    { field: "po.currency", label: "Currency", current: po.currency, candidate: quote?.currency, origin: "Selected quotation" },
    { field: "po.lines.0.qty", label: "First-line quantity", current: line?.qty, candidate: quote?.qty, origin: "Selected quotation" },
    { field: "po.lines.0.unitPrice", label: "First-line unit price", current: line?.unitPrice, candidate: quote?.unitPrice, origin: "Selected quotation" },
    { field: "po.paymentTerms", label: "Payment terms", current: po.paymentTerms, candidate: supplier?.paymentTerms, origin: "Current supplier master suggestion" },
    { field: "po.billingAddress", label: "Billing address", current: po.billingAddress, candidate: settings.billingAddress, origin: "Configured default suggestion" },
    { field: "po.deliveryAddress", label: "Delivery address", current: po.deliveryAddress, candidate: settings.defaultDeliveryAddress, origin: "Configured default suggestion" },
  ]
  return {
    sourceQuoteId: text(po.sourceQuoteId) || null,
    selectedQuoteId: quote ? selectedId : null,
    fields: fields.map((field) => ({
      ...field,
      current: storedScalar(field.current),
      candidate: storedScalar(field.candidate),
      relation: storedScalar(field.current) === null || storedScalar(field.candidate) === null ? "unavailable" as const : field.current === field.candidate ? "same" as const : "different" as const,
    })),
  }
}

function storedScalar(value: unknown): string | number | null {
  if (typeof value === "string") return value.trim() ? value : null
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

export function purchaseOrderFieldErrors(record: PurchaseOrderRecord, settings: FormSettings, suppliers: Suppliers): FieldError[] {
  return validatePO(record, settings, suppliers).map((message) => {
    if (message.startsWith("No FX rate defined")) return described("po.currency", message)
    if (message.includes("supplier master") || message.includes("status Active")) return described("po.supplierId", message)
    return described(PO_FIELD[message] ?? "po", message)
  })
}
