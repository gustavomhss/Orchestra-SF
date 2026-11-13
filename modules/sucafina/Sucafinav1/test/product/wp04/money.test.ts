import { expect, test } from "bun:test"
import { initialProcurementSettings } from "../../../src/initial-settings.ts"
import { procurementDashboard, requestValue } from "../../../src/procurement-screen.ts"
import type { RequestView } from "../../../src/procurement-screen.ts"

test("submitted PO uses its frozen exchange rate and approved and issued totals remain separate", () => {
  const rates = { currency: "USD", fxRates: [{ code: "EUR", rate: 2 }] }
  const approved = { number: "PR-1", status: "po_approved", createdBy: "a", po: { currency: "EUR", fxRate: 1.08, approvalBaseCurrency: "USD", expenseType: "OPEX", lines: [{ qty: 1, unitPrice: 28000 }] } }
  const issued = { number: "PR-2", status: "po_issued", createdBy: "a", po: { currency: "USD", approvalBaseCurrency: "USD", expenseType: "OPEX", lines: [{ qty: 1, unitPrice: 100 }] } }
  const unknown = { number: "PR-3", status: "po_issued", createdBy: "a", po: { currency: "EUR", fxRate: null, expenseType: "CAPEX", lines: [{ qty: 1, unitPrice: 50 }] } }
  expect(requestValue(approved, rates)).toBeCloseTo(30240, 6)
  expect(requestValue(approved, { currency: "EUR", fxRates: [{ code: "USD", rate: 0.9 }] })).toBeNull()
  expect(requestValue(unknown, rates)).toBeNull()
  const dashboard = procurementDashboard([approved, issued, unknown], rates)
  expect(dashboard.approved.OPEX).toBeCloseTo(30240, 6)
  expect(dashboard).toMatchObject({ issued: { OPEX: 100 }, unavailable: ["PR-3"] })
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

test("approval queue retains missing steps and does not invent holder names or actions", async () => {
  const { approvalDecision, myApprovals, procurementScreen } = await import("../../../src/procurement-screen.ts")
  const { render } = await import("../../../runtime/procurement.ts")
  const requests = [
    { number: "PR-no-step", status: "pr_pending", createdBy: "other", prApproval: { amount: 10, steps: [] } },
    { number: "PR-no-approval", status: "src_pending", createdBy: "other" },
    { number: "PR-unknown-stage", status: "legacy_pending", createdBy: "other" },
    { number: "PR-unknown-holder", status: "po_pending", createdBy: "other", po: { approval: { amount: 30, steps: [{ status: "pending", holderId: "missing-person" }] } } },
    { number: "PR-self", status: "pr_pending", createdBy: "buyer", prApproval: { amount: 20, steps: [{ status: "pending", holderId: "buyer" }] } },
  ]
  const queue = myApprovals(requests, "buyer")
  expect(queue.unassigned).toEqual([{ number: "PR-no-approval", amount: null }, { number: "PR-no-step", amount: 10 }, { number: "PR-unknown-stage", amount: null }])
  expect(queue.waitingForYou).toEqual([{ number: "PR-self", amount: 20 }])
  expect(queue.waitingForOthers).toEqual([{ number: "PR-unknown-holder", amount: 30 }])
  const html = render("My approvals", { requests, directory: [], formSettings: { currency: "USD", blockSelfApproval: true } }, { actor: { id: "buyer", roles: ["buyer"], canWrite: true }, year: 2026, month: 1, at: "2026-01-01T00:00:00Z", versions: {} })!
  expect(html).toContain("PR-no-step")
  expect(html).toContain("PR-no-approval")
  expect(html).toContain("Unrecognized approval stage")
  expect(html).toContain("approval step unavailable")
  expect(html).toContain("Responsible person not resolved (missing-person)")
  expect(html).toContain("waiting for the assigned holder")
  expect(html).toContain("self-approval is blocked")
  expect(html).not.toContain("Assigned approver")
  expect(approvalDecision({ number: "PR-empty-holder", status: "pr_pending", createdBy: "other", prApproval: { amount: 10, steps: [{ status: "pending", holderId: "" }] } }, { id: "buyer", roles: ["buyer"], canWrite: true }, false)).toEqual({ allowed: false, reason: "approval holder unavailable" })
  const screen = procurementScreen({ key: "My approvals", actor: { id: "buyer", roles: ["buyer"], canWrite: true }, requests })
  expect(screen.html).toContain("PR-no-approval")
  expect(screen.html).toContain("Approval step unavailable")
  expect(screen.html).toContain("submitted base currency unavailable")
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

test("quote comparison preserves missing currency and frozen FX provenance", async () => {
  const { quoteComparisonPresentation } = await import("../../../src/form.ts")
  const settings = { currency: "USD", fxRates: [{ code: "EUR", rate: 2 }] }
  const sourcing = { quotes: [{ id: "missing-currency", total: 12 }, { id: "euro", currency: "EUR", total: 20 }], fxSnapshot: { EUR: 1.1 } }
  const frozen = quoteComparisonPresentation({ sourcing }, settings, { submitted: true, submittedBaseCurrency: "USD" })
  expect(frozen[0]).toMatchObject({ currency: null, fxRate: null, monetary: ["currency-missing"] })
  expect(frozen[1]).toMatchObject({ currency: "EUR", fxRate: 1.1, monetary: [] })
  const absent = quoteComparisonPresentation({ sourcing: { ...sourcing, fxSnapshot: null } }, settings, { submitted: true, submittedBaseCurrency: "USD" })
  expect(absent[1]).toMatchObject({ fxRate: null, monetary: ["fx-missing"] })
  const changedBase = quoteComparisonPresentation({ sourcing }, settings, { submitted: true, submittedBaseCurrency: "GBP" })
  expect(changedBase[1]).toMatchObject({ fxRate: null, monetary: ["submitted-base-unavailable"] })
})

test("request guidance distinguishes internal issue and unknown stages", async () => {
  const { requestStageGuidance } = await import("../../../src/requests.ts")
  expect(requestStageGuidance("po_approved").next).toContain("awaits internal issue")
  expect(requestStageGuidance("po_issued").stage).toBe("Issued internally")
  expect(requestStageGuidance("constructor")).toEqual({ stage: "Unknown status", next: "Next step unavailable" })
})

test("quote comparison distinguishes an invalid rate from a missing rate", async () => {
  const { quoteComparisonPresentation } = await import("../../../src/form.ts")
  const sourcing = { quotes: [{ id: "q", currency: "EUR", total: 20 }] }
  expect(quoteComparisonPresentation({ sourcing }, { currency: "USD", fxRates: [{ code: "EUR", rate: 0 }] })[0]?.monetary).toContain("fx-invalid")
  expect(quoteComparisonPresentation({ sourcing }, { currency: "USD" })[0]?.monetary).toContain("fx-missing")
})

test("request comparison does not label an unspecified quote currency as base currency", async () => {
  const { render } = await import("../../../runtime/procurement.ts")
  const html = render("Requests", { requests: [{ number: "PR-1", status: "sourcing", createdBy: "a", sourcing: { quotes: [{ id: "q", supplier: "A", total: 90, qty: 2, unitPrice: 40 }] } }], formSettings: { currency: "USD", criteria: [], commCriteria: [] } }, { actor: { id: "a", roles: ["buyer"], canWrite: true }, year: 2026, month: 1, at: "2026-01-01T00:00:00Z", versions: {} })!
  expect(html).toContain("90 Currency unavailable")
  expect(html).toContain("80 Currency unavailable")
  expect(html).toContain("Comparison ranking unavailable")
})

test("supplier activation explains alternative required fields without revealing bank values", async () => {
  const { supplierActivationRequirements } = await import("../../../src/supplier.ts")
  const supplier = { id: "s", status: "pending", legalName: "Vendor", country: "BR", address: "Address", contactEmail: "a@example.com", paymentTerms: "30 days", riskRating: "low", sanctionsDate: "2026-01-01", dueDiligence: true }
  expect(supplierActivationRequirements(supplier)).toEqual(["taxId or regNo", "iban or bankName"])
  expect(supplierActivationRequirements({ ...supplier, regNo: "R1", bankName: "Bank" })).toEqual([])
})

test("order guidance compares the linked selected quote without asserting edit history", async () => {
  const { orderSourceGuidance } = await import("../../../src/requests.ts")
  const request = { sourcing: { selectedId: "q", quotes: [{ id: "q", supplierId: "s", currency: "EUR", qty: 3 }] }, po: { sourceQuoteId: "q", supplierId: "s", currency: "USD", lines: [{ qty: 3 }] } }
  expect(orderSourceGuidance(request)).toEqual({ state: "selected-quote", selectedId: "q", supplier: "equals", currency: "differs", quantity: "equals" })
  expect(orderSourceGuidance({ ...request, po: { ...request.po, sourceQuoteId: "other" } })).toEqual({ state: "unavailable", reason: "source-quote-mismatch" })
})

test("nonprivileged supplier view removes bank metadata and audit values", async () => {
  const { domain } = await import("../../../runtime/procurement.ts")
  const snapshot = { data: { store: { suppliers: [{ id: "s", status: "pending", bankName: "secret bank", accountHolder: "secret holder", bankCountry: "secret country", swift: "secret swift", iban: "secret iban", account: "secret account", history: [{ field: "iban", value: "secret audit" }] }] } }, versions: {}, sequences: {}, audit: [], notices: [] }
  const view = domain.view(snapshot, { id: "buyer", roles: ["buyer"], canWrite: true }, { at: "2026-01-01T00:00:00Z", directory: [], id: () => "unused" })
  expect(JSON.stringify(view.data.suppliers)).not.toContain("secret")
})

test("request detail displays current stage validation without mutating the draft", async () => {
  const { render } = await import("../../../runtime/procurement.ts")
  const draft = { number: "PR-1", status: "draft", createdBy: "a", pr: { title: "My request" } }
  const html = render("Requests", { requests: [draft], formSettings: { currency: "USD" } }, { actor: { id: "a", roles: ["requester"], canWrite: true }, year: 2026, month: 1, at: "2026-01-01T00:00:00Z", versions: {} })!
  expect(html).toContain("Business justification is required")
  expect(draft.pr).toEqual({ title: "My request" })
})

test("requisition rejection returns field errors from the actual validator", async () => {
  const { domain } = await import("../../../runtime/procurement.ts")
  const snapshot = { data: { store: { settings: initialProcurementSettings() } }, versions: {}, sequences: {}, audit: [], notices: [] }
  const actor = { id: "a", roles: ["requester"], canWrite: true }
  const environment = { at: "2026-01-01T00:00:00Z", directory: [], id: () => "unused" }
  expect(domain.execute(snapshot, actor, { page: "Requests", action: "create", version: 0, values: { pr: { title: "Draft" } } }, environment).ok).toBe(true)
  const requests = domain.view(snapshot, actor, environment).data.requests as Record<string, unknown>[]
  const result = domain.execute(snapshot, actor, { page: "Requests", action: "submit_pr", id: String(requests[0]!.number), version: 1, values: {} }, environment)
  expect(result).toMatchObject({ ok: false, status: 422 })
  if (result.ok || !("fieldErrors" in result)) throw new Error("incomplete requisition did not return field errors")
  expect(result.fieldErrors).toContainEqual({ field: "pr.justification", message: "Business justification is required" })
})

test("supplier controls reflect existing buyer and supplier admin roles", async () => {
  const { render } = await import("../../../runtime/procurement.ts")
  const data = { suppliers: [{ id: "s", status: "pending", legalName: "Vendor" }] }
  const context = { year: 2026, month: 1, at: "2026-01-01T00:00:00Z", versions: {} }
  const viewer = render("Suppliers", data, { ...context, actor: { id: "v", roles: ["viewer"], canWrite: true } })!
  const buyer = render("Suppliers", data, { ...context, actor: { id: "b", roles: ["buyer"], canWrite: true } })!
  const admin = render("Suppliers", data, { ...context, actor: { id: "a", roles: ["supplier admin"], canWrite: true } })!
  expect(viewer).not.toContain('data-command="save"')
  expect(buyer).toContain('data-command="create"')
  expect(buyer).not.toContain('data-command="activate"')
  expect(admin).toContain('data-command="activate"')
  expect(admin).not.toContain('data-command="create"')
})

test("supplier presentation removes bank and audit material from a viewer", async () => {
  const { presentSupplier } = await import("../../../src/supplier.ts")
  const supplier = { id: "s", status: "pending", bankName: "secret bank", swift: "secret swift", iban: "secret iban", account: "secret account", history: [{ field: "secret audit" }] }
  const visible = presentSupplier(supplier, { roles: ["viewer"] }, new Uint8Array(32))
  expect(visible).toMatchObject({ id: "s", iban: "masked", account: "masked" })
  expect(JSON.stringify(visible)).not.toContain("secret")
})

test("order shows supplier terms as a suggestion without replacing recorded terms", async () => {
  const { render } = await import("../../../runtime/procurement.ts")
  const request = { number: "PR-1", status: "po_draft", createdBy: "a", po: { supplierId: "s", paymentTerms: "45 days" } }
  const html = render("Requests", { requests: [request], suppliers: [{ id: "s", status: "active", paymentTerms: "30 days" }], formSettings: { currency: "USD" } }, { actor: { id: "a", roles: ["buyer"], canWrite: true }, year: 2026, month: 1, at: "2026-01-01T00:00:00Z", versions: {} })!
  expect(html).toContain("Current supplier master payment terms: 30 days")
  expect(html).toContain("Saved order payment terms: 45 days")
  expect(request.po.paymentTerms).toBe("45 days")
})
