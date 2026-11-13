import { expect, test } from "bun:test"
import path from "node:path"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { AgentV2 } from "@orchestra/core/agent"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Global } from "@orchestra/core/global"
import { Host } from "@orchestra/core/host"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import { SessionV2 } from "@orchestra/core/session"
import { SessionExecution } from "@orchestra/core/session/execution"
import { SessionExecutionLocal } from "@orchestra/core/session/execution/local"
import { SkillV2 } from "@orchestra/core/skill"
import { Snapshot } from "@orchestra/core/snapshot"
import { Context, Effect } from "effect"
import { ProductHost } from "../src/host.ts"
import { createSfHostRuntime } from "../src/sucafina-product/host-context.ts"
import { openLocalStore } from "../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"
import { createSfSourcePersistence } from "../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../modules/sucafina/Sucafinav1/product/integration/source-inventory.ts"

test("installation registers its five real resident profiles and eighteen shipped skills in the existing graph", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-host-composition-"))
  await chmod(directory, 0o700)
  const driver = await openLocalStore(path.join(directory, "business"))
  const persistence = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: crypto.randomUUID })
  try {
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    const runtime = await createSfHostRuntime({ installationId: "installation-1", directory, sourceRoot: path.resolve(import.meta.dir,
      "../../../modules/sucafina/Sucafinav1/product/ai"), origin: "http://127.0.0.1:43121", mount: "/sucafina", persistence,
      authenticate: async () => null, environment: async () => ({ at: new Date().toISOString(), id: crypto.randomUUID, directory: [] }) })
    const merged = Host.merge([...ProductHost.contributions(), ...runtime.contributions])
    const layer = AppNodeBuilder.build(LayerNode.group([...merged.nodes, SessionV2.node, LocationServiceMap.node]), [
      [SessionExecution.node, SessionExecutionLocal.node], ...merged.replacements,
      [Global.node, Global.layerWith({ home: directory, config: path.join(directory, "config"), data: path.join(directory, "data") })],
      [Snapshot.node, Snapshot.noopLayer],
    ], merged.locationNodes)
    await Effect.gen(function* () {
      const locations = yield* LocationServiceMap.Service
      const identity = runtime.identity()
      expect(identity?.installationId).toBe("installation-1")
      if (!identity) throw new Error("host identity missing")
      const context = yield* locations.contextEffect(identity.location)
      const agents = Context.get(context, AgentV2.Service)
      const skills = Context.get(context, SkillV2.Service)
      const services = runtime.services?.()
      if (!services) throw new Error("host services missing")
      expect(services.selected).toHaveLength(5)
      expect(new Set(services.selected.flatMap((selection) => selection.skills.map((skill) => skill.id))).size).toBe(18)
      for (const selection of services.selected) {
        const agent = yield* agents.get(AgentV2.ID.make(selection.profile.id))
        expect(agent?.engine).toBe("orchestra")
        expect(agent?.steps).toBe(selection.profile.maxSteps)
        for (const skill of selection.skills) expect((yield* skills.get(skill.id))?.name).toBe(skill.id)
      }
      const denied = yield* Effect.promise(() => services.ui.admit(new Request("http://127.0.0.1:43121/sucafina/dashboard"), "sf_case_read", "a".repeat(64)))
      expect(denied.status).toBe("denied")
    }).pipe(Effect.scoped, Effect.provide(layer), Effect.runPromise)
    expect(runtime.identity()).toBeUndefined()
    expect(runtime.services?.()).toBeUndefined()
  } finally {
    await driver.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}, 60_000)
