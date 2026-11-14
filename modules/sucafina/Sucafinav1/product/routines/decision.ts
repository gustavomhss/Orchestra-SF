import { encodeCaseRef } from "../decisions/case-port.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { RoutineResult } from "../contracts/context.ts"
import type { BusinessPorts, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createDecisionMutations } from "../decisions/mutations.ts"
import type { AuthorizedRoutineArtifactResult, RoutineResultAccess } from "./result-access.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type DecisionRoutineBinding = { admissionRef: string; admissionVersion: number; documentId: string; publishedVersion: string; caseRef: CaseRef; runRef?: string }

/** The host resolves durable native admission facts and revalidates all sources, not model-supplied authority. */
export type DecisionRoutineHost = {
  cases: BusinessPorts["cases"]
  routines: BusinessPorts["routines"]
  resultAccess?: RoutineResultAccess
  binding: (admissionRef: string, context: TrustedDomainContext) => Promise<PortResult<DecisionRoutineBinding>>
  revalidate: (binding: DecisionRoutineBinding, context: TrustedDomainContext) => Promise<boolean>
}

/** Run only an already admitted workflow for the exact current case; the native port owns atomic retry. */
export async function startDecisionRoutine(incoming: { admissionRef: string; admissionVersion: number; caseRef: CaseRef; context: TrustedDomainContext; host: DecisionRoutineHost }): Promise<PortResult<RoutineResult>> {
  const input = { ...incoming, caseRef: structuredClone(incoming.caseRef) }
  if (input.context.kind === "native" && input.context.binding.entryMode === "routine-result") return { status: "denied", reason: "recursive-routine" }
  if (input.context.kind === "native" && !sameCase(input.caseRef, { id: input.context.binding.caseId, incarnation: input.context.binding.caseIncarnation, version: input.context.binding.caseVersion })) return { status: "denied", reason: "decision-access-unavailable" }
  const bound = await input.host.binding(input.admissionRef, input.context)
  if (bound.status !== "ok") return bound
  const binding = structuredClone(bound.value)
  if (!sameCase(binding.caseRef, input.caseRef) || binding.admissionRef !== input.admissionRef || binding.admissionVersion !== input.admissionVersion) return { status: "stale", reason: "decision-admission-changed" }
  const current = await input.host.cases.read({ caseRef: encodeCaseRef(input.caseRef) }, input.context)
  if (current.status !== "ok") return current
  if (!sameCase(current.value.case, input.caseRef)) return { status: "stale", reason: "decision-case-changed" }
  const admission = await input.host.routines.readAdmission(input.admissionRef, input.context)
  if (admission.status !== "ok") return admission
  const admitted = structuredClone(admission.value)
  if (!matches(admitted, binding, input.context)) return { status: "stale", reason: "decision-admission-changed" }
  if (!await input.host.revalidate(binding, input.context)) return { status: "denied", reason: "decision-access-unavailable" }
  const run = await input.host.routines.run({ admissionRef: input.admissionRef, expectedAdmissionVersion: input.admissionVersion, caseRef: structuredClone(input.caseRef) }, input.context)
  if (run.status !== "ok") return run
  const result = structuredClone(run.value)
  if (!result.runRef || !matches(result, binding, input.context) || !sameInputs(result, admitted) || (binding.runRef && result.runRef !== binding.runRef)) return { status: "unavailable", reason: "decision-run-unverified" }
  const persisted = await input.host.binding(input.admissionRef, input.context)
  if (persisted.status !== "ok") return persisted
  if (!sameBinding(persisted.value, binding) || persisted.value.runRef !== result.runRef) return { status: "unavailable", reason: "decision-run-unverified" }
  const observed = await input.host.cases.read({ caseRef: encodeCaseRef(input.caseRef) }, input.context)
  if (observed.status !== "ok") return observed
  if (!sameCase(observed.value.case, input.caseRef)) return { status: "stale", reason: "decision-case-changed" }
  if (!await input.host.revalidate(binding, input.context)) return { status: "denied", reason: "decision-access-unavailable" }
  return { status: "ok", value: result }
}

/** Re-read the native run and current case before exposing a result reference. */
export async function readDecisionRoutine(input: { admissionRef: string; runRef: string; caseRef: CaseRef; context: TrustedDomainContext; host: DecisionRoutineHost }): Promise<PortResult<RoutineResult>> {
  const result = await readDecisionRoutineOutput(input)
  return result.status === "ok" ? { status: "ok", value: result.value.run } : result
}

/** The decision consumer receives the same immutable artifact exposed by the authorized product reader. */
export async function readDecisionRoutineOutput(incoming: { admissionRef: string; runRef: string; caseRef: CaseRef; context: TrustedDomainContext; host: DecisionRoutineHost }): Promise<PortResult<AuthorizedRoutineArtifactResult>> {
  const input = { ...incoming, caseRef: structuredClone(incoming.caseRef) }
  if (input.context.kind === "native" && !sameCase(input.caseRef, { id: input.context.binding.caseId, incarnation: input.context.binding.caseIncarnation, version: input.context.binding.caseVersion })) return { status: "denied", reason: "decision-access-unavailable" }
  const bound = await input.host.binding(input.admissionRef, input.context)
  if (bound.status !== "ok") return bound
  const binding = structuredClone(bound.value)
  if (!sameCase(binding.caseRef, input.caseRef) || binding.admissionRef !== input.admissionRef || binding.runRef !== input.runRef) return { status: "stale", reason: "decision-run-changed" }
  const current = await input.host.cases.read({ caseRef: encodeCaseRef(input.caseRef) }, input.context)
  if (current.status !== "ok") return current
  if (!sameCase(current.value.case, input.caseRef)) return { status: "stale", reason: "decision-case-changed" }
  const admission = await input.host.routines.readAdmission(input.admissionRef, input.context)
  if (admission.status !== "ok") return admission
  const admitted = structuredClone(admission.value)
  if (!matches(admitted, binding, input.context)) return { status: "stale", reason: "decision-admission-changed" }
  if (!await input.host.revalidate(binding, input.context)) return { status: "denied", reason: "decision-access-unavailable" }
  const run = await input.host.routines.readRun(input.runRef, input.context)
  if (run.status !== "ok") return run
  const result = structuredClone(run.value)
  if (result.runRef !== input.runRef || !matches(result, binding, input.context) || !sameInputs(result, admitted)) return { status: "unavailable", reason: "decision-run-unverified" }
  if (!result.resultRef) return { status: "needs-input", reason: "decision-result-not-ready" }
  if (!input.host.resultAccess) return { status: "unavailable", reason: "decision-result-reader-unavailable" }
  const artifact = await input.host.resultAccess.readResult(input.runRef, input.context)
  if (artifact.status !== "ok") return artifact
  const output = structuredClone(artifact.value)
  if (digestSfValue(output.run) !== digestSfValue(result)) return { status: "stale", reason: "decision-result-changed" }
  const currentBinding = await input.host.binding(input.admissionRef, input.context)
  if (currentBinding.status !== "ok") return currentBinding
  if (!sameBinding(currentBinding.value, binding) || currentBinding.value.runRef !== input.runRef) return { status: "stale", reason: "decision-run-changed" }
  const currentCase = await input.host.cases.read({ caseRef: encodeCaseRef(input.caseRef) }, input.context)
  if (currentCase.status !== "ok") return currentCase
  if (!sameCase(currentCase.value.case, input.caseRef)) return { status: "stale", reason: "decision-case-changed" }
  if (!await input.host.revalidate(currentBinding.value, input.context)) return { status: "denied", reason: "decision-access-unavailable" }
  return { status: "ok", value: output }
}

/** The existing decision command persists the answer. A later run requires a new admission. */
export async function answerDecisionRoutine(input: {
  request: { admissionRef: string; runRef: string; caseRef: CaseRef; questionId: string; answerRef: string }
  context: TrustedDomainContext
  host: DecisionRoutineHost
  decisions: Pick<ReturnType<typeof createDecisionMutations>, "answerQuestion">
}): Promise<PortResult<{ caseRef: CaseRef; previousRunRef: string; requiresNewAdmission: true }>> {
  if (input.context.kind !== "ui") return { status: "denied", reason: "human-answer-required" }
  const request = structuredClone(input.request)
  const binding = await input.host.binding(request.admissionRef, input.context)
  if (binding.status !== "ok") return binding
  if (binding.value.admissionRef !== request.admissionRef || binding.value.runRef !== request.runRef || !sameCase(binding.value.caseRef, request.caseRef)) return { status: "stale", reason: "decision-run-changed" }
  const observed = await input.host.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, input.context)
  if (observed.status !== "ok") return observed
  const replay = observed.value.case.id === request.caseRef.id && observed.value.case.incarnation === request.caseRef.incarnation && observed.value.case.version > request.caseRef.version && observed.value.case.questions.some((question) => question.id === request.questionId && question.state === "answered" && question.answerRef === request.answerRef)
  if (!replay) {
    const run = await readDecisionRoutine({ ...request, context: input.context, host: input.host })
    if (run.status !== "ok") return run
  }
  const answered = await input.decisions.answerQuestion({ caseRef: request.caseRef, questionId: request.questionId, answerRef: request.answerRef }, input.context)
  if (answered.status !== "ok") return answered
  const next = structuredClone(answered.value.caseRef)
  if (next.id !== request.caseRef.id || next.incarnation !== request.caseRef.incarnation || !Number.isSafeInteger(next.version) || next.version <= request.caseRef.version) return { status: "unavailable", reason: "decision-answer-unverified" }
  const current = await input.host.cases.read({ caseRef: encodeCaseRef(next) }, input.context)
  if (current.status !== "ok") return current
  if (!sameCase(current.value.case, next) || !current.value.case.questions.some((question) => question.id === request.questionId && question.state === "answered" && question.answerRef === request.answerRef)) return { status: "stale", reason: "decision-answer-changed" }
  return { status: "ok", value: { caseRef: structuredClone(next), previousRunRef: request.runRef, requiresNewAdmission: true } }
}

function sameCase(left: CaseRef, right: CaseRef) {
  return left.id === right.id && left.incarnation === right.incarnation && left.version === right.version
}

function sameBinding(left: DecisionRoutineBinding, right: DecisionRoutineBinding) {
  return left.admissionRef === right.admissionRef && left.admissionVersion === right.admissionVersion && left.documentId === right.documentId && left.publishedVersion === right.publishedVersion && sameCase(left.caseRef, right.caseRef)
}

function matches(result: RoutineResult, binding: DecisionRoutineBinding, context: TrustedDomainContext) {
  return result.admission === "admitted" && result.admissionRef === binding.admissionRef && result.admissionVersion === binding.admissionVersion && result.documentId === binding.documentId && result.publishedVersion === binding.publishedVersion && result.principalRef === context.binding.principalRef && result.projectId === context.binding.projectId
}

function sameInputs(result: RoutineResult, admission: RoutineResult) {
  return result.correlationId === admission.correlationId && digestSfValue(result.sourceRefs) === digestSfValue(admission.sourceRefs) &&
    (admission.authorizationId === undefined || result.authorizationId === admission.authorizationId) &&
    (admission.armRef === undefined || result.armRef === admission.armRef) &&
    (admission.childSessionId === undefined || result.childSessionId === admission.childSessionId)
}

