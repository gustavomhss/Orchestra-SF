import { Schema } from "effect"
import { NonNegativeInt, optional } from "../schema"

/**
 * A09 public wire bindings. Every output is an exact subset of the frozen
 * BusinessPorts/Result types, not a runtime service or an alternative engine.
 * All callers must decode with onExcessProperty: "error".
 */
const Ref = Schema.String.check(Schema.isNonEmpty())
export const SfRoutineCaseRef = Schema.Struct({
  id: Ref,
  incarnation: Ref,
  version: NonNegativeInt,
})
const CaseEnvelope = <Input extends Schema.Top>(input: Input) =>
  Schema.Struct({ caseRef: SfRoutineCaseRef, input })

export const SfRoutineSourceRef = Schema.Struct({
  surface: Schema.Literals(["dashboard", "planner", "procurement"]),
  type: Schema.String,
  id: Schema.String,
  incarnation: Schema.String,
  version: NonNegativeInt,
  fields: Schema.Array(Schema.String),
  period: Schema.Struct({ start: Schema.String, end: Schema.String }),
  observedAt: Schema.String,
})
const ResultFields = {
  documentId: Schema.String,
  publishedVersion: Schema.String,
  principalRef: Schema.String,
  projectId: Schema.String,
  runRef: optional(Schema.String),
  resultRef: optional(Schema.String),
  authorizationId: optional(Schema.String),
  armRef: optional(Schema.String),
  childSessionId: optional(Schema.String),
  correlationId: Schema.String,
  sourceRefs: Schema.Array(SfRoutineSourceRef),
  pending: Schema.Array(Schema.String),
}
export const SfRoutineResult = Schema.Union([
  Schema.Struct({
    ...ResultFields,
    admission: Schema.Literal("admitted"),
    admissionRef: Schema.String,
    admissionVersion: NonNegativeInt,
  }),
  Schema.Struct({
    ...ResultFields,
    admission: Schema.Literals(["preparing", "needs-review", "denied", "unavailable", "stale"]),
    admissionRef: optional(Schema.String),
    admissionVersion: optional(NonNegativeInt),
  }),
])
const PortFailure = Schema.Struct({
  status: Schema.Literals(["needs-input", "stale", "denied", "unavailable", "conflict", "provider-conflict", "failed"]),
  reason: Schema.String,
})
const portResult = <Output extends Schema.Top>(value: Output) => Schema.Union([
  Schema.Struct({ status: Schema.Literal("ok"), value }),
  PortFailure,
])
const CatalogRecipe = Schema.Struct({
  documentId: Schema.String,
  publishedVersion: Schema.String,
  planRevisionId: Schema.String,
  writeScope: Schema.Array(Schema.String),
  title: Schema.String,
})
const ScheduleSummary = Schema.Struct({
  scheduleRef: Schema.String,
  version: NonNegativeInt,
  state: Schema.Literals(["needs-review", "active", "paused"]),
})
export const SfScheduleDetail = Schema.Struct({
  scheduleRef: Ref,
  version: NonNegativeInt,
  state: Schema.String,
  conditionRef: Schema.String,
  recipeRef: Schema.String,
  recurrence: Schema.String,
  timezone: Schema.String,
})
const ScheduleDetailResult = Schema.Union([
  Schema.Struct({ status: Schema.Literal("ok"), value: SfScheduleDetail }),
  Schema.Struct({ status: Schema.Literal("not-found"), reason: Schema.Literal("schedule-not-found") }),
  PortFailure,
])

/** The only new GET projection A09 owns; producer is sf_routine_status. */
export const SfProjectionRoutine = {
  operationId: "projection.routine",
  input: Schema.Struct({ runRef: Ref }),
  output: portResult(SfRoutineResult),
} as const

/** Original BusinessPorts.routines signatures, wrapped in a current case fence. */
export const SfRoutinesCatalog = {
  operationId: "routines.catalog",
  input: CaseEnvelope(Schema.Struct({ purpose: Schema.String })),
  output: portResult(Schema.Array(CatalogRecipe)),
} as const

export const SfRoutinesPrepareAdmission = {
  operationId: "routines.prepare-admission",
  input: CaseEnvelope(Schema.Struct({
    publishedRecipeRef: Ref,
    planRevisionId: Ref,
    writeScope: Schema.Array(Schema.String),
    inputRefs: Schema.Array(Schema.String),
    parameters: Schema.Record(Schema.String, Schema.Json),
  })),
  output: portResult(SfRoutineResult),
} as const

export const SfRoutinesReadAdmission = {
  operationId: "routines.read-admission",
  input: CaseEnvelope(Schema.Struct({ admissionRef: Ref })),
  output: portResult(SfRoutineResult),
} as const

export const SfRoutinesReadRun = {
  operationId: "routines.read-run",
  input: CaseEnvelope(Schema.Struct({ runRef: Ref })),
  output: portResult(SfRoutineResult),
} as const

export const SfRoutinesRun = {
  operationId: "routines.run",
  input: CaseEnvelope(Schema.Struct({
    admissionRef: Ref,
    expectedAdmissionVersion: NonNegativeInt,
    caseRef: SfRoutineCaseRef,
  })),
  output: portResult(SfRoutineResult),
} as const

/** No caseRef on native Schedule: exactly the direct BusinessPorts inputs. */
export const SfSchedulesCreate = {
  operationId: "schedules.create",
  input: Schema.Struct({
    conditionRef: Ref, recipeRef: Ref, recurrence: Ref, timezone: Ref,
  }),
  output: portResult(Schema.Struct({
    scheduleRef: Schema.String,
    version: NonNegativeInt,
    state: Schema.Literals(["needs-review", "active", "paused"]),
  })),
} as const

export const SfSchedulesList = {
  operationId: "schedules.list",
  input: Schema.Struct({}),
  output: portResult(Schema.Array(Schema.Struct({
    scheduleRef: Schema.String, version: NonNegativeInt, state: Schema.String,
  }))),
} as const

export const SfSchedulesPause = {
  operationId: "schedules.pause",
  input: Schema.Struct({ scheduleRef: Ref, expectedVersion: NonNegativeInt }),
  output: portResult(Schema.Struct({
    scheduleRef: Schema.String, version: NonNegativeInt, state: Schema.Literal("paused"),
  })),
} as const

/** A real, private, optional scheduleDetails.read port must supply this result. */
export const SfSchedulesRead = {
  operationId: "schedules.read",
  input: Schema.Struct({ scheduleRef: Ref }),
  output: ScheduleDetailResult,
} as const

export const SfSchedulesReadRun = {
  operationId: "schedules.read-run",
  input: Schema.Struct({ runRef: Ref }),
  output: portResult(SfRoutineResult),
} as const

export const SfSchedulesUpdate = {
  operationId: "schedules.update",
  input: Schema.Struct({
    scheduleRef: Ref, expectedVersion: NonNegativeInt,
    recurrence: Ref, timezone: Ref,
  }),
  output: portResult(Schema.Struct({
    scheduleRef: Schema.String, version: NonNegativeInt,
  })),
} as const

export const SfRoutines = {
  operations: {
    "projection.routine": SfProjectionRoutine,
    "routines.catalog": SfRoutinesCatalog,
    "routines.prepare-admission": SfRoutinesPrepareAdmission,
    "routines.read-admission": SfRoutinesReadAdmission,
    "routines.read-run": SfRoutinesReadRun,
    "routines.run": SfRoutinesRun,
    "schedules.create": SfSchedulesCreate,
    "schedules.list": SfSchedulesList,
    "schedules.pause": SfSchedulesPause,
    "schedules.read": SfSchedulesRead,
    "schedules.read-run": SfSchedulesReadRun,
    "schedules.update": SfSchedulesUpdate,
  },
} as const

export type SfRoutinesOperationId = keyof typeof SfRoutines.operations
