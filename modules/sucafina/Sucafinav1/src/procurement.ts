// O que a secção 9.1 põe em cima da conta. A porta não faz isto por dentro.

import { act } from "../../porta/act.ts"
import { quoteRanking, validatePO, validatePR, validateSourcing } from "./form.ts"
import type { FormSettings } from "./form.ts"
import { open, seal } from "./supplier.ts"

type Actor = { id: string; canWrite: boolean; roles: string[] }
type Supplier = { id: string; status: string; legalName?: string }
type Rank = { id?: string; rank: number | null; overall: number }
type Row = { version: number; by: string; request: Record<string, unknown>; rank?: Rank[] }

export type Store = {
  settings: Record<string, unknown>
  form: FormSettings
  issued: { pr: string[]; po: string[] }
  sup: string[]
  suppliers: Supplier[]
  requests: Record<string, Row>
  actCalls: number
  lastIssued: { pr: string[]; po: string[] } | null
}

export function createRequest(store: Store, action: { type: "create"; pr: Record<string, unknown> }, actor: Actor, at: string) {
  const result = callAct(store, null, action, actor, at, null)
  if (!result.ok) return result
  const number = String(result.request.number)
  store.requests[number] = { version: 1, by: actor.id, request: result.request }
  return result
}

export function submitPR(store: Store, id: string, version: number, actor: Actor, at: string, submitted: Record<string, unknown>) {
  const row = store.requests[id]
  if (!row || row.version !== version) return stale(row)
  if (!actor.canWrite) return { ok: false as const }
  const errors = validatePR(submitted.pr as Parameters<typeof validatePR>[0])
  if (errors.length) return { ok: false as const, errors }
  return write(store, id, actor, callAct(store, applyPr(row.request, submitted), { type: "submit_pr" }, actor, at, null))
}

export function submitSourcing(store: Store, id: string, version: number, actor: Actor, at: string, submitted: Record<string, unknown>) {
  const row = store.requests[id]
  if (!row || row.version !== version) return stale(row)
  if (!actor.canWrite) return { ok: false as const }
  const errors = validateSourcing(submitted, store.form, store.suppliers)
  if (errors.length) return { ok: false as const, errors }
  const request = applySourcing(row.request, submitted)
  const result = write(store, id, actor, callAct(store, request, { type: "submit_sourcing" }, actor, at, supplierOf(store, selectedId(submitted))))
  if (result.ok) store.requests[id].rank = quoteRanking(submitted, store.form)
  return result
}

export function submitPO(store: Store, id: string, version: number, actor: Actor, at: string, submitted: Record<string, unknown>) {
  const row = store.requests[id]
  if (!row || row.version !== version) return stale(row)
  if (!actor.canWrite) return { ok: false as const }
  const errors = validatePO(submitted, store.form, store.suppliers)
  if (errors.length) return { ok: false as const, errors }
  return write(store, id, actor, callAct(store, applyPo(row.request, submitted), { type: "submit_po" }, actor, at, supplierOf(store, poSupplier(submitted))))
}

export function approve(store: Store, id: string, version: number, actor: Actor, at: string, comment?: string) {
  const row = store.requests[id]
  if (!row || row.version !== version) return stale(row)
  if (!actor.canWrite) return { ok: false as const }
  const action = comment === undefined ? { type: "approve" } : { type: "approve", comment }
  return write(store, id, actor, callAct(store, row.request, action, actor, at, null))
}

export function reject(store: Store, id: string, version: number, actor: Actor, at: string, reason: string) {
  const row = store.requests[id]
  if (!row || row.version !== version) return stale(row)
  if (!actor.canWrite) return { ok: false as const }
  return write(store, id, actor, callAct(store, row.request, { type: "reject", reason }, actor, at, null))
}

export function selectQuote(store: Store, id: string, version: number, actor: Actor, at: string, quoteId: string) {
  const row = store.requests[id]
  if (!row || row.version !== version) return stale(row)
  if (!actor.canWrite) return { ok: false as const }
  return write(store, id, actor, callAct(store, row.request, { type: "select_quote", quoteId }, actor, at, null))
}

export function issue(store: Store, id: string, version: number, actor: Actor, at: string) {
  const row = store.requests[id]
  if (!row || row.version !== version) return stale(row)
  if (row.request.status !== "po_approved") return { ok: false as const }
  if (!actor.canWrite || (!actor.roles.includes("buyer") && !actor.roles.includes("admin"))) return { ok: false as const }
  return write(store, id, actor, callAct(store, row.request, { type: "issue" }, actor, at, supplierOf(store, poSupplier(row.request))))
}

export function cancel(store: Store, id: string, version: number, actor: Actor, at: string, reason: string) {
  const row = store.requests[id]
  if (!row || row.version !== version) return stale(row)
  if (row.request.status === "po_issued" || row.request.status === "cancelled") return { ok: false as const }
  const createdBy = row.request.createdBy === actor.id
  if (!actor.canWrite || (!createdBy && !actor.roles.includes("admin"))) return { ok: false as const }
  if (trimEdges(reason).length === 0) return { ok: false as const }
  return write(store, id, actor, callAct(store, row.request, { type: "cancel", reason }, actor, at, null))
}

export function deleteDraft(store: Store, id: string, version: number, actor: Actor) {
  const row = store.requests[id]
  if (!row || row.version !== version) return stale(row)
  if (row.request.status !== "draft") return { ok: false as const }
  const createdBy = row.request.createdBy === actor.id
  if (!actor.canWrite || (!createdBy && !actor.roles.includes("admin"))) return { ok: false as const }
  delete store.requests[id]
  return { ok: true as const }
}

export function createSupplier(store: Store, actor: Actor) {
  if (!actor.canWrite || !actor.roles.includes("buyer")) return { ok: false as const }
  const number = nextSup(store.sup)
  store.sup = [...store.sup, number]
  return { ok: true as const, number }
}

export function migrateProcurement(
  backup: { requests?: { number?: string; history?: unknown[]; po?: { number?: string } | null }[]; suppliers?: { number?: string; iban?: string; account?: string }[] },
  actor: { canWrite: boolean; roles: string[] },
  confirmed: boolean,
  key: Uint8Array,
): { ok: false } | { ok: true; requests: { number?: string; history?: unknown[]; po?: { number?: string } | null }[]; suppliers: { number?: string; iban?: string; account?: string }[]; issued: { pr: string[]; po: string[]; sup: string[] } } {
  if (!actor.canWrite || !actor.roles.includes("admin") || confirmed !== true) return { ok: false }
  const requests = (backup.requests ?? []).map((request) => ({ ...request, history: request.history ? [...request.history] : [] }))
  const suppliers = (backup.suppliers ?? []).map((supplier) => ({
    ...supplier,
    iban: sealClear(supplier.iban, key),
    account: sealClear(supplier.account, key),
  }))
  return { ok: true, requests, suppliers, issued: { pr: codes(requests.map((request) => request.number), "PR"), po: codes(requests.map((request) => request.po?.number), "PO"), sup: codes(suppliers.map((supplier) => supplier.number), "SUP") } }
}

function sealClear(value: string | undefined, key: Uint8Array): string | undefined {
  if (!value) return value
  try {
    open(value, key)
    return value
  } catch {
    return seal(value, key)
  }
}

function codes(values: (string | undefined)[], kind: "PR" | "PO" | "SUP"): string[] {
  const pattern = kind === "SUP" ? /^SUP-\d+$/ : new RegExp(`^${kind}-\\d{4}-\\d+$`)
  return [...new Set(values.filter((value): value is string => typeof value === "string" && pattern.test(value)))]
}

export function nextSup(issued: string[]): string {
  const max = issued.reduce((current, code) => {
    const match = /^SUP-(\d+)$/.exec(code)
    if (!match) return current
    return Math.max(current, Number(match[1]))
  }, 0)
  return `SUP-${String(max + 1).padStart(5, "0")}`
}

function callAct(store: Store, request: unknown, action: { type: string; pr?: unknown; reason?: string; quoteId?: string; comment?: string }, actor: Actor, at: string, supplier: { id: string; status: string } | null) {
  const issued = { pr: store.issued.pr.slice(), po: store.issued.po.slice() }
  store.actCalls += 1
  store.lastIssued = issued
  const result = act(request, action, actor, store.settings, at, issued, supplier)
  if (!result.ok) return result
  remember(store, result.request)
  return result
}

function write(store: Store, id: string, actor: Actor, result: { ok: true; request: Record<string, unknown> } | { ok: false; code: string }) {
  if (!result.ok) return result
  const row = store.requests[id]
  store.requests[id] = { version: (row?.version ?? 0) + 1, by: actor.id, request: result.request, rank: row?.rank }
  return result
}

function remember(store: Store, request: { number?: string; po?: { number?: string } | null }) {
  if (request.number && !store.issued.pr.includes(request.number)) store.issued.pr = [...store.issued.pr, request.number]
  const po = request.po?.number
  if (po && !store.issued.po.includes(po)) store.issued.po = [...store.issued.po, po]
}

function stale(row: Row | undefined) {
  return { ok: false as const, stored: row?.request, by: row?.by }
}

function supplierOf(store: Store, id: string | null | undefined) {
  if (!id) return null
  const found = store.suppliers.find((item) => item.id === id)
  if (!found) return null
  return { id: found.id, status: found.status }
}

function selectedId(form: Record<string, unknown>) {
  const sourcing = form.sourcing as { quotes?: { id?: string; supplierId?: string | null }[]; selectedId?: string | null } | null
  const selected = sourcing?.quotes?.find((quote) => quote.id === sourcing.selectedId)
  return selected?.supplierId
}

function poSupplier(request: Record<string, unknown>) {
  const po = request.po as { supplierId?: string | null } | null
  return po?.supplierId
}

function applyPr(stored: Record<string, unknown>, submitted: Record<string, unknown>) {
  const request = structuredClone(stored)
  const form = isRecord(submitted.pr) ? submitted.pr : {}
  const current = isRecord(request.pr) ? request.pr : {}
  const recurring = form.recurring !== undefined ? form.recurring === true : current.recurring === true
  const expense = form.expenseType !== undefined ? form.expenseType : current.expenseType
  request.pr = {
    ...current,
    ...form,
    estAmount: form.estAmount === null ? null : finite(form.estAmount !== undefined ? form.estAmount : current.estAmount),
    recurring,
    expenseType: typeof expense === "string" ? expense : "",
    contractRecommended: recurring,
  }
  return request
}

function applySourcing(stored: Record<string, unknown>, submitted: Record<string, unknown>) {
  const request = structuredClone(stored)
  const form = isRecord(submitted.sourcing) ? submitted.sourcing : {}
  const current = isRecord(request.sourcing) ? request.sourcing : {}
  request.sourcing = {
    quotes: Array.isArray(form.quotes) ? form.quotes.map((quote) => doorQuote(quote as Record<string, unknown>)) : [],
    selectedId: form.selectedId ?? null,
    fxSnapshot: current.fxSnapshot ?? null,
    approval: current.approval ?? null,
    contractStrategy: typeof form.contractStrategy === "string" ? form.contractStrategy : "",
  }
  if (isRecord(request.po)) request.po = projectPo(request.po, request.po)
  return request
}

function applyPo(stored: Record<string, unknown>, submitted: Record<string, unknown>) {
  const request = structuredClone(stored)
  const form = isRecord(submitted.po) ? submitted.po : {}
  const current = isRecord(request.po) ? request.po : {}
  request.po = projectPo(current, form)
  return request
}

function projectPo(current: Record<string, unknown>, form: Record<string, unknown>) {
  const lines = Array.isArray(form.lines)
    ? form.lines.map((line) => {
        const item = line as Record<string, unknown>
        return { qty: finite(item.qty), unitPrice: finite(item.unitPrice) }
      })
    : current.lines
  return {
    number: typeof current.number === "string" ? current.number : "",
    currency: form.currency ?? current.currency ?? "",
    fxRate: current.fxRate ?? null,
    expenseType: form.expenseType ?? current.expenseType ?? "",
    supplier: form.supplier ?? current.supplier ?? "",
    supplierId: form.supplierId === undefined ? (current.supplierId ?? null) : form.supplierId,
    sourceQuoteId: current.sourceQuoteId ?? null,
    lines: lines ?? [],
    approval: current.approval ?? null,
    issuedAt: current.issuedAt ?? null,
  }
}

function doorQuote(quote: Record<string, unknown>) {
  return {
    id: quote.id,
    supplier: quote.supplier,
    supplierId: quote.supplierId ?? null,
    currency: quote.currency,
    total: finite(quote.total),
    qty: finite(quote.qty),
    unitPrice: finite(quote.unitPrice),
    techPass: quote.techPass,
  }
}

function finite(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return Number.NaN
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function trimEdges(value: string): string {
  return value.replace(/^[\t\n\r ]+|[\t\n\r ]+$/g, "")
}
