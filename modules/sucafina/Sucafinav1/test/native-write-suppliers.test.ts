import { expect, test } from "bun:test"
import { object, rows } from "../runtime/contract.ts"
import { empty } from "./fixture/persistence.ts"
import { nativeWriteFlow } from "./fixture/native-write.ts"

const at = "2026-11-12T12:00:00Z"
const people = [
  { token: "buyer", id: "fixture-buyer", name: "Synthetic Buyer", roles: [{ surface: "procurement" as const, role: "buyer" }] },
  { token: "admin", id: "fixture-admin", name: "Synthetic Admin", roles: [{ surface: "procurement" as const, role: "admin" }] },
  { token: "supplier-admin", id: "fixture-supplier-admin", name: "Synthetic Supplier Admin", roles: [{ surface: "procurement" as const, role: "supplier admin" }] },
  { token: "viewer", id: "fixture-viewer", name: "Synthetic Viewer", roles: [{ surface: "procurement" as const, role: "viewer" }] },
]

function app() {
  return nativeWriteFlow({ people, at })
}

async function read(flow: ReturnType<typeof app>, page: string, token: string) {
  const response = await flow.read("procurement", page, token)
  expect(response?.status).toBe(200)
  return object(await response!.json())
}

async function command(
  flow: ReturnType<typeof app>,
  token: string,
  action: string,
  version: number,
  values: Record<string, unknown> = {},
  id?: string,
  page = "Suppliers",
) {
  const response = await flow.command("procurement", {
    page,
    action,
    ...(id === undefined ? {} : { id }),
    version,
    values,
  }, token)
  return { response, body: object(await response!.json()) }
}

function supplierRows(state: Record<string, unknown>) {
  return rows(object(state.data).suppliers)
}

test("buyer creates a pending supplier; admin activates and edits general fields over native HTTP", async () => {
  const flow = app()
  const created = await command(flow, "buyer", "create", 0, {
    legalName: "Fixture Orchard Cooperative",
    country: "CH",
    address: "Synthetic Address 1",
    taxId: "FIXTURE-TAX-001",
    contactEmail: "finance@fixture.invalid",
    paymentTerms: "Net 30",
    riskRating: "Low",
    dueDiligence: true,
    sanctionsDate: "2026-11-01",
  })
  expect(created.response?.status).toBe(200)
  expect(created.body.ok).toBe(true)
  const initial = await read(flow, "Suppliers", "buyer")
  const id = String(supplierRows(initial)[0]?.id)
  expect(supplierRows(initial)[0]).toMatchObject({ status: "pending", legalName: "Fixture Orchard Cooperative" })
  expect(object(initial.versions)[`suppliers:${id}`]).toMatchObject({ version: 1, by: "fixture-buyer" })

  const bankAdded = await command(flow, "supplier-admin", "change-bank", 1, { bankName: "Fixture Bank" }, id)
  expect(bankAdded.response?.status).toBe(200)
  const activated = await command(flow, "admin", "activate", 2, {}, id)
  expect(activated.response?.status).toBe(200)
  expect(activated.body.ok).toBe(true)
  const edited = await command(flow, "admin", "save", 3, { tradingName: "Fixture Orchard" }, id)
  expect(edited.response?.status).toBe(200)
  expect(edited.body.ok).toBe(true)
  const after = await read(flow, "Suppliers", "admin")
  expect(supplierRows(after)[0]).toMatchObject({ status: "active", tradingName: "Fixture Orchard", validatedBy: "fixture-admin", validatedAt: at })
  expect(object(after.versions)[`suppliers:${id}`]).toMatchObject({ version: 4, by: "fixture-admin" })
  expect(flow.storage.state.procurement.audit.map((entry) => entry.record)).toEqual([
    `suppliers:${id}`,
    `suppliers:${id}`,
    `suppliers:${id}`,
    `suppliers:${id}`,
  ])
})

test("six bank fields are permission gated, encrypted where supported, and history is masked in native views", async () => {
  const flow = app()
  await command(flow, "buyer", "create", 0, {
    legalName: "Fixture Bank Supplier",
    country: "CH",
    address: "Synthetic Address 2",
    taxId: "FIXTURE-TAX-002",
    contactEmail: "accounts@fixture.invalid",
    paymentTerms: "Net 15",
    riskRating: "Low",
    dueDiligence: true,
    sanctionsDate: "2026-11-02",
  })
  const id = String(supplierRows(await read(flow, "Suppliers", "buyer"))[0]?.id)
  const bank = {
    iban: "FIXTURE-IBAN-DO-NOT-LOG",
    account: "FIXTURE-ACCOUNT-DO-NOT-LOG",
    bankName: "Fixture Confidential Bank",
    swift: "FIXTURE-BIC",
    accountHolder: "Synthetic Holder",
    bankCountry: "NZ",
  }
  const changed = await command(flow, "supplier-admin", "change-bank", 1, bank, id)
  expect(changed.response?.status).toBe(200)
  expect(changed.body.ok).toBe(true)
  const stored = rows(object(flow.storage.state.procurement.data.store).suppliers)[0]!
  expect(typeof stored.iban).toBe("string")
  expect(String(stored.iban).length).toBeGreaterThan(0)
  expect(typeof stored.account).toBe("string")
  expect(String(stored.account).length).toBeGreaterThan(0)
  expect(stored.iban).not.toBe(bank.iban)
  expect(stored.account).not.toBe(bank.account)
  expect(stored).toMatchObject({ bankName: bank.bankName, swift: bank.swift, accountHolder: bank.accountHolder, bankCountry: bank.bankCountry })
  expect(rows(stored.history)).toEqual(Object.keys(bank).map((field) => ({ field })))
  const reader = await read(flow, "Suppliers", "buyer")
  const hidden = supplierRows(reader)[0]!
  expect(hidden).toMatchObject({ iban: "masked", account: "masked" })
  for (const field of ["bankName", "swift", "accountHolder", "bankCountry"]) expect(hidden[field]).toBeUndefined()
  expect(JSON.stringify(reader)).not.toContain(bank.iban)
  expect(JSON.stringify(reader)).not.toContain(bank.account)
  for (const value of Object.values(bank)) expect(JSON.stringify(reader)).not.toContain(value)
  expect(rows(hidden.history)).toEqual(Object.keys(bank).map((field) => ({ field })))
  expect(supplierRows(await read(flow, "Suppliers", "admin"))[0]).toMatchObject(bank)

  for (const field of Object.keys(bank)) {
    const before = structuredClone(flow.storage.state.procurement)
    const denied = await command(flow, "buyer", "save", 2, { [field]: `FORBIDDEN-FIXTURE-${field}` }, id)
    expect(denied.response?.status).toBe(403)
    expect(denied.body).toMatchObject({ ok: false, status: 403 })
    expect(flow.storage.state.procurement.data).toEqual(before.data)
    expect(flow.storage.state.procurement.versions).toEqual(before.versions)
    expect(flow.storage.state.procurement.audit).toEqual(before.audit)
  }
})

test("only pending unlinked suppliers can be deleted; failure leaves version and audit untouched", async () => {
  const flow = app()
  await command(flow, "buyer", "create", 0, { legalName: "Fixture Pending Supplier" })
  const id = String(supplierRows(await read(flow, "Suppliers", "buyer"))[0]?.id)
  const deleted = await command(flow, "buyer", "delete", 1, {}, id)
  expect(deleted.response?.status).toBe(200)
  expect(deleted.body.ok).toBe(true)
  expect(supplierRows(await read(flow, "Suppliers", "buyer"))).toEqual([])
  expect(object((await read(flow, "Suppliers", "buyer")).versions)[`suppliers:${id}`]).toMatchObject({ version: 2, by: "fixture-buyer" })

  await command(flow, "buyer", "create", 0, {
    legalName: "Fixture Active Supplier",
    country: "CH",
    address: "Synthetic Address 3",
    taxId: "FIXTURE-TAX-003",
    contactEmail: "pay@fixture.invalid",
    paymentTerms: "Net 30",
    riskRating: "Low",
    dueDiligence: true,
    sanctionsDate: "2026-11-03",
  })
  const activeId = String(supplierRows(await read(flow, "Suppliers", "buyer"))[0]?.id)
  await command(flow, "admin", "change-bank", 1, { bankName: "Fixture Bank" }, activeId)
  await command(flow, "admin", "activate", 2, {}, activeId)
  const before = structuredClone(flow.storage.state.procurement)
  const refused = await command(flow, "admin", "delete", 3, {}, activeId)
  expect(refused.response?.status).toBe(403)
  expect(refused.body).toMatchObject({ ok: false, status: 403 })
  expect(flow.storage.state.procurement).toEqual(before)

  const seeded = empty()
  seeded.data.store = {
    settings: {},
    suppliers: [{ id: "fixture-linked", status: "pending", legalName: "Fixture Linked Supplier", history: [] }],
    requests: { "PR-FIXTURE-1": { request: { po: { supplierId: "fixture-linked" } } } },
  }
  seeded.versions["suppliers:fixture-linked"] = { version: 1, by: "fixture-buyer" }
  const linkedFlow = nativeWriteFlow({ people, initial: { procurement: seeded }, at })
  const linkedBefore = structuredClone(linkedFlow.storage.state.procurement)
  const linkedRefused = await command(linkedFlow, "buyer", "delete", 1, {}, "fixture-linked")
  expect(linkedRefused.response?.status).toBe(403)
  expect(linkedRefused.body).toMatchObject({ ok: false, status: 403 })
  expect(linkedFlow.storage.state.procurement).toEqual(linkedBefore)
})

test("admin settings save and readback use current CAS; non-admin and stale writes roll back", async () => {
  const flow = app()
  const reset = await command(flow, "admin", "reset", 0, {}, undefined, "Settings")
  expect(reset.response?.status).toBe(200)
  expect(reset.body.ok).toBe(true)
  const settings = object((await read(flow, "Settings", "admin")).data).settings
  expect(object(settings)).toMatchObject({ currency: "USD", prApprovalMode: "first", blockSelfApproval: false })
  const saved = await command(flow, "admin", "save", 1, { settings: { ...object(settings), currency: "EUR" } }, undefined, "Settings")
  expect(saved.response?.status).toBe(200)
  expect(saved.body.ok).toBe(true)
  const after = await read(flow, "Settings", "admin")
  expect(object(object(after.data).settings)).toMatchObject({ currency: "EUR" })
  expect(object(after.versions).settings).toMatchObject({ version: 2, by: "fixture-admin" })

  const before = structuredClone(flow.storage.state.procurement)
  const readOnly = await command(flow, "viewer", "save", 2, { currency: "USD" }, undefined, "Settings")
  expect(readOnly.response?.status).toBe(403)
  expect(readOnly.body).toMatchObject({ ok: false, status: 403 })
  const stale = await command(flow, "admin", "save", 1, { currency: "GBP" }, undefined, "Settings")
  expect(stale.response?.status).toBe(409)
  expect(stale.body).toMatchObject({ ok: false, status: 409 })
  expect(flow.storage.state.procurement).toEqual(before)
  expect(object(object((await read(flow, "Settings", "admin")).data).settings)).toMatchObject({ currency: "EUR" })
})
