import { Schema } from "effect"
import { optional } from "../schema"

// This leaf is a closed projection of memory-http.ts, not an Atlas store or a
// second materiality engine. All permissions and source-digest checks remain in
// the original Request-bound producer.
const closed = { parseOptions: { onExcessProperty: "error" } } as const
const NonBlank = Schema.String.check(Schema.isPattern(/\S/))
const Digest = Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/))
const PositiveVersion = Schema.Int.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER))
const NonNegativeVersion = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER))
const Surface = Schema.Literals(["dashboard", "planner", "procurement"])
const Strings = Schema.Array(Schema.String)
const NonEmptyStrings = Schema.Array(NonBlank).check(Schema.isMinLength(1))
const Period = Schema.Struct({
  start: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)),
  end: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)),
}).annotate(closed)
const CaseRef = Schema.Struct({ id: NonBlank, incarnation: NonBlank, version: PositiveVersion }).annotate(closed)
const CaseQuery = Schema.Struct({ caseId: NonBlank, incarnation: NonBlank, version: PositiveVersion }).annotate(closed)
const SourceRef = Schema.Struct({
  surface: Surface,
  type: NonBlank,
  id: NonBlank,
  incarnation: NonBlank,
  version: NonNegativeVersion,
  fields: NonEmptyStrings,
  period: Period,
  observedAt: NonBlank,
}).annotate(closed)

// The input selections are narrower than a general evidence reference:
// memory-selection.ts requires one observed planner-version record with its
// original target/source identity. Digest equality and current access are
// additionally checked by the server; a schema-valid hash is never a grant.
const PlannerEvidence = Schema.Struct({
  schema: Schema.Literal("sf-evidence-v1"),
  kind: Schema.Literal("record"),
  refId: NonBlank,
  installationId: NonBlank,
  projectId: NonBlank,
  refDigest: Digest,
  evidenceLevel: Schema.Literal("observed"),
  target: Schema.Struct({
    surface: Schema.Literal("planner"),
    recordType: Schema.Literal("planner-version"),
    recordId: NonBlank,
    incarnation: NonBlank,
    version: PositiveVersion,
    fields: NonEmptyStrings,
    period: Period,
    projectionDigest: Digest,
  }).annotate(closed),
}).annotate(closed)
const PlannerSource = Schema.Struct({
  surface: Schema.Literal("planner"),
  type: Schema.Literal("planner-version"),
  id: NonBlank,
  incarnation: NonBlank,
  version: PositiveVersion,
  fields: NonEmptyStrings,
  period: Period,
  observedAt: NonBlank,
}).annotate(closed)
const ConditionSelection = Schema.Struct({
  caseRef: CaseRef,
  choiceId: NonBlank,
  scenarioRefs: Schema.Tuple([NonBlank, NonBlank]),
  source: PlannerSource,
  evidence: PlannerEvidence,
  fields: NonEmptyStrings,
  period: Period,
  criterionId: NonBlank,
  recipientRef: NonBlank,
  destination: NonBlank,
  label: NonBlank,
}).annotate(closed)
const OutcomeSelection = Schema.Struct({
  caseRef: CaseRef,
  choiceId: NonBlank,
  criterionRef: NonBlank,
  valueId: NonBlank,
  period: Period,
  evidenceRefs: Schema.Tuple([PlannerEvidence]),
}).annotate(closed)

// The read side can reference any canonical business evidence kind. Do not
// truncate it to planner records: materiality, choices and observed outcomes
// retain original linked sources, including recursively linked evidence.
type EvidenceIdentity = Readonly<{
  schema: "sf-evidence-v1"
  refId: string
  installationId: string
  projectId: string
  refDigest: string
  evidenceLevel: "observed" | "claim" | "assumption" | "proposal" | "decision"
}>
type EvidencePeriod = Readonly<{ start: string; end: string }>
type EvidenceSurface = "dashboard" | "planner" | "procurement"
export type SfMemoryEvidenceRef = EvidenceIdentity & (
  | Readonly<{ kind: "record"; target: Readonly<{
    surface: EvidenceSurface; recordType: string; recordId: string; incarnation: string
    version: number; fields: readonly string[]; period?: EvidencePeriod; projectionDigest: string
  }> }>
  | Readonly<{ kind: "document"; target: Readonly<{
    documentId: string; incarnation: string; revision: number
    blobDigest: Readonly<{ algorithm: "sha256"; value: string }>
    segment: Readonly<{ start: number; end: number; unit: "utf16"; textDigest: Readonly<{ algorithm: "sha256"; value: string }> }>
    ragSourceId?: string; ragRevisionId?: string; ragSourceHash?: Readonly<{ algorithm: "blake3"; value: string }>
    fieldCandidateId?: string; confirmationVersion?: number
  }> }>
  | Readonly<{ kind: "calculation"; target: Readonly<{
    calculationId: string; runId: string; engineVersion: string; inputDigest: string; resultDigest: string
    sourceRefs: readonly SfMemoryEvidenceRef[]; period: EvidencePeriod; currency: string
  }> }>
  | Readonly<{ kind: "receipt"; target: Readonly<{
    surface: EvidenceSurface; receiptId: string; idempotencyKey: string
    targetIncarnation: string; commandDigest: string; version: number
  }> }>
  | Readonly<{ kind: "case-event"; target: Readonly<{
    caseId: string; caseIncarnation: string; caseVersion: number; eventId: string
    outputDigest: string; evidenceRefs: readonly SfMemoryEvidenceRef[]
  }> }>
  | Readonly<{ kind: "policy"; target: Readonly<{
    packageId: string; version: string; sourceDigest: string; ruleId: string; reviewRef: string; scope: string
  }> }>
)
const EvidenceBase = {
  schema: Schema.Literal("sf-evidence-v1"),
  refId: NonBlank,
  installationId: NonBlank,
  projectId: NonBlank,
  refDigest: Digest,
  evidenceLevel: Schema.Literals(["observed", "claim", "assumption", "proposal", "decision"]),
}
const EvidenceRef: Schema.Schema<SfMemoryEvidenceRef> = Schema.suspend(() => Schema.Union([
  Schema.Struct({
    ...EvidenceBase,
    kind: Schema.Literal("record"),
    target: Schema.Struct({
      surface: Surface, recordType: NonBlank, recordId: NonBlank, incarnation: NonBlank,
      version: NonNegativeVersion, fields: Strings, period: Period.pipe(optional), projectionDigest: Digest,
    }).annotate(closed),
  }).annotate(closed),
  Schema.Struct({
    ...EvidenceBase,
    kind: Schema.Literal("document"),
    target: Schema.Struct({
      documentId: NonBlank, incarnation: NonBlank, revision: NonNegativeVersion,
      blobDigest: Schema.Struct({ algorithm: Schema.Literal("sha256"), value: Digest }).annotate(closed),
      segment: Schema.Struct({
        start: NonNegativeVersion, end: NonNegativeVersion, unit: Schema.Literal("utf16"),
        textDigest: Schema.Struct({ algorithm: Schema.Literal("sha256"), value: Digest }).annotate(closed),
      }).annotate(closed),
      ragSourceId: NonBlank.pipe(optional),
      ragRevisionId: NonBlank.pipe(optional),
      ragSourceHash: Schema.Struct({ algorithm: Schema.Literal("blake3"), value: NonBlank }).annotate(closed).pipe(optional),
      fieldCandidateId: NonBlank.pipe(optional),
      confirmationVersion: NonNegativeVersion.pipe(optional),
    }).annotate(closed),
  }).annotate(closed),
  Schema.Struct({
    ...EvidenceBase,
    kind: Schema.Literal("calculation"),
    target: Schema.Struct({
      calculationId: NonBlank, runId: NonBlank, engineVersion: NonBlank,
      inputDigest: NonBlank, resultDigest: NonBlank,
      sourceRefs: Schema.Array(EvidenceRef), period: Period, currency: NonBlank,
    }).annotate(closed),
  }).annotate(closed),
  Schema.Struct({
    ...EvidenceBase,
    kind: Schema.Literal("receipt"),
    target: Schema.Struct({
      surface: Surface, receiptId: NonBlank, idempotencyKey: NonBlank,
      targetIncarnation: NonBlank, commandDigest: NonBlank, version: NonNegativeVersion,
    }).annotate(closed),
  }).annotate(closed),
  Schema.Struct({
    ...EvidenceBase,
    kind: Schema.Literal("case-event"),
    target: Schema.Struct({
      caseId: NonBlank, caseIncarnation: NonBlank, caseVersion: NonNegativeVersion,
      eventId: NonBlank, outputDigest: NonBlank, evidenceRefs: Schema.Array(EvidenceRef),
    }).annotate(closed),
  }).annotate(closed),
  Schema.Struct({
    ...EvidenceBase,
    kind: Schema.Literal("policy"),
    target: Schema.Struct({
      packageId: NonBlank, version: NonBlank, sourceDigest: NonBlank, ruleId: NonBlank,
      reviewRef: NonBlank, scope: NonBlank,
    }).annotate(closed),
  }).annotate(closed),
]))

const CostEntryComplete = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("included"), categoryId: NonBlank, componentRefs: NonEmptyStrings,
    evidenceRefs: Schema.Array(EvidenceRef), scopeNote: Schema.String,
  }).annotate(closed),
  Schema.Struct({
    status: Schema.Literal("not-applicable"), categoryId: NonBlank,
    justification: NonBlank, evidenceRefs: Schema.Array(EvidenceRef),
  }).annotate(closed),
])
const CostEntryPending = Schema.Struct({
  status: Schema.Literal("pending"), categoryId: NonBlank,
  reason: Schema.String, questionRef: NonBlank.pipe(optional),
}).annotate(closed)
const CoverageBase = {
  basisId: NonBlank,
  basisVersion: NonNegativeVersion,
  alternativeId: NonBlank,
  alternativeVersion: NonNegativeVersion,
  currency: NonBlank,
  horizon: Period,
  issues: Strings,
  evaluatedSourceRefs: Schema.Array(EvidenceRef),
}
const CoverageComplete = Schema.Struct({
  ...CoverageBase,
  coverageState: Schema.Literal("complete"),
  entries: Schema.Array(CostEntryComplete),
  derivedMissingCategoryIds: Strings.check(Schema.isMaxLength(0)),
}).annotate(closed)
const CoverageIncomplete = Schema.Struct({
  ...CoverageBase,
  coverageState: Schema.Literals(["pending", "unavailable"]),
  entries: Schema.Array(Schema.Union([CostEntryComplete, CostEntryPending])),
  derivedMissingCategoryIds: Strings,
}).annotate(closed)
const Coverage = Schema.Union([CoverageComplete, CoverageIncomplete])
const Component = Schema.Struct({
  id: NonBlank, amount: Schema.NullOr(Schema.Finite), currency: NonBlank,
  period: Period, sourceRefs: Schema.Array(SourceRef),
  evidenceState: Schema.Literals(["confirmed", "estimated", "hypothetical", "absent"]),
}).annotate(closed)
const ScenarioBase = {
  id: NonBlank, version: NonNegativeVersion, components: Schema.Array(Component),
  currency: NonBlank, horizon: Period, sourceRefs: Schema.Array(EvidenceRef),
  unresolvedConditions: Strings, restrictions: Strings,
}
const ScenarioResult = Schema.Union([
  Schema.Struct({
    ...ScenarioBase, comparisonStatus: Schema.Literal("complete"),
    costCoverage: CoverageComplete, knownSubtotal: Schema.Finite, total: Schema.Finite,
  }).annotate(closed),
  Schema.Struct({
    ...ScenarioBase, comparisonStatus: Schema.Literals(["conditioned", "incompatible", "unavailable"]),
    costCoverage: Coverage, knownSubtotal: Schema.NullOr(Schema.Finite), total: Schema.Null,
  }).annotate(closed),
])
const ComparisonBase = {
  baselineResultRef: NonBlank,
  alternativeResultRef: NonBlank,
  costCoverageRefs: Strings,
  criterionResults: Schema.Array(Schema.Struct({
    criterionId: NonBlank,
    state: Schema.Literals(["satisfied", "failed", "unknown"]),
    reason: Schema.String,
  }).annotate(closed)),
  unresolvedConditions: Strings,
}
const ScenarioComparison = Schema.Union([
  Schema.Struct({
    ...ComparisonBase, comparisonStatus: Schema.Literal("complete"),
    knownDifference: Schema.Finite, completeDifference: Schema.Finite,
  }).annotate(closed),
  Schema.Struct({
    ...ComparisonBase, comparisonStatus: Schema.Literals(["conditioned", "incompatible", "unavailable"]),
    knownDifference: Schema.NullOr(Schema.Finite), completeDifference: Schema.Null,
  }).annotate(closed),
])
const ScenarioRequest = Schema.Struct({
  baseRef: NonBlank,
  operations: Schema.Array(Schema.Struct({
    kind: Schema.Literals(["replace", "defer", "include", "exclude"]),
    targetRef: NonBlank,
    replacementRef: NonBlank.pipe(optional),
    amount: Schema.Finite.pipe(optional),
    currency: NonBlank.pipe(optional),
    period: Period.pipe(optional),
  }).annotate(closed)),
  assumptions: Schema.Array(Schema.Struct({
    id: NonBlank,
    value: Schema.Union([Schema.String, Schema.Finite, Schema.Boolean, Schema.Null]),
    evidenceRefs: Schema.Array(EvidenceRef),
    state: Schema.Literals(["confirmed", "estimated", "hypothetical", "absent"]),
  }).annotate(closed)),
}).annotate(closed)
const ChoiceBase = {
  id: NonBlank, alternativeId: NonBlank,
  alternativeVersion: NonNegativeVersion, basisVersion: NonNegativeVersion,
  criteria: Strings,
  values: Schema.Array(Schema.Struct({
    criterionRef: NonBlank, value: Schema.NullOr(Schema.Finite),
    unit: Schema.String, currency: Schema.String, horizon: Period,
  }).annotate(closed)),
  evidenceRefs: Schema.Array(EvidenceRef),
  principalRef: NonBlank, reason: Schema.String, at: Schema.String,
  scenario: ScenarioRequest, result: ScenarioResult, comparison: ScenarioComparison,
}
const Choice = Schema.Union([
  Schema.Struct({
    ...ChoiceBase, comparisonStatus: Schema.Literal("complete"), costCoverage: CoverageComplete,
  }).annotate(closed),
  Schema.Struct({
    ...ChoiceBase, comparisonStatus: Schema.Literals(["conditioned", "incompatible", "unavailable"]),
    costCoverage: Coverage,
  }).annotate(closed),
])
const MaterialChange = Schema.Struct({
  source: SourceRef,
  fields: Strings,
  period: Period,
  before: Schema.Array(EvidenceRef),
  after: Schema.Array(EvidenceRef),
  availability: Schema.Literals(["available", "unavailable"]),
  comparison: Schema.Struct({
    before: ScenarioComparison, after: ScenarioComparison,
    resultBefore: ScenarioResult, resultAfter: ScenarioResult,
  }).annotate(closed).pipe(optional),
}).annotate(closed)
const Impact = Schema.Struct({
  id: NonBlank, conditionId: NonBlank, changeDigest: NonBlank,
  state: Schema.Literals(["material", "irrelevant", "unknown"]),
  chosen: Schema.Array(EvidenceRef), current: Schema.Array(EvidenceRef),
  reason: Schema.String,
}).annotate(closed)
const Condition = Schema.Struct({
  id: NonBlank, source: SourceRef, fields: Strings, period: Period,
  criterionId: NonBlank, choice: Choice,
}).annotate(closed)
const ReconsiderationSignal = Schema.Struct({
  correlationKey: NonBlank, conditionId: NonBlank, choiceId: NonBlank,
  severity: Schema.Literals(["reconsider", "unknown"]),
  reason: Schema.String, source: SourceRef,
  before: Schema.Struct({ comparison: ScenarioComparison, result: ScenarioResult }).annotate(closed).pipe(optional),
  after: Schema.Struct({ comparison: ScenarioComparison, result: ScenarioResult }).annotate(closed).pipe(optional),
  originalReason: Schema.String, impact: Impact,
}).annotate(closed)
const Compatibility = Schema.Struct({
  metric: Schema.Boolean, unit: Schema.Boolean, period: Schema.Boolean,
  currency: Schema.Boolean, coverage: Schema.Literals(["complete", "partial", "unknown"]),
  compatible: Schema.Boolean,
}).annotate(closed)
const ErrorWithReason = Schema.Struct({
  status: Schema.Literals(["needs-input", "stale", "denied", "unavailable", "conflict", "provider-conflict", "failed"]),
  reason: Schema.String,
}).annotate(closed)
const BareUnavailable = Schema.Struct({ status: Schema.Literal("unavailable") }).annotate(closed)
const Failure = Schema.Union([ErrorWithReason, BareUnavailable])
const OkMutation = Schema.Struct({ status: Schema.Literal("ok") }).annotate(closed)

export const SfIntelligenceMemoryCatalog = {
  operationId: "intelligence.memory-catalog",
  input: Schema.Undefined,
  output: Schema.Union([
    Schema.Struct({
      status: Schema.Literal("ok"),
      value: Schema.Array(Schema.Literals([
        "planner-conditions", "planner-materiality", "planner-signals", "planner-closed-month-outcomes",
      ])),
    }).annotate(closed),
    Failure,
  ]),
} as const

export const SfIntelligenceMemoryConditions = {
  operationId: "intelligence.memory-conditions",
  input: CaseQuery,
  output: Schema.Union([
    Schema.Struct({
      status: Schema.Literal("ok"),
      value: Schema.Array(Schema.Struct({
        conditionId: NonBlank,
        revision: PositiveVersion,
        choiceId: NonBlank,
        criterionId: NonBlank,
        label: NonBlank,
        period: Period,
      }).annotate(closed)),
    }).annotate(closed),
    Failure,
  ]),
} as const

export const SfIntelligenceMemorySignals = {
  operationId: "intelligence.memory-signals",
  input: CaseQuery,
  output: Schema.Union([
    Schema.Struct({
      status: Schema.Literal("ok"),
      signals: Schema.Array(Schema.Struct({
        label: NonBlank,
        impact: Schema.Struct({
          state: Schema.Literals(["material", "irrelevant", "unknown"]),
          chosen: Schema.Array(EvidenceRef),
          current: Schema.Array(EvidenceRef),
          reason: Schema.String,
        }).annotate(closed),
        action: Schema.Literals(["open", "update", "none"]),
      }).annotate(closed)),
    }).annotate(closed),
    Failure,
  ]),
} as const

export const SfIntelligenceMemoryMateriality = {
  operationId: "intelligence.memory-materiality",
  input: Schema.Struct({ ...CaseQuery.fields, conditionId: NonBlank }).annotate(closed),
  output: Schema.Union([
    Schema.Struct({
      status: Schema.Literal("ok"),
      impact: Impact,
      signal: ReconsiderationSignal.pipe(optional),
      snapshot: Schema.Struct({ condition: Condition, change: MaterialChange }).annotate(closed),
      scope: Schema.Struct({
        source: SourceRef, fields: Strings, period: Period, criterionId: NonBlank, choiceId: NonBlank,
      }).annotate(closed),
    }).annotate(closed),
    Failure,
  ]),
} as const

export const SfIntelligenceMemoryOutcome = {
  operationId: "intelligence.memory-outcome",
  input: Schema.Union([
    Schema.Struct({ ...CaseQuery.fields, choiceId: NonBlank }).annotate(closed),
    Schema.Struct({ selectionRef: Digest }).annotate(closed),
  ]),
  output: Schema.Union([
    Schema.Struct({
      status: Schema.Literal("comparable"),
      caseRef: CaseRef,
      choiceId: NonBlank,
      criterionRef: NonBlank,
      unit: Schema.String,
      currency: Schema.String,
      period: Period,
      expected: Schema.Finite,
      observed: Schema.Finite,
      delta: Schema.Finite,
      compatibility: Compatibility,
      summary: Schema.Struct({
        facts: Strings, pending: Strings, causality: Schema.Literal("not-attributed"),
      }).annotate(closed),
      cutoff: Schema.String,
      sourceRefs: Schema.Array(EvidenceRef),
      baselineRefs: Schema.Array(EvidenceRef),
      limitations: Strings,
      observation: Schema.Struct({
        caseRef: CaseRef,
        expected: Schema.NullOr(Schema.Finite),
        observed: Schema.NullOr(Schema.Finite),
        cutoff: Schema.String,
        currency: Schema.String,
        sourceRefs: Schema.Array(EvidenceRef),
        limitations: Strings,
      }).annotate(closed),
    }).annotate(closed),
    Schema.Struct({
      status: Schema.Literal("unavailable"),
      reason: Schema.String,
      compatibility: Compatibility,
      limitations: Strings,
    }).annotate(closed),
    Failure,
  ]),
} as const

export const SfIntelligenceMemoryCondition = {
  operationId: "intelligence.memory-condition",
  input: ConditionSelection,
  output: Schema.Union([OkMutation, Failure]),
} as const

export const SfIntelligenceMemoryOutcomeSelection = {
  operationId: "intelligence.memory-outcome-selection",
  input: OutcomeSelection,
  output: Schema.Union([Schema.Struct({ status: Schema.Literal("ok"), selectionRef: Digest.pipe(optional) }).annotate(closed), Failure]),
} as const

// These seven literal bindings are the entire memory authorization surface.
// F02/I00 supply the sole transport, registry metadata and admitted codec map.

/**
 * 217 / UI62: additive, read-only projection of the existing CaseRecall/Atlas
 * producer. The operational catalog/codec/HTTP binding is an INERT integration
 * delta for I00/211; no new operation is admitted by this schema alone.
 * Candidates are exact, currently-authorized C09 versions, never owner tokens.
 */
const SimilarCaseInput = Schema.Struct({
  caseId: NonBlank,
  incarnation: NonBlank,
  version: PositiveVersion,
  query: NonBlank,
  period: Period,
  includeHistorical: Schema.Boolean,
  candidates: Schema.Array(CaseRef).check(Schema.isMaxLength(50)),
}).annotate(closed)
const SimilarExplanation = Schema.Struct({
  candidateCaseRef: CaseRef,
  matchedCriteria: Strings,
  currentDifferences: Strings,
  sourceStates: Schema.Array(Schema.Literals(["fresh", "historical", "stale", "revoked", "replaced", "missing", "invalid", "unavailable"])),
  limitations: Strings,
}).annotate(closed)
export const SfIntelligenceMemorySimilarCases = {
  operationId: "intelligence.memory-similar-cases",
  input: SimilarCaseInput,
  output: Schema.Union([
    Schema.Struct({
      status: Schema.Literal("ok"),
      matches: Schema.Array(Schema.Struct({
        caseRef: CaseRef,
        memoryRecordRef: NonBlank,
        explanation: SimilarExplanation,
        evidenceRefs: Schema.Array(EvidenceRef),
      }).annotate(closed)),
      limitations: Strings,
      accessRevision: NonBlank,
      cutoff: Schema.Struct({
        caseRef: CaseRef,
        period: Period,
        includeHistorical: Schema.Boolean,
      }).annotate(closed),
    }).annotate(closed),
    Failure,
  ]),
} as const

export const SfMemory = {
  operations: {
    "intelligence.memory-catalog": SfIntelligenceMemoryCatalog,
    "intelligence.memory-similar-cases": SfIntelligenceMemorySimilarCases,
    "intelligence.memory-conditions": SfIntelligenceMemoryConditions,
    "intelligence.memory-signals": SfIntelligenceMemorySignals,
    "intelligence.memory-materiality": SfIntelligenceMemoryMateriality,
    "intelligence.memory-outcome": SfIntelligenceMemoryOutcome,
    "intelligence.memory-condition": SfIntelligenceMemoryCondition,
    "intelligence.memory-outcome-selection": SfIntelligenceMemoryOutcomeSelection,
  },
} as const
