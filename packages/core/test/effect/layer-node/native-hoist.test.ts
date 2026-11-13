import { describe, expect, test } from "bun:test"
import { Context, Effect, Layer } from "effect"
import { LayerNode } from "@orchestra/core/effect/layer-node"

class Database extends Context.Service<Database, { readonly name: string }>()("test/NativeHoistDatabase") {}
class EventService extends Context.Service<EventService, { readonly database: string }>()("test/NativeHoistEvent") {}
class LocationService extends Context.Service<LocationService, { readonly event: string }>()("test/NativeHoistLocation") {}
class App extends Context.Service<App, { readonly value: string }>()("test/NativeHoistApp") {}
class Base extends Context.Service<Base, { readonly value: string }>()("test/NativeHoistBase") {}
class Audit extends Context.Service<Audit, { readonly value: string }>()("test/NativeHoistAudit") {}
class Worker extends Context.Service<Worker, { readonly value: string }>()("test/NativeHoistWorker") {}

describe("LayerNode global hoist with dependency replacements", () => {
  test("hoists one shared global implementation after its database dependency is replaced", async () => {
    const tags = LayerNode.tags({ location: ["global"], global: [] })
    const global = tags.make("global")
    const location = tags.make("location")
    const originalDatabase = global({
      service: Database,
      layer: Layer.succeed(Database, Database.of({ name: "default database" })),
      deps: [],
    })
    const privateDatabase = global({
      service: Database,
      layer: Layer.succeed(Database, Database.of({ name: "private database" })),
      deps: [],
    })
    const eventLayer = Layer.effect(
      EventService,
      Effect.map(Database, (database) => EventService.of({ database: database.name })),
    )
    const originalEvent = global({ service: EventService, layer: eventLayer, deps: [originalDatabase] })
    const locationLayer = Layer.effect(
      LocationService,
      Effect.map(EventService, (event) => LocationService.of({ event: event.database })),
    )
    const originalLocation = location({ service: LocationService, layer: locationLayer, deps: [originalEvent] })
    const replacementLocation = location({ service: LocationService, layer: locationLayer, deps: [originalEvent] })
    const app = location({
      service: App,
      layer: Layer.effect(
        App,
        Effect.gen(function* () {
          const scoped = yield* LocationService
          const shared = yield* EventService
          return App.of({ value: `${scoped.event}|${shared.database}` })
        }),
      ),
      deps: [originalLocation, originalEvent],
    })

    const result = LayerNode.hoist(LayerNode.group([app]), tags.values.global, [
      [originalLocation, replacementLocation],
      [originalDatabase, privateDatabase],
    ])
    expect(result.hoisted.dependencies.filter((node) => node.name === EventService.key)).toHaveLength(1)

    const layer = LayerNode.compile(result.node).pipe(Layer.provide(LayerNode.compile(result.hoisted))) as Layer.Layer<App>
    const program = Effect.map(App, (service) => service.value).pipe(Effect.provide(layer))
    expect(await Effect.runPromise(program)).toBe("private database|private database")
  })

  test("still rejects different same-name global implementations", () => {
    const tags = LayerNode.tags({ location: ["global"], global: [] })
    const global = tags.make("global")
    const location = tags.make("location")
    const first = global({
      service: Database,
      layer: Layer.succeed(Database, Database.of({ name: "first" })),
      deps: [],
    })
    const second = global({
      service: Database,
      layer: Layer.succeed(Database, Database.of({ name: "second" })),
      deps: [],
    })
    const left = location({
      service: LocationService,
      layer: Layer.effect(LocationService, Effect.as(Database, LocationService.of({ event: "left" }))),
      deps: [first],
    })
    const right = location({
      service: App,
      layer: Layer.effect(App, Effect.as(Database, App.of({ value: "right" }))),
      deps: [second],
    })

    expect(() => LayerNode.hoist(LayerNode.group([left, right]), tags.values.global)).toThrow(
      "Tag global has conflicting implementations for test/NativeHoistDatabase",
    )
  })

  test("still rejects distinct same-name nodes that share the exact same Layer object", () => {
    const tags = LayerNode.tags({ location: ["global"], global: [] })
    const global = tags.make("global")
    const location = tags.make("location")
    const sharedLayer = Layer.succeed(Database, Database.of({ name: "shared layer value" }))
    const first = global({ service: Database, layer: sharedLayer, deps: [] })
    const second = global({ service: Database, layer: sharedLayer, deps: [] })
    const left = location({
      service: LocationService,
      layer: Layer.effect(LocationService, Effect.as(Database, LocationService.of({ event: "left" }))),
      deps: [first],
    })
    const right = location({
      service: App,
      layer: Layer.effect(App, Effect.as(Database, App.of({ value: "right" }))),
      deps: [second],
    })

    expect(() => LayerNode.hoist(LayerNode.group([left, right]), tags.values.global)).toThrow(
      "Tag global has conflicting implementations for test/NativeHoistDatabase",
    )
  })

  test("hoists a global dependency introduced by a location replacement", async () => {
    const tags = LayerNode.tags({ location: ["global"], global: [] })
    const global = tags.make("global")
    const location = tags.make("location")
    const base = global({
      service: Base,
      layer: Layer.succeed(Base, Base.of({ value: "base" })),
      deps: [],
    })
    const audit = global({
      service: Audit,
      layer: Layer.succeed(Audit, Audit.of({ value: "audit" })),
      deps: [],
    })
    const workerLayer = Layer.effect(Worker, Effect.map(Base, (service) => Worker.of({ value: service.value })))
    const replacementWorkerLayer = Layer.effect(
      Worker,
      Effect.gen(function* () {
        const service = yield* Audit
        return Worker.of({ value: service.value })
      }),
    )
    const worker = location({ service: Worker, layer: workerLayer, deps: [base] })
    const replacementWorker = location({ service: Worker, layer: replacementWorkerLayer, deps: [audit] })
    const app = location({
      service: App,
      layer: Layer.effect(App, Effect.map(Worker, (service) => App.of({ value: service.value }))),
      deps: [worker],
    })
    const result = LayerNode.hoist(LayerNode.group([app]), tags.values.global, [[worker, replacementWorker]])

    expect(result.hoisted.dependencies.map((node) => node.name)).toContain(Audit.key)
    const layer = LayerNode.compile(result.node).pipe(Layer.provide(LayerNode.compile(result.hoisted))) as Layer.Layer<App>
    const program = Effect.map(App, (service) => service.value).pipe(Effect.provide(layer))
    expect(await Effect.runPromise(program)).toBe("audit")
  })

  test("leaves the original tagged graph unchanged without replacements", async () => {
    const tags = LayerNode.tags({ location: ["global"], global: [] })
    const global = tags.make("global")
    const location = tags.make("location")
    const database = global({
      service: Database,
      layer: Layer.succeed(Database, Database.of({ name: "baseline database" })),
      deps: [],
    })
    const event = global({
      service: EventService,
      layer: Layer.effect(
        EventService,
        Effect.map(Database, (service) => EventService.of({ database: service.name })),
      ),
      deps: [database],
    })
    const app = location({
      service: App,
      layer: Layer.effect(App, Effect.map(EventService, (service) => App.of({ value: service.database }))),
      deps: [event],
    })
    const result = LayerNode.hoist(LayerNode.group([app]), tags.values.global)

    expect(result.hoisted.dependencies.map((node) => node.name)).toEqual([EventService.key])
    expect(result.hoisted.dependencies[0]?.dependencies.map((node) => node.name)).toEqual([Database.key])
    const layer = LayerNode.compile(result.node).pipe(Layer.provide(LayerNode.compile(result.hoisted))) as Layer.Layer<App>
    const program = Effect.map(App, (service) => service.value).pipe(Effect.provide(layer))
    expect(await Effect.runPromise(program)).toBe("baseline database")
  })
})
