import { expect, test } from "bun:test"
import { Context, Effect, Exit, Layer } from "effect"
import { sql } from "drizzle-orm"
import { Credential } from "../src/credential"
import { Database } from "../src/database/database"
import { AppNodeBuilder } from "../src/effect/app-node-builder"
import { LayerNode } from "../src/effect/layer-node"
import { Inbox } from "../src/inbox/service"
import { SlackAuth } from "../src/inbox/slack-auth"
import { Location } from "../src/location"
import { ProjectV2 } from "../src/project"
import { SessionOwner } from "../src/session/owner"
import { teamSessionFixture } from "./fixture/team-session"
import { tempLocationLayer } from "./fixture/location"
import { tmpdir } from "./fixture/tmpdir"

test("team-inbox-01: corporate boot never adopts old installation rows or probes credentials, and Inbox remains unavailable", async () => {
  await using f = await teamSessionFixture({ extraNodes: [Credential.node, SlackAuth.node] })
  f.business.execute("INSERT INTO inbox_row (owner,source,external_id,list_id,actor,snippet,thread_id,reply,open) VALUES (?,?,?,?,?,?,?,?,?)",
    ["legacy-person", "slack", "legacy-message", "in_legacy", "legacy-actor", "QUARANTINED-INBOX", "legacy-thread", 1, 1])
  f.business.execute("INSERT INTO inbox_draft (owner,list_id,text,sent) VALUES (?,?,?,?)",
    ["legacy-person", "in_legacy", "QUARANTINED-DRAFT", 0])
  const beforeRows = f.business.all("SELECT * FROM inbox_row ORDER BY owner,source,external_id")
  const beforeDrafts = f.business.all("SELECT * FROM inbox_draft ORDER BY owner,list_id")
  const beforeCredentials = f.business.all("SELECT * FROM credential ORDER BY id")
  await f.run(f.admitted(f.businessRequest(), Effect.gen(function* () {
    const database = yield* Database.Service
    const owners = yield* SessionOwner.Service
    const credentials = yield* Credential.Service
    const slack = yield* SlackAuth.Service
    let reads = 0
    const original = credentials.all
    Object.assign(credentials, { all: () => { reads++; return original() } })
    const context = yield* Layer.build(LayerNode.compile(Inbox.node, [
      [Database.node, Layer.succeed(Database.Service, database)],
      [SessionOwner.node, Layer.succeed(SessionOwner.Service, owners)],
      [Credential.node, Layer.succeed(Credential.Service, credentials)],
      [SlackAuth.node, Layer.succeed(SlackAuth.Service, slack)],
      [Location.node, Layer.succeed(Location.Service, { directory: f.location.directory,
        project: { id: ProjectV2.ID.global, directory: f.location.directory } })],
    ]))
    const inbox = Context.get(context, Inbox.Service)
    expect(reads).toBe(0)
    expect(Exit.isFailure(yield* Effect.exit(inbox.list()))).toBe(true)
    expect(Exit.isFailure(yield* Effect.exit(inbox.accounts()))).toBe(true)
    expect(Exit.isFailure(yield* Effect.exit(inbox.connect({ source: "github", token: "NO-EXTERNAL-USE" })))).toBe(true)
    expect(Exit.isFailure(yield* Effect.exit(inbox.slackStart()))).toBe(true)
    expect(Exit.isFailure(yield* Effect.exit(inbox.saveDraft("in_legacy", "MUST-NOT-WRITE")))).toBe(true)
    expect(reads).toBe(0)
    Object.assign(credentials, { all: original })
  })))
  expect(f.business.all("SELECT * FROM inbox_row ORDER BY owner,source,external_id")).toEqual(beforeRows)
  expect(f.business.all("SELECT * FROM inbox_draft ORDER BY owner,list_id")).toEqual(beforeDrafts)
  expect(f.business.all("SELECT * FROM credential ORDER BY id")).toEqual(beforeCredentials)
}, 30000)

test("team-inbox-02: an already constructed technical Inbox refuses a subsequently marked corporate database", async () => {
  await using directory = await tmpdir()
  const filename = `${directory.path}/inbox.sqlite`
  const layer = AppNodeBuilder.build(LayerNode.group([Inbox.node, Database.node]), [
    [Location.node, tempLocationLayer],
    [Database.node, Database.layerFromPath(filename)],
  ])
  await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const inbox = yield* Inbox.Service
    const database = yield* Database.Service
    expect(yield* inbox.list()).toEqual([])
    // Even a malformed/empty marker is corporate-unavailable; no private authority is manufactured.
    yield* database.db.run(sql`CREATE TABLE sf_authority_generation (id INTEGER PRIMARY KEY)`)
    expect(Exit.isFailure(yield* Effect.exit(inbox.list()))).toBe(true)
    expect(Exit.isFailure(yield* Effect.exit(inbox.accounts()))).toBe(true)
  }).pipe(Effect.provide(layer))))
  // Inspect retained bytes separately: the production adapter correctly refuses every read of a malformed marker.
  const retained = await inspectRetainedInbox(filename)
  expect(retained.rows).toEqual([])
  expect(retained.markers).toEqual([{ name: "sf_authority_generation" }])
}, 30000)

async function inspectRetainedInbox(filename: string) {
  const { Database } = await import("bun:sqlite")
  const inspection = new Database(filename, { readonly: true })
  try {
    return {
      rows: inspection.query("SELECT * FROM inbox_row").all(),
      markers: inspection.query("SELECT name FROM sqlite_master WHERE name = 'sf_authority_generation'").all(),
    }
  } finally {
    inspection.close()
  }
}
