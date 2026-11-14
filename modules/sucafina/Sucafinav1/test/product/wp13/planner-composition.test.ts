import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { ScenarioRequest } from "../../../product/contracts/operations.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { plannerComponentDigest } from "../../../product/planner/comparison.ts"
import { portfolioCandidateRef } from "../../../product/portfolio/candidates.ts"
import { createProductionPortfolio } from "../../../product/portfolio/production.ts"
import { createWp13SensitivityFixture } from "./sensitivity-fixture.ts"

// These witnesses exercise the production portfolio adapter and real Planner math.
// The installation policy is the explicit fixture policy; native/UI/MCP acceptance is separate.
test("real portfolio composes shared-source operations once and retains omitted or priced training", async () => {
  for (const training of [undefined, 40000] as const) {
    const world = await createWp13SensitivityFixture({ renewal: training === undefined ? {} : { training } })
    try {
      const plannerBefore = await world.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))
      const firstRequest: ScenarioRequest = { ...world.scenario, operations: world.scenario.operations.filter((operation) => ["service:11", "implementation:11"].includes(operation.targetRef)) }
      const secondRequest: ScenarioRequest = { ...world.scenario, operations: world.scenario.operations.filter((operation) => !["service:11", "implementation:11"].includes(operation.targetRef)) }
      const first = await world.planner.simulateScenario(firstRequest, world.context)
      const second = await world.planner.simulateScenario(secondRequest, world.context)
      const combinedRequest = { ...world.scenario, operations: [...firstRequest.operations, ...secondRequest.operations] }
      const combined = await world.planner.simulateScenario(combinedRequest, world.context)
      if (first.status !== "ok" || second.status !== "ok" || combined.status !== "ok") throw new Error("real Planner scenarios unavailable")
      expect(first.value.knownSubtotal).toBe(195000)
      expect(second.value.knownSubtotal).toBe(training === undefined ? 255000 : 295000)
      expect(combined.value.knownSubtotal).toBe(training === undefined ? 210000 : 250000)
      const prior = await world.state.read(world.request, "cases", (state) => state.cases[world.caseRef.id])
      if (prior.status !== "ok" || !prior.value) throw new Error("fixture case unavailable")
      const parts = [{ id: "part-a", scenario: firstRequest, result: first.value }, { id: "part-b", scenario: secondRequest, result: second.value }]
      const seeded = await world.state.transaction(world.request, { namespace: "cases", expectedStorageVersion: prior.storageVersion, idempotencyKey: "seed-portfolio-parts", commandDigest: digestSfValue(parts), targetRef: encodeCaseRef(world.caseRef), targetIncarnation: world.caseRef.incarnation }, async (state) => {
        const decision = state.cases[world.caseRef.id]
        if (!decision) return { commit: false, value: false }
        decision.alternatives = [...decision.alternatives, ...parts.map((part) => ({ ...part, version: 1, title: part.id,
          result: { ...part.result, costCoverage: { ...part.result.costCoverage, alternativeId: part.id, alternativeVersion: 1 } } }))]
        return { commit: true, value: true }
      })
      expect(seeded.status).toBe("ok")
      const candidate = (alternativeId: string) => portfolioCandidateRef({ caseRef: encodeCaseRef(world.caseRef), caseVersion: world.caseRef.version, alternativeId, alternativeVersion: 1 })
      const production = createProductionPortfolio({ cases: world.cases, planner: world.planner, sources: world.sources, evidence: world.evidenceService,
        revalidate: world.host.revalidate, createReceipt: async () => undefined,
        decisions: { prepareChanges: async () => ({ status: "unavailable", reason: "preview-has-no-application-authority" }) },
        persistence: { results: world.results, caseFor: async () => ({ status: "ok", value: world.caseRef }), idempotencyKey: async (digest) => `portfolio-composition:${digest}` },
        enabledOperations: [] })
      const request = { scope: { horizon: world.selectedResult.horizon, currency: "USD" }, candidateRefs: [candidate("part-a"), candidate("part-b")], operations: [], constraints: [], priorities: [], explorationLimit: 3 }
      const preview = await production.preview(request, world.context)
      expect(preview.status).toBe("ok")
      if (preview.status !== "ok") throw new Error(preview.reason)
      const together = preview.value.portfolio.combinations.find((item) => item.caseRefs.length === 2)
      if (!together) throw new Error("combined portfolio alternative missing")
      expect(plannerComponentDigest(together.components)).toBe(plannerComponentDigest(combined.value.components))
      expect(new Set(together.components.map((component) => component.id)).size).toBe(together.components.length)
      expect(together.eligibility).toBe("conditioned")
      expect(together.comparisonStatus).toBe("conditioned")
      if (training === undefined) expect(together.restrictions.some((reason) => reason.includes("training"))).toBe(true)
      else expect(together.components.find((component) => component.id === "training:11")?.amount).toBe(40000)
      expect(preview.value.portfolio.limitations).toContain("Finite exploration; no global optimum is asserted.")
      const conflicting = await production.preview({ ...request, candidateRefs: [candidate("part-a"), candidate("selected")] }, world.context)
      if (conflicting.status !== "ok") throw new Error(conflicting.reason)
      expect(conflicting.value.portfolio.combinations.find((item) => item.caseRefs.length === 2)).toMatchObject({ eligibility: "ineligible", comparisonStatus: "incompatible", components: [] })
      expect(await world.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))).toBe(plannerBefore)
      world.access.allowed = false
      expect((await production.preview(request, world.context)).status).toBe("denied")
    } finally { await world.cleanup() }
  }
}, 120000)
