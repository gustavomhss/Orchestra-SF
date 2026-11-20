import { expect, test } from "bun:test"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { Context, Effect, Exit, Fiber, Layer } from "effect"
import { Config } from "../../src/config"
import { ConfigAgentPlugin } from "../../src/config/plugin/agent"
import { AgentV2 } from "../../src/agent"
import { ProviderV2 } from "../../src/provider"
import { FSUtil } from "../../src/fs-util"
import { Global } from "../../src/global"
import { Location } from "../../src/location"
import { LocationServiceMap } from "../../src/location-service-map"
import { SessionOwner } from "../../src/session/owner"
import type { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { teamSessionFixture, profileA, profileB, other } from "../fixture/team-session"
import { location } from "../fixture/location"
import { host, agentHost } from "../plugin/host"
import { barrier } from "../../../../modules/sucafina/Sucafinav1/test/teams-profile/installation-fixture"

const document = (model: string): TeamProfile.ConfigurationDocument => ({
  version: 1, settings: { model, default_agent: "analyst",
    agents: { analyst: { name: "Shared analyst", system: "Approved shared text", model } } },
})
const configure = async (f: Awaited<ReturnType<typeof fixture>>, profile: TeamProfile.Ref, model: string) => {
  const result = await f.resolver.configureConfiguration(f.request(undefined, f.cookie), {
    profile, expectedRevision: (await f.profiles.read()).configRevision, document: document(model),
  })
  expect(result.status).toBe("ok")
}
async function fixture() {
  return teamSessionFixture({ extraNodes: [FSUtil.node, Global.node] })
}
function configured(ref: Location.Ref) {
  return Config.locationLayer.pipe(
    Layer.provideMerge(AgentV2.admittedLayer),
    Layer.provideMerge(Layer.succeed(Location.Service, Location.Service.of(location(ref)))),
    Layer.tap((services) => ConfigAgentPlugin.Plugin.effect(host({
      agent: agentHost(Context.get(services, AgentV2.Service)),
    })).pipe(
      Effect.provideService(AgentV2.Service, Context.get(services, AgentV2.Service)),
      Effect.provideService(Config.Service, Context.get(services, Config.Service)),
      Effect.provideService(Location.Service, Context.get(services, Location.Service)),
    )),
    Layer.fresh,
  )
}
const refused = <A, E, R>(effect: Effect.Effect<A, E, R>) => effect.pipe(Effect.exit, Effect.map((exit) => {
  expect(Exit.isFailure(exit)).toBe(true)
}))

test("core-team-config-01: the actual private source ignores global, workspace and late agent discovery", async () => {
  await using f = await fixture()
  await configure(f, profileA, "approved/alpha")
  await writeFile(path.join(f.directory, "orchestra.json"), JSON.stringify({
    model: "private/global", providers: { personal: { request: { headers: { authorization: "never-read" } } } },
  }))
  await writeFile(path.join(f.workspaceDirectory, "orchestra.json"), JSON.stringify({ model: "private/workspace" }))
  await mkdir(path.join(f.workspaceDirectory, ".orchestra", "agents"), { recursive: true })
  await writeFile(path.join(f.workspaceDirectory, ".orchestra", "agents", "rogue.md"), "---\nname: Rogue\nmodel: private/rogue\n---\nNever load me.")
  await f.run(Effect.gen(function* () {
    const owners = yield* SessionOwner.Service
    const locations = yield* LocationServiceMap.makeScoped(owners, configured)
    const lease = yield* f.capture()
    yield* SessionOwner.withLease(lease, Effect.gen(function* () {
      const context = yield* locations.contextEffect(f.location)
      const config = Context.get(context, Config.Service)
      const entries = yield* config.entries()
      expect(config.source).toBe("team")
      expect(entries).toHaveLength(1)
      expect(entries[0]?.path).toBeUndefined()
      expect(Config.latest(entries, "model")).toBe("approved/alpha")
      expect(yield* (config.packagedSkills ? config.packagedSkills() : Effect.succeed([]))).toEqual([])
      expect(JSON.stringify(entries)).not.toContain("never-read")
      const agents = Context.get(context, AgentV2.Service)
      const analyst = yield* agents.get(AgentV2.ID.make("analyst"))
      expect(analyst?.system).toBe("Approved shared text")
      expect(analyst?.model?.providerID).toBe(ProviderV2.ID.make("approved"))
      expect(analyst?.request).toEqual({ headers: {}, body: {} })
      expect(analyst?.engine).toBeUndefined()
      expect(yield* agents.get(AgentV2.ID.make("rogue"))).toBeUndefined()
      yield* Effect.promise(() => writeFile(path.join(f.workspaceDirectory, ".orchestra", "agents", "late.md"), "---\nname: Late\n---\nNever load me."))
      yield* agents.reload()
      expect(yield* agents.get(AgentV2.ID.make("late"))).toBeUndefined()
    }))
  }))
})

test("core-team-config-02: one physical Location never shares mutable services across Team, person or request lease", async () => {
  await using f = await fixture()
  await configure(f, profileA, "approved/alpha")
  await configure(f, profileB, "approved/beta")
  const otherCookie = await f.login(other)
  await f.run(Effect.gen(function* () {
    const owners = yield* SessionOwner.Service
    const locations = yield* LocationServiceMap.makeScoped(owners, configured)
    const first = yield* f.capture(f.businessRequest(profileA))
    const second = yield* f.capture(f.businessRequest(profileB))
    const person = yield* f.capture(f.businessRequest(profileA, otherCookie))
    const anotherRequest = yield* f.capture(f.businessRequest(profileA))
    const read = (lease: SessionOwner.Lease) => SessionOwner.withLease(lease, locations.contextEffect(Location.Ref.make({ ...f.location })))
    yield* refused(locations.keys)
    expect(yield* SessionOwner.withLease(first, locations.keys)).toEqual([])
    const a = yield* read(first)
    const repeat = yield* read(first)
    const b = yield* read(second)
    const user = yield* read(person)
    expect(yield* SessionOwner.withLease(anotherRequest, locations.keys)).toEqual([])
    const request = yield* read(anotherRequest)
    for (const lease of [first, second, person, anotherRequest])
      expect(yield* SessionOwner.withLease(lease, locations.keys)).toEqual([f.location])
    expect(Context.get(repeat, Config.Service)).toBe(Context.get(a, Config.Service))
    expect(Context.get(repeat, AgentV2.Service)).toBe(Context.get(a, AgentV2.Service))
    for (const foreign of [b, user, request]) {
      expect(Context.get(foreign, Config.Service)).not.toBe(Context.get(a, Config.Service))
      expect(Context.get(foreign, AgentV2.Service)).not.toBe(Context.get(a, AgentV2.Service))
    }
    expect(Config.latest(yield* Context.get(b, Config.Service).entries(), "model")).toBe("approved/beta")
    expect(Config.latest(yield* Context.get(user, Config.Service).entries(), "model")).toBe("approved/alpha")
    yield* SessionOwner.withLease(second, locations.invalidate(f.location))
    expect(yield* SessionOwner.withLease(second, locations.keys)).toEqual([])
    expect(yield* SessionOwner.withLease(first, locations.keys)).toEqual([f.location])
    expect(Context.get(yield* read(first), Config.Service)).toBe(Context.get(a, Config.Service))
  }))
})

test("core-team-config-03: a changed Team revision closes old handles and a new request reads the current shared document", async () => {
  await using f = await fixture()
  await configure(f, profileA, "approved/first")
  await f.run(Effect.gen(function* () {
    const owners = yield* SessionOwner.Service
    const locations = yield* LocationServiceMap.makeScoped(owners, configured)
    const lease = yield* f.capture()
    const context = yield* SessionOwner.withLease(lease, locations.contextEffect(f.location))
    const old = Context.get(context, Config.Service)
    const oldAgents = Context.get(context, AgentV2.Service)
    yield* Effect.promise(() => configure(f, profileA, "approved/current"))
    yield* refused(old.entries())
    yield* refused(oldAgents.get(AgentV2.ID.make("analyst")))
    yield* refused(oldAgents.all())
    yield* refused(oldAgents.reload())
    let lateTransforms = 0
    yield* refused(oldAgents.transform(() => { lateTransforms++ }))
    expect(lateTransforms).toBe(0)
    yield* refused(SessionOwner.withLease(lease, locations.keys))
    yield* refused(SessionOwner.withLease(lease, locations.contextEffect(f.location)))
    const next = yield* f.capture(f.businessRequest())
    const current = Context.get(yield* SessionOwner.withLease(next, locations.contextEffect(f.location)), Config.Service)
    expect(current).not.toBe(old)
    expect(Config.latest(yield* current.entries(), "model")).toBe("approved/current")
  }))
})

test("core-team-config-04: missing Team configuration and an absent lease never fall back to filesystem configuration", async () => {
  await using f = await fixture()
  await writeFile(path.join(f.workspaceDirectory, "orchestra.json"), JSON.stringify({ model: "private/fallback" }))
  await f.run(Effect.gen(function* () {
    const owners = yield* SessionOwner.Service
    const locations = yield* LocationServiceMap.makeScoped(owners, configured)
    yield* refused(locations.contextEffect(f.location))
    const lease = yield* f.capture()
    yield* refused(SessionOwner.withLease(lease, locations.contextEffect(f.location)))
  }))
})

test("core-team-config-05: logout while the source is awaited prevents cache publication and late callbacks", async () => {
  await using f = await fixture()
  await configure(f, profileA, "approved/alpha")
  const held = barrier()
  f.productHooks.beforeConfiguration = held.hold
  await f.run(Effect.gen(function* () {
    const owners = yield* SessionOwner.Service
    const locations = yield* LocationServiceMap.makeScoped(owners, configured)
    const lease = yield* f.capture()
    const pending = yield* SessionOwner.withLease(lease, locations.contextEffect(f.location)).pipe(Effect.forkChild)
    yield* Effect.raceFirst(
      Effect.promise(() => held.entered),
      Fiber.await(pending).pipe(Effect.flatMap(() => Effect.die("Configuration acquisition ended before the source barrier"))),
    )
    yield* Effect.promise(() => f.logout(f.cookie))
    held.release()
    expect(Exit.isFailure(yield* Fiber.await(pending))).toBe(true)
    yield* refused(SessionOwner.withLease(lease, locations.contextEffect(f.location)))
  }))
})
