import { encodeCaseRef } from "../decisions/case-port.ts"
import type { RoutineResult } from "../contracts/context.ts"
import type { BusinessPorts, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type DecisionRoutineBinding = { admissionRef: string; admissionVersion: number; documentId: string; publishedVersion: string; caseRef: CaseRef; runRef?: string }

/** The host resolves durable native admission facts and revalidates all sources, not model-supplied authority. */
export type DecisionRoutineHost = {
  cases: BusinessPorts["cases"]
  routines: BusinessPorts["routines"]
  binding: (admissionRef: string, context: TrustedDomainContext) => Promise<PortResult<DecisionRoutineBinding>>
  revalidate: (binding: DecisionRoutineBinding, context: TrustedDomainContext) => Promise<boolean>
}

/** Run only an already admitted workflow for the exact current case; the native port owns atomic retry. */
export async function startDecisionRoutine(input: { admissionRef: string; admissionVersion: number; caseRef: CaseRef; context: TrustedDomainContext; host: DecisionRoutineHost }): Promise<PortResult<RoutineResult>> {
  if (input.context.kind === "native" && input.context.binding.entryMode === "routine-result") return { status: "denied", reason: "recursive-routine" }
  if (input.context.kind === "native" && !sameCase(input.caseRef, { id: input.context.binding.caseId, incarnation: input.context.binding.caseIncarnation, version: input.context.binding.caseVersion })) return { status: "denied", reason: "decision-access-unavailable" }
  const bound = await input.host.binding(input.admissionRef, input.context)
  if (bound.status !== "ok") return bound
  if (!sameCase(bound.value.caseRef, input.caseRef) || bound.value.admissionRef !== input.admissionRef || bound.value.admissionVersion !== input.admissionVersion) return { status: "stale", reason: "decision-admission-changed" }
  const current = await input.host.cases.read({ caseRef: encodeCaseRef(input.caseRef) }, input.context)
  if (current.status !== "ok") return current
  if (!sameCase(current.value.case, input.caseRef)) return { status: "stale", reason: "decision-case-changed" }
  const admission = await input.host.routines.readAdmission(input.admissionRef, input.context)
  if (admission.status !== "ok") return admission
  if (!matches(admission.value, bound.value, input.context)) return { status: "stale", reason: "decision-admission-changed" }
  if (!await input.host.revalidate(bound.value, input.context)) return { status: "denied", reason: "decision-access-unavailable" }
  const run = await input.host.routines.run({ admissionRef: input.admissionRef, expectedAdmissionVersion: input.admissionVersion, caseRef: input.caseRef }, input.context)
  if (run.status !== "ok") return run
  if (!run.value.runRef || !matches(run.value, bound.value, input.context) || (bound.value.runRef && run.value.runRef !== bound.value.runRef)) return { status: "unavailable", reason: "decision-run-unverified" }
  const persisted = await input.host.binding(input.admissionRef, input.context)
  if (persisted.status !== "ok") return persisted
  if (!sameBinding(persisted.value, bound.value) || persisted.value.runRef !== run.value.runRef) return { status: "unavailable", reason: "decision-run-unverified" }
  const observed = await input.host.cases.read({ caseRef: encodeCaseRef(input.caseRef) }, input.context)
  if (observed.status !== "ok") return observed
  if (!sameCase(observed.value.case, input.caseRef)) return { status: "stale", reason: "decision-case-changed" }
  if (!await input.host.revalidate(bound.value, input.context)) return { status: "denied", reason: "decision-access-unavailable" }
  return run
}

/** Re-read the native run and current case before exposing a result reference. */
export async function readDecisionRoutine(input: { admissionRef: string; runRef: string; caseRef: CaseRef; context: TrustedDomainContext; host: DecisionRoutineHost }): Promise<PortResult<RoutineResult>> {
  if (input.context.kind === "native" && !sameCase(input.caseRef, { id: input.context.binding.caseId, incarnation: input.context.binding.caseIncarnation, version: input.context.binding.caseVersion })) return { status: "denied", reason: "decision-access-unavailable" }
  const bound = await input.host.binding(input.admissionRef, input.context)
  if (bound.status !== "ok") return bound
  if (!sameCase(bound.value.caseRef, input.caseRef) || bound.value.admissionRef !== input.admissionRef || bound.value.runRef !== input.runRef) return { status: "stale", reason: "decision-run-changed" }
  const current = await input.host.cases.read({ caseRef: encodeCaseRef(input.caseRef) }, input.context)
  if (current.status !== "ok") return current
  if (!sameCase(current.value.case, input.caseRef)) return { status: "stale", reason: "decision-case-changed" }
  const run = await input.host.routines.readRun(input.runRef, input.context)
  if (run.status !== "ok") return run
  if (run.value.runRef !== input.runRef || !matches(run.value, bound.value, input.context)) return { status: "unavailable", reason: "decision-run-unverified" }
  const currentBinding = await input.host.binding(input.admissionRef, input.context)
  if (currentBinding.status !== "ok") return currentBinding
  if (!sameBinding(currentBinding.value, bound.value) || currentBinding.value.runRef !== input.runRef) return { status: "stale", reason: "decision-run-changed" }
  const currentCase = await input.host.cases.read({ caseRef: encodeCaseRef(input.caseRef) }, input.context)
  if (currentCase.status !== "ok") return currentCase
  if (!sameCase(currentCase.value.case, input.caseRef)) return { status: "stale", reason: "decision-case-changed" }
  if (!await input.host.revalidate(currentBinding.value, input.context)) return { status: "denied", reason: "decision-access-unavailable" }
  if (!run.value.resultRef) return { status: "needs-input", reason: "decision-result-not-ready" }
  return run
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
