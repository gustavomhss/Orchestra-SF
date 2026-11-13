import { expect, test } from "bun:test"
import { AgentV2 } from "@orchestra/core/agent"
import { makeLocationNode } from "@orchestra/core/effect/app-node"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionV2 } from "@orchestra/core/session"
import { SessionExecution } from "@orchestra/core/session/execution"
import { SessionExecutionLocal } from "@orchestra/core/session/execution/local"
import { SessionSchema } from "@orchestra/core/session/schema"
import { SessionStore } from "@orchestra/core/session/store"
import { ExecutionHost } from "@orchestra/core/session/runner"
import { Effect, Layer, Stream } from "effect"
import { createSfTokenGate } from "../../../../../../../apps/cli/src/sucafina-product/token-gate.ts"

test("execution host denies SF turns while preserving the actual non-SF host", async () => {
  const invoked = { count: 0 }
  const upstream = makeLocationNode({ service: ExecutionHost.Service, deps: [], layer: Layer.succeed(ExecutionHost.Service,
    ExecutionHost.of([{ id: "test-engine", stateKey: "test", stream: () => { invoked.count++; return Stream.empty } }])) })
  const durable = new Set<SessionSchema.ID>()
  const storage = { unavailable: false }
  const gate = createSfTokenGate({ upstream, isSfOwned: (id) => storage.unavailable ? Effect.fail("storage-unavailable") : Effect.succeed(durable.has(id)) })
  const location = Location.Ref.make({ directory: AbsolutePath.make(import.meta.dir) })
  const layer = AppNodeBuilder.build(LayerNode.group([gate.hostNode, SessionV2.node, SessionStore.node]),
    [[SessionExecution.node, SessionExecutionLocal.node], [Location.node, Location.boundNode(location)]])
  await Effect.gen(function* () {
    const session = yield* SessionV2.Service
    const store = yield* SessionStore.Service
    const sfID = SessionSchema.ID.create()
    const sf = yield* session.create({ id: sfID, location, agent: AgentV2.ID.make("sf_finance") })
    yield* store.narrow(sf.id, { skills: { entry: "sf-explicar-forecast", allow: ["sf-explicar-forecast"] },
      tools: ["sf_forecast_compare"], budgets: { loads: 0, toolCalls: 1 } })
    const other = yield* session.create({ location, agent: AgentV2.ID.make("ordinary") })
    const registry = yield* ExecutionHost.Service
    const host = registry.get("test-engine")
    expect(host).toBeDefined()
    if (!host) return
    const denied = yield* Effect.result(Stream.runCollect(host.stream({ session: sf } as ExecutionHost.Turn)))
    expect(denied._tag).toBe("Failure")
    expect(invoked.count).toBe(0)
    yield* session.switchAgent({ sessionID: sf.id, agent: "ordinary" })
    const switched = yield* session.get(sf.id)
    const stillDenied = yield* Effect.result(Stream.runCollect(host.stream({ session: switched } as ExecutionHost.Turn)))
    expect(stillDenied._tag).toBe("Failure")
    expect(invoked.count).toBe(0)
    const child = yield* session.create({ location, parentID: sf.id, agent: AgentV2.ID.make("ordinary") })
    const childDenied = yield* Effect.result(Stream.runCollect(host.stream({ session: child } as ExecutionHost.Turn)))
    expect(childDenied._tag).toBe("Failure")
    expect(invoked.count).toBe(0)
    const forwarded = yield* Effect.result(Stream.runCollect(host.stream({ session: other } as ExecutionHost.Turn)))
    expect(forwarded._tag).toBe("Success")
    expect(invoked.count).toBe(1)
    durable.add(other.id)
    const marked = yield* Effect.result(Stream.runCollect(host.stream({ session: other } as ExecutionHost.Turn)))
    expect(marked._tag).toBe("Failure")
    expect(invoked.count).toBe(1)
    durable.delete(other.id)
    storage.unavailable = true
    const unavailable = yield* Effect.result(Stream.runCollect(host.stream({ session: other } as ExecutionHost.Turn)))
    expect(unavailable._tag).toBe("Failure")
    expect(invoked.count).toBe(1)
  }).pipe(Effect.scoped, Effect.provide(layer), Effect.runPromise)
})
