import { SfInstallationQuery, SfInstallationList } from "@orchestra/schema/sucafina/context"
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { InvalidRequestError } from "../errors"
import { locationQueryOpenApi } from "./location"

/** Discovery only. No Sucafina admission is granted by an Orchestra endpoint. */
export const SucafinaGroup = HttpApiGroup.make("server.sucafina")
  .add(
    HttpApiEndpoint.get("sucafina.installations", "/api/sucafina/installations", {
      query: SfInstallationQuery,
      success: SfInstallationList,
      error: InvalidRequestError,
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(OpenApi.annotations({
        identifier: "v2.sucafina.installations",
        summary: "Discover the selected Sucafina installation",
        description: "Microsoft bootstrap uses the versioned current selector for metadata of the single installed runtime; a selected installation uses its complete installation and resource-tenant selector. Discovery returns placement metadata, never corporate admission. Legacy IDs/Location apply only to local-operator installations.",
      })),
  )
  .annotateMerge(OpenApi.annotations({ title: "sucafina", description: "Selected installation discovery." }))
