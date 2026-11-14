import { digestSfValue } from "../contracts/canonical.ts"
import type { Period, SourceRef } from "../contracts/context.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ChangeImpact, ChoiceRecord, ScenarioComparison, ScenarioResult } from "../contracts/decisions.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { isSfObservationTime, sfObservationTimeAdvances } from "./observation-time.ts"

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

function sourceIdentity(source: SourceRef) { return { ...source, observedAt: isSfObservationTime(source.observedAt) ? "" : source.observedAt, fields: [...source.fields].sort() } }
function ordered<T>(values: readonly T[]) { return [...values].sort((left, right) => digestSfValue(left).localeCompare(digestSfValue(right))) }
function scenarioIdentity(result: ScenarioResult) {
  const coverage = result.costCoverage
  return { ...result, components: result.components.map((component) => ({ ...component, sourceRefs: component.sourceRefs.map(sourceIdentity) })),
    costCoverage: { ...coverage, evaluatedSourceRefs: ordered(coverage.evaluatedSourceRefs), derivedMissingCategoryIds: [...coverage.derivedMissingCategoryIds].sort(),
      entries: ordered(coverage.entries.map((entry) => entry.status === "pending" ? entry : { ...entry, evidenceRefs: ordered(entry.evidenceRefs), ...(entry.status === "included" ? { componentRefs: [...entry.componentRefs].sort() } : {}) })) } }
}

function materialChangeIdentity(change: MaterialChangeEvent) {
  return { ...change, source: sourceIdentity(change.source), fields: [...change.fields].sort(), ...(change.comparison ? { comparison: { ...change.comparison, resultBefore: scenarioIdentity(change.comparison.resultBefore), resultAfter: scenarioIdentity(change.comparison.resultAfter) } } : {}) }
}

/** Consumer rechecks use the same material identity as classification, including all business values. */
export function sfReconsiderationFingerprint(signal: ReconsiderationSignal, impact: ChangeImpact): string {
  if (!signalSources(signal).every((source) => isSfObservationTime(source.observedAt))) throw new Error("SF_INVALID_OBSERVATION_TIME")
  return digestSfValue([{ ...signal, source: sourceIdentity(signal.source), before: signal.before && { ...signal.before, result: scenarioIdentity(signal.before.result) }, after: signal.after && { ...signal.after, result: scenarioIdentity(signal.after.result) } }, impact])
}

export function sfReconsiderationObservationsAdvance(previous: ReconsiderationSignal, current: ReconsiderationSignal): boolean {
  const before = signalSources(previous)
  const after = signalSources(current)
  return before.length === after.length && before.every((source, index) => sfObservationTimeAdvances(source.observedAt, after[index]!.observedAt))
}

function signalSources(signal: ReconsiderationSignal): readonly SourceRef[] {
  return [signal.source, ...signal.before?.result.components.flatMap((component) => component.sourceRefs) ?? [], ...signal.after?.result.components.flatMap((component) => component.sourceRefs) ?? []]
}

function changeSources(change: MaterialChangeEvent): readonly SourceRef[] {
  return [change.source, ...change.comparison?.resultBefore.components.flatMap((component) => component.sourceRefs) ?? [], ...change.comparison?.resultAfter.components.flatMap((component) => component.sourceRefs) ?? []]
}

export function classifySfMaterialChange(condition: MaterialCondition, change: MaterialChangeEvent): { impact: ChangeImpact; signal?: ReconsiderationSignal } {
  // A new read timestamp is not a new material event. Source identity/version and all
  // business values remain bound; only observation time and set ordering are normalized.
  const digest = change.availability === "available" ? digestSfValue(materialChangeIdentity(change)) : digestSfValue([condition.id, "unavailable"])
  const key = digestSfValue([condition.id, digest])
  const same = condition.source.surface === change.source.surface && condition.source.type === change.source.type && condition.source.id === change.source.id
  const overlap = condition.period.start <= change.period.end && change.period.start <= condition.period.end
  const relevant = condition.fields.some((field) => change.fields.includes(field))
  const replaced = same && condition.source.incarnation !== change.source.incarnation
  const beforeCriteria = change.comparison?.before.criterionResults.filter((item) => item.criterionId === condition.criterionId) ?? []
  const afterCriteria = change.comparison?.after.criterionResults.filter((item) => item.criterionId === condition.criterionId) ?? []
  const criterionBefore = beforeCriteria.length === 1 ? beforeCriteria[0] : undefined
  const criterionAfter = afterCriteria.length === 1 ? afterCriteria[0] : undefined
  const unknown = change.availability !== "available" || (same && overlap && relevant && (!change.before.length || !change.after.length || !change.comparison || !criterionBefore || !criterionAfter || criterionAfter.state === "unknown" || [change.comparison.resultBefore.costCoverage, change.comparison.resultAfter.costCoverage].some((coverage) => (new Set(coverage.entries.map((entry) => entry.categoryId)).size !== coverage.entries.length || coverage.entries.some((entry) => entry.status !== "pending" && (!entry.evidenceRefs.length || (entry.status === "included" && !entry.componentRefs.length) || (entry.status === "not-applicable" && !entry.justification.trim()))))) || (digestSfValue(change.comparison.before) !== digestSfValue(condition.choice.comparison) || digestSfValue(change.comparison.resultBefore) !== digestSfValue(condition.choice.result))))
  const coverageChanges = change.comparison ? [
    ...change.comparison.resultAfter.costCoverage.entries.flatMap((entry) => {
      const before = change.comparison?.resultBefore.costCoverage.entries.find((item) => item.categoryId === entry.categoryId)
      return before?.status !== entry.status ? [`${entry.categoryId}:${before?.status ?? "absent"}->${entry.status}`] : []
    }),
    ...change.comparison.resultBefore.costCoverage.entries.filter((entry) => !change.comparison?.resultAfter.costCoverage.entries.some((item) => item.categoryId === entry.categoryId)).map((entry) => `${entry.categoryId}:${entry.status}->absent`),
  ].sort() : []
  const affectedCategories = new Set(coverageChanges.map((item) => item.slice(0, item.indexOf(":"))))
  const componentMeaning = (component: ScenarioResult["components"][number]) => [component.amount, component.currency, component.period, component.evidenceState]
  const changedComponents = change.comparison ? [
    ...change.comparison.resultAfter.components.filter((component) => {
      const previous = change.comparison?.resultBefore.components.find((item) => item.id === component.id)
      return !previous || digestSfValue(componentMeaning(previous)) !== digestSfValue(componentMeaning(component))
    }).map((component) => component.id),
    ...change.comparison.resultBefore.components.filter((component) => !change.comparison?.resultAfter.components.some((item) => item.id === component.id)).map((component) => component.id),
  ] : []
  const components = [...changedComponents, ...(change.comparison?.resultAfter.costCoverage.entries.flatMap((entry) => entry.status === "included" && affectedCategories.has(entry.categoryId) ? entry.componentRefs : []) ?? [])]
  const costChanged = !!change.comparison && digestSfValue([change.comparison.resultBefore.total, change.comparison.resultBefore.knownSubtotal, change.comparison.resultBefore.costCoverage.coverageState, change.comparison.resultBefore.costCoverage.entries.map((entry) => [entry.categoryId, entry.status]).sort((left, right) => left[0]!.localeCompare(right[0]!))]) !== digestSfValue([change.comparison.resultAfter.total, change.comparison.resultAfter.knownSubtotal, change.comparison.resultAfter.costCoverage.coverageState, change.comparison.resultAfter.costCoverage.entries.map((entry) => [entry.categoryId, entry.status]).sort((left, right) => left[0]!.localeCompare(right[0]!))])
  const comparisonChanged = !!change.comparison && (criterionBefore?.state !== criterionAfter?.state || change.comparison.before.comparisonStatus !== change.comparison.after.comparisonStatus || change.comparison.before.knownDifference !== change.comparison.after.knownDifference || change.comparison.before.completeDifference !== change.comparison.after.completeDifference)
  const deadlineChanged = condition.source.version !== change.source.version && condition.fields.some((field) => change.fields.includes(field) && ["deadline", "dueDate", "horizon"].includes(field))
  const state = !same ? "irrelevant" : change.availability === "available" && replaced ? "material" : !overlap || !relevant ? "irrelevant" : unknown ? "unknown" : !comparisonChanged && !costChanged && !deadlineChanged ? "irrelevant" : "material"
  const reason = !same ? "different-source" : change.availability === "available" && replaced ? "source-replaced" : !overlap ? "outside-period" : !relevant ? "outside-fields" : change.availability !== "available" ? "evidence-unavailable" : unknown ? "evidence-unavailable" : state === "irrelevant" ? "condition-unchanged" : deadlineChanged && !comparisonChanged && !costChanged ? "deadline-changed" : `criterion:${condition.criterionId}:${criterionBefore?.state}->${criterionAfter?.state}${coverageChanges.length ? `; coverage:${coverageChanges.join(",")}` : ""}${components.length ? `; components:${[...new Set(components)].sort().join(",")}` : ""}`
  const impact: ChangeImpact = { id: key, conditionId: condition.id, changeDigest: digest, state, chosen: change.availability === "available" ? change.before : [], current: change.availability === "available" ? change.after : [], reason }
  if (state === "irrelevant") return { impact }
  return { impact, signal: { correlationKey: key, conditionId: condition.id, choiceId: condition.choice.id, severity: state === "unknown" ? "unknown" : "reconsider", reason, source: change.source, before: change.availability === "available" && change.comparison ? { comparison: change.comparison.before, result: change.comparison.resultBefore } : undefined, after: change.availability === "available" && change.comparison ? { comparison: change.comparison.after, result: change.comparison.resultAfter } : undefined, originalReason: change.availability === "available" ? condition.choice.reason : "", impact } }
}

/** The host loads both the stored choice and the current domain-produced change under current authority. */
export function createSfMaterialityAccess(input: {
  load: (conditionId: string, call: TrustedDomainContext) => Promise<{ condition: MaterialCondition; change: MaterialChangeEvent } | undefined>
  authorizeEvidence: (refs: readonly BusinessEvidenceRef[], call: TrustedDomainContext) => Promise<boolean>
  revalidate: (call: TrustedDomainContext) => Promise<boolean>
}) {
  return async (conditionId: string, call: TrustedDomainContext) => {
    try {
      const binding = digestSfValue([call.kind, call.binding])
      if (!conditionId || !await input.revalidate(call)) return { status: "unavailable" as const }
      const read = async () => {
        const loaded = await input.load(conditionId, call)
        const value = loaded ? structuredClone(loaded) : undefined
        if (!value || value.condition.id !== conditionId || !isSfObservationTime(value.condition.source.observedAt) || !changeSources(value.change).every((source) => isSfObservationTime(source.observedAt))) return undefined
        const valueDigest = digestSfValue(value)
        const choice = value.condition.choice
        const refs = [...choice.evidenceRefs, ...choice.result.sourceRefs, ...choice.scenario.assumptions.flatMap((item) => item.evidenceRefs), ...choice.costCoverage.evaluatedSourceRefs, ...choice.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs), ...choice.result.costCoverage.evaluatedSourceRefs, ...choice.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs), ...value.change.before, ...value.change.after, ...(value.change.comparison?.resultAfter.sourceRefs ?? []), ...(value.change.comparison?.resultAfter.costCoverage.evaluatedSourceRefs ?? []), ...(value.change.comparison?.resultAfter.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs) ?? [])]
        if (refs.some((ref) => ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId) || !await input.authorizeEvidence(structuredClone(refs), call) || digestSfValue(value) !== valueDigest) return undefined
        return value
      }
      const first = await read()
      const firstDigest = digestSfValue(first)
      if (!first || !await input.revalidate(call) || digestSfValue(first) !== firstDigest) return { status: "unavailable" as const }
      const result = classifySfMaterialChange(first.condition, first.change)
      const second = await read()
      const secondDigest = digestSfValue(second)
      if (!second || !await input.revalidate(call) || digestSfValue(first) !== firstDigest || digestSfValue(second) !== secondDigest || digestSfValue({ condition: first.condition, change: materialChangeIdentity(first.change) }) !== digestSfValue({ condition: second.condition, change: materialChangeIdentity(second.change) }) || changeSources(first.change).some((source, index) => !sfObservationTimeAdvances(source.observedAt, changeSources(second.change)[index]!.observedAt)) || digestSfValue([call.kind, call.binding]) !== binding) return { status: "unavailable" as const }
      return { status: "ok" as const, ...result, snapshot: { condition: first.condition, change: first.change }, scope: { source: first.condition.source, fields: first.condition.fields, period: first.condition.period, criterionId: first.condition.criterionId, choiceId: first.condition.choice.id } }
    } catch {
      return { status: "unavailable" as const }
    }
  }
}
