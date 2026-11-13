import { expect, test } from "bun:test"
import { createSfRunStore, sfRunSourceFence } from "../../../product/ai/run-store.ts"
import { createSfAnalysisHost } from "../../../product/ai/analysis-host.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import type { SfNativeRunRecord } from "../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { testPersistence } from "../../fixture/persistence.ts"

// Real product-state transactions with an injected host; this does not prove a native host or ACL.
async function fixture(options?: { mutateSnapshot?: boolean }) {
  const storage = testPersistence()
  const request = new Request("https://example.test/")
  const authority = { principalRef: "user", policyVersion: "policy", accessRevision: "access" }
  const context = { kind: "ui", binding: authority } as unknown as TrustedDomainContext
  const state = createSfProductState({ persistence: storage.persistence, authorize: async () => authority, resolveTarget: async () => ({ incarnation: "inc" }), createId: () => "store" })
  await state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "initial", commandDigest: "a".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (current) => {
    current.cases.case = { id: "case", incarnation: "inc", version: 1, participants: ["user"] } as unknown as typeof current.cases[string]
    return { commit: true, value: true }
  })
  const store = createSfRunStore({ state, requestFor: () => request, revalidate: async () => true, preflight: async () => ({ status: "ok", value: { sourceFence: sfRunSourceFence(storage.state.dashboard) } }), revalidateForCommit: async (_record, _context, snapshot) => { if (options?.mutateSnapshot) snapshot.data.injected = true; return { status: "ok", value: true } }, now: () => "2026-11-13T00:00:00Z" })
  const record = { schema: "sf-native-run-v1", runRef: "run", version: 1, intentDigest: "c".repeat(64), requestDigest: "a".repeat(64), skillInputDigest: "b".repeat(64), principalRef: "user", accessRevision: "access", policyVersion: "policy", caseRef: { id: "case", incarnation: "inc", version: 1 }, selection: { profile: { id: "sf_finance", version: "1", outputTypes: [], sourceDigest: "d".repeat(64) }, skills: [{ id: "skill", version: "1", sourceDigest: "e".repeat(64), instructionsDigest: "f".repeat(64) }], operationIds: [], manifestDigest: "c".repeat(64) }, model: { providerID: "openai", id: "model" }, skillId: "skill", objective: "review", contextFingerprint: "context", createdAt: "2026-11-13T00:00:00Z", updatedAt: "2026-11-13T00:00:00Z", state: "preparing" } as unknown as SfNativeRunRecord
  return { storage, state, store, context, record }
}

test("run is durably prepared without a fabricated skill receipt and rejects a stale transition", async () => {
  const f = await fixture()
  expect(await f.store.create(f.record, f.context)).toMatchObject({ status: "ok", value: { state: "preparing", version: 1 } })
  expect(await f.store.read("run", f.context)).toMatchObject({ status: "ok", value: { state: "preparing" } })
  expect(await f.store.transition("run", 0, "cancelled", "cancelled", f.context)).toMatchObject({ status: "conflict" })
  expect(await f.store.transition("run", 1, "cancelled", "cancelled", f.context)).toMatchObject({ status: "ok", value: { state: "cancelled", version: 2 } })
})

test("an invalid native receipt cannot move a preparing run to queued", async () => {
  const f = await fixture()
  await f.store.create(f.record, f.context)
  const receipt = { runId: "other", nativeSessionId: "session", skillId: "skill", manifestDigest: "c".repeat(64), profileId: "sf_finance", profileVersion: "1" } as Parameters<typeof f.store.attach>[3]
  expect(await f.store.attach("run", 1, "session", receipt, f.context)).toMatchObject({ status: "conflict", reason: "invalid-native-receipt" })
  expect(await f.store.read("run", f.context)).toMatchObject({ status: "ok", value: { state: "preparing", version: 1 } })
})


test("analysis host binds validation to the actual stored skill receipt", async () => {
  const f = await fixture()
  await f.store.create(f.record, f.context)
  const receipt = { runId: "run", nativeSessionId: "session", profileId: "sf_finance", profileVersion: "1", profileDigest: "d".repeat(64), skillId: "skill", skillVersion: "1", sourceDigest: "e".repeat(64), instructionsDigest: "f".repeat(64), loadedMessageId: "message", loadedAt: "2026-11-13T00:00:00Z", manifestDigest: "c".repeat(64) } as const
  expect(await f.store.attach("run", 1, "session", receipt, f.context)).toMatchObject({ status: "ok", value: { state: "queued" } })
  const host = createSfAnalysisHost({ store: f.store, verify: async () => ({ status: "ok", value: true }) } as unknown as Parameters<typeof createSfAnalysisHost>[0])
  const request = { runRef: "run", caseRef: f.record.caseRef, contextFingerprint: "context", manifestDigest: receipt.manifestDigest, accessRevision: "access", skillReceipts: [receipt] }
  expect(await host.revalidate(f.context, request)).toEqual({ status: "ok", value: true })
  expect(await host.revalidate(f.context, { ...request, skillReceipts: [{ ...receipt, loadedMessageId: "forged" }] })).toEqual({ status: "denied", reason: "run-binding-mismatch" })
})

test("stale run is preserved when its case advances", async () => {
  const f = await fixture()
  await f.store.create(f.record, f.context)
  const receipt = { runId: "run", nativeSessionId: "session", profileId: "sf_finance", profileVersion: "1", profileDigest: "d".repeat(64), skillId: "skill", skillVersion: "1", sourceDigest: "e".repeat(64), instructionsDigest: "f".repeat(64), loadedMessageId: "message", loadedAt: "2026-11-13T00:00:00Z", manifestDigest: "c".repeat(64) } as const
  await f.store.attach("run", 1, "session", receipt, f.context)
  const request = new Request("https://example.test/")
  const version = await f.state.read(request, "cases", () => null)
  if (version.status !== "ok") throw new Error("case state unavailable")
  await f.state.transaction(request, { namespace: "cases", expectedStorageVersion: version.storageVersion, idempotencyKey: "advance", commandDigest: "b".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (state) => {
    state.cases.case!.version++
    return { commit: true, value: true }
  })
  expect(await f.store.markStale("run", "case-changed", f.context)).toMatchObject({ status: "ok", value: { state: "stale", version: 3, native: { sessionID: "session" } } })
})


test("commit validator cannot mutate the storage snapshot", async () => {
  const f = await fixture({ mutateSnapshot: true })
  expect(await f.store.create(f.record, f.context)).toEqual({ status: "denied", reason: "commit-revalidation-mutated-snapshot" })
  expect(f.storage.state.dashboard.data.injected).toBeUndefined()
  expect(await f.state.read(new Request("https://example.test/"), "contributions", (state) => state.nativeRuns?.run)).toMatchObject({ status: "ok", value: undefined })
})

test("new runs require a valid complete-intent digest", async () => {
  const f = await fixture()
  expect(await f.store.create({ ...f.record, intentDigest: undefined }, f.context)).toMatchObject({ status: "failed", reason: "invalid-run-admission" })
  expect(await f.store.create({ ...f.record, intentDigest: "bad" }, f.context)).toMatchObject({ status: "failed", reason: "invalid-run-admission" })
  expect(await f.store.read("run", f.context)).toMatchObject({ status: "denied", reason: "run-access-unavailable" })
})
