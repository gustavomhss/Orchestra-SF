import { createHash } from "node:crypto"
import {
  createRequest,
  submitPR,
  submitSourcing,
  submitPO,
  approve,
  reject,
  selectQuote,
  issue,
  cancel,
  deleteDraft,
  nextSup,
} from "../src/procurement.ts"
import type { Store } from "../src/procurement.ts"
import { visibleRequests, requestStageGuidance, orderSourceGuidance } from "../src/requests.ts"
import { quoteAssessment, quoteComparisonPresentation } from "../src/form.ts"
import type { FormSettings } from "../src/form.ts"
import { approvalDecision, approvalQueue, approvalStageEntry, exportRegister, requestValue } from "../src/procurement-screen.ts"
import type { RequestView } from "../src/procurement-screen.ts"
import { initialProcurementSettings } from "../src/initial-settings.ts"
import { activateSupplier, open, seal, supplierActivationRequirements } from "../src/supplier.ts"
import type { BankSupplier } from "../src/supplier.ts"
import { esc } from "../src/screen-shell.ts"
import { changed, conflict, object, rows, text, finite } from "./contract.ts"
import { presentProcurementFieldErrors, purchaseOrderFieldErrors, purchaseOrderFieldSources, requisitionFieldErrors, sourcingFieldErrors } from "../product/procurement/guided-request.ts"
import { procurementMonetaryFacts } from "../product/procurement/monetary.ts"
import { readProcurementQueueView, procurementApprovalGroups } from "../product/procurement/queue-view.ts"
import type { ProcurementQueueRow } from "../product/procurement/queue-view.ts"
import type { Actor, Domain, Snapshot, Command, Environment, Result } from "./contract.ts"
import { fields, form, table, metric, metricGrid } from "./ui.ts"
import type { RenderContext } from "./ui.ts"
export const pages = ["Dashboard", "Requests", "My approvals", "Suppliers", "Settings"] as const
const prFields = [
  "title",
  "type",
  "description",
  "estAmount",
  "costCenter",
  "needBy",
  "justification",
  "recurring",
  "frequency",
  "estAnnual",
  "expenseType",
  "category",
  "requesterName",
]
const sourceFields = [
  "quotes",
  "evaluator",
  "selectedId",
  "fewQuotesJustification",
  "selectionJustification",
  "contractStrategy",
  "weights",
]
const poFields = [
  "currency",
  "expenseType",
  "supplier",
  "supplierId",
  "description",
  "lines",
  "paymentTerms",
  "deliveryDate",
  "deliveryConditions",
  "contractRef",
  "incoterm",
  "incoterms",
  "assetRef",
  "supplierContact",
  "quoteRef",
  "billingAddress",
  "deliveryAddress",
  "acceptance",
  "warranty",
  "notes",
]
const supplierFields = [
  "legalName",
  "tradingName",
  "type",
  "country",
  "address",
  "taxId",
  "regNo",
  "contactName",
  "contactEmail",
  "contactPhone",
  "financeEmail",
  "paymentTerms",
  "currency",
  "incoterm",
  "riskRating",
  "dueDiligence",
  "sanctionsDate",
  "nda",
  "dpa",
  "certifications",
  "categories",
  "contacts",
  "commercial",
  "compliance",
  "notes",
]
const bankFields = ["iban", "account", "bankName", "swift", "accountHolder", "bankCountry"] as const
const settingsFields = [
  "currency",
  "levels",
  "prApprovalMode",
  "blockSelfApproval",
  "fxRates",
  "minQuotes",
  "techWeight",
  "commWeight",
  "criteria",
  "commCriteria",
  "requireActiveSupplier",
  "paymentTerms",
  "categories",
  "incoterms",
  "billingAddress",
  "defaultDeliveryAddress",
  "fxUpdated",
  "reminderDays",
  "escalationDays",
  "uploadCap",
]
function pick(value: unknown, keys: readonly string[]) {
  const record = object(value)
  return Object.fromEntries(
    keys.filter((key) => Object.hasOwn(record, key)).map((key) => [key, structuredClone(record[key])]),
  )
}
function has(actor: Actor, ...roles: string[]) {
  return roles.some((role) => actor.roles.includes(role))
}
function initial() {
  return initialProcurementSettings()
}
function load(snapshot: Snapshot): Store {
  const stored = object(snapshot.data.store)
  return structuredClone({
    settings: object(stored.settings),
    form: {
      currency: text(object(stored.settings).currency),
      ...object(stored.settings),
    },
    issued: { pr: [], po: [], ...object(stored.issued) },
    sup: Array.isArray(stored.sup) ? stored.sup.filter((code): code is string => typeof code === "string") : [],
    suppliers: rows(stored.suppliers).map((item) => ({
      ...item,
      id: String(item.id ?? ""),
    })),
    requests: object(stored.requests),
    actCalls: finite(stored.actCalls),
    lastIssued: stored.lastIssued ?? null,
  }) as unknown as Store
}
function pending(request: Record<string, unknown>) {
  const approval = object(
    request.status === "src_pending"
      ? object(request.sourcing).approval
      : request.status === "po_pending"
        ? object(request.po).approval
        : request.prApproval,
  )
  return {
    approval,
    step: rows(approval.steps).find((step) => step.status === "pending"),
  }
}
function redactBank(value: unknown, secrets: string[] = []): unknown {
  if (typeof value === "string")
    return secrets.some((secret) => secret.length > 0 && value.includes(secret)) ? "[redacted]" : value
  if (Array.isArray(value)) return value.map((item) => redactBank(item, secrets))
  if (value === null || typeof value !== "object") return value
  const record = object(value)
  if (bankFields.includes(text(record.field) as (typeof bankFields)[number])) return { field: record.field }
  return Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => !bankFields.some((field) => field.toLowerCase() === key.toLowerCase()))
      .map(([key, item]) => [key, redactBank(item, secrets)]),
  )
}
function privateBank(value: unknown) {
  return object(redactBank(value))
}
function bankValues(supplier: Record<string, unknown> | undefined, key: Uint8Array | undefined): string[] | undefined {
  try {
    return bankFields
      .map((field) => {
        const value = text(supplier?.[field])
        if (!["iban", "account"].includes(field)) return value
        return value && key?.length === 32 ? open(value, key) : ""
      })
      .filter(Boolean)
  } catch {
    return undefined
  }
}

// Role targets remain queued until the host resolves membership and performs delivery.
function queueNotice(snapshot: Snapshot, notice: Snapshot["notices"][number] & { roles?: string[] }) {
  snapshot.notices.push(notice)
}
// Porta accepts exact schemas. Business-only fields stay outside that projection and are restored after success.
function door(request: Record<string, unknown>) {
  return {
    ...request,
    sourcing:
      request.sourcing == null
        ? null
        : {
            ...pick(request.sourcing, ["selectedId", "fxSnapshot", "approval", "contractStrategy"]),
            quotes: rows(object(request.sourcing).quotes).map((quote) =>
              pick(quote, ["id", "supplier", "supplierId", "currency", "total", "qty", "unitPrice", "techPass"]),
            ),
          },
    po:
      request.po == null
        ? null
        : {
            ...pick(request.po, [
              "number",
              "currency",
              "fxRate",
              "expenseType",
              "supplier",
              "supplierId",
              "sourceQuoteId",
              "approval",
              "issuedAt",
            ]),
            lines: rows(object(request.po).lines).map((line) => pick(line, ["qty", "unitPrice"])),
          },
  }
}
function restore(previous: Record<string, unknown>, next: Record<string, unknown>) {
  const sourcing = object(previous.sourcing)
  const po = object(previous.po)
  return {
    ...next,
    attachments: previous.attachments ?? next.attachments ?? [],
    sourcing:
      next.sourcing == null
        ? null
        : {
            ...pick(sourcing, sourceFields),
            ...(typeof sourcing.approvalBaseCurrency === "string" ? { approvalBaseCurrency: sourcing.approvalBaseCurrency } : {}),
            ...object(next.sourcing),
            quotes: rows(object(next.sourcing).quotes).map((quote) => ({
              ...pick(
                rows(sourcing.quotes).find((item) => item.id === quote.id),
                ["scores", "cscores", "description", "notes", "attachments"],
              ),
              ...quote,
            })),
          },
    po:
      next.po == null
        ? null
        : {
            ...pick(po, poFields),
            ...(typeof po.approvalBaseCurrency === "string" ? { approvalBaseCurrency: po.approvalBaseCurrency } : {}),
            ...object(next.po),
            lines: rows(object(next.po).lines).map((line, index) => ({
              ...pick(rows(po.lines)[index], ["description", "desc", "unit", "uom", "notes"]),
              ...line,
            })),
          },
  }
}
type FormRowContext = { id: string; request: Record<string, unknown>; section: "sourcing" | "po" }
type FormRowError = { field: string; message: string }
const poRowMetadata = ["description", "unit", "notes"]
const quoteRowMetadata = ["scores", "cscores", "description", "notes", "attachments"]

function orderRowReference(id: string, index: number, line: Record<string, unknown>) {
  // Only omitted metadata identifies the source. Editing price/quantity or
  // advancing CAS must not invalidate the still-visible form's reference.
  const digest = createHash("sha256").update(JSON.stringify([id, pick(line, poRowMetadata)])).digest("hex")
  return `${index}:${digest}`
}

function retainedFormRows(path: string[], entries: unknown[], previous: FormRowContext | undefined, errors: FormRowError[]) {
  if (!previous || path.join(".") !== (previous.section === "sourcing" ? "sourcing.quotes" : "po.lines")) return entries
  const marked = (value: unknown) => value === true || value === "true" || value === "on"
  const existing = entries.map(object).filter((row) => !marked(row._remove) && !marked(row._new))
  if (path.join(".") === "sourcing.quotes") {
    const quotes = rows(object(previous.request.sourcing).quotes)
    const identity = (row: Record<string, unknown>) => typeof row.id === "string" || typeof row.id === "number" && Number.isFinite(row.id) ? String(row.id) : ""
    return entries.map((entry, index) => {
      const row = object(entry)
      if (marked(row._new) || marked(row._remove)) return entry
      const id = identity(row)
      const matches = quotes.filter((quote) => id && identity(quote) === id)
      if (!matches.length) return entry
      if (matches.length !== 1 || existing.filter((quote) => identity(quote) === id).length !== 1) {
        errors.push({ field: `sourcing.quotes.${index}.supplier`, message: "The recorded quotation is ambiguous. Review the current quotations before saving; your entries are preserved." })
        return entry
      }
      return { ...pick(matches[0], quoteRowMetadata), ...row }
    })
  }
  const lines = rows(object(previous.request.po).lines)
  const sources = lines.map((line, index) => ({ line, ref: orderRowReference(previous.id, index, line) }))
  return entries.map((entry, index) => {
    const row = object(entry)
    if (marked(row._new) || marked(row._remove) || !Object.hasOwn(row, "_rowRef")) return entry
    const reference = text(row._rowRef)
    const digest = /^\d+:[a-f0-9]{64}$/.test(reference) ? reference.slice(reference.indexOf(":") + 1) : ""
    const matches = sources.filter((source) => digest && source.ref.endsWith(`:${digest}`))
    if (!matches.length || existing.filter((line) => line._rowRef === reference).length !== 1) {
      errors.push({ field: `po.lines.${index}.desc`, message: "The recorded row details changed or are ambiguous. Review the current purchase order rows before saving; your entries are preserved." })
      return entry
    }
    // Equal digests represent equal omitted metadata, even after removal or a
    // reordered submission changes the original position. Explicit edits win.
    const source = matches.find((item) => item.ref === reference) ?? matches[0]!
    return { ...pick(source.line, poRowMetadata), ...row }
  })
}

function inputs(values: Record<string, unknown>, previous?: FormRowContext, errors: FormRowError[] = []): Record<string, unknown> | undefined {
  const result: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(values)) {
    const parts = key.split(".")
    if (parts.length > 7 || parts.some((part) => ["__proto__", "prototype", "constructor"].includes(part)))
      return undefined
    const name = parts.at(-1)!
    const numeric =
      [
        "estAmount",
        "estAnnual",
        "minQuotes",
        "techWeight",
        "commWeight",
        "uploadCap",
        "reminderDays",
        "escalationDays",
        "threshold",
        "rate",
        "weight",
        "tech",
        "comm",
        "total",
        "qty",
        "unitPrice",
      ].includes(name) ||
      parts.includes("scores") ||
      parts.includes("cscores")
    const boolean = [
      "recurring",
      "dueDiligence",
      "blockSelfApproval",
      "requireActiveSupplier",
      "techPass",
      "auto",
      "nda",
      "dpa",
      "_remove",
      "_new",
    ].includes(name)
    const normalized =
      name === "categories" && typeof raw === "string"
        ? raw
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
        : boolean
          ? raw === true || raw === "true" || raw === "on"
          : numeric && typeof raw === "string"
            ? raw === ""
              ? null
              : Number(raw)
            : raw
    const target = parts.slice(0, -1).reduce((parent, part) => {
      if (!Object.hasOwn(parent, part)) parent[part] = {}
      return object(parent[part])
    }, result)
    target[name] = normalized
  }
  const normalized = structuredInput(result, [], previous, errors) as Record<string, unknown>
  return errors.length ? undefined : normalized
}
function structuredInput(value: unknown, path: string[] = [], previous?: FormRowContext, errors: FormRowError[] = []): unknown {
  if (value === null || typeof value !== "object") return value
  const record = object(value)
  const keys = Object.keys(record)
  const entries = Array.isArray(value) ? value : keys.length && keys.every((key) => /^\d+$/.test(key)) ? keys.sort((a, b) => Number(a) - Number(b)).map((key) => record[key]) : undefined
  if (entries)
    return retainedFormRows(path, entries.map((entry, index) => structuredInput(entry, [...path, String(index)], previous, errors)), previous, errors)
      .filter((item) => {
        const row = object(item)
        if (row._remove === true || row._remove === "true" || row._remove === "on") return false
        if (
          (row._new === true || row._new === "true" || row._new === "on") &&
          !populatedFormValue(row)
        ) return false
        return true
      })
      .map((item) => Object.keys(object(item)).length ? Object.fromEntries(Object.entries(object(item)).filter(([key]) => !["_new", "_remove", "_rowRef"].includes(key))) : item)
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, structuredInput(item, [...path, key], previous, errors)]))
}

function populatedFormValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0
  if (typeof value === "number") return value !== 0
  if (Array.isArray(value)) return value.some(populatedFormValue)
  if (value !== null && typeof value === "object")
    return Object.entries(value).some(
      ([key, item]) => !["_new", "_remove", "_rowRef", "id", "qty", "techPass", "auto"].includes(key) && populatedFormValue(item),
    )
  return value != null && value !== false
}

function execute(snapshot: Snapshot, actor: Actor, command: Command, environment: Environment): Result {
  if (
    !text(actor.id).trim() ||
    !actor.canWrite ||
    actor.roles.length === 0 ||
    actor.roles.every((role) => role === "viewer")
  )
    return { ok: false, status: 403 }
  if (!pages.includes(command.page as (typeof pages)[number])) return { ok: false, status: 400 }
  const allowed =
    command.page === "Settings"
      ? ["save", "reset"]
      : command.page === "Suppliers"
        ? ["create", "save", "activate", "block", "inactivate", "delete", "change-bank"]
        : command.page === "Requests" || command.page === "My approvals"
          ? [
              "create",
              "save",
              "submit_pr",
              "submit_sourcing",
              "select_quote",
              "submit_po",
              "approve",
              "reject",
              "issue",
              "cancel",
              "delete",
            ]
          : []
  if (!allowed.includes(command.action)) return { ok: false, status: 400 }
  const submittedValues = command.values
  const values = inputs(submittedValues)
  if (!values) return { ok: false, status: 422, errors: ["Invalid form values"] }
  command = { ...command, values }
  const store = load(snapshot)
  if (command.page === "Settings") return settings(snapshot, store, actor, command, environment)
  if (command.page === "Suppliers") return supplier(snapshot, store, actor, command, environment)
  if (command.page !== "Requests" && command.page !== "My approvals") return { ok: false, status: 400 }
  if (
    ![
      "create",
      "save",
      "submit_pr",
      "submit_sourcing",
      "select_quote",
      "submit_po",
      "approve",
      "reject",
      "issue",
      "cancel",
      "delete",
    ].includes(command.action)
  )
    return { ok: false, status: 400 }
  const id = command.id ?? ""
  const row = store.requests[id]
  if (command.action !== "create" && !row) return { ok: false, status: 404 }
  const key = `requests:${id}`
  const visible = !row || visibleRequests([{ createdBy: text(row.request.createdBy) }], actor).length > 0
  if (!visible && ["approve", "reject"].includes(command.action)) return { ok: false, status: 403 }
  const stale = conflict(snapshot, key, command, visible ? row?.request : undefined)
  if (stale) return visible ? stale : { ok: false, status: 409 }
  const was = row ? structuredClone(row.request) : null
  const request = row?.request ?? {}
  const status = text(request.status)
  const prEdit = ["draft", "pr_rejected"].includes(status) && (request.createdBy === actor.id || has(actor, "admin"))
  const sourceEdit = ["sourcing", "src_rejected"].includes(status) && has(actor, "buyer", "admin")
  const poEdit = ["po_draft", "po_rejected"].includes(status) && has(actor, "buyer", "admin")
  if (command.action === "save" && !prEdit && !sourceEdit && !poEdit) return { ok: false, status: 403 }
  if (command.action === "create" && !has(actor, "requester", "admin")) return { ok: false, status: 403 }
  if (
    ["submit_sourcing", "select_quote", "submit_po", "issue"].includes(command.action) &&
    !has(actor, "buyer", "admin")
  )
    return { ok: false, status: 403 }
  if (sourceEdit && ["save", "submit_sourcing"].includes(command.action) || poEdit && ["save", "submit_po"].includes(command.action)) {
    // Retention errors follow the existing version and edit-permission gates,
    // so a stale form still receives the conflict review response.
    const fieldErrors: FormRowError[] = []
    const retained = inputs(submittedValues, { id, request, section: sourceEdit ? "sourcing" : "po" }, fieldErrors)
    if (!retained) return { ok: false, status: 422, errors: fieldErrors.map((error) => error.message), fieldErrors }
    command = { ...command, values: retained }
  }
  // PR editing follows Desenho §4.3; transition Quem is decided by porta §§4–5, including dual-role actors.
  if (row && prEdit && ["save", "submit_pr"].includes(command.action))
    request.pr = {
      ...object(request.pr),
      ...pick(command.values.pr ?? command.values, prFields),
    }
  if (row && sourceEdit && ["save", "submit_sourcing"].includes(command.action))
    request.sourcing = {
      ...object(request.sourcing),
      ...pick(command.values.sourcing ?? command.values, sourceFields),
    }
  if (row && sourceEdit && object(request.sourcing).weights != null)
    object(request.sourcing).weights = {
      tech: store.form.techWeight,
      comm: store.form.commWeight,
      criteria: store.form.criteria ?? [],
      commCriteria: store.form.commCriteria ?? [],
      ...object(object(request.sourcing).weights),
    }
  if (row && poEdit && ["save", "submit_po"].includes(command.action))
    request.po = {
      ...object(request.po),
      ...pick(command.values.po ?? command.values, poFields),
    }
  if (
    sourceEdit &&
    ["save", "submit_sourcing"].includes(command.action) &&
    !Array.isArray(object(request.sourcing).quotes)
  )
    return { ok: false, status: 422, errors: ["Quotes must be a list"] }
  if (poEdit && ["save", "submit_po"].includes(command.action) && !Array.isArray(object(request.po).lines))
    return { ok: false, status: 422, errors: ["PO lines must be a list"] }
  if (
    (sourceEdit && ["save", "submit_sourcing", "select_quote"].includes(command.action)) ||
    (poEdit && ["save", "submit_po"].includes(command.action))
  )
    request.buyerId = actor.id
  if (request.sourcing != null) {
    const source = object(request.sourcing)
    source.selectedId = source.selectedId == null || source.selectedId === "" ? null : String(source.selectedId)
    source.quotes = rows(source.quotes).map((quote) => ({
      ...quote,
      id: String(quote.id ?? ""),
      supplierId: quote.supplierId == null || quote.supplierId === "" ? null : String(quote.supplierId),
    }))
  }
  if (request.po != null) {
    const po = object(request.po)
    po.supplierId = po.supplierId == null || po.supplierId === "" ? null : String(po.supplierId)
  }
  const business = structuredClone(request)
  if (row) row.request = door(request)
  // Recover high-water marks from imported records as well as retained issued lists.
  store.issued.pr = [...new Set([...store.issued.pr, ...Object.keys(store.requests)])]
  store.issued.po = [
    ...new Set([
      ...store.issued.po,
      ...Object.values(store.requests)
        .map((item) => text(object(item.request.po).number))
        .filter(Boolean),
    ]),
  ]
  store.form = { ...store.form, ...store.settings }
  const fullSettings = store.settings
  store.settings = pick(fullSettings, ["currency", "levels", "prApprovalMode", "blockSelfApproval", "fxRates"])
  const gate = {
    id: actor.id,
    canWrite: actor.canWrite,
    roles: actor.roles.filter((role) => ["requester", "buyer", "approver", "admin"].includes(role)),
  }
  const version = row?.version ?? 0
  const submitted = {
    ...business,
    pr: business.pr,
    sourcing: business.sourcing,
    po: business.po,
  }
  const result =
    command.action === "create"
      ? createRequest(
          store,
          {
            type: "create",
            pr: {
              estAmount: null,
              recurring: false,
              expenseType: "",
              ...pick(command.values.pr ?? command.values, prFields),
            },
          },
          gate,
          environment.at,
        )
      : command.action === "save"
        ? { ok: true as const }
        : command.action === "submit_pr"
          ? submitPR(store, id, version, gate, environment.at, submitted)
          : command.action === "submit_sourcing"
            ? submitSourcing(store, id, version, gate, environment.at, submitted)
            : command.action === "submit_po"
              ? submitPO(store, id, version, gate, environment.at, submitted)
              : command.action === "select_quote"
                ? selectQuote(store, id, version, gate, environment.at, text(command.values.quoteId))
                : command.action === "approve"
                  ? approve(store, id, version, gate, environment.at, text(command.values.comment))
                  : command.action === "reject"
                    ? reject(store, id, version, gate, environment.at, text(command.values.reason))
                    : command.action === "issue"
                      ? issue(store, id, version, gate, environment.at)
                      : command.action === "cancel"
                        ? cancel(store, id, version, gate, environment.at, text(command.values.reason))
                        : deleteDraft(store, id, version, gate)
  if (!result.ok) {
    const errors = "errors" in result && Array.isArray(result.errors)
      ? result.errors.filter((error): error is string => typeof error === "string")
      : ["code" in result ? text(result.code) : "Action refused"]
    const fieldErrors = !("errors" in result) ? [] : command.action === "submit_pr"
      ? requisitionFieldErrors(submitted.pr as Parameters<typeof requisitionFieldErrors>[0])
      : command.action === "submit_sourcing" ? sourcingFieldErrors(submitted as Parameters<typeof sourcingFieldErrors>[0], store.form, store.suppliers)
      : command.action === "submit_po" ? purchaseOrderFieldErrors(submitted as Parameters<typeof purchaseOrderFieldErrors>[0], store.form, store.suppliers) : []
    const failure = { ok: false as const, status: "errors" in result ? 422 as const : 403 as const, errors, fieldErrors: fieldErrors.filter((error) => errors.includes(error.message)).map((error) => ({ field: error.field, message: error.message })) }
    return failure
  }
  store.settings = fullSettings
  const actualId = command.action === "create" && "request" in result ? text(object(result.request).number) : id
  const saved = store.requests[actualId]
  if (saved) {
    if (command.action === "create")
      saved.request.requesterName = environment.directory.find((person) => person.id === actor.id)?.name ?? actor.id
    saved.request =
      command.action === "save"
        ? {
            ...business,
            history: [...rows(business.history), { at: environment.at, by: actor.id, action: "Saved", note: "" }],
          }
        : restore(business, saved.request)
    if (command.action === "submit_pr") saved.request.prApprovalBaseCurrency = text(fullSettings.currency)
    if (command.action === "submit_sourcing") saved.request.sourcing = { ...object(saved.request.sourcing), approvalBaseCurrency: text(fullSettings.currency) }
    if (command.action === "submit_po") saved.request.po = { ...object(saved.request.po), approvalBaseCurrency: text(fullSettings.currency) }
    if (saved.request.po != null && ["select_quote", "submit_sourcing"].includes(command.action)) {
      const po = object(saved.request.po)
      saved.request.po = {
        ...po,
        deliveryAddress: text(po.deliveryAddress) || text(fullSettings.defaultDeliveryAddress),
        billingAddress: text(po.billingAddress) || text(fullSettings.billingAddress),
      }
    }
    saved.request.history = rows(saved.request.history).map((line) => redactBank(line))
    saved.version = (snapshot.versions[`requests:${actualId}`]?.version ?? 0) + 1
    saved.by = actor.id
  }
  snapshot.data.store = store
  changed(snapshot, `requests:${actualId}`, actor, environment.at, redactBank(was), redactBank(saved?.request ?? null))
  if (saved) {
    const step = pending(saved.request).step
    if (step && text(saved.request.status).endsWith("_pending"))
      queueNotice(snapshot, {
        kind: "pending",
        to: typeof step.holderId === "string" ? [step.holderId] : [],
        record: actualId,
        at: environment.at,
      })
    if (["approve", "reject"].includes(command.action))
      queueNotice(snapshot, {
        roles: ["buyer"],
        kind: command.action === "approve" ? "approved" : "rejected",
        to: [...new Set([text(saved.request.createdBy), text(saved.request.buyerId)].filter(Boolean))],
        record: actualId,
        at: environment.at,
      })
  }
  return {
    ok: true,
    value: visible ? (saved?.request ?? { deleted: was }) : undefined,
  }
}
function settings(snapshot: Snapshot, store: Store, actor: Actor, command: Command, environment: Environment): Result {
  if (!has(actor, "admin")) return { ok: false, status: 403 }
  if (!["save", "reset"].includes(command.action)) return { ok: false, status: 400 }
  const stale = conflict(snapshot, "settings", command, store.settings)
  if (stale) return stale
  const next: Record<string, unknown> =
    command.action === "reset"
      ? initial()
      : {
          ...store.settings,
          ...pick(command.values.settings ?? command.values, settingsFields),
        }
  for (const name of ["paymentTerms", "categories", "incoterms"]) {
    if (typeof next[name] === "string")
      next[name] = text(next[name])
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
  }
  const levels = rows(next.levels).map(
    (level): Record<string, unknown> => ({
      ...level,
      id: String(level.id ?? ""),
      holderId: level.holderId == null || level.holderId === "" ? null : String(level.holderId),
    }),
  )
  const fx = rows(next.fxRates)
  if (
    !Array.isArray(next.levels) ||
    !Array.isArray(next.fxRates) ||
    !text(next.currency) ||
    !levels.length ||
    levels.some(
      (level) =>
        !text(level.id) ||
        !text(level.name) ||
        typeof level.threshold !== "number" ||
        !Number.isFinite(level.threshold) ||
        (level.holderId !== null && typeof level.holderId !== "string"),
    ) ||
    !["first", "matrix"].includes(text(next.prApprovalMode)) ||
    typeof next.blockSelfApproval !== "boolean" ||
    fx.some((rate) => !text(rate.code) || !(finite(rate.rate) > 0)) ||
    new Set(fx.map((rate) => rate.code)).size !== fx.length
  )
    return { ok: false, status: 422, errors: ["Invalid matrix or currencies"] }
  if (next.uploadCap != null && !(finite(next.uploadCap) > 0))
    return { ok: false, status: 422, errors: ["Upload cap must be positive"] }
  if (
    rows(store.settings.commCriteria).some((item) => item.auto === true) &&
    !rows(next.commCriteria).some((item) => item.auto === true)
  )
    return {
      ok: false,
      status: 422,
      errors: ["Price criterion cannot be deleted"],
    }
  const was = store.settings
  store.settings = {
    ...next,
    levels: levels.map((level) => ({
      ...pick(level, ["id", "name", "threshold"]),
      holderId: text(level.holderId) || null,
    })),
  }
  store.form = { currency: text(next.currency), ...store.settings }
  snapshot.data.store = store
  changed(snapshot, "settings", actor, environment.at, was, store.settings)
  return { ok: true }
}
function supplier(snapshot: Snapshot, store: Store, actor: Actor, command: Command, environment: Environment): Result {
  if (!["create", "save", "activate", "block", "inactivate", "delete", "change-bank"].includes(command.action))
    return { ok: false, status: 400 }
  const bankAdmin = has(actor, "admin", "supplier admin")
  const buyer = has(actor, "buyer")
  if (!bankAdmin && !buyer) return { ok: false, status: 403 }
  if (["activate", "block", "inactivate", "change-bank"].includes(command.action) && !bankAdmin)
    return { ok: false, status: 403 }
  if (command.action === "create" && !buyer) return { ok: false, status: 403 }
  const id = command.action === "create" ? environment.id() : (command.id ?? "")
  const stored = store.suppliers.find((item) => item.id === id) as (BankSupplier & Record<string, unknown>) | undefined
  if (command.action !== "create" && !stored) return { ok: false, status: 404 }
  if (command.action === "create" && stored) return { ok: false, status: 409 }
  const stale = conflict(snapshot, `suppliers:${id}`, command, privateBank(stored))
  if (stale) return stale
  const incoming = object(command.values.supplier ?? command.values)
  const next = {
    ...(stored ?? { id, createdBy: actor.id, status: "pending" }),
    ...(["create", "save"].includes(command.action) ? pick(incoming, supplierFields) : {}),
  } as BankSupplier & Record<string, unknown>
  if (next.taxId && store.suppliers.some((item) => item.id !== id && object(item).taxId === next.taxId))
    return { ok: false, status: 422, errors: ["taxId must be unique"] }
  const editedBanks = ["create", "save", "change-bank"].includes(command.action)
    ? bankFields.filter((field) => Object.hasOwn(incoming, field))
    : []
  if (editedBanks.length && !bankAdmin) return { ok: false, status: 403 }
  if (
    editedBanks.some((field) => ["iban", "account"].includes(field)) &&
    (!environment.bankKey || environment.bankKey.length !== 32)
  )
    return {
      ok: false,
      status: 503,
      errors: ["Bank encryption key unavailable"],
    }
  const previousBank = bankValues(stored, environment.bankKey)
  if (!previousBank) return { ok: false, status: 503, errors: ["Bank details unavailable"] }
  const bankSecrets = [...previousBank, ...editedBanks.map((field) => text(incoming[field])).filter(Boolean)]
  next.history = Array.isArray(next.history)
    ? next.history.map((line) => object(redactBank(line, bankSecrets)) as { field: string })
    : []
  const changedBanks = editedBanks.filter((field) => {
    const current = text(next[field])
    const clear = ["iban", "account"].includes(field) && current ? open(current, environment.bankKey!) : current
    return clear !== text(incoming[field])
  })
  changedBanks.forEach((field) => {
    next[field] = ["iban", "account"].includes(field)
      ? seal(text(incoming[field]), environment.bankKey!)
      : text(incoming[field])
  })
  if (changedBanks.length) {
    next.history = [...(next.history ?? []), ...changedBanks.map((field) => ({ field }))]
    if (next.status === "active") {
      next.status = "pending"
      next.validatedAt = null
      next.validatedBy = null
    }
  }
  if (command.action === "activate") {
    const activated = activateSupplier(next, actor, store.suppliers, store.settings.blockSelfApproval === true)
    if (!activated.ok) {
      const missing = supplierActivationRequirements(next)
      return {
        ok: false,
        status: 422,
        errors: missing.length ? missing.map((field) => `Recorded activation prerequisite missing: ${supplierRequirementLabel(field)}`) : ["Supplier activation refused"],
      }
    }
    Object.assign(next, activated.supplier, {
      validatedBy: actor.id,
      validatedAt: environment.at,
    })
  }
  if (command.action === "block") next.status = "blocked"
  if (command.action === "inactivate") next.status = "inactive"
  if (command.action === "delete") {
    if (
      next.status !== "pending" ||
      Object.values(store.requests).some(
        (row) =>
          String(object(row.request.po).supplierId ?? "") === id ||
          rows(object(row.request.sourcing).quotes).some((quote) => String(quote.supplierId ?? "") === id),
      )
    )
      return { ok: false, status: 403 }
  }
  if (command.action === "create") {
    const allocated = nextSup([...store.sup, ...store.suppliers.map((item) => text(object(item).number))])
    store.sup.push(allocated)
    next.number = allocated
  }
  store.suppliers = [
    ...store.suppliers.filter((item) => item.id !== id),
    ...(command.action === "delete" ? [] : [next]),
  ]
  snapshot.data.store = store
  // Audit the changed bank field names, never account plaintext or ciphertext.
  changed(
    snapshot,
    `suppliers:${id}`,
    actor,
    environment.at,
    stored ? redactBank(stored, bankSecrets) : null,
    command.action === "delete"
      ? null
      : {
          ...object(redactBank(next, bankSecrets)),
          bankFieldsChanged: changedBanks,
        },
  )
  if (stored?.status === "active" && next.status === "pending")
    queueNotice(snapshot, {
      roles: ["supplier admin"],
      kind: "supplier-pending",
      to: [],
      record: id,
      at: environment.at,
    })
  return {
    ok: true,
    value: command.action === "delete" ? { deleted: privateBank(stored) } : privateBank(next),
    warnings: store.suppliers.some((item) => item.id !== id && item.legalName === next.legalName)
      ? ["Duplicate legalName recognized"]
      : [],
  }
}
export const domain: Domain = {
  execute,
  view(snapshot, actor, environment) {
    const store = load(snapshot)
    const restricted =
      actor.roles.includes("requester") && !has(actor, "buyer", "approver", "supplier admin", "admin", "viewer")
    const requests = visibleRequests(
      Object.values(store.requests).map((row): RequestView & Record<string, unknown> => ({
        ...structuredClone(row.request),
        status: text(row.request.status),
        createdBy: text(row.request.createdBy),
        value: requestValue(row.request as RequestView, {
          currency: text(store.settings.currency),
          fxRates: rows(store.settings.fxRates).map((rate) => ({
            code: text(rate.code),
            rate: finite(rate.rate),
          })),
        }),
        ...(row.rank ? { ranking: structuredClone(row.rank) } : {}),
      })),
      actor,
    )
    const suppliers = store.suppliers.map((item) => {
      const supplier = object(item)
      if (!has(actor, "admin", "supplier admin"))
        return {
          ...Object.fromEntries(Object.entries(supplier).filter(([key]) => !bankFields.some((field) => field.toLowerCase() === key.toLowerCase()))),
          history: redactBank(supplier.history),
          iban: "masked",
          account: "masked",
        }
      const safe = { ...supplier, history: redactBank(supplier.history) }
      if (!environment.bankKey) return { ...safe, iban: "", account: "" }
      return {
        ...safe,
        iban: supplier.iban ? open(text(supplier.iban), environment.bankKey) : "",
        account: supplier.account ? open(text(supplier.account), environment.bankKey) : "",
      }
    })
    const register = exportRegister(
      requests.map(
        (request) =>
          Object.fromEntries(Object.entries(request).filter(([key]) => key !== "ranking")) as unknown as RequestView,
      ),
    )
    const versions = Object.fromEntries(
      Object.entries(snapshot.versions).filter(
        ([key]) =>
          !restricted ||
          !key.startsWith("requests:") ||
          requests.some((request) => key === `requests:${request.number}`),
      ),
    )
    return {
      data: {
        requests,
        suppliers,
        register,
        directory: environment.directory,
        formSettings: pick(store.settings, [
          "currency",
          "fxRates",
          "minQuotes",
          "techWeight",
          "commWeight",
          "criteria",
          "commCriteria",
          "requireActiveSupplier",
          "blockSelfApproval",
          "paymentTerms",
          "categories",
          "incoterms",
        ]),
        settings: has(actor, "admin") ? store.settings : {},
        uploadCap: store.settings.uploadCap ?? null,
        bankVerificationAvailable: has(actor, "admin", "supplier admin") && environment.bankKey?.length === 32,
      },
      versions,
    }
  },
}
function amount(request: Record<string, unknown>) {
  return typeof request.value === "number" && Number.isFinite(request.value)
    ? request.value
    : null
}
function requestStatusLabel(status: string) {
  return ({ draft: "Requisition draft", pr_pending: "Requisition approval", pr_rejected: "Requisition rejected", sourcing: "Sourcing", src_pending: "Sourcing approval", src_rejected: "Sourcing rejected", po_draft: "Purchase order draft", po_pending: "Purchase order approval", po_rejected: "Purchase order rejected", po_approved: "Purchase order approved", po_issued: "Issued internally", cancelled: "Cancelled" } as Record<string, string>)[status] ?? status
}
function queueRequestLink(row: ProcurementQueueRow, href: string) {
  return `<a href="${esc(href)}" data-source-ref="${esc(row.evidence.refId)}" data-source-digest="${esc(row.evidence.refDigest)}" data-source-version="${row.version}">${esc(row.id)}</a>`
}
function selectField(name: string, label: string, value: unknown, options: { value: string; label: string }[]) {
  return `<label>${esc(label)}<select name="${esc(name)}">${options.map((option) => `<option value="${esc(option.value)}"${String(value ?? "") === option.value ? " selected" : ""}>${esc(option.label)}</option>`).join("")}</select></label>`
}
const labels: Record<string, string> = {
  legalName: "Legal name",
  taxId: "Tax ID",
  regNo: "Registration number",
  contactEmail: "Contact email",
  paymentTerms: "Payment terms",
  riskRating: "Risk rating",
  dueDiligence: "Due diligence complete",
  sanctionsDate: "Sanctions screening date",
  bankName: "Bank name",
  iban: "IBAN",
  swift: "SWIFT",
  account: "Account",
  estAmount: "Estimated amount",
  estAnnual: "Estimated annual value",
  costCenter: "Cost centre",
  needBy: "Needed by",
  expenseType: "Expense type",
  contractRef: "Contract reference",
  assetRef: "Asset reference",
  unitPrice: "Unit price",
  qty: "Quantity",
  techPass: "Technically compliant",
  fewQuotesJustification: "Fewer quotations justification",
  selectionJustification: "Selection justification",
  contractStrategy: "Contract strategy",
  evaluator: "Technical evaluator",
  deliveryDate: "Delivery date",
  deliveryConditions: "Delivery conditions",
  prApprovalMode: "PR approval mode",
  minQuotes: "Minimum quotations",
  techWeight: "Technical weight",
  commWeight: "Commercial weight",
  requireActiveSupplier: "Require active supplier",
  blockSelfApproval: "Block self approval",
  holderId: "Approval holder",
  uploadCap: "Attachment limit (bytes)",
  reminderDays: "Reminder after days",
  escalationDays: "Escalation after days",
  auto: "Automatic price criterion",
}
function supplierRequirementLabel(field: string) {
  return field.split(" or ").map((part) => labels[part] ?? part.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase())).join(" or ")
}
function scalarFields(prefix: string, record: Record<string, unknown>, names: string[]) {
  return names
    .map((name) => {
      const key = prefix ? `${prefix}.${name}` : name
      const label =
        labels[name] ??
        (name === "desc"
          ? "Description"
          : name === "uom"
            ? "Unit"
            : name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase()))
      const options: Record<string, string[]> = {
        expenseType: ["", "OPEX", "CAPEX"],
        type: ["", "product", "service"],
        prApprovalMode: ["first", "matrix"],
        contractStrategy: ["", "new", "existing"],
        riskRating: ["", "Low", "Medium", "High"],
      }
      if (options[name]) {
        const recorded = text(record[name])
        return selectField(
          key,
          label,
          record[name],
          [
            ...options[name]!.map((value) => ({ value, label: value || "Choose…" })),
            ...(recorded && !options[name]!.includes(recorded) ? [{ value: recorded, label: `Recorded value: ${recorded}` }] : []),
          ],
        )
      }
      const boolean = [
        "recurring",
        "dueDiligence",
        "techPass",
        "auto",
        "requireActiveSupplier",
        "blockSelfApproval",
        "nda",
        "dpa",
      ].includes(name)
      const numeric = [
        "estAmount",
        "estAnnual",
        "minQuotes",
        "techWeight",
        "commWeight",
        "threshold",
        "rate",
        "weight",
        "tech",
        "comm",
        "total",
        "qty",
        "unitPrice",
        "uploadCap",
        "reminderDays",
        "escalationDays",
      ].includes(name)
      return (
        (boolean ? `<input type="hidden" name="${esc(key)}" value="false">` : "") +
        fields([
          {
            name: key,
            label,
            value: record[name],
            type: boolean
              ? "checkbox"
              : numeric
                ? "number"
                : [
                      "description",
                      "justification",
                      "notes",
                      "fewQuotesJustification",
                      "selectionJustification",
                      "deliveryConditions",
                    ].includes(name)
                  ? "textarea"
                  : ["needBy", "deliveryDate", "sanctionsDate", "fxUpdated"].includes(name)
                    ? "date"
                    : name === "contactEmail"
                      ? "email"
                      : "text",
            step: numeric ? "any" : undefined,
          },
        ])
      )
    })
    .join("")
}
function repeatRows(
  prefix: string,
  items: Record<string, unknown>[],
  names: string[],
  extra?: (row: Record<string, unknown>, prefix: string, index: number) => string,
) {
  return [...items, prefix === "sourcing.quotes" ? { qty: 1, unitPrice: 0, total: 0, techPass: true } : {}]
    .map(
      (row, index) =>
        `<fieldset class="form-section"><legend>${index === items.length ? "Add row" : `Row ${index + 1}`}</legend>${index === items.length ? `<input type="hidden" name="${esc(prefix)}.${index}._new" value="true">` : fields([{ name: `${prefix}.${index}._remove`, label: "Remove row", type: "checkbox" }])}${names.includes("id") ? `<input type="hidden" name="${esc(prefix)}.${index}.id" value="${esc(String(row.id ?? `${prefix}-${index + 1}`))}">` : ""}${scalarFields(
          `${prefix}.${index}`,
          row,
          names.filter((name) => name !== "id"),
        )}${extra?.(row, `${prefix}.${index}`, index) ?? ""}</fieldset>`,
    )
    .join("")
}
export function render(page: string, data: Record<string, unknown>, context: RenderContext): string | undefined {
  if (!pages.includes(page as (typeof pages)[number])) return undefined
  const requests = rows(data.requests)
  const queueView = readProcurementQueueView(data.procurementQueueView)
  if (["Requests", "My approvals"].includes(page) && Object.hasOwn(data, "procurementQueueView") &&
    (!queueView || queueView.rows.length !== requests.length || requests.some((request) => !queueView.rows.some((row) => row.id === request.number))))
    return '<p role="alert">The current procurement queue is unavailable. Reload the page to review current records.</p>'
  const suppliers = rows(data.suppliers)
  const directory = rows(data.directory)
  const settings = { ...object(data.formSettings), ...object(data.settings) }
  const disabled = !context.actor.canWrite
  const version = (key: string) => context.versions[key]?.version ?? 0
  const controls = (page: string, action: string, id: string, body: string, label = action) =>
    form(
      page,
      action,
      id,
      version(page === "Settings" ? "settings" : `${page === "Suppliers" ? "suppliers" : "requests"}:${id}`),
      body,
      label,
      disabled,
    )
  const supplierOptions = [
    { value: "", label: "Supplier not registered" },
    ...suppliers
      .filter((supplier) => supplier.status !== "inactive")
      .map((supplier) => ({
        value: String(supplier.id ?? ""),
        label: text(supplier.legalName),
      })),
  ]
  if (page === "Dashboard") {
    return (
      metricGrid([
        metric(
          "Open requests",
          String(requests.filter((request) => !["po_issued", "cancelled"].includes(text(request.status))).length),
        ),
        ...["po_approved", "po_issued"].flatMap((status) => ["OPEX", "CAPEX"].map((type) =>
          metric(
            `${status === "po_issued" ? "Issued internally" : "Approved"} ${type}`,
            (() => {
              const matching = requests.filter((request) => request.status === status && object(request.po).expenseType === type)
              const missing = matching.filter((request) => amount(request) == null).length
              const known = matching.filter((request) => amount(request) != null).length
              const total = matching.reduce((sum, request) => sum + (amount(request) ?? 0), 0)
              return `${!matching.length ? "No matching purchase orders" : !known || !Number.isFinite(total) ? "Unavailable" : `${missing ? "Known subtotal " : ""}${total} ${text(object(data.formSettings).currency)}`}${missing ? `; ${missing} unavailable` : ""}`
            })(),
          ),
        )),
      ], 3) +
      table(
        ["Request", "Status", "Amount"],
        requests.map((request) => [
          esc(String(request.number ?? "")),
          esc(requestStatusLabel(text(request.status))),
          amount(request) == null ? "Unavailable" : `${amount(request)} ${esc(text(settings.currency))}`,
        ]),
      ) +
      '<a href="?download=register">Download request register</a>'
    )
  }
  if (page === "Settings") {
    if (!has(context.actor, "admin"))
      return "<p>You do not have permission to manage settings.</p>" + table(["Settings"], [])
    return (
      controls(
        page,
        "save",
        "",
        '<fieldset class="form-section"><legend>General policy</legend>' +
          scalarFields("", settings, [
            "currency",
            "prApprovalMode",
            "minQuotes",
            "techWeight",
            "commWeight",
            "blockSelfApproval",
            "requireActiveSupplier",
          ]) +
          '</fieldset><fieldset class="form-section"><legend>Attachments &amp; reminders</legend>' +
          scalarFields("", settings, [
            "uploadCap",
            "reminderDays",
            "escalationDays",
          ]) +
          '</fieldset><fieldset class="form-section"><legend>Approval matrix</legend>' +
          repeatRows("levels", rows(settings.levels), ["id", "name", "threshold"], (row, prefix) =>
            selectField(`${prefix}.holderId`, "Approval holder", row.holderId, [
              { value: "", label: "Unassigned" },
              ...directory.map((person) => ({
                value: String(person.id ?? ""),
                label: text(person.name),
              })),
            ]),
          ) +
          '</fieldset><fieldset class="form-section"><legend>Currencies</legend>' +
          repeatRows("fxRates", rows(settings.fxRates), ["code", "rate"]) +
          fields([{ name: "fxUpdated", label: "Rates last updated", type: "date", value: settings.fxUpdated }]) +
          '</fieldset><fieldset class="form-section"><legend>Technical criteria</legend>' +
          repeatRows("criteria", rows(settings.criteria), ["name", "weight"]) +
          '</fieldset><fieldset class="form-section"><legend>Commercial criteria</legend>' +
          repeatRows("commCriteria", rows(settings.commCriteria), ["name", "weight", "auto"]) +
          '</fieldset><fieldset class="form-section"><legend>Payment terms, categories &amp; incoterms</legend>' +
          ["paymentTerms", "categories", "incoterms"]
            .map((name) =>
              fields([
                {
                  name,
                  label: labels[name] ?? name,
                  type: "textarea",
                  value: Array.isArray(settings[name]) ? settings[name].join("\n") : settings[name],
                },
              ]),
            )
            .join("") +
          fields([
            { name: "billingAddress", label: "Default invoice-to address", type: "textarea", value: settings.billingAddress },
            { name: "defaultDeliveryAddress", label: "Default delivery address", type: "textarea", value: settings.defaultDeliveryAddress },
          ]) +
          "</fieldset>",
        "Save settings",
      ) +
      '<details class="editor-panel"><summary>Reset settings</summary>' +
      controls(page, "reset", "", "<p>Restore the baseline configuration. Requests, suppliers, issued identifiers and submitted approval/FX snapshots remain preserved.</p>", "Reset settings") +
      "</details>"
    )
  }
  if (page === "My approvals") {
    if (queueView) {
      const grouped = procurementApprovalGroups(queueView, context.actor.id)
      return '<p>Order: oldest proven entry into the current approval step first; unavailable dates last; request ID breaks ties.</p>' + ["you", "others", "unassigned"].map((group) =>
        `<h2>${group === "you" ? "Waiting for you" : group === "others" ? "Waiting for others" : "Unassigned"}</h2>` +
        table(["Request", "Subject", "Decision", "Amount", "Reason", "Holder", "Waiting since", "Next step"],
          (group === "you" ? grouped.waitingForYou : group === "others" ? grouped.waitingForOthers : grouped.unassigned).map((row) => {
            const request = requests.find((request) => request.number === row.id)!
            const decision = approvalDecision(request as RequestView, context.actor, settings.blockSelfApproval === true)
            const holderName = text(directory.find((person) => String(person.id ?? "") === row.holder)?.name)
            return [
              queueRequestLink(row, `?page=Requests&filter=All&request=${encodeURIComponent(row.id)}#${encodeURIComponent(row.id)}`),
              esc(row.subject ?? "Unavailable"),
              esc(`${row.status === "pr_pending" ? "Requisition" : row.status === "src_pending" ? "Sourcing selection" : row.status === "po_pending" ? "Purchase order" : "Unrecognized approval stage"}${row.approvalStage ? ` · ${row.approvalStage}` : ""}`),
              row.submittedAmount !== null ? `${row.submittedAmount} ${row.submittedCurrency ? esc(row.submittedCurrency) : "(submitted base currency unavailable)"}` : "Unavailable",
              esc(row.reason ?? "Unavailable"),
              esc(holderName || (row.holder ? `Responsible person not resolved (${row.holder})` : "Unassigned")),
              row.stageEnteredAt && row.ageDays !== null ? `${esc(row.stageEnteredAt)} · ${Number(row.ageDays.toFixed(2))} days` : "Unavailable",
              `${esc(row.nextStep ?? "Unavailable")}${decision.allowed ? " · Review approval" : ` · ${esc(decision.reason)}`}`,
            ]
          })),
      ).join("")
    }
    const grouped = approvalQueue(requests as RequestView[], context.actor.id)
    return '<p>Order: oldest proven entry into the current approval step first; unavailable dates last; request ID breaks ties.</p>' + ["you", "others", "unassigned"]
      .map(
        (group) =>
          `<h2>${group === "you" ? "Waiting for you" : group === "others" ? "Waiting for others" : "Unassigned"}</h2>` +
          table(
            ["Request", "Subject", "Decision", "Amount", "Reason", "Holder", "Waiting since", "Next step"],
            (group === "you" ? grouped.waitingForYou : group === "others" ? grouped.waitingForOthers : grouped.unassigned)
              .map((request) => {
                const approval = object(request.status === "pr_pending" ? request.prApproval : request.status === "src_pending" ? request.sourcing?.approval : request.status === "po_pending" ? request.po?.approval : undefined)
                const holder = text(rows(approval.steps).find((step) => step.status === "pending")?.holderId)
                const baseCurrency = request.status === "pr_pending" ? text(request.prApprovalBaseCurrency) : request.status === "src_pending" ? text(object(request.sourcing).approvalBaseCurrency) : request.status === "po_pending" ? text(object(request.po).approvalBaseCurrency) : ""
                const enteredAt = approvalStageEntry(request)
                const decision = approvalDecision(request, context.actor, settings.blockSelfApproval === true)
                const holderName = text(directory.find((person) => String(person.id ?? "") === holder)?.name)
                return [
                  `<a href="?page=Requests&amp;filter=All#${encodeURIComponent(String(request.number ?? ""))}">${esc(String(request.number ?? ""))}</a>`,
                  esc(text(object(request.pr).title) || "Unavailable"),
                  request.status === "pr_pending" ? "Requisition" : request.status === "src_pending" ? "Sourcing selection" : request.status === "po_pending" ? "Purchase order" : "Unrecognized approval stage",
                  typeof approval.amount === "number" && Number.isFinite(approval.amount) ? `${approval.amount} ${baseCurrency ? esc(baseCurrency) : "(submitted base currency unavailable)"}` : "Unavailable",
                  esc(request.status === "pr_pending" ? text(object(request.pr).justification) || "Unavailable" : request.status === "src_pending" ? text(object(request.sourcing).selectionJustification) || (rows(object(request.sourcing).quotes).length ? "See proposal comparison" : "Unavailable") : request.status === "po_pending" ? text(object(request.po).description) || "Unavailable" : "Unavailable"),
                  esc(holderName || (holder ? `Responsible person not resolved (${holder})` : "Unassigned")),
                  enteredAt && Number.isFinite(Date.parse(context.at)) && Date.parse(enteredAt) <= Date.parse(context.at) ? esc(enteredAt) : "Unavailable",
                  decision.allowed ? "Review approval" : esc(decision.reason),
                ]
              }),
          ),
      )
      .join("")
  }
  if (page === "Suppliers") {
    const filter = text(data.status) || "All"
    const query = text(data.q ?? data.search).toLowerCase()
    const requestedSupplier = suppliers.find((supplier) => String(supplier.id ?? "") === text(data.supplier))
    const visible = suppliers.filter(
      (supplier) =>
        supplier === requestedSupplier ||
        ((filter === "All" || supplier.status === filter) &&
          [supplier.legalName, supplier.number, supplier.taxId].some((value) =>
            String(value ?? "")
              .toLowerCase()
              .includes(query),
          )),
    )
    const general = supplierFields.filter(
      (name) => !["categories", "contacts", "commercial", "compliance"].includes(name),
    )
    return (
      `<form method="get" class="filter-bar"><input type="hidden" name="page" value="Suppliers">${selectField(
        "status",
        "Status",
        filter,
        ["All", "pending", "active", "blocked", "inactive"].map((value) => ({
          value,
          label: value,
        })),
      )}${fields([{ name: "q", label: "Search", value: query }])}<button>Filter</button></form><a href="?download=suppliers">Download suppliers CSV</a>` +
      (has(context.actor, "buyer") ? controls(page, "create", "", "<h2>New supplier</h2>" + scalarFields("", {}, general), "Create supplier") : "") +
      table(
        ["Number", "Supplier", "Status"],
        visible.map((supplier) => [
          esc(String(supplier.number ?? "")),
          `<a href="#supplier-${encodeURIComponent(String(supplier.id ?? ""))}">${esc(text(supplier.legalName))}</a>`,
          esc(text(supplier.status)),
        ]),
      ) +
      visible
        .map((supplier) => {
          const id = String(supplier.id ?? "")
          const privileged = has(context.actor, "admin", "supplier admin")
          const canMaintain = privileged || has(context.actor, "buyer")
          const linked = requests.some((request) => String(object(request.po).supplierId ?? "") === id || rows(object(request.sourcing).quotes).some((quote) => String(quote.supplierId ?? "") === id))
          const bankUnavailable = data.bankVerificationAvailable !== true && !text(supplier.bankName)
          const requirements = supplierActivationRequirements(supplier as BankSupplier).filter((item) => item !== "iban or bankName" || !bankUnavailable)
          const bankRevalidation = supplier.status === "pending" && supplier.validatedAt === null && supplier.validatedBy === null && rows(supplier.history).some((line) => bankFields.includes(text(line.field) as typeof bankFields[number]))
            ? '<p role="status">Bank details changed after activation. Supplier validation was cleared; an authorized supplier administrator must review and reactivate the supplier.</p>' : ""
          const readiness = privileged
            ? `<section><h3>Activation prerequisites</h3><p>This checklist reports recorded prerequisites only; eligibility also depends on authorization and supplier policies. A recorded sanctions screening date does not verify external screening.</p>${bankUnavailable ? "<p>Bank verification is unavailable; the masked or empty bank view cannot establish whether IBAN is recorded.</p>" : ""}${requirements.length ? `<p>Complete these recorded prerequisites before activation: ${requirements.map((item) => `<span>${esc(supplierRequirementLabel(item))}</span>`).join(", ")}</p>` : "<p>No missing prerequisites are visible in this view. Policy eligibility has not been evaluated.</p>"}</section>`
            : ""
          return `<details id="supplier-${esc(id)}"${supplier === requestedSupplier ? " open" : ""}><summary>${esc(text(supplier.legalName))}</summary><nav>General · Categories · Contacts · Commercial · Bank · Compliance · Linked requests · Audit</nav>${canMaintain ? controls(page, "save", id, "<h3>Update supplier</h3>" + scalarFields("", supplier, general) + fields([{ name: "categories", label: "Categories (one per line)", type: "textarea", value: Array.isArray(supplier.categories) ? supplier.categories.join("\n") : supplier.categories }]) + repeatRows("contacts", rows(supplier.contacts), ["name", "email", "phone"]) + scalarFields("commercial", object(supplier.commercial), ["notes"]) + scalarFields("compliance", object(supplier.compliance), ["notes"]), "Save supplier") : table(["Supplier field", "Recorded value"], general.map((field) => [esc(labels[field] ?? field), supplier[field] == null ? "Unavailable" : esc(String(supplier[field]))])) + table(["Category"], (Array.isArray(supplier.categories) ? supplier.categories : []).map((category) => [esc(String(category))])) + table(["Contact", "Email", "Phone"], rows(supplier.contacts).map((contact) => [esc(text(contact.name)), esc(text(contact.email)), esc(text(contact.phone))])) + table(["Commercial notes", "Compliance notes"], [[esc(text(object(supplier.commercial).notes)), esc(text(object(supplier.compliance).notes))]])}<section><h3>Bank</h3>${privileged ? controls(page, "change-bank", id, scalarFields("", supplier, [...bankFields]), "Save bank details") : "<p>Bank details masked.</p>"}</section>${bankRevalidation}${readiness}${[...(privileged ? ["activate", "block", "inactivate"] : []), ...(canMaintain && supplier.status === "pending" && !linked ? ["delete"] : [])].map((action) => controls(page, action, id, "", action.charAt(0).toUpperCase() + action.slice(1))).join("")}<h3>Linked requests</h3>${table(
            ["Request"],
            requests
              .filter(
                (request) =>
                  String(object(request.po).supplierId ?? "") === id ||
                  rows(object(request.sourcing).quotes).some((quote) => String(quote.supplierId ?? "") === id),
              )
              .map((request) => [esc(String(request.number ?? ""))]),
          )}<h3>Audit</h3>${table(
            ["Field"],
            rows(supplier.history).map((line) => [esc(text(line.field))]),
          )}</details>`
        })
        .join("")
    )
  }
  const requestedRequest = requests.find((request) => String(request.number ?? "") === text(data.request))
  const filter = requestedRequest ? "All" : text(data.filter) || "Open"
  const query = text(data.q ?? data.search).toLowerCase()
  const filtered = requests.filter((request) => {
    const status = text(request.status)
    const matches =
      filter === "All" ||
      (filter === "Open" && !["po_issued", "cancelled"].includes(status)) ||
      (filter === "Closed" && ["po_issued", "cancelled"].includes(status)) ||
      (filter === "Awaiting approval" && status.endsWith("_pending")) ||
      (filter === "Requisition" && ["draft", "pr_pending", "pr_rejected"].includes(status)) ||
      (filter === "Sourcing" && ["sourcing", "src_pending", "src_rejected"].includes(status)) ||
      (filter === "Purchase order" && status.startsWith("po_"))
    return (
      requestedRequest === request ||
      (matches &&
        [
          request.number,
          ...Object.values(pick(request.pr, ["title", "description", "costCenter"])),
          object(request.po).number,
          object(request.po).supplier,
          request.requesterName,
          request.createdBy,
          request.buyerId,
          requestStageGuidance(status).stage,
          ...(status.endsWith("_pending") ? [pending(request).step?.holderId] : []),
          ...directory.filter((person) => [request.createdBy, request.buyerId, ...(status.endsWith("_pending") ? [pending(request).step?.holderId] : [])].includes(person.id)).map((person) => person.name),
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(query),
        ))
    )
  })
  return (
    `<form method="get" class="filter-bar"><input type="hidden" name="page" value="Requests">${selectField(
      "filter",
      "Filter",
      filter,
      ["Open", "Awaiting approval", "Requisition", "Sourcing", "Purchase order", "Closed", "All"].map((value) => ({
        value,
        label: value,
      })),
    )}${fields([{ name: "q", label: "Search request, requester, buyer, stage or current holder", value: query }])}<button>Filter</button></form><a href="?download=register">Download request register</a>` +
    (has(context.actor, "requester", "admin") ? controls(
      page,
      "create",
      "",
      '<h2>New request</h2><fieldset class="form-section"><legend>Request details</legend>' +
        scalarFields(
          "pr",
          {},
          prFields.filter((name) => !["requesterName", "estAmount", "estAnnual", "expenseType"].includes(name)),
        ) +
        '</fieldset><fieldset class="form-section"><legend>Financial details</legend>' +
        scalarFields("pr", {}, prFields.filter((name) => ["estAmount", "estAnnual", "expenseType"].includes(name))) +
        "</fieldset>",
      "Create request",
    ) : "") +
    table(
      ["Request", "Title", "Status", "Stage", "Next action", "Responsibility", "Value basis", "Base amount"],
      filtered.map((request) => {
        const projected = queueView?.rows.find((row) => row.id === request.number)
        const status = projected ? projected.status ?? "" : text(request.status)
        const holder = projected ? projected.holder : text(pending(request).step?.holderId)
        return [
          projected ? queueRequestLink(projected, `?page=Requests&request=${encodeURIComponent(projected.id)}&q=${encodeURIComponent(projected.id)}#${encodeURIComponent(projected.id)}`) : `<a href="#${encodeURIComponent(String(request.number ?? ""))}">${esc(String(request.number ?? ""))}</a>`,
          esc(projected ? projected.subject ?? "Unavailable" : text(object(request.pr).title)),
          esc(projected && !projected.status ? "Unknown status" : requestStatusLabel(status)),
          esc(requestStageGuidance(status).stage),
          esc(projected ? projected.nextStep ?? "Unavailable" : requestStageGuidance(status).next),
          esc(`Requester: ${text(request.requesterName) || text(directory.find((person) => person.id === request.createdBy)?.name) || text(request.createdBy) || "Unavailable"}; buyer: ${text(directory.find((person) => person.id === request.buyerId)?.name) || text(request.buyerId) || "Unassigned"}; current holder: ${status.endsWith("_pending") ? text(directory.find((person) => person.id === holder)?.name) || holder || "Unassigned" : "Not awaiting approval"}`),
          projected ? esc(projected.monetaryState?.replaceAll("-", " ") ?? "Unavailable") : rows(object(request.po).lines).length ? "Purchase order lines" : rows(object(request.sourcing).quotes).some((quote) => quote.id === object(request.sourcing).selectedId) ? "Selected sourcing proposal" : "Requisition estimate",
          projected ? projected.baseAmount === null ? "Unavailable" : `${projected.baseAmount} ${esc(projected.baseCurrency)}` : amount(request) == null ? "Unavailable" : `${amount(request)} ${esc(text(settings.currency))}`,
        ]
      }),
    ) +
    filtered
      .map((request) => {
        const id = String(request.number ?? "")
        const source = object(request.sourcing)
        const po = object(request.po)
        const status = text(request.status)
        const decision = approvalDecision(request as RequestView, context.actor, settings.blockSelfApproval === true)
        const canDecide = decision.allowed
        const prEditable = context.actor.canWrite && ["draft", "pr_rejected"].includes(status) && (request.createdBy === context.actor.id || has(context.actor, "admin"))
        const sourcingEditable = context.actor.canWrite && ["sourcing", "src_rejected"].includes(status) && has(context.actor, "buyer", "admin")
        const poEditable = context.actor.canWrite && ["po_draft", "po_rejected"].includes(status) && has(context.actor, "buyer", "admin")
        const canCancel = context.actor.canWrite && !["cancelled", "po_issued"].includes(status) && (request.createdBy === context.actor.id || has(context.actor, "admin"))
        const actions = [
          ...(canDecide ? ["approve", "reject"] : []),
          ...(canCancel ? ["cancel"] : []),
          ...(context.actor.canWrite && status === "po_approved" && has(context.actor, "buyer", "admin") ? ["issue"] : []),
          ...(context.actor.canWrite && status === "draft" && (request.createdBy === context.actor.id || has(context.actor, "admin")) ? ["delete"] : []),
        ]
        const decisionHint = status.endsWith("_pending") && !canDecide ? `<p>Decision unavailable: ${esc(decision.reason)}.</p>` : ""
        const snapshotRequired = ["src_pending", "po_draft", "po_pending", "po_approved", "po_issued", "po_rejected"].includes(status)
        const sameBase = !snapshotRequired || source.approvalBaseCurrency === settings.currency
        const evaluation = quoteAssessment({ sourcing: { ...source, ...(snapshotRequired && source.fxSnapshot == null ? { fxSnapshot: { [text(settings.currency)]: 1 } } : {}) } as Parameters<typeof quoteAssessment>[0]["sourcing"] }, { ...settings, currency: text(settings.currency) } as FormSettings)
        const presentation = quoteComparisonPresentation({ sourcing: source as Parameters<typeof quoteComparisonPresentation>[0]["sourcing"] }, { ...settings, currency: text(settings.currency) } as FormSettings, { submitted: snapshotRequired, submittedBaseCurrency: text(source.approvalBaseCurrency) })
        const statedTotalsDiffer = rows(source.quotes).some((quote) => {
          const calculated = typeof quote.qty === "number" && typeof quote.unitPrice === "number" ? quote.qty * quote.unitPrice : null
          const stated = typeof quote.total === "number" ? quote.total : null
          return calculated != null && (!Number.isFinite(calculated) || stated != null && Number.isFinite(stated) && Math.abs(stated - calculated) > 0.005)
        })
        const monetaryProblem = presentation.some((row) => row.monetary.length > 0) || statedTotalsDiffer
        const incompleteScores = evaluation.some((item) => item.eligible && !item.complete)
        const eligibleCount = evaluation.filter((item) => item.eligible).length
        const tiedScores = evaluation.filter((item) => item.eligible && item.complete && evaluation.some((other) => other.id !== item.id && other.eligible && other.complete && other.overall === item.overall))
        const weights = object(source.weights)
        const technicalCriteria = rows(source.weights == null ? settings.criteria : weights.criteria)
        const commercialCriteria = rows(source.weights == null ? settings.commCriteria : weights.commCriteria)
        const criteriaValid = [...technicalCriteria, ...commercialCriteria].every((criterion) => typeof criterion.name === "string" && criterion.name.trim().length > 0 && typeof criterion.weight === "number" && Number.isFinite(criterion.weight)) && commercialCriteria.every((criterion) => criterion.auto == null || typeof criterion.auto === "boolean")
        const technicalWeight = source.weights == null ? settings.techWeight : weights.tech
        const commercialWeight = source.weights == null ? settings.commWeight : weights.comm
        const criteriaAvailable = sameBase && criteriaValid && typeof technicalWeight === "number" && Number.isFinite(technicalWeight) && typeof commercialWeight === "number" && Number.isFinite(commercialWeight) && technicalCriteria.some((criterion) => typeof criterion.weight === "number" && criterion.weight > 0) && commercialCriteria.some((criterion) => typeof criterion.weight === "number" && criterion.weight > 0) && technicalWeight + commercialWeight > 0
        const comparisonLimit = [
          monetaryProblem ? `<p>Comparison ranking unavailable: at least one proposal has missing, invalid or inconsistent monetary data. Resolve every proposal's currency, positive total, applicable FX${statedTotalsDiffer ? " and stated total versus quantity × unit price discrepancy" : ""} before comparing rankings.</p>` : "",
          !sameBase && !monetaryProblem ? "<p>Comparison unavailable: the submitted base currency is missing or differs from the current base.</p>" : "",
          !evaluation.length ? "<p>Comparison unavailable: no proposals are recorded.</p>" : evaluation.filter((item) => item.eligible).length < 2 ? "<p>Comparison is limited: fewer than two proposals are eligible.</p>" : "",
          incompleteScores ? "<p>Comparison is incomplete: one or more eligible proposals have missing required human assessments; ranking is withheld so a provisional score is not presented as a recommendation.</p>" : "",
          !criteriaAvailable ? "<p>Ranking unavailable: configured comparison criteria or weights are incomplete.</p>" : "",
          tiedScores.length && !monetaryProblem && sameBase && criteriaAvailable && !incompleteScores && eligibleCount >= 2 ? `<p>Equal overall scores: ${tiedScores.map((item) => esc(text(rows(source.quotes).find((quote) => quote.id === item.id)?.supplier) || "Supplier unavailable")).join(", ")}. Displayed order preserves the existing evaluator ordering.</p>` : "",
        ].join("")
        const rankingUnavailable = monetaryProblem || !sameBase || !criteriaAvailable || incompleteScores || eligibleCount < 2
        const comparison = table(["Proposal", "Eligibility", "Stated total", "Quantity × unit price", "Base amount / FX", "Technical", "Price", "Commercial", "Overall", "Rank"], rows(source.quotes).map((quote, index) => {
          const score = evaluation[index]
          const shown = presentation[index]
          const figure = (value: number | undefined) => criteriaAvailable && score?.complete && score.eligible && value != null && Number.isFinite(value) ? value.toFixed(1) : "Unavailable"
          const stated = typeof quote.total === "number" && Number.isFinite(quote.total) ? quote.total : null
          const calculated = typeof quote.qty === "number" && typeof quote.unitPrice === "number" && Number.isFinite(quote.qty * quote.unitPrice) ? quote.qty * quote.unitPrice : null
          const currency = esc(text(quote.currency) || "Currency unavailable")
          const code = text(quote.currency) || text(settings.currency)
          const base = sameBase && shown?.total != null && shown.fxRate != null && Number.isFinite(shown.total * shown.fxRate) ? `${Number((shown.total * shown.fxRate).toPrecision(15))} ${esc(text(settings.currency))} (${code === text(settings.currency) ? "base" : source.fxSnapshot != null ? "submitted FX" : "current FX"}: ${shown.fxRate})` : `Unavailable${shown?.monetary.length ? ` (${shown.monetary.join(", ")})` : ""}`
          const eligibility = quote.techPass === false ? "Not compliant" : monetaryProblem && shown?.monetary.length ? "Unavailable: monetary data" : score?.eligible ? "Eligible" : "Ineligible: price/FX"
          return [esc(text(quote.supplier) || "Supplier unavailable"), eligibility, shown?.total == null ? `Unavailable${shown?.monetary.length ? ` (${shown.monetary.join(", ")})` : ""}` : `${shown.total} ${esc(shown.currency ?? "Currency unavailable")}`, calculated == null ? "Unavailable" : `${calculated} ${currency}${stated != null && Math.abs(stated - calculated) > 0.005 ? " (differs)" : ""}`, base, monetaryProblem ? "Unavailable" : figure(score?.technical), monetaryProblem ? "Unavailable" : figure(score?.price), monetaryProblem ? "Unavailable" : figure(score?.commercial), rankingUnavailable ? "Unavailable" : figure(score?.overall), rankingUnavailable ? "Unavailable" : score?.complete && score.eligible && score.rank != null ? `${score.rank}${tiedScores.some((item) => item.id === score.id) ? " (tie)" : ""}` : "Unavailable"]
        }))
        const selectedQuote = rows(source.quotes).find((quote) => quote.id === source.selectedId)
        const quotedTotal = selectedQuote?.total
        const quoteQuantity = selectedQuote?.qty
        const quoteUnitPrice = selectedQuote?.unitPrice
        const selectionReason = selectedQuote ? text(source.selectionJustification) || "No selection reason recorded." : "No proposal selected."
        const rankedLeader = rankingUnavailable ? undefined : evaluation.find((item) => item.rank === 1 && item.complete && item.eligible)
        const lowestComparable = presentation.flatMap((item, index) => evaluation[index]?.eligible && item.total != null && item.fxRate != null ? [{ id: item.id, base: item.total * item.fxRate }] : []).sort((left, right) => left.base - right.base)[0]
        const leaderAmount = rankedLeader ? presentation.find((item) => item.id === rankedLeader.id) : undefined
        const premium = !monetaryProblem && sameBase && rankedLeader && lowestComparable && leaderAmount?.total != null && leaderAmount.fxRate != null && lowestComparable.base > 0
          ? leaderAmount.total * leaderAmount.fxRate - lowestComparable.base
          : null
        const rankedLeaderQuote = rankedLeader ? rows(source.quotes).find((quote) => quote.id === rankedLeader.id) : undefined
        const comparisonBasis = `<p>Recorded weights: technical ${typeof technicalWeight === "number" && Number.isFinite(technicalWeight) ? technicalWeight : "unavailable"}, commercial ${typeof commercialWeight === "number" && Number.isFinite(commercialWeight) ? commercialWeight : "unavailable"}. Technical and commercial scores use configured criteria; price is normalized against eligible proposals. Criteria scores are assessments or configured calculations, not new policy.</p>`
        const rankingReason = !monetaryProblem && criteriaAvailable && rankedLeader
          ? `<p role="status">Rank 1: ${esc(text(rankedLeaderQuote?.supplier) || "Supplier unavailable")} with technical score ${rankedLeader.technical.toFixed(1)} and commercial score ${rankedLeader.commercial.toFixed(1)}. Its base amount is ${leaderAmount?.total != null && leaderAmount.fxRate != null ? `${Number((leaderAmount.total * leaderAmount.fxRate).toPrecision(15))} ${esc(text(settings.currency))}` : "unavailable"}${premium != null ? `; ${Number(premium.toPrecision(15))} ${esc(text(settings.currency))} (${(premium / lowestComparable!.base * 100).toFixed(2)}%) above the lowest eligible proposal` : ""}.</p>`
          : ""
        const discrepancy = `<p role="status">Selection: ${selectedQuote ? esc(text(selectedQuote.supplier) || "Supplier unavailable") : "No proposal selected"}. Reason: ${esc(selectionReason)}</p>${rankingReason}` + (typeof quotedTotal === "number" && typeof quoteQuantity === "number" && typeof quoteUnitPrice === "number" && [quotedTotal, quoteQuantity, quoteUnitPrice].every(Number.isFinite) && Math.abs(quotedTotal - quoteQuantity * quoteUnitPrice) > 0.005
          ? `<p role="status">Selected proposal: stated total ${quotedTotal}; quantity × unit price ${quoteQuantity * quoteUnitPrice} ${esc(text(selectedQuote?.currency))}. Review the difference before preparing the order.</p>` : "")
        const approvedSourcing = object(source.approval).amount
        const orderValue = amount(request)
        const orderDifference = typeof approvedSourcing !== "number" || !Number.isFinite(approvedSourcing) || orderValue == null ? "" : source.approvalBaseCurrency !== settings.currency
          ? `<p role="status">Order and approved sourcing values cannot be compared because the submitted base currency is missing or changed.</p>`
          : Math.abs(orderValue - approvedSourcing) > 0.005 ? `<p role="status">Order value ${orderValue} ${esc(text(settings.currency))}; approved sourcing value ${approvedSourcing} ${esc(text(settings.currency))}. Review the difference.</p>` : ""
        const money = procurementMonetaryFacts(request, text(settings.currency), settings)
        const poMoneyState = status === "po_approved" ? "Approved" : status === "po_issued" ? "Issued internally" : status === "po_pending" ? "Pending approval" : status === "po_draft" ? "PO draft" : status === "po_rejected" ? "PO rejected" : "Estimate"
        const poMoneySummary = `<p role="status">${esc(poMoneyState)} value: ${money.original == null || !money.currency ? "Unavailable" : `${money.original} ${esc(money.currency)}`}; base value: ${money.baseAmount == null ? "Unavailable" : `${money.baseAmount} ${esc(text(settings.currency))}`}; FX: ${money.validRate == null ? "Unavailable" : `${money.validRate} (${esc(money.fxSource ?? "unavailable")})`}.</p>`
        const sourceGuidance = orderSourceGuidance(request)
        const orderSourceComparison = sourceGuidance.state === "unavailable"
          ? `<p role="status">Current PO comparison with the selected proposal is unavailable (${esc(sourceGuidance.reason)}).</p>`
          : `<p role="status">Current PO fields versus selected proposal: supplier ${esc(sourceGuidance.supplier)}, currency ${esc(sourceGuidance.currency)}, first-line quantity ${esc(sourceGuidance.quantity)}. This compares current values only; it does not establish historical changes or authorization.</p>`
        const quoteRows = repeatRows(
          "sourcing.quotes",
          rows(source.quotes),
          ["id", "supplier", "currency", "total", "qty", "unitPrice", "techPass"],
          (quote, prefix) =>
            selectField(`${prefix}.supplierId`, "Registered supplier", quote.supplierId, supplierOptions) +
            ["scores", "cscores"]
              .map((kind) => {
                const criteria = rows(
                  object(source.weights)[kind === "scores" ? "criteria" : "commCriteria"] ??
                    settings[kind === "scores" ? "criteria" : "commCriteria"],
                )
                const scores = Array.isArray(quote[kind]) ? quote[kind] : []
                return criteria
                  .map((criterion, index) =>
                    criterion.auto === true
                      ? `<input type="hidden" name="${esc(`${prefix}.${kind}.${index}`)}" data-json="true" value="0">`
                      : fields([
                          {
                            name: `${prefix}.${kind}.${index}`,
                            label: `${text(criterion.name) || (kind === "scores" ? "Technical" : "Commercial")} score`,
                            type: "number",
                            min: 0,
                            max: 5,
                            value: scores[index],
                          },
                        ]),
                  )
                  .join("")
              })
              .join(""),
        )
        const orderLines = rows(po.lines)
        const poInputs =
          scalarFields(
            "po",
            po,
            poFields.filter((name) => !["lines", "supplierId"].includes(name)),
          ) +
          selectField("po.supplierId", "Registered supplier", po.supplierId, supplierOptions) +
          repeatRows(
            "po.lines",
            orderLines.map((line) => ({
              ...line,
              desc: line.desc ?? line.description,
              uom: line.uom ?? line.unit,
            })),
            ["desc", "qty", "unitPrice", "uom"],
            (_line, prefix, index) => index < orderLines.length ? `<input type="hidden" name="${esc(prefix)}._rowRef" value="${esc(orderRowReference(id, index, orderLines[index]!))}">` : "",
          )
        const origins = purchaseOrderFieldSources(request, settings, suppliers)
        const terms = origins.fields.find((field) => field.field === "po.paymentTerms")!
        const paymentSuggestion = `<p role="status">${terms.candidate == null ? "Current supplier master payment terms unavailable" : `Current supplier master payment terms: ${esc(String(terms.candidate))}`}. Saved order payment terms: ${terms.current == null ? "none recorded" : esc(String(terms.current))}.</p><section aria-label="Purchase order field origins"><h4>Saved values and source suggestions</h4><p>Saved order fields remain authoritative for this draft. Suggestions require human review; differences do not apply changes. Recorded source quote: ${esc(origins.sourceQuoteId ?? "Unavailable")}; currently selected quote: ${esc(origins.selectedQuoteId ?? "Unavailable")}.</p>${table(["Field", "Saved order", "Source candidate", "Origin", "Comparison"], origins.fields.map((field) => [esc(field.label), field.current == null ? "Unavailable" : esc(String(field.current)), field.candidate == null ? "Unavailable" : esc(String(field.candidate)), esc(field.origin), esc(field.relation)]))}</section>`
        const validationSuppliers: Parameters<typeof sourcingFieldErrors>[2] = suppliers.map((supplier) => ({ id: String(supplier.id ?? ""), status: text(supplier.status), legalName: text(supplier.legalName) || undefined }))
        const validationSettings = { ...settings, currency: text(settings.currency) } as FormSettings
        const pendingErrors = [
          ...(["draft", "pr_rejected"].includes(status) ? requisitionFieldErrors(object(request.pr) as Parameters<typeof requisitionFieldErrors>[0]) : []),
          ...(["sourcing", "src_rejected"].includes(status) ? sourcingFieldErrors({ pr: object(request.pr), sourcing: source } as Parameters<typeof sourcingFieldErrors>[0], validationSettings, validationSuppliers) : []),
          ...(["po_draft", "po_rejected"].includes(status) ? purchaseOrderFieldErrors({ sourcing: source, po } as Parameters<typeof purchaseOrderFieldErrors>[0], validationSettings, validationSuppliers) : []),
        ]
        const pendingBeside = (prefix: string) => pendingErrors.filter((error) => error.field === prefix).map((error) => `<p role="status">${esc(error.message)}</p>`).join("")
        const requestControls = (page: string, action: string, id: string, body: string, label = action) => controls(page, action, id, presentProcurementFieldErrors(body, pendingErrors.map((error) => ({ ...error, field: action === "select_quote" && error.field === "sourcing.selectedId" ? "quoteId" : error.field })), `${id}-${action}`), label)
        const summary = `<p data-request-summary="${esc(id)}">${esc(requestStageGuidance(status).stage)} · ${esc(requestStageGuidance(status).next)} · Version ${version(`requests:${id}`)} · ${money.baseAmount == null ? "Value unavailable" : `${money.baseAmount} ${esc(text(settings.currency))}`}</p>`
        return `<details id="${esc(id)}"${request === requestedRequest ? " open" : ""}><summary>${esc(id)} · ${esc(text(object(request.pr).title))}</summary>${summary}<ol class="stepper">${["Requisition", "PR approval", "Sourcing", "Sourcing approval", "Purchase order", "PO approval", "Approved", "Issued internally"].map((step) => `<li>${esc(step)}</li>`).join("")}</ol><nav><a href="#${esc(id)}-pr">Requisition</a><a href="#${esc(id)}-sourcing"${request.sourcing == null ? ' aria-disabled="true"' : ""}>Sourcing</a><a href="#${esc(id)}-po"${request.po == null ? ' aria-disabled="true"' : ""}>Purchase order</a><a href="#${esc(id)}-history">History</a></nav><section id="${esc(id)}-pr"><h3>Requisition</h3>${pendingBeside("pr")}${prEditable ? "" : "<p>Editing is unavailable for this stage or role.</p>"}<fieldset${prEditable ? "" : " disabled"}>${requestControls(
          page,
          "save",
          id,
          scalarFields(
            "pr",
            object(request.pr),
            prFields.filter((name) => !["requesterName", "frequency", "estAnnual"].includes(name)),
          ) + `<details${object(request.pr).recurring === true ? " open" : ""}><summary>Recurrence details${object(request.pr).recurring === true ? " (required)" : " (saved values retained)"}</summary><p>Frequency and annual value are required when recurring is selected. Closing this section does not clear saved values.</p>${scalarFields("pr", object(request.pr), ["frequency", "estAnnual"])}</details>`,
          "Save requisition",
        )}${requestControls(page, "submit_pr", id, "", "Submit requisition")}</fieldset></section><section id="${esc(id)}-sourcing"><h3>Sourcing</h3><p>${object(request.pr).recurring === true ? "Choose a contract strategy for this recurring purchase." : "Contract strategy remains recorded; it becomes required for a recurring purchase."}</p>${pendingBeside("sourcing")}${comparisonBasis}${comparisonLimit}${comparison}${discrepancy}${sourcingEditable ? "" : "<p>Editing is unavailable for this stage or role.</p>"}<fieldset${sourcingEditable && request.sourcing != null ? "" : " disabled"}>${requestControls(page, "save", id, scalarFields("sourcing", source, ["evaluator", "fewQuotesJustification", "selectionJustification", "contractStrategy"]) + scalarFields("sourcing.weights", { tech: settings.techWeight, comm: settings.commWeight, ...object(source.weights) }, ["tech", "comm"]) + "<h4>Technical criteria</h4>" + repeatRows("sourcing.weights.criteria", rows(object(source.weights).criteria ?? settings.criteria), ["name", "weight"]) + "<h4>Commercial criteria</h4>" + repeatRows("sourcing.weights.commCriteria", rows(object(source.weights).commCriteria ?? settings.commCriteria), ["name", "weight", "auto"]) + quoteRows, "Save sourcing")}${requestControls(
          page,
          "select_quote",
          id,
          selectField(
            "quoteId",
            "Winning quote",
            source.selectedId,
            rows(source.quotes).map((quote) => ({
              value: String(quote.id ?? ""),
              label: `${text(quote.supplier)} · ${text(quote.currency)} ${finite(quote.total)}`,
            })),
          ),
          "Select quote",
        )}${requestControls(page, "submit_sourcing", id, "", "Submit sourcing")}</fieldset></section><section id="${esc(id)}-po"><h3>Purchase order</h3><p>${source.contractStrategy === "existing" ? "An existing-contract purchase requires its contract reference." : "Contract and asset references are recorded text; they do not establish a validated contract or a budget relation."}</p>${pendingBeside("po")}${poMoneySummary}${orderDifference}${orderSourceComparison}${poEditable ? "" : "<p>Editing is unavailable for this stage or role.</p>"}<fieldset${poEditable && request.po != null ? "" : " disabled"}>${requestControls(page, "save", id, poInputs + paymentSuggestion, "Save purchase order")}${requestControls(page, "submit_po", id, "", "Submit purchase order")}</fieldset><a href="?download=po&amp;request=${encodeURIComponent(id)}">Download purchase order</a></section>${decisionHint}${actions.map((action) => requestControls(page, action, id, ["reject", "cancel"].includes(action) ? fields([{ name: "reason", label: "Reason", required: true }]) : action === "approve" ? fields([{ name: "comment", label: "Comment" }]) : "", action === "issue" ? "Issue internally" : action.charAt(0).toUpperCase() + action.slice(1))).join("")}<article class="po-document"><h3>Purchase order ${esc(text(po.number))}</h3><p>${esc(text(po.supplier))}</p><p>${esc(text(po.description))}</p>${table(
          ["Description", "Quantity", "Unit price"],
          rows(po.lines).map((line) => [
            esc(text(line.desc ?? line.description)),
            String(finite(line.qty)),
            String(finite(line.unitPrice)),
          ]),
        )}</article><section id="${esc(id)}-history"><h3>History</h3><p>PO issuance is internal; legacy labels do not establish delivery to a supplier.</p>${table(
          ["At", "By", "Action", "Note"],
          rows(request.history)
            .reverse()
            .map((line) => [
              esc(text(line.at)),
              esc(text(object(request.historyNames)[`${text(line.at)}|${text(line.by)}`]) || text(line.by)),
              esc(text(line.action)),
              esc(text(line.note)),
            ]),
        )}</section></details>`
      })
      .join("")
  )
}

export const ProcurementModule = { pages, domain, render }
