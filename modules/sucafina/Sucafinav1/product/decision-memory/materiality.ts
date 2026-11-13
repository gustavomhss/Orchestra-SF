import { digestSfValue } from "../contracts/canonical.ts"
import type { Period, SourceRef } from "../contracts/context.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ChangeImpact, ChoiceRecord, ScenarioComparison, ScenarioResult } from "../contracts/decisions.ts"

export type MaterialChangeEvent = {
  source: SourceRef
  fields: readonly string[]
  period: Period
  before: readonly BusinessEvidenceRef[]
  after: readonly BusinessEvidenceRef[]
  availability: "available" | "unavailable"
  comparison?: { before: ScenarioComparison; after: ScenarioComparison; resultBefore: ScenarioResult; resultAfter: ScenarioResult }
}
export type MaterialCondition = { id: string; source: SourceRef; fields: readonly string[]; period: Period; criterionId: string; choice: ChoiceRecord }
export type ReconsiderationSignal = { correlationKey: string; conditionId: string; choiceId: string; severity: "reconsider" | "unknown"; reason: string; source: SourceRef; before: { comparison: ScenarioComparison; result: ScenarioResult } | undefined; after: { comparison: ScenarioComparison; result: ScenarioResult } | undefined; originalReason: string; impact: ChangeImpact }

export function classifySfMaterialChange(condition: MaterialCondition, change: MaterialChangeEvent): { impact: ChangeImpact; signal?: ReconsiderationSignal } {
  const digest = change.availability === "available" ? digestSfValue(change) : digestSfValue([condition.id, "unavailable"])
  const key = digestSfValue([condition.id, digest])
  const same = condition.source.surface === change.source.surface && condition.source.type === change.source.type && condition.source.id === change.source.id
  const overlap = condition.period.start <= change.period.end && change.period.start <= condition.period.end
  const relevant = condition.fields.some((field) => change.fields.includes(field))
  const replaced = same && condition.source.incarnation !== change.source.incarnation
  const criterionBefore = change.comparison?.before.criterionResults.find((item) => item.criterionId === condition.criterionId)
  const criterionAfter = change.comparison?.after.criterionResults.find((item) => item.criterionId === condition.criterionId)
  const unknown = change.availability !== "available" || (same && overlap && relevant && (!change.before.length || !change.after.length || !change.comparison || !criterionBefore || !criterionAfter || criterionAfter.state === "unknown" || digestSfValue(change.comparison.before) !== digestSfValue(condition.choice.comparison)))
  const state = !same ? "irrelevant" : change.availability === "available" && replaced ? "material" : !overlap || !relevant ? "irrelevant" : unknown ? "unknown" : digestSfValue(change.comparison?.before) === digestSfValue(change.comparison?.after) ? "irrelevant" : "material"
  const reason = !same ? "different-source" : change.availability === "available" && replaced ? "source-replaced" : !overlap ? "outside-period" : !relevant ? "outside-fields" : change.availability !== "available" ? "evidence-unavailable" : unknown ? "evidence-unavailable" : state === "irrelevant" ? "condition-unchanged" : `criterion:${condition.criterionId}:${criterionBefore?.state}->${criterionAfter?.state}`
  const impact: ChangeImpact = { id: key, conditionId: condition.id, changeDigest: digest, state, chosen: change.availability === "available" ? change.before : [], current: change.availability === "available" ? change.after : [], reason }
  if (state === "irrelevant") return { impact }
  return { impact, signal: { correlationKey: key, conditionId: condition.id, choiceId: condition.choice.id, severity: state === "unknown" ? "unknown" : "reconsider", reason, source: change.source, before: change.availability === "available" && change.comparison ? { comparison: change.comparison.before, result: change.comparison.resultBefore } : undefined, after: change.availability === "available" && change.comparison ? { comparison: change.comparison.after, result: change.comparison.resultAfter } : undefined, originalReason: change.availability === "available" ? condition.choice.reason : "", impact } }
}
