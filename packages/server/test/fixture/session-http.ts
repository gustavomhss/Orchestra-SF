import { expect } from "bun:test"
import { Effect, Schema, Scope } from "effect"
import { ClaudeCodeAccount } from "@orchestra/core/claude-code-account"
import { MoveSession } from "@orchestra/core/control-plane/move-session"
import { Database } from "@orchestra/core/database/database"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { EventV2 } from "@orchestra/core/event"
import { FSUtil } from "@orchestra/core/fs-util"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import { AppProcess } from "@orchestra/core/process"
import { SessionV2 } from "@orchestra/core/session"
import { SessionProcess } from "@orchestra/core/session-process"
import { SessionOwner } from "@orchestra/core/session/owner"
import { SessionSubagentModels } from "@orchestra/core/session/subagent-models"
import { TaskBackground } from "@orchestra/core/tool/task-background"
import { Session } from "@orchestra/schema/session"
import { SessionAccess } from "@orchestra/schema/session-access"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { ownerA, sessionOwnerFixture } from "../../../core/test/fixture/session-owner"
import { makeInstalledSessionHttp } from "../../src/session-http"

export { barrier, ownerA, ownerB, ownerPerson, profileA, profileB } from "../../../core/test/fixture/session-owner"
export const Info = Schema.Struct({ data: Session.Info })
export const List = Schema.Struct({
  data: Schema.Array(Session.Info),
  namespace: Schema.optional(TeamProfile.SessionNamespace),
  cursor: Schema.Struct({ previous: Schema.optional(Schema.String), next: Schema.optional(Schema.String) }),
})
export const decode = <A>(response: Response, schema: Schema.Decoder<A>) =>
  Effect.promise(() => response.json()).pipe(Effect.map(Schema.decodeUnknownSync(Schema.toCodecJson(schema))))

const runtimeServices = LayerNode.group([
  Database.node, EventV2.node, LocationServiceMap.node, ClaudeCodeAccount.node, SessionV2.node, SessionOwner.node,
  SessionSubagentModels.node, SessionProcess.node, AppProcess.node, FSUtil.node, MoveSession.node, TaskBackground.node,
])
type Services = LayerNode.Output<typeof runtimeServices>
type Http = Readonly<{
  origin: string
  mount: string
  request: (suffix: string, owner?: TeamProfile.Owner, init?: RequestInit) => Request
  json: (suffix: string, body: unknown, owner?: TeamProfile.Owner) => Request
  raw: (suffix: string, init?: RequestInit) => Request
  mounted: (request: Request) => Promise<Response>
  direct: (request: Request) => Promise<Response>
  originals: readonly Request[]
  received: readonly Request[]
}>

/**
 * Controlled private admission producer; this fixture proves no Microsoft authentication, product grant or Case ACL.
 * The HTTP adapter, loopback server, SQLite ownership/generation/fences and SSE are real. A one-use test correlation
 * token transports only the fixture's private selection to the server's original Request; it is not a product credential.
 * Project resolution and model execution are the recording ports declared by the reused Core component fixture.
 */
export async function sessionHttpFixture(input: { actions?: readonly SessionAccess.Action[] } = {}) {
  const core = await sessionOwnerFixture({ actions: input.actions, extraNodes: [runtimeServices] })
  const key = (owner: TeamProfile.Owner) => JSON.stringify([owner.profile.installationId, owner.profile.tenantId,
    owner.profile.teamObjectId, owner.principal.tenantId, owner.principal.principalObjectId])
  const revoked = new Set<string>()
  const excluded = new Map<string, readonly Session.ID[]>()
  const actions = new Set(input.actions ?? SessionAccess.Actions)
  const producer: { state: "ready" | "missing"; revision: number } = { state: "ready", revision: 0 }
  const run = <A, E>(body: (http: Http) => Effect.Effect<A, E, Services | Scope.Scope>) =>
    core.run(Effect.gen(function* () {
      const selected = new WeakMap<Request, TeamProfile.Owner>()
      const pending = new Map<string, TeamProfile.Owner>()
      const originals: Request[] = []
      const received: Request[] = []
      const route: { handle?: (request: Request) => Promise<Response> } = {}
      const server = yield* Effect.acquireRelease(
        Effect.sync(() => Bun.serve({
          hostname: "127.0.0.1", port: 0,
          fetch(original) {
            received.push(original)
            const token = original.headers.get("x-test-private-admission")
            const owner = token ? pending.get(token) : undefined
            if (token) pending.delete(token)
            if (owner) selected.set(original, owner)
            return route.handle?.(original) ?? new Response(null, { status: 503 })
          },
        })),
        (server) => Effect.promise(() => server.stop(true)),
      )
      const origin = server.url.origin
      const mount = "/installed-component"
      const handler = yield* makeInstalledSessionHttp({
        origin, mount, location: () => core.location,
        readAdmission: async (original): Promise<SessionOwner.Admission | undefined> => {
          originals.push(original)
          const owner = selected.get(original)
          if (!owner || producer.state !== "ready") return undefined
          const revision = producer.revision
          const valid = () => !original.signal.aborted && producer.state === "ready" &&
            producer.revision === revision && !revoked.has(key(owner))
          const exclusions = () => excluded.get(key(owner)) ?? []
          return {
            binding: { owner, revisions: { configRevision: "http:" + revision, accessRevision: "controlled-http-component" } },
            verifyCurrent: () => Effect.sync(valid),
            authorize: (action, id) => Effect.sync(() => valid() && actions.has(action) && (!id || !exclusions().includes(id))),
            excludedSessions: () => Effect.sync(() => [...exclusions()]),
          }
        },
      })
      route.handle = handler
      const raw = (suffix: string, init: RequestInit = {}) => new Request(origin + mount + suffix, init)
      const request = (suffix: string, owner: TeamProfile.Owner = ownerA, init: RequestInit = {}) => {
        const headers = new Headers(init.headers)
        if (init.method && !["GET", "HEAD"].includes(init.method) && !headers.has("origin")) headers.set("origin", origin)
        const original = raw(suffix, { ...init, headers })
        selected.set(original, Schema.decodeUnknownSync(TeamProfile.Owner)(owner))
        return original
      }
      const json = (suffix: string, value: unknown, owner: TeamProfile.Owner = ownerA) =>
        request(suffix, owner, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value) })
      const mounted = async (original: Request) => {
        const owner = selected.get(original)
        const token = crypto.randomUUID()
        const headers = new Headers(original.headers)
        headers.delete("x-test-private-admission")
        if (owner) { pending.set(token, owner); headers.set("x-test-private-admission", token) }
        try { return await fetch(new Request(original, { headers })) }
        finally { pending.delete(token) }
      }
      return yield* body({ origin, mount, raw, request, json, mounted, direct: handler, originals, received })
    }))
  const create = (http: Http, id: string, owner: TeamProfile.Owner = ownerA) => Effect.gen(function* () {
    const response = yield* Effect.promise(() => http.mounted(http.json("/api/session", { id }, owner)))
    expect(response.status).toBe(200)
    return (yield* decode(response, Info)).data
  })
  const seed = (id: string, owner: TeamProfile.Owner = ownerA) => Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    return yield* core.admitted(owner, sessions.create({ id: Session.ID.make(id), location: core.location }))
  })
  return {
    ...core, run, create, seed, producer,
    revoke: (owner: TeamProfile.Owner = ownerA) => { revoked.add(key(owner)); core.revoke(owner) },
    exclude: (owner: TeamProfile.Owner, ids: readonly Session.ID[]) => { excluded.set(key(owner), ids); core.exclude(owner, ids) },
  }
}
