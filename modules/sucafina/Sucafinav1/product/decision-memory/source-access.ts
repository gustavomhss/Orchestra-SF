import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../contracts/business-context.ts"
import type { DashboardPort, DecisionCasePort, DomainPortHost, PortResult, ProcurementPort } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { Period } from "../contracts/context.ts"
import type { SfDocumentReader } from "../documents/evidence-resolver.ts"
import type { createProcurementSourceResolver } from "../procurement/sources.ts"
import type { createDashboardRecordEvidenceHost } from "../dashboard/sources.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"

type RecordRef = Extract<BusinessEvidenceRef, { kind: "record" }>
type DashboardIssuer = (selection: { page: string; fields: readonly string[]; period: Period }, context: TrustedDomainContext) => Promise<PortResult<{ selectionRef: string; evidence: RecordRef }>>

/** The issuer and port are the real Dashboard paths; a stored scope is never a credential. */
export function createSfDashboardSourceAccess(input: { host: DomainPortHost; issue: DashboardIssuer; dashboard: DashboardPort }) {
  return async (ref: BusinessEvidenceRef, call: TrustedDomainContext): Promise<BusinessEvidenceResolution> => {
    const unavailable = (checkedAt = ""): BusinessEvidenceResolution => ({ state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt })
    try {
      if (ref.kind !== "record" || ref.target.surface !== "dashboard" || ref.target.recordType !== "dashboard-page" || !ref.target.period || ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId || ref.refDigest !== digestSfEvidenceRef(ref)) return unavailable()
      const target = ref.target
      const request = input.host.requestFor(call)
      if (!request || request.signal.aborted || !await input.host.revalidate(call)) return unavailable()
      const now = await input.host.environment(request)
      if (!Number.isFinite(Date.parse(now.at))) return unavailable()
      const period = target.period
      if (!period) return unavailable(now.at)
      const fields = [...target.fields].sort()
      if (!fields.length || new Set(fields).size !== fields.length) return unavailable(now.at)
      const issued = await input.issue({ page: target.recordId, fields, period }, call)
      if (issued.status !== "ok" || !await input.host.revalidate(call)) return unavailable(now.at)
      const current = issued.value.evidence
      if (current.schema !== "sf-evidence-v1" || current.kind !== "record" || current.installationId !== call.binding.installationId || current.projectId !== call.binding.projectId || current.refDigest !== digestSfEvidenceRef(current) || current.target.surface !== "dashboard" || current.target.recordType !== target.recordType || current.target.recordId !== target.recordId || digestSfValue([...current.target.fields].sort()) !== digestSfValue(fields) || digestSfValue(current.target.period) !== digestSfValue(period)) return unavailable(now.at)
      const continuity = async () => {
        if (!await input.host.revalidate(call)) return false
        const valid = await input.host.persistence.transaction("dashboard", async (snapshot: Snapshot) => {
          const principal = await input.host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
          if (request.signal.aborted || !principal || principal.id !== call.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: false }
          const entries = Object.values(snapshot.sfSources?.scopes ?? {})
          const original = entries.filter((entry) => entry.incarnation === target.incarnation && entry.scope.recordType === target.recordType && entry.scope.recordId === target.recordId)
          const present = entries.filter((entry) => entry.alive && entry.incarnation === current.target.incarnation && entry.scope.principalRef === principal.id && entry.scope.accessRevision === call.binding.accessRevision && entry.scope.policyVersion === call.binding.policyVersion && entry.scope.recordType === target.recordType && entry.scope.recordId === target.recordId)
          const old = original.length === 1 ? original[0] : undefined
          const active = present.length === 1 ? present[0] : undefined
          const selector = object(old?.scope.selector)
          const physical = snapshot.sfSources?.records[JSON.stringify([target.recordType, target.recordId])]
          const valid = !!old && !!active && !!physical?.alive && old.sourceIncarnation === physical.incarnation && active.sourceIncarnation === physical.incarnation && old.version === target.version && old.inputDigest === target.projectionDigest && active.version === current.target.version && digestSfValue(selector.fields) === digestSfValue(fields) && digestSfValue(selector.period) === digestSfValue(period)
          return { commit: false, value: valid }
        }, { signal: request.signal })
        return valid && await input.host.revalidate(call)
      }
      if (!await continuity() || current.target.projectionDigest !== target.projectionDigest) return unavailable(now.at)
      const projection = await input.dashboard.read({ selectionRef: issued.value.selectionRef, fields, period }, call)
      if (projection.status !== "ok" || !await continuity() || !await input.host.revalidate(call)) return unavailable(now.at)
      return { state: "fresh", ref, currentRef: current, authorizedProjection: projection.value, accessRevision: call.binding.accessRevision, checkedAt: now.at }
    } catch {
      return unavailable()
    }
  }
}

/** Individual records remain bound to the currently authorized scoped reference. */
export function createSfDashboardRecordSourceAccess(input: { host: DomainPortHost; records: Pick<ReturnType<typeof createDashboardRecordEvidenceHost>, "resolve" | "read"> }) {
  return async (ref: BusinessEvidenceRef, call: TrustedDomainContext): Promise<BusinessEvidenceResolution> => {
    const unavailable = (checkedAt = ""): BusinessEvidenceResolution => ({ state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt })
    try {
      if (ref.kind !== "record" || ref.target.surface !== "dashboard" || ref.target.recordType === "dashboard-page" || !ref.target.period || ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId || ref.refDigest !== digestSfEvidenceRef(ref)) return unavailable()
      const request = input.host.requestFor(call)
      const binding = digestSfValue(call.binding)
      if (!request || request.signal.aborted || !await input.host.revalidate(call) || digestSfValue(call.binding) !== binding) return unavailable()
      const now = await input.host.environment(request)
      if (!Number.isFinite(Date.parse(now.at))) return unavailable()
      const first = await input.records.resolve(ref.refId, call)
      if (first.status !== "ok" || digestSfValue(first.value) !== digestSfValue(ref) || !await input.host.revalidate(call) || digestSfValue(call.binding) !== binding) return unavailable(now.at)
      const projection = await input.records.read(ref.refId, call)
      if (projection.status !== "ok" || projection.value.context.installationId !== call.binding.installationId || projection.value.context.projectId !== call.binding.projectId || projection.value.context.principalRef !== call.binding.principalRef || projection.value.context.accessRevision !== call.binding.accessRevision || projection.value.context.policyVersion !== call.binding.policyVersion || projection.value.context.surface !== "dashboard" || digestSfValue(projection.value.context.period) !== digestSfValue(ref.target.period)) return unavailable(now.at)
      const source = projection.value.context.sourceRefs
      if (source.length !== 1 || source[0]!.surface !== "dashboard" || source[0]!.type !== ref.target.recordType || source[0]!.id !== ref.target.recordId || source[0]!.incarnation !== ref.target.incarnation || source[0]!.version !== ref.target.version || digestSfValue(source[0]!.fields) !== digestSfValue(ref.target.fields) || digestSfValue(source[0]!.period) !== digestSfValue(ref.target.period) || projection.value.values.some((value) => value.sourceRefs.length !== 1 || digestSfValue(value.sourceRefs[0]) !== digestSfValue(ref) || digestSfValue(value.drilldown) !== digestSfValue(ref))) return unavailable(now.at)
      const again = await input.records.resolve(ref.refId, call)
      if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(ref) || request.signal.aborted || !await input.host.revalidate(call) || digestSfValue(call.binding) !== binding) return unavailable(now.at)
      return { state: "fresh", ref, currentRef: again.value, authorizedProjection: projection.value, accessRevision: call.binding.accessRevision, checkedAt: now.at }
    } catch {
      return unavailable()
    }
  }
}

/** Only a host-owned protected-Atlas reader may supply the original reference; the callback is not a grant. */
export function createSfDashboardContinuityProof(input: {
  host: DomainPortHost
  issue: DashboardIssuer
  dashboard: DashboardPort
  readOriginal: (originalDigest: string, call: TrustedDomainContext) => Promise<BusinessEvidenceRef | undefined>
}) {
  return async (originalRef: BusinessEvidenceRef, currentRef: BusinessEvidenceRef, call: TrustedDomainContext): Promise<boolean> => {
    try {
      if (originalRef.kind !== "record" || currentRef.kind !== "record" || originalRef.target.surface !== "dashboard" || currentRef.target.surface !== "dashboard" || originalRef.target.recordType !== "dashboard-page" || currentRef.target.recordType !== "dashboard-page" || !originalRef.target.period || originalRef.installationId !== call.binding.installationId || currentRef.installationId !== call.binding.installationId || originalRef.projectId !== call.binding.projectId || currentRef.projectId !== call.binding.projectId || originalRef.refDigest !== digestSfEvidenceRef(originalRef) || currentRef.refDigest !== digestSfEvidenceRef(currentRef)) return false
      const original = originalRef.target
      const current = currentRef.target
      const period = original.period
      if (!period || original.recordId !== current.recordId || digestSfValue([...original.fields].sort()) !== digestSfValue([...current.fields].sort()) || digestSfValue(period) !== digestSfValue(current.period)) return false
      const request = input.host.requestFor(call)
      if (!request || request.signal.aborted || !await input.host.revalidate(call)) return false
      const load = async () => {
        const protectedRef = await input.readOriginal(originalRef.refDigest, call)
        return !!protectedRef && digestSfValue(protectedRef) === digestSfValue(originalRef) && await input.host.revalidate(call)
      }
      if (!await load()) return false
      const issued = await input.issue({ page: original.recordId, fields: original.fields, period }, call)
      if (issued.status !== "ok" || digestSfValue(issued.value.evidence) !== digestSfValue(currentRef)) return false
      const check = async () => {
        if (!await input.host.revalidate(call)) return false
        const valid = await input.host.persistence.transaction("dashboard", async (snapshot: Snapshot) => {
          const principal = await input.host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
          if (request.signal.aborted || !principal || principal.id !== call.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: false }
          const entries = Object.values(snapshot.sfSources?.scopes ?? {})
          const oldMatches = entries.filter((entry) => entry.incarnation === original.incarnation && entry.scope.recordType === original.recordType && entry.scope.recordId === original.recordId)
          const currentMatches = entries.filter((entry) => entry.alive && entry.incarnation === current.incarnation && entry.scope.principalRef === principal.id && entry.scope.accessRevision === call.binding.accessRevision && entry.scope.policyVersion === call.binding.policyVersion && entry.scope.recordType === current.recordType && entry.scope.recordId === current.recordId)
          const old = oldMatches.length === 1 ? oldMatches[0] : undefined
          const active = currentMatches.length === 1 ? currentMatches[0] : undefined
          const oldSelector = object(old?.scope.selector)
          const activeSelector = object(active?.scope.selector)
          const source = snapshot.sfSources?.records[JSON.stringify([original.recordType, original.recordId])]
          const valid = !!old && !!active && !!source?.alive && old.sourceIncarnation === source.incarnation && active.sourceIncarnation === source.incarnation && active.version === current.version && active.inputDigest === current.projectionDigest && oldSelector.page === original.recordId && activeSelector.page === current.recordId && digestSfValue(oldSelector.fields) === digestSfValue([...original.fields].sort()) && digestSfValue(oldSelector.period) === digestSfValue(period) && digestSfValue(activeSelector.fields) === digestSfValue([...current.fields].sort()) && digestSfValue(activeSelector.period) === digestSfValue(current.period)
          return { commit: false, value: valid }
        }, { signal: request.signal })
        return valid && await input.host.revalidate(call)
      }
      if (!await check()) return false
      const projection = await input.dashboard.read({ selectionRef: issued.value.selectionRef, fields: original.fields, period }, call)
      return projection.status === "ok" && await check() && await load()
    } catch {
      return false
    }
  }
}

/** Non-Dashboard route. The host injects the existing per-domain reader, never BCS.resolve itself. */
export function createSfSourceContinuityProof(input: {
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  readOriginal: (originalDigest: string, call: TrustedDomainContext) => Promise<BusinessEvidenceRef | undefined>
  readCurrent: (original: BusinessEvidenceRef, call: TrustedDomainContext) => Promise<BusinessEvidenceResolution>
}) {
  return async (original: BusinessEvidenceRef, current: BusinessEvidenceRef, call: TrustedDomainContext): Promise<boolean> => {
    try {
      const request = input.host.requestFor(call)
      if (!request || request.signal.aborted || !await input.host.revalidate(call) || original.installationId !== call.binding.installationId || current.installationId !== call.binding.installationId || original.projectId !== call.binding.projectId || current.projectId !== call.binding.projectId || original.refDigest !== digestSfEvidenceRef(original) || current.refDigest !== digestSfEvidenceRef(current)) return false
      if (!sameCurrentSource(original, current)) return false
      const check = async () => {
        if (request.signal.aborted || !await input.host.revalidate(call)) return false
        const fromAtlas = await input.readOriginal(original.refDigest, call)
        if (!fromAtlas || digestSfValue(fromAtlas) !== digestSfValue(original)) return false
        const resolution = await input.readCurrent(original, call)
        const actual = resolution.currentRef ?? resolution.ref
        return resolution.state === "fresh" && !!resolution.authorizedProjection && resolution.accessRevision === call.binding.accessRevision && digestSfValue(resolution.ref) === digestSfValue(original) && digestSfValue(actual) === digestSfValue(current) && !request.signal.aborted && await input.host.revalidate(call)
      }
      return await check() && await check()
    } catch {
      return false
    }
  }
}

function sameCurrentSource(original: BusinessEvidenceRef, current: BusinessEvidenceRef) {
  if (original.kind === "record" && current.kind === "record") return original.target.surface !== "dashboard" && original.target.surface === current.target.surface && original.target.recordType === current.target.recordType && original.target.recordId === current.target.recordId && original.target.incarnation === current.target.incarnation && digestSfValue([...original.target.fields].sort()) === digestSfValue([...current.target.fields].sort()) && digestSfValue(original.target.period) === digestSfValue(current.target.period)
  if (original.kind === "document" && current.kind === "document") return original.target.documentId === current.target.documentId && original.target.incarnation === current.target.incarnation && digestSfValue(original.target.segment) === digestSfValue(current.target.segment)
  if (original.kind === "receipt" && current.kind === "receipt") return original.target.surface === current.target.surface && original.target.receiptId === current.target.receiptId && original.target.targetIncarnation === current.target.targetIncarnation && original.target.idempotencyKey === current.target.idempotencyKey && original.target.commandDigest === current.target.commandDigest
  if (original.kind === "case-event" && current.kind === "case-event") return original.target.caseId === current.target.caseId && original.target.caseIncarnation === current.target.caseIncarnation && original.target.eventId === current.target.eventId && original.target.outputDigest === current.target.outputDigest
  if ((original.kind === "calculation" && current.kind === "calculation") || (original.kind === "policy" && current.kind === "policy")) return digestSfValue(original) === digestSfValue(current)
  return false
}

/** Immutable ledger events are re-read through the authorized case port on every use. */
export function createSfCaseEventSourceAccess(input: { host: DomainPortHost; cases: DecisionCasePort }) {
  return async (ref: BusinessEvidenceRef, call: TrustedDomainContext): Promise<BusinessEvidenceResolution> => {
    const unavailable = (checkedAt = ""): BusinessEvidenceResolution => ({ state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt })
    try {
      if (ref.kind !== "case-event" || ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId || ref.refDigest !== digestSfEvidenceRef(ref)) return unavailable()
      const request = input.host.requestFor(call)
      if (!request || request.signal.aborted || !await input.host.revalidate(call)) return unavailable()
      const now = await input.host.environment(request)
      if (!Number.isFinite(Date.parse(now.at))) return unavailable()
      const target = ref.target
      const read = async () => {
        const result = await input.cases.read({ caseRef: encodeCaseRef({ id: target.caseId, incarnation: target.caseIncarnation }) }, call)
        if (result.status !== "ok" || result.value.context.installationId !== call.binding.installationId || result.value.context.projectId !== call.binding.projectId || result.value.context.principalRef !== call.binding.principalRef || result.value.context.accessRevision !== call.binding.accessRevision || result.value.context.policyVersion !== call.binding.policyVersion || result.value.case.id !== target.caseId || result.value.case.incarnation !== target.caseIncarnation || result.value.case.version < target.caseVersion) return undefined
        const events = result.value.events.filter((event) => event.id === target.eventId)
        const ledger = result.value.case.ledger.filter((event) => event.id === target.eventId)
        if (events.length !== 1 || ledger.length !== 1) return undefined
        const event = events[0]!
        if (digestSfValue(event) !== digestSfValue(ledger[0]) || event.caseRef.id !== target.caseId || event.caseRef.incarnation !== target.caseIncarnation || event.caseRef.version !== target.caseVersion || event.outputDigest !== target.outputDigest || digestSfValue(event.evidenceRefs) !== digestSfValue(target.evidenceRefs)) return undefined
        return event
      }
      const event = await read()
      if (!event || request.signal.aborted || !await input.host.revalidate(call)) return unavailable(now.at)
      const again = await read()
      if (!again || digestSfValue(event) !== digestSfValue(again) || request.signal.aborted || !await input.host.revalidate(call)) return unavailable(now.at)
      return { state: "fresh", ref, currentRef: ref, authorizedProjection: event, accessRevision: call.binding.accessRevision, checkedAt: now.at }
    } catch {
      return unavailable()
    }
  }
}

/** The existing Procurement resolver and port reauthenticate and project the current record. */
export function createSfProcurementSourceAccess(input: { host: DomainPortHost; resolve: ReturnType<typeof createProcurementSourceResolver>["resolve"]; procurement: ProcurementPort }) {
  return async (ref: BusinessEvidenceRef, call: TrustedDomainContext): Promise<BusinessEvidenceResolution> => {
    const unavailable = (checkedAt = ""): BusinessEvidenceResolution => ({ state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt })
    try {
      if (ref.kind !== "record" || ref.target.surface !== "procurement" || !["procurement-request", "procurement-supplier"].includes(ref.target.recordType) || ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId || ref.refDigest !== digestSfEvidenceRef(ref)) return unavailable()
      const request = input.host.requestFor(call)
      if (!request || request.signal.aborted || !await input.host.revalidate(call)) return unavailable()
      const now = await input.host.environment(request)
      if (!Number.isFinite(Date.parse(now.at))) return unavailable()
      const current = await input.resolve(ref.refId, call)
      if (current.status !== "ok" || digestSfValue(current.value.evidence) !== digestSfValue(ref) || !await input.host.revalidate(call)) return unavailable(now.at)
      const projection = ref.target.recordType === "procurement-request"
        ? await input.procurement.read({ requestRef: ref.refId }, call)
        : await input.procurement.readSupplier({ supplierRef: ref.refId, fields: ref.target.fields }, call)
      if (projection.status !== "ok" || projection.value.context.installationId !== call.binding.installationId || projection.value.context.projectId !== call.binding.projectId || projection.value.context.principalRef !== call.binding.principalRef || projection.value.context.accessRevision !== call.binding.accessRevision || projection.value.context.policyVersion !== call.binding.policyVersion) return unavailable(now.at)
      const again = await input.resolve(ref.refId, call)
      if (again.status !== "ok" || digestSfValue(again.value.evidence) !== digestSfValue(ref) || request.signal.aborted || !await input.host.revalidate(call)) return unavailable(now.at)
      return { state: "fresh", ref, currentRef: again.value.evidence, authorizedProjection: projection.value, accessRevision: call.binding.accessRevision, checkedAt: now.at }
    } catch {
      return unavailable()
    }
  }
}

/** Documents use the document owner's resolver and require its confirmed typed projection. */
export function createSfDocumentSourceAccess(input: { host: DomainPortHost; read: SfDocumentReader }) {
  return async (ref: BusinessEvidenceRef, call: TrustedDomainContext): Promise<BusinessEvidenceResolution> => {
    const unavailable = (checkedAt = ""): BusinessEvidenceResolution => ({ state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt })
    try {
      if (ref.kind !== "document" || !ref.target.fieldCandidateId || ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId || ref.refDigest !== digestSfEvidenceRef(ref)) return unavailable()
      const request = input.host.requestFor(call)
      if (!request || request.signal.aborted || !await input.host.revalidate(call)) return unavailable()
      const { resolveSfDocumentEvidence } = await import("../documents/evidence-resolver.ts")
      const first = await resolveSfDocumentEvidence(ref, call, input.read)
      if (first.state !== "fresh" || !first.authorizedProjection || !("status" in first.authorizedProjection) || first.authorizedProjection.status !== "confirmed" || !("ref" in first.authorizedProjection) || first.authorizedProjection.ref.refDigest !== ref.refDigest || first.authorizedProjection.id !== ref.target.fieldCandidateId || first.accessRevision !== call.binding.accessRevision || !await input.host.revalidate(call)) return unavailable(first.checkedAt)
      const second = await resolveSfDocumentEvidence(ref, call, input.read)
      if (second.state !== "fresh" || !second.authorizedProjection || !("status" in second.authorizedProjection) || second.authorizedProjection.status !== "confirmed" || !("ref" in second.authorizedProjection) || second.authorizedProjection.ref.refDigest !== ref.refDigest || second.authorizedProjection.id !== ref.target.fieldCandidateId || second.accessRevision !== call.binding.accessRevision || digestSfValue(first.authorizedProjection) !== digestSfValue(second.authorizedProjection) || request.signal.aborted || !await input.host.revalidate(call)) return unavailable(second.checkedAt)
      return { ...second, currentRef: ref }
    } catch {
      return unavailable()
    }
  }
}
