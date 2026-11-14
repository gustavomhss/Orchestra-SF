import { variance } from "../../src/planner-accounts.ts"
import type { BiPresentation } from "../analytics/semantics.ts"
import type { DomainProjection, EvidenceState } from "../contracts/context.ts"
import type { FinancialAnalysis } from "../contracts/ports.ts"
import { comparePlannerVersions } from "./version-comparison.ts"

/** Project Planner-owned endpoints and contributions; no business cause is inferred. */
export function plannerDifferencePresentation(analysis: FinancialAnalysis, viewId: "BI02" | "BI03") {
  const comparison = comparePlannerVersions(analysis.baseline, analysis.candidate)
  if (comparison.status !== "ok") return { status: "unavailable", reason: "incompatible-planner-projections" } as const
  const sources = analysis.sourceRefs
  if (!sources.length) return { status: "unavailable", reason: "missing-planner-evidence" } as const
  const context = analysis.candidate.context
  const states = [...analysis.baseline.components, ...analysis.candidate.components].map((component) => component.evidenceState)
  const evidence: EvidenceState = analysis.analysisBasis === "import-preview" || states.includes("hypothetical") ? "hypothetical" : states.includes("estimated") ? "estimated" : "confirmed"
  const total = (projection: DomainProjection) => {
    if (!projection.components.length || projection.components.some((component) => component.amount === null || !Number.isFinite(component.amount) || component.evidenceState === "absent")) return null
    const value = projection.components.reduce((sum, component) => sum + component.amount!, 0)
    return Number.isFinite(value) ? value : null
  }
  const value = (id: string, amount: number | null, refs = sources) => ({ id, value: amount, currency: context.currency, period: context.period, granularity: "aggregate" as const, sourceRefs: refs, drilldown: refs.length === 1 ? refs[0]! : null, evidenceState: amount === null ? "absent" as const : evidence })
  const baseline = total(analysis.baseline)
  const candidate = total(analysis.candidate)
  const values: DomainProjection["values"][number][] = [value("difference:baseline", baseline)]
  const segments: NonNullable<BiPresentation["waterfall"]>["segments"][number][] = []
  const contributionIds: string[] = []
  let priorId = "difference:baseline"
  let running = baseline
  for (const [index, row] of comparison.rows.entries()) {
    const amount = row.before?.evidenceState === "absent" || row.after?.evidenceState === "absent" ? null : row.difference
    const next = running === null || amount === null ? null : running + amount
    const end = next !== null && Number.isFinite(next) ? next : null
    const id = `difference:component:${index}`
    const endId = `difference:end:${index}`
    const rowRefs = sources.filter((ref) => [row.before, row.after].some((component) => component?.sourceRefs.some((source) => ref.kind === "record" && source.surface === ref.target.surface && source.type === ref.target.recordType && source.id === ref.target.recordId && source.incarnation === ref.target.incarnation && source.version === ref.target.version)))
    values.push(value(id, amount, rowRefs.length ? rowRefs : sources), value(endId, end))
    contributionIds.push(id)
    segments.push({ label: row.id, startValueId: priorId, endValueId: endId, componentValueId: id })
    priorId = endId
    running = end
  }
  values.push(value("difference:candidate-total", candidate))
  const reconciliation = baseline === null || candidate === null || running === null || !segments.length ? "unavailable" as const : running === candidate && analysis.knownDifference !== null && Number.isFinite(variance(candidate, baseline).value) && variance(candidate, baseline).value === analysis.knownDifference ? "reconciled" as const : "unreconciled" as const
  const projection: DomainProjection = { ...analysis.candidate, values }
  const presentation: BiPresentation = {
    viewId,
    series: [
      { id: "version-baseline", label: "Base", unit: context.currency, role: "baseline", valueIds: ["difference:baseline"] },
      { id: "version-contributions", label: "Contribuições por componente", unit: context.currency, role: "contribution", valueIds: contributionIds },
      { id: "version-candidate", label: "Total candidato", unit: context.currency, role: "result", valueIds: ["difference:candidate-total"] },
    ],
    limitations: ["Inclusões e remoções permanecem identificadas pela identidade do registro; valores desconhecidos permanecem ausentes e não se infere uma causa para a diferença.", "A reconciliação financeira não confirma cobertura completa dos custos."],
    waterfall: { segments, finalValueId: "difference:candidate-total", reconciliation },
  }
  return { status: "ok", value: { projection, presentation } } as const
}
