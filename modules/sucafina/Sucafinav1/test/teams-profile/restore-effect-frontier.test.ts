import { afterEach, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { randomUUID } from "node:crypto"
import path from "node:path"
import { roleMap } from "../../runtime/admin.ts"
import { createLocalBackups } from "../../runtime/local-backups.ts"
import { openLocalStore } from "../../runtime/local-store.ts"
import { restoreBackup } from "../../runtime/operations.ts"
import { captureSfCorporateRestoreRetention, captureSfRestoreRetention } from "../../runtime/restore-effect-frontier.ts"
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
// Synthetic pin for comparison tests only; this is not an independent authority.
function admission(checkpoint: Snapshot, frontier: NonNullable<ReturnType<typeof inspectSfProductRestoreFrontier>>) {
  const installationDigest = digestSfValue("test-installation")
  return { installationDigest, generation: 1, pin: { installationDigest, generation: 1,
    checkpointDigest: digestSfValue(checkpoint), frontierDigest: digestSfValue(frontier) } }
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

test("restore-frontier-06: a current pinned frontier passes, but rewinding local state fails against retained effects", async () => {
  const f = await fixture()
  const checkpoint = await f.snapshot()
  expect((await draft(f, randomUUID())).status).toBe("ok")
  const externallyRetained = inspectSfProductRestoreFrontier(await f.snapshot())
  if (!externallyRetained) throw new Error("Expected a retained product frontier")
  expect(externallyRetained.transactions).toHaveLength(1)
  expect((await draft(f, randomUUID())).status).toBe("ok")
  const current = await f.snapshot()
  const frontier = inspectSfProductRestoreFrontier(current)
  expect(frontier?.revision).toBeGreaterThan(externallyRetained.revision)
  expect(frontier?.transactions).toHaveLength(2)
  const restored = { ...checkpoint, data: structuredClone(checkpoint.data) }
  if (!frontier) throw new Error("Expected current frontier")
  captureSfCorporateRestoreRetention(current, checkpoint, frontier, admission(checkpoint, frontier)).apply(restored.data)
  expect(inspectSfProductRestoreFrontier(restored)).toEqual(frontier)
  expect(await f.snapshot()).toEqual(current)

  // Simulate a durable product rewind while the independently held evidence stays fixed.
  await f.store.transaction("dashboard", async (snapshot) => {
    snapshot.data.__sfProductV1 = structuredClone(checkpoint.data.__sfProductV1)
    return { commit: true, value: undefined }
  })
  const rewound = await f.snapshot()
  expect(inspectSfProductRestoreFrontier(rewound)).toEqual(inspectSfProductRestoreFrontier(checkpoint))
  expect(() => captureSfRestoreRetention(rewound, checkpoint)).not.toThrow()
  expect(() => captureSfCorporateRestoreRetention(rewound, checkpoint, externallyRetained, admission(checkpoint, externallyRetained)))
    .toThrow("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
  expect(await f.snapshot()).toEqual(rewound)
})

test("restore-frontier-07: corporate preflight requires all three explicit frontiers from one incarnation", async () => {
  const f = await fixture()
  const current = await f.snapshot()
  const frontier = inspectSfProductRestoreFrontier(current)
  if (!frontier) throw new Error("Expected an explicit product frontier")
  const absent = empty()
  const foreign = structuredClone(current)
  object(foreign.data.__sfProductV1).incarnation = randomUUID()

  expect(() => captureSfCorporateRestoreRetention(current, current, frontier, admission(current, frontier))).not.toThrow()
  expect(() => captureSfCorporateRestoreRetention(current, current, frontier, undefined))
    .toThrow("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
  expect(() => captureSfCorporateRestoreRetention(current, current, undefined, admission(current, frontier)))
    .toThrow("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
  expect(() => captureSfCorporateRestoreRetention(absent, current, frontier, admission(current, frontier)))
    .toThrow("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
  expect(() => captureSfCorporateRestoreRetention(current, absent, frontier, admission(absent, frontier)))
    .toThrow("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
  expect(() => captureSfCorporateRestoreRetention(current, foreign, frontier, admission(foreign, frontier)))
    .toThrow("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
  expect(() => captureSfCorporateRestoreRetention(current, current, inspectSfProductRestoreFrontier(foreign), admission(current, frontier)))
    .toThrow("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
})

test("restore-frontier-08: external evidence and checkpoint must each be dominated by actual current state", async () => {
  const f = await fixture()
  const checkpoint = await f.snapshot()
  expect((await draft(f, randomUUID())).status).toBe("ok")
  const original = await f.snapshot()
  const retained = inspectSfProductRestoreFrontier(original)
  if (!retained) throw new Error("Expected a retained product frontier")
  const faults: ((product: Record<string, unknown>) => void)[] = [
    (product) => { product.revision = retained.revision - 1 },
    (product) => { object(product.versions).cases = retained.versions.cases - 1 },
    (product) => { product.transactions = {} },
    (product) => { object(Object.values(object(product.transactions))[0]).commandDigest = "changed" },
  ]
  for (const damage of faults) {
    await f.store.transaction("dashboard", async (snapshot) => {
      snapshot.data.__sfProductV1 = structuredClone(original.data.__sfProductV1)
      damage(object(snapshot.data.__sfProductV1))
      return { commit: true, value: undefined }
    })
    const current = await f.snapshot()
    const frontier = inspectSfProductRestoreFrontier(current)
    if (!frontier) throw new Error("Expected an explicit but damaged frontier")
    expect(() => captureSfCorporateRestoreRetention(current, checkpoint, retained, admission(checkpoint, retained)))
      .toThrow("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
    expect(() => captureSfCorporateRestoreRetention(current, original, frontier, admission(original, frontier)))
      .toThrow("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
    expect(await f.snapshot()).toEqual(current)
  }
})

test("restore-frontier-09: stale consistent snapshots and retained evidence cannot match a newer independent pin", async () => {
  const f = await fixture()
  const checkpoint = await f.backups.capture(f.store, "dashboard", f.at)
  const archive = await f.backups.source.load("dashboard", checkpoint.id)
  if (!archive) throw new Error("Expected a verified private checkpoint")
  const stale = archive.snapshot
  const staleFrontier = inspectSfProductRestoreFrontier(stale)
  if (!staleFrontier) throw new Error("Expected the original checkpoint frontier")
  expect(staleFrontier.transactions).toHaveLength(0)

  const key = randomUUID()
  // Drop the acknowledgement only after the actual signed producer settles.
  await expect(draft(f, key).then((outcome) => {
    if (outcome.status !== "ok") throw new Error("The real C08 operation did not commit")
    throw new Error("Simulated loss of the committed response")
  })).rejects.toThrow("Simulated loss of the committed response")
  const committed = await f.snapshot()
  const retained = inspectSfProductRestoreFrontier(committed)
  if (!retained) throw new Error("Expected the independently observed committed frontier")
  expect(retained.transactions).toHaveLength(1)
  const cases = Object.keys(object(object(committed.data.__sfProductV1).cases))
  expect(cases).toHaveLength(1)

  // The test controls the issuer and keeps this pin outside either business
  // database and the archive. This exercises comparison, not production trust.
  const control = new Database(":memory:", { strict: true })
  const installationDigest = digestSfValue(f.binding)
  const generation = 2
  try {
    control.exec(`CREATE TABLE restore_pin (
      generation INTEGER PRIMARY KEY, installation_digest TEXT NOT NULL,
      checkpoint_digest TEXT NOT NULL, frontier_digest TEXT NOT NULL
    )`)
    control.query("INSERT INTO restore_pin VALUES (?, ?, ?, ?)").run(
      generation, installationDigest, digestSfValue(stale), digestSfValue(retained),
    )
    const pin = control.query<{
      generation: number; installationDigest: string; checkpointDigest: string; frontierDigest: string
    }, [number]>(`SELECT generation, installation_digest AS installationDigest,
      checkpoint_digest AS checkpointDigest, frontier_digest AS frontierDigest
      FROM restore_pin WHERE generation = ?`).get(generation)
    if (!pin) throw new Error("Expected the independent current restore pin")
    const proof = { installationDigest, generation, pin }

    const rewound = await openLocalStore(path.join(f.directory, "rewound-corporate-business"))
    cleanups.push(rewound.dispose)
    await rewound.transaction("dashboard", async (snapshot) => {
      Object.assign(snapshot, structuredClone(stale))
      return { commit: true, value: undefined }
    })
    await expect(rewound.transaction("dashboard", async (snapshot) => {
      expect(inspectSfProductRestoreFrontier(snapshot)).toEqual(staleFrontier)
      captureSfCorporateRestoreRetention(snapshot, stale, staleFrontier, proof)
      return { commit: false, value: undefined }
    })).rejects.toThrow("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
    expect(await rewound.transaction("dashboard", async (snapshot) => ({
      commit: false, value: structuredClone(snapshot),
    }))).toEqual(stale)

    const reopened = await f.reopen()
    const candidate = await reopened.store.transaction("dashboard", async (snapshot) => {
      const proposed = structuredClone(stale)
      captureSfCorporateRestoreRetention(snapshot, stale, retained, proof).apply(proposed.data)
      return { commit: false, value: proposed }
    })
    expect(inspectSfProductRestoreFrontier(candidate)).toEqual(retained)
    expect(await f.snapshot()).toEqual(committed)
    const restarted = f.makeAuthority(reopened).authority
    expect(await draft(f, key, restarted)).toMatchObject({ status: "ok" })
    expect(await draft(f, key, restarted, profileB)).toMatchObject({ status: "denied" })
    const retried = await f.snapshot()
    expect(inspectSfProductRestoreFrontier(retried)).toEqual(retained)
    expect(Object.keys(object(object(retried.data.__sfProductV1).cases))).toEqual(cases)
  } finally {
    control.close()
  }
})

test("restore-frontier-10: current pin is bound to installation, checkpoint and generation", async () => {
  const f = await fixture(), current = await f.snapshot()
  const frontier = inspectSfProductRestoreFrontier(current)
  if (!frontier) throw new Error("Expected product frontier")
  const proof = admission(current, frontier)
  expect(() => captureSfCorporateRestoreRetention(current, current, frontier, proof)).not.toThrow()
  for (const invalid of [
    { ...proof, installationDigest: digestSfValue("another-installation") },
    { ...proof, generation: 2 },
    { ...proof, generation: 0 },
    { ...proof, pin: { ...proof.pin, checkpointDigest: digestSfValue("another-checkpoint") } },
    { ...proof, pin: { ...proof.pin, frontierDigest: digestSfValue("another-frontier") } },
  ]) expect(() => captureSfCorporateRestoreRetention(current, current, frontier, invalid))
    .toThrow("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
  const changed = structuredClone(current)
  changed.data.restoreProbe = "different checkpoint"
  expect(() => captureSfCorporateRestoreRetention(current, changed, frontier, proof))
    .toThrow("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
})
