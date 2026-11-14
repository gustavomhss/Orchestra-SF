import { Config } from "@orchestra/core/config"
import { makeGlobalNode } from "@orchestra/core/effect/app-node"
import { FSUtil } from "@orchestra/core/fs-util"
import { GitCli } from "@orchestra/core/git-cli"
import type { Host } from "@orchestra/core/host"
import { Location } from "@orchestra/core/location"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import type { LocationError, LocationServices } from "@orchestra/core/location-services"
import { Relay } from "@orchestra/core/relay"
import { RelayWorkflowBinding } from "@orchestra/core/relay-workflow-binding"
import { SessionStore } from "@orchestra/core/session/store"
import { SkillV2 } from "@orchestra/core/skill"
import { MaestroSeats } from "@orchestra/maestro/v2/seats-service"
import { AuthoringGraph } from "@orchestra/relay/authoring/graph"
import { ProjectID } from "@orchestra/schema/project-id"
import { Effect, Layer, Option, type LayerMap } from "effect"
import { WorkflowRelayV2 } from "../../../../modules/maestro/coordination/src/v2/workflow/relay.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { RoutinePublicationHost } from "../../../../modules/sucafina/Sucafinav1/product/routines/publication.ts"

type Placement = Readonly<{ projectId: string; location: Location.Ref }>

/** Captures the existing Location graph and reuses Maestro's real read-only publication adapter. */
export function createSfRoutinePublicationContribution(input: {
  identity: () => Placement | undefined
  authorize: (context: TrustedDomainContext) => Promise<boolean>
  authorSession?: RoutinePublicationHost["authorSession"]
}) {
  const state: {
    locations?: LayerMap.LayerMap<Location.Ref, LocationServices, LocationError>
    store?: SessionStore.Interface
    epoch?: object
    cached?: { placement: Placement; host: RoutinePublicationHost }
  } = {}
  const node = makeGlobalNode({
    name: "sucafina/routines/publication",
    deps: [LocationServiceMap.node, SessionStore.node],
    layer: Layer.effectDiscard(Effect.gen(function* () {
      const locations = yield* LocationServiceMap.Service
      const store = yield* SessionStore.Service
      const epoch = {}
      state.locations = locations
      state.store = store
      state.epoch = epoch
      state.cached = undefined
      yield* Effect.addFinalizer(() => Effect.sync(() => {
        if (state.epoch !== epoch) return
        state.epoch = undefined
        state.locations = undefined
        state.store = undefined
        state.cached = undefined
      }))
    })),
  })
  const publication = (): RoutinePublicationHost | undefined => {
    const placement = input.identity()
    const locations = state.locations
    const store = state.store
    const epoch = state.epoch
    if (!placement || !locations || !store || !epoch) return undefined
    if (state.cached?.placement === placement) return state.cached.host
    const current = () => state.epoch === epoch && input.identity() === placement
    const within = <A, E>(read: (port: RelayWorkflowBinding.PublicationPort) => Effect.Effect<A, E>) => Effect.gen(function* () {
      if (!current()) return yield* new RelayWorkflowBinding.Held({ reason: "SF_ROUTINE_PUBLICATION_DISPOSED" })
      const port = yield* Effect.gen(function* () {
        const location = yield* Location.Service
        if (location.project.id !== placement.projectId) return yield* new RelayWorkflowBinding.Held({ reason: "WORKFLOW_PUBLICATION_PROJECT_MISMATCH" })
        const relay = yield* Relay.Service
        const config = yield* Config.Service
        const git = yield* GitCli.Service
        const fs = yield* FSUtil.Service
        const skills = yield* SkillV2.Service
        const seats = Option.getOrElse(yield* Effect.serviceOption(MaestroSeats.Service), () => MaestroSeats.make([]))
        return yield* WorkflowRelayV2.publication(relay, { projectID: location.project.id }, { store, seats, atlas: { config, git, fs, skills } })
      }).pipe(Effect.provide(locations.get(placement.location)),
        Effect.mapError((error) => error instanceof RelayWorkflowBinding.Held ? error : new RelayWorkflowBinding.Held({ reason: "WORKFLOW_PUBLICATION_ACQUISITION" })))
      const value = yield* read(port)
      if (!current()) return yield* new RelayWorkflowBinding.Held({ reason: "SF_ROUTINE_PUBLICATION_DISPOSED" })
      return value
    })
    const authorize = async (context: TrustedDomainContext) => current() && context.binding.projectId === placement.projectId && await input.authorize(context) && current()
    const host: RoutinePublicationHost = {
      authorize,
      authorSession: async (context) => {
        if (!await authorize(context)) return undefined
        const author = input.authorSession ? await input.authorSession(context) : context.kind === "native" ? context.binding.nativeSessionId : undefined
        return await authorize(context) ? author : undefined
      },
      publication: {
        projectID: ProjectID.make(placement.projectId),
        acceptance: WorkflowRelayV2.ACCEPTANCE_CONTROLS,
        use: (read) => within((port) => port.use(read)),
        skills: (name) => within((port) => port.skills(name)).pipe(Effect.mapError((error) => error instanceof AuthoringGraph.Refusal
          ? error : new AuthoringGraph.Refusal({ status: 503, code: "skill-unavailable", message: "Native publication skill catalog unavailable" }))),
        knowledge: (reference, authorSessionID) => within((port) => port.knowledge
          ? port.knowledge(reference, authorSessionID)
          : Effect.fail(new RelayWorkflowBinding.Held({ reason: "WORKFLOW_KNOWLEDGE_RESOLVER_MISSING" }))),
      },
    }
    state.cached = { placement, host }
    return host
  }
  const contribution: Host.Contribution = { id: "sucafina-routine-publication", nodes: [node] }
  return { contribution, node, publication }
}
