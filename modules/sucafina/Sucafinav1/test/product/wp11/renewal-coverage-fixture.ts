import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { CostCoverageEntry } from "../../../product/contracts/decisions.ts"
import { assessCostCoverage } from "../../../product/decisions/cost-coverage.ts"
import { classifyCoverage, supportsCoverageClassification } from "../../../product/decisions/coverage-classification.ts"
import { wp05Horizon, type createWp05SensitivityFixture } from "../wp05/engine-fixture.ts"

type Fixture = Awaited<ReturnType<typeof createWp05SensitivityFixture>>

/** Synthetic source declarations classify real Planner components; they supply no computed financial values. */
export async function renewalCoverage(fixture: Fixture, training: "bundled" | "omitted" | "confirmed" | "zero" | "null") {
  const source = fixture.sourceRefs.find((ref) => ref.refId === fixture.scenario.baseRef)
  if (!source) throw new Error("Selected Planner source missing")
  const projection = await fixture.planner.compareForecast({ baseRef: source.refId, candidateRef: source.refId, period: wp05Horizon, currency: "USD" }, fixture.context)
  if (projection.status !== "ok") throw new Error(projection.reason)
  const actual = projection.value.candidate
  const declarations = {
    contract_exit: "The synthetic termination statement confirms no additional exit charge in this scope.",
    internal_costs: "The synthetic inventory explicitly confirms no incremental internal cost in this scope.",
    other_relevant_costs: "The synthetic reviewed inventory identifies no further relevant cost category.",
  }
  const unsigned: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", refId: `scope-${training}`, installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", target: { surface: "planner", recordType: "synthetic-scope", recordId: `scope-${training}`, incarnation: `scope-${training}-v1`, version: 1, fields: Object.keys(declarations), period: wp05Horizon, projectionDigest: digestSfValue(declarations) } }
  const statement = { ...unsigned, refDigest: digestSfEvidenceRef(unsigned) }
  const refs = (line: string) => actual.components.filter((item) => item.id.startsWith(`${line}:`)).map((item) => item.id)
  const included = (categoryId: string, componentRefs: readonly string[], scopeNote: string): CostCoverageEntry => ({ categoryId, status: "included", componentRefs, evidenceRefs: [source], scopeNote })
  const entries: CostCoverageEntry[] = [
    included("service", refs("new-service"), "New service at the final synthetic quote price."),
    included("service_overlap", refs("bridge"), "The bridge is a distinct service contribution."),
    included("implementation", refs("implementation"), training === "bundled" ? "Implementation includes migration and training." : "This separate quote includes migration and explicitly excludes training."),
    included("migration", refs("implementation"), "Migration is already included in the implementation component."),
    included("taxes", actual.components.map((item) => item.id), "All synthetic quotes declare final prices; no tax rate is inferred."),
    ...Object.entries(declarations).map(([categoryId, justification]): CostCoverageEntry => ({ categoryId, status: "not-applicable", justification, evidenceRefs: [statement] })),
    ...(training === "omitted" ? [] : [included("training", refs(training === "bundled" ? "implementation" : "training"), training === "bundled" ? "Training is included in implementation." : "The separate training quote supplies the additional component.")]),
  ]
  const evidence: BusinessEvidenceResolution[] = [...await Promise.all(fixture.sourceRefs.map((ref) => fixture.evidence.resolve(ref, fixture.context))), { state: "fresh", ref: statement, accessRevision: "access", checkedAt: "2026-11-13T00:00:00Z" }]
  const request = { caseRef: fixture.caseRef, source, basis: fixture.basis, entries, expectedVersion: 0 }
  const classification = classifyCoverage(request, actual, 1)
  const supports = (entry: Exclude<CostCoverageEntry, { status: "pending" }>, resolved: readonly BusinessEvidenceResolution[]) => supportsCoverageClassification(classification, entry, resolved) && (entry.status === "included" || Object.entries(declarations).some(([categoryId, text]) => categoryId === entry.categoryId && entry.justification === text))
  const assess = (candidateEntries: readonly CostCoverageEntry[], components: DomainProjection["components"] = actual.components, resolutions = evidence) => assessCostCoverage({ basis: fixture.basis, alternativeId: "selected", alternativeVersion: 1, currency: "USD", horizon: wp05Horizon, entries: candidateEntries, components, evidence: resolutions, supports })
  return { actual, entries, evidence, classification, statement, supports, assess, assessment: assess(entries) }
}
