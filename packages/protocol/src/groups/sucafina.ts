import { Sucafina } from "@orchestra/schema/sucafina"
import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { ForbiddenError, InvalidRequestError, ServiceUnavailableError, UnauthorizedError } from "../errors"

const params = Schema.Struct({ surface: Sucafina.Surface })
const errors = [
  InvalidRequestError,
  UnauthorizedError,
  ForbiddenError,
  Sucafina.ConflictError,
  Sucafina.ValidationError,
  ServiceUnavailableError,
] as const

export const SucafinaGroup = HttpApiGroup.make("server.sucafina")
  .add(HttpApiEndpoint.get("sucafina.status", "/api/sucafina/status", {
    success: Sucafina.Status,
    error: ServiceUnavailableError,
  }))
  .add(HttpApiEndpoint.get("sucafina.state", "/api/sucafina/:surface/state", {
    params,
    query: Sucafina.PageQuery,
    success: Sucafina.PageState,
    error: errors,
  }))
  .add(HttpApiEndpoint.post("sucafina.command", "/api/sucafina/:surface/commands", {
    params,
    payload: Sucafina.Command,
    success: Sucafina.CommandResult,
    error: errors,
  }))
