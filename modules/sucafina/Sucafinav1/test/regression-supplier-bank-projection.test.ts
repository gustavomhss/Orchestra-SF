import { expect, test } from "bun:test"
import { createApplication } from "../runtime/application.ts"
import type { Actor, Environment, Snapshot } from "../runtime/contract.ts"
import { domain, pages, render } from "../runtime/procurement.ts"
import type { ResolvedActor } from "../src/identity.ts"
import { empty, testPersistence } from "./fixture/persistence.ts"

const at = "2026-11-12T12:00:00Z"
const origin = "https://installation.example"
const supplierId = "supplier-bank-projection"
const bankKey = new Uint8Array(32).fill(7)
const bankSecrets = {
  iban: "GB00-PLAINTEXT-IBAN",
  account: "ACCT-PLAINTEXT-SECRET",
  swift: "BIC-PLAINTEXT-SECRET",
  bankName: "Private Bank Name",
  accountHolder: "Private Account Holder",
  bankCountry: "Private Bank Country",
}
const historicBankSecrets = {
  iban: "GB00-HISTORIC-IBAN",
  account: "HISTORIC-ACCOUNT-SECRET",
  swift: "HISTORIC-BIC-SECRET",
  bankName: "Historic Bank Name",
  accountHolder: "Historic Account Holder",
  bankCountry: "Historic Bank Country",
}
const bankFields = ["iban", "account", "bankName", "swift", "accountHolder", "bankCountry"] as const
const allBankSecrets = [...Object.values(bankSecrets), ...Object.values(historicBankSecrets)]
const nonPrivilegedRoles = ["buyer", "viewer", "requester", "approver"] as const
const privilegedRoles = [
  ["admin"],
  ["supplier admin"],
  ["buyer", "supplier admin"],
] as const
const directory = [
  { id: "seed-admin", name: "Seed Admin" },
  ...[...nonPrivilegedRoles, "admin", "supplier-admin", "buyer-supplier-admin", "cross-surface-admin"].map((id) => ({
    id,
    name: `${id} Person`,
  })),
]
const environment: Environment = {
  at,
  id: () => supplierId,
  directory,
  bankKey,
}

function principal(id: string, roles: readonly string[], canWrite = true, dashboardAdmin = false): ResolvedActor {
  return {
    id,
    canWrite,
    roles: [
      ...roles.map((role) => ({ surface: "procurement" as const, role })),
      ...(dashboardAdmin ? [{ surface: "dashboard" as const, role: "admin" }] : []),
    ],
  }
}

function fixture() {
  const seeded: Snapshot = empty()
  const created = domain.execute(
    seeded,
    { id: "seed-admin", canWrite: true, roles: ["admin", "buyer"] },
    {
      page: "Suppliers",
      action: "create",
      version: 0,
      values: {
        legalName: "Projection Supplier Ltd",
        country: "CH",
        address: "Rue de la Banque 1",
        taxId: "CHE-BANK-1",
        contactEmail: "finance@supplier.test",
        paymentTerms: "Net 30",
        riskRating: "Low",
        dueDiligence: true,
        sanctionsDate: "2026-11-01",
        ...bankSecrets,
      },
    },
    environment,
  )
  if (!created.ok) throw new Error("Could not create the actual encrypted supplier fixture")
  const stored = (seeded.data.store as { suppliers: Record<string, unknown>[] }).suppliers[0]!
  expect(stored.iban).not.toBe(bankSecrets.iban)
  expect(stored.account).not.toBe(bankSecrets.account)
  stored.history = [
    ...(stored.history as Record<string, unknown>[]),
    ...bankFields.map((field) => ({ field, oldValue: historicBankSecrets[field] })),
    {
      field: "legacy-bank-record",
      details: { ...historicBankSecrets },
      note: "Historical bank values",
    },
    { field: "paymentTerms", oldValue: "Net 15", value: "Net 30" },
  ]

  const storage = testPersistence({ procurement: seeded })
  const session: { principal: ResolvedActor | null } = { principal: principal("admin", ["admin"]) }
  const handler = createApplication("/sucafina", {
    authenticate: async () => session.principal,
    persistence: storage.persistence,
    environment: async () => environment,
    domains: {
      dashboard: [],
      planner: [],
      procurement: [{ pages, domain, render }],
    },
    maxJsonBytes: 1_000_000,
    presentation: "native",
  })
  const readNative = async (who: ResolvedActor) => {
    session.principal = who
    const response = await handler(new Request(`${origin}/sucafina/procurement?page=Suppliers&year=2026&month=11`))
    if (!response) throw new Error("Procurement application did not handle its supplier view")
    if (!response.ok) throw new Error(`Native supplier view failed with ${response.status}`)
    return await response.json() as Record<string, unknown>
  }
  return { state: storage.state.procurement, readNative }
}

function projectedSupplier(data: Record<string, unknown>) {
  const suppliers = data.suppliers
  if (!Array.isArray(suppliers) || !suppliers[0] || typeof suppliers[0] !== "object")
    throw new Error("Expected the seeded supplier in the authorized view")
  return suppliers[0] as Record<string, unknown>
}

function expectHistoryRedacted(supplier: Record<string, unknown>) {
  expect(supplier.history).toEqual([
    ...bankFields.map((field) => ({ field })),
    ...bankFields.map((field) => ({ field })),
    { field: "legacy-bank-record", details: {}, note: "Historical bank values" },
    { field: "paymentTerms", oldValue: "Net 15", value: "Net 30" },
  ])
}

function expectBankHidden(supplier: Record<string, unknown>, serializedProjection: string) {
  expect(supplier.iban).toBe("masked")
  expect(supplier.account).toBe("masked")
  for (const field of ["swift", "bankName", "accountHolder", "bankCountry"] as const)
    expect([undefined, null, "", "masked"].some((marker) => marker === supplier[field])).toBe(true)
  for (const secret of allBankSecrets) expect(serializedProjection).not.toContain(secret)
  expectHistoryRedacted(supplier)
  expect(supplier).toMatchObject({ legalName: "Projection Supplier Ltd", taxId: "CHE-BANK-1" })
}

function expectBankVisible(supplier: Record<string, unknown>, serializedProjection: string) {
  expect(supplier).toMatchObject({
    ...bankSecrets,
    legalName: "Projection Supplier Ltd",
    taxId: "CHE-BANK-1",
  })
  for (const secret of Object.values(bankSecrets)) expect(serializedProjection).toContain(secret)
  for (const secret of Object.values(historicBankSecrets)) expect(serializedProjection).not.toContain(secret)
  expectHistoryRedacted(supplier)
}

test("domain.view with buyer, viewer, requester, or approver never projects supplier bank data", () => {
  const app = fixture()
  const before = structuredClone(app.state)
  for (const role of nonPrivilegedRoles) {
    const actor: Actor = { id: role, canWrite: role !== "viewer", roles: [role] }
    const view = domain.view(app.state, actor, environment)
    expect(view.data.bankVisible).toBe(false)
    expectBankHidden(projectedSupplier(view.data), JSON.stringify(view))
    expect(app.state).toEqual(before)
  }
})

test("domain.view reveals encrypted bank details only to admin or supplier admin, including combined roles", () => {
  const app = fixture()
  const before = structuredClone(app.state)
  for (const roles of privilegedRoles) {
    const view = domain.view(app.state, { id: "privileged", canWrite: true, roles: [...roles] }, environment)
    expect(view.data.bankVisible).toBe(true)
    expectBankVisible(projectedSupplier(view.data), JSON.stringify(view))
    expect(app.state).toEqual(before)
  }
})

test("native application JSON preserves the same bank projection and does not mutate storage", async () => {
  const app = fixture()
  const before = structuredClone(app.state)
  for (const role of nonPrivilegedRoles) {
    const response = await app.readNative(principal(role, [role], role !== "viewer"))
    expect((response.data as Record<string, unknown>).bankVisible).toBe(false)
    expectBankHidden(projectedSupplier(response.data as Record<string, unknown>), JSON.stringify(response))
    expect(app.state).toEqual(before)
  }
  const crossSurfaceAdmin = await app.readNative(principal("cross-surface-admin", ["buyer"], true, true))
  expect((crossSurfaceAdmin.data as Record<string, unknown>).bankVisible).toBe(false)
  expectBankHidden(
    projectedSupplier(crossSurfaceAdmin.data as Record<string, unknown>),
    JSON.stringify(crossSurfaceAdmin),
  )
  expect(app.state).toEqual(before)
  for (const [index, roles] of privilegedRoles.entries()) {
    const id = ["admin", "supplier-admin", "buyer-supplier-admin"][index]!
    const response = await app.readNative(principal(id, roles))
    expect((response.data as Record<string, unknown>).bankVisible).toBe(true)
    expectBankVisible(projectedSupplier(response.data as Record<string, unknown>), JSON.stringify(response))
    expect(app.state).toEqual(before)
  }
})
