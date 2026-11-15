/**
 * Browser-safe wire projections of the *existing* Sucafina BI producers.
 *
 * Keep this schema isomorphic to the admitted extended-http JSON response.
 * In particular, a number equal to zero is never absence, and an absent
 * optional field is different from a present null field.
 */
import { Schema } from "effect"
import { optional } from "../../schema"

export const Period = Schema.Struct({
  start: Schema.String,
  end: Schema.String,
})

export const ViewId = Schema.Literals([
  "BI01", "BI02", "BI03", "BI04", "BI05", "BI06", "BI07", "BI08", "BI09", "BI10", "BI11",
])
export const DecisionViewId = Schema.Literals(["BI09", "BI10", "BI11"])
export const CompareViewId = Schema.Literals(["BI01", "BI02", "BI03", "BI04"])
export const Digest = Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/))

export const SourceRef = Schema.Struct({
  surface: Schema.Literals(["dashboard", "planner", "procurement"]),
  type: Schema.String,
  id: Schema.String,
  incarnation: Schema.String,
  version: Schema.Int,
  fields: Schema.Array(Schema.String),
  period: Period,
  observedAt: Schema.String,
})

export type EvidenceRefType = Readonly<{
  schema: "sf-evidence-v1"
  refId: string
  installationId: string
  projectId: string
  refDigest: string
  evidenceLevel: "observed" | "claim" | "assumption" | "proposal" | "decision"
}> & (
  | Readonly<{ kind: "record"; target: Readonly<{
      surface: "dashboard" | "planner" | "procurement"
      recordType: string; recordId: string; incarnation: string; version: number
      fields: readonly string[]; period?: typeof Period.Type; projectionDigest: string
    }> }>
  | Readonly<{ kind: "document"; target: Readonly<{
      documentId: string; incarnation: string; revision: number
      blobDigest: Readonly<{ algorithm: "sha256"; value: string }>
      segment: Readonly<{ start: number; end: number; unit: "utf16"; textDigest: Readonly<{ algorithm: "sha256"; value: string }> }>
      ragSourceId?: string; ragRevisionId?: string
      ragSourceHash?: Readonly<{ algorithm: "blake3"; value: string }>
      fieldCandidateId?: string; confirmationVersion?: number
    }> }>
  | Readonly<{ kind: "calculation"; target: Readonly<{
      calculationId: string; runId: string; engineVersion: string; inputDigest: string
      resultDigest: string; sourceRefs: readonly EvidenceRefType[]; period: typeof Period.Type; currency: string
    }> }>
  | Readonly<{ kind: "receipt"; target: Readonly<{
      surface: "dashboard" | "planner" | "procurement"; receiptId: string
      idempotencyKey: string; targetIncarnation: string; commandDigest: string; version: number
    }> }>
  | Readonly<{ kind: "case-event"; target: Readonly<{
      caseId: string; caseIncarnation: string; caseVersion: number
      eventId: string; outputDigest: string; evidenceRefs: readonly EvidenceRefType[]
    }> }>
  | Readonly<{ kind: "policy"; target: Readonly<{
      packageId: string; version: string; sourceDigest: string; ruleId: string
      reviewRef: string; scope: string
    }> }>
)

const EvidenceBase = Schema.Struct({
  schema: Schema.Literal("sf-evidence-v1"),
  refId: Schema.String,
  installationId: Schema.String,
  projectId: Schema.String,
  refDigest: Schema.String,
  evidenceLevel: Schema.Literals(["observed", "claim", "assumption", "proposal", "decision"]),
})
const Sha256 = Schema.Struct({ algorithm: Schema.Literal("sha256"), value: Schema.String })

// Suspended to preserve exact recursive evidence ancestry without a JSON/Unknown escape hatch.
export const EvidenceRef: Schema.Schema<EvidenceRefType> = Schema.suspend(() => Schema.Union([
  Schema.Struct({
    ...EvidenceBase.fields,
    kind: Schema.Literal("record"),
    target: Schema.Struct({
      surface: Schema.Literals(["dashboard", "planner", "procurement"]),
      recordType: Schema.String,
      recordId: Schema.String,
      incarnation: Schema.String,
      version: Schema.Int,
      fields: Schema.Array(Schema.String),
      period: optional(Period),
      projectionDigest: Schema.String,
    }),
  }),
  Schema.Struct({
    ...EvidenceBase.fields,
    kind: Schema.Literal("document"),
    target: Schema.Struct({
      documentId: Schema.String,
      incarnation: Schema.String,
      revision: Schema.Int,
      blobDigest: Sha256,
      segment: Schema.Struct({ start: Schema.Int, end: Schema.Int, unit: Schema.Literal("utf16"), textDigest: Sha256 }),
      ragSourceId: optional(Schema.String),
      ragRevisionId: optional(Schema.String),
      ragSourceHash: optional(Schema.Struct({ algorithm: Schema.Literal("blake3"), value: Schema.String })),
      fieldCandidateId: optional(Schema.String),
      confirmationVersion: optional(Schema.Int),
    }),
  }),
  Schema.Struct({
    ...EvidenceBase.fields,
    kind: Schema.Literal("calculation"),
    target: Schema.Struct({
      calculationId: Schema.String,
      runId: Schema.String,
      engineVersion: Schema.String,
      inputDigest: Schema.String,
      resultDigest: Schema.String,
      sourceRefs: Schema.Array(EvidenceRef),
      period: Period,
      currency: Schema.String,
    }),
  }),
  Schema.Struct({
    ...EvidenceBase.fields,
    kind: Schema.Literal("receipt"),
    target: Schema.Struct({
      surface: Schema.Literals(["dashboard", "planner", "procurement"]),
      receiptId: Schema.String,
      idempotencyKey: Schema.String,
      targetIncarnation: Schema.String,
      commandDigest: Schema.String,
      version: Schema.Int,
    }),
  }),
  Schema.Struct({
    ...EvidenceBase.fields,
    kind: Schema.Literal("case-event"),
    target: Schema.Struct({
      caseId: Schema.String,
      caseIncarnation: Schema.String,
      caseVersion: Schema.Int,
      eventId: Schema.String,
      outputDigest: Schema.String,
      evidenceRefs: Schema.Array(EvidenceRef),
    }),
  }),
  Schema.Struct({
    ...EvidenceBase.fields,
    kind: Schema.Literal("policy"),
    target: Schema.Struct({
      packageId: Schema.String,
      version: Schema.String,
      sourceDigest: Schema.String,
      ruleId: Schema.String,
      reviewRef: Schema.String,
      scope: Schema.String,
    }),
  }),
]))

export const ProductContext = Schema.Struct({
  installationId: Schema.String,
  projectId: Schema.String,
  principalRef: Schema.String,
  accessRevision: Schema.String,
  policyVersion: Schema.String,
  surface: Schema.Literals(["dashboard", "planner", "procurement"]),
  period: Period,
  currency: Schema.String,
  sourceRefs: Schema.Array(SourceRef),
  capabilities: Schema.Array(Schema.String),
})

export const Component = Schema.Struct({
  id: Schema.String,
  amount: Schema.NullOr(Schema.Finite),
  currency: Schema.String,
  period: Period,
  sourceRefs: Schema.Array(SourceRef),
  evidenceState: Schema.Literals(["confirmed", "estimated", "hypothetical", "absent"]),
})

export const Value = Schema.Struct({
  id: Schema.String,
  value: Schema.Union([Schema.String, Schema.Finite, Schema.Boolean, Schema.Null]),
  unit: optional(Schema.String),
  currency: optional(Schema.String),
  period: Period,
  granularity: Schema.Literals(["record", "month", "year", "aggregate"]),
  sourceRefs: Schema.Array(EvidenceRef),
  drilldown: Schema.NullOr(EvidenceRef),
  evidenceState: Schema.Literals(["confirmed", "estimated", "hypothetical", "absent"]),
})

const CoverageEntryIncluded = Schema.Struct({
  status: Schema.Literal("included"),
  categoryId: Schema.String,
  componentRefs: Schema.Array(Schema.String),
  evidenceRefs: Schema.Array(EvidenceRef),
  scopeNote: Schema.String,
})
const CoverageEntryNotApplicable = Schema.Struct({
  status: Schema.Literal("not-applicable"),
  categoryId: Schema.String,
  justification: Schema.String,
  evidenceRefs: Schema.Array(EvidenceRef),
})
const CoverageEntryPending = Schema.Struct({
  status: Schema.Literal("pending"),
  categoryId: Schema.String,
  reason: Schema.String,
  questionRef: optional(Schema.String),
})
const CoverageBase = Schema.Struct({
  basisId: Schema.String,
  basisVersion: Schema.Int,
  alternativeId: Schema.String,
  alternativeVersion: Schema.Int,
  currency: Schema.String,
  horizon: Period,
  issues: Schema.Array(Schema.String),
  evaluatedSourceRefs: Schema.Array(EvidenceRef),
})
const CoverageComplete = Schema.Struct({
  ...CoverageBase.fields,
  coverageState: Schema.Literal("complete"),
  entries: Schema.Array(Schema.Union([CoverageEntryIncluded, CoverageEntryNotApplicable])),
  derivedMissingCategoryIds: Schema.Tuple([]),
})
const CoveragePending = Schema.Struct({
  ...CoverageBase.fields,
  coverageState: Schema.Literals(["pending", "unavailable"]),
  entries: Schema.Array(Schema.Union([CoverageEntryIncluded, CoverageEntryNotApplicable, CoverageEntryPending])),
  derivedMissingCategoryIds: Schema.Array(Schema.String),
})
const Coverage = Schema.Union([CoverageComplete, CoveragePending])

const ScenarioBase = Schema.Struct({
  id: Schema.String,
  version: Schema.Int,
  components: Schema.Array(Component),
  currency: Schema.String,
  horizon: Period,
  sourceRefs: Schema.Array(EvidenceRef),
  unresolvedConditions: Schema.Array(Schema.String),
  restrictions: Schema.Array(Schema.String),
})
const Scenario = Schema.Union([
  Schema.Struct({
    ...ScenarioBase.fields,
    comparisonStatus: Schema.Literal("complete"),
    costCoverage: CoverageComplete,
    knownSubtotal: Schema.Finite,
    total: Schema.Finite,
  }),
  Schema.Struct({
    ...ScenarioBase.fields,
    comparisonStatus: Schema.Literals(["conditioned", "incompatible", "unavailable"]),
    costCoverage: Coverage,
    knownSubtotal: Schema.NullOr(Schema.Finite),
    total: Schema.Null,
  }),
])
const ComparisonBase = Schema.Struct({
  baselineResultRef: Schema.String,
  alternativeResultRef: Schema.String,
  costCoverageRefs: Schema.Array(Schema.String),
  criterionResults: Schema.Array(Schema.Struct({
    criterionId: Schema.String,
    state: Schema.Literals(["satisfied", "failed", "unknown"]),
    reason: Schema.String,
  })),
  unresolvedConditions: Schema.Array(Schema.String),
})
const Comparison = Schema.Union([
  Schema.Struct({
    ...ComparisonBase.fields,
    comparisonStatus: Schema.Literal("complete"),
    knownDifference: Schema.Finite,
    completeDifference: Schema.Finite,
  }),
  Schema.Struct({
    ...ComparisonBase.fields,
    comparisonStatus: Schema.Literals(["conditioned", "incompatible", "unavailable"]),
    knownDifference: Schema.NullOr(Schema.Finite),
    completeDifference: Schema.Null,
  }),
])
const UnresolvedCondition = Schema.Struct({
  id: Schema.String,
  category: Schema.String,
  reason: Schema.String,
  evidenceRefs: Schema.Array(EvidenceRef),
  questionRef: optional(Schema.String),
})
const Sensitivity = Schema.Struct({
  scenarioRef: Schema.String,
  parameterRef: Schema.String,
  bounds: Schema.Struct({ minimum: Schema.Finite, maximum: Schema.Finite, steps: Schema.Int }),
  evaluated: Schema.Array(Schema.Struct({
    parameterValue: Schema.Finite,
    resultRef: Schema.String,
    value: Schema.NullOr(Schema.Finite),
  })),
  threshold: Schema.NullOr(Schema.Finite),
  thresholdEvidence: Schema.Union([
    Schema.Struct({ state: Schema.Literal("exact"), value: Schema.Finite, evidenceRefs: Schema.Array(EvidenceRef) }),
    Schema.Struct({ state: Schema.Literal("sampled"), interval: Schema.Struct({ minimum: Schema.Finite, maximum: Schema.Finite }), evidenceRefs: Schema.Array(EvidenceRef) }),
    Schema.Struct({ state: Schema.Literal("unavailable"), reason: Schema.String }),
  ]),
  unit: Schema.String,
  parameterUnit: optional(Schema.String),
  resultUnit: optional(Schema.String),
  engineVersion: Schema.String,
  costCoverageRefs: Schema.Array(Schema.String),
  comparisonStatus: Schema.Literals(["complete", "conditioned", "incompatible", "unavailable"]),
  unresolvedConditions: Schema.Array(UnresolvedCondition),
  evidenceRefs: Schema.Array(EvidenceRef),
})

const CombinationBase = Schema.Struct({
  analysis: optional(Schema.Struct({ scenarioResultRef: Schema.String, scenario: Scenario, comparisonRef: Schema.String, comparison: Comparison })),
  id: Schema.String,
  caseRefs: Schema.Array(Schema.String),
  components: Schema.Array(Component),
  costCoverageRefs: Schema.Array(Schema.String),
  conflicts: Schema.Array(Schema.String),
  restrictions: Schema.Array(Schema.String),
})
const Combination = Schema.Union([
  Schema.Struct({ ...CombinationBase.fields, eligibility: Schema.Literal("eligible-complete"), comparisonStatus: Schema.Literal("complete") }),
  Schema.Struct({ ...CombinationBase.fields, eligibility: Schema.Literal("conditioned"), comparisonStatus: Schema.Literals(["complete", "conditioned", "incompatible", "unavailable"]) }),
  Schema.Struct({ ...CombinationBase.fields, eligibility: Schema.Literal("unavailable"), comparisonStatus: Schema.Literals(["conditioned", "incompatible", "unavailable"]) }),
  Schema.Struct({ ...CombinationBase.fields, eligibility: Schema.Literal("ineligible"), comparisonStatus: Schema.Literals(["complete", "conditioned", "incompatible", "unavailable"]) }),
])
const Portfolio = Schema.Struct({
  combinations: Schema.Array(Combination),
  limitations: Schema.Array(Schema.String),
  evidenceRefs: Schema.Array(EvidenceRef),
})

export const Projection = Schema.Struct({
  context: ProductContext,
  version: Schema.Int,
  engineVersion: Schema.String,
  decision: optional(Schema.Union([
    Schema.Struct({
      kind: Schema.Literal("scenario"),
      scenarioResultRef: Schema.String,
      scenario: Scenario,
      comparisonRef: Schema.String,
      comparison: Comparison,
      sensitivity: optional(Sensitivity),
      sensitivityResultRef: optional(Schema.String),
    }),
    Schema.Struct({ kind: Schema.Literal("portfolio"), portfolioResultRef: Schema.String, portfolio: Portfolio }),
  ])),
  comparison: optional(Schema.Struct({
    metricRef: Schema.String,
    comparisonRef: Schema.String,
    context: ProductContext,
    version: Schema.Int,
    engineVersion: Schema.String,
    values: Schema.Array(Value),
  })),
  components: Schema.Array(Component),
  values: Schema.Array(Value),
  missing: Schema.Array(Schema.Struct({
    field: Schema.String,
    reason: Schema.Literals([
      "missing", "unavailable", "restricted", "not-applicable", "incompatible-currency", "missing-fx", "missing-rate", "unconfirmed",
    ]),
  })),
})

export const Request = Schema.Struct({
  viewId: Schema.String,
  selectionRef: Schema.String,
  period: Period,
})

export const Presentation = Schema.Struct({
  viewId: ViewId,
  series: Schema.Array(Schema.Struct({
    id: Schema.String,
    label: Schema.String,
    unit: Schema.String,
    role: Schema.Literals([
      "budget", "actual", "outlook", "baseline", "contribution", "result", "fte",
      "cost", "stock", "aging", "opened", "closed", "planned", "completed", "sensitivity", "other",
    ]),
    valueIds: Schema.Array(Schema.String),
    alignmentKeys: optional(Schema.Array(Schema.String)),
  })),
  limitations: Schema.Array(Schema.String),
  waterfall: optional(Schema.Struct({
    segments: Schema.Array(Schema.Struct({
      label: Schema.String,
      startValueId: Schema.String,
      endValueId: Schema.String,
      componentValueId: Schema.String,
    })),
    finalValueId: Schema.String,
    reconciliation: Schema.Literals(["reconciled", "unreconciled", "unavailable"]),
  })),
  timeline: optional(Schema.Struct({
    items: Schema.Array(Schema.Struct({
      label: Schema.String, dateValueId: Schema.String,
      state: Schema.Literals(["planned", "completed", "unknown"]),
    })),
  })),
})

export const Receipt = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("ui"),
    operation: Schema.String,
    handlerExport: Schema.String,
    inputDigest: Schema.String,
    resultDigest: optional(Schema.String),
    principalRef: Schema.String,
    callId: Schema.String,
    accessRevision: Schema.String,
    at: Schema.String,
    requestId: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("native"),
    operation: Schema.String,
    handlerExport: Schema.String,
    inputDigest: Schema.String,
    resultDigest: optional(Schema.String),
    principalRef: Schema.String,
    callId: Schema.String,
    accessRevision: Schema.String,
    at: Schema.String,
    runId: Schema.String,
    nativeSessionId: Schema.String,
    providerGeneration: Schema.Int,
  }),
])

export const Navigation = Schema.Struct({
  snapshot: Schema.String,
  entries: Schema.Array(Schema.Struct({
    kind: Schema.Literals(["source", "evidence", "coverage", "question", "result", "case"]),
    key: Schema.String,
    token: Schema.String,
  })),
})
export const NavigationDetail = Schema.Struct({
  title: Schema.String,
  reference: Schema.String,
  facts: Schema.Array(Schema.Struct({ label: Schema.String, value: Schema.String })),
  tables: Schema.Array(Schema.Struct({
    title: Schema.String,
    columns: Schema.Array(Schema.String),
    rows: Schema.Array(Schema.Array(Schema.String)),
  })),
  links: Schema.Array(Schema.Struct({ label: Schema.String, url: Schema.String })),
})
export const Options = Schema.Struct({
  choices: Schema.Array(Schema.Struct({
    label: Schema.String,
    selectionRef: Schema.String,
    caseRef: optional(Schema.Struct({ id: Schema.String, incarnation: Schema.String, version: Schema.Int })),
  })),
  versions: Schema.Array(Schema.Struct({ ref: Schema.String, label: Schema.String, year: Schema.Int })),
  links: Schema.Array(Schema.Struct({
    label: Schema.String,
    surface: Schema.Literals(["planner", "procurement", "dashboard"]),
    page: Schema.String,
  })),
  limitations: Schema.Array(Schema.String),
})

export const Failure = Schema.Struct({
  status: Schema.Literals(["needs-input", "stale", "denied", "unavailable", "conflict", "provider-conflict", "failed", "invalid"]),
  reason: Schema.String,
})
