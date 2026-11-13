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
import { visibleRequests } from "../src/requests.ts"
import { quoteAssessment } from "../src/form.ts"
import type { FormSettings } from "../src/form.ts"
import { approvalStageEntry, exportRegister, requestValue } from "../src/procurement-screen.ts"
import type { RequestView } from "../src/procurement-screen.ts"
import { initialProcurementSettings } from "../src/initial-settings.ts"
import { activateSupplier, open, seal } from "../src/supplier.ts"
import type { BankSupplier } from "../src/supplier.ts"
import { esc } from "../src/screen-shell.ts"
import { changed, conflict, object, rows, text, finite } from "./contract.ts"
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
function inputs(values: Record<string, unknown>): Record<string, unknown> | undefined {
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
  return structuredInput(result) as Record<string, unknown>
}
function structuredInput(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value
  const record = object(value)
  const keys = Object.keys(record)
  const entries = Array.isArray(value) ? value : keys.length && keys.every((key) => /^\d+$/.test(key)) ? keys.sort((a, b) => Number(a) - Number(b)).map((key) => record[key]) : undefined
  if (entries)
    return entries.map(structuredInput)
      .filter((item) => {
        const row = object(item)
        if (row._remove === true || row._remove === "true" || row._remove === "on") return false
        if (
          (row._new === true || row._new === "true" || row._new === "on") &&
          !populatedFormValue(row)
        ) return false
        return true
      })
      .map((item) => Object.keys(object(item)).length ? Object.fromEntries(Object.entries(object(item)).filter(([key]) => !["_new", "_remove"].includes(key))) : item)
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, structuredInput(item)]))
}

function populatedFormValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0
  if (typeof value === "number") return value !== 0
  if (Array.isArray(value)) return value.some(populatedFormValue)
  if (value !== null && typeof value === "object")
    return Object.entries(value).some(
      ([key, item]) => !["_new", "_remove", "id", "qty", "techPass", "auto"].includes(key) && populatedFormValue(item),
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
  const values = inputs(command.values)
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
  if (!result.ok)
    return {
      ok: false,
      status: "errors" in result ? 422 : 403,
      errors:
        "errors" in result && Array.isArray(result.errors)
          ? result.errors.filter((error): error is string => typeof error === "string")
          : ["code" in result ? text(result.code) : "Action refused"],
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
    if (!activated.ok)
      return {
        ok: false,
        status: 422,
        errors: ["Supplier activation refused"],
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
      const safe = {
        ...supplier,
        history: redactBank(supplier.history),
        iban: "masked",
        account: "masked",
      }
      if (!has(actor, "admin", "supplier admin")) return { ...safe, swift: undefined }
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
      if (options[name])
        return selectField(
          key,
          label,
          record[name],
          options[name]!.map((value) => ({ value, label: value || "Choose…" })),
        )
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
  extra?: (row: Record<string, unknown>, prefix: string) => string,
) {
  return [...items, prefix === "sourcing.quotes" ? { qty: 1, unitPrice: 0, total: 0, techPass: true } : {}]
    .map(
      (row, index) =>
        `<fieldset class="form-section"><legend>${index === items.length ? "Add row" : `Row ${index + 1}`}</legend>${index === items.length ? `<input type="hidden" name="${esc(prefix)}.${index}._new" value="true">` : fields([{ name: `${prefix}.${index}._remove`, label: "Remove row", type: "checkbox" }])}${names.includes("id") ? `<input type="hidden" name="${esc(prefix)}.${index}.id" value="${esc(String(row.id ?? `${prefix}-${index + 1}`))}">` : ""}${scalarFields(
          `${prefix}.${index}`,
          row,
          names.filter((name) => name !== "id"),
        )}${extra?.(row, `${prefix}.${index}`) ?? ""}</fieldset>`,
    )
    .join("")
}
export function render(page: string, data: Record<string, unknown>, context: RenderContext): string | undefined {
  if (!pages.includes(page as (typeof pages)[number])) return undefined
  const requests = rows(data.requests)
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
              const assumed = matching.filter((request) => {
                const po = object(request.po)
                if (rows(po.lines).length) return !text(po.currency)
                const sourcing = object(request.sourcing)
                const selected = rows(sourcing.quotes).find((quote) => quote.id === sourcing.selectedId)
                return !!selected && !text(selected.currency)
              }).length
              const total = matching.reduce((sum, request) => sum + (amount(request) ?? 0), 0)
              return `${missing ? "Known subtotal " : ""}${total} ${text(object(data.formSettings).currency)}${missing ? `; ${missing} unavailable` : ""}${assumed ? `; ${assumed} use default base currency` : ""}`
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
      controls(page, "reset", "", "<p>Restore initial settings.</p>", "Reset settings") +
      "</details>"
    )
  }
  if (page === "My approvals") {
    const waiting = requests.filter((request) => text(request.status).endsWith("_pending"))
    return ["you", "others", "unassigned"]
      .map(
        (group) =>
          `<h2>${group === "you" ? "Waiting for you" : group === "others" ? "Waiting for others" : "Unassigned"}</h2>` +
          table(
            ["Request", "Subject", "Decision", "Amount", "Reason", "Holder", "Waiting since", "Next step"],
            waiting
              .filter((request) => {
                const holder = text(pending(request).step?.holderId)
                return group === "you" ? holder === context.actor.id : group === "others" ? !!holder && holder !== context.actor.id : !holder
              })
              .map((request) => {
                const holder = String(pending(request).step?.holderId ?? "")
                const approval = pending(request).approval
                const baseCurrency = request.status === "pr_pending" ? text(request.prApprovalBaseCurrency) : request.status === "src_pending" ? text(object(request.sourcing).approvalBaseCurrency) : text(object(request.po).approvalBaseCurrency)
                const enteredAt = approvalStageEntry(request as RequestView)
                return [
                  `<a href="?page=Requests&amp;filter=All#${encodeURIComponent(String(request.number ?? ""))}">${esc(String(request.number ?? ""))}</a>`,
                  esc(text(object(request.pr).title)),
                  request.status === "pr_pending" ? "Requisition" : request.status === "src_pending" ? "Sourcing selection" : "Purchase order",
                  typeof approval.amount === "number" && Number.isFinite(approval.amount) ? `${approval.amount} ${baseCurrency ? esc(baseCurrency) : "(submitted base currency unavailable)"}` : "Unavailable",
                  esc(request.status === "pr_pending" ? text(object(request.pr).justification) : request.status === "src_pending" ? text(object(request.sourcing).selectionJustification) || "See proposal comparison" : text(object(request.po).description)),
                  esc(
                    text(directory.find((person) => String(person.id ?? "") === holder)?.name) ||
                      (holder ? "Assigned approver" : "Unassigned"),
                  ),
                  enteredAt && Number.isFinite(Date.parse(context.at)) && Date.parse(enteredAt) <= Date.parse(context.at) ? esc(enteredAt) : "Unavailable",
                  request.status === "pr_pending" ? "Sourcing after all approvals" : request.status === "src_pending" ? "PO draft after all approvals" : "Internal issuance after all approvals",
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
      controls(page, "create", "", "<h2>New supplier</h2>" + scalarFields("", {}, general), "Create supplier") +
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
          return `<details id="supplier-${esc(id)}"${supplier === requestedSupplier ? " open" : ""}><summary>${esc(text(supplier.legalName))}</summary><nav>General · Categories · Contacts · Commercial · Bank · Compliance · Linked requests · Audit</nav>${controls(page, "save", id, "<h3>Update supplier</h3>" + scalarFields("", supplier, general) + fields([{ name: "categories", label: "Categories (one per line)", type: "textarea", value: Array.isArray(supplier.categories) ? supplier.categories.join("\n") : supplier.categories }]) + repeatRows("contacts", rows(supplier.contacts), ["name", "email", "phone"]) + scalarFields("commercial", object(supplier.commercial), ["notes"]) + scalarFields("compliance", object(supplier.compliance), ["notes"]), "Save supplier")}<section><h3>Bank</h3>${has(context.actor, "admin", "supplier admin") ? controls(page, "change-bank", id, scalarFields("", supplier, [...bankFields]), "Save bank details") : "<p>Bank details masked.</p>"}</section>${["activate", "block", "inactivate", "delete"].map((action) => controls(page, action, id, "", action.charAt(0).toUpperCase() + action.slice(1))).join("")}<h3>Linked requests</h3>${table(
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
    )}${fields([{ name: "q", label: "Search", value: query }])}<button>Filter</button></form><a href="?download=register">Download request register</a>` +
    controls(
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
    ) +
    table(
      ["Request", "Title", "Status", "Amount"],
      filtered.map((request) => [
        `<a href="#${encodeURIComponent(String(request.number ?? ""))}">${esc(String(request.number ?? ""))}</a>`,
        esc(text(object(request.pr).title)),
        esc(requestStatusLabel(text(request.status))),
        amount(request) == null ? "Unavailable" : `${amount(request)} ${esc(text(settings.currency))}`,
      ]),
    ) +
    filtered
      .map((request) => {
        const id = String(request.number ?? "")
        const source = object(request.sourcing)
        const po = object(request.po)
        const status = text(request.status)
        const current = pending(request).step
        const canDecide = context.actor.canWrite && status.endsWith("_pending") && !!current &&
          (!current.holderId || current.holderId === context.actor.id) &&
          !(settings.blockSelfApproval === true && request.createdBy === context.actor.id)
        const canCancel = context.actor.canWrite && !["cancelled", "po_issued"].includes(status) && (request.createdBy === context.actor.id || has(context.actor, "admin"))
        const actions = [
          ...(canDecide ? ["approve", "reject"] : []),
          ...(canCancel ? ["cancel"] : []),
          ...(context.actor.canWrite && status === "po_approved" && has(context.actor, "buyer", "admin") ? ["issue"] : []),
          ...(context.actor.canWrite && status === "draft" && (request.createdBy === context.actor.id || has(context.actor, "admin")) ? ["delete"] : []),
        ]
        const decisionHint = status.endsWith("_pending") && !canDecide ? `<p>Decision unavailable: ${!current ? "approval step unavailable" : current.holderId && current.holderId !== context.actor.id ? "waiting for the assigned holder" : settings.blockSelfApproval === true && request.createdBy === context.actor.id ? "self-approval is blocked" : "write access required"}.</p>` : ""
        const snapshotRequired = ["src_pending", "po_draft", "po_pending", "po_approved", "po_issued", "po_rejected"].includes(status)
        const sameBase = !snapshotRequired || source.approvalBaseCurrency === settings.currency
        const evaluation = quoteAssessment({ sourcing: { ...source, ...(snapshotRequired && source.fxSnapshot == null ? { fxSnapshot: { [text(settings.currency)]: 1 } } : {}) } as Parameters<typeof quoteAssessment>[0]["sourcing"] }, { ...settings, currency: text(settings.currency) } as FormSettings)
        const weights = object(source.weights)
        const criteriaAvailable = sameBase && rows(weights.criteria ?? settings.criteria).some((criterion) => typeof criterion.weight === "number" && criterion.weight > 0) && rows(weights.commCriteria ?? settings.commCriteria).some((criterion) => typeof criterion.weight === "number" && criterion.weight > 0) && Number(weights.tech ?? settings.techWeight ?? 0) + Number(weights.comm ?? settings.commWeight ?? 0) > 0
        const comparisonLimit = !sameBase ? "<p>Comparison unavailable: the submitted base currency is missing or differs from the current base.</p>" : evaluation.length && evaluation.filter((item) => item.eligible).length < 2 ? "<p>Comparison is limited: fewer than two proposals are eligible.</p>" : ""
        const comparison = table(["Proposal", "Stated total", "Quantity × unit price", "Base amount / FX", "Technical", "Price", "Commercial", "Overall", "Rank"], rows(source.quotes).map((quote) => {
          const score = evaluation.find((item) => item.id === quote.id)
          const figure = (value: number | undefined) => criteriaAvailable && score?.complete && score.eligible && value != null && Number.isFinite(value) ? value.toFixed(1) : "Unavailable"
          const stated = typeof quote.total === "number" && Number.isFinite(quote.total) ? quote.total : null
          const calculated = typeof quote.qty === "number" && typeof quote.unitPrice === "number" && Number.isFinite(quote.qty * quote.unitPrice) ? quote.qty * quote.unitPrice : null
          const currency = esc(text(quote.currency) || text(settings.currency))
          const snapshot = source.fxSnapshot == null ? (snapshotRequired ? {} : null) : object(source.fxSnapshot)
          const code = text(quote.currency) || text(settings.currency)
          const rate = code === text(settings.currency) ? 1 : snapshot ? snapshot[code] : rows(settings.fxRates).find((entry) => entry.code === code)?.rate
          const base = sameBase && stated != null && typeof rate === "number" && rate > 0 && Number.isFinite(stated * rate) ? `${stated * rate} ${esc(text(settings.currency))} (${code === text(settings.currency) ? "base" : snapshot ? "submitted FX" : "current FX"}: ${rate})` : "Unavailable"
          return [esc(text(quote.supplier)), stated == null ? "Unavailable" : `${stated} ${currency}`, calculated == null ? "Unavailable" : `${calculated} ${currency}${stated != null && Math.abs(stated - calculated) > 0.005 ? " (differs)" : ""}`, base, figure(score?.technical), figure(score?.price), figure(score?.commercial), figure(score?.overall), criteriaAvailable && score?.complete && score.eligible && score.rank != null ? String(score.rank) : "Unavailable"]
        }))
        const selectedQuote = rows(source.quotes).find((quote) => quote.id === source.selectedId)
        const quotedTotal = selectedQuote?.total
        const quoteQuantity = selectedQuote?.qty
        const quoteUnitPrice = selectedQuote?.unitPrice
        const discrepancy = typeof quotedTotal === "number" && typeof quoteQuantity === "number" && typeof quoteUnitPrice === "number" && [quotedTotal, quoteQuantity, quoteUnitPrice].every(Number.isFinite) && Math.abs(quotedTotal - quoteQuantity * quoteUnitPrice) > 0.005
          ? `<p role="status">Selected proposal: stated total ${quotedTotal}; quantity × unit price ${quoteQuantity * quoteUnitPrice} ${esc(text(selectedQuote?.currency))}. Review the difference before preparing the order.</p>` : ""
        const approvedSourcing = object(source.approval).amount
        const orderValue = amount(request)
        const orderDifference = typeof approvedSourcing !== "number" || !Number.isFinite(approvedSourcing) || orderValue == null ? "" : source.approvalBaseCurrency !== settings.currency
          ? `<p role="status">Order and approved sourcing values cannot be compared because the submitted base currency is missing or changed.</p>`
          : Math.abs(orderValue - approvedSourcing) > 0.005 ? `<p role="status">Order value ${orderValue} ${esc(text(settings.currency))}; approved sourcing value ${approvedSourcing} ${esc(text(settings.currency))}. Review the difference.</p>` : ""
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
        const poInputs =
          scalarFields(
            "po",
            po,
            poFields.filter((name) => !["lines", "supplierId"].includes(name)),
          ) +
          selectField("po.supplierId", "Registered supplier", po.supplierId, supplierOptions) +
          repeatRows(
            "po.lines",
            rows(po.lines).map((line) => ({
              ...line,
              desc: line.desc ?? line.description,
              uom: line.uom ?? line.unit,
            })),
            ["desc", "qty", "unitPrice", "uom"],
          )
        return `<details id="${esc(id)}"${request === requestedRequest ? " open" : ""}><summary>${esc(id)} · ${esc(text(object(request.pr).title))}</summary><ol class="stepper">${["Requisition", "PR approval", "Sourcing", "Sourcing approval", "Purchase order", "PO approval", "Approved", "Issued internally"].map((step) => `<li>${esc(step)}</li>`).join("")}</ol><nav><a href="#${esc(id)}-pr">Requisition</a><a href="#${esc(id)}-sourcing"${request.sourcing == null ? ' aria-disabled="true"' : ""}>Sourcing</a><a href="#${esc(id)}-po"${request.po == null ? ' aria-disabled="true"' : ""}>Purchase order</a><a href="#${esc(id)}-history">History</a></nav><section id="${esc(id)}-pr"><h3>Requisition</h3>${controls(
          page,
          "save",
          id,
          scalarFields(
            "pr",
            object(request.pr),
            prFields.filter((name) => name !== "requesterName"),
          ),
          "Save requisition",
        )}${controls(page, "submit_pr", id, "", "Submit requisition")}</section><section id="${esc(id)}-sourcing"><h3>Sourcing</h3><p>Scores use configured weights and human assessments. Missing scores or exchange rates make the comparison incomplete.</p>${comparisonLimit}${comparison}${discrepancy}<fieldset${request.sourcing == null ? " disabled" : ""}>${controls(page, "save", id, scalarFields("sourcing", source, ["evaluator", "fewQuotesJustification", "selectionJustification", "contractStrategy"]) + scalarFields("sourcing.weights", { tech: settings.techWeight, comm: settings.commWeight, ...object(source.weights) }, ["tech", "comm"]) + "<h4>Technical criteria</h4>" + repeatRows("sourcing.weights.criteria", rows(object(source.weights).criteria ?? settings.criteria), ["name", "weight"]) + "<h4>Commercial criteria</h4>" + repeatRows("sourcing.weights.commCriteria", rows(object(source.weights).commCriteria ?? settings.commCriteria), ["name", "weight", "auto"]) + quoteRows, "Save sourcing")}${controls(
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
        )}${controls(page, "submit_sourcing", id, "", "Submit sourcing")}</fieldset></section><section id="${esc(id)}-po"><h3>Purchase order</h3>${orderDifference}<fieldset${request.po == null ? " disabled" : ""}>${controls(page, "save", id, poInputs, "Save purchase order")}${controls(page, "submit_po", id, "", "Submit purchase order")}</fieldset><a href="?download=po&amp;request=${encodeURIComponent(id)}">Download purchase order</a></section>${decisionHint}${actions.map((action) => controls(page, action, id, ["reject", "cancel"].includes(action) ? fields([{ name: "reason", label: "Reason", required: true }]) : action === "approve" ? fields([{ name: "comment", label: "Comment" }]) : "", action === "issue" ? "Issue internally" : action.charAt(0).toUpperCase() + action.slice(1))).join("")}<article class="po-document"><h3>Purchase order ${esc(text(po.number))}</h3><p>${esc(text(po.supplier))}</p><p>${esc(text(po.description))}</p>${table(
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
