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
import { createDashboardSourceIssuer } from "../../../../modules/sucafina/Sucafinav1/product/integration/dashboard-sources.ts"
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
    discover: async (request: { page: string; period?: Period }, context: TrustedDomainContext) => {
      const source = host.requestFor(context)
      if (!source || !await host.revalidate(context)) return { status: "denied" as const, reason: "dashboard-discovery-unavailable" }
      const environment = await host.environment(source)
      const year = new Date(environment.at).getUTCFullYear()
      const period = request.period ?? { start: `${year}-01-01`, end: `${year}-12-31` }
      if (!isSfPeriod(period)) return { status: "needs-input" as const, reason: "invalid-dashboard-period" }
      const definition = agendaDefinition(request.page, period)
      const selected = definition ? await createDashboardSourceIssuer({ host, scopedSources: input.scopedSources })({ page: request.page, fields: definition.fields, period }, context) : undefined
      if (selected && selected.status !== "ok") return selected
      const agendaRequest = selected?.status === "ok" && definition ? { id: "dashboard", title: request.page, selectionRef: selected.value.selectionRef, topic: definition.topic, period } : undefined
      const selectedAgenda = agendaRequest ? await agenda(agendaRequest, context) : undefined
      if (selectedAgenda && selectedAgenda.status !== "ok") return selectedAgenda
      const records: { label: string; sourceRef: string; draft?: { target: SourceRef; targetEvidence: Extract<BusinessEvidenceRef, { kind: "record" }>; fields: { action: string; owner: string; due: string; priority: "critical" | "high" | "normal"; notes: string } } }[] = []
      if (selectedAgenda?.status === "ok") for (const reference of selectedAgenda.value.recordRefs.slice(0, 100)) {
        const resolved = await input.records.resolve(reference, context)
        if (resolved.status !== "ok" || !resolved.value.target.period) continue
        const target = resolved.value.target
        const recordPeriod = resolved.value.target.period
        const prefix = target.recordType === "itperf-item" ? `itperf.items[id:${encodeURIComponent(target.recordId)}].` : `${target.recordType}[id:${encodeURIComponent(target.recordId)}].`
        const values = selectedAgenda.value.projection.values.filter((value) => value.id.startsWith(prefix) && /^[A-Za-z][A-Za-z0-9_]*$/.test(value.id.slice(prefix.length)))
        let fields = [...new Set(values.map((value) => value.id.slice(prefix.length)).filter((field) => field !== "id"))].sort()
        let periodLabel: string | undefined
        if (target.recordType === "opsTickets") {
          const identity = await input.records.issue({ page: "IT Operations", recordType: "opsTickets", recordId: target.recordId, fields: ["year", "month"], period: recordPeriod }, context)
          const observed = identity.status === "ok" ? await input.records.read(identity.value.refId, context) : undefined
          if (observed?.status !== "ok") continue
          const year = observed.value.values.find((value) => value.id.endsWith(":year"))?.value
          const month = observed.value.values.find((value) => value.id.endsWith(":month"))?.value
          if (typeof year !== "number" || !Number.isInteger(year) || typeof month !== "number" || !Number.isInteger(month) || month < 1 || month > 12) continue
          periodLabel = `${year}-${String(month).padStart(2, "0")}`
          const ticketPrefix = `tickets:${periodLabel}:`
          // Absent metrics remain visible in the agenda, but do not name physical fields that can be captured.
          // The record issuer rechecks that every observed metric still exists on this authorized ticket row.
          fields = ["year", "month", ...selectedAgenda.value.projection.values.filter((value) => value.id.startsWith(ticketPrefix) && value.evidenceState === "confirmed").map((value) => value.id.slice(ticketPrefix.length))]
        }
        const signal = request.page === "Executive Dashboard" ? selectedAgenda.value.projection.values.filter((value) => value.drilldown?.kind === "record" && value.drilldown.refId === reference) : []
        if (signal.length) fields = target.fields.filter((field) => field !== "id")
        if (!fields.length) continue
        const record = signal.length ? resolved : await input.records.issue({ page: request.page, recordType: target.recordType, recordId: target.recordId, fields, period: recordPeriod }, context)
        if (record.status !== "ok") continue
        const material = await input.records.read(record.value.refId, context)
        if (material.status !== "ok") continue
        const labelValue = ["action", "name", "title", "vendor", "owner"].map((field) => values.find((value) => value.id === `${prefix}${field}`)?.value).find((value) => typeof value === "string" && value.trim())
        const signalLabel = signal.find((value) => value.id.endsWith(".fact"))?.value
        const label = typeof signalLabel === "string" ? signalLabel : typeof labelValue === "string" ? labelValue : periodLabel ? `Chamados · ${periodLabel}` : `${request.page} · ${records.length + 1}`
        const entry: typeof records[number] = { label, sourceRef: record.value.refId }
        if (target.recordType === "hotTopics") {
          const draftSource = await issue({ recordType: "hotTopics", recordId: target.recordId, fields: ["action", "due", "notes", "owner", "priority"], period: recordPeriod }, context)
          const projection = draftSource.status === "ok" ? await input.records.read(draftSource.value.refId, context) : undefined
          if (draftSource.status === "ok" && projection?.status === "ok") {
            const field = (name: string) => projection.value.values.find((value) => value.id === `hotTopics:${encodeURIComponent(target.recordId)}:${name}`)?.value
            const action = field("action"), owner = field("owner"), due = field("due"), priority = field("priority"), notes = field("notes")
            const identity = projection.value.context.sourceRefs[0]
            if (identity && typeof action === "string" && typeof owner === "string" && typeof due === "string" && typeof notes === "string" && ["critical", "high", "normal"].some((value) => value === priority))
              entry.draft = { target: identity, targetEvidence: draftSource.value, fields: { action, owner, due, notes, priority: priority === "critical" ? "critical" : priority === "high" ? "high" : "normal" } }
          }
        }
        records.push(entry)
      }
      const preferences = await state.read(source, "preferences", (stored, authority) => sameAuthority(authority, context) ? Object.entries(stored.preferences)
        .filter(([key, value]) => key.startsWith("sf:dashboard-host:capture:") && isCapture(value) && value.capturedBy === authority.principalRef)
        .map(([, value]) => value).filter(isCapture).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)).slice(0, 100).map((capture) => capture.id) : [])
      const historyOptions: { kind: "capture" | "review"; ref: string; label: string }[] = []
      if (preferences.status === "ok") for (const id of preferences.value) {
        const reopened = await history.reopen(id, context)
        if (reopened.status !== "ok") continue
        const label = reopened.value.projection.values.find((value) => typeof value.value === "string" && value.value.trim())?.value
        historyOptions.push({ kind: "capture", ref: id, label: `${typeof label === "string" ? label : "Retrato de registro"} · ${reopened.value.capturedAt.slice(0, 10)}` })
      }
      const savedReviews = await state.read(source, "reviews", (stored, authority) => sameAuthority(authority, context) ? Object.values(stored.reviews)
        .filter((review) => review.sections.every((section) => object(object(section.content).context).principalRef === authority.principalRef))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100).map((review) => review.id) : [])
      if (savedReviews.status === "ok") for (const id of savedReviews.value) {
        const current = await reviews.read(id, context)
        if (current.status === "ok") historyOptions.push({ kind: "review", ref: id, label: `${current.value.sections.map((section) => section.title).join(", ")} · ${current.value.createdAt.slice(0, 10)}` })
      }
      const actions = await input.authority.humanActions(source)
      if (selected?.status === "ok") {
        const current = await input.sources.resolveDashboardSource(selected.value.selectionRef, context)
        if (current.status !== "ok" || digestSfValue(current.value.evidence) !== digestSfValue(selected.value.evidence))
          return { status: "stale" as const, reason: "dashboard-discovery-source-changed" }
      }
      if (!await host.revalidate(context)) return { status: "denied" as const, reason: "dashboard-discovery-unavailable" }
      return { status: "ok" as const, value: { period, ...(agendaRequest && selectedAgenda?.status === "ok" ? { agenda: { section: agendaRequest, recordCount: selectedAgenda.value.recordCount } } : {}),
        records, recordLimit: 100, history: historyOptions, permissions: {
          preserve: actions.includes("reviews.preserve") && (savedReviews.status === "ok" || savedReviews.status === "unavailable" && savedReviews.reason === "product-state-uninitialized"),
          capture: actions.includes("reviews.preserve") && (preferences.status === "ok" || preferences.status === "unavailable" && preferences.reason === "product-state-uninitialized"),
        } } }
    },
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

function agendaDefinition(page: string, period: Period) {
  const pages: Record<string, { topic: string; fields: string[] }> = {
    "Executive Dashboard": { topic: "executive", fields: ["executive", "executiveMonths", "signals"] },
    "Budget Overview": { topic: "budget", fields: ["opexOwners", "opexEntries", "capexProjects", "capexEntries", ...(period.start.endsWith("01-01") && period.end.endsWith("12-31") ? ["budgetMetrics"] : ["budgetSeries"])] },
    "OPEX Detail": { topic: "opex-detail", fields: ["opexOwners", "opexEntries"] }, "CAPEX Projects": { topic: "capex-projects", fields: ["capexProjects", "capexEntries"] },
    "Headcount Overview": { topic: "headcount", fields: ["members"] }, "Team Structure": { topic: "team-structure", fields: ["leaders"] }, "Talent Review": { topic: "talent-review", fields: ["members", "leaders"] },
    "Portfolio Dashboard": { topic: "projects", fields: ["projects", "milestoneDates"] }, "All Projects": { topic: "all-projects", fields: ["projects", "milestoneDates"] },
    "Hot Topics & Actions": { topic: "hot-topics", fields: ["hotTopics"] }, "IT Operations": { topic: "it-operations", fields: ["opsTickets"] }, "IT Security KPIs": { topic: "it-security", fields: ["secKpi"] },
    "IT Risks": { topic: "it-risks", fields: ["risks"] }, "Vendor Contracts": { topic: "vendor-contracts", fields: ["contracts"] }, "Stakeholder Management": { topic: "stakeholders", fields: ["stakeholders"] },
    "IT Performance Contract": { topic: "it-performance", fields: ["itperf"] },
  }
  return pages[page]
}
