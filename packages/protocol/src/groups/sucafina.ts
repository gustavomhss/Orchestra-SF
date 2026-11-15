import { SfInstallationSelector, SfInstallationList } from "@orchestra/schema/sucafina/context"
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { InvalidRequestError } from "../errors"
import { locationQueryOpenApi } from "./location"

/** Discovery only. No Sucafina admission is granted by an Orchestra endpoint. */
export const SucafinaGroup = HttpApiGroup.make("server.sucafina")
  .add(
    HttpApiEndpoint.get("sucafina.installations", "/api/sucafina/installations", {
      query: SfInstallationSelector,
      success: SfInstallationList,
      error: InvalidRequestError,
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(OpenApi.annotations({
        identifier: "v2.sucafina.installations",
        summary: "Discover the selected Sucafina installation",
        description: "Strict IDs or admitted Location selector, never directory fallback.",
      })),
  )
  .annotateMerge(OpenApi.annotations({ title: "sucafina", description: "Selected installation discovery." }))
