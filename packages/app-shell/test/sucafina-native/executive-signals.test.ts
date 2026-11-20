import { describe, expect, test } from "bun:test"
import type { SfContext, SfOwnerSelection, SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import type { SfOperation, SfTransportResult } from "@orchestra/schema/sucafina/common"
import type { SfCallOptions, SfTransport } from "@orchestra/client/sucafina/transport"
import { parseDashboardRouteQuery } from "../../src/orchestra/chapters/sucafina/host/dashboard-route"
import { matchSfNativeRoutePath } from "../../src/orchestra/chapters/sucafina/route-registry"
import {
  sfExecutiveLinkAllowed, sfExecutiveLinkMatches, sfExecutiveLinkRequest, sfExecutiveRevalidateRef,
  type SfExecutiveSourceRoute,
} from "../../src/orchestra/chapters/sucafina/cross-links"
import { parseSfSignalPriorities, sfExecutiveSignals, sfExecutiveSignalTarget } from "../../src/orchestra/chapters/sucafina/dashboard/executive/signals"

const owner = { serverKey: "server", projectId: "project", installationId: "installation" } as SfOwnerSelection
const from: SfExecutiveSourceRoute = { ownerSelection: owner, query: { year: 2026, month: 11 } }
const signals = [
  { id: "hotTopics:late", page: "Hot Topics & Actions", recordId: "late", fact: "Overdue action", rule: "Past due", date: "2026-10-01" },
  { id: "risks:old", page: "IT Risks", recordId: "old", fact: "Earlier risk", rule: "High impact", date: "2026-11-01" },
  { id: "risks:undated", page: "IT Risks", recordId: "undated", fact: "Undated risk", rule: "High impact", date: "" },
]
const candidate = matchSfNativeRoutePath("/orchestra/sf-dashboard/executive")!
const context = {
  destinations: [{ capabilityId: "CAP01", canRead: true }],
  availability: [{ family: "domain-read", resource: "CAP01",
    operations: [{ operationId: "domain.page.CAP01", state: "ready", operational: true }] }],
} as unknown as SfContext

// Port-contract tests deliberately control the source reply. The installed
// Dashboard browser test separately covers the real owner, F01 and transport.
function source(read: () => Promise<unknown>, requests: unknown[] = []): SfTransport {
  return {
    async execute<Input, Output>(operation: SfOperation<Input, Output>, input: Input, options: SfCallOptions) {
      requests.push({ operation: operation.operationId, input, signal: options.signal })
      return await read() as SfTransportResult<Output>
    },
  }
}
const response = (current: typeof signals) => ({
  kind: "response", status: 200, headers: {},
  body: { status: "ok", value: { capabilityId: "CAP01", data: { signals: current } } },
})

describe("native executive signal presentation and source handoff", () => {
  test("keeps all eligible records in producer order, including overdue and undated signals", () => {
    const before = structuredClone(signals)
    expect(sfExecutiveSignals(signals, [])).toEqual(signals)
    expect(sfExecutiveSignals(signals, ["risks:undated", "private:absent"])).toEqual([signals[2]!, signals[0]!, signals[1]!])
    expect(sfExecutiveSignals(signals, ["risks:undated", "hotTopics:late"])).toEqual([signals[0]!, signals[2]!, signals[1]!])
    expect(signals).toEqual(before)
  })

  test("accepts unique bounded presentation IDs only on CAP01 without relaxing other duplicate keys", () => {
    const query = new URLSearchParams("year=2026&month=11&signalPriority=risks%3Aundated&signalPriority=hotTopics%3Alate")
    expect(parseDashboardRouteQuery(query, candidate)).toEqual({
      year: 2026, month: 11, signalPriority: ["risks:undated", "hotTopics:late"],
    })
    expect(Object.isFrozen(parseDashboardRouteQuery(query, candidate)?.signalPriority)).toBe(true)
    for (const value of [
      "signalPriority=", "signalPriority=risks%3A", "signalPriority=risks%3A%20", "signalPriority=risks%3Ax%0A",
      "signalPriority=unknown%3Ax", "signalPriority=risks%3Ax&signalPriority=risks%3Ax",
      "year=2026&year=2026", "server=s&project=p&installation=i&server=s", "q=private",
    ]) expect(parseDashboardRouteQuery(new URLSearchParams(value), candidate)).toBeUndefined()
    for (const path of ["budget", "hot-topics", "opex", "capex"]) {
      expect(parseDashboardRouteQuery(new URLSearchParams("signalPriority=risks%3Ax"),
        matchSfNativeRoutePath("/orchestra/sf-dashboard/" + path)!)).toBeUndefined()
    }
    expect(parseSfSignalPriorities(Array.from({ length: 33 }, (_, index) => "risks:" + index))).toBeUndefined()
    expect(parseSfSignalPriorities(["risks:" + "x".repeat(513)])).toBeUndefined()
  })

  test("retains the exact owner and period in the candidate link without turning IDs into authority", () => {
    const target = { kind: "signal-priority", ids: ["risks:undated"] } as const
    const href = sfExecutiveLinkRequest(from, target)!
    const url = new URL(href, "https://orchestra.example")
    expect(url.pathname).toBe("/orchestra/sf-dashboard/executive")
    expect([...url.searchParams]).toEqual([
      ["server", "server"], ["project", "project"], ["installation", "installation"],
      ["signalPriority", "risks:undated"], ["year", "2026"], ["month", "11"],
    ])
    expect(sfExecutiveLinkAllowed(context, target)).toBe(true)
    expect(sfExecutiveLinkAllowed({ ...context, destinations: [] }, target)).toBe(false)
    expect(sfExecutiveLinkAllowed({ ...context, availability: [] }, target)).toBe(false)
    expect(sfExecutiveLinkAllowed(context, { kind: "signal-priority", ids: ["not-a-source"] })).toBe(false)
    expect(sfExecutiveLinkRequest({ ...from, ownerSelection: { ...owner, installationId: undefined } }, target)).toBeUndefined()
    const route = { surfaceId: "CAP01", kind: "entry", params: {}, ownerSelection: owner,
      href, pathname: url.pathname, query: parseDashboardRouteQuery(url.searchParams, candidate)! } as SfResolvedRoute<"CAP01">
    expect(sfExecutiveLinkMatches(route, target)).toBe(true)
    expect(sfExecutiveLinkMatches({ ...route, query: { ...route.query, signalPriority: ["risks:other"] } }, target)).toBe(false)
    expect(sfExecutiveLinkMatches({ ...route, query: {} }, { kind: "signal-priority", ids: [] })).toBe(true)
  })

  test("requires every priority to remain in one fresh CAP01 result and never forwards presentation IDs", async () => {
    const requests: unknown[] = []
    const signal = new AbortController().signal
    const target = { kind: "signal-priority", ids: ["risks:undated"] } as const
    expect(await sfExecutiveRevalidateRef(source(async () => response(signals), requests), from, target, signal)).toBe(true)
    expect(requests).toEqual([{ operation: "domain.page.CAP01", input: { execYear: 2026, executiveMonth: 11 }, signal }])
    expect(await sfExecutiveRevalidateRef(source(async () => response(signals.slice(0, 2))), from, target, signal)).toBe(false)
    expect(await sfExecutiveRevalidateRef(source(async () => response([...signals, signals[2]!])), from, target, signal)).toBe(false)
    expect(await sfExecutiveRevalidateRef(source(async () => ({ kind: "response", status: 403, body: { status: "denied" } })), from, target, signal)).toBe(false)
    expect(await sfExecutiveRevalidateRef(source(async () => ({ kind: "transport-error", reason: "network" })), from, target, signal)).toBe(false)
    expect(await sfExecutiveRevalidateRef(source(async () => response([])), from, { kind: "signal-priority", ids: [] }, signal)).toBe(true)
  })

  test("an aborted source read cannot commit a previously eligible priority", async () => {
    const abort = new AbortController()
    const transport = source(async () => { abort.abort(); return response(signals) })
    expect(await sfExecutiveRevalidateRef(transport, from, { kind: "signal-priority", ids: ["risks:old"] }, abort.signal)).toBe(false)
    let calls = 0
    expect(await sfExecutiveRevalidateRef(source(async () => { calls++; return response(signals) }), from,
      { kind: "signal-priority", ids: [] }, abort.signal)).toBe(false)
    expect(calls).toBe(0)
  })

  test("opens only exact native record identities and carries the executive period", () => {
    expect(sfExecutiveSignalTarget(signals[0]!)).toEqual({ kind: "topic", ref: "late" })
    expect(sfExecutiveSignalTarget(signals[2]!)).toEqual({ kind: "risk", ref: "undated" })
    expect(sfExecutiveSignalTarget({ ...signals[2]!, recordId: "different" })).toBeUndefined()
    expect(sfExecutiveSignalTarget({ id: "contracts:c", page: "Vendor Contracts", recordId: "c", fact: "Contract", rule: "Renewal", date: "2026-11-01" })).toBeUndefined()
    for (const signal of [signals[0]!, signals[2]!]) {
      const url = new URL(sfExecutiveLinkRequest(from, sfExecutiveSignalTarget(signal)!)!, "https://orchestra.example")
      expect(url.searchParams.get("year")).toBe("2026")
      expect(url.searchParams.get("month")).toBe("11")
      expect(url.searchParams.has("signalPriority")).toBe(false)
    }
  })
})
