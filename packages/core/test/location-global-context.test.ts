import { expect, test } from "bun:test"
import { Context, Effect, Layer } from "effect"
import { makeGlobalNode, makeLocationNode } from "../src/effect/app-node"
import { LayerNode } from "../src/effect/layer-node"
import { LocationServiceMap } from "../src/location-service-map"
import { Database } from "../src/database/database"
import { EventV2 } from "../src/event"
import { SessionOwner } from "../src/session/owner"
import { teamSessionFixture, profileA } from "./fixture/team-session"

class PublishedOverride extends Context.Service<PublishedOverride, { readonly token: object }>()("test/PublishedOverride") {}
const overrideNode = makeGlobalNode({
  service: PublishedOverride, layer: Layer.effect(PublishedOverride, Effect.die("Published override must replace this constructor")), deps: [],
})
class ObservedGlobals extends Context.Service<ObservedGlobals, {
  readonly database: Database.Interface
  readonly owner: SessionOwner.Interface
  readonly events: EventV2.Interface
  readonly override: { readonly token: object }
}>()("test/ObservedGlobals") {}

test("Location cold and warm acquisitions reuse the exact completed graph and its explicit global override", async () => {
  const observed: Array<Context.Service.Shape<typeof ObservedGlobals>> = []
  const override = Object.freeze({ token: Object.freeze({}) })
  const probe = makeLocationNode({
    service: ObservedGlobals,
    layer: Layer.effect(ObservedGlobals, Effect.gen(function* () {
      const value = { database: yield* Database.Service, owner: yield* SessionOwner.Service,
        events: yield* EventV2.Service, override: yield* PublishedOverride }
      observed.push(value)
      return value
    })),
    deps: [Database.node, SessionOwner.node, EventV2.node, overrideNode],
  })
  await using f = await teamSessionFixture({
    extraNodes: [LayerNode.group([LocationServiceMap.node, overrideNode])],
    locationNodes: [probe],
    replacements: [[overrideNode, Layer.succeed(PublishedOverride, override)]],
  })
  expect((await f.resolver.configureConfiguration(f.request(undefined, f.cookie), {
    profile: profileA, expectedRevision: (await f.profiles.read()).configRevision,
    document: { version: 1, settings: { default_agent: "analyst", agents: { analyst: { system: "Synthetic shared guidance" } } } },
  })).status).toBe("ok")
  await f.run(f.admitted(f.businessRequest(), Effect.gen(function* () {
    const expected = { database: yield* Database.Service, owner: yield* SessionOwner.Service,
      events: yield* EventV2.Service, override: yield* PublishedOverride }
    const locations = yield* LocationServiceMap.Service
    const first = yield* locations.contextEffect(f.location)
    const warm = yield* locations.contextEffect(f.location)
    expect(first).toBe(warm)
    expect(observed).toHaveLength(1)
    expect(observed[0]?.database).toBe(expected.database)
    expect(observed[0]?.owner).toBe(expected.owner)
    expect(observed[0]?.events).toBe(expected.events)
    expect(observed[0]?.override).toBe(override)
    yield* locations.invalidate(f.location)
    const cold = yield* locations.contextEffect(f.location)
    expect(cold).not.toBe(first)
    expect(observed).toHaveLength(2)
    expect(observed[1]?.database).toBe(expected.database)
    expect(observed[1]?.owner).toBe(expected.owner)
    expect(observed[1]?.events).toBe(expected.events)
    expect(observed[1]?.override).toBe(expected.override)
  })))
}, 30000)

test("Layer compilation still constructs absent dependencies and never borrows a service from another context", async () => {
  class Existing extends Context.Service<Existing, { readonly token: object }>()("test/Existing") {}
  class Missing extends Context.Service<Missing, { readonly existing: { readonly token: object } }>()("test/Missing") {}
  let constructed = 0
  const existingNode = makeGlobalNode({ service: Existing, layer: Layer.effect(Existing, Effect.die("Existing service must be reused")), deps: [] })
  const missingNode = makeGlobalNode({
    service: Missing, layer: Layer.effect(Missing, Effect.gen(function* () {
      constructed++
      return { existing: yield* Existing }
    })), deps: [existingNode],
  })
  const first = { token: {} }
  const second = { token: {} }
  const acquire = (value: typeof first) => Effect.runPromise(Missing.use((current) => Effect.succeed(current)).pipe(
    Effect.provide(LayerNode.compile(missingNode, [], { existingContext: Context.make(Existing, value) })),
  ))
  expect((await acquire(first)).existing).toBe(first)
  expect((await acquire(second)).existing).toBe(second)
  expect(constructed).toBe(2)
})
