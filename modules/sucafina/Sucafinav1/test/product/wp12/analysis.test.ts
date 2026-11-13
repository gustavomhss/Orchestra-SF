import { expect, test } from "bun:test"
import { cancelSfAnalysis } from "../../../product/ai/analysis-port.ts"

test("cancellation refuses a session different from the loaded skill receipt", async () => {
  const input = { sessionID: "session-current", skillReceipt: { nativeSessionId: "session-other" } } as unknown as Parameters<typeof cancelSfAnalysis>[0]
  expect(await cancelSfAnalysis(input)).toEqual({ status: "denied", reason: "session-mismatch" })
})

test("a routine result cannot start another routine", async () => {
  const { runSfAnalysisRoutine } = await import("../../../product/ai/analysis-port.ts")
  const input = { binding: { kind: "native", binding: { entryMode: "routine-result" } } } as unknown as Parameters<typeof runSfAnalysisRoutine>[0]
  expect(await runSfAnalysisRoutine(input)).toEqual({ status: "denied", reason: "recursive-routine" })
})

test("tampered contribution digest is rejected before publication", async () => {
  const { publishSfContribution } = await import("../../../product/ai/analysis-port.ts")
  const receipt = {
    runId: "run-1", nativeSessionId: "session-1", profileId: "sf_finance", profileVersion: "1.0.0", profileDigest: "a".repeat(64),
    skillId: "sf-explicar-forecast", skillVersion: "1.0.0", sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64),
    loadedMessageId: "message-1", loadedAt: "2026-11-13T00:00:00Z", manifestDigest: "d".repeat(64),
  }
  const output = {
    id: "output-1", caseRef: { id: "case-1", version: 1, incarnation: "inc-1" }, kind: "FinancialAnalysis", schemaVersion: "sf-contribution-v1",
    state: "failed", reason: "provider-unavailable", evidenceRefs: [], runProvenance: { ...receipt, actualModel: "configured-model", contextFingerprint: "context-1" },
    accessRevision: "access-1", createdAt: "2026-11-13T00:00:00Z", outputDigest: "0".repeat(64),
  }
  const input = { output, skillReceipt: receipt, runRef: "run-1" } as unknown as Parameters<typeof publishSfContribution>[0]
  expect(await publishSfContribution(input)).toEqual({ status: "failed", reason: "contribution-digest-mismatch" })
})

test("a review cannot reuse the author's run or session", async () => {
  const { publishSfContribution } = await import("../../../product/ai/analysis-port.ts")
  const receipt = {
    runId: "same-run", nativeSessionId: "same-session", profileId: "sf_reviewer", profileVersion: "1.0.0", profileDigest: "a".repeat(64),
    skillId: "sf-contestar-decisao", skillVersion: "1.0.0", sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64),
    loadedMessageId: "message-1", loadedAt: "2026-11-13T00:00:00Z", manifestDigest: "d".repeat(64),
  }
  const caseRef = { id: "case-1", version: 1, incarnation: "inc-1" }
  const output = {
    id: "output-1", caseRef, kind: "CritiqueReport", schemaVersion: "sf-contribution-v1", state: "failed", reason: "not-reviewed",
    evidenceRefs: [], runProvenance: { ...receipt, actualModel: "configured-model", contextFingerprint: "context-1", reviewerRunId: "same-run", targetRunId: "same-run", targetOutputDigest: "e".repeat(64) },
    accessRevision: "access-1", createdAt: "2026-11-13T00:00:00Z", outputDigest: "0".repeat(64),
  }
  const input = { output, skillReceipt: receipt, runRef: "run-1", reviewTarget: { caseRef, targetRunId: "same-run", targetSessionId: "same-session", targetOutputDigest: "e".repeat(64) } } as unknown as Parameters<typeof publishSfContribution>[0]
  expect(await publishSfContribution(input)).toEqual({ status: "failed", reason: "review-not-independent" })
})

test("analysis rejects invalid skill input before host admission", async () => {
  const { runSfAnalysis } = await import("../../../product/ai/analysis-port.ts")
  const input = { request: { skillId: "sf-explicar-forecast" }, skillInput: {} } as unknown as Parameters<typeof runSfAnalysis>[0]
  expect(await runSfAnalysis(input)).toEqual({ status: "failed", reason: "invalid-skill-input" })
})
