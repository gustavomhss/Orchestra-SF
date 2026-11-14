import type { ContributionEnvelope } from "../../../../product/contracts/resident-ai.ts"

/** Complete shape for payload-verifier tests only. These declared synthetic
 * provenance fields are never admitted, persisted or counted as native proof.
 * Each caller hashes its complete envelope after assigning its typed payload.
 */
export function contributionPayloadMetadata(caseRef: ContributionEnvelope["caseRef"]): Pick<ContributionEnvelope,
  "id" | "caseRef" | "schemaVersion" | "runProvenance" | "accessRevision" | "createdAt" | "outputDigest"> {
  return {
    id: "payload-verifier-fixture-output",
    caseRef: structuredClone(caseRef),
    schemaVersion: "sf-contribution-v1",
    runProvenance: {
      runId: "payload-verifier-fixture-run", nativeSessionId: "payload-verifier-fixture-session",
      profileId: "sf_maestro", profileVersion: "fixture", profileDigest: "1".repeat(64),
      skillId: "payload-verifier-fixture-skill", skillVersion: "fixture", sourceDigest: "2".repeat(64),
      instructionsDigest: "3".repeat(64), loadedMessageId: "payload-verifier-fixture-message",
      loadedAt: "2026-11-14T00:00:00Z", manifestDigest: "4".repeat(64),
      actualModel: "payload-verifier-fixture-no-model-execution", contextFingerprint: "5".repeat(64),
    },
    accessRevision: "payload-verifier-fixture-access",
    createdAt: "2026-11-14T00:00:00Z",
    outputDigest: "",
  }
}
