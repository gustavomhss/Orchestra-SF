import { pinReviewReadProperties } from "../../../../modules/sucafina/Sucafinav1/product/reviews/read-identity.ts"
import { isInstalledSfStateRead, selectSfReviewReceipts } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DomainProjection, PreservedReview, SourceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { dashboardScopeAuthority, isInstalledSfSourceResolver } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import type { SfScopedSourcePort, SfSourceScope } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import type { Snapshot } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { hasSfDashboardSourceFence, object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { createDashboardSourceHost, createDashboardRecordEvidenceHost, dashboardSourceSelector } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/sources.ts"
import { createDashboardRecordSourceIssuer } from "../../../../modules/sucafina/Sucafinav1/product/integration/dashboard-sources.ts"
import { createSfReviewCalculationHistory } from "./review-calculation-history.ts"

/** Read-only history is anchored in immutable review bodies and their atomic C08 receipts. */
export function createSfReviewHistory(input: {
  authority: Pick<ReturnType<typeof createSfProductAuthority>, "host" | "state" | "creationTarget">
  persistence: SfScopedSourcePort
  evidence: BusinessContextService
  authorizeCase?: Parameters<typeof createSfReviewCalculationHistory>[0]["authorizeCase"]
}) {
  const { authority } = input
  const host = authority.host
  const calculation = createSfReviewCalculationHistory(input)
  const dashboard = createDashboardSourceHost({ host, scopedSources: input.persistence })
  const dashboardRecords = createDashboardRecordEvidenceHost({ host, scopedSources: input.persistence,
    issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: input.persistence }) })
  const scoped = async (ref: SourceRef, call: TrustedDomainContext) => {
    const request = host.requestFor(call)
    if (!request || !await host.revalidate(call)) return undefined
    const authorize = async (snapshot: Pick<Snapshot, "data">, scope: SfSourceScope) => {
      if (scope.principalRef !== call.binding.principalRef || scope.accessRevision !== call.binding.accessRevision || scope.policyVersion !== call.binding.policyVersion ||
        scope.recordType !== ref.type || scope.recordId !== ref.id || request.signal.aborted) return false
      const principal = await host.authenticate(request, { surface: ref.surface, roleMap: roleMap(snapshot, ref.surface) })
      if (!principal || principal.id !== call.binding.principalRef || principal.id.startsWith("local:")) return false
      const selector = object(scope.selector)
      const roles = principal.roles.filter((entry) => entry.surface === ref.surface).map((entry) => entry.role)
      const canWrite = principal.canWrite && roles.some((role) => role !== "viewer")
      if (selector.roleMapDigest !== digestSfValue(roleMap(snapshot, ref.surface))) return false
      if (ref.surface === "dashboard") {
        const access = object(object(snapshot.data.access)[principal.id])
        const actor = { id: principal.id, roles, canWrite,
          assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [],
          domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
        return digestSfValue(selector.actor) === digestSfValue(actor)
      }
      return selector.canWrite === canWrite && Array.isArray(selector.roles) && digestSfValue([...selector.roles].sort()) === digestSfValue([...roles].sort())
    }
    const source = await input.persistence.resolveScopedSource(ref.surface, ref.incarnation, ref.surface === "dashboard" ? dashboardScopeAuthority(authorize) : authorize)
    if (!source || source.incarnation !== ref.incarnation || source.version < ref.version) return undefined
    const selector = object(source.scope.selector)
    const projection = object(source.projection)
    const fields = Array.isArray(selector.fields) ? selector.fields : Object.keys(projection)
    if (!ref.fields.length || ref.fields.some((field) => !fields.includes(field))) return undefined
    const selectedPeriod = object(selector.period)
    const year = typeof projection.year === "number" ? projection.year : undefined
    const period = typeof selectedPeriod.start === "string" && typeof selectedPeriod.end === "string" ? { start: selectedPeriod.start, end: selectedPeriod.end }
      : year && Number.isSafeInteger(year) ? { start: `${year}-01-01`, end: `${year}-12-31` } : undefined
    return period && period.start <= ref.period.start && period.end >= ref.period.end && await host.revalidate(call) ? source : undefined
  }
  const captures = async <T>(call: TrustedDomainContext, project: (review: PreservedReview, digest: string) => readonly T[]) => {
    const request = host.requestFor(call)
    if (!request || !await host.revalidate(call)) return undefined
    const found = await authority.state.read(request, "reviews", selectSfReviewReceipts((state, actor) => {
      if (actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion) return undefined
      const receipts = Object.values(state.transactions).filter((receipt) => receipt.namespace === "reviews" && receipt.principalRef === actor.principalRef &&
        receipt.targetRef === authority.creationTarget.ref && receipt.targetIncarnation === authority.creationTarget.incarnation)
      return Object.values(state.reviews).flatMap((review) => {
        const observed = { digest: undefined as string | undefined }
        const digest = () => observed.digest ??= digestSfValue(review)
        const captured = receipts.some((receipt) => {
          const value = object(receipt.value)
          return value.schema === "sf-review-receipt-v1" && Object.keys(value).length === 3 && value.reviewRef === review.id && value.reviewDigest === digest() ||
            value.schema === undefined && value.id === review.id && Array.isArray(value.sections) && Array.isArray(value.sourceRefs) && digestSfValue(value) === digest()
        })
        return captured ? project(review, digest()) : []
      })
    }))
    if (request.signal.aborted || host.requestFor(call) !== request || !await host.revalidate(call) || host.requestFor(call) !== request) return undefined
    if (found.status === "denied") return undefined
    if (found.status !== "ok") throw new Error("REVIEW_HISTORY_READ_UNAVAILABLE")
    return found.value
  }
  const historicalSource = async (ref: SourceRef, call: TrustedDomainContext) => {
    const matching = await captures(call, (review, digest) => review.sourceRefs.some((source) => same(source, ref)) ? [digest] : [])
    if (!matching?.length) return false
    const current = await scoped(ref, call)
    const again = await captures(call, (_review, digest) => [digest])
    if (!current || !again || matching.some((digest) => !again.includes(digest))) return false
    const checked = await scoped(ref, call)
    if (!checked || !await host.revalidate(call)) return false
    if (!same(current, checked)) throw new Error("REVIEW_HISTORY_CHANGED")
    return true
  }
  const historicalSources = (call: TrustedDomainContext) => {
    const hostPin = pinReviewReadProperties(host, ["persistence", "requestFor", "revalidate", "authenticate"])
    const state = authority.state
    const statePin = pinReviewReadProperties(state, ["read"])
    const source = input.persistence
    const sourcePin = pinReviewReadProperties(source, ["resolveScopedSource"])
    const persistence = hostPin?.values.persistence
    if (!hostPin || !statePin || !sourcePin || !persistence || !hasSfDashboardSourceFence(persistence) ||
      !isInstalledSfStateRead(statePin.values.read) || !isInstalledSfSourceResolver(sourcePin.values.resolveScopedSource)) return undefined
    const fence = persistence.dashboardSourceFence
    const request = host.requestFor(call)
    const binding = digestSfValue([call.kind, call.binding])
    const current = () => !!request && !request.signal.aborted && hostPin.current() && statePin.current() && sourcePin.current() &&
      authority.state === state && input.persistence === source && persistence.dashboardSourceFence === fence &&
      hasSfDashboardSourceFence(persistence) && host.requestFor(call) === request && digestSfValue([call.kind, call.binding]) === binding
    return (refs: readonly SourceRef[]) => batchHistoricalSources(refs, call, current)
  }
  const batchHistoricalSources = async (refs: readonly SourceRef[], call: TrustedDomainContext, current: () => boolean) => {
    if (!current()) throw new Error("REVIEW_HISTORY_CHANGED")
    if (!refs.length) return []
    if (refs.length === 1) {
      const found = await historicalSource(refs[0]!, call)
      if (!current()) throw new Error("REVIEW_HISTORY_CHANGED")
      return [found]
    }
    const keys = refs.map(digestSfValue)
    const wanted = new Set(keys)
    // The two C08 observations each authorize the entire set against one
    // committed review inventory. Scoped source callbacks remain independent.
    const first = await captures(call, (review, digest) => review.sourceRefs.flatMap((source) => {
      const key = digestSfValue(source)
      return wanted.has(key) ? [{ key, digest }] : []
    }))
    if (!current()) throw new Error("REVIEW_HISTORY_CHANGED")
    if (!first) return refs.map(() => false)
    const matching = new Map<string, Set<string>>()
    for (const entry of first) {
      const digests = matching.get(entry.key) ?? new Set<string>()
      digests.add(entry.digest)
      matching.set(entry.key, digests)
    }
    const before = await Promise.all(refs.map((ref, index) => matching.has(keys[index]!) ? scoped(ref, call) : undefined))
    if (!current()) throw new Error("REVIEW_HISTORY_CHANGED")
    const again = await captures(call, (_review, digest) => [digest])
    if (!current()) throw new Error("REVIEW_HISTORY_CHANGED")
    if (!again) return refs.map(() => false)
    const captured = new Set(again)
    const checked = await Promise.all(refs.map(async (ref, index) => {
      const prior = before[index]
      const digests = matching.get(keys[index]!)
      if (!prior || !digests || [...digests].some((digest) => !captured.has(digest))) return false
      const checked = await scoped(ref, call)
      if (!checked || !await host.revalidate(call)) return false
      if (!same(prior, checked)) throw new Error("REVIEW_HISTORY_CHANGED")
      return true
    }))
    if (!current()) throw new Error("REVIEW_HISTORY_CHANGED")
    return checked
  }
  const currentSource = async (ref: SourceRef, call: TrustedDomainContext) => (await scoped(ref, call))?.version === ref.version
  const resolve: BusinessContextService["resolve"] = async (ref, call) => {
    const current = await input.evidence.resolve(ref, call)
    if (current.state === "fresh" || current.state === "historical" || ref.kind !== "record" && ref.kind !== "calculation" ||
      ["revoked", "replaced", "missing", "invalid"].includes(current.state) || ref.refDigest !== digestSfEvidenceRef(ref) ||
      ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId) return current
    const leaves = evidenceLeaves(ref)
    if (!leaves) return current
    const calculationProof = ref.kind === "calculation" ? await calculation(ref, call) : undefined
    if (ref.kind === "calculation" && !calculationProof) return current
    const records = await captures(call, (review, digest) => review.sections.flatMap((section) => {
      if (!isProjection(section.content) || !sameAuthority(section.content, call) || !containsRef(section.content, ref)) return []
      return [{ digest, sourceRefs: structuredClone(review.sourceRefs), projection: structuredClone(section.content) }]
    }))
    if (!records?.length) return current
    const record = records[0]!
    const readClosure = async () => {
      const values = await Promise.all(leaves.map(async (leaf) => {
        if (leaf.kind !== "record") {
          const checked = await input.evidence.resolve(leaf, call)
          return (checked.state === "fresh" || checked.state === "historical") && checked.accessRevision === call.binding.accessRevision && same(checked.ref, leaf)
            ? { state: checked.state, ref: checked.ref, currentRef: checked.currentRef, projection: checked.authorizedProjection } : undefined
        }
        const source = record.sourceRefs.find((entry) => matchesRecord(entry, leaf))
        const checked = source ? await scoped(source, call) : undefined
        return checked ? { ref: leaf, source: checked } : undefined
      }))
      return values.some((value) => !value) ? undefined : values
    }
    const sources = await readClosure()
    if (!sources) return current
    const again = await captures(call, (_review, digest) => [digest])
    if (!again?.includes(record.digest)) return current
    const checked = await readClosure()
    if (!checked || !same(sources, checked) || ref.kind === "calculation" && await calculation(ref, call) !== calculationProof || !await host.revalidate(call)) return current
    // C05/C06 continuity consumes a real current reference from its producer.
    // Never update the captured reference's version/digest by construction.
    const currentRecord = async () => {
      if (ref.kind !== "record" || ref.target.surface !== "dashboard") return undefined
      const source = record.sourceRefs.find((entry) => matchesRecord(entry, ref))
      const live = source ? await scoped(source, call) : undefined
      if (!live) return undefined
      const selector = dashboardSourceSelector(live.incarnation, live.version)
      const result = ref.target.recordType === "dashboard-page"
        ? await dashboard.resolveDashboardSource(selector, call).then((value) => value.status === "ok" ? value.value.evidence : undefined)
        : await dashboardRecords.resolve(selector, call).then((value) => value.status === "ok" ? value.value : undefined)
      if (!result || result.target.surface !== ref.target.surface || result.target.recordType !== ref.target.recordType ||
        result.target.recordId !== ref.target.recordId || result.target.incarnation !== ref.target.incarnation ||
        result.target.version < ref.target.version || !same(result.target.fields, ref.target.fields) || !same(result.target.period, ref.target.period)) return undefined
      const authorized = await input.evidence.resolve(result, call)
      return authorized.state === "fresh" && authorized.accessRevision === call.binding.accessRevision && same(authorized.ref, result) ? result : undefined
    }
    const currentRef = await currentRecord()
    const finalSources = await readClosure(), finalCaptures = await captures(call, (_review, digest) => [digest])
    if (ref.kind === "record" && ref.target.surface === "dashboard" && !currentRef || !finalSources || !same(checked, finalSources) ||
      !finalCaptures?.includes(record.digest) || !await host.revalidate(call)) return current
    const resolution: BusinessEvidenceResolution = { state: "historical", ref: structuredClone(ref), ...(currentRef ? { currentRef } : {}), authorizedProjection: structuredClone(record.projection),
      accessRevision: call.binding.accessRevision, checkedAt: new Date().toISOString(),
      differences: sources.flatMap((value) => value && "source" in value && value.source && value.ref.kind === "record"
        ? [{ field: `${value.ref.refId}.version`, before: value.ref.target.version, after: value.source.version }] : []) }
    return resolution
  }
  const evidence: BusinessContextService = { ...input.evidence, resolve, context: (request, call) => Promise.all(request.refs.map((ref) => resolve(ref, call))) }
  return { currentSource, historicalSource, historicalSources, evidence }
}

function sameAuthority(projection: DomainProjection, call: TrustedDomainContext) {
  return projection.context.installationId === call.binding.installationId && projection.context.projectId === call.binding.projectId &&
    projection.context.principalRef === call.binding.principalRef && projection.context.accessRevision === call.binding.accessRevision && projection.context.policyVersion === call.binding.policyVersion
}
function matchesRecord(source: SourceRef, ref: Extract<BusinessEvidenceRef, { kind: "record" }>) {
  // Planner issues the full year; the preserved section records the selected window inside it.
  // Requiring the window to cover the year drops that historical body after the year source changes.
  const period = !ref.target.period || (source.surface === "planner"
    ? ref.target.period.start <= source.period.start && ref.target.period.end >= source.period.end
    : source.period.start <= ref.target.period.start && source.period.end >= ref.target.period.end)
  return source.surface === ref.target.surface && source.type === ref.target.recordType && source.id === ref.target.recordId && source.incarnation === ref.target.incarnation &&
    source.version === ref.target.version && ref.target.fields.every((field) => source.fields.includes(field)) && period
}
function containsRef(value: unknown, ref: BusinessEvidenceRef, depth = 0, remaining = { value: 20_000 }): boolean {
  if (depth > 24 || --remaining.value < 0 || !value || typeof value !== "object") return false
  if (!Array.isArray(value) && "refDigest" in value && value.refDigest === ref.refDigest) return same(value, ref)
  return Object.values(value).some((entry) => containsRef(entry, ref, depth + 1, remaining))
}
function evidenceLeaves(ref: BusinessEvidenceRef, depth = 0, remaining = { value: 256 }): BusinessEvidenceRef[] | undefined {
  if (depth >= 16 || --remaining.value < 0 || ref.refDigest !== digestSfEvidenceRef(ref)) return undefined
  if (ref.kind !== "calculation") return [ref]
  if (!ref.target.sourceRefs.length) return undefined
  const children = ref.target.sourceRefs.map((child) => evidenceLeaves(child, depth + 1, remaining))
  return children.some((child) => !child) ? undefined : children.flatMap((child) => child ?? [])
}
function isProjection(value: unknown): value is DomainProjection {
  const projection = object(value)
  return !!projection.context && typeof projection.context === "object" && Array.isArray(object(projection.context).sourceRefs) &&
    Array.isArray(projection.values) && Array.isArray(projection.components) && Array.isArray(projection.missing) && typeof projection.engineVersion === "string" && Number.isSafeInteger(projection.version)
}
function same(left: unknown, right: unknown) { return digestSfValue(left) === digestSfValue(right) }
