import { roleMap } from "../../runtime/admin.ts"
import { object, rows, text } from "../../runtime/contract.ts"
import type { Actor } from "../../runtime/contract.ts"
import { domain } from "../../runtime/procurement.ts"
import { procurementKeys } from "../../src/nav.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { ProjectionComponent } from "../contracts/context.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../contracts/decisions.ts"
import type { CostCoverageAssessment, CostCoverageBasis, ScenarioResult } from "../contracts/decisions.ts"
import type { ScenarioRequest } from "../contracts/operations.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { assessCostCoverage } from "../decisions/cost-coverage.ts"
import { PROCUREMENT_MONETARY_RULE_VERSION, procurementMonetaryFacts } from "./monetary.ts"
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

/** Quantifies a PR hypothesis without executing, preparing, or reverting a domain command. */
export function createProcurementScenarioProducer(input: { host: DomainPortHost; sources: ReturnType<typeof createProcurementSourceResolver> }) {
  const supports = (request: ScenarioRequest) => typeof request.baseRef === "string" && request.baseRef.startsWith("sf-procurement:")
  const preview = async (incoming: ScenarioRequest, binding: TrustedDomainContext): Promise<PortResult<ProcurementScenarioPreview>> => {
    const parsed = decodeSfOperationInput("sf_scenario_simulate", incoming)
    if (!parsed.ok || !supports(parsed.value) || parsed.value.operations.length > 1) return { status: "needs-input", reason: "invalid-procurement-scenario" }
    const inventory = parsed.value.assumptions
    if (inventory.length !== 1 || inventory[0]?.id !== "procurement-cost-inventory" || inventory[0].value !== "renewal-transition-v1" || inventory[0].state !== "hypothetical" || inventory[0].evidenceRefs.length) return { status: "needs-input", reason: "explicit-procurement-cost-inventory-required" }
    const selected = structuredClone(parsed.value)
    const operation = selected.operations[0]
    if (operation && (operation.kind !== "replace" || operation.targetRef !== selected.baseRef || operation.replacementRef !== undefined || typeof operation.amount !== "number" || !Number.isFinite(operation.amount) || operation.amount < 0 || !operation.currency || !operation.period)) return { status: "needs-input", reason: "explicit-requisition-amount-required" }
    const request = input.host.requestFor(binding)
    if (!request || !await input.host.revalidate(binding)) return { status: "denied", reason: "current-authority-unavailable" }
    const source = await input.sources.resolveForPreparation(selected.baseRef, binding)
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
      if (!input.sources.isCurrent(snapshot, evidence) || digestProcurementSource(record, view.data.formSettings) !== evidence.target.projectionDigest || text(object(view.data.formSettings).currency) !== context.currency) return { commit: false, value: { status: "stale", reason: "requisition-source-changed" } }
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
    const again = await input.sources.resolveForPreparation(selected.baseRef, binding)
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
