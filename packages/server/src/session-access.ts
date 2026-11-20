import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { Location } from "@orchestra/core/location"
import { SessionOwner } from "@orchestra/core/session/owner"
import { AuthorityGeneration } from "@orchestra/core/session/authority-generation"
import { Session } from "@orchestra/schema/session"
import type { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { InvalidCursorError, UnauthorizedError } from "@orchestra/protocol/errors"
import { Context, Effect, Schema } from "effect"
import { HttpRouter } from "effect/unstable/http"

/** Private request context. A forged Scope is still rejected by SessionOwner's WeakMap. */
export type InstalledSessionContext = Readonly<{
  scope: SessionOwner.Scope
  binding: TeamProfile.Binding
  location: Location.Ref
}>
export const InstalledSession = Context.Reference<InstalledSessionContext | undefined>(
  "@orchestra/server/InstalledSession", { defaultValue: () => undefined },
)

const actions: Readonly<Record<string, SessionOwner.Operation>> = {
  "session.list": "read", "session.active": "read", "session.get": "read",
  "session.messages": "read", "session.message": "read", "session.history": "read",
  "session.events": "read", "session.context": "read", "session.todo": "read",
  "session.wait": "read", "session.processes": "read", "session.message.diff": "read",
  "session.getPermission": "read", "session.getSubagentModels": "read", "event.subscribe": "read",
  "session.create": "create", "session.fork": "fork", "session.move": "move",
  "session.archive": "write", "session.rename": "write", "session.remove": "write",
  "session.revert.stage": "write", "session.revert.clear": "write", "session.revert.commit": "write",
  "session.prompt": "prompt", "session.synthetic": "prompt", "session.command": "prompt",
  "session.background": "run", "session.compact": "run", "session.shell": "run",
  "session.skill": "run", "session.generate": "run",
  "session.switchAgent": "model", "session.switchModel": "model",
  "session.setPermission": "model", "session.setSubagentModels": "model",
  "session.interrupt": "control", "session.processStop": "control",
}

export const unauthorized = () => new UnauthorizedError({ message: "Current session authority required" })

/** The endpoint's closed operation map is checked before its payload or Location is read. */
export const openSessionAccess = (owners: SessionOwner.Interface, endpoint: string, sessionID?: Session.ID) =>
  Effect.gen(function* () {
    const action = actions[endpoint]
    if (!action) return yield* unauthorized()
    const scope = yield* owners.open().pipe(Effect.mapError(unauthorized))
    yield* (sessionID ? owners.assert(scope, sessionID, action) : owners.authorize(scope, action))
      .pipe(Effect.mapError(unauthorized))
    // A command can execute immediately and may change its model after rendering.
    if (endpoint === "session.command")
      yield* owners.authorize(scope, "run", sessionID).pipe(Effect.mapError(unauthorized))
    return scope
  })

export const verifySessionAccess = (owners: SessionOwner.Interface, scope: SessionOwner.Scope,
  endpoint: string, sessionID?: Session.ID) => Effect.gen(function* () {
  const action = actions[endpoint]
  if (!action) return yield* unauthorized()
  yield* (sessionID ? owners.assert(scope, sessionID, action) : owners.authorize(scope, action))
    .pipe(Effect.mapError(unauthorized))
})

const sessionFailure = (error: unknown) => error instanceof SessionOwner.Denied || error instanceof AuthorityGeneration.GenerationError
const sessionErrors = <A, E, R>(effect: Effect.Effect<A, E, R>) => effect.pipe(
  Effect.catchIf(sessionFailure, () => unauthorized()),
  Effect.catchDefect((error) => sessionFailure(error) ? unauthorized() : Effect.die(error)),
)

/** Wrap the selected HTTP groups before schema decoding, including the generic host transport. */
export const guardSessionEndpoint = <A, E, R>(owners: SessionOwner.Interface, group: string,
  endpoint: string, effect: Effect.Effect<A, E, R>) => Effect.gen(function* () {
  if (!["server.session", "server.message", "server.event", "server.reference"].includes(group))
    return yield* effect
  if (group === "server.reference") {
    const scope = yield* owners.open().pipe(Effect.mapError(unauthorized))
    // Config/Location references have no installed source ACL producer yet.
    // A session-list grant cannot authorize their materialization.
    if (owners.owner(scope)) return yield* unauthorized()
    const value = yield* sessionErrors(effect)
    yield* owners.verify(scope).pipe(Effect.mapError(unauthorized))
    return value
  }
  const route = yield* HttpRouter.RouteContext
  const raw = route.params.sessionID
  const sessionID = raw === undefined ? undefined : Schema.decodeUnknownOption(Session.ID)(raw).valueOrUndefined
  if (raw !== undefined && !sessionID) return yield* unauthorized()
  const scope = yield* openSessionAccess(owners, endpoint, sessionID)
  const value = yield* sessionErrors(effect)
  yield* verifySessionAccess(owners, scope, endpoint, sessionID)
  return value
})

/** Restrict installed creation/move to server-owned technical placement. It supplies no authority. */
export const sessionPlacement = (requested: Location.Ref | undefined) => Effect.gen(function* () {
  const installed = yield* InstalledSession
  if (!installed) return requested
  if (requested && (requested.directory !== installed.location.directory ||
    requested.workspaceID !== installed.location.workspaceID)) return yield* unauthorized()
  return installed.location
})

// Corporate cursors are opaque capabilities for pagination only. The private MAC
// prevents retargeting or splicing; all data reads still require current admission.
const cursorSecret = randomBytes(32)
const Cursor = Schema.Tuple([Schema.Literal(1), Schema.String, Schema.String, Schema.String])
const decodeCursor = Schema.decodeUnknownSync(Schema.fromJsonString(Cursor))
const cursorScope = (installed: InstalledSessionContext, generation: number) =>
  createHash("sha256").update(JSON.stringify([
    installed.binding.owner.profile.installationId, installed.binding.owner.profile.tenantId,
    installed.binding.owner.profile.teamObjectId, installed.binding.owner.principal.tenantId,
    installed.binding.owner.principal.principalObjectId, installed.binding.revisions.configRevision,
    installed.binding.revisions.accessRevision, generation,
  ])).digest("base64url")

export const protectSessionCursor = (owners: SessionOwner.Interface, purpose: string, value: string) =>
  Effect.gen(function* () {
    const installed = yield* InstalledSession
    if (!installed) return value
    yield* owners.verify(installed.scope).pipe(Effect.mapError(unauthorized))
    const generation = owners.generation(installed.scope)
    if (generation === undefined) return yield* unauthorized()
    const payload = Buffer.from(JSON.stringify([1, cursorScope(installed, generation), purpose, value])).toString("base64url")
    const mac = createHmac("sha256", cursorSecret).update(payload).digest("base64url")
    return "sf1." + payload + "." + mac
  })

export const readSessionCursor = (owners: SessionOwner.Interface, purpose: string, value: string) =>
  Effect.gen(function* () {
    const installed = yield* InstalledSession
    if (!installed) {
      if (value.startsWith("sf1.")) return yield* new InvalidCursorError({ message: "Invalid cursor" })
      return value
    }
    yield* owners.verify(installed.scope).pipe(Effect.mapError(unauthorized))
    const generation = owners.generation(installed.scope)
    if (generation === undefined) return yield* unauthorized()
    return yield* Effect.try({
      try: () => {
        if (value.length > 32768) throw new Error("Cursor too large")
        const parts = value.split(".")
        if (parts.length !== 3 || parts[0] !== "sf1" || !/^[A-Za-z0-9_-]+$/.test(parts[1]!) ||
          !/^[A-Za-z0-9_-]{43}$/.test(parts[2]!)) throw new Error("Invalid cursor")
        const expected = createHmac("sha256", cursorSecret).update(parts[1]!).digest()
        const actual = Buffer.from(parts[2]!, "base64url")
        if (actual.toString("base64url") !== parts[2] || actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("Invalid cursor")
        const tuple = decodeCursor(Buffer.from(parts[1]!, "base64url").toString("utf8"))
        if (tuple[1] !== cursorScope(installed, generation) || tuple[2] !== purpose) throw new Error("Foreign cursor")
        return tuple[3]
      },
      catch: () => new InvalidCursorError({ message: "Invalid cursor" }),
    })
  })
