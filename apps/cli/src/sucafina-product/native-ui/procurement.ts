import type { SfNativeHostDependencies, SfProjectionHandler } from "./router"
import { roleMap } from "../../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { requestDraftActions } from "../../../../../modules/sucafina/Sucafinav1/runtime/procurement.ts"
import { object, rows, text } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Actor, Snapshot, View } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { procurementKeys } from "../../../../../modules/sucafina/Sucafinav1/src/nav.ts"
import { approvalQueue, procurementDashboard } from "../../../../../modules/sucafina/Sucafinav1/src/procurement-screen.ts"
import type { RequestView } from "../../../../../modules/sucafina/Sucafinav1/src/procurement-screen.ts"
import { publicSfData } from "../../../../../modules/sucafina/Sucafinav1/product/integration/public-state.ts"
import { readProcurementQueueView, procurementApprovalGroups } from "../../../../../modules/sucafina/Sucafinav1/product/procurement/queue-view.ts"
import type { ProcurementQueueView } from "../../../../../modules/sucafina/Sucafinav1/product/procurement/queue-view.ts"

type Capability = "CAP24" | "CAP25" | "CAP26" | "CAP27" | "CAP28"
type Page = "Dashboard" | "Requests" | "My approvals" | "Suppliers" | "Settings"
type Selection = Readonly<{
  year?: number; month?: number; filter?: string; q?: string
  request?: string; supplier?: string; status?: string
}>
const pages: Readonly<Record<Capability, Page>> = {
  CAP24: "Dashboard", CAP25: "Requests", CAP26: "My approvals",
  CAP27: "Suppliers", CAP28: "Settings",
}
const selectors: Readonly<Record<Capability, readonly string[]>> = {
  CAP24: ["year", "month"],
  CAP25: ["year", "month", "filter", "q", "request"],
  CAP26: ["year", "month"],
  CAP27: ["year", "month", "status", "q", "supplier"],
  CAP28: ["year", "month"],
}
const requestKeys = [
  "number", "status", "createdBy", "buyerId", "requesterName",
  "pr", "prApproval", "prApprovalBaseCurrency", "sourcing", "po", "history", "value",
] as const
const requisitionKeys = [
  "title", "type", "description", "estAmount", "costCenter", "needBy", "justification",
  "recurring", "frequency", "estAnnual", "expenseType", "category", "requesterName",
] as const
const sourceKeys = [
  "quotes", "evaluator", "selectedId", "fewQuotesJustification",
  "selectionJustification", "contractStrategy", "weights", "fxSnapshot",
  "approvalBaseCurrency", "approval",
] as const
const orderKeys = [
  "number", "currency", "expenseType", "supplier", "supplierId", "description",
  "lines", "paymentTerms", "deliveryDate", "deliveryConditions", "contractRef",
  "incoterm", "incoterms", "assetRef", "supplierContact", "quoteRef",
  "billingAddress", "deliveryAddress", "acceptance", "warranty", "notes",
  "fxRate", "approvalBaseCurrency", "approval",
] as const
const quoteKeys = [
  "id", "supplierId", "supplier", "currency", "total", "description", "notes",
  "attachments", "scores", "cscores", "techPass",
] as const
const supplierKeys = [
  "id", "number", "status", "createdBy", "legalName", "tradingName", "type", "country",
  "address", "taxId", "regNo", "contactName", "contactEmail", "contactPhone",
  "financeEmail", "paymentTerms", "currency", "incoterm", "riskRating",
  "dueDiligence", "sanctionsDate", "nda", "dpa", "certifications", "categories",
  "contacts", "commercial", "compliance", "notes", "validatedAt", "validatedBy",
] as const
const bankKeys = ["iban", "account", "bankName", "swift", "accountHolder", "bankCountry"] as const
const settingsKeys = [
  "currency", "levels", "prApprovalMode", "blockSelfApproval", "fxRates",
  "minQuotes", "techWeight", "commWeight", "criteria", "commCriteria",
  "requireActiveSupplier", "paymentTerms", "categories", "incoterms",
  "billingAddress", "defaultDeliveryAddress", "fxUpdated", "reminderDays",
  "escalationDays", "uploadCap",
] as const
const formSettingsKeys = [
  "currency", "fxRates", "minQuotes", "techWeight", "commWeight", "criteria",
  "commCriteria", "requireActiveSupplier", "blockSelfApproval", "paymentTerms",
  "categories", "incoterms",
] as const
const authorizedActions: Readonly<Record<Capability, readonly string[]>> = {
  CAP24: [],
  CAP25: [
    "create", "save", "submit_pr", "submit_sourcing", "select_quote",
    "submit_po", "approve", "reject", "issue", "cancel", "delete",
  ],
  CAP26: [
    "approve", "reject", "create", "save", "submit_pr", "submit_sourcing",
    "select_quote", "submit_po", "issue", "cancel", "delete",
  ],
  CAP27: ["create", "save", "activate", "block", "inactivate", "delete", "change-bank"],
  CAP28: ["save", "reset"],
}

function pick(source: unknown, keys: readonly string[]): Record<string, unknown> {
  const record = object(source)
  return Object.fromEntries(
    keys.filter((key) => Object.hasOwn(record, key))
      .map((key) => [key, structuredClone(record[key])]),
  )
}
function selectApproval(value: unknown) {
  if (value === null) return null
  const approval = pick(value, ["amount"])
  if (Object.hasOwn(object(value), "steps"))
    approval.steps = rows(object(value).steps).map((step) =>
      pick(step, ["holderId", "status", "levelName"]))
  return approval
}
function selectCriterion(value: Record<string, unknown>) {
  return pick(value, ["id", "name", "weight", "auto", "required"])
}
function selectQuote(value: Record<string, unknown>) {
  const quote = pick(value, quoteKeys.filter((key) => key !== "attachments"))
  if (Object.hasOwn(value, "attachments"))
    quote.attachments = rows(value.attachments).map((row) => pick(row, ["id", "name"]))
  return quote
}
function selectSourcing(value: unknown) {
  if (value === null) return null
  const source = object(value)
  const result = pick(source, sourceKeys.filter((key) => !["quotes", "weights", "approval"].includes(key)))
  if (Object.hasOwn(source, "quotes"))
    result.quotes = rows(source.quotes).map(selectQuote)
  if (Object.hasOwn(source, "approval"))
    result.approval = selectApproval(source.approval)
  if (Object.hasOwn(source, "weights")) {
    const weights = object(source.weights)
    const normalized = pick(weights, ["tech", "comm"])
    if (Object.hasOwn(weights, "criteria"))
      normalized.criteria = rows(weights.criteria).map(selectCriterion)
    if (Object.hasOwn(weights, "commCriteria"))
      normalized.commCriteria = rows(weights.commCriteria).map(selectCriterion)
    result.weights = normalized
  }
  return result
}
function selectPurchaseOrder(value: unknown) {
  if (value === null) return null
  const source = object(value)
  const order = pick(source, orderKeys.filter((key) => !["lines", "approval"].includes(key)))
  if (Object.hasOwn(source, "lines"))
    order.lines = rows(source.lines).map((line) => pick(line, ["id", "desc", "description", "unit", "notes", "qty", "unitPrice"]))
  if (Object.hasOwn(source, "approval"))
    order.approval = selectApproval(source.approval)
  return order
}
/** All data passed here has already crossed domain.view's current visibility boundary. */
function selectRequest(source: Record<string, unknown>, detail: boolean, actor: Actor) {
  if (!detail) {
    const minimal = pick(source, ["number", "status", "createdBy", "value"])
    if (Object.hasOwn(source, "po")) minimal.po = pick(source.po, ["expenseType"])
    return { ...minimal, allowedDraftActions: requestDraftActions(source, actor) }
  }
  const request = pick(source, requestKeys.filter((key) => !["pr", "sourcing", "po", "history"].includes(key)))
  if (Object.hasOwn(source, "pr"))
    request.pr = source.pr === null ? null : pick(source.pr, requisitionKeys)
  if (Object.hasOwn(source, "sourcing"))
    request.sourcing = selectSourcing(source.sourcing)
  if (Object.hasOwn(source, "po"))
    request.po = selectPurchaseOrder(source.po)
  if (Object.hasOwn(source, "prApproval"))
    request.prApproval = selectApproval(source.prApproval)
  if (Object.hasOwn(source, "history"))
    request.history = rows(source.history).map((entry) => pick(entry, ["at", "by", "action", "note"]))
  return { ...request, allowedDraftActions: requestDraftActions(source, actor) }
}
function selectSupplier(source: Record<string, unknown>, includeBank: boolean) {
  const safe = pick(source, includeBank ? [...supplierKeys, ...bankKeys] : supplierKeys)
  if (Object.hasOwn(source, "history"))
    safe.history = rows(source.history).map((entry) => pick(entry, ["field"]))
  if (Object.hasOwn(source, "contacts"))
    safe.contacts = rows(source.contacts).map((entry) => pick(entry, ["name", "email", "phone"]))
  if (Object.hasOwn(source, "commercial"))
    safe.commercial = pick(source.commercial, ["notes"])
  if (Object.hasOwn(source, "compliance"))
    safe.compliance = pick(source.compliance, ["notes"])
  return safe
}
function versionsFor(view: View, keys: readonly string[]) {
  return Object.fromEntries(keys
    .filter((key) => Object.hasOwn(view.versions, key))
    .map((key) => [key, structuredClone(view.versions[key])]))
}
function requestKeysFor(requests: readonly Record<string, unknown>[]) {
  return requests.filter((row) => typeof row.number === "string")
    .map((row) => "requests:" + String(row.number))
}
function visibleQueue(queue: ProcurementQueueView | undefined, requests: readonly Record<string, unknown>[]) {
  if (!queue) return true
  return queue.rows.length === requests.length &&
    requests.every((request) => typeof request.number === "string" &&
      queue.rows.some((row) => row.id === request.number))
}
function hasRequestShape(value: Record<string, unknown>): value is RequestView & Record<string, unknown> {
  return typeof value.status === "string" && typeof value.createdBy === "string" &&
    (value.number === undefined || typeof value.number === "string")
}
function approvalGroups(
  requests: readonly Record<string, unknown>[], actor: Actor, queue: ProcurementQueueView | undefined,
) {
  const valid = requests.filter(hasRequestShape)
  if (queue) {
    const groups = procurementApprovalGroups(queue, actor.id)
    const fromRows = (arr: readonly { id: string }[]) =>
      arr.flatMap((row) => {
        const request = valid.find((request) => request.number === row.id)
        return request ? [selectRequest(request, true, actor)] : []
      })
    return {
      waitingForYou: fromRows(groups.waitingForYou),
      waitingForOthers: fromRows(groups.waitingForOthers),
      unassigned: fromRows(groups.unassigned),
    }
  }
  const groups = approvalQueue(valid, actor.id)
  return {
    waitingForYou: groups.waitingForYou.map((row) => selectRequest(row, true, actor)),
    waitingForOthers: groups.waitingForOthers.map((row) => selectRequest(row, true, actor)),
    unassigned: groups.unassigned.map((row) => selectRequest(row, true, actor)),
  }
}
function pageData(
  capability: Capability, view: View, actor: Actor, prepared: Record<string, unknown>,
) {
  const data = view.data
  const requests = rows(data.requests)
  const suppliers = rows(data.suppliers)
  const queue = readProcurementQueueView(prepared.procurementQueueView)
  if (["CAP25", "CAP26"].includes(capability) &&
    Object.hasOwn(prepared, "procurementQueueView") && (!queue || !visibleQueue(queue, requests))) return undefined
  const formSettings = pick(data.formSettings, formSettingsKeys)
  const directory = rows(data.directory).map((row) => pick(row, ["id", "name"]))
  const requestsDetail = requests.map((row) => selectRequest(row, true, actor))
  const requestsSummary = requests.map((row) => selectRequest(row, false, actor))
  const requestsVersion = versionsFor(view, requestKeysFor(requests))
  if (capability === "CAP24") {
    // The existing source routine owns aggregate/FX semantics. Browser never re-sums.
    const rates = { currency: text(formSettings.currency), fxRates: rows(formSettings.fxRates)
      .flatMap((entry) => typeof entry.code === "string" && typeof entry.rate === "number"
        ? [{ code: entry.code, rate: entry.rate }] : []) }
    return {
      data: { requests: requestsSummary, formSettings, metrics: procurementDashboard(requests.filter(hasRequestShape), rates) },
      versions: {},
    }
  }
  if (capability === "CAP25") return {
    data: {
      requests: requestsDetail, suppliers: suppliers.map((row) => selectSupplier(row, false)),
      directory, formSettings, bankVerificationAvailable: data.bankVerificationAvailable === true,
    },
    versions: requestsVersion,
  }
  if (capability === "CAP26") return {
    data: { requests: requestsDetail, ...approvalGroups(requests, actor, queue), directory, formSettings },
    versions: requestsVersion,
  }
  if (capability === "CAP27") return {
    data: {
      suppliers: suppliers.map((row) => selectSupplier(row, actor.roles.some((role) => role === "admin" || role === "supplier admin"))),
      requests: requestsSummary, formSettings,
      bankVerificationAvailable: data.bankVerificationAvailable === true,
    },
    versions: versionsFor(view, suppliers.filter((row) => typeof row.id === "string")
      .map((row) => "suppliers:" + String(row.id))),
  }
  if (!actor.roles.includes("admin")) return undefined
  return {
    data: { settings: pick(data.settings, settingsKeys), directory },
    versions: versionsFor(view, ["settings"]),
  }
}
type ProcurementPageOutcome<Stamp> =
  | { status: "unauthenticated" | "denied" }
  | { status: "unavailable"; reason: "procurement-domain-unavailable" | "procurement-projection-unavailable" }
  | { status: "stale"; reason: "procurement-source-changed" }
  | {
      status: "ok"
      context: Stamp
      value: NonNullable<ReturnType<typeof pageData>> & Readonly<{
        capabilityId: Capability; selection: Selection; allowedActionIds: readonly string[]
      }>
    }

// Transaction's generic T must cover every authority outcome; inferring it from
// the first callback return would narrow all subsequent results to unauthenticated.
function parseSelection(query: URLSearchParams, capability: Capability): Selection | undefined {
  const allowed = selectors[capability]
  if ([...query.keys()].some((key) => !allowed.includes(key) || query.getAll(key).length !== 1)) return undefined
  const selected: {
    year?: number; month?: number; filter?: string; q?: string
    request?: string; supplier?: string; status?: string
  } = {}
  for (const [key, value] of query) {
    if (key === "year") {
      if (!/^202[4-7]$/.test(value)) return undefined
      selected.year = Number(value)
    } else if (key === "month") {
      if (!/^(?:[1-9]|1[0-2])$/.test(value)) return undefined
      selected.month = Number(value)
    } else if (key === "filter") selected.filter = value
    else if (key === "q") selected.q = value
    else if (key === "request") selected.request = value
    else if (key === "supplier") selected.supplier = value
    else if (key === "status") selected.status = value
  }
  return selected
}
function response(value: unknown, status: number): Response {
  return Response.json(value, {
    status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  })
}
function refusal(status: "unauthenticated" | "denied" | "unavailable" | "needs-input" | "stale", reason?: string) {
  return response(reason === undefined ? { status } : { status, reason },
    status === "unauthenticated" ? 401 : status === "denied" ? 403 :
      status === "needs-input" ? 400 : status === "stale" ? 409 : 503)
}
function sameStamp(
  a: Readonly<{ installationId: string; projectId: string; hostId: string; principalRef: string; policyVersion: string; accessRevision: string }>,
  b: typeof a,
) {
  return a.installationId === b.installationId && a.projectId === b.projectId &&
    a.hostId === b.hostId && a.principalRef === b.principalRef &&
    a.policyVersion === b.policyVersion && a.accessRevision === b.accessRevision
}
function makePageHandler(deps: SfNativeHostDependencies, capability: Capability) {
  const page = pages[capability]
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    if (url.origin !== deps.origin || url.pathname !== deps.mount + "/api/ui/pages/" + capability ||
      request.method !== "GET" || request.body !== null ||
      request.headers.get("sec-fetch-site") === "cross-site" ||
      request.headers.has("origin") && request.headers.get("origin") !== deps.origin)
      return refusal("denied")
    if (request.signal.aborted) return refusal("unavailable", "request-aborted")
    const selection = parseSelection(url.searchParams, capability)
    if (!selection) return refusal("needs-input", "invalid-procurement-selection")
    const bound = await deps.readContext(request)
    if (bound.status === "unauthenticated" || bound.status === "denied") return refusal(bound.status)
    if (bound.status !== "ok") return refusal("unavailable", bound.reason)
    const destination = bound.value.destinations.find((item) =>
      item.capabilityId === capability && item.surface === "procurement" &&
      item.page === page && item.canRead)
    if (!destination) return refusal("denied")
    // Source controls/actor are checked again under the original producer's lock.
    let prepared: Exclude<Awaited<ReturnType<NonNullable<typeof deps.application.productView>>>, Response> | undefined
    try {
      // Prepare the original environment outside the lock, as Application already does.
      const environment = await deps.application.environment(request)
      const productView = await deps.application.productView?.(request, "procurement", page)
      if (productView instanceof Response)
        return refusal("unavailable", "procurement-producer-unavailable")
      prepared = productView
      const result = await deps.application.persistence.transaction<ProcurementPageOutcome<typeof bound.value.stamp>>("procurement", async (snapshot: Snapshot) => {
        const principal = await deps.application.authenticate(request, {
          surface: "procurement", roleMap: roleMap(snapshot, "procurement"),
        })
        if (!principal || !principal.id || principal.id.startsWith("local:"))
          return { commit: false, value: { status: "unauthenticated" as const } }
        const roles = principal.roles.filter((row) => row.surface === "procurement").map((row) => row.role)
        const access = object(object(snapshot.data.access)[principal.id])
        const actor: Actor = {
          id: principal.id, roles,
          canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
          assigned: Array.isArray(access.assigned)
            ? access.assigned.filter((item): item is string => typeof item === "string") : [],
          domains: Array.isArray(access.domains)
            ? access.domains.filter((item): item is string => typeof item === "string") : [],
        }
        if (principal.id !== bound.value.stamp.principalRef || !procurementKeys(actor).includes(page) ||
          capability === "CAP28" && !actor.roles.includes("admin"))
          return { commit: false, value: { status: "denied" as const } }
        const contribution = deps.application.domains.procurement.find((item) => item.pages.includes(page))
        if (!contribution)
          return { commit: false, value: { status: "unavailable" as const, reason: "procurement-domain-unavailable" } }
        if (prepared && !await prepared.current(snapshot, actor))
          return { commit: false, value: { status: "stale" as const, reason: "procurement-source-changed" } }
        const view = contribution.domain.view(
          { ...snapshot, data: publicSfData(snapshot.data) }, actor,
          environment,
        )
        const projection = pageData(capability, view, actor, prepared?.data ?? {})
        if (!projection)
          return { commit: false, value: { status: "unavailable" as const, reason: "procurement-projection-unavailable" } }
        return {
          commit: false,
          value: {
            status: "ok" as const, context: bound.value.stamp,
            value: {
              capabilityId: capability, selection, ...projection,
              allowedActionIds: destination.allowedActionIds.filter((id) => authorizedActions[capability].includes(id)),
            },
          },
        }
      }, { signal: request.signal })
      if (result.status !== "ok") return refusal(result.status, "reason" in result ? result.reason : undefined)
      // Re-admit outside the producer lock, with the original Request. Never
      // reinterpret a vanished response as an empty list or a successful edit.
      const current = await deps.readContext(request)
      if (request.signal.aborted || current.status !== "ok")
        return refusal(current.status === "unauthenticated" || current.status === "denied" ? current.status : "unavailable", "procurement-context-changed")
      if (!sameStamp(current.value.stamp, bound.value.stamp)) return refusal("stale", "procurement-context-changed")
      const currentDestination = current.value.destinations.find((item) =>
        item.capabilityId === capability && item.surface === "procurement" && item.page === page && item.canRead)
      if (!currentDestination) return refusal("denied")
      if (JSON.stringify(currentDestination.allowedActionIds) !== JSON.stringify(destination.allowedActionIds))
        return refusal("stale", "procurement-actions-changed")
      return response(result, 200)
    } catch {
      return refusal("unavailable", "procurement-read-unavailable")
    } finally {
      prepared?.finish()
    }
  }
}

/**
 * Only the five HTML-only CAP read projections are new HTTP handlers.
 * Existing /procurement commands, scenario and sourcing operations remain owned
 * by their established producers and receive the original Request via F02.
 */
export function createSfProcurementProjectionHandlers(
  deps: SfNativeHostDependencies,
): readonly SfProjectionHandler[] {
  return [
    { operationId: "domain.page.CAP24", handle: makePageHandler(deps, "CAP24") },
    { operationId: "domain.page.CAP25", handle: makePageHandler(deps, "CAP25") },
    { operationId: "domain.page.CAP26", handle: makePageHandler(deps, "CAP26") },
    { operationId: "domain.page.CAP27", handle: makePageHandler(deps, "CAP27") },
    { operationId: "domain.page.CAP28", handle: makePageHandler(deps, "CAP28") },
  ] as const
}
