import { describe, expect, test } from "bun:test"
import type { SfContext } from "@orchestra/schema/sucafina/context"
import { encodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"
import { matchSfNativeRoutePath } from "../../src/orchestra/chapters/sucafina/route-registry"
import { parseRoutinesRouteQuery, routinesRouteAvailable } from "../../src/orchestra/chapters/sucafina/host/routines-route"
import { sourceDestinations } from "../../test/sucafina-native/source-context-fixture"

describe("routine routes", () => {
  test("keeps original refs and validates case selector syntax", () => {
    const candidate = matchSfNativeRoutePath(`/orchestra/sf-routines/runs/${encodeSfRouteRef("run")}`)!
    expect(candidate).toMatchObject({ surfaceId: "UI65", parameters: { runRef: "run" } })
    expect(parseRoutinesRouteQuery(new URLSearchParams("case=original"), candidate)).toEqual({ case: "original" })
    for (const query of ["case=", "case=x&case=y", "server=s", "returnTo=x"])
      expect(parseRoutinesRouteQuery(new URLSearchParams(query), candidate)).toBeUndefined()
  })
  test("requires the exact operational source with CAP-only destinations", () => {
    const candidate = matchSfNativeRoutePath(`/orchestra/sf-routines/runs/${encodeSfRouteRef("run")}`)!
    const context = { destinations: sourceDestinations, availability: [{ family: "intelligence", resource: "routine-runs", operations: [{ operationId: "projection.routine", state: "ready", operational: true }] }] } as unknown as SfContext
    expect(routinesRouteAvailable(context, candidate)).toBe(true)
    expect(routinesRouteAvailable({ ...context, availability: [] }, candidate)).toBe(false)
    expect(routinesRouteAvailable({ ...context, availability: [{ ...context.availability[0]!, operations: [{ ...context.availability[0]!.operations[0]!, operational: false }] }] }, candidate)).toBe(false)
  })
})
