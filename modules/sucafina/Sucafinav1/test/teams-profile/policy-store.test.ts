import { afterEach, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { openLocalStore } from "../../runtime/local-store.ts"
import { teamProfilePolicyCommand, teamProfilePrincipal } from "../../runtime/team-profile-policy.ts"
import type { LocalStore } from "../../runtime/local-contract.ts"
import { oid, other, tenant } from "../microsoft-login/oidc-fixture.ts"
import { barrier, installationId, profileA, profileB } from "./installation-fixture.ts"

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const close of cleanups.splice(0)) await close() })
const principal = teamProfilePrincipal({ tenantId: tenant, principalObjectId: oid })
const command = (action: "enable" | "disable" | "remove", expectedRevision: number, profile = profileA) => {
  const result = teamProfilePolicyCommand({ action, expectedRevision, profile })
  if (!result) throw new Error("Valid policy intent required")
  return result
}

async function fixture() {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-team-policy-"))
  const stores: LocalStore[] = []
  const open = async (binding = { installationId, tenantId: tenant }) => {
    const store = await openLocalStore(directory, { teamProfiles: binding })
    stores.push(store)
    if (!store.teamProfiles) throw new Error("Team profile policy unavailable")
    return { store, policy: store.teamProfiles }
  }
  cleanups.push(async () => { for (const store of stores.toReversed()) await store.dispose(); await rm(directory, { recursive: true, force: true }) })
  return { directory, open, ...await open() }
}

test("profile store is explicit, starts empty and pins full installation plus resource tenant", async () => {
  const f = await fixture()
  expect(await f.policy.read()).toEqual({ configRevision: 0, profiles: [] })
  expect(await f.policy.audit()).toEqual([])
  await expect(f.open({ installationId: "another-installation", tenantId: tenant })).rejects.toThrow("binding")
  await expect(f.open({ installationId, tenantId: other })).rejects.toThrow("binding")
  expect(await f.policy.read()).toEqual({ configRevision: 0, profiles: [] })
  const retained = await openLocalStore(f.directory)
  try { expect(retained.teamProfiles).toBeUndefined() } finally { await retained.dispose() }
})

test("enable, disable and remove commit one monotonic revision and one verified-principal audit atomically", async () => {
  const f = await fixture()
  for (const [index, action] of (["enable", "disable", "enable", "remove"] as const).entries()) {
    expect(await f.policy.mutate({ command: command(action, index), principal, at: 1000 + index, authorize: async () => true }))
      .toEqual({ status: "ok", configRevision: index + 1, changed: true })
    expect((await f.policy.read()).configRevision).toBe(index + 1)
  }
  expect((await f.policy.read()).profiles).toEqual([])
  const audit = await f.policy.audit()
  expect(audit.map((entry) => entry.configRevision)).toEqual([1, 2, 3, 4])
  expect(audit.map((entry) => entry.action)).toEqual(["enable", "disable", "enable", "remove"])
  expect(audit.every((entry) => entry.principal.principalObjectId === oid && entry.principal.tenantId === tenant && entry.profile.teamObjectId === profileA.teamObjectId)).toBe(true)
  await f.store.dispose()
  const reopened = await f.open()
  expect(await reopened.policy.read()).toEqual({ configRevision: 4, profiles: [] })
  expect(await reopened.policy.audit()).toEqual(audit)
  expect(await reopened.policy.mutate({ command: command("enable", 4), principal, at: 1004, authorize: async () => true }))
    .toEqual({ status: "ok", configRevision: 5, changed: true })
})

test("idempotent state and failed CAS do not duplicate policy or audit", async () => {
  const f = await fixture()
  expect(await f.policy.mutate({ command: command("enable", 0), principal, at: 1, authorize: async () => true })).toMatchObject({ status: "ok", configRevision: 1 })
  expect(await f.policy.mutate({ command: command("enable", 1), principal, at: 2, authorize: async () => true })).toEqual({ status: "ok", configRevision: 1, changed: false })
  expect(await f.policy.mutate({ command: command("disable", 0), principal, at: 3, authorize: async () => true })).toEqual({ status: "conflict", configRevision: 1 })
  expect(await f.policy.mutate({ command: command("remove", 1, profileB), principal, at: 4, authorize: async () => true })).toEqual({ status: "not-found" })
  expect(await f.policy.read()).toEqual({ configRevision: 1, profiles: [{ profile: profileA, enabled: true }] })
  expect(await f.policy.audit()).toHaveLength(1)
})

test("concurrent first-profile edits from two open stores have one CAS winner", async () => {
  const f = await fixture()
  const second = await f.open()
  const results = await Promise.all([
    f.policy.mutate({ command: command("enable", 0), principal, at: 1, authorize: async () => true }),
    second.policy.mutate({ command: command("enable", 0, profileB), principal, at: 2, authorize: async () => true }),
  ])
  expect(results.filter((result) => result.status === "ok")).toHaveLength(1)
  expect(results.filter((result) => result.status === "conflict")).toHaveLength(1)
  expect((await f.policy.read()).configRevision).toBe(1)
  expect((await second.policy.read()).profiles).toHaveLength(1)
  expect(await f.policy.audit()).toHaveLength(1)
})

test("a denied or aborted proof leaves no profile row, revision or audit", async () => {
  const f = await fixture()
  expect(await f.policy.mutate({ command: command("enable", 0), principal, at: 1, authorize: async () => false })).toEqual({ status: "denied" })
  const controller = new AbortController()
  await expect(f.policy.mutate({ command: command("enable", 0), principal, at: 1, signal: controller.signal, authorize: async () => { controller.abort(); return true } })).rejects.toThrow()
  await expect(f.policy.mutate({ command: command("enable", 0), principal, at: 1, authorize: async () => { throw new Error("proof unavailable") } })).rejects.toThrow("proof unavailable")
  expect(await f.policy.read()).toEqual({ configRevision: 0, profiles: [] })
  expect(await f.policy.audit()).toEqual([])
})

test("queued mutations recheck the proof after the prior write completes", async () => {
  const f = await fixture()
  const gate = barrier()
  const allowed = { value: true }
  const first = f.policy.mutate({ command: command("enable", 0), principal, at: 1, authorize: async () => { await gate.hold(); return true } })
  await gate.entered
  const next = f.policy.mutate({ command: command("enable", 1, profileB), principal, at: 2, authorize: async () => allowed.value })
  allowed.value = false
  gate.release()
  expect((await first).status).toBe("ok")
  expect(await next).toEqual({ status: "denied" })
  expect(await f.policy.read()).toEqual({ configRevision: 1, profiles: [{ profile: profileA, enabled: true }] })
  expect(await f.policy.audit()).toHaveLength(1)
})

test("business snapshot replacement cannot restore an older Team policy revision", async () => {
  const f = await fixture()
  const before = await f.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
  await f.policy.mutate({ command: command("enable", 0), principal, at: 1, authorize: async () => true })
  await f.policy.mutate({ command: command("disable", 1), principal, at: 2, authorize: async () => true })
  await f.store.transaction("dashboard", async (snapshot) => { Object.assign(snapshot, before); return { commit: true, value: undefined } })
  expect(await f.policy.read()).toEqual({ configRevision: 2, profiles: [{ profile: profileA, enabled: false }] })
  expect(await f.policy.audit()).toHaveLength(2)
})

test("policy reads observe the current commit while another SQLite reader retains an older snapshot", async () => {
  const f = await fixture()
  const second = await f.open()
  const reader = new Database(path.join(f.directory, "installation.sqlite"), { strict: true })
  try {
    reader.exec("BEGIN")
    expect(reader.query<{ config_revision: number }, []>("SELECT config_revision FROM sf_team_profile_policy WHERE id = 1").get()?.config_revision).toBe(0)
    await second.policy.mutate({ command: command("enable", 0), principal, at: 1, authorize: async () => true })
    expect(reader.query<{ config_revision: number }, []>("SELECT config_revision FROM sf_team_profile_policy WHERE id = 1").get()?.config_revision).toBe(0)
    expect((await f.policy.read()).configRevision).toBe(1)
  } finally {
    if (reader.inTransaction) reader.exec("ROLLBACK")
    reader.close()
  }
})

test("a nested policy write poisons the business transaction and cannot be hidden", async () => {
  const f = await fixture()
  await expect(f.store.transaction("dashboard", async (snapshot) => {
    snapshot.data.value = "must not commit"
    await f.policy.mutate({ command: command("enable", 0), principal, at: 1, authorize: async () => true }).catch(() => undefined)
    return { commit: true, value: true }
  })).rejects.toThrow("Nested local write")
  expect(await f.policy.read()).toEqual({ configRevision: 0, profiles: [] })
  expect(await f.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.data.value }))).toBeUndefined()
})

test("foreign actors, mutated intents and serialized unknown fields cannot retarget storage", async () => {
  const f = await fixture()
  expect(() => f.policy.mutate({ command: command("enable", 0), principal: teamProfilePrincipal({ tenantId: other, principalObjectId: oid }), at: 1, authorize: async () => true })).toThrow()
  for (const value of [
    { ...command("enable", 0), expectedRevision: "0" },
    { ...command("enable", 0), expectedRevision: -1 },
    { ...command("enable", 0), expectedRevision: Number.MAX_SAFE_INTEGER + 1 },
    { ...command("enable", 0), principal },
    { ...command("enable", 0), profile: { ...profileA, teamObjectId: "Finance" } },
  ]) expect(teamProfilePolicyCommand(value)).toBeUndefined()
  expect(await f.policy.audit()).toEqual([])
})

test("corrupt policy header fails closed instead of resetting a revision", async () => {
  const f = await fixture()
  await f.policy.mutate({ command: command("enable", 0), principal, at: 1, authorize: async () => true })
  const db = new Database(path.join(f.directory, "installation.sqlite"), { strict: true })
  try { db.query("UPDATE sf_team_profile_policy SET config_revision = 0 WHERE id = 1").run() } finally { db.close() }
  await expect(f.policy.read()).rejects.toThrow("revision")
  await expect(f.open()).rejects.toThrow("revision")
})

test("disposed policy capabilities cannot read or mutate the private store", async () => {
  const f = await fixture()
  await f.store.dispose()
  await expect(f.policy.read()).rejects.toThrow("disposed")
  await expect(f.policy.mutate({ command: command("enable", 0), principal, at: 1, authorize: async () => true })).rejects.toThrow("disposed")
})
