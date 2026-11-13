import { randomUUID } from "node:crypto"
import path from "node:path"
import { makeGlobalNode } from "@orchestra/core/effect/app-node"
import { ProjectV2 } from "@orchestra/core/project"
import { AbsolutePath } from "@orchestra/core/schema"
import { Effect, Layer } from "effect"
import type { CreateSfHostRuntime, SfHostRuntime } from "../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"

/** Resolves placement in the application's existing graph before it accepts HTTP. No second Session coordinator. */
export const createSfHostRuntime: CreateSfHostRuntime = async (input) => {
  if (!input.installationId.trim() || !path.isAbsolute(input.directory) || path.resolve(input.directory) !== input.directory) throw new Error("SF_HOST_PLACEMENT_INVALID")
  const directory = AbsolutePath.make(input.directory)
  const state: { identity?: ReturnType<SfHostRuntime["identity"]> } = {}
  const node = makeGlobalNode({
    name: "sucafina/host-context",
    deps: [ProjectV2.node],
    layer: Layer.effectDiscard(Effect.gen(function* () {
      const projects = yield* ProjectV2.Service
      const project = yield* projects.resolve(directory)
      const identity = Object.freeze({ installationId: input.installationId, hostId: randomUUID(), projectId: project.id,
        location: Object.freeze({ directory }) })
      state.identity = identity
      yield* Effect.addFinalizer(() => Effect.sync(() => { if (state.identity === identity) state.identity = undefined }))
    })),
  })
  return { identity: () => state.identity, contributions: [{ id: "sucafina-host-context", nodes: [node] }] }
}
