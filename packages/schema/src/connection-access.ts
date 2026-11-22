import { Schema } from "effect"
import { NonNegativeInt, PositiveInt } from "./schema"
import { TeamProfile } from "./sucafina/team-profile"

export * as ConnectionAccess from "./connection-access"

/** Explicit private installation policy. No role, selected Team or model permission supplies these actions. */
export const Actions = ["read", "create", "update", "remove"] as const
export const Action = Schema.Literals(Actions).annotate({ identifier: "ConnectionAccess.Action" })
export type Action = typeof Action.Type
export const Category = Schema.Literals(["integration", "mcp"]).annotate({ identifier: "ConnectionAccess.Category" })
export type Category = typeof Category.Type
export const Identifier = Schema.NonEmptyString.check(
  Schema.isMaxLength(256), Schema.isTrimmed(), Schema.isPattern(/^[^\u0000-\u001f\u007f]+$/),
)
export const Resource = Schema.Struct({ category: Category, resourceId: Identifier }).annotate({
  identifier: "ConnectionAccess.Resource", parseOptions: { onExcessProperty: "error" },
})
export interface Resource extends Schema.Schema.Type<typeof Resource> {}
export const Resources = Schema.Array(Resource).check(
  Schema.isMaxLength(500),
  Schema.makeFilter((values) => new Set(values.map((value) => JSON.stringify([value.category, value.resourceId]))).size === values.length,
    { message: "Connection resources must be unique" }),
)
export type Resources = typeof Resources.Type
export const Key = Schema.Struct({ category: Category, resourceId: Identifier, id: Identifier }).annotate({
  identifier: "ConnectionAccess.Key", parseOptions: { onExcessProperty: "error" },
})
export interface Key extends Schema.Schema.Type<typeof Key> {}
export const Label = Schema.String.check(Schema.isMaxLength(256), Schema.isPattern(/^[^\u0000-\u001f\u007f]*$/))
export const Metadata = Schema.Struct({
  key: Key, label: Label, revision: PositiveInt, state: Schema.Literals(["active", "removed"]),
}).annotate({ identifier: "ConnectionAccess.Metadata", parseOptions: { onExcessProperty: "error" } })
export interface Metadata extends Schema.Schema.Type<typeof Metadata> {}
/** Private plaintext transport between the server vault and Core. Never used by an HttpApi. */
export const EncodedValue = Schema.String.check(Schema.isMaxLength(65536))
export const Write = Schema.Struct({
  key: Key, label: Label, encodedValue: EncodedValue, expectedRevision: NonNegativeInt,
  action: Schema.Literals(["create", "update"]),
}).annotate({ parseOptions: { onExcessProperty: "error" } })
export interface Write extends Schema.Schema.Type<typeof Write> {}
export const Remove = Schema.Struct({ key: Key, expectedRevision: PositiveInt }).annotate({
  parseOptions: { onExcessProperty: "error" },
})
export interface Remove extends Schema.Schema.Type<typeof Remove> {}

/** Public API-key command. OAuth and arbitrary encoded credential objects remain private adapter contracts. */
export const ApiKey = Schema.NonEmptyString.check(Schema.isMaxLength(16384), Schema.isPattern(/^[\x21-\x7e]+$/))
  .annotate({ identifier: "ConnectionAccess.ApiKey" })
export const PersonalKey = Schema.Struct({
  category: Schema.Literal("integration"), resourceId: Identifier, id: Identifier,
}).annotate({ identifier: "ConnectionAccess.PersonalKey", parseOptions: { onExcessProperty: "error" } })
export interface PersonalKey extends Schema.Schema.Type<typeof PersonalKey> {}
export const PersonalCommand = Schema.Union([
  Schema.Struct({
    action: Schema.Literal("create"), key: PersonalKey, label: Label, expectedRevision: NonNegativeInt, secret: ApiKey,
  }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  Schema.Struct({
    action: Schema.Literal("update"), key: PersonalKey, label: Label, expectedRevision: PositiveInt, secret: ApiKey,
  }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  Schema.Struct({
    action: Schema.Literal("remove"), key: PersonalKey, expectedRevision: PositiveInt,
  }).annotate({ parseOptions: { onExcessProperty: "error" } }),
]).annotate({ identifier: "ConnectionAccess.PersonalCommand" })
export type PersonalCommand = typeof PersonalCommand.Type
/** "active" describes the retained record; it is neither a successful provider call nor command authorship. */
export const Slot = Schema.Union([
  Schema.Struct({ key: Key, label: Schema.Literal(""), revision: Schema.Literal(0), state: Schema.Literal("absent") })
    .annotate({ parseOptions: { onExcessProperty: "error" } }),
  Metadata,
]).annotate({ identifier: "ConnectionAccess.Slot" })
export type Slot = typeof Slot.Type
export const PersonalMetadataResult = Schema.Union([
  Schema.Struct({ status: Schema.Literal("available"), namespace: TeamProfile.SessionNamespace, connection: Slot })
    .annotate({ parseOptions: { onExcessProperty: "error" } }),
  Schema.Struct({ status: Schema.Literals(["denied", "unavailable", "invalid-request"]) })
    .annotate({ parseOptions: { onExcessProperty: "error" } }),
]).annotate({ identifier: "ConnectionAccess.PersonalMetadataResult" })
export type PersonalMetadataResult = typeof PersonalMetadataResult.Type
export const PersonalCommandResult = Schema.Union([
  Schema.Struct({ status: Schema.Literal("saved"), namespace: TeamProfile.SessionNamespace, connection: Metadata })
    .check(Schema.makeFilter((value) => value.connection.state === "active",
      { message: "A saved connection must have an active record" }))
    .annotate({ parseOptions: { onExcessProperty: "error" } }),
  Schema.Struct({ status: Schema.Literal("removed"), namespace: TeamProfile.SessionNamespace, connection: Metadata })
    .check(Schema.makeFilter((value) => value.connection.state === "removed",
      { message: "A removed connection must have a retained tombstone" }))
    .annotate({ parseOptions: { onExcessProperty: "error" } }),
  Schema.Struct({ status: Schema.Literals(["conflict", "denied", "unavailable", "invalid-request"]) })
    .annotate({ parseOptions: { onExcessProperty: "error" } }),
]).annotate({ identifier: "ConnectionAccess.PersonalCommandResult" })
export type PersonalCommandResult = typeof PersonalCommandResult.Type
