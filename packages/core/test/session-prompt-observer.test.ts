import { expect } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { LLMClient, LLMEvent, type LLMRequest } from "@orchestra/llm"
import { Deferred, Effect, Fiber, Layer, Stream } from "effect"
import { Database } from "@orchestra/core/database/database"
import { makeGlobalNode } from "@orchestra/core/effect/app-node"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNodePlatform } from "@orchestra/core/effect/app-node-platform"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { EventV2 } from "@orchestra/core/event"
import { Global } from "@orchestra/core/global"
import { Host } from "@orchestra/core/host"
import { SessionPrompt } from "@orchestra/core/host/session-prompt"
import { Location } from "@orchestra/core/location"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import type { LocationServices } from "@orchestra/core/location-services"
import { ModelV2 } from "@orchestra/core/model"
import { Project } from "@orchestra/core/project"
import { ProjectTable } from "@orchestra/core/project/sql"
import { ProviderV2 } from "@orchestra/core/provider"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionV2 } from "@orchestra/core/session"
import { SessionExecution } from "@orchestra/core/session/execution"
import { SessionExecutionLocal } from "@orchestra/core/session/execution/local"
import { SessionInput } from "@orchestra/core/session/input"
import { SessionOwner } from "@orchestra/core/session/owner"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionProjector } from "@orchestra/core/session/projector"
import { SessionInputTable, SessionTable } from "@orchestra/core/session/sql"
import { SessionStore } from "@orchestra/core/session/store"
import { Snapshot } from "@orchestra/core/snapshot"
import { TaskGovernance } from "@orchestra/core/tool/task-governance"
import { ToolRegistry } from "@orchestra/core/tool/registry"
import { ToolSafety } from "@orchestra/core/tool-safety"
import { tmpdir } from "./fixture/tmpdir"
import { testEffect } from "./lib/effect"

const it = testEffect(Layer.empty)
const sessionID = SessionV2.ID.make("ses_observer_test")
const nodes = LayerNode.group([Database.node, EventV2.node, SessionProjector.node, SessionStore.node, LocationServiceMap.node, SessionV2.node, SessionExecution.node])

function execution(wakes: SessionV2.ID[]) {
  return Layer.succeed(SessionExecution.Service, SessionExecution.Service.of({
    active: Effect.succeed(new Set<SessionV2.ID>()),
    exclusive: (_id, effect) => effect.pipe(Effect.asSome),
    withRunner: () => Effect.die("unexpected runner"),
    resume: () => Effect.die("unexpected resume"),
    interrupt: () => Effect.void,
    wake: (id) => Effect.sync(() => { wakes.push(id) }),
  }))
}

function observerNode(make: (db: Database.Interface) => SessionPrompt.Observer) {
  return makeGlobalNode({
    service: SessionPrompt.Service,
    layer: Layer.effect(SessionPrompt.Service, Effect.gen(function* () {
      const db = yield* Database.Service
      // The production replacement may depend on these global services without acquiring a Location here.
      yield* SessionStore.Service
      yield* LocationServiceMap.Service
      return SessionPrompt.Service.of({ beforePrompt: make(db) })
    })),
    deps: [Database.node, SessionStore.node, LocationServiceMap.node],
  })
}

const seed = (directory: AbsolutePath) => Effect.gen(function* () {
  const database = yield* Database.Service
  yield* database.db.insert(ProjectTable).values({ id: Project.ID.global, worktree: directory, sandboxes: [] })
    .onConflictDoNothing().run().pipe(Effect.orDie)
  yield* database.db.insert(SessionTable).values({
    id: sessionID, project_id: Project.ID.global, slug: "observer", directory, title: "observer", version: "test",
  }).onConflictDoNothing().run().pipe(Effect.orDie)
})

function harness(directory: string, wakes: SessionV2.ID[], make?: (db: Database.Interface) => SessionPrompt.Observer) {
  const replacement = make ? observerNode(make) : undefined
  const contribution = Host.merge(replacement ? [{ id: "observer", replacements: [[SessionPrompt.node, replacement]] }] : [])
  const locationMap = makeGlobalNode({
    service: LocationServiceMap.Service,
    deps: [SessionOwner.node],
    layer: Layer.effect(LocationServiceMap.Service, Effect.gen(function* () {
      const owners = yield* SessionOwner.Service
      return yield* LocationServiceMap.makeScoped(owners, (_ref: Location.Ref) =>
        Layer.effectContext<LocationServices, never, never>(Effect.die("unexpected Location acquisition")),
      )
    })),
  })
  return AppNodeBuilder.build(nodes, [
    ...contribution.replacements,
    [Database.node, Database.layerFromPath(path.join(directory, "test.sqlite"))],
    [SessionExecution.node, execution(wakes)],
    [LocationServiceMap.node, locationMap],
    [Global.node, Global.layerWith({ home: directory, config: path.join(directory, "config"), data: path.join(directory, "data") })],
  ])
}

const temporary = Effect.acquireRelease(Effect.promise(() => tmpdir()), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()))

it.live("observes the original prompt before admission, then admits and wakes once", () => Effect.gen(function* () {
  const tmp = yield* temporary
  const wakes: SessionV2.ID[] = []
  const observed: Parameters<SessionPrompt.Observer>[0][] = []
  const id = SessionMessage.ID.create()
  const prompt = { text: "raw", files: [{ uri: "data:image/png;base64,AA==", name: "image.png" }] }
  yield* Effect.gen(function* () {
    yield* seed(AbsolutePath.make(tmp.path))
    const session = yield* SessionV2.Service
    const database = yield* Database.Service
    const result = yield* session.prompt({ id, sessionID, prompt, delivery: "queue" })
    expect(result.id).toBe(id)
    expect(observed).toHaveLength(1)
    expect(observed[0]).toMatchObject({ session: { id: sessionID }, messageID: id, prompt, delivery: "queue" })
    expect(observed[0]?.prompt).toBe(prompt)
    expect((yield* database.db.select().from(SessionInputTable).all().pipe(Effect.orDie)).filter((row) => row.id === id)).toHaveLength(1)
    expect(wakes).toEqual([sessionID])
  }).pipe(Effect.provide(harness(tmp.path, wakes, (database) => (input) => Effect.gen(function* () {
    expect(yield* SessionInput.find(database.db, input.messageID)).toBeUndefined()
    observed.push(input)
  }))))
}))

it.live("denial blocks admission and wake; an exact retry never re-observes and a conflict still fails", () => Effect.gen(function* () {
  const tmp = yield* temporary
  const wakes: SessionV2.ID[] = []
  const seen: SessionMessage.ID[] = []
  const deliveries: SessionInput.Delivery[] = []
  const denied = SessionMessage.ID.create()
  const allowed = SessionMessage.ID.create()
  yield* Effect.gen(function* () {
    yield* seed(AbsolutePath.make(tmp.path))
    const session = yield* SessionV2.Service
    const database = yield* Database.Service
    const blocked = yield* session.prompt({ id: denied, sessionID, prompt: { text: "blocked" } }).pipe(Effect.flip)
    expect(blocked).toMatchObject({ _tag: "Session.PromptBlockedError", reason: "observer-denied", detail: expect.stringContaining("observer-denied") })
    expect(yield* SessionInput.find(database.db, denied)).toBeUndefined()
    expect(yield* session.messages({ sessionID })).toEqual([])
    expect(wakes).toEqual([])
    const input = { id: allowed, sessionID, prompt: { text: "allowed" }, resume: false } as const
    yield* session.prompt(input)
    yield* session.prompt(input)
    expect((yield* session.prompt({ ...input, prompt: { text: "different" } }).pipe(Effect.flip))._tag).toBe("Session.PromptConflictError")
    expect(seen).toEqual([denied, allowed])
    expect(deliveries).toEqual(["steer", "steer"])
    expect(wakes).toEqual([])
  }).pipe(Effect.provide(harness(tmp.path, wakes, () => (input) => Effect.suspend(() => {
    seen.push(input.messageID)
    deliveries.push(input.delivery)
    return input.messageID === denied ? Effect.fail(new ToolSafety.Denied({ reason: "observer-denied" })) : Effect.void
  }))))
}))

it.live("an interrupted observer cannot admit or wake", () => Effect.gen(function* () {
  const tmp = yield* temporary
  const wakes: SessionV2.ID[] = []
  const started = yield* Deferred.make<void>()
  const id = SessionMessage.ID.create()
  yield* Effect.gen(function* () {
    yield* seed(AbsolutePath.make(tmp.path))
    const session = yield* SessionV2.Service
    const database = yield* Database.Service
    const fiber = yield* session.prompt({ id, sessionID, prompt: { text: "wait" } }).pipe(Effect.forkChild)
    yield* Deferred.await(started)
    yield* Fiber.interrupt(fiber)
    expect(yield* SessionInput.find(database.db, id)).toBeUndefined()
    expect(wakes).toEqual([])
  }).pipe(Effect.provide(harness(tmp.path, wakes, () => () => Deferred.succeed(started, undefined).pipe(Effect.andThen(Effect.never)))))
}))

it.live("the default observer and admit-only prompt do not acquire a Location or wake", () => Effect.gen(function* () {
  const tmp = yield* temporary
  const wakes: SessionV2.ID[] = []
  yield* Effect.gen(function* () {
    yield* seed(AbsolutePath.make(tmp.path))
    const session = yield* SessionV2.Service
    const database = yield* Database.Service
    const input = yield* session.prompt({ sessionID, prompt: { text: "admit only" }, resume: false })
    expect(yield* SessionInput.find(database.db, input.id)).toBeDefined()
    expect(wakes).toEqual([])
  }).pipe(Effect.provide(harness(tmp.path, wakes)))
}))

// A cold native Task, like tool-task-cold.test.ts: the real Location registry registers TaskTool.node, whose
// globalSessions capture obtains the already-constructed Session instead of rebuilding SessionV2.node.
const userText = (request: LLMRequest) => request.messages.filter((message) => message.role === "user").at(-1)?.content
  .flatMap((part) => part.type === "text" ? [part.text] : []).join("\n")
const childTurns = (requests: LLMRequest[]) => requests.filter((request) => userText(request) === "child" &&
  !request.system.some((part) => part.text.startsWith("You are a title generator")))

for (const decision of ["allow", "observer-deny", "task-deny"] as const) {
  it.live(`native Task ${decision}: the captured Session observes child admission without changing Task policy`, () => Effect.gen(function* () {
    const tmp = yield* temporary
    yield* Effect.promise(async () => {
      await fs.mkdir(path.join(tmp.path, ".global"), { recursive: true })
      await fs.mkdir(path.join(tmp.path, ".orchestra"), { recursive: true })
      await Bun.write(path.join(tmp.path, ".global", "orchestra.json"), JSON.stringify({ trusted_projects: [tmp.path] }))
      await Bun.write(path.join(tmp.path, ".orchestra", "orchestra.json"), JSON.stringify({
        snapshots: false,
        providers: { "observer-task": {
          api: { type: "aisdk", package: "@ai-sdk/openai", settings: { apiKey: "test" } },
          models: { chat: { disabled: false, capabilities: { tools: true, input: ["text"], output: ["text"] }, limit: { context: 100_000, output: 1_000 } } },
        } },
      }))
      await Bun.write(path.join(tmp.path, "orchestra.json"), JSON.stringify({ agents: { worker: { mode: "subagent", description: "Worker" } } }))
    })
    const requests: LLMRequest[] = []
    const observed: Parameters<SessionPrompt.Observer>[0][] = []
    const parents: SessionV2.ID[] = []
    const order: string[] = []
    const constructions = { count: 0 }
    const replacement = observerNode((database) => {
      constructions.count++
      return (input) => Effect.gen(function* () {
        if (!input.session.parentID) {
          parents.push(input.session.id)
          return
        }
        expect(yield* SessionInput.find(database.db, input.messageID)).toBeUndefined()
        expect(requests.filter((request) => request.http?.headers?.["x-parent-session-id"] === input.session.parentID)).toHaveLength(0)
        expect(requests.filter((request) => userText(request) === "child")).toHaveLength(0)
        order.push("observe-child")
        observed.push(input)
        if (decision === "observer-deny") return yield* new ToolSafety.Denied({ reason: "observer-denied" })
      })
    })
    const contribution = Host.merge([{ id: "observer", replacements: [[SessionPrompt.node, replacement]] }])
    expect(() => Host.merge([{ id: "invalid", replacements: [[SessionV2.node, SessionV2.node]] }])).toThrow(`Host contribution may not own ${SessionV2.node.name}`)
    const client = LLMClient.Service.of({
      prepare: () => Effect.die("Unexpected prepare"),
      generate: () => Effect.die("Unexpected generate"),
      stream: (request) => Stream.suspend((): Stream.Stream<LLMEvent> => {
        requests.push(request)
        const prompt = userText(request)
        if (childTurns([request]).length) order.push("child-provider")
        if (prompt === "parent" && !request.messages.some((message) => message.role === "tool")) return Stream.fromIterable([
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.toolCall({ id: "observer-task", name: "task", input: { description: "Child", prompt: "child", subagent_type: "worker" } }),
          LLMEvent.stepFinish({ index: 0, reason: "tool-calls" }),
          LLMEvent.finish({ reason: "tool-calls" }),
        ])
        return Stream.fromIterable([
          LLMEvent.stepStart({ index: 0 }), LLMEvent.textStart({ id: "answer" }),
          LLMEvent.textDelta({ id: "answer", text: `answer:${prompt}` }), LLMEvent.textEnd({ id: "answer" }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }), LLMEvent.finish({ reason: "stop" }),
        ])
      }),
    })
    const governance = TaskGovernance.Service.of({
      ...TaskGovernance.allowAll,
      admit: (input) => Effect.sync(() => { order.push("admit") }).pipe(Effect.andThen(TaskGovernance.allowAll.admit(input))),
      settle: (input) => Effect.sync(() => { order.push("settle") }).pipe(Effect.andThen(TaskGovernance.allowAll.settle(input))),
    })
    const app = AppNodeBuilder.build(LayerNode.group([
      Database.node, LocationServiceMap.node, SessionV2.node, SessionExecution.node,
    ]), [
      ...contribution.replacements,
      [Database.node, Database.layerFromPath(path.join(tmp.path, "test.sqlite"))],
      [SessionExecution.node, SessionExecutionLocal.node],
      [LayerNodePlatform.llmClient, Layer.succeed(LLMClient.Service, client)],
      [TaskGovernance.node, Layer.succeed(TaskGovernance.Service, governance)],
      [Snapshot.node, Snapshot.noopLayer],
      [Global.node, Global.layerWith({ home: tmp.path, config: path.join(tmp.path, ".global"), data: path.join(tmp.path, ".data") })],
    ])
    yield* Effect.gen(function* () {
      const sessions = yield* SessionV2.Service
      const database = yield* Database.Service
      const locations = yield* LocationServiceMap.Service
      const model = ModelV2.Ref.make({ providerID: ProviderV2.ID.make("observer-task"), id: ModelV2.ID.make("chat") })
      const parent = yield* sessions.create({ location: Location.Ref.make({ directory: AbsolutePath.make(tmp.path) }), model })
      yield* sessions.setPermission({ sessionID: parent.id, permission: [
        { permission: "bash", pattern: "rm *", action: "deny" },
        // A resource-specific deny leaves Task advertised, so its own permission assertion is exercised.
        ...(decision === "task-deny" ? [{ permission: "task", pattern: "worker", action: "deny" as const }] : []),
      ] })
      yield* sessions.prompt({ sessionID: parent.id, prompt: { text: "parent" }, resume: false })
      expect(parents).toEqual([parent.id])
      expect(constructions.count).toBe(1)
      expect(Array.from(yield* locations.keys)).toHaveLength(0)
      yield* sessions.resume(parent.id)
      expect(constructions.count).toBe(1)
      const registry = yield* ToolRegistry.Service.pipe(Effect.provide(locations.get(parent.location)))
      expect((yield* registry.materialize()).definitions.map((tool) => tool.name)).toContain("task")
      const children = (yield* sessions.list()).filter((session) => session.parentID === parent.id)
      const parts = (yield* sessions.context(parent.id)).flatMap((message) => message.type === "assistant" ? message.content : [])
        .filter((part) => part.type === "tool" && part.id === "observer-task")
      if (decision === "task-deny") {
        expect(children).toHaveLength(0)
        expect(observed).toHaveLength(0)
        expect(requests.filter((request) => userText(request) === "child")).toHaveLength(0)
        expect(order).toEqual(["admit"])
        expect(parts).toEqual([expect.objectContaining({ state: expect.objectContaining({ status: "error" }) })])
        return
      }
      expect(children).toHaveLength(1)
      const child = children[0]!
      expect(observed).toHaveLength(1)
      expect(observed[0]).toMatchObject({ session: { id: child.id, parentID: parent.id, agent: "worker" }, prompt: { text: "child" }, delivery: "queue" })
      expect(yield* sessions.getPermission(child.id)).toEqual([{ permission: "bash", pattern: "rm *", action: "deny" }])
      const input = yield* SessionInput.find(database.db, observed[0]!.messageID)
      const rows = (yield* database.db.select().from(SessionInputTable).all().pipe(Effect.orDie))
        .filter((row) => row.session_id === child.id)
      if (decision === "observer-deny") {
        expect(input).toBeUndefined()
        expect(rows).toHaveLength(0)
        expect(requests.filter((request) => userText(request) === "child")).toHaveLength(0)
        expect(requests.filter((request) => request.http?.headers?.["x-parent-session-id"] === parent.id)).toHaveLength(0)
        expect(yield* sessions.messages({ sessionID: child.id })).toEqual([])
        expect(order).toEqual(["admit", "observe-child"])
        expect(parts).toEqual([expect.objectContaining({ state: expect.objectContaining({ status: "error", error: expect.objectContaining({ message: expect.stringContaining("observer-denied") }) }) })])
        return
      }
      expect(input).toMatchObject({ sessionID: child.id, delivery: "queue", prompt: { text: "child" } })
      expect(rows).toHaveLength(1)
      expect(childTurns(requests)).toHaveLength(1)
      expect(order).toEqual(["admit", "observe-child", "child-provider", "settle"])
      expect(yield* sessions.messages({ sessionID: child.id, order: "asc" })).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: "assistant", content: expect.arrayContaining([expect.objectContaining({ type: "text", text: "answer:child" })]) }),
      ]))
    }).pipe(Effect.provide(app))
  }), 30_000)
}
