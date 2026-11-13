import { digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { Period } from "../contracts/context.ts"
import type { DecisionCase } from "../contracts/decisions.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority } from "../contracts/state.ts"
import type { Snapshot } from "../../runtime/contract.ts"

type CaseRef = { id: string; incarnation: string; version: number }
export type CriterionRuleInput = { caseRef: CaseRef; criterionId: string; metricRef: string; operator: "lte" | "gte" | "eq"; value: number; unit: string; period: Period; evidenceRefs: readonly BusinessEvidenceRef[]; expectedRuleVersion: number; sensitivity?: { baselineRef: string; parameterRef: string; parameterUnit: string; resultUnit: string; engineVersion: string; sourceRefs: readonly BusinessEvidenceRef[] } }
export type CriterionRule = Omit<CriterionRuleInput, "expectedRuleVersion"> & { schema: "sf-criterion-rule-v1"; ruleRef: string; version: number; criterionDigest: string; principalRef: string; accessRevision: string; policyVersion: string; installationId: string; projectId: string; createdAt: string; recordDigest: string }
export type CriterionMetric = { caseRef: CaseRef; criterionId: string; ruleRef: string; ruleVersion: number; metricRef: string; scenarioRef: string; baselineRef?: string; value: number | null; unit: string; period: Period; evidenceRefs: readonly BusinessEvidenceRef[]; state: "confirmed" | "conditioned" | "unavailable"; engineVersion: string }

/** Rule values are explicit human inputs, never inferred from a criterion's text. */
export function createCriterionRuleRegistry(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  authorizeRule: (request: CriterionRuleInput, context: TrustedDomainContext) => Promise<boolean>
  verifyEvidence: (rule: CriterionRule, context: TrustedDomainContext) => Promise<boolean>
  verifySnapshot: (snapshot: Snapshot, request: CriterionRuleInput, rule: CriterionRule, context: TrustedDomainContext) => boolean
  readMetric: (request: { caseRef: CaseRef; criterionId: string; ruleRef: string; ruleVersion: number; scenarioRef: string; metricRef: string; baselineRef?: string }, context: TrustedDomainContext) => Promise<PortResult<CriterionMetric>>
  verifyMetric: (metric: CriterionMetric, context: TrustedDomainContext) => Promise<boolean>
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  proposalCoverageWrites: WeakSet<object>
  now: () => string
}) {
  const resolve = async (request: { caseRef: CaseRef; criterionId: string }, context: TrustedDomainContext): Promise<PortResult<CriterionRule>> => {
    try {
      const source = input.host.requestFor(context)
      if (!source || source.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "criterion-access-unavailable" }
      const readCase = () => input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.caseRef.id] : undefined)
      const current = await readCase()
      if (current.status !== "ok") return { status: "unavailable", reason: "criterion-unavailable" }
      const decision = current.value
      if (!allowed(decision, request.caseRef, context) || !await input.authorizeCase(decision!, context)) return { status: "denied", reason: "criterion-access-unavailable" }
      const criteria = decision!.criteria.filter((item) => item.id === request.criterionId)
      if (criteria.length !== 1) return { status: "unavailable", reason: "criterion-unavailable" }
      const key = criterionRuleKey(request.caseRef, request.criterionId)
      const readRule = () => input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? state.preferences[key] : undefined)
      const currentRule = await readRule()
      if (currentRule.status !== "ok") return { status: "unavailable", reason: "criterion-state-unavailable" }
      if (currentRule.value === undefined) return { status: "needs-input", reason: "criterion-rule-unavailable" }
      if (!isRule(currentRule.value)) return { status: "unavailable", reason: "criterion-rule-invalid" }
      const rule = currentRule.value
      if (rule.recordDigest !== ruleDigest(rule) || rule.installationId !== context.binding.installationId || rule.projectId !== context.binding.projectId || rule.caseRef.id !== request.caseRef.id || rule.caseRef.incarnation !== request.caseRef.incarnation || rule.caseRef.version > request.caseRef.version || rule.criterionId !== request.criterionId || rule.criterionDigest !== digestSfValue(criteria[0]) || !await input.verifyEvidence(rule, context)) return { status: "unavailable", reason: "criterion-rule-unavailable" }
      const again = await readCase()
      const ruleAgain = await readRule()
      if (again.status !== "ok" || !allowed(again.value, request.caseRef, context) || digestSfValue(again.value) !== digestSfValue(decision) || ruleAgain.status !== "ok" || !isRule(ruleAgain.value) || digestSfValue(ruleAgain.value) !== digestSfValue(rule) || !await input.authorizeCase(again.value!, context) || !await input.verifyEvidence(rule, context) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "criterion-changed" }
      return { status: "ok", value: structuredClone(rule) }
    } catch {
      return { status: "unavailable", reason: "criterion-unavailable" }
    }
  }
  const register = async (incoming: CriterionRuleInput, context: TrustedDomainContext): Promise<PortResult<{ ruleRef: string; version: number }>> => {
    try {
      if (context.kind !== "ui") return { status: "denied", reason: "human-criterion-required" }
      const request = structuredClone(incoming)
      if (!request.criterionId.trim() || !request.metricRef.trim() || !request.unit.trim() || !["lte", "gte", "eq"].includes(request.operator) || !Number.isFinite(request.value) || !isSfPeriod(request.period) || !request.evidenceRefs.length || (request.sensitivity && (!request.sensitivity.baselineRef.trim() || !request.sensitivity.parameterRef.trim() || !request.sensitivity.parameterUnit.trim() || !request.sensitivity.resultUnit.trim() || request.sensitivity.resultUnit !== request.unit || !request.sensitivity.engineVersion.trim() || !request.sensitivity.sourceRefs.length)) || !Number.isSafeInteger(request.expectedRuleVersion) || request.expectedRuleVersion < 0 || !await input.authorizeRule(request, context)) return { status: "denied", reason: "criterion-input-unavailable" }
      const source = input.host.requestFor(context)
      const operation = input.operationIdentity(context)
      if (!source || !operation || source.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "criterion-access-unavailable" }
      const current = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.caseRef.id] : undefined)
      const preferences = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? { existing: state.preferences[criterionRuleKey(request.caseRef, request.criterionId)], prior: state.transactions[JSON.stringify([authority.principalRef, "preferences", request.caseRef.id, `criterion-rule:${operation}`])] } : undefined)
      if (current.status !== "ok" || preferences.status !== "ok" || !preferences.value) return { status: "unavailable", reason: "criterion-state-unavailable" }
      const decision = current.value
      if (!allowed(decision, request.caseRef, context) || !await input.authorizeCase(decision!, context)) return { status: "denied", reason: "criterion-access-unavailable" }
      const criteria = decision!.criteria.filter((item) => item.id === request.criterionId)
      if (criteria.length !== 1) return { status: "unavailable", reason: "criterion-unavailable" }
      if (preferences.value.prior) {
        if (preferences.value.prior.commandDigest !== digestSfValue(request) || preferences.value.prior.targetIncarnation !== request.caseRef.incarnation) return { status: "conflict", reason: "idempotency-content-changed" }
        const saved = preferences.value.prior.value
        const confirmed = await resolve({ caseRef: request.caseRef, criterionId: request.criterionId }, context)
        if (!saved || typeof saved !== "object" || !("ruleRef" in saved) || !("version" in saved) || confirmed.status !== "ok" || saved.ruleRef !== confirmed.value.ruleRef || saved.version !== confirmed.value.version || !await input.authorizeRule(request, context)) return { status: "unavailable", reason: "criterion-replay-unavailable" }
        return { status: "ok", value: { ruleRef: confirmed.value.ruleRef, version: confirmed.value.version } }
      }
      if (preferences.value.existing !== undefined && !isRule(preferences.value.existing)) return { status: "unavailable", reason: "criterion-rule-invalid" }
      const priorVersion = isRule(preferences.value.existing) ? preferences.value.existing.version : 0
      if (priorVersion !== request.expectedRuleVersion) return { status: "stale", reason: "criterion-rule-changed" }
      const version = priorVersion + 1
      const ruleRef = `criterion-rule:${digestSfValue({ caseRef: request.caseRef, criterionId: request.criterionId, version, operation, principalRef: context.binding.principalRef })}`
      const value = { schema: "sf-criterion-rule-v1" as const, ruleRef, caseRef: request.caseRef, criterionId: request.criterionId, metricRef: request.metricRef, operator: request.operator, value: request.value, unit: request.unit, period: request.period, evidenceRefs: request.evidenceRefs, ...(request.sensitivity ? { sensitivity: request.sensitivity } : {}), version, criterionDigest: digestSfValue(criteria[0]), principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, installationId: context.binding.installationId, projectId: context.binding.projectId, createdAt: input.now(), recordDigest: "" }
      const rule: CriterionRule = { ...value, recordDigest: ruleDigest(value) }
      if (!Number.isFinite(Date.parse(rule.createdAt)) || !await input.verifyEvidence(rule, context) || !await input.authorizeRule(request, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "criterion-authority-unavailable" }
      const work = async (state: SfProductState, authority: SfStateAuthority, snapshot: Snapshot) => {
        const actual = state.cases[request.caseRef.id]
        const existing = state.preferences[criterionRuleKey(request.caseRef, request.criterionId)]
        if (!sameAuthority(authority, context) || !allowed(actual, request.caseRef, context) || !actual!.criteria.some((criterion) => criterion.id === request.criterionId && digestSfValue(criterion) === rule.criterionDigest) || (isRule(existing) ? existing.version : existing === undefined ? 0 : -1) !== priorVersion || !input.verifySnapshot(snapshot, request, rule, context)) return { commit: false, value: null }
        const history = `sf:criterion-rule:history:${ruleRef}`
        if (state.preferences[history]) return { commit: false, value: null }
        state.preferences[history] = rule
        state.preferences[criterionRuleKey(request.caseRef, request.criterionId)] = rule
        return { commit: true, value: { ruleRef, version } }
      }
      input.proposalCoverageWrites.add(work)
      const saved = await input.state.transaction(source, { namespace: "preferences", domainSurface: "planner", expectedStorageVersion: preferences.storageVersion, additionalNamespaces: [{ namespace: "cases", expectedStorageVersion: current.storageVersion }], targetRef: request.caseRef.id, targetIncarnation: request.caseRef.incarnation, idempotencyKey: `criterion-rule:${operation}`, commandDigest: digestSfValue(request) }, work).finally(() => input.proposalCoverageWrites.delete(work))
      if (saved.status !== "ok" || !saved.value) return { status: saved.status === "conflict" || saved.status === "preview" ? "conflict" : "unavailable", reason: "criterion-registration-unavailable" }
      const confirmed = await resolve({ caseRef: request.caseRef, criterionId: request.criterionId }, context)
      if (confirmed.status !== "ok" || confirmed.value.ruleRef !== saved.value.ruleRef || confirmed.value.version !== saved.value.version || !await input.authorizeRule(request, context)) return { status: "unavailable", reason: "criterion-proof-unavailable" }
      return { status: "ok", value: saved.value }
    } catch {
      return { status: "unavailable", reason: "criterion-registration-unavailable" }
    }
  }
  const evaluate = async (request: { caseRef: CaseRef; criterionId: string; scenarioRef: string; baselineRef?: string }, context: TrustedDomainContext): Promise<PortResult<{ criterionId: string; state: "satisfied" | "failed" | "unknown"; reason: string; ruleRef?: string; evidenceRefs: readonly BusinessEvidenceRef[] }>> => {
    try {
      if (!request.scenarioRef.trim()) return { status: "needs-input", reason: "scenario-reference-required" }
      const current = await resolve(request, context)
      if (current.status !== "ok") return current.status === "needs-input" && current.reason === "criterion-rule-unavailable" ? { status: "ok", value: { criterionId: request.criterionId, state: "unknown", reason: "criterion-rule-unavailable", evidenceRefs: [] } } : current
      const rule = current.value
      const metric = await input.readMetric({ caseRef: request.caseRef, criterionId: request.criterionId, ruleRef: rule.ruleRef, ruleVersion: rule.version, scenarioRef: request.scenarioRef, metricRef: rule.metricRef, ...(request.baselineRef ? { baselineRef: request.baselineRef } : {}) }, context)
      if (metric.status !== "ok") {
        if (metric.status === "denied" || metric.status === "stale" || metric.status === "conflict") return metric
        const again = await resolve(request, context)
        if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(rule) || !await input.host.revalidate(context)) return { status: "stale", reason: "criterion-evidence-changed" }
        return { status: "ok", value: { criterionId: request.criterionId, state: "unknown", reason: "criterion-metric-unavailable", ruleRef: rule.ruleRef, evidenceRefs: rule.evidenceRefs } }
      }
      const value = metric.value
      if (digestSfValue(value.caseRef) !== digestSfValue(request.caseRef) || value.criterionId !== request.criterionId || value.ruleRef !== rule.ruleRef || value.ruleVersion !== rule.version || value.metricRef !== rule.metricRef || value.scenarioRef !== request.scenarioRef || (request.baselineRef !== undefined && value.baselineRef !== request.baselineRef) || (rule.sensitivity && rule.sensitivity.baselineRef !== request.baselineRef) || value.unit !== rule.unit || digestSfValue(value.period) !== digestSfValue(rule.period) || value.value === null || !Number.isFinite(value.value) || value.state !== "confirmed" || !value.engineVersion.trim() || !value.evidenceRefs.length || !await input.verifyMetric(value, context)) {
        const again = await resolve(request, context)
        if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(rule) || !await input.host.revalidate(context)) return { status: "stale", reason: "criterion-evidence-changed" }
        return { status: "ok", value: { criterionId: request.criterionId, state: "unknown", reason: value.state === "conditioned" ? "criterion-metric-conditioned" : "criterion-metric-unavailable", ruleRef: rule.ruleRef, evidenceRefs: rule.evidenceRefs } }
      }
      const again = await resolve(request, context)
      const metricAgain = await input.readMetric({ caseRef: request.caseRef, criterionId: request.criterionId, ruleRef: rule.ruleRef, ruleVersion: rule.version, scenarioRef: request.scenarioRef, metricRef: rule.metricRef, ...(request.baselineRef ? { baselineRef: request.baselineRef } : {}) }, context)
      if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(rule) || metricAgain.status !== "ok" || digestSfValue(metricAgain.value) !== digestSfValue(value) || !await input.verifyMetric(metricAgain.value, context) || !await input.host.revalidate(context)) return { status: "stale", reason: "criterion-evidence-changed" }
      const satisfied = rule.operator === "lte" ? value.value <= rule.value : rule.operator === "gte" ? value.value >= rule.value : value.value === rule.value
      return { status: "ok", value: { criterionId: request.criterionId, state: satisfied ? "satisfied" : "failed", reason: satisfied ? "criterion-satisfied" : "criterion-not-satisfied", ruleRef: rule.ruleRef, evidenceRefs: [...rule.evidenceRefs, ...value.evidenceRefs].filter((ref, index, all) => all.findIndex((item) => digestSfValue(item) === digestSfValue(ref)) === index) } }
    } catch {
      return { status: "unavailable", reason: "criterion-evaluation-unavailable" }
    }
  }
  return { register, resolve, evaluate }
}

function sameAuthority(authority: SfStateAuthority, context: TrustedDomainContext) { return authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision }
function allowed(value: DecisionCase | undefined, ref: CaseRef, context: TrustedDomainContext) { return !!value && value.id === ref.id && value.incarnation === ref.incarnation && value.version === ref.version && value.participants.includes(context.binding.principalRef) && (context.kind !== "native" || (context.binding.caseId === value.id && context.binding.caseIncarnation === value.incarnation && context.binding.caseVersion === value.version)) }
export function criterionRuleKey(ref: CaseRef, criterionId: string) { return `sf:criterion-rule:${digestSfValue({ id: ref.id, incarnation: ref.incarnation, criterionId })}` }
function ruleDigest(rule: CriterionRule) { return digestSfValue(Object.fromEntries(Object.entries(rule).filter(([key]) => key !== "recordDigest"))) }
function isRule(value: unknown): value is CriterionRule {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const rule = value as Partial<CriterionRule>
  if (Object.keys(rule).some((key) => !["schema", "ruleRef", "caseRef", "criterionId", "metricRef", "operator", "value", "unit", "period", "evidenceRefs", "sensitivity", "version", "criterionDigest", "principalRef", "accessRevision", "policyVersion", "installationId", "projectId", "createdAt", "recordDigest"].includes(key))) return false
  if (rule.sensitivity && (!rule.sensitivity.baselineRef?.trim() || !rule.sensitivity.parameterRef?.trim() || !rule.sensitivity.parameterUnit?.trim() || !rule.sensitivity.resultUnit?.trim() || rule.sensitivity.resultUnit !== rule.unit || !rule.sensitivity.engineVersion?.trim() || !Array.isArray(rule.sensitivity.sourceRefs) || !rule.sensitivity.sourceRefs.length)) return false
  return rule.schema === "sf-criterion-rule-v1" && typeof rule.ruleRef === "string" && !!rule.caseRef && typeof rule.criterionId === "string" && typeof rule.metricRef === "string" && (rule.operator === "lte" || rule.operator === "gte" || rule.operator === "eq") && typeof rule.value === "number" && Number.isFinite(rule.value) && typeof rule.unit === "string" && !!rule.period && isSfPeriod(rule.period) && Array.isArray(rule.evidenceRefs) && !!rule.evidenceRefs.length && Number.isSafeInteger(rule.version) && Number(rule.version) > 0 && typeof rule.criterionDigest === "string" && /^[a-f0-9]{64}$/.test(rule.criterionDigest) && typeof rule.recordDigest === "string" && /^[a-f0-9]{64}$/.test(rule.recordDigest) && typeof rule.principalRef === "string" && !!rule.principalRef.trim() && typeof rule.accessRevision === "string" && typeof rule.policyVersion === "string" && typeof rule.installationId === "string" && typeof rule.projectId === "string" && typeof rule.createdAt === "string" && Number.isFinite(Date.parse(rule.createdAt))
}

export type CriterionResultBinding = { schema: "sf-criterion-result-v1"; caseRef: CaseRef; resultRef: string; resultDigest: string; request: import("../contracts/operations.ts").SensitivityRequest; requestDigest: string; criterionId: string; ruleRef: string; ruleVersion: number; principalRef: string; accessRevision: string; policyVersion: string; createdAt: string; bindingDigest: string }

/** Binds an immutable C08 sensitivity result to the exact rule revision used to produce it. */
export function createCriterionResultBindings(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  rules: ReturnType<typeof createCriterionRuleRegistry>
  results: ReturnType<typeof import("./result-store.ts").createSfDecisionResultStore>
  authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  verifyBinding: (binding: CriterionResultBinding, rule: CriterionRule, result: import("./result-store.ts").StoredDecisionResult, context: TrustedDomainContext) => Promise<boolean>
  verifySnapshot: (snapshot: Snapshot, binding: CriterionResultBinding, rule: CriterionRule, context: TrustedDomainContext) => boolean
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  proposalCoverageWrites: WeakSet<object>
  now: () => string
}) {
  const read = async (request: { caseRef: CaseRef; resultRef: string }, context: TrustedDomainContext): Promise<PortResult<CriterionResultBinding>> => {
    try {
      const source = input.host.requestFor(context)
      if (!source || !request.resultRef.trim() || source.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "criterion-result-access-unavailable" }
      const readBinding = () => input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? state.preferences[resultBindingKey(request.resultRef)] : undefined)
      const saved = await readBinding()
      if (saved.status !== "ok" || !isResultBinding(saved.value)) return { status: "unavailable", reason: "criterion-result-binding-unavailable" }
      const binding = saved.value
      if (binding.resultRef !== request.resultRef || digestSfValue(binding.caseRef) !== digestSfValue(request.caseRef) || binding.bindingDigest !== resultBindingDigest(binding) || binding.requestDigest !== digestSfValue(binding.request) || !decodeSensitivity(binding.request)) return { status: "unavailable", reason: "criterion-result-binding-invalid" }
      const rule = await input.rules.resolve({ caseRef: request.caseRef, criterionId: binding.criterionId }, context)
      const result = await input.results.read({ resultRef: request.resultRef, kind: "sensitivity" }, context)
      if (rule.status !== "ok" || result.status !== "ok" || rule.value.ruleRef !== binding.ruleRef || rule.value.version !== binding.ruleVersion || result.value.kind !== "sensitivity" || result.value.requestDigest !== binding.requestDigest || result.value.resultDigest !== binding.resultDigest || !await input.verifyBinding(binding, rule.value, result.value, context)) return { status: "stale", reason: "criterion-result-changed" }
      const again = await readBinding()
      const ruleAgain = await input.rules.resolve({ caseRef: request.caseRef, criterionId: binding.criterionId }, context)
      const resultAgain = await input.results.read({ resultRef: request.resultRef, kind: "sensitivity" }, context)
      if (again.status !== "ok" || !isResultBinding(again.value) || digestSfValue(again.value) !== digestSfValue(binding) || ruleAgain.status !== "ok" || digestSfValue(ruleAgain.value) !== digestSfValue(rule.value) || resultAgain.status !== "ok" || digestSfValue(resultAgain.value) !== digestSfValue(result.value) || !await input.verifyBinding(binding, ruleAgain.value, resultAgain.value, context) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "criterion-result-changed" }
      return { status: "ok", value: structuredClone(binding) }
    } catch {
      return { status: "unavailable", reason: "criterion-result-binding-unavailable" }
    }
  }
  const bind = async (incoming: { caseRef: CaseRef; resultRef: string; criterionId: string; expectedRuleRef: string; expectedRuleVersion: number; expectedRuleDigest: string; request: import("../contracts/operations.ts").SensitivityRequest }, context: TrustedDomainContext): Promise<PortResult<CriterionResultBinding>> => {
    try {
      const request = structuredClone(incoming)
      const source = input.host.requestFor(context)
      const operation = input.operationIdentity(context)
      if (!source || !operation || !request.resultRef.trim() || !request.criterionId.trim() || !request.expectedRuleRef.trim() || !Number.isSafeInteger(request.expectedRuleVersion) || request.expectedRuleVersion < 1 || !/^[a-f0-9]{64}$/.test(request.expectedRuleDigest) || !decodeSensitivity(request.request) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "criterion-result-access-unavailable" }
      const rule = await input.rules.resolve({ caseRef: request.caseRef, criterionId: request.criterionId }, context)
      const result = await input.results.read({ resultRef: request.resultRef, kind: "sensitivity" }, context)
      if (rule.status !== "ok") return rule
      if (result.status !== "ok") return result
      const criterion = rule.value
      const stored = result.value
      if (criterion.ruleRef !== request.expectedRuleRef || criterion.version !== request.expectedRuleVersion || digestSfValue(criterion) !== request.expectedRuleDigest || stored.kind !== "sensitivity" || stored.requestDigest !== digestSfValue(request.request) || digestSfValue(stored.caseRef) !== digestSfValue(request.caseRef) || request.request.criterion.id !== criterion.criterionId || request.request.criterion.operator !== criterion.operator || request.request.criterion.value !== criterion.value || !criterion.sensitivity || request.request.parameterBounds.parameterRef !== criterion.sensitivity.parameterRef || stored.result.scenarioRef !== request.request.scenarioRef || stored.result.bounds.minimum !== request.request.parameterBounds.minimum || stored.result.bounds.maximum !== request.request.parameterBounds.maximum || stored.result.bounds.steps !== request.request.parameterBounds.steps || stored.result.parameterRef !== criterion.sensitivity.parameterRef || stored.result.engineVersion !== criterion.sensitivity.engineVersion || stored.result.parameterUnit !== criterion.sensitivity.parameterUnit || stored.result.resultUnit !== criterion.sensitivity.resultUnit) return { status: "conflict", reason: "criterion-result-mismatch" }
      const cases = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.caseRef.id] : undefined)
      const preferences = await input.state.read(source, "preferences", (_state, authority) => sameAuthority(authority, context))
      if (cases.status !== "ok" || preferences.status !== "ok" || !preferences.value || !allowed(cases.value, request.caseRef, context) || !await input.authorizeCase(cases.value!, context)) return { status: "denied", reason: "criterion-result-access-unavailable" }
      const value = { schema: "sf-criterion-result-v1" as const, caseRef: request.caseRef, resultRef: request.resultRef, resultDigest: stored.resultDigest, request: request.request, requestDigest: stored.requestDigest, criterionId: request.criterionId, ruleRef: criterion.ruleRef, ruleVersion: criterion.version, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, createdAt: input.now(), bindingDigest: "" }
      const binding: CriterionResultBinding = { ...value, bindingDigest: resultBindingDigest(value) }
      if (!Number.isFinite(Date.parse(binding.createdAt)) || !await input.verifyBinding(binding, criterion, stored, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "criterion-result-access-unavailable" }
      const work = async (state: SfProductState, authority: SfStateAuthority, snapshot: Snapshot) => {
        const currentCase = state.cases[request.caseRef.id]
        const currentRule = state.preferences[criterionRuleKey(request.caseRef, request.criterionId)]
        const currentResult = state.decisionResults?.[request.resultRef]
        if (!sameAuthority(authority, context) || !allowed(currentCase, request.caseRef, context) || !isRule(currentRule) || digestSfValue(currentRule) !== digestSfValue(criterion) || !currentResult || digestSfValue(currentResult) !== digestSfValue(stored) || !input.verifySnapshot(snapshot, binding, criterion, context)) return { commit: false, value: null }
        const key = resultBindingKey(request.resultRef)
        const prior = state.preferences[key]
        if (prior !== undefined) return { commit: false, value: null }
        state.preferences[key] = binding
        return { commit: true, value: binding }
      }
      input.proposalCoverageWrites.add(work)
      const saved = await input.state.transaction(source, { namespace: "preferences", domainSurface: "planner", expectedStorageVersion: preferences.storageVersion, additionalNamespaces: [{ namespace: "cases", expectedStorageVersion: cases.storageVersion }], targetRef: request.caseRef.id, targetIncarnation: request.caseRef.incarnation, idempotencyKey: `criterion-result:${operation}`, commandDigest: digestSfValue(request) }, work).finally(() => input.proposalCoverageWrites.delete(work))
      if (saved.status !== "ok" || !saved.value) return { status: saved.status === "preview" || saved.status === "conflict" ? "conflict" : "unavailable", reason: "criterion-result-binding-unavailable" }
      return read({ caseRef: request.caseRef, resultRef: request.resultRef }, context)
    } catch {
      return { status: "unavailable", reason: "criterion-result-binding-unavailable" }
    }
  }
  return { bind, read }
}

function resultBindingKey(resultRef: string) { return `sf:criterion-rule:result:${digestSfValue(resultRef)}` }
function resultBindingDigest(binding: CriterionResultBinding) { return digestSfValue(Object.fromEntries(Object.entries(binding).filter(([key]) => key !== "bindingDigest"))) }
function isResultBinding(value: unknown): value is CriterionResultBinding {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const binding = value as Partial<CriterionResultBinding>
  return binding.schema === "sf-criterion-result-v1" && !!binding.caseRef && typeof binding.resultRef === "string" && typeof binding.resultDigest === "string" && typeof binding.requestDigest === "string" && !!binding.request && typeof binding.criterionId === "string" && typeof binding.ruleRef === "string" && Number.isSafeInteger(binding.ruleVersion) && typeof binding.bindingDigest === "string"
}
function decodeSensitivity(request: import("../contracts/operations.ts").SensitivityRequest) {
  return decodeSfOperationInput("sf_sensitivity_evaluate", request).ok
}
