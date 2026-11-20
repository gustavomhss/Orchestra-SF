import { describe, expect, test } from "bun:test"
import type { SfContext } from "@orchestra/schema/sucafina/context"
import { matchSfNativeRoutePath } from "../../src/orchestra/chapters/sucafina/route-registry"
import { encodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"
import { operationsRouteAvailable, parseOperationsRouteQuery } from "../../src/orchestra/chapters/sucafina/host/operations-route"

describe("operations route composition", () => {
  test("validates selectors consumed by the original page", () => {
    for (const path of ["service", "security"]) {
      const candidate = matchSfNativeRoutePath(`/orchestra/sf-operations/${path}`)!
      expect(parseOperationsRouteQuery(new URLSearchParams("year=2026&month=2"), candidate)).toEqual({ year: 2026, month: 2 })
      for (const query of ["year=2023", "month=13", "year=2026&year=2027", "server=s", "returnTo=x"])
        expect(parseOperationsRouteQuery(new URLSearchParams(query), candidate)).toBeUndefined()
    }
    const risk = matchSfNativeRoutePath(`/orchestra/sf-operations/risks/${encodeSfRouteRef("risk")}/edit`)!
    expect(parseOperationsRouteQuery(new URLSearchParams("status=open"), risk)).toEqual({ status: "open" })
    expect(parseOperationsRouteQuery(new URLSearchParams("filter=private"), risk)).toBeUndefined()
    expect(parseOperationsRouteQuery(new URLSearchParams("year=2026&month=11&status=open"), risk)).toEqual({ year: 2026, month: 11, status: "open" })
    for (const query of ["year=2023", "year=2028", "month=13", "month=1&month=2", "signalPriority=risks:x"])
      expect(parseOperationsRouteQuery(new URLSearchParams(query), risk)).toBeUndefined()
    expect(parseOperationsRouteQuery(new URLSearchParams("year=2026"),
      matchSfNativeRoutePath("/orchestra/sf-operations/stakeholders")!)).toBeUndefined()
  })
  test("requires readable destination and operational original read", () => {
    for (const [path, id] of [["service", "CAP11"], ["security", "CAP12"], ["risks", "CAP13"], ["stakeholders", "CAP15"], ["performance", "CAP16"]]) {
      const candidate = matchSfNativeRoutePath(`/orchestra/sf-operations/${path}`)!
      const context = { destinations: [{ capabilityId: id, canRead: true }], availability: [{ family: "domain-read", resource: id, operations: [{ operationId: `domain.page.${id}`, state: "ready", operational: true }] }] } as unknown as SfContext
      expect(operationsRouteAvailable(context, candidate)).toBe(true)
      expect(operationsRouteAvailable({ ...context, destinations: [{ ...context.destinations[0]!, canRead: false }] }, candidate)).toBe(false)
      expect(operationsRouteAvailable({ ...context, availability: [] }, candidate)).toBe(false)
    }
  })
})
