import { describe, expect, test } from "bun:test"
import type { SfContext } from "@orchestra/schema/sucafina/context"
import { matchSfNativeRoutePath } from "../../src/orchestra/chapters/sucafina/route-registry"
import { encodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"
import { dashboardRouteAvailable, parseDashboardRouteQuery } from "../../src/orchestra/chapters/sucafina/host/dashboard-route"
import { sourceDestinations } from "./source-context-fixture"

describe("dashboard route admission", () => {
  test("recognizes real entry and detail routes, consuming only supported selectors", () => {
    for (const path of ["executive", "budget", "hot-topics", "opex", "capex", `hot-topics/${encodeSfRouteRef("t-1")}/edit`, `opex/${encodeSfRouteRef("o-1")}`, `capex/${encodeSfRouteRef("c-1")}`]) {
      const route = matchSfNativeRoutePath(`/orchestra/sf-dashboard/${path}`)!
      expect(route).toBeDefined()
      expect(parseDashboardRouteQuery(new URLSearchParams("server=s&project=p&installation=i"), route)).toEqual({})
      for (const query of ["server=s", "server=s&project=p&installation=i&server=x", "unknown=1", "year=2026&year=2026"]) {
        expect(parseDashboardRouteQuery(new URLSearchParams(query), route)).toBeUndefined()
      }
    }
    const topic = matchSfNativeRoutePath("/orchestra/sf-dashboard/hot-topics")!
    expect(parseDashboardRouteQuery(new URLSearchParams("year=2026&month=2&status=open"), topic)).toEqual({ year: 2026, month: 2, status: "open" })
    for (const query of ["year=2023", "month=13", "status=invalid"]) expect(parseDashboardRouteQuery(new URLSearchParams(query), topic)).toBeUndefined()
    for (const path of ["executive", "budget"]) {
      expect(parseDashboardRouteQuery(new URLSearchParams("year=2026&month=2"), matchSfNativeRoutePath(`/orchestra/sf-dashboard/${path}`)!)).toEqual({ year: 2026, month: 2 })
    }
    expect(parseDashboardRouteQuery(new URLSearchParams("month=2"), matchSfNativeRoutePath("/orchestra/sf-dashboard/opex")!)).toBeUndefined()
    const detail = matchSfNativeRoutePath(`/orchestra/sf-dashboard/opex/${encodeSfRouteRef("o-1")}`)!
    expect(detail.parameters.lineRef).toBe("o-1" as typeof detail.parameters.lineRef)
    expect(matchSfNativeRoutePath("/orchestra/sf-dashboard/opex/not-encoded")).toBeUndefined()
  })
  test("requires readable destination and operational source for each capability", () => {
    for (const [path, id] of [["executive", "CAP01"], ["hot-topics", "CAP02"], ["budget", "CAP03"], ["opex", "CAP04"], ["capex", "CAP05"]]) {
      const route = matchSfNativeRoutePath(`/orchestra/sf-dashboard/${path}`)!
      const context = { destinations: [{ capabilityId: id, canRead: true }], availability: [{ family: "domain-read", resource: id, operations: [{ operationId: `domain.page.${id}`, state: "ready", operational: true }] }] } as unknown as SfContext
      expect(dashboardRouteAvailable(context, route)).toBe(true)
      expect(dashboardRouteAvailable({ ...context, destinations: [{ ...context.destinations[0]!, canRead: false }] }, route)).toBe(false)
      expect(dashboardRouteAvailable({ ...context, availability: [] }, route)).toBe(false)
      expect(dashboardRouteAvailable({ ...context, availability: [{ ...context.availability[0]!, operations: [{ ...context.availability[0]!.operations[0]!, operational: false }] }] }, route)).toBe(false)
    }
  })
  test("proposal detail uses its original workbench operation", () => {
    const candidate = matchSfNativeRoutePath(`/orchestra/sf-dashboard/hot-topics/proposals/${encodeSfRouteRef("proposal")}`)!
    expect(parseDashboardRouteQuery(new URLSearchParams(), candidate)).toEqual({})
    expect(parseDashboardRouteQuery(new URLSearchParams("returnTo=x"), candidate)).toBeUndefined()
    const context = { destinations: sourceDestinations, availability: [{ family: "domain-read", resource: "hot-topic-proposal", operations: [{ operationId: "dashboard.dashboard-workbench", state: "ready", operational: true }] }] } as unknown as SfContext
    expect(dashboardRouteAvailable(context, candidate)).toBe(true)
    expect(dashboardRouteAvailable({ ...context, availability: [] }, candidate)).toBe(false)
  })
})
