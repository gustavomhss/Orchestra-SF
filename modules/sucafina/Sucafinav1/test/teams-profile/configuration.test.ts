import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import path from "node:path"
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { teamProductFixture } from "./product-fixture"
import { profileA, profileB } from "./installation-fixture"
import { oid, other } from "../microsoft-login/oidc-fixture"

const document = (model = "provider/shared"): TeamProfile.ConfigurationDocument => ({
  version: 1, settings: { model, agents: { analyst: { name: "Shared analyst", system: "Current approved guidance", model } } },
})
const configure = async (f: Awaited<ReturnType<typeof teamProductFixture>>, profile = profileA, value = document()) =>
  f.resolver.configureConfiguration(f.request(undefined, f.cookie), {
    profile, expectedRevision: (await f.profiles.read()).configRevision, document: value,
  })

test("team-configuration-01: shared content requires a live opaque membership admission and survives store reopening", async () => {
  const f = await teamProductFixture({ enabled: [profileA, profileB] })
  try {
    expect(await configure(f)).toEqual({ status: "ok", configRevision: 3, changed: true })
    const resolve = (cookie = f.cookie, profile = profileA) => f.resolver.resolve(f.businessRequest(profile, cookie), {
      contractRevision: "sf-team-profile/1", kind: "team", profile,
    })
    const result = await resolve()
    if (result.status !== "authenticated" || !result.admission) throw new Error("Live profile admission required")
    const read = await f.resolver.readConfiguration(result.admission)
    expect(read).toEqual({ origin: "installation-team-store", profile: profileA, configRevision: 3, document: document() })
    expect(Object.isFrozen(read?.document.settings.agents?.analyst)).toBe(true)
    expect(await f.resolver.readConfiguration({ ...result.admission })).toBeUndefined()
    expect(await f.resolver.readConfiguration(JSON.parse(JSON.stringify(result.admission)))).toBeUndefined()
    const second = await resolve(await f.login(other))
    if (second.status !== "authenticated" || !second.admission) throw new Error("Independent second principal admission required")
    expect(await f.resolver.readConfiguration(second.admission)).toEqual(read)
    const otherTeam = await resolve(f.cookie, profileB)
    if (otherTeam.status !== "authenticated" || !otherTeam.admission) throw new Error("Second Team admission required")
    expect(await f.resolver.readConfiguration(otherTeam.admission)).toBeUndefined()
    const reopened = await f.reopen()
    expect(await reopened.profiles.readConfiguration(profileA)).toEqual(read)
    expect(await reopened.resolver.readConfiguration(result.admission)).toBeUndefined()
    f.provider.directTeams.set(oid, [])
    expect(await f.resolver.readConfiguration(result.admission)).toBeUndefined()
  } finally { await f.close() }
})

test("team-configuration-02: disable, remove and a new configuration revision invalidate retained readers without resetting shared state", async () => {
  const f = await teamProductFixture({ enabled: [profileA, profileB] })
  try {
    expect((await configure(f)).status).toBe("ok")
    const current = await f.resolver.resolve(f.businessRequest(), {
      contractRevision: "sf-team-profile/1", kind: "team", profile: profileA,
    })
    if (current.status !== "authenticated" || !current.admission) throw new Error("Live profile admission required")
    expect((await configure(f, profileB, document("provider/second"))).status).toBe("ok")
    expect(await f.resolver.readConfiguration(current.admission)).toBeUndefined()
    for (const action of ["disable", "remove", "enable"] as const) {
      const result = await f.resolver.configure(f.request(undefined, f.cookie), {
        action, profile: profileA, expectedRevision: (await f.profiles.read()).configRevision,
      })
      expect(result.status).toBe("ok")
      expect(await f.resolver.readConfiguration(current.admission)).toBeUndefined()
      if (action === "remove") expect(await f.profiles.readConfiguration(profileA)).toBeUndefined()
    }
    expect((await f.profiles.readConfiguration(profileA))?.document).toEqual(document())
    expect((await f.profiles.read()).configRevision).toBe(7)
  } finally { await f.close() }
})

test("team-configuration-03: an INSERT failure rolls back profile revision and both audit records atomically", async () => {
  const f = await teamProductFixture()
  const db = new Database(path.join(f.directory, "installation.sqlite"), { strict: true })
  try {
    const before = await f.profiles.read()
    const audit = await f.profiles.audit()
    db.exec("CREATE TRIGGER synthetic_configuration_failure BEFORE INSERT ON sf_team_configurations BEGIN SELECT RAISE(ABORT, 'synthetic configuration write failure'); END")
    expect(await configure(f)).toEqual({ status: "unavailable", reason: "store-unavailable" })
    expect(await f.profiles.read()).toEqual(before)
    expect(await f.profiles.audit()).toEqual(audit)
    expect(db.query("SELECT config_revision FROM sf_team_configuration_audit").all()).toEqual([])
    expect(await f.profiles.readConfiguration(profileA)).toBeUndefined()
    db.exec("DROP TRIGGER synthetic_configuration_failure")
    expect(await configure(f)).toEqual({ status: "ok", configRevision: 2, changed: true })
    expect(await f.profiles.audit()).toHaveLength(2)
  } finally { db.close(); await f.close() }
})

test("team-configuration-04: current shared policy stays outside an older business read snapshot", async () => {
  const f = await teamProductFixture()
  try {
    expect((await configure(f)).status).toBe("ok")
    if (!f.store.readSnapshotRoot) throw new Error("Actual business read snapshot required")
    const business = await f.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    await f.store.readSnapshotRoot(async () => {
      await f.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot }))
      const previous = await f.profiles.readConfiguration(profileA)
      expect(previous?.configRevision).toBe(2)
      // A separate connection and resolver observe current authentication/policy, never this business snapshot.
      const reopened = await f.reopen()
      const result = await reopened.resolver.configureConfiguration(f.request(undefined, f.cookie), {
        profile: profileA, expectedRevision: 2, document: document("provider/current"),
      })
      expect(result).toEqual({ status: "ok", configRevision: 3, changed: true })
      expect((await f.profiles.readConfiguration(profileA))?.document).toEqual(document("provider/current"))
      expect((await f.profiles.read()).configRevision).toBe(3)
    })
    expect(await f.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(business)
  } finally { await f.close() }
})

test("team-configuration-05: malformed or unaudited stored content never becomes a runtime source", async () => {
  const f = await teamProductFixture()
  const db = new Database(path.join(f.directory, "installation.sqlite"), { strict: true })
  try {
    expect((await configure(f)).status).toBe("ok")
    const original = db.query<{ document: string; document_digest: string }, []>("SELECT document, document_digest FROM sf_team_configurations").get()
    if (!original) throw new Error("Stored configuration required")
    db.query("UPDATE sf_team_configurations SET document = ?").run('{"version":1,"settings":{"plugins":["unclassified"]}}')
    await expect(f.profiles.readConfiguration(profileA)).rejects.toThrow()
    db.query("UPDATE sf_team_configurations SET document = ?, document_digest = ?").run(original.document, original.document_digest)
    expect(Schema.is(TeamProfile.ConfigurationSnapshot)(await f.profiles.readConfiguration(profileA))).toBe(true)
    db.exec("DELETE FROM sf_team_configuration_audit")
    await expect(f.profiles.readConfiguration(profileA)).rejects.toThrow()
    await expect(f.profiles.audit()).rejects.toThrow()
  } finally { db.close(); await f.close() }
})
