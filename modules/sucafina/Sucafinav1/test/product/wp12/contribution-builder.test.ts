import { expect, test } from "bun:test"
import { buildSfContribution } from "../../../product/ai/contribution-builder.ts"
import { digestSfContribution } from "../../../product/contracts/canonical.ts"
import type { SfNativeRunRecord } from "../../../product/contracts/state.ts"

const caseRef = { id: "case", incarnation: "inc", version: 1 }
const receipt = { runId: "run", nativeSessionId: "session", profileId: "sf_finance", profileVersion: "1", profileDigest: "a".repeat(64), skillId: "skill", skillVersion: "1", sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64), loadedMessageId: "loaded", loadedAt: "2026-11-13T00:00:00Z", manifestDigest: "d".repeat(64) }
const run = { runRef: "run", state: "running", caseRef, native: { sessionID: "session", skillReceipt: receipt }, model: { providerID: "provider", id: "model" }, contextFingerprint: "context", accessRevision: "access", skillId: "skill", selection: { profile: { outputTypes: ["MatchExplanation"] }, skills: [{ id: "skill", outputSchemaRefs: ["MatchExplanation"] }] } } as unknown as SfNativeRunRecord
const candidate = { kind: "MatchExplanation", payload: { candidateCaseRef: caseRef, matchedCriteria: [], currentDifferences: [], sourceStates: [], limitations: [] }, evidenceRefs: [] }
const input = { run, candidate, actualModel: { providerID: "provider", id: "model" }, outputId: "output", createdAt: "2026-11-13T00:00:00Z" }

test("host builds persisted provenance from the observed assistant model and skill receipt", () => {
  const result = buildSfContribution(input)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.value.runProvenance).toMatchObject({ ...receipt, actualModel: "provider/model", contextFingerprint: "context" })
  expect(result.value.outputDigest).toBe(digestSfContribution(result.value))
  expect(buildSfContribution({ ...input, actualModel: { providerID: "provider", id: "other" } })).toEqual({ status: "denied", reason: "invalid-native-output-context" })
  expect(buildSfContribution({ ...input, candidate: { ...candidate, runProvenance: {} } })).toEqual({ status: "denied", reason: "invalid-native-output" })
  expect(buildSfContribution({ ...input, candidate: { ...candidate, payload: {} } })).toEqual({ status: "denied", reason: "invalid-native-output" })
})

test("review provenance is assigned by the host for an independent run", () => {
  const review = { ...run, runRef: "review", native: { sessionID: "review-session", skillReceipt: { ...receipt, runId: "review", nativeSessionId: "review-session", profileId: "sf_reviewer", skillId: "review-skill" } }, skillId: "review-skill", selection: { profile: { id: "sf_reviewer", outputTypes: ["CritiqueReport"] }, skills: [{ id: "review-skill", outputSchemaRefs: ["CritiqueReport"] }] }, reviewTarget: { targetRunId: "author", targetSessionId: "author-session", targetOutputDigest: "e".repeat(64), caseRef } } as unknown as SfNativeRunRecord
  const result = buildSfContribution({ ...input, run: review, candidate: { kind: "CritiqueReport", payload: { claimIssues: [], unresolvedConditions: [], evidenceRefs: [] }, evidenceRefs: [] } })
  expect(result.status).toBe("ok")
  if (result.status !== "ok" || result.value.kind !== "CritiqueReport" || result.value.state !== "ready") return
  expect(result.value.payload).toMatchObject({ targetRunId: "author", targetOutputDigest: "e".repeat(64), reviewerRunId: "review", reviewerSessionId: "review-session" })
  expect(buildSfContribution({ ...input, run: { ...review, reviewTarget: { ...review.reviewTarget!, targetSessionId: "review-session" } }, candidate: { kind: "CritiqueReport", payload: { claimIssues: [], unresolvedConditions: [], evidenceRefs: [] }, evidenceRefs: [] } })).toMatchObject({ status: "denied", reason: "invalid-review-output-context" })
})
