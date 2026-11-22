export * as ProviderAccess from "./provider-access"

import { Schema } from "effect"
import { ConnectionAccess } from "./connection-access"
import { Model } from "./model"
import { Provider } from "./provider"
import { PositiveInt } from "./schema"
import { TeamProfile } from "./sucafina/team-profile"

const Token = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/
export const ProviderId = Provider.ID.check(Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/))
export const ModelId = Model.ID.check(Schema.isPattern(Token))
export const Name = Schema.NonEmptyString.check(
  Schema.isMaxLength(256), Schema.isTrimmed(), Schema.isPattern(/^[^\u0000-\u001f\u007f]+$/),
)
/** Private installation policy only. A browser cannot supply or retarget this endpoint. */
export const Endpoint = Schema.String.check(Schema.isMaxLength(2048), Schema.makeFilter((value) => {
  if (!URL.canParse(value)) return false
  const url = new URL(value)
  return url.protocol === "https:" && url.hostname.length > 0 && url.username === "" && url.password === "" &&
    url.search === "" && url.hash === "" && url.href === value
}, { message: "Provider endpoints must be canonical HTTPS URLs without credentials, query or fragment" }))
  .annotate({ identifier: "ProviderAccess.Endpoint" })
export const Protocol = Schema.Literal("openai-chat-completions")
  .annotate({ identifier: "ProviderAccess.Protocol" })

export const Limits = Schema.Struct({ context: PositiveInt, output: PositiveInt }).check(
  Schema.makeFilter((value) => Number.isSafeInteger(value.context) && Number.isSafeInteger(value.output) && value.output <= value.context,
    { message: "Provider limits must be safe integers and output cannot exceed context" }),
).annotate({ identifier: "ProviderAccess.Limits", parseOptions: { onExcessProperty: "error" } })
export interface Limits extends Schema.Schema.Type<typeof Limits> {}
export const ModelDefinition = Schema.Struct({
  id: ModelId, name: Name, limit: Limits, tools: Schema.Boolean,
}).annotate({ identifier: "ProviderAccess.ModelDefinition", parseOptions: { onExcessProperty: "error" } })
export interface ModelDefinition extends Schema.Schema.Type<typeof ModelDefinition> {}
export const Models = Schema.Array(ModelDefinition).check(
  Schema.isMinLength(1), Schema.isMaxLength(200),
  Schema.makeFilter((values) => new Set(values.map((value) => value.id)).size === values.length,
    { message: "Provider model identities must be unique" }),
)
export type Models = typeof Models.Type
export const Connection = Schema.Struct({
  category: Schema.Literal("integration"), resourceId: ConnectionAccess.Identifier, id: ConnectionAccess.Identifier,
}).annotate({ identifier: "ProviderAccess.Connection", parseOptions: { onExcessProperty: "error" } })
export interface Connection extends Schema.Schema.Type<typeof Connection> {}
/** A declaration is policy data, never an admission or a native model capability. */
export const Binding = Schema.Struct({
  profile: TeamProfile.Ref, providerId: ProviderId, name: Name, protocol: Protocol,
  endpoint: Endpoint, connection: Connection, models: Models,
}).annotate({ identifier: "ProviderAccess.Binding", parseOptions: { onExcessProperty: "error" } })
export interface Binding extends Schema.Schema.Type<typeof Binding> {}
export const Bindings = Schema.Array(Binding).check(
  Schema.isMaxLength(64),
  Schema.makeFilter((values) => new Set(values.map((value) => JSON.stringify([
    value.profile.installationId, value.profile.tenantId, value.profile.teamObjectId, value.providerId,
  ]))).size === values.length, { message: "Provider bindings must be unique within a Team profile" }),
).annotate({ identifier: "ProviderAccess.Bindings" })
export type Bindings = typeof Bindings.Type

/** Browser metadata deliberately omits the endpoint, any credential value and executable handles. */
export const Metadata = Schema.Struct({
  providerId: ProviderId, name: Name, protocol: Protocol, connection: Connection, models: Models,
}).annotate({ identifier: "ProviderAccess.Metadata", parseOptions: { onExcessProperty: "error" } })
export interface Metadata extends Schema.Schema.Type<typeof Metadata> {}
export const Catalog = Schema.Struct({
  namespace: TeamProfile.SessionNamespace,
  providers: Schema.Array(Metadata).check(Schema.isMaxLength(64),
    Schema.makeFilter((values) => new Set(values.map((value) => value.providerId)).size === values.length,
      { message: "Provider metadata must be unique" })),
}).annotate({ identifier: "ProviderAccess.Catalog", parseOptions: { onExcessProperty: "error" } })
export interface Catalog extends Schema.Schema.Type<typeof Catalog> {}
