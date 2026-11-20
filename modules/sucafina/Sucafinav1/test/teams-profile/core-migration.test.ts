import { afterEach, expect, test } from "bun:test"
import { chmod, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { Effect, Layer, Schema } from "effect"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Database } from "@orchestra/core/database/database"
import { AuthorityControl } from "@orchestra/core/database/authority-control"
import { AuthoritySqlFence } from "@orchestra/core/database/authority-sql-fence"
import { TeamProfileCensus } from "@orchestra/core/database/team-profile-census"
import { HostMaintenance } from "@orchestra/core/host-maintenance"
import { SessionV2 } from "@orchestra/core/session"
import { SessionOwner } from "@orchestra/core/session/owner"
import { SessionExecution } from "@orchestra/core/session/execution"
import { SessionExecutionLocal } from "@orchestra/core/session/execution/local"
import { SessionProcess } from "@orchestra/core/session-process"
import { ScheduledTask } from "@orchestra/core/scheduled-task"
import { ProjectV2 } from "@orchestra/core/project"
import { Global } from "@orchestra/core/global"
import { AbsolutePath } from "@orchestra/core/schema"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { SessionAccess } from "@orchestra/schema/session-access"
import { createTeamProfileMigrationAuthority } from "../../runtime/team-profile-migration-authority.ts"
import { createTeamProfileCoreMigration, CoreMigrationDenied, type MigrationFiles } from "../../runtime/team-profile-core-migration.ts"
import { openTeamProfileMigrationFiles } from "../../runtime/team-profile-migration-files.ts"
import { productGrant, teamProductFixture } from "./product-fixture.ts"
import { profileA, profileB } from "./installation-fixture.ts"
import { group, oid, other } from "../microsoft-login/oidc-fixture.ts"

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const close of cleanups.splice(0).reverse()) await close() })
const supported = new Set(AuthoritySqlFence.protectedTables)
const placement = new Set(["project", "project_directory", "workspace", "data_migration", "sqlite_sequence"])
type Services = Database.Service | SessionV2.Service | SessionOwner.Service | HostMaintenance.Service | SessionExecution.Service | ScheduledTask.Service

async function fixture() {
  const f = await teamProductFixture({ enabled: [profileA, profileB], grants: [oid, other].map((principalRef) => ({
    ...productGrant(principalRef), sessionActions: SessionAccess.Actions,
    migrationActions: ["map", "cut", "recover"],
  })) })
  cleanups.push(f.close)
  const filename = path.join(f.directory, "migration-core.sqlite")
  const directory = AbsolutePath.make(f.workspaceDirectory), location = { directory }
  const projects = Layer.succeed(ProjectV2.Service, ProjectV2.Service.of({
    resolve: () => Effect.succeed({ id: ProjectV2.ID.global, directory }),
    list: () => Effect.succeed([]), directories: () => Effect.succeed([]), commit: () => Effect.void,
  }))
  const layer = () => AppNodeBuilder.build(LayerNode.group([
    SessionV2.node, SessionOwner.node, SessionExecution.node, SessionProcess.node, ScheduledTask.node,
    ScheduledTask.daemonNode, HostMaintenance.node,
  ]), [
    [Database.node, Database.layerFromPath(filename)], [ProjectV2.node, projects],
    [SessionExecution.node, SessionExecutionLocal.node],
    [Global.node, Global.layerWith({ home: f.directory, data: f.directory, config: f.directory, cache: f.directory, state: f.directory })],
  ])
  const openGraph = async () => {
    const release = Promise.withResolvers<void>()
    const ready = Promise.withResolvers<{
      database: Database.Interface
      maintenance: HostMaintenance.Interface
      run: <A, E>(work: Effect.Effect<A, E, Services>) => Promise<A>
    }>()
    const running = Effect.runPromise(Effect.gen(function* () {
      const database = yield* Database.Service, maintenance = yield* HostMaintenance.Service
      const context = yield* Effect.context<Services>()
      ready.resolve({ database, maintenance, run: (work) => Effect.runPromise(work.pipe(Effect.provide(context))) })
      yield* Effect.promise(() => release.promise)
    }).pipe(Effect.provide(layer()), Effect.scoped))
    void running.catch(ready.reject)
    const services = await ready.promise
    let closed = false
    const close = async () => { if (closed) return; closed = true; release.resolve(); await running }
    cleanups.push(close)
    return { ...services, close }
  }
  const graph = await openGraph()
  const parent = await graph.run(SessionV2.Service.use((service) => service.create({ location, title: "PRIVATE-PARENT-CONTENT" })))
  const child = await graph.run(SessionV2.Service.use((service) => service.create({ location, parentID: parent.id, title: "PRIVATE-CHILD-CONTENT" })))
  await chmod(filename, 0o600)
  const storageId = graph.database.storageID
  if (!storageId) throw new Error("Actual Core storage identity required")
  const files = openTeamProfileMigrationFiles(filename, storageId)
  cleanups.push(async () => files.close())
  const authority = createTeamProfileMigrationAuthority({ origin: f.binding.origin, installationId: profileA.installationId,
    tenantId: profileA.tenantId, resolver: f.resolver, microsoft: f.microsoft })
  const engine = (using: MigrationFiles = files) => createTeamProfileCoreMigration({ files: using, authority, maintenance: graph.maintenance })
  const request = () => f.request("/api/ui/team-profile-migration", f.cookie, { method: "POST", headers: { origin: f.binding.origin } })
  const mapping = (quarantine = false): TeamProfileCensus.Intent => {
    const report = TeamProfileCensus.inspect(files.business, storageId)
    const owner = Schema.decodeUnknownSync(TeamProfile.Owner)({ profile: profileA, principal: { tenantId: profileA.tenantId, principalObjectId: oid } })
    return { version: 1, storageId, sourceDigest: report.sourceDigest,
      decisions: report.sessions.map((row) => quarantine
        ? { sessionId: row.id, sourceDigest: row.digest, disposition: "quarantine", reason: "unresolved-owner", evidenceDigest: "b".repeat(64) }
        : { sessionId: row.id, sourceDigest: row.digest, disposition: "map", owner, evidenceDigest: "a".repeat(64) }),
      tables: report.tables.map((row) => ({ name: row.name, schemaDigest: row.schemaDigest,
        disposition: supported.has(row.name) ? "preserve-current" : placement.has(row.name) ? "technical" : "quarantine" })),
    }
  }
  const admitted = <A, E>(request: Request, work: Effect.Effect<A, E, Services>) => graph.run(Effect.gen(function* () {
    const owners = yield* SessionOwner.Service
    const lease = yield* owners.capture(() => Effect.promise(() => f.authority.readCoreSessionAdmission(request)))
    if (!lease) return yield* Effect.die(new Error("Actual current Session admission required"))
    return yield* SessionOwner.withLease(lease, work)
  }))
  return { ...f, filename, location, graph, openGraph, files, storageId, parent, child, engine, request, mapping, admitted }
}

test("core migration: actual administrative dry-run is read-only and requires a current explicit grant", async () => {
  const f = await fixture(), before = TeamProfileCensus.inspect(f.files.business, f.storageId)
  const controlBefore = f.files.control.all("SELECT name, sql FROM sqlite_master ORDER BY name")
  const report = await f.engine().diagnose(f.request())
  expect(report).toEqual(before)
  expect(JSON.stringify(report)).not.toContain("PRIVATE-PARENT-CONTENT")
  expect(f.files.control.all("SELECT name, sql FROM sqlite_master ORDER BY name")).toEqual(controlBefore)
  await f.writeGrants(f.grants.map((grant) => ({ ...grant, migrationActions: [] })))
  await expect(f.engine().diagnose(f.request())).rejects.toThrow("SF_CORE_MIGRATION_AUTHORITY")
  expect(TeamProfileCensus.inspect(f.files.business, f.storageId)).toEqual(before)
}, 30000)

test("core migration: full explicit owners are additive, histories stay exact, old writers fail and repetition verifies a no-op", async () => {
  const f = await fixture(), engine = f.engine(), original = TeamProfileCensus.inspect(f.files.business, f.storageId)
  const history = f.files.business.all("SELECT * FROM event ORDER BY id")
  const prepared = await engine.prepare(f.request(), f.mapping())
  expect(prepared).toMatchObject({ status: "prepared", scope: "core-sessions", installationComplete: false, mappedSessions: 2 })
  expect(TeamProfileCensus.inspect(f.files.business, f.storageId)).toEqual(original)
  const activated = await engine.cut(f.request(), prepared.planDigest)
  expect(activated).toMatchObject({ status: "active", generation: 1, completeOwnership: true, installationComplete: false })
  expect(f.files.business.all("SELECT * FROM event ORDER BY id")).toEqual(history)
  expect(f.files.business.all("SELECT session_id, team_object_id, principal_object_id FROM session_owner ORDER BY session_id")).toEqual(
    [f.parent.id, f.child.id].sort().map((session_id) => ({ session_id, team_object_id: profileA.teamObjectId, principal_object_id: oid })))
  expect(() => f.files.business.execute("UPDATE session SET title = 'late legacy write' WHERE id = ?", [f.parent.id])).toThrow("sf-authority-writer-required")
  expect(await f.admitted(f.businessRequest(profileA), SessionV2.Service.use((sessions) => sessions.get(f.parent.id)))).toMatchObject({ id: f.parent.id, title: "PRIVATE-PARENT-CONTENT" })
  await expect(f.admitted(f.businessRequest(profileB), SessionV2.Service.use((sessions) => sessions.get(f.parent.id)))).rejects.toThrow()
  const beforeNoop = f.files.control.all("SELECT * FROM sf_team_migration_step ORDER BY seq")
  expect(await f.engine().cut(f.request(), prepared.planDigest)).toMatchObject({ status: "already-active", generation: 1 })
  expect(f.files.control.all("SELECT * FROM sf_team_migration_step ORDER BY seq")).toEqual(beforeNoop)
  expect(f.files.business.all("SELECT writer_permit FROM sf_authority_generation")).toEqual([{ writer_permit: null }])
}, 30000)

test("core migration: quarantine is retained content with no inferred owner or new content grant", async () => {
  const f = await fixture(), engine = f.engine()
  const prepared = await engine.prepare(f.request(), f.mapping(true))
  expect(await engine.cut(f.request(), prepared.planDigest)).toMatchObject({ status: "active", mappedSessions: 0, quarantinedSessions: 2, completeOwnership: false })
  expect(f.files.business.all("SELECT count(*) AS count FROM session_owner")).toEqual([{ count: 0 }])
  expect(f.files.business.all("SELECT count(*) AS count FROM session")).toEqual([{ count: 2 }])
  await expect(f.admitted(f.businessRequest(profileA), SessionV2.Service.use((sessions) => sessions.get(f.parent.id)))).rejects.toThrow()
}, 30000)

test("core migration: a source write after review rejects the cut without backfill or a new authority", async () => {
  const f = await fixture(), engine = f.engine()
  const prepared = await engine.prepare(f.request(), f.mapping())
  f.files.business.execute("UPDATE session SET title = 'concurrent original writer' WHERE id = ?", [f.parent.id])
  await expect(engine.cut(f.request(), prepared.planDigest)).rejects.toThrow("SF_CORE_MIGRATION_SOURCE_CHANGED")
  expect(AuthoritySqlFence.marker(f.files.business)).toBeUndefined()
  expect(AuthorityControl.open(f.files.control).inspect(f.storageId)).toBeUndefined()
  expect(f.files.business.all("SELECT count(*) AS count FROM session_owner")).toEqual([{ count: 0 }])
}, 30000)

test("core migration: authority lost while the real producer drain awaits is rechecked before the snapshot", async () => {
  const f = await fixture(), engine = f.engine()
  const prepared = await engine.prepare(f.request(), f.mapping())
  const started = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
  const admitted = Effect.runPromise(f.graph.maintenance.admit(Effect.promise(() => {
    started.resolve(); return new Promise<never>(() => {})
  }).pipe(Effect.ensuring(Effect.promise(async () => {
    f.provider.account.groups.splice(f.provider.account.groups.indexOf(group), 1)
    await release.promise
  })))))
  void admitted.catch(() => {})
  await started.promise
  const cutting = engine.cut(f.request(), prepared.planDigest)
  release.resolve()
  await expect(cutting).rejects.toThrow("SF_CORE_MIGRATION_AUTHORITY")
  await admitted.catch(() => {})
  expect(AuthoritySqlFence.marker(f.files.business)).toBeUndefined()
  expect(AuthorityControl.open(f.files.control).inspect(f.storageId)).toBeUndefined()
}, 30000)

test("core migration: a real transaction failure rolls back the whole backfill and retry uses the exact checkpoint", async () => {
  const f = await fixture()
  let injected = true
  const wrapped: MigrationFiles = { ...f.files, business: { ...f.files.business, execute: (sql, params) => {
    if (injected && sql.startsWith("INSERT INTO session_owner")) { injected = false; throw new Error("injected backfill storage failure") }
    f.files.business.execute(sql, params)
  } } }
  const prepared = await f.engine(wrapped).prepare(f.request(), f.mapping())
  await expect(f.engine(wrapped).cut(f.request(), prepared.planDigest)).rejects.toThrow("injected backfill storage failure")
  expect(AuthorityControl.open(f.files.control).inspect(f.storageId)).toMatchObject({ mode: "suspended", generation: 1 })
  expect(AuthoritySqlFence.marker(f.files.business)).toBeUndefined()
  expect(f.files.business.all("SELECT count(*) AS count FROM session_owner")).toEqual([{ count: 0 }])
  expect(await f.engine().cut(f.request(), prepared.planDigest)).toMatchObject({ status: "active", generation: 1 })
}, 30000)

test("core migration: crash after business COMMIT leaves authority suspended and resumes without replaying mappings", async () => {
  const f = await fixture()
  let injected = true
  const wrapped: MigrationFiles = { ...f.files, control: { ...f.files.control, execute: (sql, params) => {
    if (injected && sql.startsWith("UPDATE sf_control_store SET mode = 'active'")) { injected = false; throw new Error("injected activation storage failure") }
    f.files.control.execute(sql, params)
  } } }
  const engine = f.engine(wrapped), prepared = await engine.prepare(f.request(), f.mapping())
  await expect(engine.cut(f.request(), prepared.planDigest)).rejects.toThrow("injected activation storage failure")
  expect(AuthoritySqlFence.marker(f.files.business)).toMatchObject({ generation: 1 })
  expect(AuthorityControl.open(f.files.control).inspect(f.storageId)).toMatchObject({ mode: "suspended" })
  const rows = f.files.business.all("SELECT * FROM session_owner ORDER BY session_id")
  expect(await f.engine().cut(f.request(), prepared.planDigest)).toMatchObject({ status: "active", generation: 1 })
  expect(f.files.business.all("SELECT * FROM session_owner ORDER BY session_id")).toEqual(rows)
}, 30000)

test("core migration: unsupported persisted categories are not silently claimed by a Session-only map", async () => {
  const f = await fixture(), engine = f.engine()
  f.files.business.execute("CREATE TABLE unmapped_private_state (id TEXT PRIMARY KEY, content TEXT)")
  f.files.business.execute("INSERT INTO unmapped_private_state VALUES ('legacy-private', 'PRIVATE-UNMAPPED')")
  const prepared = await engine.prepare(f.request(), f.mapping())
  await expect(engine.cut(f.request(), prepared.planDigest)).rejects.toThrow("SF_CORE_MIGRATION_UNSUPPORTED_STATE")
  expect(AuthoritySqlFence.marker(f.files.business)).toBeUndefined()
  expect(f.files.business.all("SELECT count(*) AS count FROM unmapped_private_state")).toEqual([{ count: 1 }])
}, 30000)

test("core migration: an old data checkpoint never resets the current control authority", async () => {
  const f = await fixture(), engine = f.engine(), prepared = await engine.prepare(f.request(), f.mapping())
  await engine.cut(f.request(), prepared.planDigest)
  const saved = path.join(f.filename + ".teams-checkpoints", prepared.planDigest + ".sqlite")
  const bytes = await readFile(saved)
  const controlBefore = f.files.control.all("SELECT * FROM sf_control_store")
  await f.graph.close()
  f.files.business.execute("PRAGMA wal_checkpoint(TRUNCATE)")
  f.files.close()
  await writeFile(f.filename, bytes, { mode: 0o600 })
  const restarted = await f.openGraph()
  await expect(restarted.run(SessionV2.Service.use((sessions) => sessions.get(f.parent.id)))).rejects.toThrow()
  await expect(restarted.run(SessionV2.Service.use((sessions) => sessions.create({ location: f.location })))).rejects.toThrow()
  const current = openTeamProfileMigrationFiles(f.filename, f.storageId)
  try { expect(current.control.all("SELECT * FROM sf_control_store")).toEqual(controlBefore) } finally { current.close() }
}, 30000)
