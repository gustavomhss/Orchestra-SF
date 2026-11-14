import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import type { ContributionEnvelope } from "../contracts/resident-ai.ts"
import type { DecisionCase } from "../contracts/decisions.ts"
import type { DomainPortHost, PlannerSourceHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfNativeRunRecord, SfProductStatePort } from "../contracts/state.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import { enqueueSfLedgerEvent } from "../integration/ledger-outbox.ts"
import { validateAnalysisContribution } from "./analysis-acceptance.ts"
import { encodeCaseRef } from "./case-port.ts"
import { validateScenarioCoverage } from "./cost-coverage.ts"
import { decisionScenarioResultRef } from "./mutations.ts"

type CaseRef = { id: string; incarnation: string; version: number }
export type AnalysisPromotionRequest = { caseRef: CaseRef; outputRef: string; runRef: string; outputDigest: string; rationale: string }

/** An explicit human confirmation records the exact C11 alternative and its provenance atomically. */
export function createAnalysisAlternativePromotion(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  sources: Pick<PlannerSourceHost, "resolveForecastCoverage">
  authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  authorizePromotion: (request: AnalysisPromotionRequest, context: TrustedDomainContext) => Promise<boolean>
  readContribution: (request: { outputRef: string; caseRef: CaseRef }, context: TrustedDomainContext) => Promise<PortResult<{ output: ContributionEnvelope; run: SfNativeRunRecord }>>
  verifyProposal: (output: ContributionEnvelope, run: SfNativeRunRecord, context: TrustedDomainContext) => Promise<boolean>
  verifySnapshot: (snapshot: Snapshot, request: AnalysisPromotionRequest, output: ContributionEnvelope, run: SfNativeRunRecord, context: TrustedDomainContext) => boolean
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  createId: () => string
  now: () => string
}) {
  return async (incoming: AnalysisPromotionRequest, context: TrustedDomainContext): Promise<PortResult<{ caseRef: CaseRef; resultRef: string }>> => {
    try {
      const request = structuredClone(incoming)
      const source = input.host.requestFor(context)
      const operation = input.operationIdentity(context)
      if (context.kind !== "ui" || !source || !operation || !request.outputRef.trim() || !request.runRef.trim() || !request.rationale.trim() || !/^[a-f0-9]{64}$/.test(request.outputDigest) || !await input.authorizePromotion(request, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "analysis-promotion-access-unavailable" }
      const current = await input.state.read(source, "cases", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? { decision: state.cases[request.caseRef.id], results: state.decisionResults, prior: state.transactions[JSON.stringify([authority.principalRef, "cases", request.caseRef.id, `${operation}:promote-analysis`])] } : undefined)
      if (current.status !== "ok" || !current.value?.decision || current.value.decision.incarnation !== request.caseRef.incarnation || !current.value.decision.participants.includes(context.binding.principalRef) || !await input.authorizeCase(current.value.decision, context)) return { status: "denied", reason: "analysis-promotion-access-unavailable" }
      const decision = current.value.decision
      if (current.value.prior) {
        const prior = current.value.prior
        if (prior.commandDigest !== digestSfValue(request) || prior.targetIncarnation !== request.caseRef.incarnation) return { status: "conflict", reason: "idempotency-content-changed" }
        const saved = prior.value
        if (!saved || typeof saved !== "object" || !("caseRef" in saved) || !("resultRef" in saved) || typeof saved.resultRef !== "string" || !saved.caseRef || typeof saved.caseRef !== "object" || !("version" in saved.caseRef) || !("id" in saved.caseRef) || saved.caseRef.id !== request.caseRef.id || !("incarnation" in saved.caseRef) || saved.caseRef.incarnation !== request.caseRef.incarnation || !Number.isSafeInteger(saved.caseRef.version)) return { status: "unavailable", reason: "analysis-promotion-receipt-unavailable" }
        const events = decision.ledger.filter((event) => event.kind === "analysis-accepted" && event.analysisRunId === request.runRef && event.outputDigest === request.outputDigest && event.consideredActions.includes(`output:${request.outputRef}`) && event.caseRef.version === saved.caseRef.version)
        const result = current.value.results?.[saved.resultRef]
        if (events.length !== 1 || !result || result.kind !== "scenario" || result.caseRef.id !== request.caseRef.id || result.caseRef.incarnation !== request.caseRef.incarnation || result.caseRef.version !== saved.caseRef.version || result.resultDigest !== digestSfValue(result.result) || !await input.authorizePromotion(request, context) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "analysis-promotion-receipt-unavailable" }
        return { status: "ok", value: { caseRef: { id: request.caseRef.id, incarnation: request.caseRef.incarnation, version: Number(saved.caseRef.version) }, resultRef: saved.resultRef } }
      }
      if (decision.version !== request.caseRef.version) return { status: "stale", reason: "case-changed" }
      const contribution = await input.readContribution({ outputRef: request.outputRef, caseRef: request.caseRef }, context)
      if (contribution.status !== "ok") return contribution
      const output = contribution.value.output
      const run = contribution.value.run
      if (String(output.kind) !== "AlternativeDraft" || output.state !== "ready" || output.outputDigest !== request.outputDigest || !validateAnalysisContribution(output, run, request, context) || !await input.verifyProposal(output, run, context)) return { status: "denied", reason: "analysis-proposal-unavailable" }
      const decoded = decodeSfOperationOutput("sf_alternative_draft", output.payload)
      if (!decoded.ok || decoded.value.caseRef !== encodeCaseRef(request.caseRef) || decoded.value.domainApplied !== false) return { status: "conflict", reason: "analysis-proposal-mismatch" }
      const alternative = decoded.value.proposal
      const existing = decision.alternatives.filter((item) => item.id === alternative.id)
      if (!alternative.id.trim() || existing.length > 1 || alternative.version !== (existing[0]?.version ?? 0) + 1 || alternative.result.costCoverage.alternativeId !== alternative.id || alternative.result.costCoverage.alternativeVersion !== alternative.version || alternative.result.currency !== decision.currency || digestSfValue(alternative.result.horizon) !== digestSfValue(decision.horizon)) return { status: "conflict", reason: "analysis-alternative-conflict" }
      const coverage = await input.sources.resolveForecastCoverage(decoded.value.coverageRef, context)
      if (coverage.status !== "ok") return coverage
      if (coverage.value.coverageRef !== decoded.value.coverageRef || digestSfValue(coverage.value.basis) !== digestSfValue(decoded.value.costCoverageBasis) || digestSfValue(coverage.value.assessment) !== digestSfValue(alternative.result.costCoverage) || validateScenarioCoverage(alternative.result, coverage.value.basis, coverage.value.assessment)) return { status: "conflict", reason: "analysis-coverage-changed" }
      const existingBasis = decision.costCoverageBases.find((basis) => basis.id === coverage.value.basis.id && basis.version === coverage.value.basis.version)
      if (existingBasis && digestSfValue(existingBasis) !== digestSfValue(coverage.value.basis)) return { status: "conflict", reason: "coverage-inventory-version-conflict" }
      const outbox = await input.state.read(source, "outbox", (_state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision)
      if (outbox.status !== "ok" || !outbox.value) return { status: "unavailable", reason: "analysis-promotion-outbox-unavailable" }
      const caseRef = { id: decision.id, incarnation: decision.incarnation, version: decision.version + 1 }
      const resultRef = decisionScenarioResultRef(caseRef, digestSfValue(alternative.scenario))
      const event = { id: input.createId(), caseRef, kind: "analysis-accepted" as const, principalRef: context.binding.principalRef, at: input.now(), analysisRunId: run.runRef, consideredActions: [`output:${output.id}`, `alternative:${alternative.id}:${alternative.version}`], factualGaps: [], lifecycleState: decision.choices.length ? "reconsidering" as const : "comparing" as const, rationale: request.rationale, evidenceRefs: output.evidenceRefs, outputDigest: output.outputDigest }
      if (!event.id.trim() || !Number.isFinite(Date.parse(event.at)) || !await input.authorizePromotion(request, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "analysis-promotion-access-unavailable" }
      const saved = await input.state.transaction(source, { namespace: "cases", domainSurface: "planner", expectedStorageVersion: current.storageVersion, additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: outbox.storageVersion }], targetRef: decision.id, targetIncarnation: decision.incarnation, idempotencyKey: `${operation}:promote-analysis`, commandDigest: digestSfValue(request) }, async (state, authority, snapshot) => {
        const actual = state.cases[decision.id]
        const stored = state.contributions[request.outputRef]
        const storedRun = state.nativeRuns?.[request.runRef]
        if (authority.principalRef !== context.binding.principalRef || authority.policyVersion !== context.binding.policyVersion || authority.accessRevision !== context.binding.accessRevision || !actual || actual.incarnation !== decision.incarnation || actual.version !== decision.version || !actual.participants.includes(context.binding.principalRef) || !stored || !storedRun || digestSfValue(stored) !== digestSfValue(output) || digestSfValue(storedRun) !== digestSfValue(run) || !validateAnalysisContribution(stored, storedRun, request, context) || !input.verifySnapshot(snapshot, request, stored, storedRun, context) || actual.ledger.some((item) => item.id === event.id || item.kind === "analysis-accepted" && item.analysisRunId === request.runRef && item.outputDigest === request.outputDigest) || state.decisionResults?.[resultRef]) return { commit: false, value: null }
        const next = { ...actual, version: caseRef.version, state: event.lifecycleState, alternatives: [...actual.alternatives.filter((item) => item.id !== alternative.id), alternative], costCoverageBases: actual.costCoverageBases.some((basis) => basis.id === coverage.value.basis.id && basis.version === coverage.value.basis.version) ? actual.costCoverageBases : [...actual.costCoverageBases, coverage.value.basis], sourceRefs: [...actual.sourceRefs, ...output.evidenceRefs].filter((ref, index, all) => all.findIndex((item) => digestSfValue(item) === digestSfValue(ref)) === index), ledger: [...actual.ledger, event] }
        const records = state.decisionResults ??= {}
        records[resultRef] = { schema: "sf-decision-result-v1", kind: "scenario", resultRef, caseRef, principalRef: authority.principalRef, accessRevision: authority.accessRevision, policyVersion: authority.policyVersion, requestDigest: digestSfValue(alternative.scenario), resultDigest: digestSfValue(alternative.result), sourceRefs: [...alternative.result.sourceRefs, ...alternative.result.costCoverage.evaluatedSourceRefs, ...alternative.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)].filter((ref, index, all) => all.findIndex((item) => digestSfValue(item) === digestSfValue(ref)) === index), createdAt: event.at, result: alternative.result }
        state.cases[actual.id] = next
        if (enqueueSfLedgerEvent(state, event, { installationId: context.binding.installationId, projectId: context.binding.projectId, authority }).status !== "ok") return { commit: false, value: null }
        return { commit: true, value: { caseRef, resultRef } }
      })
      if (saved.status !== "ok" || !saved.value) return { status: saved.status === "conflict" || saved.status === "preview" ? "conflict" : "unavailable", reason: "analysis-promotion-unavailable" }
      const confirmed = await input.state.read(source, "cases", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? { decision: state.cases[request.caseRef.id], result: state.decisionResults?.[resultRef] } : undefined)
      if (confirmed.status !== "ok" || !confirmed.value?.decision || confirmed.value.decision.incarnation !== request.caseRef.incarnation || confirmed.value.decision.version !== caseRef.version || !confirmed.value.decision.participants.includes(context.binding.principalRef) || confirmed.value.decision.ledger.filter((item) => item.id === event.id && digestSfValue(item) === digestSfValue(event)).length !== 1 || !confirmed.value.result || confirmed.value.result.resultDigest !== digestSfValue(alternative.result) || !await input.authorizeCase(confirmed.value.decision, context) || !await input.authorizePromotion(request, context) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "analysis-promotion-access-unavailable" }
      return { status: "ok", value: saved.value }
    } catch { return { status: "unavailable", reason: "analysis-promotion-unavailable" } }
  }
}
