import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SfNativeRunRecord } from "../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createSfAnalysisContinuation } from "../../../product/ai/continuation.ts"

type ContinuationOf = { runRef: string; version: number; caseRef: SfNativeRunRecord["caseRef"]; responseRef: string; responseDigest: string }
type AdmittedContinuation = SfNativeRunRecord & { continuationOf: ContinuationOf }

const caseRef = { id: "case-1", incarnation: "inc-1", version: 4 }
const receipt = {
  runId: "run-new", nativeSessionId: "session-new", profileId: "sf_finance", profileVersion: "1.0.0", profileDigest: "a".repeat(64),
  skillId: "sf-explicar-forecast", skillVersion: "1.0.0", sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64),
  loadedMessageId: "message-new", loadedAt: "2026-11-13T00:00:00.000Z", manifestDigest: "d".repeat(64),
} as const
const request = {
  caseRef, profileId: "sf_finance", profileVersion: "1.0.0", skillId: "sf-explicar-forecast", skillVersion: "1.0.0", manifestDigest: receipt.manifestDigest,
  outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: ["sf_dashboard_read"], objective: "Atualizar a análise", contextFingerprint: "context-new",
}
const skillInput = { answer: "premissa corrigida" }
const response = { ref: "response-1", digest: "e".repeat(64), caseRef }
const ui = { kind: "ui", binding: { principalRef: "user-1", policyVersion: "policy-new", accessRevision: "access-new" } } as unknown as TrustedDomainContext
const prior = {
  schema: "sf-native-run-v1", runRef: "run-old", version: 7, state: "needs-input", requestDigest: "f".repeat(64), skillInputDigest: "1".repeat(64), intentDigest: "2".repeat(64),
  principalRef: "user-1", policyVersion: "policy-old", accessRevision: "access-old", caseRef: { ...caseRef, version: 3 },
  selection: {
    profile: { id: "sf_finance", version: receipt.profileVersion, sourceDigest: receipt.profileDigest },
    skills: [{ id: receipt.skillId, version: receipt.skillVersion, sourceDigest: receipt.sourceDigest, instructionsDigest: receipt.instructionsDigest }],
    operationIds: [], manifestDigest: receipt.manifestDigest,
  },
  model: { providerID: "provider", id: "model" }, skillId: "sf-explicar-forecast", objective: "Question", contextFingerprint: "context-old", createdAt: "old", updatedAt: "old",
} as unknown as SfNativeRunRecord

function fixture(options?: { revokeOnAdmission?: boolean; revokeAfterAdmission?: boolean; changeResponseOnRecheck?: boolean; invalidReceipt?: boolean }) {
  const counters = { priorReads: 0, responseReads: 0, admissions: 0, revalidations: 0 }
  const continuation = createSfAnalysisContinuation({
    readPrior: async () => { counters.priorReads++; return { status: "ok", value: prior } },
    resolveHumanResponse: async () => {
      counters.responseReads++
      return { status: "ok", value: options?.changeResponseOnRecheck && counters.responseReads > 1 ? { ...response, digest: "9".repeat(64) } : response }
    },
    admitFresh: async ({ continuationOf }) => {
      counters.admissions++
      const run = {
        ...prior, runRef: "run-new", version: 2, state: "queued", requestDigest: digestSfValue(request), skillInputDigest: digestSfValue(skillInput),
        principalRef: "user-1", policyVersion: "policy-new", accessRevision: "access-new", caseRef, objective: request.objective, contextFingerprint: "context-new", updatedAt: "new",
        continuationOf, native: { sessionID: "session-new", skillReceipt: receipt },
      } as AdmittedContinuation
      return { status: "ok", value: { run, sessionID: "session-new", skillReceipt: options?.invalidReceipt ? { ...receipt, runId: "forged-run" } : receipt } }
    },
    readAdmitted: async () => {
      const run = {
        ...prior, runRef: "run-new", version: 2, state: "queued", requestDigest: digestSfValue(request), skillInputDigest: digestSfValue(skillInput),
        principalRef: "user-1", policyVersion: "policy-new", accessRevision: "access-new", caseRef, objective: request.objective, contextFingerprint: "context-new", updatedAt: "new",
        continuationOf: { runRef: "run-old", version: 7, caseRef: prior.caseRef, responseRef: response.ref, responseDigest: response.digest },
        native: { sessionID: "session-new", skillReceipt: receipt },
      }
      return { status: "ok", value: run as unknown as SfNativeRunRecord }
    },
    revalidate: async () => { counters.revalidations++; return !(options?.revokeOnAdmission && counters.revalidations >= 2) && !(options?.revokeAfterAdmission && counters.revalidations >= 3) },
  })
  return { continuation, counters }
}

test("continuation admits a fresh run with exact human-response lineage and a new session/receipt", async () => {
  const f = fixture()
  const result = await f.continuation(request, skillInput, { priorRunRef: prior.runRef, expectedPriorVersion: prior.version, responseRef: response.ref }, ui)
  expect(result).toMatchObject({ status: "ok", value: { run: { runRef: "run-new", state: "queued", continuationOf: { runRef: "run-old", version: 7, responseRef: "response-1", responseDigest: response.digest } }, sessionID: "session-new", skillReceipt: { runId: "run-new", nativeSessionId: "session-new" } } })
  expect(f.counters.admissions).toBe(1)
  expect(f.counters.priorReads).toBe(2)
  expect(f.counters.responseReads).toBe(2)
})

test("continuation refuses a response changed between initial resolution and pre-admission recheck", async () => {
  const f = fixture({ changeResponseOnRecheck: true })
  const result = await f.continuation(request, skillInput, { priorRunRef: prior.runRef, expectedPriorVersion: prior.version, responseRef: response.ref }, ui)
  expect(result).toEqual({ status: "stale", reason: "continuation-input-changed" })
  expect(f.counters.admissions).toBe(0)
})

test("continuation refuses an admitted run whose returned receipt differs from its persisted receipt", async () => {
  const f = fixture({ invalidReceipt: true })
  const result = await f.continuation(request, skillInput, { priorRunRef: prior.runRef, expectedPriorVersion: prior.version, responseRef: response.ref }, ui)
  expect(result).toEqual({ status: "unavailable", reason: "continuation-admission-unverified" })
  expect(f.counters.admissions).toBe(1)
})

test("continuation does not admit after current authority is revoked", async () => {
  const f = fixture({ revokeOnAdmission: true })
  const result = await f.continuation(request, skillInput, { priorRunRef: prior.runRef, expectedPriorVersion: prior.version, responseRef: response.ref }, ui)
  expect(result).toEqual({ status: "stale", reason: "continuation-input-changed" })
  expect(f.counters.admissions).toBe(0)
})

test("continuation withholds the new run if authority is revoked after admission", async () => {
  const f = fixture({ revokeAfterAdmission: true })
  const result = await f.continuation(request, skillInput, { priorRunRef: prior.runRef, expectedPriorVersion: prior.version, responseRef: response.ref }, ui)
  expect(result).toEqual({ status: "unavailable", reason: "continuation-admission-unverified" })
  expect(f.counters.admissions).toBe(1)
})

test("continuation rejects stale prior versions and non-UI contexts before resolving a response", async () => {
  const f = fixture()
  expect(await f.continuation(request, skillInput, { priorRunRef: prior.runRef, expectedPriorVersion: 6, responseRef: response.ref }, ui)).toEqual({ status: "stale", reason: "continuation-base-changed" })
  expect(await f.continuation(request, skillInput, { priorRunRef: prior.runRef, expectedPriorVersion: prior.version, responseRef: response.ref }, { kind: "native" } as unknown as TrustedDomainContext)).toEqual({ status: "denied", reason: "fresh-human-authority-required" })
  expect(f.counters.responseReads).toBe(0)
  expect(f.counters.admissions).toBe(0)
})
