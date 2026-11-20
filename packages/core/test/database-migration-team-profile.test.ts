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
  original.run("INSERT INTO session VALUES ('parent', NULL, 'PRIVATE-TITLE', ?)", [new Uint8Array([0, 1, 255])])
  original.run("INSERT INTO session VALUES ('child', 'parent', 'PRIVATE-CHILD', NULL)")
  original.run("INSERT INTO event VALUES ('original-event', 'parent', 'session.created', 'ORIGINAL-PRIVATE-EVENT')")
  original.run("INSERT INTO event VALUES ('retained-history', 'deleted-session', 'session.deleted', 'IMMUTABLE-HISTORY')")
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
  expect(first.sessions.map((session) => session.id)).toEqual(["child", "deleted-session", "parent"])
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
  const mapped: TeamProfileCensus.Decision = { sessionId: "parent", sourceDigest: report.sessions.find((row) => row.id === "parent")!.digest,
    disposition: "map", owner, evidenceDigest }
  expect(() => TeamProfileCensus.plan(report, { ...input, decisions: input.decisions.map((row) => row.sessionId === "parent" ? mapped : row) })).toThrow("relation")
  expect(() => TeamProfileCensus.plan(report, { ...input, tables: [] })).toThrow("classification")
  expect(TeamProfileCensus.inspect(f.driver, storageId)).toEqual(report)
})

test("source/schema/typed content changes invalidate the reviewed census, including NUL and blob bytes", async () => {
  await using f = await fixture()
  const report = TeamProfileCensus.inspect(f.driver, storageId), input = intention(report)
  f.driver.execute("UPDATE session SET title = ? WHERE id = 'parent'", ["PRIVATE-TITLE\0TAIL"])
  const changed = TeamProfileCensus.inspect(f.driver, storageId)
  expect(changed.sourceDigest).not.toBe(report.sourceDigest)
  expect(() => TeamProfileCensus.plan(changed, input)).toThrow("changed-source")
  f.driver.execute("CREATE TABLE unknown_writer (id TEXT)")
  const expanded = TeamProfileCensus.inspect(f.driver, storageId)
  expect(expanded.tables.some((row) => row.name === "unknown_writer")).toBe(true)
  expect(expanded.sourceDigest).not.toBe(changed.sourceDigest)
  expect(() => TeamProfileCensus.plan(expanded, input)).toThrow("changed-source")
})
