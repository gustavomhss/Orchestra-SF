export * as TeamProfileCensus from "./team-profile-census"

import { createHash } from "node:crypto"
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { Event } from "@orchestra/schema/event"
import { SessionEvent } from "@orchestra/schema/session-event"
import { SessionOwnerEvent } from "@orchestra/schema/session-owner-event"
import type { AuthoritySqlFence } from "./authority-sql-fence"

type Driver = AuthoritySqlFence.Driver
type Table = Readonly<{ name: string; schemaDigest: string; dataDigest: string; rows: number }>
type Session = Readonly<{ id: string; parentId?: string; digest: string; owner?: TeamProfile.Owner; issues: readonly ("unknown-history" | "invalid-history" | "ambiguous-history" | "missing-creation")[] }>
export type Report = Readonly<{
  version: 1
  storageId: string
  sourceDigest: string
  tables: readonly Table[]
  sessions: readonly Session[]
  integrity: "ok"
}>
export type Decision =
  | Readonly<{ sessionId: string; sourceDigest: string; disposition: "map"; owner: TeamProfile.Owner; evidenceDigest: string }>
  | Readonly<{ sessionId: string; sourceDigest: string; disposition: "quarantine"; reason: "unresolved-owner" | "ambiguous-owner" | "scope-conflict"; evidenceDigest: string }>
export type TableDisposition = "preserve-current" | "rewind-data" | "quarantine" | "technical"
export type Intent = Readonly<{
  version: 1
  storageId: string
  sourceDigest: string
  decisions: readonly Decision[]
  tables: readonly Readonly<{ name: string; schemaDigest: string; disposition: TableDisposition }>[]
}>
export type Plan = Readonly<{
  version: 1
  storageId: string
  sourceDigest: string
  planDigest: string
  decisions: readonly Decision[]
  tables: Intent["tables"]
  requiresCurrentAuthorization: true
  completeOwnership: boolean
}>

export class Invalid extends Error {
  readonly _tag = "TeamProfileCensusInvalid"
  constructor(readonly reason: "schema" | "integrity" | "budget" | "changed-source" | "mapping" | "relation" | "classification") {
    super("Team profile census: " + reason)
  }
}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex")
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
const name = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 256 && !/[\u0000-\u001f\u007f]/.test(value)
const identifier = (value: string) => '"' + value.replaceAll('"', '""') + '"'
const decodeOwner = (value: unknown): TeamProfile.Owner => {
  const owner = Schema.decodeUnknownSync(TeamProfile.Owner)(value)
  return Object.freeze({ profile: Object.freeze({ ...owner.profile }), principal: Object.freeze({ ...owner.principal }) })
}
const sameOwner = (a: TeamProfile.Owner, b: TeamProfile.Owner) =>
  a.profile.installationId === b.profile.installationId && a.profile.tenantId === b.profile.tenantId &&
  a.profile.teamObjectId === b.profile.teamObjectId && a.principal.tenantId === b.principal.tenantId &&
  a.principal.principalObjectId === b.principal.principalObjectId

/**
 * Read-only, coherent census. Neither this report nor a reviewed JSON intent
 * authorizes migration. No control store is opened, schema created or network
 * request made. Content is hashed in memory and never returned in the report.
 */
export function inspect(driver: Driver, storageId: string): Report {
  if (driver.inTransaction()) throw new Invalid("schema")
  driver.execute("BEGIN")
  try {
    const report = inspectInTransaction(driver, storageId)
    driver.execute("COMMIT")
    return report
  } catch (error) {
    if (driver.inTransaction()) driver.execute("ROLLBACK")
    throw error
  }
}

/** Read only inside the migrator's already-held SQLite write transaction. */
export function inspectInTransaction(driver: Driver, storageId: string): Report {
  if (!digest(storageId) || !driver.inTransaction()) throw new Invalid("schema")
  const integrity = driver.all("PRAGMA integrity_check")
  if (integrity.length !== 1 || integrity[0]?.integrity_check !== "ok" || driver.all("PRAGMA foreign_key_check").length)
    throw new Invalid("integrity")
  const objects = driver.all("SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name")
  const tableNames = objects.filter((row) => row.type === "table").map((row) => row.name)
  const names: string[] = []
  for (const item of tableNames) { if (!name(item)) throw new Invalid("schema"); names.push(item) }
  if (new Set(names).size !== names.length || names.length > 1024) throw new Invalid("schema")
  const tables: Table[] = []
  let totalRows = 0, totalBytes = 0
  for (const table of names) {
    const fields = driver.all("PRAGMA table_info(" + identifier(table) + ")").map((row) => row.name)
    const columns: string[] = []
    for (const item of fields) { if (!name(item)) throw new Invalid("schema"); columns.push(item) }
    if (!columns.length || new Set(columns).size !== columns.length) throw new Invalid("schema")
    const budget = driver.all("SELECT count(*) AS rows, COALESCE(sum(" +
      columns.map((column) => "COALESCE(length(CAST(" + identifier(column) + " AS BLOB)),0)").join(" + ") +
      "),0) AS bytes FROM " + identifier(table))[0]
    if (!budget || typeof budget.rows !== "number" || typeof budget.bytes !== "number" ||
        budget.rows + totalRows > 100000 || budget.bytes * 2 + totalBytes > 64 * 1024 * 1024) throw new Invalid("budget")
    // Exact typed SQLite values, including NUL-containing text, blobs and real
    // numbers. Sorting canonical rows makes physical row order irrelevant.
    const expressions = columns.flatMap((column, index) => [
      "typeof(" + identifier(column) + ") AS " + identifier("t" + index),
      "CASE typeof(" + identifier(column) + ") WHEN 'null' THEN NULL WHEN 'text' THEN hex(" + identifier(column) +
      ") WHEN 'blob' THEN hex(" + identifier(column) + ") WHEN 'real' THEN printf('%!.26g', " + identifier(column) +
      ") ELSE CAST(" + identifier(column) + " AS TEXT) END AS " + identifier("v" + index),
    ])
    const rows = driver.all("SELECT " + expressions.join(", ") + " FROM " + identifier(table) + " LIMIT 100001")
    totalRows += rows.length
    if (totalRows > 100000) throw new Invalid("budget")
    const encoded = rows.map((row) => JSON.stringify(columns.map((_, index) => [row["t" + index], row["v" + index]]))).sort()
    totalBytes += encoded.reduce((sum, row) => sum + Buffer.byteLength(row), 0)
    if (totalBytes > 64 * 1024 * 1024) throw new Invalid("budget")
    tables.push(Object.freeze({
      name: table, rows: rows.length,
      schemaDigest: hash(objects.filter((row) => row.tbl_name === table)),
      dataDigest: hash([columns, encoded]),
    }))
  }
  if (!names.includes("session") || !names.includes("event")) throw new Invalid("schema")
  const rows = driver.all("SELECT id, parent_id FROM session ORDER BY id")
  const historic = driver.all("SELECT aggregate_id AS id, type, data FROM event WHERE type LIKE 'session.%' ORDER BY aggregate_id, id")
  const definitions: ReadonlyMap<string, Event.Definition> = Event.durable([...SessionEvent.DurableDefinitions, SessionOwnerEvent.Bound])
  type History = { created: boolean; parentId?: string; hashes: string[]; issues: Set<Session["issues"][number]> }
  const history = new Map<string, History>()
  for (const event of historic) {
    if (!name(event.id)) throw new Invalid("schema")
    const value: History = history.get(event.id) ?? { created: false, hashes: [], issues: new Set<Session["issues"][number]>() }
    history.set(event.id, value)
    value.hashes.push(hash([event.type, event.data]))
    const definition = typeof event.type === "string" ? definitions.get(event.type) : undefined
    if (!definition) { value.issues.add("unknown-history"); continue }
    try {
      if (typeof event.data !== "string") throw new Invalid("schema")
      const raw: unknown = JSON.parse(event.data)
      const decoded: unknown = Schema.decodeUnknownSync(definition.data)(raw)
      if (!decoded || typeof decoded !== "object" || !("sessionID" in decoded) || decoded.sessionID !== event.id)
        throw new Invalid("schema")
      if (definition.type === SessionEvent.Created.type) {
        const created = Schema.decodeUnknownSync(SessionEvent.Created.data)(raw)
        if (value.created) value.issues.add("ambiguous-history")
        else { value.created = true; value.parentId = created.parentID }
      }
    } catch { value.issues.add("invalid-history") }
  }
  const owners = names.includes("session_owner") ? driver.all("SELECT * FROM session_owner ORDER BY session_id") : []
  const ids = new Set<string>()
  for (const row of [...rows, ...historic, ...owners.map((row) => ({ id: row.session_id }))]) {
    if (!name(row.id)) throw new Invalid("schema")
    ids.add(row.id)
  }
  for (const row of rows) if (typeof row.parent_id === "string") ids.add(row.parent_id)
  for (const value of history.values()) if (value.parentId) ids.add(value.parentId)
  const sessions: Session[] = [...ids].sort().map((id) => {
    const row = rows.find((item) => item.id === id)
    const retained = owners.find((item) => item.session_id === id)
    const provenance = history.get(id)
    if (provenance && !provenance.created && !row && !retained) provenance.issues.add("missing-creation")
    const parentId = row?.parent_id ?? provenance?.parentId
    if (row && provenance?.created && (row.parent_id ?? undefined) !== provenance.parentId)
      provenance.issues.add("ambiguous-history")
    if (parentId !== undefined && parentId !== null && !name(parentId)) throw new Invalid("schema")
    const owner = retained ? decodeOwner({
      profile: { installationId: retained.installation_id, tenantId: retained.tenant_id, teamObjectId: retained.team_object_id },
      principal: { tenantId: retained.tenant_id, principalObjectId: retained.principal_object_id },
    }) : undefined
    const blocked = new Set<Session["issues"][number]>(provenance?.issues)
    if (!row && !retained && !provenance?.created) blocked.add("missing-creation")
    const issues = Object.freeze([...blocked].toSorted())
    return Object.freeze({ id, ...(typeof parentId === "string" ? { parentId } : {}),
      ...(owner ? { owner } : {}), issues,
      digest: hash([id, parentId ?? null, owner ?? null, provenance?.hashes.toSorted() ?? [], issues]) })
  })
  const ordered = tables.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  const sourceDigest = hash([storageId, objects, ordered, sessions])
  return Object.freeze({ version: 1, storageId, sourceDigest, tables: Object.freeze(ordered),
    sessions: Object.freeze(sessions), integrity: "ok" })
}

/** Validate a complete explicit classification; never infer owner from placement or a label. */
export function plan(report: Report, intent: Intent): Plan {
  if (!intent || intent.version !== 1 || intent.storageId !== report.storageId || intent.sourceDigest !== report.sourceDigest)
    throw new Invalid("changed-source")
  if (!Array.isArray(intent.decisions) || intent.decisions.length !== report.sessions.length ||
      new Set(intent.decisions.map((item) => item.sessionId)).size !== intent.decisions.length)
    throw new Invalid("mapping")
  const decisions: Decision[] = intent.decisions.map((item) => {
    const original = report.sessions.find((row) => row.id === item.sessionId)
    if (!original || item.sourceDigest !== original.digest || !digest(item.evidenceDigest)) throw new Invalid("mapping")
    if (item.disposition === "quarantine") {
      if (!["unresolved-owner", "ambiguous-owner", "scope-conflict"].includes(item.reason)) throw new Invalid("mapping")
      return Object.freeze({ sessionId: item.sessionId, sourceDigest: item.sourceDigest, disposition: "quarantine",
        reason: item.reason, evidenceDigest: item.evidenceDigest })
    }
    if (item.disposition !== "map" || original.issues.length) throw new Invalid("mapping")
    const owner = decodeOwner(item.owner)
    if (original.owner && !sameOwner(original.owner, owner)) throw new Invalid("mapping")
    return Object.freeze({ sessionId: item.sessionId, sourceDigest: item.sourceDigest, disposition: "map",
      owner, evidenceDigest: item.evidenceDigest })
  }).sort((a, b) => a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : 0)
  for (const session of report.sessions) {
    if (!session.parentId) continue
    const child = decisions.find((item) => item.sessionId === session.id)
    const parent = decisions.find((item) => item.sessionId === session.parentId)
    if (!parent || !child || child.disposition !== parent.disposition ||
        child.disposition === "map" && parent.disposition === "map" && !sameOwner(child.owner, parent.owner))
      throw new Invalid("relation")
  }
  if (!Array.isArray(intent.tables) || intent.tables.length !== report.tables.length ||
      new Set(intent.tables.map((row) => row.name)).size !== intent.tables.length) throw new Invalid("classification")
  const tables = intent.tables.map((item) => {
    const table = report.tables.find((row) => row.name === item.name)
    if (!table || item.schemaDigest !== table.schemaDigest ||
        !["preserve-current", "rewind-data", "quarantine", "technical"].includes(item.disposition))
      throw new Invalid("classification")
    return Object.freeze({ name: item.name, schemaDigest: item.schemaDigest, disposition: item.disposition })
  }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  const value = { version: 1 as const, storageId: report.storageId, sourceDigest: report.sourceDigest,
    decisions: Object.freeze(decisions), tables: Object.freeze(tables) }
  return Object.freeze({ ...value, planDigest: hash(value), requiresCurrentAuthorization: true,
    completeOwnership: decisions.every((row) => row.disposition === "map") })
}
