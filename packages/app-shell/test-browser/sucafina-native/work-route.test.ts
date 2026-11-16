import { describe, expect, test } from "bun:test"
import type { SfContext } from "@orchestra/schema/sucafina/context"
import { encodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"
import { matchSfNativeRoutePath } from "../../src/orchestra/chapters/sucafina/route-registry"
import { parseWorkRouteQuery, workRouteAvailable } from "../../src/orchestra/chapters/sucafina/host/work-route"

describe("work route composition", () => {
  test("recognizes exact selectors without route controls", () => {
    const thread = matchSfNativeRoutePath(`/orchestra/sf-work/threads/${encodeSfRouteRef("thread")}`)!
    expect(parseWorkRouteQuery(new URLSearchParams(), thread)).toEqual({})
    for (const query of ["server=s", "server=s&server=t&project=p&installation=i", "returnTo=x", "source=x"])
      expect(parseWorkRouteQuery(new URLSearchParams(query), thread)).toBeUndefined()
    const relation = matchSfNativeRoutePath("/orchestra/sf-work/relations/new")!
    expect(parseWorkRouteQuery(new URLSearchParams("source=record"), relation)).toEqual({ source: "record" })
    expect(parseWorkRouteQuery(new URLSearchParams("source="), relation)).toBeUndefined()
  })
  test("detail selectors require their original read operations", () => {
    for (const [path, surface, id] of [[`relations/${encodeSfRouteRef("relation")}`, "UI51", "collaboration.relation-read"], [`confirmations/${encodeSfRouteRef("selection")}`, "UI53", "collaboration.confirmation-project"]]) {
      const candidate = matchSfNativeRoutePath(`/orchestra/sf-work/${path}`)!
      const context = { destinations: [{ capabilityId: surface, canRead: true }], availability: [{ family: "domain-read", resource: "relations", operations: [{ operationId: id, state: "ready", operational: true }] }] } as unknown as SfContext
      expect(parseWorkRouteQuery(new URLSearchParams(), candidate)).toEqual({})
      expect(workRouteAvailable(context, candidate)).toBe(true)
      expect(workRouteAvailable({ ...context, availability: [] }, candidate)).toBe(false)
      expect(workRouteAvailable({ ...context, destinations: [{ ...context.destinations[0]!, canRead: false }] }, candidate)).toBe(false)
    }
  })
  test("requires the original operation and readable destination", () => {
    const candidate = matchSfNativeRoutePath(`/orchestra/sf-work/threads/${encodeSfRouteRef("thread")}`)!
    const context = { destinations: [{ capabilityId: "UI52", canRead: true }], availability: [{ family: "domain-read", resource: "threads", operations: [{ operationId: "collaboration.thread-read", state: "ready", operational: true }] }] } as unknown as SfContext
    expect(workRouteAvailable(context, candidate)).toBe(true)
    expect(workRouteAvailable({ ...context, destinations: [{ ...context.destinations[0]!, canRead: false }] }, candidate)).toBe(false)
    expect(workRouteAvailable({ ...context, availability: [] }, candidate)).toBe(false)
  })
})
