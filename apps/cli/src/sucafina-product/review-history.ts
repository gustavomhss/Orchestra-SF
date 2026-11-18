import { digestSfEvidenceRef, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DomainProjection, SourceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { SfScopedSourcePort } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { createSfReviewCalculationHistory } from "./review-calculation-history.ts"

/** Read-only history is anchored in immutable review bodies and their atomic C08 receipts. */
export function createSfReviewHistory(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  persistence: SfScopedSourcePort
  evidence: BusinessContextService
  authorizeCase?: Parameters<typeof createSfReviewCalculationHistory>[0]["authorizeCase"]
}) {
  const { authority } = input
  const host = authority.host
  const calculation = createSfReviewCalculationHistory(input)
  const scoped = async (ref: SourceRef, call: TrustedDomainContext) => {
    const request = host.requestFor(call)
    if (!request || !await host.revalidate(call)) return undefined
    const source = await input.persistence.resolveScopedSource(ref.surface, ref.incarnation, async (snapshot, scope) => {
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
    })
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
  const captures = async (call: TrustedDomainContext) => {
    const request = host.requestFor(call)
    if (!request || !await host.revalidate(call)) return undefined
    const found = await authority.state.read(request, "reviews", (state, actor) => {
      if (actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion) return undefined
      const receipts = Object.values(state.transactions).filter((receipt) => receipt.namespace === "reviews" && receipt.principalRef === actor.principalRef &&
        receipt.targetRef === authority.creationTarget.ref && receipt.targetIncarnation === authority.creationTarget.incarnation)
      return Object.values(state.reviews).filter((review) => receipts.some((receipt) => {
        const value = object(receipt.value)
        return value.schema === "sf-review-receipt-v1" && Object.keys(value).length === 3 && value.reviewRef === review.id && value.reviewDigest === digestSfValue(review) ||
          value.schema === undefined && value.id === review.id && Array.isArray(value.sections) && Array.isArray(value.sourceRefs) && digestSfValue(value) === digestSfValue(review)
      })).map((review) => structuredClone(review))
    })
    return found.status === "ok" && found.value && !request.signal.aborted && await host.revalidate(call) ? found.value : undefined
  }
  const historicalSource = async (ref: SourceRef, call: TrustedDomainContext) => {
    const first = await captures(call)
    const matching = first?.filter((review) => review.sourceRefs.some((source) => same(source, ref)))
    if (!matching?.length) return false
    const current = await scoped(ref, call)
    const again = await captures(call)
    if (!current || !again || matching.some((review) => !again.some((value) => same(review, value)))) return false
    const checked = await scoped(ref, call)
    return !!checked && same(current, checked) && await host.revalidate(call)
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
    const first = await captures(call)
    const records = first?.flatMap((review) => review.sections.flatMap((section) => {
      if (!isProjection(section.content) || !sameAuthority(section.content, call) || !containsRef(section.content, ref)) return []
      return [{ review, projection: section.content }]
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
        const source = record.review.sourceRefs.find((entry) => matchesRecord(entry, leaf))
        const checked = source ? await scoped(source, call) : undefined
        return checked ? { ref: leaf, source: checked } : undefined
      }))
      return values.some((value) => !value) ? undefined : values
    }
    const sources = await readClosure()
    if (!sources) return current
    const again = await captures(call)
    if (!again?.some((review) => same(review, record.review))) return current
    const checked = await readClosure()
    if (!checked || !same(sources, checked) || ref.kind === "calculation" && await calculation(ref, call) !== calculationProof || !await host.revalidate(call)) return current
    const resolution: BusinessEvidenceResolution = { state: "historical", ref: structuredClone(ref), authorizedProjection: structuredClone(record.projection),
      accessRevision: call.binding.accessRevision, checkedAt: new Date().toISOString(),
      differences: sources.flatMap((value) => value && "source" in value && value.source && value.ref.kind === "record"
        ? [{ field: `${value.ref.refId}.version`, before: value.ref.target.version, after: value.source.version }] : []) }
    return resolution
  }
  const evidence: BusinessContextService = { ...input.evidence, resolve, context: (request, call) => Promise.all(request.refs.map((ref) => resolve(ref, call))) }
  return { currentSource, historicalSource, evidence }
}

function sameAuthority(projection: DomainProjection, call: TrustedDomainContext) {
  return projection.context.installationId === call.binding.installationId && projection.context.projectId === call.binding.projectId &&
    projection.context.principalRef === call.binding.principalRef && projection.context.accessRevision === call.binding.accessRevision && projection.context.policyVersion === call.binding.policyVersion
}
function matchesRecord(source: SourceRef, ref: Extract<BusinessEvidenceRef, { kind: "record" }>) {
  return source.surface === ref.target.surface && source.type === ref.target.recordType && source.id === ref.target.recordId && source.incarnation === ref.target.incarnation &&
    source.version === ref.target.version && ref.target.fields.every((field) => source.fields.includes(field)) &&
    (!ref.target.period || source.period.start <= ref.target.period.start && source.period.end >= ref.target.period.end)
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
