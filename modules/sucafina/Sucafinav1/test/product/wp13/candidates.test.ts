import { expect, test } from "bun:test"
import { createDecisionCandidateResolver, portfolioCandidateRef } from "../../../product/portfolio/candidates.ts"
import { createPortfolioCatalog } from "../../../product/portfolio/catalog.ts"
import type { DecisionCasePort } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const context = {} as TrustedDomainContext
const scenario = { baseRef: "base", operations: [{ kind: "replace" as const, targetRef: "line:1", amount: 50 }], assumptions: [] }
const ref = portfolioCandidateRef({ caseRef: "case:a:incarnation", caseVersion: 2, alternativeId: "alternative", alternativeVersion: 3 })

test("resolves only the authorized case and versioned alternative", async () => {
  const cases = { read: async () => ({ status: "ok", value: { case: { id: "a", incarnation: "incarnation", version: 2, alternatives: [{ id: "alternative", version: 3, scenario }] } } }) } as unknown as DecisionCasePort
  const resolve = createDecisionCandidateResolver(cases)
  const result = await resolve(ref, context)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.value.scenario).toEqual(scenario)
  expect(await resolve(portfolioCandidateRef({ caseRef: "case:a:incarnation", caseVersion: 1, alternativeId: "alternative", alternativeVersion: 3 }), context)).toEqual({ status: "stale", reason: "case-changed" })
})

test("rejects a case read that returns another incarnation", async () => {
  const cases = { read: async () => ({ status: "ok", value: { case: { id: "a", incarnation: "replaced", version: 2, alternatives: [{ id: "alternative", version: 3, scenario }] } } }) } as unknown as DecisionCasePort
  expect(await createDecisionCandidateResolver(cases)(ref, context)).toEqual({ status: "stale", reason: "case-changed" })
})

test("propagates denial without revealing an alternative", async () => {
  const cases = { read: async () => ({ status: "denied", reason: "case-access-unavailable" }) } as unknown as DecisionCasePort
  expect(await createDecisionCandidateResolver(cases)(ref, context)).toEqual({ status: "denied", reason: "case-access-unavailable" })
})

test("catalog detects a changed case when the provider reuses its original object", async () => {
  const projection = { case: { id: "a", incarnation: "incarnation", version: 2, objective: "Review", horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", criteria: [], alternatives: [] } }
  let reads = 0
  const cases = { read: async () => {
    if (++reads > 1) projection.case.version = 3
    return { status: "ok", value: projection }
  } } as unknown as DecisionCasePort
  const catalog = createPortfolioCatalog({ cases, revalidate: async () => true, validateSources: async () => true })
  expect(await catalog({ caseRefs: ["case:a:incarnation"] }, context)).toEqual({ status: "stale", reason: "portfolio-catalog-changed" })
})

test("catalog pins the admitted selection and protects it from source-validator mutation", async () => {
  const projection = { case: { id: "a", incarnation: "incarnation", version: 2, objective: "Review", horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", criteria: [], alternatives: [] } }
  const request = { caseRefs: ["case:a:incarnation"] }
  const observed: string[] = []
  const cases = { read: async ({ caseRef }: { caseRef: string }) => { observed.push(caseRef); return { status: "ok", value: projection } } } as unknown as DecisionCasePort
  const catalog = createPortfolioCatalog({ cases, revalidate: async () => true, validateSources: async (borrowed) => { request.caseRefs[0] = "case:other:incarnation"; borrowed.case.objective = "Mutated"; return true } })
  const result = await catalog(request, context)
  expect(result.status).toBe("ok")
  expect(observed).toEqual(["case:a:incarnation", "case:a:incarnation"])
  if (result.status === "ok") expect(result.value.cases[0]?.objective).toBe("Review")
})
