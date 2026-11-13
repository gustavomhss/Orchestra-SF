import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import type { DecisionCase } from "../contracts/decisions.ts"
import type { ScenarioCompareRequest } from "../contracts/operations.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority } from "../contracts/state.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import type { createSfDecisionResultStore, StoredDecisionResult } from "./result-store.ts"
import { criterionRuleKey } from "./criterion-rules.ts"
import type { createCriterionRuleRegistry } from "./criterion-rules.ts"

type CaseRef = { id: string; incarnation: string; version: number }
export type ComparisonRuleProof = { criterionId: string; ruleRef: string | null; version: number | null; digest: string | null }
export type CriterionComparisonBinding = { schema: "sf-criterion-comparison-v1"; caseRef: CaseRef; resultRef: string; resultDigest: string; request: ScenarioCompareRequest; requestDigest: string; rules: readonly ComparisonRuleProof[]; principalRef: string; accessRevision: string; policyVersion: string; createdAt: string; bindingDigest: string }

/** Compare and Portfolio share the same protected, versioned rule evidence. */
export function createCriterionComparisonBindings(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  rules: ReturnType<typeof createCriterionRuleRegistry>
  results: ReturnType<typeof createSfDecisionResultStore>
  authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  verifyBinding: (binding: CriterionComparisonBinding, result: StoredDecisionResult, context: TrustedDomainContext) => Promise<boolean>
  verifySnapshot: (snapshot: Snapshot, binding: CriterionComparisonBinding, context: TrustedDomainContext) => boolean
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  proposalCoverageWrites: WeakSet<object>
  now: () => string
}) {
  const proofs = async (caseRef: CaseRef, criteria: readonly string[], context: TrustedDomainContext): Promise<PortResult<ComparisonRuleProof[]>> => {
    const resolved = await Promise.all(criteria.map(async (criterionId) => ({ criterionId, value: await input.rules.resolve({ caseRef, criterionId }, context) })))
    if (resolved.some((item) => item.value.status !== "ok" && !(item.value.status === "needs-input" && item.value.reason === "criterion-rule-unavailable"))) return { status: "unavailable", reason: "comparison-rule-unavailable" }
    return { status: "ok", value: resolved.map((item) => item.value.status === "ok" ? { criterionId: item.criterionId, ruleRef: item.value.value.ruleRef, version: item.value.value.version, digest: digestSfValue(item.value.value) } : { criterionId: item.criterionId, ruleRef: null, version: null, digest: null }) }
  }
  const validate = async (binding: CriterionComparisonBinding, context: TrustedDomainContext) => {
    const stored = await input.results.read({ resultRef: binding.resultRef, kind: "comparison" }, context)
    const rules = await proofs(binding.caseRef, binding.request.criteria, context)
    if (stored.status !== "ok" || stored.value.kind !== "comparison" || stored.value.resultDigest !== binding.resultDigest || stored.value.requestDigest !== binding.requestDigest || digestSfValue(stored.value.caseRef) !== digestSfValue(binding.caseRef) || rules.status !== "ok" || digestSfValue(rules.value) !== digestSfValue(binding.rules) || stored.value.result.baselineResultRef !== binding.request.scenarioRefs[0] || stored.value.result.alternativeResultRef !== binding.request.scenarioRefs[1] || !await input.verifyBinding(binding, stored.value, context)) return undefined
    const comparison = stored.value.result
    const checks = await Promise.all(binding.request.criteria.map((criterionId) => input.rules.evaluate({ caseRef: binding.caseRef, criterionId, baselineRef: binding.request.scenarioRefs[0], scenarioRef: binding.request.scenarioRefs[1]! }, context)))
    if (comparison.criterionResults.length !== checks.length || checks.some((check, index) => { if (check.status !== "ok") return true; const evaluated = check.value; return comparison.criterionResults.filter((item) => item.criterionId === binding.request.criteria[index] && item.state === evaluated.state && item.reason === evaluated.reason).length !== 1 })) return undefined
    return stored.value
  }
  const read = async (request: { caseRef: CaseRef; resultRef: string }, context: TrustedDomainContext): Promise<PortResult<CriterionComparisonBinding>> => {
    try {
      const source = input.host.requestFor(context)
      if (!source || !request.resultRef.trim() || source.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "comparison-binding-access-unavailable" }
      const readBinding = () => input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? state.preferences[comparisonBindingKey(request.resultRef)] : undefined)
      const current = await readBinding()
      if (current.status !== "ok" || !isComparisonBinding(current.value)) return { status: "unavailable", reason: "comparison-binding-unavailable" }
      const binding = current.value
      if (binding.resultRef !== request.resultRef || digestSfValue(binding.caseRef) !== digestSfValue(request.caseRef) || binding.bindingDigest !== comparisonBindingDigest(binding) || binding.requestDigest !== digestSfValue(binding.request) || !decodeSfOperationInput("sf_scenario_compare", binding.request).ok) return { status: "unavailable", reason: "comparison-binding-invalid" }
      const first = await validate(binding, context)
      if (!first) return { status: "stale", reason: "comparison-rule-or-source-changed" }
      const again = await readBinding()
      const second = await validate(binding, context)
      if (again.status !== "ok" || !isComparisonBinding(again.value) || digestSfValue(again.value) !== digestSfValue(binding) || !second || digestSfValue(second) !== digestSfValue(first) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "comparison-rule-or-source-changed" }
      return { status: "ok", value: structuredClone(binding) }
    } catch { return { status: "unavailable", reason: "comparison-binding-unavailable" } }
  }
  const bind = async (incoming: { caseRef: CaseRef; resultRef: string; request: ScenarioCompareRequest; expectedRules: readonly ComparisonRuleProof[] }, context: TrustedDomainContext): Promise<PortResult<CriterionComparisonBinding>> => {
    try {
      const request = structuredClone(incoming)
      const source = input.host.requestFor(context)
      const operation = input.operationIdentity(context)
      if (!source || !operation || !request.resultRef.trim() || !decodeSfOperationInput("sf_scenario_compare", request.request).ok || request.request.scenarioRefs.length !== 2 || new Set(request.request.criteria).size !== request.request.criteria.length || source.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "comparison-binding-access-unavailable" }
      const currentRules = await proofs(request.caseRef, request.request.criteria, context)
      const result = await input.results.read({ resultRef: request.resultRef, kind: "comparison" }, context)
      if (currentRules.status !== "ok" || result.status !== "ok" || result.value.kind !== "comparison" || digestSfValue(currentRules.value) !== digestSfValue(request.expectedRules) || result.value.requestDigest !== digestSfValue(request.request) || digestSfValue(result.value.caseRef) !== digestSfValue(request.caseRef)) return { status: "conflict", reason: "comparison-binding-mismatch" }
      const stored = result.value
      const cases = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.caseRef.id] : undefined)
      const preferences = await input.state.read(source, "preferences", (_state, authority) => sameAuthority(authority, context))
      if (cases.status !== "ok" || preferences.status !== "ok" || !preferences.value || !allowed(cases.value, request.caseRef, context) || !await input.authorizeCase(cases.value!, context)) return { status: "denied", reason: "comparison-binding-access-unavailable" }
      const value = { schema: "sf-criterion-comparison-v1" as const, caseRef: request.caseRef, resultRef: request.resultRef, resultDigest: stored.resultDigest, request: request.request, requestDigest: stored.requestDigest, rules: currentRules.value, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, createdAt: input.now(), bindingDigest: "" }
      const binding: CriterionComparisonBinding = { ...value, bindingDigest: comparisonBindingDigest(value) }
      if (!Number.isFinite(Date.parse(binding.createdAt)) || !await validate(binding, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "comparison-binding-unavailable" }
      const work = async (state: SfProductState, authority: SfStateAuthority, snapshot: Snapshot) => {
        if (!sameAuthority(authority, context) || !allowed(state.cases[request.caseRef.id], request.caseRef, context) || !state.decisionResults?.[request.resultRef] || digestSfValue(state.decisionResults[request.resultRef]) !== digestSfValue(stored) || !binding.rules.every((proof) => { const current = state.preferences[criterionRuleKey(request.caseRef, proof.criterionId)]; return proof.ruleRef === null ? current === undefined : !!current && digestSfValue(current) === proof.digest }) || !input.verifySnapshot(snapshot, binding, context)) return { commit: false, value: null }
        const key = comparisonBindingKey(request.resultRef)
        if (state.preferences[key] !== undefined) return { commit: false, value: null }
        state.preferences[key] = binding
        return { commit: true, value: binding }
      }
      input.proposalCoverageWrites.add(work)
      const saved = await input.state.transaction(source, { namespace: "preferences", domainSurface: "planner", expectedStorageVersion: preferences.storageVersion, additionalNamespaces: [{ namespace: "cases", expectedStorageVersion: cases.storageVersion }], targetRef: request.caseRef.id, targetIncarnation: request.caseRef.incarnation, idempotencyKey: `criterion-comparison:${operation}`, commandDigest: digestSfValue(request) }, work).finally(() => input.proposalCoverageWrites.delete(work))
      if (saved.status !== "ok" || !saved.value) return { status: saved.status === "preview" || saved.status === "conflict" ? "conflict" : "unavailable", reason: "comparison-binding-unavailable" }
      return read({ caseRef: request.caseRef, resultRef: request.resultRef }, context)
    } catch { return { status: "unavailable", reason: "comparison-binding-unavailable" } }
  }
  return { bind, read, proofs }
}
function sameAuthority(authority: SfStateAuthority, context: TrustedDomainContext) { return authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision }
function allowed(value: DecisionCase | undefined, ref: CaseRef, context: TrustedDomainContext) { return !!value && value.id === ref.id && value.incarnation === ref.incarnation && value.version === ref.version && value.participants.includes(context.binding.principalRef) && (context.kind !== "native" || (context.binding.caseId === value.id && context.binding.caseIncarnation === value.incarnation && context.binding.caseVersion === value.version)) }
function comparisonBindingKey(resultRef: string) { return `sf:criterion-rule:result:${digestSfValue({ kind: "comparison", resultRef })}` }
function comparisonBindingDigest(binding: CriterionComparisonBinding) { return digestSfValue(Object.fromEntries(Object.entries(binding).filter(([key]) => key !== "bindingDigest"))) }
function isComparisonBinding(value: unknown): value is CriterionComparisonBinding { if (!value || typeof value !== "object" || Array.isArray(value)) return false; const binding = value as Partial<CriterionComparisonBinding>; return binding.schema === "sf-criterion-comparison-v1" && !!binding.caseRef && typeof binding.resultRef === "string" && typeof binding.resultDigest === "string" && !!binding.request && typeof binding.requestDigest === "string" && Array.isArray(binding.rules) && typeof binding.bindingDigest === "string" }
