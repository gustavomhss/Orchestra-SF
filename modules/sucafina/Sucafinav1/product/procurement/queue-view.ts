import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainProjection } from "../contracts/context.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"

type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>
export type ProcurementQueueRow = {
  id: string
  evidence: RecordEvidence
  version: number
  projection: DomainProjection
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
}
export type ProcurementQueueView = {
  rows: readonly ProcurementQueueRow[]
  stock: DomainProjection
  aging: readonly DomainProjection[]
}
const presentations = new WeakSet<object>()

/** A presentation of actual C02 values. It neither derives business facts nor grants an action. */
export function createProcurementQueueView(input: { queue: readonly DomainProjection[]; stock: DomainProjection; aging: readonly DomainProjection[] }): ProcurementQueueView | undefined {
  const rows: ProcurementQueueRow[] = []
  for (const projection of input.queue) {
    const evidence = projection.values.find((value) => value.id === "status")?.drilldown
    if (!evidence || evidence.kind !== "record" || evidence.refDigest !== digestSfEvidenceRef(evidence) || evidence.evidenceLevel !== "observed" ||
      evidence.target.surface !== "procurement" || evidence.target.recordType !== "procurement-request" || !evidence.target.recordId ||
      evidence.target.version !== projection.version || projection.context.surface !== "procurement" ||
      evidence.installationId !== projection.context.installationId || evidence.projectId !== projection.context.projectId ||
      digestSfValue(projection.context) !== digestSfValue(input.stock.context) ||
      projection.values.some((value) => !value.drilldown || digestSfValue(value.drilldown) !== digestSfValue(evidence) || value.sourceRefs.some((ref) => digestSfValue(ref) !== digestSfValue(evidence)))) return undefined
    const field = (id: string) => projection.values.find((value) => value.id === id)?.value
    const text = (id: string) => { const value = field(id); return typeof value === "string" && value.length ? value : null }
    const number = (id: string) => { const value = field(id); return typeof value === "number" && Number.isFinite(value) ? value : null }
    rows.push(Object.freeze({ id: evidence.target.recordId, evidence, version: projection.version, projection,
      status: text("status"), subject: text("subject"), holder: text("holder"), approvalStage: text("approvalStage"),
      stageEnteredAt: text("stageEnteredAt"), ageDays: number("ageDays"), baseAmount: number("baseAmount"), baseCurrency: projection.context.currency,
      submittedAmount: number("submittedAmount"), submittedCurrency: text("submittedCurrency"), originalAmount: number("originalAmount"),
      originalCurrency: text("originalCurrency"), monetaryState: text("monetaryState"), reason: text("reason"), nextStep: text("nextStep") }))
  }
  if (new Set(rows.map((row) => row.id)).size !== rows.length) return undefined
  const view = Object.freeze({ rows: Object.freeze(rows), stock: input.stock, aging: input.aging })
  presentations.add(view)
  return view
}

/** Only an in-process producer presentation can enter the synchronous legacy renderer. */
export function readProcurementQueueView(value: unknown): ProcurementQueueView | undefined {
  return value !== null && typeof value === "object" && presentations.has(value) ? value as ProcurementQueueView : undefined
}

/** Dates and holders are read from C02; no history, SLA, score or approval policy is recomputed. */
export function procurementApprovalGroups(view: ProcurementQueueView, actorId: string) {
  const waitingForYou: ProcurementQueueRow[] = []
  const waitingForOthers: ProcurementQueueRow[] = []
  const unassigned: ProcurementQueueRow[] = []
  for (const row of view.rows) {
    if (!row.status?.endsWith("_pending")) continue
    if (!row.holder) unassigned.push(row)
    else if (row.holder === actorId) waitingForYou.push(row)
    else waitingForOthers.push(row)
  }
  const oldest = (a: ProcurementQueueRow, b: ProcurementQueueRow) => {
    const left = a.ageDays !== null && a.stageEnteredAt ? Date.parse(a.stageEnteredAt) : NaN
    const right = b.ageDays !== null && b.stageEnteredAt ? Date.parse(b.stageEnteredAt) : NaN
    if (Number.isFinite(left) && Number.isFinite(right)) return left - right || a.id.localeCompare(b.id)
    if (Number.isFinite(left)) return -1
    if (Number.isFinite(right)) return 1
    return a.id.localeCompare(b.id)
  }
  return { waitingForYou: waitingForYou.sort(oldest), waitingForOthers: waitingForOthers.sort(oldest), unassigned: unassigned.sort(oldest) }
}
