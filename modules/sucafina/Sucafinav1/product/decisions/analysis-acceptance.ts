import { digestSfContribution, digestSfValue } from "../contracts/canonical.ts"
import { enqueueSfLedgerEvent } from "../integration/ledger-outbox.ts"
import type { DecisionCase } from "../contracts/decisions.ts"
import type { ContributionEnvelope } from "../contracts/resident-ai.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfNativeRunRecord, SfProductStatePort } from "../contracts/state.ts"
import type { Snapshot } from "../../runtime/contract.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type Request = { caseRef: CaseRef; outputRef: string; runRef: string; rationale: string }
type Accepted = { caseRef: CaseRef }

/** Records a human's acceptance of an already persisted native output; it does not start a run. */
export function createAnalysisAcceptance(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  readContribution: (request: { outputRef: string; caseRef: CaseRef }, context: TrustedDomainContext) => Promise<PortResult<{ output: ContributionEnvelope; run: SfNativeRunRecord }>>
  authorizeAcceptance: (request: Request, context: TrustedDomainContext) => Promise<boolean>
  confirmAcceptance: (request: Request, output: ContributionEnvelope, context: TrustedDomainContext) => Promise<boolean>
  verifyAcceptance: (snapshot: Snapshot, request: Request, output: ContributionEnvelope, context: TrustedDomainContext) => boolean
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  createId: () => string
  now: () => string
}) {
  return async (incoming: Request, context: TrustedDomainContext): Promise<PortResult<Accepted>> => {
    const request = structuredClone(incoming)
    if (context.kind !== "ui") return { status: "denied", reason: "human-acceptance-required" }
    if (!request.outputRef.trim() || !request.runRef.trim() || !request.rationale.trim()) return { status: "needs-input", reason: "acceptance-input-required" }
    if (!await input.authorizeAcceptance(request, context).catch(() => false)) return { status: "denied", reason: "human-acceptance-required" }
    const source = input.host.requestFor(context)
    const operation = input.operationIdentity(context)
    if (!source || !operation || source.signal.aborted || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "invalid-authority" }
    const commandDigest = digestSfValue(request)
    const current = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? { value: state.cases[request.caseRef.id], prior: state.transactions[JSON.stringify([authority.principalRef, "cases", request.caseRef.id, `${operation}:accept-analysis`])] } : undefined).catch(() => undefined)
    if (!current || current.status !== "ok") return { status: "unavailable", reason: "case-unavailable" }
    const decision = current.value?.value
    if (!decision || decision.incarnation !== request.caseRef.incarnation || !decision.participants.includes(context.binding.principalRef) || !await input.authorizeCase(decision, context).catch(() => false)) return { status: "denied", reason: "case-access-unavailable" }
    if (current.value?.prior) {
      const prior = current.value.prior
      if (prior.commandDigest !== commandDigest || prior.targetIncarnation !== request.caseRef.incarnation) return { status: "conflict", reason: "idempotency-content-changed" }
      const saved = prior.value
      if (!saved || typeof saved !== "object" || !("id" in saved) || !("incarnation" in saved) || !("version" in saved) || saved.id !== decision.id || saved.incarnation !== decision.incarnation || !Number.isSafeInteger(saved.version) || !await input.host.revalidate(context).catch(() => false)) return { status: "unavailable", reason: "invalid-acceptance-receipt" }
      if (!("ledger" in saved) || !Array.isArray(saved.ledger)) return { status: "unavailable", reason: "invalid-acceptance-receipt" }
      const events = (saved as unknown as DecisionCase).ledger.filter((event) => event.kind === "analysis-accepted" && event.analysisRunId === request.runRef && event.caseRef.id === decision.id && event.caseRef.incarnation === decision.incarnation && event.caseRef.version === saved.version && event.principalRef === context.binding.principalRef)
      if (events.length !== 1 || !/^[a-f0-9]{64}$/.test(events[0]!.outputDigest) || decision.ledger.filter((event) => event.id === events[0]!.id && digestSfValue(event) === digestSfValue(events[0])).length !== 1 || !await input.host.revalidate(context).catch(() => false)) return { status: "unavailable", reason: "acceptance-event-unavailable" }
      return { status: "ok", value: { caseRef: { id: decision.id, incarnation: decision.incarnation, version: Number(saved.version) } } }
    }
    if (decision.version !== request.caseRef.version) return { status: "stale", reason: "case-changed" }
    const contribution = await input.state.read(source, "contributions", (_state, authority) => sameAuthority(authority, context)).catch(() => undefined)
    const outbox = await input.state.read(source, "outbox", (_state, authority) => sameAuthority(authority, context)).catch(() => undefined)
    if (!contribution || contribution.status !== "ok" || !contribution.value || !outbox || outbox.status !== "ok" || !outbox.value) return { status: "unavailable", reason: "acceptance-state-unavailable" }
    const resolved = await input.readContribution({ outputRef: request.outputRef, caseRef: request.caseRef }, context).catch(() => ({ status: "unavailable" as const, reason: "contribution-unavailable" }))
    if (resolved.status !== "ok") return resolved
    const output = resolved.value.output
    const run = resolved.value.run
    if (!matches(output, run, request, context) || !await input.confirmAcceptance(request, output, context).catch(() => false) || !await input.authorizeCase(decision, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "human-acceptance-unavailable" }
    const event = { id: input.createId(), caseRef: { id: decision.id, incarnation: decision.incarnation, version: decision.version + 1 }, kind: "analysis-accepted" as const, principalRef: context.binding.principalRef, at: input.now(), analysisRunId: run.runRef, consideredActions: [], factualGaps: [], lifecycleState: decision.state, rationale: request.rationale, evidenceRefs: output.evidenceRefs, outputDigest: output.outputDigest }
    if (!event.id.trim() || !Number.isFinite(Date.parse(event.at))) return { status: "unavailable", reason: "acceptance-identity-unavailable" }
    const saved = await input.state.transaction(source, { namespace: "cases", expectedStorageVersion: current.storageVersion, additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: outbox.storageVersion }], targetRef: decision.id, targetIncarnation: decision.incarnation, idempotencyKey: `${operation}:accept-analysis`, commandDigest }, async (state, authority, snapshot) => {
      const actual = state.cases[decision.id]
      const stored = state.contributions[request.outputRef]
      const storedRun = state.nativeRuns?.[request.runRef]
      if (!sameAuthority(authority, context) || !input.verifyAcceptance(snapshot, request, output, context) || !actual || actual.incarnation !== decision.incarnation || actual.version !== decision.version || !actual.participants.includes(context.binding.principalRef) || !stored || !storedRun || digestSfValue(stored) !== digestSfValue(output) || digestSfValue(storedRun) !== digestSfValue(run) || !matches(stored, storedRun, request, context) || actual.ledger.some((item) => item.id === event.id || (item.kind === "analysis-accepted" && item.outputDigest === event.outputDigest && item.analysisRunId === event.analysisRunId))) return { commit: false, value: null }
      const updated = { ...actual, version: actual.version + 1, ledger: [...actual.ledger, event] }
      state.cases[actual.id] = updated
      if (enqueueSfLedgerEvent(state, event, { installationId: context.binding.installationId, projectId: context.binding.projectId, authority }).status !== "ok") return { commit: false, value: null }
      return { commit: true, value: updated }
    }).catch(() => undefined)
    if (!saved || saved.status !== "ok" || !saved.value) return { status: saved?.status === "conflict" || saved?.status === "preview" ? "conflict" : "unavailable", reason: "acceptance-not-committed" }
    if (!await input.authorizeCase(saved.value, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "case-access-unavailable" }
    return { status: "ok", value: { caseRef: { id: saved.value.id, incarnation: saved.value.incarnation, version: saved.value.version } } }
  }
}

function sameAuthority(authority: { principalRef: string; policyVersion: string; accessRevision: string }, context: TrustedDomainContext) {
  return authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision
}

function matches(output: ContributionEnvelope, run: SfNativeRunRecord, request: Request, context: TrustedDomainContext) {
  try {
  if (output.id !== request.outputRef || output.state !== "ready" || output.accessRevision !== context.binding.accessRevision || digestSfContribution(output) !== output.outputDigest || digestSfValue(output.caseRef) !== digestSfValue(request.caseRef) || run.runRef !== request.runRef || run.state !== "ready" || run.outputRef !== output.id || run.principalRef !== context.binding.principalRef || run.accessRevision !== context.binding.accessRevision || run.policyVersion !== context.binding.policyVersion || digestSfValue(run.caseRef) !== digestSfValue(request.caseRef) || !run.native || run.native.sessionID !== run.native.skillReceipt.nativeSessionId || run.runRef !== run.native.skillReceipt.runId || run.native.skillReceipt.runId !== output.runProvenance.runId) return false
  return digestSfValue(run.native.skillReceipt) === digestSfValue(Object.fromEntries(Object.keys(run.native.skillReceipt).map((key) => [key, output.runProvenance[key as keyof typeof output.runProvenance]])))
  } catch {
    return false
  }
}
