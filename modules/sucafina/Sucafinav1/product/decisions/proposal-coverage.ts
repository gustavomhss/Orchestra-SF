import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { CostCoverageAssessment, CostCoverageBasis, DecisionCase, ScenarioResult } from "../contracts/decisions.ts"
import type { DomainPortHost, PlannerSourceHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority } from "../contracts/state.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import type { ScenarioRequest } from "../contracts/operations.ts"
import { encodeCaseRef, parseCaseRef } from "./case-port.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import { validateScenarioCoverage } from "./cost-coverage.ts"

export type ProposalCoverage = {
  schema: "sf-proposal-coverage-v1"
  ref: string
  caseRef: { id: string; incarnation: string; version: number }
  basis: CostCoverageBasis
  assessment: CostCoverageAssessment
  result: ScenarioResult
  scenario: ScenarioRequest
  sourceRefs: readonly BusinessEvidenceRef[]
  inputDigest: string
  principalRef: string
  accessRevision: string
  policyVersion: string
  installationId: string
  projectId: string
  createdAt: string
  recordDigest: string
}
type Register = { caseRef: string; expectedCaseVersion: number; basis: CostCoverageBasis; assessment: CostCoverageAssessment; result: ScenarioResult; scenario: ScenarioRequest }
type Coverage = { coverageRef: string; basis: CostCoverageBasis; assessment: CostCoverageAssessment }
export type RegisteredProposalCoverage = { coverageRef: string; readback: { coverage: Coverage; storedRecordDigest: string } }
type CommittedCoverage = { digest: string; current: () => boolean }

/** Private C08 registry; callbacks must prove the assessment and its sources, not trust caller data. */
export function createProposalCoverageRegistry(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  verifyEvidence: (record: ProposalCoverage, context: TrustedDomainContext) => Promise<boolean>
  verifyCommittedEvidence?: (record: ProposalCoverage, context: TrustedDomainContext) => Promise<boolean | undefined>
  verifySnapshot: (snapshot: Snapshot, record: ProposalCoverage, context: TrustedDomainContext) => boolean
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  proposalCoverageWrites: WeakSet<object>
  now: () => string
}) {
  const readCoverage = async (reference: string, context: TrustedDomainContext, committed?: CommittedCoverage): Promise<PortResult<RegisteredProposalCoverage["readback"]>> => {
    try {
      if (!/^proposal-coverage:[a-f0-9]{64}$/.test(reference)) return { status: "needs-input", reason: "invalid-coverage-reference" }
      const source = input.host.requestFor(context)
      if (!source || source.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "coverage-access-unavailable" }
      const read = () => input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? state.preferences[`sf:proposal-coverage:${reference}`] : undefined)
      const current = await read()
      if (current.status !== "ok" || !isRecord(current.value)) return { status: "unavailable", reason: "coverage-unavailable" }
      const record = current.value
      const storedRecordDigest = digestSfValue(record)
      if (committed && (committed.digest !== storedRecordDigest || !committed.current())) return { status: "stale", reason: "coverage-changed" }
      const caseRead = () => input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[record.caseRef.id] : undefined)
      const caseState = await caseRead()
      if (caseState.status !== "ok") return { status: "unavailable", reason: "coverage-unavailable" }
      const decision = caseState.value
      if (!decodeSfOperationInput("sf_scenario_simulate", record.scenario).ok || !decodeSfOperationOutput("sf_scenario_simulate", record.result).ok || validateScenarioCoverage(record.result, record.basis, record.assessment) || record.ref !== reference || record.recordDigest !== recordDigest(record) || record.installationId !== context.binding.installationId || record.projectId !== context.binding.projectId || record.principalRef !== context.binding.principalRef || record.accessRevision !== context.binding.accessRevision || record.policyVersion !== context.binding.policyVersion || record.inputDigest !== digestSfValue({ caseRef: encodeCaseRef(record.caseRef), expectedCaseVersion: record.caseRef.version, basis: record.basis, assessment: record.assessment, result: record.result, scenario: record.scenario }) || !allowed(decision, record.caseRef, context) || !await input.authorizeCase(decision!, context) || !await input.verifyEvidence(record, context)) return { status: "denied", reason: "coverage-access-unavailable" }
      const again = await read()
      const caseAgain = await caseRead()
      if (again.status !== "ok" || !isRecord(again.value) || digestSfValue(again.value) !== storedRecordDigest || caseAgain.status !== "ok" || !allowed(caseAgain.value, record.caseRef, context) || digestSfValue(caseAgain.value) !== digestSfValue(decision) || !await input.authorizeCase(caseAgain.value!, context)) return { status: "stale", reason: "coverage-changed" }
      // The installed writer can recheck the pinned source facts for the same
      // row after the first full post-commit verification. Other reads replay.
      if (committed && !committed.current()) return { status: "stale", reason: "coverage-changed" }
      const verified = committed ? await input.verifyCommittedEvidence?.(again.value, context) : undefined
      if (!(verified ?? await input.verifyEvidence(again.value, context)) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "coverage-changed" }
      if (committed) {
        const finalCoverage = await read()
        const finalCase = await caseRead()
        if (!committed.current() || finalCoverage.status !== "ok" || digestSfValue(finalCoverage.value) !== storedRecordDigest ||
            finalCase.status !== "ok" || digestSfValue(finalCase.value) !== digestSfValue(decision)) return { status: "stale", reason: "coverage-changed" }
      }
      return { status: "ok", value: { coverage: { coverageRef: reference, basis: structuredClone(record.basis), assessment: structuredClone(record.assessment) },
        storedRecordDigest } }
    } catch {
      return { status: "unavailable", reason: "coverage-unavailable" }
    }
  }
  const resolveForecastCoverage: PlannerSourceHost["resolveForecastCoverage"] = async (reference, context) => {
    const read = await readCoverage(reference, context)
    return read.status === "ok" ? { status: "ok", value: read.value.coverage } : read
  }
  const registerProposalCoverageWithReadback = async (incoming: Register, context: TrustedDomainContext): Promise<PortResult<RegisteredProposalCoverage>> => {
    try {
      const request = structuredClone(incoming)
      const caseRef = parseCaseRef(request.caseRef)
      const source = input.host.requestFor(context)
      const operation = input.operationIdentity(context)
      if (!caseRef || !Number.isSafeInteger(request.expectedCaseVersion) || request.expectedCaseVersion < 1 || !source || !operation || source.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "coverage-access-unavailable" }
      if (!decodeSfOperationInput("sf_scenario_simulate", request.scenario).ok || !decodeSfOperationOutput("sf_scenario_simulate", request.result).ok || validateScenarioCoverage(request.result, request.basis, request.assessment) || !request.basis.id.trim() || !Number.isSafeInteger(request.basis.version) || request.basis.version < 0 || request.assessment.basisId !== request.basis.id || request.assessment.basisVersion !== request.basis.version || !request.assessment.alternativeId.trim() || !Number.isSafeInteger(request.assessment.alternativeVersion) || request.assessment.alternativeVersion < 0) return { status: "needs-input", reason: "invalid-coverage" }
      const current = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[caseRef.id] : undefined)
      const preferences = await input.state.read(source, "preferences", (_state, authority) => sameAuthority(authority, context))
      if (current.status !== "ok" || preferences.status !== "ok" || !preferences.value) return { status: "unavailable", reason: "coverage-state-unavailable" }
      const decision = current.value
      if (!decision || decision.incarnation !== caseRef.incarnation || decision.version !== request.expectedCaseVersion || !decision.participants.includes(context.binding.principalRef) || (context.kind === "native" && (context.binding.caseId !== decision.id || context.binding.caseIncarnation !== decision.incarnation || context.binding.caseVersion !== decision.version)) || !await input.authorizeCase(decision, context)) return { status: "denied", reason: "coverage-access-unavailable" }
      const ref = `proposal-coverage:${digestSfValue({ installationId: context.binding.installationId, projectId: context.binding.projectId, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, caseRef: { ...caseRef, version: decision.version }, operation, request })}`
      const sourceRefs = [...request.basis.sourceRefs, ...request.result.sourceRefs, ...request.scenario.assumptions.flatMap((item) => item.evidenceRefs), ...request.assessment.evaluatedSourceRefs, ...request.assessment.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)].filter((item, index, all) => all.findIndex((other) => digestSfValue(other) === digestSfValue(item)) === index)
      const value = { schema: "sf-proposal-coverage-v1" as const, ref, caseRef: { ...caseRef, version: decision.version }, basis: request.basis, assessment: request.assessment, result: request.result, scenario: request.scenario, sourceRefs, inputDigest: digestSfValue(request), principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, installationId: context.binding.installationId, projectId: context.binding.projectId, createdAt: input.now(), recordDigest: "" }
      const record: ProposalCoverage = { ...value, recordDigest: recordDigest(value) }
      if (!Number.isFinite(Date.parse(record.createdAt)) || !await input.verifyEvidence(record, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "coverage-evidence-unavailable" }
      const write = { applied: false }
      const lease = context.lease
      const bindingDigest = digestSfValue(context.binding)
      const work = async (state: SfProductState, authority: SfStateAuthority, snapshot: Snapshot) => {
        const actual = state.cases[decision.id]
        if (!sameAuthority(authority, context) || !allowed(actual, record.caseRef, context) || !input.verifySnapshot(snapshot, record, context)) return { commit: false, value: null }
        const key = `sf:proposal-coverage:${ref}`
        if (state.preferences[key]) return { commit: false, value: null }
        state.preferences[key] = record
        write.applied = true
        return { commit: true, value: { coverageRef: ref } }
      }
      input.proposalCoverageWrites.add(work)
      const saved = await input.state.transaction(source, { namespace: "preferences", domainSurface: "planner", expectedStorageVersion: preferences.storageVersion, additionalNamespaces: [{ namespace: "cases", expectedStorageVersion: current.storageVersion }], targetRef: decision.id, targetIncarnation: decision.incarnation, idempotencyKey: `proposal-coverage:${operation}`, commandDigest: digestSfValue({ request, caseRef: record.caseRef }) }, work).finally(() => input.proposalCoverageWrites.delete(work))
      if (saved.status !== "ok" || !saved.value) return { status: saved.status === "conflict" || saved.status === "preview" ? "conflict" : "unavailable", reason: "coverage-registration-unavailable" }
      const commitStillCurrent = () => input.host.requestFor(context) === source && !source.signal.aborted && context.lease === lease &&
        digestSfValue(context.binding) === bindingDigest && input.operationIdentity(context) === operation
      const fresh = !!input.verifyCommittedEvidence && write.applied
      if (fresh && (saved.value.coverageRef !== ref || !commitStillCurrent())) return { status: "unavailable", reason: "coverage-proof-unavailable" }
      const committed = fresh ? { digest: digestSfValue(record), current: commitStillCurrent } : undefined
      const proof = await readCoverage(saved.value.coverageRef, context, committed)
      if (proof.status !== "ok" || digestSfValue(proof.value.coverage.basis) !== digestSfValue(request.basis) || digestSfValue(proof.value.coverage.assessment) !== digestSfValue(request.assessment)) return { status: "unavailable", reason: "coverage-proof-unavailable" }
      return { status: "ok", value: { coverageRef: saved.value.coverageRef, readback: proof.value } }
    } catch {
      return { status: "unavailable", reason: "coverage-registration-unavailable" }
    }
  }
  const registerProposalCoverage = async (request: Register, context: TrustedDomainContext): Promise<PortResult<{ coverageRef: string }>> => {
    const registered = await registerProposalCoverageWithReadback(request, context)
    return registered.status === "ok" ? { status: "ok", value: { coverageRef: registered.value.coverageRef } } : registered
  }
  return { registerProposalCoverage, registerProposalCoverageWithReadback, resolveForecastCoverage }
}

function sameAuthority(authority: { principalRef: string; policyVersion: string; accessRevision: string }, context: TrustedDomainContext) {
  return authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision
}
function allowed(value: DecisionCase | undefined, ref: ProposalCoverage["caseRef"], context: TrustedDomainContext) {
  return !!value && value.id === ref.id && value.incarnation === ref.incarnation && value.version === ref.version && value.participants.includes(context.binding.principalRef) && (context.kind !== "native" || (context.binding.caseId === value.id && context.binding.caseIncarnation === value.incarnation && context.binding.caseVersion === value.version))
}
function recordDigest(record: ProposalCoverage) {
  return digestSfValue(Object.fromEntries(Object.entries(record).filter(([key]) => key !== "recordDigest")))
}
function isRecord(value: unknown): value is ProposalCoverage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const record = value as Partial<ProposalCoverage>
  return record.schema === "sf-proposal-coverage-v1" && typeof record.ref === "string" && !!record.caseRef && typeof record.caseRef.id === "string" && typeof record.caseRef.incarnation === "string" && Number.isSafeInteger(record.caseRef.version) && !!record.basis && !!record.assessment && !!record.result && !!record.scenario && Array.isArray(record.sourceRefs) && typeof record.inputDigest === "string" && typeof record.principalRef === "string" && typeof record.accessRevision === "string" && typeof record.policyVersion === "string" && typeof record.installationId === "string" && typeof record.projectId === "string" && typeof record.createdAt === "string" && typeof record.recordDigest === "string"
}
