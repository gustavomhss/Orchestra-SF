import { expect, test } from "bun:test"
import { act } from "./act.ts"

const AT = "2026-11-10T12:00:00Z"
const ISSUED = { pr: [] as string[], po: [] as string[] }

function settings(over: Record<string, unknown> = {}) {
  return {
    currency: "USD",
    levels: [
      { id: "L1", name: "CIO-1 (Level 1)", threshold: 0, holderId: null },
      { id: "L2", name: "CIO (Level 2)", threshold: 30000, holderId: null },
    ],
    prApprovalMode: "first" as const,
    blockSelfApproval: false,
    fxRates: [
      { code: "USD", rate: 1 },
      { code: "EUR", rate: 1.08 },
      { code: "CHF", rate: 1.13 },
      { code: "GBP", rate: 1.28 },
      { code: "BRL", rate: 0.18 },
      { code: "SGD", rate: 0.75 },
    ],
    ...over,
  }
}

function actor(id = "ada", roles: string[] = ["admin"], canWrite = true) {
  return { id, canWrite, roles }
}

function quote(over: Record<string, unknown> = {}) {
  return { id: "q1", supplier: "Acme", supplierId: "s1" as string | null, currency: "USD", total: 100, qty: 1, unitPrice: 10, techPass: true, ...over }
}

function step(holderId: string | null = null) {
  return { levelId: "L1", levelName: "CIO-1 (Level 1)", threshold: 0, holderId, status: "pending" as const }
}

function request(over: Record<string, unknown> = {}) {
  return {
    number: "PR-2026-0001",
    status: "draft",
    createdBy: "ada",
    pr: { estAmount: 100, recurring: false, expenseType: "OPEX" },
    prApproval: null,
    sourcing: null,
    po: null,
    history: [],
    ...over,
  }
}

function po(over: Record<string, unknown> = {}) {
  return {
    number: "PO-2026-0004",
    currency: "USD",
    fxRate: 1 as number | null,
    expenseType: "OPEX",
    supplier: "Acme",
    supplierId: null as string | null,
    sourceQuoteId: "q1" as string | null,
    lines: [{ qty: 1, unitPrice: 10 }],
    approval: null,
    issuedAt: null as string | null,
    ...over,
  }
}

function sourcing(over: Record<string, unknown> = {}) {
  return { quotes: [quote()], selectedId: "q1" as string | null, fxSnapshot: null, approval: null, contractStrategy: "", ...over }
}

function refuse(req: unknown, action: unknown, who = actor(), set = settings(), issued = ISSUED, supplier: unknown = null) {
  const before = req == null ? null : structuredClone(req)
  const result = act(req, action, who, set, AT, issued, supplier)
  return { result, before, req }
}

function expectCode(code: string, seen: ReturnType<typeof refuse>) {
  expect(seen.result).toEqual({ ok: false, code })
  if (seen.req != null) expect(seen.req).toEqual(seen.before)
}

test("C-actor-invalid extra field", () => {
  expectCode("actor_invalid", refuse(null, { type: "create", pr: { estAmount: 1, recurring: false, expenseType: "" } }, { id: "ada", canWrite: true, roles: ["admin"], domains: [] }))
})

test("C-at-invalid", () => {
  const result = act(null, { type: "create", pr: { estAmount: 1, recurring: false, expenseType: "" } }, actor(), settings(), "2026-11-10", ISSUED, null)
  expect(result).toEqual({ ok: false, code: "at_invalid" })
})

test("C-settings-invalid empty levels", () => {
  expectCode("settings_invalid", refuse(null, { type: "create", pr: { estAmount: 1, recurring: false, expenseType: "" } }, actor(), settings({ levels: [] })))
})

test("C-issued-invalid", () => {
  expectCode("issued_invalid", refuse(null, { type: "create", pr: { estAmount: 1, recurring: false, expenseType: "" } }, actor(), settings(), { pr: [1], po: [] }))
})

test("C-supplier-invalid", () => {
  expectCode("supplier_invalid", refuse(null, { type: "create", pr: { estAmount: 1, recurring: false, expenseType: "" } }, actor(), settings(), ISSUED, { id: 1 }))
})

test("C-action-invalid", () => {
  expectCode("action_invalid", refuse(null, { type: "approve", comment: 1 }))
})

test("C-request-invalid empty holder on a step", () => {
  const req = request({
    prApproval: { amount: 1, fxRate: null, steps: [{ levelId: "L1", levelName: "L", threshold: 0, holderId: "", status: "pending" }] },
  })
  expectCode("request_invalid", refuse(req, { type: "submit_pr" }))
})

test("C-read-only", () => {
  expectCode("read_only", refuse(null, { type: "create", pr: { estAmount: 1, recurring: false, expenseType: "" } }, actor("ada", ["requester"], false)))
})

test("C-not-a-transition cancel on null", () => {
  expectCode("not_a_transition", refuse(null, { type: "cancel", reason: "stop" }))
})

test("C-cancelled", () => {
  expectCode("cancelled", refuse(request({ status: "cancelled" }), { type: "cancel", reason: "stop" }, actor("bea", ["buyer"])))
})

test("C-already-issued", () => {
  expectCode("already_issued", refuse(request({ status: "po_issued", po: po() }), { type: "cancel", reason: "stop" }, actor("bea", ["buyer"])))
})

test("C-no-step", () => {
  expectCode("no_step", refuse(request({ status: "pr_pending", prApproval: null }), { type: "approve" }))
})

test("C-not-requester", () => {
  expectCode("not_requester", refuse(null, { type: "create", pr: { estAmount: 1, recurring: false, expenseType: "" } }, actor("bea", ["buyer"])))
})

test("C-not-buyer", () => {
  expectCode("not_buyer", refuse(request({ status: "sourcing", sourcing: sourcing() }), { type: "select_quote", quoteId: "q1" }, actor("ada", ["requester"])))
})

test("C-not-canceller", () => {
  expectCode("not_canceller", refuse(request(), { type: "cancel", reason: "stop" }, actor("bea", ["buyer"])))
})

test("C-no-override stays no_override when the admin is also the creator and the flag is on", () => {
  const req = request({
    status: "pr_pending",
    createdBy: "ada",
    prApproval: { amount: 1, fxRate: null, steps: [step("zoe")] },
  })
  expectCode("no_override", refuse(req, { type: "approve" }, actor("ada", ["admin"]), settings({ blockSelfApproval: true })))
})

test("C-not-approver the word approver does not authorize", () => {
  const req = request({
    status: "pr_pending",
    createdBy: "ada",
    prApproval: { amount: 1, fxRate: null, steps: [step("zoe")] },
  })
  expectCode("not_approver", refuse(req, { type: "approve" }, actor("ada", ["approver"]), settings({ blockSelfApproval: true })))
})

test("C-self-approval empty holder, flag on, creator", () => {
  const req = request({
    status: "pr_pending",
    createdBy: "ada",
    prApproval: { amount: 1, fxRate: null, steps: [step(null)] },
  })
  expectCode("self_approval", refuse(req, { type: "approve" }, actor("ada", ["requester"]), settings({ blockSelfApproval: true })))
})

test("C-reason-required", () => {
  const req = request({ status: "pr_pending", createdBy: "ada", prApproval: { amount: 1, fxRate: null, steps: [step(null)] } })
  expectCode("reason_required", refuse(req, { type: "reject", reason: "   " }, actor("bea", ["buyer"])))
})

test("C-no-quote", () => {
  expectCode("no_quote", refuse(request({ status: "sourcing", sourcing: sourcing({ quotes: [quote()], selectedId: null }) }), { type: "select_quote", quoteId: "missing" }, actor("bea", ["buyer"])))
})

test("C-not-compliant", () => {
  expectCode("not_compliant", refuse(request({ status: "sourcing", sourcing: sourcing({ quotes: [quote({ techPass: false })] }) }), { type: "select_quote", quoteId: "q1" }, actor("bea", ["buyer"])))
})

test("C-no-selection", () => {
  expectCode("no_selection", refuse(request({ status: "sourcing", sourcing: sourcing({ selectedId: null }) }), { type: "submit_sourcing" }, actor("bea", ["buyer"])))
})

test("C-no-po", () => {
  expectCode("no_po", refuse(request({ status: "po_draft", po: null }), { type: "submit_po" }, actor("bea", ["buyer"])))
})

test("C-no-expense-type", () => {
  expectCode("no_expense_type", refuse(request({ status: "po_draft", po: po({ expenseType: "opex" }) }), { type: "submit_po" }, actor("bea", ["buyer"])))
})

test("C-supplier-blocked", () => {
  const req = request({ status: "sourcing", sourcing: sourcing({ quotes: [quote({ supplierId: "s1", currency: "USD" })] }) })
  expectCode("supplier_blocked", refuse(req, { type: "submit_sourcing" }, actor("bea", ["buyer"]), settings(), ISSUED, { id: "s1", status: "blocked" }))
})

test("C-no-fx", () => {
  const req = request({ status: "sourcing", sourcing: sourcing({ quotes: [quote({ currency: "XYZ", supplierId: null })] }) })
  expectCode("no_fx", refuse(req, { type: "submit_sourcing" }, actor("bea", ["buyer"])))
})
