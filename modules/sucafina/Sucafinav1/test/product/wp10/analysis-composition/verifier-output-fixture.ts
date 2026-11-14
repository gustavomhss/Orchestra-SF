import { digestSfContribution, digestSfValue } from "../../../../product/contracts/canonical.ts"
import { decodeSfContributionEnvelope } from "../../../../product/contracts/schema-admission.ts"
import type { SfAnalysisRequest } from "../../../../../../../apps/cli/src/sucafina-product/analysis-verifier.ts"

/** Structural fixture for a payload verifier. No native run, loaded skill, or publication is claimed. */
export function verifierOutputFixture(request: SfAnalysisRequest, candidate: unknown) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error("Verifier output fixture must be an object")
  const at = "2026-11-14T00:00:00Z"
  const decoded = decodeSfContributionEnvelope({
    ...candidate,
    id: "unpublished-verifier-fixture",
    caseRef: request.caseRef,
    schemaVersion: "sf-contribution-v1",
    runProvenance: {
      runId: "unexecuted-verifier-run", nativeSessionId: "unexecuted-verifier-session",
      profileId: request.profileId, profileVersion: request.profileVersion, profileDigest: "0".repeat(64),
      skillId: request.skillId, skillVersion: request.skillVersion, sourceDigest: "1".repeat(64), instructionsDigest: "2".repeat(64),
      loadedMessageId: "unexecuted-verifier-skill", loadedAt: at, manifestDigest: request.manifestDigest,
      actualModel: "fixture/unexecuted", contextFingerprint: digestSfValue(request),
    },
    accessRevision: "unpublished-payload-fixture", createdAt: at, outputDigest: "0".repeat(64),
  })
  if (!decoded.ok) throw new Error("Verifier output fixture failed canonical structural admission")
  return { ...decoded.value, outputDigest: digestSfContribution(decoded.value) }
}
