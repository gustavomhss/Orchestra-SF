import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { SfInstallationList } from "@orchestra/schema/sucafina/context"
import { HttpServerResponse } from "effect/unstable/http"
import { HttpServerRequest } from "effect/unstable/http"
import { InvalidRequestError } from "@orchestra/protocol/errors"
import { Api } from "../api"
import {
  SfInstallationSource, SfInvalidInstallationSelector,
  parseSfInstallationSelector, readSfInstallations,
} from "../sucafina-installations"

/** Registered only by I00 alongside the global Orchestra Authorization middleware. */
export const SucafinaHandler = HttpApiBuilder.group(Api, "server.sucafina", (handlers) =>
  Effect.gen(function* () {
    const installed = yield* SfInstallationSource
    return handlers.handle("sucafina.installations", Effect.fn(function* () {
      const raw = yield* HttpServerRequest.HttpServerRequest
      let selector: ReturnType<typeof parseSfInstallationSelector>
      try { selector = parseSfInstallationSelector(raw.url) }
      catch (error) {
        if (!(error instanceof SfInvalidInstallationSelector)) throw error
        return yield* new InvalidRequestError({ message: "Invalid installation selector", field: "select" })
      }
      // The selected connection is already fixed by the HTTP transport; raw query
      // cannot switch servers, inject a directory into ids, or enumerate another runtime.
      const result = yield* Effect.tryPromise({
        try: (signal) => readSfInstallations(installed, selector, signal),
        catch: () => new InvalidRequestError({ message: "Installation discovery unavailable", field: "select" }),
      })
      return yield* HttpServerResponse.schemaJson(SfInstallationList)(result, {
        headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
      }).pipe(Effect.mapError(() => new InvalidRequestError({ message: "Installation discovery unavailable", field: "select" })))
    }))
  }),
)
