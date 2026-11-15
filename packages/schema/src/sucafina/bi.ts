/**
 * A08 — closed BI operation bindings, directly over the installed
 * GET {mount}/dashboard?sf=bi-* routes (extended-http.ts).
 *
 * Operation IDs and wire envelopes are producer-owned; these contracts neither
 * grant access nor manufacture a different server/read model.
 */
import { Schema } from "effect"
import { optional } from "../schema"
import {
  CompareViewId, DecisionViewId, Digest, Failure, Navigation, NavigationDetail,
  Options, Presentation, Projection, Receipt, Request, ViewId,
} from "./bi/wire"

const PeriodQuery = {
  start: optional(Schema.String),
  end: optional(Schema.String),
}

/**
 * The source has two *mutually exclusive* ways to choose BI data:
 *   - a published selectionRef (or a dashboard selection issued by the host);
 *   - an explicit planner base/candidate/currency comparison (BI01..BI04).
 *
 * Never infer a version from a display value or rewrite the producer's refs.
 */
export const SfBiBiDataInput = Schema.Union([
  Schema.Struct({
    ...PeriodQuery,
    viewId: optional(ViewId),
    page: optional(Schema.String),
    selectionRef: optional(Schema.String),
  }),
  Schema.Struct({
    ...PeriodQuery,
    viewId: optional(CompareViewId),
    page: optional(Schema.String),
    baseRef: Schema.String,
    candidateRef: Schema.String,
    currency: Schema.String,
  }),
])
export type SfBiBiDataInput = typeof SfBiBiDataInput.Type

// The installed producer returns this *raw* C16 result on success, not a
// fabricated {status:"ok",value} envelope.
export const SfBiBiDataOutput = Schema.Union([
  Schema.Struct({
    request: Request,
    projection: Projection,
    presentation: Presentation,
    receipt: Receipt,
    navigation: optional(Navigation),
  }),
  Failure,
])
export type SfBiBiDataOutput = typeof SfBiBiDataOutput.Type

export const SfBiBiSourceInput = Schema.Struct({
  ...PeriodQuery,
  viewId: optional(ViewId),
  selectionRef: Schema.String,
  valueId: Schema.String,
  referenceDigest: optional(Digest),
})
export type SfBiBiSourceInput = typeof SfBiBiSourceInput.Type

// bi-source returns the producer-authorized destination links WITHOUT a
// PortResult success wrapper. Stale/denied/needs-input remain tagged failures.
export const SfBiBiSourceOutput = Schema.Union([
  Schema.Struct({ links: Schema.Array(Schema.Struct({ label: Schema.String, url: Schema.String })) }),
  Failure,
])
export type SfBiBiSourceOutput = typeof SfBiBiSourceOutput.Type

export const SfBiBiDecisionInput = Schema.Struct({
  ...PeriodQuery,
  viewId: DecisionViewId,
  selectionRef: Schema.String,
  snapshot: Digest,
  target: Digest,
})
export type SfBiBiDecisionInput = typeof SfBiBiDecisionInput.Type

export const SfBiBiDecisionOutput = Schema.Union([
  Schema.Struct({ status: Schema.Literal("ok"), value: NavigationDetail }),
  Failure,
])
export type SfBiBiDecisionOutput = typeof SfBiBiDecisionOutput.Type

export const SfBiBiOptionsInput = Schema.Struct({
  ...PeriodQuery,
  page: optional(Schema.String),
  viewId: optional(ViewId),
})
export type SfBiBiOptionsInput = typeof SfBiBiOptionsInput.Type

export const SfBiBiOptionsOutput = Schema.Union([
  Schema.Struct({ status: Schema.Literal("ok"), value: Options }),
  Failure,
])
export type SfBiBiOptionsOutput = typeof SfBiBiOptionsOutput.Type

/** Exact schemaExport values from the frozen four-entry BI catalog. */
export const SfBiBiData = {
  operationId: "bi.bi-data",
  input: SfBiBiDataInput,
  output: SfBiBiDataOutput,
} as const

export const SfBiBiSource = {
  operationId: "bi.bi-source",
  input: SfBiBiSourceInput,
  output: SfBiBiSourceOutput,
} as const

export const SfBiBiDecision = {
  operationId: "bi.bi-decision",
  input: SfBiBiDecisionInput,
  output: SfBiBiDecisionOutput,
} as const

export const SfBiBiOptions = {
  operationId: "bi.bi-options",
  input: SfBiBiOptionsInput,
  output: SfBiBiOptionsOutput,
} as const

/** One immutable, closed family; I00 composes these same codecs into F02/D01. */
export const SfBi = {
  operations: {
    "bi.bi-data": SfBiBiData,
    "bi.bi-source": SfBiBiSource,
    "bi.bi-decision": SfBiBiDecision,
    "bi.bi-options": SfBiBiOptions,
  },
} as const
