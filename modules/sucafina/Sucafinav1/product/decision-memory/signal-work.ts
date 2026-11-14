import { createHmac } from "node:crypto"
import { canonicalSfValue, digestSfEvidenceRef, digestSfValue, sfEvidenceSourceMaps } from "../contracts/canonical.ts"
import type { AuthorizedCaseProjection, BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ChangeImpact } from "../contracts/decisions.ts"
import type { DecisionCasePort, DomainPortHost } from "../contracts/ports.ts"
import type { Period } from "../contracts/context.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import { reconcileSfSignal } from "./signals.ts"
import type { SfStoredSignalBinding, createSfSignalRegistry } from "./signal-registry.ts"
import type { createSfMaterialityAccess } from "./materiality.ts"

type CaseRef = SfStoredSignalBinding["selection"]["caseRef"]
type SignalRegistry = Pick<ReturnType<typeof createSfSignalRegistry>, "list" | "reconcile">
type MaterialityAccess = ReturnType<typeof createSfMaterialityAccess>
type WorkSourceRefs = readonly BusinessEvidenceRef[]

/** Resolves a C16 selection under current authority, then returns only explicitly authorized current signals. */
export function createSfWorkSignalList(input: {
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  cases: Pick<DecisionCasePort, "read">
  registry: SignalRegistry
  materiality: MaterialityAccess
  resolveSelection: (selectionRef: string, period: Period, call: TrustedDomainContext) => Promise<{ status: "ok"; caseRef: CaseRef } | { status: "unavailable" }>
  establishResolution?: (record: SfStoredSignalBinding, call: TrustedDomainContext) => Promise<string | undefined>
  issueWorkRef: (record: SfStoredSignalBinding, call: TrustedDomainContext) => Promise<string | undefined>
  authorizeBinding: (record: SfStoredSignalBinding, projection: AuthorizedCaseProjection, sourceRefs: WorkSourceRefs, call: TrustedDomainContext) => Promise<boolean>
}) {
  return async (selectionRef: string, period: Period, call: TrustedDomainContext): Promise<
    | { status: "ok"; signals: readonly { label: string; workRef: string; impact: Pick<ChangeImpact, "state" | "reason">; recipientRef: string; destination: string; sourceRefs: WorkSourceRefs }[] }
    | { status: "unavailable" }
  > => {
    try {
      const bindingDigest = digestSfValue([call.kind, call.binding])
      const request = input.host.requestFor(call)
      if (!selectionRef.trim() || !isSfPeriod(period) || !request || request.signal.aborted || !await input.host.revalidate(call)) return { status: "unavailable" }
      const selected = await input.resolveSelection(selectionRef, period, call)
      if (selected.status !== "ok" || !isCaseRef(selected.caseRef)) return { status: "unavailable" }
      const projection = await readAuthorizedCase(input.cases, selected.caseRef, call)
      if (!projection || !await input.host.revalidate(call)) return { status: "unavailable" }
      const listed = await input.registry.list(selected.caseRef, call)
      if (listed.status !== "ok" || !validBindings(listed.records, selected.caseRef, projection, call) || !await input.host.revalidate(call)) return { status: "unavailable" }
      const bindings = listed.records
      const expectedStates = new Map(bindings.map((record) => [record.id, record.signalState]))
      const signals: { label: string; workRef: string; impact: Pick<ChangeImpact, "state" | "reason">; recipientRef: string; destination: string; sourceRefs: WorkSourceRefs; bindingId: string; fingerprint: string }[] = []
      for (const record of bindings) {
        if (record.selection.period.end < period.start || record.selection.period.start > period.end) continue
        const current = await input.materiality(record.id, call)
        if (current.status !== "ok" || current.impact.conditionId !== record.id || !matchesRegisteredScope(current.scope, record)) return { status: "unavailable" }
        if (!current.signal) {
          const resolutionKey = await input.establishResolution?.(record, call)
          if (resolutionKey) {
            const next = reconcileSfSignal(record.signalState, { kind: "resolved", conditionId: record.id, resolutionKey })
            if (!("state" in next)) return { status: "unavailable" }
            if (next.state) {
              const saved = await input.registry.reconcile(record, next.state, call)
              if (saved.status !== "ok") return { status: "unavailable" }
              expectedStates.set(record.id, saved.record.signalState)
            }
          }
          continue
        }
        const selection = record.selection
        if (current.signal.choiceId !== selection.choiceId || current.signal.conditionId !== record.id || current.signal.source.surface !== selection.source.surface || current.signal.source.type !== selection.source.type || current.signal.source.id !== selection.source.id) return { status: "unavailable" }
        const sourceRefs = [...new Map([...current.impact.chosen, ...current.impact.current].map((ref) => [ref.refDigest, ref])).values()]
        if (!validEvidenceRefs(sourceRefs, call)) return { status: "unavailable" }
        if (!await input.authorizeBinding(record, projection, sourceRefs, call)) continue
        const workRef = await input.issueWorkRef(record, call)
        if (!workRef?.trim() || workRef === record.id) return { status: "unavailable" }
        const next = reconcileSfSignal(record.signalState, { kind: "signal", signal: current.signal })
        if (next.action !== "open" && next.action !== "update" && next.action !== "none") return { status: "unavailable" }
        if (!("state" in next) || !next.state) return { status: "unavailable" }
        const saved = await input.registry.reconcile(record, next.state, call)
        if (saved.status !== "ok") return { status: "unavailable" }
        expectedStates.set(record.id, saved.record.signalState)
        if (next.state.status === "resolved") continue
        signals.push({ label: selection.label, workRef, impact: { state: current.impact.state, reason: current.impact.reason }, recipientRef: selection.recipientRef, destination: selection.destination, sourceRefs, bindingId: record.id, fingerprint: digestSfValue([current.signal, current.impact]) })
      }
      if (new Set(signals.map((signal) => signal.workRef)).size !== signals.length) return { status: "unavailable" }
      const selectedAgain = await input.resolveSelection(selectionRef, period, call)
      const projectionAgain = selectedAgain.status === "ok" ? await readAuthorizedCase(input.cases, selectedAgain.caseRef, call) : undefined
      const refreshed = selectedAgain.status === "ok" ? await input.registry.list(selectedAgain.caseRef, call) : undefined
      if (selectedAgain.status !== "ok" || digestSfValue(selectedAgain.caseRef) !== digestSfValue(selected.caseRef) || !projectionAgain || digestSfValue(projectionAgain.case) !== digestSfValue(projection.case) || !refreshed || refreshed.status !== "ok" || registryFingerprint(refreshed.records) !== registryFingerprint(bindings) || !validBindings(refreshed.records, selected.caseRef, projectionAgain, call) || refreshed.records.some((record) => digestSfValue(record.signalState) !== digestSfValue(expectedStates.get(record.id))) || request.signal.aborted || bindingDigest !== digestSfValue([call.kind, call.binding]) || !await input.host.revalidate(call)) return { status: "unavailable" }
      for (const signal of signals) {
        const current = await input.materiality(signal.bindingId, call)
        const record = refreshed.records.find((item) => item.id === signal.bindingId)
        if (!record || current.status !== "ok" || !matchesRegisteredScope(current.scope, record) || !current.signal || current.signal.conditionId !== signal.bindingId || current.signal.choiceId !== record.selection.choiceId || current.signal.source.surface !== record.selection.source.surface || current.signal.source.type !== record.selection.source.type || current.signal.source.id !== record.selection.source.id || digestSfValue([current.signal, current.impact]) !== signal.fingerprint || !await input.authorizeBinding(record, projectionAgain, signal.sourceRefs, call) || await input.issueWorkRef(record, call) !== signal.workRef || request.signal.aborted || !await input.host.revalidate(call)) return { status: "unavailable" }
      }
      return { status: "ok", signals: signals.map(({ label, workRef, impact, recipientRef, destination, sourceRefs }) => ({ label, workRef, impact, recipientRef, destination, sourceRefs })).sort((left, right) => left.label.localeCompare(right.label) || left.destination.localeCompare(right.destination)) }
    } catch {
      return { status: "unavailable" }
    }
  }
}

async function readAuthorizedCase(cases: Pick<DecisionCasePort, "read">, caseRef: CaseRef, call: TrustedDomainContext) {
  const read = await cases.read({ caseRef: encodeCaseRef(caseRef) }, call)
  if (read.status !== "ok") return undefined
  const projection = read.value
  if (projection.case.id !== caseRef.id || projection.case.incarnation !== caseRef.incarnation || projection.case.version !== caseRef.version || projection.context.kind !== call.kind || projection.context.installationId !== call.binding.installationId || projection.context.projectId !== call.binding.projectId || projection.context.principalRef !== call.binding.principalRef || projection.context.policyVersion !== call.binding.policyVersion || projection.context.accessRevision !== call.binding.accessRevision || (call.kind === "native" && (projection.context.kind !== "native" || projection.context.profileId !== call.binding.profileId || call.binding.caseId !== caseRef.id || call.binding.caseIncarnation !== caseRef.incarnation || call.binding.caseVersion !== caseRef.version))) return undefined
  return projection
}

function isCaseRef(value: CaseRef): boolean {
  return !!value && typeof value.id === "string" && !!value.id.trim() && typeof value.incarnation === "string" && !!value.incarnation.trim() && Number.isSafeInteger(value.version) && value.version > 0
}

function validEvidenceRefs(refs: WorkSourceRefs, call: TrustedDomainContext): boolean {
  if (!refs.length || refs.some((ref) => ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId || ref.refDigest !== digestSfEvidenceRef(ref))) return false
  sfEvidenceSourceMaps(refs)
  return true
}

function matchesRegisteredScope(scope: { source: SfStoredSignalBinding["selection"]["source"]; fields: readonly string[]; period: Period; criterionId: string; choiceId: string }, record: SfStoredSignalBinding): boolean {
  const selection = record.selection
  return digestSfValue(scope.source) === digestSfValue(selection.source) && digestSfValue([...scope.fields].sort()) === digestSfValue([...selection.fields].sort()) && digestSfValue(scope.period) === digestSfValue(selection.period) && scope.choiceId === selection.choiceId && scope.criterionId === selection.criterionId
}

function validBindings(records: readonly SfStoredSignalBinding[], caseRef: CaseRef, projection: AuthorizedCaseProjection, call: TrustedDomainContext): boolean {
  return Array.isArray(records) && records.every((record) => {
    const selection = record?.selection
    if (record?.schema !== "sf-memory-condition-v1" || !record.id.trim() || !record.principalRef.trim() || !Number.isSafeInteger(record.revision) || record.revision < 1 || selection.recipientRef !== call.binding.principalRef || (selection.caseRef.id !== caseRef.id || selection.caseRef.incarnation !== caseRef.incarnation || selection.caseRef.version > caseRef.version) || !projection.case.choices.some((choice) => choice.id === selection.choiceId && choice.criteria.includes(selection.criterionId) && digestSfValue(choice) === record.choiceDigest) || !projection.evidenceRefs.some((ref) => digestSfValue(ref) === digestSfValue(selection.evidence)) || selection.evidence.refDigest !== digestSfEvidenceRef(selection.evidence) || selection.evidence.target.surface !== selection.source.surface || selection.evidence.target.recordType !== selection.source.type || selection.evidence.target.recordId !== selection.source.id || selection.evidence.target.incarnation !== selection.source.incarnation || selection.evidence.target.version !== selection.source.version || selection.fields.some((field) => !selection.evidence.target.fields.includes(field) || !selection.source.fields.includes(field)) || !selection.evidence.target.period || selection.evidence.target.period.start > selection.period.start || selection.evidence.target.period.end < selection.period.end || selection.source.period.start > selection.period.start || selection.source.period.end < selection.period.end || !selection.label.trim() || !selection.destination.trim() || (record.signalState && record.signalState.conditionId !== record.id)) return false
    return true
  }) && new Set(records.map((record) => record.id)).size === records.length
}

function registryFingerprint(records: readonly SfStoredSignalBinding[]): string {
  return digestSfValue(records.map((record) => [record.id, record.principalRef, record.choiceDigest, record.selection]).sort(([left], [right]) => String(left).localeCompare(String(right))))
}

/** The host supplies a durable private key; only a current recipient can obtain the opaque ref. */
export function createSfWorkRefIssuer(input: { key: Uint8Array; revalidate: (call: TrustedDomainContext) => Promise<boolean> }) {
  const key = input.key.length >= 32 ? createHmac("sha256", input.key).update("sf-work-ref-key-v1").digest() : undefined
  return async (record: SfStoredSignalBinding, call: TrustedDomainContext) => {
    if (!key || record.selection.recipientRef !== call.binding.principalRef || !await input.revalidate(call)) return undefined
    const scope = [call.binding.installationId, call.binding.projectId, call.binding.principalRef, record.selection.caseRef.id, record.selection.caseRef.incarnation, record.id]
    if (scope.some((item) => !item.trim())) return undefined
    const reference = `work-v1-${createHmac("sha256", key).update(canonicalSfValue(scope)).digest("hex")}`
    return await input.revalidate(call) ? reference : undefined
  }
}
