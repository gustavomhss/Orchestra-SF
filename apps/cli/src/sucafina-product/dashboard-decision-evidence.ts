import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Snapshot } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue, sfEvidenceSourceMaps } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DomainProjection } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { DecisionCase } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { ScenarioOperation } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfStateAuthority } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { createDashboardRecordEvidenceHost } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/sources.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { projectSfSourceScope } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-projections.ts"
import { receiptProofTransactionKey } from "../../../../modules/sucafina/Sucafinav1/product/decisions/receipt-review-binding.ts"
import { createSfDashboardRecordSourceAccess } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/source-access.ts"
import { createSfRecordHistory } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/business-context.ts"
import type { DashboardPreparedBinding } from "./dashboard-decisions.ts"

type RecordRef = Extract<BusinessEvidenceRef, { kind: "record" }>
export type DashboardSourceCapture = {
  schema: "sf-dashboard-source-capture-v1"
  ref: RecordRef
  projection: DomainProjection
  physicalIncarnation: string
  page: string
  captureDigest: string
}
const same = (left: unknown, right: unknown) => digestSfValue(left) === digestSfValue(right)
const captureDigest = (value: DashboardSourceCapture) => digestSfValue(Object.fromEntries(Object.entries(value).filter(([name]) => name !== "captureDigest")))
const preparedKey = (id: string) => `sf:dashboard-host:prepared:${id}`

/** C12 owns these originals. The command preview is deliberately never an archive:
 * its values describe the hypothetical after state, not the authorized before read. */
export function createSfDashboardDecisionEvidence(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  records: ReturnType<typeof createDashboardRecordEvidenceHost>
  isBinding: (value: unknown) => value is DashboardPreparedBinding
  bindingDigest: (value: DashboardPreparedBinding) => string
}) {
  const { host, state } = input.authority
  const now = () => new Date().toISOString()
  const currentRecord = createSfDashboardRecordSourceAccess({ host, records: input.records })
  const sameAuthority = (authority: SfStateAuthority, call: TrustedDomainContext) => authority.principalRef === call.binding.principalRef &&
    authority.accessRevision === call.binding.accessRevision && authority.policyVersion === call.binding.policyVersion
  const allowedCase = (value: DecisionCase, call: TrustedDomainContext) => value.participants.includes(call.binding.principalRef) &&
    (call.kind === "ui" || value.id === call.binding.caseId && value.incarnation === call.binding.caseIncarnation && value.version === call.binding.caseVersion)
  const unavailable = (ref: BusinessEvidenceRef, call: TrustedDomainContext): BusinessEvidenceResolution =>
    ({ state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt: now() })

  const captureCurrent = (snapshot: Snapshot, capture: DashboardSourceCapture, call: TrustedDomainContext, at: string) => {
    const ref = capture.ref
    const projection = capture.projection
    if (capture.schema !== "sf-dashboard-source-capture-v1" || capture.captureDigest !== captureDigest(capture) || ref.refDigest !== digestSfEvidenceRef(ref) ||
      ref.target.surface !== "dashboard" || ref.target.recordType === "dashboard-page" || !ref.target.period || !sameAuthority(projection.context, call) ||
      projection.context.installationId !== call.binding.installationId || projection.context.projectId !== call.binding.projectId || projection.context.surface !== "dashboard" ||
      projection.version !== ref.target.version || !same(projection.context.period, ref.target.period) || !same(projection.values.map((value) => value.id).sort(),
        ref.target.fields.map((field) => `${ref.target.recordType}:${encodeURIComponent(ref.target.recordId)}:${encodeURIComponent(field)}`).sort())) return false
    const scopes = Object.values(snapshot.sfSources?.scopes ?? {}).filter((entry) => entry.alive && entry.incarnation === ref.target.incarnation &&
      entry.scope.recordType === ref.target.recordType && entry.scope.recordId === ref.target.recordId && entry.scope.principalRef === call.binding.principalRef &&
      entry.scope.accessRevision === call.binding.accessRevision && entry.scope.policyVersion === call.binding.policyVersion)
    const scope = scopes.length === 1 ? scopes[0] : undefined
    const physical = snapshot.sfSources?.records[JSON.stringify([ref.target.recordType, ref.target.recordId])]
    if (!scope || !physical?.alive || scope.sourceIncarnation !== physical.incarnation || physical.incarnation !== capture.physicalIncarnation ||
      scope.version !== ref.target.version || scope.inputDigest !== ref.target.projectionDigest || object(scope.scope.selector).page !== capture.page) return false
    const projected = projectSfSourceScope("dashboard", snapshot, scope.scope, at)
    if (!projected || typeof projected !== "object" || Array.isArray(projected) || digestSfValue(projected) !== ref.target.projectionDigest) return false
    const values = object(projected)
    return ref.target.fields.every((field) => {
      const found = projection.values.filter((value) => value.id === `${ref.target.recordType}:${encodeURIComponent(ref.target.recordId)}:${encodeURIComponent(field)}`)
      return found.length === 1 && same(found[0]!.value, values[field] ?? null) && same(found[0]!.sourceRefs, [ref]) && same(found[0]!.period, ref.target.period)
    })
  }
  const capturesCurrent = (snapshot: Snapshot, captures: readonly DashboardSourceCapture[], call: TrustedDomainContext, at: string) =>
    captures.length > 0 && captures.length <= 128 && new Set(captures.map((capture) => capture.ref.refDigest)).size === captures.length &&
      captures.every((capture) => captureCurrent(snapshot, capture, call, at))
  const captureSources = async (incoming: readonly BusinessEvidenceRef[], call: TrustedDomainContext): Promise<readonly DashboardSourceCapture[] | undefined> => {
    const refs = structuredClone(incoming)
    const request = host.requestFor(call)
    const binding = digestSfValue([call.kind, call.binding])
    if (!request || request.signal.aborted || !refs.length || refs.length > 128 || !await host.revalidate(call)) return undefined
    try {
      sfEvidenceSourceMaps(refs)
      const captures: DashboardSourceCapture[] = []
      for (const ref of refs) {
        if (ref.kind !== "record" || ref.target.surface !== "dashboard" || ref.target.recordType === "dashboard-page") return undefined
        if (captures.some((capture) => same(capture.ref, ref))) continue
        const read = await currentRecord(ref, call)
        if (read.state !== "fresh" || !read.currentRef || !same(read.ref, ref) || !same(read.currentRef, ref) || !read.authorizedProjection || !("values" in read.authorizedProjection)) return undefined
        const projection = structuredClone(read.authorizedProjection)
        const environment = await host.environment(request)
        const capture = await host.persistence.transaction<DashboardSourceCapture | undefined>("dashboard", async (snapshot) => {
          const entries = Object.values(snapshot.sfSources?.scopes ?? {}).filter((entry) => entry.incarnation === ref.target.incarnation)
          const scope = entries.length === 1 ? entries[0] : undefined
          const page = scope && object(scope.scope.selector).page
          if (!scope || typeof page !== "string") return { commit: false, value: undefined }
          const initial: DashboardSourceCapture = { schema: "sf-dashboard-source-capture-v1", ref, projection, physicalIncarnation: scope.sourceIncarnation, page, captureDigest: "" }
          const captured = { ...initial, captureDigest: captureDigest(initial) }
          return { commit: false, value: captureCurrent(snapshot, captured, call, environment.at) ? captured : undefined }
        }, { signal: request.signal })
        if (!capture) return undefined
        captures.push(capture)
      }
      return await host.revalidate(call) && host.requestFor(call) === request && !request.signal.aborted &&
        binding === digestSfValue([call.kind, call.binding]) && same(incoming, refs) ? captures : undefined
    } catch { return undefined }
  }

  /** Prove namespace grants separately, then correlate the exact same protected C08
   * case and binding. This avoids the recursive cases.read -> evidence -> cases.read. */
  const readBindings = async (call: TrustedDomainContext) => {
    const request = host.requestFor(call)
    const binding = digestSfValue([call.kind, call.binding])
    if (!request || request.signal.aborted || !await host.revalidate(call)) return undefined
    const cases = await state.read(request, "cases", (stored, authority) => sameAuthority(authority, call) ?
      Object.values(stored.cases).filter((value) => allowedCase(value, call)) : undefined)
    if (cases.status !== "ok" || !cases.value || cases.value.length > 500) return undefined
    const capturedCases = cases.value
    const records = await state.read(request, "preferences", (stored, authority) => {
      if (!sameAuthority(authority, call) || capturedCases.some((value) => !same(stored.cases[value.id], value))) return undefined
      return capturedCases.flatMap((decision) => decision.preparedChanges.flatMap((change) => {
        const value = stored.preferences[preparedKey(change.id)]
        const choices = decision.choices.filter((choice) => choice.id === change.choiceId)
        if (!input.isBinding(value) || value.recordDigest !== input.bindingDigest(value) || !value.sourceCaptures?.length || value.sourceCaptures.length > 128 ||
          value.caseRef.id !== decision.id || value.caseRef.incarnation !== decision.incarnation || value.caseRef.version > decision.version ||
          change.caseId !== decision.id || change.caseVersion + 1 !== value.caseRef.version || value.changeId !== change.id || value.choiceId !== change.choiceId ||
          !same(value.command, change.operation) || !same(value.command.target, change.target) || value.command.idempotencyKey !== change.idempotencyKey ||
          choices.length !== 1 || value.choiceDigest !== digestSfValue(choices[0]) ||
          !choices[0]!.scenario.operations.some((operation) => same(operation, value.operation)) ||
          value.draft.caseRef.id !== decision.id || value.draft.caseRef.incarnation !== decision.incarnation || value.draft.principalRef !== value.principalRef ||
          value.draft.accessRevision !== value.accessRevision || value.draft.policyVersion !== value.policyVersion ||
          !same(stored.preferences[`sf:proposal-coverage:hot-topic:history:${digestSfValue(value.draft.draftRef)}`], value.draft) ||
          value.draft.recordDigest !== digestSfValue(Object.fromEntries(Object.entries(value.draft).filter(([name]) => name !== "recordDigest")))) return []
        const captures = value.sourceCaptures
        if (new Set(captures.map((capture) => capture.ref.refDigest)).size !== captures.length ||
          value.draft.sourceRefs.some((ref) => !captures.some((capture) => same(capture.ref, ref))) || captures.some((capture) =>
            capture.schema !== "sf-dashboard-source-capture-v1" || capture.captureDigest !== captureDigest(capture) ||
            !value.draft.sourceRefs.some((ref) => same(ref, capture.ref)) || capture.ref.kind !== "record" || capture.ref.target.surface !== "dashboard" ||
            capture.ref.refDigest !== digestSfEvidenceRef(capture.ref) || capture.ref.installationId !== call.binding.installationId || capture.ref.projectId !== call.binding.projectId ||
            capture.projection.context.principalRef !== value.principalRef || capture.projection.context.accessRevision !== value.accessRevision ||
            capture.projection.context.policyVersion !== value.policyVersion || capture.projection.version !== capture.ref.target.version ||
            capture.projection.context.installationId !== capture.ref.installationId || capture.projection.context.projectId !== capture.ref.projectId ||
            !capture.physicalIncarnation || !capture.page)) return []
        return [{ decision, change, binding: value }]
      }))
    })
    return records.status === "ok" && records.value && await host.revalidate(call) && host.requestFor(call) === request && !request.signal.aborted &&
      binding === digestSfValue([call.kind, call.binding]) ? records.value : undefined
  }
  const readOriginalCapture = async (digest: string, call: TrustedDomainContext) => {
    const records = await readBindings(call)
    const captures = records?.flatMap((record) => record.binding.sourceCaptures!.filter((capture) => capture.ref.refDigest === digest)) ?? []
    if (!captures.length || captures.some((capture) => !same(capture, captures[0]))) return undefined
    const capture = captures[0]!
    // The stored physical identity is checked as well as the scope lineage used by
    // createSfRecordHistory, so deleting/recreating the same textual ID never passes.
    const physical = await host.persistence.transaction("dashboard", async (snapshot) => ({ commit: false,
      value: snapshot.sfSources?.records[JSON.stringify([capture.ref.target.recordType, capture.ref.target.recordId])] }))
    return physical?.alive && physical.incarnation === capture.physicalIncarnation && await host.revalidate(call)
      ? { ref: structuredClone(capture.ref), projection: structuredClone(capture.projection) } : undefined
  }
  const history = createSfRecordHistory({ host, readOriginalCapture, now,
    current: async (original, page, call) => {
      if (!page || !original.target.period || original.target.surface !== "dashboard") return unavailable(original, call)
      const current = await input.records.issue({ page, recordType: original.target.recordType, recordId: original.target.recordId, fields: original.target.fields, period: original.target.period }, call)
      return current.status === "ok" ? currentRecord(current.value, call) : unavailable(original, call)
    } })
  const readReceipt = async (ref: Extract<BusinessEvidenceRef, { kind: "receipt" }>, call: TrustedDomainContext) => {
    if (ref.schema !== "sf-evidence-v1" || ref.target.surface !== "dashboard" || ref.refDigest !== digestSfEvidenceRef(ref) ||
      ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId) return undefined
    const request = host.requestFor(call)
    const records = await readBindings(call)
    if (!request || !records) return undefined
    const matches = records.filter(({ decision, change }) => change.receipt?.id === ref.target.receiptId &&
      decision.sourceRefs.some((source) => same(source, ref)))
    if (matches.length !== 1) return undefined
    const value = matches[0]!
    const receipt = await state.read(request, "receipts", (stored, authority) => {
      if (!sameAuthority(authority, call) || !same(stored.cases[value.decision.id], value.decision) ||
        !same(stored.preferences[preparedKey(value.change.id)], value.binding)) return undefined
      const actual = stored.receipts[ref.target.receiptId]
      const proof = actual && stored.transactions[receiptProofTransactionKey(actual.principalRef, value.change.target.id, actual.idempotencyKey)]
      if (!actual || !proof || proof.namespace !== "receipts" || proof.principalRef !== actual.principalRef || proof.targetRef !== value.change.target.id ||
        proof.targetIncarnation !== actual.targetIncarnation || proof.scopeDigest !== digestSfValue(["cases", "receipts"]) || proof.incarnation !== stored.incarnation ||
        !Number.isSafeInteger(proof.storageVersion) || proof.storageVersion < 1 || proof.storageVersion > stored.versions.receipts ||
        !Number.isSafeInteger(proof.aggregateRevision) || proof.aggregateRevision < 1 || proof.aggregateRevision > stored.revision ||
        !/^[a-f0-9]{64}$/.test(proof.commandDigest) || !same(proof.value, actual)) return undefined
      return { actual, proof }
    })
    if (receipt.status !== "ok" || !receipt.value) return undefined
    const actual = receipt.value.actual
    const { change, binding } = value
    const caseReceipts = value.decision.receipts.filter((item) => item.id === actual.id)
    if (ref.refId !== `receipt:${actual.id}` || !same(change.receipt, actual) || caseReceipts.length !== 1 || !same(caseReceipts[0], actual) ||
      actual.principalRef !== binding.principalRef || actual.surface !== "dashboard" || ref.target.surface !== actual.surface ||
      actual.targetIncarnation !== ref.target.targetIncarnation || actual.commandDigest !== ref.target.commandDigest || actual.idempotencyKey !== ref.target.idempotencyKey ||
      actual.version !== ref.target.version || change.target.surface !== "dashboard" || change.target.incarnation !== actual.targetIncarnation ||
      change.operation.commandDigest !== actual.commandDigest || change.idempotencyKey !== actual.idempotencyKey ||
      (actual.result.ok ? change.state !== "applied" : change.state !== (actual.result.status === 409 ? "conflict" : "failed"))) return undefined
    const target = binding.sourceCaptures!.find((capture) => same(capture.ref, binding.draft.targetEvidence))
    if (!target) return undefined
    const authorized = await history.resolve(target.ref, call)
    if ((authorized.state !== "fresh" && authorized.state !== "historical") || !authorized.currentRef) return undefined
    const current = await currentRecord(authorized.currentRef, call)
    if (current.state !== "fresh" || !current.currentRef || !same(current.currentRef, authorized.currentRef) || !current.authorizedProjection || !("values" in current.authorizedProjection)) return undefined
    return { ...value, receipt: receipt.value, currentRef: current.currentRef, projection: current.authorizedProjection }
  }
  const resolveEvidence = async (incoming: BusinessEvidenceRef, call: TrustedDomainContext): Promise<BusinessEvidenceResolution | undefined> => {
    if ((incoming.kind !== "record" && incoming.kind !== "receipt") || incoming.target.surface !== "dashboard") return undefined
    const ref = structuredClone(incoming)
    const request = host.requestFor(call)
    const binding = digestSfValue([call.kind, call.binding])
    try {
      sfEvidenceSourceMaps([ref])
      if (!request || request.signal.aborted || ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId || !await host.revalidate(call)) return unavailable(ref, call)
      if (ref.kind === "record") {
        const result = await history.resolve(ref, call)
        return await host.revalidate(call) && host.requestFor(call) === request && !request.signal.aborted &&
          binding === digestSfValue([call.kind, call.binding]) && same(incoming, ref) ? result : unavailable(ref, call)
      }
      const first = await readReceipt(ref, call)
      const second = first && await readReceipt(ref, call)
      if (!first || !second || !same(receiptIdentity(first), receiptIdentity(second)) || !await host.revalidate(call) ||
        host.requestFor(call) !== request || request.signal.aborted || binding !== digestSfValue([call.kind, call.binding]) || !same(incoming, ref)) return unavailable(ref, call)
      const projection: DomainProjection = { context: second.projection.context, version: second.receipt.actual.version, engineVersion: "dashboard-receipt-v1", components: [], missing: [], values: [
        { id: "applicationStatus", value: second.change.state, period: second.projection.context.period, granularity: "record", sourceRefs: [ref], drilldown: ref, evidenceState: "confirmed" },
        { id: "applicationVersion", value: second.receipt.actual.version, period: second.projection.context.period, granularity: "record", sourceRefs: [ref], drilldown: ref, evidenceState: "confirmed" },
      ] }
      return { state: "fresh", ref, currentRef: ref, authorizedProjection: projection, accessRevision: call.binding.accessRevision, checkedAt: now() }
    } catch { return unavailable(ref, call) }
  }
  const proveContinuity = async (original: BusinessEvidenceRef, current: BusinessEvidenceRef, call: TrustedDomainContext) => {
    if (original.kind === "record" && original.target.surface === "dashboard") return history.proveContinuity(original, current, call)
    if (original.kind !== "receipt" || original.target.surface !== "dashboard" || !same(original, current)) return false
    const result = await resolveEvidence(original, call)
    return result?.state === "fresh" && !!result.currentRef && same(result.currentRef, current) && await host.revalidate(call)
  }
  const resolveRecordedOperation = async (incoming: { caseRef: { id: string; incarnation: string; version: number }; draftRef: string; operation: ScenarioOperation }, call: TrustedDomainContext) => {
    const selected = structuredClone(incoming)
    const request = host.requestFor(call)
    const binding = digestSfValue([call.kind, call.binding])
    if (!request || request.signal.aborted || !await host.revalidate(call)) return undefined
    const find = async () => (await readBindings(call))?.filter((record) => same({ id: record.decision.id, incarnation: record.decision.incarnation, version: record.decision.version }, selected.caseRef) &&
      record.binding.draft.draftRef === selected.draftRef && same(record.binding.operation, selected.operation) && !!record.change.receipt)
    const first = await find()
    if (first?.length !== 1) return undefined
    const recorded = first[0]!
    const receipts = recorded.decision.sourceRefs.filter((ref): ref is Extract<BusinessEvidenceRef, { kind: "receipt" }> =>
      ref.kind === "receipt" && ref.target.surface === "dashboard" && ref.target.receiptId === recorded.change.receipt!.id)
    if (receipts.length !== 1 || !(await readReceipt(receipts[0]!, call))) return undefined
    for (const ref of recorded.binding.draft.sourceRefs) {
      const result = await history.resolve(ref, call)
      if ((result.state !== "fresh" && result.state !== "historical") || !same(result.ref, ref)) return undefined
    }
    const second = await find()
    if (!second || !same(second, first) || !await host.revalidate(call) || host.requestFor(call) !== request || request.signal.aborted ||
      binding !== digestSfValue([call.kind, call.binding]) || !same(selected, incoming)) return undefined
    return { status: "ok" as const, value: { operationDigest: digestSfValue(selected.operation), kind: "external" as const,
      sourceRefs: structuredClone(recorded.binding.draft.sourceRefs), condition: "Financial impact of the Hot Topic change is not assessed." } }
  }
  return { captureSources, capturesCurrent, resolveEvidence, proveContinuity, resolveRecordedOperation }
}

function receiptIdentity<T extends { projection: DomainProjection }>(value: T) {
  return { ...value, projection: { ...value.projection, context: { ...value.projection.context,
    sourceRefs: value.projection.context.sourceRefs.map((ref) => ({ ...ref, observedAt: "" })) } } }
}
