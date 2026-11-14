import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { AuthorizedCaseProjection } from "../contracts/business-context.ts"
import type { DecisionCasePort, DomainPortHost } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"
import type { ChangeImpact } from "../contracts/decisions.ts"
import { reconcileSfSignal } from "./signals.ts"
import type { SfStoredSignalBinding } from "./signal-registry.ts"
import type { createSfSignalRegistry } from "./signal-registry.ts"
import type { createSfMaterialityAccess, ReconsiderationSignal } from "./materiality.ts"
import { sfReconsiderationFingerprint, sfReconsiderationObservationsAdvance } from "./materiality.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type MaterialityAccess = ReturnType<typeof createSfMaterialityAccess>
type SignalRegistry = Pick<ReturnType<typeof createSfSignalRegistry>, "list" | "reconcile">

/** Host-private signal listing; conditions, assignment and durable dedupe state never come from the browser. */
export function createSfAuthorizedSignalList(input: {
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  cases: Pick<DecisionCasePort, "read">
  registry: SignalRegistry
  materiality: MaterialityAccess
  establishResolution?: (binding: SfStoredSignalBinding, call: TrustedDomainContext) => Promise<string | undefined>
}) {
  return async (requested: CaseRef, call: TrustedDomainContext): Promise<{ status: "ok"; signals: readonly { label: string; impact: Pick<ChangeImpact, "state" | "chosen" | "current" | "reason">; action: "open" | "update" | "none" }[] } | { status: "unavailable" }> => {
    try {
      const caseRef = structuredClone(requested)
      const requestDigest = digestSfValue(caseRef)
      const bindingDigest = digestSfValue([call.kind, call.binding])
      const request = input.host.requestFor(call)
      const unchanged = () => !!request && !request.signal.aborted && bindingDigest === digestSfValue([call.kind, call.binding]) && digestSfValue(requested) === requestDigest && digestSfValue(caseRef) === requestDigest
      if (!request || request.signal.aborted || !isCaseRef(caseRef) || !await input.host.revalidate(call) || !unchanged()) return { status: "unavailable" }
      const projection = await readAuthorizedCase(input.cases, caseRef, call)
      if (!projection || !await input.host.revalidate(call) || !unchanged()) return { status: "unavailable" }
      const listed = await input.registry.list(caseRef, call)
      if (listed.status !== "ok") return { status: "unavailable" }
      const bindings = structuredClone(listed.records)
      const bindingsDigest = digestSfValue(bindings)
      if (!validBindings(bindings, caseRef, projection, call) || !await input.host.revalidate(call) || !unchanged()) return { status: "unavailable" }
      const signals: { label: string; impact: Pick<ChangeImpact, "state" | "chosen" | "current" | "reason">; action: "open" | "update" | "none"; conditionId: string; fingerprint: string; observedSignal: ReconsiderationSignal }[] = []
      const expectedStates = new Map(bindings.map((binding) => [binding.id, binding.signalState]))
      for (const binding of bindings) {
        const selection = binding.selection
        const current = structuredClone(await input.materiality(binding.id, call))
        if (current.status !== "ok" || current.impact.conditionId !== binding.id || current.scope.choiceId !== selection.choiceId || current.scope.criterionId !== selection.criterionId || digestSfValue(current.scope.source) !== digestSfValue(selection.source) || digestSfValue([...current.scope.fields].sort()) !== digestSfValue([...selection.fields].sort()) || digestSfValue(current.scope.period) !== digestSfValue(selection.period) || !unchanged() || digestSfValue(bindings) !== bindingsDigest) return { status: "unavailable" }
        if (!current.signal) {
          const resolutionKey = await input.establishResolution?.(binding, call)
          if (!unchanged() || digestSfValue(bindings) !== bindingsDigest) return { status: "unavailable" }
          if (resolutionKey) {
            const next = reconcileSfSignal(binding.signalState, { kind: "resolved", conditionId: binding.id, resolutionKey })
            if (!("state" in next)) return { status: "unavailable" }
            if (next.state) {
              const saved = await input.registry.reconcile(binding, next.state, call)
              if (saved.status !== "ok" || !unchanged() || digestSfValue(bindings) !== bindingsDigest) return { status: "unavailable" }
              expectedStates.set(binding.id, structuredClone(saved.record.signalState))
            }
          }
          continue
        }
        if (current.signal.choiceId !== selection.choiceId || current.signal.conditionId !== binding.id || current.signal.source.surface !== selection.source.surface || current.signal.source.type !== selection.source.type || current.signal.source.id !== selection.source.id) return { status: "unavailable" }
        const next = reconcileSfSignal(binding.signalState, { kind: "signal", signal: current.signal })
        if (!("state" in next) || !next.state || (next.action !== "open" && next.action !== "update" && next.action !== "none")) return { status: "unavailable" }
        const saved = await input.registry.reconcile(binding, next.state, call)
        if (saved.status !== "ok" || !unchanged() || digestSfValue(bindings) !== bindingsDigest) return { status: "unavailable" }
        expectedStates.set(binding.id, structuredClone(saved.record.signalState))
        if (next.state.status === "resolved") continue
        signals.push({ label: selection.label, impact: { state: current.impact.state, chosen: current.impact.chosen, current: current.impact.current, reason: current.impact.reason }, action: next.action, conditionId: binding.id, fingerprint: sfReconsiderationFingerprint(current.signal, current.impact), observedSignal: current.signal })
      }
      const again = await readAuthorizedCase(input.cases, caseRef, call)
      const refreshed = structuredClone(await input.registry.list(caseRef, call))
      if (!again || digestSfValue(again.case) !== digestSfValue(projection.case) || refreshed.status !== "ok" || bindingFingerprint(refreshed.records) !== bindingFingerprint(bindings) || !validBindings(refreshed.records, caseRef, again, call) || refreshed.records.some((binding) => digestSfValue(binding.signalState) !== digestSfValue(expectedStates.get(binding.id))) || !await input.host.revalidate(call) || !unchanged() || digestSfValue(bindings) !== bindingsDigest) return { status: "unavailable" }
      for (const signal of signals) {
        const current = structuredClone(await input.materiality(signal.conditionId, call))
        if (current.status !== "ok" || !current.signal || !await input.host.revalidate(call) || sfReconsiderationFingerprint(current.signal, current.impact) !== signal.fingerprint || !sfReconsiderationObservationsAdvance(signal.observedSignal, current.signal) || !unchanged() || digestSfValue(bindings) !== bindingsDigest) return { status: "unavailable" }
      }
      // Final synchronous fence after every await, including the empty list path.
      if (!unchanged()) return { status: "unavailable" }
      return { status: "ok", signals: signals.map(({ label, impact, action }) => ({ label, impact, action })).sort((left, right) => left.label.localeCompare(right.label) || left.impact.reason.localeCompare(right.impact.reason)) }
    } catch {
      return { status: "unavailable" }
    }
  }
}

async function readAuthorizedCase(cases: Pick<DecisionCasePort, "read">, caseRef: CaseRef, call: TrustedDomainContext) {
  const read = await cases.read({ caseRef: encodeCaseRef(caseRef) }, call)
  if (read.status !== "ok") return undefined
  const value = structuredClone(read.value)
  if (value.case.id !== caseRef.id || value.case.incarnation !== caseRef.incarnation || value.case.version !== caseRef.version || value.context.kind !== call.kind || value.context.installationId !== call.binding.installationId || value.context.projectId !== call.binding.projectId || value.context.principalRef !== call.binding.principalRef || value.context.policyVersion !== call.binding.policyVersion || value.context.accessRevision !== call.binding.accessRevision || (call.kind === "native" && (value.context.kind !== "native" || value.context.profileId !== call.binding.profileId || call.binding.caseId !== value.case.id || call.binding.caseIncarnation !== value.case.incarnation || call.binding.caseVersion !== value.case.version))) return undefined
  return value
}

function isCaseRef(value: CaseRef): boolean {
  return !!value && typeof value.id === "string" && !!value.id.trim() && typeof value.incarnation === "string" && !!value.incarnation.trim() && Number.isSafeInteger(value.version) && value.version > 0
}

function validBindings(bindings: readonly SfStoredSignalBinding[], caseRef: CaseRef, projection: AuthorizedCaseProjection, call: TrustedDomainContext): boolean {
  if (!Array.isArray(bindings)) return false
  return bindings.every((binding: SfStoredSignalBinding) => {
    const selection = binding?.selection
    if (binding?.schema !== "sf-memory-condition-v1" || !binding.id.trim() || !Number.isSafeInteger(binding.revision) || binding.revision < 1 || selection.recipientRef !== call.binding.principalRef || (selection.caseRef.id !== caseRef.id || selection.caseRef.incarnation !== caseRef.incarnation || selection.caseRef.version > caseRef.version) || !projection.case.choices.some((choice) => choice.id === selection.choiceId && choice.criteria.includes(selection.criterionId) && digestSfValue(choice) === binding.choiceDigest) || !projection.evidenceRefs.some((ref) => digestSfValue(ref) === digestSfValue(selection.evidence)) || selection.evidence.refDigest !== digestSfEvidenceRef(selection.evidence) || selection.evidence.target.surface !== selection.source.surface || selection.evidence.target.recordType !== selection.source.type || selection.evidence.target.recordId !== selection.source.id || selection.evidence.target.incarnation !== selection.source.incarnation || selection.evidence.target.version !== selection.source.version || selection.fields.some((field) => !selection.evidence.target.fields.includes(field) || !selection.source.fields.includes(field)) || !selection.evidence.target.period || selection.evidence.target.period.start > selection.period.start || selection.evidence.target.period.end < selection.period.end || selection.source.period.start > selection.period.start || selection.source.period.end < selection.period.end || !selection.label.trim() || !binding.principalRef.trim() || !selection.destination.trim() || (binding.signalState && binding.signalState.conditionId !== binding.id)) return false
    return true
  }) && new Set(bindings.map((binding) => binding.id)).size === bindings.length
}

function bindingFingerprint(bindings: readonly SfStoredSignalBinding[]): string {
  return digestSfValue(bindings.map((binding) => [binding.id, binding.principalRef, binding.choiceDigest, binding.selection]).sort(([left], [right]) => String(left).localeCompare(String(right))))
}
