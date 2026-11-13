import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { ModelV2 } from "@orchestra/core/model"
import { ProviderV2 } from "@orchestra/core/provider"
import { SessionExecution } from "@orchestra/core/session/execution"
import { SessionExecutionLocal } from "@orchestra/core/session/execution/local"
import { Effect } from "effect"
import { createSfNativeExecution } from "../src/sucafina-product/native-execution.ts"
import { createSfNativeHostContribution, SfNativeHost } from "../src/sucafina-product/native-host.ts"
import { digestSfValue } from "../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { ResidentProfile } from "../../../modules/sucafina/Sucafinav1/product/contracts/resident-ai.ts"
import type { SfNativeRunRecord } from "../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import { selection } from "../../../modules/sucafina/Sucafinav1/test/product/wp10/resident-runtime/fixture.ts"
import { createSfRunStore } from "../../../modules/sucafina/Sucafinav1/product/ai/run-store.ts"
import { createSfExecutionBindingRegistry } from "../../../modules/sucafina/Sucafinav1/product/host-binding/execution-context.ts"
import { createSfProductState } from "../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"

test("native execution denies forged tickets and rejected preflight without creating a durable run", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-native-execution-"))
  await chmod(directory, 0o700)
  const persistence = await openLocalStore(join(directory, "store"))
  try {
    const state = createSfProductState({ persistence, authorize: async () => undefined, resolveTarget: async () => undefined, createId: () => "unused" })
    const store = createSfRunStore({ state, requestFor: () => undefined, revalidate: async () => false,
      preflight: async () => ({ status: "denied", reason: "unavailable" }),
      revalidateForCommit: async () => ({ status: "denied", reason: "unavailable" }), now: () => "2026-11-13T00:00:00Z" })
    const registry = createSfExecutionBindingRegistry({ authenticateAndResolve: async () => undefined, revalidateAdmission: async () => false })
    const contribution = createSfNativeHostContribution({ registry, admit: () => Effect.succeed(false), authorize: () => Effect.succeed(false) })
    const layer = AppNodeBuilder.build(LayerNode.group([contribution.node]), [[SessionExecution.node, SessionExecutionLocal.node]])
    await Effect.gen(function* () {
      const host = yield* SfNativeHost
      const execution = createSfNativeExecution({ host, store,
        withRunContext: async () => ({ status: "denied", reason: "no-context" }),
        preflight: async () => ({ status: "denied", reason: "case-not-authorized" }),
        verifyOutput: async () => ({ status: "denied", reason: "unverified" }),
      })
      expect(yield* Effect.promise(() => Reflect.apply(execution.execute, execution, [Object.freeze({})]))).toEqual({ status: "denied", reason: "native-ticket-unavailable" })
      expect(yield* Effect.promise(() => execution.admit({ caseRef: { id: "case", incarnation: "inc", version: 1 }, profileId: "sf_finance", profileVersion: "1",
        skillId: "sf-explicar-forecast", skillVersion: "1", manifestDigest: "a".repeat(64), outputSchemaVersion: "1",
        requestedOperationScope: ["sf_forecast_compare"], objective: "Explain", contextFingerprint: "context" }, {})))
        .toEqual({ status: "denied", reason: "case-not-authorized" })
      const profile: ResidentProfile = { id: "sf_finance", version: "1", mission: "Finance", sourcePath: "profile.json", sourceDigest: "a".repeat(64),
        allowedSkills: ["sf-explicar-forecast"], allowedOperations: ["sf_forecast_compare"], outputTypes: [], contextBudgetTokens: 1000,
        maxSteps: 2, maxDelegations: 0, modelClass: "reasoning", resumePolicy: "fresh" }
      const selected = selection(profile)
      const request = { caseRef: { id: "case", incarnation: "inc", version: 1 }, profileId: profile.id, profileVersion: profile.version,
        skillId: "sf-explicar-forecast", skillVersion: "1", manifestDigest: selected.manifestDigest, outputSchemaVersion: "1",
        requestedOperationScope: ["sf_forecast_compare"], objective: "Explain", contextFingerprint: "context" }
      const model = ModelV2.Ref.make({ providerID: ProviderV2.ID.make("openai"), id: ModelV2.ID.make("fixture-model") })
      const record: SfNativeRunRecord = { schema: "sf-native-run-v1", runRef: "run-concurrent", version: 1,
        requestDigest: digestSfValue(request), skillInputDigest: digestSfValue({}), principalRef: "user", accessRevision: "access", policyVersion: "policy",
        caseRef: request.caseRef, selection: selected, model, skillId: request.skillId, objective: request.objective,
        contextFingerprint: request.contextFingerprint, createdAt: "2026-11-13T00:00:00Z", updatedAt: "2026-11-13T00:00:00Z", state: "preparing" }
      const started = Promise.withResolvers<void>()
      const release = Promise.withResolvers<void>()
      const concurrent = createSfNativeExecution({ host, store,
        withRunContext: async () => { started.resolve(); await release.promise; return { status: "unavailable", reason: "fixture-stopped" } },
        preflight: async () => ({ status: "ok", value: { record, native: { request: new Request("https://example.test/"), selected,
          location: Location.Ref.make({ directory: AbsolutePath.make(directory) }), model, skillId: request.skillId, prompt: "Explain",
          runId: record.runRef, caseRef: request.caseRef, entryMode: "interactive", toolCallBudget: 1, skillLoadBudget: 0 } } }),
        verifyOutput: async () => ({ status: "denied", reason: "unverified" }),
      })
      const first = concurrent.admit(request, {})
      yield* Effect.promise(() => started.promise)
      try {
        expect(yield* Effect.promise(() => concurrent.admit(request, {}))).toEqual({ status: "conflict", reason: "native-run-already-admitted" })
      } finally {
        release.resolve()
      }
      expect(yield* Effect.promise(() => first)).toEqual({ status: "unavailable", reason: "fixture-stopped" })
    }).pipe(Effect.scoped, Effect.provide(layer), Effect.runPromise)
    await persistence.transaction("dashboard", async (snapshot) => {
      expect(snapshot.data.__sfProductV1).toBeUndefined()
      return { commit: false, value: undefined }
    })
  } finally {
    await persistence.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
