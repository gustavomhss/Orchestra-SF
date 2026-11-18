import { act } from "../../porta/act.ts"
import { initialProcurementSettings, legalInitialSettings } from "../src/initial-settings.ts"
import { expect, test } from "bun:test"
import { domain, pages, render } from "../runtime/procurement.ts"
import { object, rows } from "../runtime/contract.ts"
import type { Snapshot } from "../runtime/contract.ts"
const actor = { id: "directory-admin", canWrite: true, roles: ["admin"] }
const at = "2026-11-11T12:00:00Z"
function snapshot(): Snapshot {
  return { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
}
test("procurement required pages contain functional controls or nonempty read views", () => {
  for (const page of pages) {
    const html = render(page, {}, { actor, year: 2026, month: 11, at, versions: {} })
    expect(html).toBeString()
    expect(html!.length).toBeGreaterThan(80)
    expect(html).toMatch(/<table|<form|class="metric"/)
  }
})
test("procurement direct write without canWrite fails atomically", () => {
  const state = snapshot()
  const before = structuredClone(state)
  expect(
    domain.execute(
      state,
      { ...actor, canWrite: false },
      { page: pages[0], action: "save", version: 0, values: {} },
      { at, id: () => "server-id", directory: [] },
    ),
  ).toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(before)
})

test("request fields survive creation, save, submission and actual holder decisions", () => {
  const state = snapshot()
  const requester = { id: "owner", canWrite: true, roles: ["requester"] }
  const environment = { at, id: () => "supplier-id", directory: [] }
  expect(
    domain.execute(state, actor, { page: "Settings", action: "reset", version: 0, values: {} }, environment).ok,
  ).toBe(true)
  const pr = {
    title: "Laptop <fleet>",
    type: "product",
    description: "Engineering",
    estAmount: 100,
    costCenter: "IT",
    needBy: "2026-12-01",
    justification: "Refresh",
    recurring: false,
    expenseType: "CAPEX",
  }
  const created = domain.execute(
    state,
    requester,
    { page: "Requests", action: "create", version: 0, values: { pr } },
    environment,
  )
  expect(created.ok).toBe(true)
  const requests = domain.view(state, requester, environment).data.requests as Record<string, unknown>[]
  const id = String(requests[0]!.number)
  expect(
    domain.execute(
      state,
      requester,
      { page: "Requests", action: "submit_pr", id, version: 1, values: { pr } },
      environment,
    ).ok,
  ).toBe(true)
  expect((domain.view(state, requester, environment).data.requests as Record<string, unknown>[])[0]!.prApprovalBaseCurrency).toBe("USD")
  expect(
    domain.execute(state, actor, { page: "Requests", action: "approve", id, version: 2, values: {} }, environment).ok,
  ).toBe(true)
  expect((domain.view(state, requester, environment).data.requests as Record<string, unknown>[])[0]!.pr).toMatchObject(
    pr,
  )
  expect(domain.view(state, { ...requester, id: "other" }, environment).data.requests).toEqual([])
  const before = structuredClone(state)
  expect(
    domain.execute(state, requester, { page: "Requests", action: "save", id, version: 1, values: { pr } }, environment),
  ).toMatchObject({ ok: false, status: 409 })
  expect(state).toEqual(before)
})

test("supplier creation persists and deletion never reuses its SUP allocation", () => {
  const state = snapshot()
  const buyer = { id: "buyer", roles: ["buyer"], canWrite: true }
  const environment = {
    at,
    id: () => "s1",
    directory: [],
    bankKey: new Uint8Array(32).fill(7),
  }
  expect(
    domain.execute(
      state,
      buyer,
      {
        page: "Suppliers",
        action: "create",
        version: 0,
        values: { legalName: "Acme", taxId: "T1" },
      },
      environment,
    ).ok,
  ).toBe(true)
  const before = structuredClone(state)
  expect(
    domain.execute(
      state,
      buyer,
      {
        page: "Suppliers",
        action: "create",
        version: 0,
        values: { legalName: "Other", taxId: "T1" },
      },
      { ...environment, id: () => "s2" },
    ).ok,
  ).toBe(false)
  expect(state).toEqual(before)
  expect(
    domain.execute(state, buyer, { page: "Suppliers", action: "delete", id: "s1", version: 1, values: {} }, environment)
      .ok,
  ).toBe(true)
  expect(
    domain.execute(
      state,
      buyer,
      {
        page: "Suppliers",
        action: "create",
        version: 0,
        values: { legalName: "Other" },
      },
      { ...environment, id: () => "s2" },
    ).ok,
  ).toBe(true)
  expect((domain.view(state, buyer, environment).data.suppliers as Record<string, unknown>[])[0]).toMatchObject({
    number: "SUP-00002",
  })
})

test("complete procurement field roundtrip and frozen approvals survive settings edits", () => {
  const state = snapshot()
  const environment = { at, id: () => "vendor", directory: [] }
  const requester = { id: "requester", canWrite: true, roles: ["requester"] }
  const buyer = { id: "buyer", canWrite: true, roles: ["buyer"] }
  const holder = { id: "holder", canWrite: true, roles: ["approver"] }
  const run = (
    who: typeof actor,
    action: string,
    values: Record<string, unknown> = {},
    id?: string,
    page = "Requests",
  ) =>
    domain.execute(
      state,
      who,
      {
        page,
        action,
        id,
        version: state.versions[page === "Settings" ? "settings" : `${page === "Suppliers" ? "suppliers" : "requests"}:${id ?? ""}`]?.version ?? 0,
        values,
      },
      environment,
    )
  expect(run(actor, "reset", {}, undefined, "Settings").ok).toBe(true)
  const completeSettings = {
    ...initialProcurementSettings(),
    levels: [{ id: "L1", name: "Level one", threshold: 0, holderId: "holder" }, { id: "L2", name: "Level two", threshold: 10000, holderId: "senior-holder" }],
    paymentTerms: ["Net 30", "Negotiated milestone"], categories: ["Services", "Software"], incoterms: ["N/A (service)", "DAP"],
    billingAddress: "Recorded billing address", defaultDeliveryAddress: "Recorded delivery address", fxUpdated: "2026-11-10",
    reminderDays: 3, escalationDays: 7, uploadCap: 8000000,
  }
  expect(
    run(
      actor,
      "save",
      completeSettings,
      undefined,
      "Settings",
    ).ok,
  ).toBe(true)
  expect(domain.view(state, actor, environment).data.settings).toEqual(completeSettings)
  // Retained imported allocation must remain the floor for the next real PO.
  object(object(state.data.store).issued).po = ["PO-2026-9999"]
  const supplier = {
    legalName: "Vendor", tradingName: "Vendor trading", type: "company", country: "CH", address: "Supplier address", taxId: "CH-123", regNo: "REG-123",
    contactName: "Commercial contact", contactEmail: "commercial@example.test", contactPhone: "+410000001", financeEmail: "finance@example.test",
    paymentTerms: "Net 30", currency: "USD", incoterm: "N/A (service)", riskRating: "low", dueDiligence: true, sanctionsDate: "2026-11-01",
    nda: true, dpa: true, certifications: "ISO 9001", categories: ["Services", "Software"],
    contacts: [{ name: "Commercial contact", email: "commercial@example.test", phone: "+410000001" }, { name: "Delivery contact", email: "delivery@example.test", phone: "+410000002" }],
    commercial: { notes: "Agreed service terms" }, compliance: { notes: "Recorded due diligence" }, notes: "Supplier notes",
  }
  expect(run(buyer, "create", supplier, undefined, "Suppliers").ok).toBe(true)
  expect(run(buyer, "save", supplier, "vendor", "Suppliers").ok).toBe(true)
  const savedSupplier = rows(domain.view(state, buyer, environment).data.suppliers).find((row) => row.id === "vendor")
  expect(savedSupplier).toMatchObject(supplier)
  expect(savedSupplier?.contacts).toEqual(supplier.contacts)
  const pr = {
    title: "Services",
    type: "service",
    description: "Implementation",
    estAmount: 500,
    costCenter: "IT",
    needBy: "2026-12-01",
    justification: "Delivery",
    recurring: true,
    frequency: "quarterly",
    estAnnual: 2000,
    expenseType: "OPEX",
    category: "Services",
    requesterName: "Recorded requester contact",
  }
  const creation = run(requester, "create", { pr })
  expect(creation.ok).toBe(true)
  if (!creation.ok) throw new Error("creation failed")
  const id = String((creation.value as Record<string, unknown>).number)
  expect(run(requester, "submit_pr", { pr }, id).ok).toBe(true)
  const beforeOverride = structuredClone(state)
  expect(run(actor, "approve", {}, id)).toMatchObject({
    ok: false,
    errors: ["no_override"],
  })
  expect(state).toEqual(beforeOverride)
  expect(
    run(
      actor,
      "save",
      {
        levels: [{ id: "L1", name: "Changed", threshold: 0, holderId: "different" }],
      },
      undefined,
      "Settings",
    ).ok,
  ).toBe(true)
  expect(run(holder, "approve", {}, id).ok).toBe(true)
  const sourcing = {
    quotes: [
      {
        id: "q1",
        supplier: "Vendor",
        supplierId: "vendor",
        currency: "USD",
        total: 500,
        qty: 1,
        unitPrice: 500,
        techPass: true,
        scores: [5],
        cscores: [],
        description: "First complete quotation", notes: "Quoted service scope", attachments: [{ id: "quote-recorded-1", name: "quote.pdf" }],
      },
      { id: "q2", supplier: "Alternative Vendor", supplierId: null, currency: "USD", total: 600, qty: 2, unitPrice: 300, techPass: true, scores: [4], cscores: [], description: "Second complete quotation", notes: "Alternative terms", attachments: [] },
    ],
    evaluator: "Engineer",
    selectedId: "q1",
    fewQuotesJustification: "Two suppliers responded",
    selectionJustification: "Best",
    contractStrategy: "new",
    weights: {
      tech: 60,
      comm: 40,
      criteria: [{ name: "Recorded technical fit", weight: 1 }],
      commCriteria: [{ name: "Recorded price", weight: 1, auto: true }],
    },
  }
  expect(run(buyer, "save", { sourcing }, id).ok).toBe(true)
  expect(run(buyer, "select_quote", { quoteId: "q1" }, id).ok).toBe(true)
  expect(run(buyer, "submit_sourcing", { sourcing }, id).ok).toBe(true)
  const newHolder = { ...holder, id: "different" }
  expect(run(newHolder, "approve", {}, id).ok).toBe(true)
  const po = {
    currency: "USD",
    supplier: "Vendor",
    supplierId: "vendor",
    description: "Consulting deliverable",
    paymentTerms: "Net 30",
    deliveryDate: "2026-12-20",
    deliveryConditions: "Remote",
    contractRef: "C-1",
    assetRef: "Text reference",
    lines: [
      { description: "Milestone one", desc: "Short one", unit: "day", uom: "DAY", notes: "First line notes", qty: 2, unitPrice: 100 },
      { description: "Milestone two", desc: "Short two", unit: "deliverable", uom: "EA", notes: "Second line notes", qty: 1, unitPrice: 300 },
    ],
    expenseType: "OPEX",
    incoterm: "N/A (service)", incoterms: "Negotiated service terms", supplierContact: "Delivery contact", quoteRef: "Q-2026-1",
    billingAddress: "Negotiated billing address", deliveryAddress: "Negotiated delivery address", acceptance: "Recorded acceptance conditions", warranty: "12 months", notes: "Order notes",
  }
  expect(run(buyer, "submit_po", { po }, id).ok).toBe(true)
  expect(run(newHolder, "approve", {}, id).ok).toBe(true)
  expect(run(buyer, "issue", {}, id).ok).toBe(true)
  const view = domain.view(state, buyer, environment)
  const record = (view.data.requests as Record<string, unknown>[])[0]!
  expect(record.status).toBe("po_issued")
  expect(record.pr).toEqual({ ...pr, contractRecommended: true })
  expect(record.po).toMatchObject(po)
  expect(object(record.po).lines).toEqual(po.lines)
  expect(record.sourcing).toMatchObject(sourcing)
  expect(object(record.sourcing).quotes).toEqual(sourcing.quotes)
  expect(object(record.po).number).toBe("PO-2026-10000")
  expect(object(object(state.data.store).issued).po).toEqual(["PO-2026-9999", "PO-2026-10000"])
  expect(record.po).toMatchObject({ approvalBaseCurrency: "USD" })
  expect(record.sourcing).toMatchObject({ approvalBaseCurrency: "USD" })
  const changedBase = structuredClone(state)
  expect(domain.execute(changedBase, actor, { page: "Settings", action: "save", version: changedBase.versions.settings!.version, values: { currency: "EUR" } }, environment).ok).toBe(true)
  const afterBaseChange = (domain.view(changedBase, buyer, environment).data.requests as Record<string, unknown>[])[0]!
  expect(afterBaseChange.value).toBeNull()
  expect(afterBaseChange.po).toMatchObject({ approvalBaseCurrency: "USD" })
  expect(JSON.stringify(view.data.register)).not.toContain('"scores"')
  expect(state.notices.some((notice) => notice.kind === "pending" && notice.to.includes("holder"))).toBe(true)
  const before = structuredClone(state)
  expect(run(buyer, "cancel", { reason: "Late" }, id).ok).toBe(false)
  expect(run(actor, "delete", {}, id).ok).toBe(false)
  expect(state).toEqual(before)
})

test("bank changes encrypt, reset active validation, audit only fields and protect actor views", () => {
  const state = snapshot()
  const key = new Uint8Array(32).fill(9)
  const environment = { at, id: () => "supplier", directory: [], bankKey: key }
  const buyer = { id: "buyer", canWrite: true, roles: ["buyer"] }
  const supplierAdmin = {
    id: "validator",
    canWrite: true,
    roles: ["supplier admin"],
  }
  const call = (who: typeof actor, action: string, values: Record<string, unknown>, version: number) =>
    domain.execute(state, who, { page: "Suppliers", action, id: "supplier", version, values }, environment)
  expect(
    call(
      buyer,
      "create",
      {
        legalName: "Vendor",
        country: "CH",
        address: "Address",
        taxId: "T",
        contactEmail: "a@b.ch",
        paymentTerms: "30 days",
        riskRating: "Low",
        dueDiligence: true,
        sanctionsDate: "2026-11-11",
      },
      0,
    ).ok,
  ).toBe(true)
  expect(
    call(
      actor,
      "change-bank",
      {
        iban: "PRIVATE-IBAN",
        account: "PRIVATE-ACCOUNT",
        bankName: "Bank",
        swift: "BIC",
      },
      1,
    ).ok,
  ).toBe(true)
  expect(call(supplierAdmin, "activate", {}, 2).ok).toBe(true)
  expect(call(actor, "change-bank", { swift: "NEWBIC" }, 3).ok).toBe(true)
  const stored = (state.data.store as { suppliers: Record<string, unknown>[] }).suppliers[0]!
  expect(stored).toMatchObject({
    status: "pending",
    validatedAt: null,
    validatedBy: null,
  })
  expect(stored.iban).not.toBe("PRIVATE-IBAN")
  expect(stored.history).toContainEqual({ field: "swift" })
  expect(JSON.stringify(state.audit)).not.toContain("PRIVATE-IBAN")
  expect(JSON.stringify(domain.view(state, buyer, environment).data)).not.toContain("PRIVATE-IBAN")
  expect((domain.view(state, actor, environment).data.suppliers as Record<string, unknown>[])[0]!.iban).toBe(
    "PRIVATE-IBAN",
  )
  const before = structuredClone(state)
  expect(call(buyer, "change-bank", { iban: "ATTACK" }, 4)).toMatchObject({
    ok: false,
    status: 403,
  })
  expect(state).toEqual(before)
})

test("unknown pages and actions, missing keys, and invalid PR reject without mutation", () => {
  const state = snapshot()
  const environment = { at, id: () => "s", directory: [] }
  for (const command of [
    { page: "Unknown", action: "create" },
    { page: "Requests", action: "unknown" },
  ]) {
    const before = structuredClone(state)
    expect(domain.execute(state, actor, { ...command, version: 0, values: {} }, environment)).toMatchObject({
      ok: false,
      status: 400,
    })
    expect(state).toEqual(before)
  }
  expect(
    domain.execute(state, actor, { page: "Settings", action: "reset", version: 0, values: {} }, environment).ok,
  ).toBe(true)
  const result = domain.execute(
    state,
    actor,
    { page: "Requests", action: "create", version: 0, values: {} },
    environment,
  )
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error("creation failed")
  const id = String((result.value as Record<string, unknown>).number)
  const before = structuredClone(state)
  expect(
    domain.execute(state, actor, { page: "Requests", action: "submit_pr", id, version: 1, values: {} }, environment),
  ).toMatchObject({ ok: false, status: 422 })
  expect(state).toEqual(before)
  expect(
    domain.execute(
      state,
      { ...actor, roles: ["buyer", "admin"] },
      {
        page: "Suppliers",
        action: "create",
        version: 0,
        values: { iban: "SECRET" },
      },
      environment,
    ),
  ).toMatchObject({ ok: false, status: 503 })
  expect(state).toEqual(before)
})

test("request ownership, self-approval flag and independent record versions are enforced", () => {
  const state = snapshot()
  const env = { at, id: () => "s", directory: [] }
  const owner = { ...actor, id: "owner", roles: ["requester"] }
  expect(domain.execute(state, actor, { page: "Settings", action: "reset", version: 0, values: {} }, env).ok).toBe(true)
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "Settings",
        action: "save",
        version: 1,
        values: { blockSelfApproval: true },
      },
      env,
    ).ok,
  ).toBe(true)
  const pr = {
    title: "Test",
    type: "product",
    description: "Test",
    estAmount: 10,
    costCenter: "IT",
    needBy: "2026-12-01",
    justification: "Test",
    recurring: false,
    expenseType: "OPEX",
  }
  const result = domain.execute(state, owner, { page: "Requests", action: "create", version: 0, values: { pr } }, env)
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error("creation failed")
  const id = String((result.value as Record<string, unknown>).number)
  const before = structuredClone(state)
  expect(
    domain.execute(
      state,
      { ...owner, id: "other" },
      {
        page: "Requests",
        action: "save",
        id,
        version: 1,
        values: { pr: { title: "Attack" } },
      },
      env,
    ),
  ).toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(before)
  expect(
    domain.execute(state, owner, { page: "Requests", action: "submit_pr", id, version: 1, values: { pr } }, env).ok,
  ).toBe(true)
  const pending = structuredClone(state)
  expect(
    domain.execute(state, owner, { page: "Requests", action: "approve", id, version: 2, values: {} }, env),
  ).toMatchObject({ ok: false, errors: ["self_approval"] })
  expect(state).toEqual(pending)
  expect(
    domain.execute(
      state,
      { ...actor, roles: ["buyer"] },
      {
        page: "Suppliers",
        action: "create",
        version: 0,
        values: { legalName: "Independent" },
      },
      env,
    ).ok,
  ).toBe(true)
  expect(state.versions[`requests:${id}`]!.version).toBe(2)
  expect(state.versions.settings!.version).toBe(2)
  expect(state.versions["suppliers:s"]!.version).toBe(1)
})

test("render escapes persisted values and the PO document excludes banking", () => {
  const request = {
    number: "PR-2026-0001",
    status: "draft",
    createdBy: actor.id,
    pr: { title: '<img src=x onerror="bad">' },
    sourcing: null,
    po: {
      number: "PO-2026-0001",
      supplier: "Vendor",
      description: "<script>bad</script>",
      iban: "NEVER-PRINT",
      lines: [],
    },
    history: [],
  }
  const html = render("Requests", { requests: [request] }, { actor, year: 2026, month: 11, at, versions: {} })!
  expect(html).toContain("&lt;img")
  expect(html).not.toContain("<script>bad")
  expect(html).not.toContain("NEVER-PRINT")
  expect(html).toContain('data-command="submit_po"')
  expect(render("Not owned", {}, { actor, year: 2026, month: 11, at, versions: {} })).toBeUndefined()
})

test("imported high-water marks and deleted requests do not reuse issued numbers", () => {
  const state = snapshot()
  const env = { at, id: () => "supplier", directory: [] }
  expect(domain.execute(state, actor, { page: "Settings", action: "reset", version: 0, values: {} }, env).ok).toBe(true)
  const store = state.data.store as {
    issued: { pr: string[]; po: string[] }
    sup: string[]
    lastIssued: { pr: string[] } | null
  }
  store.issued.pr = ["PR-2026-9999"]
  store.sup = ["SUP-00499"]
  const first = domain.execute(state, actor, { page: "Requests", action: "create", version: 0, values: {} }, env)
  expect(first).toMatchObject({ ok: true, value: { number: "PR-2026-10000" } })
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "Requests",
        action: "delete",
        id: "PR-2026-10000",
        version: 1,
        values: {},
      },
      env,
    ).ok,
  ).toBe(true)
  expect(
    domain.execute(state, actor, { page: "Requests", action: "create", version: 0, values: {} }, env),
  ).toMatchObject({ ok: true, value: { number: "PR-2026-10001" } })
  expect((state.data.store as typeof store).lastIssued!.pr).toContain("PR-2026-10000")
  expect(
    domain.execute(
      state,
      { ...actor, roles: ["buyer"] },
      {
        page: "Suppliers",
        action: "create",
        version: 0,
        values: { legalName: "Imported sequence" },
      },
      env,
    ),
  ).toMatchObject({ ok: true, value: { number: "SUP-00500" } })
})

test("asset metadata survives business transitions and deletion returns the deleted record", () => {
  const state = snapshot()
  const env = { at, id: () => "supplier", directory: [] }
  expect(domain.execute(state, actor, { page: "Settings", action: "reset", version: 0, values: {} }, env).ok).toBe(true)
  const creation = domain.execute(state, actor, { page: "Requests", action: "create", version: 0, values: {} }, env)
  expect(creation.ok).toBe(true)
  if (!creation.ok) throw new Error("creation failed")
  const id = String((creation.value as Record<string, unknown>).number)
  const record = (
    state.data.store as {
      requests: Record<string, { request: Record<string, unknown> }>
    }
  ).requests[id]!.request
  record.attachments = [{ id: "a1", blobKey: "private/blob", name: "quote.txt" }]
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "Requests",
        action: "save",
        id,
        version: 1,
        values: {
          pr: { title: "Saved" },
          attachments: [{ blobKey: "forged" }],
        },
      },
      env,
    ).ok,
  ).toBe(true)
  const deletion = domain.execute(state, actor, { page: "Requests", action: "delete", id, version: 2, values: {} }, env)
  expect(deletion).toMatchObject({
    ok: true,
    value: {
      deleted: {
        attachments: [{ id: "a1", blobKey: "private/blob", name: "quote.txt" }],
      },
    },
  })
  expect(state.versions[`requests:${id}`]!.version).toBe(3)
})

test("ordinary nested form rows decode and numeric supplier references remain linked", () => {
  const state = snapshot()
  const env = { at, id: () => "s", directory: [] }
  expect(domain.execute(state, actor, { page: "Settings", action: "reset", version: 0, values: {} }, env).ok).toBe(true)
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "Settings",
        action: "save",
        version: 1,
        values: {
          "levels.0.id": "L1",
          "levels.0.name": "Reviewer",
          "levels.0.threshold": "0",
          "levels.0.holderId": "",
          "fxRates.0.code": "USD",
          "fxRates.0.rate": "1",
        },
      },
      env,
    ).ok,
  ).toBe(true)
  const result = domain.execute(
    state,
    actor,
    {
      page: "Requests",
      action: "create",
      version: 0,
      values: {
        "pr.title": "Typed form",
        "pr.estAmount": "125",
        "pr.recurring": "false",
      },
    },
    env,
  )
  expect(result).toMatchObject({
    ok: true,
    value: { pr: { title: "Typed form", estAmount: 125, recurring: false } },
  })
  const store = state.data.store as {
    suppliers: Record<string, unknown>[]
    requests: Record<string, { request: Record<string, unknown> }>
  }
  store.suppliers.push({
    id: 7,
    number: "SUP-00007",
    legalName: "Legacy",
    status: "pending",
  })
  const request = Object.values(store.requests)[0]!.request
  request.sourcing = { quotes: [{ id: 12, supplierId: 7 }], selectedId: 12 }
  const before = structuredClone(state)
  expect(
    domain.execute(
      state,
      { ...actor, roles: ["buyer"] },
      { page: "Suppliers", action: "delete", id: "7", version: 0, values: {} },
      env,
    ),
  ).toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(before)
  const html = render("Suppliers", domain.view(state, actor, env).data, {
    actor,
    year: 2026,
    month: 11,
    at,
    versions: state.versions,
  })!
  expect(html).toContain('data-record="7"')
  expect(html).toContain("?download=suppliers")
  expect(html).not.toContain("[object Object]")
})

test("dual-role request transitions retain porta authorization without permitting foreign PR edits", () => {
  for (const identity of [
    { roles: ["requester", "buyer"], accountRoles: ["requester", "buyer"] },
    {
      roles: ["requester", "approver"],
      accountRoles: ["requester", "approver"],
    },
    { roles: ["requester", "viewer"], accountRoles: ["requester"] },
    { roles: ["requester", "admin"], accountRoles: ["requester", "admin"] },
  ]) {
    const state = snapshot()
    const env = {
      at,
      id: () => "s",
      directory: [{ id: "owner", name: "Request owner" }],
    }
    expect(domain.execute(state, actor, { page: "Settings", action: "reset", version: 0, values: {} }, env).ok).toBe(
      true,
    )
    const owner = { id: "owner", canWrite: true, roles: ["requester"] }
    const pr = {
      title: "Owner title",
      type: "product",
      description: "Owner description",
      estAmount: 100,
      costCenter: "IT",
      needBy: "2026-12-01",
      justification: "Refresh",
      recurring: false,
      expenseType: "OPEX",
    }
    const creation = domain.execute(
      state,
      owner,
      { page: "Requests", action: "create", version: 0, values: { pr } },
      env,
    )
    if (!creation.ok) throw new Error("creation failed")
    const id = String((creation.value as Record<string, unknown>).number)
    const dual = { id: "other", canWrite: true, roles: identity.roles }
    const store = state.data.store as {
      requests: Record<string, { request: Record<string, unknown> }>
      issued: { pr: string[]; po: string[] }
    }
    const direct = act(
      store.requests[id]!.request,
      { type: "submit_pr" },
      { id: dual.id, canWrite: dual.canWrite, roles: identity.accountRoles },
      legalInitialSettings(),
      at,
      store.issued,
      null,
    )
    expect(direct.ok).toBe(true)
    const result = domain.execute(
      state,
      dual,
      { page: "Requests", action: "submit_pr", id, version: 1, values: {} },
      env,
    )
    expect(result.ok).toBe(direct.ok)
    expect((state.data.store as typeof store).requests[id]!.request).toMatchObject({ status: "pr_pending", pr })
    expect(state.notices.find((notice) => notice.kind === "pending")).toBeDefined()
  }
  const state = snapshot()
  const env = { at, id: () => "s", directory: [] }
  expect(domain.execute(state, actor, { page: "Settings", action: "reset", version: 0, values: {} }, env).ok).toBe(true)
  const pr = {
    title: "Original",
    type: "product",
    description: "Original",
    estAmount: 100,
    costCenter: "IT",
    needBy: "2026-12-01",
    justification: "Refresh",
    recurring: false,
    expenseType: "OPEX",
  }
  const creation = domain.execute(
    state,
    { id: "owner", canWrite: true, roles: ["requester"] },
    { page: "Requests", action: "create", version: 0, values: { pr } },
    env,
  )
  if (!creation.ok) throw new Error("creation failed")
  const id = String((creation.value as Record<string, unknown>).number)
  const dual = { id: "other", canWrite: true, roles: ["buyer", "requester"] }
  const before = structuredClone(state)
  expect(
    domain.execute(
      state,
      dual,
      {
        page: "Requests",
        action: "save",
        id,
        version: 1,
        values: { pr: { title: "Unauthorized edit" } },
      },
      env,
    ),
  ).toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(before)
  expect(
    domain.execute(
      state,
      dual,
      {
        page: "Requests",
        action: "submit_pr",
        id,
        version: 1,
        values: { pr: { title: "Unauthorized edit", estAmount: 1 } },
      },
      env,
    ).ok,
  ).toBe(true)
  expect(
    (
      state.data.store as {
        requests: Record<string, { request: Record<string, unknown> }>
      }
    ).requests[id]!.request.pr,
  ).toMatchObject(pr)
})

test("missing and invalid encryption keys fail closed on bank writes without altering state", () => {
  const state = snapshot()
  const key = new Uint8Array(32).fill(11)
  const env = { at, id: () => "supplier", directory: [], bankKey: key }
  const creator = { id: "creator", canWrite: true, roles: ["buyer", "admin"] }
  expect(
    domain.execute(
      state,
      creator,
      {
        page: "Suppliers",
        action: "create",
        version: 0,
        values: {
          legalName: "Protected",
          iban: "OLD-PRIVATE-IBAN",
          account: "OLD-PRIVATE-ACCOUNT",
        },
      },
      env,
    ).ok,
  ).toBe(true)
  for (const bankKey of [undefined, new Uint8Array(16)]) {
    for (const action of ["save", "change-bank"]) {
      const before = structuredClone(state)
      expect(
        domain.execute(
          state,
          actor,
          {
            page: "Suppliers",
            action,
            id: "supplier",
            version: 1,
            values: {
              legalName: "Not committed",
              iban: "NEW-PRIVATE-IBAN",
              account: "NEW-PRIVATE-ACCOUNT",
            },
          },
          { ...env, bankKey },
        ),
      ).toMatchObject({ ok: false, status: 503 })
      expect(state).toEqual(before)
    }
  }
  const html = render(
    "Requests",
    {
      requests: [
        {
          number: "PR-2026-0001",
          status: "po_approved",
          pr: {},
          po: { number: "PO-2026-0001", lines: [] },
        },
      ],
    },
    { actor, year: 2026, month: 11, at, versions: {} },
  )!
  expect(html).toContain("?download=po&amp;request=PR-2026-0001")
  expect(html).not.toContain("?download=po&amp;id=")
})

test("nested supplier bank material is excluded recursively from audits and history", () => {
  const state = snapshot()
  const env = {
    at,
    id: () => "supplier",
    directory: [],
    bankKey: new Uint8Array(32).fill(12),
  }
  const secret = "NEVER-IN-AUDIT-IBAN"
  const creator = { id: "creator", canWrite: true, roles: ["buyer", "admin"] }
  expect(
    domain.execute(
      state,
      creator,
      {
        page: "Suppliers",
        action: "create",
        version: 0,
        values: {
          legalName: "Protected",
          iban: secret,
          account: "NEVER-IN-AUDIT-ACCOUNT",
          commercial: {
            nested: { iban: secret, account: "NEVER-IN-AUDIT-ACCOUNT" },
          },
          compliance: { notes: secret },
        },
      },
      env,
    ).ok,
  ).toBe(true)
  const supplier = (state.data.store as { suppliers: Record<string, unknown>[] }).suppliers[0]!
  supplier.history = [
    { field: "iban", was: { nested: secret }, became: secret },
    { field: "account", details: [{ value: "NEVER-IN-AUDIT-ACCOUNT" }] },
  ]
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "Suppliers",
        action: "change-bank",
        id: "supplier",
        version: 1,
        values: { iban: "REPLACEMENT-IBAN", account: "REPLACEMENT-ACCOUNT" },
      },
      env,
    ).ok,
  ).toBe(true)
  const history = (state.data.store as { suppliers: Record<string, unknown>[] }).suppliers[0]!.history
  for (const plain of [secret, "NEVER-IN-AUDIT-ACCOUNT", "REPLACEMENT-IBAN", "REPLACEMENT-ACCOUNT"]) {
    expect(JSON.stringify(state.audit)).not.toContain(plain)
    expect(JSON.stringify(history)).not.toContain(plain)
  }
  expect(history).toContainEqual({ field: "iban" })
  expect(history).toContainEqual({ field: "account" })
})

test("decision and supplier revalidation notices carry symbolic roles without fake directory IDs", () => {
  const state = snapshot()
  const env = { at, id: () => "supplier", directory: [] }
  expect(domain.execute(state, actor, { page: "Settings", action: "reset", version: 0, values: {} }, env).ok).toBe(true)
  const pr = {
    title: "Request",
    type: "product",
    description: "Request",
    estAmount: 100,
    costCenter: "IT",
    needBy: "2026-12-01",
    justification: "Refresh",
    recurring: false,
    expenseType: "OPEX",
  }
  const creation = domain.execute(state, actor, { page: "Requests", action: "create", version: 0, values: { pr } }, env)
  if (!creation.ok) throw new Error("creation failed")
  const id = String((creation.value as Record<string, unknown>).number)
  expect(
    domain.execute(state, actor, { page: "Requests", action: "submit_pr", id, version: 1, values: {} }, env).ok,
  ).toBe(true)
  expect(
    domain.execute(state, actor, { page: "Requests", action: "approve", id, version: 2, values: {} }, env).ok,
  ).toBe(true)
  expect(state.notices.find((notice) => notice.kind === "approved")).toMatchObject({ roles: ["buyer"], to: [actor.id] })
  const creator = { id: "creator", canWrite: true, roles: ["buyer", "admin"] }
  expect(
    domain.execute(
      state,
      creator,
      {
        page: "Suppliers",
        action: "create",
        version: 0,
        values: {
          legalName: "Vendor",
          country: "CH",
          address: "Address",
          taxId: "Unique",
          contactEmail: "a@b.ch",
          paymentTerms: "30 days",
          riskRating: "Low",
          dueDiligence: true,
          sanctionsDate: "2026-11-11",
          bankName: "Bank",
        },
      },
      env,
    ).ok,
  ).toBe(true)
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "Suppliers",
        action: "activate",
        id: "supplier",
        version: 1,
        values: {},
      },
      env,
    ).ok,
  ).toBe(true)
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "Suppliers",
        action: "change-bank",
        id: "supplier",
        version: 2,
        values: { bankName: "New bank" },
      },
      env,
    ).ok,
  ).toBe(true)
  expect(state.notices.find((notice) => notice.kind === "supplier-pending")).toMatchObject({
    roles: ["supplier admin"],
    to: [],
  })
  expect(state.notices.flatMap((notice) => notice.to).every((id) => !id.startsWith("role:"))).toBe(true)
})


test("actual browser-shaped nested arrays omit untouched repeat placeholders and preserve zero thresholds", () => {
  const state = snapshot()
  const env = { at, id: () => "browser-row", directory: [] }
  expect(domain.execute(state, actor, { page: "Settings", action: "reset", version: 0, values: {} }, env)).toMatchObject({ ok: true })
  const before = domain.view(state, actor, env).data.settings as Record<string, unknown>
  const values = {
    ...structuredClone(before),
    levels: [...before.levels as Record<string, unknown>[], { _new: "true", id: "levels-3", name: "", threshold: null, holderId: "" }],
    fxRates: [...before.fxRates as Record<string, unknown>[], { _new: "true", code: "", rate: null }],
    criteria: [...before.criteria as Record<string, unknown>[], { _new: "true", name: "", weight: null }],
    commCriteria: [...before.commCriteria as Record<string, unknown>[], { _new: "true", name: "", weight: null, auto: false }],
  }
  const result = domain.execute(state, actor, { page: "Settings", action: "save", version: state.versions.settings!.version, values }, env)
  expect(result).toMatchObject({ ok: true })
  const after = domain.view(state, actor, env).data.settings as Record<string, unknown>
  expect(after.levels).toEqual(before.levels)
  expect(after.fxRates).toEqual(before.fxRates)
  expect(after.criteria).toEqual(before.criteria)
  expect(after.commCriteria).toEqual(before.commCriteria)
  expect((after.levels as Record<string, unknown>[])[0]!.threshold).toBe(0)
})
