import { describe, expect, test } from "bun:test"
import type { SfContext } from "@orchestra/schema/sucafina/context"
import { encodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"
import { matchSfNativeRoutePath } from "../../src/orchestra/chapters/sucafina/route-registry"
import { memoryRouteAvailable, parseMemoryRouteQuery } from "../../src/orchestra/chapters/sucafina/host/memory-route"

describe("memory route admission", () => {
  test("preserves an opaque outcome selector without deriving authority", () => {
    const route = matchSfNativeRoutePath(`/orchestra/sf-memory/outcomes/${encodeSfRouteRef("opaque/selection")}`)!
    expect(route).toMatchObject({ surfaceId: "UI63", parameters: { selectionRef: "opaque/selection" } })
    expect(parseMemoryRouteQuery(new URLSearchParams(), route)).toEqual({})
    for (const query of ["server=s", "server=s&server=t&project=p&installation=i", "case=guessed", "returnTo=x"])
      expect(parseMemoryRouteQuery(new URLSearchParams(query), route)).toBeUndefined()
    const context = { destinations: [{ capabilityId: "UI63", canRead: true }], availability: [{ family: "intelligence", resource: "outcomes", operations: [
      { operationId: "intelligence.memory-catalog", state: "ready", operational: true },
      { operationId: "intelligence.memory-outcome", state: "ready", operational: true },
    ] }] } as unknown as SfContext
    expect(memoryRouteAvailable(context, route)).toBe(true)
    expect(memoryRouteAvailable({ ...context, availability: [{ ...context.availability[0]!, operations: [context.availability[0]!.operations[0]!] }] }, route)).toBe(false)
    expect(memoryRouteAvailable({ ...context, destinations: [{ ...context.destinations[0]!, canRead: false }] }, route)).toBe(false)
  })
})
