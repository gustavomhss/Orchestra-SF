import { Option, Schema, SchemaGetter } from "effect"
import { NonNegativeInt, PositiveInt, optional } from "../schema"

/**
 * A05: browser-safe, source-locked portfolio bindings.
 *
 * The admitted host is apps/cli/src/sucafina-product/portfolio-http.ts
 * (blob 6cbfc373ea72a90351e4f9997f65663e0f5fc775). These schemas describe
 * the existing JSON envelope; they neither authorize a call nor calculate money.
 */
const Text = Schema.String.check(Schema.isNonEmpty(), Schema.isMaxLength(16_384))
const Digest = Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/))
const Day = Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/))
const Finite = Schema.Finite
const Texts = Schema.Array(Text)
const Period = Schema.Struct({ start: Day, end: Day })
const Surface = Schema.Literals(["dashboard", "planner", "procurement"])
const Status = Schema.Literals(["complete", "conditioned", "incompatible", "unavailable"])
const EvidenceState = Schema.Literals(["confirmed", "estimated", "hypothetical", "absent"])
const CaseRef = Schema.Struct({ id: Text, incarnation: Text, version: PositiveInt })

// Evidence is a recursively closed, versioned domain union, not a redacted
// arbitrary object. A reference is never an access grant.
type EvidenceRefType = Readonly<{
  schema: "sf-evidence-v1"
  refId: string
  installationId: string
  projectId: string
  refDigest: string
  evidenceLevel: "observed" | "claim" | "assumption" | "proposal" | "decision"
}> & (
  | Readonly<{ kind: "record"; target: Readonly<{ surface: "dashboard" | "planner" | "procurement"; recordType: string; recordId: string; incarnation: string; version: number; fields: readonly string[]; period?: Readonly<{ start: string; end: string }>; projectionDigest: string }> }>
  | Readonly<{ kind: "document"; target: Readonly<{ documentId: string; incarnation: string; revision: number; blobDigest: Readonly<{ algorithm: "sha256"; value: string }>; segment: Readonly<{ start: number; end: number; unit: "utf16"; textDigest: Readonly<{ algorithm: "sha256"; value: string }> }>; ragSourceId?: string; ragRevisionId?: string; ragSourceHash?: Readonly<{ algorithm: "blake3"; value: string }>; fieldCandidateId?: string; confirmationVersion?: number }> }>
  | Readonly<{ kind: "calculation"; target: Readonly<{ calculationId: string; runId: string; engineVersion: string; inputDigest: string; resultDigest: string; sourceRefs: readonly EvidenceRefType[]; period: Readonly<{ start: string; end: string }>; currency: string }> }>
  | Readonly<{ kind: "receipt"; target: Readonly<{ surface: "dashboard" | "planner" | "procurement"; receiptId: string; idempotencyKey: string; targetIncarnation: string; commandDigest: string; version: number }> }>
  | Readonly<{ kind: "case-event"; target: Readonly<{ caseId: string; caseIncarnation: string; caseVersion: number; eventId: string; outputDigest: string; evidenceRefs: readonly EvidenceRefType[] }> }>
  | Readonly<{ kind: "policy"; target: Readonly<{ packageId: string; version: string; sourceDigest: string; ruleId: string; reviewRef: string; scope: string }> }>
)

const EvidenceBase = {
  schema: Schema.Literals(["sf-evidence-v1"]),
  refId: Text,
  installationId: Text,
  projectId: Text,
  refDigest: Digest,
  evidenceLevel: Schema.Literals(["observed", "claim", "assumption", "proposal", "decision"]),
}
const Sha256 = Schema.Struct({ algorithm: Schema.Literals(["sha256"]), value: Digest })
const EvidenceRef: Schema.Schema<EvidenceRefType> = Schema.suspend(() => Schema.Union([
  Schema.Struct({ ...EvidenceBase, kind: Schema.Literals(["record"]), target: Schema.Struct({
    surface: Surface, recordType: Text, recordId: Text, incarnation: Text, version: NonNegativeInt,
    fields: Texts, period: Period.pipe(optional), projectionDigest: Digest,
  }) }),
  Schema.Struct({ ...EvidenceBase, kind: Schema.Literals(["document"]), target: Schema.Struct({
    documentId: Text, incarnation: Text, revision: NonNegativeInt, blobDigest: Sha256,
    segment: Schema.Struct({ start: NonNegativeInt, end: NonNegativeInt, unit: Schema.Literals(["utf16"]), textDigest: Sha256 }),
    ragSourceId: Text.pipe(optional), ragRevisionId: Text.pipe(optional),
    ragSourceHash: Schema.Struct({ algorithm: Schema.Literals(["blake3"]), value: Text }).pipe(optional),
    fieldCandidateId: Text.pipe(optional), confirmationVersion: NonNegativeInt.pipe(optional),
  }) }),
  Schema.Struct({ ...EvidenceBase, kind: Schema.Literals(["calculation"]), target: Schema.Struct({
    calculationId: Text, runId: Text, engineVersion: Text, inputDigest: Digest, resultDigest: Digest,
    sourceRefs: Schema.Array(EvidenceRef), period: Period, currency: Text,
  }) }),
  Schema.Struct({ ...EvidenceBase, kind: Schema.Literals(["receipt"]), target: Schema.Struct({
    surface: Surface, receiptId: Text, idempotencyKey: Text, targetIncarnation: Text, commandDigest: Digest, version: NonNegativeInt,
  }) }),
  Schema.Struct({ ...EvidenceBase, kind: Schema.Literals(["case-event"]), target: Schema.Struct({
    caseId: Text, caseIncarnation: Text, caseVersion: PositiveInt, eventId: Text, outputDigest: Digest, evidenceRefs: Schema.Array(EvidenceRef),
  }) }),
  Schema.Struct({ ...EvidenceBase, kind: Schema.Literals(["policy"]), target: Schema.Struct({
    packageId: Text, version: Text, sourceDigest: Digest, ruleId: Text, reviewRef: Text, scope: Text,
  }) }),
]))

const SourceRef = Schema.Struct({
  surface: Surface, type: Text, id: Text, incarnation: Text, version: NonNegativeInt,
  fields: Texts, period: Period, observedAt: Text,
})
const Component = Schema.Struct({
  id: Text, amount: Schema.NullOr(Finite), currency: Text, period: Period,
  sourceRefs: Schema.Array(SourceRef), evidenceState: EvidenceState,
})
const ScenarioOperation = Schema.Struct({
  kind: Schema.Literals(["replace", "defer", "include", "exclude"]), targetRef: Text,
  replacementRef: Text.pipe(optional), amount: Finite.pipe(optional), currency: Text.pipe(optional), period: Period.pipe(optional),
})
const ScenarioRequest = Schema.Struct({
  baseRef: Text, operations: Schema.Array(ScenarioOperation), assumptions: Schema.Array(Schema.Struct({
    id: Text, value: Schema.Union([Schema.String, Finite, Schema.Boolean, Schema.Null]),
    evidenceRefs: Schema.Array(EvidenceRef), state: EvidenceState,
  })),
})
const PortfolioRequest = Schema.Struct({
  scope: Schema.Struct({ horizon: Period, currency: Text }), candidateRefs: Texts,
  operations: Schema.Array(ScenarioOperation), constraints: Texts, priorities: Texts, explorationLimit: PositiveInt,
})
const SensitivityRequest = Schema.Struct({
  scenarioRef: Text,
  parameterBounds: Schema.Struct({ parameterRef: Text, minimum: Finite, maximum: Finite, steps: PositiveInt }),
  criterion: Schema.Struct({ id: Text, operator: Schema.Literals(["lte", "gte", "eq"]), value: Finite }),
})
const CoverageEntry = Schema.Union([
  Schema.Struct({ status: Schema.Literals(["included"]), categoryId: Text, componentRefs: Texts, evidenceRefs: Schema.Array(EvidenceRef), scopeNote: Schema.String }),
  Schema.Struct({ status: Schema.Literals(["not-applicable"]), categoryId: Text, justification: Text, evidenceRefs: Schema.Array(EvidenceRef) }),
  Schema.Struct({ status: Schema.Literals(["pending"]), categoryId: Text, reason: Text, questionRef: Text.pipe(optional) }),
])
const CoverageBase = {
  basisId: Text, basisVersion: NonNegativeInt, alternativeId: Text, alternativeVersion: NonNegativeInt,
  currency: Text, horizon: Period, issues: Texts, evaluatedSourceRefs: Schema.Array(EvidenceRef),
}
const CoverageComplete = Schema.Struct({ ...CoverageBase, coverageState: Schema.Literals(["complete"]), entries: Schema.Array(Schema.Union([
    Schema.Struct({ status: Schema.Literals(["included"]), categoryId: Text, componentRefs: Texts, evidenceRefs: Schema.Array(EvidenceRef), scopeNote: Schema.String }),
    Schema.Struct({ status: Schema.Literals(["not-applicable"]), categoryId: Text, justification: Text, evidenceRefs: Schema.Array(EvidenceRef) }),
  ])), derivedMissingCategoryIds: Schema.Array(Schema.Never) })
const Coverage = Schema.Union([
  CoverageComplete,
  Schema.Struct({ ...CoverageBase, coverageState: Schema.Literals(["pending", "unavailable"]), entries: Schema.Array(CoverageEntry), derivedMissingCategoryIds: Texts }),
])
const ScenarioBase = {
  id: Text, version: NonNegativeInt, components: Schema.Array(Component), currency: Text, horizon: Period,
  sourceRefs: Schema.Array(EvidenceRef), unresolvedConditions: Texts, restrictions: Texts,
}
const ScenarioResult = Schema.Union([
  Schema.Struct({ ...ScenarioBase, comparisonStatus: Schema.Literals(["complete"]), costCoverage: CoverageComplete, knownSubtotal: Finite, total: Finite }),
  Schema.Struct({ ...ScenarioBase, comparisonStatus: Schema.Literals(["conditioned", "incompatible", "unavailable"]), costCoverage: Coverage, knownSubtotal: Schema.NullOr(Finite), total: Schema.Null }),
])
const ComparisonBase = {
  baselineResultRef: Text, alternativeResultRef: Text, costCoverageRefs: Texts,
  criterionResults: Schema.Array(Schema.Struct({ criterionId: Text, state: Schema.Literals(["satisfied", "failed", "unknown"]), reason: Schema.String })),
  unresolvedConditions: Texts,
}
const Comparison = Schema.Union([
  Schema.Struct({ ...ComparisonBase, comparisonStatus: Schema.Literals(["complete"]), knownDifference: Finite, completeDifference: Finite }),
  Schema.Struct({ ...ComparisonBase, comparisonStatus: Schema.Literals(["conditioned", "incompatible", "unavailable"]), knownDifference: Schema.NullOr(Finite), completeDifference: Schema.Null }),
])
const Analysis = Schema.Struct({ scenarioResultRef: Text, scenario: ScenarioResult, comparisonRef: Text, comparison: Comparison })
const CombinationBase = {
  analysis: Analysis.pipe(optional), id: Digest, caseRefs: Texts, components: Schema.Array(Component),
  costCoverageRefs: Texts, conflicts: Texts, restrictions: Texts,
}
const Combination = Schema.Union([
  Schema.Struct({ ...CombinationBase, eligibility: Schema.Literals(["eligible-complete"]), comparisonStatus: Schema.Literals(["complete"]) }),
  Schema.Struct({ ...CombinationBase, eligibility: Schema.Literals(["conditioned"]), comparisonStatus: Status }),
  Schema.Struct({ ...CombinationBase, eligibility: Schema.Literals(["unavailable"]), comparisonStatus: Schema.Literals(["conditioned", "incompatible", "unavailable"]) }),
  Schema.Struct({ ...CombinationBase, eligibility: Schema.Literals(["ineligible"]), comparisonStatus: Status }),
])
const Portfolio = Schema.Struct({
  combinations: Schema.Array(Combination), limitations: Texts, evidenceRefs: Schema.Array(EvidenceRef),
})
const ThresholdEvidence = Schema.Union([
  Schema.Struct({ state: Schema.Literals(["exact"]), value: Finite, evidenceRefs: Schema.Array(EvidenceRef) }),
  Schema.Struct({ state: Schema.Literals(["sampled"]), interval: Schema.Struct({ minimum: Finite, maximum: Finite }), evidenceRefs: Schema.Array(EvidenceRef) }),
  Schema.Struct({ state: Schema.Literals(["unavailable"]), reason: Text }),
])
const Sensitivity = Schema.Struct({
  scenarioRef: Text, parameterRef: Text, bounds: Schema.Struct({ minimum: Finite, maximum: Finite, steps: PositiveInt }),
  evaluated: Schema.Array(Schema.Struct({ parameterValue: Finite, resultRef: Text, value: Schema.NullOr(Finite) })),
  threshold: Schema.NullOr(Finite), thresholdEvidence: ThresholdEvidence, unit: Text,
  parameterUnit: Text.pipe(optional), resultUnit: Text.pipe(optional), engineVersion: Text,
  costCoverageRefs: Texts, comparisonStatus: Status,
  unresolvedConditions: Schema.Array(Schema.Struct({
    id: Text, category: Text, reason: Text, evidenceRefs: Schema.Array(EvidenceRef), questionRef: Text.pipe(optional),
  })), evidenceRefs: Schema.Array(EvidenceRef),
})

const ChoiceBase = {
  id: Text, alternativeId: Text, alternativeVersion: NonNegativeInt, basisVersion: NonNegativeInt,
  criteria: Texts,
  values: Schema.Array(Schema.Struct({ criterionRef: Text, value: Schema.NullOr(Finite), unit: Text, currency: Text, horizon: Period })),
  evidenceRefs: Schema.Array(EvidenceRef), principalRef: Text, reason: Text, at: Text,
  scenario: ScenarioRequest, result: ScenarioResult, comparison: Comparison,
}
const Choice = Schema.Union([
  Schema.Struct({ ...ChoiceBase, comparisonStatus: Schema.Literals(["complete"]), costCoverage: CoverageComplete }),
  Schema.Struct({ ...ChoiceBase, comparisonStatus: Schema.Literals(["conditioned", "incompatible", "unavailable"]), costCoverage: Coverage }),
])
const PreparedChange = Schema.Struct({
  id: Text, caseId: Text, caseVersion: NonNegativeInt, choiceId: Text, target: SourceRef,
  expectedVersion: NonNegativeInt, preview: ScenarioResult, requiredAuthority: Texts,
  idempotencyKey: Text, state: Schema.Literals(["planned", "applied", "awaiting-approval", "conflict", "failed", "cancelled"]),
  operationRef: Text, receiptRef: Text.pipe(optional),
})
const Receipt = Schema.Struct({
  id: Text, idempotencyKey: Text, commandDigest: Digest, targetIncarnation: Text, principalRef: Text,
  surface: Surface, version: NonNegativeInt, at: Text,
  status: Schema.Literals(["applied", "awaiting-approval", "conflict", "failed", "cancelled"]),
  resultRef: Text.pipe(optional), errors: Texts,
})
const MaterialChange = Schema.Struct({
  source: SourceRef, fields: Texts, period: Period,
  before: Schema.Array(EvidenceRef), after: Schema.Array(EvidenceRef),
  availability: Schema.Literals(["available", "unavailable"]),
  comparison: Schema.Struct({
    before: Comparison, after: Comparison, resultBefore: ScenarioResult, resultAfter: ScenarioResult,
  }).pipe(optional),
})
const Impact = Schema.Struct({
  id: Text, conditionId: Text, changeDigest: Digest,
  state: Schema.Literals(["material", "irrelevant", "unknown"]),
  chosen: Schema.Array(EvidenceRef), current: Schema.Array(EvidenceRef), reason: Text,
})
const Signal = Schema.Struct({
  correlationKey: Digest, conditionId: Text, choiceId: Text, severity: Schema.Literals(["reconsider", "unknown"]),
  reason: Text, source: SourceRef,
  before: Schema.Struct({ comparison: Comparison, result: ScenarioResult }).pipe(optional),
  after: Schema.Struct({ comparison: Comparison, result: ScenarioResult }).pipe(optional),
  originalReason: Schema.String, impact: Impact,
})
const Reconciliation = Schema.Struct({
  schema: Schema.Literals(["sf-portfolio-reconciliation-v1"]),
  caseRef: CaseRef, originalCaseRef: CaseRef, portfolioResultRef: Text,
  portfolioResultDigest: Digest, portfolioBindingDigest: Digest,
  combinationId: Digest, originalCombination: Combination,
  choiceId: Text, choiceDigest: Digest, originalChoice: Choice, choiceLedgerRef: Text,
  applicationState: Schema.Literals(["draft", "investigating", "comparing", "chosen", "partially-applied", "applied", "reconsidering", "closed"]),
  components: Schema.Array(Schema.Struct({
    original: Component,
    correlation: Schema.Literals(["bound", "ambiguous", "not-prepared"]),
    effects: Schema.Array(Schema.Struct({ change: PreparedChange, receipt: Receipt.pipe(optional) })),
    conditions: Schema.Array(Schema.Struct({
      condition: Schema.Struct({
        id: Text, source: SourceRef, fields: Texts, period: Period, criterionId: Text,
        componentId: Text, choiceId: Text, choiceDigest: Digest, evidenceRefs: Schema.Array(EvidenceRef),
      }),
      observation: MaterialChange,
      componentScope: Schema.Struct({ componentId: Text, beforeDigest: Digest, afterDigest: Digest }).pipe(optional),
      scopeReason: Text, impact: Impact, signal: Signal.pipe(optional),
    })),
  })),
  unmappedChanges: Schema.Array(PreparedChange),
  restrictions: Texts, reconciliationDigest: Digest,
})

const Failure = Schema.Struct({
  status: Schema.Literals(["needs-input", "stale", "denied", "unavailable", "conflict", "provider-conflict", "failed"]),
  reason: Text,
})
const envelope = <S extends Schema.Top>(value: S) => Schema.Union([
  Schema.Struct({ status: Schema.Literals(["ok"]), value }), Failure,
])

/**
 * Effect v4 Struct decoding ignores unknown keys by default, including keys
 * injected inside CaseRef, requests, evidence or refusal envelopes. This
 * family must refuse them, regardless of the caller's parser options.
 *
 * Check the ORIGINAL unknown value with recursive, strict parser options
 * before the ordinary schema projection can remove any surplus property.
 * The transformed codec retains each operation's Type and domain validation;
 * no additional field, role, approval, authority or result is introduced.
 */
const closed = <S extends Schema.Top>(schema: S) =>
  Schema.Unknown
    .check(Schema.makeFilter((value) =>
      Option.isSome(Schema.decodeUnknownOption(schema, { onExcessProperty: "error" })(value))
    ))
    .pipe(Schema.decodeTo(schema, {
      decode: SchemaGetter.transform((value) =>
        Schema.decodeUnknownSync(schema, { onExcessProperty: "error" })(value)),
      encode: SchemaGetter.passthrough(),
    }))

const operation = <const Id extends string, In extends Schema.Top, Out extends Schema.Top>(
  operationId: Id, input: In, output: Out,
) => Object.freeze({ operationId, input: closed(input), output: closed(envelope(output)) })

const ByCase = Schema.Struct({ caseRef: CaseRef })
const WithResult = Schema.Struct({ caseRef: CaseRef, resultRef: Text })
const WithPortfolioRequest = Schema.Struct({ caseRef: CaseRef, request: PortfolioRequest })
const WithSensitivityRequest = Schema.Struct({ caseRef: CaseRef, request: SensitivityRequest })
const Selection = { caseRef: CaseRef, request: PortfolioRequest, selectedCandidateRefs: Texts, combinationId: Digest, expectedEvaluationDigest: Digest }

export const SfPortfolioDecisionPortfolioEvaluate = operation(
  "portfolio.decision-portfolio-evaluate", WithPortfolioRequest,
  Schema.Struct({ portfolioResultRef: Text, portfolio: Portfolio, caseRef: CaseRef }),
)
export const SfPortfolioDecisionPortfolioPreview = operation(
  "portfolio.decision-portfolio-preview", WithPortfolioRequest,
  Schema.Struct({
    portfolio: Portfolio,
    selections: Schema.Array(Schema.Struct({ combinationId: Digest, selectedCandidateRefs: Texts })),
    evaluationDigest: Digest,
  }),
)
export const SfPortfolioDecisionPortfolioRead = operation(
  "portfolio.decision-portfolio-read", WithResult,
  Schema.Struct({ portfolioResultRef: Text, portfolio: Portfolio, caseRef: CaseRef }),
)
export const SfPortfolioDecisionPortfolioReconcile = operation(
  "portfolio.decision-portfolio-reconcile",
  Schema.Struct({ caseRef: CaseRef, portfolioResultRef: Text, combinationId: Digest, choiceId: Text }),
  Reconciliation,
)
export const SfPortfolioDecisionPortfolioResults = operation(
  "portfolio.decision-portfolio-results", ByCase,
  Schema.Array(Schema.Struct({ resultRef: Text, createdAt: Text })),
)
export const SfPortfolioDecisionPreparePortfolio = operation(
  "portfolio.decision-prepare-portfolio", Schema.Struct({ ...Selection, choiceId: Text }),
  Schema.Struct({ caseRef: CaseRef }),
)
export const SfPortfolioDecisionPromotePortfolio = operation(
  "portfolio.decision-promote-portfolio", Schema.Struct({ ...Selection, title: Text, coverageRef: Text }),
  Schema.Struct({ caseRef: CaseRef, resultRef: Text.pipe(optional) }),
)
export const SfPortfolioDecisionSensitivityEvaluate = operation(
  "portfolio.decision-sensitivity-evaluate", WithSensitivityRequest,
  Schema.Struct({ sensitivityResultRef: Text, sensitivity: Sensitivity, caseRef: CaseRef }),
)
export const SfPortfolioDecisionSensitivityRead = operation(
  "portfolio.decision-sensitivity-read", WithResult,
  Schema.Struct({ sensitivityResultRef: Text, sensitivity: Sensitivity, caseRef: CaseRef }),
)
export const SfPortfolioDecisionSensitivityUnits = operation(
  "portfolio.decision-sensitivity-units",
  Schema.Struct({ caseRef: CaseRef, scenarioRef: Text, baselineRef: Text, parameterRef: Text }),
  Schema.Struct({
    caseRef: CaseRef, scenario: ScenarioRequest, parameterOperation: ScenarioOperation.pipe(optional),
    scenarioCoverageRef: Text, baselineCoverageRef: Text, baselineRef: Text,
    criterionId: Text, metric: Schema.Literals(["alternative-minus-baseline-known-subtotal"]),
    parameterUnit: Text, resultUnit: Text, unit: Text,
    unitMetadataRef: Text, unitMetadataVersion: NonNegativeInt, engineVersion: Text,
    evidenceRefs: Schema.Array(EvidenceRef), metadataDigest: Digest,
    ruleRef: Text, ruleVersion: NonNegativeInt, ruleDigest: Digest,
    sensitivityRequest: SensitivityRequest,
  }),
)

/** Closed family catalog: metadata/operation ids come from frozen contract-catalog.json. */
export const SfPortfolio = Object.freeze({
  [SfPortfolioDecisionPortfolioEvaluate.operationId]: SfPortfolioDecisionPortfolioEvaluate,
  [SfPortfolioDecisionPortfolioPreview.operationId]: SfPortfolioDecisionPortfolioPreview,
  [SfPortfolioDecisionPortfolioRead.operationId]: SfPortfolioDecisionPortfolioRead,
  [SfPortfolioDecisionPortfolioReconcile.operationId]: SfPortfolioDecisionPortfolioReconcile,
  [SfPortfolioDecisionPortfolioResults.operationId]: SfPortfolioDecisionPortfolioResults,
  [SfPortfolioDecisionPreparePortfolio.operationId]: SfPortfolioDecisionPreparePortfolio,
  [SfPortfolioDecisionPromotePortfolio.operationId]: SfPortfolioDecisionPromotePortfolio,
  [SfPortfolioDecisionSensitivityEvaluate.operationId]: SfPortfolioDecisionSensitivityEvaluate,
  [SfPortfolioDecisionSensitivityRead.operationId]: SfPortfolioDecisionSensitivityRead,
  [SfPortfolioDecisionSensitivityUnits.operationId]: SfPortfolioDecisionSensitivityUnits,
})
export type SfPortfolioOperationId = keyof typeof SfPortfolio
