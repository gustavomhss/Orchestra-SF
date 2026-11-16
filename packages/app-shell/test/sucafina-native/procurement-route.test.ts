import { describe, expect, test } from "bun:test"
import type { SfContext } from "@orchestra/schema/sucafina/context"
import { matchSfNativeRoutePath } from "../../src/orchestra/chapters/sucafina/route-registry"
import { encodeSfRouteRef, resolveSfUrlSelection } from "../../src/orchestra/chapters/sucafina/navigation-state"
import { parseProcurementRouteQuery, procurementRouteAvailable } from "../../src/orchestra/chapters/sucafina/host/procurement-route"
import { findSubmittedPr } from "../../src/orchestra/chapters/sucafina/procurement/approvals/pr/model"
import { findPendingApproval } from "../../src/orchestra/chapters/sucafina/procurement/approvals/remaining/model"
import type { SfOwnerSelection, SfRef, SfServerKey } from "@orchestra/schema/sucafina/context"

describe("procurement route admission", () => {
  test("recognizes real entries and details and rejects hostile selectors", () => {
    for (const path of ["contracts", "overview", "requests", `requests/${encodeSfRouteRef("PR-1")}/sourcing`, `requests/${encodeSfRouteRef("PR-1")}/sourcing/compare`, `approvals/${encodeSfRouteRef("PR-1")}/review`, `suppliers/${encodeSfRouteRef("S-1")}/edit`, "settings"]) {
      const route = matchSfNativeRoutePath(`/orchestra/sf-procurement/${path}`)!
      expect(route).toBeDefined()
      expect(parseProcurementRouteQuery(new URLSearchParams("server=s&project=p&installation=i"), route)).toEqual({})
      for (const query of ["server=s", "server=s&project=p&installation=i&server=x", "x=1", "returnTo=%2Forchestra%2Fsf-home", "year=2026&year=2026"]) expect(parseProcurementRouteQuery(new URLSearchParams(query), route)).toBeUndefined()
    }
    for (const path of ["overview", "settings"]) {
      const route = matchSfNativeRoutePath(`/orchestra/sf-procurement/${path}`)!
      expect(parseProcurementRouteQuery(new URLSearchParams("year=2026&month=12"), route)).toEqual({ year: 2026, month: 12 })
      for (const query of ["year=2028", "month=13"]) expect(parseProcurementRouteQuery(new URLSearchParams(query), route)).toBeUndefined()
    }
    expect(parseProcurementRouteQuery(new URLSearchParams("year=2026"), matchSfNativeRoutePath("/orchestra/sf-procurement/requests")!)).toBeUndefined()
  })
  test("requires readable destination and operational source for every capability", () => {
    for (const [path, id, family] of [["contracts", "CAP14", "domain-read"], ["overview", "CAP24", "procurement"], ["requests", "CAP25", "procurement"], ["approvals", "CAP26", "procurement"], ["suppliers", "CAP27", "procurement"], ["settings", "CAP28", "procurement"]]) {
      const route = matchSfNativeRoutePath(`/orchestra/sf-procurement/${path}`)!
      const context = { destinations: [{ capabilityId: id, canRead: true }], availability: [{ family, resource: id, operations: [{ operationId: `domain.page.${id}`, state: "ready", operational: true }] }] } as unknown as SfContext
      expect(procurementRouteAvailable(context, route)).toBe(true)
      expect(procurementRouteAvailable({ ...context, destinations: [{ ...context.destinations[0]!, canRead: false }] }, route)).toBe(false)
      expect(procurementRouteAvailable({ ...context, availability: [] }, route)).toBe(false)
      expect(procurementRouteAvailable({ ...context, availability: [{ ...context.availability[0]!, operations: [{ ...context.availability[0]!.operations[0]!, operational: false }] }] }, route)).toBe(false)
    }
  })
  test("owner selection never fills a partial URL from the active owner", () => {
    const selected = { serverKey: "a" as SfServerKey, projectId: "p" as SfRef, installationId: "i" as SfRef } satisfies SfOwnerSelection
    expect(resolveSfUrlSelection("/orchestra/sf-procurement/overview?project=other", "/orchestra/sf-home", selected).status).toBe("invalid-link")
    const foreign = resolveSfUrlSelection("/orchestra/sf-procurement/overview?server=b&project=q&installation=j", "/orchestra/sf-home", selected)
    expect(foreign.status).toBe("selected")
    if (foreign.status === "selected") expect(foreign.selection.projectId).toBe("q" as SfRef)
  })
  test("approval panels retain their separate original stage guards", () => {
    const page = { value: { data: { requests: [{ number: "r", status: "draft" }] } } } as unknown as Parameters<typeof findSubmittedPr>[0]
    expect(findSubmittedPr(page, "r").kind).toBe("not-submitted")
    expect(findPendingApproval(page, "r").kind).toBe("not-pending")
  })
})
