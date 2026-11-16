import { createSfReviewsClient } from "@orchestra/client/sucafina/reviews"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfEditScopeKey, SfIntentRef } from "@orchestra/schema/sucafina/context"
import type { SfContextStamp, SfDraftRegistry, SfOwnerIdentity } from "../../context/contracts"
import { downloadReviewReport } from "./download"

const selection = Object.freeze({
  surfaceId: "UI50" as const,
  identity: { kind: "new" as const, newIntentRef: "sf-ui50-report-v1" as SfIntentRef },
  editScopeKey: "sf-ui50-report-v1" as SfEditScopeKey,
})
type MarkerStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** Only a hashed owner scope and random correlation are persisted, never report content. */
export async function reportMarkerScope(owner: SfOwnerIdentity, stamp: SfContextStamp): Promise<string> {
  const scope = JSON.stringify([owner.serverKey, owner.transportIdentity, owner.publicOrigin,
    owner.installationId, owner.projectId, owner.principalRef, stamp.hostId])
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(scope))
  return "sf:ui50:report:v1:" + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}
export function readReportMarker(storage: MarkerStorage, scope: string): string | null | undefined {
  try {
    const value = storage.getItem(scope)
    return value === null || uuid.test(value) ? value : undefined
  } catch { return undefined }
}
export function writeReportMarker(storage: MarkerStorage, scope: string, key: string): boolean {
  try {
    if (!uuid.test(key) || readReportMarker(storage, scope) !== null) return false
    storage.setItem(scope, key)
    return readReportMarker(storage, scope) === key
  } catch { return false }
}
export function clearReportMarker(storage: MarkerStorage, scope: string, key: string): boolean {
  try {
    if (readReportMarker(storage, scope) !== key) return false
    storage.removeItem(scope)
    return readReportMarker(storage, scope) === null
  } catch { return false }
}

export type ReportRecovery = Readonly<{
  ownerKey: string
  stamp: string
  idempotencyKey: string
  payload: Readonly<{ reviewRef: string; sectionRefs: readonly string[]; format: "docx" | "pptx" }>
  artifactRef: string | null
  gaps: readonly string[]
  reason: string
}>

/** The F01 registry quarantines/revokes this private intent with its owner. */
export function readReportRecovery(drafts: SfDraftRegistry): ReportRecovery | undefined {
  const snapshot = drafts.peek<ReportRecovery>(selection)?.snapshot()
  return snapshot?.availability === "active" ? snapshot.value : undefined
}

export function beginReportRecovery(drafts: SfDraftRegistry, input: Omit<ReportRecovery, "artifactRef" | "gaps" | "reason">): ReportRecovery | undefined {
  if (drafts.peek(selection)) return undefined
  const payload = Object.freeze({ ...input.payload, sectionRefs: Object.freeze([...input.payload.sectionRefs]) })
  const value: ReportRecovery = Object.freeze({ ...input, payload,
    artifactRef: null, gaps: Object.freeze([]), reason: "" })
  drafts.acquire<ReportRecovery>({ ...selection, base: null, baseVersion: null, value,
    revalidation: { operationId: "dashboard.dashboard-review", input: { id: value.payload.reviewRef }, fieldPaths: [], actionIds: [] } })
  drafts.markUnresolved(selection, true)
  return value
}

function update(drafts: SfDraftRegistry, intent: ReportRecovery, changes: Partial<Pick<ReportRecovery, "artifactRef" | "gaps" | "reason">>) {
  const controller = drafts.peek<ReportRecovery>(selection)
  const snapshot = controller?.snapshot()
  if (snapshot?.availability !== "active" || snapshot.value.idempotencyKey !== intent.idempotencyKey ||
      snapshot.value.ownerKey !== intent.ownerKey || snapshot.value.stamp !== intent.stamp) return
  controller?.edit(Object.freeze({ ...snapshot.value, ...changes,
    gaps: changes.gaps ? Object.freeze([...changes.gaps]) : snapshot.value.gaps }))
}

const running = new WeakSet<SfDraftRegistry>()

/** One explicit attempt: exact prepare retry or download-only retry, never both preparations. */
export async function runReportRecovery(input: Readonly<{
  drafts: SfDraftRegistry
  transport: SfTransport
  signal: AbortSignal
  current: () => boolean
  principalRef: string
  accessRevision: string
  onDownloaded: (idempotencyKey: string) => boolean
  downloadResponse?: (response: Response, filename: string) => Promise<void>
}>): Promise<void> {
  if (running.has(input.drafts) || !input.current()) return
  const intent = readReportRecovery(input.drafts)
  if (!intent) return
  running.add(input.drafts)
  try {
    const prepared = intent.artifactRef ? undefined : await createSfReviewsClient(input.transport)["reviews.report.prepare"](
      intent.payload, { signal: input.signal, idempotencyKey: intent.idempotencyKey },
    )
    if (!input.current()) return
    if (prepared && (prepared.kind !== "response" || prepared.body.status !== "ok")) {
      const reason = prepared.kind === "response" ? prepared.body.status + ": " + prepared.body.reason : prepared.reason
      update(input.drafts, intent, { reason })
      return
    }
    if (prepared?.kind === "response" && prepared.body.status === "ok") {
      const value = prepared.body
      if (prepared.status !== 200 || value.result.reviewSelectionRef !== intent.payload.reviewRef ||
          value.result.orderedResultRefs.length !== 1 || value.result.orderedResultRefs[0] !== value.outputRef ||
          !/^report:[a-f0-9]{64}$/.test(value.outputRef) || value.receipt.operation !== "sf_report_prepare" ||
          value.receipt.accessRevision !== input.accessRevision || value.receipt.principalRef !== input.principalRef ||
          value.result.coverage.length !== intent.payload.sectionRefs.length ||
          value.result.coverage.some((entry, index) => entry.sectionRef !== intent.payload.sectionRefs[index])) {
        update(input.drafts, intent, { reason: "contract-mismatch" })
        return
      }
      update(input.drafts, intent, { artifactRef: value.outputRef, gaps: value.result.gaps.map((gap) => gap.reason), reason: "" })
    }
    const current = readReportRecovery(input.drafts)
    if (!input.current() || !current?.artifactRef || current.idempotencyKey !== intent.idempotencyKey) return
    await downloadReviewReport({ transport: input.transport, artifactRef: current.artifactRef, format: intent.payload.format,
      signal: input.signal, current: input.current, downloadResponse: input.downloadResponse })
    if (!input.current()) return
    if (!input.onDownloaded(intent.idempotencyKey)) {
      update(input.drafts, intent, { reason: "contract-unavailable" })
      return
    }
    input.drafts.markUnresolved(selection, false)
    input.drafts.discard(selection)
  } catch {
    if (input.current()) update(input.drafts, intent, { reason: "outcome-unknown" })
  } finally {
    running.delete(input.drafts)
  }
}
