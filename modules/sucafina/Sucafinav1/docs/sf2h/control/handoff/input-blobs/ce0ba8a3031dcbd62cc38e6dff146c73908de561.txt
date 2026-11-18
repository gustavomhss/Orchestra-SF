import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../contracts/business-context.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { CostCoverageEntry } from "../contracts/decisions.ts"
import type { BaselineCoverageRequest } from "./baseline-coverage.ts"

/** The human assigns categories; amounts and source identity come from Planner. */
export type CoverageClassification = {
  schema: "sf-coverage-classification-v1"
  caseRef: BaselineCoverageRequest["caseRef"]
  basis: BaselineCoverageRequest["basis"]
  source: BaselineCoverageRequest["source"]
  version: number
  mappings: readonly { entry: Extract<CostCoverageEntry, { status: "included" }>; components: readonly { id: string; currency: string; period: DomainProjection["context"]["period"]; sourceRefs: DomainProjection["components"][number]["sourceRefs"] }[] }[]
  classificationDigest: string
}

export function classifyCoverage(request: BaselineCoverageRequest, projection: DomainProjection, version: number): CoverageClassification {
  const mappings = request.entries.flatMap((entry) => {
    if (entry.status !== "included") return []
    const components = entry.componentRefs.flatMap((id) => projection.components.filter((component) => component.id === id).map((component) => ({ id: component.id, currency: component.currency, period: component.period, sourceRefs: component.sourceRefs })))
    return [{ entry: structuredClone(entry), components }]
  })
  const value = { schema: "sf-coverage-classification-v1" as const, caseRef: request.caseRef, basis: request.basis, source: request.source, version, mappings, classificationDigest: "" }
  return { ...value, classificationDigest: classificationDigest(value) }
}

export function supportsCoverageClassification(classification: CoverageClassification, entry: Exclude<CostCoverageEntry, { status: "pending" }>, evidence: readonly BusinessEvidenceResolution[]) {
  if (entry.status !== "included" || classification.classificationDigest !== classificationDigest(classification)) return false
  const matches = classification.mappings.filter((mapping) => digestSfValue(mapping.entry) === digestSfValue(entry))
  if (matches.length !== 1 || !entry.componentRefs.length || new Set(entry.componentRefs).size !== entry.componentRefs.length || matches[0]!.components.length !== entry.componentRefs.length || !entry.scopeNote.trim()) return false
  if (!fresh(classification.source, evidence) || entry.evidenceRefs.some((ref) => !fresh(ref, evidence))) return false
  return matches[0]!.components.every((component) => entry.componentRefs.includes(component.id) && component.sourceRefs.length > 0 && component.sourceRefs.every((source) => entry.evidenceRefs.some((ref) => ref.kind === "record" && ref.target.surface === source.surface && ref.target.recordType === source.type && ref.target.recordId === source.id && ref.target.incarnation === source.incarnation && ref.target.version === source.version && ref.target.period !== undefined && ref.target.period.start <= source.period.start && ref.target.period.end >= source.period.end && source.fields.every((field) => ref.kind === "record" && ref.target.fields.includes(field)))))
}
export function classificationDigest(value: CoverageClassification) { return digestSfValue(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "classificationDigest"))) }
export function classificationKey(caseRef: BaselineCoverageRequest["caseRef"], sourceRef: string) { return `sf:proposal-coverage:classification:active:${digestSfValue({ id: caseRef.id, incarnation: caseRef.incarnation, sourceRef })}` }
function fresh(ref: BusinessEvidenceRef, evidence: readonly BusinessEvidenceResolution[]) { return evidence.some((item) => item.state === "fresh" && digestSfValue(item.ref) === digestSfValue(ref)) }
