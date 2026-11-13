import { randomUUID } from "node:crypto"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { Period, SourceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { DashboardPort, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import { isSfPeriod } from "../../../../modules/sucafina/Sucafinav1/product/contracts/validation.ts"
import { createDashboardAgendaSelector } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/agenda.ts"
import { createDashboardConfirmationIssuer, createDashboardConfirmationProjectionReader } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/confirmation-issuer.ts"
import { createDashboardConfirmationObserver } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/confirmation.ts"
import { createDashboardHistoricalBindings } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/historical-bindings.ts"
import type { DashboardHistoricalCapture } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/historical-bindings.ts"
import type { createDashboardRecordEvidenceHost, createDashboardSourceHost } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/sources.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { projectSfSourceScope } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-projections.ts"
import type { SfScopedSourcePort } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { createReviewPort } from "../../../../modules/sucafina/Sucafinav1/product/reviews/port.ts"
import type { ReviewHost, ReviewSection } from "../../../../modules/sucafina/Sucafinav1/product/reviews/port.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Snapshot } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"

export type DashboardAgendaSection = { id: string; title: string; selectionRef: string; topic: string; period: Period; recordRefs?: readonly string[] }
export type DashboardAgendaRequest = { sections: readonly DashboardAgendaSection[] }
export type DashboardReviewRequest = { selectionRef: string; sectionRefs: readonly string[]; previousReviewRef?: string }

/** Private host composition: public arguments contain selectors, never persistence callbacks or receipts. */
export function createSfDashboardServices(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  scopedSources: SfScopedSourcePort
  dashboard: DashboardPort
  sources: ReturnType<typeof createDashboardSourceHost>
  records: ReturnType<typeof createDashboardRecordEvidenceHost>
  dashboardHostWrites: WeakSet<object>
}) {
  const { host, state, creationTarget, human } = input.authority
  const agenda = createDashboardAgendaSelector({ host, dashboard: input.dashboard, sources: input.sources, recordEvidence: input.records })
  const issue = createDashboardConfirmationIssuer({ host, scopedSources: input.scopedSources })
  const observer = createDashboardConfirmationObserver({ host, scopedSources: input.scopedSources,
    readProjection: createDashboardConfirmationProjectionReader({ dashboard: input.dashboard, records: input.records }) })
  const selections = new Map<string, { owner: string; expiresAt: number; sections: readonly DashboardAgendaSection[] }>()
  const captureReads = new WeakMap<TrustedDomainContext, { captureId: string; owner: string; digest: string }>()
  const owner = (context: TrustedDomainContext) => digestSfValue({ installationId: context.binding.installationId, projectId: context.binding.projectId,
    principalRef: context.binding.principalRef, policyVersion: context.binding.policyVersion, accessRevision: context.binding.accessRevision })
  const resolveEvidence = async (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => {
    if (!await host.revalidate(context)) return false
    const current = await Promise.all(refs.map(async (ref) => {
      if (ref.kind !== "record" || ref.target.surface !== "dashboard") return false
      const result = ref.target.recordType === "dashboard-page" ? await input.sources.resolveDashboardSource(ref.refId, context) : await input.records.resolve(ref.refId, context)
      return result.status === "ok" && digestSfValue("evidence" in result.value ? result.value.evidence : result.value) === digestSfValue(ref)
    }))
    return current.every(Boolean) && await host.revalidate(context)
  }
  const revalidateSources = async (context: TrustedDomainContext, refs: readonly SourceRef[]) => {
    const request = host.requestFor(context)
    if (!request || !host.persistence.transactionAll || !await host.revalidate(context)) return false
    const environment = await host.environment(request)
    return host.persistence.transactionAll(async (snapshots) => ({ commit: false,
      value: refs.every((ref) => dashboardSourceCurrent(snapshots.dashboard, ref, context, environment.at)) && await host.revalidate(context),
    }), { signal: request.signal })
  }
  const select: ReviewHost["select"] = async (selectionRef, sectionRefs, context, period) => {
    const selection = selections.get(selectionRef)
    if (!selection || selection.expiresAt <= Date.now() || selection.owner !== owner(context) || new Set(sectionRefs).size !== sectionRefs.length || !await host.revalidate(context))
      return { status: "unavailable", reason: "dashboard-agenda-unavailable" }
    const sections: ReviewSection[] = []
    for (const id of sectionRefs) {
      const selected = selection.sections.find((section) => section.id === id)
      if (!selected || (period && digestSfValue(selected.period) !== digestSfValue(period))) return { status: "denied", reason: "dashboard-section-outside-selection" }
      const result = await agenda(selected, context)
      if (result.status !== "ok") return result
      sections.push({ id, title: selected.title, period: selected.period, recordCount: result.value.recordCount, projection: result.value.projection })
    }
    return { status: "ok", value: sections }
  }
  // ReviewPort owns the preserved review. The host maps a new review to the workspace creation authority
  // and verifies its source scopes again inside the same all-surface persistence transaction.
  const reviewState: SfProductStatePort = { read: state.read, transaction: (request, command, work) => state.transaction(request,
    { ...command, domainSurface: "dashboard", targetRef: creationTarget.ref, targetIncarnation: creationTarget.incarnation }, async (stored, authority, snapshot) => {
      const before = structuredClone(stored.reviews)
      const result = await work(stored, authority, snapshot)
      if (!result.commit) return result
      const environment = await host.environment(request)
      const changed = Object.values(stored.reviews).filter((review) => digestSfValue(review) !== digestSfValue(before[review.id]))
      if (changed.some((review) => review.sourceRefs.some((ref) => !dashboardSourceCurrent(snapshot, ref, { binding: authority }, environment.at))))
        throw new Error("SF_DASHBOARD_REVIEW_SOURCE_CHANGED")
      return result
    }) }
  const reviews = createReviewPort({ state: reviewState, now: () => new Date().toISOString(), requestFor: host.requestFor,
    select, authorizeSections: (context, sections) => revalidateSources(context, sections.flatMap((section) => section.sourceRefs)),
    authorizeComments: async (_context, comments) => comments.length === 0,
    authorizeSensitivity: async (_context, sensitivity) => sensitivity.length === 0,
    revalidate: revalidateSources, revalidateEvidence: (context, refs) => resolveEvidence(refs, context) })
  const readCapture = async (captureId: string, context: TrustedDomainContext): Promise<PortResult<DashboardHistoricalCapture>> => {
    const request = host.requestFor(context)
    if (!request || !await host.revalidate(context)) return { status: "denied", reason: "historical-capture-unavailable" }
    const locked = host.persistence.currentSnapshots?.()?.dashboard
    if (locked) {
      // The first C08 read proves the preferences grant. Revalidation preserves that exact authority;
      // the final lookup reads the lock's snapshot without starting another persistence operation.
      const proof = captureReads.get(context)
      const found = object(object(locked.data.__sfProductV1).preferences)[captureKey(captureId)]
      return proof?.captureId === captureId && proof.owner === owner(context) && isCapture(found) && digestSfValue(found) === proof.digest ?
        { status: "ok", value: structuredClone(found) } : { status: "unavailable", reason: "historical-capture-unavailable" }
    }
    const result = await state.read(request, "preferences", (stored, authority) => {
      const found = stored.preferences[captureKey(captureId)]
      return sameAuthority(authority, context) && isCapture(found) ? structuredClone(found) : undefined
    })
    if (result.status !== "ok" || !result.value || !await host.revalidate(context)) return { status: "unavailable", reason: "historical-capture-unavailable" }
    captureReads.set(context, { captureId, owner: owner(context), digest: digestSfValue(result.value) })
    return { status: "ok", value: result.value }
  }
  const history = createDashboardHistoricalBindings({ host, observer, records: input.records, readProtectedCapture: readCapture })
  return {
    issue, observer, select,
    agenda: async (request: DashboardAgendaRequest, context: TrustedDomainContext) => {
      if (!validAgenda(request) || !await host.revalidate(context)) return { status: "needs-input" as const, reason: "invalid-dashboard-agenda" }
      for (const [key, value] of selections) if (value.expiresAt <= Date.now()) selections.delete(key)
      if (selections.size >= 512) return { status: "unavailable" as const, reason: "dashboard-agenda-registry-full" }
      const selectionRef = `dashboard-agenda:${randomUUID()}`
      selections.set(selectionRef, { owner: owner(context), expiresAt: Date.now() + 5 * 60_000, sections: structuredClone(request.sections) })
      const result = await reviews.preview(selectionRef, request.sections.map((section) => section.id), context)
      if (result.status !== "ok") { selections.delete(selectionRef); return result }
      return { status: "ok" as const, value: { selectionRef, sections: result.value } }
    },
    preserveReview: async (request: DashboardReviewRequest, context: TrustedDomainContext) => {
      if (context.kind !== "ui" || !await human.authorize(context, "reviews.preserve", request)) return { status: "denied" as const, reason: "human-review-authority-required" }
      const source = host.requestFor(context)
      const operation = input.authority.ui.operationIdentity(context)
      if (!source || !operation) return { status: "denied" as const, reason: "review-identity-unavailable" }
      const current = await state.read(source, "reviews", (_stored, authority) => sameAuthority(authority, context))
      if (current.status !== "ok" && !(current.status === "unavailable" && current.reason === "product-state-uninitialized")) return { status: "unavailable" as const, reason: "review-state-unavailable" }
      if (current.status === "ok" && !current.value) return { status: "denied" as const, reason: "review-state-unavailable" }
      const result = await reviews.preserve({ ...request, id: `dashboard-review:${digestSfValue({ operation, owner: owner(context) })}`,
        expectedStorageVersion: current.status === "ok" ? current.storageVersion : 0, idempotencyKey: `dashboard-review:${operation}`, targetIncarnation: creationTarget.incarnation }, context)
      return result
    },
    readReview: reviews.read.bind(reviews),
    capture: async (incoming: { sourceRef: string }, context: TrustedDomainContext): Promise<PortResult<{ captureId: string }>> => {
      const request = structuredClone(incoming)
      if (context.kind !== "ui" || !await human.authorize(context, "reviews.preserve", request)) return { status: "denied", reason: "human-capture-authority-required" }
      const source = host.requestFor(context)
      const operation = input.authority.ui.operationIdentity(context)
      if (!source || !operation || !request.sourceRef.trim()) return { status: "denied", reason: "capture-identity-unavailable" }
      const captureId = `dashboard-capture:${digestSfValue({ operation, owner: owner(context) })}`
      const previous = await readCapture(captureId, context)
      if (previous.status === "ok") {
        if (previous.value.source.refId !== request.sourceRef) return { status: "conflict", reason: "idempotency-content-changed" }
        const current = await history.reopen(captureId, context)
        return current.status === "ok" ? { status: "ok", value: { captureId } } : current
      }
      const evidence = await input.records.resolve(request.sourceRef, context)
      if (evidence.status !== "ok") return evidence
      const prepared = await history.prepare({ captureId, source: evidence.value }, context)
      if (prepared.status !== "ok") return prepared
      const current = await state.read(source, "preferences", (_stored, authority) => sameAuthority(authority, context))
      if (current.status !== "ok" && !(current.status === "unavailable" && current.reason === "product-state-uninitialized")) return { status: "unavailable", reason: "capture-state-unavailable" }
      if (current.status === "ok" && !current.value) return { status: "denied", reason: "capture-state-unavailable" }
      const work = async (stored: SfProductState, authority: SfStateAuthority) => {
        if (!sameAuthority(authority, context) || stored.preferences[captureKey(captureId)] !== undefined || !await prepared.value.fence()) return { commit: false, value: false }
        stored.preferences[captureKey(captureId)] = structuredClone(prepared.value.receipt)
        return { commit: true, value: true }
      }
      input.dashboardHostWrites.add(work)
      const saved = await state.transaction(source, { namespace: "preferences", domainSurface: "dashboard", expectedStorageVersion: current.status === "ok" ? current.storageVersion : 0,
        targetRef: creationTarget.ref, targetIncarnation: creationTarget.incarnation, idempotencyKey: `dashboard-capture:${operation}`, commandDigest: digestSfValue(request) }, work)
        .finally(() => input.dashboardHostWrites.delete(work))
      if (saved.status !== "ok" || !saved.value) return { status: saved.status === "conflict" ? "conflict" : "unavailable", reason: "capture-not-persisted" }
      const checked = await history.reopen(captureId, context)
      return checked.status === "ok" ? { status: "ok", value: { captureId } } : checked
    },
    reopen: history.reopen,
    dispose: () => selections.clear(),
  }
}

export function dashboardSourceCurrent(snapshot: Snapshot, ref: SourceRef, context: { binding: SfStateAuthority }, at: string) {
  if (ref.surface !== "dashboard") return false
  const matches = Object.values(snapshot.sfSources?.scopes ?? {}).filter((entry) => entry.alive && entry.incarnation === ref.incarnation && entry.version === ref.version &&
    entry.scope.recordType === ref.type && entry.scope.recordId === ref.id && entry.scope.principalRef === context.binding.principalRef &&
    entry.scope.accessRevision === context.binding.accessRevision && entry.scope.policyVersion === context.binding.policyVersion &&
    digestSfValue(object(entry.scope.selector).fields) === digestSfValue([...ref.fields].sort()) && digestSfValue(object(entry.scope.selector).period) === digestSfValue(ref.period))
  return matches.length === 1 && digestSfValue(projectSfSourceScope("dashboard", snapshot, matches[0]!.scope, at)) === matches[0]!.inputDigest
}
function captureKey(id: string) { return `sf:dashboard-host:capture:${id}` }
function sameAuthority(authority: SfStateAuthority, context: TrustedDomainContext) { return authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion }
function validAgenda(request: DashboardAgendaRequest) {
  return !!request && Array.isArray(request.sections) && request.sections.length > 0 && request.sections.length <= 30 && new Set(request.sections.map((section) => section.id)).size === request.sections.length &&
    request.sections.every((section) => typeof section.id === "string" && !!section.id.trim() && typeof section.title === "string" && !!section.title.trim() && typeof section.selectionRef === "string" && !!section.selectionRef.trim() && typeof section.topic === "string" && !!section.topic.trim() && isSfPeriod(section.period))
}
function isCapture(value: unknown): value is DashboardHistoricalCapture {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const stored = object(value)
  return stored.schema === "sf-dashboard-historical-capture-v1" && typeof stored.id === "string" && typeof stored.capturedBy === "string" && typeof stored.capturedAt === "string" &&
    typeof stored.receiptDigest === "string" && typeof stored.projectionDigest === "string" && object(stored.source).kind === "record" && Array.isArray(object(stored.projection).values) && !!object(stored.projection).context
}
