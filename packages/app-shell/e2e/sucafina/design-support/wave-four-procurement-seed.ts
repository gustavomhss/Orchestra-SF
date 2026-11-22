import type { Actor, Command, Environment, Snapshot } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract"
import { object, rows } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract"
import { ProcurementModule } from "../../../../../modules/sucafina/Sucafinav1/runtime/procurement"
import { initialProcurementSettings } from "../../../../../modules/sucafina/Sucafinav1/src/initial-settings"
import { waveFourProcurementData } from "./wave-four-procurement-data"

/**
 * The isolated installation supplies its real enrolled operator and configured
 * native buyer policy. All records, CAS revisions, transitions and totals are
 * produced by ProcurementModule; no projection, grant or receipt is fabricated.
 */
export function seedWaveFourProcurement(snapshot: Snapshot, actor: Actor, environment: Environment, year: number) {
  const data = waveFourProcurementData
  if (!actor.id || !actor.canWrite || !actor.roles.includes("admin") || !actor.roles.includes("buyer"))
    throw new Error("Wave-four procurement seed requires the installation's enrolled admin and explicit native buyer policy")
  const version = (key: string) => snapshot.versions[key]?.version ?? 0
  const execute = (command: Command) => {
    const result = ProcurementModule.domain.execute(snapshot, actor, command, environment)
    if (!result.ok) throw new Error("Canonical wave-four procurement seed rejected: " +
      command.page + "/" + command.action + " (" + result.status + ") " + (result.errors ?? []).join("; "))
    return object(result.value)
  }
  const reference = (value: Record<string, unknown>, field: "id" | "number") => {
    const result = value[field]
    if (typeof result !== "string" || !result) throw new Error("Canonical procurement seed omitted " + field)
    return result
  }
  const command = (id: string, action: string, values: Record<string, unknown> = {}) =>
    execute({ page: "Requests", action, id, version: version("requests:" + id), values })

  const initial = initialProcurementSettings()
  execute({
    page: "Settings", action: "save", version: version("settings"),
    values: { settings: {
      ...initial,
      // Retain the original thresholds, quorum, quotation and self-approval policy.
      // The holder is the actual enrolled installation owner, not a synthetic user.
      levels: initial.levels.map((level) => ({ ...level, holderId: actor.id })),
      billingAddress: "Design test data · Regional finance office",
      defaultDeliveryAddress: "Design test data · Regional operations centre",
      reminderDays: 7, escalationDays: 14, uploadCap: 25 * 1024 * 1024,
    } },
  })

  const suppliers = [
    { name: data.suppliers.primary, country: "Brazil", currency: "USD", type: "Service provider" },
    { name: data.suppliers.alternative, country: "Switzerland", currency: "EUR", type: "Technology partner" },
    { name: data.suppliers.restricted, country: "United Kingdom", currency: "USD", type: "Service provider" },
  ].map((entry) => {
    const created = execute({
      page: "Suppliers", action: "create", version: 0,
      values: { supplier: {
        legalName: entry.name, tradingName: entry.name, type: entry.type,
        country: entry.country, currency: entry.currency,
        contactName: "Design test data · Regional service contact",
        contactEmail: "service@example.invalid", financeEmail: "finance@example.invalid",
        paymentTerms: "Net 30", incoterm: "N/A (service)", categories: ["Managed services"],
        riskRating: "Medium", dueDiligence: false, nda: false, dpa: false,
        notes: data.supplierNote,
      } },
    })
    return { id: reference(created, "id"), name: entry.name, currency: entry.currency }
  })
  const restricted = suppliers[2]
  if (!restricted) throw new Error("Canonical supplier fixture missing")
  execute({ page: "Suppliers", action: "block", id: restricted.id,
    version: version("suppliers:" + restricted.id), values: {} })

  const create = (title: string, amount: number | null, expenseType = "OPEX") => {
    const created = execute({
      page: "Requests", action: "create", version: version("requests:"),
      values: { pr: {
        title, type: "service", description: data.description, estAmount: amount,
        costCenter: "Regional IT", needBy: year + "-12-20", justification: data.justification,
        recurring: false, expenseType, category: "Managed services",
      } },
    })
    return reference(created, "number")
  }
  const assertStatus = (id: string, expected: string) => {
    const request = object(object(object(snapshot.data.store).requests)[id])
    if (object(request.request).status !== expected)
      throw new Error("Canonical procurement seed did not reach " + expected)
  }
  const beginSourcing = (title: string, amount: number, expenseType = "OPEX") => {
    const id = create(title, amount, expenseType)
    command(id, "submit_pr")
    command(id, "approve", { comment: "Design test data · Approved requisition for sourcing." })
    const quotes = suppliers.map((supplier, index) => ({
      id: environment.id(), supplier: supplier.name, supplierId: supplier.id,
      currency: supplier.currency, total: index === 0 ? amount : amount + (index + 1) * 900,
      qty: 1, unitPrice: index === 0 ? amount : amount + (index + 1) * 900,
      techPass: index !== 2, scores: initial.criteria.map(() => index === 0 ? 5 : 4),
      cscores: initial.commCriteria.map(() => index === 0 ? 5 : 4),
      description: data.description,
      notes: "Design test data · Recorded quotation and supporting evaluation.",
    }))
    command(id, "save", { sourcing: {
      quotes, evaluator: environment.directory.find((person) => person.id === actor.id)?.name ?? actor.id,
      fewQuotesJustification: "", selectionJustification: "", contractStrategy: "",
    } })
    const selected = quotes[0]
    if (!selected) throw new Error("Canonical quotation fixture missing")
    command(id, "select_quote", { quoteId: selected.id })
    assertStatus(id, "sourcing")
    return id
  }
  const beginOrder = (title: string, amount: number, expenseType = "OPEX") => {
    const id = beginSourcing(title, amount, expenseType)
    command(id, "submit_sourcing")
    command(id, "approve", { comment: "Design test data · Approved sourcing selection." })
    command(id, "save", { po: {
      description: data.description, paymentTerms: "Net 30", deliveryDate: year + "-12-20",
      deliveryConditions: "Design test data · Accept after the regional service owner reviews delivery.",
      lines: [{ qty: 1, unitPrice: amount, desc: "Regional service", description: data.description,
        unit: "service", notes: "Design test data · Recorded line detail." }],
      currency: "USD", expenseType, incoterm: "N/A (service)",
    } })
    command(id, "submit_po")
    assertStatus(id, "po_pending")
    return id
  }

  // These are distinct source states: a missing estimate and a recorded numeric zero.
  assertStatus(create(data.requests.draft, null), "draft")
  assertStatus(create(data.requests.zero, 0), "draft")
  const pr = create(data.requests.prApproval, 12600)
  command(pr, "submit_pr")
  assertStatus(pr, "pr_pending")
  beginSourcing(data.requests.sourcing, 18400)
  const sourcing = beginSourcing(data.requests.sourceApproval, 16300)
  command(sourcing, "submit_sourcing")
  assertStatus(sourcing, "src_pending")
  beginOrder(data.requests.poApproval, 22400, "CAPEX")
  const issued = beginOrder(data.requests.issued, 14800)
  command(issued, "approve", { comment: "Design test data · Approved order for internal issue." })
  command(issued, "issue")
  assertStatus(issued, "po_issued")

  // Read-only completeness assertion; never install a hand-built result into the store.
  if (rows(object(snapshot.data.store).suppliers).length !== suppliers.length)
    throw new Error("Canonical procurement supplier fixture is incomplete")
}
