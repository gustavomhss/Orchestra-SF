import type { SfIntentRef, SfOperationRef, SfRef, SfVersion } from "@orchestra/schema/sucafina/context"
import type { SfOperationId } from "@orchestra/schema/sucafina/common"
import type {
  SfCopyKey, SfCoverage, SfDisplayValue, SfMessage, SfSource,
  SfText, SfUiState,
} from "../frame/types"

export type SfReviewField = Readonly<{
  path: string
  label: SfMessage
  value: SfDisplayValue
  source?: SfSource
}>

export type SfReviewSnapshot =
  | Readonly<{ kind: "persisted"; ref: SfRef; version: SfVersion; fields: readonly SfReviewField[] }>
  | Readonly<{ kind: "draft"; intentRef: SfIntentRef; sourceRef: SfRef | null; sourceVersion: SfVersion | null; fields: readonly SfReviewField[] }>
  | Readonly<{ kind: "not-provided"; reason: SfMessage }>

export type SfEffect = Readonly<{
  id: string
  domain:
    | "dashboard" | "planner" | "procurement" | "decisions"
    | "portfolio" | "files" | "reviews" | "collaboration" | "intelligence"
  title: SfText
  state: "proposed" | "blocked" | "applied" | "not-applied" | "unknown"
  details: readonly SfReviewField[]
  reason?: SfMessage
  receiptRef?: SfRef
}>

export type SfReviewPurpose =
  | "create" | "save" | "update" | "submit" | "approve" | "reject"
  | "select" | "apply" | "delete" | "cancel" | "issue" | "reset"
  | "spread" | "sync" | "copy" | "official" | "lock" | "unlock"
  | "activate" | "block" | "inactivate" | "change-bank" | "common"
  | "import" | "export" | "confirm" | "pause" | "prepare" | "run"

export type SfCommandVersion =
  | Readonly<{ kind: "record"; expectedVersion: SfVersion }>
  | Readonly<{ kind: "admission"; admissionRef: SfRef; expectedAdmissionVersion: number }>
  | Readonly<{ kind: "none" }>

export type SfReviewBinding =
  | Readonly<{ kind: "producer-review"; operationId: SfOperationId; reviewRef: SfRef; reviewDigest: string; baseVersion: SfVersion }>
  | Readonly<{ kind: "catalog-command"; operationId: SfOperationId; version: SfCommandVersion; confirmation: "presentation-only" | "producer-confirmed-field" }>

export type SfReviewConfirmation =
  | Readonly<{ kind: "blocked"; labelKey: SfCopyKey; reasons: readonly SfMessage[] }>
  | Readonly<{ kind: "admitted"; labelKey: SfCopyKey; purpose: SfReviewPurpose; binding: SfReviewBinding }>

export type SfChangeReviewProps = Readonly<{
  operation: Readonly<{ ref: SfOperationRef; label: SfMessage; scope: SfText }>
  base: SfReviewSnapshot | null
  current: SfReviewSnapshot | null
  proposed: SfReviewSnapshot
  effects: readonly SfEffect[]
  coverage: SfCoverage
  blockingReasons: readonly SfMessage[]
  confirmation: SfReviewConfirmation
  state: SfUiState
  onConfirm: (review: Extract<SfReviewConfirmation, { kind: "admitted" }>) => void
  onRevise: () => void
  onCancel: () => void
  onReconcile?: (operationRef: SfOperationRef) => void
}>

