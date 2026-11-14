import { esc } from "../../src/screen-shell.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainProjection, ProjectionComponent, SourceRef } from "../contracts/context.ts"
import type { FinancialAnalysis } from "../contracts/ports.ts"
import { comparePlannerVersions } from "./version-comparison.ts"

type MetricId = "baselineOutlook" | "candidateOutlook" | "deltaToBase" | "candidateBudget" | "varianceToCandidateBudget" | "officialBudget" | "varianceToOfficialBudget"
type Measure = "outlook" | "budget"
type Input = Pick<DomainProjection["values"][number], "id" | "value" | "currency" | "unit" | "evidenceState"> & { label: string; evidenceRefs: readonly string[] }
type Side = ProjectionComponent & { valueId: string; inputs: readonly Input[]; note: string }
type Selection = { projection: DomainProjection; sides: ReadonlyMap<string, Side> }
type DetailRow = { id: string; recordId: string; period: ProjectionComponent["period"]; before: Side | null; after: Side | null; difference: number | null; value: number | null; state: "present" | "matched" | "added" | "removed" | "incompatible"; explanation: string }

/** Group authorized domain measures; never convert money or substitute outlook for budget. */
export function plannerOverviewDrilldowns(analysis: FinancialAnalysis, official: DomainProjection | undefined, metrics: Record<MetricId, number | null>) {
  const versions = { baseline: analysis.baseline.context.sourceRefs, candidate: analysis.candidate.context.sourceRefs, official: official?.context.sourceRefs ?? [] }
  const baselineOutlook = select(analysis.baseline, "outlook")
  const candidateOutlook = select(analysis.candidate, "outlook")
  const candidateBudget = select(analysis.candidate, "budget")
  const officialBudget = official ? select(official, "budget") : undefined
  const metric = (id: MetricId, label: string, afterLabel: string, after: Selection | undefined, beforeLabel?: string, before?: Selection) => {
    const comparison = before && after ? comparePlannerVersions(before.projection, after.projection) : undefined
    const available = !!after && (!beforeLabel || !!before && comparison?.status === "ok")
    const detailRows: DetailRow[] = !available ? [] : comparison ? comparison.rows.map((row) => ({
      id: row.id, recordId: recordId(row.id, (row.after ?? row.before)!.period), period: (row.after ?? row.before)!.period,
      before: before!.sides.get(row.id) ?? null, after: after!.sides.get(row.id) ?? null,
      difference: row.difference, value: row.difference, state: row.state, explanation: row.explanation,
    })) : [...after!.sides.values()].map((side) => ({ id: side.id, recordId: recordId(side.id, side.period), period: side.period, before: null, after: side, difference: null, value: side.amount, state: "present", explanation: side.note }))
    const records = [...new Set(detailRows.map((row) => row.recordId))].sort().map((id) => {
      const rows = detailRows.filter((row) => row.recordId === id).sort((a, b) => a.period.start.localeCompare(b.period.start) || a.id.localeCompare(b.id))
      return { id, total: sumKnown(rows.map((row) => row.value)), rows }
    })
    const componentTotal = sumKnown(detailRows.map((row) => row.value))
    const composition = { state: !available || metrics[id] === null ? "unavailable" as const : componentTotal === null ? "incomplete" as const : componentTotal === metrics[id] ? "reconciled" as const : "unreconciled" as const, componentTotal }
    return { id, label, total: metrics[id], currency: analysis.candidate.context.currency, period: analysis.candidate.context.period, versions, beforeLabel, afterLabel, available, composition, records }
  }
  return [
    metric("baselineOutlook", "Baseline outlook", "Baseline outlook", baselineOutlook),
    metric("candidateOutlook", "Candidate outlook", "Candidate outlook", candidateOutlook),
    metric("deltaToBase", "Change from baseline", "Candidate outlook", candidateOutlook, "Baseline outlook", baselineOutlook),
    metric("candidateBudget", "Candidate budget", "Candidate budget", candidateBudget),
    metric("varianceToCandidateBudget", "Variance to candidate budget", "Candidate outlook", candidateOutlook, "Candidate budget", candidateBudget),
    metric("officialBudget", "Official budget", "Official budget", officialBudget),
    metric("varianceToOfficialBudget", "Variance to official budget", "Candidate outlook", candidateOutlook, "Official budget", officialBudget),
  ]
}

function select(projection: DomainProjection, measure: Measure): Selection {
  const sides = projection.components.map((component): Side => {
    const bound = component.currency === projection.context.currency && component.period.start >= projection.context.period.start && component.period.end <= projection.context.period.end && component.sourceRefs.length > 0 && component.sourceRefs.every((source) => source.period.start <= component.period.start && source.period.end >= component.period.end && projection.context.sourceRefs.some((expected) => sameSource(source, expected)))
    const value = bound ? projectedValue(projection, component, `${measure}-usd`, true) : undefined
    const amount = measure === "outlook" ? component.amount : value?.value
    const evidenceState = measure === "outlook" ? component.evidenceState : value?.evidenceState ?? "absent"
    const known = bound && evidenceState !== "absent" && typeof amount === "number" && Number.isFinite(amount)
    const inputs = !bound ? [] : (measure === "budget" ? ["budget", "currency-declared"] : ["budget", "actual", "forecast", "currency-declared"]).flatMap((suffix) => {
      const input = projectedValue(projection, component, suffix)
      if (!input) return []
      const label = suffix === "currency-declared" ? "Declared currency" : `Recorded ${suffix}`
      return [{ id: input.id, label, value: input.evidenceState === "absent" ? null : input.value, currency: input.currency, unit: input.unit, evidenceState: input.evidenceState, evidenceRefs: input.sourceRefs.map((ref) => ref.refId) }]
    })
    return { ...component, amount: known && typeof amount === "number" ? amount : null, evidenceState: known ? evidenceState : "absent", sourceRefs: bound ? component.sourceRefs : [], valueId: `${component.id}:${measure}-usd`, inputs, note: !bound ? "Component reference does not match the authorized projection." : measure === "budget" ? value ? "Budget in the projection currency, as published by the Planner." : "The budget value is unavailable or does not match this component, period, currency and source." : "Outlook published by the Planner; source measures do not imply a cause." }
  })
  return { projection: { ...projection, components: sides }, sides: new Map(sides.map((side) => [side.id, side])) }
}

function projectedValue(projection: DomainProjection, component: ProjectionComponent, suffix: string, converted = false) {
  const candidates = projection.values.filter((value) => value.id === `${component.id}:${suffix}`)
  if (candidates.length !== 1) return undefined
  const value = candidates[0]!
  if (value.period.start !== component.period.start || value.period.end !== component.period.end || value.granularity !== "month" || converted && (value.currency !== "USD" || value.currency !== projection.context.currency || value.currency !== component.currency)) return undefined
  if (!value.sourceRefs.length || !value.sourceRefs.every((ref) => evidenceMatches(ref, projection, component)) || !value.drilldown || !value.sourceRefs.some((ref) => ref.refId === value.drilldown!.refId && ref.refDigest === value.drilldown!.refDigest) || !evidenceMatches(value.drilldown, projection, component)) return undefined
  return value
}

function evidenceMatches(ref: BusinessEvidenceRef, projection: DomainProjection, component: ProjectionComponent) {
  if (ref.kind !== "record" || ref.installationId !== projection.context.installationId || ref.projectId !== projection.context.projectId) return false
  return component.sourceRefs.some((source) => ref.target.surface === source.surface && ref.target.recordType === source.type && ref.target.recordId === source.id && ref.target.incarnation === source.incarnation && ref.target.version === source.version && sameFields(ref.target.fields, source.fields) && (!ref.target.period || ref.target.period.start <= component.period.start && ref.target.period.end >= component.period.end))
}

function sameSource(source: SourceRef, expected: SourceRef) {
  return source.surface === expected.surface && source.type === expected.type && source.id === expected.id && source.incarnation === expected.incarnation && source.version === expected.version && source.period.start === expected.period.start && source.period.end === expected.period.end && sameFields(source.fields, expected.fields)
}

function sameFields(left: readonly string[], right: readonly string[]) {
  const sorted = [...right].sort()
  return left.length === sorted.length && [...left].sort().every((field, index) => field === sorted[index])
}

function recordId(id: string, period: ProjectionComponent["period"]) {
  const suffix = `:${Number(period.start.slice(5, 7))}`
  return id.endsWith(suffix) && id.length > suffix.length ? id.slice(0, -suffix.length) : id
}

function sumKnown(values: readonly (number | null)[]) {
  if (!values.length || values.some((value) => value === null || !Number.isFinite(value))) return null
  const total = values.reduce<number>((sum, value) => sum + value!, 0)
  return Number.isFinite(total) ? total : null
}

/** Native disclosure widgets need neither global DOM IDs nor script-created navigation state. */
export function renderPlannerOverviewDrilldowns(drilldowns: ReturnType<typeof plannerOverviewDrilldowns>) {
  const amount = (value: number | null, currency: string) => value === null ? "Unavailable" : `${esc(String(value))} ${esc(currency)}`
  return `<div data-overview-drilldowns>${drilldowns.map((metric) => `<details data-overview-metric="${esc(metric.id)}"><summary>${esc(metric.label)}: ${amount(metric.total, metric.currency)} — inspect records and months</summary>${renderContext(metric)}${renderComposition(metric)}<p>${esc(metric.period.start)} to ${esc(metric.period.end)} · ${esc(metric.currency)}. ${metric.beforeLabel ? `${esc(metric.afterLabel)} minus ${esc(metric.beforeLabel)}.` : esc(metric.afterLabel) + "."}</p>${!metric.available ? '<p>Unavailable: the required authorized version is not present.</p>' : !metric.records.length ? '<p>No authorized contributing records are available.</p>' : metric.records.map((record) => `<details data-overview-record="${esc(record.id)}"><summary>Record ${esc(record.id)} · ${esc(metric.label)} subtotal: ${amount(record.total, metric.currency)}</summary>${renderContext(metric)}<table><caption>${esc(metric.label)} — record ${esc(record.id)} by month</caption><thead><tr><th scope="col">Component and month</th><th scope="col">Period</th>${metric.beforeLabel ? `<th scope="col">Before: ${esc(metric.beforeLabel)}</th>` : ""}<th scope="col">${metric.beforeLabel ? "After: " : ""}${esc(metric.afterLabel)}</th>${metric.beforeLabel ? '<th scope="col">Difference</th>' : ""}<th scope="col">State and explanation</th></tr></thead><tbody>${record.rows.map((row) => `<tr data-overview-component="${esc(row.id)}" data-overview-state="${esc(row.state)}"><th scope="row">${esc(row.id)} · ${esc(row.period.start.slice(0, 7))}</th><td>${esc(row.period.start)} to ${esc(row.period.end)}</td>${metric.beforeLabel ? `<td data-overview-value="before">${renderSide(row.before)}</td>` : ""}<td data-overview-value="after">${renderSide(row.after)}</td>${metric.beforeLabel ? `<td data-overview-value="difference">${amount(row.difference, metric.currency)}</td>` : ""}<td>${esc(row.state)}. ${esc(row.explanation)}</td></tr>`).join("")}</tbody></table></details>`).join("")}${metric.total === null ? '<p>The total is unavailable. Known records are partial observations, not a complete total.</p>' : ""}<p>Not present means that the record is absent from that version. Unavailable means that a present amount or its source cannot be established. Zero remains an observed numeric value; differences do not establish causation.</p></details>`).join("")}</div>`
}

function renderComposition(metric: ReturnType<typeof plannerOverviewDrilldowns>[number]) {
  const descriptions = {
    reconciled: "Composition reconciled: the known component amounts exactly match the published total. Coverage limitations still apply.",
    incomplete: "Composition incomplete: one or more component measures or references are unavailable. The published total is retained.",
    unavailable: "Composition unavailable: the published total or a required authorized version is unavailable. Known records do not establish a complete total.",
    unreconciled: "Composition unreconciled: the component sum does not exactly match the published total. The published total is retained.",
  }
  return `<p data-overview-composition="${esc(metric.composition.state)}">${esc(descriptions[metric.composition.state])}${metric.composition.state === "unreconciled" ? ` Component sum: ${esc(String(metric.composition.componentTotal))} ${esc(metric.currency)}.` : ""}</p>`
}

function renderContext(metric: ReturnType<typeof plannerOverviewDrilldowns>[number]) {
  const identity = (refs: readonly SourceRef[]) => refs.length ? refs.map((ref) => `${referenceText(ref?.id)} · revision ${referenceText(ref?.version, true)}`).join(", ") : "Unavailable"
  return `<p data-overview-context>Baseline: ${identity(metric.versions.baseline)}. Candidate: ${identity(metric.versions.candidate)}. Official: ${identity(metric.versions.official)}. ${esc(metric.period.start)} to ${esc(metric.period.end)} · ${esc(metric.currency)}.</p>`
}

function referenceText(value: unknown, revision = false) {
  if (revision) return typeof value === "number" && Number.isFinite(value) ? esc(String(value)) : "Unavailable"
  return typeof value === "string" && value.trim() ? esc(value) : "Unavailable"
}

function renderSide(side: Side | null) {
  if (!side) return '<span data-overview-presence="not-present">Not present</span>'
  const amount = side.amount === null ? "Unavailable" : `${esc(String(side.amount))} ${esc(side.currency)}`
  const sources = side.sourceRefs.map((ref) => `<li>${referenceText(ref?.surface)} / ${referenceText(ref?.type)} / ${referenceText(ref?.id)} · incarnation ${referenceText(ref?.incarnation)} · revision ${referenceText(ref?.version, true)} · ${referenceText(ref?.period?.start)} to ${referenceText(ref?.period?.end)}</li>`).join("")
  return `<span data-overview-value-id="${esc(side.valueId)}" data-overview-evidence="${esc(side.evidenceState)}">${amount} · ${esc(side.evidenceState)}</span><br><span data-overview-period>${esc(side.period.start)} to ${esc(side.period.end)}</span><details data-overview-source><summary>Inspect source measures and references</summary><p>${esc(side.note)}</p>${side.inputs.length ? `<dl>${side.inputs.map((input) => `<dt>${esc(input.label)}</dt><dd data-overview-input="${esc(input.id)}">${input.value === null ? "Unavailable" : esc(String(input.value))}${input.currency ? " " + esc(input.currency) : input.unit ? " " + esc(input.unit) : ""} · ${esc(input.evidenceState)}<br>Evidence: ${input.evidenceRefs.map(esc).join(", ")}</dd>`).join("")}</dl>` : ""}${sources ? `<ul>${sources}</ul>` : '<p>Source reference unavailable.</p>'}</details>`
}
