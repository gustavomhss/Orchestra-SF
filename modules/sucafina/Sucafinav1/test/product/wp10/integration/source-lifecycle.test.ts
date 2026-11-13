import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { createSfSourcePersistence, sfSourceIdentity } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"

test("source incarnation survives reopen and deletion/recreation gets a new identity", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-source-test-"))
  await chmod(directory, 0o700)
  const open = async () => {
    const store = await openLocalStore(directory)
    const persistence = createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources, createId: randomUUID })
    await persistence.initializeSources("planner")
    return { store, persistence }
  }
  try {
    const first = await open()
    await first.persistence.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [{ id: "version-A", year: 2027, lines: [] }]
      return { commit: true, value: undefined }
    })
    const original = await first.persistence.transaction("planner", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "planner-version", "version-A") }))
    expect(original?.version).toBe(1)
    await first.store.dispose()
    const second = await open()
    expect(await second.persistence.transaction("planner", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "planner-version", "version-A") }))).toEqual(original)
    await second.persistence.transaction("planner", async (snapshot) => {
      snapshot.data.versions = []
      return { commit: true, value: undefined }
    })
    await second.persistence.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [{ id: "version-A", year: 2027, lines: [] }]
      return { commit: true, value: undefined }
    })
    const recreated = await second.persistence.transaction("planner", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "planner-version", "version-A") }))
    expect(recreated?.incarnation).not.toBe(original?.incarnation)
    await second.store.dispose()
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test("preview, thrown callback and cancellation leave lifecycle unchanged", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-source-rollback-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const persistence = createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources, createId: randomUUID })
  try {
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.projects = [{ id: "project-1", name: "Original" }]
      return { commit: true, value: undefined }
    })
    const before = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.projects = []
      return { commit: false, value: undefined }
    })
    await expect(persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.projects = []
      throw new Error("Interrupted before commit")
    })).rejects.toThrow("Interrupted before commit")
    const cancellation = new AbortController()
    await expect(persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.projects = []
      cancellation.abort()
      return { commit: true, value: undefined }
    }, { signal: cancellation.signal })).rejects.toThrow()
    expect(await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(before)
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})

test("dataset replacement renews identity and retains the trusted protected product namespace", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-source-replace-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const persistence = createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources, createId: randomUUID })
  try {
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.projects = [{ id: "project-1", name: "Original" }]
      snapshot.data.__sfProductV1 = { protected: "current" }
      return { commit: true, value: undefined }
    })
    const before = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "projects", "project-1") }))
    await persistence.transaction("dashboard", async (snapshot) => {
      const previous = structuredClone(snapshot.data)
      snapshot.data = { projects: [{ id: "project-1", name: "Original" }], __sfProductV1: { protected: "archived" } }
      snapshot.audit.push({ record: "dataset", who: "principal-1", at: "2026-11-13T00:00:00Z", was: previous, became: structuredClone(snapshot.data) })
      return { commit: true, value: undefined }
    })
    const after = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: { identity: sfSourceIdentity(snapshot, "projects", "project-1"), product: snapshot.data.__sfProductV1 } }))
    expect(after.identity?.incarnation).not.toBe(before?.incarnation)
    expect(after.product).toEqual({ protected: "current" })
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
