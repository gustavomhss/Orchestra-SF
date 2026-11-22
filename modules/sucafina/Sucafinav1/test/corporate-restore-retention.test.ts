import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfValue } from "../product/contracts/canonical.ts"
import {
  createSfProductState,
  initializeAbsentSfProductState,
  inspectSfProductRestoreFrontier,
} from "../product/host-binding/state-provider.ts"
import { publicSfData, SF_PROCUREMENT_CREATE_RECEIPTS } from "../product/integration/public-state.ts"
import type { AssetPersistence } from "../runtime/assets.ts"
import { createCorporateRecoveryHttp } from "../runtime/corporate-recovery-http.ts"
import { openCorporateRecoveryRegister } from "../runtime/corporate-recovery-register.ts"
import { createLocalBackups } from "../runtime/local-backups.ts"
import type { LocalStore } from "../runtime/local-contract.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import { restoreBackup } from "../runtime/operations.ts"
import { captureSfCorporateRestoreRetention } from "../runtime/restore-effect-frontier.ts"
import { teamProfileInstallationId } from "../runtime/team-profile-access.ts"

const at = "2026-11-21T00:00:00.000Z"
const authority = { principalRef: "operator", accessRevision: "access-v2", policyVersion: "policy-v2" }
const actor = { id: authority.principalRef, roles: ["admin"], canWrite: true }
const policy = { access: { operator: { assigned: ["Operations"] } }, roleMap: [], budgetLineIds: {} }
const teamObjectId = "10000000-0000-4000-8000-000000000001"
const config = {
  origin: "https://sf.example.test",
  mount: "/sucafina",
  tenantId: "10000000-0000-4000-8000-000000000002",
  clientId: "10000000-0000-4000-8000-000000000003",
  enabledTeamIds: [teamObjectId],
  supremeAdminGroupId: "10000000-0000-4000-8000-000000000004",
  grants: [{ principalRef: actor.id, migrationActions: ["recover"] }],
}
const assetKey = "checkpoint-only-asset"
const asset = new Uint8Array([0, 9, 10, 255])

async function read(store: LocalStore) {
  return store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
}

test("external restore comparison rejects a stale effect frontier and restore keeps the durable response across restart", async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), "sucafina-restore-frontier-"))
  const directory = join(root, "installation")
  await mkdir(directory, { mode: 0o700 })
  const installationId = teamProfileInstallationId({ ...config, directory })
  const installationDigest = digestSfValue({ installationId, tenantId: config.tenantId, clientId: config.clientId })
  const partition = digestSfValue({ installationId, tenantId: config.tenantId, teamObjectId })
  const stores: LocalStore[] = []
  const open = async () => {
    const store = await openLocalStore(join(directory, "business-teams", partition))
    stores.push(store)
    return store
  }
  const registerFile = join(root, "independent-control.sqlite")
  const control = new Database(registerFile, { strict: true })
  try {
    const store = await open()
    const assets: AssetPersistence = store
    const backups = await createLocalBackups(join(directory, "backups-teams", partition))
    await initializeAbsentSfProductState(store, () => "product-incarnation")
    await assets.transaction("dashboard", async (snapshot, blobs) => {
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
    await assets.transaction("dashboard", async (snapshot, blobs) => {
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

    // The controlled observer publishes evidence outside the installation under the fixture owner.
    control.exec(`CREATE TABLE recovery_pins (
      installation_digest TEXT, partition_digest TEXT, generation INTEGER,
      checkpoint_digest TEXT, frontier_digest TEXT, archive_digest TEXT
    ) STRICT`)
    const archiveDigest = digestSfValue({ checkpointId: archive.id, manifest: archive.manifest })
    const insert = control.query("INSERT INTO recovery_pins VALUES (?, ?, ?, ?, ?, ?)")
    insert.run(installationDigest, partition, 1, digestSfValue(checkpoint), digestSfValue(checkpointFrontier), archiveDigest)
    insert.run(installationDigest, partition, 2, digestSfValue(checkpoint), digestSfValue(frontier), digestSfValue("unapproved-archive"))
    const pin = control.query<{
      generation: number; installationDigest: string; checkpointDigest: string; frontierDigest: string
    }, []>(`SELECT generation, installation_digest AS installationDigest, checkpoint_digest AS checkpointDigest,
      frontier_digest AS frontierDigest FROM recovery_pins ORDER BY generation DESC LIMIT 1`).get()
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

    const readAsset = () => assets.transaction("dashboard", async (_snapshot, blobs) =>
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
    const cancelled = new Error("cancelled by caller")
    await expect(restoreBackup(store, backups.source, "dashboard", "not-an-archive-id", actor, true, 0, at, {
      retain: () => { throw new Error("An aborted request cannot enter recovery") },
      verifyCurrent: async () => true,
      signal: AbortSignal.abort(cancelled),
    })).rejects.toThrow(cancelled)
    const register = await openCorporateRecoveryRegister(registerFile, directory, process.getuid?.())
    const recovery = createCorporateRecoveryHttp({
      config, directory, register, now: () => new Date(at),
      identity: {
        prepare: async () => {},
        observeCorporateRecoveryActor: async (request, group) =>
          group === config.supremeAdminGroupId && request.headers.get("cookie") === "verified-fixture"
            ? { principalId: actor.id, verifyCurrent: async () => true } : undefined,
      },
    })
    const post = (command: Record<string, unknown>, cookie = "verified-fixture") => recovery(
      new Request(config.origin + config.mount + "/api/ui/team-profile-migration/recover", {
        method: "POST",
        headers: { origin: config.origin, "content-type": "application/json", cookie },
        body: JSON.stringify(command),
      }),
    )
    const restoreCommand = { teamObjectId, checkpointId: archive.id, expectedVersion: 0, confirm: true }
    expect((await post(restoreCommand, ""))?.status).toBe(403)
    expect((await post({ ...restoreCommand, teamObjectId: config.tenantId }))?.status).toBe(403)
    expect((await post({ ...restoreCommand, pin }))?.status).toBe(400)
    expect((await post(restoreCommand))?.status).toBe(503)
    expect(await read(store)).toEqual(current)
    insert.run(installationDigest, partition, 3, digestSfValue(checkpoint), digestSfValue(frontier), archiveDigest)
    expect((await post(restoreCommand))?.status).toBe(204)
    expect((await post(restoreCommand))?.status).toBe(409)
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
