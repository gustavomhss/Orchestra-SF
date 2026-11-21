// Requester vê só os próprios. Os outros papéis de procurement não ficam restringidos aos próprios.

const OPEN = ["buyer", "approver", "supplier admin", "admin", "viewer"]

export function visibleRequests<T extends { createdBy: string }>(requests: T[], actor: { id: string; roles: string[] }): T[] {
  if (actor.roles.some((role) => OPEN.includes(role))) return requests
  if (actor.roles.includes("requester")) return requests.filter((request) => request.createdBy === actor.id)
  return []
}

const REQUEST_STAGES: Record<string, { stage: string; next: string }> = {
  draft: { stage: "Requisition draft", next: "Complete and submit the requisition for approval" },
  pr_pending: { stage: "Requisition approval", next: "Await the current approval decision" },
  pr_rejected: { stage: "Requisition rejected", next: "Review the rejection and revise the requisition" },
  sourcing: { stage: "Sourcing", next: "Compare proposals and submit the selection for approval" },
  src_pending: { stage: "Sourcing approval", next: "Await the current approval decision" },
  src_rejected: { stage: "Sourcing rejected", next: "Review the rejection and revise the selection" },
  po_draft: { stage: "Purchase order draft", next: "Complete and submit the order for approval" },
  po_pending: { stage: "Purchase order approval", next: "Await the current approval decision" },
  po_rejected: { stage: "Purchase order rejected", next: "Review the rejection and revise the order" },
  po_approved: { stage: "Purchase order approved", next: "The approved order awaits internal issue" },
  po_issued: { stage: "Issued internally", next: "Internal issue recorded" },
  cancelled: { stage: "Cancelled", next: "Request cancelled" },
}

/** Describes the recorded stage without granting permission to perform an action. */
export function requestStageGuidance(status: string) {
  return Object.hasOwn(REQUEST_STAGES, status) ? REQUEST_STAGES[status]! : { stage: "Unknown status", next: "Next step unavailable" }
}


export type StoredValueRelation = "equals" | "differs" | "unavailable"

export type OrderSourceGuidance =
  | { state: "unavailable"; reason: "selected-quote-absent" | "selected-quote-not-stored" | "source-quote-mismatch" }
  | { state: "selected-quote"; selectedId: string; supplier: StoredValueRelation; currency: StoredValueRelation; quantity: StoredValueRelation }

export function orderSourceGuidance(request: { sourcing?: unknown; po?: unknown }): OrderSourceGuidance {
  const sourcing = record(request.sourcing)
  const po = record(request.po)
  const selectedId = text(sourcing.selectedId)
  if (!selectedId) return { state: "unavailable", reason: "selected-quote-absent" }
  const quotes = Array.isArray(sourcing.quotes) ? sourcing.quotes.map(record).filter((quote) => text(quote.id) === selectedId) : []
  if (quotes.length !== 1) return { state: "unavailable", reason: "selected-quote-not-stored" }
  const quote = quotes[0]!
  if (text(po.sourceQuoteId) !== text(quote.id)) return { state: "unavailable", reason: "source-quote-mismatch" }
  const line = Array.isArray(po.lines) ? record(po.lines[0]) : {}
  return {
    state: "selected-quote",
    selectedId,
    supplier: relation(po.supplierId, quote.supplierId),
    currency: relation(po.currency, quote.currency),
    quantity: relation(line.qty, quote.qty),
  }
}

function relation(current: unknown, selected: unknown): StoredValueRelation {
  if (!stored(current) || !stored(selected)) return "unavailable"
  return current === selected ? "equals" : "differs"
}

function stored(value: unknown): value is string | number {
  if (typeof value === "string") return value.length > 0
  return typeof value === "number" && Number.isFinite(value)
}

function text(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
