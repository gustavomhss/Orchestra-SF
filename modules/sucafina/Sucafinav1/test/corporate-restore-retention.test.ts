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
    const policyStore = await openLocalStore(join(directory, "business-microsoft"), {
      teamProfilePolicy: {
        binding: { installationId, tenantId: config.tenantId }, bootstrapEnabledTeamIds: config.enabledTeamIds,
      },
    })
    stores.push(policyStore)
    if (!policyStore.teamProfiles) throw new Error("Expected the original Team policy store")
    const register = await openCorporateRecoveryRegister(registerFile, directory, process.getuid?.())
    const recovery = createCorporateRecoveryHttp({
      config, directory, register, profilePolicy: policyStore.teamProfiles, now: () => new Date(at),
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


test("corporate recovery admits a Team enabled after HTTP bootstrap without requiring Team membership", async () => {
  const fixture = await recoveryPolicyFixture([])
  try {
    expect((await fixture.post())?.status).toBe(403)
    expect(await fixture.snapshot()).toEqual(fixture.current)
    await fixture.mutate("enable")
    expect((await fixture.post())?.status).toBe(204)
    expect((await fixture.snapshot()).data.restoreMarker).toBe("checkpoint")
    expect(await fixture.readAsset()).toEqual(asset)
    expect(fixture.verification.calls).toBe(3)
  } finally { await fixture.close() }
})

test.each(["disable", "remove"] as const)("corporate recovery rejects a Team after dynamic %s despite its bootstrap seed", async (action) => {
  const fixture = await recoveryPolicyFixture()
  try {
    const before = await fixture.profilePolicy.read()
    await fixture.mutate(action)
    expect((await fixture.profilePolicy.read()).configRevision).not.toBe(before.configRevision)
    expect((await fixture.post())?.status).toBe(403)
    expect(fixture.verification.calls).toBe(0)
    expect(await fixture.snapshot()).toEqual(fixture.current)
    expect(await fixture.readAsset()).toBeUndefined()
  } finally { await fixture.close() }
})

test.each(["disable", "remove", "revision"] as const)("corporate recovery rolls back staged restore when policy changes at commit: %s", async (change) => {
  const fixture = await recoveryPolicyFixture()
  try {
    const before = await fixture.profilePolicy.read()
    // The third original authorization is restoreBackup's final writer check,
    // after its real blob/data/audit staging and before SQLite COMMIT.
    fixture.verification.before = async (call) => {
      if (call === 3) await fixture.mutate(change === "revision" ? "enable" : change,
        change === "revision" ? "10000000-0000-4000-8000-000000000005" : teamObjectId)
    }
    expect((await fixture.post())?.status).toBe(403)
    expect(fixture.verification.calls).toBe(3)
    const current = await fixture.profilePolicy.read()
    expect(current.configRevision).not.toBe(before.configRevision)
    expect(current.profiles.some((entry) => entry.profile.teamObjectId === teamObjectId && entry.enabled))
      .toBe(change === "revision")
    expect(await fixture.snapshot()).toEqual(fixture.current)
    expect(await fixture.readAsset()).toBeUndefined()
  } finally { await fixture.close() }
})

test("corporate recovery never falls back to bootstrap when current policy is unavailable", async () => {
  const fixture = await recoveryPolicyFixture()
  try {
    await fixture.policyStore.dispose()
    expect((await fixture.post())?.status).toBe(503)
    expect(await fixture.snapshot()).toEqual(fixture.current)
    expect(await fixture.readAsset()).toBeUndefined()
  } finally { await fixture.close() }
})

test("corporate recovery keeps recover authority separate from checkpoint authority", async () => {
  const fixture = await recoveryPolicyFixture()
  try {
    const recovery = createCorporateRecoveryHttp({
      ...fixture.input,
      config: { ...fixture.input.config, grants: [{ principalRef: actor.id, migrationActions: ["checkpoint"] }] },
    })
    expect((await fixture.post(recovery))?.status).toBe(403)
    expect(fixture.verification.calls).toBe(0)
    expect(await fixture.snapshot()).toEqual(fixture.current)
    expect(await fixture.readAsset()).toBeUndefined()
  } finally { await fixture.close() }
})

async function recoveryPolicyFixture(bootstrapEnabledTeamIds: readonly string[] = [teamObjectId]) {
  const root = await mkdtemp(join(await realpath(tmpdir()), "sucafina-recovery-policy-"))
  const directory = join(root, "installation")
  await mkdir(directory, { mode: 0o700 })
  const installationId = teamProfileInstallationId({ ...config, directory })
  const installationDigest = digestSfValue({ installationId, tenantId: config.tenantId, clientId: config.clientId })
  const partition = digestSfValue({ installationId, tenantId: config.tenantId, teamObjectId })
  const stores: LocalStore[] = []
  const registerFile = join(root, "independent-control.sqlite")
  const control = new Database(registerFile, { strict: true })
  const close = async () => {
    control.close()
    try { await Promise.all(stores.map((store) => store.dispose())) }
    finally { await rm(root, { recursive: true, force: true }) }
  }
  try {
    const policyStore = await openLocalStore(join(directory, "business-microsoft"), {
      teamProfilePolicy: { binding: { installationId, tenantId: config.tenantId }, bootstrapEnabledTeamIds },
    })
    stores.push(policyStore)
    const profilePolicy = policyStore.teamProfiles
    if (!profilePolicy) throw new Error("Expected the original Team policy store")
    const store = await openLocalStore(join(directory, "business-teams", partition))
    stores.push(store)
    const assets: AssetPersistence = store
    await initializeAbsentSfProductState(store, () => "product-incarnation")
    await assets.transaction("dashboard", async (snapshot, blobs) => {
      snapshot.data.restoreMarker = "checkpoint"
      snapshot.data.assets = [{ key: assetKey, bytes: asset.length }]
      await blobs.put(assetKey, asset, "application/octet-stream")
      return { commit: true, value: undefined }
    })
    const backups = await createLocalBackups(join(directory, "backups-teams", partition))
    const archive = await backups.capture(store, "dashboard", at)
    const loaded = await backups.source.load("dashboard", archive.id)
    if (!loaded) throw new Error("Expected the real checkpoint archive")
    await assets.transaction("dashboard", async (snapshot, blobs) => {
      snapshot.data.restoreMarker = "later"
      snapshot.data.assets = []
      await blobs.remove(assetKey)
      return { commit: true, value: undefined }
    })
    const current = await read(store)
    const frontier = inspectSfProductRestoreFrontier(current)
    if (!frontier) throw new Error("Expected the real product frontier")
    // Registry publication remains an independent controlled observer in this fixture,
    // outside both the installation and the checkpoint; the HTTP route cannot pin.
    control.exec("CREATE TABLE recovery_pins (installation_digest TEXT, partition_digest TEXT, generation INTEGER, checkpoint_digest TEXT, frontier_digest TEXT, archive_digest TEXT) STRICT")
    control.query("INSERT INTO recovery_pins VALUES (?, ?, ?, ?, ?, ?)").run(
      installationDigest, partition, 1, digestSfValue(loaded.snapshot), digestSfValue(frontier),
      digestSfValue({ checkpointId: archive.id, manifest: archive.manifest }),
    )
    const register = await openCorporateRecoveryRegister(registerFile, directory, process.getuid?.())
    const verification: { calls: number; before: (call: number) => Promise<void> } = {
      calls: 0, before: async () => {},
    }
    const fixtureConfig = { ...config, enabledTeamIds: [...bootstrapEnabledTeamIds] }
    const input: Parameters<typeof createCorporateRecoveryHttp>[0] = {
      config: fixtureConfig,
      directory, register, profilePolicy, now: () => new Date(at),
      // This controlled administrator has no Team-directory admission. Recovery
      // still observes its original dedicated identity capability and explicit grant.
      identity: {
        prepare: async () => {},
        observeCorporateRecoveryActor: async (request, group) =>
          group === config.supremeAdminGroupId && request.headers.get("cookie") === "verified-fixture"
            ? { principalId: actor.id, verifyCurrent: async () => {
                await verification.before(++verification.calls)
                return true
              } } : undefined,
      },
    }
    const recovery = createCorporateRecoveryHttp(input)
    const post = (http = recovery) => http(new Request(config.origin + config.mount + "/api/ui/team-profile-migration/recover", {
      method: "POST", headers: { origin: config.origin, "content-type": "application/json", cookie: "verified-fixture" },
      body: JSON.stringify({ teamObjectId, checkpointId: archive.id, expectedVersion: current.versions.dataset?.version ?? 0, confirm: true }),
    }))
    const mutate = async (action: "enable" | "disable" | "remove", id = teamObjectId) => {
      const catalog = await profilePolicy.read()
      const result = await profilePolicy.mutate({
        principal: { tenantId: config.tenantId, principalObjectId: "10000000-0000-4000-8000-000000000006" },
        at: Date.parse(at), authorize: async () => true,
        command: { action, profile: { installationId, tenantId: config.tenantId, teamObjectId: id },
          expectedRevision: catalog.configRevision },
      })
      if (result.status !== "ok" || !result.changed) throw new Error("Expected a real changed Team policy")
    }
    return {
      input, post, mutate, policyStore, profilePolicy, verification, current,
      snapshot: () => read(store),
      readAsset: () => assets.transaction("dashboard", async (_snapshot, blobs) => ({ commit: false, value: await blobs.get(assetKey) })),
      close,
    }
  } catch (error) {
    await close()
    throw error
  }
}
