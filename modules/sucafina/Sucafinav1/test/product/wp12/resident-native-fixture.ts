import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import { SessionV2 } from "@orchestra/core/session"
import { SessionExecution } from "@orchestra/core/session/execution"
import { SessionExecutionLocal } from "@orchestra/core/session/execution/local"
import { SkillDiscovery } from "@orchestra/core/skill/discovery"
import { Effect, Layer } from "effect"

// Native Task construction captures the application's exported process coordinator.
// A replacement in a dependency graph alone does not export it to Location scopes.
export const residentNativeLayer = AppNodeBuilder.build(
  LayerNode.group([SessionV2.node, SessionExecution.node, LocationServiceMap.node]),
  [
    [SessionExecution.node, SessionExecutionLocal.node],
    [SkillDiscovery.node, Layer.succeed(SkillDiscovery.Service, SkillDiscovery.Service.of({ pull: () => Effect.succeed([]) }))],
  ],
)
