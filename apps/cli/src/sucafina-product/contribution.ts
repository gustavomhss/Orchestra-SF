import { AgentV2 } from "@orchestra/core/agent"
import { makeLocationNode } from "@orchestra/core/effect/app-node"
import { Mcp } from "@orchestra/core/mcp"
import { PluginV2 } from "@orchestra/core/plugin"
import { SkillV2 } from "@orchestra/core/skill"
import { ToolRegistry } from "@orchestra/core/tool/registry"
import { Tool } from "@orchestra/core/tool/tool"
import { Tools } from "@orchestra/core/tool/tools"
import { Effect, JsonSchema, Layer } from "effect"
import { sfOperationInputSchemas } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { CreateSfProductContribution } from "../../../../modules/sucafina/Sucafinav1/product/contracts/runtime.ts"
import { dispatchSfCapability } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/capability-dispatch.ts"
import { registerSfResidentAgents } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/resident-agents.ts"
import { createSfBusinessMcpBridge } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/sf-mcp-bridge.ts"

/** Add SF services to each Location without replacing core Session or execution services. */
export const createSfProductContribution: CreateSfProductContribution = (input) => ({
  id: "sucafina-product",
  locationNodes: [makeLocationNode({
    name: "sucafina/product-runtime",
    deps: [AgentV2.node, SkillV2.node, ToolRegistry.node, Mcp.node, PluginV2.node],
    layer: Layer.effectDiscard(Effect.gen(function* () {
      const agents = yield* AgentV2.Service
      const skills = yield* SkillV2.Service
      const tools = yield* Tools.Service
      const mcp = yield* Mcp.Service
      const plugins = yield* PluginV2.Service
      yield* plugins.wait(PluginV2.ID.make("config-agent"))
      const sourceCapability = yield* registerSfResidentAgents({ agents, skills, selected: input.selected, source: input.source }).pipe(Effect.orDie)
      input.onRegistered({ skills, sourceCapability })
      const bridge = createSfBusinessMcpBridge({
        registry: input.registry, mcp, descriptors: input.descriptors,
        dispatch: (operation, payload, context) => dispatchSfCapability({
          operation, payload, context, descriptors: input.descriptors, authority: input.authority,
          validateInput: (descriptor, value) => Object.hasOwn(sfOperationInputSchemas, descriptor.id) &&
            decodeSfOperationInput(descriptor.id as keyof typeof sfOperationInputSchemas, value).ok,
          validateOutput: (descriptor, result) => result.status !== "ok" ||
            (Object.hasOwn(sfOperationInputSchemas, descriptor.id) &&
              decodeSfOperationOutput(descriptor.id as keyof typeof sfOperationInputSchemas, result.result).ok),
        }),
      })
      yield* tools.register(Object.fromEntries(input.descriptors.map((descriptor) => [descriptor.id, Tool.dynamic({
        description: `Sucafina ${descriptor.id}`,
        inputSchema: descriptor.inputSchema as JsonSchema.JsonSchema,
        execute: (payload, context) => Effect.tryPromise({
          try: async () => {
            const result = await bridge.call(context, descriptor.id, payload)
            return { structured: result, content: [{ type: "text" as const, text: JSON.stringify(result) }] }
          },
          catch: () => new Tool.Failure({ message: "Sucafina operation unavailable" }),
        }),
      })]))).pipe(Effect.orDie)
    })),
  })],
})
