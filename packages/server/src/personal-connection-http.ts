import type { Host } from "@orchestra/core/host"
import { SessionOwner } from "@orchestra/core/session/owner"
import { CredentialVault } from "@orchestra/core/credential/vault"
import { ConnectionAccess } from "@orchestra/schema/connection-access"
import { Credential } from "@orchestra/schema/credential"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { Context, Effect, Schema, Scope } from "effect"
import { readPersonalConnectionCommand } from "./personal-connection-body"

type Options = Readonly<{
  origin: string
  mount: string
  readAdmission: (original: Request) => Promise<SessionOwner.Admission | undefined>
}>
type Result = ConnectionAccess.PersonalMetadataResult | ConnectionAccess.PersonalCommandResult
const response = (value: Result, status: number, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(value), { status, headers: {
    "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
    "x-content-type-options": "nosniff", ...extra,
  } })
const sameKey = (left: ConnectionAccess.Key, right: ConnectionAccess.Key) =>
  left.category === right.category && left.resourceId === right.resourceId && left.id === right.id

export const isInstalledPersonalConnectionPath = (pathname: string, mount: string) =>
  pathname === mount + "/api/connection/personal"

/** Private installation adapter. The original Microsoft Request is the sole admission source. */
export const makeInstalledPersonalConnectionHttp = (options: Options) => Effect.gen(function* () {
  if (!URL.canParse(options.origin) || new URL(options.origin).origin !== options.origin ||
      new URL(options.origin).protocol !== "https:" ||
      !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(options.mount))
    throw new Error("Invalid installed personal connection HTTP binding")
  const services = (yield* Effect.context<Host.RuntimeServices>()).pipe(Context.omit(Scope.Scope))
  const owners = yield* SessionOwner.Service
  const origin = options.origin
  const mount = options.mount
  const readAdmission = options.readAdmission
  return async (original: Request): Promise<Response> => {
    const url = new URL(original.url)
    const host = original.headers.get("host")
    if (!isInstalledPersonalConnectionPath(url.pathname, mount)) return response({ status: "invalid-request" }, 404)
    if (url.origin !== origin || host !== null && host.toLowerCase() !== new URL(origin).host.toLowerCase() ||
        original.headers.has("authorization") || original.headers.get("sec-fetch-site") === "cross-site" ||
        original.headers.has("origin") && original.headers.get("origin") !== origin ||
        original.method === "POST" && original.headers.get("origin") !== origin || original.signal.aborted)
      return response({ status: "denied" }, 403)
    if (original.method !== "GET" && original.method !== "POST")
      return response({ status: "invalid-request" }, 405, { allow: "GET, POST" })
    const entries = [...url.searchParams]
    if (url.hash || url.href.length > 8192 || original.method === "POST" && entries.length !== 0 ||
        original.method === "GET" && (entries.length !== 3 || new Set(entries.map(([key]) => key)).size !== 3 ||
          entries.some(([key]) => !["category", "resourceId", "id"].includes(key))))
      return response({ status: "invalid-request" }, 400)
    const key = original.method === "GET"
      ? Schema.decodeUnknownOption(ConnectionAccess.PersonalKey)(Object.fromEntries(entries)).valueOrUndefined
      : undefined
    if (original.method === "GET" && !key) return response({ status: "invalid-request" }, 400)
    const state = { submitted: false }
    const effect = Effect.gen(function* () {
      const lease = yield* owners.capture(() => Effect.promise(() => readAdmission(original)))
      if (!lease || original.signal.aborted) return response({ status: "denied" }, 403)
      return yield* SessionOwner.withLease(lease, Effect.gen(function* () {
        const scope = yield* owners.open()
        const vault = yield* owners.connections(scope)
        if (!vault) return response({ status: "unavailable" }, 503)
        const namespace = () => Effect.gen(function* () {
          yield* owners.verify(scope)
          if (original.signal.aborted) return undefined
          return Schema.decodeUnknownOption(TeamProfile.SessionNamespace)({
            version: 1, owner: owners.owner(scope), authorityGeneration: owners.generation(scope),
          }).valueOrUndefined
        })
        if (key) {
          const metadata = yield* vault.inspect(key)
          if (metadata && (!Schema.is(ConnectionAccess.Metadata)(metadata) || !sameKey(metadata.key, key)))
            return response({ status: "unavailable" }, 503)
          const current = yield* namespace()
          if (!current) return response({ status: "unavailable" }, 503)
          return response({ status: "available", namespace: current,
            connection: metadata ?? { key, label: "", revision: 0, state: "absent" } }, 200)
        }
        const body = yield* Effect.promise(() => readPersonalConnectionCommand(original))
        if (body.status !== "parsed") return response({ status: "invalid-request" }, body.status)
        const command = Schema.decodeUnknownOption(ConnectionAccess.PersonalCommand)(body.value).valueOrUndefined
        if (!command) return response({ status: "invalid-request" }, 400)
        yield* vault.check(command.action, command.key)
        if (original.signal.aborted) return response({ status: "denied" }, 403)
        // Every adapter rechecks current ACL and generation at the locked storage boundary.
        // A failure after submission is ambiguous; it never authorizes an automatic retry.
        state.submitted = true
        const metadata = command.action === "remove"
          ? yield* Effect.gen(function* () {
              yield* vault.remove({ key: command.key, expectedRevision: command.expectedRevision })
              return yield* vault.inspect(command.key)
            })
          : (yield* vault.write({
              key: command.key, action: command.action, label: command.label, expectedRevision: command.expectedRevision,
              encodedValue: JSON.stringify(Credential.Key.make({ type: "key", key: command.secret })),
            })).metadata
        const expectedState = command.action === "remove" ? "removed" : "active"
        if (!metadata || !Schema.is(ConnectionAccess.Metadata)(metadata) || !sameKey(metadata.key, command.key) ||
            metadata.state !== expectedState || command.action === "remove" &&
            metadata.revision !== command.expectedRevision && metadata.revision !== command.expectedRevision + 1)
          return response({ status: "unavailable" }, 503)
        const current = yield* namespace()
        if (!current) return response({ status: "unavailable" }, 503)
        return response({ status: command.action === "remove" ? "removed" : "saved", namespace: current,
          connection: metadata }, 200)
      }))
    }).pipe(
      Effect.catchIf((error) => error instanceof CredentialVault.Denied, (error) =>
        Effect.succeed(error.reason === "conflict" ? response({ status: "conflict" }, 409) :
          error.reason === "forbidden" && !state.submitted ? response({ status: "denied" }, 403) :
          response({ status: "unavailable" }, 503))),
      Effect.catchIf((error) => error instanceof SessionOwner.Denied, () =>
        Effect.succeed(response({ status: state.submitted ? "unavailable" : "denied" }, state.submitted ? 503 : 403))),
      Effect.catchCause(() => Effect.succeed(response({ status: "unavailable" }, 503))),
    )
    return Effect.runPromiseWith(services)(effect)
  }
})
