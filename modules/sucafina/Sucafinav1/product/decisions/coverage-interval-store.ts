import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessContextService } from "../contracts/business-context.ts"
import type { DecisionCase } from "../contracts/decisions.ts"
import type { SensitivityRequest } from "../contracts/operations.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority } from "../contracts/state.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import { classificationKey, type CoverageClassification } from "./coverage-classification.ts"
import { criterionRuleKey, type CriterionRule } from "./criterion-rules.ts"
import { createCoverageIntervalCertificate, type CoverageIntervalCertificate, type PlannerDirectIntervalProof } from "./coverage-interval.ts"
import { selectionKey, type createDecisionPortfolioSelection } from "./portfolio-selection.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type Request = { caseRef: CaseRef; selectionRef: string; classificationSourceRef: string; sensitivity: SensitivityRequest }
type Record = { schema: "sf-coverage-interval-record-v1"; request: Request; certificate: CoverageIntervalCertificate; recordDigest: string }
const key = (digest: string) => `sf:proposal-coverage:interval:${digest}`
const recordDigest = (record: Record) => digestSfValue({ schema: record.schema, request: record.request, certificate: record.certificate })

/** Uses a real Planner structural proof and current C10 records; unsupported coverage remains unavailable. */
export function createCoverageIntervalRegistry(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  evidence: Pick<BusinessContextService, "context">
  selection: ReturnType<typeof createDecisionPortfolioSelection>
  authorizeCase: (decision: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  issueProof: (request: SensitivityRequest, baselineRef: string, context: TrustedDomainContext) => Promise<PortResult<PlannerDirectIntervalProof>>
  verifySnapshot: (snapshot: Snapshot, request: Request, certificate: CoverageIntervalCertificate, proof: PlannerDirectIntervalProof, context: TrustedDomainContext) => boolean
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  writes: WeakSet<object>
}) {
  const prepare = async (request: Request, context: TrustedDomainContext) => {
    const source = input.host.requestFor(context)
    if (!source || !await input.host.revalidate(context)) return undefined
    const current = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? { decision: state.cases[request.caseRef.id], result: state.decisionResults?.[request.sensitivity.scenarioRef] } : undefined)
    const preferences = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? { rule: state.preferences[criterionRuleKey(request.caseRef, request.sensitivity.criterion.id)], classification: state.preferences[classificationKey(request.caseRef, request.classificationSourceRef)], selection: state.preferences[selectionKey(request.caseRef)] } : undefined)
    if (current.status !== "ok" || !current.value?.decision || preferences.status !== "ok" || !preferences.value || !preferences.value.rule || !preferences.value.classification) return undefined
    const decision = current.value.decision
    const result = current.value.result
    const rule = preferences.value.rule as CriterionRule
    const classification = preferences.value.classification as CoverageClassification
    if (decision.id !== request.caseRef.id || decision.incarnation !== request.caseRef.incarnation || decision.version !== request.caseRef.version || !decision.participants.includes(context.binding.principalRef) || !await input.authorizeCase(decision, context) || !result || result.kind !== "scenario" || digestSfValue(result.caseRef) !== digestSfValue(request.caseRef) || result.resultDigest !== digestSfValue(result.result) || rule.criterionId !== request.sensitivity.criterion.id || rule.operator !== request.sensitivity.criterion.operator || rule.value !== request.sensitivity.criterion.value || !rule.sensitivity || classification.source.refId !== request.classificationSourceRef) return undefined
    const selected = await input.selection.read({ caseRef: request.caseRef }, context)
    if (selected.status !== "ok" || selected.value.selectionRef !== request.selectionRef || selected.value.alternativeRef !== request.sensitivity.scenarioRef || digestSfValue(preferences.value.selection) !== digestSfValue(selected.value)) return undefined
    const alternatives = decision.alternatives.filter((item) => item.id === selected.value.alternativeId)
    if (alternatives.length !== 1 || result.requestDigest !== digestSfValue(alternatives[0]!.scenario) || result.resultDigest !== digestSfValue(alternatives[0]!.result)) return undefined
    const proof = await input.issueProof(request.sensitivity, rule.sensitivity.baselineRef, context)
    if (proof.status !== "ok" || proof.value.scenarioRef !== request.sensitivity.scenarioRef || proof.value.parameterRef !== request.sensitivity.parameterBounds.parameterRef || proof.value.minimum !== request.sensitivity.parameterBounds.minimum || proof.value.maximum !== request.sensitivity.parameterBounds.maximum) return undefined
    const refs = [classification.source, ...proof.value.sourceRefs, ...classification.basis.sourceRefs, ...result.result.costCoverage.evaluatedSourceRefs, ...result.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs), ...rule.evidenceRefs, ...rule.sensitivity.sourceRefs]
    const evidence = await input.evidence.context({ refs }, context)
    const certificate = createCoverageIntervalCertificate({ decision, selection: selected.value, scenario: alternatives[0]!.scenario, storedResult: result.result, rule, structural: proof.value, assessment: result.result.costCoverage, basis: classification.basis, classification, evidence, context })
    const again = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? { decision: state.cases[request.caseRef.id], result: state.decisionResults?.[request.sensitivity.scenarioRef] } : undefined)
    const preferencesAgain = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? { rule: state.preferences[criterionRuleKey(request.caseRef, request.sensitivity.criterion.id)], classification: state.preferences[classificationKey(request.caseRef, request.classificationSourceRef)], selection: state.preferences[selectionKey(request.caseRef)] } : undefined)
    if (!certificate || again.status !== "ok" || !again.value?.decision || digestSfValue(again.value.decision) !== digestSfValue(decision) || digestSfValue(again.value.result) !== digestSfValue(result) || preferencesAgain.status !== "ok" || !preferencesAgain.value || digestSfValue(preferencesAgain.value) !== digestSfValue(preferences.value) || !await input.authorizeCase(again.value.decision, context) || source.signal.aborted || !await input.host.revalidate(context)) return undefined
    return { source, current, preferences, decision, result, rule, classification, proof: proof.value, certificate }
  }
  const register = async (incoming: Request, context: TrustedDomainContext): Promise<PortResult<{ certificateRef: string; certificate: CoverageIntervalCertificate }>> => {
    try {
      const request = structuredClone(incoming)
      const operation = input.operationIdentity(context)
      if (!operation || !request.selectionRef.trim() || !request.classificationSourceRef.trim()) return { status: "denied", reason: "interval-access-unavailable" }
      const ready = await prepare(request, context)
      if (!ready) return { status: "unavailable", reason: "interval-coverage-unproven" }
      const certificateRef = `coverage-interval:${ready.certificate.certificateDigest}`
      const value: Record = { schema: "sf-coverage-interval-record-v1", request, certificate: ready.certificate, recordDigest: "" }
      const record = { ...value, recordDigest: recordDigest(value) }
      const work = async (state: SfProductState, authority: SfStateAuthority, snapshot: Snapshot) => {
        const actual = state.cases[request.caseRef.id]
        const result = state.decisionResults?.[request.sensitivity.scenarioRef]
        const rule = state.preferences[criterionRuleKey(request.caseRef, request.sensitivity.criterion.id)]
        const classification = state.preferences[classificationKey(request.caseRef, request.classificationSourceRef)]
        const selection = state.preferences[selectionKey(request.caseRef)]
        const previous = state.preferences[key(ready.certificate.certificateDigest)]
        if (!sameAuthority(authority, context) || !actual || digestSfValue(actual) !== digestSfValue(ready.decision) || !result || digestSfValue(result) !== digestSfValue(ready.result) || digestSfValue(rule) !== digestSfValue(ready.rule) || digestSfValue(classification) !== digestSfValue(ready.classification) || digestSfValue(selection) !== ready.certificate.selectionDigest || previous && digestSfValue(previous) !== digestSfValue(record) || !input.verifySnapshot(snapshot, request, ready.certificate, ready.proof, context)) return { commit: false, value: null }
        state.preferences[key(ready.certificate.certificateDigest)] = record
        return { commit: true, value: { certificateRef, certificate: ready.certificate } }
      }
      input.writes.add(work)
      const saved = await input.state.transaction(ready.source, { namespace: "preferences", domainSurface: "planner", expectedStorageVersion: ready.preferences.storageVersion, additionalNamespaces: [{ namespace: "cases", expectedStorageVersion: ready.current.storageVersion }], targetRef: request.caseRef.id, targetIncarnation: request.caseRef.incarnation, idempotencyKey: `coverage-interval:${operation}`, commandDigest: digestSfValue(request) }, work).finally(() => input.writes.delete(work))
      if (saved.status !== "ok" || !saved.value) return { status: saved.status === "conflict" || saved.status === "preview" ? "conflict" : "unavailable", reason: "interval-coverage-unavailable" }
      const checked = await read(certificateRef, context)
      return checked.status === "ok" ? { status: "ok", value: { certificateRef, certificate: checked.value } } : checked
    } catch { return { status: "unavailable", reason: "interval-coverage-unavailable" } }
  }
  const read = async (certificateRef: string, context: TrustedDomainContext): Promise<PortResult<CoverageIntervalCertificate>> => {
    try {
      const match = /^coverage-interval:([a-f0-9]{64})$/.exec(certificateRef)
      const source = input.host.requestFor(context)
      if (!match || !source || !await input.host.revalidate(context)) return { status: "denied", reason: "interval-access-unavailable" }
      const loaded = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? state.preferences[key(match[1]!)] : undefined)
      if (loaded.status !== "ok" || !loaded.value || typeof loaded.value !== "object") return { status: "unavailable", reason: "interval-coverage-unavailable" }
      const record = loaded.value as Record
      if (record.schema !== "sf-coverage-interval-record-v1" || record.recordDigest !== recordDigest(record) || record.certificate.certificateDigest !== match[1]) return { status: "unavailable", reason: "interval-coverage-unavailable" }
      const ready = await prepare(record.request, context)
      if (!ready || digestSfValue(ready.certificate) !== digestSfValue(record.certificate)) return { status: "stale", reason: "interval-coverage-changed" }
      const again = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? state.preferences[key(match[1]!)] : undefined)
      if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(record) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "interval-coverage-changed" }
      return { status: "ok", value: structuredClone(record.certificate) }
    } catch { return { status: "unavailable", reason: "interval-coverage-unavailable" } }
  }
  return { register, read }
}

function sameAuthority(authority: SfStateAuthority, context: TrustedDomainContext) {
  return authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision
}
