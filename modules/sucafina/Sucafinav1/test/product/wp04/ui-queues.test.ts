import { expect, test } from "bun:test"
import { approvalQueue, requestList } from "../../../src/procurement-screen.ts"
import { render } from "../../../runtime/procurement.ts"

const actor = { id: "buyer-1", roles: ["buyer"], canWrite: true }
const context = { actor, year: 2026, month: 11, at: "2026-11-13T12:00:00Z", versions: {} }

function pending(number: string, at: string | null, holderId = "holder-1") {
  return { number, status: "pr_pending", createdBy: "requester-1", requesterName: "Requesting person", buyerId: "buyer-1", prApprovalBaseCurrency: "USD", pr: { title: number }, prApproval: { amount: 10, steps: [{ status: "pending", holderId }] }, history: at ? [{ at, by: "requester-1", action: "Requisition submitted for approval", note: "" }] : [] }
}

test("approval queues sort only by proven entry, keep unavailable history and do not use a save timestamp", () => {
  const unknown = { ...pending("PR-0", null), createdAt: "2000-01-01" }
  const earlier = pending("PR-1", "2026-11-01T12:00:00Z")
  earlier.history.push({ at: "2026-11-12T12:00:00Z", by: "requester-1", action: "Saved", note: "" })
  const later = pending("PR-2", "2026-11-05T12:00:00Z")
  const input = [unknown, later, earlier]
  const before = structuredClone(input)
  expect(approvalQueue(input, "holder-1").waitingForYou.map((request) => request.number)).toEqual(["PR-1", "PR-2", "PR-0"])
  expect(input).toEqual(before)
  const html = render("My approvals", { requests: input, formSettings: { currency: "USD" } }, context)!
  expect(html).toContain("oldest proven entry")
  expect(html).not.toContain("2000-01-01")
  expect(html.indexOf("PR-1</a>")).toBeLessThan(html.indexOf("PR-2</a>"))
  expect(html.indexOf("PR-2</a>")).toBeLessThan(html.indexOf("PR-0</a>"))
})

test("request search covers stored requester, buyer and holder identifiers and authorized directory names", () => {
  const first = pending("PR-1", "2026-11-01T12:00:00Z")
  const second = { ...pending("PR-2", null, "holder-2"), buyerId: "buyer-2", createdBy: "requester-2", requesterName: "Other requester" }
  expect(requestList([first, second], actor, "All", "BUYER-1").map((request) => request.number)).toEqual(["PR-1"])
  expect(requestList([first, second], actor, "All", "holder-2").map((request) => request.number)).toEqual(["PR-2"])
  expect(requestList([first, second], { id: "requester-1", roles: ["requester"] }, "All", "holder-2")).toEqual([])
  const html = render("Requests", { requests: [first, second], q: "Assigned reviewer", directory: [{ id: "holder-1", name: "Assigned reviewer" }], formSettings: { currency: "USD" } }, context)!
  expect(html).toContain("Search request, requester, buyer, stage or current holder")
  expect(html).toContain("PR-1")
  expect(html).not.toContain("PR-2")
  expect(html).toContain("current holder: Assigned reviewer")
})
