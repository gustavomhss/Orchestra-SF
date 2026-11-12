import { expect, test } from "bun:test"
import type { Row } from "../src/records.ts"
import { act } from "../../porta/act.ts"
import { contractUpload } from "../src/dashboard-role.ts"
import { readMember } from "../src/dashboard-role.ts"
import { legalInitialSettings } from "../src/initial-settings.ts"
import { deleteRate, makeOfficial, plannerField, presentSalary } from "../src/planner-role.ts"
import {
  cancel,
  createRequest,
  createSupplier,
  deleteDraft,
  issue,
  submitPO,
  submitPR,
  submitSourcing,
} from "../src/procurement.ts"
import type { Store } from "../src/procurement.ts"
import { createRecord } from "../src/records.ts"
import { visibleRequests } from "../src/requests.ts"
import { activateSupplier, changeBank, presentSupplier, seal, supplierCsv } from "../src/supplier.ts"

const AT = "2026-11-10T12:00:00Z"
const IDS = ["PAP-act", "PAP-write", "PAP-talent", "PAP-sal", "PAP-iban", "PAP-req", "PAP-lock"]

function actor(id: string, roles: string[], canWrite = true) {
  return { id, canWrite, roles }
}

function settings() {
  return legalInitialSettings()
}

test("PAP registry", async () => {
  const text = await Bun.file(new URL(import.meta.url)).text()
  for (const id of IDS) expect(text).toContain(`test("${id} `)
})

test("PAP-act a foreign role, domains, or deputy is actor_invalid, and the word approver does not authorize", () => {
  const create = {
    type: "create",
    pr: { estAmount: 1, recurring: false, expenseType: "" },
  }
  const issued = { pr: [], po: [] }
  expect(
    act(null, create, { id: "ada", canWrite: true, roles: ["admin"], domains: [] }, settings(), AT, issued, null),
  ).toEqual({ ok: false, code: "actor_invalid" })
  expect(
    act(null, create, { id: "ada", canWrite: true, roles: ["domain leader"] }, settings(), AT, issued, null),
  ).toEqual({ ok: false, code: "actor_invalid" })
  expect(act(null, create, { id: "ada", canWrite: true, roles: ["finance"] }, settings(), AT, issued, null)).toEqual({
    ok: false,
    code: "actor_invalid",
  })
  expect(
    act(null, create, { id: "ada", canWrite: true, roles: ["supplier admin"] }, settings(), AT, issued, null),
  ).toEqual({ ok: false, code: "actor_invalid" })
  expect(
    act(null, create, { id: "ada", canWrite: true, roles: ["admin"], deputy: "zoe" }, settings(), AT, issued, null),
  ).toEqual({ ok: false, code: "actor_invalid" })
  const request = {
    number: "PR-2026-0001",
    status: "pr_pending",
    createdBy: "ada",
    pr: { estAmount: 1, recurring: false, expenseType: "" },
    prApproval: {
      amount: 1,
      fxRate: null,
      steps: [
        {
          levelId: "L1",
          levelName: "CIO-1 (Level 1)",
          threshold: 0,
          holderId: "zoe",
          status: "pending",
        },
      ],
    },
    sourcing: null,
    po: null,
    history: [],
  }
  expect(act(request, { type: "approve" }, actor("ada", ["approver"]), settings(), AT, issued, null)).toEqual({
    ok: false,
    code: "not_approver",
  })
})

test("PAP-write canWrite false refuses the write the button would have hidden", () => {
  const quiet = actor("cio", ["admin"], false)
  const saved: Store = {
    settings: settings(),
    form: { currency: "USD" },
    issued: { pr: [], po: [] },
    sup: [],
    suppliers: [],
    requests: {
      draft: {
        version: 1,
        by: "ada",
        request: { status: "draft", createdBy: "ada" },
      },
      ready: {
        version: 1,
        by: "bea",
        request: {
          status: "po_approved",
          createdBy: "ada",
          po: { number: "PO-2026-0001", issuedAt: null },
        },
      },
    },
    actCalls: 0,
    lastIssued: null,
  }
  expect(deleteDraft(saved, "draft", 1, quiet)).toEqual({ ok: false })
  expect(issue(saved, "ready", 1, actor("bea", ["buyer"], false), AT)).toEqual({
    ok: false,
  })
  expect(cancel(saved, "draft", 1, actor("ada", ["requester"], false), AT, "stop")).toEqual({ ok: false })
  expect(saved.requests.draft.request.status).toBe("draft")
  expect(saved.requests.ready.request.status).toBe("po_approved")
  expect(saved.actCalls).toBe(0)
  const created = createRequest(
    saved,
    { type: "create", pr: { estAmount: 1, recurring: false, expenseType: "" } },
    actor("ada", ["requester"], false),
    AT,
  )
  expect(created.ok).toBe(false)
  expect(Object.keys(saved.requests)).toEqual(["draft", "ready"])
  const rows: Record<string, Row> = {}
  expect(createRecord(rows, "line", { n: 1 }, quiet).ok).toBe(false)
  expect(rows["line"]).toBeUndefined()
  expect(deleteRate("card", [], false)).toEqual({ ok: false })
  expect(
    changeBank(
      {
        id: "s",
        status: "pending",
        iban: seal("GB00", new Uint8Array(32).fill(1)),
      },
      "iban",
      "GB99",
      quiet,
      new Uint8Array(32).fill(1),
    ).ok,
  ).toBe(false)
  expect(
    changeBank({ id: "s", status: "pending" }, "iban", "GB99", actor("bea", ["buyer"]), new Uint8Array(32).fill(1)),
  ).toEqual({ ok: false })
  expect(activateSupplier({ id: "s", status: "pending" }, quiet, [], false)).toEqual({ ok: false })
  expect(makeOfficial([{ id: "v", year: 2026, locked: false }], {}, "v", quiet)).toEqual({ ok: false })
  expect(makeOfficial([{ id: "v", year: 2026, locked: false }], {}, "v", actor("fin", ["finance"]))).toEqual({
    ok: false,
  })
  expect(createSupplier(saved, actor("bea", ["buyer"], false))).toEqual({
    ok: false,
  })
  const calls = saved.actCalls
  expect(
    submitPR(saved, "draft", 1, actor("ada", ["requester"], false), AT, {
      pr: { title: "x" },
    }),
  ).toEqual({ ok: false })
  expect(submitSourcing(saved, "draft", 1, actor("bea", ["buyer"], false), AT, {})).toEqual({ ok: false })
  expect(submitPO(saved, "ready", 1, actor("bea", ["buyer"], false), AT, {})).toEqual({ ok: false })
  expect(saved.actCalls).toBe(calls)
  expect(saved.requests.draft.request.status).toBe("draft")
  expect(saved.requests.ready.request.status).toBe("po_approved")
  expect(contractUpload(1, false)).toEqual({ ok: false })
})

test("PAP-talent equating leaderId with actor.id does not reveal talent", () => {
  const member = {
    id: "m1",
    leaderId: "lead-1",
    cls: "Talent",
    outlook: "Promote",
    notes: "private",
    name: "Ada",
  }
  const seen = readMember(member, actor("lead-1", ["domain leader"]), AT, [])
  expect(seen.cls).toBeUndefined()
  expect(seen.outlook).toBeUndefined()
  expect(seen.notes).toBeUndefined()
  expect(readMember(member, actor("cio", ["admin"]), AT, []).cls).toBe("Talent")
})

test("PAP-sal the server does not send rate, override, or position cost", () => {
  const view = { rates: [1], rateOverride: 2, cost: 3, inc: 4, total: 9 }
  for (const role of ["budget owner", "viewer", "requester"]) {
    const seen = presentSalary(view, actor("ada", [role]))
    expect(seen).toEqual({ total: 9 })
    expect("rates" in seen).toBe(false)
    expect("rateOverride" in seen).toBe(false)
    expect("cost" in seen).toBe(false)
    expect("inc" in seen).toBe(false)
  }
  expect(presentSalary(view, actor("fin", ["finance"]))).toEqual(view)
  expect(presentSalary(view, actor("cio", ["admin"]))).toEqual(view)
})

test("PAP-iban the response is not clear IBAN, and the CSV has neither IBAN nor SWIFT", () => {
  const secret = new Uint8Array(32).fill(3)
  const stored = {
    id: "s1",
    status: "active",
    legalName: "Acme",
    iban: seal("GB00CLEAR", secret),
    account: seal("1", secret),
    swift: "AAAA",
  }
  const seen = presentSupplier(stored, actor("bea", ["buyer"]), secret)
  expect(JSON.stringify(seen)).not.toContain("GB00CLEAR")
  const csv = supplierCsv([stored], actor("vie", ["viewer"]), secret)[0]
  expect(csv.iban).toBeUndefined()
  expect(csv.swift).toBeUndefined()
  expect(presentSupplier(stored, actor("sup", ["supplier admin"]), secret).iban).toBe("GB00CLEAR")
  const adminCsv = supplierCsv([stored], actor("cio", ["admin"]), secret)[0]
  expect(adminCsv.iban).toBe("GB00CLEAR")
  expect(adminCsv.swift).toBe("AAAA")
})

test("PAP-req a requester does not receive another person's request", () => {
  const requests = [
    { id: "mine", createdBy: "ada" },
    { id: "theirs", createdBy: "bea" },
  ]
  expect(visibleRequests(requests, actor("ada", ["requester"]))).toEqual([{ id: "mine", createdBy: "ada" }])
})

test("PAP-lock lock wins, official cannot be unlocked, and closing a month stays allowed", () => {
  const locked = { id: "v1", year: 2026, locked: true }
  const open = { id: "v2", year: 2026, locked: false }
  const admin = actor("cio", ["admin"])
  const finance = actor("fin", ["finance"])
  expect(plannerField("budget", locked, undefined, admin)).toBe(false)
  expect(plannerField("unlock", locked, "v1", admin)).toBe(false)
  expect(plannerField("closedThrough", locked, "v1", admin)).toBe(true)
  expect(plannerField("closedThrough", locked, "v1", actor("cio", ["admin"], false))).toBe(false)
  expect(plannerField("budget", open, undefined, finance)).toBe(false)
  expect(plannerField("headcount", open, undefined, finance)).toBe(false)
  expect(plannerField("rate", open, undefined, finance)).toBe(false)
  expect(plannerField("structure", open, undefined, finance)).toBe(false)
  expect(plannerField("actual", locked, undefined, finance)).toBe(true)
  expect(plannerField("forecast", locked, undefined, finance)).toBe(true)
  expect(plannerField("fx", locked, undefined, finance)).toBe(false)
  expect(plannerField("fx", open, undefined, finance)).toBe(true)
  expect(plannerField("closedThrough", locked, undefined, finance)).toBe(true)
  expect(plannerField("rate", open, undefined, actor("hr", ["hr"]))).toBe(true)
  expect(plannerField("increase", locked, undefined, actor("hr", ["hr"]))).toBe(false)
  expect(plannerField("budget", open, undefined, admin, { hr: true })).toBe(false)
  expect(plannerField("actual", open, undefined, admin, { hr: true })).toBe(true)
  expect(
    plannerField("forecast", open, undefined, actor("own", ["budget owner"]), {
      ownerId: "own",
    }),
  ).toBe(true)
  expect(
    plannerField("budget", open, undefined, actor("own", ["budget owner"]), {
      ownerId: "own",
    }),
  ).toBe(false)
  expect(
    plannerField("forecast", open, undefined, actor("own", ["budget owner"]), {
      ownerId: "other",
    }),
  ).toBe(false)
  expect(
    plannerField(
      "forecast",
      open,
      undefined,
      { id: "own", canWrite: true, roles: ["budget owner"], domains: ["Apps"] },
      { domain: "Apps" },
    ),
  ).toBe(true)
  expect(
    plannerField(
      "forecast",
      open,
      undefined,
      { id: "own", canWrite: true, roles: ["budget owner"], domains: [] },
      { domain: "Apps" },
    ),
  ).toBe(false)
  expect(plannerField("forecast", open, undefined, actor("vie", ["viewer"]))).toBe(false)
})
