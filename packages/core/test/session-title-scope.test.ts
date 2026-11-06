import { describe, expect } from "bun:test"
import { DateTime, Deferred, Effect, Exit, Fiber, Scope, Stream } from "effect"
import { LLMEvent, Model } from "@orchestra/llm"
import { route } from "@orchestra/llm/protocols/openai-chat"
import { AgentV2 } from "@orchestra/core/agent"
import { Database } from "@orchestra/core/database/database"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { EventV2 } from "@orchestra/core/event"
import { Project } from "@orchestra/core/project"
import { ProjectTable } from "@orchestra/core/project/sql"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionEvent } from "@orchestra/core/session/event"
import { SessionLifecycle } from "../src/session/lifecycle"
import { SessionMessage } from "@orchestra/core/session/message"
import { Prompt } from "@orchestra/core/session/prompt"
import { SessionProjector } from "@orchestra/core/session/projector"
import { SessionRunnerModel } from "@orchestra/core/session/runner/model"
import { SessionTitle } from "../src/session/runner/title"
import { SessionSchema } from "../src/session/schema"
import { SessionTable } from "@orchestra/core/session/sql"
import { SessionStore } from "@orchestra/core/session/store"
import { SessionSubagentModels } from "@orchestra/core/session/subagent-models"
import { testEffect } from "./lib/effect"

const model = Model.make({ id: "fake", provider: "fake", route })
const it = testEffect(AppNodeBuilder.build(LayerNode.group([
  Database.node, EventV2.node, SessionProjector.node, SessionStore.node, AgentV2.node,
  SessionRunnerModel.node, SessionSubagentModels.node,
]), [[SessionRunnerModel.node, SessionRunnerModel.layerWith(() => Effect.succeed(model))]]))
const id = SessionSchema.ID.make("ses_title_scope")
const title = "New session - 2026-01-01T00:00:00.000Z"

const setup = (options?: { parentID?: SessionSchema.ID; title?: string }) => Effect.gen(function* () {
  const db = (yield* Database.Service).db
  const events = yield* EventV2.Service
  const store = yield* SessionStore.Service
  const agents = yield* AgentV2.Service
  const models = yield* SessionRunnerModel.Service
  const subagentModels = yield* SessionSubagentModels.Service
  yield* db.insert(ProjectTable).values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] }).run()
  if (options?.parentID) yield* db.insert(SessionTable).values({ id: options.parentID, project_id: Project.ID.global, slug: "parent", directory: "/project", title, version: "test" }).run()
  yield* db.insert(SessionTable).values({ id, project_id: Project.ID.global, slug: "test", directory: "/project", title: options?.title ?? title, version: "test", parent_id: options?.parentID }).run()
  yield* events.publish(SessionEvent.Prompted, { sessionID: id, messageID: SessionMessage.ID.make("msg_title"), timestamp: DateTime.makeUnsafe(0), prompt: Prompt.make({ text: "hello" }), delivery: "steer" })
  yield* agents.transform((draft) => draft.update(AgentV2.ID.make("title"), (agent) => { agent.system = "Name the session" }))
  return { db, events, store, agents, models, subagentModels }
})

const held = Effect.gen(function* () {
  const started = yield* Deferred.make<void>()
  const release = yield* Deferred.make<void>()
  const finalized = yield* Deferred.make<void>()
  const stream = () => Stream.fromEffect(Deferred.succeed(started, undefined).pipe(Effect.andThen(Deferred.await(release)), Effect.as(LLMEvent.textDelta({ id: "title", text: "Generated title" })), Effect.ensuring(Deferred.succeed(finalized, undefined))))
  return { started, release, finalized, stream }
})

describe("Session title scope", () => {
  it.live("successful real DB rename", () => Effect.gen(function* () {
    const deps = yield* setup()
    const name = yield* SessionTitle.scoped({ ...deps, llm: { stream: () => Stream.make(LLMEvent.textDelta({ id: "title", text: "Generated title" })) } })
    yield* Fiber.join(yield* name(id))
    expect((yield* deps.store.get(id))?.title).toBe("Generated title")
  }))
  it.live("short caller scope does not cancel the title", () => Effect.gen(function* () {
    const deps = yield* setup()
    const gate = yield* held
    const name = yield* SessionTitle.scoped({ ...deps, llm: gate })
    const fiber = yield* Effect.scoped(name(id))
    yield* Deferred.await(gate.started)
    yield* Deferred.succeed(gate.release, undefined)
    yield* Fiber.join(fiber)
    expect((yield* deps.store.get(id))?.title).toBe("Generated title")
  }))
  it.live("owner scope closure interrupts the started stream", () => Effect.gen(function* () {
    const deps = yield* setup()
    const gate = yield* held
    const owner = yield* Scope.make()
    yield* Effect.addFinalizer(() => Scope.close(owner, Exit.void))
    const name = yield* Scope.provide(SessionTitle.scoped({ ...deps, llm: gate }), owner)
    const fiber = yield* name(id)
    yield* Deferred.await(gate.started)
    yield* Scope.close(owner, Exit.void)
    const finalized = yield* Deferred.await(gate.finalized).pipe(Effect.timeoutOption("1 second"))
    yield* Deferred.succeed(gate.release, undefined)
    yield* Fiber.await(fiber)
    expect(finalized._tag).toBe("Some")
  }))
  it.live("user rename while held is preserved", () => Effect.gen(function* () {
    const deps = yield* setup()
    const gate = yield* held
    const name = yield* SessionTitle.scoped({ ...deps, llm: gate })
    const fiber = yield* name(id)
    yield* Deferred.await(gate.started)
    yield* SessionLifecycle.rename(deps.db, deps.events, { sessionID: id, title: "My title" })
    yield* Deferred.succeed(gate.release, undefined)
    yield* Fiber.join(fiber)
    expect((yield* deps.store.get(id))?.title).toBe("My title")
  }))
  it.live("child and non-default titles skip streaming", () => Effect.gen(function* () {
    const deps = yield* setup({ parentID: SessionSchema.ID.make("ses_parent") })
    const calls: string[] = []
    const name = yield* SessionTitle.scoped({ ...deps, llm: { stream: () => { calls.push("stream"); return Stream.empty } } })
    yield* Fiber.join(yield* name(id))
    expect((yield* deps.store.get(id))?.title).toBe(title)
    yield* deps.db.update(SessionTable).set({ parent_id: null, title: "Custom" }).run()
    yield* Fiber.join(yield* name(id))
    expect((yield* deps.store.get(id))?.title).toBe("Custom")
    expect(calls).toEqual([])
  }))
})
