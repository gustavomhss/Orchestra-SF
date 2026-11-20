import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { consumeLocalTransactionAbort, observeLocalTransactionAbort, openLocalStore } from "../../../runtime/local-store.ts"
import { appendSfTransactionAbort, createSfProductState, forwardSfTransactionAbort } from "../../../product/host-binding/state-provider.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SfProductState, SfStateMutation } from "../../../product/contracts/state.ts"

test("only the real SQLite callback rollback issues a single-use observation", async () => withStore(async (store) => {
  const failure = new Error("callback-before-commit")
  const observations: object[] = []
  await expect(store.transactionAll!(async (snapshots) => {
    expect(observeLocalTransactionAbort(structuredClone(snapshots.dashboard))).toBeUndefined()
    for (const surface of ["dashboard", "planner"] as const) {
      const observation = observeLocalTransactionAbort(snapshots[surface])
      if (!observation) throw new Error("Actual transaction observation unavailable")
      observations.push(observation)
    }
    snapshots.planner.data.effect = "staged-only"
    throw failure
  })).rejects.toBe(failure)
  expect(consumeLocalTransactionAbort(structuredClone(observations[0]!), failure)).toBeUndefined()
  const observed = consumeLocalTransactionAbort(observations[0]!, failure)
  expect(observed).toEqual({ storageIdentity: expect.stringMatching(/^[a-f0-9]{64}$/), transactionId: expect.stringMatching(/^[a-f0-9-]{36}$/) })
  expect(consumeLocalTransactionAbort(observations[0]!, failure)).toBeUndefined()
  expect(consumeLocalTransactionAbort(observations[1]!, failure)).toBeUndefined()
  expect(await store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot.data.effect }))).toBeUndefined()
}))

for (const mode of ["after-commit", "after-read", "serialization"] as const) test(`SQLite ${mode} failure cannot certify a callback rollback`, async () => withStore(async (store) => {
  const captured: { observation?: object; error?: unknown } = {}
  const failure = new Error(mode)
  try {
    await store.transactionAll!(async (snapshots) => {
      captured.observation = observeLocalTransactionAbort(snapshots.dashboard)
      snapshots.planner.data.effect = mode
      if (mode === "serialization") snapshots.planner.data.cycle = snapshots.planner.data
      return { commit: mode !== "after-read", value: true }
    })
    throw failure
  } catch (error) { captured.error = error }
  expect(captured.observation).toBeDefined()
  expect(captured.error).toBeDefined()
  expect(consumeLocalTransactionAbort(captured.observation!, captured.error)).toBeUndefined()
  expect(await store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot.data.effect })))
    .toBe(mode === "after-commit" ? mode : undefined)
}))

test("C08 binds rollback provenance to the original port, Request and command, and consumes it once under concurrent journal writes", async () => withStore(async (store) => {
  const fixture = await stateFixture(store)
  const before = await fixture.inspect()
  const failed = await fixture.fail()
  expect(failed).toEqual({ status: "unavailable", reason: "transaction-rolled-back" })
  expect(await fixture.inspect()).toEqual(before)
  const input = fixture.journal(failed)
  const foreign = fixture.createState()
  for (const changed of [
    { ...input, result: structuredClone(failed) },
    { ...input, state: foreign },
    { ...input, request: fixture.request.clone() },
    { ...input, expected: { ...fixture.command, commandDigest: "f".repeat(64) } },
  ]) expect(await appendSfTransactionAbort(changed)).toEqual({ status: "unavailable", reason: "transaction-abort-unproven" })
  expect(await fixture.state.transaction(fixture.request, {
    namespace: "cases", expectedStorageVersion: before.storageVersion, targetRef: "case", targetIncarnation: "case-inc",
    idempotencyKey: input.idempotencyKey, commandDigest: digestSfValue(input.value),
  }, async () => ({ commit: true, value: input.value }))).toEqual({ status: "denied", reason: "transaction-abort-writer-required" })
  expect(await fixture.inspect()).toEqual(before)

  const forwarded = { status: "unavailable" as const, reason: "domain-application-unavailable" }
  forwardSfTransactionAbort({ state: fixture.state, request: fixture.request, expected: fixture.command, from: failed, to: forwarded })
  expect(await appendSfTransactionAbort(input)).toEqual({ status: "unavailable", reason: "transaction-abort-unproven" })
  const writes = await Promise.all([appendSfTransactionAbort({ ...input, result: forwarded }), appendSfTransactionAbort({ ...input, result: forwarded })])
  expect(writes.map((result) => result.status).sort()).toEqual(["ok", "unavailable"])
  expect(writes.find((result) => result.status === "unavailable")).toEqual({ status: "unavailable", reason: "transaction-abort-unproven" })
  expect(await appendSfTransactionAbort({ ...input, result: forwarded })).toEqual({ status: "unavailable", reason: "transaction-abort-unproven" })

  const after = await fixture.inspect()
  const key = JSON.stringify(["principal", "cases", "case", input.idempotencyKey])
  const journal = after.value.transactions[key]!
  expect(journal).toEqual({
    namespace: "cases", scopeDigest: digestSfValue(["cases"]), principalRef: "principal", targetRef: "case", targetIncarnation: "case-inc",
    commandDigest: digestSfValue(journal.value), storageVersion: before.storageVersion + 1, aggregateRevision: before.aggregateRevision + 1,
    incarnation: before.incarnation, value: {
      ...input.value, rollback: { storageIdentity: expect.stringMatching(/^[a-f0-9]{64}$/), transactionId: expect.stringMatching(/^[a-f0-9-]{36}$/),
        command: fixture.command, envelope: { incarnation: before.incarnation, aggregateRevision: before.aggregateRevision, versions: before.value.versions } },
    },
  })
  expect(after).toEqual({
    ...before, storageVersion: before.storageVersion + 1, aggregateRevision: before.aggregateRevision + 1,
    value: { ...before.value, revision: before.value.revision + 1, versions: { ...before.value.versions, cases: before.storageVersion + 1 },
      transactions: { ...before.value.transactions, [key]: journal } },
  })
  expect(await store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot.data.effect }))).toBeUndefined()
}))

for (const mode of ["refused-validation", "revoked-authority"] as const) test(`C08 ${mode} cannot retain an abort capability for another journal attempt`, async () => withStore(async (store) => {
  const fixture = await stateFixture(store)
  const before = await fixture.inspect()
  const failed = await fixture.fail()
  const input = fixture.journal(failed)
  if (mode === "revoked-authority") fixture.access.allowed = false
  const refused = await appendSfTransactionAbort({ ...input, validate: () => false })
  expect(refused.status).toBe(mode === "revoked-authority" ? "denied" : "preview")
  fixture.access.allowed = true
  expect(await appendSfTransactionAbort(input)).toEqual({ status: "unavailable", reason: "transaction-abort-unproven" })
  expect(await fixture.inspect()).toEqual(before)
}))

async function stateFixture(store: Awaited<ReturnType<typeof openLocalStore>>) {
  const request = new Request("https://example.test/abort-observation")
  const access = { allowed: true }
  const authority = { principalRef: "principal", policyVersion: "policy", accessRevision: "access" }
  const createState = () => createSfProductState({
    persistence: store, createId: randomUUID,
    authorize: async () => access.allowed ? { ...authority } : undefined,
    resolveTarget: async (_request, _snapshot, namespace, targetRef) => namespace === "cases" && targetRef === "case" ? { incarnation: "case-inc" }
      : namespace === "receipts" && targetRef === "domain" ? { incarnation: "domain-inc" } : undefined,
  })
  const state = createState()
  const seeded = await state.transaction(request, {
    namespace: "cases", expectedStorageVersion: 0, targetRef: "case", targetIncarnation: "case-inc",
    idempotencyKey: "seed-state", commandDigest: digestSfValue("empty-case-state"),
  }, async () => ({ commit: true, value: true }))
  if (seeded.status !== "ok") throw new Error("Actual C08 seed unavailable")
  const command: SfStateMutation = { namespace: "receipts", domainSurface: "planner", expectedStorageVersion: 0,
    additionalNamespaces: [{ namespace: "cases", expectedStorageVersion: seeded.storageVersion }],
    targetRef: "domain", targetIncarnation: "domain-inc", idempotencyKey: "prepared:domain-command", commandDigest: digestSfValue("review-binding") }
  const inspect = async () => {
    const observed = await state.read(request, "cases", (current) => current)
    if (observed.status !== "ok") throw new Error("Actual C08 inspection unavailable")
    return observed
  }
  return {
    request, access, createState, state, command, inspect,
    fail: () => state.transaction(request, command, async (_current, _authority, snapshot) => {
      snapshot.data.effect = "staged-only"
      throw new Error("actual-callback-before-commit")
    }),
    journal: (result: object) => ({
      state, request, result, expected: command, expectedStorageVersion: seeded.storageVersion,
      targetRef: "case", targetIncarnation: "case-inc", idempotencyKey: "decision-application-abort:provenance:0",
      value: { schema: "rollback-provenance-test", requestDigest: digestSfValue({ caseId: "case", command: command.idempotencyKey }) },
      validate: (current: Readonly<SfProductState>, currentAuthority: typeof authority) =>
        current.versions.cases === seeded.storageVersion && digestSfValue(currentAuthority) === digestSfValue(authority),
    }),
  }
}

async function withStore(work: (store: Awaited<ReturnType<typeof openLocalStore>>) => Promise<void>) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-transaction-abort-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try { await work(store) } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
}
