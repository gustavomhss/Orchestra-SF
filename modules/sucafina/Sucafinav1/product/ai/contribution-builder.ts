import { digestSfContribution, digestSfValue } from "../contracts/canonical.ts"
import { decodeSfContributionEnvelope } from "../contracts/schema-admission.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { SfNativeRunRecord } from "../contracts/state.ts"
import type { ContributionEnvelope } from "../contracts/resident-ai.ts"
import { hasSfRunSkillReceipt } from "./run-provenance.ts"

/** The host supplies the model from the actual completed assistant message and its own identifiers. */
export function buildSfContribution(input: {
  candidate: unknown
  run: SfNativeRunRecord
  actualModel: SfNativeRunRecord["model"]
  outputId: string
  createdAt: string
}): PortResult<ContributionEnvelope> {
  if (input.run.state !== "running" || !input.run.native || !hasSfRunSkillReceipt(input.run) || !input.outputId.trim() || !Number.isFinite(Date.parse(input.createdAt)) || digestSfValue(input.actualModel) !== digestSfValue(input.run.model)) return { status: "denied", reason: "invalid-native-output-context" }
  const candidate = input.candidate
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate) || ![Object.prototype, null].includes(Object.getPrototypeOf(candidate)) || Reflect.ownKeys(candidate).some((key) => typeof key !== "string" || !["kind", "payload", "evidenceRefs"].includes(key)) || !("kind" in candidate) || !("payload" in candidate) || !("evidenceRefs" in candidate) || typeof candidate.kind !== "string") return { status: "denied", reason: "invalid-native-output" }
  const kind = candidate.kind
  const skill = input.run.selection.skills.find((item) => item.id === input.run.skillId)
  if (!skill || !skill.outputSchemaRefs.includes(kind) || !input.run.selection.profile.outputTypes.some((allowed) => allowed === kind)) return { status: "denied", reason: "native-output-kind-not-granted" }
  const target = input.run.reviewTarget
  const reviewSkill = input.run.skillId === "sf-contestar-decisao" || input.run.skillId === "sf-revisar-evidencias"
  // Independence applies to every output of a reviewer skill, including a standalone
  // UnresolvedCondition. The output kind must not make the author binding optional.
  if (reviewSkill && !target) return { status: "denied", reason: "invalid-review-output-context" }
  if (target && (input.run.selection.profile.id !== "sf_reviewer" || !target.targetRunId.trim() || !target.targetSessionId.trim() || !/^[a-f0-9]{64}$/.test(target.targetOutputDigest) || target.targetRunId === input.run.runRef || target.targetSessionId === input.run.native.sessionID || digestSfValue(target.caseRef) !== digestSfValue(input.run.caseRef))) return { status: "denied", reason: "invalid-review-output-context" }
  const receipt = input.run.native.skillReceipt
  if (target && (receipt.profileId !== "sf_reviewer" || receipt.profileId !== input.run.selection.profile.id || receipt.profileVersion !== input.run.selection.profile.version || receipt.profileDigest !== input.run.selection.profile.sourceDigest || receipt.runId !== input.run.runRef || receipt.nativeSessionId !== input.run.native.sessionID || receipt.skillId !== input.run.skillId || receipt.skillVersion !== skill.version || receipt.sourceDigest !== skill.sourceDigest || receipt.instructionsDigest !== skill.instructionsDigest || receipt.manifestDigest !== input.run.selection.manifestDigest || (!receipt.loadedMessageId || !Number.isFinite(Date.parse(receipt.loadedAt))) || (kind === "CritiqueReport" && receipt.skillId !== "sf-contestar-decisao") || (kind === "ClaimIssue" && receipt.skillId !== "sf-revisar-evidencias"))) return { status: "denied", reason: "invalid-review-output-context" }
  if (kind === "CritiqueReport" && (!target || !candidate.payload || typeof candidate.payload !== "object" || Array.isArray(candidate.payload) || ![Object.prototype, null].includes(Object.getPrototypeOf(candidate.payload)) || Reflect.ownKeys(candidate.payload).some((key) => typeof key !== "string" || !["claimIssues", "unresolvedConditions", "evidenceRefs"].includes(key)))) return { status: "denied", reason: "invalid-review-output-context" }
  if (kind === "ClaimIssue" && (!target || !candidate.payload || typeof candidate.payload !== "object" || Array.isArray(candidate.payload) || ![Object.prototype, null].includes(Object.getPrototypeOf(candidate.payload)) || Reflect.ownKeys(candidate.payload).some((key) => typeof key !== "string" || !["claimRef", "kind", "reason", "evidenceRefs"].includes(key)))) return { status: "denied", reason: "invalid-review-output-context" }
  const payload = kind === "CritiqueReport" && target ? { ...candidate.payload as object, targetRunId: target.targetRunId, targetOutputDigest: target.targetOutputDigest, reviewerRunId: input.run.runRef, reviewerSessionId: input.run.native.sessionID } : candidate.payload
  const draft = {
    id: input.outputId, caseRef: input.run.caseRef, kind, schemaVersion: "sf-contribution-v1", state: "ready", payload,
    evidenceRefs: candidate.evidenceRefs, runProvenance: { ...input.run.native.skillReceipt, actualModel: `${input.actualModel.providerID}/${input.actualModel.id}`, contextFingerprint: input.run.contextFingerprint,
      ...(target ? { reviewerRunId: input.run.runRef, targetRunId: target.targetRunId, targetOutputDigest: target.targetOutputDigest } : {}) },
    accessRevision: input.run.accessRevision, createdAt: input.createdAt, outputDigest: "0".repeat(64),
  }
  const decoded = decodeSfContributionEnvelope(draft)
  if (!decoded.ok) return { status: "denied", reason: "invalid-native-output" }
  return { status: "ok", value: { ...decoded.value, outputDigest: digestSfContribution(decoded.value) } }
}
