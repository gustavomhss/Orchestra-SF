import { expect, test } from "bun:test"
import path from "node:path"
import { AgentV2 } from "@orchestra/core/agent"
import { Catalog } from "@orchestra/core/catalog"
import { makeLocationNode } from "@orchestra/core/effect/app-node"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Location } from "@orchestra/core/location"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import { PluginV2 } from "@orchestra/core/plugin"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionV2 } from "@orchestra/core/session"
import { SessionExecution } from "@orchestra/core/session/execution"
import { SessionExecutionLocal } from "@orchestra/core/session/execution/local"
import { SessionRunnerModel } from "@orchestra/core/session/runner/model"
import { SkillV2 } from "@orchestra/core/skill"
import { Effect, Layer } from "effect"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { createResidentAiBundle } from "../../../product/ai/resident.ts"
import type { SfSourceCapability } from "../../../product/contracts/runtime.ts"
import { registerSfResidentAgents } from "../../../product/host-binding/resident-agents.ts"
import { loadSfSkill } from "../../../product/host-binding/skill-loader.ts"

// This is an observation of the installed Core model admission, not an inference
// witness. No catalog/provider/model, credential, Session or budget gate is faked.
// A positive candidate still requires the authorized SF host, case and C15 gate.
test("native probe observes actual Location model admission after a real Session skill load", async () => {
  expectSpawn(import.meta.path)
  const root = path.resolve(import.meta.dir, "../../../product/ai")
  const bundle = await createResidentAiBundle({ root, manifestPath: path.join(root, "manifests/native-probe.json") })
  const selected = bundle.selected[0]!
  const skill = selected.skills[0]!
  expect(bundle.selected).toHaveLength(1)
  expect(selected.profile.id).toBe("sf_finance")
  expect(skill.id).toBe("sf-explicar-forecast")
  expect(selected.operationIds).toEqual(["sf_forecast_compare"])

  const capabilities = new WeakMap<SkillV2.Interface, SfSourceCapability>()
  const layer = AppNodeBuilder.build(
    LayerNode.group([SessionV2.node, SessionExecution.node, LocationServiceMap.node]),
    [[SessionExecution.node, SessionExecutionLocal.node]],
    [makeLocationNode({
      name: "wp12/native-admission-registration",
      deps: [AgentV2.node, SkillV2.node, PluginV2.node],
      layer: Layer.effectDiscard(Effect.gen(function* () {
        const agents = yield* AgentV2.Service
        const skills = yield* SkillV2.Service
        const plugins = yield* PluginV2.Service
        yield* plugins.wait(PluginV2.ID.make("config-agent"))
        const capability = yield* registerSfResidentAgents({ ...bundle, agents, skills }).pipe(Effect.orDie)
        capabilities.set(skills, capability)
      })),
    })],
  )
  const location = Location.Ref.make({ directory: AbsolutePath.make(root) })
  await Effect.gen(function* () {
    const session = yield* SessionV2.Service
    const locations = yield* LocationServiceMap.Service
    yield* Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      const resolver = yield* SessionRunnerModel.Service
      const skills = yield* SkillV2.Service
      const capability = capabilities.get(skills)
      if (!capability) throw new Error("Native admission source registration was not observed")

      // Location acquisition waits for PluginInternal.boot, so this reads the
      // populated installed catalog, not an uninitialized service or fixture.
      const available = yield* catalog.model.available()
      const candidates = available.map((model) => ({ providerID: model.providerID, id: model.id,
        supported: SessionRunnerModel.supported(model) }))
      const created = yield* session.create({ location, agent: AgentV2.ID.make(selected.profile.id) })
      const receipt = yield* loadSfSkill({ session, skills, sourceCapability: capability, selected,
        sessionID: created.id, profile: selected.profile, skill, runId: `wp12-admission-${created.id}`,
        manifestDigest: bundle.manifestDigest })
      const persisted = yield* session.get(created.id)
      const messages = yield* session.messages({ sessionID: created.id })
      const loaded = messages.find((message) => message.id === receipt.loadedMessageId)
      expect(loaded?.type).toBe("synthetic")
      expect(receipt).toMatchObject({ nativeSessionId: persisted.id, profileId: selected.profile.id,
        skillId: skill.id, sourceDigest: skill.sourceDigest, instructionsDigest: skill.instructionsDigest })
      expect(messages.some((message) => message.type === "assistant")).toBe(false)

      const resolution = yield* Effect.result(resolver.resolve(persisted))
      const observation = { scope: "native-model-admission-only", githubSha: process.env.GITHUB_SHA ?? null,
        nativeSessionId: persisted.id, receipt, candidates, inferenceExecuted: false,
        outputRef: null, consumerRef: null, gnativeAccepted: false }
      if (resolution._tag === "Failure") {
        console.log("SF_WP12_NATIVE_ADMISSION:" + JSON.stringify({ ...observation, status: "unavailable",
          reason: resolution.failure._tag }))
        // A failure with configured candidates is actionable and must fail this
        // check rather than being reduced to an absent-provider observation.
        expect(candidates.filter((candidate) => candidate.supported)).toHaveLength(0)
        expect(resolution.failure._tag).toBe("SessionRunnerModel.ModelNotSelectedError")
        expect(yield* session.messages({ sessionID: created.id })).toEqual(messages)
        return
      }

      const actual = SessionRunnerModel.reference(resolution.success)
      console.log("SF_WP12_NATIVE_ADMISSION:" + JSON.stringify({ ...observation, status: "candidate-available",
        model: actual && { providerID: actual.providerID, id: actual.id, variant: actual.variant ?? "default" } }))
      expect(actual).toBeDefined()
      expect(actual !== undefined && candidates.some((candidate) => candidate.supported && candidate.providerID === actual.providerID && candidate.id === actual.id)).toBe(true)
      expect(yield* session.messages({ sessionID: created.id })).toEqual(messages)
    }).pipe(Effect.provide(locations.get(location)))
  }).pipe(Effect.scoped, Effect.provide(layer), Effect.runPromise)
}, 120_000)
