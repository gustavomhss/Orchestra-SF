import { Schema } from "effect"
import {
  SfCaseIdentity, SfDomainProjection, SfEvidenceRef, SfNonEmpty, SfNonNegative,
  SfPeriod, SfPositive, SfRecordEvidence, SfSourceRef, SfSurface,
} from "./fields"

/**
 * Dedicated A13 collaboration DTOs. Authorizations and transaction fences stay
 * in the real collaboration producer; no privileged snapshot is decoded here.
 * Invalid/unknown variants cannot be read as successful source projections.
 */
export const SfMutation = Schema.Struct({
  expectedStorageVersion: SfNonNegative, idempotencyKey: SfNonEmpty,
}).annotate({ parseOptions: { onExcessProperty: "error" } })

export const SfReviewThreadContext = Schema.Struct({
  reviewRef: SfNonEmpty, reviewVersion: SfPositive, reviewDigest: SfNonEmpty, sectionId: SfNonEmpty,
})
export const SfThreadSourceContext = Schema.Struct({
  sourceRef: SfNonEmpty, sourceIncarnation: SfNonEmpty, observedVersion: SfPositive,
  period: SfPeriod, evidenceRefs: Schema.Array(SfEvidenceRef),
  reviewContext: Schema.optional(SfReviewThreadContext),
})
export const SfThreadMessage = Schema.Struct({
  id: SfNonEmpty, incarnation: SfNonEmpty, version: SfPositive, authorRef: SfNonEmpty,
  body: Schema.String, createdAt: Schema.String,
  sourceContext: Schema.optional(SfThreadSourceContext),
})
export const SfThreadDraft = Schema.Struct({
  kind: Schema.Literals(["comment", "clarification", "review"]),
  sourceRef: SfNonEmpty, sourceIncarnation: SfNonEmpty, observedVersion: SfPositive,
  period: SfPeriod, recipientRef: Schema.optional(SfNonEmpty),
  evidenceRefs: Schema.Array(SfEvidenceRef),
  body: SfNonEmpty, reviewContext: Schema.optional(SfReviewThreadContext),
}).annotate({ parseOptions: { onExcessProperty: "error" } })

export const SfThread = Schema.Struct({
  id: SfNonEmpty, kind: Schema.Literals(["comment", "clarification", "review"]),
  sourceRef: SfNonEmpty, sourceIncarnation: SfNonEmpty, observedVersion: SfPositive,
  period: SfPeriod, recipientRef: Schema.optional(SfNonEmpty),
  state: Schema.Literals(["open", "resolved"]), messages: Schema.Array(SfThreadMessage),
  evidenceRefs: Schema.Array(SfEvidenceRef),
})

export const SfRecipientMutationReceipt = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("recipient-thread-action-v1"),
    threadId: SfNonEmpty, principalRef: SfNonEmpty, idempotencyKey: SfNonEmpty,
    commandDigest: Schema.String, intentDigest: Schema.String, sourceIncarnation: SfNonEmpty,
    action: Schema.Literal("reply"),
    reply: Schema.Struct({ id: SfNonEmpty, incarnation: SfNonEmpty, version: SfPositive }),
  }),
  Schema.Struct({
    kind: Schema.Literal("recipient-thread-action-v1"),
    threadId: SfNonEmpty, principalRef: SfNonEmpty, idempotencyKey: SfNonEmpty,
    commandDigest: Schema.String, intentDigest: Schema.String, sourceIncarnation: SfNonEmpty,
    action: Schema.Literal("resolve"),
  }),
])
export const SfRecipientThread = Schema.Struct({
  id: SfNonEmpty, kind: Schema.Literals(["comment", "clarification", "review"]),
  recipientRef: Schema.optional(SfNonEmpty),
  state: Schema.Literals(["open", "resolved"]), messages: Schema.Array(SfThreadMessage),
  observed: Schema.Struct({ version: SfPositive, period: SfPeriod }),
  current: Schema.Struct({
    sourceRef: SfRecordEvidence, evidenceRefs: Schema.Array(SfEvidenceRef),
  }),
  historical: Schema.optional(SfThreadSourceContext),
  continuity: Schema.Literals(["unchanged", "historical"]),
  mutationReceipt: Schema.optional(SfRecipientMutationReceipt),
})
export const SfThreadReadResult = Schema.Union([
  // A recipient projection must be selected before the base thread branch,
  // otherwise a non-strict union could erase its current reissued source.
  Schema.Struct({
    ...SfRecipientThread.fields,
    sourceRef: SfNonEmpty, sourceIncarnation: SfNonEmpty, observedVersion: SfPositive,
    period: SfPeriod, evidenceRefs: Schema.Array(SfEvidenceRef),
  }),
  SfThread,
])
export const SfThreadActionResult = Schema.Union([
  SfThread,
  Schema.Struct({
    ...SfRecipientThread.fields,
    mutationReceipt: SfRecipientMutationReceipt,
  }),
])

export const SfThreadHistory = Schema.Struct({
  message: SfThreadMessage, ...SfThreadSourceContext.fields,
})
export const SfThreadEditResult = Schema.Struct({
  id: SfNonEmpty, messageId: SfNonEmpty, version: SfPositive,
})

export const SfRelationPair = Schema.Struct({
  fromRef: SfNonEmpty, toRef: SfNonEmpty, kind: SfNonEmpty,
  evidenceRefs: Schema.Array(SfEvidenceRef), recipientRef: Schema.optional(SfNonEmpty),
}).annotate({ parseOptions: { onExcessProperty: "error" } })
export const SfRelation = Schema.Struct({
  id: SfNonEmpty, fromRef: SfNonEmpty, toRef: SfNonEmpty, kind: SfNonEmpty,
  confirmedBy: SfNonEmpty, confirmedAt: Schema.String, evidenceRefs: Schema.Array(SfEvidenceRef),
})
export const SfConfirmedRelations = Schema.Struct({
  relations: Schema.Array(SfRelation),
})

export const SfHotTopicIntent = Schema.Struct({
  correlationKey: SfNonEmpty, sourceRefs: Schema.Array(SfEvidenceRef),
  action: SfNonEmpty, owner: Schema.String, due: Schema.String,
  priority: Schema.Literals(["critical", "high", "normal"]),
  notes: Schema.String,
}).annotate({ parseOptions: { onExcessProperty: "error" } })
export const SfHotTopic = Schema.Struct({
  id: SfNonEmpty, version: SfNonNegative, action: Schema.String, owner: Schema.String,
  due: Schema.String, status: Schema.String, priority: Schema.String, notes: Schema.String,
})
export const SfHandoffResult = Schema.Struct({
  topic: SfHotTopic, state: Schema.Literals(["created", "existing", "updated", "linked"]),
  relationId: SfNonEmpty,
})
export const SfHandoffValues = Schema.Struct({
  action: Schema.optional(Schema.String), owner: Schema.optional(Schema.String),
  due: Schema.optional(Schema.String), status: Schema.optional(Schema.String),
  priority: Schema.optional(Schema.String), notes: Schema.optional(Schema.String),
}).annotate({ parseOptions: { onExcessProperty: "error" } })

export const SfConfirmationScope = Schema.Struct({
  sourceRef: Schema.Struct({
    surface: SfSurface, type: Schema.String, id: SfNonEmpty, incarnation: SfNonEmpty,
  }),
  fields: Schema.Array(Schema.String),
  period: SfPeriod, materialDependencies: Schema.Array(SfSourceRef),
  scopeDefinitionVersion: SfNonEmpty,
}).annotate({ parseOptions: { onExcessProperty: "error" } })
export const SfConfirmationRecord = Schema.Struct({
  id: SfNonEmpty,
  sourceRef: SfConfirmationScope.fields.sourceRef,
  observedSourceVersion: SfPositive, observedScopeFingerprint: SfNonEmpty,
  scope: SfConfirmationScope, authorId: SfNonEmpty, confirmedAt: Schema.String, auditRef: SfNonEmpty,
})
export const SfConfirmationPrepareValue = Schema.Struct({
  sourceVersion: SfPositive, incarnation: SfNonEmpty, scopeFingerprint: SfNonEmpty,
  evidence: SfRecordEvidence, projection: SfDomainProjection,
  selectionRef: Schema.optional(Schema.String.check(Schema.isPattern(/^confirmation-selection:[a-f0-9]{64}$/))),
})
export const SfPreparedConfirmationSelection = Schema.Struct({
  kind: Schema.Literal("prepared-selection"),
  selectionRef: Schema.String.check(Schema.isPattern(/^confirmation-selection:[a-f0-9]{64}$/)),
  scope: SfConfirmationScope,
  observation: SfConfirmationPrepareValue,
})
export const SfConfirmationProjection = Schema.Union([
  Schema.Struct({
    confirmationId: SfNonEmpty, evaluatedSourceVersion: SfNonNegative,
    evaluatedAt: Schema.String, state: Schema.Literal("valid"),
    reason: Schema.Literal("unchanged-scope"), scopeFingerprint: SfNonEmpty,
  }),
  Schema.Struct({
    confirmationId: SfNonEmpty, evaluatedSourceVersion: SfNonNegative,
    evaluatedAt: Schema.String, state: Schema.Literal("stale"),
    reason: Schema.Literals(["material-change", "dependency-change", "source-removed", "source-replaced"]),
    scopeFingerprint: Schema.optional(Schema.String),
  }),
  Schema.Struct({
    confirmationId: SfNonEmpty, evaluatedSourceVersion: SfNonNegative,
    evaluatedAt: Schema.String, state: Schema.Literal("unavailable"),
    reason: Schema.Literals(["access-unavailable", "dependency-unavailable"]),
  }),
])

export const SfQuestionProposal = Schema.Struct({
  caseRef: SfNonEmpty, question: SfNonEmpty,
  criterionRef: Schema.optional(SfNonEmpty), recipientRef: Schema.optional(SfNonEmpty),
  evidenceRefs: Schema.Array(SfEvidenceRef), expectedCaseVersion: SfPositive,
})
export const SfUiPreparationReceipt = Schema.Struct({
  kind: Schema.Literal("ui"), operation: Schema.Literal("sf_question_prepare"),
  handlerExport: Schema.Literal("prepareQuestion"), inputDigest: Schema.String,
  resultDigest: Schema.String, principalRef: SfNonEmpty, callId: SfNonEmpty,
  accessRevision: SfNonEmpty, at: Schema.String, requestId: SfNonEmpty,
})
export const SfPreparedQuestion = Schema.Struct({
  kind: Schema.Literal("prepared"), result: SfQuestionProposal, receipt: SfUiPreparationReceipt,
})
export const SfQuestionContribution = Schema.Struct({
  kind: Schema.Literal("contribution"), outputRef: SfNonEmpty,
  outputDigest: SfNonEmpty, caseRef: SfCaseIdentity, result: SfQuestionProposal,
})
export const SfQuestionConsumption = Schema.Struct({
  proposal: Schema.Union([SfPreparedQuestion, SfQuestionContribution]),
  sourceRef: SfNonEmpty, period: SfPeriod, mutation: SfMutation,
}).annotate({ parseOptions: { onExcessProperty: "error" } })

export const SfQuestionOrigin = Schema.Struct({
  schema: Schema.Literal("sf-question-origin-v1"),
  caseRef: SfCaseIdentity, caseDigest: SfNonEmpty, horizon: SfPeriod,
  identity: SfNonEmpty, commandDigest: SfNonEmpty, proposalDigest: SfNonEmpty,
  principalRef: SfNonEmpty, installationId: SfNonEmpty, projectId: SfNonEmpty,
  criterionRef: Schema.optional(SfNonEmpty),
  provenance: Schema.Union([
    Schema.Struct({
      kind: Schema.Literal("prepared"), callId: SfNonEmpty, receiptDigest: SfNonEmpty,
    }),
    Schema.Struct({
      kind: Schema.Literal("contribution"), outputRef: SfNonEmpty,
      outputDigest: SfNonEmpty, runRef: SfNonEmpty, runDigest: SfNonEmpty,
      envelopeDigest: SfNonEmpty,
    }),
  ]),
})
export const SfConsumedQuestion = Schema.Struct({
  ...SfThread.fields, questionOrigin: SfQuestionOrigin,
})

export const SfAnswerPrepareValue = Schema.Struct({
  observationRef: SfNonEmpty, observedSourceVersion: SfPositive,
  expectedScopeFingerprint: SfNonEmpty, answerRef: SfNonEmpty,
  answer: Schema.String, authorRef: SfNonEmpty, scope: SfConfirmationScope,
  reviewContext: Schema.optional(SfReviewThreadContext),
  // The host only emits these when its observed source actually supplies them.
  evidence: Schema.optional(SfRecordEvidence),
  projection: Schema.optional(SfDomainProjection),
})
export const SfAnswerConfirmMutation = Schema.Struct({
  expectedStorageVersion: SfNonNegative, idempotencyKey: SfNonEmpty,
  observationRef: SfNonEmpty, observedSourceVersion: SfPositive,
  expectedScopeFingerprint: SfNonEmpty,
}).annotate({ parseOptions: { onExcessProperty: "error" } })
export const SfAnswerConfirmation = Schema.Struct({
  answerRef: SfNonEmpty, observedVersion: SfPositive,
})
export const SfAnswerReadValue = Schema.Struct({
  answerRef: SfNonEmpty, answer: Schema.String, authorRef: SfNonEmpty,
  observedVersion: SfPositive, reviewContext: Schema.optional(SfReviewThreadContext),
})

export const SfSelectionDraft = Schema.Struct({
  caseRef: SfNonEmpty, period: SfPeriod, sourceRefs: Schema.Array(SfEvidenceRef),
  procurementSelectionRef: Schema.optional(SfNonEmpty),
}).annotate({ parseOptions: { onExcessProperty: "error" } })
export const SfSelection = Schema.Struct({
  selectionRef: SfNonEmpty, period: SfPeriod,
}).annotate({ parseOptions: { onExcessProperty: "error" } })
export const SfSelectionList = Schema.Array(Schema.Struct({
  selectionRef: SfNonEmpty, period: SfPeriod,
  state: Schema.Literals(["active", "unavailable"]),
}))
export const SfAuthorizedWorkList = Schema.Struct({
  items: Schema.Array(Schema.Struct({
    actionRef: Schema.String, sourceRefs: Schema.Array(SfEvidenceRef),
    state: Schema.String, ownerRef: Schema.String,
  })),
})
export const SfWorkDestination = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("thread"), threadId: SfNonEmpty }),
  Schema.Struct({ kind: Schema.Literal("hot-topic"), topicId: SfNonEmpty }),
  Schema.Struct({ kind: Schema.Literal("procurement-request"), recordId: SfNonEmpty, incarnation: SfNonEmpty }),
  Schema.Struct({ kind: Schema.Literal("confirmation"), confirmationId: SfNonEmpty }),
  Schema.Struct({ kind: Schema.Literal("signal"), ref: SfNonEmpty }),
])
export const SfWorkPresentationItem = Schema.Struct({
  kind: Schema.Literals(["clarification", "handoff", "procurement", "confirmation", "signal"]),
  actionRef: SfNonEmpty, title: Schema.NullOr(Schema.String), ownerRef: Schema.String,
  ownerLabel: Schema.optional(Schema.String), approvalStage: Schema.optional(Schema.String),
  reason: Schema.optional(Schema.String), due: Schema.optional(Schema.String),
  period: Schema.optional(SfPeriod),
  sourceVersion: Schema.optional(SfNonNegative), observedVersion: Schema.optional(SfNonNegative),
  state: Schema.String, destination: Schema.optional(SfWorkDestination),
  sourceRefs: Schema.Array(SfEvidenceRef),
  reviewContexts: Schema.optional(Schema.Array(Schema.Struct({
    closureRef: SfNonEmpty, reviewRef: SfNonEmpty,
    reviewVersion: SfPositive, reviewDigest: SfNonEmpty,
  }))),
  reviewContext: Schema.optional(SfReviewThreadContext),
})
export const SfWorkPresentation = Schema.Struct({
  list: SfAuthorizedWorkList, items: Schema.Array(SfWorkPresentationItem),
})
export const SfCycle = Schema.Struct({
  caseRef: SfNonEmpty, period: SfPeriod, participants: Schema.Array(Schema.String),
  questions: Schema.Array(Schema.Struct({
    id: SfNonEmpty, text: Schema.String, state: Schema.Literals(["open", "answered"]),
    answerRef: Schema.optional(Schema.String),
  })),
  work: SfAuthorizedWorkList, state: Schema.Literals(["empty", "active"]),
})
export const SfRecipientList = Schema.Array(Schema.Struct({
  id: SfNonEmpty, name: SfNonEmpty,
}))
