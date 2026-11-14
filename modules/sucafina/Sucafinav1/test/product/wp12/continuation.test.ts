import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SfNativeRunRecord } from "../../../product/contracts/state.ts"
import type { SkillLoadReceipt } from "../../../product/contracts/resident-ai.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createSfAnalysisContinuation } from "../../../product/ai/continuation.ts"

type ContinuationOf = { runRef: string; version: number; caseRef: SfNativeRunRecord["caseRef"]; responseRef: string; responseDigest: string }
type AdmittedContinuation = SfNativeRunRecord & { continuationOf: ContinuationOf }
type AdmittedValue = { run: AdmittedContinuation; sessionID: string; skillReceipt: SkillLoadReceipt }
type AdmissionInput = Parameters<Parameters<typeof createSfAnalysisContinuation>[0]["admitFresh"]>[0]

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

function fixture(options?: { revokeOnAdmission?: boolean; revokeAfterAdmission?: boolean; changeResponseOnRecheck?: boolean; invalidReceipt?: boolean;
  onAdmit?: (input: AdmissionInput) => void;
  onRevalidate?: (phase: number, retained: { admitted?: AdmittedValue; reread?: SfNativeRunRecord; prior: SfNativeRunRecord; response: typeof response }) => void }) {
  const counters = { priorReads: 0, responseReads: 0, admissions: 0, revalidations: 0 }
  const priorValue = structuredClone(prior)
  const responseValue = structuredClone(response)
  const receiptValue: SkillLoadReceipt = structuredClone(receipt)
  const retained: { admitted?: AdmittedValue; reread?: SfNativeRunRecord; prior: SfNativeRunRecord; response: typeof response } = { prior: priorValue, response: responseValue }
  const continuation = createSfAnalysisContinuation({
    readPrior: async () => { counters.priorReads++; return { status: "ok", value: priorValue } },
    resolveHumanResponse: async () => {
      counters.responseReads++
      return { status: "ok", value: options?.changeResponseOnRecheck && counters.responseReads > 1 ? { ...responseValue, digest: "9".repeat(64) } : responseValue }
    },
    admitFresh: async (input) => {
      counters.admissions++
      options?.onAdmit?.(input)
      const { continuationOf } = input
      const run = {
        ...priorValue, runRef: "run-new", version: 2, state: "queued", requestDigest: digestSfValue(request), skillInputDigest: digestSfValue(skillInput),
        principalRef: "user-1", policyVersion: "policy-new", accessRevision: "access-new", caseRef, objective: request.objective, contextFingerprint: "context-new", updatedAt: "new",
        continuationOf, native: { sessionID: "session-new", skillReceipt: receiptValue },
      } as AdmittedContinuation
      retained.admitted = { run, sessionID: "session-new", skillReceipt: options?.invalidReceipt ? { ...receiptValue, runId: "forged-run" } : receiptValue }
      return { status: "ok", value: retained.admitted }
    },
    readAdmitted: async () => {
      const run = {
        ...priorValue, runRef: "run-new", version: 2, state: "queued", requestDigest: digestSfValue(request), skillInputDigest: digestSfValue(skillInput),
        principalRef: "user-1", policyVersion: "policy-new", accessRevision: "access-new", caseRef, objective: request.objective, contextFingerprint: "context-new", updatedAt: "new",
        continuationOf: { runRef: "run-old", version: 7, caseRef: priorValue.caseRef, responseRef: responseValue.ref, responseDigest: responseValue.digest },
        native: { sessionID: "session-new", skillReceipt: receiptValue },
      }
      retained.reread = run as unknown as SfNativeRunRecord
      return { status: "ok", value: retained.reread }
    },
    revalidate: async () => { counters.revalidations++; options?.onRevalidate?.(counters.revalidations, retained); return !(options?.revokeOnAdmission && counters.revalidations >= 2) && !(options?.revokeAfterAdmission && counters.revalidations >= 3) },
  })
  return { continuation, counters, retained }
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
  expect(result).toEqual({ status: "denied", reason: "fresh-human-authority-required" })
  expect(f.counters.admissions).toBe(0)
})

test("continuation withholds the new run if authority is revoked after admission", async () => {
  const f = fixture({ revokeAfterAdmission: true })
  const result = await f.continuation(request, skillInput, { priorRunRef: prior.runRef, expectedPriorVersion: prior.version, responseRef: response.ref }, ui)
  expect(result).toEqual({ status: "denied", reason: "fresh-human-authority-required" })
  expect(f.counters.admissions).toBe(1)
})

test("continuation binds the original command before any authority callback or admission", async () => {
  for (const phase of [1, 2]) {
    const selectedRequest = structuredClone(request)
    const f = fixture({ onRevalidate: (step) => { if (step === phase) selectedRequest.objective = "Replaced during authorization" } })
    expect(await f.continuation(selectedRequest, skillInput, { priorRunRef: prior.runRef, expectedPriorVersion: prior.version, responseRef: response.ref }, ui))
      .toEqual({ status: "denied", reason: "continuation-input-mutated" })
    expect(f.counters.admissions).toBe(0)
  }
  // Real authority factories freeze binding and lease. These mutable fixture
  // probes cover the component's extra defense for divergent host composition.
  for (const mutation of ["skill-input", "selection", "prior", "response", "binding", "binding-identity", "lease-identity", "cycle"] as const) {
    const selectedInput = structuredClone(skillInput)
    const selection = { priorRunRef: prior.runRef, expectedPriorVersion: prior.version, responseRef: response.ref }
    const call = structuredClone(ui)
    const f = fixture({ onRevalidate: (step, retained) => {
      if (step !== 2) return
      if (mutation === "skill-input") selectedInput.answer = "Changed after human confirmation"
      if (mutation === "selection") selection.responseRef = "other-response"
      if (mutation === "prior") retained.prior.objective = "Changed prior history"
      if (mutation === "response") retained.response.digest = "8".repeat(64)
      if (mutation === "binding") Object.assign(call.binding, { principalRef: "other-principal" })
      if (mutation === "binding-identity") Object.assign(call, { binding: { ...call.binding } })
      if (mutation === "lease-identity") Object.assign(call, { lease: {} })
      if (mutation === "cycle") Object.assign(selectedInput, { cyclic: selectedInput })
    } })
    expect(await f.continuation(request, selectedInput, selection, call)).toEqual({ status: "denied", reason: "continuation-input-mutated" })
    expect(f.counters.admissions).toBe(0)
  }
})

test("continuation isolates the admission command and refuses its alteration without mutating caller input", async () => {
  for (const target of ["request", "skill-input", "lineage"] as const) {
    const selectedRequest = structuredClone(request)
    const selectedInput = structuredClone(skillInput)
    const callerDigest = digestSfValue({ selectedRequest, selectedInput })
    const f = fixture({ onAdmit: (command) => {
      expect(command.request).not.toBe(selectedRequest)
      expect(command.skillInput).not.toBe(selectedInput)
      expect(command.continuationOf.caseRef).not.toBe(f.retained.prior.caseRef)
      if (target === "request") command.request.objective = "Replaced inside admission"
      if (target === "skill-input") command.skillInput = { answer: "Replaced human answer" }
      if (target === "lineage") command.continuationOf.responseDigest = "9".repeat(64)
    } })
    expect(await f.continuation(selectedRequest, selectedInput, { priorRunRef: prior.runRef, expectedPriorVersion: prior.version, responseRef: response.ref }, ui))
      .toEqual({ status: "denied", reason: "continuation-input-mutated" })
    expect(f.counters.admissions).toBe(1)
    expect(digestSfValue({ selectedRequest, selectedInput })).toBe(callerDigest)
    expect(f.retained.prior.state).toBe("needs-input")
    expect(f.retained.response.digest).toBe(response.digest)
  }
})

test("continuation withholds admitted aliases changed during final authorization and returns an isolated result", async () => {
  for (const mutation of ["run", "receipt", "reread", "cycle"] as const) {
    const f = fixture({ onRevalidate: (step, retained) => {
      if (step !== 3) return
      if (!retained.admitted || !retained.reread) throw new Error("Expected an admitted and re-read continuation")
      if (mutation === "run") retained.admitted.run.objective = "Replaced after admission verification"
      if (mutation === "receipt") retained.admitted.skillReceipt.loadedMessageId = "unobserved-message"
      if (mutation === "reread") retained.reread.updatedAt = "Changed during final authority"
      if (mutation === "cycle") Object.assign(retained.admitted.run, { cyclic: retained.admitted.run })
    } })
    expect(await f.continuation(request, skillInput, { priorRunRef: prior.runRef, expectedPriorVersion: prior.version, responseRef: response.ref }, ui))
      .toEqual({ status: "denied", reason: "continuation-admission-mutated" })
    expect(f.counters.admissions).toBe(1)
  }
  const f = fixture()
  const result = await f.continuation(request, skillInput, { priorRunRef: prior.runRef, expectedPriorVersion: prior.version, responseRef: response.ref }, ui)
  expect(result.status).toBe("ok")
  if (result.status !== "ok" || !f.retained.admitted) throw new Error("Expected verified continuation")
  const digest = digestSfValue(result.value)
  f.retained.admitted.run.objective = "Mutated after return"
  f.retained.admitted.skillReceipt.loadedMessageId = "later-message"
  expect(digestSfValue(result.value)).toBe(digest)
  expect(result.value).not.toBe(f.retained.admitted)
})

test("continuation rejects stale prior versions and non-UI contexts before resolving a response", async () => {
  const f = fixture()
  expect(await f.continuation(request, skillInput, { priorRunRef: prior.runRef, expectedPriorVersion: 6, responseRef: response.ref }, ui)).toEqual({ status: "stale", reason: "continuation-base-changed" })
  expect(await f.continuation(request, skillInput, { priorRunRef: prior.runRef, expectedPriorVersion: prior.version, responseRef: response.ref }, { kind: "native" } as unknown as TrustedDomainContext)).toEqual({ status: "denied", reason: "fresh-human-authority-required" })
  expect(f.counters.responseReads).toBe(0)
  expect(f.counters.admissions).toBe(0)
})
