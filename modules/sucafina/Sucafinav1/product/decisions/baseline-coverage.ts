import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../contracts/business-context.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { CostCoverageAssessment, CostCoverageBasis, CostCoverageEntry, DecisionCase } from "../contracts/decisions.ts"
import type { DomainPortHost, PlannerSourceHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority } from "../contracts/state.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import { assessCostCoverage } from "./cost-coverage.ts"
import { classifyCoverage, classificationDigest, classificationKey, supportsCoverageClassification } from "./coverage-classification.ts"
import type { CoverageClassification } from "./coverage-classification.ts"

type CaseRef = { id: string; incarnation: string; version: number }
export type BaselineCoverageRequest = { caseRef: CaseRef; source: Extract<BusinessEvidenceRef, { kind: "record" }>; basis: CostCoverageBasis; entries: readonly CostCoverageEntry[]; expectedVersion: number }
export type BaselineCoverage = { schema: "sf-baseline-coverage-v1"; coverageRef: string; caseRef: CaseRef; caseScopeDigest: string; source: Extract<BusinessEvidenceRef, { kind: "record" }>; basis: CostCoverageBasis; assessment: CostCoverageAssessment; version: number; principalRef: string; accessRevision: string; policyVersion: string; installationId: string; projectId: string; createdAt: string; classificationDigest: string; recordDigest: string }

/** Bootstrap uses a real Planner projection and human-supplied inventory, never a model assessment. */
export function createDecisionBaselineCoverage(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  resolveCase: (context: TrustedDomainContext) => Promise<PortResult<CaseRef>>
  authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  authorizeCoverage: (request: BaselineCoverageRequest, context: TrustedDomainContext) => Promise<boolean>
  projectForecast: (sourceRef: string, caseRef: CaseRef, context: TrustedDomainContext) => Promise<PortResult<DomainProjection>>
  resolveEvidence: (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => Promise<readonly BusinessEvidenceResolution[]>
  supports: Parameters<typeof assessCostCoverage>[0]["supports"]
  verifySnapshot: (snapshot: Snapshot, request: BaselineCoverageRequest, record: BaselineCoverage, context: TrustedDomainContext) => boolean
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  proposalCoverageWrites: WeakSet<object>
  now: () => string
}) {
  const resolveForecastCoverage: PlannerSourceHost["resolveForecastCoverage"] = async (selector, context) => {
    try {
      const source = input.host.requestFor(context)
      const bound = await input.resolveCase(context)
      if (!source || !selector.trim() || bound.status !== "ok" || source.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "baseline-coverage-access-unavailable" }
      const readCase = () => input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[bound.value.id] : undefined)
      const current = await readCase()
      if (current.status !== "ok" || !allowed(current.value, bound.value, context) || !await input.authorizeCase(current.value!, context)) return { status: "denied", reason: "baseline-coverage-access-unavailable" }
      const readRecords = () => input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? Object.entries(state.preferences).filter(([key]) => key.startsWith("sf:proposal-coverage:baseline:active:")).flatMap(([, value]) => {
        if (!isBaseline(value)) return []
        const classification = state.preferences[classificationKey(value.caseRef, value.source.refId)]
        return isClassification(classification) && classification.classificationDigest === value.classificationDigest && classification.classificationDigest === classificationDigest(classification) && classification.version === value.version ? [value] : []
      }) : undefined)
      const records = await readRecords()
      if (records.status !== "ok" || !records.value) return { status: "unavailable", reason: "baseline-coverage-unavailable" }
      const matches = records.value.filter((value) => value.caseRef.id === bound.value.id && value.caseRef.incarnation === bound.value.incarnation && (value.source.refId === selector || value.coverageRef === selector))
      if (matches.length !== 1) return { status: matches.length > 1 ? "conflict" : "unavailable", reason: matches.length > 1 ? "ambiguous-baseline-coverage" : "baseline-coverage-unavailable" }
      const record = matches[0]!
      if (record.recordDigest !== recordDigest(record) || record.installationId !== context.binding.installationId || record.projectId !== context.binding.projectId || record.caseRef.version > bound.value.version || record.caseScopeDigest !== caseScopeDigest(current.value!) || record.source.refDigest !== digestSfEvidenceRef(record.source) || record.source.installationId !== context.binding.installationId || record.source.projectId !== context.binding.projectId || !await fresh(record, input.resolveEvidence, context)) return { status: "unavailable", reason: "baseline-coverage-evidence-unavailable" }
      const again = await readCase()
      const againRecords = await readRecords()
      if (again.status !== "ok" || !allowed(again.value, bound.value, context) || digestSfValue(again.value) !== digestSfValue(current.value) || againRecords.status !== "ok" || !againRecords.value || againRecords.value.filter((value) => isBaseline(value) && value.coverageRef === record.coverageRef && digestSfValue(value) === digestSfValue(record)).length !== 1 || !await input.authorizeCase(again.value!, context) || !await fresh(record, input.resolveEvidence, context) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "baseline-coverage-changed" }
      return { status: "ok", value: { coverageRef: record.coverageRef, basis: structuredClone(record.basis), assessment: structuredClone(record.assessment) } }
    } catch { return { status: "unavailable", reason: "baseline-coverage-unavailable" } }
  }
  const register = async (incoming: BaselineCoverageRequest, context: TrustedDomainContext): Promise<PortResult<{ coverageRef: string; version: number }>> => {
    try {
      if (context.kind !== "ui") return { status: "denied", reason: "human-coverage-required" }
      const request = structuredClone(incoming)
      const source = input.host.requestFor(context)
      const operation = input.operationIdentity(context)
      if (!source || !operation || !Number.isSafeInteger(request.expectedVersion) || request.expectedVersion < 0 || request.source.kind !== "record" || request.source.target.surface !== "planner" || request.source.refDigest !== digestSfEvidenceRef(request.source) || request.source.installationId !== context.binding.installationId || request.source.projectId !== context.binding.projectId || !await input.authorizeCoverage(request, context) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "baseline-coverage-access-unavailable" }
      const current = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.caseRef.id] : undefined)
      const key = activeKey(request.caseRef, request.source.refId)
      const preferences = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? { active: state.preferences[key], prior: state.transactions[JSON.stringify([authority.principalRef, "preferences", request.caseRef.id, `baseline-coverage:${operation}`])] } : undefined)
      if (current.status !== "ok" || preferences.status !== "ok" || !preferences.value || !allowed(current.value, request.caseRef, context) || !await input.authorizeCase(current.value!, context)) return { status: "denied", reason: "baseline-coverage-access-unavailable" }
      if (preferences.value.prior) {
        if (preferences.value.prior.commandDigest !== digestSfValue(request) || preferences.value.prior.targetIncarnation !== request.caseRef.incarnation) return { status: "conflict", reason: "idempotency-content-changed" }
        const active = preferences.value.active
        const saved = preferences.value.prior.value
        if (!isBaseline(active) || !saved || typeof saved !== "object" || !("coverageRef" in saved) || !("version" in saved) || saved.coverageRef !== active.coverageRef || saved.version !== active.version) return { status: "unavailable", reason: "baseline-coverage-unavailable" }
        const verified = await resolveForecastCoverage(active.coverageRef, context)
        if (verified.status !== "ok" || !await input.authorizeCoverage(request, context)) return { status: "unavailable", reason: "baseline-coverage-unavailable" }
        return { status: "ok", value: { coverageRef: active.coverageRef, version: active.version } }
      }
      if (preferences.value.active !== undefined && !isBaseline(preferences.value.active)) return { status: "unavailable", reason: "baseline-coverage-invalid" }
      const priorVersion = isBaseline(preferences.value.active) ? preferences.value.active.version : 0
      if (priorVersion !== request.expectedVersion) return { status: "stale", reason: "baseline-coverage-changed" }
      const projection = await input.projectForecast(request.source.refId, request.caseRef, context)
      if (projection.status !== "ok") return projection
      if (projection.value.context.installationId !== context.binding.installationId || projection.value.context.projectId !== context.binding.projectId || projection.value.context.principalRef !== context.binding.principalRef || projection.value.context.accessRevision !== context.binding.accessRevision || projection.value.context.policyVersion !== context.binding.policyVersion || projection.value.context.surface !== "planner" || projection.value.context.currency !== current.value!.currency || digestSfValue(projection.value.context.period) !== digestSfValue(current.value!.horizon) || !projection.value.context.sourceRefs.some((item) => item.surface === "planner" && item.type === request.source.target.recordType && item.id === request.source.target.recordId && item.incarnation === request.source.target.incarnation && item.version === request.source.target.version && request.source.target.period !== undefined && request.source.target.period.start <= item.period.start && request.source.target.period.end >= item.period.end && item.fields.every((field) => request.source.target.fields.includes(field)))) return { status: "conflict", reason: "baseline-source-mismatch" }
      const refs = [request.source, ...request.basis.sourceRefs, ...request.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)].filter((ref, index, all) => all.findIndex((other) => digestSfValue(other) === digestSfValue(ref)) === index)
      const evidence = await input.resolveEvidence(refs, context)
      if (evidence.length !== refs.length || refs.some((ref) => !evidence.some((item) => item.state === "fresh" && item.accessRevision === context.binding.accessRevision && digestSfValue(item.ref) === digestSfValue(ref)))) return { status: "unavailable", reason: "baseline-evidence-unavailable" }
      const version = priorVersion + 1
      const coverageRef = `baseline-coverage:${digestSfValue({ caseId: request.caseRef.id, incarnation: request.caseRef.incarnation, source: request.source.refDigest, version })}`
      const proposedClassification = classifyCoverage(request, projection.value, version)
      const assessment = assessCostCoverage({ basis: request.basis, alternativeId: `baseline:${digestSfValue({ caseId: request.caseRef.id, incarnation: request.caseRef.incarnation, source: request.source.refId })}`, alternativeVersion: version, currency: current.value!.currency, horizon: current.value!.horizon, entries: request.entries, components: projection.value.components, evidence, supports: (entry, resolutions) => entry.status === "included" ? supportsCoverageClassification(proposedClassification, entry, resolutions) : input.supports(entry, resolutions) })
      // Persist only applicability decisions that the producer actually supported, not every human assertion.
      const classification = classifyCoverage({ ...request, entries: assessment.entries }, projection.value, version)
      const value = { schema: "sf-baseline-coverage-v1" as const, coverageRef, caseRef: request.caseRef, caseScopeDigest: caseScopeDigest(current.value!), source: request.source, basis: request.basis, assessment, version, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, installationId: context.binding.installationId, projectId: context.binding.projectId, createdAt: input.now(), classificationDigest: classification.classificationDigest, recordDigest: "" }
      const record: BaselineCoverage = { ...value, recordDigest: recordDigest(value) }
      if (!Number.isFinite(Date.parse(record.createdAt)) || !await input.authorizeCoverage(request, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "baseline-coverage-access-unavailable" }
      const work = async (state: SfProductState, authority: SfStateAuthority, snapshot: Snapshot) => {
        const actual = state.cases[request.caseRef.id]
        const existing = state.preferences[key]
        if (!sameAuthority(authority, context) || !allowed(actual, request.caseRef, context) || caseScopeDigest(actual!) !== record.caseScopeDigest || (isBaseline(existing) ? existing.version : existing === undefined ? 0 : -1) !== priorVersion || !input.verifySnapshot(snapshot, request, record, context)) return { commit: false, value: null }
        const history = `sf:proposal-coverage:baseline:history:${coverageRef}`
        if (state.preferences[history] !== undefined) return { commit: false, value: null }
        const classificationHistory = `sf:proposal-coverage:classification:history:${classification.classificationDigest}`
        if (state.preferences[classificationHistory] !== undefined) return { commit: false, value: null }
        state.preferences[classificationHistory] = classification
        state.preferences[classificationKey(request.caseRef, request.source.refId)] = classification
        state.preferences[history] = record
        state.preferences[key] = record
        return { commit: true, value: { coverageRef, version } }
      }
      input.proposalCoverageWrites.add(work)
      const saved = await input.state.transaction(source, { namespace: "preferences", domainSurface: "planner", expectedStorageVersion: preferences.storageVersion, additionalNamespaces: [{ namespace: "cases", expectedStorageVersion: current.storageVersion }], targetRef: request.caseRef.id, targetIncarnation: request.caseRef.incarnation, idempotencyKey: `baseline-coverage:${operation}`, commandDigest: digestSfValue(request) }, work).finally(() => input.proposalCoverageWrites.delete(work))
      if (saved.status !== "ok" || !saved.value) return { status: saved.status === "conflict" || saved.status === "preview" ? "conflict" : "unavailable", reason: "baseline-coverage-unavailable" }
      const verified = await resolveForecastCoverage(saved.value.coverageRef, context)
      if (verified.status !== "ok" || !await input.authorizeCoverage(request, context)) return { status: "unavailable", reason: "baseline-coverage-unavailable" }
      return { status: "ok", value: saved.value }
    } catch { return { status: "unavailable", reason: "baseline-coverage-unavailable" } }
  }
  const readClassification = async (selector: string, context: TrustedDomainContext): Promise<PortResult<CoverageClassification>> => {
    const coverage = await resolveForecastCoverage(selector, context)
    const source = input.host.requestFor(context)
    const bound = await input.resolveCase(context)
    if (coverage.status !== "ok" || !source || bound.status !== "ok") return { status: "unavailable", reason: "classification-unavailable" }
    const values = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? Object.entries(state.preferences).filter(([key]) => key.startsWith("sf:proposal-coverage:classification:active:")).map(([, value]) => ({ value, baseline: isClassification(value) ? state.preferences[activeKey(bound.value, value.source.refId)] : undefined })) : undefined)
    if (values.status !== "ok" || !values.value) return { status: "unavailable", reason: "classification-unavailable" }
    const matches = values.value.flatMap((item) => isClassification(item.value) && isBaseline(item.baseline) && item.baseline.coverageRef === coverage.value.coverageRef && item.baseline.classificationDigest === item.value.classificationDigest && item.baseline.version === item.value.version ? [item.value] : []).filter((value) => value.caseRef.id === bound.value.id && value.caseRef.incarnation === bound.value.incarnation && (value.source.refId === selector || `baseline-coverage:${digestSfValue({ caseId: value.caseRef.id, incarnation: value.caseRef.incarnation, source: value.source.refDigest, version: value.version })}` === coverage.value.coverageRef) && value.basis.id === coverage.value.basis.id && value.basis.version === coverage.value.basis.version && value.classificationDigest === classificationDigest(value))
    if (matches.length !== 1 || !await input.host.revalidate(context)) return { status: "unavailable", reason: "classification-unavailable" }
    const again = await resolveForecastCoverage(coverage.value.coverageRef, context)
    if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(coverage.value)) return { status: "stale", reason: "classification-changed" }
    return { status: "ok", value: structuredClone(matches[0]!) }
  }
  return { register, resolveForecastCoverage, readClassification }
}
function sameAuthority(authority: SfStateAuthority, context: TrustedDomainContext) { return authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision }
function allowed(value: DecisionCase | undefined, ref: CaseRef, context: TrustedDomainContext) { return !!value && value.id === ref.id && value.incarnation === ref.incarnation && value.version === ref.version && value.participants.includes(context.binding.principalRef) && (context.kind !== "native" || (context.binding.caseId === value.id && context.binding.caseIncarnation === value.incarnation && context.binding.caseVersion === value.version)) }
function caseScopeDigest(value: DecisionCase) { return digestSfValue({ id: value.id, incarnation: value.incarnation, horizon: value.horizon, currency: value.currency, criteria: value.criteria }) }
function activeKey(ref: CaseRef, sourceRef: string) { return `sf:proposal-coverage:baseline:active:${digestSfValue({ id: ref.id, incarnation: ref.incarnation, sourceRef })}` }
function recordDigest(value: BaselineCoverage) { return digestSfValue(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "recordDigest"))) }
function isBaseline(value: unknown): value is BaselineCoverage { if (!value || typeof value !== "object" || Array.isArray(value)) return false; const record = value as Partial<BaselineCoverage>; return record.schema === "sf-baseline-coverage-v1" && typeof record.coverageRef === "string" && !!record.caseRef && !!record.source && !!record.basis && !!record.assessment && Number.isSafeInteger(record.version) && typeof record.recordDigest === "string" && typeof record.classificationDigest === "string" && typeof record.caseScopeDigest === "string" }
async function fresh(record: BaselineCoverage, resolve: (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => Promise<readonly BusinessEvidenceResolution[]>, context: TrustedDomainContext) {
  const refs = [record.source, ...record.basis.sourceRefs, ...record.assessment.evaluatedSourceRefs, ...record.assessment.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)].filter((ref, index, all) => all.findIndex((item) => digestSfValue(item) === digestSfValue(ref)) === index)
  const values = await resolve(refs, context)
  return values.length === refs.length && refs.every((ref) => values.some((value) => value.state === "fresh" && value.accessRevision === context.binding.accessRevision && digestSfValue(value.ref) === digestSfValue(ref)))
}

function isClassification(value: unknown): value is CoverageClassification { return !!value && typeof value === "object" && !Array.isArray(value) && "schema" in value && value.schema === "sf-coverage-classification-v1" && "classificationDigest" in value && typeof value.classificationDigest === "string" && "caseRef" in value && !!value.caseRef && "source" in value && !!value.source && "basis" in value && !!value.basis && "mappings" in value && Array.isArray(value.mappings) }
