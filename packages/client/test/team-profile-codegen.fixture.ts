import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"

export const Namespace = TeamProfile.SessionNamespace
export const ResponseBody = Schema.Struct({ namespace: Namespace, data: Schema.Array(Schema.String) })
export const Frame = Schema.Struct({ namespace: Namespace, event: Schema.Struct({ type: Schema.Literal("probe") }) })

export const Api = HttpApi.make("team-profile-codegen").add(
  HttpApiGroup.make("probe")
    .add(HttpApiEndpoint.get("read", "/read", { success: ResponseBody }))
    .add(HttpApiEndpoint.post("write", "/write", { payload: Schema.Struct({ namespace: Namespace }), success: Schema.Boolean }))
    .add(HttpApiEndpoint.get("events", "/event", { success: HttpApiSchema.StreamSse({ data: Frame }) })),
)
