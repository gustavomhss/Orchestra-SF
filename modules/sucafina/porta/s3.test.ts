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

function quote(over: Record<string, unknown> = {}) {
  return {
    id: "q1",
    supplier: "",
    supplierId: "s1" as string | null,
    currency: "USD",
    total: 30000,
    qty: 1,
    unitPrice: 0,
    techPass: true,
    ...over,
  }
}

function sourcingRequest(overQuote: Record<string, unknown> = {}) {
  return {
    number: "PR-2026-0001",
    status: "sourcing" as const,
    createdBy: "ada",
    pr: { estAmount: 0, recurring: false, expenseType: "" },
    prApproval: null,
    sourcing: {
      quotes: [quote(overQuote)],
      selectedId: "q1",
      fxSnapshot: null,
      approval: null,
      contractStrategy: "",
    },
    po: null,
    history: [],
  }
}

test("S3-1 create then submit_pr copies only L1", () => {
  const actor = { id: "ada", canWrite: true, roles: ["requester"] }
  const created = act(null, { type: "create", pr: { estAmount: 52000, recurring: false, expenseType: "" } }, actor, settings(), AT, ISSUED, null)
  if (!created.ok) throw new Error(created.code)
  const submitted = act(created.request, { type: "submit_pr" }, actor, settings(), AT, ISSUED, null)
  if (!submitted.ok) throw new Error(submitted.code)
  expect(submitted.request.prApproval?.steps).toHaveLength(1)
  expect(submitted.request.prApproval?.steps[0].levelId).toBe("L1")
})

test("S3-2 sourcing 30000 USD stays on L1 even in matrix mode", () => {
  const request = sourcingRequest({ total: 30000, currency: "USD" })
  const before = structuredClone(request)
  const result = act(request, { type: "submit_sourcing" }, { id: "bea", canWrite: true, roles: ["buyer"] }, settings({ prApprovalMode: "matrix" }), AT, ISSUED, null)
  if (!result.ok) throw new Error(result.code)
  expect(result.request.sourcing?.approval?.steps.map((step) => step.levelId)).toEqual(["L1"])
  expect(request).toEqual(before)
})

test("S3-3 EUR amount is total times the EUR rate, and steps are L1 then L2", () => {
  const set = settings()
  const rate = set.fxRates.find((item) => item.code === "EUR")?.rate
  if (rate == null) throw new Error("missing EUR")
  const request = sourcingRequest({ total: 40000, currency: "EUR" })
  const result = act(request, { type: "submit_sourcing" }, { id: "bea", canWrite: true, roles: ["buyer"] }, set, AT, ISSUED, null)
  if (!result.ok) throw new Error(result.code)
  expect(result.request.sourcing?.approval?.amount).toBe(40000 * rate)
  expect(result.request.sourcing?.approval?.fxRate).toBe(rate)
  expect(40000 * rate).toBeGreaterThan(30000)
  expect(result.request.sourcing?.approval?.steps.map((step) => step.levelId)).toEqual(["L1", "L2"])
})

test("S3-4 blocked supplier refuses and leaves the input request intact", () => {
  const request = sourcingRequest({ total: 40000, currency: "EUR" })
  const before = structuredClone(request)
  const result = act(request, { type: "submit_sourcing" }, { id: "bea", canWrite: true, roles: ["buyer"] }, settings(), AT, ISSUED, { id: "s1", status: "blocked" })
  expect(result).toEqual({ ok: false, code: "supplier_blocked" })
  expect(request).toEqual(before)
})
