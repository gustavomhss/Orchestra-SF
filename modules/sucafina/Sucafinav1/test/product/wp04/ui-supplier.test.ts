import { expect, test } from "bun:test"
import { domain, render } from "../../../runtime/procurement.ts"
import { download } from "../../../runtime/downloads.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { object } from "../../../runtime/contract.ts"
import { initialProcurementSettings } from "../../../src/initial-settings.ts"

const at = "2026-11-13T12:00:00Z"
const buyer = { id: "buyer", roles: ["buyer"], canWrite: true }
const admin = { id: "supplier-administrator", roles: ["supplier admin"], canWrite: true }
const environment = { at, directory: [], id: () => "supplier-1", bankKey: new Uint8Array(32).fill(7) }

function exportedCsvRecords(bytes: Uint8Array) {
  const parsed = new TextDecoder().decode(bytes).split("\r\n").map((line) =>
    [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((match) => match[1]!.replaceAll('""', '"')),
  )
  const columns = parsed[0] ?? []
  return parsed.slice(1).map((cells) => Object.fromEntries(columns.map((column, index) => [column, cells[index]])))
}

test("bank change through the real domain clears validation and explains revalidation without leaking secrets", () => {
  const state: Snapshot = { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
  expect(domain.execute(state, buyer, { page: "Suppliers", action: "create", version: 0, values: { legalName: "Example supplier", country: "CH", address: "Synthetic address", taxId: "SYNTHETIC-TAX", contactEmail: "supplier@example.invalid", paymentTerms: "Net 30", riskRating: "Low", dueDiligence: true, sanctionsDate: "2026-11-01" } }, environment).ok).toBe(true)
  expect(domain.execute(state, admin, { page: "Suppliers", action: "change-bank", id: "supplier-1", version: 1, values: { iban: "SYNTHETIC-IBAN-ORIGINAL", bankName: "SYNTHETIC-BANK" } }, environment).ok).toBe(true)
  expect(domain.execute(state, admin, { page: "Suppliers", action: "activate", id: "supplier-1", version: 2, values: {} }, environment).ok).toBe(true)
  const active = domain.view(state, admin, environment).data.suppliers as Record<string, unknown>[]
  expect(active[0]).toMatchObject({ status: "active", validatedBy: admin.id, validatedAt: at })
  expect(domain.execute(state, admin, { page: "Suppliers", action: "change-bank", id: "supplier-1", version: 3, values: { iban: "SYNTHETIC-IBAN-UPDATED" } }, environment).ok).toBe(true)
  const view = domain.view(state, admin, environment)
  expect((view.data.suppliers as Record<string, unknown>[])[0]).toMatchObject({ status: "pending", validatedBy: null, validatedAt: null })
  const html = render("Suppliers", view.data, { actor: admin, year: 2026, month: 11, at, versions: view.versions })!
  expect(html).toContain("Bank details changed after activation")
  expect(html).toContain("A recorded sanctions screening date does not verify external screening")
  const before = structuredClone(state)
  const refused = domain.execute(state, buyer, { page: "Suppliers", action: "change-bank", id: "supplier-1", version: 4, values: { iban: "SYNTHETIC-UNAUTHORIZED" } }, environment)
  expect(refused).toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(before)
  const visible = domain.view(state, buyer, environment)
  expect(JSON.stringify(visible)).not.toContain("SYNTHETIC-IBAN")
  expect(JSON.stringify(state.audit)).not.toContain("SYNTHETIC-IBAN")
  const buyerHtml = render("Suppliers", visible.data, { actor: buyer, year: 2026, month: 11, at, versions: visible.versions })!
  expect(buyerHtml).not.toContain("SYNTHETIC-IBAN")
  expect(buyerHtml).not.toContain('data-command="change-bank"')
})

test("supplier activation reports recorded prerequisites and duplicate tax IDs remain rejected", () => {
  const state: Snapshot = { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
  expect(domain.execute(state, buyer, { page: "Suppliers", action: "create", version: 0, values: { legalName: "Example", taxId: "SYNTHETIC-UNIQUE" } }, environment).ok).toBe(true)
  const before = structuredClone(state)
  expect(domain.execute(state, buyer, { page: "Suppliers", action: "create", version: 0, values: { legalName: "Other", taxId: "SYNTHETIC-UNIQUE" } }, { ...environment, id: () => "supplier-2" })).toMatchObject({ ok: false, status: 422, errors: ["taxId must be unique"] })
  expect(state).toEqual(before)
  const refused = domain.execute(state, admin, { page: "Suppliers", action: "activate", id: "supplier-1", version: 1, values: {} }, environment)
  expect(refused).toMatchObject({ ok: false, status: 422 })
  if (refused.ok) throw new Error("Incomplete supplier unexpectedly activated")
  expect(refused.errors).toContain("Recorded activation prerequisite missing: Contact email")
  expect(refused.errors).toContain("Recorded activation prerequisite missing: Due diligence complete")
  expect(refused.errors).toContain("Recorded activation prerequisite missing: IBAN or Bank name")
  expect(JSON.stringify(refused)).not.toContain("contactEmail")
  expect(JSON.stringify(refused)).not.toContain("dueDiligence")
  expect(state).toEqual(before)
  const view = domain.view(state, admin, environment)
  const html = render("Suppliers", view.data, { actor: admin, year: 2026, month: 11, at, versions: view.versions })!
  expect(html).toContain("Complete these recorded prerequisites before activation")
  expect(html).toContain("<span>Contact email</span>")
  expect(html).toContain("<span>Due diligence complete</span>")
  expect(html).toContain("<span>IBAN or Bank name</span>")
  expect(html).not.toContain("<span>contactEmail</span>")
  expect(html).toContain("A recorded sanctions screening date does not verify external screening")
  expect(domain.execute(state, buyer, { page: "Suppliers", action: "save", id: "supplier-1", version: 1, values: { country: "CH", address: "Recorded address", contactEmail: "supplier@example.invalid", paymentTerms: "Net 30", riskRating: "Low", dueDiligence: true, sanctionsDate: "2026-11-01" } }, environment).ok).toBe(true)
  expect(domain.execute(state, admin, { page: "Suppliers", action: "change-bank", id: "supplier-1", version: 2, values: { bankName: "Recorded bank" } }, environment).ok).toBe(true)
  expect(domain.execute(state, admin, { page: "Suppliers", action: "activate", id: "supplier-1", version: 3, values: {} }, environment)).toMatchObject({ ok: true })
  expect((domain.view(state, admin, environment).data.suppliers as Record<string, unknown>[])[0]).toMatchObject({ status: "active", validatedBy: admin.id, validatedAt: at })
})

test("duplicate legal names warn on success while distinct tax IDs remain separate", () => {
  const state: Snapshot = { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
  expect(domain.execute(state, buyer, { page: "Suppliers", action: "create", version: 0, values: { legalName: "Same legal name", taxId: "SYNTHETIC-TAX-1" } }, environment)).toMatchObject({ ok: true, warnings: [] })
  const duplicateName = domain.execute(state, buyer, { page: "Suppliers", action: "create", version: 0, values: { legalName: "Same legal name", taxId: "SYNTHETIC-TAX-2" } }, { ...environment, id: () => "supplier-2" })
  expect(duplicateName).toMatchObject({ ok: true, warnings: ["Duplicate legalName recognized"] })
  const suppliers = domain.view(state, buyer, environment).data.suppliers as Record<string, unknown>[]
  expect(suppliers.map((supplier) => ({ id: supplier.id, legalName: supplier.legalName, taxId: supplier.taxId }))).toEqual([
    { id: "supplier-1", legalName: "Same legal name", taxId: "SYNTHETIC-TAX-1" },
    { id: "supplier-2", legalName: "Same legal name", taxId: "SYNTHETIC-TAX-2" },
  ])
  const before = structuredClone(state)
  const duplicateTax = domain.execute(state, buyer, { page: "Suppliers", action: "create", version: 0, values: { legalName: "Same legal name", taxId: "SYNTHETIC-TAX-2" } }, { ...environment, id: () => "supplier-3" })
  expect(duplicateTax).toMatchObject({ ok: false, status: 422, errors: ["taxId must be unique"] })
  expect(state).toEqual(before)
})

test("Settings exposes complete baseline policy controls and secondary reset without inventing defaults", () => {
  const settings = initialProcurementSettings()
  const html = render("Settings", { settings }, { actor: { id: "settings-admin", roles: ["admin"], canWrite: true }, year: 2026, month: 11, at, versions: {} })!
  for (const field of ["currency", "levels.0.holderId", "fxRates.0.rate", "criteria.0.weight", "commCriteria.0.auto", "minQuotes", "billingAddress", "defaultDeliveryAddress", "incoterms", "paymentTerms", "uploadCap", "reminderDays", "escalationDays"]) expect(html).toContain(`name="${field}"`)
  expect(html).toContain('<details class="editor-panel"><summary>Reset settings</summary>')
  expect(html).toContain("submitted approval/FX snapshots remain preserved")
  expect(settings.uploadCap).toBeNull()
  expect(settings.reminderDays).toBeNull()
  expect(settings.escalationDays).toBeNull()
})

test("the real supplier CSV keeps business fields and grants every bank field only to existing privileged roles", async () => {
  const state: Snapshot = { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
  const fields = { legalName: "Supplier for downloads", country: "CH", address: "Recorded business address", taxId: "EXPORT-TAX", contactEmail: "exports@example.invalid", paymentTerms: "Net 45", currency: "EUR", riskRating: "Low", dueDiligence: true, sanctionsDate: "2026-11-01" }
  const bank = { iban: "EXPORT-IBAN-PRIVATE", account: "EXPORT-ACCOUNT-PRIVATE", swift: "EXPORT-SWIFT-PRIVATE", bankName: "EXPORT-BANK-PRIVATE", accountHolder: "EXPORT-HOLDER-PRIVATE", bankCountry: "EXPORT-COUNTRY-PRIVATE" }
  expect(domain.execute(state, buyer, { page: "Suppliers", action: "create", version: 0, values: fields }, environment).ok).toBe(true)
  expect(domain.execute(state, admin, { page: "Suppliers", action: "change-bank", id: "supplier-1", version: 1, values: bank }, environment).ok).toBe(true)
  const before = structuredClone(state)
  for (const actor of [buyer, { id: "reader", roles: ["viewer"], canWrite: false }, admin, { id: "administrator", roles: ["admin"], canWrite: true }]) {
    const result = await download("suppliers", state, actor, environment, new URLSearchParams())
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Authorized supplier export failed")
    const csv = new TextDecoder().decode(result.bytes)
    for (const value of ["SUP-00001", ...Object.values(fields).filter((value) => typeof value === "string")]) expect(csv).toContain(`"${value}"`)
    for (const [field, value] of Object.entries(bank)) {
      if (actor.roles.includes("admin") || actor.roles.includes("supplier admin")) {
        expect(csv).toContain(`"${field}"`)
        expect(csv).toContain(`"${value}"`)
      } else {
        expect(csv).not.toContain(`"${field}"`)
        expect(csv).not.toContain(value)
      }
    }
  }
  expect(await download("suppliers", state, admin, { ...environment, bankKey: undefined }, new URLSearchParams())).toEqual({ ok: false, status: 503 })
  expect(state).toEqual(before)
})

test("real register and purchase-order downloads preserve recorded business terms and omit restricted bank material", async () => {
  const request = {
    number: "PR-2026-0042", status: "po_issued", createdBy: "owner", createdAt: at,
    pr: { title: "Recorded service", type: "service", category: "Software", costCenter: "Operations", recurring: true, frequency: "Monthly", estAnnual: 1200, estAmount: 100 },
    sourcing: { selectedId: "quote-1", contractStrategy: "existing", quotes: [{ id: "quote-1", supplier: "Recorded supplier", currency: "EUR", total: 100 }] },
    po: { number: "PO-2026-0042", supplier: "Recorded supplier", supplierContact: "Supplier contact", quoteRef: "QUOTE-42", currency: "EUR", fxRate: 1.08, approvalBaseCurrency: "USD", expenseType: "OPEX", description: "Recorded purchase scope", lines: [{ desc: "Recorded licence", qty: 2, uom: "seat", unitPrice: 50 }], paymentTerms: "Negotiated Net 60", deliveryDate: "2026-12-01", deliveryConditions: "Recorded delivery conditions", contractRef: "FRAME-42", assetRef: "ASSET-TEXT", incoterm: "DAP", billingAddress: "Recorded invoice address", deliveryAddress: "Recorded warehouse", acceptance: "Recorded acceptance", warranty: "Recorded warranty", notes: "Recorded additional terms", issuedAt: at, approval: { amount: 108, steps: [{ levelName: "Recorded approval", status: "approved", by: "holder", at }] }, iban: "NEVER-EXPORT-IBAN", account: "NEVER-EXPORT-ACCOUNT", bankName: "NEVER-EXPORT-BANK", swift: "NEVER-EXPORT-SWIFT", accountHolder: "NEVER-EXPORT-HOLDER", bankCountry: "NEVER-EXPORT-COUNTRY" },
    history: [{ at, by: "holder", action: "PO issued internally", note: "PO-2026-0042" }],
  }
  const state: Snapshot = { data: { store: { settings: initialProcurementSettings(), requests: { [request.number]: { request, version: 7, by: "holder" } } } }, versions: {}, sequences: {}, audit: [], notices: [] }
  const before = structuredClone(state)
  const actor = { id: "owner", roles: ["requester"], canWrite: true }
  const env = { ...environment, directory: [{ id: "owner", name: "Recorded requester" }, { id: "holder", name: "Recorded approver" }] }
  const register = await download("register", state, actor, env, new URLSearchParams())
  const order = await download("po", state, actor, env, new URLSearchParams({ request: request.number }))
  expect(register.ok).toBe(true)
  expect(order.ok).toBe(true)
  if (!register.ok || !order.ok) throw new Error("Authorized recorded export failed")
  const csv = new TextDecoder().decode(register.bytes)
  const html = new TextDecoder().decode(order.bytes)
  for (const value of [request.number, request.po.number, "Recorded requester", "Recorded service", "Software", "Operations", "Monthly", "1200", "100", "108", "EUR 100.00", "existing", "Negotiated Net 60", "2026-12-01", "po_issued"]) expect(csv).toContain(`"${value}"`)
  for (const value of [request.number, request.po.number, "Supplier contact", "QUOTE-42", "Recorded invoice address", "Recorded purchase scope", "Recorded licence", "seat", "100.00", "Negotiated Net 60", "DAP", "Recorded warehouse", "Recorded delivery conditions", "Recorded acceptance", "Recorded warranty", "FRAME-42", "ASSET-TEXT", "Recorded additional terms", "Recorded approver"]) expect(html).toContain(value)
  expect(csv + html).not.toContain("NEVER-EXPORT")
  expect(await download("po", state, { id: "other-owner", roles: ["requester"], canWrite: true }, env, new URLSearchParams({ request: request.number }))).toEqual({ ok: false, status: 404 })
  const hidden = await download("register", state, { id: "other-owner", roles: ["requester"], canWrite: true }, env, new URLSearchParams())
  if (!hidden.ok) throw new Error("Authorized empty register failed")
  expect(new TextDecoder().decode(hidden.bytes)).not.toContain(request.number)
  expect(state).toEqual(before)
})

test("real register bytes distinguish missing quotation values and currency from recorded zero and reject ambiguous selection", async () => {
  const cases = [
    { id: "PR-export-no-total", quotes: [{ id: "q", supplier: "Declared supplier", currency: "USD" }], total: "Unavailable", supplier: "Declared supplier" },
    { id: "PR-export-no-currency", quotes: [{ id: "q", supplier: "Declared supplier", total: 100 }], total: "Unavailable", supplier: "Declared supplier" },
    { id: "PR-export-duplicate", quotes: [{ id: "q", supplier: "First", currency: "USD", total: 100 }, { id: "q", supplier: "Second", currency: "USD", total: 200 }], total: "Unavailable", supplier: "Unavailable" },
    { id: "PR-export-zero", quotes: [{ id: "q", supplier: "Declared supplier", currency: "USD", total: 0 }], total: "USD 0.00", supplier: "Declared supplier" },
    { id: "PR-export-original", quotes: [{ id: "q", supplier: "Declared supplier", currency: "EUR", total: 100 }], total: "EUR 100.00", supplier: "Declared supplier" },
  ]
  const state: Snapshot = { data: { store: { settings: initialProcurementSettings(), requests: Object.fromEntries(cases.map((item) => [item.id, { request: { number: item.id, status: "sourcing", createdBy: buyer.id, pr: {}, sourcing: { selectedId: "q", quotes: item.quotes } }, version: 1, by: buyer.id }])) } }, versions: {}, sequences: {}, audit: [], notices: [] }
  const before = structuredClone(state)
  const result = await download("register", state, buyer, environment, new URLSearchParams())
  if (!result.ok) throw new Error("Real quotation register export failed")
  const records = exportedCsvRecords(result.bytes)
  expect(records).toHaveLength(cases.length)
  for (const item of cases) expect(records.find((record) => record["PR number"] === item.id)).toMatchObject({ "Selected quote total": item.total, "Selected supplier": item.supplier, "Estimated amount": "Unavailable", "Est. annual value": "Unavailable" })
  expect(state).toEqual(before)
})

test("real PO and register bytes keep missing lines prices currency and frozen FX unavailable", async () => {
  const cases: { name: string; status: string; po: Record<string, unknown>; original: string; currency: string; displayed: string; fx: string }[] = [
    { name: "absent price", status: "po_draft", po: { currency: "USD", lines: [{ qty: 2, unitPrice: null }] }, original: "Unavailable", currency: "USD", displayed: "Unavailable", fx: "1" },
    { name: "absent quantity", status: "po_draft", po: { currency: "USD", lines: [{ unitPrice: 50 }] }, original: "Unavailable", currency: "USD", displayed: "Unavailable", fx: "1" },
    { name: "absent currency", status: "po_draft", po: { lines: [{ qty: 2, unitPrice: 50 }] }, original: "Unavailable", currency: "Unavailable", displayed: "Unavailable", fx: "Unavailable" },
    { name: "empty lines", status: "po_approved", po: { currency: "USD", lines: [] }, original: "Unavailable", currency: "USD", displayed: "Unavailable", fx: "Unavailable" },
    { name: "malformed line", status: "po_draft", po: { currency: "USD", lines: [null] }, original: "Unavailable", currency: "USD", displayed: "Unavailable", fx: "1" },
    { name: "string price", status: "po_draft", po: { currency: "USD", lines: [{ qty: 2, unitPrice: "50" }] }, original: "Unavailable", currency: "USD", displayed: "Unavailable", fx: "1" },
    { name: "overflow", status: "po_draft", po: { currency: "USD", lines: [{ qty: 2, unitPrice: Number.MAX_VALUE }] }, original: "Unavailable", currency: "USD", displayed: "Unavailable", fx: "1" },
    { name: "missing submitted FX", status: "po_pending", po: { currency: "EUR", lines: [{ qty: 2, unitPrice: 50 }], approvalBaseCurrency: "USD", fxRate: null, approval: { amount: 108 } }, original: "100", currency: "EUR", displayed: "100.00", fx: "Unavailable" },
    { name: "string submitted FX", status: "po_pending", po: { currency: "EUR", lines: [{ qty: 2, unitPrice: 50 }], approvalBaseCurrency: "USD", fxRate: "1.08", approval: { amount: 108 } }, original: "100", currency: "EUR", displayed: "100.00", fx: "Unavailable" },
  ]
  for (const item of cases) {
    const id = "PR-export-order"
    const request = { number: id, status: item.status, createdBy: buyer.id, pr: { estAmount: 777 }, sourcing: { selectedId: "q", quotes: [{ id: "q", supplier: "Must not substitute", total: 555, currency: "USD" }] }, po: { ...item.po, number: "PO-export-order", description: item.name, iban: "NO-EXPORT-BANK" } }
    const state: Snapshot = { data: { store: { settings: initialProcurementSettings(), requests: { [id]: { request, version: 1, by: buyer.id } } } }, versions: {}, sequences: {}, audit: [], notices: [] }
    const before = structuredClone(state)
    const register = await download("register", state, buyer, environment, new URLSearchParams())
    const order = await download("po", state, buyer, environment, new URLSearchParams({ request: id }))
    if (!register.ok || !order.ok) throw new Error(`Real export failed for ${item.name}`)
    expect(exportedCsvRecords(register.bytes)[0]).toMatchObject({ "PO total": item.original, "PO currency": item.currency, "PO total (base)": "Unavailable", "PO FX rate": item.fx })
    const html = new TextDecoder().decode(order.bytes)
    expect(html).toContain(`<th colspan="5">Total agreed price (excl. VAT)</th><td>${item.displayed}</td>`)
    expect(html).toContain(`Unit price (${item.currency})`)
    expect(html).toContain("Current base amount: Unavailable")
    expect(html).not.toContain("NO-EXPORT-BANK")
    if (item.name === "absent price") expect(html).toContain('<td>2</td><td></td><td>Unavailable</td><td>Unavailable</td>')
    if (item.name === "absent quantity") expect(html).toContain('<td>Unavailable</td><td></td><td>50.00</td><td>Unavailable</td>')
    expect(state).toEqual(before)
  }
})

test("real financial downloads preserve frozen submitted currency after base changes and retain explicit zero", async () => {
  const id = "PR-export-frozen"
  const request = { number: id, status: "po_approved", createdBy: buyer.id, pr: { estAmount: 100 }, po: { number: "PO-export-frozen", currency: "EUR", fxRate: 1.08, approvalBaseCurrency: "USD", lines: [{ qty: 2, unitPrice: 50 }], approval: { amount: 108 } } }
  for (const currency of ["USD", "GBP"]) {
    const settings = { ...initialProcurementSettings(), currency, fxRates: [{ code: "EUR", rate: 2 }] }
    const state: Snapshot = { data: { store: { settings, requests: { [id]: { request, version: 1, by: buyer.id } } } }, versions: {}, sequences: {}, audit: [], notices: [] }
    const before = structuredClone(state)
    const register = await download("register", state, buyer, environment, new URLSearchParams())
    const order = await download("po", state, buyer, environment, new URLSearchParams({ request: id }))
    if (!register.ok || !order.ok) throw new Error("Real frozen export failed")
    expect(exportedCsvRecords(register.bytes)[0]).toMatchObject({ "PO total": "100", "PO currency": "EUR", "PO base currency": currency, "PO total (base)": currency === "USD" ? "108" : "Unavailable", "PO FX rate": currency === "USD" ? "1.08" : "Unavailable", "PO FX source": currency === "USD" ? "submitted" : "Unavailable", "PO monetary state": "approved", "PO submitted amount": "108", "PO submitted currency": "USD", "PO submitted FX rate": "1.08" })
    const html = new TextDecoder().decode(order.bytes)
    expect(html).toContain("Submitted approval: 108.00 USD; submitted FX: 1.08")
    expect(html).toContain(currency === "USD" ? "Current base amount: 108.00 USD" : "Current base amount: Unavailable")
    expect(html).not.toContain("200.00")
    expect(state).toEqual(before)
  }
  for (const status of ["po_pending", "po_approved"]) {
    const incomplete: Snapshot = { data: { store: { settings: initialProcurementSettings(), requests: { [id]: { request: { ...request, status, po: { ...request.po, lines: [] } }, version: 1, by: buyer.id } } } }, versions: {}, sequences: {}, audit: [], notices: [] }
    const before = structuredClone(incomplete)
    const register = await download("register", incomplete, buyer, environment, new URLSearchParams())
    const order = await download("po", incomplete, buyer, environment, new URLSearchParams({ request: id }))
    if (!register.ok || !order.ok) throw new Error("Real incomplete approved export failed")
    expect(exportedCsvRecords(register.bytes)[0]).toMatchObject({ "PO total": "Unavailable", "PO total (base)": "Unavailable", "PO currency": "EUR", "PO FX rate": "1.08", "PO FX source": "submitted", "PO monetary state": status === "po_pending" ? "pending-approval" : "approved", "PO submitted amount": "108", "PO submitted currency": "USD", "PO submitted FX rate": "1.08" })
    const html = new TextDecoder().decode(order.bytes)
    expect(html).toContain('<th colspan="5">Total agreed price (excl. VAT)</th><td>Unavailable</td>')
    expect(html).toContain("Current base amount: Unavailable")
    expect(html).toContain("Submitted approval: 108.00 USD; submitted FX: 1.08")
    expect(incomplete).toEqual(before)
  }
  const zero: Snapshot = { data: { store: { settings: initialProcurementSettings(), requests: { [id]: { request: { ...request, status: "po_draft", po: { number: "PO-export-zero", currency: "USD", lines: [{ qty: 0, unitPrice: 25 }] } }, version: 1, by: buyer.id } } } }, versions: {}, sequences: {}, audit: [], notices: [] }
  const register = await download("register", zero, buyer, environment, new URLSearchParams())
  const order = await download("po", zero, buyer, environment, new URLSearchParams({ request: id }))
  if (!register.ok || !order.ok) throw new Error("Real zero export failed")
  expect(exportedCsvRecords(register.bytes)[0]).toMatchObject({ "PO total": "0", "PO total (base)": "0", "PO currency": "USD", "PO FX rate": "1", "PO FX source": "base", "PO monetary state": "estimate" })
  expect(new TextDecoder().decode(order.bytes)).toContain('<th colspan="5">Total agreed price (excl. VAT)</th><td>0.00</td>')
})

test("real supplier lifecycle covers all four states, authorized search, linked requests and audit without granting buyer status powers", () => {
  const state: Snapshot = { data: { store: { settings: initialProcurementSettings() } }, versions: {}, sequences: {}, audit: [], notices: [] }
  const values = { legalName: "Lifecycle supplier", country: "CH", address: "Lifecycle address", taxId: "LIFECYCLE-TAX", contactEmail: "lifecycle@example.invalid", paymentTerms: "Net 30", riskRating: "Low", dueDiligence: true, sanctionsDate: "2026-11-01" }
  expect(domain.execute(state, buyer, { page: "Suppliers", action: "create", version: 0, values }, environment).ok).toBe(true)
  expect(domain.execute(state, buyer, { page: "Suppliers", action: "create", version: 0, values: { legalName: "Other pending supplier", taxId: "OTHER-TAX" } }, { ...environment, id: () => "other-supplier" }).ok).toBe(true)
  expect(domain.execute(state, admin, { page: "Suppliers", action: "change-bank", id: "supplier-1", version: 1, values: { bankName: "LIFECYCLE-PRIVATE-BANK" } }, environment).ok).toBe(true)

  const owner = { id: "request-owner", roles: ["requester"], canWrite: true }
  const pr = { title: "Linked supplier request", type: "service", description: "Recorded services", estAmount: 100, costCenter: "Operations", needBy: "2026-12-01", justification: "Recorded business need", recurring: false, expenseType: "OPEX" }
  const created = domain.execute(state, owner, { page: "Requests", action: "create", version: 0, values: { pr } }, environment)
  if (!created.ok) throw new Error("Linked request creation failed")
  const id = String(object(created.value).number)
  expect(domain.execute(state, owner, { page: "Requests", action: "submit_pr", id, version: 1, values: {} }, environment).ok).toBe(true)
  expect(domain.execute(state, { id: "request-approver", roles: ["admin"], canWrite: true }, { page: "Requests", action: "approve", id, version: 2, values: {} }, environment).ok).toBe(true)
  expect(domain.execute(state, buyer, { page: "Requests", action: "save", id, version: 3, values: { sourcing: { quotes: [{ id: "linked-quote", supplier: values.legalName, supplierId: "supplier-1", currency: "USD", total: 100, qty: 1, unitPrice: 100, techPass: true, scores: [5, 5, 5, 5, 5], cscores: [null, 4, 4] }] } } }, environment).ok).toBe(true)
  const linked = structuredClone(state)
  expect(domain.execute(state, buyer, { page: "Suppliers", action: "delete", id: "supplier-1", version: 2, values: {} }, environment)).toMatchObject({ ok: false, status: 403 })
  for (const action of ["block", "inactivate"]) expect(domain.execute(state, buyer, { page: "Suppliers", action, id: "supplier-1", version: 2, values: {} }, environment)).toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(linked)

  for (const step of [{ status: "pending", action: null }, { status: "active", action: "activate" }, { status: "blocked", action: "block" }, { status: "inactive", action: "inactivate" }]) {
    if (step.action) expect(domain.execute(state, admin, { page: "Suppliers", action: step.action, id: "supplier-1", version: state.versions["suppliers:supplier-1"]!.version, values: {} }, environment).ok).toBe(true)
    const view = domain.view(state, buyer, environment)
    const supplier = (view.data.suppliers as Record<string, unknown>[]).find((item) => item.id === "supplier-1")!
    expect(supplier).toMatchObject({ ...values, status: step.status, number: "SUP-00001" })
    const html = render("Suppliers", { ...view.data, status: step.status }, { actor: buyer, year: 2026, month: 11, at, versions: view.versions })!
    expect(html).toContain('id="supplier-supplier-1"')
    expect(html).toContain(`<td>${step.status}</td>`)
    expect(html).toContain(`<td>${id}</td>`)
    expect(html).not.toContain("LIFECYCLE-PRIVATE-BANK")
    expect(html).not.toContain('data-command="block"')
    expect(html).not.toContain('data-command="inactivate"')
    if (step.status !== "pending") expect(html).not.toContain('id="supplier-other-supplier"')
    if (step.status !== "pending") expect(supplier).toMatchObject({ validatedBy: admin.id, validatedAt: at })
  }

  const view = domain.view(state, buyer, environment)
  for (const q of ["lifecycle supplier", "sup-00001", "lifecycle-tax"]) {
    const html = render("Suppliers", { ...view.data, status: "All", q }, { actor: buyer, year: 2026, month: 11, at, versions: view.versions })!
    expect(html).toContain('id="supplier-supplier-1"')
    expect(html).not.toContain('id="supplier-other-supplier"')
    expect(html).toContain(`<td>${id}</td>`)
  }
  const noMatch = render("Suppliers", { ...view.data, status: "active", q: "lifecycle-tax" }, { actor: buyer, year: 2026, month: 11, at, versions: view.versions })!
  expect(noMatch).not.toContain('id="supplier-supplier-1"')
  const privileged = domain.view(state, admin, environment)
  const audited = render("Suppliers", { ...privileged.data, q: "lifecycle-tax" }, { actor: admin, year: 2026, month: 11, at, versions: privileged.versions })!
  expect(audited).toContain("<h3>Audit</h3>")
  expect(audited).toContain("<td>bankName</td>")
  expect(state.audit.filter((entry) => entry.record === "suppliers:supplier-1").map((entry) => object(entry.became).status)).toEqual(["pending", "pending", "active", "blocked", "inactive"])
  expect(JSON.stringify(state.audit)).not.toContain("LIFECYCLE-PRIVATE-BANK")
  expect((view.data.requests as Record<string, unknown>[]).find((item) => item.number === id)).toMatchObject({ pr, sourcing: { quotes: [{ supplierId: "supplier-1" }] } })
})

test("recorded supplier enum values outside the current options remain selected through a real form save", async () => {
  const state: Snapshot = { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
  expect(domain.execute(state, buyer, { page: "Suppliers", action: "create", version: 0, values: { legalName: "Previously recorded supplier", type: "company", riskRating: "low", taxId: "RECORDED-TAX", contactPhone: "Old contact" } }, environment).ok).toBe(true)
  const view = domain.view(state, buyer, environment)
  const html = render("Suppliers", view.data, { actor: buyer, year: 2026, month: 11, at, versions: view.versions })!
  const selected: Record<string, string[]> = { type: [], riskRating: [] }
  const parser = new HTMLRewriter()
  for (const field of ["type", "riskRating"]) parser.on(`form[data-command="save"][data-record="supplier-1"] select[name="${field}"] option[selected]`, { element: (element) => { selected[field]!.push(element.getAttribute("value") ?? "") } })
  await parser.transform(new Response(html)).text()
  expect(selected).toEqual({ type: ["company"], riskRating: ["low"] })
  expect(html).toContain('value="company" selected>Recorded value: company</option>')
  expect(html).toContain('value="low" selected>Recorded value: low</option>')
  expect(domain.execute(state, buyer, { page: "Suppliers", action: "save", id: "supplier-1", version: 1, values: { type: selected.type![0], riskRating: selected.riskRating![0], contactPhone: "Corrected contact" } }, environment).ok).toBe(true)
  expect((domain.view(state, buyer, environment).data.suppliers as Record<string, unknown>[])[0]).toMatchObject({ type: "company", riskRating: "low", contactPhone: "Corrected contact", taxId: "RECORDED-TAX" })
})
