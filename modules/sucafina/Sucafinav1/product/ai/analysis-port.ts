import { Effect } from "effect"
import type { BusinessPorts, PortResult } from "../contracts/ports.ts"
import type { ContributionEnvelope, SkillLoadReceipt } from "../contracts/resident-ai.ts"
import normative from "../contracts/normative-contracts.json"
import { sfSkillInputSchemas } from "../contracts/output-schemas.ts"
import { decodeSfSkillInput } from "../contracts/schema-admission.ts"
import type { SfSkillInputMap } from "../contracts/skill-inputs.ts"
import { digestSfContribution, digestSfValue } from "../contracts/canonical.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfNativeRunRecord } from "../contracts/state.ts"
import { readDecisionRoutine, startDecisionRoutine } from "../routines/decision.ts"
import type { DecisionRoutineHost } from "../routines/decision.ts"
import { matchesSfRunOutput, sameSfSkillLoadReceipt } from "./run-provenance.ts"

declare const nativeExecutionTicket: unique symbol
/** Host-owned capability, bound to one Session, run, request digest and selected runtime. */
export type SfNativeExecutionTicket = { readonly [nativeExecutionTicket]: true }
export type NativeRunExecutionPort = {
  /** Authenticate and admit a real case, pin the selected runtime and create a private Session-bound ticket. */
  admit: (request: Parameters<BusinessPorts["analysis"]["create"]>[0], skillInput: unknown, target?: SfReviewTarget) => Promise<PortResult<{
    runRef: string
    sessionID: string
    skillReceipt: SkillLoadReceipt
    executionTicket: SfNativeExecutionTicket
  }>>
  /** Revalidate ticket, current authority and budget at the native host gate; persist lifecycle outcomes and wait without retaining a call lease. */
  execute: (ticket: SfNativeExecutionTicket) => Promise<PortResult<true>>
  /** Revalidate the ticket and authority, then read and decode the durable native result. */
  collect: (ticket: SfNativeExecutionTicket, context: TrustedDomainContext) => Promise<PortResult<ContributionEnvelope>>
  /** Revalidate the ticket and authority before interrupting its own Session. */
  interrupt: (ticket: SfNativeExecutionTicket, context: TrustedDomainContext) => Promise<PortResult<true>>
}

/** Host-provided services retain the real request and authority outside model input. */
export type SfAnalysisHost = {
  execution: NativeRunExecutionPort
  analysis: BusinessPorts["analysis"]
  result: BusinessPorts["result"]
  routines: BusinessPorts["routines"]
  /** Read durable lifecycle state under a newly authenticated run context; never resumes provider execution. */
  readRun: (runRef: string, context: TrustedDomainContext) => Promise<PortResult<SfNativeRunRecord>>
  /** Authenticate the current host-bound request afresh and scope one operation; revalidate session, case and ACL, then dispose its authority when the callback returns. After restart require a newly authenticated request. */
  withRunContext: <T>(runRef: string, action: (context: TrustedDomainContext) => Promise<PortResult<T>>) => Promise<PortResult<T>>
  /** Persist an honest failed state for an admitted run; this must revalidate the binding and case. */
  fail: (runRef: string, reason: string, context: TrustedDomainContext) => Promise<PortResult<true>>
  /** Persist non-executing outcomes under fresh, current authority. */
  settle: (runRef: string, state: "unavailable" | "needs-input", reason: string, context: TrustedDomainContext) => Promise<PortResult<true>>
  /** Preserve a stale run and its safe references under the host's current access policy. */
  markStale: (runRef: string, reason: string, context: TrustedDomainContext) => Promise<PortResult<true>>
  /** Preserve safe original content atomically, or lifecycle only for an unpublished alternative without a private capture. */
  preserveStale: (runRef: string, reason: string, output: ContributionEnvelope, context: TrustedDomainContext) => Promise<PortResult<true>>
  /** Verify host-owned binding and load receipt, current evidence and C10 semantics against real domain results, and persisted review target; field shape alone is insufficient. */
  revalidate: (context: TrustedDomainContext, input: { runRef: string; caseRef: ContributionEnvelope["caseRef"]; contextFingerprint: string; manifestDigest: string; accessRevision: string; outputKind?: ContributionEnvelope["kind"]; evidenceRefs?: ContributionEnvelope["evidenceRefs"]; output?: ContributionEnvelope; skillReceipts: readonly SkillLoadReceipt[]; reviewTarget?: SfReviewTarget }) => Promise<PortResult<true>>
}

export type SfAnalysisRunProgress = {
  runRef: string
  version: number
  caseRef: ContributionEnvelope["caseRef"]
  skillId: string
  state: SfNativeRunRecord["state"]
  createdAt: string
  updatedAt: string
  reason?: string
  outputRef?: string
}

/** Independent review must name its original run, original session and digest. */
export type SfReviewTarget = {
  targetRunId: string
  targetSessionId: string
  targetOutputDigest: string
  caseRef: ContributionEnvelope["caseRef"]
}

/** Publish only the output tied to the actual loaded skill and the still-authorized case. */
export async function publishSfContribution(input: {
  host: SfAnalysisHost
  output: ContributionEnvelope
  skillReceipt: SkillLoadReceipt
  runRef: string
  reviewTarget?: SfReviewTarget
}) {
  const { decodeSfContributionOutput } = await import("../contracts/schema-admission.ts")
  const receipt = input.skillReceipt
  const provenance = input.output.runProvenance
  if (provenance.runId !== input.runRef || !sameSfSkillLoadReceipt(receipt, provenance) || !provenance.actualModel || !provenance.contextFingerprint) {
    return { status: "failed", reason: "contribution-provenance-mismatch" } as const
  }
  if (receipt.skillId === "sf-contestar-decisao" || receipt.skillId === "sf-revisar-evidencias") {
    if (receipt.profileId !== "sf_reviewer") return { status: "failed", reason: "review-profile-mismatch" } as const
    if (!input.reviewTarget || input.reviewTarget.targetRunId === receipt.runId || input.reviewTarget.targetSessionId === receipt.nativeSessionId ||
        provenance.targetRunId !== input.reviewTarget.targetRunId || provenance.targetOutputDigest !== input.reviewTarget.targetOutputDigest ||
        provenance.reviewerRunId !== receipt.runId || input.output.caseRef.id !== input.reviewTarget.caseRef.id ||
        input.output.caseRef.version !== input.reviewTarget.caseRef.version || input.output.caseRef.incarnation !== input.reviewTarget.caseRef.incarnation) {
      return { status: "failed", reason: "review-not-independent" } as const
    }
  }
  if (input.output.state === "ready" && !decodeSfContributionOutput(input.output.kind, input.output.payload).ok) return { status: "failed", reason: "invalid-contribution-output" } as const
  const digest = Effect.runSync(Effect.result(Effect.try({ try: () => digestSfContribution(input.output), catch: () => "invalid-contribution" })))
  if (digest._tag === "Failure" || digest.success !== input.output.outputDigest) return { status: "failed", reason: "contribution-digest-mismatch" } as const
  if (input.output.state !== "ready") return input.output.state === "failed" || input.output.state === "unavailable" || input.output.state === "needs-input" || input.output.state === "stale"
    ? { status: input.output.state, reason: input.output.reason } as const
    : { status: "unavailable", reason: input.output.state === "cancelled" ? "analysis-cancelled" : "analysis-result-not-ready" } as const
  if (input.output.state === "ready" && input.output.kind === "CritiqueReport" && (receipt.profileId !== "sf_reviewer" || !input.reviewTarget || input.output.payload.targetRunId !== input.reviewTarget.targetRunId ||
      input.output.payload.targetOutputDigest !== input.reviewTarget.targetOutputDigest || input.output.payload.reviewerRunId !== receipt.runId ||
      input.output.payload.reviewerSessionId !== receipt.nativeSessionId)) return { status: "failed", reason: "review-target-mismatch" } as const
  const authorized = await input.host.withRunContext(input.runRef, (context) => input.host.revalidate(context, {
    runRef: input.runRef,
    caseRef: input.output.caseRef,
    contextFingerprint: provenance.contextFingerprint,
    manifestDigest: receipt.manifestDigest,
    accessRevision: input.output.accessRevision,
    outputKind: input.output.kind,
    evidenceRefs: input.output.evidenceRefs,
    output: input.output,
    skillReceipts: [receipt],
    reviewTarget: input.reviewTarget,
  }))
  if (authorized.status === "stale") {
    const stale = await input.host.withRunContext(input.runRef, (context) => input.host.preserveStale(input.runRef, authorized.reason, input.output, context))
    if (stale.status !== "ok") return stale
    return authorized
  }
  if (authorized.status !== "ok") return authorized
  const written = await input.host.withRunContext(input.runRef, (context) => input.host.result.write({ runRef: input.runRef, caseRef: input.output.caseRef, output: input.output }, context))
  if (written.status !== "stale") return written
  // write can detect a changed source either before committing or at its final egress check.
  // Reopen authority and reconcile the durable state; the store fences any intervening change.
  const stale = await input.host.withRunContext(input.runRef, (context) => input.host.preserveStale(input.runRef, written.reason, input.output, context))
  return stale.status === "ok" ? written : stale
}

/** Runs one admitted native session; the host owns authentication, durable admission and result collection. */
export async function runSfAnalysis(input: {
  host: SfAnalysisHost
  request: Parameters<BusinessPorts["analysis"]["create"]>[0]
  skillInput: unknown
  reviewTarget?: SfReviewTarget
}) {
  const skill = normative.resident.skills.find((item) => item.id === input.request.skillId)
  if (!skill || !Object.hasOwn(sfSkillInputSchemas, skill.input_type)) return { status: "unavailable", reason: "skill-input-schema-unavailable" } as const
  const decoded = decodeSfSkillInput(skill.input_type as keyof SfSkillInputMap, input.skillInput)
  if (!decoded.ok) return { status: "failed", reason: "invalid-skill-input" } as const
  const prepared = await input.host.execution.admit(input.request, decoded.value, input.reviewTarget)
  if (prepared.status !== "ok") return prepared
  const admission = prepared.value
  if (admission.skillReceipt.runId !== admission.runRef || admission.skillReceipt.nativeSessionId !== admission.sessionID || admission.skillReceipt.profileId !== input.request.profileId ||
      admission.skillReceipt.profileVersion !== input.request.profileVersion || admission.skillReceipt.skillId !== input.request.skillId ||
      admission.skillReceipt.skillVersion !== input.request.skillVersion || admission.skillReceipt.manifestDigest !== input.request.manifestDigest ||
      !admission.executionTicket) {
    const failed = await input.host.withRunContext(admission.runRef, (context) => input.host.fail(admission.runRef, "invalid-native-admission", context))
    if (failed.status !== "ok") return failed
    return { status: "failed", reason: "invalid-native-admission" } as const
  }
  if ((admission.skillReceipt.skillId === "sf-contestar-decisao" || admission.skillReceipt.skillId === "sf-revisar-evidencias") &&
      (admission.skillReceipt.profileId !== "sf_reviewer" || !input.reviewTarget || input.reviewTarget.targetSessionId === admission.sessionID ||
       input.reviewTarget.targetRunId === admission.skillReceipt.runId)) {
    const failed = await input.host.withRunContext(admission.runRef, (context) => input.host.fail(admission.runRef, "review-not-independent", context))
    if (failed.status !== "ok") return failed
    return { status: "failed", reason: "review-not-independent" } as const
  }
  const authorized = await input.host.withRunContext(admission.runRef, (context) => input.host.revalidate(context, {
    runRef: admission.runRef,
    caseRef: input.request.caseRef,
    contextFingerprint: input.request.contextFingerprint,
    manifestDigest: input.request.manifestDigest,
    accessRevision: context.binding.accessRevision,
    skillReceipts: [admission.skillReceipt],
    reviewTarget: input.reviewTarget,
  }))
  if (authorized.status === "stale") {
    const saved = await input.host.withRunContext(admission.runRef, (context) => input.host.markStale(admission.runRef, authorized.reason, context))
    if (saved.status !== "ok") return saved
    return authorized
  }
  if (authorized.status === "unavailable" || authorized.status === "needs-input") {
    const state = authorized.status
    const saved = await input.host.withRunContext(admission.runRef, (context) => input.host.settle(admission.runRef, state, authorized.reason, context))
    if (saved.status !== "ok") return saved
    return authorized
  }
  if (authorized.status !== "ok") return authorized
  const run = await Promise.resolve().then(() => input.host.execution.execute(admission.executionTicket)).catch(() => ({ status: "unavailable", reason: "native-execution-outcome-unknown" } as const))
  if (run.status === "failed") {
    const failed = await input.host.withRunContext(admission.runRef, (context) => input.host.fail(admission.runRef, run.reason, context))
    if (failed.status !== "ok") return failed
    return run
  }
  if (run.status === "unavailable" || run.status === "needs-input") {
    const state = run.status
    const saved = await input.host.withRunContext(admission.runRef, (context) => input.host.settle(admission.runRef, state, run.reason, context))
    if (saved.status !== "ok") return saved
    return run
  }
  if (run.status === "stale") {
    const saved = await input.host.withRunContext(admission.runRef, (context) => input.host.markStale(admission.runRef, run.reason, context))
    if (saved.status !== "ok") return saved
    return run
  }
  if (run.status !== "ok") return run
  const collected = await Promise.resolve().then(() => input.host.withRunContext(admission.runRef, (context) => input.host.execution.collect(admission.executionTicket, context))).catch(() => ({ status: "unavailable", reason: "native-collection-outcome-unknown" } as const))
  if (collected.status === "failed") {
    const saved = await input.host.withRunContext(admission.runRef, (context) => input.host.fail(admission.runRef, collected.reason, context))
    if (saved.status !== "ok") return saved
    return collected
  }
  if (collected.status === "unavailable" || collected.status === "needs-input") {
    const state = collected.status
    const saved = await input.host.withRunContext(admission.runRef, (context) => input.host.settle(admission.runRef, state, collected.reason, context))
    if (saved.status !== "ok") return saved
    return collected
  }
  if (collected.status === "stale") {
    const saved = await input.host.withRunContext(admission.runRef, (context) => input.host.markStale(admission.runRef, collected.reason, context))
    if (saved.status !== "ok") return saved
    return collected
  }
  if (collected.status !== "ok") return collected
  if (collected.value.state !== "ready") {
    const outcome = collected.value
    const provenance = outcome.runProvenance
    if (digestSfContribution(outcome) !== outcome.outputDigest || provenance.runId !== admission.runRef || provenance.nativeSessionId !== admission.sessionID ||
      !sameSfSkillLoadReceipt(admission.skillReceipt, provenance) ||
      provenance.contextFingerprint !== input.request.contextFingerprint || !provenance.actualModel || outcome.caseRef.id !== input.request.caseRef.id || outcome.caseRef.incarnation !== input.request.caseRef.incarnation || outcome.caseRef.version !== input.request.caseRef.version ||
      !admission.skillReceipt.profileId || !admission.skillReceipt.manifestDigest) {
      const saved = await input.host.withRunContext(admission.runRef, (context) => input.host.fail(admission.runRef, "invalid-native-outcome", context))
      return saved.status === "ok" ? { status: "failed", reason: "invalid-native-outcome" } : saved
    }
    const authorizedOutcome = await input.host.withRunContext(admission.runRef, (context) => input.host.revalidate(context, {
      runRef: admission.runRef, caseRef: input.request.caseRef, contextFingerprint: input.request.contextFingerprint, manifestDigest: admission.skillReceipt.manifestDigest,
      accessRevision: context.binding.accessRevision, skillReceipts: [admission.skillReceipt], reviewTarget: input.reviewTarget,
    }))
    if (authorizedOutcome.status === "stale") {
      const saved = await input.host.withRunContext(admission.runRef, (context) => input.host.markStale(admission.runRef, authorizedOutcome.reason, context))
      return saved.status === "ok" ? authorizedOutcome : saved
    }
    if (authorizedOutcome.status !== "ok") return authorizedOutcome
    if (outcome.state === "failed") {
      const saved = await input.host.withRunContext(admission.runRef, (context) => input.host.fail(admission.runRef, outcome.reason, context))
      return saved.status === "ok" ? { status: "failed", reason: outcome.reason } : saved
    }
    if (outcome.state === "needs-input" || outcome.state === "unavailable") {
      const state = outcome.state
      const saved = await input.host.withRunContext(admission.runRef, (context) => input.host.settle(admission.runRef, state, outcome.reason, context))
      return saved.status === "ok" ? { status: state, reason: outcome.reason } : saved
    }
    if (outcome.state === "stale") {
      const saved = await input.host.withRunContext(admission.runRef, (context) => input.host.markStale(admission.runRef, outcome.reason, context))
      return saved.status === "ok" ? { status: "stale", reason: outcome.reason } : saved
    }
    if (outcome.state === "cancelled") {
      const saved = await cancelSfAnalysis({ host: input.host, runRef: admission.runRef, sessionID: admission.sessionID, executionTicket: admission.executionTicket,
        skillReceipt: admission.skillReceipt, caseRef: input.request.caseRef, contextFingerprint: input.request.contextFingerprint })
      return saved.status === "ok" ? { status: "unavailable", reason: "analysis-cancelled" } : saved
    }
    const saved = await input.host.withRunContext(admission.runRef, (context) => input.host.settle(admission.runRef, "unavailable", "native-result-not-final", context))
    return saved.status === "ok" ? { status: "unavailable", reason: "native-result-not-final" } : saved
  }
  if (collected.value.caseRef.id !== input.request.caseRef.id || collected.value.caseRef.version !== input.request.caseRef.version ||
      collected.value.caseRef.incarnation !== input.request.caseRef.incarnation ||
      collected.value.runProvenance.contextFingerprint !== input.request.contextFingerprint) {
    // A result for another case/version is an invalid envelope, not safe historical content.
    const stale = await input.host.withRunContext(admission.runRef, (context) => input.host.markStale(admission.runRef, "analysis-base-changed", context))
    if (stale.status !== "ok") return stale
    return { status: "stale", reason: "analysis-base-changed" } as const
  }
  const published = await publishSfContribution({ host: input.host, output: collected.value, skillReceipt: admission.skillReceipt, runRef: admission.runRef, reviewTarget: input.reviewTarget })
  if (published.status !== "failed") return published
  const failed = await input.host.withRunContext(admission.runRef, (context) => input.host.fail(admission.runRef, published.reason, context))
  return failed.status === "ok" ? published : failed
}

/** Cancel the durable run before interrupting its matching native session. */
export async function cancelSfAnalysis(input: {
  host: SfAnalysisHost
  runRef: string
  sessionID: string
  executionTicket: SfNativeExecutionTicket
  skillReceipt: SkillLoadReceipt
  caseRef: ContributionEnvelope["caseRef"]
  contextFingerprint: string
}) {
  if (input.skillReceipt.nativeSessionId !== input.sessionID || input.skillReceipt.runId !== input.runRef) return { status: "denied", reason: "session-mismatch" } as const
  const authorized = await input.host.withRunContext(input.runRef, async (context) => {
    const current = await input.host.readRun(input.runRef, context)
    if (current.status !== "ok") return current
    const run = current.value
    if (run.runRef !== input.runRef || !run.native || run.native.sessionID !== input.sessionID ||
      digestSfValue(run.native.skillReceipt) !== digestSfValue(input.skillReceipt) || digestSfValue(run.caseRef) !== digestSfValue(input.caseRef) ||
      run.contextFingerprint !== input.contextFingerprint) return { status: "denied", reason: "run-binding-mismatch" } as const
    // The review target comes from durable host state, never from caller/model metadata.
    return input.host.revalidate(context, {
      runRef: input.runRef,
      caseRef: run.caseRef,
      contextFingerprint: run.contextFingerprint,
      manifestDigest: run.selection.manifestDigest,
      accessRevision: context.binding.accessRevision,
      skillReceipts: [run.native.skillReceipt],
      reviewTarget: run.reviewTarget,
    })
  })
  if (authorized.status !== "ok" && authorized.status !== "stale") return authorized
  const cancelled = await input.host.withRunContext(input.runRef, (context) => input.host.analysis.cancel(input.runRef, context))
  if (cancelled.status !== "ok" || !cancelled.value.cancelled) return cancelled
  const interrupted = await input.host.withRunContext(input.runRef, async (context) => {
    // Cancellation is already durable. The execution host must authorize this one-shot interrupt
    // against its own ticket/session registry even though ordinary run revalidation now rejects it.
    return input.host.execution.interrupt(input.executionTicket, context)
  })
  if (interrupted.status !== "ok") return interrupted
  return cancelled
}

/** Recover persisted progress and a ready result after restart without reviving an expired ticket or grant. */
export async function readSfAnalysisRun(input: { host: SfAnalysisHost; runRef: string }): Promise<PortResult<{ run: SfAnalysisRunProgress; output?: ContributionEnvelope }>> {
  return input.host.withRunContext<{ run: SfAnalysisRunProgress; output?: ContributionEnvelope }>(input.runRef, async (context) => {
    const read = await input.host.readRun(input.runRef, context)
    if (read.status !== "ok") return read
    const run = read.value
    if (run.runRef !== input.runRef) return { status: "denied", reason: "run-identity-mismatch" } as const
    const progress: SfAnalysisRunProgress = { runRef: run.runRef, version: run.version, caseRef: run.caseRef, skillId: run.skillId, state: run.state, createdAt: run.createdAt, updatedAt: run.updatedAt,
      ...("reason" in run && run.reason ? { reason: run.reason } : {}), ...(run.outputRef ? { outputRef: run.outputRef } : {}) }
    if (run.state !== "ready") return { status: "ok", value: { run: progress } } as const
    if (!run.outputRef || !run.native) return { status: "unavailable", reason: "ready-output-unavailable" } as const
    const output = await input.host.analysis.read(run.runRef, context)
    if (output.status !== "ok") return output
    if (output.value.id !== run.outputRef || !matchesSfRunOutput(run, output.value)) return { status: "denied", reason: "run-output-provenance-mismatch" } as const
    const authorized = await input.host.revalidate(context, { runRef: run.runRef, caseRef: run.caseRef, contextFingerprint: run.contextFingerprint, manifestDigest: run.selection.manifestDigest,
      accessRevision: run.accessRevision, outputKind: output.value.kind, evidenceRefs: output.value.evidenceRefs, output: output.value, skillReceipts: [run.native.skillReceipt], reviewTarget: run.reviewTarget })
    if (authorized.status !== "ok") return authorized
    const current = await input.host.readRun(input.runRef, context)
    if (current.status !== "ok") return current
    if (digestSfValue(current.value) !== digestSfValue(run)) return { status: "stale", reason: "run-changed-during-read" } as const
    const authorizedAgain = await input.host.revalidate(context, { runRef: run.runRef, caseRef: run.caseRef, contextFingerprint: run.contextFingerprint, manifestDigest: run.selection.manifestDigest,
      accessRevision: run.accessRevision, outputKind: output.value.kind, evidenceRefs: output.value.evidenceRefs, output: output.value, skillReceipts: [run.native.skillReceipt], reviewTarget: run.reviewTarget })
    if (authorizedAgain.status !== "ok") return authorizedAgain
    return { status: "ok", value: { run: progress, output: output.value } } as const
  })
}

/** Only the existing admitted routine port may start Relay; results never recursively start another run. */
export async function runSfAnalysisRoutine(input: {
  decisionRoutine: DecisionRoutineHost
  binding: TrustedDomainContext
  admissionRef: string
  expectedAdmissionVersion: number
  caseRef: ContributionEnvelope["caseRef"]
}) {
  if (input.binding.kind === "native" && input.binding.binding.entryMode === "routine-result") return { status: "denied", reason: "recursive-routine" } as const
  return startDecisionRoutine({ admissionRef: input.admissionRef, admissionVersion: input.expectedAdmissionVersion, caseRef: input.caseRef, context: input.binding, host: input.decisionRoutine })
}

/** Read Relay lifecycle metadata/resultRef only; factual body consumption must use authorized sf_routine_result in a routine-result session. */
export async function readSfAnalysisRoutine(input: {
  decisionRoutine: DecisionRoutineHost
  binding: TrustedDomainContext
  admissionRef: string
  runRef: string
  caseRef: ContributionEnvelope["caseRef"]
}) {
  return readDecisionRoutine({ admissionRef: input.admissionRef, runRef: input.runRef, caseRef: input.caseRef, context: input.binding, host: input.decisionRoutine })
}
