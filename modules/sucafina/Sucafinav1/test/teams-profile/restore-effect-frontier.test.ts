import { afterEach, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import path from "node:path"
import { roleMap } from "../../runtime/admin.ts"
import { createLocalBackups } from "../../runtime/local-backups.ts"
import { restoreBackup } from "../../runtime/operations.ts"
import { captureSfRestoreRetention } from "../../runtime/restore-effect-frontier.ts"
import { createDecisionCasePort } from "../../product/decisions/case-port.ts"
import { digestSfValue } from "../../product/contracts/canonical.ts"
import { createSfSourcePersistence } from "../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../product/integration/source-projections.ts"
import { enumerateSfSources } from "../../product/integration/source-inventory.ts"
import { initializeAbsentSfProductState, inspectSfProductRestoreFrontier } from "../../product/host-binding/state-provider.ts"
import { object, type Snapshot } from "../../runtime/contract.ts"
import type { BlobTransaction } from "../../runtime/assets.ts"
import { empty } from "../fixture/persistence.ts"
import { other } from "../microsoft-login/oidc-fixture.ts"
import { profileA, profileB } from "./installation-fixture.ts"
import { teamProductFixture } from "./product-fixture.ts"

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const close of cleanups.splice(0).reverse()) await close() })
const payload = {
  objective: "Confirmed case survives an older business checkpoint",
  horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", criteria: ["continuity"], sourceRefs: [],
}
async function fixture() {
  const f = await teamProductFixture({ enabled: [profileA, profileB] })
  cleanups.push(f.close)
  await initializeAbsentSfProductState(f.store, randomUUID)
  const backups = await createLocalBackups(path.join(f.directory, "restore-frontier-backups"))
  const at = new Date(f.provider.clock.value).toISOString()
  const restoration = createSfSourcePersistence({ persistence: f.store, enumerate: enumerateSfSources,
    projectScope: createSfSourceScopeProjector(() => at), createId: randomUUID, purpose: "business-restore" })
  const snapshot = () => f.store.transaction("dashboard", async (current) => ({ commit: false, value: structuredClone(current) }))
  const actor = () => f.store.transaction("dashboard", async (current) => {
    const principal = await f.identity.authenticate(f.businessRequest(), { surface: "dashboard", roleMap: roleMap(current, "dashboard") })
    const roles = principal?.roles.filter((row) => row.surface === "dashboard").map((row) => row.role) ?? []
    if (!principal?.canWrite || !roles.includes("admin")) throw new Error("Current signed surface admin required")
    const access = object(object(current.data.access)[principal.id])
    // Match the production application projection of the currently resolved signed principal.
    return { commit: false, value: {
      id: principal.id, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), roles,
      assigned: Array.isArray(access.assigned) ? access.assigned.filter((entry): entry is string => typeof entry === "string") : [],
      domains: Array.isArray(access.domains) ? access.domains.filter((entry): entry is string => typeof entry === "string") : [],
    } }
  })
  return { ...f, backups, at, restoration, snapshot, actor }
}
function port(f: Awaited<ReturnType<typeof fixture>>, authority = f.authority) {
  return createDecisionCasePort({
    state: authority.state, host: authority.host, creationTarget: authority.creationTarget,
    operationIdentity: (context) => context.kind === "ui" ? authority.ui.operationIdentity(context) : undefined,
    authorizeCase: async (value, context) => value.participants.includes(context.binding.principalRef) && await authority.host.revalidate(context),
    verifyScenarioOperations: async (value, context) => !value.alternatives.length && !value.choices.length && await authority.host.revalidate(context),
    evidence: { context: async () => [], recall: async () => [],
      resolve: async () => { throw new Error("No external source requested") },
      emitFromLedger: async () => { throw new Error("No external ledger emission requested") } },
    createId: randomUUID, now: () => f.at,
  })
}
async function draft(f: Awaited<ReturnType<typeof fixture>>, key: string, authority = f.authority, profile = profileA) {
  const request = f.businessRequest(profile, f.cookie, { method: "POST", headers: { "Idempotency-Key": key } })
  const admission = await authority.ui.admit(request, "sf_case_draft", digestSfValue(payload))
  if (admission.status !== "ok") throw new Error("Current private C08 admission required")
  expect(await authority.ui.validate(admission.value, "sf_case_draft", digestSfValue(payload))).toBe(true)
  try { return await port(f, authority).draft(payload, admission.value) }
  finally { authority.ui.finish(admission.value) }
}

test("restore-frontier-01: genuine C08 commit survives checkpoint restore, authority restart and identical retry", async () => {
  const f = await fixture()
  await f.store.transaction("dashboard", async (snapshot) => {
    snapshot.data.restoreProbe = "checkpoint"
    return { commit: true, value: undefined }
  })
  const checkpoint = await f.backups.capture(f.store, "dashboard", f.at)
  const key = randomUUID()
  const original = await draft(f, key)
  expect(original).toMatchObject({ status: "ok" })
  await f.store.transaction("dashboard", async (snapshot) => {
    snapshot.data.restoreProbe = "after-checkpoint"
    snapshot.data.access = { ...object(snapshot.data.access), [other]: { assigned: [], domains: [] } }
    return { commit: true, value: undefined }
  })
  const current = await f.snapshot()
  const frontier = inspectSfProductRestoreFrontier(current)
  expect(frontier?.transactions).toHaveLength(1)
  const actor = await f.actor()
  const restored = await restoreBackup(f.restoration, f.backups.source, "dashboard", checkpoint.id, actor, true,
    current.versions.dataset?.version ?? 0, f.at)
  expect(restored).toEqual({ ok: true })
  const after = await f.snapshot()
  expect(after.data.restoreProbe).toBe("checkpoint")
  expect(after.data.__sfProductV1).toEqual(current.data.__sfProductV1)
  expect(after.data.access).toEqual(current.data.access)
  expect(after.data.roleMap).toEqual(current.data.roleMap)
  expect(inspectSfProductRestoreFrontier(after)).toEqual(frontier)
  const restarted = f.makeAuthority().authority
  expect(await draft(f, key, restarted)).toEqual(original)
  expect(await draft(f, key, restarted, profileB)).toMatchObject({ status: "denied" })
  const retried = await f.snapshot()
  expect(retried.data.__sfProductV1).toEqual(current.data.__sfProductV1)
  expect(Object.keys(object(object(retried.data.__sfProductV1).cases))).toHaveLength(1)
  expect(inspectSfProductRestoreFrontier(retried)?.transactions).toHaveLength(1)
})

test("restore-frontier-02: explicit empty and absent access maps are never imported from an older checkpoint", () => {
  const checkpoint = empty()
  checkpoint.data.roleMap = [{ entra: "old-group", role: "admin" }]
  checkpoint.data.access = { old: { domains: ["all"] } }
  for (const present of [false, true]) {
    const current = empty()
    if (present) { current.data.roleMap = []; current.data.access = {} }
    const restored = structuredClone(checkpoint.data)
    captureSfRestoreRetention(current, checkpoint).apply(restored)
    expect(Object.hasOwn(restored, "roleMap")).toBe(present)
    expect(Object.hasOwn(restored, "access")).toBe(present)
    if (present) { expect(restored.roleMap).toEqual([]); expect(restored.access).toEqual({}) }
  }
})

test("restore-frontier-03: missing post-effect receipt is unknown and cannot be repaired by trusting a backup", async () => {
  const f = await fixture()
  expect((await draft(f, randomUUID())).status).toBe("ok")
  const checkpoint = await f.backups.capture(f.store, "dashboard", f.at)
  // Fault injection models loss of a current receipt. It is not a migrated mapping or an effect proof.
  await f.store.transaction("dashboard", async (snapshot) => {
    object(snapshot.data.__sfProductV1).transactions = {}
    return { commit: true, value: undefined }
  })
  const before = await f.snapshot()
  const actor = await f.actor()
  await expect(restoreBackup(f.restoration, f.backups.source, "dashboard", checkpoint.id, actor, true,
    before.versions.dataset?.version ?? 0, f.at)).rejects.toThrow("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
  expect(await f.snapshot()).toEqual(before)
})

test("restore-frontier-04: a different product incarnation cannot adopt checkpoint effects", async () => {
  const f = await fixture()
  const checkpoint = await f.backups.capture(f.store, "dashboard", f.at)
  await f.store.transaction("dashboard", async (snapshot) => {
    object(snapshot.data.__sfProductV1).incarnation = randomUUID()
    return { commit: true, value: undefined }
  })
  const before = await f.snapshot()
  const actor = await f.actor()
  await expect(restoreBackup(f.restoration, f.backups.source, "dashboard", checkpoint.id, actor, true,
    before.versions.dataset?.version ?? 0, f.at)).rejects.toThrow("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
  expect(await f.snapshot()).toEqual(before)
})

test("restore-frontier-05: retained product effects prevent an unclassified overwrite of a live private blob", async () => {
  const f = await fixture()
  const key = "private-frontier-object"
  await f.store.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => {
    snapshot.data.assets = [{ id: "frontier-asset", key, bytes: 3, kind: "contract", record: "test", name: "proof.bin", type: "application/octet-stream" }]
    await blobs.put(key, new Uint8Array([1, 2, 3]), "application/octet-stream")
    return { commit: true, value: undefined }
  })
  const checkpoint = await f.backups.capture(f.store, "dashboard", f.at)
  expect((await draft(f, randomUUID())).status).toBe("ok")
  await f.store.transaction("dashboard", async (_snapshot: Snapshot, blobs: BlobTransaction) => {
    await blobs.put(key, new Uint8Array([4, 5, 6]), "application/octet-stream")
    return { commit: true, value: undefined }
  })
  const before = await f.snapshot()
  const actor = await f.actor()
  await expect(restoreBackup(f.restoration, f.backups.source, "dashboard", checkpoint.id, actor, true,
    before.versions.dataset?.version ?? 0, f.at)).rejects.toThrow("SF_RESTORE_BLOB_FRONTIER_CONFLICT")
  expect(await f.snapshot()).toEqual(before)
  expect(await f.store.transaction("dashboard", async (_snapshot: Snapshot, blobs: BlobTransaction) => ({
    commit: false, value: Array.from(await blobs.get(key) ?? []),
  }))).toEqual([4, 5, 6])
})
