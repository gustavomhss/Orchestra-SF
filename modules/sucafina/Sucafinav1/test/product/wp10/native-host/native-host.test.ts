import { expect, test } from "bun:test"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Host } from "@orchestra/core/host"
import { SessionV2 } from "@orchestra/core/session"
import { SessionExecution } from "@orchestra/core/session/execution"
import { SessionExecutionLocal } from "@orchestra/core/session/execution/local"
import { SessionSchema } from "@orchestra/core/session/schema"
import { Effect } from "effect"
import { createSfNativeHostContribution, SfNativeHost } from "../../../../../../../apps/cli/src/sucafina-product/native-host.ts"
import { createSfExecutionBindingRegistry } from "../../../../product/host-binding/execution-context.ts"
import type { ResidentProfile, SkillLoadReceipt } from "../../../../product/contracts/resident-ai.ts"
import { selection } from "../resident-runtime/fixture.ts"

test("native host adds no reserved service and refuses execution without a C15 gate", async () => {
  const profile: ResidentProfile = { id: "sf_finance", version: "1", mission: "Finance", sourcePath: "profile.json", sourceDigest: "a".repeat(64),
    allowedSkills: ["sf-explicar-forecast"], allowedOperations: ["sf_forecast_compare"], outputTypes: [], contextBudgetTokens: 1000,
    maxSteps: 2, maxDelegations: 0, modelClass: "reasoning", resumePolicy: "fresh" }
  const sessionID = SessionSchema.ID.make("ses_host_gate")
  const receipt: SkillLoadReceipt = { runId: "run-1", nativeSessionId: sessionID, profileId: profile.id, profileVersion: profile.version,
    profileDigest: profile.sourceDigest, skillId: "sf-explicar-forecast", skillVersion: "1", sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64),
    loadedMessageId: "msg_loaded", loadedAt: new Date().toISOString(), manifestDigest: "d".repeat(64) }
  const registry = createSfExecutionBindingRegistry({ authenticateAndResolve: async () => ({ installationId: "i", hostId: "h", projectId: "p", locationId: "l",
    principalRef: "person", policyVersion: "policy", accessRevision: "revision", providerGeneration: 1, expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    revalidateAdmission: async () => true })
  const bound = await registry.bind({ request: new Request("https://example.test/"), selected: selection(profile), sessionID, runId: receipt.runId,
    caseRef: { id: "case", version: 1, incarnation: "inc" }, profile, manifestDigest: receipt.manifestDigest, skillReceipts: [receipt], entryMode: "interactive" })
  expect(bound.status).toBe("ok")
  if (bound.status !== "ok") return
  const product = createSfNativeHostContribution({ registry, admit: () => Effect.succeed(true), authorize: () => Effect.succeed(true) })
  expect(Host.merge([product.contribution]).nodes).toHaveLength(1)
  const layer = AppNodeBuilder.build(LayerNode.group([product.node, SessionV2.node]), [[SessionExecution.node, SessionExecutionLocal.node]])
  await Effect.gen(function* () {
    const session = yield* SessionV2.Service
    const host = yield* SfNativeHost
    const before = yield* session.list()
    const result = yield* host.execute(bound.value)
    expect(result).toEqual({ status: "unavailable", reason: "c15-context-budget-gate-unavailable" })
    expect(yield* session.list()).toEqual(before)
  }).pipe(Effect.scoped, Effect.provide(layer), Effect.runPromise)
})
