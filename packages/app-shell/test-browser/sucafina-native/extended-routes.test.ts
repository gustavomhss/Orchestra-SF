import { describe, expect, test } from "bun:test"
import type { SfContext } from "@orchestra/schema/sucafina/context"
import { matchSfNativeRoutePath } from "../../src/orchestra/chapters/sucafina/route-registry"
import { isExtendedSurface, parseExtendedRouteQuery, extendedRouteAvailable } from "../../src/orchestra/chapters/sucafina/host/extended-routes"

describe("family dispatch admission", () => {
  test("routes recognized families to their own parsers, not generic grants", () => {
    const candidate = matchSfNativeRoutePath("/orchestra/sf-people/overview")!
    expect(isExtendedSurface(candidate.surfaceId)).toBe(true)
    expect(parseExtendedRouteQuery(new URLSearchParams("year=2026"), candidate)).toEqual({ year: 2026 })
    expect(parseExtendedRouteQuery(new URLSearchParams("year=2026&year=2027"), candidate)).toBeUndefined()
    const context = { destinations: [{ capabilityId: "CAP06", canRead: true }], availability: [{ family: "domain-read", resource: "CAP06", operations: [{ operationId: "domain.page.CAP06", state: "ready", operational: true }] }] } as unknown as SfContext
    expect(extendedRouteAvailable(context, candidate)).toBe(true)
    expect(extendedRouteAvailable({ ...context, destinations: [] }, candidate)).toBe(false)
    expect(extendedRouteAvailable({ ...context, availability: [] }, candidate)).toBe(false)
    expect(isExtendedSurface("UI29")).toBe(false)
  })
})
