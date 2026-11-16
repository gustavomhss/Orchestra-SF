import { describe, expect, test } from "bun:test"
import type { SfContext } from "@orchestra/schema/sucafina/context"
import { matchSfNativeRoutePath } from "../../src/orchestra/chapters/sucafina/route-registry"
import { encodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"
import { decisionPagesRouteAvailable, parseDecisionPagesRouteQuery } from "../../src/orchestra/chapters/sucafina/host/decisions-pages-route"

describe("decision page routing", () => {
  test("retains canonical case and detail selectors and rejects controls", () => {
    const root = `/orchestra/sf-decisions/${encodeSfRouteRef("case")}`
    for (const path of ["alternatives", "assumptions", "questions", "choice", "changes", "history", "analyses"]) {
      const candidate = matchSfNativeRoutePath(`${root}/${path}`)!
      expect(parseDecisionPagesRouteQuery(new URLSearchParams(), candidate)).toEqual({})
      for (const query of ["server=s", "server=s&server=t&project=p&installation=i", "returnTo=x", "filter=private"])
        expect(parseDecisionPagesRouteQuery(new URLSearchParams(query), candidate)).toBeUndefined()
    }
    expect(matchSfNativeRoutePath(`${root}/alternatives/${encodeSfRouteRef("alternative")}`)).toMatchObject({ surfaceId: "UI35", kind: "detail", parameters: { caseRef: "case", alternativeRef: "alternative" } })
  })
  test("case projection admission requires a readable destination", () => {
    const candidate = matchSfNativeRoutePath(`/orchestra/sf-decisions/${encodeSfRouteRef("case")}/assumptions`)!
    const context = { destinations: [{ capabilityId: "UI36", canRead: true }], availability: [{ family: "decisions", resource: "case-intent", operations: [{ operationId: "projection.case", state: "ready", operational: true }] }] } as unknown as SfContext
    expect(decisionPagesRouteAvailable(context, candidate)).toBe(true)
    expect(decisionPagesRouteAvailable({ ...context, destinations: [{ ...context.destinations[0]!, canRead: false }] }, candidate)).toBe(false)
    expect(decisionPagesRouteAvailable({ ...context, availability: [] }, candidate)).toBe(false)
  })
})
