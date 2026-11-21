import { Schema } from "effect"
import { sfPortResult, SfCaseIdentity, SfEvidenceRef, SfNonEmpty, SfNonNegative, SfPeriod, SfPositive } from "./fields"
import {
  SfAnswerConfirmMutation, SfAnswerConfirmation, SfAnswerPrepareValue, SfAnswerReadValue,
  SfConfirmedRelations, SfConfirmationPrepareValue, SfConfirmationProjection, SfConfirmationRecord,
  SfConfirmationScope, SfPreparedConfirmationSelection, SfConsumedQuestion, SfCycle, SfHandoffResult, SfHandoffValues, SfHotTopicIntent,
  SfMutation, SfQuestionConsumption, SfQuestionContribution, SfRecipientList, SfRelation, SfRelationPair,
  SfSelection, SfSelectionDraft, SfSelectionList, SfThread, SfThreadActionResult, SfThreadDraft,
  SfThreadEditResult, SfThreadHistory, SfThreadReadResult, SfWorkPresentation,
} from "./contracts"

/** Empty collaboration reads have NO admitted fields. Effect 4's empty Struct
 * does not reject excess keys on its own; the record's Never value rejects
 * any injected field during decodeUnknownSync / transport decodeUnknownOption.
 */
const SfClosedEmptyInput = Schema.Record(Schema.String, Schema.Never).check(Schema.isMaxProperties(0))

/** A13 fixed allowlist of 29 existing admitted collaboration HTTP operations.
 *  No dynamic dispatch, permission inference, server proxy or browser-side state.
 *  Registry bindings/fixed query are composed only by integrator 114.
 */
export const SfCollaborationQuestionConsume = {
  operationId: "collaboration.question-consume",
  input: SfQuestionConsumption,
  output: sfPortResult(SfConsumedQuestion),
} as const

export const SfCollaborationQuestionOutput = {
  operationId: "collaboration.question-output",
  input: Schema.Struct({ outputRef: SfNonEmpty, caseRef: SfCaseIdentity }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: sfPortResult(SfQuestionContribution),
} as const

export const SfCollaborationThreadCreate = {
  operationId: "collaboration.thread-create",
  input: Schema.Struct({ draft: SfThreadDraft, mutation: SfMutation }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: sfPortResult(SfThread),
} as const

export const SfCollaborationThreadRead = {
  operationId: "collaboration.thread-read",
  input: Schema.Struct({ id: SfNonEmpty }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: sfPortResult(SfThreadReadResult),
} as const

export const SfCollaborationThreadReply = {
  operationId: "collaboration.thread-reply",
  input: Schema.Struct({ id: SfNonEmpty, body: SfNonEmpty, mutation: SfMutation }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: sfPortResult(SfThreadActionResult),
} as const

export const SfCollaborationThreadResolve = {
  operationId: "collaboration.thread-resolve",
  input: Schema.Struct({ id: SfNonEmpty, mutation: SfMutation }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: sfPortResult(SfThreadActionResult),
} as const

export const SfCollaborationThreadEdit = {
  operationId: "collaboration.thread-edit",
  input: Schema.Struct({ id: SfNonEmpty, messageId: SfNonEmpty, expectedVersion: SfPositive, body: SfNonEmpty, mutation: SfMutation }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: sfPortResult(SfThreadEditResult),
} as const

export const SfCollaborationThreadHistory = {
  operationId: "collaboration.thread-history",
  input: Schema.Struct({ id: SfNonEmpty, messageId: SfNonEmpty, incarnation: SfNonEmpty, version: SfPositive }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: sfPortResult(SfThreadHistory),
} as const

export const SfCollaborationRelationCreate = {
  operationId: "collaboration.relation-create",
  input: Schema.Struct({ operation: Schema.Literal("create"), pair: SfRelationPair, mutation: SfMutation }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: sfPortResult(SfRelation),
} as const

export const SfCollaborationRelationRemove = {
  operationId: "collaboration.relation-remove",
  input: Schema.Struct({ operation: Schema.Literal("remove"), id: SfNonEmpty, pair: SfRelationPair, mutation: SfMutation }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: sfPortResult(SfRelation),
} as const

export const SfCollaborationRelationRead = {
  operationId: "collaboration.relation-read",
  input: Schema.Union([
    Schema.Struct({ recordRefs: Schema.Array(SfNonEmpty).check(Schema.isMinLength(1)) }).annotate({ parseOptions: { onExcessProperty: "error" } }),
    Schema.Struct({ relationRef: SfNonEmpty }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  ]),
  output: sfPortResult(SfConfirmedRelations),
} as const

export const SfCollaborationHandoffCreate = {
  operationId: "collaboration.handoff-create",
  input: Schema.Struct({ intent: SfHotTopicIntent, sourceRef: SfNonEmpty, relationKey: SfNonEmpty, recipientRef: Schema.optional(SfNonEmpty) }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: sfPortResult(SfHandoffResult),
} as const

export const SfCollaborationHandoffLink = {
  operationId: "collaboration.handoff-link",
  input: Schema.Struct({ topicRef: SfNonEmpty, sourceRefs: Schema.Array(SfEvidenceRef), sourceRef: SfNonEmpty, relationKey: SfNonEmpty, recipientRef: Schema.optional(SfNonEmpty) }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: sfPortResult(SfHandoffResult),
} as const

export const SfCollaborationHandoffUpdate = {
  operationId: "collaboration.handoff-update",
  input: Schema.Struct({ topicId: SfNonEmpty, expectedVersion: SfNonNegative, idempotencyKey: SfNonEmpty, values: SfHandoffValues, sourceRefs: Schema.Array(SfEvidenceRef), sourceRef: SfNonEmpty, relationKey: SfNonEmpty, recipientRef: Schema.optional(SfNonEmpty) }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: sfPortResult(SfHandoffResult),
} as const

export const SfCollaborationConfirmationPrepare = {
  operationId: "collaboration.confirmation-prepare",
  input: Schema.Struct({ scope: SfConfirmationScope }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: sfPortResult(SfConfirmationPrepareValue),
} as const

export const SfCollaborationConfirmationConfirm = {
  operationId: "collaboration.confirmation-confirm",
  input: Schema.Struct({ scope: SfConfirmationScope, observedSourceVersion: SfPositive, expectedScopeFingerprint: SfNonEmpty, expectedStorageVersion: SfNonNegative, idempotencyKey: SfNonEmpty }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: sfPortResult(SfConfirmationRecord),
} as const

export const SfCollaborationConfirmationProject = {
  operationId: "collaboration.confirmation-project",
  input: Schema.Union([
    Schema.Struct({ id: SfNonEmpty }).annotate({ parseOptions: { onExcessProperty: "error" } }),
    Schema.Struct({ selectionRef: Schema.String.check(Schema.isPattern(/^confirmation-selection:[a-f0-9]{64}$/)) }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  ]),
  output: sfPortResult(Schema.Union([SfPreparedConfirmationSelection, SfConfirmationProjection])),
} as const

export const SfCollaborationAnswerPrepare = {
  operationId: "collaboration.answer-prepare",
  input: Schema.Struct({ questionId: SfNonEmpty, answerRef: SfNonEmpty }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: sfPortResult(SfAnswerPrepareValue),
} as const

export const SfCollaborationAnswerPrepareMessage = {
  operationId: "collaboration.answer-prepare-message",
  input: Schema.Struct({ questionId: SfNonEmpty, messageId: SfNonEmpty, incarnation: SfNonEmpty, version: SfPositive }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: sfPortResult(SfAnswerPrepareValue),
} as const

export const SfCollaborationAnswerConfirm = {
  operationId: "collaboration.answer-confirm",
  input: Schema.Struct({ questionId: SfNonEmpty, answerRef: SfNonEmpty, mutation: SfAnswerConfirmMutation }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: sfPortResult(SfAnswerConfirmation),
} as const

export const SfCollaborationAnswerRead = {
  operationId: "collaboration.answer-read",
  input: Schema.Struct({ questionId: SfNonEmpty }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: sfPortResult(SfAnswerReadValue),
} as const

export const SfCollaborationSelectionCreate = {
  operationId: "collaboration.selection-create",
  input: Schema.Struct({ draft: SfSelectionDraft, mutation: SfMutation }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: sfPortResult(Schema.Struct({ selectionRef: SfNonEmpty })),
} as const

export const SfCollaborationSelectionList = {
  operationId: "collaboration.selection-list",
  input: Schema.Struct({ caseRef: SfNonEmpty }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: sfPortResult(SfSelectionList),
} as const

export const SfCollaborationSelectionVersion = {
  operationId: "collaboration.selection-version",
  input: SfClosedEmptyInput,
  output: sfPortResult(SfNonNegative),
} as const

export const SfCollaborationCycleRead = {
  operationId: "collaboration.cycle-read",
  input: Schema.Struct({ caseRef: SfNonEmpty, selection: SfSelection }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: sfPortResult(SfCycle),
} as const

export const SfCollaborationWorkList = {
  operationId: "collaboration.work-list",
  input: Schema.Struct({ selectionRef: SfNonEmpty, period: SfPeriod }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: sfPortResult(SfWorkPresentation),
} as const

export const SfCollaborationWorkDestination = {
  operationId: "collaboration.work-destination",
  input: Schema.Struct({ selection: SfSelection, actionRef: SfNonEmpty }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: sfPortResult(Schema.Struct({ href: SfNonEmpty })),
} as const

export const SfCollaborationRecipients = {
  operationId: "collaboration.recipients",
  input: SfClosedEmptyInput,
  output: sfPortResult(SfRecipientList),
} as const

export const SfCollaborationStorageVersion = {
  operationId: "collaboration.storage-version",
  input: Schema.Struct({ namespace: Schema.Literals(["threads", "relations", "confirmations"]) }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: sfPortResult(SfNonNegative),
} as const

export const SfCollaboration = {
  operations: {
    "collaboration.question-consume": SfCollaborationQuestionConsume,
    "collaboration.question-output": SfCollaborationQuestionOutput,
    "collaboration.thread-create": SfCollaborationThreadCreate,
    "collaboration.thread-read": SfCollaborationThreadRead,
    "collaboration.thread-reply": SfCollaborationThreadReply,
    "collaboration.thread-resolve": SfCollaborationThreadResolve,
    "collaboration.thread-edit": SfCollaborationThreadEdit,
    "collaboration.thread-history": SfCollaborationThreadHistory,
    "collaboration.relation-create": SfCollaborationRelationCreate,
    "collaboration.relation-remove": SfCollaborationRelationRemove,
    "collaboration.relation-read": SfCollaborationRelationRead,
    "collaboration.handoff-create": SfCollaborationHandoffCreate,
    "collaboration.handoff-link": SfCollaborationHandoffLink,
    "collaboration.handoff-update": SfCollaborationHandoffUpdate,
    "collaboration.confirmation-prepare": SfCollaborationConfirmationPrepare,
    "collaboration.confirmation-confirm": SfCollaborationConfirmationConfirm,
    "collaboration.confirmation-project": SfCollaborationConfirmationProject,
    "collaboration.answer-prepare": SfCollaborationAnswerPrepare,
    "collaboration.answer-prepare-message": SfCollaborationAnswerPrepareMessage,
    "collaboration.answer-confirm": SfCollaborationAnswerConfirm,
    "collaboration.answer-read": SfCollaborationAnswerRead,
    "collaboration.selection-create": SfCollaborationSelectionCreate,
    "collaboration.selection-list": SfCollaborationSelectionList,
    "collaboration.selection-version": SfCollaborationSelectionVersion,
    "collaboration.cycle-read": SfCollaborationCycleRead,
    "collaboration.work-list": SfCollaborationWorkList,
    "collaboration.work-destination": SfCollaborationWorkDestination,
    "collaboration.recipients": SfCollaborationRecipients,
    "collaboration.storage-version": SfCollaborationStorageVersion,
  },
} as const
