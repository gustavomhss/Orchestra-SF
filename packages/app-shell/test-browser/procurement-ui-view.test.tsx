import { afterEach, expect, test } from "bun:test"
import type { Sucafina } from "@orchestra/schema/sucafina"
import { createComponent, createSignal } from "solid-js"
import { render } from "solid-js/web"
import type { Actor, Environment, Snapshot } from "../../../modules/sucafina/Sucafinav1/runtime/contract.ts"

const { solidDom } = await import("./solid-dom")
const { domain } = await import(solidDom("../../../modules/sucafina/Sucafinav1/runtime/procurement.ts", import.meta.dir))
const { ProcurementView } = await import(solidDom("../src/orchestra/chapters/sucafina/procurement-ui-view.tsx", import.meta.dir))

const at = "2026-11-12T12:00:00Z"
const ADA = "directory-ada"
const BUYER = "directory-buyer"
const HOLDER = "directory-holder"
const ADMIN = "directory-admin"
const SUPPLIER_ADMIN = "directory-supplier-admin"
const OTHER = "directory-other-requester"
const VIEWER = "directory-viewer"
const directory = [
  { id: ADA, name: "Ada Requester" },
  { id: BUYER, name: "Bea Buyer" },
  { id: HOLDER, name: "Casey Approver" },
  { id: ADMIN, name: "Devon Admin" },
  { id: SUPPLIER_ADMIN, name: "Gale Supplier Admin" },
  { id: OTHER, name: "Elliot Other Requester" },
  { id: VIEWER, name: "Frank Viewer" },
]
const environment: Environment = { at, id: () => "native-procurement-supplier", directory, bankKey: new Uint8Array(32).fill(9) }
const requester: Actor = { id: ADA, canWrite: true, roles: ["requester"] }
const buyer: Actor = { id: BUYER, canWrite: true, roles: ["buyer"] }
const admin: Actor = { id: ADMIN, canWrite: true, roles: ["admin"] }
const supplierAdmin: Actor = { id: SUPPLIER_ADMIN, canWrite: true, roles: ["supplier admin"] }
const otherRequester: Actor = { id: OTHER, canWrite: true, roles: ["requester"] }
const viewer: Actor = { id: VIEWER, canWrite: false, roles: ["viewer"] }
const cleanups: (() => void)[] = []
afterEach(() => cleanups.splice(0).forEach((dispose) => dispose()))

function snapshot(): Snapshot {
  return { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
}

function execute(state: Snapshot, actor: Actor, page: string, action: string, values: Record<string, unknown>, id?: string) {
  const versionKey = page === "Settings" ? "settings" : page === "Suppliers" ? `suppliers:${id ?? ""}` : `requests:${id ?? ""}`
  return domain.execute(
    state,
    actor,
    {
      page,
      action,
      ...(id ? { id } : {}),
      version: state.versions[versionKey]?.version ?? 0,
      values,
    },
    environment,
  )
}

function requisition(title: string, estAmount: number | null) {
  return {
    title,
    type: "product",
    description: "Procurement view fixture",
    estAmount,
    costCenter: "IT-OPS",
    needBy: "2026-12-15",
    justification: "Acceptance fixture",
    recurring: false,
    expenseType: "OPEX",
  }
}

function createRequest(state: Snapshot, title: string, estAmount: number | null) {
  const created = execute(state, requester, "Requests", "create", { pr: requisition(title, estAmount) })
  expect(created.ok).toBe(true)
  if (!created.ok) throw new Error(`Expected request fixture creation: ${title}`)
  return String((created.value as Record<string, unknown>).number)
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function storedRequest(state: Snapshot, number: string) {
  const requests = object(object(state.data.store).requests)
  return object(object(requests[number]).request)
}

function populatedSnapshot() {
  const state = snapshot()
  expect(execute(state, admin, "Settings", "reset", {}).ok).toBe(true)
  expect(execute(state, admin, "Settings", "save", {
    levels: [{ id: "L1", name: "Level One", threshold: 0, holderId: HOLDER }],
  }).ok).toBe(true)

  const created = execute(state, requester, "Requests", "create", {
    pr: requisition("Laptop Fleet Review", 1250),
  })
  expect(created.ok).toBe(true)
  if (!created.ok) throw new Error("Expected request fixture creation")
  const requestId = String((created.value as Record<string, unknown>).number)
  expect(execute(state, requester, "Requests", "submit_pr", {
    pr: requisition("Laptop Fleet Review", 1250),
  }, requestId).ok).toBe(true)

  for (const [title, amount] of [["Zero Estimate Control", 0], ["Null Estimate Control", null]] as const) {
    expect(execute(state, requester, "Requests", "create", { pr: requisition(title, amount) }).ok).toBe(true)
  }
  expect(execute(state, buyer, "Suppliers", "create", {
    legalName: "Acme Procurement Ltd",
    country: "Brazil",
    taxId: "BR-TAX-417",
  }).ok).toBe(true)
  expect(execute(state, admin, "Suppliers", "change-bank", {
    bankName: "PRIVATE-BANK-NAME-SENTINEL",
    accountHolder: "PRIVATE-ACCOUNT-HOLDER-SENTINEL",
    bankCountry: "PRIVATE-BANK-COUNTRY-SENTINEL",
    iban: "PRIVATE-IBAN-SENTINEL",
    account: "PRIVATE-ACCOUNT-SENTINEL",
    swift: "PRIVATE-SWIFT-SENTINEL",
  }, "native-procurement-supplier").ok).toBe(true)
  return state
}

function pageState(page: string, actor: Actor, state = populatedSnapshot(), pages = [
  "Dashboard", "Requests", "My approvals", "Suppliers", "Settings",
]): Sucafina.PageState {
  const viewed = domain.view(state, actor, environment)
  return {
    surface: "procurement",
    page,
    pages,
    actor: {
      id: actor.id,
      name: directory.find((person) => person.id === actor.id)?.name ?? actor.id,
      canWrite: actor.canWrite,
      roles: actor.roles,
      assigned: [],
      domains: [],
    },
    year: 2026,
    month: 11,
    data: viewed.data as Sucafina.PageState["data"],
    versions: viewed.versions as Sucafina.PageState["versions"],
    directory,
  }
}

function mount(initial: Sucafina.PageState, initialQuery: Sucafina.PageQuery = {}) {
  const [current, setCurrent] = createSignal(initial)
  const [query, setQuery] = createSignal(initialQuery)
  const calls: Sucafina.PageQuery[] = []
  const host = document.createElement("div")
  document.body.append(host)
  const dispose = render(() => createComponent(ProcurementView, {
    get page() { return current() },
    get query() { return query() },
    onQuery(value) {
      calls.push(value)
      setQuery(value)
    },
  }), host)
  cleanups.push(() => { dispose(); host.remove() })
  return { host, calls, current, setCurrent, setQuery }
}

function text(host: HTMLElement) {
  return host.textContent?.replace(/\s+/g, " ").trim() ?? ""
}

function requestRow(host: HTMLElement, title: string) {
  const row = [...host.querySelectorAll("tbody tr")].find((item) => item.textContent?.includes(title))
  if (!row) throw new Error(`Missing request row ${title}`)
  return row
}

test("Dashboard renders projected request labels and populated values", () => {
  const view = mount(pageState("Dashboard", admin))
  const request = (view.current().data.requests as Record<string, unknown>[])[0]!
  expect(text(view.host)).toContain("Request")
  expect(text(view.host)).toContain("Status")
  expect(text(view.host)).toContain("Amount")
  expect(text(view.host)).toContain(String(request.number))
  expect(text(view.host)).toContain(String(request.status))
  expect(text(view.host)).toContain(String(request.value))
})

test("Requests renders the exact projected request identity, status, and amount", () => {
  const view = mount(pageState("Requests", admin))
  const request = (view.current().data.requests as Record<string, unknown>[]).find((item) =>
    (item.pr as Record<string, unknown>).title === "Laptop Fleet Review",
  )!
  const row = requestRow(view.host, "Laptop Fleet Review")
  expect(row.textContent).toContain(String(request.number))
  expect(row.textContent).toContain("Laptop Fleet Review")
  expect(row.textContent).toContain(String(request.status))
  expect(row.textContent).toContain(String(request.value))
})

test("My approvals resolves the actual pending holder through the supplied directory", () => {
  const view = mount(pageState("My approvals", buyer))
  const request = (view.current().data.requests as Record<string, unknown>[]).find((item) =>
    (item.pr as Record<string, unknown>).title === "Laptop Fleet Review",
  )!
  const approval = request.prApproval as Record<string, unknown>
  const pendingStep = (approval.steps as Record<string, unknown>[]).find((step) => step.status === "pending")
  if (typeof request.number !== "string" || typeof approval.amount !== "number" || !pendingStep)
    throw new Error("Missing projected request number or pending approval fields")
  expect(pendingStep.holderId).toBe(HOLDER)
  expect(text(view.host)).toContain(String(request.number))
  expect(text(view.host)).toContain("Casey Approver")
  expect(text(view.host)).toContain(String(approval.amount))
})

test("Suppliers renders projected supplier labels and values", () => {
  const view = mount(pageState("Suppliers", buyer))
  const supplier = (view.current().data.suppliers as Record<string, unknown>[])[0]!
  expect(text(view.host)).toContain("Supplier")
  expect(text(view.host)).toContain(String(supplier.legalName))
  expect(text(view.host)).toContain(String(supplier.number))
  expect(text(view.host)).toContain(String(supplier.status))
})

test("supplier projection hides bank secrets from buyer and viewer and renders authorized bank metadata", () => {
  const state = populatedSnapshot()
  for (const actor of [buyer, viewer]) {
    const page = pageState("Suppliers", actor, state)
    expect((page.data as Record<string, unknown>).bankVisible).toBe(false)
    const projected = page.data.suppliers as Record<string, unknown>[]
    const supplier = projected[0] ?? {}
    expect(supplier).toMatchObject({
      iban: "masked",
      account: "masked",
    })
    expect(supplier.bankName).toBeUndefined()
    expect(supplier.accountHolder).toBeUndefined()
    expect(supplier.bankCountry).toBeUndefined()
    expect(supplier.swift).toBeUndefined()
    const view = mount(page)
    expect(text(view.host)).not.toContain("PRIVATE-BANK-NAME-SENTINEL")
    expect(text(view.host)).not.toContain("PRIVATE-ACCOUNT-HOLDER-SENTINEL")
    expect(text(view.host)).not.toContain("PRIVATE-BANK-COUNTRY-SENTINEL")
    expect(text(view.host)).not.toContain("PRIVATE-IBAN-SENTINEL")
    expect(text(view.host)).not.toContain("PRIVATE-ACCOUNT-SENTINEL")
    expect(text(view.host)).not.toContain("PRIVATE-SWIFT-SENTINEL")
  }

  for (const actor of [admin, supplierAdmin]) {
    const page = pageState("Suppliers", actor, state)
    expect((page.data as Record<string, unknown>).bankVisible).toBe(true)
    const supplier = (page.data.suppliers as Record<string, unknown>[])[0]!
    expect(supplier).toMatchObject({
      bankName: "PRIVATE-BANK-NAME-SENTINEL",
      accountHolder: "PRIVATE-ACCOUNT-HOLDER-SENTINEL",
      bankCountry: "PRIVATE-BANK-COUNTRY-SENTINEL",
      iban: "PRIVATE-IBAN-SENTINEL",
      account: "PRIVATE-ACCOUNT-SENTINEL",
      swift: "PRIVATE-SWIFT-SENTINEL",
    })
    const view = mount(page)
    expect(text(view.host)).toContain("Bank")
    expect(text(view.host)).toContain("PRIVATE-BANK-NAME-SENTINEL")
    expect(text(view.host)).toContain("PRIVATE-ACCOUNT-HOLDER-SENTINEL")
    expect(text(view.host)).toContain("PRIVATE-BANK-COUNTRY-SENTINEL")
    expect(text(view.host)).toContain("PRIVATE-IBAN-SENTINEL")
    expect(text(view.host)).toContain("PRIVATE-ACCOUNT-SENTINEL")
    expect(text(view.host)).toContain("PRIVATE-SWIFT-SENTINEL")
  }

  const authorizedPage = pageState("Suppliers", admin, state)
  const dataWithoutFlag = { ...authorizedPage.data } as Record<string, unknown>
  delete dataWithoutFlag.bankVisible
  const failClosedPage = {
    ...authorizedPage,
    data: dataWithoutFlag as Sucafina.PageState["data"],
  }
  const failClosedView = mount(failClosedPage)
  expect(text(failClosedView.host)).not.toContain("Bank")
  expect(text(failClosedView.host)).not.toContain("PRIVATE-BANK-NAME-SENTINEL")
  expect(text(failClosedView.host)).not.toContain("PRIVATE-IBAN-SENTINEL")
})

test("Settings renders actual settings and resolves approval holder names", () => {
  const view = mount(pageState("Settings", admin))
  expect(text(view.host)).toContain("Currency")
  expect(text(view.host)).toContain("USD")
  expect(text(view.host)).toContain("Level One")
  expect(text(view.host)).toContain("Casey Approver")
})

test("empty request and supplier arrays render no invented rows", () => {
  const empty = snapshot()
  for (const page of ["Dashboard", "Requests", "My approvals", "Suppliers", "Settings"]) {
    const projected = pageState(page, admin, empty)
    const view = mount(projected)
    if (["Dashboard", "Requests", "My approvals"].includes(page)) expect(projected.data.requests).toEqual([])
    if (page === "Suppliers") expect(projected.data.suppliers).toEqual([])
    for (const row of view.host.querySelectorAll("tbody tr"))
      expect(text(row)).toMatch(/^(No\b|Information is unavailable\.)/)
    expect(text(view.host)).not.toContain("Laptop Fleet Review")
    expect(text(view.host)).not.toContain("Acme Procurement Ltd")
    expect(text(view.host)).not.toContain("Level One")
    expect(text(view.host)).not.toContain("Casey Approver")
  }
})

test("zero and null request values remain distinct in the rendered request rows", () => {
  const view = mount(pageState("Requests", admin))
  const zero = requestRow(view.host, "Zero Estimate Control")
  const missing = requestRow(view.host, "Null Estimate Control")
  const requestsTable = view.host.querySelector('section[aria-label="Requests"] table')
  if (!requestsTable) throw new Error("Missing projected Requests table")
  const amountColumn = [...requestsTable.querySelectorAll("thead th")].findIndex((header) =>
    header.textContent?.trim() === "Amount",
  )
  if (amountColumn < 0) throw new Error("Missing Amount column")
  const zeroCells = Array.from(zero.cells)
  const missingCells = Array.from(missing.cells)
  const zeroAmount = zeroCells[amountColumn]
  const missingAmount = missingCells[amountColumn]
  if (!zeroAmount || !missingAmount) throw new Error("Request amount cells are missing")
  expect(zeroAmount.textContent?.trim()).toBe("0")
  expect(missingAmount.textContent?.trim()).toBe("—")
})

test("untrusted request text is rendered as text rather than HTML", () => {
  const state = populatedSnapshot()
  const created = execute(state, requester, "Requests", "create", {
    pr: requisition('<img src=x onerror="alert(1)"> Unsafe title', 7),
  })
  expect(created.ok).toBe(true)
  const view = mount(pageState("Requests", admin, state))
  expect(view.host.querySelector("img")).toBeNull()
  expect(text(view.host)).toContain('<img src=x onerror="alert(1)"> Unsafe title')
})

test("foreign surface or page does not expose procurement rows", () => {
  const populated = pageState("Requests", admin)
  for (const page of [
    { ...populated, surface: "dashboard" as const },
    { ...populated, page: "Unrelated page" },
  ]) {
    const view = mount(page)
    expect(text(view.host)).not.toContain("Laptop Fleet Review")
    expect(text(view.host)).not.toContain("Acme Procurement Ltd")
    expect(text(view.host)).not.toContain("PRIVATE-BANK-NAME-SENTINEL")
  }
})

test("replacing an admin view with the actual requester projection removes hidden private rows", () => {
  const state = populatedSnapshot()
  expect(execute(state, otherRequester, "Requests", "create", {
    pr: requisition("PRIVATE-OTHER-REQUESTER-ROW", 904),
  }).ok).toBe(true)
  const privileged = pageState("Requests", admin, state)
  const restricted = pageState("Requests", requester, state)
  const view = mount(privileged)
  expect(text(view.host)).toContain("PRIVATE-OTHER-REQUESTER-ROW")
  view.setCurrent(restricted)
  expect(text(view.host)).not.toContain("PRIVATE-OTHER-REQUESTER-ROW")
  expect(text(view.host)).toContain("Laptop Fleet Review")
})

test("removing the current page from authorized pages clears private rows despite retained page and data", () => {
  const authorized = pageState("Requests", admin)
  const view = mount(authorized)
  expect(text(view.host)).toContain("Laptop Fleet Review")
  view.setCurrent({ ...authorized, pages: [] })
  expect(text(view.host)).not.toContain("Laptop Fleet Review")
  expect(text(view.host)).not.toContain("PR-")
  expect(view.host.querySelectorAll("tbody tr")).toHaveLength(0)
})

test("Supplier filters call onQuery while retaining unrelated query keys", () => {
  const initialQuery = { status: "All", q: "Acme", filter: "keep-filter", year: "2026" }
  const view = mount(pageState("Suppliers", buyer), initialQuery)
  const statusLabel = [...view.host.querySelectorAll("label")].find((label) =>
    label.querySelector("span")?.textContent?.trim() === "Status",
  )
  const status = statusLabel?.querySelector<HTMLSelectElement>("select")
  if (!status) throw new Error("Missing supplier status filter")
  status.value = "pending"
  status.dispatchEvent(new Event("change", { bubbles: true }))
  expect(view.calls.at(-1)).toEqual({ ...initialQuery, status: "pending" })

  const searchLabel = [...view.host.querySelectorAll("label")].find((label) =>
    label.querySelector("span")?.textContent?.trim() === "Search",
  )
  const search = searchLabel?.querySelector<HTMLInputElement>('input[type="search"]')
  if (!search) throw new Error("Missing supplier search filter")
  search.value = "Acme Procurement"
  search.dispatchEvent(new Event("input", { bubbles: true }))
  expect(view.calls.at(-1)).toEqual({ ...initialQuery, status: "pending", q: "Acme Procurement" })
})

test("legacy numeric supplier id matches string query and string quote/PO references link only matching requests", () => {
  const state = populatedSnapshot()
  const quoteOnlyNumber = createRequest(state, "Quote Link Fixture", 51)
  const poOnlyNumber = createRequest(state, "PO Link Fixture", 52)
  const noIdNumber = createRequest(state, "No Supplier ID Fixture", 53)
  const store = object(state.data.store)
  const suppliers = store.suppliers as Record<string, unknown>[]
  if (!suppliers[0]) throw new Error("Missing legacy supplier fixture")
  suppliers[0].id = 7

  const quoteOnly = storedRequest(state, quoteOnlyNumber)
  quoteOnly.sourcing = {
    quotes: [{ id: "quote-seven", supplierId: "7", supplier: "Acme Procurement Ltd" }],
  }
  quoteOnly.po = null
  const poOnly = storedRequest(state, poOnlyNumber)
  poOnly.sourcing = { quotes: [] }
  poOnly.po = { supplierId: "7", supplier: "Acme Procurement Ltd" }
  const noId = storedRequest(state, noIdNumber)
  noId.sourcing = {
    quotes: [{ id: "quote-without-supplier-id", supplier: "No registered supplier" }],
  }
  noId.po = { supplier: "No registered supplier" }

  const page = pageState("Suppliers", buyer, state)
  const projectedSupplier = (page.data.suppliers as Record<string, unknown>[])[0]!
  expect(projectedSupplier.id).toBe("7")
  const projectedRequests = page.data.requests as Record<string, unknown>[]
  for (const number of [quoteOnlyNumber, poOnlyNumber, noIdNumber]) {
    expect(projectedRequests.some((request) => request.number === number)).toBe(true)
  }
  const view = mount(page, { supplier: "7", status: "active" })
  expect(text(view.host)).toContain("Acme Procurement Ltd")
  const linkedRows = [...view.host.querySelectorAll('section[aria-label="Linked requests"] tbody tr')]
  expect(linkedRows).toHaveLength(2)
  expect(linkedRows.map((row) => row.cells[0]?.textContent?.trim()).sort()).toEqual(
    [quoteOnlyNumber, poOnlyNumber].sort(),
  )
  expect(linkedRows.some((row) => row.textContent?.includes(noIdNumber))).toBe(false)
})
