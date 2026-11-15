import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import type { PlannerSourceHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createPlannerPort } from "../../../product/planner/port.ts"
import { createWp05ComparisonFixture, wp05Horizon } from "../wp05/engine-fixture.ts"
import { renewalCoverage } from "../wp11/renewal-coverage-fixture.ts"

/** Reuse the published synthetic quotes and scope declarations. Planner, SQLite,
 * C08, classification and the criterion registry are real implementations; the
 * fixture's grants and N/A statements are not installed human authorization.
 * The comparison fixture avoids an unrelated persisted sensitivity bootstrap.
 */
export async function numericCoverageFixture(training: "bundled" | "omitted" | "confirmed" | "zero" | "null") {
  const fixture = await createWp05ComparisonFixture({ mode: "renewal-usd", training })
  try {
    const coverage = await renewalCoverage(fixture, training)
    const source = fixture.sourceRefs.find((ref) => ref.refId === fixture.scenario.baseRef)
    if (!source) throw new Error("Selected numeric quote source unavailable")
    const resolveEvidence = async (refs: readonly BusinessEvidenceRef[], call: TrustedDomainContext = fixture.context): Promise<readonly BusinessEvidenceResolution[]> => Promise.all(refs.map(async (ref): Promise<BusinessEvidenceResolution> => {
      if (digestSfValue(ref) === digestSfValue(coverage.statement)) {
        const permitted = await fixture.host.revalidate(call) && (await Promise.all(fixture.basis.sourceRefs.map((item) => fixture.evidence.resolve(item, call)))).every((item) => item.state === "fresh")
        return { state: permitted ? "fresh" : "revoked", ref, accessRevision: call.binding.accessRevision, checkedAt: "2026-11-13T00:00:00Z" }
      }
      const resolved = await fixture.evidence.resolve(ref, call)
      if (resolved.state !== "fresh" || ref.kind !== "record" || ref.target.recordType !== "planner-version") return resolved
      // The original fixture grants the exact source identity. Re-read the
      // actual Planner projection as well, so changed quote bytes are stale.
      const current = await fixture.planner.compareForecast({ baseRef: ref.refId, candidateRef: ref.refId, period: wp05Horizon, currency: "USD" }, call)
      if (current.status === "ok") return resolved
      return { ...resolved, state: current.status === "stale" ? "stale" : "unavailable" }
    }))
    const sources: PlannerSourceHost = {
      ...fixture.sources,
      resolveForecastCoverage: async (reference, call) => {
        if (reference !== source.refId) return fixture.sources.resolveForecastCoverage(reference, call)
        if (!await fixture.host.revalidate(call)) return { status: "denied", reason: "numeric-coverage-authority-unavailable" }
        const evidence = await resolveEvidence([...fixture.basis.sourceRefs, coverage.statement], call)
        if (evidence.some((item) => item.state !== "fresh")) return { status: "stale", reason: "numeric-coverage-source-changed" }
        return { status: "ok", value: { coverageRef: `numeric-coverage:${source.refId}`, basis: fixture.basis,
          assessment: coverage.assess(coverage.entries, coverage.actual.components, [...evidence]) } }
      },
    }
    const planner = createPlannerPort({ host: fixture.host, sources })
    const observed = await planner.simulateScenario({ baseRef: source.refId, operations: [], assumptions: [] }, fixture.context)
    if (observed.status !== "ok") throw new Error(`Canonical source scenario unavailable: ${observed.reason}`)
    return { fixture, coverage, source, planner, scenario: observed.value, resolveEvidence }
  } catch (error) {
    await fixture.cleanup()
    throw error
  }
}
