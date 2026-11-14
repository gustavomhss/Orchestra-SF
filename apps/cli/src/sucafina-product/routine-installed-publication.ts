import path from "node:path"
import { makeGlobalNode } from "@orchestra/core/effect/app-node"
import type { Host } from "@orchestra/core/host"
import { Location } from "@orchestra/core/location"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import { Relay } from "@orchestra/core/relay"
import { RelayWorkflowBinding } from "@orchestra/core/relay-workflow-binding"
import { SessionSchema } from "@orchestra/core/session/schema"
import { SessionStore } from "@orchestra/core/session/store"
import { SkillV2 } from "@orchestra/core/skill"
import { ProjectID } from "@orchestra/schema/project-id"
import { AuthoringGraph } from "@orchestra/relay/authoring/graph"
import { AuthoringStore } from "@orchestra/relay/authoring/store"
import { Context, Effect, Layer, Schema } from "effect"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { DomainPortHost } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { RoutinePublicationHost } from "../../../../modules/sucafina/Sucafinav1/product/routines/publication.ts"

type Placement = Readonly<{ installationId: string; hostId: string; projectId: string; location: Location.Ref }>
type Runtime = { locations: Context.Service.Shape<typeof LocationServiceMap.Service>; sessions: SessionStore.Interface }
type Located = { relay: Relay.Interface; skills: SkillV2.Interface; location: Location.Interface; digest: string }

const acceptance = Object.freeze([
  Object.freeze({ id: "package-verification", host_check: "package-verification" } as const),
  Object.freeze({ id: "cold-review", host_check: "cold-review" } as const),
])

/** Installs only the public, read-only publication boundary. Task admission remains a separate native port. */
export function createSfInstalledRoutinePublication(input: {
  identity: () => Placement | undefined
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
}) {
  const state: { runtime?: Runtime; cached?: { placement: Placement; provider: RoutinePublicationHost } } = {}
  const node = makeGlobalNode({
    name: "sucafina/routines/installed-publication",
    deps: [LocationServiceMap.node, SessionStore.node],
    layer: Layer.effectDiscard(Effect.gen(function* () {
      const runtime = { locations: yield* LocationServiceMap.Service, sessions: yield* SessionStore.Service }
      state.runtime = runtime
      state.cached = undefined
      yield* Effect.addFinalizer(() => Effect.sync(() => {
        if (state.runtime !== runtime) return
        state.runtime = undefined
        state.cached = undefined
      }))
    })),
  })
  const publication = (): RoutinePublicationHost | undefined => {
    const placement = input.identity(), runtime = state.runtime
    if (!placement || !runtime || !Schema.is(ProjectID)(placement.projectId)) return undefined
    if (state.cached?.placement === placement) return state.cached.provider
    const projectID = ProjectID.make(placement.projectId)
    const placementDigest = digestSfValue(placement)
    const current = () => state.runtime === runtime && input.identity() === placement &&
      state.cached?.provider === provider && digestSfValue(placement) === placementDigest
    const acquire = (): Effect.Effect<Located, RelayWorkflowBinding.Held> => Effect.gen(function* () {
      if (!current()) return yield* held("SF_ROUTINE_PUBLICATION_UNAVAILABLE")
      const located = yield* Effect.gen(function* () {
        const location = yield* Location.Service
        const relay = yield* Relay.Service
        const skills = yield* SkillV2.Service
        if (location.project.id !== projectID || location.directory !== placement.location.directory ||
          location.workspaceID !== placement.location.workspaceID || !path.isAbsolute(relay.paths.root) ||
          path.resolve(relay.paths.root) !== relay.paths.root || path.basename(relay.paths.root) !== projectID ||
          relay.paths.authoring !== path.join(relay.paths.root, "authoring.sqlite3")) return yield* held("SF_ROUTINE_PUBLICATION_PROJECT_MISMATCH")
        return { relay, skills, location, digest: digestSfValue({ projectID, location: {
          directory: location.directory, workspaceID: location.workspaceID, project: location.project,
        }, root: relay.paths.root, authoring: relay.paths.authoring }) }
      }).pipe(Effect.provide(runtime.locations.get(placement.location)),
        Effect.mapError((error) => error instanceof RelayWorkflowBinding.Held ? error : held("SF_ROUTINE_PUBLICATION_LOCATION_UNAVAILABLE")))
      if (!current()) return yield* held("SF_ROUTINE_PUBLICATION_REPLACED")
      return located
    }).pipe(Effect.catchDefect(() => Effect.fail(held("SF_ROUTINE_PUBLICATION_LOCATION_UNAVAILABLE"))))
    const within = <A, E>(read: (located: Located) => Effect.Effect<A, E>): Effect.Effect<A, E | RelayWorkflowBinding.Held> => Effect.gen(function* () {
      const before = yield* acquire()
      const result = yield* read(before)
      const after = yield* acquire()
      if (after.relay !== before.relay || after.skills !== before.skills || after.location !== before.location ||
        after.digest !== before.digest || !current()) return yield* held("SF_ROUTINE_PUBLICATION_REPLACED")
      return result
    })
    const authorize = async (context: TrustedDomainContext) => {
      const request = input.host.requestFor(context)
      const binding = digestSfValue([context.kind, context.binding])
      const active = () => current() && !!request && !request.signal.aborted && input.host.requestFor(context) === request &&
        digestSfValue([context.kind, context.binding]) === binding && context.binding.installationId === placement.installationId &&
        context.binding.projectId === projectID && (context.kind === "ui" || context.binding.hostId === placement.hostId &&
          context.binding.locationId === digestSfValue(placement.location))
      try {
        if (!active() || !await input.host.revalidate(context) || !active()) return false
        const located = await Effect.runPromise(Effect.result(acquire()))
        return located._tag === "Success" && active() && await input.host.revalidate(context) && active()
      } catch { return false }
    }
    const provider: RoutinePublicationHost = Object.freeze({
      authorize,
      authorSession: async (context: TrustedDomainContext) => {
        // UI authority deliberately carries no Session. Never take a session id from a URL, payload or model.
        if (context.kind !== "native" || !await authorize(context)) return undefined
        const id = SessionSchema.ID.make(context.binding.nativeSessionId)
        const request = input.host.requestFor(context)
        const binding = digestSfValue([context.kind, context.binding])
        const read = () => Effect.runPromise(runtime.sessions.get(id)).catch(() => undefined)
        const before = await read()
        if (!before || before.id !== id || before.projectID !== projectID || before.agent !== context.binding.profileId ||
          digestSfValue(before.location) !== digestSfValue(placement.location) || before.time.archived !== undefined ||
          !request || !await authorize(context)) return undefined
        const after = await read()
        if (!after || digestSfValue(sessionIdentity(after)) !== digestSfValue(sessionIdentity(before)) ||
          input.host.requestFor(context) !== request || request.signal.aborted ||
          digestSfValue([context.kind, context.binding]) !== binding || !await authorize(context)) return undefined
        return id
      },
      publication: Object.freeze({
        projectID,
        acceptance,
        use: <A, E>(read: (store: Pick<AuthoringStore.Interface, "get" | "version" | "documents">) => Effect.Effect<A, E>) =>
          within((located) => Effect.scoped(Effect.gen(function* () {
            const store = yield* AuthoringStore.open(located.relay.paths.root, projectID)
            // The engine owns schema/lifetime. No publication, admission, arm or ledger writer escapes this adapter.
            return yield* read({ get: store.get, version: store.version, documents: store.documents })
          }))).pipe(Effect.catchDefect(() => Effect.fail(held("SF_ROUTINE_PUBLICATION_STORE_UNAVAILABLE")))),
        skills: (name: string) => within((located) => Effect.gen(function* () {
          const first = yield* located.skills.get(name)
          if (!first || first.name !== name || !first.content.trim() || first.content.includes("\0") ||
            Buffer.byteLength(first.content, "utf8") > 2 * 1024 * 1024) return yield* new AuthoringGraph.Refusal({
            status: 404, code: "skill-unavailable", message: "Published workflow skill unavailable in the authenticated Location",
          })
          const captured = { id: first.name, content: first.content, sha256: RelayWorkflowBinding.digest(Buffer.from(first.content, "utf8")) }
          const identity = digestSfValue(first)
          const again = yield* located.skills.get(name)
          if (!again || digestSfValue(again) !== identity) return yield* new AuthoringGraph.Refusal({
            status: 409, code: "skill-changed", message: "Published workflow skill changed while being read",
          })
          return captured
        })).pipe(Effect.mapError((error) => error instanceof AuthoringGraph.Refusal ? error : new AuthoringGraph.Refusal({
          status: 503, code: "skill-unavailable", message: "Authenticated publication skill catalog unavailable",
        })), Effect.catchDefect(() => Effect.fail(new AuthoringGraph.Refusal({
          status: 503, code: "skill-unavailable", message: "Authenticated publication skill catalog unavailable",
        })))),
        // The authenticated Archie anchor resolver is not exported by the native owner.
        // A schema/digest, a Session id or a stored model response cannot replace that proof.
        knowledge: () => within(() => Effect.fail(held("SF_ROUTINE_KNOWLEDGE_PORT_UNAVAILABLE"))),
      }),
    })
    state.cached = { placement, provider }
    return provider
  }
  const contribution: Host.Contribution = { id: "sucafina-routine-installed-publication", nodes: [node] }
  return { contribution, node, publication }
}

function held(reason: string) {
  return new RelayWorkflowBinding.Held({ reason })
}

function sessionIdentity(value: SessionSchema.Info) {
  return { id: value.id, parentID: value.parentID, projectID: value.projectID, agent: value.agent,
    location: value.location, model: value.model, archived: value.time.archived }
}
