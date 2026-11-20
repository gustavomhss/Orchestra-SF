import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import path from "node:path"
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { ConnectionAccess } from "@orchestra/schema/connection-access"
import type { TeamConnectionAccess } from "../../runtime/team-connection-store"
import { teamConnectionKey } from "../../runtime/team-connection-crypto"
import { profileA, profileB, teamProfileFixture, barrier } from "./installation-fixture"
import { oid, other, tenant } from "../microsoft-login/oidc-fixture"

const resource: ConnectionAccess.Resource = { category: "integration", resourceId: "synthetic-provider" }
const key = (id = "primary"): ConnectionAccess.Key => ({ ...resource, id })
const owner = (profile = profileA, principalObjectId = oid) =>
  Schema.decodeUnknownSync(TeamProfile.Owner)({ profile, principal: { tenantId: tenant, principalObjectId } })
const command = (id = "primary", encodedValue = JSON.stringify({ token: "synthetic-personal-secret" })): ConnectionAccess.Write => ({
  key: key(id), label: "Personal connection", expectedRevision: 0, action: "create", encodedValue,
})

/** SQL/crypto boundary proof. Positive admission is exercised separately through the actual Owner/product graph. */
async function fixture() {
  const f = await teamProfileFixture()
  const vault = f.store.teamConnections
  if (!vault) throw new Error("Private connection store required")
  const raw = new Database(path.join(f.directory, "installation.sqlite"), { strict: true })
  const access = async (current = owner(), authorize: TeamConnectionAccess["authorize"] = async () => true): Promise<TeamConnectionAccess> => ({
    owner: current, key: await f.microsoft.readConnectionKey(), authorize,
  })
  const revision = () => raw.query<{ revision: number }, []>("SELECT revision FROM sf_team_connection_header").get()?.revision
  const audit = () => raw.query("SELECT * FROM sf_team_connection_audit ORDER BY sequence").all()
  return { ...f, vault, raw, access, revision, audit, async close() { raw.close(); await f.close() } }
}

test("connection-store-01: encrypted CAS records isolate Team, person and category and survive reopen without sharing values", async () => {
  const f = await fixture()
  try {
    const a = await f.access()
    const created = await f.vault.write(a, command())
    expect(created.metadata).toEqual({ key: key(), label: "Personal connection", revision: 1, state: "active" })
    expect((await f.vault.read(a, key()))?.encodedValue).toBe(command().encodedValue)
    const list = await f.vault.list(a, [resource])
    expect(list).toEqual([created.metadata])
    expect(JSON.stringify(list)).not.toContain("synthetic-personal-secret")
    expect(await f.vault.read(await f.access(owner(profileB)), key())).toBeUndefined()
    expect(await f.vault.read(await f.access(owner(profileA, other)), key())).toBeUndefined()
    await f.vault.write(await f.access(owner(profileB)), command("primary", JSON.stringify({ token: "Team-B-secret" })))
    await f.vault.write(await f.access(owner(profileA, other)), command("primary", JSON.stringify({ token: "Other-person-secret" })))
    const mcp = { category: "mcp", resourceId: resource.resourceId, id: "primary" } as const
    await f.vault.write(a, { ...command(), key: mcp, encodedValue: JSON.stringify({ token: "MCP-secret" }) })
    expect((await f.vault.read(a, key()))?.encodedValue).toBe(command().encodedValue)
    expect((await f.vault.read(a, mcp))?.encodedValue).toBe(JSON.stringify({ token: "MCP-secret" }))
    const physical = JSON.stringify(f.raw.query("SELECT * FROM sf_team_connections").all())
    for (const secret of ["synthetic-personal-secret", "Team-B-secret", "Other-person-secret", "MCP-secret"])
      expect(physical).not.toContain(secret)
    expect(JSON.stringify(f.audit())).not.toContain("secret")
    const reopened = await f.reopen()
    expect(await reopened.store.teamConnections?.read(a, key())).toEqual(created)
    const updated = await f.vault.write(a, { ...command(), expectedRevision: 1, action: "update", label: "Current label" })
    expect(updated.metadata.revision).toBe(2)
    await expect(f.vault.write(a, { ...command(), action: "update", expectedRevision: 1 })).rejects.toThrow("CONFLICT")
    await f.vault.remove(a, { key: key(), expectedRevision: 2 })
    expect(await f.vault.list(a, [resource])).toEqual([])
    expect(await f.vault.read(a, key())).toEqual({ metadata: { ...updated.metadata, revision: 3, state: "removed" } })
    const restored = await f.vault.write(a, { ...command(), expectedRevision: 3 })
    expect(restored.metadata.revision).toBe(4)
  } finally { await f.close() }
})

test("connection-store-02: owner, selectors, plaintext and key bytes are copied before the authority await", async () => {
  const f = await fixture()
  const pause = barrier()
  try {
    const selectedOwner = { profile: { ...profileA }, principal: { tenantId: owner().principal.tenantId, principalObjectId: owner().principal.principalObjectId } }
    const originalKey = await f.microsoft.readConnectionKey()
    const mutableKey = { version: originalKey.version, bytes: new Uint8Array(originalKey.bytes) }
    const selected = { ...command(), key: { ...key() } }
    const requested: ConnectionAccess.Resource[][] = []
    const writing = f.vault.write({ owner: selectedOwner, key: mutableKey, authorize: async (action, resources) => {
      expect(action).toBe("create")
      requested.push(resources.map((item) => ({ ...item })))
      await pause.hold()
      return true
    } }, selected)
    await pause.entered
    selectedOwner.profile.teamObjectId = profileB.teamObjectId
    selected.key.resourceId = "changed-provider"
    selected.label = "Changed label"
    selected.encodedValue = JSON.stringify({ token: "changed-secret" })
    mutableKey.bytes.fill(0)
    pause.release()
    const created = await writing
    expect(created.metadata.key).toEqual(key())
    expect(created.metadata.label).toBe("Personal connection")
    expect(requested).toEqual([[resource]])
    expect((await f.vault.read(await f.access(), key()))?.encodedValue).toBe(command().encodedValue)
    expect(await f.vault.read(await f.access(owner(profileB)), key())).toBeUndefined()
  } finally { pause.release(); await f.close() }
})

test("connection-store-03: denied or aborted authorization cannot pin a key, advance revision or write audit", async () => {
  const f = await fixture()
  const abort = new AbortController()
  try {
    await expect(f.vault.write(await f.access(owner(), async () => false), command())).rejects.toThrow("FORBIDDEN")
    const stopped = await f.access(owner(), async () => { abort.abort(); return true })
    await expect(f.vault.write({ ...stopped, signal: abort.signal }, command())).rejects.toThrow()
    expect(f.revision()).toBe(0)
    expect(f.audit()).toEqual([])
    expect(f.raw.query("SELECT * FROM sf_team_connections").all()).toEqual([])
    expect(f.raw.query("SELECT key_fingerprint FROM sf_team_connection_header").get()).toEqual({ key_fingerprint: null })
  } finally { await f.close() }
})

test("connection-store-04: failing audit INSERT rolls back ciphertext, CAS header and fingerprint together", async () => {
  const f = await fixture()
  try {
    const a = await f.access()
    f.raw.exec("CREATE TRIGGER synthetic_vault_audit_failure BEFORE INSERT ON sf_team_connection_audit BEGIN SELECT RAISE(ABORT, 'synthetic audit failure'); END")
    await expect(f.vault.write(a, command())).rejects.toThrow("synthetic audit failure")
    expect(f.revision()).toBe(0)
    expect(f.audit()).toEqual([])
    expect(f.raw.query("SELECT * FROM sf_team_connections").all()).toEqual([])
    expect(f.raw.query("SELECT key_fingerprint FROM sf_team_connection_header").get()).toEqual({ key_fingerprint: null })
    f.raw.exec("DROP TRIGGER synthetic_vault_audit_failure")
    expect((await f.vault.write(a, command())).metadata.revision).toBe(1)
    expect(f.revision()).toBe(1)
  } finally { await f.close() }
})

test("connection-store-05: row rewind and an interior audit gap are denied while a complete current record still reads", async () => {
  const f = await fixture()
  type Saved = { revision: number; state: string; label: string; key_version: number; ciphertext: string; digest: string }
  const read = () => f.raw.query<Saved, []>("SELECT revision,state,label,key_version,ciphertext,digest FROM sf_team_connections WHERE connection_id='a'").get()
  const restore = (row: Saved) => f.raw.query("UPDATE sf_team_connections SET revision=?,state=?,label=?,key_version=?,ciphertext=?,digest=? WHERE connection_id='a'")
    .run(row.revision, row.state, row.label, row.key_version, row.ciphertext, row.digest)
  try {
    const a = await f.access()
    await f.vault.write(a, command("a"))
    const first = read()
    if (!first) throw new Error("A1 required")
    await f.vault.write(a, { ...command("a", JSON.stringify({ token: "A2" })), action: "update", expectedRevision: 1 })
    const current = read()
    if (!current) throw new Error("A2 required")
    const audit = f.raw.query<{ sequence: number; team_object_id: string; principal_object_id: string; category: string; resource_id: string; connection_id: string; revision: number; action: string; digest: string }, []>(
      "SELECT * FROM sf_team_connection_audit WHERE sequence=2").get()
    if (!audit) throw new Error("A2 audit required")
    await f.vault.write(a, command("b", JSON.stringify({ token: "B3" })))
    restore(first)
    await expect(f.vault.read(a, key("a"))).rejects.toThrow("UNAVAILABLE")
    f.raw.exec("DELETE FROM sf_team_connection_audit WHERE sequence=2")
    expect(f.raw.query("SELECT MAX(sequence) AS maximum,COUNT(*) AS count FROM sf_team_connection_audit").get()).toEqual({ maximum: 3, count: 2 })
    expect(f.revision()).toBe(3)
    await expect(f.vault.read(a, key("a"))).rejects.toThrow("UNAVAILABLE")
    await expect(f.vault.list(a, [resource])).rejects.toThrow("UNAVAILABLE")
    f.raw.query("INSERT INTO sf_team_connection_audit(sequence,team_object_id,principal_object_id,category,resource_id,connection_id,revision,action,digest) VALUES(?,?,?,?,?,?,?,?,?)")
      .run(audit.sequence,audit.team_object_id,audit.principal_object_id,audit.category,audit.resource_id,audit.connection_id,audit.revision,audit.action,audit.digest)
    restore(current)
    expect((await f.vault.read(a, key("a")))?.encodedValue).toBe(JSON.stringify({ token: "A2" }))
    f.raw.exec("DELETE FROM sf_team_connections WHERE connection_id='a'")
    await expect(f.vault.read(a, key("a"))).rejects.toThrow("UNAVAILABLE")
  } finally { await f.close() }
})

test("connection-store-06: key rotation, changed AAD and missing private table fail closed without rewriting the legacy store", async () => {
  const f = await fixture()
  try {
    const a = await f.access()
    await f.vault.write(a, command())
    const before = f.audit()
    await expect(f.vault.read({ ...a, key: teamConnectionKey(new Uint8Array(32).fill(97)) }, key())).rejects.toThrow("UNAVAILABLE")
    f.raw.exec("UPDATE sf_team_connections SET label='forged'")
    await expect(f.vault.read(a, key())).rejects.toThrow("UNAVAILABLE")
    expect(f.audit()).toEqual(before)
    f.raw.exec("DROP TABLE sf_team_connection_audit")
    await expect(f.reopen()).rejects.toThrow("UNAVAILABLE")
    expect(f.raw.query("SELECT ciphertext FROM sf_team_connections").all()).toHaveLength(1)
  } finally { await f.close() }
})

test("connection-store-07: AAD canonicalizes reordered owner and key properties before both encryption and decryption", async () => {
  const f = await fixture()
  try {
    const original = owner()
    const reordered = Schema.decodeUnknownSync(TeamProfile.Owner)({
      principal: { principalObjectId: original.principal.principalObjectId, tenantId: original.principal.tenantId },
      profile: { teamObjectId: original.profile.teamObjectId, tenantId: original.profile.tenantId, installationId: original.profile.installationId },
    })
    const selected: ConnectionAccess.Key = { id: "primary", resourceId: resource.resourceId, category: resource.category }
    const created = await f.vault.write(await f.access(reordered), { ...command(), key: selected })
    expect(await f.vault.read(await f.access(original), key())).toEqual(created)
    expect(await f.vault.read(await f.access(reordered), selected)).toEqual(created)
  } finally { await f.close() }
})

test("connection-store-08: final authority reads use all three current snapshots and caught writes or unfinished readers abort the vault CAS", async () => {
  const f = await fixture()
  const pending = barrier()
  let detached: Promise<unknown> | undefined
  try {
    for (const surface of ["dashboard", "planner", "procurement"] as const) {
      await f.store.transaction(surface, async (snapshot) => {
        snapshot.data.access = { [oid]: { assigned: [surface], domains: ["finance"] } }
        return { commit: true, value: undefined }
      })
    }
    const checked: string[] = []
    const realReads = await f.access(owner(), async () => {
      for (const surface of ["dashboard", "planner", "procurement"] as const) {
        const snapshot = await f.store.transaction(surface, async (value) => ({ commit: false, value }))
        expect(snapshot.data.access).toEqual({ [oid]: { assigned: [surface], domains: ["finance"] } })
        checked.push(surface)
      }
      return true
    })
    await f.vault.write(realReads, command())
    expect(checked).toEqual(["dashboard", "planner", "procurement"])
    const before = f.audit()
    const poisoned = await f.access(owner(), async () => {
      await f.store.transaction("dashboard", async (snapshot) => {
        snapshot.data.access = {}
        return { commit: true, value: undefined }
      }).catch(() => undefined)
      return true
    })
    await expect(f.vault.write(poisoned, command("poisoned"))).rejects.toThrow("Nested local write")
    expect(f.audit()).toEqual(before)
    const loose = await f.access(owner(), async () => {
      detached = f.store.transaction("dashboard", async () => {
        await pending.hold()
        return { commit: false, value: true }
      })
      // A rejection handler is attached immediately; the closed scope is still required to reject.
      void detached.catch(() => undefined)
      await pending.entered
      return true
    })
    await expect(f.vault.write(loose, command("detached"))).rejects.toThrow("Nested local read still active")
    pending.release()
    await expect(detached).rejects.toThrow()
    expect(f.audit()).toEqual(before)
    expect(f.revision()).toBe(1)
  } finally { pending.release(); await detached?.catch(() => undefined); await f.close() }
})

test("connection-store-09: metadata inspection retains absence and tombstone CAS without returning plaintext", async () => {
  const f = await fixture()
  try {
    const access = await f.access()
    expect(await f.vault.inspect(access, key())).toBeUndefined()
    const created = await f.vault.write(access, command())
    const metadata = await f.vault.inspect(access, key())
    expect(metadata).toEqual(created.metadata)
    expect(JSON.stringify(metadata)).not.toContain("synthetic-personal-secret")
    expect(Object.keys(metadata ?? {}).toSorted()).toEqual(["key", "label", "revision", "state"])
    await f.vault.remove(access, { key: key(), expectedRevision: 1 })
    expect(await f.vault.inspect(access, key())).toEqual({
      key: key(), label: "Personal connection", revision: 2, state: "removed",
    })
    await expect(f.vault.write(access, command())).rejects.toThrow("CONFLICT")
    await expect(f.vault.write(access, { ...command(), action: "update", expectedRevision: 2 })).rejects.toThrow("CONFLICT")
    const recreated = await f.vault.write(access, { ...command(), expectedRevision: 2 })
    expect(recreated.metadata.revision).toBe(3)
    expect((await f.vault.inspect(access, key()))?.revision).toBe(3)
    expect(await f.vault.inspect(await f.access(owner(profileB)), key())).toBeUndefined()
    expect(await f.vault.inspect(await f.access(owner(profileA, other)), key())).toBeUndefined()
    await expect(f.vault.inspect(await f.access(owner(), async () => false), key())).rejects.toThrow("FORBIDDEN")
    const stored = f.raw.query("SELECT * FROM sf_team_connections").get()
    f.raw.query("DELETE FROM sf_team_connections").run()
    await expect(f.vault.inspect(access, key())).rejects.toThrow("UNAVAILABLE")
    expect(stored).toBeDefined()
  } finally { await f.close() }
})
