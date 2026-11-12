import { expect, test } from "bun:test"
import { domain, render } from "../runtime/procurement.ts"
import type { Snapshot } from "../runtime/contract.ts"
import { initialProcurementSettings, legalInitialSettings } from "../src/initial-settings.ts"
import { seal } from "../src/supplier.ts"

const admin = { id: "admin", canWrite: true, roles: ["admin"] }
const environment = { at: "2026-11-12T12:00:00Z", id: () => "new-id", directory: [] }
const originalSettings = {
  currency: "USD",
  levels: [
    { id: "L1", name: "CIO-1 (Level 1)", threshold: 0, holderId: null },
    { id: "L2", name: "CIO (Level 2)", threshold: 30000, holderId: null },
  ],
  prApprovalMode: "first",
  minQuotes: 3,
  techWeight: 60,
  commWeight: 40,
  fxRates: [
    { code: "USD", rate: 1 },
    { code: "EUR", rate: 1.08 },
    { code: "CHF", rate: 1.13 },
    { code: "GBP", rate: 1.28 },
    { code: "BRL", rate: 0.18 },
    { code: "SGD", rate: 0.75 },
  ],
  fxUpdated: "",
  commCriteria: [
    { name: "Price (calculated — lowest offer scores highest)", weight: 70, auto: true },
    { name: "Payment terms", weight: 15 },
    { name: "Contract terms & flexibility", weight: 15 },
  ],
  criteria: [
    { name: "Functional / technical fit", weight: 35 },
    { name: "Quality & references", weight: 20 },
    { name: "Delivery & implementation plan", weight: 15 },
    { name: "Support & SLA", weight: 15 },
    { name: "Supplier risk & compliance", weight: 15 },
  ],
  paymentTerms: [
    "Net 30",
    "Net 45",
    "Net 60",
    "Net 90",
    "30% upfront / 70% on delivery",
    "50% upfront / 50% on acceptance",
    "Monthly in arrears",
    "Quarterly in advance",
    "Annual in advance",
  ],
  incoterms: ["N/A (service)", "EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP"],
  categories: [
    "Hardware",
    "Software licences",
    "SaaS subscription",
    "Professional services",
    "Managed services",
    "Telecom & network",
    "Training",
    "Other",
  ],
  billingAddress: "",
  defaultDeliveryAddress: "",
  blockSelfApproval: false,
  requireActiveSupplier: false,
  reminderDays: null,
  escalationDays: null,
  uploadCap: null,
}

function snapshot(data: Record<string, unknown> = {}): Snapshot {
  return { data, versions: {}, sequences: {}, audit: [], notices: [] }
}

function details(html: string) {
  return [...html.matchAll(/<details\b([^>]*)>([\s\S]*?)<\/details>/g)].map((match) => ({
    attributes: (match[1] ?? "").trim(),
    body: match[2] ?? "",
  }))
}

test("settings reset restores the original complete defaults and preserves procurement records", () => {
  const request = {
    number: "PR-2026-0042",
    status: "po_issued",
    createdBy: "buyer",
    pr: { title: "Frozen request", estAmount: 42000 },
    prApproval: { amount: 42000, steps: [{ holderId: "approved-holder", status: "approved" }] },
    po: { number: "PO-0042", supplier: "Coffee Systems", supplierId: "sup-42", lines: [{ qty: 1, unitPrice: 42000 }] },
  }
  const supplier = {
    id: "sup-42",
    number: "SUP-00042",
    legalName: "Coffee Systems",
    status: "active",
    history: [{ field: "status", value: "active" }],
  }
  const state = snapshot({
    store: {
      settings: {
        ...structuredClone(originalSettings),
        currency: "EUR",
        techWeight: 80,
        commWeight: 20,
        billingAddress: "Changed billing address",
        defaultDeliveryAddress: "Changed delivery address",
        fxRates: [{ code: "USD", rate: 1 }, { code: "EUR", rate: 1.1 }],
        fxUpdated: "2026-11-10T00:00:00Z",
      },
      requests: { [request.number]: { version: 8, by: "buyer", request } },
      suppliers: [supplier],
      issued: { pr: [request.number], po: ["PO-0042"] },
      sup: ["SUP-00042"],
      actCalls: 13,
      lastIssued: { pr: [request.number], po: ["PO-0042"] },
    },
  })
  const recordsBefore = structuredClone(state.data.store as Record<string, unknown>)

  expect(
    domain.execute(state, admin, { page: "Settings", action: "reset", version: 0, values: {} }, environment).ok,
  ).toBe(true)

  const stored = state.data.store as Record<string, unknown>
  expect(stored.settings).toEqual(originalSettings)
  expect(initialProcurementSettings() as unknown as Record<string, unknown>).toEqual(originalSettings)
  expect(legalInitialSettings()).toEqual({
    currency: "USD",
    levels: [
      { id: "L1", name: "CIO-1 (Level 1)", threshold: 0, holderId: null },
      { id: "L2", name: "CIO (Level 2)", threshold: 30000, holderId: null },
    ],
    prApprovalMode: "first",
    blockSelfApproval: false,
    fxRates: [
      { code: "USD", rate: 1 },
      { code: "EUR", rate: 1.08 },
      { code: "CHF", rate: 1.13 },
      { code: "GBP", rate: 1.28 },
      { code: "BRL", rate: 0.18 },
      { code: "SGD", rate: 0.75 },
    ],
  })
  expect(stored.requests).toEqual(recordsBefore.requests)
  expect(stored.suppliers).toEqual(recordsBefore.suppliers)
  expect(stored.issued).toEqual(recordsBefore.issued)
  expect(stored.sup).toEqual(recordsBefore.sup)
  expect(stored.actCalls).toBe(recordsBefore.actCalls)
  expect(stored.lastIssued).toEqual(recordsBefore.lastIssued)
})

test("default addresses and FX update date save, read, render and reset to empty defaults", () => {
  const state = snapshot({ store: { settings: structuredClone(originalSettings), requests: {}, suppliers: [] } })
  const addresses = {
    billingAddress: "Sucafina Accounts Payable\n10 Coffee Road",
    defaultDeliveryAddress: "Warehouse 4\nPort of Santos",
    fxUpdated: "2026-11-10",
  }
  expect(
    domain.execute(state, admin, { page: "Settings", action: "save", version: 0, values: addresses }, environment).ok,
  ).toBe(true)

  const viewed = domain.view(state, admin, environment).data
  expect(viewed.settings).toMatchObject(addresses)
  const html = render("Settings", viewed, {
    actor: admin,
    year: 2026,
    month: 11,
    at: environment.at,
    versions: state.versions,
  })!
  expect(html).toContain('<textarea name="billingAddress">Sucafina Accounts Payable\n10 Coffee Road</textarea>')
  expect(html).toContain('<textarea name="defaultDeliveryAddress">Warehouse 4\nPort of Santos</textarea>')
  expect(html).toContain('<input name="fxUpdated" type="date" value="2026-11-10">')

  expect(
    domain.execute(
      state,
      admin,
      { page: "Settings", action: "reset", version: state.versions.settings!.version, values: {} },
      environment,
    ).ok,
  ).toBe(true)
  expect(domain.view(state, admin, environment).data.settings).toMatchObject({
    billingAddress: "",
    defaultDeliveryAddress: "",
    fxUpdated: "",
  })
})

test("new PO proposals use saved address defaults and retain existing nonblank PO addresses", () => {
  const id = "PR-2026-0045"
  const settings = {
    ...structuredClone(originalSettings),
    billingAddress: "Invoice HQ\nAccounts Payable",
    defaultDeliveryAddress: "Main Warehouse\nSantos",
  }
  const request = {
    number: id,
    status: "sourcing",
    createdBy: "buyer",
    pr: { estAmount: 500, recurring: false, expenseType: "OPEX", title: "Coffee equipment" },
    prApproval: null,
    sourcing: {
      quotes: [
        {
          id: "q1",
          supplier: "Coffee Supplier",
          supplierId: null,
          currency: "USD",
          total: 500,
          qty: 1,
          unitPrice: 500,
          techPass: true,
        },
      ],
      selectedId: null,
      fxSnapshot: null,
      approval: null,
      contractStrategy: "new",
    },
    po: null,
    history: [],
  }
  const state = snapshot({
    store: {
      settings,
      requests: { [id]: { version: 1, by: "buyer", request } },
      suppliers: [],
      issued: { pr: [id], po: [] },
    },
  })
  state.versions[`requests:${id}`] = { version: 1, by: "buyer" }
  const buyer = { id: "buyer", canWrite: true, roles: ["buyer"] }

  expect(
    domain.execute(
      state,
      buyer,
      { page: "Requests", action: "select_quote", id, version: 1, values: { quoteId: "q1" } },
      environment,
    ).ok,
  ).toBe(true)
  const proposal = (domain.view(state, buyer, environment).data.requests as Record<string, unknown>[])[0]!.po
  expect(proposal).toMatchObject({
    billingAddress: settings.billingAddress,
    deliveryAddress: settings.defaultDeliveryAddress,
  })

  const existingPoState = snapshot({
    store: {
      settings,
      requests: {
        [id]: {
          version: 1,
          by: "buyer",
          request: {
            ...request,
            po: {
              number: "PO-0045",
              currency: "USD",
              fxRate: null,
              expenseType: "OPEX",
              supplier: "Previous supplier",
              supplierId: null,
              sourceQuoteId: "old-quote",
              lines: [{ qty: 1, unitPrice: 450 }],
              approval: null,
              issuedAt: null,
              billingAddress: "Existing invoice address",
              deliveryAddress: "Existing delivery address",
            },
          },
        },
      },
      suppliers: [],
      issued: { pr: [id], po: ["PO-0045"] },
    },
  })
  existingPoState.versions[`requests:${id}`] = { version: 1, by: "buyer" }
  expect(
    domain.execute(
      existingPoState,
      buyer,
      { page: "Requests", action: "select_quote", id, version: 1, values: { quoteId: "q1" } },
      environment,
    ).ok,
  ).toBe(true)
  const existingProposal =
    (domain.view(existingPoState, buyer, environment).data.requests as Record<string, unknown>[])[0]!.po
  expect(existingProposal).toMatchObject({
    billingAddress: "Existing invoice address",
    deliveryAddress: "Existing delivery address",
  })
})

test("request query opens its authorized target, includes closed rows and leaves other rows closed", () => {
  const html = render(
    "Requests",
    {
      filter: "Open",
      request: "PR-2026-0042",
      requests: [
        { number: "PR-2026-0042", status: "po_issued", pr: { title: "Closed target" } },
        { number: "PR-2026-0043", status: "draft", pr: { title: "Other open record" } },
        { number: "PR-2026-0044", status: "cancelled", pr: { title: "Other closed record" } },
      ],
    },
    { actor: admin, year: 2026, month: 11, at: environment.at, versions: {} },
  )!
  const rendered = details(html)

  expect(rendered.map((item) => item.attributes)).toContain('id="PR-2026-0042" open')
  expect(rendered.map((item) => item.attributes)).toContain('id="PR-2026-0043"')
  expect(rendered.map((item) => item.attributes)).toContain('id="PR-2026-0044"')
  expect(rendered.filter((item) => /\bopen\b/.test(item.attributes)).map((item) => item.attributes)).toEqual([
    'id="PR-2026-0042" open',
  ])
})

test("request query cannot reveal a record omitted by the authorization-filtered view", () => {
  const state = snapshot({
    store: {
      settings: structuredClone(originalSettings),
      requests: {
        "PR-2026-0001": {
          version: 1,
          by: "requester",
          request: {
            number: "PR-2026-0001",
            createdBy: "requester",
            status: "draft",
            pr: { title: "Visible own request" },
          },
        },
        "PR-2026-9999": {
          version: 1,
          by: "someone-else",
          request: {
            number: "PR-2026-9999",
            createdBy: "someone-else",
            status: "po_issued",
            pr: { title: "Private request outside view" },
          },
        },
      },
      suppliers: [],
    },
  })
  const requester = { id: "requester", canWrite: false, roles: ["requester"] }
  const viewed = domain.view(state, requester, environment).data
  const html = render(
    "Requests",
    { ...viewed, filter: "Open", request: "PR-2026-9999" },
    { actor: requester, year: 2026, month: 11, at: environment.at, versions: {} },
  )!

  expect(html).toContain("Visible own request")
  expect(html).not.toContain("PR-2026-9999")
  expect(html).not.toContain("Private request outside view")
  expect(details(html).some((item) => /\bopen\b/.test(item.attributes))).toBe(false)
})

test("supplier query opens only its matching visible supplier detail", () => {
  const html = render(
    "Suppliers",
    {
      supplier: "sup-42",
      suppliers: [
        { id: "sup-41", number: "SUP-00041", legalName: "Other Supplier", status: "active" },
        { id: "sup-42", number: "SUP-00042", legalName: "Target Supplier", status: "inactive" },
      ],
    },
    { actor: admin, year: 2026, month: 11, at: environment.at, versions: {} },
  )!
  const rendered = details(html)

  expect(rendered.map((item) => item.attributes)).toContain('id="supplier-sup-41"')
  expect(rendered.map((item) => item.attributes)).toContain('id="supplier-sup-42" open')
  expect(rendered.filter((item) => /\bopen\b/.test(item.attributes)).map((item) => item.attributes)).toEqual([
    'id="supplier-sup-42" open',
  ])
})

test("requester supplier deeplink opens the real view target while bank values stay masked", () => {
  const bankKey = new Uint8Array(32).fill(7)
  const iban = "GB29NWBK60161331926819"
  const account = "ACCOUNT-DO-NOT-DISCLOSE"
  const swift = "SECRET-BIC-CODE"
  const encryptedIban = seal(iban, bankKey)
  const encryptedAccount = seal(account, bankKey)
  const supplier = {
    id: "supplier-bank-view",
    number: "SUP-00043",
    legalName: "Visible Coffee Supplier",
    status: "active",
    country: "GB",
    address: "10 Coffee Road",
    taxId: "TAX-43",
    contactEmail: "finance@example.test",
    paymentTerms: "Net 30",
    riskRating: "Low",
    dueDiligence: true,
    sanctionsDate: "2026-11-01",
    iban: encryptedIban,
    account: encryptedAccount,
    swift,
    bankName: "Example Bank",
  }
  const state = snapshot({
    store: { settings: structuredClone(originalSettings), requests: {}, suppliers: [supplier] },
  })
  const requester = { id: "requester", canWrite: false, roles: ["requester"] }
  const viewed = domain.view(state, requester, { ...environment, bankKey }).data
  const viewedSupplier = (viewed.suppliers as Record<string, unknown>[])[0]!

  expect(viewedSupplier.id).toBe(supplier.id)
  expect(viewedSupplier.iban).toBe("masked")
  expect(viewedSupplier.account).toBe("masked")
  expect(viewedSupplier.swift).toBeUndefined()
  expect(JSON.stringify(viewed)).not.toContain(iban)
  expect(JSON.stringify(viewed)).not.toContain(account)
  expect(JSON.stringify(viewed)).not.toContain(swift)
  expect(JSON.stringify(viewed)).not.toContain(encryptedIban)
  expect(JSON.stringify(viewed)).not.toContain(encryptedAccount)

  const html = render(
    "Suppliers",
    { ...viewed, supplier: supplier.id },
    { actor: requester, year: 2026, month: 11, at: environment.at, versions: {} },
  )!
  expect(html).toContain("Visible Coffee Supplier")
  expect(html).toContain('id="supplier-supplier-bank-view" open')
  expect(html).toContain("Bank details masked.")
  expect(html).not.toContain(iban)
  expect(html).not.toContain(account)
  expect(html).not.toContain(swift)
  expect(html).not.toContain(encryptedIban)
  expect(html).not.toContain(encryptedAccount)
})

test("unknown supplier query opens no supplier detail or exposes a record outside view", () => {
  const html = render(
    "Suppliers",
    {
      supplier: "private-supplier",
      suppliers: [{ id: "visible-supplier", legalName: "Visible supplier", status: "active" }],
    },
    { actor: admin, year: 2026, month: 11, at: environment.at, versions: {} },
  )!

  expect(html).toContain("Visible supplier")
  expect(html).not.toContain("private-supplier")
  expect(details(html).some((item) => /\bopen\b/.test(item.attributes))).toBe(false)
})

test("supplier query cannot open or disclose a supplier excluded from the authorization-filtered view", () => {
  const html = render(
    "Suppliers",
    {
      supplier: "private-supplier-99",
      suppliers: [{ id: "visible-supplier", legalName: "Visible supplier", status: "active" }],
    },
    { actor: admin, year: 2026, month: 11, at: environment.at, versions: {} },
  )!

  expect(html).toContain("Visible supplier")
  expect(html).not.toContain("private-supplier-99")
  expect(details(html).map((item) => item.attributes)).toEqual(['id="supplier-visible-supplier"'])
  expect(details(html).some((item) => /\bopen\b/.test(item.attributes))).toBe(false)
})
