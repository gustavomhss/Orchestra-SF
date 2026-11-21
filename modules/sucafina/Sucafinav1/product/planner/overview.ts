import { variance } from "../../src/planner-accounts.ts"
import { esc } from "../../src/screen-shell.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { FinancialAnalysis } from "../contracts/ports.ts"
import { plannerMonthlyPrefix } from "./bi.ts"
import { plannerOverviewDrilldowns, renderPlannerOverviewDrilldowns } from "./overview-drilldown.ts"
import { comparePlannerVersions } from "./version-comparison.ts"

/** Aggregate only the monthly amounts already priced and authorized by the Planner port. */
export function plannerOverview(analysis: FinancialAnalysis, official?: DomainProjection) {
  const differences = comparePlannerVersions(analysis.baseline, analysis.candidate)
  if (differences.status !== "ok") return { status: "unavailable" as const, reason: "incompatible-overview-context" }
  if (official && comparePlannerVersions(official, analysis.candidate).status !== "ok") return { status: "unavailable" as const, reason: "incompatible-official-context" }
  const selected = (projection: DomainProjection, measure: string) => {
    const prefix = plannerMonthlyPrefix(projection.components)
    return projection.values.filter((value) => value.id.startsWith(`${prefix}:`) && value.id.endsWith(`:${measure}`)).sort((a, b) => a.period.start.localeCompare(b.period.start))
  }
  const sum = (values: DomainProjection["values"]) => {
    if (!values.length || values.some((value) => typeof value.value !== "number" || !Number.isFinite(value.value) || value.evidenceState === "absent")) return null
    const total = values.reduce((amount, value) => amount + Number(value.value), 0)
    return Number.isFinite(total) ? total : null
  }
  const delta = (after: number | null, before: number | null) => {
    const amount = after === null || before === null ? null : variance(after, before).value
    return amount !== null && Number.isFinite(amount) ? amount : null
  }
  const budget = sum(selected(analysis.candidate, "budget"))
  const officialBudget = official ? sum(selected(official, "budget")) : null
  const baselineOutlook = sum(selected(analysis.baseline, "outlook"))
  const candidateOutlook = sum(selected(analysis.candidate, "outlook"))
  const metrics = { baselineOutlook, candidateOutlook, deltaToBase: delta(candidateOutlook, baselineOutlook), candidateBudget: budget, varianceToCandidateBudget: delta(candidateOutlook, budget), officialBudget, varianceToOfficialBudget: delta(candidateOutlook, officialBudget) }
  const prefix = plannerMonthlyPrefix(analysis.candidate.components)
  const baselinePrefix = plannerMonthlyPrefix(analysis.baseline.components)
  const monthly = selected(analysis.candidate, "outlook").map((outlook) => {
    const month = Number(outlook.period.start.slice(5, 7))
    const read = (projection: DomainProjection, id: string) => {
      const value = projection.values.find((entry) => entry.id === id)
      return value?.evidenceState !== "absent" && typeof value?.value === "number" && Number.isFinite(value.value) ? value.value : null
    }
    return { period: outlook.period, baselineBudget: read(analysis.baseline, `${baselinePrefix}:${month}:budget`), budget: read(analysis.candidate, `${prefix}:${month}:budget`), baselineActual: read(analysis.baseline, `${baselinePrefix}:${month}:actual`), actual: read(analysis.candidate, `${prefix}:${month}:actual`), baselineOutlook: read(analysis.baseline, `${baselinePrefix}:${month}:outlook`), outlook: read(analysis.candidate, `${prefix}:${month}:outlook`), baselineFte: read(analysis.baseline, `${baselinePrefix}:${month}:fte`), fte: read(analysis.candidate, `${prefix}:${month}:fte`) }
  })
  const assumptions = analysis.baseline.values.flatMap((before) => {
    if (!before.id.startsWith("fx:")) return []
    const after = analysis.candidate.values.find((value) => value.id === before.id)
    return after && (after.value !== before.value || after.evidenceState !== before.evidenceState) ? [{ id: before.id, before: before.value, after: after.value, explanation: "The exchange-rate input changed; the comparison does not attribute the total difference to this input." }] : []
  })
  return { status: "ok" as const, value: {
    context: analysis.candidate.context,
    baselineRefs: analysis.baseline.context.sourceRefs,
    candidateRefs: analysis.candidate.context.sourceRefs,
    officialRefs: official?.context.sourceRefs ?? [],
    metrics,
    drilldowns: plannerOverviewDrilldowns(analysis, official, metrics),
    monthly, components: differences.rows, assumptions,
    coverageState: analysis.comparison.comparisonStatus,
    gaps: analysis.gaps,
    capacityLabel: "Planned FTE; this is not actual availability.",
  } }
}

/** This contribution renders domain output; the host supplies currently authorized projections. */
export function renderPlannerOverview(model: Extract<ReturnType<typeof plannerOverview>, { status: "ok" }>["value"]) {
  const amount = (value: number | null) => value === null ? "Unavailable" : esc(String(value))
  const identity = (refs: DomainProjection["context"]["sourceRefs"]) => refs.map((ref) => `${ref.id} · revision ${ref.version}`).join(", ")
  return `<section data-planner-overview><h2>Version comparison</h2><p>Baseline: ${esc(identity(model.baselineRefs))}. Candidate: ${esc(identity(model.candidateRefs))}. Official: ${model.officialRefs.length ? esc(identity(model.officialRefs)) : "Unavailable"}.</p><p>${esc(model.context.period.start)} to ${esc(model.context.period.end)} · ${esc(model.context.currency)}</p>${renderPlannerOverviewDrilldowns(model.drilldowns)}<p role="status">Cost comparison: ${esc(model.coverageState)}. ${model.gaps.map(esc).join("; ")}</p><p>${esc(model.capacityLabel)}</p><table><caption>Monthly comparison</caption><thead><tr><th scope="col">Month</th><th scope="col">Base budget</th><th scope="col">Candidate budget</th><th scope="col">Base actual</th><th scope="col">Candidate actual</th><th scope="col">Base outlook</th><th scope="col">Candidate outlook</th><th scope="col">Base planned FTE</th><th scope="col">Candidate planned FTE</th></tr></thead><tbody>${model.monthly.map((row) => `<tr><th scope="row">${esc(row.period.start.slice(0, 7))}</th>${[row.baselineBudget, row.budget, row.baselineActual, row.actual, row.baselineOutlook, row.outlook, row.baselineFte, row.fte].map((value) => `<td>${amount(value)}</td>`).join("")}</tr>`).join("")}</tbody></table><table><caption>Changes by record and month</caption><thead><tr><th scope="col">Component</th><th scope="col">State</th><th scope="col">Difference</th><th scope="col">Explanation</th></tr></thead><tbody>${model.components.map((row) => `<tr><th scope="row">${esc(row.id)}</th><td>${esc(row.state)}</td><td>${amount(row.difference)}</td><td>${esc(row.explanation)}</td></tr>`).join("")}</tbody></table>${model.assumptions.length ? `<h3>Changed inputs</h3><ul>${model.assumptions.map((entry) => `<li>${esc(entry.id)}: ${esc(String(entry.before ?? "Unavailable"))} → ${esc(String(entry.after ?? "Unavailable"))}. ${esc(entry.explanation)}</li>`).join("")}</ul>` : ""}</section>`
}
