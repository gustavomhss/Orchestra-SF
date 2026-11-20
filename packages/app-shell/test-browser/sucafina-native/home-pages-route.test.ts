import { describe, expect, test } from "bun:test"
import type { SfContext, SfRef, SfServerKey } from "@orchestra/schema/sucafina/context"
import { matchSfNativeRoutePath } from "../../src/orchestra/chapters/sucafina/route-registry"
import { homeContextStatusRoute, homePagesRouteAvailable, parseHomePagesRouteQuery } from "../../src/orchestra/chapters/sucafina/host/home-pages-route"
import { sourceDestinations } from "../../test/sucafina-native/source-context-fixture"

describe("home context, search and administration", () => {
  test("permits only owner selectors", () => {
    for (const path of ["search", "context", "administration"]) {
      const candidate = matchSfNativeRoutePath(`/orchestra/sf-home/${path}`)!
      expect(parseHomePagesRouteQuery(new URLSearchParams(), candidate)).toEqual({})
      for (const query of ["server=s", "server=s&server=t&project=p&installation=i", "q=private", "returnTo=x"])
        expect(parseHomePagesRouteQuery(new URLSearchParams(query), candidate)).toBeUndefined()
    }
  })
  test("requires the original search operation with CAP-only destinations", () => {
    const candidate = matchSfNativeRoutePath("/orchestra/sf-home/search")!
    const context = { destinations: sourceDestinations, availability: [{ family: "domain-read", resource: "search", operations: [{ operationId: "projection.search", state: "ready", operational: true }] }] } as unknown as SfContext
    expect(homePagesRouteAvailable(context, candidate)).toBe(true)
    expect(homePagesRouteAvailable({ ...context, availability: [{ ...context.availability[0]!, operations: [{ ...context.availability[0]!.operations[0]!, operational: false }] }] }, candidate)).toBe(false)
    expect(homePagesRouteAvailable({ ...context, availability: [] }, candidate)).toBe(false)
  })
  test("administration admits only an actually operational local summary reader", () => {
    const candidate = matchSfNativeRoutePath("/orchestra/sf-home/administration")!
    const context = { destinations: sourceDestinations, availability: [{ family: "domain-read", resource: "local-admin", state: "partial", operations: [
      { operationId: "projection.local-admin", state: "unavailable", operational: false, reason: "local-operator-reader-not-bound" },
      { operationId: "local-admin.summary-read", state: "ready", operational: true, reason: null },
    ] }] } as unknown as SfContext
    expect(homePagesRouteAvailable(context, candidate)).toBe(true)
    expect(homePagesRouteAvailable({ ...context, availability: [] }, candidate)).toBe(false)
    expect(homePagesRouteAvailable({ ...context, availability: [{ ...context.availability[0]!, operations: [
      { operationId: "local-admin.summary-configure", state: "ready", operational: true, reason: null },
    ] }] }, candidate)).toBe(false)
    expect(homePagesRouteAvailable({ ...context, availability: [{ ...context.availability[0]!, operations: [
      { operationId: "local-admin.summary-read", state: "unavailable", operational: false, reason: "source-unavailable" },
    ] }] }, candidate)).toBe(false)
  })
  test("pre-login context status never borrows a mismatched or partial owner", () => {
    const selected = { serverKey: "s" as SfServerKey, projectId: "p" as SfRef, installationId: "i" as SfRef }
    expect(homeContextStatusRoute("/orchestra/sf-home/context", "", selected)?.surfaceId).toBe("UI67")
    expect(homeContextStatusRoute("/orchestra/sf-home/context", "?server=s&project=p&installation=i", selected)?.ownerSelection).toEqual(selected)
    expect(homeContextStatusRoute("/orchestra/sf-home/context", "?server=s", selected)).toBeUndefined()
    expect(homeContextStatusRoute("/orchestra/sf-home/context", "?server=s&project=other&installation=i", selected)).toBeUndefined()
    expect(homeContextStatusRoute("/orchestra/sf-home/context", "?q=private", selected)).toBeUndefined()
  })
})
