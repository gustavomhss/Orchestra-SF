import { ServiceUnavailableError } from "@orchestra/protocol/errors"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../api"

// The native contract is installed before its private installation service is connected.
// No fallback identity or empty business dataset may be substituted for that service.
export const SucafinaHandler = HttpApiBuilder.group(Api, "server.sucafina", (handlers) =>
  handlers
    .handle("sucafina.status", () => Effect.succeed({
      configured: false,
      authentication: "unconfigured" as const,
      authenticated: false,
      enrollmentRequired: false,
      surfaces: [],
    }))
    .handle("sucafina.state", () => Effect.fail(new ServiceUnavailableError({
      message: "The native Sucafina installation is not configured.",
      service: "sucafina",
    })))
    .handle("sucafina.command", () => Effect.fail(new ServiceUnavailableError({
      message: "The native Sucafina installation is not configured.",
      service: "sucafina",
    }))),
)
