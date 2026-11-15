/**
 * W16/A04 closed, source-equivalent public Effect schemas.
 * INPUT product/contracts/operations.ts @88550f78693ba1a66b285f2f53abcd3f8c09afdc
 * OUTPUT product/contracts/output-schemas.ts @0d9fc51d26a0ca726d32e74605b555f871d99af6
 * Schema is a transport transcription, never an authorization producer.
 * F02 must decode with onExcessProperty: "error" and fail closed.
 */
import { Schema } from "effect"

/** Original BusinessEvidenceRef discriminator and recursive source identity. */
export type SfEvidenceRef = Readonly<{
  schema:"sf-evidence-v1";refId:string;installationId:string;projectId:string;refDigest:string;
  evidenceLevel:"observed"|"claim"|"assumption"|"proposal"|"decision";
}> & (
 | Readonly<{kind:"record";target:Readonly<{surface:"dashboard"|"planner"|"procurement";recordType:string;recordId:string;incarnation:string;version:number;fields:readonly string[];period?:Readonly<{start:string;end:string}>;projectionDigest:string}>}>
 | Readonly<{
     kind: "document"
     target: Readonly<{
       documentId: string
       incarnation: string
       revision: number
       blobDigest: Readonly<{ algorithm: "sha256"; value: string }>
       segment: Readonly<{
         start: number
         end: number
         unit: "utf16"
         textDigest: Readonly<{ algorithm: "sha256"; value: string }>
       }>
       ragSourceId?: string
       ragRevisionId?: string
       ragSourceHash?: Readonly<{ algorithm: "blake3"; value: string }>
       fieldCandidateId?: string
       confirmationVersion?: number
     }>
   }>
 | Readonly<{kind:"calculation";target:Readonly<{calculationId:string;runId:string;engineVersion:string;inputDigest:string;resultDigest:string;sourceRefs:readonly SfEvidenceRef[];period:Readonly<{start:string;end:string}>;currency:string}>}>
 | Readonly<{kind:"receipt";target:Readonly<{surface:"dashboard"|"planner"|"procurement";receiptId:string;idempotencyKey:string;targetIncarnation:string;commandDigest:string;version:number}>}>
 | Readonly<{kind:"case-event";target:Readonly<{caseId:string;caseIncarnation:string;caseVersion:number;eventId:string;outputDigest:string;evidenceRefs:readonly SfEvidenceRef[]}>}>
 | Readonly<{kind:"policy";target:Readonly<{packageId:string;version:string;sourceDigest:string;ruleId:string;reviewRef:string;scope:string}>}>
)

const Input_BusinessEvidenceRef: Schema.Schema<SfEvidenceRef> = Schema.Union(Schema.Struct({
  "schema": Schema.Literal("sf-evidence-v1"),
  "refId": Schema.String.pipe(Schema.minLength(1)),
  "installationId": Schema.String.pipe(Schema.minLength(1)),
  "projectId": Schema.String.pipe(Schema.minLength(1)),
  "refDigest": Schema.String.pipe(Schema.pattern(new RegExp("^[a-f0-9]{64}$"))),
  "evidenceLevel": Schema.Literal("observed", "claim", "assumption", "proposal", "decision"),
  "kind": Schema.Literal("record"),
  "target": Schema.Struct({
  "surface": Schema.Literal("dashboard", "planner", "procurement"),
  "recordType": Schema.String.pipe(Schema.minLength(1)),
  "recordId": Schema.String.pipe(Schema.minLength(1)),
  "incarnation": Schema.String.pipe(Schema.minLength(1)),
  "version": Schema.Int.pipe(Schema.greaterThanOrEqualTo(0)),
  "fields": Schema.Array(Schema.String.pipe(Schema.minLength(1))),
  "period": Schema.optional(Schema.Struct({
  "start": Schema.String.pipe(Schema.pattern(new RegExp("^\\d{4}-\\d{2}-\\d{2}$"))),
  "end": Schema.String.pipe(Schema.pattern(new RegExp("^\\d{4}-\\d{2}-\\d{2}$"))),
})),
  "projectionDigest": Schema.String.pipe(Schema.minLength(1)),
}),
}), Schema.Struct({
  "schema": Schema.Literal("sf-evidence-v1"),
  "refId": Schema.String.pipe(Schema.minLength(1)),
  "installationId": Schema.String.pipe(Schema.minLength(1)),
  "projectId": Schema.String.pipe(Schema.minLength(1)),
  "refDigest": Schema.String.pipe(Schema.pattern(new RegExp("^[a-f0-9]{64}$"))),
  "evidenceLevel": Schema.Literal("observed", "claim", "assumption", "proposal", "decision"),
  "kind": Schema.Literal("document"),
  "target": Schema.Struct({
  "documentId": Schema.String.pipe(Schema.minLength(1)),
  "incarnation": Schema.String.pipe(Schema.minLength(1)),
  "revision": Schema.Int.pipe(Schema.greaterThanOrEqualTo(0)),
  "blobDigest": Schema.Struct({
  "algorithm": Schema.Literal("sha256"),
  "value": Schema.String.pipe(Schema.pattern(new RegExp("^[a-f0-9]{64}$"))),
}),
  "segment": Schema.Struct({
  "start": Schema.Int.pipe(Schema.greaterThanOrEqualTo(0)),
  "end": Schema.Int.pipe(Schema.greaterThanOrEqualTo(0)),
  "unit": Schema.Literal("utf16"),
  "textDigest": Schema.Struct({
  "algorithm": Schema.Literal("sha256"),
  "value": Schema.String.pipe(Schema.pattern(new RegExp("^[a-f0-9]{64}$"))),
}),
}),
  "ragSourceId": Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  "ragRevisionId": Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  "ragSourceHash": Schema.optional(Schema.Struct({
  "algorithm": Schema.Literal("blake3"),
  "value": Schema.String.pipe(Schema.minLength(1)),
})),
  "fieldCandidateId": Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  "confirmationVersion": Schema.optional(Schema.Int.pipe(Schema.greaterThanOrEqualTo(0))),
}),
}), Schema.Struct({
  "schema": Schema.Literal("sf-evidence-v1"),
  "refId": Schema.String.pipe(Schema.minLength(1)),
  "installationId": Schema.String.pipe(Schema.minLength(1)),
  "projectId": Schema.String.pipe(Schema.minLength(1)),
  "refDigest": Schema.String.pipe(Schema.pattern(new RegExp("^[a-f0-9]{64}$"))),
  "evidenceLevel": Schema.Literal("observed", "claim", "assumption", "proposal", "decision"),
  "kind": Schema.Literal("calculation"),
  "target": Schema.Struct({
  "calculationId": Schema.String.pipe(Schema.minLength(1)),
  "runId": Schema.String.pipe(Schema.minLength(1)),
  "engineVersion": Schema.String.pipe(Schema.minLength(1)),
  "inputDigest": Schema.String.pipe(Schema.minLength(1)),
  "resultDigest": Schema.String.pipe(Schema.minLength(1)),
  "sourceRefs": Schema.Array(Schema.suspend(() => Input_BusinessEvidenceRef)),
  "period": Schema.Struct({
  "start": Schema.String.pipe(Schema.pattern(new RegExp("^\\d{4}-\\d{2}-\\d{2}$"))),
  "end": Schema.String.pipe(Schema.pattern(new RegExp("^\\d{4}-\\d{2}-\\d{2}$"))),
}),
  "currency": Schema.String.pipe(Schema.pattern(new RegExp("^[A-Z]{3}$"))),
}),
}), Schema.Struct({
  "schema": Schema.Literal("sf-evidence-v1"),
  "refId": Schema.String.pipe(Schema.minLength(1)),
  "installationId": Schema.String.pipe(Schema.minLength(1)),
  "projectId": Schema.String.pipe(Schema.minLength(1)),
  "refDigest": Schema.String.pipe(Schema.pattern(new RegExp("^[a-f0-9]{64}$"))),
  "evidenceLevel": Schema.Literal("observed", "claim", "assumption", "proposal", "decision"),
  "kind": Schema.Literal("receipt"),
  "target": Schema.Struct({
  "surface": Schema.Literal("dashboard", "planner", "procurement"),
  "receiptId": Schema.String.pipe(Schema.minLength(1)),
  "idempotencyKey": Schema.String.pipe(Schema.minLength(1)),
  "targetIncarnation": Schema.String.pipe(Schema.minLength(1)),
  "commandDigest": Schema.String.pipe(Schema.minLength(1)),
  "version": Schema.Int.pipe(Schema.greaterThanOrEqualTo(0)),
}),
}), Schema.Struct({
  "schema": Schema.Literal("sf-evidence-v1"),
  "refId": Schema.String.pipe(Schema.minLength(1)),
  "installationId": Schema.String.pipe(Schema.minLength(1)),
  "projectId": Schema.String.pipe(Schema.minLength(1)),
  "refDigest": Schema.String.pipe(Schema.pattern(new RegExp("^[a-f0-9]{64}$"))),
  "evidenceLevel": Schema.Literal("observed", "claim", "assumption", "proposal", "decision"),
  "kind": Schema.Literal("case-event"),
  "target": Schema.Struct({
  "caseId": Schema.String.pipe(Schema.minLength(1)),
  "caseIncarnation": Schema.String.pipe(Schema.minLength(1)),
  "caseVersion": Schema.Int.pipe(Schema.greaterThanOrEqualTo(0)),
  "eventId": Schema.String.pipe(Schema.minLength(1)),
  "outputDigest": Schema.String.pipe(Schema.minLength(1)),
  "evidenceRefs": Schema.Array(Schema.suspend(() => Input_BusinessEvidenceRef)),
}),
}), Schema.Struct({
  "schema": Schema.Literal("sf-evidence-v1"),
  "refId": Schema.String.pipe(Schema.minLength(1)),
  "installationId": Schema.String.pipe(Schema.minLength(1)),
  "projectId": Schema.String.pipe(Schema.minLength(1)),
  "refDigest": Schema.String.pipe(Schema.pattern(new RegExp("^[a-f0-9]{64}$"))),
  "evidenceLevel": Schema.Literal("observed", "claim", "assumption", "proposal", "decision"),
  "kind": Schema.Literal("policy"),
  "target": Schema.Struct({
  "packageId": Schema.String.pipe(Schema.minLength(1)),
  "version": Schema.String.pipe(Schema.minLength(1)),
  "sourceDigest": Schema.String.pipe(Schema.minLength(1)),
  "ruleId": Schema.String.pipe(Schema.minLength(1)),
  "reviewRef": Schema.String.pipe(Schema.minLength(1)),
  "scope": Schema.String.pipe(Schema.minLength(1)),
}),
}))

const Input_ScenarioOperation = Schema.Struct({
  "kind": Schema.Literal("replace", "defer", "include", "exclude"),
  "targetRef": Schema.String.pipe(Schema.minLength(1)),
  "replacementRef": Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  "amount": Schema.optional(Schema.Number),
  "currency": Schema.optional(Schema.String.pipe(Schema.pattern(new RegExp("^[A-Z]{3}$")))),
  "period": Schema.optional(Schema.Struct({
  "start": Schema.String.pipe(Schema.pattern(new RegExp("^\\d{4}-\\d{2}-\\d{2}$"))),
  "end": Schema.String.pipe(Schema.pattern(new RegExp("^\\d{4}-\\d{2}-\\d{2}$"))),
})),
})

const Output_AuthorizedCaseProjection_147 = Schema.Struct({
  "context": Schema.suspend(() => Output_Shape_143),
  "case": Schema.suspend(() => Output_Shape_148),
  "events": Schema.Array(Schema.suspend(() => Output_CaseLedgerEvent_138)),
  "evidenceRefs": Schema.Array(Schema.suspend(() => Output_BusinessEvidenceRef_9)),
  "checkedAt": Schema.String,
})

const Output_BusinessEvidenceRef_9: Schema.Schema<SfEvidenceRef> = Schema.Union(Schema.suspend(() => Output_Shape_10), Schema.suspend(() => Output_Shape_14), Schema.suspend(() => Output_Shape_19), Schema.suspend(() => Output_Shape_21), Schema.suspend(() => Output_Shape_23), Schema.suspend(() => Output_Shape_25))

const Output_CaseLedgerEvent_138 = Schema.Struct({
  "id": Schema.String,
  "caseRef": Schema.suspend(() => Output___type_139),
  "kind": Schema.suspend(() => Output_Shape_140),
  "principalRef": Schema.String,
  "at": Schema.String,
  "analysisRunId": Schema.optional(Schema.String),
  "consideredActions": Schema.Array(Schema.String),
  "factualGaps": Schema.Array(Schema.String),
  "lifecycleState": Schema.suspend(() => Output_Shape_141),
  "rationale": Schema.String,
  "evidenceRefs": Schema.Array(Schema.suspend(() => Output_BusinessEvidenceRef_9)),
  "outputDigest": Schema.String,
})

const Output_ChoiceRecord_153 = Schema.Union(Schema.suspend(() => Output_Shape_154), Schema.suspend(() => Output_Shape_156))

const Output_CommandReceiptView_159 = Schema.Struct({
  "id": Schema.String,
  "version": Schema.Number,
  "idempotencyKey": Schema.String,
  "commandDigest": Schema.String,
  "targetIncarnation": Schema.String,
  "principalRef": Schema.String,
  "surface": Schema.suspend(() => Output_Surface_13),
  "at": Schema.String,
  "status": Schema.suspend(() => Output_Shape_160),
  "resultRef": Schema.optional(Schema.String),
  "errors": Schema.Array(Schema.String),
})

const Output_CostCoverageAssessment_40 = Schema.Union(Schema.suspend(() => Output_Shape_34), Schema.suspend(() => Output_Shape_41))

const Output_CostCoverageBasis_45 = Schema.Struct({
  "id": Schema.String,
  "version": Schema.Number,
  "decisionType": Schema.String,
  "categoryIds": Schema.Array(Schema.String),
  "sourceRefs": Schema.Array(Schema.suspend(() => Output_BusinessEvidenceRef_9)),
  "additionalCategoryIds": Schema.Array(Schema.String),
})

const Output_CostCoverageEntry_43 = Schema.Union(Schema.suspend(() => Output___type_36), Schema.suspend(() => Output___type_37), Schema.suspend(() => Output___type_44))

const Output_Digest_16 = Schema.Struct({
  "algorithm": Schema.Literal("sha256"),
  "value": Schema.String,
})

const Output_EvidenceState_33 = Schema.Union(Schema.Literal("confirmed"), Schema.Literal("estimated"), Schema.Literal("hypothetical"), Schema.Literal("absent"))

const Output_IntentFrame_46 = Schema.Union(Schema.suspend(() => Output_Shape_47), Schema.suspend(() => Output_Shape_51))

const Output_Period_6 = Schema.Struct({
  "start": Schema.String,
  "end": Schema.String,
})

const Output_PreparedChangeSet_108 = Schema.Struct({
  "caseRef": Schema.String,
  "caseVersion": Schema.Number,
  "changes": Schema.Array(Schema.suspend(() => Output___type_109)),
  "conditions": Schema.Array(Schema.suspend(() => Output_UnresolvedCondition_50)),
})

const Output_PreparedChangeView_157 = Schema.Struct({
  "state": Schema.suspend(() => Output_Shape_158),
  "id": Schema.String,
  "caseId": Schema.String,
  "caseVersion": Schema.Number,
  "choiceId": Schema.String,
  "target": Schema.suspend(() => Output_SourceRef_32),
  "expectedVersion": Schema.Number,
  "preview": Schema.suspend(() => Output_ScenarioResult_28),
  "requiredAuthority": Schema.Array(Schema.String),
  "idempotencyKey": Schema.String,
  "operationRef": Schema.String,
  "receiptRef": Schema.optional(Schema.String),
})

const Output_ProjectionComponent_30 = Schema.Struct({
  "id": Schema.String,
  "amount": Schema.suspend(() => Output_Shape_31),
  "currency": Schema.String,
  "period": Schema.suspend(() => Output_Period_6),
  "sourceRefs": Schema.Array(Schema.suspend(() => Output_SourceRef_32)),
  "evidenceState": Schema.suspend(() => Output_EvidenceState_33),
})

const Output_QuestionProposal_55 = Schema.Struct({
  "caseRef": Schema.String,
  "question": Schema.String,
  "criterionRef": Schema.optional(Schema.String),
  "recipientRef": Schema.optional(Schema.String),
  "evidenceRefs": Schema.Array(Schema.suspend(() => Output_BusinessEvidenceRef_9)),
  "expectedCaseVersion": Schema.Number,
})

const Output_ScenarioComparison_62 = Schema.Union(Schema.suspend(() => Output_Shape_63), Schema.suspend(() => Output_Shape_66))

const Output_ScenarioOperation_4 = Schema.Struct({
  "kind": Schema.suspend(() => Output_Shape_5),
  "targetRef": Schema.String,
  "replacementRef": Schema.optional(Schema.String),
  "amount": Schema.optional(Schema.Number),
  "currency": Schema.optional(Schema.String),
  "period": Schema.optional(Schema.suspend(() => Output_Period_6)),
})

const Output_ScenarioRequest_3 = Schema.Struct({
  "baseRef": Schema.String,
  "operations": Schema.Array(Schema.suspend(() => Output_ScenarioOperation_4)),
  "assumptions": Schema.Array(Schema.suspend(() => Output___type_7)),
})

const Output_ScenarioResult_28 = Schema.Union(Schema.suspend(() => Output_Shape_29), Schema.suspend(() => Output_Shape_38))

const Output_Shape_10 = Schema.Struct({
  "schema": Schema.Literal("sf-evidence-v1"),
  "refId": Schema.String,
  "installationId": Schema.String,
  "projectId": Schema.String,
  "refDigest": Schema.String,
  "evidenceLevel": Schema.suspend(() => Output_Shape_11),
  "kind": Schema.Literal("record"),
  "target": Schema.suspend(() => Output___type_12),
})

const Output_Shape_11 = Schema.Union(Schema.Literal("observed"), Schema.Literal("claim"), Schema.Literal("assumption"), Schema.Literal("proposal"), Schema.Literal("decision"))

const Output_Shape_14 = Schema.Struct({
  "schema": Schema.Literal("sf-evidence-v1"),
  "refId": Schema.String,
  "installationId": Schema.String,
  "projectId": Schema.String,
  "refDigest": Schema.String,
  "evidenceLevel": Schema.suspend(() => Output_Shape_11),
  "kind": Schema.Literal("document"),
  "target": Schema.suspend(() => Output___type_15),
})

const Output_Shape_140 = Schema.Union(Schema.Literal("analysis-accepted"), Schema.Literal("choice-recorded"), Schema.Literal("reconsideration-accepted"))

const Output_Shape_141 = Schema.Union(Schema.Literal("draft"), Schema.Literal("investigating"), Schema.Literal("comparing"), Schema.Literal("chosen"), Schema.Literal("partially-applied"), Schema.Literal("applied"), Schema.Literal("reconsidering"), Schema.Literal("closed"))

const Output_Shape_143 = Schema.Union(Schema.suspend(() => Output_Shape_144), Schema.suspend(() => Output_Shape_145))

const Output_Shape_144 = Schema.Struct({
  "installationId": Schema.String,
  "projectId": Schema.String,
  "principalRef": Schema.String,
  "policyVersion": Schema.String,
  "accessRevision": Schema.String,
  "kind": Schema.Literal("native"),
  "profileId": Schema.String,
})

const Output_Shape_145 = Schema.Struct({
  "installationId": Schema.String,
  "projectId": Schema.String,
  "principalRef": Schema.String,
  "policyVersion": Schema.String,
  "accessRevision": Schema.String,
  "kind": Schema.Literal("ui"),
  "profileId": Schema.optional(Schema.Never),
})

const Output_Shape_148 = Schema.Struct({
  "alternatives": Schema.Array(Schema.suspend(() => Output___type_2)),
  "criteria": Schema.Array(Schema.suspend(() => Output___type_49)),
  "state": Schema.suspend(() => Output_Shape_141),
  "id": Schema.String,
  "incarnation": Schema.String,
  "version": Schema.Number,
  "objective": Schema.String,
  "horizon": Schema.suspend(() => Output_Period_6),
  "currency": Schema.String,
  "participants": Schema.Array(Schema.String),
  "sourceRefs": Schema.Array(Schema.suspend(() => Output_BusinessEvidenceRef_9)),
  "costCoverageBases": Schema.Array(Schema.suspend(() => Output_CostCoverageBasis_45)),
  "assumptions": Schema.Array(Schema.suspend(() => Output___type_149)),
  "questions": Schema.Array(Schema.suspend(() => Output___type_151)),
  "choices": Schema.Array(Schema.suspend(() => Output_ChoiceRecord_153)),
  "ledger": Schema.Array(Schema.suspend(() => Output_CaseLedgerEvent_138)),
  "preparedChanges": Schema.Array(Schema.suspend(() => Output_PreparedChangeView_157)),
  "receipts": Schema.Array(Schema.suspend(() => Output_CommandReceiptView_159)),
})

const Output_Shape_150 = Schema.Union(Schema.Literal("confirmed"), Schema.Literal("rejected"), Schema.Literal("open"))

const Output_Shape_152 = Schema.Union(Schema.Literal("open"), Schema.Literal("answered"))

const Output_Shape_154 = Schema.Struct({
  "id": Schema.String,
  "alternativeId": Schema.String,
  "alternativeVersion": Schema.Number,
  "basisVersion": Schema.Number,
  "criteria": Schema.Array(Schema.String),
  "values": Schema.Array(Schema.suspend(() => Output___type_155)),
  "evidenceRefs": Schema.Array(Schema.suspend(() => Output_BusinessEvidenceRef_9)),
  "principalRef": Schema.String,
  "reason": Schema.String,
  "at": Schema.String,
  "scenario": Schema.suspend(() => Output_ScenarioRequest_3),
  "result": Schema.suspend(() => Output_ScenarioResult_28),
  "comparison": Schema.suspend(() => Output_ScenarioComparison_62),
  "comparisonStatus": Schema.Literal("complete"),
  "costCoverage": Schema.suspend(() => Output_Shape_34),
})

const Output_Shape_156 = Schema.Struct({
  "id": Schema.String,
  "alternativeId": Schema.String,
  "alternativeVersion": Schema.Number,
  "basisVersion": Schema.Number,
  "criteria": Schema.Array(Schema.String),
  "values": Schema.Array(Schema.suspend(() => Output___type_155)),
  "evidenceRefs": Schema.Array(Schema.suspend(() => Output_BusinessEvidenceRef_9)),
  "principalRef": Schema.String,
  "reason": Schema.String,
  "at": Schema.String,
  "scenario": Schema.suspend(() => Output_ScenarioRequest_3),
  "result": Schema.suspend(() => Output_ScenarioResult_28),
  "comparison": Schema.suspend(() => Output_ScenarioComparison_62),
  "comparisonStatus": Schema.suspend(() => Output_Shape_39),
  "costCoverage": Schema.suspend(() => Output_CostCoverageAssessment_40),
})

const Output_Shape_158 = Schema.Union(Schema.Literal("failed"), Schema.Literal("conflict"), Schema.Literal("applied"), Schema.Literal("planned"), Schema.Literal("awaiting-approval"), Schema.Literal("cancelled"))

const Output_Shape_160 = Schema.Union(Schema.Literal("failed"), Schema.Literal("conflict"), Schema.Literal("applied"), Schema.Literal("awaiting-approval"), Schema.Literal("cancelled"))

const Output_Shape_19 = Schema.Struct({
  "schema": Schema.Literal("sf-evidence-v1"),
  "refId": Schema.String,
  "installationId": Schema.String,
  "projectId": Schema.String,
  "refDigest": Schema.String,
  "evidenceLevel": Schema.suspend(() => Output_Shape_11),
  "kind": Schema.Literal("calculation"),
  "target": Schema.suspend(() => Output___type_20),
})

const Output_Shape_21 = Schema.Struct({
  "schema": Schema.Literal("sf-evidence-v1"),
  "refId": Schema.String,
  "installationId": Schema.String,
  "projectId": Schema.String,
  "refDigest": Schema.String,
  "evidenceLevel": Schema.suspend(() => Output_Shape_11),
  "kind": Schema.Literal("receipt"),
  "target": Schema.suspend(() => Output___type_22),
})

const Output_Shape_23 = Schema.Struct({
  "schema": Schema.Literal("sf-evidence-v1"),
  "refId": Schema.String,
  "installationId": Schema.String,
  "projectId": Schema.String,
  "refDigest": Schema.String,
  "evidenceLevel": Schema.suspend(() => Output_Shape_11),
  "kind": Schema.Literal("case-event"),
  "target": Schema.suspend(() => Output___type_24),
})

const Output_Shape_25 = Schema.Struct({
  "schema": Schema.Literal("sf-evidence-v1"),
  "refId": Schema.String,
  "installationId": Schema.String,
  "projectId": Schema.String,
  "refDigest": Schema.String,
  "evidenceLevel": Schema.suspend(() => Output_Shape_11),
  "kind": Schema.Literal("policy"),
  "target": Schema.suspend(() => Output___type_26),
})

const Output_Shape_27 = Schema.Union(Schema.Literal("confirmed"), Schema.Literal("estimated"), Schema.Literal("hypothetical"), Schema.Literal("absent"))

const Output_Shape_29 = Schema.Struct({
  "id": Schema.String,
  "version": Schema.Number,
  "components": Schema.Array(Schema.suspend(() => Output_ProjectionComponent_30)),
  "currency": Schema.String,
  "horizon": Schema.suspend(() => Output_Period_6),
  "sourceRefs": Schema.Array(Schema.suspend(() => Output_BusinessEvidenceRef_9)),
  "unresolvedConditions": Schema.Array(Schema.String),
  "restrictions": Schema.Array(Schema.String),
  "comparisonStatus": Schema.Literal("complete"),
  "costCoverage": Schema.suspend(() => Output_Shape_34),
  "knownSubtotal": Schema.Number,
  "total": Schema.Number,
})

const Output_Shape_31 = Schema.Union(Schema.Null, Schema.Number)

const Output_Shape_34 = Schema.Struct({
  "basisId": Schema.String,
  "basisVersion": Schema.Number,
  "alternativeId": Schema.String,
  "alternativeVersion": Schema.Number,
  "currency": Schema.String,
  "horizon": Schema.suspend(() => Output_Period_6),
  "issues": Schema.Array(Schema.String),
  "evaluatedSourceRefs": Schema.Array(Schema.suspend(() => Output_BusinessEvidenceRef_9)),
  "coverageState": Schema.Literal("complete"),
  "entries": Schema.Array(Schema.suspend(() => Output_Shape_35)),
  "derivedMissingCategoryIds": Schema.Array(Schema.Never),
})

const Output_Shape_35 = Schema.Union(Schema.suspend(() => Output___type_36), Schema.suspend(() => Output___type_37))

const Output_Shape_38 = Schema.Struct({
  "id": Schema.String,
  "version": Schema.Number,
  "components": Schema.Array(Schema.suspend(() => Output_ProjectionComponent_30)),
  "currency": Schema.String,
  "horizon": Schema.suspend(() => Output_Period_6),
  "sourceRefs": Schema.Array(Schema.suspend(() => Output_BusinessEvidenceRef_9)),
  "unresolvedConditions": Schema.Array(Schema.String),
  "restrictions": Schema.Array(Schema.String),
  "comparisonStatus": Schema.suspend(() => Output_Shape_39),
  "costCoverage": Schema.suspend(() => Output_CostCoverageAssessment_40),
  "knownSubtotal": Schema.suspend(() => Output_Shape_31),
  "total": Schema.Null,
})

const Output_Shape_39 = Schema.Union(Schema.Literal("unavailable"), Schema.Literal("conditioned"), Schema.Literal("incompatible"))

const Output_Shape_41 = Schema.Struct({
  "basisId": Schema.String,
  "basisVersion": Schema.Number,
  "alternativeId": Schema.String,
  "alternativeVersion": Schema.Number,
  "currency": Schema.String,
  "horizon": Schema.suspend(() => Output_Period_6),
  "issues": Schema.Array(Schema.String),
  "evaluatedSourceRefs": Schema.Array(Schema.suspend(() => Output_BusinessEvidenceRef_9)),
  "coverageState": Schema.suspend(() => Output_Shape_42),
  "entries": Schema.Array(Schema.suspend(() => Output_CostCoverageEntry_43)),
  "derivedMissingCategoryIds": Schema.Array(Schema.String),
})

const Output_Shape_42 = Schema.Union(Schema.Literal("pending"), Schema.Literal("unavailable"))

const Output_Shape_47 = Schema.Struct({
  "objective": Schema.String,
  "horizon": Schema.suspend(() => Output___type_48),
  "currency": Schema.String,
  "criteria": Schema.Array(Schema.suspend(() => Output___type_49)),
  "sourceRefs": Schema.Array(Schema.suspend(() => Output_BusinessEvidenceRef_9)),
  "gaps": Schema.Array(Schema.suspend(() => Output_UnresolvedCondition_50)),
  "domainApplied": Schema.Literal(false),
  "analysisBasis": Schema.Literal("domain"),
  "importPreviewRef": Schema.optional(Schema.Never),
})

const Output_Shape_5 = Schema.Union(Schema.Literal("replace"), Schema.Literal("defer"), Schema.Literal("include"), Schema.Literal("exclude"))

const Output_Shape_51 = Schema.Struct({
  "objective": Schema.String,
  "horizon": Schema.suspend(() => Output___type_48),
  "currency": Schema.String,
  "criteria": Schema.Array(Schema.suspend(() => Output___type_49)),
  "sourceRefs": Schema.Array(Schema.suspend(() => Output_BusinessEvidenceRef_9)),
  "gaps": Schema.Array(Schema.suspend(() => Output_UnresolvedCondition_50)),
  "domainApplied": Schema.Literal(false),
  "analysisBasis": Schema.Literal("import-preview"),
  "importPreviewRef": Schema.String,
})

const Output_Shape_63 = Schema.Struct({
  "baselineResultRef": Schema.String,
  "alternativeResultRef": Schema.String,
  "costCoverageRefs": Schema.Array(Schema.String),
  "criterionResults": Schema.Array(Schema.suspend(() => Output___type_64)),
  "unresolvedConditions": Schema.Array(Schema.String),
  "comparisonStatus": Schema.Literal("complete"),
  "knownDifference": Schema.Number,
  "completeDifference": Schema.Number,
})

const Output_Shape_65 = Schema.Union(Schema.Literal("satisfied"), Schema.Literal("failed"), Schema.Literal("unknown"))

const Output_Shape_66 = Schema.Struct({
  "baselineResultRef": Schema.String,
  "alternativeResultRef": Schema.String,
  "costCoverageRefs": Schema.Array(Schema.String),
  "criterionResults": Schema.Array(Schema.suspend(() => Output___type_64)),
  "unresolvedConditions": Schema.Array(Schema.String),
  "comparisonStatus": Schema.suspend(() => Output_Shape_39),
  "knownDifference": Schema.suspend(() => Output_Shape_31),
  "completeDifference": Schema.Null,
})

const Output_Shape_8 = Schema.Union(Schema.Null, Schema.String, Schema.Number, Schema.Literal(false), Schema.Literal(true))

const Output_SourceRef_32 = Schema.Struct({
  "surface": Schema.suspend(() => Output_Surface_13),
  "type": Schema.String,
  "id": Schema.String,
  "incarnation": Schema.String,
  "version": Schema.Number,
  "fields": Schema.Array(Schema.String),
  "period": Schema.suspend(() => Output_Period_6),
  "observedAt": Schema.String,
})

const Output_Surface_13 = Schema.Union(Schema.Literal("dashboard"), Schema.Literal("planner"), Schema.Literal("procurement"))

const Output_UnresolvedCondition_50 = Schema.Struct({
  "id": Schema.String,
  "category": Schema.String,
  "reason": Schema.String,
  "evidenceRefs": Schema.Array(Schema.suspend(() => Output_BusinessEvidenceRef_9)),
  "questionRef": Schema.optional(Schema.String),
})

const Output___type_109 = Schema.Struct({
  "changeRef": Schema.String,
  "targetRef": Schema.suspend(() => Output_BusinessEvidenceRef_9),
  "expectedVersion": Schema.Number,
  "operationRef": Schema.String,
  "previewRef": Schema.String,
  "requiredAuthority": Schema.Array(Schema.String),
})

const Output___type_12 = Schema.Struct({
  "surface": Schema.suspend(() => Output_Surface_13),
  "recordType": Schema.String,
  "recordId": Schema.String,
  "incarnation": Schema.String,
  "version": Schema.Number,
  "fields": Schema.Array(Schema.String),
  "period": Schema.optional(Schema.suspend(() => Output_Period_6)),
  "projectionDigest": Schema.String,
})

const Output___type_139 = Schema.Struct({
  "id": Schema.String,
  "incarnation": Schema.String,
  "version": Schema.Number,
})

const Output___type_149 = Schema.Struct({
  "id": Schema.String,
  "text": Schema.String,
  "evidenceRefs": Schema.Array(Schema.suspend(() => Output_BusinessEvidenceRef_9)),
  "state": Schema.suspend(() => Output_Shape_150),
})

const Output___type_15 = Schema.Struct({
  "documentId": Schema.String,
  "incarnation": Schema.String,
  "revision": Schema.Number,
  "blobDigest": Schema.suspend(() => Output_Digest_16),
  "segment": Schema.suspend(() => Output___type_17),
  "ragSourceId": Schema.optional(Schema.String),
  "ragRevisionId": Schema.optional(Schema.String),
  "ragSourceHash": Schema.optional(Schema.suspend(() => Output___type_18)),
  "fieldCandidateId": Schema.optional(Schema.String),
  "confirmationVersion": Schema.optional(Schema.Number),
})

const Output___type_151 = Schema.Struct({
  "id": Schema.String,
  "text": Schema.String,
  "state": Schema.suspend(() => Output_Shape_152),
  "answerRef": Schema.optional(Schema.String),
})

const Output___type_155 = Schema.Struct({
  "criterionRef": Schema.String,
  "value": Schema.suspend(() => Output_Shape_31),
  "unit": Schema.String,
  "currency": Schema.String,
  "horizon": Schema.suspend(() => Output_Period_6),
})

const Output___type_17 = Schema.Struct({
  "start": Schema.Number,
  "end": Schema.Number,
  "unit": Schema.Literal("utf16"),
  "textDigest": Schema.suspend(() => Output_Digest_16),
})

const Output___type_18 = Schema.Struct({
  "algorithm": Schema.Literal("blake3"),
  "value": Schema.String,
})

const Output___type_2 = Schema.Struct({
  "id": Schema.String,
  "version": Schema.Number,
  "title": Schema.String,
  "scenario": Schema.suspend(() => Output_ScenarioRequest_3),
  "result": Schema.suspend(() => Output_ScenarioResult_28),
})

const Output___type_20 = Schema.Struct({
  "calculationId": Schema.String,
  "runId": Schema.String,
  "engineVersion": Schema.String,
  "inputDigest": Schema.String,
  "resultDigest": Schema.String,
  "sourceRefs": Schema.Array(Schema.suspend(() => Output_BusinessEvidenceRef_9)),
  "period": Schema.suspend(() => Output_Period_6),
  "currency": Schema.String,
})

const Output___type_22 = Schema.Struct({
  "surface": Schema.suspend(() => Output_Surface_13),
  "receiptId": Schema.String,
  "idempotencyKey": Schema.String,
  "targetIncarnation": Schema.String,
  "commandDigest": Schema.String,
  "version": Schema.Number,
})

const Output___type_24 = Schema.Struct({
  "caseId": Schema.String,
  "caseIncarnation": Schema.String,
  "caseVersion": Schema.Number,
  "eventId": Schema.String,
  "outputDigest": Schema.String,
  "evidenceRefs": Schema.Array(Schema.suspend(() => Output_BusinessEvidenceRef_9)),
})

const Output___type_26 = Schema.Struct({
  "packageId": Schema.String,
  "version": Schema.String,
  "sourceDigest": Schema.String,
  "ruleId": Schema.String,
  "reviewRef": Schema.String,
  "scope": Schema.String,
})

const Output___type_36 = Schema.Struct({
  "status": Schema.Literal("included"),
  "categoryId": Schema.String,
  "componentRefs": Schema.Array(Schema.String),
  "evidenceRefs": Schema.Array(Schema.suspend(() => Output_BusinessEvidenceRef_9)),
  "scopeNote": Schema.String,
})

const Output___type_37 = Schema.Struct({
  "status": Schema.Literal("not-applicable"),
  "categoryId": Schema.String,
  "justification": Schema.String,
  "evidenceRefs": Schema.Array(Schema.suspend(() => Output_BusinessEvidenceRef_9)),
})

const Output___type_44 = Schema.Struct({
  "status": Schema.Literal("pending"),
  "categoryId": Schema.String,
  "reason": Schema.String,
  "questionRef": Schema.optional(Schema.String),
})

const Output___type_48 = Schema.Struct({
  "start": Schema.String,
  "end": Schema.String,
})

const Output___type_49 = Schema.Struct({
  "id": Schema.String,
  "description": Schema.String,
  "required": Schema.Boolean,
})

const Output___type_64 = Schema.Struct({
  "criterionId": Schema.String,
  "state": Schema.suspend(() => Output_Shape_65),
  "reason": Schema.String,
})

const Output___type_7 = Schema.Struct({
  "id": Schema.String,
  "value": Schema.suspend(() => Output_Shape_8),
  "evidenceRefs": Schema.Array(Schema.suspend(() => Output_BusinessEvidenceRef_9)),
  "state": Schema.suspend(() => Output_Shape_27),
})

export const SfSourceInput_sf_case_draft = Schema.Struct({
  "objective": Schema.String.pipe(Schema.minLength(1)),
  "horizon": Schema.Struct({
  "start": Schema.String.pipe(Schema.pattern(new RegExp("^\\d{4}-\\d{2}-\\d{2}$"))),
  "end": Schema.String.pipe(Schema.pattern(new RegExp("^\\d{4}-\\d{2}-\\d{2}$"))),
}),
  "currency": Schema.String.pipe(Schema.pattern(new RegExp("^[A-Z]{3}$"))),
  "criteria": Schema.Array(Schema.String.pipe(Schema.minLength(1))),
  "sourceRefs": Schema.Array(Schema.suspend(() => Input_BusinessEvidenceRef)),
})

export const SfSourceInput_sf_change_prepare = Schema.Struct({
  "caseRef": Schema.String.pipe(Schema.minLength(1)),
  "choiceRef": Schema.String.pipe(Schema.minLength(1)),
  "operations": Schema.Array(Schema.suspend(() => Input_ScenarioOperation)),
})

export const SfSourceInput_sf_question_prepare = Schema.Struct({
  "caseRef": Schema.String.pipe(Schema.minLength(1)),
  "question": Schema.Struct({
  "text": Schema.String.pipe(Schema.minLength(1)),
  "criterionRef": Schema.optional(Schema.String.pipe(Schema.minLength(1))),
}),
  "sourceRefs": Schema.Array(Schema.suspend(() => Input_BusinessEvidenceRef)),
  "recipientRef": Schema.optional(Schema.String.pipe(Schema.minLength(1))),
})

export const SfSourceInput_sf_scenario_simulate = Schema.Struct({
  "baseRef": Schema.String.pipe(Schema.minLength(1)),
  "operations": Schema.Array(Schema.suspend(() => Input_ScenarioOperation)),
  "assumptions": Schema.Array(Schema.Struct({
  "id": Schema.String.pipe(Schema.minLength(1)),
  "value": Schema.Union(Schema.String, Schema.Number, Schema.Boolean, Schema.Null),
  "evidenceRefs": Schema.Array(Schema.suspend(() => Input_BusinessEvidenceRef)),
  "state": Schema.Literal("confirmed", "estimated", "hypothetical", "absent"),
})),
})

export const SfSourceInput_sf_scenario_compare = Schema.Struct({
  "scenarioRefs": Schema.Array(Schema.String.pipe(Schema.minLength(1))),
  "criteria": Schema.Array(Schema.String.pipe(Schema.minLength(1))),
})

export const SfSourceCaseRead = Output_AuthorizedCaseProjection_147

export const SfSourceCaseDraft = Output_IntentFrame_46

export const SfSourceChangePrepare = Output_PreparedChangeSet_108

export const SfSourceQuestionPrepare = Output_QuestionProposal_55

export const SfSourceScenarioResult = Output_ScenarioResult_28

export const SfSourceScenarioComparison = Output_ScenarioComparison_62

/** Additional original projection schema shared with decision controls. */
const Output_DomainProjection_58 = Schema.Struct({
  "context": Schema.suspend(() => Output_ProductContext_59),
  "version": Schema.Number,
  "engineVersion": Schema.String,
  "decision": Schema.optional(Schema.suspend(() => Output_Shape_60)),
  "comparison": Schema.optional(Schema.suspend(() => Output___type_84)),
  "components": Schema.Array(Schema.suspend(() => Output_ProjectionComponent_30)),
  "values": Schema.Array(Schema.suspend(() => Output_ProjectionValue_85)),
  "missing": Schema.Array(Schema.suspend(() => Output___type_88)),
})

const Output_PortfolioCombination_78 = Schema.Union(Schema.suspend(() => Output_Shape_79), Schema.suspend(() => Output_Shape_81), Schema.suspend(() => Output_Shape_82), Schema.suspend(() => Output_Shape_83))

const Output_PortfolioResult_77 = Schema.Struct({
  "combinations": Schema.Array(Schema.suspend(() => Output_PortfolioCombination_78)),
  "limitations": Schema.Array(Schema.String),
  "evidenceRefs": Schema.Array(Schema.suspend(() => Output_BusinessEvidenceRef_9)),
})

const Output_ProductContext_59 = Schema.Struct({
  "installationId": Schema.String,
  "projectId": Schema.String,
  "principalRef": Schema.String,
  "accessRevision": Schema.String,
  "policyVersion": Schema.String,
  "surface": Schema.suspend(() => Output_Surface_13),
  "period": Schema.suspend(() => Output_Period_6),
  "currency": Schema.String,
  "sourceRefs": Schema.Array(Schema.suspend(() => Output_SourceRef_32)),
  "capabilities": Schema.Array(Schema.String),
})

const Output_ProjectionValue_85 = Schema.Struct({
  "id": Schema.String,
  "value": Schema.suspend(() => Output_Shape_8),
  "unit": Schema.optional(Schema.String),
  "currency": Schema.optional(Schema.String),
  "period": Schema.suspend(() => Output_Period_6),
  "granularity": Schema.suspend(() => Output_Shape_86),
  "sourceRefs": Schema.Array(Schema.suspend(() => Output_BusinessEvidenceRef_9)),
  "drilldown": Schema.suspend(() => Output_Shape_87),
  "evidenceState": Schema.suspend(() => Output_EvidenceState_33),
})

const Output_SensitivityResult_67 = Schema.Struct({
  "scenarioRef": Schema.String,
  "parameterRef": Schema.String,
  "bounds": Schema.suspend(() => Output___type_68),
  "evaluated": Schema.Array(Schema.suspend(() => Output___type_69)),
  "threshold": Schema.suspend(() => Output_Shape_31),
  "thresholdEvidence": Schema.suspend(() => Output_Shape_70),
  "unit": Schema.String,
  "parameterUnit": Schema.optional(Schema.String),
  "resultUnit": Schema.optional(Schema.String),
  "engineVersion": Schema.String,
  "costCoverageRefs": Schema.Array(Schema.String),
  "comparisonStatus": Schema.suspend(() => Output_Shape_75),
  "unresolvedConditions": Schema.Array(Schema.suspend(() => Output_UnresolvedCondition_50)),
  "evidenceRefs": Schema.Array(Schema.suspend(() => Output_BusinessEvidenceRef_9)),
})

const Output_Shape_60 = Schema.Union(Schema.suspend(() => Output___type_61), Schema.suspend(() => Output___type_76))

const Output_Shape_70 = Schema.Union(Schema.suspend(() => Output___type_71), Schema.suspend(() => Output___type_72), Schema.suspend(() => Output___type_74))

const Output_Shape_75 = Schema.Union(Schema.Literal("complete"), Schema.Literal("unavailable"), Schema.Literal("conditioned"), Schema.Literal("incompatible"))

const Output_Shape_79 = Schema.Struct({
  "analysis": Schema.optional(Schema.suspend(() => Output___type_80)),
  "id": Schema.String,
  "caseRefs": Schema.Array(Schema.String),
  "components": Schema.Array(Schema.suspend(() => Output_ProjectionComponent_30)),
  "costCoverageRefs": Schema.Array(Schema.String),
  "conflicts": Schema.Array(Schema.String),
  "restrictions": Schema.Array(Schema.String),
  "eligibility": Schema.Literal("eligible-complete"),
  "comparisonStatus": Schema.Literal("complete"),
})

const Output_Shape_81 = Schema.Struct({
  "analysis": Schema.optional(Schema.suspend(() => Output___type_80)),
  "id": Schema.String,
  "caseRefs": Schema.Array(Schema.String),
  "components": Schema.Array(Schema.suspend(() => Output_ProjectionComponent_30)),
  "costCoverageRefs": Schema.Array(Schema.String),
  "conflicts": Schema.Array(Schema.String),
  "restrictions": Schema.Array(Schema.String),
  "eligibility": Schema.Literal("conditioned"),
  "comparisonStatus": Schema.suspend(() => Output_Shape_75),
})

const Output_Shape_82 = Schema.Struct({
  "analysis": Schema.optional(Schema.suspend(() => Output___type_80)),
  "id": Schema.String,
  "caseRefs": Schema.Array(Schema.String),
  "components": Schema.Array(Schema.suspend(() => Output_ProjectionComponent_30)),
  "costCoverageRefs": Schema.Array(Schema.String),
  "conflicts": Schema.Array(Schema.String),
  "restrictions": Schema.Array(Schema.String),
  "eligibility": Schema.Literal("unavailable"),
  "comparisonStatus": Schema.suspend(() => Output_Shape_39),
})

const Output_Shape_83 = Schema.Struct({
  "analysis": Schema.optional(Schema.suspend(() => Output___type_80)),
  "id": Schema.String,
  "caseRefs": Schema.Array(Schema.String),
  "components": Schema.Array(Schema.suspend(() => Output_ProjectionComponent_30)),
  "costCoverageRefs": Schema.Array(Schema.String),
  "conflicts": Schema.Array(Schema.String),
  "restrictions": Schema.Array(Schema.String),
  "eligibility": Schema.Literal("ineligible"),
  "comparisonStatus": Schema.suspend(() => Output_Shape_75),
})

const Output_Shape_86 = Schema.Union(Schema.Literal("record"), Schema.Literal("month"), Schema.Literal("year"), Schema.Literal("aggregate"))

const Output_Shape_87 = Schema.Union(Schema.Null, Schema.suspend(() => Output_Shape_10), Schema.suspend(() => Output_Shape_14), Schema.suspend(() => Output_Shape_19), Schema.suspend(() => Output_Shape_21), Schema.suspend(() => Output_Shape_23), Schema.suspend(() => Output_Shape_25))

const Output_Shape_89 = Schema.Union(Schema.Literal("unavailable"), Schema.Literal("not-applicable"), Schema.Literal("missing"), Schema.Literal("restricted"), Schema.Literal("incompatible-currency"), Schema.Literal("missing-fx"), Schema.Literal("missing-rate"), Schema.Literal("unconfirmed"))

const Output___type_61 = Schema.Struct({
  "kind": Schema.Literal("scenario"),
  "scenarioResultRef": Schema.String,
  "scenario": Schema.suspend(() => Output_ScenarioResult_28),
  "comparisonRef": Schema.String,
  "comparison": Schema.suspend(() => Output_ScenarioComparison_62),
  "sensitivity": Schema.optional(Schema.suspend(() => Output_SensitivityResult_67)),
  "sensitivityResultRef": Schema.optional(Schema.String),
})

const Output___type_68 = Schema.Struct({
  "minimum": Schema.Number,
  "maximum": Schema.Number,
  "steps": Schema.Number,
})

const Output___type_69 = Schema.Struct({
  "parameterValue": Schema.Number,
  "resultRef": Schema.String,
  "value": Schema.suspend(() => Output_Shape_31),
})

const Output___type_71 = Schema.Struct({
  "state": Schema.Literal("exact"),
  "value": Schema.Number,
  "evidenceRefs": Schema.Array(Schema.suspend(() => Output_BusinessEvidenceRef_9)),
})

const Output___type_72 = Schema.Struct({
  "state": Schema.Literal("sampled"),
  "interval": Schema.suspend(() => Output___type_73),
  "evidenceRefs": Schema.Array(Schema.suspend(() => Output_BusinessEvidenceRef_9)),
})

const Output___type_73 = Schema.Struct({
  "minimum": Schema.Number,
  "maximum": Schema.Number,
})

const Output___type_74 = Schema.Struct({
  "state": Schema.Literal("unavailable"),
  "reason": Schema.String,
})

const Output___type_76 = Schema.Struct({
  "kind": Schema.Literal("portfolio"),
  "portfolioResultRef": Schema.String,
  "portfolio": Schema.suspend(() => Output_PortfolioResult_77),
})

const Output___type_80 = Schema.Struct({
  "scenarioResultRef": Schema.String,
  "scenario": Schema.suspend(() => Output_ScenarioResult_28),
  "comparisonRef": Schema.String,
  "comparison": Schema.suspend(() => Output_ScenarioComparison_62),
})

const Output___type_84 = Schema.Struct({
  "metricRef": Schema.String,
  "comparisonRef": Schema.String,
  "context": Schema.suspend(() => Output_ProductContext_59),
  "version": Schema.Number,
  "engineVersion": Schema.String,
  "values": Schema.Array(Schema.suspend(() => Output_ProjectionValue_85)),
})

const Output___type_88 = Schema.Struct({
  "field": Schema.String,
  "reason": Schema.suspend(() => Output_Shape_89),
})

export const SfSourceDomainProjection = Output_DomainProjection_58
export const SfSourceRecordSource = Output_SourceRef_32
export const SfSourceCostCoverageBasis = Output_CostCoverageBasis_45

export const SfSourceEvidenceInput = Input_BusinessEvidenceRef
