import { roleMap } from "../../runtime/admin.ts"
import { object, rows, text } from "../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../runtime/contract.ts"
import { domain } from "../../runtime/procurement.ts"
import { procurementKeys } from "../../src/nav.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ProductContext, ProjectionComponent } from "../contracts/context.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../contracts/decisions.ts"
import type { CostCoverageAssessment, CostCoverageBasis, ScenarioResult } from "../contracts/decisions.ts"
import type { ScenarioRequest } from "../contracts/operations.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import { assessCostCoverage } from "../decisions/cost-coverage.ts"
import { sfScopedSourceIdentity } from "../integration/source-lifecycle.ts"
import type { SfSourceScope } from "../integration/source-lifecycle.ts"
import { PROCUREMENT_MONETARY_RULE_VERSION, procurementMonetaryFacts } from "./monetary.ts"
import { createProcurementPort } from "./port.ts"
import { projectProcurementScope } from "./source-projection.ts"
import { digestProcurementSource } from "./sources.ts"
import type { createProcurementSourceResolver } from "./sources.ts"

export const PROCUREMENT_SCENARIO_PRODUCER = "procurement-requisition-scenario-v1"
const coveragePrefix = "sf-procurement-coverage:"

export type ProcurementScenarioPreview = {
  scenario: ScenarioResult
  basis: CostCoverageBasis
  assessment: CostCoverageAssessment
  coverageRef: string
  producer: { id: string; calculator: string; unit: "currency"; requestDigest: string; sourceDigest: string; domainRevision: number }
}

type ProcurementScenarioSource = { evidence: Extract<BusinessEvidenceRef, { kind: "record" }>; context: ProductContext; scope: SfSourceScope }

/** Resolves only an already issued scope. A stale read cannot issue or refresh one. */
export function createProcurementReadonlySourceResolver(input: { host: DomainPortHost }) {
  const isCurrent = (snapshot: Snapshot, evidence: ProcurementScenarioSource["evidence"]) => {
    if (evidence.refDigest !== digestSfEvidenceRef(evidence) || evidence.target.surface !== "procurement" || evidence.target.recordType !== "procurement-request" || evidence.refId !== `sf-procurement:${encodeURIComponent(evidence.target.incarnation)}:${evidence.target.version}`) return false
    const matches = Object.values(snapshot.sfSources?.scopes ?? {}).filter((entry) => entry.alive && entry.incarnation === evidence.target.incarnation && entry.version === evidence.target.version && entry.scope.recordType === evidence.target.recordType && entry.scope.recordId === evidence.target.recordId)
    if (matches.length !== 1) return false
    const scope = matches[0]!.scope
    const identity = sfScopedSourceIdentity(snapshot, scope)
    const projection = projectProcurementScope("procurement", snapshot, scope)
    return !!identity && identity.incarnation === evidence.target.incarnation && identity.version === evidence.target.version && identity.inputDigest === digestSfValue(projection) && object(projection).privateDependencyDigest === evidence.target.projectionDigest && digestSfValue(object(scope.selector).fields) === digestSfValue(evidence.target.fields) && digestSfValue(object(scope.selector).period) === digestSfValue(evidence.target.period)
  }
  const resolveSource = async (ref: string, binding: TrustedDomainContext): Promise<PortResult<ProcurementScenarioSource>> => {
    const parts = /^sf-procurement:([^:]+):([1-9]\d*)$/.exec(ref)
    if (!parts || !Number.isSafeInteger(Number(parts[2]))) return { status: "unavailable", reason: "procurement-source-unavailable" }
    const incarnation = decodeProcurementIncarnation(parts[1]!)
    const request = input.host.requestFor(binding)
    if (!incarnation) return { status: "unavailable", reason: "procurement-source-unavailable" }
    if (!request || request.signal.aborted || !await input.host.revalidate(binding)) return { status: "denied", reason: "current-authority-unavailable" }
    const read = () => input.host.persistence.transaction<PortResult<ProcurementScenarioSource>>("procurement", async (snapshot) => {
      const principal = await input.host.authenticate(request, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
      if (!principal || principal.id !== binding.binding.principalRef || principal.id.startsWith("local:") || request.signal.aborted) return { commit: false, value: { status: "denied", reason: "current-authority-unavailable" } }
      const roles = principal.roles.filter((role) => role.surface === "procurement").map((role) => role.role)
      if (!procurementKeys({ roles }).length) return { commit: false, value: { status: "denied", reason: "current-authority-unavailable" } }
      const matches = Object.values(snapshot.sfSources?.scopes ?? {}).filter((entry) => entry.alive && entry.incarnation === incarnation)
      if (matches.length !== 1) return { commit: false, value: { status: "unavailable", reason: "procurement-source-unavailable" } }
      const entry = matches[0]!
      if (entry.version !== Number(parts[2])) return { commit: false, value: { status: "stale", reason: "requisition-source-changed" } }
      const scope = entry.scope
      const selected = object(scope.selector)
      if (scope.principalRef !== binding.binding.principalRef || scope.accessRevision !== binding.binding.accessRevision || scope.policyVersion !== binding.binding.policyVersion || scope.recordType !== "procurement-request" || !isSfPeriod(selected.period) || typeof selected.currency !== "string" || !/^[A-Z]{3}$/.test(selected.currency) || !Array.isArray(selected.fields) || !selected.fields.every((field): field is string => typeof field === "string") || !selected.fields.includes("originalAmount")) return { commit: false, value: { status: "denied", reason: "procurement-source-authority-mismatch" } }
      const selector = { kind: "procurement-record-v1", roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), roleMapDigest: digestSfValue(roleMap(snapshot, "procurement")), fields: selected.fields, period: selected.period, currency: selected.currency }
      if (digestSfValue(selector) !== digestSfValue(scope.selector)) return { commit: false, value: { status: "denied", reason: "procurement-source-authority-mismatch" } }
      const identity = sfScopedSourceIdentity(snapshot, scope)
      const projection = object(projectProcurementScope("procurement", snapshot, scope))
      if (!identity || identity.incarnation !== incarnation || identity.version !== entry.version || identity.inputDigest !== digestSfValue(projection) || projection.id !== scope.recordId || typeof projection.privateDependencyDigest !== "string" || !/^[a-f0-9]{64}$/.test(projection.privateDependencyDigest)) return { commit: false, value: { status: "stale", reason: "requisition-source-changed" } }
      const evidence: ProcurementScenarioSource["evidence"] = { schema: "sf-evidence-v1", kind: "record", refId: ref, installationId: binding.binding.installationId, projectId: binding.binding.projectId, refDigest: "", evidenceLevel: "observed", target: { surface: "procurement", recordType: scope.recordType, recordId: scope.recordId, incarnation, version: entry.version, fields: selected.fields, period: selected.period, projectionDigest: projection.privateDependencyDigest } }
      // Period belongs to the issued source scope; the adapter also fences the current case horizon.
      const context: ProductContext = { installationId: binding.binding.installationId, projectId: binding.binding.projectId, principalRef: binding.binding.principalRef, accessRevision: binding.binding.accessRevision, policyVersion: binding.binding.policyVersion, surface: "procurement", period: selected.period, currency: selected.currency, sourceRefs: [], capabilities: [] }
      return { commit: false, value: { status: "ok", value: structuredClone({ evidence: { ...evidence, refDigest: digestSfEvidenceRef(evidence) }, context, scope }) } }
    }, { signal: request.signal })
    const current = await read()
    if (current.status !== "ok") return current
    const again = await read()
    if (again.status === "denied" || request.signal.aborted || input.host.requestFor(binding) !== request || !await input.host.revalidate(binding)) return { status: "denied", reason: "current-authority-unavailable" }
    if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(current.value)) return { status: "stale", reason: "requisition-source-changed" }
    return current
  }
  const unavailable = async (): Promise<PortResult<never>> => ({ status: "unavailable", reason: "procurement-scenario-request-only" })
  const port = createProcurementPort({ ...input.host, resolveRequestSource: resolveSource, isCurrentRequestSource: isCurrent, resolveRequestCollection: unavailable, isCurrentRequestCollection: () => false, resolveSupplierSource: unavailable, isCurrentSupplierSource: () => false, readContractSource: unavailable })
  return { resolveSource, isCurrent, readProjection: (ref: string, binding: TrustedDomainContext) => port.read({ requestRef: ref }, binding) }
}

/** Quantifies a PR hypothesis without executing, preparing, or reverting a domain command. */
export function createProcurementScenarioProducer(input: { host: DomainPortHost; sources: ReturnType<typeof createProcurementSourceResolver> }) {
  const sourceReader = createProcurementReadonlySourceResolver({ host: input.host })
  const supports = (request: ScenarioRequest) => typeof request.baseRef === "string" && request.baseRef.startsWith("sf-procurement:")
  const preview = async (incoming: ScenarioRequest, binding: TrustedDomainContext): Promise<PortResult<ProcurementScenarioPreview>> => {
    const parsed = decodeSfOperationInput("sf_scenario_simulate", incoming)
    if (!parsed.ok || !supports(parsed.value) || parsed.value.operations.length > 1) return { status: "needs-input", reason: "invalid-procurement-scenario" }
    const selected = structuredClone(parsed.value)
    const inventory = selected.assumptions
    if (inventory.length !== 1 || inventory[0]?.id !== "procurement-cost-inventory" || inventory[0].value !== "renewal-transition-v1" || inventory[0].state !== "hypothetical" || inventory[0].evidenceRefs.length) return { status: "needs-input", reason: "explicit-procurement-cost-inventory-required" }
    const operation = selected.operations[0]
    if (operation && (operation.kind !== "replace" || operation.targetRef !== selected.baseRef || operation.replacementRef !== undefined || typeof operation.amount !== "number" || !Number.isFinite(operation.amount) || operation.amount < 0 || !operation.currency || !operation.period)) return { status: "needs-input", reason: "explicit-requisition-amount-required" }
    const request = input.host.requestFor(binding)
    if (!request || !await input.host.revalidate(binding)) return { status: "denied", reason: "current-authority-unavailable" }
    const source = await sourceReader.resolveSource(selected.baseRef, binding)
    if (source.status !== "ok") return source
    const evidence = source.value.evidence
    const context = source.value.context
    if (evidence.kind !== "record" || evidence.target.surface !== "procurement" || evidence.target.recordType !== "procurement-request" || evidence.refId !== selected.baseRef || evidence.refDigest !== digestSfEvidenceRef(evidence) || !evidence.target.fields.includes("originalAmount") || evidence.installationId !== binding.binding.installationId || evidence.projectId !== binding.binding.projectId || context.principalRef !== binding.binding.principalRef || context.policyVersion !== binding.binding.policyVersion || context.accessRevision !== binding.binding.accessRevision) return { status: "denied", reason: "procurement-source-authority-mismatch" }
    if (operation && (operation.currency !== context.currency || digestSfValue(operation.period) !== digestSfValue(context.period))) return { status: "needs-input", reason: "requisition-basis-mismatch" }
    const environment = await input.host.environment(request)
    if (!Number.isFinite(Date.parse(environment.at))) return { status: "unavailable", reason: "observation-time-unavailable" }
    const observed = await input.host.persistence.transaction<PortResult<{ amount: number | null; domainRevision: number }>>("procurement", async (snapshot) => {
      const principal = await input.host.authenticate(request, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
      if (!principal || principal.id !== binding.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: { status: "denied", reason: "current-authority-unavailable" } }
      const roles = principal.roles.filter((role) => role.surface === "procurement").map((role) => role.role)
      if (!procurementKeys({ roles }).length) return { commit: false, value: { status: "denied", reason: "current-authority-unavailable" } }
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: [], domains: [] }
      const view = domain.view(snapshot, actor, environment)
      const records = rows(view.data.requests).filter((row) => row.number === evidence.target.recordId)
      if (records.length !== 1) return { commit: false, value: { status: "unavailable", reason: "requisition-unavailable" } }
      const record = records[0]!
      if (!sourceReader.isCurrent(snapshot, evidence) || digestProcurementSource(record, view.data.formSettings) !== evidence.target.projectionDigest || text(object(view.data.formSettings).currency) !== context.currency) return { commit: false, value: { status: "stale", reason: "requisition-source-changed" } }
      if (!["draft", "pr_rejected"].includes(text(record.status))) return { commit: false, value: { status: "needs-input", reason: "requisition-stage-not-editable" } }
      const current = procurementMonetaryFacts(record, context.currency, view.data.formSettings)
      if (!Object.hasOwn(current.amountInput, "estimate") || current.currency !== context.currency) return { commit: false, value: { status: "needs-input", reason: "requisition-basis-mismatch" } }
      // A supplied proposal must not conceal a missing or unconvertible source.
      if (operation && current.baseAmount === null) return { commit: false, value: { status: "needs-input", reason: "procurement-source-cost-unavailable" } }
      const hypothetical = operation ? { ...structuredClone(record), pr: { ...structuredClone(object(record.pr)), estAmount: operation.amount } } : record
      const money = procurementMonetaryFacts(hypothetical, context.currency, view.data.formSettings)
      if (operation && (money.baseAmount !== operation.amount || money.original !== operation.amount || money.currency !== operation.currency)) return { commit: false, value: { status: "needs-input", reason: "requisition-calculation-unavailable" } }
      const domainRevision = snapshot.versions[`requests:${evidence.target.recordId}`]?.version ?? 0
      if (!Number.isSafeInteger(domainRevision) || domainRevision < 0) return { commit: false, value: { status: "unavailable", reason: "requisition-version-unavailable" } }
      return { commit: false, value: { status: "ok", value: { amount: money.baseAmount, domainRevision } } }
    }, { signal: request.signal })
    if (observed.status !== "ok") return observed
    const again = await sourceReader.resolveSource(selected.baseRef, binding)
    if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(source.value) || !await input.host.revalidate(binding)) return { status: "stale", reason: "requisition-source-changed" }
    const identity = { producer: PROCUREMENT_SCENARIO_PRODUCER, calculator: PROCUREMENT_MONETARY_RULE_VERSION, request: selected, source: evidence, authority: { installationId: binding.binding.installationId, projectId: binding.binding.projectId, principalRef: binding.binding.principalRef, policyVersion: binding.binding.policyVersion, accessRevision: binding.binding.accessRevision }, domainRevision: observed.value.domainRevision }
    const sourceRef = { surface: "procurement" as const, type: evidence.target.recordType, id: evidence.target.recordId, incarnation: evidence.target.incarnation, version: evidence.target.version, fields: ["originalAmount"], period: context.period, observedAt: environment.at }
    const components: readonly ProjectionComponent[] = [{ id: `procurement:${encodeURIComponent(evidence.target.recordId)}:PR.estAmount`, amount: observed.value.amount, currency: context.currency, period: context.period, sourceRefs: [sourceRef], evidenceState: observed.value.amount === null ? "absent" : operation ? "hypothetical" : "estimated" }]
    const basis: CostCoverageBasis = { id: `procurement-coverage:${digestSfValue({ source: evidence, currency: context.currency, period: context.period, inventory })}`, version: evidence.target.version, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], sourceRefs: [evidence], additionalCategoryIds: [] }
    // A PR estimate does not classify nine renewal/transition cost categories.
    // The canonical assessor derives every omitted category as pending.
    const assessment = assessCostCoverage({ basis, alternativeId: `procurement-alternative:${digestSfValue(identity)}`, alternativeVersion: 1, currency: context.currency, horizon: context.period, entries: [], components, evidence: [{ state: "fresh", ref: evidence, accessRevision: binding.binding.accessRevision, checkedAt: environment.at }], supports: () => false })
    const scenario: ScenarioResult = { id: `procurement-scenario:${digestSfValue(identity)}`, version: 1, components, knownSubtotal: observed.value.amount, total: null, currency: context.currency, horizon: context.period, sourceRefs: [evidence], costCoverage: assessment, comparisonStatus: "conditioned", unresolvedConditions: ["inventory-scope-hypothetical", ...assessment.derivedMissingCategoryIds.map((category) => `missing-category:${category}`), ...assessment.issues, ...(observed.value.amount === null ? ["procurement-source-cost-unavailable"] : []), ...(operation ? ["scenario-is-hypothetical"] : ["requisition-estimate-not-approved"]), "financial-approval-command-unavailable"], restrictions: ["preview-not-applied", "procurement-only-no-planner-allocation", "unit:currency", `producer:${PROCUREMENT_SCENARIO_PRODUCER}`, `calculator:${PROCUREMENT_MONETARY_RULE_VERSION}`] }
    return { status: "ok", value: { scenario, basis, assessment, coverageRef: `${coveragePrefix}${encodeURIComponent(JSON.stringify(selected))}`, producer: { id: PROCUREMENT_SCENARIO_PRODUCER, calculator: PROCUREMENT_MONETARY_RULE_VERSION, unit: "currency", requestDigest: digestSfValue(selected), sourceDigest: evidence.refDigest, domainRevision: observed.value.domainRevision } } }
  }
  return {
    supports,
    preview,
    resolveSource: sourceReader.resolveSource,
    readProjection: sourceReader.readProjection,
    async simulateScenario(request: ScenarioRequest, binding: TrustedDomainContext): Promise<PortResult<ScenarioResult>> {
      const result = await preview(request, binding)
      return result.status === "ok" ? { status: "ok", value: result.value.scenario } : result
    },
    async resolveForecastCoverage(ref: string, binding: TrustedDomainContext): Promise<PortResult<{ coverageRef: string; basis: CostCoverageBasis; assessment: CostCoverageAssessment }>> {
      const request = procurementCoverageRequest(ref)
      if (!request) return { status: "unavailable", reason: "procurement-coverage-unavailable" }
      const result = await preview(request, binding)
      if (result.status !== "ok") return result
      if (result.value.coverageRef !== ref) return { status: "needs-input", reason: "noncanonical-procurement-coverage" }
      return { status: "ok", value: { coverageRef: ref, basis: result.value.basis, assessment: result.value.assessment } }
    },
  }
}

function decodeProcurementIncarnation(value: string) {
  try {
    const decoded = decodeURIComponent(value)
    return decoded && encodeURIComponent(decoded) === value ? decoded : undefined
  } catch { return undefined }
}

/** A reference serializes typed intent only; it is never a grant or a trusted result. */
function procurementCoverageRequest(ref: string): ScenarioRequest | undefined {
  if (typeof ref !== "string" || !ref.startsWith(coveragePrefix) || ref.length > 16_384) return undefined
  try {
    const decoded = decodeURIComponent(ref.slice(coveragePrefix.length))
    const parsed = decodeSfOperationInput("sf_scenario_simulate", JSON.parse(decoded))
    return parsed.ok ? parsed.value : undefined
  } catch {
    return undefined
  }
}
