import { describe, expect, test } from "bun:test"
import type { SfContext } from "@orchestra/schema/sucafina/context"
import { matchSfNativeRoutePath } from "../../src/orchestra/chapters/sucafina/route-registry"
import { encodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"
import { parsePlannerPagesRouteQuery, plannerPagesRouteAvailable } from "../../src/orchestra/chapters/sucafina/host/planner-pages-route"

describe("planner native pages", () => {
  test("uses real routes and a closed, source-validated period", () => {
    for (const path of ["opex", `opex/lines/${encodeSfRouteRef("line")}`, "capex", `capex/projects/${encodeSfRouteRef("project")}`, "headcount", "allocations", `allocations/entities/${encodeSfRouteRef("entity")}`, "fx"]) {
      const candidate = matchSfNativeRoutePath(`/orchestra/sf-planner/${path}`)!
      expect(parsePlannerPagesRouteQuery(new URLSearchParams("year=2026"), candidate)).toEqual({ year: 2026 })
      for (const query of ["year=2023", "year=2026&year=2026", "server=a", "filter=private", "returnTo=x"])
        expect(parsePlannerPagesRouteQuery(new URLSearchParams(query), candidate)).toBeUndefined()
    }
  })
  test("requires both the original readable destination and operational producer", () => {
    for (const [path, id] of [["opex", "CAP18"], ["capex", "CAP19"], ["headcount", "CAP20"], ["allocations", "CAP21"], ["fx", "CAP22"]]) {
      const candidate = matchSfNativeRoutePath(`/orchestra/sf-planner/${path}`)!
      const context = { destinations: [{ capabilityId: id, canRead: true }], availability: [{ family: "planner", resource: id, operations: [{ operationId: `domain.page.${id}`, state: "ready", operational: true }] }] } as unknown as SfContext
      expect(plannerPagesRouteAvailable(context, candidate)).toBe(true)
      expect(plannerPagesRouteAvailable({ ...context, destinations: [{ ...context.destinations[0]!, canRead: false }] }, candidate)).toBe(false)
      expect(plannerPagesRouteAvailable({ ...context, availability: [] }, candidate)).toBe(false)
    }
  })
})
