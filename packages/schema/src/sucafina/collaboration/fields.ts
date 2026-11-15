import { Schema } from "effect"

/**
 * A13 browser-safe source projections. These describe the admitted C17/C05
 * evidence and product output shapes, not authority, permissions or server state.
 * Source: collaboration/http-routes.ts and the existing contracts/context.ts,
 * business-context.ts, decisions.ts, operations.ts and outputs.ts at C58.
 */
export const SfNonEmpty = Schema.NonEmptyString
export const SfNonNegative = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
export const SfPositive = Schema.Int.check(Schema.isGreaterThan(0))
export const SfAmount = Schema.NullOr(Schema.Finite)
export const SfPeriod = Schema.Struct({ start: Schema.String, end: Schema.String })
export const SfSurface = Schema.Literals(["dashboard", "planner", "procurement"])
export const SfCaseIdentity = Schema.Struct({ id: SfNonEmpty, incarnation: SfNonEmpty, version: SfPositive })
  .annotate({ parseOptions: { onExcessProperty: "error" } })

export const SfSourceRef = Schema.Struct({
  surface: SfSurface, type: Schema.String, id: Schema.String, incarnation: Schema.String,
  version: SfNonNegative, fields: Schema.Array(Schema.String), period: SfPeriod, observedAt: Schema.String,
})

const SfDigestSha256 = Schema.Struct({ algorithm: Schema.Literal("sha256"), value: Schema.String })
const SfDigestBlake3 = Schema.Struct({ algorithm: Schema.Literal("blake3"), value: Schema.String })
const SfEvidenceIdentity = {
  schema: Schema.Literal("sf-evidence-v1"), refId: SfNonEmpty,
  installationId: SfNonEmpty, projectId: SfNonEmpty, refDigest: Schema.String,
  evidenceLevel: Schema.Literals(["observed", "claim", "assumption", "proposal", "decision"]),
}
export type SfEvidence = {
  readonly schema: "sf-evidence-v1"
  readonly refId: string
  readonly installationId: string
  readonly projectId: string
  readonly refDigest: string
  readonly evidenceLevel: "observed" | "claim" | "assumption" | "proposal" | "decision"
} & (
  | { readonly kind: "record"; readonly target: {
      readonly surface: "dashboard" | "planner" | "procurement"; readonly recordType: string
      readonly recordId: string; readonly incarnation: string; readonly version: number
      readonly fields: readonly string[]; readonly period?: { readonly start: string; readonly end: string }
      readonly projectionDigest: string
    } }
  | { readonly kind: "document"; readonly target: {
      readonly documentId: string; readonly incarnation: string; readonly revision: number
      readonly blobDigest: {readonly algorithm: "sha256"; readonly value: string}
      readonly segment: {readonly start: number; readonly end: number; readonly unit: "utf16"; readonly textDigest: {readonly algorithm: "sha256"; readonly value: string}}
      readonly ragSourceId?: string; readonly ragRevisionId?: string
      readonly ragSourceHash?: {readonly algorithm: "blake3"; readonly value: string}
      readonly fieldCandidateId?: string; readonly confirmationVersion?: number
    } }
  | { readonly kind: "calculation"; readonly target: {
      readonly calculationId: string; readonly runId: string; readonly engineVersion: string
      readonly inputDigest: string; readonly resultDigest: string; readonly sourceRefs: readonly SfEvidence[]
      readonly period: {readonly start: string; readonly end: string}; readonly currency: string
    } }
  | { readonly kind: "receipt"; readonly target: {
      readonly surface: "dashboard" | "planner" | "procurement"; readonly receiptId: string
      readonly idempotencyKey: string; readonly targetIncarnation: string; readonly commandDigest: string; readonly version: number
    } }
  | { readonly kind: "case-event"; readonly target: {
      readonly caseId: string; readonly caseIncarnation: string; readonly caseVersion: number
      readonly eventId: string; readonly outputDigest: string; readonly evidenceRefs: readonly SfEvidence[]
    } }
  | { readonly kind: "policy"; readonly target: {
      readonly packageId: string; readonly version: string; readonly sourceDigest: string
      readonly ruleId: string; readonly reviewRef: string; readonly scope: string
    } }
)

/** Recursion exists only in source evidence dependencies, never in generic RPC. */
export const SfEvidenceRef: Schema.Codec<SfEvidence> = Schema.suspend(() => Schema.Union([
  Schema.Struct({
    ...SfEvidenceIdentity, kind: Schema.Literal("record"),
    target: Schema.Struct({
      surface: SfSurface, recordType: Schema.String, recordId: Schema.String,
      incarnation: Schema.String, version: SfNonNegative, fields: Schema.Array(Schema.String),
      period: Schema.optional(SfPeriod), projectionDigest: Schema.String,
    }),
  }),
  Schema.Struct({
    ...SfEvidenceIdentity, kind: Schema.Literal("document"),
    target: Schema.Struct({
      documentId: Schema.String, incarnation: Schema.String, revision: SfNonNegative,
      blobDigest: SfDigestSha256,
      segment: Schema.Struct({
        start: SfNonNegative, end: SfNonNegative, unit: Schema.Literal("utf16"),
        textDigest: SfDigestSha256,
      }),
      ragSourceId: Schema.optional(Schema.String),
      ragRevisionId: Schema.optional(Schema.String),
      ragSourceHash: Schema.optional(SfDigestBlake3),
      fieldCandidateId: Schema.optional(Schema.String),
      confirmationVersion: Schema.optional(SfNonNegative),
    }),
  }),
  Schema.Struct({
    ...SfEvidenceIdentity, kind: Schema.Literal("calculation"),
    target: Schema.Struct({
      calculationId: Schema.String, runId: Schema.String, engineVersion: Schema.String,
      inputDigest: Schema.String, resultDigest: Schema.String,
      sourceRefs: Schema.Array(SfEvidenceRef), period: SfPeriod, currency: Schema.String,
    }),
  }),
  Schema.Struct({
    ...SfEvidenceIdentity, kind: Schema.Literal("receipt"),
    target: Schema.Struct({
      surface: SfSurface, receiptId: Schema.String, idempotencyKey: Schema.String,
      targetIncarnation: Schema.String, commandDigest: Schema.String, version: SfNonNegative,
    }),
  }),
  Schema.Struct({
    ...SfEvidenceIdentity, kind: Schema.Literal("case-event"),
    target: Schema.Struct({
      caseId: Schema.String, caseIncarnation: Schema.String, caseVersion: SfNonNegative,
      eventId: Schema.String, outputDigest: Schema.String,
      evidenceRefs: Schema.Array(SfEvidenceRef),
    }),
  }),
  Schema.Struct({
    ...SfEvidenceIdentity, kind: Schema.Literal("policy"),
    target: Schema.Struct({
      packageId: Schema.String, version: Schema.String, sourceDigest: Schema.String,
      ruleId: Schema.String, reviewRef: Schema.String, scope: Schema.String,
    }),
  }),
]))

export const SfRecordEvidence = Schema.Struct({
  ...SfEvidenceIdentity, kind: Schema.Literal("record"),
  target: Schema.Struct({
    surface: SfSurface, recordType: Schema.String, recordId: Schema.String,
    incarnation: Schema.String, version: SfNonNegative, fields: Schema.Array(Schema.String),
    period: Schema.optional(SfPeriod), projectionDigest: Schema.String,
  }),
})

export const SfProductContext = Schema.Struct({
  installationId: Schema.String, projectId: Schema.String, principalRef: Schema.String,
  accessRevision: Schema.String, policyVersion: Schema.String, surface: SfSurface,
  period: SfPeriod, currency: Schema.String, sourceRefs: Schema.Array(SfSourceRef),
  capabilities: Schema.Array(Schema.String),
})
export const SfProjectionComponent = Schema.Struct({
  id: Schema.String, amount: SfAmount, currency: Schema.String, period: SfPeriod,
  sourceRefs: Schema.Array(SfSourceRef),
  evidenceState: Schema.Literals(["confirmed", "estimated", "hypothetical", "absent"]),
})
export const SfProjectionValue = Schema.Struct({
  id: Schema.String, value: Schema.Union([Schema.String, Schema.Finite, Schema.Boolean, Schema.Null]),
  unit: Schema.optional(Schema.String), currency: Schema.optional(Schema.String),
  period: SfPeriod, granularity: Schema.Literals(["record", "month", "year", "aggregate"]),
  sourceRefs: Schema.Array(SfEvidenceRef), drilldown: Schema.NullOr(SfEvidenceRef),
  evidenceState: Schema.Literals(["confirmed", "estimated", "hypothetical", "absent"]),
})
const SfCoverageEntry = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("included"), categoryId: Schema.String,
    componentRefs: Schema.Array(Schema.String), evidenceRefs: Schema.Array(SfEvidenceRef),
    scopeNote: Schema.String,
  }),
  Schema.Struct({
    status: Schema.Literal("not-applicable"), categoryId: Schema.String,
    justification: Schema.String, evidenceRefs: Schema.Array(SfEvidenceRef),
  }),
  Schema.Struct({
    status: Schema.Literal("pending"), categoryId: Schema.String, reason: Schema.String,
    questionRef: Schema.optional(Schema.String),
  }),
])
const SfCoverageWithoutPending = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("included"), categoryId: Schema.String,
    componentRefs: Schema.Array(Schema.String), evidenceRefs: Schema.Array(SfEvidenceRef),
    scopeNote: Schema.String,
  }),
  Schema.Struct({
    status: Schema.Literal("not-applicable"), categoryId: Schema.String,
    justification: Schema.String, evidenceRefs: Schema.Array(SfEvidenceRef),
  }),
])
const SfCoverageBase = {
  basisId: Schema.String, basisVersion: SfNonNegative,
  alternativeId: Schema.String, alternativeVersion: SfNonNegative,
  currency: Schema.String, horizon: SfPeriod, issues: Schema.Array(Schema.String),
  evaluatedSourceRefs: Schema.Array(SfEvidenceRef),
}
export const SfCostCoverage = Schema.Union([
  Schema.Struct({
    ...SfCoverageBase, coverageState: Schema.Literal("complete"),
    entries: Schema.Array(SfCoverageWithoutPending), derivedMissingCategoryIds: Schema.Tuple([]),
  }),
  Schema.Struct({
    ...SfCoverageBase, coverageState: Schema.Literals(["pending", "unavailable"]),
    entries: Schema.Array(SfCoverageEntry), derivedMissingCategoryIds: Schema.Array(Schema.String),
  }),
])
const SfScenarioBase = {
  id: Schema.String, version: SfNonNegative, components: Schema.Array(SfProjectionComponent),
  currency: Schema.String, horizon: SfPeriod, sourceRefs: Schema.Array(SfEvidenceRef),
  unresolvedConditions: Schema.Array(Schema.String), restrictions: Schema.Array(Schema.String),
}
export const SfScenarioResult = Schema.Union([
  Schema.Struct({
    ...SfScenarioBase, comparisonStatus: Schema.Literal("complete"), costCoverage: SfCostCoverage,
    knownSubtotal: Schema.Finite, total: Schema.Finite,
  }),
  Schema.Struct({
    ...SfScenarioBase, comparisonStatus: Schema.Literals(["conditioned", "incompatible", "unavailable"]),
    costCoverage: SfCostCoverage, knownSubtotal: SfAmount, total: Schema.Null,
  }),
])
const SfComparisonBase = {
  baselineResultRef: Schema.String, alternativeResultRef: Schema.String,
  costCoverageRefs: Schema.Array(Schema.String),
  criterionResults: Schema.Array(Schema.Struct({
    criterionId: Schema.String, state: Schema.Literals(["satisfied", "failed", "unknown"]),
    reason: Schema.String,
  })),
  unresolvedConditions: Schema.Array(Schema.String),
}
export const SfScenarioComparison = Schema.Union([
  Schema.Struct({
    ...SfComparisonBase, comparisonStatus: Schema.Literal("complete"),
    knownDifference: Schema.Finite, completeDifference: Schema.Finite,
  }),
  Schema.Struct({
    ...SfComparisonBase, comparisonStatus: Schema.Literals(["conditioned", "incompatible", "unavailable"]),
    knownDifference: SfAmount, completeDifference: Schema.Null,
  }),
])
const SfSensitivityBase = {
  scenarioRef: Schema.String, parameterRef: Schema.String,
  bounds: Schema.Struct({ minimum: Schema.Finite, maximum: Schema.Finite, steps: Schema.Finite }),
  evaluated: Schema.Array(Schema.Struct({
    parameterValue: Schema.Finite, resultRef: Schema.String, value: SfAmount,
  })),
  threshold: SfAmount,
  unit: Schema.String, parameterUnit: Schema.optional(Schema.String),
  resultUnit: Schema.optional(Schema.String), engineVersion: Schema.String,
  costCoverageRefs: Schema.Array(Schema.String),
  comparisonStatus: Schema.Literals(["complete", "conditioned", "incompatible", "unavailable"]),
  unresolvedConditions: Schema.Array(Schema.String), evidenceRefs: Schema.Array(SfEvidenceRef),
}
export const SfSensitivity = Schema.Struct({
  ...SfSensitivityBase,
  thresholdEvidence: Schema.Union([
    Schema.Struct({ state: Schema.Literal("exact"), value: Schema.Finite, evidenceRefs: Schema.Array(SfEvidenceRef) }),
    Schema.Struct({ state: Schema.Literal("sampled"), interval: Schema.Struct({ minimum: Schema.Finite, maximum: Schema.Finite }), evidenceRefs: Schema.Array(SfEvidenceRef) }),
    Schema.Struct({ state: Schema.Literal("unavailable"), reason: Schema.String }),
  ]),
})
const SfPortfolioCombination = Schema.Struct({
  analysis: Schema.optional(Schema.Struct({
    scenarioResultRef: Schema.String, scenario: SfScenarioResult,
    comparisonRef: Schema.String, comparison: SfScenarioComparison,
  })),
  id: Schema.String, caseRefs: Schema.Array(Schema.String),
  components: Schema.Array(SfProjectionComponent), costCoverageRefs: Schema.Array(Schema.String),
  conflicts: Schema.Array(Schema.String), restrictions: Schema.Array(Schema.String),
  eligibility: Schema.Literals(["eligible-complete", "conditioned", "unavailable", "ineligible"]),
  comparisonStatus: Schema.Literals(["complete", "conditioned", "incompatible", "unavailable"]),
})
export const SfPortfolioResult = Schema.Struct({
  combinations: Schema.Array(SfPortfolioCombination),
  limitations: Schema.Array(Schema.String), evidenceRefs: Schema.Array(SfEvidenceRef),
})
export const SfDomainProjection = Schema.Struct({
  context: SfProductContext, version: SfNonNegative, engineVersion: Schema.String,
  decision: Schema.optional(Schema.Union([
    Schema.Struct({
      kind: Schema.Literal("scenario"), scenarioResultRef: Schema.String,
      scenario: SfScenarioResult, comparisonRef: Schema.String, comparison: SfScenarioComparison,
      sensitivity: Schema.optional(SfSensitivity), sensitivityResultRef: Schema.optional(Schema.String),
    }),
    Schema.Struct({
      kind: Schema.Literal("portfolio"), portfolioResultRef: Schema.String,
      portfolio: SfPortfolioResult,
    }),
  ])),
  comparison: Schema.optional(Schema.Struct({
    metricRef: Schema.String, comparisonRef: Schema.String, context: SfProductContext,
    version: SfNonNegative, engineVersion: Schema.String, values: Schema.Array(SfProjectionValue),
  })),
  components: Schema.Array(SfProjectionComponent),
  values: Schema.Array(SfProjectionValue),
  missing: Schema.Array(Schema.Struct({
    field: Schema.String,
    reason: Schema.Literals([
      "missing", "unavailable", "restricted", "not-applicable", "incompatible-currency",
      "missing-fx", "missing-rate", "unconfirmed",
    ]),
  })),
})

export const SfPortFailure = Schema.Struct({
  status: Schema.Literals(["needs-input", "stale", "denied", "unavailable", "conflict", "provider-conflict", "failed"]),
  reason: Schema.String,
})
/** Source PortResult union: preserves every error status and the exact authorized value. */
export function sfPortResult<Value>(value: Schema.Codec<Value>) {
  return Schema.Union([
    Schema.Struct({ status: Schema.Literal("ok"), value }),
    SfPortFailure,
  ])
}
