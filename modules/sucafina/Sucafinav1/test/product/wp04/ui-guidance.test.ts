import { expect, test } from "bun:test"
import { initialProcurementSettings } from "../../../src/initial-settings.ts"
import { validatePO } from "../../../src/form.ts"
import { requestValue } from "../../../src/procurement-screen.ts"
import type { RequestView } from "../../../src/procurement-screen.ts"
import { presentProcurementFieldErrors, purchaseOrderFieldSources, sourcingFieldErrors } from "../../../product/procurement/guided-request.ts"
import { domain, render } from "../../../runtime/procurement.ts"
import { object, rows } from "../../../runtime/contract.ts"
import type { Snapshot } from "../../../runtime/contract.ts"

const at = "2026-11-13T12:00:00Z"
const actor = { id: "buyer", roles: ["buyer"], canWrite: true }
const context = { actor, year: 2026, month: 11, at, versions: {} }

async function renderedRowInputs(html: string, selector: string) {
  const values: Record<string, unknown> = {}
  await new HTMLRewriter().on(`${selector} input[name]`, { element(element) {
    if (element.getAttribute("type") === "checkbox" && !element.hasAttribute("checked")) return
    const name = element.getAttribute("name")
    if (name) values[name] = element.getAttribute("value") ?? ""
  } }).transform(new Response(html)).text()
  return values
}

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
  expect(first).toContain('aria-labelledby="PR-1-save-label-pr.title"')
  expect(first).toContain('<span id="PR-1-save-label-pr.title">Title</span>')
  expect(first).toContain('aria-describedby="PR-1-save-error-pr.title"')
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

test("rendered order rows retain omitted metadata across consecutive saves, reorder, removal and a new row", async () => {
  const environment = { at, directory: [], id: () => "unused" }
  const id = "PR-2026-00031"
  const original = [
    { desc: "Visible A", description: "Recorded description A", qty: 2, unitPrice: 10, uom: "box", unit: "Recorded unit A", notes: "Keep notes A" },
    { desc: "Visible B", description: "Recorded description B", qty: 3, unitPrice: 20, uom: "case", unit: "Recorded unit B", notes: "Keep notes B" },
  ]
  const state: Snapshot = {
    data: { store: { settings: initialProcurementSettings(), suppliers: [], requests: { [id]: { request: { number: id, status: "po_draft", createdBy: "owner", createdAt: at, pr: { title: "Retained rows" }, po: { currency: "USD", supplier: "Saved supplier", lines: original } }, version: 1, by: actor.id } } } },
    versions: { [`requests:${id}`]: { version: 1, by: actor.id } }, sequences: {}, audit: [], notices: [],
  }
  const view = domain.view(state, actor, environment)
  const values = await renderedRowInputs(render("Requests", view.data, { ...context, versions: view.versions })!, `#${id}-po form[data-command="save"] .form-section`)
  expect(values["po.lines.0._rowRef"]).toMatch(/^0:[a-f0-9]{64}$/)
  expect(values["po.lines.1._rowRef"]).toMatch(/^1:[a-f0-9]{64}$/)
  expect(values["po.lines.2._rowRef"]).toBeUndefined()
  expect(values["po.lines.0.notes"]).toBeUndefined()
  const save = (submitted: Record<string, unknown>) => domain.execute(state, actor, { page: "Requests", action: "save", id, version: state.versions[`requests:${id}`]!.version, values: submitted }, environment)
  const savedLines = () => rows(object(rows(domain.view(state, actor, environment).data.requests)[0]!.po).lines)
  for (const unitPrice of [11, 12]) {
    values["po.lines.0.unitPrice"] = String(unitPrice)
    expect(save(values).ok).toBe(true)
    expect(savedLines()).toEqual([{ ...original[0], unitPrice }, original[1]!])
  }
  // The browser may keep these exact controls after a successful save. Do not
  // rerender or regenerate their references before the next save.
  const reordered = Object.fromEntries(Object.entries(values).map(([name, value]) => [name.replace(/^po\.lines\.([01])\./, (_match, index) => `po.lines.${index === "0" ? "1" : "0"}.`), value]))
  expect(save(reordered).ok).toBe(true)
  expect(savedLines()).toEqual([original[1]!, { ...original[0], unitPrice: 12 }])
  reordered["po.lines.0._remove"] = "true"
  reordered["po.lines.2.desc"] = "New row"
  reordered["po.lines.2.qty"] = "1"
  reordered["po.lines.2.unitPrice"] = "7"
  reordered["po.lines.2.uom"] = "day"
  for (const unitPrice of [13, 14]) {
    reordered["po.lines.1.unitPrice"] = String(unitPrice)
    expect(save(reordered).ok).toBe(true)
    expect(savedLines()).toEqual([{ ...original[0], unitPrice }, { desc: "New row", qty: 1, unitPrice: 7, uom: "day" }])
  }
  expect(JSON.stringify(savedLines())).not.toMatch(/_rowRef|_remove|_new/)
  const beforeInvalid = structuredClone(state)
  const duplicate = { ...reordered, "po.lines.0._remove": "false", "po.lines.0._rowRef": reordered["po.lines.1._rowRef"] }
  const invalid = save(duplicate)
  expect(invalid).toMatchObject({ ok: false, status: 422 })
  if (invalid.ok || !("fieldErrors" in invalid)) throw new Error("Duplicate row identity did not return an adjacent error")
  expect(invalid.fieldErrors?.map((error) => error.field)).toEqual(["po.lines.0.desc", "po.lines.1.desc"])
  expect(state).toEqual(beforeInvalid)
  expect(save({ ...reordered, "po.lines.1._rowRef": "0:forged" })).toMatchObject({ ok: false, status: 422 })
  expect(state).toEqual(beforeInvalid)

  const previousVersion = state.versions[`requests:${id}`]!.version
  const current = savedLines()
  expect(save({ po: { lines: [{ ...current[0], notes: "Reviewed metadata" }, current[1]!] } }).ok).toBe(true)
  const afterReview = structuredClone(state)
  // A current metadata mismatch cannot hide the existing stale-version review.
  expect(domain.execute(state, actor, { page: "Requests", action: "save", id, version: previousVersion, values: reordered }, environment)).toMatchObject({ ok: false, status: 409 })
  expect(domain.execute(state, { id: "owner", roles: ["requester"], canWrite: true }, { page: "Requests", action: "save", id, version: state.versions[`requests:${id}`]!.version, values: reordered }, environment)).toMatchObject({ ok: false, status: 403 })
  expect(save(reordered)).toMatchObject({ ok: false, status: 422 })
  expect(state).toEqual(afterReview)
})

test("rendered quotation saves retain omitted metadata by quote ID and never transfer removed metadata to a new quote", async () => {
  const environment = { at, directory: [], id: () => "unused" }
  const id = "PR-2026-00032"
  const quotes = [
    { id: "quote-a", supplier: "Supplier A", currency: "USD", total: 10, qty: 1, unitPrice: 10, techPass: true, scores: [5, 4, 3, 2, 1], cscores: [0, 4, 3], description: "Recorded A", notes: "Notes A", attachments: [{ id: "attachment-a", name: "A.pdf" }] },
    { id: "quote-b", supplier: "Supplier B", currency: "USD", total: 20, qty: 1, unitPrice: 20, techPass: true, scores: [1, 2, 3, 4, 5], cscores: [0, 3, 4], description: "Recorded B", notes: "Notes B", attachments: [{ id: "attachment-b", name: "B.pdf" }] },
  ]
  const state: Snapshot = {
    data: { store: { settings: initialProcurementSettings(), suppliers: [], requests: { [id]: { request: { number: id, status: "sourcing", createdBy: "owner", createdAt: at, pr: { title: "Quote identity" }, sourcing: { selectedId: null, quotes } }, version: 1, by: actor.id } } } },
    versions: { [`requests:${id}`]: { version: 1, by: actor.id } }, sequences: {}, audit: [], notices: [],
  }
  const view = domain.view(state, actor, environment)
  const values = await renderedRowInputs(render("Requests", view.data, { ...context, versions: view.versions })!, `#${id}-sourcing form[data-command="save"] .form-section`)
  const quoteValues = Object.fromEntries(Object.entries(values).filter(([name]) => name.startsWith("sourcing.quotes.")))
  expect(quoteValues["sourcing.quotes.0.id"]).toBe("quote-a")
  expect(quoteValues["sourcing.quotes.1.id"]).toBe("quote-b")
  expect(quoteValues["sourcing.quotes.0.notes"]).toBeUndefined()
  const save = (submitted: Record<string, unknown>) => domain.execute(state, actor, { page: "Requests", action: "save", id, version: state.versions[`requests:${id}`]!.version, values: submitted }, environment)
  const savedQuotes = () => rows(object(rows(domain.view(state, actor, environment).data.requests)[0]!.sourcing).quotes)
  const reordered = Object.fromEntries(Object.entries(quoteValues).map(([name, value]) => [name.replace(/^sourcing\.quotes\.([01])\./, (_match, index) => `sourcing.quotes.${index === "0" ? "1" : "0"}.`), value]))
  expect(save(reordered).ok).toBe(true)
  expect(savedQuotes().map((quote) => ({ id: quote.id, description: quote.description, notes: quote.notes, attachments: quote.attachments }))).toEqual([quotes[1]!, quotes[0]!].map((quote) => ({ id: quote.id, description: quote.description, notes: quote.notes, attachments: quote.attachments })))
  reordered["sourcing.quotes.0._remove"] = "true"
  reordered["sourcing.quotes.2.id"] = "quote-b"
  reordered["sourcing.quotes.2.supplier"] = "New supplier B"
  reordered["sourcing.quotes.2.currency"] = "USD"
  reordered["sourcing.quotes.2.total"] = "30"
  reordered["sourcing.quotes.2.unitPrice"] = "30"
  reordered["sourcing.quotes.1.notes"] = "Explicit revised A"
  for (const total of [11, 12]) {
    reordered["sourcing.quotes.1.total"] = String(total)
    expect(save(reordered).ok).toBe(true)
    expect(savedQuotes()[0]).toMatchObject({ id: "quote-a", total, description: "Recorded A", notes: "Explicit revised A", attachments: quotes[0]!.attachments })
    expect(savedQuotes()[1]).toMatchObject({ id: "quote-b", supplier: "New supplier B", total: 30 })
    for (const field of ["description", "notes", "attachments"]) expect(savedQuotes()[1]![field]).toBeUndefined()
  }
  expect(JSON.stringify(savedQuotes())).not.toMatch(/_rowRef|_remove|_new/)
  const before = structuredClone(state)
  expect(save({ ...reordered, "sourcing.quotes.2._new": "false", "sourcing.quotes.2.id": "quote-a" })).toMatchObject({ ok: false, status: 422 })
  expect(state).toEqual(before)
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
