import { digestSfContribution } from "../../../product/contracts/canonical.ts"
import type { ContributionEnvelope, ResidentProfile, SkillLoadReceipt, SkillManifest } from "../../../product/contracts/resident-ai.ts"
import type { SfNativeRunRecord } from "../../../product/contracts/state.ts"

/** Test records for durable provenance boundaries; these are not native/provider witnesses. */
export function sfRunFixture() {
  const caseRef = { id: "case", incarnation: "inc", version: 1 }
  const profile: ResidentProfile = { id: "sf_finance", version: "1", mission: "Recall", allowedSkills: ["sf-consultar-memoria-decisoria"],
    allowedOperations: [], outputTypes: ["MatchExplanation"], contextBudgetTokens: 1000, maxSteps: 2, maxDelegations: 0,
    modelClass: "reasoning", resumePolicy: "fresh", sourcePath: "profile.json", sourceDigest: "a".repeat(64) }
  const skill: SkillManifest = { id: "sf-consultar-memoria-decisoria", version: "1", sourcePath: "skills/sf-consultar-memoria-decisoria/SKILL.md",
    sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64), inputSchemaRef: "DecisionRecallInput", outputSchemaRefs: ["MatchExplanation"],
    allowedProfiles: ["sf_finance"], allowedOperations: [], workflow: ["Read authorized history"], limits: { maxSteps: 2, contextBudgetTokens: 1000 },
    positiveAcceptance: ["Open stored result"], negativeAcceptance: ["Refuse revoked access"] }
  const receipt: SkillLoadReceipt = { runId: "run", nativeSessionId: "session", profileId: profile.id, profileVersion: profile.version,
    profileDigest: profile.sourceDigest, skillId: skill.id, skillVersion: skill.version, sourceDigest: skill.sourceDigest,
    instructionsDigest: skill.instructionsDigest, loadedMessageId: "loaded", loadedAt: "2026-11-13T00:00:00Z", manifestDigest: "d".repeat(64) }
  const run: SfNativeRunRecord = { schema: "sf-native-run-v1", runRef: receipt.runId, version: 3, state: "running", caseRef,
    native: { sessionID: receipt.nativeSessionId, skillReceipt: receipt }, model: { providerID: "provider", id: "model" },
    contextFingerprint: "context", accessRevision: "access", principalRef: "principal", policyVersion: "policy", skillId: skill.id,
    selection: { profile, skills: [skill], operationIds: [], manifestDigest: receipt.manifestDigest }, objective: "Recall",
    createdAt: receipt.loadedAt, updatedAt: receipt.loadedAt, requestDigest: "1".repeat(64), skillInputDigest: "2".repeat(64), intentDigest: "3".repeat(64) }
  const output: ContributionEnvelope = { id: "output", caseRef, kind: "MatchExplanation", schemaVersion: "sf-contribution-v1", state: "ready",
    payload: { candidateCaseRef: caseRef, matchedCriteria: [], currentDifferences: [], sourceStates: [], limitations: [] }, evidenceRefs: [],
    runProvenance: { ...receipt, actualModel: "provider/model", contextFingerprint: run.contextFingerprint }, accessRevision: run.accessRevision,
    createdAt: receipt.loadedAt, outputDigest: "" }
  output.outputDigest = digestSfContribution(output)
  return { caseRef, profile, skill, receipt, run, output }
}
