import type { Database } from "bun:sqlite"
import type { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { sameTeamProfileBinding, teamProfilePolicyBinding, teamProfilePolicyCommand, teamProfilePrincipal, teamProfileRef } from "./team-profile-policy.ts"
import type { TeamProfileCatalog, TeamProfilePolicyAudit, TeamProfilePolicyBinding, TeamProfilePolicyCommand, TeamProfilePolicyMutation } from "./team-profile-policy.ts"

const maximumProfiles = 10000
type Header = { version: number; installation_id: string; tenant_id: string; config_revision: number }
type StoredProfile = { team_object_id: string; enabled: number }
type StoredAudit = { config_revision: number; action: string; team_object_id: string; principal_object_id: string; at: number }

/** A private installation capability. Neither this port nor authorize is transported to the browser. */
export type TeamProfilePolicyStore = Readonly<{
  read: () => Promise<TeamProfileCatalog>
  audit: (afterRevision?: number, limit?: number) => Promise<readonly TeamProfilePolicyAudit[]>
  mutate: (input: {
    command: TeamProfilePolicyCommand
    principal: TeamProfile.Principal
    at: number
    /** The resolver repeats current group, session and owner-policy checks inside the write boundary. */
    authorize: () => Promise<boolean>
    signal?: AbortSignal
  }) => Promise<TeamProfilePolicyMutation>
}>

/** Called inside the existing installation initialization transaction, never a business snapshot. */
export function initializeTeamProfilePolicy(db: Database, input: TeamProfilePolicyBinding) {
  const binding = teamProfilePolicyBinding(input)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sf_team_profile_policy (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL,
      installation_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      config_revision INTEGER NOT NULL CHECK (config_revision >= 0)
    );
    CREATE TABLE IF NOT EXISTS sf_team_profiles (
      team_object_id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL CHECK (enabled IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS sf_team_profile_audit (
      config_revision INTEGER PRIMARY KEY,
      action TEXT NOT NULL,
      team_object_id TEXT NOT NULL,
      principal_object_id TEXT NOT NULL,
      at INTEGER NOT NULL
    );
  `)
  const header = db.query<Header, []>("SELECT version, installation_id, tenant_id, config_revision FROM sf_team_profile_policy WHERE id = 1").get()
  if (!header) {
    if (db.query("SELECT team_object_id FROM sf_team_profiles LIMIT 1").get() || db.query("SELECT config_revision FROM sf_team_profile_audit LIMIT 1").get())
      throw new Error("Unbound Team profile policy cannot be adopted")
    db.query("INSERT INTO sf_team_profile_policy (id, version, installation_id, tenant_id, config_revision) VALUES (1, 1, ?, ?, 0)")
      .run(binding.installationId, binding.tenantId)
  }
  readCatalog(db, binding)
}

/** Reuses the installation's private file, locking, cancellation and disposal boundaries. */
export function createTeamProfilePolicyStore(input: {
  binding: TeamProfilePolicyBinding
  read: <T>(work: (db: Database) => T) => Promise<T>
  /** Acquires the existing write transaction. The callback commits synchronously after its final proof. */
  write: <T>(work: (db: Database) => Promise<T>, signal?: AbortSignal) => Promise<T>
}): TeamProfilePolicyStore {
  const binding = teamProfilePolicyBinding(input.binding)
  return Object.freeze({
    read: () => input.read((db) => readCatalog(db, binding)),
    audit: (afterRevision = 0, limit = 100) => {
      if (!validRevision(afterRevision) || !Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
        throw new Error("Invalid Team profile audit range")
      return input.read((db) => {
        const current = readCatalog(db, binding)
        const rows = db.query<StoredAudit, [number, number]>("SELECT config_revision, action, team_object_id, principal_object_id, at FROM sf_team_profile_audit WHERE config_revision > ? ORDER BY config_revision LIMIT ?").all(afterRevision, limit)
        return Object.freeze(rows.map((row) => {
          if (!validRevision(row.config_revision) || row.config_revision < 1 || row.config_revision > current.configRevision ||
              !["enable", "disable", "remove"].includes(row.action) || !validRevision(row.at))
            throw new Error("Invalid Team profile audit record")
          const command = teamProfilePolicyCommand({ action: row.action, profile: teamProfileRef(binding, row.team_object_id), expectedRevision: row.config_revision - 1 })
          if (!command) throw new Error("Invalid Team profile audit action")
          return Object.freeze({
            configRevision: row.config_revision, action: command.action, profile: command.profile,
            principal: teamProfilePrincipal({ tenantId: binding.tenantId, principalObjectId: row.principal_object_id }), at: row.at,
          })
        }))
      })
    },
    mutate: (operation) => {
      const command = teamProfilePolicyCommand(operation.command)
      const principal = teamProfilePrincipal(operation.principal)
      if (!command || !sameTeamProfileBinding(command.profile, binding) || principal.tenantId !== binding.tenantId ||
          !validRevision(operation.at) || typeof operation.authorize !== "function")
        throw new Error("Invalid Team profile policy mutation")
      // Copy the callbacks and timestamp before the first await; mutable caller objects cannot retarget a commit.
      const authorize = operation.authorize
      const signal = operation.signal
      const at = operation.at
      return input.write<TeamProfilePolicyMutation>(async (db) => {
        const current = readCatalog(db, binding)
        if (!await authorize()) return { status: "denied" }
        signal?.throwIfAborted()
        // The write lock excludes another catalog writer. No await separates the final proof, audit and COMMIT.
        if (readCatalog(db, binding).configRevision !== current.configRevision)
          throw new Error("Team profile policy changed during admission")
        if (current.configRevision !== command.expectedRevision) return { status: "conflict", configRevision: current.configRevision }
        const existing = current.profiles.find((entry) => entry.profile.teamObjectId === command.profile.teamObjectId)
        if (!existing && command.action !== "enable") return { status: "not-found" }
        if (!existing && current.profiles.length >= maximumProfiles) throw new Error("Team profile policy exceeds limit")
        if (existing && command.action !== "remove" && existing.enabled === (command.action === "enable"))
          return { status: "ok", configRevision: current.configRevision, changed: false }
        if (current.configRevision >= Number.MAX_SAFE_INTEGER) throw new Error("Team profile revision exhausted")
        const configRevision = current.configRevision + 1
        if (command.action === "remove") db.query("DELETE FROM sf_team_profiles WHERE team_object_id = ?").run(command.profile.teamObjectId)
        else db.query("INSERT INTO sf_team_profiles (team_object_id, enabled) VALUES (?, ?) ON CONFLICT (team_object_id) DO UPDATE SET enabled=excluded.enabled")
          .run(command.profile.teamObjectId, command.action === "enable" ? 1 : 0)
        db.query("INSERT INTO sf_team_profile_audit (config_revision, action, team_object_id, principal_object_id, at) VALUES (?, ?, ?, ?, ?)")
          .run(configRevision, command.action, command.profile.teamObjectId, principal.principalObjectId, at)
        const updated = db.query("UPDATE sf_team_profile_policy SET config_revision = ? WHERE id = 1 AND config_revision = ?")
          .run(configRevision, current.configRevision)
        if (updated.changes !== 1) throw new Error("Team profile policy revision conflict")
        signal?.throwIfAborted()
        db.exec("COMMIT")
        return { status: "ok", configRevision, changed: true }
      }, signal)
    },
  })
}

function validRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function readCatalog(db: Database, binding: TeamProfilePolicyBinding): TeamProfileCatalog {
  const header = db.query<Header, []>("SELECT version, installation_id, tenant_id, config_revision FROM sf_team_profile_policy WHERE id = 1").get()
  if (!header || header.version !== 1 || header.installation_id !== binding.installationId || header.tenant_id !== binding.tenantId ||
      !validRevision(header.config_revision)) throw new Error("Team profile installation binding or revision is invalid")
  const audit = db.query<{ revision: number | null }, []>("SELECT MAX(config_revision) AS revision FROM sf_team_profile_audit").get()
  if ((audit?.revision ?? 0) !== header.config_revision) throw new Error("Team profile revision and audit disagree")
  const rows = db.query<StoredProfile, [number]>("SELECT team_object_id, enabled FROM sf_team_profiles ORDER BY team_object_id LIMIT ?").all(maximumProfiles + 1)
  if (rows.length > maximumProfiles) throw new Error("Team profile policy exceeds limit")
  if (header.config_revision === 0 && rows.length > 0) throw new Error("Unaudited Team profile policy")
  return Object.freeze({
    configRevision: header.config_revision,
    profiles: Object.freeze(rows.map((row) => {
      if (row.enabled !== 0 && row.enabled !== 1) throw new Error("Invalid Team profile policy")
      return Object.freeze({ profile: teamProfileRef(binding, row.team_object_id), enabled: row.enabled === 1 })
    })),
  })
}
