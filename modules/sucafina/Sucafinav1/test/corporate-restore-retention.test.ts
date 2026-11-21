import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfValue } from "../product/contracts/canonical.ts"
import {
  createSfProductState,
  initializeAbsentSfProductState,
  inspectSfProductRestoreFrontier,
} from "../product/host-binding/state-provider.ts"
import { publicSfData, SF_PROCUREMENT_CREATE_RECEIPTS } from "../product/integration/public-state.ts"
import { createLocalBackups } from "../runtime/local-backups.ts"
import type { LocalStore } from "../runtime/local-contract.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import { restoreBackup } from "../runtime/operations.ts"
import { captureSfCorporateRestoreRetention } from "../runtime/restore-effect-frontier.ts"

const at = "2026-11-21T00:00:00.000Z"
const authority = { principalRef: "operator", accessRevision: "access-v2", policyVersion: "policy-v2" }
const actor = { id: authority.principalRef, roles: ["admin"], canWrite: true }
const policy = { access: { operator: { assigned: ["Operations"] } }, roleMap: [], budgetLineIds: {} }
const installationDigest = digestSfValue("corporate-installation")
const assetKey = "checkpoint-only-asset"
const asset = new Uint8Array([0, 9, 10, 255])

async function read(store: LocalStore) {
  return store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
}

test("external restore comparison rejects a stale effect frontier and restore keeps the durable response across restart", async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), "sucafina-restore-frontier-"))
  const stores: LocalStore[] = []
  const open = async () => {
    const store = await openLocalStore(join(root, "business"))
    stores.push(store)
    return store
  }
  const control = new Database(join(root, "independent-control.sqlite"), { strict: true })
  try {
    const store = await open()
    const backups = await createLocalBackups(join(root, "archives"))
    await initializeAbsentSfProductState(store, () => "product-incarnation")
    await store.transaction("dashboard", async (snapshot, blobs) => {
      snapshot.data.restoreMarker = "checkpoint"
      snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "former-admin" }]
      snapshot.data.access = { former: { assigned: ["Operations"] } }
      snapshot.data.budgetLineIds = { former: ["opexOwners:fixture"] }
      snapshot.data.summaries = ["Operations"]
      snapshot.data[SF_PROCUREMENT_CREATE_RECEIPTS] = { older: true }
      snapshot.data.assets = [{ key: assetKey, bytes: asset.length }]
      await blobs.put(assetKey, asset, "application/octet-stream")
      return { commit: true, value: undefined }
    })
    const archive = await backups.capture(store, "dashboard", at)
    const loaded = await backups.source.load("dashboard", archive.id)
    if (!loaded) throw new Error("Expected the real checkpoint archive")
    const checkpoint = loaded.snapshot

    const request = new Request("https://sf.example.test/sucafina", { method: "POST" })
    const statePort = (persistence: LocalStore) => createSfProductState({
      persistence,
      authorize: async () => authority,
      resolveTarget: async () => ({ incarnation: "target-1" }),
      createId: () => "unexpected-product-incarnation",
    })
    const command = {
      namespace: "preferences" as const,
      expectedStorageVersion: 0,
      idempotencyKey: "confirmation-1",
      commandDigest: digestSfValue("confirm-once"),
      targetRef: "target",
      targetIncarnation: "target-1",
    }
    const original = await statePort(store).transaction(request, command, async (state) => {
      state.preferences.confirmed = "confirmed-1"
      return { commit: true, value: "confirmed-1" }
    })
    expect(original).toMatchObject({ status: "ok", storageVersion: 1, aggregateRevision: 1, value: "confirmed-1" })
    await store.transaction("dashboard", async (snapshot, blobs) => {
      Object.assign(snapshot.data, policy, { restoreMarker: "later" })
      delete snapshot.data.summaries
      snapshot.data[SF_PROCUREMENT_CREATE_RECEIPTS] = { confirmed: true }
      snapshot.data.assets = []
      await blobs.remove(assetKey)
      return { commit: true, value: undefined }
    })
    const current = await read(store)
    const checkpointFrontier = inspectSfProductRestoreFrontier(checkpoint)
    const frontier = inspectSfProductRestoreFrontier(current)
    if (!checkpointFrontier || !frontier) throw new Error("Expected both durable product frontiers")
    expect(checkpointFrontier.transactions).toHaveLength(0)
    expect(frontier.transactions).toHaveLength(1)

    // The separate test DB models a trusted latest read. It is not a production pin issuer.
    control.exec("CREATE TABLE pin (generation INTEGER PRIMARY KEY, installationDigest TEXT, checkpointDigest TEXT, frontierDigest TEXT)")
    const insert = control.query("INSERT INTO pin VALUES (?, ?, ?, ?)")
    insert.run(1, installationDigest, digestSfValue(checkpoint), digestSfValue(checkpointFrontier))
    insert.run(2, installationDigest, digestSfValue(checkpoint), digestSfValue(frontier))
    const pin = control.query<{
      generation: number; installationDigest: string; checkpointDigest: string; frontierDigest: string
    }, []>("SELECT * FROM pin ORDER BY generation DESC LIMIT 1").get()
    if (!pin) throw new Error("Expected the independently retained pin")
    const admission = { installationDigest, generation: pin.generation, pin }
    expect(() => captureSfCorporateRestoreRetention(current, checkpoint, frontier, undefined))
      .toThrow("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
    expect(() => captureSfCorporateRestoreRetention(current, checkpoint, undefined, admission))
      .toThrow("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
    expect(() => captureSfCorporateRestoreRetention(checkpoint, checkpoint, checkpointFrontier, admission))
      .toThrow("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
    expect(() => captureSfCorporateRestoreRetention(current, checkpoint, frontier, { ...admission, generation: 1 }))
      .toThrow("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
    expect(() => captureSfCorporateRestoreRetention(current, checkpoint, frontier, { ...admission, installationDigest: digestSfValue("another-installation") }))
      .toThrow("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
    const retention = captureSfCorporateRestoreRetention(current, checkpoint, frontier, admission)
    const proposed = structuredClone(checkpoint)
    retention.apply(proposed.data)
    expect(proposed.data).toMatchObject(policy)
    expect(proposed.data.budgetLineIds).toEqual({})
    expect(inspectSfProductRestoreFrontier(proposed)).toEqual(frontier)
    expect(await read(store)).toEqual(current)

    const readAsset = () => store.transaction("dashboard", async (_snapshot, blobs) =>
      ({ commit: false, value: await blobs.get(assetKey) }))
    const restore = (verifyCurrent: () => Promise<boolean>) =>
      restoreBackup(store, backups.source, "dashboard", archive.id, actor, true, current.versions.dataset?.version ?? 0, at, {
        retain: (snapshot, archived) => captureSfCorporateRestoreRetention(snapshot, archived, frontier, admission),
        verifyCurrent,
      })
    const stale = await restoreBackup(store, backups.source, "dashboard", archive.id, actor, true, -1, at, {
      retain: () => { throw new Error("A stale request cannot enter recovery") },
      verifyCurrent: async () => true,
    })
    expect(stale).toEqual({ ok: false, status: 409 })
    const verification = { calls: 0 }
    expect(await restore(async () => ++verification.calls === 1)).toEqual({ ok: false, status: 403 })
    expect(verification.calls).toBe(2)
    expect(await read(store)).toEqual(current)
    expect(await readAsset()).toBeUndefined()
    expect(await restore(async () => true)).toEqual({ ok: true })
    expect(await readAsset()).toEqual(asset)
    const recovered = await read(store)
    expect(recovered.data).toMatchObject({ ...policy, restoreMarker: "checkpoint" })
    expect(recovered.data.budgetLineIds).toEqual({})
    expect(Object.hasOwn(recovered.data, "summaries")).toBe(false)
    expect(recovered.data[SF_PROCUREMENT_CREATE_RECEIPTS]).toEqual({ confirmed: true })
    expect(Object.hasOwn(publicSfData(recovered.data), SF_PROCUREMENT_CREATE_RECEIPTS)).toBe(false)
    expect(inspectSfProductRestoreFrontier(recovered)).toEqual(frontier)
    expect(recovered.audit.at(-1)).toEqual({
      who: actor.id, at, record: "dataset", was: { datasetVersion: 0 }, became: { datasetVersion: 1 },
    })
    await store.dispose()

    const reopened = await open()
    const retry = await statePort(reopened).transaction(request, command, async () => {
      throw new Error("The confirmed effect was invoked again")
    })
    expect(retry).toEqual(original)
    expect(inspectSfProductRestoreFrontier(await read(reopened))).toEqual(frontier)
  } finally {
    control.close()
    await Promise.all(stores.map((store) => store.dispose()))
    await rm(root, { recursive: true, force: true })
  }
})
