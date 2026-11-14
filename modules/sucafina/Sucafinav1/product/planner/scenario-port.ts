import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { SourceRef } from "../contracts/context.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import type { ScenarioRequest } from "../contracts/operations.ts"
import type { DomainPortHost, PlannerPort, PlannerSourceHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { simulatePlannerOperations } from "./scenario.ts"
import { plannerKnownSubtotal } from "../../src/planner-accounts.ts"
import { plannerCoverageComplete } from "./coverage.ts"
import type { buildPlannerFinancialProjection } from "./port.ts"

/** Host resolves the quantifiable value from the currently authorized source, not from model arguments. */
export type PlannerScenarioInputs = {
  resolveAmount: (reference: string, context: TrustedDomainContext) => Promise<PortResult<{ amount: number; currency: string; period: { start: string; end: string }; source: SourceRef; evidence: BusinessEvidenceRef }>>
  verifyAssumption: (assumption: ScenarioRequest["assumptions"][number], context: TrustedDomainContext) => Promise<PortResult<{ fingerprint: string }>>
}

export async function simulateScenario(input: { host: DomainPortHost; sources: PlannerSourceHost; evidence?: BusinessContextService; inputs?: PlannerScenarioInputs; compare: PlannerPort["compareForecast"]; project: (snapshot: Snapshot, actor: Actor, versionId: string) => Record<string, unknown> | undefined; qualify: typeof buildPlannerFinancialProjection }, incoming: ScenarioRequest, binding: TrustedDomainContext): ReturnType<PlannerPort["simulateScenario"]> {
  const parsed = decodeSfOperationInput("sf_scenario_simulate", incoming)
  if (!parsed.ok) return { status: "needs-input", reason: "invalid-scenario-input" }
  const request = parsed.value
  if (!(await input.host.revalidate(binding)) || !input.host.requestFor(binding)) return { status: "denied", reason: "invalid-binding" }
  if (request.assumptions.some((assumption) => assumption.state === "confirmed" && !assumption.evidenceRefs.length)) return { status: "needs-input", reason: "confirmed-assumption-needs-evidence" }
  if (request.assumptions.some((assumption) => assumption.state === "confirmed") && !input.inputs) return { status: "needs-input", reason: "assumption-confirmation-unavailable" }
  const confirmed = request.assumptions.filter((assumption) => assumption.state === "confirmed")
  const confirmations = structuredClone(await Promise.all(confirmed.map((assumption) => input.inputs!.verifyAssumption(assumption, binding))))
  for (const confirmation of confirmations) if (confirmation.status !== "ok") return confirmation
  if (confirmations.some((confirmation) => confirmation.status === "ok" && !confirmation.value.fingerprint.trim())) return { status: "needs-input", reason: "assumption-confirmation-unavailable" }
  if ((request.assumptions.some((assumption) => assumption.evidenceRefs.length) || request.operations.some((operation) => operation.replacementRef)) && !input.evidence) return { status: "unavailable", reason: "evidence-resolver-unavailable" }
  if (request.operations.some((operation) => operation.replacementRef && (!input.inputs || operation.amount !== undefined || !["replace", "include"].includes(operation.kind)))) return { status: "needs-input", reason: "invalid-replacement-reference" }
  const replacements = structuredClone(await Promise.all(request.operations.map((operation) => operation.replacementRef && input.inputs ? input.inputs.resolveAmount(operation.replacementRef, binding) : undefined)))
  for (const replacement of replacements) if (replacement && replacement.status !== "ok") return replacement
  const amountSources = replacements.flatMap((entry) => entry?.status === "ok" ? [entry.value] : [])
  if (amountSources.some((item) => {
    const evidence = item.evidence
    if (!Number.isFinite(item.amount) || !item.currency || evidence.refDigest !== digestSfEvidenceRef(evidence) || evidence.installationId !== binding.binding.installationId || evidence.projectId !== binding.binding.projectId || item.source.period.start !== item.period.start || item.source.period.end !== item.period.end) return true
    if (evidence.kind === "calculation") return evidence.target.currency !== item.currency || evidence.target.period.start !== item.period.start || evidence.target.period.end !== item.period.end || !evidence.target.sourceRefs.some((ref) => ref.kind === "record" && ref.target.surface === item.source.surface && ref.target.recordType === item.source.type && ref.target.recordId === item.source.id && ref.target.incarnation === item.source.incarnation && ref.target.version === item.source.version)
    if (evidence.kind !== "record") return true
    const target = evidence.target
    return target.surface !== item.source.surface || target.recordType !== item.source.type || target.recordId !== item.source.id || target.incarnation !== item.source.incarnation || target.version !== item.source.version || item.source.fields.some((field) => !target.fields.includes(field)) || !target.period || target.period.start > item.source.period.start || target.period.end < item.source.period.end
  })) return { status: "denied", reason: "replacement-evidence-mismatch" }
  if (request.operations.some((operation, index) => {
    const replacement = replacements[index]
    return replacement?.status === "ok" && ((operation.currency !== undefined && operation.currency !== replacement.value.currency) || (operation.period !== undefined && (operation.period.start !== replacement.value.period.start || operation.period.end !== replacement.value.period.end)))
  })) return { status: "needs-input", reason: "replacement-context-mismatch" }
  const evidenceRefs = [...request.assumptions.flatMap((assumption) => assumption.evidenceRefs), ...amountSources.map((item) => item.evidence)].filter((ref, index, refs) => refs.findIndex((other) => other.refDigest === ref.refDigest) === index)
  const checkEvidence = async () => input.evidence ? Promise.all(evidenceRefs.map((ref) => input.evidence!.resolve(ref, binding))) : []
  const admission = await checkEvidence()
  if (admission.some((entry, index) => entry.state !== "fresh" || entry.ref.refDigest !== evidenceRefs[index].refDigest || entry.ref.refDigest !== digestSfEvidenceRef(entry.ref) || entry.accessRevision !== binding.binding.accessRevision)) return { status: "stale", reason: "scenario-evidence-not-current" }
  const operations = request.operations.map((operation, index) => {
    const replacement = replacements[index]
    if (!replacement || replacement.status !== "ok") return operation
    return { ...operation, replacementRef: undefined, amount: replacement.value.amount, currency: replacement.value.currency, period: replacement.value.period }
  })
  const source = structuredClone(await input.sources.resolveForecastSource(request.baseRef, binding))
  if (source.status !== "ok") return source
  const coverage = structuredClone(await input.sources.resolveForecastCoverage(request.baseRef, binding))
  if (coverage.status !== "ok") return coverage
  if (coverage.value.assessment.basisId !== coverage.value.basis.id || coverage.value.assessment.basisVersion !== coverage.value.basis.version || !coverage.value.assessment.evaluatedSourceRefs.some((ref) => ref.kind === "record" && ref.refId === source.value.evidence.refId && ref.refDigest === source.value.evidence.refDigest && ref.target.incarnation === source.value.evidence.target.incarnation && ref.target.version === source.value.evidence.target.version && ref.target.projectionDigest === source.value.evidence.target.projectionDigest)) return { status: "needs-input", reason: "coverage-source-mismatch" }
  const period = coverage.value.assessment.horizon
  const currency = coverage.value.assessment.currency
  const current = structuredClone(await input.compare({ baseRef: request.baseRef, candidateRef: request.baseRef, period, currency }, binding))
  if (current.status !== "ok") return current
  if (current.value.sourceRefs.some((ref) => ref.refDigest !== source.value.evidence.refDigest)) return { status: "stale", reason: "source-changed" }
  const http = input.host.requestFor(binding)
  if (!http || !(await input.host.revalidate(binding))) return { status: "denied", reason: "invalid-binding" }
  const environment = await input.host.environment(http)
  const preview = await input.host.persistence.transaction<ReturnType<typeof simulatePlannerOperations> | { status: "stale" | "denied"; reason: string }>("planner", async (snapshot) => {
    const principal = await input.host.authenticate(http, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
    if (!principal || principal.id !== binding.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: { status: "denied" as const, reason: "principal-unavailable" } }
    const roles = principal.roles.filter((role) => role.surface === "planner").map((role) => role.role)
    const access = object(object(snapshot.data.access)[principal.id])
    const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
    const projection = input.project(snapshot, actor, source.value.versionId)
    if (!projection || digestSfValue({ versionId: source.value.versionId, projection }) !== source.value.evidence.target.projectionDigest) return { commit: false, value: { status: "stale" as const, reason: "source-changed" } }
    return { commit: false, value: simulatePlannerOperations(snapshot, actor, environment, source.value.versionId, operations, (next) => input.project(next, actor, source.value.versionId)) }
  })
  if (preview.status !== "ok") return preview
  if (!preview.projection) return { status: "unavailable", reason: "preview-unavailable" }
  // Qualify the actual post-command copy. A previously absent cell can now have
  // an explicit forecast; missing FX and independent HR budget rates stay visible.
  const financial = input.qualify({ projection: preview.projection, ref: source.value.evidence, period, binding, at: environment.at })
  if (new Set(financial.components.map((component) => component.id)).size !== financial.components.length) return { status: "unavailable", reason: "duplicate-preview-component-id" }
  const changed = new Set(request.operations.flatMap((operation) => operation.kind === "defer" && operation.period ? [operation.targetRef, `${operation.targetRef.slice(0, operation.targetRef.lastIndexOf(":"))}:${Number(operation.period.start.slice(5, 7))}`] : [operation.targetRef]))
  const components = financial.components.map((component) => ({ ...component, evidenceState: component.amount === null ? "absent" as const : changed.has(component.id) ? "hypothetical" as const : component.evidenceState }))
  const rechecked = await input.compare({ baseRef: request.baseRef, candidateRef: request.baseRef, period, currency }, binding)
  const coverageAgain = await input.sources.resolveForecastCoverage(request.baseRef, binding)
  if (rechecked.status !== "ok" || rechecked.value.sourceRefs.some((ref) => ref.refDigest !== source.value.evidence.refDigest) || digestSfValue(coverageAgain) !== digestSfValue(coverage) || !(await input.host.revalidate(binding))) return { status: "stale", reason: "source-or-authority-changed" }
  const confirmationsAgain = await Promise.all(confirmed.map((assumption) => input.inputs!.verifyAssumption(assumption, binding)))
  if (confirmationsAgain.some((entry, index) => digestSfValue(entry) !== digestSfValue(confirmations[index]))) return { status: "stale", reason: "assumption-confirmation-changed" }
  const replacementEgress = await Promise.all(request.operations.map((operation) => operation.replacementRef && input.inputs ? input.inputs.resolveAmount(operation.replacementRef, binding) : undefined))
  const replacementDigest = (entry: (typeof replacements)[number]) => digestSfValue(entry?.status === "ok" ? { ...entry, value: { ...entry.value, source: { ...entry.value.source, observedAt: "" } } } : entry)
  if (replacementEgress.some((entry, index) => replacementDigest(entry) !== replacementDigest(replacements[index]))) return { status: "stale", reason: "replacement-changed" }
  const egress = await checkEvidence()
  if (egress.length !== admission.length || egress.some((entry, index) => entry.state !== "fresh" || entry.ref.refDigest !== admission[index].ref.refDigest || entry.accessRevision !== admission[index].accessRevision) || !(await input.host.revalidate(binding))) return { status: "stale", reason: "scenario-evidence-changed" }
  const knownSubtotal = components.some((component) => component.amount !== null) ? plannerKnownSubtotal(components.map((component) => component.amount)) : null
  if (!request.operations.length && !request.assumptions.length) {
    // A request without hypothetical inputs observes the current source. Financial
    // completeness authenticates that observation; it never executes a choice or command.
    const latestSource = structuredClone(await input.sources.resolveForecastSource(request.baseRef, binding))
    const latestCoverage = structuredClone(await input.sources.resolveForecastCoverage(request.baseRef, binding))
    if (digestSfValue(latestSource) !== digestSfValue(source) || digestSfValue(latestCoverage) !== digestSfValue(coverage) || http.signal.aborted || !await input.host.revalidate(binding)) return { status: "stale", reason: "source-scenario-evidence-changed" }
    const assessment = coverage.value.assessment
    const sourceRefs = [source.value.evidence, ...coverage.value.basis.sourceRefs, ...assessment.evaluatedSourceRefs, ...assessment.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
      .filter((ref, index, refs) => refs.findIndex((other) => other.refDigest === ref.refDigest) === index)
    const observation = { id: `source-scenario:${digestSfValue({ request, source: source.value.evidence.refDigest, assessment })}`, version: current.value.baseline.version, components, knownSubtotal, currency, horizon: period, sourceRefs, restrictions: [] }
    if (knownSubtotal !== null && Number.isFinite(knownSubtotal) && current.value.comparison.comparisonStatus === "complete" && assessment.coverageState === "complete" && plannerCoverageComplete(coverage.value.basis, assessment, current.value.baseline, source.value.evidence)) return { status: "ok", value: { ...observation, knownSubtotal, total: knownSubtotal, costCoverage: assessment, comparisonStatus: "complete", unresolvedConditions: [] } }
    return { status: "ok", value: { ...observation, total: null, costCoverage: assessment, comparisonStatus: "conditioned", unresolvedConditions: [...new Set([...current.value.gaps, ...assessment.issues, ...assessment.entries.flatMap((entry) => entry.status === "pending" ? [`coverage:${entry.categoryId}:${entry.reason}`] : [])])] } }
  }
  const scenarioCoverage = { ...coverage.value.assessment, coverageState: coverage.value.assessment.coverageState === "unavailable" ? "unavailable" as const : "pending" as const, issues: [...coverage.value.assessment.issues, "scenario-coverage-reassessment-required"] }
  const unresolved = [...current.value.gaps, "scenario-is-hypothetical", "scenario-coverage-reassessment-required", ...request.assumptions.map((assumption) => `assumption:${assumption.id}:${assumption.state}:not-applied`)]
  return { status: "ok", value: { id: `preview:${digestSfValue({ request, source: source.value.evidence.refDigest })}`, version: 0, components, knownSubtotal, total: null, currency, horizon: period, sourceRefs: [source.value.evidence, ...evidenceRefs], costCoverage: scenarioCoverage, comparisonStatus: "conditioned", unresolvedConditions: unresolved, restrictions: ["preview-not-applied"] } }
}
