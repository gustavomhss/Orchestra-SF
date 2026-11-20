import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { TeamProfileCensus } from "../src/database/team-profile-census"
import { openAuthorityControl } from "../src/database/sqlite.bun"
import { tmpdir } from "./fixture/tmpdir"

const storageId = "a".repeat(64), evidenceDigest = "b".repeat(64)
const owner = Schema.decodeUnknownSync(TeamProfile.Owner)({
  profile: { installationId: "explicit-installation", tenantId: "11111111-2222-4333-8444-555555555555",
    teamObjectId: "aaaaaaaa-2222-4333-8444-555555555555" },
  principal: { tenantId: "11111111-2222-4333-8444-555555555555", principalObjectId: "bbbbbbbb-2222-4333-8444-555555555555" },
})
async function fixture() {
  const directory = await tmpdir()
  const filename = path.join(directory.path, "legacy.sqlite")
  const original = new Database(filename)
  original.exec("CREATE TABLE session (id TEXT PRIMARY KEY, parent_id TEXT, title TEXT, private_data BLOB); CREATE TABLE event (id TEXT PRIMARY KEY, aggregate_id TEXT, type TEXT, data TEXT); CREATE TABLE migration (id TEXT PRIMARY KEY); CREATE TABLE credentials (id TEXT, secret TEXT); CREATE TABLE effect_receipt (id TEXT, result TEXT);")
  original.run("INSERT INTO session VALUES ('ses_parent', NULL, 'PRIVATE-TITLE', ?)", [new Uint8Array([0, 1, 255])])
  original.run("INSERT INTO session VALUES ('ses_child', 'ses_parent', 'PRIVATE-CHILD', NULL)")
  const created = (sessionID: string, parentID?: string) => JSON.stringify({
    sessionID, timestamp: 1, projectID: "project-census", location: { directory: "/private/census" },
    title: "ORIGINAL-PRIVATE-EVENT", ...(parentID ? { parentID } : {}),
  })
  original.run("INSERT INTO event VALUES ('original-event', 'ses_parent', 'session.next.created.1', ?)", [created("ses_parent")])
  original.run("INSERT INTO event VALUES ('retained-history', 'ses_deleted', 'session.next.created.1', ?)", [created("ses_deleted", "ses_parent")])
  original.run("INSERT INTO event VALUES ('deleted-history', 'ses_deleted', 'session.next.deleted.1', ?)",
    [JSON.stringify({ sessionID: "ses_deleted", timestamp: 2 })])
  original.run("INSERT INTO migration VALUES ('original-migration')")
  original.run("INSERT INTO credentials VALUES ('opaque-credential', 'NEVER-PUBLISH-THIS-TOKEN')")
  original.run("INSERT INTO effect_receipt VALUES ('original-effect', 'COMMITTED')")
  original.close(true)
  const driver = openAuthorityControl(filename)
  return {
    directory, filename, driver,
    snapshot: () => driver.all("SELECT type, name, sql FROM sqlite_master ORDER BY type, name"),
    async [Symbol.asyncDispose]() { driver.close(); await directory[Symbol.asyncDispose]() },
  }
}
function intention(report: TeamProfileCensus.Report): TeamProfileCensus.Intent {
  return {
    version: 1, storageId: report.storageId, sourceDigest: report.sourceDigest,
    decisions: report.sessions.map((session) => ({
      sessionId: session.id, sourceDigest: session.digest, disposition: "quarantine",
      reason: "unresolved-owner", evidenceDigest,
    })),
    tables: report.tables.map((table) => ({ name: table.name, schemaDigest: table.schemaDigest, disposition: "preserve-current" })),
  }
}

test("migration dry-run reads actual legacy SQLite without changing schema, data, events, auth or migration journal", async () => {
  await using f = await fixture()
  const before = f.snapshot()
  const fileHash = () => readFile(f.filename).then((bytes) => createHash("sha256").update(bytes).digest("hex"))
  const hash = await fileHash()
  const first = TeamProfileCensus.inspect(f.driver, storageId)
  const plan = TeamProfileCensus.plan(first, intention(first))
  expect(plan.requiresCurrentAuthorization).toBe(true)
  expect(plan.completeOwnership).toBe(false)
  expect(TeamProfileCensus.inspect(f.driver, storageId)).toEqual(first)
  expect(f.snapshot()).toEqual(before)
  expect(await fileHash()).toBe(hash)
  expect(f.driver.all("SELECT * FROM migration")).toEqual([{ id: "original-migration" }])
  expect(f.driver.all("SELECT * FROM credentials")).toEqual([{ id: "opaque-credential", secret: "NEVER-PUBLISH-THIS-TOKEN" }])
  expect(f.driver.all("SELECT * FROM effect_receipt")).toEqual([{ id: "original-effect", result: "COMMITTED" }])
  expect(first.sessions.map((session) => session.id)).toEqual(["ses_child", "ses_deleted", "ses_parent"])
  for (const privateText of ["PRIVATE-TITLE", "PRIVATE-CHILD", "ORIGINAL-PRIVATE-EVENT", "IMMUTABLE-HISTORY", "NEVER-PUBLISH-THIS-TOKEN"])
    expect(JSON.stringify({ first, plan })).not.toContain(privateText)
  expect(f.driver.all("SELECT name FROM sqlite_master WHERE name LIKE 'sf_control_%'")).toEqual([])
})

test("explicit ownership metadata stays a plan requiring current authority and never a grant", async () => {
  await using f = await fixture()
  const report = TeamProfileCensus.inspect(f.driver, storageId)
  const input = intention(report)
  const decisions: TeamProfileCensus.Decision[] = report.sessions.map((session) => ({
    sessionId: session.id, sourceDigest: session.digest, disposition: "map", owner, evidenceDigest,
  }))
  const plan = TeamProfileCensus.plan(report, { ...input, decisions })
  expect(plan.completeOwnership).toBe(true)
  expect(plan.requiresCurrentAuthorization).toBe(true)
  expect(plan.decisions).toHaveLength(3)
  expect(f.driver.all("SELECT name FROM sqlite_master WHERE name = 'session_owner'")).toEqual([])
  expect(TeamProfileCensus.inspect(f.driver, storageId)).toEqual(report)
})

test("missing or duplicate mappings, cross-owner parent/child and incomplete table classifications are refused", async () => {
  await using f = await fixture()
  const report = TeamProfileCensus.inspect(f.driver, storageId), input = intention(report)
  expect(() => TeamProfileCensus.plan(report, { ...input, decisions: [] })).toThrow("mapping")
  expect(() => TeamProfileCensus.plan(report, { ...input, decisions: [input.decisions[0]!, input.decisions[0]!, input.decisions[2]!] })).toThrow("mapping")
  const mapped: TeamProfileCensus.Decision = { sessionId: "ses_parent", sourceDigest: report.sessions.find((row) => row.id === "ses_parent")!.digest,
    disposition: "map", owner, evidenceDigest }
  expect(() => TeamProfileCensus.plan(report, { ...input, decisions: input.decisions.map((row) => row.sessionId === "ses_parent" ? mapped : row) })).toThrow("relation")
  expect(() => TeamProfileCensus.plan(report, { ...input, tables: [] })).toThrow("classification")
  expect(TeamProfileCensus.inspect(f.driver, storageId)).toEqual(report)
})

test("source/schema/typed content changes invalidate the reviewed census, including NUL and blob bytes", async () => {
  await using f = await fixture()
  const report = TeamProfileCensus.inspect(f.driver, storageId), input = intention(report)
  f.driver.execute("UPDATE session SET title = ? WHERE id = 'ses_parent'", ["PRIVATE-TITLE\0TAIL"])
  const changed = TeamProfileCensus.inspect(f.driver, storageId)
  expect(changed.sourceDigest).not.toBe(report.sourceDigest)
  expect(() => TeamProfileCensus.plan(changed, input)).toThrow("changed-source")
  f.driver.execute("CREATE TABLE unknown_writer (id TEXT)")
  const expanded = TeamProfileCensus.inspect(f.driver, storageId)
  expect(expanded.tables.some((row) => row.name === "unknown_writer")).toBe(true)
  expect(expanded.sourceDigest).not.toBe(changed.sourceDigest)
  expect(() => TeamProfileCensus.plan(expanded, input)).toThrow("changed-source")
})

test("deleted Session relationships come from the canonical immutable Created event", async () => {
  await using f = await fixture()
  const report = TeamProfileCensus.inspect(f.driver, storageId), input = intention(report)
  const historic = report.sessions.find((row) => row.id === "ses_deleted")
  expect(historic?.parentId).toBe("ses_parent")
  expect(historic?.issues).toEqual([])
  const mapped = report.sessions.map((session): TeamProfileCensus.Decision => ({
    sessionId: session.id, sourceDigest: session.digest, disposition: "map", owner, evidenceDigest,
  }))
  const other = Schema.decodeUnknownSync(TeamProfile.Owner)({ ...owner,
    profile: { ...owner.profile, teamObjectId: "cccccccc-2222-4333-8444-555555555555" } })
  expect(() => TeamProfileCensus.plan(report, { ...input,
    decisions: mapped.map((row) => row.sessionId === "ses_deleted" ? { ...row, owner: other } : row),
  })).toThrow("relation")
  expect(TeamProfileCensus.inspect(f.driver, storageId)).toEqual(report)
})

test("unknown or contradictory history is reported without private text and cannot become a mapped grant", async () => {
  await using f = await fixture()
  f.driver.execute("UPDATE event SET type = 'session.created.legacy' WHERE id = 'retained-history'")
  const unknown = TeamProfileCensus.inspect(f.driver, storageId), input = intention(unknown)
  expect(unknown.sessions.find((row) => row.id === "ses_deleted")?.issues).toEqual(["missing-creation", "unknown-history"])
  expect(TeamProfileCensus.plan(unknown, input).completeOwnership).toBe(false)
  expect(() => TeamProfileCensus.plan(unknown, { ...input, decisions: unknown.sessions.map((row) => ({
    sessionId: row.id, sourceDigest: row.digest, disposition: "map", owner, evidenceDigest,
  })) })).toThrow("mapping")
  f.driver.execute("UPDATE event SET type = 'session.next.created.1' WHERE id = 'retained-history'")
  f.driver.execute("UPDATE session SET parent_id = 'ses_deleted' WHERE id = 'ses_parent'")
  const conflict = TeamProfileCensus.inspect(f.driver, storageId)
  expect(conflict.sessions.find((row) => row.id === "ses_parent")?.issues).toEqual(["ambiguous-history"])
  expect(JSON.stringify(conflict)).not.toContain("ORIGINAL-PRIVATE-EVENT")
})

test("the same read-only census can run under the migration write lock without committing it", async () => {
  await using f = await fixture()
  const original = TeamProfileCensus.inspect(f.driver, storageId)
  expect(() => TeamProfileCensus.inspectInTransaction(f.driver, storageId)).toThrow("schema")
  f.driver.execute("BEGIN IMMEDIATE")
  try {
    expect(TeamProfileCensus.inspectInTransaction(f.driver, storageId)).toEqual(original)
    expect(f.driver.inTransaction()).toBe(true)
    expect(() => TeamProfileCensus.inspect(f.driver, storageId)).toThrow("schema")
  } finally { f.driver.execute("ROLLBACK") }
  expect(TeamProfileCensus.inspect(f.driver, storageId)).toEqual(original)
})
