/**
 * U19 presenter types narrowed from the pinned A04/A05 producer envelopes.
 * No arithmetic, eligibility, case version, coverage or history is created
 * here: only canonical producer output is displayed, including null vs zero.
 */
export type SfCaseVersionRef = Readonly<{ id: string; incarnation: string; version: number }>
export type SfCaseChoice = Readonly<{ ref: string; title: string; version: number }>
export type SfCaseControls = Readonly<{
  cases: readonly SfCaseChoice[]
  accessRevision: string
  selected: null | Readonly<{
    ref: string
    caseRef: SfCaseVersionRef
    objective: string
    horizon: Readonly<{ start: string; end: string }>
    currency: string
    scenarios: readonly Readonly<{ ref: string; title: string; alternativeId: string; parameters: readonly Readonly<{ ref: string; label: string }>[] }>[]
    alternatives: readonly Readonly<{ id: string; title: string; version: number }>[]
    rules: readonly Readonly<{ id: string; expectedVersion?: number }>[]
    priorities: readonly Readonly<{ id: string; description: string }>[]
    unitSelection: null | Readonly<{ scenarioRef: string; baselineRef: string; parameterRef: string }>
  }>
}>
export type SfPortfolioCombination = Readonly<{
  id: string
  eligibility: "eligible-complete" | "conditioned" | "unavailable" | "ineligible"
  comparisonStatus: "complete" | "conditioned" | "incompatible" | "unavailable"
  caseRefs: readonly string[]
  costCoverageRefs: readonly string[]
  conflicts: readonly string[]
  restrictions: readonly string[]
  comparison: Readonly<{ status: string; knownDifference: number | null; completeDifference: number | null }> | null
}>
export type SfPortfolioResultView = Readonly<{
  combinations: readonly SfPortfolioCombination[]
  limitations: readonly string[]
  evidenceRefs: readonly string[]
}>
export type SfPortfolioHistory = readonly Readonly<{ resultRef: string; createdAt: string }>[]
export type SfRecordedPortfolio = Readonly<{
  resultRef: string
  createdAt: string
  caseRef: SfCaseVersionRef
  result: SfPortfolioResultView
}>
export type SfSensitivitySample = Readonly<{ parameterValue: number; resultRef: string; value: number | null }>
export type SfSensitivityResultView = Readonly<{
  scenarioRef: string
  parameterRef: string
  bounds: Readonly<{ minimum: number; maximum: number; steps: number }>
  evaluated: readonly SfSensitivitySample[]
  threshold: number | null
  thresholdEvidence: Readonly<{ state: "exact"; value: number; evidenceRefs: readonly string[] }> |
    Readonly<{ state: "sampled"; interval: Readonly<{ minimum: number; maximum: number }>; evidenceRefs: readonly string[] }> |
    Readonly<{ state: "unavailable"; reason: string }>
  unit: string
  parameterUnit: string | null
  resultUnit: string | null
  comparisonStatus: "complete" | "conditioned" | "incompatible" | "unavailable"
  costCoverageRefs: readonly string[]
  unresolvedConditions: readonly Readonly<{ id: string; reason: string }>[]
  evidenceRefs: readonly string[]
}>
export type SfRecordedSensitivity = Readonly<{
  resultRef: string
  createdAt: string
  caseRef: SfCaseVersionRef
  result: SfSensitivityResultView
}>

function row(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
const str = (v: unknown): v is string => typeof v === "string"
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)
function strArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(str)
}
function refs(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) return null
  const result: string[] = []
  for (const item of value) {
    if (!row(item) || !str(item.refId) || !item.refId) return null
    result.push(item.refId)
  }
  return result
}
export function sfUnwrapPort(value: unknown): unknown | null {
  return row(value) && value.status === "ok" && value.value !== undefined ? value.value : null
}
export function sfCaseRef(value: unknown): SfCaseVersionRef | null {
  return row(value) && str(value.id) && value.id.trim().length > 0 &&
    str(value.incarnation) && value.incarnation.trim().length > 0 &&
    Number.isSafeInteger(value.version) && (value.version as number) > 0 ?
      { id: value.id, incarnation: value.incarnation, version: value.version as number } : null
}
export function sfReadControls(payload: unknown, wanted?: string): SfCaseControls | null {
  const source = sfUnwrapPort(payload)
  if (!row(source) || !Array.isArray(source.cases) || !str(source.accessRevision)) return null
  const cases: SfCaseChoice[] = []
  for (const entry of source.cases) {
    if (!row(entry) || !str(entry.ref) || !entry.ref ||
        !str(entry.title) || !Number.isSafeInteger(entry.version)) return null
    cases.push({ ref: entry.ref, title: entry.title, version: entry.version as number })
  }
  if (new Set(cases.map((entry) => entry.ref)).size !== cases.length) return null
  if (source.selected === undefined || source.selected === null) {
    return wanted ? null : { cases, accessRevision: source.accessRevision, selected: null }
  }
  const selected = source.selected
  if (!row(selected) || !str(selected.ref) || selected.ref !== wanted ||
    !cases.some((entry) => entry.ref === selected.ref) || !sfCaseRef(selected.caseRef) ||
    !row(selected.decision) || !str(selected.decision.objective) ||
    !row(selected.decision.horizon) || !str(selected.decision.horizon.start) ||
    !str(selected.decision.horizon.end) || !str(selected.decision.currency) ||
    !Array.isArray(selected.scenarios) || !Array.isArray(selected.rules) ||
    !Array.isArray(selected.decision.alternatives)) return null
  const scenarios: NonNullable<SfCaseControls["selected"]>["scenarios"][number][] = []
  for (const scenario of selected.scenarios) {
    if (!row(scenario) || !str(scenario.ref) || !str(scenario.title) ||
        !str(scenario.alternativeId) || !Array.isArray(scenario.parameters)) return null
    const parameters: { ref: string; label: string }[] = []
    for (const parameter of scenario.parameters) {
      if (!row(parameter) || !str(parameter.ref) || !str(parameter.label)) return null
      parameters.push({ ref: parameter.ref, label: parameter.label })
    }
    scenarios.push({ ref: scenario.ref, title: scenario.title, alternativeId: scenario.alternativeId, parameters })
  }
  const alternatives: { id: string; version: number; title: string }[] = []
  for (const alternative of selected.decision.alternatives) {
    if (!row(alternative) || !str(alternative.id) || !alternative.id ||
      !Number.isSafeInteger(alternative.version) || (alternative.version as number) <= 0 ||
      !str(alternative.title)) return null
    alternatives.push({ id: alternative.id, version: alternative.version as number, title: alternative.title })
  }
  const rules: { id: string; expectedVersion?: number }[] = []
  for (const rule of selected.rules) {
    if (!row(rule) || !str(rule.id) || !rule.id) return null
    rules.push({ id: rule.id, ...(Number.isSafeInteger(rule.expectedVersion) ?
      { expectedVersion: rule.expectedVersion as number } : {}) })
  }
  const priorities: { id: string; description: string }[] = []
  if (Array.isArray(selected.decision.criteria)) for (const priority of selected.decision.criteria) {
    if (!row(priority) || !str(priority.id) || !str(priority.description)) return null
    priorities.push({ id: priority.id, description: priority.description })
  }
  let unitSelection: NonNullable<SfCaseControls["selected"]>["unitSelection"] = null
  if (selected.unitSelection != null) {
    if (!row(selected.unitSelection) || !str(selected.unitSelection.scenarioRef) ||
      !str(selected.unitSelection.baselineRef) || !str(selected.unitSelection.parameterRef)) return null
    unitSelection = { scenarioRef: selected.unitSelection.scenarioRef,
      baselineRef: selected.unitSelection.baselineRef, parameterRef: selected.unitSelection.parameterRef }
  }
  return { cases, accessRevision: source.accessRevision,
    selected: { ref: selected.ref, caseRef: sfCaseRef(selected.caseRef)!,
      objective: selected.decision.objective,
      horizon: { start: selected.decision.horizon.start, end: selected.decision.horizon.end },
      currency: selected.decision.currency, scenarios, alternatives, rules, priorities, unitSelection } }
}
function readCombination(value: unknown): SfPortfolioCombination | null {
  if (!row(value) || !str(value.id) || !strArray(value.caseRefs) ||
    !strArray(value.costCoverageRefs) || !strArray(value.conflicts) ||
    !strArray(value.restrictions) ||
    !["eligible-complete", "conditioned", "unavailable", "ineligible"].includes(String(value.eligibility)) ||
    !["complete", "conditioned", "incompatible", "unavailable"].includes(String(value.comparisonStatus))) return null
  const analysis = row(value.analysis) ? value.analysis : undefined
  const raw = analysis && row(analysis.comparison) ? analysis.comparison : undefined
  const compare = raw ? {
    status: str(raw.comparisonStatus) ? raw.comparisonStatus : "unavailable",
    knownDifference: finite(raw.knownDifference) ? raw.knownDifference : null,
    completeDifference: finite(raw.completeDifference) ? raw.completeDifference : null,
  } : null
  return { id: value.id, eligibility: value.eligibility as SfPortfolioCombination["eligibility"],
    comparisonStatus: value.comparisonStatus as SfPortfolioCombination["comparisonStatus"],
    caseRefs: value.caseRefs, costCoverageRefs: value.costCoverageRefs,
    conflicts: value.conflicts, restrictions: value.restrictions, comparison: compare }
}
export function sfReadPortfolioResult(value: unknown): SfPortfolioResultView | null {
  if (!row(value) || !Array.isArray(value.combinations) || !strArray(value.limitations)) return null
  const evidenceRefs = refs(value.evidenceRefs)
  if (!evidenceRefs) return null
  const combinations = value.combinations.map(readCombination)
  if (combinations.some((item) => !item)) return null
  return { combinations: combinations as readonly SfPortfolioCombination[],
    limitations: value.limitations, evidenceRefs }
}
export function sfReadPortfolioHistory(value: unknown): SfPortfolioHistory | null {
  if (!Array.isArray(value)) return null
  const results: { resultRef: string; createdAt: string }[] = []
  for (const item of value) {
    if (!row(item) || !str(item.resultRef) || !item.resultRef || !str(item.createdAt)) return null
    results.push({ resultRef: item.resultRef, createdAt: item.createdAt })
  }
  return results
}
export function sfReadRecordedPortfolio(value: unknown): SfRecordedPortfolio | null {
  if (!row(value) || value.kind !== "portfolio" || !str(value.resultRef) ||
    !str(value.createdAt) || !sfCaseRef(value.caseRef)) return null
  const result = sfReadPortfolioResult(value.result)
  return result ? { resultRef: value.resultRef, createdAt: value.createdAt,
    caseRef: sfCaseRef(value.caseRef)!, result } : null
}
export function sfReadSensitivityResult(value: unknown): SfSensitivityResultView | null {
  if (!row(value) || !str(value.scenarioRef) || !str(value.parameterRef) ||
    !row(value.bounds) || !finite(value.bounds.minimum) ||
    !finite(value.bounds.maximum) || !Number.isSafeInteger(value.bounds.steps) ||
    !Array.isArray(value.evaluated) || !str(value.unit) ||
    !["complete", "conditioned", "incompatible", "unavailable"].includes(String(value.comparisonStatus)) ||
    !strArray(value.costCoverageRefs) || !Array.isArray(value.unresolvedConditions)) return null
  const items: SfSensitivitySample[] = []
  for (const sample of value.evaluated) {
    if (!row(sample) || !finite(sample.parameterValue) || !str(sample.resultRef) ||
      !(sample.value === null || finite(sample.value))) return null
    items.push({ parameterValue: sample.parameterValue, resultRef: sample.resultRef, value: sample.value as number | null })
  }
  if (!(value.threshold === null || finite(value.threshold)) || !row(value.thresholdEvidence)) return null
  let thresholdEvidence: SfSensitivityResultView["thresholdEvidence"]
  if (value.thresholdEvidence.state === "exact" &&
    finite(value.thresholdEvidence.value) && refs(value.thresholdEvidence.evidenceRefs)) {
    thresholdEvidence = { state: "exact", value: value.thresholdEvidence.value,
      evidenceRefs: refs(value.thresholdEvidence.evidenceRefs)! }
  } else if (value.thresholdEvidence.state === "sampled" && row(value.thresholdEvidence.interval) &&
    finite(value.thresholdEvidence.interval.minimum) && finite(value.thresholdEvidence.interval.maximum) &&
    refs(value.thresholdEvidence.evidenceRefs)) {
    thresholdEvidence = { state: "sampled", interval: {
      minimum: value.thresholdEvidence.interval.minimum, maximum: value.thresholdEvidence.interval.maximum },
      evidenceRefs: refs(value.thresholdEvidence.evidenceRefs)! }
  } else if (value.thresholdEvidence.state === "unavailable" && str(value.thresholdEvidence.reason)) {
    thresholdEvidence = { state: "unavailable", reason: value.thresholdEvidence.reason }
  } else return null
  const conditions: { id: string; reason: string }[] = []
  for (const item of value.unresolvedConditions) {
    if (!row(item) || !str(item.id) || !str(item.reason)) return null
    conditions.push({ id: item.id, reason: item.reason })
  }
  const evidence = refs(value.evidenceRefs)
  if (!evidence) return null
  return { scenarioRef: value.scenarioRef, parameterRef: value.parameterRef,
    bounds: { minimum: value.bounds.minimum, maximum: value.bounds.maximum, steps: value.bounds.steps as number },
    evaluated: items, threshold: value.threshold as number | null, thresholdEvidence,
    unit: value.unit, parameterUnit: str(value.parameterUnit) ? value.parameterUnit : null,
    resultUnit: str(value.resultUnit) ? value.resultUnit : null,
    comparisonStatus: value.comparisonStatus as SfSensitivityResultView["comparisonStatus"],
    costCoverageRefs: value.costCoverageRefs, unresolvedConditions: conditions, evidenceRefs: evidence }
}
export function sfReadRecordedSensitivity(value: unknown): SfRecordedSensitivity | null {
  if (!row(value) || value.kind !== "sensitivity" || !str(value.resultRef) ||
    !str(value.createdAt) || !sfCaseRef(value.caseRef)) return null
  const result = sfReadSensitivityResult(value.result)
  return result ? { resultRef: value.resultRef, createdAt: value.createdAt,
    caseRef: sfCaseRef(value.caseRef)!, result } : null
}
