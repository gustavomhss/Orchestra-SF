import { AgentV2 } from "@orchestra/core/agent"
import { makeLocationNode } from "@orchestra/core/effect/app-node"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import { PluginV2 } from "@orchestra/core/plugin"
import { SessionV2 } from "@orchestra/core/session"
import { SessionExecution } from "@orchestra/core/session/execution"
import { SessionExecutionLocal } from "@orchestra/core/session/execution/local"
import { SkillV2 } from "@orchestra/core/skill"
import { SkillDiscovery } from "@orchestra/core/skill/discovery"
import { Effect, Layer } from "effect"
import type { Scope } from "effect"
import type { SfResidentRegistration, SfSourceCapability } from "../../../product/contracts/runtime.ts"
import { registerSfResidentAgents } from "../../../product/host-binding/resident-agents.ts"

// Native Task construction captures the application's exported process coordinator.
// A replacement in a dependency graph alone does not export it to Location scopes.
const root = LayerNode.group([SessionV2.node, SessionExecution.node, LocationServiceMap.node])
const replacements: LayerNode.Replacements = [
  [SessionExecution.node, SessionExecutionLocal.node],
  [SkillDiscovery.node, Layer.succeed(SkillDiscovery.Service, SkillDiscovery.Service.of({ pull: () => Effect.succeed([]) }))],
]

export const residentNativeLayer = AppNodeBuilder.build(root, replacements)

/** SessionExecution resolves the persisted Session's Location itself. Register in every
 * Location acquisition, as a host contribution does, instead of only the test's first scope. */
export function createResidentNativeFixture(
  input: Pick<SfResidentRegistration, "selected" | "source">,
  beforeRegister?: (skills: SkillV2.Interface) => Effect.Effect<void, never, Scope.Scope>,
) {
  const capabilities = new WeakMap<SkillV2.Interface, SfSourceCapability>()
  return {
    layer: AppNodeBuilder.build(root, replacements, [makeLocationNode({
      name: "wp12/resident-registration",
      deps: [AgentV2.node, SkillV2.node, PluginV2.node],
      layer: Layer.effectDiscard(Effect.gen(function* () {
        const agents = yield* AgentV2.Service
        const skills = yield* SkillV2.Service
        const plugins = yield* PluginV2.Service
        yield* plugins.wait(PluginV2.ID.make("config-agent"))
        if (beforeRegister) yield* beforeRegister(skills)
        const capability = yield* registerSfResidentAgents({ ...input, agents, skills }).pipe(Effect.orDie)
        capabilities.set(skills, capability)
      })),
    })]),
    capabilityFor: (skills: SkillV2.Interface) => {
      const capability = capabilities.get(skills)
      if (!capability) throw new Error("Resident source was not registered in this Location")
      return capability
    },
  }
}
