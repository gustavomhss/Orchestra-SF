import { expect, test } from "bun:test"
import { act } from "./act.ts"

const AT = "2026-11-10T12:00:00Z"
const ISSUED = { pr: [] as string[], po: [] as string[] }

function settings() {
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
  }
}

function actor(id: string, roles: string[], canWrite = true) {
  return { id, canWrite, roles }
}

function quote(over: Record<string, unknown> = {}) {
  return { id: "q1", supplier: "Acme", supplierId: "s1" as string | null, currency: "USD", total: 100, qty: 1, unitPrice: 10, techPass: true, ...over }
}

function step(over: Record<string, unknown> = {}) {
  return { levelId: "L1", levelName: "CIO-1 (Level 1)", threshold: 0, holderId: null as string | null, status: "pending" as const, ...over }
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
    history: [] as { at: string; by: string; action: string; note: string }[],
    ...over,
  }
}

function po(over: Record<string, unknown> = {}) {
  return {
    number: "PO-2026-0004",
    currency: "USD",
    fxRate: null as number | null,
    expenseType: "OPEX",
    supplier: "Acme",
    supplierId: "s1" as string | null,
    sourceQuoteId: "q1" as string | null,
    lines: [{ qty: 2, unitPrice: 10 }],
    approval: null,
    issuedAt: "keep" as string | null,
    ...over,
  }
}

function call(req: unknown, action: unknown, who = actor("ada", ["requester"])) {
  const before = req == null ? null : structuredClone(req)
  const result = act(req, action, who, settings(), AT, ISSUED, null)
  return { result, before }
}

function refused(req: unknown, action: unknown, who = actor("ada", ["admin"])) {
  const before = structuredClone(req)
  const result = act(req, action, who, settings(), AT, ISSUED, null)
  expect(result).toEqual({ ok: false, code: "not_a_transition" })
  expect(req).toEqual(before)
}

test("L-create requester mints a draft and create on draft is not a transition", () => {
  const pr = { estAmount: 52000, recurring: false, expenseType: "", title: "EDR" }
  const { result } = call(null, { type: "create", pr }, actor("ada", ["requester"]))
  if (!result.ok) throw new Error(result.code)
  expect(result.request.status).toBe("draft")
  expect(result.request.number).toBe("PR-2026-0001")
  expect(result.request.createdBy).toBe("ada")
  expect(result.request.pr).toEqual(pr)
  expect(result.request.prApproval).toBeNull()
  expect(result.request.sourcing).toBeNull()
  expect(result.request.po).toBeNull()
  expect(result.request.history).toEqual([{ at: AT, by: "ada", action: "Requisition created", note: "" }])
  const wide = act(null, { type: "create", pr }, actor("ada", ["requester"]), settings(), AT, { pr: ["PR-2026-10000"], po: [] }, null)
  if (!wide.ok) throw new Error(wide.code)
  expect(wide.request.number).toBe("PR-2026-10001")
  expect(wide.request.number).not.toBe("PR-2026-0001")
  refused(request(), { type: "create", pr })
})

test("L-submit-pr replaces approval and submit on sourcing is not a transition", () => {
  const req = request({
    status: "pr_rejected",
    prApproval: { amount: 1, fxRate: null, steps: [step({ status: "rejected" })] },
  })
  const { result, before } = call(req, { type: "submit_pr" }, actor("ada", ["buyer"]))
  if (!result.ok) throw new Error(result.code)
  expect(result.request.status).toBe("pr_pending")
  expect(result.request.prApproval?.steps.map((item) => item.levelId)).toEqual(["L1"])
  expect(result.request.prApproval?.amount).toBe(100)
  expect(result.request.prApproval?.fxRate).toBeNull()
  expect(result.request.history.at(-1)).toEqual({ at: AT, by: "ada", action: "Requisition submitted for approval", note: "CIO-1 (Level 1)" })
  expect(req).toEqual(before)
  const blankHolder = settings()
  blankHolder.levels = [{ id: "L1", name: "CIO-1 (Level 1)", threshold: 0, holderId: "" }]
  const copied = act(request({ status: "draft" }), { type: "submit_pr" }, actor("ada", ["requester"]), blankHolder, AT, ISSUED, null)
  if (!copied.ok) throw new Error(copied.code)
  expect(copied.request.prApproval?.steps[0].holderId).toBeNull()
  refused(request({ status: "sourcing", sourcing: { quotes: [], selectedId: null, fxSnapshot: null, approval: null, contractStrategy: "" } }), { type: "submit_pr" })
})

test("L-approve-pr-resta keeps the status and approve on draft is not a transition", () => {
  const req = request({
    status: "pr_pending",
    prApproval: { amount: 100, fxRate: null, steps: [step(), step({ levelId: "L2", levelName: "CIO (Level 2)", threshold: 30000 })] },
  })
  const { result, before } = call(req, { type: "approve", comment: "  ok  " }, actor("bea", ["buyer"]))
  if (!result.ok) throw new Error(result.code)
  expect(result.request.status).toBe("pr_pending")
  expect(result.request.prApproval?.steps.map((item) => item.status)).toEqual(["approved", "pending"])
  expect(result.request.history.at(-1)).toEqual({ at: AT, by: "bea", action: "Requisition approved by CIO-1 (Level 1)", note: "ok" })
  expect(req).toEqual(before)
  refused(request(), { type: "approve" })
})

test("L-approve-pr-ultimo opens sourcing and does not create a PO", () => {
  const req = request({ status: "pr_pending", prApproval: { amount: 100, fxRate: null, steps: [step()] } })
  const { result } = call(req, { type: "approve" }, actor("bea", ["buyer"]))
  if (!result.ok) throw new Error(result.code)
  expect(result.request.status).toBe("sourcing")
  expect(result.request.prApproval?.steps[0].status).toBe("approved")
  expect(result.request.sourcing).toEqual({ quotes: [], selectedId: null, fxSnapshot: null, approval: null, contractStrategy: "" })
  expect(result.request.po).toBeNull()
  expect(result.request.history.slice(-2)).toEqual([
    { at: AT, by: "bea", action: "Requisition approved by CIO-1 (Level 1)", note: "" },
    { at: AT, by: "bea", action: "Sourcing started", note: "" },
  ])
  const kept = request({
    status: "pr_pending",
    pr: { estAmount: 100, recurring: true, expenseType: "OPEX" },
    prApproval: { amount: 100, fxRate: null, steps: [step()] },
    sourcing: { quotes: [quote()], selectedId: "q1", fxSnapshot: null, approval: null, contractStrategy: "keep" },
  })
  const again = act(kept, { type: "approve" }, actor("bea", ["buyer"]), settings(), AT, ISSUED, null)
  if (!again.ok) throw new Error(again.code)
  expect(again.request.sourcing?.contractStrategy).toBe("keep")
  expect(again.request.sourcing?.quotes).toHaveLength(1)
  const born = request({
    status: "pr_pending",
    pr: { estAmount: 100, recurring: true, expenseType: "OPEX" },
    prApproval: { amount: 100, fxRate: null, steps: [step()] },
  })
  const opened = act(born, { type: "approve" }, actor("bea", ["buyer"]), settings(), AT, ISSUED, null)
  if (!opened.ok) throw new Error(opened.code)
  expect(opened.request.sourcing?.contractStrategy).toBe("new")
  refused(request(), { type: "approve" })
})

test("L-reject-pr rejects the first pending and leaves the others", () => {
  const req = request({
    status: "pr_pending",
    prApproval: { amount: 100, fxRate: null, steps: [step(), step({ levelId: "L2", levelName: "CIO (Level 2)", status: "approved" })] },
  })
  const { result } = call(req, { type: "reject", reason: "  no  " }, actor("bea", ["buyer"]))
  if (!result.ok) throw new Error(result.code)
  expect(result.request.status).toBe("pr_rejected")
  expect(result.request.prApproval?.steps.map((item) => item.status)).toEqual(["rejected", "approved"])
  expect(result.request.history.at(-1)).toEqual({ at: AT, by: "bea", action: "Requisition rejected by CIO-1 (Level 1)", note: "no" })
  refused(request(), { type: "reject", reason: "no" })
})

test("L-select writes the proposal and select on draft is not a transition", () => {
  const req = request({
    status: "sourcing",
    sourcing: { quotes: [quote({ qty: 0, unitPrice: 0 })], selectedId: null, fxSnapshot: null, approval: null, contractStrategy: "" },
  })
  const { result, before } = call(req, { type: "select_quote", quoteId: "q1" }, actor("bea", ["buyer"]))
  if (!result.ok) throw new Error(result.code)
  expect(result.request.status).toBe("sourcing")
  expect(result.request.sourcing?.selectedId).toBe("q1")
  expect(result.request.po).toEqual({
    number: "PO-2026-0001",
    currency: "USD",
    fxRate: null,
    expenseType: "OPEX",
    supplier: "Acme",
    supplierId: "s1",
    sourceQuoteId: "q1",
    lines: [{ qty: 1, unitPrice: 0 }],
    approval: null,
    issuedAt: null,
  })
  expect(result.request.history.at(-1)).toEqual({ at: AT, by: "bea", action: "Quotation selected \u2014 PO proposal generated", note: "Acme" })
  expect(req).toEqual(before)
  const numbered = request({
    status: "sourcing",
    sourcing: { quotes: [quote()], selectedId: null, fxSnapshot: null, approval: null, contractStrategy: "" },
    po: po({ number: "PO-2026-0042" }),
  })
  const keptNumber = act(numbered, { type: "select_quote", quoteId: "q1" }, actor("bea", ["buyer"]), settings(), AT, ISSUED, null)
  if (!keptNumber.ok) throw new Error(keptNumber.code)
  expect(keptNumber.request.po?.number).toBe("PO-2026-0042")
  expect(keptNumber.request.po?.lines).toEqual([{ qty: 2, unitPrice: 10 }])
  expect(keptNumber.request.history.at(-1)?.action).toBe("Quotation selected \u2014 existing PO proposal retained")
  refused(request(), { type: "select_quote", quoteId: "q1" })
})

test("L-submit-sourcing copies entram and keeps a PO that already came from the selected quote", () => {
  const born = request({
    status: "sourcing",
    sourcing: { quotes: [quote({ currency: "EUR", total: 40000 })], selectedId: "q1", fxSnapshot: null, approval: null, contractStrategy: "" },
  })
  const first = act(born, { type: "submit_sourcing" }, actor("bea", ["buyer"]), settings(), AT, ISSUED, null)
  if (!first.ok) throw new Error(first.code)
  expect(first.request.status).toBe("src_pending")
  expect(first.request.sourcing?.fxSnapshot).toEqual({ EUR: 1.08 })
  expect(first.request.sourcing?.approval?.steps.map((item) => item.levelId)).toEqual(["L1", "L2"])
  expect(first.request.po?.sourceQuoteId).toBe("q1")
  expect(first.request.history.at(-1)?.action).toBe("Sourcing submitted for approval")
  const kept = po({ sourceQuoteId: "q1", number: "PO-2026-0009", fxRate: 9, expenseType: "CAPEX" })
  const again = request({
    status: "src_rejected",
    sourcing: { quotes: [quote()], selectedId: "q1", fxSnapshot: null, approval: null, contractStrategy: "" },
    po: kept,
  })
  const second = act(again, { type: "submit_sourcing" }, actor("bea", ["buyer"]), settings(), AT, ISSUED, null)
  if (!second.ok) throw new Error(second.code)
  expect(second.request.po).toEqual(kept)
  expect(second.request.status).toBe("src_pending")
  expect(second.request.sourcing?.fxSnapshot).toEqual({ USD: 1 })
  expect(second.request.sourcing?.approval?.amount).toBe(100)
  const replaced = request({
    status: "sourcing",
    sourcing: { quotes: [quote({ currency: "EUR", total: 10 })], selectedId: "q1", fxSnapshot: null, approval: null, contractStrategy: "" },
    po: po({ sourceQuoteId: "other", number: "PO-2026-0008", expenseType: "OPEX" }),
  })
  const third = act(replaced, { type: "submit_sourcing" }, actor("bea", ["buyer"]), settings(), AT, ISSUED, null)
  if (!third.ok) throw new Error(third.code)
  expect(third.request.po?.number).toBe("PO-2026-0008")
  expect(third.request.po?.sourceQuoteId).toBe("q1")
  expect(third.request.po?.fxRate).toBeNull()
  expect(third.request.sourcing?.fxSnapshot).toEqual({ EUR: 1.08 })
  expect(third.request.sourcing?.approval?.fxRate).toBe(1.08)
  expect(third.request.status).toBe("src_pending")
  refused(request(), { type: "submit_sourcing" })
})

test("L-approve-src-resta stays pending and approve on draft is not a transition", () => {
  const req = request({
    status: "src_pending",
    sourcing: {
      quotes: [quote()],
      selectedId: "q1",
      fxSnapshot: { USD: 1 },
      approval: { amount: 100, fxRate: 1, steps: [step(), step({ levelId: "L2", levelName: "CIO (Level 2)" })] },
      contractStrategy: "",
    },
  })
  const { result } = call(req, { type: "approve" }, actor("bea", ["buyer"]))
  if (!result.ok) throw new Error(result.code)
  expect(result.request.status).toBe("src_pending")
  expect(result.request.sourcing?.approval?.steps.map((item) => item.status)).toEqual(["approved", "pending"])
  expect(result.request.history.at(-1)?.action).toBe("Sourcing approved by CIO-1 (Level 1)")
  refused(request(), { type: "approve" })
})

test("L-approve-src-ultimo clears issuedAt and does not create a PO", () => {
  const req = request({
    status: "src_pending",
    sourcing: { quotes: [quote()], selectedId: "q1", fxSnapshot: null, approval: { amount: 100, fxRate: 1, steps: [step()] }, contractStrategy: "" },
    po: po({ issuedAt: "old" }),
  })
  const { result } = call(req, { type: "approve" }, actor("bea", ["buyer"]))
  if (!result.ok) throw new Error(result.code)
  expect(result.request.status).toBe("po_draft")
  expect(result.request.po?.issuedAt).toBeNull()
  expect(result.request.po?.number).toBe("PO-2026-0004")
  expect(result.request.history.slice(-2).map((item) => item.action)).toEqual([
    "Sourcing approved by CIO-1 (Level 1)",
    "PO draft generated from selected quotation",
  ])
  expect(result.request.history.at(-1)?.note).toBe("PO-2026-0004")
  const empty = request({
    status: "src_pending",
    sourcing: { quotes: [], selectedId: null, fxSnapshot: null, approval: { amount: 0, fxRate: null, steps: [step()] }, contractStrategy: "" },
  })
  const second = act(empty, { type: "approve" }, actor("bea", ["buyer"]), settings(), AT, ISSUED, null)
  if (!second.ok) throw new Error(second.code)
  expect(second.request.po).toBeNull()
  expect(second.request.history.at(-1)?.note).toBe("")
  refused(request(), { type: "approve" })
})

test("L-reject-src clears the snapshot", () => {
  const req = request({
    status: "src_pending",
    sourcing: { quotes: [quote()], selectedId: "q1", fxSnapshot: { USD: 1 }, approval: { amount: 100, fxRate: 1, steps: [step()] }, contractStrategy: "" },
  })
  const { result } = call(req, { type: "reject", reason: "no" }, actor("bea", ["buyer"]))
  if (!result.ok) throw new Error(result.code)
  expect(result.request.status).toBe("src_rejected")
  expect(result.request.sourcing?.approval?.steps[0].status).toBe("rejected")
  expect(result.request.sourcing?.fxSnapshot).toBeNull()
  expect(result.request.history.at(-1)?.action).toBe("Sourcing rejected by CIO-1 (Level 1)")
  refused(request(), { type: "reject", reason: "no" })
})

test("L-submit-po stores the rate and the amount times that rate", () => {
  const req = request({ status: "po_draft", po: po({ fxRate: null, lines: [{ qty: 2, unitPrice: 10 }] }) })
  const { result } = call(req, { type: "submit_po" }, actor("bea", ["buyer"]))
  if (!result.ok) throw new Error(result.code)
  expect(result.request.status).toBe("po_pending")
  expect(result.request.po?.fxRate).toBe(1)
  expect(result.request.po?.approval?.amount).toBe(20)
  expect(result.request.po?.approval?.fxRate).toBe(1)
  const euro = request({ status: "po_draft", po: po({ currency: "EUR", fxRate: null, lines: [{ qty: 1, unitPrice: 10 }] }) })
  const rated = act(euro, { type: "submit_po" }, actor("bea", ["buyer"]), settings(), AT, ISSUED, null)
  if (!rated.ok) throw new Error(rated.code)
  expect(rated.request.po?.approval?.amount).toBe(10 * 1.08)
  expect(rated.request.po?.approval?.amount).not.toBe(10)
  expect(result.request.po?.approval?.steps.map((item) => item.levelId)).toEqual(["L1"])
  expect(result.request.history.at(-1)?.action).toBe("Purchase order submitted for approval")
  refused(request(), { type: "submit_po" })
})

test("L-approve-po-resta stays pending", () => {
  const req = request({
    status: "po_pending",
    po: po({ approval: { amount: 20, fxRate: 1, steps: [step(), step({ levelId: "L2", levelName: "CIO (Level 2)" })] } }),
  })
  const { result } = call(req, { type: "approve" }, actor("bea", ["buyer"]))
  if (!result.ok) throw new Error(result.code)
  expect(result.request.status).toBe("po_pending")
  expect(result.request.po?.approval?.steps.map((item) => item.status)).toEqual(["approved", "pending"])
  expect(result.request.history.at(-1)?.action).toBe("Purchase order approved by CIO-1 (Level 1)")
  refused(request(), { type: "approve" })
})

test("L-approve-po-ultimo approves and clears issuedAt", () => {
  const req = request({
    status: "po_pending",
    po: po({ issuedAt: "old", approval: { amount: 20, fxRate: 1, steps: [step()] } }),
  })
  const { result } = call(req, { type: "approve" }, actor("bea", ["buyer"]))
  if (!result.ok) throw new Error(result.code)
  expect(result.request.status).toBe("po_approved")
  expect(result.request.po?.issuedAt).toBeNull()
  expect(result.request.po?.number).toBe("PO-2026-0004")
  expect(result.request.history.slice(-2).map((item) => item.action)).toEqual([
    "Purchase order approved by CIO-1 (Level 1)",
    "Purchase order approved",
  ])
  refused(request(), { type: "approve" })
})

test("L-reject-po clears the rate", () => {
  const req = request({
    status: "po_pending",
    po: po({ fxRate: 1, approval: { amount: 20, fxRate: 1, steps: [step()] } }),
  })
  const { result } = call(req, { type: "reject", reason: "no" }, actor("bea", ["buyer"]))
  if (!result.ok) throw new Error(result.code)
  expect(result.request.status).toBe("po_rejected")
  expect(result.request.po?.fxRate).toBeNull()
  expect(result.request.po?.approval?.steps[0].status).toBe("rejected")
  expect(result.request.history.at(-1)?.action).toBe("Purchase order rejected by CIO-1 (Level 1)")
  refused(request(), { type: "reject", reason: "no" })
})

test("L-issue stamps at and does not change the number", () => {
  const req = request({ status: "po_approved", po: po({ issuedAt: null, number: "PO-2026-0004" }) })
  const { result, before } = call(req, { type: "issue" }, actor("bea", ["buyer"]))
  if (!result.ok) throw new Error(result.code)
  expect(result.request.status).toBe("po_issued")
  expect(result.request.po?.issuedAt).toBe(AT)
  expect(result.request.po?.number).toBe("PO-2026-0004")
  expect(result.request.history.at(-1)).toEqual({ at: AT, by: "bea", action: "PO issued internally", note: "PO-2026-0004" })
  expect(req).toEqual(before)
  refused(request(), { type: "issue" })
})

test("L-cancel cancels and leaves every other field", () => {
  const req = request({
    status: "draft",
    sourcing: { quotes: [quote()], selectedId: "q1", fxSnapshot: { USD: 1 }, approval: null, contractStrategy: "new" },
    po: po(),
    extra: "stay",
  })
  const { result, before } = call(req, { type: "cancel", reason: "  stop  " }, actor("ada", ["buyer"]))
  if (!result.ok) throw new Error(result.code)
  expect(result.request.status).toBe("cancelled")
  expect(result.request.history.at(-1)).toEqual({ at: AT, by: "ada", action: "Request cancelled", note: "stop" })
  const { status: _status, history: _history, ...rest } = result.request
  const { status: _beforeStatus, history: _beforeHistory, ...beforeRest } = before as typeof req
  expect(rest).toEqual(beforeRest)
})
