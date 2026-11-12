// Lista de validatePR, validateSourcing e validatePO. Não é um código da conta. Não chama act.

const DASH = "\u2014"
const ARROW = "\u2192"

type Rate = { code: string; rate: number }
type Criterion = { weight?: number; auto?: boolean }
type Supplier = { id: string; status: string; legalName?: string }
type Quote = {
  id?: string
  supplier?: string
  supplierId?: string | null
  currency?: string
  total?: unknown
  techPass?: boolean
  scores?: unknown[]
  cscores?: unknown[]
}

export type FormSettings = {
  currency: string
  fxRates?: Rate[]
  minQuotes?: number
  requireActiveSupplier?: boolean
  techWeight?: number
  commWeight?: number
  criteria?: Criterion[]
  commCriteria?: Criterion[]
}

export function validatePR(pr: { title?: unknown; type?: unknown; description?: unknown; estAmount?: unknown; costCenter?: unknown; needBy?: unknown; justification?: unknown; recurring?: unknown; frequency?: unknown; estAnnual?: unknown } | null | undefined): string[] {
  const fields = pr ?? {}
  const missing = [
    !fields.title ? "Title" : "",
    !fields.type ? "Type (product / service)" : "",
    !fields.description ? "Description of product or service" : "",
    !(num(fields.estAmount) > 0) ? "Estimated amount" : "",
    !fields.costCenter ? "Cost centre" : "",
    !fields.needBy ? "Needed by date" : "",
    !fields.justification ? "Business justification" : "",
  ].filter(Boolean)
  if (fields.recurring) {
    if (!fields.frequency) missing.push("Recurrence frequency")
    if (!(num(fields.estAnnual) > 0)) missing.push("Estimated annual value")
  }
  return missing.map((field) => `${field} is required`)
}

export function validateSourcing(rec: { pr?: { recurring?: unknown }; sourcing?: SourcingForm | null }, settings: FormSettings, suppliers: Supplier[]): string[] {
  const sourcing = rec.sourcing ?? emptySourcing()
  const errors: string[] = []
  const min = num(settings.minQuotes)
  const filled = (sourcing.quotes ?? []).filter((quote) => quote.supplier && num(quote.total) > 0)
  if (filled.length < min && !sourcing.fewQuotesJustification) {
    errors.push(`${min} quotations are required (${filled.length} recorded) ${DASH} or give a justification for fewer quotes`)
  }
  ;(sourcing.quotes ?? []).forEach((quote, index) => {
    if (!quote.supplier || !(num(quote.total) > 0)) errors.push(`Quote ${index + 1}: supplier and price are required (remove unused quotes)`)
    if (fx(settings, quote.currency || settings.currency) == null) errors.push(`Quote ${index + 1}: no FX rate defined for ${quote.currency} (Settings ${ARROW} Currencies)`)
  })
  if (!sourcing.evaluator) errors.push("Technical evaluator is required")
  const scored = evalQuotes(rec, settings)
  ;(sourcing.quotes ?? []).forEach((quote, index) => {
    if (quote.techPass !== false && !scored[index]?.complete) errors.push(`Quote ${index + 1}: technical / commercial scores incomplete`)
  })
  const weight = weights(sourcing, settings)
  if (!(num(weight.tech) + num(weight.comm) > 0)) errors.push("Technical and commercial weights cannot both be zero")
  const selected = (sourcing.quotes ?? []).find((quote) => quote.id === sourcing.selectedId) ?? null
  if (!selected) errors.push("Select the winning quotation")
  if (selected) {
    const master = suppliers.find((item) => item.id === selected.supplierId)
    if (master?.status === "blocked") errors.push(`Selected supplier ${master.legalName} is blocked in the supplier master`)
    if (master?.status !== "blocked" && master?.status === "inactive") errors.push(`Selected supplier ${master.legalName} is inactive in the supplier master`)
    if (master?.status !== "blocked" && master?.status !== "inactive" && settings.requireActiveSupplier && master?.status !== "active") {
      errors.push("Selected supplier must exist in the supplier master with status Active")
    }
    if (selected.techPass === false) errors.push("The selected quotation is marked technically non-compliant")
    const top = scored.find((item) => item.rank === 1)?.id ?? null
    if (top !== selected.id && !sourcing.selectionJustification) errors.push(`Selected quote is not the top-ranked one ${DASH} a selection justification is required`)
  }
  if (rec.pr?.recurring && !sourcing.contractStrategy) errors.push("Contract strategy is required for a recurring purchase")
  return errors
}

export function validatePO(rec: { sourcing?: { contractStrategy?: string } | null; po?: PoForm | null }, settings: FormSettings, suppliers: Supplier[]): string[] {
  const po = rec.po ?? {}
  const master = suppliers.find((item) => item.id === po.supplierId)
  const errors: string[] = []
  if (master?.status === "blocked") errors.push(`Supplier ${master.legalName} is blocked in the supplier master`)
  if (master?.status !== "blocked" && master?.status === "inactive") errors.push(`Supplier ${master.legalName} is inactive in the supplier master`)
  if (master?.status !== "blocked" && master?.status !== "inactive" && settings.requireActiveSupplier && master?.status !== "active") {
    errors.push("Supplier must exist in the supplier master with status Active")
  }
  if (!po.supplier) errors.push("Supplier is required")
  if (!po.description) errors.push("Description is required")
  if (!(po.lines ?? []).length || !(poTotal(po) > 0)) errors.push("At least one line with an agreed price is required")
  if (!po.paymentTerms) errors.push("Payment terms are required")
  if (!po.expenseType) errors.push("Mark the PO as OPEX or CAPEX")
  if (fx(settings, po.currency || settings.currency) == null) errors.push(`No FX rate defined for ${po.currency} (Settings ${ARROW} Currencies)`)
  if (!po.deliveryDate) errors.push("Delivery date is required")
  if (!po.deliveryConditions) errors.push("Specific delivery conditions are required")
  if (rec.sourcing?.contractStrategy === "existing" && !po.contractRef) errors.push("Contract reference is required (call-off under existing contract)")
  return errors
}

type SourcingForm = {
  quotes?: Quote[]
  evaluator?: string
  selectedId?: string | null
  fewQuotesJustification?: string
  selectionJustification?: string
  contractStrategy?: string
  fxSnapshot?: Record<string, number | null> | null
  weights?: { tech?: number; comm?: number; criteria?: Criterion[]; commCriteria?: Criterion[] }
}

type PoForm = {
  supplier?: string
  supplierId?: string | null
  description?: string
  lines?: { qty?: unknown; unitPrice?: unknown }[]
  paymentTerms?: string
  expenseType?: string
  currency?: string
  deliveryDate?: string
  deliveryConditions?: string
  contractRef?: string
}

function emptySourcing(): SourcingForm {
  return { quotes: [] }
}

function num(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return parsed
}

function fx(settings: FormSettings, code: string): number | null {
  if (!code || code === settings.currency) return 1
  const found = (settings.fxRates ?? []).find((rate) => rate.code === code)
  if (found && num(found.rate) > 0) return num(found.rate)
  return null
}

function weights(sourcing: SourcingForm, settings: FormSettings) {
  if (sourcing.weights) return sourcing.weights
  return { tech: settings.techWeight, comm: settings.commWeight, criteria: settings.criteria ?? [], commCriteria: settings.commCriteria ?? [] }
}

export function quoteRanking(rec: { sourcing?: SourcingForm | null }, settings: FormSettings) {
  return evalQuotes(rec, settings).map((item) => ({ id: item.id, rank: item.rank, overall: item.overall }))
}

function evalQuotes(rec: { sourcing?: SourcingForm | null }, settings: FormSettings) {
  const sourcing = rec.sourcing ?? emptySourcing()
  const weight = weights(sourcing, settings)
  const criteria = weight.criteria ?? []
  const commercial = weight.commCriteria ?? []
  const techWeight = criteria.reduce((sum, item) => sum + num(item.weight), 0) || 1
  const commWeight = commercial.reduce((sum, item) => sum + num(item.weight), 0) || 1
  const quotes = sourcing.quotes ?? []
  const base = (quote: Quote) => {
    const code = quote.currency || settings.currency
    const snap = sourcing.fxSnapshot
    const rate = snap && snap[code] != null ? snap[code] : fx(settings, code)
    if (rate == null) return 0
    return num(quote.total) * rate
  }
  const eligible = (quote: Quote) => quote.techPass !== false && base(quote) > 0
  const pool = quotes.filter(eligible)
  const cheapest = pool.length ? Math.min(...pool.map(base)) : 0
  const scored = quotes.map((quote) => {
    let complete = true
    let techSum = 0
    let commSum = 0
    criteria.forEach((item, index) => {
      const score = quote.scores ? quote.scores[index] : null
      if (score == null || score === "") complete = false
      techSum += (num(score) / 5) * num(item.weight)
    })
    const inPool = eligible(quote)
    const price = inPool && cheapest > 0 ? (cheapest / base(quote)) * 100 : 0
    commercial.forEach((item, index) => {
      if (item.auto) {
        commSum += price * num(item.weight)
        return
      }
      const score = quote.cscores ? quote.cscores[index] : null
      if (score == null || score === "") complete = false
      commSum += (num(score) / 5) * 100 * num(item.weight)
    })
    const tech = (techSum / techWeight) * 100
    const comm = commSum / commWeight
    const overall = inPool ? (tech * num(weight.tech) + comm * num(weight.comm)) / (num(weight.tech) + num(weight.comm) || 1) : 0
    return { id: quote.id, complete, eligible: inPool, overall, rank: null as number | null }
  })
  scored
    .filter((item) => item.eligible)
    .sort((a, b) => b.overall - a.overall)
    .forEach((item, index) => {
      item.rank = index + 1
    })
  return scored
}

function poTotal(po: PoForm): number {
  return (po.lines ?? []).reduce((sum, line) => sum + num(line.qty) * num(line.unitPrice), 0)
}
