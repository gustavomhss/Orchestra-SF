import { describe, expect, test } from "bun:test"
import type { SfContext } from "@orchestra/schema/sucafina/context"
import { matchSfNativeRoutePath } from "../../src/orchestra/chapters/sucafina/route-registry"
import { encodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"
import { decisionPagesRouteAvailable, parseDecisionPagesRouteQuery } from "../../src/orchestra/chapters/sucafina/host/decisions-pages-route"
import { sourceDestinations } from "../../test/sucafina-native/source-context-fixture"

describe("decision page routing", () => {
  test("retains canonical case and detail selectors and rejects controls", () => {
    expect(matchSfNativeRoutePath("/orchestra/sf-decisions/new")).toMatchObject({ surfaceId: "UI33", kind: "new" })
    const root = `/orchestra/sf-decisions/${encodeSfRouteRef("case")}`
    for (const path of ["alternatives", "assumptions", "questions", "choice", "changes", "history", "analyses"]) {
      const candidate = matchSfNativeRoutePath(`${root}/${path}`)!
      expect(parseDecisionPagesRouteQuery(new URLSearchParams(), candidate)).toEqual({})
      for (const query of ["server=s", "server=s&server=t&project=p&installation=i", "returnTo=x", "filter=private"])
        expect(parseDecisionPagesRouteQuery(new URLSearchParams(query), candidate)).toBeUndefined()
    }
    expect(matchSfNativeRoutePath(`${root}/alternatives/${encodeSfRouteRef("alternative")}`)).toMatchObject({ surfaceId: "UI35", kind: "detail", parameters: { caseRef: "case", alternativeRef: "alternative" } })
  })
  test("case projection admission uses the actual CAP-only destination catalog", () => {
    const candidate = matchSfNativeRoutePath(`/orchestra/sf-decisions/${encodeSfRouteRef("case")}/assumptions`)!
    const context = { destinations: sourceDestinations, availability: [{ family: "decisions", resource: "case-intent", operations: [{ operationId: "projection.case", state: "ready", operational: true }] }] } as unknown as SfContext
    expect(decisionPagesRouteAvailable(context, candidate)).toBe(true)
    expect(decisionPagesRouteAvailable({ ...context, availability: [{ ...context.availability[0]!, operations: [{ ...context.availability[0]!.operations[0]!, operational: false }] }] }, candidate)).toBe(false)
    expect(decisionPagesRouteAvailable({ ...context, availability: [] }, candidate)).toBe(false)
  })
})
