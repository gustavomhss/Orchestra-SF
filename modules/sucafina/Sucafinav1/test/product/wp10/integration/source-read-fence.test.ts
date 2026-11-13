import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import type { BlobTransaction } from "../../../../runtime/assets.ts"
import type { Snapshot, TransactionOptions } from "../../../../runtime/contract.ts"
import type { Surface } from "../../../../src/identity.ts"
import { createSfProductState } from "../../../../product/host-binding/state-provider.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"

test("read-only source fence checks staged material and authorization without refreshing identity", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-source-fence-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const calls = { transactions: 0 }
  const counted = { ...store, transaction: <T>(surface: Surface, work: (snapshot: Snapshot, blobs: BlobTransaction) => Promise<{ commit: boolean; value: T }>, options?: TransactionOptions) => {
    calls.transactions++
    return store.transaction(surface, work, options)
  } }
  const source = createSfSourcePersistence({ persistence: counted, enumerate: enumerateSfSources, createId: randomUUID,
    projectScope: (_surface, snapshot, scope) => {
      const projects = snapshot.data.projects
      if (!Array.isArray(projects) || snapshot.data.revoked) return undefined
      const row = projects.find((value) => value.id === scope.recordId)
      return row ? { name: row.name, dependency: snapshot.data.dependency } : undefined
    } })
  const scope = { principalRef: "person", accessRevision: "access", policyVersion: "policy", recordType: "projects", recordId: "project", selector: {} }
  const request = new Request("https://example.test/")
  try {
    await source.initializeSources("dashboard")
    await source.initializeSources("planner")
    await source.transaction("dashboard", async (snapshot) => {
      snapshot.data.projects = [{ id: "project", name: "A" }]
      snapshot.data.dependency = "original"
      return { commit: true, value: undefined }
    })
    const expected = await source.readScopedSource("dashboard", scope, async () => true)
    expect(expected).toBeDefined()
    if (!expected || !source.checkScopedSource) return
    const check = source.checkScopedSource
    const before = await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot.sfSources) }))
    expect(await check("dashboard", scope, async () => true, expected)).toBe(true)
    expect(await check("dashboard", scope, async () => false, expected)).toBe(false)
    expect(await check("dashboard", { ...scope, selector: { fields: ["name"] } }, async () => true, expected)).toBe(false)
    expect(await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.sfSources }))).toEqual(before)
    if (!store.transactionAll) throw new Error("transactionAll unavailable")
    calls.transactions = 0
    await store.transactionAll(async (snapshots) => {
      snapshots.dashboard.data.dependency = "staged-change"
      expect(await check("dashboard", scope, async () => true, expected)).toBe(false)
      expect(calls.transactions).toBe(0)
      return { commit: false, value: undefined }
    })
    expect(calls.transactions).toBe(0)
    expect(await check("dashboard", scope, async () => true, expected)).toBe(true)
    expect(calls.transactions).toBe(1)
    const product = createSfProductState({ persistence: source, createId: randomUUID,
      authorize: async () => ({ principalRef: "person", policyVersion: "policy", accessRevision: "access" }),
      resolveTarget: async () => ({ incarnation: "target" }) })
    const command = { namespace: "preferences" as const, domainSurface: "planner" as const, expectedStorageVersion: 0,
      idempotencyKey: "one", commandDigest: "a".repeat(64), targetRef: "target", targetIncarnation: "target" }
    const result = await product.transaction(request, command, async (state, _authority, planner) => {
      expect(await check("dashboard", scope, async () => true, expected)).toBe(true)
      planner.data.staged = true
      state.preferences.checked = true
      return { commit: true, value: true }
    })
    expect(result.status).toBe("ok")
    await source.transaction("dashboard", async (snapshot) => { snapshot.data.dependency = "changed"; return { commit: true, value: undefined } })
    expect(await check("dashboard", scope, async () => true, expected)).toBe(false)
    await source.transaction("dashboard", async (snapshot) => { snapshot.data.dependency = "original"; return { commit: true, value: undefined } })
    expect(await check("dashboard", scope, async () => true, expected)).toBe(false)
    const fresh = await source.readScopedSource("dashboard", scope, async () => true)
    expect(fresh?.version).toBeGreaterThan(expected.version)
    await source.transaction("dashboard", async (snapshot) => { snapshot.data.revoked = true; return { commit: true, value: undefined } })
    if (fresh) expect(await check("dashboard", scope, async () => true, fresh)).toBe(false)
    await source.transaction("dashboard", async (snapshot) => { snapshot.data.revoked = false; snapshot.data.projects = []; return { commit: true, value: undefined } })
    await source.transaction("dashboard", async (snapshot) => { snapshot.data.projects = [{ id: "project", name: "A" }]; return { commit: true, value: undefined } })
    if (fresh) expect(await check("dashboard", scope, async () => true, fresh)).toBe(false)
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})

test("replacing a surface cannot bypass source, audit or restore guards across reopen", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-source-replacement-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const create = (purpose?: "business-restore") => createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources, createId: randomUUID, purpose })
  try {
    const source = create()
    await source.initializeSources("planner")
    await source.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [{ id: "v1", year: 2027, lines: [] }]
      snapshot.audit.push({ who: "person", at: "2026-11-13T00:00:00Z", record: "initial", was: null, became: "initial" })
      return { commit: true, value: undefined }
    })
    const before = await store.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    for (const kind of ["identity", "audit", "restore", "accessor"] as const) {
      const wrapped = create(kind === "restore" ? "business-restore" : undefined)
      if (!wrapped.transactionAll) throw new Error("transactionAll unavailable")
      await expect(wrapped.transactionAll(async (snapshots) => {
        snapshots.dashboard.data.untrusted = kind
        snapshots.planner = structuredClone(snapshots.planner)
        if (kind === "identity") snapshots.planner.sfSources!.records = {}
        if (kind === "audit") snapshots.planner.audit = []
        if (kind === "restore") snapshots.planner.data.__sfProductV1 = { restored: "untrusted" }
        if (kind === "accessor") {
          const replacement = snapshots.planner
          Object.defineProperty(snapshots, "planner", { configurable: true, get: () => replacement })
        }
        return { commit: true, value: undefined }
      })).rejects.toThrow("SF_SOURCE_SNAPSHOT_REPLACED")
    }
    await store.dispose()
    const reopened = await openLocalStore(directory)
    try {
      expect(await reopened.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(before)
      expect(await reopened.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.data.untrusted }))).toBeUndefined()
    } finally { await reopened.dispose() }
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
