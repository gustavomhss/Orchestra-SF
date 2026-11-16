import { describe, expect, test } from "bun:test"
import type { SfContext } from "@orchestra/schema/sucafina/context"
import { matchSfNativeRoutePath } from "../../src/orchestra/chapters/sucafina/route-registry"
import { homePagesRouteAvailable, parseHomePagesRouteQuery } from "../../src/orchestra/chapters/sucafina/host/home-pages-route"

describe("home context, search and administration", () => {
  test("permits only owner selectors", () => {
    for (const path of ["search", "context", "administration"]) {
      const candidate = matchSfNativeRoutePath(`/orchestra/sf-home/${path}`)!
      expect(parseHomePagesRouteQuery(new URLSearchParams(), candidate)).toEqual({})
      for (const query of ["server=s", "server=s&server=t&project=p&installation=i", "q=private", "returnTo=x"])
        expect(parseHomePagesRouteQuery(new URLSearchParams(query), candidate)).toBeUndefined()
    }
  })
  test("requires readable destination and original search operation", () => {
    const candidate = matchSfNativeRoutePath("/orchestra/sf-home/search")!
    const context = { destinations: [{ capabilityId: "UI31", canRead: true }], availability: [{ family: "domain-read", resource: "search", operations: [{ operationId: "projection.search", state: "ready", operational: true }] }] } as unknown as SfContext
    expect(homePagesRouteAvailable(context, candidate)).toBe(true)
    expect(homePagesRouteAvailable({ ...context, destinations: [{ ...context.destinations[0]!, canRead: false }] }, candidate)).toBe(false)
    expect(homePagesRouteAvailable({ ...context, availability: [] }, candidate)).toBe(false)
  })
})
