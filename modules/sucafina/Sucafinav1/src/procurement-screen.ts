// Secção 9.0 e 9.5. Estes ecrãs não decidem. O detalhe não é uma sexta entrada.

import { surfaceAdmin } from "./identity.ts"
import type { ResolvedActor } from "./identity.ts"
import { writeVersioned } from "./records.ts"
import type { Change, Versioned } from "./records.ts"
import { openProcurement, procurementKeys } from "./nav.ts"
import { visibleRequests } from "./requests.ts"
import { documentHtml, esc, links, listed, openKey, pageMain } from "./screen-shell.ts"
import type { Drawn, ScreenActor } from "./screen-shell.ts"

const REQUEST_TABS = ["Requisition", "Sourcing", "Purchase order", "History"] as const

const REQUEST_STEPPER = [
  "Requisition",
  "PR approval",
  "Sourcing",
  "Sourcing approval",
  "Purchase order",
  "PO approval",
  "Approved",
  "Issued",
] as const

const SUPPLIER_SECTIONS = [
  "General",
  "categories",
  "contacts",
  "commercial",
  "bank",
  "compliance",
  "linked requests",
  "audit",
] as const

type Step = { holderId: string | null; status: string }
type Approval = { amount: number; steps?: Step[] }
type Quote = { id?: string; total?: number; currency?: string; scores?: unknown; cscores?: unknown }
type Line = { qty: number; unitPrice: number }

export type RequestView = {
  number?: string
  status: string
  createdBy: string
  requesterName?: string
  pr?: { estAmount?: number | null; title?: string; description?: string; costCenter?: string } | null
  prApproval?: Approval | null
  sourcing?: {
    quotes?: Quote[]
    selectedId?: string | null
    fxSnapshot?: Record<string, number | null> | null
    approval?: Approval | null
  } | null
  po?: {
    number?: string
    currency?: string
    fxRate?: number | null
    expenseType?: string
    supplier?: string
    lines?: Line[]
    approval?: Approval | null
    iban?: string
  } | null
  history?: { at: string; by: string; action: string; note: string }[]
}

type Rates = { currency: string; fxRates?: { code: string; rate: number }[] }

const STAGE: Record<string, number> = {
  draft: 0,
  pr_rejected: 0,
  pr_pending: 1,
  sourcing: 2,
  src_rejected: 2,
  src_pending: 3,
  po_draft: 4,
  po_rejected: 4,
  po_pending: 5,
  po_approved: 6,
  po_issued: 7,
}

const FILTERS: Record<string, (status: string) => boolean> = {
  Open: (status) => status !== "po_issued" && status !== "cancelled",
  "Awaiting approval": (status) => status === "pr_pending" || status === "src_pending" || status === "po_pending",
  Requisition: (status) => status === "draft" || status === "pr_rejected" || status === "pr_pending",
  Sourcing: (status) => status === "sourcing" || status === "src_rejected" || status === "src_pending",
  "Purchase order": (status) =>
    status === "po_draft" ||
    status === "po_rejected" ||
    status === "po_pending" ||
    status === "po_approved" ||
    status === "po_issued",
  Closed: (status) => status === "po_issued" || status === "cancelled",
  All: () => true,
}

// Approved and issued orders use the stored PO rate. Earlier stages use the selected quote in base, then the estimate.
export function requestValue(request: RequestView, rates: Rates): number | null {
  if (request.status === "po_approved" || request.status === "po_issued") {
    const issued = request.po?.lines
    if (issued && issued.length) {
      const total = issued.reduce((sum, line) => sum + line.qty * line.unitPrice, 0)
      const rate = request.po?.fxRate
      if (typeof rate === "number" && Number.isFinite(rate)) return total * rate
      return total
    }
  }
  const selected = request.sourcing?.quotes?.find((quote) => quote.id === request.sourcing?.selectedId)
  if (selected && typeof selected.total === "number") {
    const base = toBase(selected.total, selected.currency || rates.currency, rates, request.sourcing?.fxSnapshot)
    if (base != null) return base
  }
  const amount = request.pr?.estAmount
  if (typeof amount === "number") return amount
  return null
}

export function procurementDashboard(requests: RequestView[], rates: Rates) {
  const issued = { OPEX: 0, CAPEX: 0 }
  for (const request of requests) {
    if (request.status !== "po_approved" && request.status !== "po_issued") continue
    const type = request.po?.expenseType
    if (type !== "OPEX" && type !== "CAPEX") continue
    issued[type] += requestValue(request, rates) || 0
  }
  return {
    edits: false as const,
    open: requests.filter((request) => request.status !== "po_issued" && request.status !== "cancelled").length,
    issued,
  }
}

export function procurementDashboardWrite(): { ok: false } {
  return { ok: false }
}

export function requestList(
  requests: RequestView[],
  actor: { id: string; roles: string[] },
  filter = "Open",
  query = "",
) {
  const visible = visibleRequests(requests, actor)
  const match = FILTERS[filter] ?? FILTERS.Open
  return visible.filter((request) => match(request.status) && matches(request, query))
}

export function exportRegister(requests: RequestView[]) {
  return requests.map((request) => strip(request))
}

export function myApprovals(requests: RequestView[], actorId: string) {
  const waitingForYou = []
  const waitingForOthers = []
  for (const request of requests) {
    const approval = approvalOf(request)
    const step = approval?.steps?.find((item) => item.status === "pending")
    if (!approval || !step) continue
    const row = { number: request.number, amount: approval.amount }
    if (step.holderId === actorId) waitingForYou.push(row)
    if (step.holderId !== actorId) waitingForOthers.push(row)
  }
  return { waitingForYou, waitingForOthers }
}

export function historyView(history: { at: string; by: string; action: string; note: string }[]) {
  return [...history].reverse()
}

export function editHistory(): { ok: false } {
  return { ok: false }
}

export function requestDetail(request: RequestView) {
  const stage = STAGE[request.status]
  return {
    page: false as const,
    tabs: REQUEST_TABS,
    stepper: REQUEST_STEPPER,
    sourcingEnabled: (stage != null && stage >= 2) || request.sourcing != null,
    poEnabled: request.po != null,
  }
}

export function supplierDetail() {
  return { page: false as const, sections: SUPPLIER_SECTIONS }
}

// Secção 9.6. Sem tecto plugado, o ficheiro não se aceita. 25 não é o número.
export function quoteFile(bytes: number, cap: number | null): { ok: true } | { ok: false } {
  if (cap == null || !(cap > 0) || bytes > cap) return { ok: false }
  return { ok: true }
}

export function setQuoteCap(
  current: Versioned<number | null> | null,
  cap: number | null,
  version: number,
  actor: ResolvedActor,
  at: string,
  audit: Change[],
): { ok: true; row: Versioned<number | null> } | { ok: false; status?: 409; stored?: number | null; by?: string } {
  if (!surfaceAdmin(actor, "procurement")) return { ok: false }
  if (cap !== null && !(cap > 0)) return { ok: false }
  return writeVersioned(current, version, cap, actor, at, audit)
}

export function quoteAgainst(setting: Versioned<number | null> | null, bytes: number): { ok: true } | { ok: false } {
  return quoteFile(bytes, setting?.value ?? null)
}

// Secção 6. expenseType não é id de linha, nem de projecto. assetRef é texto. Não é código CPX-.
export function poExpense(
  expenseType: string,
  assetRef: string,
): {
  expenseType: string
  assetRef: string
  plannerLineId: null
  capexProjectId: null
  projectId: null
  cpx: null
} {
  return { expenseType, assetRef, plannerLineId: null, capexProjectId: null, projectId: null, cpx: null }
}

export function procurementScreen(input: {
  actor: ScreenActor
  key?: string
  requests?: RequestView[]
  rates?: { currency: string; fxRates?: { code: string; rate: number }[] }
  filter?: string
  query?: string
  request?: RequestView
  supplier?: boolean
}): { drawn: Drawn; html: string } {
  const keys = procurementKeys(input.actor)
  const nav = listed(keys, "procurement")
  const opened = openKey(keys, input.key ?? nav[0]?.key, (key) => openProcurement(key, input.actor))
  // O mesmo recorte vale para totais, aprovações e detalhe, não só para a lista.
  const visible = {
    ...input,
    requests: visibleRequests(input.requests ?? [], input.actor),
    request: input.request && visibleRequests([input.request], input.actor)[0],
    supplier: nav.length > 0 && input.supplier,
  }
  const aside = procurementAside(visible)
  const drawn = { surface: "procurement" as const, nav, active: opened, aside }
  return {
    drawn,
    html: documentHtml(
      "IT Procurement",
      "procurement",
      links(nav),
      procurementMain(visible, opened),
      asideHtml(aside, visible),
    ),
  }
}

function procurementAside(input: { request?: RequestView; supplier?: boolean }): { key: string; page: false }[] {
  const aside: { key: string; page: false }[] = []
  if (input.request) aside.push({ key: "Request detail", page: false })
  if (input.supplier) aside.push({ key: "Supplier detail", page: false })
  return aside
}

function procurementMain(
  input: {
    actor: ScreenActor
    requests?: RequestView[]
    rates?: { currency: string; fxRates?: { code: string; rate: number }[] }
    filter?: string
    query?: string
  },
  active: Drawn["active"],
): string {
  if (!active.drawn) return pageMain(active)
  return pageMain(active, procurementBody(input, active.key))
}

function procurementBody(
  input: {
    actor: ScreenActor
    requests?: RequestView[]
    rates?: { currency: string; fxRates?: { code: string; rate: number }[] }
    filter?: string
    query?: string
  },
  key: string,
): string {
  if (key === "Dashboard" && input.requests && input.rates) {
    const board = procurementDashboard(input.requests, input.rates)
    const write = procurementDashboardWrite()
    return `<p data-edits="${board.edits}">${board.open}</p><p data-opex="${board.issued.OPEX}"></p><p data-capex="${board.issued.CAPEX}"></p><p data-write="${write.ok}"></p>`
  }
  if (key === "Requests" && input.requests)
    return requestList(input.requests, input.actor, input.filter, input.query)
      .map((request) => `<p>${esc(request.number ?? "")} ${esc(request.status)}</p>`)
      .join("")
  if (key === "My approvals" && input.requests) {
    const mine = myApprovals(input.requests, input.actor.id)
    return `<ul>${mine.waitingForYou.map((row) => `<li>${esc(row.number ?? "")} ${row.amount}</li>`).join("")}</ul>`
  }
  return ""
}

function asideHtml(aside: { key: string; page: false }[], input: { request?: RequestView }): string {
  const request =
    input.request && aside.some((item) => item.key === "Request detail") ? requestAside(input.request) : ""
  const supplier = aside.some((item) => item.key === "Supplier detail") ? supplierAside() : ""
  return request + supplier
}

function requestAside(request: RequestView): string {
  const detail = requestDetail(request)
  const history = editHistory()
  return `<section data-slot="request-detail" data-page="false"><h2>${esc(request.number ?? "")}</h2><p>${detail.tabs.join("|")}</p><p>${detail.stepper.join("|")}</p><p data-sourcing="${detail.sourcingEnabled}"></p><p data-po="${detail.poEnabled}"></p><p data-history="${history.ok}"></p></section>`
}

function supplierAside(): string {
  const detail = supplierDetail()
  return `<section data-slot="supplier-detail" data-page="false">${detail.sections.join("|")}</section>`
}

function approvalOf(request: RequestView): Approval | null | undefined {
  if (request.status === "pr_pending") return request.prApproval
  if (request.status === "src_pending") return request.sourcing?.approval
  if (request.status === "po_pending") return request.po?.approval
  return null
}

function matches(request: RequestView, query: string): boolean {
  if (!query) return true
  const fields = [
    request.number,
    request.pr?.title,
    request.pr?.description,
    request.pr?.costCenter,
    request.po?.number,
    request.po?.supplier,
    request.requesterName,
  ]
  return fields.some((field) => typeof field === "string" && field.includes(query))
}

function toBase(
  total: number,
  currency: string,
  rates: Rates,
  snapshot: Record<string, number | null> | null | undefined,
): number | null {
  if (!currency || currency === rates.currency) return total
  const snap = snapshot?.[currency]
  if (snap != null && snap > 0) return total * snap
  const found = rates.fxRates?.find((rate) => rate.code === currency)
  if (found && found.rate > 0) return total * found.rate
  return null
}

function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip)
  if (!value || typeof value !== "object") return value
  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key === "scores" || key === "cscores" || key === "iban" || key === "evaluation" || key === "ranking") continue
    out[key] = strip(item)
  }
  return out
}
