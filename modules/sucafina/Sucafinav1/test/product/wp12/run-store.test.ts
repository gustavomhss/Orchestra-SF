import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { createSfRunStore, sfRunSourceFence } from "../../../product/ai/run-store.ts"
import { createSfAnalysisHost } from "../../../product/ai/analysis-host.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import type { SfNativeRunRecord } from "../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { sfRunFixture } from "./run-fixture.ts"
import { digestSfContribution, digestSfValue } from "../../../product/contracts/canonical.ts"

// Real product-state transactions with an injected host; this does not prove a native host or ACL.
async function fixture(options?: { mutateSnapshot?: boolean; concurrentPreflight?: boolean; mutatePreflightRun?: boolean; mutateCommitOutput?: boolean; onReadyPreflight?: () => Promise<void> }) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-run-store-"))
  const persistence = await openLocalStore(directory)
  const request = new Request("https://example.test/")
  const authority = { principalRef: "user", policyVersion: "policy", accessRevision: "access" }
  const context = { kind: "ui", binding: authority } as unknown as TrustedDomainContext
  const state = createSfProductState({ persistence, authorize: async () => authority, resolveTarget: async () => ({ incarnation: "inc" }), createId: () => "store" })
  await state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "initial", commandDigest: "a".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (current) => {
    current.cases.case = { id: "case", incarnation: "inc", version: 1, participants: ["user"] } as unknown as typeof current.cases[string]
    return { commit: true, value: true }
  })
  const fired = { value: false }
  const store = createSfRunStore({ state, requestFor: () => request, revalidate: async () => true, preflight: async (record) => {
    if (options?.mutatePreflightRun) record.objective = "changed-by-verifier"
    if (record.state === "ready") await options?.onReadyPreflight?.()
    if (options?.concurrentPreflight && !fired.value) {
      fired.value = true
      const current = await state.read(request, "contributions", () => null)
      if (current.status !== "ok") throw new Error("contributions unavailable")
      await state.transaction(request, { namespace: "contributions", expectedStorageVersion: current.storageVersion, idempotencyKey: "concurrent", commandDigest: "f".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (stored) => {
        stored.nativeRuns ??= {}
        return { commit: true, value: true }
      })
    }
    const sourceFence = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: sfRunSourceFence(snapshot) }))
    return { status: "ok", value: { sourceFence } }
  }, revalidateForCommit: async (_record, _context, snapshot, output) => {
    if (options?.mutateSnapshot) snapshot.data.injected = true
    if (options?.mutateCommitOutput && output) output.outputDigest = "0".repeat(64)
    return { status: "ok", value: true }
  }, now: () => "2026-11-13T00:00:00Z" })
  const record = { schema: "sf-native-run-v1", runRef: "run", version: 1, intentDigest: "c".repeat(64), requestDigest: "a".repeat(64), skillInputDigest: "b".repeat(64), principalRef: "user", accessRevision: "access", policyVersion: "policy", caseRef: { id: "case", incarnation: "inc", version: 1 }, selection: { profile: { id: "sf_finance", version: "1", outputTypes: [], sourceDigest: "d".repeat(64) }, skills: [{ id: "skill", version: "1", sourceDigest: "e".repeat(64), instructionsDigest: "f".repeat(64) }], operationIds: [], manifestDigest: "c".repeat(64) }, model: { providerID: "openai", id: "model" }, skillId: "skill", objective: "review", contextFingerprint: "context", createdAt: "2026-11-13T00:00:00Z", updatedAt: "2026-11-13T00:00:00Z", state: "preparing" } as unknown as SfNativeRunRecord
  return { persistence, state, store, context, record, [Symbol.asyncDispose]: async () => {
    await persistence.dispose()
    await rm(directory, { recursive: true, force: true })
  } }
}

test("run is durably prepared without a fabricated skill receipt and rejects a stale transition", async () => {
  await using f = await fixture()
  expect(await f.store.create(f.record, f.context)).toMatchObject({ status: "ok", value: { state: "preparing", version: 1 } })
  expect(await f.store.read("run", f.context)).toMatchObject({ status: "ok", value: { state: "preparing" } })
  expect(await f.store.transition("run", 0, "cancelled", "cancelled", f.context)).toMatchObject({ status: "conflict" })
  expect(await f.store.transition("run", 1, "cancelled", "cancelled", f.context)).toMatchObject({ status: "ok", value: { state: "cancelled", version: 2 } })
})

test("an invalid native receipt cannot move a preparing run to queued", async () => {
  await using f = await fixture()
  await f.store.create(f.record, f.context)
  const receipt = { runId: "other", nativeSessionId: "session", skillId: "skill", manifestDigest: "c".repeat(64), profileId: "sf_finance", profileVersion: "1" } as Parameters<typeof f.store.attach>[3]
  expect(await f.store.attach("run", 1, "session", receipt, f.context)).toMatchObject({ status: "conflict", reason: "invalid-native-receipt" })
  expect(await f.store.read("run", f.context)).toMatchObject({ status: "ok", value: { state: "preparing", version: 1 } })
})


test("analysis host binds validation to the actual stored skill receipt", async () => {
  await using f = await fixture()
  await f.store.create(f.record, f.context)
  const receipt = { runId: "run", nativeSessionId: "session", profileId: "sf_finance", profileVersion: "1", profileDigest: "d".repeat(64), skillId: "skill", skillVersion: "1", sourceDigest: "e".repeat(64), instructionsDigest: "f".repeat(64), loadedMessageId: "message", loadedAt: "2026-11-13T00:00:00Z", manifestDigest: "c".repeat(64) } as const
  expect(await f.store.attach("run", 1, "session", receipt, f.context)).toMatchObject({ status: "ok", value: { state: "queued" } })
  const host = createSfAnalysisHost({ store: f.store, verify: async () => ({ status: "ok", value: true }) } as unknown as Parameters<typeof createSfAnalysisHost>[0])
  const request = { runRef: "run", caseRef: f.record.caseRef, contextFingerprint: "context", manifestDigest: receipt.manifestDigest, accessRevision: "access", skillReceipts: [receipt] }
  expect(await host.revalidate(f.context, request)).toEqual({ status: "ok", value: true })
  expect(await host.revalidate(f.context, { ...request, skillReceipts: [{ ...receipt, loadedMessageId: "forged" }] })).toEqual({ status: "denied", reason: "run-binding-mismatch" })
})

test("stale run is preserved when its case advances", async () => {
  await using f = await fixture()
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
  await using f = await fixture({ mutateSnapshot: true })
  expect(await f.store.create(f.record, f.context)).toEqual({ status: "denied", reason: "commit-revalidation-mutated-snapshot" })
  expect(await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.data.injected }))).toBeUndefined()
  expect(await f.state.read(new Request("https://example.test/"), "contributions", (state) => state.nativeRuns?.run)).toMatchObject({ status: "ok", value: undefined })
})

test("new runs require a valid complete-intent digest", async () => {
  await using f = await fixture()
  expect(await f.store.create({ ...f.record, intentDigest: undefined }, f.context)).toMatchObject({ status: "failed", reason: "invalid-run-admission" })
  expect(await f.store.create({ ...f.record, intentDigest: "bad" }, f.context)).toMatchObject({ status: "failed", reason: "invalid-run-admission" })
  expect(await f.store.read("run", f.context)).toMatchObject({ status: "denied", reason: "run-access-unavailable" })
})

test("run admission rejects a contribution version changed during preflight", async () => {
  await using f = await fixture({ concurrentPreflight: true })
  expect(await f.store.create(f.record, f.context)).toMatchObject({ status: "conflict" })
  expect(await f.store.read("run", f.context)).toMatchObject({ status: "denied", reason: "run-access-unavailable" })
})

test("stale output is preserved with its original provenance and cannot be published as current", async () => {
  await using f = await fixture()
  const original = sfRunFixture()
  const { native: _native, outputRef: _outputRef, ...base } = original.run
  const prepared = { ...base, principalRef: "user", state: "preparing" as const, version: 1 }
  expect((await f.store.create(prepared, f.context)).status).toBe("ok")
  expect(await f.store.attach("run", 1, "session", { ...original.receipt, loadedAt: "invalid" }, f.context)).toEqual({ status: "conflict", reason: "invalid-native-receipt" })
  expect((await f.store.attach("run", 1, "session", original.receipt, f.context)).status).toBe("ok")
  expect((await f.store.transition("run", 2, "running", undefined, f.context)).status).toBe("ok")
  const version = await f.state.read(new Request("https://example.test/"), "cases", () => null)
  if (version.status !== "ok") throw new Error("case state unavailable")
  expect((await f.state.transaction(new Request("https://example.test/"), { namespace: "cases", expectedStorageVersion: version.storageVersion, idempotencyKey: "advance-for-output", commandDigest: "9".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (state) => {
    state.cases.case!.version = 2
    return { commit: true, value: true }
  })).status).toBe("ok")
  const originalDigest = digestSfValue(original.output)
  const forged = { ...original.output, runProvenance: { ...original.output.runProvenance, actualModel: "other/model" } }
  forged.outputDigest = digestSfContribution(forged)
  expect(await f.store.preserveStale("run", "case-changed", forged, f.context)).toEqual({ status: "conflict", reason: "invalid-stale-run-output" })
  expect(await f.store.preserveStale("run", "case-changed", original.output, f.context)).toMatchObject({ status: "ok", value: { state: "stale", version: 4, outputRef: "output", caseRef: { version: 1 } } })
  const stored = await f.state.read(new Request("https://example.test/"), "contributions", (state) => state.contributions.output)
  expect(stored.status === "ok" && digestSfValue(stored.value)).toBe(originalDigest)
  expect(await f.store.publish("run", 4, original.output, f.context)).toEqual({ status: "conflict", reason: "invalid-run-output" })
})

test("read-only preflight cannot rewrite the admitted run", async () => {
  const options = { mutatePreflightRun: false }
  await using f = await fixture(options)
  expect((await f.store.create(f.record, f.context)).status).toBe("ok")
  options.mutatePreflightRun = true
  expect(await f.store.read("run", f.context)).toEqual({ status: "denied", reason: "run-input-changed-during-preflight" })
  const stored = await f.state.read(new Request("https://example.test/"), "contributions", (state) => state.nativeRuns?.run)
  expect(stored).toMatchObject({ status: "ok", value: { objective: "review", version: 1 } })
  const unpersisted = { ...f.record, runRef: "unpersisted" }
  expect(await f.store.create(unpersisted, f.context)).toEqual({ status: "denied", reason: "run-input-changed-during-preflight" })
  expect(await f.state.read(new Request("https://example.test/"), "contributions", (state) => state.nativeRuns?.unpersisted)).toMatchObject({ status: "ok", value: undefined })
})

test("a commit verifier cannot replace an already validated contribution", async () => {
  await using f = await fixture({ mutateCommitOutput: true })
  const original = sfRunFixture()
  const { native: _native, outputRef: _outputRef, ...base } = original.run
  expect((await f.store.create({ ...base, principalRef: "user", state: "preparing", version: 1 }, f.context)).status).toBe("ok")
  expect((await f.store.attach("run", 1, "session", original.receipt, f.context)).status).toBe("ok")
  expect((await f.store.transition("run", 2, "running", undefined, f.context)).status).toBe("ok")
  expect(await f.store.publish("run", 3, original.output, f.context)).toEqual({ status: "denied", reason: "commit-revalidation-mutated-input" })
  const stored = await f.state.read(new Request("https://example.test/"), "contributions", (state) => ({ run: state.nativeRuns?.run, output: state.contributions.output }))
  expect(stored).toMatchObject({ status: "ok", value: { run: { state: "running", version: 3 }, output: undefined } })
})

test("durable cancellation wins a publication that is still validating its source", async () => {
  const entered = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  await using f = await fixture({ onReadyPreflight: async () => { entered.resolve(); await resume.promise } })
  const original = sfRunFixture()
  const { native: _native, outputRef: _outputRef, ...base } = original.run
  expect((await f.store.create({ ...base, principalRef: "user", state: "preparing", version: 1 }, f.context)).status).toBe("ok")
  expect((await f.store.attach("run", 1, "session", original.receipt, f.context)).status).toBe("ok")
  expect((await f.store.transition("run", 2, "running", undefined, f.context)).status).toBe("ok")
  const publication = f.store.publish("run", 3, original.output, f.context)
  await Promise.race([entered.promise, publication.then(() => { throw new Error("publication did not reach the source preflight") })])
  try {
    expect(await f.store.transition("run", 3, "cancelled", "human-cancelled", f.context)).toMatchObject({ status: "ok", value: { state: "cancelled", version: 4 } })
  } finally {
    resume.resolve()
  }
  expect(await publication).toEqual({ status: "conflict", reason: "product-state-changed" })
  const stored = await f.state.read(new Request("https://example.test/"), "contributions", (state) => ({ run: state.nativeRuns?.run, output: state.contributions.output }))
  expect(stored).toMatchObject({ status: "ok", value: { run: { state: "cancelled", version: 4, reason: "human-cancelled" }, output: undefined } })
  expect(await f.store.publish("run", 4, original.output, f.context)).toEqual({ status: "conflict", reason: "invalid-run-output" })
})
