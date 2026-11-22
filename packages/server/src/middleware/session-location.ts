import { Database } from "@orchestra/core/database/database"
import { LocationServiceMap } from "@orchestra/core/location-services"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionV2 } from "@orchestra/core/session"
import { SessionOwner } from "@orchestra/core/session/owner"
import { openSessionAccess, verifySessionAccess } from "../session-access"
import { SessionTable } from "@orchestra/core/session/sql"
import { WorkspaceV2 } from "@orchestra/core/workspace"
import { eq } from "drizzle-orm"
import { Effect, Layer, Schema } from "effect"
import { HttpRouter } from "effect/unstable/http"
import { HttpApiMiddleware } from "effect/unstable/httpapi"
import { InvalidRequestError, SessionNotFoundError, UnauthorizedError } from "@orchestra/protocol/errors"
import { bootLocation, type LocationServices } from "../location"

export class SessionLocationMiddleware extends HttpApiMiddleware.Service<
  SessionLocationMiddleware,
  { provides: LocationServices }
>()("@orchestra/HttpApiSessionLocation", {
  error: [InvalidRequestError, SessionNotFoundError, UnauthorizedError],
}) {}

const decodeSessionID = Schema.decodeUnknownEffect(SessionV2.ID)

export const sessionLocationLayer = Layer.effect(
  SessionLocationMiddleware,
  Effect.gen(function* () {
    const { db } = yield* Database.Service
    const locations = yield* LocationServiceMap.Service
    const owners = yield* SessionOwner.Service

    return SessionLocationMiddleware.of((effect, options) =>
      Effect.gen(function* () {
        const route = yield* HttpRouter.RouteContext
        const sessionID = yield* decodeSessionID(route.params.sessionID).pipe(
          Effect.mapError(
            () =>
              new InvalidRequestError({
                message: "Invalid session ID",
                field: "sessionID",
              }),
          ),
        )
        const scope = yield* openSessionAccess(owners, options.endpoint.name, sessionID)
        const row = yield* db
          .select({ directory: SessionTable.directory, workspaceID: SessionTable.workspace_id })
          .from(SessionTable)
          .where(eq(SessionTable.id, sessionID))
          .get()
          .pipe(Effect.orDie)
        if (!row)
          return yield* new SessionNotFoundError({
            sessionID,
            message: `Session not found: ${sessionID}`,
          })

        const location = Location.Ref.make({
          directory: AbsolutePath.make(row.directory),
          workspaceID: row.workspaceID ? WorkspaceV2.ID.make(row.workspaceID) : undefined,
        })
        yield* verifySessionAccess(owners, scope, options.endpoint.name, sessionID)
        const result = yield* verifySessionAccess(owners, scope, options.endpoint.name, sessionID).pipe(
          Effect.andThen(effect),
          Effect.provide(bootLocation(locations.get(location), location)),
        )
        yield* verifySessionAccess(owners, scope, options.endpoint.name, sessionID)
        return result
      }),
    )
  }),
)
