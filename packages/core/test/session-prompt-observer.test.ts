import { expect } from "bun:test"
import path from "node:path"
import { Context, Deferred, Effect, Fiber, Layer, LayerMap } from "effect"
import { Database } from "@orchestra/core/database/database"
import { makeGlobalNode, makeLocationNode } from "@orchestra/core/effect/app-node"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { EventV2 } from "@orchestra/core/event"
import { Global } from "@orchestra/core/global"
import { Host } from "@orchestra/core/host"
import { SessionPrompt } from "@orchestra/core/host/session-prompt"
import { Location } from "@orchestra/core/location"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import type { LocationServices } from "@orchestra/core/location-services"
import { Project } from "@orchestra/core/project"
import { ProjectTable } from "@orchestra/core/project/sql"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionV2 } from "@orchestra/core/session"
import { SessionExecution } from "@orchestra/core/session/execution"
import { SessionInput } from "@orchestra/core/session/input"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionProjector } from "@orchestra/core/session/projector"
import { SessionInputTable, SessionTable } from "@orchestra/core/session/sql"
import { SessionStore } from "@orchestra/core/session/store"
import { Snapshot } from "@orchestra/core/snapshot"
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
  const locationMap = Layer.effect(LocationServiceMap.Service, LayerMap.make((_ref: Location.Ref) =>
    Layer.effectContext<LocationServices, never, never>(Effect.die("unexpected Location acquisition")),
  ))
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

class LocationCaller extends Context.Service<LocationCaller, { readonly session: SessionV2.Interface }>()("test/PromptLocationCaller") {}

it.live("a Location caller captures the replaced global observer without replacing the reserved Session node", () => Effect.gen(function* () {
  const tmp = yield* temporary
  const wakes: SessionV2.ID[] = []
  const observed: SessionMessage.ID[] = []
  const replacement = observerNode(() => (input) => Effect.sync(() => { observed.push(input.messageID) }))
  const contribution = Host.merge([{ id: "observer", replacements: [[SessionPrompt.node, replacement]] }])
  expect(() => Host.merge([{ id: "invalid", replacements: [[SessionV2.node, SessionV2.node]] }])).toThrow(`Host contribution may not own ${SessionV2.node.name}`)
  const caller = makeLocationNode({
    service: LocationCaller,
    layer: Layer.effect(LocationCaller, Effect.gen(function* () {
      const session = yield* SessionV2.Service
      yield* Location.Service
      return LocationCaller.of({ session })
    })),
    deps: [SessionV2.node, Location.node],
  })
  const context = yield* Layer.build(AppNodeBuilder.build(nodes, [
    ...contribution.replacements,
    [Database.node, Database.layerFromPath(path.join(tmp.path, "test.sqlite"))],
    [SessionExecution.node, execution(wakes)],
    [Global.node, Global.layerWith({ home: tmp.path, config: path.join(tmp.path, "config"), data: path.join(tmp.path, "data") })],
    [Snapshot.node, Snapshot.noopLayer],
  ], [caller]))
  yield* seed(AbsolutePath.make(tmp.path)).pipe(Effect.provideContext(context))
  const locations = Context.get(context, LocationServiceMap.Service)
  const ref = Location.Ref.make({ directory: AbsolutePath.make(tmp.path) })
  const location = yield* Layer.build(locations.get(ref))
  const native = Context.getUnsafe(location, LocationCaller)
  expect(native.session).toBe(Context.get(context, SessionV2.Service))
  const id = SessionMessage.ID.create()
  yield* native.session.prompt({ id, sessionID, prompt: { text: "native caller" }, resume: false })
  expect(observed).toEqual([id])
  expect(wakes).toEqual([])
}), 30_000)
