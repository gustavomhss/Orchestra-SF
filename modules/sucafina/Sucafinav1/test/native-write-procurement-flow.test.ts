import { expect, test } from "bun:test"
import { object, rows } from "../runtime/contract.ts"
import type { Command } from "../runtime/contract.ts"
import { nativeWriteFlow } from "./fixture/native-write.ts"

const pr = {
  title: "Synthetic services", type: "service", description: "Implementation", estAmount: 500,
  costCenter: "IT", needBy: "2026-12-01", justification: "Delivery", recurring: false, expenseType: "OPEX",
}
const sourcing = {
  quotes: [{ id: "q1", supplier: "Synthetic vendor", supplierId: null, currency: "EUR", total: 500, qty: 1, unitPrice: 500, techPass: true, scores: [5], cscores: [] }],
  evaluator: "Synthetic evaluator", selectedId: "q1", fewQuotesJustification: "Sole source",
  selectionJustification: "Best", contractStrategy: "new",
  weights: { tech: 60, comm: 40, criteria: [{ weight: 1 }], commCriteria: [{ weight: 1, auto: true }] },
}
const po = {
  description: "Consulting deliverable", paymentTerms: "Net 30", deliveryDate: "2026-12-20",
  deliveryConditions: "Remote", contractRef: "C-1", assetRef: "Text reference",
  lines: [{ description: "Milestone", qty: 1, unitPrice: 500 }], expenseType: "OPEX",
}

function flow() {
  return nativeWriteFlow({ people: [
    { token: "requester", id: "requester", name: "Synthetic Requester", roles: [{ surface: "procurement", role: "requester" }] },
    { token: "other", id: "other", name: "Synthetic Other", roles: [{ surface: "procurement", role: "requester" }] },
    { token: "buyer", id: "buyer", name: "Synthetic Buyer", roles: [{ surface: "procurement", role: "buyer" }] },
    { token: "holder", id: "holder", name: "Synthetic Holder", roles: [{ surface: "procurement", role: "approver" }] },
    { token: "wrong", id: "wrong", name: "Synthetic Wrong Holder", roles: [{ surface: "procurement", role: "approver" }] },
    { token: "admin", id: "admin", name: "Synthetic Admin", roles: [{ surface: "procurement", role: "admin" }] },
  ] })
}

type Flow = ReturnType<typeof flow>
async function command(app: Flow, token: string, input: Command, status = 200) {
  const response = await app.command("procurement", input, token)
  expect(response?.status).toBe(status)
  const body = object(await response!.json())
  expect(body.ok).toBe(status === 200)
  return body
}
async function read(app: Flow, token = "buyer") {
  const response = await app.read("procurement", "Requests", token)
  expect(response?.status).toBe(200)
  return object(await response!.json())
}
async function request(app: Flow, token = "buyer") {
  return rows(object((await read(app, token)).data).requests)[0]!
}
async function setup(app: Flow) {
  await command(app, "admin", { page: "Settings", action: "reset", version: 0, values: {} })
  await command(app, "admin", { page: "Settings", action: "save", version: 1, values: {
    levels: [{ id: "L1", name: "Level one", threshold: 0, holderId: "holder" }],
  } })
  await command(app, "requester", { page: "Requests", action: "create", version: 0, values: { pr } })
  const record = await request(app, "requester")
  expect(record).toMatchObject({ number: "PR-2026-0001", status: "draft", createdBy: "requester", pr })
  return String(record.number)
}
function action(id: string, name: string, version: number, values: Record<string, unknown> = {}): Command {
  return { page: "Requests", action: name, id, version, values }
}
async function submit(app: Flow, id: string) {
  await command(app, "requester", action(id, "submit_pr", 1, { pr }))
}
async function beginSourcing(app: Flow, id: string) {
  await submit(app, id)
  await command(app, "holder", action(id, "approve", 2))
}

test("requester creates and submits; another requester cannot see or change the draft", async () => {
  const app = flow()
  const id = await setup(app)
  expect(rows(object((await read(app, "other")).data).requests)).toEqual([])
  const before = structuredClone(app.storage.state.procurement)
  await command(app, "other", action(id, "save", 1, { pr: { title: "Changed" } }), 403)
  expect(app.storage.state.procurement).toEqual(before)
  await submit(app, id)
  const view = await read(app, "requester")
  expect(rows(object(view.data).requests)[0]).toMatchObject({ status: "pr_pending", pr, prApproval: { amount: 500, steps: [{ holderId: "holder", status: "pending" }] } })
  expect(object(object(view.versions)[`requests:${id}`])).toMatchObject({ version: 2, by: "requester" })
  expect(app.storage.state.procurement.audit.filter((entry) => entry.record === `requests:${id}`)).toHaveLength(2)
})

test("only the named holder approves even after the configured holder changes", async () => {
  const app = flow()
  const id = await setup(app)
  await submit(app, id)
  const before = structuredClone(app.storage.state.procurement)
  expect(await command(app, "wrong", action(id, "approve", 2), 403)).toMatchObject({ errors: ["not_approver"] })
  expect(app.storage.state.procurement).toEqual(before)
  expect(await command(app, "admin", action(id, "approve", 2), 403)).toMatchObject({ errors: ["no_override"] })
  expect(app.storage.state.procurement).toEqual(before)
  await command(app, "admin", { page: "Settings", action: "save", version: 2, values: {
    levels: [{ id: "L1", name: "Changed", threshold: 0, holderId: "wrong" }],
  } })
  await command(app, "holder", action(id, "approve", 2))
  expect(await request(app)).toMatchObject({ status: "sourcing", prApproval: { steps: [{ holderId: "holder", status: "approved" }] } })
  expect(app.storage.state.procurement.versions[`requests:${id}`]).toMatchObject({ version: 3, by: "holder" })
})

test("buyer progresses sourcing and PO with frozen FX and named approvals through issue", async () => {
  const app = flow()
  const id = await setup(app)
  await beginSourcing(app, id)
  await command(app, "buyer", action(id, "save", 3, { sourcing }))
  await command(app, "buyer", action(id, "select_quote", 4, { quoteId: "q1" }))
  await command(app, "buyer", action(id, "submit_sourcing", 5, { sourcing }))
  expect(await request(app)).toMatchObject({ status: "src_pending", sourcing: { selectedId: "q1", fxSnapshot: { EUR: 1.08 }, approval: { amount: 540, fxRate: 1.08, steps: [{ holderId: "holder", status: "pending" }] } } })
  await command(app, "admin", { page: "Settings", action: "save", version: 2, values: { fxRates: [{ code: "EUR", rate: 2 }] } })
  expect(await request(app)).toMatchObject({ sourcing: { fxSnapshot: { EUR: 1.08 }, approval: { amount: 540, fxRate: 1.08 } } })
  await command(app, "holder", action(id, "approve", 6))
  expect(await request(app)).toMatchObject({ status: "po_draft" })
  await command(app, "buyer", action(id, "submit_po", 7, { po }))
  expect(await request(app)).toMatchObject({ status: "po_pending", po: { fxRate: 2, approval: { amount: 1000, fxRate: 2, steps: [{ holderId: "holder", status: "pending" }] } } })
  await command(app, "holder", action(id, "approve", 8))
  await command(app, "buyer", action(id, "issue", 9))
  expect(await request(app)).toMatchObject({ status: "po_issued", po: { ...po, issuedAt: "2026-03-15T12:00:00Z" }, sourcing: { fxSnapshot: { EUR: 1.08 } } })
  expect(app.storage.state.procurement.versions[`requests:${id}`]).toMatchObject({ version: 10, by: "buyer" })
  expect(app.storage.state.procurement.audit.filter((entry) => entry.record === `requests:${id}`)).toHaveLength(10)
})

test("stale, invalid and unauthorized workflow steps leave state and audit unchanged", async () => {
  const app = flow()
  const id = await setup(app)
  const before = structuredClone(app.storage.state.procurement)
  expect(await command(app, "requester", action(id, "submit_pr", 0, { pr }), 409)).toMatchObject({ status: 409 })
  expect(app.storage.state.procurement).toEqual(before)
  await command(app, "requester", action(id, "submit_pr", 1, { pr: { title: "" } }), 422)
  expect(app.storage.state.procurement).toEqual(before)
  await beginSourcing(app, id)
  const sourcingBefore = structuredClone(app.storage.state.procurement)
  await command(app, "requester", action(id, "select_quote", 3, { quoteId: "q1" }), 403)
  expect(app.storage.state.procurement).toEqual(sourcingBefore)
  await command(app, "buyer", action(id, "save", 3, { sourcing: { quotes: "invalid" } }), 422)
  expect(app.storage.state.procurement).toEqual(sourcingBefore)
  expect((await request(app)).status).toBe("sourcing")
})
