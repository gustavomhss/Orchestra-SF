import { makeGlobalNode } from "@orchestra/core/effect/app-node"
import type { Host } from "@orchestra/core/host"
import type { Location } from "@orchestra/core/location"
import { RelayWorkflowBinding } from "@orchestra/core/relay-workflow-binding"
import { AuthoringGraph } from "@orchestra/relay/authoring/graph"
import { Effect, Layer } from "effect"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { RoutinePublicationHost } from "../../../../modules/sucafina/Sucafinav1/product/routines/publication.ts"

type Placement = Readonly<{ projectId: string; location: Location.Ref }>

/** Keeps an installed public publication port inside the current product host lifetime. */
export function createSfRoutinePublicationContribution(input: {
  identity: () => Placement | undefined
  authorize: (context: TrustedDomainContext) => Promise<boolean>
  authorSession?: RoutinePublicationHost["authorSession"]
  installed?: () => RoutinePublicationHost | undefined
}) {
  const state: { epoch?: object; cached?: { placement: Placement; provider: RoutinePublicationHost; host: RoutinePublicationHost } } = {}
  const node = makeGlobalNode({
    name: "sucafina/routines/publication",
    deps: [],
    layer: Layer.effectDiscard(Effect.gen(function* () {
      const epoch = {}
      state.epoch = epoch
      state.cached = undefined
      yield* Effect.addFinalizer(() => Effect.sync(() => {
        if (state.epoch !== epoch) return
        state.epoch = undefined
        state.cached = undefined
      }))
    })),
  })
  const publication = (): RoutinePublicationHost | undefined => {
    const placement = input.identity()
    const provider = input.installed?.()
    const epoch = state.epoch
    if (!placement || !provider || !epoch || provider.publication.projectID !== placement.projectId) return undefined
    if (state.cached?.placement === placement && state.cached.provider === provider) return state.cached.host
    const placementDigest = digestSfValue(placement), port = provider.publication
    const current = () => state.epoch === epoch && input.identity() === placement && input.installed?.() === provider &&
      provider.publication === port && port.projectID === placement.projectId && digestSfValue(placement) === placementDigest
    const within = <A, E>(read: (port: RelayWorkflowBinding.PublicationPort) => Effect.Effect<A, E>) => Effect.gen(function* () {
      if (!current()) return yield* new RelayWorkflowBinding.Held({ reason: "SF_ROUTINE_PUBLICATION_UNAVAILABLE" })
      const value = yield* read(port)
      if (!current()) return yield* new RelayWorkflowBinding.Held({ reason: "SF_ROUTINE_PUBLICATION_REPLACED" })
      return value
    })
    const authorize = async (context: TrustedDomainContext) => current() && context.binding.projectId === placement.projectId &&
      await input.authorize(context) && await provider.authorize(context) && current()
    const host: RoutinePublicationHost = {
      authorize,
      authorSession: async (context) => {
        if (!await authorize(context)) return undefined
        const author = input.authorSession ? await input.authorSession(context) : await provider.authorSession(context)
        return await authorize(context) ? author : undefined
      },
      publication: {
        projectID: provider.publication.projectID,
        acceptance: provider.publication.acceptance,
        use: (read) => within((port) => port.use(read)),
        skills: (name) => within((port) => port.skills(name)).pipe(Effect.mapError((error) => error instanceof AuthoringGraph.Refusal
          ? error : new AuthoringGraph.Refusal({ status: 503, code: "skill-unavailable", message: "Native publication skill catalog unavailable" }))),
        knowledge: (reference, authorSessionID) => within((port) => port.knowledge
          ? port.knowledge(reference, authorSessionID)
          : Effect.fail(new RelayWorkflowBinding.Held({ reason: "WORKFLOW_KNOWLEDGE_RESOLVER_MISSING" }))),
      },
    }
    state.cached = { placement, provider, host }
    return host
  }
  const contribution: Host.Contribution = { id: "sucafina-routine-publication", nodes: [node] }
  return { contribution, node, publication }
}
