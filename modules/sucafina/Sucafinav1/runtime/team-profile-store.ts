import type { Database } from "bun:sqlite"
import { createHash, randomUUID } from "node:crypto"
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { sameTeamProfileBinding, teamProfilePolicyBinding, teamProfilePolicyCommand, teamProfilePrincipal, teamProfileRef, teamConfigurationCommand, freezeTeamConfiguration } from "./team-profile-policy.ts"
import type { TeamProfileCatalog, TeamProfilePolicyBinding, TeamProfilePolicyCommand, TeamProfilePolicyMutation } from "./team-profile-policy.ts"

const maximumProfiles = 10000
type Header = {
  version: number
  installation_id: string
  tenant_id: string
  generation: string
  config_revision: number
  bootstrap_ids: string
  bootstrap_digest: string
}
type StoredProfile = { team_object_id: string; enabled: number }
type StoredConfiguration = { config_revision: number; document: string; document_digest: string }
export type TeamProfilePolicyInitialization = Readonly<{
  binding: Readonly<{ installationId: string; tenantId: string }>
  bootstrapEnabledTeamIds?: readonly string[]
}>
type MutationAuthority = Readonly<{
  principal: TeamProfile.Principal
  at: number
  /** Repeats real group, session and policy checks while the writer owns the lock. */
  authorize: () => Promise<boolean>
  signal?: AbortSignal
}>

/** A private installation capability. No SQL handle or authorization callback crosses HTTP. */
export type TeamProfilePolicyStore = Readonly<{
  read: () => Promise<TeamProfileCatalog>
  readConfiguration: (profile: TeamProfile.Ref) => Promise<TeamProfile.ConfigurationSnapshot | undefined>
  mutate: (input: MutationAuthority & { command: TeamProfilePolicyCommand }) => Promise<TeamProfilePolicyMutation>
  configureConfiguration: (input: MutationAuthority & { command: TeamProfile.ConfigurationCommand }) => Promise<TeamProfilePolicyMutation>
}>

/** Capture validated owner configuration before openLocalStore's first await. */
export function teamProfilePolicyInitialization(value: TeamProfilePolicyInitialization) {
  const binding = teamProfilePolicyBinding(value.binding)
  const enabled = value.bootstrapEnabledTeamIds ?? []
  if (!Array.isArray(enabled) || enabled.length > maximumProfiles) throw new Error("Invalid Team policy bootstrap")
  const ids = enabled.map((id) => teamProfileRef(binding, id).teamObjectId).toSorted()
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate Team policy bootstrap")
  return Object.freeze({ binding, bootstrapEnabledTeamIds: Object.freeze(ids) })
}

/** Runs inside the installation initialization transaction. Owner seeds are imported exactly once. */
export function initializeTeamProfilePolicy(db: Database, input: TeamProfilePolicyInitialization) {
  const initial = teamProfilePolicyInitialization(input)
  const binding = initial.binding
  const bootstrap = JSON.stringify(initial.bootstrapEnabledTeamIds)
  const digest = createHash("sha256").update(bootstrap).digest("hex")
  db.exec([
    "CREATE TABLE IF NOT EXISTS sf_team_profile_policy (id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL, installation_id TEXT NOT NULL, tenant_id TEXT NOT NULL, generation TEXT NOT NULL, config_revision INTEGER NOT NULL CHECK (config_revision >= 0), bootstrap_ids TEXT NOT NULL, bootstrap_digest TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS sf_team_profiles (team_object_id TEXT PRIMARY KEY, enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)))",
    "CREATE TABLE IF NOT EXISTS sf_team_profile_audit (config_revision INTEGER PRIMARY KEY CHECK (config_revision > 0), action TEXT NOT NULL, team_object_id TEXT NOT NULL, principal_object_id TEXT NOT NULL, at INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS sf_team_configurations (team_object_id TEXT PRIMARY KEY, config_revision INTEGER NOT NULL CHECK (config_revision > 0), document TEXT NOT NULL, document_digest TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS sf_team_configuration_audit (config_revision INTEGER PRIMARY KEY CHECK (config_revision > 0), team_object_id TEXT NOT NULL, document_digest TEXT NOT NULL)",
  ].join("; "))
  const header = readHeader(db)
  if (!header) {
    if (db.query("SELECT team_object_id FROM sf_team_profiles LIMIT 1").get() ||
        db.query("SELECT config_revision FROM sf_team_profile_audit LIMIT 1").get() ||
        db.query("SELECT team_object_id FROM sf_team_configurations LIMIT 1").get() ||
        db.query("SELECT config_revision FROM sf_team_configuration_audit LIMIT 1").get())
      throw new Error("Unbound Team profile policy cannot be adopted")
    // Bootstrap provenance is the validated private installation descriptor, never a fabricated administrator.
    db.query("INSERT INTO sf_team_profile_policy (id, version, installation_id, tenant_id, generation, config_revision, bootstrap_ids, bootstrap_digest) VALUES (1, 2, ?, ?, ?, 0, ?, ?)")
      .run(binding.installationId, binding.tenantId, randomUUID(), bootstrap, digest)
    for (const id of initial.bootstrapEnabledTeamIds ?? [])
      db.query("INSERT INTO sf_team_profiles (team_object_id, enabled) VALUES (?, 1)").run(id)
  }
  const current = readCatalog(db, binding)
  if (current.header.bootstrap_ids !== bootstrap || current.header.bootstrap_digest !== digest)
    throw new Error("Team policy bootstrap descriptor changed")
}

/** Reuses the installation's private file, serialized writer, cancellation and disposal. */
export function createTeamProfilePolicyStore(input: {
  binding: TeamProfilePolicyBinding
  read: <T>(work: (db: Database) => T) => Promise<T>
  write: <T>(work: (db: Database) => Promise<T>, signal?: AbortSignal) => Promise<T>
  /** Synchronous file-identity check and COMMIT owned by openLocalStore. */
  commit: (db: Database) => void
}): TeamProfilePolicyStore {
  const binding = teamProfilePolicyBinding(input.binding)
  const read = input.read
  const write = input.write
  const commit = input.commit
  return Object.freeze({
    read: () => read((db) => {
      const current = readCatalog(db, binding)
      return Object.freeze({ configRevision: current.configRevision, profiles: current.profiles })
    }),
    readConfiguration: (value) => {
      const profile = Object.freeze(Schema.decodeUnknownSync(TeamProfile.Ref)(value))
      if (!sameTeamProfileBinding(profile, binding)) throw new Error("Foreign Team configuration")
      return read((db) => readConfiguration(db, binding, profile))
    },
    mutate: (operation) => {
      const command = teamProfilePolicyCommand(operation.command)
      const principal = teamProfilePrincipal(operation.principal)
      if (!command || !sameTeamProfileBinding(command.profile, binding) || principal.tenantId !== binding.tenantId ||
          !validRevision(operation.at) || typeof operation.authorize !== "function")
        throw new Error("Invalid Team profile mutation")
      const authorize = operation.authorize
      const signal = operation.signal
      const at = operation.at
      return write<TeamProfilePolicyMutation>(async (db) => {
        const current = readCatalog(db, binding)
        if (!await authorize()) return { status: "denied" }
        signal?.throwIfAborted()
        if (readCatalog(db, binding).configRevision !== current.configRevision)
          throw new Error("Team profile policy changed during admission")
        if (current.configRevision !== command.expectedRevision) return { status: "conflict", configRevision: current.configRevision }
        const existing = current.profiles.find((entry) => entry.profile.teamObjectId === command.profile.teamObjectId)
        if (!existing && command.action !== "enable") return { status: "not-found" }
        if (command.action !== "remove" && existing?.enabled === (command.action === "enable"))
          return { status: "ok", configRevision: current.configRevision, changed: false }
        if (!existing && current.profiles.length >= maximumProfiles) throw new Error("Team profile catalog limit exceeded")
        const sequence = nextSequence(current.header)
        if (command.action === "remove") {
          db.query("DELETE FROM sf_team_profiles WHERE team_object_id = ?").run(command.profile.teamObjectId)
          db.query("DELETE FROM sf_team_configurations WHERE team_object_id = ?").run(command.profile.teamObjectId)
        } else {
          db.query("INSERT INTO sf_team_profiles (team_object_id, enabled) VALUES (?, ?) ON CONFLICT (team_object_id) DO UPDATE SET enabled=excluded.enabled")
            .run(command.profile.teamObjectId, command.action === "enable" ? 1 : 0)
        }
        db.query("INSERT INTO sf_team_profile_audit (config_revision, action, team_object_id, principal_object_id, at) VALUES (?, ?, ?, ?, ?)")
          .run(sequence, command.action, command.profile.teamObjectId, principal.principalObjectId, at)
        advance(db, current.header, sequence)
        signal?.throwIfAborted()
        commit(db)
        return { status: "ok", configRevision: revision(current.header, sequence), changed: true }
      }, signal)
    },
    configureConfiguration: (operation) => {
      const command = teamConfigurationCommand(operation.command)
      const principal = teamProfilePrincipal(operation.principal)
      if (!command || !sameTeamProfileBinding(command.profile, binding) || principal.tenantId !== binding.tenantId ||
          !validRevision(operation.at) || typeof operation.authorize !== "function")
        throw new Error("Invalid Team configuration mutation")
      const authorize = operation.authorize
      const signal = operation.signal
      const at = operation.at
      const document = configurationBytes(command.document)
      const digest = configurationDigest(command.profile, document)
      return write<TeamProfilePolicyMutation>(async (db) => {
        const current = readCatalog(db, binding)
        if (!await authorize()) return { status: "denied" }
        signal?.throwIfAborted()
        if (readCatalog(db, binding).configRevision !== current.configRevision)
          throw new Error("Team configuration changed during admission")
        if (current.configRevision !== command.expectedRevision) return { status: "conflict", configRevision: current.configRevision }
        if (!current.profiles.some((entry) => entry.profile.teamObjectId === command.profile.teamObjectId)) return { status: "not-found" }
        const existing = readConfiguration(db, binding, command.profile)
        if (existing && configurationBytes(existing.document) === document)
          return { status: "ok", configRevision: current.configRevision, changed: false }
        const sequence = nextSequence(current.header)
        db.query("INSERT INTO sf_team_profile_audit (config_revision, action, team_object_id, principal_object_id, at) VALUES (?, 'configuration', ?, ?, ?)")
          .run(sequence, command.profile.teamObjectId, principal.principalObjectId, at)
        db.query("INSERT INTO sf_team_configuration_audit (config_revision, team_object_id, document_digest) VALUES (?, ?, ?)")
          .run(sequence, command.profile.teamObjectId, digest)
        db.query("INSERT INTO sf_team_configurations (team_object_id, config_revision, document, document_digest) VALUES (?, ?, ?, ?) ON CONFLICT (team_object_id) DO UPDATE SET config_revision=excluded.config_revision, document=excluded.document, document_digest=excluded.document_digest")
          .run(command.profile.teamObjectId, sequence, document, digest)
        advance(db, current.header, sequence)
        signal?.throwIfAborted()
        commit(db)
        return { status: "ok", configRevision: revision(current.header, sequence), changed: true }
      }, signal)
    },
  })
}

function readHeader(db: Database) {
  return db.query<Header, []>("SELECT version, installation_id, tenant_id, generation, config_revision, bootstrap_ids, bootstrap_digest FROM sf_team_profile_policy WHERE id = 1").get()
}

function readCatalog(db: Database, binding: TeamProfilePolicyBinding) {
  const header = readHeader(db)
  if (!header || header.version !== 2 || header.installation_id !== binding.installationId || header.tenant_id !== binding.tenantId ||
      !validRevision(header.config_revision) || typeof header.generation !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(header.generation) ||
      typeof header.bootstrap_ids !== "string" || header.bootstrap_ids.length > maximumProfiles * 40 ||
      createHash("sha256").update(header.bootstrap_ids).digest("hex") !== header.bootstrap_digest)
    throw new Error("Invalid Team profile policy binding")
  const seed: unknown = JSON.parse(header.bootstrap_ids)
  if (!Array.isArray(seed) || seed.length > maximumProfiles ||
      seed.some((id) => !Schema.is(TeamProfile.TeamObjectId)(id)) ||
      new Set(seed).size !== seed.length || JSON.stringify(seed.toSorted()) !== header.bootstrap_ids)
    throw new Error("Invalid Team profile bootstrap provenance")
  const latest = db.query<{ revision: number | null }, []>("SELECT MAX(config_revision) AS revision FROM sf_team_profile_audit").get()
  if (!latest || (latest.revision ?? 0) !== header.config_revision) throw new Error("Team profile audit frontier mismatch")
  const rows = db.query<StoredProfile, []>("SELECT team_object_id, enabled FROM sf_team_profiles ORDER BY team_object_id").all()
  if (rows.length > maximumProfiles || rows.some((row) => row.enabled !== 0 && row.enabled !== 1))
    throw new Error("Invalid Team profile catalog")
  const profiles = Object.freeze(rows.map((row) => Object.freeze({
    profile: teamProfileRef(binding, row.team_object_id), enabled: row.enabled === 1,
  })))
  if (header.config_revision === 0 && (profiles.some((entry) => !entry.enabled) ||
      JSON.stringify(profiles.map((entry) => entry.profile.teamObjectId)) !== header.bootstrap_ids))
    throw new Error("Unaudited Team profile bootstrap")
  // Auth-reader connections intentionally hold no transaction. Detect a concurrent external writer
  // across these synchronous SELECTs instead of publishing a mixed catalog.
  const final = readHeader(db)
  if (!final || JSON.stringify(final) !== JSON.stringify(header)) throw new Error("Team profile policy changed during read")
  return Object.freeze({ header: Object.freeze(header), configRevision: revision(header, header.config_revision), profiles })
}

function revision(header: Header, sequence: number) {
  return "sf-team-policy:" + createHash("sha256").update(JSON.stringify([
    header.installation_id, header.tenant_id, header.generation, sequence,
  ])).digest("hex")
}

function nextSequence(header: Header) {
  if (header.config_revision >= Number.MAX_SAFE_INTEGER) throw new Error("Team profile revision exhausted")
  return header.config_revision + 1
}

function advance(db: Database, header: Header, sequence: number) {
  const result = db.query("UPDATE sf_team_profile_policy SET config_revision = ? WHERE id = 1 AND generation = ? AND config_revision = ?")
    .run(sequence, header.generation, header.config_revision)
  if (result.changes !== 1) throw new Error("Team profile revision conflict")
}

function validRevision(value: number) {
  return Number.isSafeInteger(value) && value >= 0
}

function configurationBytes(document: TeamProfile.ConfigurationDocument) {
  const ordered = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(ordered)
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
      .filter(([, item]) => item !== undefined).toSorted(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, item]) => [key, ordered(item)]))
    return value
  }
  const encoded = JSON.stringify(ordered(Schema.encodeSync(TeamProfile.ConfigurationDocument)(document)))
  if (typeof encoded !== "string" || new TextEncoder().encode(encoded).byteLength > 65536)
    throw new Error("Team configuration exceeds limit")
  return encoded
}

function configurationDigest(profile: TeamProfile.Ref, bytes: string) {
  return createHash("sha256").update(JSON.stringify([
    "sf-team-configuration/1", profile.installationId, profile.tenantId, profile.teamObjectId, bytes,
  ])).digest("hex")
}

function readConfiguration(db: Database, binding: TeamProfilePolicyBinding, profile: TeamProfile.Ref): TeamProfile.ConfigurationSnapshot | undefined {
  const catalog = readCatalog(db, binding)
  if (!catalog.profiles.some((entry) => entry.profile.teamObjectId === profile.teamObjectId)) return undefined
  const row = db.query<StoredConfiguration, [string]>(
    "SELECT config_revision, document, document_digest FROM sf_team_configurations WHERE team_object_id = ?").get(profile.teamObjectId)
  if (!row) return undefined
  const latest = db.query<{ revision: number | null }, [string]>(
    "SELECT MAX(config_revision) AS revision FROM sf_team_profile_audit WHERE team_object_id = ? AND action = 'configuration'").get(profile.teamObjectId)
  if (!latest || latest.revision !== row.config_revision) throw new Error("Stale stored Team configuration")
  if (!validRevision(row.config_revision) || row.config_revision < 1 || row.config_revision > catalog.header.config_revision ||
      typeof row.document !== "string" || row.document.length > 65536 || !/^[a-f0-9]{64}$/.test(row.document_digest))
    throw new Error("Invalid stored Team configuration")
  const command = teamConfigurationCommand({ profile, expectedRevision: catalog.configRevision, document: JSON.parse(row.document) })
  if (!command) throw new Error("Invalid stored Team configuration document")
  const bytes = configurationBytes(command.document)
  const digest = configurationDigest(profile, bytes)
  if (bytes !== row.document || digest !== row.document_digest) throw new Error("Team configuration integrity mismatch")
  const audit = db.query<{ action: string; team_object_id: string; document_digest: string }, [number]>(
    "SELECT p.action, p.team_object_id, c.document_digest FROM sf_team_profile_audit p JOIN sf_team_configuration_audit c ON c.config_revision = p.config_revision AND c.team_object_id = p.team_object_id WHERE p.config_revision = ?").get(row.config_revision)
  if (!audit || audit.action !== "configuration" || audit.team_object_id !== profile.teamObjectId || audit.document_digest !== digest)
    throw new Error("Team configuration audit mismatch")
  if (readCatalog(db, binding).configRevision !== catalog.configRevision) throw new Error("Team configuration changed during read")
  return Object.freeze({
    origin: "installation-team-store", profile, configRevision: catalog.configRevision,
    document: freezeTeamConfiguration(command.document),
  })
}
