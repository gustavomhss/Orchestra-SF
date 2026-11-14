import { digestSfContribution, digestSfValue } from "../contracts/canonical.ts"
import { decodeSfContributionOutput } from "../contracts/schema-admission.ts"
import type { ContributionEnvelope, SkillLoadReceipt } from "../contracts/resident-ai.ts"
import type { SfNativeRunRecord } from "../contracts/state.ts"

export function sameSfSkillLoadReceipt(receipt: SkillLoadReceipt, provenance: ContributionEnvelope["runProvenance"]) {
  return provenance.runId === receipt.runId && provenance.nativeSessionId === receipt.nativeSessionId && provenance.profileId === receipt.profileId &&
    provenance.profileVersion === receipt.profileVersion && provenance.profileDigest === receipt.profileDigest && provenance.skillId === receipt.skillId &&
    provenance.skillVersion === receipt.skillVersion && provenance.sourceDigest === receipt.sourceDigest && provenance.instructionsDigest === receipt.instructionsDigest &&
    provenance.loadedMessageId === receipt.loadedMessageId && provenance.loadedAt === receipt.loadedAt && provenance.manifestDigest === receipt.manifestDigest
}

/** Stored metadata is checked against the selected source and session, not treated as a new grant. */
export function hasSfRunSkillReceipt(run: SfNativeRunRecord) {
  const receipt = run.native?.skillReceipt
  const skill = run.selection?.skills?.find((item) => item.id === run.skillId)
  return !!receipt && !!skill && !!run.selection.profile && receipt.runId === run.runRef && receipt.nativeSessionId === run.native?.sessionID &&
    receipt.profileId === run.selection.profile.id && receipt.profileVersion === run.selection.profile.version && receipt.profileDigest === run.selection.profile.sourceDigest &&
    receipt.skillId === skill.id && receipt.skillVersion === skill.version && receipt.sourceDigest === skill.sourceDigest && receipt.instructionsDigest === skill.instructionsDigest &&
    receipt.manifestDigest === run.selection.manifestDigest && typeof receipt.loadedMessageId === "string" && !!receipt.loadedMessageId.trim() && Number.isFinite(Date.parse(receipt.loadedAt))
}

/** A profile-wide output grant does not let the active skill publish another skill's output. */
export function matchesSfRunOutput(run: SfNativeRunRecord, output: ContributionEnvelope) {
  const skill = run.selection?.skills?.find((item) => item.id === run.skillId)
  if (!hasSfRunSkillReceipt(run) || !run.native || !run.model || !skill || output.state !== "ready" || !output.id.trim() ||
    !run.selection.profile.outputTypes?.includes(output.kind) || !skill.outputSchemaRefs?.includes(output.kind) || !decodeSfContributionOutput(output.kind, output.payload).ok ||
    !sameSfSkillLoadReceipt(run.native.skillReceipt, output.runProvenance) || output.runProvenance.actualModel !== `${run.model.providerID}/${run.model.id}` ||
    output.runProvenance.contextFingerprint !== run.contextFingerprint || digestSfValue(output.caseRef) !== digestSfValue(run.caseRef) ||
    output.accessRevision !== run.accessRevision || digestSfContribution(output) !== output.outputDigest) return false
  if (!run.reviewTarget && !["sf-contestar-decisao", "sf-revisar-evidencias"].includes(run.skillId)) return true
  const target = run.reviewTarget
  if (!target || run.selection.profile.id !== "sf_reviewer" || target.targetRunId === run.runRef || target.targetSessionId === run.native.sessionID ||
    digestSfValue(target.caseRef) !== digestSfValue(run.caseRef) || output.runProvenance.targetRunId !== target.targetRunId ||
    output.runProvenance.targetOutputDigest !== target.targetOutputDigest || output.runProvenance.reviewerRunId !== run.runRef) return false
  return output.kind !== "CritiqueReport" || (output.payload.targetRunId === target.targetRunId && output.payload.targetOutputDigest === target.targetOutputDigest &&
    output.payload.reviewerRunId === run.runRef && output.payload.reviewerSessionId === run.native.sessionID)
}
