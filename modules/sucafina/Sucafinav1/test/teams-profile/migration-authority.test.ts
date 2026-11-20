import { afterEach, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { TeamProfileCensus } from "@orchestra/core/database/team-profile-census"
import { AuthorityGeneration } from "@orchestra/core/session/authority-generation"
import { openAuthorityControl } from "@orchestra/core/database/sqlite.bun"
import { createTeamProfileMigrationAuthority, type MigrationOperation } from "../../runtime/team-profile-migration-authority.ts"
import { group, oid, tenant } from "../microsoft-login/oidc-fixture.ts"
import { profileA, profileB, teamA, teamRow, teamProfileFixture } from "./installation-fixture.ts"

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const close of cleanups.splice(0).reverse()) await close() })
async function fixture(actions: readonly MigrationOperation[] = []) {
  const f = await teamProfileFixture()
  cleanups.push(f.close)
  const grants = (migrationActions: readonly MigrationOperation[]) => [{ principalRef: oid,
    namespaces: [], operations: [], migrationActions }]
  const policy = (migrationActions: readonly MigrationOperation[]) =>
    writeFile(f.file, JSON.stringify({ ...f.config, grants: grants(migrationActions) }))
  await policy(actions)
  const filename = path.join(f.directory, "legacy-migration.sqlite")
  const database = openAuthorityControl(filename)
  cleanups.push(async () => database.close())
  database.execute("CREATE TABLE session (id TEXT PRIMARY KEY, parent_id TEXT, title TEXT)")
  database.execute("CREATE TABLE event (id TEXT PRIMARY KEY, aggregate_id TEXT, type TEXT, data TEXT)")
  database.execute("INSERT INTO session VALUES ('ses_legacy', NULL, 'PRIVATE-LEGACY-CONTENT')")
  const storageId = AuthorityGeneration.storageID(database, filename)
  const report = TeamProfileCensus.inspect(database, storageId)
  const intent: TeamProfileCensus.Intent = {
    version: 1, storageId, sourceDigest: report.sourceDigest,
    decisions: report.sessions.map((session) => ({ sessionId: session.id, sourceDigest: session.digest,
      disposition: "quarantine", reason: "unresolved-owner", evidenceDigest: "a".repeat(64) })),
    tables: report.tables.map((table) => ({ name: table.name, schemaDigest: table.schemaDigest, disposition: "preserve-current" })),
  }
  const plan = TeamProfileCensus.plan(report, intent)
  const authority = createTeamProfileMigrationAuthority({ origin: f.config.origin,
    installationId: profileA.installationId, tenantId: tenant, resolver: f.resolver, microsoft: f.microsoft })
  const cookie = await f.login()
  const request = () => f.request("/api/ui/team-profile-migration", cookie, { method: "POST", headers: { origin: f.config.origin } })
  const mapped = (profile = profileA) => TeamProfileCensus.plan(report, { ...intent, decisions: report.sessions.map((session) => ({
    sessionId: session.id, sourceDigest: session.digest, disposition: "map",
    owner: Schema.decodeUnknownSync(TeamProfile.Owner)({ profile, principal: { tenantId: tenant, principalObjectId: oid } }),
    evidenceDigest: "b".repeat(64),
  })) })
  return { ...f, database, report, plan, mapped, authority, cookie, request, policy }
}

test("migration administration requires both the real supreme-group proof and an explicit current operation grant", async () => {
  const f = await fixture()
  const request = f.request()
  expect(await f.resolver.resolve(request)).toMatchObject({ status: "authenticated", administration: { status: "available" } })
  expect(await f.authority.admit(request, "map", f.plan)).toBeUndefined()
  await f.policy(["map"])
  expect(await f.authority.admit(request, "cut", f.plan)).toBeUndefined()
  f.provider.account.groups.splice(0)
  expect(await f.authority.admit(request, "map", f.plan)).toBeUndefined()
  expect(TeamProfileCensus.inspect(f.database, f.report.storageId)).toEqual(f.report)
}, 30000)

test("a current administrator with zero Teams can review quarantine metadata but the opaque lease is never serialized authority", async () => {
  const f = await fixture(["map"])
  expect(f.provider.directTeams.get(oid)).toEqual([])
  const lease = await f.authority.admit(f.request(), "map", f.plan)
  expect(lease).toBeDefined()
  expect(await f.authority.verifyCurrent(lease)).toBe(true)
  const audit = await f.authority.auditIdentity(lease)
  expect(audit).toMatchObject({ operation: "map", storageId: f.report.storageId,
    planDigest: f.plan.planDigest, principal: { tenantId: tenant, principalObjectId: oid }, configRevision: 0 })
  expect(await f.authority.verifyCurrent(JSON.parse(JSON.stringify(lease)))).toBe(false)
  expect(await f.resolver.revalidate(audit)).toBe(false)
  expect(JSON.stringify(audit)).not.toContain(f.cookie)
  expect(JSON.stringify(audit)).not.toContain("PRIVATE-LEGACY-CONTENT")
  expect(f.database.all("SELECT name FROM sqlite_master WHERE name = 'session_owner'")).toEqual([])
  expect(TeamProfileCensus.inspect(f.database, f.report.storageId)).toEqual(f.report)
}, 30000)

test("mapping metadata requires the exact enabled installation Team and never makes Team membership a content grant", async () => {
  const f = await fixture(["map"])
  expect(await f.authority.admit(f.request(), "map", f.mapped())).toBeUndefined()
  f.provider.teamResources.set(teamA, teamRow())
  expect(await f.resolver.configure(f.request(), { action: "enable", profile: profileA, expectedRevision: 0 })).toMatchObject({ status: "ok" })
  const lease = await f.authority.admit(f.request(), "map", f.mapped())
  expect(lease).toBeDefined()
  expect(f.provider.directTeams.get(oid)).toEqual([])
  expect(await f.authority.admit(f.request(), "map", f.mapped(profileB))).toBeUndefined()
  expect(await f.resolver.configure(f.request(), { action: "disable", profile: profileA, expectedRevision: 1 })).toMatchObject({ status: "ok" })
  expect(await f.authority.verifyCurrent(lease)).toBe(false)
  expect(f.database.all("SELECT name FROM sqlite_master WHERE name = 'session_owner'")).toEqual([])
}, 30000)

test("logout, group removal and grant removal invalidate a captured migration lease before another operation", async () => {
  const f = await fixture(["map", "cut", "recover"])
  const grantLease = await f.authority.admit(f.request(), "map", f.plan)
  expect(grantLease).toBeDefined()
  await f.policy(["cut"])
  expect(await f.authority.verifyCurrent(grantLease)).toBe(false)
  await f.policy(["map", "cut", "recover"])
  expect(await f.authority.verifyCurrent(grantLease)).toBe(false)
  const groupLease = await f.authority.admit(f.request(), "cut", f.plan)
  expect(groupLease).toBeDefined()
  f.provider.account.groups.splice(0)
  expect(await f.authority.verifyCurrent(groupLease)).toBe(false)
  f.provider.account.groups.push(group)
  const logoutLease = await f.authority.admit(f.request(), "recover", f.plan)
  expect(logoutLease).toBeDefined()
  expect((await f.logout(f.cookie))?.status).toBe(204)
  expect(await f.authority.verifyCurrent(logoutLease)).toBe(false)
  expect(await f.authority.auditIdentity(logoutLease)).toBeUndefined()
}, 30000)

test("the original Request and exact reviewed plan remain bound after mutation, even if their bytes are restored", async () => {
  const f = await fixture(["map"])
  const request = f.request()
  const mutable: TeamProfileCensus.Plan = JSON.parse(JSON.stringify(f.plan))
  const lease = await f.authority.admit(request, "map", mutable)
  expect(lease).toBeDefined()
  request.headers.set("x-sf-team-profile", "changed-selection")
  expect(await f.authority.verifyCurrent(lease)).toBe(false)
  request.headers.delete("x-sf-team-profile")
  expect(await f.authority.verifyCurrent(lease)).toBe(false)
  const other = await f.authority.admit(f.request(), "map", mutable)
  expect(other).toBeDefined()
  Object.assign(mutable, { sourceDigest: "f".repeat(64) })
  expect(await f.authority.verifyCurrent(other)).toBe(false)
  Object.assign(mutable, { sourceDigest: f.plan.sourceDigest })
  expect(await f.authority.verifyCurrent(other)).toBe(false)
  expect(TeamProfileCensus.inspect(f.database, f.report.storageId)).toEqual(f.report)
}, 30000)

test("migration writes refuse a missing or foreign Origin and unavailable current policy before any metadata write", async () => {
  const f = await fixture(["map"])
  const missing = f.request(); missing.headers.delete("origin")
  const foreign = f.request(); foreign.headers.set("origin", "https://foreign.invalid")
  expect(await f.authority.admit(missing, "map", f.plan)).toBeUndefined()
  expect(await f.authority.admit(foreign, "map", f.plan)).toBeUndefined()
  const lease = await f.authority.admit(f.request(), "map", f.plan)
  expect(lease).toBeDefined()
  await writeFile(f.file, "{malformed-policy")
  expect(await f.authority.verifyCurrent(lease)).toBe(false)
  expect(TeamProfileCensus.inspect(f.database, f.report.storageId)).toEqual(f.report)
}, 30000)
