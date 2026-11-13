import { selection } from "./fixture.ts"
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
import { registerSfResidentAgents, sfSourceFor } from "../../../../product/host-binding/resident-agents.ts"
import type { SfSourceCapability } from "../../../../product/contracts/runtime.ts"
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
      const result = yield* Effect.result(registerSfResidentAgents({ agents, skills, selected: [selection(profile)], source: { type: "directory", path: AbsolutePath.make(root) } }))
      if (result._tag === "Failure") return { result, skills }
      expect(sfSourceFor(result.success, skills, selection(profile))).toBeDefined()
      expect(sfSourceFor({} as SfSourceCapability, skills, selection(profile))).toBeUndefined()
      expect(sfSourceFor(result.success, skills, { ...selection(profile), manifestDigest: "e".repeat(64) })).toBeUndefined()
      return { result, skills }
    }).pipe(Effect.scoped, Effect.provide(layer), Effect.runPromise)
    const missing = await run()
    expect(missing.result._tag).toBe("Failure")
    if (missing.result._tag === "Failure") expect(missing.result.failure).toEqual({ code: "invalid-skill", reason: "resident-skill-missing" })
    await mkdir(path.join(root, "sf-explicar-forecast"))
    await writeFile(path.join(root, "sf-explicar-forecast", "SKILL.md"), "---\nname: sf-explicar-forecast\ndescription: Explain forecast\n---\n# Instructions\n")
    const loaded = await run()
    expect(loaded.result._tag).toBe("Success")
    if (loaded.result._tag === "Success") expect(sfSourceFor(loaded.result.success, loaded.skills, selection(profile))).toBeUndefined()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
