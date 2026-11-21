import { digestSfEvidenceRef, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DomainPortHost, PlannerSourceHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createDecisionBaselineCoverage } from "../../../../modules/sucafina/Sucafinav1/product/decisions/baseline-coverage.ts"
import { classificationDigest } from "../../../../modules/sucafina/Sucafinav1/product/decisions/coverage-classification.ts"
import type { CoverageClassification } from "../../../../modules/sucafina/Sucafinav1/product/decisions/coverage-classification.ts"

type Selection = { caseRef: { id: string; incarnation: string; version: number }; source: Extract<BusinessEvidenceRef, { kind: "record" }> }
type Coverage = Extract<Awaited<ReturnType<PlannerSourceHost["resolveForecastCoverage"]>>, { status: "ok" }>["value"]
export type SfDecisionCoverageRead = { expectedVersion: number; classification: CoverageClassification; coverage: Coverage }

/** Reopen the canonical classification and receipt under the current UI admission.
 * This projection neither creates coverage nor treats a remembered browser receipt
 * as authority. Historical choices continue to use their immutable case records.
 */
export async function readSfDecisionCoverage(input: {
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  baseline: Pick<ReturnType<typeof createDecisionBaselineCoverage>, "readClassification" | "resolveForecastCoverage">
}, selection: Selection, context: TrustedUiContext): Promise<PortResult<SfDecisionCoverageRead>> {
  try {
    const captured = structuredClone(selection)
    const source = input.host.requestFor(context)
    const binding = digestSfValue({ kind: context.kind, binding: context.binding })
    const selected = digestSfValue(captured)
    const live = () => !!source && !source.signal.aborted && input.host.requestFor(context) === source &&
      digestSfValue({ kind: context.kind, binding: context.binding }) === binding && digestSfValue(selection) === selected
    if (context.kind !== "ui" || !live() || !captured.caseRef.id.trim() || !captured.caseRef.incarnation.trim() ||
      !Number.isSafeInteger(captured.caseRef.version) || captured.caseRef.version < 1 || captured.source.refDigest !== digestSfEvidenceRef(captured.source) ||
      captured.source.installationId !== context.binding.installationId || captured.source.projectId !== context.binding.projectId ||
      captured.source.target.surface !== "planner" || captured.source.target.recordType !== "planner-version" ||
      !await input.host.revalidate(context) || !live()) return { status: "denied", reason: "decision-coverage-read-authority-unavailable" }
    const classification = await input.baseline.readClassification(captured.source.refId, context)
    if (!live()) return { status: "denied", reason: "decision-coverage-read-authority-unavailable" }
    if (classification.status !== "ok") return classification
    const value = classification.value
    if (value.caseRef.id !== captured.caseRef.id || value.caseRef.incarnation !== captured.caseRef.incarnation ||
      value.caseRef.version > captured.caseRef.version || !Number.isSafeInteger(value.version) || value.version < 1 ||
      digestSfValue(value.source) !== digestSfValue(captured.source) || value.classificationDigest !== classificationDigest(value))
      return { status: "stale", reason: "decision-coverage-read-selection-changed" }
    const coverage = await input.baseline.resolveForecastCoverage(captured.source.refId, context)
    if (!live()) return { status: "denied", reason: "decision-coverage-read-authority-unavailable" }
    if (coverage.status !== "ok") return coverage
    if (!coverage.value.coverageRef || digestSfValue(coverage.value.basis) !== digestSfValue(value.basis) ||
      coverage.value.assessment.basisId !== value.basis.id || coverage.value.assessment.basisVersion !== value.basis.version ||
      coverage.value.assessment.alternativeVersion !== value.version)
      return { status: "stale", reason: "decision-coverage-read-classification-changed" }
    if (!await input.host.revalidate(context) || !live()) return { status: "denied", reason: "decision-coverage-read-authority-unavailable" }
    return { status: "ok", value: structuredClone({ expectedVersion: value.version, classification: value, coverage: coverage.value }) }
  } catch {
    return { status: "unavailable", reason: "decision-coverage-read-unavailable" }
  }
}
