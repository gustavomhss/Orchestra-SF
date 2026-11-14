import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { CostCoverageAssessment, CostCoverageBasis } from "../../../product/contracts/decisions.ts"
import type { PlannerSourceHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { domain } from "../../../runtime/planner.ts"
import { wp05Horizon, type createWp05SensitivityFixture } from "./engine-fixture.ts"

type Fixture = Awaited<ReturnType<typeof createWp05SensitivityFixture>>
type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>
const now = () => "2026-11-13T01:00:00Z"

/** A later synthetic quote enters a copied real Planner version; the earlier source remains immutable.
 * Source references are a digest/current-source harness, not an installed scoped issuer or native proof.
 */
export async function createWp05TrainingRevision(fixture: Fixture) {
  if (fixture.scenario.baseRef !== "transition-omitted") throw new Error("Training revision requires the omitted-category source")
  const versionId = "transition-confirmed"
  const reader = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }
  const author = { ...reader, id: "fixture-source-author", roles: ["admin"] }
  let allocated = 0
  const environment = { at: now(), id: () => ++allocated === 1 ? versionId : `wp05-training-revision-${allocated}`, directory: [] }
  const source = await fixture.store.transaction("planner", async (snapshot) => {
    const previous = projectPlannerSource(snapshot, reader, fixture.scenario.baseRef)
    if (!previous) throw new Error("Original Planner source unavailable")
    const previousDigest = digestSfValue(previous)
    const copied = domain.execute(snapshot, author, { page: "Versions", action: "copy", id: fixture.scenario.baseRef, version: snapshot.versions[`versions:${fixture.scenario.baseRef}`]?.version ?? 0, values: { name: "Transition with a separately confirmed training quote" } }, environment)
    if (!copied.ok || copied.value !== versionId) throw new Error(`Planner copy rejected: ${JSON.stringify(copied)}`)
    const added = domain.execute(snapshot, author, { page: "OPEX", action: "save", id: "training", version: 0, values: { versionId, el: "licenses", cur: "USD", annual: 0, f10: 40000 } }, environment)
    if (!added.ok) throw new Error(`Planner training quote rejected: ${JSON.stringify(added)}`)
    if (digestSfValue(projectPlannerSource(snapshot, reader, fixture.scenario.baseRef)) !== previousDigest) throw new Error("Copy changed the original source")
    const projection = projectPlannerSource(snapshot, reader, versionId)
    if (!projection) throw new Error("Revised Planner source unavailable")
    const unsigned: RecordEvidence = { schema: "sf-evidence-v1", kind: "record", refId: versionId, installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", target: { surface: "planner", recordType: "planner-version", recordId: versionId, incarnation: `planner-${versionId}`, version: snapshot.versions[`versions:${versionId}`]?.version ?? 1, fields: Object.keys(projection), period: wp05Horizon, projectionDigest: digestSfValue({ versionId, projection }) } }
    return { commit: true, value: { ...unsigned, refDigest: digestSfEvidenceRef(unsigned) } }
  })
  const sourceRefs = [...structuredClone(fixture.sourceRefs), source]
  const basis: CostCoverageBasis = { ...structuredClone(fixture.basis), version: fixture.basis.version + 1, sourceRefs }
  const currentSource = async (reference: BusinessEvidenceRef, context: TrustedDomainContext) => {
    if (!await fixture.host.revalidate(context)) return false
    if (digestSfValue(reference) !== digestSfValue(source)) return (await fixture.evidence.resolve(reference, context)).state === "fresh"
    const projection = await fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: projectPlannerSource(snapshot, reader, versionId) }))
    return !!projection && digestSfValue({ versionId, projection }) === source.target.projectionDigest
  }
  const coverageAccess: { resolve?: (reference: string, context: TrustedDomainContext) => Promise<Awaited<ReturnType<PlannerSourceHost["resolveForecastCoverage"]>> | undefined> } = {}
  const sources: PlannerSourceHost = {
    resolveForecastSource: async (reference, context) => reference === source.refId
      ? await currentSource(source, context) ? { status: "ok", value: { versionId, evidence: source } } : { status: "unavailable", reason: "planner-source-unavailable" }
      : fixture.sources.resolveForecastSource(reference, context),
    resolveForecastCoverage: async (reference, context) => {
      // A current C10 registry can cover a source-only result; undefined keeps the explicit bootstrap.
      const registered = await coverageAccess.resolve?.(reference, context)
      if (registered) return registered
      const selected = sourceRefs.find((ref) => ref.refId === reference)
      if (selected) {
        if (!await currentSource(selected, context)) return { status: "unavailable", reason: "planner-coverage-unavailable" }
        const assessment: CostCoverageAssessment = { basisId: basis.id, basisVersion: basis.version, alternativeId: reference, alternativeVersion: 1, currency: "USD", horizon: wp05Horizon, issues: [], evaluatedSourceRefs: sourceRefs, coverageState: "pending", entries: basis.categoryIds.map((categoryId) => ({ categoryId, status: "pending", reason: "missing-category" })), derivedMissingCategoryIds: [...basis.categoryIds] }
        return { status: "ok", value: { coverageRef: `revised-source-coverage:${reference}`, basis, assessment } }
      }
      return { status: "unavailable", reason: "planner-coverage-unavailable" }
    },
  }
  const planner = createPlannerPort({ host: fixture.host, sources })
  const evidence: BusinessContextService = {
    resolve: async (ref, context) => ({ state: await currentSource(ref, context) ? "fresh" : "revoked", ref, accessRevision: context.binding.accessRevision, checkedAt: now() }),
    context: async ({ refs }, context) => Promise.all(refs.map((ref) => evidence.resolve(ref, context))),
    recall: async () => [],
    emitFromLedger: async () => { throw new Error("Unexpected memory write in the training revision fixture") },
  }
  const ids = { value: 0 }
  const results = createSfDecisionResultStore({ state: fixture.state, host: fixture.host, authorizeCase: async (decision) => decision.id === fixture.caseRef.id && decision.incarnation === fixture.caseRef.incarnation, verifySources: async (_value, refs, context) => (await Promise.all(refs.map((ref) => currentSource(ref, context)))).every(Boolean), createId: () => `wp05-revised-result-${++ids.value}`, now })
  const scenario = { ...structuredClone(fixture.scenario), baseRef: versionId }
  const projected = await planner.compareForecast({ baseRef: versionId, candidateRef: versionId, period: wp05Horizon, currency: "USD" }, fixture.context)
  if (projected.status !== "ok") throw new Error(`Revised Planner projection unavailable: ${JSON.stringify(projected)}`)
  const simulated = await planner.simulateScenario(scenario, fixture.context)
  if (simulated.status !== "ok") throw new Error(`Revised Planner scenario unavailable: ${JSON.stringify(simulated)}`)
  return { source, sources, sourceRefs, basis, planner, evidence, scenario, projection: projected.value.candidate, result: simulated.value, results, coverageAccess }
}
