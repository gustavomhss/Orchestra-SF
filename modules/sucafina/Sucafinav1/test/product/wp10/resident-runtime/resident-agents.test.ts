import { expect, test } from "bun:test"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { AgentV2 } from "@orchestra/core/agent"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { FSUtil } from "@orchestra/core/fs-util"
import { AbsolutePath } from "@orchestra/core/schema"
import { SkillV2 } from "@orchestra/core/skill"
import { SkillDiscovery } from "@orchestra/core/skill/discovery"
import { Effect, Layer } from "effect"
import { registerSfResidentAgents } from "../../../../product/host-binding/resident-agents.ts"
import type { ResidentProfile } from "../../../../product/contracts/resident-ai.ts"

const profile: ResidentProfile = {
  id: "sf_finance", version: "1", mission: "Finance", sourcePath: "profile.json", sourceDigest: "a".repeat(64),
  allowedSkills: ["sf-explicar-forecast"], allowedOperations: ["sf_forecast_compare"], outputTypes: [],
  contextBudgetTokens: 1000, maxSteps: 2, maxDelegations: 0, modelClass: "reasoning", resumePolicy: "fresh",
}
const discovery = Layer.succeed(SkillDiscovery.Service, SkillDiscovery.Service.of({ pull: () => Effect.succeed([]) }))
const layer: Layer.Layer<SkillV2.Service | AgentV2.Service | FSUtil.Service, LayerNode.Error<typeof SkillV2.node | typeof AgentV2.node | typeof FSUtil.node>> = AppNodeBuilder.build(LayerNode.group([SkillV2.node, AgentV2.node, FSUtil.node]), [[SkillDiscovery.node, discovery]])

test("resident registration rejects a missing skill and accepts the same skill from its reserved directory", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "sf-resident-"))
  try {
    const run = () => Effect.gen(function* () {
      const skills = yield* SkillV2.Service
      const agents = yield* AgentV2.Service
      return yield* Effect.result(registerSfResidentAgents({ agents, skills, profiles: [profile], source: { type: "directory", path: AbsolutePath.make(root) } }))
    }).pipe(Effect.scoped, Effect.provide(layer), Effect.runPromise)
    const missing = await run()
    expect(missing._tag).toBe("Failure")
    if (missing._tag === "Failure") expect(missing.failure).toEqual({ code: "invalid-skill", reason: "resident-skill-missing" })
    await mkdir(path.join(root, "sf-explicar-forecast"))
    await writeFile(path.join(root, "sf-explicar-forecast", "SKILL.md"), "---\nname: sf-explicar-forecast\ndescription: Explain forecast\n---\n# Instructions\n")
    expect((await run())._tag).toBe("Success")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
