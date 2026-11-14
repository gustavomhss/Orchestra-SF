// Função da secção 4.1 de Desenho-porta.md. Não tranca. Não contém os dados iniciais. Não chama o Teams.

const ACTIONS = [
  "create",
  "submit_pr",
  "approve",
  "reject",
  "select_quote",
  "submit_sourcing",
  "submit_po",
  "issue",
  "cancel",
] as const

const STATUSES = [
  "draft",
  "pr_pending",
  "pr_rejected",
  "sourcing",
  "src_pending",
  "src_rejected",
  "po_draft",
  "po_pending",
  "po_rejected",
  "po_approved",
  "po_issued",
  "cancelled",
] as const

const ROLES = ["requester", "buyer", "approver", "admin"] as const
const AT = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,9})?Z$/
const EDGE = /^[\t\n\r ]+|[\t\n\r ]+$/g
const ARROW = " \u2192 "

type ActionType = (typeof ACTIONS)[number]
type Status = (typeof STATUSES)[number]
type Role = (typeof ROLES)[number]

type Step = {
  levelId: string
  levelName: string
  threshold: number
  holderId: string | null
  status: "pending" | "approved" | "rejected"
}

type Approval = { amount: number; fxRate: number | null; steps: Step[] }

type Quote = {
  id: string
  supplier: string
  supplierId: string | null
  currency: string
  total: number
  qty: number
  unitPrice: number
  techPass: boolean
}

type Sourcing = {
  quotes: Quote[]
  selectedId: string | null
  fxSnapshot: Record<string, number | null> | null
  approval: Approval | null
  contractStrategy: string
}

type Line = { qty: number; unitPrice: number }

type PO = {
  number: string
  currency: string
  fxRate: number | null
  expenseType: string
  supplier: string
  supplierId: string | null
  sourceQuoteId: string | null
  lines: Line[]
  approval: Approval | null
  issuedAt: string | null
}

type HistoryLine = { at: string; by: string; action: string; note: string }

type Request = {
  number: string
  status: Status
  createdBy: string
  pr: { estAmount: number | null; recurring: boolean; expenseType: string } & Record<string, unknown>
  prApproval: Approval | null
  sourcing: Sourcing | null
  po: PO | null
  history: HistoryLine[]
} & Record<string, unknown>

type Actor = { id: string; canWrite: boolean; roles: Role[] }

type Level = { id: string; name: string; threshold: number; holderId: string | null }

type Settings = {
  currency: string
  levels: Level[]
  prApprovalMode: "first" | "matrix"
  blockSelfApproval: boolean
  fxRates: { code: string; rate: number }[]
}

type Issued = { pr: string[]; po: string[] }
type Supplier = { id: string; status: string }
type Action = Record<string, unknown> & { type: ActionType }

type Ready = {
  request: Request | null
  action: Action
  actor: Actor
  settings: Settings
  at: string
  issued: Issued
  supplier: Supplier | null
}

export function act(
  request: unknown,
  action: unknown,
  actor: unknown,
  settings: unknown,
  at: unknown,
  issued: unknown,
  supplier: unknown,
): { ok: true; request: Request } | { ok: false; code: string } {
  const ready = admit(request, action, actor, settings, at, issued, supplier)
  if ("code" in ready) return { ok: false, code: ready.code }
  return { ok: true, request: apply(ready) }
}

function admit(
  request: unknown,
  action: unknown,
  actor: unknown,
  settings: unknown,
  at: unknown,
  issued: unknown,
  supplier: unknown,
): Ready | { code: string } {
  const parsedActor = parseActor(actor)
  if (!parsedActor) return { code: "actor_invalid" }
  if (typeof at !== "string" || !AT.test(at)) return { code: "at_invalid" }
  const parsedSettings = parseSettings(settings)
  if (!parsedSettings) return { code: "settings_invalid" }
  const parsedIssued = parseIssued(issued)
  if (!parsedIssued) return { code: "issued_invalid" }
  const parsedSupplier = parseSupplier(supplier)
  if (parsedSupplier === false) return { code: "supplier_invalid" }
  if (actionInvalid(action)) return { code: "action_invalid" }
  if (request !== null && !isRequest(request)) return { code: "request_invalid" }
  if (parsedActor.canWrite !== true) return { code: "read_only" }
  const type = actionType(action)
  const parsedRequest = request === null ? null : (request as Request)
  if (notATransition(parsedRequest, type)) return { code: "not_a_transition" }
  if (parsedRequest?.status === "cancelled") return { code: "cancelled" }
  if (parsedRequest?.status === "po_issued") return { code: "already_issued" }
  const parsedAction = action as Action
  if ((type === "approve" || type === "reject") && !firstPending(parsedRequest)) return { code: "no_step" }
  if ((type === "create" || type === "submit_pr") && !whoRequester(parsedRequest, parsedActor, type)) {
    return { code: "not_requester" }
  }
  if (
    (type === "select_quote" || type === "submit_sourcing" || type === "submit_po" || type === "issue") &&
    !hasRole(parsedActor, "buyer") &&
    !hasRole(parsedActor, "admin")
  ) {
    return { code: "not_buyer" }
  }
  if (type === "cancel" && !isCreatedBy(parsedRequest, parsedActor) && !hasRole(parsedActor, "admin")) {
    return { code: "not_canceller" }
  }
  if (type === "approve" || type === "reject") {
    const pending = firstPending(parsedRequest)
    const holderSet = pending?.step.holderId != null
    const notHolder = pending?.step.holderId !== parsedActor.id
    if (holderSet && notHolder && hasRole(parsedActor, "admin")) return { code: "no_override" }
    if (holderSet && notHolder && !hasRole(parsedActor, "admin")) return { code: "not_approver" }
    if (parsedSettings.blockSelfApproval && isCreatedBy(parsedRequest, parsedActor)) return { code: "self_approval" }
  }
  if ((type === "reject" || type === "cancel") && reasonEmpty(parsedAction.reason)) return { code: "reason_required" }
  if (type === "select_quote" && !namedQuote(parsedRequest, String(parsedAction.quoteId))) return { code: "no_quote" }
  if (type === "select_quote" && namedQuote(parsedRequest, String(parsedAction.quoteId))?.techPass === false) {
    return { code: "not_compliant" }
  }
  if (type === "submit_sourcing" && !selectedQuote(parsedRequest)) return { code: "no_selection" }
  if ((type === "submit_po" || type === "issue") && parsedRequest?.po == null) return { code: "no_po" }
  if (type === "submit_po" && parsedRequest?.po && parsedRequest.po.expenseType !== "OPEX" && parsedRequest.po.expenseType !== "CAPEX") {
    return { code: "no_expense_type" }
  }
  if ((type === "submit_sourcing" || type === "submit_po") && supplierBlocked(parsedRequest, parsedSupplier, type)) {
    return { code: "supplier_blocked" }
  }
  if (type === "submit_sourcing" || type === "submit_po") {
    if (fxAbsence(parsedRequest, parsedSettings, type)) return { code: "no_fx" }
  }
  return {
    request: parsedRequest,
    action: parsedAction,
    actor: parsedActor,
    settings: parsedSettings,
    at,
    issued: parsedIssued,
    supplier: parsedSupplier,
  }
}

function apply(ready: Ready): Request {
  if (ready.action.type === "create") return create(ready)
  const next = structuredClone(ready.request) as Request
  if (ready.action.type === "submit_pr") return submitPr(next, ready)
  if (ready.action.type === "approve") return approve(next, ready)
  if (ready.action.type === "reject") return reject(next, ready)
  if (ready.action.type === "select_quote") return selectQuote(next, ready)
  if (ready.action.type === "submit_sourcing") return submitSourcing(next, ready)
  if (ready.action.type === "submit_po") return submitPo(next, ready)
  if (ready.action.type === "issue") return issue(next, ready)
  return cancel(next, ready)
}

function create(ready: Ready): Request {
  const pr = structuredClone(ready.action.pr) as Request["pr"]
  return {
    number: mint(prefix("PR", ready.at), ready.issued.pr),
    status: "draft",
    createdBy: ready.actor.id,
    pr,
    prApproval: null,
    sourcing: null,
    po: null,
    history: [line(ready, "Requisition created", "")],
  }
}

function submitPr(request: Request, ready: Ready): Request {
  const amount = prAmount(request.pr)
  const steps = copySteps(prRoute(ready.settings, amount))
  request.status = "pr_pending"
  request.prApproval = { amount, fxRate: null, steps }
  push(request, ready, "Requisition submitted for approval", names(steps))
  return request
}

function approve(request: Request, ready: Ready): Request {
  const pending = firstPending(request)
  if (!pending) return request
  const label = labelOf(request.status)
  const steps = stepsOf(request)
  steps[pending.index].status = "approved"
  push(request, ready, `${label} approved by ${pending.step.levelName}`, commentNote(ready.action.comment))
  if (pending.resta) return request
  if (request.status === "pr_pending") {
    request.status = "sourcing"
    if (request.sourcing == null) {
      request.sourcing = {
        quotes: [],
        selectedId: null,
        fxSnapshot: null,
        approval: null,
        contractStrategy: request.pr.recurring === true ? "new" : "",
      }
    }
    push(request, ready, "Sourcing started", "")
    return request
  }
  if (request.status === "src_pending") {
    request.status = "po_draft"
    if (request.po) request.po.issuedAt = null
    push(request, ready, "PO draft generated from selected quotation", request.po ? request.po.number : "")
    return request
  }
  request.status = "po_approved"
  if (request.po) request.po.issuedAt = null
  push(request, ready, "Purchase order approved", "")
  return request
}

function reject(request: Request, ready: Ready): Request {
  const pending = firstPending(request)
  if (!pending) return request
  const note = trimEdges(String(ready.action.reason))
  stepsOf(request)[pending.index].status = "rejected"
  push(request, ready, `${labelOf(request.status)} rejected by ${pending.step.levelName}`, note)
  if (request.status === "pr_pending") request.status = "pr_rejected"
  if (request.status === "src_pending") {
    request.status = "src_rejected"
    if (request.sourcing) request.sourcing.fxSnapshot = null
  }
  if (request.status === "po_pending") {
    request.status = "po_rejected"
    if (request.po) request.po.fxRate = null
  }
  return request
}

function selectQuote(request: Request, ready: Ready): Request {
  const quote = namedQuote(request, String(ready.action.quoteId))
  if (!request.sourcing || !quote) return request
  request.sourcing.selectedId = quote.id
  const retained = request.po?.sourceQuoteId === quote.id
  if (!retained) request.po = proposta(request, quote, ready)
  push(request, ready, retained ? "Quotation selected \u2014 existing PO proposal retained" : "Quotation selected \u2014 PO proposal generated", quote.supplier)
  return request
}

function submitSourcing(request: Request, ready: Ready): Request {
  const quote = selectedQuote(request)
  if (!request.sourcing || !quote) return request
  const rate = fx(ready.settings, quote.currency)
  const amount = quote.total * (rate as number)
  request.sourcing.fxSnapshot = snapshot(request.sourcing.quotes, ready.settings)
  request.sourcing.approval = { amount, fxRate: rate, steps: copySteps(entram(ready.settings.levels, amount)) }
  if (request.po == null || request.po.sourceQuoteId !== quote.id) request.po = proposta(request, quote, ready)
  request.status = "src_pending"
  push(request, ready, "Sourcing submitted for approval", names(request.sourcing.approval.steps))
  return request
}

function submitPo(request: Request, ready: Ready): Request {
  if (!request.po) return request
  const rate = fx(ready.settings, request.po.currency) as number
  const amount = poSum(request.po.lines) * rate
  request.po.fxRate = rate
  request.po.approval = { amount, fxRate: rate, steps: copySteps(entram(ready.settings.levels, amount)) }
  request.status = "po_pending"
  push(request, ready, "Purchase order submitted for approval", names(request.po.approval.steps))
  return request
}

function issue(request: Request, ready: Ready): Request {
  if (!request.po) return request
  request.po.issuedAt = ready.at
  request.status = "po_issued"
  push(request, ready, "PO issued internally", request.po.number)
  return request
}

function cancel(request: Request, ready: Ready): Request {
  request.status = "cancelled"
  push(request, ready, "Request cancelled", trimEdges(String(ready.action.reason)))
  return request
}

function proposta(request: Request, quote: Quote, ready: Ready): PO {
  const kept = request.po && typeof request.po.number === "string" && request.po.number.length > 0 ? request.po.number : mint(prefix("PO", ready.at), ready.issued.po)
  const expense = expenseType(request)
  return {
    number: kept,
    currency: quote.currency.length > 0 ? quote.currency : ready.settings.currency,
    fxRate: null,
    expenseType: expense,
    supplier: quote.supplier,
    supplierId: quote.supplierId,
    sourceQuoteId: quote.id,
    lines: [{ qty: Number.isFinite(quote.qty) && quote.qty !== 0 ? quote.qty : 1, unitPrice: Number.isFinite(quote.unitPrice) ? quote.unitPrice : 0 }],
    approval: null,
    issuedAt: null,
  }
}

function expenseType(request: Request): string {
  if (request.po && (request.po.expenseType === "OPEX" || request.po.expenseType === "CAPEX")) return request.po.expenseType
  if (request.pr.expenseType === "OPEX" || request.pr.expenseType === "CAPEX") return request.pr.expenseType
  return ""
}

function snapshot(quotes: Quote[], settings: Settings): Record<string, number | null> {
  const map: Record<string, number | null> = {}
  for (const quote of quotes) {
    const key = quote.currency.length > 0 ? quote.currency : settings.currency
    map[key] = fx(settings, key)
  }
  return map
}

function copySteps(route: Level[]): Step[] {
  return route.map((level) => ({
    levelId: level.id,
    levelName: level.name,
    threshold: level.threshold,
    holderId: level.holderId === null || level.holderId === "" ? null : level.holderId,
    status: "pending",
  }))
}

function prRoute(settings: Settings, amount: number): Level[] {
  const entered = entram(settings.levels, amount)
  if (settings.prApprovalMode === "first") return [entered[0]]
  return entered
}

function entram(levels: Level[], amount: number): Level[] {
  const ordered = levels
    .map((level, index) => ({ level, index }))
    .sort((a, b) => a.level.threshold - b.level.threshold || a.index - b.index)
    .map((item) => item.level)
  const entered = ordered.filter((level) => level.threshold <= 0 || amount > level.threshold)
  if (entered.length === 0) return [ordered[0]]
  return entered
}

function fx(settings: Settings, code: string): number | null {
  if (code === "" || code === settings.currency) return 1
  const found = settings.fxRates.find((rate) => rate.code === code)
  if (found && Number.isFinite(found.rate) && found.rate > 0) return found.rate
  return null
}

function mint(prefix: string, list: string[]): string {
  const max = list.reduce((current, item) => {
    if (!item.startsWith(prefix)) return current
    const rest = item.slice(prefix.length)
    if (!/^[0-9]+$/.test(rest)) return current
    return Math.max(current, Number(rest))
  }, 0)
  return prefix + String(max + 1).padStart(4, "0")
}

function prefix(kind: "PR" | "PO", at: string): string {
  return `${kind}-${Number.parseInt(at.slice(0, 4), 10)}-`
}

function prAmount(pr: Request["pr"]): number {
  return typeof pr.estAmount === "number" && Number.isFinite(pr.estAmount) ? pr.estAmount : 0
}

function poSum(lines: Line[]): number {
  return lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0)
}

function names(steps: Step[]): string {
  return steps.map((step) => step.levelName).join(ARROW)
}

function line(ready: Ready, action: string, note: string): HistoryLine {
  return { at: ready.at, by: ready.actor.id, action, note }
}

function push(request: Request, ready: Ready, action: string, note: string) {
  request.history.push(line(ready, action, note))
}

function commentNote(comment: unknown): string {
  if (typeof comment !== "string") return ""
  return trimEdges(comment)
}

function trimEdges(value: string): string {
  return value.replace(EDGE, "")
}

function labelOf(status: Status): string {
  if (status === "src_pending") return "Sourcing"
  if (status === "po_pending") return "Purchase order"
  return "Requisition"
}

function stepsOf(request: Request): Step[] {
  if (request.status === "src_pending") return request.sourcing?.approval?.steps ?? []
  if (request.status === "po_pending") return request.po?.approval?.steps ?? []
  return request.prApproval?.steps ?? []
}

function firstPending(request: Request | null): { index: number; step: Step; resta: boolean } | null {
  if (!request) return null
  const steps = stepsOf(request)
  const index = steps.findIndex((step) => step.status === "pending")
  if (index < 0) return null
  return { index, step: steps[index], resta: steps.some((step, at) => at > index && step.status === "pending") }
}

function namedQuote(request: Request | null, quoteId: string): Quote | null {
  if (!request?.sourcing) return null
  return request.sourcing.quotes.find((quote) => quote.id === quoteId) ?? null
}

function selectedQuote(request: Request | null): Quote | null {
  if (!request?.sourcing || request.sourcing.selectedId == null) return null
  return request.sourcing.quotes.find((quote) => quote.id === request.sourcing?.selectedId) ?? null
}

function supplierBlocked(request: Request | null, supplier: Supplier | null, type: ActionType): boolean {
  if (!supplier || !request) return false
  if (type === "submit_sourcing") {
    const quote = selectedQuote(request)
    return quote != null && quote.supplierId != null && supplier.id === quote.supplierId && supplier.status === "blocked"
  }
  return request.po?.supplierId != null && supplier.id === request.po.supplierId && supplier.status === "blocked"
}

function fxAbsence(request: Request | null, settings: Settings, type: ActionType): boolean {
  if (!request) return false
  if (type === "submit_sourcing") {
    const quote = selectedQuote(request)
    if (!quote) return false
    return fx(settings, quote.currency) == null
  }
  if (!request.po) return false
  return fx(settings, request.po.currency) == null
}

function notATransition(request: Request | null, type: ActionType | null): boolean {
  if (request === null && type !== "create") return true
  if (request !== null && type === "create") return true
  if (type == null) return true
  if (!request) return false
  if (request.status === "cancelled" || request.status === "po_issued") return false
  return !inDe(request.status, type)
}

function inDe(status: Status, type: ActionType): boolean {
  if (type === "cancel") return true
  if ((status === "draft" || status === "pr_rejected") && type === "submit_pr") return true
  if (status === "pr_pending" && (type === "approve" || type === "reject")) return true
  if ((status === "sourcing" || status === "src_rejected") && (type === "select_quote" || type === "submit_sourcing")) return true
  if (status === "src_pending" && (type === "approve" || type === "reject")) return true
  if ((status === "po_draft" || status === "po_rejected") && type === "submit_po") return true
  if (status === "po_pending" && (type === "approve" || type === "reject")) return true
  return status === "po_approved" && type === "issue"
}

function whoRequester(request: Request | null, actor: Actor, type: ActionType): boolean {
  if (type === "create") return hasRole(actor, "requester") || hasRole(actor, "admin")
  return isCreatedBy(request, actor) || hasRole(actor, "requester") || hasRole(actor, "admin")
}

function isCreatedBy(request: Request | null, actor: Actor): boolean {
  return request != null && actor.id === request.createdBy
}

function hasRole(actor: Actor, role: Role): boolean {
  return actor.roles.includes(role)
}

function reasonEmpty(reason: unknown): boolean {
  return typeof reason !== "string" || trimEdges(reason).length === 0
}

function actionType(action: unknown): ActionType | null {
  if (!isRecord(action) || typeof action.type !== "string") return null
  if (!ACTIONS.includes(action.type as ActionType)) return null
  return action.type as ActionType
}

function actionInvalid(action: unknown): boolean {
  const type = actionType(action)
  if (!type || !isRecord(action)) return false
  return !actionShape(action, type)
}

function actionShape(action: Record<string, unknown>, type: ActionType): boolean {
  if (type === "create") return exactKeys(action, ["type", "pr"]) && isPr(action.pr)
  if (type === "approve") return optionalKey(action, "comment") && (action.comment === undefined || typeof action.comment === "string")
  if (type === "reject" || type === "cancel") return exactKeys(action, ["type", "reason"]) && typeof action.reason === "string"
  if (type === "select_quote") return exactKeys(action, ["type", "quoteId"]) && typeof action.quoteId === "string"
  return exactKeys(action, ["type"])
}

function optionalKey(action: Record<string, unknown>, optional: string): boolean {
  return Object.keys(action).every((key) => key === "type" || key === optional) && Object.hasOwn(action, "type")
}

function parseActor(actor: unknown): Actor | null {
  if (!isRecord(actor) || !exactKeys(actor, ["id", "canWrite", "roles"])) return null
  if (typeof actor.id !== "string" || trimEdges(actor.id).length === 0) return null
  if (typeof actor.canWrite !== "boolean") return null
  if (!Array.isArray(actor.roles) || actor.roles.some((role) => typeof role !== "string" || !ROLES.includes(role as Role))) return null
  return { id: actor.id, canWrite: actor.canWrite, roles: actor.roles }
}

function parseSettings(settings: unknown): Settings | null {
  if (!isRecord(settings) || !exactKeys(settings, ["currency", "levels", "prApprovalMode", "blockSelfApproval", "fxRates"])) return null
  if (typeof settings.currency !== "string" || settings.currency.length === 0) return null
  if (settings.prApprovalMode !== "first" && settings.prApprovalMode !== "matrix") return null
  if (typeof settings.blockSelfApproval !== "boolean") return null
  if (!Array.isArray(settings.levels) || settings.levels.length === 0 || settings.levels.some((level) => !isLevel(level))) return null
  if (!Array.isArray(settings.fxRates) || settings.fxRates.some((rate) => !isFx(rate))) return null
  return settings as Settings
}

function isLevel(level: unknown): level is Level {
  if (!isRecord(level) || !exactKeys(level, ["id", "name", "threshold", "holderId"])) return false
  return typeof level.id === "string" && typeof level.name === "string" && isFiniteNumber(level.threshold) && (level.holderId === null || typeof level.holderId === "string")
}

function isFx(rate: unknown): rate is { code: string; rate: number } {
  if (!isRecord(rate) || !exactKeys(rate, ["code", "rate"])) return false
  return typeof rate.code === "string" && isFiniteNumber(rate.rate)
}

function parseIssued(issued: unknown): Issued | null {
  if (!isRecord(issued) || !exactKeys(issued, ["pr", "po"])) return null
  if (!stringList(issued.pr) || !stringList(issued.po)) return null
  return { pr: issued.pr, po: issued.po }
}

function parseSupplier(supplier: unknown): Supplier | null | false {
  if (supplier === null) return null
  if (!isRecord(supplier) || typeof supplier.id !== "string" || typeof supplier.status !== "string") return false
  return { id: supplier.id, status: supplier.status }
}

function isRequest(value: unknown): value is Request {
  if (!isRecord(value)) return false
  if (typeof value.number !== "string" || typeof value.createdBy !== "string") return false
  if (!STATUSES.includes(value.status as Status)) return false
  if (!isPr(value.pr)) return false
  if (value.prApproval !== null && !isApproval(value.prApproval)) return false
  if (value.sourcing !== null && !isSourcing(value.sourcing)) return false
  if (value.po !== null && !isPo(value.po)) return false
  return Array.isArray(value.history) && value.history.every(isHistory)
}

function isPr(value: unknown): value is Request["pr"] {
  if (!isRecord(value)) return false
  if (!Object.hasOwn(value, "estAmount") || !Object.hasOwn(value, "recurring") || !Object.hasOwn(value, "expenseType")) return false
  const amountOk = value.estAmount === null || isFiniteNumber(value.estAmount)
  return amountOk && typeof value.recurring === "boolean" && typeof value.expenseType === "string"
}

function isApproval(value: unknown): value is Approval {
  if (!isRecord(value) || !exactKeys(value, ["amount", "fxRate", "steps"])) return false
  if (!isFiniteNumber(value.amount) || !(value.fxRate === null || isFiniteNumber(value.fxRate))) return false
  return Array.isArray(value.steps) && value.steps.every(isStep)
}

function isStep(value: unknown): value is Step {
  if (!isRecord(value) || !exactKeys(value, ["levelId", "levelName", "threshold", "holderId", "status"])) return false
  const holderOk = value.holderId === null || (typeof value.holderId === "string" && value.holderId.length > 0)
  return typeof value.levelId === "string" && typeof value.levelName === "string" && isFiniteNumber(value.threshold) && holderOk && (value.status === "pending" || value.status === "approved" || value.status === "rejected")
}

function isSourcing(value: unknown): value is Sourcing {
  if (!isRecord(value) || !exactKeys(value, ["quotes", "selectedId", "fxSnapshot", "approval", "contractStrategy"])) return false
  if (!Array.isArray(value.quotes) || value.quotes.some((quote) => !isQuote(quote))) return false
  if (!(value.selectedId === null || typeof value.selectedId === "string")) return false
  if (value.fxSnapshot !== null && !isSnapshot(value.fxSnapshot)) return false
  if (value.approval !== null && !isApproval(value.approval)) return false
  return typeof value.contractStrategy === "string"
}

function isQuote(value: unknown): value is Quote {
  if (!isRecord(value) || !exactKeys(value, ["id", "supplier", "supplierId", "currency", "total", "qty", "unitPrice", "techPass"])) return false
  return typeof value.id === "string" && typeof value.supplier === "string" && (value.supplierId === null || typeof value.supplierId === "string") && typeof value.currency === "string" && isFiniteNumber(value.total) && isFiniteNumber(value.qty) && isFiniteNumber(value.unitPrice) && typeof value.techPass === "boolean"
}

function isPo(value: unknown): value is PO {
  if (!isRecord(value) || !exactKeys(value, ["number", "currency", "fxRate", "expenseType", "supplier", "supplierId", "sourceQuoteId", "lines", "approval", "issuedAt"])) return false
  if (typeof value.number !== "string" || typeof value.currency !== "string" || typeof value.expenseType !== "string" || typeof value.supplier !== "string") return false
  if (!(value.fxRate === null || isFiniteNumber(value.fxRate))) return false
  if (!(value.supplierId === null || typeof value.supplierId === "string")) return false
  if (!(value.sourceQuoteId === null || typeof value.sourceQuoteId === "string")) return false
  if (!(value.issuedAt === null || typeof value.issuedAt === "string")) return false
  if (value.approval !== null && !isApproval(value.approval)) return false
  return Array.isArray(value.lines) && value.lines.every(isLine)
}

function isLine(value: unknown): value is Line {
  return isRecord(value) && exactKeys(value, ["qty", "unitPrice"]) && isFiniteNumber(value.qty) && isFiniteNumber(value.unitPrice)
}

function isSnapshot(value: unknown): value is Record<string, number | null> {
  if (!isRecord(value)) return false
  return Object.values(value).every((item) => item === null || isFiniteNumber(item))
}

function isHistory(value: unknown): value is HistoryLine {
  return isRecord(value) && exactKeys(value, ["at", "by", "action", "note"]) && typeof value.at === "string" && typeof value.by === "string" && typeof value.action === "string" && typeof value.note === "string"
}

function stringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const got = Object.keys(value)
  return got.length === keys.length && keys.every((key) => got.includes(key))
}
