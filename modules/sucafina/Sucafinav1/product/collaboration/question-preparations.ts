import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import type { QuestionProposal } from "../contracts/outputs.ts"
import type { Period } from "../contracts/context.ts"
import type { DecisionCasePort, DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { BoundCapabilityReceipt, TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import { parseCaseRef } from "../decisions/case-port.ts"

export type QuestionCaseProof = { caseRef: { id: string; incarnation: string; version: number }; caseDigest: string; horizon: Period }
type CaseInput = { host: Pick<DomainPortHost, "requestFor" | "revalidate">; state: SfProductStatePort; cases: Pick<DecisionCasePort, "read"> }
export type PreparedQuestion = { kind: "prepared"; result: QuestionProposal; receipt: BoundCapabilityReceipt }
type Stored = QuestionCaseProof & { prepared: PreparedQuestion; bindingDigest: string; issuedAt: number; expiresAt: number }

/** Capture the protected case, including fields omitted from its authorized presentation. */
export async function readQuestionCase(input: CaseInput, proposal: QuestionProposal, context: TrustedDomainContext): Promise<PortResult<QuestionCaseProof>> {
  const identity = parseCaseRef(proposal.caseRef)
  const request = input.host.requestFor(context)
  if (!identity || !request || !await input.host.revalidate(context)) return { status: "denied", reason: "question-case-unavailable" }
  const read = () => input.state.read(request, "cases", (state, actor) => actor.principalRef === context.binding.principalRef && actor.accessRevision === context.binding.accessRevision && actor.policyVersion === context.binding.policyVersion ? state.cases[identity.id] : undefined)
  const before = await read()
  if (before.status !== "ok" || !before.value || before.value.id !== identity.id || before.value.incarnation !== identity.incarnation) return { status: "unavailable", reason: "question-case-unavailable" }
  if (before.value.version !== proposal.expectedCaseVersion) return { status: "stale", reason: "question-case-changed" }
  const authorized = await input.cases.read({ caseRef: proposal.caseRef }, context)
  if (authorized.status !== "ok") return authorized
  const current = authorized.value.case
  if (current.id !== identity.id || current.incarnation !== identity.incarnation || current.version !== proposal.expectedCaseVersion) return { status: "stale", reason: "question-case-changed" }
  if (proposal.criterionRef && !current.criteria.some((criterion) => criterion.id === proposal.criterionRef)) return { status: "needs-input", reason: "question-criterion-unavailable" }
  if (!proposal.evidenceRefs.length || new Set(proposal.evidenceRefs.map((ref) => ref.refId)).size !== proposal.evidenceRefs.length || proposal.evidenceRefs.some((ref) => !authorized.value.evidenceRefs.some((allowed) => digestSfValue(allowed) === digestSfValue(ref)))) return { status: "denied", reason: "question-evidence-outside-case" }
  const again = await read()
  if (again.status !== "ok" || !again.value || digestSfValue(again.value) !== digestSfValue(before.value) || !await input.host.revalidate(context)) return { status: "stale", reason: "question-case-changed" }
  return { status: "ok", value: { caseRef: { ...identity, version: current.version }, caseDigest: digestSfValue(before.value), horizon: structuredClone(current.horizon) } }
}

/** UI preparation receipts are private, bounded observations, not native C11 contributions. */
export function createQuestionPreparations(input: CaseInput & { now: () => number }) {
  const records = new Map<string, Stored>()
  const binding = (context: TrustedDomainContext) => digestSfValue({ installationId: context.binding.installationId, projectId: context.binding.projectId, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion })
  const current = (value: Stored) => { const at = input.now(); return Number.isFinite(at) && at >= value.issuedAt && at < value.expiresAt }
  const check = (prepared: PreparedQuestion, context: TrustedDomainContext) => {
    const value = records.get(prepared.receipt.callId)
    return context.kind === "ui" && !!value && current(value) && value.bindingDigest === binding(context) && digestSfValue(prepared) === digestSfValue(value.prepared)
  }
  return {
    check,
    record: async (result: QuestionProposal, receipt: BoundCapabilityReceipt, context: TrustedDomainContext): Promise<boolean> => {
      // Native results must return through the canonical contribution reader after C11 persistence.
      if (context.kind === "native") return receipt.kind === "native"
      const decoded = decodeSfOperationOutput("sf_question_prepare", result)
      if (!decoded.ok || receipt.kind !== "ui" || receipt.operation !== "sf_question_prepare" || receipt.handlerExport !== "prepareQuestion" || receipt.principalRef !== context.binding.principalRef || receipt.accessRevision !== context.binding.accessRevision || receipt.requestId !== context.binding.requestId || receipt.resultDigest !== digestSfValue(decoded.value) || !receipt.callId.trim()) return false
      const proof = await readQuestionCase(input, decoded.value, context)
      if (proof.status !== "ok") return false
      const issuedAt = input.now()
      if (!Number.isFinite(issuedAt) || !await input.host.revalidate(context)) return false
      for (const [key, value] of records) if (!current(value)) records.delete(key)
      const prior = records.get(receipt.callId)
      if (prior) return check({ kind: "prepared", result: decoded.value, receipt }, context) && digestSfValue(proof.value) === digestSfValue({ caseRef: prior.caseRef, caseDigest: prior.caseDigest, horizon: prior.horizon })
      if (records.size >= 512) return false
      const stored: Stored = { ...proof.value, prepared: structuredClone({ kind: "prepared", result: decoded.value, receipt }), bindingDigest: binding(context), issuedAt, expiresAt: issuedAt + 300_000 }
      if (!current(stored)) return false
      records.set(receipt.callId, stored)
      return true
    },
    read: async (prepared: PreparedQuestion, context: TrustedDomainContext): Promise<PortResult<QuestionCaseProof>> => {
      const value = records.get(prepared.receipt.callId)
      if (!value || !check(prepared, context) || !await input.host.revalidate(context) || !check(prepared, context)) return { status: "unavailable", reason: "question-preparation-unavailable" }
      return { status: "ok", value: structuredClone({ caseRef: value.caseRef, caseDigest: value.caseDigest, horizon: value.horizon }) }
    },
  }
}
