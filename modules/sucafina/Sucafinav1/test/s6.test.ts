import { expect, test } from "bun:test"
import type { Row } from "../src/records.ts"
import { act } from "../../porta/act.ts"
import {
  annualEntryMonths,
  applyYearAmount,
  budgetChartSeries,
  computeBudgetTotals,
  effectiveMonthlyBudget,
  executiveReportTotals,
  sumOwnerBudget,
} from "../src/dashboard-accounts.ts"
import {
  budgetCard,
  budgetVariance,
  contractCap,
  contractUpload,
  deleteContract,
  exportBackup,
  quoteUpload,
  readMember,
  utilization,
} from "../src/dashboard-role.ts"
import { legalInitialSettings } from "../src/initial-settings.ts"
import { nextCpx, outlookMonth, spread, usdAmount, emptyFlags, zeroMonths } from "../src/planner-accounts.ts"
import { assignOwner, deleteRate, makeOfficial, plannerField, presentSalary } from "../src/planner-role.ts"
import { cancel, createRequest, issue } from "../src/procurement.ts"
import type { Store } from "../src/procurement.ts"
import { createRecord, writeRecord } from "../src/records.ts"
import { visibleRequests } from "../src/requests.ts"
import { activateSupplier, changeBank, open, presentSupplier, seal, supplierCsv } from "../src/supplier.ts"
import { validatePO, validateSourcing } from "../src/form.ts"

const AT = "2026-11-10T12:00:00Z"
const IDS = Array.from({ length: 32 }, (_, index) => `S6-${index + 1}`)

function actor(id: string, roles: string[], canWrite = true) {
  return { id, canWrite, roles }
}

function settings(over: Record<string, unknown> = {}) {
  return { ...legalInitialSettings(), ...over }
}

function key(): Uint8Array {
  return new Uint8Array(32).fill(7)
}

function completeSupplier(over: Record<string, unknown> = {}) {
  return {
    id: "s1",
    status: "pending",
    createdBy: "sam",
    legalName: "Acme",
    country: "CH",
    address: "Rue 1",
    taxId: "CHE-1",
    contactEmail: "a@acme.test",
    paymentTerms: "30",
    riskRating: "low",
    dueDiligence: true,
    sanctionsDate: "2026-01-01",
    iban: "GB00CLEAR",
    bankName: "Bank",
    ...over,
  }
}

test("S6 registry", async () => {
  const text = await Bun.file(new URL(import.meta.url)).text()
  for (const id of IDS) expect(text).toContain(`test("${id} `)
})

test("S6-1 two different lines both stay; a stale write of the same record is 409", () => {
  const rows: Record<string, Row> = {}
  const ada = actor("ada", ["admin"])
  const first = createRecord(rows, "opex-a", { budget: 10 }, ada)
  const second = createRecord(rows, "opex-b", { budget: 20 }, actor("bea", ["contributor"]))
  expect(first.ok).toBe(true)
  expect(second.ok).toBe(true)
  expect(rows["opex-a"].value).toEqual({ budget: 10 })
  expect(rows["opex-b"].value).toEqual({ budget: 20 })
  expect(createRecord(rows, "opex-a", { budget: 99 }, actor("cio", ["admin"]))).toEqual({
    ok: false,
    status: 409,
    stored: { budget: 10 },
    by: "ada",
  })
  expect(writeRecord(rows, "opex-a", 1, { budget: 1 }, { id: "x", canWrite: false }).ok).toBe(false)
  expect(rows["opex-a"].value).toEqual({ budget: 10 })
  const wrote = writeRecord(rows, "opex-a", 1, { budget: 11 }, ada)
  expect(wrote.ok).toBe(true)
  const stale = writeRecord(rows, "opex-a", 1, { budget: 99 }, actor("cio", ["admin"]))
  expect(stale).toEqual({
    ok: false,
    status: 409,
    stored: { budget: 11 },
    by: "ada",
  })
  expect(rows["opex-a"].value).toEqual({ budget: 11 })
  expect(rows["opex-b"].value).toEqual({ budget: 20 })
})

test("S6-2 only admin receives talent; the backup export is not a filtered copy", () => {
  const member = {
    id: "m1",
    leaderId: "lead-1",
    name: "Ada",
    cls: "Talent",
    outlook: "Promote",
    notes: "private",
  }
  const audit: { who: string; at: string; member: string }[] = []
  const leader = readMember(member, actor("lead-1", ["domain leader"]), AT, audit)
  expect(leader.cls).toBeUndefined()
  expect(leader.outlook).toBeUndefined()
  expect(leader.notes).toBeUndefined()
  expect(leader.name).toBe("Ada")
  const admin = readMember(member, actor("cio", ["admin"]), AT, audit)
  expect(admin.cls).toBe("Talent")
  expect(audit.map((line) => line.member)).toEqual(["m1", "m1"])
  expect(audit[0]).toEqual({ who: "lead-1", at: AT, member: "m1" })
  expect(audit[1]).toEqual({ who: "cio", at: AT, member: "m1" })
  const backup = { members: [member] }
  expect(exportBackup(backup, actor("ada", ["viewer"]))).toEqual({ ok: false })
  expect(exportBackup(backup, actor("cio", ["admin"]))).toEqual({
    ok: true,
    data: backup,
  })
})

test("S6-3 a budget owner does not receive the rate card", () => {
  const view = {
    rates: [{ annual: 100 }],
    rateOverride: 50,
    cost: 9,
    inc: 3,
    total: 80,
  }
  const owner = presentSalary(view, actor("ada", ["budget owner"]))
  expect(owner).toEqual({ total: 80 })
  expect("rates" in owner).toBe(false)
  expect(presentSalary(view, actor("hr", ["hr"]))).toEqual(view)
})

test("S6-4 IBAN is not clear outside supplier admin and admin; a bank change does not write the IBAN", () => {
  const secret = key()
  const stored = {
    ...completeSupplier({ status: "active", swift: "AAAA" }),
    iban: seal("GB00CLEAR", secret),
    account: seal("999", secret),
  }
  const buyer = presentSupplier(stored, actor("bea", ["buyer"]), secret)
  expect(JSON.stringify(buyer)).not.toContain("GB00CLEAR")
  expect(buyer.iban).toBe("masked")
  const admin = presentSupplier(stored, actor("cio", ["admin"]), secret)
  expect(admin.iban).toBe("GB00CLEAR")
  const csv = supplierCsv([stored], actor("bea", ["viewer"]), secret)
  expect(csv[0].iban).toBeUndefined()
  expect(csv[0].swift).toBeUndefined()
  expect(supplierCsv([stored], actor("cio", ["admin"]), secret)[0].iban).toBe("GB00CLEAR")
  const changed = changeBank(stored, "iban", "GB99NEW", actor("cio", ["supplier admin"]), secret)
  if (!changed.ok) throw new Error("bank change refused")
  expect(changed.supplier.status).toBe("pending")
  expect(changed.supplier.validatedBy).toBeNull()
  expect(JSON.stringify(changed.supplier.history)).not.toContain("GB99NEW")
  expect(changed.supplier.history).toEqual([{ field: "iban" }])
  expect(changeBank(stored, "iban", "GB11", actor("bea", ["buyer"]), secret)).toEqual({ ok: false })
  expect(changeBank(stored, "iban", "GB11", actor("cio", ["admin"]), secret)).toEqual({ ok: false })
  expect(() => open(seal("GB00", secret), new Uint8Array(32).fill(2))).toThrow()
})

test("S6-5 an official version cannot be unlocked or deleted", () => {
  const version = { id: "v1", year: 2026, locked: true }
  expect(plannerField("unlock", version, "v1", actor("cio", ["admin"]))).toBe(false)
  expect(plannerField("delete", version, "v1", actor("cio", ["admin"]))).toBe(false)
})

test("S6-6 one official per fiscal year; the previous of that year stays locked", () => {
  const versions = [
    { id: "old", year: 2026, locked: true },
    { id: "new", year: 2026, locked: false },
    { id: "other", year: 2027, locked: false },
  ]
  const made = makeOfficial(versions, { "2026": "old" }, "new", actor("cio", ["admin"]))
  if (!made.ok) throw new Error("official refused")
  expect(made.officials["2026"]).toBe("new")
  expect(made.officials["2027"]).toBeUndefined()
  expect(made.versions.find((version) => version.id === "old")?.locked).toBe(true)
  expect(made.versions.find((version) => version.id === "new")?.locked).toBe(true)
  const nextYear = makeOfficial(made.versions, made.officials, "other", actor("cio", ["admin"]))
  if (!nextYear.ok) throw new Error("second year refused")
  expect(nextYear.officials["2026"]).toBe("new")
  expect(nextYear.officials["2027"]).toBe("other")
})

test("S6-7 a rate card in use cannot be deleted", () => {
  expect(deleteRate("card", [{ rateId: "card" }], true)).toEqual({ ok: false })
  expect(deleteRate("card", [{ rateId: "other" }], true)).toEqual({ ok: true })
})

test("S6-8 sourcing refuses inactive with the flag off; PO still refuses inactive", () => {
  const form = {
    currency: "USD",
    fxRates: legalInitialSettings().fxRates,
    minQuotes: 1,
    requireActiveSupplier: false,
    techWeight: 60,
    commWeight: 40,
    criteria: [{ weight: 100 }],
    commCriteria: [{ weight: 100, auto: true }],
  }
  const sourcing = validateSourcing(
    {
      pr: { recurring: false },
      sourcing: {
        quotes: [
          {
            id: "q1",
            supplier: "Acme",
            supplierId: "s1",
            currency: "USD",
            total: 10,
            techPass: true,
            scores: [5],
          },
        ],
        evaluator: "Ada",
        selectedId: "q1",
        contractStrategy: "new",
      },
    },
    form,
    [{ id: "s1", status: "inactive", legalName: "Acme" }],
  )
  expect(sourcing).toContain("Selected supplier Acme is inactive in the supplier master")
  const po = validatePO(
    {
      po: {
        supplier: "Acme",
        supplierId: "s1",
        description: "EDR",
        lines: [{ qty: 1, unitPrice: 10 }],
        paymentTerms: "30",
        expenseType: "OPEX",
        currency: "USD",
        deliveryDate: "2026-12-01",
        deliveryConditions: "Site",
      },
    },
    form,
    [{ id: "s1", status: "inactive", legalName: "Acme" }],
  )
  expect(po).toContain("Supplier Acme is inactive in the supplier master")
})

test("S6-9 an empty holder is not re-read from live settings", () => {
  const set = settings({
    levels: [{ id: "L1", name: "CIO-1 (Level 1)", threshold: 0, holderId: "zoe" }],
  })
  const request = {
    number: "PR-2026-0001",
    status: "pr_pending",
    createdBy: "ada",
    pr: { estAmount: 10, recurring: false, expenseType: "" },
    prApproval: {
      amount: 10,
      fxRate: null,
      steps: [
        {
          levelId: "L1",
          levelName: "CIO-1 (Level 1)",
          threshold: 0,
          holderId: null,
          status: "pending",
        },
      ],
    },
    sourcing: null,
    po: null,
    history: [],
  }
  const result = act(request, { type: "approve" }, actor("bea", ["buyer"]), set, AT, { pr: [], po: [] }, null)
  if (!result.ok) throw new Error(result.code)
  expect(result.request.prApproval?.steps[0].holderId).toBeNull()
  expect(result.request.status).toBe("sourcing")
})

test("S6-10 the server revalidates issue before it writes", () => {
  const saved: Store = {
    settings: settings(),
    form: { currency: "USD" },
    issued: { pr: [], po: [] },
    sup: [],
    suppliers: [],
    requests: {
      a: {
        version: 1,
        by: "ada",
        request: { status: "draft", createdBy: "ada" },
      },
    },
    actCalls: 0,
    lastIssued: null,
  }
  expect(issue(saved, "a", 1, actor("bea", ["buyer"]), AT)).toEqual({
    ok: false,
  })
  expect(cancel(saved, "a", 1, actor("bea", ["buyer"]), AT, "stop")).toEqual({
    ok: false,
  })
  saved.requests.ready = {
    version: 1,
    by: "ada",
    request: {
      status: "po_approved",
      createdBy: "ada",
      po: {
        number: "PO-2026-0001",
        issuedAt: null,
        expenseType: "OPEX",
        currency: "USD",
        fxRate: null,
        supplier: "",
        supplierId: null,
        sourceQuoteId: null,
        lines: [],
        approval: null,
      },
    },
  }
  expect(issue(saved, "ready", 1, actor("ada", ["requester"]), AT)).toEqual({
    ok: false,
  })
  expect(saved.actCalls).toBe(0)
  expect(saved.requests.a.request.status).toBe("draft")
  expect(saved.requests.ready.request.status).toBe("po_approved")
})

test("S6-11 level 1 does not validate a supplier; supplier admin does", () => {
  const supplier = completeSupplier()
  expect(activateSupplier(supplier, actor("zoe", ["approver"]), [], false)).toEqual({ ok: false })
  expect(activateSupplier(supplier, actor("bea", ["buyer"]), [], false).ok).toBe(false)
  expect(activateSupplier({ ...supplier, legalName: "" }, actor("sup", ["supplier admin"]), [], false)).toEqual({
    ok: false,
  })
  expect(activateSupplier(supplier, actor("sam", ["supplier admin"]), [], true)).toEqual({ ok: false })
  const validated = activateSupplier(supplier, actor("sup", ["supplier admin"]), [], false)
  if (!validated.ok) throw new Error("supplier admin refused")
  expect(validated.supplier.status).toBe("active")
})

test("S6-12 the executive report uses the twelve-month total, not the sum of owner.budget", () => {
  const data = {
    opexOwners: [{ id: "a", budget: 1200 }],
    opexEntries: [{ year: 2026, month: 1, ownerId: "a", budget: 500 }],
  }
  const report = executiveReportTotals(data, 2026)
  expect(report.totalBudget).toBe(computeBudgetTotals(data, 2026).totalBudget)
  expect(report.totalBudget).not.toBe(sumOwnerBudget(data))
})

test("S6-13 the card number stays the twelve months and the label says twelve months", () => {
  const data = {
    opexOwners: [{ id: "a", budget: 1200 }],
    opexEntries: [{ year: 2026, month: 3, ownerId: "a", actual: 40 }],
  }
  const card = budgetCard(computeBudgetTotals(data, 2026).totalBudget)
  expect(card.total).toBe(1200)
  expect(card.total).not.toBe(40)
  expect(card.label).toBe("12 months")
  expect(card.label).not.toBe("March")
})

test("S6-14 the server sequence is above the imported maximum and does not restart", () => {
  const saved: Store = {
    settings: settings(),
    form: { currency: "USD" },
    issued: { pr: ["PR-2026-0007"], po: [] },
    sup: [],
    suppliers: [],
    requests: {},
    actCalls: 0,
    lastIssued: null,
  }
  const created = createRequest(
    saved,
    { type: "create", pr: { estAmount: 1, recurring: false, expenseType: "" } },
    actor("ada", ["requester"]),
    AT,
  )
  if (!created.ok) throw new Error(created.code)
  expect(created.request.number).toBe("PR-2026-0008")
  expect(created.request.number).not.toBe("PR-2026-0001")
})

test("S6-15 an imported owner name matches the directory; no match does not create a person", () => {
  const directory = [{ id: "dir-1", name: "José Silva" }]
  expect(assignOwner(null, "jose silva", directory)).toEqual({
    owner: { id: "dir-1", name: "José Silva" },
    warning: null,
  })
  expect(assignOwner({ id: "kept", name: "Kept" }, "Nobody", directory)).toEqual({
    owner: { id: "kept", name: "Kept" },
    warning: "Nobody",
  })
  expect(directory).toEqual([{ id: "dir-1", name: "José Silva" }])
})

test("S6-16 a dashboard monthly zero stays annual divided by twelve", () => {
  expect(effectiveMonthlyBudget(0, 1200)).toBe(100)
  expect(effectiveMonthlyBudget(0, 1200)).not.toBe(0)
})

test("S6-17 a planner budget zero stays zero", () => {
  expect(outlookMonth(3, 0, null, null, 0)).toBe(0)
  expect(outlookMonth(3, 0, null, null, 0)).not.toBe(100)
})

test("S6-18 the three FX rules do not become one", () => {
  expect(usdAmount(10, "CHF", null)).toEqual({ usd: 0, warning: "CHF" })
  const procurement = act(
    {
      number: "PR-2026-0001",
      status: "sourcing",
      createdBy: "ada",
      pr: { estAmount: 0, recurring: false, expenseType: "" },
      prApproval: null,
      sourcing: {
        quotes: [
          {
            id: "q1",
            supplier: "",
            supplierId: null,
            currency: "CHF",
            total: 10,
            qty: 1,
            unitPrice: 1,
            techPass: true,
          },
        ],
        selectedId: "q1",
        fxSnapshot: null,
        approval: null,
        contractStrategy: "",
      },
      po: null,
      history: [],
    },
    { type: "submit_sourcing" },
    actor("bea", ["buyer"]),
    settings({ fxRates: [{ code: "USD", rate: 1 }] }),
    AT,
    { pr: [], po: [] },
    null,
  )
  expect(procurement).toEqual({ ok: false, code: "no_fx" })
  expect(computeBudgetTotals({ opexOwners: [{ id: "a", budget: 1200 }] }, 2026).totalBudget).toBe(1200)
})

test("S6-19 year amount and annual entry both stay, and neither is the planner spread", () => {
  const annual = annualEntryMonths(100000)
  const year = applyYearAmount(100000, 3)
  const planned = spread({ annual: 100000, b: zeroMonths(), bm: emptyFlags() })
  if (year.cleared) throw new Error("expected a year amount")
  expect(annual[11]).toBe(annual[0])
  expect(annual[11]).not.toBe(planned.b[11])
  expect(year.actual[2]).not.toBe(planned.b[11])
  expect(planned.b[11]).toBe(8333.37)
})

test("S6-20 the chart stays flat total/12 while the cards do not", () => {
  const data = {
    opexOwners: [{ id: "a", budget: 1200 }],
    opexEntries: [{ year: 2026, month: 1, ownerId: "a", budget: 500 }],
  }
  const cards = computeBudgetTotals(data, 2026)
  const chart = budgetChartSeries(cards.totalBudget)
  expect(chart.every((value) => value === cards.totalBudget / 12)).toBe(true)
  expect(chart[0]).not.toBe(500)
})

test("S6-21 self-approval is born off", () => {
  const set = legalInitialSettings()
  expect(set.blockSelfApproval).toBe(false)
  const request = {
    number: "PR-2026-0001",
    status: "pr_pending",
    createdBy: "ada",
    pr: { estAmount: 10, recurring: false, expenseType: "" },
    prApproval: {
      amount: 10,
      fxRate: null,
      steps: [
        {
          levelId: "L1",
          levelName: "CIO-1 (Level 1)",
          threshold: 0,
          holderId: "ada",
          status: "pending",
        },
      ],
    },
    sourcing: null,
    po: null,
    history: [],
  }
  const result = act(request, { type: "approve" }, actor("ada", ["requester"]), set, AT, { pr: [], po: [] }, null)
  if (!result.ok) throw new Error(result.code)
  expect(result.request.status).toBe("sourcing")
})

test("S6-22 the same person in two levels is not refused", () => {
  const set = settings({
    prApprovalMode: "matrix",
    levels: [
      { id: "L1", name: "One", threshold: 0, holderId: "ada" },
      { id: "L2", name: "Two", threshold: 0, holderId: "ada" },
    ],
  })
  const created = act(
    null,
    {
      type: "create",
      pr: { estAmount: 10, recurring: false, expenseType: "" },
    },
    actor("ada", ["requester"]),
    set,
    AT,
    { pr: [], po: [] },
    null,
  )
  if (!created.ok) throw new Error(created.code)
  const submitted = act(
    created.request,
    { type: "submit_pr" },
    actor("ada", ["requester"]),
    set,
    AT,
    { pr: [], po: [] },
    null,
  )
  if (!submitted.ok) throw new Error(submitted.code)
  expect(submitted.request.prApproval?.steps.map((step) => step.holderId)).toEqual(["ada", "ada"])
})

test("S6-23 a rate has no date; a dated settings object is not this delivery", () => {
  const dated = act(
    null,
    { type: "create", pr: { estAmount: 1, recurring: false, expenseType: "" } },
    actor("ada", ["requester"]),
    { ...settings(), valid_from: "2026-01-01" },
    AT,
    { pr: [], po: [] },
    null,
  )
  expect(dated).toEqual({ ok: false, code: "settings_invalid" })
  const request = {
    number: "PR-2026-0001",
    status: "po_draft",
    createdBy: "ada",
    pr: { estAmount: 0, recurring: false, expenseType: "OPEX" },
    prApproval: null,
    sourcing: null,
    po: {
      number: "PO-2026-0001",
      currency: "EUR",
      fxRate: null,
      expenseType: "OPEX",
      supplier: "Acme",
      supplierId: null,
      sourceQuoteId: null,
      lines: [{ qty: 1, unitPrice: 10 }],
      approval: null,
      issuedAt: null,
    },
    history: [],
  }
  const submitted = act(
    request,
    { type: "submit_po" },
    actor("bea", ["buyer"]),
    settings(),
    AT,
    { pr: [], po: [] },
    null,
  )
  if (!submitted.ok) throw new Error(submitted.code)
  expect(submitted.request.po?.approval?.fxRate).toBe(1.08)
  expect(submitted.request.po?.approval && "valid_from" in submitted.request.po.approval).toBe(false)
})

test("S6-24 utilization stays capped, so a colour above 110 cannot be reached", () => {
  const capped = utilization(150, 100)
  expect(capped).toBe(100)
  expect(capped > 110).toBe(false)
  expect(utilization(40, 100)).toBe(40)
})

test("S6-25 spent zero has no variance", () => {
  expect(budgetVariance(0, 100)).toBeNull()
  expect(budgetVariance(0, 100)).not.toBe(0)
  expect(budgetVariance(50, 100)).toBe(-50)
})

test("S6-26 deleting a contract deletes the blob", () => {
  const contracts = { c1: { vendor: "Acme" } }
  const blobs = { c1: { bytes: 4 } }
  expect(deleteContract(contracts, blobs, "c1", true)).toEqual({ ok: true })
  expect(contracts.c1).toBeUndefined()
  expect(blobs.c1).toBeUndefined()
})

test("S6-27 quote upload exists, the file is not accepted, and 25 is not the cap", () => {
  const attachments = {}
  const blobs = {}
  const request = { id: "r1" }
  const small = quoteUpload(attachments, blobs, request, { id: "q1", name: "quote.pdf" }, 1, true)
  const large = quoteUpload(attachments, blobs, request, { id: "q2", name: "big.pdf" }, contractCap(), true)
  expect(small).toMatchObject({
    ok: false,
    upload: true,
    attachment: { id: "q1", name: "quote.pdf", key: "blob/q1" },
    request,
  })
  expect(large).toMatchObject({ ok: false, upload: true })
  expect(blobs).toEqual({})
  expect(request).toEqual({ id: "r1" })
  expect(JSON.stringify(request)).not.toContain("quote.pdf")
  expect(attachments).toEqual({
    q1: { id: "q1", name: "quote.pdf", key: "blob/q1" },
    q2: { id: "q2", name: "big.pdf", key: "blob/q2" },
  })
  expect(quoteUpload(attachments, blobs, request, { id: "q3", name: "x" }, 1, false)).toEqual({
    ok: false,
    upload: false,
  })
})

test("S6-28 a requester does not receive another person's request; the other roles are not cut down to their own", () => {
  const requests = [
    { id: "a", createdBy: "ada" },
    { id: "b", createdBy: "bea" },
  ]
  expect(visibleRequests(requests, actor("ada", ["requester"])).map((item) => item.id)).toEqual(["a"])
  expect(visibleRequests(requests, actor("bea", ["buyer"])).map((item) => item.id)).toEqual(["a", "b"])
  expect(visibleRequests(requests, actor("vie", ["viewer"])).map((item) => item.id)).toEqual(["a", "b"])
  expect(visibleRequests(requests, actor("app", ["approver"])).map((item) => item.id)).toEqual(["a", "b"])
  expect(visibleRequests(requests, actor("sup", ["supplier admin"])).map((item) => item.id)).toEqual(["a", "b"])
  expect(visibleRequests(requests, actor("cio", ["admin"])).map((item) => item.id)).toEqual(["a", "b"])
})

test("S6-29 a duplicate tax id is refused; a duplicate legal name stays a warning", () => {
  const existing = [completeSupplier({ id: "old", taxId: "CHE-1", legalName: "Acme" })]
  expect(
    activateSupplier(
      completeSupplier({ id: "new", taxId: "CHE-1" }),
      actor("sup", ["supplier admin"]),
      existing,
      false,
    ),
  ).toEqual({ ok: false })
  const named = activateSupplier(
    completeSupplier({ id: "new", taxId: "CHE-2", legalName: "Acme" }),
    actor("sup", ["supplier admin"]),
    existing,
    false,
  )
  if (!named.ok) throw new Error("name duplicate refused")
  expect(named.warning).toBe("Acme")
  expect(named.supplier.recognized).toBe("legalName")
  expect(named.supplier.status).toBe("active")
})

test("S6-30 CPX stays above the counter and every version after a delete", () => {
  const next = nextCpx(2026, 1, ["CPX-2024-0009"])
  expect(next.n).toBe(10)
  expect(next.n).not.toBe(2)
  expect(nextCpx(2027, next.counter, []).n).toBe(11)
})

test("S6-31 deputy is not a path", () => {
  const result = act(
    null,
    { type: "create", pr: { estAmount: 1, recurring: false, expenseType: "" } },
    { id: "ada", canWrite: true, roles: ["admin"], deputy: "zoe" },
    settings(),
    AT,
    { pr: [], po: [] },
    null,
  )
  expect(result).toEqual({ ok: false, code: "actor_invalid" })
})

test("S6-32 dashboard contracts use 25 MB; procurement upload does not inherit it", () => {
  expect(contractCap()).toBe(25 * 1024 * 1024)
  expect(contractUpload(25 * 1024 * 1024, true)).toEqual({
    ok: true,
    available: false,
  })
  expect(contractUpload(25 * 1024 * 1024 + 1, true)).toEqual({ ok: false })
  expect(quoteUpload({}, {}, { id: "r" }, { id: "q", name: "q" }, contractCap(), true).ok).toBe(false)
})
