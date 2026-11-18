import { roleMap } from "../../runtime/admin.ts"
import { object, rows } from "../../runtime/contract.ts"
import type { Actor } from "../../runtime/contract.ts"
import { domain } from "../../runtime/planner.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { Period } from "../contracts/context.ts"
import type { CostCoverageBasis, DocumentEvidence, ScenarioResult } from "../contracts/decisions.ts"
import type { ScenarioRequest } from "../contracts/operations.ts"
import type { DomainPortHost, PlannerSourceHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { assessCostCoverage } from "../decisions/cost-coverage.ts"
import { createPlannerPort } from "../planner/port.ts"
import type { createPlannerProduct } from "../planner/product.ts"
import type { PlannerScenarioInputs } from "../planner/scenario-port.ts"
import { resolveSfDocumentEvidence } from "./evidence-resolver.ts"
import type { SfDocumentReader } from "./evidence-resolver.ts"

type DocumentRef = Extract<BusinessEvidenceRef, { kind: "document" }>
export type SfDocumentScenarioRequest = { documentRef: DocumentRef; baseRef: string; targetRef: string; period: Period }
export type SfDocumentScenarioTarget = { baseRef: string; targetRef: string; period: Period; currency: string; label: string }
export type SfDocumentScenarioResult = { request: ScenarioRequest; scenario: ScenarioResult; evidence: DocumentEvidence; domainApplied: false }

export function parseSfDocumentScenarioRequest(value: unknown): SfDocumentScenarioRequest | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== 4 ||
    !("documentRef" in value) || !("baseRef" in value) || typeof value.baseRef !== "string" || !value.baseRef.trim() || value.baseRef.length > 1024 ||
    !("targetRef" in value) || typeof value.targetRef !== "string" || !/^.{1,256}:(?:[1-9]|1[0-2])$/.test(value.targetRef) ||
    !("period" in value) || !isSfPeriod(value.period)) return undefined
  const ref = decodeSfOperationInput("sf_evidence_get", { evidenceRef: value.documentRef })
  if (!ref.ok || ref.value.evidenceRef.kind !== "document" || !ref.value.evidenceRef.target.fieldCandidateId) return undefined
  return { documentRef: ref.value.evidenceRef, baseRef: value.baseRef, targetRef: value.targetRef, period: value.period }
}

/** A confirmed document supplies a scenario amount; the existing Planner producer owns calculation and authorization. */
export function createSfDocumentScenarios(input: {
  host: DomainPortHost
  product: ReturnType<typeof createPlannerProduct>
  evidence: BusinessContextService
  reader: SfDocumentReader
  sourceFence: (context: TrustedDomainContext) => Promise<string | undefined>
  authorize: (request: SfDocumentScenarioRequest, context: TrustedDomainContext) => Promise<boolean>
}) {
  const confirmed = async (ref: DocumentRef, context: TrustedDomainContext): Promise<PortResult<DocumentEvidence>> => {
    if (!input.host.requestFor(context) || !await input.host.revalidate(context)) return { status: "denied", reason: "document-scenario-authority-unavailable" }
    const current = await resolveSfDocumentEvidence(ref, context, input.reader)
    if (current.state !== "fresh") return { status: current.state === "revoked" ? "denied" : "stale", reason: "document-scenario-source-changed" }
    const decoded = decodeSfOperationOutput("sf_document_extract", current.authorizedProjection)
    if (!decoded.ok || decoded.value.status !== "confirmed" || !ref.target.confirmationVersion) return { status: "needs-input", reason: "confirmed-document-required" }
    if (typeof decoded.value.value !== "number" || !Number.isFinite(decoded.value.value) || !decoded.value.unit || !/^[A-Z]{3}$/.test(decoded.value.unit))
      return { status: "needs-input", reason: "confirmed-document-currency-amount-required" }
    if (digestSfValue(decoded.value.ref) !== digestSfValue(ref) || !await input.host.revalidate(context)) return { status: "stale", reason: "document-scenario-source-changed" }
    return { status: "ok", value: decoded.value }
  }
  const verifyAssumption: PlannerScenarioInputs["verifyAssumption"] = async (assumption, context) => {
    const ref = assumption.evidenceRefs[0]
    if (assumption.state !== "confirmed" || assumption.evidenceRefs.length !== 1 || ref?.kind !== "document") return { status: "needs-input", reason: "confirmed-document-required" }
    const current = await confirmed(ref, context)
    if (current.status !== "ok") return current
    if (assumption.id !== `document:${current.value.id}` || assumption.value !== current.value.value) return { status: "stale", reason: "document-scenario-assumption-changed" }
    return { status: "ok", value: { fingerprint: digestSfValue(current.value) } }
  }
  // No human cost inventory is inferred from a quoted field. C10 derives pending/inventory-unavailable.
  const coverage: PlannerSourceHost["resolveForecastCoverage"] = async (reference, context) => {
    const source = await input.product.sources.resolveForecastSource(reference, context)
    if (source.status !== "ok") return source
    const ref = source.value.evidence
    const period = ref.target.period
    if (!period) return { status: "unavailable", reason: "document-scenario-period-unavailable" }
    const projected = await input.product.planner.compareForecast({ baseRef: reference, candidateRef: reference, period, currency: "USD" }, context)
    if (projected.status !== "ok") return projected
    const evidence = await input.evidence.resolve(ref, context)
    if (evidence.state !== "fresh" || digestSfValue(evidence.currentRef) !== digestSfValue(ref) || !evidence.authorizedProjection || !await input.host.revalidate(context))
      return { status: "stale", reason: "document-scenario-baseline-changed" }
    const basis: CostCoverageBasis = { id: `document-scenario-unclassified:${ref.refDigest}`, version: 1, decisionType: "unknown", categoryIds: [], additionalCategoryIds: [], sourceRefs: [ref] }
    const assessment = assessCostCoverage({ basis, alternativeId: reference, alternativeVersion: ref.target.version, currency: "USD", horizon: period,
      entries: [], components: projected.value.baseline.components, evidence: [evidence], supports: () => false })
    return { status: "ok", value: { coverageRef: `document-scenario-coverage:${ref.refDigest}`, basis, assessment } }
  }
  const planner = createPlannerPort({ host: input.host, sources: { ...input.product.sources, resolveForecastCoverage: coverage }, evidence: input.evidence,
    scenarioInputs: { resolveAmount: input.product.scenarioInputs.resolveAmount, verifyAssumption } })

  const targets = async (ref: DocumentRef, context: TrustedDomainContext): Promise<PortResult<readonly SfDocumentScenarioTarget[]>> => {
    const document = await confirmed(ref, context)
    if (document.status !== "ok") return document
    const request = input.host.requestFor(context)
    if (!request) return { status: "denied", reason: "document-scenario-authority-unavailable" }
    const environment = await input.host.environment(request)
    const versions = await input.host.persistence.transaction("planner", async (snapshot) => {
      const principal = await input.host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
      if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: undefined }
      const roles = principal.roles.filter((entry) => entry.surface === "planner").map((entry) => entry.role)
      const access = object(object(snapshot.data.access)[principal.id])
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
      return { commit: false, value: rows(domain.view(snapshot, actor, environment).data.versions).map((version) => ({ id: String(version.id ?? ""), closed: Number(version.closed) })) }
    }, { signal: request.signal })
    if (!versions || !await input.host.revalidate(context)) return { status: "denied", reason: "document-scenario-planner-unavailable" }
    if (versions.length > 64) return { status: "unavailable", reason: "document-scenario-target-limit" }
    const result: SfDocumentScenarioTarget[] = []
    const sources: BusinessEvidenceRef[] = []
    for (const version of versions) {
      const issued = await input.product.issueSource(version.id, context)
      if (issued.status !== "ok") return issued
      const source = issued.value.evidence
      if (!source.target.period) return { status: "unavailable", reason: "document-scenario-period-unavailable" }
      const projection = await input.product.planner.compareForecast({ baseRef: source.refId, candidateRef: source.refId, period: source.target.period, currency: "USD" }, context)
      if (projection.status !== "ok") return projection
      sources.push(source)
      for (const value of projection.value.baseline.values) {
        if (!value.id.endsWith(":forecast") || value.granularity !== "month" || value.currency !== document.value.unit || Number(value.period.start.slice(5, 7)) <= version.closed) continue
        result.push({ baseRef: source.refId, targetRef: value.id.slice(0, -":forecast".length), period: value.period, currency: value.currency,
          label: `${version.id} · ${value.id.slice(0, -":forecast".length)} · ${value.currency}` })
      }
      if (result.length > 2048) return { status: "unavailable", reason: "document-scenario-target-limit" }
    }
    const current = await Promise.all(sources.map((source) => input.product.sources.resolveForecastSource(source.refId, context)))
    const latest = await confirmed(ref, context)
    if (latest.status !== "ok") return latest
    if (digestSfValue(latest.value) !== digestSfValue(document.value) || current.some((entry, index) => entry.status !== "ok" || digestSfValue(entry.value.evidence) !== digestSfValue(sources[index])) || request.signal.aborted || !await input.host.revalidate(context))
      return { status: "stale", reason: "document-scenario-targets-changed" }
    return { status: "ok", value: result }
  }
  const preview = async (incoming: SfDocumentScenarioRequest, context: TrustedDomainContext): Promise<PortResult<SfDocumentScenarioResult>> => {
    const request = parseSfDocumentScenarioRequest(incoming)
    if (!request) return { status: "needs-input", reason: "invalid-document-scenario" }
    if (context.kind !== "ui" || !await input.authorize(request, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "document-scenario-human-authority-required" }
    const document = await confirmed(request.documentRef, context)
    if (document.status !== "ok") return document
    if (typeof document.value.value !== "number" || !document.value.unit) return { status: "needs-input", reason: "confirmed-document-currency-amount-required" }
    const fence = await input.sourceFence(context)
    if (!fence) return { status: "unavailable", reason: "document-scenario-source-fence-unavailable" }
    const scenarioRequest: ScenarioRequest = { baseRef: request.baseRef,
      operations: [{ kind: "replace", targetRef: request.targetRef, amount: document.value.value, currency: document.value.unit, period: request.period }],
      assumptions: [{ id: `document:${document.value.id}`, value: document.value.value, evidenceRefs: [document.value.ref], state: "confirmed" }] }
    const result = await planner.simulateScenario(scenarioRequest, context)
    if (result.status !== "ok") return result
    const latest = await confirmed(request.documentRef, context)
    if (latest.status !== "ok") return latest
    if (digestSfValue(latest.value) !== digestSfValue(document.value) || !result.value.sourceRefs.some((ref) => digestSfValue(ref) === digestSfValue(document.value.ref)) || await input.sourceFence(context) !== fence ||
      !await input.authorize(request, context) || !await input.host.revalidate(context)) return { status: "stale", reason: "document-scenario-source-changed" }
    return { status: "ok", value: { request: scenarioRequest, scenario: result.value, evidence: document.value, domainApplied: false } }
  }
  return { targets, preview }
}
