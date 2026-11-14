import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { createSfRunStore, sfRunSourceFence } from "../../../product/ai/run-store.ts"
import { createSfAnalysisHost } from "../../../product/ai/analysis-host.ts"
import { cancelSfAnalysis, readSfAnalysisRun } from "../../../product/ai/analysis-port.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import type { SfNativeRunRecord } from "../../../product/contracts/state.ts"
import type { ContributionEnvelope } from "../../../product/contracts/resident-ai.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { sfCaseFixture, sfRunFixture } from "./run-fixture.ts"
import { digestSfContribution, digestSfValue } from "../../../product/contracts/canonical.ts"

// Real product-state transactions with an injected host; this does not prove a native host or ACL.
async function fixture(options?: { mutateSnapshot?: boolean; concurrentPreflight?: boolean; mutatePreflightRun?: boolean; mutateCommitOutput?: boolean; unavailablePreflight?: boolean; deniedCommit?: boolean; revoked?: boolean; onReadyPreflight?: () => Promise<void>; onAuthority?: () => Promise<void>; onStateWrite?: () => Promise<void>; onPreflight?: (record: SfNativeRunRecord) => void }) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-run-store-"))
  const persistence = await openLocalStore(directory)
  const request = new Request("https://example.test/")
  const authority = { principalRef: "user", policyVersion: "policy", accessRevision: "access" }
  const context = { kind: "ui", binding: authority } as unknown as TrustedDomainContext
  const state = createSfProductState({ persistence, authorize: async (_request, _snapshot, namespace, mode) => {
    if (namespace === "contributions" && mode === "write") await options?.onStateWrite?.()
    return authority
  }, resolveTarget: async () => ({ incarnation: "inc" }), createId: () => "store" })
  await state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "initial", commandDigest: "a".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (current) => {
    current.cases.case = sfCaseFixture({ id: "case", incarnation: "inc", version: 1 }, ["user"])
    return { commit: true, value: true }
  })
  const fired = { value: false }
  const source = { stale: false }
  const observed = { preflights: 0, commits: 0 }
  const store = createSfRunStore({ state, requestFor: () => request, revalidate: async () => { await options?.onAuthority?.(); return !options?.revoked }, preflight: async (record) => {
    observed.preflights++
    if (options?.unavailablePreflight) return { status: "unavailable", reason: "source-unavailable" }
    if (source.stale) return { status: "stale", reason: "source-changed" }
    options?.onPreflight?.(record)
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
    observed.commits++
    if (options?.deniedCommit) return { status: "denied", reason: "host-commit-refused" }
    if (options?.mutateSnapshot) snapshot.data.injected = true
    if (options?.mutateCommitOutput && output) output.outputDigest = "0".repeat(64)
    return { status: "ok", value: true }
  }, now: () => "2026-11-13T00:00:00Z" })
  const record = { schema: "sf-native-run-v1", runRef: "run", version: 1, intentDigest: "c".repeat(64), requestDigest: "a".repeat(64), skillInputDigest: "b".repeat(64), principalRef: "user", accessRevision: "access", policyVersion: "policy", caseRef: { id: "case", incarnation: "inc", version: 1 }, selection: { profile: { id: "sf_finance", version: "1", outputTypes: [], sourceDigest: "d".repeat(64) }, skills: [{ id: "skill", version: "1", sourceDigest: "e".repeat(64), instructionsDigest: "f".repeat(64) }], operationIds: [], manifestDigest: "c".repeat(64) }, model: { providerID: "openai", id: "model" }, skillId: "skill", objective: "review", contextFingerprint: "context", createdAt: "2026-11-13T00:00:00Z", updatedAt: "2026-11-13T00:00:00Z", state: "preparing" } as unknown as SfNativeRunRecord
  return { persistence, state, store, context, record, source, request, observed, [Symbol.asyncDispose]: async () => {
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

test("real C08 host cancels an independent review using its durable target even when its source becomes stale", async () => {
  for (const stale of [false, true]) {
    await using f = await fixture()
    const original = sfRunFixture()
    const { native: _native, outputRef: _outputRef, ...base } = original.run
    const skill = { ...original.skill, id: "sf-contestar-decisao", allowedProfiles: ["sf_reviewer" as const], outputSchemaRefs: ["CritiqueReport"] }
    const profile = { ...original.profile, id: "sf_reviewer" as const, allowedSkills: [skill.id], outputTypes: ["CritiqueReport" as const] }
    const receipt = { ...original.receipt, profileId: profile.id, skillId: skill.id }
    const reviewTarget = { targetRunId: "author", targetSessionId: "author-session", targetOutputDigest: "9".repeat(64), caseRef: original.caseRef }
    const record = { ...base, principalRef: "user", state: "preparing" as const, version: 1, reviewTarget, skillId: skill.id,
      selection: { ...base.selection, profile, skills: [skill] } }
    expect((await f.store.create(record, f.context)).status).toBe("ok")
    expect((await f.store.attach("run", 1, "session", receipt, f.context)).status).toBe("ok")
    expect((await f.store.transition("run", 2, "running", undefined, f.context)).status).toBe("ok")
    f.source.stale = stale
    let observedTarget: unknown
    let interrupted = false
    const host = createSfAnalysisHost({ store: f.store,
      withRunContext: async (_runRef, action) => action(f.context),
      verify: async (_context, _record, request) => { observedTarget = request.reviewTarget; return { status: "ok", value: true } },
      analysis: { create: async () => ({ status: "unavailable", reason: "not-used" }), read: async () => ({ status: "unavailable", reason: "not-used" }), cancel: async (runRef, context) => {
        const run = await f.store.readLifecycle(runRef, context)
        if (run.status !== "ok") return run
        const saved = await f.store.transition(runRef, run.value.version, "cancelled", "human-cancelled", context)
        return saved.status === "ok" ? { status: "ok", value: { cancelled: true } } : saved
      } },
      execution: {
        admit: async () => ({ status: "unavailable", reason: "native-runtime-not-attached" }),
        execute: async () => ({ status: "unavailable", reason: "native-runtime-not-attached" }),
        collect: async () => ({ status: "unavailable", reason: "native-runtime-not-attached" }),
        interrupt: async () => {
        expect(await f.store.readLifecycle("run", f.context)).toMatchObject({ status: "ok", value: { state: "cancelled", version: 4, reviewTarget } })
        interrupted = true
        return { status: "ok", value: true }
      } },
      routines: {} as Parameters<typeof createSfAnalysisHost>[0]["routines"],
    })
    expect(await cancelSfAnalysis({ host, runRef: "run", sessionID: "session", executionTicket: {} as Parameters<typeof cancelSfAnalysis>[0]["executionTicket"],
      skillReceipt: receipt, caseRef: original.caseRef, contextFingerprint: "context" })).toEqual({ status: "ok", value: { cancelled: true } })
    expect(interrupted).toBe(true)
    if (!stale) expect(observedTarget).toEqual(reviewTarget)
    const version = await f.state.read(new Request("https://example.test/"), "cases", () => null)
    if (version.status !== "ok") throw new Error("case state unavailable")
    expect((await f.state.transaction(new Request("https://example.test/"), { namespace: "cases", expectedStorageVersion: version.storageVersion, idempotencyKey: "revoke-member", commandDigest: "8".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (state) => {
      state.cases.case!.participants = []
      return { commit: true, value: true }
    })).status).toBe("ok")
    expect(await f.store.readLifecycle("run", f.context)).toEqual({ status: "denied", reason: "run-case-access-unavailable" })
  }
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

test("C08 keeps its admitted record when the caller changes an alias during final write authorization", async () => {
  const entered = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  let calls = 0
  await using f = await fixture({ onStateWrite: async () => {
    if (++calls === 2) { entered.resolve(); await resume.promise }
  } })
  const admitted = structuredClone(f.record)
  const pending = f.store.create(f.record, f.context)
  await Promise.race([entered.promise, pending.then(() => { throw new Error("admission missed final C08 write authorization") })])
  try { f.record.objective = "changed-after-staging" } finally { resume.resolve() }
  expect((await pending).status).not.toBe("ok")
  expect(calls).toBe(2)
  const stored = await f.state.read(new Request("https://example.test/"), "contributions", (state) => ({
    run: state.nativeRuns?.run,
    receipt: Object.entries(state.transactions).find(([key]) => JSON.parse(key)[3] === "run:run:1")?.[1].value,
  }))
  expect(stored.status).toBe("ok")
  if (stored.status !== "ok") throw new Error("durable run unavailable")
  expect(digestSfValue(stored.value.run)).toBe(digestSfValue(admitted))
  expect(stored.value.receipt).toEqual({ status: "ok", value: admitted })
})

test("C08 keeps validated contribution bytes when the caller changes an alias during final write authorization", async () => {
  const entered = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  let armed = false
  let calls = 0
  await using f = await fixture({ onStateWrite: async () => {
    if (armed && ++calls === 2) { entered.resolve(); await resume.promise }
  } })
  const original = sfRunFixture()
  const { native: _native, outputRef: _outputRef, ...base } = original.run
  expect((await f.store.create({ ...base, principalRef: "user", state: "preparing", version: 1 }, f.context)).status).toBe("ok")
  expect((await f.store.attach("run", 1, "session", original.receipt, f.context)).status).toBe("ok")
  expect((await f.store.transition("run", 2, "running", undefined, f.context)).status).toBe("ok")
  const admitted = structuredClone(original.output)
  armed = true
  const pending = f.store.publish("run", 3, original.output, f.context)
  await Promise.race([entered.promise, pending.then(() => { throw new Error("publication missed final C08 write authorization") })])
  try {
    original.output.runProvenance.actualModel = "changed-after-staging/model"
    original.output.outputDigest = digestSfContribution(original.output)
  } finally { resume.resolve() }
  expect((await pending).status).not.toBe("ok")
  expect(calls).toBe(2)
  const stored = await f.state.read(new Request("https://example.test/"), "contributions", (state) => ({ run: state.nativeRuns?.run, output: state.contributions.output }))
  expect(stored).toMatchObject({ status: "ok", value: { run: { state: "ready", version: 4, outputRef: "output" } } })
  if (stored.status !== "ok") throw new Error("durable contribution unavailable")
  expect(digestSfValue(stored.value.output)).toBe(digestSfValue(admitted))
  expect(stored.value.output?.outputDigest).toBe(admitted.outputDigest)
})

test("publication pins its validated output before awaiting mutation authority", async () => {
  const entered = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  let pending = false
  let authorityCalls = 0
  await using f = await fixture({ onAuthority: async () => {
    // publish reads and revalidates the stored run before checking output provenance.
    // Its third authority check is mutate's first await, after matchesSfRunOutput.
    if (pending && ++authorityCalls === 3) { entered.resolve(); await resume.promise }
  } })
  const original = sfRunFixture()
  const { native: _native, outputRef: _outputRef, ...base } = original.run
  expect((await f.store.create({ ...base, principalRef: "user", state: "preparing", version: 1 }, f.context)).status).toBe("ok")
  expect((await f.store.attach("run", 1, "session", original.receipt, f.context)).status).toBe("ok")
  expect((await f.store.transition("run", 2, "running", undefined, f.context)).status).toBe("ok")
  pending = true
  const publication = f.store.publish("run", 3, original.output, f.context)
  await Promise.race([entered.promise, publication.then(() => { throw new Error("publication did not reach mutation authorization") })])
  try {
    original.output.runProvenance.actualModel = "caller-replaced/model"
    original.output.outputDigest = digestSfContribution(original.output)
  } finally {
    resume.resolve()
  }
  expect(await publication).toEqual({ status: "denied", reason: "run-input-changed-during-authorization" })
  expect(await f.state.read(new Request("https://example.test/"), "contributions", (state) => ({ run: state.nativeRuns?.run, output: state.contributions.output }))).toMatchObject({ status: "ok", value: { run: { state: "running", version: 3 }, output: undefined } })
})

test("read rejects a retained preflight reference changed during final authorization", async () => {
  const entered = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  let pending = false
  const captured: { record?: SfNativeRunRecord } = {}
  await using f = await fixture({
    onPreflight: (record) => { if (pending) captured.record = record },
    onAuthority: async () => { if (pending && captured.record) { entered.resolve(); await resume.promise } },
  })
  expect((await f.store.create(f.record, f.context)).status).toBe("ok")
  pending = true
  const read = f.store.read("run", f.context)
  await Promise.race([entered.promise, read.then(() => { throw new Error("read did not reach final authorization") })])
  try {
    const retained = captured.record
    if (!retained) throw new Error("preflight did not retain the record")
    retained.objective = "changed-after-preflight"
  } finally {
    resume.resolve()
  }
  expect(await read).toEqual({ status: "denied", reason: "run-input-changed-during-authorization" })
  expect(await f.state.read(new Request("https://example.test/"), "contributions", (state) => state.nativeRuns?.run)).toMatchObject({ status: "ok", value: { objective: "review", version: 1 } })
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
  // Both commands target run:run:4; C08 checks the committed command identity before its storage version.
  expect(await publication).toEqual({ status: "conflict", reason: "idempotency-content-changed" })
  const stored = await f.state.read(new Request("https://example.test/"), "contributions", (state) => ({ run: state.nativeRuns?.run, output: state.contributions.output }))
  expect(stored).toMatchObject({ status: "ok", value: { run: { state: "cancelled", version: 4, reason: "human-cancelled" }, output: undefined } })
  expect(await f.store.publish("run", 4, original.output, f.context)).toEqual({ status: "conflict", reason: "invalid-run-output" })
  const host = createSfAnalysisHost({ store: f.store } as Parameters<typeof createSfAnalysisHost>[0])
  expect(await host.fail("run", "late-publication-failure", f.context)).toEqual({ status: "conflict", reason: "invalid-run-transition" })
  expect(await f.store.read("run", f.context)).toMatchObject({ status: "ok", value: { state: "cancelled", version: 4 } })
})

test("review cancellation validates its durable target before committing even without an attached native runtime", async () => {
  await using f = await fixture()
  const reviewTarget = { targetRunId: "author", targetSessionId: "author-session", targetOutputDigest: "a".repeat(64), caseRef: f.record.caseRef }
  const record = { ...f.record, reviewTarget, selection: { ...f.record.selection, profile: { ...f.record.selection.profile, id: "sf_reviewer" as const } } }
  const receipt = { runId: "run", nativeSessionId: "review-session", profileId: "sf_reviewer", profileVersion: "1", profileDigest: "d".repeat(64), skillId: "skill", skillVersion: "1", sourceDigest: "e".repeat(64), instructionsDigest: "f".repeat(64), loadedMessageId: "review-message", loadedAt: "2026-11-13T00:00:00Z", manifestDigest: "c".repeat(64) } as const
  expect((await f.store.create(record, f.context)).status).toBe("ok")
  expect((await f.store.attach("run", 1, receipt.nativeSessionId, receipt, f.context)).status).toBe("ok")
  expect((await f.store.transition("run", 2, "running", undefined, f.context)).status).toBe("ok")
  // No provider or native interrupt is simulated. This probe proves the durable cancellation boundary only.
  const unavailable = async () => ({ status: "unavailable", reason: "native-runtime-not-attached" } as const)
  const host = createSfAnalysisHost({ store: f.store, verify: async () => ({ status: "ok", value: true }),
    withRunContext: async (_runRef, action) => action(f.context),
    execution: { admit: unavailable, execute: unavailable, collect: unavailable, interrupt: unavailable },
    routines: { catalog: unavailable, prepareAdmission: unavailable, readAdmission: unavailable, readRun: unavailable, run: unavailable },
    analysis: { create: unavailable, read: unavailable, cancel: async (runRef, context) => {
      const prior = await f.store.read(runRef, context)
      if (prior.status !== "ok") return prior
      const cancelled = await f.store.transition(runRef, prior.value.version, "cancelled", "human-cancelled", context)
      return cancelled.status === "ok" ? { status: "ok", value: { cancelled: true } } : cancelled
    } },
  })
  const request = { host, runRef: "run", sessionID: receipt.nativeSessionId, executionTicket: {}, skillReceipt: receipt, caseRef: record.caseRef, contextFingerprint: record.contextFingerprint, reviewTarget } as Parameters<typeof cancelSfAnalysis>[0]
  expect(await cancelSfAnalysis({ ...request, reviewTarget: { ...reviewTarget, targetRunId: "another-author" } })).toEqual({ status: "denied", reason: "run-binding-mismatch" })
  expect(await f.store.read("run", f.context)).toMatchObject({ status: "ok", value: { state: "running", version: 3 } })
  expect(await cancelSfAnalysis(request)).toEqual({ status: "unavailable", reason: "native-runtime-not-attached" })
  expect(await f.store.read("run", f.context)).toMatchObject({ status: "ok", value: { state: "cancelled", version: 4, reviewTarget } })
})

test("late publication failure cannot overwrite a ready result", async () => {
  await using f = await fixture()
  const original = sfRunFixture()
  const { native: _native, outputRef: _outputRef, ...base } = original.run
  expect((await f.store.create({ ...base, principalRef: "user", state: "preparing", version: 1 }, f.context)).status).toBe("ok")
  expect((await f.store.attach("run", 1, "session", original.receipt, f.context)).status).toBe("ok")
  expect((await f.store.transition("run", 2, "running", undefined, f.context)).status).toBe("ok")
  expect((await f.store.publish("run", 3, original.output, f.context)).status).toBe("ok")
  const host = createSfAnalysisHost({ store: f.store } as Parameters<typeof createSfAnalysisHost>[0])
  expect(await host.fail("run", "late-publication-failure", f.context)).toEqual({ status: "conflict", reason: "invalid-run-transition" })
  expect(await host.settle("run", "unavailable", "late-publication-unavailable", f.context)).toEqual({ status: "conflict", reason: "invalid-run-transition" })
  expect(await f.state.read(new Request("https://example.test/"), "contributions", (state) => ({ run: state.nativeRuns?.run, output: state.contributions.output }))).toMatchObject({ status: "ok", value: { run: { state: "ready", version: 4, outputRef: "output" }, output: original.output } })
})

test("lifecycle access survives source unavailability while current case membership and principal remain mandatory", async () => {
  const options = { unavailablePreflight: false, revoked: false }
  await using f = await fixture(options)
  expect((await f.store.create(f.record, f.context)).status).toBe("ok")
  const cases = await f.state.read(f.request, "cases", () => null)
  if (cases.status !== "ok") throw new Error("case state unavailable")
  expect((await f.state.transaction(f.request, { namespace: "cases", expectedStorageVersion: cases.storageVersion, idempotencyKey: "advance-lifecycle", commandDigest: "a".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (state) => {
    state.cases.case!.version = 2
    return { commit: true, value: true }
  })).status).toBe("ok")
  options.unavailablePreflight = true
  expect(await f.store.read("run", f.context)).toEqual({ status: "unavailable", reason: "source-unavailable" })
  const preflights = f.observed.preflights
  const lifecycle = await f.store.readLifecycle("run", f.context)
  expect(lifecycle).toMatchObject({ status: "ok", value: { state: "preparing", caseRef: { version: 1 } } })
  expect(lifecycle.status === "ok" && Object.hasOwn(lifecycle.value, "payload")).toBe(false)
  expect(f.observed.preflights).toBe(preflights)
  for (const changed of [{ principalRef: "outsider" }, { policyVersion: "other-policy" }, { accessRevision: "other-access" }]) {
    expect(await f.store.readLifecycle("run", { ...f.context, binding: { ...f.context.binding, ...changed } } as TrustedDomainContext)).toEqual({ status: "denied", reason: "run-access-unavailable" })
  }
  options.revoked = true
  expect(await f.store.readLifecycle("run", f.context)).toEqual({ status: "denied", reason: "invalid-authority" })
  options.revoked = false
  const current = await f.state.read(f.request, "cases", () => null)
  if (current.status !== "ok") throw new Error("case state unavailable")
  expect((await f.state.transaction(f.request, { namespace: "cases", expectedStorageVersion: current.storageVersion, idempotencyKey: "remove-participant", commandDigest: "b".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (state) => {
    state.cases.case!.participants = []
    return { commit: true, value: true }
  })).status).toBe("ok")
  expect(await f.store.readLifecycle("run", f.context)).toEqual({ status: "denied", reason: "run-case-access-unavailable" })
})

test("terminal settlement persists without source preflight and still requires the host commit authority", async () => {
  for (const state of ["unavailable", "needs-input", "failed"] as const) {
    const options = { unavailablePreflight: false, deniedCommit: false }
    await using f = await fixture(options)
    expect((await f.store.create(f.record, f.context)).status).toBe("ok")
    const host = createSfAnalysisHost({ store: f.store } as unknown as Parameters<typeof createSfAnalysisHost>[0])
    const cases = await f.state.read(f.request, "cases", () => null)
    if (cases.status !== "ok") throw new Error("case state unavailable")
    expect((await f.state.transaction(f.request, { namespace: "cases", expectedStorageVersion: cases.storageVersion, idempotencyKey: "advance-terminal", commandDigest: "b".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (current) => {
      current.cases.case!.version = 2
      return { commit: true, value: true }
    })).status).toBe("ok")
    options.unavailablePreflight = true
    options.deniedCommit = true
    const settle = () => state === "failed" ? host.fail("run", "source-unavailable", f.context) : host.settle("run", state, "source-unavailable", f.context)
    const preflights = f.observed.preflights
    expect(await settle()).toEqual({ status: "denied", reason: "host-commit-refused" })
    expect(await f.store.readLifecycle("run", f.context)).toMatchObject({ status: "ok", value: { state: "preparing", version: 1 } })
    options.deniedCommit = false
    expect(await settle()).toEqual({ status: "ok", value: true })
    expect(await f.store.readLifecycle("run", f.context)).toMatchObject({ status: "ok", value: { state, version: 2, reason: "source-unavailable" } })
    expect(f.observed.preflights).toBe(preflights)
    expect(await settle()).toEqual({ status: "conflict", reason: "invalid-run-transition" })
    expect(f.observed.commits).toBe(3)
    expect(await f.state.read(f.request, "contributions", (stored) => Object.keys(stored.contributions))).toMatchObject({ status: "ok", value: [] })
  }
})

test("a committed ready output can become stale only with its exact stored bytes", async () => {
  await using f = await fixture()
  const original = sfRunFixture()
  const { native: _native, outputRef: _outputRef, ...base } = original.run
  expect((await f.store.create({ ...base, principalRef: "user", state: "preparing", version: 1 }, f.context)).status).toBe("ok")
  expect((await f.store.attach("run", 1, "session", original.receipt, f.context)).status).toBe("ok")
  expect((await f.store.transition("run", 2, "running", undefined, f.context)).status).toBe("ok")
  expect((await f.store.publish("run", 3, original.output, f.context)).status).toBe("ok")
  const changed = structuredClone(original.output)
  if (changed.kind !== "MatchExplanation" || changed.state !== "ready") throw new Error("unexpected contribution fixture")
  changed.payload.limitations = ["caller replaced content"]
  changed.outputDigest = digestSfContribution(changed)
  expect(await f.store.preserveStale("run", "source-changed", changed, f.context)).toEqual({ status: "stale", reason: "run-case-or-source-changed" })
  expect(await f.store.readLifecycle("run", f.context)).toMatchObject({ status: "ok", value: { state: "ready", version: 4 } })
  expect(await f.store.preserveStale("run", "source-changed", original.output, f.context)).toMatchObject({ status: "ok", value: { state: "stale", version: 5, outputRef: original.output.id } })
  expect(await f.state.read(f.request, "contributions", (stored) => digestSfValue(stored.contributions[original.output.id]))).toMatchObject({ status: "ok", value: digestSfValue(original.output) })
  expect(await f.store.preserveStale("run", "again", original.output, f.context)).toEqual({ status: "conflict", reason: "invalid-stale-run-output" })
})

test("real C08 cancellation pins its command and observed run across authorization and interruption scopes", async () => {
  for (const phase of ["read-return", "verify-return", "authorization-return", "cancel-entry", "cancel-return", "interrupt-entry", "interrupt-return", "unchanged"] as const) {
    await using f = await fixture()
    const original = sfRunFixture()
    const { native: _native, outputRef: _outputRef, ...base } = original.run
    expect((await f.store.create({ ...base, principalRef: "user", state: "preparing", version: 1 }, f.context)).status).toBe("ok")
    expect((await f.store.attach("run", 1, "session", original.receipt, f.context)).status).toBe("ok")
    expect((await f.store.transition("run", 2, "running", undefined, f.context)).status).toBe("ok")
    const stored = () => f.state.read(f.request, "contributions", (state) => ({ run: state.nativeRuns?.run, output: state.contributions.output }))
    const before = await stored()
    if (before.status !== "ok" || !before.value.run) throw new Error("Running record unavailable")
    const observed: { scopes: number; cancelCalls: number; interrupts: number; run?: SfNativeRunRecord } = { scopes: 0, cancelCalls: 0, interrupts: 0 }
    const unavailable = async () => ({ status: "unavailable", reason: "native-runtime-not-attached" } as const)
    const host = createSfAnalysisHost({ store: f.store,
      withRunContext: async (_runRef, action) => {
        const scope = ++observed.scopes
        if (scope === 2 && phase === "cancel-entry") input.host = { ...host }
        if (scope === 3 && phase === "interrupt-entry") input.caseRef = { ...input.caseRef, version: 2 }
        const result = await action(f.context)
        if (scope === 1 && phase === "authorization-return") {
          if (!observed.run) throw new Error("Authorization did not observe its durable run")
          observed.run.objective = "changed-after-authorization-scope"
        }
        if (scope === 2 && phase === "cancel-return") input.executionTicket = {} as typeof input.executionTicket
        if (scope === 3 && phase === "interrupt-return") input.contextFingerprint = "changed-after-interrupt-scope"
        return result
      },
      verify: async () => {
        if (phase === "verify-return") input.skillReceipt.loadedMessageId = "unobserved-message"
        return { status: "ok", value: true }
      },
      analysis: { create: unavailable, read: unavailable, cancel: async (runRef, context) => {
        observed.cancelCalls++
        const current = await f.store.readLifecycle(runRef, context)
        if (current.status !== "ok") return current
        const saved = await f.store.transition(runRef, current.value.version, "cancelled", "human-cancelled", context)
        return saved.status === "ok" ? { status: "ok", value: { cancelled: true } } : saved
      } },
      routines: { catalog: unavailable, prepareAdmission: unavailable, readAdmission: unavailable, readRun: unavailable, run: unavailable },
      execution: { admit: unavailable, execute: unavailable, collect: unavailable, interrupt: async (ticket) => {
        // Observe the interruption boundary only; there is no native provider in this fixture.
        observed.interrupts++
        expect(ticket).toBe(originalTicket)
        expect(await stored()).toMatchObject({ status: "ok", value: { run: { state: "cancelled", version: 4 } } })
        return unavailable()
      } },
    })
    const readRun = host.readRun
    host.readRun = async (runRef, context) => {
      const result = await readRun(runRef, context)
      if (result.status === "ok") observed.run = result.value
      if (phase === "read-return") input.runRef = "another-run"
      return result
    }
    const originalTicket = {} as Parameters<typeof cancelSfAnalysis>[0]["executionTicket"]
    const input: Parameters<typeof cancelSfAnalysis>[0] = { host, runRef: "run", sessionID: "session", executionTicket: originalTicket,
      skillReceipt: structuredClone(original.receipt), caseRef: structuredClone(original.caseRef), contextFingerprint: "context" }
    const result = await cancelSfAnalysis(input)
    expect({ phase, result }).toEqual({ phase, result: phase === "unchanged"
      ? { status: "unavailable", reason: "native-runtime-not-attached" }
      : { status: "denied", reason: "cancellation-input-changed-during-authorization" } })
    const committed = ["cancel-return", "interrupt-entry", "interrupt-return", "unchanged"].includes(phase)
    expect(observed.cancelCalls).toBe(committed ? 1 : 0)
    expect(observed.interrupts).toBe(phase === "interrupt-return" || phase === "unchanged" ? 1 : 0)
    const after = await stored()
    if (after.status !== "ok") throw new Error("Cancellation record became unavailable")
    expect(after.value.run).toMatchObject({ runRef: "run", state: committed ? "cancelled" : "running", version: committed ? 4 : 3,
      objective: original.run.objective, caseRef: original.caseRef, native: { sessionID: "session", skillReceipt: original.receipt } })
    expect(after.value.output).toBeUndefined()
    expect(after.storageVersion).toBe(before.storageVersion + (committed ? 1 : 0))
    if (!committed) expect(digestSfValue(after.value)).toBe(digestSfValue(before.value))
  }
})

test("real C08 progress refuses retained run and output aliases changed after a scope returns", async () => {
  for (const phase of ["lifecycle-run", "content-output", "content-current-run", "discarded-scope-result", "unchanged"] as const) {
    await using f = await fixture()
    const original = sfRunFixture()
    const { native: _native, outputRef: _outputRef, ...base } = original.run
    expect((await f.store.create({ ...base, principalRef: "user", state: "preparing", version: 1 }, f.context)).status).toBe("ok")
    expect((await f.store.attach("run", 1, "session", original.receipt, f.context)).status).toBe("ok")
    expect((await f.store.transition("run", 2, "running", undefined, f.context)).status).toBe("ok")
    expect((await f.store.publish("run", 3, original.output, f.context)).status).toBe("ok")
    const stored = () => f.state.read(f.request, "contributions", (state) => ({ run: state.nativeRuns?.run, output: state.contributions.output }))
    const before = await stored()
    if (before.status !== "ok") throw new Error("Ready record unavailable")
    const observed: { scopes: number; runs: SfNativeRunRecord[]; output?: ContributionEnvelope } = { scopes: 0, runs: [] }
    const unavailable = async () => ({ status: "unavailable", reason: "native-runtime-not-attached" } as const)
    const host = createSfAnalysisHost({ store: f.store, verify: async () => ({ status: "ok", value: true }),
      withRunContext: async (_runRef, action) => {
        const scope = ++observed.scopes
        const result = await action(f.context)
        if (scope === 1 && phase === "lifecycle-run") observed.runs[0]!.objective = "changed-after-lifecycle-return"
        if (scope === 2 && phase === "content-output") {
          if (!observed.output) throw new Error("Ready output was not observed")
          observed.output.createdAt = "2026-11-14T00:00:00Z"
          observed.output.outputDigest = digestSfContribution(observed.output)
        }
        if (scope === 2 && phase === "content-current-run") observed.runs[1]!.objective = "changed-after-content-return"
        if (scope === 2 && phase === "discarded-scope-result") {
          const detached = structuredClone(result)
          const ready = result as Awaited<ReturnType<typeof readSfAnalysisRun>>
          if (ready.status !== "ok" || !ready.value.output) throw new Error("Ready scope result was not observed")
          ready.value.output.createdAt = "2026-11-14T00:00:00Z"
          ready.value.output.outputDigest = digestSfContribution(ready.value.output)
          return detached
        }
        return result
      },
      analysis: { create: unavailable, cancel: unavailable, read: async () => {
        const found = await stored()
        if (found.status !== "ok" || !found.value.output) return { status: "unavailable", reason: "stored-output-unavailable" }
        observed.output = found.value.output
        return { status: "ok", value: found.value.output }
      } },
      routines: { catalog: unavailable, prepareAdmission: unavailable, readAdmission: unavailable, readRun: unavailable, run: unavailable },
      execution: { admit: unavailable, execute: unavailable, collect: unavailable, interrupt: unavailable },
    })
    const readRun = host.readRun
    host.readRun = async (runRef, context) => {
      const result = await readRun(runRef, context)
      if (result.status === "ok") observed.runs.push(result.value)
      return result
    }
    const result = await readSfAnalysisRun({ host, runRef: "run" })
    if (phase === "unchanged") {
      expect(result.status).toBe("ok")
      if (result.status !== "ok" || !result.value.output || !observed.output) throw new Error("Verified ready output unavailable")
      const digest = digestSfValue(result.value)
      observed.output.createdAt = "2026-11-14T00:00:00Z"
      observed.runs[0]!.caseRef.version++
      expect(digestSfValue(result.value)).toBe(digest)
    } else expect({ phase, result }).toEqual({ phase, result: { status: "denied", reason: "run-input-changed-during-read" } })
    expect(observed.scopes).toBe(phase === "lifecycle-run" ? 1 : 2)
    const after = await stored()
    if (after.status !== "ok") throw new Error("Durable output was lost")
    expect(after.storageVersion).toBe(before.storageVersion)
    expect(digestSfValue(after.value)).toBe(digestSfValue(before.value))
  }
})

test("real C08 analysis progress fences host verification aliases and returns private ready content", async () => {
  await using f = await fixture()
  const original = sfRunFixture()
  const { native: _native, outputRef: _outputRef, ...base } = original.run
  expect((await f.store.create({ ...base, principalRef: "user", state: "preparing", version: 1 }, f.context)).status).toBe("ok")
  expect((await f.store.attach("run", 1, "session", original.receipt, f.context)).status).toBe("ok")
  expect((await f.store.transition("run", 2, "running", undefined, f.context)).status).toBe("ok")
  expect((await f.store.publish("run", 3, original.output, f.context)).status).toBe("ok")
  const stored = () => f.state.read(f.request, "contributions", (state) => ({ run: state.nativeRuns?.run, output: state.contributions.output }))
  const before = await stored()
  if (before.status !== "ok") throw new Error("Ready contribution was not persisted")
  const originalDigest = digestSfValue(before.value)
  const fault: { phase?: 1 | 2; target?: "output" | "output-cycle" | "case" | "binding" | "request"; afterScope: boolean; calls: number } = { calls: 0, afterScope: false }
  const retained: { output?: ContributionEnvelope; caseRef?: ContributionEnvelope["caseRef"] } = {}
  const unavailable = async () => ({ status: "unavailable", reason: "native-runtime-not-attached" } as const)
  const host = createSfAnalysisHost({ store: f.store,
    withRunContext: async (_runRef, action) => {
      const result = await action(f.context)
      // Real authorities freeze bindings. This mutable test context separately
      // checks a composition defense at the final asynchronous scope boundary.
      if (fault.afterScope && fault.calls === 2) Object.assign(f.context.binding, { accessRevision: "changed-after-scope" })
      return result
    },
    verify: async (context, _record, value) => {
      fault.calls++
      retained.output = value.output
      retained.caseRef = value.caseRef
      if (fault.calls === fault.phase) {
        if (fault.target === "output" && value.output) {
          value.output.createdAt = "2026-11-14T00:00:00Z"
          value.output.outputDigest = digestSfContribution(value.output)
        } else if (fault.target === "output-cycle" && value.output) Object.assign(value.output, { evidenceRefs: [value.output] })
        else if (fault.target === "case") value.caseRef.version++
        else if (fault.target === "binding") Object.assign(context.binding, { accessRevision: "changed-by-verifier" })
        else if (fault.target === "request") input.runRef = "another-run"
      }
      return { status: "ok", value: true }
    },
    analysis: { create: unavailable, cancel: unavailable, read: async (_runRef, _context) => {
      const output = await f.state.read(f.request, "contributions", (state) => state.contributions.output)
      if (output.status !== "ok" || !output.value) return { status: "unavailable", reason: "stored-output-unavailable" }
      return { status: "ok", value: output.value }
    } },
    routines: { catalog: unavailable, prepareAdmission: unavailable, readAdmission: unavailable, readRun: unavailable, run: unavailable },
    execution: { admit: unavailable, execute: unavailable, collect: unavailable, interrupt: unavailable },
  })
  const input: Parameters<typeof readSfAnalysisRun>[0] = { host, runRef: "run" }
  const reset = () => {
    fault.calls = 0
    fault.phase = undefined
    fault.target = undefined
    fault.afterScope = false
    input.runRef = "run"
    Object.assign(f.context.binding, { principalRef: "user", policyVersion: "policy", accessRevision: "access" })
  }
  for (const phase of [1, 2] as const) {
    for (const target of ["output", "output-cycle", "case", "binding", "request"] as const) {
      reset()
      Object.assign(fault, { phase, target })
      expect({ phase, target, result: await readSfAnalysisRun(input) }).toEqual({ phase, target,
        result: { status: "denied", reason: "run-input-changed-during-read" } })
      reset()
      const after = await stored()
      expect(after.status).toBe("ok")
      if (after.status !== "ok") throw new Error("Ready contribution became unavailable")
      expect(after.storageVersion).toBe(before.storageVersion)
      expect(digestSfValue(after.value)).toBe(originalDigest)
    }
  }
  reset()
  fault.afterScope = true
  expect(await readSfAnalysisRun(input)).toEqual({ status: "denied", reason: "run-input-changed-during-read" })
  reset()
  const accepted = await readSfAnalysisRun(input)
  expect(accepted.status).toBe("ok")
  if (accepted.status !== "ok" || !accepted.value.output || !retained.output || !retained.caseRef) throw new Error("Ready content was not returned")
  expect(accepted.value.output).not.toBe(retained.output)
  expect(accepted.value.run.caseRef).not.toBe(retained.caseRef)
  const returnedDigest = digestSfValue(accepted.value)
  retained.output.createdAt = "2026-11-14T00:00:00Z"
  retained.caseRef.version++
  expect(digestSfValue(accepted.value)).toBe(returnedDigest)
  const after = await stored()
  expect(after.status).toBe("ok")
  if (after.status !== "ok") throw new Error("Ready contribution was lost")
  expect(after.storageVersion).toBe(before.storageVersion)
  expect(digestSfValue(after.value)).toBe(originalDigest)
})
