import { expect, test } from "bun:test"
import { procurementDashboard, requestValue } from "../../../src/procurement-screen.ts"
import type { RequestView } from "../../../src/procurement-screen.ts"

test("submitted PO uses its frozen exchange rate and approved and issued totals remain separate", () => {
  const rates = { currency: "USD", fxRates: [{ code: "EUR", rate: 2 }] }
  const approved = { number: "PR-1", status: "po_approved", createdBy: "a", po: { currency: "EUR", fxRate: 1.08, approvalBaseCurrency: "USD", expenseType: "OPEX", lines: [{ qty: 1, unitPrice: 28000 }] } }
  const issued = { number: "PR-2", status: "po_issued", createdBy: "a", po: { currency: "USD", approvalBaseCurrency: "USD", expenseType: "OPEX", lines: [{ qty: 1, unitPrice: 100 }] } }
  const unknown = { number: "PR-3", status: "po_issued", createdBy: "a", po: { currency: "EUR", fxRate: null, expenseType: "CAPEX", lines: [{ qty: 1, unitPrice: 50 }] } }
  expect(requestValue(approved, rates)).toBe(30240)
  expect(requestValue(approved, { currency: "EUR", fxRates: [{ code: "USD", rate: 0.9 }] })).toBeNull()
  expect(requestValue(unknown, rates)).toBeNull()
  expect(procurementDashboard([approved, issued, unknown], rates)).toMatchObject({ approved: { OPEX: 30240 }, issued: { OPEX: 100 }, unavailable: ["PR-3"] })
})

test("an unavailable frozen quote rate does not use a later rate or the requisition estimate", () => {
  expect(requestValue({ status: "src_pending", createdBy: "a", pr: { estAmount: 100 }, sourcing: { selectedId: "q", fxSnapshot: { EUR: null }, quotes: [{ id: "q", currency: "EUR", total: 50 }] } }, { currency: "USD", fxRates: [{ code: "EUR", rate: 2 }] })).toBeNull()
  expect(requestValue({ status: "src_pending", createdBy: "a", pr: { estAmount: 100 }, sourcing: { selectedId: "q", fxSnapshot: null, quotes: [{ id: "q", currency: "EUR", total: 50 }] } }, { currency: "USD", fxRates: [{ code: "EUR", rate: 2 }] })).toBeNull()
  expect(requestValue({ status: "src_pending", createdBy: "a", sourcing: { selectedId: "q", fxSnapshot: { EUR: 1.08 }, quotes: [{ id: "q", currency: "EUR", total: 50 }] } }, { currency: "USD" })).toBeNull()
  expect(requestValue({ status: "src_pending", createdBy: "a", sourcing: { selectedId: "q", approvalBaseCurrency: "USD", fxSnapshot: { EUR: 1.08 }, quotes: [{ id: "q", currency: "EUR", total: 50 }] } }, { currency: "USD" })).toBe(54)
})

test("approval view separates unassigned holders and labels the pending decision", async () => {
  const { render } = await import("../../../runtime/procurement.ts")
  const html = render("My approvals", { formSettings: { currency: "USD" }, requests: [{ number: "PR-1", status: "src_pending", history: [{ action: "Sourcing submitted for approval", at: "2026-01-01T00:00:00Z" }], sourcing: { approvalBaseCurrency: "USD", approval: { amount: 120, steps: [{ status: "pending", holderId: null }] } } }] }, { actor: { id: "buyer", roles: ["buyer"], canWrite: true }, year: 2026, month: 1, at: "2026-01-01T00:00:00Z", versions: {} })!
  expect(html).toContain("Unassigned")
  expect(html).toContain("Sourcing selection")
  expect(html).toContain("120 USD")
  expect(html).toContain("2026-01-01T00:00:00Z")
})

test("request detail shows the discrepancy without changing the quoted total", async () => {
  const { render } = await import("../../../runtime/procurement.ts")
  const request = { number: "PR-1", status: "sourcing", createdBy: "a", sourcing: { selectedId: "q", quotes: [{ id: "q", supplier: "A", currency: "USD", total: 90, qty: 2, unitPrice: 40 }] } }
  const html = render("Requests", { requests: [request], formSettings: { currency: "USD", criteria: [], commCriteria: [] } }, { actor: { id: "a", roles: ["buyer"], canWrite: true }, year: 2026, month: 1, at: "2026-01-01T00:00:00Z", versions: {} })!
  expect(html).toContain("stated total 90")
  expect(html).toContain("unit price 80 USD")
  expect(html).toContain("80 USD (differs)")
  expect(html).toContain("Comparison is limited")
  expect(request.sourcing.quotes[0]?.total).toBe(90)
})

test("register export removes bank material recursively including audit values", async () => {
  const { exportRegister } = await import("../../../src/procurement-screen.ts")
  const exported = exportRegister([{ number: "PR-1", status: "draft", createdBy: "a", po: { account: "secret", swift: "secret", iban: "secret", bankName: "secret" }, history: [{ field: "account", value: "secret" }] } as unknown as RequestView])
  expect(JSON.stringify(exported)).not.toContain("secret")
})

test("request detail explains why a different holder cannot be overridden", async () => {
  const { render } = await import("../../../runtime/procurement.ts")
  const html = render("Requests", { formSettings: { currency: "USD" }, requests: [{ number: "PR-1", status: "pr_pending", createdBy: "a", prApproval: { amount: 10, steps: [{ status: "pending", holderId: "holder" }] } }] }, { actor: { id: "admin", roles: ["admin"], canWrite: true }, year: 2026, month: 1, at: "2026-01-01T00:00:00Z", versions: {} })!
  expect(html).toContain("waiting for the assigned holder")
  expect(html).not.toContain('value="approve"')
})

test("unassigned approvals are not attributed to another holder", async () => {
  const { myApprovals } = await import("../../../src/procurement-screen.ts")
  const queue = myApprovals([{ number: "PR-1", status: "pr_pending", createdBy: "a", prApproval: { amount: 10, steps: [{ holderId: null, status: "pending" }] } }], "a")
  expect(queue.waitingForYou).toEqual([])
  expect(queue.waitingForOthers).toEqual([])
  expect(queue.unassigned).toEqual([{ number: "PR-1", amount: 10 }])
})

test("ranking does not replace a missing submitted FX snapshot with a later rate", async () => {
  const { quoteAssessment } = await import("../../../src/form.ts")
  const result = quoteAssessment({ sourcing: { fxSnapshot: { EUR: null }, quotes: [{ id: "q", currency: "EUR", total: 100, techPass: true }] } }, { currency: "USD", fxRates: [{ code: "EUR", rate: 2 }], techWeight: 60, commWeight: 40, criteria: [], commCriteria: [] })
  expect(result[0]?.eligible).toBe(false)
  expect(result[0]?.rank).toBeNull()
  const base = quoteAssessment({ sourcing: { fxSnapshot: { EUR: 1.08 }, quotes: [{ id: "base", currency: "USD", total: 100, techPass: true }] } }, { currency: "USD", techWeight: 60, commWeight: 40, criteria: [], commCriteria: [] })
  expect(base[0]?.eligible).toBe(true)
})

test("comparison displays the submitted rate even after the current rate changes", async () => {
  const { render } = await import("../../../runtime/procurement.ts")
  const request = { number: "PR-1", status: "src_pending", createdBy: "a", sourcing: { approvalBaseCurrency: "USD", fxSnapshot: { EUR: 1.08 }, quotes: [{ id: "q", supplier: "A", currency: "EUR", total: 28000 }] } }
  const html = render("Requests", { requests: [request], formSettings: { currency: "USD", fxRates: [{ code: "EUR", rate: 2 }] } }, { actor: { id: "a", roles: ["buyer"], canWrite: true }, year: 2026, month: 1, at: "2026-01-01T00:00:00Z", versions: {} })!
  expect(html).toContain("30240 USD (submitted FX: 1.08)")
})

test("submitted sourcing without a snapshot does not display live FX as historical", async () => {
  const { render } = await import("../../../runtime/procurement.ts")
  const request = { number: "PR-1", status: "src_pending", createdBy: "a", sourcing: { fxSnapshot: null, quotes: [{ id: "q", supplier: "A", currency: "EUR", total: 28000 }] } }
  const html = render("Requests", { requests: [request], formSettings: { currency: "USD", fxRates: [{ code: "EUR", rate: 2 }] } }, { actor: { id: "a", roles: ["buyer"], canWrite: true }, year: 2026, month: 1, at: "2026-01-01T00:00:00Z", versions: {} })!
  expect(html).not.toContain("56000 USD")
  expect(html).toContain("Unavailable")
})

test("invalid PO or selected quote values remain unavailable rather than falling back", () => {
  const rates = { currency: "USD" }
  expect(requestValue({ status: "po_draft", createdBy: "a", pr: { estAmount: 10 }, po: { currency: "USD", lines: [{ qty: 1, unitPrice: Number.NaN }] } }, rates)).toBeNull()
  expect(requestValue({ status: "sourcing", createdBy: "a", pr: { estAmount: 10 }, sourcing: { selectedId: "q", quotes: [{ id: "q", total: Number.NaN, currency: "USD" }] } }, rates)).toBeNull()
})
