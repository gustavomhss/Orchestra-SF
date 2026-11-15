/**
 * W16/A04: 21 explicit Decision operation schemas. Every input uses the exact
 * existing producer discriminator and preserves case version/CAS. Fields are
 * public references and never carry authority or a fabricated receipt.
 * Source pins: choice 369c71b, decision-domain 5cb8e4e, portfolio 6cbfc37,
 * procurement decision fa83ce3, workbench 7857418.
 * F02 must apply closed-object decoding, same-origin owner expectations,
 * no-store, and no automatic retry for every POST (including POST reads).
 */
import { Schema } from "effect"
import {
  SfSourceInput_sf_case_draft,
  SfSourceInput_sf_change_prepare,
  SfSourceInput_sf_question_prepare,
  SfSourceInput_sf_scenario_simulate,
  SfSourceInput_sf_scenario_compare,
  SfSourceCaseRead, SfSourceCaseDraft, SfSourceChangePrepare,
  SfSourceQuestionPrepare, SfSourceScenarioResult, SfSourceDomainProjection,
  SfSourceRecordSource, SfSourceCostCoverageBasis, SfSourceEvidenceInput,
} from "./decisions/source-contracts.ts"

const text = Schema.String.pipe(Schema.minLength(1), Schema.maxLength(16384))
const digest = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/))
const version = Schema.Int.pipe(Schema.greaterThanOrEqualTo(1))
const nonnegative = Schema.Int.pipe(Schema.greaterThanOrEqualTo(0))
const surface = Schema.Literal("dashboard", "planner", "procurement")
const period = Schema.Struct({ start: Schema.String.pipe(Schema.pattern(/^\d{4}-\d{2}-\d{2}$/)), end: Schema.String.pipe(Schema.pattern(/^\d{4}-\d{2}-\d{2}$/)) })
export const SfDecisionCaseRef = Schema.Struct({id:text,incarnation:text,version})
const alternativeRef = Schema.Struct({id:text,version})
const evidenceBase = {
 schema:Schema.Literal("sf-evidence-v1"),refId:text,installationId:text,projectId:text,refDigest:text,
 evidenceLevel:Schema.Literal("observed","claim","assumption","proposal","decision"),
}
const recordEvidence = Schema.Struct({
 ...evidenceBase,kind:Schema.Literal("record"),
 target:Schema.Struct({surface,recordType:text,recordId:text,incarnation:text,version:nonnegative,fields:Schema.Array(text),period:Schema.optional(period),projectionDigest:text}),
})
const coverageEntry = Schema.Union(
 Schema.Struct({status:Schema.Literal("included"),categoryId:text,componentRefs:Schema.Array(text),evidenceRefs:Schema.Array(SfSourceEvidenceInput),scopeNote:Schema.String}),
 Schema.Struct({status:Schema.Literal("not-applicable"),categoryId:text,justification:text,evidenceRefs:Schema.Array(SfSourceEvidenceInput)}),
 Schema.Struct({status:Schema.Literal("pending"),categoryId:text,reason:text,questionRef:Schema.optional(text)}),
)
const coverageAssessmentBase = {basisId:text,basisVersion:nonnegative,alternativeId:text,alternativeVersion:nonnegative,currency:text,horizon:period,issues:Schema.Array(text),evaluatedSourceRefs:Schema.Array(SfSourceEvidenceInput)}
const coverageAssessment = Schema.Union(
 Schema.Struct({...coverageAssessmentBase,coverageState:Schema.Literal("complete"),entries:Schema.Array(Schema.Union(
  Schema.Struct({status:Schema.Literal("included"),categoryId:text,componentRefs:Schema.Array(text),evidenceRefs:Schema.Array(SfSourceEvidenceInput),scopeNote:Schema.String}),
  Schema.Struct({status:Schema.Literal("not-applicable"),categoryId:text,justification:text,evidenceRefs:Schema.Array(SfSourceEvidenceInput)})
 )),derivedMissingCategoryIds:Schema.Tuple()}),
 Schema.Struct({...coverageAssessmentBase,coverageState:Schema.Literal("pending","unavailable"),entries:Schema.Array(coverageEntry),derivedMissingCategoryIds:Schema.Array(text)})
)
const coverageValue = Schema.Struct({
 schema:Schema.Literal("sf-baseline-coverage-v1"),coverageRef:text,caseRef:SfDecisionCaseRef,caseScopeDigest:text,
 source:recordEvidence,basis:SfSourceCostCoverageBasis,assessment:coverageAssessment,version:version,
 principalRef:text,accessRevision:text,policyVersion:text,installationId:text,projectId:text,createdAt:text,classificationDigest:digest,recordDigest:digest,
})
const classification = Schema.Struct({
 schema:Schema.Literal("sf-coverage-classification-v1"),caseRef:SfDecisionCaseRef,basis:SfSourceCostCoverageBasis,source:recordEvidence,
 version:nonnegative,mappings:Schema.Array(Schema.Struct({
   entry:Schema.Struct({status:Schema.Literal("included"),categoryId:text,componentRefs:Schema.Array(text),evidenceRefs:Schema.Array(SfSourceEvidenceInput),scopeNote:Schema.String}),
   components:Schema.Array(Schema.Struct({id:text,currency:text,period,sourceRefs:Schema.Array(SfSourceRecordSource)}))
 })),notApplicableEntries:Schema.optional(Schema.Array(Schema.Struct({status:Schema.Literal("not-applicable"),categoryId:text,justification:text,evidenceRefs:Schema.Array(SfSourceEvidenceInput)}))),classificationDigest:digest,
})
const sensitivity = Schema.Struct({baselineRef:text,parameterRef:text,parameterUnit:text,resultUnit:text,engineVersion:text,sourceRefs:Schema.Array(SfSourceEvidenceInput)})
const criterionRequest = Schema.Struct({caseRef:SfDecisionCaseRef,criterionId:text,metricRef:text,operator:Schema.Literal("lte","gte","eq"),value:Schema.Number,unit:text,period,evidenceRefs:Schema.Array(SfSourceEvidenceInput),expectedRuleVersion:nonnegative,sensitivity:Schema.optional(sensitivity)})
const criterionValue = Schema.Struct({
 schema:Schema.Literal("sf-criterion-rule-v1"),caseRef:SfDecisionCaseRef,criterionId:text,metricRef:text,operator:Schema.Literal("lte","gte","eq"),
 value:Schema.Number,unit:text,period,evidenceRefs:Schema.Array(SfSourceEvidenceInput),sensitivity:Schema.optional(sensitivity),
 ruleRef:text,version,criterionDigest:digest,principalRef:text,accessRevision:text,policyVersion:text,installationId:text,projectId:text,createdAt:text,recordDigest:digest,
})
const selectionInput = Schema.Struct({caseRef:SfDecisionCaseRef,baselineAlternativeId:text,alternativeId:text,criteria:Schema.Array(text),expectedVersion:nonnegative})
const selectionValue = Schema.Struct({
 schema:Schema.Literal("sf-portfolio-selection-v1"),selectionRef:text,caseRef:SfDecisionCaseRef,
 baselineAlternativeId:text,alternativeId:text,baselineRef:text,alternativeRef:text,criteria:Schema.Array(text),
 comparisonDigest:digest,version,principalRef:text,accessRevision:text,policyVersion:text,createdAt:text,selectionDigest:digest,
})
const receipt = Schema.Struct({caseRef:SfDecisionCaseRef,resultRef:Schema.optional(text)})
const reviewFieldValue = Schema.Union(Schema.Null,Schema.String,Schema.Number,Schema.Boolean)
const reviewField = Schema.Struct({field:text,before:reviewFieldValue,after:reviewFieldValue,beforeCurrency:Schema.optional(text),afterCurrency:Schema.optional(text)})
const receiptView = Schema.Struct({
 id:text,idempotencyKey:text,commandDigest:digest,targetIncarnation:text,principalRef:text,surface,version:nonnegative,at:text,
 status:Schema.Literal("applied","awaiting-approval","conflict","failed","cancelled"),resultRef:Schema.optional(text),errors:Schema.Array(text),
})
const reviewValue = Schema.Struct({reviewDigest:digest,changeId:text,choiceId:text,surface,
 target:Schema.Struct({type:text,id:text,label:Schema.optional(text)}),
 expectedVersion:nonnegative,state:Schema.Literal("planned","applied","awaiting-approval","conflict","failed","cancelled"),fields:Schema.Array(reviewField),receipt:Schema.optional(receiptView)})
const resultFailure = Schema.Struct({
 status:Schema.Literal("needs-input","stale","denied","unavailable","conflict","provider-conflict","failed","invalid"),
 reason:Schema.optional(Schema.String),
})
const portResult = <A,I,R>(value:Schema.Schema<A,I,R>) => Schema.Union(Schema.Struct({status:Schema.Literal("ok"),value}),resultFailure)
const workbenchResult = <A,I,R>(value:Schema.Schema<A,I,R>) => Schema.Union(Schema.Struct({status:Schema.Literal("ok"),value,outputRef:Schema.optional(text)}),resultFailure)
const choiceOptions = Schema.Struct({
 cases:Schema.Array(Schema.Struct({ref:text,title:text,version:nonnegative})),
 selected:Schema.optional(Schema.Struct({caseRef:SfDecisionCaseRef,title:text,choices:Schema.Array(Schema.Struct({
   id:text,title:text,reason:Schema.String,request:Schema.optional(Schema.Struct({caseRef:SfDecisionCaseRef,choiceId:text,alternativeRef,coverageRef:text}))
 }))})),
})
const choicePreparation = Schema.Struct({caseRef:SfDecisionCaseRef,choiceId:text,alternativeRef,coverageRef:text})
const choicePromotion = Schema.Struct({caseRef:SfDecisionCaseRef,choiceId:text,choiceDigest:digest,alternativeRef,resultRef:text,resultDigest:digest,scenario:SfSourceInput_sf_scenario_simulate,coverageRef:text})
const choiceReview = Schema.Struct({promotion:choicePromotion,bindingDigest:digest,historical:SfSourceScenarioResult,current:SfSourceScenarioResult})
const controlsValue = Schema.Struct({
 cases:Schema.Array(Schema.Struct({ref:text,title:text,version:nonnegative})),
 actions:Schema.Array(text),accessRevision:text,fingerprint:digest,selectionFingerprint:digest,
 selected:Schema.optional(Schema.Struct({
   ref:text,caseRef:SfDecisionCaseRef,decision:SfSourceCaseRead.fields.case,
   forecasts:Schema.Array(Schema.Struct({source:recordEvidence,label:text})),
   forecast:Schema.optional(Schema.Struct({source:recordEvidence,projection:SfSourceDomainProjection,expectedVersion:Schema.optional(nonnegative),classification:Schema.optional(classification),coverage:Schema.optional(Schema.Struct({coverageRef:text,basis:SfSourceCostCoverageBasis,assessment:coverageAssessment}))})),
   scenarios:Schema.Array(Schema.Struct({ref:text,title:text,alternativeId:text,parameters:Schema.Array(Schema.Struct({ref:text,label:text}))})),
   rules:Schema.Array(Schema.Struct({id:text,expectedVersion:Schema.optional(nonnegative)})),
   units:Schema.optional(sensitivity),unitSelection:Schema.optional(Schema.Struct({scenarioRef:text,baselineRef:text,parameterRef:text})),
   procurementEvidence:Schema.optional(Schema.Struct({sources:Schema.Array(Schema.Struct({source:recordEvidence,projection:SfSourceDomainProjection,label:text}))})),
   evidence:Schema.Array(Schema.Struct({evidence:recordEvidence,source:SfSourceRecordSource,fields:Schema.Array(text),label:text})),
   recipients:Schema.Array(Schema.Struct({ref:text,label:text})),
   conditions:Schema.Array(Schema.Struct({label:text,revision:nonnegative})),
 }))
})
const sourceRef = Schema.Struct({surface,type:text,id:text,incarnation:text,version:nonnegative,fields:Schema.Array(text),period,observedAt:text})
const decisionCondition = Schema.Struct({caseRef:SfDecisionCaseRef,choiceId:text,scenarioRefs:Schema.Tuple(text,text),source:sourceRef,
 evidence:recordEvidence,fields:Schema.Array(text),period,criterionId:text,recipientRef:text,destination:text,label:text})
const decisionCoverage = Schema.Struct({caseRef:SfDecisionCaseRef,source:recordEvidence,basis:SfSourceCostCoverageBasis,entries:Schema.Array(coverageEntry),expectedVersion:nonnegative})
const prepareChanges = Schema.Struct({caseRef:SfDecisionCaseRef,choiceId:text,operations:SfSourceInput_sf_change_prepare.fields.operations})
const decisionReview = Schema.Struct({caseRef:SfDecisionCaseRef,choiceId:text,changeId:text})
const decisionRecover = Schema.Union(
 Schema.Struct({caseRef:SfDecisionCaseRef,choiceId:text,changeId:text,reviewDigest:digest}),
 Schema.Struct({purpose:Schema.Literal("recover"),caseRef:SfDecisionCaseRef,choiceId:text,changeId:text})
)
const caseStamp = Schema.Struct({installationId:text,projectId:text,hostId:text,principalRef:text,policyVersion:text,accessRevision:text})
const caseListValue = Schema.Struct({cases:Schema.Array(Schema.Struct({caseRef:text,title:text,version:nonnegative}))})
const caseViewValue = Schema.Struct({projection:SfSourceCaseRead,returnTo:Schema.optional(text)})
const projectionResult = <A,I,R>(value:Schema.Schema<A,I,R>) => Schema.Union(Schema.Struct({status:Schema.Literal("ok"),context:caseStamp,value}),resultFailure)
const caseQuery = Schema.Struct({caseRef:text,returnTo:Schema.optional(text)})
const casesQuery = Schema.Struct({})
const controlsQuery = Schema.Struct({case:Schema.optional(text),source:Schema.optional(text),scenario:Schema.optional(text),baseline:Schema.optional(text),parameter:Schema.optional(text)})
const choiceQuery = Schema.Struct({case:Schema.optional(text)})
const committedReceipt = Schema.Struct({receiptId:text,surface,version:nonnegative,outcome:Schema.Literal("applied","conflict","failed")})

/** mode=workbench: listed -> encodeCaseRef -> sf_case_read each visible case; catalog workbench */
export const SfProjectionCases = {operationId:"projection.cases",input:casesQuery,output:projectionResult(caseListValue),method:"GET",pathTemplate:"{mount}/api/ui/projections/cases",effect:"read",responseMode:"json"} as const

/** mode=workbench-case: decodeSfOperationInput/Output(sf_case_read), contextualCaseReturn; catalog workbench */
export const SfProjectionCase = {operationId:"projection.case",input:caseQuery,output:projectionResult(caseViewValue),method:"GET",pathTemplate:"{mount}/api/ui/projections/case",effect:"read",responseMode:"json"} as const

/** mode=workbench-command;decodeSfOperationInput/Output(sf_case_draft); catalog workbench */
export const SfDecisionsCommandSfCaseDraft = {operationId:"decisions.command.sf_case_draft",input:Schema.Struct({operation:Schema.Literal("sf_case_draft"),input:SfSourceInput_sf_case_draft}),output:workbenchResult(SfSourceCaseDraft),method:"POST",pathTemplate:"{mount}/{surface}",effect:"prepare",responseMode:"json",fixedQuery:{"sf":"workbench-command"},fixedBodyDiscriminator:{"operation":"sf_case_draft"},maxRequestBytes:65536} as const

/** mode=workbench-command;decodeSfOperationInput/Output(sf_question_prepare); catalog workbench */
export const SfDecisionsCommandSfQuestionPrepare = {operationId:"decisions.command.sf_question_prepare",input:Schema.Struct({operation:Schema.Literal("sf_question_prepare"),input:SfSourceInput_sf_question_prepare}),output:workbenchResult(SfSourceQuestionPrepare),method:"POST",pathTemplate:"{mount}/{surface}",effect:"prepare",responseMode:"json",fixedQuery:{"sf":"workbench-command"},fixedBodyDiscriminator:{"operation":"sf_question_prepare"},maxRequestBytes:65536} as const

/** mode=workbench-command;decodeSfOperationInput/Output(sf_change_prepare); catalog workbench */
export const SfDecisionsCommandSfChangePrepare = {operationId:"decisions.command.sf_change_prepare",input:Schema.Struct({operation:Schema.Literal("sf_change_prepare"),input:SfSourceInput_sf_change_prepare}),output:workbenchResult(SfSourceChangePrepare),method:"POST",pathTemplate:"{mount}/{surface}",effect:"prepare",responseMode:"json",fixedQuery:{"sf":"workbench-command"},fixedBodyDiscriminator:{"operation":"sf_change_prepare"},maxRequestBytes:65536} as const

/** format=json branch; optional case query; catalog choice */
export const SfDecisionsChoiceRead = {operationId:"decisions.choice.read",input:choiceQuery,output:portResult(choiceOptions),method:"GET",pathTemplate:"{mount}/{surface}",effect:"read",responseMode:"json",fixedQuery:{"sf":"current-choice","format":"json"}} as const

/** valid(payload,mode=current-choice-prepare);runtime human action; catalog choice */
export const SfDecisionsCurrentChoicePrepare = {operationId:"decisions.current-choice-prepare",input:choicePreparation,output:portResult(choiceReview),method:"POST",pathTemplate:"{mount}/{surface}",effect:"prepare",responseMode:"json",fixedQuery:{"sf":"current-choice-prepare"}} as const

/** valid(payload,mode=current-choice-promote);runtime human action; catalog choice */
export const SfDecisionsCurrentChoicePromote = {operationId:"decisions.current-choice-promote",input:choicePromotion,output:portResult(Schema.Struct({caseRef:SfDecisionCaseRef,resultRef:text})),method:"POST",pathTemplate:"{mount}/{surface}",effect:"mutation",responseMode:"json",fixedQuery:{"sf":"current-choice-promote"}} as const

/** format=json; case/source/scenario/baseline/parameter query; catalog decision-controls */
export const SfDecisionsControlsRead = {operationId:"decisions.controls.read",input:controlsQuery,output:portResult(controlsValue),method:"GET",pathTemplate:"{mount}/{surface}",effect:"read",responseMode:"json",fixedQuery:{"sf":"decision-controls","format":"json"}} as const

/** valid(payload,mode=decision-coverage); catalog decision-controls */
export const SfDecisionsDecisionCoverage = {operationId:"decisions.decision-coverage",input:decisionCoverage,output:portResult(coverageValue),method:"POST",pathTemplate:"{mount}/{surface}",effect:"mutation",responseMode:"json",fixedQuery:{"sf":"decision-coverage"}} as const

/** valid(payload,mode=decision-criteria); catalog decision-controls */
export const SfDecisionsDecisionCriteria = {operationId:"decisions.decision-criteria",input:criterionRequest,output:portResult(criterionValue),method:"POST",pathTemplate:"{mount}/{surface}",effect:"mutation",responseMode:"json",fixedQuery:{"sf":"decision-criteria"}} as const

/** valid(payload,mode=decision-select-portfolio); catalog decision-controls */
export const SfDecisionsDecisionSelectPortfolio = {operationId:"decisions.decision-select-portfolio",input:selectionInput,output:portResult(selectionValue),method:"POST",pathTemplate:"{mount}/{surface}",effect:"mutation",responseMode:"json",fixedQuery:{"sf":"decision-select-portfolio"}} as const

/** valid(payload,mode=decision-condition); catalog decision-controls */
export const SfDecisionsDecisionCondition = {operationId:"decisions.decision-condition",input:decisionCondition,output:portResult(Schema.Struct({registered:Schema.Literal(true)})),method:"POST",pathTemplate:"{mount}/{surface}",effect:"mutation",responseMode:"json",fixedQuery:{"sf":"decision-condition"}} as const

/** actions[decision-choose];valid(mode,payload);withCase;producer dispatch; catalog portfolio */
export const SfDecisionsDecisionChoose = {operationId:"decisions.decision-choose",input:Schema.Struct({caseRef:SfDecisionCaseRef,alternativeId:text,alternativeVersion:version,comparison:SfSourceInput_sf_scenario_compare,criteria:Schema.Array(text),reason:text}),output:portResult(receipt),method:"POST",pathTemplate:"{mount}/{surface}",effect:"mutation",responseMode:"json",fixedQuery:{"sf":"decision-choose"}} as const

/** actions[decision-add-question];valid(mode,payload);withCase;producer dispatch; catalog portfolio */
export const SfDecisionsDecisionAddQuestion = {operationId:"decisions.decision-add-question",input:Schema.Struct({caseRef:SfDecisionCaseRef,questionRef:text}),output:portResult(receipt),method:"POST",pathTemplate:"{mount}/{surface}",effect:"mutation",responseMode:"json",fixedQuery:{"sf":"decision-add-question"}} as const

/** actions[decision-answer-question];valid(mode,payload);withCase;producer dispatch; catalog portfolio */
export const SfDecisionsDecisionAnswerQuestion = {operationId:"decisions.decision-answer-question",input:Schema.Struct({caseRef:SfDecisionCaseRef,questionId:text,answerRef:text}),output:portResult(receipt),method:"POST",pathTemplate:"{mount}/{surface}",effect:"mutation",responseMode:"json",fixedQuery:{"sf":"decision-answer-question"}} as const

/** actions[decision-promote];valid(mode,payload);withCase;producer dispatch; catalog portfolio */
export const SfDecisionsDecisionPromote = {operationId:"decisions.decision-promote",input:Schema.Struct({caseRef:SfDecisionCaseRef,title:text,scenario:SfSourceInput_sf_scenario_simulate,coverageRef:text,alternativeRef:Schema.optional(alternativeRef)}),output:portResult(receipt),method:"POST",pathTemplate:"{mount}/{surface}",effect:"mutation",responseMode:"json",fixedQuery:{"sf":"decision-promote"}} as const

/** actions[decision-prepare-changes];valid(mode,payload);withCase;producer dispatch; catalog portfolio */
export const SfDecisionsDecisionPrepareChanges = {operationId:"decisions.decision-prepare-changes",input:prepareChanges,output:portResult(receipt),method:"POST",pathTemplate:"{mount}/{surface}",effect:"prepare",responseMode:"json",fixedQuery:{"sf":"decision-prepare-changes"}} as const

/** actions[decision-review];valid(mode,payload);withCase;producer dispatch; catalog portfolio */
export const SfDecisionsDecisionReview = {operationId:"decisions.decision-review",input:decisionReview,output:portResult(reviewValue),method:"POST",pathTemplate:"{mount}/{surface}",effect:"read",responseMode:"json",fixedQuery:{"sf":"decision-review"}} as const

/** createProcurementDecisionHttp branch decision-apply; catalog decision-apply */
export const SfDecisionsDecisionApply = {operationId:"decisions.decision-apply",input:Schema.Struct({caseRef:SfDecisionCaseRef,choiceId:text,changeId:text,reviewDigest:digest}),output:portResult(committedReceipt),method:"POST",pathTemplate:"{mount}/{surface}",effect:"mutation",responseMode:"json",fixedQuery:{"sf":"decision-apply"}} as const

/** createProcurementDecisionHttp branch decision-recover; catalog decision-apply */
export const SfDecisionsDecisionRecover = {operationId:"decisions.decision-recover",input:decisionRecover,output:portResult(committedReceipt),method:"POST",pathTemplate:"{mount}/{surface}",effect:"mutation",responseMode:"json",fixedQuery:{"sf":"decision-recover"}} as const

export const SfDecisions = {operations:{
  "projection.cases":SfProjectionCases,
  "projection.case":SfProjectionCase,
  "decisions.command.sf_case_draft":SfDecisionsCommandSfCaseDraft,
  "decisions.command.sf_question_prepare":SfDecisionsCommandSfQuestionPrepare,
  "decisions.command.sf_change_prepare":SfDecisionsCommandSfChangePrepare,
  "decisions.choice.read":SfDecisionsChoiceRead,
  "decisions.current-choice-prepare":SfDecisionsCurrentChoicePrepare,
  "decisions.current-choice-promote":SfDecisionsCurrentChoicePromote,
  "decisions.controls.read":SfDecisionsControlsRead,
  "decisions.decision-coverage":SfDecisionsDecisionCoverage,
  "decisions.decision-criteria":SfDecisionsDecisionCriteria,
  "decisions.decision-select-portfolio":SfDecisionsDecisionSelectPortfolio,
  "decisions.decision-condition":SfDecisionsDecisionCondition,
  "decisions.decision-choose":SfDecisionsDecisionChoose,
  "decisions.decision-add-question":SfDecisionsDecisionAddQuestion,
  "decisions.decision-answer-question":SfDecisionsDecisionAnswerQuestion,
  "decisions.decision-promote":SfDecisionsDecisionPromote,
  "decisions.decision-prepare-changes":SfDecisionsDecisionPrepareChanges,
  "decisions.decision-review":SfDecisionsDecisionReview,
  "decisions.decision-apply":SfDecisionsDecisionApply,
  "decisions.decision-recover":SfDecisionsDecisionRecover,
}} as const
