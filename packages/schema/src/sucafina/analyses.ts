import { Schema } from "effect"
import { Model } from "../model"
import { optional } from "../schema"
import { SfContextStamp } from "./context"

/** A15 wire shapes. Source: analysis-http.ts, CLI analysis-http.ts, analysis-options.ts.
 * The analysis producer, not the browser, authorizes the selected skill/case/model
 * and validates the installed skill input against its inputSchemaRef.
 */
const Text = Schema.NonEmptyString
const CaseRef = Schema.Struct({
  id: Text,
  incarnation: Text,
  version: Schema.Int,
})
const Request = Schema.Struct({
  caseRef: CaseRef,
  objective: Text,
  profileId: Text,
  profileVersion: Text,
  skillId: Text,
  skillVersion: Text,
  manifestDigest: Text,
  outputSchemaVersion: Schema.Literal("sf-contribution-v1"),
  requestedOperationScope: Schema.Array(Text),
})
const RunState = Schema.Literals([
  "preparing", "queued", "running", "ready", "needs-input",
  "stale", "cancelled", "failed", "unavailable",
])
const Run = Schema.Struct({
  runRef: Text,
  state: RunState,
  version: Schema.Int,
  outputRef: Schema.String.pipe(optional),
  // The native producer supplies attribution. Omitted for legacy runs.
  profileId: Schema.String.pipe(optional),
  profileVersion: Schema.String.pipe(optional),
  skillId: Schema.String.pipe(optional),
  caseRef: CaseRef.pipe(optional),
  createdAt: Schema.String.pipe(optional),
  updatedAt: Schema.String.pipe(optional),
})
const Failure = Schema.Struct({
  status: Schema.Literals([
    "invalid", "needs-input", "stale", "denied", "unavailable",
    "conflict", "provider-conflict", "failed",
  ]),
  // The original analysis-base producer sends only status on non-ok.
  // analysis-host and analysis-options may also provide reason.
  reason: Schema.String.pipe(optional),
})

export const SfIntelligenceAnalysisChoicesInput = Schema.Struct({})
export const SfIntelligenceAnalysisChoices = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("ok"),
    value: Schema.Struct({
      cases: Schema.Array(Schema.Struct({ caseRef: CaseRef, label: Schema.String })),
      analyses: Schema.Array(Schema.Struct({
        label: Schema.String,
        profileId: Text,
        profileVersion: Text,
        skillId: Schema.Literals(["sf-enquadrar-decisao", "sf-explicar-forecast"]),
        skillVersion: Text,
        manifestDigest: Text,
        outputSchemaVersion: Schema.Literal("sf-contribution-v1"),
        requestedOperationScope: Schema.Array(Text),
      })),
      models: Schema.Array(Model.Ref),
    }),
  }),
  Failure,
])

// The producer takes a selection keyed by the installed skill input producer.
// The key/value map has no stable public shape across 18 producer families;
// it is validated inside the real producer after admission, not interpreted here.
const Selection = Schema.Record(Schema.String, Schema.Json)
export const SfIntelligenceAnalysisPrepareInput = Schema.Struct({
  input: Schema.Struct({ request: Request, selection: Selection }),
})
export const SfIntelligenceAnalysisPrepare = Schema.Union([
  Schema.Struct({ status: Schema.Literal("ok"), value: Schema.Json }),
  Failure,
])

// The installed skill's declared inputSchemaRef controls this JSON subtree.
export const SfIntelligenceAnalysisStartInput = Schema.Struct({
  input: Schema.Struct({
    request: Request,
    skillInput: Schema.Json,
    model: Model.Ref,
    authorAnalysis: Schema.Struct({
      runRef: Text, outputDigest: Schema.String,
    }).pipe(optional),
  }),
})
export const SfIntelligenceAnalysisStart = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("ok"),
    value: Schema.Struct({ runRef: Text }),
  }),
  Failure,
])

export const SfIntelligenceAnalysisReadInput = Schema.Struct({ runRef: Text })
export const SfIntelligenceAnalysisRead = Schema.Union([
  Schema.Struct({ status: Schema.Literal("ok"), value: Run }),
  Failure,
])

export const SfIntelligenceAnalysisListInput = Schema.Struct({ caseRef: CaseRef })
export const SfIntelligenceAnalysisList = Schema.Union([
  Schema.Struct({ status: Schema.Literal("ok"), value: Schema.Array(Run) }),
  Failure,
])

export const SfIntelligenceAnalysisOutputInput = Schema.Struct({ runRef: Text })
export const SfIntelligenceAnalysisOutput = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("ok"),
    value: Schema.Struct({
      // Existing analysis-base explicitly presents the current admitted
      // contribution as HTML; do not expose the private ContributionEnvelope.
      html: Schema.String,
      outputRef: Schema.String.pipe(optional),
      // A ready, authorized contribution may point to its original import simulation.
      // This reference grants no file access; files.import-reference authorizes it again.
      importPreviewRef: Text.pipe(optional),
      review: Schema.Struct({
        request: Request,
        model: Model.Ref,
        authorAnalysis: Schema.Struct({ runRef: Text, outputDigest: Schema.String }),
      }).pipe(optional),
      reviewUnavailable: Schema.Boolean.pipe(optional),
    }),
  }),
  Failure,
])

export const SfIntelligenceAnalysisCancelInput = Schema.Struct({ runRef: Text })
export const SfIntelligenceAnalysisCancel = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("ok"),
    value: Schema.Struct({ cancelled: Schema.Boolean }),
  }),
  Failure,
])

const ResidentSkill = Schema.Struct({
  id: Text,
  version: Text,
  allowedOperations: Schema.Array(Text),
  outputSchemaRefs: Schema.Array(Text),
})
export const SfResidentCatalog = Schema.Struct({
  profiles: Schema.Array(Schema.Struct({
    id: Schema.Literals(["sf_maestro", "sf_finance", "sf_procurement", "sf_portfolio", "sf_reviewer"]),
    version: Text,
    mission: Schema.String,
    skills: Schema.Array(ResidentSkill),
  })),
})
export const SfProjectionResidentsInput = Schema.Struct({})
export const SfProjectionResidents = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("ok"),
    context: SfContextStamp,
    value: SfResidentCatalog,
  }),
  Schema.Struct({
    status: Schema.Literals(["invalid", "denied", "unauthenticated", "unavailable"]),
    reason: Schema.String.pipe(optional),
  }),
])

/** One closed, source-locked operation codec per real endpoint.
 * Method, path, query and body discriminator are supplied by I00's registry.
 * They are never supplied as caller-controlled fields.
 */
export const SfAnalyses = {
  operations: {
    "intelligence.analysis.cancel": {
      operationId: "intelligence.analysis.cancel",
      input: SfIntelligenceAnalysisCancelInput,
      output: SfIntelligenceAnalysisCancel,
    },
    "intelligence.analysis.choices": {
      operationId: "intelligence.analysis.choices",
      input: SfIntelligenceAnalysisChoicesInput,
      output: SfIntelligenceAnalysisChoices,
    },
    "intelligence.analysis.list": {
      operationId: "intelligence.analysis.list",
      input: SfIntelligenceAnalysisListInput,
      output: SfIntelligenceAnalysisList,
    },
    "intelligence.analysis.output": {
      operationId: "intelligence.analysis.output",
      input: SfIntelligenceAnalysisOutputInput,
      output: SfIntelligenceAnalysisOutput,
    },
    "intelligence.analysis.prepare": {
      operationId: "intelligence.analysis.prepare",
      input: SfIntelligenceAnalysisPrepareInput,
      output: SfIntelligenceAnalysisPrepare,
    },
    "intelligence.analysis.read": {
      operationId: "intelligence.analysis.read",
      input: SfIntelligenceAnalysisReadInput,
      output: SfIntelligenceAnalysisRead,
    },
    "intelligence.analysis.start": {
      operationId: "intelligence.analysis.start",
      input: SfIntelligenceAnalysisStartInput,
      output: SfIntelligenceAnalysisStart,
    },
    "projection.residents": {
      operationId: "projection.residents",
      input: SfProjectionResidentsInput,
      output: SfProjectionResidents,
    },
  },
} as const
