import { Schema } from "effect"
import { NonNegativeInt, PositiveInt } from "./schema"

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
