import type { SfOpaque, SfRef, SfVersion } from "@orchestra/schema/sucafina/context"

// Exact S05 public carrier signatures from component-signatures.ts (frozen),
// using the F01-owned opaque reference/value types. No access credentials or DTOs.
export type SfCopyKey = SfOpaque<"key-from-frozen-typed-dictionaries">
export type SfMessage = Readonly<{ key: SfCopyKey; params?: Readonly<Record<string, string | number>> }>
export type SfText =
  | Readonly<{ kind: "message"; message: SfMessage }>
  | Readonly<{ kind: "data"; text: string }>
export type SfUiState =
  | "loading" | "ready" | "empty" | "filtered-empty" | "partial"
  | "invalid" | "not-found" | "stale" | "conflict" | "unavailable"
  | "denied" | "session-expired" | "outcome-unknown"
export type SfCoverage = Readonly<{
  state: "complete" | "partial" | "unavailable"
  summary: SfMessage
  reasons: readonly SfMessage[]
  knownCount: number | null
  expectedCount: number | null
}>

export type SfRelation = Readonly<{
  ref: SfRef
  sourceRef: SfRef
  targetRef: SfRef
  kind: string
  sourceLabel: SfText
  targetLabel: SfText
  caseRef?: SfRef
  version: SfVersion
  canRemove: boolean
}>
export type SfRelationTarget = Readonly<{
  ref: SfRef
  kind: string
  label: SfText
  allowedRelationKinds: readonly Readonly<{ id: string; label: SfMessage }>[]
}>
export type SfRelationsProps = Readonly<{
  sourceRef: SfRef
  relations: readonly SfRelation[]
  candidates: readonly SfRelationTarget[]
  state: SfUiState
  onSearchTargets: (query: string) => void
  onCreate: (request: Readonly<{ sourceRef: SfRef; targetRef: SfRef; kind: string; caseRef?: SfRef }>) => void
  onRemove: (request: Readonly<{ relationRef: SfRef; expectedVersion: SfVersion }>) => void
  onOpen: (recordRef: SfRef) => void
}>

export type SfThreadMessage = Readonly<{
  ref: SfRef
  incarnation: string
  version: number
  author: SfText
  createdAt: string
  text: string
  sourceRefs: readonly SfRef[]
}>
export type SfThreadProps = Readonly<{
  threadRef: SfRef
  incarnation: string
  version: number
  messages: readonly SfThreadMessage[]
  draft: string
  state: SfUiState
  canSubmit?: boolean
  onEditDraft: (text: string) => void
  onPost: (request: Readonly<{ threadRef: SfRef; incarnation: string; expectedVersion: number; text: string }>) => void
  onReconcileRead: (threadRef: SfRef) => void
  onOpenOrigin: () => void
}>

export type SfQuestionDraft = Readonly<{ text: string; recipientRef: SfRef | null; sourceRefs: readonly SfRef[] }>
export type SfQuestionProps = Readonly<{
  questionRef?: SfRef
  sourceRef: SfRef
  recipientOptions: readonly Readonly<{ ref: SfRef; label: SfText; available: boolean }>[]
  question: SfQuestionDraft
  answer?: Readonly<{ ref: SfRef; version: SfVersion; text: string; author: SfText }>
  state: SfUiState
  onEditQuestion: (draft: SfQuestionDraft) => void
  onPrepare: (draft: SfQuestionDraft) => void
  onSubmit: () => void
  onAnswer: (request: Readonly<{ questionRef: SfRef; text: string }>) => void
  onOpen: (questionRef: SfRef) => void
}>

export type SfConfirmationProps = Readonly<{
  selectionRef: SfRef
  materialVersion: SfVersion
  status: "current" | "stale" | "revoked" | "not-found" | "unavailable"
  coverage: SfCoverage
  state: SfUiState
  onConfirm: (request: Readonly<{ selectionRef: SfRef; materialVersion: SfVersion }>) => void
  onRevalidate: (selectionRef: SfRef) => void
}>
