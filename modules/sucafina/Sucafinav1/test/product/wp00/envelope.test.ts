import { expect, test } from "bun:test"
import { decodeSfContributionEnvelope } from "../../../product/contracts/schema-admission.ts"
import type { ContributionEnvelope } from "../../../product/contracts/resident-ai.ts"

const envelope: ContributionEnvelope = {
  id: "output-1", caseRef: { id: "case-1", incarnation: "case-incarnation", version: 1 },
  schemaVersion: "sf-contribution-v1", kind: "IntentFrame", state: "unavailable", reason: "source-unavailable",
  evidenceRefs: [], accessRevision: "access-1", createdAt: "2026-11-13T00:00:00Z", outputDigest: "a".repeat(64),
  runProvenance: { runId: "run-1", nativeSessionId: "session-1", profileId: "sf_finance", profileVersion: "1",
    profileDigest: "b".repeat(64), skillId: "sf-estruturar-intencao", skillVersion: "1", sourceDigest: "c".repeat(64),
    instructionsDigest: "d".repeat(64), loadedMessageId: "message-1", loadedAt: "2026-11-13T00:00:00Z",
    manifestDigest: "e".repeat(64), actualModel: "provider/model", contextFingerprint: "context-1" },
}

test("native envelope admission rejects undeclared authority and malformed nested data", () => {
  expect(decodeSfContributionEnvelope(envelope)).toEqual({ ok: true, value: envelope })
  expect(decodeSfContributionEnvelope({ ...envelope, principalRef: "spoofed" }).ok).toBe(false)
  expect(decodeSfContributionEnvelope({ ...envelope, caseRef: { ...envelope.caseRef, roles: ["admin"] } }).ok).toBe(false)
  expect(decodeSfContributionEnvelope({ ...envelope, runProvenance: { ...envelope.runProvenance, endpoint: "https://example.invalid" } }).ok).toBe(false)
  expect(decodeSfContributionEnvelope({ ...envelope, evidenceRefs: [{ schema: "sf-evidence-v1", kind: "record" }] }).ok).toBe(false)
  expect(decodeSfContributionEnvelope({ ...envelope, state: "ready", payload: { authority: "admin" } }).ok).toBe(false)
  expect(decodeSfContributionEnvelope({ ...envelope, caseRef: { ...envelope.caseRef, version: Number.NaN } }).ok).toBe(false)
  expect(decodeSfContributionEnvelope({ ...envelope, payload: {} }).ok).toBe(false)
})
