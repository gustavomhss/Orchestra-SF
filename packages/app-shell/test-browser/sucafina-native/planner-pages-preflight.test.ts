import { describe, expect, test } from "bun:test"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import { createSfTransport, type SfDesktopCapability } from "@orchestra/client/sucafina/transport"
import type { SfRef } from "@orchestra/schema/sucafina/context"
import { encodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"
import { matchSfNativeRoutePath } from "../../src/orchestra/chapters/sucafina/route-registry"
import { parsePlannerPagesRouteQuery } from "../../src/orchestra/chapters/sucafina/host/planner-pages-route"
import { plannerPagesNeedsPreflight, plannerPagesSelectionMatches, preflightPlannerPages } from "../../src/orchestra/chapters/sucafina/host/planner-pages-preflight"

const stamp = { installationId: "install", projectId: "project", hostId: "host", principalRef: "principal", policyVersion: "policy", accessRevision: "revision" }
const binding = { installationId: "install", projectId: "project", hostId: "host", publicOrigin: "https://sf.example.test", mount: "/sucafina", authMode: "microsoft" as const, contractRevision: "sf-native-ui/1" as const }
const candidate = matchSfNativeRoutePath(`/orchestra/sf-planner/opex/lines/${encodeSfRouteRef("line")}`)!
const query = { year: 2026, version: "v1" as SfRef }
const body = (version = "v1", year = 2026, line = "line", accessRevision = "revision") => ({
  status: "ok" as const, context: { ...stamp, accessRevision }, value: {
    capabilityId: "CAP18" as const, selection: { year: 2026, versionId: version },
    data: { versions: [{ id: version, name: "Version", year, locked: false, closed: 0, official: false }],
      selectedVersion: { id: version, name: "Version", year, locked: false, closed: 0, official: false },
      lines: [{ id: line, name: "Line", revision: 0 }], split: [] }, versions: {}, allowedActionIds: [],
  },
})
function transport(response: ReturnType<typeof body> | undefined, onInvoke?: () => void) {
  const desktop: SfDesktopCapability = {
    registerConnection: async () => ({ status: "cancelled" }), bind: async () => ({ status: "denied" }),
    invoke: async () => {
      onInvoke?.()
      return response ? { kind: "json-response", status: 200, headers: { "content-type": "application/json" }, body: response } :
        { kind: "empty-response", status: 503, headers: {} }
    },
    abort: async () => {}, login: async () => ({ status: "denied" }),
    logout: async () => ({ status: "cleared", remote: "unavailable" }), release: async () => {},
  }
  return createSfTransport({ binding, generation: 1, currentGeneration: () => 1,
    fetch: async () => { throw new Error("unexpected renderer fetch") }, operations: SfNativeOperationBindings,
    desktop, desktopBinding: { bindingHandle: "preflight", descriptor: binding, generation: 1 } })
}

describe("planner original-source preflight", () => {
  test("accepts only consumed, source-schema-valid version selectors", () => {
    expect(parsePlannerPagesRouteQuery(new URLSearchParams("year=2026&version=v1"), candidate)).toEqual(query)
    expect(parsePlannerPagesRouteQuery(new URLSearchParams("version=v1&version=v2"), candidate)).toBeUndefined()
    expect(parsePlannerPagesRouteQuery(new URLSearchParams("version=v1%00"), candidate)).toBeUndefined()
    const allocation = matchSfNativeRoutePath("/orchestra/sf-planner/allocations")!
    expect(parsePlannerPagesRouteQuery(new URLSearchParams("version=v1"), allocation)).toBeUndefined()
    expect(plannerPagesNeedsPreflight(candidate, query)).toBe(true)
    expect(plannerPagesNeedsPreflight(matchSfNativeRoutePath("/orchestra/sf-planner/opex")!, {})).toBe(false)
  })
  test("checks actual source version, year, record and stamp", async () => {
    const signal = new AbortController().signal
    const run = (response: ReturnType<typeof body> | undefined) => preflightPlannerPages({ candidate, query, transport: transport(response), stamp, signal, current: () => true })
    expect(await run(body())).toBe("authorized")
    expect(await run(body("v2"))).toBe("denied")
    expect(await run(body("v1", 2025))).toBe("denied")
    expect(await run(body("v1", 2026, "other"))).toBe("denied")
    expect(await run(body("v1", 2026, "line", "revoked"))).toBe("denied")
    const wrongSelection = body()
    wrongSelection.value.selection.versionId = "other"
    expect(await run(wrongSelection)).toBe("denied")
    const absentVersion = body()
    absentVersion.value.data.versions = []
    expect(await run(absentVersion)).toBe("denied")
    const duplicateRecord = body()
    duplicateRecord.value.data.lines.push({ ...duplicateRecord.value.data.lines[0]! })
    expect(await run(duplicateRecord)).toBe("denied")
    expect(await run(undefined)).toBe("denied")
  })
  test("abort and generation loss never authorize", async () => {
    const aborted = new AbortController()
    aborted.abort()
    expect(await preflightPlannerPages({ candidate, query, transport: transport(body()), stamp, signal: aborted.signal, current: () => true })).toBe("unavailable")
    const interrupted = new AbortController()
    expect(await preflightPlannerPages({ candidate, query, transport: transport(body(), () => interrupted.abort()), stamp,
      signal: interrupted.signal, current: () => true })).toBe("unavailable")
    let current = true
    expect(await preflightPlannerPages({ candidate, query, transport: transport(body(), () => { current = false }), stamp,
      signal: new AbortController().signal, current: () => current })).toBe("unavailable")
  })
  test("matches each original capability's own record collection", () => {
    const selected = { id: "v1", year: 2026 }
    const base = { selection: { year: 2026, versionId: "v1" }, data: { selectedVersion: selected, versions: [selected] } }
    const cases = [
      { path: `capex/projects/${encodeSfRouteRef("p")}`, value: { ...base, capabilityId: "CAP19", data: { ...base.data, projects: [{ id: "p" }], lines: [] } } },
      { path: `headcount/positions/${encodeSfRouteRef("p")}`, value: { ...base, capabilityId: "CAP20", data: { ...base.data, positions: [{ id: "p" }] } } },
      { path: `allocations/entities/${encodeSfRouteRef("p")}`, value: { capabilityId: "CAP21", selection: { year: 2026 }, data: { entities: [{ id: "p" }], allocations: [] } } },
      { path: "fx", value: { ...base, capabilityId: "CAP22", data: { ...base.data, rates: [], warnings: [] } } },
    ]
    for (const item of cases) {
      const route = matchSfNativeRoutePath(`/orchestra/sf-planner/${item.path}`)!
      const page = item.value as unknown as Parameters<typeof plannerPagesSelectionMatches>[2]
      expect(plannerPagesSelectionMatches(route, {}, page)).toBe(true)
      if (item.value.capabilityId !== "CAP21") expect(plannerPagesSelectionMatches(route, { year: 2025 }, page)).toBe(false)
    }
  })
})
