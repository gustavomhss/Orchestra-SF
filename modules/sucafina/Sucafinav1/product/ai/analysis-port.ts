import { Effect } from "effect"
import type { SessionV2 } from "@orchestra/core/session"
import type { BusinessPorts, PortResult } from "../contracts/ports.ts"
import type { ContributionEnvelope, SkillLoadReceipt } from "../contracts/resident-ai.ts"
import normative from "../contracts/normative-contracts.json"
import { sfSkillInputSchemas } from "../contracts/output-schemas.ts"
import { decodeSfSkillInput } from "../contracts/schema-admission.ts"
import type { SfSkillInputMap } from "../contracts/skill-inputs.ts"
import { digestSfContribution } from "../contracts/canonical.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

/** Host-provided services retain the real request and authority outside model input. */
export type SfAnalysisHost = {
  session: SessionV2.Interface
  analysis: BusinessPorts["analysis"]
  result: BusinessPorts["result"]
  routines: BusinessPorts["routines"]
  /** Authenticate the current host-bound request afresh and scope one operation; revalidate session, case and ACL, then dispose its authority when the callback returns. After restart require a newly authenticated request. */
  withRunContext: <T>(runRef: string, action: (context: TrustedDomainContext) => Promise<PortResult<T>>) => Promise<PortResult<T>>
  /** Resolve and validate the pinned skill input schema; admit the real case and Request, create a dedicated native session, bind and load the selected skill. Missing schema must fail closed. */
  prepare: (request: Parameters<BusinessPorts["analysis"]["create"]>[0], skillInput: unknown, target?: SfReviewTarget) => Promise<PortResult<{
    runRef: string
    sessionID: Parameters<SessionV2.Interface["get"]>[0]
    skillReceipt: SkillLoadReceipt
    authorizedPrompt: string
  }>>
  /** Read the native session result and decode the entire envelope and pinned output schema; never synthesize success. */
  collect: (input: { runRef: string; sessionID: Parameters<SessionV2.Interface["get"]>[0] }, context: TrustedDomainContext) => Promise<PortResult<ContributionEnvelope>>
  /** Persist an honest failed state for an admitted run; this must revalidate the binding and case. */
  fail: (runRef: string, reason: string, context: TrustedDomainContext) => Promise<PortResult<true>>
  /** Preserve a stale run and its safe references under the host's current access policy. */
  markStale: (runRef: string, reason: string, context: TrustedDomainContext) => Promise<PortResult<true>>
  /** Verify the host-owned binding, actual load receipt, all output evidence and persisted review target, not just their fields. */
  revalidate: (context: TrustedDomainContext, input: { runRef: string; caseRef: ContributionEnvelope["caseRef"]; contextFingerprint: string; manifestDigest: string; accessRevision: string; outputKind?: ContributionEnvelope["kind"]; evidenceRefs?: ContributionEnvelope["evidenceRefs"]; output?: ContributionEnvelope; skillReceipts: readonly SkillLoadReceipt[]; reviewTarget?: SfReviewTarget }) => Promise<PortResult<true>>
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
  if (provenance.runId !== receipt.runId || provenance.nativeSessionId !== receipt.nativeSessionId ||
      provenance.profileId !== receipt.profileId || provenance.profileVersion !== receipt.profileVersion ||
      provenance.profileDigest !== receipt.profileDigest || provenance.skillId !== receipt.skillId ||
      provenance.skillVersion !== receipt.skillVersion || provenance.sourceDigest !== receipt.sourceDigest ||
      provenance.instructionsDigest !== receipt.instructionsDigest || provenance.loadedMessageId !== receipt.loadedMessageId || provenance.loadedAt !== receipt.loadedAt ||
      provenance.manifestDigest !== receipt.manifestDigest || !provenance.actualModel || !provenance.contextFingerprint) {
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
    const stale = await input.host.withRunContext(input.runRef, (context) => input.host.markStale(input.runRef, authorized.reason, context))
    if (stale.status !== "ok") return stale
    return authorized
  }
  if (authorized.status !== "ok") return authorized
  return input.host.withRunContext(input.runRef, (context) => input.host.result.write({ runRef: input.runRef, caseRef: input.output.caseRef, output: input.output }, context))
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
  const prepared = await input.host.prepare(input.request, decoded.value, input.reviewTarget)
  if (prepared.status !== "ok") return prepared
  const admission = prepared.value
  if (admission.skillReceipt.nativeSessionId !== admission.sessionID || admission.skillReceipt.profileId !== input.request.profileId ||
      admission.skillReceipt.profileVersion !== input.request.profileVersion || admission.skillReceipt.skillId !== input.request.skillId ||
      admission.skillReceipt.skillVersion !== input.request.skillVersion || admission.skillReceipt.manifestDigest !== input.request.manifestDigest ||
      !admission.authorizedPrompt.trim()) {
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
  const admitted = await input.host.withRunContext(admission.runRef, async (context) => {
    const authorized = await input.host.revalidate(context, {
      runRef: admission.runRef,
      caseRef: input.request.caseRef,
      contextFingerprint: input.request.contextFingerprint,
      manifestDigest: input.request.manifestDigest,
      accessRevision: context.binding.accessRevision,
      skillReceipts: [admission.skillReceipt],
      reviewTarget: input.reviewTarget,
    })
    if (authorized.status !== "ok") return authorized
    const started = await Effect.runPromise(Effect.result(input.host.session.prompt({ sessionID: admission.sessionID, prompt: { text: admission.authorizedPrompt } })))
    if (started._tag === "Failure") return { status: "failed", reason: "native-session-admission-failed" } as const
    return { status: "ok", value: true } as const
  })
  if (admitted.status === "failed") {
    const failed = await input.host.withRunContext(admission.runRef, (context) => input.host.fail(admission.runRef, admitted.reason, context))
    if (failed.status !== "ok") return failed
    return admitted
  }
  if (admitted.status !== "ok") return admitted
  const run = await Effect.runPromise(Effect.result(input.host.session.wait(admission.sessionID)))
  if (run._tag === "Failure") {
    const failed = await input.host.withRunContext(admission.runRef, (context) => input.host.fail(admission.runRef, "native-session-failed", context))
    if (failed.status !== "ok") return failed
    return { status: "failed", reason: "native-session-failed" } as const
  }
  const collected = await input.host.withRunContext(admission.runRef, (context) => input.host.collect({ runRef: admission.runRef, sessionID: admission.sessionID }, context))
  if (collected.status !== "ok") return collected
  if (collected.value.caseRef.id !== input.request.caseRef.id || collected.value.caseRef.version !== input.request.caseRef.version ||
      collected.value.caseRef.incarnation !== input.request.caseRef.incarnation ||
      collected.value.runProvenance.contextFingerprint !== input.request.contextFingerprint) {
    const stale = await input.host.withRunContext(admission.runRef, (context) => input.host.markStale(admission.runRef, "analysis-base-changed", context))
    if (stale.status !== "ok") return stale
    return { status: "stale", reason: "analysis-base-changed" } as const
  }
  return publishSfContribution({ host: input.host, output: collected.value, skillReceipt: admission.skillReceipt, runRef: admission.runRef, reviewTarget: input.reviewTarget })
}

/** Cancel the durable run before interrupting its matching native session. */
export async function cancelSfAnalysis(input: {
  host: SfAnalysisHost
  runRef: string
  sessionID: Parameters<SessionV2.Interface["get"]>[0]
  skillReceipt: SkillLoadReceipt
  caseRef: ContributionEnvelope["caseRef"]
  contextFingerprint: string
}) {
  if (input.skillReceipt.nativeSessionId !== input.sessionID) return { status: "denied", reason: "session-mismatch" } as const
  const authorized = await input.host.withRunContext(input.runRef, (context) => input.host.revalidate(context, {
    runRef: input.runRef,
    caseRef: input.caseRef,
    contextFingerprint: input.contextFingerprint,
    manifestDigest: input.skillReceipt.manifestDigest,
    accessRevision: context.binding.accessRevision,
    skillReceipts: [input.skillReceipt],
  }))
  if (authorized.status !== "ok") return authorized
  const cancelled = await input.host.withRunContext(input.runRef, (context) => input.host.analysis.cancel(input.runRef, context))
  if (cancelled.status !== "ok" || !cancelled.value.cancelled) return cancelled
  const interrupted = await input.host.withRunContext(input.runRef, async (context) => {
    const current = await input.host.revalidate(context, {
      runRef: input.runRef,
      caseRef: input.caseRef,
      contextFingerprint: input.contextFingerprint,
      manifestDigest: input.skillReceipt.manifestDigest,
      accessRevision: context.binding.accessRevision,
      skillReceipts: [input.skillReceipt],
    })
    if (current.status !== "ok") return current
    await Effect.runPromise(input.host.session.interrupt(input.sessionID))
    return { status: "ok", value: true } as const
  })
  if (interrupted.status !== "ok") return interrupted
  return cancelled
}

/** Only the existing admitted routine port may start Relay; results never recursively start another run. */
export async function runSfAnalysisRoutine(input: {
  host: SfAnalysisHost
  binding: TrustedDomainContext
  admissionRef: string
  expectedAdmissionVersion: number
  caseRef: ContributionEnvelope["caseRef"]
}) {
  if (input.binding.kind === "native" && input.binding.binding.entryMode === "routine-result") return { status: "denied", reason: "recursive-routine" } as const
  return input.host.routines.run({ admissionRef: input.admissionRef, expectedAdmissionVersion: input.expectedAdmissionVersion, caseRef: input.caseRef }, input.binding)
}
