import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { matchesSfRunOutput } from "../../../../product/ai/run-provenance.ts"
import { routineArtifactDigest } from "../../../../product/routines/result-access.ts"
import type { RoutineResult } from "../../../../product/contracts/context.ts"
import type { ContributionEnvelope, ConsumptionReceipt } from "../../../../product/contracts/resident-ai.ts"
import type { SfNativeRunRecord } from "../../../../product/contracts/state.ts"
import type { BoundCapabilityReceipt } from "../../../../product/contracts/sf-execution.ts"
import type { AuthorizedRoutineArtifactResult } from "../../../../product/routines/result-access.ts"

/**
 * AM06 evidence correlation only. This module NEVER asserts that a JSON record is
 * an authenticated native run, a human authorization, a real inference, or an
 * observed browser action. The independent GitHub Actions witnesses must provide
 * those observations from the actual host, Relay, model and product after reload.
 */
export type Am06Observation = {
  candidateSha: string
  publication: { documentId: string; publishedVersion: string; planRevisionId: string }
  admission: RoutineResult
  status: RoutineResult
  opened: AuthorizedRoutineArtifactResult
  analysisRun: SfNativeRunRecord
  brief: ContributionEnvelope
  consumption: ConsumptionReceipt
  capabilityCalls: readonly BoundCapabilityReceipt[]
}
export type Am06Correlation = {
  state: "NOT_RUN" | "REJECTED" | "CORRELATED_NOT_ATTESTED"
  missing: readonly (keyof Am06Observation)[]
  mismatches: readonly string[]
}

const exportsByOperation = {
  sf_routine_catalog: "readRoutineCatalog",
  sf_routine_prepare: "prepareRoutine",
  sf_routine_run: "runAdmittedRoutine",
  sf_routine_status: "readRoutineStatus",
  sf_routine_result: "readRoutineResult",
} as const
const digest = (value: string) => /^[a-f0-9]{64}$/.test(value)
const sha = (value: string) => /^[a-f0-9]{40}$/.test(value)

export function correlateAm06(input: Partial<Am06Observation>): Am06Correlation {
  const keys = ["candidateSha", "publication", "admission", "status", "opened",
    "analysisRun", "brief", "consumption", "capabilityCalls"] as const
  const missing = keys.filter((key) => input[key] === undefined)
  const mismatches: string[] = []
  const problem = (condition: boolean, description: string) => { if (condition) mismatches.push(description) }
  if (input.candidateSha !== undefined) problem(!sha(input.candidateSha), "candidate-sha-invalid")
  const pin = input.publication, admission = input.admission, status = input.status, opened = input.opened
  const analysis = input.analysisRun, brief = input.brief, consumed = input.consumption

  if (pin) {
    problem(!pin.documentId.trim() || !pin.publishedVersion.trim() || !pin.planRevisionId.trim(), "unbound-publication")
  }
  if (admission) {
    problem(admission.admission !== "admitted" || !admission.admissionRef || !admission.authorizationId ||
      !admission.armRef || !admission.childSessionId || !admission.correlationId,
      "native-admission-or-arm-unverified")
    if (pin) problem(admission.documentId !== pin.documentId || admission.publishedVersion !== pin.publishedVersion,
      "publication-version-mismatch")
  }
  if (admission && status) {
    problem(status.admission !== "admitted" || status.admissionRef !== admission.admissionRef ||
      status.admissionVersion !== admission.admissionVersion || status.authorizationId !== admission.authorizationId ||
      status.armRef !== admission.armRef || status.childSessionId !== admission.childSessionId ||
      status.correlationId !== admission.correlationId || status.principalRef !== admission.principalRef ||
      status.projectId !== admission.projectId || status.documentId !== admission.documentId ||
      status.publishedVersion !== admission.publishedVersion ||
      digestSfValue(status.sourceRefs) !== digestSfValue(admission.sourceRefs), "admission-status-identity-mismatch")
    problem(!status.runRef || status.runRef !== admission.childSessionId, "native-child-run-mismatch")
  }
  if (status && opened) {
    const { run, execution, output } = opened
    problem(run.admission !== "admitted" || run.runRef !== status.runRef ||
      run.resultRef !== status.resultRef || run.admissionRef !== status.admissionRef ||
      run.admissionVersion !== status.admissionVersion ||
      run.principalRef !== status.principalRef || run.projectId !== status.projectId ||
      run.correlationId !== status.correlationId, "authorized-run-reopen-mismatch")
    problem(execution.state !== "completed" || execution.runRef !== status.runRef ||
      execution.resultRef !== status.resultRef || !digest(execution.outputDigest ?? ""),
      "native-terminal-not-completed")
    const { outputDigest, ...body } = output
    problem(!digest(outputDigest) || routineArtifactDigest(body) !== outputDigest ||
      execution.outputDigest !== outputDigest || output.runRef !== status.runRef ||
      output.resultRef !== status.resultRef || output.documentId !== status.documentId ||
      output.publishedVersion !== status.publishedVersion || output.principalRef !== status.principalRef ||
      output.projectId !== status.projectId || output.correlationId !== status.correlationId ||
      digestSfValue(output.sourceRefs) !== digestSfValue(status.sourceRefs), "authenticated-artifact-mismatch")
    if (pin) {
      const content = output.content
      problem(!content || typeof content !== "object" || Array.isArray(content) ||
        !("planRevisionId" in content) || content.planRevisionId !== pin.planRevisionId,
        "native-artifact-plan-unbound")
    }
  }
  if (analysis) {
    problem(analysis.state !== "ready" || !analysis.native || analysis.skillId !== "sf-preparar-revisao-executiva" ||
      analysis.selection.profile.id !== "sf_maestro" || analysis.native?.skillReceipt.profileId !== "sf_maestro" ||
      analysis.native?.skillReceipt.skillId !== "sf-preparar-revisao-executiva", "native-skill-not-loaded")
    if (brief) problem(!matchesSfRunOutput(analysis, brief), "native-model-contribution-unverified")
    if (admission) problem(analysis.principalRef !== admission.principalRef, "resident-owner-mismatch")
  }
  if (brief) {
    problem(brief.kind !== "DecisionBrief" || brief.state !== "ready", "executive-brief-not-ready")
    if (brief.kind === "DecisionBrief" && brief.state === "ready") {
      if (status) problem(brief.payload.runRef !== status.runRef ||
        brief.payload.resultRef !== status.resultRef, "brief-c07-link-mismatch")
      if (analysis) problem(brief.caseRef.id !== analysis.caseRef.id ||
        brief.caseRef.incarnation !== analysis.caseRef.incarnation ||
        brief.caseRef.version !== analysis.caseRef.version ||
        brief.payload.caseVersion !== analysis.caseRef.version, "brief-case-version-mismatch")
    }
  }
  if (consumed && brief) {
    problem(consumed.outputRef !== brief.id || consumed.outputDigest !== brief.outputDigest ||
      !consumed.consumerRef.trim() || !consumed.observedAction.trim(), "ui-consumption-unbound")
    if (analysis) problem(consumed.authorizedPrincipalRef !== analysis.principalRef ||
      consumed.caseVersion !== analysis.caseRef.version, "ui-owner-or-case-mismatch")
  }
  if (input.capabilityCalls) {
    const seenCalls = new Set<string>()
    for (const receipt of input.capabilityCalls) {
      problem(receipt.kind !== "native" || !receipt.callId.trim() || seenCalls.has(receipt.callId) ||
        !digest(receipt.inputDigest) || !digest(receipt.resultDigest ?? "") ||
        !receipt.nativeSessionId?.trim() || !receipt.runId?.trim(), "unbound-or-duplicate-tool-call")
      seenCalls.add(receipt.callId)
    }
    for (const [operation, handlerExport] of Object.entries(exportsByOperation)) {
      const matching = input.capabilityCalls.filter((call) => call.operation === operation && call.handlerExport === handlerExport)
      problem(matching.length !== 1, "missing-or-duplicated-operation:" + operation)
      if (admission) problem(matching.some((call) => call.principalRef !== admission.principalRef),
        "operation-owner-mismatch:" + operation)
      if (analysis) problem(matching.some((call) => call.accessRevision !== analysis.accessRevision),
        "operation-access-revision-mismatch:" + operation)
    }
  }
  // Correlation cannot authenticate the provenance of supplied records. Only live
  // hosted observations and independent review may subsequently qualify AM06.
  return { state: mismatches.length ? "REJECTED" : missing.length ? "NOT_RUN" : "CORRELATED_NOT_ATTESTED",
    missing, mismatches }
}
