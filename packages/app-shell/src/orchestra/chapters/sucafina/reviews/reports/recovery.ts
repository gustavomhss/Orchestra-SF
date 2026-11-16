import { createSfReviewsClient } from "@orchestra/client/sucafina/reviews"
import { createSfContextClient } from "@orchestra/client/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfEditScopeKey, SfIntentRef } from "@orchestra/schema/sucafina/context"
import type { SfContext, SfContextStamp, SfDraftRegistry, SfDraftRevalidation, SfDraftRevalidationInput, SfOwnerIdentity } from "../../context/contracts"
import { downloadReviewReport } from "./download"

const selection = Object.freeze({
  surfaceId: "UI50" as const,
  identity: { kind: "new" as const, newIntentRef: "sf-ui50-report-v1" as SfIntentRef },
  editScopeKey: "sf-ui50-report-v1" as SfEditScopeKey,
})
type MarkerStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const legacyUnknown = "legacy-unknown"

/** Only a hashed owner scope and random correlation are persisted, never report content. */
export async function reportMarkerScope(owner: SfOwnerIdentity): Promise<string> {
  const scope = JSON.stringify([owner.serverKey, owner.transportIdentity, owner.publicOrigin,
    owner.installationId, owner.projectId, owner.principalRef])
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(scope))
  return "sf:ui50:report:v2:" + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}
export function readReportMarker(storage: MarkerStorage, scope: string): string | null | undefined {
  try {
    // Old host-scoped hashes cannot be attributed after a restart. Do not
    // silently allow a second intent while any such marker remains unresolved.
    for (let index = 0; index < storage.length; index++) {
      if (storage.key(index)?.startsWith("sf:ui50:report:v1:")) return legacyUnknown
    }
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
  ownerScope: string
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
    revalidation: { operationId: "dashboard.dashboard-review", input: { id: value.payload.reviewRef },
      fieldPaths: value.payload.sectionRefs.map((id) => "section:" + id),
      actionIds: ["reviews.report.prepare", "files.export.review"] } })
  drafts.markUnresolved(selection, true)
  return value
}

function update(drafts: SfDraftRegistry, intent: ReportRecovery, changes: Partial<Pick<ReportRecovery, "artifactRef" | "gaps" | "reason">>) {
  const controller = drafts.peek<ReportRecovery>(selection)
  const snapshot = controller?.snapshot()
  if (snapshot?.availability !== "active" || snapshot.value.idempotencyKey !== intent.idempotencyKey ||
      snapshot.value.ownerScope !== intent.ownerScope) return
  controller?.edit(Object.freeze({ ...snapshot.value, ...changes,
    gaps: changes.gaps ? Object.freeze([...changes.gaps]) : snapshot.value.gaps }))
}

const stampMatches = (a: SfContextStamp, b: SfContextStamp) =>
  a.installationId === b.installationId && a.projectId === b.projectId && a.hostId === b.hostId &&
  a.principalRef === b.principalRef && a.policyVersion === b.policyVersion && a.accessRevision === b.accessRevision

function readiness(context: SfContext): "ready" | "denied" | "unavailable" {
  const required = [
    { family: "reviews", resource: "preserved", operationId: "dashboard.dashboard-review" },
    { family: "reviews", resource: "report-export", operationId: "reviews.report.prepare" },
    { family: "files", resource: "exports", operationId: "files.export.review" },
  ]
  const observations = required.map((expected) => {
    const resources = context.availability.filter((item) => item.family === expected.family && item.resource === expected.resource)
    if (resources.length !== 1) return "unavailable"
    const resource = resources[0]!
    if (resource.state === "denied") return "denied"
    if (resource.state === "unavailable") return "unavailable"
    const operations = resource.operations.filter((item) => item.operationId === expected.operationId)
    if (operations.length !== 1) return "unavailable"
    if (operations[0]!.state === "denied") return "denied"
    return operations[0]!.state === "ready" && operations[0]!.operational ? "ready" : "unavailable"
  })
  return observations.includes("denied") ? "denied" : observations.every((state) => state === "ready") ? "ready" : "unavailable"
}

/** F01 may restore this private intent only after these original source reads. */
export async function revalidateReportRecovery(input: SfDraftRevalidationInput, fresh: SfContext,
  transport: SfTransport, signal: AbortSignal): Promise<SfDraftRevalidation> {
  if (signal.aborted || input.surfaceId !== selection.surfaceId || input.identity.kind !== "new" ||
      input.identity.newIntentRef !== selection.identity.newIntentRef || input.editScopeKey !== selection.editScopeKey ||
      input.read.operationId !== "dashboard.dashboard-review" ||
      input.read.actionIds.length !== 2 || input.read.actionIds[0] !== "reviews.report.prepare" ||
      input.read.actionIds[1] !== "files.export.review") return { status: "unavailable" }
  const query = input.read.input
  if (!query || typeof query !== "object" || Array.isArray(query) || Object.keys(query).length !== 1 ||
      !("id" in query) || typeof query.id !== "string" || !query.id.trim() || query.id.length > 2048 ||
      input.read.fieldPaths.length < 1 || input.read.fieldPaths.length > 40 ||
      input.read.fieldPaths.some((field) => typeof field !== "string" || !field.startsWith("section:") || !field.slice(8).trim() || field.slice(8).length > 16384) ||
      new Set(input.read.fieldPaths).size !== input.read.fieldPaths.length) return { status: "unavailable" }
  if (input.originalOwner.installationId !== fresh.stamp.installationId || input.originalOwner.projectId !== fresh.stamp.projectId ||
      input.originalOwner.principalRef !== fresh.stamp.principalRef) return { status: "denied" }
  const ready = readiness(fresh)
  if (ready !== "ready") return { status: ready }
  try {
    const contextClient = createSfContextClient(transport)
    const tuple = { installationId: fresh.stamp.installationId, projectId: fresh.stamp.projectId, hostId: fresh.stamp.hostId }
    const first = await contextClient["ctx.context"](tuple, { signal })
    if (signal.aborted || first.kind !== "response") return { status: "unavailable" }
    if (first.body.status === "denied") return { status: "denied" }
    if (first.body.status !== "ok" || first.status !== 200 || !stampMatches(first.body.value.stamp, fresh.stamp)) return { status: "unavailable" }
    const firstReady = readiness(first.body.value)
    if (firstReady !== "ready") return { status: firstReady }
    const review = await createSfReviewsClient(transport)["dashboard.dashboard-review"]({ id: query.id }, { signal })
    if (signal.aborted || review.kind !== "response") return { status: "unavailable" }
    if (review.body.status === "denied") return { status: "denied" }
    if (review.status !== 200 || review.body.status !== "ok" || review.body.value.id !== query.id) return { status: "unavailable" }
    const ids = review.body.value.sections.map((section) => section.id)
    if (new Set(ids).size !== ids.length || input.read.fieldPaths.some((field) => !ids.includes(field.slice(8)))) return { status: "denied" }
    const last = await contextClient["ctx.context"](tuple, { signal })
    if (signal.aborted || last.kind !== "response") return { status: "unavailable" }
    if (last.body.status === "denied") return { status: "denied" }
    if (last.body.status !== "ok" || last.status !== 200 || !stampMatches(last.body.value.stamp, fresh.stamp)) return { status: "unavailable" }
    const lastReady = readiness(last.body.value)
    if (lastReady !== "ready") return { status: lastReady }
    return { status: "authorized", authority: "unchanged", stamp: last.body.value.stamp, sourceVersion: null }
  } catch { return { status: "unavailable" } }
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
      console.error("Sucafina report preparation did not settle", prepared.kind === "response" ? prepared.body.status : prepared.reason)
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
        console.error("Sucafina report preparation returned a mismatched contract")
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
      console.error("Sucafina report recovery marker could not be cleared")
      update(input.drafts, intent, { reason: "contract-unavailable" })
      return
    }
    input.drafts.markUnresolved(selection, false)
    input.drafts.discard(selection)
  } catch (error) {
    if (input.current()) {
      console.error("Sucafina report recovery failed", error instanceof Error ? error.name : "unknown")
      update(input.drafts, intent, { reason: "outcome-unknown" })
    }
  } finally {
    running.delete(input.drafts)
  }
}
