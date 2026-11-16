import { describe, expect, test } from "bun:test"
import type { SfContext } from "@orchestra/schema/sucafina/context"
import { matchSfNativeRoutePath } from "../../src/orchestra/chapters/sucafina/route-registry"
import { encodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"
import { parsePortfolioRouteQuery, portfolioRouteAvailable } from "../../src/orchestra/chapters/sucafina/host/portfolio-route"

describe("portfolio route composition", () => {
  test("validates real route refs and bounded producer selectors", () => {
    const overview = matchSfNativeRoutePath("/orchestra/sf-portfolio/overview")!
    expect(parsePortfolioRouteQuery(new URLSearchParams("year=2026&filter=watch"), overview)).toEqual({ year: 2026, filter: "watch" })
    for (const query of ["year=2023", "year=2026&year=2027", "filter=private", "server=s", "returnTo=x"])
      expect(parsePortfolioRouteQuery(new URLSearchParams(query), overview)).toBeUndefined()
    const scenario = matchSfNativeRoutePath(`/orchestra/sf-portfolio/scenarios/${encodeSfRouteRef("case")}/results/${encodeSfRouteRef("result")}`)!
    expect(scenario).toMatchObject({ surfaceId: "UI43", parameters: { caseRef: "case", resultRef: "result" } })
    expect(parsePortfolioRouteQuery(new URLSearchParams(), scenario)).toEqual({})
  })
  test("source operations and readable destination are both necessary", () => {
    const candidate = matchSfNativeRoutePath("/orchestra/sf-portfolio/projects")!
    const context = { destinations: [{ capabilityId: "CAP10", canRead: true }], availability: [{ family: "domain-read", resource: "CAP10", operations: [{ operationId: "domain.page.CAP10", state: "ready", operational: true }] }] } as unknown as SfContext
    expect(portfolioRouteAvailable(context, candidate)).toBe(true)
    expect(portfolioRouteAvailable({ ...context, destinations: [{ ...context.destinations[0]!, canRead: false }] }, candidate)).toBe(false)
    expect(portfolioRouteAvailable({ ...context, availability: [] }, candidate)).toBe(false)
  })
})
