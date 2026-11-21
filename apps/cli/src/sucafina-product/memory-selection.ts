import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { digestSfEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import { isSfPeriod } from "../../../../modules/sucafina/Sucafinav1/product/contracts/validation.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { SfSignalSelection } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/signal-registry.ts"
import type { SfOutcomeSelection } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/domain-outcome.ts"

export type SfMemoryCaseRef = { id: string; incarnation: string; version: number }
export type SfMaterialSelection = { caseRef: SfMemoryCaseRef; choiceId: string; conditionIds: readonly string[] }
export type SfMaterialSelectionScope = SfMaterialSelection & { action: "analysis.prepare" | "analysis.start"; payload: unknown }

export function memoryCaseRef(value: unknown): SfMemoryCaseRef | undefined {
  const candidate = object(value)
  return exact(candidate, ["id", "incarnation", "version"]) && nonempty(candidate.id) && nonempty(candidate.incarnation) &&
    typeof candidate.version === "number" && Number.isSafeInteger(candidate.version) && candidate.version > 0
    ? { id: candidate.id, incarnation: candidate.incarnation, version: candidate.version } : undefined
}

/** Both UI preparation and later verification carry the same explicit condition order. */
export function materialSelection(request: unknown, skillInputOrSelection: unknown): SfMaterialSelection | undefined {
  const incoming = object(request)
  const caseRef = memoryCaseRef(incoming.caseRef)
  if (incoming.skillId !== "sf-reavaliar-compromissos" || !caseRef) return undefined
  const candidate = object(skillInputOrSelection)
  if (exact(candidate, ["choiceId", "materialChangeIds", "confirmedDependencyRefIds"])) {
    if (!nonempty(candidate.choiceId) || !strings(candidate.materialChangeIds) || !candidate.materialChangeIds.length ||
      !strings(candidate.confirmedDependencyRefIds)) return undefined
    return { caseRef, choiceId: candidate.choiceId, conditionIds: [...candidate.materialChangeIds] }
  }
  const decoded = decodeSfSkillInput("CommitmentReevaluationInput", skillInputOrSelection)
  if (!decoded.ok || !nonempty(decoded.value.originalChoice.id)) return undefined
  const ids = decoded.value.changes.map((change) => change.conditionId)
  return strings(ids) && ids.length ? { caseRef, choiceId: decoded.value.originalChoice.id, conditionIds: ids } : undefined
}

export function memorySignalSelection(value: unknown): SfSignalSelection | undefined {
  const candidate = object(value)
  const caseRef = memoryCaseRef(candidate.caseRef)
  const source = object(candidate.source)
  const evidence = plannerEvidence(candidate.evidence)
  if (!exact(candidate, ["caseRef", "choiceId", "scenarioRefs", "source", "evidence", "fields", "period", "criterionId", "recipientRef", "destination", "label"]) ||
    !caseRef || !nonempty(candidate.choiceId) || !strings(candidate.scenarioRefs) || candidate.scenarioRefs.length !== 2 ||
    !nonempty(candidate.criterionId) || !nonempty(candidate.recipientRef) || !nonempty(candidate.destination) || !nonempty(candidate.label) ||
    !strings(candidate.fields) || !candidate.fields.length || !isSfPeriod(candidate.period) || !evidence ||
    !exact(source, ["surface", "type", "id", "incarnation", "version", "fields", "period", "observedAt"]) ||
    source.surface !== "planner" || source.type !== "planner-version" || !nonempty(source.id) || !nonempty(source.incarnation) ||
    typeof source.version !== "number" || !Number.isSafeInteger(source.version) || source.version < 1 || !strings(source.fields) ||
    !source.fields.length || !isSfPeriod(source.period) || !nonempty(source.observedAt) || !Number.isFinite(Date.parse(source.observedAt))) return undefined
  return { caseRef, choiceId: candidate.choiceId, scenarioRefs: [candidate.scenarioRefs[0]!, candidate.scenarioRefs[1]!], evidence,
    source: { surface: "planner", type: source.type, id: source.id, incarnation: source.incarnation, version: source.version,
      fields: [...source.fields], period: source.period, observedAt: source.observedAt }, fields: [...candidate.fields], period: candidate.period,
    criterionId: candidate.criterionId, recipientRef: candidate.recipientRef, destination: candidate.destination, label: candidate.label }
}

export function memoryOutcomeSelection(value: unknown): SfOutcomeSelection | undefined {
  const candidate = object(value)
  const caseRef = memoryCaseRef(candidate.caseRef)
  const refs = candidate.evidenceRefs
  const evidence = Array.isArray(refs) && refs.length === 1 ? plannerEvidence(refs[0]) : undefined
  if (!exact(candidate, ["caseRef", "choiceId", "criterionRef", "valueId", "period", "evidenceRefs"]) || !caseRef ||
    !nonempty(candidate.choiceId) || !nonempty(candidate.criterionRef) || !nonempty(candidate.valueId) || !isSfPeriod(candidate.period) || !evidence) return undefined
  return { caseRef, choiceId: candidate.choiceId, criterionRef: candidate.criterionRef, valueId: candidate.valueId, period: candidate.period, evidenceRefs: [evidence] }
}

function plannerEvidence(value: unknown): Extract<BusinessEvidenceRef, { kind: "record" }> | undefined {
  const candidate = object(value)
  const target = object(candidate.target)
  if (!exact(candidate, ["schema", "kind", "refId", "installationId", "projectId", "refDigest", "evidenceLevel", "target"]) ||
    candidate.schema !== "sf-evidence-v1" || candidate.kind !== "record" || !nonempty(candidate.refId) || !nonempty(candidate.installationId) ||
    !nonempty(candidate.projectId) || !nonempty(candidate.refDigest) || candidate.evidenceLevel !== "observed" ||
    !exact(target, ["surface", "recordType", "recordId", "incarnation", "version", "fields", "period", "projectionDigest"]) ||
    target.surface !== "planner" || target.recordType !== "planner-version" || !nonempty(target.recordId) || !nonempty(target.incarnation) ||
    typeof target.version !== "number" || !Number.isSafeInteger(target.version) || target.version < 1 || !strings(target.fields) ||
    !target.fields.length || !isSfPeriod(target.period) || !nonempty(target.projectionDigest) || !/^[a-f0-9]{64}$/.test(target.projectionDigest)) return undefined
  const evidence: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", refId: candidate.refId,
    installationId: candidate.installationId, projectId: candidate.projectId, refDigest: candidate.refDigest, evidenceLevel: "observed",
    target: { surface: "planner", recordType: "planner-version", recordId: target.recordId, incarnation: target.incarnation,
      version: target.version, fields: [...target.fields], period: target.period, projectionDigest: target.projectionDigest } }
  return digestSfEvidenceRef(evidence) === evidence.refDigest ? evidence : undefined
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && !!value.trim()
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonempty) && new Set(value).size === value.length
}

function exact(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}
