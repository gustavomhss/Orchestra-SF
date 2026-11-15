import { cp, mkdir, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { AgentV2 } from "@orchestra/core/agent"
import { Database } from "@orchestra/core/database/database"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { EventV2 } from "@orchestra/core/event"
import { Global } from "@orchestra/core/global"
import { Host } from "@orchestra/core/host"
import { Location } from "@orchestra/core/location"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionV2 } from "@orchestra/core/session"
import { SessionExecution } from "@orchestra/core/session/execution"
import { SessionExecutionLocal } from "@orchestra/core/session/execution/local"
import { SkillV2 } from "@orchestra/core/skill"
import { ApplicationTools } from "@orchestra/core/tool/application-tools"
import { ToolRegistry } from "@orchestra/core/tool/registry"
import { Context, Effect } from "effect"
import type { Scope } from "effect"
import { createSfProductContribution } from "../../../../../../apps/cli/src/sucafina-product/contribution.ts"
import { createResidentAiBundle } from "../../../product/ai/resident.ts"
import type { SfBindingRegistry, SfDomainValidation, SfSourceCapability } from "../../../product/contracts/runtime.ts"
import type { CapabilityDescriptor } from "../../../product/contracts/sf-execution.ts"
import { createSfExecutionBindingRegistry } from "../../../product/host-binding/execution-context.ts"
import type { SfVerifiedCallObserver } from "../../../product/host-binding/verified-call.ts"

type SkillLocation = {
  location: Location.Ref
  skills: SkillV2.Interface
  agents: AgentV2.Interface
  tools: ToolRegistry.Interface
  sourceCapability: SfSourceCapability
}

export type SkillHost = SkillLocation & {
  bundle: Awaited<ReturnType<typeof createResidentAiBundle>>
  residentRoot: string
  directory: string
  session: SessionV2.Interface
  registry: SfBindingRegistry
  locations: Context.Service.Shape<typeof LocationServiceMap.Service>
  at: (directory: string) => Effect.Effect<SkillLocation, unknown, Scope.Scope>
}

export type SkillHostOptions = {
  registry?: SfBindingRegistry
  authority?: SfDomainValidation
  descriptors?: readonly CapabilityDescriptor[]
  onVerifiedCall?: SfVerifiedCallObserver
}

/** Real public host contribution, Location routing, SessionV2, projection and SQLite.
 * The supplied SF business authority remains the caller's explicitly labelled fixture.
 * No Task admission or provider turn is manufactured by this fixture.
 */
export async function withSkillHost<A>(use: (host: SkillHost) => Effect.Effect<A, unknown, Scope.Scope>, options: SkillHostOptions = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), "sf68-skills-"))
  const residentRoot = path.join(directory, "resident")
  try {
    await cp(path.resolve(import.meta.dir, "../../../product/ai"), residentRoot, { recursive: true })
    await Promise.all(["project", "home", "data", "config", "cache", "state", "bin", "log", "repos"].map((name) =>
      mkdir(path.join(directory, name), { recursive: true })))
    const bundle = await createResidentAiBundle({ root: residentRoot, manifestPath: path.join(residentRoot, "manifests/resident.json") })
    const registered = new WeakMap<SkillV2.Interface, SfSourceCapability>()
    const registry = options.registry ?? createSfExecutionBindingRegistry({
      authenticateAndResolve: async () => undefined,
      revalidateAdmission: async () => false,
    })
    const authority = options.authority ?? {
      validateDomainContext: async () => false,
      revalidateDomainContext: async () => false,
      receiptFor: () => undefined,
    }
    const contribution = createSfProductContribution({
      registry, authority, descriptors: options.descriptors ?? [], selected: bundle.selected, source: bundle.source,
      onRegistered: (registration) => { registered.set(registration.skills, registration.sourceCapability) },
      onVerifiedCall: options.onVerifiedCall,
    })
    const host = Host.merge([contribution])
    const layer = AppNodeBuilder.build(LayerNode.group([
      ApplicationTools.node, Database.node, EventV2.node, SessionV2.node, SessionExecution.node, LocationServiceMap.node, ...host.nodes,
    ]), [
      [SessionExecution.node, SessionExecutionLocal.node],
      [Database.node, Database.layerFromPath(path.join(directory, "sessions.sqlite"))],
      [Global.node, Global.layerWith({
        home: path.join(directory, "home"), data: path.join(directory, "data"), config: path.join(directory, "config"),
        cache: path.join(directory, "cache"), state: path.join(directory, "state"), tmp: directory,
        bin: path.join(directory, "bin"), log: path.join(directory, "log"), repos: path.join(directory, "repos"),
      })],
      ...host.replacements,
    ], host.locationNodes)
    return await Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const locations = yield* LocationServiceMap.Service
      const at = (directory: string) => Effect.gen(function* () {
        const location = Location.Ref.make({ directory: AbsolutePath.make(directory) })
        const context = yield* locations.contextEffect(location)
        const skills = Context.get(context, SkillV2.Service)
        const sourceCapability = registered.get(skills)
        if (!sourceCapability) return yield* Effect.die("SF68 real host did not register its resident source")
        return { location, skills, sourceCapability, agents: Context.get(context, AgentV2.Service), tools: Context.get(context, ToolRegistry.Service) }
      })
      const placed = yield* at(path.join(directory, "project"))
      return yield* use({ ...placed, bundle, residentRoot, directory, session, registry, locations, at })
    }).pipe(Effect.scoped, Effect.provide(layer), Effect.runPromise)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
