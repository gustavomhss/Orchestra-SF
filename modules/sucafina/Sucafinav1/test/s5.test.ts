import { expect, test } from "bun:test"
import { act } from "../../porta/act.ts"
import {
  approve,
  cancel,
  createRequest,
  createSupplier,
  deleteDraft,
  issue,
  nextSup,
  reject,
  selectQuote,
  submitPO,
  submitPR,
  submitSourcing,
} from "../src/procurement.ts"
import type { Store } from "../src/procurement.ts"

const AT = "2026-11-10T12:00:00Z"
const IDS = ["S5-seq", "S5-form", "S5-reval", "S5-del", "S5-ver", "S5-sup"]

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

function store(over: Partial<Store> = {}): Store {
  return {
    settings: settings(),
    form: {
      currency: "USD",
      fxRates: settings().fxRates,
      minQuotes: 3,
      requireActiveSupplier: false,
      techWeight: 60,
      commWeight: 40,
      criteria: [{ weight: 100 }],
      commCriteria: [{ weight: 100, auto: true }],
    },
    issued: { pr: [], po: [] },
    sup: [],
    suppliers: [],
    requests: {},
    actCalls: 0,
    lastIssued: null,
    ...over,
  }
}

function draft(over: Record<string, unknown> = {}) {
  return {
    number: "PR-2026-0001",
    status: "draft",
    createdBy: "ada",
    pr: {
      estAmount: 100,
      recurring: false,
      expenseType: "OPEX",
      title: "EDR",
      type: "Service",
      description: "EDR",
      costCenter: "IT",
      needBy: "2026-12-01",
      justification: "Need",
    },
    prApproval: null,
    sourcing: null,
    po: null,
    history: [],
    ...over,
  }
}

test("S5 registry", async () => {
  const text = await Bun.file(new URL(import.meta.url)).text()
  for (const id of IDS) expect(text).toContain(`test("${id}`)
})

test("S5-seq the product calls act once, above the imported maximum, and does not repeat the list", () => {
  const issued = {
    pr: ["PR-2026-0007", "not-a-number", "PR-2025-0099"],
    po: ["PO-2026-0003"],
  }
  const same = act(
    null,
    { type: "create", pr: { estAmount: 1, recurring: false, expenseType: "" } },
    actor("ada", ["requester"]),
    settings(),
    AT,
    issued,
    null,
  )
  const again = act(
    null,
    { type: "create", pr: { estAmount: 1, recurring: false, expenseType: "" } },
    actor("ada", ["requester"]),
    settings(),
    AT,
    issued,
    null,
  )
  if (!same.ok || !again.ok) throw new Error("door create failed")
  expect(same.request.number).toBe(again.request.number)
  expect(same.request.number).toBe("PR-2026-0008")

  const saved = store({ issued: { pr: [...issued.pr], po: [...issued.po] } })
  const first = createRequest(
    saved,
    {
      type: "create",
      pr: { estAmount: 10, recurring: false, expenseType: "" },
    },
    actor("ada", ["requester"]),
    AT,
  )
  if (!first.ok) throw new Error(first.code)
  expect(first.request.number).toBe("PR-2026-0008")
  expect(saved.actCalls).toBe(1)
  expect(saved.lastIssued?.pr).toEqual(issued.pr)
  expect(saved.issued.pr).toContain("PR-2026-0008")
  expect(saved.issued.po).toContain("PO-2026-0003")

  const second = createRequest(
    saved,
    {
      type: "create",
      pr: { estAmount: 10, recurring: false, expenseType: "" },
    },
    actor("ada", ["requester"]),
    AT,
  )
  if (!second.ok) throw new Error(second.code)
  expect(second.request.number).toBe("PR-2026-0009")
  expect(saved.actCalls).toBe(2)
  expect(saved.lastIssued?.pr).toContain("PR-2026-0008")
  expect(saved.lastIssued?.pr).toContain("PR-2026-0007")
  expect(second.request.number).not.toBe(first.request.number)

  const nextYear = createRequest(
    saved,
    { type: "create", pr: { estAmount: 1, recurring: false, expenseType: "" } },
    actor("ada", ["requester"]),
    "2027-01-01T00:00:00Z",
  )
  if (!nextYear.ok) throw new Error(nextYear.code)
  expect(nextYear.request.number).toBe("PR-2027-0001")
  expect(nextYear.request.number).not.toBe("PR-2026-0010")
  expect(saved.issued.po).toContain("PO-2026-0003")
})

test("S5-form a failing list does not call act, and a non-empty wrong expense type is not that list", () => {
  const saved = store({
    requests: { "PR-2026-0001": { version: 1, by: "ada", request: draft() } },
  })
  const failed = submitPR(
    saved,
    "PR-2026-0001",
    1,
    actor("ada", ["requester"]),
    AT,
    draft({ pr: { estAmount: 0, recurring: true, expenseType: "" } }),
  )
  expect(failed).toEqual({
    ok: false,
    errors: [
      "Title is required",
      "Type (product / service) is required",
      "Description of product or service is required",
      "Estimated amount is required",
      "Cost centre is required",
      "Needed by date is required",
      "Business justification is required",
      "Recurrence frequency is required",
      "Estimated annual value is required",
    ],
  })
  expect(saved.actCalls).toBe(0)
  expect(saved.requests["PR-2026-0001"].request.status).toBe("draft")

  const inactive = submitSourcing(saved, "PR-2026-0001", 1, actor("bea", ["buyer"]), AT, {
    pr: { recurring: false },
    sourcing: {
      quotes: [
        {
          id: "q1",
          supplier: "Acme",
          supplierId: "s1",
          currency: "USD",
          total: 10,
          techPass: true,
          scores: [5],
          cscores: [],
        },
      ],
      evaluator: "Ada",
      selectedId: "q1",
      contractStrategy: "new",
      weights: {
        tech: 60,
        comm: 40,
        criteria: [{ weight: 100 }],
        commCriteria: [{ weight: 100, auto: true }],
      },
    },
  })
  saved.suppliers = [{ id: "s1", status: "inactive", legalName: "Acme" }]
  const blockedOff = submitSourcing(saved, "PR-2026-0001", 1, actor("bea", ["buyer"]), AT, {
    pr: { recurring: false },
    sourcing: {
      quotes: [
        {
          id: "q1",
          supplier: "Acme",
          supplierId: "s1",
          currency: "USD",
          total: 10,
          techPass: true,
          scores: [5],
        },
      ],
      evaluator: "Ada",
      selectedId: "q1",
      contractStrategy: "new",
      weights: {
        tech: 60,
        comm: 40,
        criteria: [{ weight: 100 }],
        commCriteria: [{ weight: 100, auto: true }],
      },
    },
  })
  expect(saved.form.requireActiveSupplier).toBe(false)
  expect(blockedOff).toMatchObject({ ok: false })
  if (!("errors" in blockedOff)) throw new Error("expected the list")
  expect(blockedOff.errors).toContain("Selected supplier Acme is inactive in the supplier master")
  expect(saved.actCalls).toBe(0)
  expect(inactive.ok).toBe(false)

  const po = {
    number: "PO-2026-0001",
    currency: "USD",
    fxRate: null,
    expenseType: "opex",
    supplier: "Acme",
    supplierId: null,
    sourceQuoteId: "q1",
    lines: [{ qty: 1, unitPrice: 10 }],
    approval: null,
    issuedAt: null,
    description: "EDR",
    paymentTerms: "30",
    deliveryDate: "2026-12-01",
    deliveryConditions: "Site",
  }
  const forged = submitPO(saved, "PR-2026-0001", 1, actor("bea", ["buyer"]), AT, draft({ status: "po_draft", po }))
  expect(forged).toEqual({ ok: false, code: "not_a_transition" })
  expect(saved.requests["PR-2026-0001"].request.status).toBe("draft")
  expect(saved.actCalls).toBe(1)
  saved.requests["PR-2026-0001"].request = draft({
    status: "po_draft",
    po: { ...po, expenseType: "OPEX" },
  })
  const passed = submitPO(saved, "PR-2026-0001", 1, actor("bea", ["buyer"]), AT, draft({ status: "draft", po }))
  expect(passed).toEqual({ ok: false, code: "no_expense_type" })
  expect(saved.actCalls).toBe(2)
  expect(saved.requests["PR-2026-0001"].version).toBe(1)
  expect(saved.requests["PR-2026-0001"].request.status).toBe("po_draft")
  const emptyType = submitPO(
    saved,
    "PR-2026-0001",
    1,
    actor("bea", ["buyer"]),
    AT,
    draft({ status: "po_draft", po: { ...po, expenseType: "" } }),
  )
  if (!("errors" in emptyType)) throw new Error("expected the form list")
  expect(emptyType.errors).toContain("Mark the PO as OPEX or CAPEX")
  expect(saved.actCalls).toBe(2)
  saved.form.minQuotes = 1
  saved.requests["PR-2026-0001"].request = draft({ status: "sourcing" })
  const sourcing = submitSourcing(saved, "PR-2026-0001", 1, actor("bea", ["buyer"]), AT, {
    number: "PR-2026-0001",
    status: "sourcing",
    createdBy: "ada",
    pr: { estAmount: 10, recurring: false, expenseType: "" },
    prApproval: null,
    po: null,
    history: [],
    sourcing: {
      quotes: [
        {
          id: "q1",
          supplier: "Acme",
          supplierId: null,
          currency: "USD",
          total: 10,
          qty: 1,
          unitPrice: 10,
          techPass: true,
          scores: [5],
          evaluatorNote: "extra",
        },
      ],
      evaluator: "Ada",
      selectedId: "q1",
      contractStrategy: "",
      weights: {
        tech: 60,
        comm: 40,
        criteria: [{ weight: 100 }],
        commCriteria: [{ weight: 100, auto: true }],
      },
      fewQuotesJustification: "",
    },
  })
  if (!sourcing.ok) throw new Error("code" in sourcing ? sourcing.code : "form refused a valid sourcing submit")
  expect(saved.actCalls).toBe(3)
  expect(saved.requests["PR-2026-0001"].request.status).toBe("src_pending")
  expect(saved.requests["PR-2026-0001"].rank?.[0]).toEqual({
    id: "q1",
    rank: 1,
    overall: 100,
  })
  expect(JSON.stringify(saved.requests["PR-2026-0001"].request)).not.toContain('"rank"')
})

test("S5-reval issue and cancel are re-read before act", () => {
  const po = {
    number: "PO-2026-0004",
    currency: "USD",
    fxRate: 1,
    expenseType: "OPEX",
    supplier: "Acme",
    supplierId: null,
    sourceQuoteId: "q1",
    lines: [{ qty: 1, unitPrice: 10 }],
    approval: null,
    issuedAt: null,
  }
  const saved = store({
    requests: {
      draft: { version: 1, by: "ada", request: draft() },
      ready: {
        version: 3,
        by: "bea",
        request: draft({ status: "po_approved", po }),
      },
      issued: {
        version: 2,
        by: "bea",
        request: draft({ status: "po_issued", po }),
      },
      dead: { version: 2, by: "ada", request: draft({ status: "cancelled" }) },
    },
  })
  expect(issue(saved, "draft", 1, actor("bea", ["buyer"]), AT)).toEqual({
    ok: false,
  })
  expect(issue(saved, "ready", 3, actor("ada", ["requester"]), AT)).toEqual({
    ok: false,
  })
  expect(cancel(saved, "issued", 2, actor("ada", ["admin"]), AT, "stop")).toEqual({ ok: false })
  expect(cancel(saved, "dead", 2, actor("ada", ["admin"]), AT, "stop")).toEqual({ ok: false })
  expect(cancel(saved, "draft", 1, actor("bea", ["buyer"]), AT, "stop")).toEqual({ ok: false })
  expect(saved.actCalls).toBe(0)
  expect(saved.requests.draft.request.status).toBe("draft")
  expect(saved.requests.issued.request.status).toBe("po_issued")

  const cancelled = cancel(saved, "draft", 1, actor("ada", ["requester"]), AT, "  stop  ")
  if (!cancelled.ok) throw new Error("code" in cancelled ? cancelled.code : "refused")
  expect(saved.actCalls).toBe(1)
  expect(saved.requests.draft.request.status).toBe("cancelled")
  expect(saved.requests.draft.by).toBe("ada")

  const issued = issue(saved, "ready", 3, actor("bea", ["buyer"]), AT)
  if (!issued.ok) throw new Error("code" in issued ? issued.code : "refused")
  expect(saved.requests.ready.request.status).toBe("po_issued")
  expect(saved.actCalls).toBe(2)
})

test("S5-del only a draft, by its creator or an admin, and not through act", () => {
  const saved = store({
    requests: {
      mine: { version: 1, by: "ada", request: draft() },
      other: { version: 1, by: "ada", request: draft({ createdBy: "ada" }) },
      live: { version: 1, by: "ada", request: draft({ status: "sourcing" }) },
    },
  })
  expect(deleteDraft(saved, "live", 1, actor("ada", ["admin"]))).toEqual({
    ok: false,
  })
  expect(saved.requests.live.request.status).toBe("sourcing")
  expect(deleteDraft(saved, "other", 1, actor("bea", ["buyer"]))).toEqual({
    ok: false,
  })
  expect(deleteDraft(saved, "mine", 1, actor("ada", ["requester"]))).toEqual({
    ok: true,
  })
  expect(saved.requests.mine).toBeUndefined()
  expect(deleteDraft(saved, "other", 1, actor("cio", ["admin"]))).toEqual({
    ok: true,
  })
  expect(saved.requests.other).toBeUndefined()
  expect(saved.actCalls).toBe(0)
})

test("S5-ver an old version does not apply the transition and returns who wrote the stored value", () => {
  const body = draft()
  const saved = store({
    requests: { "PR-2026-0001": { version: 4, by: "bea", request: body } },
  })
  const result = submitPR(saved, "PR-2026-0001", 3, actor("ada", ["requester"]), AT, body)
  expect(result).toEqual({ ok: false, stored: body, by: "bea" })
  expect(saved.actCalls).toBe(0)
  expect(saved.requests["PR-2026-0001"].version).toBe(4)
  expect(deleteDraft(saved, "PR-2026-0001", 1, actor("ada", ["admin"]))).toEqual({ ok: false, stored: body, by: "bea" })
  expect(saved.requests["PR-2026-0001"].request).toBe(body)
})

test("S5-sup is minted on supplier creation, not by act, and does not restart at 1", () => {
  const saved = store({ sup: ["SUP-00009", "nope"] })
  expect(nextSup([])).toBe("SUP-00001")
  const buyer = actor("bea", ["buyer"])
  expect(createSupplier(saved, actor("ada", ["requester"]))).toEqual({
    ok: false,
  })
  expect(createSupplier(saved, actor("cio", ["admin"]))).toEqual({ ok: false })
  expect(createSupplier(saved, actor("bea", ["buyer"], false))).toEqual({
    ok: false,
  })
  expect(saved.sup).toEqual(["SUP-00009", "nope"])
  const created = createSupplier(saved, buyer)
  expect(created).toEqual({ ok: true, number: "SUP-00010" })
  expect(saved.sup).toEqual(["SUP-00009", "nope", "SUP-00010"])
  const next = createSupplier(saved, buyer)
  expect(next.number).toBe("SUP-00011")
  expect(next.number).not.toBe("SUP-00001")
  expect(saved.actCalls).toBe(0)
})

test("stored status decides the transition; a string amount is a number; rank stays beside the request", () => {
  const quote = {
    id: "q1",
    supplier: "Acme",
    supplierId: null,
    currency: "USD",
    total: "10",
    qty: "2",
    unitPrice: "5",
    techPass: true,
    scores: [5],
  }
  const other = {
    id: "q2",
    supplier: "Beta",
    supplierId: null,
    currency: "USD",
    total: 20,
    qty: 1,
    unitPrice: 20,
    techPass: true,
    scores: [5],
  }
  const sourcing = {
    quotes: [quote, other],
    evaluator: "Ada",
    selectedId: "q1",
    contractStrategy: "",
    weights: {
      tech: 60,
      comm: 40,
      criteria: [{ weight: 100 }],
      commCriteria: [{ weight: 100, auto: true }],
    },
  }
  const saved = store({
    form: {
      currency: "USD",
      fxRates: settings().fxRates,
      minQuotes: 1,
      techWeight: 60,
      commWeight: 40,
      criteria: [{ weight: 100 }],
      commCriteria: [{ weight: 100, auto: true }],
    },
    requests: {
      live: {
        version: 2,
        by: "ada",
        request: draft({
          status: "sourcing",
          sourcing: {
            quotes: [],
            selectedId: null,
            fxSnapshot: null,
            approval: null,
            contractStrategy: "",
          },
        }),
      },
      pending: {
        version: 4,
        by: "ada",
        request: draft({
          status: "pr_pending",
          prApproval: {
            amount: 100,
            fxRate: null,
            steps: [
              {
                levelId: "L1",
                levelName: "CIO-1 (Level 1)",
                threshold: 0,
                holderId: "zoe",
                status: "pending",
              },
            ],
          },
        }),
      },
    },
  })
  const forged = submitSourcing(saved, "live", 2, actor("bea", ["buyer"]), AT, {
    status: "po_draft",
    po: {
      description: "EDR",
      paymentTerms: "30",
      lines: [{ qty: 1, unitPrice: 10, note: "extra" }],
    },
    sourcing,
  })
  if (!forged.ok) throw new Error("code" in forged ? forged.code : "form refused")
  expect(saved.requests.live.request.status).toBe("src_pending")
  const po = saved.requests.live.request.po as {
    lines: { qty: number }[]
    sourceQuoteId: string
  }
  expect(po.lines[0].qty).toBe(2)
  expect(po.sourceQuoteId).toBe("q1")
  expect(saved.requests.live.rank).toEqual([
    { id: "q1", rank: 1, overall: 100 },
    { id: "q2", rank: 2, overall: 80 },
  ])
  expect(JSON.stringify(saved.requests.live.request.sourcing)).not.toContain("scores")
  expect(approve(saved, "pending", 1, actor("zoe", ["buyer"]), AT)).toEqual({
    ok: false,
    stored: saved.requests.pending.request,
    by: "ada",
  })
  expect(saved.actCalls).toBe(1)
  const decided = approve(saved, "pending", 4, actor("zoe", ["buyer"]), AT, "ok")
  if (!decided.ok) throw new Error(JSON.stringify(decided))
  expect(saved.requests.pending.request.status).toBe("sourcing")
  const missed = selectQuote(saved, "pending", 5, actor("bea", ["buyer"]), AT, "missing")
  expect(missed).toEqual({ ok: false, code: "no_quote" })
  expect(saved.requests.pending.request.status).toBe("sourcing")
  expect(reject(saved, "pending", 5, actor("ada", ["requester"], false), AT, "no")).toEqual({ ok: false })
  expect(saved.requests.pending.request.status).toBe("sourcing")
})
