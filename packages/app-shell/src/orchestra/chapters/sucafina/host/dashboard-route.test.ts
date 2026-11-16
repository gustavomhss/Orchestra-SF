import { describe, expect, test } from "bun:test"
import { matchSfNativeRoutePath } from "./../route-registry"
import { dashboardRouteAvailable, parseDashboardRouteQuery } from "./dashboard-route"
import type { SfContext } from "@orchestra/schema/sucafina/context"

describe("dashboard route admission", () => {
  const topic = matchSfNativeRoutePath("/orchestra/sf-dashboard/hot-topics")!
  test("accepts only the producer period and supported topic status", () => {
    expect(parseDashboardRouteQuery(new URLSearchParams("year=2026&month=2&status=open"), topic)).toEqual({ year: 2026, month: 2, status: "open" })
    for (const query of ["year=2026&year=2027", "year=2023", "month=0", "status=unknown", "server=one", "filter=private"])
      expect(parseDashboardRouteQuery(new URLSearchParams(query), topic)).toBeUndefined()
  })
  test("requires the actual operational read in the original producer family", () => {
    const context = { destinations: [{ capabilityId: "CAP02", canRead: true }],
      availability: [{ family: "domain-read", resource: "CAP02", operations: [
        { operationId: "domain.page.CAP02", state: "ready", operational: true },
      ] }] } as unknown as SfContext
    expect(dashboardRouteAvailable(context, topic)).toBe(true)
    expect(dashboardRouteAvailable({ ...context, availability: [] }, topic)).toBe(false)
    expect(dashboardRouteAvailable({ ...context, availability: [{ ...context.availability[0]!,
      operations: [{ ...context.availability[0]!.operations[0]!, operational: false }] }] }, topic)).toBe(false)
    expect(dashboardRouteAvailable({ ...context, destinations: [] }, topic)).toBe(false)
  })
})
