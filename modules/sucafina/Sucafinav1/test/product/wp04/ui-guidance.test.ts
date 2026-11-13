import { expect, test } from "bun:test"
import { initialProcurementSettings } from "../../../src/initial-settings.ts"
import { validatePO } from "../../../src/form.ts"
import { requestValue } from "../../../src/procurement-screen.ts"
import type { RequestView } from "../../../src/procurement-screen.ts"
import { presentProcurementFieldErrors, purchaseOrderFieldSources, sourcingFieldErrors } from "../../../product/procurement/guided-request.ts"
import { domain, render } from "../../../runtime/procurement.ts"
import type { Snapshot } from "../../../runtime/contract.ts"

const at = "2026-11-13T12:00:00Z"
const actor = { id: "buyer", roles: ["buyer"], canWrite: true }
const context = { actor, year: 2026, month: 11, at, versions: {} }

test("sourcing identifies the missing commercial control without blaming completed technical scores", () => {
  const settings = initialProcurementSettings()
  const sourcing = {
    selectedId: "q1",
    evaluator: "reviewer",
    fewQuotesJustification: "Only one supplier serves this specification",
    quotes: [{ id: "q1", supplier: "Supplier", currency: "USD", total: 100, scores: [5, 5, 5, 5, 5], cscores: [null, 4, null] }],
  }
  expect(sourcingFieldErrors({ sourcing }, settings, [])).toEqual([{ field: "sourcing.quotes.0.cscores.2", message: "Quote 1: technical / commercial scores incomplete" }])
  const request = { number: "PR-2026-00001", status: "sourcing", createdBy: "owner", sourcing }
  const html = render("Requests", { requests: [request], formSettings: settings }, context)!
  expect(html).toContain('data-error-for="sourcing.quotes.0.cscores.2"')
  expect(html).toContain('aria-describedby="PR-2026-00001-save-error-sourcing.quotes.0.cscores.2"')
  expect(html).not.toContain('data-error-for="sourcing.quotes.0.scores.0"')
  expect(html).toContain('data-request-summary="PR-2026-00001"')
})

test("adjacent error text is escaped and field ids remain separate across requests", () => {
  const markup = '<label>Title<input name="pr.title" value="preserved"></label>'
  const errors = [{ field: "pr.title", message: '<script>alert("x")</script> $& $`' }]
  const first = presentProcurementFieldErrors(markup, errors, "PR-1-save")
  const second = presentProcurementFieldErrors(markup, errors, "PR-2-save")
  expect(first).toContain('value="preserved"')
  expect(first).toContain('aria-invalid="true"')
  expect(first).toContain("&lt;script&gt;")
  expect(first).not.toContain("<script>")
  expect(first).toContain("$&amp; $`")
  expect(first).not.toEqual(second)
})

test("saved order terms survive source suggestions and ambiguous supplier identity supplies no terms", () => {
  const request = {
    sourcing: { selectedId: "q1", quotes: [{ id: "q1", supplier: "Selected vendor", currency: "EUR", qty: 3, unitPrice: 20 }] },
    po: { sourceQuoteId: "q1", supplierId: "s1", supplier: "Selected vendor", currency: "EUR", lines: [{ qty: 3, unitPrice: 20 }], paymentTerms: "Negotiated 45 days", deliveryAddress: "Negotiated warehouse" },
  }
  const before = structuredClone(request)
  const suppliers = [{ id: "s1", paymentTerms: "Net 30" }]
  const settings = { billingAddress: "Configured billing", defaultDeliveryAddress: "Configured warehouse" }
  const result = purchaseOrderFieldSources(request, settings, suppliers)
  expect(result.fields.find((field) => field.field === "po.paymentTerms")).toMatchObject({ current: "Negotiated 45 days", candidate: "Net 30", origin: "Current supplier master suggestion", relation: "different" })
  expect(result.fields.find((field) => field.field === "po.deliveryAddress")).toMatchObject({ current: "Negotiated warehouse", candidate: "Configured warehouse", origin: "Configured default suggestion" })
  expect(result.fields.find((field) => field.field === "po.currency")).toMatchObject({ current: "EUR", candidate: "EUR", relation: "same" })
  expect(request).toEqual(before)
  const ambiguous = purchaseOrderFieldSources(request, settings, [...suppliers, { id: "s1", paymentTerms: "Net 60" }])
  expect(ambiguous.fields.find((field) => field.field === "po.paymentTerms")?.candidate).toBeNull()
})

test("recurring draft values survive collapsing and saving the nonrecurring section", () => {
  const state: Snapshot = { data: { store: { settings: initialProcurementSettings() } }, versions: {}, sequences: {}, audit: [], notices: [] }
  const requester = { id: "owner", roles: ["requester"], canWrite: true }
  const environment = { at, directory: [], id: () => "unused" }
  const created = domain.execute(state, requester, { page: "Requests", action: "create", version: 0, values: { pr: { title: "Renewal", recurring: true, frequency: "Monthly", estAnnual: 1200 } } }, environment)
  expect(created.ok).toBe(true)
  const first = domain.view(state, requester, environment).data.requests as Record<string, unknown>[]
  const id = String(first[0]!.number)
  expect(domain.execute(state, requester, { page: "Requests", action: "save", id, version: 1, values: { pr: { recurring: false } } }, environment).ok).toBe(true)
  const view = domain.view(state, requester, environment)
  const saved = (view.data.requests as Record<string, unknown>[])[0]!
  expect(saved.pr).toMatchObject({ recurring: false, frequency: "Monthly", estAnnual: 1200 })
  const html = render("Requests", view.data, { ...context, actor: requester, versions: view.versions })!
  expect(html).toContain("Recurrence details (saved values retained)")
  expect(html).toContain('name="pr.frequency" type="text" value="Monthly"')
  expect(html).toContain('name="pr.estAnnual" type="number" value="1200"')
  const rejected = domain.execute(state, requester, { page: "Requests", action: "submit_pr", id, version: 2, values: { pr: { recurring: true, frequency: "" } } }, environment)
  expect(rejected).toMatchObject({ ok: false, status: 422, fieldErrors: expect.arrayContaining([{ field: "pr.frequency", message: "Recurrence frequency is required" }]) })
})

test("contract strategy changes preserve saved references and existing-contract submission uses the real validator", () => {
  const settings = initialProcurementSettings()
  const environment = { at, directory: [], id: () => "unused" }
  const request = {
    number: "PR-2026-00001", status: "sourcing", createdBy: "owner", createdAt: at,
    pr: { recurring: true, frequency: "Monthly", estAnnual: 1200 },
    sourcing: { contractStrategy: "existing", selectedId: null, quotes: [] },
    po: { supplier: "Saved vendor", supplierId: null, currency: "USD", description: "Saved service", lines: [{ desc: "Service", qty: 1, unitPrice: 100 }], paymentTerms: "Net 30", expenseType: "OPEX", deliveryDate: "2026-12-01", deliveryConditions: "Remote", contractRef: "SAVED-CONTRACT", assetRef: "SAVED-ASSET" },
  }
  const state: Snapshot = {
    data: { store: { settings, suppliers: [], requests: { [request.number]: { request, version: 1, by: actor.id } } } },
    versions: { [`requests:${request.number}`]: { version: 1, by: actor.id } }, sequences: {}, audit: [], notices: [],
  }
  for (const contractStrategy of ["new", "existing"]) {
    const saved = domain.execute(state, actor, { page: "Requests", action: "save", id: request.number, version: state.versions[`requests:${request.number}`]!.version, values: { sourcing: { contractStrategy } } }, environment)
    expect(saved.ok).toBe(true)
    const view = domain.view(state, actor, environment)
    const current = (view.data.requests as typeof request[])[0]!
    expect(current.sourcing.contractStrategy).toBe(contractStrategy)
    expect(current.po).toMatchObject({ contractRef: "SAVED-CONTRACT", assetRef: "SAVED-ASSET", paymentTerms: "Net 30" })
    expect(current.pr).toMatchObject({ recurring: true, frequency: "Monthly", estAnnual: 1200 })
    const html = render("Requests", view.data, { ...context, versions: view.versions })!
    expect(html).toContain('name="po.contractRef" type="text" value="SAVED-CONTRACT"')
    expect(html).toContain(contractStrategy === "existing" ? "An existing-contract purchase requires its contract reference." : "Contract and asset references are recorded text")
  }
  const po = { ...request.po, contractRef: "" }
  const error = "Contract reference is required (call-off under existing contract)"
  expect(validatePO({ sourcing: { contractStrategy: "new" }, po }, settings, [])).toEqual([])
  expect(validatePO({ sourcing: { contractStrategy: "existing" }, po }, settings, [])).toEqual([error])
  const poState: Snapshot = {
    data: { store: { settings, suppliers: [], requests: { [request.number]: { request: { ...request, status: "po_draft", po }, version: 1, by: actor.id } } } },
    versions: { [`requests:${request.number}`]: { version: 1, by: actor.id } }, sequences: {}, audit: [], notices: [],
  }
  const before = structuredClone(poState)
  const rejected = domain.execute(poState, actor, { page: "Requests", action: "submit_po", id: request.number, version: 1, values: {} }, environment)
  expect(rejected).toMatchObject({ ok: false, status: 422, errors: [error] })
  if (rejected.ok || !("fieldErrors" in rejected)) throw new Error("existing-contract order without a reference did not return field errors")
  expect(rejected.fieldErrors).toContainEqual({ field: "po.contractRef", message: error })
  expect(poState).toEqual(before)
})

test("money never labels a missing order or ambiguous quotation as an approved amount", () => {
  const rates = { currency: "USD", fxRates: [{ code: "EUR", rate: 2 }] }
  const sourcing = { selectedId: "q1", approvalBaseCurrency: "USD", fxSnapshot: { EUR: 1.1 }, quotes: [{ id: "q1", currency: "EUR", total: 100 }] }
  expect(requestValue({ status: "po_approved", createdBy: "owner", sourcing, po: { currency: "USD", approvalBaseCurrency: "USD", lines: [] } }, rates)).toBeNull()
  expect(requestValue({ status: "sourcing", createdBy: "owner", sourcing: { selectedId: "q1", quotes: [{ id: "q1", total: 100 }, { id: "q1", currency: "USD", total: 100 }] } }, rates)).toBeNull()
  expect(requestValue({ status: "po_draft", createdBy: "owner", po: { lines: [{ qty: 1, unitPrice: 100 }] } }, rates)).toBeNull()
  expect(requestValue({ status: "src_rejected", createdBy: "owner", sourcing }, { currency: "GBP", fxRates: [{ code: "EUR", rate: 0.8 }] })).toBeNull()
  expect(requestValue({ status: "src_rejected", createdBy: "owner", sourcing }, rates)).toBeCloseTo(110)
  expect(requestValue({ status: "po_draft", createdBy: "owner", po: { currency: "USD", lines: [null] } } as unknown as RequestView, rates)).toBeNull()
  expect(requestValue({ status: "src_pending", createdBy: "owner", sourcing: { selectedId: "q1", quotes: {} } } as unknown as RequestView, rates)).toBeNull()
  expect(requestValue({ status: "po_approved", createdBy: "owner", po: { currency: "EUR", approvalBaseCurrency: "USD", fxRate: "1.08", lines: [{ qty: 1, unitPrice: 100 }] } } as unknown as RequestView, rates)).toBeNull()
  expect(requestValue({ status: "src_pending", createdBy: "owner", sourcing: { ...sourcing, fxSnapshot: { EUR: "1.08" } } } as unknown as RequestView, rates)).toBeNull()
  expect(requestValue({ status: "sourcing", createdBy: "owner", sourcing: { ...sourcing, fxSnapshot: null, approvalBaseCurrency: undefined } }, { currency: "USD", fxRates: [{ code: "EUR", rate: "1.08" }] } as unknown as Parameters<typeof requestValue>[1])).toBeNull()
})
