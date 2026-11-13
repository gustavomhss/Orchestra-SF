import { expect, test } from "bun:test"
import { createSfContributionReader } from "../../../product/ai/contribution-reader.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfRunStore, sfRunSourceFence } from "../../../product/ai/run-store.ts"
import { digestSfContribution } from "../../../product/contracts/canonical.ts"
import type { SfNativeRunRecord } from "../../../product/contracts/state.ts"
import type { ContributionEnvelope } from "../../../product/contracts/resident-ai.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { testPersistence } from "../../fixture/persistence.ts"

test("consumer opens the stored result and refuses revoked or mismatched provenance", async () => {
  const storage = testPersistence()
  const request = new Request("https://example.test/")
  const access = { allowed: true }
  const authority = { principalRef: "principal", policyVersion: "policy", accessRevision: "access" }
  const context = { kind: "ui", binding: authority } as unknown as TrustedDomainContext
  const state = createSfProductState({ persistence: storage.persistence, createId: () => "store", resolveTarget: async () => ({ incarnation: "inc" }), authorize: async () => access.allowed ? authority : undefined })
  const runs = createSfRunStore({ state, requestFor: () => request, revalidate: async () => access.allowed, preflight: async () => ({ status: "ok", value: { sourceFence: sfRunSourceFence(storage.state.dashboard) } }), revalidateForCommit: async () => ({ status: "ok", value: true }), now: () => "2026-11-13T00:00:00Z" })
  const caseRef = { id: "case", incarnation: "inc", version: 1 }
  const receipt = { runId: "run", nativeSessionId: "session", profileId: "sf_finance", profileVersion: "1", profileDigest: "a".repeat(64), skillId: "skill", skillVersion: "1", sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64), loadedMessageId: "message", loadedAt: "2026-11-13T00:00:00Z", manifestDigest: "d".repeat(64) }
  const output = { id: "output", caseRef, kind: "MatchExplanation", schemaVersion: "sf-contribution-v1", state: "ready", payload: { candidateCaseRef: caseRef, matchedCriteria: [], currentDifferences: [], sourceStates: [], limitations: [] }, evidenceRefs: [], runProvenance: { ...receipt, actualModel: "provider/model", contextFingerprint: "context" }, accessRevision: "access", createdAt: "2026-11-13T00:00:00Z", outputDigest: "" } as unknown as ContributionEnvelope
  output.outputDigest = digestSfContribution(output)
  const run = { runRef: "run", state: "ready", caseRef, native: { sessionID: "session", skillReceipt: receipt }, outputRef: "output" } as unknown as SfNativeRunRecord
  await state.transaction(request, { namespace: "contributions", expectedStorageVersion: 0, idempotencyKey: "seed", commandDigest: "e".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (current) => { current.nativeRuns = { run }; current.contributions.output = output; return { commit: true, value: true } })
  const read = createSfContributionReader({ state, runs, requestFor: () => request, revalidate: async () => access.allowed, verify: async () => ({ status: "ok", value: true }) })
  expect(await read({ outputRef: "output", caseRef }, context)).toMatchObject({ status: "ok", value: { output: { id: "output" }, run: { runRef: "run" } } })
  expect(await read({ outputRef: "output", caseRef: { ...caseRef, version: 2 } }, context)).toMatchObject({ status: "unavailable" })
  const revokedDuringVerification = createSfContributionReader({ state, runs, requestFor: () => request, revalidate: async () => access.allowed, verify: async () => { access.allowed = false; return { status: "ok", value: true } } })
  expect(await revokedDuringVerification({ outputRef: "output", caseRef }, context)).toMatchObject({ status: "denied" })
  access.allowed = false
  expect(await read({ outputRef: "output", caseRef }, context)).toMatchObject({ status: "denied" })
})
