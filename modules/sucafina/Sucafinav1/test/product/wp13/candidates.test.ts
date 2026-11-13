import { expect, test } from "bun:test"
import { createDecisionCandidateResolver, portfolioCandidateRef } from "../../../product/portfolio/candidates.ts"
import type { DecisionCasePort } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const context = {} as TrustedDomainContext
const scenario = { baseRef: "base", operations: [{ kind: "replace" as const, targetRef: "line:1", amount: 50 }], assumptions: [] }
const ref = portfolioCandidateRef({ caseRef: "case:a:incarnation", caseVersion: 2, alternativeId: "alternative", alternativeVersion: 3 })

test("resolves only the authorized case and versioned alternative", async () => {
  const cases = { read: async () => ({ status: "ok", value: { case: { version: 2, alternatives: [{ id: "alternative", version: 3, scenario }] } } }) } as unknown as DecisionCasePort
  const resolve = createDecisionCandidateResolver(cases)
  const result = await resolve(ref, context)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.value.scenario).toEqual(scenario)
  expect(await resolve(portfolioCandidateRef({ caseRef: "case:a:incarnation", caseVersion: 1, alternativeId: "alternative", alternativeVersion: 3 }), context)).toEqual({ status: "stale", reason: "case-changed" })
})

test("propagates denial without revealing an alternative", async () => {
  const cases = { read: async () => ({ status: "denied", reason: "case-access-unavailable" }) } as unknown as DecisionCasePort
  expect(await createDecisionCandidateResolver(cases)(ref, context)).toEqual({ status: "denied", reason: "case-access-unavailable" })
})
