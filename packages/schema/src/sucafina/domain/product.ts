import { Schema } from "effect"
import { NonNegativeInt, optional } from "../../schema"
import {
  SfDomainProductCaseRef, SfDomainProductPeriod, SfDomainProductResult,
  SfDomainProductEvidence,
} from "./fields"

/** Matches the admitted, closed dashboard-http dispatch branches. */
export const SfDomainDashboardTarget = Schema.Struct({
  surface: Schema.Literal("dashboard"), type: Schema.Literal("hotTopics"),
  id: Schema.String, incarnation: Schema.String, version: NonNegativeInt,
  fields: Schema.Array(Schema.String),
  period: SfDomainProductPeriod, observedAt: Schema.String,
})
const fields = Schema.Struct({
  action: Schema.String, owner: Schema.String, due: Schema.String,
  priority: Schema.Literals(["critical", "high", "normal"]), notes: Schema.String,
})
const draftEvidence = SfDomainProductEvidence
const recordEvidence = Schema.Struct({
  schema: Schema.Literal("sf-evidence-v1"), kind: Schema.Literal("record"),
  refId: Schema.String, refDigest: Schema.String,
  installationId: Schema.String, projectId: Schema.String,
  evidenceLevel: Schema.Literals(["observed", "claim", "assumption", "proposal", "decision"]),
  target: Schema.Struct({
    surface: Schema.Literal("dashboard"), recordType: Schema.String, recordId: Schema.String,
    incarnation: Schema.String, version: NonNegativeInt,
    fields: Schema.Array(Schema.String),
    period: optional(SfDomainProductPeriod), projectionDigest: Schema.String,
  }),
})
export const SfDomainDashboardInputs = {
  workbench: Schema.Struct({
    page: Schema.String, period: optional(SfDomainProductPeriod),
  }),
  source: Schema.Struct({
    recordId: Schema.String, period: SfDomainProductPeriod,
  }),
  draft: Schema.Struct({
    caseRef: SfDomainProductCaseRef,
    target: SfDomainDashboardTarget,
    targetEvidence: draftEvidence,
    fields,
    sourceRefs: Schema.Array(recordEvidence),
    expectedVersion: NonNegativeInt,
    draftRef: optional(Schema.String),
  }),
  draftRead: Schema.Struct({
    caseRef: SfDomainProductCaseRef,
    targetEvidence: draftEvidence,
    draftRef: optional(Schema.String),
  }),
  draftOutcome: Schema.Struct({ caseRef: SfDomainProductCaseRef }),
  drafts: Schema.Struct({
    id: Schema.String, incarnation: Schema.String, version: NonNegativeInt,
  }),
  operation: Schema.Struct({
    caseRef: SfDomainProductCaseRef, draftRef: Schema.String,
    operation: Schema.Struct({
      kind: Schema.Literal("replace"), targetRef: Schema.String, replacementRef: Schema.String,
    }),
  }),
  prepare: Schema.Struct({
    caseRef: SfDomainProductCaseRef, choiceId: Schema.String, draftRef: Schema.String,
  }),
  review: Schema.Struct({
    caseRef: SfDomainProductCaseRef, choiceId: Schema.String, changeId: Schema.String,
  }),
  recover: Schema.Struct({
    purpose: Schema.Literal("recover"),
    caseRef: SfDomainProductCaseRef, choiceId: Schema.String, changeId: Schema.String,
  }),
  apply: Schema.Struct({
    caseRef: SfDomainProductCaseRef, choiceId: Schema.String, changeId: Schema.String,
    reviewDigest: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  }),
} as const

export const SfDomainDashboardOutput = SfDomainProductResult
