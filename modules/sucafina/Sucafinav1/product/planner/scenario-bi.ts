import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { BiPresentation, DomainProjection, EvidenceState } from "../contracts/context.ts"
import type { ScenarioResult } from "../contracts/decisions.ts"
import type { BiViewRequest } from "../contracts/operations.ts"
import type { DomainPortHost, FinancialAnalysis, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createSfDecisionResultStore } from "../decisions/result-store.ts"
import { sameBiProjection } from "../analytics/projection.ts"
import type { ScenarioBiHost } from "../analytics/scenario.ts"
import { readPortfolioSnapshot } from "../portfolio/read-snapshot.ts"
import { plannerDifferencePresentation } from "./bi-difference.ts"
import { projectionDigest, resolvePlannerScenarioBatch } from "./scenario-comparison-port.ts"
import type { PlannerScenarioHost, ResolvedScenario } from "./scenario-comparison-port.ts"
import { comparePlannerVersions } from "./version-comparison.ts"

type View = { projection: DomainProjection; presentation: BiPresentation }
type Pair = { baseline: ResolvedScenario; candidate: ResolvedScenario }

/** C02 supplies authority/scope; the two C08 results supply the actual scenario components.
 * The existing Planner difference producer owns accumulation. Coverage, totals and the
 * comparison remain the exact C10 outputs, including a conditioned comparison or null total. */
export function plannerScenarioBiPresentation(projection: DomainProjection, pair: Pair, viewId: "BI09" | "BI10"): PortResult<View> {
  const decision = projection.decision
  if (decision?.kind !== "scenario" || digestSfValue(decision.scenario) !== digestSfValue(pair.candidate.result)) return { status: "stale", reason: "scenario-result-mismatch" }
  const results = [pair.baseline.result, pair.candidate.result]
  const projections = [pair.baseline.projection, pair.candidate.projection]
  if (decision.comparison.comparisonStatus === "complete" && results.some((result) => result.comparisonStatus !== "complete" || result.total === null)) return { status: "stale", reason: "scenario-comparison-completeness-mismatch" }
  if (results.some((result) => result.currency !== projection.context.currency || digestSfValue(result.horizon) !== digestSfValue(projection.context.period)) || projections.some((value) =>
    (["installationId", "projectId", "principalRef", "accessRevision", "policyVersion", "surface", "currency"] as const).some((field) => value.context[field] !== projection.context[field]) || digestSfValue(value.context.period) !== digestSfValue(projection.context.period))) return { status: "unavailable", reason: "scenario-projection-scope-mismatch" }
  if (!sameBiProjection({ ...projection, decision: undefined, comparison: undefined }, { ...pair.candidate.projection, decision: undefined, comparison: undefined })) return { status: "stale", reason: "scenario-source-projection-mismatch" }
  if (results.some((result) => result.components.some((component) => component.currency !== result.currency || component.period.start < result.horizon.start || component.period.end > result.horizon.end))) return { status: "ok", value: {
    projection: { ...projection, components: pair.candidate.result.components, values: [] },
    presentation: { viewId, series: [], limitations: ["Os componentes têm moeda ou período incompatível. O resultado canônico permanece na tabela; não há conversão ou acumulação implícita." ] },
  } }
  const sources = uniqueEvidence(results.flatMap((result) => [...result.sourceRefs, ...result.costCoverage.evaluatedSourceRefs, ...result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]))
  const baseline = { ...pair.baseline.projection, components: pair.baseline.result.components }
  const candidate = { ...pair.candidate.projection, components: pair.candidate.result.components, decision, ...(projection.comparison ? { comparison: projection.comparison } : {}) }
  const common = { baseline, candidate, sourceRefs: sources, gaps: [...pair.baseline.result.unresolvedConditions, ...pair.candidate.result.unresolvedConditions, ...decision.comparison.unresolvedConditions], explanation: "Persisted scenario components in the authorized Planner scope.", analysisBasis: "domain" as const, domainApplied: false }
  const comparison = decision.comparison
  const analysis: FinancialAnalysis = comparison.comparisonStatus === "complete"
    ? { ...common, comparison, knownDifference: comparison.knownDifference, completeDifference: comparison.completeDifference }
    : { ...common, comparison, knownDifference: comparison.knownDifference, completeDifference: null }
  const difference = plannerDifferencePresentation(analysis, "BI02")
  if (difference.status !== "ok") return difference
  const derivedSources = sources.filter((ref) => ref.kind !== "record")
  const differenceValues = difference.value.projection.values.map((value) => {
    const refs = uniqueEvidence([...value.sourceRefs, ...derivedSources])
    return { ...value, sourceRefs: refs, drilldown: refs.length === 1 ? refs[0]! : null }
  })
  const state = (result: ScenarioResult, amount: number | null): EvidenceState => amount === null ? "absent" : result.components.some((component) => component.evidenceState === "hypothetical") ? "hypothetical" : result.comparisonStatus !== "complete" || result.components.some((component) => component.evidenceState === "estimated") ? "estimated" : "confirmed"
  const monetary = (id: string, amount: number | null, result: ScenarioResult, refs: readonly BusinessEvidenceRef[] = result.sourceRefs): DomainProjection["values"][number] => ({ id, value: amount, unit: "money", currency: result.currency, period: result.horizon, granularity: "aggregate", sourceRefs: refs, drilldown: refs.length === 1 ? refs[0]! : null, evidenceState: state(result, amount) })
  const canonical = [
    monetary("scenario:baseline-known-subtotal", pair.baseline.result.knownSubtotal, pair.baseline.result),
    monetary("scenario:baseline-complete-total", pair.baseline.result.total, pair.baseline.result),
    monetary("scenario:candidate-known-subtotal", pair.candidate.result.knownSubtotal, pair.candidate.result),
    monetary("scenario:candidate-complete-total", pair.candidate.result.total, pair.candidate.result),
    monetary("scenario:known-difference", comparison.knownDifference, pair.candidate.result, sources),
    monetary("scenario:complete-difference", comparison.completeDifference, pair.candidate.result, sources),
  ]
  const limitations = [...difference.value.presentation.limitations, "Os subtotais conhecidos, totais completos, cobertura e diferenças canônicas permanecem separados. Reconciliação dos componentes não promove cobertura nem uma escolha para aplicada."]
  if (viewId === "BI09") {
    const value = (id: string) => difference.value.projection.values.find((entry) => entry.id === id)?.value
    const compatibleSubtotals = value("difference:baseline") === pair.baseline.result.knownSubtotal && value("difference:candidate-total") === pair.candidate.result.knownSubtotal
    const waterfall = difference.value.presentation.waterfall!
    return { status: "ok", value: {
      projection: { ...difference.value.projection, values: [...differenceValues, ...canonical] },
      presentation: { ...difference.value.presentation, viewId, series: difference.value.presentation.series.map((series) => ({ ...series, label: series.role === "baseline" ? "Subtotal conhecido da base" : series.role === "result" ? "Subtotal conhecido do candidato" : series.label })), limitations,
        waterfall: { ...waterfall, reconciliation: compatibleSubtotals ? waterfall.reconciliation : waterfall.reconciliation === "unavailable" ? "unavailable" : "unreconciled" } },
    } }
  }
  const rows = comparePlannerVersions(baseline, candidate)
  if (rows.status !== "ok") return { status: "unavailable", reason: "scenario-periods-incompatible" }
  const values: DomainProjection["values"][number][] = [...canonical]
  const items: NonNullable<BiPresentation["timeline"]>["items"][number][] = []
  const beforeIds: string[] = [], afterIds: string[] = [], differenceIds: string[] = []
  for (const [index, row] of rows.rows.entries()) {
    if (row.state === "matched" && row.difference === 0) continue
    const refs = uniqueEvidence(sources.filter((ref) => [row.before, row.after].some((component) => component?.sourceRefs.some((source) => ref.kind === "record" && source.surface === ref.target.surface && source.type === ref.target.recordType && source.id === ref.target.recordId && source.incarnation === ref.target.incarnation && source.version === ref.target.version))))
    const evidence = refs.length ? uniqueEvidence([...refs, ...derivedSources]) : sources
    const period = row.after?.period ?? row.before!.period
    const value = (id: string, amount: number | null, result: ScenarioResult) => ({ ...monetary(id, amount, result, evidence), period })
    const before = `scenario:period:${index}:before`, after = `scenario:period:${index}:after`, delta = `scenario:period:${index}:difference`
    // A missing record and an explicitly missing amount stay different in the component table.
    values.push({ ...value(before, row.before?.amount ?? null, pair.baseline.result), period: row.before?.period ?? period }, { ...value(after, row.after?.amount ?? null, pair.candidate.result), period: row.after?.period ?? period }, value(delta, row.difference, pair.candidate.result))
    beforeIds.push(before); afterIds.push(after); differenceIds.push(delta)
    const periods = [row.before?.period, row.after?.period].filter((entry): entry is NonNullable<typeof entry> => !!entry).filter((entry, position, all) => all.findIndex((other) => digestSfValue(other) === digestSfValue(entry)) === position)
    for (const [periodIndex, selected] of periods.entries()) for (const boundary of ["start", "end"] as const) {
      const dateId = `scenario:period:${index}:${periodIndex}:${boundary}`
      const label = `${row.id}: ${boundary === "start" ? "início" : "fim"} do período ${selected.start} – ${selected.end}; diferença ${row.difference === null ? "indisponível" : `${row.difference} ${projection.context.currency}`}`
      const periodStates = [row.before, row.after].filter((component) => component && digestSfValue(component.period) === digestSfValue(selected)).map((component) => component!.evidenceState)
      values.push({ id: dateId, value: selected[boundary], unit: "date", period: selected, granularity: "record", sourceRefs: evidence, drilldown: evidence.length === 1 ? evidence[0]! : null, evidenceState: periodStates.includes("hypothetical") ? "hypothetical" : periodStates.includes("estimated") ? "estimated" : "confirmed" })
      items.push({ label, dateValueId: dateId, state: "unknown" })
    }
  }
  return { status: "ok", value: { projection: { ...candidate, values }, presentation: { viewId, series: [
    { id: "period-before", label: "Custo por período na base", role: "baseline", unit: projection.context.currency, valueIds: beforeIds },
    { id: "period-after", label: "Custo por período no candidato", role: "result", unit: projection.context.currency, valueIds: afterIds },
    { id: "period-difference", label: "Diferença calculada por componente e período", role: "contribution", unit: projection.context.currency, valueIds: differenceIds },
  ], limitations: [...limitations, "A linha mostra limites dos períodos explícitos dos componentes calculados. Vencimentos, pagamentos, juros e efeitos contratuais exigem suas próprias fontes e regras; adiar um valor não elimina a obrigação."], timeline: { items } } } }
}

/** Wrap the existing C08 selection reader with the real paired Planner producer.
 * The read-only LocalStore scope covers all callbacks and final authorization. No
 * result is cached between invocations, and the source host still owns selection. */
export function createPlannerScenarioBiHost(input: {
  host: DomainPortHost
  results: Pick<ReturnType<typeof createSfDecisionResultStore>, "read">
  scenarios: PlannerScenarioHost
  scenario: ScenarioBiHost
}): ScenarioBiHost {
  const readView = (incoming: BiViewRequest, context: TrustedDomainContext): Promise<PortResult<View>> => readPortfolioSnapshot<PortResult<View>>(input.host, context, incoming, async () => {
    const request = structuredClone(incoming)
    if (request.viewId !== "BI09" && request.viewId !== "BI10") return { status: "unavailable", reason: "unsupported-scenario-plan" }
    if (!await input.host.revalidate(context)) return { status: "denied", reason: "scenario-plan-authority-unavailable" }
    const readSource = async () => {
      const forwarded = structuredClone(request), digest = digestSfValue(forwarded)
      const observed = structuredClone(await input.scenario.readView(forwarded, context))
      return digestSfValue(forwarded) === digest ? observed : { status: "stale" as const, reason: "scenario-plan-selection-changed" }
    }
    const source = await readSource()
    if (source.status !== "ok") return source
    const projection = source.value.projection, decision = projection.decision
    if (decision?.kind !== "scenario" || decision.comparison.alternativeResultRef !== decision.scenarioResultRef || decision.comparison.baselineResultRef === decision.scenarioResultRef) return { status: "stale", reason: "scenario-plan-pair-mismatch" }
    if ((["installationId", "projectId", "principalRef", "accessRevision", "policyVersion"] as const).some((field) => projection.context[field] !== context.binding[field]) || digestSfValue(projection.context.period) !== digestSfValue(request.period)) return { status: "denied", reason: "scenario-plan-context-mismatch" }
    const references = [decision.comparison.baselineResultRef, decision.scenarioResultRef]
    const observe = async (): Promise<PortResult<Pair>> => {
      const first = structuredClone(await input.results.read({ kind: "scenario", resultRef: references[0]! }, context))
      if (first.status !== "ok") return first
      const second = structuredClone(await input.results.read({ kind: "scenario", resultRef: references[1]! }, context))
      if (second.status !== "ok") return second
      if (first.value.kind !== "scenario" || second.value.kind !== "scenario" || first.value.resultRef !== references[0] || second.value.resultRef !== references[1] || digestSfValue(first.value.caseRef) !== digestSfValue(second.value.caseRef) || digestSfValue(second.value.result) !== digestSfValue(decision.scenario)) return { status: "stale", reason: "scenario-plan-case-mismatch" }
      const resolved = await resolvePlannerScenarioBatch(input.scenarios, references, context)
      if (resolved.length !== 2) return { status: "unavailable", reason: "scenario-plan-pair-unavailable" }
      const baseline = resolved[0]!, candidate = resolved[1]!
      if (baseline.status !== "ok") return baseline
      if (candidate.status !== "ok") return candidate
      if (digestSfValue(baseline.value.result) !== digestSfValue(first.value.result) || digestSfValue(candidate.value.result) !== digestSfValue(second.value.result)) return { status: "stale", reason: "scenario-plan-results-changed" }
      return { status: "ok", value: { baseline: baseline.value, candidate: candidate.value } }
    }
    const pair = await observe()
    if (pair.status !== "ok") return pair
    const projected = plannerScenarioBiPresentation(projection, pair.value, request.viewId)
    if (projected.status !== "ok") return projected
    const again = await readSource()
    if (again.status !== "ok") return again
    const latest = await observe()
    if (latest.status !== "ok") return latest
    const stamp = (value: Pair) => digestSfValue(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, { ...entry, projection: projectionDigest(entry.projection) }])))
    if (!sameBiProjection(projection, again.value.projection) || stamp(pair.value) !== stamp(latest.value)) return { status: "stale", reason: "scenario-plan-observation-changed" }
    return projected
  }, { status: "denied", reason: "scenario-plan-read-scope-unavailable" })
  return {
    readView,
    async revalidate(request, context, projection) {
      if (!projection) return input.host.revalidate(context)
      const observed = await readView(structuredClone(request), context)
      return observed.status === "ok" && sameBiProjection(observed.value.projection, projection)
    },
  }
}

function uniqueEvidence(refs: readonly BusinessEvidenceRef[]) {
  return refs.filter((ref, index) => refs.findIndex((other) => digestSfValue(other) === digestSfValue(ref)) === index)
}
