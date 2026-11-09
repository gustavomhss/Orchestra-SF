import { expect } from "bun:test"
import { sql } from "drizzle-orm"
import { DateTime, Effect, Layer } from "effect"
import { Database } from "@orchestra/core/database/database"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { EventV2 } from "@orchestra/core/event"
import { ProjectV2 } from "@orchestra/core/project"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionV2 } from "@orchestra/core/session"
import { SessionArchive } from "../src/session/archive"
import { SessionExecution } from "@orchestra/core/session/execution"
import { testEffect } from "./lib/effect"

const projects = Layer.succeed(ProjectV2.Service, ProjectV2.Service.of({
  resolve: () => Effect.succeed({ id: ProjectV2.ID.global, directory: AbsolutePath.make("/project") }),
  list: () => Effect.succeed([]), directories: () => Effect.succeed([]), commit: () => Effect.void,
}))
const it = testEffect(AppNodeBuilder.build(LayerNode.group([Database.node, EventV2.node, SessionV2.node]), [
  [ProjectV2.node, projects], [SessionExecution.node, SessionExecution.noopLayer],
]))

it.live("lists despite malformed unused JSON", () => Effect.gen(function* () {
  const database = yield* Database.Service
  const session = yield* SessionV2.Service
  const created = yield* session.create({ location: { directory: AbsolutePath.make("/project") } })
  yield* database.db.run(sql`UPDATE session SET metadata = '{broken', permission = '{broken', summary_diffs = '{broken',
    parent_id = 'ses_parent', agent = 'backend', model = '{"id":"model","providerID":"provider","variant":"fast"}',
    subagent_models = '{"mode":"allowlist","models":[]}', workspace_id = 'wrk_test', path = 'sub',
    revert = '{"messageID":"msg_test","files":[]}', cost = 2.5, tokens_input = 1, tokens_output = 2,
    tokens_reasoning = 3, tokens_cache_read = 4, tokens_cache_write = 5, time_created = 10, time_updated = 20
    WHERE id = ${created.id}`)
  expect(yield* SessionArchive.list(database.db)).toMatchObject([{
    id: created.id, projectID: ProjectV2.ID.global, parentID: "ses_parent", agent: "backend",
    model: { id: "model", providerID: "provider", variant: "fast" },
    subagentModels: { mode: "allowlist", models: [] }, location: { directory: "/project", workspaceID: "wrk_test" },
    subpath: "sub", revert: { messageID: "msg_test", files: [] }, cost: 2.5,
    tokens: { input: 1, output: 2, reasoning: 3, cache: { read: 4, write: 5 } },
    time: { created: DateTime.makeUnsafe(10), updated: DateTime.makeUnsafe(20) },
  }])
}))

it.live("uses the production projection and captures migrated database query plans", () => Effect.gen(function* () {
  const database = yield* Database.Service
  const session = yield* SessionV2.Service
  const created = yield* session.create({ location: { directory: AbsolutePath.make("/project") } })
  yield* database.db.run(sql`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 4096)
    INSERT INTO session (id, project_id, slug, directory, title, version, time_created, time_updated)
    SELECT 'ses_synthetic_' || n, project_id, 'synthetic', directory, 'Synthetic', version, n, n
    FROM session, seq WHERE id = ${created.id}`)
  const count = yield* database.db.all(sql`SELECT count(*) AS count FROM session WHERE id LIKE 'ses_synthetic_%'`)
  expect(count).toEqual([{ count: 4096 }])
  const control = yield* database.db.$client.unsafe<{ detail: string }>("EXPLAIN QUERY PLAN SELECT 1")
  expect(control[0].detail).toBeTruthy()
  for (const input of [
    { project: ProjectV2.ID.global, limit: 25 },
    { directory: AbsolutePath.make("/project"), limit: 25 },
  ]) {
    const compiled = SessionArchive.query(database.db, input).statement.toSQL()
    const selected = compiled.sql.split(/\sfrom\s/i)[0]
    expect(selected.match(/"[a-z_]+"/g)?.map((name) => name.slice(1, -1))).toEqual([
      "id", "project_id", "title", "parent_id", "agent", "subagent_models", "model", "cost", "tokens_input",
      "tokens_output", "tokens_reasoning", "tokens_cache_read", "tokens_cache_write", "directory", "workspace_id",
      "path", "revert", "time_created", "time_updated", "time_archived",
    ])
    const plan = yield* database.db.$client.unsafe<{ detail: string }>("EXPLAIN QUERY PLAN " + compiled.sql, compiled.params)
    expect(plan[0].detail).toBeTruthy()
    console.log("session list plan", "project" in input ? "project" : "directory", plan.map((row) => row.detail))
  }
}))
