import { $ } from "bun"
import { describe, expect } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { DateTime, Effect, Layer, Schema } from "effect"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Database } from "@orchestra/core/database/database"
import { EventV2 } from "@orchestra/core/event"
import { Global } from "@orchestra/core/global"
import { Location } from "@orchestra/core/location"
import { ModelV2 } from "@orchestra/core/model"
import { Project } from "@orchestra/core/project"
import { ProjectTable } from "@orchestra/core/project/sql"
import { ProviderV2 } from "@orchestra/core/provider"
import { AbsolutePath, RelativePath } from "@orchestra/core/schema"
import { Session } from "@orchestra/schema/session"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionRevert } from "../src/session/revert"
import { SessionProjector } from "@orchestra/core/session/projector"
import { SessionMessageTable, SessionTable } from "@orchestra/core/session/sql"
import { Snapshot } from "@orchestra/core/snapshot"
import { tmpdir } from "./fixture/tmpdir"
import { testEffect } from "./lib/effect"

const encode = Schema.encodeSync(SessionMessage.Message)
const model = { id: ModelV2.ID.make("model"), providerID: ProviderV2.ID.make("provider") }
const created = DateTime.makeUnsafe(0)
const sessionID = Session.ID.make("ses_revert_files")

const layer = (data: string, directory: string) =>
  AppNodeBuilder.build(LayerNode.group([Database.node, EventV2.node, SessionProjector.node, Snapshot.node]), [
    [Location.node, Location.boundNode(Location.Ref.make({ directory: AbsolutePath.make(directory) }))],
    [Global.node, Global.layerWith({ data, config: path.join(data, "config") })],
  ])

describe("SessionRevert", () => {
  testEffect(Layer.empty).live("recomputes an omitted file list and does not recompute a stored empty one", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) =>
        Effect.gen(function* () {
          const project = path.join(tmp.path, "project")
          yield* Effect.promise(async () => {
            await fs.mkdir(project, { recursive: true })
            await fs.writeFile(path.join(project, "omitted.txt"), "one\n")
            await fs.writeFile(path.join(project, "listed.txt"), "one\n")
            await $`git init`.cwd(project).quiet()
            await $`git config core.fsmonitor false`.cwd(project).quiet()
            await $`git config commit.gpgsign false`.cwd(project).quiet()
            await $`git config user.email test@orchestra.test`.cwd(project).quiet()
            await $`git config user.name Test`.cwd(project).quiet()
            await $`git add .`.cwd(project).quiet()
            await $`git commit -m initial`.cwd(project).quiet()
          })
          yield* Effect.gen(function* () {
            const snapshot = yield* Snapshot.Service
            const start = yield* captured(snapshot)
            yield* Effect.promise(() => fs.writeFile(path.join(project, "omitted.txt"), "two\n"))
            const omittedEnd = yield* captured(snapshot)
            expect(yield* snapshot.files({ from: start, to: omittedEnd })).toEqual([RelativePath.make("omitted.txt")])
            yield* Effect.promise(() => fs.writeFile(path.join(project, "listed.txt"), "two\n"))
            const listedEnd = yield* captured(snapshot)
            yield* stored(project)
            yield* assistant(2, "msg_omitted", { start, end: omittedEnd })
            yield* assistant(4, "msg_listed", { start, end: listedEnd, files: [] })
            const session = info(project)
            yield* SessionRevert.stage({ session, messageID: SessionMessage.ID.make("msg_boundary_omitted") })
            yield* SessionRevert.stage({ session, messageID: SessionMessage.ID.make("msg_boundary_listed") })
            expect(yield* read(path.join(project, "omitted.txt"))).toBe("one\n")
            expect(yield* read(path.join(project, "listed.txt"))).toBe("two\n")
          }).pipe(Effect.provide(layer(tmp.path, project)))
        }),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )
})

const captured = (snapshot: Snapshot.Interface) =>
  snapshot.capture().pipe(
    Effect.flatMap((id) => (id ? Effect.succeed(id) : Effect.die(new Error("snapshot capture returned nothing")))),
  )

const read = (file: string) =>
  Effect.promise(() => fs.readFile(file, "utf8")).pipe(Effect.map((content) => content.replaceAll("\r\n", "\n")))

const stored = (project: string) =>
  Effect.gen(function* () {
    const { db } = yield* Database.Service
    yield* db
      .insert(ProjectTable)
      .values({ id: Project.ID.global, worktree: AbsolutePath.make(project), sandboxes: [] })
      .run()
      .pipe(Effect.orDie)
    yield* db
      .insert(SessionTable)
      .values({
        id: sessionID,
        project_id: Project.ID.global,
        slug: "test",
        directory: project,
        title: "test",
        version: "test",
      })
      .run()
      .pipe(Effect.orDie)
    yield* db
      .insert(SessionMessageTable)
      .values([
        boundary("msg_boundary_omitted", 1),
        boundary("msg_boundary_listed", 3),
      ])
      .run()
      .pipe(Effect.orDie)
  })

function boundary(id: string, seq: number) {
  return {
    id: SessionMessage.ID.make(id),
    session_id: sessionID,
    type: "user" as const,
    seq,
    time_created: 0,
    data: { text: "", files: [], agents: [] },
  }
}

const assistant = (seq: number, id: string, snapshot: { start: string; end: string; files?: readonly string[] }) =>
  Effect.gen(function* () {
    const messageID = SessionMessage.ID.make(id)
    const { id: _id, type, ...data } = encode(
      SessionMessage.Assistant.make({
        id: messageID,
        type: "assistant",
        agent: "maestro",
        model,
        content: [],
        time: { created },
        snapshot,
      }),
    )
    yield* (yield* Database.Service).db
      .insert(SessionMessageTable)
      .values({ id: messageID, session_id: sessionID, type, seq, time_created: 0, data })
      .run()
      .pipe(Effect.orDie)
  })

function info(project: string): Session.Info {
  return {
    id: sessionID,
    projectID: Project.ID.global,
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created, updated: created },
    title: "test",
    location: Location.Ref.make({ directory: AbsolutePath.make(project) }),
  }
}
