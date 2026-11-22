import { expect, test } from "bun:test"
import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { digestSfValue } from "../product/contracts/canonical.ts"
import { initializeAbsentSfProductState, inspectSfProductRestoreFrontier } from "../product/host-binding/state-provider.ts"
import type { Snapshot } from "../runtime/contract.ts"
import type { BlobTransaction } from "../runtime/assets.ts"
import { BackupAuthorityError, createLocalBackups } from "../runtime/local-backups.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import { microsoftHttpFixture } from "./fixture/microsoft-http.ts"

const principalId = "33333333-3333-4333-8333-333333333333"
const at = "2026-11-11T00:00:00.000Z"
const route = "/api/ui/team-profile-migration/checkpoint"
type Fixture = Awaited<ReturnType<typeof microsoftHttpFixture>>
type Observation = {
  schema: string; installationDigest: string; partitionDigest: string; teamObjectId: string;
  datasetVersion: number; snapshotDigest: string; frontierDigest: string; productRevision: number;
  policyRevision: string | number; independentApproval: false
}
async function fixture(actions: readonly string[] = ["checkpoint"]) {
  return microsoftHttpFixture({ label: "g10", grants: [{ principalRef: principalId, migrationActions: actions }] })
}
const post = (f: Fixture, cookie: string, target: string, body: unknown, headers: Record<string, string> = {}) =>
  f.request(target, { cookie, origin: f.origin, "content-type": "application/json", ...headers },
    { method: "POST", body: JSON.stringify(body) })
const command = (observation: Observation) => ({
  teamObjectId: observation.teamObjectId, expectedVersion: observation.datasetVersion,
  expectedSnapshotDigest: observation.snapshotDigest, confirm: true,
})
const teamDirectory = (f: Fixture, team: string) => join(f.directory, "business-teams", digestSfValue(f.profile(team)))
const archiveDirectory = (f: Fixture, team: string) => join(f.directory, "backups-teams", digestSfValue(f.profile(team)))
async function seed(f: Fixture, team = f.teamA) {
  const store = await openLocalStore(teamDirectory(f, team))
  try {
    await initializeAbsentSfProductState(store, () => "checkpoint-" + team)
    await store.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => {
      const key = "fixture-attachment-" + team
      const bytes = new TextEncoder().encode("synthetic isolated attachment " + team)
      snapshot.data.marker = team
      snapshot.data.assets = [{ key, bytes: bytes.byteLength }]
      snapshot.versions.dataset = { version: 2, by: f.principalId }
      await blobs.put(key, bytes, "text/plain")
      return { commit: true, value: undefined }
    })
    await store.secrets.put("credential-not-in-checkpoint", new TextEncoder().encode("SYNTHETIC-CREDENTIAL-EXCLUDED"), Date.parse(at) + 86400000)
  } finally { await store.dispose() }
}
async function observe(f: Fixture, cookie: string, team = f.teamA) {
  const response = await post(f, cookie, route + "-observe", { teamObjectId: team })
  expect(response.status).toBe(200)
  expect(response.headers.get("cache-control")).toBe("no-store")
  return await response.json() as Observation
}

test("Microsoft HTTP capture preserves the exact Team snapshot and private blobs without exporting secrets or approving a pin", async () => {
  const f = await fixture()
  try {
    await seed(f)
    await seed(f, f.teamB)
    // The current supreme-group capability is independent of direct Team membership.
    f.state.teams = []
    const cookie = await f.login()
    const before = f.durable()
    const observation = await observe(f, cookie)
    expect(observation).toMatchObject({
      schema: "sf-corporate-checkpoint-observation-v1", teamObjectId: f.teamA, datasetVersion: 2,
      partitionDigest: digestSfValue(f.profile(f.teamA)), productRevision: 0, independentApproval: false,
    })
    const response = await post(f, cookie, route, command(observation))
    expect(response.status).toBe(201)
    const receipt = await response.json() as Observation & {
      checkpointId: string; archiveDigest: string; capturedAt: string; assets: number; bytes: number
    }
    expect(receipt).toMatchObject({
      schema: "sf-corporate-checkpoint-v1", assets: 1, teamObjectId: observation.teamObjectId,
      installationDigest: observation.installationDigest, partitionDigest: observation.partitionDigest,
      policyRevision: observation.policyRevision, datasetVersion: observation.datasetVersion,
      snapshotDigest: observation.snapshotDigest, frontierDigest: observation.frontierDigest, independentApproval: false,
    })
    expect(receipt.checkpointId).toMatch(/^backup-/)
    expect(receipt.bytes).toBeGreaterThan(0)
    const backups = await createLocalBackups(archiveDirectory(f, f.teamA))
    const loaded = await backups.source.load("dashboard", receipt.checkpointId)
    expect(loaded).toBeDefined()
    expect(digestSfValue(loaded!.snapshot)).toBe(observation.snapshotDigest)
    expect(digestSfValue(inspectSfProductRestoreFrontier(loaded!.snapshot))).toBe(observation.frontierDigest)
    expect(receipt.archiveDigest).toBe(digestSfValue({ checkpointId: receipt.checkpointId, manifest: loaded!.manifest }))
    expect(loaded!.snapshot.data.marker).toBe(f.teamA)
    expect(await backups.source.readBlob("dashboard", receipt.checkpointId, "fixture-attachment-" + f.teamA))
      .toEqual(new TextEncoder().encode("synthetic isolated attachment " + f.teamA))
    const payload = await readFile(join(archiveDirectory(f, f.teamA), "dashboard", receipt.checkpointId, "snapshot.json"), "utf8")
    expect(payload).not.toContain("SYNTHETIC-CREDENTIAL-EXCLUDED")
    expect(Object.keys(receipt)).not.toContain("snapshot")
    expect(Object.keys(receipt)).not.toContain("manifest")
    expect(await readdir(join(f.directory, "backups-teams"))).toEqual([observation.partitionDigest])
    expect(f.durable()).toEqual(before)
    const second = await observe(f, cookie, f.teamB)
    expect((await post(f, cookie, route, { ...command(observation), teamObjectId: f.teamB })).status).toBe(409)
    expect((await post(f, cookie, route, command(second))).status).toBe(201)
    expect(f.durable()).toEqual(before)
    expect(f.transport().requests).toBe(f.transport().loopbackPeers)
    expect(f.transport().requests).toBe(f.transport().ingressRequests)
  } finally { await f.close() }
  expect(f.state.cleanupComplete).toBe(true)
})

test("Microsoft checkpoint requires its explicit grant and current group; recover-only authority does not capture or observe", async () => {
  const f = await fixture(["recover"])
  try {
    await seed(f)
    const cookie = await f.login()
    const before = f.durable([f.teamA])
    expect((await post(f, cookie, route + "-observe", { teamObjectId: f.teamA })).status).toBe(403)
    expect((await post(f, cookie, route, { teamObjectId: f.teamA, expectedVersion: 2,
      expectedSnapshotDigest: "a".repeat(64), confirm: true })).status).toBe(403)
    expect(f.durable([f.teamA])).toEqual(before)
    expect(await readdir(f.directory)).not.toContain("backups-teams")
  } finally { await f.close() }
})

test("Microsoft checkpoint rejects stale full snapshots, disabled current policy and invalid transport without publishing another archive", async () => {
  const f = await fixture()
  try {
    await seed(f)
    const cookie = await f.login()
    const observed = await observe(f, cookie)
    const body = command(observed)
    expect((await post(f, "", route, body)).status).toBe(403)
    expect((await post(f, cookie, route, body, { origin: "https://foreign.example.test" })).status).toBe(403)
    expect((await post(f, cookie, route + "?extra=1", body)).status).toBe(403)
    expect((await post(f, cookie, route, body, { "sec-fetch-site": "cross-site" })).status).toBe(403)
    expect((await f.request(route, { cookie })).status).toBe(405)
    expect((await post(f, cookie, route, body, { "content-type": "text/plain" })).status).toBe(415)
    expect((await post(f, cookie, route, { ...body, extra: true })).status).toBe(400)
    expect((await post(f, cookie, route, { ...body, teamObjectId: "../foreign" })).status).toBe(400)
    expect((await post(f, cookie, route, { ...body, teamObjectId: f.disabledTeam })).status).toBe(403)
    expect((await post(f, cookie, route + "-observe", { teamObjectId: f.teamB })).status).toBe(404)
    expect(await Bun.file(join(teamDirectory(f, f.teamB), "installation.sqlite")).exists()).toBe(false)
    expect((await post(f, cookie, route, { ...body, expectedVersion: 1 })).status).toBe(409)
    const store = await openLocalStore(teamDirectory(f, f.teamA))
    try {
      await store.transaction("dashboard", async (snapshot) => {
        snapshot.data.marker = "changed-without-dataset-version"
        return { commit: true, value: undefined }
      })
    } finally { await store.dispose() }
    expect((await post(f, cookie, route, body)).status).toBe(409)
    const fresh = await observe(f, cookie)
    expect(fresh.datasetVersion).toBe(observed.datasetVersion)
    expect(fresh.snapshotDigest).not.toBe(observed.snapshotDigest)
    f.state.administrator = false
    expect((await post(f, cookie, route, command(fresh))).status).toBe(403)
    f.state.administrator = true
    const query = new URLSearchParams({ contractRevision: "sf-team-profile/1", installationId: f.installationId, tenantId: f.tenantId })
    const catalogResponse = await f.request("/api/ui/team-profiles?" + query, { cookie })
    expect(catalogResponse.status).toBe(200)
    const catalog = await catalogResponse.json() as { configRevision: string | number }
    expect((await post(f, cookie, "/api/ui/team-profiles?" + query, {
      profile: f.profile(f.teamA), action: "disable", expectedRevision: catalog.configRevision,
    })).status).toBe(200)
    expect((await post(f, cookie, route + "-observe", { teamObjectId: f.teamA })).status).toBe(403)
    expect((await post(f, cookie, route, command(fresh))).status).toBe(403)
    expect(await readdir(f.directory)).not.toContain("backups-teams")
  } finally { await f.close() }
})

test("a revoked authority at the real filesystem publication boundary removes staging and preserves the source", async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), "sf-checkpoint-revocation-"))
  const store = await openLocalStore(join(root, "business"))
  const state = { allowed: true, observations: 0 }
  try {
    await initializeAbsentSfProductState(store, () => "publication-fixture")
    const before = await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const backups = await createLocalBackups(join(root, "backups"), { io: {
      async beforeDurableWrite(file) { if (basename(file) === "manifest.json") state.allowed = false },
    } })
    await expect(backups.capture(store, "dashboard", at, "daily", {
      verifyCurrent: async () => { state.observations++; return state.allowed },
      retainExisting: true,
    })).rejects.toBeInstanceOf(BackupAuthorityError)
    expect(state.observations).toBe(2)
    expect(await backups.list("dashboard")).toEqual([])
    expect(await readdir(join(root, "backups", "dashboard"))).toEqual([])
    expect(await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))).toEqual(before)
  } finally {
    await store.dispose()
    await rm(root, { recursive: true, force: true })
  }
})

test("corporate capture retains older observer checkpoints and verifies a detached snapshot copy", async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), "sf-checkpoint-retention-"))
  const store = await openLocalStore(join(root, "business"))
  try {
    await initializeAbsentSfProductState(store, () => "retention-fixture")
    const backups = await createLocalBackups(join(root, "backups"))
    const older = await backups.capture(store, "dashboard", "2025-01-01T00:00:00.000Z")
    const captured = await backups.capture(store, "dashboard", at, "daily", {
      verifyCurrent: async () => true, retainExisting: true,
      verifySnapshot(snapshot) { (snapshot as Snapshot).data.untrustedMutation = true },
    })
    expect((await backups.list("dashboard")).map((entry) => entry.id).toSorted()).toEqual([older.id, captured.id].toSorted())
    expect((await backups.source.load("dashboard", captured.id))?.snapshot.data.untrustedMutation).toBeUndefined()
    expect(await backups.source.load("dashboard", older.id)).toBeDefined()
  } finally {
    await store.dispose()
    await rm(root, { recursive: true, force: true })
  }
})

async function changePrivateConfiguration(f: Fixture, changes: Readonly<Record<string, unknown>>) {
  const file = join(f.directory, "installation.json")
  const value: unknown = JSON.parse(await readFile(file, "utf8"))
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected private installation object")
  await writeFile(file, JSON.stringify({ ...value, ...changes }), { mode: 0o600 })
}

test.each(["removed", "recover-only", "duplicate", "group"] as const)(
  "Microsoft checkpoint reads the private authority after startup: %s",
  async (change) => {
    const f = await fixture()
    try {
      await seed(f)
      const cookie = await f.login()
      const observation = await observe(f, cookie)
      const before = f.durable([f.teamA])
      const grant = { principalRef: f.principalId, migrationActions: ["checkpoint"] }
      await changePrivateConfiguration(f, change === "group"
        ? { supremeAdminGroupId: f.teamB }
        : { grants: change === "removed" ? [] : change === "duplicate" ? [grant, grant]
          : [{ principalRef: f.principalId, migrationActions: ["recover"] }] })
      expect((await post(f, cookie, route + "-observe", { teamObjectId: f.teamA })).status).toBe(403)
      expect((await post(f, cookie, route, command(observation))).status).toBe(403)
      expect(f.durable([f.teamA])).toEqual(before)
      expect(await readdir(f.directory)).not.toContain("backups-teams")
    } finally { await f.close() }
  },
)

test.each(["grant", "group"] as const)(
  "Microsoft checkpoint cancels a staged archive when the private %s changes before publication",
  async (change) => {
    const f = await fixture()
    try {
      await seed(f)
      const cookie = await f.login()
      const observation = await observe(f, cookie)
      const before = f.durable([f.teamA])
      const parent = join(archiveDirectory(f, f.teamA), "dashboard")
      let revokedAtStaging = false
      f.state.beforeGraphRequest = async (url) => {
        if (revokedAtStaging || url.pathname !== "/v1.0/me/checkMemberGroups") return
        const entries = await readdir(parent).catch((error: unknown) => {
          if (error instanceof Error && "code" in error && error.code === "ENOENT") return []
          throw error
        })
        const stage = entries.find((entry) => entry.startsWith(".stage-"))
        if (!stage || !await Bun.file(join(parent, stage, "manifest.json")).exists()) return
        await changePrivateConfiguration(f, change === "grant" ? { grants: [] } : { supremeAdminGroupId: f.teamB })
        revokedAtStaging = true
      }
      expect((await post(f, cookie, route, command(observation))).status).toBe(403)
      expect(revokedAtStaging).toBe(true)
      expect(await readdir(parent)).toEqual([])
      expect(f.durable([f.teamA])).toEqual(before)
      const backups = await createLocalBackups(archiveDirectory(f, f.teamA))
      expect(await backups.list("dashboard")).toEqual([])
    } finally { await f.close() }
  },
)

test("Microsoft checkpoint never falls back to startup grants when the private file becomes invalid", async () => {
  const f = await fixture()
  try {
    await seed(f)
    const cookie = await f.login()
    const observation = await observe(f, cookie)
    const before = f.durable([f.teamA])
    await writeFile(join(f.directory, "installation.json"), "{}", { mode: 0o600 })
    expect((await post(f, cookie, route, command(observation))).status).toBe(503)
    expect(f.durable([f.teamA])).toEqual(before)
    expect(await readdir(f.directory)).not.toContain("backups-teams")
  } finally { await f.close() }
})
