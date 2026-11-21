import { roleMap } from "../../runtime/admin.ts"
import { object, rows } from "../../runtime/contract.ts"
import { plannerHeadcountInputs } from "../../runtime/planner.ts"
import type { Actor, Snapshot } from "../../runtime/contract.ts"
import { plannerKeys } from "../../src/nav.ts"
import { fteDecember, variance } from "../../src/planner-accounts.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { DomainPortHost, FinancialAnalysis, PlannerPort, PlannerSourceHost, PortResult } from "../contracts/ports.ts"
import type { ForecastCompareRequest } from "../contracts/operations.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import { projectPlanner } from "./adapter.ts"
import { plannerMonthlyPrefix } from "./bi.ts"
import { plannerHrMonthState } from "./headcount-months.ts"
import { plannerActualMonth } from "./actual-presence.ts"
import { plannerCoverageComplete } from "./coverage.ts"
import { simulateScenario } from "./scenario-port.ts"
import type { PlannerScenarioInputs } from "./scenario-port.ts"
import { compareScenarios } from "./scenario-comparison-port.ts"
import type { PlannerCriteriaHost, PlannerScenarioHost } from "./scenario-comparison-port.ts"

// The registry and port hash the same actor-filtered inputs and engine output.
export function projectPlannerSource(snapshot: Snapshot, actor: Actor, versionId: string): Record<string, unknown> | undefined {
  if (!plannerKeys(actor).length) return undefined
  const view = projectPlanner(snapshot, actor, { at: "", id: () => "", directory: [] })
  const version = rows(view.data.versions).find((item) => item.id === versionId)
  if (!version) return undefined
  const rawVersions = Array.isArray(snapshot.data.versions) ? rows(snapshot.data.versions) : Object.entries(object(snapshot.data.versions)).map(([id, value]) => ({ ...object(value), id: object(value).id ?? id }))
  const raw = rawVersions.find((item) => String(item.id ?? "") === versionId)
  const positionInput = object(object(raw).hc).positions
  const originalPositions = rows(positionInput)
  const visiblePositions = rows(object(version.hc).positions)
  const positionIds = originalPositions.map((position) => typeof position.id === "string" || typeof position.id === "number" && Number.isFinite(position.id) ? String(position.id) : "")
  const fteInputsKnown = !!raw && Array.isArray(positionInput) && originalPositions.length === positionInput.length && visiblePositions.length === originalPositions.length && positionIds.every(Boolean) && new Set(positionIds).size === positionIds.length && visiblePositions.every((position) => {
    const original = originalPositions.find((item) => item.id !== undefined && String(item.id) === String(position.id))
    if (!original || typeof original.include !== "boolean") return false
    return !original.include || [original.fte, original.start, original.end].every((value) => typeof value === "number" && Number.isFinite(value))
  })
  const privateAccess = actor.roles.some((role) => ["admin", "hr", "finance"].includes(role))
  const visiblePosition = (position: Record<string, unknown>) => Object.fromEntries(["id", "name", "title", "type", "location", "include", "fte", "start", "end", "domain", "left", "src", "hasRate", "state", "states", "revision"].filter((field) => field in position).map((field) => [field, position[field]]))
  const safe = privateAccess ? version : { ...version, hc: { ...object(version.hc), positions: rows(object(version.hc).positions).map(visiblePosition) }, summary: { ...object(version.summary), positions: rows(object(version.summary).positions).map(visiblePosition) } }
  const summary = object(safe.summary)
  // The legacy policy permits domain aggregates to owners/viewers. Qualify those already
  // calculated amounts privately, retaining only aggregate state after rate redaction.
  const qualification = { ...version, restrictedHr: false, hrMonthStates: undefined, fteInputsKnown, hc: plannerHeadcountInputs(object(raw)) }
  const hrMonthStates = Object.fromEntries(rows(summary.lines).filter((line) => line.synthetic === true).map((line) => [String(line.id), Array.from({ length: 12 }, (_, index) => plannerHrMonthState(qualification, line, index + 1))]))
  return { ...safe, restrictedHr: false, fteInputsKnown, hrMonthStates, sharedEntities: rows(view.data.entities), sharedAllocations: rows(view.data.allocations) }
}

/** Map the authenticated principal to the same actor used by Planner source projections. */
export function plannerSourceActor(snapshot: Snapshot, principal: Awaited<ReturnType<DomainPortHost["authenticate"]>>, principalRef: string): Actor | undefined {
  if (!principal || principal.id !== principalRef || principal.id.startsWith("local:")) return undefined
  const roles = principal.roles.filter((role) => role.surface === "planner").map((role) => role.role)
  const access = object(object(snapshot.data.access)[principal.id])
  return { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((x): x is string => typeof x === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((x): x is string => typeof x === "string") : [] }
}

export function createPlannerPort(input: { host: DomainPortHost; sources: PlannerSourceHost; scenarios?: PlannerScenarioHost; criteria?: PlannerCriteriaHost; scenarioInputs?: PlannerScenarioInputs; evidence?: BusinessContextService; sensitivity?: PlannerPort["evaluateSensitivity"] }): PlannerPort {
  return {
    compareForecast: (request, binding) => compareForecast(input, request, binding),
    simulateScenario: (request, binding) => simulateScenario({ ...input, inputs: input.scenarioInputs, compare: (request, binding) => compareForecast(input, request, binding), project: projectPlannerSource, qualify: buildPlannerFinancialProjection }, request, binding),
    compareScenarios: (request, binding) => input.scenarios ? compareScenarios({ ...input, scenarios: input.scenarios }, request, binding) : Promise.resolve({ status: "unavailable", reason: "scenario-comparison-not-connected" }),
    evaluateSensitivity: input.sensitivity ?? (async () => ({ status: "unavailable", reason: "sensitivity-not-connected" })),
  }
}

async function compareForecast(input: { host: DomainPortHost; sources: PlannerSourceHost }, incoming: ForecastCompareRequest, binding: TrustedDomainContext): Promise<PortResult<FinancialAnalysis>> {
  const parsed = decodeSfOperationInput("sf_forecast_compare", incoming)
  if (!parsed.ok) return { status: "needs-input", reason: "invalid-forecast-input" }
  const request = parsed.value
  if (!(await input.host.revalidate(binding))) return { status: "denied", reason: "invalid-binding" }
  const http = input.host.requestFor(binding)
  if (!http) return { status: "denied", reason: "missing-request" }
  const environment = await input.host.environment(http)
  if (request.currency !== "USD") return { status: "needs-input", reason: "planner-requires-usd" }
  const start = /^(\d{4})-(\d{2})-01$/.exec(request.period.start)
  const end = /^(\d{4})-(\d{2})-(\d{2})$/.exec(request.period.end)
  if (!start || !end || start[1] !== end[1] || Number(start[2]) < 1 || Number(end[2]) > 12 || Number(start[2]) > Number(end[2]) || Number(end[3]) !== new Date(Date.UTC(Number(end[1]), Number(end[2]), 0)).getUTCDate())
    return { status: "needs-input", reason: "period-must-cover-whole-months-in-one-year" }
  const sameSource = request.baseRef === request.candidateRef
  // A self-comparison observes one source per stage. Each later stage still reads
  // again; neither authority nor source results are cached between observations.
  const readPair = async <T>(read: (reference: string) => Promise<T>): Promise<[T, T]> => {
    if (sameSource) { const value = structuredClone(await read(request.baseRef)); return [value, structuredClone(value)] }
    const observe = async (reference: string) => structuredClone(await read(reference))
    return Promise.all([observe(request.baseRef), observe(request.candidateRef)])
  }
  const source = await readPair((reference) => input.sources.resolveForecastSource(reference, binding))
  const failure = source.find((result) => result.status !== "ok")
  if (failure) return failure
  if (source[0].status !== "ok" || source[1].status !== "ok") return { status: "unavailable", reason: "source-unavailable" }
  const selected = structuredClone([source[0].value, source[1].value])
  const evidence = selected.map((entry) => entry.evidence)
  if (evidence.some((ref, index) => ref.refDigest !== digestSfEvidenceRef(ref) || ref.installationId !== binding.binding.installationId || ref.projectId !== binding.binding.projectId || ref.target.surface !== "planner" || ref.target.recordType !== "planner-version" || ref.target.recordId !== selected[index].versionId || !ref.target.period || ref.target.period.start > request.period.start || ref.target.period.end < request.period.end))
    return { status: "denied", reason: "source-scope-mismatch" }
  const coverage = await readPair((reference) => input.sources.resolveForecastCoverage(reference, binding))
  const coverageFailure = coverage.find((entry) => entry.status !== "ok" && entry.status !== "unavailable" && entry.status !== "needs-input")
  if (coverageFailure && coverageFailure.status !== "ok") return coverageFailure
  const read = async () => input.host.persistence.transaction("planner", async (snapshot) => {
    const principal = await input.host.authenticate(http, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
    const actor = plannerSourceActor(snapshot, principal, binding.binding.principalRef)
    if (!actor) return { commit: false, value: undefined }
    if (sameSource) { const projection = projectPlannerSource(snapshot, actor, selected[0]!.versionId); return { commit: false, value: [projection, structuredClone(projection)] } }
    return { commit: false, value: selected.map((item) => projectPlannerSource(snapshot, actor, item.versionId)) }
  })
  const projections = await read()
  if (!projections || projections.some((value) => !value)) return { status: "denied", reason: "source-unavailable" }
  if (projections.some((projection, index) => !projection || digestSfValue(Object.keys(projection).sort()) !== digestSfValue([...evidence[index].target.fields].sort()) || digestSfValue({ versionId: evidence[index].target.recordId, projection }) !== evidence[index].target.projectionDigest)) return { status: "stale", reason: "source-changed" }
  if (projections.some((projection) => projection?.year !== Number(start[1]))) return { status: "needs-input", reason: "period-version-mismatch" }
  const base = buildPlannerFinancialProjection({ projection: projections[0]!, ref: evidence[0], period: request.period, binding, at: environment.at })
  const candidate = sameSource ? structuredClone(base) : buildPlannerFinancialProjection({ projection: projections[1]!, ref: evidence[1], period: request.period, binding, at: environment.at })
  if ([base, candidate].some((projection) => new Set(projection.values.map((value) => value.id)).size !== projection.values.length)) return { status: "unavailable", reason: "duplicate-projection-value-id" }
  const total = (projection: DomainProjection) => projection.components.reduce((sum, item) => sum + (item.amount ?? 0), 0)
  const unknown = [...base.components, ...candidate.components].some((component) => component.amount === null) || [...base.missing, ...candidate.missing].some((entry) => entry.reason === "restricted")
  const delta = unknown ? null : total(candidate) - total(base)
  const difference = delta !== null && Number.isFinite(delta) ? delta : null
  const gaps = [...new Set([...base.missing, ...candidate.missing].map((entry) => `${entry.field}:${entry.reason}`))]
  if (delta !== null && !Number.isFinite(delta)) gaps.push("non-finite-forecast-difference")
  const complete = coverage[0].status === "ok" && coverage[1].status === "ok" && difference !== null &&
    digestSfValue(coverage[0].value.basis) === digestSfValue(coverage[1].value.basis) &&
    plannerCoverageComplete(coverage[0].value.basis, coverage[0].value.assessment, base, evidence[0]) &&
    plannerCoverageComplete(coverage[1].value.basis, coverage[1].value.assessment, candidate, evidence[1])
  if (!complete) gaps.push(coverage.some((entry) => entry.status !== "ok") ? "cost-coverage-unavailable" : "cost-coverage-unresolved-or-source-mismatch")
  const refs = coverage.flatMap((entry) => entry.status === "ok" ? [entry.value.coverageRef] : [])
  const latest = await read()
  if (!(await input.host.revalidate(binding)) || !latest || latest.some((projection, index) => !projection || digestSfValue({ versionId: evidence[index].target.recordId, projection }) !== evidence[index].target.projectionDigest)) return { status: "stale", reason: "source-or-authority-changed" }
  const refreshed = await readPair((reference) => input.sources.resolveForecastSource(reference, binding))
  if (!(await input.host.revalidate(binding)) || refreshed.some((entry, index) => entry.status !== "ok" || entry.value.evidence.refDigest !== evidence[index].refDigest)) return { status: "stale", reason: "source-revoked-or-replaced" }
  const latestCoverage = await readPair((reference) => input.sources.resolveForecastCoverage(reference, binding))
  if (!(await input.host.revalidate(binding)) || latestCoverage.some((entry, index) => digestSfValue(entry) !== digestSfValue(coverage[index]))) return { status: "stale", reason: "coverage-or-authority-changed" }
  const common = { analysisBasis: "domain" as const, domainApplied: true, baseline: base, candidate, sourceRefs: evidence, gaps }
  if (complete && difference !== null) {
    const comparison = { baselineResultRef: request.baseRef, alternativeResultRef: request.candidateRef, costCoverageRefs: refs, criterionResults: [], unresolvedConditions: [], comparisonStatus: "complete" as const, knownDifference: difference, completeDifference: difference }
    return { status: "ok", value: { ...common, comparison, knownDifference: difference, completeDifference: difference, explanation: "Forecast difference is reconciled to the current covered components." } }
  }
  const comparison = { baselineResultRef: request.baseRef, alternativeResultRef: request.candidateRef, costCoverageRefs: refs, criterionResults: [], unresolvedConditions: gaps, comparisonStatus: "conditioned" as const, knownDifference: difference, completeDifference: null }
  return { status: "ok", value: { ...common, comparison, knownDifference: difference, completeDifference: null, explanation: "Forecast difference is conditional on the listed data and coverage limitations." } }
}

export function buildPlannerFinancialProjection(input: { projection: Record<string, unknown>; ref: Extract<BusinessEvidenceRef, { kind: "record" }>; period: ForecastCompareRequest["period"]; binding: TrustedDomainContext; at: string }): DomainProjection {
  const start = /^(\d{4})-(\d{2})-01$/.exec(input.period.start)!
  const end = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.period.end)!
  const sourceRef = { surface: "planner" as const, type: input.ref.target.recordType, id: input.ref.target.recordId, incarnation: input.ref.target.incarnation, version: input.ref.target.version, fields: input.ref.target.fields, period: input.period, observedAt: input.at }
  const summary = object(input.projection.summary)
  const lines = rows(summary.lines)
  const missing: DomainProjection["missing"][number][] = []
  if (input.projection.restrictedHr === true) missing.push({ field: "headcount", reason: "restricted" })
  const values: DomainProjection["values"][number][] = []
  if (Array.isArray(summary.warnings) && summary.warnings.length) missing.push({ field: "currency", reason: "missing-fx" })
  const currencies = [...new Set(lines.map((line) => typeof line.cur === "string" && line.cur ? line.cur : "USD"))]
  for (const currency of currencies) {
    const raw = currency.toUpperCase() === "USD" ? 1 : rows(input.projection.fx).find((rate) => rate.cur === currency)?.rate
    const rate = typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : null
    values.push({ id: `fx:${encodeURIComponent(currency)}`, value: rate, unit: `USD/${currency}`, period: input.period, granularity: "aggregate", sourceRefs: [input.ref], drilldown: input.ref, evidenceState: rate === null ? "absent" : "confirmed" })
  }
  const components = lines.flatMap((line) => {
    const outlook = Array.isArray(line.outlook) ? line.outlook : []
    return outlook.slice(Number(start[2]) - 1, Number(end[2])).map((value, offset) => {
      const month = Number(start[2]) + offset
      const period = { start: `${start[1]}-${String(month).padStart(2, "0")}-01`, end: `${start[1]}-${String(month).padStart(2, "0")}-${String(new Date(Date.UTC(Number(start[1]), month, 0)).getUTCDate()).padStart(2, "0")}` }
      const hr = line.synthetic === true ? plannerHrMonthState(input.projection, line, month) : undefined
      if (hr) {
        missing.push(...hr.budgetMissing.map((reason) => ({ field: `${line.id}:${month}:budget`, reason })))
        missing.push(...hr.outlookMissing.map((reason) => ({ field: `${line.id}:${month}:outlook`, reason })))
      }
      const budget = hr ? hr.budgetUsd : Array.isArray(line.b) && typeof line.b[month - 1] === "number" && Number.isFinite(line.b[month - 1]) ? line.b[month - 1] : null
      const actual = hr ? hr.actualUsd : Array.isArray(line.a) && typeof line.a[month - 1] === "number" && Number.isFinite(line.a[month - 1]) ? line.a[month - 1] : null
      const forecast = hr ? hr.forecastUsd : Array.isArray(line.f) && typeof line.f[month - 1] === "number" && Number.isFinite(line.f[month - 1]) ? line.f[month - 1] : null
      for (const [measure, raw] of [["budget", budget], ["actual", actual], ["forecast", forecast]] as const) values.push({ id: `${line.id}:${month}:${measure}`, value: typeof raw === "number" ? raw : null, currency: typeof line.cur === "string" ? line.cur : "USD", period, granularity: "month", sourceRefs: [input.ref], drilldown: input.ref, evidenceState: typeof raw === "number" ? "confirmed" : "absent" })
      const declaredCurrency = typeof line.cur === "string" && line.cur.trim() ? line.cur : null
      values.push({ id: `${line.id}:${month}:currency-declared`, value: declaredCurrency, period, granularity: "month", sourceRefs: [input.ref], drilldown: input.ref, evidenceState: declaredCurrency === null ? "absent" : "confirmed" })
      for (const measure of ["budget", "actual"] as const) {
        const raw = measure === "budget" ? budget : actual
        const converted = Array.isArray(line[measure]) ? line[measure][month - 1] : null
        const unavailable = hr ? (measure === "budget" ? hr.budgetUsd : hr.actualUsd) === null : raw === null || (Array.isArray(summary.warnings) && summary.warnings.includes(String(line.cur ?? "USD").toUpperCase()))
        const amount = !unavailable && typeof converted === "number" && Number.isFinite(converted) ? converted : null
        values.push({ id: `${line.id}:${month}:${measure}-usd`, value: amount, currency: "USD", period, granularity: "month", sourceRefs: [input.ref], drilldown: input.ref, evidenceState: amount === null ? "absent" : "confirmed" })
      }
      if (month > Number(input.projection.closed) && forecast == null && budget == null) missing.push({ field: `${line.id}:${month}:budget`, reason: "missing" })
      if (month <= Number(input.projection.closed) && actual == null) missing.push({ field: `${line.id}:${month}:actual`, reason: "missing" })
      if (Array.isArray(summary.warnings) && summary.warnings.includes(String(line.cur ?? "USD").toUpperCase())) missing.push({ field: `${line.id}:${month}:fx`, reason: "missing-fx" })
      const unknown = hr ? hr.outlookUsd === null : (month <= Number(input.projection.closed) && actual === null) || (month > Number(input.projection.closed) && forecast === null && budget === null) || (Array.isArray(summary.warnings) && summary.warnings.includes(String(line.cur ?? "USD").toUpperCase()))
      const amount = !unknown && typeof value === "number" && Number.isFinite(value) ? value : null
      const evidenceState = amount === null ? "absent" as const : month > Number(input.projection.closed) && forecast === null ? "estimated" as const : "confirmed" as const
      const budgetUsd = hr ? hr.budgetUsd : Array.isArray(line.budget) && typeof line.budget[month - 1] === "number" && Number.isFinite(line.budget[month - 1]) && budget !== null && !(Array.isArray(summary.warnings) && summary.warnings.includes(String(line.cur ?? "USD").toUpperCase())) ? line.budget[month - 1] : null
      values.push({ id: `${line.id}:${month}:outlook-usd`, value: amount, currency: "USD", period, granularity: "month", sourceRefs: [input.ref], drilldown: input.ref, evidenceState })
      values.push({ id: `${line.id}:${month}:variance-usd`, value: amount === null || budgetUsd === null ? null : variance(amount, budgetUsd).value, currency: "USD", period, granularity: "month", sourceRefs: [input.ref], drilldown: input.ref, evidenceState: budgetUsd === null ? "absent" : evidenceState })
      return { id: `${line.id}:${month}`, amount, currency: "USD", period, sourceRefs: [sourceRef], evidenceState }
    })
  })
  const monthlyPrefix = plannerMonthlyPrefix(components)
  // These monthly totals use the Planner's converted calculations; missing inputs stay unknown.
  for (let month = Number(start[2]); month <= Number(end[2]); month++) {
    const period = { start: `${start[1]}-${String(month).padStart(2, "0")}-01`, end: `${start[1]}-${String(month).padStart(2, "0")}-${String(new Date(Date.UTC(Number(start[1]), month, 0)).getUTCDate()).padStart(2, "0")}` }
    const matching = components.filter((component) => component.period.start === period.start)
    const positionRows = summary.positions
    const positions = rows(positionRows)
    const fteKnown = input.projection.fteInputsKnown === true && Array.isArray(positionRows) && positions.length === positionRows.length && positions.every((position) => typeof position.include === "boolean" && typeof position.fte === "number" && Number.isFinite(position.fte) && typeof position.start === "number" && Number.isFinite(position.start) && typeof position.end === "number" && Number.isFinite(position.end))
    // Shift the requested month to December so the existing FTE selection rule stays authoritative.
    const fte = fteKnown ? fteDecember(positions.map((position) => ({ include: position.include === true, fte: Number(position.fte), start: Number(position.start) + 12 - month, end: Number(position.end) + 12 - month }))) : null
    values.push({ id: `${monthlyPrefix}:${month}:fte`, value: fte, unit: "fte", period, granularity: "month", sourceRefs: [input.ref], drilldown: input.ref, evidenceState: fte === null ? "absent" : "confirmed" })
    const hr = lines.filter((line) => line.synthetic === true)
    const hrKnown = fteKnown && input.projection.restrictedHr !== true && (!positions.some((position) => position.include === true && Number(position.start) <= month && Number(position.end) >= month) || hr.length > 0) && hr.every((line) => plannerHrMonthState(input.projection, line, month).budgetUsd !== null)
    const hrBudget = hrKnown ? hr.reduce((sum, line) => sum + Number((line.budget as number[])[month - 1]), 0) : null
    values.push({ id: `${monthlyPrefix}:${month}:hr-budget`, value: hrBudget, currency: "USD", period, granularity: "month", sourceRefs: [input.ref], drilldown: input.ref, evidenceState: hrBudget === null ? "absent" : "confirmed" })
    for (const measure of ["budget", "actual", "outlook"] as const) {
      if (measure === "actual") {
        const actual = plannerActualMonth(summary, month, input.projection.restrictedHr === true)
        values.push({ id: `${monthlyPrefix}:${month}:actual`, value: actual.value, currency: "USD", period, granularity: "month", sourceRefs: [input.ref], drilldown: input.ref, evidenceState: actual.evidenceState })
        continue
      }
      const totals = Array.isArray(summary[measure]) ? summary[measure] : []
      const unknown = !lines.length || lines.some((line) => {
        if (line.synthetic === true) {
          const hr = plannerHrMonthState(input.projection, line, month)
          return (measure === "budget" ? hr.budgetUsd : hr.outlookUsd) === null
        }
        if (Array.isArray(summary.warnings) && summary.warnings.includes(String(line.cur ?? "USD").toUpperCase())) return true
        if (measure === "outlook") return false
        const raw = line.b
        return !Array.isArray(raw) || typeof raw[month - 1] !== "number" || !Number.isFinite(raw[month - 1])
      }) || measure === "outlook" && (matching.length !== lines.length || matching.some((component) => component.amount === null))
      const value = !unknown && typeof totals[month - 1] === "number" && Number.isFinite(totals[month - 1]) ? totals[month - 1] : null
      values.push({ id: `${monthlyPrefix}:${month}:${measure}`, value, currency: "USD", period, granularity: "month", sourceRefs: [input.ref], drilldown: input.ref, evidenceState: value === null ? "absent" : measure === "outlook" && matching.some((component) => component.evidenceState === "estimated") ? "estimated" : "confirmed" })
    }
  }
  return { context: { installationId: input.binding.binding.installationId, projectId: input.binding.binding.projectId, principalRef: input.binding.binding.principalRef, accessRevision: input.binding.binding.accessRevision, policyVersion: input.binding.binding.policyVersion, surface: "planner", period: input.period, currency: "USD", sourceRefs: [sourceRef], capabilities: ["sf_forecast_compare"] }, version: input.ref.target.version, engineVersion: "planner-runtime-v1", components, values, missing }
}
