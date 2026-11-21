import { digestSfContribution, digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { Period } from "../contracts/context.ts"
import type { QuestionProposal } from "../contracts/outputs.ts"
import type { DecisionCasePort, DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { SfProductState, SfProductStatePort } from "../contracts/state.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createSfContributionReader } from "../ai/contribution-reader.ts"
import type { createCollaborationAuthority } from "./authority.ts"
import type { CollaborationHumanAuthority } from "./human.ts"
import type { CollaborationMutationFence } from "./mutation-fence.ts"
import { isThread } from "./threads.ts"
import type { CollaborationThread } from "./threads.ts"
import { readQuestionCase } from "./question-preparations.ts"
import type { PreparedQuestion, QuestionCaseProof, createQuestionPreparations } from "./question-preparations.ts"

export type QuestionContribution = { kind: "contribution"; outputRef: string; outputDigest: string; caseRef: QuestionCaseProof["caseRef"]; result: QuestionProposal }
export type QuestionConsumption = {
  proposal: PreparedQuestion | QuestionContribution
  sourceRef: string
  period: Period
  mutation: { expectedStorageVersion: number; idempotencyKey: string }
}
type Origin = QuestionCaseProof & {
  schema: "sf-question-origin-v1"
  identity: string
  commandDigest: string
  proposalDigest: string
  principalRef: string
  installationId: string
  projectId: string
  criterionRef?: string
  provenance: { kind: "prepared"; callId: string; receiptDigest: string } | { kind: "contribution"; outputRef: string; outputDigest: string; runRef: string; runDigest: string; envelopeDigest: string }
}
export type ConsumedQuestion = CollaborationThread & { questionOrigin: Origin }

/** Consume a real preparation or an existing C11 object into the one canonical thread. */
export function createQuestionConsumer(input: {
  host: DomainPortHost
  state: SfProductStatePort
  cases: Pick<DecisionCasePort, "read">
  human: CollaborationHumanAuthority
  authority: ReturnType<typeof createCollaborationAuthority>
  preparations: Pick<ReturnType<typeof createQuestionPreparations>, "read" | "check">
  /** Existing C11 producer: no reader means native output consumption is unavailable. */
  readContribution?: ReturnType<typeof createSfContributionReader>
  fence: CollaborationMutationFence
  target: { ref: string; incarnation: string }
  createId: () => string
  now: () => string
}) {
  const resolve = async (source: QuestionConsumption["proposal"], context: TrustedDomainContext): Promise<PortResult<QuestionCaseProof & { provenance: Origin["provenance"] }>> => {
    if (source.kind === "prepared") {
      const prepared = await input.preparations.read(source, context)
      return prepared.status === "ok" ? { status: "ok", value: { ...prepared.value, provenance: { kind: "prepared", callId: source.receipt.callId, receiptDigest: digestSfValue(source.receipt) } } } : prepared
    }
    if (!input.readContribution) return { status: "unavailable", reason: "question-contribution-reader-unavailable" }
    const read = await input.readContribution({ outputRef: source.outputRef, caseRef: source.caseRef }, context)
    if (read.status !== "ok") return read
    const { output, run } = read.value
    if (output.kind !== "QuestionProposal" || output.state !== "ready" || output.id !== source.outputRef || output.outputDigest !== source.outputDigest || digestSfContribution(output) !== source.outputDigest || digestSfValue(output.caseRef) !== digestSfValue(source.caseRef) || digestSfValue(output.payload) !== digestSfValue(source.result) || digestSfValue(output.evidenceRefs) !== digestSfValue(source.result.evidenceRefs) || run.state !== "ready" || run.runRef !== output.runProvenance.runId || run.outputRef !== output.id || run.principalRef !== context.binding.principalRef || run.accessRevision !== context.binding.accessRevision || run.policyVersion !== context.binding.policyVersion) return { status: "unavailable", reason: "question-contribution-mismatch" }
    const proof = await readQuestionCase(input, source.result, context)
    if (proof.status !== "ok") return proof
    if (digestSfValue(proof.value.caseRef) !== digestSfValue(source.caseRef)) return { status: "stale", reason: "question-case-changed" }
    return { status: "ok", value: { ...proof.value, provenance: { kind: "contribution", outputRef: output.id, outputDigest: output.outputDigest, runRef: run.runRef, runDigest: digestSfValue(run), envelopeDigest: digestSfValue(output) } } }
  }
  const matches = (state: Readonly<SfProductState>, origin: Origin) => {
    const value = state.cases[origin.caseRef.id]
    const provenance = origin.provenance
    return !!value && value.version === origin.caseRef.version && value.incarnation === origin.caseRef.incarnation && digestSfValue(value) === origin.caseDigest && (provenance.kind === "prepared" || digestSfValue(state.contributions[provenance.outputRef]) === provenance.envelopeDigest && digestSfValue(state.nativeRuns?.[provenance.runRef]) === provenance.runDigest)
  }
  const authorize = async (selected: QuestionConsumption, origin: Origin, context: TrustedDomainContext) => {
    const proof = await readQuestionCase(input, selected.proposal.result, context)
    if (proof.status !== "ok" || !isSfPeriod(proof.value.horizon) || proof.value.horizon.start > selected.period.start || proof.value.horizon.end < selected.period.end || digestSfValue(proof.value) !== digestSfValue({ caseRef: origin.caseRef, caseDigest: origin.caseDigest, horizon: origin.horizon }) || !await input.authority.sources(selected.proposal.result.evidenceRefs, context)) return false
    const recipient = selected.proposal.result.recipientRef
    if (!recipient || !await input.authority.recipient(recipient, context) || !await input.authority.recipientSources(recipient, selected.proposal.result.evidenceRefs, context)) return false
    if (selected.proposal.kind === "contribution") {
      const current = await resolve(selected.proposal, context)
      if (current.status !== "ok" || digestSfValue(current.value.provenance) !== digestSfValue(origin.provenance)) return false
    }
    return input.host.revalidate(context)
  }
  return {
    readOutput: async (outputRef: string, caseRef: QuestionCaseProof["caseRef"], context: TrustedDomainContext): Promise<PortResult<QuestionContribution>> => {
      if (!text(outputRef) || !validCase(caseRef) || !input.readContribution) return { status: "unavailable", reason: "question-contribution-reader-unavailable" }
      const read = await input.readContribution({ outputRef, caseRef }, context)
      if (read.status !== "ok") return read
      const output = read.value.output
      if (output.kind !== "QuestionProposal" || output.state !== "ready") return { status: "unavailable", reason: "question-contribution-unavailable" }
      const source: QuestionContribution = { kind: "contribution", outputRef, caseRef: structuredClone(caseRef), outputDigest: output.outputDigest, result: structuredClone(output.payload) }
      const proof = await resolve(source, context)
      if (proof.status !== "ok") return proof
      if (!await input.authority.sources(source.result.evidenceRefs, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "question-source-unavailable" }
      return { status: "ok", value: source }
    },
    consume: async (command: QuestionConsumption, context: TrustedDomainContext): Promise<PortResult<ConsumedQuestion>> => {
      if (context.kind !== "ui") return { status: "denied", reason: "human-action-required" }
      if (!validCommand(command)) return { status: "needs-input", reason: "invalid-question-consumption" }
      const selected = structuredClone(command)
      const request = input.host.requestFor(context)
      if (!request || !await input.human.authorize(context, "collaboration.question.confirm", selected) || !await input.host.revalidate(context)) return { status: "denied", reason: "question-confirmation-unavailable" }
      const result = selected.proposal.result
      const source = result.evidenceRefs.find((ref) => ref.refId === selected.sourceRef)
      if (!source || source.kind !== "record" || !isSfPeriod(source.target.period) || digestSfValue(source.target.period) !== digestSfValue(selected.period) || !result.recipientRef) return { status: "needs-input", reason: "question-context-selection-required" }
      const identity = digestSfValue(selected.proposal.kind === "prepared" ? { kind: "prepared", receipt: selected.proposal.receipt } : { kind: "contribution", outputRef: selected.proposal.outputRef, caseRef: selected.proposal.caseRef })
      const commandDigest = digestSfValue({ proposal: selected.proposal, sourceRef: selected.sourceRef, period: selected.period })
      const existing = await input.state.read(request, "threads", (state, actor) => actor.principalRef === context.binding.principalRef && actor.accessRevision === context.binding.accessRevision && actor.policyVersion === context.binding.policyVersion ? Object.values(state.threads).filter(isConsumedQuestion).filter((thread) => thread.questionOrigin.identity === identity) : undefined)
      if (existing.status !== "ok" || !existing.value || existing.value.length > 1) return { status: "unavailable", reason: "question-state-unavailable" }
      const prior = existing.value[0]
      let origin: Origin
      if (prior) {
        origin = prior.questionOrigin
        if (origin.commandDigest !== commandDigest || origin.principalRef !== context.binding.principalRef || origin.installationId !== context.binding.installationId || origin.projectId !== context.binding.projectId) return { status: "conflict", reason: "question-consumption-changed" }
      } else {
        const proof = await resolve(selected.proposal, context)
        if (proof.status !== "ok") return proof
        origin = { ...proof.value, schema: "sf-question-origin-v1", identity, commandDigest, proposalDigest: digestSfValue(result), principalRef: context.binding.principalRef, installationId: context.binding.installationId, projectId: context.binding.projectId, ...(result.criterionRef ? { criterionRef: result.criterionRef } : {}) }
      }
      const fence = await input.fence.prepare(() => authorize(selected, origin, context))
      if (!fence) return { status: "unavailable", reason: "question-case-or-source-changed" }
      // A committed retry remains the same object after reload; a receipt alone cannot create it.
      if (prior) {
        const current = await input.state.read(request, "threads", (state, actor) => actor.principalRef === context.binding.principalRef && actor.accessRevision === context.binding.accessRevision && actor.policyVersion === context.binding.policyVersion && matches(state, origin) && digestSfValue(state.threads[prior.id]) === digestSfValue(prior) ? state.threads[prior.id] : undefined)
        if (current.status !== "ok" || !isConsumedQuestion(current.value) || !await authorize(selected, origin, context) || !await input.human.authorize(context, "collaboration.question.confirm", selected)) return { status: "unavailable", reason: "question-consumption-unavailable" }
        return { status: "ok", value: current.value }
      }
      const thread: ConsumedQuestion = { id: input.createId(), kind: "clarification", sourceRef: source.refId, sourceIncarnation: source.target.incarnation, observedVersion: source.target.version, period: selected.period, recipientRef: result.recipientRef, state: "open", evidenceRefs: result.evidenceRefs, messages: [{ id: input.createId(), incarnation: input.createId(), version: 1, authorRef: context.binding.principalRef, body: result.question, createdAt: input.now() }], questionOrigin: origin }
      if (!isConsumedQuestion(thread)) return { status: "unavailable", reason: "question-identity-unavailable" }
      const saved = await input.state.transaction(request, { namespace: "threads", ...selected.mutation, commandDigest, targetRef: input.target.ref, targetIncarnation: input.target.incarnation }, async (state, actor) => {
        if (actor.principalRef !== context.binding.principalRef || actor.accessRevision !== context.binding.accessRevision || actor.policyVersion !== context.binding.policyVersion || !await input.human.authorize(context, "collaboration.question.confirm", selected) || !matches(state, origin) || !input.fence.check(fence) || selected.proposal.kind === "prepared" && !input.preparations.check(selected.proposal, context) || !input.authority.checkRecipientAtCommit(result.recipientRef!, result.evidenceRefs, context) || state.threads[thread.id] || Object.values(state.threads).some((value) => isConsumedQuestion(value) && value.questionOrigin.identity === identity)) return { commit: false, value: null }
        state.threads[thread.id] = thread
        return { commit: true, value: thread }
      })
      if (saved.status === "preview") return { status: "conflict", reason: "question-not-committed" }
      if ("reason" in saved) return saved
      if (!isConsumedQuestion(saved.value) || saved.value.questionOrigin.commandDigest !== commandDigest || !await authorize(selected, origin, context) || !await input.human.authorize(context, "collaboration.question.confirm", selected)) return { status: "unavailable", reason: "question-consumption-unavailable" }
      const final = await input.state.read(request, "threads", (state, actor) => actor.principalRef === context.binding.principalRef && actor.accessRevision === context.binding.accessRevision && actor.policyVersion === context.binding.policyVersion && matches(state, origin) ? state.threads[saved.value!.id] : undefined)
      if (final.status !== "ok" || !isConsumedQuestion(final.value) || digestSfValue(final.value) !== digestSfValue(saved.value) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "question-consumption-unavailable" }
      return { status: "ok", value: final.value }
    },
  }
}

function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)) }
function keys(value: Record<string, unknown>, names: readonly string[]) { return Reflect.ownKeys(value).length === names.length && names.every((name) => Object.hasOwn(value, name)) }
function text(value: unknown): value is string { return typeof value === "string" && !!value.trim() }
function validCase(value: unknown): value is QuestionCaseProof["caseRef"] { return object(value) && keys(value, ["id", "incarnation", "version"]) && text(value.id) && text(value.incarnation) && Number.isSafeInteger(value.version) && Number(value.version) > 0 }
function validCommand(value: unknown): value is QuestionConsumption {
  if (!object(value) || !keys(value, ["proposal", "sourceRef", "period", "mutation"]) || !text(value.sourceRef) || !isSfPeriod(value.period) || !object(value.mutation) || !keys(value.mutation, ["expectedStorageVersion", "idempotencyKey"]) || !Number.isSafeInteger(value.mutation.expectedStorageVersion) || Number(value.mutation.expectedStorageVersion) < 0 || !text(value.mutation.idempotencyKey) || !object(value.proposal)) return false
  const proposal = value.proposal
  const result = decodeSfOperationOutput("sf_question_prepare", proposal.result)
  if (!result.ok || !result.value.question.trim() || !Number.isSafeInteger(result.value.expectedCaseVersion) || result.value.expectedCaseVersion < 1) return false
  if (proposal.kind === "contribution") return keys(proposal, ["kind", "outputRef", "outputDigest", "caseRef", "result"]) && text(proposal.outputRef) && typeof proposal.outputDigest === "string" && /^[a-f0-9]{64}$/.test(proposal.outputDigest) && validCase(proposal.caseRef)
  if (proposal.kind !== "prepared" || !keys(proposal, ["kind", "result", "receipt"]) || !object(proposal.receipt)) return false
  const receipt = proposal.receipt
  return keys(receipt, ["kind", "operation", "handlerExport", "inputDigest", "resultDigest", "principalRef", "callId", "accessRevision", "at", "requestId"]) && receipt.kind === "ui" && Object.values(receipt).every(text) && receipt.operation === "sf_question_prepare" && receipt.handlerExport === "prepareQuestion" && receipt.resultDigest === digestSfValue(result.value)
}
export function isConsumedQuestion(value: unknown): value is ConsumedQuestion {
  if (!isThread(value) || !("questionOrigin" in value) || !object(value.questionOrigin)) return false
  const origin = value.questionOrigin
  return origin.schema === "sf-question-origin-v1" && validCase(origin.caseRef) && isSfPeriod(origin.horizon) && [origin.identity, origin.commandDigest, origin.proposalDigest, origin.caseDigest, origin.principalRef, origin.installationId, origin.projectId].every(text) && object(origin.provenance) && (origin.provenance.kind === "prepared" ? [origin.provenance.callId, origin.provenance.receiptDigest].every(text) : origin.provenance.kind === "contribution" && [origin.provenance.outputRef, origin.provenance.outputDigest, origin.provenance.runRef, origin.provenance.runDigest, origin.provenance.envelopeDigest].every(text))
}
