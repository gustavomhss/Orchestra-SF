import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import type { Snapshot } from "../../../../runtime/contract.ts"
import type { SfProductState, SfStateAuthority } from "../../../../product/contracts/state.ts"
import { createSfProductState } from "../../../../product/host-binding/state-provider.ts"

test("C08 receipt and Planner change commit together and replay only once across restart", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-cross-surface-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const request = new Request("https://example.test/")
  const create = (persistence: typeof store) => createSfProductState({ persistence, createId: () => "product-inc",
    authorize: async () => ({ principalRef: "person", policyVersion: "policy", accessRevision: "access" }),
    resolveTarget: async () => ({ incarnation: "target-inc" }) })
  const command = { namespace: "receipts" as const, domainSurface: "planner" as const, expectedStorageVersion: 0,
    idempotencyKey: "import", commandDigest: "a".repeat(64), targetRef: "target", targetIncarnation: "target-inc" }
  try {
    const product = create(store)
    const apply = async (state: SfProductState, _authority: SfStateAuthority, snapshot: Snapshot) => {
      snapshot.data.imports = Number(snapshot.data.imports ?? 0) + 1
      state.receipts.import = { id: "receipt", idempotencyKey: "import", commandDigest: command.commandDigest, targetIncarnation: "target-inc",
        principalRef: "person", surface: "planner", version: 1, result: { ok: true }, at: "2026-11-13T00:00:00Z" }
      return { commit: true, value: "applied" }
    }
    expect((await product.transaction(request, command, apply)).status).toBe("ok")
    expect((await product.transaction(request, command, apply)).status).toBe("ok")
    expect((await product.transaction(request, { ...command, commandDigest: "b".repeat(64) }, apply)).status).toBe("conflict")
    await store.dispose()
    const reopened = await openLocalStore(directory)
    try {
      expect(await reopened.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot.data.imports }))).toBe(1)
      const receipt = await create(reopened).read(request, "receipts", (state) => state.receipts.import)
      expect(receipt).toMatchObject({ status: "ok", value: { id: "receipt", surface: "planner" } })
    } finally { await reopened.dispose() }
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})

test("cross-surface preview, failure, cancellation and missing transactionAll never persist either surface", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-cross-rollback-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const make = (persistence: typeof store | Pick<typeof store, "transaction">) => createSfProductState({ persistence, createId: () => "inc",
      authorize: async () => ({ principalRef: "person", policyVersion: "policy", accessRevision: "access" }), resolveTarget: async () => ({ incarnation: "target-inc" }) })
    const command = { namespace: "preferences" as const, domainSurface: "planner" as const, expectedStorageVersion: 0,
      idempotencyKey: "one", commandDigest: "a".repeat(64), targetRef: "target", targetIncarnation: "target-inc" }
    const controller = new AbortController()
    const product = make(store)
    const preview = await product.transaction(new Request("https://example.test/"), command, async (state, _authority, snapshot) => {
      state.preferences.test = true; snapshot.data.test = true
      return { commit: false, value: true }
    })
    expect(preview.status).toBe("preview")
    await expect(product.transaction(new Request("https://example.test/"), command, async (state, _authority, snapshot) => {
      state.preferences.test = true; snapshot.data.test = true
      throw new Error("callback failed")
    })).rejects.toThrow("callback failed")
    await expect(product.transaction(new Request("https://example.test/", { signal: controller.signal }), command, async (state, _authority, snapshot) => {
      state.preferences.test = true; snapshot.data.test = true; controller.abort()
      return { commit: true, value: true }
    })).rejects.toThrow()
    expect((await make({ transaction: store.transaction }).transaction(new Request("https://example.test/"), command, async () => ({ commit: true, value: true }))).status).toBe("unavailable")
    expect(await store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot.data.test }))).toBeUndefined()
    expect(await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.data.__sfProductV1 }))).toBeUndefined()
    await store.dispose()
    const reopened = await openLocalStore(directory)
    try {
      expect(await reopened.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot.data.test }))).toBeUndefined()
      expect(await reopened.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.data.__sfProductV1 }))).toBeUndefined()
    } finally { await reopened.dispose() }
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})

test("proposal coverage records require their own private write capability", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-proposal-write-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const writes = new WeakSet<object>()
    const product = createSfProductState({ persistence: store, proposalCoverageWrites: writes, createId: () => "inc",
      authorize: async () => ({ principalRef: "person", policyVersion: "policy", accessRevision: "access" }), resolveTarget: async () => ({ incarnation: "target-inc" }) })
    const request = new Request("https://example.test/")
    const command = { namespace: "preferences" as const, expectedStorageVersion: 0, idempotencyKey: "one", commandDigest: "a".repeat(64), targetRef: "target", targetIncarnation: "target-inc" }
    const write = async (state: SfProductState) => { state.preferences["sf:proposal-coverage:forged"] = { value: true }; return { commit: true, value: true } }
    expect(await product.transaction(request, command, write)).toMatchObject({ status: "denied", reason: "proposal-coverage-write-outside-authority" })
    writes.add(write)
    expect((await product.transaction(request, command, write)).status).toBe("ok")
    const nativeWrite = async (state: SfProductState) => { state.preferences["sf:native-session:forged"] = { value: true }; return { commit: true, value: true } }
    writes.add(nativeWrite)
    expect(await product.transaction(request, { ...command, expectedStorageVersion: 1, idempotencyKey: "two" }, nativeWrite))
      .toMatchObject({ status: "denied", reason: "native-evidence-write-outside-authority" })
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
