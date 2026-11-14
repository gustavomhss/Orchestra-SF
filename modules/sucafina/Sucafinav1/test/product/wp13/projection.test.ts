import { expect, test } from "bun:test"
import { createStoredPortfolioProjection } from "../../../product/portfolio/projection.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", accessRevision: "access", policyVersion: "policy" }, lease: {} } as unknown as TrustedDomainContext
const projection: DomainProjection = { context: { installationId: "install", projectId: "project", principalRef: "principal", accessRevision: "access", policyVersion: "policy", surface: "planner", period: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", sourceRefs: [], capabilities: [] }, version: 1, engineVersion: "planner-v1", components: [], values: [], missing: [] }
const persisted = { portfolioResultRef: "actual-output-id", portfolio: { combinations: [], limitations: ["finite"], evidenceRefs: [] }, caseRef: { id: "case", incarnation: "inc", version: 1 } }

test("projection carries the stored reference and fails closed on egress revocation", async () => {
  const allowed = { current: true }
  const read = createStoredPortfolioProjection({ readPortfolio: async () => ({ status: "ok", value: persisted }), readProjection: async () => ({ status: "ok", value: projection }), revalidateProjection: async () => allowed.current })
  const result = await read({ selectionRef: "selection", portfolioResultRef: persisted.portfolioResultRef }, context)
  expect(result.status).toBe("ok")
  if (result.status === "ok") expect(result.value.decision).toEqual({ kind: "portfolio", portfolioResultRef: persisted.portfolioResultRef, portfolio: persisted.portfolio })
  allowed.current = false
  expect(await read({ selectionRef: "selection", portfolioResultRef: persisted.portfolioResultRef }, context)).toEqual({ status: "stale", reason: "projection-changed" })
})

test("projection refuses a different authenticated principal", async () => {
  const read = createStoredPortfolioProjection({ readPortfolio: async () => ({ status: "ok", value: persisted }), readProjection: async () => ({ status: "ok", value: { ...projection, context: { ...projection.context, principalRef: "other" } } }), revalidateProjection: async () => true })
  expect(await read({ selectionRef: "selection", portfolioResultRef: persisted.portfolioResultRef }, context)).toEqual({ status: "denied", reason: "projection-scope-mismatch" })
})

test("projection lists a legacy combination without canonical analysis", async () => {
  const legacy = { ...persisted, portfolio: { ...persisted.portfolio, combinations: [{ id: "combination", caseRefs: [], components: [], costCoverageRefs: [], conflicts: [], restrictions: [], eligibility: "conditioned" as const, comparisonStatus: "conditioned" as const }] } }
  const read = createStoredPortfolioProjection({ readPortfolio: async () => ({ status: "ok", value: legacy }), readProjection: async () => ({ status: "ok", value: projection }), revalidateProjection: async () => true })
  const result = await read({ selectionRef: "selection", portfolioResultRef: legacy.portfolioResultRef }, context)
  expect(result.status).toBe("ok")
  if (result.status === "ok") expect(result.value.missing).toContainEqual({ field: "portfolio:combination:analysis", reason: "unavailable" })
})
