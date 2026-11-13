// Secção 9.0 e 9.5. Estes ecrãs não decidem. O detalhe não é uma sexta entrada.

import { surfaceAdmin } from "./identity.ts"
import type { ResolvedActor } from "./identity.ts"
import { writeVersioned } from "./records.ts"
import type { Change, Versioned } from "./records.ts"
import { openProcurement, procurementKeys } from "./nav.ts"
import { requestStageGuidance, visibleRequests } from "./requests.ts"
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

type Step = { holderId: string | null; status: string; levelName?: string }
type Approval = { amount: number; steps?: Step[] }
type Quote = { id?: string; total?: number; currency?: string; scores?: unknown; cscores?: unknown }
type Line = { qty: number; unitPrice: number }

export type RequestView = {
  number?: string
  status: string
  createdBy: string
  buyerId?: string
  requesterName?: string
  prApprovalBaseCurrency?: string
  pr?: { estAmount?: number | null; title?: string; description?: string; costCenter?: string } | null
  prApproval?: Approval | null
  sourcing?: {
    quotes?: Quote[]
    selectedId?: string | null
    fxSnapshot?: Record<string, number | null> | null
    approvalBaseCurrency?: string
    approval?: Approval | null
  } | null
  po?: {
    number?: string
    currency?: string
    fxRate?: number | null
    approvalBaseCurrency?: string
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

export function requestValue(request: RequestView, rates: Rates): number | null {
  if (!/^[A-Z]{3}$/.test(rates.currency)) return null
  const lines = request.po?.lines
  if (Array.isArray(lines) && lines.length) {
    if (lines.some((line) => !line || typeof line !== "object" || !Number.isFinite(line.qty) || !Number.isFinite(line.unitPrice) || !Number.isFinite(line.qty * line.unitPrice))) return null
    const total = lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0)
    if (!Number.isFinite(total)) return null
    const frozen = request.po?.fxRate != null || request.po?.approval != null || request.po?.approvalBaseCurrency != null || ["po_pending", "po_approved", "po_issued"].includes(request.status)
    if (frozen && request.po?.approvalBaseCurrency !== rates.currency) return null
    const currency = request.po?.currency
    if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) return null
    if (currency === rates.currency) return total
    if (request.po?.fxRate != null) return request.po.fxRate > 0 && Number.isFinite(total * request.po.fxRate) ? total * request.po.fxRate : null
    if (frozen) return null
    return toBase(total, currency, rates, null)
  }
  if (["po_draft", "po_pending", "po_rejected", "po_approved", "po_issued"].includes(request.status)) return null
  const selectedId = request.sourcing?.selectedId
  const matches = typeof selectedId === "string" && selectedId && Array.isArray(request.sourcing?.quotes) ? request.sourcing.quotes.filter((quote) => quote?.id === selectedId) : []
  const selected = matches.length === 1 ? matches[0] : undefined
  const frozen = request.sourcing?.fxSnapshot != null || request.sourcing?.approval != null || request.sourcing?.approvalBaseCurrency != null || request.status === "src_pending"
  if (selected) {
    if (typeof selected.total !== "number" || !Number.isFinite(selected.total)) return null
    if (typeof selected.currency !== "string" || !/^[A-Z]{3}$/.test(selected.currency)) return null
    if (frozen && request.sourcing?.approvalBaseCurrency !== rates.currency) return null
    if (frozen && request.sourcing?.fxSnapshot == null && selected.currency !== rates.currency) return null
    const base = toBase(selected.total, selected.currency, rates, request.sourcing?.fxSnapshot)
    return base
  }
  if (frozen || selectedId) return null
  const amount = request.pr?.estAmount
  if ((request.prApproval != null || request.prApprovalBaseCurrency != null || ["pr_pending", "sourcing", "src_pending", "src_rejected"].includes(request.status)) && request.prApprovalBaseCurrency !== rates.currency) return null
  if (typeof amount === "number" && Number.isFinite(amount)) return amount
  return null
}

export function procurementDashboard(requests: RequestView[], rates: Rates) {
  const issued = { OPEX: 0, CAPEX: 0 }
  const approved = { OPEX: 0, CAPEX: 0 }
  const unavailable: string[] = []
  for (const request of requests) {
    if (request.status !== "po_approved" && request.status !== "po_issued") continue
    const type = request.po?.expenseType
    if (type !== "OPEX" && type !== "CAPEX") continue
    const value = requestValue(request, rates)
    if (value == null) {
      unavailable.push(request.number ?? "")
      continue
    }
    if (request.status === "po_issued") issued[type] += value
    if (request.status === "po_approved") approved[type] += value
  }
  return {
    edits: false as const,
    open: requests.filter((request) => request.status !== "po_issued" && request.status !== "cancelled").length,
    issued,
    approved,
    unavailable,
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

export function approvalQueue(requests: RequestView[], actorId: string) {
  const waitingForYou: RequestView[] = []
  const waitingForOthers: RequestView[] = []
  const unassigned: RequestView[] = []
  for (const request of requests) {
    if (typeof request.status !== "string" || !request.status.endsWith("_pending")) continue
    const approval = approvalOf(request)
    const step = Array.isArray(approval?.steps) ? approval.steps.find((item) => item?.status === "pending") : undefined
    if (step?.holderId && step.holderId === actorId) waitingForYou.push(request)
    if (step?.holderId && step.holderId !== actorId) waitingForOthers.push(request)
    if (!step?.holderId) unassigned.push(request)
  }
  const oldest = (left: RequestView, right: RequestView) => {
    const a = approvalStageEntry(left)
    const b = approvalStageEntry(right)
    if (a && b) return Date.parse(a) - Date.parse(b) || (left.number ?? "").localeCompare(right.number ?? "")
    if (a) return -1
    if (b) return 1
    return (left.number ?? "").localeCompare(right.number ?? "")
  }
  return { waitingForYou: waitingForYou.sort(oldest), waitingForOthers: waitingForOthers.sort(oldest), unassigned: unassigned.sort(oldest) }
}

export function myApprovals(requests: RequestView[], actorId: string) {
  const groups = approvalQueue(requests, actorId)
  const brief = (request: RequestView) => {
    const amount = approvalOf(request)?.amount
    return { number: request.number, amount: typeof amount === "number" && Number.isFinite(amount) ? amount : null }
  }
  return { waitingForYou: groups.waitingForYou.map(brief), waitingForOthers: groups.waitingForOthers.map(brief), unassigned: groups.unassigned.map(brief) }
}

/** Uses the same holder and self-approval checks as the actual request detail. */
export function approvalDecision(request: RequestView, actor: Pick<ScreenActor, "id" | "canWrite" | "roles">, blockSelfApproval: boolean) {
  if (!["pr_pending", "src_pending", "po_pending"].includes(request.status)) return { allowed: false, reason: "approval step unavailable" }
  const approval = approvalOf(request)
  const step = Array.isArray(approval?.steps) ? approval.steps.find((item) => item?.status === "pending") : undefined
  if (!step) return { allowed: false, reason: "approval step unavailable" }
  if (step.holderId !== null && (typeof step.holderId !== "string" || !step.holderId)) return { allowed: false, reason: "approval holder unavailable" }
  if (step.holderId && step.holderId !== actor.id) return { allowed: false, reason: "waiting for the assigned holder" }
  if (blockSelfApproval && request.createdBy === actor.id) return { allowed: false, reason: "self-approval is blocked" }
  if (!actor.id.trim() || !actor.canWrite || !actor.roles.length || actor.roles.every((role) => role === "viewer")) return { allowed: false, reason: "write access required" }
  return { allowed: true, reason: "" }
}

/** An imported history without the actual transition cannot establish when this holder began waiting. */
export function approvalStageEntry(request: RequestView): string | null {
  const label = request.status === "pr_pending" ? "Requisition" : request.status === "src_pending" ? "Sourcing" : request.status === "po_pending" ? "Purchase order" : ""
  if (!label) return null
  const approval = approvalOf(request)
  const steps = Array.isArray(approval?.steps) ? approval.steps : []
  const pending = steps.findIndex((step) => step?.status === "pending")
  const history = Array.isArray(request.history) ? request.history : []
  const submitted = history.findLastIndex((line) => line?.action === `${label} submitted for approval`)
  if (pending < 0 || submitted < 0) return null
  const previous = steps[pending - 1]
  const entry = pending === 0 ? history[submitted] : previous?.status === "approved" && previous.levelName
    ? history.slice(submitted + 1).findLast((line) => line?.action === `${label} approved by ${previous.levelName}`)
    : undefined
  if (typeof entry?.at !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z)?$/.test(entry.at)) return null
  const time = Date.parse(entry.at)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === entry.at.slice(0, 10) ? entry.at : null
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
      .map((request) => {
        const guidance = requestStageGuidance(request.status)
        return `<p>${esc(request.number ?? "")} · ${esc(guidance.stage)} · ${esc(guidance.next)}</p>`
      })
      .join("")
  if (key === "My approvals" && input.requests) {
    const groups = approvalQueue(input.requests, input.actor.id)
    return [{ title: "Waiting for you", rows: groups.waitingForYou }, { title: "Waiting for others", rows: groups.waitingForOthers }, { title: "Unassigned", rows: groups.unassigned }].map((group) => `<h2>${group.title}</h2><ul>${group.rows.map((request) => {
      const approval = approvalOf(request)
      const step = Array.isArray(approval?.steps) ? approval.steps.find((item) => item?.status === "pending") : undefined
      const currency = request.status === "pr_pending" ? request.prApprovalBaseCurrency : request.status === "src_pending" ? request.sourcing?.approvalBaseCurrency : request.status === "po_pending" ? request.po?.approvalBaseCurrency : undefined
      const amount = typeof approval?.amount === "number" && Number.isFinite(approval.amount) ? `${approval.amount} ${currency || "(submitted base currency unavailable)"}` : "Unavailable"
      const stage = request.status === "pr_pending" ? "Requisition" : request.status === "src_pending" ? "Sourcing selection" : request.status === "po_pending" ? "Purchase order" : "Unrecognized approval stage"
      const holder = step?.holderId ? `Assigned holder: ${step.holderId}` : "Unassigned"
      return `<li>${esc(request.number ?? "")} · ${esc(request.pr?.title || "Unavailable")} · ${esc(stage)} · ${esc(amount)} · ${esc(holder)} · ${step ? "Review approval" : "Approval step unavailable"}</li>`
    }).join("")}</ul>`).join("")
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
    request.createdBy,
    request.buyerId,
    approvalOf(request)?.steps?.find((step) => step.status === "pending")?.holderId,
    requestStageGuidance(request.status).stage,
  ]
  return fields.some((field) => typeof field === "string" && field.toLowerCase().includes(query.toLowerCase()))
}

function toBase(
  total: number,
  currency: string,
  rates: Rates,
  snapshot: Record<string, number | null> | null | undefined,
): number | null {
  if (!currency || currency === rates.currency) return total
  const snap = snapshot?.[currency]
  if (snap != null && snap > 0 && Number.isFinite(total * snap)) return total * snap
  if (snapshot != null) return null
  const found = rates.fxRates?.find((rate) => rate.code === currency)
  if (found && found.rate > 0 && Number.isFinite(total * found.rate)) return total * found.rate
  return null
}

function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip)
  if (!value || typeof value !== "object") return value
  const field = (value as Record<string, unknown>).field
  if (typeof field === "string" && ["iban", "account", "bankname", "swift", "accountholder", "bankcountry"].includes(field.toLowerCase())) return { field }
  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (["scores", "cscores", "iban", "account", "bankname", "swift", "accountholder", "bankcountry"].includes(key.toLowerCase())) continue
    out[key] = strip(item)
  }
  return out
}
