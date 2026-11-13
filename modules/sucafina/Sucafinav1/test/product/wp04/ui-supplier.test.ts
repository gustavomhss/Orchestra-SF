import { expect, test } from "bun:test"
import { domain, render } from "../../../runtime/procurement.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { initialProcurementSettings } from "../../../src/initial-settings.ts"

const at = "2026-11-13T12:00:00Z"
const buyer = { id: "buyer", roles: ["buyer"], canWrite: true }
const admin = { id: "supplier-administrator", roles: ["supplier admin"], canWrite: true }
const environment = { at, directory: [], id: () => "supplier-1", bankKey: new Uint8Array(32).fill(7) }

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
  expect(domain.execute(state, admin, { page: "Suppliers", action: "activate", id: "supplier-1", version: 1, values: {} }, environment)).toMatchObject({ ok: false, status: 422, errors: expect.arrayContaining(["Recorded activation prerequisite missing: contactEmail", "Recorded activation prerequisite missing: dueDiligence"]) })
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
