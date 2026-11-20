import type { Database } from "bun:sqlite"
import { Option, Schema } from "effect"
import { ConnectionAccess } from "@orchestra/schema/connection-access"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { teamConnectionCipher, teamConnectionDigest } from "./team-connection-crypto.ts"
import type { TeamConnectionKey } from "./team-connection-crypto.ts"

export type TeamConnectionBinding = Readonly<{ installationId: string; tenantId: string }>
export type TeamConnectionAccess = Readonly<{
  owner: TeamProfile.Owner
  key: TeamConnectionKey
  /** Fresh private policy plus the caller's current Owner/generation fence. No serialized proof is accepted. */
  authorize: (action: ConnectionAccess.Action, resources: readonly ConnectionAccess.Resource[]) => Promise<boolean>
  signal?: AbortSignal
}>
export type TeamConnectionStored = Readonly<{ metadata: ConnectionAccess.Metadata; encodedValue?: string }>
export interface TeamConnectionStore {
  readonly list: (access: TeamConnectionAccess, resources: readonly ConnectionAccess.Resource[]) => Promise<readonly ConnectionAccess.Metadata[]>
  readonly inspect: (access: TeamConnectionAccess, key: ConnectionAccess.Key) => Promise<ConnectionAccess.Metadata | undefined>
  readonly read: (access: TeamConnectionAccess, key: ConnectionAccess.Key) => Promise<TeamConnectionStored | undefined>
  readonly write: (access: TeamConnectionAccess, input: ConnectionAccess.Write) => Promise<TeamConnectionStored>
  readonly remove: (access: TeamConnectionAccess, input: ConnectionAccess.Remove) => Promise<void>
}
type Header = { installation_id: string; tenant_id: string; revision: number; key_version: number; key_fingerprint: string | null }
type Row = {
  team_object_id: string; principal_object_id: string; category: string; resource_id: string; connection_id: string
  revision: number; state: string; label: string; key_version: number; ciphertext: string | null; digest: string
}
const tableNames = ["sf_team_connection_header", "sf_team_connections", "sf_team_connection_audit"]
const maxRows = 10000
const unavailable = () => new Error("SF_TEAM_CONNECTION_UNAVAILABLE")
const conflict = () => new Error("SF_TEAM_CONNECTION_CONFLICT")

export function initializeTeamConnections(db: Database, input: TeamConnectionBinding): void {
  const binding = decodeBinding(input)
  const existing = db.query<{ name: string }, []>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('sf_team_connection_header','sf_team_connections','sf_team_connection_audit')",
  ).all()
  if (existing.length !== 0 && existing.length !== tableNames.length) throw unavailable()
  db.exec(`
    CREATE TABLE IF NOT EXISTS sf_team_connection_header (
      id INTEGER PRIMARY KEY CHECK(id=1), installation_id TEXT NOT NULL, tenant_id TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK(revision>=0), key_version INTEGER NOT NULL CHECK(key_version=1),
      key_fingerprint TEXT
    );
    CREATE TABLE IF NOT EXISTS sf_team_connections (
      team_object_id TEXT NOT NULL, principal_object_id TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('integration','mcp')), resource_id TEXT NOT NULL,
      connection_id TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>=1),
      state TEXT NOT NULL CHECK(state IN ('active','removed')), label TEXT NOT NULL,
      key_version INTEGER NOT NULL CHECK(key_version=1), ciphertext TEXT, digest TEXT NOT NULL,
      PRIMARY KEY(team_object_id,principal_object_id,category,resource_id,connection_id),
      UNIQUE(team_object_id,principal_object_id,category,connection_id),
      CHECK((state='active' AND ciphertext IS NOT NULL) OR (state='removed' AND ciphertext IS NULL))
    );
    CREATE TABLE IF NOT EXISTS sf_team_connection_audit (
      sequence INTEGER PRIMARY KEY CHECK(sequence>=1),
      team_object_id TEXT NOT NULL, principal_object_id TEXT NOT NULL, category TEXT NOT NULL,
      resource_id TEXT NOT NULL, connection_id TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK(revision>=1),
      action TEXT NOT NULL CHECK(action IN ('create','update','remove')), digest TEXT NOT NULL,
      UNIQUE(team_object_id,principal_object_id,category,resource_id,connection_id,revision)
    );
  `)
  if (existing.length === 0)
    db.query("INSERT INTO sf_team_connection_header(id,installation_id,tenant_id,revision,key_version,key_fingerprint) VALUES(1,?,?,0,1,NULL)")
      .run(binding.installationId, binding.tenantId)
  readHeader(db, binding)
}

export function createTeamConnectionStore(input: Readonly<{
  binding: TeamConnectionBinding
  locked: <T>(work: (db: Database) => Promise<T>, signal?: AbortSignal) => Promise<T>
  authorityRead: <T>(db: Database, work: () => Promise<T>, signal?: AbortSignal) => Promise<T>
}>): TeamConnectionStore {
  const binding = decodeBinding(input.binding)
  const prepare = (access: TeamConnectionAccess) => {
    const owner = Schema.decodeUnknownSync(TeamProfile.Owner)(access.owner)
    if (owner.profile.installationId !== binding.installationId || owner.profile.tenantId !== binding.tenantId)
      throw unavailable()
    const current = Object.freeze({
      profile: Object.freeze({ ...owner.profile }), principal: Object.freeze({ ...owner.principal }),
    })
    if (typeof access.authorize !== "function") throw unavailable()
    const authorize = access.authorize
    const signal = access.signal
    signal?.throwIfAborted()
    const cipher = teamConnectionCipher(access.key)
    return { owner: current, authorize, signal, cipher }
  }
  const execute = <T>(
    access: TeamConnectionAccess, action: ConnectionAccess.Action, resources: readonly ConnectionAccess.Resource[],
    work: (db: Database, current: ReturnType<typeof prepare>, header: Header) => T,
  ) => {
    // Freeze every selector/key before queueing or any authority await.
    const current = prepare(access)
    const requested = Object.freeze(Schema.decodeUnknownSync(ConnectionAccess.Resources)(resources)
      .map((resource) => Object.freeze({ ...resource })))
    return input.locked(async (db) => {
      current.signal?.throwIfAborted()
      const header = readHeader(db, binding)
      if (header.key_fingerprint !== null && header.key_fingerprint !== current.cipher.fingerprint) throw unavailable()
      if (!(await input.authorityRead(db, () => current.authorize(action, requested), current.signal))) throw new Error("SF_TEAM_CONNECTION_FORBIDDEN")
      current.signal?.throwIfAborted()
      // No await may occur between this final private authorization and read/SQL/CAS/audit/COMMIT.
      return work(db, current, header)
    }, current.signal)
  }
  const store: TeamConnectionStore = {
    list: (access, values) => {
      const resources = Object.freeze(Schema.decodeUnknownSync(ConnectionAccess.Resources)(values)
        .map((resource) => Object.freeze({ ...resource })))
      return execute(access, "read", resources, (db, current) => {
      const values: ConnectionAccess.Metadata[] = []
      for (const resource of resources) {
        const rows = db.query<Row, [string, string, string, string]>(
          "SELECT * FROM sf_team_connections WHERE team_object_id=? AND principal_object_id=? AND category=? AND resource_id=? ORDER BY connection_id",
        ).all(current.owner.profile.teamObjectId, current.owner.principal.principalObjectId, resource.category, resource.resourceId)
        const count = db.query<{ count: number }, [string, string, string, string]>(
          "SELECT COUNT(*) AS count FROM (SELECT connection_id FROM sf_team_connection_audit WHERE team_object_id=? AND principal_object_id=? AND category=? AND resource_id=? GROUP BY connection_id)",
        ).get(current.owner.profile.teamObjectId, current.owner.principal.principalObjectId, resource.category, resource.resourceId)
        if (count?.count !== rows.length || values.length + rows.length > maxRows) throw unavailable()
        for (const row of rows) {
          const stored = materialize(db, current.owner, row, current.cipher)
          if (stored.metadata.state === "active") values.push(stored.metadata)
        }
      }
      return Object.freeze(values)
      })
    },
    inspect: (access, key) => {
      const selected = Object.freeze({ ...Schema.decodeUnknownSync(ConnectionAccess.Key)(key) })
      return execute(access, "read", [resourceOf(selected)], (db, current) => {
        const row = readRow(db, current.owner, selected)
        return row ? inspectStored(db, current.owner, row) : undefined
      })
    },
    read: (access, key) => {
      const selected = Object.freeze({ ...Schema.decodeUnknownSync(ConnectionAccess.Key)(key) })
      return execute(access, "read", [resourceOf(selected)], (db, current) => {
        const row = readRow(db, current.owner, selected)
        return row ? materialize(db, current.owner, row, current.cipher) : undefined
      })
    },
    write: (access, value) => {
      const decoded = Schema.decodeUnknownSync(ConnectionAccess.Write)(value)
      if (Buffer.byteLength(decoded.encodedValue, "utf8") > 65536) throw unavailable()
      // Validate JSON without retaining an object supplied by a caller or allowing trailing bytes.
      Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown))(decoded.encodedValue)
      const command = Object.freeze({ ...decoded, key: Object.freeze({ ...decoded.key }) })
      return execute(access, command.action, [resourceOf(command.key)], (db, current, header) => {
        const before = readRow(db, current.owner, command.key)
        if ((before?.revision ?? 0) !== command.expectedRevision ||
            command.action === "create" && before?.state === "active" ||
            command.action === "update" && before?.state !== "active") throw conflict()
        if (before) materialize(db, current.owner, before, current.cipher)
        if (!before) {
          const count = db.query<{ count: number }, [string, string]>(
            "SELECT COUNT(*) AS count FROM sf_team_connections WHERE team_object_id=? AND principal_object_id=?",
          ).get(current.owner.profile.teamObjectId, current.owner.principal.principalObjectId)
          if (!count || count.count >= maxRows) throw unavailable()
        }
        const revision = command.expectedRevision + 1
        if (!Number.isSafeInteger(revision)) throw unavailable()
        const metadata = Schema.decodeUnknownSync(ConnectionAccess.Metadata)({
          key: command.key, label: command.label, revision, state: "active",
        })
        const ciphertext = current.cipher.seal(command.encodedValue, associated(current.owner, metadata))
        const row: Row = {
          team_object_id: current.owner.profile.teamObjectId, principal_object_id: current.owner.principal.principalObjectId,
          category: command.key.category, resource_id: command.key.resourceId, connection_id: command.key.id,
          revision, state: "active", label: command.label, key_version: 1, ciphertext,
          digest: rowDigest(current.owner, metadata, ciphertext),
        }
        commit(db, header, current.cipher.fingerprint, command.action, row)
        return Object.freeze({ metadata: freezeMetadata(metadata), encodedValue: command.encodedValue })
      })
    },
    remove: (access, value) => {
      const decoded = Schema.decodeUnknownSync(ConnectionAccess.Remove)(value)
      const command = Object.freeze({ ...decoded, key: Object.freeze({ ...decoded.key }) })
      return execute(access, "remove", [resourceOf(command.key)], (db, current, header) => {
        const before = readRow(db, current.owner, command.key)
        if (!before || before.revision !== command.expectedRevision) throw conflict()
        const stored = materialize(db, current.owner, before, current.cipher)
        if (before.state === "removed") return
        const metadata = Schema.decodeUnknownSync(ConnectionAccess.Metadata)({
          ...stored.metadata, revision: before.revision + 1, state: "removed",
        })
        const row: Row = { ...before, revision: metadata.revision, state: "removed", ciphertext: null,
          digest: rowDigest(current.owner, metadata, null) }
        commit(db, header, current.cipher.fingerprint, "remove", row)
      })
    },
  }
  return Object.freeze(store)
}

function decodeBinding(input: TeamConnectionBinding) {
  return Object.freeze({
    installationId: Schema.decodeUnknownSync(TeamProfile.InstallationId)(input.installationId),
    tenantId: Schema.decodeUnknownSync(TeamProfile.TenantId)(input.tenantId),
  })
}
function readHeader(db: Database, binding: TeamConnectionBinding): Header {
  const rows = db.query<Header, []>("SELECT installation_id,tenant_id,revision,key_version,key_fingerprint FROM sf_team_connection_header").all()
  const row = rows[0]
  const audit = db.query<{ revision: number | null; count: number }, []>("SELECT MAX(sequence) AS revision, COUNT(*) AS count FROM sf_team_connection_audit").get()
  const count = db.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM sf_team_connections").get()
  if (rows.length !== 1 || !row || row.installation_id !== binding.installationId || row.tenant_id !== binding.tenantId ||
      !Number.isSafeInteger(row.revision) || row.revision < 0 || row.key_version !== 1 || (audit?.revision ?? 0) !== row.revision || audit?.count !== row.revision ||
      row.key_fingerprint !== null && !/^[a-f0-9]{64}$/.test(row.key_fingerprint) ||
      row.key_fingerprint === null && (row.revision !== 0 || count?.count !== 0)) throw unavailable()
  return row
}
function resourceOf(key: ConnectionAccess.Key): ConnectionAccess.Resource {
  return Object.freeze({ category: key.category, resourceId: key.resourceId })
}
function rowParameters(owner: TeamProfile.Owner, key: ConnectionAccess.Key): [string, string, string, string, string] {
  return [owner.profile.teamObjectId, owner.principal.principalObjectId, key.category, key.resourceId, key.id]
}
function readRow(db: Database, owner: TeamProfile.Owner, key: ConnectionAccess.Key): Row | undefined {
  const row = db.query<Row, [string, string, string, string, string]>(
    "SELECT * FROM sf_team_connections WHERE team_object_id=? AND principal_object_id=? AND category=? AND resource_id=? AND connection_id=?",
  ).get(...rowParameters(owner, key)) ?? undefined
  if (!row) {
    const prior = db.query<{ revision: number | null }, [string, string, string, string, string]>(
      "SELECT MAX(revision) AS revision FROM sf_team_connection_audit WHERE team_object_id=? AND principal_object_id=? AND category=? AND resource_id=? AND connection_id=?",
    ).get(...rowParameters(owner, key))
    if (prior?.revision !== null && prior?.revision !== undefined) throw unavailable()
  }
  return row
}
function inspectStored(db: Database, owner: TeamProfile.Owner, row: Row): ConnectionAccess.Metadata {
  const metadata = Schema.decodeUnknownSync(ConnectionAccess.Metadata)({
    key: { category: row.category, resourceId: row.resource_id, id: row.connection_id },
    label: row.label, revision: row.revision, state: row.state,
  })
  const audit = db.query<{ revision: number; digest: string; action: string }, [string, string, string, string, string]>(
    "SELECT revision,digest,action FROM sf_team_connection_audit WHERE team_object_id=? AND principal_object_id=? AND category=? AND resource_id=? AND connection_id=? ORDER BY revision DESC LIMIT 1",
  ).get(...rowParameters(owner, metadata.key))
  if (row.team_object_id !== owner.profile.teamObjectId || row.principal_object_id !== owner.principal.principalObjectId ||
      !Number.isSafeInteger(row.revision) || row.key_version !== 1 || !audit || audit.revision !== row.revision || audit.digest !== row.digest ||
      (metadata.state === "removed") !== (audit.action === "remove") ||
      (metadata.state === "removed") !== (row.ciphertext === null) ||
      row.digest !== rowDigest(owner, metadata, row.ciphertext)) throw unavailable()
  // The state describes the retained record, not whether a provider will accept the credential.
  return freezeMetadata(metadata)
}
function materialize(db: Database, owner: TeamProfile.Owner, row: Row, cipher: ReturnType<typeof teamConnectionCipher>): TeamConnectionStored {
  const metadata = inspectStored(db, owner, row)
  const encodedValue = row.ciphertext === null ? undefined : cipher.open(row.ciphertext, associated(owner, metadata))
  if (encodedValue !== undefined && (Buffer.byteLength(encodedValue, "utf8") > 65536 ||
      Option.isNone(Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown))(encodedValue)))) throw unavailable()
  return Object.freeze({ metadata: freezeMetadata(metadata), ...(encodedValue === undefined ? {} : { encodedValue }) })
}
function associated(owner: TeamProfile.Owner, metadata: ConnectionAccess.Metadata) {
  return JSON.stringify({
    version: 1,
    owner: {
      profile: { installationId: owner.profile.installationId, tenantId: owner.profile.tenantId, teamObjectId: owner.profile.teamObjectId },
      principal: { tenantId: owner.principal.tenantId, principalObjectId: owner.principal.principalObjectId },
    },
    metadata: {
      key: { category: metadata.key.category, resourceId: metadata.key.resourceId, id: metadata.key.id },
      label: metadata.label, revision: metadata.revision, state: metadata.state,
    },
  })
}
function rowDigest(owner: TeamProfile.Owner, metadata: ConnectionAccess.Metadata, ciphertext: string | null) {
  return teamConnectionDigest({ associated: associated(owner, metadata), keyVersion: 1, ciphertext })
}
function freezeMetadata(value: ConnectionAccess.Metadata): ConnectionAccess.Metadata {
  return Object.freeze({ ...value, key: Object.freeze({ ...value.key }) })
}
function commit(db: Database, header: Header, fingerprint: string, action: "create" | "update" | "remove", row: Row) {
  const sequence = header.revision + 1
  if (!Number.isSafeInteger(sequence)) throw unavailable()
  db.query(`INSERT INTO sf_team_connections(team_object_id,principal_object_id,category,resource_id,connection_id,revision,state,label,key_version,ciphertext,digest)
    VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(team_object_id,principal_object_id,category,resource_id,connection_id)
    DO UPDATE SET revision=excluded.revision,state=excluded.state,label=excluded.label,key_version=excluded.key_version,ciphertext=excluded.ciphertext,digest=excluded.digest`)
    .run(row.team_object_id,row.principal_object_id,row.category,row.resource_id,row.connection_id,row.revision,row.state,row.label,row.key_version,row.ciphertext,row.digest)
  db.query("INSERT INTO sf_team_connection_audit(sequence,team_object_id,principal_object_id,category,resource_id,connection_id,revision,action,digest) VALUES(?,?,?,?,?,?,?,?,?)")
    .run(sequence,row.team_object_id,row.principal_object_id,row.category,row.resource_id,row.connection_id,row.revision,action,row.digest)
  const changed = db.query("UPDATE sf_team_connection_header SET revision=?,key_fingerprint=? WHERE id=1 AND revision=?")
    .run(sequence,fingerprint,header.revision)
  if (changed.changes !== 1) throw conflict()
  db.exec("COMMIT")
}
