import { expect } from "bun:test"
import { Context, Effect, Layer, Schema, Scope } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Session } from "@orchestra/schema/session"
import { SessionV2 } from "@orchestra/core/session"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { teamSessionFixture, profileA } from "../../../core/test/fixture/team-session"
import { applicationServices, createApiRoutesWithServices } from "../../src/routes"
import { makeInstalledSessionHttp } from "../../src/session-http"
import type { SfTrustedInstallationSource } from "../../src/sucafina-installations"

export { profileA, profileB, oid, other } from "../../../core/test/fixture/team-session"
export const basic = "Basic " + btoa("orchestra:installed-test-secret")
export const Info = Schema.Struct({ data: Session.Info, namespace: Schema.optional(TeamProfile.SessionNamespace) })
export const List = Schema.Struct({
  data: Schema.Array(Session.Info),
  namespace: Schema.optional(TeamProfile.SessionNamespace),
  cursor: Schema.Struct({ previous: Schema.optional(Schema.String), next: Schema.optional(Schema.String) }),
})
export const decode = <A>(response: Response, schema: Schema.Decoder<A>) =>
  Effect.promise(() => response.json()).pipe(Effect.map(Schema.decodeUnknownSync(Schema.toCodecJson(schema))))

type Http = Readonly<{
  mounted: (request: Request) => Promise<Response>
  generic: (request: Request) => Promise<Response>
  originals: readonly Request[]
}>

/** Actual OIDC, current policy, owner SQL and production handlers over one AppNodeBuilder graph. */
export async function teamSessionHttpFixture(
  input: Omit<NonNullable<Parameters<typeof teamSessionFixture>[0]>, "extraNodes"> = {},
  transport: { genericPassword?: string | null } = {},
) {
  const f = await teamSessionFixture({ ...input, extraNodes: [applicationServices] })
  const metadata: { mode: "ready" | "missing" | "failed"; authMode: "microsoft" | "local-operator"; locations: number } = { mode: "ready", authMode: "microsoft", locations: 0 }
  const observations: { grants: number; calls: Array<{ path: string; milliseconds: number; grants: number; graph: number }> } = { grants: 0, calls: [] }
  f.productHooks.beforeGrants = async () => { observations.grants++ }
  const source: SfTrustedInstallationSource = {
    current: async () => {
      if (metadata.mode === "failed") throw new Error("Deliberately unavailable installed metadata")
      if (metadata.mode === "missing") return undefined
      return { publicOrigin: f.binding.origin, mount: f.config.mount, authMode: metadata.authMode,
        tenantId: profileA.tenantId, identity: () => f.technical }
    },
    forAdmittedLocation: async () => { metadata.locations++; throw new Error("No metadata discovery by Location") },
  }
  const request = (suffix: string, profile: TeamProfile.Ref = profileA, cookie = f.cookie, init: RequestInit = {}) => {
    const headers = new Headers(init.headers)
    if (!headers.has("x-sf-team-profile"))
      headers.set("x-sf-team-profile", JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile }))
    if (init.method && !["GET", "HEAD"].includes(init.method) && !headers.has("origin")) headers.set("origin", f.binding.origin)
    return f.request(suffix, cookie, { ...init, headers: Object.fromEntries(headers) })
  }
  const jsonRequest = (suffix: string, body: unknown, profile: TeamProfile.Ref = profileA, cookie = f.cookie) =>
    request(suffix, profile, cookie, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  const run = <A, E>(body: (http: Http) => Effect.Effect<A, E, LayerNode.Output<typeof applicationServices> | Scope.Scope>) =>
    f.run(Effect.gen(function* () {
      const context = (yield* Effect.context<LayerNode.Output<typeof applicationServices>>()).pipe(Context.omit(Scope.Scope))
      const originals: Request[] = []
      const mounted = yield* makeInstalledSessionHttp({
        origin: f.binding.origin, mount: f.config.mount, location: () => f.location,
        readAdmission: (original) => { originals.push(original); return f.authority.readCoreSessionAdmission(original) },
      })
      const generic = yield* Effect.acquireRelease(
        Effect.sync(() => HttpRouter.toWebHandler(createApiRoutesWithServices({
          password: transport.genericPassword === null ? undefined : transport.genericPassword ?? "installed-test-secret", sucafinaInstallations: source,
        }).pipe(Layer.provide(Layer.succeedContext(context)), Layer.provide(HttpServer.layerServices)), { disableLogger: true })),
        (value) => Effect.promise(() => value.dispose()),
      )
      const observed = async (original: Request) => {
        const start = Date.now()
        const grants = observations.grants
        const graph = f.provider.requests.length
        try { return await mounted(original) }
        finally { observations.calls.push({ path: new URL(original.url).pathname, milliseconds: Date.now() - start,
          grants: observations.grants - grants, graph: f.provider.requests.length - graph }) }
      }
      return yield* body({ mounted: observed, generic: generic.handler, originals }).pipe(
        Effect.tapCause(() => Effect.sync(() => console.info("Installed Session HTTP observations", observations.calls))),
      )
    }))
  const create = (http: Http, id: string, profile: TeamProfile.Ref = profileA, cookie = f.cookie) =>
    Effect.gen(function* () {
      const response = yield* Effect.promise(() => http.mounted(jsonRequest("/api/session", { id }, profile, cookie)))
      expect(response.status).toBe(200)
      return (yield* decode(response, Info)).data
    })
  /** Prepare actual owned SQL through Core; HTTP tests still exercise their requested route boundaries. */
  const seed = (id: string, profile: TeamProfile.Ref = profileA, cookie = f.cookie) => Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    return yield* f.admitted(f.businessRequest(profile, cookie), sessions.create({ id: Session.ID.make(id), location: f.location }))
  })
  return { ...f, metadata, observations, rawRequest: f.request, request, jsonRequest, run, create, seed }
}
