import { Effect, Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { createHash } from "node:crypto"
import { TeamProfileCensus } from "@orchestra/core/database/team-profile-census"
import { AuthorityControl } from "@orchestra/core/database/authority-control"
import { AuthoritySqlFence } from "@orchestra/core/database/authority-sql-fence"
import type { HostMaintenance } from "@orchestra/core/host-maintenance"
import { digestSfValue } from "../product/contracts/canonical.ts"
import type { createTeamProfileMigrationAuthority, MigrationOperation } from "./team-profile-migration-authority.ts"

type Driver = AuthoritySqlFence.Driver
type Authority = ReturnType<typeof createTeamProfileMigrationAuthority>
export type Checkpoint = Readonly<{ digest: string; bytes: number; sourceDigest: string }>
export type MigrationFiles = Readonly<{
  business: Driver
  control: Driver
  storageId: string
  checkpoint: (plan: TeamProfileCensus.Plan) => Checkpoint
  verifyCheckpoint: (plan: TeamProfileCensus.Plan, checkpoint: Checkpoint) => boolean
}>
type Prepared = {
  report: TeamProfileCensus.Report
  plan: TeamProfileCensus.Plan
  checkpoint?: Checkpoint
}
export type CoreMigrationResult = Readonly<{
  scope: "core-sessions"
  installationComplete: false
  status: "prepared" | "active" | "already-active"
  storageId: string
  sourceDigest: string
  planDigest: string
  generation?: number
  mappedSessions: number
  quarantinedSessions: number
  completeOwnership: boolean
}>
export class CoreMigrationDenied extends Error {
  readonly _tag = "SfCoreMigrationDenied"
  constructor(readonly reason: "authority" | "schema" | "source-changed" | "journal" | "checkpoint" | "frontier" | "unsupported-state" | "generation" | "integrity") {
    super("SF_CORE_MIGRATION_" + reason.toUpperCase().replaceAll("-", "_"))
  }
}
const deny = (reason: CoreMigrationDenied["reason"]): never => { throw new CoreMigrationDenied(reason) }
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex")
const isDigest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
const qi = (name: string) => '"' + name.replaceAll('"', '""') + '"'
const sessionTables = new Set(AuthoritySqlFence.protectedTables)
const placementTables = new Set(["project", "project_directory", "workspace", "data_migration"])
const journalNames = ["sf_team_migration_plan", "sf_team_migration_step"]
const cutTable = "sf_team_migration_cut"
const quarantineTable = "sf_team_migration_quarantine"
const atomic = <A>(db: Driver, work: () => A): A => {
  if (db.inTransaction()) return deny("journal")
  db.execute("BEGIN IMMEDIATE")
  try { const value = work(); db.execute("COMMIT"); return value }
  catch (error) { if (db.inTransaction()) db.execute("ROLLBACK"); throw error }
}
const names = (db: Driver) => db.all("SELECT name FROM sqlite_master WHERE type = 'table'").map((row) => row.name)
const parse = (value: unknown): unknown => {
  if (typeof value !== "string") return deny("journal")
  try { return JSON.parse(value) } catch { return deny("journal") }
}
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return deny("journal")
  return Object.fromEntries(Object.entries(value))
}
function readCheckpoint(value: unknown): Checkpoint {
  const item = record(value)
  if (!isDigest(item.digest) || !isDigest(item.sourceDigest) || typeof item.bytes !== "number" ||
      !Number.isSafeInteger(item.bytes) || item.bytes < 1 || item.bytes > 256 * 1024 * 1024) return deny("checkpoint")
  return Object.freeze({ digest: item.digest, bytes: item.bytes, sourceDigest: item.sourceDigest })
}

/**
 * One explicit Core store cut. The caller supplies the actual file adapter and
 * same-graph maintenance service. Metadata and checkpoints are private server
 * state; no request DTO, receipt clone or selected Team can substitute for them.
 *
 * Unsupported nonempty categories remain blocked before the authority flip.
 * This deliberately does not call a Session-only mapping a complete installation migration.
 */
export function createTeamProfileCoreMigration(input: {
  files: MigrationFiles
  authority: Authority
  maintenance: HostMaintenance.Interface
}) {
  const { files, authority, maintenance } = input
  const { business, control: journal, storageId } = files
  if (!isDigest(storageId)) return deny("schema")
  let opened: ReturnType<typeof AuthorityControl.open> | undefined
  const getControl = () => opened ??= AuthorityControl.open(journal)
  const marker = () => AuthoritySqlFence.marker(business)

  const initializeJournal = () => {
    const present = names(journal).filter((name) => typeof name === "string" && name.startsWith("sf_team_migration_"))
    if (present.length && (present.length !== journalNames.length || journalNames.some((name) => !present.includes(name))))
      return deny("journal")
    journal.execute("CREATE TABLE IF NOT EXISTS sf_team_migration_plan (storage_id TEXT NOT NULL, plan_digest TEXT NOT NULL, source_digest TEXT NOT NULL, payload TEXT NOT NULL, payload_digest TEXT NOT NULL, checkpoint TEXT, PRIMARY KEY(storage_id, plan_digest))")
    journal.execute("CREATE TABLE IF NOT EXISTS sf_team_migration_step (seq INTEGER PRIMARY KEY AUTOINCREMENT, storage_id TEXT NOT NULL, plan_digest TEXT NOT NULL, stage TEXT NOT NULL, evidence_digest TEXT NOT NULL)")
  }
  const step = (plan: TeamProfileCensus.Plan, stage: string, evidence: unknown) =>
    journal.execute("INSERT INTO sf_team_migration_step(storage_id, plan_digest, stage, evidence_digest) VALUES (?, ?, ?, ?)",
      [storageId, plan.planDigest, stage, hash(evidence)])
  const stored = (digest: string): Prepared => {
    if (!isDigest(digest) || !journalNames.every((name) => names(journal).includes(name))) return deny("journal")
    const rows = journal.all("SELECT source_digest, payload, payload_digest, checkpoint FROM sf_team_migration_plan WHERE storage_id = ? AND plan_digest = ?", [storageId, digest])
    const row = rows[0]
    if (rows.length !== 1 || !row || typeof row.payload !== "string" || row.payload_digest !== hash(row.payload)) return deny("journal")
    const payload = record(parse(row.payload))
    // Decode the retained report through the same strict plan validator, then compare every canonical byte.
    const report = payload.report
    if (!report || typeof report !== "object" || !("version" in report) || report.version !== 1 ||
        !("storageId" in report) || report.storageId !== storageId || !("sourceDigest" in report) ||
        report.sourceDigest !== row.source_digest || !("tables" in report) || !Array.isArray(report.tables) ||
        !("sessions" in report) || !Array.isArray(report.sessions) || !("integrity" in report) || report.integrity !== "ok")
      return deny("journal")
    // Stored metadata is still untrusted input. This decoder checks the full structural report and intent below.
    const decoded = decodePrepared(payload)
    if (decoded.plan.planDigest !== digest || decoded.plan.sourceDigest !== row.source_digest ||
        decoded.plan.storageId !== storageId || digestSfValue(decoded) !== digestSfValue(payload)) return deny("journal")
    return { ...decoded, ...(row.checkpoint === null ? {} : { checkpoint: readCheckpoint(parse(row.checkpoint)) }) }
  }
  const admit = async (request: Request, operation: MigrationOperation, plan: TeamProfileCensus.Plan) => {
    const lease = await authority.admit(request, operation, plan)
    const identity = lease && await authority.auditIdentity(lease)
    if (!lease || !identity || identity.operation !== operation || identity.storageId !== storageId ||
        identity.sourceDigest !== plan.sourceDigest || identity.planDigest !== plan.planDigest) return deny("authority")
    return { lease, identity }
  }
  const current = async (held: Awaited<ReturnType<typeof admit>>, operation: MigrationOperation, plan: TeamProfileCensus.Plan) => {
    const identity = await authority.auditIdentity(held.lease)
    if (!identity || identity.operation !== operation || identity.storageId !== storageId ||
        identity.sourceDigest !== plan.sourceDigest || identity.planDigest !== plan.planDigest ||
        digestSfValue(identity) !== digestSfValue(held.identity)) return deny("authority")
  }
  const result = (status: CoreMigrationResult["status"], plan: TeamProfileCensus.Plan, generation?: number): CoreMigrationResult =>
    Object.freeze({ scope: "core-sessions", installationComplete: false, status, storageId, sourceDigest: plan.sourceDigest, planDigest: plan.planDigest,
      ...(generation === undefined ? {} : { generation }),
      mappedSessions: plan.decisions.filter((row) => row.disposition === "map").length,
      quarantinedSessions: plan.decisions.filter((row) => row.disposition === "quarantine").length,
      completeOwnership: plan.completeOwnership })

  const supported = (report: TeamProfileCensus.Report, plan: TeamProfileCensus.Plan) => {
    for (const table of report.tables) {
      const disposition = plan.tables.find((row) => row.name === table.name)?.disposition
      if (sessionTables.has(table.name)) {
        if (disposition !== "preserve-current") return deny("schema")
      } else if (placementTables.has(table.name) || table.name === "sqlite_sequence") {
        if (disposition !== "technical" && disposition !== "preserve-current") return deny("schema")
      } else if (disposition !== "quarantine" || table.rows !== 0) {
        // A later category-specific migrator must preserve ownership and lifecycle semantics.
        // An arbitrary table classification never grants permission to drop or copy its contents.
        return deny("unsupported-state")
      }
    }
    if (!AuthoritySqlFence.protectedTables.every((name) => report.tables.some((row) => row.name === name)) ||
        !report.tables.some((row) => row.name === "project")) return deny("schema")
    const mapped = new Set(plan.decisions.filter((row) => row.disposition === "map").map((row) => row.sessionId))
    // Promotion is an admission frontier, not proof of completed external work.
    // Unknown promoted legacy work requires explicit Session quarantine, never a TTL takeover.
    const promoted = business.all("SELECT session_id FROM session_input WHERE promoted_seq IS NOT NULL")
    if (promoted.some((row) => typeof row.session_id !== "string" || mapped.has(row.session_id))) return deny("frontier")
  }

  const verifyBindings = (plan: TeamProfileCensus.Plan, generation: number) => {
    for (const decision of plan.decisions) {
      const bound = business.all("SELECT installation_id, tenant_id, team_object_id, principal_object_id, generation FROM session_owner WHERE session_id = ?", [decision.sessionId])
      const quarantined = business.all("SELECT source_digest, reason, evidence_digest FROM sf_team_migration_quarantine WHERE category = 'session' AND source_id = ?", [decision.sessionId])
      if (decision.disposition === "map") {
        const owner = decision.owner, row = bound[0]
        if (bound.length !== 1 || !row || quarantined.length || row.installation_id !== owner.profile.installationId ||
            row.tenant_id !== owner.profile.tenantId || row.team_object_id !== owner.profile.teamObjectId ||
            row.principal_object_id !== owner.principal.principalObjectId || row.generation !== generation) return deny("integrity")
      } else if (bound.length || quarantined.length !== 1 ||
          quarantined[0]?.source_digest !== decision.sourceDigest || quarantined[0]?.reason !== decision.reason ||
          quarantined[0]?.evidence_digest !== decision.evidenceDigest) return deny("integrity")
    }
  }
  const verifyCut = (prepared: Prepared, generation: number) => {
    const saved = business.all("SELECT plan_digest, source_digest, control_id, generation, checkpoint_digest, fence_digest FROM sf_team_migration_cut WHERE id = 1")
    const row = saved[0], found = marker()
    if (saved.length !== 1 || !row || row.plan_digest !== prepared.plan.planDigest ||
        row.source_digest !== prepared.plan.sourceDigest || row.control_id !== getControl().controlId ||
        row.generation !== generation || !prepared.checkpoint || row.checkpoint_digest !== prepared.checkpoint.digest ||
        found?.generation !== generation || found.controlId !== getControl().controlId ||
        row.fence_digest !== fenceDigest(business) || !files.verifyCheckpoint(prepared.plan, prepared.checkpoint))
      return deny("integrity")
    verifyBindings(prepared.plan, generation)
    if (business.all("PRAGMA foreign_key_check").length) return deny("integrity")
  }

  return Object.freeze({
    async diagnose(request: Request) {
      const report = await authority.inspect(request, () => TeamProfileCensus.inspect(business, storageId))
      return report ?? deny("authority")
    },
    async prepare(request: Request, rawIntent: unknown): Promise<CoreMigrationResult> {
      const intent = decodeIntent(rawIntent)
      if (digestSfValue(intent) !== digestSfValue(rawIntent)) return deny("schema")
      const report = TeamProfileCensus.inspect(business, storageId)
      const plan = TeamProfileCensus.plan(report, intent)
      const held = await admit(request, "map", plan)
      await current(held, "map", plan)
      if (marker()) return deny("generation")
      atomic(journal, () => {
        initializeJournal()
        const old = journal.all("SELECT payload_digest FROM sf_team_migration_plan WHERE storage_id = ? AND plan_digest = ?", [storageId, plan.planDigest])
        const payload = JSON.stringify({ report, plan })
        if (old.length) {
          if (old.length !== 1 || old[0]?.payload_digest !== hash(payload)) return deny("journal")
          return
        }
        journal.execute("INSERT INTO sf_team_migration_plan(storage_id, plan_digest, source_digest, payload, payload_digest) VALUES (?, ?, ?, ?, ?)",
          [storageId, plan.planDigest, plan.sourceDigest, payload, hash(payload)])
        step(plan, "prepared", held.identity)
      })
      return result("prepared", plan)
    },
    async cut(request: Request, planDigest: string): Promise<CoreMigrationResult> {
      const prepared = stored(planDigest)
      const { report, plan } = prepared
      const held = await admit(request, "cut", plan)
      const existing = getControl().inspect(storageId)
      if (existing?.mode === "active") {
        if (existing.planHash !== plan.planDigest) return deny("generation")
        await current(held, "cut", plan)
        verifyCut(prepared, existing.generation)
        return result("already-active", plan, existing.generation)
      }
      if (existing && (existing.mode !== "suspended" || existing.planHash !== plan.planDigest)) return deny("generation")
      if (!marker()) {
        const now = TeamProfileCensus.inspect(business, storageId)
        if (now.sourceDigest !== plan.sourceDigest) return deny("source-changed")
        supported(now, plan)
      }
      const witness = await Effect.runPromise(maintenance.close)
      if (!maintenance.verify(witness)) return deny("generation")
      // This is the final asynchronous authorization boundary before the locked,
      // synchronous snapshot/backfill/activation sequence.
      await current(held, "cut", plan)
      if (!maintenance.verify(witness)) return deny("generation")
      const generation = getControl().registerSuspended(storageId, plan.planDigest)
      if (getControl().pendingWriters(storageId).length) return deny("frontier")
      if (marker()) {
        // A crash after the business COMMIT but before control activation is
        // repaired forward using the existing mapping and exact checkpoint.
        verifyCut(prepared, generation)
      } else {
        business.execute("BEGIN IMMEDIATE")
        try {
          const locked = TeamProfileCensus.inspectInTransaction(business, storageId)
          if (locked.sourceDigest !== plan.sourceDigest) return deny("source-changed")
          const canonical = TeamProfileCensus.plan(locked, plan)
          if (digestSfValue(canonical) !== digestSfValue(plan)) return deny("journal")
          supported(locked, plan)
          const checkpoint = files.checkpoint(plan)
          if (checkpoint.sourceDigest !== plan.sourceDigest || !files.verifyCheckpoint(plan, checkpoint)) return deny("checkpoint")
          prepared.checkpoint = checkpoint
          atomic(journal, () => {
            const previous = journal.all("SELECT checkpoint FROM sf_team_migration_plan WHERE storage_id = ? AND plan_digest = ?", [storageId, plan.planDigest])[0]
            if (!previous || previous.checkpoint !== null && digestSfValue(parse(previous.checkpoint)) !== digestSfValue(checkpoint))
              return deny("checkpoint")
            journal.execute("UPDATE sf_team_migration_plan SET checkpoint = ? WHERE storage_id = ? AND plan_digest = ?", [JSON.stringify(checkpoint), storageId, plan.planDigest])
            step(plan, "checkpoint", checkpoint)
          })
          business.execute("CREATE TABLE sf_team_migration_quarantine (category TEXT NOT NULL, source_id TEXT NOT NULL, source_digest TEXT NOT NULL, reason TEXT NOT NULL, evidence_digest TEXT NOT NULL, PRIMARY KEY(category, source_id))")
          business.execute("CREATE TABLE sf_team_migration_cut (id INTEGER PRIMARY KEY CHECK(id = 1), plan_digest TEXT NOT NULL, source_digest TEXT NOT NULL, control_id TEXT NOT NULL, generation INTEGER NOT NULL, checkpoint_digest TEXT NOT NULL, fence_digest TEXT NOT NULL)")
          for (const decision of plan.decisions) {
            if (decision.disposition === "quarantine") {
              if (business.all("SELECT 1 FROM session_owner WHERE session_id = ?", [decision.sessionId]).length) return deny("integrity")
              business.execute("INSERT INTO sf_team_migration_quarantine(category, source_id, source_digest, reason, evidence_digest) VALUES ('session', ?, ?, ?, ?)",
                [decision.sessionId, decision.sourceDigest, decision.reason, decision.evidenceDigest])
            } else {
              const owner = decision.owner
              business.execute("INSERT INTO session_owner(session_id, installation_id, tenant_id, team_object_id, principal_object_id, generation) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(session_id) DO NOTHING",
                [decision.sessionId, owner.profile.installationId, owner.profile.tenantId, owner.profile.teamObjectId, owner.principal.principalObjectId, generation])
            }
          }
          verifyBindings(plan, generation)
          // All old content and histories stay byte-identical. Only additive owner
          // associations and migration metadata may change inside this transaction.
          const backfilled = TeamProfileCensus.inspectInTransaction(business, storageId)
          for (const table of report.tables) {
            const after = backfilled.tables.find((row) => row.name === table.name)
            if (!after || after.schemaDigest !== table.schemaDigest ||
                table.name !== "session_owner" && (after.rows !== table.rows || after.dataDigest !== table.dataDigest))
              return deny("integrity")
          }
          business.execute("INSERT INTO sf_team_migration_cut(id, plan_digest, source_digest, control_id, generation, checkpoint_digest, fence_digest) VALUES (1, ?, ?, ?, ?, ?, '')",
            [plan.planDigest, plan.sourceDigest, getControl().controlId, generation, checkpoint.digest])
          const fenced = report.tables.filter((table) => !placementTables.has(table.name) && table.name !== "sqlite_sequence").map((table) => table.name)
          AuthoritySqlFence.install(business, { generation, controlId: getControl().controlId }, [...fenced, quarantineTable])
          // Record the exact trigger definition set before protecting the cut row.
          // The final cut-row triggers are included in the recorded digest below.
          for (const operation of ["INSERT", "UPDATE", "DELETE"]) {
            business.execute("CREATE TRIGGER sf_team_cut_" + operation.toLowerCase() + " BEFORE " + operation +
              " ON sf_team_migration_cut BEGIN SELECT RAISE(ABORT, 'sf-team-migration-cut-immutable'); END")
          }
          const digest = fenceDigest(business)
          // The metadata INSERT is replaced inside this still-uncommitted cut only.
          business.execute("DROP TRIGGER sf_team_cut_update")
          business.execute("UPDATE sf_team_migration_cut SET fence_digest = ? WHERE id = 1", [digest])
          business.execute("CREATE TRIGGER sf_team_cut_update BEFORE UPDATE ON sf_team_migration_cut BEGIN SELECT RAISE(ABORT, 'sf-team-migration-cut-immutable'); END")
          if (fenceDigest(business) !== digest) return deny("integrity")
          if (business.all("PRAGMA foreign_key_check").length) return deny("integrity")
          business.execute("COMMIT")
        } catch (error) {
          if (business.inTransaction()) business.execute("ROLLBACK")
          throw error
        }
        verifyCut(prepared, generation)
      }
      atomic(journal, () => step(plan, "backfill-verified", { generation, checkpoint: prepared.checkpoint }))
      // The current control file is excluded from data checkpoints. Its CAS is
      // the single authority activation point; no legacy/new dual writer exists.
      getControl().activate(storageId, generation, plan.planDigest, marker)
      atomic(journal, () => step(plan, "activated", { generation, controlId: getControl().controlId }))
      return result("active", plan, generation)
    },
  })
}

function fenceDigest(db: Driver) {
  return hash(db.all("SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'trigger' AND (name LIKE 'sf_authority_%' OR name LIKE 'sf_team_cut_%') ORDER BY name"))
}
function decodeIntent(input: unknown): TeamProfileCensus.Intent {
  const value = record(input)
  if (value.version !== 1 || !isDigest(value.storageId) || !isDigest(value.sourceDigest) ||
      !Array.isArray(value.decisions) || !Array.isArray(value.tables) || value.decisions.length > 100000 || value.tables.length > 1024)
    return deny("schema")
  const decisions: TeamProfileCensus.Decision[] = value.decisions.map((entry) => {
    const row = record(entry)
    if (typeof row.sessionId !== "string" || !row.sessionId || !isDigest(row.sourceDigest) || !isDigest(row.evidenceDigest)) return deny("schema")
    if (row.disposition === "map") return { sessionId: row.sessionId, sourceDigest: row.sourceDigest, disposition: "map",
      owner: Schema.decodeUnknownSync(TeamProfile.Owner)(row.owner), evidenceDigest: row.evidenceDigest }
    if (row.disposition !== "quarantine" || row.reason !== "unresolved-owner" && row.reason !== "ambiguous-owner" && row.reason !== "scope-conflict")
      return deny("schema")
    return { sessionId: row.sessionId, sourceDigest: row.sourceDigest, disposition: "quarantine", reason: row.reason, evidenceDigest: row.evidenceDigest }
  })
  const tables: TeamProfileCensus.Intent["tables"] = value.tables.map((entry) => {
    const row = record(entry)
    if (typeof row.name !== "string" || !row.name || !isDigest(row.schemaDigest) ||
        row.disposition !== "preserve-current" && row.disposition !== "rewind-data" && row.disposition !== "quarantine" && row.disposition !== "technical")
      return deny("schema")
    return { name: row.name, schemaDigest: row.schemaDigest, disposition: row.disposition }
  })
  return { version: 1, storageId: value.storageId, sourceDigest: value.sourceDigest, decisions, tables }
}
function decodePrepared(payload: Record<string, unknown>): Prepared {
  const value = record(payload.report)
  if (value.version !== 1 || !isDigest(value.storageId) || !isDigest(value.sourceDigest) || value.integrity !== "ok" ||
      !Array.isArray(value.tables) || value.tables.length > 1024 || !Array.isArray(value.sessions) || value.sessions.length > 100000)
    return deny("journal")
  const tables: TeamProfileCensus.Report["tables"] = value.tables.map((entry) => {
    const row = record(entry)
    if (typeof row.name !== "string" || !row.name || !isDigest(row.schemaDigest) || !isDigest(row.dataDigest) ||
        typeof row.rows !== "number" || !Number.isSafeInteger(row.rows) || row.rows < 0 || row.rows > 100000) return deny("journal")
    return Object.freeze({ name: row.name, schemaDigest: row.schemaDigest, dataDigest: row.dataDigest, rows: row.rows })
  })
  const sessions: TeamProfileCensus.Report["sessions"] = value.sessions.map((entry) => {
    const row = record(entry)
    if (typeof row.id !== "string" || !row.id || !isDigest(row.digest) || !Array.isArray(row.issues) ||
        row.parentId !== undefined && (typeof row.parentId !== "string" || !row.parentId)) return deny("journal")
    const issues: ("unknown-history" | "invalid-history" | "ambiguous-history" | "missing-creation")[] = []
    for (const issue of row.issues) {
      if (issue !== "unknown-history" && issue !== "invalid-history" && issue !== "ambiguous-history" && issue !== "missing-creation") return deny("journal")
      issues.push(issue)
    }
    const owner = row.owner === undefined ? undefined : Schema.decodeUnknownSync(TeamProfile.Owner)(row.owner)
    return Object.freeze({ id: row.id, digest: row.digest, issues: Object.freeze(issues),
      ...(typeof row.parentId === "string" ? { parentId: row.parentId } : {}), ...(owner ? { owner } : {}) })
  })
  const report: TeamProfileCensus.Report = Object.freeze({ version: 1, storageId: value.storageId, sourceDigest: value.sourceDigest,
    tables: Object.freeze(tables), sessions: Object.freeze(sessions), integrity: "ok" })
  const plan = TeamProfileCensus.plan(report, decodeIntent(payload.plan))
  return { report, plan }
}
