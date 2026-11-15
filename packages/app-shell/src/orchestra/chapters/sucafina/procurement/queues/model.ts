import type { SfRef } from "@orchestra/schema/sucafina/context"

/**
 * UI carrier for the source-verified ProcurementQueueRow (C02). A03 must
 * project these fields from the authorized producer; this module neither reads
 * snapshots nor decides membership, permissions, holder or approval stage.
 * \`id\` is the original record ref after F01 has validated the route codec.
 */
export type SfProcurementQueueGroup = "waitingForYou" | "waitingForOthers" | "unassigned"

export type SfProcurementQueueRow = Readonly<{
  id: SfRef
  /** Assigned ONLY by canonical procurementApprovalGroups on the producer. */
  group: SfProcurementQueueGroup
  sourceRef: string
  sourceDigest: string
  version: number
  status: string | null
  subject: string | null
  holder: string | null
  approvalStage: string | null
  stageEnteredAt: string | null
  ageDays: number | null
  baseAmount: number | null
  baseCurrency: string
  submittedAmount: number | null
  submittedCurrency: string | null
  originalAmount: number | null
  originalCurrency: string | null
  monetaryState: string | null
  reason: string | null
  nextStep: string | null
}>

export type SfProcurementQueueFilters = Readonly<{
  group: SfProcurementQueueGroup | null
  status: string | null
  stage: string | null
  query: string
}>

export const SF_QUEUE_INITIAL_FILTERS: SfProcurementQueueFilters = Object.freeze({
  group: null,
  status: null,
  stage: null,
  query: "",
})

/** Source labels are data, not grants. No caller-principal or holder inference. */
export function sfQueueFilterRows(
  rows: readonly SfProcurementQueueRow[],
  filters: SfProcurementQueueFilters,
): readonly SfProcurementQueueRow[] {
  const query = filters.query.trim().toLocaleLowerCase()
  return rows.filter((row) => {
    if (filters.group !== null && row.group !== filters.group) return false
    if (filters.status !== null && row.status !== filters.status) return false
    if (filters.stage !== null && row.approvalStage !== filters.stage) return false
    if (!query) return true
    return [
      row.id,
      row.subject,
      row.status,
      row.approvalStage,
      row.holder,
      row.nextStep,
    ].some((field) => typeof field === "string" && field.toLocaleLowerCase().includes(query))
  })
}

/** Options come only from already-authorized loaded records, never another owner. */
export function sfQueueFilterOptions(rows: readonly SfProcurementQueueRow[]) {
  const statuses = [...new Set(rows.map((row) => row.status).filter((value): value is string => value !== null))]
  const stages = [...new Set(rows.map((row) => row.approvalStage).filter((value): value is string => value !== null))]
  const groups = [...new Set(rows.map((row) => row.group))]
  return { statuses, stages, groups } as const
}

export type SfProcurementQueueReadPhase =
  | "loading" | "ready" | "partial" | "unavailable"
  | "denied" | "session-expired" | "invalid" | "not-found" | "stale" | "conflict" | "outcome-unknown"

export type SfProcurementQueueVisible = Readonly<{
  state: "loading" | "ready" | "empty" | "filtered-empty" | "partial" |
    "unavailable" | "denied" | "session-expired" | "invalid" | "not-found" |
    "stale" | "conflict" | "outcome-unknown"
  rows: readonly SfProcurementQueueRow[]
  selected: SfProcurementQueueRow | undefined
}>

/**
 * This is PRESENTATION state, not a decode of the producer response. A03/F01
 * must first authorize/validate the exact owner + resource and classify the
 * read. An unavailable read is never an authorized zero-row read.
 */
export function sfQueueVisible(
  phase: SfProcurementQueueReadPhase,
  authorizedRows: readonly SfProcurementQueueRow[],
  filters: SfProcurementQueueFilters,
  selectedRef: SfRef | undefined,
): SfProcurementQueueVisible {
  if (phase !== "ready" && phase !== "partial")
    return { state: phase, rows: [], selected: undefined }

  const rows = sfQueueFilterRows(authorizedRows, filters)
  const selected = selectedRef === undefined ? undefined : authorizedRows.find((row) => row.id === selectedRef)
  if (phase === "partial") return { state: "partial", rows, selected }
  if (authorizedRows.length === 0) return { state: "empty", rows, selected: undefined }
  if (rows.length === 0) return { state: "filtered-empty", rows, selected }
  return { state: "ready", rows, selected }
}

/** Null is truly unavailable. Zero and the producer's decimal are not guessed. */
export function sfQueueMeasuredWait(row: SfProcurementQueueRow):
  | Readonly<{ kind: "measured"; at: string; days: number }>
  | Readonly<{ kind: "unavailable" }> {
  if (
    row.stageEnteredAt === null || row.ageDays === null ||
    !Number.isFinite(row.ageDays) || row.ageDays < 0
  ) return { kind: "unavailable" }
  return { kind: "measured", at: row.stageEnteredAt, days: row.ageDays }
}

/** Never derive the current holder from principalRef or row position. */
export function sfQueueFindRow(
  rows: readonly SfProcurementQueueRow[],
  ref: SfRef,
): SfProcurementQueueRow | undefined {
  return rows.find((row) => row.id === ref)
}
