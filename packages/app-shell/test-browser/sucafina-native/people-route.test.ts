import { describe, expect, test } from "bun:test"
import type { SfContext } from "@orchestra/schema/sucafina/context"
import { matchSfNativeRoutePath } from "../../src/orchestra/chapters/sucafina/route-registry"
import { encodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"
import { parsePeopleRouteQuery, peopleRouteAvailable } from "../../src/orchestra/chapters/sucafina/host/people-route"

describe("people route composition", () => {
  test("validates producer periods and talent status without admitting control keys", () => {
    for (const path of ["overview", "structure", `structure/members/${encodeSfRouteRef("person")}/edit`, "talent", `talent/${encodeSfRouteRef("person")}`]) {
      const candidate = matchSfNativeRoutePath(`/orchestra/sf-people/${path}`)!
      expect(parsePeopleRouteQuery(new URLSearchParams("year=2026&month=2"), candidate)).toEqual({ year: 2026, month: 2 })
      for (const query of ["year=2023", "month=13", "server=x", "project=p&project=q", "returnTo=x"])
        expect(parsePeopleRouteQuery(new URLSearchParams(query), candidate)).toBeUndefined()
    }
    const talent = matchSfNativeRoutePath("/orchestra/sf-people/talent")!
    expect(parsePeopleRouteQuery(new URLSearchParams("status=Active"), talent)).toEqual({ status: "Active" })
    expect(parsePeopleRouteQuery(new URLSearchParams("status=unknown"), talent)).toBeUndefined()
  })
  test("requires the page's original operational read and readable destination", () => {
    for (const [path, id] of [["overview", "CAP06"], ["structure", "CAP07"], ["talent", "CAP08"]]) {
      const candidate = matchSfNativeRoutePath(`/orchestra/sf-people/${path}`)!
      const context = { destinations: [{ capabilityId: id, canRead: true }], availability: [{ family: "domain-read", resource: id, operations: [{ operationId: `domain.page.${id}`, state: "ready", operational: true }] }] } as unknown as SfContext
      expect(peopleRouteAvailable(context, candidate)).toBe(true)
      expect(peopleRouteAvailable({ ...context, destinations: [{ ...context.destinations[0]!, canRead: false }] }, candidate)).toBe(false)
      expect(peopleRouteAvailable({ ...context, availability: [] }, candidate)).toBe(false)
    }
  })
})
