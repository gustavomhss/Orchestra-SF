export * as Sucafina from "./sucafina"

import { Schema } from "effect"

export const Surface = Schema.Literals(["dashboard", "planner", "procurement"])
export type Surface = typeof Surface.Type

export const Revision = Schema.Struct({ version: Schema.Int, by: Schema.String })
export const Versions = Schema.Record(Schema.String, Revision)
export const Values = Schema.Record(Schema.String, Schema.Json)

export const Actor = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  canWrite: Schema.Boolean,
  roles: Schema.Array(Schema.String),
  assigned: Schema.Array(Schema.String),
  domains: Schema.Array(Schema.String),
})

export const Status = Schema.Struct({
  configured: Schema.Boolean,
  authentication: Schema.Literals(["local-operator", "microsoft", "unconfigured"]),
  authenticated: Schema.Boolean,
  enrollmentRequired: Schema.Boolean,
  surfaces: Schema.Array(Surface),
  hostAuthenticated: Schema.optional(Schema.Boolean),
  principal: Schema.optional(Schema.Struct({ id: Schema.String, name: Schema.String })),
  sessionScope: Schema.optional(Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}(?![\s\S])/))),
})
export type Status = typeof Status.Type

export const PageQuery = Schema.Struct({
  page: Schema.optional(Schema.String),
  year: Schema.optional(Schema.String),
  own: Schema.optional(Schema.String),
  month: Schema.optional(Schema.String),
  version: Schema.optional(Schema.String),
  owner: Schema.optional(Schema.String),
  class: Schema.optional(Schema.String),
  q: Schema.optional(Schema.String),
  filter: Schema.optional(Schema.String),
  status: Schema.optional(Schema.String),
  priority: Schema.optional(Schema.String),
  request: Schema.optional(Schema.String),
  supplier: Schema.optional(Schema.String),
  mode: Schema.optional(Schema.String),
  risk: Schema.optional(Schema.String),
  topicStatus: Schema.optional(Schema.String),
  memberStatus: Schema.optional(Schema.String),
  projectStatus: Schema.optional(Schema.String),
  projectRisk: Schema.optional(Schema.String),
  stakeholderPriority: Schema.optional(Schema.String),
  opsMonth: Schema.optional(Schema.String),
  tab: Schema.optional(Schema.String),
  execYear: Schema.optional(Schema.String),
  opsYear: Schema.optional(Schema.String),
  secYear: Schema.optional(Schema.String),
  executiveMonth: Schema.optional(Schema.String),
  operationsMonth: Schema.optional(Schema.String),
  securityMonth: Schema.optional(Schema.String),
})
export type PageQuery = typeof PageQuery.Type

// Only the domain's authorized, masked view crosses this boundary. Never expose a raw Snapshot.
export const PageState = Schema.Struct({
  surface: Surface,
  page: Schema.String,
  pages: Schema.Array(Schema.String),
  actor: Actor,
  year: Schema.Int,
  month: Schema.Int,
  data: Values,
  versions: Versions,
  directory: Schema.Array(Schema.Struct({ id: Schema.String, name: Schema.String })),
  actions: Schema.optional(
    Schema.Array(Schema.suspend(() => NativeAction)).check(
      Schema.makeFilter((actions) => new Set(actions.map((action) => action.key)).size === actions.length),
    ),
  ),
})
export type PageState = typeof PageState.Type

export const Command = Schema.Struct({
  page: Schema.String,
  action: Schema.String,
  id: Schema.optional(Schema.String),
  version: Schema.Int,
  values: Values,
  confirmed: Schema.optional(Schema.Boolean),
})
export type Command = typeof Command.Type

export const NativeText = Schema.Struct({ en: Schema.String, br: Schema.String })
export type NativeText = typeof NativeText.Type

export const NativePath = Schema.Array(
  Schema.Union([
    Schema.String.check(Schema.makeFilter((key) => !["__proto__", "prototype", "constructor"].includes(key))),
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER)),
  ]),
).check(Schema.isMinLength(1))
export type NativePath = typeof NativePath.Type

export const NativeChoice = Schema.Struct({
  value: Schema.Union([Schema.String, Schema.Finite, Schema.Boolean, Schema.Null]),
  label: NativeText,
})
export type NativeChoice = typeof NativeChoice.Type

export const NativeScalar = Schema.Struct({
  kind: Schema.Literals(["text", "textarea", "number", "date", "select", "checkbox"]),
  path: NativePath,
  label: NativeText,
  required: Schema.optional(Schema.Boolean),
  readOnly: Schema.optional(Schema.Boolean),
  blank: Schema.optional(Schema.Literals(["omit", "null", "empty"])),
  min: Schema.optional(Schema.Finite),
  max: Schema.optional(Schema.Finite),
  step: Schema.optional(Schema.Finite),
  options: Schema.optional(Schema.Array(NativeChoice)),
}).annotate({ identifier: "Sucafina.NativeScalar" })
export type NativeScalar = typeof NativeScalar.Type

export interface NativeGroup extends Schema.Schema.Type<typeof NativeGroup> {}
export const NativeGroup = Schema.Struct({
  kind: Schema.Literal("group"),
  label: Schema.optional(NativeText),
  fields: Schema.Array(Schema.suspend(() => NativeField)),
}).annotate({ identifier: "Sucafina.NativeGroup" })

export interface NativeList extends Schema.Schema.Type<typeof NativeList> {}
export const NativeList = Schema.Struct({
  kind: Schema.Literal("list"),
  path: NativePath,
  label: NativeText,
  fields: Schema.Array(Schema.suspend(() => NativeField)),
  add: Schema.optional(Values),
  remove: Schema.optional(Schema.Boolean),
  readOnly: Schema.optional(Schema.Boolean),
  minimum: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
  maximum: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
}).annotate({ identifier: "Sucafina.NativeList" })

export type NativeField = NativeScalar | NativeGroup | NativeList
export const NativeField: Schema.Codec<NativeField> = Schema.Union([NativeScalar, NativeGroup, NativeList])
  .annotate({ identifier: "Sucafina.NativeField" })

export const NativeAction = Schema.Struct({
  key: Schema.String,
  label: NativeText,
  group: Schema.optional(NativeText),
  target: Schema.optional(Schema.Struct({ collection: Schema.String, id: Schema.String })),
  command: Command,
  fields: Schema.Array(NativeField),
  confirm: Schema.optional(NativeText),
  danger: Schema.optional(Schema.Boolean),
}).annotate({ identifier: "Sucafina.NativeAction" })
export type NativeAction = typeof NativeAction.Type

export const CommandResult = Schema.Struct({
  ok: Schema.Literal(true),
  warnings: Schema.optional(Schema.Array(Schema.String)),
})

export class ValidationError extends Schema.TaggedErrorClass<ValidationError>()(
  "SucafinaValidationError",
  { message: Schema.String, errors: Schema.Array(Schema.String) },
  { httpApiStatus: 422 },
) {}

// Stored must come from the same authorized failure projection used by the business HTTP boundary.
export class ConflictError extends Schema.TaggedErrorClass<ConflictError>()(
  "SucafinaConflictError",
  { message: Schema.String, stored: Schema.optional(Schema.Json), by: Schema.optional(Schema.String) },
  { httpApiStatus: 409 },
) {}
